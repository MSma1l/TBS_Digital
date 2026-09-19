# Security

This document records the defensive pentest of TBS Digital, the hardening applied, and the
residual/accepted items. It is the source of truth for the app's security posture.

- **Audit:** 4 read-only pentest passes (auth/JWT/IDOR · injection/SSRF/ReDoS · rate-limit/DoS ·
  exposure/headers/CORS/secrets).
- **Result:** all CRITIC and ÎNALT findings fixed; MEDIU fixed or accepted with mitigation;
  SCĂZUT fixed. Regression tests added for every fix.
- **Verification:** backend **48** pytest · frontend **83** vitest · **27/27** live API checks
  (`scripts/verify-api.sh`) · lint + build clean.

## Findings & status

| # | Finding | Severity | Status | Where fixed |
|---|---------|----------|--------|-------------|
| C1 | JWT secret had a hardcoded default; app booted with a known signing key | CRITIC | **Fixed** | Production fail-fast guard (`config.py`) |
| C2 | Default admin creds (`admin`/`change-me`) seeded, no guard | CRITIC | **Fixed** | Same guard rejects default password in production |
| A1 | CORS `allow_credentials=True` (+ `*`-capable origins) | ÎNALT | **Fixed** | `allow_credentials=False`, narrowed methods/headers (`main.py`); guard rejects `CORS=*` in prod |
| A2 | No production fail-fast on unsafe config | ÎNALT | **Fixed** | `Settings._guard_production` (`config.py`) |
| R1 | No rate limit on `POST /api/auth/login` (brute-force) | ÎNALT | **Fixed** | slowapi `5/minute` (`routers/auth.py`) |
| R2 | Login = CPU-DoS amplifier (bcrypt each attempt) | ÎNALT | **Fixed** | Rate limit throttles before bcrypt |
| R3 | Contact form floodable (DB fill + Telegram ban) | ÎNALT | **Fixed** | slowapi `10/minute` (`routers/contact.py`) |
| T1 | Telegram `/register` hijack — any group member could repoint all leads | ÎNALT | **Fixed** | `is_authorized` allowlist + pinned-group (`telegram/`) |
| H1 | Security headers missing (clickjacking/nosniff/HSTS/CSP) | MEDIU | **Fixed** | Headers middleware (`main.py`) + `next.config.ts` |
| H2 | `GET /api/admin/submissions` unbounded (no pagination) | MEDIU | **Fixed** | `limit`/`offset` (`routers/contact.py`, `db_store.py`) |
| H3 | Body-size guard bypassable (chunked / no Content-Length) | MEDIU | **Fixed** | Streaming `BodySizeLimitMiddleware` (`main.py`) |
| H4 | Unbounded submission storage | MEDIU | **Mitigated** | Rate limit + pagination; retention policy = Phase 4 |
| M1 | Admin JWT in `localStorage` (XSS theft) | MEDIU | **Accepted+mitigated** | CSP/headers shrink XSS surface; token TTL cut to 2h; stored content HTML-escaped |
| M2 | Long token lifetime, no revocation | MEDIU | **Mitigated** | `jwt_expire_minutes` default 720→120; server-side revocation = Phase 4 |
| D1 | Postgres port published in base compose | MEDIU | **Documented** | `docker-compose.prod.yml` overrides to `ports: []`; run both files in prod |
| T2 | `/stats` + classification buttons open to any group member | SCĂZUT | **Fixed** | Authorized via `is_authorized` (`telegram/worker.py`) |
| S1 | bcrypt 72-byte truncation (password collision) | SCĂZUT | **Fixed** | SHA-256+base64 pre-hash (`security.py`) |
| S2 | No JWT `aud`/`iss` | SCĂZUT | **Fixed** | `aud`/`iss` = `tbs-digital`, validated on decode (`security.py`) |
| S3 | Stored `email` not HTML-escaped (symmetry) | SCĂZUT | **Fixed** | `StoredEmail` escaper (`schemas.py`) |
| S4 | `validateText` ran regex before length | SCĂZUT | **Fixed** | Length-before-regex (`lib/validation.ts`) |

## Round 2 — pre-release deep audit (4 fresh read-only passes)

