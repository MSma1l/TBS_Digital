"use client";

import { Fragment, type CSSProperties } from "react";
import { usePointerTilt } from "@/components/fx/usePointerTilt";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { TILT_MAX } from "@/lib/tilt";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  eyebrow: L("Portofoliu TBS", "Портфолио TBS", "TBS portfolio"),
  title: L("Proiectele care ne reprezintă.", "Проекты, которые говорят за нас.", "The projects that speak for us."),
  lead: L(
    "De la platforme web la aplicații mobile — produse duse până la lansare.",
    "От веб-платформ до мобильных приложений — продукты, доведённые до запуска.",
    "From web platforms to mobile apps — products taken all the way to launch.",
  ),
};

/* ---------- Card gradients ----------
   Presentation only, so it stays in the component: the *content* (names, tags,
   descriptions, links, screenshots) comes from the store, while each card's brand colours
   are part of this section's design. Keyed by project id so a card keeps its colours no
   matter where it lands in the order. A project the admin adds — or one whose screenshot is
   missing — falls back to a palette entry picked by position, so it is still a finished
   coloured card, never an empty box. */
const GRADIENTS: Record<string, readonly [string, string]> = {
  bizcheck: ["#192f6f", "#4b7dff"],
  "itara-global": ["#173b3d", "#10a99b"],
  docusafe: ["#6d2348", "#e5527d"],
  "crowe-portal": ["#1b2a52", "#3f63d8"],
  cgam: ["#53397d", "#9671dd"],
  "iq-arena": ["#734328", "#e38a4f"],
  "balloons-breeze": ["#3a1c10", "#b3801f"],
  "statistica-md": ["#0d3a7a", "#1f6fd0"],
  statistic: ["#0f2a52", "#3f7fe0"],
  flirt: ["#1a0510", "#ff2d78"],
};

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#192f6f", "#4b7dff"],
  ["#173b3d", "#10a99b"],
  ["#53397d", "#9671dd"],
  ["#734328", "#e38a4f"],
  ["#6d2348", "#e5527d"],
];

function gradientFor(project: ProjectItem, position: number): readonly [string, string] {
  return (
    GRADIENTS[project.id] ??
    FALLBACK_GRADIENTS[position % FALLBACK_GRADIENTS.length]
  );
}

/** "CRM PRIVAT · FĂRĂ LINK" → ["CRM PRIVAT", "FĂRĂ LINK"]. The tag is free localized text
 *  (admin data), so its segments are the only chips a project has. */
