"""
CRM intake client: build the lead payload, sign it, POST it once, classify the answer.

Contract (owned by the CRM side — keep it exact):

- ``POST <CRM_LEADS_URL>`` with ``Content-Type: application/json``.
- ``X-CRM-Timestamp: <unix seconds>`` and
  ``X-CRM-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body bytes>")>``.
  The body is serialised to bytes **once**; those exact bytes are signed and sent.
- Body: ``externalId``, ``name``, ``email``, ``createdAt`` plus the optional ``phone``,
  ``message``, ``project``, ``estimate`` (omitted when empty). The CRM rejects unknown
  fields with 400, so nothing else is ever added.
- 201 ``created`` / 200 ``duplicate|merged`` → delivered. 400 → permanent. 401 → bad
  key or URL (permanent until an operator fixes the config). 429 / 5xx / network /
  timeout → retry later.

Nothing here logs or returns the secret: error strings are built from the status code
and the exception *class*, never from a message that could echo request data.
"""

import hashlib
import hmac
import html
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

import httpx

logger = logging.getLogger("app.crm")

TIMEOUT_SECONDS = 5.0
MAX_ERROR_LENGTH = 300

# Field caps the CRM enforces (it answers 400 above them). Our own validation is already
# at or below these; truncating here is only a guard so a stray long value can never turn
# a deliverable lead into a permanent 400.
_LIMITS = {
    "name": 120,
    "email": 254,
    "phone": 40,
    "message": 5000,
    "project": 160,
    "estimate": 80,
}

# Outcomes of one delivery attempt.
SENT = "sent"  # the CRM has the lead (created, duplicate or merged)
RETRY = "retry"  # transient — try again later
FAILED = "failed"  # permanent — retrying the same request cannot succeed


@dataclass(frozen=True)
class DeliveryResult:
    outcome: str  # SENT | RETRY | FAILED
    status_code: Optional[int] = None
    error: str = ""  # short, secret-free, <= MAX_ERROR_LENGTH


def _clip(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[:limit]


def build_payload(submission: Any) -> Dict[str, str]:
    """The CRM body for a stored submission (any object with the lead attributes)."""

    def get(name: str) -> str:
        return str(getattr(submission, name, "") or "").strip()

    payload: Dict[str, str] = {
        "externalId": get("id"),
        "name": _clip(get("name"), _LIMITS["name"]),
        # The email is the one field still HTML-escaped on the way in (schemas.StoredEmail);
        # undo it so an address like o'neil@… reaches the CRM as typed.
        "email": _clip(html.unescape(get("email")), _LIMITS["email"]),
    }
    for field in ("phone", "message", "project", "estimate"):
        value = get(field)
        if value:
            payload[field] = _clip(value, _LIMITS[field])
    payload["createdAt"] = get("created_at")
    return payload


def serialize(payload: Dict[str, str]) -> bytes:
    """Serialise once, deterministically. These exact bytes are signed *and* sent."""
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """``sha256=<hex>`` over ``"<timestamp>." + body`` with the shared secret."""
    digest = hmac.new(
        secret.encode("utf-8"), timestamp.encode("ascii") + b"." + body, hashlib.sha256
    ).hexdigest()
    return f"sha256={digest}"


def endpoint_label(url: str) -> str:
    """What may appear in logs for the endpoint: scheme + host only (no integration id)."""
    try:
        parts = urlsplit(url)
        return f"{parts.scheme}://{parts.hostname or '?'}"
    except ValueError:
        return "<invalid url>"


def _error(text: str, secret: str) -> str:
    if secret:
        text = text.replace(secret, "***")
    return _clip(text, MAX_ERROR_LENGTH)


def _classify(response: httpx.Response, secret: str) -> DeliveryResult:
    code = response.status_code
    if 200 <= code < 300:
        return DeliveryResult(SENT, code)
    if code == 429 or code == 408 or code >= 500:
        return DeliveryResult(RETRY, code, _error(f"HTTP {code}", secret))
    if code == 401:
        return DeliveryResult(
            FAILED, code, _error("HTTP 401: signature rejected — check CRM_LEADS_SECRET", secret)
        )
    if 300 <= code < 400:
        # Redirects are never followed (they would re-send personal data to wherever the
        # Location points). A redirect means CRM_LEADS_URL is wrong — e.g. http vs https.
        return DeliveryResult(
            FAILED, code, _error(f"HTTP {code}: redirect not followed — check CRM_LEADS_URL", secret)
        )
    # 400 (validation) and every other 4xx (404 unknown integration, 403 disabled source…):
    # the same request will fail the same way. Keep a short slice of the CRM's answer.
    detail = ""
    try:
        detail = response.text.strip().replace("\n", " ")[:200]
    except Exception:  # undecodable body — the status code is enough
        pass
    return DeliveryResult(
        FAILED, code, _error(f"HTTP {code}: {detail}" if detail else f"HTTP {code}", secret)
    )


async def push_lead(
    url: str,
    secret: str,
    payload: Dict[str, str],
    *,
    transport: Optional[httpx.AsyncBaseTransport] = None,
    timeout: float = TIMEOUT_SECONDS,
    now: Optional[float] = None,
) -> DeliveryResult:
    """One signed POST to the CRM. Never raises; the outcome says what to do next.

    ``transport`` is a test seam (``httpx.MockTransport``); production passes nothing.
    """
    body = serialize(payload)
    timestamp = str(int(now if now is not None else time.time()))
    headers = {
        "Content-Type": "application/json",
        "X-CRM-Timestamp": timestamp,
        "X-CRM-Signature": sign(secret, timestamp, body),
    }
    try:
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=False, transport=transport
        ) as client:
            response = await client.post(url, content=body, headers=headers)
    except httpx.TimeoutException as exc:
        return DeliveryResult(RETRY, None, _error(f"timeout ({type(exc).__name__})", secret))
    except Exception as exc:  # connection refused, DNS, TLS, …
        # Only the class name: some exception messages echo the request (URL, headers).
        return DeliveryResult(RETRY, None, _error(f"network error ({type(exc).__name__})", secret))
    return _classify(response, secret)
