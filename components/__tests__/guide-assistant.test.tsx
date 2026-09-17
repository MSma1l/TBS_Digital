/**
 * The Ghid TBS (components/hud/guide/GuideAssistant.tsx): the cube-droid button that opens the
 * request flow on the guided chat, and the tip it offers when a visitor lingers on a topic.
 *
 * What is pinned here:
 *   1. when it renders at all — an answered cookie question, no intro overlay on screen;
 *   2. its markup — a real button with `aria-haspopup="dialog"`, a decorative `aria-hidden`
 *      droid, and a tip that is described, not announced (no role, no live region);
 *   3. the linger engine wired to the page — the centre-line observer, 5 s of visible time,
 *      the limits (2 tips, 60 s apart, a topic once, "Nu mai arăta") and every blocker;
 *   4. visibility — away over the section-layout request form, yield under focus, the tip
 *      cleared when the page is covered;
 *   5. what reaches the request — source, section, service and project.
 *
 * The providers are the real ones (`RequestFlowProvider` → Modal → the estimator), so a message
 * asserted here is the message the API would get. IntersectionObserver is a controllable stub:
 * the centre-line observer and the away observer are driven by hand, any other (Reveal) reports
 * "in view" at once, as the global stub in vitest.setup.ts does. The linger tests run on fake
 * timers with `performance` faked too (visibleTimeout and the cooldown both read it).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import type { ReactNode } from "react";

const h = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => h.pathname,
}));

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
import { GuideAssistant, resetGuideMemoryForTests } from "@/components/hud/guide/GuideAssistant";
import { GUIDE_COPY } from "@/components/hud/guide/copy";
import { CONSENT_KEY, setConsent } from "@/lib/consent";
import { resetHudBusyForTests, setHudBusy } from "@/lib/hud/busy";
import { INTRO_OVERLAY_ID, markIntroGone, resetIntroForTests } from "@/lib/intro";
import { RequestFlowProvider, useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { coverPage } from "@/lib/scrollLock";
import { defaultSiteData, SiteContentProvider } from "@/lib/siteContent";

const ROOT = process.cwd();
const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8").replace(/\r\n/g, "\n");

const ro = <T extends { ro: string }>(text: T) => text.ro;

/** The shared dialog's accessible name (`RequestFlowProvider` → `COPY.title`). */
const DIALOG_TITLE = "Spune-ne ce vrei să construiești.";
const NAME_PH = "Nume și companie";
const EMAIL_PH = "Email";

/* ---- IntersectionObserver, by hand ------------------------------------------------------- */

type Kind = "centre" | "away" | "other";
type ObserverRecord = {
  kind: Kind;
  cb: IntersectionObserverCallback;
  self: IntersectionObserver;
  targets: Set<Element>;
  live: boolean;
};

const observers: ObserverRecord[] = [];

class ControlledObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number>;
  private readonly record: ObserverRecord;

  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.rootMargin = options?.rootMargin ?? "";
    this.thresholds = [typeof options?.threshold === "number" ? options.threshold : 0];
    const kind: Kind =
      options?.rootMargin === "-50% 0px -50% 0px"
        ? "centre"
        : options?.threshold === 0
          ? "away"
          : "other";
    this.record = { kind, cb, self: this, targets: new Set(), live: true };
    observers.push(this.record);
  }

  observe(target: Element) {
    this.record.targets.add(target);
    // Reveal and anything else: in view at once, like the global stub.
    if (this.record.kind === "other") {
      this.record.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this);
    }
  }

  unobserve(target: Element) {
    this.record.targets.delete(target);
  }

  disconnect() {
    this.record.targets.clear();
    this.record.live = false;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Report `el` crossing (or leaving) the centre line, or the viewport for the away observer. */
function report(kind: "centre" | "away", el: Element, isIntersecting: boolean) {
  const watching = observers.filter((o) => o.live && o.kind === kind && o.targets.has(el));
  expect(watching.length, `a live ${kind} observer watches ${el.id || el.tagName}`).toBeGreaterThan(0);
  act(() => {
    for (const o of watching) {
      o.cb([{ isIntersecting, target: el } as IntersectionObserverEntry], o.self);
    }
  });
}

const byId = (id: string) => document.getElementById(id)!;
const centre = (id: string, on = true) => report("centre", byId(id), on);
const serviceTopic = () => document.querySelector('[data-guide-topic="service"]')!;

/* ---- rendering ----------------------------------------------------------------------------- */

/** Opens the request flow from outside the guide, as any other CTA would. */
function OtherCta() {
  const { openRequest } = useRequestFlow();
  return (
    <button type="button" onClick={() => openRequest({ source: "hero" })}>
      Alt CTA
    </button>
  );
}

type PageOptions = { sectionFlow?: boolean; frontCard?: number | null; nested?: boolean };

/**
 * The topics a page can carry, a text field, another CTA, and (optionally) the home page's
 * section-layout flow. `nested` puts the service topic inside `#servicii`.
 */
function Page({ sectionFlow = false, frontCard = null, nested = false }: PageOptions) {
  const service = <div data-guide-topic="service">pași</div>;
  return (
    <main>
      <section id="servicii">servicii{nested ? service : null}</section>
      <section id="lucrari">
        {defaultSiteData.projects.slice(0, 3).map((p, i) => (
          <article key={p.id} data-helix-front={frontCard === i ? "" : undefined}>
            {p.name}
          </article>
        ))}
      </section>
      {nested ? null : service}
      <input aria-label="Câmp de test" />
      <OtherCta />
      {sectionFlow ? <div data-testid="request-flow" data-layout="section" /> : null}
    </main>
  );
}

function renderGuide(options: PageOptions = {}) {
  const tree = (extra?: ReactNode) => (
    <SiteContentProvider>
      <RequestFlowProvider>
        <Page {...options} />
        {extra}
        <GuideAssistant />
      </RequestFlowProvider>
    </SiteContentProvider>
  );
  const utils = render(tree());
  return { ...utils, rerenderGuide: () => utils.rerender(tree()) };
}

const guideRoot = () => document.querySelector<HTMLElement>("[data-guide]");
const avatar = () => screen.getByTestId("guide-avatar");
const tip = () => screen.queryByTestId("guide-tip");

const fakeTimers = () =>
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"],
  });
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const answerConsent = () => localStorage.setItem(CONSENT_KEY, "rejected");

/** Covers taken by a test; `afterEach` lets go of any still held, so a failure cannot leak one. */
const covers: Array<() => void> = [];
function cover(): () => void {
  let release = () => {};
  act(() => {
    release = coverPage();
  });
  covers.push(release);
  return () => act(() => release());
}

/** Show the `servicii` tip the way a visitor gets it: 5 s on the centre line. */
function lingerOnServicii() {
  centre("servicii");
  advance(5000);
  expect(tip()).not.toBeNull();
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", ControlledObserver);
  // The dialog's body lock restores the scroll position; jsdom only logs "not implemented".
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  localStorage.clear();
  document.cookie = `${CONSENT_KEY}=;path=/;max-age=0`;
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  resetIntroForTests();
  resetGuideMemoryForTests();
  resetHudBusyForTests();
  h.pathname = "/";
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  vi.mocked(api.submitContact).mockResolvedValue(undefined);
});

afterEach(() => {
  for (const release of covers.splice(0)) release();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "visibilityState");
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  localStorage.clear();
});

/* ---- 1. when it renders ------------------------------------------------------------------ */

describe("when the guide renders", () => {
  it("renders nothing on the server", () => {
    answerConsent();
    expect(renderToString(<GuideAssistant />)).toBe("");
  });

  it("renders nothing while the cookie question is open, and appears once it is answered", () => {
    renderGuide();
    expect(guideRoot()).toBeNull();

    act(() => setConsent("accepted"));
    expect(guideRoot()).not.toBeNull();
    expect(avatar()).toBeInTheDocument();
  });

  it("renders nothing while the intro overlay is on screen, and appears once it is gone", () => {
    answerConsent();
    const overlay = document.createElement("div");
    overlay.id = INTRO_OVERLAY_ID;
    document.body.appendChild(overlay);

    renderGuide();
    expect(guideRoot()).toBeNull();

    overlay.remove();
    act(() => markIntroGone());
    expect(guideRoot()).not.toBeNull();
  });
});

