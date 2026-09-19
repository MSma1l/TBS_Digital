import { describe, expect, it } from "vitest";
import {
  BURST,
  COARSE_PARALLAX_MAX,
  CORE_BEHIND_COPY_BELOW,
  CORE_BEHIND_COPY_DIM,
  CORE_BEHIND_COPY_WIDE_FROM,
  HELIX_AMBIENT,
  HELIX_ARRIVE_LEAD,
  HELIX_REACH,
  HELIX_SLOT,
  HELIX_ZONE_FILL,
  MORPH_SECONDS,
  SCENE_CAMERA,
  SCENE_LAYOUTS,
  canvasDocTop,
  composeScene,
  coreExitPose,
  coreReveal,
  createComposition,
  createMorph,
  fitAnchor,
  helixArriveSpan,
  helixZoneTop,
  layoutFor,
  morphRunning,
  parallax,
  placeCore,
  placeHelixAmbient,
  placeHelixSpiral,
  placeServices,
  revealOf,
  smoothstep,
  stepMorph,
  swarmAlpha,
  swarmPhase,
  worldPerPx,
  type MorphState,
  type SceneComposition,
} from "@/components/scene/choreography";
import {
  ENTRY_SECONDS,
  createChangeSignal,
  createGate,
  createSceneFx,
  entryState,
  reportChange,
  stepGate,
  stepSceneFx,
  WAVE_GAP_SECONDS,
  WORK_SECONDS,
} from "@/components/scene/fx";
import { HELIX_LAYOUT } from "@/components/scene/helix";
import { CHIP, HELIX, MODEL_RADIUS } from "@/components/scene/shapes";
import {
  COMMERCE_GATE_RADIUS,
  HELIX_PARTS,
  commerceGateFrame,
  commerceGatePoint,
  helixSamples,
  swarmSlots,
} from "@/components/scene/three/samples";
import { SCENE_TIER_CONFIG } from "@/components/scene/tiers";
import { mulberry32 } from "@/components/three/random";
import { SCENE_SHAPES, SERVICE_MODEL, createScrollProbe, type SceneEntry, type ScrollProbe } from "@/lib/scene";

/*
 * The interior scene's choreography as numbers: where the core and the service models sit on
 * the canvas, how the scroll moves them, how a morph runs, and what each frame draws. All of
 * it is pure (no three.js, no DOM), so the scene's motion is pinned here rather than in a
 * WebGL screenshot.
 */

/** A probe shaped like the real page at 1280×800 (header 71px). */
function desktopProbe(): ScrollProbe {
  const probe = createScrollProbe();
  probe.live = true;
  probe.version = 1;
  probe.headerH = 71;
  probe.stage = { top: 71, bottom: 1678 };
  probe.hero = { x: 702, y: 167, w: 538, h: 538 };
  probe.services = { x: 610, y: 1126, w: 630, h: 248 };
  probe.heroExit = { start: 71, end: 520 };
  // The services anchor "top 90%" → "top 75%" of the 800px viewport.
  probe.entry = { start: 406, end: 526 };
  return probe;
}

describe("scene space — fit and parallax", () => {
  it("maps canvas pixels onto the z = 0 plane of the fixed camera", () => {
    expect(worldPerPx(729)).toBeCloseTo((2 * SCENE_CAMERA.z * Math.tan((SCENE_CAMERA.fov * Math.PI) / 360)) / 729, 12);
    expect(worldPerPx(0)).toBe(worldPerPx(1));
  });

  it("puts a host centred on the canvas at the origin, filling its box", () => {
    const fit = fitAnchor(1280, 729, 640, 364.5, 400, 2, 1);
    expect(fit.x).toBe(0);
    expect(fit.y).toBe(0);
    expect((fit.scale * 2) / worldPerPx(729)).toBeCloseTo(200, 6);
  });

  it("never lets a model grow past 45% of the canvas's short side", () => {
    const fit = fitAnchor(1280, 400, 640, 200, 2000, 2, 1);
    expect((fit.scale * 2) / worldPerPx(400)).toBeCloseTo(0.45 * 400, 6);
  });

  it("y grows upwards: a host above the centre sits at positive y", () => {
    expect(fitAnchor(1000, 800, 500, 100, 100, 1, 1).y).toBeGreaterThan(0);
    expect(fitAnchor(1000, 800, 900, 400, 100, 1, 1).x).toBeGreaterThan(0);
  });

  it("parallax is the DOM position at factor 1 and the rest position at factor 0", () => {
    expect(parallax(120, 400, 1)).toBe(120);
    expect(parallax(120, 400, 0)).toBe(400);
    expect(parallax(400, 400, 0.55)).toBe(400);
  });
});

