/**
 * The interior models' proportions and layouts as pure math — shared by the WebGL scene and
 * the static SVG/CSS art, so a crossfade between the two lands on the same silhouette.
 *
 * No three.js, no DOM, no `Math.random` (seeded `mulberry32` only): imported by server
 * components and unit-tested. Scene units, y up, z towards the viewer; every service model
 * fits inside `MODEL_RADIUS` at scale 1.
 */

import { mulberry32 } from "@/components/three/random";

export type Vec3 = [number, number, number];

/** Every service model fits inside this radius (scene units) at scale 1. */
export const MODEL_RADIUS = 2;

/** The hero "Cybernetic Core": frosted sphere, plasma nucleus, three rings, a point cloud. */
export const CORE = {
  /** Outer radius of the whole core, rings included. */
  R: 2.45,
  sphere: 1,
  nucleus: 0.38,
  rings: [1.45, 1.9, 2.41],
  tube: [0.016, 0.013, 0.011],
  /** Inner and outer radius of the point cloud's shell. */
  cloud: [1.35, 3.1],
} as const;

/**
 * Euler XYZ tilt of each ring (radians) — the intro's three orbits (`ORBITS` in
 * components/intro/three/random.ts), so the core's rings echo the ∞'s particle shells.
 */
export const RING_TILTS: readonly (readonly [number, number, number])[] = [
  [1.2, 0, 0.18],
  [0.35, 0.55, -0.4],
  [-0.9, -0.35, 0.6],
];

/** Angular speed of each ring (rad/s at rest); the sign sets the direction. */
export const RING_OMEGA: readonly number[] = [0.32, -0.24, 0.52];

/* ---- neural network (asistenti-ia) ------------------------------------------------------ */

export type NeuralNode = {
  layer: number;
  /** Angle around the layer's ring, radians. */
  angle: number;
  position: Vec3;
};

export type NeuralGraph = {
  /** Nodes per layer, input first. */
  layers: readonly number[];
  /** Index of each layer's first node in `nodes`. */
  layerStart: readonly number[];
  nodes: NeuralNode[];
  /** Node index pairs, always from layer l to layer l + 1. */
  edges: Array<[number, number]>;
};

/** Half the network's length along x. */
const NEURAL_HALF_LENGTH = 1.7;

const TAU = Math.PI * 2;

/** Shortest distance between two angles, in [0, π]. */
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % TAU;
  return d > Math.PI ? TAU - d : d;
}

/**
 * A layered "brain": layer l sits at x ∈ [-1.7, 1.7], its nodes on a ring of radius
 * `.55 + .45·sin(π·l/(L-1))` (widest in the middle). Each node links to its `fanout` nearest
 * nodes (by angle) in the next layer, and any next-layer node left without an input gets one
 * from its nearest node — so no node but the inputs is ever an orphan. Deterministic per seed.
 */
export function buildNeuralGraph(
  layers: readonly number[],
  fanout: number,
  seed: number,
): NeuralGraph {
  const counts = layers.map((n) => Math.max(0, Math.floor(n)));
  const random = mulberry32(seed);
  const nodes: NeuralNode[] = [];
  const layerStart: number[] = [];
  const last = Math.max(1, counts.length - 1);

  counts.forEach((count, layer) => {
    layerStart.push(nodes.length);
    const x = counts.length > 1 ? -NEURAL_HALF_LENGTH + (2 * NEURAL_HALF_LENGTH * layer) / last : 0;
    const radius = 0.55 + 0.45 * Math.sin((Math.PI * layer) / last);
    const step = count > 0 ? TAU / count : 0;
    const phase = random() * step;
    for (let i = 0; i < count; i += 1) {
      const angle = (((phase + i * step + (random() - 0.5) * 0.35 * step) % TAU) + TAU) % TAU;
      nodes.push({
        layer,
        angle,
        position: [x, radius * Math.cos(angle), radius * Math.sin(angle)],
      });
    }
  });

  const edges: Array<[number, number]> = [];
  for (let layer = 0; layer + 1 < counts.length; layer += 1) {
    const from = layerStart[layer];
    const to = layerStart[layer + 1];
    const nextCount = counts[layer + 1];
    const links = Math.min(Math.max(0, Math.floor(fanout)), nextCount);
    const fed = new Set<number>();

    for (let i = from; i < from + counts[layer]; i += 1) {
      const gap = (j: number) => angleGap(nodes[i].angle, nodes[j].angle);
      const nearest = Array.from({ length: nextCount }, (_, k) => to + k)
        .sort((a, b) => gap(a) - gap(b) || a - b)
        .slice(0, links);
      for (const j of nearest) {
        edges.push([i, j]);
        fed.add(j);
      }
    }

    for (let j = to; j < to + nextCount; j += 1) {
      if (fed.has(j) || counts[layer] === 0) continue;
      let best = from;
      for (let i = from + 1; i < from + counts[layer]; i += 1) {
        if (angleGap(nodes[i].angle, nodes[j].angle) < angleGap(nodes[best].angle, nodes[j].angle)) {
          best = i;
        }
      }
      edges.push([best, j]);
    }
  }

  return { layers: counts, layerStart, nodes, edges };
}

