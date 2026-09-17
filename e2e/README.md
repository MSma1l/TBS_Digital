# End-to-end tests (Playwright)

Browser tests that drive a **real production build** of the site. They cover what jsdom
cannot see: routing and redirects, cookie-driven server rendering (theme + language), layout
at real viewport widths, keyboard/focus behaviour, the first-visit intro (timing, WebGL,
the CSS failsafe), and the home page's interior 3D stage (the static-art path, the forced WebGL
canvas, scroll measuring).

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
| `routes.spec.ts` | `/` and the five `/servicii/<slug>` pages in ro/ru/en (200 + correct `<html lang>`); 301 redirects from every legacy `/solutions/<old-slug>` **keeping the locale prefix**; unknown slug is a 404; canonical + hreflang present. Raw `page.goto` (the status code is the point), so it seeds `tbs_intro=seen` itself with `seedIntroSeen()` |
| `theme.spec.ts` | the toggle flips the palette; the choice persists across a reload via `tbs_theme`; the server stamps `<html data-theme>` **in the first byte** (asserted on the raw HTML, before any script runs): `dark`/`light` from the cookie, and **`dark` with no cookie or a junk value** — on `/` and on a service page; the dark default really paints a dark surface; the stamp, the painted surface and "follows the visitor onto another page" are asserted with **`light`**, the non-default, because a dark cookie would pass on the default alone |
| `preloader.spec.ts` | the **first-visit intro** (`{ seedIntro: false }`): it renders over a hero already painted at full opacity; the readout counts up, never back, and ends at exactly 100; the session cookie (`tbs_intro=seen`, session, `path=/`, `SameSite=Lax`); a reload is a returning visit (no overlay in the HTML, no three.js, no WebGL); skip by button, Escape and keyboard (skip is the first Tab stop); no `AudioContext` without a gesture; no CSP violation and no console error; the SVG fallback under SwiftShader with three.js never loaded; `/en` and `/ru`; never on a service page or after a client-side navigation to Home; the cookie banner waits for it; reduced motion, JavaScript disabled, and JavaScript that never arrives (the 7s CSS failsafe); phones in portrait **and** landscape (320×720, 390×844, 640×360, 568×320: no sideways scroll, skip a 44px target clear of the readout); the forced-WebGL scene (a click at the header CTA reaches the header while the overlay fades) and a refused renderer falling back to the SVG; with the interior stage: the first visit's probe answer is kept in `tbs_gpu_probe` and the stage settles on its art (`fallback` / `software`), there is no stage on a service page, and reduced motion turns it `off` |
| `interior.spec.ts` | the **interior 3D stage on the default path** — a returning visitor whose SwiftShader GPU the stage's strict probe refuses, so the page settles on the static art. E1 `fallback`, no canvas, no three.js or GSAP evaluated, entrance markers untouched, no CSP violation, and Work inside the stage with its cards exactly as React rendered them (one `data-work-track`, every card's `style` just `--p1` / `--p2`, no `data-helix-front`, no `data-helix`) (`@smoke`); E1b without a cached answer the probe makes one throwaway context, a reload none; E2/E3 no decorative dot in the header, main or footer at 1280 and 390px; E4 ←/→ walk the pills with `aria-current` and `data-shape` together, focus never enters the layer; E5 the sticky layer never paints past the stage; E6 hover switches the shape, a click opens the page; E7 a stat card tilts under the mouse and settles, the marker is never styled; E8 a project card tilts and keeps `--p1/--p2`, its screenshot drifts on the view timeline; E8b at 861px the full-row last card keeps its screenshot at a normal card's size; E9/E9b/E10/E11/E11b on a 390px touch screen: the first tap on another pill selects, the second opens, the already-selected pill opens on the first tap, "Deschide serviciul" opens at once, cards never tilt, the services screen comes before the heading; E13 the art never runs an infinite animation; E14 the HTML carries one service drawing and the browser draws the others on a switch; E15 hover and keyboard focus boost the scene, the focus a mouse-closed dialog hands back does not; E16 a multi-part tag keeps its visible "·" on the chips' plate, no chip blurs; E12 reduced motion: `off`, no context, still holograms, no tilt or parallax, the pills still switch; E12b Save-Data; E12c the off flag never requests the probe |
| `interior-webgl.spec.ts` (`@webgl`) | the **interior stage with WebGL forced** (`forceScene3d`, SwiftShader, 120s per test). W1 one click-through canvas, mid tier on a phone, no inline style on `<html>`, `<body>` or a marker after ScrollTrigger's refreshes, no CSP violation; W2 pauses off screen (300px past the stage's bottom — the stage ends after Work now) and under the burger; W3 a burger round trip keeps the header on top and the scroll position; W4 leaving and coming back three times: no stage away from home, the context released, at most one live context; W5 no sideways scroll at 320 / 390 / 768 / 1280px, once Work's helix mode is applied (`spiral` from 768px, `ambient` below), with two more marks: `#lucrari`'s top and the middle of its card track; W6 a renderer the browser refuses ends on the art (`lost`); W7 no WebGL at all: `no-context`, nothing heavy loaded; W8 a first visit with both scenes forced never draws the stage while the intro is on screen; W9 a forced reload creates exactly one context; W10 a CTA hover boosts without sound and scrolling never hides the headline; W11 scrolled 40px past the services entry band's end (`anchor.top − .75vh + 40`), once the model has formed a pill hover morphs it (`data-morph` running → idle; the pill loop allows ~20s, since the 1.1s burst is at least 22 frames under SwiftShader's 20 Hz clamp); W12 a theme switch while drawing logs no error; W13 a refresh while the request dialog is open (a phone keyboard 844 → 450 → 844px at Y=2500, a desktop resize 1280 → 1100 at Y=3000) leaves the scroll probe matching the DOM; W14 a scene that loads while the stage is off screen keeps its art until it has drawn; W16 (1280×800) scrolled to the services entry band's end, `data-entry` goes `idle` → `burst` → `formed` within 20s (the transitions are recorded with their times and attached as annotations; formed never sooner than 1s after burst), the Directions panel's `box-shadow` changes to its glow, and scrolled above the band's start it goes `burst` → `idle`; W17 (1280×800, mouse) 60 pointer moves over the hero draw the cursor circuit trail — one draw per frame more than the settled idle count while it lives, back to the idle count after the 0.9s fade — and leave one canvas, one live context, the hero CTAs and the header theme toggle hit by a click at their centres, no console error and no CSP violation; **Work's DNA helix** (IT-OS Phase 3): W15 (1280×800) once the helix is built the stage says `data-helix="spiral"` and the section grows; every card keeps its own colours inline; no sideways scroll and `<html>`/`<body>` untouched at the spiral's start, middle and end; at mid-span the front card takes a click at its centre, it is sticky with a positive `z-index`, and every card behind the helix has `pointer-events: none` and takes no hit; Tab through every linked project brings each one to the front (`data-helix-front`) within 3s (the timings are logged); a window narrowed to 700px leaves the spiral at once with every card's `style` attribute back byte for byte; back at 1280 and up past Work the spiral applies again; a client navigation to a service page and back gives new cards with only their two colours (React writes them through the CSSOM, `--p1: #…; --p2: #…;`) and the spiral lays them out again; no CSP violation, no console error. W15t (768×1024 touch) the tablet spiral: the front card takes a tap, back cards none, no sideways scroll. W18 (390×844 touch) the phone keeps its band: `data-helix="ambient"`, `#lucrari` does not move, no card gets an inline layout, a CDP touch swipe along the band moves `data-helix-front`, and a first tap on another pill (E9's case, with the helix drawing) moves nothing below it. W19 (1280×800) a reload scrolled 200px into `#lucrari` keeps the grid: for 8s after `webgl` the section's height and the scroll position do not change and no `spiral` is applied; back at the top the spiral applies, the section grows and the scroll probe matches the DOM |
| `hud-shell.spec.ts` | the HUD shell of a returning visit: the header clock shows **Chișinău** time (UTC+3 summer, UTC+2 winter) in a New York browser; nothing moves or keeps an inline style after hydration; the cookie banner is focused, names its choices, Escape means essential only, 44px buttons, and at 390/320px it is an **opaque panel with no backdrop blur**; the neon CTA focus ring is `--txt`, 2px outside the button, in both themes; the ticker is one decorative strip; the desktop header row fits one line without sideways scroll at 861, 1024 and 1180px in every locale; at 320 and 390px the burger menu keeps the header at the top and the scroll position (also with classic scrollbars, in a browser of its own; the round trip is `burgerRoundTrip` in `helpers.ts`); desktop dropdowns open on hover and focus, and **Escape closes one the mouse opened** without moving focus |
| `guide.spec.ts` | the **Ghid TBS guide** (IT-OS Phase 4), armed (`HUD_ON`, consent seeded, `armHud`): at 1280 no `[data-hud]` before any interaction, then a real button (`aria-haspopup="dialog"`, its `GUIDE_COPY.aria` name, 44px, the 88×88 box 20px from the corner at z 112, `enter` → `idle`) (`@smoke`); centred on `#servicii`, no tip at 3.5s and the servicii tip by 12s, `data-state="prompt"`, the avatar described by the sentence alone, no role or live region, focus still on `BODY`, no sideways scroll, no dot, the tip's three buttons 44px; a dismissed tip stays gone after scrolling away and back plus 6s; the avatar opens the dialog on the chat (`chat-panel` visible, `chat-toggle` `aria-expanded="true"`, focus inside) and the stubbed request's origin block is exactly `- Sursă (CTA): guide`; the tip's own button sends `- Secțiune: servicii` / `guide-prompt`; Tab still reaches RO within 40; over `#estimare`'s form `data-away`, opacity 0, `tabindex=-1`, `pointer-events: none`, never `display`/`visibility`/`inert`, and back at the top it returns. Gating: no consent → no HUD after moves and a wheel, accepting the banner brings the avatar with no further move; a first visit never has the guide and the intro in the DOM together (a MutationObserver from the first byte), and the move made during the intro arms it once the overlay is gone. Reduced motion (`contextOptions`): the tip still shows, no computed `animationName` and no `getAnimations()` inside `[data-guide]`. `/servicii/e-commerce`: the `service` tip on `[data-guide-topic="service"]`, the avatar's flow on the shop price, the origin block `- Serviciu: e-commerce` / `- Secțiune: service` / `- Sursă (CTA): guide`, 0 canvases, no three.js or GSAP, 0 CSP violations, no console error. 375×812: the 52×52 avatar 12px from the corner (measured at rest), and with the dialog open a hit at its centre is not the guide. Real waits, not `page.clock` (the tip needs IntersectionObserver entries, `visibleTimeout` and the gate's idle slot in step) |
| `hud-integration.spec.ts` | the HUD chrome **on the real site** (critique §4, HI1–HI8), armed: HI1 on a 390×844 touch phone a hit at the centre of `#top button`, `#top a[href="#servicii"]`, the header theme toggle and `#servicii nav a:nth-child(3)` lands on the control, never the guide (`@smoke`); HI2 Tab reaches RO within 40; HI3 a hero CTA opens exactly one dialog (one `[role=dialog]`), and a fresh visitor has exactly one cookie banner and no HUD after a move; HI4 no sideways scroll at 320 / 390 / 768 / 1280 in light and dark, top and bottom, the guide inside the width; HI5 no decorative dot after a full scroll (the `[data-hud]` subtree included) and `<html>`/`<body>` untouched; HI6 0 CSP violations, no console error, three.js and GSAP never loaded after arming and a full scroll; HI7 `/servicii/e-commerce`: 0 canvases, 0 `[data-testid^=scene-]`, 0 live contexts, one `[data-hud]`; HI8 the guide away over `#estimare` (opacity 0, `tabindex=-1`) with no visible form control under it, and on the phone the footer's last link ("Cookie-uri") in view with a hit at its centre on the link, not the guide — its size floor is its own 14px line box (the footer's 12px meta row predates the HUD) |
| `language.spec.ts` | the switcher changes the copy without a reload; the choice persists via `tbs_locale`; a seeded cookie is honoured server-side; all three languages are offered |
| `contact-form.spec.ts` | empty/invalid form → inline messages, `aria-invalid`, **no network request**; a valid form sends the expected payload once; a 429 leaves the form usable |
| `responsive.spec.ts` | 320 / 375 / 390 / 768 / 1280 × light + dark: no horizontal scroll (on the home page also at the top, mid-hero, the services and the last screen of the interior stage), header stays one row inside the viewport, language + theme reachable **without opening the burger**, 44px touch targets |
| `keyboard.spec.ts` | Tab reaches the header controls, Enter/Space activate them, arrow keys move focus inside the language group, the focus ring is really drawn |
| `modal.spec.ts` | the service-page CTA opens the **real** request flow in a dialog; `role`/`aria-modal`/name from its own heading; focus enters, is trapped over 40 Tab and 40 Shift+Tab presses, and returns to the CTA; ✕ / Escape / a click on the scrim close it, a click (or a drag ending) inside does not; the page behind is frozen and restored to the same pixel; the service is preselected (`/servicii/e-commerce` → €6.000, `/servicii/produs-digital` → €3.000); at 390px it is a bottom sheet with no sideways scroll |
| `chat.spec.ts` | a freely typed answer becomes a bubble and earns the clarification round; the dialog terminates in a summary rendered on screen that contains what the visitor described; an 80-character unbroken word wraps instead of widening the page (desktop + 390px) |
| `request-flow.spec.ts` | the **restructured, stepped** request flow — see the section below |
| `dictation.spec.ts` | with `SpeechRecognition` removed the button is **not rendered at all**; with a fake recogniser injected it appears but constructs and starts nothing until clicked; a click shows the listening state; recognised text lands in an **editable** review box and reaches the field only after "add", carrying the visitor's edits; a refused microphone shows the fallback and leaves both the button and manual typing usable |
| `sound.spec.ts` | off by default (no `tbs_sound` cookie); **no `AudioContext` is constructed while the page loads** — the constructor is counted from before the app's first line; the first one appears strictly inside the click that turns sound on, and only one is ever built; the choice survives a reload and turning it off drops the cookie; a returning visitor with sound already ON still triggers nothing before a gesture |

