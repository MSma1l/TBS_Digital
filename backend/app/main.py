from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import auth, contact, content

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Content + contact API for the TBS Digital site. "
        "Persistence is a JSON stand-in in this phase (see backend/README.md)."
    ),
)

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
