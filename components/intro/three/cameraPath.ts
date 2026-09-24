/**
 * The intro's camera flight, as plain numbers.
 *
 * ONE scalar — `fx.flight`, 0 → 1 — carries the whole journey: inside the processor, the
 * power-up, the run down the cavity past the guts, out through the chassis, the lid opening, the
 * screen filling the frame. Beats 1–4 scrub it from the loading progress; beat 5 tweens it to 1
 * off the burst timeline; a skip is that same tween started early. One parameter means no special
 * case anywhere — and it means this file is the only place the shot list lives.
 *
 * **The camera is inside the machine until u ≈ 0.60**, at every aspect. That number is the whole
 * point of the table below: the dissolve from the SVG drawing cannot land before u 0.40 (the
 * scene's readiness signal is worth 0.40 of the progress, so the bar cannot pass 0.60 without it,
 * and `flightFromProgress(0.60)` is exactly 0.40), so anything the interior is meant to SHOW has
 * to happen after 0.40 or no visitor sees it in 3D. It used to end at 0.45.
 *
 * `import type` ONLY. No three.js, no state, no viewport reads (`aspect` is a parameter), and
 * nothing here assumes `u` climbs monotonically — a skip jumps, and every function is a pure
 * lookup that is correct at whatever value it is handed. That is what lets the whole flight be
 * unit-tested without a WebGL context, the property `rig.ts` has today.
 *
 * `components/intro/three/laptop.ts` MUST import `INTRO_LAPTOP` rather than re-declare its own
 * measurements. The flight is aimed at those numbers — the camera leaves through `vent`, pivots
 * about it, and lands on the plane `screen` sits in. A second copy of the frame, drifting by a
 * hundredth of a unit, puts the camera through the back wall instead of through the hole.
 */

/* ---- the machine, in scene units ------------------------------------------------------------- */

/**
 * The frame both intro machines share. Derived from the interior scene's model
 * (`components/scene/three/models/laptop.ts`) so the object a visitor flies out of and the object
 * they meet on the page are recognisably the same one: the lid is 2.4 × 1.5, the display inside it
 * 2.28 × 1.425 (16:10), the hinge sits just inside the deck's back edge, and the lid opens to 1.87
 * rad (107°). Axis convention, also the interior model's: the deck lies on XZ, +y is up, the hinge
 * runs along X at the BACK (−z), and the lid turns about X.
 *
 * Two numbers are NOT the interior model's, deliberately:
 *  · `deck.t` is 0.16 rather than 0.07. The interior machine's deck is a solid slab that is only
 *    ever seen from outside; this one is flown through, and a 0.07 cavity with a 0.01 near plane
 *    would clip the ceiling on every frame of beats 1–3. 0.16 across 2.4 is a 15:1 chassis —
 *    heavier than a laptop, thin enough to read as one, and it leaves 0.066 of headroom either
 *    side of the cavity's centre line, six near planes' worth.
 *  · the hinge bosses are 0.22 wide at ±0.46 rather than 0.3 at ±0.42, so the gap between the
 *    left boss and the middle one is 0.24 — room for a 0.22 vent with a hair of clearance. The
 *    vent is a real hole between real bosses, not a hole cut in a box.
 */
const DECK = { w: 2.4, d: 1.62, t: 0.16 } as const;
/** The chassis wall. The cavity the camera flies down is `deck.t / 2 − skin` either side of y = 0. */
const SKIN = 0.014;
const HINGE = {
  y: DECK.t / 2 + 0.02,
  z: -DECK.d / 2 + 0.02,
  r: 0.1,
  w: 0.22,
  at: [-0.46, 0, 0.46],
} as const;
/**
 * The vent: the gap between the left hinge boss and the middle one, in the back wall. Where the
 * POWER goes — the wave runs out of the die, down the ribs and out of the hole, and the seven
 * segments that draw its grille carry `aU` 1 so they light last of everything.
 *
 * It is no longer where the CAMERA goes. That is `HATCH`.
 */
