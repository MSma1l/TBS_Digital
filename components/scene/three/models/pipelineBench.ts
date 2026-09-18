/**
 * "Banda de integrare" (the integration bench) — "Automatizare & API".
 *
 * Five stations on a plinth, read left to right — SOURCES · CONTRACT · RULES · DELIVERY · LOG —
 * strung on one conduit that terraces in y and z, so the bench reads in depth as it sways.
 * Records ride the conduit as boxes, flatten into cards at CONTRACT, take the router's upper
 * branch or stay on the spine at RULES, and are written through the sliding doors at DELIVERY.
 * Every station's core lights as a record reaches it, so a successful sync is a light running
 * the length of the bench. The fifth record of each run meets a closed gate: it stops, turns
 * red, the whole conduit stalls, the record is lifted onto the retry arc, rides it back over
 * the bench, re-enters — and that write goes through in the run's brightest moment.
 *
 * Draws (3): the conduit — spine, router branch and the three source feeders — merged into one
 * tube geometry (P5, `links`); every box on the bench as one instanced mesh (P3, `edges`,
 * colour per instance) — the plinth, posts, housings, gate frame and source glyphs written
 * once, the cores, queue bars, paddle, doors, log bars, records and retry rail written per
 * frame; the HUD brackets and the plinth's rule as one line set (P4, `wire`). `edges` reads a
 * box's own local coordinates, so every box here is the one unit box sized by its matrix —
 * that is why the standing frame is instanced too, rather than merged.
 *
 * No entrance of its own: the idle loop is the show, and the clock opens at
 * `BENCH_RUN.composed`, mid-composition, so the first frame of a service page is already a
 * bench with four records on it and a write going through the open doors.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Curve,
  Euler,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  Quaternion,
  TubeGeometry,
  Vector3,
} from "three";
import { mulberry32 } from "@/components/three/random";
import { clamp01, easeOutCubic, smoothstep } from "../../choreography";
import type { Vec3 } from "../../shapes";
import type { SceneTierConfig } from "../../tiers";
import {
  LINE_MODE,
  SURFACE_MODE,
  TUBE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  createTubeMaterial,
  paint,
  toColor,
} from "../materials";
import type { ScenePalette } from "../palette";
import { mergeTagged, place, type SceneModel } from "./types";

/* ---- the bench, as pure arithmetic --------------------------------------------------------- */

/** The five station anchors, left to right. */
export const BENCH_STATIONS: readonly Vec3[] = [
  [-1.62, 0.5, 0.28],
  [-0.81, 0.04, -0.22],
  [0, 0.46, 0.32],
  [0.81, -0.02, -0.22],
  [1.62, 0.44, 0.24],
];

/** Each station's body (x, y, z); the gate's row is its frame's extent. */
const BODY: readonly Vec3[] = [
  [0.42, 0.5, 0.38],
  [0.38, 0.32, 0.36],
  [0.4, 0.36, 0.36],
  [0.53, 0.62, 0.34],
  [0.46, 0.4, 0.34],
];

/** The three source glyphs feeding station 1: a drum (database), a diamond (API), a slot (queue). */
const GLYPHS: readonly Vec3[] = [
  [-2.06, 0.82, 0.06],
  [-2.14, 0.5, 0.3],
  [-2.06, 0.18, 0.48],
];

/** Top of the plinth: the posts stand on it and the bench's rule is drawn along it. */
const PLINTH_Y = -0.62;

/**
 * The bench is wide, not compact, and reads in perspective rather than flat on, so it carries
 * its own pose and scale — one, not the hub's 1.2, because it spreads instead of massing.
 * `MODEL_POSES` / `MODEL_SCALES` in `samples.ts` still hold the old hub's `[0.42, 0, 0]` at
 * 1.2; that table also feeds the morph swarm and belongs to whoever owns `samples.ts` —
 * `hubSamples` needs the same treatment before a burst can land on this silhouette.
 */
const BENCH_POSE: readonly [number, number, number] = [-0.1, 0.34, 0.03];
const BENCH_SCALE = 1;

/** Catmull-Rom control points: the five anchors with a reflected phantom at each end. */
const SPINE: readonly Vec3[] = (() => {
  const s = BENCH_STATIONS;
  const n = s.length;
  const head: Vec3 = [2 * s[0][0] - s[1][0], 2 * s[0][1] - s[1][1], 2 * s[0][2] - s[1][2]];
  const tail: Vec3 = [
    2 * s[n - 1][0] - s[n - 2][0],
    2 * s[n - 1][1] - s[n - 2][1],
    2 * s[n - 1][2] - s[n - 2][2],
  ];
  return [head, ...s, tail];
})();

