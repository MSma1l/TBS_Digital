import { afterEach, describe, expect, it, vi } from "vitest";
import { Object3D, type ShaderMaterial } from "three";
import { READY_AFTER_FRAMES, armReady, compileStaged, createReadySignal, tickReady } from "@/components/scene/three/compile";
import { pickSceneRoles } from "@/components/scene/three/palette";
import { createSceneWorld, stageHelix } from "@/components/scene/three/world";
import type { WorkHelixDriver, WorkHelixMode } from "@/components/scene/workHelix";
import { HELIX_ARRIVE_LEAD, placeHelixSpiral } from "@/components/scene/choreography";
import { HELIX_LAYOUT } from "@/components/scene/helix";
import { watchPixelRatio, type PixelRatioHost } from "@/components/scene/pixelRatio";
import { SCENE_TIER_CONFIG, clampSceneDpr } from "@/components/scene/tiers";
import { WORK_SECONDS, createSceneFx } from "@/components/scene/fx";
import { createScrollProbe } from "@/lib/scene";

/*
 * How the interior scene — since 2026-10-28 only Work's DNA helix — gets on screen without one
 * long main-thread task, and when it may say it is ready:
 *   · the world starts as an empty, hidden root; the helix is built in an idle slice of its own
 *     (`stageHelix`), compiled one draw object per idle slice, and the root draws nothing until
 *     the compiled helix is queued for its pre-warm frame (a frame in between must never compile
 *     a shader);
 *   · "ready" is counted in frames R3F really drew (review correctness #2): a paused canvas
 *     draws none, so it never reports ready and Work keeps its flat card grid;
 *   · the canvas's DPR range is worked out again after a resize or a pixel-ratio change
 *     (review perf #6).
 * three.js runs fine in jsdom for everything but a WebGL context, which none of this needs.
 */

const PALETTE = pickSceneRoles({
  cyan: "#4fc3e8",
  blue: "#3970ff",
  blueText: "#2a56d6",
  redLift: "#ff5362",
  redText: "#d41026",
  txt: "#f6f7fb",
  bg: "#0a0b10",
});

const VIEW = { size: { width: 1280, height: 729 }, viewport: { dpr: 1 } };

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

/** A renderer that only records what it was asked to compile (no WebGL in jsdom). */
function recordingRenderer() {
  const compiled: Object3D[] = [];
  const renderer = {
    extensions: { has: () => false },
    compile: (object: Object3D) => compiled.push(object),
  } as unknown as Parameters<typeof stageHelix>[1];
  return { renderer, compiled };
}