function tagChips(tag: string): string[] {
  return tag
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

/* ---------- The HUD card ----------
   The card root (`a` or `article`) carries the gradient (`--p1/--p2`, inline), the lift, the
   neon edge and the pointer tilt. Everything decorative is an aria-hidden layer under the
   copy, in this paint order: screenshot → scan → wash → glass edge and corner brackets → copy.

   - Neon edge: on hover and keyboard focus the border, an inner ring and a soft glow all
     take the card's own accent (--p2).
   - Tilt (components/fx/usePointerTilt): the hook writes --tilt-rx/--tilt-ry and
     `data-tilting` on the card; the transform is applied from 641px up only, where the
     cards are a grid and not a scroll band. A mouse only, never under reduced motion.
   - The lift is `translate`, the tilt is `transform`: two properties, so neither fights
     the other, and the tilt settles back through the same 300ms transition.
   - ≤640px the grid is a snap band (see GRID_CLASSES): no lift inside the scroll box, where
     it would clip, and the focus ring moves inside the card for the same reason. */
const CARD_CLASSES =
  "group/card relative isolate flex min-h-61 flex-col overflow-hidden rounded-lg border border-glass-line bg-linear-[145deg] from-(--p1) to-(--p2) p-5.5 text-on-accent no-underline shadow-md " +
  "transition-[translate,box-shadow,border-color,transform] duration-300 ease-(--motion-ease-out) " +
  "hover:-translate-y-[5px] hover:border-[color-mix(in_srgb,var(--p2)_75%,transparent)] hover:shadow-[0_18px_48px_color-mix(in_srgb,var(--p2)_32%,transparent)] " +
  "focus-visible:border-[color-mix(in_srgb,var(--p2)_75%,transparent)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-red " +
  "data-tilting:duration-150 sm:data-tilting:[transform:perspective(1000px)_rotateX(var(--tilt-rx))_rotateY(var(--tilt-ry))] " +
  "max-sm:flex-[0_0_min(390px,max(82vw,320px))] max-sm:max-w-full max-sm:snap-start max-sm:hover:translate-none max-sm:focus-visible:-outline-offset-3 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-none";

/* The screenshot's wrapper is the parallax target: `parallax-media` (app/tailwind.css) plays
   a small drift + 1.12 scale across the section's view timeline (`view-work` on the
   section), on the compositor, only where scroll-driven animations exist and motion is
   allowed. It is NOT aria-hidden — the image inside keeps its role and alt.
   The luminosity blend sits on the wrapper, not on the <img>: the running animation makes
   the wrapper a stacking context, and an <img> blending inside it would only see the
   wrapper's empty backdrop instead of the card gradient. */
const MEDIA_CLASSES = "parallax-media pointer-events-none absolute inset-0 mix-blend-luminosity";
/* `work-media-reveal` (app/tailwind.css) is inert everywhere but inside the scene's spiral: there
   the screenshot is clipped by `--helix-wipe`, which the scene writes from the card's own place on
   the strand — so the picture is drawn on, from its bottom edge up, while the card climbs into the
   zone under the visitor's eye, and is whole well before the card reaches the front. */
const IMAGE_CLASSES =
  "work-media-reveal block size-full object-cover object-top opacity-56 transition-[scale,opacity] duration-400 ease-(--motion-ease-out) group-hover/card:scale-108 group-hover/card:opacity-78 motion-reduce:transition-none";

/* The scan layer: a sheet of hairlines with a bright leading edge that sits on the screenshot's
   wipe edge as the card climbs (`::before`, moved by the same `--helix-wipe`), and a single bar
   that crosses the card when it reaches the front of the spiral — the same moment the helix
   flares and the hologram swaps to it (`::after`, the one timed animation). Both are in the
   card's own accent, both are transform + opacity, both are only ever live inside the spiral.
   It sits directly on the screenshot, UNDER both washes: over the picture it reads at full
   strength, and under the copy the same 82–94% ink that gives the text its contrast floor
   attenuates it exactly as it attenuates the screenshot. So no pass can ever take a line of
   copy below its measured floor, whatever a card's accent is. Never in the pointer's way. */
const SCAN_CLASSES = "work-scan";

/* Dark wash under the copy, as two layers that cross-fade.
   The light one is the resting desktop wash: the screenshot shows through most of the card.
   The strong one holds ~82% ink up to 46% of the card height. Measured on the brightest
   pixel under the copy of the first card, at 375px, with the text hidden: over the light
   wash the description ran 4.01:1 in light and 3.75:1 in dark (AA wants 4.5:1 for 13px) and
   the name 2.99:1 / 2.88:1; over the strong one 6.4:1 / 6.0:1, while the top half still
   shows the screenshot, which is the point of the card. So the strong wash is on whenever
   the description is: always on touch screens and ≤640px (see DESC_CLASSES), and on hover
   or keyboard focus on a desktop.
   Re-measured the same way on this card (all nine seeded projects, both themes, 320–1280px,
   tags moved to the top): the name ≥7.2:1 at rest and ≥4.4:1 while the description is open
   (large text, AA 3:1), the description ≥5.6:1, the chips ≥8.1:1 (at 390 and 1280).
   A card without a screenshot gets the same wash: its white copy would otherwise sit on
   the bare accent (#10a99b is 2.9:1). */
const WASH_REST_CLASSES =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--ink)_85%,transparent)_6%,color-mix(in_srgb,var(--ink)_18%,transparent)_76%)] transition-opacity duration-300 group-hover/card:opacity-0 group-focus-visible/card:opacity-0 max-sm:hidden motion-reduce:transition-none [@media(hover:none)]:hidden";
const WASH_READ_CLASSES =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_srgb,var(--ink)_94%,transparent)_0%,color-mix(in_srgb,var(--ink)_82%,transparent)_46%,color-mix(in_srgb,var(--ink)_20%,transparent)_92%)] opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 max-sm:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100";

/* The glass: a faint diagonal reflection and a hairline inner edge, both in --on-accent,
   that turn into the neon tube (the accent) on hover. No backdrop-filter over a whole card:
   the screenshot under it moves with the parallax, and nine live blurs would re-sample it on
   every scrolled frame. */
