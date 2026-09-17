/**
 * How much of the interior scene each canvas tier draws, and how the FPS governor judges it.
 * Pure data and arithmetic — no three.js, no DOM — so the scene chunk and the unit tests
 * share one table.
 *
 * Only "high" and "mid" ever get a canvas: the stage keeps the low tier on the static art.
 * Counts are sized for a phone GPU at mid (JS update ≤ 2 ms, GPU ≤ 8 ms, overdraw ≈ 2) and a
 * laptop iGPU at high; the governor's "lite" step halves the swarm on top of either.
 */

import { clampDprRange } from "@/components/three/capability";
import type { FpsGovernorOptions, GovernorStep } from "@/components/three/governor";

export type SceneCanvasTier = "high" | "mid";

export type SceneTierConfig = {
  /** `[min, max]` device-pixel ratio before the pixel budget. */
  dpr: readonly [number, number];
  /** Device pixels the canvas may fill; big screens drop towards 1×. */
  pixelBudget: number;
  antialias: boolean;
  /** The hero chip's board traces per side (one pin each). */
  chipTraces: number;
  /** Particles that carry a morph. */
  swarm: number;
  cubes: number;
  /** Mesh-wave grid cells (x, y): a line on every cell edge, a `+` on every second crossing. */
  wave: readonly [number, number];
  /** Segments along a mesh-wave row; a column (the plane's shorter side) gets half. */
  waveSubdiv: number;
  uiCards: number;
  /** Nodes per layer of the neural network. */
  neural: readonly number[];
  fanout: number;
  /** Icosahedron detail of a neural node. */
  nodeDetail: number;
  /** Commerce track segments. */
  track: number;
  packages: number;
  satellites: number;
  /** Hub link tube segments (along, around). */
  link: readonly [number, number];
};

export const SCENE_TIER_CONFIG: Readonly<Record<SceneCanvasTier, SceneTierConfig>> = {
  high: {
    dpr: [1, 1.75],
    pixelBudget: 2.6e6,
    antialias: true,
    chipTraces: 7,
    swarm: 720,
    cubes: 27,
    wave: [16, 8],
    waveSubdiv: 32,
    uiCards: 3,
    neural: [5, 8, 9, 7, 4],
    fanout: 3,
    nodeDetail: 1,
    track: 220,
    packages: 18,
    satellites: 6,
    link: [56, 5],
  },
  mid: {
    dpr: [1, 1.5],
    pixelBudget: 1.25e6,
    antialias: false,
    chipTraces: 5,
    swarm: 420,
    cubes: 27,
    wave: [10, 6],
    waveSubdiv: 24,
    uiCards: 2,
    neural: [4, 6, 7, 5, 3],
    fanout: 2,
    nodeDetail: 0,
    track: 140,
    packages: 12,
    satellites: 5,
    link: [36, 4],
  },
};

/** The governor's terminal "lite" step: what it drops (materials are never swapped). */
export const SCENE_LITE = {
  /** Share of the swarm's buffer still drawn. */
  pointsShare: 0.5,
  packages: 10,
} as const;

export const SCENE_GOVERNOR = {
  minFps: { high: 50, mid: 45 },
  recoverFps: 57,
  warmupSeconds: 1.5,
  bailFps: 28,
  bailWindows: 4,
} as const;

/** The canvas's `dpr` range for `tier` on this viewport and screen. */
export function clampSceneDpr(
  tier: SceneCanvasTier,
  w: number,
  h: number,
  deviceDpr: number,
): [number, number] {
  const config = SCENE_TIER_CONFIG[tier];
  return clampDprRange(config.dpr, w, h, deviceDpr, config.pixelBudget);
}

/**
 * The governor for `tier`. `skipDpr` when the canvas is already at 1× (nothing to drop but
 * detail). A forced scene (QA / e2e) never bails: SwiftShader must stay deterministic.
 */
export function sceneGovernorOptions(
  tier: SceneCanvasTier,
  force3d: boolean,
  skipDpr: boolean,
): Partial<FpsGovernorOptions> {
  return {
    minFps: SCENE_GOVERNOR.minFps[tier],
    recoverFps: SCENE_GOVERNOR.recoverFps,
    warmupSeconds: SCENE_GOVERNOR.warmupSeconds,
    skipDpr,
    ...(force3d ? {} : { bailFps: SCENE_GOVERNOR.bailFps, bailWindows: SCENE_GOVERNOR.bailWindows }),
  };
}

/** The `dpr` to hand the canvas at a governor step: every step below "full" caps it at 1×. */
export function dprForStep(base: readonly [number, number], step: GovernorStep): [number, number] {
  return step === "full" ? [base[0], base[1]] : [Math.min(base[0], 1), Math.min(base[1], 1)];
}

/** How many of `count` points stay drawn (lite halves them, never below one). */
export function pointsDrawn(count: number, lite: boolean): number {
  const whole = Math.max(0, Math.floor(count));
  return lite ? Math.max(Math.min(1, whole), Math.floor(whole * SCENE_LITE.pointsShare)) : whole;
}
