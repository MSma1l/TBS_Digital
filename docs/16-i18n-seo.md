# 16 — Languages, SEO, Consent & Analytics

Everything that makes the site speak three languages, be indexable in each of them, and
track visitors only with their permission. All of it lives in `lib/i18n/`, `app/layout.tsx`,
`proxy.ts`, `next.config.ts`, and two `components/ui/` pieces.

---

## 1. Trilingual UI — RO / RU / EN

**Romanian is the source language and the fallback.** Every catalog key is guaranteed to
exist in `ro`; a missing `ru`/`en` string degrades to Romanian, never to a blank.

| Piece | File | Role |
|-------|------|------|
| Locale list, cookie name, URL prefixes | `lib/i18n/locales.ts` | `LOCALES = ["ro","ru","en"]`, `DEFAULT_LOCALE = "ro"`, `LOCALE_COOKIE = "tbs_locale"` |
| Message catalogs | `lib/i18n/messages/{ro,ru,en}.ts` (+ `messages.ts` index) | ~190 keys per language; `ro.ts` defines `MessageKey`, so RU/EN are type-checked against it |
| Provider + `t()` | `lib/i18n/LanguageProvider.tsx` | Holds the active locale, persists it, exposes `useT()` / `useLanguage()` |
| Localized content fields | `lib/i18n/content.tsx` | `LocalizedText = { ro, ru, en }`, `loc()`, `useLoc()`, `locFromCatalog()`, `locRo()` |
| Switcher | `components/ui/LanguageSwitcher.tsx` | RO/RU/EN segmented control; instant, no reload |

### How the locale is resolved

Server-side, in `app/layout.tsx`, in this priority order:

1. **The URL** — the `x-locale` header that `proxy.ts` derives from a `/ru` or `/en` prefix.
2. **The cookie** — `tbs_locale`, written by the switcher (1 year, `SameSite=Lax`).
3. **`Accept-Language`** — `detectLocale()` picks the first matching tag.
4. Otherwise Romanian.

The resolved locale is passed into `LanguageProvider` as `initialLocale`, so **SSR and the
first client paint agree** — no hydration mismatch and no flash of the wrong language. It
also drives `<html lang>`, `<title>`, the meta description and `og:locale`.

Switching languages is a pure client re-render from the catalog (no reload); the choice is
written to the cookie so the next request SSRs in the chosen language, and
`document.documentElement.lang` is updated for assistive tech.

### Fonts and Cyrillic

Archivo — the display face — has **no Cyrillic**. Russian headings would silently fall back
to a system font. The display stack therefore lists **Archivo first, Montserrat second**
(heavy, geometric, full Cyrillic) and the browser falls back *per glyph*: Latin stays
Archivo, Cyrillic comes from Montserrat. Body (Manrope) and mono (JetBrains Mono) load the
Cyrillic subset directly; `latin-ext` covers Romanian diacritics (ă, î, ș, ț).

### Two kinds of text

- **UI copy** (labels, buttons, headings that never change) → a **catalog key**, read with
  `const t = useT(); t("cta.collaborate")`.
- **Admin-editable content** (services, stats, team, projects, partners, contacts) → a
  **localized field**, `{ ro, ru, en }`, read with `const l = useLoc(); l(service.name)`.

A bare string is still accepted wherever a localized field is expected and is treated as
Romanian-only — that's how legacy payloads keep working. The admin edits all three
variants per field.

> **Rule:** never hardcode user-visible copy in a component. New copy is either a catalog
> key or a localized content field. See [07 — Conventions](./07-conventions.md).

---

## 2. Crawlable per-language URLs

A cookie-based switcher is good UX but invisible to a crawler, so each language also has a
real URL:

| Locale | URL | Prefix |
|--------|-----|--------|
| Romanian (default) | `https://tbs.md/` | none |
| Russian | `https://tbs.md/ru` | `/ru` |
| English | `https://tbs.md/en` | `/en` |

The mechanism, end to end:

1. **`next.config.ts` rewrites** `/ru`, `/en`, `/ru/:path*`, `/en/:path*` onto the same
   underlying routes. `afterFiles` order means real routes (e.g. `/confidentialitate`) win
   first, so only unmatched prefixed paths get rewritten.
2. The App Router root layout **cannot read the request path**, so `proxy.ts` splits the
   prefix off (`splitLocalePath`) and exposes it as request headers — the same channel the
   CSP nonce already travels on:
   - `x-locale` — set **only** for an explicit `/ru` or `/en`, so `/` keeps its
     cookie/Accept-Language behaviour untouched;
   - `x-pathname` — the prefix-stripped path, so every route can build a correct
     self-canonical.
3. `app/layout.tsx` reads both and renders the right language, canonical and alternates.

`splitLocalePath` matches the segment exactly — `/ru2` is **not** a Russian URL.

---

## 3. SEO surface

| Output | File | What it does |
|--------|------|--------------|
| `robots.txt` | `app/robots.ts` | Allows everything except `/admin-tbs-digital` and `/api/`; advertises the sitemap and host |
| `sitemap.xml` | `app/sitemap.ts` | The public pages — `/`, `/confidentialitate`, `/cookies` and the five direction pages under `/servicii/…` — each with full `ro`/`ru`/`en` + `x-default` hreflang alternates |
| Canonical + hreflang | `app/layout.tsx` → `generateMetadata()` | Self-canonical per served URL; `hreflangAlternates(path)` for every locale |
| Open Graph / Twitter | `app/opengraph-image.tsx`, `app/twitter-image.tsx` + metadata | Generated images; `og:locale` follows the served language |
| JSON-LD | `app/layout.tsx` (`<script type="application/ld+json">`) | `Organization` + `WebSite` graph — **only verifiable facts** (brand, URL, contact email, Chișinău/MD, languages). `sameAs` is omitted rather than invented |
| `noindex` on admin | `next.config.ts` headers | `X-Robots-Tag: noindex, nofollow` on `/admin-tbs-digital*` |

