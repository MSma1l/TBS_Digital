import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { createElement } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SceneDirector } from "@/components/scene/SceneDirector";
import {
  guardSmoothScroll,
  parallaxTargets,
  quietScrollTrigger,
  resetScrollTriggerQuietForTests,
  wakeScrollTrigger,
  withInstantScroll,
} from "@/components/scene/scrollGuard";
import {
  releaseProbe,
  writeAnchors,
  writeHeroSpan,
  writeServicesSpan,
} from "@/components/scene/scrollProbe";
import { RenderErrorBoundary } from "@/components/three/RenderErrorBoundary";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";
import { coverPage } from "@/lib/scrollLock";
import {
  INSTANT_SCROLL_ATTR,
  PARALLAX_MEDIA,
  SCENE_ATTR,
  SCENE_TIMING,
  createScrollProbe,
  type ScrollProbe,
} from "@/lib/scene";

/*
 * The interior stage's scroll glue, in jsdom:
 *   · scrollGuard.ts — ScrollTrigger's refreshes stay instant and leave no inline style on
 *     <html>; parallax never lands on an entrance marker, a scroll reveal, <html> or <body>;
 *   · scrollProbe.ts — what a refresh writes into the probe the scene reads every frame;
 *   · SceneDirector — the real gsap 3.15.0 + ScrollTrigger: what it measures, what it
 *     animates (and where), when it refreshes, and that an unmount leaves nothing behind.
 * jsdom has no layout, so boxes are stubbed where a number matters.
 */

const root = () => document.documentElement;

/** A ScrollTrigger stand-in: scroll functions with gsap's `smooth` flag and a listener table. */
function fakeScrollTrigger() {
  const funcs = { vertical: { smooth: true }, horizontal: { smooth: true } };
  const listeners = new Map<string, Set<() => void>>();
  const ST = {
    getScrollFunc: vi.fn((_target: unknown, horizontal?: boolean) =>
      horizontal ? funcs.horizontal : funcs.vertical,
    ),
    addEventListener: vi.fn((type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: () => void) => listeners.get(type)?.delete(fn)),
  };
  const dispatch = (type: string) => listeners.get(type)?.forEach((fn) => fn());
  const count = () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
  return { ST: ST as unknown as typeof ScrollTrigger, funcs, dispatch, count };
}

/** `el.getBoundingClientRect()` answers this box (document offsets are the test's business). */
function stubBox(el: Element, box: { left: number; top: number; width: number; height: number }) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    ...box,
    x: box.left,
    y: box.top,
    right: box.left + box.width,
    bottom: box.top + box.height,
    toJSON: () => box,
  } as DOMRect);
}

const realScroll = {
  x: Object.getOwnPropertyDescriptor(window, "scrollX"),
  y: Object.getOwnPropertyDescriptor(window, "scrollY"),
};

function setScroll(x: number, y: number) {
  Object.defineProperty(window, "scrollX", { configurable: true, value: x });
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
}

function restoreScroll() {
  for (const [key, descriptor] of [["scrollX", realScroll.x], ["scrollY", realScroll.y]] as const) {
    if (descriptor) Object.defineProperty(window, key, descriptor);
    else Reflect.deleteProperty(window, key);
  }
}

afterEach(() => {
  root().removeAttribute(INSTANT_SCROLL_ATTR);
  root().removeAttribute("style");
  document.body.removeAttribute("style");
  restoreScroll();
});

/* ---- scrollGuard.ts -------------------------------------------------------------------- */

describe("withInstantScroll", () => {
  it("holds data-scroll-measure on the root while `run` runs, and returns its value", () => {
    let during = false;
    const value = withInstantScroll(root(), () => {
      during = root().hasAttribute(INSTANT_SCROLL_ATTR);
      return 42;
    });
    expect(during).toBe(true);
    expect(value).toBe(42);
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
  });

  it("lets go even when `run` throws", () => {
    expect(() =>
      withInstantScroll(root(), () => {
        throw new Error("measure failed");
      }),
    ).toThrow("measure failed");
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
  });
});

