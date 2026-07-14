"""
Telegram lead-bot integration tests — hermetic, NEVER touches the network.

Complements ``test_telegram.py`` (unit-level, fake client) by driving the *real*
:class:`app.telegram.client.TelegramClient` against a stubbed httpx transport, so the
exact Bot API payloads are asserted (method, chat_id, message_thread_id, parse_mode,
reply_markup) — including the HTTP path: ``POST /api/contact`` → background task →
sendMessage.

Network safety, two layers:
1. ``conftest.py`` keeps ``TELEGRAM_BOT_TOKEN`` empty for the whole suite, so the
   integration is disabled by default.
2. ``_no_real_network`` (autouse) swaps the ``httpx`` name *inside*
   ``app/telegram/client.py`` for one whose ``AsyncClient`` explodes on construction.
   Tests that need the bot to "work" install a ``httpx.MockTransport`` instead
   (``telegram_api``). Any code path that tried to reach api.telegram.org for real
   would fail the test loudly.

Sections: lead notification & HTML escaping · topic routing · authorization ·
disabled = no-op · status buttons · resilience (API errors, timeouts, bad updates).
"""

import asyncio
import json
import os
import tempfile
import uuid
from types import SimpleNamespace
from typing import Any, Callable, Dict, List, Optional

# Isolated DB before importing the app (settings are cached at import). ``setdefault``
# so we join whichever temp DB an earlier test module already configured.
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-tgbot-test-"), "test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-pass")
os.environ.setdefault("JWT_SECRET", "test-secret")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, delete, select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import create_db_and_tables, get_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import SubmissionRow, TelegramSetting, TelegramTopic  # noqa: E402
from app.telegram import client as tg_client  # noqa: E402
from app.telegram import service  # noqa: E402
from app.telegram.notify import notify_new_lead_task  # noqa: E402
from app.telegram.worker import process_update, run_worker  # noqa: E402

FAKE_TOKEN = "123456:TEST-ONLY-NOT-A-REAL-TOKEN"
GROUP_ID = -1001234567890
OTHER_GROUP_ID = -1009999999999
ADMIN_UID = 111111
STRANGER_UID = 999999


# --- test doubles ----------------------------------------------------------------
class FakeTelegramAPI:
    """A stand-in for api.telegram.org: records every Bot API call it receives.

    Plugged into the real client through ``httpx.MockTransport``, so ``client.py``'s
    own request/parse/error handling is exercised rather than bypassed.
    """

    def __init__(self) -> None:
        self.calls: List[Dict[str, Any]] = []  # [{"method": ..., "payload": {...}}]
        self.overrides: Dict[str, Callable[[Dict[str, Any]], httpx.Response]] = {}
        self._next_thread = 1000

    # -- wiring
    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.url.host == "api.telegram.org"
        assert f"/bot{FAKE_TOKEN}/" in request.url.path
        method = request.url.path.rsplit("/", 1)[-1]
        payload = json.loads(request.content or b"{}")
        self.calls.append({"method": method, "payload": payload})
        override = self.overrides.get(method)
        if override is not None:
            return override(payload)  # may also raise (timeouts)
        return httpx.Response(200, json={"ok": True, "result": self._result(method, payload)})

    def _result(self, method: str, payload: Dict[str, Any]) -> Any:
        if method == "getMe":
            return {"id": 1, "is_bot": True, "username": "TestBot"}
        if method == "createForumTopic":
            self._next_thread += 1
            return {"message_thread_id": self._next_thread, "name": payload.get("name")}
        if method in ("sendMessage", "editMessageText"):
            return {"message_id": len(self.calls)}
        if method == "getUpdates":
            return []
        return True

    # -- helpers for assertions
    def payloads(self, method: str) -> List[Dict[str, Any]]:
        return [c["payload"] for c in self.calls if c["method"] == method]

    def methods(self) -> List[str]:
        return [c["method"] for c in self.calls]

    def last(self, method: str) -> Dict[str, Any]:
        found = self.payloads(method)
        assert found, f"no {method} call was made (calls: {self.methods()})"
        return found[-1]

    # -- failure injection
    def fail(self, method: str, *, status: int = 200, body: Optional[Any] = None) -> None:
        """Make ``method`` answer with a Telegram-style error (or a bad HTTP status)."""
        payload_body = body if body is not None else {
            "ok": False,
            "error_code": 400,
            "description": "Bad Request: test-injected failure",
        }
        self.overrides[method] = lambda _p: httpx.Response(status, json=payload_body)

    def timeout(self, method: str) -> None:
        """Make ``method`` time out at the transport level."""

        def _boom(_payload: Dict[str, Any]) -> httpx.Response:
            raise httpx.ReadTimeout("test-injected timeout")

        self.overrides[method] = _boom


