"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  activeIndex,
  crossedDown,
  pickRailSections,
  progressOf,
  railHasNav,
  railLayout,
  sectionTarget,
  type RailHeading,
} from "@/lib/hud/rail";
import { useLoc } from "@/lib/i18n/content";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { isPageCovered, subscribePageCover } from "@/lib/scrollLock";
import { RAIL_COPY, RAIL_HOME_SECTIONS, type RailLabel } from "./copy";
import styles from "./ScrollRail.module.css";

/**
 * The fibre-optic scroll rail — the page's sections along the right edge, at 861px and up.
 * The native scrollbar stays the scrollbar; this is a map of the page next to it.
 *
 * Two parts under one `[data-hud][data-rail]` root that takes no pointer events:
 *   - the FIBRE (`aria-hidden`): a faint core line, the lit thread filling with scroll progress
 *     (`--rail-p`, written on the rail's own root, never on <html> or <body>), its glowing head,
 *     a streak that travels along the thread only while the visitor scrolls, and one diamond
 *     tick per section — lit once passed, pulsing once when a downward scroll passes it;
 *   - a real `<nav>` of 44×44 `<button>`s at the ticks (no `href`: nothing to follow, no
 *     `#estimare` link on the page), each named by a label that shows on hover and focus. A
 *     button scrolls its section to just under the header — smoothly, or instantly under reduced
 *     motion — and a keyboard activation (`detail === 0`) also moves focus to the section, so
 *     the next Tab continues from there. A mouse click never moves focus.
 *
 * Which sections: the home page (every id in `RAIL_HOME_SECTIONS` present) gets its curated
 * list; any other page, one marker per `section` named by its first `h1`/`h2`
 * (`pickRailSections`). More markers than `RAIL_MAX_MARKERS` (the privacy policy): the fibre
 * only, no `<nav>`.
 *
 * Mounted by `components/hud/HudChrome.tsx` (a lazy part, desktop only). The maths is
 * `lib/hud/rail.ts`; the per-frame state lives in `createRail()` below, a plain object —
 * React only re-renders when the markers or the current section change.
 *
 * Listeners: ONE passive `scroll` on window (one frame per burst) and a passive `resize`, a
 * ResizeObserver on <html> (the page grows as content loads, Work's spiral lengthens its track),
 * the scene's layout event, the page cover's release, the fonts settling. No wheel, touch or
 * pointer listener: scrolling stays the browser's.
 *
 * While the page is covered (the dialog pins the body, the burger locks <html>) or ScrollTrigger
 * is measuring (`html[data-scroll-measure]`), the positions the rail would read are not the
 * page's: it writes nothing, and measures again once the cover lifts.
 */

/** `SCENE_LAYOUT_EVENT` in lib/scene.ts, written out so this chunk does not carry the scene module. */
export const RAIL_LAYOUT_EVENT = "tbs:scene-layout";

/** `INSTANT_SCROLL_ATTR` in lib/scene.ts (the same reason): set on <html> while ScrollTrigger measures. */
export const RAIL_MEASURE_ATTR = "data-scroll-measure";

/** The flow streak keeps travelling this long after the last scroll event. */
export const RAIL_FLOW_MS = 180;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Headings inside these never name a section. */
const NOT_CONTENT = 'header, footer, [role="dialog"], [aria-hidden="true"], [data-guide], [data-rail]';

const PASSIVE = { passive: true } as const;
const CAPTURE = { capture: true, passive: true } as const;

type RailSection = { el: HTMLElement; label: RailLabel };
type RailMarker = RailSection & { y: number };
type RailView = { placed: readonly RailMarker[]; active: number };

const EMPTY_VIEW: RailView = { placed: [], active: 0 };
const readEmpty = () => EMPTY_VIEW;

/* ---- page reads ------------------------------------------------------------------------- */

/** `--header-h` as the page resolves it (px); 0 when it cannot be read. */
function headerHeight(): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h"));
  return Number.isFinite(value) ? value : 0;
}

/** The page's scroll range. */
function scrollRange(): number {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** A heading's text nodes, in order, leaving out anything `aria-hidden` inside it. */
function textPieces(heading: HTMLElement): string[] {
  const pieces: string[] = [];
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const hidden = node.parentElement?.closest('[aria-hidden="true"]');
    if (hidden && heading.contains(hidden)) continue;
    pieces.push(node.textContent ?? "");
  }
  return pieces;
}

