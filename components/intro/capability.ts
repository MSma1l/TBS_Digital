/**
 * Can this device run the 3D intro, and how much of it?
 *
 * No three.js here, and nothing runs at import: the shell and the director decide between
 * the WebGL scene and the SVG fallback BEFORE the scene chunk is ever requested.
 *
 * The probe's order is part of the contract. `ResizeObserver` is checked before any canvas
 * is created, so jsdom (which has neither) answers "no WebGL" without ever calling
 * `getContext` — no "Not implemented" noise, and no WebGL mocks in unit tests. The GPU
 * question itself goes to the site's one probe (`components/three/capability.ts`), which
 * remembers the answer for the tab: a reload, and the interior stage, never probe again.
 */

import { detectTier, mediaMatches, readDeviceProfile, type DeviceTier } from "@/lib/device";
import { INTRO_FORCE_3D_KEY } from "@/lib/intro";
import { decideWebGL } from "@/lib/gpuProbe";
import { PREFERS_REDUCED_MOTION } from "@/lib/sound/sound";
import { clampDprRange, probeGpu } from "@/components/three/capability";
import { HIGH_TIER_PIXEL_BUDGET, TIER_CONFIG } from "./tiers";

export { detectTier, type DeviceProfile } from "@/lib/device";
export { SOFTWARE_RENDERER_PATTERN } from "@/components/three/capability";
export { HIGH_TIER_PIXEL_BUDGET, TIER_CONFIG, type TierConfig } from "./tiers";

export type IntroTier = DeviceTier;

/**
 * The `dpr` range to hand the canvas. Never above the device's own ratio (rendering pixels
 * the screen can't show), never above the tier's cap, and on the high tier within the pixel
 * budget — but never below 1× on a normal screen, where a softer glass would read as a bug.
 */
export function clampDpr(
  tier: IntroTier,
  w: number,
  h: number,
  deviceDpr: number,
): [number, number] {
  return clampDprRange(
    TIER_CONFIG[tier].dpr,
    w,
    h,
    deviceDpr,
    tier === "high" ? HIGH_TIER_PIXEL_BUDGET : undefined,
  );
}

export type IntroCapability = {
  /** Mount the WebGL scene (`false` → the SVG fallback stays). */
  webgl: boolean;
  tier: IntroTier;
  /** Pointer parallax only with a real hovering pointer. */
  parallax: boolean;
  /** `INTRO_FORCE_3D_KEY` was set: skip `failIfMajorPerformanceCaveat` and the software-renderer check. */
  force3d: boolean;
};

type NavigatorExtras = Navigator & {
  connection?: { saveData?: boolean };
};

function readForce3d(): boolean {
  try {
    return window.localStorage.getItem(INTRO_FORCE_3D_KEY) === "force";
  } catch {
    return false;
  }
}

/** Client only (call it from an effect or a client-only component). On the server: no WebGL. */
export function probeIntroCapability(): IntroCapability {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { webgl: false, tier: "low", parallax: false, force3d: false };
  }

  const force3d = readForce3d();
  const answer = (webgl: boolean): IntroCapability => ({
    webgl,
    tier: detectTier(readDeviceProfile()),
    parallax: mediaMatches("(pointer: fine) and (hover: hover)"),
    force3d,
  });

  if (typeof window.ResizeObserver === "undefined") return answer(false);
  if (mediaMatches(PREFERS_REDUCED_MOTION)) return answer(false);
  if ((navigator as NavigatorExtras).connection?.saveData) return answer(false);
  // A software renderer answers "no" unless QA forced 3D; a context a scene lost (or gave up
  // on as too slow) earlier in this tab answers "no" too.
  return answer(decideWebGL(probeGpu(force3d ? "forced" : "strict"), force3d));
}
