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

## Accessibility / responsiveness notes

- The design is dark-only by intent.
- Respect `prefers-reduced-motion` for the reveal/orbit/marquee animations.
- All sizes use `clamp()`/relative units; verify the mobile menu and single-column
  collapse at small widths.
