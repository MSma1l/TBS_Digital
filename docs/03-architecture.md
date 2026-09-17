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
├─ postcss.config.mjs      # loads only @tailwindcss/postcss (Lightning CSS does the prefixing)
├─ app/
│  ├─ layout.tsx           # Root: fonts, <html lang data-theme>, JSON-LD, generateMetadata (SEO),
│  │                       #   LanguageProvider + SiteContentProvider
│  ├─ globals.css          # Design tokens (CSS variables) + base styles + keyframes;
│  │                       #   line 1 is the @layer order Tailwind depends on
│  ├─ tailwind.css         # Tailwind v4, utilities only (no preflight), theme mapped onto the
│  │                       #   tokens; used only by the eight files in its @source list
│  ├─ robots.ts            # /robots.txt
│  ├─ sitemap.ts           # /sitemap.xml with hreflang alternates
│  ├─ opengraph-image.tsx  # Generated OG image
│  ├─ twitter-image.tsx    # Generated Twitter card image
│  ├─ (site)/              # Route group for the public site (no URL segment)
│  │  ├─ layout.tsx        # Chrome: the intro gate (IntroPreloader, first child), ScrollProgress,
│  │  │                    #   Navbar, Footer, HudChrome (the HUD's one mount, renders nothing
│  │  │                    #   until armed), CookieConsent, AnalyticsPixel (consent-gated);
│  │  │                    #   imports ../tailwind.css
│  │  ├─ page.tsx          # Landing page: <SceneStage> around Hero → Ticker → Directions → Work
│  │  │                    #   (with the server-rendered art slots), then Principles, Team,
│  │  │                    #   RequestSection, BottomCTA
│  │  ├─ confidentialitate/ # Privacy policy (content.ts + LegalDoc)
│  │  └─ cookies/          # Cookie policy (content.ts, reuses LegalDoc)
│  └─ admin-tbs-digital/   # Admin panel route (outside the (site) chrome)
│     ├─ page.tsx          # Login gate + tabbed content editor
│     └─ admin.module.css
│
├─ components/
│  ├─ intro/               # First-visit preloader — see "The first-visit intro" below
│  │  ├─ IntroPreloader.tsx + .module.css  # tier 1, the shell: server-rendered overlay, the one
│  │  │                    #   post-hydration decision, skip inputs, scroll lock, watchdog
│  │  ├─ IntroFallback.tsx # SVG ∞, CSS-only animation (no WebGL, and before hydration)
│  │  ├─ IntroDirector.tsx # tier 2 (GSAP): progress, burst, page entrance, scene lifecycle
│  │  ├─ IntroScene.tsx · InfinityCore.tsx · OrbitParticles.tsx   # tier 3 (three + R3F), reached
│  │  │                    #   only through components/three/runtime.tsx
│  │  ├─ capability.ts     # the intro's gates, then the shared GPU probe; tiers.ts: TIER_CONFIG
│  │  ├─ lemniscate.ts · fx.ts  # pure: the ∞ curve; the director ↔ scene contract
│  │  └─ three/            # imperative three.js, no React: geometry · materials · environment
│  │                       #   (procedural PMREM) · core · particles · rig (motion) · random —
│  │                       #   re-exporting what moved to components/three/
│  ├─ three/               # 3D helpers shared by the intro and the interior scene — no scene of
│  │  │                    #   their own (see "The interior stage" below)
│  │  ├─ runtime.tsx       # THE lazy entry for three.js + R3F: re-exports IntroScene and
│  │  │                    #   SceneCanvas; only ever import()ed, never statically
│  │  ├─ capability.ts     # the site's one GPU probe (no three.js), DPR clamp
│  │  ├─ renderer.ts · hooks.ts   # create / compile / retain / release the WebGLRenderer
│  │  ├─ governor.ts       # the FPS governor (dpr → lite, and the interior's opt-in bail)
│  │  ├─ environment.ts    # procedural PMREM + the transmission clear (colour-space compensated);
│  │  │                    #   the intro's glass only — the interior has no environment since the chip
│  │  ├─ motion.ts · random.ts · palette.ts · glow.ts
│  │  └─ RenderErrorBoundary.tsx  # catches a render error in either scene (was IntroErrorBoundary)
│  ├─ scene/               # the interior stage (home page only)
│  │  ├─ SceneStage.tsx    # Tailwind; the stage wrapper, the loading pipeline, pause, attributes
│  │  ├─ SceneCanvas.tsx · SceneWorld.tsx   # the R3F canvas and world (three + R3F, lazy)
│  │  ├─ SceneDirector.tsx # GSAP + ScrollTrigger (lazy): measures the scroll, desktop parallax
│  │  ├─ scrollGuard.ts · scrollProbe.ts   # smooth-scroll guard, quiet/wake, parallax targets;
│  │  │                    #   the writes into the scroll probe
│  │  ├─ choreography.ts · fx.ts · tiers.ts · input.ts · trail.ts · pixelRatio.ts · shapes.ts
│  │  │                    #   pure placement/morph maths (and the helix's: placeHelixSpiral,
│  │  │                    #   placeHelixAmbient, HELIX_SLOT, HELIX_AMBIENT, HELIX_REACH), per-frame fx
│  │  │                    #   and the timed gates (services entry, Work handoff), tier budgets, pointer and
│  │  │                    #   gyroscope tilt (a mouse or pen also writes the cursor trail), the
│  │  │                    #   cursor trail's ring buffer, the DPR watcher, model geometry shared
│  │  │                    #   with the art (the chip: CHIP, CHIP_POSE, chipTraces, chipPins; the
│  │  │                    #   helix: HELIX, HELIX_ANGLE)
│  │  ├─ helix.ts · workHelix.ts   # Work's spiral: the pure layout (WORK_HELIX_MEDIA, HELIX_LAYOUT,
│  │  │                    #   helixLayout, focusFromProgress, scrollForCard, nearestCard) and the
│  │  │                    #   framework-free DOM driver that lays the project cards out round the
│  │  │                    #   helix (createWorkHelixDriver) — see "The project DNA helix" below
│  │  ├─ three/            # imperative three.js: world (+ stageHelix) · core (the hero
│  │  │                    #   microprocessor) · swarm · trail (the cursor trail's ribbon) ·
│  │  │                    #   materials (five programs, P2–P6) · glsl · palette · samples (slot 0:
│  │  │                    #   helixSamples) · compile (staged build, frame-counted ready) ·
│  │  │                    #   hologram (Work's Canvas2D hologram texture) ·
│  │  │                    #   models/{cubes,commerceLoop,integrationHub,neural,meshWave,helix}
│  │  └─ art/              # static SVG art, CSS Modules, no "use client": HeroCoreArt (+ heroArt.ts)
│  │                       #   and ServiceArt (+ serviceArtPaths.ts)
│  ├─ fx/                  # DOM hooks: useOffscreenAttribute (data-offscreen) · usePointerTilt
│  ├─ hud/                 # the IT-OS HUD chrome: HudChrome.tsx, its one mount (in the (site)
│  │  │                    #   layout since Phase 4) — gate (tbs_hud ≠ off → consent → first
│  │  │                    #   interaction → intro gone → idle), then its lazy parts in one commit.
│  │  │                    #   CSS Modules only; lucide-react may be imported only here
│  │  └─ guide/            # Ghid TBS (Phase 4, a next/dynamic part): GuideAssistant.tsx (avatar,
│  │                       #   tip, centre-line observer, away/yield) + .module.css, copy.ts
│  │                       #   (GUIDE_COPY as { ro, ru, en } objects; no directive, e2e imports it)
│  ├─ layout/              # Navbar (Tailwind) · HeaderClock (Tailwind) · Footer
│  ├─ sections/
│  │  ├─ Hero.tsx          # hero (Tailwind) — HUD backdrop, the core's anchor, h1, neon CTA,
│  │  │                    #   holographic stat cards
│  │  ├─ Ticker.tsx        # the trust ticker under the hero (Tailwind)
│  │  ├─ Directions.tsx    # the direction chooser (Tailwind): pills, preview, HUD screen
│  │  ├─ Work.tsx          # the portfolio's HUD cards (Tailwind): tilt, CSS parallax; the grid is
│  │  │                    #   `data-work-track`, which the scene turns into the helix spiral
│  │  ├─ Principles.tsx    # principles grid + stats row
│  │  ├─ RequestSection.tsx · BottomCTA.tsx · DirectionPage.tsx (the /servicii/<slug> pages)
│  │  ├─ Team.tsx          # team + system-status panel
│  │  ├─ Estimator.tsx     # the request flow (RequestSection, and the request dialog)
│  │  └─ Services.tsx · Partners.tsx   # not rendered by any page today
│  └─ ui/                  # SectionLabel · Reveal · ScrollProgress · SectionCTA ·
│                          #   LanguageSwitcher · CookieConsent (Tailwind) · AnalyticsPixel ·
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
│  ├─ intro.ts             # The intro contract: cookie, events (tbs:intro-done, tbs:intro-gone),
│  │                       #   overlay id, timings, reveal targets, shouldPlayIntro / finishIntro /
│  │                       #   onIntroDone / onIntroGone (no DOM at import)
│  ├─ clock.ts             # SYS_TIME: Chișinău time + real UTC offset, one shared 500ms store
│  ├─ scrollLock.ts        # Reference-counted <html> scroll lock (burger menu + intro) and the
│  │                       #   page cover (coverPage, tbs:page-cover), held by every lock
│  ├─ scene.ts             # The interior stage contract: QA flag, gates, data-* names, directions →
│  │                       #   models, the page → scene input store, the scroll probe; Work's
│  │                       #   WORK_TRACK_ATTR, SceneHelixMode / SceneHelix, SCENE_LAYOUT_EVENT
│  ├─ gpuProbe.ts          # The GPU probe's session cache (tbs_gpu_probe) + decideWebGL; no imports
│  ├─ device.ts            # Device profile, detectTier (intro), detectSceneTier (interior)
│  ├─ idle.ts              # afterIdle: visible-time delay + an idle slot
│  ├─ tapIntent.ts         # first tap opens, second navigates (header dropdowns, direction pills)
│  ├─ tilt.ts · hologram.ts  # pure tilt maths; the stat holograms' edges and rings
│  ├─ visibleTimeout.ts    # setTimeout that only counts visible-tab time, fires once
│  ├─ hud/                 # the HUD chrome's pure logic, no DOM at import (2026-09-17):
│  │                       #   gate.ts (tbs_hud QA key, arming events, desktop media; import-free,
│  │                       #   playwright.config.ts imports it) · busy.ts (the "busy with the HUD"
│  │                       #   store) · obscure.ts (covers / overlaps, focus-not-obscured guards) ·
│  │                       #   topics.ts (the guide's topic ids) · linger.ts (Phase 4: the guide's
│  │                       #   limits, memory store, canPrompt / pickTopic / isTypingTarget; pure)
│  ├─ request/             # RequestFlowProvider.tsx (the one request dialog; RequestContext,
│  │                       #   RequestSource, RequestAttachment) · catalog.ts (the estimator's
│  │                       #   project types and options with stable ids, SERVICE_FOR_TYPE) ·
│  │                       #   attachment.ts (a HUD tool's block, cleaned and capped at 1,200)
│  ├─ theme/               # theme.ts (DEFAULT_THEME = "dark", cookie, inline init script) ·
│  │                       #   ThemeProvider
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
nonce and locale (see `proxy.ts`). It also stamps `data-theme` on `<html>` for every route,
the admin included: the visitor's `tbs_theme` cookie if it says `light`, otherwise the dark
default (`lib/theme/theme.ts`).

