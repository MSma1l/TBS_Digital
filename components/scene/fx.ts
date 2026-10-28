/**
 * The interior scene's per-frame state: what the input listeners wrote (pointer / gyro tilt) and
 * what the world advances every frame (scene time, the eased tilt and the Work gate that draws
 * the helix in). One plain mutable object — no React state per frame, no three.js, no DOM —
 * created once per canvas (`useState(createSceneFx)`) and only ever written by the `.ts` helpers.
 */

import { MAX_FRAME_STEP, damp } from "@/components/three/motion";
import type { ScrollSpan } from "@/lib/scene";

/**
 * A timed gate: `armed` by the scroll (with hysteresis), `value` 0 → 1 over TIME — so whatever
 * it drives is never left half-way at a scroll position the visitor rests on.
 */
export type Gate = { value: number; armed: boolean };

/** Seconds for the Work helix to be synthesised (`form`) and to dissolve again (`unform`). */
export const WORK_SECONDS = { form: 1.2, unform: 0.5 } as const;

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

/** A span no scroll ever reaches: the gate of a helix that cannot be drawn stays shut. */
const NEVER: Readonly<ScrollSpan> = { start: Infinity, end: Infinity };

export type SceneFx = {
  /** Scene seconds, accumulated from clamped steps (a paused frameloop never jumps). */
  time: number;
  /** The first frame snaps the gate to its target (a deep link never animates in). */
  primed: boolean;

  /* Written by input.ts: -1..1 targets, `tiltLive` once a real sample arrived. */
  tiltX: number;
  tiltY: number;
  tiltLive: boolean;

  /* Smoothed every frame by `stepSceneFx`. */
  tx: number;
  ty: number;
  /** The Work gate: armed on the helix's arrival band, 1 once the helix has formed. */
  work: Gate;
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
    work: createGate(),
  };
}

/**
 * One frame: clamp the step, advance time, ease the tilt towards its target and run the Work
 * gate over `work` — the helix's arrival band (null while there is no helix to draw: the gate
 * stays shut, and an open one closes in time). The first frame snaps the gate, so a deep link
 * into Work finds the helix formed. Returns the clamped step the rest of the frame should use.
 */
export function stepSceneFx(fx: SceneFx, dt: number, scrollY: number, work: Readonly<ScrollSpan> | null = null): number {
  const step = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), MAX_FRAME_STEP);
  fx.time += step;
  const t = fx.time;
  const first = !fx.primed;
  fx.primed = true;

  const y = Number.isFinite(scrollY) ? scrollY : 0;
  stepGate(fx.work, y, work ?? NEVER, step, WORK_SECONDS, first);

  // Tilt: the pointer / gyro when there is one, otherwise a slow idle sway.
  const targetX = fx.tiltLive ? fx.tiltX : Math.sin(0.23 * t) * 0.35;
  const targetY = fx.tiltLive ? fx.tiltY : Math.sin(0.17 * t + 1) * 0.25;
  fx.tx = damp(fx.tx, targetX, 4, step);
  fx.ty = damp(fx.ty, targetY, 4, step);

  return step;
}
