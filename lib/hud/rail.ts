/**
 * The fibre rail's maths (components/hud/rail/ScrollRail.tsx): where each section's marker sits
 * along the rail, how far the lit thread has filled, which marker is current, which ticks pulse
 * on a downward scroll, where a jump lands, and which headings name a page's sections.
 *
 * Pure: no imports, no DOM, no clock. The component measures (section boxes, the page's scroll
 * range, the fibre's height, the header token) and feeds plain numbers and descriptors in here.
 *
 * One vocabulary throughout:
 *   - `max` is the page's scroll range (`scrollHeight - innerHeight`), `y` a scroll position;
 *   - a section's TARGET is the scroll position a jump to it lands on (`sectionTarget`): its
 *     document top minus the sticky header, inside [0, max];
 *   - a section is PASSED once `y` reaches its target, within `RAIL_EPSILON` (a smooth scroll can
 *     stop a fraction of a pixel short). `activeIndex` is the last passed section, and a downward
 *     scroll pulses exactly the ticks it turns from not passed into passed (`crossedDown`).
 */

/** The smallest distance between two markers along the rail: one 44px hit area each. */
export const RAIL_MIN_GAP = 44;

/** More discovered sections than this and the rail draws the fibre only, with no `<nav>`. */
export const RAIL_MAX_MARKERS = 8;

/** A discovered heading's label is clipped to this many characters (the ellipsis included). */
export const RAIL_LABEL_MAX = 60;

/** How far short of a target a scroll may stop and still count as having reached it (px). */
export const RAIL_EPSILON = 1;

const finiteOr = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

/** Scroll progress 0 → 1 over `max`, clamped. A page that cannot scroll (max ≤ 0) is at 0. */
export function progressOf(y: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(max)) return 0;
  return Math.min(1, Math.max(0, finiteOr(y, 0) / max));
}

/**
 * The scroll position a jump to a section lands on: its document top less the sticky header,
 * so the section starts right under the header — never above 0 and never past the end.
 */
export function sectionTarget(docTop: number, headerH: number, max: number): number {
  const end = Number.isFinite(max) && max > 0 ? max : 0;
  const top = finiteOr(docTop, 0) - finiteOr(headerH, 0);
  return Math.min(end, Math.max(0, top));
}

/**
 * Marker positions (px from the rail's top) for sections whose targets are `targets`:
 * proportional to each target's progress, so a tick sits where the lit thread ends when the
 * page is scrolled to that section; then spaced at least `minGap` apart, pushed forward from
 * the first and back from the end so every marker stays inside [0, railPx].
 *
 * When the rail is too short to hold them all `minGap` apart, the markers spread evenly over
 * the rail instead (a single marker sits at 0). Rounded to whole pixels. No targets, or a rail
 * with no height (not laid out, hidden), gives no positions.
 */
export function railLayout(
  targets: readonly number[],
  max: number,
  railPx: number,
  minGap: number = RAIL_MIN_GAP,
): number[] {
  const n = targets.length;
  if (n === 0 || !(railPx > 0) || !Number.isFinite(railPx)) return [];
  const gap = Number.isFinite(minGap) && minGap > 0 ? minGap : 0;

  const y = targets.map((target) => progressOf(target, max) * railPx);
  for (let i = 1; i < n; i++) y[i] = Math.max(y[i], y[i - 1] + gap);
  y[n - 1] = Math.min(y[n - 1], railPx);
  for (let i = n - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] - gap);

  if (y[0] < 0) {
    return targets.map((_, i) => (n === 1 ? 0 : Math.round((i * railPx) / (n - 1))));
  }
  return y.map((value) => Math.round(value));
}

/** Has a scroll position `y` reached `target`? */
const reached = (y: number, target: number) => target <= y + RAIL_EPSILON;

/**
 * The current section: the last one whose target `y` has reached. Before the first target —
 * and with no targets at all — it is the first (0).
 */
export function activeIndex(y: number, targets: readonly number[]): number {
  let active = 0;
  targets.forEach((target, i) => {
    if (reached(y, target)) active = i;
  });
  return active;
}

/**
 * The ticks a scroll from `prev` down to `next` passes: every target reached at `next` and not
 * at `prev`, in order. A single long jump returns all of them; an upward scroll (or none) none.
 */
export function crossedDown(prev: number, next: number, targets: readonly number[]): number[] {
  if (!(next > prev)) return [];
  const crossed: number[] = [];
  targets.forEach((target, i) => {
    if (!reached(prev, target) && reached(next, target)) crossed.push(i);
  });
  return crossed;
}

/**
 * A heading's text as a marker label: the pieces (its text nodes, in order) joined by a space,
 * whitespace collapsed, no space left before punctuation ("01 Cookies", not "01Cookies" nor
 * "Cookies ."), clipped to `RAIL_LABEL_MAX` characters with an ellipsis. Counted in code
 * points, so a clip never splits a surrogate pair.
 */
export function railLabel(text: string | readonly string[]): string {
  const joined = typeof text === "string" ? text : text.join(" ");
  const clean = joined
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?…)\]])/g, "$1")
    .trim();
  const chars = Array.from(clean);
  if (chars.length <= RAIL_LABEL_MAX) return clean;
  return `${chars.slice(0, RAIL_LABEL_MAX - 1).join("").trimEnd()}…`;
}

/** One `h1`/`h2` of the page, as the component reads it off the DOM. */
export type RailHeading<S> = {
  /** Its closest `section` (inside the page's main content), or `null` when it has none. */
  section: S | null;
  /** Its text: the text nodes in order, or one string. */
  text: string | readonly string[];
  /** Inside the header, the footer, a dialog, an `aria-hidden` subtree, the guide or the rail. */
  excluded: boolean;
  /** How many `h2` its section holds. */
  sectionH2s: number;
};

/**
 * The sections a page without a curated list gets markers for, in heading order: one per
 * `section`, named by its first heading. A heading is skipped when it is excluded, has no
 * section, or sits in a section holding more than one `h2` (a list of items, not one
 * section); a heading with no text names nothing.
 */
export function pickRailSections<S>(headings: readonly RailHeading<S>[]): { section: S; label: string }[] {
  const picked: { section: S; label: string }[] = [];
  const seen = new Set<S>();
  for (const heading of headings) {
    const { section } = heading;
    if (heading.excluded || section === null || heading.sectionH2s > 1 || seen.has(section)) continue;
    const label = railLabel(heading.text);
    if (label === "") continue;
    seen.add(section);
    picked.push({ section, label });
  }
  return picked;
}

/** Does a rail with `count` markers get its `<nav>` of buttons? (Otherwise: the fibre only.) */
export function railHasNav(count: number): boolean {
  return count > 0 && count <= RAIL_MAX_MARKERS;
}
