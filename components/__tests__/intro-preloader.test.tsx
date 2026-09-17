import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import gsap from "gsap";
import type { IntroCapability } from "@/components/intro/capability";
import type { IntroDirectorProps } from "@/components/intro/IntroDirector";
import { IntroPreloader } from "@/components/intro/IntroPreloader";
import { messages } from "@/lib/i18n/messages";
import {
  INTRO_COOKIE,
  INTRO_EVENT,
  INTRO_GONE_EVENT,
  INTRO_OVERLAY_ID,
  INTRO_TIMING,
  isIntroOnScreen,
  readIntroSeen,
  resetIntroForTests,
  type IntroDoneDetail,
} from "@/lib/intro";

/*
 * The intro shell + director, in jsdom — which is exactly the device the intro must handle
 * without any special casing: no ResizeObserver (so the capability probe answers "no WebGL"
 * before touching a canvas), no getAnimations (failsafe clock 0), no WebGL. The director
 * really loads (next/dynamic) and really runs GSAP on the SVG fallback path.
 */

const ro = messages.ro;

// If anything ever reached for the 3D scene here, `sceneImported` would flip — once per file:
// the factory runs on the module's first import only (see the WebGL describe at the end).
// `director` swaps the real director for one that never reveals, or one that throws.
// `capability` overrides the device probe's answer; `probes` counts the probe's calls and
// `directorCapability` is what the director was handed.
const probe = vi.hoisted(() => ({
  sceneImported: false,
  sceneModuleCached: false,
  director: "real" as "real" | "idle" | "throw",
  capability: null as IntroCapability | null,
  probes: 0,
  probed: null as IntroCapability | null,
  directorCapability: null as IntroCapability | null,
}));
vi.mock("@/components/intro/IntroScene", () => {
  probe.sceneImported = true;
  return { IntroScene: () => null };
});
/* The intro's scene is reached through the shared 3D runtime (components/three/runtime.tsx),
   which also re-exports the interior stage's canvas: keep that one from evaluating three.js
   and the scene world in jsdom. */
vi.mock("@/components/scene/SceneCanvas", () => ({ SceneCanvas: () => null }));
vi.mock("@/components/intro/capability", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/intro/capability")>();
  return {
    ...real,
    probeIntroCapability: () => {
      probe.probes += 1;
      probe.probed = probe.capability ?? real.probeIntroCapability();
      return probe.probed;
    },
  };
});
vi.mock("@/components/intro/IntroDirector", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/components/intro/IntroDirector")>();
  const { createElement } = await import("react");
  function IntroDirector(props: IntroDirectorProps) {
    probe.directorCapability = props.capability;
    if (probe.director === "throw") throw new Error("director chunk failed");
    if (probe.director === "idle") return null;
    return createElement(real.IntroDirector, props);
  }
  return { ...real, IntroDirector };
});

type GetContext = HTMLCanvasElement["getContext"];

const realMatchMedia = window.matchMedia;

function mockReducedMotion() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function listenForDone() {
  const detail = vi.fn<(detail: IntroDoneDetail) => void>();
  const listener = (event: Event) => detail((event as CustomEvent<IntroDoneDetail>).detail);
  window.addEventListener(INTRO_EVENT, listener);
  return { detail, stop: () => window.removeEventListener(INTRO_EVENT, listener) };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Record every inline style <html> goes through, to prove a lock never happened. */
function watchRootStyle() {
  const seen: string[] = [];
  const observer = new MutationObserver(() => seen.push(document.documentElement.style.overflow));
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  return { seen, stop: () => observer.disconnect() };
}

/** A fake CSS failsafe animation on every element, at `currentTime` ms. */
function fakeFailsafeClock(currentTime: number) {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [
      {
        animationName: "IntroPreloader-module__x__introFailsafe",
        currentTime,
        effect: { getTiming: () => ({ delay: INTRO_TIMING.FAILSAFE_MS }) },
      },
    ],
  });
}

