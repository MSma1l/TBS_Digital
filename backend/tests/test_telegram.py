"""
Telegram integration unit tests — NO network. A fake client records calls.

Covers: service-name -> topic-key mapping, notify_new_lead (topic created on demand +
send with the right thread id), a callback updating a submission's status, build_stats
counting, and that with no token the integration is a no-op while POST /api/contact
still returns 201.
"""

import asyncio
import os
import tempfile
import uuid
from types import SimpleNamespace

# Configure an isolated DB BEFORE importing the app (settings are cached at import).
# TELEGRAM_* are intentionally left unset here -> the integration is disabled.
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-tg-test-"), "test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-pass")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import create_db_and_tables, get_engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import SubmissionRow, TelegramTopic  # noqa: E402
from app.telegram import service  # noqa: E402
from app.telegram.worker import _command, process_update  # noqa: E402


class FakeClient:
    """Async stand-in for TelegramClient that records calls instead of hitting the net."""

    def __init__(self):
        self.sent = []
        self.edited = []
        self.answered = []
        self.created_topics = []
        self._next_thread = 100

    async def get_me(self):
        return {"username": "TestBot"}

    async def create_forum_topic(self, chat_id, name):
        self._next_thread += 1
        self.created_topics.append((chat_id, name, self._next_thread))
        return self._next_thread

    async def send_message(
        self, chat_id, text, message_thread_id=None, reply_markup=None, parse_mode="HTML"
    ):
        self.sent.append(
            dict(chat_id=chat_id, text=text, thread=message_thread_id, markup=reply_markup)
        )
        return {"message_id": 1}

    async def edit_message_text(
        self, chat_id, message_id, text, reply_markup=None, parse_mode="HTML"
    ):
        self.edited.append(
            dict(chat_id=chat_id, message_id=message_id, text=text, markup=reply_markup)
        )
        return {"message_id": message_id}

    async def answer_callback_query(self, callback_query_id, text=None):
        self.answered.append((callback_query_id, text))
        return True


@pytest.fixture(scope="module", autouse=True)
def _tables():
    create_db_and_tables()
    yield


@pytest.fixture
def session():
    with Session(get_engine()) as s:
        yield s


def _make_submission(**overrides):
    data = dict(
        id=uuid.uuid4().hex,
        name="Ion Popescu",
        email="ion@example.com",
        phone="+373 600 111 22",
        message="Salut, vreau un magazin online.",
        project="Magazin online",
        estimate="1500 EUR",
        created_at="2026-07-08T10:00:00+00:00",
        status="nou",
    )
    data.update(overrides)
    return SimpleNamespace(**data)


# --- mapping ---------------------------------------------------------------------
def test_service_key_mapping():
    assert service.service_key_for("Magazin online") == "shop"
    assert service.service_key_for("Bot Telegram") == "bot"
    # HTML-escaped ampersand still resolves (both sides are normalised/unescaped).
    assert service.service_key_for("Dashboard &amp; rapoarte") == "dashboard"
    assert service.service_key_for("Dashboard & rapoarte") == "dashboard"
    # Unknown / empty fall back to the general bucket.
    assert service.service_key_for("Ceva necunoscut") == service.GENERAL_KEY
    assert service.service_key_for("") == service.GENERAL_KEY


def test_callback_data_roundtrip():
    data = f"{service.CALLBACK_PREFIX}:abc123:contactat"
    assert service.parse_callback_data(data) == ("abc123", "contactat")
    assert service.parse_callback_data("lead:abc123:bogus") is None
    assert service.parse_callback_data("other:x:y") is None


def test_command_parsing():
    assert _command("/stats", "TestBot") == "stats"
    assert _command("/register@TestBot extra", "TestBot") == "register"
    assert _command("/stats@OtherBot", "TestBot") is None
    assert _command("hello", "TestBot") is None


