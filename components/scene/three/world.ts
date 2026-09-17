/**
 * The interior scene as one imperative object: the hero core, the morph swarm and the five
 * service models, composed every frame from the scroll probe, the page's input store and the
 * choreography. `SceneWorld.tsx` creates it once, builds it part by part, calls `update` from
 * `useFrame` and disposes it on unmount; every per-frame write lives here (React Compiler lint).
 *
 * Built in parts, one idle slice each (`buildNext`): the core first, then the swarm, then one
 * service model at a time. Building all seven in one go was a single 181–229ms main-thread
 * task on the mid-tier phone profile (4× CPU). Until every part exists nothing is composed,
 * and the root draws nothing until its first compiled part is queued for the pre-warm frame —
 * so a frame between two slices never compiles a shader.
 */

import {
  Color,
  Group,
  Matrix4,
  Quaternion,
  Vector3,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import { createStripEnvironment, installTransmissionClear, type EnvStrip } from "@/components/three/environment";
import { setTransmissionScale } from "@/components/three/renderer";
import {
  SCENE_SHAPES,
  SERVICE_MODEL,
  scrollProgress,
  type SceneInput,
  type ScrollProbe,
  type ServiceModel,
} from "@/lib/scene";
import {
  composeScene,
  coreExitPose,
  type CorePose,
  createComposition,
  createMorph,
  layoutFor,
  mixPlacement,
  morphRunning,
  placeCore,
  placeServices,
  revealOf,
  smoothstep,
  stepMorph,
  type Placement,
  type SceneLayout,
} from "../choreography";
import { stepSceneFx, type SceneFx } from "../fx";
import { CORE, MODEL_RADIUS } from "../shapes";
import { SCENE_LITE, SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";
import { createCyberneticCore, type CoreFrame, type CyberneticCore } from "./core";
import { toColor } from "./materials";
import { createCommerceLoopModel } from "./models/commerceLoop";
import { createCubesModel } from "./models/cubes";
import { createIntegrationHubModel } from "./models/integrationHub";
import { createMeshWaveModel } from "./models/meshWave";
import { createNeuralModel } from "./models/neural";
import { MODEL_SWAY, type ModelFrame, type SceneModel } from "./models/types";
import type { ScenePalette } from "./palette";
import { createSwarm, type Swarm, type SwarmFrame } from "./swarm";

/** What the world needs of R3F's root state (structural, so the world stays R3F-free). */
export type WorldView = { size: { width: number; height: number }; viewport: { dpr: number } };

export type SceneWorld = {
  root: Group;
  /** Build the next missing part: the core, the swarm, then each service model in order. */
  buildNext(): void;
  /** Every part is built (`update` composes nothing before). */
  complete(): boolean;
  /**
   * What to compile once complete, in order, one stage per part: the core (each of its draw
   * objects on its own), the swarm, then one stage per model.
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
  setLite(lite: boolean, renderer: WebGLRenderer): void;
  setPalette(palette: ScenePalette): void;
  /** High tier: the glass's strip environment and the transmission clear; returns the undo. */
  installEnvironment(renderer: WebGLRenderer, scene: Scene, palette: ScenePalette): () => void;
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
 * The glass's neon room: a cyan arc of short strips upper left, a red bar on the right, a
 * soft white box in front and above, a blue floor strip — on the page's own colour.
 */
function environmentStrips(palette: ScenePalette): EnvStrip[] {
  const cyan = toColor(palette.cyan);
  const red = toColor(palette.red);
  const blue = toColor(palette.blue);
  const soft = toColor(palette.glassTint);
  const light = palette.mode === "ink" ? 0.45 : 0.7;
  return [
    { color: cyan, intensity: 6 * light, size: [1.5, 0.2], position: [-4.4, 2.6, 2.4] },
    { color: cyan, intensity: 6 * light, size: [1.5, 0.2], position: [-3.6, 3.6, 1.9] },
    { color: cyan, intensity: 6 * light, size: [1.4, 0.2], position: [-2.4, 4.4, 1.4] },
    { color: cyan, intensity: 5 * light, size: [1.2, 0.18], position: [-4.8, 1.4, 2.8] },
    { color: red, intensity: 6 * light, size: [0.3, 6], position: [4.6, 0.2, 1.0] },
    { color: soft, intensity: 3.5 * light, size: [2.2, 0.8], position: [0.8, 3.4, 4.4] },
    { color: blue, intensity: 4 * light, size: [7, 0.4], position: [0, -4.6, 0.6] },
  ];
}

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
  let core: CyberneticCore | null = null;
  let swarm: Swarm | null = null;
  const models: SceneModel[] = [];

  const morph = createMorph(0);
  const plan = createComposition();
  const shown = models.map(() => false);
  const prewarmQueue = new Set<Object3D>();
  const coreMatrix = new Matrix4();
  const coreSpot: Placement = { x: 0, y: 0, scale: 1 };
  const corePlace: Placement = { x: 0, y: 0, scale: 1 };
  const servicesSpot: Placement = { x: 0, y: 0, scale: 1 };
  const pose: CorePose = { scale: 1, rings: 1, dim: 1 };
  const coreFrame: CoreFrame = {
    time: 0,
    step: 0,
    tx: 0,
    ty: 0,
    boost: 0,
    wave: 1,
    reveal: 1,
    prewarm: false,
    rings: 1,
    dim: 1,
    halfHeightPx: 1,
    dpr: 1,
  };
  const modelFrame: ModelFrame = { time: 0, step: 0, reveal: 0, prewarm: false, tx: 0, ty: 0, halfHeightPx: 1, dpr: 1 };
  const swarmFrame: SwarmFrame = {
    plan: plan.swarm,
    fromMatrix: coreMatrix,
    toMatrix: coreMatrix,
    fromRadius: 1,
    toRadius: 1,
    fromScale: 1,
    toScale: 1,
    time: 0,
    halfHeightPx: 1,
    dpr: 1,
  };
  const identity = new Quaternion();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  let layoutW = -1;
  let layoutH = -1;
  let layoutCoarse = false;
  let layoutInk = false;
  let layout: SceneLayout = layoutFor(1280, 800, false);

  const matrixFor = (slot: number): Matrix4 => (slot === 0 ? coreMatrix : models[slot - 1].group.matrixWorld);

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
        core = createCyberneticCore(config, palette);
        core.setLite(lite);
        core.group.visible = true;
        root.add(core.group);
      } else if (!swarm) {
        swarm = createSwarm(config, kinds, palette);
        swarm.setLite(lite);
        root.add(swarm.points);
      } else if (models.length < kinds.length) {
        const model = MODEL_FACTORIES[kinds[models.length]](config, palette);
        model.setLite(lite);
        model.group.visible = false;
        models.push(model);
        root.add(model.group);
      }
    },

    complete() {
      return core !== null && swarm !== null && models.length === kinds.length;
    },

    compileStages() {
      if (!core || !swarm) return [];
      return [core.objects, [swarm.points], ...models.map((model) => [model.group])];
    },

    prewarm(objects) {
      for (const object of objects) prewarmQueue.add(partOf(object));
      if (objects.length > 0) root.visible = true;
    },

    update(dt, scrollY, view, coarse, probe, input, fx) {
      if (!core || !swarm || models.length < kinds.length) return;
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
      const handoff = probe.live && probe.services ? scrollProgress(scrollY, probe.handoff) : 0;
      const step = stepSceneFx(fx, dt, input, heroExit, handoff);
      stepMorph(morph, input.shape, step, fx.handoff < 1);
      composeScene(fx.handoff, morph, plan);

      const halfHeightPx = h * dpr * 0.5;
      placeCore(probe, scrollY, w, h, layout, corePlace);
      const services = placeServices(probe, scrollY, w, h, layout, servicesSpot) ?? corePlace;
      coreExitPose(fx.heroExit, layout, pose);

      /* the core, drifting to the services host as it collapses */
      mixPlacement(corePlace, services, smoothstep(0, 0.5, fx.handoff), coreSpot);
      const coreScale = corePlace.scale * pose.scale;
      core.group.position.set(coreSpot.x, coreSpot.y, 0);
      core.group.scale.setScalar(coreScale);
      coreFrame.time = fx.time;
      coreFrame.step = step;
      coreFrame.tx = fx.tx;
      coreFrame.ty = fx.ty;
      coreFrame.boost = fx.boost;
      coreFrame.wave = fx.wave;
      coreFrame.reveal = plan.core;
      coreFrame.prewarm = prewarmQueue.has(core.group);
      coreFrame.rings = pose.rings;
      coreFrame.dim = pose.dim;
      coreFrame.halfHeightPx = halfHeightPx;
      coreFrame.dpr = dpr;
      core.update(coreFrame);
      // The swarm leaves from the core's un-collapsed silhouette at its current spot.
      coreMatrix.compose(scratchPosition.set(coreSpot.x, coreSpot.y, 0), identity, scratchScale.setScalar(coreScale));

      /* the service models: placed every frame (the swarm reads their matrices), drawn when revealed */
      const sway = Math.sin(fx.time * MODEL_SWAY.speed) * MODEL_SWAY.amplitude;
      modelFrame.time = fx.time;
      modelFrame.step = step;
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
          model.update(modelFrame);
        } else {
          group.visible = false;
        }
      }

      /* the swarm */
      const fromIsCore = plan.swarm.from === 0;
      swarmFrame.plan = plan.swarm;
      swarmFrame.fromMatrix = matrixFor(plan.swarm.from);
      swarmFrame.toMatrix = matrixFor(plan.swarm.to);
      swarmFrame.fromRadius = fromIsCore ? CORE.R * coreScale : MODEL_RADIUS * services.scale;
      swarmFrame.toRadius = MODEL_RADIUS * services.scale;
      swarmFrame.fromScale = fromIsCore ? coreScale : services.scale;
      swarmFrame.toScale = services.scale;
      swarmFrame.time = fx.time;
      swarmFrame.halfHeightPx = halfHeightPx;
      swarmFrame.dpr = dpr;
      swarm.update(swarmFrame);
      if (prewarmQueue.has(swarm.points)) swarm.points.visible = true;

      prewarmQueue.clear();
    },

    morphRunning() {
      return morphRunning(morph);
    },

    setLite(next, renderer) {
      lite = next;
      core?.setLite(lite);
      swarm?.setLite(lite);
      for (const model of models) model.setLite(lite);
      if (config.glass === "physical") {
        setTransmissionScale(renderer, lite ? SCENE_LITE.transmissionScale : config.transmissionScale);
      }
    },

    setPalette(next) {
      palette = next;
      core?.setPalette(next);
      swarm?.setPalette(next);
      for (const model of models) model.setPalette(next);
    },

    installEnvironment(renderer, scene, next) {
      if (config.glass !== "physical") return () => {};
      const room = toColor(next.bg, new Color());
      const environment = createStripEnvironment(renderer, { room, strips: environmentStrips(next) });
      // The plain page colour: the helper compensates for three's output-space conversion itself.
      const undo = installTransmissionClear(renderer, scene, room, environment.texture);
      setTransmissionScale(renderer, lite ? SCENE_LITE.transmissionScale : config.transmissionScale);
      return () => {
        undo();
        environment.dispose();
      };
    },

    dispose() {
      core?.dispose();
      swarm?.dispose();
      for (const model of models) model.dispose();
      root.clear();
    },
  };
}
