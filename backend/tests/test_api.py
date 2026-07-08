"""API tests against an isolated temp SQLite database (never touches the real DB)."""

import os
import tempfile

# Configure the app via env BEFORE importing it (settings are cached at import).
# A throwaway on-disk SQLite file keeps the real data dir untouched.
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-test-"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "test-pass"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

EMPTY = {"stats": [], "services": [], "team": [], "partners": [], "contacts": []}


@pytest.fixture(scope="module")
def client():
    # The `with` block runs the app lifespan → creates tables + seeds the DB.
    with TestClient(app) as c:
        yield c


def _token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login", json={"username": "admin", "password": "test-pass"}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_get_content_defaults(client):
    data = client.get("/api/content").json()
    assert len(data["services"]) == 11
    ai = next(s for s in data["services"] if s["id"] == "ai")
    assert ai["estimatorOnly"] is True
    assert len(data["stats"]) == 4
    assert data["partners"][0] == "PARTENER_01"


def test_put_requires_auth(client):
    assert client.put("/api/content", json=EMPTY).status_code in (401, 403)


def test_login_wrong_password(client):
    r = client.post(
        "/api/auth/login", json={"username": "admin", "password": "nope"}
    )
    assert r.status_code == 401


def test_login_correct_password_against_hashed_user(client):
    # The admin user was seeded with a bcrypt-hashed password, not a plaintext compare.
    r = client.post(
        "/api/auth/login", json={"username": "admin", "password": "test-pass"}
    )
    assert r.status_code == 200
    assert r.json()["access_token"]


def test_login_unknown_user(client):
    r = client.post(
        "/api/auth/login", json={"username": "ghost", "password": "test-pass"}
    )
    assert r.status_code == 401