const VENT = { x: -0.23, y: 0.015, z: HINGE.z, w: 0.22, h: 0.05 } as const;
const LID = { w: 2.4, h: 1.5, t: 0.05, open: 1.87 } as const;
const SCREEN = { w: 2.28, h: 1.425 } as const;
const BEZEL = { x: (LID.w - SCREEN.w) / 2, y: (LID.h - SCREEN.h) / 2 } as const;
/**
 * The processor, on the board floor at the middle of the cavity. `trace` is the half-spacing of
 * the two rows of tracks the camera sits between at K0 — the canyon is 0.18 across inside a 0.26
 * die, and the camera flies 0.03 off the left row.
 */
const DIE = { x: 0, y: -0.024, z: 0.02, w: 0.26, d: 0.26, t: 0.012, trace: 0.09 } as const;
/**
 * THE WAY OUT, and it is in the keyboard: the processor lives under the keys, so that is where
 * the camera surfaces.
 *
 * It is the gap between the middle and back rows of keys, which is a real gap and not a hole cut
 * for the purpose — the rows sit at z −0.11, −0.33 and −0.55 and each key is 0.11 deep, so the
 * deck's top surface is clear from z −0.495 to −0.385. `d` is 0.09 inside that 0.11, leaving a
 * hundredth either side: one near plane, and the camera's own clearance from the key boxes is
 * measured on top of it.
 *
 * `w` is 0.34 and `x` is −0.17 because the exit ray is what sizes an aperture, never the other
 * way round. The camera leaves K3 at x −0.05 and reaches K4 at −1.55, so it is already sliding
 * left as it rises: measured, it crosses the deck's top at x −0.157, and the spread across every
 * aspect is under a thousandth because neither key widens. Centring 0.34 on −0.17 clears that by
 * 0.14 on the far side — and a bay this size reads as a gap between two blocks of keys, where the
 * 0.5 it started at read as half the keyboard being missing.
 *
 * `y` is the deck's top surface. There is no sill and no lintel: the two key rows ARE the edges.
 */
const HATCH = { x: -0.17, y: DECK.t / 2, z: -0.44, w: 0.34, d: 0.09 } as const;

export const INTRO_LAPTOP = {
  deck: DECK,
  skin: SKIN,
  /** Half the height of the cavity the camera flies down. */
  cavity: DECK.t / 2 - SKIN,
  hinge: HINGE,
  vent: VENT,
  hatch: HATCH,
  lid: LID,
  screen: SCREEN,
  bezel: BEZEL,
  /** The display's centre measured UP THE LID from the hinge (lid-local). */
  screenUp: BEZEL.y + SCREEN.h / 2,
  die: DIE,
} as const;

const LID_SIN = Math.sin(LID.open);
const LID_COS = Math.cos(LID.open);

/**
 * Where the display is, and which way it faces, once the lid is fully open — in world units.
 * Beat 6 lands dead on this: the camera sits on `n` at the cover distance, looking back down it.
 * With a world-up camera and a look direction of exactly −n, the camera's up resolves to the
 * lid's own up, so the display is square in frame with zero roll. That is why K7's roll is 0 and
 * must stay 0: a rolled camera needs a longer reach to cover, and `coverDistance` does not know
 * about roll.
 */
export const SCREEN_OPEN = {
  cx: 0,
  cy: HINGE.y + (BEZEL.y + SCREEN.h / 2) * LID_SIN,
  cz: HINGE.z + (BEZEL.y + SCREEN.h / 2) * LID_COS,
  nx: 0,
  ny: -LID_COS,
  nz: LID_SIN,
} as const;

/* ---- the shot list ---------------------------------------------------------------------------- */

