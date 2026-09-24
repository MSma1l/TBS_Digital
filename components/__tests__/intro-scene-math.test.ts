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
  SWAY,
  createFpsGovernor,
  sampleFrame,
  steadyCadence,
  swayWeight,
  type FpsGovernor,
  type GovernorStep,
} from "@/components/intro/three/rig";

/*
 * The 3D scene's pure parts: the seeded particle attributes, the camera's handheld weight and
 * the FPS governor. `three/random.ts` and `three/rig.ts` only import types from three.js, so
 * none of this needs a WebGL context. (Where the camera actually IS at a given `fx.flight` is
 * `cameraAt`'s business and is covered by `intro-camera-path.test.ts`.)
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

describe("swayWeight", () => {
  it("is exactly zero while the camera is inside the machine", () => {
    // The camera is inside the machine to u ~0.60 (K3 pushed the exit back from 0.45): the walls
    // are a centimetre from the lens and they ARE the frame, so any pan swings the whole picture.
    // Not "small" — zero. 0.5 and 0.58 are the corridor beat, which the old 0.35 window panned.
    for (const u of [Number.NaN, -1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.58, SWAY.in[0]]) {
      expect(swayWeight(u)).toBe(0);
    }
  });

  it("is at full weight where the machine is seen whole (K4, K5)", () => {
    // 0.72, not 0.66: the window opens at the exit now, and its rise is 0.10 of a flight wide
    // because a shorter one turns a corner the neighbouring test forbids.
    expect(swayWeight(0.72)).toBe(1);
    expect(swayWeight(0.84)).toBe(1);
  });

  it("is gone again by the time the display covers the frame", () => {
    // K5 sits at exactly the cover distance: a residual pan opens a sliver of background along
    // one edge on the last frame of the intro.
    expect(swayWeight(1)).toBe(0);
    expect(swayWeight(SWAY.out[1])).toBe(0);
    expect(swayWeight(1.5)).toBe(0);
  });

  it("never leaves [0, 1] and turns no corners", () => {
    let previous = 0;
    for (let i = 0; i <= 400; i += 1) {
      const w = swayWeight(i / 400);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
      // A step of 1/400 of the flight may not move the weight more than a few percent: the
      // shorter of the two edges is the 0.12-wide fade-out, whose smoothstep peaks at 1.5/0.12.
      expect(Math.abs(w - previous)).toBeLessThan(0.04);
      previous = w;
    }
  });

  it("keeps the peak pan under three degrees, pointer and all", () => {
    expect(((SWAY.yaw + SWAY.pointerYaw) * 180) / Math.PI).toBeLessThan(6);
    expect(SWAY.pitch).toBeLessThan(SWAY.yaw);
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
