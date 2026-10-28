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

`app/__tests__/seo-routes.test.ts` keeps the crawler contract pinned: every public page has one
canonical URL per shipped locale in `/sitemap.xml`, every entry has its complete reciprocal
hreflang cluster, no false generated `lastmod` is emitted, and `robots.txt` still advertises the
canonical sitemap while blocking only the private admin/API paths.

**1,548 tests across 76 files** (measured 2026-09-26; the result of each full run is recorded in
[`CHANGELOG.md`](../CHANGELOG.md); the first-visit intro was removed on 2026-10-28 with its nine
unit-test files and its cases in `hud-chrome`, `device`, `cookie-consent` and `ticker`). **The same day the WebGL scene was pruned to Work's DNA helix** (the
only 3D left on the site; hero, ticker and directions draw static SVG — see the CHANGELOG): the
scene tests were kept and rewritten for the helix-only scene (`scene-build`, `scene-choreography`,
`scene-contract`, `scene-helix`, `scene-helix-model`, `scene-hologram`, `scene-input`,
`scene-palette`, `scene-stage` — including that nothing is scheduled until Work is near —
`scene-tiers`, `scroll-guard`, `three-shared`, `lib/__tests__/scene.test.ts`; `hologram.test.ts`
kept), `scene-laptop`, `scene-stat-panel`, `scene-trail` and `scene-mesh-wave` were deleted, and
`scene-shapes.test.ts` became `art-shapes.test.ts`. `npx vitest run` counts **1,156 tests in 66
files** afterwards; the per-file counts in the table are from that list, the phase history below
is kept as it was measured. The assistant in the corner stayed and **the guide inside her went**: `lib/__tests__/guide-linger.test.ts` (75)
was deleted with `lib/hud/linger.ts`, and `guide-assistant.test.tsx` went 44 → 19 — every test of
the linger tip, its blockers and its keyboard went with the tip; what is left is what she still
does. `direction-page` is 22 (no `[data-guide-topic]` to check). Today's other work is in these
numbers too: the hero's stat panels added `components/__tests__/scene-stat-panel.test.ts` (20) and
grew `hero-interior` 22 → 24, and the intro's two silent bypasses added
`app/__tests__/proxy-matcher.test.ts` (4) and 8 between `intro` and `intro-preloader`. Phase 5
(1,613 across 75) added `lib/__tests__/rail.test.ts` (42) and
`components/__tests__/scroll-rail.test.tsx` (40), and grew `hud-chrome` 23 → 29 and
`decorative-dots` 15 → 17. Phase 4 (1,433 across 70) was the assistant's own. Phase 3 (1,309 across 68) added
`scene-helix.test.ts` (41), `scene-helix-model.test.ts` (29), `scene-hologram.test.ts` (23) and
and
grew `scene-choreography` 48 → 57, `scene-build` 18 → 24, `scroll-guard` 30 → 34, `scene-shapes`
45 → 47, `scene-tiers` 14 → 15, `scene-stage` 29 → 30 and `work` 14 → 15; `lib/scene` (53) keeps its
count with the probe's new fields. Phase 2 (the services entrance, the Directions glass reveal and
the brand-ui grid) gave 1,200 across 65: it added `scene-mesh-wave.test.ts` (9) and replaced the
tests of the scroll-scrubbed entrance with the entry gate's: `scene-choreography` 39 → 48,
`scene-build` 16 → 18, `scene-tiers` 13 → 14, `directions-selector` 32 → 34, `tailwind-contract`
21 → 26; `scroll-guard` (30), `scene-stage` (29) and `lib/scene` (53) kept their counts, rewritten
for the entry band and `data-entry`.
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
| Contact form, request flow, modal | `contact-form.test.tsx` (42) · `request-flow.test.tsx` (28) · `modal.test.tsx` (20) · `dictation-button.test.tsx` (19) | inline validation, blocked XSS input, submit states; one dialog for every CTA; the dialog covers the page while open and lifts the cover only after the body is unpinned and the scroll position is back; dictation; the request context (2026-09-17): `projectType` wins over the slug, `optionIds` replaces the default (`[]` ticks none, unknown ids dropped), `openAssistant` moves focus into the dialog's assistant, which is on screen either way since the dialog became the deck (the section ignores it), `guideTopic` gives `- Secțiune: <topic>` only for a known topic, the attachment block sits between the summary and the origin with its note under the proposal, and both survive the 5,000 cap |
| Request catalog | `lib/__tests__/request-catalog.test.ts` (12) · `request-attachment.test.ts` (9) | the project types and options with their ids, labels byte-identical to what the estimator rendered, `SERVICE_FOR_TYPE`, the id guards and `lib/hud/topics.ts`; `attachmentBlock`: empty for nothing, control characters stripped, the 1,200 cap with `[…]` never splitting a surrogate pair |
| HUD foundation | `hud-chrome.test.tsx` (27) · `lib/__tests__/hud-gate.test.ts` (7) · `hud-busy.test.ts` (9) · `hud-obscure.test.ts` (8) | `HudChrome`'s gate, in order: `tbs_hud=off` never arms and listens to nothing; unanswered consent waits for `CONSENT_EVENT` (the answer is the interaction); otherwise the first arming event (passive, capture, every listener removed at once); then an idle slot; nothing renders before, unmount cancels any step; after arming the rail part (a stub for `next/dynamic`) renders, and never while consent is unanswered or the flag is off, and never at all under 861px — the rail is the whole chrome now. `readHudFlag` (only `"off"` counts, storage that throws is `null`), `gate.ts` import-free |
| Fibre rail (IT-OS Phase 5) | `lib/__tests__/rail.test.ts` (42) · `scroll-rail.test.tsx` (40) | The maths, import-free and pure: `progressOf` (clamped, 0 on a page that cannot scroll or a non-finite input), `sectionTarget` (the document top less `--header-h`, inside `[0, max]`), `railLayout` (proportional, the 44px gap enforced forward and backward, the last marker inside the rail, the even-spread fallback on a rail too short, whole pixels, the input untouched), `activeIndex` (the last section reached, the 1px reach, the first before any), `crossedDown` (one tick, two in one jump, none going up, exactly at the turn), `railLabel` (whitespace, pieces joined, no space before punctuation, a 60-character clip that never splits a code point) and `pickRailSections` / `railHasNav`. The component in jsdom: the `[data-hud][data-rail]` root, the `aria-hidden` fibre and a named `<nav>` of 7 home buttons with no links, labels from the catalog and `RAIL_COPY` following the language, ticks and markers on the same laid-out positions, the heading fallback (chrome, `aria-hidden` and multi-`h2` sections skipped, a 60-character clip, `<main>` only, no nav past 8, nothing without sections, re-discovery on a client navigation); a jump scrolls smoothly to just under the header (instant under reduced motion), clamps to the page, measures at that moment, focuses the section on a keyboard activation and gives back the tabindex on blur; per frame `--rail-p` on the fibre (never the root, which carries no style) once per frame, `aria-current` and the passed ticks moving, a pulse per tick crossed downwards (none upwards, none under reduced motion), `data-flowing` dropped 180ms after the last scroll, nothing written while the page is covered, and `<html>` / `<body>` never touched; re-measuring on a `ResizeObserver` on `<html>` and `resize`, and when a cover lifts; only a passive `scroll` and `resize` listener (never wheel, touch or pointer), all removed on unmount; and the CSS Module: fixed on the right edge at `--z-rail` taking no pointer events, 44×44 markers that do, diamond ticks with no radius, no blur, no filter, no literal z-index, and every animation and transition inside `prefers-reduced-motion: no-preference` |
| Sections | `sections.test.tsx` (13) · `work.test.tsx` (15) · `direction-page.test.tsx` (22) · `directions-selector.test.tsx` (35) | presentational renders, the hero metrics group, direction pages; Work: numbering, links only with a URL, gradients, tilt next to `--p1/--p2`, one parallax wrapper per screenshot, tag chips keeping their "·", no chip blur, the grid marked `data-work-track` with every card a direct child carrying only its two colours inline (no `transform`, `position` or `z-index`) and the heading block right before it; Directions: real links, each pill named by its label alone (the ↗ never read), the preview and the case card (tags keep "·"), the first-tap rules (another pill selects, the selected pill opens, a swipe primes nothing, mouse / keyboard / synthetic clicks navigate), ←/→ and Home/End, `data-shape` follows the selection, the initial art slot and the lazy drawings (no loading mark); the panel's static lit edge (`entry-glow`, its `--accent` following the selection) |
| Header | `navbar.test.tsx` (12) | links, CTA sibling order, burger label, no admin link in the markup |
| Header menus | `navbar-menu.test.tsx` (29) | burger overlay: focus on "×", Escape / "×" back to the burger, `aria-controls` only while open, scroll lock, focus-out and ≥861px close; dropdowns: `aria-expanded`, Escape with focus inside **and** on a mouse-opened dropdown with focus elsewhere, first-tap-opens / second-tap-navigates (`shouldInterceptTap`), outside tap, no new tab stops |
| Header clock | `header-clock.test.tsx` (16) · `lib/__tests__/clock.test.ts` (19) | `--:--:--` on the server, `aria-hidden`, one shared interval, the bar clock only ticking where `BAR_CLOCK_QUERY` matches; Chișinău summer/winter offsets, the 2026 DST edges, `00` not `24`, independent of the process `TZ` |
| Preferences | `theme-toggle.test.tsx` (17) · `language-switcher.test.tsx` (14) · `sound-toggle.test.tsx` (23) | dark default whatever the OS prefers; the light choice (the non-default) is what the cookie/`aria-pressed` tests assert |
| Ticker | `ticker.test.tsx` (5) | five identical groups, each **ending** in a separator (the seamless loop), separators drawn as empty hidden hairlines (never a dot) |
| Cookie banner | `cookie-consent.test.tsx` (8) | shows and focuses in the mount effect, with no extra tick and without scrolling the page; links to the cookie policy; Escape records essential-only; held-Escape repeats ignored; each button records and broadcasts its answer; never shows once a choice is stored |
| Tailwind contract | `tailwind-contract.test.ts` (24) | the rules in [07 — Conventions](./07-conventions.md#tailwind-first-screen-and-interior-stage-files-only), plus scanner self-tests on CRLF fixtures; the services panel's lit edge (2026-10-28): `entry-glow` static, keyed off nothing, no transition or animation, `color-mix` only inside its own `@supports`, no filter, blur or radius, no `entry-sweep`; the scanned files: pure Tailwind, no CSS Module mixed in, the only ones writing variant-prefixed utilities |
| Helpers | `lib/__tests__/scrollLock.test.ts` (17) · `visibleTimeout.test.ts` (7) | reference counting, the classic-scrollbar gutter rule, empty `style` removal; the page cover (held while any lock is, lifted only after the page's styles are restored, 0 ↔ 1 announced once); pause while hidden, fire once |
| Portfolio demos | `lib/__tests__/siteDemo.test.ts` (4) | the manifest reader as the boundary between a file the admin can point a project at and the page: it keeps what checks out and drops each hotspot that does not, refuses a manifest of the wrong shape, `deepLink` never leaves the project's own site, and `demoStep` goes to a page, remembers where it was and comes back |
| Interior contract | `lib/__tests__/scene.test.ts` (44) | the QA flag; the `tbs_gpu_probe` cache (parse, write, the strict → forced fill, unknown keys dropped); `decideWebGL` / `reasonFor`; `readMotionGate`'s order; `scrollProgress` from an unmeasured probe; the DOM contract names; importing `lib/scene` with no DOM; `lib/gpuProbe` import-free and the same identity through `lib/scene` |
| Device, idle | `lib/__tests__/device.test.ts` (2) · `idle.test.ts` (10) | `mediaMatches` (false without `matchMedia`) and the reduced-motion query (`detectSceneTier` — a phone reporting 4 GB is mid, not low — is covered through `scene-stage`); `afterIdle` with and without `requestIdleCallback`: a visible-time minimum, a hidden tab waits, cancel at any step |
| Tap, tilt, holograms | `lib/__tests__/tapIntent.test.ts` (7) · `tilt.test.ts` (15) · `hologram.test.ts` (7) · `pointer-tilt.test.tsx` (10) | the first-tap rule; `tiltFor` (clamped, two decimals, never `-0`) and `shouldTilt`; the stat cards' CSS holograms (`lib/hologram.ts`): both ends of every octahedron edge land on a vertex, the rings are four great circles, the portfolio counter gets the octahedron; `usePointerTilt`'s one-per-frame writes, one active card, the settle and no empty `style` left |
| Shared 3D helpers | `three-shared.test.ts` (17) | the governor's opt-in bail (never before lite, never on a steady 30 Hz cap, a stall resets, terminal); `damp` / `clampDprRange`; `readTokenColors`; `contextAttributes` |
| Scene maths | `scene-choreography.test.ts` (24) · `scene-tiers.test.ts` (11) · `scene-palette.test.ts` (7) · `scene-input.test.ts` (11) | pure TypeScript, no three.js: the fixed camera's z = 0 plane and the sticky canvas's document position; the Work helix's sticky zone (`helixZoneTop`), the spiral placement on the cards' axis at `HELIX_ZONE_FILL` of the zone, the strand's radius meeting the cards' orbit, the arrival armed 0.30 of a layer above the sticky line, the ambient placement in the band above the heading (centred, 0.6 of the width, clear of the band's edges); `composeHelix` (nothing drawn with the gate shut, drawn from the gate's first frame, no allocation per frame, no jump); the Work gate (`stepGate`: arms at the band's end, disarms only above its start, 1.2s / 0.5s in time wherever the page rests, `snap`; `stepSceneFx`: the first frame snaps it, so a deep link finds the helix formed, 24 frames at SwiftShader's 20 Hz clamp, no work span keeps it shut) and the tilt sway; tier budgets (the helix 160×4 / 100×3 tubes, 80 / 52 chips, 22 / 14 rungs, 36 / 20 bits and a 384×240 / 256×160 hologram, only high antialiases, no tier configures a model the scene no longer draws), DPR, governor options; token parsing and the glow roles; device orientation → tilt per screen angle, pointer listeners, **never `requestPermission`** (iOS) |
| Art shapes | `art-shapes.test.ts` (42) | the pure maths behind the static art (`components/art/shapes.ts`, formerly `scene-shapes`): the chip's geometry (die < heat spreader < substrate < board ≤ R; for 1–9 traces per side every run axis-aligned or 45°, inside the board, no crossings, four-fold symmetric, pins where the traces start; deterministic, never `-0`); the neural graph (seeded, layer to layer, no orphans), the commerce track, the hub layout and the orthographic projection |
| Work spiral (layout and driver) | `scene-helix.test.ts` (51) | the spiral's pure layout (IT-OS Phase 3): `WORK_HELIX_MEDIA` from a portrait tablet up, the card width / height / scroll-step clamps, 16px from the zone's edges and 60px from 861px (the rail), a pinned `helixLayout` table at 1280 × 729 and 706 × 953, the focus card the largest and on top, `z < 0` ⇔ `zIndex < 0` ⇔ back, every card inside the zone at 768–1920, a card 2.6 steps away gone, its 3D pose turning continuously, the entrance and the finish (`helixExitAt`, `helixFocusAt`, `helixWipe`), `scrollForCard` ↔ `focusFromProgress`, `nearestCard`; the DOM driver in jsdom: applies only with the helix built, three cards, a wide screen and Work below the viewport (a deep link below, then an instant jump to the top, applies with no observer callback; jumps across Work never lay it out on screen), measures its own span, re-lays out on a new probe version, writes each pose and `data-helix-front`, never a card `height` (a `min-height` floor; a card with taller content keeps it, centred, and one taller than the layer starts under the header; a ResizeObserver re-centres a card whose content changed), skips sub-1e-4 focus changes, a focused card fully opaque, `focusin` scrolls to the card (a pointer's focus does not), every `style` attribute back byte for byte (a tilt set meanwhile stays), `--helix-wipe` on each card's two readers (the screenshot and the scan span) and never on the card, a screenshot added mid-wipe getting the card's current wipe, no reader keeping a `style` after dispose, the scroll compensated on dispose inside and past the spiral (not below Work, not after a route change), the media turning off at once and back on only with Work below, the ambient front card from the band's scroll with no layout written, re-keyed cards re-collected (down to two: ambient), no IntersectionObserver or matchMedia: off without throwing, an exception restores everything, and a real `Work` re-rendered for a locale switch keeps the inline layout |
| Work helix model and hologram | `scene-helix-model.test.ts` (30) · `scene-hologram.test.ts` (15) | the helix model: five draws on existing programs per tier (strands P5 links, chips P3 edges, rungs P4 synapse, bits P4 bits, hologram P2 holo) and their segment counts; `HELIX_ANGLE` shared by the model, the layout and `components/art/shapes.ts`; every part (strands, chips, bits) within `HELIX_REACH` of the axis; right-handed strands half a turn apart with unit tangents and TubeGeometry frames that never flip; chip boxes along their strand, rungs with a gap and square nodes, seven-segment 0 / 1 strokes axis-aligned with broken joints, the 1.6 × 1 hologram hung off the group (not the turning pivot); `update` turns by −focus·`HELIX_ANGLE`, front chips brighten, `setMode` lays it down (ambient) and hides the hologram, reveal 0 hides everything unless pre-warming, `dim` multiplies every draw's intensity in both themes (absent or not finite: 1; clamped), lite hides the bits and the glitch, the glitch and the accent ease on scene time, a held step holds the packets, dispose frees what it built; `helixSamples` on the tier's helix, 50 / 25 / 19 / 6% strands / chips / rungs / nodes in any half of the buffer. The hologram: a same-origin screenshot drawn as luminosity in 2px cells with 3px scanlines; a cross-origin, missing, broken or slow (1.5s) one gives text only; a tainted canvas is cleared and drawn text-only without rethrowing; the card's computed fonts, the tag's "·" skipped, a long name shrunk then cut, straight bracket corners; the size clamped to 384×240 (256×160 on mid); one CPU-backed canvas texture with no mipmaps, composing in an idle slot with the newest request winning, a language change recomposes, dispose cancels, no `requestIdleCallback`: a timer, never the requesting task |
| The holographic portrait | `sections.test.tsx` | The card's photograph is projected, not replaced: three copies of the same `<img>` (him, the torn band, the beam), the `alt` on the first and only the first, the other two `aria-hidden` and empty; the key and the tint defined ONCE per section rather than per card, in sRGB because the thresholds were measured there, with a transfer that holds to 0.90 and falls to 0 at 1.0 — his jacket peaks at 0.904 and the ground reads exactly 1.000; and no projection invented for a member who has no photograph |
| The principles' card marks | `sections.test.tsx` | All four cards ("De ce TBS", 2026-10-09; three before) carry a mark and they are the SAME mark — same viewBox, same stroke, same fill — with four different drawings inside that identical box, because the row only reads as a row when they match; each is silent (`aria-hidden`, `focusable="false"`, no text, no `<title>`); none draws a circle or a round cap, the house rule for line art; and nothing in the section shows a reading — the only digits allowed are its own card numbers and the admin's prices in the price list (`[data-price-list]`, excluded from that check since 2026-10-09; the marks are found by `svg[data-mark]`, since the track's ticks are SVGs too), and `50+`, `98%` and `24/7` stay out of the markup AND out of `lib/content.ts`, whose dead `statusBars` export held them until this change |
| Scene build and lifecycle | `scene-build.test.ts` (19) · `scene-stage.test.tsx` (29) · `scroll-guard.test.ts` (34) | the world an empty, hidden root until Work's helix is staged (a palette or lite step set before reaches it), the helix built in an idle slice of its own and compiled one draw object per slice, then pre-warmed and marked built (an unmount part-way never marks it); the handoff on a real world with a fake spiral driver (no driver or a driver `off` keeps the work gate shut; armed on the sticky line the helix forms in time on its zone and turns to the driver's focus; a deep link snaps it; a driver falling `off` mid-arrival hides it; an error in the driver's frame releases it, logs once and the scene draws on); ready counted in drawn frames (a paused canvas never becomes ready); the DPR watcher (debounced resize, the resolution query re-armed); `SceneStage`'s gates, waits and attributes with the 3D runtime mocked — pending and static on the server, **nothing scheduled (no idle slot, no chunk) until Work is near**, the off flag, reduced motion / Save-Data / 2G → off, a low tier → fallback, the session's answer, the first screen outside the stage and Work inside it in three locales; on the WebGL path `data-quality` and `data-helix` (only `spiral` / `ambient`) written straight to the DOM and dropped with the scene, pause, bail / lost / hidden-tab retry / error paths, each chunk requested once; the probe writes (Work's band and helix span with the header taken off its start, the track, its heading without the scroll reveal's offset, the band above it and the layer's height); the smooth-scroll guard (`html[data-scroll-measure]`), quiet / wake and `SceneDirector` with the **real gsap 3.15.0** in jsdom: measuring on mount, `data-scroll-fx`, the scene's layout event re-reading the boxes at once (no refresh, never under a cover), no measurement under a cover and a redo the frame after it lifts, refreshes deferred while scrolling, the ScrollTrigger loop stopped after the director is removed three ways |
| Interior source contract | `scene-contract.test.ts` (16) | no static three / R3F / GSAP import — by name, subpath or the site's heavy modules, type imports allowed — in the files `eslint.config.mjs` lists (the lists are compared — the stage shell, `components/art/**` and the shared maths included; `components/hud/**` since 2026-09-17), and the ESLint block repeats the CSP bans; nothing under `components/scene/three` names GSAP; no pin, snap, `normalizeScroll`, ScrollSmoother, markers, scroller or `lagSmoothing` under `components/scene/**`, `components/hud/**` or `lib/hud/**`; the stage in `@source` and the art not; no `"use client"` in the art; `lucide-react` pinned at exactly 1.46.0, imported by name from the package root only (no dynamic entry point, `dist/*` path or namespace, the same list ESLint bans) and at runtime only under `components/hud/**` |
| Hero interior, art | `hero-interior.test.tsx` (11) · `hero-core-art.test.tsx` (28) · `service-art.test.tsx` (43) | the CTAs carry the hook the core art's CSS keys its one-shot wave off; one CSS-3D wireframe hologram per stat card (`aria-hidden`, text-free, no scene anchor), spinning with no WebGL gate — paused only while the hero is off screen, dropped under reduced motion; stat-card tilt never on the marker; `hero-core` inside the backdrop before the h1, holding the art, nothing in it text or focusable; paint order; the chip art's markup (one projection group, no circle, every point inside the frame, lean numbers), a circuit not particles (runs horizontal, vertical or 45°, closed rectangular pins, square vias, packets as streaks), static CSS on tokens; one static drawing per direction, always shown, its one-shot entrance only under no-preference, each model's geometry, pure source |
| No decorative dots | `decorative-dots.test.tsx` (17) | the dot detector on fixtures (`rounded-full`, `rounded-pill`, `rounded-[50%\|999px\|9999px]` with a dot-sized box; big glows, hairlines and pills are not dots); no `hud-blink`; no round dot in the scanned files; no glowing full stops; the estimator's status dot gone; no small circles or round caps in the art; the HUD CSS Modules (the rail's): no `border-radius: 50%` / `var(--r-pill)` box of 8px or less — a `var(--token)` size resolved against the file, the detector pinned on fixtures — and no blur or filter; no round cap in the rail; the phone fibre top bar's head is an 18×2px square streak, not a dot; the rendered header, hero, ticker, Directions and Work in three locales (the sections alone, no stage) |

Tests mock `@/lib/api` (no real network) and use the real `@/lib/validation`.

Things worth knowing before touching these files:

- **jsdom has no `ResizeObserver`, no `Element.getAnimations` and no WebGL.** The stage's
  `readMotionGate()` checks `ResizeObserver` first and answers `fallback` / `unsupported`, so a
  plain render of the home page never requests a 3D chunk. No WebGL mocks are needed;
  `scene-stage.test.tsx` stubs `ResizeObserver` (and the IntersectionObserver that says Work is
  near) for the paths that go further.
- **The scene's maths never loads three.js**: `choreography`, `tiers`, `input` and `palette` are
  pure TypeScript on purpose, so `scene-choreography`, `scene-tiers`, `scene-input` and
  `scene-palette` run without it. `three-shared`, `scene-build` and `scene-helix-model` do import
  three (a fake renderer; a real world built part by part; the helix's draw objects).
  `scene-stage.test.tsx` mocks the scene the 3D runtime exports: evaluating the real three.js
  under a busy CPU made its timing tests fail.
- **`scroll-guard.test.ts` runs the real gsap 3.15.0 and ScrollTrigger in jsdom** — the smooth-scroll
  guard and quiet / wake depend on its internals, and this is the unit-level tripwire for an
  upgrade. Its frame counts are jsdom's, not a browser's.
- Known stderr noise that fails nothing: `Error: Not implemented: window.scrollTo` (Modal's
  unlock).

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
forced-WebGL Work-helix tests alone (2). **185 tests in 14 spec files** (`npx playwright test
--list`, 2026-10-28, after the scene was pruned to Work's helix — see below). History:
**256 tests in 15 specs** (the final run of 2026-09-17,
recorded in [`CHANGELOG.md`](../CHANGELOG.md)): `responsive`, `routes`, `hud-shell`, `preloader`,
`interior`, `interior-webgl`, `modal`, `request-flow`, `theme`, `contact-form`, `keyboard`,
`language`, `dictation`, `chat`, `sound`. Phases 1–3 of the IT-OS experience added forced-WebGL
tests to `interior-webgl.spec.ts` (deleted 2026-10-28, see below). Phase 4 (the Ghid TBS guide) added `hud-integration.spec.ts` and a `guide.spec.ts` of its own;
`e2e/guide.spec.ts` went when the guide's tip did (it was mostly linger tests), leaving
**237 tests across 14 spec files**
(`npx playwright test --list`, measured 2026-09-26). `hud-integration.spec.ts` is 16 of them —
with the HUD armed: taps on a phone, the tab budget, one dialog and one cookie banner, no sideways
scroll at four widths, no dots and an untouched root, a clean console and CSP, a light service page,
the phone footer, and HI9–HI10 at 861 and 1280 (no sideways scroll with the rail, an untouched root
and no dots after its jumps). Phase 5 (the fibre rail) added `scroll-rail.spec.ts`, now 8.
`preloader.spec.ts` went with the first-visit intro (2026-10-28), leaving 14 spec files.
**2026-10-28, the scene pruned to Work's helix:** `interior-webgl.spec.ts` (W1–W21: the hero
chip, the services swarm, the cursor trail, the stat panels and the helix) was deleted and replaced
by `work-helix.spec.ts`: H1 (`@smoke`) nothing heavy on entry (`data-renderer` stays `pending` at
the top, no three.js, GSAP or context) and near Work the default SwiftShader path settles on
`fallback` / `software`; H2 (`@webgl`, forced flag + `FORCED_GPU_PROBE`, 1280×800) the helix loads
only near Work, draws one canvas inside the stage with `#top` outside it, and reaches
`data-helix="spiral"`. `interior.spec.ts` E1 asserts the stage wraps Work only and is `pending` at
the top; `scroll-rail.spec.ts` keeps its forced-WebGL spiral test (it scrolls to Work first);
`hud-integration.spec.ts` HI7 finds one static drawing and 0 WebGL contexts on a service page.
14 spec files.

Before the interior redesign: 206 in 13 — it added `interior.spec.ts` and
`interior-webgl.spec.ts` (tagged `@webgl`, since replaced by `work-helix.spec.ts`), and a sideways-scroll test per viewport and theme in
`responsive.spec.ts`. Before the HUD redesign: 156 in 11.

What the first-screen and interior specs rely on:

- **Headless Chromium here has WebGL2 — through SwiftShader.** Playwright 1.62's launcher always
  adds `--enable-unsafe-swiftshader`; `getContext("webgl2", { failIfMajorPerformanceCaveat:
  true })` is **not** refused; the unmasked renderer reads "ANGLE (Google, Vulkan … SwiftShader
  Device …)". The stage's strict probe classes it as a software renderer, so **the default E2E
  path is the flat card grid**. (`--disable-software-rasterizer` gives a browser with no WebGL at
  all.)
- **Nothing heavy before Work** (2026-10-28): the stage wraps only Work and requests nothing — no
  probe, no three.js/R3F chunk, no GSAP chunk, no context — until Work is within one viewport, so
  at the top `data-renderer` stays `pending`. A spec about the helix scrolls to `#lucrari` first.
- **Every visitor arrives with the GPU probe answered:** `gotoHydrated(page, url, { seedGpuProbe? })`
  seeds `sessionStorage.tbs_gpu_probe` with SwiftShader's answer (`SOFTWARE_GPU_PROBE`: a context,
  but a software one) unless the tab already has one, so near Work the stage settles on
  `fallback` / `software` without creating a throwaway context inside other specs' timing windows.
  A test about the probe itself passes `{ seedGpuProbe: false }`.
- **Forcing the helix:** `forceScene3d(page)` sets `localStorage.tbs_scene_3d = "force"` (software
  renderers, the low tier and a slow device accepted, never a governor bail), and the forced specs
  seed `FORCED_GPU_PROBE` with `seedGpuProbe` so a forced visit makes exactly one context (the
  renderer's); they get 150s each — the helix compiles for seconds under SwiftShader.
  `sceneStage`, `heroCore` and `servicesScreen` locate the stage, the hero chip art
  (`hero-core`) and the services screen (`services-screen`).
- **The HUD is off unless a spec opts in.** Every context starts with `localStorage.tbs_hud =
  "off"` (`playwright.config.ts`), so the rail cannot arm mid-spec over the control a test
  presses. The HUD specs use `test.use({ storageState: HUD_ON })`, seed consent and call
  `armHud(page)` (a pointer move repeated every 250ms until a `[data-hud]` part is attached, 5s at
  most). `railRoot` and `railNav` locate the rail; its copy is imported from
  `components/hud/rail/copy.ts`. The rail exists only from 861px and is the only part left, so at
  the default 1280×800 an armed page has exactly one `[data-hud]` part and a phone none.
- **The survey run, once per phase:** `E2E_HUD=on npx playwright test` drops the seeded `tbs_hud=off`,
  so the whole suite runs with the HUD able to arm. It is not a gate; each failure is triaged in the
  phase's `CHANGELOG.md` entry (real bug, or expected because the HUD is now live). Phase 4: 291
  passed, 0 failed; Phase 5 (the rail armed as well): 306 passed, 0 failed — nothing to triage
  either time.
- **Reduced motion works only through `contextOptions`:** `test.use({ contextOptions:
  { reducedMotion: "reduce" } })`. `test.use({ reducedMotion: "reduce" })` is silently ignored
  in this repo's setup, and a test written that way passes without testing anything.
- **`launchOptions` cannot be set inside a `describe`**; the classic-scrollbar check in
  `hud-shell.spec.ts` launches a browser of its own instead.
- **The clock is tested with `timezoneId: "America/New_York"` and `page.clock.setFixedTime`**,
  proving the header shows Chișinău time (UTC+3 in summer, UTC+2 in January) whatever the
  visitor's zone.
- Probes installed before the app's first line (`watchCsp`, `countWebGLContexts` /
  `webglContextCount`) and the globals the libraries set (`window.__THREE__`,
  `window.gsapVersions`, read by `threeLoaded` / `gsapLoaded` — `false` on entry and on every
  non-forced path) prove what loaded and what never did; plus
  `decorativeDots` (every rendered box of at most 8×8px, rounded to half its short side and
  painted, in the header, main and footer — the dictation slot excepted).

## Backend — pytest

The stack runs in Docker, so run the backend suite in a container — but not in the running
`backend` one: its image ships neither `pytest` nor `tests/`, so `make test` (`docker compose
exec backend python -m pytest`) finds nothing to run. What works (2026-10-06) is a throwaway
container of the same image with the backend folder mounted, through plain `docker run` so the
service's own `DATABASE_URL` is not inherited (the tests point the app at a temporary database
themselves):

