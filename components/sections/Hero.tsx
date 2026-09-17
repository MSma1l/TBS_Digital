"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { usePointerTilt } from "@/components/fx/usePointerTilt";
import {
  HOLOGRAM_RINGS,
  OCTAHEDRON_EDGES,
  edgeTransform,
  hologramShapeFor,
  type HologramShape,
} from "@/lib/hologram";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { setSceneBoost, type SceneBoostSource } from "@/lib/scene";
import { useSiteContent } from "@/lib/siteContent";
import { TILT_MAX } from "@/lib/tilt";

/** Inline trilingual literal — keeps the hero copy out of the message catalog
    (which is typed and churny) while staying fully RO/RU/EN. */
const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const EYEBROW = L(
  "TBS DIGITAL / WEB · SOFTWARE · AI",
  "TBS DIGITAL / WEB · SOFTWARE · ИИ",
  "TBS DIGITAL / WEB · SOFTWARE · AI",
);
const TITLE = L(
  "Construim digital ce mișcă businessul.",
  "Строим digital, который двигает бизнес.",
  "We build digital that moves business.",
);
const LEAD = L(
  "De la consultanță la produs funcțional.",
  "От консалтинга до рабочего продукта.",
  "From consulting to a working product.",
);
const CTA_PRIMARY = L("Începe proiectul", "Начать проект", "Start a project");
const CTA_SECONDARY = L(
  "Explorăm serviciile ↓",
  "Смотреть услуги ↓",
  "Explore services ↓",
);
const METRICS_LABEL = L("Indicatori", "Показатели", "Metrics");

type Metric = { id: string; value: string; label: LocalizedText; note: LocalizedText };

/** The portfolio counter's copy. Its *value* is counted, never written here. */
const PROJECTS_LABEL = L(
  "proiecte în portofoliu",
  "проектов в портфолио",
  "projects in the portfolio",
);
const PROJECTS_NOTE = L("experiență aplicată", "прикладной опыт", "applied experience");

/** Metrics that don't come from the portfolio. `24/7` describes how the automations we
 *  build run, not a countable list, so it stays a fixed claim. The /02 stats are still
 *  blank placeholders (docs/06), so there is nothing real to read from the store here. */
const FIXED_METRICS: Metric[] = [
  {
    id: "automation",
    value: "24/7",
    label: L("automatizări active", "активных автоматизаций", "active automations"),
    note: L("mai puțină rutină", "меньше рутины", "less routine"),
  },
];

/*
 * The looping background layers stop in two situations, both CSS-only on the running
 * animation (`animation-play-state`, so each resumes where it stopped instead of jumping):
 *  - while the first-visit intro overlay (#tbs-intro, lib/intro.ts) is in the document — it
 *    covers the hero, and the header's backdrop blur would otherwise re-sample an animated
 *    grid under an overlay nobody can see through;
 *  - while the hero is scrolled out of view (`data-offscreen`, `useOffscreenAttribute`).
 * Reduced motion removes them altogether (`motion-reduce:`, and the global kill switch in
 * globals.css).
 */
const BG_ANIMATION_CLASSES =
  "[html:has(#tbs-intro)_&]:[animation-play-state:paused] group-data-offscreen/hero:[animation-play-state:paused] motion-reduce:animate-none";

/*
 * A stat hologram turns only while all of these hold, and rests on a three-quarter pose
 * otherwise (the negative delay parks the paused spin on that same pose, so it never jumps):
 *  - the stage allows motion: `data-motion="live"` (components/scene/SceneStage.tsx — no
 *    reduced motion, Save-Data, slow network or low-tier device);
 *  - the first-visit intro is gone, and the hero is on screen.
 * Reduced motion drops the animation outright; the resting transform stays.
 */
const HOLOGRAM_SPIN_CLASSES =
  "[transform:rotateX(-20deg)_rotateY(35deg)] animate-holo-spin [animation-delay:-1.75s] [animation-play-state:paused] [html:not(:has(#tbs-intro))_[data-motion=live]_#top:not([data-offscreen])_&]:[animation-play-state:running] motion-reduce:animate-none";

