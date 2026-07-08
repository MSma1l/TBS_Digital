import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import create_db_and_tables
from .routers import auth, contact, content
from .seed import seed_database
from .telegram.worker import run_worker

settings = get_settings()
logger = logging.getLogger("app.telegram")

# Defence in depth: reject absurdly large request bodies outright (before parsing),
# so a huge JSON payload can't be used to exhaust memory. The per-list caps in
# SiteContent (MAX_LIST_ITEMS) further bound how much a valid PUT can store.
MAX_BODY_BYTES = 1_000_000  # 1 MB


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables, seed content/admin, and run the Telegram worker (if enabled)."""
    create_db_and_tables()
    seed_database()

    worker_task = None
    if settings.telegram_is_enabled:
        worker_task = asyncio.create_task(run_worker())
        logger.info("Telegram long-poll worker scheduled.")

    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Content + contact API for the TBS Digital site. "
        "Persistence is a SQL database (SQLModel); see backend/README.md."
    ),
    lifespan=lifespan,
)

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject over-large payloads early based on the declared Content-Length."""
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "Request body too large"},
                )
        except ValueError:
            pass  # malformed header — let the normal pipeline handle it
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(contact.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": settings.app_name}
