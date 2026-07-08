"""
Idempotent database seeding.

On startup (see main.py) this seeds:
- the site content from `defaults.default_content()` when the DB has no content yet, and
- one admin user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` with a bcrypt-hashed password
  (only if that username is not already present).

Both steps are safe to run on every boot — existing data is left untouched.
"""

from sqlmodel import Session, select

from .config import Settings, get_settings
from .db import get_engine
from .defaults import default_content
from .models import UserRow
from .security import hash_password
from .storage.db_store import DbStore


def _content_is_empty(store: DbStore) -> bool:
    c = store.get_content()
    return not (c.stats or c.services or c.team or c.partners or c.contacts)


def _seed_admin_user(engine, settings: Settings) -> None:
    with Session(engine) as session:
        existing = session.exec(
            select(UserRow).where(UserRow.username == settings.admin_username)
        ).first()
        if existing is None:
            session.add(
                UserRow(
                    username=settings.admin_username,
                    hashed_password=hash_password(settings.admin_password),
                )
            )
            session.commit()


def seed_database() -> None:
    """Seed default content and the admin user if missing. Idempotent."""
    engine = get_engine()
    settings = get_settings()

    store = DbStore(engine)
    if _content_is_empty(store):
        store.save_content(default_content())

    _seed_admin_user(engine, settings)
