import { describe, expect, it, vi } from "vitest";
import {
  STAT_AIR,
  STAT_FADE_SECONDS,
  placeStat,
  statAt,
  statLocal,
  statsShare,
  worldPerPx,
} from "@/components/scene/choreography";
import { STAT_WINDOW, writeStatWindows } from "@/components/scene/scrollProbe";
import { createStatCards } from "@/components/scene/statCards";
import {
  ACCENT_POSE,
  STAT_FACE,
  composeStatFace,
  projectAccent,
  statShapeFor,
  wrapLines,
} from "@/components/scene/three/statFace";
import { STAT_MOTION, statFloat } from "@/components/scene/three/models/statPanel";
import { SCENE_TIER_CONFIG } from "@/components/scene/tiers";
import { STATS_GROUP_ATTR, createScrollProbe, type ScrollProbe } from "@/lib/scene";

/*
 * The hero's two stat panels: the numbers the hero claims, drawn in the 3D scene instead of on
 * the page (2026-09-25).
 *
 * Three things are pinned here, and they are the three ways this can go wrong:
 *  · the WINDOW — a card is measured only while the page says it opened one (`--stat-window: 1`,
 *    which `app/globals.css` sets in the same block that takes the card's paint away), and it is
 *    measured from LAYOUT, so the intro's entrance, the scroll parallax and a reveal offset cannot
 *    move a panel off the box it belongs to;
 *  · the PLACE — the panel fills that box, per axis, wherever the page put it and whatever the
 *    scroll is;
 *  · the FACE — it is composed from the card's own text and computed type, so the number in the
 *    scene is the number in the DOM, in the visitor's language, with nothing authored twice.
 */

/** A home-page probe with two stat windows in it, as 1440 x 900 really lays them out. */
function heroProbe(boxes = [
  { x: 920, y: 554, w: 192, h: 167 },
  { x: 1128, y: 554, w: 192, h: 167 },
]): ScrollProbe {
  const probe = createScrollProbe();
  probe.live = true;
  probe.version = 1;
  probe.headerH = 71;
  probe.stage = { top: 0, bottom: 5200 };
  probe.stats = boxes.map((box) => ({ ...box }));
  return probe;
}

/** A card element whose layout box and computed `--stat-window` the test controls. */
function makeCard(
  metric: string,
  layout: { x: number; y: number; w: number; h: number },
  open = true,
): HTMLElement {
  const card = document.createElement("div");
  card.dataset.metric = metric;
  card.setAttribute("data-scene-anchor", "stat");
  card.style.setProperty("--stat-window", open ? "1" : "0");
  Object.defineProperty(card, "offsetWidth", { configurable: true, value: layout.w });
  Object.defineProperty(card, "offsetHeight", { configurable: true, value: layout.h });
  Object.defineProperty(card, "offsetLeft", { configurable: true, value: layout.x });
  Object.defineProperty(card, "offsetTop", { configurable: true, value: layout.y });
  Object.defineProperty(card, "offsetParent", { configurable: true, value: null });
  return card;
}

describe("the stat windows, measured", () => {
  it("has none before the director has measured, and no share or place with none", () => {
    const probe = createScrollProbe();
    expect(probe.stats).toEqual([]);
    expect(statsShare(probe, 0, 900)).toBe(0);
    expect(placeStat(probe, 0, 1440, 900, 0)).toBeNull();
    expect(statAt(probe, 1000, 600)).toBe(-1);
  });

  it("takes each card's own LAYOUT box, so a transform on the group moves no panel", () => {
    const probe = createScrollProbe();
    const first = makeCard("projects", { x: 920, y: 554, w: 192, h: 167 });
    const second = makeCard("automation", { x: 1128, y: 554, w: 192, h: 167 });
    // The intro's entrance is `{ y: 40, rotateX: -14 }` on the group, and the desktop parallax
    // slides its wrapper: both move the rendered box and neither moves the layout.
    vi.spyOn(first, "getBoundingClientRect").mockReturnValue({ x: 920, y: 594, width: 192, height: 158 } as DOMRect);

    writeStatWindows(probe, [first, second]);
    expect(probe.stats).toEqual([
      { x: 920, y: 554, w: 192, h: 167 },
      { x: 1128, y: 554, w: 192, h: 167 },
    ]);
  });

  it("refuses the whole set unless the page opened every card as a window", () => {
    const probe = heroProbe();
    const open = makeCard("projects", { x: 920, y: 554, w: 192, h: 167 });
    const shut = makeCard("automation", { x: 1128, y: 554, w: 192, h: 167 }, false);

    // Below 861px, and on a `fallback` / `off` renderer, the card is the painted card: no window.
    writeStatWindows(probe, [open, shut]);
    expect(probe.stats).toEqual([]);

    // …and so is a box the page is laying out to nothing, or one too small to hold a number.
    const tiny = makeCard("automation", { x: 1128, y: 554, w: STAT_WINDOW.minWidth - 1, h: 167 });
    writeStatWindows(probe, [open, tiny]);
    expect(probe.stats).toEqual([]);

    writeStatWindows(probe, []);
    expect(probe.stats).toEqual([]);
  });

  it("keeps the array and its rects, so a refresh allocates nothing", () => {
    const probe = createScrollProbe();
    const card = makeCard("projects", { x: 920, y: 554, w: 192, h: 167 });
    const array = probe.stats;
    writeStatWindows(probe, [card]);
    const rect = probe.stats[0];
    writeStatWindows(probe, [card]);
    expect(probe.stats).toBe(array);
    expect(probe.stats[0]).toBe(rect);
  });
});

