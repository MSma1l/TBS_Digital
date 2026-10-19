"""
CRM lead-intake tests — NO network. ``httpx.MockTransport`` stands in for the CRM.

Covers: the HMAC signature over the exact bytes sent (and that the CRM can verify it),
the payload contract, the no-op when unconfigured, outcome handling (2xx → sent, 400/401
→ failed without retry, 5xx/timeout → pending + back-off + retry, retry budget), the
claim being exclusive, the secret never reaching logs or the DB, POST /api/contact still
answering 201 with the CRM down, the admin view + re-send endpoint, the boot migration,
and the CRM_LEADS_URL rules.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import tempfile
import uuid
from types import SimpleNamespace

# Configure an isolated DB BEFORE importing the app (settings are cached at import).
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-crm-test-"), "test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-pass")
os.environ.setdefault("JWT_SECRET", "test-secret")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, inspect, text  # noqa: E402
from sqlmodel import Session  # noqa: E402

from app.config import Settings, crm_url_problem, get_settings  # noqa: E402
from app.crm import client as crm_client  # noqa: E402
from app.crm import service  # noqa: E402
from app.db import CRM_COLUMNS, _add_missing_columns, create_db_and_tables, get_engine  # noqa: E402
import app.main as main_module  # noqa: E402
from app.main import app  # noqa: E402
from app.models import SubmissionRow  # noqa: E402

URL = "https://crm.example.test/api/v1/integrations/0b6c7f3e-1111-4222-8333-944455556666/leads"
SECRET = "s3cr3t-crm-key-that-must-never-be-logged"
ALLOWED_KEYS = {
    "externalId", "name", "email", "phone", "message", "project", "estimate", "createdAt",
}
NOW = 1_800_000_000


def _settings(**overrides):
    base = dict(crm_is_enabled=True, crm_leads_url=URL, crm_leads_secret=SECRET)
    base.update(overrides)
    return SimpleNamespace(**base)


class FakeCRM:
    """A MockTransport-backed CRM that records requests and answers from a script."""

    def __init__(self, *responses):
        # Each item: an int status, a (status, json_body) tuple, or an Exception to raise.
        self.responses = list(responses) or [201]
        self.requests = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        item = self.responses.pop(0) if len(self.responses) > 1 else self.responses[0]
        if isinstance(item, Exception):
            raise item
        if isinstance(item, tuple):
            return httpx.Response(item[0], json=item[1])
        body = {"status": "created"} if item == 201 else {"status": "duplicate"}
        return httpx.Response(item, json=body)

    @property
    def transport(self):
        return httpx.MockTransport(self.handler)


@pytest.fixture(scope="module", autouse=True)
def _tables():
    create_db_and_tables()
    yield


def _insert(crm_status="pending", **overrides) -> str:
    data = dict(
        id=uuid.uuid4().hex,
        name="Ion Popescu",
        email="ion@example.com",
        phone="+373 600 111 22",
        message="Salut, vreau un magazin online.",
        project="Magazin online",
        estimate="1500 EUR",
        created_at="2026-10-19T10:00:00+00:00",
        crm_status=crm_status,
        crm_next_attempt_at=0,
    )
    data.update(overrides)
    with Session(get_engine()) as s:
        s.add(SubmissionRow(**data))
        s.commit()
    return data["id"]


def _row(submission_id: str) -> SubmissionRow:
    with Session(get_engine()) as s:
        row = s.get(SubmissionRow, submission_id)
        s.expunge(row)
        return row


def _deliver(submission_id, crm, now=NOW, **settings_overrides):
    return asyncio.run(
        service.deliver(
            submission_id,
            settings=_settings(**settings_overrides),
            transport=crm.transport,
            now=now,
        )
    )


def _sweep(crm, now):
    return asyncio.run(
        service.process_due(settings=_settings(), transport=crm.transport, now=now)
    )


# --- signing & payload --------------------------------------------------------------
def test_signature_covers_the_exact_bytes_sent_and_verifies():
    crm = FakeCRM(201)
    sid = _insert()
    result = _deliver(sid, crm)
    assert result.outcome == "sent"

    (request,) = crm.requests
    assert str(request.url) == URL
    assert request.method == "POST"
    assert request.headers["content-type"] == "application/json"
    timestamp = request.headers["x-crm-timestamp"]
    assert timestamp.isdigit()

    # What the CRM does: HMAC over "<timestamp>." + the raw body it received.
    raw = request.content
    expected = hmac.new(
        SECRET.encode(), timestamp.encode() + b"." + raw, hashlib.sha256
    ).hexdigest()
    signature = request.headers["x-crm-signature"]
    assert signature == f"sha256={expected}"
    assert hmac.compare_digest(signature, crm_client.sign(SECRET, timestamp, raw))

    # Re-serialising would change the bytes (spacing/escaping) — the signature is only
    # valid for the bytes actually on the wire.
    body = json.loads(raw)
    assert json.dumps(body).encode() != raw
    assert body["externalId"] == sid
    assert body["createdAt"] == "2026-10-19T10:00:00+00:00"
    assert set(body) <= ALLOWED_KEYS


def test_payload_omits_empty_optionals_and_unescapes_the_email():
    sub = SimpleNamespace(
        id="abc", name="Ana", email="o&#x27;neil@example.com", phone="", message="Hi",
        project="", estimate="", created_at="2026-10-19T10:00:00+00:00",
        status="nou", crm_status="pending",
    )
    payload = crm_client.build_payload(sub)
    assert payload == {
        "externalId": "abc",
        "name": "Ana",
        "email": "o'neil@example.com",
        "message": "Hi",
        "createdAt": "2026-10-19T10:00:00+00:00",
    }


def test_payload_keeps_non_ascii_text_byte_exact_in_the_signature():
    payload = {"externalId": "x", "name": "Ștefan Țurcan", "email": "a@b.md",
               "createdAt": "2026-10-19T10:00:00+00:00"}
    body = crm_client.serialize(payload)
    assert "Ștefan".encode("utf-8") in body  # sent as UTF-8, not \\u escapes
    assert crm_client.sign(SECRET, "1", body) != crm_client.sign(SECRET, "1", body + b" ")


# --- disabled ---------------------------------------------------------------------------
def test_disabled_settings_never_touch_the_network():
    crm = FakeCRM(201)
    sid = _insert()
    assert _deliver(sid, crm, crm_is_enabled=False) is None
    assert asyncio.run(
        service.process_due(settings=_settings(crm_is_enabled=False), transport=crm.transport)
    ) == 0
    assert crm.requests == []
    assert _row(sid).crm_status == "pending"


def test_crm_is_enabled_needs_both_values():
    assert Settings(crm_leads_url="", crm_leads_secret="").crm_is_enabled is False
    assert Settings(crm_leads_url=URL, crm_leads_secret="").crm_is_enabled is False
    assert Settings(crm_leads_url="", crm_leads_secret=SECRET).crm_is_enabled is False
    assert Settings(crm_leads_url=URL, crm_leads_secret=SECRET).crm_is_enabled is True
    # Whitespace pasted into .env is trimmed instead of silently breaking the HMAC.
    assert Settings(crm_leads_url=URL, crm_leads_secret=f" {SECRET}\n").crm_leads_secret == SECRET


def test_contact_with_crm_unconfigured_queues_nothing_and_sends_nothing(monkeypatch):
    crm = FakeCRM(201)
    monkeypatch.setattr(service, "TRANSPORT", crm.transport)
    assert get_settings().crm_is_enabled is False
    with TestClient(app) as c:
        r = c.post("/api/contact", json={"name": "Ilie", "email": "ilie@example.com",
                                         "message": "Salut"})
    assert r.status_code == 201, r.text
    assert crm.requests == []
    assert _row(r.json()["id"]).crm_status == ""


# --- outcomes -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "response",
    [(201, {"status": "created"}), (200, {"status": "duplicate"}), (200, {"status": "merged"})],
)
def test_created_duplicate_and_merged_all_count_as_sent(response):
    crm = FakeCRM(response)
    sid = _insert()
    result = _deliver(sid, crm)
    assert result.outcome == "sent"
    row = _row(sid)
    assert (row.crm_status, row.crm_attempts, row.crm_last_error) == ("sent", 1, "")
    # A sent lead is never picked up again.
    assert sid not in service.due_ids(get_engine(), NOW + 10**6)
    assert len(crm.requests) == 1


def test_400_is_a_permanent_failure_and_is_not_retried():
    crm = FakeCRM((400, {"error": "name: required"}))
    sid = _insert()
    _deliver(sid, crm)
    row = _row(sid)
    assert row.crm_status == "failed"
    assert row.crm_attempts == 1
    assert row.crm_last_error.startswith("HTTP 400")
    assert "name: required" in row.crm_last_error
    assert sid not in service.due_ids(get_engine(), NOW + 10**7)
    assert len(crm.requests) == 1


def test_401_is_failed_with_a_clear_log_and_no_retry(caplog):
    crm = FakeCRM((401, {"error": "invalid signature"}))
    sid = _insert()
    with caplog.at_level(logging.DEBUG, logger="app.crm"):
        _deliver(sid, crm)
    row = _row(sid)
    assert row.crm_status == "failed"
    assert "CRM_LEADS_SECRET" in row.crm_last_error
    assert "CRM_LEADS_SECRET" in caplog.text and "401" in caplog.text
    assert sid not in service.due_ids(get_engine(), NOW + 10**7)


@pytest.mark.parametrize(
    "failure",
    [500, 503, 429, httpx.ConnectError("refused"), httpx.ReadTimeout("slow")],
)
def test_transient_failures_stay_pending_and_are_retried_after_the_backoff(failure):
    crm = FakeCRM(failure, 201)
    sid = _insert()
    result = _deliver(sid, crm)
    assert result.outcome == "retry"

    row = _row(sid)
    assert row.crm_status == "pending"
    assert row.crm_attempts == 1
    assert row.crm_next_attempt_at == NOW + service.BACKOFF_SECONDS[0]
    assert row.crm_last_error

    # Not yet due → the sweep leaves it alone.
    assert sid not in service.due_ids(get_engine(), NOW + 30)
    # Due → the sweep retries it and it lands.
    asyncio.run(
        service.deliver(sid, settings=_settings(), transport=crm.transport,
                        now=NOW + service.BACKOFF_SECONDS[0])
    )
    row = _row(sid)
    assert (row.crm_status, row.crm_attempts, row.crm_last_error) == ("sent", 2, "")
    assert len(crm.requests) == 2


def test_the_worker_sweep_retries_due_leads():
    crm = FakeCRM(201)
    sid = _insert(crm_attempts=2, crm_next_attempt_at=NOW - 1)
    not_due = _insert(crm_attempts=1, crm_next_attempt_at=NOW + 3600)
    while _sweep(crm, NOW):  # drain: earlier tests may have left due rows too
        pass
    assert _row(sid).crm_status == "sent"
    assert _row(not_due).crm_status == "pending"
    sent_ids = {json.loads(r.content)["externalId"] for r in crm.requests}
    assert sid in sent_ids and not_due not in sent_ids


def test_retry_budget_ends_in_failed():
    crm = FakeCRM(500)
    sid = _insert()
    now = NOW
    for attempt in range(1, service.MAX_ATTEMPTS + 1):
        result = asyncio.run(
            service.deliver(sid, settings=_settings(), transport=crm.transport, now=now)
        )
        assert result is not None, f"attempt {attempt} was not made"
        row = _row(sid)
        assert row.crm_attempts == attempt
        if attempt < service.MAX_ATTEMPTS:
            assert row.crm_status == "pending"
            now = row.crm_next_attempt_at
    row = _row(sid)
    assert row.crm_status == "failed"
    assert "gave up after 8 attempts" in row.crm_last_error
    assert len(crm.requests) == service.MAX_ATTEMPTS
    # The whole schedule spans roughly a day, not minutes and not a week.
    assert 18 * 3600 <= sum(service.BACKOFF_SECONDS) <= 26 * 3600


def test_claim_is_exclusive_so_two_workers_cannot_both_send():
    sid = _insert()
    engine = get_engine()
    assert service.claim(engine, sid, NOW) is not None
    assert service.claim(engine, sid, NOW) is None  # leased by the first
    # The lease expires on its own if the first worker died mid-send.
    assert service.claim(engine, sid, NOW + service.CLAIM_LEASE_SECONDS) is not None


def test_redirects_are_not_followed():
    crm = FakeCRM((301, {"location": "elsewhere"}))
    sid = _insert()
    _deliver(sid, crm)
    assert len(crm.requests) == 1
    row = _row(sid)
    assert row.crm_status == "failed" and "CRM_LEADS_URL" in row.crm_last_error


# --- secrets ------------------------------------------------------------------------------
def test_secret_never_reaches_logs_or_the_database(caplog):
    # Even a CRM that echoes the key back in an error body must not leak it.
    scenarios = [
        FakeCRM(500),
        FakeCRM(httpx.ConnectError(f"boom {SECRET}")),
        FakeCRM(httpx.ReadTimeout("slow")),
        FakeCRM((401, {"error": "bad"})),
        FakeCRM((400, {"error": f"echo {SECRET}"})),
    ]
    with caplog.at_level(logging.DEBUG):
        for crm in scenarios:
            sid = _insert()
            _deliver(sid, crm)
            assert SECRET not in _row(sid).crm_last_error
    assert SECRET not in caplog.text  # every logger, httpx's own included
    # Our messages name only scheme://host, never the integration id in the path.
    ours = "\n".join(r.getMessage() for r in caplog.records if r.name == "app.crm")
    assert ours and URL not in ours


# --- the public endpoint & the admin side --------------------------------------------------
@pytest.fixture
def crm_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "crm_leads_url", URL)
    monkeypatch.setattr(settings, "crm_leads_secret", SECRET)
    assert settings.crm_is_enabled

    # Keep the periodic sweep out of these tests: started by the lifespan, it would race
    # the request for rows left pending by other tests. It is covered via process_due.
    async def _no_worker():
        return None

    monkeypatch.setattr(main_module, "run_crm_worker", _no_worker)


def _token(c: TestClient) -> str:
    r = c.post("/api/auth/login", json={"username": "admin", "password": "test-pass"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_contact_returns_201_when_the_crm_is_down(crm_on, monkeypatch):
    crm = FakeCRM(httpx.ConnectError("connection refused"))
    monkeypatch.setattr(service, "TRANSPORT", crm.transport)
    with TestClient(app) as c:
        r = c.post("/api/contact", json={"name": "Ilie", "email": "ilie@example.com",
                                         "message": "Salut", "project": "Site web"})
        assert r.status_code == 201, r.text
        body = r.json()
        assert "crm_status" not in body  # internal state stays off the public response

        row = _row(body["id"])
        assert row.crm_status == "pending"  # queued in the outbox for the worker
        assert row.crm_attempts == 1  # the background push did try
        assert len(crm.requests) == 1

        token = _token(c)
        listed = c.get("/api/admin/submissions", params={"limit": 200},
                       headers={"Authorization": f"Bearer {token}"})
        assert listed.status_code == 200
        mine = next(s for s in listed.json() if s["id"] == body["id"])
        assert mine["crm_status"] == "pending"


def test_contact_pushes_the_lead_when_the_crm_is_up(crm_on, monkeypatch):
    crm = FakeCRM(201)
    monkeypatch.setattr(service, "TRANSPORT", crm.transport)
    with TestClient(app) as c:
        r = c.post("/api/contact", json={"name": "Maria", "email": "maria@example.com",
                                         "message": "Vreau un CRM"})
    assert r.status_code == 201
    assert _row(r.json()["id"]).crm_status == "sent"
    sent = json.loads(crm.requests[0].content)
    assert sent["externalId"] == r.json()["id"]
    assert "phone" not in sent and "project" not in sent and "estimate" not in sent


def test_admin_resend_requeues_a_failed_lead(crm_on, monkeypatch):
    crm = FakeCRM(201)
    monkeypatch.setattr(service, "TRANSPORT", crm.transport)
    sid = _insert(crm_status="failed", crm_attempts=8, crm_last_error="HTTP 401")
    with TestClient(app) as c:
        path = f"/api/admin/submissions/{sid}/crm-resend"
        assert c.post(path).status_code == 401  # admin only
        headers = {"Authorization": f"Bearer {_token(c)}"}
        r = c.post(path, headers=headers)
        assert r.status_code == 202, r.text
        assert r.json()["crm_status"] == "pending"
        assert c.post("/api/admin/submissions/nope/crm-resend", headers=headers).status_code == 404
    row = _row(sid)
    assert (row.crm_status, row.crm_attempts, row.crm_last_error) == ("sent", 1, "")


def test_admin_resend_is_409_when_the_crm_is_not_configured():
    sid = _insert(crm_status="")
    with TestClient(app) as c:
        r = c.post(f"/api/admin/submissions/{sid}/crm-resend",
                   headers={"Authorization": f"Bearer {_token(c)}"})
    assert r.status_code == 409


# --- migration ----------------------------------------------------------------------------
def test_boot_migration_adds_the_crm_columns_without_queueing_old_leads():
    path = os.path.join(tempfile.mkdtemp(prefix="tbs-crm-mig-"), "legacy.db")
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE submissions (id VARCHAR PRIMARY KEY, name VARCHAR NOT NULL, "
            "email VARCHAR NOT NULL, phone VARCHAR NOT NULL, message VARCHAR NOT NULL, "
            "project VARCHAR NOT NULL, estimate VARCHAR NOT NULL, created_at VARCHAR NOT NULL, "
            "status VARCHAR NOT NULL)"
        ))
        conn.execute(text(
            "INSERT INTO submissions VALUES ('old', 'A', 'a@b.md', '', 'm', '', '', "
            "'2026-01-01T00:00:00+00:00', 'nou')"
        ))
    assert _add_missing_columns(engine, "submissions", CRM_COLUMNS) == set(CRM_COLUMNS)
    assert _add_missing_columns(engine, "submissions", CRM_COLUMNS) == set()  # idempotent
    columns = {c["name"] for c in inspect(engine).get_columns("submissions")}
    assert set(CRM_COLUMNS) <= columns
    with engine.connect() as conn:
        status, attempts = conn.execute(
            text("SELECT crm_status, crm_attempts FROM submissions WHERE id='old'")
        ).one()
    assert (status, attempts) == ("", 0)  # pre-CRM leads are not pushed on deploy


# --- CRM_LEADS_URL rules ---------------------------------------------------------------------
_PROD = dict(
    environment="production",
    jwt_secret="x" * 40,
    admin_password="a-strong-admin-pass",
    cors_origins="https://tbs.md",
    rate_limit_enabled=True,
    telegram_bot_token="",
    crm_leads_secret=SECRET,
)


def test_production_accepts_the_public_https_url():
    assert Settings(**_PROD, crm_leads_url=URL).crm_is_enabled


@pytest.mark.parametrize(
    "url",
    [
        "http://tbs-crm.sma1lsoft.eu/api/v1/integrations/x/leads",
        "http://tbs-crm-frontend:8080/api/v1/integrations/x/leads",
        "http://localhost:8080/api/v1/integrations/x/leads",
        "ftp://tbs-crm.sma1lsoft.eu/leads",
    ],
)
def test_production_rejects_anything_but_https(url):
    with pytest.raises(ValueError, match="CRM_LEADS_URL"):
        Settings(**_PROD, crm_leads_url=url)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:8080/api/v1/integrations/x/leads",
        "http://127.0.0.1:8080/api/v1/integrations/x/leads",
        "http://tbs-crm-frontend:8080/api/v1/integrations/x/leads",
    ],
)
def test_development_allows_http_only_for_local_hosts(url):
    assert crm_url_problem(url, production=False) is None
    Settings(environment="development", crm_leads_url=url, crm_leads_secret=SECRET)


@pytest.mark.parametrize(
    "url",
    [
        "http://tbs-crm.sma1lsoft.eu/api/v1/integrations/x/leads",
        "https://user:pass@tbs-crm.sma1lsoft.eu/leads",
        "not a url",
        "https://",
    ],
)
def test_development_still_rejects_public_http_and_malformed_urls(url):
    with pytest.raises(ValueError, match="CRM_LEADS_URL"):
        Settings(environment="development", crm_leads_url=url, crm_leads_secret=SECRET)
