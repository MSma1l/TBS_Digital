"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { RenderErrorBoundary } from "@/components/three/RenderErrorBoundary";
import { detectSceneTier, readDeviceProfile } from "@/lib/device";
import { afterIdle } from "@/lib/idle";
import { isIntroOnScreen, onIntroGone } from "@/lib/intro";
import {
  SCENE_ATTR,
  SCENE_TESTID,
  SCENE_TIMING,
  createScrollProbe,
  decideWebGL,
  markGpu,
  readGpuFacts,
  readMotionGate,
  readSceneFlag,
  readSceneInput,
  reasonFor,
  subscribeSceneInput,
  type GpuFacts,
  type GpuMode,
  type MotionGate,
  type SceneEntry,
  type SceneHelix,
  type SceneMotion,
  type SceneQuality,
  type SceneReason,
  type SceneRenderer,
  type SceneTier,
} from "@/lib/scene";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { REDUCED_MOTION_QUERY } from "@/lib/tilt";

/*
 * The two heavy halves, each its own async chunk: three.js + R3F (the scene) and GSAP +
 * ScrollTrigger (the director). They mount in the SAME commit, so both requests start
 * together; there is no warm-up `import()` (it would give Turbopack another chunk group).
 * The scene comes through the shared 3D runtime module, the same `import()` target the intro
 * uses, so a first visitor who already downloaded three.js for the intro gets it from cache
 * (components/three/runtime.tsx).
 */
const SceneCanvas = dynamic(() => import("@/components/three/runtime").then((m) => m.SceneCanvas), {
  ssr: false,
});
const SceneDirector = dynamic(() => import("./SceneDirector").then((m) => m.SceneDirector), {
  ssr: false,
});

/**
 * Where the stage is in its one-way pipeline. `webgl` is not a phase: it is `loading` with a
 * scene that reported ready AND a director that measured, for the same attempt.
 */
type Phase =
  /** Server render and hydration: nothing decided yet. */
  | { kind: "boot" }
  /** The gates passed; waiting for the intro to leave, an idle slot and the GPU answer. */
  | { kind: "waiting" }
  /** The scene and the director are mounted (attempt n: remounts get a fresh key). */
  | { kind: "loading"; attempt: number }
  /** The context was lost while the tab was hidden; remount once it is visible. */
  | { kind: "retry"; attempt: number }
  | { kind: "fallback"; reason: SceneReason }
  | { kind: "off"; reason: SceneReason };

type StageState = {
  phase: Phase;
  /** `detectSceneTier`, once on the client. */
  tier?: SceneTier;
  motion: SceneMotion;
  /** `tbs_scene_3d=force`: no caveat, software renderers and the low tier allowed, no bail. */
  force: boolean;
};

const SERVER_STATE: StageState = { phase: { kind: "boot" }, motion: "static", force: false };

/** A rejected warm-up import is not a failure: the real `import()` below reports for itself. */
const noop = () => {};

/** The live gates' answer, as a settled phase (null when every gate is open). */
function gatePhase(gate: MotionGate): Phase | null {
  if (gate === "ok") return null;
  if (gate === "unsupported") return { kind: "fallback", reason: "unsupported" };
  return { kind: "off", reason: gate };
}

/* `document.visibilityState` as a store; the server (and hydration) says visible. */
const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
const readTabHidden = () => document.visibilityState === "hidden";
const serverFalse = () => false;

/* "Is this render on the client, outside hydration?" — a store that never changes, read only to
   tell the two apart: React answers from the server snapshot while it hydrates server HTML and
   from the client one for a fresh client mount (a navigation from another page, a Back). */
const subscribeNothing = () => () => {};
const clientTrue = () => true;

/**
 * Everything the stage can know synchronously on the client: the QA flag, the device tier and
 * the live gates. `waiting` when none of them settles it — the GPU answer is still to come.
 */
