"""
The CRM outbox: delivery state lives on the submission row itself.

Lifecycle of ``SubmissionRow.crm_status``:

- ``""``        — never queued (the CRM was off when the lead arrived, or the row predates
                  the integration). Nothing ever picks it up unless an admin re-sends it.
- ``"pending"`` — waiting for its first or next attempt at ``crm_next_attempt_at``.
- ``"sent"``    — the CRM confirmed it (201 created / 200 duplicate|merged).
- ``"failed"``  — permanent: a 4xx the same request can't get past, or the retry budget
                  (``MAX_ATTEMPTS``) is spent. An admin can re-queue it.

**Safe with several app workers.** Before sending, a worker *claims* the row with one
conditional ``UPDATE … WHERE crm_status='pending' AND crm_next_attempt_at <= now`` that
pushes ``crm_next_attempt_at`` into the future (a lease). Exactly one worker's UPDATE
matches; the others see rowcount 0 and skip. The lease value doubles as the claim token:
the outcome is written only if the row still carries it. Should a process die mid-send,
the lease simply expires and the row becomes due again. The worst case is a rare second
send of the same lead — harmless, because the CRM dedupes on ``externalId``.
"""

import logging
import time
from typing import Any, List, Optional

import httpx
from sqlalchemy import update
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from ..config import get_settings
from ..db import get_engine
from ..models import SubmissionRow
from . import client
from .client import FAILED, RETRY, SENT, DeliveryResult

logger = logging.getLogger("app.crm")

PENDING = "pending"

# Total attempts per lead, and the wait after attempt 1…7 (attempt 8 is the last).
# 1 min · 5 min · 15 min · 1 h · 3 h · 6 h · 12 h  ≈ 22 h from the first try to the last.
MAX_ATTEMPTS = 8
BACKOFF_SECONDS = (60, 300, 900, 3600, 3 * 3600, 6 * 3600, 12 * 3600)

# How long a claimed row stays invisible to other workers. Far above the 5 s request
# timeout, so a live attempt always finishes inside its own lease.
CLAIM_LEASE_SECONDS = 120

# How many due leads one worker tick handles (the rest wait for the next tick).
BATCH_SIZE = 20

# Test seam: an ``httpx.MockTransport`` installed by the tests. Always None in production.
TRANSPORT: Optional[httpx.AsyncBaseTransport] = None


def _now() -> int:
    return int(time.time())


def backoff_after(attempts: int) -> int:
    """Seconds to wait after the ``attempts``-th failed attempt."""
    index = min(max(attempts, 1), len(BACKOFF_SECONDS)) - 1
    return BACKOFF_SECONDS[index]


def claim(engine: Engine, submission_id: str, now: int) -> Optional[int]:
    """Atomically take a due pending row. Returns the lease (claim token) or None."""
    lease = now + CLAIM_LEASE_SECONDS
    with engine.begin() as conn:
        result = conn.execute(
            update(SubmissionRow)
            .where(SubmissionRow.id == submission_id)
            .where(SubmissionRow.crm_status == PENDING)
            .where(SubmissionRow.crm_next_attempt_at <= now)
            .values(crm_next_attempt_at=lease)
        )
    return lease if result.rowcount == 1 else None


def _record(
    engine: Engine,
    submission_id: str,
    lease: int,
    *,
    status: str,
    attempts: int,
    next_attempt_at: int,
    error: str,
) -> None:
    """Write an attempt's outcome — only while the row still carries our claim token."""
    with engine.begin() as conn:
        conn.execute(
            update(SubmissionRow)
            .where(SubmissionRow.id == submission_id)
            .where(SubmissionRow.crm_status == PENDING)
            .where(SubmissionRow.crm_next_attempt_at == lease)
            .values(
                crm_status=status,
                crm_attempts=attempts,
                crm_next_attempt_at=next_attempt_at,
                crm_last_error=error[: client.MAX_ERROR_LENGTH],
            )
        )


