"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { mediaUrl } from "@/lib/api";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { format } from "@/lib/i18n/format";
import type { ProjectItem } from "@/lib/siteContent";
import {
  addressOf,
  deepLink,
  DEMO_MAX_BYTES,
  demoStep,
  parseManifest,
  sitePath,
  startNav,
  type DemoHotspot,
  type DemoManifest,
  type DemoNav,
  type DemoPage,
  type DemoShot,
  type DemoStep,
} from "@/lib/siteDemo";
import s from "./Portfolio.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

export const DEMO_COPY = {
  back: L("Înapoi în site", "Назад по сайту", "Back"),
  /* the address names the list: it starts with the address the bar shows */
  pages: L("{address} — paginile site-ului", "{address} — страницы сайта", "{address} — the site's pages"),
  privateAddress: L("{name} · sistem privat", "{name} · закрытая система", "{name} · private system"),
  links: L("Linkurile din pagina {title}", "Ссылки на странице {title}", "Links on the {title} page"),
  /* a page as the larger view names it: its title and its address */
  pageOf: L("{title} — {address}", "{title} — {address}", "{title} — {address}"),
  promptTitle: L("„{label}” merge pe site-ul adevărat", "«{label}» работает на настоящем сайте", "“{label}” works on the real site"),
  promptText: L(
    "Aici poți răsfoi paginile principale; restul funcționează pe {host}.",
    "Здесь можно полистать основные страницы; остальное работает на {host}.",
    "Here you can browse the main pages; the rest works on {host}.",
  ),
  openHost: L("Deschide {host} ↗", "Открыть {host} ↗", "Open {host} ↗"),
  stay: L("Rămân aici", "Остаться здесь", "Stay here"),
  privateTitle: L("{name} e un sistem privat", "{name} — закрытая система", "{name} is a private system"),
  privateText: L(
    "Lucrează cu datele unui client, așa că nu se poate deschide public. Putem construi unul asemănător pentru tine.",
    "Она работает с данными клиента, поэтому её нельзя открыть публично. Мы можем сделать похожую для вас.",
    "It runs on a client's data, so it can't be opened publicly. We can build a similar one for you.",
  ),
  similar: L("Vreau un proiect similar", "Хочу похожий проект", "I want a similar project"),
  cut: L("Restul paginii, pe {host} ↗", "Остальная часть страницы — на {host} ↗", "The rest of the page, on {host} ↗"),
};

/* ---------- the manifest and where the visitor is ---------- */

/** Manifests already read, by path (null: tried and not usable). Kept for the page's life. */
const manifests = new Map<string, DemoManifest | null>();

export type SiteDemo = {
  /** The manifest's path, when the project has one: the screen is a demo from its first paint. */
  src: string;
  manifest: DemoManifest | null;
  nav: DemoNav | null;
  page: DemoPage | null;
  step: (step: DemoStep) => void;
};

/**
 * A project's demo: its manifest — fetched once, after the page is up, only for the project on
 * the screen — and where the visitor is in it. Another project (or another manifest) starts at
 * its start page, with nothing behind it: derived, not reset by an effect.
 */
