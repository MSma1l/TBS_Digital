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
 *
 * The pose is a real 3D one: the card rides the cylinder, so it also **turns with it**
 * (`rotY` ≈ its angle around the strand, damped) and leans along the strand's rise (`rotX`),
 * and the far side of the orbit is pushed away from the camera (`tz`, always ≤ 0). The driver
 * writes `perspective(P) translate3d(x, y, tz) scale(s) rotateY(…) rotateX(…)`: every card is
 * laid out in the same grid cell, so its transform origin — and with it the vanishing point — is
 * the centre of the sticky zone for all of them. One shared camera, without a `perspective`
 * property on the track (that would make the track a stacking context and lift the back cards
 * out from under the canvas).
 *
 * Two phases bracket the run of cards, so neither end is a cut (`CardPhase`):
 *  · `form` 0 → 1 — the entrance. It is **timed, not scrubbed**: the caller passes the Work
 *    gate's value (fx.ts `stepGate`, `WORK_SECONDS`), the same 1.2s ramp that forms the helix
 *    out of the swarm, and `helixForm` staggers it card by card along the strand, so the deck
 *    assembles onto the helix instead of being there already. It runs to 1 on its own and can
 *    never rest half-formed at a scroll position; with no scene (reduced motion, the fallback)
 *    there is no driver at all and the cards stay in Work's grid.
 *  · `exit` 0 → 1 over `helixOutro` px of track **after** the last card is the focus — the focus
 *    keeps advancing at the very same rate (no stall), and the deck is drawn into the axis,
 *    turned edge-on and faded: the spiral resolves instead of freezing on its last card.
 */

import { scrollProgress, type ScrollSpan } from "@/lib/scene";
import { clamp01, smoothstep } from "./choreography";
import { HELIX_ANGLE } from "./shapes";

/** Spiral only where a card column fits beside the helix: tablets (portrait too) and up. */
export const WORK_HELIX_MEDIA = "(min-width: 768px) and (min-height: 600px)";

/** On the card the front of the spiral (or, without one, the card nearest the middle). */
export const HELIX_FRONT_ATTR = "data-helix-front";

/**
 * On a card from the moment its own arrival starts (`helixForm` above 0) until it is unformed
 * again — the spiral only. Work's CSS hangs the card's screenshot reveal off it (app/tailwind.css
 * `work-media-reveal` / `work-scan`), so the image materialises with the card instead of simply
 * being there; `HELIX_FRONT_ATTR` drives the pass it makes when the card reaches the front. Both
 * are CSS animations on their own clock: the driver writes an attribute once, never a frame.
 */
export const HELIX_LIT_ATTR = "data-helix-lit";

/** Below this many cards there is nothing to turn: the grid (or band) stays, the helix is ambient. */
export const HELIX_MIN_CARDS = 3;

export const HELIX_LAYOUT = {
  /** The strand's axis, as a fraction of the zone's width from its left edge. */
  cx: 0.34,
  /** Orbit radius: min(fraction · w, px). */
  orbit: [0.19, 240],
  /** Card width: clamp(px, fraction · w, px). */
  cardW: [240, 0.24, 320],
  /** Card height: min(fraction · sceneH, px) — Work's own `min-h-61` may still make it taller. */
  cardH: [0.36, 260],
  /**
   * Vertical rise per card, as a fraction of `sceneH`. With the narrower card and the wider
   * orbit above, one step of this is about a card's own height at the focus, so neighbours sit
   * beside each other on the strand instead of stacking. As high as `fade` below allows: a
   * visible card must stay inside ±(sceneH + cardH)/2 of the zone's centre.
   */
  pitch: 0.29,
  /**
   * Where a card fades out, in steps from the focus. Tighter than the orbit is long on purpose:
   * five cards on the strand at a time, not seven, so each one is its own object and the helix
   * shows between them.
   */
  fade: [1.35, 2.25],
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
  /**
   * The camera. `depth` is the `perspective()` the driver writes on every card; because all the
   * cards share one grid cell, they share its vanishing point (the zone's centre). `back` is how
   * far the far side of the orbit is pushed away from it, px — never towards it, so a card's
   * projected box only ever shrinks and the `edge` clamp below stays an upper bound.
   */
  camera: { depth: 1200, back: 260 },
  /**
   * How much of its own angle a card turns through, and how far it leans along the strand's rise
   * (radians per step of `d`, capped) — the pose that makes it ride the helix instead of sliding
   * across it. `y` is damped below 1: a fully tangent card is edge-on two steps out, a sliver of
   * type at an angle nobody can read.
   */
  turn: { y: 0.62, x: 0.055, xMax: 2.2 },
} as const;

