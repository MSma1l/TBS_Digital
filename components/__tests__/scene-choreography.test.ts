import { describe, expect, it } from "vitest";
import {
  COARSE_PARALLAX_MAX,
  CORE_BEHIND_COPY_BELOW,
  CORE_BEHIND_COPY_DIM,
  CORE_BEHIND_COPY_WIDE_FROM,
  MORPH_SECONDS,
  SCENE_CAMERA,
  SCENE_LAYOUTS,
  canvasDocTop,
  composeScene,
  coreExitPose,
  createComposition,
  createMorph,
  fitAnchor,
  layoutFor,
  morphRunning,
  parallax,
  placeCore,
  placeServices,
  revealOf,
  smoothstep,
  stepMorph,
  swarmPhase,
  worldPerPx,
  type MorphState,
} from "@/components/scene/choreography";
import { createChangeSignal, createSceneFx, reportChange, stepSceneFx, WAVE_GAP_SECONDS } from "@/components/scene/fx";
import { CORE, MODEL_RADIUS } from "@/components/scene/shapes";
import {
  COMMERCE_GATE_RADIUS,
  cloudPositions,
  commerceGateFrame,
  commerceGatePoint,
  coreSamples,
  swarmSlots,
} from "@/components/scene/three/samples";
import { SCENE_TIER_CONFIG } from "@/components/scene/tiers";
import { mulberry32 } from "@/components/three/random";
import { SCENE_SHAPES, SERVICE_MODEL, createScrollProbe, type ScrollProbe } from "@/lib/scene";

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
  probe.handoff = { start: 366, end: 810 };
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
    // Never brighter than the portrait layout's own dim; ink (dark strokes under dark text)
    // dimmer than glow; the wide band (a core wider than the copy's column) dimmer than phones.
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

  it("the hero exit shrinks the core, opens its rings and brightens a dimmed phone core", () => {
    const portrait = SCENE_LAYOUTS.portrait;
    expect(coreExitPose(0, portrait)).toEqual({ scale: 1, rings: 1, dim: portrait.core.dim });
    const out = coreExitPose(1, portrait);
    expect(out.scale).toBeCloseTo(0.65, 12);
    expect(out.rings).toBeCloseTo(1.25, 12);
    expect(out.dim).toBeCloseTo(0.9, 12);
    expect(coreExitPose(7, portrait)).toEqual(out);
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
    const expected = fitAnchor(1280, h, hero.x + hero.w / 2, hero.y + hero.h / 2 - 71, hero.w, CORE.R, SCENE_LAYOUTS.desktop.core.fill);
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
  it("at the hero: the core only", () => {
    const plan = composeScene(0, createMorph(2), createComposition());
    expect(plan.core).toBe(1);
    expect(plan.swarm.active).toBe(false);
    expect(revealOf(plan, 2)).toBe(0);
  });

  it("during the handoff the swarm carries the core into the selected model", () => {
    const plan = composeScene(0.6, createMorph(3), createComposition());
    expect(plan.swarm).toEqual({ active: true, from: 0, to: 4, t: 0.6 });
    expect(plan.core).toBeCloseTo(1 - smoothstep(0.1, 0.5, 0.6), 12);
    expect(revealOf(plan, 3)).toBe(smoothstep(0.7, 1, 0.6));
    expect(composeScene(0.85, createMorph(3), createComposition()).models[0]).toEqual({
      index: 3,
      reveal: smoothstep(0.7, 1, 0.85),
    });
  });

  it("is continuous where the handoff hands over to the morph", () => {
    const m = createMorph(1);
    const before = composeScene(1 - 1e-9, m, createComposition());
    const after = composeScene(1, m, createComposition());
    expect(revealOf(before, 1)).toBeCloseTo(revealOf(after, 1), 6);
    expect(after.core).toBe(0);
    expect(after.swarm.active).toBe(false);
  });

  it("once in place the morph owns the swarm, and the reveals cross over", () => {
    const m: MorphState = { from: 0, to: 2, t: 0.2 };
    const plan = composeScene(1, m, createComposition());
    expect(plan.swarm).toEqual({ active: true, from: 1, to: 3, t: 0.2 });
    expect(revealOf(plan, 0)).toBeCloseTo(1 - smoothstep(0, 0.3, 0.2), 12);
    expect(revealOf(plan, 2)).toBe(0);
    // just before the commit the new model is formed, exactly as after it
    const late = composeScene(1, { from: 0, to: 2, t: 1 - 1e-9 }, createComposition());
    expect(revealOf(late, 2)).toBeCloseTo(1, 6);
    expect(revealOf(late, 0)).toBe(0);
  });

  it("writes into the composition it is given (no allocation per frame)", () => {
    const out = createComposition();
    expect(composeScene(0.3, createMorph(0), out)).toBe(out);
  });
});

