"use client";

import type { KeyboardEvent } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/lib/i18n/locales";
import styles from "./LanguageSwitcher.module.css";

/**
 * Compact RO / RU / EN segmented control. Switching is instant (no reload) and persisted.
 * Each option carries the language's own name as its accessible label, so a screen reader
 * announces "Русский", not "RU".
 *
 * Keyboard: every option is a real button, so Tab reaches each one and Enter/Space picks
 * it. On top of that the arrow keys (plus Home/End) move focus inside the group the way a
 * segmented control is expected to behave — focus only, never a silent language change.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  /** Arrow / Home / End move focus between the options; every other key is left alone. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0 && event.key !== "Home" && event.key !== "End") return;

    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1 || options.length === 0) return;

    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (current + step + options.length) % options.length;
    options[next].focus();
  };

  return (
    <div
      className={`mono ${styles.switcher}`}
      role="group"
      aria-label="Limbă / Язык / Language"
      onKeyDown={onKeyDown}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-label={LOCALE_LABELS[code]}
            aria-pressed={active}
            className={`${styles.option} ${active ? styles.active : ""}`}
          >
            {LOCALE_SHORT[code]}
          </button>
        );
      })}
    </div>
  );
}
