/**
 * "Tejgheaua" — the shop floor: a shop read as one working machine, seen from above.
 *
 * A bench carries five nameable stations left to right — the rack (offer), the basket, the
 * payment terminal, the vault of lockers (access) and the orders board (reporting) — joined by
 * a belt the goods actually ride. A tile leaves a shelf, fills the basket, is packed into a
 * parcel, pays at the terminal, becomes a key, is locked into the vault, and the finished order
 * raises a column on the board. The last leg of the belt runs back along the rear of the bench
 * and restocks the shelf, so the machine closes.
 *
 * Two order lanes run half a loop apart, so something is always mid-move. There is no entrance:
 * the clock starts mid-composition (`START_AT`) and the idle loop is the whole show.
 *
 * Draws (4): the belt (P5 `track`), the chassis (P4 `synapse`), the goods and the board's
 * columns (P3 `edges`, instanced), the sales digits (P4 `bits`). Lite drops the digits.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Curve,
  Group,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  TubeGeometry,
  Vector3,
} from "three";
import { mulberry32 } from "@/components/three/random";
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
import { MODEL_POSES, MODEL_SCALES } from "../samples";
import { mergeTagged, place, type SceneModel } from "./types";

type V3 = readonly [number, number, number];

/* ---- the clock ----------------------------------------------------------------------------- */

/** One order, seconds. The busiest beat — the tick and the terminal flash — is at 3.30–3.55 s. */
const LOOP = 6.8;
/** The second lane runs exactly half a loop behind, so the longest gap between events is ~0.5 s. */
const LANE_OFFSET = LOOP / 2;
/** Where `resetCycle` parks the clock: a composed pose, never an empty machine still loading. */
const START_AT = 2.35;
/** Orders the shop is assumed to have already run at reset. Whole loops, so lane phases hold. */
const HISTORY = 4 * LANE_OFFSET;
/** How far the chassis light pulse travels in one loop (phase units; see `WAVE`). */
const WAVE_SPAN = 6.6;

/** Beats of one order, in seconds of its lane's phase. */
const BEAT = {
  pick: [0.0, 0.6],
  ride1: [0.6, 1.4],
  pack: [1.4, 1.75],
  tape: [1.75, 1.95],
  ride2: [1.95, 2.4],
  card: [2.4, 2.65],
  auth: [2.65, 3.3],
  tick: [3.3, 3.55],
  receipt: [3.55, 3.95],
  key: [3.95, 4.3],
  ride3: [4.3, 4.9],
  open: [4.9, 5.15],
  shut: [5.15, 5.35],
  ride4: [5.35, 5.7],
  column: [5.7, 6.0],
  restock: [6.0, 6.6],
} as const satisfies Record<string, readonly [number, number]>;

/** The order is banked — locker lit, column due — at this phase. The fill clock's zero. */
const FILL_AT = BEAT.ride4[0];
/** The column grows this long after its order was banked. */
const COLUMN_AFTER = [BEAT.column[0] - FILL_AT, BEAT.column[1] - FILL_AT] as const;

/* ---- the bench ----------------------------------------------------------------------------- */

/**
 * Model units before `FIT`: x right, y up, z towards the viewer. The whole machine spans
 * x −1.83…1.82, y −0.72…0.70, z −0.51…0.50 — a half-diagonal of 2.02 about its centre.
 */
const SHOP = {
  bench: { hx: 1.68, hz: 0.46, y: -0.72, ribs: [-0.9, -0.05, 0.82] },
  rack: { x: -1.35, z: -0.18, w: 0.95, h: 1.3, d: 0.22, pitch: [0.3, 0.3] },
  cart: { x: -0.55, z: 0.1, rim: [0.42, 0.3], top: -0.42, floor: -0.68, stack: 0.07 },
  pack: { x: -0.2, z: 0.02 },
  term: { x: 0.15, z: -0.05, w: 0.5, h: 0.34, d: 0.32, screen: [0.4, 0.24], tilt: 0.42 },
  vault: { x: 1.1, y: -0.33, z: 0.08, w: 0.62, h: 0.74, d: 0.16, door: [0.26, 0.2] },
  board: { x: 1.46, y: 0.45, z: -0.34, w: 0.78, h: 0.5, yaw: -0.42 },
  rail: { radius: 0.026, y: -0.655, lift: 0.045, dashSpan: 2 },
} as const;

/**
 * Model scale inside the rig, so the machine's half-diagonal lands just inside `MODEL_RADIUS`
 * once `MODEL_SCALES["commerce-loop"]` (1.1, owned by samples.ts) is applied: 2.02 × 0.885 × 1.1.
 */
const FIT = 0.885;
/** The machine's centre of mass sits a little below the origin; the rig lifts it back. */
const RIG_LIFT = 0.01;
/** A standing yaw, so the world's sway never shows the bench dead-on flat. */
const RIG_YAW = -0.2;
/** Extra lean the pointer adds on top of the world's own ±0.2 / ±0.13 rad (world.ts). */
const LEAN = { yaw: 0.07, pitch: 0.05 } as const;
/** The digits float in front of the board and lead its yaw, so the back plane has depth. */
const DIGIT_PARALLAX = 0.09;

/**
 * When each station takes the chassis light pulse, in the sweep's phase units (0…`WAVE_SPAN`
 * over one loop). Each is its own beat's second, mapped through the loop.
 */
const phaseAt = (seconds: number) => (seconds / LOOP) * WAVE_SPAN;
const WAVE = {
  rack: phaseAt(0.05),
  cart: phaseAt(1.4),
  pack: phaseAt(1.6),
  term: phaseAt(3.3),
  vault: phaseAt(4.95),
  board: phaseAt(5.7),
} as const;

/** The bench plate's own sweep tracks the goods' x-travel: x −1.35 at 0.6 s → x 1.05 at 4.9 s. */
function benchPhase(x: number): number {
  return phaseAt(((x + 1.38) / 2.48) * 4.3 + 0.6);
}

