# End-to-end tests (Playwright)

Browser tests that drive a **real production build** of the site. They cover what jsdom
cannot see: routing and redirects, cookie-driven server rendering (theme + language), layout
at real viewport widths, keyboard/focus behaviour, and the home page's interior (the static SVG
art, and Work's lazy 3D helix: nothing heavy on entry, the static-grid path, the forced WebGL
canvas).

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

On this project the suite runs **in Docker**, in the Playwright image with its own
`node_modules` / `.next` volumes (`mcr.microsoft.com/playwright:v1.62.1-noble`, `--ipc=host`,
`--workers=1 --retries=0`); the exact command is in
[docs/14 — Testing](../docs/14-testing.md#end-to-end--playwright). The scripts above are what
runs inside it.

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
| `theme.spec.ts` | the toggle flips the palette; the choice persists across a reload via `tbs_theme`; the server stamps `<html data-theme>` **in the first byte** (asserted on the raw HTML, before any script runs): `dark`/`light` from the cookie, and **`dark` with no cookie or a junk value** — on `/` and on a service page; the dark default really paints a dark surface; the stamp, the painted surface and "follows the visitor onto another page" are asserted with **`light`**, the non-default, because a dark cookie would pass on the default alone |
| `interior.spec.ts` | the **first screen and interior on the default path** (since 2026-10-28 only Work has a WebGL stage, and it requests nothing until Work is near). E1 the hero core art and one service drawing on screen, **no `<canvas>`, no WebGL context, three.js and GSAP never evaluated** (also past an idle slot), the header, headline, stats group and ticker carry no inline style, Work's cards carry only `--p1` / `--p2` inline, the stage wraps Work only (`#lucrari` inside `[data-scene-stage]`, `#top` outside) and is `data-renderer="pending"` at the top, no `[data-loading]`, no CSP violation, no console error (`@smoke`); E2/E3 no decorative dot in the header, main or footer at 1280 and 390px; E4 ←/→ walk the pills with `aria-current` and `data-shape` together, focus never enters the art; E6 hover switches the shape, a click opens the page; E7 a stat card tilts under the mouse and settles, the stats group is never styled; E8 a project card tilts and keeps `--p1/--p2`, its screenshot drifts on the view timeline; E8b at 861px the full-row last card keeps its screenshot at a normal card's size; E9/E9b/E10/E11/E11b on a 390px touch screen: the first tap on another pill selects, the second opens, the already-selected pill opens on the first tap, "Detalii" opens at once, cards never tilt, the services screen comes before the heading; E13 the art never runs an infinite animation (the CSS boost wave and a switch included); E14 the HTML carries one service drawing and the browser draws the others on a switch; E16 a multi-part tag keeps its visible "·" on the chips' plate, no chip blurs; E12 reduced motion: no tilt, no parallax, no context, nothing heavy, the pills still switch |
| `work-helix.spec.ts` | **Work's DNA helix**, the only WebGL on the site. H1 (`@smoke`) nothing heavy on entry: at the top `data-renderer` stays `pending`, three.js and GSAP are not evaluated and no context exists; scrolled to `#lucrari`, the default SwiftShader path settles on `fallback` / `software` with no canvas and no context (the seeded session answer is used). H2 (`@webgl`, `forceScene3d` + `FORCED_GPU_PROBE`, 1280×800, 150s) at the top still `pending` and nothing loaded; near Work the stage reaches `webgl`, three.js and GSAP load, exactly one canvas is drawn, inside the stage's layer, `#top` stays outside the stage, and the stage reaches `data-helix="spiral"` |
| `hud-shell.spec.ts` | the HUD shell of a returning visit: the header clock shows **Chișinău** time (UTC+3 summer, UTC+2 winter) in a New York browser; nothing moves or keeps an inline style after hydration; the cookie banner is focused, names its choices, Escape means essential only, 44px buttons, and at 390/320px it is an **opaque panel with no backdrop blur**; the neon CTA focus ring is `--txt`, 2px outside the button, in both themes; the ticker is one decorative strip; the desktop header row fits one line without sideways scroll at 861, 1024 and 1180px in every locale; at 320 and 390px the burger menu keeps the header at the top and the scroll position (also with classic scrollbars, in a browser of its own; the round trip is `burgerRoundTrip` in `helpers.ts`); desktop dropdowns open on hover and focus, and **Escape closes one the mouse opened** without moving focus |
| `hud-integration.spec.ts` | the HUD chrome **on the real site** (critique §4, HI1–HI8), armed: HI1 on a 390×844 touch phone a hit at the centre of `#top button`, `#top a[href="#servicii"]`, the header theme toggle and `#servicii nav a:nth-child(3)` lands on the control, never the guide (`@smoke`); HI2 Tab reaches RO within 40; HI3 a hero CTA opens exactly one dialog (one `[role=dialog]`), and a fresh visitor has exactly one cookie banner and no HUD after a move; HI4 no sideways scroll at 320 / 390 / 768 / 1280 in light and dark, top and bottom, the guide inside the width; HI5 no decorative dot after a full scroll (the `[data-hud]` subtree included, the rail's nav attached first) and `<html>`/`<body>` untouched; HI6 0 CSP violations, no console error, three.js and GSAP never loaded after arming (the rail included) and a full scroll; HI7 `/servicii/e-commerce`: one static service drawing, 0 WebGL contexts, two `[data-hud]` parts at 1280 (one guide, one rail — one before Phase 5); HI8 the guide away over `#estimare` (opacity 0, `tabindex=-1`) with no visible form control under it, and on the phone the footer's last link ("Cookie-uri") in view with a hit at its centre on the link, not the guide — its size floor is its own 14px line box (the footer's 12px meta row predates the HUD); the rail (Phase 5), at 861 and 1280: HI9 no sideways scroll with the rail armed, the rail 44px wide against the right edge, top to bottom; HI10 `<html>`/`<body>` untouched and no decorative dot after marker jumps down, to the end, back to the top and one keyboard jump; HI11 the guide's box never overlaps the rail's box or any marker button, at the top and the bottom of the page |
| `scroll-rail.spec.ts` | the **fibre scroll rail** (IT-OS Phase 5), armed (`HUD_ON`, consent seeded, `armHud`): at 1280 no rail and a visible top bar before arming, then one `<nav>` named `RAIL_COPY.nav` with the 7 home markers (labels from `RAIL_HOME_SECTIONS`: the catalog `nav.*` words and `RAIL_COPY`), each `expectTappable`, no links, the `aria-hidden` fibre with `pointer-events: none`, and the top bar `display: none` (`@smoke`); the Lucrări marker lands `#lucrari` at `--header-h` ±2 and becomes `aria-current`, a click does not move focus, at the bottom `--rail-p` is `"1.0000"`, Contact is current, every tick passed and a pulse requested, `expectRootUntouched`, no sideways scroll; Enter on Echipă focuses `#echipa` at the header line and Tab moves on with its tabindex restored; Tab reaches RO within 40 with the rail after the footer in DOM order; the guide and the rail never overlap at the bottom; 390×844: no rail, the top bar is the fibre (2px, `linear-gradient(90deg, transparent, <head colour>)`, a glow, an 18×2 square `::after` head at `right: 0`); reduced motion (`contextOptions`): after wheeling past every marker nothing runs inside `[data-rail]` and no `data-pulse` was set; `/servicii/produs-digital`: ≥ 3 tappable markers, 0 canvases; forced WebGL (`@webgl`, 150s): it scrolls to Work first (the stage loads nothing before), and once Work's spiral applies the Echipă and Contact markers move (when read before it) and Lucrări still lands on `#lucrari` |
| `language.spec.ts` | the switcher changes the copy without a reload; the choice persists via `tbs_locale`; a seeded cookie is honoured server-side; all three languages are offered |
| `contact-form.spec.ts` | empty/invalid form → inline messages, `aria-invalid`, **no network request**; a valid form sends the expected payload once; a 429 leaves the form usable |
| `responsive.spec.ts` | 320 / 375 / 390 / 768 / 1280 × light + dark: no horizontal scroll (on the home page also at the top, mid-hero, the services and the last screen of the interior), header stays one row inside the viewport, language + theme reachable **without opening the burger**, 44px touch targets |
| `keyboard.spec.ts` | Tab reaches the header controls, Enter/Space activate them, arrow keys move focus inside the language group, the focus ring is really drawn |
| `modal.spec.ts` | the service-page CTA opens the **real** request flow in a dialog; `role`/`aria-modal`/name from its own heading; focus enters, is trapped over 40 Tab and 40 Shift+Tab presses, and returns to the CTA; ✕ / Escape / a click on the scrim close it, a click (or a drag ending) inside does not; the page behind is frozen and restored to the same pixel; the service is preselected (`/servicii/e-commerce` → €6.000, `/servicii/produs-digital` → €3.000); at 390px it is a bottom sheet with no sideways scroll |
| `chat.spec.ts` | a freely typed answer becomes a bubble and earns the clarification round; the dialog terminates in a summary rendered on screen that contains what the visitor described; an 80-character unbroken word wraps instead of widening the page (desktop + 390px) |
| `request-flow.spec.ts` | the request flow — the same **deck** on the page and in the dialog; see the section below |
| `dictation.spec.ts` | with `SpeechRecognition` removed the button is **not rendered at all**; with a fake recogniser injected it appears but constructs and starts nothing until clicked; a click shows the listening state; recognised text lands in an **editable** review box and reaches the field only after "add", carrying the visitor's edits; a refused microphone shows the fallback and leaves both the button and manual typing usable |
| `sound.spec.ts` | off by default (no `tbs_sound` cookie); **no `AudioContext` is constructed while the page loads** — the constructor is counted from before the app's first line; the first one appears strictly inside the click that turns sound on, and only one is ever built; the choice survives a reload and turning it off drops the cookie; a returning visitor with sound already ON still triggers nothing before a gesture |

### Probes and browser quirks

- **Reduced motion only works through `contextOptions`:**
  `test.use({ contextOptions: { reducedMotion: "reduce" } })`. `test.use({ reducedMotion:
  "reduce" })` is silently ignored in this setup, and a test written that way tests nothing.
- **Probes installed before the app's first line** — `watchCsp`, `countWebGLContexts` (read by
  `webglContextCount`), `countAudioContexts` — plus the globals three.js and GSAP set
  (`window.__THREE__`, `window.gsapVersions`, read by `threeLoaded` / `gsapLoaded`; `false` on
  entry and on every non-forced path) prove what ran and what never loaded.

### The interior stage and the other specs

Since 2026-10-28 the only WebGL on the site is Work's DNA helix (`#lucrari`), drawn by a stage
(`components/scene/`, [docs/05](../docs/05-page-sections.md#interior-stage-3d)) that wraps Work
alone and requests nothing — no probe, no three.js, no GSAP, no context — until Work is within
one viewport. Hero, Ticker and Directions draw static SVG. The harness pins the stage's path:

- **Every visitor arrives with the GPU probe answered.** `gotoHydrated(page, url)` seeds
  `sessionStorage.tbs_gpu_probe` with `SOFTWARE_GPU_PROBE` (a context, but a software one) unless
  the tab already has an answer — near Work the stage then settles on the flat grid
  (`data-renderer="fallback"`, `data-reason="software"`) without creating a throwaway SwiftShader
  context inside other specs' timing windows. A test about the probe passes
  `{ seedGpuProbe: false }`, and one that seeds its own answer with `seedGpuProbe(page, …)` first
  keeps it.
- **Forcing the scene:** `forceScene3d(page)` sets `localStorage.tbs_scene_3d = "force"` from an
  init script (software renderers, the low tier and a slow device accepted, never a governor
  bail); the forced specs seed `FORCED_GPU_PROBE` (SwiftShader's answer for both probe modes) so
  they skip the throwaway context. They scroll to Work first — at the top the stage stays
  `pending`. Run only the forced tests with `npx playwright test --grep @webgl`
  (`work-helix.spec.ts` H2, the spiral test in `scroll-rail.spec.ts`).
- **Locators and probes** (all in `helpers.ts`, names from `lib/scene.ts`): `sceneStage`,
  `heroCore` (`[data-testid="hero-core"]`, the hero's chip art), `servicesScreen`
  (`[data-testid="services-screen"]`), `directionPills`; `countWebGLContexts` +
  `webglContextCount`, `threeLoaded` / `gsapLoaded` (the globals three.js and GSAP set,
  `window.__THREE__` / `window.gsapVersions`); `decorativeDots` (every painted box of at most
  8×8px rounded to half its short side, in the header, main, footer and the HUD chrome's parts
  `[data-hud]`, the dictation slot excepted); `computedTransform`; `scrollToY` (an instant scroll
  that waits for the position); `burgerRoundTrip` (moved here from `hud-shell.spec.ts`);
  `expectRootUntouched` (no inline style on `<html>` / `<body>` and no scroll-measure hold
  `html[data-scroll-measure]`, polled).
- **Work's helix in the forced specs:** the helix is built only after the scene is ready, so a
  test waits for `data-helix="spiral"` (90s under SwiftShader) before it reads the grown track.

### The HUD chrome and the other specs

The IT-OS HUD (the Ghid TBS guide, the fibre rail, the OS dock and windows) mounts once through
`components/hud/HudChrome.tsx` and arms only after the cookie banner is answered, the visitor's
first interaction (`pointermove`, `pointerdown`, `wheel`, `scroll`, `keydown`, `touchstart` or
`focusin`) and an idle slot. To Playwright, every mouse move, tap, scroll or key
press is such an interaction, and many specs seed consent — so a dock or a guide prompt could
appear in the middle of a spec, over the very control it is about to press. The harness pins it:

- **Every context starts with the HUD off.** `playwright.config.ts` sets `use.storageState` to
  `localStorage.tbs_hud = "off"` for the `BASE_URL` origin (the key comes from `lib/hud/gate.ts`).
  Nothing else about the page changes.
- **A HUD spec opts in** with `test.use({ storageState: HUD_ON })` (empty storage, from
  `helpers.ts`), seeds consent, and calls `armHud(page)`: a mouse move, repeated every 250ms (a
  first move can land before `HudChrome`'s listener is attached — the header hydrates first) until
  a `[data-hud]` part is attached, for up to 5s. It fails at once, with the fix in the message, if the context still
  has the HUD off.
- **A spec that builds its own context** (`browser.newContext`) does not inherit `use`, so it
  passes its `storageState` fixture on, like its `baseURL` — the classic-scrollbar test in
  `hud-shell.spec.ts` does.
- **Survey run:** `E2E_HUD=on npx playwright test` leaves the storage state out, so the whole
  suite runs with the HUD able to arm. It is not a gate; every failure it shows is triaged in the
  phase's `CHANGELOG.md` entry (Phase 4, the guide armed: 291 passed, 0 failed; Phase 5, the rail
  armed too: 306 passed, 0 failed).
- **The HUD specs** are `scroll-rail.spec.ts` (the fibre rail: the nav, jumps, keyboard, the
  phone fibre bar, reduced motion, a service page, the spiral) and `hud-integration.spec.ts`
  (HI1–HI11: what the armed chrome must never take from the page). `guide.spec.ts` was **deleted
  on 2026-09-26** with the guide it covered — the linger tip, its prompts and its own CTA source
  are gone from the site, and what remained of the file was the avatar and her questions, which
  `hud-integration.spec.ts` already measures. Their locators are `guideRoot`
  (`[data-hud][data-guide]`, with `data-away` / `data-yield`), `guideAvatar`
  (`[data-testid="guide-avatar"]`), `railRoot` (`[data-hud][data-rail]`; `--rail-p` is on its
  `aria-hidden` fibre child) and `railNav` (its `<nav>`; absent past 8 sections); the copy is
  imported from `components/hud/guide/copy.ts` (`GUIDE_COPY`) and `components/hud/rail/copy.ts`
  (`RAIL_COPY`, `RAIL_HOME_SECTIONS`, plus `messages.ro` for the `nav.*` keys), never retyped.
- **The rail exists only from 861px.** At the default 1280×800 an armed spec gets both parts, so
  `[data-hud]` counts 2 there and 1 on a phone; `armHud` resolves on the first part, so wait for
  `railNav(page)` before reading the rail. A marker jump is a smooth `scrollTo`: poll the section's
  top rather than reading it once. Under `test.use({ reducedMotion })` the option is ignored in this
  config; use `contextOptions: { reducedMotion: "reduce" }`.
- **The avatar's box is stable from the first frame.** It used to be scaled and lifted for 0.7s
  by an entrance, and a spec had to wait for `data-state="idle"` before reading it. Both the
  entrance and `data-state` went on 2026-09-26; what is left is a 0.4s opacity fade, chosen
  because opacity does not move the box these specs measure.
- **`consoleErrors(page, { allowMissing })`** drops console errors from resources whose path ends
  in one of `allowMissing` — by default `["/api/content"]`, the 404 the Next-only server gives.
  A spec that also reaches another endpoint passes the whole list, the default included.

### `request-flow.spec.ts` — the deck, in the dialog

The request flow is ONE arrangement in two places. It was two: the home page showed the deck
(both bays, everything at once) and the dialog ran the same flow as a **single-column, stepped**
wizard — `1 choose the project → 2 choose what it should contain → 3 fill in your details`, with
the assistant behind a toggle — because two columns squeezed into a 960px modal read as cramped.

**On 2026-09-26 the owner asked for one design**, and the cramping was answered differently: the
deck measures ITSELF (`@container deck (width < 711px)` in `Estimator.module.css`) instead of the
window, so it stacks its own bays on its own width — two at 1440, one inside the dialog on a
phone. The wizard, its progress indicator, its Înapoi/Continuă nav and the chat toggle are gone,
and so is the whole step-walking layer in `helpers.ts` (`goToStep`, `expectActiveStep`,
`clickStepNav`, `openChat`, …). The rule that OUTLIVED it is the one that mattered commercially:
the fast path to a sent request is **never** gated behind the chat.

These specs address the flow only through the contract its markup declares, never through
copy (trilingual, reworded often) or CSS-module class names:

| hook | meaning |
|---|---|
| `[data-testid="request-flow"]` | the flow's root; `data-layout="dialog"` in the modal, `"section"` on the home page. It is BEHAVIOUR only — nothing in the stylesheet keys off it — and the corner assistant steps out of the way of the `section` one |
| `[data-step="project" \| "options" \| "contact"]` | the deck's three regions. All three are on screen and all three carry `data-active="true"`; the wizard's "exactly one" rule is what went away |
| `[data-testid="chat-panel"]` | the assistant inside the DIALOG — present from the first frame, focusable, and what `openAssistant` moves focus to |
| "Trimite cererea" | the submit button keeps its existing accessible name |

| journey | tests |
|---|---|
| **the deck** | 3 — the dialog opens on all three regions at once with `data-layout="dialog"`, the assistant visible, the submit already enabled, the opened-from service's price showing and **no `#estimare`** (the anchor belongs to the page); a request sent without the assistant being touched, asserting the posted payload (name, email, phone, the preselected price, the slug inside `message`); the home page renders the same deck as `data-layout="section"` |
| **the assistant** | 2 — an answer typed into the chat ends up **inside the posted `message`** with the summary heading; and a project chip pressed AFTER the conversation still reaches the payload, which is the deck's own advantage over the wizard (chips and assistant on screen together) |
| **375px phone** | 1 — the deck stacks (every region shares one left edge, measured as geometry), no horizontal scroll, the sheet anchored to the bottom edge and inside the viewport, a ≥44px submit |
| **both themes** | 2 — one complete journey each in `light` and `dark`, seeded via `tbs_theme` so the palette is server-rendered rather than toggled afterwards |

Prices are **derived, never typed**: `servicePrice()` reads `lib/content.ts` and
`priceForSlug()` composes it with `SERVICE_TO_ESTIMATOR_TYPE` from `lib/directions.ts`, so a
repricing in the admin panel cannot turn these tests red. Every test stubs
`POST /api/contact`, including the ones that never submit — the form inside the flow is live.

**The contract gap that closed itself.** This section used to end with one: the contract named
the container, the steps, the indicator and the chat toggle, but never the control that MOVED
between steps, so `goToStep()` had to try three different ways of finding it and reported which
hook was missing when none worked. There are no steps to move between now, and the helper went
with them.

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

- [x] **The request form submitted from inside the modal** — now covered by
      `request-flow.spec.ts` (the fast path submits from inside the dialog and asserts the
      payload, including the preselected service's price).
- [x] **The transcript inside the submitted `message`** — now covered by
      `request-flow.spec.ts` (the guided path asserts the chat answer and the summary heading
      are inside what `POST /api/contact` carries).
- [ ] **Cookie-consent banner** (`components/ui/CookieConsent.tsx`) — partly covered since
      2026-09-16: `hud-shell.spec.ts` checks focus, the named choices, Escape = essential only,
      the 44px buttons and the opaque phone panel. Still open: "Accept" and the analytics
      pixel only loading after consent. Note that the banner is a non-modal `role="dialog"`;
      specs that would otherwise be blocked by it answer it up front with `seedConsent()`.
- [ ] **Legal pages** `/confidentialitate` and `/cookies` in all three languages.
- [ ] **Admin panel** `/admin-tbs-digital` — login, `noindex`, and unauthenticated access.
- [ ] **Cross-engine**: only a `chromium` project is configured; add `webkit` if iOS Safari
      behaviour ever needs guarding.
