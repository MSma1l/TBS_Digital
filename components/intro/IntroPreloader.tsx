"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { INTRO_OVERLAY_ID, INTRO_TIMING, finishIntro, markIntroGone } from "@/lib/intro";
import { lockRootScroll } from "@/lib/scrollLock";
import { PREFERS_REDUCED_MOTION } from "@/lib/device";
import { visibleTimeout } from "@/lib/visibleTimeout";
import { RenderErrorBoundary } from "@/components/three/RenderErrorBoundary";
import type { IntroCapability } from "./capability";
import { IntroFallback } from "./IntroFallback";
import styles from "./IntroPreloader.module.css";

/*
 * Loaded in three tiers so a returning visitor pays for none of it: this shell (React +
 * i18n only) is all `app/(site)/layout.tsx` can pull in; GSAP arrives with the director,
 * three.js only with the director's scene — each as an async chunk, requested after the
 * takeover decision below said "play". The shell probes the device first (a tiny chunk) and
 * then requests three.js itself, in the same tick as the director's chunk — the scene never
 * waits for the director to download, run and render first, and the director's own
 * `dynamic()` import of the scene then resolves from the module cache.
 */
const IntroDirector = dynamic(() => import("./IntroDirector").then((m) => m.IntroDirector), {
  ssr: false,
});

/* A store that never changes. useSyncExternalStore reads its SERVER snapshot while React
   renders on the server or hydrates server HTML, and the client snapshot otherwise — the
   only reliable "is this a hydration?" signal a component has. */
const subscribeNever = () => () => {};
const clientSnapshot = () => false;
const hydrationSnapshot = () => true;

/* A failed scene chunk is reported by the import that actually renders it (the director's
   error boundary → the SVG fallback); the shell's request only warms the cache. */
const ignore = () => {};

type IntroPhase = "boot" | "run" | "revealed" | "leaving" | "gone";

/** Keys that mean "get me to the page" — navigation keys, not typing. */
const SKIP_KEYS = new Set([
  "Escape",
  "Enter",
  " ",
  "Tab",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "PageDown",
  "PageUp",
  "Home",
  "End",
]);

/* The leaving fade is 300ms in the CSS module; unmount just after it. A timer, not
   transitionend: that event never fires in jsdom, or when the tab is hidden. */
const LEAVE_UNMOUNT_MS = 360;

/* Safety net once revealed: the director unmounts the overlay when its entrance ends
   (≤ 2.1s after reveal at normal speed). If that never comes, the shell does it. */
const REVEALED_UNMOUNT_MS = 3000;

/**
 * How far the pre-hydration failsafe (the `introFailsafe` CSS animation on the root) has
 * run, in ms — read off the element itself, not `performance.now()`, so a tab that loaded
 * in the background or a slow parse is measured on the clock that actually fades the
 * overlay. Found by its delay (the class and keyframe names are hashed by the build).
 * 0 when the browser can't say (jsdom has no `getAnimations`).
 */
function failsafeClock(el: HTMLElement): number {
  if (typeof el.getAnimations !== "function") return 0;
  for (const animation of el.getAnimations()) {
    const name = (animation as CSSAnimation).animationName ?? "";
    const delay = animation.effect?.getTiming().delay;
    if (name.includes("introFailsafe") || delay === INTRO_TIMING.FAILSAFE_MS) {
      const time = animation.currentTime;
      return typeof time === "number" ? time : 0;
    }
  }
  return 0;
}

/** A `/#section` link that points at something real: the visitor wants that, not an intro. */
function hasHashTarget(): boolean {
  const hash = window.location.hash;
  if (hash.length < 2) return false;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1))) !== null;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(PREFERS_REDUCED_MOTION).matches;
}

