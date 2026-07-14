"""The partners table migration, exercised against a database in the legacy shape.

Production already holds a `partners` table from when a partner was a plain string
(INTEGER id + a single `value` column). Partners now carry a name, a logo and a link,
which changes the primary key's type — and `create_all` only ever CREATEs, it never
ALTERs. So `create_db_and_tables` drops the legacy table and reseeds the real partners.
This pins that behaviour: the migration must run once, keep every other table intact,
and then never fire again.
"""

import os
import tempfile

import pytest
from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine, select

from app.db import (
    TEAM_LINK_COLUMNS,
    _add_missing_columns,
    _backfill_partner_previews,
    _drop_legacy_partners_table,
    _insert_default_partners,
    _insert_default_socials,
)
from app.models import PartnerRow, ServiceRow, SocialRow, TeamRow

LEGACY_PARTNERS_DDL = """
CREATE TABLE partners (
    id INTEGER NOT NULL PRIMARY KEY,
    value VARCHAR NOT NULL,
    position INTEGER NOT NULL
)
"""

# The `team` table as production has it: no photo, no personal links.
LEGACY_TEAM_DDL = """
CREATE TABLE team (
    id VARCHAR NOT NULL PRIMARY KEY,
    name VARCHAR NOT NULL,
    role VARCHAR NOT NULL,
    bio VARCHAR NOT NULL,
    position INTEGER NOT NULL
)
"""


@pytest.fixture
def legacy_engine():
    """A database that looks exactly like production before this change."""
    path = os.path.join(tempfile.mkdtemp(prefix="tbs-migration-"), "legacy.db")
    engine = create_engine(f"sqlite:///{path}")

    SQLModel.metadata.create_all(engine)
    with engine.begin() as conn:
        # Swap the new partners table for the legacy one, with its placeholder rows.
        conn.execute(text("DROP TABLE partners"))
        conn.execute(text(LEGACY_PARTNERS_DDL))
        for i in range(1, 6):
            conn.execute(
                text(
                    "INSERT INTO partners (value, position) VALUES (:value, :position)"
                ),
                {"value": f"PARTENER_0{i}", "position": i - 1},
            )
        # A service, to prove the migration touches nothing but partners.
        conn.execute(
            text(
                "INSERT INTO services (id, name, description, price, estimator_only,"
                " position) VALUES ('landing', 'Landing page', 'desc', '500', 0, 0)"
            )
        )
    return engine


def _migrate(engine) -> bool:
    """What `create_db_and_tables` does, minus the cached global engine."""
    dropped = _drop_legacy_partners_table(engine)
    SQLModel.metadata.create_all(engine)
    if dropped:
        _insert_default_partners(engine)
    return dropped


def test_migration_replaces_the_legacy_table_and_seeds_the_real_partners(legacy_engine):
    assert _migrate(legacy_engine) is True

    columns = {c["name"] for c in inspect(legacy_engine).get_columns("partners")}
    assert {"id", "name", "logo", "url", "position"} <= columns

    with Session(legacy_engine) as session:
        partners = session.exec(
            select(PartnerRow).order_by(PartnerRow.position)
        ).all()

    assert [p.id for p in partners] == ["crowe", "cgam", "ivan-turcan"]
    assert partners[0].name == "Crowe Turcan Mikhailenko"
    assert partners[0].logo == "/partners/crowe.png"
    assert partners[0].url == "https://crowe-tm.md"


def test_migration_leaves_other_content_untouched(legacy_engine):
    _migrate(legacy_engine)

    with Session(legacy_engine) as session:
        services = session.exec(select(ServiceRow)).all()

    assert [s.id for s in services] == ["landing"]


def test_migration_is_a_no_op_once_already_migrated(legacy_engine):
    _migrate(legacy_engine)

    # Rename a partner the way an admin would, then boot again.
    with Session(legacy_engine) as session:
        row = session.exec(select(PartnerRow).where(PartnerRow.id == "crowe")).one()
        row.name = "Renamed by the admin"
        session.add(row)
        session.commit()

    assert _migrate(legacy_engine) is False  # must not drop the table a second time

    with Session(legacy_engine) as session:
        row = session.exec(select(PartnerRow).where(PartnerRow.id == "crowe")).one()

    assert row.name == "Renamed by the admin"  # the admin's edit survived the reboot


