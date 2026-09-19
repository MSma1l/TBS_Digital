import { describe, expect, it, vi } from "vitest";
import {
  LAPTOP_AIR,
  LAPTOP_BOOT,
  LAPTOP_BOOT_GATE,
  LAPTOP_LIT,
  LAPTOP_SCREEN,
  laptopBootCrt,
  laptopBootFrame,
  laptopBootLid,
  laptopBootSettle,
  laptopBootSurge,
  laptopBootTest,
  laptopBootAssemble,
  laptopScreenBox,
  placeLaptop,
  projectsShare,
  worldPerPx,
} from "@/components/scene/choreography";
import {
  PROJECTS_WINDOW,
  writeProjectsWindow,
} from "@/components/scene/scrollProbe";
import { createProjectsReel } from "@/components/scene/projectsReel";
import {
  LAPTOP_ACCENT,
  LAPTOP_BOUND,
  LAPTOP_LOOP,
  LAPTOP_POSE,
  LID_ANGLE,
  laptopAccentAt,
  laptopHingeAt,
  laptopKeyAt,
  laptopLidAngle,
} from "@/components/scene/three/models/laptop";
import {
  CTA_ATTR,
  HOLOGRAM_MAX,
  composeLaptopBoot,
  composeLaptopScreen,
} from "@/components/scene/three/hologram";
import { PROJECTS_INDEX_ATTR, createScrollProbe, type ScrollProbe } from "@/lib/scene";

/*
 * The projects laptop: where it stands (choreography + the probe), what it is showing
 * (projectsReel.ts) and the arithmetic the model draws itself with.
 *
 * The one thing this file exists to pin: the display's aspect IS the hologram canvas's, so the
 * 384 x 240 cap — the reason a screenshot's fine print stays illegible on it — lands on the panel
 * with no crop and no stretch, and no second pipeline was invented to avoid it.
 */

/** A service page's probe with a projects window in it, measured at 1280 x 800. */
function pageProbe(win = { x: 806, y: 2400, w: 374, h: 332 }): ScrollProbe {
  const probe = createScrollProbe();
  probe.live = true;
  probe.version = 1;
  probe.headerH = 71;
  probe.stage = { top: 71, bottom: 5200 };
  probe.projects = { ...win };
  return probe;
}

describe("the projects window, measured", () => {
  it("is null before the director has measured, and 0 share with it", () => {
    const probe = createScrollProbe();
    expect(probe.projects).toBeNull();
    expect(projectsShare(probe, 0, 800)).toBe(0);
    expect(placeLaptop(probe, 0, 1280, 800)).toBeNull();
  });

  it("takes the element's own box, and refuses one the page is not laying out", () => {
    const probe = createScrollProbe();
    const cell = document.createElement("div");
    document.body.append(cell);
    const box = (rect: { x: number; y: number; w: number; h: number }) =>
      vi.spyOn(cell, "getBoundingClientRect").mockReturnValue({
        left: rect.x,
        top: rect.y,
        right: rect.x + rect.w,
        bottom: rect.y + rect.h,
        width: rect.w,
        height: rect.h,
        x: rect.x,
        y: rect.y,
        toJSON: () => ({}),
      } as DOMRect);

    box({ x: 806, y: 300, w: 374, h: 332 });
    writeProjectsWindow(probe, cell);
    expect(probe.projects).toEqual({ x: 806, y: 300, w: 374, h: 332 });

    // `display: none` below 861px and on a `fallback` / `off` renderer: a 0 x 0 box is how the
    // page says "there is no window here", and the scene must then build nothing at all.
    box({ x: 0, y: 0, w: 0, h: 0 });
    writeProjectsWindow(probe, cell);
    expect(probe.projects).toBeNull();

    // …and so is a box too small to hold a machine.
    box({ x: 806, y: 300, w: PROJECTS_WINDOW.minWidth - 1, h: 332 });
    writeProjectsWindow(probe, cell);
    expect(probe.projects).toBeNull();

    writeProjectsWindow(probe, null);
    expect(probe.projects).toBeNull();
    cell.remove();
  });
});

