/**
 * The interior scene as one imperative object: the hero chip, the morph swarm, the cursor
 * trail and the five service models, composed every frame from the scroll probe, the page's
 * input store and the choreography. The chip dissolves on its own host as the hero leaves; the
 * services model bursts out of a speck at its host once the entry gate arms (fx.ts), and the
 * swarm carries that burst and every pill morph after it. `SceneWorld.tsx` creates it once,
 * builds it part by part, calls `update` from `useFrame` and disposes it on unmount; every
 * per-frame write lives here (React Compiler lint).
 *
 * Built in parts, one idle slice each (`buildNext`): the chip first, then the swarm, then the
 * trail, then one service model at a time. Building all of them in one go was a single
 * 181–229ms main-thread task on the mid-tier phone profile (4× CPU). Until every part exists
 * nothing is composed, and the root draws nothing until its first compiled part is queued for
 * the pre-warm frame — so a frame between two slices never compiles a shader.
 */

import { Group, Matrix4, Quaternion, Vector3, type Object3D } from "three";
import {
  SCENE_SHAPES,
  SERVICE_MODEL,
  scrollProgress,
  type SceneInput,
  type ScrollProbe,
  type ServiceModel,
} from "@/lib/scene";
import {
  BURST,
  composeScene,
  coreExitPose,
  coreReveal,
  type CorePose,
  createComposition,
  createMorph,
  layoutFor,
  morphRunning,
  placeCore,
  placeServices,
  revealOf,
  stepMorph,
  type Placement,
  type SceneLayout,
} from "../choreography";
import { stepSceneFx, type SceneFx } from "../fx";
import { MODEL_RADIUS } from "../shapes";
import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";
import { createChipCore, type ChipCore, type CoreFrame } from "./core";
import { createCommerceLoopModel } from "./models/commerceLoop";
import { createCubesModel } from "./models/cubes";
import { createIntegrationHubModel } from "./models/integrationHub";
import { createMeshWaveModel } from "./models/meshWave";
import { createNeuralModel } from "./models/neural";
import { MODEL_SWAY, type ModelFrame, type SceneModel } from "./models/types";
import type { ScenePalette } from "./palette";
import { createSwarm, type Swarm, type SwarmFrame } from "./swarm";
import { createTrailMesh, type TrailFrame, type TrailMesh } from "./trail";

/** What the world needs of R3F's root state (structural, so the world stays R3F-free). */
export type WorldView = { size: { width: number; height: number }; viewport: { dpr: number } };

