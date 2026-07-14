"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { messages, type MessageKey } from "./messages";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "./locales";

/**
 * Localized text (`t`) for the UI and the current `locale` + a `setLocale` switcher.
 *
 * The initial locale is resolved on the server (root layout) from the cookie / the
 * Accept-Language header and passed in, so SSR and the first client paint agree — no
 * hydration mismatch, no flash of the wrong language. Switching is instant (client
 * re-render from the catalog) and persisted to a cookie so the next request SSRs in the
 * chosen language and `<html lang>` stays correct.
 */
type LanguageContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function persistLocale(locale: Locale) {
  try {
    // 1 year, site-wide, Lax so a normal top-level navigation still sends it.
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
  } catch {
    /* cookies unavailable — the in-memory choice still applies for this session */
  }
}

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(
    isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE,
  );

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    persistLocale(next);
    // Keep the document language in sync for assistive tech and the browser, without a
    // reload — the catalog swap already re-rendered the visible copy.
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  const t = useCallback(
    (key: MessageKey): string => {
      // Romanian is the source catalog, so it always has the key; ru/en fall back to it.
      return messages[locale][key] ?? messages[DEFAULT_LOCALE][key] ?? key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/**
 * Fallback used when a component renders outside a provider (e.g. an isolated unit test):
 * Romanian text, a no-op switcher. The site always wraps everything in a provider, so in
 * production this branch is never taken — it just keeps a stray render from crashing.
 */
const FALLBACK: LanguageContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => messages[DEFAULT_LOCALE][key] ?? key,
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext) ?? FALLBACK;
}

/** Shorthand for components that only need the translate function. */
export function useT(): (key: MessageKey) => string {
  return useLanguage().t;
}
