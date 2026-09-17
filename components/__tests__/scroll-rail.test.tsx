/**
 * The fibre-optic scroll rail (components/hud/rail/ScrollRail.tsx): the decorative fibre and the
 * `<nav>` of section buttons on the right edge.
 *
 * What is pinned here:
 *   1. which sections — the home page's curated seven (labels from the catalog and RAIL_COPY),
 *      any other page's `section` headings, and no nav past 8 markers;
 *   2. its markup — `[data-hud][data-rail]`, an `aria-hidden` fibre, real buttons (no href);
 *   3. the jump — `scrollTo` under the header, smooth or instant, focus only from the keyboard;
 *   4. the frame — `--rail-p` on the rail's own root (never on <html> or <body>), the current
 *      marker, the tick pulses, the flow flag, and nothing while covered or measuring;
 *   5. re-measuring — the ResizeObserver, `resize`, the scene's layout event, the cover's release,
 *      a client navigation;
 *   6. listeners — passive `scroll` and `resize` only, no wheel/touch/pointer;
 *   7. the CSS Module contract — no pointer events on the root, 44px markers, motion only under
 *      `prefers-reduced-motion: no-preference`, no blur, no dots.
 *
 * jsdom lays nothing out, so the geometry is stubbed: each section reports a document top, the
 * page a scroll range, the fibre a height. Animation frames are queued by hand and flushed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => h.pathname,
}));

import { RAIL_COPY, RAIL_HOME_SECTIONS } from "@/components/hud/rail/copy";
import {
  RAIL_FLOW_MS,
  RAIL_LAYOUT_EVENT,
  RAIL_MEASURE_ATTR,
  ScrollRail,
} from "@/components/hud/rail/ScrollRail";
import { LanguageProvider, useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { INSTANT_SCROLL_ATTR, SCENE_LAYOUT_EVENT } from "@/lib/scene";
import { coverPage } from "@/lib/scrollLock";

const ROOT = process.cwd();
const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8").replace(/\r\n/g, "\n");

/* ---- geometry ------------------------------------------------------------------------------ */

const HEADER_H = 71;
const INNER_H = 768;
const FIBRE_H = 560;

/** Document tops of the elements the rail measures; `getBoundingClientRect` follows scrollY. */
const tops = new Map<Element, number>();
let scrollY = 0;
let scrollHeight = 0;

function place(el: Element, docTop: number) {
  tops.set(el, docTop);
}

function setScroll(y: number) {
  scrollY = y;
}

/* ---- animation frames, by hand ----------------------------------------------------------------- */

let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

function flushFrames() {
  act(() => {
    // Frames queued while flushing run on the next flush, as in a browser.
    const due = frames;
    frames = new Map();
    for (const cb of due.values()) cb(0);
  });
}

/** Scroll to `y` the way a browser reports it: the position first, then one `scroll` event. */
function scrollTo(y: number) {
  setScroll(y);
  act(() => void window.dispatchEvent(new Event("scroll")));
  flushFrames();
}

/* ---- ResizeObserver, by hand --------------------------------------------------------------------- */

const resizeObservers: { cb: ResizeObserverCallback; targets: Element[]; live: boolean }[] = [];

class ControlledResizeObserver {
  private readonly record: { cb: ResizeObserverCallback; targets: Element[]; live: boolean };
  constructor(cb: ResizeObserverCallback) {
    this.record = { cb, targets: [], live: true };
    resizeObservers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.record.live = false;
  }
}

/* ---- media queries ------------------------------------------------------------------------------ */

let reducedMotion = false;

function stubMatchMedia() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query.includes("prefers-reduced-motion: reduce") ? reducedMotion : false;
        },
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

/* ---- fixtures ------------------------------------------------------------------------------------ */

/** The home page's sections, at document tops that give targets 0, 900, 1800 … (max 5000). */
const HOME_TOPS: Record<(typeof RAIL_HOME_SECTIONS)[number]["id"], number> = {
  top: 0,
  servicii: 971,
  lucrari: 1871,
  despre: 2771,
  echipa: 3571,
  estimare: 4271,
  contact: 5471,
};

