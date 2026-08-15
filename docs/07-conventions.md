# 07 — Conventions

Coding rules every contribution follows.

> **Note:** the original "UI-only, no backend" constraints below are **historical** — the app
> is now wired to the FastAPI + DB backend (see [08 — Roadmap](./08-roadmap.md) Phase 3b–3d).
> They are kept to explain the architecture's content/data boundary. The current rules are:
> content flows through the API via `lib/api.ts` + `lib/siteContent.tsx`; the contact form and
> admin **do** submit to the server; all input is validated on both layers
> ([11 — Security](./11-security.md)).

## Original constraints (UI-only phase — superseded)

1. ~~**UI only — no backend.**~~ The UI now fetches via `NEXT_PUBLIC_API_URL`; `localStorage`
   remains only as an offline cache/fallback in `siteContent.tsx`.
2. **No hardcoded business data.** Content starts as placeholders and is admin-editable.
   See [06 — Placeholder Rules](./06-placeholder-rules.md). *(Still current.)*
3. ~~**Forms don't submit.**~~ The contact form now `POST`s to `/api/contact` (validated).
4. **Interactive widgets are visual.** The estimator shows the admin-set price (or `...` when
   unset); it does **not** compute a real total. *(Still current.)*

## Content & data

Two layers, both typed:

- **`lib/content.ts`** — the default/seed content as typed constants (the baseline shape).
- **`lib/siteContent.tsx`** — a client store that layers `localStorage` overrides on those
  defaults and exposes them via `SiteContentProvider` + `useSiteContent()`.

Rules:

- **Editable** content (services + prices, stats, team, projects, partners, contacts) must be
  read from `useSiteContent()`, so admin edits show live. **Static** content (nav links,
  principles, footer service labels, deadlines/features) can import `content.ts` directly.
- Never inline business data in a component.
- Keep the data **shape** realistic (arrays of typed objects) so the backend contract is easy
  to match later. Every editable list is add/remove-able, so a saved list fully replaces its
  default — don't rely on merging saved data onto defaults by index/id.

## Styling

- Use the design tokens from [04 — Design System](./04-design-system.md) via CSS variables.
  Never paste raw hex codes into components.
- Reuse the `.disp` (display) and `.mono` typographic classes; don't reinvent them.
- Respect `prefers-reduced-motion` for animations.
- **Keyframes used by a `*.module.css` must be defined in that same file** — a global-only
  keyframe silently no-ops when referenced from a module. See the gotcha in
  [04 — Design System](./04-design-system.md).

## Components

- **One section = one component**, presentational, in `components/sections/`.
- Extract repeated bits (section label, mono tag, reveal wrapper) into `components/ui/`.
- Keep components typed (TypeScript); avoid `any`.

## Language & i18n

- **Romanian is the source UI language** (matches the design) and the fallback for RU/EN.
  Keep diacritics correct (ă, â, î, ș, ț).
- **Never hardcode visitor-facing copy in a component.** It is either:
  - a **catalog key** — add it to `lib/i18n/messages/ro.ts` (which types the catalog) *and*
    to `ru.ts` + `en.ts`, then read it with `const t = useT(); t("key")`; or
  - a **localized content field** — `{ ro, ru, en }` (`LocalizedText`), seeded with
    `locFromCatalog()` / `locRo()` and rendered through `const l = useLoc(); l(field)`.
- **Code, comments, docs, identifiers: English.**

Details and gotchas: [16 — i18n & SEO](./16-i18n-seo.md).

## Git & change tracking

- Commit in focused, reviewable chunks (e.g. one section per commit).
- **Every commit that changes behaviour adds an entry to [`CHANGELOG.md`](../CHANGELOG.md)**
  — the project's change zone — and updates the doc in `docs/` that covers the area. A
  behaviour change with no doc update is an unfinished change. The rule is restated for
  agents in [`AGENTS.md`](../AGENTS.md).
- A new public page must be added to `app/sitemap.ts`; a new doc must be added to the table
  in `README.md`.
- Don't commit secrets or `.env` (the `.env.example` templates *are* tracked, on purpose).
