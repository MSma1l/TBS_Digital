/**
 * "Produs digital" — stiva de produs: six wireframe app screens standing apart over a neon
 * bench, flows running between their controls, a device slab in front. The stack collapses into
 * the device, the glass scans on, the whole thing turns to its back and three architecture
 * slabs dock out with their chips, then it opens again.
 *
 * There is no entrance: on a service page the entry gate snaps to `formed` on the first frame,
 * so an entrance would play behind the static art. The idle loop is the show, and its clock
 * starts at LOOP_START (29% in) so the first frame a visitor sees is mid-walkthrough.
 *
 * Loop (6.8 s), with the biggest moment — the turn and the architecture behind it — at 3.4-4.7:
 *   0.00-2.10  walkthrough  — the six screens print back to front, a packet runs between each
 *   2.10-2.90  collapse     — they slot into the device, the two loop-back flows return in red
 *   2.90-3.40  ignition     — the glass scans on top to bottom, the bezel flares
 *   3.40-4.45  the turn     — the device rotates 180 deg; three layer slabs dock out and light
 *   4.45-5.15  architecture — the chips finish lighting, data runs along the three buses
 *   5.15-6.80  open         — it turns back and the stack fans out to its stations
 *
 * Measured: 3 draws (bench lines P4, stack lines P4, one InstancedMesh of boxes P3), 2 programs,
 * 1 206 vertices high (774 line + 18 boxes) and 962 mid; lite drops the chips to 7 boxes. What
 * the loop does to the line buffer is CPU work on ~620 vertices a frame, which is less than the
 * 27 matrix compositions the cubes did.
 *
 * Only material modes that already exist are used: LINE_MODE.wire for the bench, the
 * LINE_MODE.synapse comet (uProg / uDir) for every lit moment in the model, SURFACE_MODE.edges
 * for the boxes. One uProg ramp choreographs the whole loop: each group of segments carries the
 * `aPhase` at which the light front reaches it and an `aU` that spreads it along the group.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mulberry32 } from "@/components/three/random";
import type { SceneTierConfig } from "../../tiers";
import {
  LINE_MODE,
  SURFACE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  paint,
} from "../materials";
import type { ScenePalette } from "../palette";
import { place, type SceneModel } from "./types";

/* ---- the composition ---------------------------------------------------------------------- */

/** Three-quarter view: the stack runs along z, so the model must never sit face-on to it. */
const POSE = { x: 0.24, y: -0.98, z: 0 } as const;
const SCALE = 1.2;

const SCREENS = 6;
/** A screen's half sizes and corner radius in the plan's own units, before FIT. */
const SCREEN = { hw: 0.43, hh: 0.62, r: 0.07 } as const;
/**
 * Every plan coordinate is scaled by this, so the six screens can stand further apart without
 * the model outgrowing MODEL_RADIUS. The gap is already in model units.
 */
const FIT = 0.95;
const GAP = 0.38;
/** Where the device's centre sits in pose space: chosen so the whole model straddles z = 0. */
const DEVICE_Z = 0.92;
const BENCH_Y = -0.7;
const BENCH_X = 0.78;
const BENCH_FRONT = 1.15;
const BENCH_BACK = -1.4;

/**
 * How far a screen's print flash is spread down its content, in uProg units. The frame itself
 * carries aU 0, so it flashes as a unit the moment the front reaches the screen and the content
 * then fills in under it.
 */
const PRINT_SPAN = 0.5;
/** The same, along a flow's path: how long a packet takes to cross it. */
const FLOW_SPAN = 0.62;

const STACK_ALPHA = { glow: 0.62, ink: 0.68 } as const;
const BENCH_ALPHA = { glow: 0.3, ink: 0.42 } as const;

/* ---- the clock ----------------------------------------------------------------------------- */

const LOOP = 6.8;
/** The loop starts here, not at 0: the first frame shows a full stack mid-walkthrough. */
const LOOP_START = 1.95;

const T = {
  collapse: 2.1,
  ignite: 2.9,
  turn: 3.4,
  turnEnd: 4.45,
  dock: 3.6,
  dockEnd: 4.3,
  chip: 3.95,
  turnBack: 5.15,
  turnBackEnd: 5.95,
  open: 5.5,
} as const;

