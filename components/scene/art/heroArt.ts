/**
 * The hero core illustration's geometry: SVG path data for HeroCoreArt, computed once at
 * module scope from the same shapes the WebGL chip is built from (components/scene/shapes.ts),
 * so the crossfade from art to canvas lands on the same silhouette.
 *
 * Pure and deterministic (no randomness): imported by a server component, never by client
 * code. Every path is written in the chip's own plane (x right, y up, integer art units where
 * the shape allows, `CHIP.R` → 95 units) and drawn through one `<g transform=CHIP_ART_MATRIX>`:
 * a plane turned by `CHIP_POSE` and projected orthographically is a linear map, so that one
 * matrix lands every point exactly where the WebGL chip puts it. Height above the board (the
 * stacked substrate, heat spreader and die) becomes an in-plane offset, `chipLift`. The art's
 * view box is -100…100 on both axes, y down.
 *
 * Each path opens with one `M`, then relative commands only (`h`, `v`, `l`, `m`, `z`): the art
 * ships twice in the home page's HTML (the markup and the RSC payload of the hero's slot), and
 * small integers repeat well under gzip. Nothing here is round: pins, vias and the wave are
 * squares and rectangles, packets are straight streaks on the traces.
 */

import { CHIP, CHIP_POSE, chipPins, chipTraces, projectOrtho, type Vec3 } from "@/components/scene/shapes";

export const ART_VIEWBOX = "-100 -100 200 200";

/** Art units per scene unit. */
export const ART_SCALE = 95 / CHIP.R;

/** Traces per side, the WebGL chip's mid tier. */
export const CHIP_ART_TRACES = 5;

/**
 * Shortest packet streak ON SCREEN, in art units — measured after the projection, which
 * shortens a run by up to cos(pose tilt). At least 3× the widest packet stroke at phone size.
 */
export const PARTICLE_MIN_LENGTH = 6;

/** Half the glow square in the chip plane; the radial gradient fades to nothing at its edge. */
export const GLOW_HALF = 66;
/** Half the boost wave's square, just outside the heat spreader; it scales out ×2.3. */
export const WAVE_HALF = 28;

/**
 * A three.js Euler XYZ rotation on a point: R = Rx(a)·Ry(b)·Rz(c), so z turns first. The
 * WebGL chip's group takes `CHIP_POSE` as exactly this rotation.
 */
export function rotateEulerXYZ(p: Vec3, tilt: readonly [number, number, number]): Vec3 {
  const [a, b, c] = tilt;
  const [x0, y0, z0] = p;
  const x1 = x0 * Math.cos(c) - y0 * Math.sin(c);
  const y1 = x0 * Math.sin(c) + y0 * Math.cos(c);
  const x2 = x1 * Math.cos(b) + z0 * Math.sin(b);
  const z2 = -x1 * Math.sin(b) + z0 * Math.cos(b);
  const y3 = y1 * Math.cos(a) - z2 * Math.sin(a);
  const z3 = y1 * Math.sin(a) + z2 * Math.cos(a);
  return [x2, y3, z3];
}

/* ---- the projection ------------------------------------------------------------------- */

/** A chip-space direction on screen: posed, then `projectOrtho` (already y DOWN). */
const onScreen = (p: Vec3) => projectOrtho(rotateEulerXYZ(p, CHIP_POSE), 0, 0, 1);
const EX = onScreen([1, 0, 0]);
const EY = onScreen([0, 1, 0]);
const EZ = onScreen([0, 0, 1]);

/** Three decimals, never `-0`: at most 0.05 units of error at the art's edge. */
const f3 = (v: number) => String(Math.round(v * 1000) / 1000 + 0);

/**
 * Chip plane → SVG. The paths keep the chip's y UP and `projectOrtho` already returns y down,
 * so the columns are the projected basis as is: `matrix(ex.x ex.y ey.x ey.y 0 0)`.
 */
export const CHIP_ART_MATRIX = `matrix(${f3(EX[0])} ${f3(EX[1])} ${f3(EY[0])} ${f3(EY[1])} 0 0)`;

const DET = EX[0] * EY[1] - EX[1] * EY[0];

