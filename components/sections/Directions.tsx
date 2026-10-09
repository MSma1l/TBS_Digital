"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { Reveal } from "@/components/ui/Reveal";
import { SceneLoading } from "@/components/scene/art/SceneLoading";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";
import { directionHref } from "@/lib/directions";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { SCENE_SHAPES, SCENE_TESTID, selectSceneShape, type SceneShape } from "@/lib/scene";
import { directionPrice, directionTab, projectsForSolution, solUI, solutions } from "@/lib/solutions";
import { useSiteContent } from "@/lib/siteContent";
import { shouldInterceptTap } from "@/lib/tapIntent";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/**
 * The /02 block answers "what do you want to solve?" one direction at a time, and lets the
 * visitor act on the answer where they read it.
 *
 * Every pill is a real link to `/servicii/<slug>` (the tabs used to be inert buttons, so a
 * visitor who clicked one and expected a page got nothing). The panel under them says what the
 * selected direction delivers — its pitch from `lib/solutions.ts`, the same words its service
 * page opens with — and what it starts at (the admin's price, through `directionPrice`, which
 * is what the request dialog will quote). Then the two ways on: "Cere ofertă" opens the shared
 * request dialog with this direction preselected, "Detalii →" opens its service page.
 *
 * `slug` is the CURRENT slug, so it keys straight into `lib/solutions.ts` (pitch, accent and
 * project membership), into `directionHref`, and into the interior scene's models (`SceneShape`).
 */
type Service = {
  slug: SceneShape;
  tab: LocalizedText;
};

/* The pills keep their short labels (`directionTab`): they are navigation. Everything the panel
   says about a direction lives in lib/solutions.ts, so this list holds no copy of its own. */
const SERVICES: Service[] = [
  { slug: "produs-digital", tab: directionTab["produs-digital"] },
  { slug: "e-commerce", tab: directionTab["e-commerce"] },
  { slug: "automatizare-api", tab: directionTab["automatizare-api"] },
  { slug: "asistenti-ia", tab: directionTab["asistenti-ia"] },
  { slug: "brand-ui", tab: directionTab["brand-ui"] },
];

const SECTION = {
  title: L("Ce vrei să rezolvi?", "Что вы хотите решить?", "What do you want to solve?"),
  lead: L(
    "Alege direcția: vezi ce primești, de la ce preț pornim, și cere oferta direct de aici.",
    "Выберите направление: посмотрите, что получите и с какой цены мы начинаем, — и запросите предложение прямо здесь.",
    "Pick a direction: see what you get and what we start at — and ask for a quote right here.",
  ),
  tabsAria: L("Direcțiile de servicii", "Направления услуг", "Service directions"),
  /* The service page's own action-bar label: both buttons open the same request. */
  quote: solUI.actionTalk,
  /* Its arrow is drawn beside it, aria-hidden, so the link's name is the word alone. */
  more: L("Detalii", "Подробнее", "Details"),
};

const CASE = {
  /** A direction with neither a project nor a flow to show. Kept because the portfolio is
   *  editable — an admin can remove the projects a direction points at. */
  noneText: L(
    "Pe această direcție nu avem încă un proiect public în portofoliu.",
    "По этому направлению у нас пока нет публичного проекта в портфолио.",
    "We don't have a public project on this direction yet.",
  ),
};

/** "CRM PRIVAT · FĂRĂ LINK" → ["CRM PRIVAT", "FĂRĂ LINK"]. The tag is free localized text,
 *  so its segments are the only tag-like data a project actually has. */
