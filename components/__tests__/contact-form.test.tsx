/**
 * The estimator's contact form — the only way a lead reaches the business.
 *
 * This file previously described an older estimator (different copy, a payload built from
 * the services list). That implementation was replaced by the chips-and-assistant design,
 * and in the rewrite the form lost **both** its client-side validation and its call to the
 * API: `onSubmit` did `preventDefault(); setSent(true)` and nothing else, so every visitor
 * saw a success state while the request went nowhere. These tests pin down the behaviour
 * that must never regress again:
 *
 *   1. an invalid form does not reach the network,
 *   2. a valid one does, exactly once, carrying what the visitor actually chose,
 *   3. a failure is visible and non-destructive.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The estimator reads `?serviciu=` so a visitor arriving from a service page lands on the
// right project type. That needs the App Router context, which a bare render has no
// business providing — so the hook is stubbed, and the preselection has its own test below.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
}));
let mockSearch = "";

// Only the network layer is mocked. Validation stays REAL (@/lib/validation), so these
// tests exercise the rules the backend also enforces.
vi.mock("@/lib/api", () => ({
  submitContact: vi.fn(),
  isNetworkError: vi.fn(() => false),
  isUnauthorized: vi.fn(() => false),
  fetchContent: vi.fn(),
  saveContent: vi.fn(),
  login: vi.fn(),
  fetchMe: vi.fn(),
  fetchSubmissions: vi.fn(),
  deleteSubmission: vi.fn(),
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import * as api from "@/lib/api";
import { Estimator, type EstimatorProps } from "@/components/sections/Estimator";
import { SiteContentProvider, defaultSiteData } from "@/lib/siteContent";
import { services as seededServices } from "@/lib/content";

/* The estimator shows the OWNER's price. Deriving the expectation from the seed keeps these
   tests honest when a price changes: they assert the wiring, not a figure someone typed. */
const seededPrice = (serviceId: string) =>
  seededServices.find((s) => s.id === serviceId)!.price.ro;

const NAME_PH = "Nume și companie";
const EMAIL_PH = "Email";
const PHONE_PH = "Telefon (opțional)";
const DETAILS_PH = "Adaugă orice detaliu important";
const SUBMIT = /Trimite cererea/;
/* The chat composer — the visitor's own words, next to the quick replies. */
const CHAT_LABEL = "Scrie asistentului";
const CHAT_SEND = "Trimite răspunsul";

function renderForm(props: EstimatorProps = {}) {
  return render(
    <SiteContentProvider>
      <Estimator {...props} />
    </SiteContentProvider>,
  );
}

/** Type `text` into the chat composer and send it as a free-form answer. */
async function say(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByLabelText(CHAT_LABEL), text);
  await user.click(screen.getByRole("button", { name: CHAT_SEND }));
}

/** Click one of the assistant's quick replies. */
async function tap(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name }));
}

/** Walk the whole dialog to its end, mixing a free description with quick replies. */
async function completeDialog(user: ReturnType<typeof userEvent.setup>) {
  await say(user, "Vrem un magazin online pentru piese auto.");
  await tap(user, "Pornim de la zero"); // the clarification round
  await tap(user, "În 1–2 luni");
  await tap(user, "Sub €5.000");
  await tap(user, "Am o idee, nu un plan"); // the free-description step
  await tap(user, "Extindem un sistem existent"); // clarification again
  await tap(user, "Sari peste"); // the optional extra step
}

/** Fill the two required fields with acceptable values. */
async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
  await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
}

beforeEach(() => {
  mockSearch = "";
  /* SiteContentProvider caches the last good payload in localStorage, so without this a
     test that resolved real prices would leak them into the next test's "offline" run. */
  window.localStorage.clear();
  // The provider fetches content on mount; reject so it keeps the bundled defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  vi.mocked(api.isNetworkError).mockReturnValue(false);
  vi.mocked(api.submitContact).mockResolvedValue(undefined);
});

describe("fields", () => {
  it("renders name, email, phone, details and a submit button", () => {
    renderForm();
    expect(screen.getByPlaceholderText(NAME_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(EMAIL_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PHONE_PH)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(DETAILS_PH)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SUBMIT })).toBeEnabled();
  });
});

