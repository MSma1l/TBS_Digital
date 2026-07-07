# 07 — Conventions

Rules every contribution in this phase must follow.

## Hard constraints (this phase)

1. **UI only — no backend.** No `fetch`, no API clients, no server actions calling the
   backend, no `NEXT_PUBLIC_API_URL`, no data-fetching libraries. If it talks to a server,
   it does not belong in this phase. (Client-only `localStorage` is allowed — it's the admin's
   stand-in for the future API, see [09 — Admin Panel](./09-admin.md).)
2. **No hardcoded business data.** Content starts as placeholders and is admin-editable.
   See [06 — Placeholder Rules](./06-placeholder-rules.md).
3. **Forms don't submit.** The contact form renders and validates client-side only; it does
   not send anywhere. A submit can show a local "thank you" state at most.
4. **Interactive widgets are visual.** The estimator lets you click options and shows the
   admin-set price (or `...` when unset); it does **not** compute a real total.

## Content & data

Two layers, both typed:

- **`lib/content.ts`** — the default/seed content as typed constants (the baseline shape).
- **`lib/siteContent.tsx`** — a client store that layers `localStorage` overrides on those
  defaults and exposes them via `SiteContentProvider` + `useSiteContent()`.

Rules:

- **Editable** content (services + prices, stats, team, partners, contacts) must be read from
  `useSiteContent()`, so admin edits show live. **Static** content (nav links, principles,
  footer service labels, deadlines/features) can import `content.ts` directly.
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

## Language

- **UI copy: Romanian** (matches the design). Keep diacritics correct (ă, â, î, ș, ț).
- **Code, comments, docs, identifiers: English.**

## Git

- Commit in focused, reviewable chunks (e.g. one section per commit).
- Don't commit secrets or `.env`. There is no backend config in this phase anyway.
- Documentation changes go on the `docs/initial-documentation` branch, then merge to `main`.
