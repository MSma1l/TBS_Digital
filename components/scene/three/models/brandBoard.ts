/**
 * "Brand & UI": «Placa de identitate» — the brand board. A 3.24 × 2.16 artboard standing
 * three-quarters to the camera, on which an identity keeps building itself: a 12-column grid
 * with crop marks, the `TBS.` wordmark printed flat and lifted off the board with tie lines,
 * a rail of five colour tokens, and six UI components (nav, hero, two cards, a field, a
 * button) that re-flow from a wide layout into a phone frame behind a breakpoint rule — the
 * whole board repainting one token step every loop.
 *
 * Nothing here is a particle: every stroke is a nameable thing a client has paid for.
 *
 * NO ENTRANCE. The idle loop is the show and its clock starts on the composed pose (t = 0 is
 * the finished wide board), so a service page that snaps to `formed` on the first frame — and
 * a frozen clock under reduced motion — both land on a portfolio still, not on a blank stage.
 *
 * Draws: the plate (P2 `edges`, hidden by lite), the grid (P4 `wire`), the moving lines
 * (P4 `card`), the token chips and the wordmark's full stop (P3 `plasma`, instanced) — four,
 * three in lite. No new shader branch and no new palette role: the live repaint is one write
 * of `uTime` on the line material (each stroke carries its token index in `aU`, and the
 * `card` branch reads `mix(uColorA, uColorB, 0.5 + 0.5 sin(aU·2π + uTime))`), and the chips
 * carry true token colours per instance over a white `uColorA`, the commerce loop's idiom.
 *
 * Geometry is animated on the CPU into two dynamic position buffers (≈ 430 vertices): that is
 * what buys draw-on, re-flow and the layout snap without a sixth shader program.
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
  Mesh,
} from "three";
import { damp } from "@/components/three/motion";
import { clamp01, easeOutCubic, smoothstep } from "../../choreography";
import type { SceneTierConfig } from "../../tiers";
import {
  LINE_MODE,
  SURFACE_MODE,
  createLineMaterial,
  createSurfaceMaterial,
  paint,
  toColor,
} from "../materials";
import type { ScenePalette } from "../palette";
import { MODEL_SWAY, place, type SceneModel } from "./types";

const TAU = Math.PI * 2;

/** Where an undrawn segment parks: past the camera's far plane, so the GPU clips it. */
const HIDDEN = 1e4;

/* ---- the board ----------------------------------------------------------------------------- */

/** The artboard in its own plane (x right, y up, z out of the board). Half-sizes. */
const BOARD = { w: 1.62, h: 1.08, thick: 0.02 } as const;
/** The content box inside the 0.12 margin. */
const CONTENT = { x: 1.5, y: 0.96 } as const;
/** Arm of a margin crop mark. */
const BRACKET = 0.18;
/** Layers along the board's own z. */
const LAYER = { grid: 0.012, mark: 0.006, lift: 0.16, part: 0.08, chip: 0.03, frame: 0.07, rule: 0.26 } as const;
/** Euler XYZ: leaning back 11°, turned 23°. It never spins. */
const BOARD_POSE = [-0.2, 0.4, 0] as const;
/**
 * The world sways every model about y by `MODEL_SWAY`; a board carrying readable type wants
 * far less, so the pose group cancels this share of it (0.42 rad of yaw → 0.16).
 */
const SWAY_DAMPEN = 0.62;

const PLATE_INTENSITY = { glow: 0.8, ink: 0.5 } as const;
const GRID_ALPHA = { glow: 0.34, ink: 0.42 } as const;
const LINE_ALPHA = { glow: 0.82, ink: 0.95 } as const;
const CHIP_GAIN = { glow: 1.55, ink: 1.15 } as const;

/** The phone frame of the narrow layout: an outline and a square notch bar, never a pill. */
const PHONE = { x: 0.86, y: 0, w: 0.62, h: 1.32, notchW: 0.16, notchY: 0.6 } as const;
/** The token rail: five 0.11 squares along the bottom margin. */
const CHIPS = { count: 5, size: 0.11, pitch: 0.16, x: -1.39, y: -0.86 } as const;
/** The wordmark: cap height, the baseline's left end, tracking (in ems). */
const MARK = { em: 0.46, x: -1.44, y: 0.46, tracking: 0.06 } as const;

/* ---- the loop ------------------------------------------------------------------------------ */

/**
 * 6.6 s. t = 0 is the composed pose, so a frozen clock and a page that snaps to `formed` both
 * land on a finished board:
 *
 *   0.00–0.60  hold — the composed wide board, breathing
 *   0.60–1.55  PALETTE — the five tokens re-ink left to right, then the whole board repaints
 *   1.55–2.40  hold
 *   2.40–3.80  RE-FLOW — the breakpoint rule sweeps in, the grid and the six components
 *              collapse into the phone frame, each landing with a 5% snap
 *   3.80–4.45  the phone stands; the nib scans down it
 *   4.45–5.55  RETURN — the rule leaves, everything re-flows back to the wide layout
 *   5.55–6.60  MARK — the lifted `TBS.` is re-printed stroke by stroke with its tie lines
 */
