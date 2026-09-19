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

import type { DocRect, ScrollProbe, ScrollSpan } from "@/lib/scene";
import { CHIP, HELIX, MODEL_RADIUS } from "./shapes";

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
 * The chip's resting brightness while it sits behind the copy, glowing on the dark page
 * (`glow`) or as ink on the light one (`ink`). The hero exit still brightens it towards 0.9 as
 * the copy scrolls away. Re-measured for the microprocessor (2026-09-17) over the forced WebGL
 * chip with the text hidden, TWELVE frames per case: its worst pixels are the moving packets and
 * pin flares, and four frames missed some of them. Every pixel under a text line box counts.
 *  · narrow (< 641px): glow 0.55 keeps the dark lead ≥5.49:1 and the headline ≥3.59 (large
 *    text, 3:1) at 320–412. Ink 0.4 is the light lead's limit, not a taste: the lead's own
 *    colour is 4.87:1 on the bare page and the chip's centre sits under it, so at 390px it
 *    measures exactly 4.50 at its lowest. Brighter failed even with more scrim: ink 0.6 under
 *    `--hero-scrim` 0.95 left 99.98% of the lead's pixels ≥4.5 (lowest 4.45), 0.7 and 0.8 4.41 /
 *    4.40. A more visible light chip needs another scrim shape (Hero.tsx), not a dim.
 *  · wide (641–860px): the chip (480px) is centred under the lead, below the scrim's full pool,
 *    so a fifth of it shows through whatever the scrim's strength. The old 0.35 / 0.3 failed at
 *    768×1024: dark lead 99.94% (lowest 3.78) and headline 2.74; light lead 99.84% (4.06). Glow
 *    0.3 still failed (99.97%, 4.24), ink 0.2 too (99.95%, 4.41). At glow 0.25 / ink 0.15 every
 *    hero text is 100% (dark lead ≥5.05, headline ≥3.62; light lead ≥4.53) at 768×1024 and 844×390.
 * The static art matches these through `--hero-core-phone` (globals.css): retune both together.
 */
export const CORE_BEHIND_COPY_DIM = {
  narrow: { glow: 0.55, ink: 0.4 },
  wide: { glow: 0.25, ink: 0.15 },
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

/** The hero chip's placement at `scrollY` (always on its own host). */
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
    return fitAnchor(w, h, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h), CHIP.R, layout.core.fill, out);
  }
  const rect = probe.hero;
  const top = canvasDocTop(scrollY, probe, h);
  const centre = rect.y + rect.h / 2;
  const cy = parallax(centre - top, centre - probe.stage.top, layout.core.parallax);
  return fitAnchor(w, h, rect.x + rect.w / 2, cy, Math.min(rect.w, rect.h), CHIP.R, layout.core.fill, out);
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

/**
 * Along the hero exit `e`: the chip shrinks, lifts apart into its exploded view (`lift` 0 → 1:
 * the heat spreader and the die rise off the substrate) and a dimmed phone chip brightens. It
 * stays on its own host: nothing drifts towards the services.
 */
export type CorePose = { scale: number; lift: number; dim: number };

export function coreExitPose(
  e: number,
  layout: SceneLayout,
  out: CorePose = { scale: 1, lift: 0, dim: 1 },
): CorePose {
  const x = clamp01(e);
  out.scale = 1 - 0.35 * x;
  out.lift = x;
  out.dim = layout.core.dim + (0.9 - layout.core.dim) * x;
  return out;
}

/** The chip's voxel reveal along the hero exit: whole until 60% of it, dissolved as the hero leaves. */
export function coreReveal(e: number): number {
  return 1 - smoothstep(0.6, 1, e);
}

/* ---- the benefits row (a service page's three panels) ----------------------------------- */

/** The row is this many equal columns, one object per column. */
export const PANEL_COLUMNS = 3;