describe("where the laptop stands", () => {
  it("is centred on the window and fitted inside it, with air for the glow", () => {
    const probe = pageProbe();
    const h = 800;
    const place = placeLaptop(probe, 2100, 1280, h)!;
    expect(place).not.toBeNull();
    const k = worldPerPx(h);
    const win = probe.projects!;
    // dead centre of the cell, in canvas space
    expect(place.x).toBeCloseTo((win.x + win.w / 2 - 640) * k, 10);
    // The cell is 374 x 332: the WIDTH runs out first for a 1.52 x 1.17 object.
    const byWidth = (win.w - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfWidth);
    const byHeight = (win.h - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfHeight);
    expect(byWidth).toBeLessThan(byHeight);
    expect(place.scale).toBeCloseTo(byWidth * k, 12);
    // …and the lit box really is inside the cell, both ways.
    expect(2 * LAPTOP_LIT.halfWidth * (place.scale / k)).toBeLessThanOrEqual(win.w - 2 * LAPTOP_AIR + 1e-9);
    expect(2 * LAPTOP_LIT.halfHeight * (place.scale / k)).toBeLessThanOrEqual(win.h - 2 * LAPTOP_AIR + 1e-9);
  });

  it("is limited by the height in a cell shorter than the fit's own ratio", () => {
    // Not a shipped cell — `.projStage`'s `min-height` is chosen so the WIDTH always runs out
    // first — but the arithmetic has to answer for a short box all the same.
    const probe = pageProbe({ x: 96, y: 2400, w: 374, h: 240 });
    const place = placeLaptop(probe, 2100, 1280, 800)!;
    const k = worldPerPx(800);
    expect(place.scale).toBeCloseTo(((240 - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfHeight)) * k, 12);
  });

  it("follows the window rigidly — a cell in the page is not something to drift against", () => {
    const probe = pageProbe();
    const a = placeLaptop(probe, 2000, 1280, 800, { x: 0, y: 0, scale: 1 })!;
    const ya = a.y;
    const b = placeLaptop(probe, 2100, 1280, 800, { x: 0, y: 0, scale: 1 })!;
    // 100px of scroll moves it by exactly 100px of canvas.
    expect((b.y - ya) / worldPerPx(800)).toBeCloseTo(100, 6);
  });

  it("shares the canvas the way the benefits row does, margin included", () => {
    const probe = pageProbe({ x: 806, y: 1000, w: 374, h: 332 });
    // Well below the fold at scroll 0 (the canvas is the sticky layer under the header).
    expect(projectsShare(probe, 0, 800)).toBe(0);
    // …but near enough to be worth building, with a canvas-height margin.
    expect(projectsShare(probe, 0, 800, 800)).toBeGreaterThan(0);
    // Fully inside once it is scrolled to.
    expect(projectsShare(probe, 700, 800)).toBe(1);
  });
});