## The first-visit intro

A full-screen HUD preloader plays once per browser session, on a hard load of the home page.
Behaviour, phases and bypass rules are in [05 — Page Sections](./05-page-sections.md); this is
how it is wired.

### The gate — `app/(site)/layout.tsx`

```ts
shouldPlayIntro(requestHeaders.get("x-pathname"), (await cookies()).get("tbs_intro")?.value)
// true only for x-pathname === "/" (proxy.ts strips /ru and /en, so they count) and no
// tbs_intro=seen cookie
```

When it is true the layout renders, as its **first children**, a `<noscript><style>` that
hides `#tbs-intro` and `<IntroPreloader />`. Why the layout and not `page.tsx`:

- **A layout is not re-rendered on client navigation inside its group**, so the overlay only
  ever comes from a hard load — never after `/servicii/x` → Home, never on a Back into the
  router cache.
- A client navigation **into** the `(site)` group from outside it (the admin's "view site"
  link) does render the layout fresh, gate and all. The shell therefore only acts when it is
  hydrating server HTML (`useSyncExternalStore`'s server snapshot, frozen at mount); a
  client-rendered mount renders nothing, sets no cookie and fires no event.
- Being first in the DOM makes its skip button the first Tab stop.
- Unit tests don't render layouts, so no component test sees an overlay.

### Three loading tiers

```
(site)/layout.tsx ─► IntroPreloader  (client; server-rendered; no GSAP, no three.js)
                       │  after hydration, decision = "run":
                       ├─► import("./capability")  (~1 KB chunk) → probeIntroCapability()
                       │     └─ webgl? ─► import("@/components/three/runtime")  (three + R3F, warms the cache)
                       └─► next/dynamic ssr:false ► IntroDirector (gsap, @gsap/react)
                                                      └─ next/dynamic ssr:false ► runtime → IntroScene
```

- A **returning visitor** gets no overlay from the server and downloads neither GSAP nor
  three.js; reduced motion bypasses before the director is ever requested.
- The shell probes the device **once** and passes the answer to the director as its
  `capability` prop (the probe itself is the site's shared one, `components/three/capability.ts`,
  and its answer is cached for the tab in `sessionStorage.tbs_gpu_probe`, which the interior stage
  reads too). When WebGL is usable it requests the three.js chunk itself — the shared
  `components/three/runtime.tsx`, the interior stage's target too — in the same tick as the
  director, so the scene never waits for the director to download, run and render
  first; the director's own `dynamic()` then resolves from the module cache. (The director
  chunk is deliberately not requested before the probe: Turbopack gives that import its own
  chunk group and duplicates `capability.ts` into it.)