/**
 * The half-extent every object of the row is authored to, in model units — a mirror of
 * `PANEL_BOUND` in `three/models/panel/kit.ts` (which cannot be imported here: this module is
 * three.js-free and that one builds geometry at import). All three share it on purpose, so one
 * stroke width is one stroke width across three adjacent panels.
 *
 * Kept for what it says about the objects, but the FIT is against `PANEL_LIT` below: what they
 * light reaches past what they are built from. `MODEL_RADIUS` is wrong here either way — these are
 * 4.5 : 1 letterbox objects, and fitting their diagonal into a 4.2 : 1 window would draw them at
 * about half size with the row's air in the wrong place.
 */
export const PANEL_BOUND = { halfWidth: 1.9, halfHeight: 0.42 } as const;

/**
 * What the row actually LIGHTS, in model units — not what it is authored to.
 *
 * These objects are drawn additively and their edges glow, and the window has no clipping
 * ancestor (it must not have one: `overflow` or `contain` anywhere above the stage would break
 * the sticky canvas). So the lit pixels reach past the boxes, and fitting `PANEL_BOUND` put a
 * visible spill under the panel foot and off its sides. Measured on the real page instead: every
 * pixel each object lights above a threshold, swept across a full loop, at 861 and 1280, both
 * themes, sweeping 70 frames so no flare is missed. The worst is the fit as its press bottoms out:
 * 0.645 units of light BELOW its own origin, against the 0.42 it is authored to.
 *
 * One box for all three on purpose. Three bounds would be three unit scales, and three different
 * hairline weights in three adjacent panels is the defect the row was drawn to avoid.
 */
export const PANEL_LIT = { halfWidth: 1.95, halfHeight: 0.65 } as const;

/**
 * Clear air between that lit box and the window's own chrome, css px per side. A pixel or two is
 * nothing against a glow; this is meant to be visible at 2x.
 */
export const PANEL_AIR = 6;

/** Seconds the row dissolves in over as the scroll brings it in, and out again. */
export const PANEL_FADE_SECONDS = 0.35;

/**
 * How much of the row's windows is inside the canvas at `scrollY`, 0 → 1 (they share a top and
 * a height, so the first one answers for all three). `margin` grows the
 * canvas by that many pixels on both sides first, which is how the world asks "is it near enough
 * to be worth building" with the same arithmetic it asks "is it worth drawing".
 */
export function panelsShare(probe: ScrollProbe, scrollY: number, h: number, margin = 0): number {
  const band = probe.panels;
  if (!probe.live || !band || band.w <= 0 || band.h <= 0) return 0;
  const y0 = band.y - canvasDocTop(scrollY, probe, h);
  const inside = Math.min(h + margin, y0 + band.h) - Math.max(-margin, y0);
  return clamp01(inside / band.h);
}

/**
 * The `index`-th object of the benefits row: on its own window's centre — the first window's box
 * stepped along by the measured pitch, never a third of the row, whose centre is a constant ~4.7px
 * off a panel's — and fitted into that window: its height against the object's own half-height, its
 * width against the object's half-width, whichever runs out first. The width matters at the narrow
 * end, where a 253px window is what limits these 4.5 : 1 objects rather than the 62px height.
 *
 * A rigid follow: the windows are ordinary boxes in the page, and an object that drifted against
 * one would show outside it. Null with no window measured, or an index off the end of the row.
 */
export function placePanels(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  index: number,
  out: Placement = { x: 0, y: 0, scale: 1 },
): Placement | null {
  const win = probe.panels;
  if (!probe.live || !win || win.w <= 0 || win.h <= 0) return null;
  if (index < 0 || index >= PANEL_COLUMNS) return null;
  const k = worldPerPx(h);
  const cx = win.x + win.w / 2 + index * probe.panelsPitch;
  const cy = win.y + win.h / 2 - canvasDocTop(scrollY, probe, h);
  const byHeight = Math.max(0, win.h - 2 * PANEL_AIR) / (2 * PANEL_LIT.halfHeight);
  const byWidth = Math.max(0, win.w - 2 * PANEL_AIR) / (2 * PANEL_LIT.halfWidth);
  out.x = (cx - w / 2) * k;
  out.y = -(cy - h / 2) * k;
  out.scale = Math.min(byHeight, byWidth) * k;
  return out;
}

