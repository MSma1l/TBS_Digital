"""
Telegram domain logic: service→topic mapping, lead formatting, and stats.

Kept free of any long-poll / worker concerns so it is trivially unit-testable with a
fake client (no network). Everything here is best-effort: callers wrap it in a
try/except and swallow failures so the HTTP submission always returns 201.
"""

import html
import logging
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import Session, select

from ..config import get_settings
from ..models import SubmissionRow, TelegramSetting, TelegramTopic
from .client import TelegramClient, escape

logger = logging.getLogger("app.telegram")

# --- Services --------------------------------------------------------------------
# (key, human title). Keys mirror lib/content.ts so a topic maps 1:1 to a service.
# The incoming submission carries the free-text service *name* in ``project``; we
# normalise it back to one of these keys (unknown/empty -> the "general" bucket).
SERVICE_TOPICS: List[Tuple[str, str]] = [
    ("landing", "Landing page"),
    ("site", "Site web / prezentare"),
    ("shop", "Magazin online"),
    ("mobile", "Aplicație mobilă"),
    ("crm", "CRM personalizat"),
    ("saas", "Platformă SaaS"),
    ("automation", "Automatizare procese"),
    ("dashboard", "Dashboard & rapoarte"),
    ("bot", "Bot Telegram"),
    ("ai", "Automatizare cu IA"),
    ("custom", "Software personalizat"),
]

GENERAL_KEY = "general"
GENERAL_TITLE = "Altele"

_TITLE_BY_KEY: Dict[str, str] = {k: t for k, t in SERVICE_TOPICS}
_TITLE_BY_KEY[GENERAL_KEY] = GENERAL_TITLE


def _normalise(name: object) -> str:
    """Lower/trim and undo HTML-escaping so escaped and raw names compare equal."""
    return html.unescape(str(name or "")).strip().lower()


_KEY_BY_NAME: Dict[str, str] = {_normalise(t): k for k, t in SERVICE_TOPICS}


def service_key_for(project_name: object) -> str:
    """Map a free-text service name to a known key, or the general bucket."""
    return _KEY_BY_NAME.get(_normalise(project_name), GENERAL_KEY)


def topic_title_for(key: str) -> str:
    return _TITLE_BY_KEY.get(key, GENERAL_TITLE)


def service_display(project_name: object) -> str:
    """The canonical service title for a submission's ``project`` value."""
    return topic_title_for(service_key_for(project_name))


# --- Lead classification ---------------------------------------------------------
# (status_key, button/label). Order defines the inline-keyboard order.
STATUSES: List[Tuple[str, str]] = [
    ("nou", "🆕 Nou"),
    ("contactat", "📞 Contactat"),
    ("oferta", "💰 Ofertă"),
    ("castigat", "✅ Câștigat"),
    ("pierdut", "❌ Pierdut"),
]
STATUS_LABELS: Dict[str, str] = {k: v for k, v in STATUSES}
STATUS_KEYS = {k for k, _ in STATUSES}

CALLBACK_PREFIX = "lead"


def status_label(status: Optional[str]) -> str:
    return STATUS_LABELS.get(status or "nou", STATUS_LABELS["nou"])


def classification_keyboard(submission_id: str) -> Dict[str, Any]:
    """Inline keyboard; callback_data is ``lead:<id>:<status>``."""
    buttons = [
        {"text": label, "callback_data": f"{CALLBACK_PREFIX}:{submission_id}:{key}"}
        for key, label in STATUSES
    ]
    # Two rows for a tidy layout (3 + 2).
    return {"inline_keyboard": [buttons[:3], buttons[3:]]}


def parse_callback_data(data: str) -> Optional[Tuple[str, str]]:
    """Parse ``lead:<id>:<status>`` -> (submission_id, status), or None."""
    if not data or not data.startswith(CALLBACK_PREFIX + ":"):
        return None
    body = data[len(CALLBACK_PREFIX) + 1 :]
    if ":" not in body:
        return None
    submission_id, status = body.rsplit(":", 1)
    if not submission_id or status not in STATUS_KEYS:
        return None
    return submission_id, status


