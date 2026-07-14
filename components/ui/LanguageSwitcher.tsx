"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/lib/i18n/locales";
import styles from "./LanguageSwitcher.module.css";

/**
 * Compact RO / RU / EN segmented control. Switching is instant (no reload) and persisted.
 * Each option carries the language's own name as its accessible label, so a screen reader
 * announces "Русский", not "RU".
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className={`mono ${styles.switcher}`} role="group" aria-label="Limbă / Язык / Language">
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
