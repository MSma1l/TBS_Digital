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
| any link or image path (site URL, logo, photo, screenshot, capture, demo manifest) | 500 |

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

### Links (sites, logos, photos, screenshots, captures) — rejected, never escaped
Every field that lands in an `href`/`src` — a partner's `url`, `logo` and `preview`, a team
member's photo and profiles, a project's links, its screenshots and its whole-site capture
(`fullPage`, 2026-10-06) — is **rejected on a strict shape** instead of being HTML-escaped
(escaping would corrupt a real URL: `?a=1&b=2` → `?a=1&amp;b=2`). A link must be either a
site-relative path (`/partners/…`, `/api/uploads/…`) or an absolute `http(s)` URL;
`javascript:` / `data:` / `vbscript:` / `file:`, protocol-relative `//host`, and the
markup/quote/whitespace characters that could break out of an attribute are all refused.
Enforced on both sides — `LinkStr` in `backend/app/validators.py` and `isLink` /
`sanitizeLink` in `lib/validation.ts`. The path of a project's interactive demo (`demo`,
2026-10-06), a manifest the site fetches rather than renders, is held to the same shape
([below](#the-interactive-demo-on-portofoliu-2026-10-06)).

### Image uploads — admin-only, magic-byte sniffed, always re-encoded
The only endpoints accepting binary content: `POST /api/admin/uploads` stores a picture (a
partner logo or preview, a team photo, a project screenshot) and `POST
/api/admin/uploads/capture` a project's whole-site capture (`fullPage`, 2026-10-06). Both are
admin-authenticated, rate-limited (20/min each) and share every guard
(`backend/app/routers/uploads.py`):

- **Size.** Capped at **8 MB** (`MAX_UPLOAD_BYTES`), read as a stream so an oversized file is
  abandoned mid-read (413). The body-size middleware and nginx allow 10 MB on the
  `/api/admin/uploads` prefix — headroom for the multipart framing — and 1 MB everywhere else.
  (This page used to say 512 KB, a limit the code no longer has.)
- **Format.** Decided by the file's **magic bytes**, never by the client's `Content-Type` or
  filename; only PNG / JPEG / WebP are accepted. **SVG is refused**: it is XML and can carry
  `<script>`, so serving one from our own origin would be a stored-XSS primitive.
- **Decompression bombs.** The pixel count is read from the header, and anything over **24 MP**
  (`MAX_IMAGE_PIXELS`, also pinned as Pillow's own limit) is refused with a 400 before a single
  pixel is decoded. A corrupt or truncated file is a 400 too, never a 500.
- **Memory and CPU.** Decoding runs in a worker thread, behind a semaphore: at most two picture
  decodes at once, and one capture decode (~370 MB of RAM at worst, a 24 MP WebP).
- **Disk.** The uploads directory has a **512 MB** budget; past it, uploads are refused with 507
  before anything is decoded.
- **Always re-encoded.** What is stored is rebuilt from the decoded pixels and written as WebP —
  never the client's bytes — so a polyglot's appended payload and any EXIF (GPS), ICC or XMP
  block are dropped. The filename is a uuid we generate plus our own extension, so a hostile
  `filename` can neither traverse the filesystem nor choose its own extension.
- **Geometry.** A picture's longest side is capped at 1600px. A capture is scaled to **1080px
  wide** when wider (never upscaled) and **cut at 12000px tall** from the top, so whatever is
  uploaded, at most 1080 × 12000 is stored. Both are first turned upright by their EXIF
  orientation (then the EXIF goes), and 16-bit grey is scaled to 8 bits rather than clipped.
- **One decoder per format.** The magic bytes pick the format, and `Image.open` is given only
  that format's decoder (`formats=[…]`): a body that merely starts like a JPEG is never handed
  to another of Pillow's plugins. Any failure while decoding — a malformed chunk raising
  `struct.error` or `IndexError` included — is a 400, never a 500.
- Stored files are served from `/api/uploads/` with `X-Content-Type-Options: nosniff`.

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
413 before they are parsed — **10 MB** under `/api/admin/uploads`, where the body is an
image (see above).

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

**One class of document was being served with no policy at all, and was fixed on 2026-09-25.**
The matcher in `proxy.ts` carried Next's own CSP-guide recipe, which excludes requests holding
`next-router-prefetch` **or** the legacy `Purpose: prefetch` header. The second one is not sent by
this Next version's router at all — it is sent by BROWSERS, on the document they preload when the
omnibox predicts a URL from history. Measured on the running container: `GET /` came back with a
`content-security-policy` header, the same request with `Purpose: prefetch` came back with none
(and with no `x-pathname`, so no intro and no canonical either). The matcher now excludes only
`next-router-prefetch`, which is an RSC payload rather than a document; `Sec-Purpose:
prefetch;prerender`, the modern header, was never excluded and still is not.
`app/__tests__/proxy-matcher.test.ts` pins the rule so the recipe cannot come back.

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

**`x-intro` (2026-10-09).** The proxy's verdict that a URL came from an ad (`utm_*` or a click id
such as `gclid` / `fbclid`; `fromAd` in `lib/intro.ts`), forwarded so the layout leaves the intro
out. `proxy.ts` deletes any copy the browser sent and sets its own; only the literal `skip`
counts, and it can only remove the overlay. Like `x-pathname`, a copy forged on a router prefetch
(which skips the proxy) changes nothing but the sender's own response. Nothing is stored.

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
- **`tbs_hud` (2026-09-17)** switches the HUD chrome (the rail, later the OS windows) off in that
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

### The Ghid TBS guide's tip — removed (2026-09-26); the assistant stays

The guide (IT-OS Phase 4, 2026-09-17) offered help about the section a visitor lingered on. That
**linger tip** was removed on 2026-09-25, briefly restored on the 26th at the owner's request and
removed again the same day, for good: `lib/hud/linger.ts`, the `data-guide-topic` attribute and
`e2e/guide.spec.ts` are gone. **The assistant herself stayed** — the photographic hologram in the
bottom-right corner (`components/hud/guide/*`, root `[data-guide]`), who answers written questions
when pressed and opens the request flow from her bubble (request source `guide`).

What she puts on the review's list:

- **Same-origin images only:**
  - `public/guide/asistent-384.webp`, her portrait (32 KB);
  - since 2026-10-08, `public/guide/gura/*.webp`, her mouth's frames (33 files, 91 KB in all).

  They load as an `<img>` and as CSS backgrounds and masks, and through `new Image()`, to wait
  for their decode before her face shows or her mouth moves. If a frame fails to load, each new
  answer asks for them again. All of it is
  `img-src 'self'`, so there is no CSP change. There is no dependency, no storage key, no cookie
  and no request of her own.
- **The lead rows she could write.** `- Secțiune: <topic>` came from the tip's `data-guide-topic`,
  so it is unreachable now. The row's validation (`isGuideTopic`: `servicii`, `lucrari`,
  `service`) and the `RequestContext.guideTopic` field stay, because the format is the estimator's,
  not the guide's. No CTA passes one today, so the row no longer appears in any lead.
  `POST /api/contact` validates exactly as before.
- **Developer tools, never shipped:** `tools/guide/`.
  - The `sharp` scripts that cut the portrait and draw the mouth's frames.
  - The lip study, `tools/guide/lips/`. It downloads public-domain video from Wikimedia Commons
    onto a developer's machine, into the gitignored `.work/`, and analyses it in its own Docker
    image. Nothing of it reaches the site but the numbers. Since 2026-10-08 that includes
    `fetch_teeth.py`, which takes three more clips by exact title and refuses any whose licence is
    not public domain, and `teeth.py`, which measures the teeth's brightness on all of them.
- **Still measured on every run:** `e2e/hud-integration.spec.ts` (HI6, the home page armed and
  scrolled through) asserts 0 `securitypolicyviolation` events and no console error.

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
- **It writes only inside its own root** (`data-flowing` on the root, `--rail-p` on its fibre,
  `data-pulse` on its ticks) and a temporary `tabindex="-1"` on a section a keyboard jump focuses
  (removed on blur). Nothing on `<html>` or `<body>`, no new `window` global, no new event (it
  listens to the stage's existing `tbs:scene-layout`).
- **Passive listeners only** (`scroll`, `resize`), so it can never block or hijack scrolling.
- **The thin cyan scrollbar** is a stylesheet rule on `html` (`scrollbar-width`,
  `scrollbar-color`), not an inline style: nothing in the CSP or the root-style checks changes.
- **Measured on every run:** `e2e/scroll-rail.spec.ts` and `e2e/hud-integration.spec.ts` (HI6 at
  1280 with the rail armed: 0 CSP violations, no console error; HI10: `<html>` / `<body>` untouched
  after the rail's jumps).

## The interactive demo on /portofoliu (2026-10-06)

/portofoliu's screen lets a visitor press a project's links and buttons and move between a few of
its pages without using the site for real: anything functional (a form, a login, a search, a chat)
opens a prompt that points to the real site. Each demo is drawn from a **manifest**, a static JSON
file the site serves itself (`public/projects/demo/<id>/demo.json`, made by `tools/site-demo/`),
named by the project's `demo` field. It adds **no dependency, no third-party request, no storage and
no CSP change**:

- **Static and same-origin.** The manifest and the captures it names are files of our own site
  (`/projects/…`), so the existing `connect-src 'self'` and `img-src 'self'` already cover them.
  The screen fetches a manifest only from a site path (`sitePath`, in `useSiteDemo`), and the
  field takes nothing else: `SitePathStr` on the server, `isSitePath` in the admin (a link, see
  [above](#links-sites-logos-photos-screenshots-captures--rejected-never-escaped), that is a path on
  the site — a whole URL is refused). Nothing is fetched from a project's site or from anyone else.
  The backend keeps only the path; it never reads the manifest, and nothing uploads one.
- **Ours, but parsed as if it were not.** `parseManifest` (`lib/siteDemo.ts`, pure: no DOM, no
  React) rebuilds the manifest from checked parts, and nothing is drawn from the raw JSON:
  - **ids** — version `1`, a site language, 1–12 pages with unique ids of `[a-z0-9-]{1,32}`, a
    start page that is one of them; a hotspot that links to a page not in the manifest is dropped;
  - **numbers** — every coordinate finite, a shot at most 4000 × 40000 units, each hotspot clipped
    into its shot (one with nothing left is dropped), at most 160 per shot, no scroll target above
    the top of its page (and an in-page one not past its end);
  - **labels** — a page title or a button's text is one line of plain text, 1–120 characters, and
    one with a control character is refused; it is the button's accessible name, text to print,
    never markup;
  - **site paths** — every picture and every path is a plain site path: `/…`, never `//…`, never a
    scheme, and none of the characters `isLink` refuses (so not `/\host` either).

  A bad page id, title or desktop shot refuses the whole manifest; a hotspot, a phone shot or a
  page path that fails is dropped on its own. A manifest whose server states (`Content-Length`)
  more than `DEMO_MAX_BYTES` (256 KB) is not read at all; one that turns out longer than that
  (256 K characters) is dropped before `JSON.parse` ever sees it.
- **Deep links only to the project's own origin.** `deepLink` resolves a hotspot's path against
  the project's `url` (`http` / `https` only) and returns nothing unless the result is on that
  same origin: no manifest can send a visitor to another site. A project with no public `url`
  gets no link at all.
- **No storage.** Where the visitor is in a demo — the page, the pages behind it (at most 20), an
  open prompt — is a plain value (`demoStep`) held in memory for the page load. No cookie,
  `localStorage` or `sessionStorage` key is written, and the cookie policy does not change.
- **No personal data in the pictures.** The rule of the captures ([09](./09-admin.md): never a
  real client's names, e-mails, phone numbers or faces) holds for a demo's pictures too, and they
  come from live pages. Labels: a private e-mail or phone becomes "E-mail" / "Telefon", looked for
  in the whole text. Pixels: the private systems' screenshots were cleaned by hand (2026-10-06);
  the public sites' captures blur, at capture time, what the live page shows of people
  (`redact` in `tools/site-demo/config.mjs`: CGAM's league players — the podium and the 62 names
  of the table — an event photo's faces, a real address in the IQ Arena mockup). A CSS blur
  changes paint, not layout, so the hotspots stay aligned; a text swap is kept by a mutation
  observer and checked again after the capture; a rule that must reach a page and reaches nothing
  stops that page, so a site that changed is never published unblurred. Reviews a site publishes
  as such keep their authors' names. The originals of the cleaned screenshots remain in the git
  history: removing them from it means rewriting the history — the owner's call.
- **The capture tool's own reach** ([tools/site-demo](../tools/site-demo/README.md)): one headless
  browser in a throwaway profile, deleted when it closes; every request of the captured page that
  is not GET/HEAD/OPTIONS is failed before it leaves. Not intercepted: a tab a press opens (closed
  after the press's wait), a cross-site frame, a worker, a WebSocket — fine for the studio's own
  clients' sites, not a sandbox for a stranger's.

## The portfolio's pixels through the image optimiser (2026-10-08)

Each of /portofoliu's pixels is a small square showing its project
([05](./05-page-sections.md#portfolio--portofoliu)). A picture of the site's own, right under
`/projects/`, comes to it through Next's image optimiser, `/_next/image` (`pixelPicture` in
`components/sections/Portfolio.tsx`, `getImageProps`): a few kilobytes where the file is tens to
hundreds of them. Nothing else on the site uses the optimiser.

**Before this change.** `next.config.ts` had no `images` key. With none, Next 16 sets
`localPatterns: [{ pathname: "**", search: "" }]` (`server/config.js`): any file under `public/`
without a query string, at any of its fifteen default widths. Nothing asked for that, but anyone
could.

**Now the config pins what the optimiser takes:**

- **Only the pictures right under `/projects`, without a query.**
  - The rule is `localPatterns: [{ pathname: "/projects/*", search: "" }]`.
  - Anything else is a 400:
    - the demos' pages in `/projects/demo/…` (up to 780 × 16000px);
    - another folder (`/guide/…`);
    - a query string;
    - `//host/…`;
    - a remote URL.
  - Next appends `/_next/static/media/**` to the list itself. What is there (the fonts, an icon)
    it refuses as images.
  - There are no `remotePatterns`, so the optimiser fetches nothing from anyone else and cannot be
    pointed at a URL (no SSRF).
  - All of it was checked on the running container.
- **One quality, three widths.**
  - The settings are `qualities: [75]`, `imageSizes: [64, 128]` and `deviceSizes: [256]`: exactly
    what the squares ask for.
  - `qualities: [75]` is Next 16's default, written down so no later default widens it.
  - Any other `q` or `w` is a 400, so nothing wider than 256px is ever encoded.
- **Each request's cost is bounded, but their number is not.**
  - Next keys its cache on the `url` string as sent, while the allow-list parses it first. So
    `…png#1`, `…png#2`, a bare `?` and `./` are each a new cache key for the same file.
  - Each such miss decodes the source again and encodes at most 256px of it. The largest file
    right under `/projects` is 1080 × 5999px (6.5 MP).
  - So a caller can keep one CPU busy, but cannot reach a bigger file, a bigger output or the
    disk. `maximumDiskCacheSize: 50_000_000` caps the encoded variants at 50 MB, dropping the
    least recently used first. They live in `.next/cache/images` in the container and are gone
    when it is recreated.
  - Limiting the rate of `/_next/image` belongs to the reverse proxy (see "What to still do for
    production", below).
- **Response headers.**
  - Next's own, on the optimiser's responses:
    - `Content-Security-Policy: script-src 'none'; frame-src 'none'; sandbox;`
    - `Content-Disposition: attachment`
    - `Cache-Control: public, max-age=14400, must-revalidate` (`minimumCacheTTL`, 4 hours)
    - `Vary: Accept`
  - SVG stays refused (`dangerouslyAllowSVG` unset).
  - `X-Content-Type-Options: nosniff` comes from the `headers()` rule for `/:path*` in
    `next.config.ts`, as on every other response.
- **No CSP change.**
  - The optimised picture is same-origin, under `img-src 'self'`.
  - An uploaded picture (`/api/uploads/…`) is on the API's origin and never passes through the
    optimiser. The square loads it as it is, under the API origin that `img-src` already names.
  - For an uploaded project that picture is the screenshot, never the capture: a capture is the
    whole site, up to 1080 × 12000px.
  - If the optimised picture fails, the square falls back to the project's screenshot file, from
    our origin or the API's.
- **No new data.** The squares show what the screen already shows for each project. The same rule
  for pictures applies ([above](#the-interactive-demo-on-portofoliu-2026-10-06)): no real
  client's names, e-mails, phone numbers or faces.

## Authentication
- Admin users live in the DB `users` table with **bcrypt-hashed** passwords
  (`backend/app/security.py`). Login (`POST /api/auth/login`) verifies the hash in constant
  time (with a dummy verify for unknown users to avoid timing leaks) and returns a short-lived
  JWT. The JWT guards `PUT /api/content`, the `/api/admin/submissions` routes and both image
  uploads (`POST /api/admin/uploads`, `POST /api/admin/uploads/capture`).
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
- Rate-limit `/_next/image` at the reverse proxy (nginx `limit_req` on `location = /_next/image`).
  Next keys the image cache on the raw `url`, so equivalent spellings of one path each decode its
  file again. Each costs at most a 6.5 MP decode and a 256px encode, but their number is unbounded
  ([above](#the-portfolios-pixels-through-the-image-optimiser-2026-10-08)).
- Serve everything over HTTPS behind a reverse proxy; don't expose Postgres publicly.
- Consider Alembic migrations before the schema changes in production (currently `create_all`).
