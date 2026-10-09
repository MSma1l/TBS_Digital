"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
} from "react";
import { Modal } from "@/components/ui/Modal";
import { mediaUrl } from "@/lib/api";
import { directionHref, directions } from "@/lib/directions";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { format } from "@/lib/i18n/format";
import { PAGE_SIZE, pageBounds, pageCount, pageOf } from "@/lib/portfolioPages";
import { projectGradient } from "@/lib/projectAccent";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { directionTab, projectRequestType, projectsForSolution, solUI } from "@/lib/solutions";
import { REDUCED_MOTION_QUERY } from "@/lib/tilt";
import { addressOf, type DemoHotspot, type DemoPage } from "@/lib/siteDemo";
import { createCircuit, type Circuit, type CircuitClasses } from "./portfolioCircuit";
import { PortfolioSearch } from "./PortfolioSearch";
import {
  DEMO_COPY,
  DemoBar,
  DemoPageView,
  DemoPrompt,
  shotOf,
  useFinePointer,
  usePhone,
  useSiteDemo,
} from "./SiteDemo";
import s from "./Portfolio.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  title: L("Portofoliu", "Портфолио", "Portfolio"),
  count: L("Proiecte", "Проекты", "Projects"),
  stage: L("Proiectele noastre", "Наши проекты", "Our projects"),
  open: L("Deschide site-ul ↗", "Открыть сайт ↗", "Open the site ↗"),
  private: L("nu are pagină publică", "нет публичной страницы", "no public page"),
  /* the service filter */
  channels: L("Proiecte după serviciu", "Проекты по услугам", "Projects by service"),
  all: L("Toate", "Все", "All"),
  /* the screen and the pixels */
  prev: L("Proiectul anterior", "Предыдущий проект", "Previous project"),
  next: L("Proiectul următor", "Следующий проект", "Next project"),
  pick: L("Alege proiectul", "Выберите проект", "Choose a project"),
  zoom: L("Vezi mai mare", "Увеличить", "View larger"),
  /* the picture's name starts with the chip's own words, so a voice saying them finds it */
  zoomOf: L(
    "Vezi mai mare captura de ecran: {name}",
    "Увеличить снимок экрана: {name}",
    "View larger: the screenshot of {name}",
  ),
  shotOf: L("Captură de ecran: {name}", "Снимок экрана: {name}", "Screenshot: {name}"),
  /* a project whose whole site is captured: the screen scrolls through it */
  scrollHint: L("Derulează site-ul", "Прокрутите сайт", "Scroll the site"),
  zoomSiteOf: L(
    "Vezi mai mare tot site-ul {name}",
    "Увеличить весь сайт {name}",
    "View larger: the whole {name} site",
  ),
  siteOf: L("Site-ul {name}, de sus până jos", "Сайт {name} целиком, сверху вниз", "The whole {name} site, top to bottom"),
  /* a project with a demo: its site's pages and buttons answer (lib/siteDemo.ts) */
  hintDemo: L("Derulează și apasă", "Листайте и нажимайте", "Scroll and press"),
  hintPress: L("Apasă pe butoane", "Нажимайте на кнопки", "Press the buttons"),
  zoomDemoOf: L(
    "Vezi mai mare și navighează prin {name}",
    "Увеличить и пройтись по {name}",
    "View larger and browse {name}",
  ),
  more: L("Citește tot ↓", "Читать полностью ↓", "Read more ↓"),
  less: L("Mai puțin ↑", "Свернуть ↑", "Show less ↑"),
  /* said to a screen reader as the screen changes, and as a channel narrows the pixels */
  onScreen: L("{name}, proiectul {n} din {total}", "{name}, проект {n} из {total}", "{name}, project {n} of {total}"),
  filtered: L("{label}: {count}.", "{label}: {count}.", "{label}: {count}."),
  /* the pages of a big portfolio: one row of pixels at a time */
  page: L("Pagina {n} din {total}", "Страница {n} из {total}", "Page {n} of {total}"),
  pickPage: L(
    "Alege proiectul, pagina {n} din {total}",
    "Выберите проект, страница {n} из {total}",
    "Choose a project, page {n} of {total}",
  ),
  prevPage: L("Pagina anterioară", "Предыдущая страница", "Previous page"),
  nextPage: L("Pagina următoare", "Следующая страница", "Next page"),
  /* what a choice in the search says, when it had to bring back every project */
  allBack: L("Acum se văd toate proiectele.", "Теперь видны все проекты.", "All the projects are shown again."),
  /* the project's request */
  similar: L("Vreau un proiect similar", "Хочу похожий проект", "I want a similar project"),
  /* the close, while a service is chosen */
  openService: L("Deschide serviciul", "Открыть услугу", "Open the service"),
};

/* "{n} proiecte" in the visitor's language — Romanian says "20 de proiecte", Russian has three forms. */
function projectCount(n: number, l: (v: LocalizedText) => string): string {
  const ru =
    n % 10 === 1 && n % 100 !== 11
      ? "проект"
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? "проекта"
        : "проектов";
  const ro = n === 1 ? "1 proiect" : n % 100 >= 20 || n % 100 === 0 ? `${n} de proiecte` : `${n} proiecte`;
  return l(L(ro, `${n} ${ru}`, n === 1 ? "1 project" : `${n} projects`));
}

/* The filter's channels in plain words, for a visitor who never heard of an API or a UI. Only
   here: Home's pills, the menu and the service pages keep the official names (`directionTab`),
   and the close's "Deschide serviciul: …" link joins the two. */
const CHANNEL_LABEL: Record<string, LocalizedText> = {
  "produs-digital": L("Aplicații și platforme", "Приложения и платформы", "Apps & platforms"),
  "e-commerce": L("Magazine online", "Интернет-магазины", "Online shops"),
  "automatizare-api": L("Programe interne", "Внутренние системы", "Internal systems"),
  "asistenti-ia": L("Boturi și chat", "Боты и чаты", "Bots & chat"),
  "brand-ui": L("Site-uri și design", "Сайты и дизайн", "Sites & design"),
};

/** The pixel transition on the screen: a grid of this many blocks (columns × rows). */
const FX_COLS = 16;
const FX_ROWS = 10;
/** A swipe across the screen: this far sideways, and mostly sideways. */
const SWIPE_PX = 40;
/** The click a browser may send after a swipe arrives within this long of it. */
const SWIPE_CLICK_MS = 400;
/** Once a page load, a site shows it scrolls: this long after it is on, it glides down and back. */
const PEEK_AFTER_MS = 1400;
const PEEK_MS = 1900;
/** Whether that glide was shown. In memory, not in storage: nothing is written before consent. */
let peekShown = false;
/** Less than this to scroll, and a site is not scrolled at all (no hint, no glide). */
const SCROLL_ROOM_PX = 8;

/** The page's ease-out (`--motion-ease-out`), for the animations started from script. */
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
/** And its ease-in, for what leaves. */
const EASE_IN = "cubic-bezier(0.4, 0, 1, 1)";

const pad = (n: number) => String(n).padStart(2, "0");

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;

/** Whether `el`'s focus is one the browser shows — the keyboard's, not a tap's or a click's. */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true; // an engine that cannot tell: treat it as the keyboard's
  }
}

