/**
 * Interface sound — public surface.
 *
 * Import from `@/lib/sound`; the split into `sound` (model) / `store` (state) /
 * `player` (Web Audio) / `SoundProvider` (React) is an implementation detail.
 */

export {
  DEFAULT_SOUND_CHOICE,
  MAX_TONE_DURATION,
  PREFERS_REDUCED_MOTION,
  SOUND_COOKIE,
  SOUND_COOKIE_MAX_AGE,
  TONES,
  isSoundChoice,
  readSoundChoice,
  resolveTone,
  toSoundChoice,
  type SoundChoice,
  type SoundName,
  type Tone,
} from "./sound";

export {
  getSoundChoice,
  isSoundEnabled,
  setSoundChoice,
  resetSoundStateForTests,
} from "./store";

export {
  armUserGesture,
  hasUserGesture,
  isAudioSupported,
  markUserGesture,
  playSound,
  resetAudioForTests,
} from "./player";

export { SoundProvider, useSound, type SoundApi } from "./SoundProvider";
