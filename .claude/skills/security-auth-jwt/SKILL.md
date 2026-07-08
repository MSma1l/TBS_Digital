---
name: security-auth-jwt
description: Harden authentication — bcrypt-hashed passwords, fixed JWT algorithm with aud/iss, anti-enumeration, short token lifetime, guarded routes. Use when touching login, tokens, admin access, or password handling in TBS Digital, or when the user asks about "auth / JWT / parolă / login / token".
---

# Auth & JWT hardening

## Passwords — `backend/app/security.py`
- bcrypt with a per-hash random salt; constant-time `bcrypt.checkpw`.
- Passwords are pre-hashed (SHA-256 → base64) before bcrypt so the 72-byte limit can't cause
  collisions and full entropy is preserved.
- **Anti-enumeration:** unknown users still run a dummy bcrypt verify (`_DUMMY_HASH`) so timing is
  uniform; the login error text is identical for wrong-password vs unknown-user.

## JWT — `backend/app/security.py`
- Algorithm **pinned** to `HS256` with an explicit `algorithms=[...]` allow-list (anti
  `alg=none` / algorithm confusion).
- Tokens carry and validate `aud`/`iss` = `tbs-digital`; `exp` enforced by PyJWT.
- Short lifetime: `jwt_expire_minutes` default **120** (2h). Guard every write/admin route with
  `Depends(get_current_admin)` — never leave a sensitive route unguarded.

## Config guard — `backend/app/config.py`
- In `ENVIRONMENT=production`, the app refuses to boot if `JWT_SECRET` is the default or < 32
  chars, or `ADMIN_PASSWORD` is the default. Generate: `openssl rand -hex 32`.

## Frontend — `lib/api.ts` + `app/admin-tbs-digital/page.tsx`
- Token attached only as `Authorization: Bearer` when present; 401 → clear token → back to login;
  logout clears it. (Token is in localStorage — keep TTL short; see [[security-secrets-config]].)

## Verify
- `backend/tests/test_api.py` + `backend/tests/test_security_authz.py` (wrong/absent aud/iss → 401;
  >72-byte password no collision; unknown user → 401).

Related: [[security-rate-limiting]], [[security-secrets-config]], [[security-pentest]].
