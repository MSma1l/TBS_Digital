import { describe, expect, it } from "vitest";
import {
  LEMNISCATE,
  LEMNISCATE_PATH,
  LEMNISCATE_VIEWBOX,
  lemniscatePath,
  lemniscatePoint,
} from "@/components/intro/lemniscate";
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
 * The intro's pure parts: the ∞ curve both renderers draw, the device tiers, the DPR clamp
 * and the director↔scene fx object. No three.js, no DOM.
 */

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

/** "M x y L x y … Z" → [[x, y], …]. */
function pathPoints(path: string): Array<[number, number]> {
  return path
    .replace(/^M/, "")
    .replace(/Z$/, "")
    .split("L")
    .map((pair) => pair.trim().split(/\s+/).map(Number) as [number, number]);
}

describe("lemniscate", () => {
  it("starts at the right lobe tip and crosses itself at the origin, one strand above the other", () => {
    expect(lemniscatePoint(0)).toEqual([LEMNISCATE.a, 0, 0]);
    const [x1, y1, z1] = lemniscatePoint(0.25);
    const [x2, y2, z2] = lemniscatePoint(0.75);
    expect(close(x1, 0) && close(y1, 0) && close(x2, 0) && close(y2, 0)).toBe(true);
    // The strands pass 2·depth apart, more than the tube's diameter: they never intersect.
    expect(z1 - z2).toBeCloseTo(2 * LEMNISCATE.depth);
    expect(z1 - z2).toBeGreaterThan(2 * LEMNISCATE.tube);
  });

  it("is symmetric: mirrored across x by half a loop, across y by running backwards", () => {
    for (const u of [0.03, 0.11, 0.2, 0.37, 0.42]) {
      const [x, y, z] = lemniscatePoint(u);
      const [hx, hy, hz] = lemniscatePoint(u + 0.5);
      const [bx, by, bz] = lemniscatePoint(1 - u);
      expect(close(hx, -x) && close(hy, y) && close(hz, -z)).toBe(true);
      expect(close(bx, x) && close(by, -y) && close(bz, -z)).toBe(true);
    }
  });

  it("stays within ±a wide and a/(2√2) tall", () => {
    for (let i = 0; i < 400; i += 1) {
      const [x, y, z] = lemniscatePoint(i / 400);
      expect(Math.abs(x)).toBeLessThanOrEqual(LEMNISCATE.a + 1e-9);
      expect(Math.abs(y)).toBeLessThanOrEqual(LEMNISCATE.a / (2 * Math.SQRT2) + 1e-9);
      expect(Math.abs(z)).toBeLessThanOrEqual(LEMNISCATE.depth + 1e-9);
    }
  });

  it("draws a closed SVG path that spans about ±160 and fits its viewBox", () => {
    expect(LEMNISCATE_PATH).toMatch(/^M-?\d/);
    expect(LEMNISCATE_PATH.endsWith("Z")).toBe(true);

    const points = pathPoints(LEMNISCATE_PATH);
    expect(points).toHaveLength(128);
    expect(points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    expect(Math.max(...xs)).toBeCloseTo(160, 0);
    expect(Math.min(...xs)).toBeCloseTo(-160, 0);

    const [minX, minY, width, height] = LEMNISCATE_VIEWBOX.split(" ").map(Number);
    expect(Math.min(...xs)).toBeGreaterThan(minX);
    expect(Math.max(...xs)).toBeLessThan(minX + width);
    expect(Math.min(...ys)).toBeGreaterThan(minY);
    expect(Math.max(...ys)).toBeLessThan(minY + height);
  });

  it("is deterministic and never prints -0", () => {
    expect(lemniscatePath(128, 100)).toBe(LEMNISCATE_PATH);
    expect(LEMNISCATE_PATH).not.toMatch(/-0(?![.\d])/);
    expect(pathPoints(lemniscatePath(2, 100))).toHaveLength(3);
  });
});

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
  it("never costs more on a lower tier", () => {
    const [high, mid, low] = (["high", "mid", "low"] as const).map((t) => TIER_CONFIG[t]);
    for (const key of ["tubular", "radial", "rings", "particles"] as const) {
      expect(high[key]).toBeGreaterThanOrEqual(mid[key]);
      expect(mid[key]).toBeGreaterThanOrEqual(low[key]);
    }
    expect(high.dpr[1]).toBeGreaterThanOrEqual(mid.dpr[1]);
    expect(mid.dpr[1]).toBeGreaterThanOrEqual(low.dpr[1]);
    expect(low.antialias || low.halo || low.blurEntrance).toBe(false);
    expect(mid.glass).toBe("fresnel");
    expect(high.glass).toBe("physical");
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
      dolly: 0,
      spin: 0,
    });
  });

  it("returns a fresh object per intro", () => {
    const a = createIntroFx();
    a.progress = 1;
    expect(createIntroFx().progress).toBe(0);
  });
});