The JSON-LD block carries the per-request **CSP nonce** — the policy is nonce-based with
`strict-dynamic`, so an un-nonced data block would be blocked. See
[11 — Security](./11-security.md).

Because the nonce is minted per request, **every page renders dynamically** (`await
headers()` in the root layout). That is a deliberate trade: a nonce'd CSP over a statically
prerendered page would ship HTML whose scripts carry a stale nonce.

---

## 4. Cookie consent & analytics

**Nothing non-essential loads before the visitor chooses.**

- `lib/consent.ts` — the single source of truth. Values: `"accepted"`, `"rejected"`,
  `null` (undecided). Stored in **both** `localStorage` and a cookie (`tbs_cookie_consent`,
  6 months), and a `CustomEvent` (`tbs:consent-change`) lets listeners react instantly.
- `components/ui/CookieConsent.tsx` — the GDPR / Law-133 banner, shown until a choice is
  made. Accessible: labelled dialog region, focus moved to it, **Escape = essential only**
  (the privacy-preserving default), reduced-motion honoured. Links to `/cookies` and
  `/confidentialitate`.
- `components/ui/AnalyticsPixel.tsx` — the `statistica.tbs.md` pixel. Injected **only**
  after `consent === "accepted"`; before that no request to the tracker host fires at all.
  It reacts live to the banner, so accepting loads it without a reload.

Two non-obvious details, both load-bearing:

1. **The pixel is injected imperatively with `async = false`.** `t.js` resolves its site id
   through `document.currentScript`, which is `null` for an `async` script — it would then
   fall back to "the last `<script>` on the page", a Next.js framework chunk, read an empty
   `data-site`, and silently record nothing. This was a real bug (fixed 2026-07-15).
2. **It is mounted in `app/(site)/layout.tsx`, not the root layout** — so it never loads on
   `/admin-tbs-digital`. The tracker's click handler reads `el.value` for inputs, which
   would ship the admin password to `/px/collect`.

The pixel host is allow-listed in the CSP `connect-src`/`script-src` via `proxy.ts`.

---

## 5. Legal pages

`/confidentialitate` (privacy policy) and `/cookies`, both under `app/(site)/`, with their
copy in `content.ts` next to each page and shared styling in `LegalDoc.tsx` /
`LegalDoc.module.css`. They are listed in the sitemap with full hreflang alternates.

---

## 6. Direction pages — `/servicii/<slug>`

The five "choose a direction" pages live at speaking Romanian slugs, owned by
`lib/directions.ts`:

| Direction | URL | Old URL (301) |
|-----------|-----|---------------|
| Produs digital | `/servicii/produs-digital` | `/solutions/digital` |
| E-commerce | `/servicii/e-commerce` | `/solutions/ecommerce` |
| Automatizare & API | `/servicii/automatizare-api` | `/solutions/automation` |
| Asistenți IA & boți | `/servicii/asistenti-ia` | `/solutions/ai` |
| Brand & UI | `/servicii/brand-ui` | `/solutions/brand` |

**The slugs are not translated.** `/servicii/produs-digital`, `/ru/servicii/produs-digital`
and `/en/servicii/produs-digital` are the same path behind a locale prefix — one route tree,
one hreflang cluster per direction. Translating slugs would multiply the routes by three and
split each cluster.

**The old URLs were indexed, so they still resolve.** `next.config.ts` 301-redirects every
legacy path, expanded over all three prefixes (15 rules), and each lands on the *same*
prefix — a Russian visitor following an old link stays in Russian. 301 is used rather than
`permanent: true` (which emits 308) because these are GET-only content URLs and 301 is what
every crawler follows without special-casing.

Redirects are evaluated **before** the filesystem and before the `/ru/:path*` rewrites, so
`/ru/solutions/ai` is caught by the redirect and never reaches the rewrite.

The mapping is duplicated as a literal in `next.config.ts` — the config loader cannot resolve
the `@/` alias — so `app/__tests__/servicii-routes.test.tsx` asserts the two copies stay
identical, and fails if either drifts.

---

## Gotchas

- **Renaming a public URL** means a 301 from the old one in `next.config.ts`, for every
  locale prefix, *and* updating `app/sitemap.ts`. A renamed page with no redirect is a 404
  for everyone who already has the link.
- **Adding a UI string** means adding the key to `messages/ro.ts` (which types the catalog)
  and then to `ru.ts` and `en.ts`. Missing RU/EN compiles only if the key exists in all
  three records — keep them in sync.
- **Adding an editable content field** means it must be a `LocalizedText`, seeded via
  `locFromCatalog()` (translated) or `locRo()` (Romanian only), and rendered through
  `useLoc()`.
- **Adding a public page** means adding it to `app/sitemap.ts`, or it will not be
  discovered in any language.
- **Adding a third-party script** means it needs the CSP nonce *and*, if it tracks anything,
  a consent gate.
