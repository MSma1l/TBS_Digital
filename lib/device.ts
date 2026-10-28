/**
 * What the device can take, read once from the browser — the interior stage picks its tier
 * from it (`detectSceneTier`).
 *
 * No `"use client"` and nothing runs at import: every reader checks for `window` first, so
 * a server component or `e2e/helpers.ts` can import the types and the pure tier rules.
 */

export type DeviceTier = "high" | "mid" | "low";

/** What a tier is decided from. `cores`/`memory` are `undefined` where the browser won't say (Safari). */
export type DeviceProfile = {
  /** Viewport size in CSS pixels. */
  w: number;
  h: number;
  /** `devicePixelRatio`. Carried for the DPR clamp; a dense screen is not a slower GPU, so it doesn't pick the tier. */
  dpr: number;
  cores?: number;
  memory?: number;
  /** `(pointer: coarse)` — a touch-first device. */
  coarse: boolean;
};

type NavigatorExtras = Navigator & { deviceMemory?: number };

/** The media query that says the visitor asked for less movement — and less feedback. */
export const PREFERS_REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** `matchMedia(query).matches`, and `false` wherever there is no `matchMedia` (the server, old engines). */
export function mediaMatches(query: string): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches
  );
}

/** Client only (call it from an effect). */
export function readDeviceProfile(): DeviceProfile {
  const nav = navigator as NavigatorExtras;
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    cores: nav.hardwareConcurrency || undefined,
    memory: nav.deviceMemory,
    coarse: mediaMatches("(pointer: coarse)"),
  };
}

/**
 * The interior stage's tier — deliberately loose on phones. Chrome rounds `deviceMemory` DOWN
 * to a power of two (a 6 GB phone reports 4) and Safari masks `hardwareConcurrency`, so a
 * `<= 4` rule would class nearly every phone as low.
 *  · touch-first — low only when it reports under 4 GB, otherwise mid (never high);
 *  · otherwise   — low under 4 cores or under 4 GB (when known), mid on a short side under
 *    600px, high for the rest.
 * "Capable" is then decided empirically by the FPS governor's bail, not guessed from specs.
 */
export function detectSceneTier({ w, h, cores, memory, coarse }: DeviceProfile): DeviceTier {
  if (coarse) return memory !== undefined && memory < 4 ? "low" : "mid";
  if ((cores !== undefined && cores < 4) || (memory !== undefined && memory < 4)) return "low";
  return Math.min(w, h) < 600 ? "mid" : "high";
}