# --- notify_new_lead -------------------------------------------------------------
def test_notify_new_lead_creates_topic_and_sends(session):
    # Register a forum group as the target (no env var set).
    service.set_target(session, chat_id=-1001234567890, is_forum=True)
    client = FakeClient()
    submission = _make_submission(project="Magazin online")

    ok = asyncio.run(service.notify_new_lead(session, submission, client=client))
    assert ok is True

    # A topic was created for the "shop" service and persisted with its thread id.
    assert len(client.created_topics) == 1
    created_thread = client.created_topics[0][2]

    from sqlmodel import select

    persisted = session.exec(
        select(TelegramTopic).where(TelegramTopic.service_key == "shop")
    ).first()
    assert persisted is not None
    assert persisted.thread_id == created_thread

    # Exactly one message sent, into the created thread, with a classification keyboard.
    assert len(client.sent) == 1
    msg = client.sent[0]
    assert msg["thread"] == created_thread
    assert "LEAD NOU" in msg["text"]
    assert "Magazin online" in msg["text"]
    assert msg["markup"] and "inline_keyboard" in msg["markup"]

    # A second lead for the same service reuses the topic (no new createForumTopic).
    asyncio.run(service.notify_new_lead(session, _make_submission(project="Magazin online"), client=client))
    assert len(client.created_topics) == 1
    assert client.sent[-1]["thread"] == created_thread


def test_notify_falls_back_to_root_when_not_forum(session):
    service.set_target(session, chat_id=-100999, is_forum=False)
    client = FakeClient()
    asyncio.run(
        service.notify_new_lead(session, _make_submission(project="Landing page"), client=client)
    )
    assert client.created_topics == []  # no topic on a non-forum chat
    assert client.sent[-1]["thread"] is None  # posted to the group root


# --- callback -> status update ---------------------------------------------------
def test_callback_updates_submission_status(session):
    sub_id = uuid.uuid4().hex
    session.add(
        SubmissionRow(
            id=sub_id,
            name="Ana",
            email="ana@example.com",
            message="hi",
            project="Bot Telegram",
            status="nou",
        )
    )
    session.commit()

    # Bind the group so the callback is authorized (no allowlist configured => the
    # bound-group path grants classification rights to that chat).
    service.set_target(session, chat_id=-1001234567890, is_forum=True)

    client = FakeClient()
    update = {
        "callback_query": {
            "id": "cbq-1",
            "from": {"id": 777},
            "data": f"lead:{sub_id}:contactat",
            "message": {"message_id": 55, "chat": {"id": -1001234567890}},
        }
    }
    asyncio.run(process_update(session, client, update, bot_username="TestBot"))

    session.expire_all()
    row = session.get(SubmissionRow, sub_id)
    assert row.status == "contactat"
    assert len(client.edited) == 1
    assert client.edited[0]["message_id"] == 55
    assert "Contactat" in client.edited[0]["text"]
    assert len(client.answered) == 1


# --- stats -----------------------------------------------------------------------
def test_build_stats_counts(session):
    # Clean slate for a deterministic count.
    from sqlmodel import delete

    session.exec(delete(SubmissionRow))
    session.commit()
    for project, status in [
        ("Magazin online", "nou"),
        ("Magazin online", "castigat"),
        ("Bot Telegram", "contactat"),
    ]:
        session.add(
            SubmissionRow(
                id=uuid.uuid4().hex,
                name="x",
                email="x@y.com",
                message="m",
                project=project,
                status=status,
            )
        )
    session.commit()

    text = service.build_stats(session)
    assert "Total: <b>3</b>" in text
    assert "Magazin online: <b>2</b>" in text
    assert "Bot Telegram: <b>1</b>" in text
    # per-status line for "castigat"
    assert "Câștigat: <b>1</b>" in text


# --- no token => no-op, but the API still works ----------------------------------
def test_no_token_is_noop_and_contact_returns_201():
    # No TELEGRAM_* env set in this module => integration disabled.
    assert get_settings().telegram_is_enabled is False

    with TestClient(app) as c:
        r = c.post(
            "/api/contact",
            json={"name": "Ilie", "email": "ilie@example.com", "message": "Salut"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["id"]
        assert body["status"] == "nou"  # default classification exposed in the schema