/**
 * The light front's position over the loop, as (seconds, uProg) keyframes. Monotonic, so the
 * wrap at 6.8 s lands back on screen 0's print with nothing else lit.
 */
const PROG: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.0],
  [2.1, 6.0],
  [2.9, 6.2],
  [3.4, 7.5],
  [4.45, 10.4],
  [5.15, 10.9],
  [5.95, 11.2],
  [6.8, 12.0],
];

/** Where each group of segments sits on that ramp. Screen i prints at uProg = i. */
const PHASE = {
  /** A flow leaves screen i once its print is under way. */
  flow: 0.35,
  /** The two loop-back flows: cyan on the way out, red as the stack closes (uDir flips). */
  back: [5.6, 5.9] as const,
  /** The glass's content rules, scanned top to bottom. */
  glass: 6.3,
  glassStep: 0.09,
  /** The three architecture buses. */
  bus: [8.6, 9.2, 9.8] as const,
  /** A bench station tick, lit as its screen comes home. */
  tick: 11.02,
  tickStep: 0.032,
} as const;

/* ---- easing -------------------------------------------------------------------------------- */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function progAt(t: number): number {
  for (let i = 1; i < PROG.length; i += 1) {
    if (t <= PROG[i][0]) {
      const [t0, p0] = PROG[i - 1];
      const [t1, p1] = PROG[i];
      return p0 + (p1 - p0) * ((t - t0) / (t1 - t0));
    }
  }
  return PROG[PROG.length - 1][1];
}

/* ---- plane geometry (every helper this model needs lives in this file) --------------------- */

type Seg4 = [number, number, number, number];

const seg = (out: Seg4[], ax: number, ay: number, bx: number, by: number) => {
  out.push([ax, ay, bx, by]);
};
const rule = (out: Seg4[], x0: number, x1: number, y: number) => seg(out, x0, y, x1, y);
const rect = (out: Seg4[], cx: number, cy: number, w: number, h: number) => {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  seg(out, x0, y0, x1, y0);
  seg(out, x1, y0, x1, y1);
  seg(out, x1, y1, x0, y1);
  seg(out, x0, y1, x0, y0);
};