describe("the machine's own arithmetic", () => {
  it("puts the hologram on a 16:10 display — the canvas's own aspect, uncropped", () => {
    const canvas = HOLOGRAM_MAX[0] / HOLOGRAM_MAX[1];
    expect(canvas).toBeCloseTo(1.6, 10);
    // LAPTOP_BOUND is half the lid's width; the display inside it keeps the same ratio.
    expect(2.28 / 1.425).toBeCloseTo(canvas, 10);
  });

  it("opens from all but shut to a real working angle, smoothly", () => {
    expect(laptopLidAngle(0)).toBeCloseTo(LID_ANGLE.shut, 12);
    expect(laptopLidAngle(1)).toBeCloseTo(LID_ANGLE.open, 12);
    // Past vertical: a lid at 90° reads as a panel standing on a slab.
    expect(LID_ANGLE.open).toBeGreaterThan(Math.PI / 2);
    let last = laptopLidAngle(0);
    for (let x = 0.05; x <= 1.0001; x += 0.05) {
      const angle = laptopLidAngle(x);
      expect(angle).toBeGreaterThan(last);
      last = angle;
    }
  });

  it("leans the display back by as much as the body is pitched towards the camera", () => {
    // The pitch tips the display's normal down; the lean past vertical takes it back up, so the
    // screen ends up square to a camera that has no pitch of its own (choreography SCENE_CAMERA).
    expect(LID_ANGLE.open - Math.PI / 2).toBeCloseTo(LAPTOP_POSE.pitch, 1);
  });

  it("is centred on what it LIGHTS, not on its boxes", () => {
    // The pose pitches the deck towards the viewer, so its glow reaches further below the
    // geometric centre than the lid's does above it. `LIFT` is that difference, measured on the
    // page; without it the machine sits low in its window and the fit has to reserve air it
    // never uses. Pinned as a fact about the model, not as a number to trust.
    expect(LAPTOP_BOUND.halfHeight).toBeGreaterThan(0.7);
  });

  it("re-centres itself on its own reach", () => {
    // Half the object, not a typed-in number: the lid at its open angle is what makes it tall.
    expect(LAPTOP_BOUND.halfHeight).toBeGreaterThan(0.7);
    expect(LAPTOP_BOUND.halfWidth).toBeCloseTo(1.2, 10);
    // The pose's turned bound is what the window is fitted against, and it is bigger than the box.
    const turned =
      LAPTOP_BOUND.halfWidth * Math.cos(0.25) + LAPTOP_BOUND.halfDepth * Math.sin(0.25);
    expect(LAPTOP_LIT.halfWidth).toBeGreaterThan(turned);
    expect(LAPTOP_LIT.halfHeight).toBeGreaterThan(
      LAPTOP_BOUND.halfHeight * Math.cos(LAPTOP_POSE.pitch) +
        LAPTOP_BOUND.halfDepth * Math.sin(LAPTOP_POSE.pitch),
    );
  });

  it("runs a caret over the three key rows once a loop, one row at a time", () => {
    const lit = (t: number) => [0, 1, 2].map((row) => laptopKeyAt(t, row));
    expect(lit(0)).toEqual([0, 0, 0]);
    // Each row peaks alone.
    for (const row of [0, 1, 2]) {
      const t = 0.45 + row * 0.55 + 0.25;
      const values = lit(t);
      expect(values[row]).toBeGreaterThan(0.9);
      for (const other of [0, 1, 2]) if (other !== row) expect(values[other]).toBeLessThan(0.3);
    }
    // …and the rest of the loop is dark, so the object rests.
    expect(lit(LAPTOP_LOOP - 0.1)).toEqual([0, 0, 0]);
  });

  it("spends its one accent once, on the trackpad", () => {
    expect(laptopAccentAt(LAPTOP_ACCENT)).toBeCloseTo(1, 10);
    expect(laptopAccentAt(LAPTOP_ACCENT - 0.6)).toBeLessThan(0.01);
    expect(laptopAccentAt(LAPTOP_ACCENT + 0.6)).toBeLessThan(0.01);
    expect(laptopAccentAt(0)).toBeLessThan(0.01);
  });

  it("works the hinge only while the lid is moving", () => {
    expect(laptopHingeAt(0)).toBe(0);
    expect(laptopHingeAt(1)).toBe(0);
    expect(laptopHingeAt(0.5)).toBeCloseTo(1, 10);
    expect(laptopHingeAt(-3)).toBe(0);
    expect(laptopHingeAt(7)).toBe(0);
  });
});

/* ---- the arrival ---------------------------------------------------------------------------- */

