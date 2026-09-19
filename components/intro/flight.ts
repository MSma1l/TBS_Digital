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
 * quarter of the time and eats beats 1 and 2 alive.
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

/** Pure. Progress 0..1 → flight 0..0.84, piecewise linear, clamped at both ends. */
export function flightFromProgress(p: number): number {
  const last = FLIGHT_MAP.length - 1;
  if (!(p > 0)) return FLIGHT_MAP[0][1];
  if (p >= FLIGHT_MAP[last][0]) return FLIGHT_MAP[last][1];
  let i = 0;
  while (i < last - 1 && p >= FLIGHT_MAP[i + 1][0]) i += 1;
  const [p0, u0] = FLIGHT_MAP[i];
  const [p1, u1] = FLIGHT_MAP[i + 1];
  return u0 + ((p - p0) / (p1 - p0)) * (u1 - u0);
}