describe("arriving from a service page", () => {
  it("preselects the project type named on the URL", async () => {
    const user = userEvent.setup();
    mockSearch = "serviciu=e-commerce";
    renderForm();

    // The proposal price is the visible proof of which type is active — and it is the
    // owner's price for the `shop` service, not a figure baked into the estimator.
    expect(screen.getByText(seededPrice("shop"))).toBeInTheDocument();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(api.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({ project: "E-commerce", estimate: seededPrice("shop") }),
    );
  });

  it("maps the AI assistants direction onto automation", () => {
    mockSearch = "serviciu=asistenti-ia";
    renderForm();
    expect(screen.getByText(seededPrice("automation"))).toBeInTheDocument();
  });

  it("falls back to the first type for an unknown or absent service", () => {
    mockSearch = "serviciu=habar-n-am";
    renderForm();
    expect(screen.getByText(seededPrice("site"))).toBeInTheDocument();
  });
});

describe("validation — nothing invalid reaches the network", () => {
  it("refuses an empty form and names both missing fields", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Numele este obligatoriu.")).toBeInTheDocument();
    expect(screen.getByText("Emailul este obligatoriu.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "not-an-email");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Introdu o adresă de email validă.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("rejects markup smuggled into a field", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText(NAME_PH), "<script>x</script>");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(
      screen.getByText("Numele conține caractere sau cod nepermis."),
    ).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("accepts a blank phone — it is optional — but rejects a malformed one", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.type(screen.getByPlaceholderText(PHONE_PH), "abc");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByText("Introdu un număr de telefon valid.")).toBeInTheDocument();
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("clears a field's message as soon as it is edited", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));
    expect(screen.getByText("Numele este obligatoriu.")).toBeInTheDocument();

    // Otherwise "is required" sits under a field the visitor has just filled in.
    await user.type(screen.getByPlaceholderText(NAME_PH), "I");
    expect(screen.queryByText("Numele este obligatoriu.")).not.toBeInTheDocument();
    // The other field's message is untouched — only the edited one clears.
    expect(screen.getByText("Emailul este obligatoriu.")).toBeInTheDocument();
  });

  it("marks the offending field with aria-invalid", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(screen.getByPlaceholderText(NAME_PH)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("submit — the request actually leaves", () => {
  it("posts once and carries the project type and estimate", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.type(screen.getByPlaceholderText(PHONE_PH), "+373 600 00 000");
    await user.type(screen.getByPlaceholderText(DETAILS_PH), "Vreau un site nou.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Am primit cererea/)).toBeInTheDocument();
    expect(api.submitContact).toHaveBeenCalledTimes(1);
    expect(api.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ion Popescu",
        email: "ion@example.com",
        phone: "+373 600 00 000",
        project: "Site / prezentare",
        estimate: seededPrice("site"),
      }),
    );
  });

  it("includes the chosen options in the message", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("Opțiuni alese");
    expect(payload.message).toContain("+ Integrări & API"); // the default selection
  });

  it("includes the assistant dialog, which the UI promises is attached", async () => {
    const user = userEvent.setup();
    renderForm();

    // Answer the assistant's first question for real — an earlier version of this test
    // looked for a button that never existed, so it asserted nothing.
    await tap(user, "Mai mulți clienți");

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("Dialog");
    expect(payload.message).toContain("Mai mulți clienți");
  });

  it("cannot be double-submitted", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    const button = screen.getByRole("button", { name: SUBMIT });
    await user.click(button);
    await screen.findByText(/Am primit cererea/);
    // The button is disabled after success, so a second click is a no-op.
    expect(screen.getByRole("button", { name: /Cerere trimisă/ })).toBeDisabled();
    expect(api.submitContact).toHaveBeenCalledTimes(1);
  });
});

describe("failure — visible, and nothing is lost", () => {
  it("reports a network failure and keeps what was typed", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new Error("offline"));
    vi.mocked(api.isNetworkError).mockReturnValue(true);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Nu am putut contacta serverul/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(NAME_PH)).toHaveValue("Ion Popescu");
    expect(screen.queryByText(/Am primit cererea/)).not.toBeInTheDocument();
  });

  it("explains a 429 as rate limiting rather than a broken form", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new api.ApiError(429, "Too Many Requests"));
    vi.mocked(api.isNetworkError).mockReturnValue(false);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Prea multe cereri/)).toBeInTheDocument();
  });

  it("falls back to a generic message for any other error", async () => {
    const user = userEvent.setup();
    vi.mocked(api.submitContact).mockRejectedValue(new Error("boom"));
    vi.mocked(api.isNetworkError).mockReturnValue(false);
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Cererea nu a putut fi trimisă/)).toBeInTheDocument();
  });
});

