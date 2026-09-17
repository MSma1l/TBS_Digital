# 07 — Conventions

Coding rules every contribution follows.

> **Note:** the original "UI-only, no backend" constraints below are **historical** — the app
> is now wired to the FastAPI + DB backend (see [08 — Roadmap](./08-roadmap.md) Phase 3b–3d).
> They are kept to explain the architecture's content/data boundary. The current rules are:
> content flows through the API via `lib/api.ts` + `lib/siteContent.tsx`; the contact form and
> admin **do** submit to the server; all input is validated on both layers
> ([11 — Security](./11-security.md)).

## Original constraints (UI-only phase — superseded)

1. ~~**UI only — no backend.**~~ The UI now fetches via `NEXT_PUBLIC_API_URL`; `localStorage`
   remains only as an offline cache/fallback in `siteContent.tsx`.
2. **No hardcoded business data.** Content starts as placeholders and is admin-editable.
   See [06 — Placeholder Rules](./06-placeholder-rules.md). *(Still current.)*
3. ~~**Forms don't submit.**~~ The contact form now `POST`s to `/api/contact` (validated).
4. **Interactive widgets are visual.** The estimator shows the admin-set price (or `...` when
   unset); it does **not** compute a real total. *(Still current.)*

## Content & data

Two layers, both typed:

- **`lib/content.ts`** — the default/seed content as typed constants (the baseline shape).
- **`lib/siteContent.tsx`** — a client store that layers `localStorage` overrides on those
  defaults and exposes them via `SiteContentProvider` + `useSiteContent()`.

Rules:

- **Editable** content (services + prices, stats, team, projects, partners, contacts) must be
  read from `useSiteContent()`, so admin edits show live. **Static** content (nav links,
  principles, footer service labels, deadlines/features) can import `content.ts` directly.
- Never inline business data in a component.
- Keep the data **shape** realistic (arrays of typed objects) so the backend contract is easy
  to match later. Every editable list is add/remove-able, so a saved list fully replaces its
  default — don't rely on merging saved data onto defaults by index/id.

## Styling

### The global UI rule

**The header and every page are one interface, not a set of pages that happen to share a
logo.** A visitor moving from the home page to a direction page to the admin login should not
be able to tell that different work went into them. Concretely, everything below comes from
[04 — Design System](./04-design-system.md) and nowhere else:

| Must be identical everywhere | Token family |
|------------------------------|--------------|
| Font families | `--font-display-stack` · `--font-mono-stack` · `--font-body-stack` |
| Type sizes and weights | `--fs-*` · `--fw-*` |
| Colours, on every surface | `--bg` `--panel` `--txt` `--mut` `--line` `--red` … and `--ink*` for inverted blocks |
| Spacing and rhythm | `--sp-1` … `--sp-9` |
| Corner radii | `--r-sm` … `--r-2xl`, `--r-pill` |
| Elevation | `--sh-sm/md/lg`, `--sh-red`, `--sh-red-strong`, `--neon-*` |
| The brand gradient | `--grad-red` (decoration) · `--grad-red-cta` (under a label) |
| Glass, stacking, motion | `--glass-*`, `--z-*`, `--motion-*` — see the HUD layer in [04](./04-design-system.md#hud-layer--the-first-screen) |

The rule in one line: **no colour, font, size, spacing, radius or shadow may be introduced
locally in a single page or component.** If what you need doesn't exist yet, add a *global
token* and use it — never copy a value into a module because it's faster.

Why it's written this way and not as "try to be consistent": the site had six near-identical
navies, the red CTA gradient pasted into six modules, and a footer that used no tokens at all.
Every one of those started as one reasonable local decision.

**When a value genuinely doesn't fit the scale** — a one-off `13px` radius, a size between two
steps — don't silently round it to the nearest token, because that moves the design. Either
add a token for it, or leave the literal and say why in a comment. A rounded value is a visual
change disguised as a cleanup.

**Exception, and the only one:** `app/opengraph-image.tsx` uses a literal `sans-serif`.
`ImageResponse` renders outside the browser and cannot read CSS variables. It is commented as
such at the top of the file.

### The rest

- Reuse the `.disp` (display) and `.mono` typographic classes; don't reinvent them (except in
  the Tailwind files, which use `font-disp` / `font-hud` — see below).
- Respect `prefers-reduced-motion` for animations.
- **Keyframes used by a `*.module.css` must be defined in that same file** — a global-only
  keyframe silently no-ops when referenced from a module. See the gotcha in
  [04 — Design System](./04-design-system.md).
- **Prefixed declaration first, or not at all** (`-webkit-backdrop-filter` before
  `backdrop-filter`): in the other order the build keeps only the prefixed line and Chromium
  loses the effect. See the Lightning CSS gotcha in [04](./04-design-system.md).
- **A z-index for a fixed/sticky layer is a `--z-*` token**, never a literal.
- Breakpoints for new code: **640px** (phone), **860px** (nav burger / tablet), **1024px**
  (small desktop). CSS cannot read a custom property inside a media query, so these are a
  convention, not a token. Older modules still carry a few other thresholds — leave them;
  changing a breakpoint changes a layout that was signed off. Tailwind's `xs/sm/md/lg/xl` are
  their exact `min-width` complements (401 / 641 / 861 / 1025, plus 1180).

