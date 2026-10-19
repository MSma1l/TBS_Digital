# 17 — CRM Lead Intake (Nexa CRM)

Every new contact-form lead is also pushed into the company CRM — **Nexa CRM** at
`https://tbs-crm.sma1lsoft.eu` — where it becomes a **client with status „Nou”**. It runs
inside the FastAPI backend ([10 — Backend](./10-backend.md)) next to the Telegram bot
([13 — Telegram](./13-telegram.md)) and follows the same rule: the public
`POST /api/contact` stays fast and **never fails or slows down because of the CRM**.

Unlike the Telegram notification, the CRM push is **reliable**: its delivery state is stored
on the submission row (an *outbox*), so a CRM outage only delays a lead — it is retried with
back-off and never lost.

```
  Contact form ── POST /api/contact ──► INSERT submission (crm_status = pending)
                         │                    │
                     201 at once         background task ──► signed POST ──► Nexa CRM
                                              │                                │
                                              ▼                    201 created / 200 duplicate|merged
                       crm_status = sent | pending (retry later) | failed
                                              ▲
                     outbox worker (every 60 s) ── retries pending leads once due
```

## One-time setup

1. **In the CRM:** *Setări → Integrări → „Surse de lead-uri”* → create a source named
   **„TBS Digital (site)”**.
2. Copy the **endpoint URL** (`https://tbs-crm.sma1lsoft.eu/api/v1/integrations/<id>/leads`)
   and the **one-time key**. The key is shown **once** — if it is lost, regenerate it in the
   CRM and update the site.
3. **On the site's server**, add both to the root `.env` (never committed; see
   [12 — Deployment](./12-deployment.md)):

   ```env
   CRM_LEADS_URL=https://tbs-crm.sma1lsoft.eu/api/v1/integrations/<id>/leads
   CRM_LEADS_SECRET=<the one-time key>
   ```

4. **Restart the backend** (`make up`, or `docker compose … up -d backend`). Settings are read
   at boot; `docker-compose.yml` passes both variables into the backend container.
5. **Verify** with the end-to-end test below.

Leave either variable empty and the whole integration is a **no-op** — no network calls, no
worker, leads are not queued. Setting only one of them logs a WARNING at boot
(`CRM integration disabled: CRM_LEADS_URL and CRM_LEADS_SECRET must both be set.`).

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `CRM_LEADS_URL` | yes (to enable) | The full intake endpoint from the CRM. Must be `https://`. |
| `CRM_LEADS_SECRET` | yes (to enable) | The lead source's HMAC key. **Secret** — `.env` only, never logged. |

Both are trimmed of surrounding whitespace (a stray newline would otherwise silently break
the signature).

**URL rules** (`config.crm_url_problem`, enforced at boot in every environment — the app
refuses to start with a bad value):

- `https://…` — always accepted. **This is the recommended production value**: the public
  `https://tbs-crm.sma1lsoft.eu/…` URL.
- `http://` — accepted **only outside production** and only for a host that can't be on the
  public internet: `localhost` / `127.0.0.1`, or a single-label docker service name.
- Anything else (public `http://`, other schemes, embedded `user:pass@`, a `#fragment`, no
  host) is rejected.

### Docker networking

