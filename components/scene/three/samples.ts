/**
 * Where the morph particles land on each model, and the other per-particle data the scene
 * uploads once. Pure arithmetic with seeded randomness — no three.js — so it is unit-tested
 * and shared by the models (which must draw exactly these silhouettes) and the swarm.
 *
 * Every sample set is `count × 3` floats in its model's local space (the model's root group:
 * placement, yaw and tilt come from its matrix), and is shuffled: any prefix of the buffer —
 * the governor's "lite" step draws the first half — still covers every part of the model in
 * proportion.
 */

import { mulberry32 } from "@/components/three/random";
import {
  CORE,
  CUBE_LAYOUTS,
  RING_TILTS,
  buildNeuralGraph,
  commerceTrackPoint,
  COMMERCE_GATES,
  hubLayout,
  type NeuralGraph,
  type Vec3,
} from "../shapes";

const TAU = Math.PI * 2;

/* ---- shared model constants ------------------------------------------------------------ */

/** The mesh-wave plane (scene units): size, height of the wave, pulse ring period (s). */
export const MESH_WAVE = { width: 3.3, height: 2.2, amp: 0.8, pulsePeriod: 3.2 } as const;
/**
 * Each model's resting pose inside its root group (Euler XYZ, radians): the cubes show three
 * faces, the wave lies back like a floor, the loop and the hub tip towards the viewer.
 */
export const MODEL_POSES = {
  cubes: [0.45, 0.35, 0],
  "mesh-wave": [-1.05, 0, 0],
  neural: [0.2, -0.85, 0],
  "commerce-loop": [-0.62, 0, 0.08],
  "integration-hub": [0.42, 0, 0],
} as const satisfies Record<string, readonly [number, number, number]>;
/**
 * Each model's size inside its root group, so their silhouettes read equally large on the
 * services host (the cube block and the hub are sparser than their radius suggests).
 */
export const MODEL_SCALES = {
  cubes: 1.25,
  "mesh-wave": 1,
  neural: 1.05,
  "commerce-loop": 1.1,
  "integration-hub": 1.2,
} as const satisfies Record<string, number>;
/** Gate ring radius around the track. */
export const COMMERCE_GATE_RADIUS = 0.32;
/** How far a gate turns from facing along the track towards the viewer (so it never reads edge-on). */
export const COMMERCE_GATE_FACE = 1.4;
/** Hub: plasma core, wire shell, satellite glyph size, link lift towards the viewer. */
export const HUB = { core: 0.42, wire: 0.55, glyph: 0.3, lift: 0.35 } as const;
/** Seeds, fixed so the site draws the same scene on every visit. */
export const SCENE_SEEDS = { neural: 0x5eed1, cloud: 0xc10d, swarm: 0x5a7a, samples: 0xa11ce } as const;

/* ---- vector helpers ----------------------------------------------------------------------- */

/** three's Euler "XYZ": v' = Rx(a) · Ry(b) · Rz(c) · v. */
export function rotateEulerXYZ([x, y, z]: Vec3, [a, b, c]: readonly [number, number, number]): Vec3 {
  // Rz
  const cz = Math.cos(c);
  const sz = Math.sin(c);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  // Ry
  const cy = Math.cos(b);
  const sy = Math.sin(b);
  const x2 = x1 * cy + z * sy;
  const z2 = -x1 * sy + z * cy;
  // Rx
  const cx = Math.cos(a);
  const sx = Math.sin(a);
  const y3 = y1 * cx - z2 * sx;
  const z3 = y1 * sx + z2 * cx;
  return [x2, y3, z3];
}

const scale3 = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** A uniformly random direction. */
function randomDirection(random: () => number): Vec3 {
  const z = random() * 2 - 1;
  const phi = random() * TAU;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(phi), r * Math.sin(phi), z];
}

