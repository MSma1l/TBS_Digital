/**
 * Freeze page scrolling while a full-screen layer is up — the burger menu overlay and the
 * intro preloader. Reference-counted, so the two can overlap and the page only unlocks when
 * the LAST one lets go.
 *
 * It locks `<html>`, never `<body>`: `components/ui/Modal.tsx` owns the body lock
 * (`position: fixed` + scroll restore), and two owners of one element's inline styles would
 * restore each other's values. Up to three writes:
 *  · `html { overflow: hidden }` — the actual lock;
 *  · `html { scrollbar-gutter: stable }` — ONLY when a classic scrollbar is taking width
 *    right now (see `hasClassicScrollbar`): the scrollbar's width stays reserved, so the page
 *    doesn't jump sideways when it disappears. Where the scrollbar takes no width (phones'
 *    overlay scrollbars, hidden scrollbars — headless Chromium's included) a "stable" gutter
 *    would do the opposite: reserve ~15px that were never there, narrow the page, reflow it
 *    taller and let scroll anchoring move the visitor (measured: 800 → 759 at 320px after a
 *    burger open/close);
 *  · `body { overflow-x: visible }` — globals.css gives the body `overflow-x: hidden`, which
 *    only propagates to the viewport while `<html>` is `overflow: visible`. Once `<html>`
 *    hides its overflow, the body becomes a scroll container of its own and the sticky
 *    header anchors to IT — so after scrolling, the header is gone the moment the menu opens.
 *
 * Whatever inline values were there before the first lock are put back after the last
 * unlock (restored, not blanked), and a `style` attribute the lock leaves empty is removed,
 * so a page that had no inline style has none afterwards.
 *
 * Every lock also holds a page COVER (below), and so does Modal's body lock: while something
 * full-screen covers the page, the interior WebGL stage stops drawing, and its director keeps
 * no measurement taken meanwhile. Both locks release the cover LAST, once the page's styles
 * and scroll position are back, so a listener can measure the page the moment it lifts.
 */

/* ---- page cover ------------------------------------------------------------------------
   "Something full-screen is over the page right now" — the burger overlay, the intro, a
   dialog. Reference-counted like the lock; `PAGE_COVER_EVENT` fires on `window` only when
   the count crosses 0 ↔ 1, so nested covers never re-announce. */

/** Fired on `window` when the page becomes covered, and when the last cover lets go. */
export const PAGE_COVER_EVENT = "tbs:page-cover";

let coverCount = 0;

function announceCover(): void {
  try {
    window.dispatchEvent(new Event(PAGE_COVER_EVENT));
  } catch {
    /* Event unsupported — `isPageCovered()` still answers */
  }
}

/** Cover the page; call the returned function to release THIS cover. Safe to call twice. */
export function coverPage(): () => void {
  if (typeof window === "undefined") return () => {};
  coverCount += 1;
  if (coverCount === 1) announceCover();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    coverCount -= 1;
    if (coverCount === 0) announceCover();
  };
}

export function isPageCovered(): boolean {
  return coverCount > 0;
}

/** Called on every 0 ↔ 1 change (read `isPageCovered()` inside). Returns the unsubscribe. */
export function subscribePageCover(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PAGE_COVER_EVENT, onChange);
  return () => window.removeEventListener(PAGE_COVER_EVENT, onChange);
}

/* ---- root scroll lock ------------------------------------------------------------------ */

type RootStyleSnapshot = {
  overflow: string;
  scrollbarGutter: string;
  bodyOverflowX: string;
};

let lockCount = 0;
let lockedSnapshot: RootStyleSnapshot | null = null;

/**
 * Does the page's scrollbar currently take layout width? True for a classic (desktop)
 * scrollbar; false for overlay scrollbars, hidden scrollbars, and a page that doesn't scroll.
 * Pure, so the decision is unit-testable without a layout engine.
 */
export function hasClassicScrollbar(viewportWidth: number, rootClientWidth: number): boolean {
  return Number.isFinite(viewportWidth) && Number.isFinite(rootClientWidth)
    ? viewportWidth - rootClientWidth > 0
    : false;
}

/** `clearProps`-style husk: an inline `style` that holds nothing any more goes altogether. */
function dropEmptyStyle(el: HTMLElement | null): void {
  if (el && el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
}

/** Lock the page; call the returned function to release THIS lock. Safe to call twice. */
export function lockRootScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  const root = document.documentElement;
  const body = document.body;

  if (lockCount === 0) {
    lockedSnapshot = {
      overflow: root.style.overflow,
      scrollbarGutter: root.style.scrollbarGutter,
      bodyOverflowX: body?.style.overflowX ?? "",
    };
    // Measured BEFORE the lock hides the scrollbar.
    const reserveGutter = hasClassicScrollbar(window.innerWidth, root.clientWidth);
    root.style.overflow = "hidden";
    if (reserveGutter) root.style.scrollbarGutter = "stable";
    if (body) body.style.overflowX = "visible";
  }
  lockCount += 1;
  const releaseCover = coverPage();

  let released = false;
  return () => {
    // An effect cleanup and an explicit close can both call it; only the first one counts.
    if (released) return;
    released = true;
    lockCount -= 1;
    const snapshot = lockCount === 0 ? lockedSnapshot : null;
    if (lockCount === 0) lockedSnapshot = null;
    if (snapshot) {
      root.style.overflow = snapshot.overflow;
      root.style.scrollbarGutter = snapshot.scrollbarGutter;
      dropEmptyStyle(root);
      if (document.body) {
        document.body.style.overflowX = snapshot.bodyOverflowX;
        dropEmptyStyle(document.body);
      }
    }
    // Last, like Modal's body lock: a listener that measures the page on release finds it unlocked.
    releaseCover();
  };
}