function readEntry(): StageState {
  const flag = readSceneFlag();
  const tier = detectSceneTier(readDeviceProfile());
  const gate = readMotionGate();
  const force = flag === "force";
  const motion: SceneMotion = gate === "ok" && tier !== "low" ? "live" : "static";
  const settled: Phase | null =
    flag === "off"
      ? { kind: "off", reason: "flag" }
      : (gatePhase(gate) ??
        (tier === "low" && !force ? { kind: "fallback", reason: "low-tier" } : null));
  return { phase: settled ?? { kind: "waiting" }, tier, motion, force };
}

/**
 * The interior stage: one wrapper around Hero → Ticker → Directions → Work whose first child is
 * an absolutely positioned track holding a sticky layer. The layer is where the one WebGL
 * canvas draws, stuck under the header while the four sections scroll over it; the track
 * has no layout height, so every section offset stays exactly where it was.
 *
 * Paint order: the track is positioned and first in tree order, so every positioned section
 * after it paints on top. `isolate` keeps whatever the stage stacks below the header, the
 * burger overlay and the cookie banner — and makes the stage the stacking context of Work's
 * spiral: a sticky card the scene gives a negative `z-index` paints in the stage's negative
 * layer, under the canvas track, and one with a positive `z-index` over it (real depth round
 * the helix). No transform, filter, contain or overflow may ever go on the stage, an ancestor
 * of the layer or an ancestor of Work's cards — any of them breaks `sticky` (or that depth).
 *
 * Loading (never a static import of three.js, R3F or GSAP — eslint.config.mjs):
 *  1. on mount: the QA flag, the device tier and the live gates. `tbs_scene_3d=off` → off;
 *     no ResizeObserver → fallback; reduced motion / Save-Data / 2G → off; the low tier →
 *     fallback (unless forced). `data-motion` is `live` only with every gate open and a tier
 *     above low — the CSS motion (holograms) keys off it;
 *  2. under an intro, at `WARM_MS`, the two chunks are fetched behind the film — never the
 *     context, never a probe (see the effect). Then, once the overlay has left, `afterIdle`
 *     (a warmed stage waits only for R3F to release the intro's context; an unwarmed one also
 *     takes the settle) and the GPU facts: the session's cached answer, else the probe chunk;
 *  3. WebGL decided → the scene and the director mount; `data-renderer="webgl"` once the
 *     scene compiled and drew (`onReady`) and the director measured (`onLive`) — the art
 *     crossfades out over 500ms (CSS);
 *  4. at runtime: reduced motion switched on → off; a context lost while visible or a
 *     governor bail → fallback for the rest of the session (`markGpu`); lost while hidden
 *     (iOS backgrounding) → pending, one remount when visible; a render error → fallback.
 *
 * Paused (`frameloop="never"`, context kept) while the stage is off screen, the tab hidden
 * or something full-screen covers the page (burger, intro, dialog). `data-boost`,
 * `data-quality`, `data-morph`, `data-entry`, `data-helix` (and the director's `data-scroll-fx`)
 * are written straight to the DOM, never through React state. `data-entry` (`idle|burst|formed`,
 * the services entrance as the ready scene draws it) and `data-helix` (`spiral|ambient`, the
 * Work helix's mode while the scene's driver lays the cards out or draws the small helix) exist
 * only while a scene is mounted: the fallback and off stages never carry them, and Work's cards
 * are then exactly as the server rendered them.
 */