const GLASS_CLASSES =
  "pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(155deg,color-mix(in_srgb,var(--on-accent)_13%,transparent)_0%,transparent_38%)] inset-ring inset-ring-on-accent/12 transition-[box-shadow] duration-300 group-hover/card:inset-ring-[color-mix(in_srgb,var(--p2)_70%,transparent)] group-focus-visible/card:inset-ring-[color-mix(in_srgb,var(--p2)_70%,transparent)] motion-reduce:transition-none";

/* The accent hairline along the top edge, the same mark the hero's stat cards carry; it
   brightens with the neon edge. */
const EDGE_CLASSES =
  "absolute inset-x-5 top-0 h-px bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--p2)_65%,var(--on-accent))] to-transparent opacity-70 transition-opacity duration-300 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none";

/* HUD corner brackets, drawn in from the corners on hover / focus, clear of the chips and
   the index. Straight 2px strokes, never a dot. */
const BRACKET_CLASSES =
  "pointer-events-none absolute size-3 border-on-accent/85 opacity-0 transition-[opacity,translate] duration-300 ease-(--motion-ease-out) group-hover/card:translate-none group-hover/card:opacity-100 group-focus-visible/card:translate-none group-focus-visible/card:opacity-100 motion-reduce:transition-none";
const BRACKETS = [
  "top-1.5 left-1.5 translate-x-1 translate-y-1 border-t-2 border-l-2",
  "top-1.5 right-1.5 -translate-x-1 translate-y-1 border-t-2 border-r-2",
  "bottom-1.5 left-1.5 translate-x-1 -translate-y-1 border-b-2 border-l-2",
  "bottom-1.5 right-1.5 -translate-x-1 -translate-y-1 border-b-2 border-r-2",
] as const;

/* A chip reads over the top of the screenshot, so it carries its own ink plate: white on
   72% ink over a pure-white pixel is 6.9:1 (light ink) and 6.1:1 (dark ink), the floor for
   any screenshot. No backdrop blur: the floor never depended on it, and a chip sits over the
   parallax screenshot, so every blur would re-sample it on each scrolled frame (the cost the
   glass above already rules out for whole cards). */
const CHIP_CLASSES =
  "inline-flex max-w-full items-center rounded-sm border border-on-accent/18 bg-[color-mix(in_srgb,var(--ink)_72%,transparent)] px-2 py-1 font-hud text-xs font-bold uppercase leading-[1.25] tracking-[.08em]";

/* The admin's "·" between two chips stays (decision D7), as text in the card: the tag still
   reads "CRM PRIVAT · FĂRĂ LINK", and a screen reader gets a boundary between two tags instead
   of "CRM PRIVAT FĂRĂ LINK". It IS the joint between the chips (the row has no column gap): on
   the chips' own 72% ink plate and hairline, with the chips' inner corners squared (chipClasses),
   so a multi-part tag reads as one segmented strip and the glyph gets the plate's contrast floor
   over any screenshot — an ink halo around the bare 2px glyph measured only 3.0–3.6:1 over the
   brightest ones. The spaces around it collapse at the flex item's edges. */
const TAG_SEPARATOR_CLASSES =
  "flex items-center border-y border-on-accent/18 bg-[color-mix(in_srgb,var(--ink)_72%,transparent)] px-1.5 font-hud text-xs font-bold leading-[1.25]";

/** A chip's classes at position `n` of `count`: the corners it shares with a joint are square. */
const chipClasses = (n: number, count: number) =>
  `${CHIP_CLASSES}${n > 0 ? " rounded-l-none" : ""}${n < count - 1 ? " rounded-r-none" : ""}`;

/* The description is not a hover reward on a screen that cannot hover: `(hover: none)` also
   covers a touch tablet at 768/1024, and `max-sm:` keeps a narrowed desktop window showing
   the same thing (the same OR as the card wash above). A desktop pointer at full width
   keeps the reveal, on hover and on keyboard focus.
   Inside the scene's spiral (`[data-scene-stage][data-helix=spiral]`, workHelix.ts) a card is
   narrower (240–340px) and as tall as its content, so a shown description is not capped there:
   at 240px a long one (IQ Arena, ~9 lines) ran past the 140px cap and the card's
   `overflow: hidden` cut its last lines. The selector outweighs the states it overrides. */
