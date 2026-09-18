/**
 * The interior 3D stage contract — names, storage, the renderer decision, the scroll probe
 * and the page → scene input store, shared by the stage, the scene chunk, the sections that
 * feed it and the E2E helpers.
 *
 * Deliberately NOT a `"use client"` module and nothing touches the DOM at import: server
 * components import constants from it, and `e2e/helpers.ts` imports it into Node. Every
 * function that needs `window` checks for it first and is a quiet no-op on the server.
 */

import type { RefObject } from "react";
import { directionSlug } from "@/lib/directions";

/* ---- QA switch ----------------------------------------------------------------------- */

/**
 * `localStorage[SCENE_3D_KEY]`: `"force"` drops `failIfMajorPerformanceCaveat`, the software
 * renderer check, the low-tier gate and the FPS bail (SwiftShader in headless Chromium gets
 * WebGL); `"off"` keeps the stage on nothing at all. Interior only — the intro reads its own
 * key (`INTRO_FORCE_3D_KEY`).
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
 * The services entrance as the scene draws it (`data-entry` on the stage): `idle` nothing formed,
 * `burst` the model exploding out of a speck and assembling (or imploding back), `formed` in place.
 */
export type SceneEntry = "idle" | "burst" | "formed";
/**
 * The Work helix's mode, as the spiral driver applies it: `spiral` (the project cards turn round
 * the helix, sticky, laid out inline), `ambient` (a small helix in the band above the heading; the
 * grid or band stays as it is) or `off` (the page as the server rendered it).
 */
export type SceneHelixMode = "off" | "spiral" | "ambient";
/** What the scene reports about the helix: `built` once its model compiled (after ready), then each mode. */
export type SceneHelix = SceneHelixMode | "built";

/* ---- DOM contract -------------------------------------------------------------------- */

export const SCENE_TESTID = {
  stage: "scene-stage",
  hero: "scene-hero",
  services: "scene-services",
} as const;

export const SCENE_STAGE_ATTR = "data-scene-stage";
export const SCENE_LAYER_ATTR = "data-scene-layer";
export const SCENE_ANCHOR_ATTR = "data-scene-anchor";

export const SCENE_ATTR = {
  renderer: "data-renderer",
  reason: "data-reason",
  tier: "data-tier",
  paused: "data-paused",
  motion: "data-motion",
  boost: "data-boost",
  quality: "data-quality",
  morph: "data-morph",
  entry: "data-entry",
  helix: "data-helix",
  scrollFx: "data-scroll-fx",
  shape: "data-shape",
  tilt: "data-tilt",
  tilting: "data-tilting",
  parallax: "data-parallax",
} as const;

/** Set on `<html>` while ScrollTrigger measures: `html[data-scroll-measure]` turns smooth scrolling off (globals.css). */
export const INSTANT_SCROLL_ATTR = "data-scroll-measure";
export const HERO_ID = "top";
export const SERVICES_ID = "servicii";
export const WORK_ID = "lucrari";
/** On Work's card grid: the track the helix and its spiral are measured against. */
export const WORK_TRACK_ATTR = "data-work-track";

/* ---- directions → models ------------------------------------------------------------- */

/** The five direction slugs, in the order the Directions pills show them. */
export const SCENE_SHAPES = [
  "produs-digital",
  "e-commerce",
  "automatizare-api",
  "asistenti-ia",
  "brand-ui",
] as const;
export type SceneShape = (typeof SCENE_SHAPES)[number];

export type ServiceModel = "cubes" | "commerce-loop" | "integration-hub" | "neural" | "mesh-wave";

export const SERVICE_MODEL: Readonly<Record<SceneShape, ServiceModel>> = {
  "produs-digital": "cubes",
  "e-commerce": "commerce-loop",
  "automatizare-api": "integration-hub",
  "asistenti-ia": "neural",
  "brand-ui": "mesh-wave",
};

/** Index into SCENE_SHAPES for a current or legacy direction slug; -1 when unknown. */
export function shapeIndex(slugOrLegacy: string): number {
  return (SCENE_SHAPES as readonly string[]).indexOf(directionSlug(slugOrLegacy));
}

/* ---- page → scene input store -------------------------------------------------------- */

export type SceneBoostSource = "hero-primary" | "hero-secondary";

/** Read by the scene every frame (no allocation) and by the stage through a subscription. */
/**
 * `stage` is which step of "Cum lucrăm" the visitor is reading on a service page, or −1 for none.
 * The world turns it into a place in the model's own loop and holds the model there, so the 3D
 * object illustrates the step being read instead of running on regardless of it.
 */
export type SceneInput = { boost: 0 | 1; waveSeq: number; shape: number; stage: number };

const INITIAL_INPUT: Readonly<SceneInput> = Object.freeze({
  boost: 0,
  waveSeq: 0,
  shape: 0,
  stage: -1,
});

const boostSources = new Set<SceneBoostSource>();
const inputListeners = new Set<() => void>();
/** Replaced (never mutated) on every change, so it doubles as a `useSyncExternalStore` snapshot. */
let input: Readonly<SceneInput> = INITIAL_INPUT;

function publish(next: SceneInput): void {
  input = Object.freeze(next);
  for (const listener of [...inputListeners]) listener();
}

/**
 * A hero CTA is hovered or focused (`active`), or no longer is. The scene boosts while ANY
 * source is active; `waveSeq` counts the 0 → 1 edges only, so moving from one CTA to the
 * other never starts a second light wave.
 */
export function setSceneBoost(source: SceneBoostSource, active: boolean): void {
  const had = boostSources.has(source);
  if (had === active) return;
  if (active) boostSources.add(source);
  else boostSources.delete(source);
  const boost: 0 | 1 = boostSources.size > 0 ? 1 : 0;
  if (boost === input.boost) return;
  publish({ ...input, boost, waveSeq: boost === 1 ? input.waveSeq + 1 : input.waveSeq });
}

