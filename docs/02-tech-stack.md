# 02 — Tech Stack

## Frontend

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 16.2.10 (React 19.2.4)** | App Router, Turbopack builds. SSR/SSG gives us SEO for a marketing site. |
| Language | **TypeScript** | Type safety for components and placeholder data shapes. |
| Styling | **CSS variables + CSS Modules** (or global CSS) | The prototype already ships a clean design-token system built on CSS custom properties — we keep it. See [04 — Design System](./04-design-system.md). |
| Styling (first screen + interior stage) | **Tailwind CSS v4**, utilities only, **no preflight** | Used by exactly eight files — `Navbar`, `HeaderClock`, `Hero`, `Ticker`, `Directions`, `Work`, `SceneStage`, `CookieConsent` — with its theme mapped onto the same tokens. Details below and in [07 — Conventions](./07-conventions.md#tailwind-first-screen-and-interior-stage-files-only). |
| Fonts | Google Fonts: **Archivo**, **Montserrat**, **JetBrains Mono**, **Manrope** | Loaded via `next/font`. Montserrat backs Archivo for Cyrillic headings — see [16 — i18n & SEO](./16-i18n-seo.md). |
| Animations | Plain CSS + a small `IntersectionObserver` hook | Scroll-reveal, marquee, glow, the HUD backdrop, the art's one-shot entrances, the stat holograms (CSS 3D), and the project screenshots' parallax (a CSS scroll-driven animation, no JavaScript) — all doable without a heavy animation library. The exception is the Work stage's scroll measuring (next row). |
| Work scroll | **GSAP** + `@gsap/react` + **ScrollTrigger** | The Work stage's director (`components/scene/SceneDirector.tsx`): ScrollTrigger **measures** the scroll spans the helix reads. Loaded lazily, only once Work is near and the gates pass; a visitor who never reaches Work, or has no capable GPU, never downloads GSAP. |
| 3D | **three.js** + **@react-three/fiber 9** | Only Work's DNA helix (`#lucrari`, `components/scene/`), behind one lazy entry (`components/three/runtime.tsx`, one chunk). Nothing is requested until Work is within one viewport, then only after a capability probe; every other path keeps the flat card grid. |
| Art | **Static inline SVG** (`components/art/`) | The hero chip (`HeroCoreArt`) and one drawing per direction (`ServiceArt`). Since 2026-10-28 the hero, ticker and directions draw no WebGL; see [CHANGELOG](../CHANGELOG.md). |
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

## The first-screen stack (HUD redesign, 2026-09-16)

The home page's first screen — the header, the hero, the ticker and the cookie banner — added
the only libraries the frontend has beyond Next/React. Since 2026-10-28 three.js, R3F and GSAP
are used **only by Work's helix** (the intro and the first screen's WebGL went that day — see
[CHANGELOG](../CHANGELOG.md)); the packages and the lockfile are unchanged.

| Package | Version | Licence | Used by |
|---------|---------|---------|---------|
| `three` | **0.186.0** (exact) | MIT | `components/three/*` (shared helpers), `components/scene/three/**`, `SceneCanvas.tsx`, `SceneWorld.tsx` |
| `@react-three/fiber` | **9.7.0** (exact) | MIT | the same scene components (peers: `react`/`react-dom` `>=19 <19.3`) |
| `gsap` | **3.15.0** (exact) | GSAP Standard "no charge" | `components/scene/SceneDirector.tsx` with the **ScrollTrigger** plugin that ships inside this package (`gsap/ScrollTrigger`) |
| `@gsap/react` | **2.1.2** (exact) | GSAP Standard "no charge" | `SceneDirector.tsx` (`useGSAP`, context revert on unmount) |
| `tailwindcss`, `@tailwindcss/postcss` | ^4.3.3 (dev) | MIT | `app/tailwind.css`, `postcss.config.mjs` |
| `@types/three` | ~0.186.0 (dev) | MIT | types only, held to three's minor |

