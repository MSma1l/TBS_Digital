# 03 — Architecture

## Principle

The landing page is one route composed of independent **section components**. Each section
is presentational: it receives editable content from the `siteContent` store (which is fed by
the API) and its fixed copy from the i18n catalogs. No section talks to the network itself,
so the data source can change without touching markup.

## Folder structure

```
/
├─ proxy.ts                # Next 16 Proxy (ex-Middleware): per-request CSP nonce
│                          #   + x-locale / x-pathname headers for the root layout
├─ next.config.ts          # standalone output, security headers, /ru + /en rewrites
├─ app/
│  ├─ layout.tsx           # Root: fonts, <html lang>, JSON-LD, generateMetadata (SEO),
│  │                       #   LanguageProvider + SiteContentProvider
│  ├─ globals.css          # Design tokens (CSS variables) + base styles + keyframes
│  ├─ robots.ts            # /robots.txt
│  ├─ sitemap.ts           # /sitemap.xml with hreflang alternates
│  ├─ opengraph-image.tsx  # Generated OG image
│  ├─ twitter-image.tsx    # Generated Twitter card image
│  ├─ (site)/              # Route group for the public site (no URL segment)
│  │  ├─ layout.tsx        # Chrome: ScrollProgress, StatusBar, Navbar, Footer,
│  │  │                    #   CookieConsent, AnalyticsPixel (consent-gated)
│  │  ├─ page.tsx          # Landing page — sections + SectionCTA between blocks
│  │  ├─ confidentialitate/ # Privacy policy (content.ts + LegalDoc)
│  │  └─ cookies/          # Cookie policy (content.ts, reuses LegalDoc)
│  └─ admin-tbs-digital/   # Admin panel route (outside the (site) chrome)
│     ├─ page.tsx          # Login gate + tabbed content editor
│     └─ admin.module.css
│
├─ components/
│  ├─ layout/              # StatusBar · Navbar · Footer
│  ├─ sections/
│  │  ├─ Hero.tsx + HeroEmblem.tsx   # /01 hero (emblem is the interactive client part)
│  │  ├─ Principles.tsx    # /02 principles grid + stats row
│  │  ├─ Services.tsx      # /03 service cards (click → estimator, see below)
│  │  ├─ Work.tsx          # /04 projects + galleries
│  │  ├─ Team.tsx          # /05 team + system-status panel
│  │  ├─ Partners.tsx      # /06 partner logos + "become a partner" panel
│  │  └─ Estimator.tsx     # /07 price estimator + contact form
│  └─ ui/                  # SectionLabel · Reveal · ScrollProgress · SectionCTA ·
│                          #   LanguageSwitcher · CookieConsent · AnalyticsPixel ·
│                          #   Lightbox · ServiceIcons · SocialIcons ·
│                          #   useAutoCarousel · usePlatform
│
├─ lib/
│  ├─ content.ts           # Typed default/seed content for every section
│  ├─ siteContent.tsx      # Store: API content + localStorage cache + provider/hook
│  ├─ api.ts               # Typed client for the backend (content, auth, contact, uploads)
│  ├─ validation.ts        # Frontend mirror of the backend validators
│  ├─ consent.ts           # Cookie-consent state (localStorage + cookie + event)
│  ├─ estimatorBridge.ts   # Service card → estimator pre-selection (window event)
│  └─ i18n/                # locales.ts · messages/{ro,ru,en}.ts · LanguageProvider ·
│                          #   content.tsx (LocalizedText, loc/useLoc) · format.tsx
│
├─ backend/                # FastAPI service (own Dockerfile, tests, storage seam)
├─ deploy/                 # nginx vhosts + production compose bits
├─ public/                 # Static assets (projects/, partners/, …)
└─ docs/                   # This documentation
```

Keep the **section-per-component** split and the **content boundary**: `content.ts` for
defaults, `siteContent` for anything the admin edits, `i18n` for anything the visitor reads.

## Routing

| Route | What |
|-------|------|
| `/` · `/ru` · `/en` | The landing page in Romanian / Russian / English. `/ru` and `/en` are rewrites onto the same route; the language comes from the `x-locale` header ([16](./16-i18n-seo.md)). |
| `/confidentialitate`, `/cookies` | Legal pages (also prefixable with `/ru`, `/en`). |
| `/admin-tbs-digital` | The login-gated admin panel. `noindex, nofollow`, outside the `(site)` chrome. |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/twitter-image` | Generated metadata routes. |

Every page renders **dynamically** — the root layout reads request headers for the CSP
nonce and locale (see `proxy.ts`).

## Data flow

```
backend (FastAPI + DB)
        │  GET /api/content                     admin panel ──► PUT /api/content
        ▼                                              ▲
lib/api.ts ──► lib/siteContent.tsx ◄── localStorage (offline cache only)
                       │
                       ▼
              section component ──► rendered UI
                       ▲
                       └── lib/i18n (catalog keys + loc() on localized fields)
```

Editable content flows through the `siteContent` store, so admin edits show live. Every
list — **services (+ prices), stats, team, projects, partners, contacts** — is
add/remove-able, so a saved list fully replaces its default (see `mergeSiteData`); don't
rely on merging by index/id.

Two cross-section channels exist deliberately, both as `window` `CustomEvent`s, because the
components are siblings with no shared state:

- `lib/estimatorBridge.ts` — a service card on `/03` pre-selects itself in the `/07`
  estimator and scrolls there.
- `lib/consent.ts` — the cookie banner tells the analytics pixel the choice changed.

See [10 — Backend](./10-backend.md), [07 — Conventions](./07-conventions.md) and
[16 — i18n & SEO](./16-i18n-seo.md).
