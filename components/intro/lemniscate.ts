/**
 * The ∞ the intro is built around — a lemniscate of Bernoulli — as plain math.
 *
 * No three.js here: the WebGL scene wraps `lemniscatePoint` in a `Curve`, and the SVG
 * fallback draws `LEMNISCATE_PATH`, which the server renders. Both come from the same
 * function, so the fallback and the 3D model are the same shape.
 */

export const LEMNISCATE = {
  /** Half-width of the curve in scene units (the lobes reach ±a on x). */
  a: 1.6,
  /** z = depth · sin t lifts one strand over the other where they cross (0.56 apart). */
  depth: 0.28,
  /** Glass tube radius. Diameter 0.32 < 0.56, so the strands never intersect. */
  tube: 0.16,
} as const;

/** A point on the curve for `u` in [0, 1) (one full loop), in scene units, y up. */
export function lemniscatePoint(u: number): [number, number, number] {
  const t = u * Math.PI * 2;
  const s = Math.sin(t);
  const c = Math.cos(t);
  const k = 1 + s * s;
  return [(LEMNISCATE.a * c) / k, (LEMNISCATE.a * s * c) / k, LEMNISCATE.depth * s];
}

/* Two decimals is sub-pixel at any size the fallback is drawn, and `Math.round` (rather
   than toFixed) turns -0 into "0", so the string is identical on every engine. */
const coord = (value: number) => String(Math.round(value * 100) / 100);

/**
 * The curve projected onto the xy-plane as a closed SVG path: `samples` straight segments,
 * scaled by `scale` and flipped to SVG's y-down axis. Deterministic, so server and client
 * render the same string.
 */
export function lemniscatePath(samples: number, scale: number): string {
  const count = Math.max(3, Math.floor(samples));
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const [x, y] = lemniscatePoint(i / count);
    points.push(`${coord(x * scale)} ${coord(-y * scale)}`);
  }
  return `M${points.join("L")}Z`;
}

/** The viewBox `LEMNISCATE_PATH` is drawn for: x reaches ±160, y about ±57. */
export const LEMNISCATE_VIEWBOX = "-190 -95 380 190";

/** The fallback's path, computed once at module load. */
export const LEMNISCATE_PATH = lemniscatePath(128, 100);
