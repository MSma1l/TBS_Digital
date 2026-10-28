/**
 * How much of the interior scene — Work's DNA helix, its only model since 2026-10-28 — each
 * canvas tier draws, and how the FPS governor judges it. Pure data and arithmetic — no three.js,
 * no DOM — so the scene chunk and the unit tests share one table.
 *
 * Only "high" and "mid" ever get a canvas: the stage keeps the low tier on Work's flat card grid.
 * Counts are sized for a phone GPU at mid (JS update ≤ 2 ms, GPU ≤ 8 ms, overdraw ≈ 2) and a
 * laptop iGPU at high; the governor's "lite" step drops the helix's bits and its hologram's swap
 * glitch on top of either (three/models/helix.ts `setLite`).
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
  /** The Work helix: segments along each strand's tube and around it. */
  helixTube: readonly [number, number];
  /** Chips riding the two strands (instanced boxes), shared between them. */
  helixChips: number;
  /** Base pairs (rungs) along the helix. */
  helixRungs: number;
  /** Seven-segment 0/1 glyph slots drifting up the axis. */
  helixBits: number;
  /** The hologram's canvas texture (px): small on purpose, so a screenshot's fine print stays illegible. */
  hologram: readonly [number, number];
};

export const SCENE_TIER_CONFIG: Readonly<Record<SceneCanvasTier, SceneTierConfig>> = {
  high: {
    dpr: [1, 1.75],
    pixelBudget: 2.6e6,
    antialias: true,
    helixTube: [160, 4],
    helixChips: 80,
    helixRungs: 22,
    helixBits: 36,
    hologram: [384, 240],
  },
  mid: {
    dpr: [1, 1.5],
    pixelBudget: 1.25e6,
    antialias: false,
    helixTube: [100, 3],
    helixChips: 52,
    helixRungs: 14,
    helixBits: 20,
    hologram: [256, 160],
  },
};

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
