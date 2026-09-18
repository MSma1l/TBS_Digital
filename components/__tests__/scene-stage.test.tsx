import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useEffect, type ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SceneStage } from "@/components/scene/SceneStage";
import { Navbar } from "@/components/layout/Navbar";
import { Directions } from "@/components/sections/Directions";
import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import {
  INTRO_OVERLAY_ID,
  INTRO_REVEAL_ATTR,
  INTRO_REVEAL_ORDER,
  markIntroGone,
  resetIntroForTests,
} from "@/lib/intro";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import {
  GPU_PROBE_CACHE_KEY,
  SCENE_3D_KEY,
  SCENE_TIMING,
  readGpuFacts,
  resetSceneForTests,
  setSceneBoost,
  type GpuFacts,
  type GpuMode,
  type SceneCanvasProps,
  type SceneDirectorProps,
} from "@/lib/scene";
import { coverPage } from "@/lib/scrollLock";
import { SiteContentProvider } from "@/lib/siteContent";

/*
 * The interior stage's loading pipeline (components/scene/SceneStage.tsx) in jsdom.
 *
 * The heavy halves are mocked and COUNTED: a mock module's factory runs on its first import
 * only, once per file — so every "nothing was requested" test sits in the first describe, and
 * the WebGL describe that imports them is KEEP-LAST (the first describe's guard fails loudly
 * otherwise). Their factories wait on `gate`, which the first describe's last test opens only
 * after proving both chunks were asked for before either arrived (one commit, no warm-up).
 * `afterIdle` is mocked to a manual queue: tests run the idle slot and read the delay the stage
 * asked for.
 */

const h = vi.hoisted(() => {
  let openGate: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  return {
    gate,
    openGate: () => openGate(),
    importLog: [] as string[],
    probeImported: false,
    probeFacts: { context: true, software: false } as GpuFacts,
    probeModes: [] as GpuMode[],
    canvasProps: null as SceneCanvasProps | null,
    canvasMounts: 0,
    canvasThrows: false,
    directorProps: null as SceneDirectorProps | null,
    directorMounts: 0,
    idle: [] as Array<{ ms: number; run: () => void; cancelled: boolean; ran: boolean }>,
  };
});

vi.mock("@/lib/idle", () => ({
  afterIdle: (ms: number, run: () => void) => {
    const entry = { ms, run, cancelled: false, ran: false };
    h.idle.push(entry);
    return () => {
      entry.cancelled = true;
    };
  },
}));

vi.mock("@/components/three/capability", () => {
  h.probeImported = true;
  return {
    probeGpu: (mode: GpuMode) => {
      h.probeModes.push(mode);
      return h.probeFacts;
    },
  };
});

vi.mock("@/components/scene/SceneCanvas", async () => {
  h.importLog.push("canvas:requested");
  await h.gate;
  h.importLog.push("canvas:arrived");
  function SceneCanvas(props: SceneCanvasProps) {
    h.canvasProps = props;
    useEffect(() => {
      h.canvasMounts += 1;
    }, []);
    if (h.canvasThrows) throw new Error("scene chunk failed");
    return <canvas data-mock="scene-canvas" />;
  }
  return { SceneCanvas };
});

/* The stage loads its canvas through the shared 3D runtime (components/three/runtime.tsx),
   which also re-exports the intro's scene. Without this, the first import in the file would
   evaluate the real IntroScene — three.js and R3F — and eat the 1s budget of the timing
   assertions under a loaded CPU. */
vi.mock("@/components/intro/IntroScene", () => ({ IntroScene: () => null }));

vi.mock("@/components/scene/SceneDirector", async () => {
  h.importLog.push("director:requested");
  await h.gate;
  h.importLog.push("director:arrived");
  function SceneDirector(props: SceneDirectorProps) {
    h.directorProps = props;
    useEffect(() => {
      h.directorMounts += 1;
    }, []);
    return <i data-mock="scene-director" />;
  }
  return { SceneDirector };
});

