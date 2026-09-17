"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  HERO_ID,
  PARALLAX_LAYERS,
  PARALLAX_MEDIA,
  SCENE_ANCHOR_ATTR,
  SCENE_ATTR,
  SCENE_TIMING,
  type SceneDirectorProps,
} from "@/lib/scene";
import {
  guardSmoothScroll,
  parallaxTargets,
  quietScrollTrigger,
  wakeScrollTrigger,
  withInstantScroll,
} from "./scrollGuard";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { releaseProbe, writeAnchors, writeEntrySpan, writeHeroSpan } from "./scrollProbe";

/*
 * Registered when this chunk evaluates — outside any GSAP context, so ScrollTrigger's own
 * one-time setup (its orientation matchMedia, its listeners) is never reverted by a director
 * unmounting. Registering twice is a no-op.
 */
gsap.registerPlugin(useGSAP, ScrollTrigger);

const PARALLAX_KEYS = Object.keys(PARALLAX_LAYERS) as Array<keyof typeof PARALLAX_LAYERS>;

/**
 * The interior stage's GSAP half, loaded with the scene (next/dynamic) and only on the WebGL
 * path. It draws nothing and animates nothing the scene reads. It:
 *  · MEASURES — two animation-free ScrollTriggers give the scroll spans (`heroExit`: `#top`
 *    "top top" → "bottom 35%"; `entry`: the services anchor "top 90%" → "top 75%", the band
 *    over which the scene's timed entry gate arms and disarms), and every refresh re-reads the
 *    anchors' document boxes, the stage's top/bottom and the header height into `probe`. The
 *    scene reads `window.scrollY` against them every frame — no scrub drives the scene, so it
 *    never lags a frame behind the page. It only knows the threshold: whether the services
 *    model has formed is the scene's to say (`data-entry`, written by the stage);
 *  · keeps refreshes harmless — the smooth-scroll guard (scrollGuard.ts), a refresh when the
 *    stage changes height (admin content, images, a font swap; deferred while the visitor is
 *    scrolling, because a refresh jumps the page and would kill a touch fling) and on a
 *    bfcache restore;
 *  · keeps no measurement taken while something covers the page (a dialog pins <body>, so
 *    every box reads `scrollY` too high), and measures again once the cover lifts;
 *  · moves the hero's two parallax layers — capable desktops only (`PARALLAX_MEDIA`), scrubbed,
 *    the identity at scroll 0.
 *
 * Never: pinning, snapping, smoothing, markers, a custom scroll container, GSAP's lag
 * smoothing (the intro director owns the ticker), or a style on <html>/<body>/an entrance
 * marker (scene-contract.test.ts). Everything lives in one `useGSAP` context scoped to the
 * stage, so an unmount (leaving the home page) reverts every trigger and tween.
 */
