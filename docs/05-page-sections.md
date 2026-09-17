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

On the home page, **Hero, Ticker, Directions and Work scroll over one 3D scene**, drawn on a
canvas that stays stuck under the header (`components/scene/`, 2026-09-17; wiring in
[03 — Architecture](./03-architecture.md#the-interior-stage)). Everything in it is decorative
and `aria-hidden`: the page reads, works and navigates the same without it.

**What it draws**

- **The microprocessor**, behind the hero (IT-OS Phase 1, 2026-09-17; it replaced the glass
  "Cybernetic Core"): a neon chip lying back as a diamond — a substrate, a heat spreader and a
  glowing plasma die stacked on it, pins on all four sides fanning out into board traces that end
  in square vias (7 traces per side on the high tier, 5 on mid). Red packets run the traces out to
  the board and back in, and a pin flares as one leaves or lands. It leans towards the mouse on a
  desktop, and follows the device's tilt on touch screens **where the gyroscope works without
  asking** — the site never calls iOS's `requestPermission()`, so iOS shows no prompt and keeps a
  slow idle sway. Hovering the hero's CTAs with a mouse, or focusing them from the keyboard, speeds
  the packets up and sends one square light wave out across the board. As the hero scrolls away the
  chip shrinks, its heat spreader and die lift off the substrate (an exploded view), and it
  dissolves. Nothing is glass: no transmission, no environment map. No sound.
- **The cursor circuit trail.** A mouse or pen moving over the stage lays short neon circuit
  segments behind the pointer — snapped to a 20px grid of the page and joined at right angles, a
  code pulse running along them — that fade out over 0.9s. They are laid on the page, so they
  scroll with it. Its limits, all by design:
  - **fine pointer only** — never a finger (touch and coarse pointers attach nothing), and never
    under reduced motion;
  - **the WebGL path only** — the static art has no trail;
  - **over the stage only**: it is drawn on the stage's canvas, under the page, so it shows over
    Hero, Ticker, Directions and Work only where the page lets the canvas through — **never over
    an opaque card** (the Directions case card, a project card that faces the visitor, the
    header), faint at most under glass — and nowhere outside the stage;
  - a pause over 0.35s, or a jump of more than 12 grid cells (240px), starts a new line instead of
    drawing a wire across the page. At most 64 segments live at once.
- **The selected direction's model.** The chip dissolves on its own as the hero leaves. Once the
  top of the services screen passes three quarters of the viewport, the model of the pill that is
  selected **bursts out of a point** at the centre of its place and assembles, in 1.1s — on its own
  clock, whether the visitor keeps scrolling or stops, so it is never left half-formed. Scrolled
  back above (the screen's top below 90% of the viewport) it implodes into that point in 0.45s. A
  visit that lands on the services directly (a reload, a link) finds it already formed. It is
  drawn behind the Directions HUD screen:

  | Direction | Model |
  |-----------|-------|
  | Produs digital | cubes assembling into a block |
  | E-commerce | the Offer → Payment → Access loop, packets riding it |
  | Automatizare & API | a hub wired to its systems |
  | Asistenți IA & boți | a layered neural network with impulses |
  | Brand & UI | a neon grid (rows, columns and + crossings) rolling in waves, with interface cards over it |

  Selecting another direction **morphs** the model through a particle swarm (0.32s dissolve,
  0.5s re-form) — once the model has formed; while it bursts in, a switch is instant. The models
  sway gently rather than spin (a full turn shows a loop or a mesh edge-on). A model's own motion
  starts only once it has formed, after the burst or a morph: the cubes hold their block for 1.4s,
  then explode, float and re-assemble on a 7.2s loop, so cubes scattered a couple of seconds after
  the entrance are that loop, not an unfinished burst. The Brand & UI grid holds its waves still while
  the swarm lands on it, so the particles meet the lines exactly; the waves roll from formation,
  and the pulse ring and the lean towards the pointer grow in over 0.6s.
- **The screen answers the burst.** The stage says where the entrance is (`data-entry` on
  `[data-scene-stage]`: `idle`, `burst`, `formed`), and the Directions panel follows it: a band of
  light sweeps its copy while the model bursts in, and its edge lights up in the direction's accent
  once it has formed. On the static art (`fallback`, `off`) there is no `data-entry` and the
  panel's edge is simply lit; while the stage is still deciding (`pending`) it stays plain.
- **The project DNA helix** (IT-OS Phase 3, 2026-09-17: the client's "cardurile cele să fie la
  ADN"). Once the top of Work's cards passes 55% of the viewport, the selected direction's model
  flies apart into a swarm that lands on a neon **DNA helix** in 1.2s (back in 0.5s above 70%): two
  strands carrying packets, chips riding them (the ones facing the visitor brighten), base-pair
  rungs with a light sweeping up them, and 0/1 digits drifting up the axis. It never spins on its
  own; it turns with the project cards. What the cards do depends on the screen — see
  [Work](#work).
- Each model follows its place on the page at a parallax factor below 1, so the canvas's
  one-frame lag behind a scrolling page reads as depth (the helix follows Work rigidly: its zone
  is stuck while the cards turn).
- **Below 861px the chip sits behind the headline**, dimmed so the copy keeps its contrast (0.55
  dark / 0.4 light under 641px; 0.25 / 0.15 from 641 to 860px, where its centre is under the
  lead), with a scrim of the page colour between them; the static art is faded to match
  (`--hero-core-phone`, [04](./04-design-system.md#hero-core-tokens-phones)). In the light theme
  everything is drawn as ink over the page rather than as added light, and the chip stays faint
  behind the copy on phones: the lead's own contrast leaves no room for more.

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
proportions stand in: the microprocessor in the hero (the same silhouette as the WebGL chip,
drawn through its pose), the selected direction's model on the services screen. Work has no
drawing: without the scene it is the grid (or band) of cards, exactly as the server rendered it.
They never loop.
A new direction's drawing plays a one-shot entrance; hovering or keyboard-focusing a hero CTA
sends one square light wave out across the chip while its packets flicker. Both are gone under
reduced motion.

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
  backdrop: the static chip art, and the box the WebGL chip is fitted to (`CHIP.R` equals the old
  core's radius, so the boxes below did not change with the chip).
  - Phones (below 861px): centred behind the headline, at `--hero-core-phone` (below 641px .3
    light / .65 dark; 641–860px, where the chip sits under the lead, .11 / .27), matched to the
    WebGL chip's behind-the-copy dim so the crossfade does not flash.
  - 861–1024px: on the seam between the two columns (`right: gutter + 6vw`), raised to the top —
    the stat cards stack in the narrow right column there and would hide most of the chip. The
    offset is no larger because at 11.5vw the chip's left traces ran under the end of the h1
    (min 1.22:1 at 1024×768); at 6vw the hero text is 100% ≥ 4.5:1 at 900 and 1024.
  - From 1025px: the right-hand column, centred, at full strength.
- **Phone scrim** (`data-scene-scrim`, below 861px): a radial pool of the page colour over the
  core and under the eyebrow, headline and lead, at `--hero-scrim`.
- **Copy:** an eyebrow (`TBS DIGITAL / WEB · SOFTWARE · AI`, no dot; a short red hairline after it
  from 641px);
  the page's only `<h1>` (34→74px on phones, 44→92px from 861px) whose closing full stop is a plain
  red glyph; the lead. Trilingual literals (`L()` in the component), not catalog keys.
- **CTAs:** the primary `cta-neon` button **"Începe proiectul"** with an `aria-hidden` ↗ SVG opens
  the request dialog (`source: "hero"`); the secondary ghost link **"Explorăm serviciile ↓"** goes
  to `#servicii`. Both **boost the 3D chip** while hovered by a mouse or pen (never a finger — a tap
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
- **The panel answers the 3D entrance:** a band of light crosses the preview while the model
  bursts in, and the panel's edge lights in the direction's accent once it has formed (simply lit
  on the static art). See [Interior stage (3D)](#interior-stage-3d).
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
  bleeds to the screen edges. That is the page as rendered, and all anyone gets on the static art
  (`fallback`, `off`, reduced motion, no usable GPU).

**In the 3D stage** (IT-OS Phase 3, 2026-09-17; wiring in
[03](./03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17)). Work is inside the
interior stage. Once the scene has drawn and built its DNA helix (after its first picture):

- **Spiral — screens at least 768px wide and 600px tall** (tablets in portrait too). The cards
  leave the grid and **turn round the helix** as the page scrolls: each one sticks under the
  header while a scroll of about 38% of the viewport (240–380px) brings the next one to the
  front. The card at the front is the largest and sits over the canvas; the cards behind the
  helix are smaller, fainter and pass **under** it — real depth, not a fade. Only a card facing
  the visitor takes a click or a tap; one behind the helix never does. The section grows by that
  scroll (one sticky screen plus one step per card); nothing sideways, and no card slips under
  the Phase 5 rail's lane (44px from 861px). A card in the spiral is **as tall as its content**
  (at least the spiral's even height): a long description — always shown on a touch tablet,
  revealed on hover on a desktop — is never cut off.
- **The hologram.** Beside the helix floats a hologram of the front card: its screenshot as a
  scanlined luminance image in 2px cells (small on purpose: fine print in a screenshot, such as
  the e-mail in the FLIRT sign-up form, is not legible on it), its tags, name and number. It
  glitches briefly when the front card changes and is redrawn only once the next card is well
  past half-way. The helix and the hologram take the front card's accent colour.
- **Keyboard.** Tab moves through the cards in their normal order; each focused card scrolls to
  the front (with the page's own smooth scrolling) and is fully opaque. Nothing leaves the tab
  order and no card is hidden from assistive technology. A card focused by a click does not
  scroll.
- **Ambient — below 768px (or a window under 600px tall, or fewer than three projects).** The
  band (or grid) stays exactly as it is, and a small helix lies on its side, at full brightness,
  **in the empty band above the heading** — between the Directions panel and the "Portofoliu TBS"
  eyebrow (about 84px on a phone), about 60px tall there and at most 0.6 of the screen wide,
  touching no text and no card — coloured after the card nearest the middle of the band. It is not behind the
  heading: there its flaring chips and packets turned the headline's pixels near-white, and keeping
  the copy readable left it a faint trace in the dark theme and nothing at all in the light one. The
  services model's swarm flies to it once Work's cards pass 55% of the viewport; on a very short
  phone (568px tall) the band is under the header at that moment and comes into view when the page
  is scrolled back a little.
- **Arriving inside Work** (a reload or a link while Work is on screen) keeps the grid: switching
  to the spiral there would grow the section by thousands of pixels under the visitor. The
  spiral applies the next time the visitor is above Work. Leaving the spiral (a narrower window,
  the scene switched off) puts the grid back at once, with the focused card where the visitor was
  looking.
- Without the scene nothing of this exists: no helix, no inline layout, no `data-helix`.

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
- **Request context (2026-09-17, plumbing for the IT-OS HUD; since Phase 4 the Ghid TBS passes
  `openAssistant`, `guideTopic` and the `guide` / `guide-prompt` sources — see
  [Ghid TBS](#ghid-tbs-the-guide); the other new fields still have no caller).** Every CTA opens the one request dialog
  (`lib/request/RequestFlowProvider.tsx`) with a `RequestContext`. Besides `serviceSlug`,
  `projectId` / `projectName` and `source`, it now takes:
  - `projectType` — a catalog id (`site`, `crm`, `automation`, `ecommerce`, `mobile`) that wins
    over the slug's mapping; an unknown id is ignored;
  - `optionIds` — exactly these option chips (`design`, `integrations`, `multilingual`, `seo`)
    instead of the default "+ Integrări & API"; `[]` ticks none, unknown ids are dropped;
  - `openAssistant` — dialog only: it opens on the assistant, with focus in the chat panel;
  - `guideTopic` — `servicii`, `lucrari` or `service`, written into the origin block as
    `- Secțiune: <topic>` (any other value is left out);
  - `attachment` — a HUD tool's block (`kind` calculator / builder, `count`, optional `summary`,
    `text`): control characters stripped, capped at 1,200 characters with `[…]`
    (`lib/request/attachment.ts`), and a one-line note under the proposal says what travels.

  New `source` ids: `guide`, `guide-prompt`, `os-calculator`, `os-builder`. The sent message is
  the summary, then the attachment, then the origin block, then the transcript; the attachment's
  and the origin's room is reserved before the summary is clamped, so the whole stays ≤ 5,000
  characters. The project types and options, with their ids, live in `lib/request/catalog.ts`
  (labels unchanged); `payload.project` and `payload.estimate` mean what they did.
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

## Ghid TBS (the guide)

IT-OS Phase 4 (2026-09-17). A small holographic cube droid, **"Ghid TBS" / "Гид TBS" / "TBS
Guide"**, in the bottom-right corner of **every site page** (home, the service pages, the legal
pages) once the visitor has done something. It is a guide to the existing request flow, not a
new chat: it never calls itself "AI", never answers questions itself, and promises nothing the
estimator does not already promise. Code: `components/hud/guide/*`, `lib/hud/linger.ts`, mounted
by `components/hud/HudChrome.tsx` ([03](./03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17));
look: [04](./04-design-system.md#ghid-tbs--the-guide).

**When it is there.** Nothing renders — and nothing of it is downloaded — until the cookie
question is answered, the visitor has interacted (a pointer move, tap, wheel, scroll, key or focus
change; answering the banner counts), the intro overlay is gone and the browser has an idle slot.
QA and the E2E suite can switch it off with `localStorage.tbs_hud = "off"`.

**The avatar** is a real `<button aria-haspopup="dialog">` named "Ghid TBS: deschide asistentul
ghidat pentru cerere". Pressing it opens the **request dialog straight on the guided chat**
(`openAssistant`), focus inside the chat. Closing the dialog hands focus back to the avatar.

**The tip.** When one topic holds the viewport's **centre line for 5s of visible time** (a hidden
tab does not count), the droid pulses and a short tip appears above it. It takes no focus, has no
role and no live region (an unrequested tip must not interrupt a screen reader); it describes the
avatar (`aria-describedby`), so it is heard on the button. Buttons: **"Deschide ghidul"** (opens
the flow, like the avatar), **"Nu mai arăta în această vizită"** (no more tips until reload) and
**✕ "Închide sugestia"**. Escape inside the guide closes the tip; focus that was in it goes to the
avatar.

| Topic | Where | Tip (RO) |
|-------|-------|----------|
| `servicii` | the home page's `#servicii` | "Nu ești sigur ce direcție ți se potrivește? Ghidul pune câteva întrebări scurte și trimite echipei rezumatul." |
| `lucrari` | the home page's `#lucrari` | "Ai în minte un proiect asemănător? Descrie-l pas cu pas — îți răspundem în cel mult o zi lucrătoare." (the same reply time `SENT_COPY` promises) |
| `service` | a service page's "Cum lucrăm" steps (`DirectionPage`, `data-guide-topic="service"`) | "Vrei să vezi dacă direcția asta se potrivește proiectului tău? Ghidul te ajută să formulezi cererea." |

**Limits** (`GUIDE_LIMITS`):

- at most **2 tips per page lifetime**, each topic at most **once**, **60s** between two tips;
  a tip closed with ✕ still counts;
- no tip while the page is covered (the request dialog, the burger menu), the intro is on screen,
  the banner is waiting, the visitor is typing in a field, the request flow is open, the guide is
  away, or (from the OS phase on) the visitor is busy with a HUD window; the 5s wait simply starts over;
- a shown tip goes when its section leaves the centre line, the flow opens, the page is covered,
  or focus lands on something under the tip.

**Memory lasts the page lifetime.** It is one module variable: it **survives client navigation**
(home → a service page → back keeps the count and the opt-out) and resets on a reload. Nothing is
stored — no localStorage, no sessionStorage, no cookie.

**It steps aside.**

- **Away:** while the home page's own request form (`#estimare`) is in view, the avatar and tip
  fade to opacity 0, take no pointer and leave the tab order (that section *is* the guided flow).
- **Yield:** when keyboard focus lands on something the guide overlaps, it fades until focus moves
  on (WCAG 2.4.11).
- The dialog, the burger menu and the intro sit above it (z 112 < 115); nothing is hidden.

**What it sends.** Only what the visitor then submits in the request form, with the origin block
the estimator already writes:

- `- Serviciu: <slug>` — on a service page (a slug `lib/directions.ts` knows);
- `- Proiect: <name> (<id>)` — only when the tip or the centre line is on `#lucrari` and the
  project spiral has a front card (`data-helix-front`); otherwise no project;
- `- Secțiune: servicii | lucrari | service` — the topic on the centre line when it was opened;
- `- Sursă (CTA): guide` (the avatar) or `guide-prompt` (the tip's button).

Nothing is sent when the guide merely shows or a tip is dismissed: no analytics event, no request.

## The fibre rail

IT-OS Phase 5 (2026-09-17). A **neon fibre-optic line on the right edge** of every site page, at
**861px and wider**, next to the browser's own scrollbar — which stays the scrollbar (the client's
decision: the native scroll is kept). It shows how far down the page the visitor is and where the
page's sections are, and it jumps to one. Code: `components/hud/rail/*`, `lib/hud/rail.ts`,
mounted by `components/hud/HudChrome.tsx`
([03](./03-architecture.md#the-rails-wiring-it-os-phase-5-2026-09-17)); look:
[04](./04-design-system.md#the-fibre-rail).

**When it is there.** Like the guide: nothing renders or downloads until the cookie question is
answered, the visitor has interacted, the intro is gone and the browser has an idle slot — and
then only while the window is at least 861px wide. Narrowing the window below 861px removes it;
widening brings it back. `localStorage.tbs_hud = "off"` switches it off with the rest of the HUD.

**What it shows.** A faint core line from under the header (16px below it) down to 112px above the
bottom, just above the guide. A lit thread fills it with the scroll progress (top of the page →
empty, bottom → full), with a glowing head at its end and a short light streak that travels along
it **only while the page is scrolling**. One **diamond tick per section** sits where the thread
ends when that section is scrolled to (kept at least 44px apart): hollow ahead, lit once passed,
and it pulses once when a downward scroll passes it.

**The sections** (a real `<nav>` named **"Secțiunile paginii" / "Разделы страницы" / "Page
sections"**, one 44×44 button per tick; the label shows beside it on hover and keyboard focus):

| Page | Markers |
|------|---------|
| Home (`/`, `/ru`, `/en`) | **Început** (`#top`) · **Servicii** (`#servicii`, `nav.services`) · **Lucrări** (`#lucrari`, `nav.work`) · **Despre** (`#despre`, `nav.about`) · **Echipă** (`#echipa`, `nav.team`) · **Cerere** (`#estimare`) · **Contact** (`#contact`) — the header's own catalog words where the menu has them, `RAIL_COPY` for the other three |
| A service page | one per `section` named by its first `h1`/`h2`: 3 to 5 today (e.g. `/servicii/produs-digital`: "Produs digital", "Proiecte relevante", "Cum lucrăm", "Ai un proiect în minte?"; `/servicii/e-commerce` has 3) |
| `/cookies` | its 7 numbered headings ("01 Ce sunt cookie-urile" …) |
| `/confidentialitate` | 14 sections: **more than 8, so the fibre and ticks only, no `<nav>`** (a list of buttons that long is not a shortcut) |

Headings inside the header, the footer, a dialog, an `aria-hidden` subtree, the guide or the rail
never name a section, nor does a section holding more than one `h2` (a list of items). A label is
the heading's text, whitespace collapsed, at most 60 characters. The home list is used only when
all seven ids are on the page; a client navigation re-reads the sections.

**A marker jumps.** Clicking one scrolls its section to just under the header — smoothly, or
instantly under reduced motion — and that marker becomes the current one (`aria-current="true"`,
a short lit streak beside it). The current marker is the last section the scroll has reached.

**Keyboard.** The buttons are real tab stops, **after the footer** (and after the guide) in the
tab order, so the header's tab budget and the intro's "skip is the first Tab stop" hold.
**Enter or Space** jumps like a click and also **moves focus to the section** (a temporary
`tabindex="-1"`, removed when focus leaves it), so the next Tab continues inside that section. A
mouse click never moves focus. Every button shows a 2px focus ring and its label.

**It stays out of the way.** The column takes no pointer events except its 44×44 buttons. The
fibre and the markers are inset by **half a marker (22px)** at both ends of the column, so every
44×44 button stays inside it — clear of the header above and of the guide's avatar box below. It sits under
the guide, the burger menu, the request dialog and the intro (z 104). While the dialog or the burger
covers the page it holds still and re-measures when they close. It never blocks or takes over
scrolling (only passive listeners), writes nothing on `<html>` or `<body>`, stores nothing and
sends nothing. It re-measures as the page grows — images and fonts arriving, Work's project spiral
lengthening its track — so the ticks stay on their sections. Between 861 and about 1,100px the
page's side gutter (`clamp(16px, 4vw, 40px)`) is narrower than the 44px column, so the buttons'
hit areas reach a few pixels over the right edge of full-width content there.

**Under reduced motion** the rail is static: no travelling streak, no pulse, no fades; the thread
still follows the scroll position, and a jump is instant.

**Below 861px there is no rail.** The 2px top progress bar is the fibre there: a thread lighting
up in Neon Cyan towards an 18×2px glowing head. From 861px the top bar keeps its old gradient until
the rail appears, and is hidden while the rail is on the page — a visitor who has not interacted
(or with the HUD off) still sees progress.

## Legal pages

`/confidentialitate` and `/cookies` — outside the landing scroll, same chrome, linked from
the footer and the consent banner.

## Admin panel

Built and live at `/admin-tbs-digital` — a login-gated, tabbed editor backed by the API.
See [09 — Admin Panel](./09-admin.md).
