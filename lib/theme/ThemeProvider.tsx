"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_ATTRIBUTE,
  THEME_COLOR,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  toTheme,
  type Theme,
} from "./theme";

/**
 * The palette the site is painted in, plus the switcher.
 *
 * The theme is resolved on the server (root layout, from the `tbs_theme` cookie) and passed in,
 * and the same layout stamps it on `<html data-theme>` — so SSR, the painted page and the first
 * client render agree, with no script before hydration. Switching repaints at once (the
 * attribute is all globals.css keys off) and is persisted so the next request SSRs it.
 */
type ThemeContextValue = {
  /** The palette currently painted: what `<html data-theme>` says. */
  theme: Theme;
  setTheme: (next: Theme) => void;
  /** Flip between light and dark. */
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Same persistence model as the language: a 1-year, site-wide, Lax cookie. */
function persistTheme(theme: Theme) {
  try {
    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /* cookies unavailable — the in-memory choice still applies for this session */
  }
}

/**
 * The single place the DOM is touched. Everything else is state. The two viewport meta tags
 * follow too, so the browser chrome and the native controls match the page without a reload
 * (the server renders them from the cookie on the next request anyway).
 */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", theme);
}

export function ThemeProvider({
  initialTheme = DEFAULT_THEME,
  children,
}: {
  initialTheme?: Theme;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(() => toTheme(initialTheme));

  const setTheme = useCallback((next: Theme) => {
    const value = toTheme(next);
    setThemeState(value);
    persistTheme(value);
    // Applied in the handler, not in an effect, so a press repaints in the same tick — and the
    // 3D scene (lib/theme/theme.ts `observeTheme`) hears it from the attribute itself.
    applyTheme(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Fallback for a component rendered outside a provider (e.g. an isolated unit test) — the same
 * shape `LanguageProvider` uses: the default palette and a no-op switcher. The site always wraps
 * everything in a provider, so this branch never runs in production.
 */
const FALLBACK: ThemeContextValue = {
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK;
}