/*
 * Module-load latency is NOT what these tests measure. The shell loads the director through
 * next/dynamic, so whichever test mounted it first used to pay for transforming the director,
 * GSAP and @gsap/react inside its own `waitFor` (~1s on a quiet 34-file run, several seconds
 * when other containers compete for the CPU) — and that first test was the one that flaked
 * under full-suite load. `beforeAll` pays that cost up front, through the same mocked module
 * specifier the shell imports, so every test's wait only covers behaviour.
 */
beforeAll(async () => {
  await import("@/components/intro/IntroDirector");
}, 60_000);

/* What is left to wait for is real time: GSAP runs on the wall clock (lag smoothing off), so
   a skipped burst takes ~0.95s (2.22s of timeline at 2.4x) however fast the machine is. The
   margin covers a worker that is starved of frames, not a slow import. */
const SLOW = { timeout: 8000 };
vi.setConfig({ testTimeout: 20_000 });

const overlay = () => document.getElementById(INTRO_OVERLAY_ID);
const skipButton = () => screen.getByRole("button", { name: ro["intro.skip"] });

/**
 * The way the shell really mounts: the server's HTML first, then React hydrates it. A plain
 * client render is a client-side navigation into the layout, where the shell stays out.
 */
function hydrateIntro() {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<IntroPreloader />);
  document.body.appendChild(container);
  return render(<IntroPreloader />, { container, hydrate: true });
}

/** Stand-ins for the page entrance targets the header and hero carry. */
function mountRevealMarkers(): HTMLElement[] {
  return (["header", "title", "stats"] as const).map((target) => {
    const el = document.createElement(target === "header" ? "header" : "div");
    el.setAttribute("data-intro-reveal", target);
    document.body.appendChild(el);
    return el;
  });
}

let events: ReturnType<typeof listenForDone>;
function stubGetContext() {
  return vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation((() => null) as unknown as GetContext);
}

let getContext: ReturnType<typeof stubGetContext>;

beforeEach(() => {
  if (probe.sceneModuleCached) {
    // Every `sceneImported === false` below would pass without looking: a cached module
    // never runs its mock factory again.
    throw new Error("the WebGL describe imports the scene module: keep it the last in this file");
  }
  resetIntroForTests();
  document.cookie = `${INTRO_COOKIE}=;path=/;max-age=0`;
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
  probe.sceneImported = false;
  probe.director = "real";
  probe.capability = null;
  probe.probes = 0;
  probe.probed = null;
  probe.directorCapability = null;
  events = listenForDone();
  getContext = stubGetContext();
});

afterEach(() => {
  events.stop();
  window.matchMedia = realMatchMedia;
  document.querySelectorAll("[data-intro-reveal]").forEach((el) => el.remove());
  Reflect.deleteProperty(window, "AudioContext");
  Reflect.deleteProperty(document, "visibilityState");
  Reflect.deleteProperty(Element.prototype, "getAnimations");
  document.getElementById("estimare")?.remove();
  window.history.replaceState(null, "", window.location.pathname);
  vi.useRealTimers();
});