/** The selected direction (current or legacy slug). An unknown slug changes nothing. */
export function selectSceneShape(slugOrLegacy: string): void {
  const shape = shapeIndex(slugOrLegacy);
  if (shape < 0 || shape === input.shape) return;
  publish({ ...input, shape });
}

/**
 * The step of a service page the visitor is reading (0-based), or −1 for none. The world clamps
 * it against the model's own stage table, so a page with more steps than the model has stages
 * simply releases the model rather than holding it somewhere meaningless.
 */
export function selectServiceStage(stage: number): void {
  const next = Number.isFinite(stage) && stage >= 0 ? Math.floor(stage) : -1;
  if (next === input.stage) return;
  publish({ ...input, stage: next });
}

export function readSceneInput(): Readonly<SceneInput> {
  return input;
}

export function subscribeSceneInput(listener: () => void): () => void {
  inputListeners.add(listener);
  return () => {
    inputListeners.delete(listener);
  };
}

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
  stage: { top: number; bottom: number };
  hero: DocRect | null;
  services: DocRect | null;
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
   * The FIRST see-through window of a service page's benefits row (`[data-scene-anchor="panels"]`):
   * the letterbox at the foot of the first panel, measured rather than derived from the row. The
   * three are one row of equal columns, so this box is every window's size and the first one's
   * place. Null on every page without a row, and at every width and renderer where the page lays
   * no window out.
   */
  panels: DocRect | null;
  /**
   * The distance between two windows' left edges, measured across the row. A panel's centre is not
   * its third of the row's centre — they differ by a third of the row's gap, a constant ~4.7px that
   * does not shrink with the viewport and pushes the outer two objects over their window's edge at
   * the narrow end. 0 without a row.
   */
  panelsPitch: number;
  /**
   * A service page's steps host (`[data-scene-anchor="steps"]`): the empty, sticky box beside
   * "Cum lucrăm" the model moves into while the section is read. `y` is where the host RESTS —
   * its document top unstuck, not where it is pinned at this scroll. Null on every page without
   * one, and below 861px, where the page does not render it at all.
   */
  steps: DocRect | null;
  /**
   * The scroll `steps` is pinned over: from the scroll at which it takes its sticky offset to the
   * one at which the band it is sticky in runs out under it. With `steps.y` it is the whole of the
   * host's travel, so the scene never has to touch the DOM for it (`stepsHostTop`).
   */
  stepsPin: ScrollSpan;
  /** `#top`, "top top" → "bottom 35%". */
  heroExit: ScrollSpan;
  /**
   * The services anchor, "top 90%" → "top 75%": the entry gate arms once the scroll reaches its
   * end and disarms above its start. Not a progress — the burst itself runs in time.
   */
  entry: ScrollSpan;
  /**
   * Work's track, "top 70%" → "top 55%": the work gate's band (the services model hands its
   * swarm over to the helix), armed and disarmed like `entry`. Not a progress either.
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
    hero: null,
    services: null,
    work: null,
    workHead: null,
    workGap: null,
    panels: null,
    panelsPitch: 0,
    steps: null,
    stepsPin: { start: 0, end: 0 },
    heroExit: { start: 0, end: 0 },
    entry: { start: 0, end: 0 },
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

/* ---- timing, parallax, component props ----------------------------------------------- */

export const SCENE_TIMING = {
  /** `requestIdleCallback` timeout before the probe / chunk requests. */
  IDLE_TIMEOUT_MS: 1500,
  /** Added when an intro overlay was on screen: R3F releases the intro's context 500ms after unmount. */
  AFTER_INTRO_MS: 600,
  /** The CSS crossfade from the art to the canvas. */
  CROSSFADE_MS: 500,
  /** ResizeObserver → `ScrollTrigger.refresh()` debounce. */
  REFRESH_DEBOUNCE_MS: 200,
} as const;

/** Hero parallax only on a capable desktop with a real pointer and motion allowed. */
export const PARALLAX_MEDIA =
  "(min-width: 861px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export const PARALLAX_LAYERS = {
  "hero-backdrop": { yPercent: 12 },
  "hero-stats": { yPercent: -8 },
} as const;

export type SceneCanvasProps = {
  tier: "high" | "mid";
  force3d: boolean;
  paused: boolean;
  probe: ScrollProbe;
  /**
   * Once, after the staged build and compile, from inside the frame loop once the compiled scene
   * has drawn two frames — a paused canvas draws none, so it stays not ready (and keeps the art).
   */
  onReady(): void;
  onLost(): void;
  onBail(): void;
  /** Only on a change. */
  onQuality(step: SceneQuality): void;
  /** Only on a change: a morph started (true) or committed (false). */
  onMorph(running: boolean): void;
  /**
   * Only on a change, and only once the scene is ready (never while the art still shows): the
   * services entrance as drawn — the first report is the state the scene is in (a deep link
   * into the services says `formed` without ever bursting).
   */
  onEntry(state: SceneEntry): void;
  /**
   * The Work helix: `built` once, when its model compiled (after ready); then every mode the
   * spiral driver applies, `off` last when the scene goes (the cards' own styles are back).
   */
  onHelix(state: SceneHelix): void;
};

export type SceneDirectorProps = {
  stage: RefObject<HTMLDivElement | null>;
  probe: ScrollProbe;
  /** The first measurement landed in `probe`. */
  onLive(): void;
};

/** Unit tests only: forget every boost, the selected shape and every subscriber. */
export function resetSceneForTests(): void {
  boostSources.clear();
  inputListeners.clear();
  input = INITIAL_INPUT;
}