/**
 * The in-plane offset (art units) that looks, through the matrix, like rising `z` scene units
 * off the board: the projected z axis carried back through the matrix's inverse.
 */
export function chipLift(z: number): [number, number] {
  const k = z * ART_SCALE;
  return [((EY[1] * EZ[0] - EY[0] * EZ[1]) / DET) * k, ((EX[0] * EZ[1] - EX[1] * EZ[0]) / DET) * k];
}

/* ---- path writing ------------------------------------------------------------------------ */

type Pt = readonly [number, number];
type Sub = { pts: Pt[]; closed?: boolean };

/** At most one decimal, never `-0`. */
const num = (v: number) => String(Math.round(v * 10) / 10 + 0);
/** Numbers joined the short way: no space before a minus sign. */
const nums = (...vs: number[]) => vs.map(num).reduce((s, n) => (s && !n.startsWith("-") ? `${s} ${n}` : s + n), "");

/**
 * Subpaths as one relative path: the first starts with `M`, the rest move with `m` from the
 * current point (a closed subpath's start). Runs are `h`/`v` when axis-aligned, `l` otherwise;
 * zero-length runs are dropped.
 */
function toPath(subs: Sub[]): string {
  let d = "";
  let cur: Pt | null = null;
  for (const { pts, closed } of subs) {
    const [start, ...rest] = pts;
    d += cur ? `m${nums(start[0] - cur[0], start[1] - cur[1])}` : `M${nums(start[0], start[1])}`;
    let at = start;
    for (const p of rest) {
      const dx = Math.round((p[0] - at[0]) * 10) / 10;
      const dy = Math.round((p[1] - at[1]) * 10) / 10;
      if (dx === 0 && dy === 0) continue;
      d += dy === 0 ? `h${nums(dx)}` : dx === 0 ? `v${nums(dy)}` : `l${nums(dx, dy)}`;
      at = p;
    }
    if (closed) d += "z";
    cur = closed ? start : at;
  }
  return d;
}

const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
/** A lift rounded to whole units, like every corner it moves. */
const liftAt = (z: number): Pt => chipLift(z).map(Math.round) as [number, number];
/** An axis-aligned square of half-size `h` around `c`, closed. */
const square = (c: Pt, h: number): Sub => ({
  pts: [add(c, [-h, -h]), add(c, [h, -h]), add(c, [h, h]), add(c, [-h, h])],
  closed: true,
});

/* ---- the chip ------------------------------------------------------------------------------ */

export type ChipArtPaths = {
  /** Substrate and heat spreader: the visible bottom edges, the corner risers, the top faces
   *  and the spreader's bevel. */
  pkg: string;
  /** The die's top face, closed (filled with the die gradient). */
  die: string;
  /** The die's 3×3 grid and the pin-1 notch on the spreader's corner. */
  grid: string;
  /** Pins as closed rectangles, `CHIP_ART_TRACES` per side, in `chipPins` order. */
  pins: string;
  /** Board traces, in `chipTraces` order; every run is h, v or 45°. */
  traces: string;
  /** A square via pad at the end of every trace. */
  vias: string;
  /** Eight packet streaks, each lying on one trace run. */
  packets: string;
};

/** Tops of the stacked slabs, from the board up: the substrate's underside is the board's
 *  plane (z = 0), where the traces and pins lie. */
const Z_PKG = CHIP.thick.pkg;
const Z_IHS = Z_PKG + CHIP.thick.ihs;
const Z_DIE = Z_IHS + CHIP.thick.die;

/**
 * One trace in whole art units, keeping every run h, v or exactly 45°: an axis run lands on
 * the rounded target, a diagonal run takes the whole step closest to it on both axes.
 */
