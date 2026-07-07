"""
Auth stand-in — env credentials -> JWT.

CHOSEN OPTION (documented in backend/README.md): admin credentials live in the
environment (`.env`), and a successful login returns a short-lived JWT that guards the
write endpoints. This is a stand-in, not production auth — the colleague replaces the
credential check with DB-backed users (and hashed passwords) behind the same functions.
"""

import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings
from .schemas import AdminInfo

_bearer = HTTPBearer(auto_error=True)
_ALGORITHM = "HS256"


def authenticate(username: str, password: str, settings: Settings) -> bool:
    """Constant-time check against the configured admin credentials."""
    ok_user = secrets.compare_digest(username, settings.admin_username)
    ok_pass = secrets.compare_digest(password, settings.admin_password)
    return ok_user and ok_pass


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
