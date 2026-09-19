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

/* ---- hero microprocessor ------------------------------------------------------------- */

/**
 * The hero microprocessor, in its own plane (x right, y up, z out of the board). Half-sizes
 * for the three stacked squares; `R` equals the old core's, so every host fit is unchanged.
 */
export const CHIP = {
  /** Outer radius of the whole chip, traces included. */
  R: 2.45,
  /** Radius the traces stay inside. */
  board: 2.3,
  /** Half-sizes: substrate (package), integrated heat spreader, die. */
  pkg: 1.0,
  ihs: 0.68,
  die: 0.34,
  thick: { pkg: 0.08, ihs: 0.07, die: 0.05 },
  /** One pin: width across the side, length out of it, thickness. (Not `pin:` — the stage's
   *  ScrollTrigger scan, scene-contract.test.ts, reads that as GSAP pinning.) */
  pinSize: { w: 0.07, l: 0.18, t: 0.025 },
  /** Share of a side the pins cover. */
  pinSpan: 0.8,
  /** Half-size of a via pad: a square outline, never round. */
  via: 0.07,
} as const;

/** Euler XYZ pose of the chip: lying back, turned to a diamond. */
export const CHIP_POSE: readonly [number, number, number] = [-0.78, 0, 0.62];

/** Turns a chip-plane point by `s` quarter turns, counter-clockwise. */
function rot90([x, y]: readonly [number, number], s: number): [number, number] {
  switch (((s % 4) + 4) % 4) {
    case 1:
      return [-y + 0, x + 0];
    case 2:
      return [-x + 0, -y + 0];
    case 3:
      return [y + 0, -x + 0];
    default:
      return [x + 0, y + 0];
  }
}

/** Distance between neighbouring pins on one side. */
function pinPitch(perSide: number): number {
  return (2 * CHIP.pkg * CHIP.pinSpan) / perSide;
}

/** x of pin `i` on side 0 (pins on y = +pkg), centred on the side. */
function pinX(i: number, perSide: number): number {
  return (i - (perSide - 1) / 2) * pinPitch(perSide);
}

/**
 * The board traces as polylines, `perSide` per side, side 0 first then turned by quarter turns.
 * Each leaves its pin straight out, takes a 45° chamfer away from the side's centre, and runs
 * out to the board's edge. Every run is axis-aligned or at 45°, and side-0 points keep |x| < y,
 * so no two traces cross. Deterministic, no RNG.
 */
export function chipTraces(perSide: number): Array<Array<[number, number]>> {
  const n = Math.max(1, Math.floor(perSide));
  const out: Array<Array<[number, number]>> = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < n; i += 1) {
      const u = pinX(i, n);
      const y0 = CHIP.pkg + CHIP.pinSize.l;
      const y1 = y0 + 0.3 + 0.06 * (Math.abs(i - (n - 1) / 2) % 2);
      const dx = Math.sign(u) * 0.55 * (Math.abs(u) / CHIP.pkg);
      const x2 = u + dx;
      const y2 = y1 + Math.abs(dx);
      const yEnd = Math.min(CHIP.board, Math.sqrt(CHIP.board ** 2 - x2 * x2)) - 0.08 * (i % 3);
      const run: Array<[number, number]> = [
        [u, y0],
        [u, y1],
        [x2, y2],
        [x2, Math.max(y2 + 0.12, yEnd)],
      ];
      out.push(run.map((p) => rot90(p, s)));
    }
  }
  return out;
}

export type ChipPin = {
  /** Centre in the chip plane. */
  center: [number, number];
  /** Full width (x) and height (y) in the chip plane, after the side's turn. */
  size: [number, number];
  /** 0 = top (+y), then counter-clockwise. */
  side: number;
};

/**
 * The pins, `perSide` per side in the same order as `chipTraces`: each a
 * `pinSize.w × pinSize.l` rectangle standing out of the substrate's edge, where its trace starts.
 */
export function chipPins(perSide: number): ChipPin[] {
  const n = Math.max(1, Math.floor(perSide));
  const out: ChipPin[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < n; i += 1) {
      const center = rot90([pinX(i, n), CHIP.pkg + CHIP.pinSize.l / 2], s);
      const size: [number, number] = s % 2 === 0 ? [CHIP.pinSize.w, CHIP.pinSize.l] : [CHIP.pinSize.l, CHIP.pinSize.w];
      out.push({ center, size, side: s });
    }
  }
  return out;
}

/* ---- the projects' DNA helix (Work) --------------------------------------------------- */

/**
 * The Work section's DNA helix, in its own frame: y up the axis, two strands of `radius` half a
 * turn apart, `turns` turns over `height` (centred on the origin). The WebGL model
 * (`three/models/helix.ts`) and the swarm's slot 0 (`three/samples.ts`) build from it; the world
 * scales it to its zone.
 *
 * `radius` is what makes the project cards RIDE the strands instead of orbiting outside them.
 * The world fits the model by its HEIGHT (`placeHelixSpiral`: `pxPerUnit = 0.9 · zoneH / height`,
 * 121.5px per unit at 1280×800) while the cards' orbit comes from the zone's WIDTH (helix.ts
 * `HELIX_LAYOUT.orbit` = min(0.19 · zoneW, 240), 228px there). At the old 0.9 the strand drew
 * 109px against that 228px orbit — the cards swung at 2.09× the strand's radius, every card sat
 * outside the coil, and a drawn tether between the two had NEGATIVE visible length for every card
 * on the canvas (the strand point matching a card is always behind the card itself).
 *
 * One constant cannot close it at every aspect: the ride radius is `6 · orbit / zoneH`, which is
 * 1.44 at 861×700, 1.54 at 1024×768 and 1.88 at 1280×800. 1.45 is the exact ride at the square
 * end and closes 77% of the gap at the wide one, where the card is 289px across and the strand
 * therefore still passes well inside every card's silhouette. It is as far as the radius can go
 * for a second reason: at 1.88 the chips reach the hologram's panel at 861×700 (measured: 502.6px
 * against the panel's left edge at 501.8).
 *
 * What it does NOT touch: the helix's drawn HEIGHT and so the clearance under Work's heading
 * (`placeHelixSpiral`'s scale divides by `height` alone), and the 0/1 bits, whose own radii
 * (`HELIX_BIT.radius`, 0.2…1.2) are absolute — they now drift inside the coil rather than outside
 * it, which is the payload being carried within the molecule.
 */
export const HELIX = { radius: 1.45, height: 5.4, turns: 2.5 } as const;

/**
 * One project card's step around the helix, radians: the spiral layout turns the cards by it
 * and the model turns its strands by it, so both move together.
 */
export const HELIX_ANGLE = (2 * Math.PI) / 9;

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
