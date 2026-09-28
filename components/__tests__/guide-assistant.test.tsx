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
import { act, render, screen, waitFor, within } from "@testing-library/react";
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
import { GUIDE_COPY, GUIDE_FAQ } from "@/components/hud/guide/copy";
import { CONSENT_KEY, setConsent } from "@/lib/consent";
import { resetHudBusyForTests } from "@/lib/hud/busy";
import { INTRO_OVERLAY_ID, markIntroGone, resetIntroForTests } from "@/lib/intro";
import { RequestFlowProvider, useRequestFlow } from "@/lib/request/RequestFlowProvider";
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
const faqPanel = () => screen.queryByTestId("guide-faq");

/**
 * The request flow is TWO presses from the corner now, and that is the change these tests are
 * here to pin. Pressing her opens her questions; "Deschide ghidul" inside them opens the guided
 * request. The old one-press path is gone, and the avatar's accessible name says so.
 */
const openRequestFromGuide = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(avatar());
  await user.click(within(faqPanel()!).getByRole("button", { name: ro(GUIDE_COPY.open) }));
};

const fakeTimers = () =>
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"],
  });

const answerConsent = () => localStorage.setItem(CONSENT_KEY, "rejected");

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

  it("is a real button that discloses her questions, named from its visible caption", () => {
    renderGuide();
    const button = screen.getByRole("button", { name: /^Asistent TBS/ });

    expect(button).toBe(avatar());
    expect(button.tagName).toBe("BUTTON");
    expect(button).toHaveAttribute("type", "button");
    /* It is a DISCLOSURE now, not a dialog opener: pressing her expands her questions in place,
       and the guided request is a second press from inside them. `aria-haspopup="dialog"` would
       be a promise the control no longer keeps, and so would the old accessible name. */
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAccessibleName(ro(GUIDE_COPY.aria));
    expect(ro(GUIDE_COPY.aria)).toMatch(/întrebăril/i);
    expect(button).not.toHaveAttribute("aria-describedby");
  });

  it("presses open into her questions, and every answer is one press from a question", async () => {
    const user = userEvent.setup();
    renderGuide();

    expect(faqPanel()).toBeNull();
    await user.click(avatar());
    expect(faqPanel()).not.toBeNull();
    expect(avatar()).toHaveAttribute("aria-expanded", "true");

    /* Every scripted question is offered, each as its own control on its own line. */
    const asked = within(faqPanel()!).getAllByRole("button");
    for (const entry of GUIDE_FAQ) {
      expect(within(faqPanel()!).getByRole("button", { name: ro(entry.q) })).toBeInTheDocument();
    }
    expect(asked.length).toBeGreaterThanOrEqual(GUIDE_FAQ.length);

    /* Asking replaces the intro with that answer and takes the question off the list, so the
       same one cannot be asked twice in a row. */
    const first = GUIDE_FAQ[0];
    await user.click(within(faqPanel()!).getByRole("button", { name: ro(first.q) }));
    expect(faqPanel()).toHaveTextContent(ro(first.a));
    expect(within(faqPanel()!).queryByRole("button", { name: ro(first.q) })).toBeNull();

    /* Pressing her again puts them away. */
    await user.click(avatar());
    expect(faqPanel()).toBeNull();
    expect(avatar()).toHaveAttribute("aria-expanded", "false");
  });

  it("says NOTHING on her own, and her mouth only moves while she has an answer to read", () => {
    /* Plain `.click()` inside `act`, not `userEvent`: this test fakes the clock, and
       userEvent's own waiting never resolves against a clock nobody advances. A press is a
       press either way. */
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    const press = (el: HTMLElement) => act(() => el.click());
    renderGuide();
    const root = () => document.querySelector("[data-guide]")!;

    /* Ten seconds in: no bubble, and her mouth is shut. This is the greeting the owner asked
       to be rid of, and it is the thing that must not come back. */
    act(() => vi.advanceTimersByTime(10_000));
    expect(faqPanel()).toBeNull();
    expect(root()).not.toHaveAttribute("data-say");

    /* She speaks when she is asked, and stops on her own seven seconds later — while the
       answer she was reading stays on screen. */
    press(avatar());
    press(within(faqPanel()!).getByRole("button", { name: ro(GUIDE_FAQ[0].q) }));
    expect(root()).toHaveAttribute("data-say");

    act(() => vi.advanceTimersByTime(7001));
    expect(root()).not.toHaveAttribute("data-say");
    expect(faqPanel()).toHaveTextContent(ro(GUIDE_FAQ[0].a));
  });

  it("draws the assistant as decoration: a portrait, two eyelids, two orbits with packets, a signal", () => {
    renderGuide();
    const scene = avatar().querySelector('[aria-hidden="true"]')!;
    expect(scene).not.toBeNull();

    // The portrait is the person, and it is DECORATION: the button's own label names the control.
    const portrait = scene.querySelector("img")!;
    expect(portrait).not.toBeNull();
    expect(portrait).toHaveAttribute("alt", "");
    expect(portrait.getAttribute("src")).toMatch(/^\/guide\/asistent-\d+\.webp$/);
    // Intrinsic size on the tag, so nothing reflows when it decodes.
    expect(portrait).toHaveAttribute("width");
    expect(portrait).toHaveAttribute("height");
    /* ONE ENCODING, and the test guards it. There was an AVIF <source> ahead of the WebP and it
       had to go: every CSS window onto this portrait — the eyelids, the jaw, the rim's mask, the
       scanline mask — loads the WebP by URL, and a patch that must colour-match the pixels under
       it draws a hard edge wherever two lossy encodings of the same bitmap disagree. */
    expect(scene.querySelector("picture")).toBeNull();
    expect(portrait.getAttribute("srcset") ?? "").not.toMatch(/\.avif/);

    // One eyelid per eye, each one placed by its own custom properties rather than by a rule.
    const lids = [...scene.querySelectorAll("[data-eye]")];
    expect(lids.map((l) => l.getAttribute("data-eye")).sort()).toEqual(["left", "right"]);

    expect(scene.querySelectorAll("[data-orbit]")).toHaveLength(2);
    for (const orbit of scene.querySelectorAll("[data-orbit]")) {
      expect(orbit.children).toHaveLength(1);
    }
    // The caption is visible text, hidden from the accessibility tree (the label says it).
    const caption = [...avatar().children].find((el) => el !== scene)!;
    expect(caption).toHaveAttribute("aria-hidden", "true");
    expect(caption).toHaveTextContent(ro(GUIDE_COPY.label));
  });

  it("is the square and nothing else: no second copy of her, at any point", () => {
    /* She used to build herself out of a projector at three times this box, hanging over the
       corner, for 3.4s. The owner asked twice for that to go (2026-09-26), so what is pinned
       here is the absence: ONE drawing of her, inside the button, from the first frame to well
       past where the entrance used to end. rAF is faked too, because that is what the entrance
       used to wait on. */
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "performance", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    renderGuide();
    const root = () => document.querySelector("[data-guide]")!;
    const portraits = () => root().querySelectorAll("img");

    for (const ms of [0, 34, 3400, 10_000]) {
      act(() => vi.advanceTimersByTime(ms));
      expect(portraits(), `one of her at ${ms}ms`).toHaveLength(1);
      expect(avatar().contains(portraits()[0]!), `inside the button at ${ms}ms`).toBe(true);
    }
    expect(root()).not.toHaveAttribute("data-greet");
    expect(root()).not.toHaveAttribute("data-state");
  });

  it("never says AI in any language", () => {
    const strings = [
      GUIDE_COPY.label,
      GUIDE_COPY.aria,
      GUIDE_COPY.open,
      GUIDE_COPY.faqHead,
      GUIDE_COPY.faqIntro,
    ].flatMap((text) => [text.ro, text.ru, text.en]);
    // `\b` does not see Cyrillic letters, so word edges are spelled out with \p{L}.
    for (const text of strings) expect(text).not.toMatch(/(?<!\p{L})(?:AI|IA|ИИ)(?!\p{L})/u);
  });
});

