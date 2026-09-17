/**
 * The interior scene's per-frame state: what the input listeners wrote (pointer / gyro tilt,
 * the cursor trail's segments) and what the world advances every frame (scroll progress, the
 * services entry gate, tilt, the CTA boost and its light wave). One plain mutable object — no
 * React state per frame, no three.js, no DOM — created once per canvas
 * (`useState(createSceneFx)`) and only ever written by the `.ts` helpers.
 */

import { MAX_FRAME_STEP, damp } from "@/components/three/motion";
import type { SceneEntry, SceneInput, ScrollSpan } from "@/lib/scene";
import { TRAIL, createTrailBuffer, type TrailBuffer } from "./trail";

/**
 * A timed gate: `armed` by the scroll (with hysteresis), `value` 0 → 1 over TIME — so whatever
 * it drives is never left half-way at a scroll position the visitor rests on.
 */
export type Gate = { value: number; armed: boolean };

/** Seconds for the services model to burst out and assemble (`form`) and to implode (`unform`). */
export const ENTRY_SECONDS = { form: 1.1, unform: 0.45 } as const;

export function createGate(): Gate {
  return { value: 0, armed: false };
}

/**
 * One frame of a gate. Hysteresis: it arms once `scrollY` reaches `span.end` and disarms only
 * above `span.start`, so a scroll resting between the two keeps what it has. `value` then runs
 * towards 1 (armed) or 0 at `rates` seconds for the whole way; `instant` snaps straight there.
 * (Not named `snap`: scene-contract.test.ts reads `snap:` in components/scene as ScrollTrigger's.)
 */
export function stepGate(
  g: Gate,
  scrollY: number,
  span: Readonly<ScrollSpan>,
  step: number,
  rates: { readonly form: number; readonly unform: number },
  instant: boolean,
): void {
  if (scrollY >= span.end) g.armed = true;
  else if (scrollY < span.start) g.armed = false;
  if (instant) {
    g.value = g.armed ? 1 : 0;
    return;
  }
  const next = g.value + (g.armed ? step / rates.form : -step / rates.unform);
  g.value = next <= 0 ? 0 : next >= 1 ? 1 : next;
}

/** What `data-entry` says for an entry gate's value: nothing formed, on its way, or formed. */
export function entryState(value: number): SceneEntry {
  return value <= 0 ? "idle" : value >= 1 ? "formed" : "burst";
}

/** A span no scroll ever reaches: the gate of an anchor that was never measured stays shut. */
const NEVER: Readonly<ScrollSpan> = { start: Infinity, end: Infinity };

export type SceneFx = {
  /** Scene seconds, accumulated from clamped steps (a paused frameloop never jumps). */
  time: number;
  /** The first frame snaps every smoothed value to its target (a deep link never animates in). */
  primed: boolean;

  /* Written by input.ts: -1..1 targets, `tiltLive` once a real sample arrived. */
  tiltX: number;
  tiltY: number;
  tiltLive: boolean;
  /** Written by input.ts (fine pointer), drawn by three/trail.ts: the cursor circuit trail. */
  trail: TrailBuffer;

  /* Smoothed every frame by `stepSceneFx`. */
  tx: number;
  ty: number;
  /** `#top` leaving: 0 at rest, 1 once the hero is mostly gone. */
  heroExit: number;
  /** The services entrance: armed past the services anchor, 1 once the model has assembled. */
  entry: Gate;
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
    // The trail's clock: event timestamps and `performance.now()` share the page's time origin.
    trail: createTrailBuffer(TRAIL.cap, typeof performance !== "undefined" ? performance.now() / 1000 : 0),
    tx: 0,
    ty: 0,
    heroExit: 0,
    entry: createGate(),
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
 * One frame: clamp the step, advance time, ease tilt / scroll / boost towards their targets,
 * run the services entry gate and the light wave. `heroExit` is the raw progress read from the
 * probe this frame; `entry` the entry span (null while the services anchor is not measured:
 * the gate stays shut). Returns the clamped step the rest of the frame should use.
 *
 * The first frame snaps everything, the entry gate included: a deep link into the services
 * finds the model formed, it never bursts in. Flung back up to the hero (its exit not even
 * started) the disarmed gate snaps to idle — the services host is far below the canvas there.
 */
export function stepSceneFx(
  fx: SceneFx,
  dt: number,
  input: Readonly<SceneInput>,
  heroExit: number,
  scrollY: number,
  entry: Readonly<ScrollSpan> | null,
): number {
  const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MAX_FRAME_STEP);
  fx.time += step;
  const t = fx.time;
  const first = !fx.primed;

  if (first) {
    fx.primed = true;
    fx.heroExit = heroExit;
    fx.boost = input.boost;
    // A hover that happened before the canvas existed is not a new wave.
    fx.waveSeq = input.waveSeq;
  } else {
    fx.heroExit = settle(fx.heroExit, heroExit, SCROLL_LAMBDA, step);
    fx.boost = settle(fx.boost, input.boost, 6, step);
  }

  stepGate(fx.entry, Number.isFinite(scrollY) ? scrollY : 0, entry ?? NEVER, step, ENTRY_SECONDS, first);
  if (!fx.entry.armed && heroExit <= 0) fx.entry.value = 0;

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
