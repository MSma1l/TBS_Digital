---
name: security-input-validation
description: Validate every input on BOTH frontend and backend (defense in depth) — trim, non-empty, min/max length, format (email/phone), enums, numeric bounds. Use when adding or reviewing any form, request schema, or field in TBS Digital, or when the user asks about "validare de date / input validation / câmpuri obligatorii / lungimi".
---

# Input validation (frontend + backend)

**Rule:** every input is validated on BOTH layers. The **backend is the source of truth**; the
frontend is UX only and can be bypassed.

## Backend (authoritative) — `backend/app/validators.py` + `backend/app/schemas.py`
- Use the reusable helpers: `text(max, min=1)` (strip + non-empty + control-char reject + HTML
  escape), `optional_text(max)`, `IdStr`, `EmailStr`, `PhoneStr`.
- Apply on EVERY string field: `name: text(120)`, `bio: optional_text(2000)`, etc.
- Enums → `Literal[...]`; numbers → `Field(ge=, le=)`; lists → `Field(max_length=MAX_LIST_ITEMS)`.
- A violation returns HTTP **422** automatically (Pydantic).
- Never accept unbounded strings or lists (DoS). `MAX_LIST_ITEMS = 200`.

## Frontend (UX mirror) — `lib/validation.ts`
- Reuse `validateText(value, rules)` and the primitives `required`, `maxLen`, `isEmail`,
  `isPhone`, `hasDangerousContent`, `sanitizeText`. Same LIMITS as the backend.
- Order: **required → length → dangerous-content → format** (length before regex).
- Disable submit while invalid; show the inline Romanian error per field.

## Always reject
- Empty / whitespace-only on a required field → 422.
- Over `max_length` / under `min_length` → 422.
- Control characters, raw HTML / `<script>` in plain text.
- Non-https URL or a disallowed scheme; enum outside its set.

## Verify
- `cd backend && ./.venv/bin/python -m pytest -q backend/tests/test_api.py` (validation cases).
- `npx vitest run lib/__tests__/validation.test.ts`.
- Live: `scripts/verify-api.sh` (bad email / empty / oversized → 422).

Related: [[security-xss-prevention]], [[security-script-blocking]], [[security-sql-injection]].
