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

### Ce rulează de fapt pe `tbs.md` azi

Apexul **nu** e un site static de prezentare: pe el rulează **DocuSafe**, un stack întreg,
cu compose-ul în `/root/tbs`:

| Rol | Containere |
|-----|------------|
| Web / app | `docusafe_nginx`, `docusafe_backend`, `docusafe_frontend` |
| Editor documente | `docusafe_onlyoffice` |
| Date | `docusafe_postgres`, `docusafe_redis`, `docusafe_minio`, `docusafe_meili` |
| Async | `docusafe_celery_worker`, `docusafe_celery_beat` |

> ⚠️ **DocuSafe nu se scoate din aer.** Planul este o **mutare**, nu o înlocuire:
> DocuSafe trece pe **`docusafe.tbs.md`** (vhost nou + certificat propriu), iar apexul
> `tbs.md` trece la TBS Digital. Cele două rulează **în paralel**, pe același proxy.

Ordinea contează: **întâi Etapa A** (DocuSafe capătă subdomeniul lui și e funcțional acolo),
**abia apoi Etapa B** (apexul trece la TBS Digital). Invers, DocuSafe ar rămâne fără casă.

### Cum stă treaba cu proxy-ul și certificatele

| Lucru | Unde |
|-------|------|
| Reverse proxy | containerul `nginx_proxy`, atașat la `shared-network` **și** la `docusafe_prod_net` |
| Vhost-uri | `/root/nginx-proxy/conf.d/` pe host → `/etc/nginx/conf.d` în container |
| Webroot ACME | `/root/nginx-proxy/certbot/www` pe host → `/var/www/certbot` în container |
| Certbot | rulează **din interiorul** containerului `nginx_proxy` |
| Reînnoire | cron zilnic 02:00: `docker exec nginx_proxy certbot renew --quiet && docker exec nginx_proxy nginx -s reload` |

Capcană: certbot **nu** e un container separat `certbot/certbot`. E instalat în `nginx_proxy`,
deci orice emitere se face cu `docker exec nginx_proxy certbot ...`. Un container efemer
`certbot/certbot` ar scrie în alt volum și ar rata webroot-ul pe care îl servește proxy-ul.

Certificatul `tbs.md` **există deja și acoperă atât `tbs.md`, cât și `www.tbs.md`** (confirmat
în SAN), valabil până la **1 septembrie 2026**. Pentru apex **nu e nevoie de certbot** —
certbot intră în joc doar pentru subdomeniul nou, `docusafe.tbs.md`.

### Prerequisite DNS

IP server: **195.178.106.161**. Nameservere: `alfa.dns.md` / `beta.dns.md`.

La momentul scrierii, **apexul `tbs.md` nu avea record A** (doar `docusafe.tbs.md` și
`statistica.tbs.md` aveau). Deci, înainte de Etapa B:

- [ ] `tbs.md` → A → `195.178.106.161`
- [ ] `www.tbs.md` → A → `195.178.106.161`
- [ ] `docusafe.tbs.md` → A → `195.178.106.161` (există deja)

```bash
dig +short tbs.md www.tbs.md docusafe.tbs.md    # toate trei trebuie să dea 195.178.106.161
```

Fără A record pe apex, `nginx -t` trece, dar nimeni nu ajunge la site — și nici certbot n-ar
putea reemite certul la expirare.

---

## Etapa A — DocuSafe trece pe `docusafe.tbs.md`

Etapa asta e **pur aditivă**: adaugi un vhost nou, `docusafe.conf`. `tbs.conf` (DocuSafe pe
apex) **rămâne neatins**, deci DocuSafe răspunde în continuare pe `tbs.md` cât timp lucrezi.

### A1. Vhost `:80` doar pentru challenge-ul ACME

Certbot cere ca `http://docusafe.tbs.md/.well-known/acme-challenge/` să fie servit **înainte**
de a exista certul — nu poți porni direct cu un bloc `:443` care referă un certificat inexistent
(`nginx -t` ar pica și ai da jos tot proxy-ul la reload).

```bash
cat > /root/nginx-proxy/conf.d/docusafe.conf <<'EOF'
server {
    listen 80;
    server_name docusafe.tbs.md;

    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
EOF
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

### A2. Emite certificatul

```bash
docker exec nginx_proxy certbot certonly --webroot -w /var/www/certbot -d docusafe.tbs.md
docker exec nginx_proxy ls /etc/letsencrypt/live/docusafe.tbs.md/   # fullchain.pem + privkey.pem
```

### A3. Adaugă blocul `:443` în `docusafe.conf`

**Copiază blocul `:443` din `tbs.conf`-ul actual (cel al DocuSafe)** și schimbă doar două
lucruri: `server_name` → `docusafe.tbs.md` și căile `ssl_certificate` / `ssl_certificate_key`
→ `/etc/letsencrypt/live/docusafe.tbs.md/`. Nu-l rescrie de la zero.

Ce **trebuie** să supraviețuiască copierii — fiecare are un motiv:

| Directivă | De ce |
|-----------|-------|
| CSP-ul DocuSafe (`add_header Content-Security-Policy ...`) | e croit pentru ONLYOFFICE; fără el, editorul de documente nu se încarcă |
| `location /onlyoffice/` cu `Upgrade` / `Connection "upgrade"` | ONLYOFFICE ține o conexiune WebSocket; fără upgrade, editorul rămâne blocat la „se conectează" |
| `client_max_body_size 200m` | DocuSafe primește upload-uri de documente; default-ul nginx (1m) le-ar tăia cu 413 |
| `proxy_buffering off` | download-uri mari / streaming — cu buffering, nginx le-ar acumula pe disc |

```bash
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

