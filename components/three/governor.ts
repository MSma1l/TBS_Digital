/* --------------------------------------------------------------------------------------
 * FPS governor — the drei `PerformanceMonitor` replacement, shared by the intro and the
 * interior scene. Plain TypeScript, no three.js, unit-tested.
 *
 * Frame deltas are averaged over ~1s windows. Two slow windows in a row step the quality
 * down: first the device-pixel ratio to 1×, then "lite". Three fast windows at the reduced
 * ratio step back up. Each change of direction is a flip; once the flip budget is spent the
 * governor settles and never raises quality again, so a device on the edge doesn't oscillate
 * (every DPR change re-allocates the canvas and costs a hitch of its own). Materials are
 * never swapped — that would recompile shaders.
 *
 * "lite" is terminal for the intro: popping detail back in mid-intro would look like a
 * glitch. A scene that can live without WebGL (the interior stage) may also opt into a
 * "bail" (`bailFps` > 0): once lite, `bailWindows` slow windows in a row give up on the
 * device, and "bail" is terminal. With `bailFps` unset (0) nothing changes.
 *
 * A refresh CAP is not slowness. iOS Low Power Mode and Chrome's Energy Saver hold
 * requestAnimationFrame at a steady 30 Hz, and no quality step can raise that — stepping
 * down would only cost a hitch and the particles. So each window also measures its cadence:
 * when the frame intervals cluster tightly on one value, that value is the ceiling, and the
 * window counts as slow only below `CAP_SLACK` of it. A struggling device delivers uneven
 * frames and is judged against `minFps` (or `bailFps`) as before. Measured per window rather
 * than once in the warm-up: the warm-up is where shader-compile hitches land (they would hide
 * a cap), and a cap can switch on mid-scene.
 * ------------------------------------------------------------------------------------ */

export type GovernorStep = "full" | "dpr" | "lite" | "bail";

export type FpsGovernorOptions = {
  /** Below this average FPS a window counts as slow. */
  minFps: number;
  /** At or above this average FPS a window counts as fast. */
  recoverFps: number;
  windowSeconds: number;
  /** Slow windows in a row before stepping down. */
  slowWindows: number;
  /** Fast windows in a row before stepping back up. */
  fastWindows: number;
  /** Direction changes allowed before the governor settles. */
  maxFlips: number;
  /** Frames in the first moments (shader warm-up, chunk parsing) are not judged. */
  warmupSeconds: number;
  /** The canvas is already at 1× (low tier, 1× screens): go straight to "lite". */
  skipDpr: boolean;
  /** Once lite, windows below this FPS count towards "bail". 0 = never bail. */
  bailFps: number;
  /** Slow lite windows in a row before "bail". */
  bailWindows: number;
};

export const DEFAULT_GOVERNOR: FpsGovernorOptions = {
  minFps: 45,
  recoverFps: 57,
  windowSeconds: 1,
  slowWindows: 2,
  fastWindows: 3,
  maxFlips: 2,
  warmupSeconds: 0.5,
  skipDpr: false,
  bailFps: 0,
  bailWindows: 4,
};

/** Deltas above this are a hidden tab or a resumed frameloop, not a measure of speed. */
export const GOVERNOR_MAX_DELTA = 0.5;

/** Frame intervals count as one steady cadence when p90 / p10 stays below this. */
export const CAP_STEADINESS = 1.25;
/** A capped window is slow only below this share of its own cadence. */
export const CAP_SLACK = 0.8;
/** Steady cadences under this are a slow device, not a power-saving cap (those are 30 Hz). */
export const CAP_MIN_FPS = 24;
/** Fewer intervals than this say nothing about a cadence. */
const CAP_MIN_SAMPLES = 8;

/**
 * The refresh ceiling a window's frames were held at, in FPS — or `null` when they were not
 * steady enough to be a cap (or too slow to be one). Sorts `intervals` in place.
 */
export function steadyCadence(intervals: number[]): number | null {
  if (intervals.length < CAP_MIN_SAMPLES) return null;
  intervals.sort((a, b) => a - b);
  const at = (q: number) => intervals[Math.round(q * (intervals.length - 1))];
  const p10 = at(0.1);
  if (!(p10 > 0) || at(0.9) / p10 >= CAP_STEADINESS) return null;
  const fps = 1 / at(0.5);
  return fps >= CAP_MIN_FPS ? fps : null;
}

