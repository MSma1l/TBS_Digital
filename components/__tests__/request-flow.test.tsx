/**
 * One request flow, opened from every commercial CTA.
 *
 * The site used to have two different answers to "how does a visitor ask for a project":
 * the home page's CTAs scrolled to an anchor (`#contact`, `#estimare`), while a service page
 * opened a dialog from a component that rendered its own `Modal` — so putting that component
 * on every CTA would have shipped one dialog, one focus trap and one scroll lock **per CTA**.
 *
 * `lib/request/RequestFlowProvider.tsx` replaces both: one dialog, mounted once in
 * `app/layout.tsx`, opened through `openRequest({ … })`. These tests pin the contract:
 *
 *   1. every commercial CTA opens it — and is a real <button>, with no anchor left behind,
 *   2. the context it was opened from reaches the estimator (the service preselects a type)
 *      and the sent request (project + source, so a lead can be routed),
 *   3. the estimator's OWN buttons never open it — the home-page section stays a section,
 *   4. however many CTAs a page has, the DOM holds exactly one dialog.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// The estimator reads `?serviciu=` from the App Router, which a bare render has no business
// providing. The dialog carries the service as context instead — which is the point here.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

/* Interface sound is stubbed so the "click feedback" the CTAs now ask for is observable:
   jsdom has no Web Audio, so the real `play()` would correctly return false and prove
   nothing. Everything else in `@/lib/sound` stays real. */
const { play } = vi.hoisted(() => ({ play: vi.fn(() => true) }));
vi.mock("@/lib/sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sound")>();
  return {
    ...actual,
    useSound: () => ({
      enabled: false,
      reducedMotion: false,
      play,
      setEnabled: () => {},
      toggle: () => false,
      isSupported: () => false,
    }),
  };
});

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
import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/sections/Hero";
import { BottomCTA } from "@/components/sections/BottomCTA";
import { DirectionPage } from "@/components/sections/DirectionPage";
import { RequestSection } from "@/components/sections/RequestSection";
import {
  RequestFlowProvider,
  useRequestFlow,
  type RequestOptions,
} from "@/lib/request/RequestFlowProvider";
import type { EstimatorOptionId, EstimatorTypeId } from "@/lib/request/catalog";
import type { GuideTopic } from "@/lib/hud/topics";
import { SiteContentProvider } from "@/lib/siteContent";
import { services as seededServices } from "@/lib/content";

/* The estimator shows the OWNER's price (seeded in lib/content.ts, overridden by the admin).
   Deriving the expectation keeps this test about the wiring, not about a figure. */
const seededPrice = (serviceId: string) =>
  seededServices.find((s) => s.id === serviceId)!.price.ro;
import { messages } from "@/lib/i18n/messages";
import { LIMITS } from "@/lib/validation";

const ro = messages.ro;

/** The CTAs, by the label a visitor actually reads. */
const CTA = {
  hero: "Începe proiectul",
  navbar: ro["nav.cta"],
  bottom: "Programează consultarea",
  servicePage: "Vorbește cu echipa",
  servicePageBottom: "Începe cererea",
};

/** The shared dialog's accessible name (`RequestFlowProvider` → `COPY.title`). */
const DIALOG_TITLE = "Spune-ne ce vrei să construiești.";

const NAME_PH = "Nume și companie";
const EMAIL_PH = "Email";
const DETAILS_PH = "Adaugă orice detaliu important";

/** Every `role="dialog"` currently in the document — portals included. */
const dialogs = () => document.querySelectorAll('[role="dialog"]');

/** The providers `app/layout.tsx` puts above every page. */
function renderSite(node: ReactNode) {
  return render(
    <SiteContentProvider>
      <RequestFlowProvider>{node}</RequestFlowProvider>
    </SiteContentProvider>,
  );
}

/** The home page's commercial chrome: navbar, hero, the estimator section, the bottom CTA. */
function renderHome() {
  return renderSite(
    <>
      <Navbar />
      <Hero />
      <RequestSection />
      <BottomCTA />
    </>,
  );
}

/**
 * Open the flow from a CTA and wait for the estimator inside it. The flow is code-split
 * (`next/dynamic` in the provider), so the dialog frame lands first and its body arrives
 * with the chunk — exactly as it does in a browser.
 */
