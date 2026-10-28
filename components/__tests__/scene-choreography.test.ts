import { describe, expect, it } from "vitest";
import {
  HELIX_AMBIENT,
  HELIX_ARRIVE_LEAD,
  HELIX_REACH,
  HELIX_ZONE_FILL,
  SCENE_CAMERA,
  canvasDocTop,
  clamp01,
  composeHelix,
  createHelixComposition,
  helixArriveSpan,
  helixZoneTop,
  placeHelixAmbient,
  placeHelixSpiral,
  smoothstep,
  worldPerPx,
} from "@/components/scene/choreography";
import { WORK_SECONDS, createGate, createSceneFx, stepGate, stepSceneFx } from "@/components/scene/fx";
import { HELIX_LAYOUT } from "@/components/scene/helix";
import { HELIX } from "@/components/art/shapes";
import { HELIX_PARTS } from "@/components/scene/three/samples";
import { createScrollProbe, type ScrollProbe } from "@/lib/scene";

/*
 * The interior scene's choreography as numbers — since 2026-10-28 that is Work's DNA helix alone
 * (Hero, Ticker and Directions draw static SVG art; the service pages have no stage): where the
 * helix sits on the sticky canvas, how the scroll moves it, when its arrival arms and what each
 * frame draws of it. All of it is pure (no three.js, no DOM), so the scene's motion is pinned here
 * rather than in a WebGL screenshot.
 */

/** A probe shaped like the real page at 1280×800 (header 71px), measured but without Work's track. */
function desktopProbe(): ScrollProbe {
  const probe = createScrollProbe();
  probe.live = true;
  probe.version = 1;
  probe.headerH = 71;
  probe.stage = { top: 71, bottom: 1678 };
  return probe;
}

