"use client";

/**
 * Where the on/off state lives.
 *
 * A module-level external store rather than React state inside a provider, for one reason:
 * `playSound()` has to be able to ask "is sound on?" from an event handler that may run
 * outside React (or before a re-render lands), and the answer must be the *current* one,
 * never a stale render snapshot. React reads the same store through
 * `useSyncExternalStore`, so the two views can't drift.
 *
 * The source of truth is the `tbs_sound` cookie — the same persistence model as the theme —
 * with an in-memory override so the toggle still works for the session in a browser where
 * cookies are blocked.
 */

import {
  DEFAULT_SOUND_CHOICE,
  SOUND_COOKIE,
  SOUND_COOKIE_MAX_AGE,
  readSoundChoice,
  type SoundChoice,
} from "./sound";

/** What `setSoundChoice` last stored. `null` = nothing set this session, read the cookie. */
let override: SoundChoice | null = null;

const listeners = new Set<() => void>();

/**
 * Persist exactly like the theme does: write the cookie for an explicit "on", and *drop* it
 * for "off" rather than storing a second value. "No cookie" and "off" then mean the same
 * thing, so a corrupted or truncated cookie can only ever fail towards silence.
 */
function persist(choice: SoundChoice) {
  if (typeof document === "undefined") return;
  try {
    document.cookie =
      choice === "on"
        ? `${SOUND_COOKIE}=on;path=/;max-age=${SOUND_COOKIE_MAX_AGE};samesite=lax`
        : `${SOUND_COOKIE}=;path=/;max-age=0;samesite=lax`;
  } catch {
    /* cookies unavailable — `override` still carries the choice for this session */
  }
}

/** The choice in force right now: this session's override, else the cookie, else "off". */
export function getSoundChoice(): SoundChoice {
  if (override !== null) return override;
  if (typeof document === "undefined") return DEFAULT_SOUND_CHOICE;
  return readSoundChoice(document.cookie);
}

/** The one question the rest of the app asks. */
export function isSoundEnabled(): boolean {
  return getSoundChoice() === "on";
}

/** Store a choice and tell every subscriber. Never called except from a user gesture. */
export function setSoundChoice(next: SoundChoice) {
  const changed = getSoundChoice() !== next;
  override = next;
  persist(next);
  if (changed) listeners.forEach((fn) => fn());
}

// --- the `useSyncExternalStore` triple ---------------------------------------------------

export function subscribeSound(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Boolean, so the snapshot is immutable by construction and React can compare it. */
export const getSoundSnapshot = (): boolean => isSoundEnabled();

/**
 * The server never has a cookie in hand here, and — more importantly — the *hydration*
 * render must be the silent one. Returning `false` means the markup React hydrates always
 * says "sound off"; if the cookie says otherwise, React re-renders right after hydration.
 */
export const getServerSoundSnapshot = (): boolean => false;

/**
 * Test-only: forget this session's override so a test can simulate a fresh document by
 * writing (or clearing) the cookie directly. Never called by application code.
 */
export function resetSoundStateForTests() {
  override = null;
  listeners.clear();
}
