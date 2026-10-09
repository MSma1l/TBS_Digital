/**
 * Lighting for transmission glass, built on the GPU at startup.
 *
 * No HDR file and no network: a tiny scene of emissive strips inside a box is pre-filtered
 * once by `PMREMGenerator.fromScene` into an environment map. The strips become the neon
 * highlights sliding over the glass. (drei's `<Environment>` would pull in the HDR/EXR
 * loaders, and the CSP forbids fetching presets anyway.) Each scene passes its own strips.
 * The pre-filter's shaders link in parallel first, so building it never holds the main thread.
 */

import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  WebGLRenderTarget,
  type ShaderMaterial,
  type Texture,
  type WebGLRenderer,
} from "three";
import { compileObject } from "./renderer";

export type EnvStrip = {
  color: Color;
  /** HDR multiplier: the env is rendered to a half-float target, so > 1 is kept. */
  intensity: number;
  size: readonly [number, number];
  position: readonly [number, number, number];
};

export type StripEnvironment = {
  texture: Texture;
  dispose(): void;
};

type StripOptions = { room: Color; strips: readonly EnvStrip[]; sigma?: number };

/** The scene `fromScene` films, and the release of everything in it. */
type StripScene = { scene: Scene; dispose(): void };

/** `strips` (each facing the origin) inside a 10-unit box of `room`. */
function createStripScene(room: Color, strips: readonly EnvStrip[]): StripScene {
  const scene = new Scene();
  const disposables: Array<{ dispose(): void }> = [];

  const roomGeometry = new BoxGeometry(10, 10, 10);
  const roomMaterial = new MeshBasicMaterial({ color: room, side: BackSide });
  scene.add(new Mesh(roomGeometry, roomMaterial));
  disposables.push(roomGeometry, roomMaterial);

  for (const strip of strips) {
    const geometry = new PlaneGeometry(strip.size[0], strip.size[1]);
    const material = new MeshBasicMaterial({
      color: strip.color.clone().multiplyScalar(strip.intensity),
      side: DoubleSide,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(strip.position[0], strip.position[1], strip.position[2]);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
    disposables.push(geometry, material);
  }

  return {
    scene,
    dispose: () => {
      for (const item of disposables) item.dispose();
    },
  };
}

/**
 * A PMREM environment of `strips` (each facing the origin) inside a 10-unit box of `room`.
 * `sigma` is the pre-filter blur (0.02 keeps thin strips crisp on low-roughness glass).
 *
 * One `fromScene(scene, sigma)` call — default size, near, far and position — made only once
 * every program it draws with has linked. Why: `fromScene` draws with four programs it has never
 * met — the room's and the strips' MeshBasic, the 20-sample blur, the 256-sample GGX filter — and
 * three links each one inside `render()`, where its first use reads the link status back: the
 * main thread waits on every link in turn, one after another. Measured on the intro (real GPU,
 * high tier, 2026-10-07): one 637ms task, 597ms of it in 25 synchronous `GetProgramiv` waits —
 * the counter, the bar and the drawing frozen for over half a second, then the director's film
 * clock jumping its 150ms frame cap. Compiled first through `compileAsync`, the four link in
 * parallel off the main thread (`KHR_parallel_shader_compile`) while the film plays on, and
 * `fromScene` then finds every one of them ready. The texels are the ones the synchronous build
 * made: the same scene, the same call, the same programs.
 *
 * Without `KHR_parallel_shader_compile` the warm-up compiles synchronously and resolves at
 * once, and `fromScene` waits on the links as it always did. Resolves `null` when `cancelled()`
 * by then (the owner unmounted): the generator and the strip scene are disposed and there is
 * nothing to install.
 */
export async function createStripEnvironment(
  renderer: WebGLRenderer,
  { room, strips, sigma = 0.02 }: StripOptions,
  cancelled: () => boolean,
): Promise<StripEnvironment | null> {
  const strip = createStripScene(room, strips);
  const generator = new PMREMGenerator(renderer);
  const warming = warmPmremPrograms(renderer, generator, strip.scene);
  // Nothing to wait for (another three's generator): fromScene links its own programs, as before.
  if (warming) await warming;
  if (cancelled()) {
    generator.dispose();
    strip.dispose();
    return null;
  }
  // A miss would cost only the speed — fromScene links what it lacks, as it always did — and
  // otherwise go unnoticed: a development build names it.
  const programs = renderer.info.programs;
  const linked = programs?.length ?? 0;
  const target = generator.fromScene(strip.scene, sigma);
  if (process.env.NODE_ENV === "development" && warming && programs && programs.length > linked) {
    console.warn(
      `PMREM environment: the warm-up missed ${programs.length - linked} program(s), which ` +
        "fromScene linked on the main thread after all (a program key changed: warmPmremPrograms).",
    );
  }
  generator.dispose();
  strip.dispose();
  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/** `fromScene`'s default `size`, the face size its filters' CUBEUV defines are derived from. */
const PMREM_SIZE = 256;

/**
 * What the warm-up reads off a PMREMGenerator: r186 private members (three is pinned to exactly
 * 0.186.0). A fresh r186 generator has all five — the two methods, the planes as `[]`, both
 * filters as `null` — so any other shape is another three, and the warm-up stands aside.
 */
type PmremInternals = {
  _setSize(cubeSize: number): void;
  _allocateTargets(): WebGLRenderTarget;
  _lodMeshes: readonly Mesh[];
  _blurMaterial: ShaderMaterial | null;
  _ggxMaterial: ShaderMaterial | null;
};

function pmremInternals(generator: PMREMGenerator): PmremInternals | null {
  const pmrem = generator as unknown as Partial<PmremInternals>;
  const r186 =
    typeof pmrem._setSize === "function" &&
    typeof pmrem._allocateTargets === "function" &&
    Array.isArray(pmrem._lodMeshes) &&
    pmrem._blurMaterial === null &&
    pmrem._ggxMaterial === null;
  return r186 ? (pmrem as PmremInternals) : null;
}

/**
 * Compile every program `generator.fromScene(scene)` will draw with, in parallel, before it runs.
 * `null` — nothing compiled, nothing to wait for — when the generator is not the r186 one this
 * was written against.
 */
function warmPmremPrograms(
  renderer: WebGLRenderer,
  generator: PMREMGenerator,
  scene: Scene,
): Promise<unknown> | null {
  const pmrem = pmremInternals(generator);
  if (!pmrem) return null;

  // fromScene's own first two calls, made early: the face size, then the ping-pong target, the
  // per-LOD planes and the two filter materials. fromScene makes both again with the same size,
  // and `_allocateTargets` then keeps everything built here; the CUBEUV target it returns now
  // was never bound, so it holds no GPU memory to give back.
  pmrem._setSize(PMREM_SIZE);
  pmrem._allocateTargets().dispose();
  const blurPlane = pmrem._lodMeshes[0]?.geometry; // the blur draws on LOD 0's plane
  const ggxPlane = pmrem._lodMeshes[1]?.geometry; // the GGX filter on LOD 1's and the rest
  const blur = pmrem._blurMaterial;
  const ggx = pmrem._ggxMaterial;
  if (!blurPlane || !ggxPlane || !blur || !ggx) return null;

  // Compiled exactly as fromScene draws, or three keys another program and fromScene links its
  // own after all (only the gain is lost; the texels cannot change):
  //  · into a plain render target, as every fromScene draw is: with a target bound, three keys a
  //    program on the working colour space and no tone mapping instead of the canvas's;
  //  · on the generator's own planes: r186 keys a program on its geometry too (whether there is
  //    a `position` to bind to location 0, whether there are normals) — a bare BufferGeometry,
  //    what PMREMGenerator's own `_compileMaterial` uses, is the other variant;
  //  · against the strip scene, which has no lights: light counts are in every key, an unlit
  //    material's included.
  // The background box fromScene adds is MeshBasic on its back side, so it shares the room's
  // program. The camera plays no part: compile only reads its layers, for lights.
  const filters = new Group().add(new Mesh(blurPlane, blur), new Mesh(ggxPlane, ggx));
  const camera = new PerspectiveCamera(90, 1, 0.1, 100);
  const previous = renderer.getRenderTarget();
  const face = renderer.getActiveCubeFace();
  const level = renderer.getActiveMipmapLevel();
  const linear = new WebGLRenderTarget(1, 1, { depthBuffer: false });
  try {
    renderer.setRenderTarget(linear);
    // In parallel only with KHR_parallel_shader_compile; without it `compileObject` compiles
    // synchronously and resolves at once (see renderer.ts).
    return Promise.all([
      compileObject(renderer, scene, camera, scene),
      compileObject(renderer, filters, camera, scene),
    ]);
  } finally {
    // compile keys every program as it is called: the target is done with once they return.
    renderer.setRenderTarget(previous, face, level);
    linear.dispose();
  }
}

type ScenePrefs = {
  environment: Texture | null;
  onBeforeRender: Scene["onBeforeRender"];
};

/**
 * The value to hand `setClearColor` so that a later clear of a LINEAR render target lands on
 * `color` itself (its working-colour-space components), for a call made while the canvas —
 * no render target — is bound.
 *
 * three converts a clear colour when it is SET, into the colour space of what is bound at that
 * moment (`WebGLBackground.setClear` → `getUnlitUniformColorSpace`): the canvas's output space,
 * sRGB. The transmission pass then clears its half-float target, which is linear, with that
 * already-converted value — a near-black page (≈0.003 linear) cleared it to ≈0.04, and glass
 * refracted a grey room. Reading the working components as if they were in the output space
 * cancels that conversion exactly.
 */
export function linearTargetClearColor(
  color: Color,
  outputColorSpace: string,
  out: Color = new Color(),
): Color {
  return out.setRGB(color.r, color.g, color.b, outputColorSpace);
}

/**
 * Use `environment` for `scene` and make transmission work on a transparent canvas. Returns
 * the undo (which does not dispose `environment` — its creator owns it).
 *
 * The transmission pass clears its own render target to "white at 50%" whenever the
 * renderer's clear alpha is below 1, so glass over an `alpha: true` canvas renders milky
 * grey. Instead, the scene clears the canvas itself to fully transparent before each render
 * and leaves the clear colour at opaque `clearColor`: the transmission target then shows that
 * colour (the glass refracts it), while the canvas stays see-through around the object.
 *
 * `clearColor` is the page colour as three holds it (working space). The opaque clear is
 * pre-compensated for three's output-space conversion (`linearTargetClearColor`), so the
 * linear transmission target really is cleared to it — callers pass the plain colour.
 * Relies on three r186's pass order (transmission target before the main pass).
 */
export function installTransmissionClear(
  renderer: WebGLRenderer,
  scene: Scene,
  clearColor: Color,
  environment: Texture | null,
): () => void {
  const previous: ScenePrefs = {
    environment: scene.environment,
    onBeforeRender: scene.onBeforeRender,
  };
  const previousAutoClear = renderer.autoClear;
  const opaque = new Color();
  /* Compensated only while the canvas is bound: into a target, three converts to working space. */
  const opaqueClear = (gl: WebGLRenderer): Color =>
    gl.getRenderTarget() === null
      ? linearTargetClearColor(clearColor, gl.outputColorSpace, opaque)
      : opaque.copy(clearColor);

  scene.environment = environment;
  renderer.autoClear = false;
  renderer.setClearColor(opaqueClear(renderer), 1);
  scene.onBeforeRender = (gl) => {
    gl.setClearColor(clearColor, 0);
    gl.clear();
    gl.setClearColor(opaqueClear(gl), 1);
  };

  return () => {
    scene.environment = previous.environment;
    scene.onBeforeRender = previous.onBeforeRender;
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(clearColor, 0);
  };
}