/** Fill `count` points: `parts` share the buffer by weight, then the buffer is shuffled. */
function buildSamples(
  count: number,
  seed: number,
  parts: ReadonlyArray<{ weight: number; point: (random: () => number) => Vec3 }>,
): Float32Array {
  const n = Math.max(0, Math.floor(count));
  const random = mulberry32(seed);
  const out = new Float32Array(n * 3);
  const total = parts.reduce((sum, part) => sum + part.weight, 0);
  let written = 0;
  parts.forEach((part, index) => {
    const share = index === parts.length - 1 ? n - written : Math.round((n * part.weight) / total);
    for (let i = 0; i < share && written < n; i += 1, written += 1) {
      const p = part.point(random);
      out[written * 3] = p[0];
      out[written * 3 + 1] = p[1];
      out[written * 3 + 2] = p[2];
    }
  });
  shuffleTriplets(out, random);
  return out;
}

/** Fisher–Yates over xyz triplets, in place. */
export function shuffleTriplets(buffer: Float32Array, random: () => number): void {
  for (let i = buffer.length / 3 - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    for (let k = 0; k < 3; k += 1) {
      const t = buffer[i * 3 + k];
      buffer[i * 3 + k] = buffer[j * 3 + k];
      buffer[j * 3 + k] = t;
    }
  }
}

/* ---- the models' shapes as functions ------------------------------------------------------ */

/** A point on core ring `i` at angle `a` (the ring's rest pose, before it spins). */
export function coreRingPoint(i: number, a: number, radius: number = CORE.rings[i]): Vec3 {
  return rotateEulerXYZ([radius * Math.cos(a), radius * Math.sin(a), 0], RING_TILTS[i]);
}

/** The mesh wave's height at plane point (x, y) and time t, with a pulse ring of radius `pulseR` around `origin`. */
export function waveHeight(x: number, y: number, t: number, pulseR: number, ox = 0, oy = 0): number {
  const d = Math.hypot(x - ox, y - oy);
  return (
    MESH_WAVE.amp *
    (0.22 * Math.sin(1.6 * x + 1.1 * t) +
      0.16 * Math.sin(2.3 * y - 0.8 * t + 0.5 * x) +
      0.35 * Math.exp(-(((d - pulseR) * 5) ** 2)))
  );
}

/** A plane point of the mesh wave in model space (displaced, then posed). */
export function wavePoint(x: number, y: number, t: number, pulseR: number): Vec3 {
  return rotateEulerXYZ(scale3([x, y, waveHeight(x, y, t, pulseR)], MODEL_SCALES["mesh-wave"]), MODEL_POSES["mesh-wave"]);
}

/** The commerce track in model space (posed). */
export function commercePoint(u: number): Vec3 {
  return rotateEulerXYZ(scale3(commerceTrackPoint(u), MODEL_SCALES["commerce-loop"]), MODEL_POSES["commerce-loop"]);
}

/** Unit tangent of the (untilted) commerce track at `u`. */
export function commerceTangent(u: number): Vec3 {
  const e = 1e-4;
  const a = commerceTrackPoint(u - e);
  const b = commerceTrackPoint(u + e);
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
}

export type GateFrame = { centre: Vec3; u: Vec3; v: Vec3; normal: Vec3 };

const normalize3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * Gate `index`'s frame in the (unposed) track space: its centre on the track, a normal between
 * the track's direction and the viewer, and the ring's in-plane axes (u = its x, v = its y).
 */
export function commerceGateFrame(index: number): GateFrame {
  const gate = COMMERCE_GATES[index];
  const centre = commerceTrackPoint(gate.u);
  const t = commerceTangent(gate.u);
  const normal = normalize3([t[0], t[1], t[2] + COMMERCE_GATE_FACE]);
  const up: Vec3 = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize3(cross3(up, normal));
  const v = cross3(normal, u);
  return { centre, u, v, normal };
}

/** A point on gate `index`'s polygon ring at parameter `s` in [0, 1), in track space. */
export function commerceGatePoint(index: number, s: number, radius = COMMERCE_GATE_RADIUS): Vec3 {
  const gate = COMMERCE_GATES[index];
  const { centre, u, v } = commerceGateFrame(index);
  // A regular polygon: interpolate between its corners (48 sides is a circle).
  const sides = gate.sides;
  const f = (((s % 1) + 1) % 1) * sides;
  const k = Math.floor(f);
  const corner = (j: number) => {
    const a = gate.rotation + (TAU * j) / sides;
    return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
  };
  const c0 = corner(k);
  const c1 = corner(k + 1);
  const px = c0[0] + (c1[0] - c0[0]) * (f - k);
  const py = c0[1] + (c1[1] - c0[1]) * (f - k);
  return [
    centre[0] + u[0] * px + v[0] * py,
    centre[1] + u[1] * px + v[1] * py,
    centre[2] + u[2] * px + v[2] * py,
  ];
}

