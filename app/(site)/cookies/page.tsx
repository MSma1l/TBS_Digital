import type { Metadata } from "next";
import { LegalDoc } from "../confidentialitate/LegalDoc";
import { cookieContent } from "./content";
import { OG_LOCALE, localeUrl } from "@/lib/i18n/locales";
import { resolveContentLocale, resolveUrlLocale } from "@/lib/i18n/requestLocale";

const PATH = "/cookies";

/** The policy itself is fully localized, so its search metadata must match the served URL. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveContentLocale();
  const urlLocale = await resolveUrlLocale();
  const { title, intro: description } = cookieContent[locale];
  const brandedTitle = `${title} — TBS Digital`;
  return {
    title: brandedTitle,
    description,
    openGraph: {
      type: "website",
      siteName: "TBS Digital",
      title: brandedTitle,
      description,
      url: localeUrl(urlLocale, PATH),
      locale: OG_LOCALE[locale],
    },
    twitter: { card: "summary_large_image", title: brandedTitle, description },
  };
}

export default function CookiesPage() {
  return <LegalDoc content={cookieContent} />;
}
