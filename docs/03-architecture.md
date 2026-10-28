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
│                          #   + x-locale / x-pathname headers for the layouts
├─ next.config.ts          # standalone output, security headers, /ru + /en rewrites; the image
│                          #   optimiser pinned to /projects/* (q 75, 64–256px, 50 MB cache)
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
│  │  ├─ layout.tsx        # Chrome: ScrollProgress, Navbar, Footer, HudChrome (the HUD's one
│  │  │                    #   mount, renders nothing until armed), CookieConsent, AnalyticsPixel (consent-gated);
│  │  │                    #   imports ../tailwind.css
│  │  ├─ page.tsx          # Landing page: Hero → Ticker → Directions (with the server-rendered
│  │  │                    #   art slots), <SceneStage> around Work ONLY, then WorkProof,
│  │  │                    #   Principles, Team, Process, RequestSection
│  │  ├─ portofoliu/       # The portfolio: one project on a screen, one pixel per project (components/sections/Portfolio)
│  │  ├─ confidentialitate/ # Privacy policy (content.ts + LegalDoc)
│  │  └─ cookies/          # Cookie policy (content.ts, reuses LegalDoc)
│  └─ admin-tbs-digital/   # Admin panel route (outside the (site) chrome)
│     ├─ page.tsx          # Login gate + tabbed content editor
│     └─ admin.module.css
│
├─ components/
│  ├─ art/                 # static SVG art, CSS Modules, no "use client" (since 2026-10-28 the
│  │                       #   only art on the hero, Directions and the service pages):
│  │                       #   HeroCoreArt (+ heroArt.ts), the hero chip · ServiceArt
│  │                       #   (+ serviceArtPaths.ts), one drawing per direction · shapes.ts (pure
│  │                       #   maths shared with Work's helix: CHIP, chipTraces, chipPins, the
│  │                       #   neural / commerce / hub layouts, HELIX, HELIX_ANGLE, MODEL_RADIUS,
│  │                       #   projectOrtho, SERVICE_SHAPES)
│  ├─ three/               # 3D helpers with no scene of their own (see "The interior stage")
│  │  ├─ runtime.tsx       # THE lazy entry for three.js + R3F: re-exports SceneCanvas; only ever
│  │  │                    #   import()ed, never statically
│  │  ├─ capability.ts     # the site's one GPU probe (no three.js), DPR clamp
│  │  ├─ renderer.ts · hooks.ts   # create / compile / retain / release the WebGLRenderer
│  │  ├─ governor.ts       # the FPS governor (dpr → lite, and the opt-in bail)
│  │  ├─ motion.ts · random.ts · palette.ts
│  │  └─ RenderErrorBoundary.tsx  # catches a render error in the scene
│  ├─ scene/               # the interior stage: Work's DNA helix, the site's only WebGL (home page)
│  │  ├─ SceneStage.tsx    # Tailwind; the stage wrapper around Work, the lazy loading pipeline,
│  │  │                    #   pause, attributes
│  │  ├─ SceneCanvas.tsx · SceneWorld.tsx   # the R3F canvas and world (three + R3F, lazy)
│  │  ├─ SceneDirector.tsx # GSAP + ScrollTrigger (lazy): measures Work's two spans
│  │  ├─ scrollGuard.ts · scrollProbe.ts   # smooth-scroll guard, quiet/wake; the writes into the
│  │  │                    #   scroll probe
│  │  ├─ choreography.ts · fx.ts · tiers.ts · input.ts · pixelRatio.ts   # pure helix placement
│  │  │                    #   (placeHelixSpiral, placeHelixAmbient, helixArriveSpan, composeHelix),
│  │  │                    #   the Work gate, tier budgets, pointer / gyroscope tilt, the DPR watcher
│  │  ├─ helix.ts · workHelix.ts   # Work's spiral: the pure layout and the framework-free DOM
│  │  │                    #   driver that lays the project cards out round the helix
│  │  └─ three/            # imperative three.js: world (+ stageHelix) · materials · glsl · palette ·
│  │                       #   samples · compile (staged build, frame-counted ready) · hologram
│  │                       #   (Work's Canvas2D hologram texture) · models/{helix,types}
│  ├─ fx/                  # DOM hooks: useOffscreenAttribute (data-offscreen) · usePointerTilt
│  ├─ hud/                 # the IT-OS HUD chrome: HudChrome.tsx, its one mount (in the (site)
│  │  │                    #   layout since Phase 4) — gate (tbs_hud ≠ off → consent → first
│  │  │                    #   interaction → idle), then its lazy parts in one commit.
│  │  │                    #   CSS Modules only; lucide-react may be imported only here
│  │  ├─ guide/            # the corner assistant (a next/dynamic part, every width):
│  │  │                    #   GuideAssistant.tsx + .module.css, copy.ts (GUIDE_COPY, GUIDE_FAQ),
│  │  │                    #   speech.ts (an answer's text → her mouth's track; pure, no DOM)
│  │  └─ rail/             # the fibre scroll rail (Phase 5, a desktop-only next/dynamic part):
│  │                       #   ScrollRail.tsx (fibre, section markers, jumps) + .module.css, copy.ts
│  │                       #   (RAIL_COPY, RAIL_HOME_SECTIONS; no directive, e2e imports it)
│  ├─ layout/              # Navbar (Tailwind) · HeaderClock (Tailwind) · Footer
│  ├─ sections/
│  │  ├─ Hero.tsx          # hero (Tailwind) — HUD backdrop, the core art slot, h1, neon CTA,
│  │  │                    #   stat cards
│  │  ├─ Ticker.tsx        # the trust ticker under the hero (Tailwind)
│  │  ├─ Directions.tsx    # the direction chooser (Tailwind): pills, preview, HUD screen
│  │  ├─ Work.tsx          # the portfolio's HUD cards (Tailwind): tilt, CSS screenshot parallax;
│  │  │                    #   the grid is `data-work-track`, which the scene turns into the helix spiral
│  │  ├─ WorkProof.tsx     # after the projects: "Vreau un proiect similar", all projects, the partners' logos
│  │  ├─ Principles.tsx    # "De ce TBS": four reasons, each with its mark
│  │  ├─ Process.tsx       # "Cum începem": the three steps from the request to the launch
│  │  ├─ RequestSection.tsx · DirectionPage.tsx (the /servicii/<slug> pages)
│  │  ├─ Team.tsx          # team + system-status panel
│  │  ├─ Estimator.tsx     # the request flow (RequestSection, and the request dialog)
│  │  ├─ Portfolio.tsx     # /portofoliu: the screen (a project's whole site, scrolling), the pixels
│  │  │                    #   on a circuit board, the pages · SiteDemo.tsx (the screen as a small
│  │  │                    #   browser: the bar, a page's links and buttons, the "real site" sheet)
│  │  │                    #   + PortfolioSearch.tsx · portfolioCircuit.ts (the board drawn, lit and
│  │  │                    #   played: measures the pads and the chin, SVG + WAAPI)
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
│  ├─ portfolioPages.ts    # /portofoliu's balanced pages (9 at most) and its search by name; pure
│  ├─ portfolioBoard.ts    # /portofoliu's circuit board as numbers: traces, each pad's route into
│  │                       #   the chin (one line: a bus and a Y; several, on a phone: a spider web
│  │                       #   that keeps clear of the names and of the lit square pads, sized as
│  │                       #   measured), the pulse's timing; pure, no DOM
│  ├─ siteDemo.ts          # a project's interactive demo: the manifest's contract and strict reader,
│  │                       #   deep links that never leave the project's site, the Back history; pure
│  ├─ clock.ts             # SYS_TIME: Chișinău time + real UTC offset, one shared 500ms store
│  ├─ scrollLock.ts        # Reference-counted <html> scroll lock (burger menu) and the
│  │                       #   page cover (coverPage, tbs:page-cover), held by every lock
│  ├─ scene.ts             # The interior stage contract: QA flag, gates, data-* names, the scroll
│  │                       #   probe, SCENE_TIMING, SCENE_NEAR_ROOT_MARGIN, WORK_TRACK_ATTR,
│  │                       #   SceneHelixMode / SceneHelix, SCENE_LAYOUT_EVENT
│  ├─ gpuProbe.ts          # The GPU probe's session cache (tbs_gpu_probe) + decideWebGL; no imports
│  ├─ device.ts            # Device profile, detectSceneTier, mediaMatches, PREFERS_REDUCED_MOTION
│  ├─ idle.ts              # afterIdle: visible-time delay + an idle slot
│  ├─ tapIntent.ts         # first tap opens, second navigates (header dropdowns, direction pills)
│  ├─ tilt.ts · hologram.ts  # pure tilt maths; the hero stat holograms' edges and rings (CSS 3D)
│  ├─ visibleTimeout.ts    # setTimeout that only counts visible-tab time, fires once
│  ├─ hud/                 # the HUD chrome's pure logic, no DOM at import (2026-09-17):
│  │                       #   gate.ts (tbs_hud QA key, arming events, desktop media; import-free,
│  │                       #   playwright.config.ts imports it) · busy.ts (the "busy with the HUD"
│  │                       #   store) · obscure.ts (covers / overlaps, focus-not-obscured guards) ·
│  │                       #   topics.ts (the section topic ids a request can carry) ·
│  │                       #   rail.ts (Phase 5: the rail's maths — progress, section targets,
│  │                       #   marker layout, current / crossed sections, heading discovery; pure)
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
├─ public/                 # Static assets (projects/ — with projects/demo/<id>/ — partners/, …)
├─ tools/                  # Developer tools, never deployed: guide/ (the assistant's art, her
│                          #   mouth's frames, and lips/ — how real mouths move, measured on video),
│                          #   site-demo/ (/portofoliu's demos: captures + hotspots; its README)
└─ docs/                   # This documentation
```

Keep the **section-per-component** split and the **content boundary**: `content.ts` for
defaults, `siteContent` for anything the admin edits, `i18n` for anything the visitor reads.

## Routing

| Route | What |
|-------|------|
| `/` · `/ru` · `/en` | The landing page in Romanian / Russian / English. `/ru` and `/en` are rewrites onto the same route; the language comes from the `x-locale` header ([16](./16-i18n-seo.md)). |
| `/portofoliu` | The portfolio — one project at a time on a big screen, and under it one labelled pixel per project as the navigation (arrows, keys, swipe), a service filter, pages and a search by name once there are more projects than one row holds, "Vreau un proiect similar" for the project on the screen and the service pages' close ([05](./05-page-sections.md#portfolio--portofoliu)). Prefixable with `/ru`, `/en`; its title and description follow the language (`generateMetadata`, `lib/i18n/requestLocale.ts`). |
| `/confidentialitate`, `/cookies` | Legal pages (also prefixable with `/ru`, `/en`). |
| `/admin-tbs-digital` | The login-gated admin panel. `noindex, nofollow`, outside the `(site)` chrome. |
| `/robots.txt`, `/sitemap.xml`, `/opengraph-image`, `/twitter-image` | Generated metadata routes. |

Every page renders **dynamically** — the root layout reads request headers for the CSP
nonce and locale (see `proxy.ts`). It also stamps `data-theme` on `<html>` for every route,
the admin included: the visitor's `tbs_theme` cookie if it says `light`, otherwise the dark
default (`lib/theme/theme.ts`).

> **Every document request must reach the proxy** (2026-09-25), or it is served with no
> `x-pathname`. `proxy.ts`'s matcher used to copy Next's CSP recipe verbatim and skip any request
> carrying the legacy `Purpose: prefetch` header. That header is a BROWSER's, not this Next
> version's router (which sends `next-router-prefetch` alone), and Chrome sends it when it
> preloads a URL it predicted from its own history — so the visitor who comes back most often was
> served a document with no `x-pathname`: no self-canonical, and no CSP header. The
> matcher now skips the router's RSC prefetch and nothing else
> (`app/__tests__/proxy-matcher.test.ts` pins it).

## The interior stage

**Since 2026-10-28 the site has exactly one WebGL scene: Work's DNA helix** ("Ce am construit
deja.", `#lucrari`) — the owner found the 3D on the first screen made the site too heavy. The
projects' helix is drawn by three.js + React Three Fiber and measured by a GSAP ScrollTrigger
director; from 768px the project cards turn round it (`spiral`), below that a small helix lies in
the band above Work's heading (`ambient`). Hero, Ticker and Directions are **outside** the stage
and draw static SVG art (`components/art/`, below); the service pages (`/servicii/[slug]`) have no
stage at all. Devices that should not draw the helix get Work's flat card grid, exactly as the
server rendered it.

