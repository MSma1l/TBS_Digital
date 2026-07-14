"""
Reusable input-validation & sanitisation helpers (anti-XSS / anti-injection).

These are applied to the *request* schemas in ``schemas.py`` so that every value
entering the API is trimmed, length-checked and neutralised before it is stored.

Sanitise-vs-reject decision (documented, per field kind):

- **Free-text stored/rendered fields** (names, roles, labels, prices, descriptions,
  bios, partner names, contact values, and the contact-form free-text fields) are
  **SANITISED, not rejected**: leading/trailing whitespace is trimmed, control
  characters are rejected, a length cap is enforced, and the value is finally
  **HTML-escaped** (``html.escape``). Escaping turns ``<script>`` into
  ``&lt;script&gt;`` and defuses event-handler attributes / raw tags, so stored
  content can *never* execute when the frontend renders it — while the user's text
  is still preserved (it round-trips visibly). This matches the "prefer escaping so
  it can never execute" guidance for stored content.
- **Structural id fields** are **REJECTED** if they contain anything outside a safe
  slug charset (letters, digits, ``_ . : -``).
- **Email, phone and URL-scheme** violations are **REJECTED** (HTTP 422). Any value
  using a dangerous scheme (``javascript:``, ``data:``, ``vbscript:``, ``file:``) is
  rejected; contact values of type *other* that look like a URL must be http/https.
- **Link fields** (a partner's website and logo — see ``LinkStr``) are **REJECTED**,
  never escaped. Escaping would corrupt a legitimate URL (``?a=1&b=2`` would become
  ``?a=1&amp;b=2`` and 404), so instead the value must match a strict shape: either a
  site-relative path (``/partners/x.png``) or an absolute ``http(s)`` URL, with the
  markup/quote/whitespace characters that could break out of an attribute banned
  outright. That makes the value inert in an ``href``/``src`` without escaping it.

Escaping is done only at the write boundary. ``storage/db_store.py`` reconstructs the
response models with ``model_construct`` (no re-validation) so reads never double-escape.
"""

import html
import re
from typing import Annotated

from pydantic import BeforeValidator

# Control characters that must never appear in input. Tab (\x09), newline (\x0a) and
# carriage-return (\x0d) are allowed so multi-line text (bios, messages) survives.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Permissive phone charset: digits, spaces, +, -, parentheses. 6–40 chars.
_PHONE_RE = re.compile(r"^[0-9+\-()\s]{6,40}$")
# Contact-book phone value: same charset but a looser lower bound (short local codes).
_CONTACT_PHONE_RE = re.compile(r"^[0-9+\-()\s]{3,40}$")

# Safe id / slug charset.
_ID_RE = re.compile(r"^[A-Za-z0-9_.:\-]{1,64}$")

# Pragmatic e-mail shape check (used for contact-book values; the contact *form*
# uses pydantic.EmailStr for a stricter, library-backed check).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Reject these URL schemes outright wherever a value might be treated as a link.
_DANGEROUS_SCHEME_RE = re.compile(r"^\s*(?:javascript|data|vbscript|file)\s*:", re.I)
# Detect a leading "scheme:" so we can force http/https on link-like values.
_URL_SCHEME_RE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9+.\-]*)\s*:")
# Characters that must never appear in a link: they are the ones that could break out
# of the href="…" / src="…" attribute the value is rendered into.
_UNSAFE_LINK_CHARS_RE = re.compile(r"""[<>"'`\s\\]""")

# Longest link we store (comfortably above any real logo path or site URL).
_MAX_LINK_LENGTH = 500


def _clean_text(value: object, *, max_length: int, required: bool) -> str:
    """Trim, reject control chars, enforce length, then HTML-escape stored text."""
    if not isinstance(value, str):
        raise ValueError("must be a string")
    v = value.strip()
    if _CONTROL_RE.search(v):
        raise ValueError("must not contain control characters")
    if required and not v:
        raise ValueError("must not be empty")
    if len(v) > max_length:
        raise ValueError(f"must be at most {max_length} characters")
    # HTML-escape so any markup is inert when rendered (anti-XSS).
    return html.escape(v)


def text(max_length: int, *, required: bool = False):
    """Build an ``Annotated[str, ...]`` type that sanitises a free-text field."""

    def _validator(value: object) -> str:
        return _clean_text(value, max_length=max_length, required=required)

    return Annotated[str, BeforeValidator(_validator)]


def _clean_id(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("must be a string")
    v = value.strip()
    if not _ID_RE.match(v):
        raise ValueError(
            "invalid id: use 1–64 chars of letters, digits, '_', '.', ':' or '-'"
        )
    return v


IdStr = Annotated[str, BeforeValidator(_clean_id)]


def _clean_phone(value: object) -> str:
    if not isinstance(value, str):
        raise ValueError("must be a string")
    v = value.strip()
    if v == "":
        return ""
    if _CONTROL_RE.search(v) or not _PHONE_RE.match(v):
        raise ValueError("invalid phone number")
    return v  # charset is already safe, no escaping needed


PhoneStr = Annotated[str, BeforeValidator(_clean_phone)]


def _clean_link(value: object) -> str:
    """Validate a link/image reference. Rejected (not escaped) — see the module docstring.

    Accepts an empty string (the field is optional), a site-relative path such as
    ``/partners/crowe.png`` (what the logo upload returns), or an absolute http(s) URL.
    A protocol-relative ``//host/x`` is rejected: it inherits the page's scheme and is
    too easy to mistake for a path.
    """
    if not isinstance(value, str):
        raise ValueError("must be a string")
    v = value.strip()
    if v == "":
        return ""
    if len(v) > _MAX_LINK_LENGTH:
        raise ValueError(f"must be at most {_MAX_LINK_LENGTH} characters")
    if _CONTROL_RE.search(v) or _UNSAFE_LINK_CHARS_RE.search(v):
        raise ValueError("link contains characters that are not allowed")
    if _DANGEROUS_SCHEME_RE.match(v):
        raise ValueError("unsafe URL scheme")
    if v.startswith("//"):
        raise ValueError("protocol-relative links are not allowed")
    if v.startswith("/"):
        return v  # site-relative path (e.g. an uploaded logo)
    m = _URL_SCHEME_RE.match(v)
    if not m:
        raise ValueError("must be an absolute http(s) URL or a path starting with '/'")
    if m.group(1).lower() not in ("http", "https"):
        raise ValueError("only http/https URLs are allowed")
    return v


LinkStr = Annotated[str, BeforeValidator(_clean_link)]


def validate_contact_value(value: str, contact_type: str) -> None:
    """Reject unsafe/invalid contact-book values (email/phone shape, URL scheme)."""
    if not value:
        return
    if _DANGEROUS_SCHEME_RE.match(value):
        raise ValueError("unsafe URL scheme")
    if contact_type == "email":
        if not _EMAIL_RE.match(value):
            raise ValueError("invalid email address")
    elif contact_type == "phone":
        if not _CONTACT_PHONE_RE.match(value):
            raise ValueError("invalid phone number")
    else:  # "other" — may legitimately be a link; force http/https if it is one.
        m = _URL_SCHEME_RE.match(value)
        if m and m.group(1).lower() not in ("http", "https"):
            raise ValueError("only http/https URLs are allowed")