class _BlockedAsyncClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        raise AssertionError(
            "The Telegram integration tried to open a REAL network connection. "
            "Tests must stay hermetic."
        )


# --- fixtures --------------------------------------------------------------------
@pytest.fixture(scope="module", autouse=True)
def _tables():
    create_db_and_tables()
    yield


@pytest.fixture(autouse=True)
def _telegram_off_by_default():
    """Every test starts from the suite-wide disabled state (see conftest.py).

    Guards against a previous test leaking an enabled integration into this one.
    """
    assert get_settings().telegram_is_enabled is False
    yield


@pytest.fixture(autouse=True)
def _no_real_network(monkeypatch):
    """Default: any attempt by the bot client to build an httpx client blows up."""
    monkeypatch.setattr(
        tg_client, "httpx", SimpleNamespace(AsyncClient=_BlockedAsyncClient)
    )


@pytest.fixture(autouse=True)
def _clean_db():
    """Truncate the tables this module owns, so counts/targets are deterministic."""
    with Session(get_engine()) as s:
        s.exec(delete(SubmissionRow))
        s.exec(delete(TelegramTopic))
        s.exec(delete(TelegramSetting))
        s.commit()
    yield


@pytest.fixture
def session():
    with Session(get_engine()) as s:
        yield s


@pytest.fixture
def telegram_api(monkeypatch, _no_real_network):
    """Replace the blocked client with one bound to a recording MockTransport."""
    fake = FakeTelegramAPI()

    def _factory(*args: Any, **kwargs: Any) -> httpx.AsyncClient:
        kwargs["transport"] = httpx.MockTransport(fake.handler)
        return httpx.AsyncClient(*args, **kwargs)

    monkeypatch.setattr(tg_client, "httpx", SimpleNamespace(AsyncClient=_factory))
    return fake


@pytest.fixture
def enable_telegram(monkeypatch):
    """Turn the integration on with a *fake* token (the transport is always stubbed).

    Patches the fields of the process-wide cached ``Settings`` (every module reads it
    through ``get_settings()``), which ``monkeypatch`` restores afterwards. We do NOT
    clear the lru_cache: rebuilding Settings would re-read the environment, and other
    test modules mutate env vars (e.g. ``DATA_DIR``) *after* the app was imported.
    """
    settings = get_settings()

    def _enable(admin_ids: str = "", group_chat_id: str = "") -> None:
        monkeypatch.setattr(settings, "telegram_bot_token", FAKE_TOKEN)
        monkeypatch.setattr(settings, "telegram_enabled", True)
        monkeypatch.setattr(settings, "telegram_admin_ids", admin_ids)
        monkeypatch.setattr(settings, "telegram_group_chat_id", group_chat_id)
        assert get_settings().telegram_is_enabled is True

    return _enable


@pytest.fixture(scope="module")
def client():
    # Built during fixture setup, i.e. before any test body can call enable_telegram(),
    # so the app's lifespan always sees the integration disabled and never spawns the
    # long-poll worker. The tests drive the bot directly instead.
    assert get_settings().telegram_is_enabled is False
    with TestClient(app) as c:
        yield c


def bot() -> tg_client.TelegramClient:
    """A real TelegramClient — its transport is stubbed by ``telegram_api``."""
    return tg_client.TelegramClient(FAKE_TOKEN)


