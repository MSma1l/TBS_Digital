# 03 — Architecture

## Principle

The landing page is one route composed of independent **section components**. Each section
is presentational and receives its content from **local placeholder data** (a typed constant
in the repo), never from the network. This keeps the door open to later swap the placeholder
source for an API response without touching the markup.

## Proposed folder structure

```
/
├─ app/
│  ├─ layout.tsx           # Root layout: fonts, <html>, global CSS, top status bar
│  ├─ page.tsx             # Landing page — composes the section components in order
│  └─ globals.css          # Design tokens (CSS variables) + base styles + keyframes
│
├─ components/
│  ├─ layout/
│  │  ├─ StatusBar.tsx     # Top "SYS_TIME / ACCESS GRANTED" bar (with live clock)
│  │  ├─ Navbar.tsx        # Sticky nav + mobile menu
│  │  └─ Footer.tsx        # Footer + partners + "ACCESS GRANTED" marquee
│  ├─ sections/
│  │  ├─ Hero.tsx
│  │  ├─ Principles.tsx    # /02 principles grid + stats row (stats = placeholders)
│  │  ├─ Services.tsx      # /03 service cards
│  │  ├─ Work.tsx          # /04 portfolio (placeholder cards)
│  │  ├─ Team.tsx          # /05 team (placeholder cards) + system-status panel
│  │  └─ Estimator.tsx     # /06 price estimator + contact form (prices = "...")
│  └─ ui/                  # Small shared pieces (SectionLabel, MonoTag, RevealOnScroll…)
│
├─ lib/
│  └─ content.ts           # Typed placeholder data for every section (single source)
│
├─ hooks/
│  └─ useReveal.ts         # IntersectionObserver scroll-reveal hook
│
├─ public/                 # Static assets
└─ docs/                   # This documentation
```

> Structure is a starting point — adjust names as the build proceeds, but keep the
> **section-per-component** and **content-in-`lib/content.ts`** boundaries.

## Routing

- `/` — the landing page (all sections). This is the only page in this phase.
- `/admin` — **reserved** for the future admin page. Not built now; noted so nobody
  repurposes the path. See [08 — Roadmap](./08-roadmap.md).

## Data flow (this phase)

```
lib/content.ts  ──►  section component  ──►  rendered UI
   (placeholder constants, typed)
```

No `fetch`, no server actions hitting the API, no environment-based API URLs yet. When the
backend arrives, only the source feeding each section changes — see [07 — Conventions](./07-conventions.md).