/** The home page's curated sections when every one is on the page; otherwise the page's headings. */
function discoverSections(): RailSection[] {
  const home: { el: HTMLElement | null; label: RailLabel }[] = RAIL_HOME_SECTIONS.map(({ id, label }) => ({
    el: document.getElementById(id),
    label,
  }));
  if (home.every((section): section is RailSection => section.el !== null)) return home;

  const scope = document.querySelector("main") ?? document.body;
  const headings: RailHeading<HTMLElement>[] = [];
  for (const heading of scope.querySelectorAll<HTMLElement>("section h1, section h2")) {
    const found = heading.closest("section");
    const section = found !== null && scope.contains(found) ? found : null;
    headings.push({
      section,
      text: textPieces(heading),
      excluded: heading.closest(NOT_CONTENT) !== null,
      sectionH2s: section ? section.querySelectorAll("h2").length : 0,
    });
  }
  return pickRailSections(headings).map(({ section, label }) => ({ el: section, label: { plain: label } }));
}

const sameLabel = (a: RailLabel, b: RailLabel) =>
  ("key" in a && "key" in b && a.key === b.key) ||
  ("text" in a && "text" in b && a.text === b.text) ||
  ("plain" in a && "plain" in b && a.plain === b.plain);

const sameSections = (a: readonly RailSection[], b: readonly RailSection[]) =>
  a.length === b.length && a.every((section, i) => section.el === b[i].el && sameLabel(section.label, b[i].label));

/** Move focus to a section a keyboard jump landed on; a tabindex it lacked goes on blur. */
function focusSection(el: HTMLElement): void {
  if (!el.hasAttribute("tabindex")) {
    el.setAttribute("tabindex", "-1");
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
  }
  el.focus({ preventScroll: true });
}

/* ---- the rail's per-frame state --------------------------------------------------------- */

type Rail = ReturnType<typeof createRail>;

/**
 * One rail's measurements and frame state, outside React. `read`/`subscribe` feed
 * `useSyncExternalStore`; `attach` wires the listeners to the rendered root and fibre and
 * returns their removal; `remeasure` asks for a measurement on the next frame; `jump` is a
 * marker's activation.
 */