/* ---- per-frame state ------------------------------------------------------------------------ */

describe("fx — per-frame smoothing and the light wave", () => {
  const input = (waveSeq = 0, boost: 0 | 1 = 0) => ({ boost, waveSeq, shape: 0 });

  it("the first frame snaps to the targets (a deep link never animates in)", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(3, 1), 0.4, 1);
    expect(fx.heroExit).toBe(0.4);
    expect(fx.handoff).toBe(1);
    expect(fx.boost).toBe(1);
    expect(fx.waveSeq).toBe(3);
    expect(fx.wave).toBe(1);
  });

  it("eases towards a new scroll progress and really reaches 1", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(), 0, 0);
    stepSceneFx(fx, 1 / 60, input(), 0, 1);
    expect(fx.handoff).toBeGreaterThan(0);
    expect(fx.handoff).toBeLessThan(1);
    for (let i = 0; i < 120; i += 1) stepSceneFx(fx, 1 / 60, input(), 0, 1);
    expect(fx.handoff).toBe(1);
  });

  it("a new boost starts a wave, but never sooner than the gap after the last one", () => {
    const fx = createSceneFx();
    stepSceneFx(fx, 1 / 60, input(0), 0, 0);
    stepSceneFx(fx, 1 / 60, input(1, 1), 0, 0);
    expect(fx.wave).toBeLessThan(1);
    const started = fx.waveStart;
    stepSceneFx(fx, 1 / 60, input(2, 1), 0, 0);
    expect(fx.waveStart).toBe(started);
    for (let i = 0; i < Math.ceil(WAVE_GAP_SECONDS * 60) + 2; i += 1) stepSceneFx(fx, 1 / 60, input(2, 1), 0, 0);
    stepSceneFx(fx, 1 / 60, input(3, 1), 0, 0);
    expect(fx.waveStart).toBeGreaterThan(started);
  });

  it("sways on its own until a real tilt sample arrives", () => {
    const fx = createSceneFx();
    for (let i = 0; i < 60; i += 1) stepSceneFx(fx, 1 / 20, input(), 0, 0);
    expect(fx.tx).not.toBe(0);
    fx.tiltLive = true;
    fx.tiltX = 1;
    for (let i = 0; i < 200; i += 1) stepSceneFx(fx, 1 / 20, input(), 0, 0);
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
    const [core, ...services] = swarmSlots(SCENE_TIER_CONFIG.high, models);
    const radius = (buffer: Float32Array) => {
      let max = 0;
      for (let i = 0; i < buffer.length; i += 3) max = Math.max(max, Math.hypot(buffer[i], buffer[i + 1], buffer[i + 2]));
      return max;
    };
    expect(radius(core)).toBeLessThanOrEqual(CORE.R + 1e-6);
    // Models may break out of the host a little (MODEL_SCALES), never far.
    for (const buffer of services) expect(radius(buffer)).toBeLessThanOrEqual(MODEL_RADIUS * 1.25);
  });

  it("any half of a buffer still covers every part in proportion (the lite step draws a prefix)", () => {
    const samples = coreSamples(720);
    const share = (from: number, to: number) => {
      let sphere = 0;
      for (let i = from; i < to; i += 1) {
        const r = Math.hypot(samples[i * 3], samples[i * 3 + 1], samples[i * 3 + 2]);
        if (Math.abs(r - CORE.sphere) < 1e-4) sphere += 1;
      }
      return sphere / (to - from);
    };
    expect(share(0, 720)).toBeCloseTo(0.55, 2);
    expect(Math.abs(share(0, 360) - 0.55)).toBeLessThan(0.1);
    expect(Math.abs(share(360, 720) - 0.55)).toBeLessThan(0.1);
  });

  it("the cloud lives in its shell", () => {
    const cloud = cloudPositions(700);
    for (let i = 0; i < cloud.length; i += 3) {
      const r = Math.hypot(cloud[i], cloud[i + 1] / 0.82, cloud[i + 2]);
      expect(r).toBeGreaterThanOrEqual(CORE.cloud[0] - 1e-6);
      expect(r).toBeLessThanOrEqual(CORE.cloud[1] + 1e-6);
    }
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
