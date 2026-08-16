"use client";

import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSound } from "@/lib/sound";
import styles from "./SoundToggle.module.css";

/**
 * Interface sound on / off, in the header next to the theme toggle.
 *
 * Two states, one button, `aria-pressed` carrying the whole of it — the same shape as the
 * theme toggle, because they sit side by side and a visitor should not have to learn two
 * controls. The icon shows the state that is *in force* (a speaker, muted or not), and the
 * tooltip says what a press would do.
 *
 * It starts **off** and nothing on the site makes a sound until this is pressed. The press
 * that turns it on plays one short confirmation tone — the only sound the toggle itself is
 * responsible for, and it happens strictly inside the visitor's own gesture.
 *
 * Copy is a local `{ro, ru, en}` object resolved through `useLoc()` (project rule: no
 * hardcoded visitor-facing copy).
 */
const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  aria: L("Sunet interfață", "Звук интерфейса", "Interface sound"),
  turnOn: L("Pornește sunetul", "Включить звук", "Turn sound on"),
  turnOff: L("Oprește sunetul", "Выключить звук", "Turn sound off"),
};

export function SoundToggle() {
  const l = useLoc();
  const { enabled, toggle } = useSound();

  return (
    <button
      type="button"
      className={`${styles.toggle} ${enabled ? styles.on : ""}`}
      onClick={() => toggle()}
      aria-pressed={enabled}
      aria-label={l(COPY.aria)}
      title={l(enabled ? COPY.turnOff : COPY.turnOn)}
    >
      {enabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
    </button>
  );
}

/* Drawn in `currentColor`, so they inherit the button's token colour and stay correct in
   both palettes without a second definition. */

function SpeakerOnIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" />
      <path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.9 6.5a7.8 7.8 0 0 1 0 11" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4z" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
    </svg>
  );
}
