"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { directionHref, directions } from "@/lib/directions";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { PORTFOLIO_FIELDS, narrowField, scatterPixels } from "@/lib/portfolioScatter";
import { projectGradient } from "@/lib/projectAccent";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import { directionTab, projectRequestType, projectsForSolution, solUI } from "@/lib/solutions";
import { REDUCED_MOTION_QUERY } from "@/lib/tilt";
import s from "./Portfolio.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  title: L("Portofoliu", "Портфолио", "Portfolio"),
  count: L("Proiecte", "Проекты", "Projects"),
  field: L(
    "Proiectele noastre, câte un pixel",
    "Наши проекты — по пикселю на каждый",
    "Our projects, one pixel each",
  ),
  open: L("Deschide site-ul ↗", "Открыть сайт ↗", "Open the site ↗"),
  private: L("nu are pagină publică", "нет публичной страницы", "no public page"),
  /* how to read the field — an instruction, the one line above it ({list} is the link) */
  howTo: L(
    "Fiecare punct luminos e un proiect. Apasă pe unul sau alege din {list}",
    "Каждая светящаяся точка — это проект. Нажмите на любую или выберите из {list}",
    "Each point of light is a project. Open one, or pick from {list}",
  ),
  howToList: L("lista de mai jos ↓", "списка ниже ↓", "the list below ↓"),
  /* the service filter */
  channels: L("Proiecte după serviciu", "Проекты по услугам", "Projects by service"),
  all: L("Toate", "Все", "All"),
  /* the legend under the field (its accessible name; nothing visible) */
  index: L("Lista proiectelor", "Список проектов", "Project list"),
  /* the card's × */
  closeCard: L("Închide", "Закрыть", "Close"),
  /* the card's request */
  similar: L("Vreau un proiect similar", "Хочу похожий проект", "I want a similar project"),
  /* the close, while a service is chosen */
  openService: L("Deschide serviciul", "Открыть услугу", "Open the service"),
};

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

/* A card opened by pointing closes this long after the pointer leaves both its pixel and the card:
   enough to cross an edge, not a pause. */
const CLOSE_DELAY_MS = 200;

/* Where a card sits against its pixel (Popover): the pixel just under the card's window bar when
   there is room; never closer than this to a screen edge or the fixed header; and the pixel kept
   at least this far inside the card's height, so the card always overlaps its target. */
const PIXEL_IN_CARD = 56;
const SCREEN_MARGIN = 12;
const REACH_INSET = 24;

/* A press outside a card closes it — but not one that lands this soon after the card opened:
   the second half of a double-click, or a shaky hand's second tap. */
const OPEN_GRACE_MS = 600;

/** At and below this width the field is a picker: no popover, the card sits under the field. */
const PICKER_QUERY = "(max-width: 640px)";

/** A position, in %, at two decimals: the same short string on the server and the client. */
const pct = (value: number) => Math.round(value * 100) / 100;

/** The card materialises out of the pixel as a mosaic of this many blocks (columns × rows). */
const MOSAIC_COLS = 8;
const MOSAIC_ROWS = 10;

/* `(max-width: 640px)` as a store. The server — and hydration — answer "popover", the wider
   layout; a phone switches to the picker right after it hydrates, which only changes ARIA. */
const subscribePicker = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(PICKER_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
};
const readPicker = () => typeof window.matchMedia === "function" && window.matchMedia(PICKER_QUERY).matches;
const serverPicker = () => false;

/**
 * How brightly each of a pixel's three subpixels burns to make `hex`: its red, green and blue
 * shares, never quite off — a real pixel's dark subpixel still shows as a dim bar.
 */
function subpixels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return [1, 1, 1];
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => 0.14 + 0.86 * (((value >> shift) & 0xff) / 255);
  return [channel(16), channel(8), channel(0)].map((c) => Math.round(c * 100) / 100) as [number, number, number];
}

/** A project's two colours as `--p1` / `--p2`, and its pixel's subpixel levels as `--sr/--sg/--sb`. */
function accentStyle(project: ProjectItem, position: number): CSSProperties {
  const [p1, p2] = projectGradient(project, position);
  const [sr, sg, sb] = subpixels(p2);
  return { "--p1": p1, "--p2": p2, "--sr": sr, "--sg": sg, "--sb": sb } as CSSProperties;
}