def bind_group(chat_id: int = GROUP_ID, is_forum: bool = True) -> None:
    with Session(get_engine()) as s:
        service.set_target(s, chat_id, is_forum)


def add_lead(**overrides: Any) -> SubmissionRow:
    fields = dict(
        id=uuid.uuid4().hex,
        name="Ana",
        email="ana@example.com",
        message="hi",
        project="Bot Telegram",
        status="nou",
    )
    fields.update(overrides)
    row = SubmissionRow(**fields)
    with Session(get_engine()) as s:
        s.add(row)
        s.commit()
        s.refresh(row)
    return row


def status_of(submission_id: str) -> Optional[str]:
    with Session(get_engine()) as s:
        row = s.get(SubmissionRow, submission_id)
        return row.status if row else None


CONTACT_PAYLOAD = {
    "name": "Ion Popescu",
    "email": "ion@example.com",
    "phone": "+373 600 111 22",
    "message": "Salut, vreau un magazin online.",
    "project": "Magazin online",
    "estimate": "1500 EUR",
}


def post_lead(client: TestClient, **overrides: Any) -> Dict[str, Any]:
    body = dict(CONTACT_PAYLOAD)
    body.update(overrides)
    r = client.post("/api/contact", json=body)
    assert r.status_code == 201, r.text
    return r.json()


# Tags the bot is *allowed* to emit. Anything else that survives means user text
# broke out of escaping.
_ALLOWED_TAGS = ("<b>", "</b>", "<i>", "</i>", "<code>", "</code>")


def strip_allowed_markup(text: str) -> str:
    for tag in _ALLOWED_TAGS:
        text = text.replace(tag, "")
    return text


# =================================================================================
# 1. Lead notification: POST /api/contact -> a correctly formatted Telegram message
# =================================================================================
def test_contact_post_sends_lead_to_the_service_topic(client, telegram_api, enable_telegram):
    enable_telegram()
    bind_group(is_forum=True)

    lead = post_lead(client)

    # One topic created (for "Magazin online" = the shop service), one message sent.
    topics = telegram_api.payloads("createForumTopic")
    assert len(topics) == 1
    assert topics[0]["name"] == "Magazin online"
    assert str(topics[0]["chat_id"]) == str(GROUP_ID)

    sends = telegram_api.payloads("sendMessage")
    assert len(sends) == 1
    msg = sends[0]
    assert str(msg["chat_id"]) == str(GROUP_ID)
    assert msg["parse_mode"] == "HTML"
    # Routed into the freshly created forum topic.
    assert msg["message_thread_id"] == 1001

    text = msg["text"]
    assert "🆕 <b>LEAD NOU</b>" in text
    assert "🗂 <b>Serviciu:</b> Magazin online" in text
    assert "Ion Popescu" in text
    assert "ion@example.com" in text
    assert "+373 600 111 22" in text
    assert "1500 EUR" in text
    assert "Salut, vreau un magazin online." in text
    assert "🏷 <b>Status:</b> 🆕 Nou" in text
    assert f"<code>#{lead['id']}</code>" in text

    # The classification keyboard rides along, wired to this lead's id.
    keyboard = msg["reply_markup"]["inline_keyboard"]
    buttons = [b for row in keyboard for b in row]
    assert [b["callback_data"] for b in buttons] == [
        f"lead:{lead['id']}:{key}" for key, _ in service.STATUSES
    ]

    # The topic is persisted so later leads reuse it.
    with Session(get_engine()) as s:
        row = s.exec(
            select(TelegramTopic).where(TelegramTopic.service_key == "shop")
        ).first()
        assert row is not None and row.thread_id == 1001


