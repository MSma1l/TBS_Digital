import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Archivo, JetBrains_Mono, Manrope, Montserrat } from "next/font/google";
import "./globals.css";
import { SiteContentProvider } from "@/lib/siteContent";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { LOCALE_COOKIE, detectLocale, isLocale } from "@/lib/i18n/locales";

// Body (Manrope) and mono (JetBrains) load the Cyrillic subset so Russian renders in the
// brand fonts. Latin-ext covers Romanian diacritics (ă, î, ș, ț).
//
// Archivo — the display face — has NO Cyrillic, so it only loads Latin. For Russian
// headings we pair it with Montserrat (heavy, geometric, full Cyrillic): the display stack
// in globals.css lists Archivo first and Montserrat second, and the browser falls back
// per glyph — Latin letters stay Archivo, Cyrillic letters come from Montserrat.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800", "900"],
});

const montserrat = Montserrat({
  variable: "--font-display-cyr",
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TBS Digital — Software, aplicații și automatizări cu IA",
  description:
    "Digitalizăm afaceri prin software personalizat, aplicații mobile, automatizări cu IA, CRM, SaaS și platforme — de la strategie până la execuție.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading a request header opts the whole route tree into dynamic rendering so
  // the per-request CSP nonce minted in proxy.ts is applied to Next's scripts on
  // EVERY route — including /admin-tbs-digital, which sits outside the (site)
  // group. A nonce'd CSP over a statically prerendered page would serve HTML whose
  // scripts carry a stale/absent nonce and get blocked. See proxy.ts.
  const headerList = await headers();

  // Resolve the language server-side so `<html lang>` and the first paint already match
  // the visitor's choice: their saved cookie wins; a first-time visitor is detected from
  // Accept-Language. Passing it to the provider keeps SSR and hydration in lockstep.
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : detectLocale(headerList.get("accept-language"));

  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${montserrat.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
    >
      <body>
        <LanguageProvider initialLocale={locale}>
          <SiteContentProvider>{children}</SiteContentProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
