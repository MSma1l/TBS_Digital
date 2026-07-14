"""Logo upload: auth, format sniffing, size cap — and the partner link validation.

The upload endpoint is the only one that accepts binary content, so the checks that
keep it from becoming a file-drop / stored-XSS primitive are pinned here.
"""

import os
import tempfile

# Configure the app via env BEFORE importing it (settings are cached at import).
_TMP = tempfile.mkdtemp(prefix="tbs-upload-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP, 'test.db')}"
os.environ["DATA_DIR"] = os.path.join(_TMP, "data")
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "test-pass"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routers.uploads import MAX_UPLOAD_BYTES  # noqa: E402

# Smallest valid PNG header we need — the endpoint sniffs magic bytes, not the body.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 64
WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64


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


def _upload(client, content: bytes, filename="logo.png", content_type="image/png"):
    return client.post(
        "/api/admin/uploads",
        files={"file": (filename, content, content_type)},
        headers={"Authorization": f"Bearer {_token(client)}"},
    )


def test_upload_requires_admin(client):
    r = client.post(
        "/api/admin/uploads", files={"file": ("logo.png", PNG_BYTES, "image/png")}
    )
    assert r.status_code == 401


@pytest.mark.parametrize(
    "content,expected_ext",
    [(PNG_BYTES, "png"), (JPEG_BYTES, "jpg"), (WEBP_BYTES, "webp")],
)
def test_upload_accepts_raster_images_and_serves_them(client, content, expected_ext):
    r = _upload(client, content)
    assert r.status_code == 201, r.text

    url = r.json()["url"]
    assert url.startswith("/api/uploads/")
    assert url.endswith(f".{expected_ext}")

    # The stored file is actually served back at the returned path.
    served = client.get(url)
    assert served.status_code == 200
    assert served.content == content


def test_upload_rejects_svg_even_when_declared_an_image(client):
    """An SVG can carry <script>; serving one from our origin would be stored XSS."""
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    r = _upload(client, svg, filename="logo.svg", content_type="image/svg+xml")
    assert r.status_code == 400


def test_upload_trusts_magic_bytes_not_the_declared_content_type(client):
    """A script that claims to be a PNG is still refused — the bytes decide."""
    r = _upload(client, b"<?php system($_GET[0]); ?>", content_type="image/png")
    assert r.status_code == 400


def test_upload_rejects_oversized_file(client):
    r = _upload(client, PNG_BYTES + b"\x00" * MAX_UPLOAD_BYTES)
    assert r.status_code == 413


def test_stored_filename_ignores_a_traversing_filename(client):
    """The client's filename is never used — we generate a uuid + a safe extension."""
    r = _upload(client, PNG_BYTES, filename="../../../../etc/passwd.png")
    assert r.status_code == 201
    url = r.json()["url"]
    assert ".." not in url
    assert url.startswith("/api/uploads/")


@pytest.mark.parametrize(
    "bad_logo",
    [
        "javascript:alert(1)",
        "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        "vbscript:msgbox(1)",
        "//evil.example/logo.png",  # protocol-relative
        'https://ok.md/a.png" onerror="alert(1)',  # attribute breakout
        "ftp://evil.example/logo.png",
    ],
)
def test_partner_link_fields_reject_unsafe_values(client, bad_logo):
    r = client.put(
        "/api/content",
        json={
            "stats": [],
            "services": [],
            "team": [],
            "contacts": [],
            "partners": [{"id": "x", "name": "X", "logo": bad_logo, "url": ""}],
        },
        headers={"Authorization": f"Bearer {_token(client)}"},
    )
    assert r.status_code == 422, r.text


@pytest.mark.parametrize(
    "good_link",
    ["", "/partners/crowe.png", "/api/uploads/abc123.png", "https://crowe-tm.md"],
)
def test_partner_link_fields_accept_paths_and_https(client, good_link):
    r = client.put(
        "/api/content",
        json={
            "stats": [],
            "services": [],
            "team": [],
            "contacts": [],
            "partners": [{"id": "x", "name": "X", "logo": good_link, "url": good_link}],
        },
        headers={"Authorization": f"Bearer {_token(client)}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["partners"][0]["logo"] == good_link
