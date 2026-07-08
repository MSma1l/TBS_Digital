#!/usr/bin/env bash
#
# verify-api.sh — end-to-end verification of every frontend<->backend API call.
#
# Boots the FastAPI backend on a free port against a THROWAWAY SQLite DB with the
# Telegram worker disabled, then exercises every endpoint that the Next.js frontend
# (lib/api.ts) calls and asserts functional behaviour + error handling. Prints a
# PASS/FAIL line per check and exits non-zero if anything fails. Tears everything
# down (kills the server, removes the throwaway DB) on exit.
#
# Usage:   PORT=8020 ./scripts/verify-api.sh
# Config (env, all optional):
#   PORT             port to run the backend on            (default 8020)
#   ADMIN_USERNAME   admin login (else backend/.env / admin)
#   ADMIN_PASSWORD   admin password (else backend/.env / change-me)
#
# No secrets are hardcoded. The real Telegram token is never used: the server is
# started with TELEGRAM_ENABLED=false so the long-poll worker never runs.

set -uo pipefail

# --- locations -------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_PY="$BACKEND_DIR/.venv/bin/python"
UVICORN="$BACKEND_DIR/.venv/bin/uvicorn"

PORT="${PORT:-8020}"
BASE="http://127.0.0.1:${PORT}"
DB_REL="./data/verify.db"                 # relative to BACKEND_DIR (server cwd)
DB_ABS="$BACKEND_DIR/data/verify.db"

# Admin creds: env override, else read from backend/.env, else safe defaults.
env_val() { grep -E "^$1=" "$BACKEND_DIR/.env" 2>/dev/null | tail -n1 | cut -d= -f2- ; }
ADMIN_USERNAME="${ADMIN_USERNAME:-$(env_val ADMIN_USERNAME)}"; ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(env_val ADMIN_PASSWORD)}"; ADMIN_PASSWORD="${ADMIN_PASSWORD:-change-me}"

TMP_DIR="$(mktemp -d)"
SERVER_LOG="$TMP_DIR/uvicorn.log"
SERVER_PID=""

PASS=0
FAIL=0

# --- helpers ---------------------------------------------------------------
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }

pass() { PASS=$((PASS+1)); printf '  [%s] %s\n' "$(green PASS)" "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  [%s] %s\n' "$(red FAIL)"  "$1"; [ -n "${2:-}" ] && printf '         %s\n' "$2"; }

# assert_eq <expected> <actual> <label>
assert_eq() { if [ "$1" = "$2" ]; then pass "$3"; else fail "$3" "expected '$1', got '$2'"; fi; }

# curl_code METHOD PATH [--data JSON] [--auth TOKEN] [--origin ORIGIN]
# Writes the response body to $BODY_FILE and echoes the HTTP status code.
BODY_FILE="$TMP_DIR/body.json"
curl_code() {
  local method="$1" path="$2"; shift 2
  local data="" token="" origin="" ct=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --data)   data="$2"; shift 2;;
      --auth)   token="$2"; shift 2;;
      --origin) origin="$2"; shift 2;;
      *) shift;;
    esac
  done
  local args=(-s -o "$BODY_FILE" -w '%{http_code}' -X "$method" "$BASE$path")
  [ -n "$data" ]   && args+=(-H 'Content-Type: application/json' --data "$data")
  [ -n "$token" ]  && args+=(-H "Authorization: Bearer $token")
  [ -n "$origin" ] && args+=(-H "Origin: $origin")
  curl "${args[@]}"
}

# jqpy 'expr' — evaluate a python expression against the JSON in $BODY_FILE.
# The parsed object is bound to `d`. Prints the result.
jqpy() { "$VENV_PY" -c "import json,sys; d=json.load(open('$BODY_FILE')); print($1)" 2>/dev/null; }

