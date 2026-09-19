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
  // highlight lines; wide panels would wash the whole surface in colour.
  //
  // Re-aimed for a FLAT PANE. The ∞'s layout put broad strips square above, left and in front of
  // a tube: a tube carries every direction at once, so a wide source slides along it as a moving
  // line. The one transmissive surface left is the lid's cover glass — 2.4 x 1.5 and flat — and a
  // flat mirror samples one narrow cone of the environment, so a source that is square-on lands
  // as a single broad wash over the whole pane and a source that is not lands nowhere at all.
  // Narrower strips, set OBLIQUE to the open lid's normal (0, 0.29, 0.96) rather than facing it,
  // and brighter to pay for the smaller solid angle: what sweeps the pane as the lid comes up is
  // then a hard-edged streak crossing it, which is the only thing that says "glass" at 1×.
  return [
    // Red overhead and forward: the streak that runs down the pane as the lid rises past it.
    { color: palette.red, intensity: 9, size: [7, 0.22], position: [0, 4.2, 2.2] },
    // Blue from the left and slightly ahead: the cool edge down the lid's left side.
    { color: palette.blue, intensity: 8, size: [0.22, 6], position: [-4.4, 1, 1.4] },
    // The hard white glint, up and in front and off to the right — the one that says "glass".
    { color: palette.txt, intensity: 7, size: [2.2, 0.09], position: [1.4, 2.4, 4.4] },
    // Faint rims so the far sides and the underside still carry colour.
    { color: palette.redLift, intensity: 3, size: [0.22, 4], position: [4.4, 0.8, -1.8] },
    { color: palette.cyan, intensity: 2.6, size: [5, 0.18], position: [0, -4.2, 1.6] },
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
