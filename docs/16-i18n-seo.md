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

A third, narrower form exists for fixed copy that lives with one component: an inline
trilingual literal, `const L = (ro, ru, en) => ({ ro, ru, en })`, rendered through `useLoc()`.
The hero, the ticker, Directions and Work use it; it is still RO/RU/EN, never a bare string.

### Keys added by the first-screen redesign (2026-09-16)

| Key | RO | RU | EN | Notes |
|-----|----|----|----|-------|
| `header.sysTime` | SYS_TIME | SYS_TIME | SYS_TIME | the header clock's label |
| `nav.primaryAria` | Principal | Основная | Main | the desktop `<nav>`'s label |

The `intro.*` keys (the first-visit overlay's readout and skip button) were removed on 2026-10-28
with the intro itself.

**`nav.primaryAria` names only *which* navigation.** Screen readers already announce the
landmark role, so "Navigație principală" would be read as "navigație principală, navigație".
The key was first written that way and shortened after review.

Removed: `hero.scrollHint` (it belonged to the deleted hero emblem).

### The interior redesign (2026-09-17) adds no keys

No catalog key was added or removed, and no visitor copy was written into a component:

- Directions and Work were rebuilt in Tailwind with their existing `L()` copy unchanged.
- Everything new that is visible but not text is **decorative and `aria-hidden`**: the 3D stage
  and its canvas, the static SVG art (no `<title>`, no text), the stat holograms, the corner
  brackets, the arrow box on a linked project card, and the **"↗" on the selected direction pill**
  — so a pill's accessible name stays exactly its label ("Produs digital", never "Produs digital
  north east arrow"; `directions-selector.test.tsx` pins it in every selection state).
- The "·" between tag chips (Work cards, the Directions case card) is the admin's own text,
  split for display and kept visible, so a card still reads — and is announced — as
  "CRM PRIVAT · FĂRĂ LINK".

### The HUD chrome adds no keys

The HUD's parts carry their own copy in the narrower form above — an `L(ro, ru, en)` object per
string in the part's own module, rendered through `useLoc()` — and add **no catalog key**. The
modules have no directive and only type imports, so the E2E specs import them and find the
controls by exactly these strings; the lazy chunk ships the copy and nothing reaches the page
bundle.

The Ghid TBS guide (IT-OS Phase 4) was the first of them. Its linger tip and that copy went on
2026-09-26; the corner assistant stays, with her own `GUIDE_COPY` and `GUIDE_FAQ` in
`components/hud/guide/copy.ts` (her answers' text also drives her mouth, per locale). What the
first entry pinned holds for every part: **honest by construction** — never "AI", never "online", and no promised response time
beyond the one business day the estimator's `SENT_COPY` already promises. Ids written into a lead
(a CTA `source`, a section topic) are raw ids, not translated, like every origin row.

**The fibre rail (Phase 5) adds no key either, and reuses four.** `components/hud/rail/copy.ts`
holds `RAIL_COPY` — the `<nav>`'s name **"Secțiunile paginii" / "Разделы страницы" / "Page
sections"** and the three home markers the menu has no word for: `top` ("Început" / "Начало" /
"Start"), `estimare` ("Cerere" / "Заявка" / "Request") and `contact` ("Contact" / "Контакт" /
"Contact"). The other four home markers read the **header's own catalog keys** through `useT()`
(`nav.services`, `nav.work`, `nav.about`, `nav.team`, critique R10.4), so the rail and the menu can
never name the same section differently. On any other page a marker's label is the section's own
first heading, already localized by the page — whitespace-collapsed and clipped to 60 characters
with an ellipsis, counted in code points so a clip never splits a character. The rail promises
nothing: every string is a section's name. As above, the file has no directive and only type
imports, so the E2E specs import `RAIL_COPY` and `RAIL_HOME_SECTIONS` instead of retyping the
words.

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
     self-canonical;
3. `app/layout.tsx` reads both and renders the right language, canonical and alternates.

`splitLocalePath` matches the segment exactly — `/ru2` is **not** a Russian URL.

---

## 3. SEO surface

| Output | File | What it does |
|--------|------|--------------|
| `robots.txt` | `app/robots.ts` | Allows everything except `/admin-tbs-digital` and `/api/`; advertises the sitemap and host |
| `sitemap.xml` | `app/sitemap.ts` | Every public URL — `/`, `/portofoliu`, `/confidentialitate`, `/cookies` and the five direction pages under `/servicii/…` — in **each** `ro`/`ru`/`en` version, each with its complete reciprocal cluster + `x-default` hreflang alternates. It omits `lastmod` until a truthful per-page/content timestamp exists. |
| Canonical + hreflang | `app/layout.tsx` → `generateMetadata()` | Self-canonical per served URL; `hreflangAlternates(path)` for every locale |
| A page's own title | the page's `generateMetadata()` | `/portofoliu` localizes its title and description with the layout's own locale rule (`lib/i18n/requestLocale.ts` — `resolveContentLocale`, shared with the layout). It restates `openGraph` and `twitter` whole: a page's `openGraph` REPLACES the layout's instead of merging, so a page that set only a title would ship Home's `og:title`. The service pages do the same since 2026-10-09 (`app/(site)/servicii/[slug]/page.tsx`): *"<the direction's menu name, `dir.*`> | TBS Digital"* (keyword first, brand last, since 2026-10-28; it was *"TBS Digital — <name>"*) and the direction's pitch text as the description (`lib/solutions.ts`), where they used to ship the raw slug and no description |
| Open Graph / Twitter | `app/opengraph-image.tsx`, `app/twitter-image.tsx` + metadata | Generated 1200×630 card. The shared root image uses the English headline “Test the idea before you invest in the whole product.” under the eyebrow “WEBSITES · APPS · MVPS · AUTOMATION” (2026-10-28); its copy remains a complete RO/RU/EN field. `og:locale` follows the served language. |
| Site icon | `app/icon.svg` | The TBS wordmark. App Router picks the file up by name — no `icons` entry in `generateMetadata()` — and emits `<link rel="icon" type="image/svg+xml" sizes="any">`. Its colours are a **copy** of the `globals.css` tokens (a static file cannot read `var()`), so a palette change has to be mirrored by hand |
| JSON-LD | `app/layout.tsx` + `app/(site)/servicii/[slug]/page.tsx` (`<script type="application/ld+json">`) | `Organization` + `WebSite` graph globally and one truthful `Service` entity on each direction page — only verifiable facts (brand, URL, contact email, Chișinău/MD, languages and the offer visible on that page). `sameAs`, prices, reviews and foreign locations are omitted rather than invented |
| `noindex` on admin | `next.config.ts` headers | `X-Robots-Tag: noindex, nofollow` on `/admin-tbs-digital*` |

The JSON-LD block carries the per-request **CSP nonce** — the policy is nonce-based with
`strict-dynamic`, so an un-nonced data block would be blocked. See
[11 — Security](./11-security.md).

Every JSON-LD serialization escapes `<` to `\\u003c`, following Next's current guidance. That
keeps a future catalog value from ever closing the data block early.

### Sitemap format and submission

The crawler-facing map is **`/sitemap.xml`**, not YAML: XML is the interoperable sitemap format
understood by Google and Bing, and its root URL covers the full site. `robots.txt` advertises it,
so crawlers can discover it without an account. After a deploy, a verified owner should also
submit `https://tbs.md/sitemap.xml` in Google Search Console and inspect its processing report.
That is a discovery signal, not a guarantee that a URL will be indexed or ranked.

Do not create an `sitemap.yaml`, `llms.txt`, country-by-country doorway pages or blocks of repeated
keywords. They do not improve eligibility for Google AI features. Search and AI visibility comes
from crawlable pages with precise titles, a real service offer, case studies and useful original
content. The English URLs are generic `en`, not artificial `en-GB` / `en-US` copies: UK and US
visitors receive the same English offer unless the business creates genuinely different regional
content.

### Search intent coverage

The page titles, descriptions and on-page service copy describe the offers visitors can actually
deliver. Since 2026-10-09, the home and service language also describes the operating model:
a focused MVP tests a stated hypothesis with real users, then the same team develops only the
next validated stage. “Fast” means a deliberately scoped first decision and the stated one-business-day
reply; copy must not invent a build deadline. The owner positions the MVP offer as a small, clear
starting budget: this wording is allowed only beside the deliberately controlled first scope and
the admin-controlled starting price, never as an unsubstantiated “cheap” or “cheapest” claim.
request. The target clusters are mapped to existing pages, rather than duplicated across new thin
pages:

| Intent | Existing page / evidence |
|---|---|
| Creare site, dezvoltare web, website design/development | Home + `/servicii/produs-digital` — site, platformă web, aplicație mobilă |
| Magazin online / e-commerce | `/servicii/e-commerce` — checkout, plăți, livrare digitală |
| Software personalizat, CRM, integrare API | Home + `/servicii/automatizare-api` — CRM, ERP, plăți și date conectate |
| SaaS, aplicație mobilă, produs digital | Home + `/servicii/produs-digital` and portfolio |
| Asistenți IA, boți și automatizare | `/servicii/asistenti-ia` — chat, calificare și bot Telegram |

"Ieftin" / "cheap" is not asserted as a ranking superlative. The authorized promise is a
small-budget MVP with a controlled scope; pricing remains the actual starting price shown by the
request flow. If the business adopts a separate low-budget offer, document its scope and price
first, then create one useful price page instead of repeating the claim across the site.

Because the nonce is minted per request, **every page renders dynamically** (`await
headers()` in the root layout). That is a deliberate trade: a nonce'd CSP over a statically
prerendered page would ship HTML whose scripts carry a stale nonce.

### Copy framework (2026-10-28)

Visitor copy follows the StoryBrand pattern ("Marketing Made Simple"), kept plain:

- **The visitor is the hero, TBS Digital the guide.** Lead with their problem (an untested idea,
  manual work, lost requests, an unclear offer), then what we build, then the result. Authority
  comes only from real projects, the real team and the stated reply time — never invented
  clients, figures, testimonials or guarantees.
- **One-liner = problem → solution → result.** It opens the home `meta.description` and each
  direction's `pitch.text` in `lib/solutions.ts`.
- **One direct CTA, said the same way:** *Cere ofertă* / *Оставить заявку* / *Get a quote*
  (header `nav.cta`, the hero's primary button, the Stakes close, footer `footer.cta`, the
  service page's action bar, `cta.collaborate`). The estimator's price
  is the transitional CTA; it keeps its own words.
- **The plan has three steps:** tell us the idea → we reply within one business day with
  questions and agree the first version and its price → we launch it and develop it from real
  feedback (the guide's "Ce se întâmplă după ce trimit?" answer, `components/hud/guide/copy.ts`, says it in
  these words).
- **Stakes, lightly:** "don't risk the whole budget on an untested idea" — never fear or urgency
  that is not true. Short sentences, no exclamation marks, no buzzwords; RU and EN are written
  natively, not translated word for word.

**The home page follows the 8-part website wireframe** of the book, in this order (the sections
and their copy are in [05 — Page Sections](./05-page-sections.md#the-wireframe-order-2026-10-28)):

1. **Header** — what we offer, how it makes life better, how to get it, and the direct CTA. The
   Hero: a headline and two buttons, *no subtitle and no line under the buttons* (the owner's
   rule).
2. **Stakes** — what not acting costs: lost customers, budget spent on an untested idea, hours of
   manual work. `Stakes.tsx`; named, never measured — no figures.
3. **Value proposition** — what the visitor gets: the services (Directions), *no lead paragraph*
   (the owner's rule).
4. **The guide** — empathy first („Înțelegem ce riști când pornești ceva nou.”, Principles), then
   authority from real things only: the projects (Work, WorkProof), the starting prices from the
   admin, the team, the partners.
5. **The plan** — three steps (Process): „Ne spui ideea” → „Primești planul și prețul” → „Lansezi
   și crești”.
6. **Explanatory paragraph** — the story retold in prose (`Explainer.tsx`): problem → guide →
   success, in two paragraphs. Its heading carries *Chișinău*; the paragraph that named the
   services (*creare site-uri*, *magazine online*, *MVP*…) was taken out on 2026-10-29 at the
   owner's request.
7. **Price choices** — the estimator (RequestSection): the starting prices, the transitional CTA.
8. **Junk drawer** — the footer: the CTA (its one-liner, `footer.brandText`, was taken out on
   2026-10-29 at the owner's request), navigation, partners, portfolio, legal.

The direct CTA appears in parts 1, 2, 3 (each direction), 4 (WorkProof, the price rows), 7 and 8.
Each section has one `h2`; a section's copy fits on one screen — no section grows a lead
paragraph it did not have.

**Titles and descriptions.** `meta.title` ≤ 60 characters, the main search phrase first and the
brand last — *"Creare site-uri, aplicații și MVP în Chișinău | TBS Digital"*, *"Создание сайтов,
приложений и MVP в Кишинёве | TBS Digital"*, *"Website, App & MVP Development in Moldova | TBS
Digital"*. `meta.description` is 140–160 characters: the one-liner plus the CTA. A service page's
description is its `pitch.text` (also 140–160, shown under the `<h1>` too, so it carries no CTA of
its own — the buttons are right under it); its title is its `dir.*` name + *" | TBS Digital"* (keyword first, brand last),
which now names the service as people search for it (*"Site-uri, aplicații și MVP"*, *"Magazin
online și e-commerce"*, *"Automatizare, CRM și API"*, *"Asistenți IA și boți"*, *"Brand și design
UI"*). Each phrase appears once per title and once or twice in the copy — no keyword lists.

### A preloaded document is the same document (2026-09-25)

The root layout builds the self-canonical and the hreflang set from `x-pathname`, which `proxy.ts`
sets. Until 2026-09-25 the proxy's matcher skipped any request carrying the legacy
`Purpose: prefetch` header — a **browser's** header, sent on the document it preloads when the
omnibox predicts a URL — so those documents were rendered with no `x-pathname`: no canonical, no
hreflang and no CSP. The matcher now skips only the Next router's own RSC prefetch
(`next-router-prefetch`), and a preloaded document is byte-for-byte the document a typed address
gets. See [11 — Security](./11-security.md#the-html-csp-2026-09-16).

### The first screen and SEO

- **Nothing hides the headline, ever.** The `<h1>`, the lead, the CTAs and every section are in
  the HTML the server sends, and the `<h1>` paints at full opacity from the first frame. The
  first-visit intro overlay that used to play over `/` was removed on 2026-10-28.

**Measured** (headless Chromium, production build, during review): the LCP element is the
`<h1>` in every run — phone 260 ms on a first visit / 148 ms on a returning one, desktop
272 / 192 ms. CLS is 0 on a returning visit. A Lighthouse pass on real mobile hardware is still
to do.

### The interior 3D stage and SEO

The sticky WebGL scene behind Hero → Ticker → Directions (2026-09-17) is built to change nothing
a crawler or an assistive technology sees:

- **All content stays server-rendered HTML.** The stage is a wrapper; its canvas lives in an
  `aria-hidden` track with no layout height, so no section moves and no text is drawn into the
  canvas. The scene is requested only once the page is idle, so it never competes with the
  `<h1>` for LCP.
- **The static art is decoration in the HTML**: the hero's core and the first direction's
  drawing ship as inline, `aria-hidden` SVG without text; the other four drawings load in the
  browser only when a visitor switches direction, so they cost no HTML weight.
- **The direction pills are real links** to `/servicii/<slug>` in every language (crawlable, as
  the sitemap lists them); a touch visitor's first tap previews instead of navigating, which a
  crawler never does.
- **The scroll effects never move the content itself** (the parallax targets wrappers), and the
  `<h1>` is never hidden.
- **The hero's numbers are drawn by the scene from 2026-09-25, and they are still HTML.** Where a
  panel is drawn (861px and up, on a `webgl` renderer) the metric card keeps its box, its text and
  its place in the accessibility tree and loses only its paint (`opacity: 0` and no glass); the
  panel's face is composed FROM that text, so there is one copy of the number, in the visitor's
  language, and the scene cannot drift from the DOM. It is not hidden text for a crawler's benefit:
  the same words are what a sighted visitor reads, and every reader that does not run WebGL — a
  crawler, a text browser, a `prefers-reduced-motion` or Save-Data visitor, a low-tier device, a
  narrow window, the `tbs_scene_3d=off` switch — gets the painted cards themselves. Nothing was
  added to the HTML and nothing was taken out of it.

---

## 4. Cookie consent & analytics

**Nothing non-essential loads before the visitor chooses.**

- `lib/consent.ts` — the single source of truth. Values: `"accepted"`, `"rejected"`,
  `null` (undecided). Stored in **both** `localStorage` and a cookie (`tbs_cookie_consent`,
  6 months), and a `CustomEvent` (`tbs:consent-change`) lets listeners react instantly.
- `components/ui/CookieConsent.tsx` — the GDPR / Law-133 banner, shown until a choice is
  made. Accessible: labelled dialog region, focus moved to it, **Escape = essential only**
  (the privacy-preserving default), reduced-motion honoured. Links to `/cookies`.
- **It shows at once** when no consent is stored, on every page (since 2026-10-28 there is no
  intro overlay to wait for); a held key's repeats never answer it. Details:
  [05 — Page Sections](./05-page-sections.md#cookie-consent-banner).
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

The cookie policy (last updated 16 September 2026) lists **`tbs_gpu_probe`** as
essential **session storage** in all three languages: whether this device can show the 3D animations, so the check is
not repeated on every page — yes/no values only (never the graphics card's name), identifies
nobody, gone when the tab closes. `localStorage.tbs_scene_3d` is a QA
switch the site only reads and never writes, so it is not listed. `tbs_theme` and `tbs_sound` are still
not listed there; that gap predates the redesign.

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
  discovered in every language. The sitemap test requires all three locale URLs and their
  reciprocal hreflang cluster.
- **Adding a third-party script** means it needs the CSP nonce *and*, if it tracks anything,
  a consent gate.
