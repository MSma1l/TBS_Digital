# 02 — Tech Stack

## Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js (React)** | App Router. SSR/SSG gives us SEO for a marketing site. |
| Language | **TypeScript** | Type safety for components and placeholder data shapes. |
| Styling | **CSS variables + CSS Modules** (or global CSS) | The prototype already ships a clean design-token system built on CSS custom properties — we keep it. See [04 — Design System](./04-design-system.md). |
| Fonts | Google Fonts: **Archivo**, **JetBrains Mono**, **Manrope** | Loaded via `next/font`. |
| Animations | Plain CSS + a small `IntersectionObserver` hook | Scroll-reveal, marquee, glow, HUD tilt — all doable without a heavy animation library. |

## Backend (separate, not in this repo)

| Layer | Choice |
|-------|--------|
| Framework | **Python + FastAPI** |
| Owner | Colleague |
| Status | Not integrated in the current phase — the UI makes no calls to it. |

## Why this stack

- **Next.js** was chosen over a plain SPA/Astro because we want one React ecosystem that
  can host both the marketing page and a future interactive admin page, with SSR for SEO.
- **FastAPI** is fixed by the team; it will expose a JSON API the admin page consumes later.
- **Keeping the prototype's CSS tokens** avoids re-deriving the design and keeps the rebuilt
  UI pixel-close to the approved design.

## Explicitly not used (yet)

- No data-fetching libraries (React Query, SWR, `fetch` to the API) — UI-only phase.
- No component/UI kit (MUI, Chakra) — the design is bespoke; we hand-build components.
- No state-management library — local component state is enough for this phase.