The scene was pruned to the helix: the hero microprocessor core, the services particle swarm and
burst, the five service models (and their panel models), the cursor trail, the hero stat panels
(`statCards` / `statFace` / `statPanel`), the service page's laptop and projects reel, the hero
parallax, the CTA boost input store and `SceneLoading` are deleted. So are the stage attributes
`data-morph`, `data-entry` and `data-boost`, and the `hero` / `services` scene anchors.
What the visitor sees is in [05 — Page Sections](./05-page-sections.md#interior-stage-3d); the
styling rules in [04 — Design System](./04-design-system.md#the-interior-stage).

### The DOM (`app/(site)/page.tsx`, `components/scene/SceneStage.tsx`)

```
<main>
  Hero        section#top … [data-testid="hero-core"] > the core art (static SVG)
  Ticker
  Directions  #servicii … [data-testid="services-screen"] > [data-art-host] > the art
  SceneStage   div[data-scene-stage][data-testid="scene-stage"]  .group/stage.relative.isolate
    div[aria-hidden]  .absolute.inset-0           ← the track: no layout height, so no section moves
      div[data-scene-layer]  .sticky.top-(--header-h).h-scene.overflow-hidden
        (WebGL path only) RenderErrorBoundary
          div  opacity 0 → 1 once data-renderer="webgl" (500ms)  → SceneCanvas   (three + R3F)
          SceneDirector                                             (GSAP; renders nothing)
    Work        section#lucrari … heading block + div[data-work-track] > a | article   ← the cards
  WorkProof · Principles · Team · Process · RequestSection        ← outside the stage
```

- The track is positioned and first in tree order, so every positioned element after it paints on
  top of the canvas. The stage's stacking context (`isolate`) keeps the whole stage under the
  header, the burger overlay and the cookie banner without a new z-index token.
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
  │         off (flag, reduced-motion, save-data, network) │ fallback (unsupported, low-tier) │ waiting
  └─ waiting ─► IntersectionObserver(rootMargin SCENE_NEAR_ROOT_MARGIN = "100% 0px 100% 0px")
        Work within one viewport (or already scrolled past: a deep link, a Back) ─► near, latched
        └─ afterIdle(IDLE_TIMEOUT_MS 1500)
             └─ readGpuFacts(mode)  ← sessionStorage.tbs_gpu_probe
                  └─ none cached ─► import("@/components/three/capability") → probeGpu(mode)
             └─ decideWebGL(facts, force) ─► fallback(reasonFor) │ loading, in ONE commit:
                  ├─ next/dynamic ssr:false ► import("@/components/three/runtime") → SceneCanvas
                  └─ next/dynamic ssr:false ► import("./SceneDirector")  (gsap + ScrollTrigger)
  SceneCanvas onReady (the helix built + compiled in idle slices, then drawn twice)
    ∧ SceneDirector onLive (first measurement) ─► data-renderer="webgl", the canvas fades in
```

- **Nothing heavy before Work is near.** Until Work comes within one viewport the stage requests
  nothing: no GPU probe, no three.js / R3F chunk, no GSAP chunk, no WebGL context. A visitor who
  reads the first screen and leaves downloads none of it. Without `IntersectionObserver` the stage
  counts as near at once.
- **Measured build (2026-10-28):** the homepage's 16 initial chunks (~268 KB gzip) contain no
  three.js and no GSAP. The lazy three + scene chunk is ~945 KB raw / ~253 KB gzip (it was
  ~1,057 KB / ~294 KB before the scene was pruned to the helix); the GSAP chunk ~46 KB gzip.
- **Hydration decides in the effect; a client mount decides in its first render** (2026-10-02).
  A stage that hydrates server HTML starts at the server's `pending` and runs the `mount` line in
  its effect. A stage that MOUNTS on the client — a navigation from another page, a Back — reads
  the same line (`readEntry()`) in its first render instead, told apart by a
  `useSyncExternalStore` that answers from its server snapshot only while React hydrates. The line
  is read ONCE per mount (`mountEntry`, reused by the effect); a gate that closes after the read is
  still caught when `decide()` re-reads it.
- `mode` is `forced` when `localStorage.tbs_scene_3d = "force"` (QA and E2E: software renderers,
  the low tier and a slow device are all accepted, and the governor never bails), else `strict`
  (`failIfMajorPerformanceCaveat`, software renderers refused). `tbs_scene_3d = "off"` keeps the
  stage on nothing at all.
- **One three.js entry.** `components/three/runtime.tsx` re-exports `SceneCanvas` and is the only
  `import()` target the scene is reached through; three.js, R3F and GSAP are never imported
  statically (`eslint.config.mjs`).
- **Runtime transitions** (all for the mounted attempt only): reduced motion switched on → `off`
  for the visit; a context lost while visible, or a governor bail → `fallback` for the rest of
  the session (`markGpu("lost" | "slow")` in the probe cache); a context lost while the tab is
  hidden (iOS backgrounding) → `pending`, and one remount when it is visible again; a render
  error → `fallback`/`error`.
- **Paused** — `frameloop="never"`, context kept — while the stage is off screen
  (IntersectionObserver), the tab is hidden, or the page is covered (`isPageCovered()`). A
  paused canvas draws nothing, so it cannot become ready: Work keeps its flat grid until the helix
  has really drawn.
- **Every non-WebGL path leaves Work as the flat card grid** — `pending`, `fallback` and `off`
  alike. There is no loading mark in the track.

| `data-renderer` | When | `data-reason` |
|-----------------|------|---------------|
| `pending` | the server render, waiting for Work to come near / idle / probe, loading, a hidden-tab retry | — |
| `off` | `tbs_scene_3d=off`, reduced motion, Save-Data, a 2G connection | `flag` · `reduced-motion` · `save-data` · `network` |
| `fallback` | no `ResizeObserver`, the low tier, the probe said no, a lost context, a bail, an error | `unsupported` · `low-tier` · `no-context` · `software` · `lost` · `slow` · `error` |
| `webgl` | the helix drew and the director measured, for the same attempt | — |

Also on the stage root: `data-tier` (from mount; `mid` while a forced low-tier device loads),
`data-motion` (`live` only with every gate open and a tier above low), `data-paused` (only while
`webgl`). Written straight to the DOM, never through React state: `data-quality`
(`full|dpr|lite`, once the governor steps), `data-helix` (`spiral|ambient`, the mode Work's helix
is in — see [below](#the-project-dna-helix-it-os-phase-3-2026-09-17)), and the director's
`data-scroll-fx` (`on` once measured). `data-quality` and `data-helix` belong to the mounted
scene: they are removed with it, so a `fallback` or `off` stage never carries them. On a card,
`data-helix-front` marks the spiral's front card (or, in ambient mode, the card nearest the band's
middle). `data-morph`, `data-entry` and `data-boost` no longer exist.

### Who owns what

| Piece | Owns |
|-------|------|
| `lib/scene.ts` (+ `lib/gpuProbe.ts`) | The contract: `SCENE_3D_KEY`, the live gates (`readMotionGate`), the probe cache and `decideWebGL` / `reasonFor`, the `data-*` names and test id, the `ScrollProbe` type, `SCENE_TIMING`, `SCENE_NEAR_ROOT_MARGIN`, `WORK_TRACK_ATTR`, `SceneHelixMode` / `SceneHelix`, `SCENE_LAYOUT_EVENT`, `INSTANT_SCROLL_ATTR`. No `"use client"`, no DOM at import (server components and `e2e/helpers.ts` import it) |
| `SceneStage` | The pipeline and its state, the proximity observer, pausing, the React-written attributes and the DOM-written reports (`data-helix` included), the error boundary, the session marks |
| `SceneDirector` + `scrollGuard.ts` / `scrollProbe.ts` | ScrollTrigger: Work's two measuring triggers (`workSpan`, `helix`), when to refresh, re-reading the boxes on `SCENE_LAYOUT_EVENT`, no measurement under a cover, the smooth-scroll guard (`html[data-scroll-measure]`), quiet/wake. Its ResizeObserver watches the stage **and every earlier sibling** (Hero, Ticker, Directions), so a height change above Work triggers the debounced refresh (`REFRESH_DEBOUNCE_MS`, 200) |
| `SceneCanvas` / `SceneWorld` + `three/*` | Drawing: renderer and DPR (`pixelRatio.ts`), palette and theme observer, tilt listeners (`input.ts`), the staged build and compile, the frame-counted ready, the governor, the Work gate, the helix and its hologram. `createSceneWorld` builds an empty root; `stageHelix` builds and compiles the helix (strands, chips, rungs, bits, hologram) in idle slices; ready = the helix compiled and drawn twice, and a page without `[data-work-track]` arms ready at once. Reports `onReady` / `onLost` / `onBail` / `onQuality` / `onHelix`. It touches the page in **one** place only: in spiral mode the driver (`workHelix.ts`, created by `SceneWorld`, called by the world every frame, disposed with it) writes Work's cards' inline layout, and puts every card back when it leaves |
| `helix.ts` / `workHelix.ts` | The spiral's pure layout; the DOM driver: which mode, when it may switch, the cards' inline poses, focus, the restore contract |
| `Work` | The cards as React renders them (`--p1` / `--p2` inline, nothing else) and the track attribute (`data-work-track`); it knows nothing of the spiral, and React re-renders never undo it (they diff only React's own style keys) |
| `components/art/*` | The static drawings of the hero and Directions (server-rendered first, see below) — outside the stage, never gated by it |

### Stores and channels

- **The scroll probe** — a plain mutable object the stage creates once and hands to both halves.
  The director writes it at every ScrollTrigger refresh; the scene reads it, with
  `window.scrollY`, once per frame. No React state, no events. Its shape (`ScrollProbe`,
  `lib/scene.ts`): `live`, `version`, `headerH`, `layerH` (the sticky layer's height),
  `stage: { top, bottom }` (Work's own edges, since the stage wraps only Work), `work` (Work's card
  track), `workHead` (its heading block, title to lead, the scroll reveal's `translateY` taken out)
  and `workGap` (the free band above that heading: from the content end of the section **before
  the stage** — Directions; its bottom less its bottom padding — to the heading's top, as wide as
  Work's section), and two scroll spans — `workSpan` (the track "top 70%" → "top 55%", the Work
  gate's band) and `helix` (the track "top top" less the header → "bottom bottom"; ScrollTrigger
  clamps an end before its start, so a phone's band ends at its top). The scene can also say it
  changed the layout itself: `SCENE_LAYOUT_EVENT` (`tbs:scene-layout`, a plain `Event` on the stage
  root) makes the director re-read every box at once — no refresh, which would stop a touch fling —
  while the stage's resize refresh follows for the spans. Never under a cover. The fibre scroll
  rail listens to the same event and to `html[data-scroll-measure]`.
- **`tbs:page-cover`** (`lib/scrollLock.ts`) — see [Data flow](#data-flow) below.
- **The scene's fx** (`fx.ts`, one per canvas) — the tilt targets the listeners write, what the
  world smooths every frame, and the Work gate (`fx.work`).

### The project DNA helix (IT-OS Phase 3, 2026-09-17)

The client asked for the **existing project cards** to turn round a DNA helix ("cardurile cele să
fie la ADN"). Work (`#lucrari`) is inside the stage — since 2026-10-28 the only section that is —
and the scene chunk lays its cards out round a 3D helix.

- **Modes** (`SceneHelixMode`, reported through `onHelix` and written as `data-helix` on the
  stage root): `spiral` — the helix built, at least `HELIX_MIN_CARDS` (3) cards and
  `WORK_HELIX_MEDIA` = `(min-width: 768px) and (min-height: 600px)`; `ambient` — the helix built
  otherwise (phones, a short window, fewer cards): the grid or band stays exactly as it is and a
  small helix lies in the band above Work's heading; `off` — before the helix is built, without the
  scene, or after an error (`wantedHelixMode`, `helix.ts`). The default path (`pending`, `fallback`,
  `off` renderer, reduced motion) creates no driver at all: no attribute, and every card as the
  server rendered it.
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
  while it says Work is on screen. A reload or deep link inside Work keeps the grid until the
  visitor is back above it. **Out of it at once** (the media query stops matching, fewer cards,
  the helix gone, dispose, an error), with the scroll put back under the visitor: inside the
  spiral, to the focused card's grid position (`top − headerH − 24`, instant); past its end,
  keeping whatever follows the track still.
- **The sticky-card spiral.** On entry the track becomes one tall grid cell (`display: grid`,
  `grid-template-columns: 100%`, one row of `sceneH + (n − 1) · helixStep(innerHeight)`, the step
  `clamp(240px, 38% of the viewport, 380px)`), and every card a `position: sticky` item in it:
  `grid-row/column-start: 1` (which also cancels the odd last card's `col-span-2`),
  `align-self: start`, `justify-self: center`, width `clamp(240, 0.27·w, 340)`,
  `min-height: min(0.36·sceneH, 260)` — **never a `height`**: a card's content decides how tall it
  is — `top` centring its measured box in the layer under the header (a ResizeObserver on the cards
  centres them again when their content changes; Work lifts its description's `max-h-35` cap
  inside the spiral for the same reason), `margin: 0`, and
  `transition-property: translate, box-shadow, border-color`. Per frame, only when the focus
  moved: `transform: translate3d(x, y, 0) scale(s)`, `z-index`, `opacity` and `pointer-events`,
  from `helixLayout(i, focus, w, sceneH)` — card `i` sits `d = i − focus` steps along the strand,
  `d · HELIX_ANGLE` (2π/9, the step the model turns by too) round it and `0.18 · sceneH · d` down
  it, its x clamped `helixEdge(w)` inside the zone (16px, plus 44px from 861px for the Phase 5
  rail). The focus is the scroll's progress over the driver's own span, `× (n − 1)`.
- **Paint order and hits.** A card facing the visitor (`cos θ ≥ 0`) gets `z-index` 1…11 and
  `pointer-events: auto`: it paints over the canvas and takes the click. One behind the strand
  gets −1…−9 and `pointer-events: none`: it paints under the canvas track and never takes a click.
  `data-helix-front` marks the card at the rounded focus.
- **The restore contract.** Every property is inline, and every card's (and the track's)
  original `style` attribute comes back **byte for byte** (`--p1` / `--p2` exactly as React
  rendered them). Should someone else have changed the style meanwhile (a tilt in progress, new
  admin colours), only the driver's own longhands are removed. React re-renders (a locale switch)
  diff only React's own style keys, so the layout survives them.
- **Focus.** Tabbing to a card scrolls to where it is the focus (`scrollForCard`), so it comes to
  the front; a card holding focus is fully opaque. A focus a pointer press caused (within 800ms)
  scrolls nothing. Tab order, `inert` and `aria-hidden` are never touched.
- **A new card list.** A `MutationObserver` on the track's `childList` catches a re-keyed list
  (`/api/content` replacing the seed): the cards are collected and laid out again.
- **Errors.** Any exception inside the driver restores everything and leaves it `off` for good.
  An exception in the helix's frame (`failHelix`, `world.ts`) lets the driver go (the cards come
  back), hides the helix and logs once. A helix that fails to build leaves the cards as they are.
- **`SCENE_LAYOUT_EVENT`.** A mode change grows or shrinks the track at once, and the director's
  resize refresh for it may wait for a scroll to end. So the driver's `onMode` dispatches
  `tbs:scene-layout` on the stage root, and the director re-reads every box into the probe then
  and there (never under a cover); the refresh still follows for the spans.
- **The Work gate** (`fx.work`, `WORK_SECONDS` = 1.2s to form, 0.5s back): a timed gate over
  Work's band. The spiral arms on its own sticky line (`helixArriveSpan`, derived from the track's
  box) and keeps `workSpan`'s start as its disarm line; the ambient helix uses `workSpan` ("top
  70%" → "top 55%"). It only ever opens onto a helix that can be drawn — built, the driver's mode
  not `off`, the track measured — otherwise it stays shut. `composeHelix(work)`: the helix is
  drawn from the gate's first frame (a filament, then unwinding, `helixArrive`) and fully from 30%
  on. The first frame snaps the gate, so a deep link into Work finds the helix formed.
- **Placement** (`choreography.ts`). Spiral: `placeHelixSpiral` — its axis at `HELIX_LAYOUT.cx`
  of the track's width, the axis the cards orbit; centred on the sticky zone; `HELIX_ZONE_FILL` of
  the zone tall; a rigid follow. Ambient: `placeHelixAmbient` — lying down in `probe.workGap`, the
  free band between **Directions** (the section before the stage) and Work's heading, centred on
  it, at most `HELIX_AMBIENT.maxPx` (120px) — or the band less `HELIX_AMBIENT.clear` above and
  below — tall, measured with `HELIX_REACH` (the bits drift further from the axis than the
  strands). In the band it lies over no text, so it draws at full brightness.
- **The model** (`three/models/helix.ts`, `HELIX` in `components/art/shapes.ts`): the two strands
  (packets climbing A, running down B), chips riding them (the ones at the front brightening),
  base-pair rungs with a comet sweeping up them, seven-segment 0/1 bits drifting up the axis
  (hidden when lite), and the hologram (spiral only). No idle spin: the strands turn by
  `HELIX_ANGLE` per card of focus. **The helix IS the staged scene** (`stageHelix`): one idle slice
  to build, one compile slice per draw object, a pre-warm frame, then `onHelix("built")`, and ready
  follows two drawn frames.
- **The hologram** (`three/hologram.ts`): a plane beside the helix, in the spiral layout's `holo`
  box, showing the front card as one Canvas2D `CanvasTexture` composed from the card's own DOM:
  its screenshot as luminance in 2px cells under scanlines, its tag chips, name and index, bracket
  corners. Never larger than `HOLOGRAM_MAX`. It is redrawn in an idle slot once the focus is
  `0.5 + HOLOGRAM_HYSTERESIS` past the card it shows, with a short glitch on each swap. Security
  rules in [11](./11-security.md#the-work-hologram-canvas2d-2026-09-17).
- **Recolour.** The helix and the hologram take the front card's `--p2` (in the spiral the
  focused card; in ambient mode the card nearest the band's middle, `nearestCard`), settling in
  0.4s; with no card, the palette's cyan.

### The art: one drawing in the HTML, the rest on demand

`page.tsx` renders `<HeroCoreArt />` and `<ServiceArt shape={SERVICE_SHAPES[0]} />` on the server
and passes them to `Hero` (`coreArt`) and `Directions` (`initialArt`). A prop handed to a client
component is also serialised into the RSC payload, so passing all five drawings put every one of
them in every HTML response; now only the drawing of the direction the section opens on is
there. `Directions` loads `ServiceArt` with `next/dynamic` (`ssr: false`) the first time another
direction is selected, and `serviceArtPaths.ts` builds that direction's path table on first use.
A bare render without the slot (unit tests) draws no illustration at all. Each service page's
hero gets its direction's `ServiceArt` as `modelArt`. Both drawings are always visible — no
renderer gates them. `HeroCoreArt`'s one-shot square-wave boost and packet flicker is pure CSS
(`#top:has([data-hero-cta]:hover)` under `(hover: hover)`, or `:focus-visible`, only under
`prefers-reduced-motion: no-preference`); `ServiceArt` plays a one-shot `materialize` entrance
under no-preference.

## The HUD chrome (IT-OS Phase 4, 2026-09-17)

The IT-OS HUD — the corner assistant (Phase 4) and the fibre scroll rail (Phase 5) now; the OS
layer in a later phase — has **one mount**, `components/hud/HudChrome.tsx`, rendered by `app/(site)/layout.tsx` between `<Footer />`
and `<CookieConsent />`. After the footer in the DOM, so the header's tab budget holds. Behaviour and limits are in
[05 — the fibre rail](./05-page-sections.md#the-fibre-rail); the visual contract in
[04](./04-design-system.md#the-fibre-rail).

The Ghid TBS guide was Phase 4's part. Its **linger tip** — help that appeared by itself after a
pause on a section, with `lib/hud/linger.ts` and the `[data-guide-topic]` scanning behind it — was
removed on 2026-09-25, briefly restored on the 26th at the owner's request and removed again the
same day, for good. **The assistant herself stayed**, and is the HUD's first part today: since
2026-09-24 a photographic hologram in the bottom-right corner, on every screen, who answers
written questions when she is pressed and opens the request flow from her bubble
(`components/hud/guide/`; her portrait and her mouth's 33 frames in `public/guide/`; the tools that make them, and the lip
study behind her mouth, in `tools/guide/`; `lib/hud/obscure.ts` is the overlap test she steps
aside by). Look and behaviour: [04](./04-design-system.md#asistent-tbs--the-corner-assistant),
[05](./05-page-sections.md#asistent-tbs-the-corner-assistant). `lib/hud/topics.ts` outlives the
tip.

### Arming order

`HudChrome` renders nothing on the server and nothing on the client until every step has held,
**in this order** (`whenHudArmed`):

1. `readHudFlag() !== "off"` (`lib/hud/gate.ts`; `localStorage.tbs_hud`, QA and E2E only) —
   otherwise it never listens to anything;
2. the cookie banner is answered (`getConsent()`); an unanswered banner waits for
   `CONSENT_EVENT`, and that answer **is** the interaction, so step 3 is skipped;
3. the visitor's first `HUD_ARM_EVENTS` event on `window` (`pointermove`, `pointerdown`, `wheel`,
   `scroll`, `keydown`, `touchstart`, `focusin`; passive, capture; removed the moment one fires);
4. an idle slot (`afterIdle(0)`).

Then, in one commit, it renders its `PARTS` — each a `next/dynamic(…, { ssr: false })` chunk: the
assistant (`components/hud/guide/GuideAssistant.tsx`), at every width, and `ScrollRail`
(`components/hud/rail/ScrollRail.tsx`, Phase 5), flagged `desktopOnly`. HudChrome renders the rail
through `DesktopOnly`, a `useSyncExternalStore` over `matchMedia(HUD_DESKTOP_MEDIA)`
(`(min-width: 861px)`), mounted only once the gate is open — so nothing reads the query before
arming, a phone never requests the rail's chunk, and crossing 861px mounts or unmounts the rail
alone, without re-rendering the mount or any other part. **Under 861px an armed HUD renders the
assistant alone.** A visitor who never interacts, never answers the banner, or carries
`tbs_hud=off` downloads no part: the page bundle carries only `HudChrome` itself (+473 B gzip on
`/` in Phase 4, +166 B more for the rail's reference and `DesktopOnly` in Phase 5; a service page
paid +675 B, which did not already load `lib/idle` and `lib/intro`), and the parts arrive as late
chunks after arming (the B1h / B5h / B6h rows in `CHANGELOG.md`): on a viewport of 861px or more,
the rail's JS is 3.4 KB gzip with a 1.4 KB CSS Module.

### What the guide's tip left behind

The request flow it opened outlives it. `RequestContext` still carries `openAssistant` (the dialog
opens on the chat, focus inside it) and `guideTopic` (`- Secțiune: <topic>` in the origin block,
validated against `lib/hud/topics.ts`); the estimator honours both. No CTA passes either today, so
neither reaches a lead — any future CTA that knows which section it sits in can pass one.

### The rail's wiring (IT-OS Phase 5, 2026-09-17)

`ScrollRail` keeps its per-frame state in `createRail()`, a plain object outside React (the React
Compiler rule): React re-renders only when the markers or the current section change
(`useSyncExternalStore` over the object's `read` / `subscribe`). The maths is `lib/hud/rail.ts`.

| Piece | What it does |
|-------|--------------|
| Sections | `discoverSections()`: the home page's curated list (`RAIL_HOME_SECTIONS` in `components/hud/rail/copy.ts`) when every id is on the page (`#top #servicii #lucrari #despre #echipa #estimare #contact` — `#contact` is the footer since 2026-10-09); otherwise one marker per `section` in `main`, named by its first `h1`/`h2` (`pickRailSections`: not inside `header`, `footer`, a dialog, an `aria-hidden` subtree or the rail itself; not a section holding more than one `h2`; the label whitespace-collapsed and clipped to 60 characters). More than 8 → the fibre only, no `<nav>` (`railHasNav`). |
| Measure | Each section's target is `sectionTarget(docTop, --header-h, max)` (its top right under the header, clamped to `[0, scrollHeight − innerHeight]`); `railLayout(targets, max, fibre.clientHeight)` places the markers proportionally, at least 44px apart, inside the fibre. Re-measured on mount, one `requestAnimationFrame` per burst of: a `ResizeObserver` on `<html>` (the page grows as content loads), `resize`, the page cover lifting (`subscribePageCover`), `document.fonts.ready`, and a pathname change. |
| Scroll frame | One passive `scroll` listener on `window`, one frame per burst: `--rail-p` (`progressOf`, 4 decimals) written with `style.setProperty` on the fibre, the closest common ancestor of its only readers (the thread and the head, each inside its `styles.layer`, and the flow), only when it changes — not on the root, where the inherited property would restyle the nav every frame; the current section (`activeIndex`, within 1px); the ticks a downward scroll crossed (`crossedDown`) get `data-pulse` swapped `a` ↔ `b` to restart their one-shot animation (not under reduced motion); `data-flowing` on the root until 180ms after the last scroll. The thread and the head that `--rail-p` moves each sit in a still composited layer (`styles.layer`), so a scrolled frame repaints those two small layers, never the whole rail ([04](./04-design-system.md#the-fibre-rail)). |
| Held | While `isPageCovered()` (the dialog pins the body, the burger locks `<html>`), the positions are not the page's: nothing is measured or written, and the cover lifting measures again. |
| Jump | A marker `<button>` calls `window.scrollTo({ top: sectionTarget(…), behavior })` — `"smooth"`, or `"instant"` under `prefers-reduced-motion: reduce`. A keyboard activation (`event.detail === 0`) also focuses the section (`tabindex="-1"` added only if it had none, removed on blur; `focus({ preventScroll: true })`). A mouse click never moves focus. |
| Never | No write to `<html>` or `<body>`, no `wheel` / `touch*` / `pointer*` listener, no scroll of its own except the jump asked for, no storage. |

**Below 861px there is no rail.** The layout's `ScrollProgress` (unchanged) is the progress
indicator at every width; `globals.css` hides it from 861px only while a rail exists
(`body:has([data-rail]) [data-progress] { display: none }`), and draws it as a fibre below 861px.

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

Three cross-section channels exist deliberately, all as `window` events, because the components
are siblings with no shared state:

- `lib/estimatorBridge.ts` — a service card on `/03` pre-selects itself in the `/07`
  estimator and scrolls there.
- `lib/consent.ts` — the cookie banner tells the analytics pixel the choice changed.
- `lib/scrollLock.ts` — `tbs:page-cover` (a plain `Event`, 2026-09-17): something full-screen
  covers the page. `coverPage()` is reference-counted and fires only on the 0 ↔ 1 transitions;
  `lockRootScroll()` (burger) and `Modal`'s body lock each hold one cover while locked,
  and **release it last**, once the page's styles and scroll position are back — a listener that
  re-measures on release (the scroll rail, the interior director) must find the page in place. Read with
  `isPageCovered()` / `subscribePageCover()`.

See [10 — Backend](./10-backend.md), [07 — Conventions](./07-conventions.md) and
[16 — i18n & SEO](./16-i18n-seo.md).