export type FpsGovernor = {
  options: FpsGovernorOptions;
  step: GovernorStep;
  warmup: number;
  elapsed: number;
  frames: number;
  /** This window's frame intervals, for its cadence (emptied when the window closes). */
  intervals: number[];
  slowRun: number;
  fastRun: number;
  /** Slow windows in a row since "lite" (only counted when bailing is on). */
  bailRun: number;
  flips: number;
  /** -1 last change lowered quality, 1 raised it, 0 none yet. */
  direction: -1 | 0 | 1;
  settled: boolean;
};

export function createFpsGovernor(options: Partial<FpsGovernorOptions> = {}): FpsGovernor {
  const merged = { ...DEFAULT_GOVERNOR, ...options };
  return {
    options: merged,
    step: "full",
    warmup: merged.warmupSeconds,
    elapsed: 0,
    frames: 0,
    intervals: [],
    slowRun: 0,
    fastRun: 0,
    bailRun: 0,
    flips: 0,
    direction: 0,
    settled: false,
  };
}

function change(gov: FpsGovernor, next: GovernorStep, direction: -1 | 1): GovernorStep | null {
  const reversal = gov.direction !== 0 && gov.direction !== direction;
  if (reversal && gov.flips >= gov.options.maxFlips) {
    // Out of flips. Lowering quality is still allowed (a struggling device comes first);
    // raising it again is not.
    if (direction === 1) {
      gov.settled = true;
      return null;
    }
  }
  if (reversal) gov.flips += 1;
  gov.direction = direction;
  gov.step = next;
  gov.slowRun = 0;
  gov.fastRun = 0;
  if (gov.flips >= gov.options.maxFlips && direction === -1) gov.settled = true;
  return next;
}

const bails = (gov: FpsGovernor) => gov.options.bailFps > 0 && gov.options.bailWindows > 0;

/**
 * Feed one frame's delta in seconds. Returns the new step when quality should change,
 * otherwise `null`.
 */
export function sampleFrame(gov: FpsGovernor, dt: number): GovernorStep | null {
  if (gov.step === "bail") return null;
  if (gov.step === "lite" && !bails(gov)) return null;
  if (!(dt > 0) || dt > GOVERNOR_MAX_DELTA) {
    // A stall, not a trend: start the window again.
    gov.elapsed = 0;
    gov.frames = 0;
    gov.intervals.length = 0;
    return null;
  }
  if (gov.warmup > 0) {
    gov.warmup -= dt;
    return null;
  }

  gov.elapsed += dt;
  gov.frames += 1;
  gov.intervals.push(dt);
  if (gov.elapsed < gov.options.windowSeconds) return null;

  const fps = gov.frames / gov.elapsed;
  const cadence = steadyCadence(gov.intervals);
  gov.elapsed = 0;
  gov.frames = 0;
  gov.intervals.length = 0;

  if (gov.step === "lite") {
    // Only reached with bailing on: nothing is left to drop, so the device either keeps up
    // with `bailFps` (or its own refresh cap) or the scene gives WebGL up for good.
    const bailFps =
      cadence === null ? gov.options.bailFps : Math.min(gov.options.bailFps, CAP_SLACK * cadence);
    gov.bailRun = fps < bailFps ? gov.bailRun + 1 : 0;
    if (gov.bailRun < gov.options.bailWindows) return null;
    gov.step = "bail";
    return "bail";
  }

  const minFps =
    cadence === null ? gov.options.minFps : Math.min(gov.options.minFps, CAP_SLACK * cadence);

  if (fps < minFps) {
    gov.fastRun = 0;
    gov.slowRun += 1;
    if (gov.slowRun < gov.options.slowWindows) return null;
    const next: GovernorStep = gov.step === "full" && !gov.options.skipDpr ? "dpr" : "lite";
    return change(gov, next, -1);
  }

  if (fps >= gov.options.recoverFps) {
    gov.slowRun = 0;
    if (gov.step !== "dpr" || gov.settled) return null;
    gov.fastRun += 1;
    if (gov.fastRun < gov.options.fastWindows) return null;
    return change(gov, "full", 1);
  }

  gov.slowRun = 0;
  gov.fastRun = 0;
  return null;
}
