"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  FB_PROGRESS_PROP,
  INTRO_REVEAL_ATTR,
  INTRO_TIMING,
  type IntroRevealTarget,
} from "@/lib/intro";
import { RenderErrorBoundary } from "@/components/three/RenderErrorBoundary";
import type { IntroCapability } from "./capability";
import { flightFromProgress } from "./flight";
import { createIntroFx } from "./fx";
import { TIER_CONFIG } from "./tiers";

gsap.registerPlugin(useGSAP);

/* three.js + R3F: an async chunk, requested only when the capability probe said yes (the
   shell has usually started downloading it already; this then resolves from cache). It is the
   shared 3D runtime module, the same `import()` target as the interior stage's scene, so the
   two scenes share one three.js chunk (components/three/runtime.tsx). */
const IntroScene = dynamic(
  () => import("@/components/three/runtime").then((m) => m.IntroScene),
  { ssr: false },
);

export type IntroDirectorProps = {
  /** The shell's root. Every part the director drives is found under it by `data-part`. */
  overlay: RefObject<HTMLDivElement | null>;
  /** The shell's one probe of the device (read once, at mount). */
  capability: IntroCapability;
  /** Hand the shell this director's skip (or null on unmount). */
  registerSkip: (skip: (() => void) | null) => void;
  /** The page is uncovered: the shell finishes the intro (cookie + event). */
  onReveal: () => void;
  /** The entrance has ended: the shell unmounts the overlay and, with it, the scene. */
  onDone: () => void;
};

type SceneState = "off" | "loading" | "ready" | "paused";

type ContextSafe = ReturnType<typeof useGSAP>["contextSafe"];

/** How the scene's callbacks reach into the running intro (set up inside the GSAP context). */
type SceneHooks = { ready: () => void; failed: () => void };

/** Skip = the same burst, played this much faster. */
const SKIP_SPEED = 2.4;

/**
 * When the camera's dive finishes, in timeline seconds from the lock.
 *
 * A beat short of the "reveal" label at 0.72, so the arrival is held — see the tween itself for
 * why that matters. Keep the two in step: a dive that ends after the reveal plays under a page
 * that is already fading in, and cannot be seen.
 */
const DIVE_END = 0.66;

/*
 * What 0→100% means: honest readiness, weighted, never ahead of a cinematic curve.
 * Hydration is already true when the director exists; the scene counts as ready at once
 * when there is no scene to wait for.
 */
const WEIGHT = { hydrated: 0.15, fonts: 0.15, load: 0.3, scene: 0.4 } as const;

/* Heartbeats — three pulses and one burst stay far under WCAG 2.3.1's three flashes/second. */
const HEARTBEATS = [0.25, 0.5, 0.75] as const;

type EntranceStep = {
  target: IntroRevealTarget;
  /** Seconds after the "reveal" label. */
  at: number;
  from: gsap.TweenVars;
  /** A blur to start from, dropped on the low tier (a full-width filter animation). */
  blur?: number;
  duration?: number;
  /** Exactly what `from` wrote, so no inline style is left behind. */
  clear: string;
};

/*
 * The page entrance (PLAN §3). Each target is ONE marked element; none of them has a CSS
 * transition or animation on transform/opacity/filter, and nothing ever hides them in CSS —
 * without an intro (returning visitor, reduced motion, tests) the page is simply there.
 *  · header — transform only: opacity or a filter on <header> would make it the backdrop
 *    root of its own glass and kill the blur mid-entrance;
 *  · title  — never opacity: the <h1> is the LCP element and must paint at full opacity
 *    under the overlay;
 *  · stats  — transform only: the cards are glass (backdrop-filter) too;
 *  · cta / ticker — the wrappers, never the button (hover transform) or the CSS-animated
 *    marquee track.
 */