export type CameraKey = {
  /** Where on the flight this frame sits. Strictly ascending, 0 at the first key, 1 at the last. */
  readonly u: number;
  readonly px: number;
  readonly py: number;
  readonly pz: number;
  readonly tx: number;
  readonly ty: number;
  readonly tz: number;
  /** Vertical field of view, degrees. */
  readonly fov: number;
  /** Camera roll, radians. The rig spends it as `up = (sin roll, cos roll, 0)`. */
  readonly roll: number;
  /**
   * How hard this key backs off on a narrow viewport: the camera's HORIZONTAL offset from its
   * target is multiplied by `1 + widen · (max(1, 1/aspect) − 1)`, capped at `MAX_WIDEN`. 0 inside
   * the machine, where the walls are the frame and there is nothing to fit.
   */
  readonly widen: number;
  /**
   * K7 only. The position is not read from the table — it is derived so the display COVERS the
   * viewport at every aspect (`coverDistance`). The table's px/py/pz are the 16:10 answer, kept
   * as documentation and pinned by the test.
   */
  readonly cover?: boolean;
};

export type CameraPose = {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
  roll: number;
};

/**
 * Eight frames. One table, several readers — the rig, the test and `docs/05` — the pattern
 * `LAPTOP_BOOT` follows in `components/scene/choreography.ts`.
 *
 *  · **K0 — on the die (u 0).** Inside the processor, 0.03 off a row of tracks, in the canyon
 *    between two of them, looking back down the cavity. Wide (62°) because a wide lens in a small
 *    space is what claustrophobia looks like, rolled 3° because a level horizon here reads as a
 *    diagram. Beat 1 barely moves: it is a held frame, which is why it survives being stretched
 *    to 1.6 s on a slow connection.
 *
 *    **`tz` is −0.32, and it was −0.1.** An aim 0.17 away with `tx` 0.02 against a `px` of −0.06
 *    is a forward vector whose x component is 0.46: the camera was turned **27° across the
 *    cavity**, not down it. Measured, that put the processor's own left package wall at ndc.x
 *    −1.44 — off the side of the frame — so the shot that the table calls "the canyon between two
 *    of them" showed exactly one wall, and beat 3 then had to swing 27° back before it could
 *    start travelling. Pushing the aim down the cavity to 0.41 leaves the same framing of the die
 *    and the same roll, turns the camera to 11°, and puts both walls in shot.
 *  · **K1 — the power-up (u 0.18).** The camera drifts 0.04 forward and no more. Everything that
 *    happens in beat 2 happens in the material, not in the move.
 *  · **K2 — the interior, the vent in shot (u 0.40).** THE FRAME THE CROSS-FADE FROM THE SVG
 *    LANDS ON. `.canvasHost` is transparent until `sceneReady`, so this is the first 3D frame a
 *    visitor actually sees on a warm cache — it has to be a composition, not a moment from the
 *    middle of a tunnel. It is: the rib field of the board floor across the bottom, the three
 *    hinge barrels across the top, and the vent's rectangle of outside light in the left third,
 *    17° off the aim. The camera sits BELOW the cavity's centre line and looks slightly up, so
 *    the two bands read as floor and ceiling rather than as a slot.
 *
 *    **This key is frozen.** Its pose was tuned frame by frame against the dissolve, and
 *    `intro-camera-path.test.ts` pins both its `u` and the vent's place in its frame. The way to
 *    give the interior more screen time is the key AFTER it, not this one.
 *  · **K3 — through the guts (u 0.58).** NEW, and the reason the rest of the table moved back.
 *    K2 used to be the last interior frame: the camera left through the vent at u ≈ 0.45, which
 *    is fifteen hundredths of a flight after the dissolve started and perhaps 150 ms of screen
 *    time. Everything the machine has INSIDE it — the processor's rim, the heatpipe, the fin
 *    stack, the memory, the fan — was therefore built for a shot nobody watched, and the visitor's
 *    reading of the intro was "a laptop", because the laptop is all they were ever shown.
 *
 *    So the corridor is now a beat of its own. K2 → K3 crawls 0.21 of a unit over 0.18 of the
 *    flight — the slowest stretch of the whole film, deliberately — with the camera drifting left
 *    and rising back to the cavity's centre line as it threads between the memory on one side and
 *    the fan on the other. The aim is already through the hole (`tz` −0.88, past the back wall),
 *    so the vent grows in the middle of frame for the whole beat instead of arriving at the end
 *    of it.
 *
 *    The corridor it flies down is x −0.02 → −0.14 at |y| < 0.02, which is what makes the free
 *    volume for interior geometry everything outboard of x +0.05 and x −0.35. `three/laptop.ts`
 *    places the guts against those numbers; moving this key moves them.
 *  · **K4 — through the keyboard (u 0.64).** Just out, barely above the deck, still looking up.
 *    The camera surfaces where the processor is: under the keys.
 *
 *    **This key exists so that the exit ray and the phone can stop fighting.** The segment K3→K4
 *    passes through `hatch` by construction — it crosses the deck's top surface exactly once, in
 *    the clear strip between the middle and back key rows — and `widen` is 0 on BOTH of them, so
 *    that crossing is identical at every aspect and the aperture never has to be sized for a ray
 *    that moves. The frame AFTER it is the one that has to back off on a narrow viewport, and it
 *    now can, because it is no longer the far end of the exit ray. Measured the other way round:
 *    at `MAX_WIDEN` a widened K5 dragged the crossing out to x −0.44, a tenth outside a hatch
 *    that would then have had to be half the keyboard wide.
 *  · **K5 — above the machine (u 0.74).** Off to the left and up, turned back on the machine it
 *    has just come out of, with the open lid and the lit display in frame. `widen` 1.4, not 1:
 *    the display is 2.28 across and a portrait phone is 0.46, so at 1 the camera sat close enough
 *    that only two of the display's four corners were in frame and the worst was 6.1 viewport
 *    widths out — a slab of light rather than a laptop. 1.4 is what puts all four inside at 0.46,
 *    and on anything 1:1 or wider `max(1, 1/aspect)` is 1 and the key does not move at all.
 *
 *    **The lid is OPEN before the camera gets here, and that is a constraint and not a choice.**
 *    A shut lid lies flat at y 0.10–0.15 across the whole deck, two hundredths above the deck's
 *    own top at 0.08: there is no gap to rise through. `lidOpenAt` therefore runs [0.40, 0.60] —
 *    see the note on that function — and the camera surfaces into a machine that is already open
 *    with its display already drawing, which is a better reveal than a lid getting out of the way.
 *
 *    `ty` is 0.6 and `tz` −0.85: the aim sits between the keyboard it came out of and the
 *    display above and behind it, so both are in frame. The old K4 was a low rear three-quarter
 *    aimed at the deck, which was the right answer for a camera that had just been spat out of
 *    the back wall at y 0.092 and is the wrong one for a camera standing above the machine.
 *  · **K6 — the machine whole (u 0.84).** Round to the front-left, the lid open above the deck.
 *    It is the progress→flight handover (`FLIGHT_MAP` tops out at 0.84), which is why the
 *    interior was lengthened by re-timing the keys before it rather than by moving this one: the
 *    burst's wall clock is unchanged. `widen` 1.4 for the same reason as K5 — at 1 the display
 *    still overflowed a portrait viewport by 23%.
 *  · **K7 — the screen (u 1).** On the display's normal at the cover distance, square, roll 0.
 *
 * Every key sits between the 0.01 near plane and the 14 far plane by a wide margin: the closest
 * approach is 0.17 (K0 to its own aim) and the furthest reach, on the narrowest viewport the
 * widen cap allows, is under 10.
 */
