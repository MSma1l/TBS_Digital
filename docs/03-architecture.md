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
│  │  │                    #   Navbar, Footer, CookieConsent, AnalyticsPixel (consent-gated);
│  │  │                    #   imports ../tailwind.css
│  │  ├─ page.tsx          # Landing page: <SceneStage> around Hero → Ticker → Directions (with the
│  │  │                    #   server-rendered art slots), then Work, Principles, Team,
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
│  │  ├─ environment.ts    # procedural PMREM + the transmission clear (colour-space compensated)
│  │  ├─ motion.ts · random.ts · palette.ts · glow.ts
│  │  └─ RenderErrorBoundary.tsx  # catches a render error in either scene (was IntroErrorBoundary)
│  ├─ scene/               # the interior stage (home page only)
│  │  ├─ SceneStage.tsx    # Tailwind; the stage wrapper, the loading pipeline, pause, attributes
│  │  ├─ SceneCanvas.tsx · SceneWorld.tsx   # the R3F canvas and world (three + R3F, lazy)
│  │  ├─ SceneDirector.tsx # GSAP + ScrollTrigger (lazy): measures the scroll, desktop parallax
│  │  ├─ scrollGuard.ts · scrollProbe.ts   # smooth-scroll guard, quiet/wake, parallax targets;
│  │  │                    #   the writes into the scroll probe
│  │  ├─ choreography.ts · fx.ts · tiers.ts · input.ts · pixelRatio.ts · shapes.ts
│  │  │                    #   pure placement/morph maths, per-frame fx, tier budgets, pointer and
│  │  │                    #   gyroscope tilt, the DPR watcher, model geometry shared with the art
│  │  ├─ three/            # imperative three.js: world · core · swarm · materials (six shader
│  │  │                    #   families) · glsl · palette · samples · compile (staged build,
│  │  │                    #   frame-counted ready) · models/{cubes,commerceLoop,integrationHub,
│  │  │                    #   neural,meshWave}
│  │  └─ art/              # static SVG art, CSS Modules, no "use client": HeroCoreArt (+ heroArt.ts)
│  │                       #   and ServiceArt (+ serviceArtPaths.ts)
│  ├─ fx/                  # DOM hooks: useOffscreenAttribute (data-offscreen) · usePointerTilt
│  ├─ hud/                 # the IT-OS HUD chrome (2026-09-17 foundation): HudChrome.tsx, its one
│  │                       #   mount, NOT mounted yet — gate (tbs_hud ≠ off → consent → first
│  │                       #   interaction → intro gone → idle), then its lazy parts in one commit;
│  │                       #   the parts list is empty. lucide-react may be imported only here
│  ├─ layout/              # Navbar (Tailwind) · HeaderClock (Tailwind) · Footer
│  ├─ sections/
│  │  ├─ Hero.tsx          # hero (Tailwind) — HUD backdrop, the core's anchor, h1, neon CTA,
│  │  │                    #   holographic stat cards
│  │  ├─ Ticker.tsx        # the trust ticker under the hero (Tailwind)
│  │  ├─ Directions.tsx    # the direction chooser (Tailwind): pills, preview, HUD screen
│  │  ├─ Work.tsx          # the portfolio's HUD cards (Tailwind): tilt, CSS parallax
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
│  │                       #   models, the page → scene input store, the scroll probe
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
│  │                       #   topics.ts (the guide's topic ids)
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

The home page's first three sections — Hero, Ticker, Directions — scroll over **one** WebGL
canvas: the hero's Cybernetic Core, which hands over to the selected direction's model as the
visitor reaches the services. Devices that should not draw it get static SVG art in the same
places. What the visitor sees is in [05 — Page Sections](./05-page-sections.md#interior-stage-3d);
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
  Work · Principles · Team · RequestSection · BottomCTA        ← outside the stage
```

- The track is positioned and first in tree order, so every positioned section after it paints
  on top of the canvas; the hero's opaque plate (`-z-20`) and backdrop (`-z-10`) sit below it
  inside the stage's stacking context (`isolate`), which keeps the whole stage under the header,
  the burger overlay and the cookie banner without a new z-index token.
- **No `transform`, `filter`, `contain` or `overflow` on the stage or on any ancestor of the
  layer** — each one breaks `sticky`.
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
steps), `data-morph` (`running|idle`), and the director's `data-scroll-fx` (`on` once measured).

### Who owns what

| Piece | Owns |
|-------|------|
| `lib/scene.ts` (+ `lib/gpuProbe.ts`) | The contract: `SCENE_3D_KEY`, the live gates (`readMotionGate`), the probe cache and `decideWebGL` / `reasonFor`, the `data-*` names and test ids, `SCENE_SHAPES` → `SERVICE_MODEL`, the input store, the `ScrollProbe` type, `SCENE_TIMING`, `PARALLAX_MEDIA` / `PARALLAX_LAYERS`. No `"use client"`, no DOM at import (server components and `e2e/helpers.ts` import it) |
| `SceneStage` | The pipeline and its state, pausing, the React-written attributes and the DOM-written reports, the error boundary, the session marks |
| `SceneDirector` + `scrollGuard.ts` / `scrollProbe.ts` | ScrollTrigger: measuring into the probe, when to refresh, no measurement under a cover, the smooth-scroll guard, quiet/wake, the desktop hero parallax |
| `SceneCanvas` / `SceneWorld` + `three/*` | Drawing: renderer and DPR (`pixelRatio.ts`), palette and theme observer, tilt listeners (`input.ts`), the staged build and compile, the frame-counted ready, the governor. Reports `onReady` / `onLost` / `onBail` / `onQuality` / `onMorph` and never touches the page |
| `Hero`, `Directions` | The anchors the scene fits its models into, the art slots, and the inputs: `setSceneBoost` (CTA hover / keyboard focus), `selectSceneShape` (the selected pill) |
| `components/scene/art/*` | The static drawings (server-rendered first, see below) |

### Stores and channels

- **The scroll probe** — a plain mutable object the stage creates once and hands to both halves.
  The director writes it at every ScrollTrigger refresh (`heroExit`, `handoff`, the stage's
  top/bottom, both anchors' document boxes, `headerH`, `version`, `live`); the scene reads it,
  with `window.scrollY`, once per frame. No React state, no events.
- **The scene input store** (`lib/scene.ts`) — `{ boost, waveSeq, shape }`, a frozen snapshot
  replaced on every change (so it works with `useSyncExternalStore`). `boost` is 1 while any CTA
  source is active; `waveSeq` counts only the 0 → 1 edges, so moving between the two CTAs never
  starts a second light wave. The scene reads it every frame; the stage subscribes and toggles
  `data-boost`, which the static art's wave keys off. A module store, not a `window` event.
- **`tbs:intro-gone`** (`lib/intro.ts`) and **`tbs:page-cover`** (`lib/scrollLock.ts`) — see
  [Data flow](#data-flow) below.

### The art: one drawing in the HTML, the rest on demand

`page.tsx` renders `<HeroCoreArt />` and `<ServiceArt shape={SCENE_SHAPES[0]} />` on the server
and passes them to `Hero` (`coreArt`) and `Directions` (`initialArt`). A prop handed to a client
component is also serialised into the RSC payload, so passing all five drawings put every one of
them in every HTML response; now only the drawing of the direction the section opens on is
there. `Directions` loads `ServiceArt` with `next/dynamic` (`ssr: false`) the first time another
direction is selected, and `serviceArtPaths.ts` builds that direction's path table on first use.
A bare render without the slot (unit tests) draws no illustration at all.

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
