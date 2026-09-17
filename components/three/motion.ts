/**
 * Frame-step helpers shared by the scenes. Plain numbers, no three.js.
 */

/** The longest step one frame may advance motion: a hitch or a resumed frameloop never makes anything jump. */
export const MAX_FRAME_STEP = 1 / 20;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Frame-rate independent exponential smoothing of `current` towards `target`: `lambda` is
 * the rate per second (about 8 settles in half a second). A step that is not a positive,
 * finite number leaves `current` where it is.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  if (!(dt > 0) || !Number.isFinite(dt) || !(lambda > 0)) return current;
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
