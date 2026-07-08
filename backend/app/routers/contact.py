from fastapi import APIRouter, BackgroundTasks, Depends, status

from ..deps import get_store
from ..schemas import AdminInfo, ContactSubmission, ContactSubmissionIn
from ..security import get_current_admin
from ..storage.base import ContentStore
from ..telegram.notify import notify_new_lead_task

router = APIRouter(prefix="/api", tags=["contact"])


@router.post(
    "/contact",
    response_model=ContactSubmission,
    status_code=status.HTTP_201_CREATED,
)
def submit_contact(
    body: ContactSubmissionIn,
    background_tasks: BackgroundTasks,
    store: ContentStore = Depends(get_store),
):
    """Public — the site's contact form posts here.

    After the submission is saved, a best-effort Telegram notification is scheduled as
    a background task, so the 201 response never blocks on (or fails because of) the
    Telegram API. When the integration is disabled the task is an immediate no-op.
    """
    record = store.add_submission(body)
    background_tasks.add_task(notify_new_lead_task, record)
    return record


@router.get("/admin/submissions", response_model=list[ContactSubmission])
def list_submissions(
    store: ContentStore = Depends(get_store),
    admin: AdminInfo = Depends(get_current_admin),
):
    """Admin only — received contact requests, newest first."""
    return store.list_submissions()
