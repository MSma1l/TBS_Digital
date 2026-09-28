"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps `data-offscreen` on `ref`'s element while it is scrolled well out of view, so CSS can
 * pause its looping animations (`group-data-offscreen/…:[animation-play-state:paused]`).
 *
 * An attribute written straight onto the node, not React state: nothing re-renders when the
 * visitor scrolls past. Removed again on unmount.
 */
export function useOffscreenAttribute(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    // One callback can carry several entries for the element (a fast scroll past and
    // back): only the newest says where it is now.
    // A MARGIN, because the callback is late by construction.
    //
    // IntersectionObserver delivers from a task queued AFTER the frame's rendering update, so
    // without a margin the first frame on which the element is actually visible is still painted
    // with `data-offscreen` on it — one frame of a paused animation, and then a jump. The margin
    // clears the attribute while the element is still 200px outside, which at any real scroll
    // speed is several frames of lead, so the animation is already live on the frame it becomes
    // visible. It only ever makes the pause end EARLIER, never later.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) element.toggleAttribute("data-offscreen", !entry.isIntersecting);
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.removeAttribute("data-offscreen");
    };
  }, [ref]);
}
