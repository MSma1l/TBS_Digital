from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status

from ..config import get_settings
from ..crm import service as crm_service
from ..crm.worker import push_lead_task
from ..deps import get_store
from ..main import limiter
from ..schemas import (
    AdminContactSubmission,
    AdminInfo,
    ContactSubmission,
    ContactSubmissionIn,
)
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

    After the submission is saved, a best-effort Telegram notification and the CRM push
    are scheduled as background tasks, so the 201 response never blocks on (or fails
    because of) either remote API. When an integration is disabled its task is an
    immediate no-op. The CRM lead is queued in the same insert (``crm_queue``), so a
    CRM outage delays it — the outbox worker retries — but never loses it.
    """
    crm_enabled = get_settings().crm_is_enabled
    record = store.add_submission(body, crm_queue=crm_enabled)
    background_tasks.add_task(notify_new_lead_task, record)
    if crm_enabled:
        background_tasks.add_task(push_lead_task, record.id)
    return record


@router.get("/admin/submissions", response_model=list[AdminContactSubmission])
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


@router.post(
    "/admin/submissions/{submission_id}/crm-resend",
    response_model=AdminContactSubmission,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("10/minute")
def resend_submission_to_crm(
    request: Request,
    submission_id: str,
    background_tasks: BackgroundTasks,
    admin: AdminInfo = Depends(get_current_admin),
):
    """Admin only — put a lead back in the CRM outbox and try it again right away.

    Resets the retry budget, so it is the way out of ``failed`` once the cause (a wrong
    key, a 400 the CRM has since fixed…) is gone. Safe to repeat: the CRM dedupes on the
    submission id. 409 when the integration is not configured, 404 for an unknown id.
    """
    if not get_settings().crm_is_enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CRM integration is not configured",
        )
    row = crm_service.requeue(submission_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    background_tasks.add_task(push_lead_task, row.id)
    return AdminContactSubmission.model_construct(
        id=row.id,
        created_at=row.created_at,
        name=row.name,
        email=row.email,
        phone=row.phone,
        message=row.message,
        project=row.project,
        estimate=row.estimate,
        status=row.status or "nou",
        consent_at=row.consent_at or "",
        crm_status=row.crm_status,
    )