/** A rounded-rectangle outline as segment pairs: 16 points, square ends, mitred joins, no dots. */
function roundRect(out: Seg4[], hw: number, hh: number, r: number): void {
  const pts: Array<[number, number]> = [];
  const arc = (cx: number, cy: number, start: number) => {
    for (let k = 0; k <= 3; k += 1) {
      const a = start + (k / 3) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const ax = hw - r;
  const ay = hh - r;
  arc(ax, ay, 0);
  arc(-ax, ay, Math.PI / 2);
  arc(-ax, -ay, Math.PI);
  arc(ax, -ay, (3 * Math.PI) / 2);
  for (let k = 0; k < pts.length; k += 1) {
    const a = pts[k];
    const b = pts[(k + 1) % pts.length];
    seg(out, a[0], a[1], b[0], b[1]);
  }
}

/**
 * Screen `i`'s wireframe in its own plane, back to front: the brief, the shell, the catalogue,
 * the data screen, the flow list, the form. `detail` 0 is the mid tier (fewer rows and cards).
 */
function screenContent(i: number, detail: 0 | 1, out: Seg4[]): void {
  if (i === 0) {
    // the brief: a problem stated in three lines under a header
    rule(out, -0.34, 0.34, 0.44);
    rect(out, -0.28, 0.16, 0.06, 0.06);
    rule(out, -0.18, 0.3, 0.16);
    rule(out, -0.28, 0.18, 0.02);
    rule(out, -0.28, 0.06, -0.12);
    if (detail) rule(out, -0.28, 0.24, -0.3);
    return;
  }
  if (i === 1) {
    // the shell: status bar, header rule, a nav rail of three glyphs, a body block
    rule(out, -0.34, 0.34, 0.54);
    for (let k = 0; k < 3; k += 1) seg(out, 0.2 + k * 0.05, 0.505, 0.2 + k * 0.05, 0.555);
    rule(out, -0.34, 0.34, 0.4);
    seg(out, -0.22, 0.34, -0.22, -0.5);
    const rails = detail ? 3 : 2;
    for (let k = 0; k < rails; k += 1) rect(out, -0.29, 0.22 - k * 0.16, 0.07, 0.07);
    rule(out, -0.12, 0.3, 0.26);
    rule(out, -0.12, 0.22, 0.12);
    if (detail) rule(out, -0.12, 0.3, -0.02);
    rect(out, 0.09, -0.28, 0.42, 0.28);
    return;
  }
  if (i === 2) {
    // the catalogue: a card grid
    rule(out, -0.34, 0.34, 0.5);
    const rows = detail ? 3 : 2;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < 2; c += 1) rect(out, c === 0 ? -0.16 : 0.16, 0.26 - r * 0.3, 0.28, 0.26);
    }
    return;
  }
  if (i === 3) {
    // the data screen: an axis, a six-point chart, two legend keys
    rule(out, -0.34, 0.34, 0.46);
    seg(out, -0.28, 0.32, -0.28, -0.24);
    rule(out, -0.28, 0.32, -0.24);
    const ys = [-0.1, 0.02, -0.04, 0.14, 0.08, 0.28];
    for (let k = 0; k < ys.length - 1; k += 1) {
      const x0 = -0.28 + (k / (ys.length - 1)) * 0.6;
      const x1 = -0.28 + ((k + 1) / (ys.length - 1)) * 0.6;
      seg(out, x0, ys[k], x1, ys[k + 1]);
    }
    if (detail) {
      rect(out, -0.26, -0.42, 0.05, 0.05);
      rect(out, -0.02, -0.42, 0.05, 0.05);
    }
    rule(out, -0.21, -0.07, -0.42);
    rule(out, 0.03, 0.2, -0.42);
    return;
  }
  if (i === 4) {
    // the flow: five states, each a leading square and a row
    rule(out, -0.34, 0.34, 0.5);
    const rows = detail ? 5 : 3;
    const widths = [0.32, 0.2, 0.28, 0.14, 0.24];
    for (let k = 0; k < rows; k += 1) {
      const y = 0.34 - k * 0.16;
      rect(out, -0.28, y, 0.06, 0.06);
      rule(out, -0.21, widths[k], y);
    }
    return;
  }
  // the action: three fields and a filled button
  rule(out, -0.34, 0.34, 0.5);
  const fields = detail ? 3 : 2;
  for (let k = 0; k < fields; k += 1) rect(out, 0, 0.34 - k * 0.18, 0.62, 0.13);
  rect(out, 0, -0.28, 0.4, 0.16);
  for (let k = 0; k < 3; k += 1) rule(out, -0.14, 0.14, -0.24 - k * 0.04);
}

/** Where a flow leaves screen `i`, and where the next one lands: both on real controls. */
const PORT_OUT: ReadonlyArray<readonly [number, number]> = [
  [0.3, 0.16],
  [-0.29, -0.1],
  [0.16, -0.3],
  [0.32, 0.28],
  [0.2, -0.3],
  [0.0, -0.28],
];
const PORT_IN: ReadonlyArray<readonly [number, number]> = [
  [-0.28, 0.44],
  [-0.34, 0.4],
  [-0.16, 0.26],
  [-0.28, -0.1],
  [-0.28, 0.34],
  [0.0, 0.34],
];

const FLOW_BOW: ReadonlyArray<readonly [number, number, number]> = [
  [0.54, 0.2, 0.06],
  [-0.52, -0.26, 0.06],
  [0.58, -0.14, 0.06],
  [0.46, 0.34, 0.06],
  [-0.56, 0.14, 0.06],
];

type FlowSpec = {
  from: number;
  to: number;
  a: readonly [number, number];
  b: readonly [number, number];
  bow: readonly [number, number, number];
  segs: number;
  start: number;
};

/* ---- the boxes ----------------------------------------------------------------------------- */

type BoxKind = "body" | "glass" | "trim" | "slab" | "chip";
type BoxSpec = {
  kind: BoxKind;
  /** Turn-local centre, before the slabs dock out. */
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Which slab a slab or a chip belongs to, and the order a chip lights in. */
  slab: number;
  order: number;
};

/** Interface, API, data — the three layers that dock out of the device's back. */
const SLAB_Y = [0.27, 0.0, -0.27] as const;
const SLAB_Z = { home: -0.02, docked: -0.4 } as const;

