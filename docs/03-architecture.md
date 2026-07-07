# 03 — Architecture

## Principle

The landing page is one route composed of independent **section components**. Each section
is presentational and receives its content from **local placeholder data** (a typed constant
in the repo), never from the network. This keeps the door open to later swap the placeholder
source for an API response without touching the markup.

## Proposed folder structure

```
/
├─ app/
│  ├─ layout.tsx           # Root layout: fonts, <html>, global CSS, SiteContentProvider
│  ├─ globals.css          # Design tokens (CSS variables) + base styles + keyframes
│  ├─ (site)/              # Route group for the public site (no URL segment)
│  │  ├─ layout.tsx        # Marketing chrome: ScrollProgress, StatusBar, Navbar, Footer
│  │  └─ page.tsx          # Landing page — composes the section components in order
│  └─ admin-tbs-digital/   # Admin panel route (outside the (site) chrome)
│     ├─ page.tsx          # PIN gate + content editor
│     └─ admin.module.css
│
├─ components/
│  ├─ layout/
│  │  ├─ StatusBar.tsx     # Top "SYS_TIME / ACCESS GRANTED" bar (with live clock)
│  │  ├─ Navbar.tsx        # Sticky nav + mobile menu (links to /admin-tbs-digital)
│  │  └─ Footer.tsx        # Footer + partners + "ACCESS GRANTED" marquee
│  ├─ sections/
│  │  ├─ Hero.tsx + HeroEmblem.tsx   # /01 hero (emblem is the interactive client part)
│  │  ├─ Principles.tsx    # /02 principles grid + stats row (stats from the store)
│  │  ├─ Services.tsx      # /03 service cards (from the store)
│  │  ├─ Work.tsx          # /04 portfolio (placeholder cards)
│  │  ├─ Team.tsx          # /05 team (from the store) + system-status panel
│  │  └─ Estimator.tsx     # /06 price estimator + contact form (prices from the store)
│  └─ ui/                  # Small shared pieces (SectionLabel, Reveal, ScrollProgress…)
│
├─ lib/
│  ├─ content.ts           # Typed default content for every section (single source)
│  └─ siteContent.tsx      # Client store: defaults + localStorage overrides + provider/hook
│
├─ public/                 # Static assets
└─ docs/                   # This documentation
```

> Structure is a starting point — adjust names as the build proceeds, but keep the
> **section-per-component** and **content boundary** (`content.ts` defaults, `siteContent`
> for anything the admin can edit).

## Routing

- `/` — the landing page (all sections). The only public page in this phase.
- `/admin-tbs-digital` — the admin panel (PIN-gated). Edits the content the site reads.
  See [08 — Roadmap](./08-roadmap.md).

## Data flow (this phase)

```
lib/content.ts (defaults)
        │
        ▼
lib/siteContent.tsx  ◄──  localStorage overrides  ◄──  admin panel (edits + saves)
        │
        ▼
section component  ──►  rendered UI
```

Editable content flows through the `siteContent` store, so admin edits show live on the
homepage. Every list — **services (+ prices), stats, team, partners, contacts** — is
add/remove-able, so a saved list fully replaces its default (see `mergeSiteData`). Still **no
`fetch`, no server actions, no API URLs** — localStorage is a client-only stand-in. When the
backend arrives, it replaces the localStorage load/save inside `siteContent` and the admin's
auth — the sections stay unchanged. See [07 — Conventions](./07-conventions.md).
