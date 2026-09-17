"use client";

import { useEffect, type RefObject } from "react";

/**
 * Keeps `data-offscreen` on `ref`'s element while it is scrolled out of view, so CSS can
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
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry) element.toggleAttribute("data-offscreen", !entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      element.removeAttribute("data-offscreen");
    };
  }, [ref]);
}