### The first-visit intro and the other specs

The home page plays a full-screen intro once per browser session (`components/intro/`,
[docs/05](../docs/05-page-sections.md#first-visit-intro-preloader)). Left alone it would sit over
every control a spec is about to press, so the harness treats it explicitly:

- **Every spec is a returning visitor unless it says otherwise.** `gotoHydrated(page, url)`
  seeds `tbs_intro=seen` before it navigates, so the server renders no overlay. The cookie is
  seeded **at the origin** (`new URL("/", baseURL)`) — Playwright derives the cookie path from
  the URL, and one scoped to `/servicii/` would not stop the intro on `/`. A spec that uses raw
  `page.goto` seeds it itself with `seedIntroSeen(context, baseURL)` (`routes.spec.ts`).
- **A first visit is opt-in:** `gotoHydrated(page, url, { seedIntro: false })`, as
  `preloader.spec.ts` does.
- **Headless Chromium has WebGL2, through SwiftShader**, which the intro's capability probe
  classes as a software renderer — so the default path is the deterministic **SVG fallback**.
  `forceIntro3d(page)` sets `localStorage.tbs_intro_3d = "force"` from an init script to get the
  WebGL scene anyway (its describe has a 120s budget: the high tier draws at a few fps there);
  `breakRendererWebGL` (the probe passes, the real renderer is refused) and `forceNoWebGL` cover
  the fallbacks.
- **Reduced motion only works through `contextOptions`:**
  `test.use({ contextOptions: { reducedMotion: "reduce" } })`. `test.use({ reducedMotion:
  "reduce" })` is silently ignored in this setup, and a test written that way tests nothing.
- **Probes installed before the app's first line** — `recordIntroProgress`, `recordIntroAttributes`,
  `sampleIntroVisibility`, `watchCsp`, `countWebGLContexts`, `countAudioContexts` — plus the
  globals the libraries set (`window.__THREE__`, `window.gsapVersions`, read by `threeLoaded` /
  `gsapLoaded`) prove what ran and what never loaded.
- The intro's names come from `lib/intro.ts` (`INTRO_COOKIE`, `INTRO_SEEN`, `INTRO_FORCE_3D_KEY`,
  `INTRO_REVEAL_ATTR`) and the skip button is found by its catalog label `intro.skip` — never
  re-typed.

### The interior stage and the other specs

The home page's Hero → Ticker → Directions → Work scroll over a 3D stage (`components/scene/`,
[docs/05](../docs/05-page-sections.md#interior-stage-3d)). Every spec sees it, so the harness
pins its path:

- **Every returning visitor arrives with the GPU probe answered.** `gotoHydrated` seeds
  `sessionStorage.tbs_gpu_probe` with `SOFTWARE_GPU_PROBE` (a context, but a software one) unless
  the tab already has an answer — the stage then settles on the static art
  (`data-renderer="fallback"`, `data-reason="software"`) without creating a throwaway SwiftShader
  context about a second after idle, CPU time that used to land inside other specs' timing
  windows. The default follows `seedIntro`; a test about the probe passes `{ seedGpuProbe: false }`
  (E1b), and one that seeds its own answer with `seedGpuProbe(page, …)` first keeps it.
- **Forcing the scene:** `forceScene3d(page)` sets `localStorage.tbs_scene_3d = "force"` from an
  init script (software renderers, the low tier and a slow device accepted, never a governor bail);
  `disableScene3d` sets `"off"`. The intro keeps its own key (`forceIntro3d`); the stage never reads
  it. Run only the forced tests with `npx playwright test --grep @webgl`.
- **Locators and probes** (all in `helpers.ts`, names from `lib/scene.ts`): `sceneStage`,
  `sceneHero`, `sceneServices`, `directionPills`; `trackWebGLContexts` + `liveWebGLContexts` /
  `createdWebGLContexts` (weak references, so "the context was released" is a live count going
  back to 0); `countDrawCalls` + `drawCallsPerFrame` / `resetDrawCalls` (the WebGL draw methods of
  both context prototypes wrapped from an init script, tallied per animation frame: a mesh that
  is not visible issues no draw, so W17 sees the cursor trail as one extra draw per frame that
  goes away once it fades — nothing in production is touched); `recordSceneAttributes` +
  `sceneAttributeValues` (every `data-renderer` the stage had,
  and whether the intro was on screen then); `settledRenderer`; `gpuProbeCache`;
  `decorativeDots` (every painted box of at most 8×8px rounded to half its short side, in the
  header, main, footer and the HUD chrome's parts `[data-hud]`, the dictation slot excepted);
  `computedTransform`; `scrollToY` (an instant scroll that waits for the position);
  `burgerRoundTrip` (moved here from `hud-shell.spec.ts`, shared with W3); `expectRootUntouched`
  (no inline style on `<html>` / `<body>` and no scroll-measure hold, polled; moved here from
  `interior-webgl.spec.ts`).
- **The scroll probe is read through React, not a global:** `sceneProbeVsDom` walks the fiber props
  of the canvas's ancestors to the stage's `probe` and lays each span and anchor next to what the
  DOM measures now — `heroExit`, `entry` (the services anchor − 90% / − 75% of the viewport),
  `work` (Work's track − 70% / − 55%), `helix` (the track's top less the header height → its bottom
  less the viewport, clamped to its top like ScrollTrigger does: a phone's band is shorter than the
  viewport), the stage and the anchors' and track's document y; `probeMismatches` lists the ones
  off by more than 2px. Production exposes nothing for it.
- **Work's helix in the forced specs** (`interior-webgl.spec.ts`): the helix is built only after
  the scene is ready, and the spiral applies only while Work is below the viewport, so a test waits
  for `data-helix` (60s) before it scrolls into Work. `workGeometry` (the track, `#lucrari`, the
  header height and the spiral's span), `cardStyles` (every card's `style` attribute) and
  `spiralHits` (the front card's hit test, back cards' `pointer-events` and hits, all sticky) are
  local helpers of that spec. W15 scrolls through Work on its way back up; an instant jump straight
  to the top applies the spiral too (the driver reads Work's rect in the frame it would lay the
  cards out, not only the IntersectionObserver, which never fires for a jump across Work).

### The HUD chrome and the other specs

The IT-OS HUD (the Ghid TBS guide, the fibre rail, the OS dock and windows) mounts once through
`components/hud/HudChrome.tsx` and arms only after the cookie banner is answered, the visitor's
first interaction (`pointermove`, `pointerdown`, `wheel`, `scroll`, `keydown`, `touchstart` or
`focusin`), the intro gone and an idle slot. To Playwright, every mouse move, tap, scroll or key
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
  phase's `CHANGELOG.md` entry (Phase 4, the guide armed: 291 passed, 0 failed).
- **The HUD specs** are `guide.spec.ts` (the Ghid TBS: button, linger tip, gating, reduced
  motion, a service page, a phone, away) and `hud-integration.spec.ts` (HI1–HI8: what the armed
  chrome must never take from the page). Their locators are `guideRoot` (`[data-hud][data-guide]`,
  with `data-state` / `data-away` / `data-yield`), `guideAvatar` (`[data-testid="guide-avatar"]`)
  and `guideTip` (`[data-testid="guide-tip"]`); the copy is imported from
  `components/hud/guide/copy.ts` (`GUIDE_COPY`), never retyped.
- **Linger waits are real time.** The tip needs 5s of visible time on the centre line: a spec
  centres the topic, checks there is no tip at 3.5s and waits for it until 12s after the scroll (in
  the page it lands 5.02–5.04s after the scroll).
  `page.clock` is not used there — it would have to drive the IntersectionObserver entries,
  `visibleTimeout` and the gate's `requestIdleCallback` in step.
- **Measure the avatar at rest.** For 0.7s after mounting (`data-state="enter"`) the button is
  scaled and lifted by its entrance; wait for `data-state="idle"` before reading its box (the
  root `[data-guide]` box is never transformed).
- **`consoleErrors(page, { allowMissing })`** drops console errors from resources whose path ends
  in one of `allowMissing` — by default `["/api/content"]`, the 404 the Next-only server gives.
  A spec that also reaches another endpoint passes the whole list, the default included.

### `request-flow.spec.ts` — the stepped flow

The request flow was restructured from a two-column estimator squeezed into a 960px modal
into a **single-column, stepped** flow in the order the client asked for — `1 choose the
project → 2 choose what it should contain → 3 fill in your details` — with the conversational
assistant demoted to an **optional** panel behind a toggle. The rule that matters
commercially: the fast path to a sent request is **never** gated behind the chat.

These specs address the flow only through the contract its markup declares, never through
copy (trilingual, reworded often) or CSS-module class names (rewritten in this very change):

| hook | meaning |
|---|---|
| `[data-testid="request-flow"]` | the flow's root; `data-layout="dialog"` in the modal, `"section"` on the home page |
| `[data-step="project" \| "options" \| "contact"]` | the three step panels; the one on screen carries `data-active="true"` |
| `[data-testid="request-steps"]` | the progress indicator; its current item carries `aria-current="step"` |
| `[data-testid="chat-toggle"]` | the assistant's switch, with `aria-expanded` |
| `[data-testid="chat-panel"]` | the assistant's panel — **absent from the DOM** until the toggle is pressed |
| "Trimite cererea" | the submit button keeps its existing accessible name |

| journey | tests |
|---|---|
| **fast path** (no chat) | 4 — the dialog opens on the **project** step with `data-layout="dialog"`; the chat panel is **not in the DOM** and the toggle reads `aria-expanded="false"`; project → options → contact → **send** without ever touching the chat, asserting the posted payload (name, email, phone, the preselected service's price, and the service slug inside `message`); the home page renders the same flow as `data-layout="section"` |
| **guided path** (with chat) | 2 — the toggle opens the panel and flips `aria-expanded` to `"true"`, and closes it back down leaving the step where it was; an answer typed into the chat ends up **inside the posted `message`**, together with the summary heading |
| **navigation & state** | 3 — the active step is reflected in **both** `data-active` and `aria-current` (exactly one of each, naming the same step); "back" does not lose typed contact details; the preselected service survives all three steps and is what the payload carries |
| **375px phone** | 1 — exactly one step panel visible, no horizontal scroll, the sheet anchored to the bottom edge and inside the viewport, ≥44px targets on the chat toggle and the submit button |
| **both themes** | 2 — one complete journey each in `light` and `dark`, seeded via `tbs_theme` so the palette is server-rendered rather than toggled afterwards |

Prices are **derived, never typed**: `servicePrice()` reads `lib/content.ts` and
`priceForSlug()` composes it with `SERVICE_TO_ESTIMATOR_TYPE` from `lib/directions.ts`, so a
repricing in the admin panel cannot turn these tests red. Every test stubs
`POST /api/contact`, including the ones that never submit — the form inside the flow is live.

**Contract gap worth closing.** The contract names the container, the steps, the indicator and
the chat toggle, but never names the control that **moves between steps**. `goToStep()` in
`helpers.ts` therefore tries, in order: an explicit `[data-testid="request-next"]` /
`[data-nav="next"]` hook, then a button named like `/continuă|mai departe|următorul|înainte/i`
(and `/înapoi|pasul anterior/i` backwards), then the step indicator if its items are
clickable. Whichever the implementation picked, the specs keep working; if it picked none, the
failure message says exactly which hook is missing rather than dying on a bare locator. Adding
`data-testid="request-next"` / `"request-back"` would make this unambiguous.

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
      the 44px buttons and the opaque phone panel, and `preloader.spec.ts` that it waits for the
      intro (and shows at once under reduced motion). Still open: "Accept" and the analytics
      pixel only loading after consent. Note that the banner is a non-modal `role="dialog"`;
      specs that would otherwise be blocked by it answer it up front with `seedConsent()`.
- [ ] **Legal pages** `/confidentialitate` and `/cookies` in all three languages.
- [ ] **Admin panel** `/admin-tbs-digital` — login, `noindex`, and unauthenticated access.
- [ ] **Cross-engine**: only a `chromium` project is configured; add `webkit` if iOS Safari
      behaviour ever needs guarding.
