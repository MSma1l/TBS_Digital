import type { MetadataRoute } from "next";
import { hreflangAlternates, localeUrl } from "@/lib/i18n/locales";

/**
 * /sitemap.xml — the three public pages, each listed at its Romanian (default) URL with
 * full ro/ru/en + x-default hreflang alternates, so Google discovers every language of
 * every page and treats them as one localized cluster.
 * Ref: node_modules/next/dist/docs/.../03-file-conventions/01-metadata/sitemap.md
 */
const PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/confidentialitate", changeFrequency: "yearly", priority: 0.4 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PATHS.map(({ path, changeFrequency, priority }) => ({
    url: localeUrl("ro", path),
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages: hreflangAlternates(path) },
  }));
}
