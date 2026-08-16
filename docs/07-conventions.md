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

### The global UI rule

**The header and every page are one interface, not a set of pages that happen to share a
logo.** A visitor moving from the home page to a direction page to the admin login should not
be able to tell that different work went into them. Concretely, everything below comes from
[04 — Design System](./04-design-system.md) and nowhere else:

| Must be identical everywhere | Token family |
|------------------------------|--------------|
| Font families | `--font-display-stack` · `--font-mono-stack` · `--font-body-stack` |
| Type sizes and weights | `--fs-*` · `--fw-*` |
| Colours, on every surface | `--bg` `--panel` `--txt` `--mut` `--line` `--red` … and `--ink*` for inverted blocks |
| Spacing and rhythm | `--sp-1` … `--sp-9` |
| Corner radii | `--r-sm` … `--r-2xl`, `--r-pill` |
| Elevation | `--sh-sm/md/lg`, `--sh-red`, `--sh-red-strong` |
| The brand gradient | `--grad-red` |

The rule in one line: **no colour, font, size, spacing, radius or shadow may be introduced
locally in a single page or component.** If what you need doesn't exist yet, add a *global
token* and use it — never copy a value into a module because it's faster.

Why it's written this way and not as "try to be consistent": the site had six near-identical
navies, the red CTA gradient pasted into six modules, and a footer that used no tokens at all.
Every one of those started as one reasonable local decision.

**When a value genuinely doesn't fit the scale** — a one-off `13px` radius, a size between two
steps — don't silently round it to the nearest token, because that moves the design. Either
add a token for it, or leave the literal and say why in a comment. A rounded value is a visual
change disguised as a cleanup.

**Exception, and the only one:** `app/opengraph-image.tsx` uses a literal `sans-serif`.
`ImageResponse` renders outside the browser and cannot read CSS variables. It is commented as
such at the top of the file.

### The rest

- Reuse the `.disp` (display) and `.mono` typographic classes; don't reinvent them.
- Respect `prefers-reduced-motion` for animations.
- **Keyframes used by a `*.module.css` must be defined in that same file** — a global-only
  keyframe silently no-ops when referenced from a module. See the gotcha in
  [04 — Design System](./04-design-system.md).
- Breakpoints for new code: **640px** (phone), **860px** (nav burger / tablet), **1024px**
  (small desktop). CSS cannot read a custom property inside a media query, so these are a
  convention, not a token. Older modules still carry a few other thresholds — leave them;
  changing a breakpoint changes a layout that was signed off.

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
