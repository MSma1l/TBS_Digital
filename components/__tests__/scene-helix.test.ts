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
  HELIX_OUTRO,
  HELIX_WIPE_PROP,
  WORK_HELIX_MEDIA,
  createCardPose,
  focusFromProgress,
  helixCardHeight,
  helixCardWidth,
  helixEdge,
  helixExitAt,
  helixExitLength,
  helixFocusAt,
  helixLead,
  helixWipe,
  helixLayout,
  helixOutro,
  helixSlack,
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

/** The transform the driver writes for a pose (workHelix.ts). */
function transformOf(p: CardPose): string {
  const deg = (r: number) => r2((r * 180) / Math.PI);
  return (
    `perspective(${HELIX_LAYOUT.camera.depth}px) ` +
    `translate3d(${r2(p.x)}px, ${r2(p.y)}px, ${r2(p.tz)}px) ` +
    `scale(${r4(p.scale)}) rotateY(${deg(p.rotY)}deg) rotateX(${deg(p.rotX)}deg)`
  );
}

describe("helix layout — constants and clamps", () => {
  it("spirals from a portrait tablet up, and turns by the helix model's own angle", () => {
    expect(WORK_HELIX_MEDIA).toBe("(min-width: 768px) and (min-height: 600px)");
    expect(HELIX_LAYOUT.angle).toBe(HELIX_ANGLE);
    expect(HELIX_ANGLE).toBeCloseTo((2 * Math.PI) / 9, 12);
  });

  it("card width clamp(240, .215·w, 300); height min(.36·sceneH, 260); step clamp(240, .38·vh, 380)", () => {
    expect([700, 888, 1000, 1260, 1280, 1920].map(helixCardWidth)).toEqual([240, 240, 240, 270.9, 275.2, 300]);
    expect(helixCardWidth(1100)).toBe(240);
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
      [-359.07, -247.86, 0.94, 0.95, 0.77, 9, "front"],
      [-204.8, 0, 1.12, 1, 1, 11, "front"],
      [-50.53, 247.86, 0.94, 0.95, 0.77, 9, "front"],
      [31.55, 495.72, 0.79, 0.49, 0.17, 3, "front"],
      [3.05, 743.58, 0.67, 0, -0.5, -5, "back"],
    ]);
    expect(poses(5, 1, 706, 953).map(row)).toEqual([
      [-199.18, -324.02, 0.94, 0.95, 0.77, 9, "front"],
      [-112.96, 0, 1.12, 1, 1, 11, "front"],
      [-26.74, 324.02, 0.94, 0.95, 0.77, 9, "front"],
      [19.14, 648.04, 0.79, 0.49, 0.17, 3, "front"],
      [3.21, 972.06, 0.67, 0, -0.5, -5, "back"],
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

  it("no card ever winks out on screen: opacity reaches 0 only once its box has left the layer", () => {
    // The card enters low in the zone and leaves over the top, so it is *meant* to travel past
    // ±(sceneH + cardH)/2 — what must hold instead is that it is already off screen by the time
    // it has nothing left to show, and that it never wanders more than a zone from the centre.
    for (const sceneH of SCENE_HEIGHTS) {
      const cardH = helixCardHeight(sceneH);
      for (let focus = 0; focus <= 8; focus += 0.05) {
        for (const [i, p] of poses(9, focus, 1280, sceneH).entries()) {
          const where = `h ${sceneH} focus ${focus} card ${i}`;
          const onScreen = Math.abs(p.y) - (cardH * p.scale) / 2 < sceneH / 2;
          if (onScreen) expect(p.opacity, where).toBeGreaterThan(0);
          if (p.opacity > 0) expect(Math.abs(p.y), where).toBeLessThanOrEqual(sceneH);
          if (Math.abs(i - focus) >= HELIX_LAYOUT.fade[1]) expect(p.opacity).toBe(0);
        }
      }
    }
  });

  it("a card slides in from the bottom of the zone solid, not as a ghost", () => {
    // Where its top edge first touches the layer's bottom, it must already be plainly there.
    for (const sceneH of SCENE_HEIGHTS) {
      const cardH = helixCardHeight(sceneH);
      let seen = 0;
      for (let d = 3.4; d > 0; d -= 0.005) {
        const p = helixLayout(0, -d, 1280, sceneH, createCardPose());
        if (Math.abs(p.y) - (cardH * p.scale) / 2 > sceneH / 2) continue;
        seen += 1;
        expect(p.opacity, `h ${sceneH} first on screen at d ${d}`).toBeGreaterThan(0.5);
        break;
      }
      expect(seen).toBe(1);
    }
  });

  it("writes into `out` and returns it", () => {
    const out = createCardPose();
    expect(helixLayout(3, 1, 1280, 729, out)).toBe(out);
  });
});

describe("helixLayout — the 3D pose", () => {
  it("the card at the focus is square to the camera; every other one turns with its own angle", () => {
    const at = (d: number) => helixLayout(0, -d, 1280, 729, createCardPose());
    expect(at(0).rotY).toBe(0);
    expect(at(0).rotX).toBeCloseTo(0, 12);
    expect(at(0).tz).toBeCloseTo(0, 12);
    // rotateY follows the angle round the strand, damped; rotateX leans along its rise.
    for (const d of [-2.4, -1, -0.3, 0.3, 1, 2.4]) {
      const p = at(d);
      expect(p.rotY).toBeCloseTo(HELIX_LAYOUT.turn.y * d * HELIX_ANGLE, 12);
      expect(Math.sign(p.rotY)).toBe(Math.sign(d));
      expect(Math.abs(p.rotX)).toBeLessThanOrEqual(HELIX_LAYOUT.turn.x * HELIX_LAYOUT.turn.xMax + 1e-12);
      expect(Math.sign(p.rotX || 1)).toBe(-Math.sign(d) || 1);
    }
    // The lean is capped, so a far card never lies flat.
    expect(at(9).rotX).toBeCloseTo(-HELIX_LAYOUT.turn.x * HELIX_LAYOUT.turn.xMax, 12);
  });

  it("depth is never towards the camera: the far half of the orbit is pushed away, and only that", () => {
    for (let d = -4.5; d <= 4.5; d += 0.01) {
      const p = helixLayout(0, -d, 1280, 729, createCardPose());
      expect(p.tz, `d ${d}`).toBeLessThanOrEqual(0);
      expect(p.tz, `d ${d}`).toBeGreaterThanOrEqual(-HELIX_LAYOUT.camera.back);
      // Back of the strand ⇒ furthest away; facing ⇒ on the camera's plane.
      expect(p.tz).toBeCloseTo((-HELIX_LAYOUT.camera.back * (1 - p.z)) / 2, 12);
    }
  });

  it("turns continuously: no step in any channel between neighbouring focuses", () => {
    const keys = ["x", "y", "tz", "scale", "rotY", "rotX", "opacity"] as const;
    for (const w of WIDTHS) {
      let previous = poses(9, 0, w, 729);
      for (let focus = 0.02; focus <= 8; focus += 0.02) {
        const now = poses(9, focus, w, 729);
        for (let i = 0; i < 9; i += 1) {
          for (const key of keys) {
            const jump = Math.abs(now[i][key] - previous[i][key]);
            const limit = key === "y" || key === "x" || key === "tz" ? 12 : 0.15;
            expect(jump, `w ${w} focus ${focus} card ${i} ${key}`).toBeLessThan(limit);
          }
        }
        previous = now;
      }
    }
  });
});

describe("the entrance and the finish", () => {
  it("helixExitAt: 0 up to the last card's focus, 1 by the end of the finish", () => {
    const span = { start: 1000, end: 3432 };
    const len = helixExitLength(VH, LAYER);
    expect(helixExitAt(span.start, span, len)).toBe(0);
    expect(helixExitAt(span.end, span, len)).toBe(0);
    expect(helixExitAt(span.end + len / 2, span, len)).toBeCloseTo(0.5, 12);
    expect(helixExitAt(span.end + len, span, len)).toBe(1);
    expect(helixExitAt(span.end + 9999, span, len)).toBe(1);
    expect(helixExitAt(Number.NaN, span, len)).toBe(0);
    expect(helixExitAt(span.end + 100, span, 0)).toBe(0);
  });

  it("helixFocusAt hands over to the finish at exactly the cards' own rate, then lifts", () => {
    const span = { start: 1000, end: 1000 + 8 * STEP };
    const len = helixExitLength(VH, LAYER);
    const at = (y: number) => helixFocusAt(y, span, 9, STEP, len);
    for (let i = 0; i <= 8; i += 1) expect(at(span.start + i * STEP)).toBeCloseTo(i, 9);
    // No kick at the hand-over: the rate either side of the last card's focus is the same.
    const rate = (y: number) => (at(y + 0.5) - at(y - 0.5)) * STEP;
    expect(rate(span.end - STEP)).toBeCloseTo(1, 6);
    expect(rate(span.end + 0.6)).toBeCloseTo(1, 2);
    // …and it eases up to 1 + `lift` by the end of the finish, so the deck clears the top.
    expect(rate(span.end + len - 0.6)).toBeCloseTo(1 + HELIX_OUTRO.lift, 2);
    const travel = (len / STEP) * (1 + HELIX_OUTRO.lift / 2);
    expect(at(span.end + len)).toBeCloseTo(8 + travel, 9);
    expect(at(span.end + len + 5000)).toBeCloseTo(8 + travel, 9);
    expect(at(span.start - 5000)).toBe(0);
    // Whatever the layer, the whole deck is past the fade window when the finish ends.
    for (const sceneH of SCENE_HEIGHTS) {
      const exit = helixExitLength(VH, sceneH);
      const cleared = (exit / STEP) * (1 + HELIX_OUTRO.lift / 2);
      expect(cleared, `h ${sceneH}`).toBeGreaterThanOrEqual(HELIX_LAYOUT.fade[1] - 1e-12);
    }
  });

  it("helixWipe: the screenshot is drawn on as the card climbs, and stays whole after", () => {
    const [full, none] = HELIX_LAYOUT.wipe;
    // Below the front by more than `none` steps: nothing of the picture yet.
    expect(helixWipe(0, -none)).toBe(0);
    expect(helixWipe(0, -none - 4)).toBe(0);
    // A card's travel further up: whole, and whole for the whole of its way out over the top.
    expect(helixWipe(0, -full)).toBe(1);
    expect(helixWipe(0, 0)).toBe(1);
    expect(helixWipe(0, 4)).toBe(1);
    expect(helixWipe(0, -Number.NaN)).toBe(1);
    // It is whole before the card is the one being read, and starts as the card appears.
    expect(full).toBeGreaterThan(0);
    expect(none).toBeGreaterThanOrEqual(HELIX_LAYOUT.fade[1] - 0.1);
    let last = 0;
    for (let d = none; d >= full; d -= 0.01) {
      const now = helixWipe(0, -d);
      expect(now, `d ${d}`).toBeGreaterThanOrEqual(last - 1e-12);
      last = now;
    }
    expect(helixWipe(0, -(full + none) / 2)).toBeCloseTo(0.5, 9);
  });

  it("the finish runs past the track it added: over the slack a sticky card still has", () => {
    // The track carries `helixOutro`; the finish also uses the centring slack under the layer,
    // which is exactly the stretch the spiral used to freeze in.
    // A normal window: `steps` cards' worth, and the floor underneath it is not reached.
    expect(helixOutro(800, 729)).toBeCloseTo(HELIX_OUTRO.steps * helixStep(800), 12);
    expect(helixOutro(1000, 929)).toBeCloseTo(HELIX_OUTRO.steps * 380, 12);
    // A short layer has little slack to spend, so the finish buys the rest of the travel itself.
    expect(helixOutro(500, 429)).toBeGreaterThan(HELIX_OUTRO.steps * 240);
    expect(helixOutro(500, 429)).toBeCloseTo((HELIX_LAYOUT.fade[1] * 240) / 1.3 - helixSlack(429), 12);
    for (const sceneH of SCENE_HEIGHTS) {
      const slack = (sceneH - helixCardHeight(sceneH)) / 2;
      expect(helixExitLength(VH, sceneH)).toBeCloseTo(helixOutro(VH, sceneH) + slack, 12);
      expect(helixExitLength(VH, sceneH)).toBeGreaterThan(helixOutro(VH, sceneH));
    }
    // No slack at all (a layer no taller than a card): the finish buys the whole travel itself.
    expect(helixExitLength(VH, 0)).toBeCloseTo(helixOutro(VH, 0), 12);
    expect((helixExitLength(VH, 0) / STEP) * (1 + HELIX_OUTRO.lift / 2)).toBeGreaterThanOrEqual(
      HELIX_LAYOUT.fade[1] - 1e-12,
    );
  });

  it("the lead-in keeps every card at or below the row's top, so the heading is never touched", () => {
    // Before the track sticks a card's layout box is the top of the tall row, not the middle of
    // the sticky zone — so a card lifted above it would be drawn over Work's heading. While the
    // focus is in the lead-in (never above 0) no card can be: they are all at d >= 0.
    for (const sceneH of SCENE_HEIGHTS) {
      const lead = helixLead(sceneH, STEP);
      expect(lead).toBeGreaterThan(1);
      for (let focus = -lead; focus <= 0; focus += 0.02) {
        for (const [i, p] of poses(9, focus, 1280, sceneH).entries()) {
          expect(p.y, `h ${sceneH} focus ${focus} card ${i}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
    // The lead-in is the zone's own height of scroll, so the focus runs at the cards' own rate.
    expect(helixLead(729, 304) * 304).toBeCloseTo(729, 9);
    expect(helixLead(0, 304)).toBe(0);
    expect(helixLead(729, 0)).toBe(0);
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
/** The finish's own scroll: part of the track, never part of the focus span… */
const OUTRO = helixOutro(VH, LAYER);
/** …and how far it runs, which is that plus a sticky card's centring slack under the layer. */
const EXIT_LEN = helixExitLength(VH, LAYER);
/** The whole track the driver lays out: the layer, one step per card after the first, the finish. */
const TRACK_H = LAYER + 8 * STEP + OUTRO;

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
  it("only once the helix is built, three cards are there and the screen is wide", () => {
    const { section, track, cards, driver, modes } = setup(9);
    const before = styleOf(cards);

    // Not built yet: the grid stays, wherever the visitor is.
    setScroll(SECTION_TOP - 300);
    report(section, "on");
    driver.write({ focus: 0, built: false });
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
    // The layer, one `helixStep` per card after the first, then the finish's own scroll.
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${TRACK_H}px`);
    expect(track.style.getPropertyValue("grid-template-columns")).toBe("100%");
    for (const card of cards) {
      expect(card.style.position).toBe("sticky");
      expect(card.style.getPropertyValue("grid-row-start")).toBe("1");
      expect(card.style.getPropertyValue("grid-column-end")).toBe("auto");
      expect(card.style.getPropertyValue("justify-self")).toBe("center");
      expect(card.style.getPropertyValue("transition-property")).toBe("translate, box-shadow, border-color");
      expect(card.style.width).toBe("258px");
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
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScroll(SECTION_TOP + 6000); // e.g. #estimare, past Work
    report(section, "above"); // the observer's first and only report
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    setScroll(0); // the logo: straight across Work, so the observer never fires
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    expect(modes).toEqual(["spiral"]);
    driver.dispose();
  });

  it("Work already on screen: it lays the spiral out anyway and lands on the project in view", () => {
    // Laying the spiral out grows the track by thousands of px. Refusing while Work is on screen
    // used to leave a reload or a `#lucrari` link on the grid for good; instead the driver notes
    // the card in the middle of the window and puts the visitor back on it once it has measured.
    const { section, track, cards, driver, modes } = setup(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    // The grid's second row across the middle of the window: its first card (3) is the nearest.
    setScroll(TRACK_TOP + (GRID.cardH + GRID.gap) + GRID.cardH / 2 - VH / 2);
    report(section, "on");
    driver.write({ focus: 0, built: true });
    expect(driver.mode()).toBe("spiral");
    expect(modes).toEqual(["spiral"]);
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${TRACK_H}px`);
    expect(scrollTo).toHaveBeenLastCalledWith({
      top: scrollForCard(3, 9, { start: TRACK_TOP - HEADER, end: TRACK_TOP - HEADER + 8 * STEP }),
      behavior: "instant",
    });
    expect(cards.every((el) => el.style.position === "sticky")).toBe(true);
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

  it("measures its own span: track top under the header → track bottom at the viewport's, less the finish", () => {
    const { driver } = spiral(9);
    const span = { start: TRACK_TOP - HEADER, end: TRACK_TOP - HEADER + 8 * STEP };
    // Below the span the focus runs backwards over the lead-in, at the cards' own rate, and stops.
    expect(driver.focus(span.start - STEP)).toBeCloseTo(-1, 9);
    const lead = helixLead(LAYER, STEP);
    expect(driver.focus(span.start - lead * STEP)).toBeCloseTo(-lead, 9);
    expect(driver.focus(span.start - lead * STEP - 5000)).toBeCloseTo(-lead, 9);
    expect(driver.focus(span.start)).toBe(0);
    expect(driver.focus(scrollForCard(4, 9, span))).toBeCloseTo(4, 9);
    // Past the last card the focus runs on over the finish, easing up, then stops.
    expect(driver.focus(span.end)).toBeCloseTo(8, 9);
    expect(driver.focus(span.end + STEP)).toBeGreaterThan(9);
    const travel = (EXIT_LEN / STEP) * (1 + HELIX_OUTRO.lift / 2);
    expect(driver.focus(span.end + EXIT_LEN)).toBeCloseTo(8 + travel, 9);
    expect(driver.focus(span.end + EXIT_LEN + 900)).toBeCloseTo(8 + travel, 9);
    // The whole deck has left over the top of the zone by then.
    expect(travel).toBeGreaterThanOrEqual(HELIX_LAYOUT.fade[1]);
    // The finish's own 0..1, which is what the helix reads.
    expect(driver.exit(span.end)).toBe(0);
    expect(driver.exit(span.end + EXIT_LEN / 2)).toBeCloseTo(0.5, 9);
    expect(driver.exit(span.end + EXIT_LEN)).toBeCloseTo(1, 12);
    expect(driver.exit(span.end + 9999)).toBe(1);
    // …and the cards' own cadence is untouched: one `helixStep` apart, as before the finish.
    expect(driver.focus(span.start + 3 * STEP)).toBeCloseTo(3, 9);
    driver.dispose();
  });

  it("re-lays out and re-measures when the probe's version changes", () => {
    const { driver, probe, track } = spiral(9);
    probe.layerH = 529;
    Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 600 });
    driver.write({ focus: 0, built: true });
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${TRACK_H}px`); // same version: kept
    probe.version += 1;
    driver.write({ focus: 0, built: true });
    expect(track.style.getPropertyValue("grid-template-rows")).toBe(`${529 + 8 * 240 + helixOutro(600, 529)}px`);
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
        expect(card.style.transform).toBe(transformOf(p));
        expect(card.style.zIndex).toBe(String(p.zIndex));
        expect(Number(card.style.opacity)).toBeCloseTo(p.opacity, 3);
        // A card faded out of the picture takes no pointer either, whichever way it faces.
        expect(card.style.pointerEvents).toBe(p.face === "front" && p.opacity >= 0.08 ? "auto" : "none");
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
    expect(cards[2].style.transform).toMatch(/^perspective\(1200px\) translate3d\(/);
    driver.dispose();
  });

  it("draws the screenshot on from the card's own place on the strand, and takes it off on exit", () => {
    const { driver, cards } = spiral(9);
    const wipes = () => cards.map((c) => c.style.getPropertyValue(HELIX_WIPE_PROP));
    driver.write({ focus: 0, built: true });
    // Card 0 is the front: whole. The ones below it are still being drawn on, then nothing.
    expect(wipes()[0]).toBe("1");
    expect(cards.map((_, i) => Number(wipes()[i]))).toEqual(cards.map((_, i) => r2(helixWipe(i, 0))));
    expect(Number(wipes()[8])).toBe(0);
    // A card part way up the zone is part way drawn on — the whole point: it is mid-reveal at a
    // scroll position the visitor is resting at, not at one they passed through seconds ago.
    const half = HELIX_LAYOUT.wipe[0] + (HELIX_LAYOUT.wipe[1] - HELIX_LAYOUT.wipe[0]) / 2;
    driver.write({ focus: 4 - half, built: true });
    expect(Number(cards[4].style.getPropertyValue(HELIX_WIPE_PROP))).toBeCloseTo(0.5, 2);
    // Scrolling back down un-draws it again: the reveal plays on every pass, both ways.
    driver.write({ focus: 4 - HELIX_LAYOUT.wipe[1], built: true });
    expect(cards[4].style.getPropertyValue(HELIX_WIPE_PROP)).toBe("0");
    driver.write({ focus: 4, built: true });
    expect(cards[4].style.getPropertyValue(HELIX_WIPE_PROP)).toBe("1");
    // And it is one of the driver's own properties: the restore takes it off with the rest.
    driver.dispose();
    expect(cards.some((c) => c.style.getPropertyValue(HELIX_WIPE_PROP) !== "")).toBe(false);
    expect(cards.some((c) => c.hasAttribute(HELIX_FRONT_ATTR))).toBe(false);
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
    const y = TRACK_TOP + TRACK_H - 600; // the track's bottom is on screen
    setScroll(y);
    const bottomBefore = TRACK_TOP + TRACK_H - y;
    past.driver.dispose();
    const gridBottom = TRACK_TOP + 3 * GRID.cardH + 2 * GRID.gap - y;
    expect(scrollTo).toHaveBeenCalledTimes(1);
    const to = scrollTo.mock.calls[0][0] as ScrollToOptions;
    expect(to.behavior).toBe("instant");
    expect(to.top).toBeCloseTo(y + (gridBottom - bottomBefore), 6);

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

  it("the media turning off is immediate and compensated, then ambient; back on returns the spiral", () => {
    const { driver, section, cards, media, modes } = spiral(9);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setScroll(TRACK_TOP - HEADER + 2 * STEP);
    report(section, "on");
    media.set(false);
    expect(driver.mode()).toBe("ambient");
    expect(modes).toEqual(["spiral", "ambient"]);
    expect(styleOf(cards)).toEqual(STYLES.concat(STYLES).slice(0, 9));
    expect(scrollTo).toHaveBeenCalledWith({ top: TRACK_TOP - HEADER - 24, behavior: "instant" });

    // Back to a wide window: the spiral returns at once, wherever the visitor is standing.
    media.set(true);
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
    // The track's first child is the loading state (`HelixLoader`, an <svg>), which the driver
    // itself skips because it collects `instanceof HTMLElement` only. Filter it the same way.
    const cards = Array.from(track.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
    expect(cards.length).toBeGreaterThanOrEqual(3);
    expect(track.querySelectorAll("[data-loading]")).toHaveLength(1);
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
    // The same card ELEMENTS, in the same order — React reused them rather than remounting, which
    // is what keeps the driver's inline layout alive. Filtered like the driver's own collector, so
    // the loading state's <svg> at the head of the track is not compared against a card.
    const stillCards = Array.from(track.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
    expect(stillCards.every((el, i) => el === cards[i])).toBe(true);
    expect(stillCards).toHaveLength(cards.length);
    expect(styleOf(cards)).toEqual(laidOut);
    expect(cards[0].style.getPropertyValue("--p1")).toBe(p1);
    expect(cards[1].style.position).toBe("sticky");
    expect(cards[1].style.transform).toMatch(/^perspective\(1200px\) translate3d\(/);

    driver.dispose();
    expect(styleOf(cards)).toEqual(rendered);
    expect(modes).toEqual(["spiral", "off"]);
    view.unmount();
  });
});