/* ---- small pure maths ------------------------------------------------------------------------ */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const easeOutCubic = (v: number) => 1 - (1 - clamp01(v)) ** 3;
/** Progress through a beat: 0 before it, 1 after it. */
const span = (t: number, beat: readonly [number, number]) => clamp01((t - beat[0]) / (beat[1] - beat[0]));
/** Frame-rate independent approach. */
const damp = (a: number, b: number, lambda: number, dt: number) => b + (a - b) * Math.exp(-lambda * dt);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Positive modulo, for order counters that run backwards into the shop's past. */
const wrap = (n: number, m: number) => ((n % m) + m) % m;
/** A stable 0..1 from an integer, so every past and future order has the same size. */
function hash01(n: number): number {
  let x = Math.imul(n | 0, 0x9e3779b1) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

/* ---- layout tables (pure) --------------------------------------------------------------------- */

/** Shelf slot centres, column-major (`col * rows + row`), row 0 at the bottom. */
function rackSlots(cols: number, rows: number): V3[] {
  const out: V3[] = [];
  const zFront = SHOP.rack.z + SHOP.rack.d / 2 - 0.03;
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      out.push([
        SHOP.rack.x + (c - (cols - 1) / 2) * SHOP.rack.pitch[0],
        SHOP.bench.y + 0.22 + r * SHOP.rack.pitch[1],
        zFront,
      ]);
    }
  }
  return out;
}

type Locker = { centre: V3; hinge: V3 };

/** Locker doors, two columns; the hinge is the door's left edge. */
function lockerCells(count: number): Locker[] {
  const cols = 2;
  const rows = Math.max(1, Math.ceil(count / cols));
  const [dw, dh] = SHOP.vault.door;
  const face = SHOP.vault.z + SHOP.vault.d / 2;
  const out: Locker[] = [];
  for (let i = 0; i < count; i += 1) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = SHOP.vault.x + (c - (cols - 1) / 2) * (dw + 0.04);
    const y = SHOP.vault.y + (r - (rows - 1) / 2) * (dh + 0.04);
    out.push({ centre: [x, y, face], hinge: [x - dw / 2, y, face] });
  }
  return out;
}

/** The board's plane: its in-plane axes and its normal, turned towards the viewer. */
const BOARD_U: V3 = [Math.cos(SHOP.board.yaw), 0, -Math.sin(SHOP.board.yaw)];
const BOARD_N: V3 = [-BOARD_U[2], 0, BOARD_U[0]];

/** A point of the board's plane: `(u, v)` from its centre, `out` along its normal. */
function boardPoint(u: number, v: number, out: number): V3 {
  return [
    SHOP.board.x + BOARD_U[0] * u + BOARD_N[0] * out,
    SHOP.board.y + v,
    SHOP.board.z + BOARD_U[2] * u + BOARD_N[2] * out,
  ];
}

/** The terminal's screen: its tilted plane, the axes the tick is drawn on, and its centre. */
const TERM_TOP = SHOP.bench.y + SHOP.term.h;
const SCREEN_V: V3 = [0, Math.cos(SHOP.term.tilt), Math.sin(SHOP.term.tilt)];
const SCREEN_N: V3 = [0, -SCREEN_V[2], SCREEN_V[1]];
const SCREEN_C: V3 = [
  SHOP.term.x,
  TERM_TOP + SCREEN_V[1] * (SHOP.term.screen[1] / 2),
  SHOP.term.z + SCREEN_V[2] * (SHOP.term.screen[1] / 2),
];

function screenPoint(u: number, v: number, out: number): V3 {
  return [
    SCREEN_C[0] + u,
    SCREEN_C[1] + SCREEN_V[1] * v + SCREEN_N[1] * out,
    SCREEN_C[2] + SCREEN_V[2] * v + SCREEN_N[2] * out,
  ];
}

/* ---- the belt ---------------------------------------------------------------------------------- */

const RAIL_Y = SHOP.rail.y;

/**
 * Five legs of polyline, every run on an axis or at 45° (the house idiom from `chipTraces`):
 * rack → basket, basket → packer → terminal, terminal → vault, vault → board, and the restock
 * line back along the rear of the bench into the rack.
 */
const RAIL_LEGS: ReadonlyArray<ReadonlyArray<V3>> = [
  [
    [-1.35, RAIL_Y, -0.06],
    [-0.9, RAIL_Y, -0.06],
    [-0.74, RAIL_Y, 0.1],
    [-0.55, RAIL_Y, 0.1],
  ],
  [
    [-0.55, RAIL_Y, 0.1],
    [-0.36, RAIL_Y, 0.1],
    [-0.28, RAIL_Y, 0.02],
    [-0.2, RAIL_Y, 0.02],
    [-0.02, RAIL_Y, 0.02],
    [0.05, RAIL_Y, -0.05],
    [0.15, RAIL_Y, -0.05],
  ],
  [
    [0.15, RAIL_Y, -0.05],
    [0.7, RAIL_Y, -0.05],
    [0.82, RAIL_Y, 0.08],
    [1.1, RAIL_Y, 0.08],
  ],
  [
    [1.1, RAIL_Y, 0.08],
    [1.45, RAIL_Y, 0.08],
    [1.62, RAIL_Y, -0.09],
    [1.78, RAIL_Y, -0.25],
    [1.8, -0.36, -0.21],
    [1.8, 0.2, -0.18],
  ],
  [
    [1.12, 0.2, -0.5],
    [1.12, -0.52, -0.48],
    [0.98, -0.66, -0.46],
    [-1.24, -0.66, -0.46],
    [-1.38, -0.52, -0.44],
    [-1.38, 0.02, -0.44],
    [-1.38, 0.16, -0.3],
  ],
];

