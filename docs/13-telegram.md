# 13 — Telegram Lead Bot

A Telegram bot (`@TBS_Notification_Agent_bot`) that posts every **new contact-form lead**
into a private Telegram **group**, sorted into **forum topics** by service type, with inline
buttons to classify each lead. It turns the group into a lightweight, shared CRM inbox for the
agency. The bot runs as a **background worker inside the FastAPI backend** (see
[10 — Backend](./10-backend.md)); it needs no public webhook.

## What it does

When a visitor submits the contact form, `POST /api/contact` stores the submission and then —
**best-effort** — hands the lead to the Telegram worker. The worker finds (or creates) the
topic for that lead's service and posts a formatted message with classification buttons.

- **One topic per service.** The group uses forum **Topics**, one per service type:
  *Landing page, Site web, Magazin online, Aplicație mobilă, CRM, SaaS, Automatizare,
  Dashboard, Bot Telegram, IA, Software personalizat*, plus a **General** topic. If the topic
  for a service doesn't exist yet, the bot **creates** it. An unknown or empty service falls
  back to a general **"Altele"** topic.
- **Classification buttons.** Each lead message carries inline buttons —
  🆕 Nou · 📞 Contactat · 💰 Ofertă · ✅ Câștigat · ❌ Pierdut. Clicking one updates the lead's
  `status` in the database and **edits the message** to reflect the new status. The status is
  stored on the submission, so the admin panel and the group stay in sync.
- **`/stats` command.** Sent in the **General** topic, it replies with totals: overall lead
  count, **per-service** counts, and **per-status** counts. It's written to be extensible — the
  owner can add custom stats over time.

```
  Contact form (site)
        │  POST /api/contact  → stores submission (status = Nou)
        ▼
  FastAPI backend ──(best-effort)──► Telegram worker (long-polling)
        │                                   │
        │                          find/create topic for service
        │                                   ▼
        │                     ┌─────────────────────────────┐
        │                     │  Group topic: "Magazin online"│
        │                     │  🆕 New lead: name / email …  │
        │                     │  [🆕][📞][💰][✅][❌]          │
        │                     └─────────────┬───────────────┘
        │                                   │ owner taps a button
        ▼                                   ▼
  submission.status  ◄──────────  update status + edit message
```

If Telegram is down or misconfigured, the notification simply fails silently — the form
submission still succeeds and is saved to the DB.

## One-time setup (owner)

1. **Get the bot token from @BotFather.** You already have `@TBS_Notification_Agent_bot`; its
   token comes from BotFather. Treat the token as a **secret** — anyone with it controls the
   bot. If it ever leaks, open BotFather → `/revoke` to invalidate it and issue a new one.
2. **Create a Telegram group** and make it a **supergroup with Topics enabled**:
   Group Settings → **Topics** → turn **ON**. (Topics are what let the bot sort leads per
   service.)
3. **Add the bot and promote it to admin.** Add `@TBS_Notification_Agent_bot` to the group,
   then promote it to **admin** with at least **Manage Topics** permission (so it can create
   topics) and the ability to **send messages**. Without admin + Manage Topics it can't post or
   create topics.
4. **Handle privacy mode.** By default the bot's privacy mode is **ON**, so it only sees
   commands addressed to it. Either:
   - address commands to it explicitly — `/register@TBS_Notification_Agent_bot`,
     `/stats@TBS_Notification_Agent_bot`; **or**
   - disable privacy in BotFather → `/setprivacy` → **Disable**, so plain `/register` and
     `/stats` are seen.
5. **Register the group.** In the group, run **`/register`** so the bot captures and stores the
   group's chat id. (Alternatively, set `TELEGRAM_GROUP_CHAT_ID` in `.env` directly.)
6. **Configure and start.** Put `TELEGRAM_BOT_TOKEN` in `.env` (see
   [12 — Deployment](./12-deployment.md)). Run **`make telegram-check`** to verify the token,
   then **`make up`** (or a local `uvicorn`) to start the backend — the worker starts with it.

## Environment variables

All three live in the root **`.env`** (gitignored — never committed). See
[12 — Deployment](./12-deployment.md).

| Var | Required | Purpose |
|-----|----------|---------|
| `TELEGRAM_BOT_TOKEN` | yes (to enable) | Bot token from @BotFather. **Secret** — `.env` only. |
| `TELEGRAM_GROUP_CHAT_ID` | optional | Target group id. Auto-captured by `/register`; set it manually to skip that step. |
| `TELEGRAM_ENABLED` | optional | Master on/off switch for the worker (e.g. disable in dev). |

## Commands & buttons

| Command | Where | Does |
|---------|-------|------|
| `/register` | in the group | Stores the group chat id so the bot knows where to post leads. |
| `/stats` | General topic | Replies with totals: overall, per-service, per-status counts (extensible). |
| `/start`, `/help` | anywhere | Short help — what the bot is and how to set it up. |