const ENTRANCE: readonly EntranceStep[] = [
  { target: "grid", at: 0, from: { opacity: 0, scale: 1.12 }, clear: "opacity,transform" },
  { target: "header", at: 0.1, from: { yPercent: -110 }, duration: 0.6, clear: "transform" },
  { target: "eyebrow", at: 0.2, from: { y: 24 }, blur: 8, clear: "transform,filter" },
  { target: "title", at: 0.26, from: { y: 56, scale: 0.96 }, blur: 14, clear: "transform,filter" },
  { target: "lead", at: 0.36, from: { y: 28 }, blur: 8, clear: "transform,filter" },
  { target: "cta", at: 0.44, from: { y: 24, scale: 0.96 }, clear: "transform" },
  {
    target: "stats",
    at: 0.5,
    from: { y: 40, rotateX: -14, transformPerspective: 900 },
    clear: "transform",
  },
  { target: "ticker", at: 0.6, from: { y: 40 }, clear: "transform" },
];

/** Queue the entrance on `timeline`, starting at its "reveal" label. Missing markers are skipped. */
function addEntrance(timeline: gsap.core.Timeline, blur: boolean): void {
  for (const step of ENTRANCE) {
    const el = document.querySelector<HTMLElement>(`[${INTRO_REVEAL_ATTR}="${step.target}"]`);
    if (!el) continue;
    const vars: gsap.TweenVars = {
      ...step.from,
      duration: step.duration ?? 0.9,
      ease: "expo.out",
      clearProps: step.clear,
    };
    if (blur && step.blur) vars.filter = `blur(${step.blur}px)`;
    timeline.from(el, vars, `reveal+=${step.at}`);
  }
}

/*
 * clearProps (and a context revert) remove every property GSAP wrote but leave an empty
 * `style=""` attribute behind. Harmless to layout, but the contract is "no style attribute"
 * on a marker once the intro is over, so the husk goes too.
 */
