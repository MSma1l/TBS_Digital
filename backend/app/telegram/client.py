"""
Thin async Telegram Bot API client.

Every method issues a single ``POST`` against ``https://api.telegram.org/bot<token>/``
and returns the parsed ``result`` (or ``None`` on any error). Errors — network failures,
non-2xx responses, or ``{"ok": false}`` payloads — are logged and swallowed so a flaky
Telegram never raises into the caller (the HTTP submission must still succeed).

Dynamic text that goes into messages must be HTML-escaped by the caller (see
``escape``); the message bodies contain intentional ``<b>``/``<a>`` markup, so this
client never escapes the whole ``text`` itself.
"""

import asyncio
import html
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("app.telegram")

API_BASE = "https://api.telegram.org"

# A burst of calls (e.g. someone tapping the classification buttons repeatedly) is
# answered with 429 + ``parameters.retry_after`` seconds. Waiting is only worth it while
# the wait is SHORT: the worker processes updates strictly sequentially
# (``worker.run_worker``), so sleeping here also stalls new lead notifications and every
# other user's taps. Past this cap we give up and let the caller move on — nothing is
# lost, because a lead's status is persisted *before* the message edit is attempted.
MAX_RETRY_AFTER = 3.0


def escape(value: object) -> str:
    """HTML-escape a dynamic value for safe inclusion in an HTML-parse-mode message."""
    return html.escape("" if value is None else str(value), quote=False)


def retry_after_seconds(data: Any) -> Optional[float]:
    """Seconds Telegram asks us to wait, for a 429 payload; None for any other error."""
    if not isinstance(data, dict) or data.get("error_code") != 429:
        return None
    params = data.get("parameters")
    value = params.get("retry_after") if isinstance(params, dict) else None
    try:
        wait = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return wait if wait >= 0 else None


class TelegramClient:
    """Minimal async Bot API client. One short-lived httpx client per call."""

    def __init__(self, token: str, *, timeout: float = 20.0) -> None:
        self._token = token
        self._base = f"{API_BASE}/bot{token}"
        self._timeout = timeout

    async def _call(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        *,
        timeout: Optional[float] = None,
    ) -> Optional[Any]:
        url = f"{self._base}/{method}"
        # Two attempts at most, and the second one only ever happens for a short 429
        # back-off — every other failure returns immediately, as before.
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=timeout or self._timeout) as client:
                    resp = await client.post(url, json=params or {})
                data = resp.json()
            except Exception as exc:  # network error, JSON decode error, ...
                logger.warning("Telegram %s call failed: %s", method, exc)
                return None
            if isinstance(data, dict) and data.get("ok"):
                return data.get("result")
            wait = retry_after_seconds(data)
            if attempt == 0 and wait is not None and wait <= MAX_RETRY_AFTER:
                logger.info(
                    "Telegram %s rate-limited; retrying in %.1fs", method, wait
                )
                await asyncio.sleep(wait)
                continue
            logger.warning("Telegram %s returned an error: %s", method, data)
            return None
        return None

    # --- API methods -------------------------------------------------------------
    async def get_me(self) -> Optional[Dict[str, Any]]:
        return await self._call("getMe")

    async def get_updates(
        self, offset: Optional[int] = None, timeout: int = 30
    ) -> Optional[List[Dict[str, Any]]]:
        """Long-poll for updates. HTTP timeout comfortably exceeds the poll timeout."""
        params: Dict[str, Any] = {
            "timeout": timeout,
            "allowed_updates": ["message", "callback_query"],
        }
        if offset is not None:
            params["offset"] = offset
        result = await self._call(
            "getUpdates", params, timeout=float(timeout) + 15.0
        )
        return result if isinstance(result, list) else None

    async def send_message(
        self,
        chat_id: Any,
        text: str,
        message_thread_id: Optional[int] = None,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = "HTML",
    ) -> Optional[Dict[str, Any]]:
        params: Dict[str, Any] = {"chat_id": chat_id, "text": text}
        if parse_mode:
            params["parse_mode"] = parse_mode
        if message_thread_id is not None:
            params["message_thread_id"] = message_thread_id
        if reply_markup is not None:
            params["reply_markup"] = reply_markup
        return await self._call("sendMessage", params)

    async def create_forum_topic(
        self, chat_id: Any, name: str
    ) -> Optional[int]:
        """Create a forum topic; return its ``message_thread_id`` (or None on error)."""
        result = await self._call(
            "createForumTopic", {"chat_id": chat_id, "name": name}
        )
        if isinstance(result, dict):
            return result.get("message_thread_id")
        return None

    async def answer_callback_query(
        self, callback_query_id: str, text: Optional[str] = None
    ) -> Optional[Any]:
        params: Dict[str, Any] = {"callback_query_id": callback_query_id}
        if text is not None:
            params["text"] = text
        return await self._call("answerCallbackQuery", params)

    async def edit_message_text(
        self,
        chat_id: Any,
        message_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = "HTML",
    ) -> Optional[Any]:
        params: Dict[str, Any] = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        }
        if parse_mode:
            params["parse_mode"] = parse_mode
        if reply_markup is not None:
            params["reply_markup"] = reply_markup
        return await self._call("editMessageText", params)

    async def get_chat(self, chat_id: Any) -> Optional[Dict[str, Any]]:
        return await self._call("getChat", {"chat_id": chat_id})
