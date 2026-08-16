# 04 — Design System

Keep these tokens as CSS variables in `globals.css` and reference them everywhere — do not
hardcode raw hex values in components.

> **`app/globals.css` is the source of truth.** The values below are a description of it, and
> a description can go stale — this section did exactly that once, documenting a dark palette
> for months after the site had gone light. If the two disagree, the CSS is right and this
> file is the bug.

## Colors

The site is **light**: a cool, airy scale where each surface step is a real elevation, so a
card reads as a distinct surface against the page. The hue leans very slightly blue, which is
what stops large white panels from looking grey next to `--bg`. Blue leads the accent range,
which is warm-inclusive — `--amber` is a rich gold and `--coral` is a warm ember.

```css
:root {
  /* surfaces */
  --bg:     #eef1f7;
  --bg2:    #e6eaf2;
  --panel:  #ffffff;
  --panel2: #f4f6fb;

  /* scrim — stays near-black on purpose: it sits over bright partner/project
     screenshots and is what keeps white-on-transparent logos readable. It is NOT
     part of the light scale and must not be "lifted" to match it. */
  --scrim: 15, 12, 22;   /* raw rgb triplet, for rgba(var(--scrim), a) */

  --line:  rgba(23,28,48,.12);
  --line2: rgba(23,28,48,.2);

  --txt:   #11141c;   /* primary text */
  --mut:   #4d5361;   /* body text    */
  --dim:   #666c7b;   /* mono labels  */

  /* accents */
  --red:     #f5333f;
  --green:   #12a37a;
  --blue:    #2f6bef;  /* fill — white text sits on it */
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
```

### Contrast — the constraint that shapes the whole palette
Lifting a background *lowers* contrast, so the text tones were re-tuned along with it. As
measured: **every text token clears WCAG AA 4.5:1 on every surface** — the faintest pairing
in the palette is `--dim` on `--panel2` at **4.94:1**. White on the two fill colours is
**4.79:1** (`--blue`) and **4.97:1** (`--violet2`).

**The SectionCTA button** (`components/ui/SectionCTA.module.css`) paints dark text
(`color: var(--bg)`) on the accent fill (`background: var(--h)`, rotating cyan/violet/
amber/blue2). All four accents are light enough that dark-on-accent clears AA — the tightest
is `--blue2` at **7.8:1** — so the button keeps dark text on every hue; none needs white.
`--coral` is decorative only (glows/gradients), so it carries no text-contrast requirement.

Two rules follow, and both have already been violated once:
- **Never dim a token with `opacity`.** `--dim` is already the faintest tone that clears
  AA; multiplying it by 0.6 (as `.utc` in the status bar did) pushes it under. Something
  reads as secondary because of what it sits *next to*, not because it is washed out.
- **A control on top of a screenshot needs its own plate.** The gallery dots sit over
  images that may be light or dark, so they carry a dark `box-shadow` ring under a brighter
  tick rather than relying on the page background.

### Where the hues go
The accents are not decoration-by-random — they rotate on a fixed four-step cycle
(cyan → violet → amber → blue) so the page reads as one system:
- **Section index labels** (`/02`, `/03`, …) — keyed off the section id in `globals.css`.
- **Project cards** — each card gets a `--h` hue driving its category chip, its active
  gallery dot, and its hover border/glow.
- **Footer partner chips** — the same rotation on hover.
- **Principles, service icons, stat bars** — the same cycle.

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
- **Starfield / grid overlay** — layered radial + linear-gradient backgrounds in the hero.
- **HUD emblem** — rotating rings + orbiting dots; tilts on scroll/mouse.
- **Marquee / hazard stripes** — the diagonal `--blue` striped bars (`.hz`) and
  "> ACCESS GRANTED_" ticker.
- **Live clock** — `SYS_TIME` in the top status bar.

Keyframes to port from the prototype: `spin`, `floaty`, `pulse`, `riseIn`, `fadeIn`,
`orbit`, `scan`, `blink`, `marquee`.

> **Gotcha — define keyframes in the module that uses them.** Next's CSS-Modules compiler
> (lightningcss) scopes `animation-name` references inside a `*.module.css`, rewriting e.g.
> `orbit` → `Component-module__xxx__orbit`. A keyframe defined only in `globals.css` then
> never matches and the animation **silently does nothing** (no error). So any `@keyframes`
> used by a module's `animation:` must live in that same `.module.css`. Global selectors in
> `globals.css` may keep using globals.css keyframes (same-file references are fine).
> `:global(name)` inside the `animation` shorthand does **not** work — lightningcss drops it.

## Accessibility / responsiveness notes

- The design is **light-only today**. A dark theme is planned but **not built**: there is no
  toggle, no `data-theme`, and no second token set — the `:root` block above is the only one.
  (Anything you find claiming otherwise, including the old "dark-only by intent" line that
  used to sit here, was left over from the pre-light palette.) The `--ink*` scale is *not* a
  dark theme; it is a handful of blocks that invert on purpose inside a light page.
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

Next auto-injects `width=device-width, initial-scale=1`, so no viewport meta is defined by
hand.

- **Overflow-safe grids.** Every `auto-fit` grid uses
  `repeat(auto-fit, minmax(min(100%, N), 1fr))`. The `min(100%, N)` lets a track
  shrink below its `N` floor on narrow phones instead of forcing horizontal overflow
  (which `body { overflow-x: hidden }` would otherwise silently clip).
- **Section carousels.** `/03 Servicii` and `/04 Proiecte` turn their card grid into a
  horizontal **scroll-snap carousel** below 640px (peeks the next card, full-bleed,
  hidden scrollbar, `← GLISEAZĂ →` hint). Behaviour is driven by the shared
  **`components/ui/useAutoCarousel.ts`** hook:
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