/* ---- 2. markup ------------------------------------------------------------------------------- */

describe("markup", () => {
  beforeEach(answerConsent);

  it("is a real button that opens a dialog, named from its visible caption", () => {
    renderGuide();
    const button = screen.getByRole("button", { name: /^Ghid TBS/ });

    expect(button).toBe(avatar());
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    expect(button).toHaveAccessibleName(ro(GUIDE_COPY.aria));
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("draws the droid as decoration: six faces, a visor bar, two orbits with packets, a signal", () => {
    renderGuide();
    const scene = avatar().querySelector('[aria-hidden="true"]')!;
    expect(scene).not.toBeNull();
    expect(scene.querySelectorAll("[data-face]")).toHaveLength(6);
    expect(
      [...scene.querySelectorAll("[data-face]")].map((f) => f.getAttribute("data-face")).sort(),
    ).toEqual(["back", "bottom", "front", "left", "right", "top"]);
    expect(scene.querySelector('[data-face="front"]')!.children).toHaveLength(1);
    expect(scene.querySelectorAll("[data-orbit]")).toHaveLength(2);
    for (const orbit of scene.querySelectorAll("[data-orbit]")) {
      expect(orbit.children).toHaveLength(1);
    }
    // The caption is visible text, hidden from the accessibility tree (the label says it).
    const caption = [...avatar().children].find((el) => el !== scene)!;
    expect(caption).toHaveAttribute("aria-hidden", "true");
    expect(caption).toHaveTextContent(ro(GUIDE_COPY.label));
  });

  it("carries the HUD root attributes and no dialog, header, heading or live region", () => {
    fakeTimers();
    renderGuide();
    const root = guideRoot()!;

    expect(root).toHaveAttribute("data-hud", "");
    expect(root).toHaveAttribute("data-state", "enter");
    expect(root).not.toHaveAttribute("data-away");
    expect(root).not.toHaveAttribute("data-yield");
    advance(699);
    expect(root).toHaveAttribute("data-state", "enter");
    advance(1);
    expect(root).toHaveAttribute("data-state", "idle");

    lingerOnServicii();
    expect(root).toHaveAttribute("data-state", "prompt");
    for (const selector of ["[role]", "header", "h1, h2, h3, h4, h5, h6", "[aria-live]"]) {
      expect(root.querySelector(selector), selector).toBeNull();
    }
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("puts the tip after the button, and describes the button with the tip's sentence", () => {
    fakeTimers();
    renderGuide();
    lingerOnServicii();

    const bubble = tip()!;
    const children = [...guideRoot()!.children];
    expect(children).toEqual([avatar(), bubble]);

    const describedBy = avatar().getAttribute("aria-describedby")!;
    const sentence = document.getElementById(describedBy)!;
    expect(bubble.contains(sentence)).toBe(true);
    expect(sentence).toHaveTextContent(ro(GUIDE_COPY.prompts.servicii));
    expect(avatar()).toHaveAccessibleDescription(ro(GUIDE_COPY.prompts.servicii));

    const t = within(bubble);
    expect(bubble.querySelector('[aria-hidden="true"]')).toHaveTextContent(ro(GUIDE_COPY.label));
    expect(t.getByRole("button", { name: ro(GUIDE_COPY.open) })).toHaveAttribute("type", "button");
    expect(t.getByRole("button", { name: ro(GUIDE_COPY.never) })).toHaveAttribute("type", "button");
    const close = t.getByRole("button", { name: ro(GUIDE_COPY.dismiss) });
    expect(close.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(close.querySelector("svg")).toHaveAttribute("stroke-width", "1.75");
  });

  it("never says AI in any language", () => {
    const strings = [
      GUIDE_COPY.label,
      GUIDE_COPY.aria,
      GUIDE_COPY.open,
      GUIDE_COPY.never,
      GUIDE_COPY.dismiss,
      ...Object.values(GUIDE_COPY.prompts),
    ].flatMap((text) => [text.ro, text.ru, text.en]);
    // `\b` does not see Cyrillic letters, so word edges are spelled out with \p{L}.
    for (const text of strings) expect(text).not.toMatch(/(?<!\p{L})(?:AI|IA|ИИ)(?!\p{L})/u);
  });
});

/* ---- 3. the linger engine ------------------------------------------------------------------ */

describe("linger: 5 s of visible time on the centre line", () => {
  beforeEach(() => {
    answerConsent();
    fakeTimers();
  });

  it("shows the tip at 5,000 ms and not a millisecond before, without moving focus", () => {
    renderGuide();
    centre("servicii");

    advance(4999);
    expect(tip()).toBeNull();
    advance(1);
    expect(tip()).not.toBeNull();
    expect(tip()).toHaveTextContent(ro(GUIDE_COPY.prompts.servicii));
    expect(document.activeElement).toBe(document.body);
  });

  it("restarts the count when the centre topic changes", () => {
    renderGuide();
    centre("servicii");
    advance(4000);
    centre("servicii", false);
    centre("lucrari");
    advance(4000);
    expect(tip()).toBeNull();
    advance(1000);
    expect(tip()).toHaveTextContent(ro(GUIDE_COPY.prompts.lucrari));
  });

  it("prefers the deepest topic when two cross the centre line", () => {
    renderGuide({ nested: true });
    centre("servicii");
    report("centre", serviceTopic(), true);
    advance(5000);
    expect(tip()).toHaveTextContent(ro(GUIDE_COPY.prompts.service));
  });

  it("a dismissed topic never comes back: dismiss, leave, re-enter, 10 s", () => {
    renderGuide();
    lingerOnServicii();
    fireEvent.click(within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.dismiss) }));
    expect(tip()).toBeNull();

    centre("servicii", false);
    advance(1000);
    centre("servicii");
    advance(10_000);
    expect(tip()).toBeNull();
  });

  it("waits out the 60 s cooldown for the second topic, and never shows a third", () => {
    renderGuide();
    lingerOnServicii(); // shown at 5,000
    fireEvent.click(within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.dismiss) }));

    centre("servicii", false);
    centre("lucrari");
    advance(59_999); // 64,999: 59,999 after the first tip
    expect(tip()).toBeNull();
    advance(1); // 65,000: exactly 60 s after it
    expect(tip()).toHaveTextContent(ro(GUIDE_COPY.prompts.lucrari));

    fireEvent.click(within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.dismiss) }));
    centre("lucrari", false);
    report("centre", serviceTopic(), true);
    advance(180_000);
    expect(tip()).toBeNull();
  });

  it("clears the tip when its section leaves the centre line", () => {
    renderGuide();
    lingerOnServicii();
    centre("servicii", false);
    expect(tip()).toBeNull();
    expect(guideRoot()).toHaveAttribute("data-state", "idle");
  });

  it("clears the tip on a client navigation", () => {
    const { rerenderGuide } = renderGuide();
    lingerOnServicii();
    h.pathname = "/servicii/e-commerce";
    rerenderGuide();
    expect(tip()).toBeNull();
  });

  it("'Nu mai arăta în această vizită' ends the tips for the page's lifetime", () => {
    renderGuide();
    lingerOnServicii();
    fireEvent.click(within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.never) }));
    expect(tip()).toBeNull();

    centre("servicii", false);
    centre("lucrari");
    advance(120_000);
    expect(tip()).toBeNull();
  });
});

