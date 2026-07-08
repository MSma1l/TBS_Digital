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

import html
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("app.telegram")

API_BASE = "https://api.telegram.org"


def escape(value: object) -> str:
    """HTML-escape a dynamic value for safe inclusion in an HTML-parse-mode message."""
    return html.escape("" if value is None else str(value), quote=False)


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
        try:
            async with httpx.AsyncClient(timeout=timeout or self._timeout) as client:
                resp = await client.post(url, json=params or {})
            data = resp.json()
        except Exception as exc:  # network error, JSON decode error, ...
            logger.warning("Telegram %s call failed: %s", method, exc)
            return None
        if not isinstance(data, dict) or not data.get("ok"):
            logger.warning("Telegram %s returned an error: %s", method, data)
            return None
        return data.get("result")

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
