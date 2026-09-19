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
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";
import { directionHref } from "@/lib/directions";
import { SCENE_SHAPES, SCENE_TESTID, selectSceneShape, type SceneShape } from "@/lib/scene";
import { projectsForSolution, solutions } from "@/lib/solutions";
import { useSiteContent } from "@/lib/siteContent";
import { shouldInterceptTap } from "@/lib/tapIntent";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/**
 * The /02 block is a DIRECTION CHOOSER, not a second sales pitch.
 *
 * Every pill is a real link to `/servicii/<slug>` (the tabs used to be inert buttons, so a
 * visitor who clicked one and expected a page got nothing), and the preview under them is
 * read-only: one textual link into the service page and no competing CTA. Everything
 * commercial — talking to the team, the projects, the reference link — now lives in the
 * action bar on the service page itself (`DirectionPage`).
 *
 * `slug` is the CURRENT slug, so it keys straight into `lib/solutions.ts` (accent and project
 * membership), into `directionHref`, and into the interior scene's models (`SceneShape`).
 */
type Service = {
  slug: SceneShape;
  tab: LocalizedText;
  tag: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  list: LocalizedText[];
};

const SERVICES: Service[] = [
  {
    slug: "produs-digital",
    tab: L("Produs digital", "Цифровой продукт", "Digital product"),
    tag: L("DE LA IPOTEZĂ LA LANSARE", "ОТ ГИПОТЕЗЫ ДО ЗАПУСКА", "FROM HYPOTHESIS TO LAUNCH"),
    title: L("Produs digital", "Цифровой продукт", "Digital product"),
    text: L(
      "Clarificăm problema, proiectăm experiența și livrăm un produs ușor de evoluat.",
      "Проясняем задачу, проектируем опыт и выпускаем продукт, который легко развивать.",
      "We frame the problem, design the experience and ship a product that is easy to evolve.",
    ),
    list: [
      L("Workshop de strategie", "Стратегический воркшоп", "Strategy workshop"),
      L("UX/UI cu prototip testabil", "UX/UI с тестируемым прототипом", "UX/UI with a testable prototype"),
      L("Dezvoltare și măsurare", "Разработка и метрики", "Development and measurement"),
    ],
  },
  {
    slug: "e-commerce",
    /* The pill keeps the short label — it is a navigation item; the panel carries the full
       title. Nothing here is written in the past tense: we have not shipped a shop. */
    tab: L("E-commerce", "E-commerce", "E-commerce"),
    tag: L(
      "PRODUSE DIGITALE CARE SE VÂND CLAR",
      "ЦИФРОВЫЕ ПРОДУКТЫ, КОТОРЫЕ ПРОДАЮТСЯ ПОНЯТНО",
      "DIGITAL PRODUCTS THAT SELL CLEARLY",
    ),
    title: L(
      "E-commerce pentru produse, rapoarte și acces digital",
      "E-commerce для продуктов, отчётов и цифрового доступа",
      "E-commerce for products, reports and digital access",
    ),
    text: L(
      "Construim fluxul întreg: oferta, plata și accesul la produs sau la raport.",
      "Строим весь поток: предложение, оплата и доступ к продукту или отчёту.",
      "We build the whole flow: the offer, the payment and the access to the product or report.",
    ),
    list: [
      L("Checkout și plăți", "Чекаут и оплата", "Checkout and payments"),
      L("Livrare și acces digital", "Цифровая выдача и доступ", "Digital delivery and access"),
      L("Raportare și gestionare produse", "Отчётность и управление товарами", "Reporting and product management"),
    ],
  },
  {
    slug: "automatizare-api",
    tab: L("Automatizare & API", "Автоматизация и API", "Automation & API"),
    tag: L("CONECTEAZĂ CE CONTEAZĂ", "СОЕДИНЯЕМ ВАЖНОЕ", "CONNECT WHAT MATTERS"),
    title: L("Automatizare & API", "Автоматизация и API", "Automation & API"),
    text: L(
      "Eliminăm munca repetitivă și conectăm sistemele care trebuie să comunice.",
      "Убираем рутину и соединяем системы, которым нужно общаться друг с другом.",
      "We remove repetitive work and connect the systems that need to talk to each other.",
    ),
    list: [
      L("Audit de procese", "Аудит процессов", "Process audit"),
      L("Integrări sigure", "Безопасные интеграции", "Secure integrations"),
      L("Fluxuri și dashboard-uri", "Потоки и дашборды", "Flows and dashboards"),
    ],
  },
  {
    slug: "asistenti-ia",
    /* The pill label and the route stay as the client signed them off; only the panel copy
       changed, so that what is described as delivered is what actually runs. */
    tab: L("Asistenți IA & boturi", "ИИ-ассистенты и боты", "AI assistants & bots"),
    tag: L("IA CARE LUCREAZĂ CU ECHIPA", "ИИ, КОТОРЫЙ РАБОТАЕТ С КОМАНДОЙ", "AI THAT WORKS WITH YOUR TEAM"),
    title: L(
      "Asistenți și boți conectați la conversații reale",
      "Ассистенты и боты, подключённые к реальным разговорам",
      "Assistants and bots connected to real conversations",
    ),
    text: L(
      "Răspuns, calificare și automatizare prin web, Telegram și sistemele interne.",
      "Ответ, квалификация и автоматизация через веб, Telegram и внутренние системы.",
      "Answering, qualification and automation across web, Telegram and internal systems.",
    ),
    list: [
      L("Chat pentru clienți", "Чат для клиентов", "Chat for customers"),
      L("Asistent care califică cererea", "Ассистент, который квалифицирует заявку", "An assistant that qualifies the request"),
      L("Bot Telegram conectat la fluxul echipei", "Telegram-бот, подключённый к потоку команды", "A Telegram bot wired into the team's flow"),
    ],
  },
  {
    slug: "brand-ui",
    tab: L("Brand & UI", "Бренд и UI", "Brand & UI"),
    tag: L("O IDENTITATE CARE SE ȚINE MINTE", "ЗАПОМИНАЮЩАЯСЯ ИДЕНТИЧНОСТЬ", "AN IDENTITY THAT STICKS"),
    title: L("Brand & UI", "Бренд и UI", "Brand & UI"),
    text: L(
      "Dăm produsului un sistem vizual coerent, clar și ușor de folosit.",
      "Даём продукту цельную, ясную и удобную визуальную систему.",
      "We give the product a coherent, clear and easy-to-use visual system.",
    ),
    list: [
      L("Poziționare și direcție", "Позиционирование и направление", "Positioning and direction"),
      L("Design system", "Дизайн-система", "Design system"),
      L("Interfață premium", "Премиальный интерфейс", "Premium interface"),
    ],
  },
];