/** `railLayout` of those targets over a 560px fibre: 0, 100.8, 201.6, 302.4, 392, 470.4, 560. */
const HOME_Y = [0, 101, 202, 302, 392, 470, 560];

function mountHomeFixture(): Record<string, HTMLElement> {
  const main = document.createElement("main");
  const els: Record<string, HTMLElement> = {};
  for (const { id } of RAIL_HOME_SECTIONS) {
    const section = document.createElement("section");
    section.id = id;
    const h2 = document.createElement("h2");
    h2.textContent = `Heading ${id}`;
    section.append(h2);
    main.append(section);
    place(section, HOME_TOPS[id]);
    els[id] = section;
  }
  document.body.append(main);
  return els;
}

/** A page without the curated ids: sections, headings and what must be skipped. */
function mountServiceFixture(): Record<string, HTMLElement> {
  const header = document.createElement("header");
  header.innerHTML = `<section><h2>In the header</h2></section>`;
  const page = document.createElement("div");
  page.innerHTML = `
    <section data-k="hero"><h1>  Magazin
      online </h1><h2>Sub</h2></section>
    <section data-k="highlights"><h2>Benefit one</h2><h2>Benefit two</h2><h2>Benefit three</h2></section>
    <section data-k="cases"><h2>Cazuri <span aria-hidden="true">✦</span>reale</h2></section>
    <section data-k="hidden" aria-hidden="true"><h2>Hidden</h2></section>
    <div role="dialog"><section data-k="dialog"><h2>Dialog</h2></section></div>
    <div data-guide=""><section><h2>Guide</h2></section></div>
    <section data-k="steps"><h2>Cum lucrăm</h2></section>
    <section data-k="bottom"><h2>Hai să vorbim</h2></section>
    <h2>Not in a section</h2>`;
  const footer = document.createElement("footer");
  footer.innerHTML = `<section><h2>In the footer</h2></section>`;
  document.body.append(header, page, footer);
  const els: Record<string, HTMLElement> = {};
  let top = 0;
  for (const el of document.querySelectorAll<HTMLElement>("section[data-k]")) {
    els[el.dataset.k!] = el;
    place(el, top);
    top += 900;
  }
  return els;
}

/** Render the rail and run the frame its mount asks for, so each test starts settled. */
function renderRail(locale: Locale = "ro") {
  const view = render(
    <LanguageProvider initialLocale={locale}>
      <ScrollRail />
    </LanguageProvider>,
  );
  flushFrames();
  return view;
}

const railRoot = () => document.querySelector<HTMLElement>("[data-rail]")!;
const fibre = () => railRoot().querySelector<HTMLElement>(":scope > [aria-hidden='true']")!;
const ticks = () => Array.from(railRoot().querySelectorAll<HTMLElement>("[data-rail-tick]"));
const railNav = () => screen.queryByRole("navigation", { name: RAIL_COPY.nav.ro });
const markers = () => within(railNav()!).getAllByRole("button");
const railP = () => railRoot().style.getPropertyValue("--rail-p");
const yOf = (el: HTMLElement) => el.style.getPropertyValue("--y");

/* ---- setup ------------------------------------------------------------------------------------- */

type ScrollToMock = MockInstance<(options: ScrollToOptions) => void>;
let scrollToSpy: ScrollToMock;

beforeEach(() => {
  h.pathname = "/";
  tops.clear();
  scrollY = 0;
  scrollHeight = INNER_H + 5000;
  reducedMotion = false;
  frames = new Map();
  nextFrame = 1;
  resizeObservers.length = 0;

  const style = document.createElement("style");
  style.textContent = `:root { --header-h: ${HEADER_H}px; }`;
  document.head.append(style);

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
    frames.delete(id);
  });
  vi.stubGlobal("ResizeObserver", ControlledResizeObserver);
  stubMatchMedia();

  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => INNER_H });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => scrollHeight });
  vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
    return this.parentElement?.hasAttribute("data-rail") && this.getAttribute("aria-hidden") === "true" ? FIBRE_H : 0;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const top = (tops.get(this) ?? 0) - scrollY;
    return { top, bottom: top + 100, left: 0, right: 100, width: 100, height: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
  scrollToSpy = (vi.spyOn(window, "scrollTo") as unknown as ScrollToMock).mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute(RAIL_MEASURE_ATTR);
});