### A4. `APP_BASE_URL` în `/root/tbs/.env`

Singura variabilă DocuSafe care conține domeniul **și chiar contează**:

```
APP_BASE_URL=https://docusafe.tbs.md
```

`GOOGLE_REDIRECT_URI` și `MICROSOFT_REDIRECT_URI` conțin și ele `tbs.md`, dar OAuth-ul
**nu e configurat** (`client_id` / `secret` goale) — e config mort, nu-l urmări. SMTP la fel:
neconfigurat, deci nu are ce link să trimită greșit.

### A5. Recreează containerele care citesc `.env`

```bash
cd /root/tbs
docker compose up -d --force-recreate docusafe_backend docusafe_celery_worker docusafe_celery_beat
```

Un `restart` **nu** ajunge: variabilele de mediu se citesc la crearea containerului, nu la
pornirea procesului. Trebuie recreat.

### A6. Verifică

```bash
curl -I https://docusafe.tbs.md          # 200/302 de la DocuSafe, cert valid
curl -I https://tbs.md                   # încă DocuSafe — apexul e neatins în Etapa A
```

Deschide DocuSafe în browser și **editează un document** — asta validează dintr-un foc CSP-ul
și WebSocket-ul ONLYOFFICE, singurele două lucruri care se pot strica la copierea vhost-ului.

### Rollback Etapa A

Nu ai atins nimic existent, deci rollback-ul e o ștergere:

```bash
rm /root/nginx-proxy/conf.d/docusafe.conf
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

DocuSafe rămâne pe `tbs.md` ca înainte. (Dacă apucaseși să schimbi `APP_BASE_URL`, pune-l
înapoi pe `https://tbs.md` și recreează containerele de la pasul A5.)

---

## Etapa B — `tbs.md` trece la TBS Digital

Se face **doar după ce Etapa A e verificată** și DocuSafe merge pe `docusafe.tbs.md`.

### B1. DNS

A record pentru `tbs.md` și `www.tbs.md` → `195.178.106.161` (vezi *Prerequisite DNS*).
Așteaptă propagarea înainte de a merge mai departe.

### B2. `.env` pe server (scris direct, nu copiat cu scp)

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

### B3. Pornește stack-ul

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker network inspect shared-network | grep tbs-digital   # ambele containere trebuie să apară
```

Containerele pornesc și răspund pe `shared-network` **înainte** ca vhost-ul să le trimită
trafic — dacă ordinea ar fi inversă, apexul ar da 502 în fereastra dintre reload și build.

### B4. Backup la vhost-ul DocuSafe, apoi înlocuiește-l

```bash
cp /root/nginx-proxy/conf.d/tbs.conf /root/tbs.conf.docusafe.bak   # ← plasa de siguranță
cp deploy/nginx/tbs.conf /root/nginx-proxy/conf.d/tbs.conf
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

`nginx -t` validează înainte de reload; dacă pică, **nu** da reload — nimic nu s-a schimbat încă.

Vhost-ul nou (`deploy/nginx/tbs.conf`) păstrează moștenirea DocuSafe: rutele vechi
`/api/v1/` și `/onlyoffice/` primesc **301 către `docusafe.tbs.md`**, în loc de 404. Redirectăm
doar prefixele fără echivoc DocuSafe — un redirect pe tot `/api/` ar rupe backendul TBS Digital,
care stă exact acolo.

### B5. Verifică

```bash
curl -I https://tbs.md                      # 200, de la Next
curl -I https://www.tbs.md                  # cert valid (www e în SAN)
curl -s https://tbs.md/api/content | head   # JSON, de la FastAPI
curl -I https://tbs.md/api/v1/health        # 301 → https://docusafe.tbs.md/api/v1/health
curl -I https://docusafe.tbs.md             # DocuSafe, în continuare sus
```

### Rollback Etapa B

```bash
cp /root/tbs.conf.docusafe.bak /root/nginx-proxy/conf.d/tbs.conf
docker exec nginx_proxy nginx -t && docker exec nginx_proxy nginx -s reload
```

Apexul revine la DocuSafe. Dacă îl vrei complet ca înainte, pune și `APP_BASE_URL` înapoi pe
`https://tbs.md` în `/root/tbs/.env` și recreează containerele (pasul A5). Stack-ul TBS Digital
poate rămâne pornit — fără vhost, nu primește trafic.

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
