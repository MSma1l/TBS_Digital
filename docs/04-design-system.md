# 04 — Design System

Keep these tokens as CSS variables in `globals.css` and reference them everywhere — do not
hardcode raw hex values in components.

> **`app/globals.css` is the source of truth.** The values below are a description of it, and
> a description can go stale — this section did exactly that once, documenting a dark palette
> for months after the site had gone light. If the two disagree, the CSS is right and this
> file is the bug.

## Colors

The site ships **two palettes, and dark is the default** (2026-09-16): a visitor who has not
chosen gets the dark HUD look, and light is an explicit choice — see [Dark theme](#dark-theme).
The tokens on `:root` below are the **light** values; the dark theme remaps them.

The light palette is a cool, airy scale where each surface step is a real elevation, so a card
reads as a distinct surface against the page. The hue leans very slightly blue, which is what
stops large white panels from looking grey next to `--bg`. Blue leads the accent range, which
is warm-inclusive — `--amber` is a rich gold and `--coral` is a warm ember.

```css
:root {
  /* surfaces */
  --bg:     #f4f7ff;
  --bg2:    #e9eefc;
  --panel:  #ffffff;
  --panel2: #f4f6fb;
  --wash:      rgba(219,227,255,.5);   /* the soft blue wash, top right of the page */
  --grid-line: rgba(16,23,42,.04);     /* the faint 56px page grid */

  /* scrim — stays near-black on purpose: it sits over bright partner/project
     screenshots and is what keeps white-on-transparent logos readable. It is NOT
     part of the light scale and must not be "lifted" to match it. */
  --scrim: 15, 12, 22;   /* raw rgb triplet, for rgba(var(--scrim), a) */

  --line:  #dbe3f1;
  --line2: #c5d0e4;

  --txt:   #10172a;   /* primary text */
  --mut:   #586784;   /* body text, and ALL small text */
  --dim:   #6b7891;   /* faintest tone — under AA on light surfaces, see below */

  /* FILLS — brand colours with --on-accent text on top */
  --red:   #ef263d;
  --blue:  #3970ff;
  --mint:  #05b99f;
  --star:  #ffbd2e;

  /* accents */
  --green:   #12a37a;
  --blue2:   #3f63d8;
  --ice:     #5566c9;
  --cyan:    #0e93b9;
  --violet:  #7a44e6;
  --violet2: #6a3fe0;  /* fill — white text sits on it */
  --amber:   #b3771a;  /* rich warm gold */
  --coral:   #e2603c;  /* warm ember — used in glows/gradients, not as text */

  /* text ON a saturated fill (--blue, --blue2, --violet2, --red). Named rather than
     written as #fff at each call site, so a dark theme can repoint it in one place. */
  --on-accent: #ffffff;
}
```

### Ink — the blocks that invert on purpose

A few areas are dark *by design* on this light page: the project card in the direction
selector, the dark panels in a direction page, the estimator summary. They were originally
written hex by hex, which is how the codebase ended up with four near-identical navies. They
now share one scale, so an inverted block is a decision rather than a colour someone picked.

```css
--ink:        #111a31;              /* inverted surface */
--ink2:       #162044;              /* inverted surface, one step up */
--on-ink:     #dbe5ff;              /* body text on ink */
--on-ink-mut: #aebee7;              /* muted text on ink */
--ink-line:   rgba(255,255,255,.12);
```

### The brand gradient

The red CTA gradient was the single most duplicated value in the codebase — pasted into six
modules — so it is a token now. `--red-lift` is only the lighter stop of that gradient; it is
**not** a standalone brand colour and must never be used as a flat fill.

```css
--red-lift:      #ff5362;
--grad-red:      linear-gradient(135deg, var(--red-lift), var(--red));
--sh-red:        0 10px 24px rgba(245,51,63,.3);
--sh-red-strong: 0 14px 30px rgba(245,51,63,.42);

/* the text-bearing twin: white measures 4.72:1 on #e0213a and 6.88:1 on #b50e22 */
--grad-red-cta:  linear-gradient(135deg, #e0213a, #b50e22);
```

**`--grad-red` is decoration, not a text background**: white on it measures **3.15:1** at the
`--red-lift` stop and 4.19:1 at `--red`, which fails AA for a small bold label. Every button
label on red (the neon CTAs of the header, the burger menu, the hero and the cookie banner's
"Accept") sits on `--grad-red-cta` instead — same hue family, deep enough that white clears AA
along the whole gradient.

## HUD layer — the first screen

The first screen (intro preloader, header, hero, ticker, cookie banner) adds a small token
family of its own, all in `app/globals.css`. It is built from the same palette — nothing here
is a second design system.

### Void

```css
--void: #0a0b10;   /* the preloader's backdrop, and the dark page colour (--dark-bg) */
```

**`--void` is never remapped.** The intro overlay is **always dark, in the light theme too** —
it is the one sanctioned exception to "follow the active theme". Its CSS Module uses only the
fixed tokens (`--void`, the `--dark-*` values, the brand fills), never the remapped `--bg` /
`--txt` pair, and sets `color-scheme: dark`. The 3D scene also reads `--void` at runtime, so it
must stay a hex value (see [07 — Conventions](./07-conventions.md#3d-gsap-and-the-interior-stage)).

### Glass

```css
/* light                                    dark twin (remapped)                  */
--glass-bg:       rgba(255,255,255,.72);  /* --dark-glass-bg:       rgba(24,30,48,.62) */
--glass-bg-text:  rgba(255,255,255,.90);  /* --dark-glass-bg-text:  rgba(24,30,48,.84) */
--glass-bg-solid: rgba(255,255,255,.94);  /* --dark-glass-bg-solid: rgba(24,30,48,.94) */
--glass-line:     rgba(16,23,42,.12);     /* --dark-glass-line:     rgba(246,247,251,.12) */
--glass-blur: 14px;                       /* 8px at ≤640px: blur cost scales with radius */
```

Tailwind exposes them as `glass`, `glass-text` (utilities: tint + `backdrop-filter`, with a
`@supports` fallback to the solid tint) and `bg-glass`, `bg-glass-solid`, `border-glass-line`.

**The glass contrast rule.** Text on glass is measured against the **worst pixel that can show
through** — the darkest under the light sheet, the brightest under the dark one — never against
the tint alone. That splits glass by what it carries:

| Token | Use it for | Measured |
|-------|------------|----------|
| `--glass-bg` | decorative glass over a backdrop **we** control: hero stat cards, the secondary hero CTA | light: `--mut` 5.59:1 over `--bg`, but only 3.09 over `--ink` and 2.86 over black. Dark: `--dark-mut` 8.97 over `--dark-bg`, but 2.36 over a white photo |
| `--glass-bg-text` | glass that carries small text over content we **don't** control: the sticky header over photos, its dropdowns over the headline | rendered worst case — dark over pure white: nav links / clock time 5.02, clock label (`--blue-text`) 4.64; light over black: links 4.56, clock label 4.90. The decorative "+" markers: 3.64 / 4.31 |
| `--glass-bg-solid` | where the blur is dropped (below 861px on the header and stat cards; the `@supports` fallback) | dark: `--dark-mut` 7.01, `--dark-blue-text` 6.54 over white |

Two more rules came out of rendering it:

- **Put an opaque base under glass that has no blur.** The burger overlay at 94% tint with no
  blur let the page's headlines ghost through; it now paints the page colour underneath.
- **No blur over something that animates, on phones.** A `backdrop-filter` over a running
  animation is re-sampled every frame. The header and stat cards drop the blur below 861px, and
  the cookie banner below 641px is an opaque `--panel` card with no blur at all (it sits over
  the hero floor grid and the ticker: measured 7.1 ms vs 4.4 ms of compositor time per frame).

### Neon and glows

```css
--glow-red:        rgba(239,38,61,.45);
--neon-red:        0 0 0 1px rgba(255,83,98,.5), 0 0 18px rgba(239,38,61,.45), 0 8px 24px rgba(239,38,61,.3);
--neon-red-strong: 0 0 0 1px rgba(255,83,98,.7), 0 0 26px rgba(239,38,61,.65), 0 0 60px rgba(239,38,61,.4), 0 14px 34px rgba(239,38,61,.42);
--neon-blue:       0 0 0 1px rgba(57,112,255,.45), 0 0 16px rgba(57,112,255,.35);

/* the hero's two key lights sit behind its copy, so they have their own tokens */
--hero-glow-red:  rgba(239,38,61,.08);    /* dark: var(--glow-red) */
--hero-glow-blue: rgba(47,107,239,.06);   /* dark: var(--glow) */
```

Neon is a stacked shadow (hairline ring + near glow + far glow) on a fill that reads as lit.
The `cta-neon` utility is the one red call to action: `--grad-red-cta` fill, `--neon-red`
glow, `--neon-red-strong` on hover, the lift through `translate` (so a GSAP entrance writing
`transform` on a wrapper never fights it).

- **Its focus ring is `--txt`, not the site's usual cyan.** The ring lands on the red glow on
  both sides, and cyan there measured 1.2–2.5:1 in the light theme. `--txt` renders at ≥6.4:1
  (light) and ≥6.75:1 (dark) against the gap and the glow around it.
- **It has a transparent 1px outline at rest**, invisible normally; forced colours (Windows
  High Contrast) drop the gradient and glow and paint that outline, so the button keeps a
  boundary.
- **The hero glows are much fainter in light** (`.08` / `.06` instead of the shared `.45` /
  `.22`): at full strength the lead dropped to 3.8–4.1:1. Now the lead measures ≥4.53:1 on
  every pixel behind it at 861 and 1280px, and ≥4.57 on 95% of the pixels at 390px (the rest,
  down to 4.07, sat on the 1px HUD grid lines). Dark keeps the full glows (lead ≥7.26). Since
  2026-09-17 the phone copy also sits on a scrim over the core (`--hero-scrim`, see
  [The interior stage](#hero-core-tokens-phones)).

### Grid, layout heights

```css
--hud-grid-line: rgba(57,112,255,.10);   /* dark: rgba(120,150,255,.09) */
--grid-cell: 64px;
--gutter:    clamp(16px, 4vw, 40px);     /* the site's horizontal gutter, named */
--header-h:  71px;   /* 13px + the 44px tap-target row + 13px + 1px border, at every width */
--ticker-h:  64px;
```

`cyber-grid` draws one `--grid-cell` per square; `cyber-floor` lays the same grid down in
perspective (it owns `transform`, so `animate-grid-drift` goes on its child).

### Stacking order

One ladder for every fixed or sticky layer, low → high:

| Token | Value | Layer |
|-------|-------|-------|
| — | 100 | lightbox (module literal) |
| `--z-rail` | 104 | fibre scroll rail (from 861px) |
| `--z-os` | 108 | OS layer: the dock (`z-index: 10` inside it) and the windows (their order, 1–3, inside it) |
| `--z-nav-overlay` | 115 | burger menu overlay — **under** the header on purpose, so the burger stays usable |
| `--z-header` | 120 | sticky header |
| `--z-dropdown` | 130 | desktop dropdowns |
| `--z-lang-popup` | 200 | compact language popup |
| `--z-cookie` | 280 | cookie banner |
| `--z-progress` | 300 | scroll progress bar (the fibre below 861px; hidden while the rail exists) |
| `--z-modal` | 320 | the request dialog — above everything interactive |
| `--z-intro` | 400 | first-visit intro — covers every CTA, so the dialog cannot open under it |

New code reads the token (`z-(--z-header)` in Tailwind, `var(--z-modal)` in a module); a
literal z-index for one of these layers is a bug. The three HUD chrome layers (2026-09-17, tokens
only so far) sit **under the whole ladder**, burger overlay included: the overlay, the request
dialog and the intro cover them with no hide logic ([Cyber Dark / Neon Cyan / Obsidian
Black](#cyber-dark--neon-cyan--obsidian-black)). The interior stage added no layer: it is an
`isolate` stacking context, and the hero's plate and backdrop use local `-z-20` / `-z-10` inside
it ([The interior stage](#paint-order)).

### Motion

```css
--motion-ease-out:    cubic-bezier(.16,1,.3,1);
--motion-ease-reveal: cubic-bezier(.2,.7,.2,1);   /* the [data-reveal] scroll reveal */
--motion-marquee:     28s;                        /* one ticker group per loop */
```

### Contrast — the constraint that shapes the whole palette
Lifting a background *lowers* contrast, so the text tones have to be tuned along with it.
Computed with the WCAG formula against the values above (2026-09-16):

| Text token | `--panel` | `--panel2` | `--bg` | `--bg2` |
|------------|-----------|------------|--------|---------|
| `--txt` | 17.83 | 16.49 | 16.63 | 15.36 |
| `--mut` | 5.69 | 5.27 | 5.31 | 4.91 |
| `--dim` | **4.45** | **4.11** | **4.15** | **3.83** |
| `--red-text` | 5.38 | 4.98 | 5.02 | 4.64 |
| `--blue-text` | 6.18 | 5.71 | 5.76 | 5.32 |
| `--green-text` | 5.32 | 4.92 | 4.97 | 4.59 |

**`--dim` does not clear AA 4.5:1 on any light surface.** This file used to claim that every
text token did (`--dim` on `--panel2` at 4.94:1) — a figure for the `#666c7b` value documented
here at the time, not for the `#6b7891` that `globals.css` actually carries. Use `--mut` for
small text: the header clock and the language switcher were moved off `--dim` for exactly this
reason. White on the fills: `--blue`
**4.25:1** (bold/large labels only), `--violet2` **6.18:1**, `--red` **4.19:1** — which is why a
red button label sits on `--grad-red-cta`, not on `--red` or `--grad-red`.

**The SectionCTA button** (`components/ui/SectionCTA.module.css`) paints dark text
(`color: var(--bg)`) on the accent fill (`background: var(--h)`, rotating cyan/violet/
amber/blue2). All four accents are light enough that dark-on-accent clears AA — the tightest
is `--blue2` at **7.8:1** — so the button keeps dark text on every hue; none needs white.
`--coral` is decorative only (glows/gradients), so it carries no text-contrast requirement.

Two rules follow, and both have already been violated once:
- **Never dim a token with `opacity`.** `--dim` is already the faintest tone on the page;
  multiplying it by 0.6 (as `.utc` in the old status bar did) pushes it further under. Something
  reads as secondary because of what it sits *next to*, not because it is washed out.
- **A control on top of a screenshot needs its own plate.** Screenshots may be light or dark,
  so anything read over one brings its own background rather than relying on the page: the
  project cards' tag chips sit on a 72% `--ink` plate (6.1–6.9:1 over pure white), and their "·"
  separators on the same plate ([Work — the HUD card](#work--the-hud-card)).

### Where the hues go
The accents are not decoration-by-random — they rotate on a fixed four-step cycle
(cyan → violet → amber → blue) so the page reads as one system:
- **Section index labels** (`/02`, `/03`, …) — keyed off the section id in `globals.css`.
- **Project cards** — each card carries its own gradient (`--p1` → `--p2`, keyed by project id),
  and `--p2` drives its neon edge and glow on hover and focus.
- **Direction pills and the services screen** — the direction's brand `--accent` from
  `lib/solutions.ts`, for borders and glows only.
- **Footer partner chips** — the same rotation on hover.
- **Principles, service icons, stat bars** — the same cycle.

## The interior stage

The home page's Hero, Ticker and Directions scroll over one sticky WebGL canvas (2026-09-17;
wiring in [03 — Architecture](./03-architecture.md#the-interior-stage), behaviour in
[05 — Page Sections](./05-page-sections.md#interior-stage-3d)). Everything below is built from
the existing tokens; the redesign added two, both for the hero on phones.

### Paint order

Back to front, inside the stage (`relative isolate`, so the whole stack stays under the header,
the burger overlay and the cookie banner — no new `--z-*` token):

1. the hero's opaque plate (`-z-20`, `bg-bg`) — it hides the body's page grid behind the canvas;
2. the hero's HUD backdrop marker (`-z-10`): key lights, grid, floor, scanner, and the core's
   anchor with the static art;
3. **the canvas**, in the stage's sticky layer (`h-scene`, one viewport under the header);
4. the phone scrim (below 861px);
5. the copy, the CTAs and the stat cards — then the Ticker and Directions, whose screen is
   see-through so the model shows behind its HUD chrome.

`isolate` on `section#top` would lift the plate and the backdrop above the canvas, so the hero
has none. Nothing on the stage or an ancestor of its layer may carry `transform`, `filter`,
`contain` or `overflow` (they break `sticky`).

### Hero core tokens (phones)

```css
/* light                       dark twin (remapped)         */
--hero-core-phone: 0.3;     /* --dark-hero-core-phone: 0.65 */   /* below 641px */
--hero-core-phone: 0.11;    /* --dark-hero-core-phone: 0.27 */   /* 641–860px   */
--hero-scrim:      0.92;    /* --dark-hero-scrim:      0.8  */
```

Re-measured for the microprocessor (IT-OS Phase 1, 2026-09-17) with the text hidden, over the
forced WebGL chip (**12 frames** per case — its moving packets and pin flares are the worst pixels,
and four frames missed some) and over the static art, at 320, 375, 390, 412, 768 and 844×390 in
both themes. The gate is **every** pixel under a text line box: ≥4.5:1, or ≥3:1 for the headline.

- **`--hero-core-phone`** is the strength of the chip illustration behind the copy below 861px,
  set so the art matches the canvas it crossfades into. Brightness is measured as the mean
  luminance change the chip makes where it sits behind the copy (anchor ∩ copy column, ×1000).
  The chip's art is brighter than the old core's: at the old values the dark art was 1.6–2.1× the
  canvas (0.95 against 0.58 at 390px) and 3.7–4× it at 641–860px, the light art 1.2–1.6× (2.4× at 844×390). Now,
  art ÷ canvas:

  | | 320 | 375 | 390 | 412 | 768×1024 | 844×390 |
  |---|---|---|---|---|---|---|
  | dark | 1.17 | 0.91 | 0.91 | 1.12 | 0.97 | 1.10 |
  | light | 1.26 | 0.94 | 0.92 | 1.01 | 0.92 | 1.37 |

  320px is the outlier in both themes (the art's fixed-width strokes weigh more on a 294px chip);
  at 844×390 the light chip changes no pixel by 3% either way. **641–860px has its own, fainter
  value** (`@media (min-width: 641px)` in `globals.css`): there the chip is centred under the lead,
  below the scrim's full pool, and at the phone values the lead failed (light art 99.13% of its
  pixels, lowest 4.17; dark 99.92%, 4.28).
- **`--hero-scrim`** is the opacity of the phone scrim, a radial pool of `--bg` between the chip
  and the copy. Unchanged: the light lead (`--mut`, 4.87:1 on the bare page) sits on the chip's
  centre and measures exactly 4.50 at its lowest at 390px over 12 frames. More scrim does not buy a
  brighter chip — at .95 the dim still could not rise (ink 0.6: 99.98%, lowest 4.45; 0.7 / 0.8:
  4.41 / 4.40) — and at .98 the chip disappears. A more visible light chip needs another scrim
  shape, not a token.
- The WebGL chip has its own resting dim while it sits behind the copy
  (`CORE_BEHIND_COPY_DIM`, `components/scene/choreography.ts`): below 641px 0.55 dark / 0.4
  light (unchanged), 641–860px **0.25 dark / 0.15 light** (was 0.35 / 0.3, which failed at
  768×1024 over 12 frames: dark lead 99.94%, lowest 3.78, headline 2.74; light lead 99.84%, 4.06).
- **Result, every hero text 100% below 861px in both themes and both paths.** Lowest: dark canvas
  lead 5.05, headline 3.59; dark art lead 7.58, headline 3.84; light canvas lead 4.50, headline
  3.58; light art lead 4.69, headline 3.74; the light eyebrow 4.55–4.68 is its own colour's limit
  on the page. Retune the dim and the tokens together.
- **Still open from 861px** (none of these tokens applies there): at 1024×768 the chip's left
  traces pass under the end of the headline — dark canvas 99.99% ≥3:1 (lowest 1.22), dark art
  99.92% (1.92), light canvas lowest 2.38; moving the 861–1024px anchor right by about 5.5vw
  (`right: calc(var(--gutter) + 6vw)`) measured 100% at 900 and 1024 in both themes and paths. At
  861px the light eyebrow (99.69%, 4.09) and lead (99.97%, 4.50) sit on the 1px HUD grid line,
  identical with the chip hidden. See `CHANGELOG.md` (2026-09-17, Faza 1).

### Work's ambient helix and its band (IT-OS Phase 3)

Below 768px Work's DNA helix lies **in the empty band above `#lucrari`'s eyebrow** — Directions'
36px bottom padding plus Work's 48px top padding, measured into the probe as `workGap` — at full
brightness, never behind text ([05](./05-page-sections.md#work)). Measured like the hero chip: text
hidden, forced WebGL, **12 frames**, every pixel under a text line box.

- **Behind the heading (the first placement) it could not stay visible.** The helix's front chips
  flare and its packets run as comets, and both saturate towards white. At 0.4 of full brightness
  the dark h2 fell to 1.0–1.07:1 and the lead to 1.15–2.28:1; 100% needed 0.07 on the dark page.
  The light lead's grey (4.24–4.28:1 on the HUD grid lines without any canvas) allowed no ink at all.
- **In the band, at full brightness** (320, 375, 390, 412, 640, 700, 767px, both themes): the
  eyebrow, h2, lead and the Directions panel's "Deschide serviciul" link are 100% (dark: eyebrow
  ≥5.4, h2 ≥14.2, lead ≥7.9, link ≥15.3; light: the link ≥16.9, the heading identical to the page
  without the canvas). The canvas changes no pixel over the panel, at or below the eyebrow's top or
  over the band of cards. The helix is 57–67px tall (the band less `HELIX_AMBIENT.clear`, 10px each
  side), with 9–16px of clear space above it and 9–11px below. At 320×568 the link is under the
  header whenever the helix is formed.
- **Spiral (from 768px): the canvas changes no pixel of Work's heading** at 1280×800 and 1024×768,
  and the front card's name and chips stay 100% at every focus measured at 1280, 1024 and 768 (the
  name ≥ 4.46:1 mid-turn, large text; the chips ≥ 6.35:1; the description ≥ 6.16:1 — re-measured
  over 48 combinations after the cards were given their 3D pose, and again after the spacing and
  the screenshot's arrival animation). Only a side card fading out lets a little of the helix
  through.
- **The screenshot's arrival** (`work-media-reveal`, `work-scan` in `app/tailwind.css`) is a
  `clip-path` wipe plus a sheet of scan lines in the card's accent, and a bar crossing the card
  when it reaches the front. The scan layer is painted **on the screenshot and under the card's
  washes**, so the 82–94% ink that carries the copy attenuates it exactly as it attenuates the
  picture: no accent, not even FLIRT's `#ff2d78`, can lift a line of copy off its measured floor.
  Both are armed only inside `[data-scene-stage][data-helix="spiral"]` and only under
  `prefers-reduced-motion: no-preference`.
- **The card's 3D pose** (the same measurement): a card is turned by 0.62 of its own angle round
  the strand, leans up to 0.055rad along the strand's rise and is pushed **away** from the camera
  by up to 260px — never towards it, so its projected box only ever shrinks and the layout clamp
  stays a valid bound. `perspective(1200px)` is written **on the card**, not on the track: on the
  track it would make a stacking context and lift the cards behind the helix out from under the
  canvas. The front card is posed at zero, so the contrast figures above are measured on exactly
  the transform a grid card has. Side and back cards are translucent by design and the helix shows
  through them; note that the calibration lab samples an axis-aligned box, which for a turned card
  now also catches pixels outside it, so those readings are no longer comparable with the ones
  taken before the pose.
- The light theme's heading has pixels under 4.5:1 on the HUD grid's 1px lines (eyebrow 92.99–99.92%,
  lead 99.94–99.98%, minimum 4.07–4.49), with or without the canvas and before Phase 3 alike.

### Static art (`components/scene/art/`)

What every device without the WebGL scene sees, and what the canvas crossfades from.

- **One SVG per drawing**, viewBox `-100 -100 200 200`, proportions from the scene's own shapes
  (`components/scene/shapes.ts`, `heroArt.ts`, `serviceArtPaths.ts`) — the art and the model agree.
- **Tokens only**, in a CSS Module per component (the art is not in Tailwind's `@source`):
  `--cyan`, `--blue`, `--blue-text`, `--red`, … Strokes are `vector-effect: non-scaling-stroke`,
  so a line keeps its CSS width at any size; heavier strokes on the hero core at ≤860px.
- **The hero's microprocessor** (`HeroCoreArt` + `heroArt.ts`, IT-OS Phase 1): one `<svg
  data-core-art>` of 23 elements, no `<circle>`. Every path is written in the chip's own plane
  (`CHIP.R` → 95 art units, `h`/`v`/`l` relative commands) inside one `<g>` whose
  `CHIP_ART_MATRIX` is the WebGL chip's `CHIP_POSE` projected, so the crossfade lands on the same
  silhouette; the stacked substrate, heat spreader and die are offset by `chipLift`. Back to front:
  a square glow (`#tbs-core-glow`), the traces (`chipTraces(5)`, the mid tier's) with a wide faint
  `<use>` halo and square vias, rectangular pins, the slabs, the die (`#tbs-core-die`) and its
  grid, **8 packets as red streaks at least `PARTICLE_MIN_LENGTH` = 6 art units long on screen**
  (measured after the projection, which shortens a run), and the square boost wave.
- **Never a dot.** Butt caps and mitred joins, no `circle` under r=12; the services' particles
  drawn as short streaks and crosses, packets as bars at least 9 units long; the chip's pins, vias
  and wave are squares and rectangles, its packets streaks (above).
- **Static by decision.** No infinite animation, nothing on `stroke-dashoffset` or `filter`.
  Two one-shot motions, transform and opacity only, both gone under reduced motion:
  `materialize` (0.45s) when another direction's drawing mounts, and the hero's light wave
  (`core-wave`, the square scaling out ×2.3, plus `core-packets`, the packets flickering twice —
  opacity only; 1.1s) on `[data-scene-stage]:not([data-renderer="webgl"])[data-boost]`.
- **Hidden under WebGL**: `:global([data-scene-stage][data-renderer="webgl"]) .art { opacity: 0 }`
  with a 500ms transition — the same length as the canvas's fade-in. `fallback`, `pending` and
  `off` keep the art.
- `aria-hidden="true"`, `focusable="false"`, no `<title>`, text, link, heading or role.
  Budget: both art modules together ≤ 2.5 KB gzip of CSS.

### Stat holograms and tilt

- **Holograms** (`MetricHologram` in `Hero.tsx`, maths in `lib/hologram.ts`): the card's first
  child, so the value and copy paint over it; top-right, `opacity-50`, cropped by the card's
  `overflow-hidden`. An octahedron (portfolio) or a gyroscope of four great circles (automations),
  drawn as 1px hairlines in the card's `--accent` with a 6px glow, positioned with CSS 3D
  (`transform-3d`, `perspective-[600px]`). Size is one variable, `--holo-a` (26px, 30px from
  641px). **Never a vertex dot.**
- It turns (`animate-holo-spin`, 18s) only under
  `html:not(:has(#tbs-intro)) [data-motion=live] #top:not([data-offscreen])`; otherwise the
  animation is paused on a three-quarter pose (`rotateX(-20deg) rotateY(35deg)`, with a negative
  delay so the paused spin sits on the same pose). Reduced motion removes the animation; the
  resting transform stays.
- **Tilt** (`components/fx/usePointerTilt.ts` + `lib/tilt.ts`): only a mouse on a fine, hovering
  pointer (`(hover: hover) and (pointer: fine)`), never under reduced motion. The hook writes
  `--tilt-rx` / `--tilt-ry` and `data-tilting` on the card, at most once per frame; CSS turns them
  into `perspective(…) rotateX(var(--tilt-rx)) rotateY(var(--tilt-ry))` while `data-tilting` is
  set (150ms), and eases back to none (300ms). Stat cards tilt up to 8° (`perspective(900px)`),
  project cards 6° (`perspective(1000px)`, from 641px). The tilt is `transform`, the hover lift is
  `translate` — two properties, so they compose. `data-tilt="on|off"` says whether the card can
  tilt (`off` on the server). A tilt never touches an intro entrance marker.

### The hero stat panels (2026-09-25)

Where the scene draws them (861px and up, `data-renderer="webgl"` — see
[05 — /01 Hero](./05-page-sections.md#01--hero) for the conditions and the fallback), the hero's
two metric cards are **holographic panels in the 3D scene** rather than glass cards on the page. One
`PlaneGeometry` each on `SURFACE_MODE.holo` — the Work hologram's own branch, so they arrive in the
palette's colour, under the same scanline comb, in the same hairline frame, with the same voxel
dissolve and the same glitch over a content swap. One draw call and one texture per panel; no frame
geometry, no vertex dots, no second plane.

**The face is the card.** `three/statFace.ts` composes it from the card's own DOM: every string is
its `textContent` and every size, weight, family, margin and padding is its COMPUTED style, scaled
by the one ratio between the canvas and the card's LAYOUT box (`offsetHeight`, so the intro's
entrance, the scroll parallax and the card's own tilt cannot lean a letter). The face therefore
carries the counted portfolio number, the visitor's language and any copy or token change with
nothing authored twice. Drawn on it, in this order: a faint pane (`STAT_FACE.plate`, 0.055 — an
additive hologram cannot darken what is behind it, so it lifts its own surface instead), the
wireframe hanging off the top-right corner, the number, a short rule, the label wrapped as the card
wraps it, the note upper-cased on the card's own tracking, the group's two-digit tick and the
bracket corners.

**Greyscale on purpose.** The `holo` branch keeps a coloured pixel's own hue and maps a grey one
into the palette, so a face drawn in colour would be a surface with a colour the palette did not
give it — allowed for a screenshot on the laptop's display, not for the hero's own numbers. The two
cards' accents are carried the way the cards carry them: by the wireframe (an octahedron for the
portfolio, a ring gyroscope for the automations, on the same resting pose the CSS hologram is
parked at, `rotateX(-20deg) rotateY(35deg)`), and by nothing else.

**Placement and motion.** Fitted to the card's own window, per axis, less `STAT_AIR` (3px) a side —
a rectangle, not a scaled square: the windows are 0.98 : 1 in two columns and 2.2 : 1 stacked at
861–1024px, and one scale would letterbox the number away from the place the card kept. A rigid
follow of the page, with no sway: these are numbers to read, not scenery. The pointer is answered
from the scene itself — the fine pointer's page position (`fx.pointerX/Y`) against the measured
windows, so there is no DOM read per frame — with a lean of `STAT_MOTION.lean` (0.14 rad) towards
the cursor, a lift of 0.12 world units towards the viewer and 22% more light while it is there.
Idle, each panel breathes on a float of ±0.02 rad of yaw and ±0.014 of pitch, out of phase between
the two. The group dissolves in and out with `STAT_FADE_SECONDS` (0.3s) as the hero arrives and
leaves.

**Canvas size.** `SCENE_TIER_CONFIG[tier].statFace` — 512 × 288 high, 384 × 224 mid. Bigger than the
hologram's cap and for the opposite reason: that one must not be legible, this one is a number the
visitor reads. The canvas is never larger than the window's own device pixels (the scene's dpr is
capped at 1.75), and it is re-sized when the window's aspect changes.

### Directions — the HUD screen

- Pills: `rounded-pill` glass links; the selected one (`aria-current`) takes the direction's
  `--accent` as border and glow, lifts 2px from 641px, and shows an `aria-hidden` "↗" in
  `--red-text`. Below 641px the row is a band that scrolls and snaps inside itself.
- The screen: `cyber-grid` dissolved by `fade-radial`, an accent radial glow
  (`color-mix(in srgb, var(--accent) 14%, transparent)`), a scan line (`animate-scan`, paused under
  the intro overlay and while `#servicii` is off screen, hidden under reduced motion) and four
  1px corner brackets. `--accent` comes from `lib/solutions.ts` — the same brand accent the
  service page uses — as an inline custom property, used for borders and glows only.
- The case card is an `--ink` block; a reference project's tags are chips joined by the tag's own
  "·" as text.
- **The glass reveal** (IT-OS Phase 2, 2026-09-17; `app/tailwind.css`): `entry-glow` on the panel,
  `entry-sweep` on its copy column. Both key off the stage root: `data-entry`
  (`idle|burst|formed`, written only while a WebGL scene is mounted — see
  [03](./03-architecture.md#the-services-entrance-it-os-phase-2-2026-09-17)) and `data-renderer`.
  - **Edge glow:** a `color-mix(in srgb, var(--accent) 70%, transparent)` border, a 1px ring at
    35% and a 32px glow at 18%, listed after `var(--sh-lg)`, so the depth shadow stays under it.
    It lights under `[data-renderer="webgl"][data-entry="formed"]`, and **statically** on the `fallback` and `off`
    renderers (no `data-entry` there). It **never** lights under `pending`, which can still turn
    into WebGL and take it away again. The 0.5s transition (border colour and shadow,
    `--motion-ease-out`) exists only under `[data-renderer="webgl"]`, so the static glow never
    animates in.
  - **`color-mix` only inside an explicit `@supports (color: color-mix(in lab, red, red))`.**
    Without it Tailwind adds a fallback copy of every rule with the plain, fully opaque accent.
    An engine without `color-mix` keeps the plain panel.
  - **Sweep:** the column's `::after` (its `::before` is the top hairline, so no `after:`
    utility may go on that column): a 115° `var(--accent)` band between transparent stops,
    `pointer-events: none`, opacity 0 at rest. `hud-glass-sweep` plays once under
    `[data-renderer="webgl"][data-entry="burst"]` with `prefers-reduced-motion: no-preference`, and only then the column
    is `overflow: clip` (no scroll container, so nothing moves). Its strength is the keyframe's
    opacity, never a colour mix, so no engine gets an opaque band over the text. At .12, the
    worst copy under the band's centre measured **5.11:1 dark and 4.61:1 light** (the tag, the
    tightest line in both themes, for all five accents); .16 would take the light tag to 4.38.
  - The glow changes no pixel of the copy's text area (measured). Neither goes on
    `[data-reveal]` or an intro marker, and neither uses `filter`, blur or `border-radius`.
    `tailwind-contract.test.ts` pins these rules.
- Height floors: the copy, the screen and the panel carry per-locale `min-h` values measured as
  the tallest of the five directions per width band, so selecting a direction never moves the
  page. New copy means measuring again.

### Work — the HUD card

Paint order inside a card, back to front: the screenshot (`[data-parallax="work-media"]`) → the
dark wash → the glass edge and corner brackets → the copy.

- **Surface:** the project's gradient (`--p1` → `--p2`, inline, keyed by project id with a
  positional fallback). A faint diagonal reflection and an inner ring in `--on-accent` read as
  glass — **no `backdrop-filter`**: the screenshot under it moves with the parallax, and nine live
  blurs would re-sample it every scrolled frame.
- **Neon edge** on hover and on keyboard focus: the border, the inner ring and a soft glow take
  `--p2`; corner brackets (2px straight strokes) draw in from the corners; the top accent hairline
  brightens (the same mark as the hero's stat cards).
- **Two washes that cross-fade**: a light resting wash on desktop, and a strong one (~82% ink up
  to 46% of the card height) whenever the description shows — always on touch screens and ≤640px,
  on hover or focus on a desktop. Measured (text hidden, brightest pixel under the copy, all
  seeded projects, both themes, 320–1280px): name ≥7.2:1 at rest and ≥4.4:1 while the description
  is open (large text), description ≥5.6:1. A card without a screenshot gets the same wash.
- **Tag chips** carry their own plate: `color-mix(in srgb, var(--ink) 72%, transparent)` with a
  hairline — white on it over a pure-white pixel is 6.9:1 (light ink) / 6.1:1 (dark ink), the
  floor for any screenshot. The admin's "·" between two chips stays as text, on the same plate,
  as the joint of a segmented strip (the chips' inner corners are square). An ink halo around a
  bare "·" only reached 2.96–3.58:1, which is why it sits on the plate. Chips have no blur.
- **Parallax** (`view-work` on the section, `parallax-media` on the image wrapper): a ±5% drift
  at 1.12 scale across the section's view timeline, on the compositor, only under
  `@supports (animation-timeline: view())` and `prefers-reduced-motion: no-preference`. The
  luminosity blend sits on the wrapper, not the `<img>` (the running animation makes the wrapper a
  stacking context).
- **Layout:** three columns; two up to 900px (`max-[901px]:`), where an odd last card spans the
  row and keeps its screenshot at a normal card's size on its right half, edges faded
  (`edge-fade-x`) — stretched, `object-cover` enlarged the top of a screenshot ~2×. ≤640px one
  snap band that bleeds to the screen edges (`scroll-padding: var(--gutter)`); the focus ring
  moves inside the card there, and the lift is off (it would clip).

### Subpixels

```css
--subpixel-r: #ff3b3b;
--subpixel-g: #3bff6e;
--subpixel-b: #3b6bff;
```

The three primaries a real screen pixel is made of, for `/portofoliu`, where every project is
drawn as one pixel ([05](./05-page-sections.md#portfolio--portofoliu)). They show only up close.
From where the visitor sits, a pixel is a point of light about the size of a real one (3px): its
colour `--p2` mixed toward `--on-accent` at the centre, inside a soft disc of `--p2`. Under the
loupe the point opens out into a 42px macro: these three bars on a `--void` matrix. Each bar is
lit (`opacity`) to its share of the colour, is brightest along its middle and is screen-blended,
as in a macro photo of a display.

The primaries are deliberate: a triad tinted toward the brand palette stops reading as a pixel.
They are softened just enough not to vibrate on `--void`. Never remapped, graphic only, never
text. The project colours themselves (`lib/projectAccent.ts`) stay per-project data, not tokens:
they reach the page as inline `--p1` / `--p2`.

### The portfolio's controls

What `/portofoliu` added around its field on 2026-10-04
([05](./05-page-sections.md#portfolio--portofoliu)). All of it is in `Portfolio.module.css`, from
existing tokens:

- **The how-to line.** Body type at `--fs-base`, `--mut`, sentence case — not the HUD's small
  capitals — led by a still 3px point of light, its link in `--txt` with a cyan underline. The
  one instruction on the page; everything else stays a label.
- **Service filter.** Mono, uppercase, `--fs-sm` labels at 0.06em (11px at 0.1em lost the shape
  of a word for older eyes) in a 36px box (44px on phones) with a `--line2` edge and `--mut`
  text, the count in `--txt` bold. Pressed: `--neon-cyan` edge, `--cyan-text` and a 10%
  `--neon-cyan` fill — cyan marks the selected state, as everywhere. Hover only where there is
  hover.
- **A switched-off pixel.** The button drops to 16% opacity in three hard steps (`steps(3)`) and
  its flicker pauses. Nothing else changes, and nothing moves.
- **Legend rows.** A still copy of the project's light (3px point, 22px disc), the name in
  `--fs-base` bold and the tag in mono `--fs-sm` `--mut`, over a `--line` hairline, and a `›` at
  the end (`--fs-lg`, `--mut`; `--txt` under the pointer or the keyboard, which also underline
  the name; the project's `--p2` while its card is open). A row whose pixel is pointed at, open or
  picked takes a 9% wash of the project's own `--p2`.
- **The card's ×.** A real button where a window's close sits, after two of the three lights: an
  `--fs-lg` × in `--on-accent`, 32px (44px on a coarse pointer), a 16% `--on-accent` wash on hover,
  a cyan ring inside on focus.
- **The card's request.** The red CTA fill on the label-safe twin (`--grad-red-cta`), full width,
  40px (44px on phones), its label at `--fs-md`. No outer glow or lift — the card clips at its
  rounded edge — so hover rings it from inside. "nu are pagină publică" sits beside it at
  `--fs-md` in plain case.
- **The close.** The service pages' closing panel, restated (corner brackets in 38% `--cyan`, the
  `--blue → --violet2 → --cyan` thread drawn out as the PANEL enters the view — a named
  `view-timeline` on the panel; with `view()` the 2px thread was its own subject and finished
  within a pixel of scroll, here and on the service pages alike), its button on
  `--grad-red-cta`. Change both together.
- **Forced colours.** The pressed channel shows by a 2px `Highlight` border, leaving the outline to
  the focus ring. The pixels and the legend's swatches keep their own paint
  (`forced-color-adjust: none`): they are pictures of light, made of backgrounds, gradients and
  glows a contrast theme would erase to an empty field.
- **Hover** (the loupe, a legend row's wash, a channel's edge) only under `(hover: hover)`: touch
  keeps `:hover` on the last thing tapped, and a tablet's second tap would leave a closed pixel
  magnified. The keyboard focus ring sits above the card it opens (`z-index: 4`).

## Cyber Dark / Neon Cyan / Obsidian Black

The palette of the HUD chrome: the fibre scroll rail, the OS dock and windows, and the Command
Center form. It is built from the existing system: two brand names map
onto tokens that already existed, and the new tokens follow the same rules as the rest of the
file (a graphic tone and a text tone, dark twins remapped in one place, always-dark islands never
remapped).

> **Status (2026-09-17): the fibre rail with the thin cyan scrollbar (Phase 5,
> [below](#the-fibre-rail)) is built on them.** The Ghid TBS guide (Phase 4) was too, and was
> removed on 2026-09-26.
> The tokens are in `app/globals.css` and `app/tailwind.css`; when they landed alone, the home page
> rendered byte-identical screenshots with and without them (1280 and 390px, both themes, five
> scroll positions) and the Tailwind CSS chunk did not change.
> The OS layer and the Command Center land later; the rules in this section are the contract those
> parts are built to.

### Palette mapping

| Name | Tokens | Theme behaviour |
|------|--------|-----------------|
| **Cyber Dark** | no new token: the `--dark-*` surface scale (`--dark-bg` `#0a0b10`, `--dark-panel` `#181e30`, `--dark-panel2` `#1f2639`, `--dark-line*`, `--dark-glass-*`), reached through the remapped `--bg` / `--panel` / `--glass-*` | follows the theme; in light the same component sits on the light scale |
| **Neon Cyan** | `--neon-cyan` (graphics) · `--cyan-text` (text) · `--glow-cyan` · `--neon-cyan-ring` | light `#0891b2` / `#0b7490`, dark `#38e1ff` for both, remapped in both dark blocks |
| **Obsidian Black** | `--obsidian` **is `--void`** (`#0a0b10`) · `--on-obsidian` · `--on-obsidian-mut` · `--obsidian-neon` · `--obsidian-line` | never remapped: always-dark islands, the same in both themes |

A separate, darker obsidian (`#06070b`) was proposed and dropped: it computes to 1.02:1 against
`--void`, a difference nobody can see, so Obsidian Black is `--void` itself.

**Red is still the only call-to-action fill** (`cta-neon`, `--grad-red-cta`). Cyan is
information: rings, threads, ticks, the selected state, status. A cyan button fill would compete
with the one red action on the screen.

### Tokens

```css
/* light, on :root                                dark twin, on :root, remapped          */
--neon-cyan:      #0891b2;                        /* --dark-neon-cyan:      #38e1ff      */
--cyan-text:      #0b7490;                        /* --dark-cyan-text:      #38e1ff      */
--glow-cyan:      rgba(8,145,178,.28);            /* --dark-glow-cyan:      rgba(56,225,255,.38) */
--neon-cyan-ring: 0 0 0 1px rgba(8,145,178,.5),   /* --dark-neon-cyan-ring: 0 0 0 1px rgba(56,225,255,.55), */
                  0 0 16px rgba(8,145,178,.3);    /*                        0 0 18px rgba(56,225,255,.4)    */

/* Obsidian Black: never remapped */
--obsidian:         var(--void);   /* #0a0b10 */
--on-obsidian:      #e6f4ff;
--on-obsidian-mut:  #9fb3c8;
--obsidian-neon:    #38e1ff;
--obsidian-line:    rgba(56,225,255,.22);
```

Both dark activation paths (`prefers-color-scheme` and `[data-theme="dark"]`) remap the four
Neon Cyan tokens. `--glow-cyan` is decoration only (a glow under a stroke). `--neon-cyan-ring` is
the cyan twin of `--neon-blue`: a hairline ring plus a near glow.

### Contrast

Computed with the WCAG 2.x formula from the token values (2026-09-17). Translucent tokens are
composited in sRGB over the named backdrop, without the browser's 8-bit rounding, which can move
the second decimal (`--cyan-text` over the worst `--glass-bg-text` pixel: 4.28 computed, 4.26–4.30
with the channel rounded down or up). These are computed, not measured on screen. Each part re-measures
its own rendered pixels when it lands. Thresholds: **4.5:1** for text, **3:1** for graphics that
carry meaning (a control's boundary, a focus or selected indicator).

**Neon Cyan on the surfaces**

| Token | `--bg` | `--bg2` | `--panel` | `--panel2` |
|-------|--------|---------|-----------|------------|
| light `--neon-cyan` (graphic) | 3.44 | 3.17 | 3.68 | 3.41 |
| light `--cyan-text` (text) | 5.00 | 4.62 | 5.36 | 4.96 |
| light `--cyan`, for comparison | 3.33 | 3.07 | 3.56 | 3.30 |
| dark `--neon-cyan` = `--cyan-text` (`#38e1ff`) | 12.53 | 12.83 | 10.56 | 9.60 |
| dark `--cyan` (`--dark-cyan`), for comparison | 9.65 | 9.88 | 8.13 | 7.39 |

`--neon-cyan` clears 3:1 on every light surface, and the light `--cyan-text` clears 4.5:1 on
every light surface. The two share a hue (192° and 193°) and sit only 1.46:1 apart, so text and
strokes read as one colour.

**On glass.** Measured the way the rest of the site's glass is: against the worst pixel that
can show through (black under the light sheet, white under the dark one), and over the page
colour.

| Text or graphic | `--glass-bg-solid`, worst pixel | `--glass-bg-solid` over `--bg` | `--glass-bg-text`, worst pixel | `--glass-bg-text` over `--bg` |
|---|---|---|---|---|
| light `--txt` | 15.60 | 17.75 | 14.22 | 17.70 |
| light `--mut` | 4.98 | 5.67 | 4.54 | 5.65 |
| light `--cyan-text` | 4.69 | 5.34 | **4.28 ✗** | 5.33 |
| light `--neon-cyan` (graphic) | 3.22 | 3.67 | **2.94 ✗** | 3.66 |
| dark `--txt` | 13.07 | 15.68 | 9.36 | 16.02 |
| dark `--mut` | 7.01 | 8.41 | 5.02 | 8.59 |
| dark `--cyan-text` / `--neon-cyan` | 8.92 | 10.70 | 6.38 | 10.93 |

The decorative `--glass-bg` is not for HUD chrome. Over its worst pixel, the light `--cyan-text`
measures 2.69, and dark `--mut` 2.36.

**Rings, glows and dark blocks**

| Pair | Light | Dark |
|------|-------|------|
| `--neon-cyan-ring` hairline against `--bg` / `--panel` / the worst `--glass-bg-solid` pixel | 1.82 / 1.87 / 1.78 | 4.33 / 4.11 / 3.75 |
| `--glow-cyan` at full strength against `--bg` | 1.39 | 2.62 |
| `--cyan-text` on `--ink` | **3.22 ✗** | 9.62 |
| `--neon-cyan` on `--ink` | 4.69 | 9.62 |
| `--obsidian-neon` on `--ink` / `--ink2` | 11.01 / 10.11 | 9.62 / 8.17 |
| scrollbar thumb or fibre in `--neon-cyan`, against `--bg` | 3.44 | 12.53 |

**Obsidian islands.** These values hold in both themes, because nothing in them is remapped. The
field fill is `color-mix(in srgb, var(--on-obsidian) 4%, var(--obsidian))`, which is
`rgb(19,20,26)`.

| On | `--obsidian` | field fill |
|----|--------------|------------|
| `--on-obsidian` | 17.55 | 16.39 |
| `--on-obsidian-mut` | 9.13 | 8.53 |
| `--obsidian-neon` | 12.53 | 11.70 |
| `--dark-red-text` (error state) | 7.15 | 6.68 |
| `--dark-green` (sent state) | 10.58 | 9.88 |
| `--dark-blue-text` | 9.19 | — |

| Pair | Value |
|------|-------|
| the island against the light `--bg` / `--panel` | 18.34 / 19.66 |
| the island against the dark `--bg` / `--panel` | **1.00** / 1.19 |
| `--obsidian-line` (composited) against `--obsidian` | 1.61, decoration only |
| the field fill against `--obsidian` | 1.07, so the fill alone does not mark a field |
| theme-following tones on the island, light theme: `--txt` / `--cyan-text` / `--neon-cyan` | **1.10 ✗** / **3.66 ✗** / 5.34 |
| white on `--grad-red-cta` (`#e0213a` / `#b50e22`) | 4.72 / 6.88 |
| the CTA's light stop `#e0213a` against `--obsidian` | 4.16 |

### Usage rules

1. **Graphic tone vs text tone.** `--neon-cyan` is for strokes, rings, threads, ticks and
   thumbs, and never for small text. Cyan text is `--cyan-text`.
2. **Cyan text goes only on opaque surfaces or `--glass-bg-solid`**, never on `--glass-bg-text`
   (4.28 in light). On `--glass-bg-text`, a light cyan graphic that carries meaning is also too
   faint (2.94): draw it in `--cyan-text` (4.28 ≥ 3) or keep it off that glass.
3. **The ring is decoration.** The light hairline of `--neon-cyan-ring` is 1.8:1. An edge that
   carries meaning (a control's only boundary, the selected state) is a 1px `--neon-cyan` border,
   and the ring goes on top of it (`border: 1px solid var(--neon-cyan); box-shadow: var(--neon-cyan-ring)`).
4. **On an always-dark block, cyan is `--obsidian-neon`.** That covers obsidian islands and
   `--ink` blocks. The theme-following tones fail there in the light theme (`--cyan-text` 3.22 on
   `--ink`, 3.66 on obsidian).
5. **An obsidian island re-scopes the theme tokens on its root:** `--txt`, `--mut`, `--dim`,
   `--line`, `--line2`, `--panel`, `--panel2`, `--red-text`, `--blue-text`, `--green-text`, and
   `color-scheme: dark`. The components nested inside (a focus ring in `--txt`, the dictation
   button) then follow without changes; without this, a light-theme `--txt` ring is 1.10:1 on
   the island. The island also:
   - always draws its `--obsidian-line` edge and a faint glow, because it is 1.00:1 against the
     dark page;
   - gives a field its own boundary (`--on-obsidian-mut` measures 8.53 against the fill), and
     `--obsidian-neon` on focus (11.70);
   - keeps the submit button on `--grad-red-cta`.
6. **Glass, and blur:**
   - The dock, the avatar, the tip and the rail never use `backdrop-filter`. They use
     `--glass-bg-solid` plus `--neon-cyan-ring`.
   - No `backdrop-filter` on any ancestor of a CSS `preserve-3d` element: it flattens the 3D.
   - From 861px, OS windows may blur (`backdrop-filter: blur(var(--glass-blur))` over
     `--glass-bg-text`) if one window open over the running hero holds ≥45 fps (forced mid tier,
     4× CPU). Otherwise they use `--glass-bg-solid`. Below 861px a window is the request Modal's
     sheet.
7. **No dots.** Use streaks, bars, squares and diamonds, with `border-radius: 0` at 8px or
   smaller. A ring is at least 38px. As each HUD part lands, its component and module CSS join
   `decorative-dots.test.tsx`, which then flags `border-radius: 50%` or `var(--r-pill)` on
   anything 8px or smaller.
8. **Motion** animates transform and opacity only, in keyframes that live in the module that
   uses them:
   - autonomous motion comes in bursts of 5 s or less;
   - continuous motion runs only while the visitor hovers or scrolls;
   - reduced motion is static.
9. **Nothing writes a custom property onto `<html>` or `<body>`.** The placement tokens below are
   static and read from stylesheets only (the E2E `expectRootUntouched` check).
10. **The thin cyan scrollbar** (since Phase 5) is `scrollbar-width: thin; scrollbar-color:
    var(--neon-cyan) transparent` on `html`, a stylesheet rule next to `scroll-behavior: smooth`.
    The thumb is 3.44:1 against the light `--bg` and 12.53:1 against the dark one.
    `scrollbar-color` is inherited and `scrollbar-width` is not, so every inner scroller without a
    colour of its own gets a cyan thumb at the normal width: the request dialog's body, the burger
    menu (with classic scrollbars). Checked with classic scrollbars at 1280 and
    390px in both themes (P5-C lab): it reads as the HUD's information colour and is accepted, so
    no module overrides it. The estimator chat log (`--line2`) and Work's phone band (`--red`) keep
    the colours they set. Classic scrollbars still take width (10px thin on the page, 15px in the
    dialog), so the scroll lock's reserved gutter still applies.

### Stacking and placement

The layers sit in the [stacking ladder](#stacking-order) under the burger overlay: rail 104, then
the OS layer 108, both below `--z-nav-overlay` 115.

```css
--z-rail: 104;   --z-os: 108;
--hud-edge: 12px;  --hud-rail-w: 44px;  --hud-dock-h: 56px;  --hud-bottom: 112px;
```

**From 861px**

| Part | Box |
|------|-----|
| Rail | `fixed; right: 0; width: var(--hud-rail-w); top: calc(var(--header-h) + 16px); bottom: var(--hud-bottom)` |
| Dock | bottom-centre at `bottom: var(--hud-edge)`, `--hud-dock-h` tall; 72×52 buttons with visible labels (about 240px wide) |
| Window frame | top `--header-h` + `--hud-edge`; bottom `--hud-bottom`; right `--hud-rail-w` + `--hud-edge`; left `--hud-edge`. A maximized window uses the same insets |

**Below 861px**

| Part | Box |
|------|-----|
| Rail | none; the 2px top progress bar stays, restyled as a fibre |
| Dock | bottom-centre, `bottom: max(12px, env(safe-area-inset-bottom))`; three 44×44 buttons, about 156px wide (x 82–238 at 320px) |
| Windows | the request Modal's `sheet` size |

**When the chrome shows:**

- **Not armed:** nothing renders while the intro is on screen, while the cookie question is
  unanswered, or when QA sets the `tbs_hud=off` flag. So nothing ever collides with the cookie
  banner (z 280) or the intro.
- **Page covered** (the request dialog or the burger menu): nothing is hidden or made `inert`.
  The z-order covers the chrome and the dialog traps Tab, and live polling and rail writes pause.
- **Away:** while the home page's own request form (`#estimare`) is in view, the dock goes to
  opacity 0 with `pointer-events: none` and its buttons get `tabIndex=-1`. It is never set to
  `display: none`, `visibility: hidden` or `inert`, so focus can come back to it.
- **Typing** (below 861px): the dock steps away while a text field has focus.
- **Obscuring:**
  - a window fades to `.12` when it fully covers the focused element;
  - a focused element hidden under the dock is scrolled clear of it.
- **Footer on phones:** the footer gains `--hud-dock-h` + 2 × `--hud-edge` of bottom padding
  while the dock exists, so its last link stays tappable.

### Asistent TBS — the corner assistant

The first HUD part (IT-OS Phase 4, 2026-09-17), and since 2026-09-24 a photographic hologram: a
monochrome 722×849 head-to-chest cutout in a light beam, with orbit rings, that breathes, blinks and
mouths what she says — **inside her square and never outside it**.

**Her mouth (2026-09-27), and the thing five passes missed: THE OPENING IS UNCOVERED, NEVER
DRAWN.**

Every earlier version painted a dark shape ON her closed lips while the photographed lower lip
stayed roughly where it was. That is a slit cut into a shut mouth — which is what "the cut"
meant — and no amount of colour, masking, easing or anatomy in the teeth can talk the eye out of
it. A real mouth does the opposite: the lower lip travels down, and the dark interior is what was
behind it all along.

So the order inverts. The interior and the teeth are painted FIRST; `.jaw`, a window onto her own
lower lip sitting exactly on the seam (`--mo`), is laid over them and covers them completely while
her mouth is shut; and on a beat the lip TRAVELS DOWN and uncovers precisely as much as it moved.

That also rules the old ghost out **by construction** rather than by luck. A travelling patch
exposes a strip of untouched original at its top edge — that strip was the phantom second lip.
Here the strip is exactly the aperture's height (both come off one number per beat) and the
patch's opaque core is narrower than the aperture is wide, so no exposed original is ever left
over. Its side fades land inside the aperture; its bottom fade runs to 62% of the patch, past
where the lip's own edge ends up after a full 1.37px of travel, so it spends itself on chin —
which has nothing to double. (At 46% it stopped on the lip's edge, and a faint second edge came
back.)

**And both lips move now (2026-09-28).** Until then only the lower one did, and a jaw dropping
under an upper lip nailed to the photograph is the last thing that still said "painted on": in a
face the two edges PART, and the eye reads the parting rather than the drop.

So the same construction runs once more, mirrored. `.upperLip` is a window onto her own upper lip
and the philtrum above it, sitting on the same seam; it TRAVELS UP, and `.mouthTop` — a strip of
its own, anchored at the seam by `transform-origin: 50% 100%` — grows up by exactly what the lip
vacated. Both run off the same stops as the jaw, so the dark can never be taller than the lip has
lifted, nor shorter. A third of the jaw, because that is anatomy: a mandible drops ten to fifteen
millimetres on an open vowel and the upper lip lifts one or two. The widest syllable moves it
**0.453px against the jaw's 1.511px**.

**NEITHER PHOTOGRAPHIC PATCH IS EVER TRANSFORMED, AND THAT IS THE WHOLE OF "THE CUT".**

The first version of the upper lip was transformed like the jaw, and the user's verdict was that
the lip still did not move and now there was a visible cut at her mouth. Both halves of that were
one cause, and it is not a perceptual argument — it is three frames measured row by row at device
pixels:

- silent, with a compositing layer FORCED onto the patches, is identical — to 0.1 of a luminance
  unit on every row — to her SPEAKING with her mouth shut;
- the same patch with `transform: none` WHILE she speaks is identical to silence;
- therefore the difference is the transform, not the movement.

A transformed element gets its own compositing layer, and that layer rasterises the background
image against the device grid about half a pixel out of step with the inline paint. On the upper
lip, where the portrait's gradient is the steepest on her face — 27 luminance units per device row
— that half pixel is **up to 47 units arriving in one frame**: her lip flattens and an edge appears
the instant she starts to speak. That is the cut, and it had been there on the lower lip all along,
at 17 units, which is why "taitura" kept coming back. It also ate the lift whole: the registration
error is downward and the lift is upward, so 0.45px of real movement arrived as nothing.

So the lips move WITHOUT a transform. The photograph slides inside a box that never moves
(`background-position-y`, offset from a named `--bpy`) and the window it is seen through retreats
with it (`mask-position`, which carries the mask's own soft edge along, where a `clip-path` would
cut a hard line across her lip). Both are paint properties: no layer, no re-registration, and
silence and speech rasterise the same. The offsets are written as a fraction of `--bust-h`, never
in px, so they still scale at `--bust` 38 and 60.

The gradients — the aperture, the strip above the seam, the teeth, the crease — keep their
transforms. They have no photograph to register against, so there is nothing for a layer to put out
of step. `components/__tests__/guide-assistant.test.tsx` enforces exactly that split: the two lips
may animate only the paint properties, everything else only `transform` and `opacity`, and neither
lip may carry a `transform` anywhere.

**Measured after the fix**, at device pixels with the sway cancelled and the crop anchored on the
seam: silence, and speech at two different closures, are identical on every row; at a small
syllable the upper lip's dark band moves up by 11–24 units and at the widest by 16–34. The largest
step between neighbouring rows at rest is 80.1, against silence's 80.7 — no new edge anywhere.

**And the loop closes now.** The cycle ran from `scaleY` 0 at 100% to 0.1692 at 0%: the first
syllable was centred at 0.010 with its opening half-width reaching back past the start, so the
curve was simply cut there and the mouth JUMPED to 27% of its opening once every 4.7 seconds. The
generator now measures a syllable's distance on the CIRCLE, so one that straddles the seam keeps
its tail at the other end, and it asserts that the first and last frame are the same number.


The aperture carries BOTH axes in one animation, which is what makes syllables rather than a
pulse: wide and flat is "e/i", narrow and tall is "o/u", both open is "a", both at zero is
"m/b/p". The width moves on its own, slower centres, so wide never coincides with tall — that
disagreement *is* the viseme.

**The rhythm is irregular on purpose, because an even one is a metronome.** Seven evenly spaced
syllables looping every 1.9s is a rate the eye learns in two passes, and learning it is what
"robotic" means. The cycle is **4.7s with 22 syllables** at uneven centres, with four pauses of four
different lengths. Since she only ever speaks for 7s at a time, a visitor sees **one and a half
turns of it** and never a repeat.

**And then "the lips seem slow", which was not about speed at all.** Every syllable was WIDER
than the distance to the next one — half-width over centre-spacing 1.06 to 1.22 — so neighbours
fused into a single plateau and the 22 syllables produced only **twelve visible openings, 2.55 a
second**, against the 5–6 of real speech. Between them the lip did not return; it sagged. The
individual movement was never slow: its rise measured **89ms**, which is a normal jaw. Narrowing
every half-width to 0.60 of itself turns the same 22 syllables into **22 openings, 4.68 a
second**.

**The beat is also asymmetric now**, because a jaw drops faster than it closes and a raised
cosine is symmetric — symmetry was part of what read as sluggish. The two halves of each syllable
are stretched in opposite directions (0.75 / 1.25): **45ms down, 75ms back up**. She is shut 24%
of the cycle.

And the timing function is **`linear`, which is the opposite of the old mistake rather than a
return to it**. `linear` was wrong when the keyframes were sixteen *poses*: one speed between them
and an instant turn at each. `ease-in-out` fixed the turns and bought a worse problem — velocity
zero at all sixteen, which is a series of little moves. The curve now lives IN the keyframes, and the stops are
placed **by curvature rather than at a fixed interval**: a speech envelope is mostly flat pause
with a few short climbs, so a uniform grid pays the same price everywhere — too coarse exactly
where the mouth moves, wasted in the pauses. The generator samples finely and keeps only the
stops without which the polyline would stray more than **0.02px** from the true curve, and that
error is verified rather than assumed. That gives 228 stops for the aperture, 190 for the lip,
136 for the teeth and 74 for the crease, against a uniform grid of 158.

Played linear, the polyline *is* the curve. Measured in the browser across the rendered cycle:
largest velocity change between samples **12.7 px/s**, **zero** steps over 40. It was 7.7 before
and the rise is correct — the movements are faster now, so their acceleration is higher. It is
not a sampling artefact: doubling the stops only moves the computed figure from 11.6 to 10.7.

Two probes had to be fixed before those numbers could be believed. One stepped the rendered cycle
every 31ms — coarser than a 45ms fall, so it aliased the motion and reported 17.9; at 10ms it
agrees with the generator. The other took the mouth's reference height by dividing its rect by the
scaleY of that instant, which amplifies rounding when scaleY is near zero, and had been reporting
an aperture of 1.71px that does not exist.

All three keyframe blocks are **generated**, and the generator now rewrites whatever duration it
finds on the shorthand and fails loudly if it does not find exactly three. It used to match the
literal `1.9s`; once the file said something else the match silently did nothing, the keyframes
were written for one cycle length and played at another, and every measurement taken through
`currentTime` landed on the wrong phase.

The **teeth** are painted because she is closed-mouthed in the photograph. An arch, not a comb:
divisions where a front arch has them (canine · lateral · central | central · lateral · canine),
the midline strongest, the centrals brighter than the laterals than the canines as the arch turns
away, a translucent biting edge. **They are not white.** At `--txt` 56% they were the lightest
thing on a face whose brightest skin sits well under white, and the eye goes to the lightest
thing.

**And 30% was still too much.** The complaint survived the first climb-down, so the question
became a measurement rather than a taste: photographed at 4x and read as luminance, the teeth
peaked at 189 against a cheek at 202 and a lip at 198 — *not* brighter than her skin, which means
the glare was never absolute brightness but **local contrast against the dark cavity right next
to them**. So the enamel came down and the teeth peaked at 176, below the lip they sit behind and
below the cheek.

**And they still did not look real, because the problem was never colour. THE BAND WAS 0.358px
TALL.** `.teeth` is a child of `.mouth` and `.mouth` is the element that scales, so the painted
band is 26% × 2.4435px × the aperture's scaleY. That is 0.36 of a device pixel at 1x and 0.72 at
2x — **never one whole pixel on any display**. The renderer drew it as one row at 27% coverage or
two at 13.6%, and because the height and its sub-pixel phase change every frame with scaleY, the
row count and the brightness changed continuously through every syllable. **The teeth flickered.**
That is how the luminance figures could be right and the teeth still wrong.

**Three of the four layers were then deleted, because arithmetic says they never reached a
screen:** the tooth divisions at 15.2/31.2/49–51/67.2/83.2%, each a 1.6% band = **0.16px** wide —
for one of them to be a single device pixel at 2x, `--bust` would have to be about 280px, 2.6× her
drawn size, so the whole canine · lateral · central story this document used to tell was
unreachable at *any* dpr and only ever averaged into a tint; and the enamel's three vertical
stops, which ran down the 0.358px axis, where no device row could hold two of them. (The radius
is kept though its vertical curvature is 0.315px and the band renders as a rectangle: it becomes
true if she is ever drawn larger, and removing it changes nothing.) What is left is the two
layers that DO resolve across the width — the corner shading, a 2.6px ramp, and the midline
highlight, a 3.5px hump.

**The band is now 72% of the aperture instead of 26%** — measured at about **1.05px** at the widest
syllable, a whole row instead of a third of one — and a fourth generated block, `guide-teeth`,
keeps them dark until the mouth passes 55% of its opening and full only from 85%. They are
therefore on screen **24% of the time and fully lit 5%**, so below the gate there is no thin band
left to flicker and above it there is a stable row. Peak luminance now reads **167–173** against
176 before: per pixel the enamel is dimmer, but there is three times more of it, so brightness is
roughly a wash. The fix here was the flicker, not the brightness.

**What is NOT fixed, and is worth knowing:** the band is a percentage of an element that scales,
so the arch still stretches and shrinks with the jaw, and a tooth is bone. The anatomically right
answer is a rigid crown behind a growing window — `.teeth` at `height: 100%` with its own
counter-scale — which was designed and costed and then left on the shelf: at a 1.43px aperture the
stretch is below what a pixel can show, while the change makes the enamel 1.84× more present at
the peak, which is the complaint it started from.

Every beat of all three comes off one number, the aperture's own opening, so they cannot drift
apart — the strip the lip vacates and the height the aperture reaches are ONE quantity, and the
three keyframe blocks are generated from it rather than typed. Editing a stop by hand puts them
out of step and the ghost comes back.

Sized off the measured lip box, never in pixels: at her drawn size the box measures 14.6×4.7px,
the aperture opens to **1.42px** and the lip travels **1.42px** — the same number to the
hundredth, measured separately, which is the ghost-lip invariant holding: the strip the lip
vacates *is* the aperture — a third of its
own height, which is what a conversational voice does; at 2.55px it was more than half, an open
mouth at every syllable. It sits under `.wash`, so the scanlines cross the teeth too —
part of the hologram rather than a white shape on top of one. Shut whenever she is not speaking,
under reduced motion, and below 641px. Behaviour is in
[05](./05-page-sections.md#asistent-tbs-the-corner-assistant).

**Three things went on 2026-09-26, and every one of them was something she did unasked:** the
guide's tip (the prompt that appeared after a linger), the greeting (one sentence in a bubble the
moment her entrance finished — the panel the owner photographed), and **the entrance itself**.

That entrance was a 3.4 s build at 230 px (320 from 861 px) — three times her launcher, anchored to
her corner and overflowing it up and to the left: a projector cone, sixteen clipped bands of her
flying in from alternating sides, a scanner riding up the beam, a two-frame lock-on stutter, a
shockwave, and a settle. *"Fa sa nu apara mare, scoate, lasa doar asistentul cel mic in patrat."*
All of it is gone from the component and the stylesheet (which lost ~470 lines and nine keyframes).
What is left is **one opacity fade**, 0.4 s, on the launcher — opacity and not the old `guide-rise`,
which also scaled and lifted her, because a transform changes the box the HUD specs measure against
the right edge of the viewport and against the rail's markers.

Her bubble has **one mode** left, her questions, and it is only ever on screen because someone
pressed her for it. Her mouth still moves while an answer is up, for 7 s, which is the only thing
`data-say` means now. `data-state` is gone with the entrance: there is no state to be in.

Her box is `--guide-box`: 68 below 400px (it has to clear the phone dock's 156px bar at 320), 104,
136 from 641px and **184 from 861px** at `right/bottom: 20px` — which is why `--hud-bottom` is 208
there, so the fibre rail stops 4px above her instead of running under her (at 112 its last two
markers sat inside her box and the bottom one could not be pressed).

Everything else about her is this section's rules, not her own: the palette above, the stacking
ladder, **no `backdrop-filter` and no `filter`** anywhere in a part or above one (she sits over the
live WebGL canvas), **no round dot** and square line caps, every animation inside
`@media (prefers-reduced-motion: no-preference)` and limited to `transform` and `opacity`.

### The fibre rail

The second HUD part (IT-OS Phase 5, 2026-09-17): `components/hud/rail/ScrollRail.tsx` and its CSS
Module, loaded by `HudChrome` after arming, **from 861px only**. A map of the page next to the
native scrollbar, which stays the scrollbar. Behaviour is in
[05](./05-page-sections.md#the-fibre-rail).

**Placement** (critique R2): `position: fixed; top: calc(var(--header-h) + 16px); right: 0;
bottom: var(--hud-bottom); width: var(--hud-rail-w)` (44px) at `--z-rail` (104) — under the OS
layer, the burger overlay, the request dialog and the intro, which cover it with no
hide logic. The root takes no pointer events; only the marker buttons do. Inside it the fibre and
the nav are inset by half a marker (22px) at both ends, so every 44×44 button stays inside the
rail box: clear of the header above, and clear of the bottom 112px of the edge below (the rail
ends at 112px, the avatar box at 108px). A `max-width: 860px` `display: none` backs up HudChrome's
media gate.

**The fibre** (`aria-hidden`, `pointer-events: none`; a 12px column on the rail's centre line):

- **Core:** a 2px unlit line the whole rail long, `--neon-cyan` at 30%, fading out at both ends.
- **Thread:** a 2px line from `--neon-cyan` 30% at the top to full `--neon-cyan` at its leading
  end, `box-shadow: 0 0 8px var(--glow-cyan)`, drawn to scroll progress with
  `transform: scaleY(var(--rail-p))` (origin top).
- **Head:** an 18×4px streak (square, `border-radius: 0`) riding the thread's end, `--neon-cyan`
  35% → 100%, glowing `0 0 10px var(--glow-cyan), 0 0 3px var(--neon-cyan)`; moved with
  `translateY(var(--rail-p) × 100%)` over the rail less its own length.
- **Flow:** a 28px `--on-accent` streak that travels down the lit thread (0.9s) **only while the
  visitor scrolls** (`data-flowing`, dropped 180ms after the last scroll event).
- **Ticks:** one 8×8 **diamond** per section (a square rotated 45°, `border-radius: 0`): a 1px
  `--neon-cyan` edge over `--bg` ahead; filled `--neon-cyan` with a `--glow-cyan` glow once passed
  (`data-passed`). A downward scroll that passes a tick pulses it once, 0.7s: the diamond scales
  1.8 → 1 while a square ring expands 1 → 3.2 and fades (`data-pulse` swapped `a` ↔ `b`).

**The markers** (a real `<nav>`): 44×44 transparent `<button>`s centred on the ticks.

- **Current section** (`aria-current="true"`): a 10×2px `--neon-cyan` streak leading into the tick
  from the page side, at 85%; full, with a `--glow-cyan` glow, on hover or focus.
- **Label** on hover and `:focus-visible` only: to the left of the button, mono bold `--fs-xs`,
  uppercase, tracking .08em, `--txt` on `--glass-bg-solid` composited over `--bg` (≥15:1 in both
  themes), a 1px `--neon-cyan` edge, square corners, `--sh-md`, at most
  `min(420px, 100vw − 120px)` wide with an ellipsis. Hidden by `opacity: 0` and
  `clip-path: inset(50%)` — never `display: none` — so it stays the button's accessible name.
- **Focus ring:** `outline: 2px solid var(--txt); outline-offset: -2px`.

**Motion** (WCAG 2.2.2; transform-family and opacity only; keyframes in the module): the flow
streak only while scrolling, the one-shot tick pulse, and 0.15s fades on the current-section
streak and the label. All of it inside `prefers-reduced-motion: no-preference`: under reduce the
rail is static (no pulse is even requested). The thread and the head follow the scroll position
itself, which is the visitor's own movement.

**Never** a round dot, `backdrop-filter` or `filter` (the rail sits over the live WebGL canvas).

**Below 861px: the top bar is the fibre.** There is no rail on phones and tablets in portrait.
The existing 2px progress bar (`components/ui/ScrollProgress.tsx`, `[data-progress]`, unchanged;
`globals.css` only) becomes a thread that lights up towards its end:
`background: linear-gradient(90deg, transparent, var(--neon-cyan))`,
`box-shadow: 0 0 8px var(--glow-cyan)`, and an **18×2px head streak** (`::after`, `right: 0`,
`border-radius: 0`, solid `--neon-cyan`, the rail head's glow). From 861px the bar keeps its
blue → violet → cyan gradient, and it is hidden **only while a rail exists**
(`body:has([data-rail]) [data-progress] { display: none }`), so a visitor who has not armed the
HUD (or has it switched off) still has a progress indicator.

### Tailwind names

| Utility name | Token |
|--------------|-------|
| `bg-` / `text-` / `border-` … `neon-cyan` · `cyan-text` · `obsidian` · `on-obsidian` · `on-obsidian-mut` · `obsidian-neon` · `obsidian-line` | `--<same name>` |
| `shadow-neon-cyan` | `--neon-cyan-ring` |
| `z-(--z-rail)` · `z-(--z-os)` · `w-(--hud-rail-w)` · `bottom-(--hud-bottom)` … | arbitrary values, no theme key |

- **`shadow-neon-cyan` is the ring, not a shadow colour.** When a `--shadow-*` key and a
  `--color-*` key share a name, the shadow key wins (checked by compiling `app/tailwind.css`
  with Tailwind 4.3.3).
- A cyan shadow colour is written `shadow-(color:--neon-cyan)`.
- A theme key that no class uses emits no CSS: the built Tailwind chunk is byte-identical with
  and without these keys.
- `--glow-cyan` has no Tailwind name. Use it in an arbitrary value:
  `shadow-[0_0_8px_var(--glow-cyan)]`.
- The HUD parts themselves are CSS Modules (the rail's is), in lazy chunks and outside
  `@source`, so these names serve the Tailwind files (the first screen and the interior stage).

## Typography

| Role | Font | Usage |
|------|------|-------|
| Display | **Archivo** (weight 900, uppercase, tight tracking) | Big headings, hero title. Class `.disp`. |
| Display (Cyrillic) | **Montserrat** | Not chosen separately — it is the *second* family in `--font-display-stack`. Archivo has no Cyrillic glyphs, so the browser falls back per glyph and Russian headings stay in a heavy display face. |
| Mono | **JetBrains Mono** | Labels, tags, nav, code-style captions. Class `.mono`. |
| Body | **Manrope** | Paragraphs and general text. |

Load with `next/font/google` (`app/layout.tsx`), which binds each to a CSS variable; the
`--font-*-stack` tokens are what components actually reference. Preserve the uppercase +
letter-spacing treatment on mono labels (e.g. `/02  PRINCIPIILE NOASTRE`).

### Scale

Fixed UI text (nav, labels, buttons, captions) uses the scale. Headings that must grow with
the viewport keep using `clamp()` — the scale is not a reason to freeze a fluid heading.

```css
--fs-2xs: 9px;    --fs-xs: 11px;   --fs-sm: 12.5px;  --fs-md: 14px;
--fs-base: 16px;  --fs-lg: 20px;   --fs-xl: 26px;    --fs-2xl: 34px;

--fw-normal: 400; --fw-med: 500;   --fw-semi: 600;
--fw-bold: 700;   --fw-extra: 800; --fw-black: 900;
```

These are the sizes the site already rendered, named. The point is not a new rhythm — it is
that the next component cannot invent a `12.7px`.

## Layout

- Max content width: **1280px**, centered (`--maxw`).
- Section padding: `clamp(...)` responsive values (e.g. `clamp(56px,8vw,100px)`).
- Cards/grids are separated by 1px `--line` borders to get the "gridded panel" look.

### Spacing, radii, elevation

```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px; --sp-5: 24px;
--sp-6: 32px; --sp-7: 48px; --sp-8: 64px; --sp-9: 96px;

--r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px; --r-2xl: 34px; --r-pill: 999px;

--sh-sm: 0 2px 8px rgba(17,24,39,.06);
--sh-md: 0 8px 24px rgba(17,24,39,.1);
--sh-lg: 0 18px 44px rgba(17,24,39,.14);
```

A value that falls between two steps should get its own token or stay a commented literal —
**never round it to the nearest step**, which silently moves the design. See the global UI
rule in [07 — Conventions](./07-conventions.md).

## Signature effects (keep, but keep them CSS-driven)

- **Scroll reveal** — elements fade/slide in via `IntersectionObserver` (`[data-reveal]`).
- **Glow** — radial gradients + blurred layers behind the hero and contact sections.
- **HUD backdrop** (hero) — two key lights, the `cyber-grid` wall, a `cyber-floor` in
  perspective drifting towards the viewer, and a hairline scanner. All paused while the intro
  overlay is in the document, while the hero is scrolled off screen, and under reduced motion.
- **Neon and glass** — `cta-neon` buttons, glass header / dropdowns / stat cards / cookie
  banner (see [HUD layer](#hud-layer--the-first-screen)).
- **Marquee / hazard stripes** — the diagonal `--blue` striped bars (`.hz`) and the trust
  ticker under the hero (five identical groups, each ending in a slanted red neon hairline, so
  the loop has no seam).
- **The interior 3D stage** — the neon microprocessor (2026-09-17, replacing the glass Cybernetic
  Core) and the five service models behind Hero → Ticker → Directions, the cursor circuit trail
  behind a mouse or pen, static SVG art where WebGL is not used, holographic stat cards, pointer
  tilt, the project cards' CSS parallax ([The interior stage](#the-interior-stage)).
- **No decorative dots** (2026-09-17). The clock pip, the eyebrow's blinking dot, the stat-note
  pips, the ticker's round separators, the logo's halo and the estimator chat's status dot are
  gone. What stays: the "TBS." and title full stops as plain red glyphs (no glow), the footer's
  red ".", the dictation button's recording light (a privacy indicator), "✓" list markers and
  every "·" in copy. `decorative-dots.test.tsx` and the E2E scan keep them out.
- **Live clock** — `SYS_TIME 12:04:08 UTC+3` in the header (Chișinău time, real offset). The
  old top status bar is gone.
- **First-visit intro** — the laptop preloader (2026-09-20, replacing the glass ∞): a six-beat
  camera flight out of the processor and into the display, the first two beats always drawn as
  flat SVG ([05 — Page Sections](./05-page-sections.md)).

Keyframes to port from the prototype: `spin`, `floaty`, `pulse`, `riseIn`, `fadeIn`,
`orbit`, `scan`, `blink`, `marquee`. The Tailwind animations live in `app/tailwind.css` with a
`hud-` prefix (`hud-marquee`, `hud-grid-drift`, `hud-menu-in`, `hud-cookie-rise`, `hud-scan`,
`hud-holo-spin`, `hud-swap-in`), because `globals.css` already owns `spin`, `pulse` and `blink`.
`hud-blink` was removed with the decorative dots (2026-09-17). `hud-holo-spin` (18s) turns the
stat holograms; `hud-swap-in` (0.32s) brings a direction's copy in. `hud-parallax-media` is a
**top-level** keyframe, not in the animations `@theme` block: keyframes there are emitted only
when an `--animate-*` token naming them is used, and this one is referenced from the
`parallax-media` utility instead. So is `hud-glass-sweep` (1.1s, IT-OS Phase 2), referenced from
`entry-sweep`: one band of light crossing the Directions copy (`translateX` −100% → 100%, opacity
.12 → 0), played only under `[data-renderer="webgl"][data-entry="burst"]` with motion allowed
([Directions — the HUD screen](#directions--the-hud-screen)). The art's keyframes (`materialize`, `core-wave`, `core-packets`)
live in their own CSS Modules (see the gotcha below). All of them move `transform` or `opacity`
only, and the global reduced-motion switch stops them.

> **Gotcha — define keyframes in the module that uses them.** Next's CSS-Modules compiler
> (lightningcss) scopes `animation-name` references inside a `*.module.css`, rewriting e.g.
> `orbit` → `Component-module__xxx__orbit`. A keyframe defined only in `globals.css` then
> never matches and the animation **silently does nothing** (no error). So any `@keyframes`
> used by a module's `animation:` must live in that same `.module.css`. Global selectors in
> `globals.css` may keep using globals.css keyframes (same-file references are fine).
> `:global(name)` inside the `animation` shorthand does **not** work — lightningcss drops it.

> **Gotcha — write the prefixed declaration FIRST, or not at all.** Turbopack minifies CSS with
> Lightning CSS, which prefixes from Next's browserslist targets on its own. Given
> `backdrop-filter` **before** `-webkit-backdrop-filter`, it collapses the pair and keeps **only
> the prefixed line** — which Chromium does not support. That is exactly how the request
> dialog's scrim and the cookie banner shipped with `backdrop-filter: none` outside Safari
> (fixed 2026-09-16). So in hand-written CSS: `-webkit-backdrop-filter` then `backdrop-filter`
> (same for `mask-*`), or just the unprefixed property and let the build add the prefix. The
> built CSS's prefix counts (`-webkit-backdrop-filter`, `-webkit-mask`, `-webkit-` overall) are
> recorded in `CHANGELOG.md` and must not drop.

## Dark theme

The site ships **light and dark, and dark is the default**. The dark values live **once**, as
`--dark-*` on `:root` in `globals.css`; the two activation paths only *remap* the real tokens
onto them, so the palette cannot drift between them.

```css
--dark-bg:   #0a0b10;  --dark-bg2:    #06070b;  --dark-panel: #181e30;  --dark-panel2: #1f2639;
--dark-txt:  #f6f7fb;  --dark-mut:    #aeb8cb;  --dark-dim:   #94a1b9;
--dark-line: #2c354c;  --dark-line2:  #3b4664;  --dark-wash:  rgba(39,58,120,.55);
```

The page colour is the HUD's near-black — the same value as `--void` — with `--dark-bg2` one
step deeper so it still reads as "below" the page (until 2026-09-16: `#101422` / `#0b0e18`).
Every text pairing gained from it, computed with the WCAG formula:

| On `--dark-bg` | Before (`#101422`) | Now (`#0a0b10`) |
|----------------|--------------------|-----------------|
| `--dark-txt` | 17.13 | **18.36** |
| `--dark-mut` | 9.18 | **9.85** |
| `--dark-dim` | 7.04 | **7.54** |
| `--dark-blue-text` | 8.58 | **9.19** |
| `--dark-red-text` | 6.67 | **7.15** |
| `--red` (border / glow) | 4.38 | **4.69** |

Cards separate more clearly too (`--dark-panel` on the page 1.11 → 1.19). Across the four dark
surfaces the faintest text pairing is `--dark-red-text` on `--dark-panel2`, at 5.48:1.

Three states, deliberately:

| State | How it is expressed |
|-------|---------------------|
| Explicit choice | `data-theme="dark"` / `"light"` on `<html>`, from the `tbs_theme` cookie |
| No choice yet | **`data-theme="dark"`** — `DEFAULT_THEME` in `lib/theme/theme.ts`. The OS preference is deliberately not read |
| Persistence | cookie `tbs_theme`, 1 year — same shape as `tbs_locale` |

**Why a cookie and not `localStorage`:** the server reads it and stamps `data-theme` into the
HTML it sends, so every visitor gets the right palette in the **first byte**, with no flash and
with JavaScript off — a missing or junk cookie stamps the dark default. The inline script in
`<head>` stamps the same value again before first paint, as the guarantee that holds whatever
produced the HTML, and pins `color-scheme`; it **carries the CSP nonce** (`x-nonce`, minted in
`proxy.ts`), without which the strict policy blocks it. The `prefers-color-scheme` block left
in `globals.css` only matters for a document that arrives with no `data-theme` at all.

The root layout stamps **every** route, so `/admin-tbs-digital` is dark by default as well.

### What is NOT remapped, and why

`--ink*` is not a dark theme — it is the handful of blocks that invert *on purpose*. On dark
they lift **above** the surface (`#1d2540`) instead of sinking below it, or they would vanish
into the page.

`--green` and `--amber` get their own dark values: they are darkened for a light background
and fall under AA on `#181e30`. `--ice` and `--cyan` likewise. **`--blue` and `--red` are
deliberately left alone** — they are brand *fills* carrying `--on-accent` text, and lightening
them would weaken that pairing.

### Red as text — `--red-text`

`--red` is a **fill**. As *small* text it measured **3.96:1** on `--panel`, under the 4.5:1 AA
floor for text below 18.66px bold, on both themes. It is now split the same way `--green` and
`--amber` already were:

```css
--red-text:      #d41026;  /* light: 5.38:1 on --panel, 5.02:1 on --bg */
--dark-red-text: #ff6b7b;  /* dark:  6.03:1 on --panel, 6.67:1 on --bg */
```

Hue is held at 353–354° and saturation at the brand's 86%, so neither tone drifts toward brown
or pink — they are the same red, one step darker and one step lighter.

**Use `--red-text` for red text; keep `--red` for fills, borders, focus rings and
`aria-hidden` glyphs.** The binding constraint when picking the dark tone was the estimator's
summary tint (`color-mix(--green 8%, --panel2)`), measured live rather than derived — it is
what pushed the dark value one step lighter than `--red-lift`.

The same split now exists for the other two accents used as small text:

```css
--blue-text:  #2a56d6;  /* 6.18:1 on --panel — the fill --blue is 4.25:1 */
--green-text: #0b7a5a;  /* 5.32:1 on --panel — the fill --green is 3.21:1 */
```

On dark, `--green-text` simply points at `--dark-green` (already 8.92:1) rather than adding a
fourth near-identical green.

`Principles` shows why the split is per *role*, not per colour: its `--accent` tints a hover
**border** (a graphic — 3:1 is enough) while `--accent-text` colours a 12px/800 **number**.
Same hue, two thresholds, two tokens.

> **Measured contrast of every fill, as text on `--panel`** — none of them passes:
> `--red` 4.19 · `--blue` 4.25 · `--green` **3.21** · `--amber` 3.77 · `--cyan` 3.56 ·
> `--mint` ≈2.4 · `--star` ≈1.6.
>
> **Still open:** `--amber` is text in `Partners.module.css`, and `--cyan` is still text in the
> legal pages (`LegalDoc.module.css`), most of the admin panel and the section index labels in
> `globals.css`. Both want the same `*-text` treatment. The header and the cookie banner no
> longer use `--cyan` as text since their 2026-09-16 rewrite (the clock label is
> `--blue-text`), and the status bar is gone. As **focus rings, borders and icons** `--cyan` is
> fine: those are graphics, and 3.56:1 clears the 3:1 bar.
>
> This file previously claimed `--green` and `--amber` were "darkened enough to clear AA as
> text". They were not — the numbers above are measured, not derived.

## Accessibility / responsiveness notes

- Respect `prefers-reduced-motion` for the reveal/orbit/marquee animations.
- All sizes use `clamp()`/relative units; verify the mobile menu and single-column
  collapse at small widths.

## Breakpoints

For **new** code: **640px** (phone), **860px** (nav burger / tablet), **1024px** (small
desktop). CSS cannot read a custom property inside a media query, so these are an agreed set,
not tokens.

Existing modules also carry 560px, 760px, 820px and 900px thresholds. Leave them: a
breakpoint is a layout decision that was reviewed, and re-aligning one to "look tidy" moves a
design nobody asked to move.

**Tailwind breakpoints** (the eight Tailwind files) are `min-width` steps that are the
**exact complement** of the modules' `max-width` queries, so `max-md:` means precisely the
`max-width: 860px` burger range:

| Tailwind | `min-width` | Complement of | Used for |
|----------|-------------|---------------|----------|
| `xs:` | 401px | `max-width: 400px` | hero CTAs and cookie buttons side by side |
| `sm:` | 641px | `max-width: 640px` | phone → tablet; the cookie card; the bar clock |
| `md:` | 861px | `max-width: 860px` | burger → desktop nav; blur on glass; two-column hero |
| `lg:` | 1025px | `max-width: 1024px` | small desktop; the bar clock returns |
| `xl:` | 1180px | — | room for the full `SYS_TIME` label in the header |

Two arbitrary thresholds exist on purpose: `max-[901px]:` in Work (≤900px, the two-column grid
the old module had) and `max-[360px]:` in the Directions height floors (a measured band).

## Tailwind theme mapping

`app/tailwind.css` removes Tailwind's default colours, fonts, type sizes, weights, radii,
shadows, animations and breakpoints (`--color-*: initial`, …) and maps its names onto the
tokens with `@theme inline` — so a utility emits `var(--token)` itself and follows the dark
remap, and a raw palette value such as `bg-red-500` does not exist. What is kept: the numeric
spacing scale, rebased on `--sp-1` (so `min-h-11` is the 44px tap target), and the `--blur-*`
scale.

| Utility family | Names | Token |
|----------------|-------|-------|
| Colours (`bg-*`, `text-*`, `border-*`, …) | `bg` `bg2` `panel` `panel2` `line` `line2` `txt` `mut` `dim` `red` `red-text` `red-lift` `blue` `blue2` `blue-text` `cyan` `ice` `green-text` `on-accent` `ink` `on-ink` `void` | `--<same name>` |
| | `glass` · `glass-solid` · `glass-line` | `--glass-bg` · `--glass-bg-solid` · `--glass-line` |
| | `neon-cyan` `cyan-text` `obsidian` `on-obsidian` `on-obsidian-mut` `obsidian-neon` `obsidian-line` (2026-09-17, [Cyber Dark / Neon Cyan / Obsidian Black](#cyber-dark--neon-cyan--obsidian-black)) | `--<same name>` |
| Font family | `font-disp` · `font-hud` · `font-copy` | `--font-display-stack` · `--font-mono-stack` · `--font-body-stack` |
| Font size | `text-2xs` … `text-2xl` (`2xs xs sm md base lg xl 2xl`) | `--fs-*` (no line-height: add `leading-*`) |
| Font weight | `font-normal` `font-medium` `font-semibold` `font-bold` `font-extrabold` `font-black` | `--fw-normal` `--fw-med` `--fw-semi` `--fw-bold` `--fw-extra` `--fw-black` |
| Radius | `rounded-sm` … `rounded-2xl`, `rounded-pill` | `--r-*` |
| Shadow | `shadow-sm/md/lg` · `shadow-neon-red` · `shadow-neon-red-strong` · `shadow-neon-blue` · `shadow-neon-cyan` | `--sh-*` · `--neon-*` · `--neon-cyan-ring` (the ring, not a shadow colour: the `--shadow-*` key wins over `--color-neon-cyan`) |
| Spacing | `p-4`, `gap-3`, `min-h-11`, … | `calc(var(--sp-1) * n)` |
| Custom utilities | `glass` · `glass-text` · `cta-neon` · `cyber-grid` · `cyber-floor` · `edge-fade-x` · `fade-b` | see [HUD layer](#hud-layer--the-first-screen) |
| | `fade-radial` (radial mask, the services screen's grid) · `h-scene` (`100lvh` − `--header-h`, with a `100vh` fallback line; the stage's sticky layer) · `view-work` (names the Work section's view timeline `--work-view`) · `parallax-media` (plays `hud-parallax-media` on it, gated by `@supports (animation-timeline: view())` and motion allowed) | see [The interior stage](#the-interior-stage) |
| | `entry-glow` (the Directions panel's accent edge: under `[data-renderer="webgl"][data-entry="formed"]`, static on the `fallback` / `off` renderers, never `pending`) · `entry-sweep` (its copy column's `::after` band: `hud-glass-sweep` under `[data-renderer="webgl"][data-entry="burst"]`, motion allowed) | see [Directions — the HUD screen](#directions--the-hud-screen) |
| Variant | `menu-open:` | a desktop dropdown is open: real hover (`(hover: hover)`), `focus-within`, or `[data-open]` (first touch tap) — never with `[data-dismissed]` (Escape) |

Tokens without a Tailwind name are still reachable as arbitrary values —
`z-(--z-header)`, `px-(--gutter)`, `max-w-(--maxw)`, `bg-[radial-gradient(…,var(--hero-glow-red),…)]`.
The Tailwind key never shares its name with the token it points at (`--font-hud`, not
`--font-mono`: the `--font-mono` / `--font-display` names belong to next/font on `<html>`).
The rules for writing these classes are in [07 — Conventions](./07-conventions.md#tailwind-first-screen-and-interior-stage-files-only).

Next auto-injects `width=device-width, initial-scale=1`, so no viewport meta is defined by
hand.

- **Overflow-safe grids.** Every `auto-fit` grid uses
  `repeat(auto-fit, minmax(min(100%, N), 1fr))`. The `min(100%, N)` lets a track
  shrink below its `N` floor on narrow phones instead of forcing horizontal overflow
  (which `body { overflow-x: hidden }` would otherwise silently clip).
- **Scroll bands on phones.** Below 641px the Work grid and the Directions pill row are
  scroll-snap bands that scroll inside themselves (the page never scrolls sideways, and a
  swipe off the end does not chain to the page), with **no** auto-advance. The older
  auto-rolling carousel below is the **`components/ui/useAutoCarousel.ts`** hook, used by
  `Services.tsx`, which no page renders today:
  - auto-advances one card every **2s**; **only starts once the track is first
    scrolled into view** (IntersectionObserver) — it never rolls a section the user
    hasn't reached;
  - a manual slide (touch, mouse-drag **or** trackpad/`wheel`) pauses it and it
    resumes **5s** after the slide settles, continuing from the current card;
  - reveals every slide up front (a horizontal scroller never intersects the viewport,
    so the normal scroll-reveal would leave off-screen cards hidden);
  - fully **off on desktop and under `prefers-reduced-motion`**, and paused while the
    tab is hidden.
- **No orphaned cells.** Odd-count grids are pinned to 2 columns on mobile and the lone
  last item spans the full width: `/02` principles (`.cell:last-child { grid-column: 1 / -1 }`)
  and the footer partner chips (`.partner:last-child:nth-child(odd)`).
- **Placeholder stat boxes.** The blank `/02` stats use `:empty` to show a subtle dashed
  "to-be-filled" skeleton (faint number + label bars) instead of reading as broken empty
  boxes; a filled stat (has children) is unaffected.
