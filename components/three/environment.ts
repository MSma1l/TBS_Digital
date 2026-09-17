/**
 * Lighting for transmission glass, built on the GPU at startup.
 *
 * No HDR file and no network: a tiny scene of emissive strips inside a box is pre-filtered
 * once by `PMREMGenerator.fromScene` into an environment map. The strips become the neon
 * highlights sliding over the glass. (drei's `<Environment>` would pull in the HDR/EXR
 * loaders, and the CSP forbids fetching presets anyway.) Each scene passes its own strips.
 */

import {
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  type Texture,
  type WebGLRenderer,
} from "three";

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

/**
 * A PMREM environment of `strips` (each facing the origin) inside a 10-unit box of `room`.
 * `sigma` is the pre-filter blur (0.02 keeps thin strips crisp on low-roughness glass).
 */
export function createStripEnvironment(
  renderer: WebGLRenderer,
  { room, strips, sigma = 0.02 }: { room: Color; strips: readonly EnvStrip[]; sigma?: number },
): StripEnvironment {
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

  const generator = new PMREMGenerator(renderer);
  const target = generator.fromScene(scene, sigma);
  generator.dispose();
  for (const item of disposables) item.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
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
