/**
 * Creating, compiling and releasing a WebGL renderer — for every R3F canvas on the site.
 *
 * R3F 9.7 builds its renderer inside an async `configure()` that nothing awaits: if
 * `new WebGLRenderer()` throws (no WebGL2, or `failIfMajorPerformanceCaveat` refusing a
 * software rasteriser) the rejection goes unhandled — it never reaches an error boundary and
 * three logs a console error first. So the context is requested here, up front, with the
 * exact attributes three would use; a refusal is reported as "lost" instead of thrown.
 *
 * On unmount R3F 9.7 disconnects events, disposes its render lists and scene, and calls
 * `forceContextLoss()` 500 ms later — but never `renderer.dispose()`. `retainRenderer` adds
 * that, and `forceContextLoss` is guarded so a context that is already lost (the path that
 * brought us to the fallback) isn't "lost" twice, which WebGL reports as an
 * INVALID_OPERATION in the console.
 */

import { WebGLRenderer, type Camera, type Object3D, type Scene } from "three";

export type RendererOptions = {
  antialias: boolean;
  /** Skip `failIfMajorPerformanceCaveat` (a QA / e2e force flag). */
  force3d: boolean;
  /** "default" unless a scene asks otherwise (the interior asks for "low-power"). */
  powerPreference?: WebGLPowerPreference;
};

/** The context attributes for a site canvas. */
export function contextAttributes({
  antialias,
  force3d,
  powerPreference = "default",
}: RendererOptions): WebGLContextAttributes {
  return {
    alpha: true,
    antialias,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference,
    failIfMajorPerformanceCaveat: !force3d,
  };
}

/** A renderer for `canvas`, or `null` when the browser refuses the context. Never throws. */
export function createRenderer(
  canvas: HTMLCanvasElement,
  options: RendererOptions,
): WebGLRenderer | null {
  const attributes = contextAttributes(options);
  let context: WebGL2RenderingContext | null = null;
  try {
    context = canvas.getContext("webgl2", attributes);
  } catch {
    return null;
  }
  if (!context || context.isContextLost()) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, ...attributes });
  } catch {
    return null;
  }

  const forceContextLoss = renderer.forceContextLoss.bind(renderer);
  renderer.forceContextLoss = () => {
    if (!renderer.getContext().isContextLost()) forceContextLoss();
  };
  return renderer;
}

/**
 * The intro's governor "lite" step, renderer side: the transmission pass (a second render of
 * the scene into a multisampled, mipmapped target every frame) drops to half resolution. A
 * renderer setting, not a material change, so nothing recompiles.
 */
export function setRendererLite(renderer: WebGLRenderer, lite: boolean): void {
  renderer.transmissionResolutionScale = lite ? 0.5 : 1;
}

/**
 * `compileAsync` needs `KHR_parallel_shader_compile` to actually run in parallel — and merely
 * asking three for a missing extension logs a console warning (Safari, software rasterisers).
 * Without it, `compileAsync` would do exactly the synchronous `compile` anyway.
 */
function compile(
  renderer: WebGLRenderer,
  object: Object3D,
  camera: Camera,
  targetScene: Scene | null,
): Promise<void> {
  try {
    if (renderer.extensions.has("KHR_parallel_shader_compile")) {
      return renderer.compileAsync(object, camera, targetScene).then(
        () => undefined,
        () => undefined,
      );
    }
    renderer.compile(object, camera, targetScene);
  } catch {
    // A failed compile shows up as a black mesh, not a crash; the ready signal still fires.
  }
  return Promise.resolve();
}

/** Compile every material in `scene` before the first visible frame. */
export function compileScene(renderer: WebGLRenderer, scene: Scene, camera: Camera): Promise<void> {
  return compile(renderer, scene, camera, null);
}

/**
 * Compile one subtree (visible objects only — three traverses with `traverseVisible`) with
 * the lights and environment of `scene`, so a big scene can compile in idle slices.
 */
export function compileObject(
  renderer: WebGLRenderer,
  object: Object3D,
  camera: Camera,
  scene: Scene,
): Promise<void> {
  return compile(renderer, object, camera, scene);
}

const pendingRelease = new WeakMap<WebGLRenderer, number>();

/**
 * Call from an effect keyed on the renderer; returns its cleanup. The release is deferred a
 * tick so React's StrictMode unmount/remount in development (which re-runs the effect at once)
 * cancels it instead of disposing a renderer that is still in use.
 */
export function retainRenderer(renderer: WebGLRenderer): () => void {
  const pending = pendingRelease.get(renderer);
  if (pending !== undefined) {
    window.clearTimeout(pending);
    pendingRelease.delete(renderer);
  }
  return () => {
    const id = window.setTimeout(() => {
      pendingRelease.delete(renderer);
      renderer.dispose();
    }, 0);
    pendingRelease.set(renderer, id);
  };
}
