# 02 — Tech Stack

## Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js (React)** | App Router. SSR/SSG gives us SEO for a marketing site. |
| Language | **TypeScript** | Type safety for components and placeholder data shapes. |
| Styling | **CSS variables + CSS Modules** (or global CSS) | The prototype already ships a clean design-token system built on CSS custom properties — we keep it. See [04 — Design System](./04-design-system.md). |
| Fonts | Google Fonts: **Archivo**, **JetBrains Mono**, **Manrope** | Loaded via `next/font`. |
| Animations | Plain CSS + a small `IntersectionObserver` hook | Scroll-reveal, marquee, glow, HUD tilt — all doable without a heavy animation library. |
| Content/state | **React Context + `localStorage`** (`lib/siteContent.tsx`) | Client-side store for admin-editable content. No backend — localStorage stands in for the future API. See [09 — Admin Panel](./09-admin.md). |

## Backend (in `backend/`, wired to the UI)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Python + FastAPI** + Uvicorn | Content + contact + auth API. See [10 — Backend](./10-backend.md). |
| Schemas / config | **Pydantic v2** / pydantic-settings | Schemas mirror the frontend `SiteData`; validators enforce security ([11](./11-security.md)). |
| ORM / DB | **SQLModel / SQLAlchemy 2** | Real database — SQLite (dev) / Postgres (prod) via `DATABASE_URL`, behind the `ContentStore` interface. |
| Auth | **PyJWT + bcrypt** | DB users, hashed passwords, JWT-guarded write routes. |
| Deploy | **Docker Compose + Makefile** | frontend + backend + Postgres, one command ([12](./12-deployment.md)). |
| Status | Built, tested (20 tests), **and called by the UI**. | |

## Why this stack

- **Next.js** was chosen over a plain SPA/Astro because we want one React ecosystem that
  can host both the marketing page and a future interactive admin page, with SSR for SEO.
- **FastAPI** is fixed by the team; it will expose a JSON API the admin page consumes later.
- **Keeping the prototype's CSS tokens** avoids re-deriving the design and keeps the rebuilt
  UI pixel-close to the approved design.

## Explicitly not used (yet)

- No data-fetching libraries (React Query, SWR, `fetch` to the API) — UI-only phase.
- No component/UI kit (MUI, Chakra) — the design is bespoke; we hand-build components.
- No state-management library — React Context + local state is enough for this phase.