/* ---- 1–2. sections and markup ------------------------------------------------------------------- */

describe("home page", () => {
  it("renders a [data-hud][data-rail] root, an aria-hidden fibre and a named nav of 7 buttons, no links", () => {
    mountHomeFixture();
    renderRail();

    const root = railRoot();
    expect(root.getAttribute("data-hud")).toBe("");
    expect(fibre()).not.toBeNull();
    expect(fibre().getAttribute("aria-hidden")).toBe("true");

    const nav = railNav();
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute("aria-label")).toBe("Secțiunile paginii");
    expect(markers()).toHaveLength(7);
    for (const button of markers()) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.hasAttribute("href")).toBe(false);
    }
    expect(root.querySelector("a, [href]")).toBeNull();
    // The buttons are the only non-hidden content; the fibre holds the core, thread, flow, head and one tick per section.
    expect(ticks()).toHaveLength(7);
    expect(fibre().children).toHaveLength(4 + 7);
  });

  it("labels the markers from the catalog (nav.*) and RAIL_COPY, in page order", () => {
    mountHomeFixture();
    renderRail();
    const ro = messages.ro;
    expect(markers().map((b) => b.textContent)).toEqual([
      "Început",
      ro["nav.services"],
      ro["nav.work"],
      ro["nav.about"],
      ro["nav.team"],
      "Cerere",
      "Contact",
    ]);
    // Each button's name is its label, and the tick inside it is hidden.
    expect(screen.getByRole("button", { name: ro["nav.work"] })).toBeInTheDocument();
    for (const button of markers()) {
      expect(button.querySelector("[aria-hidden='true']")).not.toBeNull();
    }
  });

  it("follows the language", () => {
    mountHomeFixture();
    renderRail("en");
    const nav = screen.getByRole("navigation", { name: "Page sections" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Start",
      messages.en["nav.services"],
      messages.en["nav.work"],
      messages.en["nav.about"],
      messages.en["nav.team"],
      "Request",
      "Contact",
    ]);
  });

  it("places ticks and markers at the laid-out positions, the same for both", () => {
    mountHomeFixture();
    renderRail();
    expect(ticks().map(yOf)).toEqual(HOME_Y.map((y) => `${y}px`));
    expect(markers().map((b) => yOf(b.closest("li")!))).toEqual(HOME_Y.map((y) => `${y}px`));
  });

  it("falls back to the page's headings when one curated id is missing", () => {
    const els = mountHomeFixture();
    els.echipa.remove();
    renderRail();
    expect(markers().map((b) => b.textContent)).toEqual([
      "Heading top",
      "Heading servicii",
      "Heading lucrari",
      "Heading despre",
      "Heading estimare",
      "Heading contact",
    ]);
  });

  it("draws no nav and no ticks while the fibre has no height (not laid out)", () => {
    mountHomeFixture();
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(0);
    renderRail();
    expect(railRoot()).not.toBeNull();
    expect(railNav()).toBeNull();
    expect(ticks()).toHaveLength(0);
  });
});

