# 04 — Design System

Keep these tokens as CSS variables in `globals.css` and reference them everywhere — do not
hardcode raw hex values in components.

## Colors

The original prototype was blue-on-near-black: one hue, and a background so dark that the
panels were indistinguishable from the page. The palette was lifted out of black into a
deep slate-navy — each surface step is a real elevation, so a card now reads as a card —
and widened from one accent to four.

```css
:root {
  /* surfaces — deep slate-navy, not black. bg → panel is ~2.2x luminance. */
  --bg:     #0d1426;
  --bg2:    #111a30;
  --panel:  #18213c;
  --panel2: #212c4e;

  /* scrim — stays near-black on purpose: it sits over bright partner/project
     screenshots and is what keeps the white-on-transparent logos readable. */
  --scrim: 8, 12, 24;   /* raw rgb triplet, for rgba(var(--scrim), a) */

  --line:  rgba(140,165,255,.22);
  --line2: rgba(140,165,255,.38);

  --txt:   #eef3ff;   /* primary text            */
  --mut:   #a3b2d6;   /* body text               */
  --dim:   #8695bd;   /* mono labels             */

  /* accents: blue leads, cyan/violet/amber widen the range */
  --blue:    #2b64f5;  /* fill — white text sits on it */
  --blue2:   #6b96ff;
  --ice:     #a9c6ff;
  --cyan:    #3fc8f5;
  --violet:  #b192fb;
  --violet2: #7a52e8;  /* fill — white text sits on it */
  --amber:   #f2b071;
}
```

### Contrast — the constraint that shapes the whole palette
Lifting a background *lowers* contrast, so the text tones were re-tuned along with it. As
measured: **every text token clears WCAG AA 4.5:1 on every surface** — the faintest pairing
in the palette is `--dim` on `--panel2` at **4.59:1**. White on the two fill colours is
4.95:1 (`--blue`) and 5.00:1 (`--violet2`).

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
| Mono | **JetBrains Mono** | Labels, tags, nav, code-style captions. Class `.mono`. |
| Body | **Manrope** | Paragraphs and general text. |

Load with `next/font/google`. Preserve the uppercase + letter-spacing treatment on mono
labels (e.g. `/02  PRINCIPIILE NOASTRE`).

## Layout

- Max content width: **1280px**, centered.
- Section padding: `clamp(...)` responsive values (e.g. `clamp(56px,8vw,100px)`).
- Cards/grids are separated by 1px `--line` borders to get the "gridded panel" look.

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

- The design is dark-only by intent.
- Respect `prefers-reduced-motion` for the reveal/orbit/marquee animations.
- All sizes use `clamp()`/relative units; verify the mobile menu and single-column
  collapse at small widths.

## Mobile (≤ 640px)

The single mobile breakpoint is **`max-width: 640px`** (the navbar burger switches at
860px). Next auto-injects `width=device-width, initial-scale=1`, so no viewport meta
is defined by hand.

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