/* ---- the projects laptop (a service page's "Proiecte relevante") ------------------------ */

/**
 * What the laptop LIGHTS, in model units — the mirror of `LAPTOP_LIT` in
 * `three/models/laptop.ts`, which cannot be imported here (this module is three.js-free and that
 * one builds geometry at import), and the same distinction the benefits row makes: an object drawn
 * additively lights past the boxes it is built from, so the fit is made against the lit pixels.
 *
 * It is the model's own bound turned by the pose it is drawn at — pitched `LAPTOP_POSE.pitch`
 * towards the viewer and yawed within `LAPTOP_POSE.yaw` either side — so the silhouette, not the
 * box, is what the window has to hold: half its depth leans into the height as it pitches and into
 * the width as it turns. `MODEL_RADIUS` is wrong here for the same reason it is wrong for a panel —
 * that is the five service models' bound, and fitting this object's diagonal into a cell would draw
 * a laptop half the size with the air in the wrong place.
 *
 * Neither is the turned bound. This object is a UNIT DEEP, its cell stands at the edge of the page
 * (~400px off the canvas's centre) and it travels the whole height of the canvas as the visitor
 * scrolls — and the scene's camera is a PERSPECTIVE one (`SCENE_CAMERA`), so the near half of the
 * machine projects ~11% further from the canvas's centre than the far half and the silhouette leans
 * OUTWARD, away from that centre, by more the further the cell is from it. The lean is not the same
 * on both sides either: the pose's own yaw adds to it on one and takes from it on the other.
 *
 * So these two numbers are measured on the real pages, not derived. Every frame is diffed against
 * the same page with the canvas hidden — the cards next door are bright objects too, and a bound
 * read off the raw frame would be theirs — a row or a column counts only with three lit pixels in
 * it, the sticky header's ticking clock is excluded, and the sweep runs 26 frames of a full turn at
 * three scroll positions (the cell high in the viewport, centred, low), on produs-digital,
 * automatizare-api and asistenti-ia at 1280, 1024 and 861. At the authored 1.52 x 1.17 the worst
 * frames lit 18px past a left-hand cell's left edge and 19px below a 1024 cell's foot; at
 * 1.94 x 1.37 every frame of every sweep is inside the cell on all four sides.
 */
export const LAPTOP_LIT = { halfWidth: 1.94, halfHeight: 1.37 } as const;

/** Clear air between that lit box and the cell's own chrome, css px per side. */
export const LAPTOP_AIR = 8;

/**
 * How much of the projects window is inside the canvas at `scrollY`, 0 → 1. `margin` grows the
 * canvas by that many pixels on both sides first — the same way the benefits row asks "is it near
 * enough to be worth building" with the arithmetic it asks "is it worth drawing".
 */
export function projectsShare(probe: ScrollProbe, scrollY: number, h: number, margin = 0): number {
  const win = probe.projects;
  if (!probe.live || !win || win.w <= 0 || win.h <= 0) return 0;
  const y0 = win.y - canvasDocTop(scrollY, probe, h);
  const inside = Math.min(h + margin, y0 + win.h) - Math.max(-margin, y0);
  return clamp01(inside / win.h);
}

/**
 * The laptop's placement at `scrollY`: on the projects window's centre, fitted into it — its height
 * against the object's own half-height, its width against its half-width, whichever runs out first.
 * Which one that is depends on the cell: in the hole a 5-card grid leaves, the cell is as tall as
 * the cards beside it and the WIDTH limits; in a cell of its own at the end of the shelf the height
 * does.
 *
 * A rigid follow, like the benefits row: the window is an ordinary box in the page, and an object
 * that drifted against it would show outside its own cell and over a card. Null with no window
 * measured.
 */
