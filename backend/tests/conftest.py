"""
Test-session bootstrap.

Imported by pytest before any test module (and therefore before ``app`` is imported
and its settings are cached). We force the Telegram integration OFF here so tests are
hermetic and never touch the network (the CRM push likewise), regardless of a developer's local ``backend/.env``
(which may carry a real bot token). Environment variables take precedence over the
``.env`` file in pydantic-settings, so these win.
"""

import os

os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_GROUP_CHAT_ID"] = ""
os.environ["TELEGRAM_ENABLED"] = "false"
# Same for the CRM push (app/crm): off unless a test switches it on explicitly.
os.environ["CRM_LEADS_URL"] = ""
os.environ["CRM_LEADS_SECRET"] = ""
# Keep tests hermetic and deterministic: never treat the suite as production,
# and disable request rate limiting so repeated calls don't hit 429.
os.environ["ENVIRONMENT"] = "development"
os.environ["RATE_LIMIT_ENABLED"] = "false"
