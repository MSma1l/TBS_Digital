import { describe, expect, it } from "vitest";
import {
  SCENE_GOVERNOR,
  SCENE_LITE,
  SCENE_TIER_CONFIG,
  clampSceneDpr,
  dprForStep,
  pointsDrawn,
  sceneGovernorOptions,
} from "@/components/scene/tiers";
import {
  DEFAULT_GOVERNOR,
  createFpsGovernor,
  sampleFrame,
  type FpsGovernor,
  type GovernorStep,
} from "@/components/three/governor";

/*
 * What each interior canvas tier draws and how the FPS governor treats it. The low tier never
 * gets a canvas (the stage keeps the art), so only "high" and "mid" are configured; a forced
 * scene (QA, e2e under SwiftShader) must never bail.
 */

describe("scene tiers — budgets", () => {
  const { high, mid } = SCENE_TIER_CONFIG;
  const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

  it("high draws at least as much as mid, everywhere", () => {
    const counts: Array<[string, number, number]> = [
      ["dpr max", high.dpr[1], mid.dpr[1]],
      ["pixel budget", high.pixelBudget, mid.pixelBudget],
      ["sphere", high.sphere[0] * high.sphere[1], mid.sphere[0] * mid.sphere[1]],
      ["ring tubular", high.ringTubular, mid.ringTubular],
      ["ring radial", high.ringRadial, mid.ringRadial],
      ["cloud", high.cloud, mid.cloud],
      ["swarm", high.swarm, mid.swarm],
      ["cubes", high.cubes, mid.cubes],
      ["wave", high.wave[0] * high.wave[1], mid.wave[0] * mid.wave[1]],
      ["ui cards", high.uiCards, mid.uiCards],
      ["neural nodes", sum(high.neural), sum(mid.neural)],
      ["fanout", high.fanout, mid.fanout],
      ["node detail", high.nodeDetail, mid.nodeDetail],
      ["track", high.track, mid.track],
      ["packages", high.packages, mid.packages],
      ["satellites", high.satellites, mid.satellites],
      ["link", high.link[0] * high.link[1], mid.link[0] * mid.link[1]],
      ["transmission", high.transmissionScale, mid.transmissionScale],
    ];
    for (const [name, h, m] of counts) expect(h, name).toBeGreaterThanOrEqual(m);
  });

  it("only high pays for transmission glass and antialiasing; mid fakes the frost", () => {
    expect(high.glass).toBe("physical");
    expect(high.antialias).toBe(true);
    expect(mid.glass).toBe("frost");
    expect(mid.antialias).toBe(false);
    expect(mid.transmissionScale).toBe(0);
    expect(SCENE_LITE.transmissionScale).toBeLessThan(high.transmissionScale);
  });

  it("lite never asks for more packages than a tier has, and keeps the neural layers in shape", () => {
    expect(SCENE_LITE.packages).toBeLessThanOrEqual(mid.packages);
    for (const tier of [high, mid]) {
      expect(tier.neural.length).toBeGreaterThanOrEqual(3);
      expect(tier.cubes).toBeLessThanOrEqual(27);
    }
  });

  it("pointsDrawn halves a buffer in lite, never below one point", () => {
    expect(pointsDrawn(700, false)).toBe(700);
    expect(pointsDrawn(700, true)).toBe(350);
    expect(pointsDrawn(1, true)).toBe(1);
    expect(pointsDrawn(0, true)).toBe(0);
  });
});

