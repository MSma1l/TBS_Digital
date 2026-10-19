"""
CRM lead intake integration (Nexa CRM).

Pushes every new contact-form submission ("lead") into the company CRM, where it becomes
a client with status "Nou". Mirrors the Telegram integration's contract: best-effort,
never in the way of ``POST /api/contact`` — but, unlike Telegram, *reliable*: the
delivery state lives on the submission row (an outbox), so a CRM outage only delays a
lead, it never loses it.

The whole package is a no-op when ``CRM_LEADS_URL`` or ``CRM_LEADS_SECRET`` is empty
(see config.py).

Modules:
- ``client``  — payload building, HMAC signing and the single signed POST (httpx).
- ``service`` — the outbox: claim a row, deliver it, record the outcome, back off.
- ``worker``  — the background task scheduled by the contact router, and the periodic
  retry loop started from app.main's lifespan.

See docs/17-crm.md.
"""
