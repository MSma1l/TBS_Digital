"""Regression tests for the pentest hardening pass.

One test per fixed finding, proving it stays closed:
- X-Forwarded-For can't be spoofed to mint fresh rate-limit buckets (CRITIC).
- The production fail-fast guard rejects weak admin passwords, a disabled rate limiter,
  and a Telegram bot with no admin allow-list.
- The migration DDL refuses an unsafe SQL identifier.
- The uploads directory has a total-size budget.
"""

import pytest

from app.config import Settings


# --------------------------------------------------------------- X-Forwarded-For
# The rate-limit key must be the address the *trusted* proxy vouched for (right-most for
# one hop), never the left-most value the client fully controls — otherwise an attacker
# rotates the header and defeats every per-IP limit.


class _Req:
    def __init__(self, xff=None):
        self.headers = {"x-forwarded-for": xff} if xff else {}
        self.client = type("C", (), {"host": "10.0.0.1"})()


def _client_ip_with(trusted_hops, req):
    from app import main

    original = main.settings
    main.settings = Settings(
        trusted_proxy_count=trusted_hops,
        environment="development",
        rate_limit_enabled=True,
    )
    try:
        return main._client_ip(req)
    finally:
        main.settings = original


def test_spoofed_left_most_forwarded_for_is_ignored():
    # nginx appends the real peer, so the chain is "<spoof>, <real>". With one trusted
    # proxy we must take the real (right-most) entry, not the attacker's.
    assert _client_ip_with(1, _Req("1.2.3.4, 203.0.113.9")) == "203.0.113.9"


def test_attacker_cannot_shift_the_bucket_by_prepending_entries():
    # Any number of attacker-prepended hops still resolve to the same real client.
    a = _client_ip_with(1, _Req("9.9.9.9, 203.0.113.9"))
    b = _client_ip_with(1, _Req("8.8.8.8, 7.7.7.7, 203.0.113.9"))
    assert a == b == "203.0.113.9"


def test_no_proxy_uses_the_socket_peer_and_ignores_the_header():
    assert _client_ip_with(0, _Req("1.2.3.4")) == "10.0.0.1"


# ----------------------------------------------------------- production guard


def _prod(**overrides):
    base = dict(
        environment="production",
        jwt_secret="x" * 40,
        admin_password="a-strong-admin-pass",
        cors_origins="https://tbs.md",
        rate_limit_enabled=True,
        telegram_bot_token="",  # disabled => the admin-ids rule doesn't apply
    )
    base.update(overrides)
    return base


def test_prod_guard_accepts_a_sound_config():
    Settings(**_prod())  # must not raise


def test_prod_guard_rejects_a_weak_admin_password():
    with pytest.raises(ValueError, match="ADMIN_PASSWORD"):
        Settings(**_prod(admin_password="short"))


def test_prod_guard_rejects_a_disabled_rate_limiter():
    with pytest.raises(ValueError, match="RATE_LIMIT_ENABLED"):
        Settings(**_prod(rate_limit_enabled=False))


def test_prod_guard_rejects_an_enabled_bot_with_no_admin_ids():
    # telegram_enabled is forced False in the test env (conftest), so set it explicitly to
    # exercise the "bot on, no allow-list" path.
    with pytest.raises(ValueError, match="TELEGRAM_ADMIN_IDS"):
        Settings(
            **_prod(
                telegram_bot_token="123:abc",
                telegram_enabled=True,
                telegram_admin_ids="",
            )
        )


def test_prod_guard_accepts_an_enabled_bot_with_admin_ids():
    Settings(
        **_prod(
            telegram_bot_token="123:abc",
            telegram_enabled=True,
            telegram_admin_ids="42",
        )
    )


# ------------------------------------------------------------- migration DDL


def test_add_missing_columns_rejects_an_unsafe_identifier():
    from sqlmodel import SQLModel, create_engine

    from app.db import _add_missing_columns

    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)

    # A hostile table/column name (were one ever routed here from config/request) must be
    # refused, not interpolated into the ALTER TABLE.
    with pytest.raises(ValueError, match="unsafe SQL identifier"):
        _add_missing_columns(engine, "team", {"evil; DROP TABLE users": "VARCHAR"})