If the site and the CRM run on the same server, the **public https URL works** — the request
leaves the backend container, resolves `tbs-crm.sma1lsoft.eu` and goes through the shared
nginx like any other client (the backend needs outbound access to the server's public IP).

The CRM's internal address — `http://tbs-crm-frontend:8080/api/v1/integrations/<id>/leads` —
is reachable only if the site's backend is attached to the CRM's docker network
`networking_crowe`. It is plain http, so it is accepted **only when `ENVIRONMENT` is not
production**; `docker-compose.prod.yml` forces production, so in prod always use the public
https URL.

## The intake contract

Owned by the CRM side — the client (`backend/app/crm/client.py`) implements exactly this:

- `POST <CRM_LEADS_URL>`, `Content-Type: application/json`, a 5 s timeout, **redirects are
  never followed** (a redirect would re-send personal data to wherever `Location` points; it
  is treated as a configuration error).
- `X-CRM-Timestamp: <unix seconds>`
- `X-CRM-Signature: sha256=<hex HMAC-SHA256(CRM_LEADS_SECRET, "<timestamp>.<raw body>")>` —
  the JSON is serialised to bytes **once** (compact, UTF-8); those exact bytes are signed and
  sent.
- Body — only the fields the CRM accepts (it answers 400 to unknown fields):

  | Field | Source | Notes |
  |-------|--------|-------|
  | `externalId` | submission id | the CRM dedupes on it |
  | `name` | ≤ 120 | |
  | `email` | ≤ 254 | HTML-unescaped (it is the one field stored escaped) |
  | `phone` | ≤ 40 | omitted when empty |
  | `message` | ≤ 5000 | omitted when empty |
  | `project` | ≤ 160 | the selected service; omitted when empty |
  | `estimate` | ≤ 80 | omitted when empty |
  | `createdAt` | submission `created_at` | ISO-8601 |

- Responses:

  | CRM answer | Outcome |
  |------------|---------|
  | `201 {status:"created"}`, `200 {status:"duplicate"\|"merged"}` (any 2xx) | **sent** |
  | `400` and any other 4xx (404, 403…) | **failed**, not retried — the same request would fail again |
  | `401` | **failed**, not retried; logged as ERROR: the key doesn't match the source |
  | 3xx | **failed** — `CRM_LEADS_URL` is wrong (e.g. http vs https) |
  | `408`, `429`, `5xx`, network error, timeout | **retry** with back-off |

## Delivery state (the outbox)

Four columns on `submissions`, ALTERed in on boot by `create_db_and_tables`
(`db.CRM_COLUMNS`, SQLite and Postgres):

| Column | Meaning |
|--------|---------|
| `crm_status` | `""` never queued · `pending` · `sent` · `failed` |
| `crm_attempts` | attempts made so far |
| `crm_next_attempt_at` | unix seconds when the next attempt is due (also the claim lease) |
| `crm_last_error` | ≤ 300 chars, e.g. `HTTP 503`, `timeout (ReadTimeout)`, `HTTP 400: …` — never the secret |

- **Queued in the same insert.** When the integration is on, `submit_contact` stores the row
  with `crm_status = pending` and schedules `crm.worker.push_lead_task` as a background task
  next to the Telegram one. If the process dies before the task runs, the row is still in the
  outbox and the worker picks it up.
- **Leads older than the integration are not pushed.** The ALTERed column defaults to `""`,
  which nothing ever picks up — the first deploy does not flood the CRM with history. Same for
  leads that arrive while the integration is off. An admin can still send any of them by hand
  (below).
- **Retries.** At most **8 attempts**: waits of 1 min · 5 min · 15 min · 1 h · 3 h · 6 h · 12 h
  between them (≈ 22 h in total). After the 8th failed attempt the lead is `failed` with
  `gave up after 8 attempts; last: …`.
- **The worker** (`crm.worker.run_worker`) starts from the app lifespan only when the
  integration is enabled and sweeps the outbox every 60 s, up to 20 due leads per sweep.
- **Safe with several app workers.** A sender first *claims* the row with a single
  conditional `UPDATE … WHERE crm_status='pending' AND crm_next_attempt_at <= now` that pushes
  `crm_next_attempt_at` 120 s ahead (a lease). Only one claimant's UPDATE matches; the outcome
  is written only while the row still carries that lease. If a process dies mid-send the
  lease expires and the lead becomes due again. The worst case is a rare second send of the
  same lead — harmless, since the CRM dedupes on `externalId`.

## Admin panel

The **Cereri** tab ([09 — Admin](./09-admin.md)) shows a badge on each request:
**CRM: trimis** · **CRM: în așteptare** · **CRM: eșuat** (none when the lead was never
queued). A failed lead gets a **Retrimite în CRM** button, which calls:

`POST /api/admin/submissions/{id}/crm-resend` — admin JWT, rate-limited (10/min). It resets
the lead to `pending` with a fresh retry budget and tries it again immediately; `202` with the
updated record, `404` for an unknown id, `409` when the integration isn't configured. Safe to
repeat (the CRM dedupes). `crm_status` is exposed only on the admin API
(`AdminContactSubmission`), never on the public `POST /api/contact` response.

## Security

- **The key is a secret.** It lives only in `.env`, is never logged, never stored in the DB
  and never echoed in `crm_last_error` (error strings are built from the status code and the
  exception *class*; any occurrence of the key is redacted as a last guard). Logs name the
  endpoint only as `scheme://host`, not the integration id.
- **Leads are personal data** — they only travel over https in production (boot-time URL
  check) and redirects are never followed.
- The CRM verifies the HMAC and the timestamp, so a captured request can't be altered or
  replayed outside the CRM's time window.

## Verification & troubleshooting

As with Telegram, **INFO lines don't reach `docker logs`** (no handler on `app.crm`; Python's
fallback prints WARNING+). Silence is good: failures log as WARNING (retrying) or ERROR
(failed).

```bash
# 1. Both variables present in the container (presence only, never the value)
docker exec tbs-digital-backend sh -c \
  'test -n "$CRM_LEADS_URL" && echo URL SET || echo URL MISSING;
   test -n "$CRM_LEADS_SECRET" && echo KEY SET || echo KEY MISSING'

# 2. Delivery state of the latest leads
docker exec tbs-digital-db-1 psql -U tbs -d tbs_digital -c \
  "SELECT id, created_at, crm_status, crm_attempts, crm_last_error
     FROM submissions ORDER BY created_at DESC LIMIT 10;"
```

End-to-end: submit the test lead from [13 — Telegram](./13-telegram.md#test-end-to-end), then
check that the request shows **CRM: trimis** in the admin panel and the client appears in the
CRM with status „Nou”. Delete the test client in both places afterwards.

| Symptom | Likely cause / fix |
|---------|--------------------|
| Backend refuses to boot: `Invalid CRM configuration: …` | `CRM_LEADS_URL` breaks the URL rules above — in production it must be the https URL. |
| `CRM: eșuat`, error `HTTP 401: signature rejected` | Wrong/rotated key, or the URL of another source. Fix `CRM_LEADS_SECRET`, restart, then **Retrimite în CRM**. |
| `CRM: eșuat`, error `HTTP 400: …` | The CRM rejected the payload; the error carries its reason. Fix on the CRM side, then re-send. |
| `CRM: eșuat`, error `HTTP 30x: redirect not followed` | URL is http instead of https, or outdated. Use the exact URL from the CRM. |
| Stays `CRM: în așteptare` | CRM down/unreachable (`crm_last_error`: `HTTP 5xx`, `timeout`, `network error`). It retries on its own for ≈ 22 h; check the backend can reach the CRM host. |
| No badge at all on new leads | Integration off — one of the variables is empty in the container (check 1). |
