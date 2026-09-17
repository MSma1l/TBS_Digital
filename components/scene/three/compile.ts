/**
 * Getting the interior scene on screen without one long main-thread task: the world is BUILT
 * one part per idle slice (the core, the swarm, each service model), then COMPILED one draw
 * object per idle slice (Safari has no `KHR_parallel_shader_compile`, and a phone compiling
 * every program plus uploading every buffer in one go is a visible hitch), and only READY once
 * R3F has actually drawn the compiled scene.
 *
 * Each compiled stage (a part) asks the world to draw its objects once more at reveal 0 on the
 * next frame (the buffers upload while every fragment discards).
 */

import type { Camera, Object3D, Scene, WebGLRenderer } from "three";
import { compileObject } from "@/components/three/renderer";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

/** An idle slice (`requestIdleCallback` with a timeout), or two animation frames without one. */
export function nextIdle(timeoutMs = 120): Promise<void> {
  return new Promise((resolve) => {
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export type StagedOptions = {
  cancelled(): boolean;
  /** Yield between two pieces of work (tests pass their own). */
  idle?: () => Promise<void>;
};

/** What `buildStaged` needs of the world. */
export type StagedBuild = { buildNext(): void; complete(): boolean };

/**
 * Build `world` one part per idle slice, each part in a task of its own. Resolves `true` once
 * every part exists, `false` when cancelled part-way (unmounted).
 */
export async function buildStaged(world: StagedBuild, options: StagedOptions): Promise<boolean> {
  const idle = options.idle ?? (() => nextIdle());
  while (!world.complete()) {
    await idle();
    if (options.cancelled()) return false;
    world.buildNext();
  }
  return !options.cancelled();
}

export type CompileOptions = StagedOptions & {
  /** Called once every object of a stage compiled (the world pre-warms them). */
  compiled(objects: readonly Object3D[]): void;
};

/**
 * Compile `stages` in order, every object in an idle slice of its own. Resolves `true` once
 * every stage is done, `false` when cancelled part-way (unmounted).
 */
export async function compileStaged(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  stages: readonly (readonly Object3D[])[],
  options: CompileOptions,
): Promise<boolean> {
  const idle = options.idle ?? (() => nextIdle());
  for (const objects of stages) {
    for (const object of objects) {
      if (options.cancelled()) return false;
      await compileObject(renderer, object, camera, scene);
      await idle();
    }
    if (options.cancelled()) return false;
    options.compiled(objects);
  }
  return !options.cancelled();
}

/**
 * "Ready" in frames R3F really drew. Armed once the scene compiled; `tickReady`, called from
 * `useFrame` (which runs before that frame renders), answers true exactly once: on the first
 * frame after `READY_AFTER_FRAMES` armed frames were drawn. A paused canvas
 * (`frameloop="never"`) runs no frame, so it stays not-ready — and the stage keeps its art —
 * until it draws again.
 */
export type ReadySignal = { armed: boolean; drawn: number; fired: boolean };

export const READY_AFTER_FRAMES = 2;

export function createReadySignal(): ReadySignal {
  return { armed: false, drawn: 0, fired: false };
}

/** The scene compiled: start counting frames (a no-op once ready). */
export function armReady(signal: ReadySignal): void {
  if (signal.fired || signal.armed) return;
  signal.armed = true;
  signal.drawn = 0;
}

/** One `useFrame` tick. True exactly once, when the scene has drawn enough frames. */
export function tickReady(signal: ReadySignal): boolean {
  if (!signal.armed || signal.fired) return false;
  if (signal.drawn < READY_AFTER_FRAMES) {
    signal.drawn += 1;
    return false;
  }
  signal.fired = true;
  return true;
}
