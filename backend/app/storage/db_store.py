"""
Database-backed content store.

Implements the `ContentStore` interface against a real relational database via
SQLModel/SQLAlchemy. Each content list maps to a table (see models.py); `get_content`
assembles them into a `SiteContent` that matches schemas.py exactly, and `save_content`
replaces the whole document (delete-missing + upsert by id, preserving list order).

This is the store wired in `deps.py`; the `JSONFileStore` stays in the tree only as a
reference/fallback.
"""

import uuid
from datetime import datetime, timezone
from typing import List

from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from ..models import (
    ContactRow,
    PartnerRow,
    ProjectImageRow,
    ProjectRow,
    ServiceRow,
    StatRow,
    SubmissionRow,
    TeamRow,
)
from ..schemas import (
    Contact,
    ContactSubmission,
    ContactSubmissionIn,
    Partner,
    Project,
    Service,
    SiteContent,
    Stat,
    TeamMember,
)
from .base import ContentStore


class DbStore(ContentStore):
    """
    Anti-SQL-injection note: every query below is built with the SQLModel /
    SQLAlchemy ORM (``select``, ``delete``, ``session.add``/``delete``, and
    attribute assignment). Values are always passed as *bound parameters* — there is
    NO raw SQL and no string concatenation / f-string / ``.format`` used to build a
    statement, so user input can never alter query structure.

    Reads reconstruct the response schemas with ``model_construct`` (skipping
    validation): the data was already trimmed / HTML-escaped on the way in via the
    request schemas, so re-validating on read would double-escape it.
    """

    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    # --- content -----------------------------------------------------------------
    def get_content(self) -> SiteContent:
        with Session(self.engine) as session:
            stats = session.exec(select(StatRow).order_by(StatRow.position)).all()
            services = session.exec(
                select(ServiceRow).order_by(ServiceRow.position)
            ).all()
            team = session.exec(select(TeamRow).order_by(TeamRow.position)).all()
            projects = session.exec(
                select(ProjectRow).order_by(ProjectRow.position)
            ).all()
            # One query for every gallery, grouped in memory — a query per project would
            # be N+1.
            image_rows = session.exec(
                select(ProjectImageRow).order_by(ProjectImageRow.position)
            ).all()
            partners = session.exec(
                select(PartnerRow).order_by(PartnerRow.position)
            ).all()
            contacts = session.exec(
                select(ContactRow).order_by(ContactRow.position)
            ).all()

        images_by_project: dict = {}
        for row in image_rows:
            images_by_project.setdefault(row.project_id, []).append(row.url)

        # model_construct: stored values are already validated/escaped on write.
        return SiteContent.model_construct(
            stats=[
                Stat.model_construct(id=r.id, value=r.value, label=r.label)
                for r in stats
            ],
            services=[
                Service.model_construct(
                    id=r.id,
                    name=r.name,
                    desc=r.description,
                    price=r.price,
                    estimatorOnly=r.estimator_only,
                )
                for r in services
            ],
            team=[
                TeamMember.model_construct(
                    id=r.id, name=r.name, role=r.role, bio=r.bio
                )
                for r in team
            ],
            projects=[
                Project.model_construct(
                    id=r.id,
                    name=r.name,
                    tag=r.tag,
                    desc=r.description,
                    url=r.url,
                    appStore=r.app_store,
                    playStore=r.play_store,
                    images=images_by_project.get(r.id, []),
                )
                for r in projects
            ],
            partners=[
                Partner.model_construct(
                    id=r.id,
                    name=r.name,
                    logo=r.logo,
                    url=r.url,
                    preview=r.preview,
                )
                for r in partners
            ],
            contacts=[
                Contact.model_construct(id=r.id, type=r.type, value=r.value)
                for r in contacts
            ],
        )

    def save_content(self, content: SiteContent) -> SiteContent:
        """Replace the whole document: upsert by id, delete rows no longer present."""
        with Session(self.engine) as session:
            self._sync_stats(session, content.stats)
            self._sync_services(session, content.services)
            self._sync_team(session, content.team)
            self._sync_projects(session, content.projects)
            self._sync_contacts(session, content.contacts)
            self._sync_partners(session, content.partners)
            session.commit()
        return self.get_content()

    @staticmethod
    def _sync_stats(session: Session, items: List[Stat]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(StatRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or StatRow(id=item.id)
            row.value, row.label, row.position = item.value, item.label, pos
            session.add(row)

    @staticmethod
    def _sync_services(session: Session, items: List[Service]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(ServiceRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or ServiceRow(id=item.id)
            row.name = item.name
            row.description = item.desc
            row.price = item.price
            row.estimator_only = item.estimatorOnly
            row.position = pos
            session.add(row)

    @staticmethod
    def _sync_team(session: Session, items: List[TeamMember]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(TeamRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or TeamRow(id=item.id)
            row.name, row.role, row.bio, row.position = (
                item.name,
                item.role,
                item.bio,
                pos,
            )
            session.add(row)

    @staticmethod
    def _sync_contacts(session: Session, items: List[Contact]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(ContactRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or ContactRow(id=item.id)
            row.type, row.value, row.position = item.type, item.value, pos
            session.add(row)

    @staticmethod
    def _sync_projects(session: Session, items: List[Project]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(ProjectRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or ProjectRow(id=item.id)
            row.name = item.name
            row.tag = item.tag
            row.description = item.desc
            row.url = item.url
            row.app_store = item.appStore
            row.play_store = item.playStore
            row.position = pos
            session.add(row)

        # Images carry no stable id — replace each project's gallery wholesale, and drop
        # the galleries of projects that no longer exist.
        for row in session.exec(select(ProjectImageRow)).all():
            session.delete(row)
        session.flush()  # the deletes must land before the re-inserts below
        for item in items:
            for pos, url in enumerate(item.images):
                session.add(
                    ProjectImageRow(project_id=item.id, url=url, position=pos)
                )

    @staticmethod
    def _sync_partners(session: Session, items: List[Partner]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(PartnerRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or PartnerRow(id=item.id)
            row.name, row.logo, row.url, row.preview, row.position = (
                item.name,
                item.logo,
                item.url,
                item.preview,
                pos,
            )
            session.add(row)

    # --- submissions -------------------------------------------------------------
    def list_submissions(
        self, limit: int = 50, offset: int = 0
    ) -> List[ContactSubmission]:
        # Push LIMIT/OFFSET into SQL (newest-first) so we never load the whole table.
        with Session(self.engine) as session:
            rows = session.exec(
                select(SubmissionRow)
                .order_by(SubmissionRow.created_at.desc())
                .offset(offset)
                .limit(limit)
            ).all()
        return [
            ContactSubmission.model_construct(
                id=r.id,
                created_at=r.created_at,
                name=r.name,
                email=r.email,
                phone=r.phone,
                message=r.message,
                project=r.project,
                estimate=r.estimate,
                status=r.status or "nou",
            )
            for r in rows
        ]

    def add_submission(self, data: ContactSubmissionIn) -> ContactSubmission:
        # `data` is already validated/sanitised; model_construct avoids re-escaping.
        record = ContactSubmission.model_construct(
            id=uuid.uuid4().hex,
            created_at=datetime.now(timezone.utc).isoformat(),
            **data.model_dump(),
        )
        with Session(self.engine) as session:
            session.add(SubmissionRow(**record.model_dump()))
            session.commit()
        return record