/**
 * The finish. `steps` cards' worth of scroll is added to the track after the last card reaches
 * the focus and the focus keeps running through it at the same rate — so the hand-over is
 * seamless — while the deck folds into the axis: `x` pulled this share of the way onto the
 * strand, the scale and opacity taken down, the turn wound up. `from` is where the fold starts
 * inside the outro (its speed at 0 is 0, so nothing kicks).
 */
export const HELIX_OUTRO = {
  steps: 1.35,
  from: 0.1,
  x: 0.86,
  scale: 0.5,
  turn: 0.55,
  back: 420,
} as const;

/**
 * The entrance, as shares of the Work gate's 0 → 1 (fx.ts `WORK_SECONDS.form`, 1.2s): the card at
 * the focus starts forming at `from` and takes `ramp`; a card `span` steps further along the
 * strand starts `lag` later. `from + lag + ramp` is exactly 1, so every card has the same arrival
 * and the last of them lands precisely as the gate closes — no card can be left half-formed.
 * `lag` is the larger share on purpose: it is what the eye reads as a cascade down the strand
 * (0.44 × 1.2s ≈ 530ms between the first card and the last), and Work's CSS runs each card's
 * screenshot on the same beat (`HELIX_LIT_ATTR`).
 * Meanwhile the swarm is flying over from the service model and the helix is dissolving in
 * (`smoothstep(0.7, 1)` of the same gate, choreography.ts `composeScene`): strands first, then the
 * deck onto them.
 */
export const HELIX_ENTER = { from: 0.28, lag: 0.44, ramp: 0.28, span: 5 } as const;

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

/**
 * The finish's own scroll, px: track added past the last card's focus. The track grows by exactly
 * this and the focus span shrinks by it, so the cards' cadence (`helixStep` each) never changes.
 */
export function helixOutro(innerHeight: number): number {
  return HELIX_OUTRO.steps * helixStep(innerHeight);
}

/**
 * How long the finish runs, px — longer than the track it added, by the slack a sticky card still
 * has under the layer once the outro's own scroll is spent (`(sceneH − card) / 2`, for a card at
 * the floor height). That slack is the stretch the old spiral froze in: running the finish over it
 * too means the helix has just dissolved as the cards come unstuck and the next section arrives —
 * no dead screen between the two. A taller card comes unstuck a little earlier, by which time it
 * has long been at opacity 0.
 */
export function helixExitLength(innerHeight: number, sceneH: number): number {
  return helixOutro(innerHeight) + Math.max(0, (sceneH - helixCardHeight(sceneH)) / 2);
}

/** Pure. How far into the finish `scrollY` is: 0 up to the last card's focus, 1 at its end. */
export function helixExitAt(scrollY: number, span: ScrollSpan, exitLength: number): number {
  if (!(exitLength > 0) || !Number.isFinite(scrollY)) return 0;
  return clamp01((scrollY - span.end) / exitLength);
}

/**
 * Pure. The pose focus at `scrollY`: 0..n−1 over the cards, then straight on through the finish at
 * the very same rate (`stepPx` of scroll a card), so the hand-over has no change of speed at all.
 */
export function helixFocusAt(
  scrollY: number,
  span: ScrollSpan,
  n: number,
  stepPx: number,
  exitLength: number,
): number {
  const base = focusFromProgress(scrollProgress(scrollY, span), n);
  if (!(stepPx > 0) || !(exitLength > 0) || !Number.isFinite(scrollY)) return base;
  return base + Math.min(exitLength, Math.max(0, scrollY - span.end)) / stepPx;
}

/**
 * Pure. How formed card `i` is (0 → 1) for a Work gate at `gate`, staggered along the strand: the
 * card at the focus leads, one `HELIX_ENTER.span` steps away lands `lag` of the gate later.
 */
