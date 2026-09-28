"use client";

import { useEffect, useRef } from "react";

/**
 * Thin gradient bar pinned to the top of the viewport that fills as you scroll.
 *
 * THREE THINGS IT DOES NOT DO ANY MORE, none of which changes a pixel.
 *
 * IT DOES NOT WRITE WHERE IT IS NOT DRAWN. From 861px the fibre rail draws the page's progress
 * and `app/globals.css` deletes this bar with `display: none` — but the loop kept measuring the
 * document and writing a width into a box that had no pixels, on every scroll frame of every
 * desktop visit. The gate is an `IntersectionObserver` on the bar itself, which is exactly the
 * right question asked cheaply: a `display: none` element never intersects, a `position: fixed`
 * bar at `top: 0` always does while it is drawn. So the stylesheet stays the single source of
 * truth — no duplicated media query here to drift out of step with it — and the answer arrives
 * as an event rather than a `getComputedStyle` per frame. It also covers the case a media query
 * could not: the rail arming mid-visit, which is not a resize.
 *
 * IT STILL MEASURES THE DOCUMENT EVERY FRAME, and that is on purpose. Caching `scrollHeight`
 * and refreshing it on resize plus a `ResizeObserver` was written and backed out: the fibre rail
 * refreshes the same number from FIVE signals (resize, its own layout event, a ResizeObserver on
 * `<html>`, the page-cover release and `document.fonts.ready`), and two of five is how a cached
 * height goes stale. On a phone this bar IS the progress, so a stale height paints it at the
 * wrong percentage on frames that really are drawn — a visible error traded for one read.
 *
 * IT DOES NOT REWRITE THE SAME STRING. The width is deduped against the last one written, so a
 * scroll that does not move the bar's rounded width touches no style at all — the dedupe the
 * rail already does for `--rail-p`.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let written = "";
    /* Optimistic until the observer's first callback: a bar that IS drawn must be right on the
       first frame, and one that is not costs a single skipped write to find out. */
    let drawn = true;

    const update = () => {
      raf = 0;
      if (!drawn) return;
      const docH = document.documentElement.scrollHeight - (window.innerHeight || 1) || 1;
      const next = `${Math.min(100, ((window.scrollY || 0) / docH) * 100)}%`;
      if (next === written) return;
      written = next;
      el.style.width = next;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const drawObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (!entry) return;
            drawn = entry.isIntersecting;
            /* Coming back (a resize below 861px, the HUD switched off) must land the current
               position immediately, not at the next scroll. */
            if (drawn) onScroll();
          });
    drawObserver?.observe(el);

    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      drawObserver?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div data-progress ref={ref} />;
}