### Tailwind (first-screen and interior-stage files only)

Tailwind CSS v4 is used by **exactly eight files**, the ones listed in `@source` in
`app/tailwind.css`: `components/layout/Navbar.tsx`, `components/layout/HeaderClock.tsx`,
`components/sections/Hero.tsx`, `components/sections/Ticker.tsx`,
`components/sections/Directions.tsx`, `components/sections/Work.tsx`,
`components/scene/SceneStage.tsx` and `components/ui/CookieConsent.tsx` (Directions, Work and the
stage joined on 2026-09-17, and `Directions.module.css` / `Work.module.css` were deleted).
Everything else stays on CSS Modules. Two things are deliberately **not** Tailwind:

- the intro overlay — nearly every rule there is a keyframe, a state selector or a
  pre-hydration failsafe, which a CSS Module expresses better;
- the interior's static art (`components/scene/art/`) — SVG strokes, gradient stops and the
  selectors that hide it under WebGL, one CSS Module per drawing. It is not in `@source`, and
  `scene-contract.test.ts` checks that it stays out.

**Why utilities lose to module CSS, on purpose.** Tailwind's output is layered
(`theme`, `utilities`); `globals.css` and every `*.module.css` are **unlayered**, and unlayered
CSS beats layered CSS whatever the specificity. So a utility can never restyle an existing
page by accident — and, the other way round, a module class on the same element as a utility
always wins. That is why a Tailwind file must not also use a CSS Module, and why the three
global element rules a utility has to override (`* { box-sizing }`, `input, textarea, button
{ font-family: inherit }`, `a { color: inherit }`) were moved into `@layer base` in
`globals.css`, where they lose to utilities and still lose to every module.

