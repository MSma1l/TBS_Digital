import { afterEach, describe, expect, it, vi } from "vitest";
import { Matrix4, Object3D, type BufferGeometry, type Points, type ShaderMaterial } from "three";
import {
  READY_AFTER_FRAMES,
  armReady,
  buildStaged,
  compileStaged,
  createReadySignal,
  tickReady,
} from "@/components/scene/three/compile";
import { pickSceneRoles } from "@/components/scene/three/palette";
import { BURST_SPECK, HELIX_BOUND, createSceneWorld, stageHelix } from "@/components/scene/three/world";
import type { WorkHelixDriver, WorkHelixMode } from "@/components/scene/workHelix";
import { layoutFor, placeHelixSpiral, placeServices } from "@/components/scene/choreography";
import { HELIX_LAYOUT } from "@/components/scene/helix";
import {
  CHIP_PACKET_SPEED,
  chipArrivalPulse,
  chipPinFlare,
  chipTraceIncoming,
  createChipCore,
  traceRibbons,
  type CoreFrame,
} from "@/components/scene/three/core";
import { CUBE_CYCLE } from "@/components/scene/three/models/cubes";
import { hubArrivalPulse } from "@/components/scene/three/models/integrationHub";
import { CHIP_LIFT, CHIP_STACK } from "@/components/scene/three/samples";
import { watchPixelRatio, type PixelRatioHost } from "@/components/scene/pixelRatio";
import { CHIP, MODEL_RADIUS, chipTraces } from "@/components/scene/shapes";
import { SCENE_TIER_CONFIG, clampSceneDpr, pointsDrawn } from "@/components/scene/tiers";
import { ENTRY_SECONDS, WORK_SECONDS, createSceneFx } from "@/components/scene/fx";
import { createScrollProbe, readSceneInput, SERVICE_MODEL, SCENE_SHAPES } from "@/lib/scene";

/*
 * How the interior scene gets on screen without one long main-thread task, and when it may
 * say it is ready:
 *   · the world is built one part per idle slice (the chip first, then the swarm, the cursor
 *     trail, then each service model) — building them all at once was one 181–229ms task at 4× CPU;
 *   · it is compiled one draw object per idle slice, and draws nothing until a whole part is
 *     compiled (a frame in between must never compile a shader);
 *   · "ready" is counted in frames R3F really drew (review correctness #2): a paused canvas
 *     draws none, so it never reports ready and the stage keeps its art;
 *   · the canvas's DPR range is worked out again after a resize or a pixel-ratio change
 *     (review perf #6).
 * three.js runs fine in jsdom for everything but a WebGL context, which none of this needs.
 */

const PALETTE = pickSceneRoles({
  cyan: "#4fc3e8",
  blue: "#3970ff",
  blueText: "#8fb0ff",
  redLift: "#ff5362",
  redText: "#ff6b7b",
  txt: "#f6f7fb",
  bg: "#0a0b10",
});

/** An idle slice the test runs by hand, recording what happened in each task. */
function manualIdle() {
  const waiting: Array<() => void> = [];
  return {
    idle: () => new Promise<void>((resolve) => waiting.push(resolve)),
    pending: () => waiting.length,
    /** Resolve the one slice waiting, and let its continuation run up to the next await. */
    async step() {
      const next = waiting.shift();
      expect(next, "an idle slice was waiting").toBeTypeOf("function");
      next!();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    },
  };
}