describe("scene space — layouts", () => {
  it("portrait phones, tablets and desktops", () => {
    expect(layoutFor(390, 844, true).kind).toBe("portrait");
    expect(layoutFor(768, 1024, true).kind).toBe("tablet");
    expect(layoutFor(844, 390, true).kind).toBe("tablet");
    expect(layoutFor(1280, 800, false).kind).toBe("desktop");
    expect(layoutFor(1024, 768, false).kind).toBe("tablet");
  });

  it("caps every parallax factor on a touch screen", () => {
    const coarse = layoutFor(1280, 800, true);
    expect(coarse.core.parallax).toBeLessThanOrEqual(COARSE_PARALLAX_MAX);
    expect(coarse.services.parallax).toBeLessThanOrEqual(COARSE_PARALLAX_MAX);
    expect(layoutFor(1280, 800, false)).toBe(SCENE_LAYOUTS.desktop);
  });

  it("dims the core wherever it sits behind the copy (below 861px), whatever the orientation and theme", () => {
    // Hero's one-column layout (max-md): the core is under the headline and the lead.
    expect(CORE_BEHIND_COPY_BELOW).toBe(861);
    expect(CORE_BEHIND_COPY_WIDE_FROM).toBe(641);
    const { narrow, wide } = CORE_BEHIND_COPY_DIM;
    // The values measured over the forced WebGL chip, text hidden, 12 frames per case (R31; the
    // numbers are in choreography.ts): the wide band dropped from 0.35 / 0.3 with the chip.
    expect(CORE_BEHIND_COPY_DIM).toEqual({ narrow: { glow: 0.55, ink: 0.4 }, wide: { glow: 0.25, ink: 0.15 } });
    // Never brighter than the portrait layout's own dim; ink (dark strokes under dark text)
    // dimmer than glow; the wide band (a chip centred under the lead) dimmer than phones.
    for (const band of [narrow, wide]) {
      expect(band.glow).toBeLessThanOrEqual(SCENE_LAYOUTS.portrait.core.dim);
      expect(band.ink).toBeLessThan(band.glow);
    }
    expect(wide.glow).toBeLessThan(narrow.glow);
    expect(wide.ink).toBeLessThan(narrow.ink);

    for (const [w, h, band] of [
      [320, 568, narrow],
      [375, 812, narrow],
      [390, 844, narrow],
      [412, 915, narrow],
      [640, 1000, narrow],
      [641, 900, wide],
      [768, 1024, wide],
      [844, 390, wide],
      [860, 1200, wide],
    ] as const) {
      for (const coarse of [true, false]) {
        expect(layoutFor(w, h, coarse, false).core.dim, `${w}×${h} glow`).toBe(band.glow);
        expect(layoutFor(w, h, coarse, true).core.dim, `${w}×${h} ink`).toBe(band.ink);
      }
    }
    // The default is glow.
    expect(layoutFor(768, 1024, false).core.dim).toBe(wide.glow);

    // Only the brightness changes: a tablet stays a tablet, with its own fill and parallax.
    const tablet = layoutFor(768, 1024, false, true);
    expect(tablet.kind).toBe("tablet");
    expect(tablet.core).toEqual({ ...SCENE_LAYOUTS.tablet.core, dim: wide.ink });
    expect(tablet.services).toEqual(SCENE_LAYOUTS.tablet.services);
    // From 861px the copy and the core have their own columns: the layouts' own values, both themes.
    expect(layoutFor(861, 1000, false)).toBe(SCENE_LAYOUTS.tablet);
    expect(layoutFor(861, 1000, false, true)).toBe(SCENE_LAYOUTS.tablet);
    expect(layoutFor(1024, 768, false, true).core.dim).toBe(SCENE_LAYOUTS.tablet.core.dim);
    expect(layoutFor(1280, 800, false, true)).toBe(SCENE_LAYOUTS.desktop);
    expect(layoutFor(390, 844, false)).toBe(SCENE_LAYOUTS.portrait);
    // The exit still brightens it towards 0.9 as the copy scrolls away.
    expect(coreExitPose(1, tablet).dim).toBeCloseTo(0.9, 12);
    expect(coreExitPose(0, tablet).dim).toBe(wide.ink);
  });

  it("the hero exit shrinks the chip, lifts it apart (exploded view) and brightens a dimmed phone chip", () => {
    const portrait = SCENE_LAYOUTS.portrait;
    expect(coreExitPose(0, portrait)).toEqual({ scale: 1, lift: 0, dim: portrait.core.dim });
    const half = coreExitPose(0.5, portrait);
    expect(half.lift).toBe(0.5);
    expect(half.scale).toBeCloseTo(0.825, 12);
    const out = coreExitPose(1, portrait);
    expect(out.scale).toBeCloseTo(0.65, 12);
    expect(out.lift).toBe(1);
    expect(out.dim).toBeCloseTo(0.9, 12);
    expect(coreExitPose(7, portrait)).toEqual(out);
    expect(coreExitPose(-3, portrait)).toEqual({ scale: 1, lift: 0, dim: portrait.core.dim });
    // Written into the pose it is given (no allocation per frame).
    const pose = { scale: 0, lift: 0, dim: 0 };
    expect(coreExitPose(0.2, portrait, pose)).toBe(pose);
  });

  it("the chip dissolves as the hero leaves: whole until 60% of the exit, gone at its end", () => {
    for (const e of [-1, 0, 0.3, 0.6]) expect(coreReveal(e)).toBe(1);
    for (const e of [1, 1.5]) expect(coreReveal(e)).toBe(0);
    expect(coreReveal(0.8)).toBeCloseTo(1 - smoothstep(0.6, 1, 0.8), 12);
    expect(coreReveal(0.8)).toBeCloseTo(0.5, 12);
    let previous = 1;
    for (let e = 0; e <= 1.0001; e += 0.01) {
      expect(coreReveal(e)).toBeLessThanOrEqual(previous + 1e-12);
      previous = coreReveal(e);
    }
  });
});

describe("scene space — the sticky canvas and its hosts", () => {
  const h = 729;

  it("before the director measured, the canvas counts as stuck to the viewport top", () => {
    const probe = createScrollProbe();
    expect(canvasDocTop(300, probe, h)).toBe(300);
    expect(placeServices(probe, 300, 1280, h, SCENE_LAYOUTS.desktop)).toBeNull();
    expect(Number.isFinite(placeCore(probe, 0, 1280, h, SCENE_LAYOUTS.desktop).scale)).toBe(true);
  });

  it("rests at the stage top, sticks under the header, leaves with the stage bottom", () => {
    const probe = desktopProbe();
    expect(canvasDocTop(0, probe, h)).toBe(71);
    expect(canvasDocTop(500, probe, h)).toBe(571);
    expect(canvasDocTop(5000, probe, h)).toBe(probe.stage.bottom - h);
    expect(canvasDocTop(Number.NaN, probe, h)).toBe(71);
  });

  it("at scroll 0 the core sits exactly on its DOM host", () => {
    const probe = desktopProbe();
    const hero = probe.hero!;
    const place = placeCore(probe, 0, 1280, h, SCENE_LAYOUTS.desktop);
    const expected = fitAnchor(1280, h, hero.x + hero.w / 2, hero.y + hero.h / 2 - 71, hero.w, CHIP.R, SCENE_LAYOUTS.desktop.core.fill);
    expect(place.x).toBeCloseTo(expected.x, 9);
    expect(place.y).toBeCloseTo(expected.y, 9);
    expect(place.scale).toBeCloseTo(expected.scale, 9);
  });

  it("scrolling moves the core up slower than the page (depth, not lag)", () => {
    const probe = desktopProbe();
    const k = worldPerPx(h);
    const rest = placeCore(probe, 0, 1280, h, SCENE_LAYOUTS.desktop);
    const moved = placeCore(probe, 200, 1280, h, SCENE_LAYOUTS.desktop);
    const pixels = (moved.y - rest.y) / k;
    expect(pixels).toBeCloseTo(200 * SCENE_LAYOUTS.desktop.core.parallax, 6);
    expect(moved.x).toBe(rest.x);
  });

  it("a services host centred in the canvas lands at y = 0", () => {
    const probe = desktopProbe();
    const services = probe.services!;
    // canvas top (scroll + 71) such that the host's centre is at h / 2
    const scroll = services.y + services.h / 2 - h / 2 - 71;
    const place = placeServices(probe, scroll, 1280, h, SCENE_LAYOUTS.desktop)!;
    expect(place.y).toBeCloseTo(0, 9);
    expect(place.scale).toBeGreaterThan(0);
    expect(place.scale * MODEL_RADIUS).toBeLessThanOrEqual(0.45 * h * worldPerPx(h) + 1e-9);
  });
});