export function SceneStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [probe] = useState(createScrollProbe);
  /*
   * A stage that hydrates starts where the server left it, `boot` (`pending`), and decides in
   * the effect below. A stage that MOUNTS on the client — a navigation from another page — starts
   * from the gates' answer instead. `pending` is what raises the full-window loading cover
   * (components/ui/PageLoading.module.css), and the cover now comes up in one frame: a stage the
   * gates settle (the off flag, reduced motion, Save-Data, a low-tier phone) would otherwise
   * raise it for the one frame before its effect, then fade it out — a loading flash on every
   * click for exactly the devices that have nothing to load.
   *
   * The gates are read ONCE per mount: here for a client mount (`mountEntry`), in the effect for
   * a hydrated one. Read in both places, a gate that closed between the render and the effect
   * (reduced motion switched on, a connection dropping to 2G) left the state at the render's
   * `waiting` while the effect, reading it settled, skipped the pipeline — `pending`, and the
   * cover, for good. A gate that closes after the one read is still caught: `decide()` reads it
   * again when its idle slot fires.
   */
  const clientMount = useSyncExternalStore(subscribeNothing, clientTrue, serverFalse);
  const [mountEntry] = useState(() => (clientMount ? readEntry() : null));
  const [state, setState] = useState<StageState>(() => mountEntry ?? SERVER_STATE);
  /* The attempt whose scene reported ready / whose director measured. */
  const [readyAttempt, setReadyAttempt] = useState(-1);
  const [liveAttempt, setLiveAttempt] = useState(-1);
  const [onscreen, setOnscreen] = useState(true);
  /*
   * Has the stage left the window since it mounted? The full-window loading cover
   * (components/ui/PageLoading.module.css) hides a stage that is still deciding — and one the
   * visitor has scrolled away from, or been sent away from (a `/#echipa` link from a service
   * page lands BELOW the stage), is in front of nobody. Worse, an off-screen stage is paused, so
   * it never draws its first frame and never answers: the cover stayed up until its 6s failsafe.
   * So `data-cover` holds the cover only until the first time the stage is off screen, and never
   * again in this mount — scrolling back into a stage that is still deciding shows it as a late
   * arrival, the way every visit after an intro already does.
   */
  const [leftScreen, setLeftScreen] = useState(false);
  const tabHidden = useSyncExternalStore(subscribeVisibility, readTabHidden, serverFalse);
  const covered = useSyncExternalStore(subscribePageCover, isPageCovered, serverFalse);

  // ---- the pipeline ------------------------------------------------------------------
  useEffect(() => {
    const entry = mountEntry ?? readEntry();
    const { force } = entry;
    // Intentional post-mount setState: the server knows neither the device nor the visitor's
    // settings, so a hydrated stage renders "pending" there and decides here, once. A stage
    // that mounted on the client already holds this answer (`mountEntry`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!mountEntry) setState(entry);
    if (entry.phase.kind !== "waiting") return;

    const mode: GpuMode = force ? "forced" : "strict";
    let cancelled = false;
    let cancelIdle = () => {};

    const decide = (facts: GpuFacts) => {
      if (cancelled) return;
      const next: Phase =
        gatePhase(readMotionGate()) ??
        (decideWebGL(facts, force)
          ? { kind: "loading", attempt: 0 }
          : { kind: "fallback", reason: reasonFor(facts, force) ?? "no-context" });
      // Only from "waiting": a runtime transition (reduced motion) may have settled it already.
      setState((s) => (s.phase.kind === "waiting" ? { ...s, phase: next } : s));
    };

    const overlay = isIntroOnScreen();

    /*
     * WHILE THE INTRO PLAYS, THE STAGE GETS READY BEHIND IT — but only as far as it safely can.
     *
     * Everything here is network and parse: the shared 3D runtime (already in cache if the intro
     * took the WebGL path, since both reach three.js through the same `import()` target) and the
     * director's own chunk, which is GSAP + ScrollTrigger and is NOT shared — Turbopack gives
     * each `import()` target its own chunk group. On the measured load that download, the probe
     * and the mount together cost 2.4s AFTER the overlay had already gone.
     *
     * What is deliberately NOT done here is the WebGL context and the shader compile. The intro
     * is drawing its own scene until the end of the burst, and a compile stall there lands on the
     * frames of the film the whole opening is built around. That part still waits for the overlay
     * to leave, and for R3F to hand the context back.
     *
     * The GPU answer is READ, never probed: the intro's own capability probe wrote it to the
     * tab's session cache (components/three/capability.ts). No cached answer means either a QA
     * flag put the two on different modes or the intro never probed — and a second live context
     * under the film to find out is exactly what this is trying to avoid, so it warms nothing and
     * the old path runs unchanged. A device the answer sends to the static art warms nothing
     * either: it is never going to load either chunk.
     */
    let warmed = false;
    let cancelWarm = () => {};
    if (overlay) {
      cancelWarm = afterIdle(SCENE_TIMING.WARM_MS, () => {
        const facts = readGpuFacts(mode);
        if (cancelled || !facts || !decideWebGL(facts, force)) return;
        warmed = true;
        void import("@/components/three/runtime").catch(noop);
        void import("./SceneDirector").catch(noop);
      });
    }

    const stopWaitingForIntro = onIntroGone(() => {
      if (cancelled) return;
      cancelWarm();
      /*
       * A WARMED STAGE HAS ONE THING LEFT TO WAIT FOR, and it is not the idle slot. The 1500ms
       * settle is there so the chunk requests never compete with the first paint, hydration or a
       * first tap — none of which is still happening eight seconds into a visit spent watching a
       * film. What remains is the one real constraint: R3F releases the intro's context 500ms
       * after its canvas unmounts, and two scenes must never hold one at the same time.
       */
      const delay = warmed
        ? SCENE_TIMING.AFTER_INTRO_MS
        : SCENE_TIMING.IDLE_TIMEOUT_MS + (overlay ? SCENE_TIMING.AFTER_INTRO_MS : 0);
      cancelIdle = afterIdle(delay, () => {
        const cached = readGpuFacts(mode);
        if (cached) {
          decide(cached);
          return;
        }
        import("@/components/three/capability").then(
          ({ probeGpu }) => {
            if (!cancelled) decide(probeGpu(mode));
          },
          () => {
            if (cancelled) return;
            setState((s) =>
              s.phase.kind === "waiting" ? { ...s, phase: { kind: "fallback", reason: "error" } } : s,
            );
          },
        );
      });
    });

    return () => {
      cancelled = true;
      stopWaitingForIntro();
      cancelWarm();
      cancelIdle();
    };
    // `mountEntry` is state without a setter: it never changes, so this still runs once.
  }, [mountEntry]);

  // Reduced motion switched on mid-visit: everything stops, for good (a reload re-decides).
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => {
      if (!query.matches) return;
      setState((s) =>
        s.phase.kind === "off"
          ? { ...s, motion: "static" }
          : { ...s, motion: "static", phase: { kind: "off", reason: "reduced-motion" } },
      );
    };
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const { phase } = state;
  const attempt = phase.kind === "loading" || phase.kind === "retry" ? phase.attempt : -1;
  const loading = phase.kind === "loading";
  const retrying = phase.kind === "retry";

  // A context lost in a hidden tab: remount when the visitor comes back.
  useEffect(() => {
    if (!retrying) return;
    const resume = () => {
      if (document.visibilityState === "hidden") return;
      setState((s) =>
        s.phase.kind === "retry"
          ? { ...s, phase: { kind: "loading", attempt: s.phase.attempt + 1 } }
          : s,
      );
    };
    document.addEventListener("visibilitychange", resume);
    // Already visible again by the time this commit landed (rAF never runs in a hidden tab).
    const frame = window.requestAnimationFrame(resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.cancelAnimationFrame(frame);
    };
  }, [retrying]);

  // Stage on screen? The newest entry wins (several can arrive in one batch).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof window.IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const newest = entries[entries.length - 1];
      if (!newest) return;
      setOnscreen(newest.isIntersecting);
      if (!newest.isIntersecting) setLeftScreen(true);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A hero CTA hovered or focused → `data-boost` (the art's light wave keys off it).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const write = () => el.toggleAttribute(SCENE_ATTR.boost, readSceneInput().boost === 1);
    write();
    return subscribeSceneInput(write);
  }, []);

  // The scene's quality, morph, entry and helix reports belong to the scene that made them.
  useEffect(() => {
    const el = stageRef.current;
    if (!loading || !el) return;
    return () => {
      el.removeAttribute(SCENE_ATTR.quality);
      el.removeAttribute(SCENE_ATTR.morph);
      el.removeAttribute(SCENE_ATTR.entry);
      el.removeAttribute(SCENE_ATTR.helix);
    };
  }, [loading, attempt]);

  // ---- callbacks from the scene, the director and the boundary (all for `attempt`) -----
  const { force } = state;
  const mode: GpuMode = force ? "forced" : "strict";

  /** Leave `loading` for `next`, unless this attempt is no longer the one mounted. */
  const leave = useCallback(
    (next: Phase, motion?: SceneMotion) =>
      setState((s) =>
        s.phase.kind === "loading" && s.phase.attempt === attempt
          ? { ...s, phase: next, motion: motion ?? s.motion }
          : s,
      ),
    [attempt],
  );

  const onReady = useCallback(() => setReadyAttempt(attempt), [attempt]);
  const onLive = useCallback(() => setLiveAttempt(attempt), [attempt]);

  const onLost = useCallback(() => {
    // The first scene lost in a background tab gets one remount; a second loss is the device's answer.
    if (attempt === 0 && document.visibilityState === "hidden") {
      leave({ kind: "retry", attempt });
      return;
    }
    markGpu("lost", mode);
    leave({ kind: "fallback", reason: "lost" });
  }, [attempt, leave, mode]);

  const onBail = useCallback(() => {
    markGpu("slow", mode);
    leave({ kind: "fallback", reason: "slow" }, "static");
  }, [leave, mode]);

  const onError = useCallback(() => leave({ kind: "fallback", reason: "error" }), [leave]);

  const onQuality = useCallback((step: SceneQuality) => {
    stageRef.current?.setAttribute(SCENE_ATTR.quality, step);
  }, []);

  const onMorph = useCallback((running: boolean) => {
    stageRef.current?.setAttribute(SCENE_ATTR.morph, running ? "running" : "idle");
  }, []);

  const onEntry = useCallback((entry: SceneEntry) => {
    stageRef.current?.setAttribute(SCENE_ATTR.entry, entry);
  }, []);

  // Only a mode that changes the page is on the stage: `built` and `off` say nothing is laid out.
  const onHelix = useCallback((helix: SceneHelix) => {
    const el = stageRef.current;
    if (!el) return;
    if (helix === "spiral" || helix === "ambient") el.setAttribute(SCENE_ATTR.helix, helix);
    else el.removeAttribute(SCENE_ATTR.helix);
  }, []);

  // ---- render --------------------------------------------------------------------------
  const webgl = loading && readyAttempt === attempt && liveAttempt === attempt;
  const renderer: SceneRenderer = webgl
    ? "webgl"
    : phase.kind === "fallback" || phase.kind === "off"
      ? phase.kind
      : "pending";
  const reason = phase.kind === "fallback" || phase.kind === "off" ? phase.reason : undefined;
  const paused = !onscreen || tabHidden || covered;
  // A forced low-tier device draws with the mid tier's budget.
  const canvasTier = state.tier === "high" ? "high" : "mid";
  const tier = loading || retrying ? canvasTier : state.tier;

  return (
    <div
      ref={stageRef}
      data-scene-stage=""
      data-testid={SCENE_TESTID.stage}
      data-renderer={renderer}
      data-cover={renderer === "pending" && !leftScreen ? "" : undefined}
      data-reason={reason}
      data-tier={tier}
      data-paused={renderer === "webgl" ? String(paused) : undefined}
      data-motion={state.motion}
      data-scroll-fx="off"
      className="group/stage relative isolate"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          data-scene-layer=""
          className="pointer-events-none sticky top-(--header-h) h-scene w-full overflow-hidden"
        >
          {loading && (
            <RenderErrorBoundary key={attempt} onError={onError}>
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-data-[renderer=webgl]/stage:opacity-100 motion-reduce:transition-none">
                <SceneCanvas
                  tier={canvasTier}
                  force3d={force}
                  paused={paused}
                  probe={probe}
                  onReady={onReady}
                  onLost={onLost}
                  onBail={onBail}
                  onQuality={onQuality}
                  onMorph={onMorph}
                  onEntry={onEntry}
                  onHelix={onHelix}
                />
              </div>
              <SceneDirector stage={stageRef} probe={probe} onLive={onLive} />
            </RenderErrorBoundary>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
