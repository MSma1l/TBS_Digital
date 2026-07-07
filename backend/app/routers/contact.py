from fastapi import APIRouter, Depends, status

from ..deps import get_store
from ..schemas import AdminInfo, ContactSubmission, ContactSubmissionIn
from ..security import get_current_admin
from ..storage.base import ContentStore

router = APIRouter(prefix="/api", tags=["contact"])


@router.post(
    "/contact",
    response_model=ContactSubmission,
    status_code=status.HTTP_201_CREATED,
)
def submit_contact(
    body: ContactSubmissionIn, store: ContentStore = Depends(get_store)
):
    """Public — the site's contact form posts here."""
    return store.add_submission(body)


@router.get("/admin/submissions", response_model=list[ContactSubmission])
def list_submissions(
    store: ContentStore = Depends(get_store),
    admin: AdminInfo = Depends(get_current_admin),
):
    """Admin only — received contact requests, newest first."""
    return store.list_submissions()