/** Pure. The conduit's spine at `u` ∈ [0, 4] — `u = k` is station k; clamped at both ends. */
export function benchPoint(u: number): Vec3 {
  const uu = u <= 0 ? 0 : u >= 4 ? 4 : u;
  const k = Math.min(3, Math.floor(uu));
  const t = uu - k;
  const t2 = t * t;
  const t3 = t2 * t;
  const out: Vec3 = [0, 0, 0];
  for (let a = 0; a < 3; a += 1) {
    const p0 = SPINE[k][a];
    const p1 = SPINE[k + 1][a];
    const p2 = SPINE[k + 2][a];
    const p3 = SPINE[k + 3][a];
    out[a] =
      0.5 *
      (2 * p1 +
        (p2 - p0) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
  return out;
}

/** Pure. Unit tangent of the spine at `u`. */
export function benchTangent(u: number): Vec3 {
  const a = benchPoint(u - 1e-3);
  const b = benchPoint(u + 1e-3);
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
}

function bezier3(a: Vec3, b: Vec3, c: Vec3, d: Vec3, t: number): Vec3 {
  const s = 1 - t;
  const w0 = s * s * s;
  const w1 = 3 * s * s * t;
  const w2 = 3 * s * t * t;
  const w3 = t * t * t;
  return [
    a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3,
    a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3,
    a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3,
  ];
}

function lifted(p: Vec3, dx: number, dy: number, dz: number): Vec3 {
  return [p[0] + dx, p[1] + dy, p[2] + dz];
}

const BRANCH_A = benchPoint(2);
const BRANCH_D = benchPoint(3);
const BRANCH_B = lifted(BRANCH_A, 0.2, 0.5, 0.06);
const BRANCH_C = lifted(BRANCH_D, -0.2, 0.5, 0.06);

/** Pure. The router's upper branch at `s` ∈ [0, 1] — RULES to DELIVERY, over the spine. */
export function benchBranch(s: number): Vec3 {
  return bezier3(BRANCH_A, BRANCH_B, BRANCH_C, BRANCH_D, clamp01(s));
}

/** Where the retry arc sets the record back down: nearly a station back from the gate. */
const RETRY_U = 2.15;
const ARC_A = benchPoint(3);
const ARC_D = benchPoint(RETRY_U);
const ARC_B = lifted(ARC_A, 0.26, 0.86, 0.04);
const ARC_C = lifted(ARC_D, 0.1, 0.9, 0.04);

/** Pure. The retry arc at `t` ∈ [0, 1]: out of the gate, back over the bench, onto the line. */
export function retryArcPoint(t: number): Vec3 {
  return bezier3(ARC_A, ARC_B, ARC_C, ARC_D, clamp01(t));
}

/* ---- the run -------------------------------------------------------------------------------- */

/**
 * One run of the bench, in seconds: a batch of five records, the fifth of which fails and
 * recovers. The refusal lands at 3.40 s and the write that finally goes through at ~5.2 s, so a
 * visitor who watches for seven seconds cannot miss the story, whenever they arrived.
 */
export const BENCH_RUN = {
  loop: 6.4,
  /** Between two records leaving the sources. */
  release: 0.46,
  /** One spine segment, station to station. */
  segment: 0.52,
  packets: 5,
  /** The protagonist turning red at the closed gate. */
  redden: 0.12,
  /** How long it waits there before the retry lifts it. */
  hold: 0.42,
  /** The arc, walked at a constant speed on purpose. */
  arc: 0.9,
  /** The run back in through the gate. */
  pass: 0.34,
  /** The doors part this long before a record arrives and close this long after it leaves. */
  door: 0.16,
  /** Where the clock opens: four records on the bench, a write going through — never at 0. */
  composed: 2.46,
} as const;

const GATE_U = 3;

/** Pure. When record `i` of a run reaches the delivery gate. */
export function benchGateTime(i: number): number {
  return i * BENCH_RUN.release + GATE_U * BENCH_RUN.segment;
}

const FAULT_AT = benchGateTime(BENCH_RUN.packets - 1);
const ARC_START = FAULT_AT + BENCH_RUN.redden + BENCH_RUN.hold;
const ARC_END = ARC_START + BENCH_RUN.arc;
const PASS_END = ARC_END + BENCH_RUN.pass;
/** Where the protagonist stands once it is through the gate for the second time. */
const PASS_TO = 3.12;
/** The reset breath: the log settles and the line comes back to its resting brightness. */
const REST_AT = 6.05;

export type BenchPacket = {
  live: boolean;
  /** Along the spine, 0..4. */
  u: number;
  /** On the retry arc, 0..1, or -1 while it is on the spine. */
  arc: number;
  /** 0 healthy → 1 failed. */
  fault: number;
  /** Fades in at the sources and out past the log. */
  fade: number;
};

/** Pure. Where record `i` of the batch is at `t` seconds into a run. */
export function benchPacketAt(i: number, t: number, out: BenchPacket): BenchPacket {
  out.live = false;
  out.u = 0;
  out.arc = -1;
  out.fault = 0;
  out.fade = 1;
  const ride = (u: number) => {
    if (u < 0 || u > 4.08) return out;
    out.u = u > 4 ? 4 : u;
    out.fade = smoothstep(0, 0.12, u) * (1 - smoothstep(3.92, 4.08, u));
    out.live = true;
    return out;
  };
  const hero = i === BENCH_RUN.packets - 1;
  if (!hero || t < FAULT_AT) return ride((t - i * BENCH_RUN.release) / BENCH_RUN.segment);
  if (t < ARC_START) {
    out.u = GATE_U;
    out.fault = smoothstep(FAULT_AT, FAULT_AT + BENCH_RUN.redden, t);
    out.live = true;
    return out;
  }
  if (t < ARC_END) {
    out.arc = (t - ARC_START) / BENCH_RUN.arc;
    out.fault = 1;
    out.live = true;
    return out;
  }
  if (t < PASS_END) {
    out.u = RETRY_U + (PASS_TO - RETRY_U) * ((t - ARC_END) / BENCH_RUN.pass);
    out.fault = 1 - smoothstep(ARC_END, ARC_END + 0.16, t);
    out.live = true;
    return out;
  }
  return ride(PASS_TO + (t - PASS_END) / BENCH_RUN.segment);
}

/** Pure. A window with eased edges. */
function gatePulse(t: number, from: number, to: number, edge: number): number {
  return smoothstep(from, from + edge, t) * (1 - smoothstep(to - edge, to, t));
}

/** Pure. How far the delivery doors stand apart at `t`: four writes, a refusal, then the retry. */
export function benchDoor(t: number): number {
  let open = 0;
  for (let i = 0; i < BENCH_RUN.packets - 1; i += 1) {
    const at = benchGateTime(i);
    open = Math.max(open, gatePulse(t, at - BENCH_RUN.door, at + BENCH_RUN.door, 0.12));
  }
  return Math.max(open, gatePulse(t, PASS_END - 0.5, PASS_END + 0.14, 0.12));
}

/** Pure. The write is failing: the line stalls from the refusal to the end of the arc. */
export function benchStall(t: number): number {
  return gatePulse(t, FAULT_AT + 0.04, ARC_END - 0.04, 0.18);
}

/** Pure. The run's brightest moment: the recovered write going through. */
export function benchSurge(t: number): number {
  return gatePulse(t, ARC_END + 0.06, ARC_END + 0.56, 0.1);
}

/** Pure. How brightly station `stage` burns with the records sitting at `us`. */
export function benchFlare(us: ArrayLike<number>, count: number, stage: number): number {
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const d = us[i] - stage;
    sum += Math.exp(-(d * d * 26));
  }
  return sum > 1.6 ? 1.6 : sum;
}

/** Pure. Log bar `j` at `t`: it fills on a write and settles back over the reset breath. */
export function benchLogBar(t: number, j: number): number {
  const at = j < BENCH_RUN.packets - 1 ? benchGateTime(j) : PASS_END;
  if (t < at) return 0;
  return easeOutCubic((t - at) / 0.18) * (1 - 0.85 * smoothstep(REST_AT, REST_AT + 0.3, t));
}

/* ---- the instanced bench -------------------------------------------------------------------- */

/**
 * Every box on the bench is one instance of the same unit box. The slots are fixed, so a frame
 * only ever writes matrices and colours — never the buffer's size. `shell` holds the standing
 * frame, written once (and again on a theme change) and left alone after that.
 */
const SLOT = {
  cores: 0,
  glyphs: 5,
  queue: 8,
  paddle: 12,
  doors: 13,
  log: 15,
  packets: 20,
  rail: 25,
  feeders: 37,
  dead: 40,
  shell: 42,
} as const;
const RAIL_MAX = 12;
const SHELL_MAX = 24;
const SLOT_COUNT = SLOT.shell + SHELL_MAX;

/** Record sizes: a box out of the sources, a flat card once CONTRACT has shaped it. */
const RECORD_BOX: Vec3 = [0.2, 0.14, 0.14];
const RECORD_CARD: Vec3 = [0.26, 0.17, 0.05];

/** A curve over any pure point function, for `TubeGeometry`. */
class PathCurve extends Curve<Vector3> {
  private readonly at: (t: number) => Vec3;

  // @types/three declares Curve's constructor protected; subclasses re-expose it.
  constructor(at: (t: number) => Vec3) {
    super();
    this.at = at;
  }

  override getPoint(t: number, target: Vector3 = new Vector3()): Vector3 {
    const [x, y, z] = this.at(t);
    return target.set(x, y, z);
  }
}

type ShellPart = { size: Vec3; at: Vec3; gain: number; rot?: Vec3 };

/** The standing frame: plinth, posts, housings, the gate's portal and the source glyphs. */
function benchShell(): ShellPart[] {
  const parts: ShellPart[] = [];
  parts.push({ size: [3.66, 0.08, 0.62], at: [0, PLINTH_Y - 0.04, 0.04], gain: 0.42 });
  for (let s = 0; s < BENCH_STATIONS.length; s += 1) {
    const [x, y, z] = BENCH_STATIONS[s];
    const [w, h, d] = BODY[s];
    const foot = y - h / 2;
    parts.push({ size: [0.07, foot - PLINTH_Y, 0.07], at: [x, (foot + PLINTH_Y) / 2, z], gain: 0.38 });
    if (s === 3) {
      // the delivery gate: a portal the doors slide inside, with the dead-letter stub beside it
      parts.push({ size: [0.05, h, d], at: [x - w / 2, y, z], gain: 1 });
      parts.push({ size: [0.05, h, d], at: [x + w / 2, y, z], gain: 1 });
      parts.push({ size: [w, 0.05, d], at: [x, y + h / 2, z], gain: 1 });
      parts.push({ size: [w, 0.05, d], at: [x, y - h / 2, z], gain: 1 });
      parts.push({ size: [0.12, 0.1, 0.2], at: [x + 0.18, y - h / 2 - 0.14, z], gain: 0.6 });
    } else if (s === 4) {
      // the log rack: two shelves between two uprights
      parts.push({ size: [w, 0.04, d], at: [x, y + 0.16, z], gain: 0.78 });
      parts.push({ size: [w, 0.04, d], at: [x, y - 0.18, z], gain: 0.78 });
      parts.push({ size: [0.04, h, d], at: [x - w / 2, y, z], gain: 0.78 });
      parts.push({ size: [0.04, h, d], at: [x + w / 2, y, z], gain: 0.78 });
    } else {
      parts.push({ size: [w, h, d], at: [x, y, z], gain: 0.72 });
      if (s === 1) parts.push({ size: [0.06, 0.2, 0.3], at: [x + w / 2 + 0.03, y, z], gain: 1 });
    }
  }
  parts.push({ size: [0.24, 0.18, 0.24], at: GLYPHS[0], gain: 0.95 });
  parts.push({ size: [0.19, 0.19, 0.19], at: GLYPHS[1], gain: 0.95, rot: [0, Math.PI / 4, Math.PI / 4] });
  parts.push({ size: [0.3, 0.11, 0.18], at: GLYPHS[2], gain: 0.95 });
  return parts;
}

const LUT_SIZE = 256;
const X_AXIS = new Vector3(1, 0, 0);
/** The conduit's light advances one segment per `BENCH_RUN.segment`, like the records on it. */
const FLOW_RATE = 2 / BENCH_RUN.segment;

export function createPipelineBenchModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-pipeline-bench";
  const pose = new Group();
  pose.rotation.set(BENCH_POSE[0], BENCH_POSE[1], BENCH_POSE[2]);
  pose.scale.setScalar(BENCH_SCALE);
  group.add(pose);

  /* The conduit: four spine segments, the router's branch and three source feeders, merged.
     `links` gives every tube a comet from `uTime` that lights the tube behind it — one draw
     carrying both the resting conduit (uColorA) and the light running along it (uColorB). The
     integer part of `aTag` picks a tube's phase: the spine and the branch share 0, so their
     comets march in step, one per segment; the feeders sit a third of a cycle behind. */
  const along = Math.max(8, Math.round(config.link[0] / 3));
  const around = config.link[1];
  const tubeParts: Array<{ geometry: BufferGeometry; tag: number }> = [];
  for (let k = 0; k < 4; k += 1) {
    tubeParts.push({
      geometry: new TubeGeometry(new PathCurve((t) => benchPoint(k + t)), along, 0.035, around, false),
      tag: 0,
    });
  }
  tubeParts.push({
    geometry: new TubeGeometry(new PathCurve(benchBranch), along + 2, 0.026, around, false),
    tag: 0,
  });
  const feedAlong = Math.max(4, Math.round(along / 3));
  for (let g = 0; g < GLYPHS.length; g += 1) {
    const from = GLYPHS[g];
    const to = BENCH_STATIONS[0];
    const bow = 0.1 * (g - 1);
    tubeParts.push({
      geometry: new TubeGeometry(
        new PathCurve((t) => {
          const s = 1 - t;
          const mx = (from[0] + to[0]) / 2;
          const my = (from[1] + to[1]) / 2;
          const mz = (from[2] + to[2]) / 2 + bow;
          return [
            s * s * from[0] + 2 * s * t * mx + t * t * to[0],
            s * s * from[1] + 2 * s * t * my + t * t * to[1],
            s * s * from[2] + 2 * s * t * mz + t * t * to[2],
          ];
        }),
        feedAlong,
        0.02,
        around,
        false,
      ),
      tag: 1,
    });
  }
  const conduitGeometry = mergeTagged(tubeParts);
  const conduit = createTubeMaterial({
    mode: TUBE_MODE.links,
    roles: { a: "blue", b: "cyan", hot: "red" },
    alpha: 0.4,
  });
  const conduitMesh = place(new Mesh(conduitGeometry, conduit.material), 5);
  pose.add(conduitMesh);

  /* Every box on the bench: one instanced mesh, a matrix and a colour per slot. */
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const parts = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: 1.1,
  });
  const partMesh = place(new InstancedMesh(boxGeometry, parts.material, SLOT_COUNT), 6);
  partMesh.count = SLOT_COUNT;
  pose.add(partMesh);

  /* The HUD: a bracket at each station's front corners and a ruled scale along the plinth. */
  const segments: number[] = [];
  const addLine = (a: Vec3, b: Vec3) => {
    segments.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  };
  for (let s = 0; s < BENCH_STATIONS.length; s += 1) {
    const [x, y, z] = BENCH_STATIONS[s];
    const [w, h, d] = BODY[s];
    const hw = w / 2 + 0.07;
    const hh = h / 2 + 0.07;
    const zf = z + d / 2 + 0.02;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const cx = x + sx * hw;
        const cy = y + sy * hh;
        addLine([cx, cy, zf], [cx - sx * 0.1, cy, zf]);
        addLine([cx, cy, zf], [cx, cy - sy * 0.1, zf]);
      }
    }
  }
  addLine([-1.83, PLINTH_Y, 0.35], [1.83, PLINTH_Y, 0.35]);
  addLine([-1.83, PLINTH_Y, -0.27], [1.83, PLINTH_Y, -0.27]);
  for (let i = 0; i <= 12; i += 1) {
    const x = -1.83 + (3.66 * i) / 12;
    addLine([x, PLINTH_Y, 0.35], [x, PLINTH_Y + (i % 3 === 0 ? 0.1 : 0.05), 0.35]);
  }
  for (const g of GLYPHS) addLine([g[0] - 0.19, g[1], g[2]], [g[0] - 0.09, g[1], g[2]]);
  const hudGeometry = new BufferGeometry();
  hudGeometry.setAttribute("position", new Float32BufferAttribute(segments, 3));
  const hud = createLineMaterial({
    mode: LINE_MODE.wire,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    alpha: 0.55,
  });
  const hudMesh = place(new LineSegments(hudGeometry, hud.material), 7);
  pose.add(hudMesh);

  /* The spine's lookup table, built once. */
  const lutPoints = new Float32Array(LUT_SIZE * 3);
  const lutTangents = new Float32Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i += 1) {
    const u = (i / (LUT_SIZE - 1)) * 4;
    lutPoints.set(benchPoint(u), i * 3);
    lutTangents.set(benchTangent(u), i * 3);
  }

  /* The retry rail: bars along the arc, placed once, lit as the record climbs past them. */
  const railCount = config.packages >= 18 ? RAIL_MAX : 8;
  const railPoints: Vector3[] = [];
  const railTurns: Quaternion[] = [];
  for (let j = 0; j < RAIL_MAX; j += 1) {
    const a = (j + 0.5) / RAIL_MAX;
    const p = retryArcPoint(a);
    const q = retryArcPoint(Math.min(1, a + 0.02));
    const dir = new Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
    railPoints.push(new Vector3(p[0], p[1], p[2]));
    railTurns.push(new Quaternion().setFromUnitVectors(X_AXIS, dir.normalize()));
  }

  const shellParts = benchShell();
  const cyan = new Color();
  const blue = new Color();
  const red = new Color();
  const hotCol = new Color();
  const tint = new Color();
  const position = new Vector3();
  const scale = new Vector3();
  const scratch = new Vector3();
  const tangent = new Vector3();
  const turn = new Quaternion();
  const matrix = new Matrix4();
  const euler = new Euler();
  const packet: BenchPacket = { live: false, u: 0, arc: -1, fault: 0, fade: 1 };
  const us = new Float32Array(BENCH_RUN.packets);
  const queueNow = [0, 0, 0, 0];
  const focusNow = [0, 0, 0, 0, 0];
  const routeUp = [false, false, false, false, false];
  let current = palette;
  let paddleNow = 0;
  let railOn = railCount;
  let feedersOn = true;
  let queueOn = 4;
  let clock = BENCH_RUN.composed;
  let runIndex = 0;
  let flowPhase = (BENCH_RUN.composed * FLOW_RATE) % 2;
  let sweep = 0;
  let lastTx = 0;

  const rollRun = () => {
    const random = mulberry32(0x9e771 + runIndex);
    for (let i = 0; i < routeUp.length; i += 1) routeUp[i] = false;
    // Two of the five records take the upper branch; which two changes from run to run, so a
    // second look is never quite the first. Deterministic, like every other seed on the site.
    let picked = 0;
    while (picked < 2) {
      const i = Math.min(BENCH_RUN.packets - 1, Math.floor(random() * BENCH_RUN.packets));
      if (routeUp[i]) continue;
      routeUp[i] = true;
      picked += 1;
    }
  };
  rollRun();

  const writePart = (slot: number, colour: Color, gain: number) => {
    matrix.compose(position, turn, scale);
    partMesh.setMatrixAt(slot, matrix);
    tint.copy(colour).multiplyScalar(gain);
    partMesh.setColorAt(slot, tint);
  };
  const hidePart = (slot: number) => {
    position.set(0, 0, 0);
    scale.set(0, 0, 0);
    turn.identity();
    matrix.compose(position, turn, scale);
    partMesh.setMatrixAt(slot, matrix);
  };
  const sampleSpine = (u: number, out: Vector3, dir: Vector3 | null) => {
    const f = clamp01(u / 4) * (LUT_SIZE - 1);
    const k = Math.min(LUT_SIZE - 2, Math.floor(f));
    const w = f - k;
    const i = k * 3;
    const j = i + 3;
    out.set(
      lutPoints[i] + (lutPoints[j] - lutPoints[i]) * w,
      lutPoints[i + 1] + (lutPoints[j + 1] - lutPoints[i + 1]) * w,
      lutPoints[i + 2] + (lutPoints[j + 2] - lutPoints[i + 2]) * w,
    );
    if (dir) dir.set(lutTangents[i], lutTangents[i + 1], lutTangents[i + 2]);
  };
  /** Which way the router's paddle points: the branch the record nearest it took. */
  const pickPaddle = (t: number) => {
    let best = 1.1;
    let angle = t > REST_AT ? 0 : paddleNow;
    for (let i = 0; i < BENCH_RUN.packets; i += 1) {
      if (us[i] < 0) continue;
      const d = Math.abs(us[i] - 2);
      if (d < best) {
        best = d;
        angle = routeUp[i] ? 0.384 : -0.384;
      }
    }
    return angle;
  };
  /** The standing frame never moves: it is written once, and again when the theme changes. */
  const writeShell = () => {
    for (let i = 0; i < SHELL_MAX; i += 1) {
      const part = shellParts[i];
      if (!part) {
        hidePart(SLOT.shell + i);
        continue;
      }
      position.set(part.at[0], part.at[1], part.at[2]);
      scale.set(part.size[0], part.size[1], part.size[2]);
      if (part.rot) turn.setFromEuler(euler.set(part.rot[0], part.rot[1], part.rot[2]));
      else turn.identity();
      writePart(SLOT.shell + i, blue, part.gain);
    }
    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  };

  const applyPalette = (next: ScenePalette) => {
    current = next;
    paint(conduit, next);
    paint(parts, next);
    paint(hud, next);
    const ink = next.mode === "ink";
    conduit.uniforms.uAlpha.value = ink ? 0.5 : 0.4;
    hud.uniforms.uAlpha.value = ink ? 0.62 : 0.55;
    // Every box carries its colour per instance — the `edges` branch multiplies uColorA by the
    // instance's hue, exactly as the commerce packages do.
    parts.uniforms.uColorA.value.setRGB(1, 1, 1);
    parts.uniforms.uIntensity.value = ink ? 0.95 : 1.1;
    toColor(next.cyan, cyan);
    toColor(next.blue, blue);
    toColor(next.red, red);
    toColor(next.hot, hotCol);
    writeShell();
  };
  applyPalette(palette);

  /** Lays out every moving part for the run's clock; returns the queue's pressure at CONTRACT. */
  const write = (reveal: number) => {
    const t = clock;
    const stall = benchStall(t);
    const surge = benchSurge(t);
    const open = benchDoor(t);
    const onArc = t >= ARC_START && t < ARC_END ? (t - ARC_START) / BENCH_RUN.arc : -1;

    /* the records */
    let pressure = 2.4 * stall;
    for (let i = 0; i < BENCH_RUN.packets; i += 1) {
      const slot = SLOT.packets + i;
      benchPacketAt(i, t, packet);
      if (!packet.live) {
        us[i] = -9;
        hidePart(slot);
        continue;
      }
      // A record on the arc has left the line: the gate goes dark behind it.
      us[i] = packet.arc >= 0 ? -9 : packet.u;
      if (packet.arc < 0 && packet.u > 0.35 && packet.u < 2) pressure += 1;
      if (packet.arc >= 0) {
        const p = retryArcPoint(packet.arc);
        const q = retryArcPoint(Math.min(1, packet.arc + 0.02));
        position.set(p[0], p[1], p[2]);
        tangent.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        if (tangent.lengthSq() < 1e-8) tangent.set(1, 0, 0);
      } else {
        sampleSpine(packet.u, position, tangent);
        if (routeUp[i] && packet.u > 2 && packet.u < 3) {
          // up onto the router's branch and back down onto the spine before the gate
          const s = packet.u - 2;
          const w = smoothstep(0, 0.16, s) * (1 - smoothstep(0.84, 1, s));
          const b = benchBranch(s);
          position.lerp(scratch.set(b[0], b[1], b[2]), w);
          tangent.y += 0.55 * w * Math.cos(Math.PI * s);
        }
      }
      turn.setFromUnitVectors(X_AXIS, tangent.normalize());
      // CONTRACT reshapes the record: the box becomes a flat card over 0.18 s across u = 1.
      const shaped = clamp01((packet.u - 1) / (0.18 / BENCH_RUN.segment));
      if (packet.fault > 0.4 && packet.arc < 0 && t < ARC_START) position.y += Math.sin(t * 46) * 0.012;
      scale.set(
        (RECORD_BOX[0] + (RECORD_CARD[0] - RECORD_BOX[0]) * shaped) * packet.fade,
        (RECORD_BOX[1] + (RECORD_CARD[1] - RECORD_BOX[1]) * shaped) * packet.fade,
        (RECORD_BOX[2] + (RECORD_CARD[2] - RECORD_BOX[2]) * shaped) * packet.fade,
      );
      const hero = i === BENCH_RUN.packets - 1;
      tint.copy(blue).lerp(cyan, shaped).lerp(red, packet.fault);
      writePart(slot, tint, (hero ? 1.5 : 1) * (1 + 0.5 * packet.fault) + (hero ? 0.8 * surge : 0));
    }

    /* the station cores: the light runs the bench stage by stage, with the records */
    for (let s = 0; s < BENCH_STATIONS.length; s += 1) {
      const [x, y, z] = BENCH_STATIONS[s];
      let flare = benchFlare(us, BENCH_RUN.packets, s);
      if (s === 0) {
        // the sources burn once per release, not once per record on the line
        for (let i = 0; i < BENCH_RUN.packets; i += 1) {
          const d = (t - i * BENCH_RUN.release) / 0.14;
          if (d >= 0 && d < 4) flare += 0.9 * Math.exp(-d * d);
        }
      }
      if (s === 3) flare = flare * (1 - 0.7 * stall) + 2.2 * surge;
      const grow = 1 + 0.35 * focusNow[s];
      if (s === 3) {
        // a plate behind the doors, so the write shows through the opening
        position.set(x, y, z - 0.19);
        scale.set(0.34 * grow, 0.14 * grow, 0.05);
      } else {
        position.set(x, y, z);
        scale.set(0.24 * grow, 0.17 * grow, 0.24 * grow);
      }
      turn.identity();
      writePart(SLOT.cores + s, s === 3 && stall > 0.35 ? red : cyan, 0.5 + 0.95 * flare + 0.5 * focusNow[s]);
    }

    /* the sources: each glyph's core flashes as it pushes a record onto its feeder */
    for (let g = 0; g < GLYPHS.length; g += 1) {
      let flash = 0;
      for (let i = g; i < BENCH_RUN.packets; i += GLYPHS.length) {
        const d = (t - i * BENCH_RUN.release) / 0.16;
        if (d >= 0 && d < 4) flash = Math.max(flash, Math.exp(-d * d));
      }
      position.set(GLYPHS[g][0], GLYPHS[g][1], GLYPHS[g][2]);
      turn.identity();
      scale.setScalar(0.09 + 0.02 * flash);
      writePart(SLOT.glyphs + g, cyan, 0.5 + 1.1 * flash);
    }

    /* the feeders' own records: a bar pushed towards the cabinet just before each release */
    for (let g = 0; g < GLYPHS.length; g += 1) {
      let ride = -1;
      for (let i = g; i < BENCH_RUN.packets; i += GLYPHS.length) {
        const k = (t - (i * BENCH_RUN.release - 0.3)) / 0.3;
        if (k >= 0 && k <= 1) ride = k;
      }
      if (!feedersOn || ride < 0) {
        hidePart(SLOT.feeders + g);
        continue;
      }
      const from = GLYPHS[g];
      const to = BENCH_STATIONS[0];
      position.set(
        from[0] + (to[0] - from[0]) * ride,
        from[1] + (to[1] - from[1]) * ride,
        from[2] + (to[2] - from[2]) * ride + 0.2 * (g - 1) * ride * (1 - ride),
      );
      tangent.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
      turn.setFromUnitVectors(X_AXIS, tangent);
      scale.set(0.11, 0.07, 0.07);
      writePart(SLOT.feeders + g, blue, 1.1);
    }

    /* CONTRACT's queue bars: back-pressure, which climbs while the line is stalled */
    for (let b = 0; b < queueNow.length; b += 1) {
      if (b >= queueOn) {
        hidePart(SLOT.queue + b);
        continue;
      }
      const [x, y, z] = BENCH_STATIONS[1];
      const height = 0.06 + 0.16 * queueNow[b];
      position.set(x - 0.09 + b * 0.06, y - 0.28 + height / 2, z + 0.24);
      turn.identity();
      scale.set(0.035, height, 0.035);
      writePart(SLOT.queue + b, blue, 0.8 + 0.9 * queueNow[b]);
    }

    /* RULES' paddle: it swings to the branch it chose */
    {
      const [x, y, z] = BENCH_STATIONS[2];
      position.set(x, y, z + 0.02);
      turn.setFromEuler(euler.set(0, 0, paddleNow));
      scale.set(0.3, 0.035, 0.12);
      writePart(SLOT.paddle, cyan, 1.15);
    }

    /* DELIVERY's doors: they part along y, so the opening reads from the front */
    {
      const [x, y, z] = BENCH_STATIONS[3];
      const gap = 0.075 + 0.135 * open;
      for (let d = 0; d < 2; d += 1) {
        position.set(x, y + (d === 0 ? gap : -gap), z);
        turn.identity();
        scale.set(0.3, 0.14, 0.3);
        writePart(SLOT.doors + d, open > 0.5 ? cyan : blue, 0.75 + 0.7 * open + 0.6 * surge);
      }
    }

    /* the LOG rack: a bar per write of the run */
    for (let j = 0; j < 5; j += 1) {
      const [x, y, z] = BENCH_STATIONS[4];
      const height = benchLogBar(t, j);
      const h = 0.03 + 0.26 * height;
      position.set(x - 0.16 + j * 0.08, y - 0.16 + h / 2, z);
      turn.identity();
      scale.set(0.05, h, 0.16);
      writePart(SLOT.log + j, j === BENCH_RUN.packets - 1 ? hotCol : cyan, 0.5 + height);
    }

    /* the retry rail: drawn but dark, lighting red behind the record that climbs it */
    const arcFade = 1 - smoothstep(ARC_END, ARC_END + 0.35, t);
    for (let j = 0; j < RAIL_MAX; j += 1) {
      if (j >= railOn) {
        hidePart(SLOT.rail + j);
        continue;
      }
      const a = (j + 0.5) / RAIL_MAX;
      const lit = onArc >= 0 ? clamp01((onArc - a) * 6) * arcFade : t >= ARC_END ? arcFade : 0;
      position.copy(railPoints[j]);
      turn.copy(railTurns[j]);
      scale.set(0.085, 0.022 + 0.022 * lit, 0.022 + 0.022 * lit);
      tint.copy(blue).lerp(red, lit);
      writePart(SLOT.rail + j, tint, 0.35 + 1.15 * lit);
    }

    /* the dead-letter stub: it only ever glows while a write is being refused */
    for (let d = 0; d < 2; d += 1) {
      const [x, y, z] = BENCH_STATIONS[3];
      position.set(x + 0.18, y - 0.46 - d * 0.07, z);
      turn.identity();
      scale.set(0.14 - d * 0.03, 0.02, 0.14);
      writePart(SLOT.dead + d, red, 0.3 + 0.9 * stall);
    }

    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

    conduit.uniforms.uTime.value = flowPhase;
    conduit.uniforms.uIntensity.value = 1 - 0.58 * stall + 0.9 * surge;
    conduit.uniforms.uReveal.value = reveal;
    parts.uniforms.uReveal.value = reveal;
    parts.uniforms.uIntensity.value = (current.mode === "ink" ? 0.95 : 1.1) * (1 + 0.14 * surge);
    hud.uniforms.uReveal.value = reveal;
    hud.uniforms.uIntensity.value = 1 + 0.5 * surge - 0.3 * stall;
    return pressure;
  };
  // The composed pose, written before the first frame: the bench is never seen empty or at 0.
  write(1);
  paddleNow = pickPaddle(clock);
  const resting = write(1);
  for (let b = 0; b < queueNow.length; b += 1) queueNow[b] = clamp01(resting - b);

  return {
    kind: "integration-hub",
    group,
    objects: [group],

    resetCycle() {
      // Never 0: the entry gate snaps to formed on a service page, so an opening would play
      // behind the static art, unseen. The loop starts mid-composition instead.
      clock = BENCH_RUN.composed;
      runIndex = 0;
      flowPhase = (BENCH_RUN.composed * FLOW_RATE) % 2;
      rollRun();
      paddleNow = pickPaddle(clock);
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const step = frame.step;
      const lambdaStep = step > 0 ? step : 1 / 240;

      // The throttle: how fast the pointer sweeps across the bench multiplies the run's clock,
      // capped where the helix caps its own. Stand still and the bench keeps its own pace.
      if (step > 0) {
        const rate = Math.abs(frame.tx - lastTx) / step;
        const target = rate > 1 ? 1 : rate;
        sweep = target > sweep ? target : sweep + (target - sweep) * (1 - Math.exp(-4.5 * step));
      }
      lastTx = frame.tx;
      const dt = step * Math.min(2.6, 1 + 1.8 * sweep);
      clock += dt;
      while (clock >= BENCH_RUN.loop) {
        clock -= BENCH_RUN.loop;
        runIndex += 1;
        rollRun();
      }

      // The light inside the conduit runs at the records' speed — and stalls with them while a
      // write is refused, then rushes back through once it goes.
      const stall = benchStall(clock);
      const surge = benchSurge(clock);
      flowPhase = (flowPhase + dt * FLOW_RATE * (1 - 0.88 * stall + 1.1 * surge)) % 2;

      // The station nearest the pointer comes up, HUD-style; the other four settle back.
      const aim = frame.tx * 1.62;
      let near = 0;
      for (let s = 1; s < BENCH_STATIONS.length; s += 1) {
        if (Math.abs(BENCH_STATIONS[s][0] - aim) < Math.abs(BENCH_STATIONS[near][0] - aim)) near = s;
      }
      for (let s = 0; s < focusNow.length; s += 1) {
        const target = s === near ? 1 : 0;
        const lambda = target > focusNow[s] ? 1 / 0.18 : 1 / 0.28;
        focusNow[s] += (target - focusNow[s]) * (1 - Math.exp(-lambda * lambdaStep));
      }

      const paddleTarget = pickPaddle(clock);
      paddleNow += (paddleTarget - paddleNow) * (1 - Math.exp(-(1 / 0.22) * lambdaStep));

      const pressure = write(frame.reveal);
      for (let b = 0; b < queueNow.length; b += 1) {
        const target = clamp01(pressure - b);
        queueNow[b] += (target - queueNow[b]) * (1 - Math.exp(-6 * lambdaStep));
      }

      parts.uniforms.uTime.value = frame.time;
      hud.uniforms.uTime.value = frame.time;

      // The world already turns the whole group with the pointer (world.ts); the bench leans a
      // little further, because it is the page's hero and not a background.
      pose.rotation.set(BENCH_POSE[0] - frame.ty * 0.05, BENCH_POSE[1] + frame.tx * 0.06, BENCH_POSE[2]);
      pose.position.set(frame.tx * 0.03, -frame.ty * 0.02, 0);
    },

    setLite(lite) {
      railOn = lite ? Math.min(6, railCount) : railCount;
      feedersOn = !lite;
      queueOn = lite ? 2 : queueNow.length;
    },

    setPalette: applyPalette,

    dispose() {
      conduitGeometry.dispose();
      hudGeometry.dispose();
      boxGeometry.dispose();
      conduit.material.dispose();
      parts.material.dispose();
      hud.material.dispose();
      partMesh.dispose();
    },
  };
}