/** The CSS length of `a`, the hologram's centre-to-vertex distance (lib/hologram.ts). */
const HOLOGRAM_UNIT = "var(--holo-a)";

/**
 * A stat card's wireframe hologram: an octahedron for the portfolio, a ring gyroscope for
 * the automations. CSS 3D on hairlines — no text, no vertex dots. It is the card's FIRST
 * child, so the value and the copy paint over it; it sits in the top-right corner and the
 * card's `overflow-hidden` crops what spills out.
 */
function MetricHologram({ shape }: { shape: HologramShape }) {
  return (
    <span
      aria-hidden="true"
      data-hologram={shape}
      className="pointer-events-none absolute -top-5 -right-5 size-24 opacity-50 perspective-[600px] [--holo-a:26px] sm:-top-6 sm:-right-6 sm:size-28 sm:[--holo-a:30px]"
    >
      <span className={`absolute inset-0 transform-3d ${HOLOGRAM_SPIN_CLASSES}`}>
        {shape === "octahedron"
          ? OCTAHEDRON_EDGES.map((edge, i) => (
              <span
                key={i}
                className="absolute inset-0 m-auto h-px w-[calc(var(--holo-a)*1.4142)] bg-(--accent) shadow-[0_0_6px_var(--accent)]"
                style={{ transform: edgeTransform(edge, HOLOGRAM_UNIT) } satisfies CSSProperties}
              />
            ))
          : HOLOGRAM_RINGS.map((ring) => (
              <span
                key={ring}
                className="absolute inset-0 m-auto size-[calc(var(--holo-a)*2)] rounded-full border border-(--accent) shadow-[0_0_6px_var(--accent)]"
                style={{ transform: ring } satisfies CSSProperties}
              />
            ))}
      </span>
    </span>
  );
}

type PointerLike = { pointerType: string };
type FocusLike = { currentTarget: Element };

/** Whether a focus is one the visitor can see (a keyboard's), not a script's or a click's. */
function focusVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    // An engine without the selector: treat the focus as a keyboard's, as before.
    return true;
  }
}

/*
 * The CTAs brighten the 3D core while hovered by a real pointer (never a finger: a tap has
 * no hover to end it) or while keyboard-focused. Only a signal to the scene (lib/scene.ts): no
 * sound and no `play()` here — the click keeps its own feedback in the request flow.
 *
 * Hover and focus are two separate reasons per CTA, and the scene hears their OR: moving the
 * mouse off a keyboard-focused CTA keeps its boost, and a blur while still hovered keeps it too.
 * A focus that is not `:focus-visible` never boosts — the request dialog hands focus back to the
 * CTA with `focus()` when it closes, and after a mouse close that is not a keyboard focus (the
 * boost used to stay on, and play a light wave, until something else took focus).
 */
function boostHandlers(source: SceneBoostSource) {
  const reasons = { hover: false, focus: false };
  const apply = () => setSceneBoost(source, reasons.hover || reasons.focus);
  return {
    onPointerEnter: (event: PointerLike) => {
      if (event.pointerType === "touch") return;
      reasons.hover = true;
      apply();
    },
    onPointerLeave: (event: PointerLike) => {
      if (event.pointerType === "touch") return;
      reasons.hover = false;
      apply();
    },
    onFocus: (event: FocusLike) => {
      reasons.focus = focusVisible(event.currentTarget);
      apply();
    },
    onBlur: () => {
      reasons.focus = false;
      apply();
    },
    /** Unmount: neither reason survives the page. */
    release: () => {
      reasons.hover = false;
      reasons.focus = false;
      setSceneBoost(source, false);
    },
  };
}

const { release: releasePrimary, ...PRIMARY_BOOST } = boostHandlers("hero-primary");
const { release: releaseSecondary, ...SECONDARY_BOOST } = boostHandlers("hero-secondary");

export type HeroProps = {
  /** The interior stage's static core illustration (components/scene/art/HeroCoreArt.tsx),
   *  a server-rendered slot from app/(site)/page.tsx. Bare renders simply get none. */
  coreArt?: ReactNode;
};

