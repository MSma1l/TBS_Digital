# 11 — Security & Input Validation

Every value entering the system is validated **twice** — once in the browser (fast feedback,
UX) and once on the server (the real security boundary). The frontend checks can be bypassed;
the backend checks cannot, so the backend is authoritative.

## Where validation lives

| Layer | File | Role |
|-------|------|------|
| Frontend | `lib/validation.ts` | Shared, typed helpers reused by the contact form and the admin editor. |
| Backend | `backend/app/validators.py` + `backend/app/schemas.py` | Pydantic v2 field validators — the enforced boundary (HTTP 422 on violation). |

The two layers mirror the same limits on purpose. If they ever drift, the **backend wins**.

## Rules enforced

### Length limits
Every string field is capped so no input can flood the DB or the UI:

| Field | Max |
|-------|-----|
| name / role / project | 120 |
| stat value / label / estimate | 80 |
| price | 40 / 60 |
| description / bio | 2000 |
| contact value / email | 254 |
| phone | 6–40 |
| contact message | 5000 |
| partner logo / site URL | 500 |

Required fields (contact `name`, `email`, `message`) must be non-empty **after trimming**.
Each content list (services, stats, team, partners, contacts) is capped at **200 items**
(`MAX_LIST_ITEMS`) so a `PUT /api/content` can't be used to flood the database.

### The admin panel is not advertised
The public site carries **no link to `/admin-tbs-digital`**. A button in the navbar would
have published the admin's path in the markup of every page — free reconnaissance for
anyone scraping the site — and a visitor has no use for it; the admin types the URL. This
is obscurity, not a control (the route is still guarded by a real login and rate-limited),
so it only removes a free hint. `components/__tests__/navbar.test.tsx` pins it so the
button can't quietly come back.

### Links (partner site / logo) — rejected, never escaped
A partner's `url` and `logo` are the only fields that land in an `href`/`src`, so they are
**rejected on a strict shape** instead of being HTML-escaped (escaping would corrupt a real
URL: `?a=1&b=2` → `?a=1&amp;b=2`). A link must be either a site-relative path (`/partners/…`,
`/api/uploads/…`) or an absolute `http(s)` URL; `javascript:` / `data:` / `vbscript:` /
`file:`, protocol-relative `//host`, and the markup/quote/whitespace characters that could
break out of an attribute are all refused. Enforced on both sides — `LinkStr` in
`backend/app/validators.py` and `isLink` / `sanitizeLink` in `lib/validation.ts`.

### Logo upload (`POST /api/admin/uploads`) — admin-only, magic-byte sniffed
The only endpoint accepting binary content. Admin-authenticated and rate-limited (20/min),
capped at **512 KB** (streamed, so an oversized file is abandoned mid-read). The format is
decided by the file's **magic bytes**, never by the client's `Content-Type` or filename, and
only PNG / JPEG / WebP are stored. **SVG is refused**: it is XML and can carry `<script>`, so
serving one from our own origin would be a stored-XSS primitive. The stored filename is a
uuid we generate plus an extension from our own allow-list, so a hostile `filename` can
neither traverse the filesystem nor choose its own extension.

### XSS / script injection — escaped at the boundary that renders, not at the one that stores
Free-text is stored **exactly as the user typed it** (trimmed, control-chars rejected,
length-capped — but *not* HTML-escaped). It cannot execute, because both of the places that
render it escape it themselves:

- the site renders through **React**, which escapes every value it prints;
- the Telegram bot **escapes each dynamic value** as it assembles its HTML message
  (`telegram/client.escape`), since that message body legitimately contains `<b>`/`<a>` markup.

**This used to be done at the storage boundary, and it was a bug.** `validators.text()`
HTML-escaped on write, so the service legitimately named `Dashboard & rapoarte` was stored as
`Dashboard &amp; rapoarte` — and React, correctly escaping again on the way out, printed those
literal characters. Every visitor to tbs.md read "Dashboard &amp; rapoarte" on the services
card. Escaping data on the way *in* corrupts it; escaping it on the way *out* is what actually
protects the reader. `test_an_ampersand_in_content_survives_the_round_trip` pins this.

The frontend still blocks `<script`, `javascript:`, `on*=` handlers and raw HTML tags before
submit (`hasDangerousContent` / `sanitizeText` in `lib/validation.ts`) — a second line of
defence, and a way to tell an admin they typed something odd rather than silently keeping it.

