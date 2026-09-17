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
| `intro.status` | SYSTEM_SYNCHRONIZATION | SYSTEM_SYNCHRONIZATION | SYSTEM_SYNCHRONIZATION | HUD code, identical in every language — still a key, so the overlay carries no hardcoded copy |
| `intro.complete` | ACCESS_GRANTED | ACCESS_GRANTED | ACCESS_GRANTED | replaces `intro.status` at 100% |
| `intro.progressAria` | Se încarcă TBS Digital | Загрузка TBS Digital | Loading TBS Digital | the progress bar's accessible name |
| `intro.skip` | Sari peste intro | Пропустить интро | Skip intro | the skip button's accessible name — E2E finds the button by exactly this string |
| `intro.skipKey` | ESC | ESC | ESC | the key-cap beside it (`aria-hidden`, fine pointers only) |
| `header.sysTime` | SYS_TIME | SYS_TIME | SYS_TIME | the header clock's label |
| `nav.primaryAria` | Principal | Основная | Main | the desktop `<nav>`'s label |

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

The Ghid TBS guide (IT-OS Phase 4, 2026-09-17) adds **no catalog key**. Its copy is the narrower
form above: `GUIDE_COPY` in `components/hud/guide/copy.ts`, every string an `L(ro, ru, en)` object
rendered through `useLoc()`. The file has no directive and only type imports, so the E2E specs
import it and find the controls by exactly these strings (the lazy chunk ships the copy; nothing
reaches the page bundle).

| `GUIDE_COPY` field | RO | RU | EN | Where |
|--------------------|----|----|----|-------|
| `label` | Ghid TBS | Гид TBS | TBS Guide | the caption under the droid and the tip's kicker (both `aria-hidden`, upper-cased in CSS) |
| `aria` | Ghid TBS: deschide asistentul ghidat pentru cerere | Гид TBS: открыть пошагового ассистента заявки | TBS Guide: open the guided request assistant | the avatar button's accessible name — it starts with the visible caption (WCAG 2.5.3) |
| `open` | Deschide ghidul | Открыть гид | Open the guide | the tip's red action |
| `never` | Nu mai arăta în această vizită | Не показывать до конца визита | Don't show again this visit | the tip's opt-out (until reload) |
| `dismiss` | Închide sugestia | Закрыть подсказку | Close the tip | the ✕ button's accessible name |
| `prompts.servicii` | Nu ești sigur ce direcție ți se potrivește? Ghidul pune câteva întrebări scurte și trimite echipei rezumatul. | Не уверены, какое направление подходит? Гид задаст несколько коротких вопросов и отправит команде итог. | Not sure which direction fits you? The guide asks a few short questions and sends the team a summary. | the tip on `#servicii` |
| `prompts.lucrari` | Ai în minte un proiect asemănător? Descrie-l pas cu pas — îți răspundem în cel mult o zi lucrătoare. | Задумали похожий проект? Опишите его по шагам — ответим в течение одного рабочего дня. | Have a similar project in mind? Describe it step by step — we reply within one business day. | the tip on `#lucrari` |
| `prompts.service` | Vrei să vezi dacă direcția asta se potrivește proiectului tău? Ghidul te ajută să formulezi cererea. | Хотите понять, подходит ли это направление вашему проекту? Гид поможет сформулировать заявку. | Want to check whether this direction fits your project? The guide helps you put the request into words. | the tip on a service page's steps |

**Honest by construction.** It is a guide that asks a few questions — never "AI", never "online"
or a promised response time beyond the one business day the estimator's `SENT_COPY` already
promises. The ids it writes into a lead (`guide`, `guide-prompt`, `servicii` / `lucrari` /
`service`) are raw ids, not translated, like every origin row. The service page's topic is an
attribute (`data-guide-topic="service"` on the steps section), not text, so it changes nothing a
crawler or a screen reader sees; the guide itself is client-only, rendered after an interaction,
and never in the server HTML.

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

### The first-visit intro and SEO

A full-screen overlay on a first visit to `/` could look like an interstitial hiding the
content. It is built so that it does not:

- **The content is all there, server-rendered, under the overlay.** The `<h1>`, the lead, the
  CTAs and every section are in the HTML the server sends; the overlay is a sibling, not a
  wrapper, and nothing on the page is `aria-hidden` while it runs. `e2e/preloader.spec.ts`
  asserts that the `<h1>`'s computed opacity is **1** under the overlay.
