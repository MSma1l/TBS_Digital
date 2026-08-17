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
import { render, screen, fireEvent, within } from "@testing-library/react";
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
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { SiteContentProvider } from "@/lib/siteContent";
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
     a screen reader announces. (`getByRole("heading", …)` would be ambiguous — the
     estimator section inside carries the same title.) */
  const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
  await within(dialog).findByRole("button", { name: /Trimite cererea/ });
  return dialog;
}

/** Fill the two required fields inside the dialog and send the request. */
async function sendFrom(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
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
    expect(within(dialog).getByText(/€3\.000/)).toBeInTheDocument();
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
    // (the web default would read €3.000).
    expect(within(dialog).getByText(/€6\.000/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/€3\.000/)).toBeNull();
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
    /* Nothing here exceeds what a visitor may actually enter — the chat turn stays under
       its 1000-character limit and the details field under its 4000 — yet together they
       overflow the API's 5000-character message. `fireEvent`, not `user.type`: thousands
       of characters one keystroke at a time takes minutes. */
    fireEvent.change(within(dialog).getByLabelText("Scrie asistentului"), {
      target: { value: "descriere ".repeat(90) },
    });
    await user.click(within(dialog).getByRole("button", { name: "Trimite răspunsul" }));
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
    expect(screen.getByText(/€8\.000/)).toBeInTheDocument();
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
