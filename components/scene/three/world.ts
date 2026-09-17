/**
 * The interior scene as one imperative object: the hero chip, the morph swarm, the cursor
 * trail, the five service models and Work's DNA helix, composed every frame from the scroll
 * probe, the page's input store and the choreography. The chip dissolves on its own host as the
 * hero leaves; the services model bursts out of a speck at its host once the entry gate arms
 * (fx.ts), and the swarm carries that burst and every pill morph after it — and, past Work's
 * band (the work gate), the selected model's swarm over to the helix. `SceneWorld.tsx` creates
 * it once, builds it part by part, calls `update` from `useFrame` and disposes it on unmount;
 * every per-frame write lives here (React Compiler lint), the Work spiral driver's included
 * (`attachWork`: the world asks it for the focus, turns the helix to it, then lets it lay the
 * cards out for the same focus).
 *
 * Built in parts, one idle slice each (`buildNext`): the chip first, then the swarm, then the
 * trail, then one service model at a time. Building all of them in one go was a single
 * 181–229ms main-thread task on the mid-tier phone profile (4× CPU). Until every part exists
 * nothing is composed, and the root draws nothing until its first compiled part is queued for
 * the pre-warm frame — so a frame between two slices never compiles a shader. The helix is not
 * one of those parts: it is built after ready (`stageHelix`: one slice, then one compile slice
 * per draw object, on the programs the scene already compiled), so it never delays the first
 * picture. Until it is built the work gate stays shut and the cards stay as the server rendered them.
 */