describe("other pages", () => {
  it("names one marker per section by its first heading, skipping chrome, hidden and multi-h2 sections", () => {
    h.pathname = "/servicii/e-commerce";
    mountServiceFixture();
    renderRail();
    expect(markers().map((b) => b.textContent)).toEqual(["Magazin online", "Cazuri reale", "Cum lucrăm", "Hai să vorbim"]);
  });

  it("clips a long heading to 60 characters", () => {
    const main = document.createElement("main");
    main.innerHTML = `<section><h2>${"Politica ".repeat(12)}</h2></section>`;
    document.body.append(main);
    renderRail();
    const [label] = markers().map((b) => b.textContent!);
    expect(Array.from(label)).toHaveLength(60);
    expect(label.endsWith("…")).toBe(true);
  });

  it("looks only inside <main> when the page has one", () => {
    const outside = document.createElement("div");
    outside.innerHTML = `<section><h2>Outside main</h2></section>`;
    const main = document.createElement("main");
    main.innerHTML = `<section><h2>Inside</h2></section>`;
    document.body.append(outside, main);
    renderRail();
    expect(markers().map((b) => b.textContent)).toEqual(["Inside"]);
  });

  it("draws the fibre only, with no nav, past 8 markers", () => {
    const main = document.createElement("main");
    main.innerHTML = Array.from({ length: 9 }, (_, i) => `<section><h2>Part ${i + 1}</h2></section>`).join("");
    document.body.append(main);
    main.querySelectorAll("section").forEach((s, i) => place(s, i * 500));
    renderRail();
    expect(railNav()).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(fibre()).not.toBeNull();
    expect(ticks()).toHaveLength(9);
  });

  it("keeps the nav at exactly 8 markers", () => {
    const main = document.createElement("main");
    main.innerHTML = Array.from({ length: 8 }, (_, i) => `<section><h2>Part ${i + 1}</h2></section>`).join("");
    document.body.append(main);
    renderRail();
    expect(markers()).toHaveLength(8);
  });

  it("draws the fibre with no ticks and no nav on a page with no sections", () => {
    document.body.append(document.createElement("main"));
    renderRail();
    expect(railNav()).toBeNull();
    expect(ticks()).toHaveLength(0);
    expect(fibre()).not.toBeNull();
  });

  it("re-reads the headings when the language changes", () => {
    /** A heading that follows the language, and a switch — as the header's own buttons do. */
    function Page() {
      const { locale, setLocale } = useLanguage();
      return (
        <main>
          <section>
            <h2>{locale === "en" ? "How we work" : "Cum lucrăm"}</h2>
          </section>
          <button type="button" onClick={() => setLocale("en")}>
            EN
          </button>
        </main>
      );
    }
    render(
      <LanguageProvider initialLocale="ro">
        <Page />
        <ScrollRail />
      </LanguageProvider>,
    );
    flushFrames();
    expect(screen.getByRole("navigation", { name: RAIL_COPY.nav.ro }).querySelector("button")?.textContent).toBe(
      "Cum lucrăm",
    );

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    flushFrames();
    const nav = screen.getByRole("navigation", { name: RAIL_COPY.nav.en });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["How we work"]);
  });

  it("re-discovers on a client navigation", () => {
    const main = document.createElement("main");
    main.innerHTML = `<section><h2>First page</h2></section>`;
    document.body.append(main);
    const view = renderRail();
    expect(markers().map((b) => b.textContent)).toEqual(["First page"]);

    main.innerHTML = `<section><h2>Second page</h2></section><section><h2>More</h2></section>`;
    h.pathname = "/servicii/produs-digital";
    view.rerender(
      <LanguageProvider initialLocale="ro">
        <ScrollRail />
      </LanguageProvider>,
    );
    flushFrames();
    expect(markers().map((b) => b.textContent)).toEqual(["Second page", "More"]);
  });
});

/* ---- 3. the jump ---------------------------------------------------------------------------------- */