export const FLIGHT_KEYS: readonly CameraKey[] = [
  // u      px      py      pz      tx      ty     tz      fov  roll    widen
  { u: 0, px: -0.06, py: 0.012, pz: 0.055, tx: 0.02, ty: 0.006, tz: -0.32, fov: 62, roll: 0.052, widen: 0 },
  { u: 0.18, px: -0.055, py: 0.016, pz: 0.015, tx: 0.02, ty: 0.005, tz: -0.38, fov: 60, roll: 0.042, widen: 0 },
  { u: 0.4, px: -0.06, py: 0.006, pz: -0.18, tx: -0.12, ty: 0.06, tz: -0.48, fov: 54, roll: 0.022, widen: 0 },
  { u: 0.58, px: -0.05, py: 0.01, pz: -0.42, tx: -0.14, ty: 0.24, tz: -0.62, fov: 56, roll: 0.01, widen: 0 },
  { u: 0.64, px: -0.3, py: 0.34, pz: -0.5, tx: -0.16, ty: 0.5, tz: -0.78, fov: 54, roll: 0, widen: 0 },
  { u: 0.74, px: -1.55, py: 0.8, pz: -0.62, tx: -0.1, ty: 0.6, tz: -0.85, fov: 50, roll: -0.02, widen: 1.4 },
  { u: 0.84, px: -2.15, py: 0.92, pz: 0.62, tx: 0, ty: 0.58, tz: -0.58, fov: 46, roll: -0.016, widen: 1.4 },
  { u: 1, px: 0, py: 1.0954, pz: -0.1076, tx: 0, ty: 0.8167, tz: -1.0111, fov: 74, roll: 0, widen: 0, cover: true },
] as const;

