from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from ..deps import get_store
from ..main import limiter
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
@limiter.limit("10/minute")
def submit_contact(
    request: Request,
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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Admin only — received contact requests, newest first.

    Paginated: ``limit`` (default 50, max 200) and ``offset`` (default 0). The frontend
    calls without params, so the defaults return the newest 50 submissions.
    """
    return store.list_submissions(limit=limit, offset=offset)


@router.delete("/admin/submissions/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_submission(
    submission_id: str,
    store: ContentStore = Depends(get_store),
    admin: AdminInfo = Depends(get_current_admin),
):
    """Admin only — permanently remove a handled contact request.

    The id is passed straight to the ORM as a bound parameter (`Session.get`), so a
    hostile id (path traversal / SQLi-shaped string) is just a string that matches no
    row rather than something that can alter the query. 404 when nothing was deleted,
    so the admin panel can tell "gone" from "removed".
    """
    if not store.delete_submission(submission_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