describe("guardSmoothScroll", () => {
  it("marks both of window's scroll functions as not smooth", () => {
    const { ST, funcs } = fakeScrollTrigger();
    guardSmoothScroll(ST, root());
    expect(ST.getScrollFunc).toHaveBeenCalledWith(window, false);
    expect(ST.getScrollFunc).toHaveBeenCalledWith(window, true);
    expect(funcs.vertical.smooth).toBe(false);
    expect(funcs.horizontal.smooth).toBe(false);
  });

  it("holds the attribute from refreshInit to refresh, and never writes a style", () => {
    const { ST, dispatch } = fakeScrollTrigger();
    guardSmoothScroll(ST, root());
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);

    dispatch("refreshInit");
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(true);
    dispatch("refresh");
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
    expect(root().hasAttribute("style")).toBe(false);
  });

  it("the release removes both listeners and the attribute, even mid-refresh", () => {
    const { ST, dispatch, count } = fakeScrollTrigger();
    const release = guardSmoothScroll(ST, root());
    expect(count()).toBe(2);

    dispatch("refreshInit");
    release();
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
    expect(count()).toBe(0);
    dispatch("refreshInit");
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
  });

  it("with the real ScrollTrigger: a full refresh is measured instantly and leaves <html> unstyled", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    gsap.registerPlugin(ScrollTrigger);
    const release = guardSmoothScroll(ScrollTrigger, root());
    const seen: boolean[] = [];
    const probeDuringRefresh = () => seen.push(root().hasAttribute(INSTANT_SCROLL_ATTR));
    ScrollTrigger.addEventListener("refreshInit", probeDuringRefresh);
    try {
      const vertical = ScrollTrigger.getScrollFunc(window) as unknown as { smooth?: boolean };
      const horizontal = ScrollTrigger.getScrollFunc(window, true) as unknown as { smooth?: boolean };
      expect(vertical.smooth).toBe(false);
      expect(horizontal.smooth).toBe(false);

      ScrollTrigger.refresh();
      expect(seen).toEqual([true]);
      expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
      expect(root().getAttribute("style")).toBeNull();
      expect(document.body.getAttribute("style")).toBeNull();
    } finally {
      ScrollTrigger.removeEventListener("refreshInit", probeDuringRefresh);
      release();
      scrollTo.mockRestore();
    }
  });
});