describe("scene space — the Work helix", () => {
  /** 1280×800 with nine cards: the track grown to one layer plus eight 304px steps (workHelix.ts). */
  function workProbe(): ScrollProbe {
    const probe = desktopProbe();
    probe.layerH = 729;
    probe.stage = { top: 71, bottom: 6240 };
    probe.work = { x: 64, y: 2600, w: 1152, h: 729 + 8 * 304 };
    probe.workHead = { x: 64, y: 2380, w: 1152, h: 150 };
    probe.workGap = { x: 0, y: 2280, w: 1280, h: 100 };
    return probe;
  }
  const h = 729;
  const k = worldPerPx(h);

  it("the sticky zone: at the track's top until the track reaches the header, under the header, then at the track's end", () => {
    const track = workProbe().work!;
    const end = track.y + track.h - 729;
    expect(helixZoneTop(track, 0, 71, 729)).toBe(2600);
    expect(helixZoneTop(track, 2529, 71, 729)).toBe(2600);
    expect(helixZoneTop(track, 3000, 71, 729)).toBe(3071);
    expect(helixZoneTop(track, end - 71, 71, 729)).toBe(end);
    expect(helixZoneTop(track, 99_999, 71, 729)).toBe(end);
    expect(helixZoneTop(track, Number.NaN, 71, 729)).toBe(2600);
    // A track shorter than one zone never lets it rise above its own top.
    expect(helixZoneTop({ ...track, h: 300 }, 3000, 71, 729)).toBe(2600);
  });

  it("spiral: on the cards' axis (cx of the track), centred on the zone, as tall as HELIX_ZONE_FILL of it", () => {
    const probe = workProbe();
    const axis = (64 + 0.34 * 1152 - 1280 / 2) * k;
    // Inside the span the zone and the canvas are both stuck under the header: the helix holds still.
    for (const scrollY of [2600, 3400, 4600]) {
      const place = placeHelixSpiral(probe, scrollY, 1280, h, 0.34)!;
      expect(place.x).toBeCloseTo(axis, 9);
      expect(place.y).toBeCloseTo(0, 9);
      expect((place.scale * HELIX.height) / k).toBeCloseTo(HELIX_ZONE_FILL * 729, 6);
    }
    // Before the zone sticks (the track scrolling in) and past its end (the last card leaving) it
    // moves up the stuck canvas exactly with the page; once the stage itself leaves, the canvas
    // carries it away (it holds still on the canvas).
    for (const [a, b, moved] of [
      [2000, 2100, 100],
      [5000, 5100, 100],
      [5600, 5700, 0],
    ]) {
      const from = placeHelixSpiral(probe, a, 1280, h, 0.34)!;
      const to = placeHelixSpiral(probe, b, 1280, h, 0.34)!;
      expect((to.y - from.y) / k, `${a} → ${b}`).toBeCloseTo(moved, 6);
      expect(to.x).toBe(from.x);
    }
    // Written into `out`; nothing measured, no track: null. An unmeasured layer counts as the canvas.
    const out = { x: 0, y: 0, scale: 0 };
    expect(placeHelixSpiral(probe, 3400, 1280, h, 0.34, out)).toBe(out);
    expect(placeHelixSpiral(createScrollProbe(), 3400, 1280, h, 0.34)).toBeNull();
    expect(placeHelixSpiral(desktopProbe(), 3400, 1280, h, 0.34)).toBeNull();
    const unmeasured = { ...workProbe(), layerH: 0 };
    expect(placeHelixSpiral(unmeasured, 3400, 1280, h, 0.34)).toEqual(placeHelixSpiral(probe, 3400, 1280, h, 0.34));
  });

  it("the cards ride the strand: its drawn radius meets their orbit, and one radius cannot do it at every aspect", () => {
    /* The world fits the model by the zone's HEIGHT and the cards orbit by its WIDTH, so the
       radius that would put a card exactly on the strand's cylinder is `6 · orbit / zoneH` and
       changes with the aspect. These are the three widths the spiral is checked at. */
    const ride = (zoneW: number, zoneH: number) => {
      const pxPerUnit = (HELIX_ZONE_FILL * zoneH) / HELIX.height;
      const orbit = Math.min(HELIX_LAYOUT.orbit[0] * zoneW, HELIX_LAYOUT.orbit[1]);
      return { pxPerUnit, orbit, strand: HELIX.radius * pxPerUnit, needed: orbit / pxPerUnit };
    };
    const desktop = ride(1200, 729);
    const tablet = ride(944, 697);
    const narrow = ride(792, 629);
    expect([desktop.pxPerUnit, desktop.orbit]).toEqual([121.5, 228]);
    expect(desktop.needed).toBeCloseTo(1.877, 2);
    expect(tablet.needed).toBeCloseTo(1.544, 2);
    expect(narrow.needed).toBeCloseTo(1.436, 2);

    // 1.45 is the ride at the square end and most of the way at the wide one — never short of
    // three quarters, so the strand passes inside every card's silhouette at every width.
    for (const [name, at] of [["desktop", desktop], ["tablet", tablet], ["narrow", narrow]] as const) {
      expect(at.strand / at.orbit, name).toBeGreaterThan(0.75);
      expect(at.strand / at.orbit, name).toBeLessThan(1.15);
    }
    // It really did come out to meet them: it used to draw at less than half their orbit.
    expect((0.9 * desktop.pxPerUnit) / desktop.orbit).toBeLessThan(0.5);
    expect(desktop.strand).toBeCloseTo(176.2, 1);

    /* And it cannot go further: the hologram's panel is what it reaches first, at the NARROWEST
       spiral zone. The chips ride `chip.lift` + half a box outside the strand. */
    const chipReach = HELIX.radius + HELIX_PARTS.chip.lift + Math.hypot(HELIX_PARTS.chip.width, HELIX_PARTS.chip.thickness) / 2;
    const panelGap = (0.76 - HELIX_LAYOUT.cx) * 792 - Math.min(0.34 * 792, 440) / 2;
    expect(chipReach * narrow.pxPerUnit).toBeLessThan(panelGap);
    // The radius that rides at 1280×800 does not fit there — it is the measured cap on one constant.
    expect((1.877 + HELIX_PARTS.chip.lift + 0.048) * narrow.pxPerUnit).toBeGreaterThan(panelGap);
  });

  it("the arrival arms 0.30 of a layer above the sticky line, so the helix is never off screen while it plays", () => {
    expect(HELIX_ARRIVE_LEAD).toBe(0.3);
    const probe = workProbe();
    // Work's own band, "top 70%" → "top 55%" of the 800px viewport, from the track's top.
    probe.workSpan = { start: 2600 - 560, end: 2600 - 440 };
    const span = helixArriveSpan(probe)!;
    // Armed 0.3 × 729 above the scroll at which the zone sticks under the header (2600 − 71).
    expect(span.end).toBeCloseTo(2600 - 71 - 0.3 * 729, 9);
    expect(span.end).toBeCloseTo(2310.3, 9);
    // …and only disarmed a whole screen higher, where the gate used to arm.
    expect(span.start).toBe(2040);
    expect(span.start).toBeLessThan(span.end);

    /* The picture this buys, from `placeHelixSpiral` itself: at the arming line the helix's
       centre is 583px down a 729px layer — 72% of its 656px drawn height on screen, its middle
       (where the replication bubble opens) well inside it — and it is dead centre for every
       scroll after the zone sticks, i.e. for the whole rest of the section. */
    const centre = (scrollY: number) => 729 / 2 - placeHelixSpiral(probe, scrollY, 1280, h, 0.34)!.y / k;
    expect(centre(span.end)).toBeCloseTo(583.2, 6);
    expect(centre(span.end) - (HELIX_ZONE_FILL * 729) / 2).toBeGreaterThan(0);
    for (const scrollY of [2529, 2600, 3400, 4600]) expect(centre(scrollY)).toBeCloseTo(364.5, 6);

    // Written into `out`; nothing measured, or no track: null (the gate then never opens).
    const out = { start: -1, end: -1 };
    expect(helixArriveSpan(probe, out)).toBe(out);
    expect(helixArriveSpan(createScrollProbe())).toBeNull();
    expect(helixArriveSpan(desktopProbe())).toBeNull();
    // An unmeasured layer falls back to the sticky line itself, never below the disarm line.
    const unmeasured = { ...workProbe(), layerH: 0, workSpan: { start: 9999, end: 9999 } };
    expect(helixArriveSpan(unmeasured)).toEqual({ start: 2529, end: 2529 });
  });

  it("ambient: lying in the band above Work's heading, centred on it, 0.6 of the width long, clear of the band's edges and never over 120px tall", () => {
    expect(HELIX_AMBIENT).toEqual({ length: 0.6, maxPx: 120, clear: 10 });
    // The strands and chips (radius + 0.1) and the 0/1 bits (1.2 plus half a glyph) all fit in the reach.
    expect(HELIX_REACH).toBe(1.56);
    expect(HELIX_REACH).toBeGreaterThan(HELIX.radius + 0.1);
    const phone = 780;
    const kp = worldPerPx(phone);
    const binding: string[] = [];
    for (const [w, band] of [
      [320, 84],
      [390, 84],
      [412, 84],
      [640, 84],
      [767, 90],
      [320, 400],
    ] as const) {
      const probe = workProbe();
      probe.headerH = 64;
      probe.layerH = phone;
      probe.stage = { top: 64, bottom: 4000 };
      probe.workHead = { x: 16, y: 2380, w: w - 32, h: 190 };
      probe.workGap = { x: 0, y: 2380 - band, w, h: band };
      const scrollY = 2200;
      const place = placeHelixAmbient(probe, scrollY, w, phone)!;
      const length = (place.scale * HELIX.height) / kp;
      const tall = (place.scale * 2 * HELIX_REACH) / kp;
      expect(length, `${w}`).toBeLessThanOrEqual(0.6 * w + 1e-6);
      expect(tall, `${w}`).toBeLessThanOrEqual(Math.min(120, band - 20) + 1e-6);
      binding.push(Math.abs(length - 0.6 * w) < 1e-6 ? "length" : Math.abs(tall - Math.min(120, band - 20)) < 1e-6 ? "band" : "none");
      expect(place.x).toBeCloseTo(0, 9);
      // The band's centre, in the canvas stuck under the header: never the heading's.
      expect(place.y).toBeCloseTo(-(2380 - band / 2 - (scrollY + 64) - phone / 2) * kp, 9);
    }
    // The ~84px band binds a phone's helix (64px tall); in a tall band on a narrow phone the
    // length binds again. A wider molecule (HELIX.radius 1.45) fills a band's thickness sooner,
    // so the crossover moved: at 390px wide the band now binds even at 400px tall.
    expect(binding).toEqual(["band", "band", "band", "band", "band", "length"]);
    // A band too thin for any helix gives scale 0; nothing measured, or no Work: null.
    const thin = workProbe();
    thin.workGap = { x: 0, y: 2370, w: 390, h: 12 };
    expect(placeHelixAmbient(thin, 2200, 390, phone)!.scale).toBe(0);
    expect(placeHelixAmbient(createScrollProbe(), 0, 390, phone)).toBeNull();
    expect(placeHelixAmbient(desktopProbe(), 0, 390, phone)).toBeNull();
    const noGap = workProbe();
    noGap.workGap = null;
    expect(placeHelixAmbient(noGap, 2200, 390, phone)).toBeNull();
  });
});

