/**
 * The handshake between the GSAP director and the 3D scene.
 *
 * `IntroFx` is one plain, mutable object: the director's timeline tweens its numbers, the
 * scene reads them every frame in `useFrame`. No React state in between — a state update
 * per frame would re-render the tree 60 times a second. No three.js and no GSAP imports
 * either, so both sides (and the tests) can share it without pulling the other in.
 */

import type { IntroTier } from "./capability";

/** Every field runs 0 → 1. */
export type IntroFx = {
  /** The synchronisation counter, 0–100% as 0–1. */
  progress: number;
  /** Heartbeat at 25/50/75%: jumps to 1, decays to 0. */
  pulse: number;
  /** Implosion just before the burst: the core shrinks, the rim brightens. */
  charge: number;
  /** The core blowing up to its burst scale. */
  burst: number;
  /** Particles thrown radially and towards the camera. */
  explode: number;
  /** The rim/line white-out at the moment of the burst. */
  flash: number;
  /** Camera dolly into the ∞ (z and fov). */
  dolly: number;
  /** The extra half-turn during the dolly. */
  spin: number;
};

/** A fresh, all-zero fx object. Call it once per intro (`useState(createIntroFx)`). */
export function createIntroFx(): IntroFx {
  return {
    progress: 0,
    pulse: 0,
    charge: 0,
    burst: 0,
    explode: 0,
    flash: 0,
    dolly: 0,
    spin: 0,
  };
}

/** What `IntroScene` receives from the director. */
export type IntroSceneProps = {
  /** Read every frame, never written by the scene. */
  fx: IntroFx;
  tier: IntroTier;
  /** Follow the pointer (fine, hovering pointers only). */
  parallax: boolean;
  /** Create the context without `failIfMajorPerformanceCaveat` (see `INTRO_FORCE_3D_KEY`). */
  force3d: boolean;
  /** Stop rendering (`frameloop="never"`): hidden tab, or the overlay has already faded out. */
  paused: boolean;
  /** Shaders compiled and a frame is on screen — the scene may be cross-faded in. */
  onReady: () => void;
  /** The context was lost or could not be created — go back to the SVG fallback. */
  onLost: () => void;
};
