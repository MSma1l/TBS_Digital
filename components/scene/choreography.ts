/**
 * Where the interior scene's models sit, how they hand over and how they morph — as pure
 * arithmetic. No three.js, no DOM: the world calls these every frame with numbers it already
 * has, and the unit tests pin them as tables.
 *
 * Coordinates: the canvas is the sticky layer (`h-scene`, under the header). A DOM box is
 * turned into scene space on the z = 0 plane of the fixed camera below; `y` grows upwards.
 *
 * Scroll: the director measures document rects and scroll spans into the probe at every
 * ScrollTrigger refresh; the scene reads `window.scrollY` once per frame against them. The
 * canvas is stuck to the viewport while the page scrolls on the compositor, so a model that
 * followed its DOM host rigidly would trail it by a frame. Each model follows its host at a
 * parallax factor below 1 instead — the offset is larger than the lag, so it reads as depth.
 */

import type { DocRect, ScrollProbe } from "@/lib/scene";
import { CORE, MODEL_RADIUS } from "./shapes";

export const SCENE_CAMERA = { z: 10, fov: 35, near: 0.1, far: 60 } as const;

export function clamp01(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(x: number): number {
  const t = 1 - clamp01(x);
  return 1 - t * t * t;
}

/** Scene units per CSS pixel on the z = 0 plane of a canvas `h` pixels tall. */
export function worldPerPx(h: number): number {
  return (2 * SCENE_CAMERA.z * Math.tan((SCENE_CAMERA.fov * Math.PI) / 360)) / Math.max(1, h);
}

/** A position that follows `domY` at factor `f` around `restY` (f = 1 tracks it rigidly). */
export function parallax(domY: number, restY: number, f: number): number {
  return restY + f * (domY - restY);
}

export type Placement = { x: number; y: number; scale: number };

/**
 * Fit a model of radius `modelR` into a `box`-pixel host centred at (`cx`, `cy`) canvas
 * pixels, filling `fill` of it — but never wider than 45% of the canvas's short side, so a
 * short landscape viewport is never covered.
 */
export function fitAnchor(
  w: number,
  h: number,
  cx: number,
  cy: number,
  box: number,
  modelR: number,
  fill: number,
  out: Placement = { x: 0, y: 0, scale: 1 },
): Placement {
  const k = worldPerPx(h);
  const rPx = Math.min((Math.max(0, box) * fill) / 2, 0.45 * Math.min(w, h));
  out.x = (cx - w / 2) * k + 0;
  out.y = -(cy - h / 2) * k + 0;
  out.scale = (rPx * k) / modelR;
  return out;
}

/* ---- layouts ------------------------------------------------------------------------ */

export type LayoutKind = "desktop" | "tablet" | "portrait";

export type SceneLayout = {
  kind: LayoutKind;
  /** `dim` is the core's brightness at rest (a phone's core sits behind the copy). */
  core: { fill: number; dim: number; parallax: number };
  services: { fill: number; parallax: number };
};

export const SCENE_LAYOUTS: Readonly<Record<LayoutKind, SceneLayout>> = {
  desktop: {
    kind: "desktop",
    core: { fill: 0.95, dim: 1, parallax: 0.55 },
    services: { fill: 0.9, parallax: 0.78 },
  },
  tablet: {
    kind: "tablet",
    core: { fill: 0.9, dim: 0.8, parallax: 0.5 },
    services: { fill: 0.8, parallax: 0.7 },
  },
  portrait: {
    kind: "portrait",
    core: { fill: 0.92, dim: 0.55, parallax: 0.45 },
    services: { fill: 0.86, parallax: 0.65 },
  },
};

/** On a touch screen the page scrolls with momentum: more depth hides more lag. */
export const COARSE_PARALLAX_MAX = 0.65;

/**
 * Below this canvas width the hero is one column and its core sits BEHIND the copy (Hero.tsx
 * `max-md`: the anchor is centred under the headline and the lead) — whatever the orientation,
 * so tablets from 641px and landscape phones too, not only the portrait layout.
 */
export const CORE_BEHIND_COPY_BELOW = 861;
/** Below this width the copy spans the phone; from it up to 860px the core outgrows the copy's column. */
export const CORE_BEHIND_COPY_WIDE_FROM = 641;

/**
 * The core's resting brightness while it sits behind the copy, glowing on the dark page
 * (`glow`) or as ink on the light one (`ink`). The hero exit still brightens it towards 0.9 as
 * the copy scrolls away. Measured over the forced WebGL core with the text hidden, four frames
 * per case (the rings and the pulse move the worst pixel from frame to frame):
 *  · narrow (< 641px): glow keeps the portrait layout's 0.55 — the dark lead stays ≥5.5:1 and
 *    the dark phone art was calibrated against it. Ink at 0.55 kept the light lead at 100%, but
 *    a ring behind the red eyebrow took single frames under 4.5:1 (93.6–97.1% of its pixels,
 *    lowest 3.78); at 0.4 — the light phone art's own strength, `--hero-core-phone` — every
 *    hero text measured 100% at 375/390/412;
 *  · wide (641–860px): the core (480px) is wider than the copy's column and its glass sits
 *    under the end of the lead. The tablet layout's 0.8 had left the light lead at 99.2–99.7%
 *    (lowest 3.85) at 768×1024; ink 0.4 still left one frame in four at 99.9% (4.33), and glow
 *    0.55 left the dark lead at 99.8–99.9% in every frame (lowest 3.82). At glow 0.35 / ink 0.3
 *    every hero text measured 100% in both themes (light lead lowest 4.51, dark 5.78).
 */
export const CORE_BEHIND_COPY_DIM = {
  narrow: { glow: 0.55, ink: 0.4 },
  wide: { glow: 0.35, ink: 0.3 },
} as const;

/**
 * Portrait phones below 641px; desktops from 1025px; tablets and landscape phones between.
 * `ink`: the palette draws dark ink on the light page (three/palette.ts `mode`).
 */
export function layoutFor(w: number, h: number, coarse: boolean, ink = false): SceneLayout {
  const base =
    w < 641 && w < h ? SCENE_LAYOUTS.portrait : w >= 1025 ? SCENE_LAYOUTS.desktop : SCENE_LAYOUTS.tablet;
  const band = w < CORE_BEHIND_COPY_WIDE_FROM ? CORE_BEHIND_COPY_DIM.narrow : CORE_BEHIND_COPY_DIM.wide;
  const behindCopy = ink ? band.ink : band.glow;
  const dim = w < CORE_BEHIND_COPY_BELOW ? Math.min(base.core.dim, behindCopy) : base.core.dim;
  if (!coarse && dim === base.core.dim) return base;
  const parallax = (value: number) => (coarse ? Math.min(value, COARSE_PARALLAX_MAX) : value);
  return {
    kind: base.kind,
    core: { ...base.core, dim, parallax: parallax(base.core.parallax) },
    services: { ...base.services, parallax: parallax(base.services.parallax) },
  };
}

/* ---- scroll → canvas space ---------------------------------------------------------- */

/**
 * The document y of the canvas's top edge: the sticky layer rests at the stage top, sticks
 * under the header while the stage scrolls past, and leaves with the stage bottom. Before the
 * director has measured, the canvas counts as stuck to the viewport top.
 */
export function canvasDocTop(scrollY: number, probe: ScrollProbe, canvasH: number): number {
  const y = Number.isFinite(scrollY) ? scrollY : 0;
  if (!probe.live) return y;
  const stuck = y + probe.headerH;
  const max = Math.max(probe.stage.top, probe.stage.bottom - canvasH);
  return Math.min(max, Math.max(probe.stage.top, stuck));
}

/** A host's box is its short side; the services screen is wide and short, so it may spill. */
export const SERVICES_BOX_ASPECT = 1.8;

/** Where the hero host sits before the director has measured it (canvas pixels). */
export function fallbackHeroRect(w: number, h: number, layout: SceneLayout): DocRect {
  if (layout.kind === "portrait") {
    const size = Math.min(0.92 * w, 480);
    return { x: (w - size) / 2, y: Math.min(40, Math.max(12, 0.06 * w)), w: size, h: size };
  }
  const size = Math.min(0.42 * w, 600);
  return { x: w - size - Math.min(w * 0.04, 32), y: (h - size) / 2, w: size, h: size };
}

/** The core's placement at `scrollY` (before the handoff moves it). */
export function placeCore(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  layout: SceneLayout,
  out?: Placement,
): Placement {
  if (!probe.live || !probe.hero) {
    const rect = fallbackHeroRect(w, h, layout);
    return fitAnchor(w, h, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h), CORE.R, layout.core.fill, out);
  }
  const rect = probe.hero;
  const top = canvasDocTop(scrollY, probe, h);
  const centre = rect.y + rect.h / 2;
  const cy = parallax(centre - top, centre - probe.stage.top, layout.core.parallax);
  return fitAnchor(w, h, rect.x + rect.w / 2, cy, Math.min(rect.w, rect.h), CORE.R, layout.core.fill, out);
}