describe("linger: blockers hold the tip back, and the wait goes on", () => {
  beforeEach(() => {
    answerConsent();
    fakeTimers();
  });

  it("not while the visitor types; it comes at the next try once they stop", () => {
    renderGuide();
    const field = screen.getByRole("textbox", { name: "Câmp de test" });
    act(() => field.focus());
    centre("servicii");
    advance(5000);
    expect(tip()).toBeNull();

    act(() => field.blur());
    advance(5000);
    expect(tip()).not.toBeNull();
  });

  it("not while the page is covered (coverPage)", () => {
    renderGuide();
    const release = cover();
    centre("servicii");
    advance(5000);
    expect(tip()).toBeNull();

    release();
    advance(5000);
    expect(tip()).not.toBeNull();
  });

  it("not while the request flow is already open", () => {
    renderGuide();
    fireEvent.click(screen.getByRole("button", { name: "Alt CTA" }));
    expect(screen.getByRole("dialog", { name: DIALOG_TITLE })).toBeInTheDocument();

    centre("servicii");
    advance(5000);
    expect(tip()).toBeNull();
  });

  it("not while the visitor is busy with the HUD (setHudBusy)", () => {
    renderGuide();
    act(() => setHudBusy("os-window", true));
    centre("servicii");
    advance(5000);
    expect(tip()).toBeNull();

    act(() => setHudBusy("os-window", false));
    advance(5000);
    expect(tip()).not.toBeNull();
  });

  it("not while the guide is away", () => {
    renderGuide({ sectionFlow: true });
    report("away", screen.getByTestId("request-flow"), true);
    centre("servicii");
    advance(5000);
    expect(tip()).toBeNull();
  });

  it("clears a shown tip when the page becomes covered", () => {
    renderGuide();
    lingerOnServicii();
    cover();
    expect(tip()).toBeNull();
  });
});

