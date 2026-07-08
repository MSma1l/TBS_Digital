"""
Database engine & session wiring.

A single shared SQLAlchemy engine is built from ``DATABASE_URL`` (see config.py) and
reused across the app. Both SQLite (the default) and Postgres are supported:

- ``sqlite:///./data/tbs.db`` — the parent directory is created automatically.
- ``postgresql://user:pass@host/db`` — normalised to the psycopg (v3) driver, which is
  the driver shipped in requirements (``psycopg[binary]``).

Tables are created with ``create_db_and_tables`` on startup; models live in models.py.
"""

from functools import lru_cache
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings


def _normalise_url(url: str) -> str:
    """Force the psycopg (v3) driver for bare ``postgresql://`` URLs."""
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


@lru_cache
def get_engine() -> Engine:
    """The process-wide engine, built lazily from the configured DATABASE_URL."""
    url = _normalise_url(get_settings().database_url)

    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        # Ensure the parent directory of a file-backed SQLite DB exists.
        db_path = url.split("///", 1)[-1]
        if db_path and db_path != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    return create_engine(url, connect_args=connect_args)


def create_db_and_tables() -> None:
    """Create any missing tables. Safe to call repeatedly (idempotent)."""
    # Import for side effect: registers all tables on SQLModel.metadata.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Session:
    """FastAPI dependency yielding a short-lived session."""
    with Session(get_engine()) as session:
        yield session