export function helixForm(gate: number, i: number, focus: number): number {
  const g = clamp01(gate);
  const away = clamp01(Math.abs(i - (Number.isFinite(focus) ? focus : 0)) / HELIX_ENTER.span);
  const from = HELIX_ENTER.from + HELIX_ENTER.lag * away;
  return smoothstep(from, from + HELIX_ENTER.ramp, g);
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
  /** Towards the camera, CSS px — never positive: the orbit's far side is pushed away, only. */
  tz: number;
  scale: number;
  /** The card's turn around the strand's axis and its lean along its rise, radians. */
  rotY: number;
  rotX: number;
  opacity: number;
  /** cos of the card's angle around the strand: 1 facing the visitor, −1 behind the helix. */
  z: number;
  /** 1..11 in front; −1..−9 behind, which paints under the canvas track. */
  zIndex: number;
  face: "front" | "back";
};

/** A card's place in the entrance (`form` 0 → 1, `helixForm`) and in the finish (`exit`, `helixExitAt`). */
export type CardPhase = { form: number; exit: number };

/** Formed and not leaving: the pose a card holds through the run of the spiral. */
export const HELIX_SETTLED: CardPhase = { form: 1, exit: 0 };

export function createCardPose(): CardPose {
  return { x: 0, y: 0, tz: 0, scale: 1, rotY: 0, rotX: 0, opacity: 1, z: 1, zIndex: 1, face: "front" };
}

/** Card `i`'s pose for `focus` in a `w × sceneH` zone. Allocation-free into `out`. */
export function helixLayout(
  i: number,
  focus: number,
  w: number,
  sceneH: number,
  out: CardPose,
  phase: CardPhase = HELIX_SETTLED,
): CardPose {
  const d = i - focus;
  const theta = d * HELIX_LAYOUT.angle;
  const orbit = Math.min(HELIX_LAYOUT.orbit[0] * w, HELIX_LAYOUT.orbit[1]);
  out.z = Math.cos(theta);
  out.scale = 0.62 + 0.38 * ((out.z + 1) / 2) ** 1.5 + 0.12 * Math.exp(-(d * d) / 0.18);
  out.y = d * HELIX_LAYOUT.pitch * sceneH;
  out.opacity =
    (1 - smoothstep(HELIX_LAYOUT.fade[0], HELIX_LAYOUT.fade[1], Math.abs(d))) * (0.55 + (0.45 * (out.z + 1)) / 2);
  // The card rides the cylinder: it faces outwards along its own angle (damped, so a card two
  // steps out is still a card and not a sliver), leans along the strand's rise, and the far half
  // of the orbit sits further from the camera.
  out.rotY = HELIX_LAYOUT.turn.y * theta;
  out.rotX = -HELIX_LAYOUT.turn.x * Math.max(-HELIX_LAYOUT.turn.xMax, Math.min(HELIX_LAYOUT.turn.xMax, d));
  out.tz = (-HELIX_LAYOUT.camera.back * (1 - out.z)) / 2;
  // One threshold for all three: a card behind the strand's plane is behind the canvas too.
  out.face = out.z >= 0 ? "front" : "back";
  out.zIndex = out.z >= 0 ? 1 + Math.round(out.z * 10) : -1 - Math.round(-out.z * 8);

  const axis = (HELIX_LAYOUT.cx - 0.5) * w;
  // Both ends of the run fold the card onto the axis the same way — the entrance backwards.
  const fold = clamp01(1 - clamp01(phase.form) + smoothstep(HELIX_OUTRO.from, 1, clamp01(phase.exit)));
  if (fold > 0) {
    out.scale *= 1 - HELIX_OUTRO.scale * fold;
    out.rotY *= 1 + HELIX_OUTRO.turn * fold;
    out.tz -= HELIX_OUTRO.back * fold;
    out.opacity *= (1 - fold) ** 1.6;
  }
  const half = (helixCardWidth(w) * out.scale) / 2;
  const edge = helixEdge(w);
  const x = axis + Math.sin(theta) * orbit * (1 - HELIX_OUTRO.x * fold);
  out.x = Math.min(w / 2 - half - edge, Math.max(-w / 2 + half + edge, x));
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