/* ---- the device ------------------------------------------------------------------------ */

const media = { reduced: false, coarse: false };
const mediaListeners = new Set<() => void>();
const realMatchMedia = window.matchMedia;

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query.includes("prefers-reduced-motion: reduce")) return media.reduced;
      if (query.includes("pointer: coarse")) return media.coarse;
      return false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
    addListener: (listener: () => void) => mediaListeners.add(listener),
    removeListener: (listener: () => void) => mediaListeners.delete(listener),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function setReducedMotion(on: boolean) {
  media.reduced = on;
  act(() => mediaListeners.forEach((listener) => listener()));
}

let visibility: DocumentVisibilityState = "visible";
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** A device the stage can measure: ResizeObserver exists (the "unsupported" gate is open). */
function capableBrowser() {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function defineNavigator(key: string, value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value });
}

function seedCache(cache: { strict?: GpuFacts; forced?: GpuFacts }) {
  sessionStorage.setItem(GPU_PROBE_CACHE_KEY, JSON.stringify({ v: 1, ...cache }));
}

/** Run every idle slot the stage is still waiting for. */
function runIdle() {
  act(() => {
    for (const entry of h.idle) {
      if (entry.cancelled || entry.ran) continue;
      entry.ran = true;
      entry.run();
    }
  });
}

const pendingIdle = () => h.idle.filter((entry) => !entry.cancelled && !entry.ran);

const stage = () => document.querySelector<HTMLElement>("[data-scene-stage]")!;
const attr = (name: string) => stage().getAttribute(name);

function renderStage(children: ReactNode = <p>page</p>) {
  return render(<SceneStage>{children}</SceneStage>);
}

beforeEach(() => {
  resetIntroForTests();
  resetSceneForTests();
  sessionStorage.clear();
  localStorage.clear();
  h.idle = [];
  h.probeModes = [];
  h.probeFacts = { context: true, software: false };
  h.canvasThrows = false;
  media.reduced = false;
  media.coarse = false;
  mediaListeners.clear();
  installMatchMedia();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  defineNavigator("hardwareConcurrency", 8);
  defineNavigator("deviceMemory", undefined);
  defineNavigator("connection", undefined);
});

afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(window, "ResizeObserver");
  Reflect.deleteProperty(document, "visibilityState");
  for (const key of ["hardwareConcurrency", "deviceMemory", "connection"]) {
    Reflect.deleteProperty(navigator, key);
  }
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
});

/* ---- 1. everything before a chunk is requested ----------------------------------------- */

