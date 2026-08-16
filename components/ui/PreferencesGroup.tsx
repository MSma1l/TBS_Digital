"use client";

import { LanguageSwitcher } from "./LanguageSwitcher";
import styles from "./PreferencesGroup.module.css";

/**
 * Global site preferences, as one group in the header.
 *
 * These are the controls that change **how the whole site is presented** rather than where
 * it navigates, so they live together and away from the nav links. Today the group holds
 * the language switcher; the theme toggle joins it at the marked slot below — dropping it
 * in there gives it the right place in both the desktop bar and the mobile overlay without
 * rearranging either one.
 *
 * `layout` only describes how the group fills the space it is placed in:
 *  - `"bar"`   — desktop nav: shrink-wrapped, sits between the links and the CTA;
 *  - `"stack"` — mobile overlay: full-width row, like the other rows of the overlay.
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

      {/* THEME TOGGLE GOES HERE (built in a later step) — same group, right of the
          language control; no layout change needed in Navbar when it lands. */}
    </div>
  );
}