/*
 * The dialog is not a decoration: what the visitor says in it is the brief. These tests
 * pin the three things that make it worth having — a visitor can answer in their own
 * words, the assistant follows up on those words, and the result is visible before it
 * is sent.
 */
describe("dialog — the visitor can answer in their own words", () => {
  it("shows a freely typed description as a client bubble and clears the composer", async () => {
    const user = userEvent.setup();
    renderForm();

    await say(user, "Avem o pensiune și vrem rezervări online.");

    expect(
      screen.getByText("Avem o pensiune și vrem rezervări online."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(CHAT_LABEL)).toHaveValue("");
  });

  it("asks a clarifying question right after the free description", async () => {
    const user = userEvent.setup();
    renderForm();

    await say(user, "Avem o pensiune și vrem rezervări online.");

    // The clarification follows the selected project type (Site is the default), so it
    // reads as a follow-up rather than a generic "tell me more".
    expect(screen.getByText(/ce trebuie să facă vizitatorul pe site/)).toBeInTheDocument();
    // …with quick replies AND the composer still available.
    expect(screen.getByRole("button", { name: "Pornim de la zero" })).toBeInTheDocument();
    expect(screen.getByLabelText(CHAT_LABEL)).toBeInTheDocument();
  });

  it("keeps the clarification relevant to the chosen project type", async () => {
    const user = userEvent.setup();
    renderForm();

    await tap(user, "CRM la comandă");
    await say(user, "Vrem să nu mai ținem clienții în Excel.");

    expect(screen.getByText(/ce procese intră în CRM/)).toBeInTheDocument();
  });

  it("resumes the flow after the clarification instead of dropping the visitor", async () => {
    const user = userEvent.setup();
    renderForm();

    await say(user, "Vrem un site nou.");
    await tap(user, "Pornim de la zero");

    expect(screen.getByText("Când vrei să înceapă proiectul?")).toBeInTheDocument();
  });

  it("offers an optional extra-details step that can be skipped", async () => {
    const user = userEvent.setup();
    renderForm();

    await say(user, "Vrem un site nou.");
    await tap(user, "Pornim de la zero");
    await tap(user, "În 1–2 luni");
    await tap(user, "Sub €5.000");
    await tap(user, "Am o idee, nu un plan");
    await tap(user, "Extindem un sistem existent");

    expect(screen.getByText(/Pasul e opțional/)).toBeInTheDocument();
    await tap(user, "Sari peste");
    // Skipping still closes the dialog — the step never blocks the request.
    expect(screen.getByTestId("estimator-summary")).toBeInTheDocument();
  });

  it("refuses markup typed into the chat and keeps it out of the log", async () => {
    const user = userEvent.setup();
    renderForm();

    await say(user, "<script>alert(1)</script>");

    expect(
      screen.getByText("Mesajul conține caractere sau cod nepermis."),
    ).toBeInTheDocument();
    // The dialog did not move on, so nothing was added to the log…
    expect(screen.getByRole("button", { name: "Mai mulți clienți" })).toBeInTheDocument();
    // …and the visitor's text is still there to be fixed, not silently discarded.
    expect(screen.getByLabelText(CHAT_LABEL)).toHaveValue("<script>alert(1)</script>");
    // Nothing about the dialog talks to the network.
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("does not send an empty free answer", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByRole("button", { name: CHAT_SEND })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: CHAT_SEND }));
    expect(screen.getByText("Bună! Care este obiectivul principal al proiectului tău?"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mai mulți clienți" })).toBeInTheDocument();
  });
});

describe("summary — visible, then sent", () => {
  it("appears at the end of the dialog with what the assistant understood", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByTestId("estimator-summary")).not.toBeInTheDocument();
    await completeDialog(user);

    const summary = screen.getByTestId("estimator-summary");
    expect(within(summary).getByText("Rezumatul cererii")).toBeInTheDocument();
    expect(within(summary).getByText("Tip proiect")).toBeInTheDocument();
    expect(within(summary).getByText("Site / prezentare")).toBeInTheDocument();
    // The free description and the clarifications each get their own row.
    const described = within(summary).getByText("Ce ai descris").parentElement;
    expect(described).toHaveTextContent("Vrem un magazin online pentru piese auto.");
    const clarifications = within(summary).getByText("Clarificări").parentElement;
    expect(clarifications).toHaveTextContent("Pornim de la zero");
    expect(clarifications).toHaveTextContent("Când vrei să înceapă proiectul?");
  });

  it("travels with the request rather than staying on screen", async () => {
    const user = userEvent.setup();
    renderForm();

    await completeDialog(user);
    await fillValid(user);
    await user.type(screen.getByPlaceholderText(DETAILS_PH), "Avem deja logo și texte.");
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("REZUMATUL CERERII");
    expect(payload.message).toContain("Tip proiect: Site / prezentare");
    expect(payload.message).toContain("Vrem un magazin online pentru piese auto.");
    expect(payload.message).toContain("Clarificări");
    expect(payload.message).toContain("Detalii suplimentare: Avem deja logo și texte.");
    // The raw transcript still follows the summary.
    expect(payload.message).toContain("Dialog");
  });

  it("carries the summary even when the dialog was never finished", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("REZUMATUL CERERII");
    expect(payload.message).toContain("Opțiuni alese");
  });

  it("stays under the API's 5000-character cap and marks what it cut", async () => {
    const user = userEvent.setup();
    renderForm();

    await completeDialog(user);
    await fillValid(user);
    // maxLength stops a human at 4000; a paste-happy one still can't blow the cap.
    fireEvent.change(screen.getByPlaceholderText(DETAILS_PH), {
      target: { value: "x".repeat(4900) },
    });
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    const message = vi.mocked(api.submitContact).mock.calls[0][0].message ?? "";
    expect(message.length).toBeLessThanOrEqual(5000);
    expect(message).toContain("[…]"); // the cut is visible, not silent
    expect(message.startsWith("REZUMATUL CERERII")).toBe(true);
    expect(api.submitContact).toHaveBeenCalledTimes(1);
  });
});

