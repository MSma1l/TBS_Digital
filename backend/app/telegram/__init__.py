"""
Telegram lead-notification integration.

Posts every new contact-form submission ("lead") into a Telegram group, organised by
forum *topics* per service, with inline classification buttons, and answers a `/stats`
command. Uses long-polling (``getUpdates``) so no public webhook URL is required — it
works in local dev.

The whole package is a no-op when ``TELEGRAM_BOT_TOKEN`` is empty (see config.py).

Modules:
- ``client``  — a thin async wrapper over the Telegram Bot API (httpx).
- ``service`` — domain logic: topic resolution, message formatting, stats.
- ``worker``  — the long-poll loop (started from app.main's lifespan).
"""
