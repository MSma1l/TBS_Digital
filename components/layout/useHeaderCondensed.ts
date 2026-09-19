/**
 * "Has the visitor scrolled away from the top?" — the one bit the header paints itself
 * from (`Navbar.tsx`): a full-width bar at the top of the page, a floating rounded island
 * once the page has moved.
 *
 * TWO STATES, NEVER A SCRUB (docs/07). A continuous, scroll-driven morph would have to
 * write style on the header every frame, and the header is the box the whole 3D stage
 * measures itself against (`--header-h`). So the scroll only flips a boolean; a CSS
 * transition does the rest, on the compositor, inside a box whose reserved height never
 * changes.
 *
 * HYSTERESIS. One threshold would flicker for a visitor resting at the boundary: a 1px
 * wheel notch, a trackpad's inertia or an address bar resizing the viewport would toggle
 * the bar back and forth. So the bar condenses at CONDENSE_AT and only expands again well
 * above it, at EXPAND_AT — inside the band it keeps whatever state it already had.
 *
 * COVERED PAGE. `Modal` pins `<body>` with `position: fixed` while a dialog is open, which
 * makes `window.scrollY` read 0 — the page has not moved, only its scroll container. Reading
 * that would expand the bar under the dialog and condense it again as the dialog closes, a
 * visible twitch behind a closing overlay. While anything covers the page (`isPageCovered`)
 * the state is frozen, and the cover's release re-reads it.
 */
import { useEffect, useState } from "react";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";

/** Past this many pixels of scroll the bar condenses — one header height, near enough. */
export const CONDENSE_AT = 72;

/** Below this many pixels it expands again. The gap to CONDENSE_AT is the hysteresis band. */
export const EXPAND_AT = 24;

/**
 * The next state of the bar, given where the page is and what the bar shows now. Pure, so
 * the threshold and its hysteresis are testable without a layout engine.
 */
export function nextCondensed(scrollY: number, condensed: boolean): boolean {
  if (!Number.isFinite(scrollY)) return condensed;
  if (scrollY >= CONDENSE_AT) return true;
  if (scrollY <= EXPAND_AT) return false;
  return condensed;
}

/**
 * `true` while the header should draw its condensed island. Re-renders only when the state
 * really flips — twice per crossing, not once per scrolled frame — and the reads themselves
 * are coalesced into one `requestAnimationFrame` per frame.
 */
export function useHeaderCondensed(): boolean {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    /* The listener's own copy of the state: `setCondensed` is queued, so a second scroll
       event in the same frame would otherwise still read the old React value. */
    let current = false;
    let frame = 0;

    const read = () => {
      frame = 0;
      if (isPageCovered()) return;
      const next = nextCondensed(window.scrollY, current);
      if (next === current) return;
      current = next;
      setCondensed(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(read);
    };

    // A reload halfway down the page (or a restored scroll position) starts condensed.
    read();
    window.addEventListener("scroll", schedule, { passive: true });
    const unsubscribe = subscribePageCover(schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      unsubscribe();
    };
  }, []);

  return condensed;
}