# --- Authorization ---------------------------------------------------------------
def is_authorized(
    user_id: Any,
    chat_id: Any,
    settings: Any,
    current_target_chat_id: Optional[str],
) -> bool:
    """Decide whether a Telegram user may run privileged actions (/register, /stats,
    classification buttons).

    There is no cheap way to fetch a group's admin list from the Bot API, so trust is
    based on two static signals:

    - **Allowlist:** ``user_id`` is one of ``settings.telegram_admin_id_set`` (the
      ids from ``TELEGRAM_ADMIN_IDS``). This is the recommended production control.
    - **Bound group (fallback):** *only when no allowlist is configured*, an action is
      trusted if it originates in the group already registered/pinned as the lead
      target (``chat_id == current_target_chat_id``). This keeps a zero-config single
      group working while still blocking every *other* group the bot happens to be in.

    Returns ``False`` when neither holds (e.g. unknown sender, foreign group).
    """
    admin_ids = settings.telegram_admin_id_set
    if user_id is not None:
        try:
            if int(user_id) in admin_ids:
                return True
        except (TypeError, ValueError):
            pass
    # Fall back to the bound-group trust only when no explicit allowlist is set.
    if not admin_ids and current_target_chat_id is not None:
        return str(chat_id) == str(current_target_chat_id)
    return False


# --- Target resolution -----------------------------------------------------------
def resolve_target(session: Session) -> Tuple[Optional[str], bool]:
    """Return ``(group_chat_id, is_forum)``: env var first, else the /register row."""
    settings = get_settings()
    env_id = (settings.telegram_group_chat_id or "").strip()
    if env_id:
        # is_forum unknown for an env-provided id — assume forum; ensure_topic falls
        # back to the group root if createForumTopic fails (non-forum chat).
        return env_id, True
    row = session.exec(select(TelegramSetting)).first()
    if row and row.group_chat_id:
        return row.group_chat_id, bool(row.is_forum)
    return None, False


def set_target(session: Session, chat_id: Any, is_forum: bool) -> None:
    """Persist the group captured via /register (single-row settings table)."""
    row = session.exec(select(TelegramSetting)).first()
    if row is None:
        row = TelegramSetting(id=1)
    row.group_chat_id = str(chat_id)
    row.is_forum = bool(is_forum)
    session.add(row)
    session.commit()


async def ensure_topic(
    session: Session,
    client: TelegramClient,
    chat_id: Any,
    service_name: object,
    is_forum: bool = True,
) -> Optional[int]:
    """Look up / create the forum topic for a service; return its thread id.

    Returns ``None`` (post to the group root) when the chat is not a forum or the
    topic could not be created.
    """
    key = service_key_for(service_name)
    row = session.exec(
        select(TelegramTopic).where(TelegramTopic.service_key == key)
    ).first()
    if row is not None and row.thread_id is not None:
        return row.thread_id
    if not is_forum:
        return None

    title = topic_title_for(key)
    thread_id = await client.create_forum_topic(chat_id, title)
    if thread_id is None:
        return None  # not a forum / API error -> fall back to the group root

    if row is None:
        row = TelegramTopic(service_key=key, title=title, thread_id=thread_id)
    else:
        row.title = title
        row.thread_id = thread_id
    session.add(row)
    session.commit()
    return thread_id


# --- Message formatting ----------------------------------------------------------
def _field(value: object) -> str:
    """Escaped text for stored values (which were HTML-escaped on the way in).

    Unescape then re-escape so double-escaping never leaks (e.g. ``&#x27;`` staying
    literal), while still guaranteeing inert markup.
    """
    return escape(html.unescape(str(value or "")))