export function placeLaptop(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  out: Placement = { x: 0, y: 0, scale: 1 },
): Placement | null {
  const win = probe.projects;
  if (!probe.live || !win || win.w <= 0 || win.h <= 0) return null;
  const k = worldPerPx(h);
  const cx = win.x + win.w / 2;
  const cy = win.y + win.h / 2 - canvasDocTop(scrollY, probe, h);
  const byHeight = Math.max(0, win.h - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfHeight);
  const byWidth = Math.max(0, win.w - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfWidth);
  out.x = (cx - w / 2) * k;
  out.y = -(cy - h / 2) * k;
  out.scale = Math.min(byHeight, byWidth) * k;
  return out;
}

/* ---- the steps corner (a service page's "Cum lucrăm") ----------------------------------- */

/**
 * The model fills this much of the steps host's box. `MODEL_RADIUS` is the model's whole bound —
 * the world only ever turns it about its centre — so at 0.9 of the host's short side nothing it
 * draws can reach the copy beside it, at any sway or tilt.
 */
export const STEPS_BOX_FILL = 0.9;

/**
 * Seconds for the model to travel from the hero host into the steps corner and back. A travel in
 * TIME, like the entry and Work gates: a flick that crosses the whole section never teleports the
 * model, it only gets as far as the flick lasted and turns round from there.
 */
export const STEPS_TRAVEL = { form: 0.65, unform: 0.5 } as const;

/**
 * The share of the host that has to be inside the canvas for the travel to start, and the share it
 * falls to before the model goes home. Armed early on purpose: the travel is then spent while the
 * section is still coming up, so the model is parked by the time the copy is being read.
 */
export const STEPS_GATE = { on: 0.5, off: 0.05 } as const;

/**
 * The steps host's document top at `scrollY`: where it rests until the scroll reaches its sticky
 * offset, then the sticky line, then the bottom of the band it is sticky in — the whole of a
 * `position: sticky` box, out of two numbers the director measured. Null with no host.
 */
export function stepsHostTop(probe: ScrollProbe, scrollY: number): number | null {
  const rect = probe.steps;
  // A host with no box is no host: the steps column collapses to 0×0 wherever the scene will never
  // draw (renderer `fallback` / `off`), and fitting a model into nothing would scale it away.
  if (!probe.live || !rect || rect.w <= 0 || rect.h <= 0) return null;
  const y = Number.isFinite(scrollY) ? scrollY : 0;
  const run = Math.max(0, probe.stepsPin.end - probe.stepsPin.start);
  return rect.y + Math.min(run, Math.max(0, y - probe.stepsPin.start));
}

/** How much of the steps host is inside the canvas at `scrollY`, 0 → 1 (0 with no host). */
export function stepsShare(probe: ScrollProbe, scrollY: number, h: number): number {
  const rect = probe.steps;
  const hostTop = stepsHostTop(probe, scrollY);
  if (!rect || hostTop === null) return 0;
  const y0 = hostTop - canvasDocTop(scrollY, probe, h);
  return clamp01((Math.min(h, y0 + rect.h) - Math.max(0, y0)) / rect.h);
}

/**
 * The service model's placement in the steps corner at `scrollY`: fitted into the host's box and
 * following it rigidly. No parallax here — the host is pinned under the header while the section
 * is read, and a model that drifted against it would leave a box it has to stay inside. Null
 * before the director has measured a host (every page but a service page's desktop layout).
 */
export function placeSteps(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  out?: Placement,
): Placement | null {
  const rect = probe.steps;
  const hostTop = stepsHostTop(probe, scrollY);
  if (!rect || hostTop === null) return null;
  const top = canvasDocTop(scrollY, probe, h);
  const box = Math.min(rect.w, rect.h);
  return fitAnchor(w, h, rect.x + rect.w / 2, hostTop + rect.h / 2 - top, box, MODEL_RADIUS, STEPS_BOX_FILL, out);
}

