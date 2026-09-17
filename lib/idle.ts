/**
 * Run non-urgent work once the page has settled — the interior stage's GPU probe and its
 * three.js / GSAP chunk requests, which must never compete with the first paint, hydration
 * or the visitor's first taps.
 *
 * No DOM access at import time, so server modules can import it.
 */

import { visibleTimeout } from "@/lib/visibleTimeout";

/** The longest an idle slot is waited for once the minimum delay is over. */
export const IDLE_SLOT_TIMEOUT_MS = 1000;

/** Without `requestIdleCallback` (Safari): this long after `load`. */
export const LOAD_SETTLE_MS = 300;

/** Run `run` the next time the tab is visible. Returns the unsubscribe. */
function onceVisible(run: () => void): () => void {
  const onChange = () => {
    if (document.visibilityState === "hidden") return;
    document.removeEventListener("visibilitychange", onChange);
    run();
  };
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** Run `run` `LOAD_SETTLE_MS` after the window's `load` (at once if it already fired). */
function afterLoad(run: () => void): () => void {
  let timer: number | undefined;
  const settle = () => {
    timer = window.setTimeout(run, LOAD_SETTLE_MS);
  };
  if (document.readyState === "complete") {
    settle();
  } else {
    window.addEventListener("load", settle, { once: true });
  }
  return () => {
    window.removeEventListener("load", settle);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}

/**
 * Call `callback` once, after all of:
 *  1. `minDelayMs` of VISIBLE time (`visibleTimeout`) — a background tab uses none of it, so
 *     a page opened in a new tab starts its heavy work when someone looks at it;
 *  2. an idle slot — `requestIdleCallback` (at most `IDLE_SLOT_TIMEOUT_MS`), or, where the
 *     browser has none, `LOAD_SETTLE_MS` after `load`;
 *  3. a visible tab at that moment — hidden by then, it waits for the next `visibilitychange`.
 *
 * The delay is a real minimum on purpose: after the intro, the stage adds the time R3F takes
 * to release the intro's WebGL context, so two scenes never hold a context at once.
 *
 * Client only (a no-op on the server). Returns a cancel that is safe to call more than once,
 * at any step, and after the callback ran.
 */
export function afterIdle(minDelayMs: number, callback: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  let finished = false;
  let cancelStep: () => void = () => {};

  const fire = () => {
    if (finished) return;
    if (document.visibilityState === "hidden") {
      cancelStep = onceVisible(fire);
      return;
    }
    finished = true;
    cancelStep = () => {};
    callback();
  };

  const idle = () => {
    if (finished) return;
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => fire(), { timeout: IDLE_SLOT_TIMEOUT_MS });
      cancelStep = () => window.cancelIdleCallback(handle);
    } else {
      cancelStep = afterLoad(fire);
    }
  };

  cancelStep = visibleTimeout(Number.isFinite(minDelayMs) ? Math.max(0, minDelayMs) : 0, idle);

  return () => {
    if (finished) return;
    finished = true;
    cancelStep();
  };
}
