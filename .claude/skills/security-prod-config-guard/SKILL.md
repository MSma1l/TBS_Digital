---
name: security-prod-config-guard
description: Fail-fast on boot in production when config is unsafe — weak/default secrets, too-short secret/password, rate-limiter disabled, wildcard CORS, missing bot/admin allow-list, sane trusted-proxy count. Also disable API docs/schema in prod, hide server banner headers, and noindex admin pages. Use when writing a settings/config module, a deploy checklist, or when the user asks about "config guard / fail-fast / production / secrete slabe / docs disabled / server header / noindex".
---

# Production config fail-fast guard

The cheapest security control is a boot-time assertion: in production the app **refuses to
start** with unsafe config, so a weak default can never silently reach prod. Runs once, catches
the whole class of "shipped with the dev secret" incidents.

## The guard (validate after settings load; e.g. Pydantic `model_validator(mode="after")`)
When `ENVIRONMENT=production`, collect every problem and raise **one** clear error:

- **Signing secret** (`JWT_SECRET`/session key): unset OR equal to the known default OR shorter
  than a real minimum (>= 32 chars → `openssl rand -hex 32`).
- **Admin/bootstrap password**: unset OR the known default OR shorter than a minimum (>= 12).
- **CORS**: `CORS_ORIGINS` must not contain `*`. Never pair a wildcard/reflected origin with
  credentials — see [[security-secrets-config]].
- **Rate limiter on**: if rate limiting is your only brute-force control (no account lockout), a
  disabled limiter in prod is a hole — refuse to boot.
- **Bot/admin allow-list**: if an integration (e.g. a Telegram/Slack bot) is enabled with an
  **empty** operator allow-list, anyone in the bound channel can run privileged commands. Require
  the operator IDs to be set whenever the bot is enabled.
- **Trusted proxy count**: enforce a sane value so the rate-limit key can't be spoofed — see
  [[security-rate-limit-keys]].

```python
@model_validator(mode="after")
def _guard_production(self):
    if not self.is_production:
        return self
    problems = []
    if self.jwt_secret in ("", DEFAULT_JWT_SECRET):        problems.append("JWT_SECRET is unset or the known default")
    elif len(self.jwt_secret) < 32:                        problems.append("JWT_SECRET must be >= 32 chars")
    if self.admin_password in ("", DEFAULT_ADMIN_PASSWORD): problems.append("ADMIN_PASSWORD is unset or the known default")
    elif len(self.admin_password) < 12:                    problems.append("ADMIN_PASSWORD must be >= 12 chars")
    if "*" in self.cors_origin_list:                       problems.append("CORS_ORIGINS must not contain '*'")
    if not self.rate_limit_enabled:                        problems.append("RATE_LIMIT_ENABLED must be true")
    if self.bot_is_enabled and not self.bot_admin_id_set:  problems.append("BOT_ADMIN_IDS must list operators")
    if problems:
        raise ValueError("Refusing to start in production with insecure config: " + "; ".join(problems))
    return self
```

## Reduce the attack surface in prod (same theme, different lever)
- **Disable interactive API docs + schema** in production (`docs_url=None`, `redoc_url=None`,
  `openapi_url=None` when `is_production`). They hand an attacker the full endpoint/parameter map.
  Leave them on in dev where they're useful.
- **Hide stack-banner headers** at the proxy: `proxy_hide_header Server;`
  `proxy_hide_header X-Powered-By;` (nginx `server_tokens off;`). Don't advertise uvicorn/Next.
- **`noindex` admin/internal pages**: `X-Robots-Tag: noindex, nofollow` on the admin route so a
  leaked URL (referrer, history sync) isn't crawled. Deliberately **not** in `robots.txt`, which
  would only advertise the path.

## Anti-patterns
- A hardcoded default secret/password with no guard ("we'll change it in prod"). Warning-and-
  continuing instead of refusing to boot. Checking one bad value and returning on the first
  (collect them all — one boot, one complete error). Docs/OpenAPI reachable in prod.

## Verify (regression-test shapes)
- A sound prod config constructs without raising. Each unsafe value (default/short secret, short
  password, `*` in CORS, limiter off, bot-on + empty allow-list) raises with a message naming the
  offending key. Bot-on + allow-list set → accepted. In prod, `/docs` & `/openapi.json` → 404.

Related: [[security-secrets-config]], [[security-rate-limit-keys]], [[security-csp]],
[[security-auth-jwt]], [[security-pentest]].