describe("jumping to a section", () => {
  it("a click scrolls the section to just under the header, smoothly, and leaves focus alone", () => {
    const els = mountHomeFixture();
    renderRail();
    setScroll(300);
    const button = screen.getByRole("button", { name: messages.ro["nav.work"] });
    button.focus();
    fireEvent.click(button, { detail: 1 });

    expect(scrollToSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: HOME_TOPS.lucrari - HEADER_H, behavior: "smooth" });
    expect(document.activeElement).toBe(button);
    expect(els.lucrari.hasAttribute("tabindex")).toBe(false);
  });

  it("is instant under reduced motion", () => {
    mountHomeFixture();
    reducedMotion = true;
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Cerere" }), { detail: 1 });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: HOME_TOPS.estimare - HEADER_H, behavior: "instant" });
  });

  it("clamps the target inside the page: the hero to 0, the last section to the end", () => {
    mountHomeFixture();
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Început" }), { detail: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Contact" }), { detail: 1 });
    expect(scrollToSpy.mock.calls.map(([options]) => options.top)).toEqual([0, 5000]);
  });

  it("measures the section at the moment of the jump", () => {
    const els = mountHomeFixture();
    renderRail();
    place(els.despre, 3000);
    fireEvent.click(screen.getByRole("button", { name: messages.ro["nav.about"] }), { detail: 1 });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 3000 - HEADER_H, behavior: "smooth" });
  });

  it("a keyboard activation (detail 0) focuses the section, and the tabindex it added goes on blur", () => {
    const els = mountHomeFixture();
    renderRail();
    const button = screen.getByRole("button", { name: messages.ro["nav.team"] });
    button.focus();
    fireEvent.click(button, { detail: 0 });

    expect(scrollToSpy).toHaveBeenCalledWith({ top: HOME_TOPS.echipa - HEADER_H, behavior: "smooth" });
    expect(els.echipa.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(els.echipa);

    act(() => button.focus());
    expect(els.echipa.hasAttribute("tabindex")).toBe(false);
  });

  it("leaves a section's own tabindex in place", () => {
    const els = mountHomeFixture();
    els.contact.setAttribute("tabindex", "0");
    renderRail();
    fireEvent.click(screen.getByRole("button", { name: "Contact" }), { detail: 0 });
    expect(document.activeElement).toBe(els.contact);
    act(() => els.contact.blur());
    expect(els.contact.getAttribute("tabindex")).toBe("0");
  });

  it("writes nothing on <html> or <body>", () => {
    mountHomeFixture();
    renderRail();
    for (const button of markers()) {
      fireEvent.click(button, { detail: 0 });
      fireEvent.click(button, { detail: 1 });
    }
    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(document.body.getAttribute("style")).toBeNull();
  });
});

/* ---- 4. the frame ---------------------------------------------------------------------------------- */