describe("the boot sequence", () => {
  it("reads in the order the beats are written", () => {
    // Four movements, in order: the parts arrive, the body lights, the lid opens, the tube comes on.
    expect(LAPTOP_BOOT.assemble[0]).toBe(0);
    expect(LAPTOP_BOOT.surge[0]).toBeGreaterThan(LAPTOP_BOOT.assemble[0]);
    expect(LAPTOP_BOOT.lid[0]).toBeGreaterThanOrEqual(LAPTOP_BOOT.surge[0]);
    expect(LAPTOP_BOOT.crt[0]).toBeGreaterThan(LAPTOP_BOOT.lid[0]);
    expect(LAPTOP_BOOT.crt[1]).toBeLessThanOrEqual(LAPTOP_BOOT.lid[1]);
    expect(LAPTOP_BOOT.frames[0]).toBeGreaterThanOrEqual(LAPTOP_BOOT.crt[0]);
    expect(LAPTOP_BOOT.frames[1]).toBeLessThan(LAPTOP_BOOT.swap);
    expect(LAPTOP_BOOT.swap).toBeLessThan(LAPTOP_BOOT.total);
    expect(LAPTOP_BOOT.test[1]).toBeLessThanOrEqual(LAPTOP_BOOT.total);
    // The gate can be left before it can be armed again, or the arrival would replay while read.
    expect(LAPTOP_BOOT_GATE.off).toBeLessThan(LAPTOP_BOOT_GATE.on);
  });

  it("holds the lid shut before the sequence and open after it, with a settle in between", () => {
    expect(laptopBootLid(-1)).toBe(0);
    expect(laptopBootLid(0)).toBeCloseTo(0, 6);
    expect(laptopBootLid(LAPTOP_BOOT.lid[1])).toBe(1);
    expect(laptopBootLid(LAPTOP_BOOT.total)).toBe(1);
    // It carries a little past the top — mass, not a bounce — and comes back to exactly open.
    let peak = 0;
    for (let t = 0; t <= LAPTOP_BOOT.lid[1]; t += 0.01) peak = Math.max(peak, laptopBootLid(t));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.06);
  });

  it("opens the tube out of a hairline, inside the lid's own swing", () => {
    expect(laptopBootCrt(-1)).toBe(0);
    expect(laptopBootCrt(LAPTOP_BOOT.crt[0])).toBeCloseTo(0, 6);
    expect(laptopBootCrt(LAPTOP_BOOT.crt[1])).toBe(1);
    expect(laptopBootCrt(LAPTOP_BOOT.total)).toBe(1);
    const mid = laptopBootCrt((LAPTOP_BOOT.crt[0] + LAPTOP_BOOT.crt[1]) / 2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
  });

  it("steps through every boot frame once, and hands the display over at the swap", () => {
    expect(laptopBootFrame(0)).toBe(-1);
    expect(laptopBootFrame(LAPTOP_BOOT.frames[0] - 0.01)).toBe(-1);
    const seen = new Set<number>();
    for (let t = LAPTOP_BOOT.frames[0]; t < LAPTOP_BOOT.swap; t += 0.01) {
      const frame = laptopBootFrame(t);
      expect(frame).toBeGreaterThanOrEqual(0);
      expect(frame).toBeLessThan(LAPTOP_BOOT.frameCount);
      seen.add(frame);
    }
    expect(seen.size).toBe(LAPTOP_BOOT.frameCount);
    // From the swap on, the project owns the texture and no boot frame may overwrite it.
    expect(laptopBootFrame(LAPTOP_BOOT.swap)).toBe(-1);
    expect(laptopBootFrame(LAPTOP_BOOT.total)).toBe(-1);
  });

  it("runs the self-test one key row at a time", () => {
    for (const row of [0, 1, 2]) {
      const at = LAPTOP_BOOT.test[0] + row * LAPTOP_BOOT.testStep + LAPTOP_BOOT.testDwell / 2;
      const values = [0, 1, 2].map((other) => laptopBootTest(at, other));
      expect(values[row]).toBeGreaterThan(0.9);
      for (const other of [0, 1, 2]) if (other !== row) expect(values[other]).toBeLessThan(values[row]);
    }
    expect(laptopBootTest(-1, 0)).toBe(0);
    expect(laptopBootTest(LAPTOP_BOOT.total, 0)).toBe(0);
  });

  it("builds the machine onto a base that was always there", () => {
    // −1 is the base: the deck and its feet stand before the arrival and are left when it is stowed,
    // so the still is a composed object rather than an empty rectangle.
    expect(laptopBootAssemble(-1, -1, 10)).toBe(1);
    expect(laptopBootAssemble(0, -1, 10)).toBe(1);
    // Everything else is adrift before the sequence and in place after it.
    for (const order of [0, 4, 9]) {
      expect(laptopBootAssemble(-1, order, 10)).toBe(0);
      expect(laptopBootAssemble(LAPTOP_BOOT.assemble[1], order, 10)).toBe(1);
      expect(laptopBootAssemble(LAPTOP_BOOT.total, order, 10)).toBe(1);
    }
    // …and they land back to front, never all at once.
    const half = LAPTOP_BOOT.assemble[0] + LAPTOP_BOOT.assembleDwell / 2;
    expect(laptopBootAssemble(half, 0, 10)).toBeGreaterThan(laptopBootAssemble(half, 9, 10));
  });

  it("lands a piece with a ring, not with a stop", () => {
    expect(laptopBootSettle(-1)).toBe(0);
    expect(laptopBootSettle(0)).toBe(0);
    expect(laptopBootSettle(1)).toBe(1);
    // It carries past its slot and comes back: that overshoot is the whole difference between
    // "arrived" and "stopped", and it is what the client called abrupt when it was missing.
    let peak = 0;
    for (let a = 0; a < 1; a += 0.005) peak = Math.max(peak, laptopBootSettle(a));
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.3);
    // …and it crosses its slot more than once on the way down.
    let crossings = 0;
    let above = false;
    for (let a = 0.01; a < 1; a += 0.005) {
      const now = laptopBootSettle(a) > 1;
      if (now !== above) crossings += 1;
      above = now;
    }
    expect(crossings).toBeGreaterThan(1);
  });

  it("gives a piece from further out a longer flight", () => {
    // Uniform flights are what make a group read as mechanical.
    const near = LAPTOP_BOOT.assembleDwell * LAPTOP_BOOT.assembleNear;
    const t = LAPTOP_BOOT.assemble[0] + near * 0.999;
    expect(laptopBootAssemble(t, 0, 26, 0)).toBe(1);
    expect(laptopBootAssemble(t, 0, 26, 1)).toBeLessThan(1);
  });

  it("runs one band of light down the body, back to front", () => {
    expect(laptopBootSurge(-1, 0)).toBe(0);
    expect(laptopBootSurge(LAPTOP_BOOT.surge[0], 0)).toBe(0);
    expect(laptopBootSurge(LAPTOP_BOOT.surge[1], 1)).toBe(0);
    expect(laptopBootSurge(LAPTOP_BOOT.total, 0.5)).toBe(0);
    // The hinge lights before the lip, and each one peaks as the head reaches it.
    const [from, to] = LAPTOP_BOOT.surge;
    const early = from + (to - from) * 0.1;
    const late = from + (to - from) * 0.9;
    expect(laptopBootSurge(early, 0)).toBeGreaterThan(laptopBootSurge(early, 1));
    expect(laptopBootSurge(late, 1)).toBeGreaterThan(laptopBootSurge(late, 0));
  });

  it("draws boot frames that are furniture and never a word", async () => {
    const { ctx, texts } = recorder();
    for (let frame = 0; frame < LAPTOP_BOOT.frameCount; frame += 1) {
      composeLaptopBoot(ctx, [384, 240], frame, LAPTOP_BOOT.frameCount, 5);
    }
    // Not one glyph: a boot screen has no card to read a font off and no business owning copy.
    expect(texts).toEqual([]);
  });
});

