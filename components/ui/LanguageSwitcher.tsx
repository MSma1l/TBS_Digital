"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
} from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT } from "@/lib/i18n/locales";
import styles from "./LanguageSwitcher.module.css";

/**
 * The language control, in two shapes — and only ever ONE of them in the DOM.
 *
 * ## Why there are two
 *
 * The header row is logo + language + theme + sound + burger, and WCAG 2.5.5 makes every one
 * of those a 44×44 target. At 320px the sum did not fit: the document measured 361px in a
 * 320px viewport and every page scrolled sideways. Shrinking the RO/RU/EN buttons fixes the
 * scroll by breaking the touch target that caused it, so the control itself changes instead:
 *
 *  - **above the compact breakpoint** — the segmented RO / RU / EN control, unchanged;
 *  - **at or below it** — a single 44×44 button showing the active language, which opens the
 *    other two in a popup. That returns ~70px to the row, and 320px fits with slack.
 *
 * ## One control, not two hidden by CSS
 *
 * The variant is chosen in JS and only the chosen one is rendered. Rendering both and hiding
 * one with `display: none` would put two language controls in the accessibility tree and two
 * matches in front of every `getByRole` in the test suite.
 *
 * ## Hydration
 *
 * The server cannot know the viewport width, so the width lives in a `useSyncExternalStore`
 * triple over `matchMedia` — the same shape `lib/theme/ThemeProvider.tsx` uses for
 * `prefers-color-scheme` and `lib/sound/store.ts` uses for the sound cookie. The **server
 * snapshot is `false` (segmented)**: it is what every viewport from 375px up gets, i.e. every
 * desktop, every tablet and the overwhelming majority of phones, so those render once and
 * never swap.
 *
 * The narrow phone is the case where the server guesses wrong, and it is handled in CSS
 * rather than by guessing the other way: below the breakpoint the segmented markup exists
 * **only** for the single frame between SSR and hydration (after hydration it is not
 * rendered at all), so the stylesheet is free to paint it as an exact stand-in for the
 * compact button — see the `≤ COMPACT_MAX_WIDTH` block in `LanguageSwitcher.module.css`,
 * which collapses it to the same 44×44 box showing the same active language. The frame that
 * would have overflowed is the same size and colour as the control that replaces it, so
 * there is no overflow and nothing visibly moves.
 */

/**
 * Where the control changes shape.
 *
 * Raised from 360 to 400 after measuring: between 361 and 399 the segmented control still
 * fits the header, but each RO/RU/EN button is only ~32.5px wide. WCAG 2.5.5 measures the
 * TARGET, and 32.5×44 fails it. Making them 44 wide needs a 397px header row, which does not
 * fit until the viewport is 398 — so the band 361–399 has no arrangement where the segmented
 * control is both on screen and tappable.
 *
 * 400 therefore covers every phone width the responsive suite checks (320, 375, 390) with the
 * one-button control, where every target is a full 44×44. An earlier note here defended 360
 * so 375 would keep the segmented shape; that was a constraint carried over from a
 * contradictory brief, not an accessibility requirement, and it loses to 2.5.5.
 *
 * **Keep in sync with the `max-width: 400px` block in `LanguageSwitcher.module.css`.**
 */
export const COMPACT_MAX_WIDTH = 400;
const COMPACT_QUERY = `(max-width: ${COMPACT_MAX_WIDTH}px)`;

/** Names the control for a reader of any of the three languages — same label in both shapes,
 *  so the group is one stable target for assistive tech and for the E2E locators. */
const GROUP_LABEL = "Limbă / Язык / Language";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* Local `{ro,ru,en}` copy resolved through `useLoc()` — the project rule for component-owned
   strings (same as `SoundToggle`/`Modal`); the message catalog is not touched. */
const COPY = {
  change: L("Schimbă limba", "Сменить язык", "Change language"),
};

// --- the viewport width, as an external store -------------------------------------------

function compactQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(COMPACT_QUERY);
}

function subscribeCompact(onChange: () => void): () => void {
  const query = compactQuery();
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}

const getCompact = () => compactQuery()?.matches ?? false;
/** See the hydration note above: the server renders the segmented control. */
const getServerCompact = () => false;

export function LanguageSwitcher() {
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  return compact ? <CompactSwitcher /> : <SegmentedSwitcher />;
}

/**
 * Compact RO / RU / EN segmented control. Switching is instant (no reload) and persisted.
 * Each option carries the language's own name as its accessible label, so a screen reader
 * announces "Русский", not "RU".
 *
 * Keyboard: every option is a real button, so Tab reaches each one and Enter/Space picks
 * it. On top of that the arrow keys (plus Home/End) move focus inside the group the way a
 * segmented control is expected to behave — focus only, never a silent language change.
 */
function SegmentedSwitcher() {
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
      aria-label={GROUP_LABEL}
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

/**
 * The narrow-phone shape: one 44×44 button carrying the active language, plus a popup with
 * the three choices.
 *
 * The popup is a plain container of the *same* real buttons the segmented control uses —
 * `aria-pressed` says which language is on, and each is labelled with the language's own
 * name — so a screen reader, and every locator in the test suite, sees exactly what it sees
 * on desktop. It is deliberately **not** `role="listbox"`/`role="menu"`: those roles would
 * force different child roles and a different keyboard contract for what is the same three
 * choices, and the trigger already announces the popup via `aria-haspopup`/`aria-expanded`.
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
 * Arrow keys rather than Tab *between* the options for the same reason the segmented control
 * uses them: the three options are one control, not three stops in the page's tab order.
 */
function CompactSwitcher() {
  const l = useLoc();
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
      className={`mono ${styles.compact}`}
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
        aria-label={`${l(COPY.change)}: ${LOCALE_LABELS[locale]}`}
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
                className={`${styles.menuOption} ${active ? styles.menuActive : ""}`}
                aria-label={LOCALE_LABELS[code]}
                aria-pressed={active}
                onClick={() => {
                  setLocale(code);
                  close(true);
                }}
              >
                <span className={styles.menuShort} aria-hidden="true">
                  {LOCALE_SHORT[code]}
                </span>
                <span className={styles.menuName} aria-hidden="true">
                  {LOCALE_LABELS[code]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Drawn in `currentColor`, like the theme and sound icons, so it inherits the button's token
   colour and stays correct in both palettes without a second definition. */
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
