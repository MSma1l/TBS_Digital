# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Backend (FastAPI + Uvicorn). Small single-stage image on python:3.11-slim.
# ---------------------------------------------------------------------------
FROM python:3.11-slim

# Predictable Python behaviour in containers.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install deps first so this layer caches across code changes.
# (requirements.txt is owned by the backend; we only read/COPY it.)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code.
COPY app ./app

# Runtime data dir for the JSON stand-in / SQLite fallback. Owned by the
# non-root user so the app can write content.json / *.db there.
RUN useradd --system --create-home --uid 1001 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

ENV DATA_DIR=/app/data

EXPOSE 8000

# Single uvicorn process is fine for this service; scale with compose replicas
# or swap in gunicorn+uvicorn workers behind a reverse proxy if needed.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