def test_lead_message_escapes_html_and_cannot_inject_markup(client, telegram_api, enable_telegram):
    """A lead full of markup must arrive inert — escaped, never as live HTML."""
    enable_telegram()
    bind_group(is_forum=False)  # group root: keeps this test about the text only

    post_lead(
        client,
        name="<script>alert('xss')</script>",
        message='Tom & Jerry <b>bold</b> <img src=x onerror=alert(1)> "quoted"',
        project="<i>Landing page</i>",  # bogus service -> general bucket
        estimate="<a href='javascript:alert(1)'>gratis</a>",
    )

    text = telegram_api.last("sendMessage")["text"]

    # The only markup left after removing the bot's own tags is... nothing.
    assert "<" not in strip_allowed_markup(text)
    assert ">" not in strip_allowed_markup(text)

    # And the user's payload is present, but neutered.
    assert "&lt;script&gt;alert('xss')&lt;/script&gt;" in text
    assert "&lt;b&gt;bold&lt;/b&gt;" in text
    assert "&lt;img src=x onerror=alert(1)&gt;" in text
    assert "Tom &amp; Jerry" in text
    assert "javascript:" in text  # the literal text survives...
    assert "<a " not in text  # ...but never as a link
    assert "<script" not in text.lower()
    assert "onerror=alert(1)>" not in text  # only the escaped form above


def test_lead_text_is_not_double_escaped(client, telegram_api, enable_telegram):
    """Stored text is already HTML-escaped; the bot un-escapes then re-escapes, so an
    apostrophe must not reach Telegram as a literal ``&#x27;``."""
    enable_telegram()
    bind_group(is_forum=False)

    post_lead(client, name="O'Brien & Fils", message="Buget < 5000 & \"flexibil\"")

    text = telegram_api.last("sendMessage")["text"]
    assert "O'Brien &amp; Fils" in text
    assert "&#x27;" not in text
    assert "&quot;" not in text
    assert "&amp;amp;" not in text  # no double-escaping
    assert 'Buget &lt; 5000 &amp; "flexibil"' in text


# =================================================================================
# 2. Topic routing
# =================================================================================
def test_topic_is_created_once_and_reused(client, telegram_api, enable_telegram):
    enable_telegram()
    bind_group(is_forum=True)

    post_lead(client, project="Magazin online")
    post_lead(client, project="Magazin online")
    post_lead(client, project="Magazin online")

    # Exactly one createForumTopic for three leads of the same service.
    assert len(telegram_api.payloads("createForumTopic")) == 1
    threads = [p["message_thread_id"] for p in telegram_api.payloads("sendMessage")]
    assert threads == [1001, 1001, 1001]

    with Session(get_engine()) as s:
        rows = s.exec(
            select(TelegramTopic).where(TelegramTopic.service_key == "shop")
        ).all()
        assert len(rows) == 1  # no duplicate row either


def test_each_service_gets_its_own_topic_and_unknown_falls_back_to_general(
    client, telegram_api, enable_telegram
):
    enable_telegram()
    bind_group(is_forum=True)

    post_lead(client, project="Bot Telegram")
    post_lead(client, project="Landing page")
    post_lead(client, project="Ceva ce nu există")  # unknown -> "Altele"
    post_lead(client, project="")  # empty -> "Altele" too

    created = [(p["name"], p["chat_id"]) for p in telegram_api.payloads("createForumTopic")]
    assert [name for name, _ in created] == ["Bot Telegram", "Landing page", "Altele"]

    threads = [p["message_thread_id"] for p in telegram_api.payloads("sendMessage")]
    assert threads == [1001, 1002, 1003, 1003]  # last two share the general topic

    with Session(get_engine()) as s:
        keys = {r.service_key: r.thread_id for r in s.exec(select(TelegramTopic)).all()}
    assert keys == {"bot": 1001, "landing": 1002, service.GENERAL_KEY: 1003}


def test_non_forum_group_posts_to_the_root_without_creating_topics(
    client, telegram_api, enable_telegram
):
    enable_telegram()
    bind_group(is_forum=False)

    post_lead(client, project="Magazin online")

    assert telegram_api.payloads("createForumTopic") == []
    assert "message_thread_id" not in telegram_api.last("sendMessage")


def test_no_group_registered_means_no_message_at_all(client, telegram_api, enable_telegram):
    enable_telegram()  # enabled, but nothing bound and no env-pinned chat id

    post_lead(client)

    assert telegram_api.calls == []