/* ---- 4. keyboard, away, yield ------------------------------------------------------------------ */

describe("keyboard", () => {
  beforeEach(() => {
    answerConsent();
    fakeTimers();
  });

  it("Escape inside the tip removes it and puts focus on the avatar", () => {
    renderGuide();
    lingerOnServicii();
    const openButton = within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.open) });
    act(() => openButton.focus());

    fireEvent.keyDown(openButton, { key: "Escape", repeat: true });
    expect(tip(), "a held key does not dismiss").not.toBeNull();

    fireEvent.keyDown(openButton, { key: "Escape" });
    expect(tip()).toBeNull();
    expect(document.activeElement).toBe(avatar());
  });

  it("Escape on the avatar removes the tip and leaves focus where it is", () => {
    renderGuide();
    lingerOnServicii();
    act(() => avatar().focus());
    fireEvent.keyDown(avatar(), { key: "Escape" });
    expect(tip()).toBeNull();
    expect(document.activeElement).toBe(avatar());
  });

  it("the ✕ hands focus from the tip back to the avatar", () => {
    renderGuide();
    lingerOnServicii();
    const close = within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.dismiss) });
    act(() => close.focus());
    fireEvent.click(close);
    expect(tip()).toBeNull();
    expect(document.activeElement).toBe(avatar());
  });
});

describe("away and yield", () => {
  beforeEach(() => {
    answerConsent();
    fakeTimers();
  });

  it("away over the section-layout request form: every guide button leaves the tab order", () => {
    renderGuide({ sectionFlow: true });
    lingerOnServicii();
    const buttons = () => [avatar(), ...within(tip()!).getAllByRole("button")];
    for (const button of buttons()) expect(button.tabIndex).toBe(0);

    report("away", screen.getByTestId("request-flow"), true);
    expect(guideRoot()).toHaveAttribute("data-away", "");
    expect(buttons()).toHaveLength(4);
    for (const button of buttons()) {
      expect(button.tabIndex).toBe(-1);
      expect(button).toBeInTheDocument();
    }
    // Still focusable from script, so the dialog can hand focus back.
    act(() => avatar().focus());
    expect(document.activeElement).toBe(avatar());

    report("away", screen.getByTestId("request-flow"), false);
    expect(guideRoot()).not.toHaveAttribute("data-away");
    expect(avatar().tabIndex).toBe(0);
  });

  it("yields while focus sits under the avatar, and comes back when it moves on", () => {
    renderGuide();
    vi.spyOn(avatar(), "getBoundingClientRect").mockReturnValue(rect(1172, 692, 88, 88));
    const field = screen.getByRole("textbox", { name: "Câmp de test" });
    const other = screen.getByRole("button", { name: "Alt CTA" });
    vi.spyOn(field, "getBoundingClientRect").mockReturnValue(rect(1100, 740, 200, 40));
    vi.spyOn(other, "getBoundingClientRect").mockReturnValue(rect(40, 40, 120, 44));

    act(() => field.focus());
    expect(guideRoot()).toHaveAttribute("data-yield", "");

    act(() => other.focus());
    expect(guideRoot()).not.toHaveAttribute("data-yield");

    act(() => field.focus());
    expect(guideRoot()).toHaveAttribute("data-yield", "");
    act(() => avatar().focus());
    expect(guideRoot()).not.toHaveAttribute("data-yield");
  });

  it("focus landing under the tip clears it", () => {
    renderGuide();
    lingerOnServicii();
    vi.spyOn(tip()!, "getBoundingClientRect").mockReturnValue(rect(900, 400, 320, 240));
    const other = screen.getByRole("button", { name: "Alt CTA" });
    vi.spyOn(other, "getBoundingClientRect").mockReturnValue(rect(1000, 500, 120, 44));

    act(() => other.focus());
    expect(tip()).toBeNull();
    expect(guideRoot()).toHaveAttribute("data-yield", "");
  });
});

