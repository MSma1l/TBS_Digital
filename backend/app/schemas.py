"""
Pydantic schemas — the API contract.

These mirror the frontend's `SiteData` type in `lib/siteContent.tsx` field-for-field,
so `GET /api/content` and `PUT /api/content` are a drop-in for the current localStorage
store. Keep them in sync if the frontend shape changes.
"""

from typing import Literal

from pydantic import BaseModel, Field

ContactType = Literal["email", "phone", "other"]

# Placeholder price shown before the admin sets a real one (matches content.ts).
PRICE_PLACEHOLDER = "..."


class Stat(BaseModel):
    id: str
    value: str = ""
    label: str = ""


class Service(BaseModel):
    id: str
    name: str = ""
    desc: str = ""
    price: str = PRICE_PLACEHOLDER
    estimatorOnly: bool = False  # in the estimator, but not on the /03 grid


class TeamMember(BaseModel):
    id: str
    name: str = ""
    role: str = ""
    bio: str = ""


class Contact(BaseModel):
    id: str
    type: ContactType = "email"
    value: str = ""


class SiteContent(BaseModel):
    """The whole editable content blob — one document, matches the admin's Save."""

    stats: list[Stat] = Field(default_factory=list)
    services: list[Service] = Field(default_factory=list)
    team: list[TeamMember] = Field(default_factory=list)
    partners: list[str] = Field(default_factory=list)
    contacts: list[Contact] = Field(default_factory=list)


class ContactSubmissionIn(BaseModel):
    """Incoming payload from the site's contact form (+ estimator context)."""

    name: str = Field(min_length=1)
    email: str = Field(min_length=1)
    phone: str = ""
    message: str = ""
    project: str = ""  # selected project name from the estimator
    estimate: str = ""  # attached price estimate label


class ContactSubmission(ContactSubmissionIn):
    id: str
    created_at: str  # ISO 8601 timestamp


# --- auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminInfo(BaseModel):
    username: str