describe("SceneStage — gates, timing and the DOM (no 3D requested)", () => {
  beforeEach(() => {
    // KEEP-LAST guard: once a chunk is imported here, "never requested" could not fail.
    expect(h.importLog).toEqual([]);
  });

  it("renders pending and static on the server, with the track and layer of the contract", () => {
    const html = renderToString(
      <SceneStage>
        <p>page</p>
      </SceneStage>,
    );
    const host = document.createElement("div");
    host.innerHTML = html;
    const root = host.firstElementChild as HTMLElement;

    expect(root).toHaveAttribute("data-scene-stage", "");
    expect(root).toHaveAttribute("data-testid", "scene-stage");
    expect(root).toHaveAttribute("data-renderer", "pending");
    expect(root).toHaveAttribute("data-motion", "static");
    expect(root).toHaveAttribute("data-scroll-fx", "off");
    for (const name of ["data-reason", "data-tier", "data-paused", "data-boost", "data-quality", "data-morph", "data-entry", "style"]) {
      expect(root.hasAttribute(name), name).toBe(false);
    }
    expect(root.className.split(" ")).toEqual(["group/stage", "relative", "isolate"]);

    const track = root.firstElementChild as HTMLElement;
    expect(track).toHaveAttribute("aria-hidden", "true");
    expect(track.className).toContain("pointer-events-none");
    expect(track.className).toContain("absolute");
    const layer = track.firstElementChild as HTMLElement;
    expect(layer).toHaveAttribute("data-scene-layer", "");
    expect(layer.className.split(" ")).toEqual(
      expect.arrayContaining(["pointer-events-none", "sticky", "top-(--header-h)", "h-scene", "overflow-hidden"]),
    );
    expect(layer.childElementCount).toBe(0);
    expect(root.lastElementChild?.textContent).toBe("page");
  });

  it("jsdom (no ResizeObserver): fallback, unsupported — no idle wait, nothing requested", () => {
    renderStage();
    expect(attr("data-renderer")).toBe("fallback");
    expect(attr("data-reason")).toBe("unsupported");
    expect(attr("data-motion")).toBe("static");
    expect(attr("data-paused")).toBeNull();
    expect(h.idle).toEqual([]);
    expect(h.probeImported).toBe(false);
    expect(stage().querySelector("canvas")).toBeNull();
  });

  it("the off flag: off, flag — nothing waited for, probed or requested; motion still live", () => {
    capableBrowser();
    localStorage.setItem(SCENE_3D_KEY, "off");
    renderStage();
    expect(attr("data-renderer")).toBe("off");
    expect(attr("data-reason")).toBe("flag");
    expect(attr("data-motion")).toBe("live");
    expect(attr("data-tier")).toBe("high");
    expect(h.idle).toEqual([]);
    expect(h.probeImported).toBe(false);
  });

  it("reduced motion, Save-Data and a 2G connection turn it off before anything else", () => {
    capableBrowser();
    media.reduced = true;
    const reduced = renderStage();
    expect([attr("data-renderer"), attr("data-reason"), attr("data-motion")]).toEqual(["off", "reduced-motion", "static"]);
    reduced.unmount();

    media.reduced = false;
    defineNavigator("connection", { saveData: true });
    const saveData = renderStage();
    expect([attr("data-renderer"), attr("data-reason"), attr("data-motion")]).toEqual(["off", "save-data", "static"]);
    saveData.unmount();

    defineNavigator("connection", { effectiveType: "2g" });
    renderStage();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["off", "network"]);
    expect(h.idle).toEqual([]);
    expect(h.probeImported).toBe(false);
  });

  it("a low-tier device gets the art: fallback, low-tier, static motion", () => {
    capableBrowser();
    media.coarse = true;
    defineNavigator("deviceMemory", 2);
    renderStage();
    expect([attr("data-renderer"), attr("data-reason"), attr("data-tier"), attr("data-motion")]).toEqual([
      "fallback",
      "low-tier",
      "low",
      "static",
    ]);
    expect(h.idle).toEqual([]);
  });

  it("a phone that reports 4 GB is mid, not low (lib/device detectSceneTier)", () => {
    capableBrowser();
    media.coarse = true;
    defineNavigator("deviceMemory", 4);
    renderStage();
    expect([attr("data-renderer"), attr("data-tier"), attr("data-motion")]).toEqual(["pending", "mid", "live"]);
    expect(pendingIdle()).toHaveLength(1);
  });

  it("returning visit: one idle slot of IDLE_TIMEOUT_MS, then the session's answer — no probe chunk", () => {
    capableBrowser();
    seedCache({ strict: { context: true, software: true } });
    renderStage();
    expect(attr("data-renderer")).toBe("pending");
    expect(attr("data-reason")).toBeNull();
    expect(h.idle.map((entry) => entry.ms)).toEqual([SCENE_TIMING.IDLE_TIMEOUT_MS]);

    runIdle();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "software"]);
    expect(h.probeImported).toBe(false);
  });

  it("the session remembers a lost or slow scene: fallback with that reason", () => {
    capableBrowser();
    seedCache({ strict: { context: true, software: false, slow: true } });
    const slow = renderStage();
    runIdle();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "slow"]);
    slow.unmount();

    seedCache({ strict: { context: true, software: false, lost: true } });
    renderStage();
    runIdle();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "lost"]);
    expect(h.probeImported).toBe(false);
  });

  it("waits for the intro overlay to leave, then adds AFTER_INTRO_MS to the idle wait", () => {
    capableBrowser();
    seedCache({ strict: { context: true, software: true } });
    const overlay = document.createElement("div");
    overlay.id = INTRO_OVERLAY_ID;
    document.body.append(overlay);

    renderStage();
    expect(attr("data-renderer")).toBe("pending");
    expect(h.idle).toEqual([]);

    // Still attached: marking it gone is a no-op.
    act(() => markIntroGone());
    expect(h.idle).toEqual([]);

    overlay.remove();
    act(() => markIntroGone());
    expect(h.idle.map((entry) => entry.ms)).toEqual([
      SCENE_TIMING.IDLE_TIMEOUT_MS + SCENE_TIMING.AFTER_INTRO_MS,
    ]);
    runIdle();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "software"]);
  });

  it("an unmount cancels the wait; so does leaving before the intro is gone", () => {
    capableBrowser();
    const view = renderStage();
    expect(pendingIdle()).toHaveLength(1);
    view.unmount();
    expect(pendingIdle()).toHaveLength(0);

    const overlay = document.createElement("div");
    overlay.id = INTRO_OVERLAY_ID;
    document.body.append(overlay);
    const behindIntro = renderStage();
    behindIntro.unmount();
    overlay.remove();
    act(() => markIntroGone());
    expect(pendingIdle()).toHaveLength(0);
  });

  it("reduced motion switched on while waiting settles off for good; the idle slot changes nothing", () => {
    capableBrowser();
    seedCache({ strict: { context: true, software: false } });
    renderStage();
    expect(attr("data-motion")).toBe("live");

    setReducedMotion(true);
    expect([attr("data-renderer"), attr("data-reason"), attr("data-motion")]).toEqual(["off", "reduced-motion", "static"]);

    runIdle();
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["off", "reduced-motion"]);
    // Switched back: still off until a reload re-decides.
    setReducedMotion(false);
    expect(attr("data-renderer")).toBe("off");
  });

  it("toggles data-boost on the stage from the scene input store, whatever the renderer", () => {
    renderStage();
    expect(stage().hasAttribute("data-boost")).toBe(false);

    act(() => setSceneBoost("hero-primary", true));
    expect(attr("data-boost")).toBe("");
    act(() => setSceneBoost("hero-secondary", true));
    act(() => setSceneBoost("hero-primary", false));
    expect(attr("data-boost")).toBe("");
    act(() => setSceneBoost("hero-secondary", false));
    expect(stage().hasAttribute("data-boost")).toBe(false);
  });

  it("a boost already active at mount is on the stage from the start", () => {
    setSceneBoost("hero-primary", true);
    renderStage();
    expect(attr("data-boost")).toBe("");
  });

  for (const locale of ["ro", "ru", "en"] as const) {
    it(`[${locale}] around Navbar + Hero + Ticker + Directions: 8 unstyled markers, one h1, an inert text-free layer`, () => {
      vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
      render(
        <LanguageProvider initialLocale={locale}>
          <SiteContentProvider>
            <RequestFlowProvider>
              <Navbar />
              <main>
                <SceneStage>
                  <Hero />
                  <Ticker />
                  <Directions />
                </SceneStage>
              </main>
            </RequestFlowProvider>
          </SiteContentProvider>
        </LanguageProvider>,
      );

      for (const target of INTRO_REVEAL_ORDER) {
        const markers = document.querySelectorAll(`[${INTRO_REVEAL_ATTR}="${target}"]`);
        expect(markers, target).toHaveLength(1);
        expect(markers[0].hasAttribute("style"), target).toBe(false);
      }
      expect(document.querySelectorAll("h1")).toHaveLength(1);

      const layer = stage().querySelector<HTMLElement>("[data-scene-layer]")!;
      expect(stage().firstElementChild).toBe(layer.parentElement);
      expect(layer.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(layer.className).toContain("pointer-events-none");
      expect(layer.textContent).toBe("");
      expect(layer.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
      expect(["pending", "fallback"]).toContain(attr("data-renderer"));
      expect(stage().querySelector("canvas")).toBeNull();
    });
  }

  it("a session miss asks the probe chunk (strict mode) and falls back on its answer", async () => {
    capableBrowser();
    h.probeFacts = { context: false, software: false };
    renderStage();
    runIdle();
    await waitFor(() => expect(attr("data-renderer")).toBe("fallback"));
    expect(attr("data-reason")).toBe("no-context");
    expect(h.probeImported).toBe(true);
    expect(h.probeModes).toEqual(["strict"]);
  });

  it("the force flag accepts a software renderer: BOTH chunks are requested before either arrives", async () => {
    capableBrowser();
    localStorage.setItem(SCENE_3D_KEY, "force");
    seedCache({ forced: { context: true, software: true } });
    renderStage();
    runIdle();
    // Accepted: the stage now asks for both chunks (held at the gate, so nothing arrives).
    await waitFor(() => expect(h.importLog).toContain("canvas:requested"));
    expect(h.probeModes).toEqual([]);
    expect(attr("data-renderer")).toBe("pending");
    expect(h.importLog).toEqual(expect.arrayContaining(["canvas:requested", "director:requested"]));
    expect(h.importLog.some((entry) => entry.endsWith(":arrived"))).toBe(false);
    cleanup();
    // Only now may the chunks arrive (the WebGL describe below starts from here).
    h.openGate();
    await waitFor(() => expect(h.importLog.filter((e) => e.endsWith(":arrived"))).toHaveLength(2));
  });
});