function dropEmptyRevealStyles(): void {
  for (const el of document.querySelectorAll(`[${INTRO_REVEAL_ATTR}][style]`)) {
    if (el.getAttribute("style")?.trim() === "") el.removeAttribute("style");
  }
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const isTabHidden = () => document.visibilityState === "hidden";
const isTabHiddenOnServer = () => false;

/**
 * The intro's director: the progress model, the burst, the page entrance and the WebGL
 * scene's lifecycle. Client-only (loaded with `ssr: false` by the shell), which probes the
 * device before mounting it and hands the answer down — the scene chunk is requested from
 * that same answer, in parallel with this one.
 *
 * Nothing here re-renders per frame: GSAP writes the counter, the bar, the drawing's scrub
 * property and `aria-valuenow` straight to the DOM and tweens the plain `fx` object the scene reads in
 * `useFrame`. React state changes only a handful of times (scene loading → ready → paused).
 */
export function IntroDirector({
  overlay,
  capability,
  registerSkip,
  onReveal,
  onDone,
}: IntroDirectorProps) {
  const t = useT();

  const [fx] = useState(createIntroFx);
  const [scene, setScene] = useState<SceneState>(() => (capability.webgl ? "loading" : "off"));
  const hidden = useSyncExternalStore(subscribeVisibility, isTabHidden, isTabHiddenOnServer);

  const sceneHooks = useRef<SceneHooks | null>(null);
  // The timeline outlives the render that created it; read the latest `t` when it fires.
  const latest = useRef({ t });
  useEffect(() => {
    latest.current = { t };
  }, [t]);

  const onSceneReady = useCallback(() => sceneHooks.current?.ready(), []);
  const onSceneFailed = useCallback(() => sceneHooks.current?.failed(), []);

  useGSAP(
    (_context, contextSafe) => {
      const root = overlay.current;
      if (!root) return;
      // Everything created later — from the ticker, a skip, a scene callback — is recorded
      // in this component's context, so unmounting reverts it (no inline style survives).
      const safe: ContextSafe = contextSafe ?? ((fn) => fn);

      const part = (name: string): HTMLElement => {
        const el = root.querySelector<HTMLElement>(`[data-part="${name}"]`);
        if (!el) throw new Error(`IntroDirector: missing [data-part="${name}"]`);
        return el;
      };
      const readout = part("readout");
      const label = part("label");
      const counter = part("counter");
      const bar = part("bar");
      const hud = part("hud");
      const skipButton = part("skip");
      const fallback = part("fallback");
      const canvasHost = part("scene");
      const flash = part("flash");
      const shock = part("shock");
      const ticks = Array.from(root.querySelectorAll<HTMLElement>('[data-part="tick"]'));

      const T = INTRO_TIMING;
      const takeover = performance.now();
      const signals = { fonts: false, load: false, scene: !capability.webgl };
      let sceneLive = false;
      let sceneGone = !capability.webgl;
      let timeline: gsap.core.Timeline | null = null;

      /*
       * GSAP's default lag smoothing turns any frame over 500ms into 33ms of animation time.
       * Under software rendering or a blocking shader compile that stretches the burst, and
       * a stretched burst can outlive the shell's watchdog. The intro is a wall-clock
       * sequence, so a hitch drops frames instead of delaying the reveal. Restored to GSAP's
       * default on unmount. The interior stage's director (components/scene) also runs GSAP,
       * but it mounts only after the overlay is gone — after this cleanup — and never
       * touches lag smoothing itself.
       */
      gsap.ticker.lagSmoothing(0);
      root.setAttribute("data-renderer", capability.webgl ? "pending" : "fallback");

      // ---- readiness signals ---------------------------------------------------------
      if (typeof document.fonts?.ready?.then === "function") {
        document.fonts.ready.then(
          () => (signals.fonts = true),
          () => (signals.fonts = true),
        );
      } else {
        signals.fonts = true;
      }
      const onLoad = () => (signals.load = true);
      if (document.readyState === "complete") signals.load = true;
      else window.addEventListener("load", onLoad, { once: true });

      /*
       * The cinematic clock counts from navigation start (performance.now() = 0), because
       * the visitor has been watching since the first paint, not since hydration. It stops
       * while the tab is hidden; a tab that loaded in the background starts it on first
       * view, as if 400ms had already run.
       */
      let origin = isTabHidden() ? Number.POSITIVE_INFINITY : 0;
      let hiddenAt = isTabHidden() ? takeover : 0;
      const onVisibility = () => {
        const now = performance.now();
        if (isTabHidden()) {
          hiddenAt = now;
          return;
        }
        if (origin === Number.POSITIVE_INFINITY) origin = now - 400;
        else if (hiddenAt) origin += now - hiddenAt;
        hiddenAt = 0;
      };
      document.addEventListener("visibilitychange", onVisibility);

      // ---- rendering the progress ----------------------------------------------------
      const shown = { p: 0 };
      const setBar = gsap.quickSetter(bar, "scaleX");
      const setFxProgress = gsap.quickSetter(fx, "progress");
      /* The camera's one scalar. Eased on its own rather than driven straight off `shown.p`:
         the progress can step (a signal lands, the hard cap fires) and a camera must not. */
      const flightTo = gsap.quickTo(fx, "flight", {
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
      let lastWhole = 0;
      let lastStep = 0;
      let beats = 0;
      /* Set by the lock. After it the readout belongs to the burst: a context revert on
         unmount renders the (killed) chase tween back at its start value WITH its onUpdate,
         which would otherwise write e.g. aria-valuenow 70 and "70" over the locked 100. */
      let locked = false;

      /*
       * The drawing's one scrub channel. Every part of the fallback derives its own window
       * from this single custom property in CSS, so a frame is one property write on one
       * element rather than a walk over the parts. Quantised to 1/200 — finer than the eye
       * on a 480-unit viewBox, and it keeps the style recalc off most frames.
       */
      let lastP = -1;
      const setP = (p: number) => {
        const q = Math.round(p * 200) / 200;
        if (q === lastP) return;
        lastP = q;
        fallback.style.setProperty(FB_PROGRESS_PROP, String(q));
      };

      const heartbeat = safe((index: number) => {
        ticks[index]?.setAttribute("data-lit", "");
        gsap.fromTo(fx, { pulse: 1 }, { pulse: 0, duration: 0.6, ease: "expo.out", overwrite: "auto" });
        if (!sceneLive) {
          gsap.fromTo(
            fallback,
            { scale: 1.05 },
            { scale: 1, duration: 0.7, ease: "expo.out", overwrite: "auto" },
          );
        }
      });

      const render = safe(() => {
        if (locked) return;
        const p = shown.p;
        setBar(p);
        setFxProgress(p);
        flightTo(flightFromProgress(p));
        setP(p);
        // 100 is reserved for the lock: the counter never claims done before the burst.
        const whole = Math.min(99, Math.floor(p * 100));
        if (whole !== lastWhole) {
          lastWhole = whole;
          counter.textContent = String(whole).padStart(2, "0");
        }
        const step = Math.min(90, Math.floor(p * 10) * 10);
        if (step !== lastStep) {
          lastStep = step;
          readout.setAttribute("aria-valuenow", String(step));
        }
        while (beats < HEARTBEATS.length && p >= HEARTBEATS[beats]) {
          heartbeat(beats);
          beats += 1;
        }
      });

      const chase = gsap.quickTo(shown, "p", { duration: 0.45, ease: "power3.out", onUpdate: render });

      // ---- scene lifecycle -----------------------------------------------------------
      const sceneReady = safe(() => {
        signals.scene = true;
        if (sceneGone || timeline) return;
        /* Too late to be worth cross-fading to: see INTRO_TIMING.LATE_SCENE_GOAL. `goal` is
           declared below in this same closure; every call of this arrives after that line. */
        if (goal >= T.LATE_SCENE_GOAL) {
          sceneFailed();
          return;
        }
        sceneLive = true;
        root.setAttribute("data-renderer", "webgl");
        setScene((current) => (current === "loading" ? "ready" : current));
        gsap.to(canvasHost, { opacity: 1, duration: 0.5, ease: "power2.out" });
        gsap.to(fallback, { autoAlpha: 0, duration: 0.5, ease: "power2.out" });
      });

      /* No scene after all: never capable, too slow (cutoff), a skip before it was ready,
         a lost context or an error. The SVG takes (or keeps) the stage. */
      const sceneFailed = safe(() => {
        signals.scene = true;
        if (sceneGone) return;
        sceneGone = true;
        root.setAttribute("data-renderer", "fallback");
        setScene("off");
        if (sceneLive && !timeline) {
          gsap.to(canvasHost, { opacity: 0, duration: 0.2, overwrite: "auto" });
          gsap.to(fallback, { autoAlpha: 1, duration: 0.3, overwrite: "auto" });
        }
        sceneLive = false;
      });

      sceneHooks.current = { ready: sceneReady, failed: sceneFailed };

      // ---- burst -----------------------------------------------------------------------
      const lock = () => {
        locked = true;
        counter.textContent = "100";
        setBar(1);
        setFxProgress(1);
        readout.setAttribute("aria-valuenow", "100");
        label.textContent = latest.current.t("intro.complete");
        label.setAttribute("data-complete", "");
        for (const tick of ticks) tick.setAttribute("data-lit", "");
      };

      const reveal = () => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && root.contains(active)) active.blur();
        onReveal();
      };

      const buildBurst = (): gsap.core.Timeline => {
        const webgl = sceneLive;
        /* A skip during the first two beats leaves the drawing half-assembled with no screen
           to fly at. Snap it to the composed machine in the same frame the burst is built:
           the 0.22s implosion and the label's glitch cover the jump. */
        if (!webgl) fallback.style.setProperty(FB_PROGRESS_PROP, String(Math.max(shown.p, 0.84)));
        const blur = TIER_CONFIG[capability.tier].blurEntrance;
        const tl = gsap.timeline({
          paused: true,
          onComplete: () => {
            dropEmptyRevealStyles();
            onDone();
          },
        });

        tl.addLabel("lock", 0)
          .call(lock, undefined, "lock")
          // implosion: the core draws in, the rim charges, the HUD glitches
          .to(fx, { charge: 1, duration: 0.22, ease: "power2.in" }, "lock")
          .to(label, { keyframes: { opacity: [1, 0.25, 1, 0.5, 1] }, duration: 0.22, ease: "none" }, "lock")
          .addLabel("burst", 0.22)
          .to(fx, { charge: 0, burst: 1, duration: 0.5, ease: "expo.out" }, "burst")
          .to(fx, { explode: 1, duration: 0.9, ease: "expo.out" }, "burst")
          .to(fx, { flash: 1, duration: 0.08, ease: "power1.out" }, "burst")
          .to(fx, { flash: 0, duration: 0.5, ease: "power2.in" }, "burst+=0.08")
          /*
           * The dive into the screen, from wherever the flight had got to.
           *
           * It starts at the LOCK, not at the burst, and lands at DIVE_END — a beat before the
           * page is uncovered at 0.72. That timing is the whole shot. Run from the burst over
           * 0.85s it finished at 1.07, by which point the overlay was a third faded: the camera
           * reached the display's cover distance underneath a page that was already coming in,
           * so the last sixth of the flight — the frame the key table is built around — was
           * never actually seen. Landing early instead holds the full-frame display still for
           * the whole 0.55s fade, which is the "fly into the screen, the site is behind it"
           * beat rather than a crossfade over a moving camera.
           *
           * Starting at the lock costs nothing: the 0.22s implosion is `fx.charge`, and nothing
           * in `three/laptop.ts` reads it — on the 3D path those frames were a held pose.
           *
           * The ease is chosen when the timeline is built (at the lock), because a skip can
           * start this from any beat: `power3.in` from a standing start spends its first 140ms
           * not moving, which after a button press reads as the skip having done nothing.
           */
          .to(
            fx,
            {
              flight: 1,
              duration: DIVE_END,
              ease: fx.flight < 0.5 ? "power2.inOut" : "power3.in",
              overwrite: "auto",
            },
            "lock",
          )
          .fromTo(
            flash,
            { opacity: 0, scale: 0.3 },
            { opacity: 0.9, scale: 1.8, duration: 0.3, ease: "power2.out" },
            "burst+=0.04",
          )
          .to(flash, { opacity: 0, duration: 0.45, ease: "power2.in" }, "burst+=0.34")
          .fromTo(
            shock,
            { opacity: 1, scale: 0 },
            { opacity: 0, scale: 4, duration: 0.7, ease: "expo.out" },
            "burst",
          )
          .to([hud, skipButton], { opacity: 0, y: 10, duration: 0.25, ease: "power2.in" }, "burst");

        if (!webgl) {
          /* The DOM-only burst: the drawing draws in, then the display flies at the viewer and
             fades. Transform + opacity only, NO blur — this is the path of devices without a
             usable GPU, where a filter over a 4.6x full-screen layer costs whole seconds per
             frame (measured under SwiftShader); the flash hides the hard edge anyway. */
          tl.to(fallback, { scale: 0.9, duration: 0.22, ease: "power2.in", overwrite: "auto" }, "lock")
            /* The last beat, on the drawing, landing where the camera's does and for the same
               reason: the composed machine is held through the fade rather than still moving
               under it. A normal run starts this at ~0.995 and it is all but a no-op; a skip
               starts it at the 0.84 clamp above and it carries the machine the rest of the way. */
            .to(fallback, { [FB_PROGRESS_PROP]: 1, duration: DIVE_END, ease: "power2.out" }, "lock")
            /* 4.6, not the ∞'s 2.6, and it is derived rather than chosen. The drawing scales
               about the display's centre, and the display is 0.532 of the stage, which is itself
               1.28 `--intro-w` wide: 0.532 × 1.28 × 4.6 = 3.13 `--intro-w` of cover. The worst
               case is an ultrawide window, where `min(50vw, 84vh)` resolves to the 84vh arm and
               `--intro-w` is only ~36vw — 3.13 of it is 113vw, so the screen still reaches past
               the frame. At 2.6 it stopped at 64vw and the burst ended inside a visible border. */
            .to(fallback, { scale: 4.6, autoAlpha: 0, duration: 0.8, ease: "power3.in" }, "burst");
        }

        tl.addLabel("reveal", 0.72)
          .set(root, { pointerEvents: "none" }, "reveal")
          .call(reveal, undefined, "reveal")
          .to(root, { autoAlpha: 0, duration: 0.55, ease: "power2.inOut" }, "reveal")
          // The scene stops drawing once nobody can see it; it is disposed with the overlay
          // at the end of the entrance, so GPU teardown never janks the header/hero.
          .call(
            () => setScene((current) => (current === "ready" ? "paused" : current)),
            undefined,
            "reveal+=0.55",
          );

        // Built now, at lock, while the overlay is still opaque: the from() states render at
        // once, invisibly, and play from "reveal".
        addEntrance(tl, blur);
        return tl;
      };

      const startBurst = safe((speed: number) => {
        if (timeline) {
          // Idempotent: a second skip only ever speeds it up.
          if (speed > timeline.timeScale()) timeline.timeScale(speed);
          return;
        }
        gsap.ticker.remove(tick);
        gsap.killTweensOf(shown);
        // The progress-driven camera tween must not fight the burst's own.
        gsap.killTweensOf(fx);
        if (!sceneLive) sceneFailed();
        timeline = buildBurst();
        timeline.timeScale(speed).play(0);
      });

      // ---- the sync loop ---------------------------------------------------------------
      let goal = 0;
      const tick = () => {
        const now = performance.now();
        const elapsed = now - origin;
        const ready =
          WEIGHT.hydrated +
          (signals.fonts ? WEIGHT.fonts : 0) +
          (signals.load ? WEIGHT.load : 0) +
          (signals.scene ? WEIGHT.scene : 0);
        const x = Math.min(1, Math.max(0, elapsed / T.MIN_SYNC_MS));
        const cinematic = 1 - (1 - x) ** 2.2;
        let target = Math.min(cinematic, elapsed >= T.HARD_CAP_MS ? 1 : ready);
        if (target >= 0.999) target = 1;
        if (target > goal + 0.002 || (target === 1 && goal < 1)) {
          goal = target;
          chase(goal);
        }
        if (!signals.scene && shown.p >= T.SCENE_CUTOFF) sceneFailed();
        if (goal === 1 && shown.p >= 0.995 && now - takeover >= T.MIN_JS_RUN_MS) startBurst(1);
      };
      gsap.ticker.add(tick);

      registerSkip(() => startBurst(SKIP_SPEED));

      return () => {
        gsap.ticker.remove(tick);
        /* Explicitly, not just by context revert: a revert re-renders a killed tween at its
           start value, which would put the camera back inside the processor on the way out. */
        gsap.killTweensOf(fx);
        gsap.ticker.lagSmoothing(500, 33);
        window.removeEventListener("load", onLoad);
        document.removeEventListener("visibilitychange", onVisibility);
        registerSkip(null);
        sceneHooks.current = null;
        // Runs after the context has reverted its tweens (an interrupted entrance included).
        dropEmptyRevealStyles();
      };
    },
    { dependencies: [] },
  );

  return (
    <RenderErrorBoundary onError={onSceneFailed}>
      {scene !== "off" && (
        <IntroScene
          fx={fx}
          tier={capability.tier}
          parallax={capability.parallax}
          force3d={capability.force3d}
          paused={scene === "paused" || hidden}
          onReady={onSceneReady}
          onLost={onSceneFailed}
        />
      )}
    </RenderErrorBoundary>
  );
}
