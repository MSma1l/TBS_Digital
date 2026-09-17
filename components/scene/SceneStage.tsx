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

/**
 * The interior stage: one wrapper around Hero → Ticker → Directions whose first child is an
 * absolutely positioned track holding a sticky layer. The layer is where the one WebGL
 * canvas draws, stuck under the header while the three sections scroll over it; the track
 * has no layout height, so every section offset stays exactly where it was.
 *
 * Paint order: the track is positioned and first in tree order, so every positioned section
 * after it paints on top. `isolate` keeps whatever the stage stacks below the header, the
 * burger overlay and the cookie banner. No transform, filter, contain or overflow may ever
 * go on the stage or an ancestor of the layer — any of them breaks `sticky`.
 *
 * Loading (never a static import of three.js, R3F or GSAP — eslint.config.mjs):
 *  1. on mount: the QA flag, the device tier and the live gates. `tbs_scene_3d=off` → off;
 *     no ResizeObserver → fallback; reduced motion / Save-Data / 2G → off; the low tier →
 *     fallback (unless forced). `data-motion` is `live` only with every gate open and a tier
 *     above low — the CSS motion (holograms) keys off it;
 *  2. once the intro overlay has left, `afterIdle` (+ the time R3F takes to release the
 *     intro's context), the GPU facts: the session's cached answer, else the probe chunk;
 *  3. WebGL decided → the scene and the director mount; `data-renderer="webgl"` once the
 *     scene compiled and drew (`onReady`) and the director measured (`onLive`) — the art
 *     crossfades out over 500ms (CSS);
 *  4. at runtime: reduced motion switched on → off; a context lost while visible or a
 *     governor bail → fallback for the rest of the session (`markGpu`); lost while hidden
 *     (iOS backgrounding) → pending, one remount when visible; a render error → fallback.
 *
 * Paused (`frameloop="never"`, context kept) while the stage is off screen, the tab hidden
 * or something full-screen covers the page (burger, intro, dialog). `data-boost`,
 * `data-quality`, `data-morph`, `data-entry` (and the director's `data-scroll-fx`) are written
 * straight to the DOM, never through React state. `data-entry` (`idle|burst|formed`, the
 * services entrance as the ready scene draws it) exists only while a scene is mounted: the
 * fallback and off stages never carry it.
 */
export function SceneStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [probe] = useState(createScrollProbe);
  const [state, setState] = useState<StageState>(SERVER_STATE);
  /* The attempt whose scene reported ready / whose director measured. */
  const [readyAttempt, setReadyAttempt] = useState(-1);
  const [liveAttempt, setLiveAttempt] = useState(-1);
  const [onscreen, setOnscreen] = useState(true);
  const tabHidden = useSyncExternalStore(subscribeVisibility, readTabHidden, serverFalse);
  const covered = useSyncExternalStore(subscribePageCover, isPageCovered, serverFalse);

  // ---- the pipeline ------------------------------------------------------------------
  useEffect(() => {
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
    // Intentional post-mount setState: the server knows neither the device nor the visitor's
    // settings, so the stage renders "pending" there and decides here, once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ phase: settled ?? { kind: "waiting" }, tier, motion, force });
    if (settled) return;

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
    const stopWaitingForIntro = onIntroGone(() => {
      if (cancelled) return;
      const delay = SCENE_TIMING.IDLE_TIMEOUT_MS + (overlay ? SCENE_TIMING.AFTER_INTRO_MS : 0);
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
      cancelIdle();
    };
  }, []);

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
      if (newest) setOnscreen(newest.isIntersecting);
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

  // The scene's quality, morph and entry reports belong to the scene that made them.
  useEffect(() => {
    const el = stageRef.current;
    if (!loading || !el) return;
    return () => {
      el.removeAttribute(SCENE_ATTR.quality);
      el.removeAttribute(SCENE_ATTR.morph);
      el.removeAttribute(SCENE_ATTR.entry);
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