cleanup() {
  echo
  echo "--- teardown ---"
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null
    echo "  server (pid $SERVER_PID) stopped"
  fi
  rm -f "$DB_ABS" "$DB_ABS-wal" "$DB_ABS-shm" && echo "  throwaway DB removed ($DB_ABS)"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

# --- sanity ----------------------------------------------------------------
[ -x "$UVICORN" ] || { echo "uvicorn not found at $UVICORN"; exit 2; }
rm -f "$DB_ABS" "$DB_ABS-wal" "$DB_ABS-shm"

echo "=== TBS Digital API verification ==="
echo "port=$PORT  db=$DB_REL (throwaway)  telegram=disabled  admin=$ADMIN_USERNAME"
echo

# --- start server ----------------------------------------------------------
echo "--- starting backend ---"
(
  cd "$BACKEND_DIR" || exit 1
  DATABASE_URL="sqlite:///$DB_REL" TELEGRAM_ENABLED=false \
    exec "$UVICORN" app.main:app --host 127.0.0.1 --port "$PORT" --log-level warning
) >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# curl-until-ok readiness loop
ready=0
for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  server process exited early; log:"; sed 's/^/    /' "$SERVER_LOG"; exit 2
  fi
  if curl -fsS "$BASE/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.5
done
[ "$ready" = 1 ] || { echo "  server did not become ready; log:"; sed 's/^/    /' "$SERVER_LOG"; exit 2; }
echo "  ready at $BASE (pid $SERVER_PID)"
echo

# ==========================================================================
# 1. GET /health -> 200
# ==========================================================================
echo "--- health ---"
code=$(curl_code GET /health)
assert_eq 200 "$code" "GET /health -> 200"
assert_eq ok "$(jqpy "d['status']")" "GET /health body status=ok"

# ==========================================================================
# 2. GET /api/content -> 200 with required arrays; services > 0
# ==========================================================================
echo "--- content (public read) ---"
code=$(curl_code GET /api/content)
assert_eq 200 "$code" "GET /api/content -> 200"
missing=$(jqpy "','.join(k for k in ['services','stats','team','partners','contacts'] if not isinstance(d.get(k), list))")
if [ -z "$missing" ]; then pass "content has services/stats/team/partners/contacts arrays"
else fail "content has all required arrays" "missing/not-a-list: $missing"; fi
svc_count=$(jqpy "len(d['services'])")
if [ "${svc_count:-0}" -gt 0 ] 2>/dev/null; then pass "services count > 0 (got $svc_count)"
else fail "services count > 0" "got '$svc_count'"; fi

# ==========================================================================
# 3. POST /api/auth/login  — wrong -> 401, correct -> 200 + access_token
# ==========================================================================
echo "--- auth/login ---"
code=$(curl_code POST /api/auth/login --data "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"definitely-wrong-$$\"}")
assert_eq 401 "$code" "login wrong password -> 401"

code=$(curl_code POST /api/auth/login --data "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
assert_eq 200 "$code" "login correct -> 200"
TOKEN="$(jqpy "d['access_token']")"
if [ -n "$TOKEN" ] && [ "$TOKEN" != "None" ]; then pass "login returns access_token"
else fail "login returns access_token" "no token in body"; TOKEN=""; fi

# ==========================================================================
# 4. GET /api/auth/me — with token -> 200, without -> 401
# ==========================================================================
echo "--- auth/me ---"
code=$(curl_code GET /api/auth/me --auth "$TOKEN")
assert_eq 200 "$code" "GET /api/auth/me with token -> 200"
assert_eq "$ADMIN_USERNAME" "$(jqpy "d['username']")" "auth/me returns admin username"
code=$(curl_code GET /api/auth/me)
assert_eq 401 "$code" "GET /api/auth/me without token -> 401"

# ==========================================================================
# 5. POST /api/contact — valid -> 201; invalid variants -> 422
# ==========================================================================
echo "--- contact (submit) ---"
MARK="verify-$$-$(date +%s)"
code=$(curl_code POST /api/contact --data "{\"name\":\"QA Bot $MARK\",\"email\":\"qa+$MARK@example.com\",\"message\":\"hello from verify $MARK\",\"phone\":\"+373 60 123 456\"}")
assert_eq 201 "$code" "POST /api/contact valid -> 201"
SUB_ID="$(jqpy "d['id']")"
[ -n "$SUB_ID" ] && [ "$SUB_ID" != "None" ] && pass "contact returns stored id ($SUB_ID)" || fail "contact returns stored id"

# invalid: bad email
code=$(curl_code POST /api/contact --data '{"name":"X","email":"not-an-email","message":"hi"}')
assert_eq 422 "$code" "POST /api/contact bad email -> 422"
# invalid: empty required name
code=$(curl_code POST /api/contact --data '{"name":"   ","email":"a@b.co","message":"hi"}')
assert_eq 422 "$code" "POST /api/contact empty name -> 422"
# invalid: missing required message
code=$(curl_code POST /api/contact --data '{"name":"X","email":"a@b.co"}')
assert_eq 422 "$code" "POST /api/contact missing message -> 422"
# invalid: oversized message (> 5000 chars)
BIG="$("$VENV_PY" -c "print('a'*6000)")"
code=$(curl_code POST /api/contact --data "{\"name\":\"X\",\"email\":\"a@b.co\",\"message\":\"$BIG\"}")
assert_eq 422 "$code" "POST /api/contact oversized message -> 422"

# ==========================================================================
# 6. GET /api/admin/submissions — with token -> 200 incl. our submission; none -> 401
# ==========================================================================
echo "--- admin/submissions ---"
code=$(curl_code GET /api/admin/submissions)
assert_eq 401 "$code" "GET /api/admin/submissions without token -> 401"
code=$(curl_code GET /api/admin/submissions --auth "$TOKEN")
assert_eq 200 "$code" "GET /api/admin/submissions with token -> 200"
found=$(jqpy "any(s.get('id')=='$SUB_ID' for s in d)")
assert_eq True "$found" "submissions include the just-posted lead"

# ==========================================================================
# 7. XSS: a <script> in a contact message is stored ESCAPED
# ==========================================================================
echo "--- XSS storage (escaping) ---"
XSS_MARK="xss-$$"
code=$(curl_code POST /api/contact --data "{\"name\":\"$XSS_MARK\",\"email\":\"xss+$$@example.com\",\"message\":\"<script>alert('$XSS_MARK')</script>\"}")
assert_eq 201 "$code" "POST /api/contact with <script> -> 201 (accepted, sanitised)"
stored_msg="$(jqpy "d['message']")"
if printf '%s' "$stored_msg" | grep -q '<script>'; then
  fail "stored message contains NO raw <script>" "raw markup leaked: $stored_msg"
else
  pass "stored message is HTML-escaped (no raw <script>)"
fi
# confirm again via the admin submissions read-back
curl_code GET /api/admin/submissions --auth "$TOKEN" >/dev/null
if "$VENV_PY" -c "import json;d=json.load(open('$BODY_FILE'));import sys;sys.exit(0 if any('<script>' in (s.get('message') or '') for s in d) else 1)"; then
  fail "submissions read-back has NO raw <script>" "raw <script> present in listing"
else
  pass "submissions read-back has no raw <script>"
fi

# ==========================================================================
# 8. PUT /api/content round-trip (admin) — change reflected on next GET
# ==========================================================================
echo "--- content (admin write round-trip) ---"
curl_code GET /api/content >/dev/null
MOD_MARK="RTMARK-$$"
MUT="$TMP_DIR/mutated.json"
"$VENV_PY" - "$BODY_FILE" "$MUT" "$MOD_MARK" <<'PY'
import json, sys
src, dst, mark = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src))
if d.get("services"):
    d["services"][0]["name"] = mark