describe("scene space — the camera and the sticky canvas", () => {
  const h = 729;

  it("maps canvas pixels onto the z = 0 plane of the fixed camera", () => {
    expect(worldPerPx(729)).toBeCloseTo((2 * SCENE_CAMERA.z * Math.tan((SCENE_CAMERA.fov * Math.PI) / 360)) / 729, 12);
    expect(worldPerPx(0)).toBe(worldPerPx(1));
  });

  it("clamp01 and smoothstep", () => {
    expect([clamp01(-1), clamp01(0.25), clamp01(2)]).toEqual([0, 0.25, 1]);
    expect([smoothstep(0, 1, -1), smoothstep(0, 1, 0.5), smoothstep(0, 1, 2)]).toEqual([0, 0.5, 1]);
  });

  it("before the director measured, the canvas counts as stuck to the viewport top", () => {
    const probe = createScrollProbe();
    expect(canvasDocTop(300, probe, h)).toBe(300);
    expect(canvasDocTop(Number.NaN, probe, h)).toBe(0);
  });

  it("rests at the stage top, sticks under the header, leaves with the stage bottom", () => {
    const probe = desktopProbe();
    expect(canvasDocTop(0, probe, h)).toBe(71);
    expect(canvasDocTop(500, probe, h)).toBe(571);
    expect(canvasDocTop(5000, probe, h)).toBe(probe.stage.bottom - h);
    expect(canvasDocTop(Number.NaN, probe, h)).toBe(71);
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

describe("who draws what — composeHelix", () => {
  it("starts with nothing drawn and nothing left to arrive", () => {
    expect(createHelixComposition()).toEqual({ helix: 0, helixArrive: 1 });
  });

  it("gate shut: nothing drawn, and the formed pose (helixArrive 1) for whenever it is", () => {
    const out = createHelixComposition();
    for (const work of [0, -1, Number.NaN]) {
      expect(composeHelix(work, out), String(work)).toEqual({ helix: 0, helixArrive: 1 });
    }
  });

  it("from the gate's first frame the helix is drawn — fully from 30% on — and arrives over the gate's own value", () => {
    const out = createHelixComposition();
    expect(composeHelix(0.001, out).helix).toBeGreaterThan(0);
    expect(out.helixArrive).toBe(0.001);
    expect(composeHelix(0.15, out)).toEqual({ helix: smoothstep(0, 0.3, 0.15), helixArrive: 0.15 });
    expect(composeHelix(0.3, out)).toEqual({ helix: 1, helixArrive: 0.3 });
    expect(composeHelix(1, out)).toEqual({ helix: 1, helixArrive: 1 });
    expect(composeHelix(7, out)).toEqual({ helix: 1, helixArrive: 1 });
  });

  it("writes into the composition it is given (no allocation per frame), and never jumps as the gate runs", () => {
    const out = createHelixComposition();
    expect(composeHelix(0.5, out)).toBe(out);
    let last = composeHelix(0, createHelixComposition()).helix;
    for (let k = 0.001; k <= 1; k += 0.001) {
      const next = composeHelix(k, out).helix;
      expect(Math.abs(next - last)).toBeLessThan(0.01);
      expect(next).toBeGreaterThanOrEqual(last);
      last = next;
    }
  });
});

describe("gates — stepGate (armed by scroll, run in time)", () => {
  const span = { start: 406, end: 526 };
  const rates = WORK_SECONDS;

  it("the helix forms in 1.2 s and comes apart in 0.5 s", () => {
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

  it("the value runs in time, not scroll: formed WORK_SECONDS.form after arming, wherever the page rests", () => {
    for (const rest of [526, 700, 5000]) {
      const g = createGate();
      let seconds = 0;
      while (g.value < 1 && seconds < 5) {
        stepGate(g, rest, span, 1 / 60, rates, false);
        seconds += 1 / 60;
      }
      expect(g.value, `at ${rest}`).toBe(1);
      expect(seconds).toBeCloseTo(WORK_SECONDS.form, 1);
      // Resting inside the band keeps it formed.
      for (let i = 0; i < 30; i += 1) stepGate(g, 450, span, 1 / 60, rates, false);
      expect(g.value).toBe(1);
    }
  });

  it("scrolled back above, it comes apart over WORK_SECONDS.unform, from wherever it was", () => {
    const g = { value: 1, armed: true };
    stepGate(g, 300, span, 0.2, rates, false);
    expect(g.armed).toBe(false);
    expect(g.value).toBeCloseTo(1 - 0.2 / WORK_SECONDS.unform, 12);
    stepGate(g, 300, span, 0.35, rates, false);
    expect(g.value).toBe(0);
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
});

describe("fx — the Work gate and the tilt (stepSceneFx)", () => {
  const work = { start: 2300, end: 2420 };

  it("a fresh fx: no time, unprimed, no tilt, the gate shut", () => {
    expect(createSceneFx()).toEqual({
      time: 0,
      primed: false,
      tiltX: 0,
      tiltY: 0,
      tiltLive: false,
      tx: 0,
      ty: 0,
      work: { value: 0, armed: false },
    });
  });

  it("the first frame snaps the gate: a deep link into Work finds the helix formed", () => {
    const deep = createSceneFx();
    stepSceneFx(deep, 1 / 60, 3000, work);
    expect(deep.primed).toBe(true);
    expect(deep.work).toEqual({ value: 1, armed: true });
    const above = createSceneFx();
    stepSceneFx(above, 1 / 60, 1000, work);
    expect(above.work).toEqual({ value: 0, armed: false });
  });

  it("then it arms at the band's end and forms on the clamped frame step: 24 frames at the 20 Hz clamp, a hitch included", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 20, 1000, work);
    // Resting inside the band (hysteresis) keeps it shut…
    stepSceneFx(fx, 1 / 20, 2350, work);
    expect(fx.work).toEqual({ value: 0, armed: false });
    let frames = 0;
    while (fx.work.value < 1 && frames < 100) {
      expect(stepSceneFx(fx, frames === 3 ? 1 : 1 / 20, 2420, work)).toBe(1 / 20);
      frames += 1;
      if (frames === 1) expect(fx.work.value).toBeCloseTo(1 / 20 / WORK_SECONDS.form, 12);
    }
    expect(frames).toBeGreaterThanOrEqual(24);
    expect(frames).toBeLessThanOrEqual(25);
    // Back inside the band it stays formed; above its start it comes apart in time.
    stepSceneFx(fx, 1 / 20, 2350, work);
    expect(fx.work).toEqual({ value: 1, armed: true });
    stepSceneFx(fx, 1 / 20, 2200, work);
    expect(fx.work.armed).toBe(false);
    expect(fx.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
  });

  it("no helix to draw (no work span): the gate stays shut, and one already open closes in time", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 40; i += 1) stepSceneFx(fx, 1 / 20, 5000, null);
    expect(fx.work).toEqual({ value: 0, armed: false });
    const plain = createSceneFx();
    stepSceneFx(plain, 1 / 20, 5000);
    expect(plain.work).toEqual({ value: 0, armed: false });

    const open = createSceneFx();
    stepSceneFx(open, 1 / 20, 5000, work);
    expect(open.work.value).toBe(1);
    stepSceneFx(open, 1 / 20, 5000, null);
    expect(open.work.armed).toBe(false);
    expect(open.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
  });

  it("time runs on the clamped step; a bad or negative dt adds nothing", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, 0);
    stepSceneFx(fx, 5, 0);
    stepSceneFx(fx, Number.NaN, 0);
    stepSceneFx(fx, -1, 0);
    expect(fx.time).toBeCloseTo(1 / 60 + 1 / 20, 12);
  });

  it("sways on its own until a real tilt sample arrives, then eases onto it", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 60; i += 1) stepSceneFx(fx, 1 / 20, 0);
    expect(fx.tx).not.toBe(0);
    fx.tiltLive = true;
    fx.tiltX = 1;
    fx.tiltY = -1;
    for (let i = 0; i < 200; i += 1) stepSceneFx(fx, 1 / 20, 0);
    expect(fx.tx).toBeCloseTo(1, 3);
    expect(fx.ty).toBeCloseTo(-1, 3);
  });
});
