# End-to-end tests (Playwright)

Browser tests that drive a **real production build** of the site. They cover what jsdom
cannot see: routing and redirects, cookie-driven server rendering (theme + language), layout
at real viewport widths, and keyboard/focus behaviour.

| | unit tests | these tests |
|---|---|---|
| runner | Vitest (`npm test`) | Playwright (`npm run test:e2e`) |
| files | `**/*.test.ts(x)` | `e2e/**/*.spec.ts` |
| environment | jsdom, one component | Chromium, the whole site |

**Keep the `.spec.ts` suffix.** `vitest.config.ts` collects `**/*.test.{ts,tsx}`, so a file
named `*.spec.ts` is invisible to Vitest and `npm test` stays a pure unit run. Naming an E2E
file `*.test.ts` would drag it into the Vitest run, where `@playwright/test` cannot work.

## Running

```bash
npm run test:e2e:install   # once per machine: downloads Chromium (~180 MB)
npm run test:e2e           # full suite
npm run test:e2e:smoke     # the @smoke subset — one test per area, for a quick check
npm run test:e2e:report    # open the HTML report of the last run
```

Playwright starts its own server (`playwright.config.ts` → `webServer`): `npm run build`,
then the **standalone** server on port 3210 — the same three steps the production Dockerfile
performs (build, copy `static/` and `public/` next to `server.js`, `node server.js`).
`next start` is deliberately not used: with `output: "standalone"` it cannot find the client
reference manifests for route-group pages, so `/servicii/<slug>` 500s and nothing hydrates.
Port 3210 leaves a `next dev` on 3000 and the backend on 8000 alone; `E2E_PORT` /
`E2E_BASE_URL` override it.

**No backend is needed.** The web server is started with `NEXT_PUBLIC_API_URL=""`, which
makes every API call same-origin; the site falls back to its bundled default content when
`/api/content` 404s, and the contact endpoint is stubbed in the browser.

**No real lead is ever created.** Every test that submits the contact form intercepts
`POST /api/contact` with `page.route()` and asserts on the payload; `forbidContactApi()`
fails the test if the endpoint is touched when it shouldn't be.

Run output (traces, screenshots, HTML report) goes to `e2e/.artifacts/`, which is gitignored.

## What is covered today

| file | covers |
|---|---|
| `routes.spec.ts` | `/` and the five `/servicii/<slug>` pages in ro/ru/en (200 + correct `<html lang>`); 301 redirects from every legacy `/solutions/<old-slug>` **keeping the locale prefix**; unknown slug is a 404; canonical + hreflang present |
| `theme.spec.ts` | the toggle flips the palette; the choice persists across a reload via `tbs_theme`; with that cookie the server stamps `<html data-theme>` **in the first byte** (asserted on the raw HTML, before any script runs); with no cookie nothing is stamped |
| `language.spec.ts` | the switcher changes the copy without a reload; the choice persists via `tbs_locale`; a seeded cookie is honoured server-side; all three languages are offered |
| `contact-form.spec.ts` | empty/invalid form → inline messages, `aria-invalid`, **no network request**; a valid form sends the expected payload once; a 429 leaves the form usable |
| `responsive.spec.ts` | 320 / 375 / 390 / 768 / 1280 × light + dark: no horizontal scroll, header stays one row inside the viewport, language + theme reachable **without opening the burger**, 44px touch targets |
| `keyboard.spec.ts` | Tab reaches the header controls, Enter/Space activate them, arrow keys move focus inside the language group, the focus ring is really drawn |
| `modal.spec.ts` | the service-page CTA opens the **real** request flow in a dialog; `role`/`aria-modal`/name from its own heading; focus enters, is trapped over 40 Tab and 40 Shift+Tab presses, and returns to the CTA; ✕ / Escape / a click on the scrim close it, a click (or a drag ending) inside does not; the page behind is frozen and restored to the same pixel; the service is preselected (`/servicii/e-commerce` → €6.000, `/servicii/produs-digital` → €3.000); at 390px it is a bottom sheet with no sideways scroll |
| `chat.spec.ts` | a freely typed answer becomes a bubble and earns the clarification round; the dialog terminates in a summary rendered on screen that contains what the visitor described; an 80-character unbroken word wraps instead of widening the page (desktop + 390px) |
| `dictation.spec.ts` | with `SpeechRecognition` removed the button is **not rendered at all**; with a fake recogniser injected it appears but constructs and starts nothing until clicked; a click shows the listening state; recognised text lands in an **editable** review box and reaches the field only after "add", carrying the visitor's edits; a refused microphone shows the fallback and leaves both the button and manual typing usable |
| `sound.spec.ts` | off by default (no `tbs_sound` cookie); **no `AudioContext` is constructed while the page loads** — the constructor is counted from before the app's first line; the first one appears strictly inside the click that turns sound on, and only one is ever built; the choice survives a reload and turning it off drops the cookie; a returning visitor with sound already ON still triggers nothing before a gesture |