async def deliver(
    submission_id: str,
    *,
    engine: Optional[Engine] = None,
    settings: Any = None,
    transport: Optional[httpx.AsyncBaseTransport] = None,
    now: Optional[int] = None,
) -> Optional[DeliveryResult]:
    """Claim one pending submission and push it to the CRM.

    Returns the attempt's result, or None when nothing was attempted (integration off,
    row missing, not pending, not yet due, or claimed by another worker).
    """
    settings = settings or get_settings()
    if not settings.crm_is_enabled:
        return None
    engine = engine or get_engine()
    now = _now() if now is None else now

    lease = claim(engine, submission_id, now)
    if lease is None:
        return None
    with Session(engine) as session:
        row = session.get(SubmissionRow, submission_id)
        if row is None:
            return None
        payload = client.build_payload(row)
        previous_attempts = row.crm_attempts or 0

    result = await client.push_lead(
        settings.crm_leads_url,
        settings.crm_leads_secret,
        payload,
        transport=transport or TRANSPORT,
    )
    attempts = previous_attempts + 1

    if result.outcome == SENT:
        _record(engine, submission_id, lease, status=SENT, attempts=attempts,
                next_attempt_at=0, error="")
        logger.info("CRM: lead %s delivered (HTTP %s)", submission_id, result.status_code)
    elif result.outcome == RETRY and attempts < MAX_ATTEMPTS:
        wait = backoff_after(attempts)
        _record(engine, submission_id, lease, status=PENDING, attempts=attempts,
                next_attempt_at=now + wait, error=result.error)
        logger.warning(
            "CRM: lead %s not delivered to %s (%s); attempt %d/%d, retrying in %ds",
            submission_id, client.endpoint_label(settings.crm_leads_url),
            result.error, attempts, MAX_ATTEMPTS, wait,
        )
    else:
        error = result.error
        if result.outcome == RETRY:
            error = f"gave up after {attempts} attempts; last: {result.error}"
        _record(engine, submission_id, lease, status=FAILED, attempts=attempts,
                next_attempt_at=0, error=error)
        if result.status_code == 401:
            logger.error(
                "CRM: %s rejected the request signature (401) — CRM_LEADS_SECRET does not "
                "match the CRM's key for this lead source (or CRM_LEADS_URL points at the "
                "wrong source). Lead %s marked failed; fix the config and re-send it from "
                "the admin panel.",
                client.endpoint_label(settings.crm_leads_url), submission_id,
            )
        else:
            logger.error("CRM: lead %s failed permanently: %s", submission_id, error)
    return result


def due_ids(engine: Engine, now: int, limit: int = BATCH_SIZE) -> List[str]:
    """Pending submissions whose next attempt is due, oldest schedule first."""
    with Session(engine) as session:
        return list(
            session.exec(
                select(SubmissionRow.id)
                .where(SubmissionRow.crm_status == PENDING)
                .where(SubmissionRow.crm_next_attempt_at <= now)
                .order_by(SubmissionRow.crm_next_attempt_at)
                .limit(limit)
            ).all()
        )


async def process_due(
    *,
    engine: Optional[Engine] = None,
    settings: Any = None,
    transport: Optional[httpx.AsyncBaseTransport] = None,
    now: Optional[int] = None,
) -> int:
    """One worker tick: attempt every due lead (up to BATCH_SIZE). Returns attempts made."""
    settings = settings or get_settings()
    if not settings.crm_is_enabled:
        return 0
    engine = engine or get_engine()
    now = _now() if now is None else now
    attempted = 0
    for submission_id in due_ids(engine, now):
        result = await deliver(
            submission_id, engine=engine, settings=settings, transport=transport, now=now
        )
        if result is not None:
            attempted += 1
    return attempted


def requeue(submission_id: str, *, engine: Optional[Engine] = None) -> Optional[SubmissionRow]:
    """Admin re-send: put a lead back in the outbox with a fresh retry budget."""
    engine = engine or get_engine()
    with Session(engine) as session:
        row = session.get(SubmissionRow, submission_id)
        if row is None:
            return None
        row.crm_status = PENDING
        row.crm_attempts = 0
        row.crm_next_attempt_at = 0
        row.crm_last_error = ""
        session.add(row)
        session.commit()
        session.refresh(row)
        return row
