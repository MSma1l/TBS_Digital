"""
Auth — DB-backed users (bcrypt-hashed passwords) -> JWT.

`POST /api/auth/login` verifies a username/password against the `users` table (created
and seeded from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup — see seed.py) and returns
a short-lived JWT. The JWT guards the write endpoints via `get_current_admin`. The token
issuing/guarding and the `/api/auth/*` contract are unchanged from the earlier stand-in;
only the credential check moved from a plaintext env comparison to a hashed DB lookup.
"""

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

# A valid-but-unmatchable hash, used to keep login timing roughly constant when the
# username does not exist (mitigates user-enumeration via timing).
_DUMMY_HASH = bcrypt.hashpw(b"dummy-password", bcrypt.gensalt()).decode("utf-8")


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt (per-hash random salt)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Constant-time verify of a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
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
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> AdminInfo:
    """Dependency that guards admin-only routes."""
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[_ALGORITHM]
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AdminInfo(username=payload.get("sub", ""))