/**
 * `a` → `b` at `t` (0 → 1). The position is lerped; the scale geometrically, because the corner is
 * a third of the hero's box and a linear scale would spend most of the travel already small.
 */
export function blendPlacement(a: Placement, b: Placement, t: number, out: Placement): Placement {
  const k = clamp01(t);
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.scale = a.scale > 0 && b.scale > 0 ? a.scale * (b.scale / a.scale) ** k : a.scale + (b.scale - a.scale) * k;
  return out;
}

/* ---- the Work helix -------------------------------------------------------------------- */

/** The spiral's helix is this share of its sticky zone's height tall (the zone: one layer). */
export const HELIX_ZONE_FILL = 0.9;
/**
 * The ambient helix (phones, or fewer than three cards): lying down in the free band above Work's
 * heading (`probe.workGap`: the previous section's bottom padding plus Work's top padding, ~84px on
 * a phone), this share of the canvas's width long — never taller on screen than `maxPx`, nor than
 * the band less `clear` px above and below, so it touches neither the Directions panel nor the
 * eyebrow. At full brightness: behind the copy the chips' flares and the packet comets had to be
 * dimmed to nothing to keep the text's contrast (0.07 on the dark page, 0 on the light one); in the
 * band it lies over no text at all (measured 2026-09-17, see `CHANGELOG.md`, Faza 3).
 */
export const HELIX_AMBIENT = { length: 0.6, maxPx: 120, clear: 10 } as const;
/**
 * How far the helix reaches from its axis, local units: a strand plus a chip riding on it
 * (`HELIX.radius` + the chip's lift and half its box, 1.518), and the 0/1 bits drifting up to 1.2
 * from the axis plus half a glyph's diagonal (models/helix.ts `HELIX_BIT`; scene-helix-model.test.ts
 * checks every part against it). It grew with the strand's radius — the molecule the cards ride is
 * wider than the one that used to sit inside them.
 *
 * Only the AMBIENT placement uses it (the spiral is sized by height), so the one thing it changes
 * is the lying helix in a phone's ~84px band: a fatter molecule laid on its side fills the band's
 * thickness sooner, so it is ~19% shorter than it was. That is the band being honest about what it
 * can hold, not a budget — the helix still lies clear of every line of text.
 */
export const HELIX_REACH = 1.56;

/**
 * The document y of the spiral's sticky zone (one layer tall): under the header while the track
 * scrolls past, never above the track's top nor below its bottom — where the sticky cards are.
 */
export function helixZoneTop(track: DocRect, scrollY: number, headerH: number, zoneH: number): number {
  const y = Number.isFinite(scrollY) ? scrollY : 0;
  return Math.min(Math.max(y + headerH, track.y), Math.max(track.y, track.y + track.h - zoneH));
}

/**
 * How far above the sticky line the helix's arrival arms, as a share of the layer's height.
 */
export const HELIX_ARRIVE_LEAD = 0.3;

/**
 * The band the helix's arrival is armed over (fx.ts `stepGate`: armed at `end`, disarmed under
 * `start`), written into `out`. Null before the director has measured the track.
 *
 * `end` is `HELIX_ARRIVE_LEAD` of a layer above the scroll at which the sticky zone reaches the
 * header — the whole point of the number. From `placeHelixSpiral` + `helixZoneTop`, with
 * `u = scrollY − (track.y − headerH)`, the helix's centre sits at canvas y `sceneH/2 − u` while
 * `u ≤ 0` and at exactly `sceneH/2` for every scroll after it. So the worst placement the arrival
 * can ever have is its first frame — 72% of the helix on screen at 1280×800, its middle (where
 * the replication bubble opens) 80% down the layer — and from there it can only improve. Work's
 * band (`probe.workSpan`, "top 70%") is a screen further up and would spend the first half of it
 * below the fold; it stays as the disarm line, so nothing is spent walking down the page.
 *
 * Derived from `probe.work` rather than `probe.helix` because the boxes are re-read at every
 * `SCENE_LAYOUT_EVENT` while the spans wait for a ScrollTrigger refresh — so this is never stale
 * after the spiral has grown the track under the visitor. No fifth ScrollTrigger: both ends come
 * out of boxes the existing four already measure.
 */
