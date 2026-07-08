"""
Security-hardening tests for the auth + Telegram authorization layers.

Covers the four hardening fixes end-to-end, with NO network:

- Telegram: an unauthorized ``/register`` must NOT repoint the lead target
  (lead-theft hijack), and an unauthorized classification callback must NOT change a
  lead's status.
- JWT: a token whose ``aud``/``iss`` is wrong or absent is rejected (401), even though
  it is signed with the correct secret and otherwise valid.
- Passwords: a >72-byte password authenticates correctly and does NOT collide with a
  variant that merely shares its first 72 bytes (bcrypt would silently truncate).
"""

import asyncio
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

# Configure an isolated DB + creds BEFORE importing the app (settings are cached at
# import). No TELEGRAM_ADMIN_IDS is set => the allowlist is empty, so the bound-group
# path is what grants trust (and any *other* chat is unauthorized).
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-authz-test-"), "test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-pass")
os.environ.setdefault("JWT_SECRET", "test-secret")

import jwt as pyjwt  # noqa: E402
import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from fastapi.security import HTTPAuthorizationCredentials  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app import security  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.db import create_db_and_tables, get_engine  # noqa: E402
from app.models import SubmissionRow, UserRow  # noqa: E402
from app.telegram import service  # noqa: E402
from app.telegram.worker import process_update  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def _tables():
    create_db_and_tables()
    yield


@pytest.fixture
def session():
    with Session(get_engine()) as s:
        yield s


class FakeClient:
    """Records calls; never hits the network."""

    def __init__(self):
        self.sent = []
        self.edited = []
        self.answered = []

    async def send_message(
        self, chat_id, text, message_thread_id=None, reply_markup=None, parse_mode="HTML"
    ):
        self.sent.append(dict(chat_id=chat_id, text=text))
        return {"message_id": 1}

    async def edit_message_text(
        self, chat_id, message_id, text, reply_markup=None, parse_mode="HTML"
    ):
        self.edited.append(dict(chat_id=chat_id, message_id=message_id, text=text))
        return {"message_id": message_id}

    async def answer_callback_query(self, callback_query_id, text=None):
        self.answered.append((callback_query_id, text))
        return True

    async def create_forum_topic(self, chat_id, name):
        return 123


# --- is_authorized helper --------------------------------------------------------
def test_is_authorized_allow_and_deny():
    with_allowlist = SimpleNamespace(telegram_admin_id_set={42})
    no_allowlist = SimpleNamespace(telegram_admin_id_set=set())

    # Allowlisted admin id is trusted from any chat.
    assert service.is_authorized(42, -999, with_allowlist, "-100") is True
    # A non-admin is rejected even from the bound group when an allowlist exists.
    assert service.is_authorized(7, -100, with_allowlist, "-100") is False
    # No allowlist: the bound group is trusted, other groups are not.
    assert service.is_authorized(7, -100, no_allowlist, "-100") is True
    assert service.is_authorized(7, -999, no_allowlist, "-100") is False
    # No allowlist and nothing bound yet => nobody is trusted.
    assert service.is_authorized(7, -100, no_allowlist, None) is False


# --- Telegram: unauthorized /register must not repoint the target ----------------
def test_unauthorized_register_does_not_change_target(session):
    # Bind an existing target group A.
    service.set_target(session, chat_id=-100111, is_forum=False)
    before, _ = service.resolve_target(session)
    assert before == "-100111"

    client = FakeClient()
    # A hijacker sends /register from a DIFFERENT group B with an unknown user id.
    update = {
        "message": {
            "text": "/register",
            "from": {"id": 999999},
            "chat": {"id": -100222, "type": "supergroup"},
        }
    }
    asyncio.run(process_update(session, client, update, bot_username="TestBot"))

    # Target is UNCHANGED — the lead-theft attempt was refused.
    session.expire_all()
    after, _ = service.resolve_target(session)
    assert after == "-100111"
    assert client.sent and "Neautorizat" in client.sent[-1]["text"]