def test_migration_is_a_no_op_on_a_fresh_database():
    """A brand-new DB has no partners table at all; seeding handles it, not the drop."""
    path = os.path.join(tempfile.mkdtemp(prefix="tbs-fresh-"), "fresh.db")
    engine = create_engine(f"sqlite:///{path}")

    assert _drop_legacy_partners_table(engine) is False


def test_adding_the_preview_column_backfills_the_existing_partners(legacy_engine):
    """A new content column starts empty on every existing row — so it must be filled.

    Without the backfill the partners already in production would have `preview = ''`
    and the hover reveal would show nothing at all, even though the images ship with the
    app. This is the bug that actually reached production once.
    """
    _migrate(legacy_engine)  # partners now exist, with previews

    # Simulate the pre-preview production schema: the column exists but is empty,
    # exactly as `ALTER TABLE … ADD COLUMN` leaves it.
    with Session(legacy_engine) as session:
        for row in session.exec(select(PartnerRow)).all():
            row.preview = ""
            session.add(row)
        session.commit()

    _backfill_partner_previews(legacy_engine)

    with Session(legacy_engine) as session:
        partners = {r.id: r.preview for r in session.exec(select(PartnerRow)).all()}

    assert partners["crowe"] == "/partners/previews/crowe.png"
    assert partners["cgam"] == "/partners/previews/cgam.png"
    assert partners["ivan-turcan"] == "/partners/previews/ivan-turcan.png"


def test_backfill_never_overwrites_a_preview_the_admin_chose(legacy_engine):
    _migrate(legacy_engine)

    with Session(legacy_engine) as session:
        row = session.exec(select(PartnerRow).where(PartnerRow.id == "crowe")).one()
        row.preview = "/api/uploads/the-admins-own.webp"
        session.add(row)
        session.commit()

    _backfill_partner_previews(legacy_engine)

    with Session(legacy_engine) as session:
        row = session.exec(select(PartnerRow).where(PartnerRow.id == "crowe")).one()

    assert row.preview == "/api/uploads/the-admins-own.webp"


def test_add_missing_columns_reports_what_it_added_and_is_idempotent(legacy_engine):
    _migrate(legacy_engine)

    # Already present -> nothing added, nothing to backfill.
    assert _add_missing_columns(
        legacy_engine, "partners", {"preview": "VARCHAR NOT NULL DEFAULT ''"}
    ) == set()


# --- the team gains a photo + personal links; the company gains its socials ------
#
# Same trap as the partner preview: production's `team` table already exists, so
# `create_all` will never add a column to it. The six new columns have to be ALTERed in,
# and the brand-new `socials` table has to be seeded — `seed_database()` won't do it,
# because it only ever fires on a database with no content at all.


@pytest.fixture
def pre_socials_engine(legacy_engine):
    """A production-shaped DB from *before* this change: old `team`, no `socials`."""
    with legacy_engine.begin() as conn:
        conn.execute(text("DROP TABLE team"))
        conn.execute(text(LEGACY_TEAM_DDL))
        for position, (tid, name, role) in enumerate(
            [
                ("chistol-maxim", "Chistol Maxim", "Team Lead & Fullstack Developer"),
                ("danu", "Danu", "Fullstack Developer"),
            ]
        ):
            conn.execute(
                text(
                    "INSERT INTO team (id, name, role, bio, position)"
                    " VALUES (:id, :name, :role, '', :position)"
                ),
                {"id": tid, "name": name, "role": role, "position": position},
            )
        conn.execute(text("DROP TABLE socials"))
    return legacy_engine