def format_lead_message(submission: Any) -> str:
    """Rich HTML body for a lead. ``submission`` is any object with the lead attrs."""
    get = lambda name: getattr(submission, name, "")  # noqa: E731
    service = service_display(get("project"))
    status = status_label(get("status") or "nou")

    lines = [
        "🆕 <b>LEAD NOU</b>",
        f"🗂 <b>Serviciu:</b> {escape(service)}",
        f"👤 <b>Nume:</b> {_field(get('name'))}",
        f"✉️ <b>Email:</b> {_field(get('email'))}",
    ]
    phone = str(get("phone") or "").strip()
    if phone:
        lines.append(f"📱 <b>Telefon:</b> {_field(phone)}")
    estimate = str(get("estimate") or "").strip()
    if estimate:
        lines.append(f"💰 <b>Estimare:</b> {_field(estimate)}")
    lines.append(f"💬 <b>Mesaj:</b>\n{_field(get('message'))}")
    lines.append("")
    lines.append(f"🏷 <b>Status:</b> {escape(status)}")

    created = str(get("created_at") or "").strip()
    footer = []
    if created:
        footer.append(f"🕓 {escape(created)}")
    sid = str(get("id") or "").strip()
    if sid:
        footer.append(f"<code>#{escape(sid)}</code>")
    if footer:
        lines.append(" · ".join(footer))

    return "\n".join(lines)


async def notify_new_lead(
    session: Session,
    submission: Any,
    client: Optional[TelegramClient] = None,
) -> bool:
    """Post a lead into its service topic with classification buttons.

    Best-effort: returns True if a message was sent, False otherwise (disabled, no
    target, or any error). Never raises.
    """
    settings = get_settings()
    if client is None:
        if not settings.telegram_is_enabled:
            return False
        client = TelegramClient(settings.telegram_bot_token)

    try:
        chat_id, is_forum = resolve_target(session)
        if chat_id is None:
            logger.info("Telegram: no group registered yet; skipping lead notification")
            return False
        thread_id = await ensure_topic(
            session, client, chat_id, getattr(submission, "project", ""), is_forum
        )
        result = await client.send_message(
            chat_id,
            format_lead_message(submission),
            message_thread_id=thread_id,
            reply_markup=classification_keyboard(getattr(submission, "id", "")),
        )
        return result is not None
    except Exception as exc:  # never let Telegram break the submission flow
        logger.warning("Telegram: failed to notify new lead: %s", exc)
        return False


# --- Stats -----------------------------------------------------------------------
def build_stats(session: Session) -> str:
    """Text summary of all leads: total, per-service, per-status.

    Extension seam: add new sections below the marked comment (e.g. leads in the last
    7 days, conversion rate) — they only need to read from ``rows``.
    """
    rows = session.exec(select(SubmissionRow)).all()
    total = len(rows)

    per_service = Counter(service_display(r.project) for r in rows)
    per_status = Counter((r.status or "nou") for r in rows)

    lines = ["📊 <b>STATISTICI LEAD-URI</b>", f"Total: <b>{total}</b>"]

    lines.append("")
    lines.append("<b>Pe status:</b>")
    for key, label in STATUSES:
        lines.append(f"{escape(label)}: <b>{per_status.get(key, 0)}</b>")

    lines.append("")
    lines.append("<b>Pe serviciu:</b>")
    if per_service:
        for title, count in sorted(per_service.items(), key=lambda kv: -kv[1]):
            lines.append(f"• {escape(title)}: <b>{count}</b>")
    else:
        lines.append("<i>(niciun lead încă)</i>")

    # --- CUSTOM STATS SEAM ------------------------------------------------------
    # Add further breakdowns here, e.g.:
    #   recent = [r for r in rows if _within_last_days(r.created_at, 7)]
    #   lines += ["", f"Ultimele 7 zile: <b>{len(recent)}</b>"]
    # ----------------------------------------------------------------------------

    return "\n".join(lines)


def apply_status(session: Session, submission_id: str, status: str) -> Optional[SubmissionRow]:
    """Update a submission's status. Returns the row (or None if not found)."""
    if status not in STATUS_KEYS:
        return None
    row = session.get(SubmissionRow, submission_id)
    if row is None:
        return None
    row.status = status
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
