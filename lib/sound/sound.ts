/**
 * The sound model — the names, the cookie and the tone table, in one place so the store,
 * the player, the toggle and the tests can never disagree about a value.
 *
 * Two states only, and the default is the quiet one:
 *  · `"on"`  — the visitor explicitly asked for interface sound;
 *  · `"off"` — everything else, including "never touched it". This is the default.
 *
 * Nothing in this file touches the DOM or the Web Audio API; it is pure data plus two
 * narrowing helpers, which is what makes the whole mechanism testable without a browser.
 */

/** What the visitor picked. There is no third "system" state: silence is the default. */
export type SoundChoice = "on" | "off";

/** The default, and the value every unknown/absent cookie resolves to. */
export const DEFAULT_SOUND_CHOICE: SoundChoice = "off";

/**
 * The cookie the choice is stored in.
 *
 * A cookie rather than localStorage, for the same reason the theme uses one (`tbs_theme`):
 * the root layout is rendered per request, so a server component can read the choice and
 * seed the provider with it — SSR and the first client render then agree, and the setting
 * survives a real reload rather than only a re-render.
 *
 * Unlike the theme there is no anti-flash script: a *sound* setting has nothing to paint,
 * and it must not do anything at all before the visitor interacts with the page.
 */
export const SOUND_COOKIE = "tbs_sound";

/** One year, like the theme and language cookies. */
export const SOUND_COOKIE_MAX_AGE = 31536000;

/** The media query that says the visitor asked for less movement — and less feedback. */
export const PREFERS_REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function isSoundChoice(value: unknown): value is SoundChoice {
  return value === "on" || value === "off";
}

/** Narrow a raw value to a choice; anything unknown means "off" — never "on" by accident. */
export function toSoundChoice(value: unknown): SoundChoice {
  return isSoundChoice(value) ? value : DEFAULT_SOUND_CHOICE;
}

/**
 * Read the choice out of a `document.cookie` string.
 *
 * Only the literal `on` turns sound on. A missing cookie, a malformed one, or any other
 * value resolves to `"off"` — the fail-safe direction for a setting that makes noise.
 */
export function readSoundChoice(cookieString: string | undefined | null): SoundChoice {
  if (!cookieString) return DEFAULT_SOUND_CHOICE;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${SOUND_COOKIE}=([^;]*)`));
  return toSoundChoice(match?.[1]);
}

/** The sounds the site can make. Deliberately few — this is feedback, not a soundtrack. */
export type SoundName = "tap" | "toggle" | "confirm" | "error";

/** A single tone: a frequency, a peak gain and a duration in seconds. */
export type Tone = { freq: number; gain: number; duration: number };

/**
 * The tone table.
 *
 * Every duration is at or under 120ms and every gain is far below 1 — the brief is "subtle
 * and short", so a sound must never outlast the gesture that caused it. The frequencies sit
 * in the range a laptop speaker actually reproduces (500–900Hz), so the tones stay audible
 * without being loud.
 */
export const TONES: Record<SoundName, Tone> = {
  tap: { freq: 660, gain: 0.05, duration: 0.06 },
  toggle: { freq: 760, gain: 0.06, duration: 0.09 },
  confirm: { freq: 880, gain: 0.06, duration: 0.12 },
  error: { freq: 320, gain: 0.06, duration: 0.12 },
};

/** The hard ceiling the tone table is held to (seconds). Pinned by a test. */
export const MAX_TONE_DURATION = 0.12;

/**
 * How much a tone is cut back when the visitor asked for reduced motion.
 *
 * `prefers-reduced-motion` is read here as what it is at heart — "give me less sensory
 * feedback" — so sound is never *started* by that state and, if the visitor explicitly
 * turned it on anyway, it plays quieter and shorter. Their explicit choice still wins;
 * we just take it as gently as possible.
 */
export const REDUCED_GAIN_FACTOR = 0.5;
export const REDUCED_DURATION_FACTOR = 0.6;

/** Resolve the tone actually played, given the visitor's motion preference. */
export function resolveTone(name: SoundName, reducedMotion: boolean): Tone {
  const tone = TONES[name];
  if (!reducedMotion) return tone;
  return {
    freq: tone.freq,
    gain: tone.gain * REDUCED_GAIN_FACTOR,
    duration: tone.duration * REDUCED_DURATION_FACTOR,
  };
}