export function helixArriveSpan(probe: ScrollProbe, out: ScrollSpan = { start: 0, end: 0 }): ScrollSpan | null {
  const track = probe.work;
  if (!probe.live || !track) return null;
  const layerH = probe.layerH > 0 ? probe.layerH : 0;
  out.end = track.y - probe.headerH - HELIX_ARRIVE_LEAD * layerH;
  // Never above its own arming line, whatever a refresh left in the band.
  out.start = Math.min(probe.workSpan.start, out.end);
  return out;
}

/**
 * The spiral's helix at `scrollY`: its axis at `cx` of the track's width (helix.ts
 * `HELIX_LAYOUT.cx`, the same axis the cards orbit), centred on the sticky zone, as tall as
 * `HELIX_ZONE_FILL` of it. A rigid follow — the zone is stuck under the header while the cards
 * turn, so nothing drifts against them. Null before the director has measured the track.
 */
export function placeHelixSpiral(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  cx: number,
  out: Placement = { x: 0, y: 0, scale: 1 },
): Placement | null {
  const track = probe.work;
  if (!probe.live || !track) return null;
  const zoneH = probe.layerH > 0 ? probe.layerH : h;
  const top = canvasDocTop(scrollY, probe, h);
  const k = worldPerPx(h);
  const zoneCentre = helixZoneTop(track, scrollY, probe.headerH, zoneH) + zoneH / 2;
  out.x = (track.x + cx * track.w - w / 2) * k;
  out.y = -(zoneCentre - top - h / 2) * k;
  out.scale = (HELIX_ZONE_FILL * zoneH * k) / HELIX.height;
  return out;
}

/**
 * The ambient helix at `scrollY`: lying in the band above Work's heading (`probe.workGap`), centred
 * on it, `HELIX_AMBIENT.length` of the canvas's width long and at most `HELIX_AMBIENT.maxPx` — or
 * the band less `HELIX_AMBIENT.clear` on each side — tall once lying down (all of `HELIX_REACH`,
 * bits included). A band too thin for it gives scale 0. Null before the director has measured Work.
 */