/** A small deterministic noise in [0, 1) for (seed, i): the same "random" on the server and the client. */
function noise(seed: number, i: number): number {
  let h = Math.imul(seed ^ (i + 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/** FNV-1a of a project id, the seed of its pixel's and its mosaic's noise. */
function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "CRM PRIVAT · FĂRĂ LINK" → ["CRM PRIVAT", "FĂRĂ LINK"] — the tag is free admin text. */
function tagChips(tag: string): string[] {
  return tag
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The blocks a card is built from as it opens: each one a shade of the project's colour, gone at
 * its own moment after its column has appeared. aria-hidden, nothing to read.
 */
function Mosaic({ seed }: { seed: number }) {
  return (
    <span className={s.mosaic} aria-hidden="true">
      {Array.from({ length: MOSAIC_COLS * MOSAIC_ROWS }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--c": i % MOSAIC_COLS,
              "--j": Math.round(noise(seed, i) * 110),
              "--k": `${Math.round(30 + noise(seed, i + 977) * 70)}%`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/**
 * The project a pixel opens into: its window bar, its screenshot, its name, its links — and the
 * request for one like it, which opens the site's request dialog with this project attached.
 */
function ProjectCard({
  project,
  id,
  className,
  onAsk,
  onClose,
}: {
  project: ProjectItem;
  id?: string;
  className: string;
  onAsk: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  /* the card beside a pixel closes; the phone's card under the field never does */
  onClose?: () => void;
}) {
  const l = useLoc();
  const image = project.images?.[0];
  const stores = [
    { href: project.appStore, label: "App Store ↗" },
    { href: project.playStore, label: "Google Play ↗" },
  ].filter((store) => store.href);
  return (
    <div id={id} role="group" aria-label={project.name} className={className}>
      <Mosaic seed={seedOf(project.id)} />
      <div className={s.bar}>
        <span className={s.chips}>
          {tagChips(l(project.tag)).map((chip) => (
            <small key={chip} className={`mono ${s.chip}`}>
              {chip}
            </small>
          ))}
        </span>
        {/* The window's lights. Where a window's close button sits, a real one: the third light
            looked like a Windows ×, and pressing it did nothing. */}
        {onClose ? (
          <span className={s.barEnd}>
            <span className={`${s.lights} ${s.lightsTwo}`} aria-hidden="true" />
            <button type="button" className={s.shut} aria-label={l(COPY.closeCard)} onClick={onClose}>
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ) : (
          <span className={s.lights} aria-hidden="true" />
        )}
      </div>
      {/* With a public site, the screenshot opens it too — the biggest thing on the card is the
          easiest to hit. A second way to the same link: out of Tab and of the accessibility tree,
          where "Deschide site-ul" already is. */}
      {project.url ? (
        <a href={project.url} className={s.shot} tabIndex={-1} aria-hidden="true">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" decoding="async" className={s.shotImg} />
          ) : null}
        </a>
      ) : (
        <div className={s.shot}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" decoding="async" className={s.shotImg} />
          ) : null}
        </div>
      )}
      <div className={s.body}>
        {/* A heading to assistive tech, under the page's h1 — but not an <h2> tag: the scroll
            rail reads the page's sections from `section h1, section h2`, and the cards (the one
            beside a pixel and the phone's, both in the DOM) are not sections of the page. */}
        <p role="heading" aria-level={2} className={`disp ${s.name}`}>
          {project.name}
        </p>
        <p className={s.desc}>{l(project.desc)}</p>
        {/* In the same tab: a new tab greys out Back, and a visitor who closes it to return
            closes the whole window, this page with it. */}
        <div className={s.links}>
          {project.url ? (
            <a href={project.url} className={s.link}>
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
        </div>
        <button type="button" className={s.ask} onClick={onAsk}>
          {l(COPY.similar)}
        </button>
      </div>
    </div>
  );
}

/**
 * The card's box, grown out of its pixel (2026-10-04, "la hover … sa dispara boxul … gandeste-te
 * unde se poate de plasat ca sa putem deschide"): a card that closes when the pointer leaves must
 * be one the pointer can reach. So it lies over the pixel's whole 40px target (the CSS's
 * `--reach`): the pointer that opened it is already on it, and goes on to its link or its button in
 * any direction without crossing empty space.
 *
 * Its top is worked out from where it is ON SCREEN, before the first paint and whenever its height
 * changes: level with its pixel (just under the window bar) where there is room, risen when there
 * is no room below, never under the fixed header — the whole card in view, its link and its
 * button included, so nothing has to be scrolled to while the pointer holds it open.
 */
function Popover({
  style,
  onPointerEnter,
  onPointerLeave,
  children,
}: {
  style: CSSProperties;
  onPointerEnter: (event: ReactPointerEvent) => void;
  onPointerLeave: (event: ReactPointerEvent) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const field = el?.parentElement;
    const pixel = el?.previousElementSibling;
    if (!el || !field || !pixel) return;
    const place = () => {
      const height = el.offsetHeight;
      el.style.setProperty("--card-h", `${height}px`);
      const dot = pixel.getBoundingClientRect();
      const y = dot.top + dot.height / 2;
      const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 0;
      let top = y - PIXEL_IN_CARD;
      top = Math.min(top, window.innerHeight - SCREEN_MARGIN - height);
      top = Math.max(top, header + SCREEN_MARGIN);
      /* and, however short the screen, still level with its pixel: the reach must hold */
      top = Math.min(top, y - REACH_INSET);
      top = Math.max(top, y + REACH_INSET - height);
      el.style.setProperty("--top", `${Math.round(top - field.getBoundingClientRect().top)}px`);
    };
    place();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={s.pop} style={style} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {children}
    </div>
  );
}

/**
 * /portofoliu — every project in the store as one real pixel, scattered across an empty field:
 * no grid, no matrix behind them, nothing lined up (lib/portfolioScatter.ts).
 *
 * Above 640px the field is a POPOVER field. A card is open for `preview ?? pinned`:
 *  · pointing at a pixel with a mouse, or focusing it from the keyboard, previews it — a HOVER
 *    card: it closes 200ms after the pointer leaves both the pixel and the card (the owner's call,
 *    2026-10-04: "cand iau mouse-ul sa dispara boxul"). The card grows out of the pixel, its near
 *    corner over the pixel's target and its whole height on screen (Popover), so the pointer can
 *    always go on into it and reach its link and its button;
 *  · a click or a tap PINS it: it stays until its ×, Escape, or a press on empty space — for a
 *    finger a TAP (a click), so starting a scroll never closes it. A second click keeps it (a
 *    double-click is one click); Enter from the keyboard opens and closes it;
 *  · focus leaving the field ends a preview, and a pinned card, if any, comes back: pointing at
 *    other pixels on the way never throws a pinned card away.
 * The card sits right after its pixel in the DOM, so Tab goes pixel → its card → the next pixel.
 *
 * At 640px and below it is a PICKER: no hover, the selected project's card always shown under the
 * field (the first one to begin with — server-rendered), a tap selects another and brings its card
 * into view. ARIA follows the mode: expanded/controls on the popover, pressed + a live card here.
 *
 * Around the field:
 *  · one line saying how to read it — "Fiecare punct luminos e un proiect…";
 *  · a SERVICE FILTER: one channel per direction with live projects (lib/solutions.ts
 *    solutionProjectIds — curated, never guessed from the free-text tag), named in plain words.
 *    A channel switches off every pixel outside it, and shows the ones it keeps under the loupe
 *    for a second; positions never move;
 *  · the LEGEND under the field: every project's light, name and tag. Pointing at a row locates
 *    its pixel (it goes under the loupe, nothing opens); a click is the pixel's own click;
 *  · on every card, "Vreau un proiect similar": the request dialog, with the project attached;
 *  · the CLOSE after the section: the service pages' closing panel.
 */
export function Portfolio() {
  const { projects } = useSiteContent();
  const l = useLoc();
  const { isOpen: requestOpen, openRequest } = useRequestFlow();
  const sectionRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const belowRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  /* Focus this component moves itself (back to a pixel on Escape) must not reopen that pixel. */
  const restoringFocus = useRef(false);
  /* A press that started inside the field: the blur it causes is not focus leaving the field. */
  const pressingInside = useRef(false);
  /* A tap just picked a project: bring its card into view once it has rendered. */
  const revealPick = useRef(false);
  /* The pixel a mouse has entered and not yet moved over (see onPixelEnter). */
  const entered = useRef<number | null>(null);
  /* The kind of pointer behind the last press — a finger closes a card by a tap, not a press. */
  const lastPointer = useRef("");
  /* When a click or a tap last opened a card (see OPEN_GRACE_MS). */
  const openedAt = useRef(0);
  const cardId = useId();
  const belowId = useId();
  const picker = useSyncExternalStore(subscribePicker, readPicker, serverPicker);
  const [selected, setSelected] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  /* The service filter's channel (a direction slug), `null` for all. Never on the URL: the
     estimator reads `?serviciu=` on every page and would preselect a type for every CTA here. */
  const [channel, setChannel] = useState<string | null>(null);
  /* For a second after a channel is pressed, its pixels show under the loupe: what it kept. */
  const [flashing, setFlashing] = useState(false);
  /* The pixel a legend row points at — a look only, it never opens a card. */
  const [located, setLocated] = useState<number | null>(null);
  /* Bumped when a card should be brought into view (a legend row, a tap): the effect runs on it,
     so the card already open is seen too. */
  const [revealTick, setRevealTick] = useState(0);

  useOffscreenAttribute(sectionRef);

  const layouts = useMemo(() => {
    const ids = projects.map((p) => p.id);
    return {
      wide: scatterPixels(ids, PORTFOLIO_FIELDS.wide),
      mid: scatterPixels(ids, PORTFOLIO_FIELDS.mid),
      narrow: scatterPixels(ids, narrowField(ids.length)),
    };
  }, [projects]);

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
  const lit = tuned ? new Set(tuned.members.map((p) => p.id)) : null;
  const isLit = (i: number) => lit === null || lit.has(projects[i]?.id);

  const last = Math.max(0, projects.length - 1);
  const picked = Math.min(selected, last);
  /* The phone's card always belongs to a lit pixel: a channel that switches the picked one off
     hands its card to the channel's reference project. */
  const reference = tuned ? projects.indexOf(tuned.members[0]) : 0;
  const current = isLit(picked) ? picked : Math.max(0, reference);
  const active = picker ? null : (preview ?? pinned);
  const open = active !== null && active <= last && isLit(active) ? active : null;

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const closeAll = () => {
    cancelClose();
    entered.current = null;
    setPreview(null);
    setPinned(null);
  };
  const endPreviewSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPreview(null), CLOSE_DELAY_MS);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  /* The channel's flash ends after a second — a new channel starts it again. */
  useEffect(() => {
    if (!flashing) return;
    const timer = window.setTimeout(() => setFlashing(false), 1100);
    return () => window.clearTimeout(timer);
  }, [flashing, channel]);

  /* While a card is open: Escape closes it (focus back on its pixel if it was in the card), and so
     does a press on anything that is not a pixel, a legend row or the card — the empty field
     included. A finger's press is not yet a tap — it may be the start of a scroll — so for touch
     it is the click that closes. A press within OPEN_GRACE_MS of the card opening is the rest of
     the click that opened it. A press inside the card is remembered so the blur it causes is not
     taken for focus leaving. All of it stands down while the request dialog is up: a press inside
     the dialog is not a press beside the card, and the card behind it must still be there when it
     closes — the dialog hands focus back to its button. */
  useEffect(() => {
    if (open === null || requestOpen) return;
    const field = fieldRef.current;
    const shut = () => {
      window.clearTimeout(closeTimer.current);
      entered.current = null;
      setPreview(null);
      setPinned(null);
    };
    const outside = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      const inCard = !!el?.closest(`.${s.pop}`) && !!field?.contains(el);
      return { inCard, away: !inCard && !el?.closest("[data-pixel], [data-row]") };
    };
    const settled = (event: Event) => event.timeStamp - openedAt.current > OPEN_GRACE_MS;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const inCard = document.getElementById(cardId)?.contains(document.activeElement) ?? false;
      if (inCard) {
        restoringFocus.current = true;
        field?.querySelector<HTMLButtonElement>(`[data-pixel="${open}"]`)?.focus();
        restoringFocus.current = false;
      }
      shut();
    };
    const onPress = (event: PointerEvent) => {
      lastPointer.current = event.pointerType;
      const { inCard, away } = outside(event.target);
      pressingInside.current = inCard;
      if (event.pointerType !== "touch" && away && settled(event)) shut();
    };
    const onTap = (event: MouseEvent) => {
      if (lastPointer.current !== "touch") return;
      if (outside(event.target).away && settled(event)) shut();
    };
    const onRelease = () => {
      pressingInside.current = false;
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("click", onTap, true);
    document.addEventListener("pointerup", onRelease, true);
    document.addEventListener("pointercancel", onRelease, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("click", onTap, true);
      document.removeEventListener("pointerup", onRelease, true);
      document.removeEventListener("pointercancel", onRelease, true);
      /* a press still held when these go (the card closed under it) never reports its release */
      pressingInside.current = false;
    };
  }, [open, cardId, requestOpen]);

  /* A tap in the picker: the card under the field changed — bring it into view if it is not. */
  useEffect(() => {
    if (!revealPick.current) return;
    revealPick.current = false;
    belowRef.current?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [current]);

  /* A legend row or a finger opened a card: bring it into view, but only if it is not. A mouse's
     own pixel is not scrolled — that would slide the field under a cursor that has not moved. */
  useEffect(() => {
    if (revealTick === 0) return;
    const card = document.getElementById(cardId);
    if (!card) return;
    const box = card.getBoundingClientRect();
    /* in view = below the fixed header (the card's scroll-margin-top) and above the bottom */
    const clear = parseFloat(getComputedStyle(card).scrollMarginTop) || 0;
    if (box.top >= clear && box.bottom <= window.innerHeight) return;
    card.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [revealTick, cardId]);

  /* A mouse previews a pixel on its first MOVE after entering it. Not on the entry alone: a pixel
     that scrolls under a STATIONARY cursor gets the boundary events anyway, and previewing on
     those would open a card for a visitor who pointed at nothing (the rule of Home's pills,
     Directions.tsx). A scroll sends no move — measured in Edge, by script, smoothly and with the
     wheel: only pointerover/pointerenter — so the first real move of the hand opens the card at
     once. And only once per entry: a card closed with the mouse still on its pixel stays closed
     until the mouse leaves and comes back. The pending close is cancelled by the move, so coming
     back within 200ms keeps the card. */
  const onPixelEnter = (i: number) => (event: ReactPointerEvent) => {
    if (picker || event.pointerType !== "mouse") return;
    entered.current = i;
  };
  const onPixelMove = (i: number) => () => {
    if (entered.current !== i) return;
    entered.current = null;
    cancelClose();
    setPreview(i);
  };
  /* Leaving the pixel or its card: the hover card goes, unless the pointer is on its way from one
     to the other — the two overlap, so that takes no time at all. */
  const onPointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return;
    entered.current = null;
    endPreviewSoon();
  };
  const onCardEnter = (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") cancelClose();
  };
  const notePointer = (event: ReactPointerEvent) => {
    lastPointer.current = event.pointerType;
  };
  /* Keyboard focus previews a pixel; a mouse's focus (it comes with the click) and focus this
     component restores itself do not — the click and the pin decide those. */
  const onPixelFocus = (i: number) => (event: ReactFocusEvent<HTMLButtonElement>) => {
    if (picker || restoringFocus.current || !event.currentTarget.matches(":focus-visible")) return;
    cancelClose();
    setPreview(i);
  };
  /* A pixel's click: it opens the card and keeps it open — a second click, the other half of a
     double-click, changes nothing. Only Enter (a click with no pointer) closes the open one. A
     finger's tap also brings the card into view: there is no hover to have shown it already. */
  const pixelClick = (i: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const fromKeyboard = event.detail === 0;
    if (picker) {
      revealPick.current = i !== current;
      setSelected(i);
      return;
    }
    cancelClose();
    /* a click decides; an entry the mouse has not moved on since must not reopen it after */
    entered.current = null;
    setSelected(i);
    if (fromKeyboard && pinned === i) {
      closeAll();
      return;
    }
    if (pinned !== i) openedAt.current = event.timeStamp;
    setPinned(i);
    setPreview(null);
    if (!fromKeyboard && lastPointer.current === "touch") setRevealTick((tick) => tick + 1);
  };
  /* The card's ×: it closes, and focus goes back to its pixel. */
  const closeCard = (i: number) => {
    closeAll();
    restoringFocus.current = true;
    fieldRef.current?.querySelector<HTMLButtonElement>(`[data-pixel="${i}"]`)?.focus({ preventScroll: true });
    restoringFocus.current = false;
  };
  /* Focus leaving the field (the card is inside it) ends a preview; a pinned card stays. A blur
     caused by a press inside the card is not focus leaving. */
  const onFieldBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    if (pressingInside.current) return;
    setPreview(null);
  };

  /* A channel switches off every pixel outside it, and shows the ones it keeps under the loupe for
     a second — the press has a visible answer. Whatever card is open closes: a pointer's press
     already does that (a channel is not a pixel or the card), this makes Enter and Space agree. A
     picked project the channel switches off hands the phone's card to the channel's reference
     project — without scrolling: the visitor is up at the channels. */
  const chooseChannel = (slug: string | null) => {
    closeAll();
    setChannel(slug);
    setFlashing(true);
    const next = channels.find((c) => c.slug === slug);
    if (next && !next.members.some((p) => p.id === projects[current]?.id)) {
      setSelected(Math.max(0, projects.indexOf(next.members[0])));
    }
  };

  /* The legend. A row a mouse MOVES over — not one scrolled under a still cursor — or one focused
     from the keyboard locates its pixel. */
  const onRowMove = (i: number) => (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse" && located !== i) setLocated(i);
  };
  const onRowFocus = (i: number) => (event: ReactFocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.matches(":focus-visible")) setLocated(i);
  };
  const unlocate = () => setLocated(null);
  /* A row's click is its pixel's click, and its card is brought into view if it is not — the one
     already open too. From the keyboard, focus moves onto the pixel, so Tab goes on into the card
     and Escape comes back to the pixel — as if the pixel itself had been pressed. On a phone the
     legend sits under the card, so a row brings its card into view even when it is the one
     already shown (a pixel's tap only scrolls when the card changes). */
  const onRowClick = (i: number) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    const fromKeyboard = event.detail === 0;
    if (picker) {
      if (i === current) belowRef.current?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
      else pixelClick(i, event);
      return;
    }
    const closing = fromKeyboard && pinned === i;
    pixelClick(i, event);
    if (closing) return;
    setRevealTick((tick) => tick + 1);
    if (!fromKeyboard) return;
    restoringFocus.current = true;
    fieldRef.current?.querySelector<HTMLButtonElement>(`[data-pixel="${i}"]`)?.focus({ preventScroll: true });
    restoringFocus.current = false;
  };

  /* "Vreau un proiect similar": the request dialog, carrying the project and — when the visitor
     chose one — the service. Beside a pixel the card is pinned FIRST: focus leaving for the dialog
     ends a preview, and a preview's card would unmount with the button the dialog hands focus
     back to. */
  const ask = (i: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const p = projects[i];
    if (!p) return;
    if (!picker) {
      cancelClose();
      setSelected(i);
      setPinned(i);
      setPreview(null);
    }
    openRequest({
      source: "project-card",
      projectId: p.id,
      projectName: p.name,
      projectType: projectRequestType[p.id],
      serviceSlug: tuned?.slug,
      returnFocusTo: event.currentTarget,
    });
  };

  /* The instruction line, its "{list}" made a link to the legend. */
  const [howToBefore, howToAfter = ""] = l(COPY.howTo).split("{list}");

  const project = projects[current];

  return (
    <>
      <section ref={sectionRef} id="portofoliu" className={s.page}>
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
            {/* How to read the field, in one line — an instruction, not a lead: the field alone
                read as dust on the screen to a visitor who does not explore. It starts with the
                legend's own point of light, as a map key would. */}
            {projects.length > 0 ? (
              <p className={s.howTo}>
                <span className={s.howToDot} aria-hidden="true" />
                <span>
                  {howToBefore}
                  <a href="#lista-proiectelor" className={s.howToLink}>
                    {l(COPY.howToList)}
                  </a>
                  {howToAfter}
                </span>
              </p>
            ) : null}
          </div>

          <div
            ref={fieldRef}
            role="group"
            aria-label={l(COPY.field)}
            className={s.field}
            style={{ "--n": projects.length } as CSSProperties}
            onBlur={onFieldBlur}
          >
            {projects.map((p, i) => {
              const seed = seedOf(p.id);
              const w = layouts.wide[i];
              const t = layouts.mid[i];
              const m = layouts.narrow[i];
              const style = {
                ...accentStyle(p, i),
                // Its own flicker rhythm: periods that never line up, so the field never blinks as one.
                "--flicker": `${(5.3 + ((i * 7) % 11) * 0.61).toFixed(2)}s`,
                // When it switches on as the page arrives: scattered over 1.4s, in no order.
                "--on": `${Math.round(120 + noise(seed, 1) * 1300)}ms`,
                "--px-w": pct(w.x),
                "--py-w": pct(w.y),
                "--flip-w": w.x > 50 ? 1 : 0,
                "--px-t": pct(t.x),
                "--py-t": pct(t.y),
                "--flip-t": t.x > 50 ? 1 : 0,
                "--px-m": pct(m.x),
                "--py-m": pct(m.y),
              } as CSSProperties;
              const on = isLit(i);
              const isOpen = open === i;
              return (
                <Fragment key={p.id}>
                  {/* A pixel outside the chosen channel is switched off: dimmed, and `inert` —
                      out of Tab, of pointing and of the accessibility tree. */}
                  <button
                    type="button"
                    data-pixel={i}
                    data-selected={i === current ? "" : undefined}
                    data-open={isOpen ? "" : undefined}
                    data-located={located === i && on ? "" : undefined}
                    data-flash={flashing && on ? "" : undefined}
                    data-off={on ? undefined : ""}
                    inert={!on}
                    aria-label={p.name}
                    aria-expanded={picker ? undefined : isOpen}
                    aria-pressed={picker ? i === current : undefined}
                    aria-controls={picker ? belowId : isOpen ? cardId : undefined}
                    className={s.px}
                    style={style}
                    onPointerDown={notePointer}
                    onPointerEnter={onPixelEnter(i)}
                    onPointerMove={onPixelMove(i)}
                    onPointerLeave={onPointerLeave}
                    onFocus={onPixelFocus(i)}
                    onClick={(event) => pixelClick(i, event)}
                  >
                    {/* the pixel itself: a point of light about the size of a real one, and the
                        loupe's view of it — its three subpixels on the black matrix */}
                    <span className={s.light} aria-hidden="true" />
                    <span className={s.tri} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                  </button>
                  {isOpen ? (
                    <Popover style={style} onPointerEnter={onCardEnter} onPointerLeave={onPointerLeave}>
                      <ProjectCard
                        project={p}
                        id={cardId}
                        className={s.card}
                        onAsk={(event) => ask(i, event)}
                        onClose={() => closeCard(i)}
                      />
                    </Popover>
                  ) : null}
                </Fragment>
              );
            })}
          </div>

          {/* ≤640px: the picker's card, always shown, under the field. The live region is the
              persistent wrapper, so a picked project's card is announced as it replaces the last. */}
          {project ? (
            <div
              ref={belowRef}
              id={belowId}
              aria-live="polite"
              className={s.belowWrap}
              style={accentStyle(project, current)}
            >
              <ProjectCard
                key={project.id}
                project={project}
                className={`${s.card} ${s.below}`}
                onAsk={(event) => ask(current, event)}
              />
            </div>
          ) : null}

          {/* The legend: every project's light, name and tag, in the store's order — row i is
              pixel i. No visible heading; the list is named for assistive tech. A row switched
              off by the filter leaves the list the way its pixel leaves the field: the whole item
              is inert, not just its button (an empty list item would stay behind). */}
          {projects.length > 0 ? (
            <ul id="lista-proiectelor" className={s.index} aria-label={l(COPY.index)}>
              {projects.map((p, i) => {
                const on = isLit(i);
                const isOpen = open === i;
                return (
                  <li key={p.id} inert={!on}>
                    <button
                      type="button"
                      data-row={i}
                      data-lit={isOpen || (picker && i === current) || (located === i && on) ? "" : undefined}
                      data-off={on ? undefined : ""}
                      aria-expanded={picker ? undefined : isOpen}
                      aria-pressed={picker ? i === current : undefined}
                      aria-controls={picker ? belowId : isOpen ? cardId : undefined}
                      className={s.row}
                      style={accentStyle(p, i)}
                      onPointerDown={notePointer}
                      onPointerMove={onRowMove(i)}
                      onPointerLeave={unlocate}
                      onFocus={onRowFocus(i)}
                      onBlur={unlocate}
                      onClick={onRowClick(i)}
                    >
                      <span className={s.swatch} aria-hidden="true" />
                      <span className={s.rowName}>{p.name}</span>
                      <span className={`mono ${s.rowTag}`}>{tagChips(l(p.tag)).join(" · ")}</span>
                      {/* a row opens something: said by its arrow, not by a word */}
                      <span className={s.rowGo} aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </section>

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

/** Smooth, unless the visitor asked for less motion. */
function scrollBehavior(): ScrollBehavior {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
  return reduced ? "instant" : "smooth";
}
