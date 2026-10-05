import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, detectLocale, isLocale, type Locale } from "@/lib/i18n/locales";

/**
 * The CONTENT locale of the current request — what the visitor actually sees, so it drives
 * <html lang>, <title>, <meta description> and og:locale. On a crawlable /ru or /en URL the
 * `x-locale` header (set by proxy.ts from the path) wins; otherwise it's the cookie, then
 * Accept-Language. Matches how <html lang> and the LanguageProvider are resolved, so SSR and the
 * first paint agree. Server only (request headers); shared by app/layout.tsx and any page that
 * localizes its own metadata.
 */
export async function resolveContentLocale(): Promise<Locale> {
  const headerList = await headers();
  const urlLocale = headerList.get("x-locale");
  if (isLocale(urlLocale)) return urlLocale;
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return detectLocale(headerList.get("accept-language"));
}

/**
 * The URL's own locale — independent of any cookie — so canonical/og:url reflect the actual
 * address being served (`/` → ro, `/ru` → ru). Only an explicit path prefix sets x-locale.
 */
export async function resolveUrlLocale(): Promise<Locale> {
  const urlLocale = (await headers()).get("x-locale");
  return isLocale(urlLocale) ? urlLocale : DEFAULT_LOCALE;
}