/* ---- the display's box, and what is drawn on it --------------------------------------------- */

describe("the display inside the window", () => {
  it("runs the same fit the scene runs, so the hit area cannot drift off the screen", () => {
    const win = { w: 860, h: 576 };
    const box = laptopScreenBox(win.w, win.h)!;
    expect(box).not.toBeNull();
    const scale = Math.min(
      (win.w - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfWidth),
      (win.h - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfHeight),
    );
    // …the very scale `placeLaptop` produces for the same box.
    const place = placeLaptop(pageProbe({ x: 0, y: 2400, w: win.w, h: win.h }), 2400, 1280, 800)!;
    expect(scale).toBeCloseTo(place.scale / worldPerPx(800), 6);
    // the display sits above the window's centre, and inside it
    expect(box.y + box.h / 2).toBeLessThan(win.h / 2);
    expect(box.x).toBeGreaterThan(0);
    expect(box.y).toBeGreaterThan(0);
    expect(box.x + box.w).toBeLessThan(win.w);
    expect(box.y + box.h).toBeLessThan(win.h);
    // it is a real target, not a sliver
    expect(box.w).toBeGreaterThan(44);
    expect(box.h).toBeGreaterThan(44);
  });

  it("is generous by exactly the walk the pose gives it", () => {
    const box = laptopScreenBox(860, 576)!;
    const scale = (860 - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfWidth);
    const tall = (576 - 2 * LAPTOP_AIR) / (2 * LAPTOP_LIT.halfHeight);
    const fit = Math.min(scale, tall);
    expect(box.w).toBeCloseTo((LAPTOP_SCREEN.w + LAPTOP_SCREEN.slack) * fit, 6);
    expect(LAPTOP_SCREEN.slack).toBeGreaterThan(0);
  });

  it("has no box at all where the page lays no window out", () => {
    expect(laptopScreenBox(0, 0)).toBeNull();
    expect(laptopScreenBox(10, 10)).toBeNull();
  });
});

