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
 *
 * A service page has three more residents, and they are why this world now animates more than one
 * thing at a time: the service model itself, which travels between the hero host and the steps
 * corner (one instance, blended between two placements); the three small objects of the benefits
 * row, one per panel window; and the laptop standing in the "Proiecte relevante" shelf, whose
 * display plays that direction's project screenshots through the hologram pipeline Work's helix
 * uses. All of them are built like the helix — late, one per frame, and only once the probe has
 * measured a window to put them in — so no other page pays for any of it.
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
  PANEL_COLUMNS,
  PANEL_FADE_SECONDS,
  STEPS_GATE,
  STEPS_TRAVEL,
  blendPlacement,
  composeScene,
  coreExitPose,
  coreReveal,
  type CorePose,
  createComposition,
  createMorph,
  helixArriveSpan,
  layoutFor,
  morphRunning,
  placeCore,
  placeHelixAmbient,
  placeHelixSpiral,
  LAPTOP_BOOT,
  LAPTOP_BOOT_GATE,
  laptopBootFrame,
  panelsShare,
  placeLaptop,
  placePanels,
  placeServices,
  projectsShare,
  placeSteps,
  revealOf,
  smoothstep,
  stepMorph,
  stepsShare,
  worldPerPx,
  type Placement,
  type SceneLayout,
} from "../choreography";
import { damp } from "@/components/three/motion";
import { stepSceneFx, type SceneFx } from "../fx";
import { HELIX_LAYOUT } from "../helix";
import { HELIX, MODEL_RADIUS } from "../shapes";
import { SCENE_TIER_CONFIG, type SceneCanvasTier } from "../tiers";
import type { ProjectsReel } from "../projectsReel";
import type { WorkHelixDriver } from "../workHelix";
import { compileStaged, nextIdle, type StagedOptions } from "./compile";
import { createChipCore, type ChipCore, type CoreFrame } from "./core";
import {
  composeLaptopBoot,
  composeLaptopScreen,
  createHologramSource,
  type HologramSource,
} from "./hologram";
import { toColor } from "./materials";
import { createCommerceLoopModel } from "./models/shopFloor";
import { createProductStackModel } from "./models/productStack";
import {
  createHelixModel,
  helixLandingMatrix,
  layoutHelixHologram,
  type HelixFrame,
  type HelixModel,
} from "./models/helix";
import { BENCH_RUN, createPipelineBenchModel } from "./models/pipelineBench";
import { createBrandBoardModel } from "./models/brandBoard";
import { ASSIST_CYCLE, ASSIST_START, createAssistantLoopModel } from "./models/assistantLoop";
import { MODEL_SWAY, type ModelFrame, type PanelModel, type SceneModel } from "./models/types";
import { createLaptopModel, type LaptopModel } from "./models/laptop";
import { createSurveyFieldModel } from "./models/panel/surveyField";
import { createPanelFitModel } from "./models/panel/panelFit";
import { createLaunchRampModel } from "./models/panel/launchRamp";
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
  /**
   * Hand over the projects reel (`projectsReel.ts`): from then on the laptop's display shows the
   * card it answers — the hovered or focused one, or the cycle's. The world disposes it. Null
   * disposes the one attached (the scene is going).
   */
  attachProjects(reel: ProjectsReel | null): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