/** Corner cutting, twice: the runs stay straight, the joints round just enough to carry a tube. */
function chaikin(points: ReadonlyArray<V3>, passes: number): V3[] {
  let current: V3[] = points.map((p) => [p[0], p[1], p[2]]);
  for (let pass = 0; pass < passes; pass += 1) {
    const next: V3[] = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      next.push([a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25, a[2] + (b[2] - a[2]) * 0.25]);
      next.push([a[0] + (b[0] - a[0]) * 0.75, a[1] + (b[1] - a[1]) * 0.75, a[2] + (b[2] - a[2]) * 0.75]);
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

type Leg = { points: V3[]; cumulative: number[]; length: number };

const LEGS: Leg[] = RAIL_LEGS.map((raw) => {
  const points = chaikin(raw, 2);
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    cumulative.push(total);
  }
  return { points, cumulative, length: total };
});

/** A point of leg `leg` at arc-length fraction `s`. */
function railPoint(leg: number, s: number, target: Vector3): Vector3 {
  const path = LEGS[leg];
  const want = clamp01(s) * path.length;
  let i = 1;
  while (i < path.cumulative.length - 1 && path.cumulative[i] < want) i += 1;
  const a = path.points[i - 1];
  const b = path.points[i];
  const from = path.cumulative[i - 1];
  const step = path.cumulative[i] - from || 1;
  const t = (want - from) / step;
  return target.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

class LegCurve extends Curve<Vector3> {
  private readonly leg: number;

  // @types/three declares Curve's constructor protected; subclasses re-expose it.
  constructor(leg: number) {
    super();
    this.leg = leg;
  }

  override getPoint(t: number, target: Vector3 = new Vector3()): Vector3 {
    return railPoint(this.leg, t, target);
  }
}

/* ---- the chassis: one LineSegments --------------------------------------------------------------- */

/**
 * Every vertex carries the phase at which the light pulse reaches it, in `aPhase`; `aU` is 0
 * throughout, so the P4 `synapse` branch reduces to `exp(-(uProg - aPhase) * 9)` — a pulse that
 * lights a part the moment its beat arrives and trails off over ~0.37 s.
 */
type Sink = { pos: number[]; phase: number[] };

function seg(sink: Sink, a: V3, b: V3, phase: number): void {
  sink.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  sink.phase.push(phase, phase);
}

/** A rectangle from a centre and two in-plane half-axes. */
function rect(sink: Sink, c: V3, u: V3, v: V3, phase: number): void {
  const p = (su: number, sv: number): V3 => [
    c[0] + u[0] * su + v[0] * sv,
    c[1] + u[1] * su + v[1] * sv,
    c[2] + u[2] * su + v[2] * sv,
  ];
  const a = p(-1, -1);
  const b = p(1, -1);
  const d = p(1, 1);
  const e = p(-1, 1);
  seg(sink, a, b, phase);
  seg(sink, b, d, phase);
  seg(sink, d, e, phase);
  seg(sink, e, a, phase);
}

/** An axis-aligned box's twelve edges. */
function boxWire(sink: Sink, c: V3, h: V3, phase: number): void {
  const p = (sx: number, sy: number, sz: number): V3 => [c[0] + h[0] * sx, c[1] + h[1] * sy, c[2] + h[2] * sz];
  const k: V3[] = [
    p(-1, -1, -1),
    p(1, -1, -1),
    p(1, -1, 1),
    p(-1, -1, 1),
    p(-1, 1, -1),
    p(1, 1, -1),
    p(1, 1, 1),
    p(-1, 1, 1),
  ];
  const edges: ReadonlyArray<readonly [number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (const [i, j] of edges) seg(sink, k[i], k[j], phase);
}

function chassisGeometry(cols: number, rows: number, lockers: number, columns: number): BufferGeometry {
  const sink: Sink = { pos: [], phase: [] };
  const { bench, rack, cart, term, vault, board } = SHOP;

  /* the bench plate: its outline, three cross ribs and a front lip — this is what reads isometric */
  const corner = (sx: number, sz: number): V3 => [bench.hx * sx, bench.y, bench.hz * sz];
  seg(sink, corner(-1, -1), corner(1, -1), benchPhase(0));
  seg(sink, corner(1, -1), corner(1, 1), benchPhase(bench.hx));
  seg(sink, corner(1, 1), corner(-1, 1), benchPhase(0));
  seg(sink, corner(-1, 1), corner(-1, -1), benchPhase(-bench.hx));
  for (const x of bench.ribs) seg(sink, [x, bench.y, -bench.hz], [x, bench.y, bench.hz], benchPhase(x));
  seg(sink, [-bench.hx, bench.y - 0.06, bench.hz], [bench.hx, bench.y - 0.06, bench.hz], benchPhase(0));
  for (const sx of [-1, 1]) {
    seg(sink, [bench.hx * sx, bench.y, bench.hz], [bench.hx * sx, bench.y - 0.06, bench.hz], benchPhase(bench.hx * sx));
  }

  /* A · the rack: a case, its shelves, its column dividers, and a price and a stock bar per slot */
  boxWire(sink, [rack.x, bench.y + rack.h / 2, rack.z], [rack.w / 2, rack.h / 2, rack.d / 2], WAVE.rack);
  const zf = rack.z + rack.d / 2;
  const zb = rack.z - rack.d / 2;
  for (let r = 1; r < rows; r += 1) {
    const y = bench.y + 0.22 + (r - 0.5) * rack.pitch[1];
    seg(sink, [rack.x - rack.w / 2, y, zf], [rack.x + rack.w / 2, y, zf], WAVE.rack);
    seg(sink, [rack.x - rack.w / 2, y, zb], [rack.x + rack.w / 2, y, zb], WAVE.rack);
  }
  for (let c = 1; c < cols; c += 1) {
    const x = rack.x + (c - cols / 2) * rack.pitch[0];
    seg(sink, [x, bench.y, zf], [x, bench.y + rack.h, zf], WAVE.rack);
  }
  for (const slot of rackSlots(cols, rows)) {
    const y = slot[1] - 0.115;
    seg(sink, [slot[0] - 0.07, y, zf], [slot[0] + 0.07, y, zf], WAVE.rack);
    seg(sink, [slot[0] - 0.05, y - 0.03, zf], [slot[0] + 0.05, y - 0.03, zf], WAVE.rack);
  }

  /* the basket: four uprights, a rim, a floor and a cross on it */
  const [cw, cd] = cart.rim;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      seg(
        sink,
        [cart.x + (cw / 2) * sx, cart.floor, cart.z + (cd / 2) * sz],
        [cart.x + (cw / 2) * sx, cart.top, cart.z + (cd / 2) * sz],
        WAVE.cart,
      );
    }
  }
  rect(sink, [cart.x, cart.top, cart.z], [cw / 2, 0, 0], [0, 0, cd / 2], WAVE.cart);
  rect(sink, [cart.x, cart.floor, cart.z], [cw / 2, 0, 0], [0, 0, cd / 2], WAVE.cart);
  seg(sink, [cart.x - cw / 2, cart.floor, cart.z - cd / 2], [cart.x + cw / 2, cart.floor, cart.z + cd / 2], WAVE.cart);
  seg(sink, [cart.x + cw / 2, cart.floor, cart.z - cd / 2], [cart.x - cw / 2, cart.floor, cart.z + cd / 2], WAVE.cart);

  /* the packer: a low cradle with a floor, so it reads as a station and not a floating crate */
  rect(sink, [SHOP.pack.x, bench.y + 0.01, SHOP.pack.z], [0.14, 0, 0], [0, 0, 0.14], WAVE.pack);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      seg(
        sink,
        [SHOP.pack.x + 0.14 * sx, bench.y + 0.01, SHOP.pack.z + 0.14 * sz],
        [SHOP.pack.x + 0.14 * sx, bench.y + 0.13, SHOP.pack.z + 0.14 * sz],
        WAVE.pack,
      );
    }
  }

  /* B · the terminal: the body, the tilted screen, the card slot and the receipt slot */
  boxWire(sink, [term.x, bench.y + term.h / 2, term.z], [term.w / 2, term.h / 2, term.d / 2], WAVE.term);
  rect(
    sink,
    SCREEN_C,
    [term.screen[0] / 2, 0, 0],
    [0, (SCREEN_V[1] * term.screen[1]) / 2, (SCREEN_V[2] * term.screen[1]) / 2],
    WAVE.term,
  );
  rect(
    sink,
    screenPoint(0, 0, 0.008),
    [term.screen[0] * 0.38, 0, 0],
    [0, SCREEN_V[1] * term.screen[1] * 0.3, SCREEN_V[2] * term.screen[1] * 0.3],
    WAVE.term,
  );
  for (let i = -1; i <= 1; i += 1) {
    const a = screenPoint(i * 0.09 - 0.03, -term.screen[1] * 0.56, 0.008);
    const b = screenPoint(i * 0.09 + 0.03, -term.screen[1] * 0.56, 0.008);
    seg(sink, a, b, WAVE.term);
  }
  rect(sink, [term.x + term.w / 2, bench.y + term.h * 0.62, term.z + 0.02], [0, 0, 0.13], [0, 0.015, 0], WAVE.term);
  rect(sink, [term.x, bench.y + 0.05, term.z + term.d / 2], [0.11, 0, 0], [0, 0.01, 0], WAVE.term);

  /* C · the vault: the wall, its depth edges and a frame around every locker */
  rect(sink, [vault.x, vault.y, vault.z + vault.d / 2], [vault.w / 2, 0, 0], [0, vault.h / 2, 0], WAVE.vault);
  rect(sink, [vault.x, vault.y, vault.z - vault.d / 2], [vault.w / 2, 0, 0], [0, vault.h / 2, 0], WAVE.vault);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      seg(
        sink,
        [vault.x + (vault.w / 2) * sx, vault.y + (vault.h / 2) * sy, vault.z - vault.d / 2],
        [vault.x + (vault.w / 2) * sx, vault.y + (vault.h / 2) * sy, vault.z + vault.d / 2],
        WAVE.vault,
      );
    }
  }
  for (const cell of lockerCells(lockers)) {
    rect(sink, cell.centre, [vault.door[0] / 2, 0, 0], [0, vault.door[1] / 2, 0], WAVE.vault);
  }

  /* D · the board: the panel, its grid, its two legs and a tick under every column */
  const half = board.w / 2;
  rect(sink, boardPoint(0, 0, 0), [BOARD_U[0] * half, 0, BOARD_U[2] * half], [0, board.h / 2, 0], WAVE.board);
  for (const v of [-board.h / 2 + 0.04, -0.04, 0.12]) {
    seg(sink, boardPoint(-half * 0.94, v, 0.01), boardPoint(half * 0.94, v, 0.01), WAVE.board);
  }
  seg(sink, boardPoint(-half * 0.55, -board.h / 2, 0), [board.x - 0.1, bench.y, board.z], WAVE.board);
  seg(sink, boardPoint(half * 0.55, -board.h / 2, 0), [board.x + 0.22, bench.y, board.z], WAVE.board);
  const pitch = (board.w * 0.86) / columns;
  for (let i = 0; i < columns; i += 1) {
    const u = (i - (columns - 1) / 2) * pitch;
    seg(sink, boardPoint(u, -board.h / 2 + 0.04, 0.01), boardPoint(u, -board.h / 2 + 0.005, 0.01), WAVE.board);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(sink.pos), 3));
  geometry.setAttribute("aPhase", new BufferAttribute(new Float32Array(sink.phase), 1));
  geometry.setAttribute("aU", new BufferAttribute(new Float32Array(sink.phase.length), 1));
  return geometry;
}

