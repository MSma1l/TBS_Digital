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

/**
 * Resolve any direction key (current slug or legacy one) to the CURRENT slug, so a caller
 * that holds an old key can still look a direction up in tables keyed by the new slug
 * (`lib/solutions.ts`). An unknown key is returned unchanged.
 */
export function directionSlug(slugOrLegacySlug: string): string {
  const dir = directions.find(
    (d) => d.slug === slugOrLegacySlug || d.legacySlug === slugOrLegacySlug,
  );
  return dir ? dir.slug : slugOrLegacySlug;
}

/**
 * The request flow lives in one place — the estimator section on the home page
 * (`components/sections/Estimator.tsx`, `#estimare`). A service page must send the visitor
 * *there*, carrying which service was being read, so the request is not a blank form.
 *
 * The service travels as a query parameter rather than as a `tbs:estimate` window event
 * (`lib/estimatorBridge.ts`): the event only survives inside one document, and this is a
 * cross-page navigation. The parameter is on the URL, so it also survives a share or a
 * refresh.
 */
export const SERVICE_QUERY_KEY = "serviciu";

/**
 * Which estimator project type a direction preselects.
 *
 * The estimator offers five types and the site offers five directions, but they are not
 * the same list and do not map one-to-one — so the pairing is written out rather than
 * guessed from names. Two directions deliberately share a target:
 *  · `asistenti-ia` lands on automation, the only type that covers bots/assistants;
 *  · `brand-ui` and `produs-digital` both land on the web type, the generic entry point —
 *    a brand/UI engagement has no separate line in the estimator today.
 * A slug missing from this table simply preselects nothing; it never throws.
 */
export const SERVICE_TO_ESTIMATOR_TYPE: Record<string, string> = {
  "produs-digital": "site",
  "e-commerce": "ecommerce",
  "automatizare-api": "automation",
  "asistenti-ia": "automation",
  "brand-ui": "site",
};

/** Link to the request flow with `slug` named on the URL, landing on the estimator. */
export function estimateHref(slugOrLegacySlug: string): string {
  const slug = directionSlug(slugOrLegacySlug);
  return `/?${SERVICE_QUERY_KEY}=${encodeURIComponent(slug)}#estimare`;
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
