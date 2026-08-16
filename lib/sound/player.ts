"use client";

/**
 * The only place in the site that makes a sound.
 *
 * Three rules are enforced here rather than at every call site, because a call site can be
 * forgotten and this file cannot:
 *
 *  1. **Nothing plays unless the visitor turned sound on.** Default is off (see `store.ts`).
 *  2. **Nothing plays before a real user gesture.** A separate, one-way latch — armed by the
 *     first pointer/key/touch event, or explicitly by the control that was just pressed.
 *     Even a returning visitor whose cookie says "on" is silent until they touch the page,
 *     so a component that calls `playSound()` on mount can't turn into autoplay.
 *  3. **The `AudioContext` is created lazily, at the first tone that is actually going to
 *     play** — never on import and never on mount. Browsers suspend a context created
 *     without a gesture anyway, so building one early only wastes an audio thread.
 *
 * Tones are synthesised with an oscillator instead of shipped as files: ~120ms of feedback
 * should not cost a network request, and there is no asset to cache, decode or get wrong.
 */

import { resolveTone, type SoundName } from "./sound";
import { isSoundEnabled } from "./store";

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;
let gestureSeen = false;
let listenersArmed = false;

/** `webkitAudioContext` is still the only one on older Safari. */
function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Whether this browser can make a sound at all. Read it in a handler, not in JSX. */
export function isAudioSupported(): boolean {
  return getAudioContextCtor() !== null;
}

/** Has the visitor interacted with the page yet? The autoplay latch, read-only. */
export function hasUserGesture(): boolean {
  return gestureSeen;
}

/**
 * Flip the latch. Called by the first real input event and — belt and braces — by the
 * control that is handling the very click that turned sound on, because a React `onClick`
 * can run before a listener added later in the same tick.
 */
export function markUserGesture() {
  gestureSeen = true;
}

/**
 * Start listening for the first interaction. Idempotent and cheap: one capture-phase,
 * passive, `once` listener per event type, and it never re-arms.
 */
export function armUserGesture() {
  if (listenersArmed || typeof document === "undefined") return;
  listenersArmed = true;
  const opts = { once: true, capture: true, passive: true } as const;
  document.addEventListener("pointerdown", markUserGesture, opts);
  document.addEventListener("keydown", markUserGesture, opts);
  document.addEventListener("touchstart", markUserGesture, opts);
}

/**
 * Build the `AudioContext`, but only once a gesture has happened — this is what keeps the
 * "lazy, at first interaction" promise literal rather than aspirational.
 */
function ensureContext(): AudioContext | null {
  if (!gestureSeen) return null;
  if (context) return context;
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

/**
 * Play one short tone. Returns whether anything was actually scheduled, so a caller (or a
 * test) can tell "played" from "correctly stayed silent".
 *
 * Every early return below is a silence guarantee, in the order they matter.
 */
export function playSound(
  name: SoundName = "tap",
  { reducedMotion = false }: { reducedMotion?: boolean } = {},
): boolean {
  // 1. off (the default) → no-op, and nothing is constructed.
  if (!isSoundEnabled()) return false;
  // 2. no interaction yet → no-op. This is the anti-autoplay guard.
  if (!hasUserGesture()) return false;

  const ctx = ensureContext();
  if (!ctx) return false;

  try {
    // A context can be suspended by the browser (tab was in the background, or it was
    // created a moment too early). Resuming from inside a gesture-driven call is allowed.
    if (ctx.state === "suspended") void ctx.resume?.();

    const tone = resolveTone(name, reducedMotion);
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(tone.freq, now);

    // A ramped envelope, not a raw start/stop: a square-edged gain change is heard as a
    // click, which is louder and more annoying than the tone it was meant to deliver.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + tone.duration + 0.02);
    // Release the nodes as soon as they are done; a page can emit hundreds of these.
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        /* already torn down */
      }
    };
    return true;
  } catch {
    // Audio is decoration. It must never be able to break the interaction it decorates.
    return false;
  }
}

/** Test-only: forget the context and the gesture latch between cases. */
export function resetAudioForTests() {
  try {
    context?.close?.();
  } catch {
    /* nothing to close */
  }
  context = null;
  gestureSeen = false;
  listenersArmed = false;
}