/* ---- morph -------------------------------------------------------------------------------- */

const DISSOLVE_RATE = 0.5 / MORPH_SECONDS.dissolve;

function run(state: MorphState, target: number, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds - 1e-9; t += dt) stepMorph(state, target, dt);
}

describe("morph — stepMorph", () => {
  it("does nothing while formed on its target", () => {
    const m = createMorph(2);
    stepMorph(m, 2, 0.05);
    expect(m).toEqual({ from: 2, to: 2, t: 0 });
    expect(morphRunning(m)).toBe(false);
  });

  it("starts, crosses the cloud and commits seamlessly", () => {
    const m = createMorph(0);
    stepMorph(m, 3, 0.02);
    expect(m.from).toBe(0);
    expect(m.to).toBe(3);
    expect(m.t).toBeCloseTo(0.02 * DISSOLVE_RATE, 12);
    expect(morphRunning(m)).toBe(true);
    run(m, 3, MORPH_SECONDS.dissolve + MORPH_SECONDS.reform + 0.1);
    expect(m).toEqual({ from: 3, to: 3, t: 0 });
  });

  it("a new target while dissolving only replaces `to`", () => {
    const m = createMorph(0);
    run(m, 1, 0.1);
    const t = m.t;
    expect(t).toBeLessThan(0.5);
    stepMorph(m, 4, 0);
    expect(m.to).toBe(4);
    expect(m.t).toBe(t);
  });

  it("going back to `from` while dissolving re-forms it the way it came", () => {
    const m = createMorph(0);
    run(m, 1, 0.1);
    const t = m.t;
    stepMorph(m, 0, 0.02);
    expect(m.t).toBeLessThan(t);
    expect(m.to).toBe(1);
    run(m, 0, 1);
    expect(m).toEqual({ from: 0, to: 0, t: 0 });
  });

  it("a new target while re-forming walks back to the cloud, then heads for it", () => {
    const m = createMorph(0);
    run(m, 1, MORPH_SECONDS.dissolve + 0.15);
    expect(m.t).toBeGreaterThan(0.5);
    const t = m.t;
    stepMorph(m, 2, 0.02);
    expect(m.t).toBeLessThan(t);
    expect(m.to).toBe(1);
    run(m, 2, 0.5);
    expect(m.to).toBe(2);
    run(m, 2, 2);
    expect(m).toEqual({ from: 2, to: 2, t: 0 });
  });

  it("the worst case (switching mid re-form) settles well under 1.5 s", () => {
    const m = createMorph(0);
    run(m, 1, MORPH_SECONDS.dissolve + MORPH_SECONDS.reform * 0.9);
    let seconds = 0;
    while (morphRunning(m) && seconds < 5) {
      stepMorph(m, 4, 1 / 60);
      seconds += 1 / 60;
    }
    expect(m).toEqual({ from: 4, to: 4, t: 0 });
    expect(seconds).toBeLessThan(1.5);
  });

  it("instant jumps straight to the target, formed", () => {
    const m = createMorph(0);
    run(m, 1, 0.2);
    stepMorph(m, 3, 0.02, true);
    expect(m).toEqual({ from: 3, to: 3, t: 0 });
  });

  it("clamps a hitch: one huge step never jumps more than a 20 Hz frame", () => {
    const m = createMorph(0);
    stepMorph(m, 1, 10);
    expect(m.t).toBeCloseTo(DISSOLVE_RATE / 20, 12);
    stepMorph(m, 1, Number.NaN);
    expect(m.t).toBeCloseTo(DISSOLVE_RATE / 20, 12);
  });

  it("property: a swarm particle never jumps, whatever the targets and frame times", () => {
    const random = mulberry32(0x5eed);
    const shapePos = [0, 11, -17, 23, -29];
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
    const cloud = 3;
    const position = (m: MorphState, w: number) => {
      const { leave, arrive } = swarmPhase(m.t, w);
      return m.t < 0.5
        ? shapePos[m.from] + (cloud - shapePos[m.from]) * ease(leave)
        : cloud + (shapePos[m.to] - cloud) * ease(arrive);
    };
    // |d position / d t| ≤ distance · max ease slope (3) · 2 / 0.65; t moves ≤ its fastest rate.
    const maxDistance = 32;
    const bound = maxDistance * 3 * (2 / 0.65) * Math.max(DISSOLVE_RATE, 0.5 / MORPH_SECONDS.reform);
    let worst = 0;
    for (let run = 0; run < 500; run += 1) {
      const m = createMorph(Math.floor(random() * 5));
      const w = random();
      let target = m.from;
      let previous = position(m, w);
      for (let step = 0; step < 120; step += 1) {
        if (random() < 0.08) target = Math.floor(random() * 5);
        const dt = 0.001 + random() * 0.049;
        stepMorph(m, target, dt);
        const next = position(m, w);
        worst = Math.max(worst, Math.abs(next - previous) / (bound * dt));
        previous = next;
      }
    }
    expect(worst).toBeLessThanOrEqual(1 + 1e-9);
  });
});