function buildBoxes(chips: number): BoxSpec[] {
  const out: BoxSpec[] = [
    { kind: "body", x: 0, y: 0, z: 0, w: 0.72, h: 1.06, d: 0.085, slab: -1, order: 0 },
    { kind: "glass", x: 0, y: 0.02, z: 0.05, w: 0.6, h: 0.88, d: 0.012, slab: -1, order: 0 },
    { kind: "trim", x: 0, y: 0.478, z: 0.05, w: 0.1, h: 0.018, d: 0.01, slab: -1, order: 0 },
    { kind: "trim", x: 0, y: -0.486, z: 0.05, w: 0.24, h: 0.014, d: 0.01, slab: -1, order: 0 },
  ];
  for (let k = 0; k < 3; k += 1) {
    out.push({ kind: "slab", x: 0, y: SLAB_Y[k], z: 0, w: 0.66, h: 0.17, d: 0.06, slab: k, order: k });
  }
  // Component chips docked into the three slabs, spread with a fixed seed so the board reads as
  // a board and not as a ruler.
  const random = mulberry32(0xd7a51);
  const perSlab = chips >= 11 ? [4, 4, 3] : [3, 2, 2];
  let order = 0;
  for (let k = 0; k < 3; k += 1) {
    const n = perSlab[k];
    for (let c = 0; c < n; c += 1) {
      const t = n === 1 ? 0.5 : c / (n - 1);
      out.push({
        kind: "chip",
        x: -0.24 + t * 0.48 + (random() - 0.5) * 0.03,
        y: SLAB_Y[k] + (c % 2 === 0 ? 0.035 : -0.035),
        z: -0.048,
        w: 0.07 + random() * 0.024,
        h: 0.058,
        d: 0.042,
        slab: k,
        order,
      });
      order += 1;
    }
  }
  return out;
}

/* ---- the model ----------------------------------------------------------------------------- */

