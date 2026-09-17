/**
 * The pointer tilt on cards (hero stats, project cards), as pure math.
 *
 * No `"use client"`, no DOM: `components/fx/usePointerTilt.ts` reads the pointer and writes
 * the CSS variables; everything here is a number in, a number out, and unit-tested.
 */

/** A real hovering, precise pointer — the only kind that tilts. */
export const TILT_QUERY = "(hover: hover) and (pointer: fine)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Largest tilt in degrees, per card kind. */
export const TILT_MAX = { metric: 8, project: 6 } as const;

export type TiltRect = { left: number; top: number; width: number; height: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Two decimals, and never `-0` (it would print as "-0deg"). */
const round2 = (v: number) => Math.round(v * 100) / 100 + 0;

/**
 * Degrees for a pointer at (x, y) over `rect`: the edge under the pointer dips away from the
 * viewer. Centre → 0/0; a pointer outside the rect is clamped to the edge; a rect with no
 * area never tilts.
 */
export function tiltFor(
  x: number,
  y: number,
  rect: TiltRect,
  maxDeg: number,
): { rx: number; ry: number } {
  if (!(rect.width > 0 && rect.height > 0)) return { rx: 0, ry: 0 };
  const nx = clamp(((x - rect.left) / rect.width) * 2 - 1, -1, 1);
  const ny = clamp(((y - rect.top) / rect.height) * 2 - 1, -1, 1);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return { rx: 0, ry: 0 };
  return { rx: round2(-ny * maxDeg), ry: round2(nx * maxDeg) };
}

/** Tilt only for a mouse on a fine, hovering pointer, and never under reduced motion. */
export function shouldTilt({
  reducedMotion,
  finePointer,
  pointerType,
}: {
  reducedMotion: boolean;
  finePointer: boolean;
  pointerType: string;
}): boolean {
  return !reducedMotion && finePointer && pointerType === "mouse";
}
