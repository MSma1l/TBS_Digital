"""
Test-session bootstrap.

Imported by pytest before any test module (and therefore before ``app`` is imported
and its settings are cached). We force the Telegram integration OFF here so tests are
hermetic and never touch the network, regardless of a developer's local ``backend/.env``
(which may carry a real bot token). Environment variables take precedence over the
``.env`` file in pydantic-settings, so these win.
"""

import os

os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_GROUP_CHAT_ID"] = ""
os.environ["TELEGRAM_ENABLED"] = "false"
