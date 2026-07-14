---
name: security-defensive-audit-playbook
description: Compact orchestration playbook for a defensive pentest — run 4 parallel READ-ONLY audit passes (auth/authz/JWT/IDOR · injection/XSS/SSRF/ReDoS · rate-limit/DoS · exposure/headers/CORS/secrets), rank by severity, then fix in disjoint file zones with ONE regression test per finding. Reusable across projects. Use before a release or when the user asks to "pentest / audit de securitate / verifică breșe / întărește aplicația / security review / harden".
---

# Defensive audit playbook (project-agnostic)

A repeatable way to pentest **your own** app (authorized), fix what's found, and lock each fix
with a test. This is the reusable orchestration; the app-specific umbrella version is
[[security-pentest]] — reference it, don't duplicate it.

## Phase 1 — audit: 4 parallel READ-ONLY passes, disjoint dimensions
Fan out one sub-agent per dimension so they don't collide, each strictly read-only:

1. **AuthN / AuthZ / JWT / IDOR** — pinned JWT algorithm (explicit allow-list, anti `alg=none`/
   confusion), `exp`/`aud`/`iss` validated, short TTL; every write/admin route behind a guard;
   no IDOR (object ownership checked), no mass-assignment (server sets `id`/`status`/`role`).
2. **Injection / XSS / SSRF / ReDoS** — ORM-only/parameterized (no raw SQL/`text()`/f-string
   queries); user text HTML-escaped on write and re-escaped on render; outbound HTTP only to
   **fixed** hosts (no user-controlled URL fetch = SSRF); regexes linear and run on length-capped
   input (ReDoS).
3. **Rate-limit / Brute-force / DoS / Logic** — login/contact limits that throttle **before**
   bcrypt; correct rate-limit **key** (real client IP, [[security-rate-limit-keys]]); streaming
   body-size caps; pagination + list caps; upload decode bounded; privileged bot/admin actions
   authorized.
4. **Exposure / Headers / CORS / Secrets** — CSP/HSTS/nosniff/X-Frame; CORS not
   credentials-with-wildcard; prod fail-fast guard; docs disabled in prod; no committed secrets;
   containers non-root; banner headers hidden.

Every finding: **severity (CRITIC / ÎNALT / MEDIU / SCĂZUT) + file:line + a concrete exploit +
the fix**. Also explicitly record **what is already secure** (so the next audit trusts it).

## Phase 2 — fix in disjoint zones
Do shared wiring first (config/settings, test conftest), then fan out sub-agents over
**non-overlapping file zones** (HTTP layer/routers · auth/integrations · frontend/headers) so
parallel edits don't conflict. **Forbid** agents from `git stash/checkout/reset` (they can wipe a
peer's work). Fix highest severity first.

## Phase 3 — one regression test per finding
Every fix gets a test that proves the attack is now **blocked**, asserting the defensive outcome:
- 401/403 on missing/forged token, wrong `aud`/`iss`, or IDOR attempt.
- 422 on a bad/oversized/empty input; SQLi string stored inert, tables intact.
- 429 after N requests — and the limit can't be reset by spoofing `X-Forwarded-For`.
- 413 on an oversized body; 400 (not 500) on a corrupt upload; 507 over storage budget.
- The prod guard raises on each unsafe config value; docs return 404 in prod.
- An unauthorized privileged action (bot command / admin route) is denied.

Keep the **whole** suite green — a fix that breaks an unrelated test isn't done.

## Severity ranking (triage order)
- **CRITIC** — remote takeover / auth bypass / full data loss (known signing key, rate-limit-key
  bypass, SQLi, `alg=none`). Fix now, block release.
- **ÎNALT** — brute-force open, credential-on-wildcard-CORS, privileged-action hijack.
- **MEDIU** — missing headers/CSP, unbounded list/storage, localStorage token (mitigate: strict
  CSP + short TTL).
- **SCĂZUT** — hardening/symmetry (banner leak, noindex, `aud`/`iss` add).

## Output
A single living security doc (findings table with severity + status + where fixed, a "verified
secure — no change" list, and a prod checklist the guard enforces). Re-run the 4 passes before
each release; a held-up posture is a valid, valuable result.

Related: [[security-pentest]], [[security-auth-jwt]], [[security-sql-injection]],
[[security-xss-prevention]], [[security-rate-limiting]], [[security-rate-limit-keys]],
[[security-file-upload]], [[security-csp]], [[security-prod-config-guard]],
[[security-secrets-config]].
