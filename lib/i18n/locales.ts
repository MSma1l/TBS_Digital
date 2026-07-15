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

// ---------------------------------------------------------------------------
// Multilingual-SEO helpers (additive — used by robots/sitemap/layout/proxy).
// ---------------------------------------------------------------------------

/** Canonical production origin. Every absolute SEO URL (metadata, sitemap, robots) uses it. */
export const SITE_URL = "https://tbs.md";

/**
 * URL path prefix per locale. Romanian (the default) lives at the site root; Russian and
 * English are crawlable sub-paths so each language is independently indexable and can be
 * hreflang-linked. `""` for ro means `https://tbs.md`, `/ru` means `https://tbs.md/ru`, etc.
 */
export const LOCALE_PREFIX: Record<Locale, string> = {
  ro: "",
  ru: "/ru",
  en: "/en",
};

/** OpenGraph `og:locale` codes (also fine as hreflang values). */
export const OG_LOCALE: Record<Locale, string> = {
  ro: "ro_RO",
  ru: "ru_RU",
  en: "en_US",
};

/**
 * Split a leading locale segment (`/ru`, `/en`) off a request pathname.
 *
 * Returns the locale the URL encodes (Romanian when there is no prefix) and the remaining
 * path with the prefix stripped (always starting with `/`). `/ru` → `{ ru, "/" }`,
 * `/ru/cookies` → `{ ru, "/cookies" }`, `/` → `{ ro, "/" }`. A path like `/ru2` does NOT
 * match (the segment must be exactly `ru`/`en`), so unrelated routes are never mis-parsed.
 */
export function splitLocalePath(pathname: string): { locale: Locale; rest: string } {
  const match = /^\/(ru|en)(\/.*)?$/.exec(pathname);
  if (match && isLocale(match[1])) {
    return { locale: match[1], rest: match[2] && match[2].length > 0 ? match[2] : "/" };
  }
  return { locale: DEFAULT_LOCALE, rest: pathname || "/" };
}

/**
 * Build an absolute URL for a page in a given locale. `path` is the locale-independent path
 * (e.g. `/`, `/cookies`). Romanian resolves to the bare path, ru/en get their prefix.
 */
export function localeUrl(locale: Locale, path: string): string {
  const suffix = path === "/" ? "" : path;
  return `${SITE_URL}${LOCALE_PREFIX[locale]}${suffix}` || SITE_URL;
}

/**
 * hreflang alternates for a page: every locale's URL plus `x-default` → Romanian. Shape is
 * accepted directly by both `Metadata.alternates.languages` and `sitemap` `alternates`.
 */
export function hreflangAlternates(path: string): Record<string, string> {
  return {
    ro: localeUrl("ro", path),
    ru: localeUrl("ru", path),
    en: localeUrl("en", path),
    "x-default": localeUrl("ro", path),
  };
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
