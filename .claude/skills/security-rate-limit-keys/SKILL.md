---
name: security-rate-limit-keys
description: Derive the REAL client IP behind a reverse proxy so per-IP rate limits can't be bypassed — X-Forwarded-For is client-controlled, so trust the Nth-from-right hop (trusted_proxy_count), never the left-most. Also per-route body-size caps and streaming body guards. Use when a rate limiter keys on IP, when the app sits behind nginx/a load balancer, or when the user asks about "X-Forwarded-For / IP real / proxy / rate limit bypass / body size / client IP".
---

# Real client IP & body guards behind a proxy

A per-IP rate limit is only as good as the IP it keys on. If you take a **client-controlled**
value, the attacker mints a fresh bucket per request and every limit (login, contact, upload) is
defeated. This complements [[security-rate-limiting]] (the limits themselves).

## The X-Forwarded-For trap (this is a CRITIC-class mistake)
- `X-Forwarded-For` is a request header the **client can set to anything**. A proxy like nginx
  with `$proxy_add_x_forwarded_for` **appends** the peer it saw, so the chain becomes:
  `<whatever the client sent…>, <real client as the proxy saw it>`.
- The **left-most** entry is attacker-controlled. Taking it (the naive default) lets an attacker
  send `X-Forwarded-For: <random>` on every request and rotate through infinite buckets.
- **Trust only the entry your trusted proxy vouched for: the Nth-from-the-RIGHT**, where N =
  number of trusted proxies in front (`trusted_proxy_count`). With one nginx, that's the
  right-most entry. With `count = 0` (no proxy), ignore the header entirely and use the socket
  peer.

```python
def _client_ip(request) -> str:
    hops = settings.trusted_proxy_count
    if hops > 0:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            if len(parts) >= hops:
                return parts[-hops]          # Nth from the RIGHT — proxy-vouched
    return get_remote_address(request)       # socket peer
```

- `trusted_proxy_count` must match your **actual** topology. Too low → you trust a client hop
  (bypass). Too high → everyone collapses to the proxy's own IP (one shared bucket, easy DoS).
- Set this proxy count in config, and in production make the guard require it to be sane
  ([[security-prod-config-guard]]).

## Per-route body-size caps (streaming, not Content-Length)
- A `Content-Length`-only check is bypassable with chunked transfer / no length header. Use a
  streaming ASGI/middleware guard that **buffers with a hard ceiling and returns 413 the instant
  it's crossed**, regardless of the declared length, then replays the buffered body downstream.
- Cap **per route**: tight default (e.g. 1 MB) for JSON endpoints, a higher ceiling only for the
  one route that legitimately takes a large body (image upload). Register it so it also stamps
  error responses.
- Mirror the cap at the edge (`client_max_body_size` per `location` in nginx) so an oversized
  request gets 413 at the proxy without traversing to the app — but the edge cap must not be
  **lower** than the app's upload route, or it 413s legitimate uploads.

## Anti-patterns
- Keying the limiter on `get_remote_address` when behind a proxy (everyone shares the proxy IP),
  OR trusting the left-most XFF (attacker controls it). Disabling the limiter in prod. A
  body-size check that reads only `Content-Length`. An edge cap tighter than the app's real max.

## Verify (regression-test shapes)
- `key("<spoof>, <real>")` (1 hop) → `<real>`; prepending more attacker hops still resolves to
  the same real client. `count=0` → socket peer, header ignored.
- Body over the route's cap (with AND without a truthful Content-Length / chunked) → **413**.
- Nth login/contact request from one real IP → **429**, and spoofing XFF does **not** reset it.

Related: [[security-rate-limiting]], [[security-prod-config-guard]], [[security-file-upload]],
[[security-pentest]].