describe("the world, built one part per idle slice", () => {
  const PARTS = 3 + SCENE_SHAPES.length;

  it("starts as an empty, hidden root and builds the chip, the swarm, the trail, then each model in its own slice", async () => {
    const world = createSceneWorld("mid", PALETTE);
    expect(world.root.children).toHaveLength(0);
    expect(world.root.visible).toBe(false);
    expect(world.complete()).toBe(false);
    expect(world.compileStages()).toEqual([]);

    const slices = manualIdle();
    const built = buildStaged(world, { cancelled: () => false, idle: slices.idle });
    await Promise.resolve();
    // Nothing is built in the task that asked for it.
    expect(world.root.children).toHaveLength(0);

    const names: string[][] = [];
    for (let part = 0; part < PARTS; part += 1) {
      await slices.step();
      // Exactly one more part per slice.
      expect(world.root.children).toHaveLength(part + 1);
      names.push(world.root.children.map((child) => child.name));
    }
    await expect(built).resolves.toBe(true);
    expect(slices.pending()).toBe(0);
    expect(world.complete()).toBe(true);
    expect(names[0]).toEqual(["scene-core"]);
    expect(names[1]).toEqual(["scene-core", "scene-swarm"]);
    expect(names[2]).toEqual(["scene-core", "scene-swarm", "scene-trail"]);
    expect(names.at(-1)!.slice(3)).toEqual(SCENE_SHAPES.map((shape) => `scene-model-${SERVICE_MODEL[shape]}`));
    // Still hidden: nothing compiled yet.
    expect(world.root.visible).toBe(false);
    world.dispose();
  });

  it("an unmount part-way stops building", async () => {
    const world = createSceneWorld("mid", PALETTE);
    const slices = manualIdle();
    let cancelled = false;
    const built = buildStaged(world, { cancelled: () => cancelled, idle: slices.idle });
    await slices.step();
    await slices.step();
    cancelled = true;
    await slices.step();
    await expect(built).resolves.toBe(false);
    expect(world.root.children).toHaveLength(2);
    expect(world.complete()).toBe(false);
    world.dispose();
  });

  it("composes nothing before every part exists, and a palette or lite step set early reaches later parts", () => {
    const world = createSceneWorld("mid", PALETTE);
    const view = { size: { width: 390, height: 780 }, viewport: { dpr: 2 } };
    expect(() =>
      world.update(0.016, 0, view, true, createScrollProbe(), readSceneInput(), createSceneFx()),
    ).not.toThrow();
    world.buildNext();
    // A theme switch and the governor's lite step while the rest is still being built. Lite
    // needs no renderer: nothing in the scene has a renderer-side setting any more.
    const light = { ...PALETTE, mode: "ink" as const };
    world.setPalette(light);
    expect(world.setLite).toHaveLength(1);
    world.setLite(true);
    expect(() =>
      world.update(0.016, 0, view, true, createScrollProbe(), readSceneInput(), createSceneFx()),
    ).not.toThrow();
    while (!world.complete()) world.buildNext();
    world.buildNext(); // nothing left: a no-op
    expect(world.root.children).toHaveLength(PARTS);
    world.update(0.016, 0, view, true, createScrollProbe(), readSceneInput(), createSceneFx());
    // The swarm was built after `setLite(true)`: it draws the lite share of its points.
    const swarm = world.root.children[1] as unknown as { geometry: { drawRange: { count: number } } };
    expect(swarm.geometry.drawRange.count).toBe(pointsDrawn(SCENE_TIER_CONFIG.mid.swarm, true));
    expect(pointsDrawn(SCENE_TIER_CONFIG.mid.swarm, true)).toBeLessThan(SCENE_TIER_CONFIG.mid.swarm);
    world.dispose();
  });

  it("compiles the chip object by object, then the swarm, the trail, then one stage per model; draws once a part is compiled", () => {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const [core, swarm, trail, ...models] = world.root.children;
    expect(core.name).toBe("scene-core");
    const stages = world.compileStages();
    expect(stages).toHaveLength(3 + models.length);
    // Every object of the chip's stage is a drawable under the chip.
    expect(stages[0].length).toBeGreaterThanOrEqual(4);
    for (const object of stages[0]) {
      let node: Object3D | null = object;
      while (node && node !== core) node = node.parent;
      expect(node, object.type).toBe(core);
      expect((object as unknown as { material?: unknown }).material).toBeDefined();
    }
    expect(stages[1]).toEqual([swarm]);
    expect(stages[2]).toEqual([trail]);
    expect(stages.slice(3)).toEqual(models.map((model) => [model]));

    expect(world.root.visible).toBe(false);
    world.prewarm([]);
    expect(world.root.visible).toBe(false);
    world.prewarm(stages[0]);
    expect(world.root.visible).toBe(true);
    world.dispose();
  });
});

