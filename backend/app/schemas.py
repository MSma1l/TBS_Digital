"""
Pydantic schemas — the API contract.

These mirror the frontend's `SiteData` type in `lib/siteContent.tsx` field-for-field,
so `GET /api/content` and `PUT /api/content` are a drop-in for the current localStorage
store. Keep them in sync if the frontend shape changes.
"""

import html
from typing import Annotated, List, Literal

from pydantic import AfterValidator, BaseModel, EmailStr, Field, model_validator

from .validators import IdStr, LinkStr, PhoneStr, text, validate_contact_value

# Stored e-mail from the contact form. ``EmailStr`` first enforces a valid address
# (so the endpoint still 422s on garbage), then — for symmetry with every other
# stored free-text field — we HTML-escape the validated value so it can never carry
# active markup into whatever renders the leads list. A valid address has no HTML
# metacharacters, so this is a no-op in practice; it is defence in depth, applied at
# the same write boundary as ``validators.text()``.
StoredEmail = Annotated[EmailStr, AfterValidator(html.escape)]

ContactType = Literal["email", "phone", "other"]

# Placeholder price shown before the admin sets a real one (matches content.ts).
PRICE_PLACEHOLDER = "..."

# Defence in depth: cap how many items a single PUT can push into any content list,
# so the write endpoint can't be used to flood the DB.
MAX_LIST_ITEMS = 200

# Free-text length caps (see validators.text() — trims, blocks control chars,
# HTML-escapes, and enforces the cap).
Name = text(120)
Role = text(120)
ShortLabel = text(80)
Price = text(40)
Description = text(2000)
Bio = text(2000)
ContactValue = text(254)


class Stat(BaseModel):
    id: IdStr
    value: ShortLabel = ""
    label: ShortLabel = ""


class Service(BaseModel):
    id: IdStr
    name: Name = ""
    desc: Description = ""
    price: Price = PRICE_PLACEHOLDER
    estimatorOnly: bool = False  # in the estimator, but not on the /03 grid


class TeamMember(BaseModel):
    id: IdStr
    name: Name = ""
    role: Role = ""
    bio: Bio = ""


class Partner(BaseModel):
    """A business partner shown in the /06 strip and the footer.

    ``logo`` is either a bundled asset (``/partners/crowe.png``) or the path returned
    by the logo upload (``/api/uploads/…``); ``url`` links to the partner's own site.
    Both are optional — a partner with no logo falls back to its name as a wordmark.
    """

    id: IdStr
    name: Name = ""
    logo: LinkStr = ""
    url: LinkStr = ""


class Contact(BaseModel):
    id: IdStr
    type: ContactType = "email"
    value: ContactValue = ""

    @model_validator(mode="after")
    def _check_value(self) -> "Contact":
        # Reject unsafe URL schemes and enforce email/phone/http(s) shape by type.
        validate_contact_value(self.value, self.type)
        return self


class SiteContent(BaseModel):
    """The whole editable content blob — one document, matches the admin's Save."""

    stats: List[Stat] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    services: List[Service] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    team: List[TeamMember] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    partners: List[Partner] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)
    contacts: List[Contact] = Field(default_factory=list, max_length=MAX_LIST_ITEMS)


class ContactSubmissionIn(BaseModel):
    """Incoming payload from the site's contact form (+ estimator context)."""

    name: text(120, required=True)  # required + non-empty after trim
    email: StoredEmail = Field(max_length=254)
    phone: PhoneStr = ""
    message: text(5000, required=True)  # required + non-empty after trim
    project: Name = ""  # selected project name from the estimator
    estimate: ShortLabel = ""  # attached price estimate label


class ContactSubmission(ContactSubmissionIn):
    id: IdStr
    created_at: str  # ISO 8601 timestamp
    status: str = "nou"  # lead classification (see app/telegram STATUSES)


# --- auth ---
class LoginRequest(BaseModel):
    # Length caps only — credentials are never stored/rendered, so no escaping.
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminInfo(BaseModel):
    username: str


# --- uploads ---
class UploadResponse(BaseModel):
    """Where the stored file is served from, e.g. ``/api/uploads/<uuid>.png``."""

    url: str
