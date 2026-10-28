/**
 * The interior 3D stage contract — names, storage, the renderer decision and the scroll probe,
 * shared by the stage, the scene chunk and the E2E helpers. Since 2026-10-28 the stage wraps
 * only Work (its DNA helix is the site's one WebGL scene): Hero, Ticker and Directions draw
 * static SVG art and the service pages have no stage, so nothing on the page feeds the scene
 * any more — the old page → scene input store (CTA boost, selected direction, service step) and
 * the hero / services / service-page anchors are gone.
 *
 * Deliberately NOT a `"use client"` module and nothing touches the DOM at import: server
 * components import constants from it, and `e2e/helpers.ts` imports it into Node. Every
 * function that needs `window` checks for it first and is a quiet no-op on the server.
 */

import type { RefObject } from "react";

/* ---- QA switch ----------------------------------------------------------------------- */

/**
 * `localStorage[SCENE_3D_KEY]`: `"force"` drops `failIfMajorPerformanceCaveat`, the software
 * renderer check, the low-tier gate and the FPS bail (SwiftShader in headless Chromium gets
 * WebGL); `"off"` keeps the stage on nothing at all.
 */
export const SCENE_3D_KEY = "tbs_scene_3d";
export type SceneFlag = "force" | "off" | null;

export function readSceneFlag(): SceneFlag {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(SCENE_3D_KEY);
    return value === "force" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

/* ---- GPU probe cache ----------------------------------------------------------------- */

/* The cache and the WebGL decision live in lib/gpuProbe.ts (import-free, so the intro's
   capability chunk stays small); they are part of this contract all the same. */
export {
  GPU_PROBE_CACHE_KEY,
  decideWebGL,
  markGpu,
  parseGpuProbeCache,
  readGpuFacts,
  reasonFor,
  writeGpuFacts,
  type GpuFacts,
  type GpuMode,
  type GpuProbeCache,
} from "./gpuProbe";

/* ---- renderer state and gates -------------------------------------------------------- */

export type SceneRenderer = "pending" | "webgl" | "fallback" | "off";
export type SceneReason =
  | "flag"
  | "reduced-motion"
  | "save-data"
  | "network"
  | "unsupported"
  | "low-tier"
  | "software"
  | "no-context"
  | "lost"
  | "slow"
  | "error";

/** The live, never-cached gates in front of any probe, in the intro probe's order. */
export type MotionGate = "ok" | "unsupported" | "reduced-motion" | "save-data" | "network";

type NavigatorConnection = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};

/**
 * Client only. `unsupported` without `ResizeObserver` (jsdom, the server — answered before
 * anything else, so no test ever needs a WebGL mock), then reduced motion, then Save-Data,
 * then a 2G connection.
 */
export function readMotionGate(): MotionGate {
  if (typeof window === "undefined" || typeof window.ResizeObserver === "undefined") {
    return "unsupported";
  }
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "reduced-motion";
  }
  const connection = (navigator as NavigatorConnection).connection;
  if (connection?.saveData) return "save-data";
  if (connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g") {
    return "network";
  }
  return "ok";
}

export type SceneTier = "high" | "mid" | "low";
export type SceneMotion = "live" | "static";
export type SceneQuality = "full" | "dpr" | "lite";
/**
 * The Work helix's mode, as the spiral driver applies it: `spiral` (the project cards turn round
 * the helix, sticky, laid out inline), `ambient` (a small helix in the band above the heading; the
 * grid or band stays as it is) or `off` (the page as the server rendered it).
 */
export type SceneHelixMode = "off" | "spiral" | "ambient";
/**
 * What the scene reports about the helix: `built` once its model compiled (just before ready is
 * armed: the helix IS the staged scene), then each mode.
 */
export type SceneHelix = SceneHelixMode | "built";

/* ---- DOM contract -------------------------------------------------------------------- */

export const SCENE_TESTID = {
  stage: "scene-stage",
} as const;

export const SCENE_STAGE_ATTR = "data-scene-stage";
export const SCENE_LAYER_ATTR = "data-scene-layer";

export const SCENE_ATTR = {
  renderer: "data-renderer",
  reason: "data-reason",
  tier: "data-tier",
  paused: "data-paused",
  motion: "data-motion",
  quality: "data-quality",
  helix: "data-helix",
  scrollFx: "data-scroll-fx",
} as const;

/** Set on `<html>` while ScrollTrigger measures: `html[data-scroll-measure]` turns smooth scrolling off (globals.css). */
export const INSTANT_SCROLL_ATTR = "data-scroll-measure";
export const WORK_ID = "lucrari";
/** On Work's card grid: the track the helix and its spiral are measured against. */
export const WORK_TRACK_ATTR = "data-work-track";

/* ---- scroll probe -------------------------------------------------------------------- */

