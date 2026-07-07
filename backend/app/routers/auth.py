from fastapi import APIRouter, Depends, HTTPException, status

from ..config import Settings, get_settings
from ..schemas import AdminInfo, LoginRequest, TokenResponse
from ..security import authenticate, create_access_token, get_current_admin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, settings: Settings = Depends(get_settings)):
    if not authenticate(body.username, body.password, settings):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong credentials"
        )
    return TokenResponse(access_token=create_access_token(body.username, settings))


@router.get("/me", response_model=AdminInfo)
def me(admin: AdminInfo = Depends(get_current_admin)):
    """Validate the current token (used by the admin UI on load)."""
    return admin
