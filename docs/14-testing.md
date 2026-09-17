# 14 — Testing

Four layers of automated checks guard the app: frontend unit/UX tests (Vitest), browser
end-to-end tests (Playwright), backend API tests (pytest), and a live end-to-end API
verification script.

## Frontend — Vitest + React Testing Library

Config: `vitest.config.ts` (jsdom, `@/` alias, collects `**/*.test.{ts,tsx}`) +
`vitest.setup.ts` (jest-dom matchers, auto-cleanup, a `matchMedia` stub). Run:

```bash
npm test          # vitest run (one-shot, CI)
npm run test:watch
```

The frontend toolchain runs in Docker, not on the host (Tailwind's native binaries are
per-platform — see [12 — Deployment](./12-deployment.md#frontend-tooling-in-docker-build-checks-lockfile)).
The full gate, in Git Bash:

```bash
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/app" \
  -v tbs_nm_alpine:/app/node_modules -v tbs_next_alpine:/app/.next \
  --tmpfs /app/.claude -w /app -e NEXT_TELEMETRY_DISABLED=1 -e NEXT_PUBLIC_API_URL= \
  node:22-alpine sh -c "npm run build && npx tsc --noEmit && npm run lint && npm test"
```

`next build` comes before `tsc` (it generates `next-env.d.ts` and the route types).
`--tmpfs /app/.claude` hides agent worktrees from `tsc`, ESLint and Vitest.

**1,200 tests across 65 files** (the Phase 2 gate of the IT-OS experience — the services
entrance, the Directions glass reveal and the brand-ui grid, 2026-09-17; the result of each full
run is recorded in [`CHANGELOG.md`](../CHANGELOG.md), and the per-file counts below are from that
run). Phase 2 added `scene-mesh-wave.test.ts` (9) and replaced the tests of the scroll-scrubbed
entrance with the entry gate's: `scene-choreography` 39 → 48, `scene-build` 16 → 18, `scene-tiers` 13 → 14,
`directions-selector` 32 → 34, `tailwind-contract` 21 → 26; `scroll-guard` (30), `scene-stage`
(29) and `lib/scene` (53) keep their counts, rewritten for the entry band and `data-entry`.
Phase 1 (the hero chip and the cursor trail) gave 1,172 across 64: it added `scene-trail.test.ts`
(17) and rewrote the chip's tests: `scene-shapes` 20 → 45, `hero-core-art` 20 → 28,
`scene-build` 12 → 16, `scene-choreography` 38 → 39, `scene-tiers` 12 → 13. Before it, 1,116
across 63 (the HUD foundation); before that 1,031 across 57; before the interior redesign, 566
across 36; before the HUD redesign, 316 across 21.

| Area | File (tests) | Covers |
|------|--------------|--------|
| API client | `lib/__tests__/api.test.ts` (20) | every endpoint call (method/URL/headers/bearer), `ApiError` handling (network=0, 401, `{detail}` parsing), 204, token helpers |
| Validation | `lib/__tests__/validation.test.ts` (37) · `validation-hardening.test.ts` (3) | `isEmail`/`isPhone`/`hasDangerousContent`/`sanitizeText`/`validateText`, rule order, limits; precedence from the pentest: required > length > dangerous-content |
| Content store | `lib/__tests__/siteContent.test.tsx` (13) | `mergeSiteData` (replace/fallback), load/save/clear round-trip, SSR-safe default-then-swap provider |
| Smoke | `lib/__tests__/smoke.test.ts` (2) | test infra itself: the `@/` alias resolves, jsdom is present |
| Admin | `app/__tests__/admin-login.test.tsx` (3) · `admin-tabs.test.tsx` (5) · `admin-delete-submission.test.tsx` (5) | login gate, tabs, submission list, deleting a request |
| Routes | `app/__tests__/servicii-routes.test.tsx` (13) | the `/servicii` slugs and the legacy redirect map stay identical in `next.config.ts` |
| Contact form, request flow, modal | `contact-form.test.tsx` (47) · `request-flow.test.tsx` (30) · `modal.test.tsx` (20) · `dictation-button.test.tsx` (19) | inline validation, blocked XSS input, submit states; one dialog for every CTA; the dialog covers the page while open and lifts the cover only after the body is unpinned and the scroll position is back; dictation; the request context (2026-09-17): `projectType` wins over the slug, `optionIds` replaces the default (`[]` ticks none, unknown ids dropped), `openAssistant` opens the dialog on the assistant with focus in it (the section ignores it), `guideTopic` gives `- Secțiune: <topic>` only for a known topic, the attachment block sits between the summary and the origin with its note under the proposal, and both survive the 5,000 cap |
| Request catalog | `lib/__tests__/request-catalog.test.ts` (12) · `request-attachment.test.ts` (9) | the project types and options with their ids, labels byte-identical to what the estimator rendered, `SERVICE_FOR_TYPE`, the id guards and `lib/hud/topics.ts`; `attachmentBlock`: empty for nothing, control characters stripped, the 1,200 cap with `[…]` never splitting a surrogate pair |
| HUD foundation | `hud-chrome.test.tsx` (21) · `lib/__tests__/hud-gate.test.ts` (7) · `hud-busy.test.ts` (9) · `hud-obscure.test.ts` (8) | `HudChrome`'s gate, in order: `tbs_hud=off` never arms and listens to nothing; unanswered consent waits for `CONSENT_EVENT` (the answer is the interaction); otherwise the first arming event (passive, capture, every listener removed at once); then the intro gone and an idle slot; nothing renders before, unmount cancels any step. `readHudFlag` (only `"off"` counts, storage that throws is `null`), `gate.ts` import-free; the busy store (per source, listeners only on the flip, server writes ignored); `covers` / `overlaps` (edges, empty and non-finite boxes) |
| Sections | `sections.test.tsx` (5) · `work.test.tsx` (14) · `direction-page.test.tsx` (23) · `directions-selector.test.tsx` (34) | presentational renders, the hero metrics group, direction pages; Work: numbering, links only with a URL, gradients, tilt next to `--p1/--p2`, one parallax wrapper per screenshot, tag chips keeping their "·", no chip blur; Directions: real links, each pill named by its label alone (the ↗ never read), the preview and the case card (tags keep "·"), the first-tap rules (another pill selects, the selected pill opens, a swipe primes nothing, mouse / keyboard / synthetic clicks navigate), ←/→ and Home/End, `data-shape` and the scene store follow the selection, the initial art slot and the lazy drawings; the glass reveal hooks (`entry-glow` on the panel and `entry-sweep` on its copy column, once each, no `after:` utility on that column, off every `[data-reveal]`; the glow's `--accent` follows the selection) |
| Header | `navbar.test.tsx` (12) | links, CTA sibling order, burger label, no admin link in the markup |
| Header menus | `navbar-menu.test.tsx` (29) | burger overlay: focus on "×", Escape / "×" back to the burger, `aria-controls` only while open, scroll lock, focus-out and ≥861px close; dropdowns: `aria-expanded`, Escape with focus inside **and** on a mouse-opened dropdown with focus elsewhere, first-tap-opens / second-tap-navigates (`shouldInterceptTap`), outside tap, no new tab stops |
| Header clock | `header-clock.test.tsx` (16) · `lib/__tests__/clock.test.ts` (19) | `--:--:--` on the server, `aria-hidden`, one shared interval, the bar clock only ticking where `BAR_CLOCK_QUERY` matches; Chișinău summer/winter offsets, the 2026 DST edges, `00` not `24`, independent of the process `TZ` |
| Preferences | `theme-toggle.test.tsx` (17) · `language-switcher.test.tsx` (14) · `sound-toggle.test.tsx` (23) | dark default whatever the OS prefers; the light choice (the non-default) is what the cookie/`aria-pressed` tests assert |
| Ticker | `ticker.test.tsx` (6) | five identical groups, each **ending** in a separator (the seamless loop), separators drawn as empty hidden hairlines (never a dot), the entrance marker on the outer strip only |
| Cookie banner | `cookie-consent.test.tsx` (21) | shows and focuses in the mount effect with no intro; waits for a pending intro; the effect-order race; the visible-time backstop that never fires under a live intro; held-Escape repeats ignored; the 700ms Escape guard after a played intro |
| Intro contract | `lib/__tests__/intro.test.ts` (26) · `intro.server.test.ts` (4) | the session cookie string, `finishIntro` idempotence, `isIntroPending`, `onIntroDone`'s synchronous path, `shouldPlayIntro`; `tbs:intro-gone` (`markIntroGone` a no-op while the overlay is attached, fired once; `onIntroGone` synchronous without an overlay); importing `lib/intro` touches no DOM |
| Intro shell | `intro-preloader.test.tsx` (27) | server markup; the CSS failsafe / reduced-motion / deep-link / click-through rules pinned against the module; client-only mount renders nothing; takeover on the SVG fallback without touching WebGL; skip by click, Escape, Tab (focus still moves); modified keys ignored; reduced motion, hash and late-hydration bypasses; the visible-time watchdog; a skip key stops at the intro; the probe runs once in the shell and the scene chunk is requested from there; `tbs:intro-gone` fires once, only after the overlay has left |
| Intro math | `intro-capability.test.ts` (26) · `intro-math.test.ts` (21) · `intro-scene-math.test.ts` (24) | the capability probe (jsdom, reduced motion, Save-Data, caveat, software-renderer detection, force 3D; the session cache: one probe context per tab, yes/no values only, no renderer name, never read when a live gate said no); the lemniscate; tiers and the DPR clamp; seeded orbits; `fitRig`; the FPS governor, including a steady 30 Hz cap that must not step down |
| Entrance contract | `intro-reveal-contract.test.tsx` (8) | Navbar + Hero + Ticker in ro/ru/en: each of the 8 `data-intro-reveal` targets exactly once, none styled; no stylesheet selects the attribute |
| Tailwind contract | `tailwind-contract.test.ts` (26) | the rules in [07 — Conventions](./07-conventions.md#tailwind-first-screen-and-interior-stage-files-only), plus scanner self-tests on CRLF fixtures; the services glass reveal (2026-09-17): the glow under `formed` and statically on `fallback` / `off`, never `pending`, with its one transition on the WebGL path; `color-mix` only inside its own `@supports`; the sweep's `::after` animated only under `burst` with motion allowed; no filter, blur or radius; `hud-glass-sweep` at the top level, transform and opacity only, opacity ≤ .12 (the five tests were mutation-checked against six broken copies of the CSS) |
| Helpers | `lib/__tests__/scrollLock.test.ts` (17) · `visibleTimeout.test.ts` (7) | reference counting, the classic-scrollbar gutter rule, empty `style` removal; the page cover (held while any lock is, lifted only after the page's styles are restored, 0 ↔ 1 announced once); pause while hidden, fire once |
| Interior contract | `lib/__tests__/scene.test.ts` (53) | the QA flag; the `tbs_gpu_probe` cache (parse, write, the strict → forced fill, unknown keys dropped); `decideWebGL` / `reasonFor`; `readMotionGate`'s order; `scrollProgress` and the probe's shape (`heroExit`, `entry`); directions → models; the input store (boost sources, `waveSeq` only on 0 → 1 edges, shape); the DOM contract names (`data-entry` included); importing `lib/scene` with no DOM; `lib/gpuProbe` import-free and the same identity through `lib/scene` |
| Device, idle | `lib/__tests__/device.test.ts` (24) · `idle.test.ts` (10) | `detectTier` unchanged; `detectSceneTier` (a phone reporting 4 GB is mid, not low); reading the profile; `afterIdle` with and without `requestIdleCallback`: a visible-time minimum, a hidden tab waits, cancel at any step |
| Tap, tilt, holograms | `lib/__tests__/tapIntent.test.ts` (7) · `tilt.test.ts` (15) · `hologram.test.ts` (7) · `pointer-tilt.test.tsx` (10) | the first-tap rule; `tiltFor` (clamped, two decimals, never `-0`) and `shouldTilt`; both ends of every octahedron edge land on a vertex; `usePointerTilt`'s one-per-frame writes, one active card, the settle and no empty `style` left |
| Shared 3D helpers | `three-shared.test.ts` (21) | the governor's opt-in bail (never before lite, never on a steady 30 Hz cap, a stall resets, terminal); `damp` / `clampDprRange`; `readTokenColors`; `contextAttributes`; the transmission clear — a fake renderer that copies three's convert-when-set rule proves the linear target is cleared to the page colour itself (≈0.003), not its sRGB encoding (≈0.04) |
| Scene maths | `scene-shapes.test.ts` (45) · `scene-choreography.test.ts` (48) · `scene-tiers.test.ts` (14) · `scene-palette.test.ts` (10) · `scene-input.test.ts` (11) | the chip's geometry (die < heat spreader < substrate < board ≤ R = the old core's radius; for 1–9 traces per side every run axis-aligned or 45°, inside the board, no crossings, four-fold symmetric, pins where the traces start; deterministic, never `-0`); neural graph, commerce track, hub and cube layouts, projections; fit and parallax, the layouts and the behind-the-copy dims per theme, the sticky canvas's document position, the chip's exit pose (shrink, exploded-view lift) and its dissolve (`coreReveal`), morph steps and who draws what (above the services nothing; the entrance bursts the selected model's slot out of `BURST` and reveals it over the last stretch, imploding back the same way; formed, the pill morph owns the swarm; a property test holds both ends of the entrance continuous — the swarm's alpha against the model's reveal, for every shape), the services entry gate (`stepGate`: arms at the band's end, disarms only above its start, 1.1s / 0.45s in time wherever the page rests, `instant`; `entryState` → `idle|burst|formed`), per-frame smoothing (the first frame snaps the gate, so a deep link finds the model formed; the burst takes 22 frames at SwiftShader's 20 Hz clamp; an unmeasured anchor keeps it shut; flung back to the hero it snaps idle) and the light wave, the swarm's silhouettes (slot 0 on the chip at rest); tier budgets (chip traces 7 / 5, the brand-ui grid 16×8 / 10×6 cells with 32 / 24 segments a row, only high antialiases, no glass-core keys left), DPR, governor options; token parsing, glow / ink roles (and no glass roles), the theme observer; device orientation → tilt per screen angle (a real landscape grip rests near the centre), pointer listeners (a mouse sample also starts the cursor trail, a touch one never), **never `requestPermission`** (iOS) |
| Cursor trail | `scene-trail.test.ts` (17) | `pushTrail`: the first sample only starts the chain, H then V gives an L, a diagonal two orthogonal segments (the longer leg first), the same cell draws nothing, a gap over 0.35s or a jump over 12 cells breaks the chain, an unusable sample breaks it too, the ring overwrites the oldest and marks everything dirty on a wrap, `dirty` is the contiguous range written; `attachTiltInput` lays it for a mouse and a pen in document px (client + scroll, event time in seconds), never for touch, an unknown pointer type or a coarse pointer; the mesh (`three/trail.ts`): `TRAIL.cap` × 6 vertices on the trail branch of P5, drawn last, never culled, hidden until a segment is written, only the written slots uploaded (the whole buffer after a wrap), placed on the page like `fitAnchor` places a host, ink narrower and fainter than glow, the shader's life literal equal to `TRAIL.life` |
| Brand & UI grid | `scene-mesh-wave.test.ts` (9) | the rebuilt mesh-wave model (2026-09-17): `waveGridSegments` gives 650 segments on high and 348 on mid, every line on a row or a column and drawn edge to edge once, every `+` of arm 0.045 centred on an even crossing, once in each direction; the model draws one P4 grid plus one line set per card (lite leaves the grid), no point sprites, and `POINTS_MODE` has no wave-node mode; the swarm's brand-ui samples, un-posed, lie on the tier's grid at wave time 0 (within 1e-6), about 45 / 40 / 15% on rows / columns / crosses, in either half of the buffer too (the lite prefix); the landing clock holds at 0 while the model forms, runs from the first formed frame (a broken step never moves it), grows the pulse ring and the pointer's pull in over `WAVE_SETTLE_SECONDS` (0.6s), keeps running through a dissolve and restarts at a new landing; while the model lands its grid's wave time, pulse radius and origin are exactly 0 whatever the scene time and tilt |
| Scene build and lifecycle | `scene-build.test.ts` (18) · `scene-stage.test.tsx` (29) · `scroll-guard.test.ts` (30) | the world built one part per idle slice (the chip, the swarm, the trail, each model) and compiled one draw object per slice; the chip's five draw objects on four programs, its exploded view, trace ribbons and pin flares; the services entrance on a real world (nothing drawn above the band; past it the swarm's both ends on the selected model's slot, the speck at the services host's centre per `BURST_SPECK`; formed after 22 frames at 20 Hz, the model alone; the cubes' block unchanged for the whole hold after `formed` and moving a second later; resting inside the band keeps it, above it implodes to nothing) and a deep link formed on the first frame; ready counted in drawn frames (a paused canvas never becomes ready); the DPR watcher (debounced resize, the resolution query re-armed); `SceneStage`'s gates, waits, attributes (`data-entry` written straight to the DOM only once the scene reports it, dropped on a bail and under reduced motion), pause, bail / lost / hidden-tab retry / error paths, with the 3D runtime mocked; the probe writes (`writeEntrySpan`, non-finite → 0); the smooth-scroll guard, quiet / wake and `SceneDirector` with the **real gsap 3.15.0** in jsdom: exactly two animation-free triggers (`#top` "top top" → "bottom 35%", the services anchor "top 90%" → "top 75%"), no measurement under a cover and a redo the frame after it lifts, the stage observed (not `<main>`), refreshes deferred while scrolling, the ScrollTrigger loop stopped after the director is removed three ways |
| Interior source contract | `scene-contract.test.ts` (15) | no static three / R3F / GSAP import — by name, subpath or the site's heavy modules, type imports allowed — in the files `eslint.config.mjs` lists (the lists are compared; `components/hud/**` included since 2026-09-17); no pin, snap, `normalizeScroll`, ScrollSmoother, markers, scroller or `lagSmoothing` under `components/scene/**`, `components/hud/**` or `lib/hud/**`; the stage in `@source` and the art not; no `"use client"` in the art; `lucide-react` pinned at exactly 1.46.0, imported by name from the package root only (no dynamic entry point, `dist/*` path or namespace, the same list ESLint bans) and at runtime only under `components/hud/**` |
| Hero interior, art | `hero-interior.test.tsx` (22) · `hero-core-art.test.tsx` (28) · `service-art.test.tsx` (43) | the CTA boost (never a finger, a pen does; only a `:focus-visible` focus; hover and focus kept apart; released on unmount); holograms (one per card, text-free, spin gated); stat-card tilt never on the marker; the hosts, paint order and parallax wrappers, eight markers unstyled; the chip art's markup (one projection group, no circle, every point inside the frame, lean numbers), a circuit not particles (runs horizontal, vertical or 45°, closed rectangular pins, square vias, packets as streaks ≥ `PARTICLE_MIN_LENGTH` on screen), the WebGL chip's proportions (the matrix is the projected `CHIP_POSE` basis, art traces = `chipTraces(5)`, `chipLift` = projected height), the square wave and packet flicker, static CSS on tokens; one static drawing per direction, each model's geometry, pure source |
| No decorative dots | `decorative-dots.test.tsx` (12) | the dot detector on fixtures (`rounded-full`, `rounded-pill`, `rounded-[50%\|999px\|9999px]` with a dot-sized box; big glows, hairlines and pills are not dots); no `hud-blink`; no round dot in the scanned files; no glowing full stops; the estimator's status dot gone; no small circles or round caps in the art; the rendered header, hero, ticker, Directions, Work and stage in three locales |

Tests mock `@/lib/api` (no real network) and use the real `@/lib/validation`.

Things worth knowing before touching these files:

- **jsdom has no `ResizeObserver`, no `Element.getAnimations` and no WebGL.** The capability
  probe checks `ResizeObserver` first, so in jsdom it answers "no WebGL" without calling
  `getContext`; the shell's late-takeover check reads 0. The interior stage's `readMotionGate()`
  does the same (`fallback` / `unsupported`), so a plain render of the home page never requests
  a 3D chunk. No WebGL mocks are needed; `scene-stage.test.tsx` stubs `ResizeObserver` for the
  paths that go further.
- **The scene's maths never loads three.js**: `choreography`, `tiers`, `input` and `palette` are
  pure TypeScript on purpose, so `scene-choreography`, `scene-tiers`, `scene-input` and
  `scene-palette` run without it. `three-shared`, `scene-build` and `scene-mesh-wave` do import
  three (a fake renderer; a real world built part by part; the brand-ui model's line sets). `scene-stage.test.tsx` and
  `intro-preloader.test.tsx` mock the two scenes the 3D runtime exports: evaluating the real
  three.js under a busy CPU made their timing tests fail.
- **`scroll-guard.test.ts` runs the real gsap 3.15.0 and ScrollTrigger in jsdom** — the smooth-scroll
  guard and quiet / wake depend on its internals, and this is the unit-level tripwire for an
  upgrade. Its frame counts are jsdom's, not a browser's.
- **`intro.server.test.ts` runs in jsdom with `window`/`document` stubbed away**, not in the
  `node` environment: `vitest.setup.ts` reads `window.matchMedia` at its top level. (Vitest also
  reads an `@vitest-environment` pragma inside a prose comment, so don't write that phrase in
  one.)
- **A mocked module is evaluated once per file.** The last test in `intro-preloader.test.tsx`
  (the scene chunk requested from the shell) must stay last; its `beforeEach` throws if a test
  is added after it.
- Known stderr noise that fails nothing: `Error: Not implemented: window.scrollTo` (Modal's
  unlock) and an `act()` warning from the watchdog test's async probe.

Type + lint + build are part of the same gate (the Docker command above runs all four).

## End-to-end — Playwright

Browser tests that drive a **real production build** (the standalone server, exactly as the
Dockerfile runs it) in Chromium. Config: `playwright.config.ts`; specs: `e2e/*.spec.ts`; the
harness, helpers and per-spec coverage are described in [`e2e/README.md`](../e2e/README.md).

In Docker (the Playwright image, glibc, with its own volumes; the config's `webServer` builds
and serves the site):

```bash
MSYS_NO_PATHCONV=1 docker run --rm --ipc=host -v "$(pwd -W):/app" \
  -v tbs_nm_noble:/app/node_modules -v tbs_next_noble:/app/.next --tmpfs /app/.claude \
  -w /app -e NEXT_TELEMETRY_DISABLED=1 mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -c "npm ci && npx playwright test --workers=1 --retries=0 --reporter=list"
```

Add spec paths to run a subset, `--repeat-each=N` to hunt flakes, `--grep @webgl` for the
forced-WebGL interior tests alone. **256 tests in 15 specs** (the final run of 2026-09-17,
recorded in [`CHANGELOG.md`](../CHANGELOG.md)): `responsive`, `routes`, `hud-shell`, `preloader`,
`interior`, `interior-webgl`, `modal`, `request-flow`, `theme`, `contact-form`, `keyboard`,
`language`, `dictation`, `chat`, `sound`. Phase 1 of the IT-OS experience (the hero chip and the
cursor trail) adds one: W17 in `interior-webgl.spec.ts`. Phase 2 (the services entrance) adds one
more, W16 (`data-entry` idle → burst → formed and the panel's glow, then back to idle above the
band), and moves W11 to the entry band. Before the interior redesign: 206 in 13 — it added
`interior.spec.ts` and `interior-webgl.spec.ts` (tagged `@webgl`), and a sideways-scroll test per
viewport and theme in `responsive.spec.ts`. Before the HUD redesign: 156 in 11.

What the first-screen and interior specs rely on:

- **Every spec is a returning visitor unless it says otherwise.** `gotoHydrated(page, url)`
  seeds `tbs_intro=seen` before navigating, so no overlay sits over the controls a test is about
  to press. `e2e/preloader.spec.ts` passes `{ seedIntro: false }` for a real first visit;
  `routes.spec.ts` uses raw `page.goto` (the status code is the point) and seeds with
  `seedIntroSeen()` in `beforeEach`. The cookie is seeded **at the origin**
  (`new URL("/", baseURL)`): Playwright derives the path from the URL, and a cookie scoped to
  `/servicii/` would not stop the intro on `/`.
- **Headless Chromium here has WebGL2 — through SwiftShader.** Playwright 1.62's launcher always
  adds `--enable-unsafe-swiftshader`; `getContext("webgl2", { failIfMajorPerformanceCaveat:
  true })` is **not** refused; the unmasked renderer reads "ANGLE (Google, Vulkan … SwiftShader
  Device …)". The intro's probe classes it as a software renderer, so **the default E2E path is
  the deterministic SVG fallback**. (`--disable-software-rasterizer` gives a browser with no
  WebGL at all.)
- **Forcing WebGL:** `forceIntro3d(page)` sets `localStorage.tbs_intro_3d = "force"` from an
  init script, which skips the caveat and the renderer check. The forced-WebGL describe in
  `preloader.spec.ts` has a 120s budget: under SwiftShader the high tier draws at ~5 fps and
  needs ~3s to be ready, and the test expects it before the 80% cutoff. `breakRendererWebGL`
  (the probe passes, the real renderer is refused) and `forceNoWebGL` cover the fallbacks.
- **Every returning visitor also arrives with the GPU probe answered** (2026-09-17):
  `gotoHydrated` seeds `sessionStorage.tbs_gpu_probe` with SwiftShader's answer
  (`SOFTWARE_GPU_PROBE`: a context, but a software one) unless the tab already has one, so the
  interior stage settles on its static art (`fallback` / `software`) without creating a
  throwaway context about a second after idle — CPU time that used to land inside other specs'
  timing windows. A test about the probe itself passes `{ seedGpuProbe: false }`.
- **Forcing the interior scene:** `forceScene3d(page)` sets `localStorage.tbs_scene_3d = "force"`
  (software renderers, the low tier and a slow device accepted, never a governor bail);
  `disableScene3d` sets `"off"`. `interior-webgl.spec.ts` also seeds the forced probe answer, so a
  forced visit makes exactly one context (the renderer's), and gives each test 120s: the scene
  compiles for seconds under SwiftShader.
- **The scene's scroll probe is read through React**, not a production global:
  `sceneProbeVsDom` walks the fiber props of the canvas's ancestors and lays each measured span
  and anchor next to the DOM's value (the entry band: the services anchor's top − 90% / − 75% of
  the viewport); `probeMismatches` lists the ones off by more than 2px (W13, the request dialog +
  resize case; W16 checks it before it scrolls to the band).
- **Reduced motion works only through `contextOptions`:** `test.use({ contextOptions:
  { reducedMotion: "reduce" } })`. `test.use({ reducedMotion: "reduce" })` is silently ignored
  in this repo's setup, and a test written that way passes without testing anything.
- **`launchOptions` cannot be set inside a `describe`**; the classic-scrollbar check in
  `hud-shell.spec.ts` launches a browser of its own instead.
- **The clock is tested with `timezoneId: "America/New_York"` and `page.clock.setFixedTime`**,
  proving the header shows Chișinău time (UTC+3 in summer, UTC+2 in January) whatever the
  visitor's zone.
- Probes installed before the app's first line (`recordIntroProgress`, `watchCsp`,
  `countWebGLContexts`, `recordIntroAttributes`, `sampleIntroVisibility`, `countAudioContexts`)
  and globals set by the libraries themselves (`window.__THREE__`, `window.gsapVersions`) prove
  what loaded and what never did. The interior adds `trackWebGLContexts` (weak references, so
  `liveWebGLContexts` proves a context was released, not only created), `recordSceneAttributes`
  (every `data-renderer` the stage ever had, and whether the intro was on screen then),
  `countDrawCalls` (WebGL draw calls per animation frame, from wrapped context prototypes — W17
  sees the cursor trail as one extra draw per frame that goes away once it fades) and
  `decorativeDots` (every rendered box of at most 8×8px, rounded to half its short side and
  painted, in the header, main and footer — the dictation slot excepted).

## Backend — pytest

The stack runs in Docker, so run the backend suite in the container:

```bash
make test              # docker compose exec backend python -m pytest
```

(`make test-local` exists for a local venv, but Docker is the supported path.)

**131 tests** across 8 files: content round-trip and the API surface (`test_api.py`), the
content-migration path (`test_migration.py`), uploads (`test_uploads.py` — magic bytes, SVG
refusal, pixel caps, re-encoding), the Telegram bot (`test_telegram*.py`), and the security
suite (`test_security_authz.py`, `test_security_hardening.py`, `test_security_http.py` —
authz/IDOR, oversized → 422, `<script>` stored escaped, invalid email → 422, SQLi inert,
rate limits, headers). Telegram is forced off in tests (`backend/tests/conftest.py`) so they
stay hermetic.

## Live API verification

`scripts/verify-api.sh` boots the backend on a throwaway SQLite DB (Telegram disabled), then
asserts **every endpoint the frontend uses** end-to-end — content, login (right/wrong), `me`
(with/without token), contact (valid → 201, bad → 422), submissions (auth-guarded), content
PUT round-trip, **CORS** (frontend origin echoed), and **XSS** (stored escaped). It tears down
the server + temp DB and exits non-zero on any failure.

```bash
PORT=8020 ./scripts/verify-api.sh    # 27/27 checks
```

## One command

```bash
npm test && make test                # frontend unit (node:22-alpine container, see above) + backend (in Docker)
npx playwright test --workers=1      # browser E2E (in the Playwright image, see above)
./scripts/verify-api.sh              # live end-to-end API
```

Record the result of a full run in [`CHANGELOG.md`](../CHANGELOG.md) when it accompanies a
release or a verification pass.
