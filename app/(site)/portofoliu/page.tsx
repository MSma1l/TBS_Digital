import type { Metadata } from "next";
import { Portfolio } from "@/components/sections/Portfolio";
import { OG_LOCALE, localeUrl, type Locale } from "@/lib/i18n/locales";
import { resolveContentLocale, resolveUrlLocale } from "@/lib/i18n/requestLocale";

const PATH = "/portofoliu";

const META: Record<Locale, { title: string; description: string }> = {
  ro: {
    title: "Portofoliu — TBS Digital",
    description:
      "Proiectele TBS Digital: platforme web, aplicații mobile, sisteme CRM și automatizări duse până la lansare.",
  },
  ru: {
    title: "Портфолио — TBS Digital",
    description:
      "Проекты TBS Digital: веб-платформы, мобильные приложения, CRM-системы и автоматизации, доведённые до запуска.",
  },
  en: {
    title: "Portfolio — TBS Digital",
    description:
      "TBS Digital's projects: web platforms, mobile apps, CRM systems and automations taken all the way to launch.",
  },
};

/**
 * The page's own title and description, in the language the visitor reads (the root layout's
 * rule: the URL's /ru or /en, then the cookie, then Accept-Language). Open Graph and Twitter are
 * restated whole, because a page's `openGraph` replaces the layout's rather than merging into it;
 * canonical and hreflang still come from the layout.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveContentLocale();
  const urlLocale = await resolveUrlLocale();
  const { title, description } = META[locale];
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "TBS Digital",
      title,
      description,
      url: localeUrl(urlLocale, PATH),
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * /portofoliu — the whole portfolio, one pixel per project (components/sections/Portfolio.tsx).
 * It took the list off the footer, which had grown a row per project: the footer's PORTOFOLIU
 * column now links here. Like `/servicii/<slug>`, the slug is not translated — `/ru/portofoliu`
 * and `/en/portofoliu` are this same route behind a language prefix (docs/16-i18n-seo.md).
 */
export default function PortfolioPage() {
  return (
    <main>
      <Portfolio />
    </main>
  );
}
