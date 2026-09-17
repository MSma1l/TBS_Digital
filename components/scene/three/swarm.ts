/**
 * The morph swarm: one set of light particles that carries every change of shape — the
 * services model bursting out of a speck at its host (and imploding back), and one service
 * model turning into another. Each particle knows its place on all six shapes (`aS0` the
 * chip's silhouette, unplanned until the Work helix takes the slot; `aS1…aS5` the service
 * models in `SCENE_SHAPES` order), fixed for life, so a morph only sets uniforms: which two
 * slots, the two ends' world matrices, and the progress. The vertex shader does the rest
 * (materials.ts, `POINTS_MODE.swarm`); nothing moves on the CPU.
 *
 * A burst (`plan.from === BURST`) is the `to` slot at both ends: the frame's `fromMatrix`
 * shrinks it to a speck, so the shader's usual leave → cloud → arrive reads as an explosion
 * out of the centre that assembles into the model.
 *
 * It lives in world space (a direct child of the scene root, identity transform) and is only
 * drawn while a morph runs.
 */

import { BufferAttribute, BufferGeometry, Matrix4, Points, type Vector3 } from "three";
import type { ServiceModel } from "@/lib/scene";
import { BURST, type SwarmPlan } from "../choreography";
import { pointsDrawn, type SceneTierConfig } from "../tiers";
import { INK_SPRITES, POINTS_MODE, createPointsMaterial, paintPoints } from "./materials";
import type { ScenePalette } from "./palette";
import { SCENE_SEEDS, seedAttributes, swarmSlots } from "./samples";

export type SwarmFrame = {
  plan: SwarmPlan;
  /** For a burst: the speck (the `to` shape shrunk at its host's centre). */
  fromMatrix: Matrix4;
  toMatrix: Matrix4;
  /** World radius of the shapes at either end (the cloud swells between them). */
  fromRadius: number;
  toRadius: number;
  /** World scale at either end (sprite size follows the shapes). */
  fromScale: number;
  toScale: number;
  time: number;
  halfHeightPx: number;
  dpr: number;
};

export type Swarm = {
  points: Points;
  update(frame: SwarmFrame): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

export const SWARM_MAX_CSS_PX = 11;
const SWARM_SIZE = 0.065;
const SWARM_ALPHA = 1;

/** One-hot slot weights: slots 0–2 go to the first vector, 3–5 to the second. */
export function slotWeights(slot: number, a: Vector3, b: Vector3): void {
  a.set(slot === 0 ? 1 : 0, slot === 1 ? 1 : 0, slot === 2 ? 1 : 0);
  b.set(slot === 3 ? 1 : 0, slot === 4 ? 1 : 0, slot === 5 ? 1 : 0);
}

export function createSwarm(
  config: SceneTierConfig,
  models: readonly ServiceModel[],
  palette: ScenePalette,
): Swarm {
  const count = config.swarm;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  swarmSlots(config, models).forEach((samples, slot) => {
    geometry.setAttribute(`aS${slot}`, new BufferAttribute(samples, 3));
  });
  geometry.setAttribute("aSeed", new BufferAttribute(seedAttributes(count, SCENE_SEEDS.swarm), 4));

  const swarm = createPointsMaterial({
    mode: POINTS_MODE.swarm,
    roles: { a: "cyan", b: "blue", c: "red", hot: "hot" },
    alpha: SWARM_ALPHA,
    size: SWARM_SIZE,
  });
  const points = new Points(geometry, swarm.material);
  points.name = "scene-swarm";
  points.renderOrder = 8;
  points.frustumCulled = false;
  points.visible = false;

  const applyPalette = (next: ScenePalette) => {
    paintPoints(swarm, next);
    const ink = next.mode === "ink";
    swarm.uniforms.uAlpha.value = SWARM_ALPHA * (ink ? INK_SPRITES.alpha + 0.2 : 1);
    swarm.uniforms.uSize.value = SWARM_SIZE * (ink ? INK_SPRITES.size : 1);
  };
  applyPalette(palette);

  return {
    points,

    update(frame) {
      const { plan } = frame;
      const visible = plan.active && plan.t > 0 && plan.t < 1;
      points.visible = visible;
      if (!visible) return;
      const u = swarm.uniforms;
      u.uT.value = plan.t;
      slotWeights(plan.from === BURST ? plan.to : plan.from, u.uFromA.value, u.uFromB.value);
      slotWeights(plan.to, u.uToA.value, u.uToB.value);
      u.uFromM.value.copy(frame.fromMatrix);
      u.uToM.value.copy(frame.toMatrix);
      u.uFromR.value = frame.fromRadius;
      u.uToR.value = frame.toRadius;
      u.uScale.value = frame.fromScale + (frame.toScale - frame.fromScale) * plan.t;
      u.uTime.value = frame.time;
      u.uHalfHeight.value = frame.halfHeightPx;
      u.uMaxSize.value = SWARM_MAX_CSS_PX * frame.dpr;
    },

    setLite(lite) {
      geometry.setDrawRange(0, pointsDrawn(count, lite));
    },

    setPalette: applyPalette,

    dispose() {
      geometry.dispose();
      swarm.material.dispose();
    },
  };
}