/**
 * How far a narrow viewport may back off. Past 3× the camera would be reaching for the 14 far
 * plane on a folded phone, and the machine would be a smudge either way.
 */
export const MAX_WIDEN = 3;

/* ---- progress → flight ------------------------------------------------------------------------ */

/* Defined one level up, in `components/intro/flight.ts`: the director needs it on the no-WebGL
   path too, where this module (and the three.js chunk behind it) is never loaded. Re-exported
   here so everything about the flight is still reachable from one import. */
export { FLIGHT_MAP, flightFromProgress } from "../flight";

/* ---- the ramps -------------------------------------------------------------------------------- */

/** Pure. 0 at or below `from`, 1 at or above `to`, linear between. NaN reads as 0. */
function ramp(u: number, from: number, to: number): number {
  if (!(u > from)) return 0;
  if (u >= to) return 1;
  return (u - from) / (to - from);
}

/**
 * Pure. The lid's travel, 0 shut → 1 open, at `u`.
 *
 * **The window is [0.40, 0.60], and it is dictated by the exit, not chosen.** The camera surfaces
 * through the KEYBOARD at u 0.602 — and a shut lid lies flat across the whole deck at y 0.10 to
 * 0.15, two hundredths above the deck's own top surface at 0.08. There is no gap to fly through:
 * a laptop that is closed has no way out of the top, which is the entire reason the first version
 * of this flight left sideways through the vent in the back wall instead.
 *
 * So the lid is ALREADY OPEN by the time the camera arrives under the hatch. It is not a loss of a
 * beat, it is a better one: the machine opens while the camera is still crawling the corridor, and
 * what the camera surfaces INTO is the lit display, square in front of it, rather than a lid that
 * then has to get out of its way. `screenFillAt` moved with it, so the screen finishes drawing
 * just after the camera is out and there is something to surface into.
 *
 * At 107° the panel is past vertical and sits entirely at z ≤ −0.79, behind the hinge, so it is
 * nowhere near the hatch at z −0.44. Anything under 90° still covers the hatch at SOME height —
 * which is why this window has to close before 0.602 and not merely start before it.
 *
 * A back-out ease: it carries past the top and
 * settles, the way a hinge with mass stops. `c1 = 0.7` and not the textbook 1.70158 — 10% of
 * overshoot on a 107° lid is 10° of it, which reads as a bounce rather than as weight. At 0.7 the
 * peak is 1.76% at 0.726 of the ramp, which is 1.9° on this lid: felt, not seen.
 * The formula is `laptopBootLid`'s, to the constant (`components/scene/choreography.ts`), so the
 * intro machine and the interior machine open the same way. (That function's comment rounds the
 * peak to "about 4% at ~0.77"; the constant is what matters and it is identical here.)
 *
 * `laptop.ts` spends it as `lid.rotation.x = -lidOpenAt(u) * INTRO_LAPTOP.lid.open`.
 */