/* ---- 2. the WebGL path (KEEP LAST: imports the mocked chunks) --------------------------- */

describe("SceneStage — the WebGL path", () => {
  beforeEach(() => {
    h.canvasProps = null;
    h.directorProps = null;
    h.canvasMounts = 0;
    h.directorMounts = 0;
  });

  /** A returning visit on a capable device, up to both halves mounted. */
  async function loadScene(cache: { strict?: GpuFacts; forced?: GpuFacts } = { strict: { context: true, software: false } }) {
    capableBrowser();
    seedCache(cache);
    const view = renderStage();
    runIdle();
    await waitFor(() => {
      expect(h.canvasMounts).toBe(1);
      expect(h.directorMounts).toBe(1);
    });
    return view;
  }

  const canvas = () => stage().querySelector('[data-mock="scene-canvas"]');

  it("mounts both halves in the layer; webgl only after onReady AND onLive, for the same attempt", async () => {
    await loadScene();
    const layer = stage().querySelector("[data-scene-layer]")!;
    expect(layer.querySelector('[data-mock="scene-canvas"]')).not.toBeNull();
    expect(layer.querySelector('[data-mock="scene-director"]')).not.toBeNull();
    expect(canvas()?.parentElement?.className).toContain("group-data-[renderer=webgl]/stage:opacity-100");

    const props = h.canvasProps!;
    expect(props).toMatchObject({ tier: "high", force3d: false, paused: false });
    expect(h.directorProps!.probe).toBe(props.probe);
    expect(h.directorProps!.stage.current).toBe(stage());
    expect([attr("data-renderer"), attr("data-tier")]).toEqual(["pending", "high"]);

    act(() => props.onReady());
    expect(attr("data-renderer")).toBe("pending");
    act(() => h.directorProps!.onLive());
    expect(attr("data-renderer")).toBe("webgl");
    expect(attr("data-reason")).toBeNull();
    expect(attr("data-paused")).toBe("false");
    expect(attr("data-scroll-fx")).toBe("off");
  });

  it("a session miss probes, then loads", async () => {
    capableBrowser();
    renderStage();
    runIdle();
    await waitFor(() => expect(h.canvasMounts).toBe(1));
    expect(h.probeModes).toEqual(["strict"]);
  });

  it("a forced low-tier device draws with the mid budget: data-tier and the canvas tier are mid", async () => {
    media.coarse = true;
    defineNavigator("deviceMemory", 2);
    localStorage.setItem(SCENE_3D_KEY, "force");
    await loadScene({ forced: { context: true, software: true } });
    expect(h.canvasProps).toMatchObject({ tier: "mid", force3d: true });
    expect(attr("data-tier")).toBe("mid");
    expect(attr("data-motion")).toBe("static");
  });

  it("pauses while covered, while the tab is hidden and while the stage is off screen", async () => {
    let report: (visible: boolean) => void = () => {};
    const realObserver = window.IntersectionObserver;
    window.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        report = (visible) =>
          callback([{ isIntersecting: !visible } as IntersectionObserverEntry, { isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    try {
      await loadScene();
      act(() => h.canvasProps!.onReady());
      act(() => h.directorProps!.onLive());
      expect(attr("data-paused")).toBe("false");

      let release = () => {};
      act(() => {
        release = coverPage();
      });
      try {
        expect(attr("data-paused")).toBe("true");
        expect(h.canvasProps!.paused).toBe(true);
      } finally {
        act(() => release());
      }
      expect(attr("data-paused")).toBe("false");

      setVisibility("hidden");
      expect(attr("data-paused")).toBe("true");
      setVisibility("visible");
      expect(attr("data-paused")).toBe("false");

      // The newest entry of a batch wins.
      act(() => report(false));
      expect(attr("data-paused")).toBe("true");
      expect(h.canvasProps!.paused).toBe(true);
      act(() => report(true));
      expect(attr("data-paused")).toBe("false");
    } finally {
      cleanup();
      window.IntersectionObserver = realObserver;
    }
  });

  it("writes data-quality, data-morph and data-entry straight to the DOM, and drops them with the scene", async () => {
    await loadScene();
    const props = h.canvasProps!;
    // Nothing about the services entrance until the scene reports it.
    expect(stage().hasAttribute("data-entry")).toBe(false);
    act(() => props.onQuality("dpr"));
    act(() => props.onMorph(true));
    act(() => props.onEntry("idle"));
    expect([attr("data-quality"), attr("data-morph"), attr("data-entry")]).toEqual(["dpr", "running", "idle"]);
    act(() => props.onMorph(false));
    act(() => props.onQuality("lite"));
    act(() => props.onEntry("burst"));
    expect([attr("data-quality"), attr("data-morph"), attr("data-entry")]).toEqual(["lite", "idle", "burst"]);
    act(() => props.onEntry("formed"));
    expect(attr("data-entry")).toBe("formed");

    // The fallback the scene fell back to never carries the entrance.
    act(() => props.onBail());
    expect(attr("data-renderer")).toBe("fallback");
    expect(stage().hasAttribute("data-quality")).toBe(false);
    expect(stage().hasAttribute("data-morph")).toBe(false);
    expect(stage().hasAttribute("data-entry")).toBe(false);
  });

  it("writes data-helix for the spiral and the ambient helix only, straight to the DOM, and drops it with the scene", async () => {
    await loadScene();
    const props = h.canvasProps!;
    // Built is not a mode: the cards are still as the server rendered them.
    act(() => props.onHelix("built"));
    expect(stage().hasAttribute("data-helix")).toBe(false);
    act(() => props.onHelix("spiral"));
    expect(attr("data-helix")).toBe("spiral");
    act(() => props.onHelix("ambient"));
    expect(attr("data-helix")).toBe("ambient");
    // Off (the driver restored the cards): gone.
    act(() => props.onHelix("off"));
    expect(stage().hasAttribute("data-helix")).toBe(false);
    act(() => props.onHelix("spiral"));
    expect(attr("data-helix")).toBe("spiral");

    // The fallback the scene fell back to never carries it (whatever the driver reported last).
    act(() => props.onLost());
    expect(attr("data-renderer")).toBe("fallback");
    expect(stage().hasAttribute("data-helix")).toBe(false);
  });

  it("a governor bail marks the session slow: fallback, slow, static motion, the scene gone", async () => {
    await loadScene();
    act(() => h.canvasProps!.onReady());
    act(() => h.directorProps!.onLive());
    act(() => h.canvasProps!.onBail());

    expect([attr("data-renderer"), attr("data-reason"), attr("data-motion")]).toEqual(["fallback", "slow", "static"]);
    expect(attr("data-paused")).toBeNull();
    expect(canvas()).toBeNull();
    expect(readGpuFacts("strict")).toMatchObject({ context: true, software: false, slow: true });
  });

  it("a context lost while visible marks the session lost (forced mode marks forced)", async () => {
    localStorage.setItem(SCENE_3D_KEY, "force");
    await loadScene({ forced: { context: true, software: true } });
    act(() => h.canvasProps!.onLost());

    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "lost"]);
    expect(canvas()).toBeNull();
    expect(readGpuFacts("forced")).toMatchObject({ lost: true });
    expect(readGpuFacts("strict")).toBeNull();
  });

  it("a context lost in a hidden tab goes back to pending and remounts once, when the tab is visible", async () => {
    await loadScene();
    act(() => h.canvasProps!.onReady());
    act(() => h.directorProps!.onLive());
    expect(attr("data-renderer")).toBe("webgl");

    setVisibility("hidden");
    act(() => h.canvasProps!.onLost());
    expect(attr("data-renderer")).toBe("pending");
    expect(canvas()).toBeNull();
    // Frames keep coming in jsdom; the remount still waits for a visible tab.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(canvas()).toBeNull();

    setVisibility("visible");
    await waitFor(() => expect(h.canvasMounts).toBe(2));
    expect(h.directorMounts).toBe(2);
    expect(attr("data-renderer")).toBe("pending");
    expect(readGpuFacts("strict")?.lost).toBeUndefined();

    act(() => h.canvasProps!.onReady());
    act(() => h.directorProps!.onLive());
    expect(attr("data-renderer")).toBe("webgl");

    // One remount only: the next loss, hidden or not, is final for the session.
    setVisibility("hidden");
    act(() => h.canvasProps!.onLost());
    expect([attr("data-renderer"), attr("data-reason")]).toEqual(["fallback", "lost"]);
    expect(canvas()).toBeNull();
    expect(readGpuFacts("strict")).toMatchObject({ lost: true });
    setVisibility("visible");
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(h.canvasMounts).toBe(2);
  });

  it("a render error in the scene: fallback, error — and no session mark", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    h.canvasThrows = true;
    capableBrowser();
    seedCache({ strict: { context: true, software: false } });
    renderStage();
    runIdle();
    await waitFor(() => expect(attr("data-renderer")).toBe("fallback"));
    expect(attr("data-reason")).toBe("error");
    expect(canvas()).toBeNull();
    expect(readGpuFacts("strict")).toEqual({ context: true, software: false });
    consoleError.mockRestore();
  });

  it("reduced motion switched on mid-scene: off, and both halves unmount", async () => {
    await loadScene();
    act(() => h.canvasProps!.onReady());
    act(() => h.directorProps!.onLive());
    act(() => h.canvasProps!.onEntry("formed"));
    act(() => h.canvasProps!.onHelix("spiral"));

    setReducedMotion(true);
    expect([attr("data-renderer"), attr("data-reason"), attr("data-motion")]).toEqual(["off", "reduced-motion", "static"]);
    expect(stage().hasAttribute("data-entry")).toBe(false);
    expect(stage().hasAttribute("data-helix")).toBe(false);
    expect(stage().querySelector('[data-mock="scene-director"]')).toBeNull();
    expect(canvas()).toBeNull();
  });

  it("the chunks were requested only by the flows above, each once", () => {
    expect(h.importLog.filter((entry) => entry.endsWith(":requested")).sort()).toEqual([
      "canvas:requested",
      "director:requested",
    ]);
  });
});