/** A project colour (`lib/projectAccent.ts` keeps them as `#rrggbb`) as its three channels. */
function rgbOf(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  const value = match ? parseInt(match[1], 16) : 0x808080;
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** The most page dots shown at once: around the page on show when there are more pages. */
const MAX_DOTS = 13;
/** The pages whose dot is shown: all of them, or a window of MAX_DOTS around `page`. */
function dotWindow(page: number, pages: number): number[] {
  const count = Math.min(pages, MAX_DOTS);
  const first = Math.min(Math.max(0, page - Math.floor(count / 2)), pages - count);
  return Array.from({ length: count }, (_, k) => first + k);
}

/** The capture of a project's whole site, when it has one (the screen scrolls through it). An
 *  uploaded one (`/api/uploads/…`) is resolved against the API, which in development is on
 *  another port. */
function sitePicture(project: ProjectItem | undefined | null): string {
  return mediaUrl(project?.fullPage?.trim() ?? "");
}

/** What the screen shows for a project: its whole site, else its first screenshot. */
function screenPicture(project: ProjectItem | undefined | null): string {
  return sitePicture(project) || mediaUrl(project?.images?.[0] ?? "");
}

/** The width a pixel's picture is asked for at 1x (2x doubles it). A 32px square (26px on a phone)
 *  shows the whole height of a landscape screenshot (about twice as wide as tall), so it needs about
 *  64px of it across, and 1.5x screens more; a whole-site capture is taller than wide, and 32 are
 *  enough. next.config.ts allows the optimiser these widths and no others. */
const PIXEL_SHOT_W = { screenshot: 128, capture: 64 };

/** A picture the image optimiser takes (next.config.ts, `images.localPatterns`): one of the site's
 *  own files right under /projects — no folder, no query, no `..`. */
const OPTIMISABLE = /^\/projects\/(?!\.\.?$)[^/?#%]+$/;

/** A pixel's picture: `src` / `srcSet` as asked for, `fallback` the file it falls back on once. */
interface PixelShot {
  key: string;
  src: string;
  srcSet?: string;
  fallback?: string;
}

/** The picture in a project's pixel: what the screen shows for it, small. A site's own file comes
 *  through Next's image optimiser at the square's size, a few kilobytes where the file is tens to
 *  hundreds of them, and falls back on the project's screenshot as it is. Anything else (an
 *  upload, on the API's origin) is used as it is — but never a capture: an uploaded one is a whole
 *  site, up to 1080 × 12000px, to paint a 26px square, so such a project shows its screenshot. A
 *  capture the screen could not load (`broken`) is passed over, as the screen passes it over. */
function pixelPicture(project: ProjectItem, broken: ReadonlySet<string>): PixelShot | null {
  const site = sitePicture(project);
  const capture = site && !broken.has(site) ? site : "";
  const shot = mediaUrl(project.images?.[0] ?? "");
  const small = (src: string, width: number) => getImageProps({ src, alt: "", width, height: width, quality: 75 }).props;
  if (OPTIMISABLE.test(capture)) {
    const { src, srcSet } = small(capture, PIXEL_SHOT_W.capture);
    return { key: capture, src, srcSet, fallback: shot || undefined };
  }
  if (!shot) return null;
  if (!OPTIMISABLE.test(shot)) return { key: shot, src: shot };
  const { src, srcSet } = small(shot, PIXEL_SHOT_W.screenshot);
  return { key: shot, src, srcSet, fallback: shot };
}

/** A pixel's picture that failed: the file it falls back on, once; after that, or with none, the
 *  square of its colour (`data-failed`). */
function pixelFallback(img: HTMLImageElement) {
  const file = img.dataset.fallback;
  if (!file) {
    img.dataset.failed = "";
    return;
  }
  delete img.dataset.fallback;
  img.removeAttribute("srcset");
  img.src = file;
}

/** Whether a scrolling window has nothing worth scrolling (a capture no taller than the screen). */
function shortOf(scroller: HTMLElement): boolean {
  return scroller.scrollHeight - scroller.clientHeight <= SCROLL_ROOM_PX;
}

/** Ask for a project's screen picture once (`asked` remembers), so it is there when the project is. */
function warmImage(asked: Set<string>, project: ProjectItem | undefined): void {
  const src = screenPicture(project);
  if (!src || asked.has(src)) return;
  asked.add(src);
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

/** A project's two colours as `--p1` / `--p2`, the pair its /04 card on Home is drawn in. */
function accentStyle(project: ProjectItem, position: number): CSSProperties {
  const [p1, p2] = projectGradient(project, position);
  return { "--p1": p1, "--p2": p2 } as CSSProperties;
}

/** The circuit board's pieces, by their names in Portfolio.module.css. */
const BOARD_CLASSES: CircuitClasses = {
  dot: s.pxDot,
  name: s.pxName,
  tracks: s.tracks,
  vias: s.vias,
  litHalo: s.litHalo,
  litLine: s.litLine,
  litVia: s.litVia,
  litViaHalo: s.litViaHalo,
  runHalo: s.runHalo,
  runLine: s.runLine,
  headHalo: s.headHalo,
  headBody: s.headBody,
  headCore: s.headCore,
  viaSpark: s.viaSpark,
};

/**
 * /portofoliu — one project at a time on a big screen, and under it one pixel per project with
 * its name under it: the pixels are the navigation (2026-10-05: of four prototypes, the owner
 * chose this one over the field of 3px points, which "nu este intuitiv").
 *
 *  · the SCREEN shows the current project's whole SITE — a capture, top to bottom, that scrolls
 *    inside the screen (the wheel, a finger, ↑ ↓; 2026-10-06, the owner's "se poate da scroll la
 *    fiecare proiect") — or, for a project without one, its screenshot; ‹ › beside it (on it, on
 *    a phone), ← → from the keyboard, a sideways swipe on a phone. Switching plays a short pixel
 *    transition: the old picture breaks into blocks of the new project's colours and the new one
 *    comes through. Pressing the picture shows it larger;
 *  · the PIXELS: one labelled button per project, a small square showing it (2026-10-08, for the
 *    round pads before it), framed in its colour, on a circuit board whose traces run up into the
 *    monitor's chin ("Circuitul", 2026-10-05: the owner's pick of seven designs). The current one
 *    is the pad switched on, its route lit; picking another sends a pulse of light along the new
 *    route into the chin, and the screen lets the new project through as it arrives
 *    (portfolioCircuit.ts, lib/portfolioBoard.ts);
 *  · beside the screen, the project's words: "01 / 09", its name, its tag, its description (a
 *    long one folds, "Citește tot"), "Vreau un proiect similar" (the request dialog, with the
 *    project attached) and its site;
 *  · the SERVICE FILTER narrows the pixels and the count, in plain words;
 *  · the CLOSE after the section: the service pages' closing panel.
 * The first project is on the screen from the server on, so nothing waits for the script.
 */
export function Portfolio() {
  const { projects } = useSiteContent();
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  const screenRef = useRef<HTMLDivElement>(null);
  /* The screen's scrolling window: a whole site scrolls inside it (a screenshot just fills it). */
  const scrollerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const shotBtnRef = useRef<HTMLButtonElement>(null);
  /* The larger view's picture: it opens where the screen was scrolled to. */
  const zoomImgRef = useRef<HTMLImageElement>(null);
  /* Where the screen was scrolled to when the larger view opened (a share of the site's height). */
  const zoomAt = useRef(0);
  /* A demo's page box in the screen (what the glide moves) and, in the larger view, its own
     scrolling window and box. */
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const zoomScrollerRef = useRef<HTMLDivElement>(null);
  const zoomBoxRef = useRef<HTMLDivElement>(null);
  /* Where a demo's next page lands once it is on: at a point of it (a link with a target), at
     the share it was left at (Back), else at its top. And whether the screen's crossfade waits
     for it. */
  const demoLand = useRef<{ at?: number; share?: number } | null>(null);
  const demoFade = useRef(false);
  /* The larger view's demo; the link that opened its sheet (the focus goes back to it); a jump
     there to another page's top, which hands the focus to that page once it is on; and the mark
     where a jump to a point landed, which takes the focus there. */
  const zoomDemoRef = useRef<HTMLDivElement>(null);
  const demoOpener = useRef<HTMLElement | null>(null);
  const demoFocus = useRef(false);
  const markRef = useRef<HTMLSpanElement>(null);
  const [demoMark, setDemoMark] = useState<{ page: string; y: number; label: string } | null>(null);
  /* The landing in effect: a later one (or another project) takes the screen over from it. */
  const landRun = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const ghostsRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const pixelRefs = useRef(new Map<string, HTMLButtonElement>());
  const monitorRef = useRef<HTMLDivElement>(null);
  const rgbRef = useRef<HTMLSpanElement>(null);
  const boardRef = useRef<SVGSVGElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  /* The circuit board under the screen (portfolioCircuit.ts), made once the row is in the page. */
  const circuit = useRef<Circuit | null>(null);
  /* A switch for the board to play: the project that was on the screen (goTo), when the new one
     takes over in the row as it stands — not over a page turn or a channel's glide. */
  const pulseFrom = useRef<string | null>(null);
  /* When that switch's pulse reaches the chin (performance.now()), 0 when none runs: the screen's
     blocks hold the old project until then. */
  const pulseArrive = useRef(0);
  /* The row's glides started in this commit (a page's slide, a channel's): the board waits for them. */
  const glides = useRef<Animation[]>([]);
  /* A page turn: how far the new row slides in from (px, signed), once it is in the DOM. */
  const slideIn = useRef(0);
  /* A pixel to take the focus once its page is on show (the keys walked past a page's end). */
  const focusNext = useRef<string | null>(null);
  /* The screenshots already asked for: the ones next to the project on the screen, and any pointed at. */
  const warmed = useRef(new Set<string>());
  /* The pixel transition in flight: its run number, and how it learns the new picture is ready. */
  const fxRun = useRef(0);
  const fxReveal = useRef<(() => void) | null>(null);
  /* The project's words rise in when another project comes on (not on the first paint). */
  const riseInfo = useRef(false);
  /* The control of the stage that had the focus as the project changed, where it was, and whether
     the keyboard had put it there. When the change takes it away — a site link the next project
     has not, a "Citește tot" it does not need, the picture of a project without one — the focus
     goes on (to the red button, or to the project's pixel) rather than to the top of the page. */
  const keepFocus = useRef<{ el: HTMLElement; inInfo: boolean; keyboard: boolean } | null>(null);
  /* Where each pixel stood before a channel was pressed, to glide them to their new places. */
  const flipFrom = useRef<Map<string, DOMRect> | null>(null);
  /* A sideways swipe on the screen, and when it ended: the click it may turn into is dropped. */
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  const swipedAt = useRef(-Infinity);
  const [channel, setChannel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  /* The site captures that failed to load: their projects show their screenshot instead. */
  const [brokenSites, setBrokenSites] = useState<ReadonlySet<string>>(() => new Set());
  /* The pixels that came in with a page turn: they do not switch on one by one as on arrival (the
     slide is their arrival) — and the mark stays theirs for as long as they are on show, since
     lifting it would start the switch-on then. */
  const [quietIds, setQuietIds] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");

  /* Every direction with at least one live project, in the menu's order, with its projects in the
     curated order — the first is the direction's reference project. A direction with none gets
     no channel (e-commerce, today). */
  const channels = useMemo(
    () =>
      directions
        .map((d) => ({ slug: d.slug, members: projectsForSolution(d.slug, projects) }))
        .filter((c) => c.members.length > 0),
    [projects],
  );
  /* A channel whose projects all left (new content arrived) falls back to all of them. */
  const tuned = channels.find((c) => c.slug === channel) ?? null;
  /* A channel's projects in the page's own order, so the pixels never reshuffle. */
  const listFor = (slug: string | null) => {
    const members = channels.find((c) => c.slug === slug)?.members;
    return members ? projects.filter((p) => members.includes(p)) : projects;
  };
  const list = listFor(tuned?.slug ?? null);
  const current = list.find((p) => p.id === selectedId) ?? list[0] ?? null;
  const pos = current ? list.indexOf(current) : -1;
  /* The description as it reads now: a change of language changes it with the project unchanged. */
  const descText = current ? l(current.desc) : "";
  /* The row shows ONE page of pixels — always the page of the project on the screen, so its lit
     pixel is always in sight (lib/portfolioPages.ts: nine at most, balanced). A portfolio bigger
     than a page also gets the search and the room for the pages under the row. */
  const big = projects.length > PAGE_SIZE;
  const pages = pageCount(list.length);
  const page = pageOf(list.length, Math.max(0, pos));
  const [pageStart, pageEnd] = pageBounds(list.length, page);
  const pageItems = list.slice(pageStart, pageEnd);
  /* What the screen shows: the project's whole site, which scrolls inside it, else its first
     screenshot. A capture that fails to load gives way to the screenshot. */
  const siteSrc = sitePicture(current);
  const site = siteSrc && !brokenSites.has(siteSrc) ? siteSrc : "";
  const image = mediaUrl(current?.images?.[0] ?? "");
  const picture = site || image;
  /* The project's demo, when it has one (lib/siteDemo.ts): a few pages of its site with their
     links and buttons, the same state in the screen and in the larger view. The screen is a demo
     from its first paint (the bar, the start picture); the pages and hotspots come with the
     manifest, fetched after the page is up. */
  const demo = useSiteDemo(current);
  const finePointer = useFinePointer();
  const phone = usePhone();
  const demoOn = Boolean(current && demo.src && picture);
  const demoShot = shotOf(demo.page, phone);
  /* The start page's desktop shot is the project's own picture: shown through `picture` (a
     failed capture gives way to the screenshot). If that is no longer the picture its hotspots
     were measured on — the admin replaced it, or it failed — they are left out. */
  const startShot = Boolean(demo.page && demo.page.id === demo.manifest?.start && demoShot === demo.page.d);
  const demoSrc = demoShot && !startShot ? mediaUrl(demoShot.src) : picture;
  const stale = startShot && demoShot ? mediaUrl(demoShot.src) !== picture : false;
  const phoneShot = Boolean(demoShot && demoShot === demo.page?.m);
  /* Who can press what: a mouse in the small screen (a finger only on a phone-sized shot — the
     desktop one's links are ~10px there); in the larger view anyone — every link a keyboard stop,
     and a finger's target 24px at least (.hot::before), even over a desktop shot on a phone. */
  const screenLive = Boolean(demoOn && demoShot && !stale && (finePointer || phoneShot));
  const zoomLive = Boolean(demoOn && demoShot && !stale);

  /* Another picture on the screen — another project, or a capture that gave way to its
     screenshot — starts at its top. Not the same project arriving again as a new object (the
     content store re-reads the cache, the API or another tab): that must not throw a visitor
     who has scrolled back up. */
  const shown = `${current?.id ?? ""} ${picture}`;
  const shownBefore = useRef<string | null>(null);
  useLayoutEffect(() => {
    const before = shownBefore.current;
    shownBefore.current = shown;
    if (before === null || before === shown) return;
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTop = 0;
    screenRef.current?.removeAttribute("data-scrolled");
  }, [shown]);

  /* Another project is on: the transition's blocks go out once its picture has decoded, and its
     words rise in. */
  useLayoutEffect(() => {
    const reveal = fxReveal.current;
    const img = imgRef.current;
    if (reveal) {
      if (img && typeof img.decode === "function") img.decode().then(reveal, reveal);
      else reveal();
    }
    const info = infoRef.current;
    if (!riseInfo.current) return;
    riseInfo.current = false;
    if (!info || typeof info.animate !== "function" || reducedMotion()) return;
    info.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], {
      duration: 260,
      easing: EASE_OUT,
    });
  }, [current]);

  /* A long description folds to its first lines; "Citește tot" shows only when something is
     folded away — measured again for another project, another language, another width, and once
     the web font is in. Written straight on the button: it is a measurement, not state. Then the
     focus the change took away goes on: from the words to the red button, from the picture to the
     project's pixel; without scrolling the page when it was not the keyboard's (a tap leaves the
     focus on a phone's button). */
  useLayoutEffect(() => {
    const desc = descRef.current;
    const more = moreRef.current;
    if (!desc || !more) return;
    const check = () => {
      more.hidden = !expanded && desc.scrollHeight <= desc.clientHeight + 2;
    };
    check();
    const had = keepFocus.current;
    keepFocus.current = null;
    if (had && (!had.el.isConnected || had.el.hidden)) {
      const to = had.inInfo ? askRef.current : current ? pixelRefs.current.get(current.id) : null;
      to?.focus({ preventScroll: !had.keyboard });
    }
    let live = true;
    /* the web font can still change where the lines break */
    document.fonts?.ready.then(() => {
      if (live) check();
    });
    if (typeof ResizeObserver !== "function") {
      return () => {
        live = false;
      };
    }
    const observer = new ResizeObserver(check);
    observer.observe(desc);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [current, expanded, descText]);

  /* A pressed channel: the pixels that stay glide from where they stood to their new places; the
     ones that come back switch on (their CSS); the ones that leave fade as copies (chooseChannel). */
  useLayoutEffect(() => {
    const from = flipFrom.current;
    flipFrom.current = null;
    if (!from || reducedMotion()) return;
    pixelRefs.current.forEach((el, id) => {
      const before = from.get(id);
      if (!before || typeof el.animate !== "function") return;
      const after = el.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      glides.current.push(
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 280,
          easing: EASE_OUT,
        }),
      );
    });
  }, [channel]);

  /* A page turn: the new row slides in from the side it comes from — the old one is already
     sliding out as a copy (turnPage) — and a pixel the keys walked onto takes the focus once its
     page is in the DOM. */
  useLayoutEffect(() => {
    const row = rowRef.current;
    const d = slideIn.current;
    slideIn.current = 0;
    if (row && d && typeof row.animate === "function") {
      glides.current.push(
        row.animate([{ transform: `translateX(${d}px)`, opacity: 0 }, { transform: "none", opacity: 1 }], {
          duration: 320,
          delay: 40,
          easing: EASE_OUT,
          fill: "backwards",
        }),
      );
    }
    const id = focusNext.current;
    const el = id ? pixelRefs.current.get(id) : undefined;
    if (el) {
      focusNext.current = null;
      el.focus({ preventScroll: true });
    }
  }, [current, pageStart]);

  /* The circuit board, made once the row and the monitor are in the page (they stay for as long
     as there is a project to show). */
  const staged = current !== null;
  useLayoutEffect(() => {
    const row = rowRef.current;
    const svg = boardRef.current;
    const flash = flashRef.current;
    const monitor = monitorRef.current;
    const glyph = rgbRef.current;
    if (!staged || !row || !svg || !flash || !monitor || !glyph) return;
    const board = createCircuit({ row, svg, flash, monitor, glyph, classes: BOARD_CLASSES, reduced: reducedMotion });
    circuit.current = board;
    return () => {
      board.dispose();
      circuit.current = null;
    };
  }, [staged]);

  /* The board after every change to the row or to the project on the screen (after the effects
     above, which start the row's glides): it waits for a page's slide or a channel's glide to
     end; when one pixel took over from another in the row as it stands, it plays the switch — and
     the screen's blocks hold the old project until the pulse reaches the chin; else it is drawn
     still. */
  const pageKey = pageItems.map((p) => p.id).join(" ");
  useLayoutEffect(() => {
    const board = circuit.current;
    const moving = glides.current;
    glides.current = [];
    const from = pulseFrom.current;
    pulseFrom.current = null;
    if (!board) return;
    const id = current?.id ?? null;
    if (moving.length) {
      board.wait(id, moving);
    } else if (id && from && from !== id && pixelRefs.current.has(from)) {
      const pulse = board.play(id);
      if (pulse) {
        /* counted from now, then from the frame the pulse really started on (the first frame
           after a pick can be a heavy one): the screen never lets go before the light is there */
        const planned = performance.now() + pulse.ms;
        pulseArrive.current = planned;
        pulse.at.then((at) => {
          if (pulseArrive.current === planned && Number.isFinite(at)) pulseArrive.current = at;
        });
      }
    } else {
      board.place(id);
    }
  }, [current, pageKey, channel]);

  /* Only the screenshots that can come next are fetched, once the page is idle: the projects on
     either side of the one on the screen (where the arrows go). A pixel pointed at or focused
     fetches its own. Never a whole portfolio's worth of pictures at once. */
  useEffect(() => {
    if (pos < 0 || list.length < 2) return;
    const near = () => {
      warmImage(warmed.current, list[(pos + 1) % list.length]);
      warmImage(warmed.current, list[(pos - 1 + list.length) % list.length]);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(near, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(near, 600);
    return () => window.clearTimeout(timer);
  }, [list, pos]);

  /* Once a page load, the first site the screen shows glides down half a screen and back, so it
     is plain that it scrolls — never under reduced motion, never for a site with nothing to
     scroll, and a wheel, a press or a key on the screen stops it at once. */
  useEffect(() => {
    const screen = screenRef.current;
    const scroller = scrollerRef.current;
    // a demo's whole page box (picture, hotspots) glides; else the picture's button
    const target = pageBoxRef.current ?? shotBtnRef.current;
    if (
      peekShown ||
      !(site || demoOn) ||
      !screen ||
      !scroller ||
      !target ||
      typeof target.animate !== "function" ||
      reducedMotion()
    ) {
      return;
    }
    let glide: Animation | null = null;
    /* Stopped, the page stays where the glide had taken it — a press during it must land on what
       the visitor saw under the pointer, not on what a jump back would put there. */
    const stop = () => {
      if (!glide) return;
      let y = 0;
      try {
        y = new DOMMatrixReadOnly(getComputedStyle(target).transform).m42;
      } catch {
        y = 0;
      }
      glide.cancel();
      glide = null;
      if (y < 0) scroller.scrollTop -= y;
    };
    const stoppers = ["wheel", "pointerdown", "keydown", "touchstart"] as const;
    const timer = window.setTimeout(() => {
      const room = scroller.scrollHeight - scroller.clientHeight;
      if (peekShown || scroller.scrollTop > 0 || room <= SCROLL_ROOM_PX) return;
      peekShown = true;
      const d = Math.min(Math.round(scroller.clientHeight * 0.5), room);
      glide = target.animate(
        [
          { transform: "none" },
          { transform: `translateY(${-d}px)`, offset: 0.42 },
          { transform: `translateY(${-d}px)`, offset: 0.58 },
          { transform: "none" },
        ],
        { duration: PEEK_MS, easing: "ease-in-out" },
      );
      for (const type of stoppers) screen.addEventListener(type, stop, { passive: true });
    }, PEEK_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      // another project: the glide just goes (its page is not the one on the screen any more)
      glide?.cancel();
      for (const type of stoppers) screen.removeEventListener(type, stop);
    };
  }, [site, demoOn]);

  /* A picture that settled before the page woke up fired its load or error before React was
     listening: a failed one is asked for again (its error then reaches onError, and the
     screenshot takes over), a loaded site is measured. Once, on mount. */
  useEffect(() => {
    const img = imgRef.current;
    const screen = screenRef.current;
    const scroller = scrollerRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) img.setAttribute("src", img.getAttribute("src") ?? "");
    else if (screen?.hasAttribute("data-site") && scroller) screen.toggleAttribute("data-short", shortOf(scroller));
  }, []);
  /* The same for the pixels' pictures, in the server's HTML too: one that failed before the page
     woke up falls back now. Once, on mount. */
  useEffect(() => {
    for (const img of Array.from(rowRef.current?.getElementsByClassName(s.pxShot) ?? []))
      if (img instanceof HTMLImageElement && img.complete && img.naturalWidth === 0) pixelFallback(img);
  }, []);

  /* The larger view of a site opens where the screen was scrolled to: that share of the site at
     the top of the dialog's scrolling body (measured in its own px: the dialog may still be
     scaling in). */
  useLayoutEffect(() => {
    const img = zoomImgRef.current;
    const at = zoomAt.current;
    if (!zoomOpen || !img || !(at > 0)) return;
    /* a demo's larger view has its own scrolling window, the page's height known before its
       picture is in (its box keeps the shot's shape) */
    const own = zoomScrollerRef.current;
    if (own) {
      own.scrollTop = at * own.scrollHeight;
      return;
    }
    let live = true;
    const place = () => {
      let box: HTMLElement | null = img.parentElement;
      while (box && box.scrollHeight <= box.clientHeight + 1) box = box.parentElement;
      if (!live || !box || box === document.body || box === document.documentElement) return;
      const r = img.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      const k = box.offsetHeight > 0 && b.height > 0 ? b.height / box.offsetHeight : 1;
      box.scrollTop += (r.top - b.top + at * r.height) / k;
    };
    if (img.complete && img.naturalHeight > 0) place();
    else img.addEventListener("load", place, { once: true });
    return () => {
      live = false;
      img.removeEventListener("load", place);
    };
  }, [zoomOpen]);

  /* A demo's page is on: it lands where it was asked to — a link's target, the place Back left
     it at, else its top — in the screen and in the larger view when that is open; the screen
     measures it (a page with nothing to scroll gets no "scroll" hint); and once its picture has
     decoded (1.5s at most) the bar's light ends and the screen's crossfade fades. The manifest's
     first arrival lands nothing: a visitor may already have scrolled the start page. */
  const demoPageId = demo.nav?.page ?? null;
  const demoPageBefore = useRef<string | null>(null);
  useLayoutEffect(() => {
    const before = demoPageBefore.current;
    demoPageBefore.current = demoPageId;
    const land = demoLand.current;
    demoLand.current = null;
    const screen = screenRef.current;
    if (demoShot && (land || (before !== null && before !== demoPageId))) {
      for (const view of ["screen", "zoom"] as const) {
        const scroller = view === "zoom" ? zoomScrollerRef.current : scrollerRef.current;
        const box = view === "zoom" ? zoomBoxRef.current : pageBoxRef.current;
        if (!scroller || !box) continue;
        const k = box.clientWidth / demoShot.w;
        if (land?.at !== undefined) scroller.scrollTop = Math.max(0, land.at * k);
        else if (land?.share !== undefined) scroller.scrollTop = land.share * scroller.scrollHeight;
        else scroller.scrollTop = 0;
      }
      screen?.removeAttribute("data-scrolled");
    }
    const scroller = scrollerRef.current;
    if (screen && scroller && demoShot) screen.toggleAttribute("data-short", shortOf(scroller));
    // a jump in the larger view to another page's top hands the focus to the page
    if (demoFocus.current) zoomScrollerRef.current?.focus({ preventScroll: true });
    demoFocus.current = false;
    const fade = demoFade.current;
    demoFade.current = false;
    const run = ++landRun.current;
    let over = false;
    const done = () => {
      // a later page, or another project, has the screen now: its own landing ends it
      if (over || run !== landRun.current) return;
      over = true;
      screen?.removeAttribute("data-loading");
      zoomDemoRef.current?.removeAttribute("data-loading");
      const canvas = fxRef.current;
      if (!fade || !canvas || typeof canvas.animate !== "function") return;
      const out = canvas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_OUT, fill: "forwards" });
      out.onfinish = () => {
        canvas.removeAttribute("data-on");
        out.cancel();
      };
    };
    const img = imgRef.current;
    const timer = window.setTimeout(done, 1500);
    if (img && typeof img.decode === "function") img.decode().then(done, done);
    else done();
    return () => window.clearTimeout(timer);
  }, [demoPageId, demoShot]);

  /* A jump in the larger view landed at a point: the focus goes to its mark there. */
  useLayoutEffect(() => {
    if (demoMark) markRef.current?.focus({ preventScroll: true });
  }, [demoMark]);

  /* The pixel transition (~350ms; up to about half a second while the board's pulse runs): the
     picture on the screen now is painted on the canvas over it, the <img> changes underneath, and
     the canvas breaks into blocks of the new project's colours — then, once the new picture has
     decoded and the board's pulse (another project of the page on show) has reached the chin, the
     blocks go out, from the side the new one comes in. Nothing of it under reduced motion, or with
     no picture to break up. */
  /* The screen as it looks now, painted onto the transition canvas: a site's band in view — in
     its scrolling window (under a demo's bar), beside its scrollbar, a glide included — or a
     screenshot covering the screen. `bar`: a demo's bar is painted over too (another project is
     coming: its address must not show before the blocks do). False when there is nothing to
     paint. */
  const paintScreen = (bar = false): boolean => {
    const img = imgRef.current;
    const canvas = fxRef.current;
    const screen = screenRef.current;
    const ctx = canvas?.getContext("2d");
    if (!img || !canvas || !screen || !ctx || !img.complete || img.naturalWidth === 0) return false;
    const box = screen.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(box.width * dpr));
    const H = Math.max(1, Math.round(box.height * dpr));
    canvas.width = W;
    canvas.height = H;
    const kx = W / box.width;
    const ky = H / box.height;
    try {
      if (screen.hasAttribute("data-site")) {
        const r = img.getBoundingClientRect();
        const view = (scrollerRef.current ?? screen).getBoundingClientRect();
        const top = Math.max(r.top, view.top);
        const bottom = Math.min(r.bottom, view.bottom);
        if (bottom > top && r.height > 0) {
          const ny = img.naturalHeight / r.height;
          ctx.drawImage(
            img,
            0,
            (top - r.top) * ny,
            img.naturalWidth,
            (bottom - top) * ny,
            (r.left - box.left) * kx,
            (top - box.top) * ky,
            r.width * kx,
            (bottom - top) * ky,
          );
        }
        if (bar && view.top > box.top) {
          ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--deck").trim() || "black";
          ctx.fillRect(0, 0, W, (view.top - box.top) * ky);
        }
      } else {
        /* a screenshot as the <img> shows it: covering the screen, from its top */
        const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
        ctx.drawImage(img, (W - img.naturalWidth * scale) / 2, 0, img.naturalWidth * scale, img.naturalHeight * scale);
      }
    } catch {
      return false;
    }
    return true;
  };

  const breakScreen = (to: ProjectItem, dir: number) => {
    const canvas = fxRef.current;
    const ctx = canvas?.getContext("2d");
    fxReveal.current = null;
    const run = ++fxRun.current;
    // a page's crossfade still running stops here: the blocks take over the canvas
    canvas?.getAnimations().forEach((a) => a.cancel());
    if (!canvas || !ctx || reducedMotion() || !paintScreen(true)) {
      canvas?.removeAttribute("data-on");
      return;
    }
    const W = canvas.width;
    const H = canvas.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.setAttribute("data-on", "");

    /* Each block: when it breaks, when it goes, and its shade — the new project's two colours,
       mixed, laid at some strength over the black matrix (the page's --void). */
    const n = FX_COLS * FX_ROWS;
    const breakAt = new Float32Array(n);
    const goAt = new Float32Array(n);
    const shade: string[] = [];
    const strength = new Float32Array(n);
    const [p1, p2] = projectGradient(to, projects.indexOf(to));
    const c1 = rgbOf(p1);
    const c2 = rgbOf(p2);
    const matrix = getComputedStyle(canvas).getPropertyValue("--void").trim() || "black";
    for (let k = 0; k < n; k++) {
      const c = k % FX_COLS;
      const sweep = dir > 0 ? (FX_COLS - 1 - c) / (FX_COLS - 1) : c / (FX_COLS - 1);
      breakAt[k] = sweep * 100 + Math.random() * 60; // 0–160ms: the old picture breaks up
      goAt[k] = sweep * 90 + Math.random() * 90; // 0–180ms after the reveal: the blocks go out
      const t = 0.3 + Math.random() * 0.7;
      shade.push(`rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`);
      strength[k] = 0.55 + Math.random() * 0.45;
    }
    const t0 = performance.now();
    let revealAt = Infinity;
    const reveal = () => {
      if (run === fxRun.current && revealAt === Infinity) revealAt = Math.max(performance.now() - t0, 170);
    };
    fxReveal.current = reveal;
    window.setTimeout(reveal, 1500); // a slow picture never holds the blocks longer than this

    const state = new Uint8Array(n); // 0 whole, 1 broken into its block, 2 gone
    const bw = W / FX_COLS;
    const bh = H / FX_ROWS;
    const gap = Math.max(1, Math.round(dpr));
    const frame = (now: number) => {
      if (run !== fxRun.current) return;
      const t = now - t0;
      /* the pulse's arrival is known only once the row has changed: read it every frame */
      const gate = Math.max(revealAt, pulseArrive.current - t0);
      let alive = 0;
      for (let k = 0; k < n; k++) {
        if (state[k] === 2) continue;
        const c = k % FX_COLS;
        const r = (k / FX_COLS) | 0;
        const x = Math.round(c * bw);
        const y = Math.round(r * bh);
        const w = Math.round((c + 1) * bw) - x;
        const h = Math.round((r + 1) * bh) - y;
        if (state[k] === 0 && t >= breakAt[k]) {
          ctx.fillStyle = matrix;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = strength[k];
          ctx.fillStyle = shade[k];
          ctx.fillRect(x + gap, y + gap, w - gap, h - gap);
          ctx.globalAlpha = 1;
          state[k] = 1;
        }
        if (state[k] === 1 && t >= gate + goAt[k]) {
          ctx.clearRect(x, y, w, h);
          state[k] = 2;
          continue;
        }
        alive++;
      }
      if (alive) window.requestAnimationFrame(frame);
      else canvas.removeAttribute("data-on");
    };
    window.requestAnimationFrame(frame);
  };

  /* A page turn: the page on show slides out as one sheet of copies (never lit — one LED on at a
     time) and the new one slides in from the side it comes from (the layout effect above). Its
     pixels do not switch on one by one as on arrival: the slide is the arrival (`quietIds`). */
  const turnPage = (dir: number) => {
    const row = rowRef.current;
    const ghosts = ghostsRef.current;
    if (!row || !ghosts || reducedMotion() || typeof row.animate !== "function") return;
    const box = row.getBoundingClientRect();
    const origin = ghosts.getBoundingClientRect();
    const sheet = document.createElement("div");
    sheet.className = s.sheet;
    row.querySelectorAll<HTMLElement>("[data-project]").forEach((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-project");
      copy.removeAttribute("aria-current");
      sheet.append(copy);
    });
    sheet.style.left = `${box.left - origin.left}px`;
    sheet.style.top = `${box.top - origin.top}px`;
    sheet.style.width = `${box.width}px`;
    ghosts.append(sheet);
    const d = Math.round(Math.max(48, Math.min(120, box.width * 0.18))) * dir;
    sheet.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${-d}px)`, opacity: 0 }], {
      duration: 200,
      easing: EASE_IN,
      fill: "forwards",
    }).onfinish = () => sheet.remove();
    slideIn.current = d;
  };

  /* Put `to` on the screen, coming in from the right (dir 1) or the left (-1). In a big portfolio
     the row turns to its page when it is on another one, and says so. */
  const goTo = (to: ProjectItem, dir: number, inList = list) => {
    if (current && to.id === current.id) return;
    const active = document.activeElement;
    keepFocus.current =
      active instanceof HTMLElement && stageRef.current?.contains(active)
        ? { el: active, inInfo: !!infoRef.current?.contains(active), keyboard: focusVisible(active) }
        : null;
    const at = inList.indexOf(to);
    const toPage = pageOf(inList.length, at);
    const turned = inList === list && toPage !== page;
    pulseArrive.current = 0;
    pulseFrom.current = current && inList === list && !turned ? current.id : null;
    breakScreen(to, dir);
    if (turned) {
      turnPage(dir);
      const [first, last] = pageBounds(inList.length, toPage);
      setQuietIds(new Set(inList.slice(first, last).map((p) => p.id)));
    }
    riseInfo.current = true;
    setSelectedId(to.id);
    setExpanded(false);
    setZoomOpen(false);
    const said = format(l(COPY.onScreen), { name: to.name, n: at + 1, total: inList.length });
    setAnnouncement(
      turned ? `${said}. ${format(l(COPY.page), { n: toPage + 1, total: pageCount(inList.length) })}.` : said,
    );
  };
  /* The pixel of `id` takes the focus — now, or once its page is on show. */
  const focusPixel = (id: string) => {
    const el = pixelRefs.current.get(id);
    if (el) el.focus({ preventScroll: true });
    else focusNext.current = id;
  };
  /* The first project of page `k` (from 0) — the one a page button puts on the screen. */
  const firstOfPage = (k: number) => (k >= 0 && k < pages ? list[pageBounds(list.length, k)[0]] : undefined);
  /* Turn to page `k` (from 0): its first project comes on the screen, so the row keeps showing the
     page of the project on the screen. */
  const goPage = (k: number) => {
    if (k < 0 || k >= pages || k === page) return;
    goTo(list[pageBounds(list.length, k)[0]], k > page ? 1 : -1);
  };
  /* A name chosen in the search: on the screen, on its page — bringing back every project if it is
     outside the chosen channel — with the focus on its pixel, so ← → go on from it, and the screen
     brought into view (a phone scrolled down to the field). */
  const pickFound = (p: ProjectItem) => {
    const outside = !list.includes(p);
    if (outside) setChannel(null);
    const inList = outside ? projects : list;
    if (current && p.id === current.id) {
      setAnnouncement(format(l(COPY.onScreen), { name: p.name, n: inList.indexOf(p) + 1, total: inList.length }));
    } else {
      const from = current ? inList.indexOf(current) : -1;
      goTo(p, inList.indexOf(p) >= from ? 1 : -1, inList);
    }
    if (outside) setAnnouncement((said) => `${l(COPY.allBack)} ${said}`);
    focusPixel(p.id);
    const screen = screenRef.current;
    const header = document.querySelector("header");
    const top = header ? header.getBoundingClientRect().bottom : 0;
    const box = screen?.getBoundingClientRect();
    if (box && box.top < top + 4) {
      window.scrollBy({ top: box.top - top - 12, behavior: reducedMotion() ? "auto" : "smooth" });
    }
  };
  /* The neighbour `d` steps from `from` — the project on the screen, or the pixel with the focus —
     round the list. From the screen's project the new one comes in from the side it was asked
     from; from another pixel, from the side it stands on. */
  const step = (d: number, from: ProjectItem | null = current) => {
    if (!from || list.length < 2) return null;
    const to = list[(list.indexOf(from) + d + list.length) % list.length];
    goTo(to, from === current ? d : list.indexOf(to) >= pos ? 1 : -1);
    return to;
  };

  /* A channel narrows the pixels to its projects. The project on the screen stays if it is one of
     them; otherwise the channel's first project comes on. The pixels that leave fade where they
     stood, as copies in `.ghosts`, while the row closes up. */
  const chooseChannel = (slug: string | null) => {
    if (slug === (tuned?.slug ?? null)) return;
    const next = listFor(slug);
    /* the pixels the new row will show: the page of the project on the screen then */
    const nextCurrent = current && next.includes(current) ? current : next[0];
    const [from, to] = pageBounds(next.length, pageOf(next.length, nextCurrent ? next.indexOf(nextCurrent) : 0));
    const stays = new Set(next.slice(from, to).map((p) => p.id));
    const ghosts = ghostsRef.current;
    const origin = ghosts?.getBoundingClientRect();
    const fade = !reducedMotion();
    const rects = new Map<string, DOMRect>();
    pixelRefs.current.forEach((el, id) => {
      const box = el.getBoundingClientRect();
      rects.set(id, box);
      if (stays.has(id) || !fade || !ghosts || !origin || typeof el.animate !== "function") return;
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-project");
      ghost.removeAttribute("aria-current"); // a copy is never the lit one: one LED on at a time
      ghost.style.left = `${box.left - origin.left}px`;
      ghost.style.top = `${box.top - origin.top}px`;
      ghost.style.width = `${box.width}px`;
      ghosts.append(ghost);
      ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.6)" }], {
        duration: 180,
        easing: "ease-in",
        fill: "forwards",
      }).onfinish = () => ghost.remove();
    });
    flipFrom.current = rects;
    setChannel(slug);
    // the pixels that stay keep their mark; the ones that come in switch on
    setQuietIds((prev) => new Set([...prev].filter((id) => stays.has(id))));
    const label = slug ? l(CHANNEL_LABEL[slug] ?? directionTab[slug]) : l(COPY.all);
    const said = format(l(COPY.filtered), { label, count: projectCount(next.length, l) });
    if (current && !next.includes(current) && next[0]) {
      goTo(next[0], 1, next);
      setAnnouncement(`${said} ${format(l(COPY.onScreen), { name: next[0].name, n: 1, total: next.length })}`);
    } else {
      setAnnouncement(said);
    }
  };

  /* ← → anywhere on the stage. A pixel with the focus hands it on to its neighbour, so the keys
     walk the row. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Escape closes a demo's prompt or page list first
    if (event.key === "Escape" && demo.nav && (demo.nav.prompt || demo.nav.list)) {
      event.preventDefault();
      dismissDemo("screen");
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (event.repeat) return;
    const d = event.key === "ArrowRight" ? 1 : -1;
    const focusedId = event.target instanceof HTMLElement ? event.target.dataset.project : undefined;
    const fromPixel = list.find((p) => p.id === focusedId) ?? null;
    const to = step(d, fromPixel ?? current);
    if (fromPixel && to) focusPixel(to.id);
  };

  /* A sideways swipe on the screen: a finger's or a pen's, never the mouse's. */
  const onScreenDown = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onScreenUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    swipedAt.current = event.timeStamp;
    step(dx < 0 ? 1 : -1);
  };
  const onShotClick = (event: ReactMouseEvent) => {
    if (event.timeStamp - swipedAt.current < SWIPE_CLICK_MS) return; // the swipe's own click
    /* the larger view of a site opens where the screen was scrolled to */
    const scroller = scrollerRef.current;
    zoomAt.current =
      (site || demoOn) && scroller && scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
    demo.step({ type: "dismiss" });
    setAnnouncement("");
    setZoomOpen(true);
  };
  /* The larger view closes onto the screen at the page and the place the visitor left it at. */
  const closeZoom = () => {
    const box = zoomScrollerRef.current;
    const share = demoOn && box && box.scrollHeight > 0 ? box.scrollTop / box.scrollHeight : null;
    demo.step({ type: "dismiss" });
    setAnnouncement("");
    setDemoMark(null);
    setZoomOpen(false);
    if (share === null) return;
    window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollTop = share * scroller.scrollHeight;
    });
  };

  /* The next switch away from this picture paints it into the transition canvas, and a canvas
     decodes a picture on the main thread the first time it draws it: 65ms measured for a site
     capture, inside the switch's own task, every switch. So once the picture on the screen has
     decoded and the page has been quiet for a second, it is painted once into the canvas while the
     canvas is hidden (no data-on: visibility hidden, and both switch paths repaint it before they
     show it), and the next switch finds it decoded in the canvas's cache. Not under reduced motion
     (nothing paints then), and not for a phone's captures (11–12.5 Mpx, past what the canvas keeps
     decoded: the decode would only be paid twice). */
  useEffect(() => {
    const img = imgRef.current;
    if (!img || reducedMotion() || typeof img.decode !== "function") return;
    const src = img.getAttribute("src");
    let live = true;
    let timer = 0;
    let idle = 0;
    let tries = 0;
    const warm = () => {
      const canvas = fxRef.current;
      if (!live || !canvas || img.getAttribute("src") !== src) return;
      if (canvas.hasAttribute("data-on") || canvas.getAnimations().length > 0) {
        // a switch or a page's crossfade is on the canvas: once more, later
        if (++tries < 3) timer = window.setTimeout(arm, 1000);
        return;
      }
      if (img.naturalWidth * img.naturalHeight > 8e6) return;
      paintScreen();
    };
    const arm = () => {
      if (!live) return;
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(warm, { timeout: 3000 });
      else timer = window.setTimeout(warm, 200);
    };
    img.decode().then(
      () => {
        if (live) timer = window.setTimeout(arm, 1000);
      },
      () => {},
    );
    return () => {
      live = false;
      window.clearTimeout(timer);
      if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    };
  }, [demoSrc]);

  /* ---------- the demo: pages, Back, in-page links, the prompt ---------- */
  type DemoView = "screen" | "zoom";
  const demoScroller = (view: DemoView) => (view === "zoom" ? zoomScrollerRef.current : scrollerRef.current);
  const demoBox = (view: DemoView) => (view === "zoom" ? zoomBoxRef.current : pageBoxRef.current);
  /* The screen fades out of a page: its band painted on the canvas, faded once the next page's
     picture is in (the landing effect below). Not in the larger view, not under reduced motion. */
  const fadePage = () => {
    const canvas = fxRef.current;
    if (zoomOpen || !canvas || reducedMotion() || typeof canvas.animate !== "function") return;
    fxRun.current++; // a project's transition still running stops
    canvas.getAnimations().forEach((a) => a.cancel());
    if (!paintScreen()) {
      canvas.removeAttribute("data-on");
      return;
    }
    canvas.setAttribute("data-on", "");
    demoFade.current = true;
  };
  /* A page as it is said: its title and its address on the real site. */
  const pageLabel = (target: DemoPage | null | undefined) =>
    target && current
      ? format(l(DEMO_COPY.pageOf), { title: target.title, address: addressOf(current.url, target) ?? current.name })
      : "";
  const sayPage = (target: DemoPage | undefined) => {
    const said = pageLabel(target);
    if (said) setAnnouncement(said);
  };
  /* A page is on its way in: its light runs, and its links take no press until its picture is in. */
  const markLoading = () => {
    screenRef.current?.setAttribute("data-loading", "");
    zoomDemoRef.current?.setAttribute("data-loading", "");
  };
  /* `at` is where the live site's view starts once it has jumped — its own header offset is in —
     so the page lands there: the pinned band covers what the live site's header covers. */
  const scrollDemo = (at: number, view: DemoView) => {
    const scroller = demoScroller(view);
    const box = demoBox(view);
    if (!scroller || !box || !demoShot) return;
    const k = box.clientWidth / demoShot.w;
    scroller.scrollTo({ top: Math.max(0, at * k), behavior: reducedMotion() ? "auto" : "smooth" });
  };
  /* Where a jump in the larger view lands, for its mark: under the pinned header of that page. */
  const landMark = (page: string, at: number, label: string) => {
    const shot = shotOf(demo.manifest?.pages.find((p) => p.id === page) ?? null, phone);
    setDemoMark({ page, y: at + (shot?.fixed ?? 0), label });
  };
  /* `hand`: a link of the larger view's page was pressed (`label`) — the focus goes on with the
     jump, as a browser's does: to the page's top, or to the mark where it landed. */
  const goDemo = (to: string, at: number | undefined, view: DemoView, hand = false, label = "") => {
    if (!demo.nav) return;
    if (to === demo.nav.page) {
      demo.step({ type: "dismiss" });
      if (at !== undefined) scrollDemo(at, view);
      if (hand && at !== undefined) landMark(to, at, label);
      return;
    }
    const scroller = demoScroller(view);
    const share = scroller && scroller.scrollHeight > 0 ? scroller.scrollTop / scroller.scrollHeight : 0;
    if (view === "screen") fadePage();
    markLoading();
    demoLand.current = { at };
    demo.step({ type: "go", page: to, share });
    // the focus landing on the page says which page it is (its name); else the live region does
    if (hand && at !== undefined) landMark(to, at, label);
    else if (hand) demoFocus.current = true;
    else sayPage(demo.manifest?.pages.find((p) => p.id === to));
  };
  const backDemo = (view: DemoView) => {
    const last = demo.nav?.back[demo.nav.back.length - 1];
    if (!last) return;
    if (view === "screen") fadePage();
    markLoading();
    demoLand.current = { share: last.share };
    demo.step({ type: "back" });
    sayPage(demo.manifest?.pages.find((p) => p.id === last.page));
  };
  /* A hotspot pressed: another page, a place on this one, or the prompt. A modified click on a
     link (a new tab or window) is left to the browser: it opens the real page. */
  const handleHotspot = (hotspot: DemoHotspot, event: ReactMouseEvent, view: DemoView) => {
    if (event.timeStamp - swipedAt.current < SWIPE_CLICK_MS) {
      event.preventDefault(); // the swipe's own click
      return;
    }
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    if (modified && event.currentTarget instanceof HTMLAnchorElement) return;
    event.preventDefault();
    const zoom = view === "zoom";
    if (hotspot.k === "page" && hotspot.to) goDemo(hotspot.to, hotspot.at, view, zoom, hotspot.t);
    else if (hotspot.k === "anchor" && hotspot.at !== undefined) {
      demo.step({ type: "dismiss" });
      scrollDemo(hotspot.at, view);
      if (zoom && demo.nav) landMark(demo.nav.page, hotspot.at, hotspot.t);
    } else {
      demoOpener.current = zoom && event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      demo.step({ type: "prompt", prompt: { label: hotspot.t, path: hotspot.path } });
    }
  };
  /* The prompt or the page list closes, and the focus goes back where it came from: the link that
     opened the sheet in the larger view (else its page), the picture in the screen. */
  const dismissDemo = (view: DemoView) => {
    demo.step({ type: "dismiss" });
    const opener = demoOpener.current;
    demoOpener.current = null;
    if (view === "screen") shotBtnRef.current?.focus({ preventScroll: true });
    else (opener?.isConnected ? opener : zoomScrollerRef.current)?.focus({ preventScroll: true });
  };
  /* The focus went on past the sheet: it closes, and the focus stays where it went. */
  const leaveDemo = () => {
    demoOpener.current = null;
    demo.step({ type: "dismiss" });
  };
  /* A private project's way on: the request, with the project attached — never over the larger
     view (two dialogs would fight over the focus). */
  const askFromDemo = () => {
    if (!current) return;
    demo.step({ type: "dismiss" });
    setZoomOpen(false);
    openRequest({
      source: "project-card",
      projectId: current.id,
      projectName: current.name,
      projectType: projectRequestType[current.id],
      serviceSlug: tuned?.slug,
      returnFocusTo: shotBtnRef.current ?? undefined,
    });
  };
  const onScreenHotspot = (hotspot: DemoHotspot, event: ReactMouseEvent) => handleHotspot(hotspot, event, "screen");
  const onZoomHotspot = (hotspot: DemoHotspot, event: ReactMouseEvent) => handleHotspot(hotspot, event, "zoom");
  const onZoomKeys = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape" || !demo.nav || !(demo.nav.prompt || demo.nav.list)) return;
    event.preventDefault();
    event.stopPropagation();
    dismissDemo("zoom");
  };
  /* The hint goes once the site is scrolled, and comes back at its top. Written on the screen:
     a scroll must not re-render the page. */
  const onSiteScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    screenRef.current?.toggleAttribute("data-scrolled", event.currentTarget.scrollTop > SCROLL_ROOM_PX);
  };
  /* A capture no taller than the screen has nothing to scroll: no hint for it. Measured once it
     has loaded (its shape against the screen's does not change with the width). */
  const markShort = () => {
    const scroller = scrollerRef.current;
    if (scroller) screenRef.current?.toggleAttribute("data-short", shortOf(scroller));
  };

  /* "Vreau un proiect similar": the request dialog, carrying the project and — when the visitor
     chose one — the service. */
  const ask = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!current) return;
    openRequest({
      source: "project-card",
      projectId: current.id,
      projectName: current.name,
      projectType: projectRequestType[current.id],
      serviceSlug: tuned?.slug,
      returnFocusTo: event.currentTarget,
    });
  };

  const stores = current
    ? [
        { href: current.appStore, label: "App Store ↗" },
        { href: current.playStore, label: "Google Play ↗" },
      ].filter((store) => store.href)
    : [];

  return (
    <>
      <section id="portofoliu" className={s.page}>
        <div className="container">
          {/* A <div>, not a <header>: the scroll rail skips every heading inside a header, and the
              h1 is what names this section's marker. */}
          <div className={s.head}>
            <h1 className={s.title}>{l(COPY.title)}</h1>
            {/* The count lives on in the first channel: "Toate · 9". With no service to filter
                by (no project in any of them), the plain count. */}
            {channels.length > 0 ? (
              <div role="group" aria-label={l(COPY.channels)} className={s.channels}>
                <button
                  type="button"
                  aria-pressed={tuned === null}
                  className={`mono ${s.channel}`}
                  onClick={() => chooseChannel(null)}
                >
                  {l(COPY.all)} · <b>{projects.length}</b>
                </button>
                {channels.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    aria-pressed={tuned?.slug === c.slug}
                    className={`mono ${s.channel}`}
                    onClick={() => chooseChannel(c.slug)}
                  >
                    {l(CHANNEL_LABEL[c.slug] ?? directionTab[c.slug])} · <b>{c.members.length}</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className={`mono ${s.count}`}>
                {l(COPY.count)} · <b>{projects.length}</b>
              </p>
            )}
          </div>

          {current ? (
            <div
              ref={stageRef}
              role="region"
              aria-label={l(COPY.stage)}
              className={s.stage}
              style={accentStyle(current, projects.indexOf(current))}
              onKeyDown={onKeyDown}
            >
              <div className={`${s.left} ${big ? s.paged : ""}`}>
                <div className={s.viewer}>
                  <button
                    type="button"
                    className={`${s.nav} ${s.navPrev}`}
                    aria-label={l(COPY.prev)}
                    disabled={list.length < 2}
                    onClick={() => step(-1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M14.5 5.5 8 12l6.5 6.5" />
                    </svg>
                  </button>
                  {/* The monitor: a thin bezel, a chin with the brand's three subpixels, a glow in
                      the current project's colour. */}
                  <div ref={monitorRef} className={s.monitor}>
                    <div
                      ref={screenRef}
                      className={s.screen}
                      data-site={site || demoOn ? "" : undefined}
                      data-demo={demoOn ? "" : undefined}
                      onPointerDown={onScreenDown}
                      onPointerUp={onScreenUp}
                      onPointerCancel={() => {
                        swipe.current = null;
                      }}
                    >
                      {/* A project's demo: a browser's thin bar over its pages — Back, the page's
                          address on the real site (its pages listed under it), a light while the
                          next page comes in. */}
                      {demoOn ? (
                        <DemoBar
                          project={current}
                          demo={demo}
                          onBack={() => backDemo("screen")}
                          onGo={(target) => goDemo(target.id, undefined, "screen")}
                        />
                      ) : null}
                      {picture ? (
                        /* The window the picture sits in: a whole site scrolls inside it — the
                           wheel, a finger, ↑ ↓ while the picture has the focus — and the page
                           takes over at either end; a screenshot just fills it. */
                        <div ref={scrollerRef} className={s.scroller} onScroll={onSiteScroll}>
                          {demoOn ? (
                            /* a demo's page: its picture, its links and buttons over it (a mouse's
                               shortcut here; the larger view has them for the keyboard), and under
                               them the button that shows it larger */
                            <DemoPageView
                              variant="screen"
                              project={current}
                              lang={demo.manifest?.lang}
                              pages={demo.manifest?.pages ?? []}
                              page={demo.page}
                              shot={stale ? null : demoShot}
                              src={demoSrc}
                              live={screenLive}
                              imgRef={imgRef}
                              boxRef={pageBoxRef}
                              zoomRef={shotBtnRef}
                              zoomLabel={format(l(COPY.zoomDemoOf), { name: current.name })}
                              onZoom={onShotClick}
                              onHotspot={onScreenHotspot}
                              onLoad={markShort}
                              onError={site && demoSrc === site ? () => setBrokenSites((had) => new Set(had).add(site)) : undefined}
                              priority
                            />
                          ) : (
                            <button
                              ref={shotBtnRef}
                              type="button"
                              className={s.shotBtn}
                              aria-label={format(l(site ? COPY.zoomSiteOf : COPY.zoomOf), { name: current.name })}
                              onClick={onShotClick}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                ref={imgRef}
                                src={picture}
                                alt=""
                                decoding="async"
                                fetchPriority="high"
                                className={site ? s.site : s.shot}
                                onLoad={site ? markShort : undefined}
                                onError={site ? () => setBrokenSites((had) => new Set(had).add(site)) : undefined}
                              />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className={s.blank} aria-hidden="true">
                          {current.name}
                        </span>
                      )}
                      <canvas ref={fxRef} className={s.fx} aria-hidden="true" />
                      {screenLive ? (
                        /* a demo the pointer can press: "scroll and click", or only "click"
                           where there is nothing to scroll */
                        <span className={s.scrollHint} aria-hidden="true">
                          <svg viewBox="0 0 24 24" className={s.hintArrow}>
                            <path d="M12 4.5v14M6.5 13 12 18.5l5.5-5.5" />
                          </svg>
                          <span className={`${s.scrollHintText} ${s.hintScroll}`}>{l(COPY.hintDemo)}</span>
                          <span className={`${s.scrollHintText} ${s.hintPress}`}>{l(COPY.hintPress)}</span>
                        </span>
                      ) : site ? (
                        <span className={s.scrollHint} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M12 4.5v14M6.5 13 12 18.5l5.5-5.5" />
                          </svg>
                          <span className={s.scrollHintText}>{l(COPY.scrollHint)}</span>
                        </span>
                      ) : null}
                      {demoOn && demo.nav?.prompt && !zoomOpen ? (
                        <DemoPrompt
                          project={current}
                          label={demo.nav.prompt.label}
                          lang={demo.manifest?.lang}
                          path={demo.nav.prompt.path}
                          onClose={() => dismissDemo("screen")}
                          onLeave={leaveDemo}
                          onAsk={askFromDemo}
                        />
                      ) : null}
                      {picture ? (
                        <span className={s.zoomChip} aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                          </svg>
                          {l(COPY.zoom)}
                        </span>
                      ) : null}
                      <span className={s.screenRing} aria-hidden="true" />
                    </div>
                    <span ref={rgbRef} className={s.rgb} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`${s.nav} ${s.navNext}`}
                    aria-label={l(COPY.next)}
                    disabled={list.length < 2}
                    onClick={() => step(1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9.5 5.5 16 12l-6.5 6.5" />
                    </svg>
                  </button>
                </div>

                {/* Under the screen: ONE page of pixels — the page of the project on the screen —
                    right under the chin its board is wired to, then the pages and the search (a
                    portfolio bigger than one page). */}
                <div className={s.pxnav}>
                  {/* The row in a window: a page slides inside it without spilling over the page's
                      edges, with room in it for the lit pad's glow. */}
                  <div className={s.pxWindow}>
                    {/* The pixels: one labelled button per project, each a small square showing the
                        project — what the screen shows for it — framed in its colour, on the
                        circuit board drawn under them. Off, a little dimmed; the current one is
                        switched on — larger, lit, glowing — its route lit into the chin. */}
                    <div
                      ref={rowRef}
                      className={s.pixels}
                      role="group"
                      aria-label={pages > 1 ? format(l(COPY.pickPage), { n: page + 1, total: pages }) : l(COPY.pick)}
                    >
                      {pageItems.map((p, k) => {
                        const shot = pixelPicture(p, brokenSites);
                        return (
                          <button
                            key={p.id}
                            ref={(el) => {
                              if (el) pixelRefs.current.set(p.id, el);
                              else pixelRefs.current.delete(p.id);
                            }}
                            type="button"
                            data-project={p.id}
                            aria-current={p.id === current.id ? "true" : undefined}
                            data-quiet={quietIds.has(p.id) ? "" : undefined}
                            className={s.px}
                            style={{ ...accentStyle(p, projects.indexOf(p)), "--k": k } as CSSProperties}
                            onClick={() => goTo(p, pageStart + k >= pos ? 1 : -1)}
                            onPointerEnter={() => warmImage(warmed.current, p)}
                            onFocus={() => warmImage(warmed.current, p)}
                          >
                            <span className={s.pxDot} aria-hidden="true">
                              <i className={s.pxPad}>
                                {shot ? (
                                  // A plain <img> fed by getImageProps: the square is its pad, sized
                                  // by CSS. Keyed by its picture, so another one starts afresh.
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={shot.key}
                                    className={s.pxShot}
                                    src={shot.src}
                                    srcSet={shot.srcSet}
                                    alt=""
                                    decoding="async"
                                    draggable={false}
                                    data-fallback={shot.fallback}
                                    onError={(e) => pixelFallback(e.currentTarget)}
                                  />
                                ) : null}
                              </i>
                            </span>
                            <span className={`mono ${s.pxName}`}>{p.name}</span>
                          </button>
                        );
                      })}
                      {/* The board under the pads and the chin's flash: drawn, lit and played by
                          portfolioCircuit.ts (React never renders inside them). Unseen until it is
                          first drawn (`data-wait`; the prop never changes, so React never writes
                          it again). */}
                      <svg ref={boardRef} className={s.board} aria-hidden="true" focusable="false" data-wait="" />
                      <span ref={flashRef} className={s.flash} aria-hidden="true" />
                    </div>
                    <div ref={ghostsRef} className={s.ghosts} aria-hidden="true" inert />
                  </div>
                  {/* The pages, in words — "‹ Pagina anterioară · Pagina 2 din 12 · Pagina următoare ›"
                      — and a small pixel for each page, the one on show lit: a shortcut for the
                      pointer (the words are the way for the keyboard and a screen reader). */}
                  {pages > 1 ? (
                    <div className={s.pager}>
                      <button
                        type="button"
                        className={`${s.pageBtn} ${s.pagePrev}`}
                        aria-disabled={page === 0}
                        onClick={() => goPage(page - 1)}
                        onPointerEnter={() => warmImage(warmed.current, firstOfPage(page - 1))}
                        onFocus={() => warmImage(warmed.current, firstOfPage(page - 1))}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M14.5 5.5 8 12l6.5 6.5" />
                        </svg>
                        {l(COPY.prevPage)}
                      </button>
                      <p className={s.pageLabel}>
                        {l(COPY.page)
                          .split(/({n}|{total})/)
                          .map((part, k) =>
                            part === "{n}" ? <b key={k}>{page + 1}</b> : part === "{total}" ? <b key={k}>{pages}</b> : part,
                          )}
                      </p>
                      <div className={s.pageDots} aria-hidden="true">
                        {dotWindow(page, pages).map((k) => (
                          <button
                            key={k}
                            type="button"
                            tabIndex={-1}
                            className={s.pageDot}
                            data-on={k === page ? "" : undefined}
                            onClick={() => goPage(k)}
                            onPointerEnter={() => warmImage(warmed.current, firstOfPage(k))}
                          >
                            <i />
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={`${s.pageBtn} ${s.pageNext}`}
                        aria-disabled={page === pages - 1}
                        onClick={() => goPage(page + 1)}
                        onPointerEnter={() => warmImage(warmed.current, firstOfPage(page + 1))}
                        onFocus={() => warmImage(warmed.current, firstOfPage(page + 1))}
                      >
                        {l(COPY.nextPage)}
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9.5 5.5 16 12l-6.5 6.5" />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                  {/* Last, not between the screen and the row: the row's traces run up into the
                      chin, and a field between them would leave the board wired to nothing. */}
                  {big ? (
                    <PortfolioSearch
                      projects={projects}
                      currentId={current.id}
                      count={(n) => projectCount(n, l)}
                      onPick={pickFound}
                      onSay={setAnnouncement}
                      onWarm={(p) => warmImage(warmed.current, p)}
                    />
                  ) : null}
                </div>
              </div>

              {/* The project's words. */}
              <div ref={infoRef} className={s.info}>
                <p className={`mono ${s.counter}`}>
                  <span>
                    <b>{pad(pos + 1)}</b> / {pad(list.length)}
                  </span>
                </p>
                <h2 className={s.name}>{current.name}</h2>
                <p className={`mono ${s.tag}`}>
                  <span className={s.tagPx} aria-hidden="true" />
                  <span>{l(current.tag)}</span>
                </p>
                <p ref={descRef} id="portofoliu-descriere" className={`${s.desc} ${expanded ? "" : s.folded}`}>
                  {l(current.desc)}
                </p>
                {/* Hidden from the server on, and shown by the measurement above when something is
                    folded away. Hidden, it keeps its row (the CSS), so neither the page waking nor
                    a change of project moves the buttons under it. React never writes `hidden`
                    again (the prop never changes). */}
                <button
                  ref={moreRef}
                  type="button"
                  hidden
                  className={s.more}
                  aria-expanded={expanded}
                  aria-controls="portofoliu-descriere"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {l(expanded ? COPY.less : COPY.more)}
                </button>
                <div className={s.actions}>
                  <button ref={askRef} type="button" className={s.ask} onClick={ask}>
                    {l(COPY.similar)}
                  </button>
                  {/* In the same tab: a new tab greys out Back, and a visitor who closes it to
                      return closes the whole window, this page with it. */}
                  <span className={s.links}>
                    {current.url ? (
                      <a href={current.url} className={s.link}>
                        {l(COPY.open)}
                      </a>
                    ) : (
                      <span className={s.private}>{l(COPY.private)}</span>
                    )}
                    {stores.map((store) => (
                      <a key={store.label} href={store.href} className={s.link}>
                        {store.label}
                      </a>
                    ))}
                  </span>
                </div>
              </div>
              {/* the larger view has its own: a modal dialog hides the page from a screen reader */}
              <p className={s.srOnly} aria-live="polite">
                {zoomOpen ? "" : announcement}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* The picture, larger, in the site's dialog: a whole site at its own width, scrolling in the
          dialog and opened where the screen was; a screenshot whole. Open only while there is a
          picture: new content that takes it away closes the dialog instead of unmounting it open. */}
      {current ? (
        <Modal
          open={zoomOpen && Boolean(picture)}
          onClose={closeZoom}
          title={current.name}
          ground="ink"
          className={site || demoOn ? `${s.zoomPanel} ${s.zoomPanelSite}` : s.zoomPanel}
          restoreFocusRef={shotBtnRef}
          // Escape closes a demo's prompt or page list first, then the dialog
          closeOnEscape={!(demoOn && demo.nav && (demo.nav.prompt || demo.nav.list))}
        >
          {demoOn ? (
            /* The same demo, larger: the same pages and place, every link and button a real stop
               for the keyboard, named by its own text. */
            <div ref={zoomDemoRef} className={s.zoomDemo} onKeyDown={onZoomKeys}>
              <DemoBar
                project={current}
                demo={demo}
                onBack={() => backDemo("zoom")}
                onGo={(target) => goDemo(target.id, undefined, "zoom")}
              />
              {/* named, so the focus landing on it after a jump says the page */}
              <div
                ref={zoomScrollerRef}
                className={s.zoomScroller}
                tabIndex={-1}
                role="group"
                aria-label={pageLabel(demo.page) || undefined}
              >
                <DemoPageView
                  variant="zoom"
                  project={current}
                  lang={demo.manifest?.lang}
                  pages={demo.manifest?.pages ?? []}
                  page={demo.page}
                  shot={stale ? null : demoShot}
                  src={demoSrc}
                  live={zoomLive}
                  imgRef={zoomImgRef}
                  boxRef={zoomBoxRef}
                  onHotspot={onZoomHotspot}
                  mark={demoMark && demoMark.page === demo.nav?.page ? demoMark : null}
                  markRef={markRef}
                />
              </div>
              {demo.nav?.prompt ? (
                <DemoPrompt
                  project={current}
                  label={demo.nav.prompt.label}
                  lang={demo.manifest?.lang}
                  path={demo.nav.prompt.path}
                  onClose={() => dismissDemo("zoom")}
                  onLeave={leaveDemo}
                  onAsk={askFromDemo}
                />
              ) : null}
              <p className={s.srOnly} aria-live="polite">
                {announcement}
              </p>
            </div>
          ) : picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={zoomImgRef}
              src={picture}
              alt={format(l(site ? COPY.siteOf : COPY.shotOf), { name: current.name })}
              className={site ? s.zoomSite : s.zoomImg}
            />
          ) : null}
        </Modal>
      ) : null}

      {/* The close: the service pages' closing panel, with their own approved words. Its own
          section, with its own heading — the scroll rail gives it a second marker. */}
      <section className={s.close}>
        <div className="container">
          <div className={s.closePanel}>
            <span className={s.closeFrame} aria-hidden="true">
              <span className={s.closeThread} />
            </span>
            <h2 className={`disp ${s.closeTitle}`}>{l(solUI.bottomTitle)}</h2>
            <div className={s.closeActions}>
              <button
                type="button"
                className={s.cta}
                onClick={(event) =>
                  openRequest({ source: "portfolio-bottom", serviceSlug: tuned?.slug, returnFocusTo: event.currentTarget })
                }
              >
                {l(solUI.start)}
              </button>
              {tuned ? (
                <Link href={directionHref(tuned.slug)} className={s.serviceLink}>
                  {l(COPY.openService)}: {l(directionTab[tuned.slug])} <span aria-hidden="true">→</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