describe("long input — no horizontal overflow", () => {
  const CSS = readFileSync(
    resolve(process.cwd(), "components/sections/Estimator.module.css"),
    "utf8",
  );
  /** The declarations of a single class rule, e.g. `.bubble { … }`. */
  const rule = (selector: string) =>
    CSS.slice(CSS.indexOf(`${selector} {`)).slice(0, CSS.slice(CSS.indexOf(`${selector} {`)).indexOf("}"));

  it("renders an 80-character unbroken word in the log", async () => {
    const user = userEvent.setup();
    const word = "a".repeat(80);
    renderForm();

    await say(user, word);

    expect(screen.getByText(word)).toBeInTheDocument();
  });

  it("forces such a word to wrap instead of widening the panel", () => {
    // jsdom has no layout, so the guarantee is pinned where it actually lives: the rule
    // that makes an unbreakable string wrap, and the log that never scrolls sideways.
    expect(rule(".bubble")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(".bubble")).toMatch(/max-width:\s*min\(88%, 100%\)/);
    expect(rule(".chatLog")).toMatch(/overflow-x:\s*hidden/);
    expect(rule(".summaryValue")).toMatch(/overflow-wrap:\s*anywhere/);
    expect(rule(".composeInput")).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe("dictation slot — mounted by another component", () => {
  it("exposes a mount point next to the chat composer and the details field", () => {
    const { container } = renderForm();

    expect(
      container.querySelector('[data-dictation-slot="estimator-chat"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-dictation-slot="estimator-details"]'),
    ).toBeInTheDocument();
    // Each slot names the field it dictates into.
    expect(screen.getByLabelText(CHAT_LABEL)).toHaveAttribute("id", "estimator-chat-input");
    expect(screen.getByPlaceholderText(DETAILS_PH)).toHaveAttribute("id", "estimator-details");
  });

  it("lets the mounted button write into the field it targets", async () => {
    const user = userEvent.setup();
    renderForm({
      renderChatDictation: ({ targetId, onTranscript }) => (
        <button type="button" data-target={targetId} onClick={() => onTranscript("dictat")}>
          mic
        </button>
      ),
    });

    const mic = screen.getByRole("button", { name: "mic" });
    expect(mic).toHaveAttribute("data-target", "estimator-chat-input");
    await user.click(mic);

    expect(screen.getByLabelText(CHAT_LABEL)).toHaveValue("dictat");
  });
});

/**
 * Where the price comes from.
 *
 * The estimator used to show five hardcoded prices while the owner edited eleven service
 * prices in the admin that were rendered nowhere — `Services` is on no page. The two drifted
 * to a factor of twenty: "€3.000" on screen for a site the owner priced at 150€. The number
 * the visitor sees is now the owner's, and the built-in one is only a fallback.
 */
/**
 * The stepped layout — the same flow, arranged for a dialog.
 *
 * The section above is a page section: two columns, everything at once, the assistant
 * always on screen. Inside a 960px modal that reads as a cramped grid, so `layout="dialog"`
 * runs the flow on one column in three steps — project, contents, details — and puts the
 * assistant behind a button. These tests pin what makes that arrangement worth having:
 * the order, the fact that nothing is lost going back, that the assistant is genuinely
 * optional, and that sending is never behind it.
 */
describe("stepped layout — the flow inside the dialog", () => {
  const STEP_NAMES = ["Proiectul", "Ce conține", "Datele tale"];

  /** The step buttons of the progress indicator, in order. */
  const stepButtons = () =>
    within(screen.getByTestId("request-steps")).getAllByRole("button");

  /** Go to a step the way a visitor does — by pressing it in the progress indicator. */
  const goTo = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
    user.click(within(screen.getByTestId("request-steps")).getByRole("button", { name }));

  /** The step panel currently marked active. */
  const activeStep = (container: HTMLElement) =>
    container.querySelector('[data-step][data-active="true"]');

  it("keeps the home-page section on the section layout by default", () => {
    const { container } = renderForm();

    const flow = screen.getByTestId("request-flow");
    expect(flow).toHaveAttribute("data-layout", "section");
    // No stepping, and the assistant is part of the design rather than a request.
    expect(screen.queryByTestId("request-steps")).toBeNull();
    expect(screen.queryByTestId("chat-toggle")).toBeNull();
    expect(screen.getByLabelText(CHAT_LABEL)).toBeInTheDocument();
    expect(container.querySelector("#estimare")).not.toBeNull();
  });

  it("runs project → options → contact, one step at a time", () => {
    const { container } = renderForm({ layout: "dialog" });

    expect(screen.getByTestId("request-flow")).toHaveAttribute("data-layout", "dialog");
    // The order the visitor was promised, in the DOM order they read.
    expect(
      [...container.querySelectorAll("[data-step]")].map((n) => n.getAttribute("data-step")),
    ).toEqual(["project", "options", "contact"]);
    expect(stepButtons().map((b) => b.textContent)).toEqual(
      STEP_NAMES.map((n, i) => `${i + 1}${n}`),
    );
    expect(activeStep(container)).toHaveAttribute("data-step", "project");
  });

  it("says where you are and how much is left, and marks the current step", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    expect(screen.getByText("Pasul 1 din 3 · au mai rămas 2 pași")).toBeInTheDocument();
    expect(stepButtons()[0]).toHaveAttribute("aria-current", "step");
    expect(stepButtons()[2]).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: "Continuă" }));
    expect(screen.getByText("Pasul 2 din 3 · a mai rămas 1 pas")).toBeInTheDocument();
    expect(stepButtons()[1]).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: "Continuă" }));
    expect(screen.getByText("Pasul 3 din 3 · ultimul pas")).toBeInTheDocument();
    // The last step has no "Continuă" — the form's own submit is the action there.
    expect(screen.queryByRole("button", { name: "Continuă" })).toBeNull();
  });

  it("keeps the owner's price on screen through every step", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    await user.click(screen.getByRole("button", { name: "CRM la comandă" }));
    expect(screen.getByText(seededPrice("crm"))).toBeInTheDocument();

    await goTo(user, /Datele tale/);
    expect(screen.getByText(seededPrice("crm"))).toBeInTheDocument();
  });

  it("does not lose what was filled in when the visitor goes back", async () => {
    const user = userEvent.setup();
    const { container } = renderForm({ layout: "dialog" });

    await user.click(screen.getByRole("button", { name: "CRM la comandă" }));
    await user.click(screen.getByRole("button", { name: "Continuă" }));
    await user.click(screen.getByRole("button", { name: "+ SEO" }));
    await user.click(screen.getByRole("button", { name: "Continuă" }));
    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");

    await user.click(screen.getByRole("button", { name: "Înapoi" }));
    await user.click(screen.getByRole("button", { name: "Înapoi" }));

    expect(activeStep(container)).toHaveAttribute("data-step", "project");
    // Every earlier answer survived the round trip.
    expect(screen.getByText(seededPrice("crm"))).toBeInTheDocument();
    await goTo(user, /Datele tale/);
    expect(screen.getByPlaceholderText(NAME_PH)).toHaveValue("Ion Popescu");
    // …including the option ticked on the middle step, which the request carries.
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.click(screen.getByRole("button", { name: SUBMIT }));
    expect(vi.mocked(api.submitContact).mock.calls[0][0].message).toContain("+ SEO");
  });

  it("does not start the assistant, and does not spend space on it, until it is asked for", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    const toggle = screen.getByTestId("chat-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("chat-panel")).toBeNull();
    expect(screen.queryByLabelText(CHAT_LABEL)).toBeNull();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("chat-panel")).toBeInTheDocument();
    expect(screen.getByLabelText(CHAT_LABEL)).toBeInTheDocument();
  });

  it("explains both paths rather than leaving the choice unmotivated", () => {
    renderForm({ layout: "dialog" });

    expect(screen.getByText("Rapid")).toBeInTheDocument();
    expect(screen.getByText(/Trei pași, nicio întrebare în plus/)).toBeInTheDocument();
    expect(screen.getByText("Ghidat")).toBeInTheDocument();
    expect(screen.getByText(/scrie rezumatul cererii/)).toBeInTheDocument();
  });

  it("sends without the assistant ever being opened — the fast path is actually fast", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    await goTo(user, /Datele tale/);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText(/Am primit cererea/)).toBeInTheDocument();
    expect(api.submitContact).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("chat-panel")).toBeNull();
  });

  it("keeps the dialog's summary when the assistant is closed again", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    await user.click(screen.getByTestId("chat-toggle"));
    await say(user, "Vrem un magazin online pentru piese auto.");
    await tap(user, "Pornim de la zero");

    // Closing it hides the conversation…
    await user.click(screen.getByTestId("chat-toggle"));
    expect(screen.queryByTestId("chat-panel")).toBeNull();
    expect(screen.queryByText("Vrem un magazin online pentru piese auto.")).toBeNull();
    // …and says so, rather than letting it look like the work was thrown away.
    expect(screen.getByText(/Pleacă cu cererea, chiar dacă închizi chatul/)).toBeInTheDocument();

    await goTo(user, /Datele tale/);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    // The request carries every word of it.
    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.message).toContain("REZUMATUL CERERII");
    expect(payload.message).toContain("Vrem un magazin online pentru piese auto.");
    expect(payload.message).toContain("Dialog");

    // Reopening shows the same conversation, continued rather than restarted.
    await user.click(screen.getByTestId("chat-toggle"));
    expect(
      screen.getByText("Vrem un magazin online pentru piese auto."),
    ).toBeInTheDocument();
  });

  it("still preselects the service the dialog was opened from", () => {
    renderForm({ layout: "dialog", context: { serviceSlug: "e-commerce" } });

    expect(screen.getByText(seededPrice("shop"))).toBeInTheDocument();
  });

  it("keeps the submit button's accessible name", async () => {
    const user = userEvent.setup();
    renderForm({ layout: "dialog" });

    await goTo(user, /Datele tale/);
    expect(screen.getByRole("button", { name: "Trimite cererea" })).toBeEnabled();
  });
});