function traceToArt(trace: ReadonlyArray<readonly [number, number]>): Pt[] {
  const out: Pt[] = [[Math.round(trace[0][0] * ART_SCALE), Math.round(trace[0][1] * ART_SCALE)]];
  for (let k = 1; k < trace.length; k += 1) {
    const [x, y] = out[out.length - 1];
    const tx = trace[k][0] * ART_SCALE;
    const ty = trace[k][1] * ART_SCALE;
    const dx = trace[k][0] - trace[k - 1][0];
    const dy = trace[k][1] - trace[k - 1][1];
    let next: Pt;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
    if (Math.abs(dx) < 1e-9) next = [x, Math.round(ty)];
    else if (Math.abs(dy) < 1e-9) next = [Math.round(tx), y];
    else {
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      const step = Math.round(((tx - x) * sx + (ty - y) * sy) / 2);
      next = [x + sx * step, y + sy * step];
    }
    if (next[0] !== x || next[1] !== y) out.push(next);
  }
  return out;
}

/**
 * The packets: `[trace, run, from, length]` — a streak `length` art units long (per axis on a
 * 45° run), starting `from` units into that run of the art trace. Two per side, spread over
 * the first runs, the chamfers and the outer runs, so the board reads as busy, not patterned.
 */
const PACKETS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1, 2, 5, 8],
  [4, 0, 2, 8],
  [8, 1, 0, 6],
  [5, 0, 3, 8],
  [12, 1, 9, 8],
  [10, 1, 5, 6],
  [18, 2, 8, 8],
  [16, 0, 3, 8],
];

function buildChipArt(): ChipArtPaths {
  const P = Math.round(CHIP.pkg * ART_SCALE);
  const I = Math.round(CHIP.ihs * ART_SCALE);
  const D = Math.round(CHIP.die * ART_SCALE);
  const lp = liftAt(Z_PKG);
  const li = liftAt(Z_IHS);
  const ld = liftAt(Z_DIE);

  /** A slab of half-size `h` from lift `lo` to `hi`: the two bottom edges facing the viewer
   *  (chip -x and -y), the three corner risers in view and the top face. */
  const slab = (h: number, lo: Pt, hi: Pt): Sub[] => [
    { pts: [add(lo, [-h, h]), add(lo, [-h, -h]), add(lo, [h, -h])] },
    { pts: [add(lo, [-h, h]), add(hi, [-h, h])] },
    { pts: [add(lo, [-h, -h]), add(hi, [-h, -h])] },
    { pts: [add(lo, [h, -h]), add(hi, [h, -h])] },
    square(hi, h),
  ];

  const pkg = toPath([...slab(P, [0, 0], lp), ...slab(I, lp, li), square(li, I - 4)]);

  const die = toPath([square(ld, D)]);

  const third = Math.round(D / 3);
  const notch = 7;
  const grid = toPath([
    { pts: [add(ld, [-third, -D]), add(ld, [-third, D])] },
    { pts: [add(ld, [third, -D]), add(ld, [third, D])] },
    { pts: [add(ld, [-D, -third]), add(ld, [D, -third])] },
    { pts: [add(ld, [-D, third]), add(ld, [D, third])] },
    { pts: [add(li, [-I, I - notch]), add(li, [-I + notch, I])] },
  ]);

  const pins = toPath(
    chipPins(CHIP_ART_TRACES).map(({ center, size }) => {
      const w = Math.round(size[0] * ART_SCALE);
      const h = Math.round(size[1] * ART_SCALE);
      const x = Math.round((center[0] * ART_SCALE - w / 2) * 2) / 2;
      const y = Math.round((center[1] * ART_SCALE - h / 2) * 2) / 2;
      return { pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed: true };
    }),
  );

  const art = chipTraces(CHIP_ART_TRACES).map(traceToArt);
  const traces = toPath(art.map((pts) => ({ pts })));

  const V = Math.round(CHIP.via * ART_SCALE);
  const vias = toPath(art.map((pts) => square(pts[pts.length - 1], V)));

  const packets = toPath(
    PACKETS.map(([t, r, from, length]) => {
      const a = art[t][r];
      const b = art[t][r + 1];
      const sx = Math.sign(b[0] - a[0]);
      const sy = Math.sign(b[1] - a[1]);
      const start: Pt = [a[0] + sx * from, a[1] + sy * from];
      return { pts: [start, [start[0] + sx * length, start[1] + sy * length]] };
    }),
  );

  return { pkg, die, grid, pins, traces, vias, packets };
}

export const CHIP_ART: ChipArtPaths = buildChipArt();