const SECTION = {
  eyebrow: L("Alege direcția potrivită", "Выберите направление", "Choose your direction"),
  title: L(
    "Un selector de servicii făcut pentru decizie rapidă.",
    "Селектор услуг, сделанный для быстрого решения.",
    "A service selector built for a fast decision.",
  ),
  lead: L(
    "Selectează o direcție. Conținutul se schimbă instant, iar pagina serviciului e la un click.",
    "Выберите направление. Контент меняется мгновенно, а страница услуги — в одном клике.",
    "Pick a direction. The content changes instantly and the service page is one click away.",
  ),
  tabsAria: L("Direcțiile de servicii", "Направления услуг", "Service directions"),
  more: L("Deschide serviciul", "Открыть услугу", "Open the service"),
};

const CASE = {
  /** Label above the real reference project of the selected direction. */
  ref: L("PROIECT REAL DIN PORTOFOLIU", "РЕАЛЬНЫЙ ПРОЕКТ ИЗ ПОРТФОЛИО", "REAL PROJECT FROM THE PORTFOLIO"),
  /** Last-resort label: a direction with neither a project nor a flow to show. Kept because
   *  the portfolio is editable — an admin can remove the projects a direction points at. */
  none: L("PORTOFOLIU", "ПОРТФОЛИО", "PORTFOLIO"),
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
 * Heights that do not move when another direction is selected. The copy and the case card
 * change per direction, so without a floor a pill tap would shift everything under the
 * section — on a phone right under the finger — and every scroll measurement of the stage.
 * Each value is the tallest of the five directions in that language, measured with the site
 * fonts at the narrowest width of its band (320 / 360 / 401 / 641px for the stacked copy and
 * screen, 861 / 1025 / 1180px for the two-column panel), plus 4px. New or longer copy here, or
 * a longer portfolio entry, means measuring again.
 */
const MIN_HEIGHT_CLASSES: Record<Locale, { copy: string; screen: string; panel: string }> = {
  ro: {
    copy: "max-md:min-h-[374px] max-sm:min-h-[398px] max-xs:min-h-[474px] max-[360px]:min-h-[518px]",
    screen: "max-md:min-h-[558px] max-sm:min-h-[540px] max-xs:min-h-[564px] max-[360px]:min-h-[624px]",
    panel: "md:min-h-[592px] lg:min-h-[484px] xl:min-h-[486px]",
  },
  ru: {
    copy: "max-md:min-h-[398px] max-sm:min-h-[498px] max-xs:min-h-[526px] max-[360px]:min-h-[618px]",
    screen: "max-md:min-h-[586px] max-sm:min-h-[604px] max-xs:min-h-[624px] max-[360px]:min-h-[644px]",
    panel: "md:min-h-[620px] lg:min-h-[574px] xl:min-h-[542px]",
  },
  en: {
    copy: "max-md:min-h-[374px] max-sm:min-h-[448px] max-xs:min-h-[498px] max-[360px]:min-h-[526px]",
    screen: "max-md:min-h-[566px] max-sm:min-h-[584px] max-xs:min-h-[604px] max-[360px]:min-h-[664px]",
    panel: "md:min-h-[612px] lg:min-h-[492px] xl:min-h-[486px]",
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
  const { projects } = useSiteContent();
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
     no hover: its first tap on another pill selects it (the preview and the model change) and
     stays on the page; the second tap, or the "open the service" link, opens it — the header's
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

  return (
    <section
      ref={sectionRef}
      id="servicii"
      className="group/services relative px-(--gutter) pt-[clamp(56px,8vw,90px)] pb-[clamp(36px,5vw,48px)]"
    >
      <div className="mx-auto max-w-(--maxw)">
        <Reveal className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-2.5 font-hud text-xs font-bold uppercase leading-[1.4] tracking-[.1em] text-red-text sm:text-sm">
              {l(SECTION.eyebrow)}
              <span aria-hidden="true" className="h-px w-12 shrink-0 bg-linear-to-r from-red/70 to-transparent" />
            </p>
            <h2 className="mt-3 mb-0 text-balance font-disp text-[clamp(28px,3.5vw,44px)] font-black uppercase leading-[1.05] tracking-[-0.04em] text-txt [overflow-wrap:break-word]">
              {l(SECTION.title)}
            </h2>
          </div>
          <p className="m-0 max-w-[400px] font-copy text-base leading-normal text-mut">{l(SECTION.lead)}</p>
        </Reveal>

        {/* Links, not tabs: each one navigates to its service page. Hover, focus and a first
            tap move the preview, so the selection is visible before leaving the page. Below
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
            {/* Keyed, so a new direction's copy plays its entrance. The link below is NOT
                inside: it stays the same element, only its href follows the selection. */}
            <div key={svc.slug} className="animate-swap-in motion-reduce:animate-none">
              <div className="font-hud text-xs font-bold uppercase leading-[1.4] tracking-[.08em] text-red-text">
                {l(svc.tag)}
              </div>
              <h3 className="mt-2 mb-3.5 font-disp text-[clamp(26px,3vw,34px)] font-black uppercase leading-[1.05] tracking-[-0.04em] text-txt [overflow-wrap:break-word]">
                {l(svc.title)}
              </h3>
              <p className="m-0 mb-4 max-w-[430px] font-copy text-base leading-[1.6] text-mut">{l(svc.text)}</p>
              <ul className="m-0 mb-5.5 grid list-none gap-1 p-0 font-copy text-base leading-normal text-txt">
                {svc.list.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2 py-0.5 before:shrink-0 before:font-bold before:text-red-text before:content-['✓']"
                  >
                    {l(item)}
                  </li>
                ))}
              </ul>
            </div>
            {/* The ONLY interactive thing in the preview: one textual link into the service
                page. The commercial actions live on that page's action bar. */}
            <Link
              href={directionHref(svc.slug)}
              className="mt-auto inline-flex min-h-11 items-center self-start border-b-2 border-transparent font-hud text-sm font-bold uppercase tracking-[.06em] text-txt no-underline transition-colors duration-200 hover:border-red hover:text-red-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none"
            >
              {l(SECTION.more)} →
            </Link>
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
              <div className="flex items-center justify-between gap-3 font-hud text-xs font-bold uppercase leading-[1.4] tracking-[.08em] text-(--on-ink-mut)">
                <span>{reference ? l(CASE.ref) : flow ? l(flow.cardLabel) : l(CASE.none)}</span>
                {reference && <b className="text-[22px] leading-none text-on-ink">{refNumber}</b>}
              </div>
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