describe("the price is the owner's, not the code's", () => {
  it("shows the admin price instead of the built-in one", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      services: defaultSiteData.services.map((s) =>
        s.id === "site"
          ? { ...s, price: { ro: "de la 150€", ru: "от 150€", en: "from 150€" } }
          : s,
      ),
    });

    renderForm();

    // The owner's string is rendered verbatim — it already carries its own "de la".
    expect(await screen.findByText("de la 150€")).toBeInTheDocument();
    expect(screen.queryByText(/€3\.000/)).not.toBeInTheDocument();

    await fillValid(user);
    await user.click(screen.getByRole("button", { name: SUBMIT }));

    // And the team receives exactly what was on screen.
    expect(api.submitContact).toHaveBeenCalledWith(
      expect.objectContaining({ estimate: "de la 150€" }),
    );
  });

  it("falls back to the built-in price rather than showing the placeholder", async () => {
    // A service whose price the owner has not filled in yet still carries "...". That is a
    // stand-in for an empty field, not a price, and must never reach the visitor.
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      services: defaultSiteData.services.map((s) =>
        s.id === "site" ? { ...s, price: { ro: "...", ru: "...", en: "..." } } : s,
      ),
    });

    renderForm();

    expect(await screen.findByText("de la €3.000")).toBeInTheDocument();
    expect(screen.queryByText("...")).not.toBeInTheDocument();
  });
});
