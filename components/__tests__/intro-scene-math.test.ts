import { describe, expect, it } from "vitest";
import { TIER_CONFIG } from "@/components/intro/capability";
import {
  ORBITS,
  ORBIT_SEED,
  PORTRAIT_ORBIT_STRETCH,
  buildOrbitAttributes,
  mulberry32,
} from "@/components/intro/three/random";
import {
  CAP_MIN_FPS,
  DEFAULT_GOVERNOR,
  MAX_YAW,
  RIG_FIT,
  createFpsGovernor,
  fitRig,
  fitWidthFraction,
  sampleFrame,
  steadyCadence,
  type FpsGovernor,
  type GovernorStep,
} from "@/components/intro/three/rig";

/*
 * The 3D scene's pure parts: the seeded particle attributes, the fit of the ∞ to the
 * viewport and the FPS governor. `three/random.ts` and `three/rig.ts` only import types from
 * three.js, so none of this needs a WebGL context.
 */

describe("mulberry32", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = Array.from({ length: 64 }, a);
    const seqB = Array.from({ length: 64 }, b);
    const seqC = Array.from({ length: 64 }, c);
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const value of seqA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("buildOrbitAttributes", () => {
  const COUNT = TIER_CONFIG.high.particles;

  it("gives byte-identical arrays for the same seed", () => {
    const first = buildOrbitAttributes(COUNT, false, ORBIT_SEED);
    const second = buildOrbitAttributes(COUNT, false, ORBIT_SEED);
    for (const key of ["aAxisU", "aAxisV", "aOrbit", "aPhase", "aSeed", "orbitIndex"] as const) {
      expect(second[key]).toEqual(first[key]);
    }
  });

  it("differs for a different seed (the orbits stay, the scatter changes)", () => {
    const first = buildOrbitAttributes(COUNT, false, ORBIT_SEED);
    const other = buildOrbitAttributes(COUNT, false, ORBIT_SEED + 1);
    expect(other.aPhase).not.toEqual(first.aPhase);
    expect(other.aSeed).not.toEqual(first.aSeed);
    expect(other.orbitIndex).toEqual(first.orbitIndex);
  });

  it("sizes every attribute for the count and keeps values in range", () => {
    for (const tier of ["high", "mid", "low"] as const) {
      const count = TIER_CONFIG[tier].particles;
      const attrs = buildOrbitAttributes(count, false);
      expect(attrs.count).toBe(count);
      expect(attrs.aAxisU).toHaveLength(count * 3);
      expect(attrs.aAxisV).toHaveLength(count * 3);
      expect(attrs.aOrbit).toHaveLength(count * 3);
      expect(attrs.aSeed).toHaveLength(count * 3);
      expect(attrs.aPhase).toHaveLength(count);
      for (let i = 0; i < count; i += 1) {
        expect(attrs.aPhase[i]).toBeGreaterThanOrEqual(0);
        expect(attrs.aPhase[i]).toBeLessThan(Math.PI * 2);
        expect(Math.abs(attrs.aSeed[i * 3])).toBeLessThanOrEqual(1);
        expect(Math.abs(attrs.aSeed[i * 3 + 1])).toBeLessThanOrEqual(1);
        expect(attrs.aSeed[i * 3 + 2]).toBeGreaterThanOrEqual(0);
        expect(attrs.aSeed[i * 3 + 2]).toBeLessThan(1);
      }
    }
    expect(buildOrbitAttributes(0, false).count).toBe(0);
  });

  it("uses an orthonormal, tilted basis per orbit", () => {
    const attrs = buildOrbitAttributes(300, false);
    for (let i = 0; i < attrs.count; i += 1) {
      const u = attrs.aAxisU.subarray(i * 3, i * 3 + 3);
      const v = attrs.aAxisV.subarray(i * 3, i * 3 + 3);
      expect(Math.hypot(u[0], u[1], u[2])).toBeCloseTo(1, 5);
      expect(Math.hypot(v[0], v[1], v[2])).toBeCloseTo(1, 5);
      expect(u[0] * v[0] + u[1] * v[1] + u[2] * v[2]).toBeCloseTo(0, 5);
    }
    // Three different planes, none of them facing the camera flat-on.
    const normals = new Set<string>();
    for (let i = 0; i < attrs.count; i += 1) {
      const u = attrs.aAxisU.subarray(i * 3, i * 3 + 3);
      const v = attrs.aAxisV.subarray(i * 3, i * 3 + 3);
      const nz = u[0] * v[1] - u[1] * v[0];
      expect(Math.abs(nz)).toBeLessThan(0.999);
      normals.add(Array.from(u, (x) => x.toFixed(3)).join(","));
    }
    expect(normals.size).toBe(ORBITS.length);
  });

  it("splits the particles by share, and every half-prefix still holds all three orbits", () => {
    const count = TIER_CONFIG.high.particles;
    const attrs = buildOrbitAttributes(count, false);
    const tally = (end: number) => {
      const counts = ORBITS.map(() => 0);
      for (let i = 0; i < end; i += 1) counts[attrs.orbitIndex[i]] += 1;
      return counts;
    };
    tally(count).forEach((n, o) => expect(n / count).toBeCloseTo(ORBITS[o].share, 1));
    // "lite" draws the first half only (setDrawRange): no orbit may vanish.
    const half = Math.floor(count / 2);
    tally(half).forEach((n, o) => expect(n / half).toBeCloseTo(ORBITS[o].share, 1));
  });

  it("stretches the orbits for portrait", () => {
    const land = buildOrbitAttributes(120, false);
    const port = buildOrbitAttributes(120, true);
    for (let i = 0; i < 120; i += 1) {
      expect(port.aOrbit[i * 3]).toBeCloseTo(land.aOrbit[i * 3] * PORTRAIT_ORBIT_STRETCH.rx, 5);
      expect(port.aOrbit[i * 3 + 1]).toBeCloseTo(
        land.aOrbit[i * 3 + 1] * PORTRAIT_ORBIT_STRETCH.ry,
        5,
      );
    }
  });
});

describe("fitRig", () => {
  const VIEWPORTS: Array<[number, number]> = [
    [1280, 800],
    [1920, 1080],
    [2560, 1080],
    [1024, 768],
    [861, 700],
    [844, 390],
    [390, 844],
    [320, 720],
    [360, 640],
    [768, 1024],
  ];

  it("never scales the ∞ above its modelled size", () => {
    for (const [w, h] of VIEWPORTS) {
      const fit = fitRig(w, h);
      expect(fit.scale).toBeGreaterThan(0);
      expect(fit.scale).toBeLessThanOrEqual(1);
    }
    expect(fitRig(0, 0).scale).toBeLessThanOrEqual(1);
  });

  it("spans about 50% of the width on a desktop", () => {
    const fit = fitRig(1280, 800);
    expect(fit.portrait).toBe(false);
    expect(fitWidthFraction(fit, 1280, 800)).toBeCloseTo(RIG_FIT.landscapeFill, 2);
    expect(fit.scale).toBeCloseTo(0.95, 2);
  });

  it("spans about 86% of the width on a phone in portrait", () => {
    for (const [w, h] of [
      [390, 844],
      [320, 720],
      [360, 640],
    ] as const) {
      const fit = fitRig(w, h);
      expect(fit.portrait).toBe(true);
      expect(fitWidthFraction(fit, w, h)).toBeCloseTo(RIG_FIT.portraitFill, 2);
    }
  });

  it("stops growing on very wide screens instead of passing 1×", () => {
    const fit = fitRig(2560, 1080);
    expect(fit.scale).toBe(1);
    expect(fitWidthFraction(fit, 2560, 1080)).toBeLessThan(RIG_FIT.landscapeFill);
  });

  it("lifts the ∞ above the centre, more in portrait (room for the HUD readout)", () => {
    const land = fitRig(1280, 800);
    const port = fitRig(390, 844);
    expect(land.offsetY).toBeGreaterThan(0);
    expect(port.offsetY).toBeGreaterThan(land.offsetY);
  });

  it("keeps the sway short of edge-on", () => {
    expect(MAX_YAW).toBeCloseTo((35 * Math.PI) / 180, 6);
    expect(MAX_YAW).toBeLessThan(Math.PI / 2);
  });
});

describe("FPS governor", () => {
  /*
   * Frame rates are powers of two (16/32/64 fps): their deltas add up exactly in floating
   * point, so every 1 s window closes on the frame it should and no test depends on rounding.
   *
   * A steady stream at one rate is what a refresh CAP looks like (30 Hz Low Power / Energy
   * Saver), which the governor deliberately does not punish. A device that is really slow
   * presents frames unevenly, so SLOW is delivered as short/long pairs — half and one and a
   * half of the mean interval (1/64 s and 3/64 s), still exact, still 32 fps on average.
   */
  type Rate = number | { fps: number; uneven: true };

  function run(gov: FpsGovernor, rate: Rate, seconds: number): GovernorStep[] {
    const fps = typeof rate === "number" ? rate : rate.fps;
    const uneven = typeof rate !== "number";
    const changes: GovernorStep[] = [];
    const frames = Math.round(fps * seconds);
    for (let i = 0; i < frames; i += 1) {
      const next = sampleFrame(gov, (uneven ? (i % 2 === 0 ? 0.5 : 1.5) : 1) / fps);
      if (next) changes.push(next);
    }
    return changes;
  }

  /** Feed `dt(i)` for `frames` frames and collect the steps. */
  function feed(gov: FpsGovernor, frames: number, dt: (i: number) => number): GovernorStep[] {
    const changes: GovernorStep[] = [];
    for (let i = 0; i < frames; i += 1) {
      const next = sampleFrame(gov, dt(i));
      if (next) changes.push(next);
    }
    return changes;
  }

  const SLOW: Rate = { fps: 32, uneven: true }; // < minFps 45
  const FAST = 64; // >= recoverFps 57
  const warm = (gov: FpsGovernor) => run(gov, FAST, DEFAULT_GOVERNOR.warmupSeconds);

  it("leaves a smooth scene alone", () => {
    const gov = createFpsGovernor();
    expect(run(gov, FAST, 10)).toEqual([]);
    expect(gov.step).toBe("full");
  });

  it("ignores the warm-up and a single slow window", () => {
    const gov = createFpsGovernor();
    expect(run(gov, 16, DEFAULT_GOVERNOR.warmupSeconds)).toEqual([]);
    expect(run(gov, SLOW, 1)).toEqual([]);
    expect(run(gov, FAST, 3)).toEqual([]);
    expect(run(gov, SLOW, 1)).toEqual([]);
    expect(gov.step).toBe("full");
  });

  it("steps the pixel ratio down after sustained low FPS, then goes lite", () => {
    const gov = createFpsGovernor();
    warm(gov);
    expect(run(gov, SLOW, 2)).toEqual(["dpr"]);
    expect(gov.step).toBe("dpr");
    expect(run(gov, SLOW, 2)).toEqual(["lite"]);
    expect(gov.step).toBe("lite");
    // Lite is terminal: no halo popping back in mid-intro.
    expect(run(gov, FAST, 10)).toEqual([]);
    expect(run(gov, 16, 10)).toEqual([]);
  });

  it("goes straight to lite when the canvas is already at 1×", () => {
    const gov = createFpsGovernor({ skipDpr: true });
    warm(gov);
    expect(run(gov, SLOW, 2)).toEqual(["lite"]);
  });

  it("recovers the pixel ratio, but stops flip-flopping once the budget is spent", () => {
    const gov = createFpsGovernor({ maxFlips: 2 });
    warm(gov);
    expect(run(gov, SLOW, 2)).toEqual(["dpr"]);
    expect(run(gov, FAST, 3)).toEqual(["full"]); // flip 1
    expect(run(gov, SLOW, 2)).toEqual(["dpr"]); // flip 2: the budget is spent
    expect(gov.settled).toBe(true);
    expect(run(gov, FAST, 6)).toEqual([]); // no more recovering
    expect(gov.step).toBe("dpr");
    // A struggling device may still drop to lite.
    expect(run(gov, SLOW, 2)).toEqual(["lite"]);
  });

  it("treats a stall (hidden tab, resumed frameloop) as a reset, not as slowness", () => {
    const gov = createFpsGovernor();
    warm(gov);
    for (let i = 0; i < 10; i += 1) {
      expect(run(gov, SLOW, 0.5)).toEqual([]);
      expect(sampleFrame(gov, 2)).toBeNull();
    }
    expect(gov.step).toBe("full");
    expect(sampleFrame(gov, 0)).toBeNull();
    expect(sampleFrame(gov, Number.NaN)).toBeNull();
  });

  /* A real 30 Hz cap: rAF intervals wobble by a millisecond or so around 33.3 ms. */
  const capped30 = (i: number) => (1 + 0.03 * Math.sin(i * 1.7)) / 30;

  it("does not treat a steady 30 Hz cap (Low Power Mode, Energy Saver) as slowness", () => {
    for (const minFps of [45, 40]) {
      for (const skipDpr of [false, true]) {
        const gov = createFpsGovernor({ minFps, skipDpr });
        warm(gov);
        expect(feed(gov, 30 * 12, capped30)).toEqual([]);
        expect(gov.step).toBe("full");
      }
    }
  });

  it("keeps a cap a cap through the odd hitch, and when it switches on mid-intro", () => {
    const gov = createFpsGovernor();
    warm(gov);
    expect(run(gov, FAST, 3)).toEqual([]);
    // One 120 ms frame (GC, a texture upload) per second of 30 Hz frames.
    expect(feed(gov, 30 * 10, (i) => (i % 30 === 29 ? 0.12 : capped30(i)))).toEqual([]);
    expect(gov.step).toBe("full");
  });

  it("still steps a jittery slow stream down, cap or no cap in sight", () => {
    const random = mulberry32(7);
    const gov = createFpsGovernor();
    warm(gov);
    // 20–60 ms frames: 25 fps on average, spread far wider than any refresh cap.
    expect(feed(gov, 25 * 10, () => 0.02 + random() * 0.04)).toEqual(["dpr", "lite"]);
    expect(gov.step).toBe("lite");
  });

  it("treats a steady cadence below CAP_MIN_FPS as a slow device, not a cap", () => {
    const gov = createFpsGovernor();
    warm(gov);
    expect(CAP_MIN_FPS).toBeGreaterThan(16);
    expect(run(gov, 16, 2)).toEqual(["dpr"]);
  });

  it("steadyCadence names the ceiling only for tight, fast-enough, well-sampled streams", () => {
    const steady = Array.from({ length: 30 }, (_, i) => capped30(i));
    expect(steadyCadence(steady)).toBeCloseTo(30, 0);
    expect(steadyCadence(Array.from({ length: 60 }, () => 1 / 60))).toBeCloseTo(60, 6);
    // Uneven pairs (the SLOW stream), a cadence too slow to be a cap, too few samples.
    expect(steadyCadence(Array.from({ length: 32 }, (_, i) => (i % 2 ? 3 : 1) / 64))).toBeNull();
    expect(steadyCadence(Array.from({ length: 16 }, () => 1 / 16))).toBeNull();
    expect(steadyCadence(Array.from({ length: 7 }, () => 1 / 30))).toBeNull();
    expect(steadyCadence([])).toBeNull();
  });
});