describe("per scroll frame", () => {
  it("writes --rail-p on the rail root only, once per frame, and never a style on <html> or <body>", () => {
    mountHomeFixture();
    renderRail();
    expect(railP()).toBe("0.0000");

    setScroll(1250);
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("scroll"));
    });
    expect(frames.size).toBe(1);
    expect(railP()).toBe("0.0000");
    flushFrames();
    expect(railP()).toBe("0.2500");

    scrollTo(5000);
    expect(railP()).toBe("1.0000");
    scrollTo(-20);
    expect(railP()).toBe("0.0000");

    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(document.body.getAttribute("style")).toBeNull();
  });

  it("moves aria-current and the passed ticks with the scroll", () => {
    mountHomeFixture();
    renderRail();
    const current = () => markers().findIndex((b) => b.getAttribute("aria-current") === "true");
    const passed = () => ticks().filter((t) => t.hasAttribute("data-passed")).length;

    expect(current()).toBe(0);
    expect(markers().filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
    expect(passed()).toBe(1);

    scrollTo(1799.5);
    expect(current()).toBe(2);
    expect(passed()).toBe(3);

    scrollTo(5000);
    expect(current()).toBe(6);
    expect(passed()).toBe(7);

    scrollTo(950);
    expect(current()).toBe(1);
    expect(passed()).toBe(2);
    expect(markers().filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("pulses each tick a downward scroll passes, restarting by swapping a ↔ b, and none going up", () => {
    mountHomeFixture();
    renderRail();
    const pulses = () => ticks().map((t) => t.getAttribute("data-pulse"));

    scrollTo(1000);
    expect(pulses()).toEqual([null, "a", null, null, null, null, null]);

    scrollTo(3600);
    expect(pulses()).toEqual([null, "a", "a", "a", "a", null, null]);

    scrollTo(100);
    expect(pulses()).toEqual([null, "a", "a", "a", "a", null, null]);

    scrollTo(2000);
    expect(pulses()).toEqual([null, "b", "b", "a", "a", null, null]);
  });

  it("pulses nothing under reduced motion, and still tracks the current marker", () => {
    mountHomeFixture();
    reducedMotion = true;
    renderRail();
    scrollTo(5000);
    expect(ticks().filter((t) => t.hasAttribute("data-pulse"))).toHaveLength(0);
    expect(markers()[6].getAttribute("aria-current")).toBe("true");
    expect(railP()).toBe("1.0000");
  });

  it("sets data-flowing while scrolling and drops it 180ms after the last scroll", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mountHomeFixture();
    renderRail();
    expect(RAIL_FLOW_MS).toBe(180);
    expect(railRoot().hasAttribute("data-flowing")).toBe(false);

    scrollTo(400);
    expect(railRoot().hasAttribute("data-flowing")).toBe(true);
    act(() => void vi.advanceTimersByTime(150));
    scrollTo(600);
    act(() => void vi.advanceTimersByTime(150));
    expect(railRoot().hasAttribute("data-flowing")).toBe(true);
    act(() => void vi.advanceTimersByTime(30));
    expect(railRoot().hasAttribute("data-flowing")).toBe(false);
  });

  it("writes nothing while the page is covered, and catches up when the cover lifts", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mountHomeFixture();
    renderRail();
    scrollTo(1250);
    expect(railP()).toBe("0.2500");
    act(() => void vi.advanceTimersByTime(RAIL_FLOW_MS));

    const release = coverPage();
    try {
      // The dialog pins the body: the window reports 0.
      scrollTo(0);
      expect(railP()).toBe("0.2500");
      expect(markers()[1].getAttribute("aria-current")).toBe("true");
      expect(railRoot().hasAttribute("data-flowing")).toBe(false);
      expect(ticks().filter((t) => t.hasAttribute("data-pulse"))).toHaveLength(1);
    } finally {
      setScroll(2500);
      act(() => release());
    }
    flushFrames();
    expect(railP()).toBe("0.5000");
    expect(markers()[2].getAttribute("aria-current")).toBe("true");
  });

  it("writes nothing while ScrollTrigger measures (html[data-scroll-measure])", () => {
    mountHomeFixture();
    renderRail();
    document.documentElement.setAttribute(RAIL_MEASURE_ATTR, "");
    scrollTo(2500);
    expect(railP()).toBe("0.0000");
    expect(railRoot().hasAttribute("data-flowing")).toBe(false);
    document.documentElement.removeAttribute(RAIL_MEASURE_ATTR);
    scrollTo(2500);
    expect(railP()).toBe("0.5000");
  });

  it("uses the scene's own names for the layout event and the measuring attribute", () => {
    expect(RAIL_LAYOUT_EVENT).toBe(SCENE_LAYOUT_EVENT);
    expect(RAIL_MEASURE_ATTR).toBe(INSTANT_SCROLL_ATTR);
  });
});

/* ---- 5. re-measuring --------------------------------------------------------------------------------- */

