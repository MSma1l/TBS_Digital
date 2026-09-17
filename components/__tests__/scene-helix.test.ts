import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { createElement, type FunctionComponent, type ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { Work } from "@/components/sections/Work";
import {
  HELIX_FRONT_ATTR,
  HELIX_LAYOUT,
  WORK_HELIX_MEDIA,
  createCardPose,
  focusFromProgress,
  helixCardHeight,
  helixCardWidth,
  helixEdge,
  helixLayout,
  helixStep,
  nearestCard,
  scrollForCard,
  wantedHelixMode,
  type CardPose,
} from "@/components/scene/helix";
import { HELIX_ANGLE } from "@/components/scene/shapes";
import { createWorkHelixDriver, type WorkHelixDriver, type WorkHelixMode } from "@/components/scene/workHelix";
import { LanguageProvider, useLanguage } from "@/lib/i18n/LanguageProvider";
import { SiteContentProvider } from "@/lib/siteContent";
import { createScrollProbe, scrollProgress, type ScrollProbe } from "@/lib/scene";

/*
 * The Work spiral: the pure layout (helix.ts) as tables and clamps, then the DOM driver
 * (workHelix.ts) in jsdom — a fake IntersectionObserver says where Work is, a fake media list
 * says whether the screen is wide enough, and every box the driver measures is a small model of
 * the page (the grid, or the tall sticky track once the driver has laid it out).
 */

const WIDTHS = [768, 861, 1024, 1280, 1920] as const;
const SCENE_HEIGHTS = [529, 697, 729, 953] as const;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

function poses(n: number, focus: number, w: number, sceneH: number): CardPose[] {
  return Array.from({ length: n }, (_, i) => helixLayout(i, focus, w, sceneH, createCardPose()));
}

describe("helix layout — constants and clamps", () => {
  it("spirals from a portrait tablet up, and turns by the helix model's own angle", () => {
    expect(WORK_HELIX_MEDIA).toBe("(min-width: 768px) and (min-height: 600px)");
    expect(HELIX_LAYOUT.angle).toBe(HELIX_ANGLE);
    expect(HELIX_ANGLE).toBeCloseTo((2 * Math.PI) / 9, 12);
  });

  it("card width clamp(240, .27·w, 340); height min(.36·sceneH, 260); step clamp(240, .38·vh, 380)", () => {
    expect([700, 888, 1000, 1260, 1280, 1920].map(helixCardWidth)).toEqual([240, 240, 270, 340, 340, 340]);
    expect(helixCardWidth(1100)).toBeCloseTo(297, 9);
    expect([529, 697, 729, 953].map((h) => r2(helixCardHeight(h)))).toEqual([190.44, 250.92, 260, 260]);
    expect([500, 631, 800, 1000, 1200].map((h) => r2(helixStep(h)))).toEqual([240, 240, 304, 380, 380]);
  });

  it("keeps 16px from the zone's edges, 60px from 861px up (the rail's markers)", () => {
    expect([768, 860, 861, 1280].map(helixEdge)).toEqual([16, 16, 60, 60]);
  });
});

describe("helixLayout — the spiral", () => {
  it("pins a table: w 1280 × 729 and a tablet's 706 × 953, focus 1", () => {
    const row = (p: CardPose) => [r2(p.x), r2(p.y), r2(p.scale), r2(p.opacity), r2(p.z), p.zIndex, p.face];
    expect(poses(5, 1, 1280, 729).map(row)).toEqual([
      [-344.67, -131.22, 0.94, 0.95, 0.77, 9, "front"],
      [-204.8, 0, 1.12, 1, 1, 11, "front"],
      [-64.93, 131.22, 0.94, 0.95, 0.77, 9, "front"],
      [9.49, 262.44, 0.79, 0.53, 0.17, 3, "front"],
      [-16.35, 393.66, 0.67, 0, -0.5, -5, "back"],
    ]);
    expect(poses(5, 1, 706, 953).map(row)).toEqual([
      [-190.11, -171.54, 0.94, 0.95, 0.77, 9, "front"],
      [-112.96, 0, 1.12, 1, 1, 11, "front"],
      [-35.81, 171.54, 0.94, 0.95, 0.77, 9, "front"],
      [5.24, 343.08, 0.79, 0.53, 0.17, 3, "front"],
      [-9.02, 514.62, 0.67, 0, -0.5, -5, "back"],
    ]);
  });

  it("the focus card is the largest and on top, at every width and focus", () => {
    for (const w of WIDTHS) {
      for (let focus = 0; focus <= 8; focus += 0.25) {
        const all = poses(9, focus, w, 729);
        const top = Math.round(focus);
        for (const [i, p] of all.entries()) {
          expect(p.scale, `w ${w} focus ${focus} card ${i}`).toBeLessThanOrEqual(all[top].scale + 1e-12);
          expect(p.zIndex, `w ${w} focus ${focus} card ${i}`).toBeLessThanOrEqual(all[top].zIndex);
        }
      }
      const exact = poses(9, 4, w, 729);
      expect(exact[4]).toMatchObject({ scale: 1.12, opacity: 1, z: 1, zIndex: 11, face: "front" });
      expect(exact.filter((p) => p.zIndex === 11)).toHaveLength(1);
    }
  });

  it("z < 0 ⇔ zIndex < 0 ⇔ back, all round the strand", () => {
    const p = createCardPose();
    for (let d = -4.5; d <= 4.5; d += 0.01) {
      helixLayout(0, -d, 1280, 729, p);
      expect(p.z < 0, `d ${d}`).toBe(p.zIndex < 0);
      expect(p.z < 0, `d ${d}`).toBe(p.face === "back");
      expect(p.zIndex).not.toBe(0);
      expect(p.zIndex).toBeGreaterThanOrEqual(-9);
      expect(p.zIndex).toBeLessThanOrEqual(11);
    }
  });

  it("every card stays inside [edge, w − edge] at 768, 861, 1024, 1280 and 1920", () => {
    for (const w of WIDTHS) {
      const edge = helixEdge(w);
      const cardW = helixCardWidth(w);
      for (let focus = 0; focus <= 8; focus += 0.05) {
        for (const [i, p] of poses(9, focus, w, 729).entries()) {
          const left = w / 2 + p.x - (cardW * p.scale) / 2;
          const right = w / 2 + p.x + (cardW * p.scale) / 2;
          expect(left, `w ${w} focus ${focus} card ${i}`).toBeGreaterThanOrEqual(edge - 1e-9);
          expect(right, `w ${w} focus ${focus} card ${i}`).toBeLessThanOrEqual(w - edge + 1e-9);
        }
      }
    }
  });

  it("a visible card never leaves ±(sceneH/2 + cardH/2); a card 2.6 steps away is gone", () => {
    for (const sceneH of SCENE_HEIGHTS) {
      const bound = sceneH / 2 + helixCardHeight(sceneH) / 2;
      for (let focus = 0; focus <= 8; focus += 0.05) {
        for (const [i, p] of poses(9, focus, 1280, sceneH).entries()) {
          if (p.opacity > 0.05) expect(Math.abs(p.y), `h ${sceneH} focus ${focus} card ${i}`).toBeLessThanOrEqual(bound);
          if (Math.abs(i - focus) >= 2.6) expect(p.opacity).toBe(0);
        }
      }
    }
  });

  it("writes into `out` and returns it", () => {
    const out = createCardPose();
    expect(helixLayout(3, 1, 1280, 729, out)).toBe(out);
  });
});

describe("scroll ↔ focus", () => {
  const span = { start: 2929, end: 5361 };

  it("scrollForCard and focusFromProgress round-trip, clamped at both ends", () => {
    for (const n of [3, 5, 9]) {
      for (let i = 0; i < n; i += 1) {
        const y = scrollForCard(i, n, span);
        expect(focusFromProgress(scrollProgress(y, span), n)).toBeCloseTo(i, 9);
      }
      for (const p of [0, 0.125, 0.5, 0.9]) {
        const y = scrollForCard(focusFromProgress(p, n), n, span);
        expect(scrollProgress(y, span)).toBeCloseTo(p, 9);
      }
      expect(focusFromProgress(-1, n)).toBe(0);
      expect(focusFromProgress(2, n)).toBe(n - 1);
    }
    expect(scrollForCard(4, 9, span)).toBe(2929 + 4 * 304);
  });

  it("one or two cards give no spiral", () => {
    expect(wantedHelixMode(true, 1, true)).toBe("ambient");
    expect(wantedHelixMode(true, 2, true)).toBe("ambient");
    expect(wantedHelixMode(true, 3, true)).toBe("spiral");
    expect(wantedHelixMode(true, 9, false)).toBe("ambient");
    expect(wantedHelixMode(false, 9, true)).toBe("off");
    expect(focusFromProgress(0.7, 1)).toBe(0);
    expect(focusFromProgress(0.7, 0)).toBe(0);
    expect(scrollForCard(0, 1, span)).toBe(span.start);
  });
});

describe("nearestCard", () => {
  const band = (scrollLeft: number) =>
    Array.from({ length: 9 }, (_, i) => ({ left: 16 + i * 332 - scrollLeft, top: 400, width: 320, height: 244 }));

  it("follows the band's scroll, first wins a tie, −1 for none", () => {
    expect(nearestCard(band(0), 195)).toBe(0);
    expect(nearestCard(band(332), 195)).toBe(1);
    expect(nearestCard(band(840), 195)).toBe(3);
    expect(nearestCard(band(99999), 195)).toBe(8);
    expect(nearestCard([{ left: 0, top: 0, width: 10, height: 10 }, { left: 20, top: 0, width: 10, height: 10 }], 15)).toBe(0);
    expect(nearestCard([], 100)).toBe(-1);
  });

  it("uses the vertical distance too when given one (a grid)", () => {
    const grid = [0, 1, 2, 3].map((i) => ({ left: i % 2 === 0 ? 0 : 400, top: Math.floor(i / 2) * 300 - 200, width: 380, height: 280 }));
    expect(nearestCard(grid, 190)).toBe(0);
    expect(nearestCard(grid, 190, 240)).toBe(2);
  });
});

/* ---- the driver ------------------------------------------------------------------------ */

const HEADER = 71;
const VH = 800;
const LAYER = VH - HEADER;
const TRACK_TOP = 3000;
const SECTION_TOP = 2800;
const TRACK_LEFT = 40;
const TRACK_W = 1200;
const GRID = { cardH: 244, gap: 14, cols: 3 };
const STEP = helixStep(VH);

class FakeIO {
  static all: FakeIO[] = [];
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  targets: Element[] = [];
  constructor(readonly cb: IntersectionObserverCallback) {
    FakeIO.all.push(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.targets = [];
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** Tell every observer of `el` where it is. */
function report(el: Element, where: "below" | "on" | "above") {
  const top = where === "below" ? VH + 100 : where === "on" ? 100 : -5000;
  for (const io of FakeIO.all) {
    if (!io.targets.includes(el)) continue;
    const entry = { target: el, isIntersecting: where === "on", boundingClientRect: { top } };
    io.cb([entry as unknown as IntersectionObserverEntry], io as unknown as IntersectionObserver);
  }
}

function fakeMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    media: WORK_HELIX_MEDIA,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  return {
    matchMedia: vi.fn(() => list as unknown as MediaQueryList),
    set(matches: boolean) {
      list.matches = matches;
      for (const l of [...listeners]) l();
    },
    listeners,
  };
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: y });
}

/** Boxes for a section, its track and its cards: the grid as rendered, or the driver's spiral. */
function modelBoxes(section: HTMLElement, track: HTMLElement, band?: { scrollLeft: number }) {
  const spiral = () => track.style.getPropertyValue("grid-template-rows") !== "";
  const cards = () => Array.from(track.children) as HTMLElement[];
  const gridHeight = () => {
    const rows = Math.ceil(cards().length / GRID.cols);
    return rows * GRID.cardH + Math.max(0, rows - 1) * GRID.gap;
  };
  const trackHeight = () => (spiral() ? Number.parseFloat(track.style.getPropertyValue("grid-template-rows")) : gridHeight());
  section.getBoundingClientRect = () => rect(0, SECTION_TOP - window.scrollY, 1280, TRACK_TOP - SECTION_TOP + trackHeight());
  track.getBoundingClientRect = () => rect(TRACK_LEFT, TRACK_TOP - window.scrollY, TRACK_W, trackHeight());
  for (const card of cards()) {
    card.getBoundingClientRect = () => {
      const at = cards().indexOf(card);
      if (band) return rect(16 + at * 332 - band.scrollLeft, TRACK_TOP - window.scrollY, 320, GRID.cardH);
      const row = Math.floor(at / GRID.cols);
      return rect(TRACK_LEFT + (at % GRID.cols) * 400, TRACK_TOP + row * (GRID.cardH + GRID.gap) - window.scrollY, 386, GRID.cardH);
    };
  }
}

const STYLES = [
  "--p1:#192f6f;--p2:#4b7dff",
  "--p1: #173b3d; --p2: #10a99b;",
  null,
  "--p1:#53397d;--p2:#9671dd;",
  "--p1:#734328; --p2:#e38a4f",
];

function fixture(n: number) {
  document.body.innerHTML = "";
  const section = document.createElement("section");
  section.id = "lucrari";
  const track = document.createElement("div");
  track.className = "mt-7 grid grid-cols-3";
  for (let i = 0; i < n; i += 1) {
    const card = document.createElement("a");
    card.href = `https://example.com/${i}`;
    card.textContent = `Project ${i}`;
    const style = STYLES[i % STYLES.length];
    if (style !== null) card.setAttribute("style", style);
    track.append(card);
  }
  section.append(track);
  document.body.append(section);
  modelBoxes(section, track);
  return { section, track, cards: Array.from(track.children) as HTMLElement[] };
}

function probeFor(over: Partial<ScrollProbe> = {}): ScrollProbe {
  return { ...createScrollProbe(), live: true, version: 1, headerH: HEADER, layerH: LAYER, ...over };
}

type Setup = {
  section: HTMLElement;
  track: HTMLElement;
  cards: HTMLElement[];
  probe: ScrollProbe;
  media: ReturnType<typeof fakeMedia>;
  modes: WorkHelixMode[];
  driver: WorkHelixDriver;
};

function setup(n = 9, { wide = true, onMode }: { wide?: boolean; onMode?: (m: WorkHelixMode) => void } = {}): Setup {
  const { section, track, cards } = fixture(n);
  const probe = probeFor();
  const media = fakeMedia(wide);
  const modes: WorkHelixMode[] = [];
  const driver = createWorkHelixDriver({
    track,
    section,
    probe,
    matchMedia: media.matchMedia,
    onMode: (m) => {
      modes.push(m);
      onMode?.(m);
    },
  });
  return { section, track, cards, probe, media, modes, driver };
}

/** A driver already in the spiral, entered from the top of the page. */
function spiral(n = 9) {
  const s = setup(n);
  setScroll(0);
  report(s.section, "below");
  s.driver.write({ focus: 0, built: true });
  expect(s.driver.mode()).toBe("spiral");
  return s;
}

const styleOf = (els: readonly HTMLElement[]) => els.map((el) => el.getAttribute("style"));

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal("IntersectionObserver", FakeIO);
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: VH });
  setScroll(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  setScroll(0);
});