describe("quietScrollTrigger / wakeScrollTrigger", () => {
  /* A ScrollTrigger switch whose enable() registers what gsap 3.15.0's does on every call:
     three gsap events and one (orientation: portrait) matchMedia. */
  function fakeSwitch(triggers: unknown[] = []) {
    const core = {
      listeners: new Map<string, Set<(...args: unknown[]) => void>>(),
      addEventListener: vi.fn(function (type: string, callback: (...args: unknown[]) => void) {
        if (!core.listeners.has(type)) core.listeners.set(type, new Set());
        core.listeners.get(type)!.add(callback);
      }),
      removeEventListener: vi.fn((type: string, callback: (...args: unknown[]) => void) => {
        core.listeners.get(type)?.delete(callback);
      }),
      contexts: [] as { killed: boolean; kill(): void }[],
      matchMedia: vi.fn(() => {
        const context = { killed: false, kill: () => void (context.killed = true), add: () => context };
        core.contexts.push(context);
        return context;
      }),
    };
    const count = () => [...core.listeners.values()].reduce((sum, set) => sum + set.size, 0);
    const ST = {
      getAll: vi.fn(() => triggers),
      disable: vi.fn(),
      enable: vi.fn(() => {
        for (const type of ["matchMediaInit", "matchMediaRevert", "matchMedia"]) {
          core.addEventListener(type, () => {});
        }
        core.matchMedia().add();
      }),
    };
    return { core, ST: ST as unknown as typeof ScrollTrigger, spies: ST, count };
  }

  beforeEach(() => {
    // The real ScrollTrigger may have been quieted by an earlier director unmount: wake it,
    // then start the module's bookkeeping clean for the fakes below.
    wakeScrollTrigger(ScrollTrigger, gsap);
    resetScrollTriggerQuietForTests();
  });
  afterEach(() => resetScrollTriggerQuietForTests());

  it("quiets only once no trigger is left, and wakes only what a quiet put to sleep", () => {
    const live = fakeSwitch([{}]);
    expect(quietScrollTrigger(live.ST)).toBe(false);
    expect(live.spies.disable).not.toHaveBeenCalled();

    const idle = fakeSwitch();
    expect(wakeScrollTrigger(idle.ST, idle.core)).toBe(false);
    expect(quietScrollTrigger(idle.ST)).toBe(true);
    expect(quietScrollTrigger(idle.ST)).toBe(false);
    expect(idle.spies.disable).toHaveBeenCalledTimes(1);
    expect(wakeScrollTrigger(idle.ST, idle.core)).toBe(true);
    expect(wakeScrollTrigger(idle.ST, idle.core)).toBe(false);
    expect(idle.spies.enable).toHaveBeenCalledTimes(1);
  });

  it("the next quiet removes what a wake's enable() registered, so round trips never stack listeners", () => {
    const { core, ST, count } = fakeSwitch();
    const add = core.addEventListener;
    const matchMedia = core.matchMedia;
    core.addEventListener("matchMediaInit", () => {}); // ScrollTrigger's own, from registration
    expect(count()).toBe(1);

    for (let round = 1; round <= 3; round += 1) {
      expect(quietScrollTrigger(ST)).toBe(true);
      expect(count()).toBe(1);
      expect(wakeScrollTrigger(ST, core)).toBe(true);
      expect(count()).toBe(4);
      // gsap's own methods are back in place once enable() has returned.
      expect(core.addEventListener).toBe(add);
      expect(core.matchMedia).toBe(matchMedia);
    }
    expect(quietScrollTrigger(ST)).toBe(true);
    expect(count()).toBe(1);
    expect(core.contexts).toHaveLength(3);
    expect(core.contexts.every((context) => context.killed)).toBe(true);
  });

  it("puts gsap's methods back even when enable() throws", () => {
    const { core, ST, spies } = fakeSwitch();
    const add = core.addEventListener;
    const matchMedia = core.matchMedia;
    quietScrollTrigger(ST);
    spies.enable.mockImplementationOnce(() => {
      throw new Error("no body");
    });
    expect(() => wakeScrollTrigger(ST, core)).toThrow("no body");
    expect(core.addEventListener).toBe(add);
    expect(core.matchMedia).toBe(matchMedia);
  });
});

describe("parallaxTargets", () => {
  it("finds the layer's elements under the scope and skips markers, reveals, <html> and <body>", () => {
    const scope = document.createElement("div");
    scope.innerHTML = `
      <div data-intro-reveal="grid"><div id="backdrop" data-parallax="hero-backdrop"></div></div>
      <div id="stats" data-parallax="hero-stats"><div data-intro-reveal="stats"></div></div>
      <div id="marker" data-parallax="hero-stats" ${INTRO_REVEAL_ATTR}="cta"></div>
      <div id="reveal" data-parallax="hero-stats" data-reveal=""></div>
      <div id="other" data-parallax="work-media"></div>`;
    document.body.append(scope);
    try {
      expect(parallaxTargets(scope, "hero-backdrop").map((el) => el.id)).toEqual(["backdrop"]);
      expect(parallaxTargets(scope, "hero-stats").map((el) => el.id)).toEqual(["stats"]);
      expect(parallaxTargets(scope, "missing")).toEqual([]);

      root().setAttribute(SCENE_ATTR.parallax, "page");
      document.body.setAttribute(SCENE_ATTR.parallax, "page");
      expect(parallaxTargets(document, "page")).toEqual([]);
    } finally {
      root().removeAttribute(SCENE_ATTR.parallax);
      document.body.removeAttribute(SCENE_ATTR.parallax);
      scope.remove();
    }
  });
});

