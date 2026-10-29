# 05 — Page Sections

The landing page is a single scroll, top to bottom. Sections carry a mono index label
(`/01`, `/02`, …). Below is each section, its purpose, and where its content comes from.

> Order in `app/(site)/page.tsx` today: Hero · Ticker · **Stakes** · Directions · Work · WorkProof ·
> Principles · Team · Process · **Explainer** · RequestSection — the StoryBrand website wireframe
> since 2026-10-28 ([The wireframe order](#the-wireframe-order-2026-10-28)). Since 2026-10-09 the
> page sells first (the owner's brief: the services and how to ask for them). BottomCTA went that day: it
> repeated the form right above it, and its "Programează consultarea" promised a booking that
> did not exist. All visitor-facing copy is localized —
> see [16 — i18n & SEO](./16-i18n-seo.md). For what is still a stub, see
> [06 — Placeholder Rules](./06-placeholder-rules.md).
>
> The first screen — header, hero, ticker, cookie banner — was redesigned as a HUD on
> 2026-09-16, and the interior on 2026-09-17: the 3D stage behind Hero → Ticker → Directions,
> the holographic stat cards, and Directions and Work rebuilt as HUD sections. Both are
> described below as built. Principles ("De ce TBS"), Team and the request section predate them;
> WorkProof and Process came with the selling pass of 2026-10-09. `Services` and `Partners`
> below are not rendered by any page today. The first-visit intro (the laptop preloader) and the
> full-window page loading cover were removed on 2026-10-28.

### The wireframe order (2026-10-28)

The home page is laid out on the StoryBrand website wireframe ("Marketing Made Simple"; the copy
rules are in [16 — Copy framework](./16-i18n-seo.md#copy-framework-2026-10-28)). Each section has
one job in it:

| # | Wireframe part | Section(s) |
|---|---|---|
| 1 | Header — the offer, the better life, how to get it | Hero (+ Ticker) |
| 2 | Stakes — what not acting costs | **[Stakes](#stakes--ce-pierzi-când-online-ul-nu-lucrează-pentru-tine-problema)** (`#problema`) |
| 3 | Value proposition — what you get | Directions |
| 4 | The guide — authority + empathy | Work · WorkProof · Principles · Team |
| 5 | The plan — three steps | Process |
| 6 | Explanatory paragraph — the story retold | **[Explainer](#explainer--the-story-in-prose-pe-scurt)** (`#pe-scurt`) |
| 7 | Price choices | RequestSection (the estimator) |
| 8 | Junk drawer | Footer |

Stakes sits **inside** `<SceneStage>`, between Ticker and Directions: the stage and its other
children are unchanged. It draws nothing in the scene — the hero core leaves on the hero's own
scroll span (`#top`) and the services model forms on Directions' anchor — so it only lengthens the
scroll between the two. Explainer sits after the stage, between Process and the request.

The owner's rules for this pass: the hero has **no subtitle** under the `<h1>` and **no line
under its buttons**; Directions has **no lead paragraph** under its `<h2>`. Don't bring them back.

## Header (Navbar)

`components/layout/Navbar.tsx`, in Tailwind. A sticky glass bar with a red neon hairline at
the bottom: 71px tall (`--header-h`), 77px between 641 and 860px, where the language group is
taller — as before the rewrite. DOM order is a
contract the tests read: the logo, the clock, the desktop `<nav>`, the preferences group,
the CTA as its very next sibling, the burger.

- **Logo** `TBS.` — the full stop a plain red glyph, with no glow or halo (the decorative dots
  went on 2026-09-17) — the first link, a 44px box at every width. It is the **home link**
  (2026-10-02), and home means y 0 of `/`: from every other page a `Link` to `/` with
  `scroll={false}`, because Next's own scroll puts the new page's first element under the sticky
  bar (y 71: with `html { scroll-behavior: smooth }` its `scrollTop = 0` has not moved anything
  when it checks, so it falls back to `<main>.scrollIntoView()`). `landAtTop` waits for the
  address to change (Next changes it in the commit of the new page) and sets y 0 in that frame's
  `requestAnimationFrame`, before Home's first paint, while the page being left stays where the
  visitor had it. It scrolls only if the new address IS Home with no `#section` — a Back during the
  wait ends it outright, and a `/#servicii` link or another page clicked meanwhile keeps its own
  scroll — and it lets go after 15 s of waiting (timed, not counted in frames). On Home itself —
  `/`, or `/ru` and `/en`, the same page under a language prefix — it scrolls to the very top
  (smooth, instant under reduced motion) and drops any `#section` from the address, keeping the
  prefix. It used to be `href="#top"`, which on a service page only scrolled that page up and
  never left it. (Next 16's `data-scroll-behavior="smooth"` on `<html>` would make Next's own scroll
  land at 0 for every link, but it writes an inline `scroll-behavior` on `<html>` on each route
  change and leaves `style=""` behind — against the no-inline-style-on-the-root rule the forced-WebGL
  E2E holds, [07](./07-conventions.md).)
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

  **Every item works from every page** (2026-10-03). A section of Home is written `/#section` in
  `navMenu` (`lib/content.ts`) and rendered by `components/layout/SiteLink.tsx`: on Home itself
  the plain in-page anchor `#section` (the browser's own smooth scroll, `:target`, the focus
  starting point — nothing changed there), anywhere else a client navigation to Home that lands on
  the section. They used to be bare `#echipa` / `#despre` / `#servicii` / `#lucrari` everywhere, so on
  a service page COMPANIE and DESPRE pointed at ids that page does not have and did nothing.
  `#parteneri` is the footer's own column, on every page, and stays a plain anchor. The burger
  overlay renders the same links.
- **Preferences** (language · theme · sound) are unchanged in size and behaviour; they take the
  glass and a blue neon hover.
- **CTA** `CERE OFERTĂ ↗` (`cta-neon`; `START PROIECT ↗` until 2026-10-09) opens the request
  dialog.
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
  own; it turns with the project cards, speeds up while the visitor scrolls, and flares when a new
  project reaches the front. At the end of the section it winds up, closes into a beam and
  dissolves. What the cards do depends on the screen — see [Work](#work).
- Each model follows its place on the page at a parallax factor below 1, so the canvas's
  one-frame lag behind a scrolling page reads as depth (the helix follows Work rigidly: its zone
  is stuck while the cards turn, and stays stuck through the finish, so the two never part).
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

- **It never competes with the page.** The decision waits for an idle slot after the page has
  loaded; a probe answer is cached for the tab
  (`tbs_gpu_probe`). A returning visitor without a capable GPU downloads neither three.js nor
  GSAP.
- **Paused** (nothing drawn, the context kept) while the stage is scrolled away, the tab is
  hidden, or the burger menu or the request dialog covers the page.
- **Self-tuning.** On a slow device the scene first drops its pixel ratio to 1×, then halves its
  particles ("lite"); a device still under 28 fps for four ~1s windows after that gives up, and
  the session stays on the static art. A steady 30 fps (iOS Low Power, Chrome Energy Saver) is a
  refresh cap, not slowness.
- **QA switch:** `localStorage.tbs_scene_3d = "force"` draws the scene even on a software
  renderer and never gives up; `"off"` keeps the stage off. It changes what is drawn, never what
  the page does.

**Scroll effects**

- On a capable desktop (from 861px, a hovering fine pointer, motion allowed) the hero's backdrop
  drifts down (+12%) and its stat cards up (−8%) as the hero scrolls away — measured by GSAP
  ScrollTrigger, and the identity at the top of the page.
- The project screenshots' parallax in [Work](#work) is CSS only (held, not played, inside the
  spiral).

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
- **Backdrop** (decorative, `aria-hidden`): a red and a blue key light,
  the HUD grid "wall", a grid floor in perspective drifting towards the viewer, a hairline scanner.
  The looping layers **pause** while the hero is scrolled out of view (`data-offscreen`) and
  under reduced motion — each resumes where it stopped. The lit layers sit in
  `[data-parallax="hero-backdrop"]` (the desktop parallax).
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
  core and under the headline and its buttons, at `--hero-scrim`.
- **Copy** (2026-10-28, the wireframe's header): trilingual literals (`L()` in the component),
  not catalog keys. What we build, how it makes life better and how to get it — in the headline
  and the two buttons, nothing else. It does not invent a delivery deadline or call the work
  “cheap”.
  - **The headline:** the page's only `<h1>` (34→74px on phones, 44→92px from 861px),
    **„Site-uri, aplicații și MVP cu buget mic.”**
    (RU *„Сайты, приложения и MVP с небольшим бюджетом: проверьте идею, прежде чем вкладывать
    всё.”*, EN *“Websites, apps and MVPs on a small budget: test the idea before you invest it
    all.”*), whose closing full stop is a plain red glyph.
  - **No subtitle, no line under the buttons** (the owner, 2026-10-28). The subtitle of
    2026-10-09 (*"MVP concentrat, cu buget de pornire mic și clar…"*) and the three-phrase line
    under the CTAs were removed in every language; don't bring them back.
  - **History:** the old lead line (*"De la consultanță la produs funcțional."*) was removed at
    the owner's request on 2026-10-02. The kicker above the headline (`TBS DIGITAL / WEB · SOFTWARE · AI`) went on
    2026-09-25, with every other kicker on the site — see
    [No kicker lines](#no-kicker-lines-2026-09-25).
- **CTAs:** the primary `cta-neon` button **"Cere ofertă"** (the site's one direct CTA, the same
  words as the header's) with an `aria-hidden` ↗ SVG opens the request dialog (`source: "hero"`);
  the secondary ghost link **"Vezi serviciile ↓"** goes to `#servicii`. Nothing under them. Both CTAs **boost the 3D chip** while hovered by a mouse or pen (never a finger — a tap
  has no hover to end it) or focused **visibly** from the keyboard. Hover and focus are separate
  reasons, so moving the mouse off a keyboard-focused CTA keeps the boost, and the focus the dialog
  hands back after a mouse close (not `:focus-visible`) does not start one.
- **Metrics** (`role="group"`, `aria-label` "Indicatori", in `[data-parallax="hero-stats"]`):
  glass cards (`data-metric="projects|automation"`) with a red / blue accent and an accent
  hairline along the top. The portfolio count is `projects.length` in its own `<b>` (no count-up,
  no card when it is 0). The second card is the reply time, a promise the site makes on every
  request: **"1 zi"** — *"răspuns la orice cerere"*, *"în cel mult o zi lucrătoare"*. It was
  `24/7` *"automatizări active"* until 2026-10-09, too close to the claims removed from the team
  card as not measurable; it keeps the `automation` id. Solid glass instead of blur below 861px.
  - **Drawn by the 3D scene from 2026-09-25 (`[data-scene-anchor="stat"]`).** At 861px and up, on
    a renderer that really draws (`[data-scene-stage][data-renderer="webgl"]`), the card keeps its
    box and loses its paint (`app/globals.css`), and the scene draws a **holographic panel** in
    that box instead — the same number, label and note, composed from the card's own text and
    computed type onto a small canvas and drawn on the Work hologram's shader
    ([04](./04-design-system.md#the-hero-stat-panels-2026-09-25)). It leans towards the pointer
    over it, lifts a little out of the page while it is there, and breathes on a slow float.
  - **The card is still the page's.** Not `display: none`, not `visibility: hidden`, not `inert`:
    a screen reader reads the number exactly as before, the text is still selectable by software
    that reads the DOM, and wherever a panel is not drawn — below 861px, on a `fallback` / `off`
    renderer, under reduced motion, on a low-tier device, with the `tbs_scene_3d=off` switch, and
    for any crawler that does not run WebGL — the visitor sees the glass cards we have always
    shipped. There is no second copy of the numbers anywhere.
  - **A wireframe hologram** in each card's corner (`data-hologram`): an octahedron for the
    portfolio, a gyroscope of rings for the automations — hairlines only, no vertex dots. It turns
    slowly only while the stage allows motion (`data-motion="live"`) and the hero is on screen; otherwise it rests on a three-quarter pose. Still under reduced motion.
  - **Tilt:** under a mouse a card tilts up to 8° towards the pointer and settles back when it
    leaves; never on touch, never under reduced motion. Where the 3D panel is drawn the lean is the panel's, in the scene's own perspective,
    and the card underneath it is not transformed at all.

From 861px the hero is two columns and fills the first screen together with the ticker.

## Ticker

`components/sections/Ticker.tsx`, directly under the hero. A glass band with a red neon top line
that repeats the offer in plain words (2026-10-28): *Începe mic, crește pe rezultate · Site-uri și
magazine online · Aplicații mobile și web · MVP cu buget mic · CRM și automatizări · Asistenți IA
și boți*. Decorative
(every word is said elsewhere), so the whole strip is `aria-hidden`.

The track renders **five identical groups, each ending in its own separator** — a slanted red
neon hairline, 1px wide in the layout (it was a round dot until 2026-09-17) — and the same gap,
and the marquee moves it by exactly one group per loop (`--marquee-copies`), so the seam lands on
a copy of what was just there and the loop has no visible join. The edges fade (the band itself
stays solid edge to edge), hover pauses it, and under reduced motion only the first group is
shown, wrapped and centred, without the seam separator.

## Stakes — "Ce pierzi când online-ul nu lucrează pentru tine." (`#problema`)

`components/sections/Stakes.tsx` (2026-10-28), wireframe step 2, right after the hero and the
ticker, inside the 3D stage (it draws nothing there). What it costs the visitor *not* to act — said lightly, with no figure, no urgency and no
fear. One `h2`, three cards (a `role="list"`), then the way out:

| Tag | Title | Text |
|---|---|---|
| `CLIENȚI` (red) | „Clienți care ajung la alții” | „Te caută online și nu te găsesc, sau site-ul nu spune clar ce oferi. Cererea ajunge la concurență.” |
| `BUGET` (cyan) | „Buget pus pe o idee netestată” | „Construiești tot produsul dintr-odată și afli abia la final dacă îl vrea cineva.” |
| `TIMP` (blue) | „Ore pierdute pe muncă manuală” | „Tabele, date copiate dintr-un loc în altul, aceleași răspunsuri scrise iar și iar. Timp care nu mai rămâne pentru clienți.” |

Each card's description (16px) is hidden until the card is hovered, where a hover exists — on a
touch screen it is always shown (2026-10-29, the owner's call); it fades in over its own space, so
the row keeps its height. Each problem is one TBS's offer answers: sites and stores, the MVP, CRM
and automations. Then
the direct CTA **„Cere ofertă”** (`solUI.actionTalk`, 60px tall, 18px type) — alone: its closing line was taken out on
2026-10-29 (the owner's rule; don't bring it back) —
the site's red button, which opens the shared request dialog with `source: "home-stakes"`.

- **The cards** are Principles' cards without the marks and proofs: `--panel`, `--line` border,
  18px radius, a 3px accent bar along the top (`--accent`), the tag in `--accent-text` (4.5:1 —
  no amber, which has no text twin). One column on a phone, three from 861px. No hover: they are
  not controls.
- **The close:** the line and the CTA stacked on a phone, one row from 641px. The CTA is at least
  52px tall.
- **Forced colours:** the bar becomes `CanvasText`, the button gets a `ButtonText` edge.
- **Copy:** `{ ro, ru, en }` literals in the component. The test
  (`components/__tests__/stakes-explainer.test.tsx`) pins the heading, the three cards, that no
  digit appears, and that the CTA calls `openRequest({ source: "home-stakes" })`.

## Directions

`components/sections/Directions.tsx`, in Tailwind (`section#servicii`, 2026-09-17) — the
**services, sold**: five pills, a preview that pitches the selected direction with its starting
price and a request, and the HUD screen the 3D model draws behind. (It was a chooser with a
read-only preview until 2026-10-09, when the owner turned the page to selling.) The section's own
copy is trilingual `L()` literals in the component; each direction's pitch, accent and reference
project come from `lib/solutions.ts` and the live portfolio.

- **Heading row:** the `<h2>` alone (2026-10-28, the wireframe's value proposition, with the
  search phrases in it): **„Alege ce îți trebuie: site, magazin online, aplicație sau
  automatizare.”** No lead paragraph under it — the owner's rule; it was removed in every language.
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
- **Preview:** the direction's **pitch** (`pitch` in `lib/solutions.ts`, the same text the
  service page leads with): an outcome as the `<h3>` and three ✓ deliverables — the pitch's
  text is not shown here since 2026-10-29 (the owner's rule; the service page still leads with
  it and it stays the meta description). Then the **starting price** and **two actions**.
  - **The price** comes from the admin's services, verbatim (it already says "de la"). It is
    found through the same direction → estimator type → service mapping the request dialog uses
    (`directionPrice`), so the card always shows the figure the dialog will. Brand & UI has no
    service of its own and shows none, and an empty price shows nothing.
  - **"Cere ofertă"** (red CTA) opens the request dialog with the direction preselected
    (`source: "home-services"`).
  - **"Detalii →"** (it was "Deschide serviciul →") is the one link out, into the service page,
    and always navigates on the first tap. Below 641px both stack full width, 48px tall.

  The pitches:

  | Direction | Outcome (`<h3>`) | Price |
  |---|---|---|
  | Produs digital | „Testează ideea înainte să construiești tot produsul” | site's |
  | E-commerce | „Vinde online fără un magazin complicat” | shop's |
  | Automatizare & API | „Scapă întâi de munca manuală care te costă cel mai mult” | automation's |
  | Asistenți IA & boturi | „Nu mai pierde cereri în mesaje” | automation's |
  | Brand & UI | „Clienții trebuie să înțeleagă din prima ce oferi” | none |
- **HUD screen** (`data-testid="scene-services"`, `data-shape="<slug>"`): see-through, so the
  canvas shows behind it; a decorative layer (HUD grid with a radial fade, an accent glow, a scan
  line that pauses while the section is off screen, four corner brackets);
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
  what is under the section (or the stage's scroll measurements). Raised for the longer pitches
  on 2026-10-09 and checked in Edge: `#lucrari` stayed put across all five directions at
  1366×768 (RO, RU) and on a 390px phone.
- Only the first direction's drawing is in the HTML; the others load the first time another
  direction is selected.

## Work

`components/sections/Work.tsx`, in Tailwind (`section#lucrari`, 2026-09-17). The `<h2>`
**"Ce am construit deja."** ("Proiectele care ne reprezintă." until 2026-10-09; its **"Portofoliu
TBS"** kicker went on 2026-09-25, its lead line on 2026-10-02), then one HUD card per project from
the store — fully editable from the admin's **Proiecte** tab ([09 — Admin](./09-admin.md)). What
to do after the cards — ask for a project like them, see them all, the partners — is
[WorkProof](#workproof--after-the-projects), right under the stage.

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
  front. **Each card turns with the helix**: it is posed in 3D from its own angle round the
  strand — it rotates away as it goes behind and back as it returns to the front, leans a little
  along the strand's rise, and the far half of the orbit is pushed away from the camera. The
  perspective is written per card, never on the track: a `perspective` on the track would make it
  a stacking context and lift the cards behind the helix out from under the canvas. Because every
  card sits in the same grid cell, the vanishing point is still shared. The front card is posed
  at zero, so its rendering — and its contrast — is identical to a card in the grid.
  The card at the front is the largest and sits over the canvas; the cards behind the
  helix are smaller, fainter and pass **under** it — real depth, not a fade. Only a card facing
  the visitor takes a click or a tap; one behind the helix never does, and neither does a card
  faded under 8% opacity. **The cards are spaced far enough apart not to pile up:** neighbours
  are spaced a third of the zone apart at 1280×800 and the card at the front is 258px wide, and a
  card fades out at 2.6 steps from the front — just before its own turn would take it behind the
  helix, so the strands show **between** the cards rather than behind them. A card's centre
  crosses the window from y 904 to y −33, entering at 0.62 opacity rather than creeping in
  invisible, and its opacity only reaches 0 once its box has left the layer, so nothing winks out
  in front of the visitor. The section grows by that
  scroll (one sticky screen plus one step per card, plus the finish below); nothing sideways, and
  no card slips under the Phase 5 rail's lane (44px from 861px). A card in the spiral is **as tall as its content**
  (at least the spiral's even height): a long description — always shown on a touch tablet,
  revealed on hover on a desktop — is never cut off.
- **The entrance is timed, not scrubbed.** The cards do not simply appear on the helix. They
  arrive on the Work gate that already brings the services swarm over and forms the helix (1.2s,
  `fx.ts`), staggered card by card along the strand over about 530ms — a card starts folded onto
  the strand's axis, small and turned away, and unfolds onto its slot. The gate runs on its own
  clock, so it always finishes and can never rest half-formed, however the visitor scrolls.
  Without the scene (reduced motion, fallback) there is no entrance: the cards are simply in the
  grid.
- **The screenshot is drawn on by the scroll.** The project picture is not simply present: it is
  built up from its bottom edge as its card climbs the zone, behind a sheet of scan lines in the
  card's own accent whose bright leading edge rides the reveal. It **assembles** rather than
  simply appearing: the part already drawn on is masked into 16px columns that fill as the card
  rises — a column that has not arrived yet shows as a stripe in the project's accent, not as a
  hole — and the picture settles out of a 6% lift at the same time. It is driven by `--helix-wipe`,
  written per card from that card's own place on the strand — so it happens where the visitor is
  looking, on every pass, and runs backwards if they scroll back. The driver writes it on the two
  elements that read it, the screenshot and its scan layer, never on the card itself: an inherited
  property there restyled the card's whole subtree on every write. A card is whole well before it
  reaches the front, so the project being read, and every card above it, always show their
  picture complete; the card one step below the front sitting part-drawn is the effect, not a
  defect. **This replaced a timed animation that nobody could see:** armed off the section's
  one-shot gate, the 420ms wipe fired at scrollY 1602 while the track still began at 1961, so on
  a full pass through the section not one sampled frame out of 91 caught a picture mid-reveal.
  When a project reaches the front, one bar crosses it in the same accent (520ms), covering both
  the strand flare and the hologram's glitch on that same swap, so the three read as one event.
  The scan sheet is painted on the screenshot and **under** the card's washes, so it is
  attenuated exactly as the picture is wherever copy sits over it. Under reduced motion, on the
  phone band and on the static art the picture is simply there, as before.
- **The screenshot's parallax is held in the spiral, not played** (2026-10-08). A hard scroll
  through the spiral braked hard on the owner's laptop (an RTX 4070 whose driver keeps it at
  225–855 MHz while a page scrolls): the grid's parallax, a scroll-driven animation, made the
  screenshot of every card a compositor layer of its own, and with it the card's rounded clip, the
  luminosity blend and the scan above it became layers and offscreen passes too — 16 passes a frame
  with five cards on screen. Now the driver writes each card, once per layout, where Work's view
  timeline stands at the scroll that makes it the front card (`--helix-parallax`), and the
  picture is held there as a plain 2D transform, painted with its card: 6 passes a frame and one
  layer per card. The card being read shows its picture exactly where the animation had it
  (within 0.003px at every card); the others give up the drift around that moment — about 1.7px a
  card step with the nine projects at 1280×800 (3.45px two steps out, where a card is small,
  turned and at half opacity), more with fewer projects or taller cards (about 2.9px a step at the
  three-card minimum; 2.4px for the 360px IQ Arena card on a 768×1024 touch tablet). In the grid,
  the band and the ambient helix the parallax plays as before.
- **The finish.** The run used to end on a freeze: the front card reached the last project about
  234px (346px on a tablet) before its sticky slot released it, so every card held one identical
  pose while the helix — clamped differently — slid out of the top of the screen without them.
  Now the track carries **1.35 card-steps more**, the focus runs on past the last card at exactly
  the same rate (no change of pace at the hand-over), and over that stretch the cards fold onto
  the strand's axis and fade while the helix winds up, draws its strands into a beam and
  dissolves. The hologram goes with it. The scene stops drawing entirely once the section is
  behind the visitor.
- **What follows rides up over the finish (2026-10-09).** The finish is scroll the deck spends
  pinned, and what followed the track could only come in after all of it had passed. At the
  owner's 1700×1300 window the last card was gone a whole screen before the next section reached
  the middle: *"spirala se termina prea devreme si jumatate de pagina ramane goala"*.
  - **The overlap.** Now the stage carries a negative bottom margin, `--helix-overlap`
    (`helixOverlap` in `components/scene/helix.ts`, written by the driver, applied by
    `app/globals.css` only while `data-helix="spiral"`). It equals the finish's length plus the
    stage's padding, less one gap: the gap between two cards on the strand, never under 64px. The
    stage keeps its full height, so the deck and the strand finish exactly as before, while the
    next section comes up right under the last card.
  - **Measured.** At 1702×1287 there are 132–240px between the last card and the next section,
    which used to be half a page. At 1366×768 there are 35–50px, never touching.
  - **The curtain.** The stage's sticky layer (`[data-scene-layer]`: the strand and the hologram)
    is clipped (`clip-path: inset`) at that section's top edge, so the section covers the scene as
    it comes up instead of being drawn over by it, with no background of its own: the page's grid
    shows through. The clip is plain arithmetic on the scroll (the stage's bottom and the overlap,
    measured at layout). It is written on the layer itself, not inherited from the stage, which
    would restyle every card each frame, and only when it moves by half a pixel.
  - **Painting order.** WorkProof and "De ce TBS" are positioned, so they paint above the stage
    they overlap.
  - **Off by default.** Without the spiral (a phone, the static art, reduced motion), nothing
    overlaps.
- **The helix answers the visitor.** Scrolling faster speeds up the packets, the 0/1 bits and the
  comet running the rungs, and lifts the glow; a new project arriving at the front, or the
  hologram swapping, flares the strands for about half a second. This is all done by changing
  values already sent to the GPU — no extra geometry and no extra draw per frame.
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
  **in the empty band above the heading** — between the Directions panel and Work's `<h2>`
  (about 84px on a phone), about 60px tall there and at most 0.6 of the screen wide,
  touching no text and no card — coloured after the card nearest the middle of the band. It is not behind the
  heading: there its flaring chips and packets turned the headline's pixels near-white, and keeping
  the copy readable left it a faint trace in the dark theme and nothing at all in the light one. The
  services model's swarm flies to it once Work's cards pass 55% of the viewport; on a very short
  phone (568px tall) the band is under the header at that moment and comes into view when the page
  is scrolled back a little.
- **Arriving while Work is not safely below the window** (a reload, a link, a click before the
  scene arrived): the spiral is laid out anyway, and what the visitor sees is kept
  (`workHelix.ts` `apply`, 2026-10-03). Looking at Work — its track across the middle of the
  window — they land back on the project nearest that middle. Reading Directions with only the
  top of the track peeking in below (a `/#servicii` link at 1720×1300) nothing moves: the spiral
  grows under them. Past Work (a `/#despre` or `/#echipa` link) what follows the track is put back
  where it was. The last two used to be handed the nearest card too, and jumped into Work about a
  second after the scene went live. Leaving the spiral (a narrower window, the scene switched off)
  puts the grid back at once, with the focused card where the visitor was looking.
- Without the scene nothing of this exists: no helix, no inline layout, no `data-helix`.

Seeded content (`lib/content.ts`, nine projects): BizCheck, Itara Global, DocuSafe, Crowe Portal,
CGAM, IQ Arena, Balloons Breeze, Statistic, FLIRT. Note that **CGAM and IQ Arena are two different projects** — CGAM is
the academy's web platform (cgam.md); IQ Arena is the mobile negotiation game. Screenshots live in
`public/projects/`.

## WorkProof — after the projects

`components/sections/WorkProof.tsx` (2026-10-09), right after the stage, before "De ce TBS": the
projects have just been shown, so this is where to act on them. A compact centred column, no
heading of its own and no id:

- no line of text: the sentence that opened it (*„Proiecte reale, nu machete…”*) was taken out
  on 2026-10-29, at the owner's request — don't bring it back;
- **"Vreau un proiect similar"** (red CTA, the request dialog, `source: "home-work"`) and **"Vezi
  toate proiectele →"** (`/portofoliu`, built like the footer's link; the arrow is `aria-hidden`).
  Stacked full width on a phone, one row from 641px;
- **"Lucrăm alături de"** and the partners' logos, from the store (`partners`: Crowe Turcan
  Mikhailenko, CGAM Business Academy, Ivan Turcan), each linking to its site in a new tab like
  the footer's partner links. The logo files were on disk but shown nowhere before. They are
  white on transparent (the admin asks for exactly that), so each sits on a dark `--panel` tile
  of one height. Forced colours keep the tiles dark, or the white logos would vanish. A partner
  without a logo shows its name.

No testimonials: none exist, and the page invents none. When the owner has real ones (a name, a
role, their consent), this is where they go.

## Service pages — "Proiecte relevante"

`components/sections/DirectionPage.tsx` (`<section id="proiecte">`), styled by `.projects` /
`.projectsReel` / `.projectGrid` / `.project`.

The heading stands alone (2026-10-02): its lead line (*"Lucrări reale livrate pe această
direcție."*) went, and so did the intro paragraph under every service page's `<h1>` — the
`intro` field is gone from `lib/solutions.ts`.

**The top of a service page sells (2026-10-09)** — the page an ad lands on.
- **Under the `<h1>`:** the direction's pitch, as on the home page — the outcome in bold
  (`.leadTitle`), what we do (`.lead`) — and its starting price (`.price`, the admin's, verbatim;
  none for Brand & UI).
- **The action bar:** its primary button is **"Cere ofertă"** (it was "Vorbește cu echipa"), the
  same dialog with the service preselected.
- **Its own metadata:** the title was the raw slug (*"TBS Digital — produs-digital"*), with no
  description. It is now *"<the menu's name of the direction> | TBS Digital"* (keyword first,
  brand last, since 2026-10-28), and the
  description is the pitch's text, in the request's language. Open Graph and Twitter are
  restated ([16](./16-i18n-seo.md)).

**Two shapes, and CSS chooses.** From 861px up on a renderer that really draws, the 3D laptop
stage is laid out and the grid below it is `display: none` — the projects run on the machine's
display and pressing it opens the one that is on it. Everywhere else — a phone, `fallback`, `off`,
reduced motion — the stage is `display: none` and the grid is what carries the projects.

**On a phone the grid is a strip, not a column** (2026-09-28). Five cards one under another made
this section **1972px tall on a 390px phone** — a page and a half of scrolling for a list you take
in at a glance when the cards stand side by side. Below 761px they do: a scroll-snap strip you push
along, written the way Work's grid already is on the same widths
([Work.tsx:207-210](../components/sections/Work.tsx)), down to the card width,
`min(390px, max(82vw, 320px))`. The section is **477px** there now, and the next card is visible at
the screen's edge, so nothing has to say "swipe".

**The scroll box is the wrapper, never the grid.** `.projectsReel` exists for exactly this: the
grid carries the shelf's frame on `::before` / `::after` and both hang 6px OUTSIDE it, so an
overflow box on the grid would cut them away — and an absolutely positioned child of a scroller
scrolls with its content in any case. Out on the wrapper the frame stays whole, and the wrapper's
12px of padding (given back as a negative margin, so the section's height is unchanged) is what
keeps the clip off the frame and off the card's 4px lift. The strip reaches the screen's own edges
the same way Work's does, `margin-inline: calc(-1 * var(--gutter))` against `padding-inline:
var(--gutter)`, and a snapped card still lands on the text column because `scroll-padding-inline`
is the gutter too. `overscroll-behavior-x: contain` keeps a swipe that runs out of cards from
turning into the browser's back gesture.

**The grid is `width: max-content` there**, which is what makes the frame right: drawn against a
box the width of the screen it would end after the first card, and against the shelf's own width it
runs the whole reel, with the closing bracket still waiting for the last window (`--card-count`).
One consequence is worth knowing: a flex item that GROWS contributes its own max-content width to
such a container, so a growing card made the reel 6171px wide and its description one long line.
The cards therefore do not grow — except when there is only one of them, where there is nothing to
push and the reel is sized the ordinary way instead so the single card can fill the row.

**What is watched and what is opened are not the same element.** The arrival observer's threshold
is a SHARE of its target, and once the cards run sideways the grid is four screens wide: the share
of it on screen tops out around 0.235 on a 390px phone, under the 0.25 the observer asks for, and
the frame would have stayed dark for good. So the wrapper — the box the visitor actually has in
front of them, at every width — is what is observed, and what it opens is the grid. The cards are
still watched one by one and open themselves, and the 3D stage still rides the same observer.

**The 90ms ladder came back with the strip.** Stacked, each card arrived on its own as the visitor
scrolled, so a ladder would only have delayed the last one and `--step` was pinned to 0. Side by
side they arrive together, so they cascade again, exactly as they do on a desktop.

## Service pages — "Cum lucrăm" and the close

`components/sections/DirectionPage.tsx`, the `/servicii/<slug>` pages.

**The steps.** A list, read one at a time: an IntersectionObserver holds a reading line at 45% of
the viewport, and what is lit is COUNTED from it — how many of the block's marks have already
crossed. The rail beside them fills to match, and the 3D model docks into a sticky corner
(`data-scene-anchor="steps"`, desktop and WebGL only) on the step's own moment.

**Three panels abreast** (2026-09-27). The block holds three short sentences and the card is as
wide as the page, so as a stacked list it was one column of type and a great deal of dark — and the
data has nothing more to give: the three capabilities with descriptions (`items`) are already drawn
higher up the page, and `flow` only exists on some directions. So the richness comes from form.
Each step is a panel now: its index in mono at the top, the sentence under it, and the SAME index
set enormous in the bottom corner in the site's own three stops (`[data-progress]`'s, the ones the
footer's wordmark closes the page on). A spine runs across the top and fills as they are read. The
panel being read lifts 3px, takes a cyan border and a barely-there fill, and lights both of its
indices.

**And that needed a deeper move than it looks.** The live step is chosen by a reading line at 45%
of the viewport, which only works on things that cross it ONE AT A TIME — three panels abreast
cross it on the same frame. So the observer watches invisible 1px marks spread down the block's
height in the steps' order, and the panels light off `data-active`, which the same observer writes.
One truth, two drawings; the model's docking on the step's moment is untouched.

**How the lighting is decided** (2026-09-28). Three things were wrong with the first version of it,
and they were one thing: it read the state off whatever happened to be inside the observer's band,
instead of counting.

- The marks were children of the panel row, so all three sat within 73px of each other against a
  72px band — every state handed over inside 177px of scroll, most of it at once.
- Between two marks nothing is in the band at all, and that emptiness was read as "the block is
  behind us", so the lighting went 1 → done → 2 → done → 3.
- A band 8% of the viewport tall can be flicked clean through between two frames, and an observer
  that was outside before and outside after reports nothing.

Now the marks are direct children of the section and the state is derived from positions on every
callback: `doneCount` is how many marks are above the line, the last of them is `live`, and the
observer's root is everything ABOVE the line (`rootMargin: 0px 0px -55% 0px`) rather than a band
around it — a region 45% of the viewport tall cannot be jumped, and once a mark is in it, it stays
in. The result can only move one way as you scroll, and reverses exactly on the way back up,
because nothing is remembered between callbacks.

**There is one mark more than there are steps.** The extra one sits at the block's foot, and its
crossing is what `data-active="done"` means: the block is genuinely behind the reading line, not
merely between two of its own steps. Before it existed the attribute kept the step COUNT, so the
third panel stayed lit for the whole rest of the page — a box stuck on rather than a step
happening. In `done` all three panels are lit equally and calmly (index at .26, border cyan at
22%), none of them raised.

The marks take equal shares of the block — mark `--m` of `--n` steps at `8% + --m × (92% / --n)`,
so mark 0 is at 8% and the tail at 100%. Spreading only the steps put the third one 30px from the
foot, a blink before the block counted as read; at 1440×900 each step now holds the line for
~107px of scroll.

**It lights in sequence when it is reached.** The spine draws out from the left, the panels come up
one after another 140ms apart, and each one's giant index rises into it a beat later — once, on
the same latch the footer uses (`data-armed` at mount so a visitor without JavaScript sees the
finished block, `data-entered` latched once so it never replays). The panel's entrance is on
`transform` and its lit state on `translate`, two properties, so the 3px lift of the step being
read composes with the entrance instead of fighting its fill; the index rises on `translate` for
the same reason, because its opacity belongs to the lit state.

**And a light runs the spine to the step being read.** Not a loop: its position IS
`--steps-progress`, the number the fill is scaled by and the observer writes, so it can only ever
be where the reading is. It is placed in units of the spine (`cqw`) because both the step count
and the card's width change, and a pixel offset would be wrong at every one of them.

Where a direction has a flow scheme beside the rows the steps get half the card, so they stay
stacked there, and likewise under 860px.

**The close.** `AI UN PROIECT ÎN MINTE?` was a heading, a line and a button standing in the page's
dark with nothing around them. It is a panel now, with four corner brackets — the HUD's own
language — and a coloured thread drawn across its top edge as the block enters the viewport
(`animation-timeline: view()`, once). The brackets take a lighter tone than `--line`: that hairline
is made for the inside of a panel and disappears on the page's own dark.

Nothing in either block repeats, so neither needs the off-screen pause —
see [07](./07-conventions.md#the-rest).

## /02 — Principles: "De ce TBS." (`#despre`)

Since 2026-10-09 the section answers *why choose us* — it was "Cum lucrăm, pe scurt.", three
principles. Four numbered cards, each with its own accent:

| Card | Title | Mark |
|---|---|---|
| `01 / IDEEA` (blue) | „Pornim de la problema ta, nu de la o listă de funcții” | a bracketed sight |
| `02 / BUGET` (amber) | „Buget de pornire mic și clar” | a price tag (no figure) |
| `03 / REZULTATE` (green) | „Dezvoltăm doar ce funcționează” | three listed stages |
| `04 / CONTINUITATE` (red) | „Aceeași echipă, de la MVP la produs” | layers |

The cards carry **no sentence** under the title since 2026-10-29 (the owner's rule): number,
title, mark and proof.

Since 2026-10-28 the section is the guide's **empathy** in the wireframe: its `<h2>` is
„Înțelegem ce riști când pornești ceva nou.” and the cards under it are the authority, each with
its real proof.

**A bento with proofs (2026-10-09, the owner's pick).** As a row of four even cards it looked
exactly like "Cum începem" under it ("arată una ca alta"). Now each reason carries its evidence
at the card's foot, and the cards are not the same size:

- **The grid:** one column on a phone. From 641px, two columns, with IDEEA and CONTINUITATE across
  both. From 1025px, three columns: IDEEA spanning two beside BUGET, then REZULTATE beside CONTINUITATE
  spanning two. There the wide cards put the sentence left and the proof right, centred in the
  card's height.
- **IDEEA:** the three goals a client brings — the request assistant's own answers, word for word
  (`TREE.start` in `Estimator.tsx`): „Unde pierdem clienți” · „Ce proces merită automatizat” ·
  „Dacă există cerere” — as outlined chips (re-synced 2026-10-28; they had drifted). As the card is revealed
  they light one after another and stay lit: an entrance, not a loop, since nothing on the page
  moves on its own for more than five seconds (WCAG 2.2.2).
- **BUGET:** the real price list. The request form's five project types, each with its starting
  price read from the admin exactly as the dialog's "PROPUNEREA TA" reads it, a dotted leader
  between them. Every row is a button that opens the request with that type preselected
  (`source: "home-why"`); its accessible name adds "Cere ofertă". These are the only digits the
  section shows, and they are the owner's.
- **REZULTATE:** a project as the client sees it: „Strategie” · „Design” · „Dezvoltare” · „Lansare”,
  each with a „demo” tag, the first three done, the last still to come. No numbers.
- **CONTINUITATE:** the team from the store, up to four, each name and role. No faces: the photos and
  initials were taken out at the owner's request the same day, since the team section right
  under it shows them. With an empty team, no proof.
- **No lift on hover** (it got in the way of aiming at a price row); an accent edge fades in
  instead.

The mark sits in the card's top row beside the number. The copy lives in the component as
`{ ro, ru, en }` literals, not in the catalog. The original five-cell grid and the four-box stats
row are both gone; the stats row's `50+ / 8+ / 30+ / 24/7` were never measurable from anything the
project holds.

`accent` and `accentText` are deliberately two tokens: the first tints the hover border and the
mark, which are graphics and owe 3:1, and the second colours the 12px/800 number, which is TEXT
and owes 4.5:1. All three brand fills fail as small text.

### The card marks (2026-09-24)

One small line drawing per card, the SAME size in the SAME place on every card: the card's top
row, opposite the number. Since 2026-10-09: the sight for `01`, a price tag for `02` (straight
edges, a square hole, no number), the listed stages for `03`, the layers for `04` (it was three
cards: layers, stages, sight). They fade in once on the reveal the section already has, 140ms
apart, and never move again.

**The sameness is the design, and it is the correction.** The first attempt gave each card a
different instrument: a CSS 3D model of the site's own processor in `01`, a linked list of the
three real stages read from `lib/solutions.ts` in `02`, and a large bracketed frame in `03`. Every
piece was defensible on its own and the row was not: three different visual weights, and the
empty frame — whose emptiness was the argument, since the only indicator it could display is one
it invented — read to the owner as a panel that had failed to load. It was replaced rather than
tuned. What is worth keeping from it is the reason it failed: *an argument the viewer has to be
told is not an argument*, and a row of three only reads as a row when the three match.

**Drawn to the house rules for line art** (docs/07): straight strokes, square caps and joins, no
circle anywhere, no decorative dots, and nothing animated on `stroke-dashoffset`. `stroke-width`
is set in CSS with `vector-effect: non-scaling-stroke`, so the same drawing keeps a 2px stroke
whatever the box is scaled to instead of going hairline on one card and slab on another.

**Nothing in a mark may ever show a value** — no numeral, no percentage, no axis label, no needle,
no bar, and no price on the tag. The sight once stood beside "Legăm fiecare livrare de un
indicator real", and the only indicator a component could put in that mark is one it invented. The site has already paid for
that once: the team card carried "50+ proiecte", "98% clienți mulțumiți" and "24/7" until the
first was caught contradicting the hero's real portfolio count, and all three were deleted rather
than re-guessed. The `statusBars` export that still held those literals in `lib/content.ts` was
dead — one grep hit, its own definition — and went with this change.

**The marks are silent.** `aria-hidden`, `focusable="false"`, no `<title>`, no text: the sentence
beside each one is the claim and the mark is only that claim drawn, so there is nothing here to
translate and nothing to fall out of sync with the `{ ro, ru, en }` fields. Under reduced motion
the base declaration is already the finished pose, because `globals.css` kills every animation
with `!important`; under forced colours the drawings stay (a line drawing survives flattening to
one system colour — it is still a legible outline) and only the held-back opacity is released,
which there would read as a faded glyph.

## Process — "Un plan simplu, în trei pași." (`#proces`)

`components/sections/Process.tsx` (2026-10-09), between Team and the Explainer: how easy starting
is, right before the form. Since 2026-10-28 it is the wireframe's **plan** — three steps (it had
four):

1. **„Ne spui ideea”**
2. **„Primești planul și prețul”**
3. **„Lansezi și crești”**

Titles only since 2026-10-29: the sentence under each step was taken out at the owner's request.

The stylesheet follows the count: three grid columns from 1025px, three runs of the cyan → blue
(`--c0`→`--c1`, `--c1`→`--c3`, `--c3`→`--c4`), and the bend, drop and arrowhead delays start
after the third run (`3`, `3.16`, `4.16 × --seg`).

**A circuit trace, not cards** (the owner's pick, the same day: as four cards it looked exactly
like "De ce TBS"). The steps hang on one luminous trace, in the grammar of the portfolio's circuit
board: straight runs, exact 45° bends, square caps, no circles.
- **From 1025px:** the trace runs across three square nodes (the step's number inside), each
  step's words under its node. After 03 it bends down at 45° and ends in an arrowhead pointing at
  the request form right below.
- **Under 1025px:** the trace runs down the left, each step's words beside its node, and ends in
  the same arrowhead.
- **The chip on node 02:** a mono *„≤ 1 zi lucrătoare”*, the promise made visible. It is
  `aria-hidden`, since it repeats the step's title.
- **Light:** the trace is drawn dim (`--line2`) with a lit copy over it (cyan → blue). The first
  time the section comes into view, the light grows from 01 to the arrow in about 1.4s, each node
  and its words switching on as it passes. Then one short pulse runs the trace — once, never a
  loop (WCAG 2.2.2).
- **Reduced motion:** lit at once, no pulse. **Forced colours:** `GrayText` and `Highlight`, no
  glow.
- **The DOM** is a plain `<ol>`; the trace, the bend, the arrow and the pulse are `aria-hidden`
  CSS.

Every promise in it is one the site already makes (the one working day, the demos), and nothing
names a duration or a price.

## Explainer — the story in prose (`#pe-scurt`)

`components/sections/Explainer.tsx` (2026-10-28), wireframe step 6, between Process and the
request. The whole story retold for the visitor who reads to the end, and for search engines:
the visitor's problem → TBS Digital as the guide → the three-step plan → the result. One `h2`
— „Site-uri, aplicații și MVP în Chișinău, construite pas cu pas.” — and two paragraphs:

1. the problem (more customers, less manual work, a new product — but a big build paid up front
   is a risk on an untested idea);
2. the success (test with real customers, the same team develops only what works, time saved,
   budget under control).

The middle paragraph (TBS Digital in Chișinău, the services, the three steps with the one business
day) was taken out on 2026-10-29, at the owner's request — don't bring it back.

One readable column (~68ch) in a quiet `--panel` card, the heading beside the text from 1025px.
No CTA (the request section follows), no price and no digit — the prices are the owner's, read
from the admin by the estimator right after it; the test pins that.

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

## /05 — Team ("Echipa care îți construiește produsul.")

A heading (its lead line went on 2026-10-02), then the **Team Lead's holographic projection**, then a
horizontal snap carousel of member cards. Each card carries the member's photograph (or a gradient
initial where none is set), their name and their role — the `ECHIPA TBS` label above them went on
2026-09-25 with every other kicker. Below the carousel
sits the stat row, which renders only the stats the owner has actually filled in and disappears
entirely while they are all blank.

> This section's description was stale until 2026-09-23: it described a `SYSTEM_STATUS` panel with
> progress bars, member bios and social links, none of which the component renders. `TeamItem` still
> carries `bio` and the social URLs — the admin's **Echipă** tab still edits them — but the card
> shows the label, the photograph, the name and the role, and nothing else.

Real content: **Maxim, Danu, Laurentiu** — first names only, by request. Editable from the admin's
**Echipă** tab. The carousel is a `flex` band with `scroll-snap`, a card about 82vw wide (never
under 320px) so the next one peeks, and `overscroll-behavior-x: contain` so a swipe that runs off
the end does not chain to the page or trigger the iOS back gesture.

**A member with no photograph of their own now takes the bundled one**, matched by id
(`withBundledPhotos` in `lib/siteContent.tsx`). This is a field fallback, not a key-merge: it only
ever reads the saved list, so a member the owner deleted stays deleted. Before it, a shipped asset
was shadowed by an empty saved string and the card fell back to its gradient initial while the file
sat unused in `public/`. An uploaded photograph still wins outright.

### The holographic portrait (2026-09-23)

The card's photograph is PROJECTED rather than printed: he is keyed off his ground, painted in the
site's cyan, laid under scanlines, swept by a beam and broken twice a cycle by a fault. It is all
CSS and one SVG filter.

**It could not have been the WebGL scene, and the reason is worth keeping.** A projection built in
the interior scene stood above the carousel for a day and was removed for this one. The card is
`background: var(--panel)` and the scene's canvas draws BEHIND the page, so a hologram inside the
card would need a hole cut through an opaque panel — which would come apart on the card's own
`:hover` transform, and below 861px, where the scene never starts at all, would show the page
instead of the card. Here it works at every width, on every renderer, with no canvas.

**The filter is arithmetic, not taste** (`#tbs-holo-key`, defined once per section rather than once
per card). Its matrix's alpha row is the luminance coefficients, so alpha comes out as the
picture's own lightness; the transfer below then thresholds that into a silhouette — holding 1 all
the way to 0.90 and falling to 0 at 1.0, because the ground he was photographed on measures exactly
1.000 while his jacket peaks at 0.904 and his shirt at 0.895. The colour rows are the same
coefficients scaled by `--dark-cyan`'s real channels and a gain of 1.05; at 1.3 the blue channel
went over 1 and clipped, which turned the whole lower half of him a washed white instead of cyan.
`color-interpolation-filters="sRGB"` is not decoration: those thresholds were measured in sRGB and
the SVG default is linearRGB, which would put the key somewhere else entirely.

**The scanlines are a MASK, and that is the whole trick.** A mask multiplies alpha, so the lines
fall on HIM and never on the empty space he was keyed out of; an overlay would have striped the
card's panel around him. For the same reason the beam and the torn band are further COPIES of the
photograph rather than gradients laid over the box — a gradient sweeping the whole card reads as a
grey slab crossing it, which is what the first attempt looked like.

**What breaks, and what must never.** Twice a cycle the raster drops to a coarse mask and a band of
him tears sideways, on step timings that share no factor so the loop never announces itself. What
is deliberately absent is anything that rebuilds the picture from nothing: the scene's projection
re-scanned itself once per loop and the owner read it, correctly, as the image reloading. A
projection that reassembles itself is the one thing this must never look like.

**Nobody loses the picture.** The photograph is still the photograph and still carries the `alt`;
everything holographic is a filter, a mask and two faults laid over the same `<img>`. A screen
reader, a crawler and a browser without filter support all get what they got before. Under
`prefers-reduced-motion` it holds one clean frame — keyed, tinted, scanlined and perfectly still —
and under `forced-colors` the filter comes off entirely, because flattening it there would put a
cyan slab where his face is, and the plain photograph is more use than that.

**The source is a bundled asset shot on a light ground.** `public/team/maxim.webp`, 708 × 944,
committed with the code. An admin upload still fills the card as it always did, but the key is what
the light ground buys: on a dark background it would remove nothing.

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
- **One arrangement, two places (2026-09-26).** The dialog used to run this same flow as a
  three-step wizard on one column — a numbered progress bar, Înapoi/Continuă, the assistant
  behind a "Ghidat" button — because two bays squeezed into a 960px modal were cramped. The owner
  asked for one design, so **the dialog now renders the deck**: both bays, the assistant among
  them, everything on screen. The cramping is answered by the deck measuring ITSELF
  (`@container deck (width < 711px)`) rather than the window, so it stacks its bays on its own
  width — 910px and two bays at a 1440px window, one bay inside the dialog on a phone. The page
  keeps its heading and `#estimare`; the dialog has its own head and must not carry a second copy
  of either.
- **The close of the page (2026-10-09).** The heading, shared by the page and the dialog, is
  **"Spune ce vrei să testezi. Stabilim primul pas."** It makes the decision before the price.
  The page has **no lead** under it and the proposal has **no line** under its price (both taken
  out on 2026-10-29, at the owner's request — don't bring them back). The dialog's lead
  explains that its summary is attached to the request. The assistant is labelled **"Ghid pentru
  prima versiune"**, not “online”: it is a guided decision flow, not a live-availability claim.
  Its first question asks what the visitor wants to test; the product branch asks what the first
  version must teach, who should test it and what can be invested in it. This is the page's last
  call to action: BottomCTA (*"Ai un proiect care merită construit corect?"* /
  "Programează consultarea") went the same day. It repeated the form right above it, and its
  button promised a booking that did not exist, since it opened this same form. Its `#contact`
  moved to the footer.
- **It fits on one screen, without scrolling, from about 865px of window height up (Romanian) —
  for the whole conversation.** A dialog has a height budget the page does not, so two things
  answer it: the `ground="ink"` panel drops the 760px cap and uses the window (measured, it was
  stopping at 760 even on a 1080px-tall screen, leaving the deck 107px short), and the deck takes a
  tighter vertical rhythm under `.box[data-layout="dialog"]` — **spacing only**, never a colour, a
  border, a radius or a chip's shape, because the moment it were any of those the dialog would be a
  second design again. Until 2026-10-07 the deck was 568px at the first question and fitted from
  768px of height — but only until the first answer: every answer added a bubble and the deck
  outgrew the window. The chat keeps one size now (next point), the least at which the newest
  question is always whole, and the deck stays at it: 664px in Romanian, 718 in English and
  Russian (longer chip labels), measured 2026-10-07 — fitting from about 865 and 920px of height.
  Below that it scrolls (a 1440×900 laptop: 18px in English), which is what a dialog does.
  `data-layout` survives as BEHAVIOUR only (the corner assistant steps out of the way of the
  `section` one); the stylesheet keys only the tighter rhythm and the chat's size off it.
- **The chat has one size, from the first question to the summary (2026-10-07).** It used to be as
  tall as its contents — 303px with the first question, 416 with the second, 529, 599 once the log
  hit its 360px cap, 835 with the summary — so the deck and the page under it moved at every
  answer. The owner sent the panel as it stands at the second question with "fă dimensiunea să fie
  așa și să nu se mai schimbe", and that is its size on the page now: 419px tall on a wide screen
  (the screenshot's 416.1, plus 3px so a zoomed-out border cannot tip it into a scrollbar), the
  head, the quick replies and the composer in fixed places, and the conversation scrolling in the
  window between them. Details:
  - `--chat-h` is the panel's inside (`box-sizing: content-box`) and a FLOOR (`min-height`): the
    window has a zero flex basis, so no question, reply set or summary makes the panel taller.
    Only the dictation's review or notice can — the composer itself outgrowing the panel — while
    it is open; under a fixed height they spilled out of the panel, under the proposal bay, where
    "Adaugă în câmp" could not be pressed.
  - It steps with the chat's OWN width (`container: bay` on `.bayLeft`; in two columns the bay is
    60% of the deck, so the deck's width was the wrong ruler): page 381px (390 at 860px and under,
    the 44px touch rows), dialog 361 (370), from a 500px chat; then, for both, 442 under 500px,
    537 under 345 and 599 under 275. Each value was checked at the edges of its range over all 12
    steps of the tree in Romanian, English and Russian: the panel never changes size and the newest
    question is always whole (tightest: 3.3px to spare, Russian, a 346px chat).
  - The dialog's value is the least that keeps the newest question whole, no more, for its height
    budget. The owner first chose its size at the FIRST question (296px), but measured over the
    tree that left half the steps a 13px window — the replies take two rows there — and the new
    question out of sight however the window scrolled.
  - The messages sit at the BOTTOM of the window, the newest question right above its replies
    (the owner's choice); the window's edges fade over a bubble's own margin (14px above, 8px
    below), so a resting window covers no message and a scrolled one leaves no sliver.
  - After each answer the window scrolls to the newest message (instantly under reduced motion),
    and it stays there when the window changes size under it — an error line, the dictation, the
    replies re-wrapping — if that is where it was; a visitor reading back is not moved. At the end
    it stops at the closing message, and the summary is read on below it, in the same window.
  - The window is a tab stop ("Conversația cu asistentul"): it scrolls, and nothing in it is
    focusable. The live region is the thread inside it. The composer no longer resizes.
- **Request context (2026-09-17, plumbing for the IT-OS HUD).** Every CTA opens the one request dialog
  (`lib/request/RequestFlowProvider.tsx`) with a `RequestContext`. Besides `serviceSlug`,
  `projectId` / `projectName` and `source`, it now takes:
  - `projectType` — a catalog id (`site`, `crm`, `automation`, `ecommerce`, `mobile`) that wins
    over the slug's mapping; an unknown id is ignored;
  - `optionIds` — exactly these option chips (`design`, `integrations`, `multilingual`, `seo`)
    instead of the default "+ Integrări & API"; `[]` ticks none, unknown ids are dropped;
  - `openAssistant` — dialog only, and since 2026-09-26 it MOVES FOCUS rather than opening
    anything: the deck's assistant is on screen either way. The corner assistant passes it on
    every request she opens, which is what the promise in her accessible name rests on;
  - `guideTopic` — `servicii`, `lucrari` or `service`, written into the origin block as
    `- Secțiune: <topic>` (any other value is left out);
  - `attachment` — a HUD tool's block (`kind` calculator / builder, `count`, optional `summary`,
    `text`): control characters stripped, capped at 1,200 characters with `[…]`
    (`lib/request/attachment.ts`), and a one-line note under the proposal says what travels.

  New `source` ids: `os-calculator`, `os-builder` (the guide's two went with it). The sent message is
  the summary, then the attachment, then the origin block, then the transcript; the attachment's
  and the origin's room is reserved before the summary is clamped, so the whole stays ≤ 5,000
  characters. The project types and options, with their ids, live in `lib/request/catalog.ts`
  (labels unchanged); `payload.project` and `payload.estimate` mean what they did.
### The deck (2026-09-24)

An earlier pass recessed the container — `.box` went to `--bg2`, darker than the page, with the
parts raised on it. **The rule was right and the values were not, and that is measurable rather
than arguable.** Near black the `+ 0.05` term in the contrast formula dominates, so the ladder
came out at 1.02:1 from the page to the box, 1.02:1 from the box to a field and 1.10:1 between
the two parts. Four levels in the code, one on the eye; the section read as a single field of
near-black with thin red scratches on it.

So the ladder is inverted and given real steps: the box is the LIT object and the room around it
is the dark one — a console in an unlit room. Three surfaces in the whole section, no more:

| level | token | value | sat | |
| --- | --- | --- | --- | --- |
| room | `--bg` | `#0a0b10` | 38% | the page |
| deck | `--deck` | `#1f232e` | 33% | **1.25:1** over the room, plus a 1px edge and a real shadow |
| riser | `--riser` | `#151820` | 34% | a recess in the deck, lit on its rim |
| slot | `--slot` | `#0d0f14` | 35% | the fields, identified by their outline |

**The panel is DARK, and that is the third answer to the same question.** It was near-white, then
lavender, then a slate grey card — and a large flat mid-grey is the least attractive value in a
dark interface: it competes with the price and the CTA instead of serving them. So the panel
stopped being the brightest FILL. Its identity is light now: a red-lit rim, a red halo, a light
crossing its top rule, and the price in white at **16.58:1** on it.

Going dark improved everything measured. `--txt` 10.50 → **16.58:1**, `--on-ink-mut` 6.06 →
**9.56:1**, `--red-text` 5.71 → **6.46:1**, `--red-lift` 3.57 → **5.63:1**. And field
identification improved too, which is the counter-intuitive one: the SAME `--riser-line` border
measures 1.55:1 on the old light panel and **2.45:1** on this one, because a light panel was
washing its own outlines out. The border was then lifted to `#5a6176`, which takes it to 2.88:1
against the panel and 3.11:1 against the field — against 1.55:1 before.

**Saturation is tuned as deliberately as luminance.** At the site's usual 50% these surfaces are
large enough to read as a blue slab sitting on a near-black page, which is what the owner saw and
said. The deck came down from 50% to 33% and the panel from 49% to 38% at the same luminance, so
the section keeps the family without announcing itself as blue. Every contrast pair held or
improved through the change: `--red-text` on the deck 5.11 → 5.71:1, `--txt` on the riser
10.43 → 10.50:1, the focus border 3.54 → 3.57:1.

**Solving every step for 1.40:1 was itself an overshoot**, and the second version of this table
records the correction. At those values the deck came out a light blue-grey, the riser lavender,
and the pure-black fields inside it read as holes punched in a card rather than as recesses cut
into it. Separation is a job for the EDGE as much as for the fill: the deck carries a border and
a shadow, so it does not need a big jump, while the panel keeps its own. Every text pairing
improved in the process — `--txt` on the riser 9.00 → 10.43:1, the focus border 3.06 → 3.54:1.
A slot is never `--bg`: two values up it still sits further below its panel than any other pair
in the section. The tokens live in `globals.css`, not as hexes in the module (docs/04).

**A measurement that moved the markup.** `--red-text` is 5.48:1 on the old panel and **3.51:1 on
the riser**, so the red region label cannot live there — and no surface bright enough to separate
from the deck can carry it either (the ceiling is L = 0.0349, which is 1.13:1 from the deck). The
label therefore sits on the deck ABOVE the panel, at 5.11:1, which is also why all three region
labels now share one ground and one weight. The copy under the price moved from `--mut` (4.83:1,
passing and only just) to `--on-ink-mut` (5.19:1).

**The focus cue, and the whole redesign turns on it.** The outline is drawn at `outline-offset`,
i.e. on the PANEL rather than on the field, so its own contrast is ring-against-panel and it has
never been the conforming cue here — about 1.2:1. What actually satisfied WCAG 1.4.11 was the
focus BORDER: `--red` on `--panel2` is 3.60:1. Lighting the panel takes that same border to
2.30:1 and would have quietly broken the only conforming focus indicator a lead-capture form has.
`--red-lift` is the fix, measured on every surface a field can sit on: 4.46:1 on the deck, 3.06:1
on the riser, 6.24:1 against the field's own fill.

**Two lights, one mechanism, one constant speed.** A 2px light crosses the deck's top rail every
6.4s and another crosses the proposal panel's own top rule every 4.8s, offset by 1.6s so the eye
always has exactly one thing to follow. Neither crosses a glyph, an input or a hit area at any
width, and neither ever holds still.

**Both of those are corrections, and both were the same complaint: it brakes and stops.**

*The rail parked.* It translated by `calc(100% + 190px)`, and a percentage in `translateX` is a
percentage of the ELEMENT — 190px wide — not of the 1242px track it was meant to cross. So the
light travelled 380px and stopped dead in the middle of the deck for the rest of the cycle;
sampled frame by frame, its brightest point sat at x=617 for seven consecutive samples. The
element is now the full width of the track and the BACKGROUND travels, where `100%` means "the
track minus the image": the light enters off one end and leaves off the other. It now reaches
x=1234 of 1242 and is found at **11 distinct positions across 14 frames**. There is no rest phase
at all — a light that holds still halfway is not resting, it is broken.

*The ring braked.* It was a conic gradient rotating behind a 1px masked frame, and a conic
gradient turns at constant ANGULAR speed. On a rectangle that is not constant perimeter speed: on
this 477 x 564 panel the light moved about 55% faster past the corners than along the middle of a
side. Constant speed is the whole difference between a light and a glitch, so the ring was
replaced with the same straight track the deck has.

**And a third loop was built and removed the same day.** A wide soft band sweeping the deck reads
as light over near-black and as a STAIN over a surface with its own value — in a still it left
the left half of the panel visibly dirtier than the right. Motion on a lit surface belongs on its
edges.

The first version of this put its loops in a 1px line along the top of a 1900px box and in a glow
breathing behind a panel, and the honest outcome was that the owner looked at the section and
reported seeing no animation at all. He was right, and it is measurable: a burst of frames diffed
pixel by pixel showed **0.02%** of the box changing between them — the blinking cursor. The
current build measures **15.4%** of the panel changing (the ring) and **10.4%** of the box (the
band). Restraint tuned past the point of visibility is not restraint, it is absence.

They do **not** pause on focus, and that is deliberate too. A version that stopped every loop the
moment anything inside the box was focused meant that anyone who clicked a chip in the first
second saw one second of motion and a dead panel for the rest of the visit. Motion that stops the
instant you engage with it is motion nobody ever sees.

**The selected chip is a lit key, and it took two wrong answers to get there.** It began as
`--txt`, near-white, which put it at **38× the luminance of the deck** and made it the loudest
object in the section after the CTA. The fix was worse: the deck's fill carried 26% toward
`--red-lift` — and mixing a warm accent INTO a blue-grey is how you get mud, a maroon-plum that
belonged to no palette on this site. So the fill does not move at all now. The chip stays the slot
it already is and the accent lives on the EDGE: a full-strength border at 6.24:1, the 2px bar
beneath, a short outer glow, and the label at 18.36:1. Nothing is mixed, so nothing muddies.

**Two traps, both paid for.** `@property --ring-angle` must be registered at the DOCUMENT level: a
custom property that is not registered interpolates as a string and simply jumps at the end of the
cycle. The first version declared it inside the `:root` block, where an at-rule is invalid,
Lightning CSS dropped it silently, and the pixel diff showed seven identical frames followed by
one that changed — which is exactly what an un-interpolated angle looks like. And `docker compose
up -d --build` **leaves the previous container running when the build fails**: a CSS parse error
meant three rounds of "verification" were run against a stale image. Check that the build
succeeded, not that the container started.

**The price is the hero, and it is still the owner's number.** It is sized like the payoff it is
(`clamp(34px, 4.6vw, 52px)`, `tabular-nums`), and nothing counts it up or animates it into being.
What is new is that when it GENUINELY changes the panel marks it once: the component compares the
rendered STRING, so a re-render or re-picking the same chip fires nothing. The flash alternates
between two identical keyframes under two names — a CSS animation only restarts when its name
changes, and the alternative, remounting the panel, would take the contact form with it and throw
away whatever the visitor had already typed. Verified in a browser: the price went 150 € → 450 €,
the panel flashed, and the text already typed into the name field was still there.

**Forced colours** leaves the form untouched: the chrome's background images come off, the glow
is hidden (flattened it would read as a second border), and selection is an inset outline rather
than a fill — `Highlight`/`HighlightText` on TEXT makes the chip's label vanish, because Chromium
paints a `Canvas` backplate behind text and `HighlightText` is black in the dark forced scheme.

- **Contact form:** name, email, phone, message + submit. It **does** submit —
  `POST /api/contact`, validated client-side by `lib/validation.ts` and authoritatively by
  the backend, then pushed to the Telegram lead bot
  ([13 — Telegram Bot](./13-telegram.md)).

## Footer

The card the page ends on (`<footer id="contact">` since 2026-10-09: `/#contact` and the rail's
"Contact" land here now that BottomCTA, which held the id, is gone; `scroll-margin-top` keeps the
jump clear of the sticky header), in **three tracks**: the brand (the mark, one line of copy,
**"Cere ofertă ↗"** — the catalog's `footer.cta` (the site's one direct CTA since 2026-10-28), an outline button 44px tall that opens the
request dialog, `source: "footer"`, 2026-10-09 — the social buttons — note that all three seeded
socials ship with an empty url, so until the owner pastes them in the admin that row is the one
hardcoded email button — and the contacts), then **NAVIGARE**
(5 links relabelled through the catalog: four sections of Home as `/#section` through
`SiteLink`, so they work from a service page too, and `#parteneri`) with **PARTENERII NOȘTRI DE
AFACERI** stacked under it (`#parteneri` is the header menu's jump target — there is no homepage
partners section), then **PORTOFOLIU** on its own: one link, **"Toate proiectele →"** to
[`/portofoliu`](#portfolio--portofoliu) (2026-10-03 — it used to list every project in the store,
a row per project, and grew with each one the admin added). Then a mono meta line —
copyright and the two legal links — and the giant `TBS DIGITAL` wordmark cropped by the bottom
edge.

The stack and the contacts are both about the same hole. The columns ran 5, 10 and 3 rows deep and
a grid row is as tall as its tallest item, so the two-column phone reflow opened ~220px of dead
space under NAVIGARE and left a whole cell empty under PARTENERI; stacking the short two against
the tall one makes it 8 against 10. The contacts moved up out of the meta row for the same reason
— the brand column was empty below the social buttons, and an address at 12px in the bottom bar was
the least legible thing in the footer.

**The meta row keeps the assistant's corner clear.** She is fixed bottom-right and the footer is
the end of the page, so it is always read with her on top of it: measured at 1440×900 the row's
last link sat entirely inside her box and could not be clicked. The reserve comes from
`--hud-bottom`, the token that already states where she ends.

**It lights once, when the visitor reaches it** (2026-09-27). `data-armed` goes on at mount — so
a visitor whose JavaScript never arrives sees a finished footer, not one waiting for a signal —
and a one-shot observer latches `data-entered` at a third on screen. The thread on the top edge
draws out from the middle (520ms), the three column heads come up in sequence (120/240/360ms),
and at 520ms colour climbs up through the wordmark.

That last one is the piece worth knowing: the mark is drawn **twice** — a dim copy that holds the
height, and a full-colour copy inside a clipped window that climbs out of the bottom edge while
the copy inside it climbs the exact opposite amount. The two cancel, so the letters never move a
pixel; what travels is the clip rectangle. Two composited transforms and no repaint. The window
and the copy share one duration and one delay, written once, because any difference between them
shows as the letters sliding.

The gradient is `--blue → --violet2 → --cyan`, and it is not a new one: those are
`[data-progress]`'s stops, the bar that fills across the top of the page as you scroll. The page
opens on that gradient and closes on it. It used to start and end on `--line`, the interface
hairline colour, so both ends of the biggest thing on the page faded into the panel; and `.word`
was a full-viewport block, which meant `background-clip: text` mapped the gradient to that box
rather than to the letters and the mark sampled a different part of it at every width. The box is
now the glyph run.

**One thing repeats**: a narrow band of light crossing the top edge, the chip's packet in the only
vocabulary a plain DOM footer has. One element, one transform, no paint, 82% of its cycle spent off
the right end, and it starts only once the arrival has finished. It is paused under `data-offscreen`
(`useOffscreenAttribute`, [07](./07-conventions.md#the-rest)) — the footer is at the bottom of an
8900px page, so without that it would run unseen for nearly the whole visit.

**The two radial glows are gone.** They hung off the card's corners, positioned partly outside it,
and the card is `overflow: hidden` — which is what crops the wordmark — so each was sliced off by
the rounded edge and read as a hard-edged blue and red smear rather than as light.

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
- **It shows at once** when no consent is stored, on every page (since 2026-10-28 there is no
  intro to wait for). A held key's auto-repeats are never an answer. The buttons work at once.

## Asistent TBS (the corner assistant)

IT-OS Phase 4 (2026-09-17), and since 2026-09-24 a **holographic projection of a person** in the
bottom-right corner of every site page, once the visitor has done something: she breathes, blinks,
and, when she is pressed, opens a short list of written questions she answers, with one button that
opens the request flow. She is the size of her square and is never drawn larger. Code: `components/hud/guide/*`, mounted by
`components/hud/HudChrome.tsx`
([03](./03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17)); look:
[04](./04-design-system.md#asistent-tbs--the-corner-assistant).

**The GUIDE inside her was removed on 2026-09-26 at the owner's request.** That was the part that
spoke first: a tip that appeared after 5s of lingering on a section (`#servicii`, `#lucrari`, a
service page's steps), with "Deschide ghidul" and "Nu mai arăta" under it. Gone with it:
`lib/hud/linger.ts` and its limits, the centre-line observer and its topic scanning
(`[data-guide-topic]`, which the service pages no longer carry), the `prompts` copy and the
`guide-prompt` CTA source.

**The GREETING went the same day**, on the second look: "Bună! Am pregătit câteva răspunsuri
scrise." — one sentence in a bubble the moment her entrance finished, which is the panel the owner
photographed and asked to be rid of. Gone with it: `GUIDE_COPY.hello`, `GUIDE_COPY.dismiss` (that
bubble's close label) and the bubble's speech mode with its tail. **Nothing here opens a panel the
visitor did not ask for.** Her mouth moves while she says an answer, which is all `data-say` means
now — on every screen since 2026-10-07 (until then only from 641px) — and the answer itself stays
until it is closed.

Since 2026-10-08 the mouth says the answer's own text:
- it opens on its vowels, shuts the lips on its *p*, *b* and *m*, and rests at its commas;
- it stops when the text does, never later than 7 s. A longer answer stops at a comma or full
  stop in its last stretch before that, or else after its last whole word;
- then it settles shut. The one-line answer takes about 3 s instead of 7;
- **interrupted** — another question, ✕, Escape, a language switch — it closes from wherever it
  is over 0.15 s instead of in one frame, and a new answer starts from there.

Under reduced motion it does not move, and `data-say` still lasts as long as the text. The frames
are her own face, warped, not windows over it. Her face shows once the portrait and her shut frame
have both decoded, fading in over 0.25 s; her beam and rings show meanwhile. An answer that starts
before all her other frames are in is said with her mouth at rest (look:
[04](./04-design-system.md#asistent-tbs--the-corner-assistant)).

**And the ENTRANCE went on the third look** — *"fa sa nu apara mare, scoate, lasa doar asistentul
cel mic in patrat."* She used to build herself over the corner of the page at three times her
launcher for 3.4 s before settling into it (the projector, the sixteen bands, the scanner, the
lock-on, the shockwave). She now simply fades in where she stands, in 0.4 s, at her own size.
Gone with it: the `Projector` component and its sixteen slices, the `greeting` and `entering`
state, the frame loop that waited for nothing to be covering her, `data-greet`, `data-state`, the
`guide-greeting` test hook, and nine keyframes. Look:
[04](./04-design-system.md#asistent-tbs--the-corner-assistant).

What she still is: a real button named "Asistent TBS: deschide întrebările frecvente" (the name
starts with the visible caption, WCAG 2.5.3), 184×184 from 861px and 136 / 104 / 68 below it — she
is drawn inside each, at 106 / 78 / 60 / 38px (two of those fixed 2026-10-07: see 04) — at
`--z-guide` (112), with away (over `#estimare`'s request form) and yield (focus under her) both by
opacity, never `display: none`. She is the reason the rail stops at `--hud-bottom` 208 from 861px.
Her prewritten answers use the same MVP-first language as the page: an idea, bottleneck or
opportunity becomes a testable first version; real signals decide what is developed next. They
still show only the admin-controlled starting price, never a hard-coded figure or a delivery date.

## The fibre rail

IT-OS Phase 5 (2026-09-17). A **neon fibre-optic line on the right edge** of every site page, at
**861px and wider**, next to the browser's own scrollbar — which stays the scrollbar (the client's
decision: the native scroll is kept). It shows how far down the page the visitor is and where the
page's sections are, and it jumps to one. Code: `components/hud/rail/*`, `lib/hud/rail.ts`,
mounted by `components/hud/HudChrome.tsx`
([03](./03-architecture.md#the-rails-wiring-it-os-phase-5-2026-09-17)); look:
[04](./04-design-system.md#the-fibre-rail).

**When it is there.** Nothing renders or downloads until the cookie question is
answered, the visitor has interacted and the browser has an idle slot — and
then only while the window is at least 861px wide. Narrowing the window below 861px removes it;
widening brings it back. `localStorage.tbs_hud = "off"` switches it off with the rest of the HUD.

**What it shows.** A faint core line from under the header (16px below it) down to `--hud-bottom`
— 112px above the page's foot. A lit thread fills it with the scroll progress (top of the page →
empty, bottom → full), with a glowing head at its end and a short light streak that travels along
it **only while the page is scrolling**. One **diamond tick per section** sits where the thread
ends when that section is scrolled to (kept at least 44px apart): hollow ahead, lit once passed,
and it pulses once when a downward scroll passes it.

**The sections** (a real `<nav>` named **"Secțiunile paginii" / "Разделы страницы" / "Page
sections"**, one 44×44 button per tick; the label shows beside it on hover and keyboard focus):

| Page | Markers |
|------|---------|
| Home (`/`, `/ru`, `/en`) | **Început** (`#top`) · **Servicii** (`#servicii`, `nav.services`) · **Lucrări** (`#lucrari`, `nav.work`) · **Despre** (`#despre`, `nav.about`) · **Echipă** (`#echipa`, `nav.team`) · **Cerere** (`#estimare`) · **Contact** (`#contact`, the footer since 2026-10-09) — the header's own catalog words where the menu has them, `RAIL_COPY` for the other three |
| A service page | one per `section` named by its first `h1`/`h2`: 3 to 5 today (e.g. `/servicii/produs-digital`: "Produs digital", "Proiecte relevante", "Cum lucrăm", "Ai un proiect în minte?"; `/servicii/e-commerce` has 3) |
| `/cookies` | its 7 numbered headings ("01 Ce sunt cookie-urile" …) |
| `/confidentialitate` | 14 sections: **more than 8, so the fibre and ticks only, no `<nav>`** (a list of buttons that long is not a shortcut) |

Headings inside the header, the footer, a dialog, an `aria-hidden` subtree or the rail itself
never name a section, nor does a section holding more than one `h2` (a list of items). A label is
the heading's text, whitespace collapsed, at most 60 characters. The home list is used only when
all seven ids are on the page; a client navigation re-reads the sections.

**A marker jumps.** Clicking one scrolls its section to just under the header — smoothly, or
instantly under reduced motion — and that marker becomes the current one (`aria-current="true"`,
a short lit streak beside it). The current marker is the last section the scroll has reached.

**Keyboard.** The buttons are real tab stops, **after the footer** in the
tab order, so the header's tab budget holds.
**Enter or Space** jumps like a click and also **moves focus to the section** (a temporary
`tabindex="-1"`, removed when focus leaves it), so the next Tab continues inside that section. A
mouse click never moves focus. Every button shows a 2px focus ring and its label.

**It stays out of the way.** The column takes no pointer events except its 44×44 buttons. The
fibre and the markers are inset by **half a marker (22px)** at both ends of the column, so every
44×44 button stays inside it — clear of the header above and of the foot below. It sits under
the burger menu and the request dialog (z 104). While the dialog or the burger
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

## No kicker lines (2026-09-25)

The site used to put a small red mono line above nearly every heading — the hero's
`TBS DIGITAL / WEB · SOFTWARE · AI`, Directions' "Alege direcția potrivită", Work's "Portofoliu
TBS", "De ce TBS", "Echipa", "Cerere / estimare", a service page's own tagline and its section
kicker, "BENEFICIU" on each of the three benefit panels, "ECHIPA TBS" on each person card, "PROIECT
REAL DIN PORTOFOLIU" on the case card and its flow card's label. **They are all gone, at the
owner's request**, together with the copy that fed them (`SECTION.eyebrow` in five sections,
`Solution.eyebrow` and `Solution.cardLabel`, `solUI.benefit`, the Directions `tag` field, `CASE.ref`
/ `CASE.none`, the `dir.section.kicker` message key and the `Modal` component's unused `eyebrow`
prop).

What was kept is what carries information rather than ceremony: a project card's own tag chips
(admin-editable, different per project), the numbered group labels in the estimator
(`01 · TIP DE PROIECT`), the principles cards' `01 / PRODUS`, and every ghost index (`01`, `02`,
`03`). Nothing was replaced: a heading now starts the block.

## Portfolio — `/portofoliu`

`app/(site)/portofoliu/page.tsx` → `components/sections/Portfolio.tsx` + `Portfolio.module.css`
(2026-10-03; its present form 2026-10-05). The whole portfolio on its own page, so the footer
could stop listing it; the owner's idea: **one pixel is one project**.

**The format (2026-10-05).** The first form scattered every project over a bare field as a 3px
point of light that opened into a card under the pointer. The owner found it unintuitive ("mie
îmi pare parcă nu este intuitiv, hai să schimbăm formatul"). Of four working prototypes — tiles, a
screen, a list beside a screen, cards — he chose **the screen**: one project at a time on a big
monitor, and under it **one pixel per project with its name written under it**; the pixels are
the navigation. Nothing waits behind a hover any more: the picture, the name, the words and both
actions are on the first screen, and the first project is there from the server on.

- **The heading:** the `<h1>` "Portofoliu" (a direction page's h1 type) and the **service filter**
  under it. A `<div>`, not a `<header>`: the scroll rail skips every heading inside a header, and
  the h1 is what names this section's marker.
- **Service filter** — a `role="group"` of mono channels (12.5px): `TOATE · 9`, then one per
  direction with live projects, in the menu's order, **named in plain words** for a visitor who
  never heard of an API or a UI — "Aplicații și platforme", "Programe interne", "Boturi și chat",
  "Site-uri și design" (`CHANNEL_LABEL` in `Portfolio.tsx`, ru/en too). Only here: Home's pills,
  the menu and the service pages keep the official names (`directionTab` in `lib/solutions.ts`),
  and the close's "Deschide serviciul: …" link joins the two. Counts come from
  `projectsForSolution()` — the curated `solutionProjectIds`, never the free-text tag. E-commerce
  has no project, so no channel. A channel (`aria-pressed`, cyan when pressed) **narrows the
  pixels and the counter** to its projects: the pixels that stay glide to their new places
  (280ms), the ones that leave fade where they stood (copies in `.ghosts`, `inert` and
  `aria-hidden`, gone in 180ms), the ones that come back switch on. The project on the screen
  stays when it is one of the channel's; otherwise the channel's first (reference) project comes
  on. A screen reader hears "Boturi și chat: 2 proiecte. BizCheck, proiectul 1 din 2". The channel
  starts as "all" on the server and the client and is **never on the URL**: the estimator reads
  `?serviciu=` on every page and would preselect a type for every CTA. At 640px and below the
  channels are one 44px band that scrolls inside itself, bleeding by exactly `--gutter`.
- **The screen** — a monitor ([04](./04-design-system.md#the-portfolios-controls)): a thin bezel,
  a chin with the brand's three subpixels, and a glow in the current project's colour that glides
  to the next one's. **It shows the project's whole site, and the site scrolls inside it**
  (2026-10-06: "fă ca în fereastra aceasta să fie site-ul și se poate da scroll la fiecare
  proiect"): `fullPage`, a capture of the site from top to bottom, 1080px wide, at the screen's
  width — the wheel or a trackpad over it, a finger dragging up and down, or ↑ ↓ / Page Up / Page
  Down / Home / End while the picture has the focus scroll it, and the page takes over at either
  end; a thin scrollbar in the project's colour says how far down it is. "Derulează site-ul",
  bottom left, says it scrolls and goes once it has been scrolled (it comes back at the top).
  Once a page load (remembered in memory — nothing is stored for it) the first site shown glides
  down half a screen and back, ~1.4s after it comes on, to show it scrolls; a wheel, a press or a
  key on the screen stops it at once. A capture with nothing to scroll gets neither the glide nor
  the hint. Another project starts at its own top — only another project or picture: the same
  project arriving again as a new object (the content store re-reading its cache, the API or
  another tab) leaves a visitor where they scrolled. A project without a capture shows its
  screenshot (`images[0]`) covering the 16:10 screen from its top, and nothing scrolls; a capture
  that fails to load — even before the page woke up — gives way to that screenshot, and the page
  remembers every one that failed. Both are resolved with `mediaUrl()`, so an uploaded capture
  (`/api/uploads/…`) shows in development too, where the API has its own port.
  `fetchpriority="high"` either way.
  - **Why a capture, not the live site.** An `<iframe>` of the project's own site was measured
    first and turned down: three of the four public sites refuse to be framed by another site
    (bizcheck.md and cgam.md send `frame-ancestors 'self' https://*.facebook.com …`,
    balloonsbreeze.md `X-Frame-Options: SAMEORIGIN`), and the refusal cannot even be detected from
    script; five projects have no public page; bizcheck.md and cgam.md contact Meta and Google as
    soon as they load, before our cookie banner is answered (against docs/16 §4); in a 540px
    screen a live site renders its phone layout; and on a phone the frame would take over every
    vertical swipe. A capture is ours, light (170–500 KB), private, and the same on every device —
    but it is a snapshot: a site that changes needs a new one (the admin uploads it, [09](./09-admin.md)).
  - **Where the captures come from.** The four public sites were captured on 2026-10-06 in their
    Romanian version (1440×900 desktop, cookie banners dismissed, floating buttons hidden,
    slideshows at rest, the fixed backgrounds of cgam and balloonsbreeze laid under the whole
    page), as `public/projects/{bizcheck,itara,cgam,balloons-breeze}-site.webp`, seeded in
    `lib/content.ts` / `defaults.py` and written once into an existing database by the boot that
    adds the column ([10](./10-backend.md)). DocuSafe, Crowe Portal, IQ Arena, Statistic and FLIRT
    have no public page: they keep their screenshot until a capture made with demo data is
    uploaded — never one showing a real person's e-mail.
  - **Every window answers: an interactive demo** (2026-10-06, the owner: "la toate ferestrele să
    fie posibilitatea de interacțiune … să putem apăsa butoane dar să nu putem folosi pe deplin,
    să se ceară să trecem deja după link la site"). Each project's `demo` names a manifest,
    `public/projects/demo/<id>/demo.json` (`lib/siteDemo.ts` is its contract and its strict reader):
    a few pages of the site, each a capture with the **real links and buttons recorded over it as
    rectangles** in the same layout pass (`tools/site-demo/`, which blocks the page's own writes
    while it probes what a control does, and blurs what the pictures may not show — see Privacy).
    The screen becomes a small browser:
    - **A thin bar** at its top (`DemoBar`): Back, the page's address on the real site
      ("cgam.md/arena"; a private system says "IQ Arena · sistem privat") — with more than one
      page it is a button listing them — and, in the screen, a light along its foot while the next
      page comes in. A press beside the open list closes it and presses nothing.
    - **The page's links and buttons light under the pointer.** A link to another page of the
      demo switches to it (the screen crossfades from the old page, the new one lands at its top
      or at the link's target), an in-page link scrolls, a fixed header stays pinned at the top as
      on the real site, a long page cut short ends in "Restul paginii, pe {site} ↗". A jump lands
      where the live site's view lands — the tool records that, the site's own header offset in —
      so the pinned band covers just what the live header covers (it used to take the header off a
      second time: 65–90px too high). The pinned band takes the presses it covers: between its
      links the screen's opens the larger view, as the picture does — a control scrolled under it
      is never pressed unseen. While a page comes in, its links wait for its picture.
    - **What only the real site can do** — a form, a login, a search, a chat, a gallery, a
      language switch, a page outside the demo — **opens a sheet** inside the screen: "„{button}”
      merge pe site-ul adevărat. Aici poți răsfoi paginile principale; restul funcționează pe
      {site}." with **"Deschide {site} ↗"** (that very page, in the same tab, like the project's
      own link) and "Rămân aici". A private system's sheet says "{name} e un sistem privat — lucrează
      cu datele unui client…" and offers **"Vreau un proiect similar"** (the request, with the
      project attached; never over the larger view). A modified click on a link (a new tab) opens
      the real page directly. Links only ever lead to the project's own site.
    - **What each demo holds:** BizCheck — home, the test, the privacy page; CGAM — home, IQ Arena,
      the league, an event, login, sign-up; Itara Global and Balloons Breeze — one long page whose
      menu jumps between its sections; IQ Arena — its four app screens as a flow (sign in → round
      table → jury sheet → winner); DocuSafe, Crowe Portal, Statistic and FLIRT — their one screen,
      every control on it answering with the private system's sheet.
    - **Who presses what.** A mouse or trackpad presses the small screen's links directly. A finger
      does on a phone-sized shot — the public sites' pages are captured at 390px too and shown on
      phones (a desktop capture's links are ~10px wide there); elsewhere a tap opens the larger
      view, where every link answers anyone — a private system's on a phone too, each target 24px at
      least. **The larger view is the same demo** at up to 1080px, same page, same place: every link
      and button there is a real stop for the keyboard, named by its own text, in reading order —
      row by row, so a header's logo, links and button go left to right although they sit a few px
      apart in height (`readingOrder`, which keeps a button that sits on a card after the card); the
      small screen's ones are a pointer's shortcut (`aria-hidden`, out of the tab order) — the
      keyboard has the bar, the picture and the larger view. Closing the larger view leaves the
      screen on the page and at the place the visitor was. Escape closes the sheet, then the page
      list, then the dialog.
    - **Where the focus goes.** A page opened from the larger view comes on as a page loads: the
      focus at its top (its scrolling window, a group named "{title} — {address}"), since the link
      that was pressed went with its page. A jump to a point of a page — an in-page link, a link
      with a target — puts the focus on a **mark** where it landed (a cyan line across the page
      while it has the focus, the link's words for a screen reader), among the links in reading
      order: Tab goes on from the section it jumped to, not from the top. A focused link is never
      under the pinned band: it is drawn over it, and brought into view below it (`scroll-margin`
      of the band's height, `--band` × the page's width in container units). Back keeps its focus
      even at the first page (`aria-disabled`, not `disabled`, which would drop it to the body). A
      page chosen from the list, or Escape in it, puts the focus back on the address that opened
      it. The sheet closes onto what opened it: the link in the larger view, the picture in the
      screen; and when the focus goes on past the sheet or the list (Tab, a press elsewhere), they
      close and the focus stays where it went. A sheet left open on a project is gone when the
      visitor comes back to it: another project, or the same one again, starts at its start page.
    - **What a screen reader hears.** A page change is said in the stage's live region —
      and, while the larger view is open, in its own (a modal dialog hides the page behind it): the
      page's title and address. The sheet is described by its text as well as named by its title;
      a link's name, and the button's words in the sheet's title, carry the site's language
      (`lang`), the group's name ours.
    - **On a phone** the arrows sit on the screen's edges: while the sheet or the page list is
      open they step aside, off its words. A cut page's last line ("Restul paginii…") ends above the
      "Vezi mai mare" chip, which a phone's width would otherwise put over it.
    - **Kept honest.** The manifest is checked before anything is drawn from it (ids, numbers,
      plain-text labels, site paths; a broken one is ignored). If the admin replaces a project's
      capture, the screen shows the new one without the start page's hotspots (they were measured
      on the old) until the demo is regenerated with `tools/site-demo` — a capture and its hotspots
      are always made together. No third-party request, no storage, no CSP change
      ([11](./11-security.md)).
    - **Privacy.** Before any of this, the private screenshots were cleaned (2026-10-06): the
      e-mail addresses on DocuSafe, Statistic, FLIRT and IQ Arena replaced with `demo@example.com`
      (FLIRT's "this e-mail is already used" line removed with it) and a real person's photo on
      Crowe Portal replaced with initials. The public sites' pictures show what the live pages
      show, so the capture blurs what is not ours to republish (`redact` in `tools/site-demo`):
      CGAM's league players — the podium on its home and IQ Arena pages, all 62 names of the league
      table — and its event photo (the participants' faces), and the address in its IQ Arena mockup
      becomes `demo@example.com`. Reviews the sites publish as such keep their authors' names.
  - **The whole picture is a button**, "Vezi mai mare tot site-ul BizCheck" (a screenshot's: "Vezi
    mai mare captura de ecran: BizCheck"): it opens the picture larger in the site's dialog
    (`Modal`, `ground="ink"`, `restoreFocusRef` back to the picture; open only while there is a
    picture, and closed by any change of project). A whole site comes at its own width (1080px,
    where its words can be read) and scrolls in the dialog, **opened at the same place the screen
    was scrolled to**; a screenshot comes whole, as wide as the window allows. The names start
    with the chip's own words in every language ("View larger: the whole BizCheck site"), so a
    voice saying them finds it. A project with no picture at all shows its name on the screen in
    its colours, and nothing opens.
- **Changing project:** ‹ › beside the screen (on its edges at 640px and below); ← → anywhere on
  the stage (repeats ignored, modified keys left to the browser; a pixel with the focus hands it
  to its neighbour, so the keys walk the row); a sideways **swipe** on the screen, by a finger or a
  pen — 40px, and 1.3× more sideways than down; the click a browser may send after it (within
  400ms) is dropped. `touch-action: pan-y pinch-zoom` is set on the screen and again on its
  scrolling window (inside a scroller only the scroller's own counts): up and down scroll the site
  (then the page), sideways is ours. Or a press on a pixel. Round the list both ways. The live
  region (`aria-live="polite"`) says "Itara Global, proiectul 2 din 9".
- **The pixel transition** (~350ms, up to about half a second while the board's pulse runs;
  `breakScreen`): the picture on the screen now is painted on a
  canvas over it, the `<img>` changes underneath, and the canvas breaks into a 16 × 10 grid of
  blocks in shades of the NEW project's two colours over the black matrix (`--void`), sweeping from
  the side it comes in; once the new picture has decoded — and, for another project of the page on
  show, once the board's pulse has reached the chin (below) — no sooner than 170ms and no later
  than 1.5s, the blocks go out the same way. A scrolled site is painted as the screen shows it —
  the band of it in view, beside its scrollbar. The picture is decoded for that canvas ahead of
  time (2026-10-07): a second after it has decoded, at idle, it is painted once into the hidden
  canvas, so the switch away from it finds it decoded instead of decoding it in the click's task
  (40–65ms measured on the screenshots). Not over 8 megapixels, not under reduced motion, and a
  switch sooner than that simply decodes as before. The project's words rise in (6px, 260ms). None of it under
  reduced motion, nor without a loaded picture to break up. Once the page goes idle it fetches the
  screen pictures (the capture, else the screenshot) of the projects on either side of the one on
  the screen (where the arrows go), and a pixel pointed at or focused fetches its own — never a
  whole portfolio's worth of pictures at once (with 100 projects the first screen asks for 3, not
  100). The pixels of the page on show bring small pictures of their own (below), a few kilobytes
  each.
- **The pixels** — one labelled button per project, in the page's own order (a channel never
  reshuffles them), each a **small square showing the project** — the top left of what the screen
  shows for it, its site's capture or else its screenshot, where a site keeps its logo — framed in
  the project's colour, on a
  **circuit board** whose traces run up into the monitor's chin, its name under it. (2026-10-05:
  the owner sent the old selected pixel — a black square of red, green and blue bars in a white
  ring, inside a tinted box — with "schimbă ăsta, fă ceva mai frumos"; of five directions built on
  a bench copy of the page and scored by judges, the owner chose "Lumina", LED squares. That
  evening — "înlocuiește aceste pătrățele cu altceva mai frumos", "ceva mai wow" — of seven
  designs, the refined five and two bolder ones, the owner chose **"Circuitul"**, round pads of the
  project's colour. 2026-10-08, of those pads: "in loc de pastile pune niste patrate mici unde se
  vede fiecare proiect".) Off, the picture a quarter dimmed, so the one on the screen stands out;
  a project with no picture is a square of its colour. The project on the screen
  (`aria-current="true"`) is the pad switched on — larger, undimmed, glowing — and **its route is
  lit in its colour all the way into the chin**, so the board always shows which project is wired
  to the screen; its name white and bold; no box and no ring around it
  ([04](./04-design-system.md#the-portfolios-controls)). Hover and keyboard focus only whiten the
  name, undim the picture and step the square up — never light it; a channel's fading copies are
  never the lit one.
  - **The squares' pictures are small.** A picture of the site's own, right under `/projects/`,
    comes through Next's image optimiser (`pixelPicture` in `Portfolio.tsx`, `getImageProps`):
    asked for 128px across for a screenshot (a landscape screenshot fills the square's height at
    about 64px across, and a 1.5× screen needs more) and 64px for a site's capture (taller than
    wide), twice that on a high-density screen (`srcset` 1x / 2x), in WebP. The nine come to
    46.7 KB there and 19.6 KB on a 1× screen, where the files they are made from weigh 2 MB.
    - **Uploads.** An uploaded picture (`/api/uploads/…`, on the API's origin) does not pass
      through the optimiser and is loaded as it is. For an uploaded project the square therefore
      shows its screenshot (uploads are at most 1600px wide), never its capture: that is the whole
      site, up to 1080 × 12000px, for a 26px square.
    - **Failures.** A capture the screen could not load is passed over, as the screen passes it
      over. A square whose optimised picture fails loads the project's screenshot file instead.
      That holds even when it failed before the page woke up: the server's HTML already asks for
      the pictures, and a check on mount catches what React's `onError` missed. Checked with every
      `/_next/image` request failed in the browser: all nine squares showed their screenshots. If
      that fails too, the square keeps its colour.
    - **What the optimiser takes** is pinned in `next.config.ts`
      ([11](./11-security.md#the-portfolios-pixels-through-the-image-optimiser-2026-10-08)).
  - **On a phone the squares are smaller**: a 26px place, 24px at rest and 26px lit or focused, and
    the lines 4px apart. A 32px lit square left the web's knots no room to clear its corners (see
    the web, below, and [04](./04-design-system.md#the-portfolios-controls)).
  - **Another project of the page on show plays the switch** — a pad pressed, the arrows, ← →, a
    swipe, a name from the search: the old pad goes out and its route dark, the new pad lights,
    and a **pulse of light** leaves it and runs its route into the chin, getting there 0.16s
    (the middle pad) to 0.34s (an end one) after the pick at 1366×768. The chin flashes as it
    arrives, and only then does the screen's transition let the new project through — timed from
    the frame the pulse really started on. About half a second from the pick to the screen
    settled, the farthest pad included (measured on a real GPU at 1366×768 and 1720×1300). A page
    turn or a channel's glide plays no pulse: the board goes while the pads move and comes back
    drawn where they stopped.
  - **The board** is one `aria-hidden` SVG laid over the row and drawn from the layout:
    `components/sections/portfolioCircuit.ts` measures the pads and the chin, draws, lights and plays;
    `lib/portfolioBoard.ts` routes, pure. Every pad's trace rises, bends 45° onto a bus, and the bus
    turns up in a Y into a trunk ending under the chin's subpixels. Measured again whenever the row
    or the monitor changes size, another page or channel comes, or the fonts arrive. A row with
    nothing right above it (the search used to stand there) gets no board.
  - **On a phone the board is a spider web** (2026-10-06, the owner: "pe telefon uneste te rog
    frumos linia cumva ca o pautina"). The nine wrap into five and four (four, four and one on the
    narrowest; a page of eight into five and three), and every line hangs on one web spun from the
    chin: the Y's arms go on as 45° **rays** into a tent over the pad under the chin, **spokes** run
    down the real gaps between the names, and at each lower line's height a **ring** sags from spoke
    to spoke, with knots where it meets them. A lower pad hangs from a knot (a page of nine) or sits
    in a sag (a page of eight) — the same ring either way, only where the pads hang changes — and its
    route is **one unbroken line** into the chin, so the lit route and the pulse run all the way up
    (before, a lower pad's trace dived into a square via and its light reappeared on the trunk; the
    owner saw them hanging loose). Every turn is 45°; a pad is only ever a route's end; nothing
    crosses a name: the page measures each name's text (`portfolioCircuit.ts`, a `Range` over it)
    and the web keeps its spokes in the gaps and its knots under the names. A pad the web cannot
    reach — names closing every gap above it, a row the page never makes — keeps the old via. A row
    of one line, the desktop's, is exactly as before. Chosen from three designs (a circuit
    lattice, this radial web, threads between neighbours) by two judges over the real measured
    rows of 320–430px phones, then refined: flat-bottomed sags (no sharp V at a ~60px pitch), lower
    knots over a pad right under its spoke, the hub's rays kept on a 430px phone. Since the pads
    became squares (2026-10-08) the web keeps its runs off each lit square itself, its corners
    included, not off a circle round its middle. A square's corner reaches √2 as far along the
    45° runs every knot is made of, and a review found the arms cutting 0.6–1.3px into a lit
    lower square on every phone. Now there is 2.8–3.6px of air at 360–430px and 0.6–2px at
    331–345px, measured on the page with each pad lit in turn.
  - **A hundred projects or more** never crowd the board: the row shows one page of at most nine
    (`lib/portfolioPages.ts`, balanced: 100 make twelve pages of eight or nine), with "Pagina 1 din
    12", a window of page dots, the previous and next pages, and the search by name — so the board
    only ever wires one page, and the web above is the same for every page.
  - The pads switch on as the page arrives, one after another along the row (dark, a white flash, a
    stutter, the square, in hard steps). One row as wide as the monitor and its arrows, never under
    640px so a name never breaks inside a word. Five to a row, with 44px arrows, wherever the
    column is too narrow for nine names (600px or less: side by side up to ~1120px, a narrow
    tablet, a phone) — a lone pixel on a second row looked lost; four to a row in a column under
    299px (a phone up to 330px). The column decides, not the window: `.left` is a size container
    and these are `@container` rules. Each button is 89px tall with a two-line name (78px on a
    phone, its lines 4px apart; 81 and 76px with the round pads, before 2026-10-08): the 12px over
    the pad hold its trace's neck, bend and bus. The first screen still holds the row: at 1366×768 it ends at 701px
    (650px of 720 at 1280×720).
- **The project's words** — beside the screen from 1000px, under it below and in a window taller
  than about 5:4 (`min-aspect-ratio: 4/5`: an iPad Pro held upright, 1024×1366, had a screen a
  third of its width beside them; under them it fills the width): "01 / 09", the name as
  it writes itself ("BizCheck", not the display face's capitals), the tag led by a square of its
  colour, the description and the actions. The description is 16px; a long one folds to 8 lines
  (4 on a phone and in a window under 821px tall) and **"Citește tot ↓"** unfolds it — the button
  shows only when something is folded away — measured, not guessed: again for another project,
  another language (a description that fits in Romanian can fold in Russian), another width (a
  `ResizeObserver`) and once the web font is in. Hidden, it keeps its row (`visibility`, and
  hidden in the server's HTML), and the description is at least four lines tall: neither the page
  waking nor a change of project moves the buttons under them. Then **"Vreau un proiect similar"**
  and "Deschide site-ul ↗" (or "nu are pagină publică", in plain case), plus App Store / Google
  Play when the project has them. The
  links open **in the same tab**: a new tab greyed out Back, and a visitor who closed it to return
  closed the whole window. When the project changes, a control that had the focus and is gone
  hands it on rather than dropping it to the top of the page: a link the next project has not, or
  a "Citește tot" it does not need, to the red button; the picture of a project without one, to
  the project's pixel (so ← → go on working). Without scrolling the page when that focus was not
  the keyboard's — a tap leaves the focus on a phone's button, and a swipe must not jump the page
  down to the red one.
- **"Vreau un proiect similar"** opens the request dialog with the project attached (`source:
  "project-card"`, `projectId`, `projectName`), the chosen channel as `serviceSlug`, and the
  estimator type of that kind of work (`projectRequestType` in `lib/solutions.ts`: the apps start
  on "Aplicație mobilă", the private systems on "CRM la comandă"; a project not listed starts where
  the dialog always does). The form says the project back to the visitor first thing: "Proiect
  ales ca exemplu: CGAM" (`Estimator.tsx`, shown whenever a request carries a `projectName`).
  Closing it puts the focus back on the button.
- **The first screen.** `--mon-w`, the monitor's widest, is worked out from the window's height —
  `(100svh − 429px) × 1.6 + 16px` with the words beside the screen, `− 443px` with them under it,
  never under 400 / 380px; 429 / 443px are everything else on that screen: the header, the title
  and the filter, the bezel and the chin, the pixels — so the screen, the pixels and the words fit
  the first screen of a laptop. A big portfolio (below) gives the screen up for its pages and its
  search: 539 / 553px, so at 1366×768 the pages end at 651px and the search under them at 707px
  (measured with 100 projects on 2026-10-08; 8px lower than with the round pads).
  At 1720×1300 the close is on the first screen too.
- **A big portfolio: pages and a search** (2026-10-05, "dar dacă așa să fie 100 de proiecte, cum
  procedăm?"). Measured with 100 projects, the row became a wall of 9 rows (904px) under the
  screen at 1366×768 — 20 on a phone — and the page fetched all 100 screenshots. Of four working
  prototypes (a scrolling strip, a matrix of nameless LEDs, pages, a search-first list) scored by
  three judges, the owner chose **the pages**:
  - The row shows **one page** of pixels — at most nine, the row of today on every width, so the
    nine projects of today look exactly as before — and always **the page of the project on the
    screen**, so its lit pixel is always in sight. Pages are **balanced** (`lib/portfolioPages.ts`):
    100 projects make twelve pages of eight or nine, never eleven of nine and one alone. Only the
    page's pixels are in the DOM.
  - Under the row, in words: **"‹ Pagina anterioară · Pagina 2 din 12 · Pagina următoare ›"**, and a
    small pixel for each page, the page on show lit in the project's colour (a pointer's shortcut,
    hidden from the keyboard and screen readers, who have the words; at most 13, a window round the
    page on show). A page button puts that page's first project on the screen. ← → and the screen's
    arrows turn the page by themselves when they step past its end; a pixel with the focus hands it
    to the next page's pixel. The live region adds "Pagina 3 din 12" when a step turned the page.
  - A page turn slides: the page on show leaves as a sheet of copies (never lit), the new one slides
    in from the side it comes from, without the switch-on of an arrival; the board goes at once and
    comes back drawn under the new page once it has stopped. Nothing slides under reduced motion.
    The row's window clips the slide sideways only (the board's trunk rises out of it), with room
    for the lit pad's glow; every page is as tall as a page of two-line names, so what is under it
    never jumps.
  - Under the row and its pages, **"Caută un proiect după nume"** (`PortfolioSearch.tsx`, a
    combobox) — above the row until the board came: between the screen and the row it would cut
    the traces. Capitals
    and diacritics do not matter; the list offers the names holding what was typed (the start of
    the name first, then a word or a seam — "Agro|Market" — then anywhere), then the projects whose
    kind of work holds it ("magazin" finds the shops), each led by a dot of its colour (the row's
    round pad until 2026-10-08) and followed by its kind
    or "pe ecran"; eight at most, "Mai sunt 5 — scrie mai multe litere din nume" for the rest, and
    "Nu am găsit niciun proiect cu „zzz”. Încearcă alt cuvânt sau alege un serviciu de mai sus."
    Nothing on the page changes until a name is chosen (a click, or Enter for the first): it comes
    on the screen, on its page, with the focus on its pixel; a project outside the chosen channel
    brings back "Toate" and says so. ↑ ↓ walk the list, Escape closes it, a second Escape empties the
    field; the count is said once the typing pauses. The list opens under the field or, where the
    window has more room there, over it — never under the sticky header. 44px tall, 16px text, so a
    phone does not zoom into it.
  - Both appear only in a portfolio bigger than one page (`.paged`); a channel with one page hides
    the pages and keeps the search.
- **The assistant's corner.** The corner assistant (184px from 861px, 20px from the edges) takes
  the window's bottom-right 204 × 204px. From 1000px the words' column is never narrower than
  400px, so the red button (227px) and the links, left-aligned in it, start at least 431px from the
  window's right edge and never reach her, at any height — checked on all nine projects at
  1000×700, 1024×768, 1100×768, 1200×800, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080 and
  1720×1300, and with the words under the screen at 768×1024, 820×1180, 834×1194, 912×1368,
  1024×1366 and 1200×1600. Where the words beside the screen can reach down to her (a window under
  970px tall) the link goes under the red button rather than beside it, where she stands.
- **Accessibility.** The stage is a region, "Proiectele noastre"; the pixels a group, "Alege
  proiectul"; the arrows "Proiectul anterior" / "Proiectul următor" (disabled with fewer than two
  projects). The project's name is the section's one `<h2>`, so the scroll rail still names the
  section by its h1, "Portofoliu", and the close gets the second marker, "Ai un proiect în minte?".
  Tab runs: the channels, ‹, (a demo's Back and its address,) the picture, ›, the pixels, (the
  two page buttons, the search,) "Citește tot", the request, the links. A demo's links and buttons
  are stops in the larger view, a group named "Linkurile din pagina {titlu}". With pages, the
  pixels' group is named with its page
  ("Alege proiectul, pagina 2 din 12"). The board and the chin's flash are pictures
  (`aria-hidden`): the live region already says which project came on. The site's scrolling
  window holds the picture's button, so the window is never a dead stop for the keyboard (axe's
  `scrollable-region-focusable`): with the button focused, ↑ ↓ / Page Up / Page Down / Home / End
  scroll the site, Enter or Space open it larger, ← → still change the project. "Derulează
  site-ul" is a picture of words (`aria-hidden`), like "Vezi mai mare".
- **The close** — after the section, the service pages' closing panel (corner brackets, the
  three-stop thread) with their approved words: "Ai un proiect în minte?" and "Începe cererea"
  (`source: "portfolio-bottom"`, carrying the chosen channel). While a channel is chosen it also
  links to that service's page ("Deschide serviciul: Produs digital →").
- **No grid behind it.** Every page sits on the body's faint 56px grid (`app/globals.css`); behind a
  page made of pixels it read as a matrix of its own ("pe fundal să nu se vadă matricea"). While the
  page is mounted the body keeps its wash and drops the grid layers (`:global(body):has(.page)`),
  and any other page gets them back.
- **Reduced motion:** no transition on the screen, no rise of the words, no switch-on, no pulse
  along the board and no flash in the chin (a pad is simply on or off, its route simply lit), no
  glide down and back of the site (it still scrolls, as the visitor scrolls it), no glide or fade
  in the filter, no page slide, the glow changes at once, and no thread is drawn across the close.
- **A project the admin adds** gets a pixel and its place on the screen at once, but belongs to no
  service until a developer writes its id into `solutionProjectIds` (and, if it is an app or a
  private system, `projectRequestType`): until then it shows under "Toate" only. With no project
  at all, the page shows the title and "Proiecte · 0". For a portfolio that grows past a few dozen
  this is the next thing to change: the services of a project belong in the admin, next to its
  name, not in code.

## Legal pages

`/confidentialitate` and `/cookies` — outside the landing scroll, same chrome, linked from
the footer and the consent banner.

## Admin panel

Built and live at `/admin-tbs-digital` — a login-gated, tabbed editor backed by the API.
See [09 — Admin Panel](./09-admin.md).
