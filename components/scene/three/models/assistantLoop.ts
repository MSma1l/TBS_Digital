/**
 * "Asistenți IA" — *Bucla cererii*, the request loop.
 *
 * A request enters the port on the left, crosses the layered network as a wave, rises into the
 * rack above the far end where it is structured row by row, waits at the gate while a person
 * presses a key, and leaves as an answer that rides the return loop under the network back into
 * the port it came from. The loop closes: nothing walks off the edge of the drawing, and at any
 * instant something is on its way round. The network is the same graph the static art draws
 * (`buildNeuralGraph`, the same seed), so the crossfade art ↔ canvas lands on one silhouette and
 * the morph swarm still finds the shape.
 *
 * The whole composition is a function of ONE number: `stage`, a reading head that sweeps the
 * piece left to right. Every line carries the stage at which it lights (`aPhase`) and how far
 * along itself that light runs (`aU`), so a single `uProg` drives the rings, the synapses, the
 * port, the context plate, the rack, the gate and the return loop — and the packet chips are
 * placed from the same number, so a comet's head and its tail can never drift apart.
 *
 * Three draws, no sprites, no texture, no entrance: the idle loop is the show and a fresh clock
 * starts inside it (`ASSIST_START`), never at 0.
 *
 *   1. P4 lines — rings, synapses, port, context plate, rack, gate, return loop.
 *   2. P3 instanced boxes — the network's cells, the rack's capsules, the gate's keys, the
 *      outgoing request's chips and the idle traffic. Lite drops the idle traffic.
 *   3. P3 instanced boxes — the answer, red in both themes (the one thing that is not cyan).
 */

import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { damp } from "@/components/three/motion";
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
import { MODEL_POSES, MODEL_SCALES, neuralGraphFor } from "../samples";
import { place, type SceneModel } from "./types";

type P3 = readonly [number, number, number];

const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const k = clamp01((v - a) / (b - a || 1));
  return k * k * (3 - 2 * k);
};
const easeInOut = (k: number) => {
  const x = clamp01(k);
  return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2;
};
const mix3 = (a: P3, b: P3, k: number): P3 => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

/* ---- the cycle ----------------------------------------------------------------------------- */

/** One whole request, in seconds. */
export const ASSIST_CYCLE = 7.2;
/**
 * Where a fresh clock starts. On a service page the entry gate snaps to `formed` on the first
 * frame, so an entrance would play unseen behind the static art: there is none, and the loop
 * instead opens on its richest pose — the request waiting at the gate, the rack filling, the
 * network still glowing in the wave's wake.
 */
export const ASSIST_START = 3.6;

/**
 * The reading head's keyframes: seconds → stage. Monotonic, so it also orders every phase below.
 * The big moment (the rack completing, the gate drawing, the key pressed, the answer launching)
 * sits at 3.5–4.3 s; the answer's flight home fills 4.3–5.6 s and the settle the rest.
 */
const KEY_TIME = [0, 0.15, 0.3, 0.5, 0.7, 1.3, 1.9, 2.5, 3.1, 3.35, 3.55, 3.95, 4.12, 4.3, 5.55, 5.8, ASSIST_CYCLE] as const;
const KEY_STAGE = [-1.35, -0.85, -0.62, -0.12, 0, 1, 2, 3, 4, 4.3, 4.45, 5.3, 5.58, 5.75, 6.5, 6.6, 6.95] as const;

/** Pure. The reading head at `t` seconds into the cycle. */
export function assistStage(t: number): number {
  const x = t <= 0 ? 0 : t >= ASSIST_CYCLE ? ASSIST_CYCLE : t;
  let i = 1;
  while (i < KEY_TIME.length - 1 && KEY_TIME[i] < x) i += 1;
  const span = KEY_TIME[i] - KEY_TIME[i - 1];
  const k = span > 0 ? (x - KEY_TIME[i - 1]) / span : 0;
  return KEY_STAGE[i - 1] + (KEY_STAGE[i] - KEY_STAGE[i - 1]) * k;
}

