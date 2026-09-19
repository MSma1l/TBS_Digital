import { describe, expect, it } from "vitest";
import {
  CHIP,
  CHIP_POSE,
  COMMERCE_GATES,
  CUBE_LAYOUTS,
  HELIX,
  HELIX_ANGLE,
  MODEL_RADIUS,
  buildNeuralGraph,
  chipPins,
  chipTraces,
  commerceTrackPoint,
  hubLayout,
  projectOrtho,
  toCssRotation,
  type Vec3,
} from "@/components/scene/shapes";

/*
 * The interior models' shared maths (components/scene/shapes.ts): the WebGL scene and the
 * static art both build from it, so its shapes are pinned here — closed, bounded, seeded.
 */

const EPS = 1e-9;
const length = ([x, y, z]: Vec3) => Math.hypot(x, y, z);

describe("the chip", () => {
  /** Trace counts per side worth checking: both tiers, the art's, and the degenerate ends. */
  const PER_SIDE = [1, 2, 3, 4, 5, 6, 7, 9];
  /** (x, y) turned by `s` quarter turns counter-clockwise. */
  const turn = ([x, y]: readonly [number, number], s: number): [number, number] => {
    let p: [number, number] = [x, y];
    for (let k = 0; k < s; k += 1) p = [-p[1], p[0]];
    return p;
  };

  it("nests die < heat spreader < substrate < board ≤ R, the R of the old core (host fits unchanged)", () => {
    expect(CHIP.die).toBeLessThan(CHIP.ihs);
    expect(CHIP.ihs).toBeLessThan(CHIP.pkg);
    expect(CHIP.pkg).toBeLessThan(CHIP.board);
    expect(CHIP.board).toBeLessThanOrEqual(CHIP.R);
    expect(CHIP.R).toBe(2.45);
    // A via pad on the board's edge still fits inside R.
    expect(CHIP.board + CHIP.via * Math.SQRT2).toBeLessThanOrEqual(CHIP.R);
    for (const t of Object.values(CHIP.thick)) expect(t).toBeGreaterThan(0);
  });

  it("lies back and turns to a diamond", () => {
    expect(CHIP_POSE).toEqual([-0.78, 0, 0.62]);
  });

  for (const n of PER_SIDE) {
    it(`${n} per side: 4·n traces of axis-aligned or 45° runs, inside the board`, () => {
      const traces = chipTraces(n);
      expect(traces).toHaveLength(4 * n);
      for (const trace of traces) {
        expect(trace).toHaveLength(4);
        for (const [x, y] of trace) expect(Math.hypot(x, y)).toBeLessThanOrEqual(CHIP.board + EPS);
        for (let j = 1; j < trace.length; j += 1) {
          const dx = Math.abs(trace[j][0] - trace[j - 1][0]);
          const dy = Math.abs(trace[j][1] - trace[j - 1][1]);
          const axis = dx < EPS || dy < EPS;
          const diagonal = Math.abs(dx - dy) < 1e-9;
          expect(axis || diagonal, `run ${j} of ${JSON.stringify(trace)}`).toBe(true);
        }
      }
    });

    it(`${n} per side: side 0 stays in |x| < y and keeps its x order at every y (no crossings)`, () => {
      const side0 = chipTraces(n).slice(0, n);
      for (const trace of side0) {
        for (const [x, y] of trace) expect(Math.abs(x)).toBeLessThan(y);
        // y never falls along a trace, so x is a function of y on it.
        for (let j = 1; j < trace.length; j += 1) expect(trace[j][1]).toBeGreaterThanOrEqual(trace[j - 1][1]);
      }
      const xAt = (trace: Array<[number, number]>, y: number): number | null => {
        for (let j = 1; j < trace.length; j += 1) {
          const [ax, ay] = trace[j - 1];
          const [bx, by] = trace[j];
          if (y >= ay - EPS && y <= by + EPS) return by - ay < EPS ? bx : ax + ((bx - ax) * (y - ay)) / (by - ay);
        }
        return null;
      };
      for (let i = 0; i + 1 < side0.length; i += 1) {
        const [a, b] = [side0[i], side0[i + 1]];
        const from = Math.max(a[0][1], b[0][1]);
        const to = Math.min(a[3][1], b[3][1]);
        for (let k = 0; k <= 200; k += 1) {
          const y = from + ((to - from) * k) / 200;
          const xa = xAt(a, y);
          const xb = xAt(b, y);
          expect(xa).not.toBeNull();
          expect(xb).not.toBeNull();
          expect(xa!, `traces ${i} and ${i + 1} at y ${y}`).toBeLessThan(xb!);
        }
      }
    });

    it(`${n} per side: four-fold symmetric, pins in trace order at each trace's start`, () => {
      const traces = chipTraces(n);
      const pins = chipPins(n);
      expect(pins).toHaveLength(4 * n);
      for (let s = 0; s < 4; s += 1) {
        for (let i = 0; i < n; i += 1) {
          const k = s * n + i;
          traces[k].forEach((p, j) => {
            const expected = turn(traces[i][j], s);
            expect(p[0]).toBeCloseTo(expected[0], 12);
            expect(p[1]).toBeCloseTo(expected[1], 12);
          });
          const pin = pins[k];
          expect(pin.side).toBe(s);
          expect(pin.size).toEqual(s % 2 === 0 ? [CHIP.pinSize.w, CHIP.pinSize.l] : [CHIP.pinSize.l, CHIP.pinSize.w]);
          // The pin stands out of the substrate's edge, and its outer end is where the trace starts.
          const out = turn([0, 1], s);
          const end = [pin.center[0] + (out[0] * CHIP.pinSize.l) / 2, pin.center[1] + (out[1] * CHIP.pinSize.l) / 2];
          expect(end[0]).toBeCloseTo(traces[k][0][0], 12);
          expect(end[1]).toBeCloseTo(traces[k][0][1], 12);
          const inner = turn([pin.center[0], pin.center[1]], (4 - s) % 4);
          expect(inner[1] - CHIP.pinSize.l / 2).toBeCloseTo(CHIP.pkg, 12);
        }
      }
    });
  }

  it("is deterministic, never -0 (the art prints these numbers), and at least one trace per side", () => {
    expect(chipTraces(7)).toEqual(chipTraces(7));
    expect(chipPins(5)).toEqual(chipPins(5));
    for (const n of PER_SIDE) {
      const numbers = [...chipTraces(n).flat(2), ...chipPins(n).flatMap((pin) => [...pin.center, ...pin.size])];
      expect(numbers.filter((v) => Object.is(v, -0)), `${n} per side`).toEqual([]);
    }
    expect(chipTraces(0)).toHaveLength(4);
    expect(chipPins(2.7)).toHaveLength(8);
  });
});

