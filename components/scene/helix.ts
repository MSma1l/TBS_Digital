/**
 * The Work spiral's layout, as pure arithmetic: where each project card sits around the DNA
 * helix for a given focus, how the scroll maps to that focus, and which card is nearest the
 * middle when there is no spiral. No three.js, no DOM — the driver (workHelix.ts) calls these
 * every frame with numbers it already has, and the unit tests pin them as tables.
 *
 * Frame: a pose is an offset in CSS px from the centre of the spiral zone — the Work track's
 * width (`w`, the section's max-width column, the same box the helix model is placed in) × the
 * sticky layer's height (`sceneH`, the viewport under the header). `y` grows downwards, like
 * the DOM. Card `i` sits `d = i − focus` steps along the strand: `HELIX_ANGLE` around it and
 * `pitch · sceneH` down it, so the card at the focus faces the visitor, the largest and on top.
 */

import type { ScrollSpan } from "@/lib/scene";
import { clamp01, smoothstep } from "./choreography";
import { HELIX_ANGLE } from "./shapes";

/** Spiral only where a card column fits beside the helix: tablets (portrait too) and up. */
export const WORK_HELIX_MEDIA = "(min-width: 768px) and (min-height: 600px)";

/** On the card the front of the spiral (or, without one, the card nearest the middle). */
export const HELIX_FRONT_ATTR = "data-helix-front";

/** Below this many cards there is nothing to turn: the grid (or band) stays, the helix is ambient. */
export const HELIX_MIN_CARDS = 3;

export const HELIX_LAYOUT = {
  /** The strand's axis, as a fraction of the zone's width from its left edge. */
  cx: 0.34,
  /** Orbit radius: min(fraction · w, px). */
  orbit: [0.17, 230],
  /** Card width: clamp(px, fraction · w, px). */
  cardW: [240, 0.27, 340],
  /** Card height: min(fraction · sceneH, px) — Work's own `min-h-61` may still make it taller. */
  cardH: [0.36, 260],
  /** Vertical rise per card, as a fraction of `sceneH`. */
  pitch: 0.18,
  /** Scroll per card: clamp(px, fraction · innerHeight, px). */
  step: [240, 0.38, 380],
  /** Around the strand per card (shapes.ts, shared with the helix model). */
  angle: HELIX_ANGLE,
  /** The hologram plane beside the helix: centre as zone fractions, width min(fraction · w, px). */
  holo: { x: 0.76, y: 0.45, w: [0.34, 440] },
  /** Horizontal margin every card keeps inside the zone… */
  edge: 16,
  /** …plus the Phase 5 rail's width from this zone width up (its markers must stay clear). */
  rail: { from: 861, width: 44 },
} as const;

/** Where the card's box may not go, px from either side of the zone. */
export function helixEdge(w: number): number {
  return HELIX_LAYOUT.edge + (w >= HELIX_LAYOUT.rail.from ? HELIX_LAYOUT.rail.width : 0);
}

export function helixCardWidth(w: number): number {
  const c = HELIX_LAYOUT.cardW;
  return Math.min(c[2], Math.max(c[0], c[1] * w));
}

export function helixCardHeight(sceneH: number): number {
  return Math.min(HELIX_LAYOUT.cardH[0] * sceneH, HELIX_LAYOUT.cardH[1]);
}

/** Scroll between two cards' focus, px, for a viewport `innerHeight` tall. */
export function helixStep(innerHeight: number): number {
  const s = HELIX_LAYOUT.step;
  return Math.min(s[2], Math.max(s[0], s[1] * innerHeight));
}

/** What the driver wants: a spiral needs the built helix, three cards and a wide enough screen. */
export function wantedHelixMode(built: boolean, n: number, wide: boolean): "off" | "spiral" | "ambient" {
  if (!built) return "off";
  return n >= HELIX_MIN_CARDS && wide ? "spiral" : "ambient";
}

/** Scroll progress (0..1) → the focus, 0..n−1. */
export const focusFromProgress = (p: number, n: number): number => clamp01(p) * Math.max(0, n - 1);

/** The scroll offset at which card `i` is the focus: `focusFromProgress`'s inverse. */
export const scrollForCard = (i: number, n: number, span: ScrollSpan): number =>
  span.start + (n > 1 ? i / (n - 1) : 0) * (span.end - span.start);

export type CardPose = {
  /** Offset from the zone's centre, CSS px. */
  x: number;
  y: number;
  scale: number;
  opacity: number;
  /** cos of the card's angle around the strand: 1 facing the visitor, −1 behind the helix. */
  z: number;
  /** 1..11 in front; −1..−9 behind, which paints under the canvas track. */
  zIndex: number;
  face: "front" | "back";
};

export function createCardPose(): CardPose {
  return { x: 0, y: 0, scale: 1, opacity: 1, z: 1, zIndex: 1, face: "front" };
}

/** Card `i`'s pose for `focus` in a `w × sceneH` zone. Allocation-free into `out`. */
export function helixLayout(i: number, focus: number, w: number, sceneH: number, out: CardPose): CardPose {
  const d = i - focus;
  const theta = d * HELIX_LAYOUT.angle;
  const orbit = Math.min(HELIX_LAYOUT.orbit[0] * w, HELIX_LAYOUT.orbit[1]);
  out.z = Math.cos(theta);
  out.scale = 0.62 + 0.38 * ((out.z + 1) / 2) ** 1.5 + 0.12 * Math.exp(-(d * d) / 0.18);
  const half = (helixCardWidth(w) * out.scale) / 2;
  const edge = helixEdge(w);
  const x = (HELIX_LAYOUT.cx - 0.5) * w + Math.sin(theta) * orbit;
  out.x = Math.min(w / 2 - half - edge, Math.max(-w / 2 + half + edge, x));
  out.y = d * HELIX_LAYOUT.pitch * sceneH;
  out.opacity = (1 - smoothstep(1.6, 2.6, Math.abs(d))) * (0.55 + (0.45 * (out.z + 1)) / 2);
  // One threshold for all three: a card behind the strand's plane is behind the canvas too.
  out.face = out.z >= 0 ? "front" : "back";
  out.zIndex = out.z >= 0 ? 1 + Math.round(out.z * 10) : -1 - Math.round(-out.z * 8);
  return out;
}

/** A box in viewport px — a `DOMRect` fits. */
export type CardRect = { left: number; top: number; width: number; height: number };

/**
 * The index of the box whose centre is nearest (`centreX`, `centreY`) — horizontally only
 * without `centreY` (a band's cards share a row). −1 for none; the first wins a tie.
 */
export function nearestCard(rects: ArrayLike<CardRect>, centreX: number, centreY?: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    const dx = r.left + r.width / 2 - centreX;
    const dy = centreY === undefined ? 0 : r.top + r.height / 2 - centreY;
    const dist = dx * dx + dy * dy;
    if (dist < bestD) {
      bestD = dist;
      best = i;
    }
  }
  return best;
}