/**
 * A 2D context that records what was drawn. The same shape `scene-hologram.test.ts` uses for the
 * Work layout: nothing is rasterised, so what the screen SAYS can be asserted directly.
 */
function recorder() {
  const texts: string[] = [];
  const target: Record<string, unknown> = {
    canvas: { width: 384, height: 240 },
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    textAlign: "start",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    font: "10px sans-serif",
    measureText: (text: string) => ({ width: text.length * 5 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    fillText: (text: string) => texts.push(text),
    strokeText: (text: string) => texts.push(text),
  };
  for (const name of [
    "setTransform",
    "clearRect",
    "fillRect",
    "strokeRect",
    "drawImage",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "save",
    "restore",
    "translate",
  ]) {
    target[name] = () => {};
  }
  return { ctx: target as unknown as CanvasRenderingContext2D, texts };
}

/** A grid of project cards, exactly the shape DirectionPage renders. */
function cards(count: number): HTMLElement {
  const grid = document.createElement("div");
  grid.setAttribute(CTA_ATTR.link, "Vezi proiectul ↗");
  grid.setAttribute(CTA_ATTR.private, "fără link public");
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement(i === 0 ? "a" : "article");
    card.innerHTML =
      `<small>Tag ${i}</small><h3>Project ${i}</h3>` +
      `<p>A description of project ${i} that is long enough to need wrapping onto a second line and then some more.</p>`;
    grid.append(card);
  }
  document.body.append(grid);
  return grid;
}

describe("what the laptop's screen says", () => {
  it("writes the project's tag, name, description, place and call — as TEXT, not as pixels", async () => {
    const grid = cards(5);
    const { ctx, texts } = recorder();
    const result = await composeLaptopScreen(grid.children[2] as HTMLElement, ctx, [384, 240], 2);
    // No usable image in jsdom, so the screenshot band is absent — every word below is the
    // composer's own, drawn at the canvas's native resolution.
    expect(result).toBe("text");
    const said = texts.join(" | ");
    expect(said).toContain("PROJECT 2");
    expect(said).toContain("TAG 2");
    expect(said).toContain("03 / 05");
    expect(said).toMatch(/A description of project 2/);
    // …and two lines of it, the second ellipsised rather than cut off the edge.
    expect(texts.filter((t) => t.startsWith("A description") || /project 2/.test(t)).length).toBeGreaterThan(0);
    expect(said).toContain("…");
    grid.remove();
  });

  it("says what the page says about the link, in the page's own language", async () => {
    const grid = cards(3);
    const linked = recorder();
    await composeLaptopScreen(grid.children[0] as HTMLElement, linked.ctx, [384, 240], 0);
    expect(linked.texts.join(" | ")).toContain("VEZI PROIECTUL");

    const priv = recorder();
    await composeLaptopScreen(grid.children[1] as HTMLElement, priv.ctx, [384, 240], 1);
    const said = priv.texts.join(" | ");
    expect(said).toContain("FĂRĂ LINK PUBLIC");
    expect(said).not.toContain("VEZI PROIECTUL");
    grid.remove();
  });

  it("counts the reel off the grid itself, so it cannot disagree with the page", async () => {
    const grid = cards(2);
    const { ctx, texts } = recorder();
    await composeLaptopScreen(grid.children[1] as HTMLElement, ctx, [384, 240], 9);
    // The index argument is a fallback; the card's own place in the grid wins.
    expect(texts.join(" | ")).toContain("02 / 02");
    grid.remove();
  });

  it("never draws on a canvas larger than the cap, whatever it is handed", async () => {
    const grid = cards(2);
    const { ctx, texts } = recorder();
    await composeLaptopScreen(grid.children[0] as HTMLElement, ctx, [4096, 4096], 0);
    // `clampHologramSize` is what keeps a screenshot's fine print illegible; the layout is a
    // share of that canvas and nothing here can grow it.
    expect(texts.length).toBeGreaterThan(0);
    expect(HOLOGRAM_MAX[0]).toBe(384);
    expect(HOLOGRAM_MAX[1]).toBe(240);
    grid.remove();
  });
});

/* ---- the reel ------------------------------------------------------------------------------ */

function grid(count: number, images = true): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-projects-track", "");
  root.setAttribute(PROJECTS_INDEX_ATTR, "0");
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement(i % 2 === 0 ? "article" : "a");
    card.innerHTML = `<h3>P${i}</h3>`;
    if (images) {
      const img = document.createElement("img");
      img.setAttribute("src", `/projects/p${i}.png`);
      img.setAttribute("loading", "lazy");
      card.append(img);
    }
    root.append(card);
  }
  document.body.append(root);
  return root;
}