export function placeHelixAmbient(
  probe: ScrollProbe,
  scrollY: number,
  w: number,
  h: number,
  out: Placement = { x: 0, y: 0, scale: 1 },
): Placement | null {
  const gap = probe.workGap;
  if (!probe.live || !gap) return null;
  const top = canvasDocTop(scrollY, probe, h);
  const k = worldPerPx(h);
  const tall = Math.max(0, Math.min(HELIX_AMBIENT.maxPx, gap.h - 2 * HELIX_AMBIENT.clear));
  out.x = (gap.x + gap.w / 2 - w / 2) * k;
  out.y = -(gap.y + gap.h / 2 - top - h / 2) * k;
  out.scale = Math.min((HELIX_AMBIENT.length * w * k) / HELIX.height, (tall * k) / (2 * HELIX_REACH));
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
 *  · `instant` (the services entrance or the Work handoff owns the swarm) jumps straight to the
 *    target, formed.
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

/**
 * Not a swarm slot: as a plan's `from`, the `to` slot shrunk to a speck at the services host's
 * centre — the services entrance bursts out of it (and implodes back into it).
 */
export const BURST = -1;

/** The swarm slot of the Work helix's silhouette (`aS0`): past Work's band the services model's swarm lands on it. */
export const HELIX_SLOT = 0;

export type SceneComposition = {
  /** Swarm slots: 1 + i = service model i, `HELIX_SLOT` the Work helix; `from` may be `BURST`. */
  swarm: SwarmPlan;
  /** At most two models are drawn; the same index twice means one model (take the max). */
  models: [ModelReveal, ModelReveal];
  /** The Work helix's reveal: 0 not drawn → 1 formed. */
  helix: number;
  /**
   * How far through its arrival the helix is, 0..1 (three/models/helix.ts `helixArrivePose`): the
   * molecule is synthesised over the Work gate's own 1.2s — filament, unwind, replication bubble,
   * bits, hologram. 1 everywhere else, which is the formed helix: a composition that never went
   * through the handoff has nothing left to arrive.
   */
  helixArrive: number;
};

export function createComposition(): SceneComposition {
  return {
    swarm: { active: false, from: 0, to: 0, t: 0 },
    models: [
      { index: 0, reveal: 0 },
      { index: 0, reveal: 0 },
    ],
    helix: 0,
    helixArrive: 1,
  };
}

function setSwarm(swarm: SwarmPlan, active: boolean, from: number, to: number, t: number): void {
  swarm.active = active;
  swarm.from = active ? from : 0;
  swarm.to = active ? to : 0;
  swarm.t = active ? t : 0;
}

function setModels(out: SceneComposition, a: number, revealA: number, b: number, revealB: number): void {
  out.models[0].index = a;
  out.models[0].reveal = revealA;
  out.models[1].index = b;
  out.models[1].reveal = revealB;
}

/**
 * The frame's plan from the services entry gate's value `entry`, the Work gate's value `work`
 * (fx.ts, both run in time) and the morph. Written into `out` (no allocation per frame). One
 * branch owns the swarm at a time:
 *  · work > 0 — the Work handoff: the selected model's swarm flies to the helix
 *    (1 + m.to → `HELIX_SLOT`) while the model dissolves over the first stretch and the helix is
 *    drawn in over the same one — a filament on the axis the swarm lands on, which then unwinds
 *    into the molecule over the rest (`helixArrive`); at 1 the helix alone, formed. The morph is
 *    instant meanwhile;
 *  · entry < 1 — the entrance: the selected model bursts out of a speck at its host's centre
 *    (`BURST` → 1 + m.to) and is revealed over the last stretch, or implodes back the same way;
 *    at 0 nothing is drawn. The morph is instant meanwhile (see `stepMorph`);
 *  · entry = 1 — formed: the pill morph owns the swarm, the two models' reveals cross over.
 * Every branch hands over continuously: at entry → 1 the swarm's alpha falls to 0 as the model's
 * reveal reaches 1, which is exactly the formed picture; at work = ε the swarm leaves the whole
 * model at alpha ≈ 0, and at work → 1 it fades onto the formed helix.
 */
export function composeScene(entry: number, work: number, m: MorphState, out: SceneComposition): SceneComposition {
  const e = clamp01(entry);
  const k = clamp01(work);
  if (k > 0) {
    setSwarm(out.swarm, k < 1, 1 + m.to, HELIX_SLOT, k);
    setModels(out, m.to, 1 - smoothstep(0, 0.3, k), m.to, 0);
    // The helix is drawn from the first frame of the gate — as a filament, then unwinding. What
    // it looks like on the way is `helixArrive`'s business; `helix` only says it is drawn at all.
    out.helix = smoothstep(0, 0.3, k);
    out.helixArrive = k;
  } else if (e < 1) {
    setSwarm(out.swarm, e > 0, BURST, 1 + m.to, e);
    setModels(out, m.to, smoothstep(0.72, 1, e), m.to, 0);
    out.helix = 0;
    out.helixArrive = 1;
  } else {
    setSwarm(out.swarm, m.t > 0, 1 + m.from, 1 + m.to, m.t);
    setModels(out, m.from, 1 - smoothstep(0, 0.3, m.t), m.to, smoothstep(0.7, 1, m.t));
    out.helix = 0;
    out.helixArrive = 1;
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

/** The swarm's opacity at morph progress `t`: faded in off `from`, faded out onto `to` (the shader's). */
export function swarmAlpha(t: number): number {
  return smoothstep(0, 0.12, t) * smoothstep(1, 0.88, t);
}
