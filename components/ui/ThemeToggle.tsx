"use client";

import { useT } from "@/lib/i18n/LanguageProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import styles from "./ThemeToggle.module.css";

/**
 * Light / dark switch, always visible in the header right after the language switcher.
 *
 * A single toggle button: its accessible name is constant ("Temă închisă") and `aria-pressed`
 * says whether dark mode is on, which is the whole state a visitor cares about. The site starts
 * light for everyone; dark only after a press (lib/theme/theme.ts).
 *
 * The icon shows the palette currently on screen (sun = light, moon = dark), matching what
 * `aria-pressed` announces; the tooltip says what a press would do.
 */
export function ThemeToggle() {
  const t = useT();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={t("theme.toggleAria")}
      title={t(dark ? "theme.switchToLight" : "theme.switchToDark")}
    >
      {dark ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

/* The icons are drawn in `currentColor`, so they inherit the button's token colour and stay
   correct in both palettes without a second definition. */

function SunIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </svg>
  );
}

function MoonIcon() {
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
      <path d="M20.8 13.4A8.6 8.6 0 1 1 10.6 3.2a6.7 6.7 0 0 0 10.2 10.2z" />
    </svg>
  );
}
