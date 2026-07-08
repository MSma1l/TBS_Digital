---
name: security-secrets-config
description: Keep secrets out of git and unsafe config out of production — .env gitignored, fail-fast prod guard, CORS locked, security headers, non-root containers. Use when handling secrets/tokens/.env, CORS, headers, or deploy config in TBS Digital, or when the user asks about "secrete / .env / CORS / headers / config".
---

# Secrets & config hardening

## Secrets
- Real secrets live ONLY in `.env` / `backend/.env` (gitignored). `*.example` files hold
  placeholders. Never commit a token/password. The Telegram bot token is env-only.
- Verify nothing leaked: `git grep -iE "8837369881|password=|secret=|token=" -- . ':!*.example'`
  should return only identifiers/docs, never real values.
- Docker: containers run non-root (uid 1001); only the public `NEXT_PUBLIC_API_URL` is baked into
  the image; backend secrets injected at runtime via compose env.

## Production fail-fast guard — `backend/app/config.py`
With `ENVIRONMENT=production`, the app refuses to boot if:
- `JWT_SECRET` is unset / the default / < 32 chars,
- `ADMIN_PASSWORD` is unset / the default,
- `CORS_ORIGINS` contains `*`.

## CORS — `backend/app/main.py`
- `allow_credentials=False` (auth is Bearer, not cookies); methods/headers narrowed. Never pair
  `allow_credentials=True` with reflected/`*` origins.

## Security headers — `main.py` (API) + `next.config.ts` (frontend)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: frame-ancestors 'none'`; HSTS added when `is_production`.

## Deploy
- Run compose with BOTH files so Postgres isn't published:
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`. Terminate TLS at a
  reverse proxy. See [docs/12-deployment.md](../../docs/12-deployment.md).

## Verify
- `backend/tests/test_security_http.py` (headers present, CORS no credentials).

Related: [[security-auth-jwt]], [[security-pentest]].