describe("the Work helix", () => {
  it("is 1.45 wide in radius, 5.4 tall, 2.5 turns: taller than wide, narrower than a service model", () => {
    expect(HELIX).toEqual({ radius: 1.45, height: 5.4, turns: 2.5 });
    // Still taller than it is wide — the radius came out to meet the cards' orbit (shapes.ts),
    // it did not turn the molecule into a spring: 2.9 across against 5.4 of climb.
    expect(HELIX.height).toBeGreaterThan(2 * HELIX.radius);
    // And still inside the cloud the swarm flies from, so the handoff never lands outside itself.
    expect(HELIX.radius).toBeLessThan(MODEL_RADIUS);
    // A turn climbs 2.16: roughly ten base pairs' worth of DNA per turn at the high tier's 22 rungs.
    expect(HELIX.height / HELIX.turns).toBeCloseTo(2.16, 12);
  });

  it("turns one ninth of a turn per project card (the layout and the model share the step)", () => {
    expect(HELIX_ANGLE).toBeCloseTo((2 * Math.PI) / 9, 15);
    expect(9 * HELIX_ANGLE).toBeCloseTo(2 * Math.PI, 12);
  });
});

describe("buildNeuralGraph", () => {
  const HIGH = [5, 8, 9, 7, 4];
  const MID = [4, 6, 7, 5, 3];

  it("is identical for the same seed and differs for another", () => {
    expect(buildNeuralGraph(HIGH, 3, 7)).toEqual(buildNeuralGraph(HIGH, 3, 7));
    expect(buildNeuralGraph(HIGH, 3, 8).nodes).not.toEqual(buildNeuralGraph(HIGH, 3, 7).nodes);
  });

  for (const [tier, layers, fanout] of [
    ["high", HIGH, 3],
    ["mid", MID, 2],
  ] as const) {
    it(`${tier}: one node per slot, edges only from layer l to l + 1, no orphans`, () => {
      const graph = buildNeuralGraph(layers, fanout, 42);
      const total = layers.reduce((sum, n) => sum + n, 0);
      expect(graph.nodes).toHaveLength(total);
      layers.forEach((count, layer) => {
        expect(graph.nodes.filter((node) => node.layer === layer)).toHaveLength(count);
        expect(graph.nodes[graph.layerStart[layer]].layer).toBe(layer);
      });

      for (const [a, b] of graph.edges) {
        expect(graph.nodes[b].layer).toBe(graph.nodes[a].layer + 1);
      }
      const keys = graph.edges.map(([a, b]) => `${a}-${b}`);
      expect(new Set(keys).size).toBe(keys.length);

      const fed = new Set(graph.edges.map(([, b]) => b));
      graph.nodes.forEach((node, i) => {
        if (node.layer > 0) expect(fed.has(i), `node ${i} has no input`).toBe(true);
      });

      // Every node sends `fanout` edges forward; orphans add at most one each.
      const forward = layers.slice(0, -1).reduce((sum, n, l) => sum + n * Math.min(fanout, layers[l + 1]), 0);
      const inputs = layers.slice(1).reduce((sum, n) => sum + n, 0);
      expect(graph.edges.length).toBeGreaterThanOrEqual(forward);
      expect(graph.edges.length).toBeLessThanOrEqual(forward + inputs);
    });
  }

  it("keeps the high tier near the planned ~87 edges", () => {
    const edges = buildNeuralGraph(HIGH, 3, 42).edges.length;
    expect(edges).toBeGreaterThanOrEqual(87);
    expect(edges).toBeLessThanOrEqual(100);
  });

  it("fits every node inside the model radius, input layer left and output right", () => {
    const graph = buildNeuralGraph(HIGH, 3, 42);
    for (const node of graph.nodes) {
      expect(length(node.position)).toBeLessThanOrEqual(MODEL_RADIUS);
      expect(node.angle).toBeGreaterThanOrEqual(0);
      expect(node.angle).toBeLessThan(Math.PI * 2);
    }
    expect(graph.nodes[0].position[0]).toBeCloseTo(-1.7, 9);
    expect(graph.nodes[graph.nodes.length - 1].position[0]).toBeCloseTo(1.7, 9);
  });

  it("survives degenerate input", () => {
    expect(buildNeuralGraph([], 3, 1)).toEqual({ layers: [], layerStart: [], nodes: [], edges: [] });
    expect(buildNeuralGraph([3], 3, 1).edges).toEqual([]);
    expect(buildNeuralGraph([2, 2], 0, 1).edges).toHaveLength(2);
  });
});