/** A box in DOCUMENT CSS pixels (its y already includes the scroll offset). */
export type DocRect = { x: number; y: number; w: number; h: number };
/** Scroll offsets, in CSS pixels, over which a progress runs 0 → 1. */
export type ScrollSpan = { start: number; end: number };

/**
 * Written by the director at every ScrollTrigger refresh, read by the scene every frame.
 * A plain mutable object: no React state, no events.
 */
export type ScrollProbe = {
  /** The director has measured at least once. */
  live: boolean;
  /** Bumped on every refresh. */
  version: number;
  /** `--header-h` in px. */
  headerH: number;
  /** The sticky layer's height in px (`h-scene`: one viewport under the header), 0 until measured. */
  layerH: number;
  /** The stage's document top and bottom: it wraps Work, so these are Work's own edges. */
  stage: { top: number; bottom: number };
  /** Work's card track (`[data-work-track]`), null while it is not in the page. */
  work: DocRect | null;
  /**
   * Work's heading block, from the eyebrow's top to the lead's bottom (the track's previous
   * sibling, its scroll-reveal offset taken out). Null without Work.
   */
  workHead: DocRect | null;
  /**
   * The free band above Work's heading, as wide as Work's section: from the end of the previous
   * section's content (its bottom less its bottom padding) down to the heading's top (`workHead.y`).
   * The ambient helix lies in it, clear of any text. Null without Work.
   */
  workGap: DocRect | null;
  /**
   * Work's track, "top 70%" → "top 55%": the work gate's band for the ambient helix (the spiral
   * arms on its own sticky line, choreography.ts `helixArriveSpan`, and keeps this as its disarm
   * line): armed once the scroll reaches its end, disarmed above its start. Not a progress — the
   * helix's arrival itself runs in time.
   */
  workSpan: ScrollSpan;
  /**
   * Work's track, "top top" less the header → "bottom bottom": the scroll the spiral turns over
   * (the sticky zone is under the header from its start to its end).
   */
  helix: ScrollSpan;
};

export function createScrollProbe(): ScrollProbe {
  return {
    live: false,
    version: 0,
    headerH: 0,
    layerH: 0,
    stage: { top: 0, bottom: 0 },
    work: null,
    workHead: null,
    workGap: null,
    workSpan: { start: 0, end: 0 },
    helix: { start: 0, end: 0 },
  };
}

/**
 * Dispatched on the stage root by the scene when it changed the page's layout itself (Work's
 * spiral grows or shrinks the card track at once). The director re-reads every box into the probe
 * then and there — no ScrollTrigger refresh, which would stop a touch fling and waits for the
 * scroll to end; the stage's own resize refresh still follows for the spans. Never under a cover.
 */
export const SCENE_LAYOUT_EVENT = "tbs:scene-layout";

/** Pure. 0 → 1 across `span`, clamped; an empty or inverted span is a step at `start`. */
export function scrollProgress(scroll: number, span: ScrollSpan): number {
  if (!Number.isFinite(scroll)) return 0;
  if (span.end <= span.start) return scroll >= span.start ? 1 : 0;
  return Math.min(1, Math.max(0, (scroll - span.start) / (span.end - span.start)));
}

/* ---- timing, component props --------------------------------------------------------- */

export const SCENE_TIMING = {
  /** `requestIdleCallback` timeout before the probe / chunk requests. */
  IDLE_TIMEOUT_MS: 1500,
  /** The CSS crossfade onto the canvas. */
  CROSSFADE_MS: 500,
  /** ResizeObserver → `ScrollTrigger.refresh()` debounce. */
  REFRESH_DEBOUNCE_MS: 200,
} as const;

/**
 * How far ahead of the viewport Work must come before the stage requests anything heavy
 * (three.js, GSAP, the GPU probe): one viewport above and below. Nothing loads on entry.
 */
export const SCENE_NEAR_ROOT_MARGIN = "100% 0px 100% 0px";

export type SceneCanvasProps = {
  tier: "high" | "mid";
  force3d: boolean;
  paused: boolean;
  probe: ScrollProbe;
  /**
   * Once, after the staged build and compile of Work's helix (the scene's one part), from inside
   * the frame loop once the compiled helix has drawn two frames — a paused canvas draws none, so
   * it stays not ready (and Work keeps its flat card grid). A page without Work's track has
   * nothing to stage: ready then follows two frames of the empty canvas.
   */
  onReady(): void;
  onLost(): void;
  onBail(): void;
  /** Only on a change. */
  onQuality(step: SceneQuality): void;
  /**
   * The Work helix: `built` once, when its model compiled (the frames that make it ready follow);
   * then every mode the spiral driver applies, `off` last when the scene goes (the cards' own
   * styles are back).
   */
  onHelix(state: SceneHelix): void;
};

export type SceneDirectorProps = {
  stage: RefObject<HTMLDivElement | null>;
  probe: ScrollProbe;
  /** The first measurement landed in `probe`. */
  onLive(): void;
};

