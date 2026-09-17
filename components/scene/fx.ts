/**
 * The interior scene's per-frame state: what the input listeners wrote (pointer / gyro tilt)
 * and what the world smooths every frame (scroll progress, tilt, the CTA boost and its light
 * wave). One plain mutable object — no React state per frame, no three.js, no DOM — created
 * once per canvas (`useState(createSceneFx)`) and only ever written by the `.ts` helpers.
 */

import { MAX_FRAME_STEP, damp } from "@/components/three/motion";
import type { SceneInput } from "@/lib/scene";

export type SceneFx = {
  /** Scene seconds, accumulated from clamped steps (a paused frameloop never jumps). */
  time: number;
  /** The first frame snaps every smoothed value to its target (a deep link never animates in). */
  primed: boolean;

  /* Written by input.ts: -1..1 targets, `tiltLive` once a real sample arrived. */
  tiltX: number;
  tiltY: number;
  tiltLive: boolean;

  /* Smoothed every frame by `stepSceneFx`. */
  tx: number;
  ty: number;
  /** `#top` leaving: 0 at rest, 1 once the hero is mostly gone. */
  heroExit: number;
  /** Core → services: 0 before, 1 once the services host is in place. */
  handoff: number;
  /** A hero CTA is hovered or focused, eased 0..1. */
  boost: number;
  /** The input's `waveSeq` already answered (-1 before the first frame). */
  waveSeq: number;
  /** A light wave's progress, 0 → 1; exactly 1 while no wave runs. */
  wave: number;
  /** `time` when the last wave started. */
  waveStart: number;
};

export function createSceneFx(): SceneFx {
  return {
    time: 0,
    primed: false,
    tiltX: 0,
    tiltY: 0,
    tiltLive: false,
    tx: 0,
    ty: 0,
    heroExit: 0,
    handoff: 0,
    boost: 0,
    waveSeq: -1,
    wave: 1,
    waveStart: -Infinity,
  };
}

/** Scroll progress eases in at this rate per second (about half a second to settle). */
export const SCROLL_LAMBDA = 8;
/** A light wave runs this long… */
export const WAVE_SECONDS = 1.1;
/** …and a new one never starts sooner than this after the last. */
export const WAVE_GAP_SECONDS = 0.9;
/** Closer than this to its target, a smoothed progress snaps onto it (so 1 is really reached). */
const SNAP = 0.002;

function settle(current: number, target: number, lambda: number, step: number): number {
  const next = damp(current, target, lambda, step);
  return Math.abs(next - target) < SNAP ? target : next;
}

/**
 * One frame: clamp the step, advance time, ease tilt / scroll / boost towards their targets
 * and run the light wave. `heroExit` and `handoff` are the raw progresses read from the
 * probe this frame. Returns the clamped step the rest of the frame should use.
 */
export function stepSceneFx(
  fx: SceneFx,
  dt: number,
  input: Readonly<SceneInput>,
  heroExit: number,
  handoff: number,
): number {
  const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MAX_FRAME_STEP);
  fx.time += step;
  const t = fx.time;

  if (!fx.primed) {
    fx.primed = true;
    fx.heroExit = heroExit;
    fx.handoff = handoff;
    fx.boost = input.boost;
    // A hover that happened before the canvas existed is not a new wave.
    fx.waveSeq = input.waveSeq;
  } else {
    fx.heroExit = settle(fx.heroExit, heroExit, SCROLL_LAMBDA, step);
    fx.handoff = settle(fx.handoff, handoff, SCROLL_LAMBDA, step);
    fx.boost = settle(fx.boost, input.boost, 6, step);
  }

  // Tilt: the pointer / gyro when there is one, otherwise a slow idle sway.
  const targetX = fx.tiltLive ? fx.tiltX : Math.sin(0.23 * t) * 0.35;
  const targetY = fx.tiltLive ? fx.tiltY : Math.sin(0.17 * t + 1) * 0.25;
  fx.tx = damp(fx.tx, targetX, 4, step);
  fx.ty = damp(fx.ty, targetY, 4, step);

  if (input.waveSeq !== fx.waveSeq) {
    fx.waveSeq = input.waveSeq;
    if (t - fx.waveStart >= WAVE_GAP_SECONDS) {
      fx.waveStart = t;
      fx.wave = 0;
    }
  }
  if (fx.wave < 1) fx.wave = Math.min(1, fx.wave + step / WAVE_SECONDS);

  return step;
}

/* ---- change-only callbacks ------------------------------------------------------------ */

/** The last value reported to a callback that must only hear about changes. */
export type ChangeSignal<T> = { last: T };

export function createChangeSignal<T>(initial: T): ChangeSignal<T> {
  return { last: initial };
}

/** `value` when it differs from the last one reported (and remembers it), otherwise null. */
export function reportChange<T>(signal: ChangeSignal<T>, value: T): T | null {
  if (Object.is(signal.last, value)) return null;
  signal.last = value;
  return value;
}