/**
 * The stage each part lights at. Layers 0…L-1 are the network itself (a synapse out of layer l
 * carries `aPhase = l`, exactly as the plain neural model does), so everything before the network
 * is negative and everything after it is above the last layer.
 */
const PHASE = {
  portOuter: -0.85,
  portInner: -0.62,
  feed: -0.45,
  slab: 0.8,
  tick: 1.24,
  tickStep: 0.07,
  slabFeed: 1.62,
  rackSpine: 4.26,
  row: 4.42,
  rowStep: 0.28,
  gate: 5.55,
  press: 5.66,
  answer: 5.72,
  /** How much stage the answer's flight along the return loop spans. */
  answerSpan: 0.78,
  portEcho: 6.45,
  /** The rack empties from here, row by row, so the next request starts on a clean form. */
  empty: 6.62,
} as const;

/* ---- the composition, in model units (x right, y up, z towards the viewer) ------------------ */

/** Half the network's length along x — `buildNeuralGraph`'s own constant. */
const NET_HALF = 1.7;
const PORT = { x: -2.05, outer: 0.42, inner: 0.26, arm: 0.26 } as const;
const SLAB = { x: -1.02, y: 1.18, z: -0.28, w: 1, h: 0.38, arm: 0.15, ticks: 7 } as const;
const RACK = { x: 1.06, y: 1.44, z: 0.26, w: 0.8, h: 0.14, step: 0.2, rows: 4 } as const;
const GATE = { x: 1.98, half: 0.36, arm: 0.16 } as const;
/** A network cell: a square plaquette on its ring, never a ball. Along x, around the ring, out. */
const CELL = { along: 0.125, around: 0.125, out: 0.05 } as const;
/** A travelling chip: a streak along its direction of travel, never a dot. */
const PACKET = { length: 0.17, side: 0.085 } as const;

/** The return loop: gate → under and in front of the network → port. A plain cubic Bézier. */
const LOOP: readonly P3[] = [
  [GATE.x - 0.05, -0.16, 0.1],
  [1.05, -1.48, 0.72],
  [-1.05, -1.48, 0.72],
  [PORT.x + 0.05, -0.16, 0.1],
];

function loopPoint(u: number, out: Vector3): Vector3 {
  const k = clamp01(u);
  const m = 1 - k;
  const a = m * m * m;
  const b = 3 * m * m * k;
  const c = 3 * m * k * k;
  const d = k * k * k;
  return out.set(
    a * LOOP[0][0] + b * LOOP[1][0] + c * LOOP[2][0] + d * LOOP[3][0],
    a * LOOP[0][1] + b * LOOP[1][1] + c * LOOP[2][1] + d * LOOP[3][1],
    a * LOOP[0][2] + b * LOOP[1][2] + c * LOOP[2][2] + d * LOOP[3][2],
  );
}

/** A layer's ring radius — the network's own formula (widest in the middle). */
const ringRadius = (layer: number, last: number) => 0.55 + 0.45 * Math.sin((Math.PI * layer) / Math.max(1, last));

const UNIT_X = new Vector3(1, 0, 0);