# =================================================================================
# 3. Authorization (/register, /stats, status buttons)
# =================================================================================
def _msg(text: str, *, chat_id: int, user_id: int, chat_type: str = "supergroup", **chat):
    return {
        "message": {
            "message_id": 7,
            "chat": dict(id=chat_id, type=chat_type, **chat),
            "from": {"id": user_id},
            "text": text,
        }
    }


def _callback(data: str, *, chat_id: int, user_id: int, message_id: int = 55):
    return {
        "callback_query": {
            "id": "cbq-1",
            "from": {"id": user_id},
            "data": data,
            "message": {"message_id": message_id, "chat": {"id": chat_id}},
        }
    }


def run_update(session, api_client, update):
    asyncio.run(process_update(session, api_client, update, bot_username="TestBot"))


def test_stats_refused_for_a_stranger_in_a_foreign_group(session, telegram_api, enable_telegram):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group()

    run_update(session, bot(), _msg("/stats", chat_id=OTHER_GROUP_ID, user_id=STRANGER_UID))

    sent = telegram_api.last("sendMessage")
    assert sent["text"] == "⛔ Neautorizat."
    assert "STATISTICI" not in sent["text"]


def test_stats_refused_for_a_bound_group_member_when_an_allowlist_exists(
    session, telegram_api, enable_telegram
):
    """With TELEGRAM_ADMIN_IDS set, being *in* the group is no longer enough."""
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(is_forum=False)

    run_update(session, bot(), _msg("/stats", chat_id=GROUP_ID, user_id=STRANGER_UID))

    assert telegram_api.last("sendMessage")["text"] == "⛔ Neautorizat."


def test_stats_allowed_for_an_allowlisted_admin(session, telegram_api, enable_telegram):
    enable_telegram(admin_ids=f"{ADMIN_UID}, 222222")
    bind_group(is_forum=False)
    add_lead(project="Magazin online", status="castigat")

    run_update(session, bot(), _msg("/stats", chat_id=GROUP_ID, user_id=ADMIN_UID))

    text = telegram_api.last("sendMessage")["text"]
    assert "📊 <b>STATISTICI LEAD-URI</b>" in text
    assert "Total: <b>1</b>" in text
    assert "Magazin online: <b>1</b>" in text


def test_register_refused_for_a_stranger_and_the_target_is_unchanged(
    session, telegram_api, enable_telegram
):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(chat_id=GROUP_ID, is_forum=True)

    run_update(
        session,
        bot(),
        _msg("/register", chat_id=OTHER_GROUP_ID, user_id=STRANGER_UID, is_forum=True),
    )

    assert "⛔ Neautorizat" in telegram_api.last("sendMessage")["text"]
    assert telegram_api.payloads("createForumTopic") == []
    with Session(get_engine()) as s:
        assert service.resolve_target(s)[0] == str(GROUP_ID)  # still the original group


def test_register_is_disabled_when_the_group_is_pinned_in_the_env(
    session, telegram_api, enable_telegram
):
    enable_telegram(admin_ids=str(ADMIN_UID), group_chat_id=str(GROUP_ID))

    run_update(
        session,
        bot(),
        _msg("/register", chat_id=OTHER_GROUP_ID, user_id=ADMIN_UID, is_forum=True),
    )

    assert "fixat prin configurare" in telegram_api.last("sendMessage")["text"]
    with Session(get_engine()) as s:
        assert s.exec(select(TelegramSetting)).first() is None  # nothing was written
        assert service.resolve_target(s)[0] == str(GROUP_ID)


def test_bootstrap_register_binds_the_first_group_then_locks_it(
    session, telegram_api, enable_telegram
):
    enable_telegram()  # no allowlist, nothing bound -> first group may claim itself

    run_update(
        session,
        bot(),
        _msg("/register", chat_id=GROUP_ID, user_id=STRANGER_UID, is_forum=True, title="Lead-uri"),
    )
    assert "Înregistrat" in telegram_api.last("sendMessage")["text"]
    with Session(get_engine()) as s:
        assert service.resolve_target(s) == (str(GROUP_ID), True)

    # A second, foreign group can no longer take over.
    run_update(
        session,
        bot(),
        _msg("/register", chat_id=OTHER_GROUP_ID, user_id=STRANGER_UID, is_forum=True),
    )
    assert "⛔ Neautorizat" in telegram_api.last("sendMessage")["text"]
    with Session(get_engine()) as s:
        assert service.resolve_target(s)[0] == str(GROUP_ID)