/* ---- scrollProbe.ts -------------------------------------------------------------------- */

describe("scroll probe writes", () => {
  it("copies a trigger's start/end into heroExit and handoff, never a non-finite number", () => {
    const probe = createScrollProbe();
    const heroExit = probe.heroExit;
    writeHeroSpan(probe, { start: 0, end: 812.5 } as ScrollTrigger);
    writeServicesSpan(probe, { start: 1400, end: 1810 } as ScrollTrigger);
    expect(probe.heroExit).toEqual({ start: 0, end: 812.5 });
    expect(probe.handoff).toEqual({ start: 1400, end: 1810 });
    expect(probe.heroExit).toBe(heroExit);

    writeServicesSpan(probe, { start: Number.NaN, end: Number.POSITIVE_INFINITY } as ScrollTrigger);
    expect(probe.handoff).toEqual({ start: 0, end: 0 });
  });

  function buildStage() {
    const stage = document.createElement("div");
    stage.innerHTML = `
      <div aria-hidden="true"><div data-scene-layer="" style="top: 72px"></div></div>
      <div data-scene-anchor="hero"></div>`;
    document.body.append(stage);
    return stage;
  }

  it("writes the stage and anchors in document pixels, then version++ and live", () => {
    const stage = buildStage();
    const probe = createScrollProbe();
    root().style.setProperty("--header-h", "71px");
    setScroll(3, 250);
    stubBox(stage, { left: 0, top: 100, width: 1280, height: 1600 });
    stubBox(stage.querySelector('[data-scene-anchor="hero"]')!, {
      left: 600,
      top: -50,
      width: 480,
      height: 480,
    });
    try {
      writeAnchors(probe, stage);
      expect(probe.stage).toEqual({ top: 350, bottom: 1950 });
      expect(probe.hero).toEqual({ x: 603, y: 200, w: 480, h: 480 });
      expect(probe.services).toBeNull();
      expect(probe.headerH).toBe(71);
      expect(probe.version).toBe(1);
      expect(probe.live).toBe(true);

      // A second refresh updates the same box in place.
      const hero = probe.hero;
      setScroll(3, 0);
      writeAnchors(probe, stage);
      expect(probe.hero).toBe(hero);
      expect(probe.hero).toEqual({ x: 603, y: -50, w: 480, h: 480 });
      expect(probe.version).toBe(2);

      releaseProbe(probe);
      expect(probe.live).toBe(false);
      expect(probe.version).toBe(2);
    } finally {
      stage.remove();
    }
  });

  it("reads the header height off the sticky layer when --header-h is not a plain px length", () => {
    const stage = buildStage();
    const probe: ScrollProbe = createScrollProbe();
    root().style.setProperty("--header-h", "calc(4rem + 7px)");
    try {
      writeAnchors(probe, stage);
      expect(probe.headerH).toBe(72);
      expect(probe.hero).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    } finally {
      stage.remove();
    }
  });
});

/* ---- SceneDirector (real gsap + ScrollTrigger) ------------------------------------------ */

type ResizeCallback = (entries: Array<{ contentRect: { height: number } }>) => void;