describe("the world — the services entrance (burst out of a speck)", () => {
  /** The page at 1280×800 (header 71): the services anchor's entry band "top 90%" → "top 75%". */
  function desktopProbe() {
    const probe = createScrollProbe();
    probe.live = true;
    probe.version = 1;
    probe.headerH = 71;
    probe.stage = { top: 71, bottom: 1678 };
    probe.hero = { x: 702, y: 167, w: 538, h: 538 };
    probe.services = { x: 610, y: 1126, w: 630, h: 248 };
    probe.heroExit = { start: 71, end: 520 };
    probe.entry = { start: 406, end: 526 };
    return probe;
  }

  it("arms past the band, bursts the selected model out of its host's centre, forms in time and implodes above it", () => {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const [core, swarm, , ...models] = world.root.children;
    const u = (swarm as Points<BufferGeometry, ShaderMaterial>).material.uniforms;
    const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
    const probe = desktopProbe();
    const fx = createSceneFx();
    const frame = (scrollY: number) => world.update(1 / 20, scrollY, view, false, probe, readSceneInput(), fx);

    // Above the band: nothing of the services drawn, the chip whole.
    frame(0);
    expect(fx.entry).toEqual({ value: 0, armed: false });
    expect(swarm.visible).toBe(false);
    expect(models.some((model) => model.visible)).toBe(false);
    expect(core.visible).toBe(true);

    // Past its end: the first frame of the burst.
    const scrollY = 600;
    frame(scrollY);
    expect(fx.entry.armed).toBe(true);
    expect(fx.entry.value).toBeCloseTo(1 / 20 / ENTRY_SECONDS.form, 12);
    expect(swarm.visible).toBe(true);
    // Both ends are the selected model's slot (shape 0 → slot 1): a speck of it, then it.
    expect(u.uFromA.value.toArray()).toEqual(u.uToA.value.toArray());
    expect(u.uFromB.value.toArray()).toEqual(u.uToB.value.toArray());
    expect(u.uToA.value.toArray()).toEqual([0, 1, 0]);
    const place = placeServices(probe, scrollY, 1280, 729, layoutFor(1280, 729, false))!;
    const from = (u.uFromM.value as Matrix4).elements;
    expect(from[12]).toBeCloseTo(place.x, 9);
    expect(from[13]).toBeCloseTo(place.y, 9);
    expect(from[0]).toBeCloseTo(place.scale * BURST_SPECK.scale, 9);
    const to = (u.uToM.value as Matrix4).elements;
    expect(to[12]).toBeCloseTo(from[12], 9);
    expect(to[13]).toBeCloseTo(from[13], 9);
    expect(u.uFromR.value).toBeCloseTo(BURST_SPECK.radius * MODEL_RADIUS * place.scale, 9);
    expect(u.uToR.value).toBeCloseTo(MODEL_RADIUS * place.scale, 9);
    expect(BURST_SPECK).toEqual({ scale: 0.05, radius: 1.35, sprite: 0.5 });

    // Formed after ENTRY_SECONDS.form (22–23 frames at 20 Hz): the model alone, no swarm.
    for (let i = 0; i < 22; i += 1) frame(scrollY);
    expect(fx.entry.value).toBe(1);
    expect(swarm.visible).toBe(false);
    expect(models[0].visible).toBe(true);

    // The model's own cycle waited for it to form: the cubes hold their block for the whole
    // CUBE_CYCLE.hold after `formed` (a clock started at the first reveal would explode ~0.3s early).
    const cubes = models[0].children[0].children[0] as unknown as { getMatrixAt(i: number, m: Matrix4): void };
    const atFormed = new Matrix4();
    const later = new Matrix4();
    cubes.getMatrixAt(0, atFormed);
    for (let i = 0; i < Math.floor(CUBE_CYCLE.hold * 20) - 3; i += 1) frame(scrollY);
    cubes.getMatrixAt(0, later);
    expect(later.elements).toEqual(atFormed.elements);
    for (let i = 0; i < 20; i += 1) frame(scrollY);
    cubes.getMatrixAt(0, later);
    expect(later.elements).not.toEqual(atFormed.elements);

    // Resting inside the band keeps it; above its start it implodes back into the speck.
    frame(450);
    expect(fx.entry.value).toBe(1);
    frame(300);
    expect(fx.entry.armed).toBe(false);
    expect(fx.entry.value).toBeLessThan(1);
    expect(swarm.visible).toBe(true);
    for (let i = 0; i < 10; i += 1) frame(300);
    expect(fx.entry.value).toBe(0);
    expect(swarm.visible).toBe(false);
    expect(models.some((model) => model.visible)).toBe(false);
    world.dispose();
  });

  it("a deep link into the services finds the model formed on the first frame (no burst)", () => {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const [, swarm, , ...models] = world.root.children;
    const fx = createSceneFx();
    world.update(1 / 60, 900, { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } }, false, desktopProbe(), readSceneInput(), fx);
    expect(fx.entry).toEqual({ value: 1, armed: true });
    expect(swarm.visible).toBe(false);
    expect(models[0].visible).toBe(true);
    world.dispose();
  });
});

describe("the world — Work's helix, built after ready", () => {
  /** A renderer that only records what it was asked to compile (no WebGL in jsdom). */
  function recordingRenderer() {
    const compiled: Object3D[] = [];
    const renderer = {
      extensions: { has: () => false },
      compile: (object: Object3D) => compiled.push(object),
    } as unknown as Parameters<typeof stageHelix>[1];
    return { renderer, compiled };
  }

  it("is no part of `complete`: built in an idle slice of its own, compiled one object per slice, then marked built once", async () => {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const parts = world.root.children.length;
    expect(parts).toBe(3 + SCENE_SHAPES.length);
    // Complete, compiled and ready without it.
    expect(world.helixObjects()).toEqual([]);
    expect(world.helixBuilt()).toBe(false);

    const { renderer, compiled } = recordingRenderer();
    const slices = manualIdle();
    const built = vi.fn();
    const done = stageHelix(world, renderer, {} as never, {} as never, { cancelled: () => false, idle: slices.idle }).then(
      (ok) => {
        if (ok) built();
        return ok;
      },
    );
    await Promise.resolve();
    // Nothing is built in the task that asked for it.
    expect(world.root.children).toHaveLength(parts);

    await slices.step();
    // One slice: the helix exists, hidden, and its first object compiled.
    expect(world.root.children).toHaveLength(parts + 1);
    const group = world.root.children[parts];
    expect(group.visible).toBe(false);
    const objects = world.helixObjects();
    expect(objects.length).toBeGreaterThan(1);
    for (const object of objects) {
      let node: Object3D | null = object;
      while (node && node !== group) node = node.parent;
      expect(node, object.type).toBe(group);
    }
    expect(compiled).toEqual([objects[0]]);
    expect(world.helixBuilt()).toBe(false);

    // Then exactly one more object per slice.
    for (let i = 1; i < objects.length; i += 1) {
      await slices.step();
      expect(compiled).toEqual(objects.slice(0, i + 1));
      expect(world.helixBuilt()).toBe(false);
    }
    // The slice after the last compile queues its pre-warm and marks it built.
    await slices.step();
    await expect(done).resolves.toBe(true);
    expect(slices.pending()).toBe(0);
    expect(built).toHaveBeenCalledTimes(1);
    expect(world.helixBuilt()).toBe(true);
    expect(world.complete()).toBe(true);

    // The pre-warm frame draws it once (every fragment discards); with no driver it stays hidden after.
    const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
    const fx = createSceneFx();
    world.update(1 / 60, 0, view, false, createScrollProbe(), readSceneInput(), fx);
    expect(group.visible).toBe(true);
    world.update(1 / 60, 0, view, false, createScrollProbe(), readSceneInput(), fx);
    expect(group.visible).toBe(false);
    expect(world.helixMode()).toBe("off");

    // Building again changes nothing: one helix per canvas.
    world.buildHelix();
    expect(world.root.children).toHaveLength(parts + 1);
    world.dispose();
  });

  it("an unmount part-way stops it: never marked built", async () => {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const { renderer, compiled } = recordingRenderer();
    const slices = manualIdle();
    let cancelled = false;
    const done = stageHelix(world, renderer, {} as never, {} as never, { cancelled: () => cancelled, idle: slices.idle });
    await slices.step();
    cancelled = true;
    await slices.step();
    await expect(done).resolves.toBe(false);
    expect(compiled).toHaveLength(1);
    expect(world.helixBuilt()).toBe(false);

    // Cancelled before its slice: not even built.
    const early = createSceneWorld("mid", PALETTE);
    while (!early.complete()) early.buildNext();
    const parts = early.root.children.length;
    const earlySlices = manualIdle();
    const stopped = stageHelix(early, renderer, {} as never, {} as never, { cancelled: () => true, idle: earlySlices.idle });
    await earlySlices.step();
    await expect(stopped).resolves.toBe(false);
    expect(early.root.children).toHaveLength(parts);
    world.dispose();
    early.dispose();
  });
});

