"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
} from "react";
import { useLanguage, useT } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/lib/i18n/locales";
import styles from "./LanguageSwitcher.module.css";

/**
 * The language control: one small button showing the language in force ("RO ▾"), which
 * opens a short list of the three languages. The same shape at every width.
 *
 * ## Why a dropdown, everywhere
 *
 * This used to be two controls: a segmented RO | RU | EN pill above 400px and this button
 * below it, picked in JS from a `matchMedia` store, with a CSS stand-in for the one frame
 * between SSR and hydration. The owner asked for the simple dropdown on every screen, and
 * that removes the whole mechanism at once: the server renders exactly what the client
 * renders (no viewport guess, no swap, no stand-in), and the header row gives back the
 * ~70px the segmented track took — which is also why 320px fits with slack.
 *
 * **Switching itself is untouched.** A choice calls `setLocale()` from `LanguageProvider`,
 * the same single call the segmented control made: the provider re-renders the catalog,
 * writes the `tbs_locale` cookie and syncs `<html lang>`. Nothing here detects, stores or
 * routes a locale.
 *
 * ## Semantics
 *
 * A disclosure, not a `listbox`/`menu`: the trigger announces the popup through
 * `aria-haspopup` + `aria-expanded` + `aria-controls`, and the popup is a plain container of
 * real buttons — each labelled with the language's own name ("Русский", not "RU") and with
 * `aria-pressed` saying which language is on. The listbox/menu roles would force different
 * child roles and a different keyboard contract for what is three buttons.
 *
 * ## Keyboard
 *
 *  - **on the trigger** — `Enter`/`Space` (native) toggles the popup; `ArrowDown`/`ArrowUp`
 *    open it. Opening moves focus to the option for the language currently in force.
 *  - **inside the popup** — `ArrowDown`/`ArrowUp` move focus between the options and wrap,
 *    `Home`/`End` jump to the first/last, `Enter`/`Space` (native) pick one.
 *  - **`Escape`** closes and returns focus to the trigger. So does picking a language.
 *  - **`Tab`** is left entirely to the browser: the popup closes on focus leaving the
 *    control (`onBlur` below), so tabbing past it behaves like tabbing past one button.
 *
 * Arrow keys rather than Tab *between* the options: the three choices are one control, not
 * three stops in the page's tab order.
 *
 * ## Where it lives
 *
 * Mounted once, by `PreferencesGroup` in the header bar, at every width. The burger overlay
 * carries no copy of it: the overlay sits UNDER the header (`--z-nav-overlay` 115 <
 * `--z-header` 120), so this control and its popup stay on top and usable while the menu is
 * open — and an Escape that closes the popup is stopped here, so it does not also close the
 * menu behind it.
 */

/** Names the control for a reader of any of the three languages, so the group is one stable
 *  target for assistive tech and for the E2E locators whatever language is in force. */
const GROUP_LABEL = "Limbă / Язык / Language";

export function LanguageSwitcher() {
  const t = useT();
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = `lang-menu-${useId()}`;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /* Opening hands focus to the language that is in force, so the popup starts on the
     visitor's current answer rather than on an arbitrary first item. */
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const options = Array.from(list.querySelectorAll<HTMLButtonElement>("button"));
    const current = options.find((option) => option.dataset.locale === locale);
    (current ?? options[0])?.focus();
  }, [open, locale]);

  /* A press anywhere outside the control closes it. Bound to `pointerdown` in the capture
     phase so it lands before the click reaches whatever was pressed — closing on `click`
     would let a press on another header button be swallowed by the popup that was still up.
     Focus is handed back to the trigger only when it was inside the popup that just went
     away; when the press moved focus somewhere else on purpose, taking it back would be
     hostile. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      const focusWasInside = root.contains(document.activeElement);
      setOpen(false);
      if (focusWasInside) triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  /** Escape closes; the arrows drive the popup. See the keyboard contract above. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      // Don't let a page-level Escape handler (the mobile menu overlay) also react.
      event.stopPropagation();
      close(true);
      return;
    }

    const isDown = event.key === "ArrowDown";
    const isUp = event.key === "ArrowUp";

    if (!open) {
      // On the trigger: either arrow opens the popup (the effect above then takes focus).
      if (isDown || isUp) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (!isDown && !isUp && event.key !== "Home" && event.key !== "End") return;

    const list = listRef.current;
    if (!list) return;
    const options = Array.from(list.querySelectorAll<HTMLButtonElement>("button"));
    if (options.length === 0) return;

    event.preventDefault();
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : current === -1
            ? 0
            : (current + (isDown ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  };

  /* Focus leaving the control closes it — this is what makes Tab work without intercepting
     the key. `relatedTarget` is null when the browser cannot name where focus went (window
     blur, and some programmatic moves); that is not "the visitor tabbed away", so the popup
     stays and Escape / an outside press remain the way out. */
  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next) return;
    if (rootRef.current?.contains(next)) return;
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`mono ${styles.root}`}
      role="group"
      aria-label={GROUP_LABEL}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        /* Says what the button DOES and what is in force, in the visitor's language:
           "Schimbă limba: Română". The visible "RO" alone would only say the second half. */
        aria-label={`${t("nav.langChange")}: ${LOCALE_LABELS[locale]}`}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span aria-hidden="true">{LOCALE_SHORT[locale]}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div ref={listRef} id={listId} className={styles.menu}>
          {LOCALES.map((code) => {
            const active = code === locale;
            return (
              <button
                key={code}
                type="button"
                data-locale={code}
                className={`${styles.option} ${active ? styles.active : ""}`}
                aria-label={LOCALE_LABELS[code]}
                aria-pressed={active}
                onClick={() => {
                  setLocale(code);
                  close(true);
                }}
              >
                <span className={styles.short} aria-hidden="true">
                  {LOCALE_SHORT[code]}
                </span>
                <span className={styles.name} aria-hidden="true">
                  {LOCALE_LABELS[code]}
                </span>
                {/* The mark is decoration: `aria-pressed` is what tells a screen reader. It is
                    a second cue next to the tint, so "which one is on" never rests on colour. */}
                {active && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Both icons are drawn in `currentColor`, so they inherit their button's token colour
   without a second definition. */
function ChevronIcon() {
  return (
    <svg
      className={styles.chevron}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className={styles.check}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