/** The hub link from the hub to satellite `position`: a quadratic curve lifted towards the viewer. */
export function hubLinkPoint(position: Vec3, s: number): Vec3 {
  const mid: Vec3 = [position[0] / 2, position[1] / 2, position[2] / 2 + HUB.lift];
  const a = mix3([0, 0, 0], mid, s);
  const b = mix3(mid, position, s);
  return mix3(a, b, s);
}

/* ---- swarm sample sets (one per slot) -------------------------------------------------------- */

export type SampleTier = {
  swarm: number;
  neural: readonly number[];
  fanout: number;
  satellites: number;
};

/** The neural graph a tier draws (the model and the samples must agree). */
export function neuralGraphFor(tier: Pick<SampleTier, "neural" | "fanout">): NeuralGraph {
  return buildNeuralGraph(tier.neural, tier.fanout, SCENE_SEEDS.neural);
}

/** Slot 0: the core — 55% its glass sphere, 45% its three rings. */
export function coreSamples(count: number, seed = SCENE_SEEDS.samples): Float32Array {
  return buildSamples(count, seed, [
    { weight: 55, point: (r) => scale3(randomDirection(r), CORE.sphere) },
    { weight: 45, point: (r) => coreRingPoint(Math.floor(r() * 3) % 3, r() * TAU) },
  ]);
}

/** The 12 edges of an axis-aligned cube of `size` at `centre`, as a point at (edge, s). */
function cubeEdgePoint(centre: Vec3, size: number, edge: number, s: number): Vec3 {
  const h = size / 2;
  const t = -h + size * s;
  const signs: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const [p, q] = signs[edge % 4];
  const axis = Math.floor(edge / 4) % 3;
  const offset: Vec3 = axis === 0 ? [t, p * h, q * h] : axis === 1 ? [p * h, t, q * h] : [p * h, q * h, t];
  return [centre[0] + offset[0], centre[1] + offset[1], centre[2] + offset[2]];
}

/** Slot: cubes — the edges of the assembled 3×3×3 block. */
export function cubeSamples(count: number, seed = SCENE_SEEDS.samples + 1): Float32Array {
  const layout = CUBE_LAYOUTS.cube;
  const size = layout.size * layout.scale;
  return buildSamples(count, seed, [
    {
      weight: 1,
      point: (r) =>
        rotateEulerXYZ(
          scale3(
            cubeEdgePoint(layout.slots[Math.floor(r() * layout.slots.length)], size, Math.floor(r() * 12), r()),
            MODEL_SCALES.cubes,
          ),
          MODEL_POSES.cubes,
        ),
    },
  ]);
}

/** Slot: mesh wave — the displaced plane at t = 0. */
export function waveSamples(count: number, seed = SCENE_SEEDS.samples + 2): Float32Array {
  return buildSamples(count, seed, [
    {
      weight: 1,
      point: (r) => wavePoint((r() - 0.5) * MESH_WAVE.width, (r() - 0.5) * MESH_WAVE.height, 0, 0),
    },
  ]);
}

/** Slot: neural — 45% on the nodes, 55% along the edges. */
export function neuralSamples(count: number, graph: NeuralGraph, seed = SCENE_SEEDS.samples + 3): Float32Array {
  const pose = MODEL_POSES.neural;
  const size = MODEL_SCALES.neural;
  return buildSamples(count, seed, [
    {
      weight: 45,
      point: (r) => {
        const node = graph.nodes[Math.floor(r() * graph.nodes.length)];
        const d = randomDirection(r);
        return rotateEulerXYZ(
          scale3([node.position[0] + d[0] * 0.07, node.position[1] + d[1] * 0.07, node.position[2] + d[2] * 0.07], size),
          pose,
        );
      },
    },
    {
      weight: 55,
      point: (r) => {
        const [a, b] = graph.edges[Math.floor(r() * graph.edges.length)];
        return rotateEulerXYZ(scale3(mix3(graph.nodes[a].position, graph.nodes[b].position, r()), size), pose);
      },
    },
  ]);
}