def test_unauthorized_callback_cannot_change_a_lead_status(session, telegram_api, enable_telegram):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(is_forum=False)
    lead = add_lead(status="nou")

    run_update(
        session,
        bot(),
        _callback(f"lead:{lead.id}:castigat", chat_id=GROUP_ID, user_id=STRANGER_UID),
    )

    assert status_of(lead.id) == "nou"  # untouched
    assert telegram_api.payloads("editMessageText") == []  # message not rewritten
    answer = telegram_api.last("answerCallbackQuery")
    assert answer["text"] == "⛔ Neautorizat"


def test_callback_from_a_foreign_chat_is_refused(session, telegram_api, enable_telegram):
    """No allowlist: only the bound group may classify — not every chat the bot is in."""
    enable_telegram()
    bind_group(is_forum=False)
    lead = add_lead(status="nou")

    run_update(
        session,
        bot(),
        _callback(f"lead:{lead.id}:pierdut", chat_id=OTHER_GROUP_ID, user_id=STRANGER_UID),
    )

    assert status_of(lead.id) == "nou"
    assert telegram_api.payloads("editMessageText") == []
    assert telegram_api.last("answerCallbackQuery")["text"] == "⛔ Neautorizat"


def test_allowlisted_admin_may_classify_from_anywhere(session, telegram_api, enable_telegram):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(is_forum=False)
    lead = add_lead(status="nou")

    run_update(
        session,
        bot(),
        _callback(f"lead:{lead.id}:oferta", chat_id=ADMIN_UID, user_id=ADMIN_UID),
    )

    assert status_of(lead.id) == "oferta"
    assert telegram_api.last("answerCallbackQuery")["text"] == "Status: 💰 Ofertă"


# =================================================================================
# 4. Disabled integration (empty token) => a total no-op, no network
# =================================================================================
def test_disabled_contact_post_touches_no_telegram_api(client, telegram_api):
    """The suite runs with an empty token: POST /api/contact must stay silent."""
    assert get_settings().telegram_is_enabled is False
    bind_group()  # even with a group bound

    lead = post_lead(client)

    assert telegram_api.calls == []  # not a single Bot API call
    assert status_of(lead["id"]) == "nou"  # ...but the lead is saved


def test_disabled_notify_helpers_are_noops(session, telegram_api):
    lead = add_lead()
    assert asyncio.run(service.notify_new_lead(session, lead)) is False
    asyncio.run(notify_new_lead_task(lead))
    assert telegram_api.calls == []


def test_disabled_worker_returns_immediately(telegram_api):
    async def _run():
        # Times out (and fails) if run_worker ever entered its polling loop.
        await asyncio.wait_for(run_worker(poll_timeout=1), timeout=5)

    asyncio.run(_run())
    assert telegram_api.calls == []  # not even getMe


def test_no_network_guard_is_armed():
    """Meta-test: without a stubbed transport, a real HTTP client cannot be built."""
    with pytest.raises(AssertionError, match="REAL network"):
        tg_client.httpx.AsyncClient(timeout=1.0)


# =================================================================================
# 5. Status buttons
# =================================================================================
@pytest.mark.parametrize("status,label", service.STATUSES)
def test_every_valid_status_button_updates_the_lead(
    session, telegram_api, enable_telegram, status, label
):
    enable_telegram()
    bind_group(is_forum=False)
    lead = add_lead(status="nou", project="Magazin online")

    run_update(
        session, bot(), _callback(f"lead:{lead.id}:{status}", chat_id=GROUP_ID, user_id=STRANGER_UID)
    )

    assert status_of(lead.id) == status
    edit = telegram_api.last("editMessageText")
    assert edit["message_id"] == 55
    assert f"🏷 <b>Status:</b> {label}" in edit["text"]
    # The keyboard survives the edit, so the lead can be re-classified.
    assert len(edit["reply_markup"]["inline_keyboard"]) == 2
    assert telegram_api.last("answerCallbackQuery")["text"] == f"Status: {label}"