export function SceneDirector({ stage, probe, onLive }: SceneDirectorProps) {
  // The context outlives the render that created it; call the latest `onLive`.
  const latestOnLive = useRef(onLive);
  useEffect(() => {
    latestOnLive.current = onLive;
  }, [onLive]);

  /*
   * ScrollTrigger runs a frame loop and an interval while enabled, triggers or not
   * (scrollGuard.ts). Declared before `useGSAP`, so on mount it wakes ScrollTrigger before
   * the context creates triggers, outside that context. Its cleanup runs before the context's
   * revert kills them, so the quiet waits a microtask — and skips itself when a remount (a
   * retry, StrictMode) has created triggers again by then.
   */
  useLayoutEffect(() => {
    wakeScrollTrigger(ScrollTrigger, gsap);
    return () => {
      queueMicrotask(() => quietScrollTrigger(ScrollTrigger));
    };
  }, []);

  useGSAP(
    () => {
      const el = stage.current;
      if (!el) return;
      const root = document.documentElement;

      /*
       * Never keep a measurement taken under a cover. The request dialog pins <body>
       * (Modal.tsx: `position: fixed`, `top: -scrollY`), so `scrollY` reads 0 while every box
       * sits scrollY higher than it really is: a refresh then — ScrollTrigger's own after a
       * desktop resize or Android's keyboard resizing the viewport, or this mount — would store
       * every span and anchor wrong by the scroll offset, and nothing would measure again after
       * the dialog closed (the core vanished at the top of the page; the models sat Y px off).
       * So under a cover the probe keeps its last good values, the director's own refreshes
       * wait, and a refresh ScrollTrigger ran anyway is redone the frame after the cover lifts
       * — every cover is released only once the page is back in place (lib/scrollLock.ts).
       */
      let staleUnderCover = false;
      const uncovered = () => {
        if (!isPageCovered()) return true;
        staleUnderCover = true;
        return false;
      };

      let announced = false;
      /* Measurements kept so far (the mount's and every full refresh's, none under a cover). */
      let measurements = 0;
      const measure = () => {
        if (!uncovered()) return;
        measurements += 1;
        writeAnchors(probe, el);
        if (announced) return;
        announced = true;
        latestOnLive.current();
      };

      // Creating a trigger measures it at once (no jump); do it with smooth scrolling off, so
      // gsap records `<html>` as an instant scroller from its very first scroll function.
      const releaseGuard = withInstantScroll(root, () => {
        const release = guardSmoothScroll(ScrollTrigger, root);
        const hero = el.querySelector<HTMLElement>(`#${HERO_ID}`);
        if (hero) {
          ScrollTrigger.create({
            trigger: hero,
            start: "top top",
            end: "bottom 35%",
            onRefresh: (self) => {
              if (uncovered()) writeHeroSpan(probe, self);
            },
          });
        }
        const services = el.querySelector<HTMLElement>(`[${SCENE_ANCHOR_ATTR}="services"]`);
        if (services) {
          ScrollTrigger.create({
            trigger: services,
            start: "top 90%",
            end: "top 75%",
            onRefresh: (self) => {
              if (uncovered()) writeEntrySpan(probe, self);
            },
          });
        }
        measure();
        return release;
      });
      // Dispatched after every full refresh, once the page is back where it was.
      ScrollTrigger.addEventListener("refresh", measure);
      el.setAttribute(SCENE_ATTR.scrollFx, "on");

      // Recorded in this context (gsap.matchMedia joins the running one), reverted with it.
      gsap.matchMedia().add(PARALLAX_MEDIA, () => {
        const hero = el.querySelector<HTMLElement>(`#${HERO_ID}`);
        if (!hero) return;
        for (const layer of PARALLAX_KEYS) {
          const targets = parallaxTargets(el, layer);
          if (targets.length === 0) continue;
          gsap.to(targets, {
            yPercent: PARALLAX_LAYERS[layer].yPercent,
            ease: "none",
            immediateRender: false,
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
          });
        }
      });

      /*
       * Refresh for a change seen when `measurements` was `since` — unless a full refresh has
       * measured since (ScrollTrigger's own, 200ms after a window resize, which also reflows
       * the stage). A refresh jumps the page to 0 and back, so never in the middle of a scroll
       * (a touch fling would stop): then it waits for the scroll to end. Nor under a cover
       * (above): then it waits for the cover to lift.
       */
      let pendingSince: number | null = null;
      const refreshSince = (since: number) => {
        pendingSince = null;
        if (measurements > since) return;
        if (ScrollTrigger.isScrolling() || isPageCovered()) {
          pendingSince = since;
          return;
        }
        ScrollTrigger.refresh();
      };
      // Registered for the director's whole life (never removed from inside a dispatch).
      const onScrollEnd = () => {
        if (pendingSince !== null) refreshSince(pendingSince);
      };
      ScrollTrigger.addEventListener("scrollEnd", onScrollEnd);

      /*
       * The cover lifted: the page is back where it was. A frame later its layout is current;
       * then a refresh that ran under the cover (or the mount's measurement) is redone at once
       * — it was owed before the visitor could scroll, and the only scroll event so far is the
       * lock putting the page back — and a deferred one runs by the usual rules.
       */
      let lifted = 0;
      /* The measurement count a redo is owed against (null: no redo owed). */
      let redoSince: number | null = null;
      const onCoverChange = () => {
        if (isPageCovered()) return;
        if (staleUnderCover) {
          staleUnderCover = false;
          pendingSince = null;
          redoSince = measurements;
        }
        // One frame at a time does whatever is owed by then.
        if (lifted !== 0 || (redoSince === null && pendingSince === null)) return;
        lifted = window.requestAnimationFrame(() => {
          lifted = 0;
          if (redoSince !== null) {
            const since = redoSince;
            redoSince = null;
            if (measurements > since) return;
            if (isPageCovered()) {
              staleUnderCover = true;
              return;
            }
            ScrollTrigger.refresh();
          } else if (pendingSince !== null) {
            refreshSince(pendingSince);
          }
        });
      };
      const stopWatchingCover = subscribePageCover(onCoverChange);

      let debounce: number | undefined;
      let observer: ResizeObserver | undefined;
      if (typeof window.ResizeObserver === "function") {
        // The height the triggers were last measured at; sub-pixel drift adds up against it.
        let measured: number | null = null;
        observer = new ResizeObserver((entries) => {
          const next = entries[entries.length - 1]?.contentRect.height;
          if (next === undefined) return;
          if (measured !== null && Math.abs(next - measured) < 1) return;
          const first = measured === null;
          measured = next;
          // The first report is the size at observe time, not a change.
          if (first) return;
          const since = measurements;
          window.clearTimeout(debounce);
          debounce = window.setTimeout(() => refreshSince(since), SCENE_TIMING.REFRESH_DEBOUNCE_MS);
        });
        /* The stage, not <main>: everything the probe holds (the stage's box, both anchors, the
           two spans) is inside it or its own edge, and nothing above it on the page changes
           height — so a change below it (the estimator's steps, the chat panel, a form's
           validation messages) never costs a full refresh. */
        observer.observe(el);
      }

      // Back/forward cache: the layout may have changed while the page was frozen.
      const onPageShow = (event: PageTransitionEvent) => {
        if (event.persisted) refreshSince(measurements);
      };
      window.addEventListener("pageshow", onPageShow);

      return () => {
        ScrollTrigger.removeEventListener("refresh", measure);
        ScrollTrigger.removeEventListener("scrollEnd", onScrollEnd);
        stopWatchingCover();
        window.cancelAnimationFrame(lifted);
        window.removeEventListener("pageshow", onPageShow);
        observer?.disconnect();
        window.clearTimeout(debounce);
        releaseGuard();
        el.setAttribute(SCENE_ATTR.scrollFx, "off");
        releaseProbe(probe);
      };
    },
    { scope: stage, dependencies: [] },
  );

  return null;
}