export function useSiteDemo(project: ProjectItem | null): SiteDemo {
  const src = sitePath(project?.demo ?? "") ?? "";
  const [, setRead] = useState(0);
  useEffect(() => {
    if (!src || manifests.has(src)) return;
    let live = true;
    fetch(mediaUrl(src), { credentials: "same-origin" })
      .then((r) => (r.ok && Number(r.headers.get("content-length") ?? 0) <= DEMO_MAX_BYTES ? r.text() : null))
      .then((text) => (text && text.length <= DEMO_MAX_BYTES ? parseManifest(JSON.parse(text)) : null))
      .catch(() => null)
      .then((manifest) => {
        manifests.set(src, manifest);
        if (live) setRead((n) => n + 1);
      });
    return () => {
      live = false;
    };
  }, [src]);
  const manifest = src ? (manifests.get(src) ?? null) : null;
  const key = `${project?.id ?? ""} ${src}`;
  const [held, setHeld] = useState<{ key: string; nav: DemoNav } | null>(null);
  // where the visitor was belongs to the project it was in: gone with it (a sheet left open there
  // must not come back, and take the focus, when the visitor returns)
  if (held && held.key !== key) setHeld(null);
  const known = (nav: DemoNav) => manifest?.pages.some((p) => p.id === nav.page);
  const nav = manifest ? (held && held.key === key && known(held.nav) ? held.nav : startNav(manifest.start)) : null;
  const step = (next: DemoStep) => {
    if (!manifest) return;
    setHeld((was) => ({
      key,
      nav: demoStep(was && was.key === key && known(was.nav) ? was.nav : startNav(manifest.start), next),
    }));
  };
  const page = manifest && nav ? (manifest.pages.find((p) => p.id === nav.page) ?? null) : null;
  return { src, manifest, nav, page, step };
}

/* ---------- the visitor's device ---------- */

const matches = (query: string) => typeof window.matchMedia === "function" && window.matchMedia(query).matches;
const subscribeTo = (query: string) => (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
};
const FINE_POINTER = "(hover: hover) and (pointer: fine)";
const PHONE = "(max-width: 640px)";
const subscribeFine = subscribeTo(FINE_POINTER);
const subscribePhone = subscribeTo(PHONE);

/** A mouse or a trackpad: the screen's small hotspots can be aimed at. False on the server. */
export const useFinePointer = () => useSyncExternalStore(subscribeFine, () => matches(FINE_POINTER), () => false);
/** A phone's width: a page's phone shot is shown where it has one. False on the server. */
export const usePhone = () => useSyncExternalStore(subscribePhone, () => matches(PHONE), () => false);

/** The shot a page is shown in here: its phone one on a phone, where it has one. */
export function shotOf(page: DemoPage | null, phone: boolean): DemoShot | null {
  if (!page) return null;
  return phone && page.m ? page.m : page.d;
}

/** The address the bar shows: the page's on the real site, or the project's name for a private one. */
export function useAddress(project: ProjectItem, page: DemoPage | null): string {
  const l = useLoc();
  return addressOf(project.url, page ?? undefined) ?? format(l(DEMO_COPY.privateAddress), { name: project.name });
}

/* ---------- the bar: back, the address, the pages ---------- */

