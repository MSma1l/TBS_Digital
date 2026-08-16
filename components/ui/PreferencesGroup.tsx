"use client";

import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./PreferencesGroup.module.css";

/**
 * Global site preferences, as one group in the header.
 *
 * These are the controls that change **how the whole site is presented** rather than where
 * it navigates, so they live together and away from the nav links: the language switcher
 * and the light/dark toggle, in that order, sharing one height and one border language.
 *
 * `layout` only describes how the group fills the space it is placed in:
 *  - `"bar"`   — the nav bar: shrink-wrapped, sits between the links and the CTA. This is
 *                the only instance the site renders today, and it stays visible on every
 *                screen size, phones included — the controls are never hidden in a menu;
 *  - `"stack"` — a full-width row inside a column of rows (e.g. a drawer). Kept because it
 *                is the layout any future panel would need; nothing renders it right now.
 */
export function PreferencesGroup({
  layout = "bar",
}: {
  layout?: "bar" | "stack";
}) {
  return (
    <div
      className={`${styles.prefs} ${layout === "stack" ? styles.stack : styles.bar}`}
      role="group"
      /* Trilingual literal on purpose: the label names the group for a reader of *any* of
         the three languages, exactly like the switcher's own label right below. */
      aria-label="Preferințe / Настройки / Preferences"
    >
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}
