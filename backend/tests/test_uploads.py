"""Logo upload: auth, format sniffing, size cap, compression — and the partner links.

The upload endpoint is the only one that accepts binary content, so the checks that
keep it from becoming a file-drop / stored-XSS primitive are pinned here, together with
the server-side compression that keeps a phone photo from being stored at phone-photo
size.
"""

import io
import os
import random
import struct
import tempfile
import zlib

# Configure the app via env BEFORE importing it (settings are cached at import).
_TMP = tempfile.mkdtemp(prefix="tbs-upload-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TMP, 'test.db')}"
os.environ["DATA_DIR"] = os.path.join(_TMP, "data")
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "test-pass"
os.environ["JWT_SECRET"] = "test-secret"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402

from app.main import app  # noqa: E402
from app.routers.uploads import (  # noqa: E402
    MAX_DIMENSION,
    MAX_IMAGE_PIXELS,
    MAX_UPLOAD_BYTES,
    _extension_for,
    uploads_dir,
)

# Bodies with valid magic bytes but a garbage payload. They get past the sniffer and
# must then die in the decoder — as a 400, never a 500.
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG_BYTES = b"\xff\xd8\xff" + b"\x00" * 64
WEBP_BYTES = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 64


def _image(width=800, height=600, mode="RGB", fmt="PNG", **save_kwargs) -> bytes:
    """A real, decodable, screenshot-shaped image.

    Deterministic (seeded) and detailed enough to be representative: a gradient plus a
    few hundred shapes, i.e. roughly what the admin actually uploads. A flat colour
    would compress to nothing and a field of per-pixel noise would compress to nothing
    *useful*; neither would tell us anything about real behaviour.
    """
    random.seed(11)
    opaque = (255,) if mode == "RGBA" else ()
    image = Image.new(mode, (width, height), (250, 250, 252) + opaque)
    draw = ImageDraw.Draw(image)
    for y in range(0, height, 2):
        shade = (20 + (y * 160) // height, 40 + (y * 80) // height, 180 - (y * 120) // height)
        draw.rectangle([0, y, width, y + 2], fill=shade + opaque)
    for _ in range((width * height) // 4000):
        x0, y0 = random.randrange(width), random.randrange(height)
        x1 = x0 + random.randrange(20, 300)
        y1 = y0 + random.randrange(10, 160)
        colour = (
            random.randrange(256),
            random.randrange(256),
            random.randrange(256),
        ) + opaque
        shape = draw.ellipse if random.random() < 0.4 else draw.rectangle
        shape([x0, y0, x1, y1], fill=colour)
    image = image.filter(ImageFilter.GaussianBlur(0.6))

    buffer = io.BytesIO()
    image.save(buffer, format=fmt, **save_kwargs)
    return buffer.getvalue()


def _noise_jpeg(width=600, height=600) -> bytes:
    """Per-pixel noise at a low JPEG quality: a source WebP genuinely cannot beat."""
    random.seed(3)
    image = Image.new("RGB", (width, height))
    image.putdata(
        [
            (random.randrange(256), random.randrange(256), random.randrange(256))
            for _ in range(width * height)
        ]
    )
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=25)
    return buffer.getvalue()


def _transparent_png(width=400, height=400) -> bytes:
    """A white-on-transparent logo — exactly the shape of the real partner logos."""
    image = Image.new("RGBA", (width, height), (255, 255, 255, 0))
    for x in range(width // 4, 3 * width // 4):
        for y in range(height // 4, 3 * height // 4):
            image.putpixel((x, y), (255, 255, 255, 255))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


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


def _stored_bytes(url: str) -> bytes:
    return (uploads_dir() / url.rsplit("/", 1)[-1]).read_bytes()


# --------------------------------------------------------------------------- auth


def test_upload_requires_admin(client):
    r = client.post(
        "/api/admin/uploads", files={"file": ("logo.png", _image(), "image/png")}
    )
    assert r.status_code == 401


# ------------------------------------------------------------ format + serving


@pytest.mark.parametrize(
    "content",
    [
        _image(fmt="PNG"),
        _image(fmt="JPEG", quality=95),
        _image(fmt="WEBP", quality=95),
    ],
    ids=["png", "jpeg", "webp"],
)
def test_upload_accepts_raster_images_and_serves_them(client, content):
    """Every accepted format is re-encoded to WebP, and the URL says so."""
    r = _upload(client, content)
    assert r.status_code == 201, r.text

    url = r.json()["url"]
    assert url.startswith("/api/uploads/")
    assert url.endswith(".webp")

    # The URL's extension matches what was actually written to disk...
    stored = _stored_bytes(url)
    assert Image.open(io.BytesIO(stored)).format == "WEBP"

    # ...and the stored file is served back at the returned path.
    served = client.get(url)
    assert served.status_code == 200
    assert served.content == stored


def test_upload_rejects_svg_even_when_declared_an_image(client):
    """An SVG can carry <script>; serving one from our origin would be stored XSS."""
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    r = _upload(client, svg, filename="logo.svg", content_type="image/svg+xml")
    assert r.status_code == 400


def test_upload_trusts_magic_bytes_not_the_declared_content_type(client):
    """A script that claims to be a PNG is still refused — the bytes decide."""
    r = _upload(client, b"<?php system($_GET[0]); ?>", content_type="image/png")
    assert r.status_code == 400


@pytest.mark.parametrize(
    "content", [PNG_BYTES, JPEG_BYTES, WEBP_BYTES], ids=["png", "jpeg", "webp"]
)
def test_upload_rejects_corrupt_image_with_valid_magic_bytes(client, content):
    """Valid header, garbage body: the decoder must fail as a clean 400, not a 500."""
    r = _upload(client, content)
    assert r.status_code == 400, r.text
    assert "Internal Server Error" not in r.text


def test_upload_rejects_oversized_file(client):
    """Just over the router's cap (and still under the middleware's), so it is the
    streaming read in the router that abandons this one."""
    r = _upload(client, PNG_BYTES + b"\x00" * MAX_UPLOAD_BYTES)
    assert r.status_code == 413


def test_stored_filename_ignores_a_traversing_filename(client):
    """The client's filename is never used — we generate a uuid + a safe extension."""
    r = _upload(client, _image(), filename="../../../../etc/passwd.png")
    assert r.status_code == 201
    url = r.json()["url"]
    assert ".." not in url
    assert url.startswith("/api/uploads/")


# ----------------------------------------------------------------- compression


def test_large_png_is_stored_much_smaller_and_downscaled(client):
    """A big PNG must not land on disk at its original size."""
    original = _image(width=2400, height=1600, fmt="PNG")
    assert len(original) > 150 * 1024  # a realistically chunky source

    r = _upload(client, original)
    assert r.status_code == 201, r.text

    stored = _stored_bytes(r.json()["url"])
    assert len(stored) < len(original) / 2

    with Image.open(io.BytesIO(stored)) as image:
        assert max(image.size) <= MAX_DIMENSION
        # Aspect ratio preserved: 2400x1600 -> 1600x1067.
        assert image.size == (MAX_DIMENSION, 1067)


def test_small_image_is_not_upscaled(client):
    r = _upload(client, _image(width=120, height=80, fmt="PNG"))
    assert r.status_code == 201, r.text

    with Image.open(io.BytesIO(_stored_bytes(r.json()["url"]))) as image:
        assert image.size == (120, 80)


def test_upload_always_re_encodes_never_keeps_the_original_bytes(client):
    """Security over size: we always store our own re-encode, never the client's bytes.

    Keeping the original when the WebP wasn't smaller would let a polyglot (a valid image
    header with a payload appended) survive on disk verbatim. Rebuilding from decoded
    pixels drops everything but the image, so the stored file is always a clean WebP —
    even if that costs a few bytes on an already-tiny source.
    """
    original = _noise_jpeg()

    r = _upload(client, original, filename="noise.jpg", content_type="image/jpeg")
    assert r.status_code == 201, r.text

    url = r.json()["url"]
    assert url.endswith(".webp")  # never the source extension
    stored = _stored_bytes(url)
    assert stored != original
    assert Image.open(io.BytesIO(stored)).format == "WEBP"
    assert client.get(url).status_code == 200


def test_upload_strips_an_appended_polyglot_payload(client):
    """A valid image with an HTML/script payload glued on decodes fine, but the payload
    must not survive to disk."""
    payload = b"<script>alert(document.cookie)</script>" * 8
    poly = _image(fmt="PNG") + payload

    r = _upload(client, poly)
    assert r.status_code == 201, r.text

    stored = _stored_bytes(r.json()["url"])
    assert b"<script>" not in stored
    assert Image.open(io.BytesIO(stored)).format == "WEBP"


def test_transparency_survives_the_round_trip(client):
    """THE partner-logo regression: a white-on-transparent PNG must keep its alpha.

    Flattening it onto a white background would render the logo invisible on the site.
    """
    r = _upload(client, _transparent_png())
    assert r.status_code == 201, r.text

    with Image.open(io.BytesIO(_stored_bytes(r.json()["url"]))) as image:
        assert image.mode == "RGBA"
        alpha = image.convert("RGBA").getchannel("A")
        assert alpha.getextrema()[0] == 0  # fully transparent pixels still there
        assert alpha.getextrema()[1] == 255  # ...and fully opaque ones too
        # The corner is background: it must still be transparent, not white.
        assert image.convert("RGBA").getpixel((0, 0))[3] == 0


def test_exif_metadata_is_stripped(client):
    """EXIF can carry GPS coordinates — a privacy leak. It must not reach the disk."""
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (47.0, 1.0, 0.0), 3: "E", 4: (28.0, 5.0, 0.0)}  # GPS IFD
    exif[0x010F] = "TBS-Test-Camera"  # Make
    original = _image(width=1200, height=900, fmt="JPEG", quality=95, exif=exif)

    # Sanity: the source really does carry the metadata we expect to lose.
    with Image.open(io.BytesIO(original)) as source:
        assert source.getexif()
        assert source.info.get("exif")

    r = _upload(client, original, filename="photo.jpg", content_type="image/jpeg")
    assert r.status_code == 201, r.text

    stored = _stored_bytes(r.json()["url"])
    assert b"TBS-Test-Camera" not in stored
    with Image.open(io.BytesIO(stored)) as image:
        assert not image.getexif()
        assert not image.info.get("exif")
        assert not image.info.get("icc_profile")


def _png_bomb(width=50000, height=50000) -> bytes:
    """A hand-rolled PNG whose IHDR *declares* a huge canvas.

    Built byte by byte on purpose: actually rendering 50000x50000 would allocate the
    very gigabytes the server is supposed to refuse to allocate. This is what a real
    bomb looks like on the wire — a valid header and a handful of KB of pixel data.
    """
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)  # 8-bit greyscale
    idat = zlib.compress(b"\x00" * 1024, 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def test_decompression_bomb_is_rejected(client):
    """A few-KB PNG declaring 50000x50000 would allocate gigabytes if decoded."""
    payload = _png_bomb()
    assert len(payload) < MAX_UPLOAD_BYTES  # it sails past the size cap...
    assert _extension_for(payload) == "png"  # ...and past the magic-byte sniffer...

    r = _upload(client, payload)
    assert r.status_code == 400, r.text  # ...but the pixel-count guard stops it.

    # The guard must not have been disarmed for whatever runs next.
    assert Image.MAX_IMAGE_PIXELS == MAX_IMAGE_PIXELS


# --------------------------------------------------------------- partner links


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


def test_upload_refused_when_the_storage_budget_is_exhausted(client, monkeypatch):
    """A stolen/abused admin token must not be able to fill the disk."""
    import app.routers.uploads as up

    # Pretend the directory is already at budget; the next upload must be refused BEFORE
    # the expensive decode, with 507, not stored.
    monkeypatch.setattr(up, "_uploads_dir_bytes", lambda: up.MAX_UPLOADS_DIR_BYTES)

    r = _upload(client, _image())
    assert r.status_code == 507, r.text