/* ---- 5. opening the flow ------------------------------------------------------------------------ */

async function toContactStep(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(
    within(within(dialog).getByTestId("request-steps")).getByRole("button", { name: /Datele tale/ }),
  );
}

async function sendFrom(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await toContactStep(user, dialog);
  await user.type(within(dialog).getByPlaceholderText(NAME_PH), "Ion Popescu");
  await user.type(within(dialog).getByPlaceholderText(EMAIL_PH), "ion@example.com");
  await user.click(within(dialog).getByRole("button", { name: /Trimite cererea/ }));
}

function sentMessage(): string {
  expect(api.submitContact).toHaveBeenCalledTimes(1);
  return vi.mocked(api.submitContact).mock.calls[0][0].message ?? "";
}

describe("opening the request flow", () => {
  beforeEach(answerConsent);

  it("the avatar opens the dialog on the guided chat, and focus comes back to it on close", async () => {
    const user = userEvent.setup();
    renderGuide();

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("chat-panel");
    expect(within(dialog).getByTestId("chat-toggle")).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(avatar());
  });

  it("sends source `guide` and the centre section", async () => {
    const user = userEvent.setup();
    renderGuide({ frontCard: 1 });
    centre("servicii");

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Secțiune: servicii");
    expect(message).toContain("- Sursă (CTA): guide");
    // A front card is only the visitor's context while they are on the projects.
    expect(message).not.toContain("- Proiect:");
    expect(message).not.toContain("- Serviciu:");
  });

  it("the tip's button sends source `guide-prompt` and the tip's topic", async () => {
    fakeTimers();
    renderGuide();
    lingerOnServicii();
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(within(tip()!).getByRole("button", { name: ro(GUIDE_COPY.open) }));
    expect(tip()).toBeNull();
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("chat-panel");
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Secțiune: servicii\n- Sursă (CTA): guide-prompt");
  });

  it("names the front project of the spiral while the visitor is on the projects", async () => {
    const user = userEvent.setup();
    renderGuide({ frontCard: 1 });
    centre("lucrari");

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    const project = defaultSiteData.projects[1];
    const message = sentMessage();
    expect(message).toContain(`- Proiect: ${project.name} (${project.id})`);
    expect(message).toContain("- Secțiune: lucrari");
  });

  it("sends no project when no card is at the front", async () => {
    const user = userEvent.setup();
    renderGuide({ frontCard: null });
    centre("lucrari");

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    expect(sentMessage()).not.toContain("- Proiect:");
  });

  it("names a known service from a prefixed service-page path", async () => {
    h.pathname = "/ru/servicii/e-commerce";
    const user = userEvent.setup();
    renderGuide();
    report("centre", serviceTopic(), true);

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Serviciu: e-commerce");
    expect(message).toContain("- Secțiune: service");
    expect(message).toContain("- Sursă (CTA): guide");
  });

  it("sends no service for a slug the directions do not know", async () => {
    h.pathname = "/servicii/nu-exista";
    const user = userEvent.setup();
    renderGuide();

    await user.click(avatar());
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).not.toContain("- Serviciu:");
    expect(message).not.toContain("- Secțiune:");
    expect(message).toContain("- Sursă (CTA): guide");
  });
});