export function DemoBar({
  project,
  demo,
  onBack,
  onGo,
}: {
  project: ProjectItem;
  demo: SiteDemo;
  onBack: () => void;
  onGo: (page: DemoPage) => void;
}) {
  const l = useLoc();
  const listId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const addrRef = useRef<HTMLButtonElement>(null);
  const address = useAddress(project, demo.page);
  const pages = demo.manifest?.pages ?? [];
  const nav = demo.nav;
  const many = pages.length > 1;
  /* The list closes back onto the address that opened it — a page chosen, or Escape. */
  const closeList = () => {
    demo.step({ type: "list", open: false });
    addrRef.current?.focus({ preventScroll: true });
  };
  const onListKeys = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape" || !nav?.list) return;
    event.preventDefault();
    event.stopPropagation();
    closeList();
  };
  /* The focus gone on past the bar and the list (Tab, a press elsewhere): the list closes, the
     focus stays where it went. A window losing the focus is no reason. */
  const onLeave = (event: ReactFocusEvent) => {
    const to = event.relatedTarget;
    if (!nav?.list || !(to instanceof Node) || barRef.current?.contains(to) || listRef.current?.contains(to)) return;
    demo.step({ type: "list", open: false });
  };
  return (
    <>
    <div ref={barRef} className={s.demoBar} onBlur={onLeave}>
      {/* aria-disabled, not disabled: at the first page it keeps the focus that pressed it */}
      <button
        type="button"
        className={s.demoBack}
        aria-label={l(DEMO_COPY.back)}
        aria-disabled={!nav || nav.back.length === 0 ? "true" : undefined}
        onClick={onBack}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14.5 5.5 8 12l6.5 6.5" />
        </svg>
      </button>
      {many ? (
        <button
          ref={addrRef}
          type="button"
          className={s.demoAddr}
          aria-label={format(l(DEMO_COPY.pages), { address })}
          aria-expanded={nav?.list ?? false}
          aria-controls={listId}
          onClick={() => demo.step({ type: "list", open: !nav?.list })}
          onKeyDown={onListKeys}
        >
          <span className={s.demoAddrText}>{address}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
          </svg>
        </button>
      ) : (
        <span className={s.demoAddr}>
          <span className={s.demoAddrText}>{address}</span>
        </span>
      )}
      <span className={s.demoProgress} aria-hidden="true" />
    </div>
    {/* beside the bar, not in it: the list opens over the page, above its hotspots and chips —
        and a press beside it closes it, never presses what is under it */}
    {many && nav?.list ? <div className={s.demoListBack} aria-hidden="true" onClick={() => demo.step({ type: "list", open: false })} /> : null}
    {many && nav?.list ? (
      <ul ref={listRef} id={listId} className={s.demoList} lang={demo.manifest?.lang} onKeyDown={onListKeys} onBlur={onLeave}>
        {pages.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={s.demoListItem}
              aria-current={p.id === nav.page ? "page" : undefined}
              onClick={() => {
                onGo(p);
                addrRef.current?.focus({ preventScroll: true });
              }}
            >
              <span>{p.title}</span>
              {p.path ? <span className={`mono ${s.demoListPath}`}>{p.path}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    ) : null}
    </>
  );
}

/* ---------- a page: its picture, the button that shows it larger, its hotspots ---------- */

/**
 * Reading order, which is the tab order in the larger view: row by row, left to right in a row.
 * A row is what sits at one height — a header's logo, links and button are a few px apart, and
 * a plain top-to-bottom sort would jumble them. A control joins the row when its middle is within
 * half the smaller height of the row's first one's middle. A control inside another (a button on
 * a card) still comes after it, so it stays on top.
 */
function readingOrder(hot: readonly DemoHotspot[]): DemoHotspot[] {
  const mid = (h: DemoHotspot) => h.r[1] + h.r[3] / 2;
  const rows: DemoHotspot[][] = [];
  for (const h of [...hot].sort((a, b) => a.r[1] - b.r[1] || a.r[0] - b.r[0])) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(mid(h) - mid(row[0])) < Math.min(h.r[3], row[0].r[3]) / 2) row.push(h);
    else rows.push([h]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.r[0] - b.r[0]));
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** The links with a landing mark among them, at `at` (-1: after the last; -2: none). */
const withMark = (items: ReactNode[], at: number, mark: ReactNode) =>
  at === -2 || !mark ? items : [...items.slice(0, at < 0 ? items.length : at), mark, ...items.slice(at < 0 ? items.length : at)];
/** Where a hotspot sits in its page's box (or, `band` tall, in the pinned header's). */
const spot = (h: DemoHotspot, shot: DemoShot, band = shot.h): CSSProperties => ({
  left: pct(h.r[0], shot.w),
  top: pct(h.r[1], band),
  width: pct(h.r[2], shot.w),
  height: pct(h.r[3], band),
});

