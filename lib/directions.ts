import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The "choose a direction" buttons on the /02 block. Each opens its own page at
 * `/servicii/<slug>`. Labels come from the message catalog so the buttons stay trilingual.
 *
 * The slugs are Romanian and human-readable (the client asked for speaking URLs). They are
 * NOT translated per language: `/servicii/produs-digital`, `/ru/servicii/produs-digital`
 * and `/en/servicii/produs-digital` are the same path with the locale prefix in front
 * (see docs/16-i18n-seo.md — the `/ru` and `/en` prefixes are rewritten onto the same
 * underlying route), which keeps one route tree and one hreflang cluster per direction.
 *
 * `legacySlug` is the pre-rename slug that used to live under `/solutions/<slug>`. Those
 * URLs are indexed, so they must keep resolving — `next.config.ts` 301-redirects each of
 * them (bare, `/ru` and `/en`) onto the matching new path. Keep the two lists in sync;
 * `app/__tests__/servicii-routes.test.tsx` fails if they ever drift apart.
 */
export type Direction = { slug: string; legacySlug: string; labelKey: MessageKey };

/** The URL segment every direction page lives under. */
export const DIRECTIONS_BASE = "/servicii";

/** The old URL segment, kept only so the redirects and their test can name it. */
export const LEGACY_DIRECTIONS_BASE = "/solutions";

export const directions: Direction[] = [
  { slug: "produs-digital", legacySlug: "digital", labelKey: "dir.digital" },
  { slug: "e-commerce", legacySlug: "ecommerce", labelKey: "dir.ecommerce" },
  { slug: "automatizare-api", legacySlug: "automation", labelKey: "dir.automation" },
  { slug: "asistenti-ia", legacySlug: "ai", labelKey: "dir.ai" },
  { slug: "brand-ui", legacySlug: "brand", labelKey: "dir.brand" },
];

/**
 * Build the href for a direction page. Accepts either the current slug or the legacy one,
 * so a caller that still identifies a direction by its old key (the /02 section's own
 * `SERVICES` list does) links to the new URL without duplicating the mapping.
 * An unknown key is passed through unchanged rather than silently dropped.
 */
export function directionHref(slugOrLegacySlug: string): string {
  const dir = directions.find(
    (d) => d.slug === slugOrLegacySlug || d.legacySlug === slugOrLegacySlug,
  );
  return `${DIRECTIONS_BASE}/${dir ? dir.slug : slugOrLegacySlug}`;
}

/** Every direction page path, locale-independent — used by the sitemap. */
export function directionPaths(): string[] {
  return directions.map((d) => `${DIRECTIONS_BASE}/${d.slug}`);
}

/**
 * old path → new path, for the permanent redirects. Locale-independent: `next.config.ts`
 * expands each entry over the `""`, `/ru` and `/en` prefixes.
 */
export function legacyDirectionRedirects(): { from: string; to: string }[] {
  return directions.map((d) => ({
    from: `${LEGACY_DIRECTIONS_BASE}/${d.legacySlug}`,
    to: `${DIRECTIONS_BASE}/${d.slug}`,
  }));
}
