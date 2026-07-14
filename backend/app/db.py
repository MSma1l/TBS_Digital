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

from sqlalchemy import inspect, text
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


def _drop_legacy_partners_table(engine: Engine) -> bool:
    """Drop the pre-logo ``partners`` table so it can be recreated with the new shape.

    Partners used to be a plain ``list[str]``: an INTEGER primary key and one ``value``
    column. They now carry a name, a logo and a link, which changes the primary key's
    type — and ``create_all`` only ever CREATEs, it never ALTERs. Since every row in the
    old table was a ``PARTENER_0x`` placeholder, dropping it loses nothing; the caller
    reseeds the real partners straight after.

    Returns True when the legacy table was actually dropped. A no-op on a fresh database
    and on one that already has the new shape, so it is safe on every boot.
    """
    inspector = inspect(engine)
    if "partners" not in inspector.get_table_names():
        return False
    columns = {c["name"] for c in inspector.get_columns("partners")}
    if "logo" in columns:
        return False  # already migrated

    with engine.begin() as conn:
        conn.execute(text("DROP TABLE partners"))
    return True


def _add_missing_columns(engine: Engine, table: str, columns: dict) -> None:
    """ADD COLUMN for any of ``columns`` the table doesn't have yet.

    ``create_all`` never ALTERs an existing table, so a column added to a model after a
    deploy would be missing in production. Both SQLite and Postgres support plain
    ``ALTER TABLE … ADD COLUMN``; we check the live schema first rather than relying on
    ``IF NOT EXISTS`` (SQLite has no such clause for ADD COLUMN). Idempotent.
    """
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return  # create_all will build it with every column
    existing = {c["name"] for c in inspector.get_columns(table)}

    for name, ddl in columns.items():
        if name in existing:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def _insert_default_partners(engine: Engine) -> None:
    from .defaults import default_partners
    from .models import PartnerRow

    with Session(engine) as session:
        for position, partner in enumerate(default_partners()):
            session.add(
                PartnerRow(
                    id=partner.id,
                    name=partner.name,
                    logo=partner.logo,
                    url=partner.url,
                    preview=partner.preview,
                    position=position,
                )
            )
        session.commit()


def _insert_default_projects(engine: Engine) -> None:
    from .defaults import default_projects
    from .models import ProjectImageRow, ProjectRow

    with Session(engine) as session:
        for position, project in enumerate(default_projects()):
            session.add(
                ProjectRow(
                    id=project.id,
                    name=project.name,
                    tag=project.tag,
                    description=project.desc,
                    url=project.url,
                    app_store=project.appStore,
                    play_store=project.playStore,
                    position=position,
                )
            )
            for image_position, image in enumerate(project.images):
                session.add(
                    ProjectImageRow(
                        project_id=project.id, url=image, position=image_position
                    )
                )
        session.commit()


def create_db_and_tables() -> None:
    """Migrate, then create any missing tables. Safe to call repeatedly (idempotent)."""
    # Import for side effect: registers all tables on SQLModel.metadata.
    from . import models  # noqa: F401

    engine = get_engine()
    tables_before = set(inspect(engine).get_table_names())

    # A brand-new database has no content tables at all. There, `seed_database` writes
    # the full default document (projects included) and these backfills must stay out of
    # its way — they exist only for a database that already holds an admin's content,
    # which `seed_database` deliberately never touches.
    is_fresh_db = "services" not in tables_before
    projects_are_new = "projects" not in tables_before

    migrated_partners = _drop_legacy_partners_table(engine)
    SQLModel.metadata.create_all(engine)

    # Columns added to a model after its table was already created in production.
    _add_missing_columns(
        engine, "partners", {"preview": "VARCHAR NOT NULL DEFAULT ''"}
    )

    if is_fresh_db:
        return  # seed_database() fills everything from defaults.default_content()

    if migrated_partners:
        _insert_default_partners(engine)
    if projects_are_new:
        _insert_default_projects(engine)


def get_session() -> Session:
    """FastAPI dependency yielding a short-lived session."""
    with Session(get_engine()) as session:
        yield session