# --- Telegram: unauthorized callback must not change a lead's status -------------
def test_unauthorized_callback_does_not_change_status(session):
    sub_id = uuid.uuid4().hex
    session.add(
        SubmissionRow(
            id=sub_id, name="Ana", email="ana@example.com", message="hi",
            project="Bot Telegram", status="nou",
        )
    )
    # Bind group A as the target.
    service.set_target(session, chat_id=-100111, is_forum=False)
    session.commit()

    client = FakeClient()
    # Callback arrives from a DIFFERENT chat B, from a non-admin user.
    update = {
        "callback_query": {
            "id": "cbq-hijack",
            "from": {"id": 888888},
            "data": f"lead:{sub_id}:castigat",
            "message": {"message_id": 7, "chat": {"id": -100222}},
        }
    }
    asyncio.run(process_update(session, client, update, bot_username="TestBot"))

    session.expire_all()
    row = session.get(SubmissionRow, sub_id)
    assert row.status == "nou"  # UNCHANGED
    assert client.edited == []  # message not edited
    # Rejected with a neutral toast.
    assert client.answered and "Neautorizat" in (client.answered[-1][1] or "")


# --- JWT aud/iss enforcement -----------------------------------------------------
def _make_creds(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_valid_token_is_accepted():
    settings = get_settings()
    token = security.create_access_token("admin", settings)
    admin = security.get_current_admin(creds=_make_creds(token), settings=settings)
    assert admin.username == "admin"


def test_token_with_wrong_audience_is_rejected():
    settings = get_settings()
    now = datetime.now(timezone.utc)
    token = pyjwt.encode(
        {"sub": "admin", "iss": security._JWT_ISSUER, "aud": "someone-else",
         "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret, algorithm=security._ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        security.get_current_admin(creds=_make_creds(token), settings=settings)
    assert exc.value.status_code == 401


def test_token_with_wrong_issuer_is_rejected():
    settings = get_settings()
    now = datetime.now(timezone.utc)
    token = pyjwt.encode(
        {"sub": "admin", "iss": "evil-issuer", "aud": security._JWT_AUDIENCE,
         "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret, algorithm=security._ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        security.get_current_admin(creds=_make_creds(token), settings=settings)
    assert exc.value.status_code == 401


def test_token_without_aud_iss_is_rejected():
    settings = get_settings()
    now = datetime.now(timezone.utc)
    # A perfectly-signed legacy token with no aud/iss must now be refused.
    token = pyjwt.encode(
        {"sub": "admin", "iat": now, "exp": now + timedelta(minutes=5)},
        settings.jwt_secret, algorithm=security._ALGORITHM,
    )
    with pytest.raises(HTTPException) as exc:
        security.get_current_admin(creds=_make_creds(token), settings=settings)
    assert exc.value.status_code == 401


# --- bcrypt 72-byte truncation defence -------------------------------------------
def test_long_password_authenticates_and_does_not_collide(session):
    # Two passwords sharing the first 72 bytes; a naive bcrypt would treat them as equal.
    base = "a" * 72
    pw_full = base + "-REAL-SECRET-TAIL"
    pw_trunc = base + "-DIFFERENT-TAIL!!"
    assert pw_full.encode()[:72] == pw_trunc.encode()[:72]  # identical 72-byte prefix

    hashed = security.hash_password(pw_full)
    # The full password verifies...
    assert security.verify_password(pw_full, hashed) is True
    # ...but the truncated-prefix twin does NOT (no silent collision).
    assert security.verify_password(pw_trunc, hashed) is False

    # And it round-trips through the DB-backed authenticate() contract.
    username = "longpw-" + uuid.uuid4().hex[:8]
    session.add(UserRow(username=username, hashed_password=hashed))
    session.commit()
    assert security.authenticate(session, username, pw_full) is True
    assert security.authenticate(session, username, pw_trunc) is False
    # Unknown user still returns False (dummy-verify anti-enumeration path intact).
    assert security.authenticate(session, "nope-" + username, pw_full) is False