/**
 * The first-visit intro overlay — the shell.
 *
 * Rendered on the server (only when `shouldPlayIntro` says so) so the ∞, the grid and the
 * "SYSTEM_SYNCHRONIZATION: ▮" readout are on screen from the first paint, with a CSS
 * failsafe that clears them if JS never arrives. After hydration it makes ONE decision:
 *  · bypass — reduced motion, a `#hash` that targets the page, or JS so late the failsafe
 *    is about to fire → finish the intro silently and unmount;
 *  · run    — lock page scroll, turn navigation keys / clicks / the wheel into "skip",
 *    start a visibility-aware watchdog, and mount the director (GSAP), which drives the
 *    counter, the burst and the page entrance, and unmounts all of this when done.
 *
 * Hard loads only. The server gate lives in the layout, which is not re-rendered by client
 * navigation INSIDE the site — but a client navigation INTO it (the admin's "view site"
 * link) renders the layout fresh, gate and all. Such a mount is not a hydration, so it
 * renders nothing: no cookie, no event, no scroll lock, and the next hard load still plays.
 *
 * Accessibility: no role on the root, never aria-hidden, no <header>, no dialog, no focus
 * trap — the page underneath stays fully in the accessibility tree. The readout is the
 * progressbar; the skip button is its SIBLING (a progressbar's children are
 * presentational), 44px, never autofocused.
 */
export function IntroPreloader() {
  const hydrating = useSyncExternalStore(subscribeNever, clientSnapshot, hydrationSnapshot);
  // Frozen at mount: the re-render right after hydration reads the client snapshot (false).
  const [hardLoad] = useState(hydrating);
  return hardLoad ? <IntroShell /> : null;
}

