import { describe, expect, it } from "vitest";
import {
  HIGH_TIER_PIXEL_BUDGET,
  TIER_CONFIG,
  clampDpr,
  detectTier,
  type DeviceProfile,
  type IntroTier,
} from "@/components/intro/capability";
import { createIntroFx } from "@/components/intro/fx";

/*
 * The intro's pure parts: the device tiers, the DPR clamp and the director↔scene fx object.
 * No three.js, no DOM. (The camera flight has its own file, `intro-camera-path.test.ts`.)
 */

describe("detectTier", () => {
  const desktop: DeviceProfile = { w: 1440, h: 900, dpr: 2, cores: 8, memory: 8, coarse: false };

  const table: Array<[string, Partial<DeviceProfile>, IntroTier]> = [
    ["a capable desktop", {}, "high"],
    ["4 cores", { cores: 4 }, "low"],
    ["4 GB of memory", { memory: 4 }, "low"],
    ["a low-end touch phone", { w: 360, h: 780, cores: 4, coarse: true }, "low"],
    ["a touch-first device", { coarse: true }, "mid"],
    ["a short side under 600px", { w: 1280, h: 560 }, "mid"],
    ["a capable phone", { w: 390, h: 844, cores: 6, coarse: true }, "mid"],
    ["Safari: cores and memory unknown", { cores: undefined, memory: undefined }, "high"],
    ["a dense screen alone", { dpr: 3 }, "high"],
  ];

  for (const [name, overrides, tier] of table) {
    it(`${name} → ${tier}`, () => {
      expect(detectTier({ ...desktop, ...overrides })).toBe(tier);
    });
  }
});

describe("tier config", () => {
  const [high, mid, low] = (["high", "mid", "low"] as const).map((t) => TIER_CONFIG[t]);

  it("never costs more on a lower tier", () => {
    expect(high.particles).toBeGreaterThanOrEqual(mid.particles);
    expect(mid.particles).toBeGreaterThanOrEqual(low.particles);
    expect(high.dpr[1]).toBeGreaterThanOrEqual(mid.dpr[1]);
    expect(mid.dpr[1]).toBeGreaterThanOrEqual(low.dpr[1]);
    expect(low.antialias || low.halo || low.blurEntrance).toBe(false);
  });

  /*
   * The two levers that are draw calls rather than numbers. Both belong to the high tier alone,
   * and both are monotone: a tier that gives up the halo must not keep the transmissive pane,
   * because the pane is the far more expensive of the two (a full re-render of the scene into a
   * multisampled target, every frame).
   */
  it("spends its two extra draw calls only at the top, and in order", () => {
    expect(high.glass).toBe("physical");
    expect(high.halo).toBe(true);
    for (const config of [mid, low]) {
      expect(config.glass).toBe("fresnel");
      expect(config.halo).toBe(false);
    }
    for (const config of [high, mid, low]) {
      if (config.glass === "physical") expect(config.halo).toBe(true);
    }
  });

  /* `TierConfig` describes pixels and draw calls only. The machine's own piece count is an index
     into `three/laptop.ts`'s drop table and lives there; a number here would be a second source
     of truth for one array. */
  it("carries no per-tier geometry counts", () => {
    for (const config of [high, mid, low]) {
      expect(Object.keys(config).sort()).toEqual([
        "antialias",
        "blurEntrance",
        "dpr",
        "glass",
        "halo",
        "particles",
      ]);
    }
  });
});

describe("clampDpr", () => {
  it("caps each tier and the device", () => {
    expect(clampDpr("mid", 412, 915, 2.625)).toEqual([1, 1.5]);
    expect(clampDpr("low", 390, 844, 3)).toEqual([1, 1]);
    expect(clampDpr("high", 800, 600, 1.25)).toEqual([1, 1.25]);
  });

  it("keeps the high tier inside its pixel budget, but not below 1×", () => {
    const [, max] = clampDpr("high", 1280, 800, 2);
    expect(max).toBeCloseTo(Math.sqrt(HIGH_TIER_PIXEL_BUDGET / (1280 * 800)));
    expect(clampDpr("high", 2560, 1440, 2)).toEqual([1, 1]);
    expect(clampDpr("high", 3840, 2160, 1.5)).toEqual([1, 1]);
  });

  it("follows a zoomed-out browser below 1× and survives a nonsense ratio", () => {
    expect(clampDpr("high", 1280, 800, 0.8)).toEqual([0.8, 0.8]);
    expect(clampDpr("mid", 390, 844, Number.NaN)).toEqual([1, 1]);
    expect(clampDpr("mid", 390, 844, 0)).toEqual([1, 1]);
  });

  it("always returns 0 < min ≤ max ≤ 2", () => {
    for (const tier of ["high", "mid", "low"] as const) {
      for (const [w, h] of [[320, 568], [390, 844], [1280, 800], [2560, 1440], [0, 0]]) {
        for (const dpr of [0.5, 1, 1.5, 2, 3, 4]) {
          const [min, max] = clampDpr(tier, w, h, dpr);
          expect(min).toBeGreaterThan(0);
          expect(min).toBeLessThanOrEqual(max);
          expect(max).toBeLessThanOrEqual(2);
        }
      }
    }
  });
});

describe("createIntroFx", () => {
  it("starts every channel at zero", () => {
    expect(createIntroFx()).toEqual({
      progress: 0,
      pulse: 0,
      charge: 0,
      burst: 0,
      explode: 0,
      flash: 0,
      flight: 0,
    });
  });

  it("returns a fresh object per intro", () => {
    const a = createIntroFx();
    a.progress = 1;
    expect(createIntroFx().progress).toBe(0);
  });
});
