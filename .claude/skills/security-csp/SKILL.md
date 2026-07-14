---
name: security-csp
description: Write a REAL Content-Security-Policy — strict default-src 'none' for JSON APIs, and a nonce-based strict-dynamic CSP for framework HTML (Next App Router) with NO unsafe-inline on scripts, plus frame-ancestors/base-uri/object-src/form-action. Use when hardening headers, adding a CSP, defending a token that lives in localStorage, or when the user asks about "CSP / Content-Security-Policy / nonce / strict-dynamic / unsafe-inline / XSS backstop / headers".
---

# Content-Security-Policy that actually stops XSS

CSP is the **backstop**: if any XSS slips past escaping/validation, a strict CSP means the
injected script can't execute or exfiltrate. This matters most when a session token lives in
`localStorage` (readable by JS) — CSP is what shrinks that theft window. It complements, never
replaces, [[security-xss-prevention]].

## JSON API → the strictest possible policy
An API that only ever returns JSON needs **no** scripts, styles, images, or framing:

```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

If reflected content ever leaked into an `/api/*` response, nothing in it could run or phone
home. Pair with `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, and (prod, over TLS) HSTS. Register the header middleware **last**
(outermost) so it also stamps error responses (413/429/CORS preflight).

## HTML → nonce-based `strict-dynamic`, never `unsafe-inline` on scripts
The weak, common CSP is `script-src 'self' 'unsafe-inline'` — `unsafe-inline` re-permits exactly
the injected `<script>` you're trying to block. Do this instead:

```
script-src 'self' 'nonce-<RANDOM>' 'strict-dynamic';
```

- Mint a **fresh random nonce per request** and stamp it on the header. Only scripts carrying
  that nonce run; an injected inline script has no nonce → blocked.
- `'strict-dynamic'` lets a nonced script load its own dependencies **and makes host/`'self'`
  allow-lists ignored for scripts** — so you can't accidentally re-open the policy with a domain
  allow-list. Any hand-written `<script>` (e.g. an analytics pixel) must be given the nonce
  directly.
- Framework note (Next App Router): set the CSP on the **request** headers in the proxy/
  middleware — the framework reads the nonce from there and auto-stamps its own bundle/runtime
  scripts — **and** on the response the browser enforces. A per-request nonce forces dynamic
  rendering. Do **not** also set a static CSP in `next.config.ts`: two CSP headers → the browser
  enforces the intersection and the nonce can't ride on a static header. Keep `unsafe-eval` out
  of prod (dev-only if the bundler needs it).

## The rest of the directives (don't forget these)
- `object-src 'none'` (kills `<object>`/Flash/plugin vectors).
- `base-uri 'none'` (stops a `<base>` injection from rewriting every relative URL).
- `frame-ancestors 'none'` (clickjacking — the modern replacement for `X-Frame-Options`; keep
  both, XFO is the backstop for old browsers).
- `form-action 'self'` (stops an injected form from posting credentials off-origin).
- `connect-src` / `img-src`: allow-list only the origins you actually call (your API, your
  pixel). Emit `upgrade-insecure-requests` only when the policy has **no** `http://` origin — a
  plain-http dev backend must not be force-upgraded or every call breaks.

## Anti-patterns
- `unsafe-inline` in `script-src`. A CSP with only `frame-ancestors` and nothing else. Reusing a
  static nonce (a nonce that isn't per-request is worthless). Two conflicting CSP headers. Relying
  on CSP instead of escaping — it's defence in depth, layered on top.

## Verify (regression-test shapes)
- Assert the API response carries `default-src 'none'` and the four hardening directives.
- Assert the HTML CSP contains `'strict-dynamic'` and a `nonce-`, and does **not** contain
  `unsafe-inline` in `script-src` (prod). Assert two requests get **different** nonces.
- Assert `X-Frame-Options`, `nosniff`, `Referrer-Policy` present; HSTS present only in prod.

Related: [[security-xss-prevention]], [[security-prod-config-guard]], [[security-secrets-config]],
[[security-pentest]].