/* ---- the sales digits ---------------------------------------------------------------------------- */

/** A bit glyph, model units: its box and the break at each seven-segment joint. */
const BIT = { width: 0.07, height: 0.12, joint: 0.014, span: 0.5 } as const;

/** A seven-segment glyph's strokes around its centre: a 0 is four sides, a 1 two upright halves. */
function bitStrokes(kind: 0 | 1): Array<readonly [number, number, number, number]> {
  const w = BIT.width / 2;
  const h = BIT.height / 2;
  const j = BIT.joint;
  if (kind === 1) {
    return [
      [0, h, 0, j / 2],
      [0, -j / 2, 0, -h],
    ];
  }
  return [
    [-w + j, h, w - j, h],
    [w, h - j, w, -h + j],
    [w - j, -h, -w + j, -h],
    [-w, -h + j, -w, h - j],
  ];
}

/** Per slot a 0 and a 1 at the same anchor; the shader shows one at a time and drifts it up. */
function bitGeometry(count: number, seed: number): BufferGeometry {
  const random = mulberry32(seed);
  const zero = bitStrokes(0);
  const one = bitStrokes(1);
  const positions: number[] = [];
  const glyph: number[] = [];
  const u: number[] = [];
  const phase: number[] = [];
  const half = SHOP.board.w / 2;
  for (let slot = 0; slot < count; slot += 1) {
    const anchor = boardPoint((random() * 1.7 - 0.85) * half, SHOP.board.h / 2 + 0.07, 0.03 + random() * 0.07);
    const s = random();
    for (const [kind, strokes] of [
      [0, zero],
      [1, one],
    ] as const) {
      for (const [x0, y0, x1, y1] of strokes) {
        positions.push(anchor[0], anchor[1], anchor[2], anchor[0], anchor[1], anchor[2]);
        glyph.push(x0, y0, x1, y1);
        u.push(kind, kind);
        phase.push(s, s);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aGlyph", new BufferAttribute(new Float32Array(glyph), 2));
  geometry.setAttribute("aU", new BufferAttribute(new Float32Array(u), 1));
  geometry.setAttribute("aPhase", new BufferAttribute(new Float32Array(phase), 1));
  return geometry;
}

/* ---- the goods ------------------------------------------------------------------------------------ */

/** Base edge of an instanced box, and the shapes it takes: tile → parcel → key → report token. */
const GOOD = 0.2;
const SHAPE = {
  tile: [1.3, 1.0, 0.25],
  parcel: [1.0, 0.9, 0.8],
  key: [0.3, 1.1, 0.3],
  token: [0.42, 0.42, 0.42],
} as const satisfies Record<string, readonly [number, number, number]>;

/** The tick's two strokes, in the screen's plane. */
const TICK_STROKES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-0.055, 0.005, -0.015, -0.035],
  [-0.015, -0.035, 0.065, 0.055],
];

const SEED = 0x5409;
const ALPHA = {
  chassis: { glow: 0.45, ink: 0.55 },
  belt: { glow: 0.35, ink: 0.45 },
  bits: { glow: 0.85, ink: 0.8 },
} as const;

type Lane = { phase: number; order: number; seq: number; column: number; slot: number };

export function createCommerceLoopModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-commerce-loop";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES["commerce-loop"];
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES["commerce-loop"]);
  group.add(pose);

  /* the machine, fitted and centred inside the pose the world owns */
  const rig = new Group();
  rig.scale.setScalar(FIT);
  rig.position.set(0, RIG_LIFT * FIT, 0);
  rig.rotation.y = RIG_YAW;
  pose.add(rig);
  /* the digits float off the board and lead its yaw, so the far plane parts from the bench */
  const far = new Group();
  rig.add(far);

  /* ---- counts, derived from the tier table this file may not extend ---- */
  const cols = Math.max(2, Math.min(3, config.uiCards));
  const rows = 4;
  const tileCount = cols * rows;
  const lockerCount = Math.max(4, config.fanout * 2);
  const columnCount = Math.max(4, config.chipTraces);
  const receiptCount = cols >= 3 ? 5 : 3;
  const digitCount = Math.max(4, Math.round(config.helixBits / 3));
  const radial = Math.max(3, config.link[1]);

  const slots = rackSlots(cols, rows);
  const lockers = lockerCells(lockerCount);

  /* ---- 1 · the belt: five legs merged, teeth at one pitch whatever a leg's length ---- */
  const totalLength = LEGS.reduce((sum, leg) => sum + leg.length, 0);
  let travelled = 0;
  const legParts = LEGS.map((leg, index) => {
    const segments = Math.max(6, Math.round((config.track * leg.length) / totalLength));
    const geometry = new TubeGeometry(new LegCurve(index), segments, SHOP.rail.radius, radial, false);
    // TubeGeometry's uv.x runs 0..1 per leg; rewrite it as arc length so the teeth keep one pitch
    // across the whole circuit (the P5 `track` branch cuts 36 dashes per unit of uv.x).
    const uv = geometry.getAttribute("uv");
    const ring = radial + 1;
    for (let i = 0; i < uv.count; i += 1) {
      const along = Math.floor(i / ring) / segments;
      uv.setX(i, (travelled + along * leg.length) / SHOP.rail.dashSpan);
    }
    uv.needsUpdate = true;
    travelled += leg.length;
    return { geometry, tag: index };
  });
  const beltGeometry = mergeTagged(legParts);
  const belt = createTubeMaterial({
    mode: TUBE_MODE.track,
    roles: { a: "blue", b: "cyan", hot: "hot" },
    alpha: ALPHA.belt.glow,
  });
  const beltMesh = place(new Mesh(beltGeometry, belt.material), 5);
  rig.add(beltMesh);

  /* ---- 2 · the chassis: one LineSegments, a light pulse walking the machine once per order ---- */
  const chassisGeom = chassisGeometry(cols, rows, lockerCount, columnCount);
  const chassis = createLineMaterial({
    mode: LINE_MODE.synapse,
    roles: { a: "cyan", b: "hot", hot: "red" },
    alpha: ALPHA.chassis.glow,
  });
  chassis.uniforms.uDir.value = 1;
  const chassisLines = place(new LineSegments(chassisGeom, chassis.material), 6);
  rig.add(chassisLines);

  /* ---- 3 · the goods: one InstancedMesh for everything that moves or measures ---- */
  const TILES = 0;
  const LANES = TILES + tileCount;
  const CART = LANES + 2;
  const TICKS = CART + 3;
  const RECEIPTS = TICKS + 2;
  const DOORS = RECEIPTS + receiptCount;
  const COLUMNS = DOORS + lockerCount;
  const CARD = COLUMNS + columnCount;
  const INSTANCES = CARD + 1;

  const boxGeometry = new BoxGeometry(1, 1, 1);
  const goods = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: 1.1,
  });
  const goodsMesh = place(new InstancedMesh(boxGeometry, goods.material, INSTANCES), 7);
  rig.add(goodsMesh);

  /* ---- 4 · the sales digits, rising off the board ---- */
  const bitsGeometry = bitGeometry(digitCount, SEED);
  const bits = createLineMaterial({
    mode: LINE_MODE.bits,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    alpha: ALPHA.bits.glow,
  });
  bits.uniforms.uSpan.value = BIT.span;
  const bitLines = place(new LineSegments(bitsGeometry, bits.material), 8);
  far.add(bitLines);

  /* ---- palette ---- */
  const cyan = new Color();
  const blue = new Color();
  const red = new Color();
  const hot = new Color();

  const applyPalette = (next: ScenePalette) => {
    paint(belt, next);
    paint(chassis, next);
    paint(goods, next);
    paint(bits, next);
    // The goods carry their own hue per instance; the shader multiplies uColorA by it.
    goods.uniforms.uColorA.value.setRGB(1, 1, 1);
    toColor(next.cyan, cyan);
    toColor(next.blue, blue);
    toColor(next.red, red);
    toColor(next.hot, hot);
    const ink = next.mode === "ink";
    belt.uniforms.uAlpha.value = ink ? ALPHA.belt.ink : ALPHA.belt.glow;
    chassis.uniforms.uAlpha.value = ink ? ALPHA.chassis.ink : ALPHA.chassis.glow;
    bits.uniforms.uAlpha.value = ink ? ALPHA.bits.ink : ALPHA.bits.glow;
  };
  applyPalette(palette);

  /* ---- per-frame scratch ---- */
  const matrix = new Matrix4();
  const hidden = new Matrix4().makeScale(0, 0, 0);
  const tint = new Color();
  const at = new Vector3();
  const size = new Vector3();
  const axisX = new Vector3();
  const axisY = new Vector3();
  const axisZ = new Vector3();

  let clock = START_AT;
  /** The shelf column the pointer is over, smoothed; the next order comes out of it. */
  let litColumn = (cols - 1) / 2;
  const laneOrder = [0, 0];
  const laneColumn = [Math.round((cols - 1) / 2), Math.round((cols - 1) / 2)];
  const lanes: Lane[] = [
    { phase: 0, order: 0, seq: 0, column: 0, slot: 0 },
    { phase: 0, order: 0, seq: 0, column: 0, slot: 0 },
  ];

  const put = (index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    matrix.makeScale(sx, sy, sz);
    matrix.setPosition(x, y, z);
    goodsMesh.setMatrixAt(index, matrix);
  };
  /** Place a box on an arbitrary basis: a swinging door, a bar in the board's plane, a tick stroke. */
  const putBasis = (index: number, sx: number, sy: number, sz: number) => {
    matrix.makeBasis(axisX, axisY, axisZ);
    matrix.setPosition(at);
    matrix.scale(size.set(sx, sy, sz));
    goodsMesh.setMatrixAt(index, matrix);
  };
  const paintInstance = (index: number, base: Color, gain: number) => {
    goodsMesh.setColorAt(index, tint.copy(base).multiplyScalar(gain));
  };
  const hide = (index: number) => {
    goodsMesh.setMatrixAt(index, hidden);
  };

  /** Read both lanes off the clock; on a new order each lane takes the shelf column in play. */
  const readLanes = (t: number, advance: boolean) => {
    for (let l = 0; l < 2; l += 1) {
      const shifted = t - l * LANE_OFFSET;
      const order = Math.floor(shifted / LOOP);
      if (advance && order !== laneOrder[l]) {
        laneOrder[l] = order;
        // The pointer has a consequence: the next order leaves the shelf column it is over.
        laneColumn[l] = Math.min(cols - 1, Math.max(0, Math.round(litColumn)));
      }
      const lane = lanes[l];
      lane.order = order;
      lane.phase = shifted - order * LOOP;
      lane.seq = order * 2 + l;
      lane.column = laneColumn[l];
      lane.slot = lane.column * rows + wrap(lane.seq, rows);
    }
  };

  const write = (reveal: number, tx: number, ty: number) => {
    const t = clock + HISTORY;

    /* the chassis pulse: one walk of the machine per order */
    chassis.uniforms.uProg.value = ((t % LOOP) / LOOP) * WAVE_SPAN;

    /* orders banked so far — one every half loop, the first at FILL_AT — and the newest one's age */
    const banked = Math.floor((t - FILL_AT) / LANE_OFFSET) + 1;
    const sinceFill = t - (FILL_AT + (banked - 1) * LANE_OFFSET);

    /* ---- the shelf ---- */
    for (let i = 0; i < tileCount; i += 1) {
      let fill = 1;
      for (const lane of lanes) {
        if (lane.slot === i && lane.phase < BEAT.restock[1]) {
          fill = Math.min(fill, easeOutCubic(span(lane.phase, BEAT.restock)));
        }
      }
      if (fill <= 0.001) {
        hide(TILES + i);
        continue;
      }
      const slot = slots[i];
      const near = Math.max(0, 1 - Math.abs(Math.floor(i / rows) - litColumn)) ** 1.5;
      put(
        TILES + i,
        slot[0],
        slot[1],
        slot[2],
        GOOD * SHAPE.tile[0] * fill,
        GOOD * SHAPE.tile[1] * fill,
        GOOD * SHAPE.tile[2],
      );
      paintInstance(TILES + i, cyan, 1.1 + 0.9 * near);
    }

    /* ---- the basket: it fills while the order is picked, then empties into the packer ---- */
    let level = 0;
    for (const lane of lanes) {
      const p = lane.phase;
      let own: number;
      if (p < BEAT.ride1[1]) own = 1 + 2 * smoothstep01(p / BEAT.ride1[1]);
      else if (p < BEAT.pack[1]) own = 3 * (1 - smoothstep01(span(p, BEAT.pack)));
      else own = smoothstep01((p - BEAT.tape[1]) / 1.8);
      level = Math.max(level, own);
    }
    for (let i = 0; i < 3; i += 1) {
      const fill = clamp01(level - i);
      if (fill <= 0.001) {
        hide(CART + i);
        continue;
      }
      put(
        CART + i,
        SHOP.cart.x,
        SHOP.cart.floor + 0.05 + i * SHOP.cart.stack,
        SHOP.cart.z,
        GOOD * SHAPE.tile[0] * 0.92 * fill,
        GOOD * SHAPE.tile[1] * 0.75,
        GOOD * SHAPE.tile[2] * 3.4,
      );
      paintInstance(CART + i, cyan, 1.2);
    }

    /* ---- the lane goods: one instance per lane, shelf tile → parcel → key → report token ---- */
    let tickLane = -1;
    let receiptLane = -1;
    let cardLane = -1;
    let doorLane = -1;
    for (let l = 0; l < 2; l += 1) {
      const lane = lanes[l];
      const p = lane.phase;
      const index = LANES + l;
      let shape: readonly [number, number, number] = SHAPE.tile;
      let base = cyan;
      let gain = 1.5;
      let shown = true;

      if (p < BEAT.pick[1]) {
        /* the tile leaves its shelf slot on an arc and lands on the belt */
        const q = easeOutCubic(span(p, BEAT.pick));
        const slot = slots[lane.slot];
        railPoint(0, 0, at);
        at.set(
          lerp(slot[0], at.x, q),
          lerp(slot[1], at.y + SHOP.rail.lift, q) + 0.1 * Math.sin(Math.PI * q),
          lerp(slot[2], at.z, q),
        );
        gain = 1.5 + 0.7 * (1 - q);
      } else if (p < BEAT.ride1[1]) {
        railPoint(0, span(p, BEAT.ride1), at);
        at.y += SHOP.rail.lift;
      } else if (p < BEAT.tape[1]) {
        /* packing: the tile becomes a parcel at the packer, then the tape squeezes it shut */
        const q = smoothstep01(span(p, BEAT.pack));
        railPoint(1, 0.5 * q, at);
        at.y += SHOP.rail.lift + 0.02 * q;
        const tape = p < BEAT.tape[0] ? 0 : Math.sin(Math.PI * span(p, BEAT.tape));
        shape = [
          lerp(SHAPE.tile[0], SHAPE.parcel[0], q) * (1 - 0.12 * tape),
          lerp(SHAPE.tile[1], SHAPE.parcel[1], q),
          lerp(SHAPE.tile[2], SHAPE.parcel[2], q) * (1 - 0.12 * tape),
        ];
        base = q > 0.5 ? blue : cyan;
        gain = 1.55 + 0.5 * tape;
      } else if (p < BEAT.ride2[1]) {
        railPoint(1, 0.5 + 0.5 * span(p, BEAT.ride2), at);
        at.y += SHOP.rail.lift + 0.02;
        shape = SHAPE.parcel;
        base = blue;
        gain = 1.55;
      } else if (p < BEAT.key[1]) {
        /* at the terminal: the card, the authorisation, the tick, the receipt, then the key */
        railPoint(1, 1, at);
        at.y += SHOP.rail.lift + 0.02;
        if (p >= BEAT.card[0] && p < BEAT.receipt[0] + 0.2) cardLane = l;
        if (p >= BEAT.tick[0] && p < BEAT.receipt[0]) tickLane = l;
        if (p >= BEAT.receipt[0]) receiptLane = l;
        const morph = smoothstep01(span(p, BEAT.key));
        shape = [
          lerp(SHAPE.parcel[0], SHAPE.key[0], morph),
          lerp(SHAPE.parcel[1], SHAPE.key[1], morph),
          lerp(SHAPE.parcel[2], SHAPE.key[2], morph),
        ];
        base = morph > 0.5 ? red : blue;
        const flash = p >= BEAT.tick[0] ? 1 - clamp01((p - BEAT.tick[0]) / 0.45) : 0;
        const beating = p >= BEAT.auth[0] && p < BEAT.tick[0] ? 0.18 * Math.sin(p * 26) : 0;
        gain = 1.55 + 1.1 * flash + beating;
      } else if (p < BEAT.ride3[1]) {
        railPoint(2, span(p, BEAT.ride3), at);
        at.y += SHOP.rail.lift;
        shape = SHAPE.key;
        base = red;
        gain = 1.8;
      } else if (p < BEAT.shut[0]) {
        /* the key goes into its locker while the door swings open */
        doorLane = l;
        const q = easeOutCubic(span(p, BEAT.open));
        const cell = lockers[wrap(lane.seq, lockerCount)];
        railPoint(2, 1, at);
        at.set(
          lerp(at.x, cell.centre[0], q),
          lerp(at.y + SHOP.rail.lift, cell.centre[1], q),
          lerp(at.z, cell.centre[2] - 0.05, q),
        );
        shape = [SHAPE.key[0], SHAPE.key[1] * (1 - 0.45 * q), SHAPE.key[2]];
        base = red;
        gain = 1.8 + 0.8 * q;
      } else if (p < BEAT.shut[1]) {
        doorLane = l;
        shown = false;
      } else if (p < BEAT.ride4[1]) {
        /* the banked order rides the rear rail to the board as a report token */
        railPoint(3, span(p, BEAT.ride4), at);
        shape = SHAPE.token;
        base = red;
        gain = 2.0;
      } else if (p < BEAT.column[1]) {
        const q = smoothstep01(span(p, BEAT.column));
        railPoint(3, 1, at);
        shape = [SHAPE.token[0] * (1 - q), SHAPE.token[1] * (1 - q), SHAPE.token[2] * (1 - q)];
        base = red;
        gain = 2.0;
      } else {
        shown = false;
      }

      if (!shown) {
        hide(index);
        continue;
      }
      put(index, at.x, at.y, at.z, GOOD * shape[0], GOOD * shape[1], GOOD * shape[2]);
      paintInstance(index, base, gain);
    }

    /* ---- the tick: two strokes drawn on the screen, the second twice the first ---- */
    for (let i = 0; i < 2; i += 1) {
      const p = tickLane >= 0 ? lanes[tickLane].phase : -1;
      const q = p < 0 ? 0 : easeOutCubic(clamp01((span(p, BEAT.tick) - i * 0.35) / 0.65));
      if (q <= 0.01) {
        hide(TICKS + i);
        continue;
      }
      const [ax, ay, bx, by] = TICK_STROKES[i];
      const a = screenPoint(ax, ay, 0.014);
      const b = screenPoint(bx, by, 0.014);
      axisX.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const length = axisX.length() || 1;
      axisX.divideScalar(length);
      axisY.set(SCREEN_N[0], SCREEN_N[1], SCREEN_N[2]);
      axisZ.crossVectors(axisX, axisY);
      at.set(a[0], a[1], a[2]).addScaledVector(axisX, (length * q) / 2);
      putBasis(TICKS + i, length * q, 0.022, 0.03);
      paintInstance(TICKS + i, hot, 2.4);
    }

    /* ---- the receipt: short bars printing out of the base slot onto the bench, then fading ---- */
    for (let i = 0; i < receiptCount; i += 1) {
      const since = receiptLane >= 0 ? lanes[receiptLane].phase - BEAT.receipt[0] - i * 0.07 : -1;
      const fade = since <= 0 ? 0 : 1 - clamp01((since - 0.3) / 1.0);
      if (fade <= 0.01) {
        hide(RECEIPTS + i);
        continue;
      }
      put(
        RECEIPTS + i,
        SHOP.term.x,
        SHOP.bench.y + 0.012,
        SHOP.term.z + SHOP.term.d / 2 + 0.05 + i * 0.045,
        0.2 * easeOutCubic(clamp01(since / 0.1)),
        0.02,
        0.03,
      );
      paintInstance(RECEIPTS + i, cyan, 1.05 + 0.75 * fade);
    }

    /* ---- the vault: the oldest locker is the one about to be filled, so it is the one that swings ---- */
    for (let i = 0; i < lockerCount; i += 1) {
      const cell = lockers[wrap(banked - 1 - i, lockerCount)];
      let light = 0.12 + 0.88 * Math.exp(-i * 0.55);
      let angle = 0;
      if (i === lockerCount - 1 && doorLane >= 0) {
        const p = lanes[doorLane].phase;
        const shut = smoothstep01(span(p, BEAT.shut));
        angle = 1.15 * easeOutCubic(span(p, BEAT.open)) * (1 - shut);
        // The door closes lit: at the end of `shut` this locker becomes the newest, seamlessly.
        light += (1 - light) * shut;
      }
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      axisX.set(c, 0, s);
      axisY.set(0, 1, 0);
      axisZ.set(-s, 0, c);
      at.set(cell.hinge[0] + (SHOP.vault.door[0] / 2) * c, cell.hinge[1], cell.hinge[2] + (SHOP.vault.door[0] / 2) * s);
      putBasis(DOORS + i, SHOP.vault.door[0] * 0.92, SHOP.vault.door[1] * 0.88, 0.022);
      paintInstance(DOORS + i, i === 0 ? red : blue, 0.7 + 1.5 * light);
    }

    /* ---- the board: the last `columnCount` orders, today's tallest and red ---- */
    const pitch = (SHOP.board.w * 0.86) / columnCount;
    const floorV = -SHOP.board.h / 2 + 0.04;
    for (let i = 0; i < columnCount; i += 1) {
      const f = banked - 1 - i;
      let height = (0.2 + 0.78 * hash01(f)) * (SHOP.board.h - 0.1);
      if (i === 0) {
        /* today's column grows with a small overshoot, then settles */
        const q = span(sinceFill, COLUMN_AFTER);
        height *= clamp01(easeOutCubic(q / 0.6) * 1.12 - smoothstep01((q - 0.6) / 0.4) * 0.12);
      }
      if (height <= 0.004) {
        hide(COLUMNS + i);
        continue;
      }
      const centre = boardPoint((wrap(f, columnCount) - (columnCount - 1) / 2) * pitch, floorV + height / 2, 0.035);
      axisX.set(BOARD_U[0], 0, BOARD_U[2]);
      axisY.set(0, 1, 0);
      axisZ.set(BOARD_N[0], 0, BOARD_N[2]);
      at.set(centre[0], centre[1], centre[2]);
      putBasis(COLUMNS + i, pitch * 0.62, height, 0.03);
      paintInstance(COLUMNS + i, i === 0 ? red : cyan, i === 0 ? 1.9 : 1.15);
    }

    /* ---- the card: a thin blade entering the terminal's side slot, and leaving after the tick ---- */
    if (cardLane >= 0) {
      const p = lanes[cardLane].phase;
      const reach =
        easeOutCubic(span(p, BEAT.card)) - (p >= BEAT.receipt[0] ? easeOutCubic((p - BEAT.receipt[0]) / 0.2) : 0);
      put(
        CARD,
        SHOP.term.x + SHOP.term.w / 2 + 0.16 - 0.14 * reach,
        SHOP.bench.y + SHOP.term.h * 0.62,
        SHOP.term.z + 0.02,
        0.14,
        0.026,
        0.17,
      );
      paintInstance(CARD, hot, 1.55 + 0.85 * clamp01(reach));
    } else {
      hide(CARD);
    }

    goodsMesh.instanceMatrix.needsUpdate = true;
    if (goodsMesh.instanceColor) goodsMesh.instanceColor.needsUpdate = true;

    /* the pointer leans the bench a little further than the world does, and parts the far plane */
    rig.rotation.y = RIG_YAW + tx * LEAN.yaw;
    rig.rotation.x = -ty * LEAN.pitch;
    far.rotation.y = tx * DIGIT_PARALLAX;

    belt.uniforms.uReveal.value = reveal;
    chassis.uniforms.uReveal.value = reveal;
    goods.uniforms.uReveal.value = reveal;
    bits.uniforms.uReveal.value = reveal;
  };

  const start = () => {
    clock = START_AT;
    laneOrder[0] = Math.floor((clock + HISTORY) / LOOP);
    laneOrder[1] = Math.floor((clock + HISTORY - LANE_OFFSET) / LOOP);
    laneColumn[0] = Math.round((cols - 1) / 2);
    laneColumn[1] = Math.round((cols - 1) / 2);
    litColumn = (cols - 1) / 2;
    readLanes(clock + HISTORY, false);
  };
  start();
  write(1, 0, 0);

  return {
    kind: "commerce-loop",
    group,
    objects: [group],

    resetCycle: start,

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      // The belt's teeth and the digits run on scene time, never on the order clock: a stalled
      // order must never freeze the whole machine.
      belt.uniforms.uTime.value = frame.time;
      bits.uniforms.uTime.value = frame.time;
      chassis.uniforms.uTime.value = frame.time;
      goods.uniforms.uTime.value = frame.time;
      if (frame.step > 0) {
        // The pointer is the shopper's hand: it picks the shelf column the next order leaves from.
        const target = clamp01(frame.tx * 0.5 + 0.5) * (cols - 1);
        litColumn = damp(litColumn, target, 6, frame.step);
      }
      readLanes(clock + HISTORY, frame.step > 0);
      write(frame.reveal, frame.tx, frame.ty);
    },

    setLite(lite) {
      bitLines.visible = !lite;
    },

    setPalette: applyPalette,

    dispose() {
      beltGeometry.dispose();
      chassisGeom.dispose();
      bitsGeometry.dispose();
      boxGeometry.dispose();
      belt.material.dispose();
      chassis.material.dispose();
      goods.material.dispose();
      bits.material.dispose();
      goodsMesh.dispose();
    },
  };
}