async function openFrom(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> {
  await user.click(screen.getAllByRole("button", { name: label })[0]);
  /* By NAME: the dialog takes its accessible name from its own heading, and that is what
     a screen reader announces. */
  const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
  /* The flow is code-split, so wait for its container rather than for any one control:
     inside the dialog the flow is stepped, and only the current step is on screen. */
  await within(dialog).findByTestId("request-flow");
  return dialog;
}

/** Walk to the contact step the way a visitor does — the third step of the dialog flow. */
async function toContactStep(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  await user.click(
    within(within(dialog).getByTestId("request-steps")).getByRole("button", {
      name: /Datele tale/,
    }),
  );
}

/** Fill the two required fields inside the dialog and send the request. */
async function sendFrom(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await toContactStep(user, dialog);
  await user.type(within(dialog).getByPlaceholderText(NAME_PH), "Ion Popescu");
  await user.type(within(dialog).getByPlaceholderText(EMAIL_PH), "ion@example.com");
  await user.click(within(dialog).getByRole("button", { name: /Trimite cererea/ }));
}

/** The `message` field of the one request that was posted. */
function sentMessage(): string {
  expect(api.submitContact).toHaveBeenCalledTimes(1);
  return vi.mocked(api.submitContact).mock.calls[0][0].message ?? "";
}

beforeEach(() => {
  play.mockClear();
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  vi.mocked(api.submitContact).mockResolvedValue(undefined);
});

describe("every commercial CTA opens the one request flow", () => {
  it("opens it from the hero", async () => {
    const user = userEvent.setup();
    renderHome();

    expect(dialogs()).toHaveLength(0);
    const dialog = await openFrom(user, CTA.hero);

    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The real flow mounted inside, not a placeholder: the estimator's own price is there.
    expect(within(dialog).getByText(seededPrice("site"))).toBeInTheDocument();
  });

  it("opens it from the bottom CTA", async () => {
    const user = userEvent.setup();
    renderHome();

    const dialog = await openFrom(user, CTA.bottom);
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("opens it from the navbar's red CTA", async () => {
    const user = userEvent.setup();
    renderHome();

    const dialog = await openFrom(user, CTA.navbar);
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("opens it from the mobile menu — closing the menu first", async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(screen.getByRole("button", { name: ro["nav.burgerAria"] }));
    // Two CTAs are on screen now: the bar's and the overlay's. The overlay's is the last.
    const inMenu = screen.getAllByRole("button", { name: CTA.navbar });
    expect(inMenu).toHaveLength(2);

    await user.click(inMenu[1]);

    expect(await screen.findByRole("dialog", { name: DIALOG_TITLE })).toBeInTheDocument();
    // The menu is gone rather than left stacked behind the dialog: its CTA is no longer in
    // the document and the burger says the overlay is closed.
    expect(screen.getAllByRole("button", { name: CTA.navbar })).toHaveLength(1);
    expect(screen.getByRole("button", { name: ro["nav.burgerAria"] })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens it from both actions on a service page", async () => {
    const user = userEvent.setup();
    renderSite(<DirectionPage slug="produs-digital" />);

    const top = await openFrom(user, CTA.servicePage);
    await user.keyboard("{Escape}");
    expect(dialogs()).toHaveLength(0);
    expect(top).not.toBeInTheDocument();

    const bottom = await openFrom(user, CTA.servicePageBottom);
    expect(bottom).toHaveAttribute("aria-modal", "true");
  });

  it("gives the press a click sound — from the one shared handler, not per button", async () => {
    const user = userEvent.setup();
    renderHome();

    await openFrom(user, CTA.hero);
    // `play()` is a no-op while sound is off (the default) and before a gesture — the
    // provider calls it unconditionally and lets `lib/sound` keep those promises.
    expect(play).toHaveBeenCalledWith("tap");
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("a CTA that opens a dialog is a button, and keeps no anchor", () => {
  it("leaves no #contact / #estimare href on any commercial CTA", async () => {
    renderHome();

    for (const label of [CTA.hero, CTA.navbar, CTA.bottom]) {
      const cta = screen.getAllByRole("button", { name: label })[0];
      expect(cta.tagName).toBe("BUTTON");
      expect(cta).toHaveAttribute("type", "button");
      expect(cta).not.toHaveAttribute("href");
    }

    // Nothing else on the page still points at the anchors the CTAs used to carry…
    const hrefs = Array.from(document.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("#contact");
    expect(hrefs).not.toContain("#estimare");
    // …and the sections those anchors named are still there, still reachable by URL.
    expect(document.querySelector("#contact")).not.toBeNull();
    expect(document.querySelector("#estimare")).not.toBeNull();
  });

  it("returns focus to the CTA that opened it", async () => {
    const user = userEvent.setup();
    renderHome();

    const cta = screen.getAllByRole("button", { name: CTA.hero })[0];
    await openFrom(user, CTA.hero);
    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(cta);
  });

  it("returns focus to the burger when the flow was opened from the mobile menu", async () => {
    const user = userEvent.setup();
    renderHome();

    const burger = screen.getByRole("button", { name: ro["nav.burgerAria"] });
    await user.click(burger);
    await user.click(screen.getAllByRole("button", { name: CTA.navbar })[1]);
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    // The overlay's own CTA unmounted with the menu, so focus goes to the control that is
    // still there and still means "the menu" — never to <body>.
    expect(document.activeElement).toBe(burger);
  });
});

describe("exactly one dialog, however many CTAs the page has", () => {
  it("keeps a single dialog in the DOM with five CTAs on screen", async () => {
    const user = userEvent.setup();
    renderSite(
      <>
        <Navbar />
        <Hero />
        <RequestSection />
        <BottomCTA />
        <DirectionPage slug="produs-digital" />
      </>,
    );

    // Five commercial CTAs really are on screen — otherwise this passes vacuously.
    for (const label of Object.values(CTA)) {
      expect(screen.getAllByRole("button", { name: label }).length).toBeGreaterThan(0);
    }

    expect(dialogs()).toHaveLength(0);
    await openFrom(user, CTA.bottom);
    expect(dialogs()).toHaveLength(1);
  });
});

describe("the context the CTA was pressed in travels with the request", () => {
  it("preselects the service's project type on a service page", async () => {
    const user = userEvent.setup();
    renderSite(<DirectionPage slug="e-commerce" />);

    const dialog = await openFrom(user, CTA.servicePage);
    // The estimator's e-commerce type — its price is what proves the preselection
    // (the web default would read the `site` price).
    expect(within(dialog).getByText(seededPrice("shop"))).toBeInTheDocument();
    expect(within(dialog).queryByText(seededPrice("site"))).toBeNull();
  });

  it("names the service and the CTA in the message that is sent", async () => {
    const user = userEvent.setup();
    renderSite(<DirectionPage slug="e-commerce" />);

    const dialog = await openFrom(user, CTA.servicePage);
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("CONTEXTUL CERERII:");
    expect(message).toContain("- Serviciu: e-commerce");
    expect(message).toContain("- Sursă (CTA): service-page");
  });

  it("names the CTA even when there is no service to name", async () => {
    const user = userEvent.setup();
    renderHome();

    const dialog = await openFrom(user, CTA.hero);
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Sursă (CTA): hero");
    expect(message).not.toContain("- Serviciu:");
  });

  it("carries a project card's identity — name and id — into the request", async () => {
    const user = userEvent.setup();
    renderSite(
      <RequestSection
        context={{ projectId: "bizcheck", projectName: "BizCheck", source: "project-card" }}
      />,
    );

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.click(screen.getByRole("button", { name: /Trimite cererea/ }));

    const message = sentMessage();
    expect(message).toContain("- Proiect: BizCheck (bizcheck)");
    expect(message).toContain("- Sursă (CTA): project-card");
  });

  it("says nothing about an origin when the estimator is just the home-page section", async () => {
    const user = userEvent.setup();
    renderSite(<RequestSection />);

    await user.type(screen.getByPlaceholderText(NAME_PH), "Ion Popescu");
    await user.type(screen.getByPlaceholderText(EMAIL_PH), "ion@example.com");
    await user.click(screen.getByRole("button", { name: /Trimite cererea/ }));

    expect(sentMessage()).not.toContain("CONTEXTUL CERERII");
  });

  it("keeps the origin block even when the 5000-character cap has to cut the summary", async () => {
    const user = userEvent.setup();
    renderHome();

    const dialog = await openFrom(user, CTA.hero);
    /* In the dialog the assistant is opened on request, so this asks for it first. */
    await user.click(within(dialog).getByTestId("chat-toggle"));
    /* Nothing here exceeds what a visitor may actually enter — the chat turn stays under
       its 1000-character limit and the details field under its 4000 — yet together they
       overflow the API's 5000-character message. `fireEvent`, not `user.type`: thousands
       of characters one keystroke at a time takes minutes. */
    fireEvent.change(within(dialog).getByLabelText("Scrie asistentului"), {
      target: { value: "descriere ".repeat(90) },
    });
    await user.click(within(dialog).getByRole("button", { name: "Trimite răspunsul" }));
    await toContactStep(user, dialog);
    fireEvent.change(within(dialog).getByPlaceholderText(DETAILS_PH), {
      target: { value: "detaliu ".repeat(495) },
    });
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message.length).toBeLessThanOrEqual(LIMITS.message);
    // The summary was cut (the marker says so) and the routing information survived it.
    expect(message).toContain("[…]");
    expect(message).toContain("- Sursă (CTA): hero");
  });
});

/**
 * Entry points that say more than "which CTA": the Ghid TBS (a section topic, the assistant
 * up front) and the HUD tools (a project type, the options, an attachment). They land in
 * later phases; this stand-in opens the flow through the same `openRequest` they will call,
 * so what is pinned here is the provider → estimator → message path itself.
 */
const OPEN_WITH = "Deschide cu context";

function OpenWith({ options }: { options: RequestOptions }) {
  const { openRequest } = useRequestFlow();
  return (
    <button type="button" onClick={() => openRequest(options)}>
      {OPEN_WITH}
    </button>
  );
}

/** A calculator handoff as the HUD tool's chunk builds it. */
const CALC_TEXT =
  "CALCULATOR DE COST:\n- Landing page (landing): de la 150€\n- CRM personalizat (crm): de la 450€";

describe("the guide's and the HUD tools' context travels with the request", () => {
  it("names the guide's section next to its source", async () => {
    const user = userEvent.setup();
    renderSite(<OpenWith options={{ source: "guide-prompt", guideTopic: "servicii" }} />);

    const dialog = await openFrom(user, OPEN_WITH);
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("CONTEXTUL CERERII:\n- Secțiune: servicii\n- Sursă (CTA): guide-prompt");
  });

  it("writes no section for a topic the guide does not have", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{ source: "guide", guideTopic: "despre\n- Sursă (CTA): hero" as unknown as GuideTopic }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).not.toContain("- Secțiune:");
    expect(message).not.toContain("despre");
    expect(message).toContain("- Sursă (CTA): guide");
    expect(message).not.toContain("- Sursă (CTA): hero");
  });

  it("opens on the assistant when the guide asks for it, and still sends the topic", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith options={{ source: "guide", openAssistant: true, guideTopic: "lucrari" }} />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    const panel = await within(dialog).findByTestId("chat-panel");
    expect(within(dialog).getByTestId("chat-toggle")).toHaveAttribute("aria-expanded", "true");
    // Inside the real Modal, whose own initial focus runs in the same commit: it must not win.
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

    await user.click(within(panel).getByRole("button", { name: "Mai mulți clienți" }));
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Secțiune: lucrari");
    expect(message).toContain("- Sursă (CTA): guide");
    expect(message).toContain("Client: Mai mulți clienți");
  });

  it("preselects the project type a tool names, over the service's own mapping", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith options={{ source: "os-builder", serviceSlug: "e-commerce", projectType: "crm" }} />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    // e-commerce alone would preselect the `shop` price; the named type wins.
    expect(within(dialog).getByText(seededPrice("crm"))).toBeInTheDocument();
    expect(within(dialog).queryByText(seededPrice("shop"))).toBeNull();

    await sendFrom(user, dialog);
    const payload = vi.mocked(api.submitContact).mock.calls[0][0];
    expect(payload.project).toBe("CRM la comandă");
    expect(payload.estimate).toBe(seededPrice("crm"));
    // The service is still named for routing — the type only chose the chip.
    expect(payload.message).toContain("- Serviciu: e-commerce");
  });

  it("ignores a project type the catalog does not know", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{
          source: "os-builder",
          serviceSlug: "e-commerce",
          // A service id, not a type id — the likeliest mix-up.
          projectType: "shop" as unknown as EstimatorTypeId,
        }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    expect(within(dialog).getByText(seededPrice("shop"))).toBeInTheDocument();
  });

  it("starts with no option ticked when a tool passes an empty list", async () => {
    const user = userEvent.setup();
    renderSite(<OpenWith options={{ source: "os-builder", optionIds: [] }} />);

    const dialog = await openFrom(user, OPEN_WITH);
    await sendFrom(user, dialog);

    expect(sentMessage()).toContain("- Opțiuni alese: fără\n");
  });

  it("ticks exactly the options a tool names, in chip order, dropping unknown ids", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{
          source: "os-builder",
          optionIds: ["seo", "bogus" as unknown as EstimatorOptionId, "design"],
        }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    await sendFrom(user, dialog);

    expect(sentMessage()).toContain("- Opțiuni alese: + Design premium, + SEO\n");
  });

  it("keeps the default option when no list is passed", async () => {
    const user = userEvent.setup();
    renderHome();

    const dialog = await openFrom(user, CTA.hero);
    await sendFrom(user, dialog);

    expect(sentMessage()).toContain("- Opțiuni alese: + Integrări & API\n");
  });

  it("puts an attachment between the summary and the origin, and says so under the proposal", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{
          source: "os-calculator",
          attachment: { kind: "calculator", count: 2, summary: "de la 600€", text: CALC_TEXT },
        }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    expect(
      within(dialog).getByText(
        "Selecția din calculator (servicii: 2 · de la 600€) pleacă împreună cu cererea.",
      ),
    ).toBeInTheDocument();

    await sendFrom(user, dialog);
    const message = sentMessage();
    const summary = message.indexOf("REZUMATUL CERERII");
    const attached = message.indexOf(`\n\n${CALC_TEXT}\n\nCONTEXTUL CERERII:`);
    expect(summary).toBe(0);
    expect(attached).toBeGreaterThan(summary);
    expect(message).toContain("- Sursă (CTA): os-calculator");
  });

  it("names a builder package by its module count", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{
          source: "os-builder",
          attachment: { kind: "builder", count: 3, text: "PACHET:\n1. a\n2. b\n3. c" },
        }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    expect(
      within(dialog).getByText("Pachetul din constructor (module: 3) pleacă împreună cu cererea."),
    ).toBeInTheDocument();
  });

  it("neither notes nor sends an attachment with nothing in it", async () => {
    const user = userEvent.setup();
    renderSite(
      <OpenWith
        options={{ source: "os-builder", attachment: { kind: "builder", count: 0, text: " \x07 " } }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    expect(within(dialog).queryByText(/pleacă împreună cu cererea/)).toBeNull();

    await sendFrom(user, dialog);
    // The origin follows the summary directly — no empty block between them.
    expect(sentMessage()).toMatch(/[^\n]\n\nCONTEXTUL CERERII:/);
  });

  it("keeps the attachment and the origin when the 5000-character cap cuts the summary", async () => {
    const user = userEvent.setup();
    const longText = `${CALC_TEXT}\n${"- Serviciu adăugat: de la 150€\n".repeat(120)}`;
    renderSite(
      <OpenWith
        options={{
          source: "os-calculator",
          guideTopic: "service",
          attachment: { kind: "calculator", count: 122, text: longText },
        }}
      />,
    );

    const dialog = await openFrom(user, OPEN_WITH);
    await toContactStep(user, dialog);
    fireEvent.change(within(dialog).getByPlaceholderText(DETAILS_PH), {
      target: { value: "detaliu ".repeat(495) },
    });
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message.length).toBeLessThanOrEqual(LIMITS.message);
    const attached = message.indexOf(`\n\n${CALC_TEXT}`);
    const origin = message.indexOf("\n\nCONTEXTUL CERERII:");
    // The summary was cut before the attachment…
    expect(message.indexOf("[…]")).toBeGreaterThan(0);
    expect(message.indexOf("[…]")).toBeLessThan(attached);
    // …the attachment kept its own cap and mark, and the origin survived whole after it.
    expect(attached).toBeGreaterThan(0);
    expect(message.slice(attached, origin)).toMatch(/\n\[…\]$/);
    expect(origin - attached).toBeLessThanOrEqual(1200 + 2);
    expect(message).toContain("- Secțiune: service\n- Sursă (CTA): os-calculator");
  });
});

describe("the estimator's own buttons never open a dialog", () => {
  it("keeps chips, quick replies and submit inside the section", async () => {
    const user = userEvent.setup();
    renderSite(<RequestSection />);

    await user.click(screen.getByRole("button", { name: "CRM la comandă" })); // project type
    await user.click(screen.getByRole("button", { name: "+ SEO" })); // option
    await user.click(screen.getByRole("button", { name: "Mai mulți clienți" })); // quick reply
    await user.click(screen.getByRole("button", { name: /Trimite cererea/ })); // submit

    expect(dialogs()).toHaveLength(0);
    expect(play).not.toHaveBeenCalled();
    // The chip really did what it has always done — the estimate followed the CRM type.
    expect(screen.getByText(seededPrice("crm"))).toBeInTheDocument();
    // An invalid form still doesn't reach the network; the submit button is unchanged.
    expect(api.submitContact).not.toHaveBeenCalled();
  });

  it("stays a visible section on the home page rather than becoming a dialog", () => {
    renderHome();

    expect(dialogs()).toHaveLength(0);
    expect(document.querySelector("#estimare")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Trimite cererea/ })).toBeInTheDocument();
  });
});