export function createProductStackModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-product-stack";
  const pose = new Group();
  pose.rotation.set(POSE.x, POSE.y, POSE.z);
  pose.scale.setScalar(SCALE);
  group.add(pose);

  // High draws three UI cards where mid draws two; the same split picks this model's detail.
  const detail: 0 | 1 = config.uiCards > 2 ? 1 : 0;
  const flowSegs = detail ? 9 : 6;
  const backSegs = detail ? 11 : 7;
  const gridSteps = detail ? 4 : 3;
  const glassRules = detail ? 12 : 8;
  const chipCount = detail ? 11 : 7;

  /* the bench: a flat grid lying back under everything, with four corner brackets. Static. */
  const benchPositions: number[] = [];
  const pushBench = (ax: number, az: number, bx: number, bz: number) => {
    benchPositions.push(ax, BENCH_Y, az, bx, BENCH_Y, bz);
  };
  for (let j = 0; j < 6; j += 1) {
    const x = -BENCH_X + (j / 5) * (BENCH_X * 2);
    for (let k = 0; k < gridSteps; k += 1) {
      pushBench(
        x,
        lerp(BENCH_BACK, BENCH_FRONT, k / gridSteps),
        x,
        lerp(BENCH_BACK, BENCH_FRONT, (k + 1) / gridSteps),
      );
    }
  }
  for (let j = 0; j < 5; j += 1) {
    const z = lerp(BENCH_BACK, BENCH_FRONT, j / 4);
    for (let k = 0; k < gridSteps; k += 1) {
      pushBench(lerp(-BENCH_X, BENCH_X, k / gridSteps), z, lerp(-BENCH_X, BENCH_X, (k + 1) / gridSteps), z);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (BENCH_X + 0.06);
      const z = sz > 0 ? BENCH_FRONT + 0.06 : BENCH_BACK - 0.06;
      pushBench(x, z, x - sx * 0.2, z);
      pushBench(x, z, x, z - sz * 0.2);
    }
  }
  const benchGeometry = new BufferGeometry();
  benchGeometry.setAttribute("position", new BufferAttribute(new Float32Array(benchPositions), 3));
  const bench = createLineMaterial({
    mode: LINE_MODE.wire,
    roles: { a: "blue", b: "cyan", hot: "red" },
    alpha: BENCH_ALPHA.glow,
  });
  const benchLines = place(new LineSegments(benchGeometry, bench.material), 4);
  pose.add(benchLines);

  /* the stack: screens, flows, the glass's content, the architecture buses, the station ticks */
  const positions: number[] = [];
  const us: number[] = [];
  const phases: number[] = [];
  let cursor = 0;
  const pushVertices = (u: readonly number[], phase: readonly number[]) => {
    for (let k = 0; k < u.length; k += 1) {
      positions.push(0, 0, 0);
      us.push(u[k]);
      phases.push(phase[k]);
    }
    const start = cursor;
    cursor += u.length;
    return start;
  };

  /** Screen i's plane coordinates, four numbers (ax, ay, bx, by) per segment. */
  const screenBase: Float32Array[] = [];
  const screenStart: number[] = [];
  for (let i = 0; i < SCREENS; i += 1) {
    const segs: Seg4[] = [];
    roundRect(segs, SCREEN.hw, SCREEN.hh, SCREEN.r);
    const frameSegs = segs.length;
    screenContent(i, detail, segs);
    const base = new Float32Array(segs.length * 4);
    const u: number[] = [];
    const phase: number[] = [];
    const uOf = (y: number, k: number) =>
      k < frameSegs ? 0 : PRINT_SPAN * (1 - clamp01((y + SCREEN.hh) / (2 * SCREEN.hh)));
    for (let s = 0; s < segs.length; s += 1) {
      const [ax, ay, bx, by] = segs[s];
      base[s * 4] = ax * FIT;
      base[s * 4 + 1] = ay * FIT;
      base[s * 4 + 2] = bx * FIT;
      base[s * 4 + 3] = by * FIT;
      u.push(uOf(ay, s), uOf(by, s));
      phase.push(i, i);
    }
    screenBase.push(base);
    screenStart.push(pushVertices(u, phase));
  }

  const flows: FlowSpec[] = [];
  const addFlow = (
    from: number,
    to: number,
    bow: readonly [number, number, number],
    phase: number,
    segs: number,
  ) => {
    const u: number[] = [];
    const phaseOf: number[] = [];
    for (let k = 0; k < segs; k += 1) {
      u.push((FLOW_SPAN * k) / segs, (FLOW_SPAN * (k + 1)) / segs);
      phaseOf.push(phase, phase);
    }
    flows.push({
      from,
      to,
      a: [PORT_OUT[from][0] * FIT, PORT_OUT[from][1] * FIT],
      b: [PORT_IN[to][0] * FIT, PORT_IN[to][1] * FIT],
      bow,
      segs,
      start: pushVertices(u, phaseOf),
    });
  };
  for (let i = 0; i < SCREENS - 1; i += 1) addFlow(i, i + 1, FLOW_BOW[i], i + PHASE.flow, flowSegs);
  // Two flows that loop back from the action screen, which is what a real product flow does.
  addFlow(5, 1, [-0.78, 0.42, 0], PHASE.back[0], backSegs);
  addFlow(5, 2, [0.8, -0.44, 0], PHASE.back[1], backSegs);

  /** The glass's content rules, in turn-local space; the ignition scans them top to bottom. */
  const glassBase: number[] = [];
  const glassStart = (() => {
    const u: number[] = [];
    const phase: number[] = [];
    const widths = [1.0, 0.72, 0.9, 0.52, 0.96, 0.66, 0.84, 0.46, 1.0, 0.6, 0.78, 0.5];
    for (let k = 0; k < glassRules; k += 1) {
      const y = 0.38 - (k / (glassRules - 1)) * 0.76;
      const w = 0.5 * widths[k % widths.length];
      glassBase.push(-0.25, y, 0.058, -0.25 + w, y, 0.058);
      u.push(0, 0);
      const p = PHASE.glass + k * PHASE.glassStep;
      phase.push(p, p);
    }
    return pushVertices(u, phase);
  })();

  /** The three architecture buses and the links between them; they follow the docking slabs. */
  type BusSeg = { ax: number; ay: number; bx: number; by: number; dz: number };
  const buses: BusSeg[] = [];
  const busStart = (() => {
    const u: number[] = [];
    const phase: number[] = [];
    for (let k = 0; k < 3; k += 1) {
      for (let s = 0; s < 3; s += 1) {
        buses.push({ ax: -0.24 + s * 0.16, ay: SLAB_Y[k], bx: -0.08 + s * 0.16, by: SLAB_Y[k], dz: -0.062 });
        u.push((FLOW_SPAN * s) / 3, (FLOW_SPAN * (s + 1)) / 3);
        phase.push(PHASE.bus[k], PHASE.bus[k]);
      }
    }
    for (let k = 0; k < 2; k += 1) {
      for (const x of [-0.14, 0.14]) {
        buses.push({ ax: x, ay: SLAB_Y[k] - 0.085, bx: x, by: SLAB_Y[k + 1] + 0.085, dz: -0.062 });
        u.push(0.5, 0.62);
        phase.push(PHASE.bus[k] + 0.3, PHASE.bus[k] + 0.3);
      }
    }
    return pushVertices(u, phase);
  })();

  /** One square station tick on the bench under each screen's home, lit as the screen lands. */
  const tickStart = (() => {
    const u: number[] = [];
    const phase: number[] = [];
    for (let i = 0; i < SCREENS; i += 1) {
      const p = PHASE.tick + i * PHASE.tickStep;
      for (let k = 0; k < 8; k += 1) {
        u.push(0);
        phase.push(p);
      }
    }
    return pushVertices(u, phase);
  })();

  const stackPositions = new Float32Array(positions);
  const stackGeometry = new BufferGeometry();
  const positionAttribute = new BufferAttribute(stackPositions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  stackGeometry.setAttribute("position", positionAttribute);
  stackGeometry.setAttribute("aU", new BufferAttribute(new Float32Array(us), 1));
  stackGeometry.setAttribute("aPhase", new BufferAttribute(new Float32Array(phases), 1));
  const stack = createLineMaterial({
    mode: LINE_MODE.synapse,
    roles: { a: "blue", b: "cyan", hot: "red" },
    alpha: STACK_ALPHA.glow,
  });
  const stackLines = place(new LineSegments(stackGeometry, stack.material), 6);
  pose.add(stackLines);

  /* the device and its back: one instanced box mesh, box edges lit, faces faint */
  const boxes = buildBoxes(chipCount);
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const surface = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    // The boxes are solid faces next to hairlines: at 1 they swallow the wireframes in glow.
    intensity: 0.45,
  });
  const mesh = place(new InstancedMesh(boxGeometry, surface.material, boxes.length), 5);
  pose.add(mesh);
  const solidCount = boxes.filter((box) => box.kind !== "chip").length;

  /* ---- per-frame state --------------------------------------------------------------------- */

  const matrix = new Matrix4();
  const quaternion = new Quaternion();
  const axisY = new Vector3(0, 1, 0);
  const boxPosition = new Vector3();
  const boxScale = new Vector3();
  const tint = new Color();
  const screenScale = new Float32Array(SCREENS);
  const screenDx = new Float32Array(SCREENS);
  const screenDy = new Float32Array(SCREENS);
  const screenZ = new Float32Array(SCREENS);
  const path = new Float32Array((Math.max(flowSegs, backSegs) + 1) * 3);
  const turn = { c: 1, s: 0 };
  let clock = LOOP_START;
  let near = 2.5;

  /** A screen's home along the stack axis, in turn-local space. */
  const homeZ = (i: number) => (i - 5) * GAP - 0.3;
  /** Where it slots into the device: the glass plane, a hair apart so the six stay readable. */
  const dockZ = (i: number) => 0.05 + (i - 5) * 0.004;

  const write3 = (v: number, x: number, y: number, z: number) => {
    stackPositions[v * 3] = x;
    stackPositions[v * 3 + 1] = y;
    stackPositions[v * 3 + 2] = z;
  };
  /** Turn-local → pose space: a rotation about the device's own y, then its offset along z. */
  const writeTurned = (v: number, x: number, y: number, z: number) => {
    write3(v, turn.c * x + turn.s * z, y, -turn.s * x + turn.c * z + DEVICE_Z);
  };

  const write = (time: number, tx: number, ty: number, step: number) => {
    const t = clock;

    /* the beats */
    const turnAngle =
      Math.PI * (easeInOut(ramp(t, T.turn, T.turnEnd)) + easeInOut(ramp(t, T.turnBack, T.turnBackEnd)));
    turn.c = Math.cos(turnAngle);
    turn.s = Math.sin(turnAngle);
    const dock =
      easeOutCubic(ramp(t, T.dock, T.dockEnd)) * (1 - easeInOut(ramp(t, T.turnBack, T.turnBackEnd - 0.2)));
    const flare = t >= T.ignite && t < T.turn + 0.4 ? Math.exp(-(t - T.ignite) * 3) : 0;

    /* the pointer: which screen it is nearest, eased so it never snaps */
    const target = Math.min(5, Math.max(0, Math.round((tx * 0.5 + 0.5) * 5)));
    near += (target - near) * Math.min(1, step * 6);

    /* every screen's pose */
    let stackSum = 0;
    for (let i = 0; i < SCREENS; i += 1) {
      const closeAt = T.collapse + (5 - i) * 0.05;
      const openAt = T.open + i * 0.05;
      const s = easeInOut(ramp(t, closeAt, closeAt + 0.55)) * (1 - easeInOut(ramp(t, openAt, openAt + 0.6)));
      stackSum += s;
      const emphasis = Math.max(0, 1 - Math.abs(i - near)) * (1 - s);
      screenScale[i] = (1 - 0.3 * s) * (1 + 0.05 * emphasis);
      // The stack shears with the pointer: the front screens travel further than the back ones,
      // so moving across the hero opens and closes it in depth. It fades as the stack collapses.
      screenDx[i] = tx * 0.14 * (i - 2.5) * (1 - s);
      screenDy[i] = -ty * 0.1 * (i - 2.5) * (1 - s);
      screenZ[i] =
        lerp(homeZ(i), dockZ(i), s) +
        (Math.sin(time * 0.8 + i * 1.7) * 0.028 + 0.06 * emphasis) * (1 - s);
    }
    const spread = 1 - stackSum / SCREENS;

    /* the screens */
    for (let i = 0; i < SCREENS; i += 1) {
      const base = screenBase[i];
      const sc = screenScale[i];
      const dx = screenDx[i];
      const dy = screenDy[i];
      const z = screenZ[i];
      let v = screenStart[i];
      for (let s = 0; s < base.length; s += 4) {
        writeTurned(v, base[s] * sc + dx, base[s + 1] * sc + dy, z);
        writeTurned(v + 1, base[s + 2] * sc + dx, base[s + 3] * sc + dy, z);
        v += 2;
      }
    }

    /* the flows: a bowed path between two real controls, shrinking as the stack closes */
    for (const flow of flows) {
      const ax = flow.a[0] * screenScale[flow.from] + screenDx[flow.from];
      const ay = flow.a[1] * screenScale[flow.from] + screenDy[flow.from];
      const az = screenZ[flow.from];
      const bx = flow.b[0] * screenScale[flow.to] + screenDx[flow.to];
      const by = flow.b[1] * screenScale[flow.to] + screenDy[flow.to];
      const bz = screenZ[flow.to];
      const cx = (ax + bx) * 0.5 + flow.bow[0] * spread;
      const cy = (ay + by) * 0.5 + flow.bow[1] * spread;
      const cz = (az + bz) * 0.5 + flow.bow[2] * spread;
      for (let k = 0; k <= flow.segs; k += 1) {
        const u = k / flow.segs;
        const w = 1 - u;
        path[k * 3] = w * w * ax + 2 * w * u * cx + u * u * bx;
        path[k * 3 + 1] = w * w * ay + 2 * w * u * cy + u * u * by;
        path[k * 3 + 2] = w * w * az + 2 * w * u * cz + u * u * bz;
      }
      let v = flow.start;
      for (let k = 0; k < flow.segs; k += 1) {
        writeTurned(v, path[k * 3], path[k * 3 + 1], path[k * 3 + 2]);
        writeTurned(v + 1, path[(k + 1) * 3], path[(k + 1) * 3 + 1], path[(k + 1) * 3 + 2]);
        v += 2;
      }
    }

    /* the glass's content, and the architecture buses riding the docking slabs */
    for (let k = 0; k < glassRules * 2; k += 1) {
      writeTurned(glassStart + k, glassBase[k * 3], glassBase[k * 3 + 1], glassBase[k * 3 + 2]);
    }
    const slabZ = lerp(SLAB_Z.home, SLAB_Z.docked, dock);
    for (let k = 0; k < buses.length; k += 1) {
      const b = buses[k];
      writeTurned(busStart + k * 2, b.ax, b.ay, slabZ + b.dz);
      writeTurned(busStart + k * 2 + 1, b.bx, b.by, slabZ + b.dz);
    }

    /* the bench's station ticks: pose space, so they never turn with the device */
    for (let i = 0; i < SCREENS; i += 1) {
      const z = homeZ(i) + DEVICE_Z;
      const a = 0.05;
      const v = tickStart + i * 8;
      write3(v, -a, BENCH_Y, z - a);
      write3(v + 1, a, BENCH_Y, z - a);
      write3(v + 2, a, BENCH_Y, z - a);
      write3(v + 3, a, BENCH_Y, z + a);
      write3(v + 4, a, BENCH_Y, z + a);
      write3(v + 5, -a, BENCH_Y, z + a);
      write3(v + 6, -a, BENCH_Y, z + a);
      write3(v + 7, -a, BENCH_Y, z - a);
    }
    positionAttribute.needsUpdate = true;

    /* the device and its back */
    quaternion.setFromAxisAngle(axisY, turnAngle);
    const closed = stackSum / SCREENS;
    for (let k = 0; k < boxes.length; k += 1) {
      const box = boxes[k];
      const back = box.kind === "slab" || box.kind === "chip";
      const z = back ? box.z + slabZ : box.z;
      boxPosition.set(turn.c * box.x + turn.s * z, box.y, -turn.s * box.x + turn.c * z + DEVICE_Z);
      boxScale.set(box.w, box.h, box.d);
      matrix.compose(boxPosition, quaternion, boxScale);
      mesh.setMatrixAt(k, matrix);
      let glow: number;
      if (box.kind === "body") glow = 0.46 + 0.55 * closed + flare * 0.9;
      else if (box.kind === "glass") glow = 0.08 + 0.8 * closed + flare * 0.7;
      else if (box.kind === "trim") glow = 0.4 + 0.6 * closed;
      else if (box.kind === "slab") {
        glow = 0.18 + 1.6 * easeOutCubic(ramp(dock, box.slab * 0.18, box.slab * 0.18 + 0.6));
      } else {
        glow = 0.05 + 1.8 * clamp01((t - (T.chip + box.order * 0.055)) * 6) * dock;
      }
      mesh.setColorAt(k, tint.setScalar(glow));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /* the light front: one ramp choreographs every lit moment in the model */
    stack.uniforms.uProg.value = progAt(t);
    stack.uniforms.uDir.value = t >= T.collapse && t < T.ignite ? -1 : 1;
  };

  const applyPalette = (next: ScenePalette) => {
    paint(bench, next);
    paint(stack, next);
    paint(surface, next);
    bench.uniforms.uAlpha.value = BENCH_ALPHA[next.mode];
    stack.uniforms.uAlpha.value = STACK_ALPHA[next.mode];
  };
  applyPalette(palette);
  write(0, 0, 0, 1);

  return {
    kind: "cubes",
    group,
    objects: [group],

    resetCycle() {
      // Not 0: the loop's own start pose is the composition the swarm lands on.
      clock = LOOP_START;
      near = 2.5;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      if (clock >= LOOP) clock -= LOOP * Math.floor(clock / LOOP);
      bench.uniforms.uTime.value = frame.time;
      bench.uniforms.uReveal.value = frame.reveal;
      stack.uniforms.uTime.value = frame.time;
      stack.uniforms.uReveal.value = frame.reveal;
      surface.uniforms.uTime.value = frame.time;
      surface.uniforms.uReveal.value = frame.reveal;
      write(frame.time, frame.tx, frame.ty, frame.step);
    },

    setLite(next) {
      // The chips are the tail of the instance buffer and the only part worth dropping.
      mesh.count = next ? solidCount : boxes.length;
    },

    setPalette: applyPalette,

    dispose() {
      benchGeometry.dispose();
      stackGeometry.dispose();
      boxGeometry.dispose();
      bench.material.dispose();
      stack.material.dispose();
      surface.material.dispose();
      mesh.dispose();
    },
  };
}
