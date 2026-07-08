---
name: security-sql-injection
description: Keep the app SQLi-proof — ONLY parameterized ORM queries, never raw SQL / text() / f-string / .format() with user input. Use when writing or reviewing any database query in TBS Digital, or when the user asks about "SQL injection / raw SQL / query".
---

# SQL injection prevention

**Rule:** ALL database access goes through the SQLModel / SQLAlchemy ORM with bound parameters.
There is **no** raw SQL anywhere, and there must never be.

## Do
- `session.get(SubmissionRow, id)`
- `session.exec(select(UserRow).where(UserRow.username == username))`
- `session.exec(select(X).order_by(...).offset(o).limit(l))`
- `session.add(row)` / `session.delete(row)` / `delete(PartnerRow)`

All of these bind parameters — a value like `'; DROP TABLE users;--` is stored as literal text.

## Never
- `sqlalchemy.text(f"... {user_value} ...")`
- `session.execute("SELECT ... " + user_value)`
- `.format()` / f-strings building a query from user input.

> Note: the helper `validators.text(...)` is unrelated to `sqlalchemy.text` — do not confuse them.

## Review checklist
- `grep -rEn "text\(|\.execute\(|\.format\(|f\"SELECT|f\"INSERT" backend/app` → only the
  validator helper should match; any SQL string is a bug.
- New store methods must extend the `ContentStore` interface (`storage/base.py`) using ORM only.

## Verify
- `backend/tests/test_api.py` submits a SQLi string and asserts the `users` table + content are
  intact and login still works.

Related: [[security-input-validation]], [[security-pentest]].