function tagChips(tag: string): string[] {
  return tag
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The pill a key moves to, or null for keys the row leaves alone: ArrowRight / ArrowLeft step
 * and wrap, Home / End jump to the ends. Up and Down are never taken (they scroll the page).
 * Focus moves, not the tab order — the row stays one tab stop per pill, as links are.
 */
export function pillIndexForKey(key: string, current: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (((current + 1) % count) + count) % count;
    case "ArrowLeft":
      return (((current - 1) % count) + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/** A direction's accent (lib/solutions.ts, the same one its service page uses), as `--accent`. */
const accentStyle = (slug: string): CSSProperties =>
  ({ "--accent": solutions[slug]?.accent ?? "var(--blue)" }) as CSSProperties;

/*
 * The HUD screen's chrome loops only while it can be seen: the scan line pauses under the
 * first-visit intro overlay and while the section is scrolled away (`data-offscreen`), and
 * reduced motion removes it.
 */
const SCAN_CLASSES =
  "[html:has(#tbs-intro)_&]:[animation-play-state:paused] group-data-offscreen/services:[animation-play-state:paused] motion-reduce:hidden";

/*
 * Heights that do not move when another direction is selected. The pitch, the price and the case
 * card change per direction, so without a floor a pill tap would shift everything under the
 * section — on a phone right under the finger — and every scroll measurement of the stage.
 * Each value is the tallest of the five directions in that language, plus 4px.
 *
 * The screen's floors, and the panel's from 861px where the screen is the taller column, were
 * measured in a browser at the narrowest width of each band (320 / 360 / 401 / 641px stacked,
 * 861 / 1025 / 1180px side by side). The copy's — and the panel's where the copy is taller —
 * were computed for the pitch, price and buttons (2026-10-09) from the site fonts' own glyph
 * widths over EVERY width of each band, since the heading, the padding and the type grow inside
 * one, wrapping 3% narrower than the column for kerning, with 6px more on top. Longer copy, a
 * longer price or button label, or a longer portfolio entry, means measuring again.
 */
const MIN_HEIGHT_CLASSES: Record<Locale, { copy: string; screen: string; panel: string }> = {
  ro: {
    copy: "max-md:min-h-[420px] max-sm:min-h-[531px] max-xs:min-h-[557px] max-[360px]:min-h-[582px]",
    screen: "max-md:min-h-[558px] max-sm:min-h-[540px] max-xs:min-h-[564px] max-[360px]:min-h-[624px]",
    panel: "md:min-h-[592px] lg:min-h-[526px] xl:min-h-[495px]",
  },
  ru: {
    copy: "max-md:min-h-[423px] max-sm:min-h-[557px] max-xs:min-h-[581px] max-[360px]:min-h-[608px]",
    screen: "max-md:min-h-[586px] max-sm:min-h-[604px] max-xs:min-h-[624px] max-[360px]:min-h-[644px]",
    panel: "md:min-h-[620px] lg:min-h-[574px] xl:min-h-[542px]",
  },
  en: {
    copy: "max-md:min-h-[420px] max-sm:min-h-[531px] max-xs:min-h-[555px] max-[360px]:min-h-[582px]",
    screen: "max-md:min-h-[566px] max-sm:min-h-[584px] max-xs:min-h-[604px] max-[360px]:min-h-[664px]",
    panel: "md:min-h-[612px] lg:min-h-[507px] xl:min-h-[495px]",
  },
};

/*
 * The HUD screen's static illustrations (components/scene/art/ServiceArt.tsx). The initially
 * selected direction's drawing is a server-rendered slot (`initialArt`), so it is in the HTML
 * at first paint. The other four are NOT: a server slot is serialised into the page's RSC
 * payload, and all five drawings rode every HTML response (~3.5 KB gzip) although a visitor who
 * never switches directions — and every WebGL visitor — never sees them. They are drawn in the
 * browser from the scene's shapes, by a chunk loaded the first time another direction is
 * selected (the drawing then plays its one-shot entrance).
 */
const BrowserServiceArt = dynamic(
  () => import("@/components/scene/art/ServiceArt").then((art) => art.ServiceArt),
  { ssr: false },
);

/** The direction the section opens on (the first pill, `active` 0) — whose drawing the page
 *  server-renders into `initialArt`: app/(site)/page.tsx passes `SCENE_SHAPES[0]` too. */
const INITIAL_ART_SHAPE: SceneShape = SCENE_SHAPES[0];

export type DirectionsProps = {
  /** The first direction's static illustration, rendered on the server by app/(site)/page.tsx.
   *  It also switches the illustrations on: without it (bare renders, unit tests) the screen
   *  draws none, for any direction. */
  initialArt?: ReactNode;
};

export function Directions({ initialArt }: DirectionsProps) {
  const l = useLoc();
  const { locale } = useLanguage();
  const minHeights = MIN_HEIGHT_CLASSES[locale];
  const { projects, services } = useSiteContent();
  const { openRequest } = useRequestFlow();
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  /** The pointer behind the next click: "mouse" | "touch" | "pen", "keyboard", or "" (none
   *  seen — a synthetic or assistive-technology activation, which navigates). */
  const pointerKind = useRef("");
  /** The pill a touch/pen tap opens instead of selecting: the one an earlier tap selected
   *  without navigating, or the one already selected when the press started. */
  const primed = useRef<number | null>(null);
  const svc = SERVICES[active];

  // The scan line's off-screen pause (SCAN_CLASSES).
  useOffscreenAttribute(sectionRef);

  // The interior scene morphs to the selected direction's model.
  useEffect(() => {
    selectSceneShape(svc.slug);
  }, [svc.slug]);

  const select = (i: number) => {
    // Selecting another pill any other way re-arms the first-tap rule for the primed one.
    if (primed.current !== null && primed.current !== i) primed.current = null;
    setActive(i);
  };

  /* Mouse and keyboard hover or focus first, so their click navigates at once. A finger has
     no hover: its first tap on another pill selects it (the panel and the model change) and
     stays on the page; the second tap, or the "Detalii →" link, opens it — the header's
     dropdown rule (lib/tapIntent.ts). A tap on the pill that is ALREADY selected (the default
     one included) has nothing left to reveal — its model and preview are on screen and it
     shows the ↗ cue — so it opens on that first tap. Next's Link skips navigation once the
     click is default-prevented. */
  const onPillClick = (i: number, event: MouseEvent<HTMLAnchorElement>) => {
    const intercept = shouldInterceptTap({
      hasChildren: true,
      pointerType: pointerKind.current,
      openedByTap: primed.current === i,
    });
    pointerKind.current = "";
    select(i);
    if (intercept) {
      event.preventDefault();
      primed.current = i;
    }
  };

  const onPillKeyDown = (i: number, event: KeyboardEvent<HTMLAnchorElement>) => {
    pointerKind.current = "keyboard";
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = pillIndexForKey(event.key, i, SERVICES.length);
    if (next === null) return;
    event.preventDefault();
    // Focusing the pill selects it (onFocus) and, inside the phone band, scrolls it into view.
    event.currentTarget.parentElement?.querySelectorAll<HTMLAnchorElement>("a")[next]?.focus();
  };

  /* The preview card shows the direction's own reference project (the first entry of its
     list in lib/solutions.ts), resolved against the live portfolio — not a hard-coded
     project repeated under all five tabs. */
  const reference = projectsForSolution(svc.slug, projects)[0];
  const refNumber = reference
    ? String(projects.findIndex((p) => p.id === reference.id) + 1).padStart(2, "0")
    : "";
  /* A direction we sell as a capability (e-commerce) has no project to show, and must not
     borrow one: its card draws the flow we build — offer → payment → access — from the same
     table the service page reads. No project name, no external link. */
  const sol = solutions[svc.slug];
  const flow = !reference && sol?.flow?.length ? sol : undefined;
  const pitch = sol.pitch;
  /* The admin's figure for the service the dialog opens on, as the dialog will show it; "" for
     Brand & UI (no service of its own) and for a price the owner has not set. */
  const price = directionPrice(svc.slug, services, l);

  return (
    <section
      ref={sectionRef}
      id="servicii"
      className="group/services relative px-(--gutter) pt-[clamp(56px,8vw,90px)] pb-[clamp(36px,5vw,48px)]"
    >
      <div className="mx-auto max-w-(--maxw)">
        <Reveal className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h2 className="m-0 text-balance font-disp text-[clamp(28px,3.5vw,44px)] font-black uppercase leading-[1.05] tracking-[-0.04em] text-txt [overflow-wrap:break-word]">
              {l(SECTION.title)}
            </h2>
            <p className="mt-3.5 mb-0 max-w-[560px] font-copy text-base leading-[1.6] text-mut">
              {l(SECTION.lead)}
            </p>
          </div>
        </Reveal>

        {/* Links, not tabs: each one navigates to its service page. Hover, focus and a first
            tap move the panel, so the selection is visible before leaving the page. Below
            641px the row is a band that scrolls and snaps inside itself — the page never
            scrolls sideways, and a swipe that runs off its end does not chain to the page. */}
        <nav
          aria-label={l(SECTION.tabsAria)}
          className="my-7 flex flex-wrap gap-2.5 font-hud max-sm:-mx-(--gutter) max-sm:my-5.5 max-sm:flex-nowrap max-sm:snap-x max-sm:snap-mandatory max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:px-(--gutter) max-sm:py-1 max-sm:[scroll-padding-inline:var(--gutter)] max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden"
        >
          {SERVICES.map((s, i) => (
            <Link
              key={s.slug}
              href={directionHref(s.slug)}
              aria-current={i === active ? "true" : undefined}
              style={accentStyle(s.slug)}
              onPointerDown={(event) => {
                pointerKind.current = event.pointerType;
                // Read before the press's own mouseenter / focus select this pill: only the
                // pill that was selected already opens on this tap.
                if (i === active) primed.current = i;
              }}
              onPointerCancel={() => {
                // A press that became a swipe of the band: it will never click.
                pointerKind.current = "";
              }}
              /* `pointermove`, never `mouseenter`: a pill that scrolls under a STATIONARY cursor
                 gets the boundary events anyway — the browser sends them to whatever arrives under
                 the pointer — and selecting on that would switch the direction, and with it the
                 scene's 3D model, for a visitor who pointed at nothing. The same mistake pinned the
                 service pages' project reel (fixed 2026-09-19). One real pixel of movement over a
                 pill selects it; arriving under a still cursor does not. The `i !== active` guard
                 keeps the common case (moving across the pill already selected) free of renders. */
              onPointerMove={() => {
                if (i !== active) select(i);
              }}
              onFocus={() => select(i)}
              onClick={(event) => onPillClick(i, event)}
              onKeyDown={(event) => onPillKeyDown(i, event)}
              className="group/pill relative inline-flex min-h-12 shrink-0 snap-start items-center gap-2 rounded-pill border border-glass-line bg-glass-solid py-3 pr-3.5 pl-4.5 text-sm font-bold uppercase leading-[1.3] tracking-[.06em] text-mut no-underline transition-[translate,color,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-(--accent) hover:text-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan aria-[current=true]:-translate-y-0.5 aria-[current=true]:border-(--accent) aria-[current=true]:text-txt aria-[current=true]:shadow-[0_0_0_1px_var(--accent),0_0_18px_color-mix(in_srgb,var(--accent)_40%,transparent)] max-sm:hover:translate-none max-sm:focus-visible:-outline-offset-2 max-sm:aria-[current=true]:translate-none max-sm:aria-[current=true]:shadow-[inset_0_0_0_1px_var(--accent)] motion-reduce:transition-none motion-reduce:hover:translate-none motion-reduce:aria-[current=true]:translate-none"
            >
              {l(s.tab)}
              {/* the selected pill's "open" cue — on touch, what its next tap does. aria-hidden:
                  the link's accessible name is the label alone. */}
              <span
                aria-hidden="true"
                className="inline-block w-3 text-red-text opacity-0 transition-opacity duration-200 group-aria-[current=true]/pill:opacity-100 motion-reduce:transition-none"
              >
                ↗
              </span>
            </Link>
          ))}
        </nav>

        {/* The glass reveal (app/tailwind.css): `entry-glow` lights the panel's edge in the
            accent once the scene has formed the model (at once without WebGL), `entry-sweep`
            runs a band of light across the copy while it bursts — its ::after, so no after:
            utility goes on that column. */}
        <div
          style={accentStyle(svc.slug)}
          className={`entry-glow grid overflow-hidden rounded-xl border border-glass-line shadow-lg md:grid-cols-[.95fr_1.05fr] lg:grid-cols-[.82fr_1.18fr] ${minHeights.panel}`}
        >
          <div
            className={`entry-sweep relative flex min-w-0 flex-col bg-glass-solid p-[clamp(24px,3vw,38px)] before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-(--accent) before:to-transparent before:content-[''] ${minHeights.copy}`}
          >
            {/* Keyed, so a new direction's copy plays its entrance. The buttons below are NOT
                inside: they stay the same elements, only what they open follows the selection.
                The heading is a step smaller than the old one-word titles: a pitch is a
                sentence, and at the old size the longest would run to six lines at 320px. */}
            <div key={svc.slug} className="animate-swap-in motion-reduce:animate-none">
              <h3 className="mt-0 mb-3.5 font-disp text-[clamp(24px,2.6vw,30px)] font-black uppercase leading-[1.06] tracking-[-0.04em] text-txt [overflow-wrap:break-word]">
                {l(pitch.title)}
              </h3>
              <p className="m-0 mb-4 max-w-[430px] font-copy text-base leading-[1.6] text-mut">{l(pitch.text)}</p>
              <ul className="m-0 mb-5.5 grid list-none gap-1 p-0 font-copy text-base leading-normal text-txt">
                {pitch.points.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 py-0.5 before:shrink-0 before:font-bold before:text-red-text before:content-['✓']"
                  >
                    {l(item)}
                  </li>
                ))}
              </ul>
            </div>
            {/* The price and the two ways on, held at the column's foot: the floors above make
                room for the longest direction, so the buttons stay where the finger already is
                whichever pill is selected. Stacked full width under 641px, like the service
                page's action bar. */}
            <div className="mt-auto">
              {price ? (
                <p
                  key={svc.slug}
                  className="m-0 mb-4 animate-swap-in font-disp text-xl font-black uppercase leading-none tracking-[-0.04em] text-txt motion-reduce:animate-none"
                >
                  {price}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
                {/* Opens the site's one request dialog with this direction preselected. */}
                <button
                  type="button"
                  onClick={(event) =>
                    openRequest({
                      source: "home-services",
                      serviceSlug: svc.slug,
                      returnFocusTo: event.currentTarget,
                    })
                  }
                  className="cta-neon inline-flex min-h-12 items-center justify-center rounded-md px-4 py-2.5 font-copy text-base font-bold leading-[1.4]"
                >
                  {l(SECTION.quote)}
                </button>
                <Link
                  href={directionHref(svc.slug)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-glass-line bg-glass px-4 py-2.5 font-hud text-sm font-bold uppercase leading-[1.4] tracking-[.08em] text-txt no-underline transition-[border-color,color,box-shadow] duration-200 hover:border-blue hover:text-blue-text hover:shadow-neon-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none"
                >
                  {l(SECTION.more)}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          </div>

          {/* The HUD screen: the selected direction's model above its case card. Below 861px
              it comes first, right under the pills, so a tap changes the model in view. The
              screen is see-through — the interior stage's canvas draws behind the page, and
              the anchor is where it places the model (components/scene). */}
          <div
            data-testid={SCENE_TESTID.services}
            data-shape={svc.slug}
            className={`group/screen relative isolate flex min-w-0 flex-col gap-3 p-4 max-md:order-first sm:gap-4 sm:p-7 lg:flex-row lg:items-center lg:gap-6 ${minHeights.screen}`}
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 [container-type:size]">
              <div className="cyber-grid fade-radial absolute inset-0 opacity-80" />
              <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_38%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent)]" />
              <div
                className={`absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--accent) to-transparent opacity-70 animate-scan ${SCAN_CLASSES}`}
              />
              {/* corner brackets */}
              <span className="absolute top-3 left-3 size-4 border-t border-l border-(--accent)" />
              <span className="absolute top-3 right-3 size-4 border-t border-r border-(--accent)" />
              <span className="absolute bottom-3 left-3 size-4 border-b border-l border-(--accent)" />
              <span className="absolute right-3 bottom-3 size-4 border-r border-b border-(--accent)" />
            </div>

            <div
              aria-hidden="true"
              data-scene-anchor="services"
              className="pointer-events-none relative min-h-[220px] flex-1 self-stretch sm:min-h-[240px] md:min-h-[220px] lg:min-h-[300px]"
            >
              <SceneLoading />
              {/* The selected model's static illustration (BrowserServiceArt above). Keyed:
                  each selection mounts its illustration afresh (a one-shot entrance). */}
              {initialArt ? (
                svc.slug === INITIAL_ART_SHAPE ? (
                  <Fragment key={svc.slug}>{initialArt}</Fragment>
                ) : (
                  <BrowserServiceArt key={svc.slug} shape={svc.slug} />
                )
              ) : null}
            </div>

            <article className="relative w-full shrink-0 rounded-lg border border-(--ink-line) bg-ink p-4 text-on-ink shadow-lg before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-(--accent) before:to-transparent before:content-[''] sm:p-5 lg:w-[290px] xl:w-[320px]">
              {/* The card's index, and nothing else above the name: the label line that used to
                  sit here went with every other kicker on the site (2026-09-25). */}
              {reference && (
                <div className="flex justify-end font-hud text-[22px] font-bold leading-none text-on-ink">
                  {refNumber}
                </div>
              )}
              {reference ? (
                <>
                  <h4 className="mt-4 mb-2 font-disp text-[clamp(26px,3.2vw,34px)] font-black uppercase leading-[1.02] tracking-[-0.045em] text-on-ink [overflow-wrap:anywhere]">
                    {reference.name}
                  </h4>
                  <p className="m-0 line-clamp-4 max-w-[360px] font-copy text-md leading-normal text-on-ink">
                    {l(reference.desc)}
                  </p>
                  {/* Chips joined by the tag's own "·" (decision D7), kept as text: the card
                      reads "CRM PRIVAT · FĂRĂ LINK", never "CRM PRIVATFĂRĂ LINK". */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 font-hud">
                    {tagChips(l(reference.tag)).map((chip, n) => (
                      <Fragment key={`${n}-${chip}`}>
                        {n > 0 ? (
                          <span className="text-xs font-bold leading-none text-(--on-ink-mut)"> · </span>
                        ) : null}
                        <span className="rounded-sm border border-(--ink-line) px-2 py-1.5 text-xs font-bold uppercase leading-none tracking-[.06em] text-on-ink">
                          {chip}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </>
              ) : flow ? (
                <>
                  <h4 className="mt-3 mb-3 font-disp text-[clamp(21px,2.4vw,26px)] font-black uppercase leading-[1.1] tracking-[-0.03em] text-on-ink">
                    {l(flow.cardTitle)}
                  </h4>
                  {/* Numbered steps of the flow, always visible — no hover, no truncation. */}
                  <ol className="m-0 grid list-none gap-2.5 p-0 sm:gap-3">
                    {flow.flow?.map((step, i) => (
                      <li
                        key={i}
                        className="grid grid-cols-[30px_1fr] items-start gap-2 border-t border-(--ink-line) pt-2.5 font-copy text-md leading-[1.45] text-on-ink sm:gap-2.5 sm:pt-3"
                      >
                        <b className="font-hud text-md font-bold tracking-[.04em] text-on-ink">
                          {String(i + 1).padStart(2, "0")}
                        </b>
                        <span>{l(step)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <p className="m-0 mt-4 font-copy text-md leading-normal text-on-ink">{l(CASE.noneText)}</p>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