const DESC_CLASSES =
  "m-0 max-h-0 translate-y-2.5 font-copy text-[13px] leading-normal text-[color-mix(in_srgb,var(--on-accent)_82%,transparent)] opacity-0 transition-[max-height,opacity,translate] duration-250 " +
  "group-hover/card:max-h-35 group-hover/card:translate-y-0 group-hover/card:opacity-100 group-focus-visible/card:max-h-35 group-focus-visible/card:translate-y-0 group-focus-visible/card:opacity-100 " +
  "max-sm:max-h-35 max-sm:translate-none max-sm:opacity-100 motion-reduce:transition-none [@media(hover:none)]:max-h-35 [@media(hover:none)]:translate-none [@media(hover:none)]:opacity-100 " +
  "group-hover/card:[[data-scene-stage][data-helix=spiral]_&]:max-h-none group-focus-visible/card:[[data-scene-stage][data-helix=spiral]_&]:max-h-none [@media(hover:none)]:[[data-scene-stage][data-helix=spiral]_&]:max-h-none";

/* Three columns; two up to 900px (`max-[901px]:` is `width < 901px`, i.e. ≤900), where an
   odd last card takes the whole row instead of leaving a hole. That wide card keeps its
   screenshot at a normal card's size, on its right half with softened edges: stretched over
   ~800px, `object-cover` enlarged the top of the image ~2× (the Flirt screenshot's sign-up
   form showed its e-mail address legibly), and admin screenshots may hold anything. The
   ≤640 band is a flex row, so none of this applies there (`sm:`). Nor does it inside the
   scene's spiral (`[data-scene-stage][data-helix=spiral]`, workHelix.ts): every card is laid
   out alone there, at a normal card's width, so the screenshot fills it like any other.
   ≤640px, one snapping band instead of nine stacked cards (~2400px of scroll before the next
   section): the portfolio is one screenful and reads as a collection. The band bleeds to the
   screen edges so the next card peeks all the way out; `scroll-padding` snaps each card back
   onto the gutter, in line with the heading. It scrolls inside itself — the PAGE never gains
   a horizontal scrollbar — and a swipe off its end never chains to the page (or, on iOS,
   into the back gesture). The bottom padding is the scrollbar's lane. */
const GRID_CLASSES =
  "mt-7 grid grid-cols-3 gap-3.5 max-[901px]:grid-cols-2 max-[901px]:[&>:nth-child(odd):last-child]:col-span-2 " +
  "sm:max-[901px]:[&:not([data-scene-stage][data-helix=spiral]_*)>:nth-child(odd):last-child_[data-parallax=work-media]]:left-1/2 sm:max-[901px]:[&:not([data-scene-stage][data-helix=spiral]_*)>:nth-child(odd):last-child_[data-parallax=work-media]]:edge-fade-x " +
  "max-sm:-mx-(--gutter) max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:px-(--gutter) max-sm:pt-0.5 max-sm:pb-3.5 max-sm:[scroll-padding-inline:var(--gutter)] max-sm:[scrollbar-width:thin] max-sm:[scrollbar-color:var(--red)_transparent]";