### A11y gap this suite caught, now fixed

`responsive.spec.ts` → "each language option meets the 44px touch target" was written as a
deliberately failing test: the preferences strip was 44px tall, but `.switcher` centred its
RO/RU/EN buttons instead of stretching them, so each individual tap target measured ~24px —
WCAG 2.5.5 is per target, not per group. Fixed in
`components/ui/LanguageSwitcher.module.css` (stretch the track, `min-height: 44px` on the
option, under the 860px query). The test now runs for real and guards it.

### What the modal/chat/dictation/sound pass turned up

Two findings worth keeping, neither of them a bug in the app:

- **Chromium 151 ships `SpeechRecognition` and `webkitSpeechRecognition`.** A test written as
  "the browser has no speech API, so assert the button is absent" would pass for the wrong
  reason on an older build and fail on this one — on this Chromium the dictation button *is*
  rendered on a plain load. `dictation.spec.ts` therefore deletes the API in an
  `addInitScript` and asserts absence against that, and injects a fake recogniser (plus a
  fake `getUserMedia`) for the rest. No microphone, no permission prompt, no audio.
- **The cookie-consent banner is itself a `role="dialog"`**, so a bare
  `getByRole("dialog")` is ambiguous and the fixed banner can intercept clicks aimed at the
  page. `modalDialog()` matches `[aria-modal="true"]` only, and the new specs seed a
  `"rejected"` consent cookie in `beforeEach`.

`helpers.ts` holds the shared locators and assertions. Cookie names, locale prefixes,
direction slugs and the service-page CTA label are **imported from `lib/`** rather than
re-typed, so a rename in the app breaks these tests at compile time instead of quietly making
them assert on nothing. The four components that keep their `{ro,ru,en}` strings module-local
(`Modal`, `Estimator`, `DictationButton`, `SoundToggle`) have nothing to import, so their
Romanian copy is repeated once in `PRIVATE_COPY` — never inline in a spec.

## Not covered yet — deliberately

These surfaces were being built while this harness was written, so specs for them were left
out rather than shipped red. Add them here as they land:

- [ ] **The request form submitted from inside the modal** — `modal.spec.ts` proves the real
      flow is in there (the estimator's own submit button and email field), but the payload
      assertions still live in `contact-form.spec.ts`, against the inline form only.
- [ ] **The transcript inside the submitted `message`** — `chat.spec.ts` asserts the summary
      is rendered; that the same text is what `POST /api/contact` carries is still only
      covered by the unit tests.
- [ ] **Cookie-consent banner** (`components/ui/CookieConsent.tsx`) — accept/reject, the
      analytics pixel only loading after consent. Note that the banner is a non-modal
      `role="dialog"`; specs that would otherwise be blocked by it answer it up front with
      `seedConsent()`.
- [ ] **Legal pages** `/confidentialitate` and `/cookies` in all three languages.
- [ ] **Admin panel** `/admin-tbs-digital` — login, `noindex`, and unauthenticated access.
- [ ] **Cross-engine**: only a `chromium` project is configured; add `webkit` if iOS Safari
      behaviour ever needs guarding.
