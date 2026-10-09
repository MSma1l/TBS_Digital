import type { MetadataRoute } from "next";
import { hreflangAlternates, localeUrl, LOCALES } from "@/lib/i18n/locales";
import { directionPaths } from "@/lib/directions";

/**
 * /sitemap.xml — every public URL in each shipped language, with its complete ro/ru/en +
 * x-default hreflang cluster. Listing every localized URL makes discovery explicit for
 * crawlers while the alternate links establish that the URLs are equivalents, not duplicates.
 *
 * The five direction pages (`/servicii/<slug>`) come from lib/directions.ts, so adding a
 * direction adds it to the sitemap automatically. Their slugs are identical in all three
 * languages — only the locale prefix differs — which is what makes one hreflang cluster
 * per direction possible (see docs/16-i18n-seo.md).
 * Ref: node_modules/next/dist/docs/.../03-file-conventions/01-metadata/sitemap.md
 */
const PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  ...directionPaths().map((path) => ({
    path,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  })),
  { path: "/portofoliu", changeFrequency: "monthly", priority: 0.7 },
  { path: "/confidentialitate", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.flatMap(({ path, changeFrequency, priority }) =>
    LOCALES.map((locale) => ({
      url: localeUrl(locale, path),
      // Omit lastModified rather than emit the generation time: a sitemap's lastmod must be
      // the page's real significant update, not a value that falsely says every page changed.
      changeFrequency,
      priority,
      alternates: { languages: hreflangAlternates(path) },
    })),
  );
}