describe("the world — the Work handoff (services model → helix) with the spiral driver", () => {
  /** 1280×800, services formed above; nine cards: the track grown to one layer plus eight 304px steps. */
  function workProbe() {
    const probe = createScrollProbe();
    probe.live = true;
    probe.version = 1;
    probe.headerH = 71;
    probe.layerH = 729;
    probe.stage = { top: 71, bottom: 6240 };
    probe.hero = { x: 702, y: 167, w: 538, h: 538 };
    probe.services = { x: 610, y: 1126, w: 630, h: 248 };
    probe.work = { x: 64, y: 2600, w: 1152, h: 729 + 8 * 304 };
    probe.workHead = { x: 64, y: 2380, w: 1152, h: 150 };
    probe.workGap = { x: 0, y: 2296, w: 1280, h: 84 };
    probe.heroExit = { start: 71, end: 520 };
    probe.entry = { start: 406, end: 526 };
    probe.workSpan = { start: 2040, end: 2160 };
    probe.helix = { start: 2529, end: 4961 };
    return probe;
  }

  /** What the world asks of the driver, recorded; `mode` and `focus` set by the test. */
  function fakeDriver(initial: WorkHelixMode = "spiral") {
    const state = {
      mode: initial,
      focus: 2.5,
      exit: 0,
      writes: [] as Array<{ focus: number; built: boolean }>,
      focusAsked: [] as number[],
    };
    const driver: WorkHelixDriver = {
      focus: (scrollY) => {
        state.focusAsked.push(scrollY);
        return state.mode === "spiral" ? state.focus : 0;
      },
      exit: () => (state.mode === "spiral" ? state.exit : 0),
      write: vi.fn((s: { focus: number; built: boolean }) => {
        state.writes.push({ ...s });
      }),
      front: () => -1,
      cards: () => [],
      mode: () => state.mode,
      dispose: vi.fn(),
    };
    return { driver, state };
  }

  async function builtWorld() {
    const world = createSceneWorld("mid", PALETTE);
    while (!world.complete()) world.buildNext();
    const renderer = { extensions: { has: () => false }, compile: () => {} } as unknown as Parameters<typeof stageHelix>[1];
    await stageHelix(world, renderer, {} as never, {} as never, { cancelled: () => false, idle: () => Promise.resolve() });
    // Its pre-warm frame, at the top of the page (no driver yet).
    world.update(1 / 60, 0, { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } }, false, workProbe(), readSceneInput(), createSceneFx());
    return world;
  }

  it("no helix drawn, no handoff: before it is built, without a driver, or while the driver is off, the work gate stays shut", async () => {
    const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
    const probe = workProbe();
    // Not built: the driver hears `built: false` and the gate stays shut past Work's band.
    const bare = createSceneWorld("mid", PALETTE);
    while (!bare.complete()) bare.buildNext();
    const unbuilt = fakeDriver("off");
    bare.attachWork(unbuilt.driver);
    const fx = createSceneFx();
    for (let i = 0; i < 5; i += 1) bare.update(1 / 20, 3000, view, false, probe, readSceneInput(), fx);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(unbuilt.state.writes.every((w) => !w.built)).toBe(true);
    expect(unbuilt.state.writes).toHaveLength(5);

    // Built, driver off (a deep link into Work keeps the grid): still shut, and the driver hears `built`.
    const world = await builtWorld();
    const off = fakeDriver("off");
    world.attachWork(off.driver);
    const fxOff = createSceneFx();
    for (let i = 0; i < 5; i += 1) world.update(1 / 20, 3000, view, false, probe, readSceneInput(), fxOff);
    expect(fxOff.work).toEqual({ value: 0, armed: false });
    expect(off.state.writes.at(-1)).toEqual({ focus: 0, built: true });
    expect(off.state.focusAsked).toEqual([]);
    // Without a driver at all: shut.
    world.attachWork(null);
    expect(off.driver.dispose).toHaveBeenCalledTimes(1);
    const fxNone = createSceneFx();
    world.update(1 / 20, 3000, view, false, probe, readSceneInput(), fxNone);
    expect(fxNone.work).toEqual({ value: 0, armed: false });
    bare.dispose();
    world.dispose();
  });

  it("spiral: past Work's band the model's swarm flies to the helix on its zone, the helix forms in time and turns to the driver's focus", async () => {
    const world = await builtWorld();
    const [, swarm, , ...rest] = world.root.children;
    const models = rest.slice(0, SCENE_SHAPES.length);
    const helix = rest[SCENE_SHAPES.length];
    const u = (swarm as Points<BufferGeometry, ShaderMaterial>).material.uniforms;
    const { driver, state } = fakeDriver("spiral");
    world.attachWork(driver);
    const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
    const probe = workProbe();
    const fx = createSceneFx();
    const frame = (scrollY: number) => world.update(1 / 20, scrollY, view, false, probe, readSceneInput(), fx);

    // At the services: the model formed, no helix; the driver gets the (unused) focus and `built`.
    frame(1000);
    expect(fx.entry.value).toBe(1);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(models[0].visible).toBe(true);
    expect(helix.visible).toBe(false);
    expect(world.helixMode()).toBe("spiral");
    expect(state.writes.at(-1)).toEqual({ focus: 2.5, built: true });
    expect(state.focusAsked.at(-1)).toBe(1000);

    /* Past Work's own band but not yet at the arming line: the arrival is armed on the spiral's
       sticky line less 0.30 of a layer (choreography.ts `helixArriveSpan`), 2310 here, not on
       `probe.workSpan.end` (2160) — a whole screen higher up, where the helix's centre is still
       below the fold. */
    frame(2200);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(helix.visible).toBe(false);

    // Past the arming line: the first frame of the handoff, from the model's slot to the helix's.
    const scrollY = 2400;
    frame(scrollY);
    expect(fx.work.armed).toBe(true);
    expect(fx.work.value).toBeCloseTo(1 / 20 / WORK_SECONDS.form, 12);
    expect(swarm.visible).toBe(true);
    expect(u.uFromA.value.toArray()).toEqual([0, 1, 0]);
    expect(u.uToA.value.toArray()).toEqual([1, 0, 0]);
    expect(u.uToB.value.toArray()).toEqual([0, 0, 0]);
    const place = placeHelixSpiral(probe, scrollY, 1280, 729, HELIX_LAYOUT.cx)!;
    const to = (u.uToM.value as Matrix4).elements;
    expect(to[12]).toBeCloseTo(place.x, 9);
    expect(to[13]).toBeCloseTo(place.y, 9);
    expect(u.uToR.value).toBeCloseTo(HELIX_BOUND * place.scale, 9);
    const from = (u.uFromM.value as Matrix4).elements;
    const services = placeServices(probe, scrollY, 1280, 729, layoutFor(1280, 729, false))!;
    expect(from[12]).toBeCloseTo(services.x, 9);
    expect(u.uFromR.value).toBeCloseTo(MODEL_RADIUS * services.scale, 9);

    // Formed after WORK_SECONDS.form (24–25 frames at 20 Hz): the helix alone, the model gone.
    for (let i = 0; i < 24; i += 1) frame(scrollY);
    expect(fx.work.value).toBe(1);
    expect(swarm.visible).toBe(false);
    expect(models.some((model) => model.visible)).toBe(false);
    expect(helix.visible).toBe(true);
    // The helix sits on its zone; the driver is written every frame with the focus the helix turned to.
    expect(helix.position.x).toBeCloseTo(place.x, 9);
    state.focus = 4.25;
    frame(3400);
    expect(state.writes.at(-1)).toEqual({ focus: 4.25, built: true });
    const stuck = placeHelixSpiral(probe, 3400, 1280, 729, HELIX_LAYOUT.cx)!;
    expect(helix.position.y).toBeCloseTo(stuck.y, 9);
    expect(helix.scale.x).toBeCloseTo(stuck.scale, 9);

    // Back above the band: the helix hands back to the model in time.
    frame(1900);
    expect(fx.work.armed).toBe(false);
    expect(fx.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
    for (let i = 0; i < 12; i += 1) frame(1900);
    expect(fx.work.value).toBe(0);
    expect(helix.visible).toBe(false);
    expect(models[0].visible).toBe(true);
    expect(ENTRY_SECONDS.form).toBeLessThan(WORK_SECONDS.form);
    world.dispose();
    expect(driver.dispose).toHaveBeenCalledTimes(1);
  });

  it("a driver whose mode falls to off mid-handoff closes the gate in time and hides the helix at once (no swarm left flying)", async () => {
    const world = await builtWorld();
    const [, swarm, , ...rest] = world.root.children;
    const helix = rest[SCENE_SHAPES.length];
    const { driver, state } = fakeDriver("spiral");
    world.attachWork(driver);
    const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
    const probe = workProbe();
    const fx = createSceneFx();
    const frame = (scrollY: number) => world.update(1 / 20, scrollY, view, false, probe, readSceneInput(), fx);
    frame(1000);
    for (let i = 0; i < 12; i += 1) frame(2400);
    expect(swarm.visible).toBe(true);
    state.mode = "off";
    frame(2400);
    expect(world.helixMode()).toBe("off");
    expect(fx.work.armed).toBe(false);
    expect(swarm.visible).toBe(false);
    expect(helix.visible).toBe(false);
    world.dispose();
  });

  it("an error in the driver's frame lets it go (the cards come back), reports it once, and the scene draws on without the helix", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const world = await builtWorld();
      const [, , , ...rest] = world.root.children;
      const models = rest.slice(0, SCENE_SHAPES.length);
      const helix = rest[SCENE_SHAPES.length];
      const { driver } = fakeDriver("spiral");
      vi.mocked(driver.write).mockImplementation(() => {
        throw new Error("layout failed");
      });
      const onRelease = vi.fn();
      world.attachWork(driver, onRelease);
      const view = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };
      const fx = createSceneFx();
      const frame = (scrollY: number) => world.update(1 / 20, scrollY, view, false, workProbe(), readSceneInput(), fx);

      expect(() => frame(3000)).not.toThrow();
      expect(driver.dispose).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(world.helixBuilt()).toBe(false);
      expect(world.helixMode()).toBe("off");
      // The next frames: no driver, no helix, the gate closing, the model back.
      for (let i = 0; i < 15; i += 1) frame(3000);
      expect(driver.write).toHaveBeenCalledTimes(1);
      expect(fx.work.value).toBe(0);
      expect(helix.visible).toBe(false);
      expect(models[0].visible).toBe(true);
      // A driver handed over afterwards is disposed straight away: this canvas has no helix any more.
      const late = fakeDriver("spiral");
      world.attachWork(late.driver);
      expect(late.driver.dispose).toHaveBeenCalledTimes(1);
      frame(3000);
      expect(late.state.writes).toEqual([]);
      expect(consoleError).toHaveBeenCalledTimes(1);
      world.dispose();
      expect(onRelease).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe("the hero chip (three/core.ts)", () => {
  const frame = (patch: Partial<CoreFrame> = {}): CoreFrame => ({
    time: 1,
    step: 1 / 60,
    tx: 0,
    ty: 0,
    boost: 0,
    wave: 1,
    reveal: 1,
    prewarm: false,
    lift: 0,
    dim: 1,
    ...patch,
  });

  it("draws with five objects on four programs: boxes (instanced), the die, lines, traces, the wave", () => {
    for (const tier of ["high", "mid"] as const) {
      const chip = createChipCore(SCENE_TIER_CONFIG[tier], PALETTE);
      const [boxes, die, lines, traces, wave] = chip.objects as unknown as Array<Object3D & { count?: number; type: string }>;
      expect(chip.objects.map((o) => o.type)).toEqual(["Mesh", "Mesh", "LineSegments", "Mesh", "LineSegments"]);
      expect((boxes as unknown as { isInstancedMesh?: boolean }).isInstancedMesh).toBe(true);
      // Substrate, heat spreader, die frame and 4 pins per trace side: 31 on high, 23 on mid.
      expect(boxes.count).toBe(3 + 4 * SCENE_TIER_CONFIG[tier].chipTraces);
      expect(boxes.count).toBe(tier === "high" ? 31 : 23);
      expect(die).toBeDefined();
      expect(lines).toBeDefined();
      expect(traces).toBeDefined();
      // The light wave is drawn only while one runs.
      expect(wave.visible).toBe(false);
      chip.update(frame({ wave: 0.3 }));
      expect(wave.visible).toBe(true);
      chip.update(frame({ wave: 1 }));
      expect(wave.visible).toBe(false);
      chip.dispose();
    }
  });

  it("the exploded view lifts the heat spreader 0.22 and the die 0.4 along local z; the pins stay on the board", () => {
    const chip = createChipCore(SCENE_TIER_CONFIG.mid, PALETTE);
    const boxes = chip.objects[0] as unknown as { getMatrixAt(i: number, m: Matrix4): void };
    const z = (index: number) => {
      const m = new Matrix4();
      boxes.getMatrixAt(index, m);
      return m.elements[14];
    };
    const pinZ = z(3);
    chip.update(frame({ lift: 0 }));
    expect(z(0)).toBeCloseTo(CHIP_STACK.pkg, 6);
    expect(z(1)).toBeCloseTo(CHIP_STACK.ihs, 6);
    expect(z(2)).toBeCloseTo(CHIP_STACK.die, 6);
    chip.update(frame({ lift: 1 }));
    expect(z(1) - CHIP_STACK.ihs).toBeCloseTo(CHIP_LIFT.ihs, 6);
    expect(z(2) - CHIP_STACK.die).toBeCloseTo(CHIP_LIFT.die, 6);
    expect(CHIP_LIFT).toEqual({ ihs: 0.22, die: 0.4 });
    expect(z(0)).toBeCloseTo(CHIP_STACK.pkg, 6);
    expect(z(3)).toBe(pinZ);
    // The pose follows the tilt around CHIP_POSE; a dissolved chip hides, a pre-warm still draws.
    chip.update(frame({ tx: 1, ty: -1 }));
    const pose = chip.group.children[0];
    expect(pose.rotation.x).toBeCloseTo(-0.78 + 0.22, 9);
    expect(pose.rotation.y).toBeCloseTo(0.32, 9);
    expect(pose.rotation.z).toBeCloseTo(0.62, 9);
    chip.update(frame({ reveal: 0 }));
    expect(chip.group.visible).toBe(false);
    chip.update(frame({ reveal: 0, prewarm: true }));
    expect(chip.group.visible).toBe(true);
    chip.setLite(true);
    chip.setPalette({ ...PALETTE, mode: "ink" });
    chip.dispose();
  });

  it("trace ribbons: two triangles per run facing +z, uv.x from the pin (0) to the board (1), odd traces incoming", () => {
    const traces = chipTraces(5);
    const geometry = traceRibbons(traces, 0.034, CHIP_STACK.board);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const tag = geometry.getAttribute("aTag");
    // A centre trace (odd count per side) has no chamfer: one run fewer.
    const runs = traces.reduce(
      (sum, t) => sum + t.slice(1).filter((p, j) => Math.hypot(p[0] - t[j][0], p[1] - t[j][1]) > 1e-9).length,
      0,
    );
    expect(position.count).toBe(runs * 6);
    for (let v = 0; v < position.count; v += 3) {
      const ax = position.getX(v);
      const ay = position.getY(v);
      const cross =
        (position.getX(v + 1) - ax) * (position.getY(v + 2) - ay) - (position.getY(v + 1) - ay) * (position.getX(v + 2) - ax);
      expect(cross, `triangle ${v / 3}`).toBeGreaterThan(0);
      expect(position.getZ(v)).toBeCloseTo(CHIP_STACK.board, 6);
      expect(Math.hypot(ax, ay)).toBeLessThanOrEqual(CHIP.R);
    }
    let seenStart = false;
    let seenEnd = false;
    for (let v = 0; v < uv.count; v += 1) {
      expect(uv.getX(v)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(v)).toBeLessThanOrEqual(1 + 1e-6);
      seenStart ||= uv.getX(v) === 0;
      seenEnd ||= Math.abs(uv.getX(v) - 1) < 1e-6;
      const t = tag.getX(v);
      expect(t - Math.floor(t)).toBe(chipTraceIncoming(Math.floor(t)) ? 0.5 : 0);
    }
    expect(seenStart && seenEnd).toBe(true);
    geometry.dispose();
  });

  it("packets: a pin flares as its packet leaves or lands, and the die pulses on the hub's formula", () => {
    // Trace 0's head is at 0 at time 0 (phase 0): its pin is at full flare, half a trip later dark.
    expect(chipPinFlare(0, 0)).toBe(1);
    expect(chipPinFlare(0.5 / CHIP_PACKET_SPEED, 0)).toBeLessThan(1e-6);
    for (const t of [0, 0.37, 1.2, 4.9, 13.3]) {
      for (const traces of [20, 28]) expect(chipArrivalPulse(t, traces)).toBeCloseTo(hubArrivalPulse(t, traces), 12);
    }
    expect(chipTraceIncoming(0)).toBe(false);
    expect(chipTraceIncoming(1)).toBe(true);
  });
});

describe("compileStaged — one draw object per idle slice", () => {
  it("compiles each object in a slice of its own and reports a stage only once all of it compiled", async () => {
    const compileObject = vi.fn();
    const renderer = {
      extensions: { has: () => false },
      compile: (object: Object3D) => compileObject(object.name),
    } as unknown as Parameters<typeof compileStaged>[0];
    const named = (name: string) => Object.assign(new Object3D(), { name });
    const stages = [[named("nucleus"), named("wire")], [named("swarm")]];
    const compiled: string[][] = [];
    const slices = manualIdle();
    const done = compileStaged(renderer, {} as never, {} as never, stages, {
      cancelled: () => false,
      idle: slices.idle,
      compiled: (objects) => compiled.push(objects.map((o) => o.name)),
    });

    await Promise.resolve();
    expect(compileObject.mock.calls.map(([name]) => name)).toEqual(["nucleus"]);
    await slices.step();
    expect(compileObject.mock.calls.map(([name]) => name)).toEqual(["nucleus", "wire"]);
    expect(compiled).toEqual([]);
    await slices.step();
    expect(compiled).toEqual([["nucleus", "wire"]]);
    expect(compileObject.mock.calls.map(([name]) => name)).toEqual(["nucleus", "wire", "swarm"]);
    await slices.step();
    await expect(done).resolves.toBe(true);
    expect(compiled).toEqual([["nucleus", "wire"], ["swarm"]]);
  });

  it("cancelled part-way: no further compile, no stage reported", async () => {
    const compile = vi.fn();
    const renderer = { extensions: { has: () => false }, compile } as unknown as Parameters<typeof compileStaged>[0];
    let cancelled = false;
    const compiled = vi.fn();
    const slices = manualIdle();
    const done = compileStaged(renderer, {} as never, {} as never, [[new Object3D(), new Object3D()]], {
      cancelled: () => cancelled,
      idle: slices.idle,
      compiled,
    });
    await Promise.resolve();
    cancelled = true;
    await slices.step();
    await expect(done).resolves.toBe(false);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(compiled).not.toHaveBeenCalled();
  });
});

describe("ready, counted in drawn frames", () => {
  it("never before it is armed, however many frames run (the scene is still building or compiling)", () => {
    const signal = createReadySignal();
    for (let frame = 0; frame < 100; frame += 1) expect(tickReady(signal)).toBe(false);
  });

  it(`once armed: true exactly once, on the frame after ${READY_AFTER_FRAMES} drawn frames`, () => {
    const signal = createReadySignal();
    armReady(signal);
    const answers = Array.from({ length: 10 }, () => tickReady(signal));
    expect(answers.indexOf(true)).toBe(READY_AFTER_FRAMES);
    expect(answers.filter(Boolean)).toHaveLength(1);
    // Arming again never re-fires.
    armReady(signal);
    expect(Array.from({ length: 10 }, () => tickReady(signal)).some(Boolean)).toBe(false);
  });

  it("a paused canvas runs no frame: armed but not ready until it draws again", () => {
    const signal = createReadySignal();
    armReady(signal);
    expect(tickReady(signal)).toBe(false); // one frame drawn, then paused (frameloop "never")
    // …any amount of time passes without a frame: nothing ticks, nothing is reported.
    expect(signal.fired).toBe(false);
    // Back on screen: the frames resume and ready comes once enough were drawn.
    expect(tickReady(signal)).toBe(false);
    expect(tickReady(signal)).toBe(true);
  });
});

describe("the DPR range follows the window and the screen", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function fakeHost(dpr: number) {
    const windowListeners = new Map<string, () => void>();
    const media: Array<{ query: string; listeners: Set<() => void> }> = [];
    const host = {
      devicePixelRatio: dpr,
      addEventListener: vi.fn((type: string, listener: () => void) => windowListeners.set(type, listener)),
      removeEventListener: vi.fn((type: string) => windowListeners.delete(type)),
      matchMedia: vi.fn((query: string) => {
        const entry = { query, listeners: new Set<() => void>() };
        media.push(entry);
        return {
          matches: true,
          addEventListener: (_: string, listener: () => void) => entry.listeners.add(listener),
          removeEventListener: (_: string, listener: () => void) => entry.listeners.delete(listener),
        } as unknown as MediaQueryList;
      }),
      setTimeout: (handler: () => void, ms: number) => window.setTimeout(handler, ms),
      clearTimeout: (id: number | undefined) => window.clearTimeout(id),
    };
    return { host: host as PixelRatioHost & typeof host, windowListeners, media };
  }

  it("the review's case: a 2× laptop mounted in a narrow window, then maximised, is over budget until re-read", () => {
    const narrow = clampSceneDpr("high", 735, 956, 2);
    const maximised = clampSceneDpr("high", 1470, 885, 2);
    expect(narrow[1]).toBe(1.75);
    expect(1470 * 885 * narrow[1] ** 2).toBeGreaterThan(2.6e6 * 1.5);
    expect(1470 * 885 * maximised[1] ** 2).toBeLessThanOrEqual(2.6e6 + 1);
  });

  it("calls back once after a burst of resizes (debounced), and whenever the pixel ratio changes", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const onChange = vi.fn();
    const { host, windowListeners, media } = fakeHost(1);
    const stop = watchPixelRatio(onChange, 200, host);
    expect(host.addEventListener).toHaveBeenCalledWith("resize", expect.any(Function), { passive: true });
    expect(media.map((m) => m.query)).toEqual(["(resolution: 1dppx)"]);

    const resize = windowListeners.get("resize")!;
    resize();
    vi.advanceTimersByTime(150);
    resize();
    vi.advanceTimersByTime(199);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Dragged to a 2× screen: the 1dppx query stops matching; the watch re-arms for 2dppx.
    host.devicePixelRatio = 2;
    media[0].listeners.forEach((listener) => listener());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(media.map((m) => m.query)).toEqual(["(resolution: 1dppx)", "(resolution: 2dppx)"]);
    expect(media[0].listeners.size).toBe(0);
    expect(media[1].listeners.size).toBe(1);

    // A resize still debouncing when the canvas unmounts never calls back.
    resize();
    stop();
    expect(windowListeners.size).toBe(0);
    expect(media[1].listeners.size).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("works without matchMedia", () => {
    const { host } = fakeHost(1);
    Reflect.deleteProperty(host, "matchMedia");
    expect(() => watchPixelRatio(() => {}, 200, host)()).not.toThrow();
  });
});