const LOOP = 6.6;
const BEAT = {
  chipFrom: 0.6,
  chipStep: 0.12,
  chipSpan: 0.32,
  repaintFrom: 0.95,
  repaintTo: 1.55,
  ruleOutFrom: 2.4,
  ruleOutSpan: 0.6,
  partOutFrom: 2.48,
  partOutStep: 0.13,
  partOutSpan: 0.55,
  frameFrom: 2.95,
  frameSpan: 0.45,
  nibFrom: 3.85,
  nibSpan: 0.5,
  ruleBackFrom: 4.45,
  ruleBackSpan: 0.5,
  partBackFrom: 4.52,
  partBackStep: 0.11,
  partBackSpan: 0.5,
  gridOutFrom: 2.55,
  gridOutTo: 3.05,
  gridBackFrom: 4.5,
  gridBackTo: 5.0,
  liftFrom: 5.55,
  liftSpan: 0.7,
  tieFrom: 5.85,
  tieSpan: 0.7,
} as const;

/** Where the breakpoint rule rests (off the right edge) and where it parks (the phone's edge). */
const RULE = { rest: 1.8, park: PHONE.x - PHONE.w / 2, tall: 1.02, short: PHONE.h / 2 } as const;

/* ---- layouts ------------------------------------------------------------------------------- */

type Slot = readonly [number, number, number, number];

/** nav · hero · cardA · cardB · field · button, spanning the 12-column grid. */
const WIDE: readonly Slot[] = [
  [0.52, 0.69, 1.84, 0.22],
  [0.02, 0.22, 2.84, 0.42],
  [-0.72, -0.34, 1.4, 0.5],
  [0.74, -0.34, 1.4, 0.5],
  [0.18, -0.86, 1.1, 0.17],
  [1.14, -0.86, 0.52, 0.17],
];

/** The SAME six parts stacked inside the phone frame; index i pairs with index i of `WIDE`. */
const NARROW: readonly Slot[] = [
  [PHONE.x, 0.52, 0.52, 0.1],
  [PHONE.x, 0.33, 0.52, 0.24],
  [PHONE.x, 0.05, 0.52, 0.28],
  [PHONE.x, -0.25, 0.52, 0.28],
  [PHONE.x, -0.46, 0.52, 0.1],
  [PHONE.x, -0.59, 0.52, 0.1],
];

/** Right to left: the order the rule passes them on the way out, and back on the way in. */
const OUT_ORDER = [2, 3, 5, 1, 0, 4] as const;

/* ---- parts ---------------------------------------------------------------------------------- */

const PART = {
  nav: 0,
  hero: 1,
  cardA: 2,
  cardB: 3,
  field: 4,
  button: 5,
  markFlat: 6,
  markLift: 7,
  ties: 8,
  phone: 9,
  chips: 10,
  rule: 11,
  nib: 12,
  snap: 13,
} as const;
const PART_COUNT = 14;
const COMPONENTS = 6;

type Pt = readonly [number, number];

/**
 * A component's own strokes in its slot's unit box: the outline (always drawn, it flies as a
 * bare frame), four corner brackets and the inner detail that says what it is — both of those
 * re-print as the part lands.
 */
function componentStrokes(part: number): { outline: Pt[]; brackets: Pt[][]; detail: Pt[][] } {
  const outline: Pt[] = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
    [-0.5, -0.5],
  ];
  const arm = 0.16;
  const brackets: Pt[][] = [];
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    brackets.push([
      [sx * 0.5 - sx * arm, sy * 0.5],
      [sx * 0.5, sy * 0.5],
      [sx * 0.5, sy * 0.5 - sy * arm],
    ]);
  }
  const detail: Pt[][] = [];
  if (part === PART.nav) {
    detail.push([
      [-0.42, -0.14],
      [-0.28, -0.14],
      [-0.28, 0.14],
      [-0.42, 0.14],
      [-0.42, -0.14],
    ]);
    for (let j = 0; j < 4; j += 1) {
      const x = -0.02 + j * 0.12;
      detail.push([
        [x, 0],
        [x + 0.08, 0],
      ]);
    }
  } else if (part === PART.hero) {
    detail.push([
      [-0.44, 0.22],
      [0.1, 0.22],
    ]);
    detail.push([
      [-0.44, 0.06],
      [-0.06, 0.06],
    ]);
    detail.push([
      [-0.44, -0.08],
      [0.02, -0.08],
    ]);
    detail.push([
      [0.18, -0.3],
      [0.44, -0.3],
      [0.44, -0.1],
      [0.18, -0.1],
      [0.18, -0.3],
    ]);
  } else if (part === PART.cardA || part === PART.cardB) {
    detail.push([
      [-0.42, 0.02],
      [0.42, 0.02],
      [0.42, 0.4],
      [-0.42, 0.4],
      [-0.42, 0.02],
    ]);
    detail.push([
      [-0.42, -0.14],
      [0.3, -0.14],
    ]);
    detail.push([
      [-0.42, -0.3],
      [0.06, -0.3],
    ]);
  } else if (part === PART.field) {
    detail.push([
      [-0.34, -0.22],
      [-0.34, 0.22],
    ]);
    detail.push([
      [-0.26, 0],
      [0.1, 0],
    ]);
  } else {
    detail.push([
      [-0.2, 0],
      [0.2, 0],
    ]);
    detail.push([
      [0.26, -0.12],
      [0.34, 0],
      [0.26, 0.12],
    ]);
  }
  return { outline, brackets, detail };
}

/**
 * `TBS` as stroke polylines in a 1-unit em box: T two strokes, B a spine and two rectangular
 * bowls, S one engineered zig. Straight strokes only, no arcs — the full stop is a filled
 * square on the chip mesh, in `--red`, and it is the one thing that never repaints.
 */
