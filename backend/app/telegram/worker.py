"""
Long-poll worker.

Started from ``app.main``'s lifespan (only when the integration is enabled). Loops
``getUpdates`` and dispatches:

- ``callback_query`` ``lead:<id>:<status>`` -> update the submission status, edit the
  message to reflect it (keyboard preserved), and answer the callback.
- ``/register`` (also ``/register@<bot>``) in a group -> capture the chat as the target.
- ``/stats`` -> reply with :func:`service.build_stats`.
- ``/start`` / ``/help`` -> short help text.

Robust by design: every update is processed in its own try/except, the offset keeps
advancing, and network errors trigger a short backoff. It must never crash the app.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

from sqlmodel import Session

from ..config import get_settings
from ..db import get_engine
from . import service
from .client import TelegramClient, escape

logger = logging.getLogger("app.telegram")

_HELP_TEXT = (
    "🤖 <b>TBS Digital — bot lead-uri</b>\n"
    "Primești aici fiecare cerere nouă din formularul de contact, pe top-uri "
    "pe fiecare serviciu, cu butoane de clasificare.\n\n"
    "Comenzi:\n"
    "/register — leagă acest grup ca destinație pentru lead-uri\n"
    "/stats — statistici lead-uri\n"
    "/help — acest mesaj"
)


def _command(text: Optional[str], bot_username: Optional[str]) -> Optional[str]:
    """Return the bare command (e.g. ``register``) for a ``/cmd`` or ``/cmd@bot``."""
    if not text:
        return None
    token = text.strip().split()[0] if text.strip() else ""
    if not token.startswith("/"):
        return None
    cmd = token[1:]
    if "@" in cmd:
        cmd, _, target = cmd.partition("@")
        if bot_username and target and target.lower() != bot_username.lower():
            return None  # addressed at a different bot
    return cmd.lower()


async def _handle_callback(
    session: Session, client: TelegramClient, cq: Dict[str, Any]
) -> None:
    data = cq.get("data") or ""
    parsed = service.parse_callback_data(data)
    if parsed is None:
        await client.answer_callback_query(cq.get("id", ""))
        return

    submission_id, status = parsed
    row = service.apply_status(session, submission_id, status)
    if row is None:
        await client.answer_callback_query(cq.get("id", ""), text="Lead inexistent")
        return

    message = cq.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    message_id = message.get("message_id")
    if chat_id is not None and message_id is not None:
        await client.edit_message_text(
            chat_id,
            message_id,
            service.format_lead_message(row),
            reply_markup=service.classification_keyboard(row.id),
        )
    await client.answer_callback_query(
        cq.get("id", ""), text=f"Status: {service.status_label(status)}"
    )


async def _handle_message(
    session: Session,
    client: TelegramClient,
    message: Dict[str, Any],
    bot_username: Optional[str],
) -> None:
    cmd = _command(message.get("text"), bot_username)
    if cmd is None:
        return

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    chat_type = chat.get("type")
    thread_id = message.get("message_thread_id")

    if cmd == "register":
        if chat_type not in ("group", "supergroup") or chat_id is None:
            await client.send_message(
                chat_id, "ℹ️ Rulează /register într-un grup.", message_thread_id=thread_id
            )
            return
        is_forum = bool(chat.get("is_forum"))
        service.set_target(session, chat_id, is_forum)
        # Make sure the general ("Altele") topic exists up-front on a forum.
        if is_forum:
            await service.ensure_topic(session, client, chat_id, "", is_forum=True)
        title = escape(chat.get("title") or "acest grup")
        await client.send_message(
            chat_id,
            f"✅ Înregistrat! Lead-urile noi vor apărea în <b>{title}</b>"
            + (" (pe top-uri per serviciu)." if is_forum else "."),
            message_thread_id=thread_id,
        )
        return

    if cmd == "stats":
        target_thread = thread_id
        _, is_forum = service.resolve_target(session)
        if is_forum and chat_id is not None:
            target_thread = await service.ensure_topic(
                session, client, chat_id, "", is_forum=True
            )
        await client.send_message(
            chat_id, service.build_stats(session), message_thread_id=target_thread
        )
        return

    if cmd in ("start", "help"):
        await client.send_message(chat_id, _HELP_TEXT, message_thread_id=thread_id)
        return


async def process_update(
    session: Session,
    client: TelegramClient,
    update: Dict[str, Any],
    bot_username: Optional[str] = None,
) -> None:
    """Dispatch a single update. Raises nothing meaningful for the caller to handle
    beyond what it chooses to log."""
    if "callback_query" in update:
        await _handle_callback(session, client, update["callback_query"])
    elif "message" in update:
        await _handle_message(session, client, update["message"], bot_username)


async def run_worker(poll_timeout: int = 30) -> None:
    """The long-poll loop. Returns immediately when the integration is disabled."""
    settings = get_settings()
    if not settings.telegram_is_enabled:
        logger.info("Telegram worker not started (disabled or no token).")
        return

    client = TelegramClient(settings.telegram_bot_token)
    me = await client.get_me()
    bot_username = me.get("username") if isinstance(me, dict) else None
    if me is None:
        logger.warning("Telegram getMe failed; worker will keep retrying.")
    else:
        logger.info("Telegram worker started as @%s", bot_username)

    offset: Optional[int] = None
    backoff = 1.0
    while True:
        try:
            updates = await client.get_updates(offset, timeout=poll_timeout)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # defensive — client already swallows most errors
            logger.warning("Telegram getUpdates raised: %s", exc)
            updates = None

        if updates is None:
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)
            continue
        backoff = 1.0

        for update in updates:
            offset = update.get("update_id", 0) + 1  # always advance
            try:
                with Session(get_engine()) as session:
                    await process_update(session, client, update, bot_username)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("Telegram: error handling update: %s", exc)
