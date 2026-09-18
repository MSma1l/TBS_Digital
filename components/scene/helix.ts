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
 * The custom property the driver writes on each card for its screenshot's reveal, 0 → 1
 * (`helixWipe`). Work's CSS clips the picture and rides a scan sheet on it (app/tailwind.css
 * `work-media-reveal` / `work-scan`); absent — no scene, reduced motion, the phone's band — it
 * defaults to 1 and the screenshot is simply there, as it always was.
 */
export const HELIX_WIPE_PROP = "--helix-wipe";

/** Below this many cards there is nothing to turn: the grid (or band) stays, the helix is ambient. */
export const HELIX_MIN_CARDS = 3;

export const HELIX_LAYOUT = {
  /** The strand's axis, as a fraction of the zone's width from its left edge. */
  cx: 0.34,
  /** Orbit radius: min(fraction · w, px). */
  orbit: [0.19, 240],
  /**
   * Card width: clamp(px, fraction · w, px). The fraction is what shrank this round, so a wide
   * window gets the smaller card the longer travel needed; the 240px floor is the one measured
   * for the copy's contrast over a screenshot (Work.tsx) and does not move — below it the chips'
   * own ink plate starts to lose its margin on the brightest screenshots.
   */
  cardW: [240, 0.215, 300],
  /** Card height: min(fraction · sceneH, px) — Work's own `min-h-61` may still make it taller. */
  cardH: [0.36, 260],
  /**
   * Vertical rise per card, as a fraction of `sceneH`. With the narrower card and the wider
   * orbit above, one step of this is about a card's own height at the focus, so neighbours sit
   * beside each other on the strand instead of stacking. As high as `fade` below allows: a
   * visible card must stay inside ±(sceneH + cardH)/2 of the zone's centre.
   */
  pitch: 0.34,
  /**
   * Where a card fades out, in steps from the focus. Wide enough that a card is still solid as
   * it slides in at the bottom of the zone and as it leaves at the top — it reaches opacity 0
   * only once its box is clear of the layer, so nothing ever winks out in front of the visitor
   * (scene-helix.test.ts pins exactly that).
   */
  fade: [1.55, 2.6],
  /**
   * Where the card's screenshot builds up, in steps from the focus — signed, and only on the way
   * in: 0 at `wipe[1]` to 1 at `wipe[0]`, after which it stays 1 for the whole of the card's way
   * out over the top. Work's CSS reads it as `--helix-wipe` (app/tailwind.css
   * `work-media-reveal`), so the picture is drawn on by the scroll the visitor is making, not by
   * a one-shot timer they will have missed.
   *
   * The band is chosen so the wipe's own edge is **on screen** while it travels, which is the
   * whole point: over these 0.85 steps (≈258px of scroll at 1280×800) the edge climbs from the
   * bottom of the viewport to about two thirds up it — 70% of the wipe happens in plain sight,
   * on a card that is 60–100% opaque. It is done well before the card is the one at the front,
   * so the card being read, and every card above it, always shows its picture whole.
   */
  wipe: [0.65, 1.5],
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
 * the focus, and the focus keeps running through it — so the last card leaves over the top of the
 * zone exactly as every card before it did, and nothing is folded onto the axis. `lift` is how
 * much faster the focus is running by the end of it (a rate of 1 + `lift`, reached smoothly from
 * exactly 1 at the hand-over, so there is no kick): the deck is drawn up and out as the helix
 * winds up, and the whole run of cards has cleared the fade window by the time the finish ends.
 */
export const HELIX_OUTRO = { steps: 1.35, lift: 0.6 } as const;

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
export const HELIX_ENTER = { from: 0.28, lag: 0.44, ramp: 0.28, span: 5, rise: 0.55 } as const;

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
 * The slack a sticky card still has under the layer once the track's own scroll is spent:
 * `(sceneH − card) / 2` for a card at the floor height. It is the stretch the very first spiral
 * froze in, and the finish spends it rather than leaving it dead.
 */
export function helixSlack(sceneH: number): number {
  return Math.max(0, (sceneH - helixCardHeight(sceneH)) / 2);
}

/**
 * The finish's own scroll, px: track added past the last card's focus. The track grows by exactly
 * this and the focus span shrinks by it, so the cards' cadence (`helixStep` each) never changes.
 *
 * Normally that is `HELIX_OUTRO.steps` cards' worth. The floor underneath it is what the deck
 * needs to be *gone*: together with the slack below and the `lift` the focus eases up to, the
 * finish must carry the last card the whole `fade` window out over the top of the zone, or the
 * helix would dissolve with a card still faintly on screen. On a normal window the floor is well
 * under `steps` and nothing is added; a very short layer (little slack to spend) buys the rest.
 */
export function helixOutro(innerHeight: number, sceneH: number): number {
  const step = helixStep(innerHeight);
  const needed = (HELIX_LAYOUT.fade[1] * step) / (1 + HELIX_OUTRO.lift / 2) - helixSlack(sceneH);
  return Math.max(HELIX_OUTRO.steps * step, needed);
}

/**
 * How long the finish runs, px — the track it added plus the slack below it. So the helix has
 * just dissolved as the cards come unstuck and the next section arrives: no dead screen between
 * the two. A taller card comes unstuck a little earlier, by which time it is long gone.
 */
export function helixExitLength(innerHeight: number, sceneH: number): number {
  return helixOutro(innerHeight, sceneH) + helixSlack(sceneH);
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
  const t = clamp01((scrollY - span.end) / exitLength);
  // t at rate 1 (the cards' own cadence, so the hand-over has no kick) easing up to 1 + `lift`.
  return base + (exitLength / stepPx) * (t + (HELIX_OUTRO.lift * t * t) / 2);
}

/**
 * Pure. How much of card `i`'s screenshot is drawn in at `focus`: 0 while it is still climbing
 * into the bottom of the zone, 1 from `HELIX_LAYOUT.wipe[0]` steps below the front onwards —
 * and 1 for the whole of its way out over the top, so a picture is never taken apart again once
 * the visitor has seen it whole.
 */
export function helixWipe(i: number, focus: number): number {
  const d = i - (Number.isFinite(focus) ? focus : 0);
  const [full, none] = HELIX_LAYOUT.wipe;
  return 1 - smoothstep(full, none, d);
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

/** A card's place in the section's entrance: 0 → 1, `helixForm`. The finish needs nothing — the
 *  focus simply runs on and the cards leave over the top, like every card before them. */
export type CardPhase = { form: number };

/** Formed: the pose a card holds through the whole run of the spiral. */
export const HELIX_SETTLED: CardPhase = { form: 1 };

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

  // The section's entrance: the deck climbs into the zone from below it, never out of the axis.
  // Nothing horizontal moves, so a card arrives on the very path it will keep travelling.
  const form = clamp01(phase.form);
  if (form < 1) {
    out.y += (1 - form) * HELIX_ENTER.rise * sceneH;
    out.opacity *= form;
  }
  const half = (helixCardWidth(w) * out.scale) / 2;
  const edge = helixEdge(w);
  const x = (HELIX_LAYOUT.cx - 0.5) * w + Math.sin(theta) * orbit;
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