export function Work() {
  const l = useLoc();
  const { projects } = useSiteContent();
  // One hook for the whole grid: its handlers act on `currentTarget`.
  const tilt = usePointerTilt(TILT_MAX.project);
  const tiltState = tilt.enabled ? "on" : "off";

  return (
    <section
      id="lucrari"
      className="view-work relative px-(--gutter) pt-[clamp(48px,7vw,76px)] pb-[clamp(20px,3vw,28px)]"
    >
      <div className="mx-auto max-w-(--maxw)">
        <Reveal className="mb-2 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 font-hud text-sm font-bold uppercase leading-[1.4] tracking-[.1em] text-red-text">
              {l(SECTION.eyebrow)}
              <span
                aria-hidden="true"
                className="hidden h-px w-12 bg-linear-to-r from-red/70 to-transparent sm:block"
              />
            </div>
            <h2 className="mt-2 mb-0 font-disp text-[clamp(28px,3.5vw,44px)] font-black uppercase leading-[1.05] tracking-[-0.04em] text-txt">
              {l(SECTION.title)}
            </h2>
          </div>
          <p className="m-0 max-w-[400px] font-copy text-base leading-normal text-mut">
            {l(SECTION.lead)}
          </p>
        </Reveal>

        <div className={GRID_CLASSES} data-work-track="">
          {projects.map((p, i) => {
            const [p1, p2] = gradientFor(p, i);
            const style = { "--p1": p1, "--p2": p2 } as CSSProperties;
            // The /NN label is computed from position, so adding or removing a project
            // from the admin renumbers the grid automatically.
            const index = String(i + 1).padStart(2, "0");
            // The card shows the first screenshot; the rest of the gallery stays in the
            // data. With none set the gradient above carries the card on its own.
            const image = p.images?.[0];
            const inner = (
              <>
                {image ? (
                  <div data-parallax="work-media" className={MEDIA_CLASSES}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image}
                      alt={p.name}
                      loading="lazy"
                      // Nine screenshots land in this grid. `decoding="async"` lets the
                      // browser decode them off the main thread instead of blocking it at
                      // paint time; the card is unaffected either way — the image is
                      // absolutely positioned behind the copy, so it never takes part in
                      // layout and cannot shift anything while it loads.
                      decoding="async"
                      className={IMAGE_CLASSES}
                    />
                  </div>
                ) : null}
                <span aria-hidden="true" className={SCAN_CLASSES} />
                <div aria-hidden="true" className={WASH_REST_CLASSES} />
                <div aria-hidden="true" className={WASH_READ_CLASSES} />
                <div aria-hidden="true" className={GLASS_CLASSES}>
                  <span className={EDGE_CLASSES} />
                  {BRACKETS.map((corner) => (
                    <span key={corner} className={`${BRACKET_CLASSES} ${corner}`} />
                  ))}
                </div>

                {/* HUD header: the tag chips, and the position index. */}
                <div className="relative mb-auto flex items-start justify-between gap-3 pb-6">
                  {/* Chips joined by the tag's own "·" (TAG_SEPARATOR_CLASSES): the card's
                      text, and its accessible name, keep "CRM PRIVAT · FĂRĂ LINK". */}
                  <small className="flex min-w-0 flex-wrap gap-y-1.5">
                    {tagChips(l(p.tag)).map((chip, n, chips) => (
                      <Fragment key={`${n}-${chip}`}>
                        {n > 0 ? <span className={TAG_SEPARATOR_CLASSES}> · </span> : null}
                        <span className={chipClasses(n, chips.length)}>{chip}</span>
                      </Fragment>
                    ))}
                  </small>
                  <span
                    aria-hidden="true"
                    className="shrink-0 font-disp text-[38px] font-extrabold leading-[.8] tracking-[-0.04em] text-transparent opacity-80 [-webkit-text-stroke:1px_color-mix(in_srgb,var(--on-accent)_62%,transparent)] transition-[color] duration-300 group-hover/card:text-[color-mix(in_srgb,var(--on-accent)_22%,transparent)] motion-reduce:transition-none"
                  >
                    {index}
                  </span>
                </div>

                <div className="relative">
                  <div className="flex items-end justify-between gap-3">
                    <h3 className="my-1.75 min-w-0 font-disp text-[clamp(22px,3vw,25px)] font-black uppercase leading-[1.05] tracking-[-0.03em] [overflow-wrap:anywhere]">
                      {p.name}
                    </h3>
                    {p.url ? (
                      <span
                        aria-hidden="true"
                        className="mb-1 grid size-9 shrink-0 place-items-center rounded-sm border border-on-accent/25 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] transition-[border-color,box-shadow] duration-300 group-hover/card:border-(--p2) group-hover/card:shadow-[0_0_16px_color-mix(in_srgb,var(--p2)_65%,transparent)] group-focus-visible/card:border-(--p2) motion-reduce:transition-none"
                      >
                        <svg
                          aria-hidden="true"
                          focusable="false"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="square"
                          className="size-4 transition-[translate] duration-300 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 motion-reduce:transition-none"
                        >
                          <path d="M7 17 17 7M9 7h8v8" />
                        </svg>
                      </span>
                    ) : null}
                  </div>
                  <p className={DESC_CLASSES}>{l(p.desc)}</p>
                </div>
              </>
            );
            // Only a project with a real link becomes an <a> — an empty url would
            // otherwise ship a link that goes nowhere.
            return p.url ? (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={CARD_CLASSES}
                style={style}
                data-tilt={tiltState}
                {...tilt.handlers}
              >
                {inner}
              </a>
            ) : (
              <article
                key={p.id}
                className={CARD_CLASSES}
                style={style}
                data-tilt={tiltState}
                {...tilt.handlers}
              >
                {inner}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