/** The service models' placement at `scrollY` (null before the director has measured). */
export function placeServices(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  layout: SceneLayout,
  out?: Placement,
): Placement | null {
  if (!probe.live || !probe.services) return null;
  const rect = probe.services;
  const top = canvasDocTop(scrollY, probe, h);
  const cy = parallax(rect.y + rect.h / 2 - top, h / 2, layout.services.parallax);
  const box = Math.min(rect.w, rect.h * SERVICES_BOX_ASPECT);
  return fitAnchor(w, h, rect.x + rect.w / 2, cy, box, MODEL_RADIUS, layout.services.fill, out);
}

/** Along the hero exit `e`: the core shrinks, its rings open out, a dimmed phone core brightens. */
export type CorePose = { scale: number; rings: number; dim: number };

export function coreExitPose(
  e: number,
  layout: SceneLayout,
  out: CorePose = { scale: 1, rings: 1, dim: 1 },
): CorePose {
  const x = clamp01(e);
  out.scale = 1 - 0.35 * x;
  out.rings = 1 + 0.25 * x;
  out.dim = layout.core.dim + (0.9 - layout.core.dim) * x;
  return out;
}

/** `a` → `b` by `k`, into `out`. */
export function mixPlacement(a: Placement, b: Placement, k: number, out: Placement): Placement {
  const t = clamp01(k);
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.scale = a.scale + (b.scale - a.scale) * t;
  return out;
}

