/**
 * The Work helix's geometry as pure arithmetic — its strands, the chips riding them and the base
 * pairs — shared by the model (three/models/helix.ts), which must draw exactly these, and the unit
 * tests. Seeded and three.js-free.
 *
 * (This file used to hold every model's morph-swarm samples too; the swarm, the hero chip and
 * the service models went with the 2026-10-28 cut to a Work-only scene, and the helix's slot of
 * the swarm with them: nothing lands on the helix any more, it synthesises itself.)
 */

import { HELIX, type Vec3 } from "@/components/art/shapes";

const TAU = Math.PI * 2;

const normalize3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/* ---- the Work helix ------------------------------------------------------------------------ */

/**
 * The helix's parts in `HELIX` units: the strands' tube radius; a chip's box (length along its
 * strand, width across it, thickness out from the axis) and how far outside the strand's centre
 * line it sits; a rung's half starts `inset` inside its strand and ends on a square node outline
 * of half-size `node`, whose inner side stops `gap` short of the axis (the gap between a base
 * pair's two nodes is twice that).
 */
export const HELIX_PARTS = {
  tube: 0.012,
  chip: { length: 0.16, width: 0.09, thickness: 0.03, lift: 0.02 },
  inset: 0.02,
  node: 0.03,
  gap: 0.05,
} as const;

/**
 * Strand `strand` (0 = A; 1 = B, half a turn on) at share `t` ∈ [0, 1] of its length, from the
 * bottom. Right-handed, like DNA: turning the helix by −angle about y reads as the strands
 * climbing, the way the cards do.
 */
export function helixStrandPoint(strand: number, t: number): Vec3 {
  const a = TAU * HELIX.turns * t + strand * Math.PI;
  return [HELIX.radius * Math.sin(a), (t - 0.5) * HELIX.height, HELIX.radius * Math.cos(a)];
}

/** Unit tangent of a strand at `t`, pointing up it. */
export function helixStrandTangent(strand: number, t: number): Vec3 {
  const w = TAU * HELIX.turns;
  const a = w * t + strand * Math.PI;
  return normalize3([HELIX.radius * w * Math.cos(a), HELIX.height, -HELIX.radius * w * Math.sin(a)]);
}

export type HelixChip = {
  strand: 0 | 1;
  /** Share of its strand's length. */
  t: number;
  centre: Vec3;
  /** The box's axes (right-handed): along the strand (length), across it (width), out from the axis (thickness). */
  along: Vec3;
  across: Vec3;
  out: Vec3;
};

/** `count` chips shared by the two strands (A takes an odd one), evenly along each, B's half a spacing on. */
export function helixChips(count: number): HelixChip[] {
  const n = Math.max(0, Math.floor(count));
  const out: HelixChip[] = [];
  for (const strand of [0, 1] as const) {
    const m = strand === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
    for (let i = 0; i < m; i += 1) {
      const t = (i + 0.25 + 0.5 * strand) / m;
      const p = helixStrandPoint(strand, t);
      const along = helixStrandTangent(strand, t);
      const radial = normalize3([p[0], 0, p[2]]);
      const lift = HELIX_PARTS.chip.lift;
      out.push({
        strand,
        t,
        centre: [p[0] + radial[0] * lift, p[1], p[2] + radial[2] * lift],
        along,
        across: cross3(radial, along),
        out: radial,
      });
    }
  }
  return out;
}

export type HelixSegment = { a: Vec3; b: Vec3 };

export type HelixRung = {
  /** Share of the height (both strands' `t`). */
  t: number;
  /** A's half then B's: a line from inside the strand to its node, and the node square's four sides. */
  halves: ReadonlyArray<{ strand: 0 | 1; line: HelixSegment; node: readonly HelixSegment[] }>;
};

/** `count` base pairs, evenly up the helix: each joins A and B across the axis, broken by a gap. */
export function helixRungs(count: number): HelixRung[] {
  const n = Math.max(0, Math.floor(count));
  const { inset, node, gap } = HELIX_PARTS;
  return Array.from({ length: n }, (_, r) => {
    const t = (r + 0.5) / n;
    const y = (t - 0.5) * HELIX.height;
    const halves = ([0, 1] as const).map((strand) => {
      const a = TAU * HELIX.turns * t + strand * Math.PI;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      // A point `radius` out from the axis towards this strand, `up` above the rung.
      const at = (radius: number, up = 0): Vec3 => [dx * radius, y + up, dz * radius];
      const inner = gap;
      const outer = gap + 2 * node;
      const corners = [at(inner, -node), at(outer, -node), at(outer, node), at(inner, node)];
      return {
        strand,
        line: { a: at(HELIX.radius - inset), b: at(outer) },
        node: corners.map((corner, k) => ({ a: corner, b: corners[(k + 1) % 4] })),
      };
    });
    return { t, halves };
  });
}
