---
name: security-xss-prevention
description: Prevent stored/reflected XSS — HTML-escape user text on write, re-escape on render (Telegram HTML), set CSP/anti-clickjacking headers. Use when handling user-provided text that gets stored or rendered anywhere in TBS Digital, or when the user asks about "XSS / script injection / conținut nepermis".
---

# XSS prevention

**Strategy:** escape-on-write + re-escape-on-render + CSP. User markup must never execute in any
context (web, admin, Telegram, email).

## Escape on write — `backend/app/validators.py`
- `_clean_text` runs `html.escape()` on every stored free-text field, so `<script>` becomes
  `&lt;script&gt;` in the DB. Applied ONCE (reads use `model_construct` to avoid double-escape).
- Emails use `StoredEmail` (validate then escape) for symmetry (`schemas.py`).

## Re-escape on render — `backend/app/telegram/`
- Telegram messages (`parse_mode=HTML`) pass every dynamic value through `client.escape()` /
  `service._field()` (unescape-then-escape) so a crafted lead name can't inject HTML/markup.

## Frontend — `lib/validation.ts` + headers
- `hasDangerousContent` blocks `<script`, `javascript:`, `on*=` handlers, raw HTML tags before
  submit; `sanitizeText` strips them.
- React auto-escapes by default — never use `dangerouslySetInnerHTML` with user data.
- Security headers (`next.config.ts` + `backend/app/main.py`): `Content-Security-Policy:
  frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.

## Verify
- `scripts/verify-api.sh` asserts a stored `<script>` reads back HTML-escaped.
- `backend/tests/test_api.py` (script stored escaped) + `lib/__tests__/validation.test.ts`.

Related: [[security-input-validation]], [[security-script-blocking]], [[security-secrets-config]].
