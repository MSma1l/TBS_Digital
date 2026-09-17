/**
 * How much of the intro each device tier draws. Pure data, no probe code: the scene's
 * geometry, particles and the director's entrance read it without pulling the capability
 * probe into their chunks.
 */

import type { DeviceTier } from "@/lib/device";

export type TierConfig = {
  /** `[min, max]` device-pixel ratio before the viewport budget (`clampDpr`). */
  dpr: readonly [number, number];
  antialias: boolean;
  /** Main glass tube: segments along the curve × around it. */
  tubular: number;
  radial: number;
  /** Transmission glass with a procedural environment, or the cheap fresnel shader. */
  glass: "physical" | "fresnel";
  /** A second, wider additive rim shell. */
  halo: boolean;
  /** Scan rings along the curve (0 = none). */
  rings: number;
  particles: number;
  /** Blur in the `<h1>` entrance (a full-width filter animation is too heavy for low). */
  blurEntrance: boolean;
};

export const TIER_CONFIG: Readonly<Record<DeviceTier, TierConfig>> = {
  high: {
    dpr: [1, 2],
    antialias: true,
    tubular: 420,
    radial: 32,
    glass: "physical",
    halo: true,
    rings: 24,
    particles: 900,
    blurEntrance: true,
  },
  mid: {
    dpr: [1, 1.5],
    antialias: false,
    tubular: 260,
    radial: 20,
    glass: "fresnel",
    halo: false,
    rings: 16,
    particles: 540,
    blurEntrance: true,
  },
  low: {
    dpr: [1, 1],
    antialias: false,
    tubular: 160,
    radial: 12,
    glass: "fresnel",
    halo: false,
    rings: 0,
    particles: 240,
    blurEntrance: false,
  },
};

/** Device pixels the high tier may fill (≈ a 1280×800 viewport at 1.77×): big desktops drop towards 1×. */
export const HIGH_TIER_PIXEL_BUDGET = 3.2e6;
