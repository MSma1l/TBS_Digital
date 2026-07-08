"""
SQLModel table definitions — the relational schema behind the DB store.

Each editable content list (services, stats, team, partners, contacts) is its own
table with a `position` column so the assembled `SiteContent` preserves the admin's
ordering. Contact-form submissions and admin users get their own tables too. These
tables are an implementation detail of `storage/db_store.py`; the API contract lives
in `schemas.py` and never exposes these rows directly.
"""

from typing import Optional

from sqlmodel import Field, SQLModel

from .schemas import PRICE_PLACEHOLDER


class ServiceRow(SQLModel, table=True):
    __tablename__ = "services"

    id: str = Field(primary_key=True)
    name: str = ""
    description: str = ""  # maps to schema field `desc` (a SQL keyword)
    price: str = PRICE_PLACEHOLDER
    estimator_only: bool = False  # maps to schema field `estimatorOnly`
    position: int = 0


class StatRow(SQLModel, table=True):
    __tablename__ = "stats"

    id: str = Field(primary_key=True)
    value: str = ""
    label: str = ""
    position: int = 0


class TeamRow(SQLModel, table=True):
    __tablename__ = "team"

    id: str = Field(primary_key=True)
    name: str = ""
    role: str = ""
    bio: str = ""
    position: int = 0


class ContactRow(SQLModel, table=True):
    __tablename__ = "contacts"

    id: str = Field(primary_key=True)
    type: str = "email"
    value: str = ""
    position: int = 0


class PartnerRow(SQLModel, table=True):
    """Partners are a plain ``list[str]`` in the schema, so rows carry only a value."""

    __tablename__ = "partners"

    id: Optional[int] = Field(default=None, primary_key=True)
    value: str = ""
    position: int = 0


class SubmissionRow(SQLModel, table=True):
    __tablename__ = "submissions"

    id: str = Field(primary_key=True)
    name: str = ""
    email: str = ""
    phone: str = ""
    message: str = ""
    project: str = ""
    estimate: str = ""
    created_at: str = ""  # ISO 8601 timestamp
    # Lead classification, driven by the Telegram inline buttons (see app/telegram).
    # One of the STATUSES keys: nou / contactat / oferta / castigat / pierdut.
    status: str = "nou"


class TelegramTopic(SQLModel, table=True):
    """Maps a service (by its content.ts key) to its Telegram forum topic.

    ``thread_id`` is the ``message_thread_id`` returned by ``createForumTopic`` and is
    reused so all leads for a service land in the same topic.
    """

    __tablename__ = "telegram_topics"

    id: Optional[int] = Field(default=None, primary_key=True)
    service_key: str = Field(index=True, unique=True)
    title: str = ""
    thread_id: Optional[int] = None


class TelegramSetting(SQLModel, table=True):
    """Single-row store for the group chat captured at runtime via ``/register``.

    Only used when ``TELEGRAM_GROUP_CHAT_ID`` is not set in the environment.
    """

    __tablename__ = "telegram_settings"

    id: Optional[int] = Field(default=1, primary_key=True)
    group_chat_id: Optional[str] = None
    is_forum: bool = False


class UserRow(SQLModel, table=True):
    """An admin account with a bcrypt-hashed password."""

    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str = ""