describe("re-measuring", () => {
  /** The home fixture with Work grown by 1000px (the spiral): later sections move down. */
  function growWork(els: Record<string, HTMLElement>) {
    for (const id of ["despre", "echipa", "estimare", "contact"] as const) place(els[id], HOME_TOPS[id] + 1000);
    scrollHeight += 1000;
  }
  const GROWN_Y = ["0px", "84px", "168px", "345px", "420px", "485px", "560px"];

  it("re-measures once per frame on the scene's layout event, dispatched on the stage root", () => {
    const els = mountHomeFixture();
    const stage = document.createElement("div");
    stage.setAttribute("data-scene-stage", "");
    els.top.before(stage);
    stage.append(els.top, els.servicii, els.lucrari);
    renderRail();
    expect(ticks().map(yOf)).toEqual(HOME_Y.map((y) => `${y}px`));

    growWork(els);
    act(() => {
      stage.dispatchEvent(new Event(SCENE_LAYOUT_EVENT));
      stage.dispatchEvent(new Event(SCENE_LAYOUT_EVENT));
    });
    expect(frames.size).toBe(1);
    flushFrames();
    expect(ticks().map(yOf)).toEqual(GROWN_Y);
    expect(markers().map((b) => yOf(b.closest("li")!))).toEqual(GROWN_Y);
  });

  it("re-measures when <html> resizes (ResizeObserver) and on window resize", () => {
    const els = mountHomeFixture();
    renderRail();
    const observer = resizeObservers.find((o) => o.live && o.targets.includes(document.documentElement));
    expect(observer).toBeDefined();

    growWork(els);
    act(() => observer!.cb([], observer as unknown as ResizeObserver));
    flushFrames();
    expect(ticks().map(yOf)).toEqual(GROWN_Y);

    scrollHeight -= 1000;
    for (const id of ["despre", "echipa", "estimare", "contact"] as const) place(els[id], HOME_TOPS[id]);
    act(() => void window.dispatchEvent(new Event("resize")));
    flushFrames();
    expect(ticks().map(yOf)).toEqual(HOME_Y.map((y) => `${y}px`));
  });

  it("does not measure under a cover, and measures when it lifts", () => {
    const els = mountHomeFixture();
    renderRail();
    const release = coverPage();
    try {
      growWork(els);
      act(() => void window.dispatchEvent(new Event("resize")));
      flushFrames();
      expect(ticks().map(yOf)).toEqual(HOME_Y.map((y) => `${y}px`));
    } finally {
      act(() => release());
    }
    flushFrames();
    expect(ticks().map(yOf)).toEqual(GROWN_Y);
  });

  it("uses the new targets for the current marker after a re-measure", () => {
    const els = mountHomeFixture();
    renderRail();
    scrollTo(2750);
    expect(markers()[3].getAttribute("aria-current")).toBe("true");
    growWork(els);
    act(() => void window.dispatchEvent(new Event("resize")));
    flushFrames();
    expect(markers()[2].getAttribute("aria-current")).toBe("true");
  });
});

/* ---- 6. listeners ------------------------------------------------------------------------------------- */

describe("listeners", () => {
  it("adds only a passive scroll and a passive resize on window (plus the cover signal), never wheel, touch or pointer", () => {
    const onWindow = vi.spyOn(window, "addEventListener");
    const onDocument = vi.spyOn(document, "addEventListener");
    mountHomeFixture();
    renderRail();

    const windowTypes = onWindow.mock.calls.map(([type]) => type);
    expect(windowTypes.filter((t) => t === "scroll")).toHaveLength(1);
    expect(windowTypes.filter((t) => t === "resize")).toHaveLength(1);
    for (const [type, , options] of onWindow.mock.calls) {
      expect(["scroll", "resize", "tbs:page-cover"], type).toContain(type);
      if (type === "scroll" || type === "resize") expect(options, type).toMatchObject({ passive: true });
    }
    const all = [...windowTypes, ...onDocument.mock.calls.map(([type]) => type)];
    expect(all.filter((t) => /wheel|touch|pointer|mouse|key/i.test(t))).toEqual([]);
  });

  it("removes every listener and observer on unmount", () => {
    const onWindow = vi.spyOn(window, "addEventListener");
    const offWindow = vi.spyOn(window, "removeEventListener");
    const onDocument = vi.spyOn(document, "addEventListener");
    const offDocument = vi.spyOn(document, "removeEventListener");
    mountHomeFixture();
    const view = renderRail();
    view.unmount();

    const added = onWindow.mock.calls.map(([type, fn]) => [type, fn]);
    for (const [type, fn] of added) {
      expect(offWindow.mock.calls.some(([t, f]) => t === type && f === fn), String(type)).toBe(true);
    }
    const layout = onDocument.mock.calls.find(([type]) => type === RAIL_LAYOUT_EVENT);
    expect(layout).toBeDefined();
    expect(offDocument.mock.calls.some(([t, f]) => t === RAIL_LAYOUT_EVENT && f === layout![1])).toBe(true);
    expect(resizeObservers.every((o) => !o.live)).toBe(true);
    expect(frames.size).toBe(0);

    // Scrolling after unmount does nothing and throws nothing.
    scrollTo(900);
    expect(frames.size).toBe(0);
  });
});