function IntroShell() {
  const t = useT();
  const overlay = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<IntroPhase>("boot");
  const [capability, setCapability] = useState<IntroCapability | null>(null);
  const skipRef = useRef<(() => void) | null>(null);

  /* Out without the director: after an error, the watchdog, or a skip that came before the
     director's chunk did. The page was never hidden, so there is nothing to put back. */
  const leave = useCallback(() => {
    finishIntro({ played: false });
    // Once revealed the page is already uncovered: a director that dies mid-entrance must
    // not leave its (now reverted, fully opaque) overlay on top for the safety-net delay.
    setPhase((current) => {
      if (current === "run") return "leaving";
      return current === "revealed" ? "gone" : current;
    });
  }, []);

  const requestSkip = useCallback(() => {
    if (skipRef.current) skipRef.current();
    else leave();
  }, [leave]);

  const registerSkip = useCallback((skip: (() => void) | null) => {
    skipRef.current = skip;
  }, []);

  const onReveal = useCallback(() => {
    finishIntro({ played: true });
    setPhase((current) => (current === "run" ? "revealed" : current));
  }, []);

  const onDone = useCallback(() => setPhase("gone"), []);

  // The one post-hydration decision.
  useEffect(() => {
    const el = overlay.current;
    const bypass =
      !el ||
      prefersReducedMotion() ||
      hasHashTarget() ||
      failsafeClock(el) >= INTRO_TIMING.LATE_TAKEOVER_MS;
    if (bypass) finishIntro({ played: false });
    // Intentional post-mount setState: the server cannot know the motion preference, the
    // hash or how late JS arrived, so the overlay's fate is decided here, once.
    setPhase((current) => (current === "boot" ? (bypass ? "gone" : "run") : current));
    if (bypass) return;

    // The probe (its own ~1KB chunk: no GSAP, no three.js) decides what to download, and
    // then both big tiers start in the same tick: three.js here, the director (GSAP) as it
    // mounts with the probe's answer — it never probes a second time. Not preloading the
    // director before the probe is deliberate: Turbopack gives that import its own chunk
    // group, which duplicates the capability module into yet another lazy chunk.
    let cancelled = false;
    import("./capability").then(
      ({ probeIntroCapability }) => {
        if (cancelled) return;
        const probed = probeIntroCapability();
        // The shared 3D runtime (components/three/runtime.tsx), the director's own target.
        if (probed.webgl) import("@/components/three/runtime").catch(ignore);
        setCapability(probed);
      },
      () => {
        // Without the probe there is no director to run: get the page out from under it.
        if (!cancelled) leave();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [leave]);

  // While the intro runs: scroll lock, skip inputs, watchdog.
  useEffect(() => {
    if (phase !== "run") return;

    // Before hydration the overlay couldn't stop the wheel from scrolling the page under
    // it; start the entrance from the top. A hash means the browser put us there on purpose.
    if (window.scrollY > 0 && !window.location.hash) window.scrollTo(0, 0);
    const unlock = lockRootScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      // Shift stays allowed (Shift+Tab is navigation too); Ctrl/Alt/Meta are the browser's.
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (!SKIP_KEYS.has(event.key)) return;
      requestSkip();
      // The press is spent on the skip: nothing further down (the cookie banner's Escape,
      // a menu's arrow keys) may act on it too. Stopped at document capture, it never
      // reaches the target or React's root. No preventDefault — Tab must still move focus.
      event.stopPropagation();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && event.isPrimary !== false) requestSkip();
    };
    const onWheel = () => requestSkip();

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    const stopWatchdog = visibleTimeout(INTRO_TIMING.WATCHDOG_MS, leave);

    return () => {
      unlock();
      stopWatchdog();
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [phase, requestSkip, leave]);

  /* The overlay has left the document (a skip, the end of the entrance, a bypass): tell the
     interior stage, which waits for it before measuring or creating a WebGL context. Effects
     run after the commit that removed the overlay, so `markIntroGone` sees it gone; it fires
     once. The unmount cleanup covers a shell torn down some other way — and is a no-op while
     the overlay is still attached (StrictMode's effect replay). */
  useEffect(() => {
    if (phase === "gone") markIntroGone();
  }, [phase]);
  useEffect(() => () => markIntroGone(), []);

  // Unmount after the CSS fade (leaving), or as a safety net once revealed.
  useEffect(() => {
    if (phase !== "leaving" && phase !== "revealed") return;
    const id = window.setTimeout(
      () => setPhase("gone"),
      phase === "leaving" ? LEAVE_UNMOUNT_MS : REVEALED_UNMOUNT_MS,
    );
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      id={INTRO_OVERLAY_ID}
      ref={overlay}
      data-testid="intro"
      data-phase={phase}
      data-renderer="pending"
      data-live={phase === "boot" ? undefined : ""}
      className={styles.overlay}
    >
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.glowBlue} />
        <div className={styles.glowRed} />
        <div className={styles.floor}>
          <div className={styles.floorPlane}>
            <div className={styles.floorGrid} />
          </div>
        </div>
        <div className={styles.horizon} />
        <div className={styles.sweep} />
        <span className={`${styles.corner} ${styles.cornerTl}`} />
        <span className={`${styles.corner} ${styles.cornerTr}`} />
        <span className={`${styles.corner} ${styles.cornerBl}`} />
        <span className={`${styles.corner} ${styles.cornerBr}`} />
      </div>

      <div className={styles.fallback} data-part="fallback" aria-hidden="true">
        <IntroFallback />
      </div>

      <div className={styles.canvasHost} data-part="scene" data-testid="intro-scene" aria-hidden="true">
        {(phase === "run" || phase === "revealed") && capability && (
          <RenderErrorBoundary onError={leave}>
            <IntroDirector
              overlay={overlay}
              capability={capability}
              registerSkip={registerSkip}
              onReveal={onReveal}
              onDone={onDone}
            />
          </RenderErrorBoundary>
        )}
      </div>

      <div className={styles.flash} data-part="flash" aria-hidden="true" />
      <div className={styles.shock} data-part="shock" aria-hidden="true" />

      <div className={styles.hud} data-part="hud">
        {/* The director writes the counter, the label at 100% and aria-valuenow straight to
            the DOM (never React state per frame); none of these props change afterwards, so
            React never writes over them. */}
        <div
          role="progressbar"
          aria-label={t("intro.progressAria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          className={styles.readout}
          data-part="readout"
        >
          <span className={styles.label} data-part="label">
            {t("intro.status")}
          </span>
          {": "}
          <span className={styles.value}>
            <span className={styles.count} data-part="counter" data-testid="intro-counter">
              00
            </span>
            <span className={styles.pct}>%</span>
            <span className={styles.cursor} aria-hidden="true" />
          </span>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span className={styles.bar} data-part="bar" />
          <span className={`${styles.tick} ${styles.tick25}`} data-part="tick" />
          <span className={`${styles.tick} ${styles.tick50}`} data-part="tick" />
          <span className={`${styles.tick} ${styles.tick75}`} data-part="tick" />
        </div>
      </div>

      <button type="button" className={styles.skip} data-part="skip" onClick={requestSkip}>
        {t("intro.skip")}
        <kbd className={styles.kbd} aria-hidden="true">
          {t("intro.skipKey")}
        </kbd>
      </button>
    </div>
  );
}
