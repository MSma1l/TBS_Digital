/**
 * The hero stat cards' wireframe holograms, as pure data and maths.
 *
 * No `"use client"`, no DOM: `MetricHologram` in components/sections/Hero.tsx turns these into
 * CSS 3D transforms on hairline spans. Everything is in CSS axes (x right, y DOWN, z towards
 * the viewer) and in units of `a`, the distance from the shape's centre to a vertex — the
 * card sets `a` as a length (`--holo-a`), so one table serves every breakpoint.
 *
 * Edges and rings only: a hologram never draws a vertex dot (the no-decorative-dots rule).
 */

export type HoloVec = readonly [number, number, number];

/**
 * One edge, drawn as a bar of length `a·√2` lying along x and centred on the shape's centre,
 * then turned by `rotateZ(rz)`, then `rotateY(ry)` (degrees), then moved to `mid`.
 */
export type HologramEdge = { mid: HoloVec; ry: number; rz: number };

export type HologramShape = "octahedron" | "rings";

/** The six vertices of a regular octahedron: ±x, ±y, ±z. */
export const OCTAHEDRON_VERTICES: readonly HoloVec[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Every edge joins two perpendicular vertices, so it is `a·√2` long. */
export const OCTAHEDRON_EDGE_LENGTH = Math.SQRT2;

/*
 * With CSS's rotation matrices, the bar's direction ends up as
 * Ry(ry)·Rz(rz)·x̂ = (cos rz·cos ry, sin rz, −cos rz·sin ry):
 *  · the equator (y = 0) needs rz = 0 and ry = ±45°;
 *  · the edges in the xy plane need ry = 0 and rz = ±45°;
 *  · the edges in the yz plane need ry = −90° (x̂ → +z) and rz = ±45°.
 * lib/__tests__/hologram.test.ts checks that both ends of every edge land on a vertex.
 */
export const OCTAHEDRON_EDGES: readonly HologramEdge[] = [
  // equator
  { mid: [0.5, 0, 0.5], ry: 45, rz: 0 },
  { mid: [-0.5, 0, -0.5], ry: 45, rz: 0 },
  { mid: [0.5, 0, -0.5], ry: -45, rz: 0 },
  { mid: [-0.5, 0, 0.5], ry: -45, rz: 0 },
  // to the top vertex (y = −1), in the xy and yz planes
  { mid: [0.5, -0.5, 0], ry: 0, rz: 45 },
  { mid: [-0.5, -0.5, 0], ry: 0, rz: -45 },
  { mid: [0, -0.5, 0.5], ry: -90, rz: 45 },
  { mid: [0, -0.5, -0.5], ry: -90, rz: -45 },
  // to the bottom vertex (y = +1)
  { mid: [0.5, 0.5, 0], ry: 0, rz: -45 },
  { mid: [-0.5, 0.5, 0], ry: 0, rz: 45 },
  { mid: [0, 0.5, 0.5], ry: -90, rz: -45 },
  { mid: [0, 0.5, -0.5], ry: -90, rz: 45 },
];

/**
 * The automation hologram: a gyroscope of great circles of radius `a` — three meridians a
 * third of a turn apart and the equator. Each is a round border in the xy plane, turned by
 * this transform.
 */
export const HOLOGRAM_RINGS: readonly string[] = [
  "rotateY(0deg)",
  "rotateY(60deg)",
  "rotateY(120deg)",
  "rotateX(90deg)",
];

/** Which hologram a metric card shows: the portfolio counter an octahedron, the rest rings. */
export function hologramShapeFor(metricId: string): HologramShape {
  return metricId === "projects" ? "octahedron" : "rings";
}

/** `n·unit` as a CSS length: `0` stays a bare zero, anything else is a `calc()`. */
function scaled(n: number, unit: string): string {
  return n === 0 ? "0" : `calc(${n} * ${unit})`;
}

/**
 * The CSS transform that puts `edge` in place, `unit` being the CSS length of `a`
 * (`"var(--holo-a)"`, `"1em"`…). Apply it to a bar centred on the shape's centre.
 */
export function edgeTransform(edge: HologramEdge, unit: string): string {
  const [x, y, z] = edge.mid;
  return `translate3d(${scaled(x, unit)}, ${scaled(y, unit)}, ${scaled(z, unit)}) rotateY(${edge.ry}deg) rotateZ(${edge.rz}deg)`;
}