**Why `properties` leads the layer statement.** Line 1 of `globals.css` and the top of
`tailwind.css` both declare `@layer properties, theme, base, components, utilities;` —
whichever stylesheet the browser meets first fixes the order. Tailwind 4.3 puts its `--tw-*`
defaults for browsers without `@property` (Firefox 111–127, inside Next's supported range) in a
`properties` layer. Left out of the statement, that layer would be appended **after**
`utilities` and reset every `--tw-shadow`, `--tw-translate-*` and gradient stop a utility sets.
Keep the statement the first rule of both files, identical.

Rules, enforced by `components/__tests__/tailwind-contract.test.ts`:

- **Pure Tailwind.** A file that uses utilities imports no `*.module.css`.
- **Every file that writes variant-prefixed utilities is in `@source`**, and every `@source`
  path exists. Automatic source detection is off (`source(none)`): it reads `.gitignore`, and
  the Docker build context has none, so a local build and an image build would scan different
  files. A new Tailwind file therefore means a new `@source` line, or its classes build to
  nothing.
- **Tokens only.** No raw colours — no `#hex`, `rgb()`/`hsl()`/`oklch()`…, and no CSS colour
  names inside arbitrary values (`text-[white]`, `[color:red]`); `transparent`/`currentColor`
  are fine. Colours, fonts, sizes, weights, radii and shadows come from the mapped theme
  ([04](./04-design-system.md#tailwind-theme-mapping)); arbitrary values are for geometry and
  typography (`text-[clamp(16px,2vw,19px)]`, `tracking-[.08em]`) or read a token
  (`z-(--z-header)`, `bg-[radial-gradient(…var(--hero-glow-red)…)]`).
- **No `dark:` variant.** The dark theme is the token remap; a `dark:` class would bypass it.
- **No `!` modifier and no `!important` inside an arbitrary value.**
- **No `.disp`, `.mono` or `.container`** helpers — `font-disp`, `font-hud`, `mx-auto
  max-w-(--maxw)` instead. Tailwind's own `container` utility is switched off
  (`@source not inline("container")`), because `.container` is a global helper.
- **Removing the outline requires a real focus ring.** `outline-none`, `outline-hidden`,
  `outline-0`, `[outline:none]` and `[outline:0]` are allowed only next to a `focus-visible:`
  outline or ring that actually draws something — `focus-visible:outline-transparent`,
  `focus-visible:ring-0` or an offset alone do not count. The one exception is an element that
  only takes programmatic focus (`tabIndex={-1}` on the same tag, e.g. the cookie card).
- **The services glass reveal keys off the stage root** (`entry-glow`, `entry-sweep`): the glow
  under `[data-renderer="webgl"][data-entry="formed"]` and statically on the `fallback` / `off` renderers, never
  `pending`; its one transition only on the WebGL path; `color-mix` only inside its own
  `@supports`; the sweep animated only under `[data-renderer="webgl"][data-entry="burst"]` with motion allowed, by the
  top-level `hud-glass-sweep` (transform and opacity only, opacity ≤ .12); nothing on
  `[data-reveal]` or the intro, no filter, blur or radius. Why: [04](./04-design-system.md#directions--the-hud-screen).

Not enforced by the test, but part of the convention:

- `text-*` sizes carry **no line-height**; add `leading-*`.
- A custom `@utility` that owns `transform` (`cyber-floor`) cannot also run a keyframe that
  animates `transform`: put the animation on a child.
- Hover lifts on anything the intro's entrance moves use the `translate` property, not
  `transform`, so a GSAP `transform` on a wrapper never fights them.
- Avoid opacity modifiers (`bg-red/50`) on anything that carries meaning: without
  `color-mix()` (Firefox 111–112) they fall back to the **full** colour. Prefer a token
  (`bg-glass`, `bg-panel2`, `var(--glow)`); the remaining ones are decorative only.

## 3D, GSAP and the interior stage

Two parts of the site draw with WebGL and run GSAP: the first-visit intro (`components/intro/`)
and, since 2026-09-17, the home page's interior stage (`components/scene/`). They share their
generic helpers in `components/three/`. These conventions exist because each one was either a
real failure, a CSP violation or a weight regression waiting to happen.

**No network, no loaders, no drei.** Both scenes are built procedurally from three core: geometry
from math (`components/intro/three/geometry.ts`, `components/scene/shapes.ts` and
`components/scene/three/*`), for the intro's glass a PMREM environment rendered from emissive strips
(`components/three/environment.ts`; the interior has used no environment since the hero became a
chip, 2026-09-17), a seeded PRNG for particles (`components/three/random.ts`). Nothing is
fetched — no HDRs, fonts, GLTF, Draco/KTX2/Basis decoders, no wasm, no workers — because the
nonce-based CSP in `proxy.ts` would block them, and they would pass every local check and fail
only in the browser. ESLint (`eslint.config.mjs`) therefore **bans**, both as `import` and as
`import()`: `@react-three/drei`, three's `loaders/*`, `libs/*`, `physics/*`,
`utils/WorkerPool(.js)` and the `Addons(.js)` barrel (in both `three/addons` and
`three/examples/jsm` spellings, plus the bare `three/addons`), `three-stdlib`,
`troika-three-text` and `@dimforge/*`. The rule's option is set globally, so any future
`no-restricted-imports` / `no-restricted-syntax` rule must be merged into that block — flat
config replaces the whole option.

**Per-frame writes live in plain `.ts` modules, not in components.** The React Compiler lint
(`react-hooks/immutability`) flags assignments to objects a hook returned; plain TypeScript
helpers called from `useFrame` keep the components to "create once, call per frame, dispose":
`components/intro/three/{rig,core,particles}.ts` for the intro; `components/scene/three/world.ts`
(which composes the frame), `components/scene/fx.ts`, `input.ts` (the tilt listeners, which also
lay the cursor trail), `trail.ts` (the trail's ring buffer; `three/trail.ts` uploads what it
wrote), `workHelix.ts` (Work's spiral driver, which writes the project cards' inline layout) and
`scrollProbe.ts` (the director's writes into the probe) for the interior. The intro director
never re-renders React per frame either: it writes `textContent`, attributes and `quickSetter` values straight to the DOM,
and tweens a plain `fx` object the scene reads.

**Dispose everything you create.** Geometries and materials are disposed by the modules that
build them (`core.ts` / `particles.ts` in the intro, `world.dispose()` in the interior), the intro's
PMREM generator and its render target in `environment.ts`. R3F 9.7 calls `forceContextLoss()` 500ms
after unmount but never `renderer.dispose()`; `components/three/renderer.ts` (`retainRenderer`)
adds it (deferred one tick so StrictMode's remount doesn't dispose a live renderer) and guards
against losing an already-lost context. The renderer is created up front by that module
(`useRendererFactory` in `components/three/hooks.ts`), because a failing `new WebGLRenderer()`
inside R3F becomes an unhandled rejection that never reaches an error boundary.

**Colour tokens read at runtime must stay hex or `rgb()`.** The intro reads `--red`,
`--red-lift`, `--blue`, `--dark-cyan`, `--dark-txt` and `--void` (`components/intro/three/materials.ts`,
`PALETTE_TOKENS`); the interior reads `--cyan`, `--blue`, `--blue-text`, `--red-lift`,
`--red-text`, `--txt` and `--bg` (`components/scene/three/palette.ts`, `SCENE_TOKENS`; `--on-accent`
left with the glass core), and re-reads them when `data-theme` or `prefers-color-scheme` changes.
`THREE.Color` cannot parse `color-mix()` or `oklch()`. Changing one of these tokens to another
format throws a descriptive error: the intro falls back to the SVG, the interior's error boundary
keeps the static art (a later theme change that cannot be read keeps the previous palette).

**The FPS governor replaces drei's `PerformanceMonitor`** (`components/three/governor.ts`,
re-exported by the intro's `three/rig.ts`, unit-tested): ~1s windows; two slow ones step the DPR
down to 1×, then to "lite" (terminal); three fast ones step back up; a flip budget stops
oscillation; frame gaps over 0.5s are stalls, not a measure; a steady cadence ≥24 fps counts as a
refresh cap (`CAP_STEADINESS` 1.25, `CAP_SLACK` 0.8, `CAP_MIN_FPS` 24). **`bail` is opt-in**
(`bailFps` > 0): once lite, `bailWindows` slow windows in a row return `"bail"`, which is terminal.
The intro passes no bail options; the interior passes 28 fps × 4 windows unless the scene is
forced (QA and E2E must stay deterministic on SwiftShader). Materials are never swapped mid-scene
— that would recompile shaders; the interior's light/dark switch changes blend factors only
(every material is `CustomBlending`, so three's program cache key does not change).

**GSAP rules.** Import `gsap` and `gsap/ScrollTrigger` only (ESLint bans `gsap/all`,
`gsap/dist/*`, ScrollSmoother and `gsap-trial`, as `import` and as `import()`). Everything is
created inside `useGSAP`'s context, so unmounting reverts every tween and inline style. The intro
director sets `gsap.ticker.lagSmoothing(0)` for its lifetime (restored to `(500, 33)`): the intro
is a wall-clock sequence, and a stretched burst could outlive the watchdog; nothing else touches
the ticker. A director only tweens elements that have **no** CSS animation or transition on the
same property.

**Keep the SVG fallback cheap.** It is what devices without a usable GPU see for the whole
intro: no CSS `filter` on anything that moves (the halo's blur is an SVG `feGaussianBlur`,
rasterised once), transform and opacity only in its burst, and its animations pause while the
WebGL scene draws.

**The overlay's hooks are a contract.** `#tbs-intro[data-testid="intro"]` with `data-phase`,
`data-renderer` and `data-live`; `data-part="…"` on everything the director drives;
`role="progressbar"`; the skip button's name is exactly the `intro.skip` key. Tests and the
cookie banner (which reads `data-live`) depend on them — don't rename them in passing.

### Lazy by construction — the heavy-import ban

three.js + R3F (~240 KB gzip) and GSAP load only behind the capability probe, through
`next/dynamic` or `import()`. A static import in a module the page bundle reaches would ship them
to every visitor, and nothing but a weight measurement would notice — so it fails lint.
`eslint.config.mjs` has a file-scoped block over `app/**`, `components/sections/**`,
`components/layout/**`, `components/ui/**`, `components/fx/**`, `components/hud/**` (the HUD
chrome's mount and its lazy parts), `components/scene/SceneStage.tsx`,
`components/scene/art/**`, `components/scene/shapes.ts`, `components/three/RenderErrorBoundary.tsx`,
`components/three/capability.ts`, the intro's up-front files (`IntroPreloader.tsx`,
`IntroFallback.tsx`, `lemniscate.ts`, `capability.ts`, `tiers.ts`) and `lib/**` (tests excluded).
In those files a **static value import** of any of these is an error:

- the packages `three`, `@react-three/fiber`, `gsap`, `gsap/ScrollTrigger`, `@gsap/react`;
- **any subpath** of them (`three/*`, `@react-three/fiber/*`, `gsap/*`, `@gsap/react/*` — e.g.
  `gsap/ScrollTrigger.js`, `gsap/Observer`, `three/webgpu`);
- **the site's own modules that carry them**, in any spelling (`HEAVY_MODULES_REGEX`):
  `three/runtime`, `SceneCanvas`, `SceneWorld`, `SceneDirector`, `IntroScene`, `IntroDirector` —
  `@/components/three/runtime`, `../scene/SceneWorld` and `./IntroDirector.tsx` all match.

`import type` is erased at build time and stays allowed; `import()` stays allowed (that is how
they load). Flat config **replaces** a rule's options per matching block, so this block repeats
the CSP and GSAP bans (`restrictedImports({ heavy })`); any new `no-restricted-imports` entry
goes into that helper. `components/__tests__/scene-contract.test.ts` mirrors the file list, the
subpaths and the regex, and reads them straight out of the source. A module added to the page
bundle's up-front path goes into both lists.

### The 3D runtime module

**A three.js scene is reached only through `components/three/runtime.tsx`**, and only with a
dynamic `import()` (`next/dynamic` for a component). It re-exports `IntroScene` and
`SceneCanvas`. Turbopack builds a chunk group per `import()` target and does not share a vendor
chunk between groups: two targets that each import three.js shipped two byte-identical copies
of three + R3F. One target means one chunk, downloaded once and served from cache to the other
scene. A new scene is exported from the runtime module, never given an `import()` of its own.
Nothing may import the runtime statically (the ban above).

### GSAP and ScrollTrigger

The interior director (`components/scene/SceneDirector.tsx`) is ScrollTrigger's only user.

- **Measure, don't drive.** Four animation-free triggers give the scroll spans (`heroExit`:
  `#top` "top top" → "bottom 35%"; `entry`: the services anchor "top 90%" → "top 75%";
  `workSpan`: Work's track (`[data-work-track]`) "top 70%" → "top 55%"; `helix`: the track "top
  top" less the header → "bottom bottom"), and every refresh re-reads the anchors' and the
  track's document boxes, Work's heading block, the stage's top/bottom, the layer's height and
  `--header-h` into the probe (`scrollProbe.ts`). The scene reads `window.scrollY` against them
  every frame. No scrub drives the scene — it would lag the page by a frame. A measuring trigger
  has no `animation` and reads its span in `onRefresh` (`scroll-guard.test.ts` pins exactly these
  four, with their start and end).
- **A picture that must not rest half-way runs on a timed gate, not a scroll progress.** The
  director only measures the band; the scene's `stepGate` (`fx.ts`) arms at its end, disarms
  above its start (hysteresis) and runs the value in time on the clamped frame step. There are two:
  the services entrance (`fx.entry`, `ENTRY_SECONDS`) and the Work handoff to the helix
  (`fx.work`, `WORK_SECONDS`). A new threshold effect gets its own `Gate` in `SceneFx` and its own
  branch in `composeScene`, never a scrubbed progress. Whether it has finished is the scene's to
  report (`onEntry` → `data-entry`, `onHelix` → `data-helix`), never the director's.
- **The work gate only opens onto a helix that can be drawn.** The world passes `stepSceneFx` the
  `workSpan` band only while the helix is built, the spiral driver's mode is not `off` and the
  track is measured; otherwise the gate gets no band (it stays shut, and an open one closes in
  time). Two gates never run against each other: while the Work gate is armed the entry gate sits
  on its armed value, and an entry gate disarmed above the services snaps the Work gate shut.
- **The scene may change the page's layout in one place only — Work's spiral — and says so.**
  When the driver switches mode the track's height changes at once; `SceneWorld` dispatches
  `SCENE_LAYOUT_EVENT` (`tbs:scene-layout`) on the stage root, and the director re-reads the boxes
  into the probe right then (never under a cover), without a ScrollTrigger refresh (a refresh
  would stop a touch fling). The stage's own resize refresh still follows for the spans. Any
  future layout change the scene makes goes through the same event.
- **Never** (`scene-contract.test.ts` scans `components/scene/**`): `pin`, `pinSpacing`,
  `pinReparent`, `anticipatePin` (spacers shift every anchor), `snap` (inline `scroll-behavior` on
  html/body), `normalizeScroll`, ScrollSmoother, `markers`, a custom `scroller`, `lagSmoothing`.
  No inline style on `<html>`, `<body>` or an entrance marker, ever — the forced-WebGL E2E checks.
- **Register when the chunk evaluates**, outside any GSAP context, so a director unmounting never
  reverts ScrollTrigger's own one-time setup. Everything the director creates lives in one
  `useGSAP({ scope: stage, dependencies: [] })` context.
- **The smooth-scroll guard** (`scrollGuard.ts`): `html { scroll-behavior: smooth }` and a
  ScrollTrigger refresh (which jumps to 0 and back) disagree. The guard marks window's scroll
  functions non-smooth and holds `html[data-scroll-measure]` (`scroll-behavior: auto` in
  `globals.css`) from `refreshInit` to `refresh`. It relies on gsap 3.15.0's order of events — gsap
  is pinned exactly for this.
- **When to refresh:** a `ResizeObserver` on the **stage** (not `<main>`: a height change below
  the stage cannot move anything the probe holds), debounced 200ms, only for a change of 1px or
  more, **deferred while the visitor is scrolling** (a refresh would stop a touch fling), and
  skipped if ScrollTrigger's own refresh already measured since; plus `pageshow` with `persisted`.
- **Never measure under a cover.** A dialog pins `<body>` (`position: fixed; top: -scrollY`), so
  `scrollY` reads 0 and every box reads the scroll offset too high. While `isPageCovered()` the
  probe keeps its last good values and the director's own refreshes wait; a refresh ScrollTrigger
  ran anyway is redone one frame after the cover lifts. **Every page lock releases its cover
  last** (`Modal`'s body lock after restoring the body styles and `scrollTo({ behavior:
  "instant" })`; `lockRootScroll` after its own restore), so whoever hears it lift finds the page
  in place.
- **Quiet while unused.** ScrollTrigger runs a rAF loop and a 250ms interval for as long as it is
  enabled, triggers or not. A layout effect declared **before** `useGSAP` wakes it on mount
  (`wakeScrollTrigger`) and quiets it a microtask after unmount (`quietScrollTrigger`, only when no
  trigger is left). A wake records the gsap listeners and matchMedia that `enable()` adds, and the
  next quiet removes them, so navigating back and forth never stacks them.
- **Parallax targets** (`parallaxTargets`): any `[data-parallax="<layer>"]` under the stage,
  **except** an element that is itself an intro entrance marker (`[data-intro-reveal]`), a
  scroll-reveal element (`[data-reveal]`, whose transition owns `transform`), `<html>` or `<body>`.
  Wrap the marker instead (`hero-backdrop` and `hero-stats` are wrappers). Desktop only
  (`PARALLAX_MEDIA`), inside `gsap.matchMedia()` so it reverts with the context.

### The interior stage's contracts

- **The stage DOM** (`SceneStage.tsx`): no `transform`, `filter`, `contain` or `overflow` on the
  stage, on any ancestor of the sticky layer or on any ancestor of Work's cards (each card is
  `sticky` in the spiral, and its negative `z-index` must reach the stage's stacking context); the
  canvas is `pointer-events: none`; no new z-index token. Details in
  [03 — Architecture](./03-architecture.md#the-interior-stage).
- **The `data-*` contract** (names in `SCENE_ATTR`, `lib/scene.ts`): React writes
  `data-renderer`, `data-reason`, `data-tier`, `data-paused` (only while `webgl`) and
  `data-motion`; `data-boost`, `data-quality`, `data-morph`, `data-entry` (`idle|burst|formed`,
  only while a scene is mounted), `data-helix` (`spiral|ambient`, likewise; never `off` or
  `built` — those remove it) and the director's `data-scroll-fx` are written **straight to
  the DOM**, never through React state. On Work: `data-work-track` (the card grid,
  `WORK_TRACK_ATTR`) and the driver's `data-helix-front` on one card (`HELIX_FRONT_ATTR`,
  `helix.ts`). Test ids `scene-stage`,
  `scene-hero`, `scene-services`; anchors `data-scene-anchor="hero|services"`; art roots
  `data-core-art` / `data-shape-art="<slug>"`; `data-hologram`, `data-metric`, `data-tilt`,
  `data-tilting`, `data-parallax`, `data-shape`. Tests and CSS selectors read these — don't rename
  them in passing.
- **`lib/scene.ts` stays DOM-free at import and has no `"use client"`**: server components and
  `e2e/helpers.ts` import it. Anything that needs `window` checks for it first.
- **Work's cards belong to React; their layout, in the spiral, to the scene chunk's driver**
  (`workHelix.ts`, see [03](./03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17)).
  The rules it keeps, and that anything else touching those cards must keep with it:
  - **it only switches into the spiral while Work is below the viewport** (the section's rect,
    read in the frame that lays it out; an IntersectionObserver may only veto) — the track grows
    by thousands of px, so doing it on screen would jump the page. It leaves the spiral at once,
    and then puts the scroll back under the visitor;
  - **the restore contract**: every property it writes is inline and listed (`CARD_PROPS`,
    `TRACK_PROPS`); the original `style` attribute comes back byte for byte when nobody else
    touched the style meanwhile, otherwise only its own properties are removed. Read the `style`
    attribute before removing it (Blink serializes a CSSOM-written style lazily and would leave
    `style=""`). The E2E checks the round trip (W15);
  - Work itself renders only `--p1` / `--p2` inline and no card `transform` or `position`
    (`work.test.tsx`); a CSS rule for the grid that must not apply in the spiral keys off
    `[data-scene-stage][data-helix=spiral]` (the odd last card's screenshot shift does);
  - **a card is never capped below its content**: the spiral writes `min-height`, never `height`
    (a card clips with `overflow: hidden`, and its description may be showing), and centres each
    card's measured box under the header — a ResizeObserver re-centres it when the content changes.
    Work's own description cap (`max-h-35`, the reveal's transition) is lifted inside the spiral
    (`[data-scene-stage][data-helix=spiral] …:max-h-none`, only where the description is shown):
    at a spiral card's 240px a long description runs past 140px;
  - never touch tab order, `inert` or `aria-hidden`; focus scrolls a card to the front.
- **Decoration never sits behind copy it could make unreadable.** The ambient helix first lay
  behind Work's heading; its flares saturate towards white, and keeping the heading's contrast left
  it invisible. It now lies in the measured empty band above the heading (`probe.workGap`, clear of
  the band's edges by `HELIX_AMBIENT.clear`). A new scene part next to text gets a band of its own,
  measured into the probe, before it gets a dim.
- **Nothing heavy up front on the WebGL path either**: the scene is **built** one part per idle
  slice (core, swarm, each model) and **compiled** one draw object per idle slice
  (`components/scene/three/compile.ts`); it is **ready** only once R3F has drawn two frames of the
  compiled scene, counted from `useFrame` — never from a timer, which also ticks while the canvas
  is paused. A part that is not needed for the first picture is built **after ready**, the same
  way (Work's helix: `stageHelix`, one build slice, one compile slice per draw object).
- **The transmission clear is compensated in one place** — the intro's glass only: since the hero
  became a chip (2026-09-17) the interior has no transmission pass. `installTransmissionClear`
  (`components/three/environment.ts`) pre-compensates three's output-space conversion of the clear
  colour while the canvas is bound (`linearTargetClearColor`), so the linear transmission target
  really gets the page colour. A scene passes the **plain** page colour; converting it itself
  applies the compensation twice.
- **The interior draws with five programs (P2–P6), and new parts reuse them** (`three/materials.ts`).
  The hero chip and the cursor trail added none: they are box edges, a plasma surface, lines and
  flat ribbons like the service models. A mode is a `uMode` branch, and a retired mode keeps the
  others' numbers: `TUBE_MODE` has had no 0 since the core's rings left; `POINTS_MODE` has no 0
  since the core's cloud left, and no 3 since the mesh wave's nodes became `+` lines in P4
  (2026-09-17, the brand-ui grid: `swarm` 1 and `pulses` 2 remain). Work's helix added no program
  either, only two modes: `SURFACE_MODE.holo` (4; 3 was the glass shell's) for the hologram and
  `LINE_MODE.bits` (4) for its 0/1 glyphs.
- **The static art** (`components/scene/art/`): no `"use client"`, tokens only, no infinite
  animation, nothing animated on `stroke-dashoffset` or `filter`, no `circle` under r=12, no round
  line caps, `aria-hidden` with no text; hidden under `[data-renderer="webgl"]`. Only the first
  direction's drawing is passed from `page.tsx` (a prop is serialised into the RSC payload); the
  others load with `next/dynamic` on first selection. See
  [04 — Design System](./04-design-system.md#static-art-componentssceneart).
- **No decorative dots.** No small round box (a dot-sized `size`/`w`/`h` with `rounded-full`,
  `rounded-pill` or `rounded-[50%|999px|9999px]`), no blinking pip, no glowing full stop — in the
  header, the hero, the ticker, Directions, Work, the stage or the art. `decorative-dots.test.tsx`
  scans the source and the render; the E2E scan checks the page. Exceptions: the dictation
  button's recording light, "✓" markers, "·" in copy, the red full-stop glyphs, the intro
  fallback.
- **Tilt and first-tap rules are shared, not copied**: `lib/tilt.ts` + `components/fx/usePointerTilt.ts`
  (mouse only, never reduced motion, one rAF write), `lib/tapIntent.ts` (`shouldInterceptTap`, the
  header dropdowns and the direction pills).

### `data-intro-reveal` — the page entrance targets

The page elements the intro animates in carry `data-intro-reveal="grid|header|eyebrow|title|
lead|cta|stats|ticker"` (`INTRO_REVEAL_ORDER` in `lib/intro.ts`).

- **Exactly one element per target** on the home page, and **no inline `style`** on any of
  them once the intro is over.
- **No CSS may target `[data-intro-reveal]`.** Without an intro — a returning visitor, reduced
  motion, a test — nothing is hidden: the page is simply there. A rule that hid them "until the
  entrance" would blank the page for everyone the intro skips.
- **No CSS transition or animation on `transform`, `opacity` or `filter` on a marked
  element** — GSAP writes those.
- **`header` and `stats`: transform only.** An opacity or filter on `<header>` (or on the glass
  cards) makes it the backdrop root of its own glass and switches the blur off mid-entrance.
- **`title`: never opacity.** The `<h1>` is the LCP element and must paint at full opacity
  under the overlay.
- **`cta` and `ticker` mark the wrapper**, never the button (its hover lift) or the ticker's
  CSS-animated track.
- **No parallax, tilt or other inline style on a marker** (2026-09-17). The hero's parallax
  moves wrappers inside the `grid` marker and around the `stats` marker; the stat cards tilt
  inside it. `parallaxTargets` refuses a marker, and the forced-WebGL E2E checks that no marker
  keeps a `style` attribute after scrolling.

`components/__tests__/intro-reveal-contract.test.tsx` renders Navbar, Hero and Ticker in all
three languages and checks one marker per target with no style attribute, and scans
`globals.css`, `tailwind.css` and every `*.module.css` for a selector on the attribute.

## The HUD chrome (`components/hud/**`, `lib/hud/**`)

The IT-OS HUD (the Ghid TBS guide since Phase 4, the fibre scroll rail since Phase 5; the OS
layer later) is built to these rules. Wiring in
[03](./03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17), the visual contract in
[04](./04-design-system.md#cyber-dark--neon-cyan--obsidian-black).

- **One mount.** Every part is a `next/dynamic(…, { ssr: false })` entry in `PARTS` in
  `components/hud/HudChrome.tsx`, rendered by `app/(site)/layout.tsx` between `<Footer />` and
  `<CookieConsent />`. A part is never imported anywhere else, so nothing of it reaches the page
  bundle or the HTML, and nothing loads before the gate opens (flag → consent → interaction →
  intro gone → idle). A part also renders nothing on its own while the banner is unanswered or
  the intro is on screen. A part that exists only on desktop (the rail) is flagged
  `desktopOnly: true` in `PARTS`: HudChrome renders it through `DesktopOnly`, a
  `useSyncExternalStore` over `matchMedia(HUD_DESKTOP_MEDIA)`, never with a CSS-only hide, so a
  phone never downloads it and a breakpoint crossing mounts or unmounts that part alone. Its own
  module CSS still carries a `max-width: 860px` `display: none` as a safety net.
- **CSS Modules, not Tailwind.** One `*.module.css` per part, next to it; keyframes in the same
  file; not in `@source` (so the global Tailwind chunk and the HTML do not grow — the module
  becomes a lazy CSS chunk with the part). Tokens only, as everywhere (`--neon-cyan`,
  `--glass-bg-solid`, `--z-guide`, `--hud-*`); the placement boxes in docs/04 are the contract
  and may be literals.
- **Root attributes.** Every part's root carries `data-hud=""` plus its own name (`data-guide`,
  `data-rail`, later `data-os-layer`, `data-hud-dock`). E2E finds the HUD by `[data-hud]`, and
  `decorativeDots` scans inside it.
- **Away and yield hide by opacity only.** `opacity: 0`, `pointer-events: none` and the part's own
  buttons at `tabIndex -1` — **never** `display: none`, `visibility: hidden` or `inert`, so the
  request dialog can still hand focus back to a HUD button. Away is "the section-layout request
  form (`[data-testid="request-flow"][data-layout="section"]`) intersects the viewport"; yield is
  "the focused element overlaps the part" (`lib/hud/obscure.ts`). No `animation-fill-mode` that
  would outrank the faded opacity.
- **Covered means held back, not hidden.** While `isPageCovered()` (the dialog, the burger, the
  intro's lock) a part shows no new prompt and clears a shown one, and the rail neither measures
  nor writes (the page's positions are not real while the body is pinned; the same holds while
  `html[data-scroll-measure]` is set); the z-order (`--z-rail` 104, `--z-guide` 112 <
  `--z-nav-overlay` 115) does the covering.
- **No blur, no filter.** No `backdrop-filter` or `filter` on a part or any ancestor of a CSS
  `preserve-3d` element: it sits over the live WebGL canvas, and a blur flattens the 3D.
  Solid glass (`--glass-bg-solid`, composited over `--bg` when page text can sit under it) plus the
  Neon Cyan ring instead.
- **No dots.** Bars, streaks, squares; a ring is ≥38px. `decorative-dots.test.tsx` scans each
  part's TSX and CSS Module (`border-radius: 50%` or `var(--r-pill)` at ≤8px fails, a
  `var(--token)` size resolved against the file).
- **Motion** (WCAG 2.2.2): short bursts only (an entrance, a pulse of ≤5s, the rail's 0.7s tick
  pulse), continuous motion only while hovered (`(hover: hover)`) or scrolled (the rail's flow
  streak: `data-flowing`, dropped 180ms after the last scroll event); every animation and
  transition inside `@media (prefers-reduced-motion: no-preference)`. Something that follows the
  scroll position itself (the rail's thread and head) is the visitor's own movement, not an
  animation.
- **No writes to `<html>` / `<body>`.** A part's live values go on its own root — the rail's
  `--rail-p` through `style.setProperty` on `[data-rail]`, only when the 4-decimal value changes —
  and every placement token is a static stylesheet value. `expectRootUntouched` checks it after
  the rail's jumps and a full scroll.
- **Listen passively, never take the scroll.** Window `scroll` and `resize` listeners are
  `{ passive: true }` and coalesced to one `requestAnimationFrame` per burst; layout changes come
  from a `ResizeObserver` on `<html>` and the scene's `tbs:scene-layout`. No `wheel`, `touchstart`,
  `touchmove` or pointer listener, nothing that could `preventDefault` a scroll: the native
  scrollbar stays the page's scrollbar, and a part scrolls the page only when the visitor asks (a
  rail marker: `scrollTo`, smooth, or `"instant"` under reduced motion). The arming listeners
  (capture, passive) are HudChrome's and go the moment one fires.
- **No new storage keys and no cookies** (memory is a module variable); `tbs_hud` is read, never
  written.
- **Imports.** No three, R3F or GSAP (the heavy-import ban above covers `components/hud/**`);
  `lucide-react` only here, by name from the package root, `aria-hidden`, `strokeWidth={1.75}`,
  square caps. Pure decisions live in `lib/hud/*.ts` (no DOM at import, no directive) and are
  unit-tested there.
- **Copy** is `{ ro, ru, en }` objects in the part's own `copy.ts` (no directive, type-only imports,
  so the E2E specs import it), and never "AI" (see
  [16](./16-i18n-seo.md#the-hud-chrome-adds-no-keys)). **No key is ever added to the catalog** —
  but a part reuses an existing key (through `useT()`) where the site already names the same thing:
  the rail's home markers are `nav.services`, `nav.work`, `nav.about` and `nav.team`, the header's
  own words, so the rail and the menu cannot disagree (critique R10.4). Everything the catalog does
  not already name stays an `L()` object in `copy.ts`.

## Components

- **One section = one component**, presentational, in `components/sections/`.
- Extract repeated bits (section label, mono tag, reveal wrapper) into `components/ui/`.
- Keep components typed (TypeScript); avoid `any`.

## Language & i18n

- **Romanian is the source UI language** (matches the design) and the fallback for RU/EN.
  Keep diacritics correct (ă, â, î, ș, ț).
- **Never hardcode visitor-facing copy in a component.** It is either:
  - a **catalog key** — add it to `lib/i18n/messages/ro.ts` (which types the catalog) *and*
    to `ru.ts` + `en.ts`, then read it with `const t = useT(); t("key")`; or
  - a **localized content field** — `{ ro, ru, en }` (`LocalizedText`), seeded with
    `locFromCatalog()` / `locRo()` and rendered through `const l = useLoc(); l(field)`.
- **Code, comments, docs, identifiers: English.**

Details and gotchas: [16 — i18n & SEO](./16-i18n-seo.md).

## Git & change tracking

- Commit in focused, reviewable chunks (e.g. one section per commit).
- **Every commit that changes behaviour adds an entry to [`CHANGELOG.md`](../CHANGELOG.md)**
  — the project's change zone — and updates the doc in `docs/` that covers the area. A
  behaviour change with no doc update is an unfinished change. The rule is restated for
  agents in [`AGENTS.md`](../AGENTS.md).
- A new public page must be added to `app/sitemap.ts`; a new doc must be added to the table
  in `README.md`.
- Don't commit secrets or `.env` (the `.env.example` templates *are* tracked, on purpose).