/* ---- morph between service models ---------------------------------------------------- */

/**
 * t: 0 = `from` formed, 0.5 = a loose cloud (nothing of either shape), 1 = `to` formed —
 * committed at once to `from = to, t = 0`, which is the same picture.
 */
export type MorphState = { from: number; to: number; t: number };

/** Seconds for each half of a switch; the worst case (switching mid re-form) stays under 1.5 s. */
export const MORPH_SECONDS = { dissolve: 0.32, reform: 0.5 } as const;

export function createMorph(shape: number): MorphState {
  return { from: shape, to: shape, t: 0 };
}

export function morphRunning(state: MorphState): boolean {
  return state.t > 0 || state.from !== state.to;
}

const MORPH_STEP_MAX = 1 / 20;

/**
 * Advance `state` towards `target` by `dt` seconds. Every step is continuous:
 *  · before the cloud (t < .5) nothing on screen depends on `to`, so a new target simply
 *    replaces it — unless it is `from` again, which dissolves back the way it came;
 *  · while re-forming (t > .5) a new target first walks back to the cloud;
 *  · `instant` (the handoff owns the swarm) jumps straight to the target, formed.
 */
export function stepMorph(state: MorphState, target: number, dt: number, instant = false): void {
  if (instant) {
    state.from = target;
    state.to = target;
    state.t = 0;
    return;
  }
  const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MORPH_STEP_MAX);
  const dissolveRate = 0.5 / MORPH_SECONDS.dissolve;
  const reformRate = 0.5 / MORPH_SECONDS.reform;

  if (state.t === 0 && state.from === state.to) {
    if (target === state.from) return;
    state.to = target;
  }

  if (target !== state.to) {
    if (state.t < 0.5) {
      if (target === state.from) {
        state.t = Math.max(0, state.t - step * dissolveRate);
        if (state.t === 0) state.to = state.from;
        return;
      }
      state.to = target;
    } else if (state.t === 0.5) {
      state.to = target;
    } else {
      state.t = Math.max(0.5, state.t - step * reformRate);
      if (state.t === 0.5) state.to = target;
      return;
    }
  }

  if (state.t < 0.5) {
    const next = state.t + step * dissolveRate;
    // Cross the cloud at the re-form rate for whatever time is left in this step.
    state.t = next <= 0.5 ? next : 0.5 + (next - 0.5) * (reformRate / dissolveRate);
  } else {
    state.t += step * reformRate;
  }
  if (state.t >= 1) {
    state.from = state.to;
    state.t = 0;
  }
}