- `next/dynamic` with `ssr: false` only code-splits from a Client Component, which is why the
  shell is `"use client"` and owns the first `dynamic()` call.
- The shell's CSS Module is merged into the render-blocking layout CSS of every `(site)` page,
  whether or not an overlay renders — the cost of gating in the layout, and part of the
  returning-visitor weight budget recorded in `CHANGELOG.md`.

### Who owns what

| Piece | Owns |
|-------|------|
| `lib/intro.ts` | Names and timings (`INTRO_TIMING`), the reveal targets (`INTRO_REVEAL_ORDER`), the server gate, and the one "done" signal: `finishIntro({ played })` writes the session cookie and dispatches the event, idempotently, behind a module flag |
| `IntroPreloader` (shell) | The overlay markup, the post-hydration decision (bypass or run), scroll lock, skip inputs, the visibility-aware watchdog, the safety-net unmounts |
| `IntroDirector` | Progress, the burst, the page entrance (GSAP writes straight to the DOM, never React state per frame), the scene's lifecycle |
| `IntroScene` + `three/*` | Drawing; reports `onReady` / `onLost` and never touches the page |

Every part the director drives is found under the overlay by `data-part`; every entrance
target on the page by `data-intro-reveal`.

## The interior stage

The home page's first four sections — Hero, Ticker, Directions, Work — scroll over **one** WebGL
canvas: the hero's neon microprocessor (the chip), which dissolves as the hero leaves; the
selected direction's model, which bursts out of a point and assembles once the visitor reaches
the services; a cursor circuit trail behind a mouse or pen; and Work's DNA helix, which the
project cards turn round from 768px (a small helix lying above Work's heading below that).
Devices that should not draw it get static SVG art in the same places (no trail, and Work's
cards as the server rendered them).
What the visitor sees is in [05 — Page Sections](./05-page-sections.md#interior-stage-3d);
the styling rules in [04 — Design System](./04-design-system.md#the-interior-stage); the coding
rules in [07 — Conventions](./07-conventions.md#3d-gsap-and-the-interior-stage).

### The DOM (`app/(site)/page.tsx`, `components/scene/SceneStage.tsx`)

```
<main>
  SceneStage   div[data-scene-stage][data-testid="scene-stage"]  .relative.isolate
    div[aria-hidden]  .absolute.inset-0           ← the track: no layout height, so no section moves
      div[data-scene-layer]  .sticky.top-(--header-h).h-scene.overflow-hidden
        (WebGL path only) RenderErrorBoundary
          div  opacity 0 → 1 once data-renderer="webgl" (500ms)  → SceneCanvas   (three + R3F)
          SceneDirector                                             (GSAP; renders nothing)
    Hero        section#top … [data-testid="scene-hero"] > [data-scene-anchor="hero"] > the core art
    Ticker
    Directions  #servicii … [data-testid="scene-services"] > [data-scene-anchor="services"] > the art
    Work        section#lucrari … heading block + div[data-work-track] > a | article   ← the cards
  Principles · Team · RequestSection · BottomCTA        ← outside the stage
```

- The track is positioned and first in tree order, so every positioned section after it paints
  on top of the canvas; the hero's opaque plate (`-z-20`) and backdrop (`-z-10`) sit below it
  inside the stage's stacking context (`isolate`), which keeps the whole stage under the header,
  the burger overlay and the cookie banner without a new z-index token.
- The same stacking context holds Work's spiral: a sticky card the scene gives a negative
  `z-index` paints in the stage's negative layer, **under** the canvas track; one with a positive
  `z-index` paints over it — real depth round the helix.
- **No `transform`, `filter`, `contain` or `overflow` on the stage, on any ancestor of the
  layer or on any ancestor of Work's cards** — each one breaks `sticky` (or that depth).
- The canvas is `pointer-events: none` (R3F writes `auto` inline; the canvas style overrides it)
  and R3F's pointer events are unused: tilt comes from passive `window` listeners.

### Loading pipeline

```
SceneStage (client, in the page bundle — no three.js, no GSAP)
  mount ─ readSceneFlag · detectSceneTier(readDeviceProfile()) · readMotionGate()
  │         off (flag, reduced-motion, save-data, network) │ fallback (unsupported, low-tier) │ wait
  └─ onIntroGone ─► afterIdle(1500ms of visible time [+600ms after an intro] + an idle slot)
        └─ readGpuFacts(mode)  ← sessionStorage.tbs_gpu_probe
             └─ none cached ─► import("@/components/three/capability") → probeGpu(mode)
        └─ decideWebGL(facts, force) ─► fallback(reasonFor) │ loading, in ONE commit:
             ├─ next/dynamic ssr:false ► import("@/components/three/runtime") → SceneCanvas
             └─ next/dynamic ssr:false ► import("./SceneDirector")  (gsap + ScrollTrigger)
  SceneCanvas onReady (built + compiled in idle slices, then 2 drawn frames)
    ∧ SceneDirector onLive (first measurement) ─► data-renderer="webgl", the art crossfades out
```

- `mode` is `forced` when `localStorage.tbs_scene_3d = "force"` (QA and E2E: software renderers,
  the low tier and a slow device are all accepted, and the governor never bails), else `strict`
  (`failIfMajorPerformanceCaveat`, software renderers refused).
- **One three.js chunk for the whole site.** `components/three/runtime.tsx` re-exports
  `IntroScene` and `SceneCanvas` and is the only `import()` target either scene is reached
  through. Turbopack builds a chunk group per `import()` target and shares no vendor chunk
  between groups, so two targets had shipped two byte-identical copies of three + R3F; a first
  visitor who downloaded it for the intro now gets it from cache for the stage.
- The delay after an intro is the time R3F takes to release the intro's context: the two scenes
  never hold a WebGL context at once.
- **Runtime transitions** (all for the mounted attempt only): reduced motion switched on → `off`
  for the visit; a context lost while visible, or a governor bail → `fallback` for the rest of
  the session (`markGpu("lost" | "slow")` in the probe cache); a context lost while the tab is
  hidden (iOS backgrounding) → `pending`, and one remount when it is visible again; a render
  error → `fallback`/`error`.
- **Paused** — `frameloop="never"`, context kept — while the stage is off screen
  (IntersectionObserver), the tab is hidden, or the page is covered (`isPageCovered()`). A
  paused canvas draws nothing, so it cannot become ready: a scene that loads off screen keeps
  its art until it has really drawn.

| `data-renderer` | When | `data-reason` |
|-----------------|------|---------------|
| `pending` | the server render, waiting for the intro / idle / probe, loading, a hidden-tab retry | — |
| `off` | `tbs_scene_3d=off`, reduced motion, Save-Data, a 2G connection | `flag` · `reduced-motion` · `save-data` · `network` |
| `fallback` | no `ResizeObserver`, the low tier, the probe said no, a lost context, a bail, an error | `unsupported` · `low-tier` · `no-context` · `software` · `lost` · `slow` · `error` |
| `webgl` | the scene drew and the director measured, for the same attempt | — |

Also on the stage root: `data-tier` (from mount; `mid` while a forced low-tier device loads),
`data-motion` (`live` only with every gate open and a tier above low — the holograms key off
it), `data-paused` (only while `webgl`). Written straight to the DOM, never through React
state: `data-boost` (a hero CTA is boosted), `data-quality` (`full|dpr|lite`, once the governor
steps), `data-morph` (`running|idle`), `data-entry` (`idle|burst|formed`, the services entrance
as the scene draws it — see [below](#the-services-entrance-it-os-phase-2-2026-09-17)),
`data-helix` (`spiral|ambient`, the mode Work's helix is in while the scene lays the cards out or
draws the small helix — see [below](#the-project-dna-helix-it-os-phase-3-2026-09-17)), and the
director's `data-scroll-fx` (`on` once measured). `data-quality`, `data-morph`, `data-entry` and
`data-helix` belong to the mounted scene: they are removed with it, so a `fallback` or `off` stage
never carries them. On a card, `data-helix-front` marks the spiral's front card (or, in ambient
mode, the card nearest the band's middle).

### Who owns what

| Piece | Owns |
|-------|------|
| `lib/scene.ts` (+ `lib/gpuProbe.ts`) | The contract: `SCENE_3D_KEY`, the live gates (`readMotionGate`), the probe cache and `decideWebGL` / `reasonFor`, the `data-*` names and test ids, `SCENE_SHAPES` → `SERVICE_MODEL`, the input store, the `ScrollProbe` type, `SCENE_TIMING`, `PARALLAX_MEDIA` / `PARALLAX_LAYERS`, `WORK_TRACK_ATTR`, `SceneHelixMode` / `SceneHelix`, `SCENE_LAYOUT_EVENT`. No `"use client"`, no DOM at import (server components and `e2e/helpers.ts` import it) |
| `SceneStage` | The pipeline and its state, pausing, the React-written attributes and the DOM-written reports (`data-helix` included), the error boundary, the session marks |
| `SceneDirector` + `scrollGuard.ts` / `scrollProbe.ts` | ScrollTrigger: the four measuring triggers (`heroExit`, `entry`, `workSpan`, `helix`), when to refresh, re-reading the boxes on `SCENE_LAYOUT_EVENT`, no measurement under a cover, the smooth-scroll guard, quiet/wake, the desktop hero parallax |
| `SceneCanvas` / `SceneWorld` + `three/*` | Drawing: renderer and DPR (`pixelRatio.ts`), palette and theme observer, tilt listeners (`input.ts`), the staged build and compile, the frame-counted ready, the governor, the services entry gate and the Work gate, Work's helix (built after ready) and its hologram. Reports `onReady` / `onLost` / `onBail` / `onQuality` / `onMorph` / `onEntry` / `onHelix`. It touches the page in **one** place only: in spiral mode the scene chunk's driver (`workHelix.ts`, created by `SceneWorld`, called by the world every frame, disposed with it) writes Work's cards' inline layout, and puts every card back when it leaves |
| `helix.ts` / `workHelix.ts` | The spiral's pure layout; the DOM driver: which mode, when it may switch, the cards' inline poses, focus, the restore contract |
| `Hero`, `Directions` | The anchors the scene fits its models into, the art slots, and the inputs: `setSceneBoost` (CTA hover / keyboard focus), `selectSceneShape` (the selected pill) |
| `Work` | The cards as React renders them (`--p1` / `--p2` inline, nothing else) and the track attribute (`data-work-track`); it knows nothing of the spiral, and React re-renders never undo it (they diff only React's own style keys) |
| `components/scene/art/*` | The static drawings (server-rendered first, see below) |

### Stores and channels

- **The scroll probe** — a plain mutable object the stage creates once and hands to both halves.
  The director writes it at every ScrollTrigger refresh; the scene reads it, with
  `window.scrollY`, once per frame. No React state, no events. Its shape (`ScrollProbe`,
  `lib/scene.ts`): `live`, `version`, `headerH`, `layerH` (the sticky layer's height),
  `stage: { top, bottom }`, `hero` and `services` (document boxes, null while the anchor is not in
  the page), `work` (Work's card track), `workHead` (its heading block, eyebrow to lead, the
  scroll reveal's `translateY` taken out) and `workGap` (the free band above that heading: from the
  previous section's content end — its bottom less its bottom padding — to the heading's top, as
  wide as Work's section), and four scroll spans — `heroExit` (`#top` "top top" →
  "bottom 35%", a progress the chip's exit follows), `entry` (the services anchor "top 90%" →
  "top 75%", the band the services entry gate arms and disarms over; not a progress), `workSpan`
  (the track "top 70%" → "top 55%", the Work gate's band) and `helix` (the track "top top" less the
  header → "bottom bottom"; ScrollTrigger clamps an end before its start, so a phone's band ends at
  its top). The scene can also say it changed the layout itself: `SCENE_LAYOUT_EVENT`
  (`tbs:scene-layout`, a plain `Event` on the stage root) makes the director re-read every box at
  once — no refresh, which would stop a touch fling — while the stage's resize refresh follows for
  the spans. Never under a cover.
- **The scene input store** (`lib/scene.ts`) — `{ boost, waveSeq, shape }`, a frozen snapshot
  replaced on every change (so it works with `useSyncExternalStore`). `boost` is 1 while any CTA
  source is active; `waveSeq` counts only the 0 → 1 edges, so moving between the two CTAs never
  starts a second light wave. The scene reads it every frame; the stage subscribes and toggles
  `data-boost`, which the static art's wave keys off. A module store, not a `window` event.
- **`tbs:intro-gone`** (`lib/intro.ts`) and **`tbs:page-cover`** (`lib/scrollLock.ts`) — see
  [Data flow](#data-flow) below.
- **The scene's fx** (`fx.ts`, one per canvas) — the tilt targets the listeners write, what the
  world smooths every frame, the services entry gate (`fx.entry`), the Work gate (`fx.work`), and
  the cursor trail's ring buffer (`fx.trail`). `input.ts` pushes a
  segment for a **mouse or pen** move only (in the fine-pointer branch): `pushTrail` snaps the
  point to a 20px **document** grid (`clientX + scrollX`, `clientY + scrollY`, `event.timeStamp`)
  and marks the slots it wrote; `three/trail.ts` uploads just those slots and draws.

### The hero chip and the cursor trail (IT-OS Phase 1, 2026-09-17)

- **The chip is built from the programs the scene already had** (`three/core.ts`,
  `createChipCore`): instanced box edges (P3) for the substrate, heat spreader, die frame and pins;
  the plasma die top (P2); lines (P4) for the vias, bevel, pin-1 notch and die grid; flat trace
  ribbons carrying packets (P5); a square light wave (P4) only while a boost wave runs. The
  interior has **no** transmission glass, frost shader, PMREM environment or transmission pass any
  more — `components/three/environment.ts` stays for the intro. Draws per frame at the top of `/`:
  4 (the glass core drew 10 on high, 8 on mid).
- **Geometry lives in `shapes.ts`** (`CHIP`, `CHIP_POSE`, `chipTraces(perSide)`,
  `chipPins(perSide)`), shared by the WebGL chip and the static art (`art/heroArt.ts`, one
  projection matrix). `CHIP.R` is the old core's radius (2.45), so every host fit is unchanged.
  The pin's box is `CHIP.pinSize`, never `pin`: `scene-contract.test.ts` scans
  `components/scene/**` for GSAP pinning and would read the key as a ScrollTrigger pin.
- **Along the hero exit** the chip shrinks, lifts apart (`coreExitPose().lift`: heat spreader and
  die rise off the substrate) and dissolves (`coreReveal`); it no longer drifts to the services
  host, and no swarm carries it anywhere: the chip has no swarm slot, and slot 0 is the Work
  helix's silhouette since Phase 3 (`helixSamples`).
- **The cursor trail** is one more part (built after the swarm, compiled in its own slice): one P5
  ribbon of `TRAIL.cap` (64) segments × 6 vertices in document px, drawn over the rest of the scene
  (render order 9, no depth test), and only while a segment is still fading (`TRAIL.life` 0.9s).
  Per frame only its uniforms and transform change; a pause over 0.35s or a jump over 12 cells
  starts a new chain without a segment.
- **Decision record (D-I).** The hero no longer shares geometry with the intro: the old core's
  rings were tied to the intro's orbits (`RING_TILTS` / `RING_OMEGA` ≡ the intro's `ORBITS`, pinned
  by a unit test). `CORE`, `RING_TILTS`, `RING_OMEGA` and that test are gone; the intro keeps its own
  `ORBITS` in `components/intro/`.

### The services entrance (IT-OS Phase 2, 2026-09-17)

The chip used to be scrubbed into the services model by the scroll: the swarm's progress was the
scroll position, so a visitor who stopped reading half-way left the model half-formed — the
brand-ui wave read as noise. The entrance is now a **timed gate** (decisions D-C, D-G):

- **The band** — the director's `entry` trigger on the services anchor, "top 90%" → "top 75%",
  measured into `probe.entry` (`writeEntrySpan`). Animation-free, like `heroExit`.
- **The gate** (`fx.ts`, pure): `Gate = { value, armed }`, stepped every frame by
  `stepGate(gate, scrollY, span, step, ENTRY_SECONDS, instant)` (never a parameter named `snap`:
  `scene-contract.test.ts` reads `snap:` under `components/scene` as ScrollTrigger's). Hysteresis: it arms once `scrollY`
  reaches the band's end and disarms only above its start; in between it keeps what it has.
  `value` runs in **time**, not scroll: 0 → 1 in `ENTRY_SECONDS.form` (1.1s) while armed, back in
  `.unform` (0.45s) while not — on the clamped frame step, so SwiftShader's 20 Hz clamp makes it
  at least 22 frames. `stepSceneFx(fx, dt, input, heroExit, scrollY, entrySpan, workSpan)` snaps
  the gate on the first frame (a deep link into the services finds the model formed), keeps it
  shut while the services anchor is not measured (`entrySpan` null), and snaps a disarmed gate to
  0 once the page is back at the hero (`heroExit` 0). (`workSpan` and the Work gate came with
  Phase 3, [below](#the-project-dna-helix-it-os-phase-3-2026-09-17).)
- **The composition** (`composeScene(entry, work, morph, out)`, `choreography.ts`): below 1 the
  entrance owns the swarm — `from = BURST` (−1, not a slot), `to = 1 + selected`, `t = entry` —
  and the model is revealed by `smoothstep(.72, 1, entry)`; the pill morph is instant meanwhile.
  At 1 the morph owns the swarm as before (unless the Work handoff has it: `work` > 0). Both ends
  meet continuously (unit-tested): the swarm's alpha reaches 0 exactly as the model's reveal
  reaches 1.
- **The burst** (`world.ts`, `swarm.ts`, no shader change): a `BURST` plan uses the selected
  model's slot at both ends; the `from` matrix shrinks it to a speck at the services host's centre
  (`BURST_SPECK`: scale × 0.05, a cloud 1.35 × the model's radius so it overshoots and converges,
  sprites from half size). The shader's leave → cloud → arrive then reads as an explosion out of
  the centre that assembles into the model; scrolled back above, it implodes the same way.
- **A model's own cycle waits for it to form.** The world passes a model `step = 0` while its
  reveal is below 1 (its clock is reset at the first reveal), so the swarm lands on the model's
  starting pose and every loop starts at formation: the cubes hold their block for the whole
  1.4s hold after `formed`, then run their explode → float → re-assemble loop (7.2s,
  `models/cubes.ts`) — scattered cubes a couple of seconds after `formed` are that loop, not a
  half-formed entrance. The same applies to a model a pill morph reveals.
- **`data-entry`** (D-G) — the scene, not the director, knows when the model has formed. From the
  first frame after ready, `SceneWorld` reports `entryState(fx.entry.value)` through `onEntry`
  (`SceneCanvasProps`) on a change only: `idle` at 0, `burst` in between (either direction),
  `formed` at 1. `SceneStage` writes it on the stage root and removes it with the scene; the
  Directions panel's edge glow and glass sweep (`entry-glow`, `entry-sweep` in `app/tailwind.css`)
  key off it. Nothing is written while the art shows (`pending`, `fallback`, `off`).

### The project DNA helix (IT-OS Phase 3, 2026-09-17)

The client asked for the **existing project cards** to turn round a DNA helix ("cardurile cele să
fie la ADN"). Work (`#lucrari`) is now inside the stage, and the scene chunk lays its cards out
round a 3D helix. **Decision record:** decision R1 of the IT-OS critique, "Work gets no 3D model",
is superseded by the client's decisions 10 and 12.

- **Modes** (`SceneHelixMode`, reported through `onHelix` and written as `data-helix` on the
  stage root): `spiral` — the helix built, at least `HELIX_MIN_CARDS` (3) cards and
  `WORK_HELIX_MEDIA` = `(min-width: 768px) and (min-height: 600px)`; `ambient` — the helix built
  otherwise (phones, a short window, fewer cards): the grid or band stays exactly as it is and a
  small helix lies in the band above Work's heading; `off` — before the helix is built, without the scene, or
  after an error (`wantedHelixMode`, `helix.ts`). The default path (`pending`, `fallback`, `off`
  renderer, reduced motion) creates no driver at all: no attribute, and every card as the server
  rendered it.
- **The driver** (`workHelix.ts`, `createWorkHelixDriver({ track, section, probe, onMode })`) is
  framework-free — no React, no three.js. `SceneWorld` creates it for the scene's whole life and
  hands it to the world (`attachWork`); the world disposes it, so every way the scene goes (a
  bail, a lost context, an error, reduced motion, leaving the page) puts the cards back. Each
  frame the world asks it for the focus (`focus(scrollY)`), turns the helix to it, then calls
  `write({ focus, built })`, which applies the wanted mode when it may and lays the cards out for
  that same focus — the helix and the cards never disagree by a frame.
- **Safe switching.** Into the spiral **only while Work is below the viewport**: the track grows
  by thousands of px, and below the visitor that moves nothing they see. The section's rect is
  read in the frame that would lay it out; an IntersectionObserver on the section only vetoes
  while it says Work is on screen (it never fires for an instant jump across Work, so it cannot
  decide alone). A reload or deep link inside Work keeps the grid until the visitor is back above
  it. **Out of it at once** (the media query stops matching, fewer cards, the helix gone,
  dispose, an error), with the scroll put back under the visitor: inside the spiral, to the
  focused card's grid position (`top − headerH − 24`, instant); past its end, keeping whatever
  follows the track still.
- **The sticky-card spiral.** On entry the track becomes one tall grid cell (`display: grid`,
  `grid-template-columns: 100%`, one row of `sceneH + (n − 1) · helixStep(innerHeight)`, the step
  `clamp(240px, 38% of the viewport, 380px)`), and every card a `position: sticky` item in it:
  `grid-row/column-start: 1` (which also cancels the odd last card's `col-span-2`),
  `align-self: start`, `justify-self: center`, width `clamp(240, 0.27·w, 340)`,
  `min-height: min(0.36·sceneH, 260)` — **never a `height`**: a card clips with `overflow: hidden`
  and a touch screen always shows its description, so its content decides how tall it is — `top`
  centring its measured box (`offsetHeight`) in the layer under the header (a card taller than the
  layer starts right under it; a ResizeObserver on the cards centres them again when their content
  changes, e.g. a locale switch or a hover revealing the description; Work lifts its description's
  `max-h-35` cap inside the spiral for the same reason), `margin: 0`, and `transition-property: translate, box-shadow, border-color` (Work's 300ms
  `transform` transition would make the cards trail the helix). Per frame, only when the focus
  moved: `transform: translate3d(x, y, 0) scale(s)`, `z-index`, `opacity` and `pointer-events`,
  from `helixLayout(i, focus, w, sceneH)` — card `i` sits `d = i − focus` steps along the strand,
  `d · HELIX_ANGLE` (2π/9, the step the model turns by too) round it and `0.18 · sceneH · d` down
  it, its x clamped `helixEdge(w)` inside the zone (16px, plus 44px from 861px for the Phase 5
  rail). The focus is the scroll's progress over the driver's own span (the track's top under the
  header → its bottom at the viewport's), `× (n − 1)`.
- **Paint order and hits.** A card facing the visitor (`cos θ ≥ 0`) gets `z-index` 1…11 and
  `pointer-events: auto`: it paints over the canvas and takes the click. One behind the strand
  gets −1…−9 and `pointer-events: none`: it paints under the canvas track (the stage's `isolate`
  makes that real depth) and never takes a click. `data-helix-front` marks the card at the
  rounded focus.
- **The restore contract.** Every property is inline, and every card's (and the track's)
  original `style` attribute comes back **byte for byte** (`--p1` / `--p2` exactly as React
  rendered them), saved as the attribute string when the spiral was entered. Should someone else
  have changed the style meanwhile (a tilt in progress, new admin colours), only the driver's own
  longhands are removed. Blink serializes a CSSOM-written style lazily: removing the attribute
  while that is pending left `style=""` behind, so the driver reads the attribute first. React
  re-renders (a locale switch) diff only React's own style keys, so the layout survives them.
- **Focus.** Tabbing to a card scrolls to where it is the focus (`scrollForCard`, the page's own
  `scroll-behavior`), so it comes to the front; a card holding focus is fully opaque. A focus a
  pointer press caused (within 800ms) scrolls nothing. Tab order, `inert` and `aria-hidden` are
  never touched.
- **A new card list.** A `MutationObserver` on the track's `childList` catches a re-keyed list
  (`/api/content` replacing the seed): the cards are collected again and laid out again — still
  three or more in the spiral, otherwise ambient.
- **Errors.** Any exception inside the driver restores everything and leaves it `off` for good.
  An exception in the helix's frame (`failHelix`, `world.ts`) — which never reaches the stage's
  error boundary — lets the driver go (the cards come back), hides the helix and logs once; the
  rest of the scene draws on. A helix that fails to build leaves the cards as they are.
- **`SCENE_LAYOUT_EVENT`.** A mode change grows or shrinks the track at once, and the director's
  resize refresh for it may wait for a scroll to end. So the driver's `onMode` dispatches
  `tbs:scene-layout` on the stage root, and the director re-reads every box into the probe then
  and there (never under a cover); the refresh still follows for the spans.
- **The Work gate** (`fx.work`, `WORK_SECONDS` = 1.2s to form, 0.5s back): a second timed gate
  like the services entrance, over the director's `workSpan` band (the track "top 70%" →
  "top 55%"). It only ever opens onto a helix that can be drawn: `stepSceneFx` gets the band only
  while the helix is built, the driver's mode is not `off` and the track is measured — otherwise
  it stays shut, and an open one closes in time. `composeScene(entry, work, morph, out)`: with
  `work` > 0 the selected model's swarm flies from its slot to `HELIX_SLOT` (0), the model dissolves
  over the first 30% and the helix forms over the last 30%; at 1, the helix alone. While the Work
  gate is armed the entry gate sits on its armed value (no burst plays hidden behind the helix),
  and an entry gate disarmed above the services snaps an open Work gate shut. The first frame snaps
  both, so a deep link into Work finds the helix formed. With no helix placed to land on, the
  swarm stays hidden.
- **Placement** (`choreography.ts`). Spiral: `placeHelixSpiral` — its axis at `HELIX_LAYOUT.cx`
  (0.34) of the track's width, the axis the cards orbit; centred on the sticky zone
  (`helixZoneTop`: under the header, never above the track's top nor below its bottom);
  `HELIX_ZONE_FILL` (0.9) of the zone tall; a rigid follow, since the zone is stuck while the
  cards turn. Ambient: `placeHelixAmbient` — lying down (`HELIX_AMBIENT_ROLL`) in
  `probe.workGap`, the free band between the Directions panel and Work's eyebrow (Directions' 36px
  bottom padding plus Work's 48px top padding on a phone), centred on it, `HELIX_AMBIENT.length`
  (0.6) of the canvas's width long and at most `HELIX_AMBIENT.maxPx` (120px) — or the band less
  `HELIX_AMBIENT.clear` (10px) above and below — tall, measured with `HELIX_REACH` (1.26: the bits
  drift further from the axis than the strands). Both modes draw at full brightness: behind the
  copy (the first placement) the chips' flares and the packet comets forced a dim of 0.07 on the
  dark page and 0 on the light one to keep the heading's contrast; in the band it lies over no
  text (see `CHANGELOG.md`, Faza 3, for the numbers). On a 568px-tall phone the band is under the
  header at the moment the Work gate arms (the track at 55%) and comes into view as soon as the
  visitor scrolls back a little (the gate holds until 70%).
- **The model** (`three/models/helix.ts`, `HELIX` = radius 0.9, height 5.4, 2.5 turns in
  `shapes.ts`): five draws on the programs the scene already compiled — the two strands (P5
  links: packets climbing A, running down B), chips riding them (P3 instanced boxes, the ones at
  the front brightening), base-pair rungs with a comet sweeping up them (P4), seven-segment 0/1
  bits drifting up the axis (P4, hidden when lite), and the hologram (P2, spiral only). No idle
  spin: the strands turn by `HELIX_ANGLE` per card of focus. **Built after ready**
  (`stageHelix`): one idle slice to build, one compile slice per draw object, a pre-warm frame, then
  `onHelix("built")` — it never delays the first picture, and until then the work gate stays shut
  and the cards stay as rendered. Swarm slot 0 is its silhouette (`helixSamples`). Tier rows:
  `helixTube` [160, 4] / [100, 3], `helixChips` 80 / 52, `helixRungs` 22 / 14, `helixBits` 36 / 20.
- **The hologram** (`three/hologram.ts`): a plane beside the helix, in the spiral layout's
  `holo` box (centre at 0.76 × 0.45 of the zone, `min(0.34·w, 440px)` wide), showing the front
  card as one Canvas2D `CanvasTexture` composed from the card's own DOM: its screenshot as
  luminance in 2px cells under scanlines, its tag chips, name and index, bracket corners. The
  texture is `hologram` [384, 240] on high, [256, 160] on mid, never larger than `HOLOGRAM_MAX`.
  It is redrawn in an idle slot once the focus is `0.5 + HOLOGRAM_HYSTERESIS` (0.3) past the card
  it shows — resting between two cards never flips it — with a 0.35s glitch on each swap; the
  source is created at the first spiral request and disposed with the world. Security rules in
  [11](./11-security.md#the-work-hologram-canvas2d-2026-09-17).
- **Recolour.** The helix and the hologram take the front card's `--p2` (in the spiral the
  focused card; in ambient mode the card nearest the band's middle, `nearestCard`), settling in
  0.4s; with no card, the palette's cyan.

### The art: one drawing in the HTML, the rest on demand

`page.tsx` renders `<HeroCoreArt />` and `<ServiceArt shape={SCENE_SHAPES[0]} />` on the server
and passes them to `Hero` (`coreArt`) and `Directions` (`initialArt`). A prop handed to a client
component is also serialised into the RSC payload, so passing all five drawings put every one of
them in every HTML response; now only the drawing of the direction the section opens on is
there. `Directions` loads `ServiceArt` with `next/dynamic` (`ssr: false`) the first time another
direction is selected, and `serviceArtPaths.ts` builds that direction's path table on first use.
A bare render without the slot (unit tests) draws no illustration at all.

## The HUD chrome (IT-OS Phase 4, 2026-09-17)

The IT-OS HUD — the Ghid TBS guide now; the fibre rail and the OS layer in later phases — has
**one mount**, `components/hud/HudChrome.tsx`, rendered by `app/(site)/layout.tsx` between
`<Footer />` and `<CookieConsent />`. After the footer in the DOM, so the header's tab budget and
"the intro's skip is the first Tab stop" both hold. Behaviour and limits are in
[05 — Page Sections](./05-page-sections.md#ghid-tbs-the-guide); the visual contract in
[04](./04-design-system.md#ghid-tbs--the-guide).

### Arming order

`HudChrome` renders nothing on the server and nothing on the client until every step has held,
**in this order** (`whenHudArmed`):

1. `readHudFlag() !== "off"` (`lib/hud/gate.ts`; `localStorage.tbs_hud`, QA and E2E only) —
   otherwise it never listens to anything;
2. the cookie banner is answered (`getConsent()`); an unanswered banner waits for
   `CONSENT_EVENT`, and that answer **is** the interaction, so step 3 is skipped;
3. the visitor's first `HUD_ARM_EVENTS` event on `window` (`pointermove`, `pointerdown`, `wheel`,
   `scroll`, `keydown`, `touchstart`, `focusin`; passive, capture; removed the moment one fires);
4. the intro overlay is gone (`onIntroGone`);
5. an idle slot (`afterIdle(0)`).

Then, in one commit, it renders its `PARTS` — each a `next/dynamic(…, { ssr: false })` chunk.
Phase 4's only part is `GuideAssistant` (`components/hud/guide/GuideAssistant.tsx`). A visitor who
never interacts, never answers the banner, or carries `tbs_hud=off` downloads no part: the page
bundle carries only `HudChrome` itself (+473 B gzip on `/`; +675 B on a service page, which did not
already load `lib/idle` and `lib/intro`), and the guide's JS (5.9 KB gzip, with its copy, the linger
engine, lucide's `X` and a copy of `lib/directions.ts`) and CSS Module (2.3 KB) arrive as late chunks
after arming (the B1h / B5h / B6h rows in `CHANGELOG.md`).

### The guide's wiring

`GuideAssistant` renders nothing while the banner is unanswered or `isIntroOnScreen()`
(`useSyncExternalStore` over `CONSENT_EVENT` and `INTRO_GONE_EVENT`), so it is correct on its own
too. Inside it:

| Piece | What it does |
|-------|--------------|
| Centre-line observer | One `IntersectionObserver` with `rootMargin: "-50% 0px -50% 0px"` (a zero-height root on the viewport's middle) over `#servicii`, `#lucrari` and every `[data-guide-topic]` whose value `isGuideTopic` accepts. `pickTopic` (`lib/hud/linger.ts`) resolves nested hits to the deepest element, ties to the first in collection order. Re-created on every pathname. |
| Linger timer | `visibleTimeout(GUIDE_LIMITS.lingerMs)` re-armed whenever the centre topic changes. When it fires, `canPrompt(memory, topic, performance.now(), blockers)` decides; blocked for now → it waits again, until `isFinal`. |
| Blockers | `covered` (`isPageCovered()`), `intro` (`isIntroOnScreen()`), `banner` (`getConsent() === null`), `typing` (`isTypingTarget(document.activeElement)`), `requestOpen` (`useRequestFlow().isOpen`), `away`, `busy` (`isHudBusy()`). |
| Memory | ONE module-level `createGuideMemoryStore()`: survives client navigation (the chunk stays loaded, the layout is not re-rendered), resets on reload. No storage, no cookie. |
| Away observer | A second observer (threshold 0) on `[data-testid="request-flow"][data-layout="section"]` (the home page's `#estimare`): while it intersects, `data-away` on the root and `tabIndex -1` on the guide's buttons. |
| Cover | `subscribePageCover`: the dialog or the burger covering the page clears a shown tip; nothing is hidden (the z-order covers the guide). |
| Yield | A document `focusin` listener: focus on an element the avatar or tip overlaps (`overlaps`, `lib/hud/obscure.ts`) and not inside the guide sets `data-yield`; focus under the tip also clears the tip. |
| Opening | `openRequest({ source: "guide" \| "guide-prompt", openAssistant: true, guideTopic?, serviceSlug?, projectId?, projectName?, returnFocusTo: avatar })`. `serviceSlug` from `usePathname()` (`/servicii/<slug>`, with or without `/ru` · `/en`) only when `lib/directions.ts` knows it; the project only for the `lucrari` topic, from `#lucrari [data-helix-front]`'s index among `#lucrari a, #lucrari article` into `useSiteContent().projects`. |

The tip and the away state are tied to the pathname they were set on, so a client navigation
clears them without an effect. The estimator (`Estimator.tsx`) honours `openAssistant` (the
dialog opens on the chat, focus inside it) and writes the origin block the lead carries.

## Styling layers

`globals.css` and every `*.module.css` are **unlayered**. `app/tailwind.css` puts Tailwind in
the `theme` and `utilities` layers, and `globals.css` holds three element rules in `base`.
Unlayered CSS beats layered CSS whatever its specificity, so no existing page can be restyled
by a utility. Tailwind is imported from `app/(site)/layout.tsx`, not the root layout, so a
direct load of the admin never downloads it. See [07 — Conventions](./07-conventions.md).

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

Five cross-section channels exist deliberately, all as `window` events, because the components
are siblings with no shared state:

- `lib/estimatorBridge.ts` — a service card on `/03` pre-selects itself in the `/07`
  estimator and scrolls there.
- `lib/consent.ts` — the cookie banner tells the analytics pixel the choice changed.
- `lib/intro.ts` — `tbs:intro-done` (`{ played }`): the intro stopped covering the page
  (played, skipped or bypassed). The cookie banner waits for it through `onIntroDone()`, which
  calls back **synchronously** when no intro is pending, so every page without an overlay
  behaves exactly as before.
- `lib/intro.ts` — `tbs:intro-gone` (a plain `Event`, 2026-09-17): the overlay has left the DOM
  (`markIntroGone()`, fired once, a no-op while `#tbs-intro` is still attached). The interior
  stage starts its idle wait and GPU probe only after it, through `onIntroGone()`, which is
  synchronous when nothing is on screen; `isIntroOnScreen()` reads the same state.
- `lib/scrollLock.ts` — `tbs:page-cover` (a plain `Event`, 2026-09-17): something full-screen
  covers the page. `coverPage()` is reference-counted and fires only on the 0 ↔ 1 transitions;
  `lockRootScroll()` (burger, intro) and `Modal`'s body lock each hold one cover while locked,
  and **release it last**, once the page's styles and scroll position are back — a listener that
  re-measures on release (the interior director) must find the page in place. Read with
  `isPageCovered()` / `subscribePageCover()`.

The interior stage's page → scene input (CTA boost, selected direction) is deliberately **not**
an event: it is a module store in `lib/scene.ts`, read every frame (see
[The interior stage](#the-interior-stage)).

See [10 — Backend](./10-backend.md), [07 — Conventions](./07-conventions.md) and
[16 — i18n & SEO](./16-i18n-seo.md).