describe("commerceTrackPoint", () => {
  it("is a closed loop", () => {
    const [a, b] = [commerceTrackPoint(0), commerceTrackPoint(1)];
    for (let i = 0; i < 3; i += 1) expect(Math.abs(a[i] - b[i])).toBeLessThan(EPS);
  });

  it("stays inside the model radius all the way round", () => {
    for (let i = 0; i <= 512; i += 1) {
      expect(length(commerceTrackPoint(i / 512))).toBeLessThanOrEqual(MODEL_RADIUS);
    }
  });

  it("puts the three gates at thirds: a circle, a card, a hexagon", () => {
    expect(COMMERCE_GATES.map((gate) => gate.kind)).toEqual(["offer", "payment", "access"]);
    COMMERCE_GATES.forEach((gate, i) => expect(gate.u).toBeCloseTo(i / 3, 12));
    expect(COMMERCE_GATES.map((gate) => gate.sides)).toEqual([48, 4, 6]);
    expect(COMMERCE_GATES[1].rotation).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe("hubLayout", () => {
  it("places n satellites evenly, alternating above and below, inside the model radius", () => {
    for (const n of [5, 6]) {
      const satellites = hubLayout(n);
      expect(satellites).toHaveLength(n);
      satellites.forEach((satellite, i) => {
        expect(length(satellite.position)).toBeLessThanOrEqual(MODEL_RADIUS);
        expect(satellite.position[1]).toBe(i % 2 === 0 ? 0.4 : -0.4);
        expect(satellite.angle).toBeCloseTo((Math.PI * 2 * i) / n, 12);
      });
      expect(new Set(satellites.slice(0, 4).map((s) => s.glyph)).size).toBe(4);
    }
    expect(hubLayout(0)).toEqual([]);
  });
});

describe("CUBE_LAYOUTS", () => {
  for (const name of ["cube", "slab"] as const) {
    it(`${name}: 27 unique slots inside the model radius, cubes never overlapping`, () => {
      const layout = CUBE_LAYOUTS[name];
      expect(layout.slots).toHaveLength(27);
      expect(new Set(layout.slots.map((slot) => slot.map((v) => v.toFixed(6)).join(","))).size).toBe(27);
      for (const slot of layout.slots) {
        expect(length(slot)).toBeLessThanOrEqual(MODEL_RADIUS);
      }
      expect(layout.size * layout.scale).toBeLessThan(layout.spacing);
    });
  }

  it("is a 3×3×3 cube and a 3×9×1 slab", () => {
    const extent = (slots: readonly Vec3[], axis: number) =>
      new Set(slots.map((slot) => slot[axis].toFixed(6))).size;
    const { cube, slab } = CUBE_LAYOUTS;
    expect([0, 1, 2].map((axis) => extent(cube.slots, axis))).toEqual([3, 3, 3]);
    expect([0, 1, 2].map((axis) => extent(slab.slots, axis))).toEqual([3, 9, 1]);
  });
});

/* ---- scene space → CSS ------------------------------------------------------------------ */

type Mat3 = number[][];

const multiply = (a: Mat3, b: Mat3): Mat3 =>
  a.map((row, i) => row.map((_, j) => row.reduce((sum, _v, k) => sum + a[i][k] * b[k][j], 0)));

const rx = (t: number): Mat3 => [
  [1, 0, 0],
  [0, Math.cos(t), -Math.sin(t)],
  [0, Math.sin(t), Math.cos(t)],
];
const ry = (t: number): Mat3 => [
  [Math.cos(t), 0, Math.sin(t)],
  [0, 1, 0],
  [-Math.sin(t), 0, Math.cos(t)],
];
const rz = (t: number): Mat3 => [
  [Math.cos(t), -Math.sin(t), 0],
  [Math.sin(t), Math.cos(t), 0],
  [0, 0, 1],
];
const FLIP_Y: Mat3 = [
  [1, 0, 0],
  [0, -1, 0],
  [0, 0, 1],
];

/** The matrix of a CSS `rotateX(…rad) rotateY(…rad) rotateZ(…rad)` list (left to right). */
function cssMatrix(transform: string): Mat3 {
  const functions = [...transform.matchAll(/rotate([XYZ])\((-?[\d.e-]+)rad\)/g)];
  expect(functions.map((m) => m[1])).toEqual(["X", "Y", "Z"]);
  const byAxis = { X: rx, Y: ry, Z: rz } as const;
  return functions.reduce<Mat3>(
    (m, [, axis, angle]) => multiply(m, byAxis[axis as "X" | "Y" | "Z"](Number(angle))),
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  );
}

describe("toCssRotation", () => {
  it("is the three.js Euler XYZ rotation seen through CSS's downward y axis (S·R·S)", () => {
    for (const tilt of [CHIP_POSE, [0.3, -1.1, 2.2] as const]) {
      const three = multiply(multiply(rx(tilt[0]), ry(tilt[1])), rz(tilt[2]));
      const expected = multiply(multiply(FLIP_Y, three), FLIP_Y);
      const actual = cssMatrix(toCssRotation(tilt));
      expected.forEach((row, i) => row.forEach((v, j) => expect(actual[i][j]).toBeCloseTo(v, 9)));
    }
  });

  it("never prints -0", () => {
    expect(toCssRotation([0, 0, 0])).toBe("rotateX(0rad) rotateY(0rad) rotateZ(0rad)");
  });
});

describe("projectOrtho", () => {
  it("scales, flips y for SVG and reports depth towards the viewer", () => {
    expect(projectOrtho([1, 2, 3], 0, 0, 10)).toEqual([10, -20, 30]);
  });

  it("turns by yaw about y, then pitch about x", () => {
    const [x, y, depth] = projectOrtho([1, 0, 0], Math.PI / 2, 0, 1);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(depth).toBeCloseTo(-1, 12);

    const [x2, y2, depth2] = projectOrtho([0, 0, 1], 0, Math.PI / 2, 1);
    expect(x2).toBeCloseTo(0, 12);
    expect(y2).toBeCloseTo(1, 12);
    expect(depth2).toBeCloseTo(0, 12);
  });

  it("keeps lengths (an orthographic view of a rotation)", () => {
    const p: Vec3 = [0.4, -1.2, 0.7];
    expect(length(projectOrtho(p, 0.5, 0.35, 1))).toBeCloseTo(length(p), 12);
  });
});