def _migrate_team_and_socials(legacy_engine) -> set:
    """The team/socials half of `create_db_and_tables`, minus the cached global engine.

    Mirrors the real order: note the table names are read *before* `create_all`, since
    that is what creates `socials` and thereby erases the evidence that it was missing.
    """
    socials_are_new = "socials" not in inspect(legacy_engine).get_table_names()
    SQLModel.metadata.create_all(legacy_engine)
    added = _add_missing_columns(legacy_engine, "team", TEAM_LINK_COLUMNS)
    if socials_are_new:
        _insert_default_socials(legacy_engine)
    return added


def test_migration_adds_the_six_new_team_columns(pre_socials_engine):
    """`create_all` never ALTERs a table it did not create — these must be added by hand."""
    before = {c["name"] for c in inspect(pre_socials_engine).get_columns("team")}
    assert "photo" not in before  # the fixture really is in the old shape

    added = _migrate_team_and_socials(pre_socials_engine)

    assert added == {
        "photo",
        "website",
        "linkedin",
        "instagram",
        "facebook",
        "github",
    }
    columns = {c["name"] for c in inspect(pre_socials_engine).get_columns("team")}
    assert {"id", "name", "role", "bio", "position"} <= columns  # nothing lost
    assert added <= columns


def test_existing_team_rows_survive_the_migration(pre_socials_engine):
    """ALTER TABLE keeps the rows: the admin's people are not re-seeded or wiped."""
    _migrate_team_and_socials(pre_socials_engine)

    with Session(pre_socials_engine) as session:
        team = session.exec(select(TeamRow).order_by(TeamRow.position)).all()

    assert [m.id for m in team] == ["chistol-maxim", "danu"]
    assert team[0].name == "Chistol Maxim"
    assert team[0].role == "Team Lead & Fullstack Developer"
    assert team[1].name == "Danu"
    assert team[1].role == "Fullstack Developer"
    # The new columns start empty on every existing row — nothing to backfill, since we
    # ship no default photo or profile link.
    assert team[0].photo == ""
    assert team[0].linkedin == ""
    assert team[0].github == ""


def test_team_column_migration_is_idempotent(pre_socials_engine):
    _migrate_team_and_socials(pre_socials_engine)

    # A second boot adds nothing and keeps the admin's edits.
    with Session(pre_socials_engine) as session:
        row = session.exec(select(TeamRow).where(TeamRow.id == "danu")).one()
        row.photo = "/api/uploads/danu.webp"
        session.add(row)
        session.commit()

    assert _migrate_team_and_socials(pre_socials_engine) == set()

    with Session(pre_socials_engine) as session:
        row = session.exec(select(TeamRow).where(TeamRow.id == "danu")).one()

    assert row.photo == "/api/uploads/danu.webp"


def test_socials_table_is_seeded_on_an_existing_database(pre_socials_engine):
    """`seed_database()` skips a DB that already has content, so the migration seeds it."""
    _migrate_team_and_socials(pre_socials_engine)

    with Session(pre_socials_engine) as session:
        socials = session.exec(select(SocialRow).order_by(SocialRow.position)).all()

    assert [s.type for s in socials] == ["telegram", "linkedin", "github"]
    assert [s.position for s in socials] == [0, 1, 2]
    # Every url starts empty — the footer shows an icon only once the admin sets one.
    assert all(s.url == "" for s in socials)


def test_socials_are_not_reseeded_on_the_next_boot(pre_socials_engine):
    _migrate_team_and_socials(pre_socials_engine)

    with Session(pre_socials_engine) as session:
        row = session.exec(select(SocialRow).where(SocialRow.type == "telegram")).one()
        row.url = "https://t.me/tbsdigital"
        session.add(row)
        session.commit()

    _migrate_team_and_socials(pre_socials_engine)  # boot again

    with Session(pre_socials_engine) as session:
        socials = session.exec(select(SocialRow).order_by(SocialRow.position)).all()

    assert len(socials) == 3  # not duplicated
    assert socials[0].url == "https://t.me/tbsdigital"  # the admin's link survived


def test_team_and_socials_migration_leaves_other_content_untouched(pre_socials_engine):
    _migrate_team_and_socials(pre_socials_engine)

    with Session(pre_socials_engine) as session:
        services = session.exec(select(ServiceRow)).all()

    assert [s.id for s in services] == ["landing"]