- **Nothing hides the headline, ever.** No CSS rule targets the entrance markers, and the
  entrance animates the `<h1>` with transform and blur only — never opacity — so it paints at
  full opacity from the first frame.
- **It is short and skippable** (a ~2.4s minimum, 5s hard cap, then a ~1.3s burst; any key,
  click or wheel skips), plays once per session, never on a `#section` deep link, never under
  reduced motion, and never on any other page.
- **Crawlers and returning visitors** without JavaScript get it hidden by a `<noscript>` rule;
  with `tbs_intro=seen` the server does not render it at all.

**Measured** (headless Chromium, production build, during review): the LCP element is the
`<h1>` in every run — phone 260 ms on a first visit / 148 ms on a returning one, desktop
272 / 192 ms. CLS is 0 on a returning visit. A Lighthouse pass on real mobile hardware is still
to do.

### The interior 3D stage and SEO

The sticky WebGL scene behind Hero → Ticker → Directions (2026-09-17) is built to change nothing
a crawler or an assistive technology sees:

- **All content stays server-rendered HTML.** The stage is a wrapper; its canvas lives in an
  `aria-hidden` track with no layout height, so no section moves and no text is drawn into the
  canvas. The scene is requested only after the intro has gone and the page is idle (at least
  1.5s of visible time), so it never competes with the `<h1>` for LCP.
- **The static art is decoration in the HTML**: the hero's core and the first direction's
  drawing ship as inline, `aria-hidden` SVG without text; the other four drawings load in the
  browser only when a visitor switches direction, so they cost no HTML weight.
- **The direction pills are real links** to `/servicii/<slug>` in every language (crawlable, as
  the sitemap lists them); a touch visitor's first tap previews instead of navigating, which a
  crawler never does.
- **The entrance markers are never moved by the scroll effects** (the parallax targets wrappers),
  and the `<h1>` is never hidden.

---

## 4. Cookie consent & analytics

**Nothing non-essential loads before the visitor chooses.**

- `lib/consent.ts` — the single source of truth. Values: `"accepted"`, `"rejected"`,
  `null` (undecided). Stored in **both** `localStorage` and a cookie (`tbs_cookie_consent`,
  6 months), and a `CustomEvent` (`tbs:consent-change`) lets listeners react instantly.
- `components/ui/CookieConsent.tsx` — the GDPR / Law-133 banner, shown until a choice is
  made. Accessible: labelled dialog region, focus moved to it, **Escape = essential only**
  (the privacy-preserving default), reduced-motion honoured. Links to `/cookies`.
- **It waits for the first-visit intro.** Taking focus under a full-screen overlay would strand
  a keyboard user behind it, so on a first visit to `/` the banner shows only when the intro
  reports done (`tbs:intro-done`, via `onIntroDone()` in `lib/intro.ts`). Every other page — and
  a home page with no overlay — shows it exactly as before, in the same effect. A backstop of
  `WATCHDOG_MS + 1s`, counted in visible-tab time only, covers an intro that never reports back,
  but never fires under an overlay that is still live. The effect on consent: until the banner
  shows, nothing is decided, so the analytics pixel still does not load. After an intro that
  played, Escape is ignored for 700ms (a second skip press must not answer the banner), and a
  held key's repeats never answer it. Details: [05 — Page Sections](./05-page-sections.md#cookie-consent-banner).
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

The cookie policy lists **`tbs_intro`** as an essential cookie in all three languages — it only
remembers that the intro already played in this browser session, identifies nobody, and ends
when the browser closes (last updated 16 September 2026). It also lists **`tbs_gpu_probe`** as
essential **session storage**: whether this device can show the 3D animations, so the check is
not repeated on every page — yes/no values only (never the graphics card's name), identifies
nobody, gone when the tab closes. `localStorage.tbs_scene_3d` and `tbs_intro_3d` are QA
switches the site only reads and never writes, so they are not listed. `tbs_theme` and `tbs_sound` are still
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
  discovered in any language.
- **Adding a third-party script** means it needs the CSP nonce *and*, if it tracks anything,
  a consent gate.