export function lidOpenAt(u: number): number {
  const a = ramp(u, 0.4, 0.6);
  if (a <= 0) return 0;
  if (a >= 1) return 1;
  const c1 = 0.7;
  const c3 = c1 + 1;
  const k = a - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
}

/**
 * Pure. The display's fill, 0 → 1, for `createRingMaterial`'s `uFill`: the screen draws itself
 * bottom to top as the lid comes up and finishes just after the camera is out of the keyboard, so
 * that the thing it surfaces into is a screen that is already awake. It moved with `lidOpenAt`
 * (see there): both are now ahead of the exit rather than behind it. Linear, because a screen
 * scanning itself on at a steady rate is what a screen powering up looks like; the ease belongs
 * to the lid, which has mass, not to the light, which does not.
 */
export function screenFillAt(u: number): number {
  return ramp(u, 0.46, 0.68);
}

/* ---- the pose --------------------------------------------------------------------------------- */

const FIELDS = ["px", "py", "pz", "tx", "ty", "tz", "fov", "roll"] as const;

/**
 * Pure. The tangent at an INTERIOR key, Fritsch-Carlson: the average of the two secants that meet
 * there, forced to zero wherever they disagree in sign (a local extremum, where the camera really
 * does turn around), and clipped to three times the smaller of them.
 *
 * That clip is the whole reason this shape was chosen over a Catmull-Rom. It makes the curve
 * MONOTONE between its keys -- the camera can never travel past a key's own value and come back --
 * and every safety margin the flight has is stated as "the camera is never inside X". A spline
 * that overshoots by a hundredth of a unit on the way out of the vent puts the lens through the
 * sill, and nothing in the shot list would say so.
 */
function tangent(d0: number, d1: number): number {
  if (d0 * d1 <= 0) return 0;
  const mean = (d0 + d1) / 2;
  const limit = 3 * Math.min(Math.abs(d0), Math.abs(d1));
  return mean > 0 ? Math.min(mean, limit) : Math.max(mean, -limit);
}

/** Pure. One field across one segment: cubic Hermite on its two keys and their two tangents. */
function hermite(y0: number, y1: number, m0: number, m1: number, du: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * du * m0 +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * du * m1
  );
}

/**
 * Pure. How far off the display the camera has to sit for it to COVER the viewport — fill it
 * edge to edge at any aspect, cropping rather than letter-boxing. The smaller of the two reaches:
 * close enough that the frame is no taller than the screen, and close enough that it is no wider.
 * At 16:10 the two are the same number, which is the point of a 16:10 screen.
 */
export function coverDistance(fov: number, aspect: number): number {
  const tan = Math.tan((fov * Math.PI) / 360);
  return Math.min(SCREEN.h / 2 / tan, SCREEN.w / 2 / (tan * aspect));
}

function safeAspect(aspect: number): number {
  return aspect > 0 && aspect < Infinity ? aspect : 1;
}

/** One key, resolved against a live aspect: covered, or widened, or left exactly as written. */
function resolveKey(key: CameraKey, aspect: number): CameraPose {
  const aim = { tx: key.tx, ty: key.ty, tz: key.tz, fov: key.fov, roll: key.roll };
  if (key.cover) {
    const d = coverDistance(key.fov, aspect);
    return {
      px: key.tx + SCREEN_OPEN.nx * d,
      py: key.ty + SCREEN_OPEN.ny * d,
      pz: key.tz + SCREEN_OPEN.nz * d,
      ...aim,
    };
  }
  if (key.widen <= 0) return { px: key.px, py: key.py, pz: key.pz, ...aim };
  const w = Math.min(MAX_WIDEN, Math.max(1, 1 / aspect));
  const k = 1 + key.widen * (w - 1);
  return {
    px: key.tx + (key.px - key.tx) * k,
    py: key.py,
    pz: key.tz + (key.pz - key.tz) * k,
    ...aim,
  };
}

