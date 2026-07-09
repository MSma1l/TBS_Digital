"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Auto-advance interval for the mobile carousel (ms). */
const ROLL_MS = 2000;
/** After a manual slide, wait this long (from when it settles) before auto-rolling again. */
const RESUME_MS = 5000;

/**
 * Turns a horizontal, scroll-snapping track into a self-advancing carousel on
 * mobile. Attach the returned ref to the scroll container (its direct children
 * are the slides).
 *
 * Behaviour:
 *  - Advances one slide every ~2s, but only when the track is actually a
 *    horizontal scroller (mobile ≤640px) and the user hasn't asked for reduced
 *    motion. On desktop / reduced-motion it does nothing.
 *  - A manual slide (touch, mouse-drag or trackpad/wheel) pauses the auto-roll
 *    and it resumes 5s after the slide settles, continuing from the current card.
 *  - Reveals every slide up front: a horizontal scroller never intersects the
 *    viewport, so the page's scroll-reveal would otherwise leave slides hidden.
 *  - Pauses while the browser tab is hidden.
 *
 * `itemCount` is only used to re-initialise when the number of slides changes.
 */
export function useAutoCarousel(itemCount: number): RefObject<HTMLDivElement | null> {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const mqMobile = window.matchMedia("(max-width: 640px)");
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    let timer: number | undefined;
    let resumeTimer: number | undefined;
    let index = 0;
    let paused = false;

    const items = () => Array.from(track.children) as HTMLElement[];

    // In a horizontal scroller, off-screen cards never intersect the viewport,
    // so the scroll-reveal would leave them hidden. Reveal them all up front.
    const revealAll = () => items().forEach((c) => c.classList.add("rv-in"));

    const centerOn = (i: number) => {
      const el = items()[i];
      if (!el) return;
      const target = el.offsetLeft - (track.clientWidth - el.clientWidth) / 2;
      track.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    };

    const nearestIndex = () => {
      const center = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let bestDist = Infinity;
      items().forEach((c, i) => {
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - center);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      return best;
    };

    const tick = () => {
      if (paused) return;
      const n = items().length;
      if (n < 2) return;
      index = (index + 1) % n;
      centerOn(index);
    };

    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      if (!mqMobile.matches) return;
      revealAll();
      if (mqReduce.matches) return; // visible, just not auto-rolling
      timer = window.setInterval(tick, ROLL_MS);
    };

    // The user grabbed the track — stop auto-rolling and drop any pending resume.
    const pause = () => {
      paused = true;
      if (resumeTimer) window.clearTimeout(resumeTimer);
    };
    // Resume RESUME_MS after the slide settles. While paused the auto-roll never
    // scrolls, so every scroll event here is the user's own slide/momentum —
    // each one pushes the countdown out, so it only resumes once movement stops.
    const scheduleResume = () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        index = nearestIndex(); // continue from where the user left off
        paused = false;
      }, RESUME_MS);
    };
    const onScroll = () => {
      if (paused) scheduleResume();
    };
    // Trackpad / mouse-wheel sliding emits `wheel` (never `pointerdown`), and a
    // programmatic scrollTo never emits `wheel` — so this is an unambiguous
    // "user is sliding" signal. Pause immediately and start the resume clock.
    const onWheel = () => {
      pause();
      scheduleResume();
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMqChange = () => start();

    track.addEventListener("pointerdown", pause);
    track.addEventListener("touchstart", pause, { passive: true });
    track.addEventListener("pointerup", scheduleResume);
    track.addEventListener("pointercancel", scheduleResume);
    track.addEventListener("touchend", scheduleResume, { passive: true });
    track.addEventListener("touchcancel", scheduleResume, { passive: true });
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    mqMobile.addEventListener("change", onMqChange);
    mqReduce.addEventListener("change", onMqChange);

    start();

    return () => {
      stop();
      if (resumeTimer) window.clearTimeout(resumeTimer);
      track.removeEventListener("pointerdown", pause);
      track.removeEventListener("touchstart", pause);
      track.removeEventListener("pointerup", scheduleResume);
      track.removeEventListener("pointercancel", scheduleResume);
      track.removeEventListener("touchend", scheduleResume);
      track.removeEventListener("touchcancel", scheduleResume);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVisibility);
      mqMobile.removeEventListener("change", onMqChange);
      mqReduce.removeEventListener("change", onMqChange);
    };
  }, [itemCount]);

  return trackRef;
}