export function createAssistantLoopModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-neural";
  const pose = new Group();
  const [rx, ry, rz] = MODEL_POSES.neural;
  pose.rotation.set(rx, ry, rz);
  pose.scale.setScalar(MODEL_SCALES.neural);
  group.add(pose);

  const graph = neuralGraphFor(config);
  const last = Math.max(1, graph.layers.length - 1);
  const detailed = config.nodeDetail > 0;
  const layerX = (layer: number) => graph.nodes[graph.layerStart[layer]]?.position[0] ?? -NET_HALF;

  /* ---- the path one request takes through the network ---------------------------------- */

  /**
   * The chain the packet rides: the input node facing the viewer, then at every layer the link
   * to the node nearest the front — the rule the static art's `impulse` uses, so the drawing and
   * the model tell the same story.
   */
  const chain: number[] = [];
  {
    let head = -1;
    graph.nodes.forEach((node, i) => {
      if (node.layer !== 0) return;
      if (head < 0 || node.position[2] > graph.nodes[head].position[2]) head = i;
    });
    if (head >= 0) chain.push(head);
    if (chain.length === 0) chain.push(0);
    for (let layer = 0; layer < last && chain.length > 0; layer += 1) {
      const from = chain[chain.length - 1];
      let best = -1;
      for (const [a, b] of graph.edges) {
        if (a !== from) continue;
        if (best < 0 || graph.nodes[b].position[2] > graph.nodes[best].position[2]) best = b;
      }
      if (best < 0) break;
      chain.push(best);
    }
  }
  // A graph too small to walk (never at either tier) still has two ends to travel between.
  while (chain.length < 2) chain.push(chain[chain.length - 1]);
  const chainSpan = chain.length - 1;
  const nodeAt = (index: number): P3 => graph.nodes[chain[index]].position as P3;
  const GATE_POINT: P3 = [GATE.x - 0.14, 0, 0.02];
  /** Port → the first input node, through the feed's mouth. */
  const ENTRY: readonly P3[] = [[PORT.x, 0, 0], [PORT.x + 0.26, 0.1, 0.05], nodeAt(0)];

  /** Where the request is at `stage`, and how solid it is there (0 hides the chip). */
  function requestAt(stage: number, out: Vector3): number {
    if (stage <= PHASE.portOuter) return 0;
    if (stage < 0) {
      const k = easeInOut((stage - PHASE.portOuter) / -PHASE.portOuter) * (ENTRY.length - 1);
      const i = Math.min(ENTRY.length - 2, Math.floor(k));
      const [ax, ay, az] = ENTRY[i];
      const [bx, by, bz] = ENTRY[i + 1];
      const f = k - i;
      out.set(ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f);
      return smoothstep(PHASE.portOuter, PHASE.portOuter + 0.14, stage);
    }
    if (stage <= last) {
      const k = (stage / last) * chainSpan;
      const i = Math.min(chainSpan - 1, Math.floor(k));
      const [ax, ay, az] = nodeAt(i);
      const [bx, by, bz] = nodeAt(i + 1);
      // Eased inside every hop: the request dwells on a node, then leaps to the next one.
      const f = easeInOut(k - i);
      out.set(ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f);
      return 1;
    }
    const f = easeInOut((stage - last) / 0.3);
    const [ax, ay, az] = nodeAt(chainSpan);
    out.set(
      ax + (GATE_POINT[0] - ax) * f,
      ay + (GATE_POINT[1] - ay) * f,
      az + (GATE_POINT[2] - az) * f,
    );
    // It waits at the gate, and goes out as the key is pressed: what leaves is the answer.
    return 1 - smoothstep(PHASE.gate, PHASE.answer - 0.02, stage);
  }

  /* ---- draw 1: every line in the piece, on one sweeping reading head -------------------- */

  const linePosition: number[] = [];
  const lineU: number[] = [];
  const linePhase: number[] = [];
  const segment = (a: P3, b: P3, phase: number, ua: number, ub: number) => {
    linePosition.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    lineU.push(ua, ub);
    linePhase.push(phase, phase);
  };
  const polyline = (points: readonly P3[], phase: number, u0: number, u1: number, closed = false) => {
    const steps = closed ? points.length : points.length - 1;
    for (let i = 0; i < steps; i += 1) {
      segment(
        points[i],
        points[(i + 1) % points.length],
        phase,
        u0 + ((u1 - u0) * i) / steps,
        u0 + ((u1 - u0) * (i + 1)) / steps,
      );
    }
  };

  /* the network: one ring per layer (a wipe runs round it), and the synapses between them */
  const ringSegments = detailed ? 28 : 18;
  for (let layer = 0; layer <= last; layer += 1) {
    const x = layerX(layer);
    const r = ringRadius(layer, last);
    const ring: P3[] = [];
    for (let i = 0; i < ringSegments; i += 1) {
      const a = (TAU * i) / ringSegments;
      ring.push([x, r * Math.cos(a), r * Math.sin(a)]);
    }
    polyline(ring, layer, 0, 0.2, true);
  }
  for (const [a, b] of graph.edges) {
    segment(graph.nodes[a].position as P3, graph.nodes[b].position as P3, graph.nodes[a].layer, 0, 1);
  }

  /* the port: a square ring broken at its corners, an inner ring, and the ripple of an arrival */
  const portSquare = (half: number, phase: number, split: boolean) => {
    const corners: P3[] = [
      [PORT.x, half, half],
      [PORT.x, half, -half],
      [PORT.x, -half, -half],
      [PORT.x, -half, half],
    ];
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      if (!split) {
        segment(a, b, phase, 0, 0.09);
        continue;
      }
      const arm = Math.min(0.45, PORT.arm / (half * 2));
      segment(a, mix3(a, b, arm), phase, 0, 0.05);
      segment(mix3(b, a, arm), b, phase, 0.05, 0.1);
    }
  };
  portSquare(PORT.outer, PHASE.portOuter, true);
  portSquare(PORT.inner, PHASE.portInner, false);
  // The same ring one size out, lit much later: the answer landing back where it started.
  portSquare(PORT.inner * 1.22, PHASE.portEcho, false);

  /* the feed: three rails from the port's mouth into the input layer */
  const inputs = graph.nodes.flatMap((node, i) => (node.layer === 0 ? [i] : []));
  for (const i of inputs.slice(0, 3)) {
    const p = graph.nodes[i].position as P3;
    polyline(
      [
        [PORT.x + 0.03, p[1] * 0.22, p[2] * 0.22],
        [PORT.x + 0.3, p[1] * 0.6, p[2] * 0.6],
        [p[0] - 0.12, p[1] * 0.92, p[2] * 0.92],
        p,
      ],
      PHASE.feed,
      0,
      0.42,
    );
  }

  /* the context plate: four corner brackets over a stack of ticks, read on the way across */
  const sx0 = SLAB.x - SLAB.w / 2;
  const sx1 = SLAB.x + SLAB.w / 2;
  const sy0 = SLAB.y - SLAB.h / 2;
  const sy1 = SLAB.y + SLAB.h / 2;
  for (const [cx, cy, dx, dy] of [
    [sx0, sy0, SLAB.arm, 0.11],
    [sx1, sy0, -SLAB.arm, 0.11],
    [sx1, sy1, -SLAB.arm, -0.11],
    [sx0, sy1, SLAB.arm, -0.11],
  ] as const) {
    segment([cx, cy, SLAB.z], [cx + dx, cy, SLAB.z], PHASE.slab, 0, 0.06);
    segment([cx, cy, SLAB.z], [cx, cy + dy, SLAB.z], PHASE.slab, 0, 0.06);
  }
  for (let i = 0; i < SLAB.ticks; i += 1) {
    const y = sy1 - 0.055 - (i * (SLAB.h - 0.11)) / (SLAB.ticks - 1);
    const len = 0.26 + 0.44 * ((i % 3) / 2) + 0.08 * (i % 2);
    segment([sx0 + 0.08, y, SLAB.z], [sx0 + 0.08 + len, y, SLAB.z], PHASE.tick + i * PHASE.tickStep, 0, 0.05);
  }
  polyline(
    [
      [sx1 - 0.18, sy0, SLAB.z],
      [sx1 - 0.18, sy0 - 0.12, SLAB.z * 0.6],
      [sx1 - 0.3, sy0 - 0.2, -0.05],
      [layerX(1), ringRadius(1, last) * 0.99, 0],
    ],
    PHASE.slabFeed,
    0,
    0.36,
  );

  /* the rack: four rows that fill one after another, and the spine that feeds them */
  const rowY = (i: number) => RACK.y - i * RACK.step;
  for (let i = 0; i < RACK.rows; i += 1) {
    const x0 = RACK.x - RACK.w / 2;
    const x1 = RACK.x + RACK.w / 2;
    const y0 = rowY(i) - RACK.h / 2;
    const y1 = rowY(i) + RACK.h / 2;
    polyline(
      [
        [x0, y0, RACK.z],
        [x1, y0, RACK.z],
        [x1, y1, RACK.z],
        [x0, y1, RACK.z],
      ],
      PHASE.row + i * PHASE.rowStep,
      0,
      0.14,
      true,
    );
  }
  polyline(
    [
      [layerX(last), ringRadius(last, last) * 0.95, 0.05],
      [1.62, 0.66, 0.16],
      [RACK.x + RACK.w / 2, rowY(RACK.rows - 1) - RACK.h / 2, RACK.z],
    ],
    PHASE.rackSpine,
    0,
    0.3,
  );

  /* the gate: four corner brackets that draw themselves in when the request is ready, around the
     opening the answer leaves by */
  for (const [gy, gz] of [
    [GATE.half, GATE.half],
    [GATE.half, -GATE.half],
    [-GATE.half, -GATE.half],
    [-GATE.half, GATE.half],
  ] as const) {
    segment([GATE.x, gy, gz], [GATE.x, gy - Math.sign(gy) * GATE.arm, gz], PHASE.gate, 0, 0.05);
    segment([GATE.x, gy, gz], [GATE.x, gy, gz - Math.sign(gz) * GATE.arm], PHASE.gate, 0, 0.05);
  }
  const inner = GATE.half * 0.62;
  polyline(
    [
      [GATE.x, inner, inner],
      [GATE.x, inner, -inner],
      [GATE.x, -inner, -inner],
      [GATE.x, -inner, inner],
    ],
    PHASE.gate + 0.05,
    0,
    0.08,
    true,
  );

  /* the return loop: a two-rail channel with ties, faint at rest, and the answer's comet tail
     when the head runs along it */
  const loopSegments = detailed ? 64 : 40;
  const scratch = new Vector3();
  const loopLeft: P3[] = [];
  const loopRight: P3[] = [];
  for (let i = 0; i <= loopSegments; i += 1) {
    const u = i / loopSegments;
    loopPoint(u, scratch);
    const cx = scratch.x;
    const cy = scratch.y;
    const cz = scratch.z;
    loopPoint(Math.min(1, u + 0.01), scratch);
    // A normal in the xy plane: the loop's tangent never runs along z, so this never collapses.
    const tx = scratch.x - cx;
    const ty = scratch.y - cy;
    const len = Math.hypot(tx, ty) || 1;
    const nx = (ty / len) * 0.04;
    const ny = (-tx / len) * 0.04;
    loopLeft.push([cx + nx, cy + ny, cz]);
    loopRight.push([cx - nx, cy - ny, cz]);
  }
  polyline(loopLeft, PHASE.answer, 0, PHASE.answerSpan);
  polyline(loopRight, PHASE.answer, 0, PHASE.answerSpan);
  for (let i = 2; i < loopSegments; i += 6) {
    segment(loopLeft[i], loopRight[i], PHASE.answer + (PHASE.answerSpan * i) / loopSegments, 0, 0.02);
  }

  const lineGeometry = new BufferGeometry();
  lineGeometry.setAttribute("position", new Float32BufferAttribute(linePosition, 3));
  lineGeometry.setAttribute("aU", new Float32BufferAttribute(lineU, 1));
  lineGeometry.setAttribute("aPhase", new Float32BufferAttribute(linePhase, 1));
  const lines = createLineMaterial({
    mode: LINE_MODE.synapse,
    roles: { a: "blue", b: "cyan", hot: "red" },
    alpha: 0.45,
  });
  const lineMesh = place(new LineSegments(lineGeometry, lines.material), 5);
  pose.add(lineMesh);

  /* ---- draw 2: cells, capsules, keys, the request and the idle traffic ------------------ */

  const cellCount = graph.nodes.length;
  const REQUEST_CHIPS = 3;
  const thoughtCount = detailed ? 3 : 2;
  const CAPSULES = RACK.rows;
  const KEYS = 2;
  const firstCapsule = cellCount;
  const firstKey = firstCapsule + CAPSULES;
  const firstRequest = firstKey + KEYS;
  const firstThought = firstRequest + REQUEST_CHIPS;
  const fittingCount = firstThought + thoughtCount;

  const boxGeometry = new BoxGeometry(1, 1, 1);
  const fittings = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
  });
  const fittingMesh = place(new InstancedMesh(boxGeometry, fittings.material, fittingCount), 6);
  pose.add(fittingMesh);

  const answerChips = detailed ? 5 : 4;
  const answers = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "red", b: "hot", hot: "hot" },
    instanced: true,
  });
  const answerMesh = place(new InstancedMesh(boxGeometry, answers.material, answerChips), 7);
  pose.add(answerMesh);

  const matrix = new Matrix4();
  const tint = new Color(1, 1, 1);
  const position = new Vector3();
  const previous = new Vector3();
  const direction = new Vector3();
  const turn = new Quaternion();
  const scale = new Vector3();

  /** A plaquette lying on its ring: along the network, around the ring, out of it. */
  const writeCell = (index: number, size: number, glow: number) => {
    const node = graph.nodes[index];
    const [x, y, z] = node.position;
    const ca = Math.cos(node.angle);
    const sa = Math.sin(node.angle);
    const l = CELL.along * size;
    const w = CELL.around * size;
    const t = CELL.out * size;
    matrix.set(
      l, 0, 0, x,
      0, -sa * w, ca * t, y,
      0, ca * w, sa * t, z,
      0, 0, 0, 1,
    );
    fittingMesh.setMatrixAt(index, matrix);
    fittingMesh.setColorAt(index, tint.setScalar(glow));
  };

  /** An axis-aligned fitting (a rack capsule, a gate key). */
  const writeBox = (index: number, px: number, py: number, pz: number, sx: number, sy: number, sz: number, glow: number) => {
    matrix.makeScale(sx, sy, sz);
    matrix.setPosition(px, py, pz);
    fittingMesh.setMatrixAt(index, matrix);
    fittingMesh.setColorAt(index, tint.setScalar(glow));
  };

  /** A chip stretched along its own direction of travel: a comet head, never a dot. */
  const writeChip = (
    mesh: InstancedMesh,
    index: number,
    length: number,
    side: number,
    glow: number,
  ) => {
    direction.subVectors(position, previous);
    if (direction.lengthSq() < 1e-8) direction.copy(UNIT_X);
    turn.setFromUnitVectors(UNIT_X, direction.normalize());
    scale.set(length, side, side);
    matrix.compose(position, turn, scale);
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, tint.setScalar(glow));
  };

  /* Idle traffic: a few chips that keep crossing the network whatever the request is doing, so
     the settle is never a dead frame. Seeded — the same edges every visit. */
  const traffic = (() => {
    const random = mulberry32(0xa551);
    const picked: Array<{ a: P3; b: P3; rate: number; phase: number }> = [];
    for (let i = 0; i < thoughtCount && graph.edges.length > 0; i += 1) {
      const [a, b] = graph.edges[Math.floor(random() * graph.edges.length) % graph.edges.length];
      picked.push({
        a: graph.nodes[a].position as P3,
        b: graph.nodes[b].position as P3,
        rate: 0.34 + 0.12 * random(),
        phase: random(),
      });
    }
    return picked;
  })();

  /* Seed every instance once, so nothing is ever drawn from an uninitialised matrix. */
  for (let i = 0; i < cellCount; i += 1) writeCell(i, 1, 0.8);
  for (let i = 0; i < CAPSULES; i += 1) {
    writeBox(firstCapsule + i, RACK.x - RACK.w / 2 + 0.07, rowY(i), RACK.z, 0.11, 0.11, 0.04, 0.45);
  }
  for (let i = 0; i < KEYS; i += 1) {
    writeBox(firstKey + i, GATE.x, i === 0 ? 0.17 : -0.17, 0.04, 0.05, 0.1, 0.2, 0.6);
  }
  position.set(PORT.x, 0, 0);
  previous.set(PORT.x - 0.1, 0, 0);
  for (let i = 0; i < REQUEST_CHIPS; i += 1) writeChip(fittingMesh, firstRequest + i, 0, 0, 0);
  for (let i = 0; i < thoughtCount; i += 1) writeChip(fittingMesh, firstThought + i, 0, 0, 0);
  for (let i = 0; i < answerChips; i += 1) writeChip(answerMesh, i, 0, 0, 0);

  /* ---- state ---------------------------------------------------------------------------- */

  let clock = ASSIST_START;
  let cycle = 0;
  let drive = 0;
  let lastTx = 0;
  let lastTy = 0;
  const attention = new Vector3(0, 0, 0.5);
  const poseInverse = new Quaternion().setFromEuler(pose.rotation).invert();

  const applyPalette = (next: ScenePalette) => {
    paint(lines, next);
    paint(fittings, next);
    paint(answers, next);
    lines.uniforms.uAlpha.value = next.mode === "ink" ? 0.55 : 0.45;
  };
  applyPalette(palette);

  return {
    kind: "neural",
    group,
    objects: [group],

    resetCycle() {
      clock = ASSIST_START;
      cycle = 0;
      drive = 0;
      attention.set(0, 0, 0.5);
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const dt = frame.step;
      clock += dt;
      while (clock >= ASSIST_CYCLE) {
        clock -= ASSIST_CYCLE;
        cycle += 1;
      }
      const stage = assistStage(clock);

      /* The pointer, twice over — both from the tilt the world already hands every model. The
         attention point brightens the cells it drifts near; the pointer's speed drives the idle
         traffic and lifts everything a little. No listener, no DOM, no raycast. */
      if (dt > 0) {
        const speed = Math.hypot(frame.tx - lastTx, frame.ty - lastTy) / dt;
        drive = damp(drive, Math.min(1, speed * 0.55), 3.5, dt);
      }
      lastTx = frame.tx;
      lastTy = frame.ty;
      scratch.set(frame.tx * 2.1, frame.ty * 1.15, 0.55).applyQuaternion(poseInverse);
      if (dt > 0) {
        attention.set(
          damp(attention.x, scratch.x, 6.5, dt),
          damp(attention.y, scratch.y, 6.5, dt),
          damp(attention.z, scratch.z, 6.5, dt),
        );
      } else {
        attention.copy(scratch);
      }

      lines.uniforms.uProg.value = stage;
      lines.uniforms.uDir.value = 1;
      lines.uniforms.uReveal.value = frame.reveal;
      lines.uniforms.uTime.value = frame.time;
      lines.uniforms.uIntensity.value = 1 + 0.06 * Math.sin(frame.time * 0.9) + 0.22 * drive;
      fittings.uniforms.uReveal.value = frame.reveal;
      fittings.uniforms.uTime.value = frame.time;
      fittings.uniforms.uIntensity.value = 1 + 0.18 * drive;
      answers.uniforms.uReveal.value = frame.reveal;
      answers.uniforms.uTime.value = frame.time;

      /* the network's cells: a flare as the wave arrives, a warm tail behind it, a slow wash so
         nothing is ever flat, and a brightening around the attention point */
      for (let i = 0; i < cellCount; i += 1) {
        const node = graph.nodes[i];
        const d = stage - node.layer;
        const flare = Math.exp(-((d * 2.3) ** 2));
        const warm = d > 0 ? 0.42 * Math.exp(-d * 0.55) : 0;
        const wash = 0.12 * Math.sin(frame.time * 0.9 - node.layer * 0.8 + i * 0.4);
        const dx = attention.x - node.position[0];
        const dy = attention.y - node.position[1];
        const dz = attention.z - node.position[2];
        const near = 1.05 * Math.exp(-(dx * dx + dy * dy + dz * dz) / 0.3);
        writeCell(i, 1 + 0.3 * flare + 0.22 * near, 0.72 + 1.5 * flare + warm + wash + near + 0.2 * drive);
      }

      /* the rack: a row's capsule lights as the row fills, and lets go on the way out */
      for (let i = 0; i < CAPSULES; i += 1) {
        const at = PHASE.row + i * PHASE.rowStep;
        const fill =
          smoothstep(at - 0.02, at + 0.12, stage) * (1 - smoothstep(PHASE.empty + i * 0.07, PHASE.empty + 0.1 + i * 0.07, stage));
        writeBox(
          firstCapsule + i,
          RACK.x - RACK.w / 2 + 0.07,
          rowY(i),
          RACK.z,
          0.11 * (0.9 + 0.22 * fill),
          0.11 * (0.9 + 0.22 * fill),
          0.04,
          0.45 + 1.9 * fill,
        );
      }

      /* the gate: a person presses one of the two keys, alternating from request to request */
      const press = Math.exp(-(((stage - PHASE.press) * 22) ** 2));
      const armed = smoothstep(PHASE.gate - 0.1, PHASE.gate + 0.2, stage) * (1 - smoothstep(PHASE.answer + 0.4, PHASE.portEcho, stage));
      for (let i = 0; i < KEYS; i += 1) {
        const mine = i === cycle % 2 ? press : 0;
        writeBox(
          firstKey + i,
          GATE.x - 0.035 * mine,
          i === 0 ? 0.17 : -0.17,
          0.04,
          0.05,
          0.1 * (1 - 0.12 * mine),
          0.2 * (1 - 0.12 * mine),
          0.6 + 0.4 * armed + 2 * mine,
        );
      }

      /* the request: a head and two chips trailing it, stretched by its own speed */
      for (let i = 0; i < REQUEST_CHIPS; i += 1) {
        const at = stage - i * 0.075;
        const alive = requestAt(at, position);
        requestAt(at - 0.02, previous);
        writeChip(
          fittingMesh,
          firstRequest + i,
          alive > 0 ? PACKET.length * (1 - 0.22 * i) : 0,
          alive > 0 ? PACKET.side * (1 - 0.18 * i) : 0,
          alive * (2.2 - 0.5 * i),
        );
      }

      /* idle traffic: chips crossing single synapses, faster while the pointer is busy */
      for (let i = 0; i < traffic.length; i += 1) {
        const lane = traffic[i];
        lane.phase = (lane.phase + dt * lane.rate * (1 + 1.1 * drive)) % 1;
        const u = lane.phase;
        const [ax, ay, az] = lane.a;
        const [bx, by, bz] = lane.b;
        position.set(ax + (bx - ax) * u, ay + (by - ay) * u, az + (bz - az) * u);
        previous.set(ax, ay, az);
        writeChip(fittingMesh, firstThought + i, 0.1, 0.05, 0.75 + 0.85 * Math.sin(u * Math.PI));
      }
      fittingMesh.instanceMatrix.needsUpdate = true;
      if (fittingMesh.instanceColor) fittingMesh.instanceColor.needsUpdate = true;

      /* the answer: a red comet round the return loop, home to the port it came from */
      const head = (stage - PHASE.answer) / PHASE.answerSpan;
      const launched = smoothstep(PHASE.answer - 0.06, PHASE.answer + 0.04, stage);
      for (let i = 0; i < answerChips; i += 1) {
        const u = head - i * 0.055;
        const alive = launched * (1 - smoothstep(0.94, 1.02, u)) * smoothstep(-0.04, 0.02, u);
        loopPoint(u, position);
        loopPoint(u - 0.02, previous);
        writeChip(
          answerMesh,
          i,
          alive > 0 ? (0.2 - i * 0.03) : 0,
          alive > 0 ? (0.095 - i * 0.012) : 0,
          alive * (2.6 - i * 0.35),
        );
      }
      answerMesh.instanceMatrix.needsUpdate = true;
      if (answerMesh.instanceColor) answerMesh.instanceColor.needsUpdate = true;
    },

    setLite(lite) {
      // The idle traffic is the only thing whose absence costs the story nothing.
      fittingMesh.count = lite ? firstThought : fittingCount;
    },

    setPalette: applyPalette,

    dispose() {
      lineGeometry.dispose();
      boxGeometry.dispose();
      lines.material.dispose();
      fittings.material.dispose();
      answers.material.dispose();
      fittingMesh.dispose();
      answerMesh.dispose();
    },
  };
}
