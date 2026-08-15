# 02 — Tech Stack

## Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js (React)** | App Router. SSR/SSG gives us SEO for a marketing site. |
| Language | **TypeScript** | Type safety for components and placeholder data shapes. |
| Styling | **CSS variables + CSS Modules** (or global CSS) | The prototype already ships a clean design-token system built on CSS custom properties — we keep it. See [04 — Design System](./04-design-system.md). |
| Fonts | Google Fonts: **Archivo**, **Montserrat**, **JetBrains Mono**, **Manrope** | Loaded via `next/font`. Montserrat backs Archivo for Cyrillic headings — see [16 — i18n & SEO](./16-i18n-seo.md). |
| Animations | Plain CSS + a small `IntersectionObserver` hook | Scroll-reveal, marquee, glow, HUD tilt — all doable without a heavy animation library. |
| Content/state | **React Context** (`lib/siteContent.tsx`) over the API | Loads `GET /api/content`; `localStorage` is only an offline cache/fallback. See [09 — Admin Panel](./09-admin.md). |
| i18n | **Hand-rolled catalogs + Context** (`lib/i18n/`) | RO/RU/EN, no i18n library: ~190 keys typed off the Romanian catalog, locale resolved server-side. See [16](./16-i18n-seo.md). |
| Request layer | **Next 16 Proxy** (`proxy.ts`, the renamed Middleware) | Per-request CSP nonce + the `x-locale`/`x-pathname` headers the root layout needs. |

## Backend (in `backend/`, wired to the UI)

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Python + FastAPI** + Uvicorn | Content + contact + auth API. See [10 — Backend](./10-backend.md). |
| Schemas / config | **Pydantic v2** / pydantic-settings | Schemas mirror the frontend `SiteData`; validators enforce security ([11](./11-security.md)). |
| ORM / DB | **SQLModel / SQLAlchemy 2** | Real database — SQLite (dev) / Postgres (prod) via `DATABASE_URL`, behind the `ContentStore` interface. |
| Auth | **PyJWT + bcrypt** | DB users, hashed passwords, JWT-guarded write routes. |
| Images | **Pillow** | Uploads are re-encoded to WebP (strips EXIF, blocks polyglots/decompression bombs). |
| Bot | **httpx** long-polling worker | Telegram lead notifications ([13](./13-telegram.md)). |
| Deploy | **Docker Compose + Makefile** | frontend + backend + Postgres, one command ([12](./12-deployment.md)). |
| Status | Built, tested, **and called by the UI**. See [14 — Testing](./14-testing.md) for the current counts. | |

## Why this stack

- **Next.js** was chosen over a plain SPA/Astro because we want one React ecosystem that
  can host both the marketing page and a future interactive admin page, with SSR for SEO.
- **FastAPI** is fixed by the team; it will expose a JSON API the admin page consumes later.
- **Keeping the prototype's CSS tokens** avoids re-deriving the design and keeps the rebuilt
  UI pixel-close to the approved design.

## Explicitly not used

- No data-fetching library (React Query, SWR) — a small typed client (`lib/api.ts`) over
  `fetch` covers the handful of endpoints we call.
- No i18n library (next-intl, i18next) — three languages and one page don't justify it; the
  catalogs are plain typed records.
- No component/UI kit (MUI, Chakra) — the design is bespoke; we hand-build components.
- No state-management library — React Context + local state is enough.
