"""
Background-task entry point for lead notifications.

Kept separate from ``service`` so the contact router depends on a tiny, side-effect-
free import. The task opens its own DB session (background tasks run after the request
session is closed) and swallows everything — a Telegram failure must never surface.
"""

import logging
from typing import Any

from sqlmodel import Session

from ..config import get_settings
from ..db import get_engine
from .service import notify_new_lead

logger = logging.getLogger("app.telegram")


async def notify_new_lead_task(submission: Any) -> None:
    """FastAPI BackgroundTask: post a saved submission to Telegram (best-effort)."""
    if not get_settings().telegram_is_enabled:
        return
    try:
        with Session(get_engine()) as session:
            await notify_new_lead(session, submission)
    except Exception as exc:  # belt-and-suspenders; notify_new_lead already guards
        logger.warning("Telegram: notify task failed: %s", exc)