export function DemoPageView({
  variant,
  project,
  lang,
  pages,
  page,
  shot,
  src,
  live,
  imgRef,
  boxRef,
  zoomRef,
  zoomLabel,
  onZoom,
  onHotspot,
  onLoad,
  onError,
  priority,
  mark,
  markRef,
}: {
  variant: "screen" | "zoom";
  project: ProjectItem;
  /** the language the page's labels are in */
  lang?: string;
  pages: readonly DemoPage[];
  page: DemoPage | null;
  shot: DemoShot | null;
  /** the picture shown (resolved) */
  src: string;
  /** whether the hotspots take presses here */
  live: boolean;
  imgRef?: Ref<HTMLImageElement>;
  boxRef?: Ref<HTMLDivElement>;
  zoomRef?: Ref<HTMLButtonElement>;
  zoomLabel?: string;
  onZoom?: (event: ReactMouseEvent) => void;
  onHotspot: (hotspot: DemoHotspot, event: ReactMouseEvent) => void;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
  /** where a jump in the larger view landed (shot units), named by the link that made it: the focus
   *  waits there, among the links in reading order, so Tab goes on from the section it jumped to */
  mark?: { y: number; label: string } | null;
  markRef?: Ref<HTMLSpanElement>;
}) {
  const l = useLoc();
  const screen = variant === "screen";
  const address = addressOf(project.url, page ?? undefined) ?? project.name;
  const spots = useMemo(() => readingOrder(shot?.hot ?? []), [shot]);
  const site = project.url;
  const host = addressOf(site) ?? "";
  /* A link keeps its real address, so a modified click (a new tab, a middle click) opens the real
     page — where the owner wants the visitor to end up anyway. Never outside the project's site. */
  const hrefOf = (h: DemoHotspot): string | null => {
    if (h.el !== "link") return null;
    if (h.k === "page") return deepLink(pages.find((p) => p.id === h.to)?.path ?? "/", site);
    if (h.k === "site") return deepLink(h.path, site);
    return null;
  };

  const hotspot = (h: DemoHotspot, k: number, band?: number) => {
    const copy = band !== undefined;
    const common = {
      className: s.hot,
      style: shot ? spot(h, shot, band) : undefined,
      "data-kind": h.k,
      // the small screen's hotspots are a pointer's shortcut: the keyboard has the bar and the
      // larger view, where every one of them is a real, named stop
      tabIndex: screen || copy ? -1 : undefined,
      // nor does a press give them the focus (a pinned copy is aria-hidden)
      onMouseDown: screen || copy ? (e: ReactMouseEvent) => e.preventDefault() : undefined,
      onClick: (e: ReactMouseEvent) => onHotspot(h, e),
      "aria-label": h.t,
      // its name is the site's own words, in the site's language (the group's is ours)
      lang,
      "aria-haspopup": h.k === "site" ? ("dialog" as const) : undefined,
    };
    const href = hrefOf(h);
    // keyed by page too: no control of one page is reused for another (nor keeps its focus)
    const key = `${page?.id ?? ""}:${k}`;
    return href ? (
      <a key={key} href={href} {...common} />
    ) : (
      <button key={key} type="button" {...common} />
    );
  };
  const fixed = live && shot?.fixed ? shot.fixed : 0;
  /* the box keeps the shot's shape before its picture is in; --band is the pinned header's height
     as a share of the width, which a focused link keeps clear of (scroll-margin) */
  const box = shot ? ({ aspectRatio: `${shot.w} / ${shot.h}`, "--band": fixed ? fixed / shot.w : 0 } as CSSProperties) : undefined;

  return (
    <div ref={boxRef} className={s.demoPage} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        // the small screen's picture is named by its button; the larger view's names its page
        alt={screen || !page ? "" : format(l(DEMO_COPY.pageOf), { title: page.title, address })}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={s.demoImg}
        onLoad={onLoad}
        onError={onError}
      />
      {onZoom ? (
        <button ref={zoomRef} type="button" className={s.demoZoom} aria-label={zoomLabel} onClick={onZoom} />
      ) : null}
      {live && shot ? (
        <div
          className={s.hots}
          aria-hidden={screen ? "true" : undefined}
          role={screen ? undefined : "group"}
          aria-label={screen || !page ? undefined : format(l(DEMO_COPY.links), { title: page.title })}
        >
          {withMark(
            spots.map((h, k) => hotspot(h, k)),
            mark && !screen ? spots.findIndex((h) => h.r[1] >= mark.y) : -2,
            mark && shot ? (
              <span key="mark" ref={markRef} tabIndex={-1} className={s.hotMark} style={{ top: pct(mark.y, shot.h) }}>
                <span className={s.srOnly}>{mark.label}</span>
              </span>
            ) : null,
          )}
        </div>
      ) : null}
      {fixed && shot ? (
        /* a fixed header stays at the top while the page scrolls, as on the real site: its band of
           the picture, pinned, with its links (copies: the keyboard has them in the page itself).
           It takes the presses it covers — between its links, the screen's opens the larger view,
           as the picture does — so nothing under it is pressed unseen. */
        <div
          className={s.demoFixed}
          aria-hidden="true"
          style={{ aspectRatio: `${shot.w} / ${fixed}`, backgroundImage: `url("${src}")` }}
          onClick={screen && onZoom ? (e) => void (e.target === e.currentTarget && onZoom(e)) : undefined}
        >
          {spots.filter((h) => h.r[1] + h.r[3] <= fixed).map((h, k) => hotspot(h, k, fixed))}
        </div>
      ) : null}
      {shot?.cut && host ? (
        <a className={s.demoCut} href={deepLink(page?.path, site) ?? undefined}>
          {format(l(DEMO_COPY.cut), { host })}
        </a>
      ) : null}
    </div>
  );
}

