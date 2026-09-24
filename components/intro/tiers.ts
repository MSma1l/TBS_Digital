/**
 * How much of the intro each device tier draws. Pure data, no probe code: the scene's geometry,
 * particles and the director's entrance read it without pulling the capability probe into their
 * chunks.
 *
 * The machine's own detail is NOT a number here. Its 41 pieces are one `InstancedMesh`, so the
 * only lever is `mesh.count`, and the count has to be an index into the drop table that decides
 * which pieces go first — which is why it lives beside that table, in `three/laptop.ts`
 * (`LAPTOP_SLOT_COUNT` / `_MID` / `_LITE`). Two numbers here would be a second source of truth
 * for one array. What is left is what genuinely costs per tier: pixels (`dpr`, `antialias`), the
 * transmissive pane, the halo's second draw call, and the particle count.
 */

import type { DeviceTier } from "@/lib/device";

export type TierConfig = {
  /** `[min, max]` device-pixel ratio before the viewport budget (`clampDpr`). */
  dpr: readonly [number, number];
  antialias: boolean;
  /**
   * `"physical"` gives the lid a transmissive cover pane — the ONE transmissive surface in the
   * scene, and the reason the tier also installs the PMREM environment. `"fresnel"` is now
   * simply "no pane at all": the shader that used to stand in for it read `uv.x` as arc length
   * on a closed loop and is gone with the ∞ (`three/materials.ts`). One less shader to compile,
   * on exactly the devices that compile slowly.
   */
  glass: "physical" | "fresnel";
  /**
   * The frame's back-face copy, its instance matrices grown ×1.06 — a second draw call over the
   * same 41 boxes (`three/laptop.ts`). Inside the chassis it is a flat wash on the walls, so it
   * only earns its keep once the camera is outside and the machine is seen whole.
   */
  halo: boolean;
  particles: number;
  /** Blur in the `<h1>` entrance (a full-width filter animation is too heavy for low). */
  blurEntrance: boolean;
};

export const TIER_CONFIG: Readonly<Record<DeviceTier, TierConfig>> = {
  high: {
    dpr: [1, 2],
    antialias: true,
    glass: "physical",
    halo: true,
    particles: 900,
    blurEntrance: true,
  },
  mid: {
    dpr: [1, 1.5],
    antialias: false,
    glass: "fresnel",
    halo: false,
    particles: 540,
    blurEntrance: true,
  },
  low: {
    dpr: [1, 1],
    antialias: false,
    glass: "fresnel",
    halo: false,
    particles: 240,
    blurEntrance: false,
  },
};

/** Device pixels the high tier may fill (≈ a 1280×800 viewport at 1.77×): big desktops drop towards 1×. */
export const HIGH_TIER_PIXEL_BUDGET = 3.2e6;