/* ---- 7. the CSS Module contract ----------------------------------------------------------------------- */

describe("ScrollRail.module.css", () => {
  const css = read("components/hud/rail/ScrollRail.module.css").replace(/\/\*[\s\S]*?\*\//g, "");
  /** The declarations of the first top-level rule for exactly `selector`. */
  const rule = (selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
    return m?.[1] ?? "";
  };

  /** The css with every `@media (prefers-reduced-motion: no-preference) { … }` block removed. */
  function outsideNoPreference(src: string): string {
    let out = "";
    let i = 0;
    const marker = /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{/g;
    for (let m = marker.exec(src); m; m = marker.exec(src)) {
      out += src.slice(i, m.index);
      let depth = 1;
      let j = m.index + m[0].length;
      while (depth > 0 && j < src.length) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      i = j;
      marker.lastIndex = j;
    }
    return out + src.slice(i);
  }

  it("the root is fixed on the right edge at --z-rail, under the header down to --hud-bottom, taking no pointer events", () => {
    const root = rule(".root");
    expect(root).toMatch(/position:\s*fixed/);
    expect(root).toMatch(/right:\s*0/);
    expect(root).toMatch(/top:\s*calc\(var\(--header-h\) \+ 16px\)/);
    expect(root).toMatch(/bottom:\s*var\(--hud-bottom\)/);
    expect(root).toMatch(/width:\s*var\(--hud-rail-w\)/);
    expect(root).toMatch(/z-index:\s*var\(--z-rail\)/);
    expect(root).toMatch(/pointer-events:\s*none/);
    expect(css).toMatch(/@media \(max-width: 860px\)\s*\{\s*\.root\s*\{\s*display:\s*none;/);
  });

  it("a marker is a 44×44 hit area that takes pointer events", () => {
    const marker = rule(".marker");
    expect(marker).toMatch(/(?:^|[;\s])width:\s*44px/);
    expect(marker).toMatch(/min-width:\s*44px/);
    expect(marker).toMatch(/(?:^|[;\s])height:\s*44px/);
    expect(marker).toMatch(/pointer-events:\s*auto/);
    expect(rule(".markerLabel")).toMatch(/pointer-events:\s*none/);
  });

  it("ticks are diamonds: rotated squares with no radius", () => {
    const tick = rule(".tick");
    expect(tick).toMatch(/rotate:\s*45deg/);
    expect(tick).toMatch(/border-radius:\s*0/);
    const width = tick.match(/(?:^|[;\s])width:\s*(\d+)px/)?.[1];
    expect(width).toBe(tick.match(/(?:^|[;\s])height:\s*(\d+)px/)?.[1]);
    expect(css).not.toMatch(/border-radius:\s*(?:50%|var\(--r-pill\))/);
  });

  it("uses no blur, no filter and no literal z-index", () => {
    expect(css).not.toMatch(/backdrop-filter|(?:^|[;\s{])filter\s*:/);
    for (const m of css.matchAll(/z-index:\s*([^;]+)/g)) expect(m[1].trim()).toMatch(/^var\(--z-/);
  });

  it("animates and transitions only under prefers-reduced-motion: no-preference, and loops only while flowing", () => {
    const outside = outsideNoPreference(css).replace(/@keyframes[\s\S]*?\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside).not.toMatch(/(?:^|[;\s{])(animation|transition)(-[a-z-]+)?\s*:/);
    const infinite = [...css.matchAll(/([^{}]+)\{[^{}]*animation:[^;]*infinite/g)].map((m) => m[1].trim());
    expect(infinite).toEqual([".root[data-flowing] .flow::before"]);
  });
});
