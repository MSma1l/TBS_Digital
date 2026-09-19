import { describe, expect, it, vi } from "vitest";
import {
  LAPTOP_AIR,
  LAPTOP_LIT,
  placeLaptop,
  projectsShare,
  worldPerPx,
} from "@/components/scene/choreography";
import {
  PROJECTS_WINDOW,
  writeProjectsWindow,
} from "@/components/scene/scrollProbe";
import { PROJECTS_DWELL, createProjectsReel } from "@/components/scene/projectsReel";
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
import { HOLOGRAM_MAX } from "@/components/scene/three/hologram";
import { createScrollProbe, type ScrollProbe } from "@/lib/scene";

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

/* ---- the reel ------------------------------------------------------------------------------ */

function grid(count: number, images = true): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-projects-track", "");
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement(i % 2 === 0 ? "article" : "a");
    card.innerHTML = `<h3>P${i}</h3>`;
    if (images) {
      const img = document.createElement("img");
      img.setAttribute("src", `/projects/p${i}.png`);
      card.append(img);
    }
    root.append(card);
  }
  // The laptop's own cell: a child of the grid that is not a card and must never be picked.
  const stage = document.createElement("div");
  stage.setAttribute("data-scene-anchor", "projects");
  root.append(stage);
  document.body.append(root);
  return root;
}

/** MutationObserver is async; the reel's records land on a microtask. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("the projects reel", () => {
  it("picks the cards and not the laptop's own cell", () => {
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    expect(reel.cards()).toHaveLength(3);
    expect(reel.pick(0)!.index).toBe(0);
    reel.dispose();
    root.remove();
  });

  it("cycles one project at a time, in order, and wraps", () => {
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    expect(reel.pick(0)!.index).toBe(0);
    // Under the dwell nothing moves.
    expect(reel.pick(PROJECTS_DWELL - 0.5)!.index).toBe(0);
    expect(reel.pick(0.6)!.index).toBe(1);
    expect(reel.pick(PROJECTS_DWELL)!.index).toBe(2);
    expect(reel.pick(PROJECTS_DWELL)!.index).toBe(0);
    reel.dispose();
    root.remove();
  });

  it("puts the hovered card on the display, and resumes the cycle from it", () => {
    const root = grid(4);
    const reel = createProjectsReel({ grid: root });
    const cards = reel.cards();
    cards[2].dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(reel.held()).toBe(2);
    // Held for as long as the pointer is there, however much time passes.
    expect(reel.pick(PROJECTS_DWELL * 3)!.index).toBe(2);
    expect(reel.pick(PROJECTS_DWELL * 3)!.index).toBe(2);
    // Off the card into the row's gap: the grid itself answers −1.
    root.dispatchEvent(new Event("pointerover", { bubbles: false }));
    expect(reel.held()).toBe(-1);
    // …and the cycle goes on from the project the visitor was just looking at.
    expect(reel.pick(PROJECTS_DWELL)!.index).toBe(3);
    reel.dispose();
    root.remove();
  });

  it("answers the keyboard the same way, and settles on the card being tabbed TO", () => {
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    const cards = reel.cards();
    cards[1].dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(reel.pick(0)!.index).toBe(1);
    // focusout runs before the next focusin: tabbing on must not fall back to the cycle in between.
    cards[1].dispatchEvent(new Event("focusout", { bubbles: true }));
    cards[2].dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(reel.pick(0)!.index).toBe(2);
    cards[2].dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(reel.held()).toBe(-1);
    reel.dispose();
    root.remove();
  });

  it("prefers the pointer to a focus left behind by a click", () => {
    const root = grid(3);
    const reel = createProjectsReel({ grid: root });
    const cards = reel.cards();
    cards[0].dispatchEvent(new Event("focusin", { bubbles: true }));
    cards[2].dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(reel.pick(0)!.index).toBe(2);
    reel.dispose();
    root.remove();
  });

  it("re-collects the cards when the content document swaps them in", async () => {
    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    const before = reel.pick(0)!;
    expect(reel.cards()).toHaveLength(2);
    const extra = document.createElement("article");
    extra.innerHTML = "<h3>P9</h3>";
    root.insertBefore(extra, root.firstChild);
    await settle();
    expect(reel.cards()).toHaveLength(3);
    // A different list is a different picture: the world composes again.
    expect(reel.pick(0)!.generation).toBeGreaterThan(before.generation);
    reel.dispose();
    root.remove();
  });

  it("bumps the generation when a screenshot is replaced on a card React kept", async () => {
    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    const before = reel.pick(0)!;
    const card = reel.cards()[0];
    card.querySelector("img")!.setAttribute("src", "/projects/other.png");
    await settle();
    const after = reel.pick(0)!;
    // The very same element at the very same index — and still not the same project.
    expect(after.card).toBe(before.card);
    expect(after.index).toBe(before.index);
    expect(after.generation).toBeGreaterThan(before.generation);
    reel.dispose();
    root.remove();
  });

  it("answers nothing at all once it is disposed, and with an empty grid", () => {
    const empty = document.createElement("div");
    document.body.append(empty);
    const bare = createProjectsReel({ grid: empty });
    expect(bare.pick(1)).toBeNull();
    bare.dispose();

    const root = grid(2);
    const reel = createProjectsReel({ grid: root });
    expect(reel.pick(0)).not.toBeNull();
    reel.dispose();
    expect(reel.pick(0)).toBeNull();
    root.remove();
    empty.remove();
  });
});
