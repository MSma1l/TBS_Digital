---
name: security-script-blocking
description: Block scripts, HTML tags, event handlers, and dangerous URL schemes from passing through inputs (javascript:/data:/vbscript:), on frontend and backend. Use when a field must reject embedded code/links, or when the user asks about "să nu treacă scripturi / linkuri periculoase / deferred scripts".
---

# Script & dangerous-content blocking

Stops embedded code and malicious links from entering the system, complementing escaping.

## Backend — `backend/app/validators.py`
- `_clean_text`: rejects control characters, HTML-escapes markup (so `<script>` can't execute).
- URL/link fields: only `http`/`https` allowed; `javascript:`, `data:`, `vbscript:`, `file:`
  schemes are **rejected** (422). Contact `type:other` values that look like URLs must be https.
- IDs restricted to a slug charset (`IdStr`), so no markup/scheme sneaks through structural fields.

## Frontend — `lib/validation.ts`
- `hasDangerousContent(v)` flags: `<script`, `javascript:`, `on*=` event handlers (e.g.
  `onclick=`), and any raw `<tag>`.
- `sanitizeText(v)` strips tags / handlers / `javascript:` and trims. Applied to payloads before
  they are sent.
- Submit is blocked while any field is flagged.

## What to block, always
- `<script>...</script>`, inline event handlers, `<iframe>`/`<img onerror>` style payloads.
- `javascript:`/`data:text/html`/`vbscript:` URLs.
- Deferred/async script markup in plain-text fields.

## Verify
- `lib/__tests__/validation.test.ts` (dangerous content rejected) and
  `lib/__tests__/validation-hardening.test.ts`.
- `backend/tests/test_api.py` (script stored escaped, bad scheme rejected).

Related: [[security-xss-prevention]], [[security-input-validation]].