describe("where a stat panel is drawn", () => {
  it("fills its own window, per axis, less the air the glow needs", () => {
    const probe = heroProbe();
    const w = 1440;
    const h = 900;
    const k = worldPerPx(h);
    const spot = placeStat(probe, 0, w, h, 0)!;
    expect(spot).not.toBeNull();

    // the window's centre, in world units off the canvas's centre. The canvas's top is the
    // sticky layer's: under the header at this scroll, which is what `canvasDocTop` answers.
    expect(spot.x).toBeCloseTo((920 + 192 / 2 - w / 2) * k, 6);
    expect(spot.y).toBeCloseTo(-(554 + 167 / 2 - 71 - h / 2) * k, 6);
    // and its size, less STAT_AIR a side — the panel is a rectangle, not a scaled square
    expect(spot.w).toBeCloseTo((192 - 2 * STAT_AIR) * k, 6);
    expect(spot.h).toBeCloseTo((167 - 2 * STAT_AIR) * k, 6);
    expect(spot.w / spot.h).toBeCloseTo((192 - 2 * STAT_AIR) / (167 - 2 * STAT_AIR), 6);
  });

  it("follows the scroll rigidly, and the second window stands beside the first", () => {
    const probe = heroProbe();
    const h = 900;
    const k = worldPerPx(h);
    const first = { ...placeStat(probe, 0, 1440, h, 0)! };
    const second = { ...placeStat(probe, 0, 1440, h, 1)! };
    expect(second.x - first.x).toBeCloseTo(208 * k, 6);
    expect(second.y).toBeCloseTo(first.y, 6);

    const scrolled = placeStat(probe, 300, 1440, h, 0)!;
    expect(scrolled.y - first.y).toBeCloseTo(300 * k, 6);
    expect(scrolled.x).toBeCloseTo(first.x, 6);
  });

  it("has no place for an index the page did not lay out", () => {
    const probe = heroProbe();
    expect(placeStat(probe, 0, 1440, 900, 2)).toBeNull();
    expect(placeStat(probe, 0, 1440, 900, -1)).toBeNull();
  });

  it("shares the band both windows cover, and the margin is how the world asks 'nearly'", () => {
    const probe = heroProbe();
    const h = 900;
    expect(statsShare(probe, 0, h)).toBe(1);
    // scrolled past: the band is above the canvas
    expect(statsShare(probe, 3000, h)).toBe(0);
    // …but a margin of a viewport reaches it well before it arrives
    expect(statsShare(probe, 1200, h, h)).toBeGreaterThan(0);
    expect(STAT_FADE_SECONDS).toBeGreaterThan(0);
  });

  it("stacked windows share the band from the first one's top to the last one's foot", () => {
    // 861-1024px: one column, the cards under each other
    const probe = heroProbe([
      { x: 564, y: 800, w: 262, h: 135 },
      { x: 564, y: 952, w: 262, h: 135 },
    ]);
    const h = 800;
    // the band is 800 → 1087, and at this scroll the canvas covers 871 → 1671: the top 71px of
    // the band are under the header, so 216 of its 287 are inside.
    expect(statsShare(probe, 800, h)).toBeCloseTo(216 / 287, 4);
    // scrolled to where the whole band is inside the canvas (its top at 471, its foot at 1271)
    expect(statsShare(probe, 400, h)).toBe(1);
  });
});