/* ---------- the prompt: "this works on the real site" ---------- */

export function DemoPrompt({
  project,
  label,
  lang,
  path,
  onClose,
  onLeave,
  onAsk,
}: {
  project: ProjectItem;
  /** what was pressed */
  label: string;
  /** the language of what was pressed (the site's) */
  lang?: string;
  path?: string;
  onClose: () => void;
  /** the focus went on past it (Tab, a press elsewhere): it closes, the focus stays where it went */
  onLeave: () => void;
  /** a private project's way on: the request, with the project attached */
  onAsk: () => void;
}) {
  const l = useLoc();
  const titleId = useId();
  const textId = useId();
  const first = useRef<HTMLElement | null>(null);
  const link = deepLink(path, project.url);
  const host = addressOf(project.url) ?? "";
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, []);
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    onClose();
  };
  const onBlur = (event: ReactFocusEvent) => {
    const to = event.relatedTarget;
    if (to instanceof Node && !event.currentTarget.contains(to)) onLeave();
  };
  /* "„{label}” merge pe site-ul adevărat": the label is the site's words, in its language */
  const [before, after = ""] = l(DEMO_COPY.promptTitle).split("{label}");
  return (
    <>
      {/* a press anywhere else in the screen closes it — never navigates */}
      <div className={s.demoSheetBack} aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={textId}
        className={s.demoSheet}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      >
        <p id={titleId} className={s.demoSheetTitle}>
          {link ? (
            <>
              {before}
              <span lang={lang}>{label}</span>
              {after}
            </>
          ) : (
            format(l(DEMO_COPY.privateTitle), { name: project.name })
          )}
        </p>
        <p id={textId} className={s.demoSheetText}>
          {link ? format(l(DEMO_COPY.promptText), { host }) : l(DEMO_COPY.privateText)}
        </p>
        <div className={s.demoSheetActions}>
          {link ? (
            <a ref={(el) => void (first.current = el)} href={link} className={s.demoSheetGo}>
              {format(l(DEMO_COPY.openHost), { host })}
            </a>
          ) : (
            <button ref={(el) => void (first.current = el)} type="button" className={s.demoSheetGo} onClick={onAsk}>
              {l(DEMO_COPY.similar)}
            </button>
          )}
          <button type="button" className={s.demoSheetStay} onClick={onClose}>
            {l(DEMO_COPY.stay)}
          </button>
        </div>
      </div>
    </>
  );
}