@pytest.mark.parametrize(
    "data",
    [
        "lead:{id}:sters",  # unknown status
        "lead:{id}:NOU",  # case-sensitive: not a valid key
        "lead:{id}:castigat;DROP TABLE submissions",
        "lead:{id}:nou:extra",  # trailing junk
        "lead:{id}:",  # empty status
        "lead::castigat",  # empty id
        "lead:{id}",  # no status at all
        "other:{id}:castigat",  # foreign prefix
        "",
    ],
)
def test_forged_callback_data_is_rejected(session, telegram_api, enable_telegram, data):
    enable_telegram()
    bind_group(is_forum=False)
    lead = add_lead(status="contactat")

    run_update(
        session,
        bot(),
        _callback(data.format(id=lead.id), chat_id=GROUP_ID, user_id=STRANGER_UID),
    )

    assert status_of(lead.id) == "contactat"  # unchanged
    assert telegram_api.payloads("editMessageText") == []
    # Answered (so the client stops spinning) but with no status toast.
    assert "text" not in telegram_api.last("answerCallbackQuery")


def test_callback_for_an_unknown_lead_id_changes_nothing(session, telegram_api, enable_telegram):
    enable_telegram()
    bind_group(is_forum=False)
    existing = add_lead(status="nou")

    for bogus in ("deadbeef", "' OR 1=1 --", "%"):
        run_update(
            session,
            bot(),
            _callback(f"lead:{bogus}:castigat", chat_id=GROUP_ID, user_id=STRANGER_UID),
        )
        assert telegram_api.last("answerCallbackQuery")["text"] == "Lead inexistent"

    assert telegram_api.payloads("editMessageText") == []
    assert status_of(existing.id) == "nou"
    with Session(get_engine()) as s:
        assert len(s.exec(select(SubmissionRow)).all()) == 1


def test_apply_status_rejects_an_unknown_status(session):
    lead = add_lead(status="nou")
    assert service.apply_status(session, lead.id, "administrator") is None
    assert service.apply_status(session, lead.id, "") is None
    assert status_of(lead.id) == "nou"
    assert service.apply_status(session, lead.id, "castigat").status == "castigat"


# =================================================================================
# 6. Resilience — Telegram may fail, the lead must not
# =================================================================================
@pytest.mark.parametrize(
    "break_it",
    [
        pytest.param(lambda api: api.fail("sendMessage"), id="telegram-error"),
        pytest.param(lambda api: api.timeout("sendMessage"), id="timeout"),
        pytest.param(lambda api: api.fail("sendMessage", status=500, body={"x": 1}), id="http-500"),
        pytest.param(
            lambda api: api.overrides.__setitem__(
                "sendMessage", lambda _p: httpx.Response(200, content=b"<html>nope")
            ),
            id="garbage-body",
        ),
    ],
)
def test_contact_endpoint_survives_a_broken_telegram(client, telegram_api, enable_telegram, break_it):
    enable_telegram()
    bind_group(is_forum=False)
    break_it(telegram_api)

    lead = post_lead(client)  # asserts 201

    assert telegram_api.payloads("sendMessage")  # it did try
    assert status_of(lead["id"]) == "nou"  # and the lead is safely stored


def test_topic_creation_failure_falls_back_to_the_group_root(client, telegram_api, enable_telegram):
    enable_telegram()
    bind_group(is_forum=True)
    telegram_api.fail("createForumTopic")  # e.g. bot lacks "Manage Topics"

    post_lead(client, project="Magazin online")

    sent = telegram_api.last("sendMessage")
    assert "message_thread_id" not in sent  # posted to the group root instead
    assert "LEAD NOU" in sent["text"]
    with Session(get_engine()) as s:
        assert s.exec(select(TelegramTopic)).all() == []  # nothing bogus persisted


