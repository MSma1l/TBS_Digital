/**
 * The three languages the site ships in. Romanian is the source/fallback: every catalog
 * key is guaranteed to exist in `ro`, so a missing `ru`/`en` string degrades to Romanian
 * rather than to a blank.
 */
export const LOCALES = ["ro", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ro";

/** The cookie the chosen language is stored in (readable server-side to SSR the right one). */
export const LOCALE_COOKIE = "tbs_locale";

/** Human labels for the switcher — each in its own language, the way switchers should read. */
export const LOCALE_LABELS: Record<Locale, string> = {
  ro: "Română",
  ru: "Русский",
  en: "English",
};

/** Short codes for the compact switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
  ro: "RO",
  ru: "RU",
  en: "EN",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Pick the best locale from a browser Accept-Language header (or navigator.languages).
 * Falls back to Romanian when nothing matches. Used for a first-time visitor who has not
 * chosen a language yet.
 */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  // "ru-RU,ru;q=0.9,en;q=0.8" -> ["ru", "ru", "en"], in preference order.
  const tags = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());
  for (const tag of tags) {
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