/* ---- who draws what ------------------------------------------------------------------ */

export type SwarmPlan = { active: boolean; from: number; to: number; t: number };
export type ModelReveal = { index: number; reveal: number };

export type SceneComposition = {
  /** 1 = the core fully formed, 0 = collapsed and hidden. */
  core: number;
  /** Swarm slots: 0 = the core, 1 + i = service model i. */
  swarm: SwarmPlan;
  /** At most two models are drawn; the same index twice means one model (take the max). */
  models: [ModelReveal, ModelReveal];
};

export function createComposition(): SceneComposition {
  return {
    core: 1,
    swarm: { active: false, from: 0, to: 0, t: 0 },
    models: [
      { index: 0, reveal: 0 },
      { index: 0, reveal: 0 },
    ],
  };
}

/**
 * The frame's plan from the handoff progress `h` (core → services) and the morph. While the
 * handoff runs (0 < h < 1) it owns the swarm: the core dissolves into it and it re-forms as
 * the selected model; the morph is instant then (see `stepMorph`). Once h = 1 the morph owns
 * it. Written into `out` (no allocation per frame).
 */
export function composeScene(h: number, m: MorphState, out: SceneComposition): SceneComposition {
  const hand = clamp01(h);
  out.core = 1 - smoothstep(0.1, 0.5, hand);
  const inHandoff = hand > 0 && hand < 1;
  if (inHandoff) {
    out.swarm.active = true;
    out.swarm.from = 0;
    out.swarm.to = 1 + m.to;
    out.swarm.t = hand;
  } else if (hand >= 1 && m.t > 0) {
    out.swarm.active = true;
    out.swarm.from = 1 + m.from;
    out.swarm.to = 1 + m.to;
    out.swarm.t = m.t;
  } else {
    out.swarm.active = false;
    out.swarm.from = 0;
    out.swarm.to = 0;
    out.swarm.t = 0;
  }
  if (hand < 1) {
    out.models[0].index = m.to;
    out.models[0].reveal = smoothstep(0.7, 1, hand);
    out.models[1].index = m.to;
    out.models[1].reveal = 0;
  } else {
    out.models[0].index = m.from;
    out.models[0].reveal = 1 - smoothstep(0, 0.3, m.t);
    out.models[1].index = m.to;
    out.models[1].reveal = smoothstep(0.7, 1, m.t);
  }
  return out;
}

/** The reveal of model `index` in `plan` (the larger of its entries, 0 when absent). */
export function revealOf(plan: SceneComposition, index: number): number {
  let reveal = 0;
  for (const entry of plan.models) {
    if (entry.index === index && entry.reveal > reveal) reveal = entry.reveal;
  }
  return reveal;
}

/* ---- the swarm, as the shader moves one particle (for tests and sanity) --------------- */

/**
 * How far one particle is between its `from` point, its cloud point and its `to` point at
 * morph progress `t`, given its stagger seed `w` ∈ [0, 1): `leave` is 0..1 of the way to the
 * cloud (t < .5), `arrive` 0..1 of the way from the cloud to `to` (t ≥ .5). The swarm vertex
 * shader uses exactly this.
 */
export function swarmPhase(t: number, w: number): { leave: number; arrive: number } {
  const stagger = w * 0.35;
  const leave = clamp01((t * 2 - stagger) / 0.65);
  const arrive = clamp01(((t - 0.5) * 2 - stagger) / 0.65);
  return t < 0.5 ? { leave, arrive: 0 } : { leave: 1, arrive };
}