describe("the pointer on a panel", () => {
  it("names the window a page point is in, and nothing outside them", () => {
    const probe = heroProbe();
    expect(statAt(probe, 921, 555)).toBe(0);
    expect(statAt(probe, 1000, 600)).toBe(0);
    expect(statAt(probe, 1200, 600)).toBe(1);
    expect(statAt(probe, 1119, 600)).toBe(-1); // the gutter between them
    expect(statAt(probe, 1000, 400)).toBe(-1); // above both
  });

  it("says where in the window it is, -1..1 with y down, clamped and centred", () => {
    const probe = heroProbe();
    expect(statLocal(probe, 0, 920 + 96, 554 + 83.5)).toEqual({ x: 0, y: 0 });
    expect(statLocal(probe, 0, 920, 554)).toEqual({ x: -1, y: -1 });
    expect(statLocal(probe, 0, 1112, 721)).toEqual({ x: 1, y: 1 });
    expect(statLocal(probe, 0, 5000, 5000)).toEqual({ x: 1, y: 1 });
    // an index with no window leans nothing rather than throwing
    expect(statLocal(probe, 9, 1000, 600)).toEqual({ x: 0, y: 0 });
  });

  it("idles on a float that is small, bounded and out of phase between the two panels", () => {
    for (const t of [0, 0.7, 3.3, 9, 40]) {
      for (const index of [0, 1]) {
        const { yaw, pitch } = statFloat(t, index);
        expect(Math.abs(yaw)).toBeLessThanOrEqual(STAT_MOTION.float.yaw + 1e-9);
        expect(Math.abs(pitch)).toBeLessThanOrEqual(STAT_MOTION.float.pitch + 1e-9);
      }
    }
    expect(statFloat(2, 0).yaw).not.toBeCloseTo(statFloat(2, 1).yaw, 3);
    // the lean the pointer adds is a shade under the card's own CSS tilt
    expect(STAT_MOTION.lean).toBeLessThan(0.2);
  });
});