describe("morph — who draws what (composeScene)", () => {
  /** How much of the swarm is on screen: the shader's alpha while it is drawn, 0 when not. */
  const swarmDrawn = (plan: SceneComposition) => (plan.swarm.active ? swarmAlpha(plan.swarm.t) : 0);

  it("above the services (entry 0): nothing drawn", () => {
    const plan = composeScene(0, 0, createMorph(2), createComposition());
    expect(plan.swarm).toEqual({ active: false, from: 0, to: 0, t: 0 });
    for (let index = 0; index < SCENE_SHAPES.length; index += 1) expect(revealOf(plan, index)).toBe(0);
  });

  it("the entrance bursts the selected model out of a speck and reveals it over the last stretch", () => {
    expect(BURST).toBe(-1);
    const plan = composeScene(0.6, 0, createMorph(3), createComposition());
    expect(plan.swarm).toEqual({ active: true, from: BURST, to: 4, t: 0.6 });
    expect(revealOf(plan, 3)).toBe(0);
    expect(composeScene(0.85, 0, createMorph(3), createComposition()).models).toEqual([
      { index: 3, reveal: smoothstep(0.72, 1, 0.85) },
      { index: 3, reveal: 0 },
    ]);
    // Imploding runs the same picture backwards; out of range is clamped.
    expect(composeScene(0.3, 0, createMorph(1), createComposition()).swarm).toEqual({ active: true, from: BURST, to: 2, t: 0.3 });
    expect(composeScene(-2, 0, createMorph(1), createComposition()).swarm.active).toBe(false);
    expect(composeScene(7, 0, createMorph(1), createComposition())).toEqual(composeScene(1, 0, createMorph(1), createComposition()));
  });

  it("formed and not morphing: the selected model alone, no swarm", () => {
    const plan = composeScene(1, 0, createMorph(4), createComposition());
    expect(plan.swarm.active).toBe(false);
    expect(revealOf(plan, 4)).toBe(1);
    for (const index of [0, 1, 2, 3]) expect(revealOf(plan, index)).toBe(0);
  });

  it("once formed the morph owns the swarm, and the reveals cross over", () => {
    const m: MorphState = { from: 0, to: 2, t: 0.2 };
    const plan = composeScene(1, 0, m, createComposition());
    expect(plan.swarm).toEqual({ active: true, from: 1, to: 3, t: 0.2 });
    expect(revealOf(plan, 0)).toBeCloseTo(1 - smoothstep(0, 0.3, 0.2), 12);
    expect(revealOf(plan, 2)).toBe(0);
    // just before the commit the new model is formed, exactly as after it
    const late = composeScene(1, 0, { from: 0, to: 2, t: 1 - 1e-9 }, createComposition());
    expect(revealOf(late, 2)).toBeCloseTo(1, 6);
    expect(revealOf(late, 0)).toBe(0);
  });

  it("property: continuous where the burst hands over to the formed model (entry → 1) and where the implosion ends (entry → 0)", () => {
    // While entry < 1 the morph is instant (world.ts), so the entrance always meets a formed morph.
    // Both sides agree to second order: the model's reveal and the swarm's alpha are smoothsteps,
    // flat at those ends (|Δ| ≤ 3·(ε/0.28)² and 3·(ε/0.12)²).
    for (let shape = 0; shape < SCENE_SHAPES.length; shape += 1) {
      const m = createMorph(shape);
      const formed = composeScene(1, 0, m, createComposition());
      const idle = composeScene(0, 0, m, createComposition());
      for (const eps of [1e-2, 1e-3, 1e-4, 1e-6]) {
        const bound = 300 * eps * eps;
        const arriving = composeScene(1 - eps, 0, m, createComposition());
        const leaving = composeScene(eps, 0, m, createComposition());
        for (let index = 0; index < SCENE_SHAPES.length; index += 1) {
          expect(Math.abs(revealOf(arriving, index) - revealOf(formed, index)), `shape ${shape} → 1`).toBeLessThanOrEqual(bound);
          expect(Math.abs(revealOf(leaving, index) - revealOf(idle, index)), `shape ${shape} → 0`).toBeLessThanOrEqual(bound);
        }
        expect(swarmDrawn(arriving)).toBeLessThanOrEqual(bound);
        expect(swarmDrawn(leaving)).toBeLessThanOrEqual(bound);
      }
      expect(swarmDrawn(formed)).toBe(0);
      expect(swarmDrawn(idle)).toBe(0);
      // Mid-burst the swarm really is on screen.
      expect(swarmDrawn(composeScene(0.5, 0, m, createComposition()))).toBe(1);
    }
  });

  it("writes into the composition it is given (no allocation per frame)", () => {
    const out = createComposition();
    expect(composeScene(0.3, 0, createMorph(0), out)).toBe(out);
    expect(composeScene(1, 0, { from: 1, to: 2, t: 0.4 }, out)).toBe(out);
    expect(composeScene(1, 0.4, createMorph(3), out)).toBe(out);
  });

  it("past Work's band (work > 0) the selected model's swarm flies to the helix: the model dissolves and the helix is drawn in over the same stretch", () => {
    expect(HELIX_SLOT).toBe(0);
    expect(createComposition().helix).toBe(0);
    const plan = composeScene(1, 0.4, createMorph(2), createComposition());
    expect(plan.swarm).toEqual({ active: true, from: 3, to: HELIX_SLOT, t: 0.4 });
    expect(plan.helix).toBe(1);
    for (let index = 0; index < SCENE_SHAPES.length; index += 1) expect(revealOf(plan, index)).toBe(0);
    const early = composeScene(1, 0.1, createMorph(2), createComposition());
    expect(revealOf(early, 2)).toBeCloseTo(1 - smoothstep(0, 0.3, 0.1), 12);
    // The helix is drawn from the first frame of the gate — as the filament the swarm lands on.
    expect(early.helix).toBeCloseTo(smoothstep(0, 0.3, 0.1), 12);
    expect(early.helix).toBeGreaterThan(0);
    const late = composeScene(1, 0.85, createMorph(2), createComposition());
    expect(late.helix).toBe(1);
    expect(revealOf(late, 2)).toBe(0);

    // Formed: the helix alone, no swarm, no service model (whatever pill is selected).
    const formed = composeScene(1, 1, createMorph(4), createComposition());
    expect(formed.swarm.active).toBe(false);
    expect(formed.helix).toBe(1);
    for (let index = 0; index < SCENE_SHAPES.length; index += 1) expect(revealOf(formed, index)).toBe(0);
    // The work gate owns the frame whatever the entry gate says; out of range is clamped.
    expect(composeScene(0.2, 0.4, createMorph(2), createComposition())).toEqual(plan);
    expect(composeScene(1, 5, createMorph(4), createComposition())).toEqual(formed);
    expect(composeScene(1, -1, createMorph(4), createComposition())).toEqual(composeScene(1, 0, createMorph(4), createComposition()));
    // No other branch draws the helix, and a composition reused from a handoff forgets it.
    const out = composeScene(1, 1, createMorph(0), createComposition());
    for (const [entry, m] of [
      [0, createMorph(1)],
      [0.5, createMorph(1)],
      [1, createMorph(1)],
      [1, { from: 0, to: 2, t: 0.4 }],
    ] as const) {
      expect(composeScene(entry, 0, m, out).helix).toBe(0);
    }
  });

  it("helixArrive is the gate's own value inside the handoff and 1 in every other branch (a frame that never entered it draws the formed helix)", () => {
    // The pre-warm frame happens at the top of the page, in the `else` branch: a composition that
    // left `helixArrive` unwritten there would hide the chips, the rungs and the bits on the one
    // frame `stageHelix` has to upload their buffers in, and they would compile mid-scroll.
    expect(createComposition().helixArrive).toBe(1);
    expect(composeScene(1, 0, createMorph(2), createComposition()).helixArrive).toBe(1);
    expect(composeScene(0.4, 0, createMorph(2), createComposition()).helixArrive).toBe(1);
    expect(composeScene(1, 0, { from: 0, to: 2, t: 0.4 }, createComposition()).helixArrive).toBe(1);
    for (const k of [1e-6, 0.1, 0.42, 0.9, 1]) {
      expect(composeScene(1, k, createMorph(2), createComposition()).helixArrive).toBeCloseTo(k, 12);
    }
    // Out of range is clamped like the gate's own value, and a reused composition forgets it.
    expect(composeScene(1, 5, createMorph(2), createComposition()).helixArrive).toBe(1);
    expect(composeScene(1, -1, createMorph(2), createComposition()).helixArrive).toBe(1);
    const out = composeScene(1, 0.3, createMorph(2), createComposition());
    expect(out.helixArrive).toBeCloseTo(0.3, 12);
    expect(composeScene(1, 0, createMorph(2), out).helixArrive).toBe(1);
  });

  it("property: continuous where the model hands over to the helix (work = ε) and where the helix has formed (work → 1)", () => {
    // While work > 0 the morph is instant (world.ts), so the handoff always leaves a formed morph.
    // Both ends agree to second order again: every reveal and the swarm's alpha are smoothsteps.
    for (let shape = 0; shape < SCENE_SHAPES.length; shape += 1) {
      const m = createMorph(shape);
      const model = composeScene(1, 0, m, createComposition());
      const helix = composeScene(1, 1, m, createComposition());
      for (const eps of [1e-2, 1e-3, 1e-4, 1e-6]) {
        const bound = 300 * eps * eps;
        const leaving = composeScene(1, eps, m, createComposition());
        const arriving = composeScene(1, 1 - eps, m, createComposition());
        for (let index = 0; index < SCENE_SHAPES.length; index += 1) {
          expect(Math.abs(revealOf(leaving, index) - revealOf(model, index)), `shape ${shape} leaving`).toBeLessThanOrEqual(bound);
          expect(Math.abs(revealOf(arriving, index) - revealOf(helix, index)), `shape ${shape} arriving`).toBeLessThanOrEqual(bound);
        }
        expect(Math.abs(leaving.helix - model.helix)).toBeLessThanOrEqual(bound);
        expect(Math.abs(arriving.helix - helix.helix)).toBeLessThanOrEqual(bound);
        expect(swarmDrawn(leaving)).toBeLessThanOrEqual(bound);
        expect(swarmDrawn(arriving)).toBeLessThanOrEqual(bound);
        // It leaves from the selected model's silhouette and lands on the helix's.
        expect([leaving.swarm.from, leaving.swarm.to]).toEqual([1 + shape, HELIX_SLOT]);
      }
      expect(revealOf(model, shape)).toBe(1);
      expect(swarmDrawn(model)).toBe(0);
      expect(swarmDrawn(helix)).toBe(0);
      expect(swarmDrawn(composeScene(1, 0.5, m, createComposition()))).toBe(1);
    }
  });
});

