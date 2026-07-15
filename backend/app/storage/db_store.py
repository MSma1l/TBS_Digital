"""
Database-backed content store.

Implements the `ContentStore` interface against a real relational database via
SQLModel/SQLAlchemy. Each content list maps to a table (see models.py); `get_content`
assembles them into a `SiteContent` that matches schemas.py exactly, and `save_content`
replaces the whole document (delete-missing + upsert by id, preserving list order).

This is the store wired in `deps.py`; the `JSONFileStore` stays in the tree only as a
reference/fallback.
"""

import json
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
    SocialRow,
    StatRow,
    SubmissionRow,
    TeamRow,
)
from ..schemas import (
    Contact,
    ContactSubmission,
    ContactSubmissionIn,
    LocalizedText,
    Partner,
    Project,
    Service,
    SiteContent,
    Social,
    Stat,
    TeamMember,
)
from .base import ContentStore


def _loc_to_db(value: LocalizedText) -> str:
    """Serialize a localized field to the TEXT column as JSON ``{"ro","ru","en"}``."""
    return json.dumps(
        {"ro": value.ro, "ru": value.ru, "en": value.en}, ensure_ascii=False
    )


def _loc_from_db(raw: str) -> LocalizedText:
    """Read a localized field back. A legacy plain string (pre-localization) is treated as
    Romanian-only, so old rows keep working with no migration."""
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return LocalizedText.model_construct(
                    ro=data.get("ro", ""),
                    ru=data.get("ru", ""),
                    en=data.get("en", ""),
                )
        except (ValueError, TypeError):
            pass  # not JSON → a legacy single-language value
    return LocalizedText.model_construct(ro=raw or "", ru="", en="")


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
            socials = session.exec(
                select(SocialRow).order_by(SocialRow.position)
            ).all()

        images_by_project: dict = {}
        for row in image_rows:
            images_by_project.setdefault(row.project_id, []).append(row.url)

        # model_construct: stored values are already validated/escaped on write.
        return SiteContent.model_construct(
            stats=[
                Stat.model_construct(
                    id=r.id, value=r.value, label=_loc_from_db(r.label)
                )
                for r in stats
            ],
            services=[
                Service.model_construct(
                    id=r.id,
                    name=_loc_from_db(r.name),
                    desc=_loc_from_db(r.description),
                    price=_loc_from_db(r.price),
                    estimatorOnly=r.estimator_only,
                )
                for r in services
            ],
            team=[
                TeamMember.model_construct(
                    id=r.id,
                    name=r.name,
                    role=_loc_from_db(r.role),
                    bio=_loc_from_db(r.bio),
                    photo=r.photo,
                    website=r.website,
                    linkedin=r.linkedin,
                    instagram=r.instagram,
                    facebook=r.facebook,
                    github=r.github,
                )
                for r in team
            ],
            projects=[
                Project.model_construct(
                    id=r.id,
                    name=r.name,
                    tag=_loc_from_db(r.tag),
                    desc=_loc_from_db(r.description),
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
            socials=[
                Social.model_construct(id=r.id, type=r.type, url=r.url)
                for r in socials
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
            self._sync_socials(session, content.socials)
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
            row.value, row.label, row.position = (
                item.value,
                _loc_to_db(item.label),
                pos,
            )
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
            row.name = _loc_to_db(item.name)
            row.description = _loc_to_db(item.desc)
            row.price = _loc_to_db(item.price)
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
            row.name = item.name
            row.role = _loc_to_db(item.role)
            row.bio = _loc_to_db(item.bio)
            row.photo = item.photo
            row.website = item.website
            row.linkedin = item.linkedin
            row.instagram = item.instagram
            row.facebook = item.facebook
            row.github = item.github
            row.position = pos
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
            row.tag = _loc_to_db(item.tag)
            row.description = _loc_to_db(item.desc)
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

    @staticmethod
    def _sync_socials(session: Session, items: List[Social]) -> None:
        keep = {i.id for i in items}
        existing = {r.id: r for r in session.exec(select(SocialRow)).all()}
        for row_id, row in existing.items():
            if row_id not in keep:
                session.delete(row)
        for pos, item in enumerate(items):
            row = existing.get(item.id) or SocialRow(id=item.id)
            row.type, row.url, row.position = item.type, item.url, pos
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