### Email, phone, URLs
- **Email:** validated with `pydantic.EmailStr` (backend) + regex (frontend).
- **Phone:** permissive regex — digits, spaces, `+ - ( )`, 6–40 chars.
- **URLs / links:** only `http`/`https` schemes accepted. `javascript:`, `data:`, `vbscript:`,
  `file:` schemes are **rejected** everywhere.
- Control characters are rejected; whitespace is trimmed.

### SQL injection
The DB layer (`backend/app/storage/db_store.py`, `backend/app/security.py`) uses **only** the
SQLModel/SQLAlchemy ORM with bound parameters — no raw SQL, f-strings, or `.format()`. A SQLi
payload like `'; DROP TABLE users;--` is stored as literal text and cannot affect the schema.

### Request-body size guard
A middleware in `backend/app/main.py` rejects request bodies larger than **1 MB** with HTTP
413 before they are parsed.

## The HTML CSP and the first-visit intro (2026-09-16)

The site's HTML is served with a per-request, nonce-based policy from `proxy.ts`:
`script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'unsafe-inline'`,
`connect-src 'self'` (+ the analytics pixel host, and the API origin when
`NEXT_PUBLIC_API_URL` points at a separate one), `img-src 'self' data: blob:` (+ that API
origin), `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, **no** `worker-src`
(it falls back to `script-src`, which a `blob:` worker does not satisfy) and **no**
`'wasm-unsafe-eval'`.

**The HUD redesign added three.js, React Three Fiber, GSAP and Tailwind, and the CSP did not
change.** It still holds because:

- **Nothing is fetched at runtime.** The 3D scene is built procedurally from three core — the
  environment map is rendered from emissive strips (PMREM), not loaded from an HDR — so there
  is no `connect-src` need. The gsap and three/R3F chunks were checked for `eval(`,
  `new Function`, `new Worker` and `WebAssembly`: none.
- **All scripts are first-party chunks** loaded by Next under the nonce and `'strict-dynamic'`,
  including the lazy director and scene chunks.
- **Styles are written through the CSSOM** (GSAP tweens, R3F's canvas sizing), which a CSP does
  not restrict. The one inline `<style>` — `<noscript><style>#tbs-intro{display:none!important}
  </style></noscript>` in `app/(site)/layout.tsx`, which hides the overlay when scripting is
  off — relies on the `style-src 'unsafe-inline'` that was already there. Tailwind is a build-time
  stylesheet.
- **Measured:** 0 `securitypolicyviolation` events on a first visit, a returning visit, reduced
  motion, a service page, the admin and the forced-WebGL scene, and `e2e/preloader.spec.ts`
  asserts it on every run ("needs no CSP change and logs no errors").

### Imports that would break the CSP fail lint instead

drei, three's loaders and decoders, physics engines and worker pools pass `tsc`, the unit tests
and the build — and then fail only in a real browser, because they fetch from a CDN, compile
wasm or spin up `blob:` workers. `eslint.config.mjs` bans them with `no-restricted-imports`
**and** a `no-restricted-syntax` selector for dynamic `import()`, which the intro uses to
code-split:

| Banned | Why |
|--------|-----|
| `@react-three/drei`, `@react-three/drei/*` | Environment presets fetch HDRs; `<Text>` fetches fonts and runs a worker; loaders pull decoders |
| `three/addons/loaders/*`, `three/examples/jsm/loaders/*` | Asset fetches; Draco/KTX2/Basis decoders (wasm, workers, CDN) |
| `…/libs/*` | The decoders themselves (meshopt, draco, basis — `WebAssembly.instantiate`) |
| `…/physics/*`, `@dimforge/*` | Rapier and friends: wasm fetched from a CDN at runtime (`@types/three` installs `@dimforge/rapier3d-compat`, so it resolves) |
| `…/utils/WorkerPool(.js)` | `blob:` workers |
| `…/Addons(.js)` and the bare `three/addons` | The barrel that re-exports all of the above (the bare name is an exact-path ban, so harmless addons such as controls stay allowed) |
| `three-stdlib`, `troika-three-text` | Loader re-exports; `blob:` workers |

Each `three/…` entry is listed under both spellings (`three/addons` and `three/examples/jsm`).
The ban list was verified by linting probe sources through stdin: every banned static and
dynamic import reported, near-misses and allowed imports clean.

### The `tbs_intro_skip` cookie — read, never written

**The site no longer stores an intro cookie.** It used to write `tbs_intro=seen` so the intro
played once per browser session; it now plays on every hard load of the home page, and
`finishIntro()` only *clears* the legacy name a browser may still be carrying
(`INTRO_LEGACY_CLEAR_STRING`). The name was changed deliberately: honouring the old one would
have left every browser that was open across the deploy with no intro at all.

| Attribute | Value | Why |
|-----------|-------|-----|
| Name | `tbs_intro_skip` (`INTRO_COOKIE`) | Renamed from `tbs_intro`, which does **not** count any more (`readIntroSeen` matches the exact name) |
| Who writes it | **nobody in the app** — the E2E suite (`seedIntroSeen`) and QA | Kept readable so a test run, or a session that needs the page without an overlay, can suppress it |
| Value | `seen` — the only value that counts (`isIntroSeen`) | Anything else, or no cookie, just plays the intro; the value never reaches the DOM |
| Lifetime | session, where it is seeded | Nothing in the app extends it |
| `Path` | `/` | Read by the server gate for `/`, `/ru`, `/en`; a cookie scoped deeper would not reach it |
| `SameSite` | `Lax` | Same as the site's other preference cookies |
| `HttpOnly` | no | It carries no secret and gates nothing but an animation |
| `Secure` | not set | Consistent with the other preference cookies; production is served over HTTPS with HSTS (`deploy/nginx/tbs.conf`) |

Because the site stores nothing, it is **no longer listed as a cookie the site sets** in the
cookie policy (`app/(site)/cookies/content.ts` says so in its header comment, RO/RU/EN). The
gate compares `x-pathname` — which `proxy.ts` overwrites on every document request — only with
`"/"`; a client that forges it on a prefetch request can only toggle the overlay in its own
response (pages are rendered per request, and nginx does not cache them).

## The interior 3D stage (2026-09-17)

The interior redesign — a sticky WebGL scene behind Hero → Ticker → Directions (and, since IT-OS
Phase 3, Work, whose cards turn round a DNA helix), GSAP
ScrollTrigger, static SVG art, holographic stat cards — added **no dependency and did not change
the CSP** in `proxy.ts`. It still holds because:

- **Nothing is fetched at runtime.** The hero chip and the five service models are built from
  maths in three core, with no environment map at all since the chip replaced the glass core
  (2026-09-17; the intro keeps its procedural PMREM); the static art is inline SVG styled by CSS
  Modules. The cursor trail (same date) is a ring buffer filled from passive `pointermove`
  listeners — coordinates and `event.timeStamp` only, in an in-memory ring of 64 segments that
  each fade out after 0.9s; never stored, sent or written to the DOM.
- **No dynamic code.** The scene, director, gsap, probe and stage chunks were checked for
  `eval`, `new Function`, `Worker`, `WebAssembly` and `createObjectURL`: none. three core's loader
  classes are bundled but never called.
- **Inline style attributes come from constants and numbers**: a direction's brand `--accent`
  (`lib/solutions.ts`), a project card's `--p1` / `--p2` gradient, the hologram transforms, the
  tilt's `--tilt-rx` / `--tilt-ry`, R3F's canvas sizing and GSAP's parallax transforms. None of
  them carries visitor or admin text, and `style-src 'unsafe-inline'` was already in the policy.
- **Measured on every run:** `e2e/interior.spec.ts` (E1, the static-art path) and
  `e2e/interior-webgl.spec.ts` (W1, the forced WebGL canvas; W15, Work's spiral) assert 0
  `securitypolicyviolation` events.

### The Work hologram (Canvas2D, 2026-09-17)

Work's spiral shows the front project card as a hologram beside the helix
(`components/scene/three/hologram.ts`): one small Canvas2D canvas uploaded as a `CanvasTexture`.
It draws admin-editable content (the card's screenshot, name and tags), so it is built to add no
way in and to leak nothing, and **the CSP is unchanged**:

- **Only the card's own `<img>`, and only same-origin.** The image's `currentSrc` must resolve to
  `location.origin` and must have decoded within 1.5s (`img.decode()`); anything else — a
  cross-origin URL an admin might paste, a broken or slow image — gives a text-only hologram.
  **No loader, no `fetch`, no `blob:` / `createObjectURL`, no `TextureLoader`, no new origin**: the
  pixels come from the image the page already shows.
- **The taint probe.** Should the canvas still end up tainted (a redirect, a future CDN), the
  hologram reads back one pixel (`getImageData(0, 0, 1, 1)`, which throws on a tainted canvas),
  redraws itself text-only and only then flags the texture — three never uploads a tainted canvas,
  so no `SecurityError` is thrown mid-frame. The context is created with `willReadFrequently`, and
  the probe is the only read-back.
- **Fine print stays illegible.** The canvas is at most 384 × 240 (`HOLOGRAM_MAX`; 256 × 160 on
  the mid tier) and the screenshot band is drawn at half resolution, in **2px cells**, then scaled
  up — as luminance under scanlines. The FLIRT screenshot's sign-up form holds a visible e-mail
  address; at 1px cells it was partly legible at 3× zoom, at 2px it is not (checked on the page
  at 1280 × 800, native and 3×). Admin screenshots may hold anything, so this is a property of the
  hologram, not of one image.
- **Text is text.** The name and the tags are the DOM's `textContent` (whitespace collapsed,
  upper-cased in the page's language), drawn with `fillText` in the card's computed font; the
  index is the card's position, drawn with `strokeText`. Nothing is parsed as HTML, and the 2D
  canvas is never inserted into the page (only its texture is drawn, on the `aria-hidden` WebGL
  canvas).
- **Nothing kept.** One canvas per scene, redrawn in an idle slot only when the front card
  changes (or the page's language does), disposed with the scene; nothing is stored or sent.

The spiral itself writes only layout properties inline on the cards (`transform`, `z-index`,
`opacity`, sticky placement — numbers the scene computes) and puts every original `style`
attribute back; it reads no content and adds no text.

### Imports that would ship GSAP or three.js to everyone fail lint

`eslint.config.mjs` extends the rule block above:

| Banned | Where | Why |
|--------|-------|-----|
| `gsap/all`, `gsap/all.js` | everywhere, as `import` and `import()` | the barrel bundles every plugin |
| `gsap/dist/*` | everywhere, as `import` and `import()` | a second (UMD) copy of the core with its own ticker — two tickers, two ScrollTrigger registries |
| `gsap/ScrollSmoother`, `gsap/ScrollSmoother.js` | everywhere, as `import` and `import()` | rewrites `<html>` / `<body>` styles and takes over scrolling |
| `gsap-trial`, `gsap-trial/*` | everywhere, as `import` and `import()` | the trial package, never shipped |
| a **static** value import of `three`, `@react-three/fiber`, `gsap`, `gsap/ScrollTrigger`, `@gsap/react`, any subpath of them, or the site's modules that carry them (`three/runtime`, `SceneCanvas`, `SceneWorld`, `SceneDirector`, `IntroScene`, `IntroDirector`, any spelling) | the files the page bundle reaches up front (`app/**`, the sections, layout, `ui`, `fx`, `SceneStage`, the art, `lib/**`, the intro's shell and both probe chunks) and, since 2026-09-17, the HUD chrome (`components/hud/**`) | ~290 KB gzip to every visitor; they load through `import()` behind the capability probe. `import type` stays allowed |
| `lucide-react/dynamic` (`.js`, `.mjs`), `lucide-react/dynamicIconImports` (`.mjs`), `lucide-react/dist/*`; `import * as` / `export *` from `lucide-react` and `import("lucide-react")` (2026-09-17) | everywhere, as `import` and `import()` | each keeps every one of ~4,200 icons; `dist/*` is not a public API. Icons are named imports from the package root ([02](./02-tech-stack.md#the-hud-chrome-2026-09-17--lucide-react)) |

That second block is not a security boundary, but it matters for one: flat config **replaces** a
rule's options per matching block, so the file-scoped block **repeats** the CSP bans above —
drop them from it and drei or a wasm decoder would lint clean in exactly the files that load
first. `components/__tests__/scene-contract.test.ts` mirrors the lists. Verified by linting 20
probe sources through `--stdin-filename` (no files created): value imports flagged, type imports
and `import()` allowed, the scene chunk itself allowed.

The first version matched exact package names only: `gsap/ScrollTrigger.js`, `gsap/Observer`,
`three/webgpu` and static imports of `@/components/three/runtime` or `../scene/SceneWorld` linted
clean in `components/sections/`, a harmless `import type { Color } from "three"` was an error, and
several up-front files were outside the list. Fixed before release (review finding, 2026-09-17).

### Browser storage the stage uses

| Key | Storage | Holds | Written by | Lifetime |
|-----|---------|-------|------------|----------|
| `tbs_gpu_probe` | `sessionStorage` | `{"v":1,"strict":{…},"forced":{…}}`, each entry `context`, `software` and optionally `lost` / `slow` — **booleans only** | the GPU probe (`components/three/capability.ts`, called by the intro shell or the stage) and `markGpu` after a lost context or a governor bail | the tab |
| `tbs_scene_3d` | `localStorage` | `"force"` or `"off"` | **never by the site** — QA and the E2E helpers set it; the site only reads it | until removed |
| `tbs_hud` | `localStorage` | `"off"` | **never by the site** — QA and E2E only (`playwright.config.ts` seeds it for every context unless `E2E_HUD=on`); `lib/hud/gate.ts` only reads it | until removed |

- **Never the renderer string.** The probe reads `RENDERER` (and `UNMASKED_RENDERER_WEBGL` only
  when the plain one is masked), tests it against the software-rasteriser pattern in memory, and
  stores only the boolean: a renderer name would be a device fingerprint.
- **Parsed defensively** (`lib/gpuProbe.ts`): versioned, rebuilt from its booleans on every read
  and write — an unknown key never survives, a malformed entry is dropped. A tampered value can
  only change whether that tab tries to draw the scene (and a device that cannot keep up bails
  back to the static art).
- The live gates (reduced motion, Save-Data, a 2G connection, `ResizeObserver`) are never cached.
- `tbs_gpu_probe` is listed as an **essential** entry in the cookie policy
  (`app/(site)/cookies/content.ts`, RO/RU/EN): session storage, yes/no values, identifies nobody,
  gone when the tab closes.
- **`tbs_hud` (2026-09-17)** switches the HUD chrome (guide, rail, OS windows) off in that
  browser: only the literal `"off"` counts; any other value, or storage that throws, is ignored.
  A tampered value can only keep the HUD from loading there; the page itself does not change. Like
  `tbs_scene_3d` it is not a cookie-policy entry, because the site never writes it. The chrome's
  mount (`components/hud/HudChrome.tsx`) arms only after the cookie banner is answered, a first
  interaction, the intro gone and an idle slot, and writes no storage itself.

### Nothing asked of the visitor, nothing new exposed

- **No permission prompt.** The gyroscope tilt listens to `deviceorientation` only where the
  browser gives it without asking; `DeviceOrientationEvent.requestPermission()` (iOS) is never
  called.
- **Nothing new on `window`.** The E2E specs read the scene's scroll probe through React's fiber
  props on the canvas's ancestors (`e2e/helpers.ts`, `sceneProbeVsDom`), so production exposes no
  debug global. The two new `window` events (`tbs:intro-gone`, `tbs:page-cover`) are plain
  `Event`s that carry no data, and so is `tbs:scene-layout` (IT-OS Phase 3), dispatched on the
  stage element only.
- **No new text reaches the DOM from data.** The tag chips split admin text on "·" and render it
  through React (escaped), exactly as the whole tag was rendered before.

### The Ghid TBS guide (IT-OS Phase 4, 2026-09-17)

The guide (`components/hud/guide/*`, `lib/hud/linger.ts`; behaviour in
[05](./05-page-sections.md#ghid-tbs-the-guide)) added **no dependency, no storage and no CSP
change**:

- **No new storage and no cookie.** Its memory (tips shown, the cooldown, "Nu mai arăta") is one
  module variable: it lasts the page lifetime, survives client navigation and is gone on reload.
  The only key the HUD reads is `tbs_hud` (listed above: QA and E2E, never written by the site).
  The cookie policy does not change.
- **It sends only what the visitor submits.** Showing, pulsing, dismissing or opting out sends
  nothing — no request, no analytics event. Pressing the avatar or "Deschide ghidul" only opens
  the existing request dialog; a lead leaves only through the existing `POST /api/contact`
  submit, with the same validation and escaping as every other request. The guide
  adds to that message nothing but ids from fixed lists, each validated before it is written:
  `- Serviciu: <slug>` (a slug `lib/directions.ts` knows), `- Proiect: <name> (<id>)` (the project
  at that index in the site's own content, `lucrari` topic only), `- Secțiune: <topic>`
  (`isGuideTopic`: `servicii`, `lucrari` or `service` — whatever a `data-guide-topic` attribute
  carries) and `- Sursă (CTA): guide | guide-prompt`.
- **Nothing fetched, nothing parsed.** Its chunk arrives through `next/dynamic` from the site's
  own origin after arming; the ✕ is a lucide-react component rendered by React (inline SVG, no
  sprite, no icon font); the copy is static `{ ro, ru, en }` text; no `dangerouslySetInnerHTML`,
  no `eval`, no `Worker`, no `blob:`.
- **It reads only geometry and attributes**: IntersectionObserver entries, `getBoundingClientRect`
  for the focus-overlap guard, `data-guide-topic`, `data-helix-front`, `document.activeElement`
  (to know whether the visitor is typing — never the field's value). No new `window` global and no
  new event.
- **Measured on every run:** `e2e/guide.spec.ts` (a service page with the guide armed, lingered on
  and opened) and `e2e/hud-integration.spec.ts` (HI6, the home page armed and scrolled through)
  assert 0 `securitypolicyviolation` events and no console error.

### The fibre rail (IT-OS Phase 5, 2026-09-17)

The rail (`components/hud/rail/*`, `lib/hud/rail.ts`; behaviour in
[05](./05-page-sections.md#the-fibre-rail)) added **no dependency, no storage, no cookie, no
request and no CSP change**:

- **Nothing stored, nothing sent.** It keeps its positions in a plain object for the page
  lifetime. It reads no storage key (the HUD's `tbs_hud` switch is read by `HudChrome`, listed
  above), sets no cookie, fetches nothing and sends nothing; a marker only scrolls the page. The
  cookie policy does not change.
- **It reads only geometry and the page's own headings**: `getBoundingClientRect` of the
  sections, `scrollY` / `scrollHeight` / `innerHeight`, `--header-h`, and the text of `h1` / `h2`
  headings already on the page. A label is rendered as React text (escaped), never as HTML; the
  home labels are static catalog keys and `{ ro, ru, en }` copy.
- **It writes only on its own root** (`--rail-p`, `data-flowing`, `data-pulse` on its ticks) and a
  temporary `tabindex="-1"` on a section a keyboard jump focuses (removed on blur). Nothing on
  `<html>` or `<body>`, no new `window` global, no new event (it listens to the stage's existing
  `tbs:scene-layout`).
- **Passive listeners only** (`scroll`, `resize`), so it can never block or hijack scrolling.
- **The thin cyan scrollbar** is a stylesheet rule on `html` (`scrollbar-width`,
  `scrollbar-color`), not an inline style: nothing in the CSP or the root-style checks changes.
- **Measured on every run:** `e2e/scroll-rail.spec.ts` and `e2e/hud-integration.spec.ts` (HI6 at
  1280 with the rail armed: 0 CSP violations, no console error; HI10: `<html>` / `<body>` untouched
  after the rail's jumps).

## Authentication
- Admin users live in the DB `users` table with **bcrypt-hashed** passwords
  (`backend/app/security.py`). Login (`POST /api/auth/login`) verifies the hash in constant
  time (with a dummy verify for unknown users to avoid timing leaks) and returns a short-lived
  JWT. The JWT guards `PUT /api/content` and `GET /api/admin/submissions`.
- The first admin is **seeded** from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on startup
  (`backend/app/seed.py`), hashed. Changing `ADMIN_PASSWORD` after first run does **not**
  rotate an existing user's password — add a rotation step if you need it.
- Use a strong `JWT_SECRET` (≥32 random bytes: `openssl rand -hex 32`).

## Verification
Backend security is covered by `backend/tests/test_api.py` (20 tests), including oversized
input → 422, stored `<script>` escaped, invalid email → 422, empty required → 422, and a SQLi
string left inert. Run `make test` (Docker) or `make test-local` (venv).

## What to still do for production
- Add rate limiting on `POST /api/contact` and `POST /api/auth/login` (e.g. slowapi / a
  reverse-proxy limit) to stop brute-force and spam.
- Serve everything over HTTPS behind a reverse proxy; don't expose Postgres publicly.
- Consider Alembic migrations before the schema changes in production (currently `create_all`).