function wordmarkStrokes(): Pt[][] {
  const letters: Array<{ width: number; strokes: Pt[][] }> = [
    {
      width: 0.62,
      strokes: [
        [
          [0, 1],
          [0.62, 1],
        ],
        [
          [0.31, 1],
          [0.31, 0],
        ],
      ],
    },
    {
      width: 0.6,
      strokes: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [0, 1],
          [0.44, 1],
          [0.56, 0.88],
          [0.56, 0.66],
          [0.44, 0.54],
          [0, 0.54],
        ],
        [
          [0, 0.54],
          [0.48, 0.54],
          [0.6, 0.42],
          [0.6, 0.12],
          [0.48, 0],
          [0, 0],
        ],
      ],
    },
    {
      width: 0.58,
      strokes: [
        // The spurs at both ends are what keep an all-straight S from reading as a 5.
        [
          [0.58, 0.8],
          [0.58, 1],
          [0.04, 1],
          [0.04, 0.56],
          [0.56, 0.56],
          [0.56, 0],
          [0.02, 0],
          [0.02, 0.2],
        ],
      ],
    },
  ];
  const out: Pt[][] = [];
  let advance = 0;
  for (const letter of letters) {
    for (const stroke of letter.strokes) {
      out.push(stroke.map(([x, y]) => [MARK.x + (advance + x) * MARK.em, MARK.y + y * MARK.em] as Pt));
    }
    advance += letter.width + MARK.tracking;
  }
  return out;
}

/** The full stop's square, after the S. */
const DOT = {
  size: 0.115,
  x: MARK.x + (0.62 + 0.06 + 0.6 + 0.06 + 0.58 + 0.05) * MARK.em + 0.0575,
  y: MARK.y + 0.0575,
} as const;

/* ---- the moving-lines buffer ----------------------------------------------------------------- */

type StrokeSpec = {
  part: number;
  /** Which of the five tokens paints it (`aU` = tint / 5). */
  tint: number;
  z: number;
  /** A tie line rises from `z` to `zTo` along its length. */
  zTo?: number;
  /** Always drawn: it moves instead of printing. */
  held?: boolean;
  /** The window inside its part's draw progress in which it prints. */
  t0?: number;
  t1?: number;
  pts: readonly Pt[];
};

type Strokes = {
  segCount: number;
  strokeCount: number;
  /** ax, ay, bx, by per segment, in its part's local space. */
  segA: Float32Array;
  /** za, zb per segment, before the part's own layer. */
  segZ: Float32Array;
  /** Normalised arc start / end of the segment inside its stroke. */
  segS: Float32Array;
  segPart: Uint8Array;
  segStroke: Uint16Array;
  strokePart: Uint8Array;
  strokeHeld: Uint8Array;
  /** t0, t1 per stroke. */
  strokeWindow: Float32Array;
  positions: Float32Array;
  tints: Float32Array;
};

function flatten(specs: readonly StrokeSpec[]): Strokes {
  let segCount = 0;
  for (const spec of specs) segCount += Math.max(0, spec.pts.length - 1);
  const out: Strokes = {
    segCount,
    strokeCount: specs.length,
    segA: new Float32Array(segCount * 4),
    segZ: new Float32Array(segCount * 2),
    segS: new Float32Array(segCount * 2),
    segPart: new Uint8Array(segCount),
    segStroke: new Uint16Array(segCount),
    strokePart: new Uint8Array(specs.length),
    strokeHeld: new Uint8Array(specs.length),
    strokeWindow: new Float32Array(specs.length * 2),
    positions: new Float32Array(segCount * 6),
    tints: new Float32Array(segCount * 2),
  };
  let s = 0;
  for (let k = 0; k < specs.length; k += 1) {
    const spec = specs[k];
    out.strokePart[k] = spec.part;
    out.strokeHeld[k] = spec.held ? 1 : 0;
    out.strokeWindow[k * 2] = spec.t0 ?? 0;
    out.strokeWindow[k * 2 + 1] = spec.t1 ?? 1;
    const lengths: number[] = [0];
    let total = 0;
    for (let i = 1; i < spec.pts.length; i += 1) {
      const dx = spec.pts[i][0] - spec.pts[i - 1][0];
      const dy = spec.pts[i][1] - spec.pts[i - 1][1];
      total += Math.hypot(dx, dy) || 1e-4;
      lengths.push(total);
    }
    const zFrom = spec.z;
    const zTo = spec.zTo ?? spec.z;
    for (let i = 1; i < spec.pts.length; i += 1) {
      const s0 = lengths[i - 1] / total;
      const s1 = lengths[i] / total;
      out.segA[s * 4] = spec.pts[i - 1][0];
      out.segA[s * 4 + 1] = spec.pts[i - 1][1];
      out.segA[s * 4 + 2] = spec.pts[i][0];
      out.segA[s * 4 + 3] = spec.pts[i][1];
      out.segZ[s * 2] = zFrom + (zTo - zFrom) * s0;
      out.segZ[s * 2 + 1] = zFrom + (zTo - zFrom) * s1;
      out.segS[s * 2] = s0;
      out.segS[s * 2 + 1] = s1;
      out.segPart[s] = spec.part;
      out.segStroke[s] = k;
      out.tints[s * 2] = spec.tint / 5;
      out.tints[s * 2 + 1] = spec.tint / 5;
      s += 1;
    }
  }
  return out;
}