json.dump(d, open(dst, "w"))
PY
# PUT the (large) mutated document from a file — curl_code sends inline data, so
# do the file-based PUT directly here.
code=$(curl -s -o "$BODY_FILE" -w '%{http_code}' -X PUT "$BASE/api/content" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" \
  --data @"$MUT")
assert_eq 200 "$code" "PUT /api/content with token -> 200"
# unauthorised PUT is rejected
code=$(curl -s -o /dev/null -w '%{http_code}' -X PUT "$BASE/api/content" \
  -H 'Content-Type: application/json' --data @"$MUT")
assert_eq 401 "$code" "PUT /api/content without token -> 401"
# read back and confirm the change persisted
curl_code GET /api/content >/dev/null
got_name="$(jqpy "d['services'][0]['name']")"
assert_eq "$MOD_MARK" "$got_name" "GET /api/content reflects the PUT (round-trip)"

# ==========================================================================
# 9. CORS: allowed frontend origin echoed back
# ==========================================================================
echo "--- CORS ---"
acao=$(curl -s -D - -o /dev/null -H "Origin: http://localhost:3000" "$BASE/api/content" \
       | tr -d '\r' | grep -i '^access-control-allow-origin:' | cut -d' ' -f2-)
if [ -n "$acao" ]; then pass "CORS allow-origin present for http://localhost:3000 (='$acao')"
else fail "CORS allow-origin present for http://localhost:3000" "header missing"; fi

# --- summary ---------------------------------------------------------------
echo
echo "=== summary: $(green "$PASS passed"), $([ "$FAIL" -gt 0 ] && red "$FAIL failed" || echo "0 failed") ==="
[ "$FAIL" -eq 0 ] || exit 1