function createRail() {
  let view = EMPTY_VIEW;
  const listeners = new Set<() => void>();

  let parts: { root: HTMLElement; fibre: HTMLElement } | null = null;
  let reducedQuery: MediaQueryList | null = null;
  let known: readonly RailSection[] = [];
  let targets: number[] = [];
  let max = 0;
  let lastY = 0;
  let written = "";
  let scrollFrame = 0;
  let measureFrame = 0;
  let flowTimer: ReturnType<typeof setTimeout> | undefined;

  const publish = (next: RailView) => {
    view = next;
    for (const listener of listeners) listener();
  };

  /** Covered, or ScrollTrigger mid-measure: what the page reports now is not where it is. */
  const held = () => isPageCovered() || document.documentElement.hasAttribute(RAIL_MEASURE_ATTR);

  const writeProgress = (root: HTMLElement, y: number) => {
    const value = progressOf(y, max).toFixed(4);
    if (value === written) return;
    written = value;
    root.style.setProperty("--rail-p", value);
  };

  function measure(): void {
    if (parts === null || held()) return;
    const sections = discoverSections();
    const y = window.scrollY;
    max = scrollRange();
    const header = headerHeight();
    const measured = sections.map((s) => sectionTarget(s.el.getBoundingClientRect().top + y, header, max));
    const positions = railLayout(measured, max, parts.fibre.clientHeight);
    const placed = positions.length === sections.length ? sections.map((s, i) => ({ ...s, y: positions[i] })) : [];

    // A different page (or a different list): no pulses for ticks it never scrolled past.
    if (!sameSections(known, sections)) lastY = y;
    known = sections;
    targets = placed.length > 0 ? measured : [];

    writeProgress(parts.root, y);
    const active = activeIndex(y, targets);
    const unchanged =
      active === view.active &&
      placed.length === view.placed.length &&
      placed.every((m, i) => m.y === view.placed[i].y && m.el === view.placed[i].el && sameLabel(m.label, view.placed[i].label));
    if (!unchanged) publish({ placed, active });
  }

  function onScrollFrame(): void {
    scrollFrame = 0;
    if (parts === null || held()) return;
    const { root } = parts;
    const y = window.scrollY;
    writeProgress(root, y);

    if (reducedQuery?.matches !== true) {
      const crossed = crossedDown(lastY, y, targets);
      if (crossed.length > 0) {
        const ticks = root.querySelectorAll<HTMLElement>("[data-rail-tick]");
        for (const i of crossed) {
          // Swapping between two identical one-shot animations restarts it with no reflow.
          ticks[i]?.setAttribute("data-pulse", ticks[i].getAttribute("data-pulse") === "a" ? "b" : "a");
        }
      }
    }
    lastY = y;

    const active = activeIndex(y, targets);
    if (active !== view.active) publish({ ...view, active });

    root.setAttribute("data-flowing", "");
    clearTimeout(flowTimer);
    flowTimer = setTimeout(() => root.removeAttribute("data-flowing"), RAIL_FLOW_MS);
  }

  function remeasure(): void {
    if (parts === null || measureFrame !== 0) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measure();
    });
  }

  function attach(root: HTMLElement, fibre: HTMLElement): () => void {
    parts = { root, fibre };
    reducedQuery = typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
    lastY = window.scrollY;

    const onScroll = () => {
      if (scrollFrame === 0) scrollFrame = requestAnimationFrame(onScrollFrame);
    };
    const onLayout = () => remeasure();

    window.addEventListener("scroll", onScroll, PASSIVE);
    window.addEventListener("resize", onLayout, PASSIVE);
    // Dispatched on the stage root and not bubbling: heard on the way down.
    document.addEventListener(RAIL_LAYOUT_EVENT, onLayout, CAPTURE);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onLayout);
    observer?.observe(document.documentElement);
    const stopCover = subscribePageCover(() => {
      if (!isPageCovered()) remeasure();
    });
    let live = true;
    document.fonts?.ready.then(
      () => {
        if (live) remeasure();
      },
      () => {},
    );

    measure();

    return () => {
      live = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onLayout);
      document.removeEventListener(RAIL_LAYOUT_EVENT, onLayout, true);
      observer?.disconnect();
      stopCover();
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(measureFrame);
      scrollFrame = 0;
      measureFrame = 0;
      clearTimeout(flowTimer);
      root.removeAttribute("data-flowing");
      parts = null;
    };
  }

  function jump(index: number, detail: number): void {
    const marker = view.placed[index];
    if (!marker) return;
    const top = sectionTarget(marker.el.getBoundingClientRect().top + window.scrollY, headerHeight(), scrollRange());
    const reduced = typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches;
    window.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
    if (detail === 0) focusSection(marker.el);
  }

  return {
    read: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach,
    remeasure,
    jump,
  };
}

/* ---- the component ---------------------------------------------------------------------- */

export function ScrollRail() {
  const { locale, t } = useLanguage();
  const l = useLoc();
  const pathname = usePathname();
  const [rail] = useState<Rail>(createRail);
  const { placed, active } = useSyncExternalStore(rail.subscribe, rail.read, readEmpty);
  const rootRef = useRef<HTMLDivElement>(null);
  const fibreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const fibre = fibreRef.current;
    if (!root || !fibre) return;
    return rail.attach(root, fibre);
  }, [rail]);

  /* A client navigation brings other sections; a language switch renames a page's headings
     (the home labels re-render on their own, a discovered label is the heading's text). */
  useEffect(() => {
    rail.remeasure();
  }, [rail, pathname, locale]);

  const labelOf = (label: RailLabel) =>
    "key" in label ? t(label.key) : "text" in label ? l(label.text) : label.plain;
  const at = (y: number) => ({ "--y": `${y}px` }) as CSSProperties;

  return (
    <div ref={rootRef} className={styles.root} data-hud="" data-rail="">
      <div ref={fibreRef} className={styles.fibre} aria-hidden="true">
        <span className={styles.core} />
        <span className={styles.thread} />
        <span className={styles.flow} />
        <span className={styles.head} />
        {placed.map((marker, i) => (
          <span
            key={i}
            className={styles.tick}
            data-rail-tick=""
            data-passed={i <= active ? "" : undefined}
            style={at(marker.y)}
          />
        ))}
      </div>
      {railHasNav(placed.length) && (
        <nav className={styles.nav} aria-label={l(RAIL_COPY.nav)}>
          <ul className={styles.list}>
            {placed.map((marker, i) => (
              <li key={i} className={styles.item} style={at(marker.y)}>
                <button
                  type="button"
                  className={styles.marker}
                  aria-current={i === active ? "true" : undefined}
                  onClick={(event) => rail.jump(i, event.detail)}
                >
                  <span className={styles.markerTick} aria-hidden="true" />
                  <span className={styles.markerLabel}>{labelOf(marker.label)}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
