# 15 — Security Skill Suite

Everything security-related is organized as **per-topic Claude Code skills** under
`.claude/skills/security-*`. Each is a concrete, self-contained skill that points at this app's
real implementation and tests, so guidance never drifts from the code. They range from simple
input validation up to a full pentest.

## The skills

| Skill (`.claude/skills/…`) | Covers | Key files |
|---|---|---|
| **security-input-validation** | Validate every input on FE **and** BE — trim, non-empty, length, format, enums, bounds | `backend/app/validators.py`, `lib/validation.ts` |
| **security-xss-prevention** | Escape-on-write + re-escape-on-render + CSP; no executable markup anywhere | `validators.py`, `telegram/`, `next.config.ts` |
| **security-sql-injection** | ORM-only, parameterized; zero raw SQL / `text()` / f-string | `storage/db_store.py`, `security.py` |
| **security-script-blocking** | Block `<script>`/HTML/handlers and `javascript:`/`data:` URL schemes | `validators.py`, `lib/validation.ts` |
| **security-auth-jwt** | bcrypt + pinned JWT (aud/iss), anti-enumeration, short TTL, guarded routes | `security.py`, `config.py` |
| **security-rate-limiting** | Per-IP limits (login/contact), body-size cap, pagination, Telegram authz | `main.py`, routers, `telegram/` |
| **security-secrets-config** | `.env` gitignored, prod fail-fast guard, CORS/headers, non-root containers | `config.py`, `main.py`, compose |
| **security-pentest** | Orchestrated defensive audit → fixes → regression tests (produces `SECURITY.md`) | whole app |

## How to use

- Invoke a skill by name (e.g. `/security-input-validation`) when working on that surface, or let
  it trigger from its `description` keywords.
- **security-pentest** is the umbrella: it runs the 4-dimension audit and links every other skill
  as a checklist. Run it before a release or when asked to "verifică securitatea / pentesting".
- The current posture, findings, and status live in [`SECURITY.md`](../SECURITY.md).

## Tests behind the skills

- Backend: `backend/tests/test_api.py`, `test_security_http.py`, `test_security_authz.py`,
  `test_telegram.py` (run `make test-local`).
- Frontend: `lib/__tests__/validation*.test.ts` (run `npm test`).
- Live end-to-end: `scripts/verify-api.sh`.

See [14 — Testing](./14-testing.md) for the full test map.