describe("workHelix — when the spiral applies", () => {
  it("only once the helix is built, three cards are there, the screen is wide and Work is below", () => {
    const { section, track, cards, driver, modes } = setup(9);
    const before = styleOf(cards);

    setScroll(SECTION_TOP - 300); // a deep link into Work, before the observer has reported
    driver.write({ focus: 0, built: true });
    report(section, "on");
    driver.write({ focus: 0, built: true }); // inside Work: a deep link keeps the grid
    setScroll(SECTION_TOP + 6000);
    report(section, "above");
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("off");
    expect(styleOf(cards)).toEqual(before);
    expect(track.hasAttribute("style")).toBe(false);

    setScroll(0);
    report(section, "below");
    driver.write({ focus: 0, built: false });
    expect(driver.mode()).toBe("off");

    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    expect(modes).toEqual(["spiral"]);
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${LAYER + 8 * STEP}px`);
    expect(track.style.getPropertyValue("grid-template-columns")).toBe("100%");
    for (const card of cards) {
      expect(card.style.position).toBe("sticky");
      expect(card.style.getPropertyValue("grid-row-start")).toBe("1");
      expect(card.style.getPropertyValue("grid-column-end")).toBe("auto");
      expect(card.style.getPropertyValue("justify-self")).toBe("center");
      expect(card.style.getPropertyValue("transition-property")).toBe("translate, box-shadow, border-color");
      expect(card.style.width).toBe("324px");
      // A floor, never a height: a card grows to fit its content (see "a card is never capped below its content").
      expect(card.style.getPropertyValue("min-height")).toBe("260px");
      expect(card.style.height).toBe("");
      // jsdom has no layout (offsetHeight 0), so the box counts as the floor: centred in the layer under the header.
      expect(card.style.top).toBe(`${HEADER + (LAYER - 260) / 2}px`);
    }
    driver.dispose();
  });

  it("a deep link below Work, then one instant jump to the top: applies with no observer callback in between", () => {
    const { section, driver, modes } = setup(9);
    setScroll(SECTION_TOP + 6000); // e.g. #estimare, past Work
    report(section, "above"); // the observer's first and only report
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("off");
    setScroll(0); // the logo: straight across Work, so the observer never fires
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    expect(modes).toEqual(["spiral"]);
    driver.dispose();
  });

  it("jumps across Work and back, with no observer callback, never lay it out while Work is on screen", () => {
    const { section, track, cards, driver, modes } = setup(9);
    const before = styleOf(cards);
    const untouched = () => {
      expect(driver.mode()).toBe("off");
      expect(modes).toEqual([]);
      expect(styleOf(cards)).toEqual(before);
      expect(track.hasAttribute("style")).toBe(false);
    };
    setScroll(0);
    report(section, "below");
    driver.write({ focus: 0, built: false }); // not built yet: nothing to apply
    for (const y of [SECTION_TOP - 300, SECTION_TOP + 6000, SECTION_TOP + 100, SECTION_TOP - VH + 1]) {
      setScroll(y); // on screen, past it, on screen, its top one px into the viewport — no callback
      driver.write({ focus: 0, built: true });
      untouched();
    }
    // The observer saw Work on screen; an instant jump to the top before its next report: vetoed…
    report(section, "on");
    setScroll(0);
    driver.write({ focus: 0, built: true });
    untouched();
    // …until it reports Work gone.
    report(section, "below");
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    driver.dispose();
  });

  it("not before the director has measured", () => {
    const s = setup(9);
    s.probe.live = false;
    report(s.section, "below");
    s.driver.write({ focus: 0, built: true });
    expect(s.driver.mode()).toBe("off");
    s.probe.live = true;
    s.driver.write({ focus: 0, built: true });
    expect(s.driver.mode()).toBe("spiral");
    s.driver.dispose();
  });

  it("one or two cards, or a narrow screen, give ambient — at once, it moves no layout", () => {
    for (const [n, wide] of [
      [2, true],
      [1, true],
      [9, false],
    ] as const) {
      const { section, cards, track, driver, modes } = setup(n, { wide });
      const before = styleOf(cards);
      report(section, "on");
      driver.write({ focus: 0, built: true });
      expect(driver.mode()).toBe("ambient");
      expect(modes).toEqual(["ambient"]);
      expect(driver.focus(4000)).toBe(0);
      expect(styleOf(cards)).toEqual(before);
      expect(track.hasAttribute("style")).toBe(false);
      driver.dispose();
      expect(modes).toEqual(["ambient", "off"]);
    }
  });

  it("measures its own span: track top under the header → track bottom at the viewport's", () => {
    const { driver } = spiral(9);
    const span = { start: TRACK_TOP - HEADER, end: TRACK_TOP - HEADER + 8 * STEP };
    expect(driver.focus(span.start - 500)).toBe(0);
    expect(driver.focus(span.start)).toBe(0);
    expect(driver.focus(scrollForCard(4, 9, span))).toBeCloseTo(4, 9);
    expect(driver.focus(span.end + 900)).toBe(8);
    driver.dispose();
  });

  it("re-lays out and re-measures when the probe's version changes", () => {
    const { driver, probe, track } = spiral(9);
    probe.layerH = 529;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 600 });
    driver.write({ focus: 0, built: true });
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${LAYER + 8 * STEP}px`); // same version: kept
    probe.version += 1;
    driver.write({ focus: 0, built: true });
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${529 + 8 * 240}px`);
    expect(driver.focus(TRACK_TOP - HEADER + 4 * 240)).toBeCloseTo(4, 9);
    driver.dispose();
  });
});

describe("workHelix — the spiral per frame", () => {
  it("writes each card's pose; data-helix-front follows the focus", () => {
    const { driver, cards } = spiral(9);
    for (const focus of [0, 2.4, 2.6, 7.9]) {
      driver.write({ focus, built: true });
      const front = Math.round(focus);
      expect(driver.front()).toBe(front);
      expect(cards.filter((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toEqual([cards[front]]);
      for (const [i, card] of cards.entries()) {
        const p = helixLayout(i, focus, TRACK_W, LAYER, createCardPose());
        expect(card.style.transform).toBe(`translate3d(${r2(p.x)}px, ${r2(p.y)}px, 0) scale(${r4(p.scale)})`);
        expect(card.style.zIndex).toBe(String(p.zIndex));
        expect(Number(card.style.opacity)).toBeCloseTo(p.opacity, 3);
        expect(card.style.pointerEvents).toBe(p.face === "front" ? "auto" : "none");
      }
    }
    expect(cards.some((c) => Number(c.style.zIndex) < 0)).toBe(true);
    driver.dispose();
  });

  it("a card is never capped below its content: no height written, its measured box centred, a taller one under the header", () => {
    const { section, driver, cards } = setup(9);
    // Content taller than the floor (a long description), and one taller than the whole layer.
    Object.defineProperty(cards[0], "offsetHeight", { configurable: true, get: () => 380 });
    Object.defineProperty(cards[1], "offsetHeight", { configurable: true, get: () => LAYER + 150 });
    setScroll(0);
    report(section, "below");
    driver.write({ focus: 0.5, built: true });
    expect(driver.mode()).toBe("spiral");
    for (const card of cards) {
      expect(card.style.height).toBe("");
      expect(card.style.getPropertyValue("min-height")).toBe("260px");
    }
    expect(cards[0].style.top).toBe(`${HEADER + (LAYER - 380) / 2}px`);
    expect(cards[1].style.top).toBe(`${HEADER}px`);
    // The rest (no box in jsdom) keep the floor's centre.
    expect(cards[2].style.top).toBe(`${HEADER + (LAYER - 260) / 2}px`);
    driver.dispose();
  });

  it("a card whose content changes size is centred again on the next frame (ResizeObserver), with no refresh and no focus change", () => {
    const observers: FakeRO[] = [];
    class FakeRO {
      targets: Element[] = [];
      disconnected = false;
      constructor(readonly cb: ResizeObserverCallback) {
        observers.push(this);
      }
      observe(el: Element) {
        this.targets.push(el);
      }
      unobserve() {}
      disconnect() {
        this.disconnected = true;
        this.targets = [];
      }
    }
    vi.stubGlobal("ResizeObserver", FakeRO);
    const { driver, cards, track } = spiral(9);
    expect(observers).toHaveLength(1);
    expect(observers[0].targets).toEqual(cards);
    driver.write({ focus: 3, built: true });
    expect(cards[3].style.top).toBe(`${HEADER + (LAYER - 260) / 2}px`);
    // A locale switch lengthens card 3's description.
    Object.defineProperty(cards[3], "offsetHeight", { configurable: true, get: () => 420 });
    observers[0].cb([], observers[0] as unknown as ResizeObserver);
    driver.write({ focus: 3, built: true });
    expect(cards[3].style.top).toBe(`${HEADER + (LAYER - 420) / 2}px`);
    // Leaving the spiral stops observing, and puts the cards back as rendered.
    driver.dispose();
    expect(observers[0].disconnected).toBe(true);
    expect(track.hasAttribute("style")).toBe(false);
    expect(cards.map((el) => el.style.top)).toEqual(cards.map(() => ""));
  });

  it("skips a frame whose focus moved less than 1e-4", () => {
    const { driver, cards } = spiral(9);
    driver.write({ focus: 2.4, built: true });
    cards[2].style.transform = "none";
    driver.write({ focus: 2.40005, built: true });
    expect(cards[2].style.transform).toBe("none");
    driver.write({ focus: 2.41, built: true });
    expect(cards[2].style.transform).toMatch(/^translate3d\(/);
    driver.dispose();
  });

  it("a card holding focus is fully opaque", () => {
    const { driver, cards } = spiral(9);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    driver.write({ focus: 0, built: true });
    expect(cards[5].style.opacity).toBe("0");
    cards[5].focus();
    driver.write({ focus: 0, built: true });
    expect(cards[5].style.opacity).toBe("1");
    cards[5].blur();
    driver.write({ focus: 0, built: true });
    expect(cards[5].style.opacity).toBe("0");
    driver.dispose();
  });

  it("focusin scrolls to where that card is the focus (html's smooth scrolling decides how)", () => {
    const { driver, cards } = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    cards[6].focus();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: scrollForCard(6, 9, { start: TRACK_TOP - HEADER, end: TRACK_TOP - HEADER + 8 * STEP }) });
    // Nothing that hides a card from the keyboard or a screen reader.
    for (const card of cards) {
      expect(card.hasAttribute("inert")).toBe(false);
      expect(card.hasAttribute("aria-hidden")).toBe(false);
      expect(card.hasAttribute("tabindex")).toBe(false);
    }
    driver.dispose();
  });

  it("a focus a pointer press caused scrolls nothing; nor does one outside the spiral", () => {
    const s = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    fireEvent(s.cards[3], new MouseEvent("pointerdown", { bubbles: true }));
    s.cards[3].focus();
    expect(scrollTo).not.toHaveBeenCalled();
    s.driver.dispose();

    const off = setup(9);
    off.cards[2].focus();
    expect(scrollTo).not.toHaveBeenCalled();
    off.driver.dispose();
  });
});

describe("workHelix — restore", () => {
  it("puts every style attribute back byte for byte, and removes the front marker", () => {
    const { driver, cards, track, modes } = spiral(9);
    const expected = STYLES.concat(STYLES).slice(0, 9);
    for (const focus of [0, 1.5, 4.2]) driver.write({ focus, built: true });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    cards[4].focus();
    driver.write({ focus: 4.2, built: true });
    expect(cards[4].getAttribute("style")).not.toBe(expected[4]);

    driver.dispose();
    expect(styleOf(cards)).toEqual(expected);
    expect(cards[2].hasAttribute("style")).toBe(false);
    expect(track.hasAttribute("style")).toBe(false);
    expect(cards.filter((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toEqual([]);
    expect(modes).toEqual(["spiral", "off"]);
    expect(driver.mode()).toBe("off");
    driver.dispose();
    expect(modes).toEqual(["spiral", "off"]);
  });

  it("a property someone else set meanwhile (a tilt) stays; only the driver's go", () => {
    const { driver, cards } = spiral(9);
    driver.write({ focus: 1, built: true });
    cards[1].style.setProperty("--tilt-rx", "3deg");
    driver.dispose();
    expect(cards[1].style.getPropertyValue("--p1")).toBe("#173b3d");
    expect(cards[1].style.getPropertyValue("--tilt-rx")).toBe("3deg");
    for (const name of ["position", "transform", "z-index", "opacity", "top", "width", "transition-property", "grid-row-start"]) {
      expect(cards[1].style.getPropertyValue(name), name).toBe("");
    }
    expect(cards[0].getAttribute("style")).toBe(STYLES[0]);
  });

  it("dispose while inside the spiral scrolls instantly to the focused card's grid position", () => {
    const { driver, section, cards } = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const y = TRACK_TOP - HEADER + 3 * STEP; // card 3 is the focus
    setScroll(y);
    report(section, "on");
    driver.write({ focus: driver.focus(y), built: true });
    driver.dispose();
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    const cardTop = TRACK_TOP + 1 * (GRID.cardH + GRID.gap);
    expect(scrollTo).toHaveBeenCalledWith({ top: cardTop - HEADER - 24, behavior: "instant" });
  });

  it("past the spiral's end it keeps what follows the track still; below Work it scrolls nothing", () => {
    const past = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const y = TRACK_TOP + LAYER + 8 * STEP - 600; // the track's bottom is on screen
    setScroll(y);
    const bottomBefore = TRACK_TOP + LAYER + 8 * STEP - y;
    past.driver.dispose();
    const gridBottom = TRACK_TOP + 3 * GRID.cardH + 2 * GRID.gap - y;
    expect(scrollTo).toHaveBeenCalledWith({ top: y + (gridBottom - bottomBefore), behavior: "instant" });

    scrollTo.mockClear();
    const above = spiral(9);
    above.driver.dispose();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("a route change (Work already gone from the page) restores without scrolling", () => {
    const { driver, section, cards } = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScroll(TRACK_TOP + 500);
    section.remove();
    driver.dispose();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
  });

  it("the media turning off is immediate and compensated, then ambient; back on waits for Work below", () => {
    const { driver, section, cards, media, modes } = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScroll(TRACK_TOP - HEADER + 2 * STEP);
    report(section, "on");
    media.set(false);
    expect(driver.mode()).toBe("ambient");
    expect(modes).toEqual(["spiral", "ambient"]);
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    expect(scrollTo).toHaveBeenCalledWith({ top: TRACK_TOP - HEADER - 24, behavior: "instant" });

    media.set(true);
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("ambient");
    setScroll(0);
    report(section, "below");
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    driver.dispose();
    expect(media.listeners.size).toBe(0);
  });
});

describe("workHelix — ambient", () => {
  it("marks the card nearest the middle from the band's scroll, and writes no layout", () => {
    const { section, track, cards, driver } = setup(9, { wide: false });
    const band = { scrollLeft: 0 };
    modelBoxes(section, track, band);
    track.getBoundingClientRect = () => rect(0, TRACK_TOP, 390, GRID.cardH);
    const before = styleOf(cards);
    report(section, "on");
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("ambient");
    expect(driver.front()).toBe(0);
    expect(cards[0].hasAttribute(HELIX_FRONT_ATTR)).toBe(true);

    band.scrollLeft = 664;
    driver.write({ focus: 0, built: true });
    expect(driver.front()).toBe(0); // nothing scrolled as far as the driver knows
    fireEvent.scroll(track);
    driver.write({ focus: 0, built: true });
    expect(driver.front()).toBe(2);
    expect(cards.filter((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toEqual([cards[2]]);

    band.scrollLeft = 2656;
    fireEvent.scroll(window);
    driver.write({ focus: 0, built: true });
    expect(driver.front()).toBe(8);
    expect(styleOf(cards)).toEqual(before);
    expect(track.hasAttribute("style")).toBe(false);

    driver.dispose();
    expect(cards.filter((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toEqual([]);
    band.scrollLeft = 0;
    fireEvent.scroll(track); // listeners are gone: nothing throws, nothing is marked
    expect(cards[0].hasAttribute(HELIX_FRONT_ATTR)).toBe(false);
  });
});

describe("workHelix — cards changing (MutationObserver)", () => {
  it("re-collects re-keyed cards: the old ones restored, the new ones laid out", async () => {
    const { driver, track, cards, modes } = spiral(9);
    driver.write({ focus: 1, built: true });
    const added = document.createElement("a");
    added.setAttribute("style", "--p1:#000;--p2:#fff");
    track.replaceChild(added, cards[8]);
    modelBoxes(track.parentElement as HTMLElement, track);
    await Promise.resolve();

    expect(driver.cards()).toHaveLength(9);
    expect(driver.cards()).toContain(added);
    expect(driver.cards()).not.toContain(cards[8]);
    expect(cards[8].getAttribute("style")).toBe(STYLES[3]);
    expect(added.style.position).toBe("sticky");
    expect(driver.mode()).toBe("spiral");
    expect(modes).toEqual(["spiral"]);

    driver.write({ focus: 8, built: true });
    expect(added.hasAttribute(HELIX_FRONT_ATTR)).toBe(true);
    driver.dispose();
    expect(added.getAttribute("style")).toBe("--p1:#000;--p2:#fff");
  });

  it("down to two cards: out of the spiral into ambient", async () => {
    const { driver, track, cards, modes } = spiral(9);
    for (const card of cards.slice(2)) card.remove();
    await Promise.resolve();
    expect(driver.mode()).toBe("ambient");
    expect(modes).toEqual(["spiral", "ambient"]);
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    expect(track.hasAttribute("style")).toBe(false);
    driver.dispose();
  });
});

describe("workHelix — guards", () => {
  it("no IntersectionObserver: stays off and never throws", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { driver, cards, track, modes } = setup(9);
    expect(() => {
      driver.write({ focus: 3, built: true });
      driver.focus(4000);
      driver.dispose();
    }).not.toThrow();
    expect(driver.mode()).toBe("off");
    expect(modes).toEqual([]);
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    expect(track.hasAttribute("style")).toBe(false);
  });

  it("no matchMedia: stays off and never throws", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { section, track, cards } = fixture(9);
    const modes: WorkHelixMode[] = [];
    const driver = createWorkHelixDriver({ track, section, probe: probeFor(), onMode: (m) => modes.push(m) });
    report(section, "below");
    expect(() => driver.write({ focus: 0, built: true })).not.toThrow();
    expect(driver.mode()).toBe("off");
    expect(modes).toEqual([]);
    expect(cards[0].getAttribute("style")).toBe(STYLES[0]);
    driver.dispose();
  });

  it("an exception inside write restores everything and leaves it off", () => {
    const { driver, probe, cards, track, modes } = spiral(9);
    driver.write({ focus: 2, built: true });
    const version = probe.version;
    Object.defineProperty(probe, "version", {
      configurable: true,
      get() {
        throw new Error("boom");
      },
    });
    expect(() => driver.write({ focus: 2.5, built: true })).not.toThrow();
    expect(driver.mode()).toBe("off");
    expect(modes).toEqual(["spiral", "off"]);
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    expect(track.hasAttribute("style")).toBe(false);
    expect(cards.filter((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toEqual([]);

    Object.defineProperty(probe, "version", { configurable: true, writable: true, value: version + 1 });
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("off");
    driver.dispose();
    expect(modes).toEqual(["spiral", "off"]);
  });

  it("a stage callback that throws on entry restores too", () => {
    const { section, cards, driver } = setup(9, {
      onMode: (m) => {
        if (m === "spiral") throw new Error("stage");
      },
    });
    report(section, "below");
    expect(() => driver.write({ focus: 0, built: true })).not.toThrow();
    expect(driver.mode()).toBe("off");
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    driver.dispose();
  });
});

describe("workHelix — React re-renders keep the spiral (real Work)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(api.fetchContent).mockReset();
    vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
  });

  function LocaleButton() {
    const { setLocale } = useLanguage();
    return createElement("button", { type: "button", onClick: () => setLocale("en") }, "en");
  }

  it("a locale switch re-renders the cards and leaves the driver's inline layout alone", () => {
    // The providers' props require `children`; handed over as createElement's rest arguments here.
    const Language = LanguageProvider as FunctionComponent<{ initialLocale: "ro"; children?: ReactNode }>;
    const Content = SiteContentProvider as FunctionComponent<{ children?: ReactNode }>;
    const view = render(
      createElement(Language, { initialLocale: "ro" }, createElement(Content, null, createElement(LocaleButton), createElement(Work))),
    );
    const section = view.container.querySelector<HTMLElement>("#lucrari")!;
    const track = section.querySelector<HTMLElement>("a, article")!.parentElement!;
    modelBoxes(section, track);
    const cards = Array.from(track.children) as HTMLElement[];
    expect(cards.length).toBeGreaterThanOrEqual(3);
    const rendered = styleOf(cards);
    expect(rendered[0]).toMatch(/--p1/);

    const modes: WorkHelixMode[] = [];
    const media = fakeMedia(true);
    const driver = createWorkHelixDriver({ track, section, probe: probeFor(), matchMedia: media.matchMedia, onMode: (m) => modes.push(m) });
    report(section, "below");
    driver.write({ focus: 1.3, built: true });
    driver.write({ focus: 1.4, built: true });
    expect(driver.mode()).toBe("spiral");
    const laidOut = styleOf(cards);
    const p1 = cards[0].style.getPropertyValue("--p1");
    const headingBefore = section.textContent;

    act(() => {
      fireEvent.click(view.getByRole("button", { name: "en" }));
    });

    expect(section.textContent).not.toBe(headingBefore);
    expect(section.textContent).toContain("TBS portfolio");
    expect(Array.from(track.children).every((el, i) => el === cards[i])).toBe(true);
    expect(styleOf(cards)).toEqual(laidOut);
    expect(cards[0].style.getPropertyValue("--p1")).toBe(p1);
    expect(cards[1].style.position).toBe("sticky");
    expect(cards[1].style.transform).toMatch(/^translate3d\(/);

    driver.dispose();
    expect(styleOf(cards)).toEqual(rendered);
    expect(modes).toEqual(["spiral", "off"]);
    view.unmount();
  });
});
