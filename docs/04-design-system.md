# 04 — Design System

These tokens are taken directly from the approved prototype. Keep them as CSS variables in
`globals.css` and reference them everywhere — do not hardcode raw hex values in components.

## Colors

```css
:root {
  --bg:    #04060e;   /* page background            */
  --bg2:   #060a16;   /* alternate section bg       */
  --panel: #0a1020;   /* card / panel background    */
  --panel2:#0c1426;   /* raised panel / hover       */

  --line:  rgba(120,150,255,.16);  /* hairline borders        */
  --line2: rgba(120,150,255,.28);  /* stronger borders        */

  --txt:   #eef3ff;   /* primary text              */
  --mut:   #8595bd;   /* muted / body text         */
  --dim:   #5b688f;   /* dim / mono labels         */

  --blue:  #2f6bff;   /* primary accent            */
  --blue2: #4d82ff;   /* lighter accent            */
  --ice:   #9cc0ff;   /* pale blue text            */
  --cyan:  #38bdf8;   /* highlight / active        */
  --glow:  rgba(47,107,255,.55);   /* glow shadows */
}
```

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