/* ---- commerce loop (e-commerce) ------------------------------------------------------- */

/**
 * The Offer → Payment → Access track at `u` ∈ [0, 1): a closed, gently three-lobed loop,
 * flattened in y and rippled in z. Periodic: `u` and `u + 1` are the same point.
 */
export function commerceTrackPoint(u: number): Vec3 {
  const theta = TAU * u;
  const r = 1.55 * (1 + 0.14 * Math.cos(3 * theta));
  return [r * Math.cos(theta), 0.62 * r * Math.sin(theta), 0.28 * Math.sin(3 * theta + 0.8)];
}

export type CommerceGate = {
  kind: "offer" | "payment" | "access";
  /** Where on the track (`commerceTrackPoint`). */
  u: number;
  /** Polygon sides of the gate ring: a circle, a card, a hexagon. */
  sides: number;
  /** In-plane rotation of that polygon, radians. */
  rotation: number;
};

export const COMMERCE_GATES: readonly CommerceGate[] = [
  { kind: "offer", u: 0, sides: 48, rotation: 0 },
  { kind: "payment", u: 1 / 3, sides: 4, rotation: Math.PI / 4 },
  { kind: "access", u: 2 / 3, sides: 6, rotation: 0 },
];

/* ---- integration hub (automatizare-api) ---------------------------------------------- */

export type HubGlyph = "database" | "api" | "queue" | "service";

export type HubSatellite = {
  glyph: HubGlyph;
  /** Around the hub, radians. */
  angle: number;
  position: Vec3;
};

const HUB_GLYPHS: readonly HubGlyph[] = ["database", "api", "queue", "service"];

/**
 * `n` satellites evenly around the hub at radius 1.6, alternately 0.4 above and below it,
 * cycling through the four system glyphs.
 */
export function hubLayout(n: number): HubSatellite[] {
  const count = Math.max(0, Math.floor(n));
  return Array.from({ length: count }, (_, i) => {
    const angle = (TAU * i) / count;
    return {
      glyph: HUB_GLYPHS[i % HUB_GLYPHS.length],
      angle,
      position: [1.6 * Math.cos(angle), i % 2 === 0 ? 0.4 : -0.4, 1.6 * Math.sin(angle)],
    };
  });
}

/* ---- assembling cubes (produs-digital) ------------------------------------------------ */

export type CubeLayout = {
  /** Edge of one cube at scale 1. */
  size: number;
  /** Centre-to-centre distance. */
  spacing: number;
  /** Per-cube scale in this layout. */
  scale: number;
  /** 27 slot centres. */
  slots: readonly Vec3[];
};

function grid(nx: number, ny: number, nz: number, spacing: number): Vec3[] {
  const slots: Vec3[] = [];
  for (let x = 0; x < nx; x += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let z = 0; z < nz; z += 1) {
        slots.push([
          (x - (nx - 1) / 2) * spacing,
          (y - (ny - 1) / 2) * spacing,
          (z - (nz - 1) / 2) * spacing,
        ]);
      }
    }
  }
  return slots;
}

/** Software ↔ mobile: a 3×3×3 cube and a 3×9×1 phone slab, both of 27 cubes. */
export const CUBE_LAYOUTS: Readonly<{ cube: CubeLayout; slab: CubeLayout }> = {
  cube: { size: 0.5, spacing: 0.62, scale: 1, slots: grid(3, 3, 3, 0.62) },
  slab: { size: 0.5, spacing: 0.42, scale: 0.7, slots: grid(3, 9, 1, 0.42) },
};

/* ---- scene space → CSS / SVG --------------------------------------------------------- */

/**
 * A three.js Euler XYZ tilt as a CSS transform. CSS has y pointing down, so the rotation is
 * conjugated by the y flip S = diag(1, -1, 1): S·Rx(a)·Ry(b)·Rz(c)·S = Rx(-a)·Ry(b)·Rz(-c).
 */
export function toCssRotation(tilt: readonly [number, number, number]): string {
  const [a, b, c] = tilt;
  return `rotateX(${-a + 0}rad) rotateY(${b + 0}rad) rotateZ(${-c + 0}rad)`;
}

/**
 * Orthographic projection for the SVG art: turn `p` by `yaw` about y, then `pitch` about x,
 * and scale. Returns `[x, y, depth]` in SVG units — y down, depth towards the viewer
 * (larger is nearer), for draw order or fading.
 */
export function projectOrtho(p: Vec3, yaw: number, pitch: number, scale: number): Vec3 {
  const [x, y, z] = p;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  return [x1 * scale + 0, -y2 * scale + 0, z2 * scale + 0];
}