const MODEL_FACTORIES: Readonly<Record<ServiceModel, typeof createProductStackModel>> = {
  cubes: createProductStackModel,
  "mesh-wave": createBrandBoardModel,
  neural: createAssistantLoopModel,
  "commerce-loop": createCommerceLoopModel,
  "integration-hub": createPipelineBenchModel,
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

/** A scroll of this many viewports a second is `speed` 1 for the helix (`HelixFrame.speed`). */
export const SCROLL_SPEED_FULL = 1.6;
/** …and it falls back to a still page at this rate (about a third of a second), never up. */
export const SCROLL_SPEED_LAMBDA = 4.5;

/* ---- the benefits row: three objects at once ------------------------------------------ */

/**
 * The three objects of a service page's benefits row, in the order the panels are laid out:
 * clarify, build, launch. They are not service models — no `kind`, no `resetCycle`, never in
 * `MODEL_FACTORIES`, never sampled, never a morph or burst target — and they are the first thing
 * this world animates alongside another. Everything a service model gets from the world they get
 * too (a placement, a frame, lite, the palette, disposal); what they do not get is the pointer.
 *
 * They are built late and conditionally, the way Work's helix is: never one of the parts
 * `complete()` counts, never in `compileStages()` (they draw on P3 `edges` instanced, which the
 * chip core compiles on every page, so there is no program to wait for), one per frame, and only
 * once the probe has a row to put them in. A page with no row — the home page, a narrow viewport,
 * a `fallback` or `off` renderer — never builds, draws, lites, repaints or disposes any of them.
 */
const PANEL_FACTORIES = [createSurveyFieldModel, createPanelFitModel, createLaunchRampModel] as const;

/**
 * How far off the canvas the row may still be when the world starts building it, in canvas
 * heights: the three slices then land while the visitor is reading above the row, not on the frame
 * it scrolls into view.
 */
export const PANEL_BUILD_LEAD = 1.5;

/* ---- the step of "Cum lucrăm" a model illustrates ------------------------------------- */

/**
 * A model's own loop, and the moment in it that tells each step of a service page's
 * "Cum lucrăm" (`SceneInput.stage`, 0-based).
 *
 * `at` is seconds into the model's loop, one per step and strictly increasing. A step index past
 * its end holds nothing — the world lets the model run rather than parking it on a beat that says
 * nothing about what is being read. `start` is where the model's own `resetCycle` puts its clock:
 * a model never tells anyone where it is, so the world keeps its own copy of that clock and steers
 * it through the only handle it has, the `step` it feeds the model every frame.
 *
 * What each table maps to, in words:
 *
 * · cubes — produs-digital (6.8 s loop)
 *     1.55  the walkthrough: the six screens printing back to front, a packet between each
 *     3.10  the collapse and the ignition: the six are docked into one device, the glass scans
 *     4.70  the turn and the architecture: the device is round, its three layer slabs docked
 *           and lit, the chips on, data running along the buses
 *     5.95  the open: it has turned back and the stack fans out to its stations
 *
 * · commerce-loop — e-commerce (6.8 s loop; the phases below are the front lane's, the second
 *   lane runs half a loop behind it)
 *     0.30  the pick: the item comes off the shelf column the pointer is over
 *     1.65  the packing bench: the parcel is boxed and taped
 *     3.42  the terminal: the card is authorised and the tick strikes
 *     5.85  the vault and the orders board: the order is banked and counted on the board
 *
 * · integration-hub — automatizare-api (6.4 s loop)
 *     1.05  the five stations: records walking the spine, station after station
 *     2.46  the composed bench: four records on it, a write going through the delivery gate
 *     3.70  the fault: the last record has reddened at the closed gate and is waiting there
 *     5.30  the recovered write: back in through the gate after the retry arc, and logged
 *
 * · neural — asistenti-ia (7.2 s loop)
 *     1.55  the slab: the request is in and the form's ticks are filling, layer by layer
 *     2.70  the wave crossing the network's layers
 *     4.22  the gate and the key press: the answer is checked and released
 *     5.20  the answer flying home along the return loop to the port
 *
 * · mesh-wave — brand-ui (6.6 s loop)
 *     1.30  the palette repaint: the five tokens re-ink and the whole board takes the colour
 *     3.55  the re-flow: the breakpoint rule is in and the six components stand in the phone
 *     6.10  the mark: `TBS.` re-printed stroke by stroke with its tie lines
 */
type StageTable = {
  /** The model's loop, seconds — the world's copy of its clock wraps where the model's does. */
  loop: number;
  /** Where `resetCycle` parks that clock. */
  start: number;
  /** Seconds into the loop, one per step of the page. */
  at: readonly number[];
};

export const SERVICE_STAGES: Readonly<Record<ServiceModel, StageTable>> = {
  // models/productStack.ts: LOOP 6.8, LOOP_START 1.95 (neither is exported).
  cubes: { loop: 6.8, start: 1.95, at: [1.55, 3.1, 4.7, 5.95] },
  // models/shopFloor.ts: LOOP 6.8, START_AT 2.35 (neither is exported); its HISTORY is a whole
  // number of loops, so the front lane's phase is the clock's.
  "commerce-loop": { loop: 6.8, start: 2.35, at: [0.3, 1.65, 3.42, 5.85] },
  "integration-hub": { loop: BENCH_RUN.loop, start: BENCH_RUN.composed, at: [1.05, 2.46, 3.7, 5.3] },
  neural: { loop: ASSIST_CYCLE, start: ASSIST_START, at: [1.55, 2.7, 4.22, 5.2] },
  // models/brandBoard.ts: LOOP 6.6, and its `resetCycle` goes back to 0 (the composed pose).
  "mesh-wave": { loop: 6.6, start: 0, at: [1.3, 3.55, 6.1] },
};

/** A held story clock never runs at more than this many times the model's own pace. */
export const STAGE_RATE_MAX = 3;
/**
 * …and brakes onto the held moment at this, in loop-seconds per second squared: the rate it aims
 * for is `sqrt(2·a·d)` of what is left, so it comes to rest ON the moment in finite time. An
 * exponential approach never arrives, and its last tenth of a second of creep is exactly what
 * would read as a stutter.
 */
export const STAGE_BRAKE = 4.5;
/** How fast that rate itself may change: a step in speed reads as a jump. ~0.35 s to settle. */
export const STAGE_RATE_LAMBDA = 6;
/** Closer than this to the model's own pace, a released clock is simply back on it. */
const STAGE_RATE_SNAP = 0.004;

/**
 * pipelineBench is the one model that does not take the step it is handed as given: it multiplies
 * it by its own pointer throttle (`sweep`, models/pipelineBench.ts), up to `max`. The world mirrors
 * that throttle — with the very step and tilt the bench is about to be handed — because otherwise
 * its copy of the bench's clock would drift out of the model over a page's life and hold the wrong
 * beat. A mirror only: it drives nothing, and every other model advances by the step as given.
 */
const BENCH_PACE = { max: 2.6, gain: 1.8, lambda: 4.5 } as const;

/**
 * Pure. The rate the story clock should be heading for with `ahead` seconds of the loop still to
 * run to the held moment: flat out to `STAGE_RATE_MAX`, then a constant brake onto it.
 *
 * Forward only. Several models clamp a negative step to zero or diverge on one (their pointer
 * easings run on the same step), so a model is never handed one: the way back to an earlier beat
 * is round the rest of the loop, not a rewind.
 */
export function stageRate(ahead: number): number {
  if (!(ahead > 0)) return 0;
  const brake = Math.sqrt(2 * STAGE_BRAKE * ahead);
  return brake < STAGE_RATE_MAX ? brake : STAGE_RATE_MAX;
}

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
  /** The benefits row, built one per frame once there is a row to build it for (`PANEL_FACTORIES`). */
  const panels: PanelModel[] = [];
  /** Their placements, and how far the row has dissolved in: never a pop as the scroll brings it. */
  const panelSpots: Placement[] = PANEL_FACTORIES.map(() => ({ x: 0, y: 0, scale: 1 }));
  let panelFade = 0;

  /**
   * The projects laptop, its own hologram source and the reel the page hands over: a service
   * page's "Proiecte relevante" shelf only. Built like the benefits row — late, one slice, and
   * only once the probe has a window to put it in — so no other page pays for any of it.
   *
   * Its own `HologramSource`, never the helix's: the two show different card lists (Work's
   * projects and this direction's), and they live on different pages, so sharing one canvas would
   * only trade a 384x240 texture for a lifetime question neither of them can answer.
   */
  let laptop: LaptopModel | null = null;
  let laptopFade = 0;
  const laptopSpot: Placement = { x: 0, y: 0, scale: 1 };
  let reel: ProjectsReel | null = null;
  let display: HologramSource | null = null;
  /** What the display is showing, and the reel generation it was composed at. */
  let screenCard: HTMLElement | null = null;
  let screenIndex = -1;
  let screenGeneration = -1;
  /**
   * The arrival's gate: armed by the share of the window on screen (`LAPTOP_BOOT_GATE`), spent in
   * TIME by the model, and re-armable only once the section has been left. `bootFrame` is the boot
   * frame the display is showing, so the texture is painted on a step change and not every frame.
   */
  let laptopArmed = false;
  let bootFrame = -1;

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
  const stepsSpot: Placement = { x: 0, y: 0, scale: 1 };
  /** Where the model is drawn this frame: the hero host, the steps corner, or between the two. */
  const modelSpot: Placement = { x: 0, y: 0, scale: 1 };
  const helixSpot: Placement = { x: 0, y: 0, scale: 1 };
  /** The band the helix's arrival is armed over, re-derived from the probe's boxes every frame. */
  const arriveSpan = { start: 0, end: 0 };
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
    exit: 0,
    arrive: 1,
    speed: 0,
  };
  /** The scroll's own speed, smoothed: 0 still → 1 at `SCROLL_SPEED_FULL` viewports a second. */
  let scrollSpeed = 0;
  let lastScrollY = Number.NaN;
  /** The world's copy of each model's own loop clock, and the rate it is being played at. */
  const storyClock = kinds.map((kind) => SERVICE_STAGES[kind].start);
  const storyRate = kinds.map(() => 1);
  /** pipelineBench's pointer throttle, mirrored (see `BENCH_PACE`). */
  let benchSweep = 0;
  let benchTx = 0;
  /**
   * The steps corner: 0 the model on the hero host, 1 in the sticky host beside "Cum lucrăm".
   * `armed` is where the scroll says it belongs (with hysteresis), `corner` how far it has
   * travelled — in time, so a flick across the whole section never teleports it and a reversal
   * simply turns it round from where it stands. Snapped on the first frame, like the other gates:
   * a deep link into the steps finds the model already in the corner.
   */
  let cornerArmed = false;
  let corner = 0;
  let cornerPrimed = false;
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

  /** The multiplier the bench will apply to `step` this frame, mirroring its own throttle. */
  const benchPace = (step: number, tx: number): number => {
    if (step > 0) {
      const rate = Math.abs(tx - benchTx) / step;
      const target = rate > 1 ? 1 : rate;
      benchSweep =
        target > benchSweep
          ? target
          : benchSweep + (target - benchSweep) * (1 - Math.exp(-BENCH_PACE.lambda * step));
    }
    benchTx = tx;
    return Math.min(BENCH_PACE.max, 1 + BENCH_PACE.gain * benchSweep);
  };

  /**
   * The step to hand model `index` this frame, and the world's copy of its clock kept in step with
   * it. With no stage held it is the frame's own step, eased back onto it from whatever rate the
   * model was last played at — released, a model runs on from where it stands, it never jumps. With
   * one held it is the step that walks the model's own loop round to that moment and stops it
   * there: forward only, and never more of the loop than is left to the moment, so the clock lands
   * on the beat instead of overshooting into the next one.
   *
   * Only the story holds. Everything a model runs on scene time — the belt's teeth, the digits, a
   * conduit's light, a board's breath, the sway and the tilt the world itself applies — goes on
   * running at a held step, because none of it reads this clock.
   */
  const storyStep = (index: number, step: number, stage: number, tx: number): number => {
    const kind = kinds[index];
    const table = SERVICE_STAGES[kind];
    const held = stage >= 0 && stage < table.at.length ? table.at[stage] : -1;
    const paceMax = kind === "integration-hub" ? BENCH_PACE.max : 1;
    let rate = storyRate[index];
    if (held < 0) {
      rate = damp(rate, 1, STAGE_RATE_LAMBDA, step);
      if (Math.abs(rate - 1) < STAGE_RATE_SNAP) rate = 1;
    } else {
      let ahead = held - storyClock[index];
      if (ahead < 0) ahead += table.loop;
      rate = damp(rate, stageRate(ahead), STAGE_RATE_LAMBDA, step);
      // Whatever the brake says, never more of the loop than is left to the held moment.
      const room = step > 0 ? ahead / (step * paceMax) : 0;
      if (rate > room) rate = room;
    }
    storyRate[index] = rate;
    const fed = rate === 1 ? step : step * rate;
    // Advanced by exactly what the model is about to advance by — the bench's throttle included.
    const clock = storyClock[index] + fed * (kind === "integration-hub" ? benchPace(fed, tx) : 1);
    storyClock[index] = clock >= table.loop ? clock - table.loop * Math.floor(clock / table.loop) : clock;
    return fed;
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
   * The project on the laptop's display, once a frame while it is on screen. The page says which
   * one — its cycle, its prev/next, its markers, one number on the grid (`projectsReel.ts`) — and
   * `composeHologram` draws that card: its screenshot as luminance under scanlines, its name, its
   * index, bracket corners, on a canvas capped at `config.hologram` (384 x 240 at high). The model
   * glitches over the swap, and the page renders the same project's name, tag and description
   * beside the machine as real text, off the same number.
   *
   * A pick is composed again when the card changes, when its place in the grid changes, and when
   * the reel's `generation` moves — which is a content swap having replaced the cards or one of
   * their images. That last case is the reason `request` takes `force`: the card element can be the
   * very one already on the texture, with a different project behind it.
   */
  /**
   * The display's one source. The texture is handed to the model as soon as it exists, because the
   * first thing on it is a boot frame rather than a project — the model still keeps the screen dark
   * until its tube opens (`laptop.ts` `showScreen`), so there is never an empty plane.
   */
  const ensureDisplay = (model: LaptopModel): HologramSource => {
    if (!display) {
      const source = createHologramSource(
        config.hologram,
        // Only a project swap glitches; a boot frame is the machine drawing itself, not a change.
        () => model.glitch(),
        // The laptop's own layout over the same pipeline: the display is read the way a screen is
        // read, so it draws the project's name, tag and description as TEXT at the canvas's native
        // resolution — the one way to make it legible that does not raise the cap the screenshot
        // is deliberately crushed by (`hologram.ts` `composeLaptopScreen`).
        composeLaptopScreen,
      );
      display = source;
      model.setHologram(source.texture);
    }
    return display;
  };

  /** One boot frame onto the display: no card, no idle slot, no glitch (`HologramSource.paint`). */
  const paintBoot = (model: LaptopModel, frame: number) => {
    const count = reel ? reel.cards().length : 0;
    ensureDisplay(model).paint((ctx, size) =>
      composeLaptopBoot(ctx, size, frame, LAPTOP_BOOT.frameCount, count),
    );
  };

  const frameScreen = () => {
    const model = laptop;
    if (!model || !reel) return;
    const pick = reel.pick();
    if (!pick) return;
    const stale = pick.generation !== screenGeneration;
    if (!stale && pick.card === screenCard && pick.index === screenIndex) return;
    screenCard = pick.card;
    screenIndex = pick.index;
    screenGeneration = pick.generation;
    ensureDisplay(model).request(pick.card, pick.index, stale);
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
    helixFrame.exit = mode === "spiral" && driver ? driver.exit(scrollY) : 0;
    // A fling that leaves the whole track inside the gate's 1.2s must not play an arrival under a
    // finish that is already winding up: past the last card the helix is simply there, then gone.
    helixFrame.arrive = helixFrame.exit > 0 ? 1 : plan.helixArrive;
    helixFrame.speed = scrollSpeed;
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
        // A project has arrived at the front: the strands answer it — the first one included.
        // It cannot be spent off screen: the driver marks no card at all while the focus is under
        // −0.5 (workHelix.ts `frameSpiral`), so card 0 takes the front half a step below it, well
        // inside the layer, and its flare lands with the arrival's own.
        if (card) helix.pulse();
      }
      // The hologram shows the focused card, redrawn once the focus is well past half-way.
      if (mode === "spiral" && reveal > 0 && cards.length > 0) {
        const wanted = Math.min(cards.length - 1, Math.max(0, Math.round(focus)));
        // `focus` runs on past the last card through the finish: never re-compose the same one.
        if (wanted !== hologramIndex && (hologramIndex < 0 || Math.abs(focus - hologramIndex) > 0.5 + HOLOGRAM_HYSTERESIS)) {
          hologramIndex = wanted;
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

      // The scroll's speed, in viewports a second, eased so a flick decays instead of flickering.
      if (dt > 0 && Number.isFinite(lastScrollY) && h > 0) {
        const rate = Math.abs(scrollY - lastScrollY) / dt / h / SCROLL_SPEED_FULL;
        const target = rate > 1 ? 1 : rate;
        scrollSpeed = target > scrollSpeed ? target : damp(scrollSpeed, target, SCROLL_SPEED_LAMBDA, dt);
      }
      lastScrollY = scrollY;

      const heroExit = probe.live ? scrollProgress(scrollY, probe.heroExit) : 0;
      const entrySpan = probe.live && probe.services ? probe.entry : null;
      // The work gate only ever opens onto a helix that can be drawn: built, and a mode applied.
      const helixMode = helixDone && !helixFailed && driver ? driver.mode() : "off";
      // The arrival arms on the spiral's own sticky line, where the helix is all but centred in
      // the layer (`helixArriveSpan`). The ambient helix has no sticky zone — it lies in the band
      // above Work's heading, a screen higher up the page — so there it keeps Work's own band.
      const workSpan =
        helixMode === "spiral"
          ? helixArriveSpan(probe, arriveSpan)
          : helixMode === "ambient" && probe.live && probe.work
            ? probe.workSpan
            : null;
      const step = stepSceneFx(fx, dt, input, heroExit, scrollY, entrySpan, workSpan);
      // Until the model has assembled, and while it hands over to the helix, a pill switch is instant.
      stepMorph(morph, input.shape, step, fx.entry.value < 1 || fx.work.value > 0);
      composeScene(fx.entry.value, fx.work.value, morph, plan);

      const halfHeightPx = h * dpr * 0.5;
      placeCore(probe, scrollY, w, h, layout, corePlace);
      const services = placeServices(probe, scrollY, w, h, layout, servicesSpot) ?? corePlace;
      coreExitPose(fx.heroExit, layout, pose);

      /* the steps corner: on a service page the model moves beside "Cum lucrăm" while it is read
         and goes home when the section is left. No host (any other page, or below 861px, where
         the page does not render one) and it never leaves the hero. */
      const stepsPlace = placeSteps(probe, scrollY, w, h, stepsSpot);
      const share = stepsPlace ? stepsShare(probe, scrollY, h) : 0;
      cornerArmed = stepsPlace !== null && (cornerArmed ? share > STEPS_GATE.off : share > STEPS_GATE.on);
      if (!cornerPrimed) {
        cornerPrimed = true;
        corner = cornerArmed ? 1 : 0;
      } else {
        const next = corner + (cornerArmed ? step / STEPS_TRAVEL.form : -step / STEPS_TRAVEL.unform);
        corner = next <= 0 ? 0 : next >= 1 ? 1 : next;
      }
      // Mid-travel with the host gone (a resize under 861px) there is nothing to travel to: home.
      const place =
        corner > 0 && stepsPlace ? blendPlacement(services, stepsPlace, smoothstep(0, 1, corner), modelSpot) : services;

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
        group.position.set(place.x, place.y, 0);
        group.scale.setScalar(place.scale);
        group.rotation.set(-fx.ty * 0.13, sway + fx.tx * 0.2, 0);
        // Only this group's own matrix is needed now (the swarm reads it); render updates the rest.
        group.updateMatrix();
        group.matrixWorld.multiplyMatrices(root.matrixWorld, group.matrix);
        const prewarm = prewarmQueue.has(group);
        if (reveal > 0 && !shown[index]) {
          model.resetCycle();
          // …and the world's copy of that clock goes back to the same place, at its own pace.
          storyClock[index] = SERVICE_STAGES[kinds[index]].start;
          storyRate[index] = 1;
        }
        shown[index] = reveal > 0;
        if (reveal > 0 || prewarm) {
          modelFrame.reveal = reveal;
          modelFrame.prewarm = prewarm;
          // A model's own cycle (the cubes' hold → explode → float → assemble, a hub's packets)
          // waits at its start until the model is fully revealed: the swarm lands on that pose,
          // and a formed entrance begins with the whole first phase (the cubes' block held 1.4s).
          // Past that the step is the story clock's, not the frame's: while a service page holds a
          // step of "Cum lucrăm" the model's loop walks onto the moment that tells it and waits.
          modelFrame.step = storyStep(index, reveal < 1 ? 0 : step, input.stage, fx.tx);
          model.update(modelFrame);
        } else {
          group.visible = false;
        }
      }

      /* the benefits row: three objects in the panels' windows, a service page's row only.
         Built one per frame as the row comes near, drawn only while it is on screen — the whole
         block is dead arithmetic (`panelsShare` returns 0 off a measured row) on every other page. */
      // `root.visible` is the first pre-warmed part: the scene is drawing, so the staged build and
      // compile are past and a slice of this size no longer competes with the first picture.
      if (panels.length < PANEL_COLUMNS && root.visible && panelsShare(probe, scrollY, h, h * PANEL_BUILD_LEAD) > 0) {
        const panel = PANEL_FACTORIES[panels.length](config, palette);
        panel.setLite(lite);
        panel.group.visible = false;
        panels.push(panel);
        root.add(panel.group);
        // Its own pre-warm frame, here rather than through `compileStages`: it is drawn once at
        // reveal 0 below (every fragment discards) so the frame that first shows it uploads nothing.
        prewarmQueue.add(panel.group);
      }
      if (panels.length > 0) {
        const onScreen = panelsShare(probe, scrollY, h) > 0;
        const faded = panelFade + (onScreen ? step : -step) / PANEL_FADE_SECONDS;
        panelFade = faded <= 0 ? 0 : faded >= 1 ? 1 : faded;
        for (let index = 0; index < panels.length; index += 1) {
          const panel = panels[index];
          const group = panel.group;
          const prewarm = prewarmQueue.has(group);
          // Off screen and not pre-warming: not placed, not framed, not updated. Unlike the service
          // models, nothing else in the scene reads these matrices, so there is no reason to keep
          // them warm — the row is the one part of the world that can go completely quiet.
          const spot = panelFade > 0 || prewarm ? placePanels(probe, scrollY, w, h, index, panelSpots[index]) : null;
          if (!spot) {
            group.visible = false;
            continue;
          }
          group.position.set(spot.x, spot.y, 0);
          group.scale.setScalar(spot.scale);
          // The row's own rule: the sway every model gets, and NOT the pointer lean the service
          // models take — the panel answers the mouse itself, in CSS, and a second answer inside
          // its window would read as the window wobbling. Each object damps this sway further and
          // adds its own slow yaw (models/panel/kit.ts), the way brandBoard already does.
          group.rotation.set(0, sway, 0);
          modelFrame.reveal = panelFade;
          modelFrame.prewarm = prewarm;
          // Their loops run on the frame's own step: no page holds a benefit on a beat.
          modelFrame.step = step;
          panel.update(modelFrame);
        }
      }

      /* the projects laptop: the one machine in the world with a screen. It stands in the cell the
         "Proiecte relevante" grid gives it and plays that direction's own project screenshots —
         the same hologram pipeline Work's helix uses, at the same 384x240 cap, for the same
         reason. Built the way the row is: never a part `complete()` counts, never in
         `compileStages()` (it draws on P3 `edges` instanced and P2 `holo`, both already compiled),
         one slice, and only once there is a window measured to put it in. Every page without one —
         the home page, a narrow viewport, a `fallback` or `off` renderer — never builds it, never
         places it, never composes a texture and never disposes anything. */
      if (!laptop && reel && root.visible && projectsShare(probe, scrollY, h, h * PANEL_BUILD_LEAD) > 0) {
        laptop = createLaptopModel(config, palette);
        laptop.setLite(lite);
        laptop.group.visible = false;
        root.add(laptop.group);
        // Its own pre-warm frame, like a panel's: drawn once at reveal 0 (every fragment discards)
        // so the frame that first shows it uploads nothing.
        prewarmQueue.add(laptop.group);
        // …and the screenshots, now: where the machine is live the grid is `display: none`, and a
        // lazy image with no box is never fetched (`projectsReel.ts` `warm`).
        reel.warm();
      }
      if (laptop) {
        const group = laptop.group;
        const prewarm = prewarmQueue.has(group);
        const share = projectsShare(probe, scrollY, h);
        const onScreen = share > 0;
        const faded = laptopFade + (onScreen ? step : -step) / PANEL_FADE_SECONDS;
        laptopFade = faded <= 0 ? 0 : faded >= 1 ? 1 : faded;
        const spot = laptopFade > 0 || prewarm ? placeLaptop(probe, scrollY, w, h, laptopSpot) : null;
        if (!spot) {
          group.visible = false;
        } else {
          group.position.set(spot.x, spot.y, 0);
          group.scale.setScalar(spot.scale);
          // The row's rule again: the world's shared sway, and NOT the pointer lean — the cards
          // around it already lean in CSS. The model cancels most of this sway and turns on its own.
          group.rotation.set(0, sway, 0);
          modelFrame.reveal = laptopFade;
          modelFrame.prewarm = prewarm;
          modelFrame.step = step;

          /* The arrival. It is armed by how much of the window is really inside the canvas, and
             spent in TIME from there — never scrubbed by the scroll, so a flick cannot leave the
             lid half open. Leaving the section altogether stows the machine, and coming back boots
             it again; scrolling about inside the section replays nothing. */
          const armed = laptopArmed
            ? share > LAPTOP_BOOT_GATE.off
            : share >= LAPTOP_BOOT_GATE.on;
          if (armed !== laptopArmed) {
            laptopArmed = armed;
            bootFrame = -1;
            if (armed) {
              laptop.arrive();
            } else {
              laptop.stow();
              // Whatever was on the display was composed for a visit that is over.
              screenCard = null;
              screenIndex = -1;
              screenGeneration = -1;
            }
          }

          laptop.update(modelFrame);

          /* What the display is showing: the machine's own boot frames until the sequence says the
             first project may land, then the reel. Nothing is composed for a section nobody
             reached, and a stowed machine shows nothing at all. */
          if (laptopFade > 0) {
            const boot = laptop.bootAt();
            if (boot < 0) {
              bootFrame = -1;
            } else if (boot < LAPTOP_BOOT.swap) {
              const wanted = laptopBootFrame(boot);
              if (wanted !== bootFrame) {
                bootFrame = wanted;
                if (wanted >= 0) paintBoot(laptop, wanted);
              }
            } else {
              frameScreen();
            }
          }
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
          scratchPosition.set(place.x, place.y, 0),
          identity,
          scratchScale.setScalar(place.scale * BURST_SPECK.scale),
        );
      }
      const toHelix = plan.swarm.to === HELIX_SLOT ? helixPlace : null;
      swarmFrame.plan = plan.swarm;
      swarmFrame.fromMatrix = matrixFor(plan.swarm.from);
      swarmFrame.toMatrix = matrixFor(plan.swarm.to);
      swarmFrame.fromRadius = MODEL_RADIUS * place.scale * (burst ? BURST_SPECK.radius : 1);
      swarmFrame.toRadius = toHelix ? HELIX_BOUND * toHelix.scale : MODEL_RADIUS * place.scale;
      swarmFrame.fromScale = place.scale * (burst ? BURST_SPECK.sprite : 1);
      swarmFrame.toScale = toHelix ? toHelix.scale : place.scale;
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

    attachProjects(next) {
      if (next === reel) return;
      reel?.dispose();
      reel = next;
      laptopArmed = false;
      bootFrame = -1;
      laptop?.stow();
      // Whatever is on the display was composed from cards that are gone.
      screenCard = null;
      screenIndex = -1;
      screenGeneration = -1;
    },

    setLite(next) {
      lite = next;
      core?.setLite(lite);
      swarm?.setLite(lite);
      for (const model of models) model.setLite(lite);
      for (const panel of panels) panel.setLite(lite);
      laptop?.setLite(lite);
      helix?.setLite(lite);
    },

    setPalette(next) {
      palette = next;
      core?.setPalette(next);
      swarm?.setPalette(next);
      trail?.setPalette(next);
      for (const model of models) model.setPalette(next);
      for (const panel of panels) panel.setPalette(next);
      laptop?.setPalette(next);
      helix?.setPalette(next);
    },

    dispose() {
      releaseWork();
      reel?.dispose();
      reel = null;
      core?.dispose();
      swarm?.dispose();
      trail?.dispose();
      for (const model of models) model.dispose();
      for (const panel of panels) panel.dispose();
      laptop?.dispose();
      display?.dispose();
      helix?.dispose();
      hologram?.dispose();
      root.clear();
    },
  };
}
