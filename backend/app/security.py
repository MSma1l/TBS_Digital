"""
Auth — DB-backed users (bcrypt-hashed passwords) -> JWT.

`POST /api/auth/login` verifies a username/password against the `users` table (created
and seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup — see seed.py) and returns
a short-lived JWT. The JWT guards the write endpoints via `get_current_admin`. The token
issuing/guarding and the `/api/auth/*` contract are unchanged from the earlier stand-in;
only the credential check moved from a plaintext env comparison to a hashed DB lookup.
"""

import base64
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from .config import Settings, get_settings
from .models import UserRow
from .schemas import AdminInfo

_bearer = HTTPBearer(auto_error=True)
_ALGORITHM = "HS256"

# Fixed audience/issuer baked into every token and required on decode. Defence in
# depth: a token minted for a different service (same secret reused elsewhere) is
# rejected because its aud/iss won't match ours.
_JWT_AUDIENCE = "tbs-digital"
_JWT_ISSUER = "tbs-digital"


def _prehash(password: str) -> bytes:
    """Pre-hash to a fixed-length, bcrypt-safe token so long passwords keep full entropy.

    bcrypt silently ignores any input bytes past the first 72, so two distinct
    passwords sharing a 72-byte prefix would hash identically. We first fold the whole
    password into a SHA-256 digest and base64-encode it (44 bytes, always < 72), so
    every byte of the original contributes to the hash and no truncation collision is
    possible. (base64, not raw digest, so an embedded NUL can't truncate the C string.)
    """
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


# A valid-but-unmatchable hash, used to keep login timing roughly constant when the
# username does not exist (mitigates user-enumeration via timing).
_DUMMY_HASH = bcrypt.hashpw(_prehash("dummy-password"), bcrypt.gensalt()).decode("utf-8")


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (per-hash random salt).

    The password is pre-hashed (see ``_prehash``) so inputs longer than bcrypt's
    72-byte limit still hash on their full content without silent truncation.
    """
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time verify of a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(_prehash(password), hashed.encode("utf-8"))
    except ValueError:
        return False


def authenticate(session: Session, username: str, password: str) -> bool:
    """Verify credentials against the hashed password stored for the DB user."""
    user = session.exec(select(UserRow).where(UserRow.username == username)).first()
    if user is None:
        # Run a dummy verify so a missing user costs the same as a wrong password.
        verify_password(password, _DUMMY_HASH)
        return False
    return verify_password(password, user.hashed_password)


def create_access_token(username: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
        "aud": _JWT_AUDIENCE,
        "iss": _JWT_ISSUER,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AdminInfo:
    """Dependency that guards admin-only routes."""
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=[_ALGORITHM],
            audience=_JWT_AUDIENCE,
            issuer=_JWT_ISSUER,
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AdminInfo(username=payload.get("sub", ""))
