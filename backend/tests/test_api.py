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

EMPTY = {
    "stats": [],
    "services": [],
    "team": [],
    "projects": [],
    "partners": [],
    "contacts": [],
    "socials": [],
}

# Every optional link on a team member, so a test payload can spell out the full shape.
BLANK_TEAM_LINKS = {
    "photo": "",
    "website": "",
    "linkedin": "",
    "instagram": "",
    "facebook": "",
    "github": "",
}


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
    assert data["partners"][0]["name"] == "Crowe Turcan Mikhailenko"
    assert data["partners"][0]["logo"] == "/partners/crowe.png"
    assert data["partners"][0]["url"] == "https://crowe-tm.md"

    # The real team, in order — photos/bios/links are left for the admin to fill in.
    assert [m["id"] for m in data["team"]] == [
        "chistol-maxim",
        "danu",
        "bales-laurentiu",
    ]
    assert data["team"][0]["name"] == "Maxim"
    assert data["team"][0]["role"] == "Team Lead & Fullstack Developer"
    assert data["team"][2]["role"] == "QA Tester & Pentester"
    assert all(m["photo"] == "" and m["linkedin"] == "" for m in data["team"])

    # The footer's social slots, each with an empty url until the admin sets one.
    assert [s["type"] for s in data["socials"]] == ["telegram", "linkedin", "github"]
    assert all(s["url"] == "" for s in data["socials"])


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
        "projects": [
            {"id": "biz", "name": "BizCheck", "tag": "WEB", "desc": "O platformă.",
             "url": "https://bizcheck.md", "appStore": "", "playStore": "",
             "images": ["/projects/bizcheck-1.jpg", "/projects/bizcheck-2.png"]}
        ],
        "partners": [
            {"id": "acme", "name": "ACME", "logo": "/partners/acme.png",
             "url": "https://acme.md", "preview": ""}
        ],
    }
    r = client.put(
        "/api/content", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text
    back = client.get("/api/content").json()
    assert back["partners"] == [
        {"id": "acme", "name": "ACME", "logo": "/partners/acme.png",
         "url": "https://acme.md", "preview": ""}
    ]
    # The gallery round-trips in order.
    assert back["projects"][0]["images"] == [
        "/projects/bizcheck-1.jpg",
        "/projects/bizcheck-2.png",
    ]
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
        "partners": [
            {"id": f"p{i}", "name": f"P{i}", "logo": "", "url": ""}
            for i in range(1, 4)
        ],
        "contacts": [{"id": "c", "type": "phone", "value": "+373"}],
    }
    r = client.put(
        "/api/content", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert r.status_code == 200, r.text

    back = client.get("/api/content").json()
    # Order preserved, fields round-tripped, delete-missing applied.
    assert [s["id"] for s in back["stats"]] == ["a", "b"]
    assert [p["name"] for p in back["partners"]] == ["P1", "P2", "P3"]
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
        # over MAX_LIST_ITEMS (200)
        "partners": [
            {"id": f"p{i}", "name": f"P{i}", "logo": "", "url": ""}
            for i in range(201)
        ],
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

    # Stored VERBATIM — escaping belongs at the boundary that interprets HTML, not here.
    # The site renders through React (which escapes every value it prints) and the bot
    # escapes each value as it builds its message, so this text can never execute. What
    # it must NOT do is get mangled: escaping on write turned a legitimate "A & B" into
    # "A &amp; B" and React then printed those five characters to the visitor.
    assert r.json()["message"] == "<script>alert(1)</script>"

    subs = client.get("/api/admin/submissions", headers=_auth(client)).json()
    match = next(s for s in subs if s["name"] == "Mallory")
    assert match["message"] == "<script>alert(1)</script>"


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

    # Round-trips byte-for-byte: not escaped, and therefore not double-escaped either.
    assert r.json()["services"][0]["name"] == "<script>alert('x')</script>"
    back = client.get("/api/content").json()
    assert back["services"][0]["name"] == "<script>alert('x')</script>"
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
    # Stored as inert literal text, quotes and all: the query structure was never touched
    # (every statement is built with the ORM and bound parameters). Safety here comes from
    # parameterisation, not from mangling the user's apostrophes.
    stored = r.json()["name"]
    assert stored == injection

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


def test_an_ampersand_in_content_survives_the_round_trip(client):
    """The bug this whole change exists for.

    "Dashboard & rapoarte" was stored HTML-escaped as "Dashboard &amp; rapoarte"; React
    then printed those literal characters, so every visitor to tbs.md read
    "Dashboard &amp; rapoarte" on the services card.
    """
    payload = {
        **EMPTY,
        "services": [
            {
                "id": "dash",
                "name": "Dashboard & rapoarte",
                "desc": 'Cost < 500 lei > buget, "premium" & rapid',
                "price": "1",
            }
        ],
    }
    assert client.put("/api/content", json=payload, headers=_auth(client)).status_code == 200

    service = client.get("/api/content").json()["services"][0]
    assert service["name"] == "Dashboard & rapoarte"
    assert service["desc"] == 'Cost < 500 lei > buget, "premium" & rapid'
    assert "&amp;" not in service["name"]


# --- team photos & social links ----------------------------------------------

def test_team_photo_and_social_links_round_trip(client):
    """A team member's photo and every personal profile link survive PUT → GET."""
    member = {
        "id": "chistol-maxim",
        "name": "Maxim",
        "role": "Team Lead & Fullstack Developer",
        "bio": "Construiește produsul cap-coadă.",
        "photo": "/api/uploads/maxim.webp",
        "website": "https://maxim.md",
        "linkedin": "https://linkedin.com/in/maxim",
        "instagram": "https://instagram.com/maxim",
        "facebook": "https://facebook.com/maxim",
        "github": "https://github.com/maxim",
    }
    r = client.put(
        "/api/content", json={**EMPTY, "team": [member]}, headers=_auth(client)
    )
    assert r.status_code == 200, r.text

    back = client.get("/api/content").json()
    assert back["team"] == [member]  # field-for-field, nothing dropped or mangled
    client.put("/api/content", json=EMPTY, headers=_auth(client))


def test_team_member_keeps_empty_links_by_default(client):
    """The links are optional: a member sent without them reads back with empty strings."""
    r = client.put(
        "/api/content",
        json={**EMPTY, "team": [{"id": "danu", "name": "Danu", "role": "Dev"}]},
        headers=_auth(client),
    )
    assert r.status_code == 200, r.text

    member = client.get("/api/content").json()["team"][0]
    assert member == {"id": "danu", "name": "Danu", "role": "Dev", "bio": "",
                      **BLANK_TEAM_LINKS}
    client.put("/api/content", json=EMPTY, headers=_auth(client))


@pytest.mark.parametrize(
    "field",
    ["photo", "website", "linkedin", "instagram", "facebook", "github"],
)
def test_unsafe_link_rejected_on_every_team_field(client, field):
    """A javascript: URL in any of the new link fields is rejected outright (422).

    Links are validated, never escaped — escaping would corrupt a legitimate URL — so a
    dangerous scheme must never reach the database in the first place.
    """
    member = {
        "id": "mallory",
        "name": "Mallory",
        "role": "r",
        field: "javascript:alert(1)",
    }
    r = client.put(
        "/api/content", json={**EMPTY, "team": [member]}, headers=_auth(client)
    )
    assert r.status_code == 422

    # Nothing was written.
    assert client.get("/api/content").json()["team"] == []


@pytest.mark.parametrize(
    "bad_link",
    [
        "data:text/html;base64,PHNjcmlwdD4=",
        "//evil.example.com/x.png",  # protocol-relative
        'https://ok.md/" onerror="alert(1)',  # attribute breakout
    ],
)
def test_other_dangerous_links_rejected_on_a_team_photo(client, bad_link):
    payload = {
        **EMPTY,
        "team": [{"id": "m", "name": "M", "role": "r", "photo": bad_link}],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422


def test_socials_round_trip_in_order(client):
    socials = [
        {"id": "so-telegram", "type": "telegram", "url": "https://t.me/tbsdigital"},
        {"id": "so-linkedin", "type": "linkedin", "url": "https://linkedin.com/company/tbs"},
        {"id": "so-github", "type": "github", "url": ""},  # not filled in yet
    ]
    r = client.put(
        "/api/content", json={**EMPTY, "socials": socials}, headers=_auth(client)
    )
    assert r.status_code == 200, r.text

    back = client.get("/api/content").json()
    assert back["socials"] == socials  # same order, same values

    # Reordering + dropping one is a full replace, exactly like the other lists.
    trimmed = [socials[2], socials[0]]
    client.put(
        "/api/content", json={**EMPTY, "socials": trimmed}, headers=_auth(client)
    )
    assert client.get("/api/content").json()["socials"] == trimmed
    client.put("/api/content", json=EMPTY, headers=_auth(client))


def test_unknown_social_type_rejected(client):
    payload = {
        **EMPTY,
        "socials": [{"id": "so-x", "type": "myspace", "url": "https://myspace.com/x"}],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422


def test_unsafe_link_rejected_on_a_social_url(client):
    payload = {
        **EMPTY,
        "socials": [{"id": "so-x", "type": "telegram", "url": "javascript:alert(1)"}],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422


def test_socials_list_cap_enforced(client):
    payload = {
        **EMPTY,
        "socials": [
            {"id": f"so{i}", "type": "website", "url": ""} for i in range(201)
        ],
    }
    r = client.put("/api/content", json=payload, headers=_auth(client))
    assert r.status_code == 422
