# 14 — Testing

Three layers of automated checks guard the app: frontend unit/UX tests, backend API tests,
and a live end-to-end API verification script.

## Frontend — Vitest + React Testing Library

Config: `vitest.config.ts` (jsdom, `@/` alias) + `vitest.setup.ts` (jest-dom matchers,
auto-cleanup). Run:

```bash
npm test          # vitest run (one-shot, CI)
npm run test:watch
```

**80 tests** across:

| Area | Files | Covers |
|------|-------|--------|
| API client | `lib/__tests__/api.test.ts` | every endpoint call (method/URL/headers/bearer), `ApiError` handling (network=0, 401, `{detail}` parsing), 204, token helpers |
| Validation | `lib/__tests__/validation.test.ts` | `isEmail`/`isPhone`/`hasDangerousContent`/`sanitizeText`/`validateText`, rule order, limits |
| Content store | `lib/__tests__/siteContent.test.tsx` | `mergeSiteData` (replace/fallback), load/save/clear round-trip, SSR-safe default-then-swap provider |
| Contact form UX | `components/__tests__/contact-form.test.tsx` | inline validation, blocked XSS input, submit success/error states |
| Admin login | `app/__tests__/admin-login.test.tsx` | login gate, wrong creds, transition to editor |
| Admin tabs | `app/__tests__/admin-tabs.test.tsx` | Cereri default tab, submission list + badge, tab switching, invalid-field disables Save |
| Sections | `components/__tests__/sections.test.tsx` | presentational render (Services excludes `estimatorOnly`, Team/Principles) |

Tests mock `@/lib/api` (no real network) and use the real `@/lib/validation`.

## Backend — pytest

```bash
make test-local        # or: cd backend && ./.venv/bin/python -m pytest -q
```

**28 tests**: content round-trip, auth (hashed login, wrong/unknown user → 401), and the
security suite (oversized → 422, `<script>` stored escaped, invalid email → 422, SQLi inert).
Telegram is forced off in tests (`backend/tests/conftest.py`) so they stay hermetic.

## Live API verification

`scripts/verify-api.sh` boots the backend on a throwaway SQLite DB (Telegram disabled), then
asserts **every endpoint the frontend uses** end-to-end — content, login (right/wrong), `me`
(with/without token), contact (valid → 201, bad → 422), submissions (auth-guarded), content
PUT round-trip, **CORS** (frontend origin echoed), and **XSS** (stored escaped). It tears down
the server + temp DB and exits non-zero on any failure.

```bash
PORT=8020 ./scripts/verify-api.sh    # 27/27 checks
```

## One command

```bash
npm test && make test-local          # frontend + backend
./scripts/verify-api.sh              # live end-to-end
```