def test_client_swallows_transport_and_api_errors(telegram_api):
    api = bot()

    telegram_api.timeout("getMe")
    assert asyncio.run(api.get_me()) is None

    telegram_api.fail("createForumTopic", body={"ok": False, "description": "no rights"})
    assert asyncio.run(api.create_forum_topic(GROUP_ID, "Altele")) is None

    telegram_api.fail("sendMessage", status=401)
    assert asyncio.run(api.send_message(GROUP_ID, "hi")) is None

    telegram_api.overrides["getUpdates"] = lambda _p: httpx.Response(
        200, json={"ok": True, "result": "not-a-list"}
    )
    assert asyncio.run(api.get_updates()) is None


@pytest.mark.parametrize(
    "update",
    [
        {},
        {"message": {}},
        {"message": {"text": "/stats"}},  # no chat, no sender
        {"callback_query": {}},
        {"callback_query": {"id": "x", "data": "lead:1:nou"}},  # no message/chat
        {"edited_message": {"text": "/register"}},  # an update kind we ignore
    ],
)
def test_malformed_updates_do_not_raise(session, telegram_api, enable_telegram, update):
    enable_telegram()
    bind_group(is_forum=False)

    run_update(session, bot(), update)  # must not raise

    assert telegram_api.payloads("editMessageText") == []


def test_worker_loop_survives_a_failed_poll_and_keeps_the_offset_moving(
    telegram_api, enable_telegram
):
    """A flaky getUpdates must not kill the worker: it backs off, retries, and the
    offset still advances past the update it already handled."""
    enable_telegram()
    bind_group(is_forum=False)

    calls = {"n": 0}

    def _updates(_payload):
        calls["n"] += 1
        if calls["n"] == 1:
            raise httpx.ReadTimeout("flaky network")
        if calls["n"] == 2:
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "result": [
                        {
                            "update_id": 4242,
                            "message": {
                                "message_id": 1,
                                "chat": {"id": GROUP_ID, "type": "supergroup"},
                                "from": {"id": STRANGER_UID},
                                "text": "/help",
                            },
                        }
                    ],
                },
            )
        raise asyncio.CancelledError()  # stop the infinite loop

    telegram_api.overrides["getUpdates"] = _updates

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(run_worker(poll_timeout=1))

    # It recovered from the timeout and handled the update that came after it.
    assert "🤖 <b>TBS Digital — bot lead-uri</b>" in telegram_api.last("sendMessage")["text"]
    # ...and asked for updates *after* the one it processed.
    assert telegram_api.payloads("getUpdates")[-1]["offset"] == 4243


# =================================================================================
# Regressions for two bugs these tests found (both now fixed)
# =================================================================================
def test_stats_in_a_dm_must_not_reuse_the_groups_topic_thread(
    session, telegram_api, enable_telegram
):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(is_forum=True)
    # The general topic already exists in the group (created by an earlier lead).
    with Session(get_engine()) as s:
        s.add(TelegramTopic(service_key=service.GENERAL_KEY, title="Altele", thread_id=1001))
        s.commit()

    run_update(
        session,
        bot(),
        _msg("/stats", chat_id=ADMIN_UID, user_id=ADMIN_UID, chat_type="private"),
    )

    sent = telegram_api.last("sendMessage")
    assert sent["chat_id"] == ADMIN_UID
    assert "message_thread_id" not in sent  # a private chat has no topics


def test_rebinding_the_group_drops_stale_topic_threads(session, telegram_api, enable_telegram):
    enable_telegram(admin_ids=str(ADMIN_UID))
    bind_group(chat_id=GROUP_ID, is_forum=True)
    with Session(get_engine()) as s:
        s.add(TelegramTopic(service_key="shop", title="Magazin online", thread_id=1001))
        s.commit()

    # The admin moves the bot to a brand-new group.
    run_update(
        session,
        bot(),
        _msg("/register", chat_id=OTHER_GROUP_ID, user_id=ADMIN_UID, is_forum=True),
    )

    with Session(get_engine()) as s:
        stale = s.exec(
            select(TelegramTopic).where(TelegramTopic.service_key == "shop")
        ).first()
        assert stale is None or stale.thread_id != 1001
