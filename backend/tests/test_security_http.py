"""HTTP-level security-hardening regression tests.

Covers the CORS lockdown, security-response-headers middleware, the streaming
body-size cap (413), the rate-limiter wiring / enforcement (429), and the paginated
admin submissions endpoint. Runs against an isolated temp SQLite database and never
touches the network (Telegram is forced off by conftest.py).
"""

import os
import tempfile

# Configure the app via env BEFORE importing it (settings are cached at import).
# Mirrors test_api.py so both modules agree on the DB when collected together.
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="tbs-sec-test-"), "test.db")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{_DB_FILE}")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "test-pass")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402

from app.main import app, limiter  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _token(client: TestClient) -> str:
    r = client.post(
        "/api/auth/login", json={"username": "admin", "password": "test-pass"}
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth(client: TestClient) -> dict:
    return {"Authorization": f"Bearer {_token(client)}"}


# --- security headers --------------------------------------------------------


def test_security_headers_present_on_every_response(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["referrer-policy"] == "no-referrer"
    # The API is JSON-only, so it gets the strictest possible CSP: nothing may load,
    # frame, or act. This is the backstop for the admin JWT in localStorage.
    csp = r.headers["content-security-policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp
    assert "base-uri 'none'" in csp


def test_hsts_absent_outside_production(client):
    # settings.is_production is False in the test env => no HSTS on local http.
    r = client.get("/health")
    assert "strict-transport-security" not in r.headers


# --- CORS lockdown -----------------------------------------------------------


def test_cors_preflight_does_not_allow_credentials(client):
    r = client.options(
        "/api/content",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Whatever the preflight status, it must never grant credentialed access.
    assert r.headers.get("access-control-allow-credentials") != "true"


def test_cors_simple_response_does_not_allow_credentials(client):
    r = client.get("/api/content", headers={"Origin": "http://localhost:3000"})
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-credentials") != "true"
    # Allow-list origin is echoed, but credentials stay off.
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


# --- body-size cap (413) -----------------------------------------------------


def test_oversized_body_with_content_length_rejected(client):
    # Over 1 MB, Content-Length declared (httpx sets it) => 413.
    big = b"x" * (1_000_001)
    r = client.post("/api/contact", content=big,
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413
    assert r.json()["detail"] == "Request body too large"
    # The 413 still carries the security headers (outermost middleware stamps it).
    assert r.headers["x-frame-options"] == "DENY"


def test_oversized_chunked_body_without_content_length_rejected(client):
    # A streamed/chunked body has no Content-Length; the cap must still fire.
    def gen():
        chunk = b"x" * 100_000
        for _ in range(12):  # 1.2 MB total
            yield chunk

    r = client.post("/api/contact", content=gen(),
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413
    assert r.json()["detail"] == "Request body too large"


def test_normal_small_body_passes_through(client):
    # A valid small submission is unaffected by the cap.
    r = client.post(
        "/api/contact",
        json={"name": "Sizely", "email": "s@example.com", "message": "hi"},
    )
    assert r.status_code == 201, r.text


# --- rate limiting -----------------------------------------------------------


def test_rate_limiter_is_wired(client):
    # Limiter exposed on app.state and the 429 handler registered.
    assert app.state.limiter is limiter
    assert RateLimitExceeded in app.exception_handlers
    # Disabled in the test env so the rest of the suite never hits 429.
    assert limiter.enabled is False


def test_login_rate_limit_returns_429_when_enabled(client):
    """Enable the limiter for one test and prove the 6th login (>5/min) is 429."""
    limiter.enabled = True
    # Isolated bucket via X-Forwarded-For so other tests' calls don't interfere.
    headers = {"X-Forwarded-For": "203.0.113.7"}
    try:
        statuses = []
        for _ in range(6):
            r = client.post(
                "/api/auth/login",
                json={"username": "admin", "password": "nope"},
                headers=headers,
            )
            statuses.append(r.status_code)
        assert statuses[:5] == [401] * 5  # first five reach the endpoint
        assert statuses[5] == 429  # sixth is throttled
    finally:
        limiter.enabled = False


# --- submissions pagination --------------------------------------------------


def test_submissions_pagination_limit_and_offset(client):
    auth = _auth(client)
    # Seed a handful of submissions (newest last).
    names = [f"Pager{i}" for i in range(5)]
    for name in names:
        r = client.post(
            "/api/contact",
            json={"name": name, "email": "p@example.com", "message": "hi"},
        )
        assert r.status_code == 201, r.text

    # Default (no params) returns newest-first, at most 50.
    default = client.get("/api/admin/submissions", headers=auth).json()
    assert len(default) <= 50
    assert default[0]["name"] == "Pager4"  # newest first preserved

    # limit caps the row count.
    page1 = client.get("/api/admin/submissions?limit=2", headers=auth).json()
    assert len(page1) == 2
    assert [s["name"] for s in page1] == ["Pager4", "Pager3"]

    # offset skips the newest rows; ordering preserved.
    page2 = client.get(
        "/api/admin/submissions?limit=2&offset=2", headers=auth
    ).json()
    assert [s["name"] for s in page2] == ["Pager2", "Pager1"]
    # No overlap between the two pages.
    assert not ({s["id"] for s in page1} & {s["id"] for s in page2})


def test_submissions_limit_bounds_enforced(client):
    auth = _auth(client)
    # limit above the max (200) and below the min (1) are rejected by validation.
    assert client.get("/api/admin/submissions?limit=201", headers=auth).status_code == 422
    assert client.get("/api/admin/submissions?limit=0", headers=auth).status_code == 422
    assert client.get("/api/admin/submissions?offset=-1", headers=auth).status_code == 422


# --- existing behaviour still intact -----------------------------------------


def test_existing_endpoints_still_behave(client):
    assert client.get("/health").json()["status"] == "ok"
    assert client.get("/api/content").status_code == 200
    # Auth still required for the admin list.
    assert client.get("/api/admin/submissions").status_code in (401, 403)