/* ---- 3. the linger engine ------------------------------------------------------------------ */

describe("away and yield", () => {
  beforeEach(() => {
    answerConsent();
    fakeTimers();
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

});

/* ---- 5. opening the flow ------------------------------------------------------------------------ */

/* The dialog is the deck now, so the contact fields are on screen from the first frame —
   there is no step to walk to (2026-09-26). */
async function sendFrom(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
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

    await openRequestFromGuide(user);
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    /* `openAssistant` no longer opens a panel — the deck's assistant is always on screen — so
       what the guide's promise means now is that focus lands inside it.

       Wait for the deck FIRST, and give it room. The dialog loads the whole estimator now,
       which is a heavier dynamic import than the wizard it replaced, and THIS is the first spec
       in the file to open it, so it is the one that pays for the chunk. On its own that takes
       329ms; with the full suite running 76 files at once it goes past the default 1s and the
       spec fails for a reason that has nothing to do with what it asserts. */
    await within(dialog).findByTestId("request-flow", undefined, { timeout: 5000 });
    const panel = await within(dialog).findByTestId("chat-panel");
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(avatar());
  });

  it("names a known service from a prefixed service-page path", async () => {
    h.pathname = "/ru/servicii/e-commerce";
    const user = userEvent.setup();
    renderGuide();

    await openRequestFromGuide(user);
    const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });
    await within(dialog).findByTestId("request-flow");
    await sendFrom(user, dialog);

    const message = sentMessage();
    expect(message).toContain("- Serviciu: e-commerce");
    expect(message).toContain("- Sursă (CTA): guide");
  });

  it("sends no service for a slug the directions do not know", async () => {
    h.pathname = "/servicii/nu-exista";
    const user = userEvent.setup();
    renderGuide();

    await openRequestFromGuide(user);
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

  it("keyframes move only transform and opacity — except the two lips, which may not be transformed", () => {
    /* The two PHOTOGRAPHIC patches are the exception, and it is not a concession to convenience.
       They are windows onto her own portrait laid over the picture they came from, and a
       `transform` puts them on their own compositing layer, which rasterises the background image
       against the device grid about half a pixel out of step with the inline paint. Measured row
       by row at device pixels, that is up to 47 luminance units appearing on her upper lip the
       instant she starts to speak — the cut. So those two move by paint instead: the photograph
       slides (`background-position-y`) and its window follows (`mask-position`). Everything else
       here is a gradient with nothing to register against, and stays on transform. */
    const PICTATE = new Set(["guide-jaw", "guide-upper-lip"]);
    const PAINT = ["background-position-y", "mask-position", "-webkit-mask-position"];
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)];
    expect(frames.length).toBeGreaterThanOrEqual(6);
    for (const frame of frames) {
      const allowed = PICTATE.has(frame[1]) ? PAINT : ["transform", "opacity"];
      for (const decl of frame[2].matchAll(/([\w-]+)\s*:/g)) {
        expect(allowed, frame[1]).toContain(decl[1]);
      }
    }
    // And the lips are never transformed anywhere else either, which is the whole point.
    for (const sel of [".jaw", ".upperLip"]) {
      expect(rule(sel), sel).not.toMatch(/(?:^|[;\s{])transform\s*:/);
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

  it("gives every bubble button a 44px target, and the red CTA fill to one control only", () => {
    /* `.tipNever` — the tip's "Nu mai arăta" — was named here beside `.tipOpen` and outlived
       the guide as dead CSS, so this assertion was reading a rule nothing rendered. */
    expect(rule(".tipOpen")).toMatch(/min-height:\s*44px/);
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
