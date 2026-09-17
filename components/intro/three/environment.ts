/**
 * Lighting for the high tier's transmission glass, built on the GPU at startup.
 *
 * A tiny scene of emissive strips — red above, blue to the left, a thin white bar in front —
 * inside a dark box, pre-filtered once into an environment map: the strips become the neon
 * highlights sliding over the glass as the ∞ sways. The PMREM build and the transparent-canvas
 * transmission trick are shared with the interior scene (components/three/environment.ts);
 * the strip layout, tuned for the ∞, stays here.
 */

import type { Scene, WebGLRenderer } from "three";
import {
  createStripEnvironment,
  installTransmissionClear,
  type EnvStrip,
  type StripEnvironment,
} from "@/components/three/environment";
import type { IntroPalette } from "./materials";

export type NeonEnvironment = StripEnvironment;

function strips(palette: IntroPalette): EnvStrip[] {
  // Thin, bright strips rather than broad panels: on low-roughness glass they read as crisp
  // highlight lines; wide panels would wash the whole tube in colour.
  return [
    // Red overhead: the neon line along the top of every tube section.
    { color: palette.red, intensity: 7, size: [9, 0.35], position: [0, 4.6, 1.2] },
    // Blue from the left: a cool edge on the left lobe.
    { color: palette.blue, intensity: 6, size: [0.35, 7], position: [-4.6, 0.3, 0.8] },
    // A thin white bar in front and above: the glint that says "glass".
    { color: palette.txt, intensity: 4, size: [2.6, 0.12], position: [1.6, 3.2, 4.6] },
    // Faint rims so the far sides still carry colour.
    { color: palette.redLift, intensity: 2, size: [0.3, 4], position: [4.6, 1, -1.6] },
    { color: palette.cyan, intensity: 2, size: [7, 0.25], position: [0, -4.6, -0.8] },
  ];
}

export function createNeonEnvironment(
  renderer: WebGLRenderer,
  palette: IntroPalette,
): NeonEnvironment {
  return createStripEnvironment(renderer, { room: palette.voidBg, strips: strips(palette) });
}

/**
 * Use the neon environment for `scene` and make transmission work on a transparent canvas,
 * clearing the transmission target to opaque void (dark glass refracting the pulse line).
 * Returns the undo, which also disposes the environment.
 */
export function installNeonEnvironment(
  renderer: WebGLRenderer,
  scene: Scene,
  palette: IntroPalette,
): () => void {
  const environment = createNeonEnvironment(renderer, palette);
  const undo = installTransmissionClear(renderer, scene, palette.voidBg, environment.texture);
  return () => {
    undo();
    environment.dispose();
  };
}
