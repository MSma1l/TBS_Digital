from fastapi import APIRouter, Depends

from ..deps import get_store
from ..schemas import AdminInfo, SiteContent
from ..security import get_current_admin
from ..storage.base import ContentStore

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("", response_model=SiteContent)
def read_content(store: ContentStore = Depends(get_store)):
    """Public — the site and the admin both load content from here."""
    return store.get_content()


@router.put("", response_model=SiteContent)
def replace_content(
    content: SiteContent,
    store: ContentStore = Depends(get_store),
    admin: AdminInfo = Depends(get_current_admin),
):
    """Admin only — atomic replace of the whole content document (the admin's Save)."""
    return store.save_content(content)