export type SceneWorld = {
  root: Group;
  /** Build the next missing part: the chip, the swarm, the trail, then each service model in order. */
  buildNext(): void;
  /** Every part is built (`update` composes nothing before). */
  complete(): boolean;
  /**
   * What to compile once complete, in order, one stage per part: the chip (each of its draw
   * objects on its own), the swarm, the trail, then one stage per model.
   */
  compileStages(): Object3D[][];
  /**
   * These objects compiled: draw their parts once more at reveal 0 on the next frame (buffers
   * upload, every fragment discards). The root starts drawing with the first such stage.
   */
  prewarm(objects: readonly Object3D[]): void;
  /** One frame: `scrollY` read once by the caller, the canvas's size from `view`. */
  update(
    dt: number,
    scrollY: number,
    view: WorldView,
    coarse: boolean,
    probe: ScrollProbe,
    input: Readonly<SceneInput>,
    fx: SceneFx,
  ): void;
  morphRunning(): boolean;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

const MODEL_FACTORIES: Readonly<Record<ServiceModel, typeof createCubesModel>> = {
  cubes: createCubesModel,
  "mesh-wave": createMeshWaveModel,
  neural: createNeuralModel,
  "commerce-loop": createCommerceLoopModel,
  "integration-hub": createIntegrationHubModel,
};

/**
 * The burst's speck, as fractions of the services placement: the `to` shape shrunk to this
 * scale at the host's centre, a cloud this much wider than the model (it overshoots, then
 * converges), sprites starting at this share of their size.
 */
export const BURST_SPECK = { scale: 0.05, radius: 1.35, sprite: 0.5 } as const;

/** Only the root: every part comes from `buildNext`, one idle slice apart. */
export function createSceneWorld(tier: SceneCanvasTier, initialPalette: ScenePalette): SceneWorld {
  const config = SCENE_TIER_CONFIG[tier];
  const root = new Group();
  root.name = "scene-root";
  // Nothing draws until the first compiled part is pre-warmed (see `prewarm`).
  root.visible = false;

  const kinds = SCENE_SHAPES.map((shape) => SERVICE_MODEL[shape]);
  /** The palette and the lite step as they are now: a part built later starts from them. */
  let palette = initialPalette;
  let lite = false;
  let core: ChipCore | null = null;
  let swarm: Swarm | null = null;
  let trail: TrailMesh | null = null;
  const models: SceneModel[] = [];

  const morph = createMorph(0);
  const plan = createComposition();
  const shown = models.map(() => false);
  const prewarmQueue = new Set<Object3D>();
  const burstMatrix = new Matrix4();
  const corePlace: Placement = { x: 0, y: 0, scale: 1 };
  const servicesSpot: Placement = { x: 0, y: 0, scale: 1 };
  const pose: CorePose = { scale: 1, lift: 0, dim: 1 };
  const coreFrame: CoreFrame = {
    time: 0,
    step: 0,
    tx: 0,
    ty: 0,
    boost: 0,
    wave: 1,
    reveal: 1,
    prewarm: false,
    lift: 0,
    dim: 1,
  };
  const modelFrame: ModelFrame = { time: 0, step: 0, reveal: 0, prewarm: false, tx: 0, ty: 0, halfHeightPx: 1, dpr: 1 };
  const swarmFrame: SwarmFrame = {
    plan: plan.swarm,
    fromMatrix: burstMatrix,
    toMatrix: burstMatrix,
    fromRadius: 1,
    toRadius: 1,
    fromScale: 1,
    toScale: 1,
    time: 0,
    halfHeightPx: 1,
    dpr: 1,
  };
  /** Created on the first frame, when the trail buffer (in `fx`) is known; then only rewritten. */
  let trailFrame: TrailFrame | null = null;
  const identity = new Quaternion();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  let layoutW = -1;
  let layoutH = -1;
  let layoutCoarse = false;
  let layoutInk = false;
  let layout: SceneLayout = layoutFor(1280, 800, false);

  /** A planned slot's world matrix: a service model's, or the burst's speck (slot 0 is never planned). */
  const matrixFor = (slot: number): Matrix4 => (slot >= 1 ? models[slot - 1].group.matrixWorld : burstMatrix);

  /** The part (a direct child of the root) an object belongs to. */
  const partOf = (object: Object3D): Object3D => {
    let node = object;
    while (node.parent && node.parent !== root) node = node.parent;
    return node;
  };

  return {
    root,

    buildNext() {
      if (!core) {
        core = createChipCore(config, palette);
        core.setLite(lite);
        core.group.visible = true;
        root.add(core.group);
      } else if (!swarm) {
        swarm = createSwarm(config, kinds, palette);
        swarm.setLite(lite);
        root.add(swarm.points);
      } else if (!trail) {
        trail = createTrailMesh(palette);
        trail.mesh.name = "scene-trail";
        root.add(trail.mesh);
      } else if (models.length < kinds.length) {
        const model = MODEL_FACTORIES[kinds[models.length]](config, palette);
        model.setLite(lite);
        model.group.visible = false;
        models.push(model);
        root.add(model.group);
      }
    },

    complete() {
      return core !== null && swarm !== null && trail !== null && models.length === kinds.length;
    },

    compileStages() {
      if (!core || !swarm || !trail) return [];
      return [core.objects, [swarm.points], [trail.mesh], ...models.map((model) => [model.group])];
    },

    prewarm(objects) {
      for (const object of objects) prewarmQueue.add(partOf(object));
      if (objects.length > 0) root.visible = true;
    },

    update(dt, scrollY, view, coarse, probe, input, fx) {
      if (!core || !swarm || !trail || models.length < kinds.length) return;
      const w = view.size.width;
      const h = view.size.height;
      const dpr = view.viewport.dpr;
      const ink = palette.mode === "ink";
      if (w !== layoutW || h !== layoutH || coarse !== layoutCoarse || ink !== layoutInk) {
        layoutW = w;
        layoutH = h;
        layoutCoarse = coarse;
        layoutInk = ink;
        layout = layoutFor(w, h, coarse, ink);
      }

      const heroExit = probe.live ? scrollProgress(scrollY, probe.heroExit) : 0;
      const entrySpan = probe.live && probe.services ? probe.entry : null;
      const step = stepSceneFx(fx, dt, input, heroExit, scrollY, entrySpan);
      // Until the model has assembled, the entrance owns the swarm: a pill switch is instant.
      stepMorph(morph, input.shape, step, fx.entry.value < 1);
      composeScene(fx.entry.value, morph, plan);

      const halfHeightPx = h * dpr * 0.5;
      placeCore(probe, scrollY, w, h, layout, corePlace);
      const services = placeServices(probe, scrollY, w, h, layout, servicesSpot) ?? corePlace;
      coreExitPose(fx.heroExit, layout, pose);

      /* the chip: on its own host, dissolving as the hero leaves */
      const coreScale = corePlace.scale * pose.scale;
      core.group.position.set(corePlace.x, corePlace.y, 0);
      core.group.scale.setScalar(coreScale);
      coreFrame.time = fx.time;
      coreFrame.step = step;
      coreFrame.tx = fx.tx;
      coreFrame.ty = fx.ty;
      coreFrame.boost = fx.boost;
      coreFrame.wave = fx.wave;
      coreFrame.reveal = coreReveal(fx.heroExit);
      coreFrame.prewarm = prewarmQueue.has(core.group);
      coreFrame.lift = pose.lift;
      coreFrame.dim = pose.dim;
      core.update(coreFrame);

      /* the service models: placed every frame (the swarm reads their matrices), drawn when revealed */
      const sway = Math.sin(fx.time * MODEL_SWAY.speed) * MODEL_SWAY.amplitude;
      modelFrame.time = fx.time;
      modelFrame.tx = fx.tx;
      modelFrame.ty = fx.ty;
      modelFrame.halfHeightPx = halfHeightPx;
      modelFrame.dpr = dpr;
      for (let index = 0; index < models.length; index += 1) {
        const model = models[index];
        const reveal = revealOf(plan, index);
        const group = model.group;
        group.position.set(services.x, services.y, 0);
        group.scale.setScalar(services.scale);
        group.rotation.set(-fx.ty * 0.13, sway + fx.tx * 0.2, 0);
        // Only this group's own matrix is needed now (the swarm reads it); render updates the rest.
        group.updateMatrix();
        group.matrixWorld.multiplyMatrices(root.matrixWorld, group.matrix);
        const prewarm = prewarmQueue.has(group);
        if (reveal > 0 && !shown[index]) model.resetCycle();
        shown[index] = reveal > 0;
        if (reveal > 0 || prewarm) {
          modelFrame.reveal = reveal;
          modelFrame.prewarm = prewarm;
          // A model's own cycle (the cubes' hold → explode → float → assemble, a hub's packets)
          // waits at its start until the model is fully revealed: the swarm lands on that pose,
          // and a formed entrance begins with the whole first phase (the cubes' block held 1.4s).
          modelFrame.step = reveal < 1 ? 0 : step;
          model.update(modelFrame);
        } else {
          group.visible = false;
        }
      }

      /* the swarm: a burst leaves from a speck of the selected model at the services centre */
      const burst = plan.swarm.from === BURST;
      if (burst) {
        burstMatrix.compose(
          scratchPosition.set(services.x, services.y, 0),
          identity,
          scratchScale.setScalar(services.scale * BURST_SPECK.scale),
        );
      }
      swarmFrame.plan = plan.swarm;
      swarmFrame.fromMatrix = matrixFor(plan.swarm.from);
      swarmFrame.toMatrix = matrixFor(plan.swarm.to);
      swarmFrame.fromRadius = MODEL_RADIUS * services.scale * (burst ? BURST_SPECK.radius : 1);
      swarmFrame.toRadius = MODEL_RADIUS * services.scale;
      swarmFrame.fromScale = services.scale * (burst ? BURST_SPECK.sprite : 1);
      swarmFrame.toScale = services.scale;
      swarmFrame.time = fx.time;
      swarmFrame.halfHeightPx = halfHeightPx;
      swarmFrame.dpr = dpr;
      swarm.update(swarmFrame);
      if (prewarmQueue.has(swarm.points)) swarm.points.visible = true;

      /* the cursor trail, in document px */
      if (!trailFrame) {
        trailFrame = { trail: fx.trail, scrollY, probe, w, h, ink };
      } else {
        trailFrame.trail = fx.trail;
        trailFrame.scrollY = scrollY;
        trailFrame.probe = probe;
        trailFrame.w = w;
        trailFrame.h = h;
        trailFrame.ink = ink;
      }
      trail.update(trailFrame);

      prewarmQueue.clear();
    },

    morphRunning() {
      return morphRunning(morph);
    },

    setLite(next) {
      lite = next;
      core?.setLite(lite);
      swarm?.setLite(lite);
      for (const model of models) model.setLite(lite);
    },

    setPalette(next) {
      palette = next;
      core?.setPalette(next);
      swarm?.setPalette(next);
      trail?.setPalette(next);
      for (const model of models) model.setPalette(next);
    },

    dispose() {
      core?.dispose();
      swarm?.dispose();
      trail?.dispose();
      for (const model of models) model.dispose();
      root.clear();
    },
  };
}