/** Every stroke the board draws except the grid: the wordmark, the six parts, the phone, the
 *  token outlines, the breakpoint rule with its nib, and the pointer's snap cursor. */
function buildStrokes(parts: readonly number[], lifted: boolean): StrokeSpec[] {
  const specs: StrokeSpec[] = [];
  const mark = wordmarkStrokes();

  for (const stroke of mark) specs.push({ part: PART.markFlat, tint: 0, z: LAYER.mark, held: true, pts: stroke });
  if (lifted) {
    const step = 0.72 / Math.max(1, mark.length - 1);
    for (let k = 0; k < mark.length; k += 1) {
      specs.push({ part: PART.markLift, tint: 1, z: 0, t0: k * step, t1: k * step + 0.28, pts: mark[k] });
    }
    const flat = mark.flat();
    for (let k = 0; k < 8; k += 1) {
      const point = flat[Math.round((k / 7) * (flat.length - 1))];
      specs.push({
        part: PART.ties,
        tint: 0,
        z: LAYER.mark,
        zTo: LAYER.lift,
        t0: k * 0.07,
        t1: k * 0.07 + 0.44,
        pts: [point, point],
      });
    }
  }

  const tints = [2, 1, 3, 4, 2, 0];
  for (const i of parts) {
    const { outline, brackets, detail } = componentStrokes(i);
    specs.push({ part: i, tint: tints[i], z: 0, held: true, pts: outline });
    for (const bracket of brackets) specs.push({ part: i, tint: tints[i], z: 0, t0: 0, t1: 0.55, pts: bracket });
    for (const stroke of detail) {
      specs.push({ part: i, tint: (tints[i] + 1) % 5, z: 0, t0: 0.35, t1: 1, pts: stroke });
    }
  }

  const hw = PHONE.w / 2;
  const hh = PHONE.h / 2;
  specs.push({
    part: PART.phone,
    tint: 1,
    z: LAYER.frame,
    t0: 0,
    t1: 0.72,
    pts: [
      [PHONE.x - hw, PHONE.y - hh],
      [PHONE.x + hw, PHONE.y - hh],
      [PHONE.x + hw, PHONE.y + hh],
      [PHONE.x - hw, PHONE.y + hh],
      [PHONE.x - hw, PHONE.y - hh],
    ],
  });
  specs.push({
    part: PART.phone,
    tint: 3,
    z: LAYER.frame,
    t0: 0.72,
    t1: 1,
    pts: [
      [PHONE.x - PHONE.notchW / 2, PHONE.notchY],
      [PHONE.x + PHONE.notchW / 2, PHONE.notchY],
    ],
  });

  const half = CHIPS.size / 2;
  for (let k = 0; k < CHIPS.count; k += 1) {
    const cx = CHIPS.x + k * CHIPS.pitch;
    specs.push({
      part: PART.chips,
      tint: k,
      z: LAYER.chip + 0.012,
      held: true,
      pts: [
        [cx - half, CHIPS.y - half],
        [cx + half, CHIPS.y - half],
        [cx + half, CHIPS.y + half],
        [cx - half, CHIPS.y + half],
        [cx - half, CHIPS.y - half],
      ],
    });
  }

  // The rule, its nib and the snap cursor are drawn on by their own presence, so at rest they
  // are not degenerate segments sitting on the board — they are clipped away entirely.
  specs.push({
    part: PART.rule,
    tint: 3,
    z: LAYER.rule,
    pts: [
      [0, -1],
      [0, 1],
    ],
  });
  specs.push({
    part: PART.nib,
    tint: 4,
    z: LAYER.rule,
    pts: [
      [-0.07, 0.05],
      [0, 0.05],
      [0, -0.05],
      [-0.07, -0.05],
    ],
  });

  const cell = 0.0275;
  specs.push({
    part: PART.snap,
    tint: 2,
    z: LAYER.rule,
    pts: [
      [-cell, -cell],
      [cell, -cell],
      [cell, cell],
      [-cell, cell],
      [-cell, -cell],
    ],
  });
  for (const [ax, ay, bx, by] of [
    [-0.09, 0, -cell, 0],
    [cell, 0, 0.09, 0],
    [0, -0.09, 0, -cell],
    [0, cell, 0, 0.09],
  ] as const) {
    specs.push({
      part: PART.snap,
      tint: 2,
      z: LAYER.rule,
      pts: [
        [ax, ay],
        [bx, by],
      ],
    });
  }
  return specs;
}

/* ---- the model ------------------------------------------------------------------------------- */

