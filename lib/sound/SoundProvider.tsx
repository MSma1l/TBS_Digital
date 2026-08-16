"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { PREFERS_REDUCED_MOTION, type SoundChoice, type SoundName } from "./sound";
import {
  getServerSoundSnapshot,
  getSoundSnapshot,
  isSoundEnabled,
  setSoundChoice,
  subscribeSound,
} from "./store";
import { armUserGesture, isAudioSupported, markUserGesture, playSound } from "./player";

/**
 * Interface sound, as a hook other components can call.
 *
 * The provider is **optional**. State lives in a module-level store (`store.ts`), so
 * `useSound()` works anywhere in the tree, with or without a `SoundProvider` above it —
 * which is what lets the toggle live in the header without every consumer needing a
 * wrapper. Mounting the provider in the root layout adds one thing on top: the choice the
 * *server* read from the cookie, seeded before the first client render.
 */
export type SoundApi = {
  /** Is interface sound on right now? Safe to render — `false` during hydration. */
  enabled: boolean;
  /** Did the visitor ask for reduced motion? Tones are quieter and shorter when true. */
  reducedMotion: boolean;
  /**
   * Play one short tone. A **no-op** when sound is off, and a no-op before the visitor's
   * first interaction with the page — call it freely from an event handler.
   * Returns whether a tone was actually scheduled.
   */
  play: (name?: SoundName) => boolean;
  /** Turn sound on or off explicitly. Persisted to the `tbs_sound` cookie. */
  setEnabled: (next: boolean) => void;
  /** Flip it. Returns the new state, so a caller can react in the same tick. */
  toggle: () => boolean;
  /**
   * Whether this browser has a Web Audio implementation at all. Do **not** branch on it in
   * JSX — it is `false` on the server and would cause a hydration mismatch; read it inside
   * a handler or an effect.
   */
  isSupported: () => boolean;
};

const SoundContext = createContext<SoundApi | null>(null);

// --- reduced motion, as an external store ------------------------------------------------
// Same shape as the theme's `prefers-color-scheme` subscription: a value the server cannot
// know, that changes outside React, and that must not break hydration.

function motionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(PREFERS_REDUCED_MOTION);
}

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = motionQuery();
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

const getReducedMotion = () => motionQuery()?.matches ?? false;
const getServerReducedMotion = () => false;

/** The hook's actual implementation — shared by the provider and by standalone consumers. */
function useSoundApi(): SoundApi {
  const enabled = useSyncExternalStore(
    subscribeSound,
    getSoundSnapshot,
    getServerSoundSnapshot,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );

  // Arm the "has the visitor interacted?" latch. This only *listens*; it plays nothing and
  // constructs no AudioContext. Without it, the first press on a control would be silent
  // even with sound on, because the latch would still be closed.
  useEffect(() => {
    armUserGesture();
  }, []);

  const play = useCallback(
    (name: SoundName = "tap") => playSound(name, { reducedMotion }),
    [reducedMotion],
  );

  const setEnabled = useCallback((next: boolean) => {
    // Reaching this function *is* the gesture: it is only ever called from a click or a
    // key press on the toggle. Latching here means the confirmation tone below can play
    // immediately instead of being swallowed as "no interaction yet".
    markUserGesture();
    setSoundChoice(next ? "on" : "off");
  }, []);

  const toggle = useCallback(() => {
    // Read the store, not `enabled`: the store is current even if a re-render hasn't landed.
    const next = !isSoundEnabled();
    setEnabled(next);
    // Turning it ON says a word about itself — the one moment where a sound is the answer
    // to the question the visitor just asked. Turning it OFF stays silent, obviously.
    if (next) playSound("toggle", { reducedMotion });
    return next;
  }, [reducedMotion, setEnabled]);

  return useMemo(
    () => ({ enabled, reducedMotion, play, setEnabled, toggle, isSupported: isAudioSupported }),
    [enabled, reducedMotion, play, setEnabled, toggle],
  );
}

/**
 * Optional wrapper for the root layout.
 *
 * `initialChoice` is what the server read from the `tbs_sound` cookie. Seeding it costs
 * nothing and makes the choice available before the first client render; leaving the
 * provider out simply means the store reads the same cookie itself, one tick later.
 */
export function SoundProvider({
  initialChoice,
  children,
}: {
  initialChoice?: SoundChoice;
  children: ReactNode;
}) {
  // Seeding is an effect, not render work: it must never run during SSR, and it must never
  // be the thing that *enables* sound — it only replays a choice the visitor already made.
  useEffect(() => {
    if (initialChoice === "on") setSoundChoice("on");
  }, [initialChoice]);

  const value = useSoundApi();
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/**
 * The public hook.
 *
 * ```tsx
 * const { enabled, play, toggle } = useSound();
 * <button onClick={() => { play("tap"); doThing(); }}>…</button>
 * ```
 *
 * `play()` is a no-op when sound is off, so a call site never needs to check first.
 */
export function useSound(): SoundApi {
  const fromProvider = useContext(SoundContext);
  const own = useSoundApi();
  return fromProvider ?? own;
}