/**
 * Pure. The camera at `u` on the flight, for a viewport of `aspect` (width / height).
 *
 * **A monotone cubic through the keys, NOT a smoothstep between them.** `t^2(3 - 2t)` has the
 * derivative `6t(1 - t)`, which is zero at BOTH ends -- so a per-segment smoothstep brings the
 * camera to a complete STOP at every key and accelerates away again. With eight keys that is six
 * full stops inside the shot, and it is what "the intro feels abrupt" actually was: not a corner
 * anywhere (the old comment was right about that) but stop, go, stop, go. Hermite with
 * Fritsch-Carlson tangents passes through every key just as exactly and carries its momentum
 * through them, so the flight reads as one move with beats in it instead of as six moves.
 *
 * The two ENDS are still clamped to a zero tangent, deliberately, because they are the two places
 * a stop is wanted: K0 is a held frame that a slow connection stretches to 1.6 s, and K6 is the
 * landing -- `IntroDirector` holds the full-frame display still through the whole 0.55 s fade,
 * which is the "fly into the screen, the site is behind it" beat and not a cross-fade over a
 * moving camera.
 *
 * Clamped at BOTH ends and stateless, so a skip that jumps `u` from 0.05 to 0.7 simply returns the
 * frame at 0.7; there is nothing to catch up and nothing to unwind. Handing it a NaN returns the
 * first frame rather than a camera at NaN, which three.js would turn into a black screen with no
 * error.
 *
 * The aspect is a PARAMETER. Nothing here reads a viewport, so the whole flight can be checked
 * across a table of screen sizes in a unit test -- and it has to be, because a key's tangent is
 * measured against its NEIGHBOURS' resolved poses, so a `widen` key bends the curve on both sides
 * of itself and the widen cap is no longer the only thing an aspect changes.
 */
export function cameraAt(u: number, aspect: number): CameraPose {
  const a = safeAspect(aspect);
  const last = FLIGHT_KEYS.length - 1;
  const t = u > 0 ? (u < 1 ? u : 1) : 0;
  let i = 0;
  while (i < last - 1 && t >= FLIGHT_KEYS[i + 1].u) i += 1;

  const ka = FLIGHT_KEYS[i];
  const kb = FLIGHT_KEYS[i + 1];
  const du = kb.u - ka.u;
  const local = du > 0 ? (t - ka.u) / du : 0;
  const k = local > 0 ? (local < 1 ? local : 1) : 0;

  // This segment's two keys, and the two outside it the tangents are measured against.
  const pa = resolveKey(ka, a);
  const pb = resolveKey(kb, a);
  const before = i > 0 ? resolveKey(FLIGHT_KEYS[i - 1], a) : null;
  const after = i + 2 <= last ? resolveKey(FLIGHT_KEYS[i + 2], a) : null;
  const duBefore = i > 0 ? ka.u - FLIGHT_KEYS[i - 1].u : 1;
  const duAfter = i + 2 <= last ? FLIGHT_KEYS[i + 2].u - kb.u : 1;

  const pose = {} as CameraPose;
  for (const f of FIELDS) {
    const d = (pb[f] - pa[f]) / du;
    const m0 = before ? tangent((pa[f] - before[f]) / duBefore, d) : 0;
    const m1 = after ? tangent(d, (after[f] - pb[f]) / duAfter) : 0;
    pose[f] = hermite(pa[f], pb[f], m0, m1, du, k);
  }
  return pose;
}
