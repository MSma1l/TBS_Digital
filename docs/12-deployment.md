# 12 — Deployment (Docker Compose + Make)

The whole stack — **Next.js frontend + FastAPI backend + Postgres** — runs with one command.
Config comes from a single root `.env`; a `Makefile` wraps the common operations.

## One-command start

```bash
cp .env.example .env     # then edit the secrets (see the checklist inside the file)
make up                  # build + start db, backend, frontend in the background
```

- Frontend: <http://localhost:3000>
- Backend API + docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/health>

`make down` stops it; `make logs` tails all services; `make clean` also deletes the DB volume.

## Services (`docker-compose.yml`)

| Service | Image / build | Port | Notes |
|---------|---------------|------|-------|
| `db` | `postgres:16-alpine` | (internal) | Named volume `db_data`, `pg_isready` healthcheck. |
| `backend` | `backend/Dockerfile` (python:3.11-slim) | 8000 | Waits for `db` healthy; runs uvicorn; creates tables + seeds on startup. |
| `frontend` | root `Dockerfile` (node:22-alpine, standalone) | 3000 | Built with `NEXT_PUBLIC_API_URL` as a build ARG (baked into the client bundle). |

`docker-compose.prod.yml` is an override for production: `restart: always`, stops publishing
the Postgres port, and notes running behind an HTTPS reverse proxy. Use it with
`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`.

### The one gotcha — internal vs public API URL
Inside the Docker network the backend is reachable at `http://backend:8000`, but
`NEXT_PUBLIC_API_URL` is **baked into the browser bundle at build time**, so it must be the
**public, host-facing** URL the visitor's browser can reach (`http://localhost:8000` in dev,
`https://api.your-domain` in prod) — never `http://backend:8000`. Rebuild the frontend image
after changing it (`make build` / `make up`).

## Make targets

Run `make` (or `make help`) for the full list. Highlights:

| Target | Does |
|--------|------|
| `up` / `down` | Start (build) / stop the stack |
| `build` | Build images without starting |
| `logs` / `ps` / `restart` | Tail logs / status / restart |
| `clean` | `down -v` — **destroys** the DB + data volumes |
| `db-shell` / `backend-shell` / `frontend-shell` | Shell into a container (`db-shell` → psql) |
| `test` / `test-local` | Backend pytest in the container / in the local venv |
| `dev-frontend` / `dev-backend` | Run locally without Docker (Next dev / uvicorn --reload) |

Override the compose command for the legacy plugin: `make COMPOSE="docker-compose" up`.

## Environment variables (root `.env.example`)

| Group | Vars |
|-------|------|
| Postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| Backend | `DATABASE_URL` (built from the Postgres values), `APP_NAME`, `DATA_DIR`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `CORS_ORIGINS` |
| Frontend | `NEXT_PUBLIC_API_URL` |

`.env.local.example` is a smaller template for running the **frontend only** with
`npm run dev` (no Docker).

## Production checklist (also at the top of `.env.example`)

- [ ] Change **every** secret: `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `JWT_SECRET`.
- [ ] Generate `JWT_SECRET` with `openssl rand -hex 32`.
- [ ] Set the real domain in `CORS_ORIGINS` **and** `NEXT_PUBLIC_API_URL`.
- [ ] Use managed Postgres or the bundled `db` service; keep `DATABASE_URL` in sync.
- [ ] Run behind HTTPS / a reverse proxy; stop publishing Postgres (5432) publicly.
- [ ] Add rate limiting (see [11 — Security](./11-security.md)).

## Deploy pe server-lucru-1 (tbs.md)

Serverul rulează un singur reverse proxy comun (`nginx_proxy`) care deține 80/443 și
ajunge la fiecare aplicație **după numele containerului**, pe rețeaua `shared-network`.
Nu publicăm porturi pe host: `docker-compose.prod.yml` le închide (`ports: []`) și fixează
`container_name` la `tbs-digital-frontend` / `tbs-digital-backend` — exact numele pe care le
caută vhost-ul.

> ⚠️ **`tbs.md` este deja folosit** de aplicația `webdev`, prin `conf.d/tbs.conf`.
> Pașii de mai jos **înlocuiesc** acel vhost, deci site-ul vechi iese din aer la reload.
> Certificatul `tbs.md` există deja, deci **nu e nevoie de certbot**.

### 1. `.env` pe server (scris direct, nu copiat cu scp)

```bash
mkdir -p /root/tbs-digital && cd /root/tbs-digital
cat > .env <<'EOF'
ENVIRONMENT=production
POSTGRES_USER=tbs
POSTGRES_PASSWORD=INLOCUIESTE_DB
POSTGRES_DB=tbs_digital
DATABASE_URL=postgresql://tbs:INLOCUIESTE_DB@db:5432/tbs_digital
APP_NAME=TBS Digital
ADMIN_USERNAME=admin
ADMIN_PASSWORD=INLOCUIESTE_ADMIN
JWT_SECRET=INLOCUIESTE_JWT
JWT_EXPIRE_MINUTES=60
# Aceeași origine ca frontend-ul: browserul cheamă https://tbs.md/api/...
CORS_ORIGINS=https://tbs.md
NEXT_PUBLIC_API_URL=https://tbs.md
TELEGRAM_BOT_TOKEN=INLOCUIESTE_TOKEN
TELEGRAM_GROUP_CHAT_ID=
EOF
chmod 600 .env
```

Generează secretele pe server: `openssl rand -hex 32` (JWT), `openssl rand -hex 24` (DB).

`NEXT_PUBLIC_API_URL` este **inlined în bundle-ul de browser la build**, deci trebuie să fie
URL-ul public, nu `http://backend:8000`. Pus pe aceeași origine, apelurile devin same-origin
și CORS nici nu intră în discuție. Dacă îl schimbi, **rebuild** imaginea frontend.

### 2. Pornește stack-ul

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker network inspect shared-network | grep tbs-digital   # ambele containere trebuie să apară
```

### 3. Backup la vhost-ul vechi, apoi înlocuiește-l

```bash
cp /root/nginx-proxy/conf.d/tbs.conf /root/tbs.conf.webdev.bak   # ← plasa de siguranță
cp deploy/nginx/tbs.conf /root/nginx-proxy/conf.d/tbs.conf
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

`nginx -t` validează înainte de reload; dacă pică, **nu** da reload — nimic nu s-a schimbat încă.

### 4. Verifică

```bash
curl -I https://tbs.md                      # 200, de la Next
curl -s https://tbs.md/api/content | head   # JSON, de la FastAPI
```

### Rollback (dacă ceva e stricat)

```bash
cp /root/tbs.conf.webdev.bak /root/nginx-proxy/conf.d/tbs.conf
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

### De verificat o singură dată

Vhost-ul servește și `www.tbs.md`. Confirmă că certificatul acoperă ambele nume, altfel
`www` va da eroare de certificat în browser:

```bash
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt certbot/certbot certificates | grep -A3 'tbs.md'
```

Dacă lipsește `www.tbs.md`, scoate-l din `server_name` în blocul `:443` sau reemite certul cu
`-d tbs.md -d www.tbs.md`.

## Local dev without Docker

```bash
# Frontend
npm install && npm run dev            # http://localhost:3000

# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                  # SQLite default — no Postgres needed
uvicorn app.main:app --reload --port 8000
```

With no `DATABASE_URL`, the backend defaults to a local **SQLite** file
(`sqlite:///./data/tbs.db`), auto-created and seeded on first run — handy for quick local work.
