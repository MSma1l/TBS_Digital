"""Smoke tests for the API against the JSON stand-in (isolated temp data dir)."""

import os
import tempfile

# Configure the app via env BEFORE importing it (settings are cached at import).
os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="tbs-test-")
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "test-pass"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)

EMPTY = {"stats": [], "services": [], "team": [], "partners": [], "contacts": []}


def _token() -> str:
    r = client.post("/api/auth/login", json={"username": "admin", "password": "test-pass"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_get_content_defaults():
    data = client.get("/api/content").json()
    assert len(data["services"]) == 11
    ai = next(s for s in data["services"] if s["id"] == "ai")
    assert ai["estimatorOnly"] is True
    assert len(data["stats"]) == 4
    assert data["partners"][0] == "PARTENER_01"


def test_put_requires_auth():
    assert client.put("/api/content", json=EMPTY).status_code in (401, 403)


def test_login_wrong_password():
    r = client.post("/api/auth/login", json={"username": "admin", "password": "nope"})
    assert r.status_code == 401


def test_put_and_read_back():
    token = _token()
    payload = {
        **EMPTY,
        "stats": [{"id": "s1", "value": "50+", "label": "PROIECTE"}],
        "partners": ["ACME"],
    }
    r = client.put("/api/content", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    back = client.get("/api/content").json()
    assert back["partners"] == ["ACME"]
    assert back["stats"][0]["value"] == "50+"


def test_contact_submission_flow():
    r = client.post("/api/contact", json={"name": "Ion", "email": "ion@example.com", "message": "Salut"})
    assert r.status_code == 201, r.text
    assert r.json()["id"]

    r2 = client.get("/api/admin/submissions", headers={"Authorization": f"Bearer {_token()}"})
    assert r2.status_code == 200
    assert any(s["name"] == "Ion" for s in r2.json())


def test_me_requires_valid_token():
    assert client.get("/api/auth/me").status_code in (401, 403)
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {_token()}"})
    assert r.json()["username"] == "admin"