describe("IntroPreloader — server markup", () => {
  it("renders the overlay, a progressbar at 0 and the skip button, and nothing that hides the page", () => {
    const html = renderToString(<IntroPreloader />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain(ro["intro.skip"]);
    expect(html).not.toContain("<canvas");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("<header");

    const host = document.createElement("div");
    host.innerHTML = html;
    const root = host.querySelector(`#${INTRO_OVERLAY_ID}`);
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-testid")).toBe("intro");
    expect(root?.hasAttribute("aria-hidden")).toBe(false);
    expect(root?.hasAttribute("role")).toBe(false);
    // Before JS: the CSS failsafe is armed (no data-live) and the renderer is undecided.
    expect(root?.getAttribute("data-phase")).toBe("boot");
    expect(root?.getAttribute("data-renderer")).toBe("pending");
    expect(root?.hasAttribute("data-live")).toBe(false);

    const progressbar = host.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute("aria-label")).toBe(ro["intro.progressAria"]);
    expect(progressbar?.getAttribute("aria-valuemin")).toBe("0");
    expect(progressbar?.getAttribute("aria-valuemax")).toBe("100");
    expect(progressbar?.textContent).toMatch(/^SYSTEM_SYNCHRONIZATION: \d{1,3}%$/);
    expect(progressbar?.querySelector('[data-testid="intro-counter"]')).not.toBeNull();

    // The skip button is the progressbar's sibling, not its child (children of a
    // progressbar are presentational), and it is not autofocused.
    const skip = host.querySelector("button");
    expect(skip?.getAttribute("type")).toBe("button");
    expect(progressbar?.contains(skip ?? null)).toBe(false);
    expect(skip?.hasAttribute("autofocus")).toBe(false);
    // The key-cap is catalog copy too, and decorative.
    const kbd = skip?.querySelector("kbd");
    expect(kbd?.textContent).toBe(ro["intro.skipKey"]);
    expect(kbd?.getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelector('[data-testid="intro-scene"]')).not.toBeNull();
  });

  it("pins the CSS failsafe, reduced-motion and deep-link rules the server markup relies on", () => {
    const css = readFileSync(
      resolve(process.cwd(), "components/intro/IntroPreloader.module.css"),
      "utf8",
    );
    expect(css).toMatch(
      new RegExp(`animation:\\s*introFailsafe\\s+\\d+ms\\s+[\\w-]+\\s+${INTRO_TIMING.FAILSAFE_MS}ms\\s+forwards`),
    );
    expect(css).toMatch(/@keyframes introFailsafe\s*\{\s*to\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/);
    expect(css).toMatch(/\.overlay\[data-live\]\s*\{\s*animation:\s*none;/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.overlay\s*\{\s*display:\s*none !important;/,
    );
    expect(css).toMatch(/:global\(html:has\(:target\)\) \.overlay\s*\{\s*display:\s*none !important;/);
  });

  it("pins the click-through fade, the paused hidden fallback and the filter-free halo", () => {
    const css = readFileSync(
      resolve(process.cwd(), "components/intro/IntroPreloader.module.css"),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    // Nothing inside the overlay catches a click once the page is uncovered — not even an
    // inline `pointer-events: auto` (R3F's canvas wrapper).
    expect(css).toMatch(
      /\.overlay\[data-phase="revealed"\] \*,\s*\.overlay\[data-phase="leaving"\] \*\s*\{\s*pointer-events:\s*none !important;/,
    );
    // The SVG ∞ stops animating while the WebGL scene covers it.
    expect(css).toMatch(
      /\.overlay\[data-renderer="webgl"\] \.fallback \*\s*\{\s*animation-play-state:\s*paused;/,
    );
    // A CSS filter under the 3D tilt is re-run by the compositor every frame.
    const halo = css.match(/\.fbHalo\s*\{([^}]*)\}/);
    expect(halo?.[1]).toBeDefined();
    expect(halo?.[1]).not.toMatch(/filter/);
  });

  it("blurs the halo inside the SVG, with both strengths the CSS switches between", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<IntroPreloader />);
    const blurs = Array.from(host.querySelectorAll("filter feGaussianBlur")).map((blur) =>
      Number(blur.getAttribute("stdDeviation")),
    );
    expect(blurs).toEqual([8, 16]);
    const filtered = Array.from(host.querySelectorAll("path[filter]"));
    expect(filtered).toHaveLength(2);
    for (const path of filtered) {
      const id = path.getAttribute("filter")?.match(/^url\(#(.+)\)$/)?.[1];
      expect(id && host.querySelector(`filter[id="${id}"]`)).toBeTruthy();
    }
  });
});

describe("IntroPreloader — hard loads only", () => {
  it("a client-side mount (the layout rendered by a navigation) renders nothing and touches nothing", async () => {
    const rootStyle = watchRootStyle();
    const { container } = render(<IntroPreloader />);

    expect(container).toBeEmptyDOMElement();
    expect(overlay()).toBeNull();
    // Give any effect, promise or timer the chance to act anyway.
    await new Promise((settle) => setTimeout(settle, 100));
    rootStyle.stop();
    expect(overlay()).toBeNull();
    expect(rootStyle.seen).toEqual([]);
    expect(document.documentElement.style.overflow).toBe("");
    expect(readIntroSeen(document.cookie)).toBe(false);
    expect(events.detail).not.toHaveBeenCalled();
    expect(probe.probes).toBe(0);
  });

  it("hydrating the server's overlay takes over, and a re-render keeps it", async () => {
    const { rerender } = hydrateIntro();
    expect(overlay()).not.toBeNull();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-phase", "run"));
    rerender(<IntroPreloader />);
    expect(overlay()).toHaveAttribute("data-phase", "run");
    expect(document.documentElement.style.overflow).toBe("hidden");
  });
});

describe("IntroPreloader — in the browser", () => {
  it("takes over, locks scroll and plays on the SVG fallback without ever touching WebGL", async () => {
    hydrateIntro();
    const root = overlay();
    expect(root).not.toBeNull();

    await waitFor(() => expect(root).toHaveAttribute("data-renderer", "fallback"), SLOW);
    expect(root).toHaveAttribute("data-phase", "run");
    expect(root).toHaveAttribute("data-live");
    expect(root).not.toHaveAttribute("aria-hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(root?.querySelector("canvas")).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
    expect(probe.sceneImported).toBe(false);
    expect(events.detail).not.toHaveBeenCalled();
  });

  it("skip (click) finishes the intro once, sets the cookie, and leaves no style on the page", async () => {
    const markers = mountRevealMarkers();
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    await user.click(skipButton());

    await waitFor(() => expect(overlay()).toBeNull(), SLOW);
    expect(readIntroSeen(document.cookie)).toBe(true);
    expect(events.detail).toHaveBeenCalledTimes(1);
    // The director had taken over, so the burst played (fast) rather than bailing out.
    expect(events.detail).toHaveBeenCalledWith({ played: true });
    for (const el of markers) expect(el).not.toHaveAttribute("style");
    expect(probe.sceneImported).toBe(false);
  });

  it("Escape skips the same way", async () => {
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(overlay()).toBeNull(), SLOW);
    expect(readIntroSeen(document.cookie)).toBe(true);
    expect(events.detail).toHaveBeenCalledTimes(1);
  });

  it("ignores browser shortcuts (a modified key is not a skip)", async () => {
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    await user.keyboard("{Control>}{Escape}{/Control}");

    expect(overlay()).not.toBeNull();
    expect(events.detail).not.toHaveBeenCalled();
    expect(readIntroSeen(document.cookie)).toBe(false);
  });

  it("restores the page's own scroll styles afterwards, and never touches body position", async () => {
    document.documentElement.style.overflow = "clip";
    const user = userEvent.setup();
    hydrateIntro();

    await waitFor(() => expect(document.documentElement.style.overflow).toBe("hidden"));
    expect(document.body.style.position).toBe("");

    await user.click(skipButton());
    await waitFor(() => expect(overlay()).toBeNull(), SLOW);

    expect(document.documentElement.style.overflow).toBe("clip");
    expect(document.body.style.position).toBe("");
  });

  it("under reduced motion finishes by itself, before any GSAP timeline or lock", async () => {
    mockReducedMotion();
    const timeline = vi.spyOn(gsap, "timeline");
    document.documentElement.style.overflow = "clip";
    const rootStyle = watchRootStyle();

    hydrateIntro();

    await waitFor(() => expect(overlay()).toBeNull());
    rootStyle.stop();
    expect(rootStyle.seen).not.toContain("hidden");
    expect(readIntroSeen(document.cookie)).toBe(true);
    expect(events.detail).toHaveBeenCalledTimes(1);
    expect(events.detail).toHaveBeenCalledWith({ played: false });
    expect(timeline).not.toHaveBeenCalled();
    expect(document.documentElement.style.overflow).toBe("clip");
    expect(getContext).not.toHaveBeenCalled();
    expect(probe.sceneImported).toBe(false);
  });

  it("unmounting mid-intro unlocks the page and stops listening", async () => {
    document.documentElement.style.overflow = "clip";
    const user = userEvent.setup();
    const { unmount } = hydrateIntro();
    await waitFor(() => expect(document.documentElement.style.overflow).toBe("hidden"));

    unmount();

    expect(document.documentElement.style.overflow).toBe("clip");
    await user.keyboard("{Escape}");
    expect(readIntroSeen(document.cookie)).toBe(false);
    expect(events.detail).not.toHaveBeenCalled();
  });

  it("never constructs an AudioContext (sound is off by default)", async () => {
    let constructed = 0;
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() {
        constructed += 1;
      }
    };
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    await user.click(skipButton());
    await waitFor(() => expect(overlay()).toBeNull(), SLOW);

    expect(constructed).toBe(0);
  });

  it("a #hash deep link to a section bypasses the intro", async () => {
    const section = document.createElement("section");
    section.id = "estimare";
    document.body.appendChild(section);
    window.history.replaceState(null, "", "#estimare");
    const rootStyle = watchRootStyle();

    hydrateIntro();

    await waitFor(() => expect(overlay()).toBeNull());
    rootStyle.stop();
    expect(rootStyle.seen).not.toContain("hidden");
    expect(events.detail).toHaveBeenCalledWith({ played: false });
    expect(readIntroSeen(document.cookie)).toBe(true);
  });

  it("a hash that targets nothing does not bypass it", async () => {
    window.history.replaceState(null, "", "#nothing-here");
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-phase", "run"));
    expect(events.detail).not.toHaveBeenCalled();
  });

  it("hydrating after LATE_TAKEOVER_MS of the CSS failsafe bypasses instead of snapping back", async () => {
    fakeFailsafeClock(INTRO_TIMING.LATE_TAKEOVER_MS + 50);
    hydrateIntro();
    await waitFor(() => expect(overlay()).toBeNull());
    expect(events.detail).toHaveBeenCalledWith({ played: false });
  });

  it("an ordinary hydration (failsafe clock early) takes over", async () => {
    fakeFailsafeClock(900);
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-live"));
    expect(overlay()).toHaveAttribute("data-phase", "run");
    expect(events.detail).not.toHaveBeenCalled();
  });

  it("a director that throws gets the page out from under the overlay", async () => {
    probe.director = "throw";
    vi.spyOn(console, "error").mockImplementation(() => {});
    document.documentElement.style.overflow = "clip";

    hydrateIntro();

    await waitFor(() => expect(overlay()).toBeNull(), { timeout: 2000 });
    expect(events.detail).toHaveBeenCalledTimes(1);
    expect(events.detail).toHaveBeenCalledWith({ played: false });
    expect(readIntroSeen(document.cookie)).toBe(true);
    expect(document.documentElement.style.overflow).toBe("clip");
  });

  it("the watchdog ends an intro that never reveals, counting only time the tab was visible", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    probe.director = "idle";
    hydrateIntro();
    expect(overlay()).toHaveAttribute("data-phase", "run");

    act(() => vi.advanceTimersByTime(INTRO_TIMING.WATCHDOG_MS - 1000));
    expect(overlay()).toHaveAttribute("data-phase", "run");

    // A background tab: a minute passes, nobody is watching, nothing is skipped.
    act(() => setVisibility("hidden"));
    act(() => vi.advanceTimersByTime(60_000));
    expect(overlay()).toHaveAttribute("data-phase", "run");
    expect(events.detail).not.toHaveBeenCalled();

    act(() => setVisibility("visible"));
    act(() => vi.advanceTimersByTime(999));
    expect(overlay()).toHaveAttribute("data-phase", "run");
    act(() => vi.advanceTimersByTime(1));
    expect(overlay()).toHaveAttribute("data-phase", "leaving");
    expect(events.detail).toHaveBeenCalledWith({ played: false });

    act(() => vi.advanceTimersByTime(400));
    expect(overlay()).toBeNull();
  });

  it("a skip key stops at the intro: no later listener and no sibling's onKeyDown acts on it too", async () => {
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    // All registered after the shell's listener: one on document, one on window, and — like
    // the cookie banner — a focused element in another React root with its own onKeyDown.
    const heard: string[] = [];
    const onDocument = (event: KeyboardEvent) => heard.push(`document:${event.key}`);
    const onWindow = (event: KeyboardEvent) => heard.push(`window:${event.key}`);
    document.addEventListener("keydown", onDocument);
    window.addEventListener("keydown", onWindow);
    render(
      <div
        data-testid="banner"
        tabIndex={-1}
        onKeyDown={(event) => heard.push(`banner:${event.key}`)}
      />,
    );
    screen.getByTestId("banner").focus();

    try {
      // Not a skip key: everyone hears it, and the intro carries on.
      await user.keyboard("a");
      expect(heard).toEqual(["banner:a", "document:a", "window:a"]);
      expect(events.detail).not.toHaveBeenCalled();
      heard.length = 0;

      await user.keyboard("{Escape}");
      expect(heard).toEqual([]);
      await waitFor(() => expect(overlay()).toBeNull(), SLOW);
      expect(events.detail).toHaveBeenCalledTimes(1);

      // The intro is over and its listener gone: the same key reaches everyone again.
      await user.keyboard("{Escape}");
      expect(heard).toEqual(["banner:Escape", "document:Escape", "window:Escape"]);
    } finally {
      document.removeEventListener("keydown", onDocument);
      window.removeEventListener("keydown", onWindow);
    }
  });

  it("Tab skips too, yet still moves focus: the key is stopped, never prevented", async () => {
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);
    const heard: string[] = [];
    const onDocument = (event: KeyboardEvent) => heard.push(event.key);
    document.addEventListener("keydown", onDocument);

    /*
     * Where the Tab took focus is recorded as it happens, not read back afterwards.
     * `document.activeElement` is a snapshot of a moving target: the skip this very Tab
     * requested ends with `reveal()`, which blurs whatever still has focus inside the
     * overlay before the overlay goes (IntroDirector.tsx) — correct behaviour, and it
     * lands back on <body>. On a quiet machine `await user.tab()` returns long before the
     * ~0.95s burst gets there; on a loaded one the whole burst can run inside that await,
     * and the assertion then read <body> instead of the button. `focusin` fires
     * synchronously inside `user.tab()`'s own focus() call, so this pins the same thing —
     * Tab moved focus, to the skip button, exactly once — whatever the machine is doing.
     */
    const focused: Element[] = [];
    const onFocusIn = (event: Event) => focused.push(event.target as Element);
    document.addEventListener("focusin", onFocusIn);

    // Grabbed before the Tab: the same DOM node throughout, and still nameable after the
    // skip has taken the overlay off the page.
    const skip = skipButton();

    try {
      await user.tab();
      expect(focused).toEqual([skip]);
      expect(heard).toEqual([]);
      await waitFor(() => expect(overlay()).toBeNull(), SLOW);
    } finally {
      document.removeEventListener("keydown", onDocument);
      document.removeEventListener("focusin", onFocusIn);
    }
  });

  it("probes the device once, in the shell, and hands the answer to the director", async () => {
    const user = userEvent.setup();
    hydrateIntro();
    await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);

    expect(probe.probes).toBe(1);
    expect(probe.probed?.webgl).toBe(false);
    expect(probe.directorCapability).toBe(probe.probed);

    await user.click(skipButton());
    await waitFor(() => expect(overlay()).toBeNull(), SLOW);
    expect(probe.probes).toBe(1);
    expect(probe.sceneImported).toBe(false);
  });
});

describe("IntroPreloader — the overlay-gone signal", () => {
  /** Every INTRO_GONE_EVENT, with whether the overlay was still in the document at that moment. */
  function listenForGone() {
    const seen: Array<{ overlayPresent: boolean }> = [];
    const listener = () => seen.push({ overlayPresent: overlay() !== null });
    window.addEventListener(INTRO_GONE_EVENT, listener);
    return { seen, stop: () => window.removeEventListener(INTRO_GONE_EVENT, listener) };
  }

  it("fires exactly once, after the overlay has left the document, when the visitor skips", async () => {
    const gone = listenForGone();
    const user = userEvent.setup();
    try {
      const { unmount } = hydrateIntro();
      await waitFor(() => expect(overlay()).toHaveAttribute("data-renderer", "fallback"), SLOW);
      expect(gone.seen).toEqual([]);
      expect(isIntroOnScreen()).toBe(true);

      await user.click(skipButton());
      await waitFor(() => expect(overlay()).toBeNull(), SLOW);
      await waitFor(() => expect(gone.seen).toHaveLength(1));
      expect(gone.seen[0]).toEqual({ overlayPresent: false });
      expect(isIntroOnScreen()).toBe(false);

      // Tearing the shell down afterwards does not announce it a second time.
      unmount();
      expect(gone.seen).toHaveLength(1);
    } finally {
      gone.stop();
    }
  });

  it("fires exactly once when reduced motion bypasses the intro", async () => {
    mockReducedMotion();
    const gone = listenForGone();
    try {
      const { unmount } = hydrateIntro();
      await waitFor(() => expect(overlay()).toBeNull());
      await waitFor(() => expect(gone.seen).toHaveLength(1));
      expect(gone.seen[0]).toEqual({ overlayPresent: false });
      unmount();
      expect(gone.seen).toHaveLength(1);
    } finally {
      gone.stop();
    }
  });

  it("stays silent while the overlay is still covering the page", async () => {
    probe.director = "idle";
    const gone = listenForGone();
    try {
      hydrateIntro();
      await waitFor(() => expect(overlay()).toHaveAttribute("data-phase", "run"));
      // Give every effect and promise the chance to act anyway.
      await new Promise((settle) => setTimeout(settle, 100));
      expect(gone.seen).toEqual([]);
      expect(isIntroOnScreen()).toBe(true);
    } finally {
      gone.stop();
    }
  });
});

/*
 * KEEP LAST. This describe imports the (mocked) scene module on purpose, and a module is
 * only evaluated once per file — after it, `sceneImported` could never flip again, so every
 * "never touched three.js" assertion above would pass blind. `beforeEach` fails loudly if a
 * test is ever added below it.
 */
describe("IntroPreloader — a WebGL-capable device", () => {
  it("requests the scene chunk from the shell, beside the director's, not after it", async () => {
    expect(probe.sceneImported).toBe(false);
    probe.capability = { webgl: true, tier: "low", parallax: false, force3d: false };
    // A director that renders nothing: if the scene module loads, only the shell asked for it.
    probe.director = "idle";

    try {
      hydrateIntro();
      await waitFor(() => expect(probe.sceneImported).toBe(true), SLOW);
      await waitFor(() => expect(probe.directorCapability).toBe(probe.capability), SLOW);
      expect(probe.probes).toBe(1);
      expect(overlay()).toHaveAttribute("data-phase", "run");
    } finally {
      probe.sceneModuleCached = true;
    }
  });
});
