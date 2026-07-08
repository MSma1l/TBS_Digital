from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from ..config import Settings, get_settings
from ..db import get_session
from ..schemas import AdminInfo, LoginRequest, TokenResponse
from ..security import authenticate, create_access_token, get_current_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    session: Session = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    if not authenticate(session, body.username, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong credentials"
        )
    return TokenResponse(access_token=create_access_token(body.username, settings))


@router.get("/me", response_model=AdminInfo)
def me(admin: AdminInfo = Depends(get_current_admin)):
    """Validate the current token (used by the admin UI on load)."""
    return admin
