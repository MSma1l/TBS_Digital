import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/i18n/locales";

/**
 * /robots.txt — allow crawling everything except the admin panel and the JSON API, and
 * point crawlers at the sitemap. The admin route also carries an X-Robots-Tag noindex
 * header (next.config.ts); it is deliberately Disallow-ed here too but its exact path is
 * already public via that header, so listing it costs nothing.
 * Ref: node_modules/next/dist/docs/.../03-file-conventions/01-metadata/robots.md
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin-tbs-digital", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
