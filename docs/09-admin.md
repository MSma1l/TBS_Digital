# 09 — Admin Panel

A PIN-gated panel where the agency edits the site's content. It exists **now** (built in this
repo) as a localStorage-backed stand-in — there is still no backend. Phase 3 replaces the
storage and the auth without touching the section components. See [08 — Roadmap](./08-roadmap.md).

## Where

- **URL:** `/admin-tbs-digital`
- **PIN:** `tbs2026` (constant `ADMIN_PIN` at the top of `app/admin-tbs-digital/page.tsx`).
  Client-side guard only — **not real security**. Change it there; real auth arrives with the
  backend.
- Linked from the navbar's `◆ ADMIN` button (desktop + mobile menu).

## What it edits

Everything that is otherwise placeholder. Every list can be **added to, edited, and removed
from** (each item has a ✕; each group has a "+ Adaugă …" button):

| Group | Fields | Shows on |
|-------|--------|----------|
| Servicii & prețuri | name, price, description | /03 cards **and** /06 estimator |
| Statistici | value, label | /02 stats row |
| Echipă | name, role, bio | /05 team cards |
| Parteneri | name | footer partners row |
| Contact | type (email/phone/other), value | footer contact column |

Notes:
- **Services are one list** shared by the /03 cards and the estimator, so a name/price edit
  can never make the two disagree. An entry flagged `estimatorOnly` (the AI option) appears in
  the estimator but has no card on the grid.
- Blank stat/team entries render as **placeholder** boxes, so leaving them empty is valid.
- A contact's **type** decides its link: `email` → `mailto:`, `phone` → `tel:`, `other` →
  plain text.

## How it works (data flow)

```
lib/content.ts (defaults)
        │
        ▼
lib/siteContent.tsx  ◄──  localStorage ("tbs_site_data")  ◄──  admin: edit + Save
        │                                                        Reset → clears the key
        ▼
SiteContentProvider (in app/layout.tsx)  ──►  useSiteContent()  ──►  sections render
```

- **Save** writes the whole edited draft to `localStorage` under `tbs_site_data`.
  **Reset** removes the key and restores the code defaults.
- The homepage reads through the same store, so edits show **live** (the provider also syncs
  across tabs via the `storage` event). Overrides are **per-browser** — a visitor on another
  device sees the defaults until the backend exists.
- Because every list is add/remove-able, a saved list **fully replaces** its default (a
  missing key falls back to defaults). See `mergeSiteData` in `lib/siteContent.tsx`.

## Routing

The admin lives **outside** the public site's chrome. `app/` uses a route group:

- `app/layout.tsx` — `<html>`, fonts, and the `SiteContentProvider` (wraps everything).
- `app/(site)/` — the marketing chrome (StatusBar, Navbar, Footer, ScrollProgress) + the
  landing page. The `(site)` group adds **no** URL segment.
- `app/admin-tbs-digital/` — the panel, with no marketing chrome.

## Swapping in the backend (Phase 3)

Only two things change; the admin UI and the sections stay as-is:

1. Replace the `localStorage` load/save inside `lib/siteContent.tsx` with API calls.
2. Replace the PIN gate with real authentication.
