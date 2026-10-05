/**
 * Where each project's pixel sits on /portofoliu (components/sections/Portfolio.tsx).
 *
 * Scattered, not gridded: the owner wanted the pixels "haotic", like real pixels, with no matrix
 * showing behind them (2026-10-03). A position is a point anywhere in the field, as percentages
 * of its width and height, so nothing lines up.
 *
 * Deterministic all the same — a hash of the project id picks the point — so a project lights the
 * same spot on every load and on the server, and one the admin adds takes a free spot without
 * moving anyone placed before it.
 *
 * Two rules keep the pointer honest. Two pixels stay `minGap` px apart (the visual spacing), and
 * their hit squares — `target` px a side, wider than the pixel — never overlap: two squares are
 * apart when they are apart on EITHER axis, so that is a per-axis check, not a distance (a 56px
 * distance still let two 44px squares touch along the diagonal). Both are measured on the band's
 * nominal field, the SMALLEST real one, so a wider screen only spreads the pixels further.
 * When a project finds no spot, the gaps shrink 10% at a time and the search goes on — so placing
 * always ends; past half the gap the field's avoided corner is given up too.
 */

export type ScatterField = {
  /** The field's nominal size in CSS px for this width band — its smallest real size. */
  width: number;
  height: number;
  /** The smallest distance between two pixel centres, in px. */
  minGap: number;
  /** A pixel's hit square, in px a side: no two may overlap. */
  target: number;
  /** % of the width and of the height kept clear at each edge — a hit square stays inside. */
  margin: number;
  /** A corner kept empty: no pixel right of `x`% AND below `y`% (the corner assistant's box). */
  avoid?: { x: number; y: number };
};
export type ScatterPoint = { x: number; y: number };

/**
 * One field per width band — ≥1025px, 641–1024px, ≤640px (docs/07 breakpoints). The phone one
 * is a 320px screen's (288px wide) and grows taller with the portfolio (`narrowField`).
 *
 * `avoid`: from 861px the HUD assistant is a fixed 184px card 20px from the window's bottom-right
 * corner (components/hud/guide). At scroll 0 it covers the field's bottom-right corner on common
 * laptop and tablet windows (1280×800: from 86% across and 72% down; 1024×900: 83% / 81%), where
 * a pixel could be neither seen nor pointed at. Down to 50% since the service filter (2026-10-04):
 * where its row does not fit beside the title (below ~1240px) it pushes the field ~48px lower,
 * and the card then reaches higher up the field (1024×768: from ~56% down). Lowering it moved no
 * live pixel — the nine ids scatter identically for any value from 62 down to 30.
 */
export const PORTFOLIO_FIELDS = {
  // 1025px window less two 40px gutters; the field is never shorter than 440px
  wide: { width: 945, height: 440, minGap: 96, target: 40, margin: 5, avoid: { x: 78, y: 50 } },
  // 641px window less two ~26px gutters
  mid: { width: 590, height: 440, minGap: 84, target: 40, margin: 5, avoid: { x: 78, y: 50 } },
  // 320px window less two 16px gutters
  narrow: { width: 288, height: 300, minGap: 56, target: 44, margin: 8 },
} as const satisfies Record<string, ScatterField>;

/** How much taller the phone field gets per project, so every one keeps its room. */
export const NARROW_PX_PER_PROJECT = 34;

/** The phone field for `count` projects: never shorter than the smallest phone's, and taller as
 *  the portfolio grows. Portfolio.module.css sizes the real field by the same rule. */
export function narrowField(count: number): ScatterField {
  const base = PORTFOLIO_FIELDS.narrow;
  return { ...base, height: Math.max(base.height, count * NARROW_PX_PER_PROJECT) };
}

/** Candidates tried per pixel before the gaps are relaxed. */
const ATTEMPTS = 300;

/** FNV-1a, 32-bit. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

/** xorshift32: the next candidate after `h`. */
function next(h: number): number {
  let x = h;
  x ^= x << 13;
  x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0 || 1;
}

/** The points for `ids` (in order) on `field`, as `{ x, y }` percentages of its width and height. */
export function scatterPixels(ids: readonly string[], field: ScatterField): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  const span = 100 - 2 * field.margin;
  for (const id of ids) {
    let h = hash(`${id}:${field.width}`);
    let relax = 1;
    let found: ScatterPoint | null = null;
    while (!found) {
      const gap = field.minGap * relax;
      const apart = (field.target + 2) * relax;
      const avoid = relax > 0.5 ? field.avoid : undefined;
      for (let attempt = 0; attempt < ATTEMPTS && !found; attempt += 1) {
        const x = field.margin + ((h & 0xffff) / 0xffff) * span;
        const y = field.margin + ((h >>> 16) / 0xffff) * span;
        h = next(h);
        if (avoid && x > avoid.x && y > avoid.y) continue;
        const clear = points.every((p) => {
          const dx = Math.abs(((p.x - x) / 100) * field.width);
          const dy = Math.abs(((p.y - y) / 100) * field.height);
          return dx * dx + dy * dy >= gap * gap && (dx >= apart || dy >= apart);
        });
        if (clear) found = { x, y };
      }
      relax *= 0.9;
    }
    points.push(found);
  }
  return points;
}