/** MutationObserver is async; the reel's records land on a microtask. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("the projects reel", () => {
  it("shows the project the page asked for, and nothing else decides", async () => {
    const root = grid(4);
    const reel = createProjectsReel({ grid: root });
    expect(reel.cards()).toHaveLength(4);
    expect(reel.pick()!.index).toBe(0);
    // The page owns the number: the cycle, the prev/next and the markers are all React state.
    root.setAttribute(PROJECTS_INDEX_ATTR, "2");
    await settle();
    expect(reel.pick()!.index).toBe(2);
    expect(reel.pick()!.card).toBe(reel.cards()[2]);
    reel.dispose();
    root.remove();
  });

  it("clamps an index the list has outrun rather than showing nothing", async () => {
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    root.setAttribute(PROJECTS_INDEX_ATTR, "9");
    await settle();
    expect(reel.pick()!.index).toBe(2);
    root.setAttribute(PROJECTS_INDEX_ATTR, "not a number");
    await settle();
    expect(reel.pick()!.index).toBe(0);
    reel.dispose();
    root.remove();
  });

  it("fetches the screenshots itself, because a hidden grid never will", () => {
    // Where the machine is live the grid is `display: none`, and a lazy image with no box is
    // never near the viewport: without this every project would compose text-only.
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    const images = Array.from(root.querySelectorAll("img"));
    expect(images.map((img) => img.getAttribute("loading"))).toEqual(["lazy", "lazy", "lazy"]);
    reel.warm();
    expect(images.map((img) => img.getAttribute("loading"))).toEqual(["eager", "eager", "eager"]);
    reel.dispose();
    root.remove();
  });

  it("re-collects the cards when the content document swaps them in", async () => {
    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    const before = reel.pick()!;
    expect(reel.cards()).toHaveLength(2);
    const extra = document.createElement("article");
    extra.innerHTML = "<h3>P9</h3>";
    root.insertBefore(extra, root.firstChild);
    await settle();
    expect(reel.cards()).toHaveLength(3);
    // A different list is a different picture: the world composes again.
    expect(reel.pick()!.generation).toBeGreaterThan(before.generation);
    reel.dispose();
    root.remove();
  });

  it("bumps the generation when a screenshot is replaced on a card React kept", async () => {
    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    const before = reel.pick()!;
    const card = reel.cards()[0];
    card.querySelector("img")!.setAttribute("src", "/projects/other.png");
    await settle();
    const after = reel.pick()!;
    // The very same element at the very same index — and still not the same project.
    expect(after.card).toBe(before.card);
    expect(after.index).toBe(before.index);
    expect(after.generation).toBeGreaterThan(before.generation);
    reel.dispose();
    root.remove();
  });

  it("re-warms the new screenshots a swap brought in", async () => {
    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    reel.warm();
    const extra = document.createElement("article");
    extra.innerHTML = '<h3>P9</h3><img src="/projects/p9.png" loading="lazy">';
    root.append(extra);
    await settle();
    expect(extra.querySelector("img")!.getAttribute("loading")).toBe("eager");
    reel.dispose();
    root.remove();
  });

  it("answers nothing at all once it is disposed, and with an empty grid", () => {
    const empty = document.createElement("div");
    document.body.append(empty);
    const bare = createProjectsReel({ grid: empty });
    expect(bare.pick()).toBeNull();
    bare.dispose();

    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    expect(reel.pick()).not.toBeNull();
    reel.dispose();
    expect(reel.pick()).toBeNull();
    root.remove();
    empty.remove();
  });
});