/* ---- 6. the module CSS ------------------------------------------------------------------------- */

describe("GuideAssistant.module.css", () => {
  const css = read("components/hud/guide/GuideAssistant.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
  /** The component's code, without its comments (which explain why `inert` is never used). */
  const tsx = read("components/hud/guide/GuideAssistant.tsx").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  /** `selector { body }` for every innermost rule. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
  const rule = (selector: string) => rules.find((r) => r.selector === selector)?.body ?? "";

  it("stacks on --z-guide, with no blur and no filter anywhere", () => {
    expect(rule(".root")).toMatch(/z-index:\s*var\(--z-guide\)/);
    expect(css).not.toMatch(/backdrop-filter|(?:^|[;\s{])filter\s*:|blur\(/);
  });

  it("away and yield fade without leaving the DOM or the accessibility tree", () => {
    const hide = rule(".root[data-away] > *,\n.root[data-yield] > *");
    expect(hide).toMatch(/opacity:\s*0/);
    expect(hide).toMatch(/pointer-events:\s*none/);
    expect(css).not.toMatch(/visibility:\s*hidden/);
    expect(tsx).not.toMatch(/\binert\b/);
    // The only display:none is the caption on phones (it is aria-hidden text).
    const hidden = rules.filter((r) => /display:\s*none/.test(r.body)).map((r) => r.selector);
    expect(hidden).toEqual([".caption"]);
  });

  it("keyframes move only transform and opacity, and all motion is behind no-preference", () => {
    const frames = [...css.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)];
    expect(frames.length).toBeGreaterThanOrEqual(6);
    for (const frame of frames) {
      for (const decl of frame[1].matchAll(/([\w-]+)\s*:/g)) {
        expect(["transform", "opacity"], frame[0].slice(0, 40)).toContain(decl[1]);
      }
    }
    const withoutMotionBlocks = css
      .replace(/@keyframes[\s\S]*?\}\s*\}/g, "")
      .replace(/@media \(prefers-reduced-motion: no-preference\)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(withoutMotionBlocks).not.toMatch(/(?:^|[;\s{])(?:animation|transition)(?:-[\w-]+)?\s*:/);
  });

  it("paints the avatar and the tip opaque: solid glass over --bg, so no page text ghosts through", () => {
    for (const selector of [".avatar", ".tip"]) {
      const body = rule(selector);
      expect(body, selector).toMatch(/background-color:\s*var\(--bg\)/);
      expect(body, selector).toMatch(
        /background-image:\s*linear-gradient\(var\(--glass-bg-solid\),\s*var\(--glass-bg-solid\)\)/,
      );
      expect(body, selector).not.toMatch(/(?:^|[;\s])background:/);
    }
  });

  it("gives every tip button a 44px target, and the red CTA fill to 'Deschide ghidul' only", () => {
    expect(rule(".tipOpen,\n.tipNever")).toMatch(/min-height:\s*44px/);
    expect(rule(".tipClose")).toMatch(/width:\s*44px/);
    expect(rule(".tipClose")).toMatch(/height:\s*44px/);
    const red = rules.filter((r) => /--grad-red-cta/.test(r.body)).map((r) => r.selector);
    expect(red).toEqual([".tipOpen"]);
    expect(rule(".tipKicker")).toMatch(/color:\s*var\(--cyan-text\)/);
  });

  it("draws no round dot: a 50% or pill radius only on boxes larger than 8px", () => {
    for (const r of rules) {
      if (!/border-radius:\s*(?:50%|var\(--r-pill\))/.test(r.body)) continue;
      const sizes = [...r.body.matchAll(/(?:^|[;\s])(?:width|height|inline-size|block-size):\s*([\d.]+)px/g)];
      for (const size of sizes) expect(Number(size[1]), r.selector).toBeGreaterThan(8);
    }
    // The rings are sized by --orbit-a / --orbit-b: every value of those is at least 38px.
    for (const m of css.matchAll(/--orbit-[ab]:\s*([\d.]+)px/g)) {
      expect(Number(m[1])).toBeGreaterThanOrEqual(38);
    }
  });
});
