# 05 — Page Sections

The landing page is a single scroll, top to bottom. Sections carry a mono index label
(`/01`, `/02`, …). Below is each section, its purpose, and where its content comes from.

> Order in `app/(site)/page.tsx` today: Hero · Ticker · Directions · Work · Principles · Team ·
> RequestSection · BottomCTA. All visitor-facing copy is localized —
> see [16 — i18n & SEO](./16-i18n-seo.md). For what is still a stub, see
> [06 — Placeholder Rules](./06-placeholder-rules.md).
>
> The first screen — intro, header, hero, ticker, cookie banner — was redesigned as a HUD on
> 2026-09-16, and the interior on 2026-09-17: the 3D stage behind Hero → Ticker → Directions,
> the holographic stat cards, and Directions and Work rebuilt as HUD sections. Both are
> described below as built. Principles, Team, the request section and BottomCTA predate them
> and are due their own pass; `Services` and `Partners` below are not rendered by any page
> today.

## First-visit intro (preloader)

A full-screen HUD overlay that plays **once per browser session**, on a **hard load of the home
page** (`/`, `/ru`, `/en`): a glass ∞ with orbiting particles, the readout
`SYSTEM_SYNCHRONIZATION: NN%`, then `ACCESS_GRANTED`, a burst that flies into the camera, and
the page coming in underneath. Wiring (gate, loading tiers, ownership) is in
[03 — Architecture](./03-architecture.md#the-first-visit-intro); timings live in
`INTRO_TIMING` (`lib/intro.ts`).

**The page is never hidden.** The `<h1>` and everything else are server-rendered and painted
at full opacity *under* the overlay; the overlay has no `role`, no `aria-hidden` on the page,
no focus trap, and a screen reader can browse the page at once.

### Phases (`data-phase` on `#tbs-intro`)

| Phase | What is on screen | Notes |
|-------|-------------------|-------|
| `boot` | Server HTML: the void, the perspective grid floor, the CSS-animated SVG ∞, and `SYSTEM_SYNCHRONIZATION: ▮` with no number | No JS yet. The skip button and the counter stay hidden until JS takes over. A CSS failsafe is armed: at **7s** the overlay fades out and becomes click-through on its own |
| `run` | The counter runs 00 → 99; heartbeats at 25/50/75% | JS took over (`data-live`, which cancels the failsafe). Page scroll is locked (and reset to the top unless there is a hash), skip inputs are live, a **9s** watchdog runs in visible time |
| lock → burst | `100` and `ACCESS_GRANTED`, an implosion, then the burst: the ∞ scales up, particles fly out, the camera dollies in, a white flash and a shockwave; the HUD and skip fade | The "confirm" tone plays only if sound is on **and** the visitor already interacted (a skip counts) |
| `revealed` | The overlay fades out over .55s; the page entrance plays underneath | `finishIntro({ played: true })`: the session cookie is written and `tbs:intro-done` fires, so the cookie banner may appear. Nothing in the overlay catches a click from here on |
| `leaving` | A plain 300ms fade | The exit without the director: watchdog, an error, or a skip before the director's chunk arrived |
| gone | — | The overlay is removed when the entrance ends (or ≤3s after reveal as a safety net); the hero's background animations resume |

**Progress is honest, not a fake timer.** The target is weighted readiness — hydration .15,
`document.fonts.ready` .15, `window` `load` .30, the WebGL scene ready .40 — capped by a
cinematic curve that takes at least **2.4s** from navigation start, and forced to 100% at
**5s** whatever is still loading. The counter never shows 100 before the lock, and
`aria-valuenow` moves in steps of 10 (≤90 until the lock, then 100). If the WebGL scene is not
ready by 80% of the progress, the burst plays on the SVG.

**Page entrance** (GSAP, `expo.out`, ≤1.5s after reveal), one marked element per target
(`data-intro-reveal`): grid (opacity + scale) · header (`yPercent` only) · eyebrow and lead
(y + blur) · title (y, scale, blur — **never opacity**, it is the LCP element) · CTA wrapper ·
stats (y + `rotateX`, transform only) · ticker (y). The low tier drops the blurs. Every inline
style is cleared afterwards.

### Skip

- The **"Sari peste intro"** button (44px, with an `ESC` key-cap on fine pointers; never
  autofocused, but the first Tab stop on the page).
- **Keys:** Escape, Enter, Space, Tab (and Shift+Tab), the four arrows, PageUp, PageDown,
  Home, End. Combinations with Ctrl, Alt or Meta are the browser's and are ignored.
- **Pointer:** a primary-button press anywhere, or the mouse wheel.

A skip plays the same burst **2.4× faster**; repeated skips only ever speed it up. While the
intro runs, a skip key is **spent on the skip**: it is stopped at document capture, so the cookie
banner's Escape or a menu's arrow keys never see it — but Tab still moves focus.

**Where the skip button sits:** bottom-right on desktop; centred at the bottom on phones in
portrait (≤640px wide); top-right on short screens (≤480px tall, i.e. landscape phones), where
the readout sits near the bottom edge.

### When it does not play

| Case | What happens |
|------|--------------|
| Same browser session, `tbs_intro=seen` | The server renders no overlay; no intro JS, no GSAP, no three.js |
| Any page but the home page (`/servicii/*`, legal pages) | Never — the gate is `x-pathname === "/"` |
| Client-side navigation inside the site (a service page → Home, Back) | Never — the layout that holds the gate is not re-rendered |
| Client-side navigation **into** the site (the admin's "view site" link) | The shell renders nothing and sets no cookie; the next hard load of `/` plays it |
| `prefers-reduced-motion: reduce` | Hidden by CSS before hydration, then finished silently (`played: false`, cookie set); GSAP is never requested |
| A `/#section` deep link whose target exists | Hidden by CSS (`html:has(:target)`) and bypassed after hydration — the visitor asked for a place on the page |
| JavaScript disabled | Hidden by a `<noscript><style>` rule; no cookie |
| JavaScript late (the CSS failsafe clock is past 6.4s) | Bypassed, so a half-faded overlay never snaps back |
| JavaScript never arrives (blocked or broken chunk) | The CSS failsafe fades it out at 7s and makes it click-through |
| Hidden tab | Not a bypass: the progress clock and the watchdog stop while hidden; a tab opened in the background starts on first view |
| Print | Hidden |

### SVG fallback or WebGL

The shell probes the device once, after hydration, from a ~1 KB chunk
(`components/intro/capability.ts`), in this order: `ResizeObserver` → reduced motion →
Save-Data → a WebGL2 context on a detached canvas (`failIfMajorPerformanceCaveat`) → who draws
it. The context is released straight away. Since 2026-09-17 the probe is the site's shared one
(`components/three/capability.ts`) and its answer — booleans only — is kept for the tab in
`sessionStorage.tbs_gpu_probe`, so a reload and the interior stage never create a throwaway
context again.

- **The software-renderer rule.** A context drawn by a CPU rasteriser — SwiftShader (also
  headless CI Chromium), Mesa llvmpipe/softpipe, WARP ("Microsoft Basic Render Driver"),
  "Software Rasterizer" — counts as **no WebGL**: `failIfMajorPerformanceCaveat` does not
  reliably refuse them, and a glass tube at 5 fps is worse than the SVG.
- **No usable WebGL** → the **SVG fallback** (`IntroFallback.tsx`) carries the whole intro,
  including a DOM-only burst (transform and opacity only, no filters).
- **Usable WebGL** → the three.js chunk is requested and the scene cross-fades in once its
  shaders have compiled and two frames have drawn; the SVG's CSS animations pause behind it.
  A lost context, an error or a scene not ready by 80% hands the stage back to the SVG.
- **Tiers** (`detectTier`): **low** with ≤4 cores or ≤4 GB memory (when the browser says);
  **mid** on a touch-first device or a viewport under 600px on its short side; **high**
  otherwise. High gets transmission glass with a procedural environment, a halo, 24 scan rings,
  900 particles and DPR up to 2 (within a pixel budget); mid a fresnel shader, 16 rings, 540
  particles, DPR ≤1.5; low 240 particles and DPR 1.
- **FPS governor:** two slow 1s windows (under 45 fps on high, 40 on mid/low) drop the DPR to
  1×, then to "lite" (no halo, no rings, half the particles). A **steady** cadence of 24 fps or
  more is a refresh cap (iOS Low Power Mode, Chrome Energy Saver), not slowness, and costs no
  quality.
- **QA switch:** `localStorage.tbs_intro_3d = "force"` skips the caveat and the renderer check,
  so the WebGL scene runs even on SwiftShader. It changes what is drawn, never what the page does.

The overlay is **always dark**, in the light theme too, and has rules for `prefers-contrast:
more` (no CRT lines or glows) and `forced-colors` (system colours, no decoration).

## Header (Navbar)

`components/layout/Navbar.tsx`, in Tailwind. A sticky glass bar with a red neon hairline at
the bottom: 71px tall (`--header-h`), 77px between 641 and 860px, where the language group is
taller — as before the rewrite. DOM order is a
contract the tests read: the logo, the clock, the desktop `<nav>`, the preferences group,
the CTA as its very next sibling, the burger.

- **Logo** `TBS.` — the full stop a plain red glyph, with no glow or halo (the decorative dots
  went on 2026-09-17) — the first link (`#top`), a 44px box at every width.
- **Clock** `SYS_TIME 12:04:08 UTC+3` (`HeaderClock.tsx`): Chișinău time with its real offset
  (UTC+3 in summer, UTC+2 in winter) whatever the visitor's time zone. Decorative and
  `aria-hidden`; the server renders `--:--:--`. The bar clock only ticks where it is on screen:

  | Width | In the bar | In the burger menu |
  |-------|------------|--------------------|
  | < 641px | hidden | full, next to the "×" |
  | 641–860px | short `12:04:08 UTC+3` | — |
  | 861–1024px | hidden (the nav and the CTA need the room) | — |
  | 1025–1179px | short | — |
  | ≥ 1180px | full `SYS_TIME 12:04:08 UTC+3` | — |

- **Desktop nav** (`<nav aria-label="Principal">`, from 861px): SERVICII · COMPANIE · DESPRE.
  An item with a dropdown carries a separate `aria-hidden` "+" that turns into "×" while open.
  Dropdowns are glass panels, always in the DOM, opened by CSS (`menu-open`) before hydration:
  - **mouse:** real hover opens (only under `(hover: hover)`, so touch tablets don't get a
    sticky hover); leaving closes;
  - **keyboard:** focus opens; Escape closes and keeps focus on the top link; `aria-expanded`
    tracks it; the header keeps its 18 Tab stops before the CTA;
  - **touch:** the first tap opens without navigating, the second tap follows the link, a tap
    outside closes;
  - **Escape also closes a dropdown the mouse opened, wherever focus is** (WCAG 1.4.13), and
    leaves focus where it was;
  - clicking a link closes its dropdown — the header survives client navigation, and an open
    dropdown would otherwise hang over the next page.
- **Preferences** (language · theme · sound) are unchanged in size and behaviour; they take the
  glass and a blue neon hover.
- **CTA** `START PROIECT ↗` (`cta-neon`) opens the request dialog.
- **Glass:** the text-bearing glass on `::before` (never on `<header>` itself, or the dropdowns
  would have nothing to blur), a near-opaque sheet without blur below 861px.

**Burger menu (≤860px).** The burger (44px, `aria-label` "Meniu") opens a full-screen overlay
that slides in **under** the header, so the burger stays usable: an opaque page colour with
glass, the HUD grid and a faint red glow on top; a visible "×"; the clock; large numbered
links with their sub-pages; the CTA. Page scroll is locked without moving the sticky header.
Focus goes to the "×"; Escape or "×" closes and returns focus to the burger; tabbing out of
the header and the menu closes it; growing past 861px closes it; the menu's CTA closes the
menu before opening the dialog.

> The header deliberately carries **no link to the admin panel** — a button here would
> publish `/admin-tbs-digital` in the markup of every page. The admin types the URL.

## Between sections — `SectionCTA`

A short "let's work together" panel repeated after Principles, Services, Work and Team, so a
visitor can start a conversation wherever they stop reading (design review, 2026-07-15). It
scrolls to the contact/estimator section; the `hue` prop varies the accent so consecutive
CTAs don't look identical. Partners ends with its own "become a partner" panel and the
estimator *is* the contact form, so there is no CTA between those two.

## Interior stage (3D)

On the home page, **Hero, Ticker and Directions scroll over one 3D scene**, drawn on a canvas
that stays stuck under the header (`components/scene/`, 2026-09-17; wiring in
[03 — Architecture](./03-architecture.md#the-interior-stage)). Everything in it is decorative
and `aria-hidden`: the page reads, works and navigates the same without it.

**What it draws**

- **The Cybernetic Core**, behind the hero: a glass sphere (real transmission glass on the high
  tier, a frosted shader on mid), a wireframe nucleus, three tilted rings (the intro's orbit
  tilts) and a cloud of particles. It leans towards the mouse on a desktop, and follows the
  device's tilt on touch screens **where the gyroscope works without asking** — the site never
  calls iOS's `requestPermission()`, so iOS shows no prompt and keeps a slow idle sway.
  Hovering the hero's CTAs with a mouse, or focusing them from the keyboard, brightens it. No
  sound.
- **The selected direction's model.** As the services come into view the core shrinks away and
  the scene hands over to the model of the pill that is selected, drawn behind the Directions
  HUD screen:

  | Direction | Model |
  |-----------|-------|
  | Produs digital | cubes assembling into a block |
  | E-commerce | the Offer → Payment → Access loop, packets riding it |
  | Automatizare & API | a hub wired to its systems |
  | Asistenți IA & boți | a layered neural network with impulses |
  | Brand & UI | a wireframe wave with interface cards over it |

  Selecting another direction **morphs** the model through a particle swarm (0.32s dissolve,
  0.5s re-form) — once the hand-over is complete; during it a switch is instant. The models sway
  gently rather than spin (a full turn shows a loop or a mesh edge-on).
- Each model follows its place on the page at a parallax factor below 1, so the canvas's
  one-frame lag behind a scrolling page reads as depth.
- **Below 861px the core sits behind the headline**, dimmed so the copy keeps its contrast (0.55
  dark / 0.4 light under 641px; 0.35 / 0.3 from 641 to 860px), with a scrim of the page colour
  between them. In the light theme everything is drawn as ink over the page rather than as added
  light.

**Who gets it** (`data-renderer` on `[data-testid="scene-stage"]`)

| Visitor | `data-renderer` · `data-reason` | On screen |
|---------|---------------------------------|-----------|
| A capable GPU: desktops (high tier; mid on a short side under 600px) and touch-first devices that do not report under 4 GB (mid tier, never high) | `webgl` | The scene, once it has drawn two frames; the static art crossfades out over 500ms |
| Reduced motion, Save-Data, a 2G connection | `off` · `reduced-motion` / `save-data` / `network` | Static art; nothing requested |
| Low tier (a touch device reporting under 4 GB; a desktop reporting under 4 cores or 4 GB), a software renderer (SwiftShader, llvmpipe, WARP), no WebGL2 | `fallback` · `low-tier` / `software` / `no-context` | Static art |
| The context was lost, the device was too slow, a render error | `fallback` · `lost` / `slow` / `error` | Static art, for the rest of the session (`lost` and `slow`) |
| Before the decision, and while the scene loads | `pending` | Static art |

- **It never competes with the page.** The decision waits until the intro overlay is gone, then
  for at least 1.5s of visible time and an idle slot; a probe answer is cached for the tab
  (`tbs_gpu_probe`). A returning visitor without a capable GPU downloads neither three.js nor
  GSAP.
- **Paused** (nothing drawn, the context kept) while the stage is scrolled away, the tab is
  hidden, or the burger menu, the intro or the request dialog covers the page.
- **Self-tuning.** On a slow device the scene first drops its pixel ratio to 1×, then halves its
  particles ("lite"); a device still under 28 fps for four ~1s windows after that gives up, and
  the session stays on the static art. A steady 30 fps (iOS Low Power, Chrome Energy Saver) is a
  refresh cap, not slowness.
- **QA switch:** `localStorage.tbs_scene_3d = "force"` draws the scene even on a software
  renderer and never gives up; `"off"` keeps the stage off. It changes what is drawn, never what
  the page does. (The intro has its own key, `tbs_intro_3d`.)

**Scroll effects**

- On a capable desktop (from 861px, a hovering fine pointer, motion allowed) the hero's backdrop
  drifts down (+12%) and its stat cards up (−8%) as the hero scrolls away — measured by GSAP
  ScrollTrigger, and the identity at the top of the page.
- The project screenshots' parallax in [Work](#work) is CSS only.

**Static art.** Where the scene does not draw, SVG illustrations in the same places and
proportions stand in: the core in the hero, the selected direction's model on the services
screen. They never loop. A new direction's drawing plays a one-shot entrance; hovering or
keyboard-focusing a hero CTA sends one light wave through the core. Both are gone under reduced
motion.

## /01 — Hero

`components/sections/Hero.tsx`, in Tailwind (`section#top`). The old HUD emblem is gone.

- **Paint order**, back to front: an opaque plate of the page colour, the HUD backdrop, the
  stage's canvas, the phone scrim, the copy. The section carries no `isolate` of its own (it would
  lift the plate over the canvas).
- **Backdrop** (decorative, `aria-hidden`, the `grid` entrance marker): a red and a blue key light,
  the HUD grid "wall", a grid floor in perspective drifting towards the viewer, a hairline scanner.
  The looping layers **pause** while the intro overlay is in the document (`html:has(#tbs-intro)`),
  while the hero is scrolled out of view (`data-offscreen`) and under reduced motion — each
  resumes where it stopped. The lit layers sit in `[data-parallax="hero-backdrop"]` (the desktop
  parallax), never the marker itself.
- **The core's host** (`data-testid="scene-hero"` › `data-scene-anchor="hero"`), inside the
  backdrop: the static core art, and the box the WebGL core is fitted to.
  - Phones (below 861px): centred behind the headline, at `--hero-core-phone` (faded in the
    light theme, whole in the dark one).
  - 861–1024px: on the seam between the two columns, raised to the top — the stat cards stack in
    the narrow right column there, and centred behind them they hid 86–88% of the sphere (now
    34–39%).
  - From 1025px: the right-hand column, centred, at full strength.
- **Phone scrim** (`data-scene-scrim`, below 861px): a radial pool of the page colour over the
  core and under the eyebrow, headline and lead, at `--hero-scrim`.
- **Copy:** an eyebrow (`TBS DIGITAL / WEB · SOFTWARE · AI`, no dot; a short red hairline after it
  from 641px);
  the page's only `<h1>` (34→74px on phones, 44→92px from 861px) whose closing full stop is a plain
  red glyph; the lead. Trilingual literals (`L()` in the component), not catalog keys.
- **CTAs:** the primary `cta-neon` button **"Începe proiectul"** with an `aria-hidden` ↗ SVG opens
  the request dialog (`source: "hero"`); the secondary ghost link **"Explorăm serviciile ↓"** goes
  to `#servicii`. Both **boost the 3D core** while hovered by a mouse or pen (never a finger — a tap
  has no hover to end it) or focused **visibly** from the keyboard. Hover and focus are separate
  reasons, so moving the mouse off a keyboard-focused CTA keeps the boost, and the focus the dialog
  hands back after a mouse close (not `:focus-visible`) does not start one.
- **Metrics** (`role="group"`, `aria-label` "Indicatori", in `[data-parallax="hero-stats"]`):
  glass cards (`data-metric="projects|automation"`) with a red / blue accent and an accent
  hairline along the top. The portfolio count is `projects.length` in its own `<b>` (no count-up,
  no card when it is 0); `24/7` is a fixed claim. Solid glass instead of blur below 861px.
  - **A wireframe hologram** in each card's corner (`data-hologram`): an octahedron for the
    portfolio, a gyroscope of rings for the automations — hairlines only, no vertex dots. It turns
    slowly only while the stage allows motion (`data-motion="live"`), the intro is gone and the
    hero is on screen; otherwise it rests on a three-quarter pose. Still under reduced motion.
  - **Tilt:** under a mouse a card tilts up to 8° towards the pointer and settles back when it
    leaves; never on touch, never under reduced motion. The group's entrance marker is never
    styled.

From 861px the hero is two columns and fills the first screen together with the ticker.

## Ticker

`components/sections/Ticker.tsx`, directly under the hero. A glass band with a red neon top
line and the words *Strategie → design → livrare · Design premium · Integrări & API ·
Multilingv · AI & automatizare*. Decorative (every word is said elsewhere), so the whole strip
is `aria-hidden`.

The track renders **five identical groups, each ending in its own separator** — a slanted red
neon hairline, 1px wide in the layout (it was a round dot until 2026-09-17) — and the same gap,
and the marquee moves it by exactly one group per loop (`--marquee-copies`), so the seam lands on
a copy of what was just there and the loop has no visible join. The edges fade (the band itself
stays solid edge to edge), hover pauses it, and under reduced motion only the first group is
shown, wrapped and centred, without the seam separator.

## Directions

`components/sections/Directions.tsx`, in Tailwind (`section#servicii`, 2026-09-17) — a
**direction chooser**, not a second sales pitch: five pills, a read-only preview, and the HUD
screen the 3D model draws behind. Its copy is trilingual `L()` literals in the component; each
direction's accent and reference project come from `lib/solutions.ts` and the live portfolio.

- **Heading row:** eyebrow **"Alege direcția potrivită"** with a red hairline, the `<h2>`, and the
  lead.
- **Pills** (`<nav aria-label="Direcțiile de servicii">`): five **real links** to
  `/servicii/<slug>`, in the scene's order (Produs digital · E-commerce · Automatizare & API ·
  Asistenți IA & boturi · Brand & UI). The selected one carries `aria-current="true"`, its
  direction's accent as border and glow, and an `aria-hidden` "↗" — so its accessible name stays
  the label. Below 641px the row is a band that scrolls and snaps inside itself; the page never
  scrolls sideways.

  | Input | Selects a pill | Opens its page |
  |-------|----------------|----------------|
  | Mouse | hover | click, at once |
  | Keyboard | focus (Tab), **←/→** (wrapping), **Home/End** | Enter |
  | Touch or pen | the **first tap on another pill** (stays on `/`) | the second tap; **the pill already selected opens on the first tap** |
  | Assistive technology (a click with no pointer events) | — | at once |

  ↑/↓ still scroll the page, arrows with Alt/Ctrl/Meta are left alone, and the row adds no tab
  stops. A press that turns into a swipe of the band (`pointercancel`) leaves nothing armed. The
  rule is `shouldInterceptTap` (`lib/tapIntent.ts`), shared with the header's dropdowns.
- **Selecting** swaps the preview (a short entrance, none under reduced motion), sets
  `data-shape` on the screen, and tells the 3D scene which model to show.
- **Preview:** the direction's tag, `<h3>`, text and "✓" list, and **one** link,
  **"Deschide serviciul →"**, which always navigates on the first tap — the commercial actions
  live on the service page.
- **HUD screen** (`data-testid="scene-services"`, `data-shape="<slug>"`): see-through, so the
  canvas shows behind it; a decorative layer (HUD grid with a radial fade, an accent glow, a scan
  line that pauses under the intro and while the section is off screen, four corner brackets);
  the model's anchor (`data-scene-anchor="services"`) holding the static drawing; then the case
  card — the direction's own reference project (name, description, its tags as chips joined by
  the tag's "·"), or, for a capability direction with no project (e-commerce), the numbered flow
  Offer → Payment → Access.
- **Layout:** below 861px the screen comes **first**, right under the pills, so a tap changes the
  model in view; from 861px the preview and the screen sit side by side; from 1025px the model
  stands beside the case card.
- **Nothing moves when the selection changes.** The copy, the screen and the panel have per-locale
  minimum heights, measured as the tallest direction in each width band, so a tap never shifts
  what is under the section (or the stage's scroll measurements).
- Only the first direction's drawing is in the HTML; the others load the first time another
  direction is selected.

## Work

`components/sections/Work.tsx`, in Tailwind (`section#lucrari`, 2026-09-17). Eyebrow
**"Portofoliu TBS"**, the `<h2>` **"Proiectele care ne reprezintă."** and a lead, then one HUD
card per project from the store — fully editable from the admin's **Proiecte** tab
([09 — Admin](./09-admin.md)).

- **The card** is a link (`<a target="_blank" rel="noopener noreferrer">`) when the project has a
  URL, an `<article>` otherwise — never a link to nowhere. It shows the project's **first
  screenshot** (the rest of the gallery stays in the data), its **tag as chips** (a "·" in the tag
  splits it, and stays visible between the chips, so the card reads and is announced as
  "CRM PRIVAT · FĂRĂ LINK"), an outlined position index (`01`, `02`… — adding or removing a
  project renumbers), the name, an arrow box on linked cards, and the description.
- **The description** is revealed on hover and keyboard focus on a desktop, and always shown on
  touch screens (`(hover: none)`, tablets included) and at 640px and below.
- **Hover / focus:** a 5px lift, a neon edge in the card's accent, corner brackets drawing in;
  under a mouse from 641px the card also **tilts** up to 6°. Never on touch, never under reduced
  motion.
- **Parallax:** the screenshot drifts slightly as the section scrolls through the viewport — a CSS
  scroll-driven animation, no JavaScript; still where the browser lacks it (Firefox) or motion is
  reduced.
- A project without a screenshot is still a finished card: its own gradient with the dark wash
  under the copy.
- **Layout:** three columns; two up to 900px, where an odd last card spans the row and keeps its
  screenshot at a normal card's size on its right half (stretched, the screenshot was enlarged
  ~2× and small print in it became legible); at 640px and below, one horizontal snap band that
  bleeds to the screen edges.

Seeded content (`lib/content.ts`, nine projects): BizCheck, Itara Global, DocuSafe, Crowe Portal,
CGAM, IQ Arena, Balloons Breeze, Statistic, FLIRT. Note that **CGAM and IQ Arena are two different projects** — CGAM is
the academy's web platform (cgam.md); IQ Arena is the mobile negotiation game. Screenshots live in
`public/projects/`.

## /02 — Principles ("Principiile noastre")

- **Principles grid** (5 cells): Strategie întâi · Sisteme conectate · Estetică digitală ·
  Rezultate reale · IA aplicată. **Keep.**
- **Stats row** (4 boxes): originally `50+ / 8+ / 30+ / 24/7`. → **Blank placeholder boxes**
  (values/labels removed; see rules doc).

## /03 — Services ("Servicii de digitalizare")

> **Not rendered by any page today** — the home page's service block is
> [Directions](#directions). Kept here while `components/sections/Services.tsx` exists.

Grid of service cards (icon, name, description), fed by `lib/content.ts` → the store, so the
admin edits names, descriptions and prices in all three languages. A service marked
`estimatorOnly` (currently "Automatizare cu IA") appears in the estimator but has **no card**
here. Card labels `/01`, `/02`… are computed from position, so adding or removing a service
renumbers automatically.

**Clicking a card jumps to the estimator with that service pre-selected**
(`lib/estimatorBridge.ts`). On mobile the grid is an auto-rolling scroll-snap carousel
(`useAutoCarousel`).

## /05 — Team ("Oamenii din spatele codului")

Left: heading + a `SYSTEM_STATUS` panel with progress bars. Right: team member cards
(initials avatar, name, role, bio, social links).

Real content: **Maxim, Danu, Laurentiu** — first names only, by request. Editable from the
admin's **Echipă** tab. On mobile the cards drop to a single column so the third member
isn't stranded alone on a row. The `SYSTEM_STATUS` numbers remain decorative placeholders
(see the rules doc).

## /06 — Partners ("Partenerii noștri")

Heading + lead, a strip of partner logo cards (logo, name, link to the partner's own
site), then a "Devino partener" call-to-action panel that mails `office@crowe-tm.md`.
Each card also carries a **preview screenshot of the partner's site**: it fades in behind
the logo on hover (desktop) and is simply shown from the start on touch devices, where no
hover exists.
Real content, not placeholders: Crowe Turcan Mikhailenko, CGAM Business Academy and
Ivan Turcan. Logos are monochrome-white PNGs on transparent backgrounds (the section
renders on the dark background) and live in `public/partners/`.

Fully editable from the admin's **Parteneri** tab, including uploading a new logo —
see [09 — Admin](./09-admin.md).

## /07 — Estimator + Contact ("Estimează prețul")

- **Estimator:** three groups — `01 · TIP DE PROIECT`, `02 · TERMEN LIMITĂ`,
  `03 · OPȚIUNI SUPLIMENTARE` — plus an estimated-price total. Prices come from the admin;
  an unset price renders `...` (see rules doc). Arriving from a service card pre-selects
  that project type.
- **Contact form:** name, email, phone, message + submit. It **does** submit —
  `POST /api/contact`, validated client-side by `lib/validation.ts` and authoritatively by
  the backend, then pushed to the Telegram lead bot
  ([13 — Telegram Bot](./13-telegram.md)).

## Footer

Partners row (the same partners as /06, rendered as chips that link to their sites),
navigation/services/contact columns, socials, copyright, and the `> ACCESS GRANTED_`
striped marquee.

## Cookie-consent banner

`components/ui/CookieConsent.tsx`, in Tailwind. Shown until the visitor chooses: **Accept**
(`cta-neon`) allows the analytics pixel, **Doar esențiale** rejects it (Escape does the same).
Links to `/cookies`. Nothing tracking loads before a choice — see
[16 — i18n & SEO](./16-i18n-seo.md).

- **Look:** a glass card bottom-right from 641px (solid glass tint under a blur, so its 14px
  copy stays AA over anything behind it); on phones a full-width **opaque `--panel` card with no
  blur** — it sits over the hero floor grid and the ticker, which never stop animating, and a
  blur there would be recomputed every frame. Buttons are 44px and stack below 401px.
- **A non-modal dialog** (`role="dialog"`, `aria-modal="false"`): it takes focus when it shows
  (without scrolling the page), and Escape means essential only.
- **It waits for the intro.** On a page with no overlay (every page but a first-visit home page)
  it shows in the same effect as always. Behind a running intro it shows on `tbs:intro-done`,
  so it never takes focus under a full-screen overlay. A backstop of `WATCHDOG_MS + 1000`
  counted in **visible** time covers an intro that never reports back — but it does not fire
  while the overlay is still live (the intro's own watchdog will end it); only an overlay that
  JavaScript never took over (already faded by its CSS failsafe) lets the backstop show the
  banner. If a live intro truly never ended, the banner would stay away for that page view: no
  choice means no analytics, and the next load asks again.
- **Escape is guarded.** A held key's auto-repeats are never an answer. After an intro that
  actually **played**, Escape is ignored for 700ms once the banner shows — the visitor was
  pressing Escape to skip the intro, and a quick second press must not store "rejected" for six
  months on a banner they have not seen. The buttons work at once.

## Legal pages

`/confidentialitate` and `/cookies` — outside the landing scroll, same chrome, linked from
the footer and the consent banner.

## Admin panel

Built and live at `/admin-tbs-digital` — a login-gated, tabbed editor backed by the API.
See [09 — Admin Panel](./09-admin.md).