describe("SceneDirector", () => {
  let resize: ResizeCallback | null = null;
  let observed: Element[] = [];

  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    resize = null;
    observed = [];
    window.ResizeObserver = class {
      constructor(callback: ResizeCallback) {
        resize = callback;
      }
      observe(target: Element) {
        observed.push(target);
      }
      unobserve() {}
      disconnect() {
        resize = null;
      }
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "ResizeObserver");
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  /** The page around the stage: main > stage > (track > layer), #top with the hero layers, the services anchor. */
  function buildPage() {
    const main = document.createElement("main");
    main.innerHTML = `
      <div data-scene-stage="" data-scroll-fx="off">
        <div aria-hidden="true"><div data-scene-layer=""></div></div>
        <section id="top">
          <div ${INTRO_REVEAL_ATTR}="grid"><div id="backdrop" data-parallax="hero-backdrop"></div>
            <div data-scene-anchor="hero"></div></div>
          <div id="stats" data-parallax="hero-stats"><div ${INTRO_REVEAL_ATTR}="stats"></div></div>
          <div id="marker" data-parallax="hero-stats" ${INTRO_REVEAL_ATTR}="cta"></div>
        </section>
        <section id="servicii"><div data-scene-anchor="services"></div></section>
      </div>`;
    document.body.append(main);
    const stage = main.querySelector<HTMLDivElement>("[data-scene-stage]")!;
    return { main, stage, ref: { current: stage } };
  }

  function mountDirector(stage: { current: HTMLDivElement }, probe: ScrollProbe, onLive = vi.fn()) {
    const view = render(createElement(SceneDirector, { stage, probe, onLive }));
    return { ...view, onLive };
  }

  function matchParallaxMedia() {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query === PARALLAX_MEDIA,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    return () => {
      window.matchMedia = real;
    };
  }

  it("measures on mount, announces live once, turns data-scroll-fx on, and leaves <html>/<body> unstyled", () => {
    const { stage, ref } = buildPage();
    const probe = createScrollProbe();
    const { onLive } = mountDirector(ref, probe);

    expect(onLive).toHaveBeenCalledTimes(1);
    expect(probe.live).toBe(true);
    expect(probe.version).toBe(1);
    expect(probe.hero).not.toBeNull();
    expect(probe.services).not.toBeNull();
    expect(stage.getAttribute(SCENE_ATTR.scrollFx)).toBe("on");
    // Two measurement triggers, no parallax (the media query does not match in jsdom).
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    expect(gsap.getTweensOf("#backdrop, #stats")).toHaveLength(0);
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
    expect(root().getAttribute("style")).toBeNull();
    expect(document.body.getAttribute("style")).toBeNull();
  });

  it("every full refresh measures again; live is still announced once", () => {
    const { ref } = buildPage();
    const probe = createScrollProbe();
    const { onLive } = mountDirector(ref, probe);

    act(() => ScrollTrigger.refresh());
    act(() => ScrollTrigger.refresh());
    expect(probe.version).toBe(3);
    expect(onLive).toHaveBeenCalledTimes(1);
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
    expect(root().getAttribute("style")).toBeNull();
  });

  it("an unmount quiets ScrollTrigger (its interval stops) and the next mount wakes it and measures again", async () => {
    const { ref } = buildPage();
    const first = mountDirector(ref, createScrollProbe());
    const clear = vi.spyOn(window, "clearInterval");
    first.unmount();
    await Promise.resolve();
    expect(clear).toHaveBeenCalled();

    const start = vi.spyOn(window, "setInterval");
    const probe = createScrollProbe();
    const second = mountDirector(ref, probe);
    expect(start.mock.calls.some(([, ms]) => ms === 250)).toBe(true);
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    expect(probe.live).toBe(true);
    act(() => ScrollTrigger.refresh());
    expect(probe.version).toBe(2);
    second.unmount();
  });

  it("an unmount kills every trigger, turns data-scroll-fx off, releases the probe and stops measuring", () => {
    const { stage, ref } = buildPage();
    const probe = createScrollProbe();
    const { unmount } = mountDirector(ref, probe);

    unmount();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(stage.getAttribute(SCENE_ATTR.scrollFx)).toBe("off");
    expect(probe.live).toBe(false);

    ScrollTrigger.refresh();
    expect(probe.version).toBe(1);
    expect(root().hasAttribute(INSTANT_SCROLL_ATTR)).toBe(false);
  });

  it("on a capable desktop, scrubs the two hero layers — never a marker — and reverts them on unmount", () => {
    const restore = matchParallaxMedia();
    try {
      const { stage, ref } = buildPage();
      const { unmount } = mountDirector(ref, createScrollProbe());

      const backdrop = stage.querySelector("#backdrop")!;
      const stats = stage.querySelector("#stats")!;
      const marker = stage.querySelector("#marker")!;
      const [backdropTween] = gsap.getTweensOf(backdrop);
      const [statsTween] = gsap.getTweensOf(stats);
      expect(gsap.getTweensOf(marker)).toHaveLength(0);
      expect(backdropTween.vars).toMatchObject({ yPercent: 12, ease: "none", immediateRender: false });
      expect(statsTween.vars).toMatchObject({ yPercent: -8, ease: "none", immediateRender: false });
      for (const tween of [backdropTween, statsTween]) {
        const trigger = tween.scrollTrigger!;
        expect(trigger.trigger).toBe(stage.querySelector("#top"));
        expect(trigger.vars).toMatchObject({ start: "top top", end: "bottom top", scrub: true });
      }
      expect(ScrollTrigger.getAll()).toHaveLength(4);
      expect(marker.getAttribute("style")).toBeNull();

      unmount();
      expect(ScrollTrigger.getAll()).toHaveLength(0);
      expect(gsap.getTweensOf([backdrop, stats])).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it("refreshes when the stage changes height by 1px or more, debounced, and never on the first report", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { main, stage, ref } = buildPage();
    mountDirector(ref, createScrollProbe());
    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});
    // The stage itself — never <main>, whose height also changes below the stage (review perf #4).
    expect(observed).toEqual([stage]);
    expect(observed).not.toContain(main);

    resize?.([{ contentRect: { height: 4000 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS * 5);
    expect(refresh).not.toHaveBeenCalled();

    resize?.([{ contentRect: { height: 4000.6 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS * 5);
    expect(refresh).not.toHaveBeenCalled();

    resize?.([{ contentRect: { height: 4040 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS - 1);
    resize?.([{ contentRect: { height: 4100 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("skips that refresh when ScrollTrigger refreshed on its own after the change (a window resize)", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const addListener = vi.spyOn(ScrollTrigger, "addEventListener");
    const { ref } = buildPage();
    const probe = createScrollProbe();
    mountDirector(ref, probe);
    // The guard's release and the director's measurement.
    const refreshListeners = addListener.mock.calls.filter(([type]) => type === "refresh").map(([, fn]) => fn);
    expect(refreshListeners).toHaveLength(2);
    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});

    resize?.([{ contentRect: { height: 4000 } }]);
    resize?.([{ contentRect: { height: 3600 } }]);
    // ScrollTrigger's own resize refresh lands inside the debounce: every "refresh" listener runs.
    for (const listener of refreshListeners) listener();
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS);
    expect(refresh).not.toHaveBeenCalled();
    expect(probe.version).toBe(2);

    // A later change with no refresh after it still refreshes.
    resize?.([{ contentRect: { height: 3900 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("defers that refresh while the visitor is scrolling, to the scroll's end", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const addListener = vi.spyOn(ScrollTrigger, "addEventListener");
    const { ref } = buildPage();
    const { unmount } = mountDirector(ref, createScrollProbe());
    const onScrollEnd = addListener.mock.calls.find(([type]) => type === "scrollEnd")?.[1];
    expect(onScrollEnd).toBeTypeOf("function");

    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});
    const scrolling = vi.spyOn(ScrollTrigger, "isScrolling").mockReturnValue(true);
    resize?.([{ contentRect: { height: 4000 } }]);
    resize?.([{ contentRect: { height: 4200 } }]);
    vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS);
    expect(refresh).not.toHaveBeenCalled();

    scrolling.mockReturnValue(false);
    onScrollEnd?.();
    expect(refresh).toHaveBeenCalledTimes(1);
    // A later scroll end with nothing pending refreshes nothing.
    onScrollEnd?.();
    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
    expect(addListener.mock.calls.filter(([type]) => type === "scrollEnd")).toHaveLength(1);
  });

  it("refreshes on a back/forward-cache restore only", () => {
    const { ref } = buildPage();
    const { unmount } = mountDirector(ref, createScrollProbe());
    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});

    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(refresh).not.toHaveBeenCalled();
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(refresh).toHaveBeenCalledTimes(1);

    unmount();
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  /* ---- ScrollTrigger quiet on every way out (review perf #1) ----------------------------- */

  /** How many animation frames the page asks for over `ms` of real time. */
  async function framesRequestedOver(ms: number): Promise<number> {
    const spy = vi.spyOn(window, "requestAnimationFrame");
    try {
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
      return spy.mock.calls.length;
    } finally {
      spy.mockRestore();
    }
  }

  function Broken(): null {
    throw new Error("shader failed");
  }

  /** The stage's shape around the director: mounted while `live`, inside the scene's error boundary. */
  function StageHost({ stage, live, broken, onError }: {
    stage: { current: HTMLDivElement };
    live: boolean;
    broken: boolean;
    onError: () => void;
  }) {
    if (!live) return null;
    return createElement(
      RenderErrorBoundary,
      { onError },
      createElement(SceneDirector, { stage, probe: createScrollProbe(), onLive: () => {} }),
      broken ? createElement(Broken) : null,
    );
  }

  const WAYS_OUT = [
    "the stage drops the scene (a governor bail, a lost context)",
    "the scene's error boundary catches a render error",
    "the page itself unmounts (a client navigation away from /)",
  ] as const;

  it.each(WAYS_OUT)("with the real ScrollTrigger, its frame loop stops when %s", async (way) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ref } = buildPage();
    const onError = vi.fn();
    const props = { stage: ref, live: true, broken: false, onError };
    const view = render(createElement(StageHost, props));
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    // Awake: ScrollTrigger's repaint loop asks for a frame every frame.
    expect(await framesRequestedOver(150)).toBeGreaterThan(2);

    if (way === WAYS_OUT[0]) view.rerender(createElement(StageHost, { ...props, live: false }));
    if (way === WAYS_OUT[1]) view.rerender(createElement(StageHost, { ...props, broken: true }));
    if (way === WAYS_OUT[2]) view.unmount();
    await act(() => Promise.resolve());

    if (way === WAYS_OUT[1]) expect(onError).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    // Quiet: at most the one frame its loop had already queued.
    expect(await framesRequestedOver(200)).toBeLessThanOrEqual(1);

    // Back on the home page: awake again.
    view.unmount();
    const again = render(createElement(StageHost, props));
    expect(ScrollTrigger.getAll()).toHaveLength(2);
    expect(await framesRequestedOver(150)).toBeGreaterThan(2);
    again.unmount();
    await act(() => Promise.resolve());
    consoleError.mockRestore();
  });

  /* ---- under a page cover (review correctness #1) ---------------------------------------- */

  /** One real jsdom animation frame. */
  const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

  /*
   * jsdom has no layout, so the stage's box is stubbed at its viewport top while the page sits
   * at scrollY 3000 in a desktop at 71px below the header: top = 71 − 3000. That one stub is the
   * page both ways: at scrollY 3000 the stage is at document y 71; while the request dialog pins
   * <body> (Modal.tsx) `scrollY` reads 0 and the same box would claim document y −2929.
   */
  const PAGE_Y = 3000;
  function pageAt3000(stage: HTMLElement) {
    stubBox(stage, { left: 0, top: 71 - PAGE_Y, width: 1280, height: 1600 });
    setScroll(0, PAGE_Y);
  }

  it("keeps no measurement taken under a cover and measures again the frame after it lifts", async () => {
    const { stage, ref } = buildPage();
    pageAt3000(stage);
    const probe = createScrollProbe();
    mountDirector(ref, probe);
    expect(probe.stage).toEqual({ top: 71, bottom: 1671 });
    const version = probe.version;
    const heroExit = { ...probe.heroExit };
    const handoff = { ...probe.handoff };

    let release = () => {};
    try {
      // The dialog opens: <body> pinned, scrollY 0 — then ScrollTrigger refreshes (a resize).
      act(() => {
        release = coverPage();
      });
      setScroll(0, 0);
      act(() => ScrollTrigger.refresh());
      expect(probe.version).toBe(version);
      expect(probe.stage).toEqual({ top: 71, bottom: 1671 });
      expect(probe.heroExit).toEqual(heroExit);
      expect(probe.handoff).toEqual(handoff);

      // The dialog closes: the page is back at 3000 BEFORE the cover lifts (Modal.tsx).
      setScroll(0, PAGE_Y);
      const refresh = vi.spyOn(ScrollTrigger, "refresh");
      act(() => release());
      expect(refresh).not.toHaveBeenCalled();
      await act(() => nextFrame());
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(probe.version).toBe(version + 1);
      expect(probe.stage).toEqual({ top: 71, bottom: 1671 });

      // Nothing more is owed: another frame refreshes nothing.
      await act(() => nextFrame());
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
  });

  it("mounted under a cover: measures nothing, and announces live only once the cover lifts", async () => {
    const { stage, ref } = buildPage();
    pageAt3000(stage);
    setScroll(0, 0);
    const release = coverPage();
    try {
      const probe = createScrollProbe();
      const { onLive } = mountDirector(ref, probe);
      expect(onLive).not.toHaveBeenCalled();
      expect(probe.live).toBe(false);
      expect(probe.version).toBe(0);
      expect(stage.getAttribute(SCENE_ATTR.scrollFx)).toBe("on");

      setScroll(0, PAGE_Y);
      act(() => release());
      await act(() => nextFrame());
      expect(onLive).toHaveBeenCalledTimes(1);
      expect(probe.live).toBe(true);
      expect(probe.stage.top).toBe(71);
    } finally {
      release();
    }
  });

  it("a stage height change under a cover waits for the cover to lift, then refreshes once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { ref } = buildPage();
    const { unmount } = mountDirector(ref, createScrollProbe());
    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});
    let release = () => {};
    try {
      release = coverPage();
      resize?.([{ contentRect: { height: 4000 } }]);
      resize?.([{ contentRect: { height: 4400 } }]);
      vi.advanceTimersByTime(SCENE_TIMING.REFRESH_DEBOUNCE_MS * 3);
      expect(refresh).not.toHaveBeenCalled();

      act(() => release());
      await act(() => nextFrame());
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      release();
      unmount();
    }
  });

  it("an unmount stops listening for the cover and drops a redo it had queued", async () => {
    const { stage, ref } = buildPage();
    pageAt3000(stage);
    const probe = createScrollProbe();
    const { unmount } = mountDirector(ref, probe);
    const release = coverPage();
    try {
      setScroll(0, 0);
      act(() => ScrollTrigger.refresh());
      setScroll(0, PAGE_Y);
      release();
      unmount();
      const refresh = vi.spyOn(ScrollTrigger, "refresh");
      await act(() => nextFrame());
      await act(() => nextFrame());
      expect(refresh).not.toHaveBeenCalled();
      // And a later cover round trip reaches no director.
      coverPage()();
      await act(() => nextFrame());
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });

  it("a page without the anchors still mounts: no triggers, the stage measured, live announced", () => {
    const main = document.createElement("main");
    main.innerHTML = `<div data-scene-stage=""></div>`;
    document.body.append(main);
    const stage = main.querySelector<HTMLDivElement>("[data-scene-stage]")!;
    const probe = createScrollProbe();
    const { onLive } = mountDirector({ current: stage }, probe);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(probe.hero).toBeNull();
    expect(probe.services).toBeNull();
    expect(probe.heroExit).toEqual({ start: 0, end: 0 });
    expect(onLive).toHaveBeenCalledTimes(1);
  });
});
