import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import get_settings

settings = get_settings()
logger = logging.getLogger("app.telegram")

# Defence in depth: reject absurdly large request bodies outright (before parsing),
# so a huge JSON payload can't be used to exhaust memory. The per-list caps in
# SiteContent (MAX_LIST_ITEMS) further bound how much a valid PUT can store.
MAX_BODY_BYTES = 1_000_000  # 1 MB


def _client_ip(request: Request) -> str:
    """Rate-limit key: the real client IP, honouring a proxy's X-Forwarded-For.

    Behind a load balancer the socket peer is the proxy, so we trust the *first*
    (left-most, original client) entry of X-Forwarded-For when present, and fall
    back to the direct peer address otherwise.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return get_remote_address(request)


# One process-wide limiter. Defined *before* the router imports below so the routers
# can import this instance for their @limiter.limit(...) decorators without a cycle.
limiter = Limiter(key_func=_client_ip, enabled=settings.rate_limit_enabled)
# Explicit: tests set RATE_LIMIT_ENABLED=false so repeated calls never hit 429.
limiter.enabled = settings.rate_limit_enabled

from .db import create_db_and_tables  # noqa: E402
from .routers import auth, contact, content  # noqa: E402
from .seed import seed_database  # noqa: E402
from .telegram.worker import run_worker  # noqa: E402


class BodySizeLimitMiddleware:
    """Pure-ASGI guard capping the request body at ``max_body_bytes``.

    Unlike a Content-Length-only check, this also caps chunked / missing-length
    bodies: it buffers the incoming body with a hard ceiling and returns 413 the
    moment the ceiling is crossed, regardless of what the header claims. The buffered
    body is then replayed to the downstream app so normal parsing is unaffected.
    """

    def __init__(self, app, max_body_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Fast path: reject on a declared, over-large Content-Length.
        for name, value in scope.get("headers") or []:
            if name == b"content-length":
                try:
                    if int(value) > self.max_body_bytes:
                        await self._reject(send)
                        return
                except ValueError:
                    pass
                break

        # Buffer the body with a hard ceiling (covers chunked / missing length).
        body = b""
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] != "http.request":
                # e.g. http.disconnect — hand control back to the app unchanged.
                await self._replay(scope, receive, send, body, trailing=message)
                return
            body += message.get("body", b"")
            more_body = message.get("more_body", False)
            if len(body) > self.max_body_bytes:
                await self._reject(send)
                return

        await self._replay(scope, receive, send, body)

    async def _replay(self, scope, receive, send, body, trailing=None) -> None:
        sent = False

        async def replay_receive():
            nonlocal sent
            if not sent:
                sent = True
                if trailing is not None:
                    return trailing
                return {
                    "type": "http.request",
                    "body": body,
                    "more_body": False,
                }
            return await receive()

        await self.app(scope, replay_receive, send)

    @staticmethod
    async def _reject(send) -> None:
        payload = b'{"detail":"Request body too large"}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(payload)).encode()),
                ],
            }
        )
        await send({"type": "http.response.body", "body": payload})


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

# Rate limiter wiring: expose the limiter on app.state (slowapi's handler reads it)
# and register the 429 handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


_SECURITY_HEADERS = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "frame-ancestors 'none'",
}

# CORS (innermost of our three). Auth is a Bearer token (no cookies), so credentials
# must stay off — that also lets the configured allow-list stay strict.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Body-size cap sits above CORS.
app.add_middleware(BodySizeLimitMiddleware, max_body_bytes=MAX_BODY_BYTES)


# Security headers on every response. Registered last => outermost middleware, so it
# also stamps error responses (413 body-limit, 429 rate-limit, CORS preflight).
@app.middleware("http")
async def security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    for header, value in _SECURITY_HEADERS.items():
        response.headers.setdefault(header, value)
    # HSTS only in production — never on local http, where it would pin the browser
    # to https and break development.
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains",
        )
    return response

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(contact.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": settings.app_name}
