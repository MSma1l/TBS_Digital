import { describe, expect, it } from "vitest";
import {
  SCENE_GOVERNOR,
  SCENE_TIER_CONFIG,
  clampSceneDpr,
  dprForStep,
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
 * What each interior canvas tier draws — Work's helix, the scene's only model since 2026-10-28 —
 * and how the FPS governor treats it. The low tier never gets a canvas (Work keeps its flat card
 * grid), so only "high" and "mid" are configured; a forced scene (QA, e2e under SwiftShader) must
 * never bail.
 */

describe("scene tiers — budgets", () => {
  const { high, mid } = SCENE_TIER_CONFIG;

  it("high draws at least as much as mid, everywhere", () => {
    const counts: Array<[string, number, number]> = [
      ["dpr max", high.dpr[1], mid.dpr[1]],
      ["pixel budget", high.pixelBudget, mid.pixelBudget],
      ["helix tube", high.helixTube[0] * high.helixTube[1], mid.helixTube[0] * mid.helixTube[1]],
      ["helix chips", high.helixChips, mid.helixChips],
      ["helix rungs", high.helixRungs, mid.helixRungs],
      ["helix bits", high.helixBits, mid.helixBits],
      ["hologram", high.hologram[0] * high.hologram[1], mid.hologram[0] * mid.hologram[1]],
    ];
    for (const [name, h, m] of counts) expect(h, name).toBeGreaterThanOrEqual(m);
  });

  it("the Work helix: 160×4 tubes, 80 chips, 22 rungs, 36 bits, a 384×240 hologram on high; 100×3, 52, 14, 20, 256×160 on mid", () => {
    expect([high.helixTube, high.helixChips, high.helixRungs, high.helixBits, high.hologram]).toEqual([
      [160, 4],
      80,
      22,
      36,
      [384, 240],
    ]);
    expect([mid.helixTube, mid.helixChips, mid.helixRungs, mid.helixBits, mid.hologram]).toEqual([
      [100, 3],
      52,
      14,
      20,
      [256, 160],
    ]);
    for (const tier of [high, mid]) {
      // Chips split evenly between the two strands; the hologram is 16:10 and never above 384px
      // wide, so a screenshot's fine print stays illegible on it.
      expect(tier.helixChips % 2).toBe(0);
      expect(tier.hologram[0] / tier.hologram[1]).toBe(1.6);
      expect(tier.hologram[0]).toBeLessThanOrEqual(384);
    }
  });

  it("only high antialiases; no tier configures a model the scene no longer draws", () => {
    expect(high.antialias).toBe(true);
    expect(mid.antialias).toBe(false);
    for (const tier of [high, mid]) {
      for (const gone of [
        "glass",
        "sphere",
        "cloud",
        "transmissionScale",
        "chipTraces",
        "swarm",
        "cubes",
        "wave",
        "neural",
        "track",
        "packages",
        "satellites",
        "link",
        "statFace",
      ]) {
        expect(tier, gone).not.toHaveProperty(gone);
      }
    }
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
