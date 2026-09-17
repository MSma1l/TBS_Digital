"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  isTheme,
  type Theme,
  type ThemeChoice,
} from "./theme";

/**
 * The theme the site is painted in, plus the switcher.
 *
 * `theme` is the RESOLVED palette — what is actually on screen. `choice` is what the visitor
 * picked, which may be `"system"` (nothing picked yet). Nothing picked resolves to
 * `DEFAULT_THEME` (dark); the OS preference is deliberately not consulted.
 *
 * The choice is resolved on the server (root layout, from the cookie) and passed in, so SSR
 * and the first client render agree — and since the default is a constant rather than a
 * media query, there is nothing left that only the client can know.
 */
type ThemeContextValue = {
  /** The palette currently painted: what `<html data-theme>` says. */
  theme: Theme;
  /** What the visitor chose — `"system"` while they haven't. */
  choice: ThemeChoice;
  /** Pick a palette explicitly, or drop the choice (back to the default) with `"system"`. */
  setTheme: (next: ThemeChoice) => void;
  /** Flip between light and dark. Always results in an explicit choice. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Same persistence model as the language: a 1-year, site-wide, Lax cookie. */
function persistChoice(choice: ThemeChoice) {
  try {
    document.cookie =
      choice === "system"
        ? // Back to the default — drop the cookie rather than store a third value, so the
          // server sees exactly what the visitor means: no choice.
          `${THEME_COOKIE}=;path=/;max-age=0;samesite=lax`
        : `${THEME_COOKIE}=${choice};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /* cookies unavailable — the in-memory choice still applies for this session */
  }
}

/** The single place the DOM is touched. Everything else is state. */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({
  initialChoice = "system",
  children,
}: {
  initialChoice?: ThemeChoice;
  children: ReactNode;
}) {
  const [choice, setChoiceState] = useState<ThemeChoice>(initialChoice);

  // Derived, never stored: an explicit choice IS the palette; otherwise the default applies.
  const theme: Theme = isTheme(choice) ? choice : DEFAULT_THEME;

  // Keep the document in sync with the resolved theme — the one external system this
  // provider owns. Idempotent: on first mount it rewrites the value the server and the
  // inline script have already painted, and it is what carries `setTheme("system")` through
  // to the page.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    persistChoice(next);
    // Applied here too, not only in the effect above, so a press repaints in the same tick
    // instead of waiting for the passive effect to flush.
    if (isTheme(next)) applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, choice, setTheme, toggleTheme }),
    [theme, choice, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Fallback for a component rendered outside a provider (e.g. an isolated unit test) — the
 * same shape `LanguageProvider` uses: the default palette and a no-op switcher. The site
 * always wraps everything in a provider, so this branch never runs in production; it just
 * keeps a stray render from crashing.
 */
const FALLBACK: ThemeContextValue = {
  theme: DEFAULT_THEME,
  choice: "system",
  setTheme: () => {},
  toggleTheme: () => {},
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}
