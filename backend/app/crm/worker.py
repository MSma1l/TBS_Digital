"""
Entry points that run the CRM outbox.

- ``push_lead_task`` — the FastAPI BackgroundTask the contact router schedules right
  after a submission is saved: the first attempt, a few milliseconds after the 201.
- ``run_worker`` — a small periodic loop (started from app.main's lifespan, only when the
  integration is enabled) that retries pending leads once their back-off has elapsed, and
  catches any lead whose background task never ran (e.g. the process restarted).

Both swallow everything: the CRM must never break or slow the site.
"""

import asyncio
import logging

from ..config import get_settings
from . import service

logger = logging.getLogger("app.crm")

# Seconds between two outbox sweeps. The shortest back-off is 60 s, so a finer tick buys
# nothing; the first attempt doesn't wait for it (push_lead_task fires immediately).
POLL_INTERVAL_SECONDS = 60.0


async def push_lead_task(submission_id: str) -> None:
    """FastAPI BackgroundTask: first delivery attempt for a just-saved lead."""
    if not get_settings().crm_is_enabled:
        return
    try:
        await service.deliver(submission_id)
    except Exception as exc:  # deliver() classifies HTTP failures; this is the DB etc.
        # Class name only: a DB error message can carry the lead's personal data.
        logger.warning("CRM: push task for lead %s failed (%s)", submission_id, type(exc).__name__)


async def run_worker(interval: float = POLL_INTERVAL_SECONDS) -> None:
    """Sweep the outbox forever. Returns immediately when the integration is disabled."""
    if not get_settings().crm_is_enabled:
        logger.info("CRM worker not started (CRM_LEADS_URL / CRM_LEADS_SECRET unset).")
        return
    logger.info("CRM outbox worker started (every %.0fs).", interval)
    while True:
        try:
            await service.process_due()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("CRM: outbox sweep failed (%s)", type(exc).__name__)
        await asyncio.sleep(interval)