/** 1280×729 layer; nine cards: the track grown to one layer plus eight 304px steps. */
function workProbe() {
  const probe = createScrollProbe();
  probe.live = true;
  probe.version = 1;
  probe.headerH = 71;
  probe.layerH = 729;
  probe.stage = { top: 2280, bottom: 6240 };
  probe.work = { x: 64, y: 2600, w: 1152, h: 729 + 8 * 304 };
  probe.workHead = { x: 64, y: 2380, w: 1152, h: 150 };
  probe.workGap = { x: 0, y: 2296, w: 1280, h: 84 };
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

/** A world with its helix staged and its pre-warm frame drawn (at the top of the page, no driver). */
async function builtWorld() {
  const world = createSceneWorld("mid", PALETTE);
  const { renderer } = recordingRenderer();
  await stageHelix(world, renderer, {} as never, {} as never, { cancelled: () => false, idle: () => Promise.resolve() });
  world.update(1 / 60, 0, VIEW, workProbe(), createSceneFx());
  return world;
}

describe("the world — an empty root until Work's helix is staged", () => {
  it("starts as an empty, hidden root: nothing to compile, nothing drawn", () => {
    const world = createSceneWorld("mid", PALETTE);
    expect(world.root.name).toBe("scene-root");
    expect(world.root.children).toEqual([]);
    expect(world.root.visible).toBe(false);
    expect(world.helixObjects()).toEqual([]);
    expect(world.helixBuilt()).toBe(false);
    // An update composes nothing and draws nothing.
    world.update(1 / 60, 0, VIEW, workProbe(), createSceneFx());
    expect(world.root.visible).toBe(false);
    // An empty pre-warm does not start drawing either.
    world.prewarm([]);
    expect(world.root.visible).toBe(false);
    // Marking an unbuilt helix built does nothing.
    world.markHelixBuilt();
    expect(world.helixBuilt()).toBe(false);
    world.dispose();
  });

  it("before the helix is built the driver hears `built: false` every frame and the work gate stays shut", () => {
    const world = createSceneWorld("mid", PALETTE);
    const { driver, state } = fakeDriver("off");
    world.attachWork(driver);
    const fx = createSceneFx();
    for (let i = 0; i < 5; i += 1) world.update(1 / 20, 3000, VIEW, workProbe(), fx);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(state.writes).toEqual(Array.from({ length: 5 }, () => ({ focus: 0, built: false })));
    expect(state.focusAsked).toEqual([]);
    expect(world.helixMode()).toBe("off");
    expect(world.root.visible).toBe(false);
    world.dispose();
    expect(driver.dispose).toHaveBeenCalledTimes(1);
  });

  it("a palette or lite step set before the helix exists reaches it when it is built", () => {
    const world = createSceneWorld("mid", PALETTE);
    world.setPalette({ ...PALETTE, mode: "ink" });
    world.setLite(true);
    world.buildHelix();
    const group = world.root.children[0];
    const strands = group.getObjectByName("scene-helix-strands") as Object3D & { material: ShaderMaterial };
    const bits = group.getObjectByName("scene-helix-bits")!;
    expect(strands.material.uniforms.uInk.value).toBe(1);
    expect(bits.visible).toBe(false);
    // …and one set afterwards reaches it too.
    world.setPalette(PALETTE);
    world.setLite(false);
    expect(strands.material.uniforms.uInk.value).toBe(0);
    expect(bits.visible).toBe(true);
    world.dispose();
  });
});

describe("the world — Work's helix, staged in idle slices", () => {
  it("built in an idle slice of its own, compiled one object per slice, then pre-warmed and marked built once", async () => {
    const world = createSceneWorld("mid", PALETTE);
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
    expect(world.root.children).toHaveLength(0);

    await slices.step();
    // One slice: the helix exists, hidden, and its first object compiled.
    expect(world.root.children).toHaveLength(1);
    const group = world.root.children[0];
    expect(group.name).toBe("scene-helix");
    expect(group.visible).toBe(false);
    expect(world.root.visible).toBe(false);
    const objects = world.helixObjects();
    expect(objects.length).toBeGreaterThan(1);
    for (const object of objects) {
      let node: Object3D | null = object;
      while (node && node !== group) node = node.parent;
      expect(node, object.type).toBe(group);
    }
    expect(compiled).toEqual([objects[0]]);
    expect(world.helixBuilt()).toBe(false);

    // Then exactly one more object per slice; the root still draws nothing.
    for (let i = 1; i < objects.length; i += 1) {
      await slices.step();
      expect(compiled).toEqual(objects.slice(0, i + 1));
      expect(world.helixBuilt()).toBe(false);
      expect(world.root.visible).toBe(false);
    }
    // The slice after the last compile queues its pre-warm (the root starts drawing) and marks it built.
    await slices.step();
    await expect(done).resolves.toBe(true);
    expect(slices.pending()).toBe(0);
    expect(built).toHaveBeenCalledTimes(1);
    expect(world.helixBuilt()).toBe(true);
    expect(world.root.visible).toBe(true);

    // The pre-warm frame draws it once (every fragment discards); with no driver it stays hidden after.
    const fx = createSceneFx();
    world.update(1 / 60, 0, VIEW, createScrollProbe(), fx);
    expect(group.visible).toBe(true);
    world.update(1 / 60, 0, VIEW, createScrollProbe(), fx);
    expect(group.visible).toBe(false);
    expect(world.helixMode()).toBe("off");

    // Building again changes nothing: one helix per canvas.
    world.buildHelix();
    expect(world.root.children).toHaveLength(1);
    world.dispose();
    expect(world.root.children).toHaveLength(0);
  });

  it("an unmount part-way stops it: never marked built", async () => {
    const world = createSceneWorld("mid", PALETTE);
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
    expect(world.root.visible).toBe(false);

    // Cancelled before its slice: not even built.
    const early = createSceneWorld("mid", PALETTE);
    const earlySlices = manualIdle();
    const stopped = stageHelix(early, renderer, {} as never, {} as never, { cancelled: () => true, idle: earlySlices.idle });
    await earlySlices.step();
    await expect(stopped).resolves.toBe(false);
    expect(early.root.children).toHaveLength(0);
    world.dispose();
    early.dispose();
  });
});

describe("the world — the Work gate draws the helix in, with the spiral driver", () => {
  it("built, but the driver off or gone: the work gate stays shut and the driver hears `built`", async () => {
    const probe = workProbe();
    const world = await builtWorld();
    const off = fakeDriver("off");
    world.attachWork(off.driver);
    const fx = createSceneFx();
    for (let i = 0; i < 5; i += 1) world.update(1 / 20, 3000, VIEW, probe, fx);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(off.state.writes.at(-1)).toEqual({ focus: 0, built: true });
    expect(off.state.focusAsked).toEqual([]);
    // Without a driver at all: shut.
    world.attachWork(null);
    expect(off.driver.dispose).toHaveBeenCalledTimes(1);
    const fxNone = createSceneFx();
    world.update(1 / 20, 3000, VIEW, probe, fxNone);
    expect(fxNone.work).toEqual({ value: 0, armed: false });
    world.dispose();
  });

  it("spiral: armed on the sticky line, the helix forms in time on its zone and turns to the driver's focus", async () => {
    const world = await builtWorld();
    const helix = world.root.children[0];
    const { driver, state } = fakeDriver("spiral");
    world.attachWork(driver);
    const probe = workProbe();
    const fx = createSceneFx();
    const frame = (scrollY: number) => world.update(1 / 20, scrollY, VIEW, probe, fx);

    // Above Work: no helix; the driver gets the (unused) focus and `built`.
    frame(1000);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(helix.visible).toBe(false);
    expect(world.helixMode()).toBe("spiral");
    expect(state.writes.at(-1)).toEqual({ focus: 2.5, built: true });
    expect(state.focusAsked.at(-1)).toBe(1000);

    /* Past Work's own band but not yet at the arming line: the arrival is armed on the spiral's
       sticky line less 0.30 of a layer (choreography.ts `helixArriveSpan`), 2310 here, not on
       `probe.workSpan.end` (2160) — a whole screen higher up, where the helix's centre is still
       below the fold. */
    const armAt = probe.work!.y - probe.headerH - HELIX_ARRIVE_LEAD * probe.layerH;
    expect(armAt).toBeCloseTo(2310.3, 9);
    frame(2200);
    expect(fx.work).toEqual({ value: 0, armed: false });
    expect(helix.visible).toBe(false);

    // Past the arming line: the first frame of the arrival already draws the helix (a filament).
    const scrollY = 2400;
    frame(scrollY);
    expect(fx.work.armed).toBe(true);
    expect(fx.work.value).toBeCloseTo(1 / 20 / WORK_SECONDS.form, 12);
    expect(helix.visible).toBe(true);
    const place = placeHelixSpiral(probe, scrollY, 1280, 729, HELIX_LAYOUT.cx)!;
    expect(helix.position.x).toBeCloseTo(place.x, 9);
    expect(helix.position.y).toBeCloseTo(place.y, 9);
    expect(helix.scale.x).toBeCloseTo(place.scale, 9);

    // Formed after WORK_SECONDS.form (24–25 frames at 20 Hz).
    for (let i = 0; i < 24; i += 1) frame(scrollY);
    expect(fx.work.value).toBe(1);
    expect(helix.visible).toBe(true);
    // The driver is written every frame with the focus the helix turned to.
    state.focus = 4.25;
    frame(3400);
    expect(state.writes.at(-1)).toEqual({ focus: 4.25, built: true });
    const stuck = placeHelixSpiral(probe, 3400, 1280, 729, HELIX_LAYOUT.cx)!;
    expect(helix.position.y).toBeCloseTo(stuck.y, 9);
    expect(helix.scale.x).toBeCloseTo(stuck.scale, 9);

    // Between the disarm line (Work's band, 2040) and the arming line: it keeps what it has.
    frame(2100);
    expect(fx.work.armed).toBe(true);
    // Back above the band: the helix dissolves in time.
    frame(1900);
    expect(fx.work.armed).toBe(false);
    expect(fx.work.value).toBeCloseTo(1 - 1 / 20 / WORK_SECONDS.unform, 12);
    for (let i = 0; i < 12; i += 1) frame(1900);
    expect(fx.work.value).toBe(0);
    expect(helix.visible).toBe(false);
    world.dispose();
    expect(driver.dispose).toHaveBeenCalledTimes(1);
  });

  it("a deep link into Work finds the gate snapped on the first frame the helix can be drawn", async () => {
    const world = await builtWorld();
    const { driver } = fakeDriver("spiral");
    world.attachWork(driver);
    const fx = createSceneFx();
    world.update(1 / 20, 3000, VIEW, workProbe(), fx);
    expect(fx.work).toEqual({ value: 1, armed: true });
    expect(world.root.children[0].visible).toBe(true);
    world.dispose();
  });

  it("a driver whose mode falls to off mid-arrival closes the gate in time and hides the helix at once", async () => {
    const world = await builtWorld();
    const helix = world.root.children[0];
    const { driver, state } = fakeDriver("spiral");
    world.attachWork(driver);
    const probe = workProbe();
    const fx = createSceneFx();
    const frame = (scrollY: number) => world.update(1 / 20, scrollY, VIEW, probe, fx);
    frame(1000);
    for (let i = 0; i < 12; i += 1) frame(2400);
    expect(helix.visible).toBe(true);
    const value = fx.work.value;
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
    state.mode = "off";
    frame(2400);
    expect(world.helixMode()).toBe("off");
    expect(fx.work.armed).toBe(false);
    expect(fx.work.value).toBeLessThan(value);
    expect(helix.visible).toBe(false);
    world.dispose();
  });

  it("an error in the driver's frame lets it go (the cards come back), reports it once, and the scene draws on without the helix", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const world = await builtWorld();
      const helix = world.root.children[0];
      const { driver } = fakeDriver("spiral");
      vi.mocked(driver.write).mockImplementation(() => {
        throw new Error("layout failed");
      });
      const onRelease = vi.fn();
      world.attachWork(driver, onRelease);
      const fx = createSceneFx();
      const frame = (scrollY: number) => world.update(1 / 20, scrollY, VIEW, workProbe(), fx);

      expect(() => frame(3000)).not.toThrow();
      expect(driver.dispose).toHaveBeenCalledTimes(1);
      expect(onRelease).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(world.helixBuilt()).toBe(false);
      expect(world.helixMode()).toBe("off");
      // The next frames: no driver, no helix, the gate closing.
      for (let i = 0; i < 15; i += 1) frame(3000);
      expect(driver.write).toHaveBeenCalledTimes(1);
      expect(fx.work.value).toBe(0);
      expect(helix.visible).toBe(false);
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

describe("the tier table — what the helix draws per tier", () => {
  it("mid draws no more than high, and the hologram stays at or under 384×240", () => {
    const { high, mid } = SCENE_TIER_CONFIG;
    expect(Object.keys(high).sort()).toEqual(Object.keys(mid).sort());
    for (const key of ["helixChips", "helixRungs", "helixBits"] as const) {
      expect(mid[key]).toBeGreaterThan(0);
      expect(mid[key]).toBeLessThanOrEqual(high[key]);
    }
    expect(mid.helixTube[0]).toBeLessThanOrEqual(high.helixTube[0]);
    expect(high.hologram).toEqual([384, 240]);
    expect(mid.hologram[0]).toBeLessThanOrEqual(384);
    expect(mid.hologram[1]).toBeLessThanOrEqual(240);
    expect(mid.dpr[1]).toBeLessThanOrEqual(high.dpr[1]);
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