describe("the face, composed from the card", () => {
  /** A card with the hero's own markup, and computed styles jsdom can answer. */
  function faceCard(metric: string, value: string, label: string, note: string): HTMLElement {
    const card = document.createElement("div");
    card.dataset.metric = metric;
    card.style.padding = "20px";
    const holo = document.createElement("span");
    holo.setAttribute("data-hologram", "octahedron");
    const b = document.createElement("b");
    b.textContent = value;
    b.style.fontSize = "48px";
    b.style.fontWeight = "900";
    const span = document.createElement("span");
    span.textContent = label;
    span.style.fontSize = "16px";
    span.style.lineHeight = "24.8px";
    const small = document.createElement("small");
    small.textContent = note;
    small.style.fontSize = "11px";
    small.style.letterSpacing = "0.88px";
    card.append(holo, b, span, small);
    Object.defineProperty(card, "offsetHeight", { configurable: true, value: 167 });
    document.body.append(card);
    return card;
  }

  /** A 2D context that records what was drawn, without a canvas. */
  function recorder() {
    const texts: Array<{ text: string; x: number; y: number; font: string; alpha: number }> = [];
    const rects: Array<[number, number, number, number]> = [];
    let strokes = 0;
    const ctx = {
      canvas: { width: 512, height: 288 },
      font: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
      textAlign: "left",
      textBaseline: "top",
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      letterSpacing: "0px",
      setTransform: () => {},
      clearRect: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => rects.push([x, y, w, h]),
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {
        strokes += 1;
      },
      measureText: (text: string) => ({ width: text.length * 8 }),
      fillText: (text: string, x: number, y: number) =>
        texts.push({ text, x, y, font: ctx.font, alpha: ctx.globalAlpha }),
      strokeText: () => {},
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, rects, strokes: () => strokes };
  }

  it("draws the card's own number, label and note — nothing of its own", async () => {
    const card = faceCard("projects", "9", "proiecte în portofoliu", "experiență aplicată");
    const rec = recorder();
    const result = await composeStatFace(card, rec.ctx, [512, 288], 0);

    expect(result).toBe("text");
    const said = rec.texts.map((t) => t.text);
    expect(said).toContain("9");
    expect(said.join(" ")).toContain("proiecte");
    // the note is upper-cased, the way the card upper-cases it in CSS
    expect(said.some((t) => t === "EXPERIENȚĂ APLICATĂ")).toBe(true);
    // and the card's place in the group is the hologram's two-digit tick
    expect(said).toContain("01");
    card.remove();
  });

  it("scales the card's own type by the one canvas-to-card ratio", async () => {
    const card = faceCard("automation", "24/7", "automatizări active", "mai puțină rutină");
    const rec = recorder();
    await composeStatFace(card, rec.ctx, [512, 288], 1);

    // 288 canvas px over a 167px card is 1.7246: the 48px number is drawn at 83px
    const number = rec.texts.find((t) => t.text === "24/7")!;
    expect(number).toBeDefined();
    expect(number.font).toMatch(/\b83px\b/);
    expect(number.alpha).toBe(STAT_FACE.dim.value);
    // the padding is the card's own, scaled the same way: 20px → 34.49
    expect(number.x).toBeCloseTo(20 * (288 / 167), 1);
    expect(rec.texts.find((t) => t.text === "02")).toBeDefined();
    card.remove();
  });

  it("wraps a label the way the card wraps it, and says so when one does not fit", () => {
    const width = (text: string) => text.length * 10;
    expect(wrapLines("proiecte în portofoliu", 130, 3, width)).toEqual(["proiecte în", "portofoliu"]);
    expect(wrapLines("", 130, 3, width)).toEqual([]);
    const long = wrapLines("unu doi trei patru cinci sase sapte opt noua zece", 60, 2, width);
    expect(long).toHaveLength(2);
    expect(long[1].endsWith("…")).toBe(true);
  });

  it("gives each card the wireframe the hero gives it, and draws it as hairlines", () => {
    expect(statShapeFor("projects")).toBe("octahedron");
    expect(statShapeFor("automation")).toBe("rings");
    expect(statShapeFor("anything-else")).toBe("rings");
  });

  it("projects the wireframe on the pose the hero's CSS hologram rests at", () => {
    // the resting pose is rotateX(-20deg) rotateY(35deg)
    expect(ACCENT_POSE.yaw).toBeCloseTo((35 * Math.PI) / 180, 9);
    expect(ACCENT_POSE.pitch).toBeCloseTo((-20 * Math.PI) / 180, 9);
    // every projected point stays inside the circle it is drawn in
    for (const point of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0]] as const) {
      const [x, y] = projectAccent(point, ACCENT_POSE.yaw, ACCENT_POSE.pitch, 100, 100, 20);
      expect(Math.hypot(x - 100, y - 100)).toBeLessThanOrEqual(20.0001);
    }
    // the centre projects to the centre, at any pose
    expect(projectAccent([0, 0, 0], 1.1, -0.4, 50, 60, 12)).toEqual([50, 60]);
  });

  it("draws its own pane faintly: a hologram cannot darken what is behind it", async () => {
    const card = faceCard("projects", "9", "proiecte", "experiență");
    const rec = recorder();
    await composeStatFace(card, rec.ctx, [512, 288], 0);
    expect(rec.rects[0]).toEqual([0, 0, 512, 288]);
    expect(STAT_FACE.plate).toBeGreaterThan(0);
    expect(STAT_FACE.plate).toBeLessThan(0.1);
    card.remove();
  });
});

describe("the cards the scene reads", () => {
  it("finds the anchored cards in DOM order and notices when their text changes", async () => {
    const group = document.createElement("div");
    group.setAttribute(STATS_GROUP_ATTR, "");
    const first = makeCard("projects", { x: 0, y: 0, w: 192, h: 167 });
    first.textContent = "9";
    const second = makeCard("automation", { x: 208, y: 0, w: 192, h: 167 });
    group.append(first, second);
    document.body.append(group);

    const cards = createStatCards({ group });
    expect(cards.cards()).toEqual([first, second]);
    const before = cards.generation();

    first.textContent = "12";
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cards.generation()).toBeGreaterThan(before);

    cards.dispose();
    expect(cards.cards()).toEqual([]);
    group.remove();
  });
});

describe("the face's canvas", () => {
  it("is capped per tier, and the cap is bigger than the hologram's — this one is read", () => {
    for (const tier of ["high", "mid"] as const) {
      const config = SCENE_TIER_CONFIG[tier];
      expect(config.statFace[0]).toBeGreaterThanOrEqual(config.hologram[0]);
      expect(config.statFace[1]).toBeGreaterThanOrEqual(config.hologram[1]);
    }
  });
});