describe("scene tiers — device-pixel ratio", () => {
  it("never above the device's own ratio or the tier's cap", () => {
    expect(clampSceneDpr("mid", 390, 844, 3)).toEqual([1, 1.5]);
    expect(clampSceneDpr("high", 1280, 800, 1)).toEqual([1, 1]);
    expect(clampSceneDpr("high", 1024, 640, 2)).toEqual([1, 1.75]);
  });

  it("big screens drop towards 1× within the pixel budget, but never below it", () => {
    const [, max] = clampSceneDpr("high", 1920, 1080, 2);
    expect(max).toBeCloseTo(Math.sqrt(SCENE_TIER_CONFIG.high.pixelBudget / (1920 * 1080)), 9);
    expect(max * max * 1920 * 1080).toBeLessThanOrEqual(SCENE_TIER_CONFIG.high.pixelBudget + 1);
    expect(clampSceneDpr("mid", 2560, 1600, 2)).toEqual([1, 1]);
  });

  it("every governor step below full caps the ratio at 1×", () => {
    expect(dprForStep([1, 1.5], "full")).toEqual([1, 1.5]);
    for (const step of ["dpr", "lite", "bail"] as GovernorStep[]) expect(dprForStep([1, 1.5], step)).toEqual([1, 1]);
    expect(dprForStep([0.75, 0.75], "lite")).toEqual([0.75, 0.75]);
  });
});

describe("scene tiers — governor", () => {
  type Rate = number | { fps: number; uneven: true };

  function run(gov: FpsGovernor, rate: Rate, seconds: number): GovernorStep[] {
    const fps = typeof rate === "number" ? rate : rate.fps;
    const uneven = typeof rate !== "number";
    const changes: GovernorStep[] = [];
    for (let i = 0; i < Math.round(fps * seconds); i += 1) {
      const next = sampleFrame(gov, (uneven ? (i % 2 === 0 ? 0.5 : 1.5) : 1) / fps);
      if (next) changes.push(next);
    }
    return changes;
  }

  const FAST = 64;
  const SLOW_16: Rate = { fps: 16, uneven: true };
  const SLOW_32: Rate = { fps: 32, uneven: true };

  function liteGovernor(force3d: boolean): FpsGovernor {
    const gov = createFpsGovernor(sceneGovernorOptions("mid", force3d, true));
    run(gov, FAST, SCENE_GOVERNOR.warmupSeconds);
    expect(run(gov, SLOW_32, 2)).toEqual(["lite"]);
    return gov;
  }

  it("uses the tier's thresholds and a longer warm-up", () => {
    const high = createFpsGovernor(sceneGovernorOptions("high", false, false)).options;
    expect(high.minFps).toBe(50);
    expect(high.recoverFps).toBe(57);
    expect(high.warmupSeconds).toBe(1.5);
    expect(high.skipDpr).toBe(false);
    expect(createFpsGovernor(sceneGovernorOptions("mid", false, true)).options.minFps).toBe(45);
  });

  it("the intro's options stay untouched: no bail unless asked", () => {
    expect(createFpsGovernor({}).options.bailFps).toBe(DEFAULT_GOVERNOR.bailFps);
    expect(DEFAULT_GOVERNOR.bailFps).toBe(0);
  });

  it("gives up on a device that stays slow once lite", () => {
    const gov = liteGovernor(false);
    expect(run(gov, SLOW_16, 6)).toEqual(["bail"]);
    expect(gov.step).toBe("bail");
    // terminal
    expect(run(gov, FAST, 5)).toEqual([]);
  });

  it("never bails a forced scene (QA / SwiftShader stays deterministic)", () => {
    expect(sceneGovernorOptions("mid", true, true).bailFps).toBeUndefined();
    const gov = liteGovernor(true);
    expect(run(gov, SLOW_16, 20)).toEqual([]);
    expect(gov.step).toBe("lite");
  });

  it("a steady 30 Hz power-saving cap is not slowness: it never bails", () => {
    const gov = createFpsGovernor(sceneGovernorOptions("mid", false, true));
    const changes: GovernorStep[] = [];
    for (let i = 0; i < 30 * 30; i += 1) {
      const next = sampleFrame(gov, (1 + 0.03 * Math.sin(i * 1.7)) / 30);
      if (next) changes.push(next);
    }
    expect(changes).not.toContain("bail");
  });
});