A second full pentest before the projects/team/palette release. The first-round posture held
up: **no new CRITIC or ÎNALT in the auth/JWT/IDOR, injection/XSS, or exposure dimensions** —
the reviewers re-confirmed pinned-alg JWT with `aud`/`iss`, ORM-only queries, no SSRF, no
ReDoS, complete route-guard coverage, no mass-assignment, locked CORS, and zero committed
secrets. One CRITIC surfaced in rate-limiting; the rest are MEDIU/SCĂZUT hardening.

| # | Finding | Severity | Status | Where fixed |
|---|---------|----------|--------|-------------|
| R4 | Rate-limit key trusted the **left-most** `X-Forwarded-For` (client-controlled) — an attacker rotating the header defeated every per-IP limit (login/contact/upload) | CRITIC | **Fixed** | `_client_ip` now takes the entry the trusted proxy added (Nth-from-right, `trusted_proxy_count`) — `main.py`, `config.py` |
| H5 | CSP was only `frame-ancestors 'none'` — no XSS backstop for the admin token | MEDIU | **Fixed** | API: strict `default-src 'none'` (`main.py`). HTML: nonce-based CSP (`next.config.ts`/middleware) |
| H6 | Image decode allowed 40 MP + unbounded concurrency (memory-exhaustion) | MEDIU | **Fixed** | `MAX_IMAGE_PIXELS` 40→24 MP, decode behind a semaphore in a worker thread (`routers/uploads.py`) |
| H7 | Uploads had no total-size budget (disk exhaustion via abused token) | MEDIU | **Fixed** | `MAX_UPLOADS_DIR_BYTES` 512 MB; over budget → 507 before decode (`routers/uploads.py`) |
| H8 | nginx `client_max_body_size 1m` blocked the 10 MB upload route (413 at proxy) | MEDIU | **Fixed** | Per-location `10m` for `/api/admin/uploads` (`deploy/nginx/tbs.conf`) |
| T3 | Bot enabled with empty `TELEGRAM_ADMIN_IDS` — any group member could run `/register`/`/stats`/status buttons | MEDIU | **Fixed** | Ops: `TELEGRAM_ADMIN_IDS` set on the server; guard now refuses to boot without it |
| G1 | Prod guard didn't enforce admin-password strength, rate-limiter-on, or bot allow-list | SCĂZUT | **Fixed** | `_guard_production` checks all three (`config.py`) |
| E1 | FastAPI `/docs`,`/openapi.json` enabled in prod (schema disclosure if topology drifts) | SCĂZUT | **Fixed** | Disabled when `is_production` (`main.py`) |
| E2 | Admin page had no `noindex` (indexable if the URL leaks) | SCĂZUT | **Fixed** | `X-Robots-Tag: noindex` on `/admin-tbs-digital` (`next.config.ts`) |
| E3 | `Server: uvicorn` leaked the backend stack | SCĂZUT | **Fixed** | `proxy_hide_header Server`/`X-Powered-By` (`deploy/nginx/tbs.conf`) |
| U1 | Upload kept the client's original bytes when WebP wasn't smaller (polyglot survived, though served inert) | SCĂZUT | **Fixed** | Always store the re-encode (`routers/uploads.py`) |
| Q1 | Migration `ADD COLUMN` used an f-string (hardcoded identifiers today, latent) | SCĂZUT | **Fixed** | Identifier allow-list guard before the DDL (`db.py`) |

Regression tests: `backend/tests/test_security_hardening.py` (XFF spoof, prod guard, DDL guard),
plus upload polyglot/re-encode/storage-budget cases in `test_uploads.py` and the CSP assertion
in `test_security_http.py`.

## Round 3 — first-screen HUD redesign (2026-09-16)

The redesign added the frontend's first third-party runtime libraries — three.js,
@react-three/fiber, GSAP — plus Tailwind at build time, a session cookie and an inline
`<noscript>` style. A read-only performance / CSP / security review covered the whole diff and
ran the built site under a browser; no CRITIC, ÎNALT or MEDIU security finding.

| # | Finding | Severity | Status | Where fixed |
|---|---------|----------|--------|-------------|
| SEC-1 | The ESLint rule that keeps CSP-breaking 3D imports out missed three.js paths that need wasm, workers or a CDN fetch (`three/addons` barrel, `libs/*` decoders, `physics/*`, `WorkerPool`, `troika-three-text`, `@dimforge/*`) — they would lint clean and fail only in the browser | SCĂZUT | **Fixed** | Ban list + dynamic-`import()` selector extended, both spellings (`eslint.config.mjs`); verified by linting probe sources through stdin |