**Why exact pins at runtime.** The scene leans on library internals that a minor bump can move:
`components/three/renderer.ts` works around how R3F 9.7 creates and releases its renderer, and the
director's smooth-scroll guard and its quiet/wake switch rely on gsap 3.15.0's `ScrollTrigger`
internals (`components/scene/scrollGuard.ts`). Upgrade any of them on purpose, and re-check the
helix when you do — the forced-WebGL E2E specs (`@webgl`) and `scroll-guard.test.ts` are the
tripwires.

**GSAP licence.** GSAP ships under the GSAP Standard "no charge" licence
(<https://gsap.com/standard-license>, also named in `node_modules/gsap/README.md`). It is
**not** an OSI open-source licence, but it allows free use on a commercial website like this
one. Re-read it on every GSAP upgrade.

**Why Tailwind, and why only utilities.** The client asked for the first screen in Tailwind, and
the interior redesign (2026-09-17) moved the two sections it restyled — Directions and Work — and
the stage shell onto it; the rest of the site stays on CSS Modules. `app/tailwind.css` imports only `theme.css` and
`utilities.css` — never the `tailwindcss` index, whose preflight reset would restyle every
button and heading on pages nobody asked to change. Its default palette, type scale, radii,
shadows and breakpoints are removed and re-pointed at our tokens, so a raw `bg-red-500` simply
does not exist. It is imported from `app/(site)/layout.tsx`, so the admin route never loads it.
Vendor prefixing is not configured in PostCSS: under Turbopack, Lightning CSS prefixes from
Next's browserslist targets whether a PostCSS config exists or not.

**Why R3F.** It mounts and disposes the scene with the React tree the stage already owns, and
`useFrame` drives continuous motion without React state. Everything imperative (geometry,
materials, per-frame writes, the FPS governor) is plain TypeScript: `components/scene/three/` for
the helix, `components/three/` for the generic helpers.

## The interior stage (2026-09-17, pruned to Work 2026-10-28) — no new dependency

The interior redesign (the 3D stage, the holographic stat cards, the Directions and Work rewrites)
added **no package**: `package.json` and the lockfile are unchanged. Since 2026-10-28 the stage
wraps **Work alone** and draws only its DNA helix; hero, ticker and directions are static SVG. What
it uses differently:

- **Lazy by distance.** The stage requests nothing — no GPU probe, no three/R3F chunk, no GSAP
  chunk, no WebGL context — until Work is within one viewport (an IntersectionObserver,
  `SCENE_NEAR_ROOT_MARGIN` in `lib/scene.ts`). Measured on the 2026-10-28 build: the homepage's 16
  initial chunks (~268 KB gzip) carry no three.js and no GSAP; the lazy three + scene chunk is
  ~945 KB raw / ~253 KB gzip (~294 KB gzip before the scene was pruned), the GSAP chunk ~46 KB
  gzip.
- **ScrollTrigger**, from the pinned `gsap` package, loaded only with the WebGL scene
  (`components/scene/SceneDirector.tsx`). It is a **measuring instrument**, not an animation
  driver: animation-free triggers on Work's track give the scroll spans the helix reads against
  `window.scrollY` every frame, and its refresh re-reads the boxes. A scrub driving the scene would
  lag the page by a frame; reading the spans does not. Pinning, snapping, `normalizeScroll`,
  ScrollSmoother, markers, a custom scroller and `lagSmoothing` are never used (ESLint and
  `scene-contract.test.ts`); the rules are in [07 — Conventions](./07-conventions.md#gsap-and-scrolltrigger).
- **A CSS scroll-driven animation** for the project screenshots' parallax (`view-work` /
  `parallax-media` in `app/tailwind.css`): on the compositor, no JavaScript, and simply still
  where `animation-timeline` is unsupported (Firefox) or motion is reduced. Inside the helix's
  spiral it is held at a value the driver writes per card instead of played: a running animation
  is a compositor layer per card, and those layers were what braked a hard scroll there
  ([05](./05-page-sections.md#work)).
- **One three.js chunk.** The scene is reached only through a dynamic `import()` of
  `components/three/runtime.tsx`. Turbopack builds a chunk group per `import()` target, so two
  targets had once shipped two byte-identical copies of three + R3F; one target means one chunk.
- **Static SVG art** in `components/art/` (`HeroCoreArt`, `ServiceArt`, pure shape math in
  `shapes.ts`), always visible, with CSS-only one-shot entrances under
  `prefers-reduced-motion: no-preference`.

## The HUD chrome (2026-09-17) — `lucide-react`

The IT-OS HUD (the fibre rail, the OS dock and windows) draws its interface
icons with **one new runtime package**. The foundation phase installs it; no module imports it
yet, so no chunk carries it until the first HUD part lands.

| Package | Version | Licence | Used by |
|---------|---------|---------|---------|
| `lucide-react` | **1.46.0** (exact) | ISC | `components/hud/**` only — nothing else may import it at runtime (`scene-contract.test.ts`) |

- **Facts, checked in the npm registry and the installed package:** peer
  `react ^16.5.1 || ^17 || ^18 || ^19` (the site runs 19.2.4), `sideEffects: false`, **no
  dependencies**, no install script, one lockfile entry. The package has **no `exports` map**, so
  paths under `dist/` are build internals, not an API — one more reason for the exact pin.
- **What an icon is:** an inline `<svg>` built by React from path data in the bundle. Nothing is
  fetched (no icon font, no sprite, no CDN), so the CSP does not change. With no accessible prop
  (`aria-label`, `title`, children…) the icon renders `aria-hidden="true"` by itself.
- **How it is used:** named imports from the package root only
  (`import { Activity } from "lucide-react"`), `strokeWidth={1.75}`, `aria-hidden`, coloured
  through `currentColor`. With `sideEffects: false` each chunk carries the icons it names and
  nothing else.
- **Refused by ESLint and `components/__tests__/scene-contract.test.ts`**, as `import` and as
  `import()`: `lucide-react/dynamic` (`.js`, `.mjs`) and `lucide-react/dynamicIconImports`
  (`.mjs`) — `DynamicIcon` looks icons up by name through a map with an `import()` for every one
  of ~4,200 icons; `lucide-react/dist/*` — deep build paths; and `import * as` / `export *` /
  `import("lucide-react")` — a namespace object keeps every icon.
- **Icons that draw round dots are out** (D1, no decorative dots): `Calculator` (its keypad is
  `h.01` round-cap dots), `GripVertical`, `GripHorizontal`, `Ellipsis*` and `MoreHorizontal`
  (`r="1"` circles). The OS windows' source contract test refuses them when those files land.

## Explicitly not used

- No data-fetching library (React Query, SWR) — a small typed client (`lib/api.ts`) over
  `fetch` covers the handful of endpoints we call.
- No i18n library (next-intl, i18next) — three languages and one page don't justify it; the
  catalogs are plain typed records.
- No component/UI kit (MUI, Chakra) — the design is bespoke; we hand-build components.
- No state-management library — React Context + local state is enough.
- No **`@react-three/drei`** — it would have been used for `PerformanceMonitor` alone, and its
  barrel can pull in loaders (HDR, fonts, Draco/KTX2) and blob workers that the nonce-based CSP
  refuses. A small, unit-tested FPS governor in `components/three/governor.ts` replaces it. ESLint
  bans the import ([11 — Security](./11-security.md)).
- No **postprocessing** / `@react-three/postprocessing` (bloom) — ~50 KB gzip more, and its
  multi-target blur passes stack their fill cost on every frame. The glow comes from additive
  materials and DOM glow layers instead, all cheap.
- No **ScrollSmoother**, `gsap/all` or `gsap/dist/*` — ScrollSmoother rewrites `<html>`/`<body>`
  styles and takes over scrolling; `gsap/all` bundles every plugin; `gsap/dist` is a second copy
  of the core with its own ticker. ESLint bans all three.
- No **framer-motion** — the site's motion is CSS; the Work stage's scroll measuring is GSAP. A
  second animation library would ship to every visitor for nothing GSAP and CSS don't already do.
- No Tailwind **preflight**, and no Tailwind outside the eight files in `@source` (see above).
