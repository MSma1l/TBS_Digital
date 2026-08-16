import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Archivo, JetBrains_Mono, Manrope, Montserrat } from "next/font/google";
import "./globals.css";
import { SiteContentProvider } from "@/lib/siteContent";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  OG_LOCALE,
  SITE_URL,
  detectLocale,
  hreflangAlternates,
  isLocale,
  localeUrl,
  type Locale,
} from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { SoundProvider, SOUND_COOKIE, toSoundChoice } from "@/lib/sound";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  isTheme,
  toThemeChoice,
} from "@/lib/theme/theme";

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

// The CONTENT locale — what the visitor actually sees, so it drives <html lang>, <title>,
// <meta description> and og:locale. On a crawlable /ru or /en URL the `x-locale` header
// (set by proxy.ts from the path) wins; otherwise it's the cookie, then Accept-Language.
// Matches how <html lang> and the LanguageProvider are resolved so SSR/first-paint agree.
async function resolveContentLocale(): Promise<Locale> {
  const headerList = await headers();
  const urlLocale = headerList.get("x-locale");
  if (isLocale(urlLocale)) return urlLocale;
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return detectLocale(headerList.get("accept-language"));
}

// The URL's own locale — independent of any cookie — so canonical/og:url reflect the actual
// address being served (`/` → ro, `/ru` → ru). Only an explicit path prefix sets x-locale.
async function resolveUrlLocale(): Promise<Locale> {
  const urlLocale = (await headers()).get("x-locale");
  return isLocale(urlLocale) ? urlLocale : DEFAULT_LOCALE;
}

// Locale-aware, per-URL SEO metadata. `metadataBase` lets the file-based OG/Twitter images
// (app/opengraph-image.tsx, app/twitter-image.tsx) resolve to absolute URLs. Canonical +
// hreflang are built from the locale-stripped path proxy.ts exposes as `x-pathname`, so
// every route — home and the legal pages — gets a correct self-canonical and full
// ro/ru/en + x-default alternates. `messages` is plain data, safe to import server-side.
export async function generateMetadata(): Promise<Metadata> {
  const contentLocale = await resolveContentLocale();
  const urlLocale = await resolveUrlLocale();
  const path = (await headers()).get("x-pathname") || "/";

  const title = messages[contentLocale]["meta.title"];
  const description = messages[contentLocale]["meta.description"];
  const canonical = localeUrl(urlLocale, path);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: "TBS Digital",
    alternates: {
      canonical,
      languages: hreflangAlternates(path),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: "website",
      siteName: "TBS Digital",
      title,
      description,
      url: canonical,
      locale: OG_LOCALE[contentLocale],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

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

  // Resolve the language server-side so `<html lang>` and the first paint already match the
  // served URL / the visitor's choice: an explicit /ru or /en URL (via the `x-locale` header
  // proxy.ts sets) wins, then the saved cookie, then Accept-Language. Passing it to the
  // provider keeps SSR and hydration in lockstep.
  const locale = await resolveContentLocale();

  // Same idea for the theme: the visitor's explicit choice lives in a cookie, so the server
  // can stamp `data-theme` into the HTML it sends. A visitor who has chosen therefore gets
  // the right palette in the very first byte — no script needed, and it works with
  // JavaScript off. Nothing is stamped for "no choice yet": globals.css then falls back to
  // `prefers-color-scheme`, and the inline script below pins the resolved value.
  const themeChoice = toThemeChoice((await cookies()).get(THEME_COOKIE)?.value);

  // Interface sound, read the same way. Nothing plays until the visitor touches the page —
  // seeding the choice here only saves the client a tick, it never arms audio.
  const soundChoice = toSoundChoice((await cookies()).get(SOUND_COOKIE)?.value);

  // Per-request CSP nonce (proxy.ts). Reused so the JSON-LD data block below satisfies the
  // strict, nonce-based script-src — see proxy.ts and app/(site)/layout.tsx.
  const nonce = headerList.get("x-nonce") ?? undefined;

  // Structured data: an Organization + WebSite graph so Google can build a rich entity for
  // "TBS Digital". Only real, verifiable facts (brand, site, contact email, country/city,
  // languages) — no invented socials, address or registration. `sameAs` is omitted rather
  // than faked. The description is the catalog's, in the served language.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "TBS Digital",
        url: SITE_URL,
        logo: `${SITE_URL}/opengraph-image`,
        image: `${SITE_URL}/opengraph-image`,
        email: "office@tbs.md",
        description: messages[locale]["meta.description"],
        areaServed: { "@type": "Country", name: "Moldova" },
        address: {
          "@type": "PostalAddress",
          addressCountry: "MD",
          addressLocality: "Chișinău",
          streetAddress: "A. Șușev 29",
        },
        knowsLanguage: ["ro", "ru", "en"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "TBS Digital",
        url: SITE_URL,
        inLanguage: ["ro", "ru", "en"],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  };

  return (
    <html
      lang={locale}
      data-theme={isTheme(themeChoice) ? themeChoice : undefined}
      className={`${archivo.variable} ${montserrat.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
      // The inline script below rewrites `data-theme` before React hydrates (that is the
      // whole point of it), so React must accept the DOM's value instead of treating the
      // difference as a hydration error and re-rendering the tree.
      // Ref: node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
      suppressHydrationWarning
    >
      <head>
        {/*
          Anti-FOUC: runs synchronously while the browser parses <head>, i.e. BEFORE the
          first paint and long before hydration, so a dark-mode visitor never sees a white
          flash. It reads the saved choice (cookie), falls back to prefers-color-scheme, and
          stamps `data-theme` on <html>. See lib/theme/theme.ts for the script itself.

          The nonce is not optional decoration: proxy.ts serves a strict `script-src` with
          no 'unsafe-inline', so without it the browser refuses to execute this tag and the
          flash is back. Same per-request nonce Next stamps on its own bundles and the
          JSON-LD block below.
        */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <script
          type="application/ld+json"
          nonce={nonce}
          // JSON-LD is a non-executable data block; JSON.stringify output contains no
          // HTML-significant sequences that could break out of the script element.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider initialChoice={themeChoice}>
          <SoundProvider initialChoice={soundChoice}>
            <LanguageProvider initialLocale={locale}>
              <SiteContentProvider>{children}</SiteContentProvider>
            </LanguageProvider>
          </SoundProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