Verified, no change needed:

- **CSP unchanged** (`proxy.ts`): 0 `securitypolicyviolation` events across first visit,
  returning visit, reduced motion, a service page, the admin and forced WebGL. The gsap and
  three/R3F chunks contain no `eval(`, `new Function`, `new Worker` or `WebAssembly`; the 3D
  environment is procedural (no fetch); GSAP/R3F write styles through the CSSOM. The
  `<noscript><style>` that hides the intro without JS relies on the existing
  `style-src 'unsafe-inline'`. Details: [docs/11-security.md](docs/11-security.md).
- **`tbs_intro_skip` cookie**: read, **never written by the site**. The intro now plays on every
  hard load of the home page instead of once per session, so nothing sets it; the E2E suite and
  QA seed it to suppress the overlay, and `finishIntro()` only clears the legacy `tbs_intro`
  name. Only the literal `seen` counts and the value never reaches the DOM. No longer listed as
  a cookie the site stores in the cookie policy.
- **`x-pathname`**: overwritten by `proxy.ts` on document requests and only compared with `"/"`;
  a forged header on a prefetch request can only toggle the overlay in the sender's own
  response (no page caching).
- **User input into the DOM**: the intro's `location.hash` check goes through
  `getElementById`; nothing reaches `innerHTML`.
- **Dependencies**: runtime packages pinned exactly (three 0.186.0 and @react-three/fiber 9.7.0,
  MIT; gsap 3.15.0 and @gsap/react 2.1.2, GSAP Standard "no charge" licence). 54 lockfile
  entries added, none with install scripts. `@types/three` pulls dev-only packages (Rapier,
  meshoptimizer, fflate, tween.js) that are never bundled.
- **Admin route**: loads neither Tailwind nor the intro; now dark by default, which only raises
  contrast on its fixed colours.

## Round 4 — interior 3D stage (2026-09-17)

The interior redesign — a sticky WebGL scene behind the home page's first three sections, GSAP
ScrollTrigger, static SVG art, holographic stat cards, Directions and Work rebuilt in Tailwind —
added **no dependency** (`package.json` and the lockfile are unchanged). Three read-only reviews
covered it (correctness and lifecycle; accessibility and UX; performance, weight, CSP and
security) on built snapshots in a browser, and all their findings were fixed. One finding
touched the security tooling; no CRITIC, ÎNALT or MEDIU security finding.

| # | Finding | Severity | Status | Where fixed |
|---|---------|----------|--------|-------------|
| SEC-2 | The ESLint ban that keeps three.js / R3F / GSAP out of the up-front bundle matched exact package names only: subpaths (`gsap/ScrollTrigger.js`, `gsap/Observer`, `three/webgpu`) and the site's own heavy modules (`@/components/three/runtime`, `SceneDirector`, `SceneWorld`) linted clean in section files, several up-front files were outside its list, and `import type` was wrongly refused. The same file-scoped block must repeat the CSP bans | SCĂZUT | **Fixed** | `eslint.config.mjs` (subpath patterns, a regex for the site's modules, `allowTypeImports`, 7 more files), mirrored in `components/__tests__/scene-contract.test.ts`; verified with 20 lint probes through stdin |

Verified, no change needed:

- **CSP unchanged** (`proxy.ts`). The scene is procedural (no fetch, workers or wasm); the scene,
  director, gsap, probe and stage chunks contain no `eval`, `new Function`, `Worker`,
  `WebAssembly` or `createObjectURL`. Inline style attributes (`--accent`, `--p1/--p2`, hologram
  and tilt transforms, R3F and GSAP writes) come from constants and fall under the existing
  `style-src 'unsafe-inline'`. `e2e/interior.spec.ts` and `e2e/interior-webgl.spec.ts` assert 0
  CSP violations on every run. Details: [docs/11-security.md](docs/11-security.md#the-interior-3d-stage-2026-09-17).
- **`tbs_gpu_probe`** (`sessionStorage`): booleans only (`context`, `software`, optional `lost` /
  `slow`), versioned, rebuilt on every read and write; the WebGL renderer string is never stored
  (it would be a fingerprint). Listed as essential in the cookie policy (RO/RU/EN).
  `tbs_scene_3d` (`localStorage`) is a QA key the site only reads.
- **No permission prompts**: iOS's `DeviceOrientationEvent.requestPermission()` is never called.
- **No debug global**: the E2E specs read the scene's probe through React fiber props.
- **Admin data into the DOM**: the Work and Directions tag chips split the admin's text on "·" and
  render it through React, as before; no `innerHTML`.

## HUD foundation (2026-09-17) — one dependency, one QA key

The foundation of the IT-OS HUD (guide, fibre rail, OS windows) adds no visible feature yet. Not a
review round; recorded so the next audit starts from the facts.

- **Dependency**: `lucide-react` **1.46.0**, pinned exactly, ISC licence. No dependencies of its
  own, no install script, one new lockfile entry (every other entry unchanged). Icons are inline
  SVG built from path data in the bundle — no fetch, icon font or CDN — so the **CSP is
  unchanged**. The dynamic entry points (`lucide-react/dynamic`, `dynamicIconImports`), deep
  `dist/*` paths and namespace imports are refused by ESLint and
  `components/__tests__/scene-contract.test.ts`, and only `components/hud/**` may import it.
  Nothing imports it yet. Details: [docs/02](docs/02-tech-stack.md#the-hud-chrome-2026-09-17--lucide-react).
- **`tbs_hud`** (`localStorage`): a QA/E2E key the site only reads; only `"off"` counts, and it
  can only keep the HUD from loading in that browser. The E2E config seeds it for every context.
  Listed in [docs/11](docs/11-security.md#browser-storage-the-stage-uses).
- **Nothing loads early**: the HUD's single mount (`components/hud/HudChrome.tsx`, not mounted
  yet) renders nothing on the server and waits for an answered cookie banner, a first
  interaction, the intro gone and an idle slot before any part loads. It adds no `window` event
  and writes no storage.

## Verified secure (no change needed)

- **SQL injection:** 100% ORM/parameterized; zero raw SQL / `text()` / f-string queries.
- **Stored XSS:** every user-writable string HTML-escaped on write; Telegram messages
  re-escaped on render (`parse_mode=HTML`) with a double-escape guard.
- **SSRF:** the only outbound HTTP is the Telegram client on a **fixed** host with a literal
  method name — no user URL is ever fetched.
- **Telegram injection:** topic names come from a fixed lookup; `callback_data` is built from a
  server uuid + fixed status keys and re-validated against `STATUS_KEYS`.
- **ReDoS:** all regexes linear; format checks run on length-capped input.
- **JWT algorithm:** pinned to HS256 with an explicit allow-list (anti `alg=none`/confusion).
- **Auth coverage:** every write/admin route behind the bearer guard; no IDOR (single global
  content doc + admin-only submissions); no mass-assignment (`status`/`id` server-set).
- **Secrets:** no real token/password committed; `.env`/`backend/.env` gitignored; examples are
  placeholders. Containers run non-root; no secret baked into image layers.

## Production checklist (enforced by the guard)

Set `ENVIRONMENT=production` and the app **refuses to boot** unless:

- `JWT_SECRET` is set, not the default, and ≥ 32 chars (`openssl rand -hex 32`).
- `ADMIN_PASSWORD` is set, not the default, and ≥ 12 chars.
- `CORS_ORIGINS` does not contain `*`.
- `RATE_LIMIT_ENABLED` is true (rate limiting is the only brute-force control).
- `TELEGRAM_ADMIN_IDS` lists the operator user ids whenever the bot is enabled.

Also recommended in production:

- Pin `TELEGRAM_GROUP_CHAT_ID` (further locks `/register`). `TELEGRAM_ADMIN_IDS` is now
  guard-enforced, so `/register`, `/stats`, and the lead buttons are already admin-only.
- Set `TRUSTED_PROXY_COUNT` to the number of reverse proxies in front (1 for the shared nginx)
  so the rate-limit key can't be spoofed via `X-Forwarded-For`.
- Run behind HTTPS / a reverse proxy; run compose with both files so Postgres isn't public.

## Remaining (Phase 4, non-blocking)

Server-side token revocation (logout truly ends the session), submission retention/pruning,
optional httpOnly-cookie admin session, and Alembic migrations. See
[docs/08-roadmap.md](docs/08-roadmap.md).

## How security is organized

Reusable, per-topic security skills live in `.claude/skills/security-*` and are indexed in
[docs/15-security-skills.md](docs/15-security-skills.md). Tests: `backend/tests/test_security_*.py`,
`lib/__tests__/validation*.test.ts`, and the live `scripts/verify-api.sh`.