/* ---- the entry gate ------------------------------------------------------------------------ */

describe("gates — stepGate (armed by scroll, run in time)", () => {
  const span = { start: 406, end: 526 };
  const rates = ENTRY_SECONDS;

  it("burst in 1.1 s, implode in 0.45 s; the helix forms in 1.2 s and comes apart in 0.5 s", () => {
    expect(ENTRY_SECONDS).toEqual({ form: 1.1, unform: 0.45 });
    expect(WORK_SECONDS).toEqual({ form: 1.2, unform: 0.5 });
    expect(createGate()).toEqual({ value: 0, armed: false });
    expect(createSceneFx().work).toEqual({ value: 0, armed: false });
  });

  it("hysteresis: arms at the span's end, disarms only above its start, keeps its state in between", () => {
    const g = createGate();
    const at = (scrollY: number) => {
      stepGate(g, scrollY, span, 0, rates, false);
      return g.armed;
    };
    expect(at(0)).toBe(false);
    expect(at(525)).toBe(false);
    expect(at(526)).toBe(true);
    expect(at(450)).toBe(true);
    expect(at(406)).toBe(true);
    expect(at(405)).toBe(false);
    expect(at(450)).toBe(false);
    expect(at(9000)).toBe(true);
  });

  it("the value runs in time, not scroll: formed ENTRY_SECONDS.form after arming, wherever the page rests", () => {
    for (const rest of [526, 700, 5000]) {
      const g = createGate();
      let seconds = 0;
      for (let i = 0; i < 60; i += 1) {
        stepGate(g, rest, span, 1 / 60, rates, false);
        seconds += 1 / 60;
      }
      expect(g.value, `at ${rest}`).toBeCloseTo(1 / ENTRY_SECONDS.form, 9);
      while (g.value < 1 && seconds < 5) {
        stepGate(g, rest, span, 1 / 60, rates, false);
        seconds += 1 / 60;
      }
      expect(g.value).toBe(1);
      expect(seconds).toBeCloseTo(ENTRY_SECONDS.form, 1);
      // Resting inside the band keeps it formed.
      for (let i = 0; i < 30; i += 1) stepGate(g, 450, span, 1 / 60, rates, false);
      expect(g.value).toBe(1);
    }
  });

  it("scrolled back above, it implodes over ENTRY_SECONDS.unform, from wherever it was", () => {
    const g = { value: 1, armed: true };
    stepGate(g, 300, span, 0.2, rates, false);
    expect(g.armed).toBe(false);
    expect(g.value).toBeCloseTo(1 - 0.2 / ENTRY_SECONDS.unform, 12);
    stepGate(g, 300, span, 0.25, rates, false);
    expect(g.value).toBe(0);
    // Half-formed and turned back: it goes back the way it came, never jumps.
    const turned = { value: 0.5, armed: true };
    stepGate(turned, 0, span, 0.05, rates, false);
    expect(turned.value).toBeCloseTo(0.5 - 0.05 / ENTRY_SECONDS.unform, 12);
  });

  it("snap jumps straight to the armed value", () => {
    const g = createGate();
    stepGate(g, 600, span, 0, rates, true);
    expect(g).toEqual({ value: 1, armed: true });
    stepGate(g, 450, span, 0, rates, true);
    expect(g).toEqual({ value: 1, armed: true });
    stepGate(g, 100, span, 0, rates, true);
    expect(g).toEqual({ value: 0, armed: false });
  });

  it("data-entry: idle at 0, burst on the way either direction, formed at 1", () => {
    expect([0, -1, 1e-9, 0.5, 1 - 1e-9, 1, 2].map(entryState)).toEqual<SceneEntry[]>([
      "idle",
      "idle",
      "burst",
      "burst",
      "burst",
      "formed",
      "formed",
    ]);
  });
});