export function createBrandBoardModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  // The kind key stays `mesh-wave` while this model replaces it, and so does the group's name.
  group.name = "scene-model-mesh-wave";
  const pose = new Group();
  pose.rotation.set(BOARD_POSE[0], BOARD_POSE[1], BOARD_POSE[2]);
  group.add(pose);

  const high = config.uiCards >= 3;
  // Mid drops the second card; every other part, and both layouts, are unchanged.
  const parts: readonly number[] = high
    ? [PART.nav, PART.hero, PART.cardA, PART.cardB, PART.field, PART.button]
    : [PART.nav, PART.hero, PART.cardA, PART.field, PART.button];
  const columns = high ? 13 : 9;
  const rows = high ? 10 : 7;
  const keepEvery = Math.max(1, Math.round((columns - 1) / 4));

  /* the plate: a unit box scaled to the artboard, so the `edges` branch lights its border */
  const plateGeometry = new BoxGeometry(1, 1, 1);
  const plate = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "blue", b: "cyan", hot: "hot" },
    intensity: PLATE_INTENSITY.glow,
  });
  const plateMesh = place(new Mesh(plateGeometry, plate.material), 4);
  plateMesh.scale.set(BOARD.w * 2, BOARD.h * 2, BOARD.thick);
  pose.add(plateMesh);

  /* the grid: column lines, baselines and four margin crop marks */
  const gridSegments = columns + rows + 8;
  const gridPositions = new Float32Array(gridSegments * 6);
  const gridGeometry = new BufferGeometry();
  const gridAttribute = new BufferAttribute(gridPositions, 3);
  gridAttribute.setUsage(DynamicDrawUsage);
  gridGeometry.setAttribute("position", gridAttribute);
  const grid = createLineMaterial({
    mode: LINE_MODE.wire,
    roles: { a: "blue", b: "cyan", hot: "hot" },
    alpha: GRID_ALPHA.glow,
  });
  pose.add(place(new LineSegments(gridGeometry, grid.material), 5));

  const columnX = new Float32Array(columns);
  const columnHalf = new Float32Array(columns);
  const rowY = new Float32Array(rows);
  for (let i = 0; i < columns; i += 1) columnX[i] = -CONTENT.x + (i / (columns - 1)) * CONTENT.x * 2;
  for (let j = 0; j < rows; j += 1) rowY[j] = -CONTENT.y + (j / (rows - 1)) * CONTENT.y * 2;
  const baseColumnX = Float32Array.from(columnX);
  const baseRowY = Float32Array.from(rowY);

  /* the moving lines: one buffer, one draw, positions rewritten per frame */
  const strokes = flatten(buildStrokes(parts, true));
  const linesGeometry = new BufferGeometry();
  const linesAttribute = new BufferAttribute(strokes.positions, 3);
  linesAttribute.setUsage(DynamicDrawUsage);
  linesGeometry.setAttribute("position", linesAttribute);
  linesGeometry.setAttribute("aU", new BufferAttribute(strokes.tints, 1));
  const lines = createLineMaterial({
    mode: LINE_MODE.card,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    alpha: LINE_ALPHA.glow,
  });
  pose.add(place(new LineSegments(linesGeometry, lines.material), 7));

  /* the token chips, and the wordmark's full stop as the sixth instance */
  const chipGeometry = new BoxGeometry(1, 1, 1);
  const chips = createSurfaceMaterial({
    mode: SURFACE_MODE.plasma,
    roles: { a: "hot", b: "hot", hot: "hot" },
    instanced: true,
    intensity: 1,
  });
  const chipMesh = place(new InstancedMesh(chipGeometry, chips.material, CHIPS.count + 1), 6);
  chipMesh.instanceMatrix.setUsage(DynamicDrawUsage);
  pose.add(chipMesh);

  /* ---- state ---------------------------------------------------------------------------- */

  const partX = new Float32Array(PART_COUNT);
  const partY = new Float32Array(PART_COUNT);
  const partSX = new Float32Array(PART_COUNT).fill(1);
  const partSY = new Float32Array(PART_COUNT).fill(1);
  const partZ = new Float32Array(PART_COUNT);
  const partDraw = new Float32Array(PART_COUNT).fill(1);
  const strokeProgress = new Float32Array(strokes.strokeCount).fill(1);

  const swatch = [new Color(), new Color(), new Color(), new Color(), new Color()];
  const dotColor = new Color();
  const tint = new Color();
  const matrix = new Matrix4();

  let clock = 0;
  let step = 0;
  let gain: number = CHIP_GAIN.glow;
  let gridAlpha: number = GRID_ALPHA.glow;
  let lite = false;
  let leanX = 0;
  let leanY = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerSpeed = 0;
  let snapX = 0;
  let snapY = 0;
  let snapOn = 0;

  const applyPalette = (next: ScenePalette) => {
    paint(plate, next);
    paint(grid, next);
    paint(lines, next);
    paint(chips, next);
    // The chips carry their own token colour per instance (the commerce loop's idiom), so the
    // shader's own A/B mix must not tint them.
    chips.uniforms.uColorA.value.setRGB(1, 1, 1);
    chips.uniforms.uColorB.value.setRGB(1, 1, 1);
    plate.uniforms.uIntensity.value = PLATE_INTENSITY[next.mode];
    gridAlpha = GRID_ALPHA[next.mode];
    grid.uniforms.uAlpha.value = gridAlpha;
    lines.uniforms.uAlpha.value = LINE_ALPHA[next.mode];
    gain = CHIP_GAIN[next.mode];
    // Five tokens off the scene's own roles: a blue → cyan ramp with the red accent last.
    toColor(next.blue, swatch[0]);
    toColor(next.blue, swatch[1]).lerp(toColor(next.cyan, tint), 0.5);
    toColor(next.cyan, swatch[2]);
    toColor(next.cyan, swatch[3]).lerp(toColor(next.hot, tint), 0.4);
    toColor(next.red, swatch[4]);
    toColor(next.red, dotColor);
  };
  applyPalette(palette);

  /**
   * Chip k shows token (k + step) and crosses to (k + step + 1) at the bottom of its own dip,
   * so the rail re-inks left to right and the loop's wrap lands on the colour it ended on.
   * Written only while the rail is re-inking (or when the theme changed under it).
   */
  const chipMix = (k: number, t: number) =>
    smoothstep(0.35, 0.8, clamp01((t - (BEAT.chipFrom + k * BEAT.chipStep)) / BEAT.chipSpan));

  const writeChipColors = (t: number) => {
    for (let k = 0; k < CHIPS.count; k += 1) {
      const from = swatch[(k + step) % CHIPS.count];
      const to = swatch[(k + step + 1) % CHIPS.count];
      tint.copy(from).lerp(to, chipMix(k, t)).multiplyScalar(gain);
      chipMesh.setColorAt(k, tint);
    }
    tint.copy(dotColor).multiplyScalar(gain);
    chipMesh.setColorAt(CHIPS.count, tint);
    if (chipMesh.instanceColor) chipMesh.instanceColor.needsUpdate = true;
  };
  /** The window in which any chip is mid-crossing. */
  const reinking = (t: number) =>
    t >= BEAT.chipFrom && t <= BEAT.chipFrom + (CHIPS.count - 1) * BEAT.chipStep + BEAT.chipSpan;

  const writeChipMatrices = (t: number) => {
    for (let k = 0; k < CHIPS.count; k += 1) {
      // A token re-inks itself: the chip dips and comes back as its new colour lands.
      const u = clamp01((t - (BEAT.chipFrom + k * BEAT.chipStep)) / BEAT.chipSpan);
      const dip = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
      const size = CHIPS.size * (1 - 0.34 * dip);
      matrix.makeScale(size, size, BOARD.thick);
      matrix.setPosition(CHIPS.x + k * CHIPS.pitch, CHIPS.y, LAYER.chip);
      chipMesh.setMatrixAt(k, matrix);
    }
    matrix.makeScale(DOT.size, DOT.size, BOARD.thick);
    matrix.setPosition(DOT.x, DOT.y, LAYER.mark + 0.01);
    chipMesh.setMatrixAt(CHIPS.count, matrix);
    chipMesh.instanceMatrix.needsUpdate = true;
  };

  const writeGrid = (narrow: number) => {
    let o = 0;
    const put = (ax: number, ay: number, bx: number, by: number) => {
      gridPositions[o] = ax;
      gridPositions[o + 1] = ay;
      gridPositions[o + 2] = LAYER.grid;
      gridPositions[o + 3] = bx;
      gridPositions[o + 4] = by;
      gridPositions[o + 5] = LAYER.grid;
      o += 6;
    };
    const phoneHalf = PHONE.h / 2 - 0.05;
    const phoneHalfW = PHONE.w / 2 - 0.05;
    for (let i = 0; i < columns; i += 1) {
      const kept = i % keepEvery === 0;
      const to = PHONE.x + ((i / (columns - 1)) * 2 - 1) * phoneHalfW;
      const x = kept ? baseColumnX[i] + (to - baseColumnX[i]) * narrow : baseColumnX[i];
      const half = kept ? CONTENT.y + (phoneHalf - CONTENT.y) * narrow : CONTENT.y * (1 - narrow);
      columnX[i] = x;
      columnHalf[i] = half;
      // A column the narrow grid has dropped closes like a shutter and is then clipped away —
      // never left as a degenerate segment the driver could rasterise as a stray pixel.
      if (half < 0.004) put(HIDDEN, HIDDEN, HIDDEN, HIDDEN);
      else put(x, -half, x, half);
    }
    const left = -CONTENT.x + (PHONE.x - phoneHalfW + CONTENT.x) * narrow;
    const right = CONTENT.x + (PHONE.x + phoneHalfW - CONTENT.x) * narrow;
    for (let j = 0; j < rows; j += 1) {
      const y = baseRowY[j] * (1 + (phoneHalf / CONTENT.y - 1) * narrow);
      rowY[j] = y;
      put(left, y, right, y);
    }
    // Crop marks: they belong to the artboard, not to the layout, so they never move.
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      put(sx * CONTENT.x - sx * BRACKET, sy * CONTENT.y, sx * CONTENT.x, sy * CONTENT.y);
      put(sx * CONTENT.x, sy * CONTENT.y, sx * CONTENT.x, sy * CONTENT.y - sy * BRACKET);
    }
    gridAttribute.needsUpdate = true;
  };

  const writeLines = () => {
    for (let k = 0; k < strokes.strokeCount; k += 1) {
      if (strokes.strokeHeld[k]) {
        strokeProgress[k] = 1;
        continue;
      }
      const t0 = strokes.strokeWindow[k * 2];
      const t1 = strokes.strokeWindow[k * 2 + 1];
      strokeProgress[k] = clamp01((partDraw[strokes.strokePart[k]] - t0) / Math.max(1e-3, t1 - t0));
    }
    const out = strokes.positions;
    for (let i = 0; i < strokes.segCount; i += 1) {
      const part = strokes.segPart[i];
      const ox = partX[part];
      const oy = partY[part];
      const sx = partSX[part];
      const sy = partSY[part];
      const oz = partZ[part];
      const ax = ox + strokes.segA[i * 4] * sx;
      const ay = oy + strokes.segA[i * 4 + 1] * sy;
      let bx = ox + strokes.segA[i * 4 + 2] * sx;
      let by = oy + strokes.segA[i * 4 + 3] * sy;
      const az = oz + strokes.segZ[i * 2];
      let bz = oz + strokes.segZ[i * 2 + 1];
      const p = strokeProgress[strokes.segStroke[i]];
      const s0 = strokes.segS[i * 2];
      const s1 = strokes.segS[i * 2 + 1];
      if (p <= s0) {
        // Not drawn yet: parked far beyond the far plane, so it is clipped rather than left as
        // a degenerate segment the driver might rasterise as a stray pixel.
        out[i * 6] = HIDDEN;
        out[i * 6 + 1] = HIDDEN;
        out[i * 6 + 2] = HIDDEN;
        out[i * 6 + 3] = HIDDEN;
        out[i * 6 + 4] = HIDDEN;
        out[i * 6 + 5] = HIDDEN;
        continue;
      }
      if (p < s1) {
        const f = (p - s0) / (s1 - s0);
        bx = ax + (bx - ax) * f;
        by = ay + (by - ay) * f;
        bz = az + (bz - az) * f;
      }
      out[i * 6] = ax;
      out[i * 6 + 1] = ay;
      out[i * 6 + 2] = az;
      out[i * 6 + 3] = bx;
      out[i * 6 + 4] = by;
      out[i * 6 + 5] = bz;
    }
    linesAttribute.needsUpdate = true;
  };

  /** Where the pointer's snap cursor sits: the nearest crossing of two drawn grid lines. */
  let crossX = 0;
  let crossY = 0;
  const nearestCrossing = (x: number, y: number) => {
    let bestD = Infinity;
    for (let i = 0; i < columns; i += 1) {
      if (columnHalf[i] < 0.06) continue;
      const d = Math.abs(columnX[i] - x);
      if (d < bestD) {
        bestD = d;
        crossX = columnX[i];
      }
    }
    bestD = Infinity;
    for (let j = 0; j < rows; j += 1) {
      const d = Math.abs(rowY[j] - y);
      if (d < bestD) {
        bestD = d;
        crossY = rowY[j];
      }
    }
  };

  const frameState = (t: number) => {
    /* the six components, out to the phone and back */
    let flash = 0;
    for (const i of parts) {
      const outStart = BEAT.partOutFrom + OUT_ORDER[i] * BEAT.partOutStep;
      const backStart = BEAT.partBackFrom + (COMPONENTS - 1 - OUT_ORDER[i]) * BEAT.partBackStep;
      let n = 0;
      let u = 1;
      if (t >= outStart && t < outStart + BEAT.partOutSpan) {
        u = (t - outStart) / BEAT.partOutSpan;
        n = easeOutCubic(u);
      } else if (t >= outStart + BEAT.partOutSpan && t < backStart) {
        n = 1;
      } else if (t >= backStart && t < backStart + BEAT.partBackSpan) {
        u = (t - backStart) / BEAT.partBackSpan;
        n = 1 - smoothstep(0, 1, u);
      } else if (t >= backStart + BEAT.partBackSpan) {
        n = 0;
      }
      const wide = WIDE[i];
      const narrow = NARROW[i];
      // The last of a move overshoots and settles: a component snapping into its column.
      const bump = u > 0.82 && u < 1 ? Math.sin(((u - 0.82) / 0.18) * Math.PI) : 0;
      const grow = 1 + 0.05 * bump;
      flash = Math.max(flash, bump);
      partX[i] = wide[0] + (narrow[0] - wide[0]) * n;
      partY[i] = wide[1] + (narrow[1] - wide[1]) * n;
      partSX[i] = (wide[2] + (narrow[2] - wide[2]) * n) * grow;
      partSY[i] = (wide[3] + (narrow[3] - wide[3]) * n) * grow;
      // It travels on an arc, out of the board and back down onto it.
      partZ[i] = LAYER.part + Math.sin(Math.PI * n) * 0.32;
      partDraw[i] = u >= 1 ? 1 : clamp01((u - 0.5) / 0.35);
    }

    /**
     * The wordmark: the print on the board never moves; its lifted copy is re-written by the
     * pen in the loop's last beat, finishing exactly on the wrap — so the composed pose at
     * t = 0 is the mark standing, lifted and tied, and nothing ever blanks mid-loop.
     */
    partZ[PART.markFlat] = 0;
    partZ[PART.markLift] = LAYER.lift;
    partDraw[PART.markLift] = t < BEAT.liftFrom ? 1 : clamp01((t - BEAT.liftFrom) / BEAT.liftSpan);
    partDraw[PART.ties] = t < BEAT.tieFrom ? 1 : clamp01((t - BEAT.tieFrom) / BEAT.tieSpan);

    /* the phone frame draws on behind the rule and un-draws as the rule leaves */
    partDraw[PART.phone] =
      clamp01((t - BEAT.frameFrom) / BEAT.frameSpan) *
      (1 - smoothstep(BEAT.ruleBackFrom, BEAT.ruleBackFrom + 0.3, t));

    /* the breakpoint rule: in from the right edge, parking as the phone's own left side */
    let ruleX: number = RULE.rest;
    let ruleOn = 0;
    if (t >= BEAT.ruleOutFrom && t < BEAT.ruleOutFrom + BEAT.ruleOutSpan) {
      const u = (t - BEAT.ruleOutFrom) / BEAT.ruleOutSpan;
      ruleX = RULE.rest + (RULE.park - RULE.rest) * easeOutCubic(u);
      ruleOn = smoothstep(0, 0.18, u);
    } else if (t >= BEAT.ruleOutFrom + BEAT.ruleOutSpan && t < BEAT.ruleBackFrom) {
      ruleX = RULE.park;
      ruleOn = 1;
    } else if (t >= BEAT.ruleBackFrom && t < BEAT.ruleBackFrom + BEAT.ruleBackSpan) {
      const u = (t - BEAT.ruleBackFrom) / BEAT.ruleBackSpan;
      ruleX = RULE.park + (RULE.rest - RULE.park) * smoothstep(0, 1, u);
      ruleOn = 1 - smoothstep(0.65, 1, u);
    }
    const parked = clamp01((RULE.rest - ruleX) / (RULE.rest - RULE.park));
    const ruleHalf = (RULE.tall + (RULE.short - RULE.tall) * parked) * ruleOn;
    partX[PART.rule] = ruleX;
    partY[PART.rule] = 0;
    partSY[PART.rule] = ruleHalf;
    partZ[PART.rule] = 0;
    partDraw[PART.rule] = ruleOn;
    partDraw[PART.nib] = ruleOn;

    /* the nib rides the rule's head, then scans down the phone while it stands */
    const scan = clamp01((t - BEAT.nibFrom) / BEAT.nibSpan);
    const scanning = t >= BEAT.nibFrom && t < BEAT.nibFrom + BEAT.nibSpan;
    partX[PART.nib] = ruleX;
    partY[PART.nib] = scanning ? ruleHalf - smoothstep(0, 1, scan) * ruleHalf * 2 : ruleHalf;
    partZ[PART.nib] = 0;

    return flash;
  };

  const composePose = () => {
    frameState(0);
    writeGrid(0);
    writeLines();
    writeChipMatrices(0);
    writeChipColors(0);
  };
  composePose();
  let wasReinking = true;

  return {
    kind: "mesh-wave",
    group,
    objects: [group],

    resetCycle() {
      // Back to the composed pose — which is also frame 0 of the loop, so nothing ever blanks.
      clock = 0;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const dt = Number.isFinite(frame.step) && frame.step > 0 ? frame.step : 0;
      clock += dt;
      if (clock >= LOOP) {
        clock %= LOOP;
        step = (step + 1) % CHIPS.count;
      }
      const t = clock;

      const flash = frameState(t);
      const narrow = clamp01(
        smoothstep(BEAT.gridOutFrom, BEAT.gridOutTo, t) - smoothstep(BEAT.gridBackFrom, BEAT.gridBackTo, t),
      );

      /* the pointer: a damped lean of the board's own, and a snapping designer's cursor */
      const px = Math.max(-CONTENT.x, Math.min(CONTENT.x, frame.tx * 1.55));
      const py = Math.max(-CONTENT.y, Math.min(CONTENT.y, -frame.ty * 0.95));
      const moved = dt > 0 ? (Math.abs(px - pointerX) + Math.abs(py - pointerY)) / dt : 0;
      pointerX = px;
      pointerY = py;
      pointerSpeed = damp(pointerSpeed, moved, 6, dt);
      nearestCrossing(px, py);
      snapX = damp(snapX, crossX, 14, dt);
      snapY = damp(snapY, crossY, 14, dt);
      snapOn = damp(snapOn, pointerSpeed < 0.45 && (frame.tx !== 0 || frame.ty !== 0) ? 1 : 0, 6, dt);
      partX[PART.snap] = snapX;
      partY[PART.snap] = snapY;
      partZ[PART.snap] = 0;
      partDraw[PART.snap] = snapOn;
      leanX = damp(leanX, frame.tx, 5, dt);
      leanY = damp(leanY, frame.ty, 5, dt);

      writeGrid(narrow);
      writeLines();
      writeChipMatrices(t);

      /* the live repaint: one uniform for every stroke on the board, five colours for the rail */
      const mix = smoothstep(BEAT.repaintFrom, BEAT.repaintTo, t);
      lines.uniforms.uTime.value = ((step + mix) * TAU) / CHIPS.count;
      const busy = reinking(t);
      if (busy || wasReinking) writeChipColors(t);
      wasReinking = busy;

      const breath = 1 + 0.06 * Math.sin(frame.time * 1.2);
      grid.uniforms.uAlpha.value = gridAlpha * breath;
      grid.uniforms.uTime.value = frame.time;
      grid.uniforms.uReveal.value = frame.reveal;
      lines.uniforms.uIntensity.value = 1 + 0.14 * flash;
      lines.uniforms.uReveal.value = frame.reveal;
      plate.uniforms.uReveal.value = frame.reveal;
      plate.uniforms.uTime.value = frame.time;
      chips.uniforms.uReveal.value = frame.reveal;
      chips.uniforms.uTime.value = frame.time;
      chips.uniforms.uPulse.value = flash;

      // The world sways every model 0.42 rad about y; a board carrying type keeps 0.16 of it.
      const sway = Math.sin(frame.time * MODEL_SWAY.speed) * MODEL_SWAY.amplitude;
      pose.rotation.set(
        BOARD_POSE[0] - leanY * 0.05,
        BOARD_POSE[1] - sway * SWAY_DAMPEN + leanX * 0.06,
        BOARD_POSE[2],
      );
    },

    setLite(next) {
      lite = next;
      // The plate is the only fill-rate on the board; the drawing itself is 1px lines.
      plateMesh.visible = !lite;
    },

    setPalette(next) {
      applyPalette(next);
      writeChipColors(clock);
    },

    dispose() {
      plateGeometry.dispose();
      gridGeometry.dispose();
      linesGeometry.dispose();
      chipGeometry.dispose();
      plate.material.dispose();
      grid.material.dispose();
      lines.material.dispose();
      chips.material.dispose();
      chipMesh.dispose();
    },
  };
}