export function Hero({ coreArt }: HeroProps) {
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  const { projects } = useSiteContent();
  const sectionRef = useRef<HTMLElement>(null);

  // Counted from the real portfolio the /04 grid renders — so the number the hero claims
  // and the number of cards below it can never drift apart. An empty portfolio shows no
  // counter at all rather than a bare "0".
  const metrics: Metric[] = [
    ...(projects.length > 0
      ? [
          {
            id: "projects",
            value: String(projects.length),
            label: PROJECTS_LABEL,
            note: PROJECTS_NOTE,
          },
        ]
      : []),
    ...FIXED_METRICS,
  ];

  // Off-screen pause (see BG_ANIMATION_CLASSES and HOLOGRAM_SPIN_CLASSES).
  useOffscreenAttribute(sectionRef);

  // Leaving the page while a CTA is hovered or focused must not leave the scene boosted.
  useEffect(
    () => () => {
      releasePrimary();
      releaseSecondary();
    },
    [],
  );

  // One hook for both cards: a pointer is over one card at a time.
  const tilt = usePointerTilt(TILT_MAX.metric);

  const title = l(TITLE);

  return (
    <section ref={sectionRef} id="top" className="group/hero relative overflow-hidden">
      {/* Paint order. The interior stage (components/scene/SceneStage.tsx) is the stacking
          context, not this section — `isolate` here would lift the plate and the backdrop
          ABOVE the stage's canvas. Back to front: this opaque plate (-20; it hides the body's
          page grid), the backdrop marker (-10), the stage's canvas layer, the phone scrim,
          then the copy. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 bg-bg" />

      {/* Decorative HUD backdrop. `data-intro-reveal="grid"` is the entrance target for the
          whole layer (opacity + scale), so nothing inside it carries its own transform
          transition. Every oversized piece is clipped by the section's overflow-hidden. */}
      <div
        aria-hidden="true"
        data-intro-reveal="grid"
        className="pointer-events-none absolute inset-0 -z-10 [container-type:size]"
      >
        {/* The lit layers move together under the desktop scroll parallax (`data-parallax`,
            driven by the stage's director). Never the marker itself: the entrance owns its
            transform. */}
        <div data-parallax="hero-backdrop" className="absolute inset-0">
          {/* The two key lights have tokens of their own (--hero-glow-*): the copy sits in
              them, and the light theme needs much fainter glows to keep that text AA. */}
          {/* red key light, low left — behind the headline */}
          <div className="absolute -left-[28%] top-[22%] size-[62vmax] rounded-full bg-[radial-gradient(closest-side,var(--hero-glow-red),transparent)] opacity-60" />
          {/* blue fill light, top right — behind the stats (behind the copy on phones) */}
          <div className="absolute -right-[22%] -top-[30%] size-[58vmax] rounded-full bg-[radial-gradient(closest-side,var(--hero-glow-blue),transparent)]" />
          {/* the flat HUD grid on the "wall", dissolved before the floor starts so the two
              grids never cross */}
          <div className="cyber-grid fade-b absolute inset-x-0 top-0 h-[72%] opacity-80" />
          {/* the grid laid down as a perspective floor, with brighter lines than the wall (a
              1px line at that angle loses most of its coverage). The floor owns `transform`,
              so the drift runs on its child. */}
          <div className="cyber-floor absolute inset-x-[-50%] bottom-0 h-[64%] overflow-hidden [--hud-grid-line:color-mix(in_srgb,var(--blue)_42%,transparent)]">
            <div
              className={`cyber-grid absolute inset-x-0 -top-(--grid-cell) bottom-0 animate-grid-drift will-change-transform ${BG_ANIMATION_CLASSES}`}
            />
          </div>
          {/* scanner: a hairline with a short, faint wake, sweeping down the hero. Kept thin —
              on the light palette any wider band reads as a block, not as light. */}
          <div
            className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-blue/45 to-transparent animate-scan motion-reduce:hidden before:absolute before:inset-x-0 before:bottom-0 before:h-10 before:bg-linear-to-b before:from-transparent before:to-(--hud-grid-line) before:opacity-50 before:content-[''] ${BG_ANIMATION_CLASSES}`}
          />
        </div>

        {/* The core's host, outside the parallax layer: the WebGL core follows this anchor,
            the static art sits in it. Decorative only — nothing in here is text, focusable, a
            heading or has a role.
             · Phones: centred behind the headline, at --hero-core-phone (globals.css: faded on
               the light page, whole on the dark one, where the canvas it crossfades into is
               brighter than the faded art).
             · 861–1024px: the right-hand column is narrower than the core and the stat cards
               stack in it, so the core sits on the seam between the columns, raised to the
               top: centred behind the cards they covered 86–88% of its sphere (861×700 to
               1024×768); here 34–39%, and 16% at 900×800.
             · From 1025px: the right-hand column, centred, at full strength. */}
        <div
          data-testid="scene-hero"
          className="absolute inset-0 mx-auto max-w-(--maxw) px-(--gutter)"
        >
          <div
            data-scene-anchor="hero"
            className="absolute left-1/2 top-[clamp(12px,6vw,40px)] aspect-square w-[min(92vw,480px)] -translate-x-1/2 opacity-(--hero-core-phone) md:left-auto md:right-[calc(var(--gutter)+11.5vw)] md:top-[clamp(8px,1.5vw,16px)] md:w-[min(38vw,420px)] md:translate-x-0 md:opacity-100 lg:right-(--gutter) lg:top-1/2 lg:w-[min(42vw,600px)] lg:-translate-y-1/2"
          >
            {coreArt}
          </div>
        </div>

        {/* hand-off into the ticker below — over the art too, so the core dissolves into it */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-bg" />
      </div>

      {/* Phones only: a soft pool of the page colour behind the eyebrow, headline and lead —
          over the core (art or canvas), under the copy — so the text keeps its contrast.
          Centred like the core it covers: the lead spans the full width, and a pool centred
          on the copy's left edge left 4% of the light theme's lead pixels under 4.5:1 at
          390px. Its strength is a theme token (--hero-scrim, globals.css): the light page needs
          more of it over the WebGL core than over the static art. */}
      <div
        aria-hidden="true"
        data-scene-scrim=""
        className="pointer-events-none absolute inset-x-0 top-0 h-[75%] bg-[radial-gradient(125%_70%_at_50%_40%,var(--bg)_30%,transparent_78%)] opacity-(--hero-scrim) md:hidden"
      />

      {/* ≤860px one column (copy, then stats). From 861px two columns filling the first
          screen with the ticker: `content-center` keeps the row as tall as the copy and
          centres it, `items-end` then sits the stats on the CTA row's baseline. */}
      <div className="relative mx-auto grid w-full max-w-(--maxw) gap-[clamp(32px,5vw,56px)] px-(--gutter) pt-[clamp(32px,7vw,88px)] pb-[clamp(48px,7vw,88px)] md:min-h-[min(860px,calc(100svh_-_var(--header-h)_-_var(--ticker-h)))] md:grid-cols-[1.3fr_.7fr] md:content-center md:items-end">
        <div className="min-w-0">
          <p
            data-intro-reveal="eyebrow"
            className="m-0 flex items-center gap-2.5 font-hud text-xs font-bold uppercase leading-[1.4] tracking-[.1em] text-red-text sm:text-sm"
          >
            {l(EYEBROW)}
            <span
              aria-hidden="true"
              className="hidden h-px w-12 bg-linear-to-r from-red/70 to-transparent sm:block"
            />
          </p>

          {/* The page's only <h1>, and its LCP element: the entrance moves and blurs it, but
              nothing may ever hide it (no opacity / visibility, here or in the intro). The
              closing full stop is split off only to colour it red — a glyph, never a glow. */}
          <h1
            data-intro-reveal="title"
            className="mt-4 mb-0 max-w-[16ch] text-balance font-disp text-[clamp(34px,8.6vw,74px)] font-black uppercase leading-[.98] tracking-[-0.045em] text-txt [overflow-wrap:break-word] md:mt-5 md:text-[clamp(44px,5.4vw,92px)]"
          >
            {title.endsWith(".") ? (
              <>
                {title.slice(0, -1)}
                <span className="text-red">
                  .
                </span>
              </>
            ) : (
              title
            )}
          </h1>

          <p
            data-intro-reveal="lead"
            className="m-0 mt-5 max-w-[34rem] font-copy text-[clamp(16px,2vw,19px)] leading-[1.6] text-mut md:mt-6"
          >
            {l(LEAD)}
          </p>

          {/* The entrance targets this wrapper, never the button: the button's hover lift is
              a `translate` transition that a GSAP `transform` would fight. */}
          <div
            data-intro-reveal="cta"
            className="mt-8 flex flex-col items-stretch gap-3 xs:flex-row xs:flex-wrap xs:items-center xs:gap-4"
          >
            {/* Opens the request dialog in place. A <button>, not an <a href="#contact">: it
                no longer navigates anywhere. Its accessible name is the label alone — the
                arrow is an aria-hidden SVG with no <title>, and there is no text-transform,
                so it never reads like the header's "START PROIECT ↗" (nav.cta). */}
            <button
              type="button"
              onClick={() => openRequest({ source: "hero" })}
              {...PRIMARY_BOOST}
              className="cta-neon group/cta inline-flex min-h-14 items-center justify-center gap-2.5 rounded-md px-6.5 py-4 font-copy text-base font-bold leading-[1.55] shadow-neon-red-strong"
            >
              {l(CTA_PRIMARY)}
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4 shrink-0 transition-[translate] duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover/cta:translate-none"
              >
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </button>
            <a
              href="#servicii"
              {...SECONDARY_BOOST}
              className="relative inline-flex min-h-14 items-center justify-center rounded-md border border-glass-line bg-glass px-6 py-3 font-hud text-sm font-bold uppercase leading-[1.4] tracking-[.08em] text-txt no-underline transition-[border-color,color,box-shadow] duration-200 hover:border-blue hover:text-blue-text hover:shadow-neon-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none"
            >
              {l(CTA_SECONDARY)}
            </a>
          </div>
        </div>

        {/* Metrics. The entrance moves this group as a whole (transform only), so the cards'
            glass keeps blurring and their own hover lift (`translate`) never fights it. The
            wrapper is the desktop scroll-parallax layer; the marker itself never moves. */}
        <div data-parallax="hero-stats" className="min-w-0">
          <div
            data-intro-reveal="stats"
            role="group"
            aria-label={l(METRICS_LABEL)}
            className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4 lg:grid-cols-2"
          >
            {/* A card tilts under a mouse: usePointerTilt writes --tilt-rx / --tilt-ry and
                data-tilting on the CARD, never on the marker. The tilt is a `transform`, the
                hover lift a `translate`, so the two compose. */}
            {metrics.map((m) => (
              <div
                key={m.id}
                data-metric={m.id}
                data-tilt={tilt.enabled ? "on" : "off"}
                {...tilt.handlers}
                className={`relative overflow-hidden rounded-lg border border-glass-line p-4 shadow-lg transition-[translate,border-color,transform] duration-300 ease-(--motion-ease-out) hover:-translate-y-1 hover:border-(--accent) max-md:bg-glass-solid motion-reduce:transition-none motion-reduce:hover:translate-none sm:p-5 md:glass data-tilting:duration-150 data-tilting:[transform:perspective(900px)_rotateX(var(--tilt-rx))_rotateY(var(--tilt-ry))] before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-(--accent) before:to-transparent before:content-[''] ${
                  m.id === "projects" ? "[--accent:var(--red)]" : "[--accent:var(--blue)]"
                }`}
              >
                <MetricHologram shape={hologramShapeFor(m.id)} />
                <b className="relative block font-disp text-[clamp(32px,4.2vw,48px)] font-black leading-none tracking-[-0.04em] text-txt">
                  {m.value}
                </b>
                <span className="relative mt-2.5 block font-copy text-md leading-[1.4] text-mut [overflow-wrap:anywhere]">
                  {l(m.label)}
                </span>
                <small className="relative mt-3 block font-hud text-xs font-bold uppercase leading-[1.4] tracking-[.08em] text-green-text">
                  {l(m.note)}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
