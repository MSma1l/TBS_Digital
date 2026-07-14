# 09 — Admin Panel

A **login-gated, tabbed** panel where the agency edits the site's content and reads incoming
requests. It is now backed by the **FastAPI API + database** (no more localStorage stand-in for
the source of truth). See [08 — Roadmap](./08-roadmap.md) and [10 — Backend](./10-backend.md).

## Where

- **URL:** `/admin-tbs-digital`
- **Login:** real username/password (`POST /api/auth/login`). Credentials are the seeded admin
  user (`ADMIN_USERNAME` / `ADMIN_PASSWORD`, bcrypt-hashed in the DB). The returned JWT is
  stored under `tbs_admin_token`, validated via `GET /api/auth/me` on load, cleared on logout
  or any 401. **No more `tbs2026` PIN.**
- Linked from the navbar's `◆ ADMIN` button (desktop + mobile menu).

## Layout — tabs

The authenticated view is organized into tabs across the top; selecting a tab shows only that
section. Order (the **Cereri** tab is first and is the default on open):

| Tab | What | Source |
|-----|------|--------|
| **Cereri** (first) | Contact-form submissions, newest-first, with a **count badge**, name/email/phone/message + project/estimate + timestamp, and a Refresh button. Read-only. | `GET /api/admin/submissions` |
| Servicii & prețuri | name, price, description → /03 cards **and** /06 estimator | content API |
| Statistici | value, label → /02 stats row | content API |
| Echipă | name, role, bio → /05 team cards | content API |
| Proiecte | name, category, description, project link, App Store / Google Play links, and a gallery of screenshots (upload, reorder, remove) → /04 project cards | content API + `POST /api/admin/uploads` |
| Parteneri | name, site URL, logo, site preview (both uploadable) → /06 partners strip **and** the footer partners row | content API + `POST /api/admin/uploads` |
| Contact | type (email/phone/other), value → footer contact column | content API |

Landing on **Cereri** means the agency immediately sees whether a new request came in.

## Editing & validation

Every editable list can be **added to, edited, and removed from** (each item has a ✕; each
group has a "+ Adaugă …" button). **Save** does `PUT /api/content` with the bearer token;
a 401 sends back to login. Every field is validated client-side (length caps, email/phone
format, script/HTML blocked) via `lib/validation.ts`, mirroring the backend — Save is disabled
while any field is invalid. The backend re-validates authoritatively (see
[11 — Security](./11-security.md)).

Notes:
- **Services are one list** shared by the /03 cards and the estimator, so a name/price edit
  can never make the two disagree. An entry flagged `estimatorOnly` (the AI option) appears in
  the estimator but has no card on the grid.
- Blank stat/team entries render as **placeholder** boxes, so leaving them empty is valid.
- A contact's **type** decides its link: `email` → `mailto:`, `phone` → `tel:`, `other` →
  plain text.

## How it works (data flow)

```
backend DB  ◄── PUT /api/content (bearer) ◄── admin: edit + Save
    │
    ▼
GET /api/content  ──►  lib/api.ts  ──►  lib/siteContent.tsx  ──►  useSiteContent()  ──► sections
                                              ▲
                                localStorage ("tbs_site_data") = offline cache/fallback only
```

- **Source of truth is the database.** `siteContent.tsx` renders defaults on the server + first
  paint (no hydration mismatch), then loads `GET /api/content` and swaps it in, caching the
  result to `localStorage` for offline resilience. If the API is unreachable, the cache (or the
  code defaults) keeps the site working.
- **Save** does `PUT /api/content` with the bearer token and refreshes the cache. Content is now
  **live for every visitor**, not per-browser.
- The `useSiteContent()` hook signature is unchanged, so the section components did not change.

## Routing

The admin lives **outside** the public site's chrome. `app/` uses a route group:

- `app/layout.tsx` — `<html>`, fonts, and the `SiteContentProvider` (wraps everything).
- `app/(site)/` — the marketing chrome (StatusBar, Navbar, Footer, ScrollProgress) + the
  landing page. The `(site)` group adds **no** URL segment.
- `app/admin-tbs-digital/` — the panel, with no marketing chrome.

## Frontend ↔ backend seam (implemented)

The integration touched exactly the store + auth, as designed — the section components are
untouched:

1. `lib/api.ts` — typed API client (`fetchContent`, `saveContent`, `submitContact`, `login`,
   `fetchMe`, `fetchSubmissions`, token helpers) using `NEXT_PUBLIC_API_URL`.
2. `lib/siteContent.tsx` — loads from the API with a localStorage fallback.
3. `app/admin-tbs-digital/page.tsx` — real login replaces the PIN; tabs + Cereri added.
