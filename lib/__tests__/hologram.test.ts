import { describe, expect, it } from "vitest";
import {
  HOLOGRAM_RINGS,
  OCTAHEDRON_EDGE_LENGTH,
  OCTAHEDRON_EDGES,
  OCTAHEDRON_VERTICES,
  edgeTransform,
  hologramShapeFor,
  type HoloVec,
} from "@/lib/hologram";

/*
 * The stat holograms' wireframe (lib/hologram.ts). CSS can't be rendered in jsdom, so the
 * transforms are checked the way the browser composes them: CSS's own rotation matrices, in
 * CSS axes (y down), applied right to left to a bar lying along x.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

/** CSS `rotateY(θ)` on a vector. */
function rotateY([x, y, z]: HoloVec, deg: number): HoloVec {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c + z * s, y, -x * s + z * c];
}

/** CSS `rotateZ(θ)` on a vector. */
function rotateZ([x, y, z]: HoloVec, deg: number): HoloVec {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c - y * s, x * s + y * c, z];
}

/** Index of the vertex `p` sits on (within 1e-9), or -1. */
function vertexAt(p: HoloVec): number {
  return OCTAHEDRON_VERTICES.findIndex((v) => v.every((c, i) => Math.abs(c - p[i]) < 1e-9));
}

/** `p + k·d`. */
const along = (p: HoloVec, d: HoloVec, k: number): HoloVec => [
  p[0] + d[0] * k,
  p[1] + d[1] * k,
  p[2] + d[2] * k,
];

/** Both ends of an edge, as vertex indices. */
function endsOf(edge: (typeof OCTAHEDRON_EDGES)[number]): [number, number] {
  const half = OCTAHEDRON_EDGE_LENGTH / 2;
  const dir = rotateY(rotateZ([1, 0, 0], edge.rz), edge.ry);
  return [vertexAt(along(edge.mid, dir, half)), vertexAt(along(edge.mid, dir, -half))];
}

describe("octahedron hologram", () => {
  it("has 6 vertices and 12 edges of length √2", () => {
    expect(OCTAHEDRON_VERTICES).toHaveLength(6);
    expect(OCTAHEDRON_EDGES).toHaveLength(12);
    expect(OCTAHEDRON_EDGE_LENGTH).toBeCloseTo(Math.SQRT2, 12);
  });

  it("puts both ends of every edge exactly on a vertex", () => {
    for (const [i, edge] of OCTAHEDRON_EDGES.entries()) {
      const [a, b] = endsOf(edge);
      expect(a, `edge ${i} start`).toBeGreaterThanOrEqual(0);
      expect(b, `edge ${i} end`).toBeGreaterThanOrEqual(0);
    }
  });

  it("draws 12 distinct edges and never joins opposite vertices", () => {
    const pairs = OCTAHEDRON_EDGES.map((edge) => {
      const [a, b] = endsOf(edge);
      return [Math.min(a, b), Math.max(a, b)] as const;
    });
    expect(new Set(pairs.map(([a, b]) => `${a}-${b}`)).size).toBe(12);
    for (const [a, b] of pairs) {
      const sum = OCTAHEDRON_VERTICES[a].map((c, i) => c + OCTAHEDRON_VERTICES[b][i]);
      expect(sum.some((c) => c !== 0), `${a}-${b} are opposite`).toBe(true);
    }
  });

  it("meets 4 edges at every vertex", () => {
    const degree = new Array<number>(OCTAHEDRON_VERTICES.length).fill(0);
    for (const edge of OCTAHEDRON_EDGES) {
      for (const v of endsOf(edge)) degree[v] += 1;
    }
    expect(degree).toEqual([4, 4, 4, 4, 4, 4]);
  });

  it("writes the transform as CSS lengths in units of a, with bare zeros", () => {
    expect(edgeTransform(OCTAHEDRON_EDGES[0], "var(--holo-a)")).toBe(
      "translate3d(calc(0.5 * var(--holo-a)), 0, calc(0.5 * var(--holo-a))) rotateY(45deg) rotateZ(0deg)",
    );
    expect(edgeTransform(OCTAHEDRON_EDGES[5], "1em")).toBe(
      "translate3d(calc(-0.5 * 1em), calc(-0.5 * 1em), 0) rotateY(0deg) rotateZ(-45deg)",
    );
  });
});

describe("ring hologram and shape choice", () => {
  it("is four distinct great circles: three meridians and the equator", () => {
    expect(HOLOGRAM_RINGS).toHaveLength(4);
    expect(new Set(HOLOGRAM_RINGS).size).toBe(4);
    for (const ring of HOLOGRAM_RINGS) expect(ring).toMatch(/^rotate[XY]\(-?\d+deg\)$/);
  });

  it("gives the portfolio counter the octahedron and every other metric the rings", () => {
    expect(hologramShapeFor("projects")).toBe("octahedron");
    expect(hologramShapeFor("automation")).toBe("rings");
    expect(hologramShapeFor("anything-else")).toBe("rings");
  });
});
