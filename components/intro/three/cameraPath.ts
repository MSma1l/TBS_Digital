/**
 * The intro's camera flight, as plain numbers.
 *
 * ONE scalar — `fx.flight`, 0 → 1 — carries the whole journey: inside the processor, the
 * power-up, the readable interior, out through the chassis, the lid opening, the screen filling
 * the frame. Beats 1–4 scrub it from the loading progress; beat 5 tweens it to 1 off the burst
 * timeline; a skip is that same tween started early. One parameter means no special case
 * anywhere — and it means this file is the only place the shot list lives.
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
/** The way out: the gap between the left hinge boss and the middle one, in the back wall. */
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

export const INTRO_LAPTOP = {
  deck: DECK,
  skin: SKIN,
  /** Half the height of the cavity the camera flies down. */
  cavity: DECK.t / 2 - SKIN,
  hinge: HINGE,
  vent: VENT,
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
 * lid's own up, so the display is square in frame with zero roll. That is why K5's roll is 0 and
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
   * K5 only. The position is not read from the table — it is derived so the display COVERS the
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
 * Six frames. One table, several readers — the rig, the test and `docs/05` — the pattern
 * `LAPTOP_BOOT` follows in `components/scene/choreography.ts`.
 *
 *  · **K0 — on the die (u 0).** Inside the processor, 0.03 off a row of tracks, in the canyon
 *    between two of them, looking back down the cavity. Wide (62°) because a wide lens in a small
 *    space is what claustrophobia looks like, rolled 3° because a level horizon here reads as a
 *    diagram. Beat 1 barely moves: it is a held frame, which is why it survives being stretched
 *    to 1.6 s on a slow connection.
 *  · **K1 — the power-up (u 0.18).** The camera drifts 0.04 forward and no more. Everything that
 *    happens in beat 2 happens in the material, not in the move.
 *  · **K2 — the interior, the vent in shot (u 0.40).** THE FRAME THE CROSS-FADE FROM THE SVG
 *    LANDS ON. `.canvasHost` is transparent until `sceneReady`, so this is the first 3D frame a
 *    visitor actually sees on a warm cache — it has to be a composition, not a moment from the
 *    middle of a tunnel. It is: the rib field of the board floor across the bottom, the three
 *    hinge barrels across the top, and the vent's rectangle of outside light in the left third,
 *    17° off the aim. The camera sits BELOW the cavity's centre line and looks slightly up, so
 *    the two bands read as floor and ceiling rather than as a slot.
 *  · **K3 — out through the chassis (u 0.66).** Outside, low, rear three-quarter, turned back on
 *    the hole it just came through. The segment K2→K3 passes through `vent` by construction, and
 *    K3's target is the vent horizontally, so widening on a narrow viewport pivots the exit ray
 *    about the hole instead of swinging it into the back wall.
 *
 *    **Horizontally only.** `resolveKey` widens px and pz about the target and leaves py alone,
 *    so a narrow viewport moves K3 further out without lifting it: the ray then crosses the
 *    vent's plane earlier along K2→K3, and lower. Measured, x holds at −0.2300 at every aspect
 *    while y sags from 0.015 at 16:10 to −0.0011 at `MAX_WIDEN`. A symmetric 0.05 aperture
 *    centred on `vent.y` would leave 0.009 of clearance under the ray — inside the 0.01 near
 *    plane, i.e. a sill sliced across the lens on the very frame of the exit. `three/laptop.ts`
 *    absorbs it by dropping the sill (`SILL_DROP`) and making the aperture asymmetric; do not
 *    "tidy" that back to a centred hole without re-measuring this.
 *
 *    The lid is already half up (58° of 107° at u 0.66) and climbing out of the top of frame.
 *
 *    **`ty` is 0.18 and not 0.55.** The position cannot be raised — the camera has to leave
 *    through a hole 0.067 tall, so `py` is fixed at 0.092 by the exit ray and the only thing
 *    free here is the AIM. At 0.55 the camera was tilted 22° up at a piece of empty sky: the
 *    whole machine sat below the bottom of frame from u 0.46 to u 0.63 (measured, 16:10), and
 *    only the lid rising after 0.64 brought anything back into shot. The deck is at y 0 and the
 *    open lid reaches y 1.37, so the aim belongs low, near the deck — the machine then fills the
 *    frame from the bottom third upwards and the lid grows out of the top of it, which is the
 *    beat. Raising `ty` again without moving `py` empties the frame; moving `py` to match puts
 *    the camera through the back wall (the ray crosses `vent.z` at 0.74·K2.py + 0.26·K3.py, and
 *    K2.py is already near the cavity floor).
 *  · **K4 — the lid open (u 0.84).** Pulled back and round to the front-left. Far enough out
 *    (x −2.15) that the straight run from K3 clears the open lid's left edge by 0.11 at every
 *    aspect: the interpolation between two keys is a straight line, so a nearer K4 puts the
 *    camera through the panel.
 *  · **K5 — the screen (u 1).** On the display's normal at the cover distance, square, roll 0.
 *
 * Every key sits between the 0.01 near plane and the 14 far plane by a wide margin: the closest
 * approach is 0.17 (K0 to its own aim) and the furthest reach, on the narrowest viewport the
 * widen cap allows, is under 10.
 */
export const FLIGHT_KEYS: readonly CameraKey[] = [
  // u      px      py      pz      tx      ty     tz      fov  roll    widen
  { u: 0, px: -0.06, py: 0.012, pz: 0.055, tx: 0.02, ty: 0.006, tz: -0.1, fov: 62, roll: 0.052, widen: 0 },
  { u: 0.18, px: -0.055, py: 0.016, pz: 0.015, tx: 0.02, ty: 0.005, tz: -0.16, fov: 60, roll: 0.042, widen: 0 },
  { u: 0.4, px: -0.02, py: -0.012, pz: -0.45, tx: -0.1, ty: 0.028, tz: -0.76, fov: 52, roll: 0.022, widen: 0 },
  { u: 0.66, px: -0.828, py: 0.092, pz: -1.758, tx: -0.23, ty: 0.18, tz: -0.79, fov: 54, roll: -0.034, widen: 1 },
  { u: 0.84, px: -2.15, py: 0.92, pz: 0.62, tx: 0, ty: 0.58, tz: -0.58, fov: 46, roll: -0.016, widen: 1 },
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
 * Pure. The lid's travel, 0 shut → 1 open, at `u`. A back-out ease: it carries past the top and
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
  const a = ramp(u, 0.62, 0.84);
  if (a <= 0) return 0;
  if (a >= 1) return 1;
  const c1 = 0.7;
  const c3 = c1 + 1;
  const k = a - 1;
  return 1 + c3 * k * k * k + c1 * k * k;
}

/**
 * Pure. The display's fill, 0 → 1, for `createRingMaterial`'s `uFill`: the screen draws itself
 * bottom to top as the lid comes up and finishes just before the dive. Linear, because a screen
 * scanning itself on at a steady rate is what a screen powering up looks like; the ease belongs
 * to the lid, which has mass, not to the light, which does not.
 */
export function screenFillAt(u: number): number {
  return ramp(u, 0.62, 0.95);
}

/* ---- the pose --------------------------------------------------------------------------------- */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => t * t * (3 - 2 * t);

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
 * `smoothstep` between neighbouring keys, so speed is continuous where two beats meet — no key is
 * a corner. Clamped at BOTH ends and stateless, so a skip that jumps `u` from 0.05 to 0.7 simply
 * returns the frame at 0.7; there is nothing to catch up and nothing to unwind. Handing it a NaN
 * returns the first frame rather than a camera at NaN, which three.js would turn into a black
 * screen with no error.
 *
 * The aspect is a PARAMETER. Nothing here reads a viewport, so the whole flight can be checked
 * across a table of screen sizes in a unit test.
 */
export function cameraAt(u: number, aspect: number): CameraPose {
  const a = safeAspect(aspect);
  const last = FLIGHT_KEYS.length - 1;
  const t = u > 0 ? (u < 1 ? u : 1) : 0;
  let i = 0;
  while (i < last - 1 && t >= FLIGHT_KEYS[i + 1].u) i += 1;
  const ka = FLIGHT_KEYS[i];
  const kb = FLIGHT_KEYS[i + 1];
  const span = kb.u - ka.u;
  const local = span > 0 ? (t - ka.u) / span : 0;
  const k = smooth(local > 0 ? (local < 1 ? local : 1) : 0);
  const pa = resolveKey(ka, a);
  const pb = resolveKey(kb, a);
  return {
    px: lerp(pa.px, pb.px, k),
    py: lerp(pa.py, pb.py, k),
    pz: lerp(pa.pz, pb.pz, k),
    tx: lerp(pa.tx, pb.tx, k),
    ty: lerp(pa.ty, pb.ty, k),
    tz: lerp(pa.tz, pb.tz, k),
    fov: lerp(pa.fov, pb.fov, k),
    roll: lerp(pa.roll, pb.roll, k),
  };
}