/** Slot: commerce — 55% along the track, 45% around the three gates. */
export function commerceSamples(count: number, seed = SCENE_SEEDS.samples + 4): Float32Array {
  return buildSamples(count, seed, [
    { weight: 55, point: (r) => commercePoint(r()) },
    {
      weight: 45,
      point: (r) =>
        rotateEulerXYZ(
          scale3(commerceGatePoint(Math.floor(r() * 3) % 3, r()), MODEL_SCALES["commerce-loop"]),
          MODEL_POSES["commerce-loop"],
        ),
    },
  ]);
}

/** Slot: hub — 30% the hub, 40% the links, 30% the satellites. */
export function hubSamples(count: number, satellites: number, seed = SCENE_SEEDS.samples + 5): Float32Array {
  const layout = hubLayout(satellites);
  const pose = MODEL_POSES["integration-hub"];
  const size = MODEL_SCALES["integration-hub"];
  return buildSamples(count, seed, [
    { weight: 30, point: (r) => rotateEulerXYZ(scale3(randomDirection(r), HUB.wire * size), pose) },
    {
      weight: 40,
      point: (r) =>
        rotateEulerXYZ(
          scale3(hubLinkPoint(layout[Math.floor(r() * layout.length)].position, 0.15 + 0.85 * r()), size),
          pose,
        ),
    },
    {
      weight: 30,
      point: (r) => {
        const sat = layout[Math.floor(r() * layout.length)].position;
        const d = randomDirection(r);
        return rotateEulerXYZ(
          scale3([sat[0] + d[0] * HUB.glyph, sat[1] + d[1] * HUB.glyph, sat[2] + d[2] * HUB.glyph], size),
          pose,
        );
      },
    },
  ]);
}

/**
 * All six slots for a tier, in the swarm's order: the core, then the service models in
 * `SCENE_SHAPES` order through `models` (the model kind of each shape).
 */
export function swarmSlots(
  tier: SampleTier,
  models: readonly ("cubes" | "commerce-loop" | "integration-hub" | "neural" | "mesh-wave")[],
): Float32Array[] {
  const count = tier.swarm;
  const graph = neuralGraphFor(tier);
  const byModel = {
    cubes: () => cubeSamples(count),
    "mesh-wave": () => waveSamples(count),
    neural: () => neuralSamples(count, graph),
    "commerce-loop": () => commerceSamples(count),
    "integration-hub": () => hubSamples(count, tier.satellites),
  } as const;
  return [coreSamples(count), ...models.map((model) => byModel[model]())];
}

/* ---- per-particle seeds -------------------------------------------------------------------- */

/** `count × 4` floats in [0, 1): stagger, colour pick, twinkle phase… (shader decides). */
export function seedAttributes(count: number, seed: number): Float32Array {
  const random = mulberry32(seed);
  const out = new Float32Array(Math.max(0, Math.floor(count)) * 4);
  for (let i = 0; i < out.length; i += 1) out[i] = random();
  return out;
}

/**
 * The core's point cloud home positions: a shell between `CORE.cloud` radii, densest near
 * r ≈ 2 (a triangular distribution), squashed a little in y so it reads as an orbit field.
 */
export function cloudPositions(count: number, seed = SCENE_SEEDS.cloud): Float32Array {
  const random = mulberry32(seed);
  const n = Math.max(0, Math.floor(count));
  const out = new Float32Array(n * 3);
  const [inner, outer] = CORE.cloud;
  for (let i = 0; i < n; i += 1) {
    const u = random();
    const peak = (2 - inner) / (outer - inner);
    // Inverse CDF of a triangular distribution on [0, 1] with its mode at `peak`.
    const v = u < peak ? Math.sqrt(u * peak) : 1 - Math.sqrt((1 - u) * (1 - peak));
    const radius = inner + (outer - inner) * v;
    const d = randomDirection(random);
    out[i * 3] = d[0] * radius;
    out[i * 3 + 1] = d[1] * radius * 0.82;
    out[i * 3 + 2] = d[2] * radius;
  }
  return out;
}
