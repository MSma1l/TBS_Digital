import { afterEach, describe, expect, it, vi } from "vitest";
import { Matrix4, Object3D } from "three";
import {
  READY_AFTER_FRAMES,
  armReady,
  buildStaged,
  compileStaged,
  createReadySignal,
  tickReady,
} from "@/components/scene/three/compile";
import { pickSceneRoles } from "@/components/scene/three/palette";
import { createSceneWorld } from "@/components/scene/three/world";
import {
  CHIP_PACKET_SPEED,
  chipArrivalPulse,
  chipPinFlare,
  chipTraceIncoming,
  createChipCore,
  traceRibbons,
  type CoreFrame,
} from "@/components/scene/three/core";
import { hubArrivalPulse } from "@/components/scene/three/models/integrationHub";
import { CHIP_LIFT, CHIP_STACK } from "@/components/scene/three/samples";
import { watchPixelRatio, type PixelRatioHost } from "@/components/scene/pixelRatio";
import { CHIP, chipTraces } from "@/components/scene/shapes";
import { SCENE_TIER_CONFIG, clampSceneDpr, pointsDrawn } from "@/components/scene/tiers";
import { createSceneFx } from "@/components/scene/fx";
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
