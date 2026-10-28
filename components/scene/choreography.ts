/**
 * Where Work's DNA helix sits and how it is drawn in — as pure arithmetic. No three.js, no DOM:
 * the world calls these every frame with numbers it already has, and the unit tests pin them as
 * tables. (Since 2026-10-28 the helix is the scene's only resident: Hero, Ticker and Directions
 * draw static SVG art and the service pages have no stage, so the hero chip, the service models,
 * their morph and the service-page placements are gone from here.)
 *
 * Coordinates: the canvas is the sticky layer (`h-scene`, under the header). A DOM box is
 * turned into scene space on the z = 0 plane of the fixed camera below; `y` grows upwards.
 *
 * Scroll: the director measures document rects and scroll spans into the probe at every
 * ScrollTrigger refresh; the scene reads `window.scrollY` once per frame against them.
 */

import type { DocRect, ScrollProbe, ScrollSpan } from "@/lib/scene";
import { HELIX } from "@/components/art/shapes";

export const SCENE_CAMERA = { z: 10, fov: 35, near: 0.1, far: 60 } as const;

export function clamp01(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Scene units per CSS pixel on the z = 0 plane of a canvas `h` pixels tall. */
export function worldPerPx(h: number): number {
  return (2 * SCENE_CAMERA.z * Math.tan((SCENE_CAMERA.fov * Math.PI) / 360)) / Math.max(1, h);
}

/** Where a model sits on the canvas: its centre in scene units and its scale. */
export type Placement = { x: number; y: number; scale: number };

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

/* ---- who draws what -------------------------------------------------------------------- */

/** What a frame draws of the helix, from the Work gate's value (fx.ts, run in time). */
export type HelixComposition = {
  /** The helix's reveal: 0 not drawn → 1 formed. */
  helix: number;
  /**
   * How far through its arrival the helix is, 0..1 (three/models/helix.ts `helixArrivePose`): the
   * molecule is synthesised over the Work gate's own 1.2s — filament, unwind, replication bubble,
   * bits, hologram. 1 whenever the gate is shut, which is the formed helix: nothing is drawn then,
   * and a composition that never opened the gate has nothing left to arrive.
   */
  helixArrive: number;
};

export function createHelixComposition(): HelixComposition {
  return { helix: 0, helixArrive: 1 };
}

/**
 * The frame's plan from the Work gate's value `work`, written into `out` (no allocation per
 * frame): the helix is drawn from the first frame of the gate — as a filament, then unwinding.
 * What it looks like on the way is `helixArrive`'s business; `helix` only says it is drawn at
 * all, fully from 30% of the gate on. At 0 nothing is drawn.
 */
export function composeHelix(work: number, out: HelixComposition): HelixComposition {
  const k = clamp01(work);
  out.helix = k > 0 ? smoothstep(0, 0.3, k) : 0;
  out.helixArrive = k > 0 ? k : 1;
  return out;
}