import {
  Group,
  Matrix4,
  Quaternion,
  Vector3,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from "three";
import {
  SCENE_SHAPES,
  SERVICE_MODEL,
  scrollProgress,
  type SceneHelixMode,
  type SceneInput,
  type ScrollProbe,
  type ServiceModel,
} from "@/lib/scene";
import {
  BURST,
  HELIX_SLOT,
  composeScene,
  coreExitPose,
  coreReveal,
  type CorePose,
  createComposition,
  createMorph,
  layoutFor,
  morphRunning,
  placeCore,
  placeHelixAmbient,
  placeHelixSpiral,
  placeServices,
  revealOf,
  stepMorph,
  worldPerPx,
  type Placement,
  type SceneLayout,
} from "../choreography";
import { stepSceneFx, type SceneFx } from "../fx";
import { HELIX_LAYOUT } from "../helix";
import { HELIX, MODEL_RADIUS } from "../shapes";
import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";
import type { WorkHelixDriver } from "../workHelix";
import { compileStaged, nextIdle, type StagedOptions } from "./compile";
import { createChipCore, type ChipCore, type CoreFrame } from "./core";
import { createHologramSource, type HologramSource } from "./hologram";
import { toColor } from "./materials";
import { createCommerceLoopModel } from "./models/commerceLoop";
import { createCubesModel } from "./models/cubes";
import {
  createHelixModel,
  helixLandingMatrix,
  layoutHelixHologram,
  type HelixFrame,
  type HelixModel,
} from "./models/helix";
import { createIntegrationHubModel } from "./models/integrationHub";
import { createMeshWaveModel } from "./models/meshWave";
import { createNeuralModel } from "./models/neural";
import { MODEL_SWAY, type ModelFrame, type SceneModel } from "./models/types";
import { parseTokenColor, type ScenePalette } from "./palette";
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
  /** Build Work's helix (one idle slice, after ready — never one of the parts `complete` counts). */
  buildHelix(): void;
  /** The helix's draw objects, to compile one per idle slice (empty until it is built). */
  helixObjects(): Object3D[];
  /** The helix compiled and queued for its pre-warm frame: from the next frame the driver hears `built`. */
  markHelixBuilt(): void;
  helixBuilt(): boolean;
  /**
   * Hand over Work's spiral driver (workHelix.ts): from then on every `update` reads its focus,
   * turns the helix to it and lets it write the cards for that same focus — and the world disposes
   * it. `onRelease` runs when the world lets it go on its own (an error in the helix's frame).
   * Null disposes the one attached (the scene is going).
   */
  attachWork(driver: WorkHelixDriver | null, onRelease?: () => void): void;
  /** The helix's mode as the last frame drew it: the driver's, `off` without one. */
  helixMode(): SceneHelixMode;
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

/** The helix's bounding radius in its own units: the swarm's cloud swells to it. */
export const HELIX_BOUND = Math.hypot(HELIX.radius, HELIX.height / 2);

/**
 * The hologram follows the focus with this much hysteresis past a card's half-way point:
 * resting between two cards never flips its texture back and forth.
 */
export const HOLOGRAM_HYSTERESIS = 0.3;

/** What `stageHelix` needs of the world. */
export type HelixStaging = Pick<SceneWorld, "buildHelix" | "helixObjects" | "prewarm" | "markHelixBuilt">;

/**
 * Work's helix, after ready: built in an idle slice of its own, compiled one draw object per
 * idle slice (on programs the scene already compiled — only its buffers are new), queued for a
 * pre-warm frame, then marked built. Resolves `true` once built, `false` when cancelled part-way.
 */
export async function stageHelix(
  world: HelixStaging,
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  options: StagedOptions,
): Promise<boolean> {
  const idle = options.idle ?? (() => nextIdle());
  await idle();
  if (options.cancelled()) return false;
  world.buildHelix();
  const compiled = await compileStaged(renderer, scene, camera, [world.helixObjects()], {
    ...options,
    compiled: (objects) => world.prewarm(objects),
  });
  if (!compiled) return false;
  world.markHelixBuilt();
  return true;
}

/** Only the root: every part comes from `buildNext`, one idle slice apart (the helix from `buildHelix`). */
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

  /* Work: the helix, its hologram and the spiral driver the page hands over. */
  let helix: HelixModel | null = null;
  let helixDone = false;
  /** An error in the helix's frame: hidden, the driver gone, for the rest of this canvas's life. */
  let helixFailed = false;
  let hologram: HologramSource | null = null;
  let driver: WorkHelixDriver | null = null;
  let onWorkRelease: (() => void) | undefined;
  /** The mode the helix was last set to, the card it is coloured after, the hologram's card. */
  let drawnMode: SceneHelixMode = "off";
  let accentCard: HTMLElement | null = null;
  let hologramIndex = -1;
  /** The hologram box the plane was last laid out for (zone width, zone height, px per model unit). */
  const hologramBox = { w: -1, h: -1, pxPerUnit: -1 };

  const morph = createMorph(0);
  const plan = createComposition();
  const shown = models.map(() => false);
  const prewarmQueue = new Set<Object3D>();
  const burstMatrix = new Matrix4();
  /** Slot 0's landing: the helix's placement, with the roll it lies down by in ambient mode. */
  const helixMatrix = new Matrix4();
  const corePlace: Placement = { x: 0, y: 0, scale: 1 };
  const servicesSpot: Placement = { x: 0, y: 0, scale: 1 };
  const helixSpot: Placement = { x: 0, y: 0, scale: 1 };
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
  const helixFrame: HelixFrame = {
    time: 0,
    step: 0,
    focus: 0,
    reveal: 0,
    tx: 0,
    ty: 0,
    prewarm: false,
    halfHeightPx: 1,
    dpr: 1,
  };
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

  /** A planned slot's world matrix: a service model's, the helix's (as `frameHelix` placed it), or the burst's speck. */
  const matrixFor = (slot: number): Matrix4 =>
    slot >= 1 ? models[slot - 1].group.matrixWorld : slot === HELIX_SLOT && helix ? helixMatrix : burstMatrix;

  /** The part (a direct child of the root) an object belongs to. */
  const partOf = (object: Object3D): Object3D => {
    let node = object;
    while (node.parent && node.parent !== root) node = node.parent;
    return node;
  };

  /** Let the driver go: it puts every card back as React rendered it; `onRelease` hears of it. */
  const releaseWork = () => {
    const released = driver;
    const onRelease = onWorkRelease;
    driver = null;
    onWorkRelease = undefined;
    accentCard = null;
    hologramIndex = -1;
    if (!released) return;
    try {
      released.dispose();
    } catch {
      // the driver restores what it can on its own; the scene goes on without it
    }
    onRelease?.();
  };

  /**
   * The helix's frame threw. A `useFrame` error never reaches the stage's error boundary, so the
   * cards would stay laid out round a helix that no longer turns: the page comes first.
   */
  const failHelix = (error: unknown) => {
    if (helixFailed) return;
    helixFailed = true;
    releaseWork();
    if (helix) helix.group.visible = false;
    drawnMode = "off";
    console.error("3D scene: the Work helix stopped", error);
  };

  /**
   * The helix this frame: the driver's mode, the focus it turns to, where it sits, its colour (the
   * front card's `--p2`) and the hologram's card. Drawn while the work gate reveals it. Returns its
   * placement (the swarm's landing spot), or null: nothing built, no mode, nothing measured.
   */
  const frameHelix = (
    scrollY: number,
    w: number,
    h: number,
    probe: ScrollProbe,
    fx: SceneFx,
    step: number,
    halfHeightPx: number,
    dpr: number,
  ): Placement | null => {
    helixFrame.focus = 0;
    if (!helix || helixFailed) return null;
    const group = helix.group;
    const prewarm = prewarmQueue.has(group);
    const mode: SceneHelixMode = driver && helixDone ? driver.mode() : "off";
    if (mode !== drawnMode) {
      drawnMode = mode;
      if (mode !== "off") helix.setMode(mode);
      if (mode !== "spiral") hologramIndex = -1;
    }
    const focus = mode === "spiral" && driver ? driver.focus(scrollY) : 0;
    helixFrame.focus = focus;
    const place =
      mode === "spiral"
        ? placeHelixSpiral(probe, scrollY, w, h, HELIX_LAYOUT.cx, helixSpot)
        : mode === "ambient"
          ? placeHelixAmbient(probe, scrollY, w, h, helixSpot)
          : null;
    const reveal = place ? plan.helix : 0;
    if (place && mode !== "off") {
      group.position.set(place.x, place.y, 0);
      group.scale.setScalar(place.scale);
      // Only this group's own matrix is needed now (the swarm reads it); render updates the rest.
      group.updateMatrix();
      group.matrixWorld.multiplyMatrices(root.matrixWorld, group.matrix);
      helixLandingMatrix(group, mode, helixMatrix);
      // The hologram beside it, on the spiral layout's box: `holo` of the zone, centre and width.
      const zoneW = probe.work?.w ?? w;
      const zoneH = probe.layerH > 0 ? probe.layerH : h;
      const pxPerUnit = place.scale / worldPerPx(h);
      if (mode === "spiral" && (zoneW !== hologramBox.w || zoneH !== hologramBox.h || pxPerUnit !== hologramBox.pxPerUnit)) {
        hologramBox.w = zoneW;
        hologramBox.h = zoneH;
        hologramBox.pxPerUnit = pxPerUnit;
        const holo = HELIX_LAYOUT.holo;
        layoutHelixHologram(
          group,
          (holo.x - HELIX_LAYOUT.cx) * zoneW,
          (0.5 - holo.y) * zoneH,
          Math.min(holo.w[0] * zoneW, holo.w[1]),
          pxPerUnit,
        );
      }
    }

    if (driver && mode !== "off") {
      // Coloured after the front card: the focus in the spiral, the card nearest the middle in the band.
      const cards = driver.cards();
      const card = cards[driver.front()] ?? null;
      if (card !== accentCard) {
        accentCard = card;
        const rgb = card ? parseTokenColor(card.style.getPropertyValue("--p2")) : null;
        helix.setAccent(rgb ? toColor(rgb) : null);
      }
      // The hologram shows the focused card, redrawn once the focus is well past half-way.
      if (mode === "spiral" && reveal > 0 && cards.length > 0) {
        if (hologramIndex < 0 || Math.abs(focus - hologramIndex) > 0.5 + HOLOGRAM_HYSTERESIS) {
          hologramIndex = Math.min(cards.length - 1, Math.max(0, Math.round(focus)));
          if (!hologram) {
            // Handed to the model on its first drawn card (no empty frame before), glitching every swap.
            const model = helix;
            let handed = false;
            const source = createHologramSource(config.hologram, () => {
              if (!handed) {
                handed = true;
                model.setHologram(source.texture);
              }
              model.glitch();
            });
            hologram = source;
          }
          hologram.request(cards[hologramIndex] ?? null, hologramIndex);
        }
      }
    }

    if (reveal > 0 || prewarm) {
      helixFrame.time = fx.time;
      helixFrame.step = step;
      helixFrame.reveal = reveal;
      helixFrame.tx = fx.tx;
      helixFrame.ty = fx.ty;
      helixFrame.prewarm = prewarm;
      helixFrame.halfHeightPx = halfHeightPx;
      helixFrame.dpr = dpr;
      helix.update(helixFrame);
    } else {
      group.visible = false;
    }
    return place;
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
      // The work gate only ever opens onto a helix that can be drawn: built, and a mode applied.
      const helixLive = helixDone && !helixFailed && driver !== null && driver.mode() !== "off";
      const workSpan = helixLive && probe.live && probe.work ? probe.workSpan : null;
      const step = stepSceneFx(fx, dt, input, heroExit, scrollY, entrySpan, workSpan);
      // Until the model has assembled, and while it hands over to the helix, a pill switch is instant.
      stepMorph(morph, input.shape, step, fx.entry.value < 1 || fx.work.value > 0);
      composeScene(fx.entry.value, fx.work.value, morph, plan);

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

      /* Work's helix: on its sticky zone (spiral) or in the band above the heading (ambient) */
      let helixPlace: Placement | null = null;
      try {
        helixPlace = frameHelix(scrollY, w, h, probe, fx, step, halfHeightPx, dpr);
      } catch (error) {
        failHelix(error);
      }
      // No helix drawn to land on: the swarm stays hidden while the model dissolves.
      if (plan.swarm.active && plan.swarm.to === HELIX_SLOT && !helixPlace) plan.swarm.active = false;

      /* the swarm: a burst leaves from a speck of the selected model at the services centre */
      const burst = plan.swarm.from === BURST;
      if (burst) {
        burstMatrix.compose(
          scratchPosition.set(services.x, services.y, 0),
          identity,
          scratchScale.setScalar(services.scale * BURST_SPECK.scale),
        );
      }
      const toHelix = plan.swarm.to === HELIX_SLOT ? helixPlace : null;
      swarmFrame.plan = plan.swarm;
      swarmFrame.fromMatrix = matrixFor(plan.swarm.from);
      swarmFrame.toMatrix = matrixFor(plan.swarm.to);
      swarmFrame.fromRadius = MODEL_RADIUS * services.scale * (burst ? BURST_SPECK.radius : 1);
      swarmFrame.toRadius = toHelix ? HELIX_BOUND * toHelix.scale : MODEL_RADIUS * services.scale;
      swarmFrame.fromScale = services.scale * (burst ? BURST_SPECK.sprite : 1);
      swarmFrame.toScale = toHelix ? toHelix.scale : services.scale;
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

      /* the cards, laid out for the focus the helix just turned to (nothing before it is built) */
      if (driver) {
        try {
          driver.write({ focus: helixFrame.focus, built: helixDone && !helixFailed });
        } catch (error) {
          failHelix(error);
        }
      }
    },

    morphRunning() {
      return morphRunning(morph);
    },

    buildHelix() {
      if (helix) return;
      helix = createHelixModel(config, palette);
      helix.setLite(lite);
      helix.group.visible = false;
      if (!helix.group.name) helix.group.name = "scene-helix";
      root.add(helix.group);
    },

    helixObjects() {
      return helix ? helix.objects : [];
    },

    markHelixBuilt() {
      if (helix) helixDone = true;
    },

    helixBuilt() {
      return helixDone && !helixFailed;
    },

    attachWork(next, onRelease) {
      if (next === driver) return;
      releaseWork();
      if (!next) return;
      if (helixFailed) {
        try {
          next.dispose();
        } catch {
          // nothing was laid out yet
        }
        return;
      }
      driver = next;
      onWorkRelease = onRelease;
    },

    helixMode() {
      return drawnMode;
    },

    setLite(next) {
      lite = next;
      core?.setLite(lite);
      swarm?.setLite(lite);
      for (const model of models) model.setLite(lite);
      helix?.setLite(lite);
    },

    setPalette(next) {
      palette = next;
      core?.setPalette(next);
      swarm?.setPalette(next);
      trail?.setPalette(next);
      for (const model of models) model.setPalette(next);
      helix?.setPalette(next);
    },

    dispose() {
      releaseWork();
      core?.dispose();
      swarm?.dispose();
      trail?.dispose();
      for (const model of models) model.dispose();
      helix?.dispose();
      hologram?.dispose();
      root.clear();
    },
  };
}