def test_put_and_read_back(client):
    token = _token(client)
    payload = {
        **EMPTY,
        "stats": [{"id": "s1", "value": "50+", "label": "PROIECTE"}],
        "partners": ["ACME"],
    }
    r = client.put(
        "/api/content", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    back = client.get("/api/content").json()
    assert back["partners"] == ["ACME"]
    assert back["stats"][0]["value"] == "50+"


def test_db_round_trip_persists_across_new_store(client):
    """PUT then GET reflects a full document replace, read from the DB each time."""
    token = _token(client)
    payload = {
        "stats": [
            {"id": "a", "value": "1", "label": "one"},
            {"id": "b", "value": "2", "label": "two"},
        ],
        "services": [
            {
                "id": "svc",
                "name": "Svc",
                "desc": "d",
                "price": "9",
                "estimatorOnly": True,
            }
        ],
        "team": [{"id": "t", "name": "T", "role": "r", "bio": "b"}],
        "partners": ["P1", "P2", "P3"],
        "contacts": [{"id": "c", "type": "phone", "value": "+373"}],
    }
    r = client.put(
        "/api/content", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text

    back = client.get("/api/content").json()
    # Order preserved, fields round-tripped, delete-missing applied.
    assert [s["id"] for s in back["stats"]] == ["a", "b"]
    assert back["partners"] == ["P1", "P2", "P3"]
    assert back["services"][0]["estimatorOnly"] is True
    assert back["services"][0]["price"] == "9"
    assert back["contacts"][0]["type"] == "phone"

    # Replacing with an empty document deletes everything.
    r2 = client.put(
        "/api/content", json=EMPTY, headers={"Authorization": f"Bearer {token}"}
    )
    assert r2.status_code == 200
    assert client.get("/api/content").json() == EMPTY


def test_contact_submission_flow(client):
    r = client.post(
        "/api/contact",
        json={"name": "Ion", "email": "ion@example.com", "message": "Salut"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["id"]

    r2 = client.get(
        "/api/admin/submissions",
        headers={"Authorization": f"Bearer {_token(client)}"},
    )
    assert r2.status_code == 200
    assert any(s["name"] == "Ion" for s in r2.json())


def test_me_requires_valid_token(client):
    assert client.get("/api/auth/me").status_code in (401, 403)
    r = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {_token(client)}"}
    )
    assert r.json()["username"] == "admin"


# --- security / input-validation hardening -----------------------------------

def _auth(client):
    return {"Authorization": f"Bearer {_token(client)}"}


def test_oversized_field_rejected_on_contact(client):
    r = client.post(
        "/api/contact",
        json={"name": "x" * 10_000, "email": "a@b.com", "message": "hi"},
    )
    assert r.status_code == 422


def test_oversized_field_rejected_on_put_content(client):
    payload = {
        **EMPTY,
        "services": [
            {"id": "svc", "name": "x" * 10_000, "desc": "", "price": "1"}
        ],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422


def test_list_cap_rejected_on_put_content(client):
    payload = {
        **EMPTY,
        "partners": [f"P{i}" for i in range(201)],  # over MAX_LIST_ITEMS (200)
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422


def test_script_in_contact_message_is_sanitized(client):
    r = client.post(
        "/api/contact",
        json={
            "name": "Mallory",
            "email": "m@example.com",
            "message": "<script>alert(1)</script>",
        },
    )
    assert r.status_code == 201, r.text
    stored = r.json()["message"]
    # Sanitised (HTML-escaped): no executable <script> tag survives.
    assert "<script>" not in stored
    assert "&lt;script&gt;" in stored

    # And it is stored escaped — the admin list shows the neutralised value too.
    subs = client.get("/api/admin/submissions", headers=_auth(client)).json()
    match = next(s for s in subs if s["name"] == "Mallory")
    assert "<script>" not in match["message"]


def test_script_in_service_name_is_sanitized_and_read_back_clean(client):
    payload = {
        **EMPTY,
        "services": [
            {
                "id": "xss",
                "name": "<script>alert('x')</script>",
                "desc": "",
                "price": "1",
            }
        ],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 200, r.text
    # PUT response and a fresh GET must both be free of an executable <script> tag,
    # and must not be double-escaped on read.
    assert "<script>" not in r.json()["services"][0]["name"]
    back = client.get("/api/content").json()
    name = back["services"][0]["name"]
    assert "<script>" not in name
    assert name == "&lt;script&gt;alert(&#x27;x&#x27;)&lt;/script&gt;"
    # cleanup
    client.put("/api/content", json=EMPTY, headers=_auth(client))


def test_invalid_email_rejected(client):
    r = client.post(
        "/api/contact",
        json={"name": "Ana", "email": "not-an-email", "message": "hi"},
    )
    assert r.status_code == 422


def test_sqli_string_stored_as_literal_and_db_intact(client):
    injection = "'; DROP TABLE users;--"
    r = client.post(
        "/api/contact",
        json={"name": injection, "email": "sqli@example.com", "message": "hi"},
    )
    assert r.status_code == 201, r.text
    # Stored as inert literal text — the query structure was never touched (ORM/bound
    # params). Quotes are HTML-escaped by the sanitiser, but the payload is plain text.
    stored = r.json()["name"]
    assert "DROP TABLE users" in stored
    assert stored == "&#x27;; DROP TABLE users;--"

    # The users table is intact — login still works (table not dropped).
    assert (
        client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "test-pass"},
        ).status_code
        == 200
    )
    # And the content endpoint still works (DB not corrupted).
    assert client.get("/api/content").status_code == 200


def test_empty_required_field_rejected(client):
    # Empty message (required, non-empty after trim) → 422.
    r = client.post(
        "/api/contact",
        json={"name": "Ana", "email": "a@b.com", "message": "   "},
    )
    assert r.status_code == 422
    # Missing name → 422.
    r2 = client.post(
        "/api/contact", json={"email": "a@b.com", "message": "hi"}
    )
    assert r2.status_code == 422


def test_unsafe_url_scheme_rejected_on_contact_value(client):
    payload = {
        **EMPTY,
        "contacts": [
            {"id": "c-x", "type": "other", "value": "javascript:alert(1)"}
        ],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422
    # cleanup / ensure store still usable
    client.put("/api/content", json=EMPTY, headers=_auth(client))


def test_invalid_phone_rejected_on_contact_submission(client):
    r = client.post(
        "/api/contact",
        json={
            "name": "Ana",
            "email": "a@b.com",
            "message": "hi",
            "phone": "not-a-phone!!",
        },
    )
    assert r.status_code == 422