```bash
# from the repo root; in Git Bash prefix MSYS_NO_PATHCONV=1
docker run --rm -u 0 -v "$PWD/backend:/src" -w /src -e TELEGRAM_ENABLED=false \
  proiect-backend:latest sh -c 'pip install -q -r requirements-dev.txt && python -m pytest -q'
```

(`make test-local` exists for a local venv, but Docker is the supported path.)

**231 tests** across 9 files: content round-trip and the API surface (`test_api.py`), the
content-migration path (`test_migration.py`), uploads (`test_uploads.py` — magic bytes, SVG
refusal, pixel caps, re-encoding), the Telegram bot (`test_telegram*.py`), the CRM lead push
(`test_crm.py` — HMAC over the exact bytes, outcomes/retries/back-off via
`httpx.MockTransport`, the secret never logged, `/api/contact` still 201 with the CRM down,
the `CRM_LEADS_URL` rules — see [17 — CRM](./17-crm.md)), and the security
suite (`test_security_authz.py`, `test_security_hardening.py`, `test_security_http.py` —
authz/IDOR, oversized → 422, `<script>` stored escaped, invalid email → 422, SQLi inert,
rate limits, headers). Telegram and the CRM push are forced off in tests
(`backend/tests/conftest.py`) so they stay hermetic.

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
