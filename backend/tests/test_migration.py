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

from app.db import _drop_legacy_partners_table, _insert_default_partners
from app.models import PartnerRow, ServiceRow

LEGACY_PARTNERS_DDL = """
CREATE TABLE partners (
    id INTEGER NOT NULL PRIMARY KEY,
    value VARCHAR NOT NULL,
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