/* ---- per-frame state ------------------------------------------------------------------------ */

describe("fx — per-frame smoothing, the entry gate and the light wave", () => {
  const input = (waveSeq = 0, boost: 0 | 1 = 0) => ({ boost, waveSeq, shape: 0 });
  const span = { start: 406, end: 526 };

  it("the first frame snaps to the targets, the entry gate included (a deep link never animates in)", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(3, 1), 0.4, 600, span);
    expect(fx.heroExit).toBe(0.4);
    expect(fx.entry).toEqual({ value: 1, armed: true });
    expect(fx.boost).toBe(1);
    expect(fx.waveSeq).toBe(3);
    expect(fx.wave).toBe(1);
  });

  it("then the burst runs on the clamped frame step: at SwiftShader's 20 Hz clamp it takes 22 frames", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(), 0, 0, span);
    expect(fx.entry).toEqual({ value: 0, armed: false });
    const states: SceneEntry[] = [];
    const signal = createChangeSignal<SceneEntry | null>(null);
    let frames = 0;
    // A hitch of a whole second still moves it by one 20 Hz frame at most.
    while (fx.entry.value < 1 && frames < 100) {
      stepSceneFx(fx, 1, input(), 1, 600, span);
      frames += 1;
      const state = reportChange(signal, entryState(fx.entry.value));
      if (state !== null) states.push(state);
      if (frames === 1) expect(fx.entry.value).toBeCloseTo(1 / 20 / ENTRY_SECONDS.form, 12);
    }
    expect(frames).toBeGreaterThanOrEqual(22);
    expect(frames).toBeLessThanOrEqual(23);
    expect(states).toEqual(["burst", "formed"]);
  });

  it("no measured services anchor: the gate stays shut", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 40; i += 1) stepSceneFx(fx, 1 / 20, input(), 1, 5000, null);
    expect(fx.entry).toEqual({ value: 0, armed: false });
  });

  it("flung back up to the hero, a disarmed gate snaps to idle; merely above the span it implodes in time", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 20, input(), 1, 600, span);
    expect(fx.entry.value).toBe(1);
    stepSceneFx(fx, 1 / 20, input(), 0.9, 300, span);
    expect(fx.entry.armed).toBe(false);
    expect(fx.entry.value).toBeCloseTo(1 - 1 / 20 / ENTRY_SECONDS.unform, 12);
    stepSceneFx(fx, 1 / 20, input(), 0, 0, span);
    expect(fx.entry).toEqual({ value: 0, armed: false });

    // A services anchor already past its span at the top of the page stays armed there.
    const early = createSceneFx();
    stepSceneFx(early, 1 / 20, input(), 0, 0, { start: -300, end: -100 });
    stepSceneFx(early, 1 / 20, input(), 0, 0, { start: -300, end: -100 });
    expect(early.entry).toEqual({ value: 1, armed: true });
  });

  /* Work's band on the same page: the track's top "top 70%" → "top 55%" of the 800px viewport. */
  const work = { start: 2300, end: 2420 };

  it("the work gate arms past Work's band and forms on the clamped frame step; a deep link into Work finds the helix formed", () => {
    const deep = createSceneFx();
    stepSceneFx(deep, 1 / 60, input(), 1, 3000, span, work);
    expect(deep.work).toEqual({ value: 1, armed: true });
    expect(deep.entry).toEqual({ value: 1, armed: true });

    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 20, input(), 1, 1000, span, work);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(fx.entry.value).toBe(1);
    // Resting inside the band (hysteresis) keeps it shut…
    stepSceneFx(fx, 1 / 20, input(), 1, 2350, span, work);
    expect(fx.work).toEqual({ value: 0, armed: false });
    // …its end arms it, and the helix forms in time: 24 frames at the 20 Hz clamp, a hitch included.
    let frames = 0;
    while (fx.work.value < 1 && frames < 100) {
      stepSceneFx(fx, frames === 3 ? 1 : 1 / 20, input(), 1, 2420, span, work);
      frames += 1;
      if (frames === 1) expect(fx.work.value).toBeCloseTo(1 / 20 / WORK_SECONDS.form, 12);
    }
    expect(frames).toBeGreaterThanOrEqual(24);
    expect(frames).toBeLessThanOrEqual(25);
    // Back inside the band it stays formed; above its start it comes apart in time, the services model still formed.
    stepSceneFx(fx, 1 / 20, input(), 1, 2350, span, work);
    expect(fx.work).toEqual({ value: 1, armed: true });
    stepSceneFx(fx, 1 / 20, input(), 1, 2200, span, work);
    expect(fx.work.armed).toBe(false);
    expect(fx.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
    expect(fx.entry).toEqual({ value: 1, armed: true });
  });

  it("no helix to hand over to (no work span): the work gate stays shut, and one already open closes in time", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 40; i += 1) stepSceneFx(fx, 1 / 20, input(), 1, 5000, span, null);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(fx.entry).toEqual({ value: 1, armed: true });
    // The six-argument call (the entrance alone) is the same thing.
    const plain = createSceneFx();
    stepSceneFx(plain, 1 / 20, input(), 1, 5000, span);
    expect(plain.work).toEqual({ value: 0, armed: false });

    const open = createSceneFx();
    stepSceneFx(open, 1 / 20, input(), 1, 5000, span, work);
    expect(open.work.value).toBe(1);
    stepSceneFx(open, 1 / 20, input(), 1, 5000, span, null);
    expect(open.work.armed).toBe(false);
    expect(open.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
  });

  it("while the work gate is armed the entry gate sits on its armed value: no burst plays hidden behind the helix", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 20, input(), 1, 1000, span, work);
    // The entrance caught half-way (a fast scroll): arming the work gate settles it at once.
    fx.entry.value = 0.4;
    stepSceneFx(fx, 1 / 20, input(), 1, 2420, span, work);
    expect(fx.work.armed).toBe(true);
    expect(fx.entry).toEqual({ value: 1, armed: true });
    stepSceneFx(fx, 1 / 20, input(), 1, 2420, span, work);
    expect(fx.entry.value).toBe(1);

    // Without a measured services anchor there is no model to hand over: the work gate never opens.
    const noServices = createSceneFx();
    for (let i = 0; i < 10; i += 1) stepSceneFx(noServices, 1 / 20, input(), 1, 5000, null, work);
    expect(noServices.entry.value).toBe(0);
    expect(noServices.work.value).toBe(0);
  });

  it("flung back above the services, a Work gate still open snaps shut instead of handing back to an imploding model", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 20, input(), 1, 3000, span, work);
    expect([fx.entry.value, fx.work.value]).toEqual([1, 1]);
    stepSceneFx(fx, 1 / 20, input(), 0.6, 300, span, work);
    expect(fx.entry.armed).toBe(false);
    expect(fx.work).toEqual({ value: 0, armed: false });
    // The entrance itself implodes in time from there (the hero's exit has not rewound).
    expect(fx.entry.value).toBeCloseTo(1 - 1 / 20 / ENTRY_SECONDS.unform, 12);
    // Half-formed and flung up: the same.
    const half = createSceneFx();
    stepSceneFx(half, 1 / 20, input(), 1, 1000, span, work);
    for (let i = 0; i < 10; i += 1) stepSceneFx(half, 1 / 20, input(), 1, 2420, span, work);
    expect(half.work.value).toBeGreaterThan(0);
    expect(half.work.value).toBeLessThan(1);
    stepSceneFx(half, 1 / 20, input(), 0, 0, span, work);
    expect(half.work).toEqual({ value: 0, armed: false });
    expect(half.entry).toEqual({ value: 0, armed: false });
  });

  it("a new boost starts a wave, but never sooner than the gap after the last one", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(0), 0, 0, span);
    stepSceneFx(fx, 1 / 60, input(1, 1), 0, 0, span);
    expect(fx.wave).toBeLessThan(1);
    const started = fx.waveStart;
    stepSceneFx(fx, 1 / 60, input(2, 1), 0, 0, span);
    expect(fx.waveStart).toBe(started);
    for (let i = 0; i < Math.ceil(WAVE_GAP_SECONDS * 60) + 2; i += 1) stepSceneFx(fx, 1 / 60, input(2, 1), 0, 0, span);
    stepSceneFx(fx, 1 / 60, input(3, 1), 0, 0, span);
    expect(fx.waveStart).toBeGreaterThan(started);
  });

  it("sways on its own until a real tilt sample arrives", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 60; i += 1) stepSceneFx(fx, 1 / 20, input(), 0, 0, span);
    expect(fx.tx).not.toBe(0);
    fx.tiltLive = true;
    fx.tiltX = 1;
    for (let i = 0; i < 200; i += 1) stepSceneFx(fx, 1 / 20, input(), 0, 0, span);
    expect(fx.tx).toBeCloseTo(1, 3);
  });

  it("reportChange only answers a real change", () => {
    const signal = createChangeSignal(false);
    expect(reportChange(signal, false)).toBeNull();
    expect(reportChange(signal, true)).toBe(true);
    expect(reportChange(signal, true)).toBeNull();
    expect(reportChange(signal, false)).toBe(false);
  });
});