**Classification buttons** (on every lead message):
🆕 **Nou** · 📞 **Contactat** · 💰 **Ofertă** · ✅ **Câștigat** · ❌ **Pierdut**. Tapping one
updates `submission.status` and edits the message to show the new state.

> Remember: with privacy mode ON, address commands to the bot
> (`/register@TBS_Notification_Agent_bot`, `/stats@TBS_Notification_Agent_bot`) or disable
> privacy in BotFather (step 4 above).

## Security

- The **bot token is a secret**. It lives only in `.env` (gitignored) and is never committed or
  logged. If it leaks, `/revoke` it in BotFather immediately.
- **Leads contain personal data** — visitor name, email, phone, message. Those are posted into
  the group verbatim, so the **group must be private** and **all members trusted**. Don't add
  the bot to a public or shared group.
- The lead text is already HTML-escaped by the backend's input validation before storage, so
  stored values are inert. See [11 — Security](./11-security.md) for the full validation model.

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Bot is silent (no lead messages) | Bot not an **admin** in the group; **Topics** not enabled; **privacy mode** hiding commands; or wrong/unset group id — re-run `/register` (or set `TELEGRAM_GROUP_CHAT_ID`). |
| Topics aren't created | Bot lacks the **Manage Topics** admin permission — grant it in Group Settings. |
| `/register` / `/stats` ignored | Privacy mode ON — address the command to the bot (`…@TBS_Notification_Agent_bot`) or `/setprivacy` → Disable in BotFather. |
| Token invalid / worker won't start | Verify with **`make telegram-check`**; if leaked or wrong, `/revoke` in BotFather and update `TELEGRAM_BOT_TOKEN` in `.env`. |
| Nothing happens but the form still works | Expected when Telegram is unreachable — notifications are best-effort; check backend logs and `TELEGRAM_ENABLED`. |
| No `Telegram` line at all in `docker logs` | **Not a symptom.** The worker's start-up message is INFO and the default Python handler only emits WARNING+ — see [Verificare după deploy](#verificare-după-deploy). |

## Verificare după deploy

Capcana principală: **absența log-urilor nu înseamnă că botul e picat.** Loggerul
`app.telegram` nu are handler propriu, iar handler-ul implicit al Python (`logging.lastResort`)
emite doar de la **WARNING** în sus — deci `"Telegram worker started as @…"` (INFO) **nu apare
niciodată** în `docker logs`. Ce apare sigur sunt eșecurile (`logger.warning`).

Patru verificări, de la ieftin la decisiv:

```bash
# 1. Tokenul e valid (getMe) — rulat pe server, nu afișează tokenul
cd /root/tbs-digital && make telegram-check

# 2. Botul e activ în container (doar prezența, fără valoare)
docker exec tbs-digital-backend sh -c \
  'test -n "$TELEGRAM_BOT_TOKEN" && echo SET || echo MISSING; echo "ENABLED=$TELEGRAM_ENABLED"'

# 3. Grupul e înregistrat (env gol => se ia din DB, rândul scris de /register)
docker exec tbs-digital-db-1 psql -U tbs -d tbs_digital \
  -c "SELECT group_chat_id, is_forum FROM telegram_settings;"

# 4. Worker-ul chiar face long-polling: ține un socket deschis spre Telegram (149.154.x.x:443)
docker exec tbs-digital-backend sh -c 'cat /proc/net/tcp /proc/net/tcp6' \
  | awk '$4=="01" && $3 ~ /:01BB$/' | wc -l      # trebuie >= 1
```

> **Nu folosi `getUpdates` ca test.** E înșelător în ambele sensuri: dacă nimerește pauza
> dintre două cicluri de poll, întoarce `ok:true` deși worker-ul e viu (nu primești 409), iar
> dacă worker-ul chiar e oprit, îți consumă update-urile în așteptare. Verificarea 4 e cea care
> răspunde fără ambiguitate.

### Test end-to-end

Trimite un lead prin fluxul public real și marchează-l vizibil ca test, ca să nu fie urmărit
ca un client adevărat:

```bash
curl -X POST https://tbs.md/api/contact -H "Content-Type: application/json" -d '{
  "name":"TEST — verificare deploy (ignorati)","email":"test@tbs.md",
  "message":"Mesaj automat de TEST. Nu este un client real.","project":"Site web"}'
```

Aștepți **201** plus **zero** linii `Telegram` în `docker logs tbs-digital-backend` — orice
eșec de trimitere s-ar loga ca WARNING. Lead-ul rămâne în tabelul `submissions` și în tab-ul
**Cereri** din admin; șterge-l de acolo după verificare.

## How it fits the backend

See [10 — Backend](./10-backend.md). The Telegram worker starts inside the FastAPI **app
lifespan** (the same place the DB tables are created and seeded) via **long-polling**, so it
needs no public webhook and works identically in local dev and in Docker. When a lead arrives,
`POST /api/contact` stores the submission first, then triggers the notification **best-effort** —
a Telegram outage never breaks form submission. Button taps and `/stats` read and write the same
`submissions` table the admin **Cereri** tab shows, so the group and the admin panel share one
source of truth.
