/**
 * Rectangle maths for the HUD's "Focus Not Obscured" guards (WCAG 2.4.11): the guide yields
 * when the focused element overlaps it, a window peeks when it fully covers the focused
 * element, the page scrolls when the focused element sits fully inside the dock.
 *
 * Pure, no DOM: a `DOMRect` is a `RectLike`, so callers pass `getBoundingClientRect()` as is.
 * Any non-finite edge makes both answers `false` — a guard that cannot measure does nothing.
 */

export type RectLike = { left: number; top: number; right: number; bottom: number };

const finite = (r: RectLike) =>
  Number.isFinite(r.left) && Number.isFinite(r.top) && Number.isFinite(r.right) && Number.isFinite(r.bottom);

/** Is `inner` entirely inside `outer`? Shared edges count as inside. */
export function covers(outer: RectLike, inner: RectLike): boolean {
  return (
    finite(outer) &&
    finite(inner) &&
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  );
}

/**
 * Do `a` and `b` share an area? Boxes that only touch along an edge or at a corner do not,
 * and neither does an empty box (no width or no height).
 */
export function overlaps(a: RectLike, b: RectLike): boolean {
  return (
    finite(a) &&
    finite(b) &&
    Math.min(a.right, b.right) > Math.max(a.left, b.left) &&
    Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)
  );
}
