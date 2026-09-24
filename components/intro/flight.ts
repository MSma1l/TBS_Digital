/**
 * Where the camera is on its six-beat flight, for a given loading progress.
 *
 * Its own module, and a deliberately tiny one: `IntroDirector` needs this mapping on EVERY path,
 * including the device with no WebGL that never loads the scene chunk at all. The rest of the
 * flight — the key table, the poses, the machine's frame — lives in `three/cameraPath.ts` and
 * belongs to the 3D chunk. Keeping the two apart is what keeps the no-WebGL page inside its
 * weight budget, which has a few hundred bytes of headroom, not a few thousand.
 *
 * Pure: no imports, no state, no DOM.
 */

/**
 * The loading progress each beat ends on, and where that is on the flight.
 *
 * The bands are the readiness model's own plateaus (`IntroDirector.tsx` `WEIGHT`): the floor plus
 * the fonts, then `window.load`, then the scene itself compiling, then the last of the curve.
 * **0.24, not 0.30.** On a warm cache beat 1 runs 0 → 0.24 in about 600 ms and beat 2 gets the
 * other 400 — at 0.30 beat 2 was under 300 ms AND cut in half by the cross-fade, the weakest
 * moment in the whole intro. Beat 1 is a held frame and takes the shortening; beat 2 is a ramp of
 * light and does not. Do not round it back up.
 *
 * The slope climbs across the table (0.75 → 0.61 → 0.72 → 1.29). That is deliberate: it cancels
 * the ease-out of the cinematic curve, which otherwise spends 47% of the progress in the first
 * quarter of the time and eats beats 1 and 2 alive. The rows are the contract and the reader
 * below smooths BETWEEN them — it lands on every one of them exactly, so these numbers still mean
 * what they say.
 *
 * Full progress lands at u 0.84, not 1. The last stretch belongs to the burst timeline's wall
 * clock — the dive into the screen is never scrubbed and never compressed.
 */
export const FLIGHT_MAP: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.24, 0.18],
  [0.6, 0.4],
  [0.86, 0.66],
  [1, 0.84],
] as const;

/** Pure. The secant either side of a row, and the monotone tangent they allow at it. */
function tangent(d0: number, d1: number): number {
  if (d0 * d1 <= 0) return 0;
  const mean = (d0 + d1) / 2;
  const limit = 3 * (d0 < d1 ? d0 : d1);
  return mean < limit ? mean : limit;
}

/** Pure. The secant of band `i`, in flight units per unit of progress. */
function slope(i: number): number {
  const [p0, u0] = FLIGHT_MAP[i];
  const [p1, u1] = FLIGHT_MAP[i + 1];
  return (u1 - u0) / (p1 - p0);
}

/**
 * Pure. Progress 0..1 → flight 0..0.84, clamped at both ends, landing on every row of the table
 * exactly — the table is still the contract.
 *
 * **A monotone cubic through the rows, not straight lines between them.** The slopes climb across
 * the table (0.75 → 0.61 → 0.72 → 1.29) and that climb is deliberate: it cancels the ease-out of
 * the cinematic curve, which otherwise spends 47% of the progress in the first quarter of the
 * time. But piecewise-linear turns each of those changes into a CORNER — the flight's speed jumps
 * 19%, then 18%, then **79%**, instantaneously, at p 0.24, 0.60 and 0.86. The last one is the bad
 * one: it lands at u 0.66, a hundredth after the camera has whipped out through the vent and while
 * it is swinging round the machine, so the two accelerations compound into the worst-felt moment
 * of the intro.
 *
 * Fritsch–Carlson tangents keep the curve MONOTONE — progress can never make the flight go
 * backwards, which is the one property the whole scrub rests on — while giving it a continuous
 * speed. Same rows, same boundaries, no corners. The three extra lines are worth roughly 200 bytes
 * on the no-WebGL path, which is inside this module's headroom; the camera path's own spline
 * (`three/cameraPath.ts`) is the same shape, for the same reason.
 */
export function flightFromProgress(p: number): number {
  const last = FLIGHT_MAP.length - 1;
  if (!(p > 0)) return FLIGHT_MAP[0][1];
  if (p >= FLIGHT_MAP[last][0]) return FLIGHT_MAP[last][1];
  let i = 0;
  while (i < last - 1 && p >= FLIGHT_MAP[i + 1][0]) i += 1;
  const [p0, u0] = FLIGHT_MAP[i];
  const [p1, u1] = FLIGHT_MAP[i + 1];
  const dp = p1 - p0;
  const d = (u1 - u0) / dp;
  // Zero at both ends of the table: the held frame at 0, and the hand-over to the burst at 0.84.
  const m0 = i > 0 ? tangent(slope(i - 1), d) : 0;
  const m1 = i + 2 <= last ? tangent(d, slope(i + 1)) : 0;
  const t = (p - p0) / dp;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * u0 +
    (t3 - 2 * t2 + t) * dp * m0 +
    (-2 * t3 + 3 * t2) * u1 +
    (t3 - t2) * dp * m1
  );
}