/* ---- where the swarm lands -------------------------------------------------------------------- */

describe("samples — the swarm's six silhouettes", () => {
  const mid = SCENE_TIER_CONFIG.mid;

  it("one slot per shape, count × 3 floats each, deterministic", () => {
    const models = SCENE_SHAPES.map((shape) => SERVICE_MODEL[shape]);
    const slots = swarmSlots(mid, models);
    expect(slots).toHaveLength(6);
    for (const slot of slots) expect(slot).toHaveLength(mid.swarm * 3);
    expect(swarmSlots(mid, models)[3]).toEqual(slots[3]);
  });

  it("every point fits the shape it belongs to", () => {
    const models = SCENE_SHAPES.map((shape) => SERVICE_MODEL[shape]);
    const [helix, ...services] = swarmSlots(SCENE_TIER_CONFIG.high, models);
    const radius = (buffer: Float32Array) => {
      let max = 0;
      for (let i = 0; i < buffer.length; i += 3) max = Math.max(max, Math.hypot(buffer[i], buffer[i + 1], buffer[i + 2]));
      return max;
    };
    // Slot 0 is the Work helix: inside its radius (plus a chip's lift and box) and its height.
    for (let i = 0; i < helix.length; i += 3) {
      expect(Math.hypot(helix[i], helix[i + 2])).toBeLessThanOrEqual(HELIX.radius + HELIX_PARTS.chip.lift + 0.1);
      expect(Math.abs(helix[i + 1])).toBeLessThanOrEqual(HELIX.height / 2 + HELIX_PARTS.chip.length);
    }
    // Models may break out of the host a little (MODEL_SCALES), never far.
    for (const buffer of services) expect(radius(buffer)).toBeLessThanOrEqual(MODEL_RADIUS * 1.25);
  });

  it("slot 0 is the Work helix at rest, built from the tier's chips and rungs (scene-helix-model.test.ts pins every part)", () => {
    for (const tier of [SCENE_TIER_CONFIG.high, SCENE_TIER_CONFIG.mid]) {
      const models = SCENE_SHAPES.map((shape) => SERVICE_MODEL[shape]);
      const samples = swarmSlots(tier, models)[0];
      expect(samples).toEqual(helixSamples(tier.swarm, undefined, tier));
      // Upright and centred: the samples span the helix's whole height, both strands.
      let low = Infinity;
      let high = -Infinity;
      for (let i = 0; i < tier.swarm; i += 1) {
        low = Math.min(low, samples[i * 3 + 1]);
        high = Math.max(high, samples[i * 3 + 1]);
      }
      expect(low).toBeLessThan(-HELIX.height * 0.45);
      expect(high).toBeGreaterThan(HELIX.height * 0.45);
    }
  });

  it("any half of a buffer still covers every part in proportion (the lite step draws a prefix)", () => {
    const samples = helixSamples(720);
    // Exactly on a strand's radius lie only the strands' samples (50%).
    const share = (from: number, to: number) => {
      let out = 0;
      for (let i = from; i < to; i += 1) {
        if (Math.abs(Math.hypot(samples[i * 3], samples[i * 3 + 2]) - HELIX.radius) < 1e-5) out += 1;
      }
      return out / (to - from);
    };
    expect(share(0, 720)).toBeCloseTo(0.5, 2);
    expect(Math.abs(share(0, 360) - 0.5)).toBeLessThan(0.1);
    expect(Math.abs(share(360, 720) - 0.5)).toBeLessThan(0.1);
  });

  it("commerce gates: an orthonormal frame, rings at their radius, turned towards the viewer", () => {
    for (let g = 0; g < 3; g += 1) {
      const { centre, u, v, normal } = commerceGateFrame(g);
      const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(dot(u, v)).toBeCloseTo(0, 9);
      expect(dot(u, normal)).toBeCloseTo(0, 9);
      expect(dot(normal, normal)).toBeCloseTo(1, 9);
      expect(normal[2]).toBeGreaterThan(0.5);
      const p = commerceGatePoint(g, 0);
      expect(Math.hypot(p[0] - centre[0], p[1] - centre[1], p[2] - centre[2])).toBeCloseTo(COMMERCE_GATE_RADIUS, 9);
    }
  });
});
