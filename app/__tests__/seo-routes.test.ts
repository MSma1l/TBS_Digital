import { describe, expect, it } from "vitest";
import robots from "../robots";
import sitemap from "../sitemap";
import { directionPaths } from "@/lib/directions";
import { hreflangAlternates, localeUrl, LOCALES, SITE_URL } from "@/lib/i18n/locales";

const STATIC_PATHS = ["/", "/portofoliu", "/confidentialitate", "/cookies"];
const PUBLIC_PATHS = ["/", ...directionPaths(), ...STATIC_PATHS.slice(1)];

describe("search-engine routes", () => {
  it("lists every public locale URL with a complete reciprocal hreflang cluster", () => {
    const entries = sitemap();

    expect(entries).toHaveLength(PUBLIC_PATHS.length * LOCALES.length);
    for (const path of PUBLIC_PATHS) {
      const cluster = entries.filter((entry) =>
        LOCALES.some((locale) => entry.url === localeUrl(locale, path)),
      );

      expect(cluster).toHaveLength(LOCALES.length);
      for (const locale of LOCALES) {
        const entry = cluster.find((candidate) => candidate.url === localeUrl(locale, path));
        expect(entry).toMatchObject({
          url: localeUrl(locale, path),
          alternates: { languages: hreflangAlternates(path) },
        });
        // A generated timestamp is not a meaningful sitemap lastmod value.
        expect(entry?.lastModified).toBeUndefined();
      }
    }
  });

  it("allows public pages and advertises the canonical XML sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin-tbs-digital", "/api/"],
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
      host: SITE_URL,
    });
  });
});
