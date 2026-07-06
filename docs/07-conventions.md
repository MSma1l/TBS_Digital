# 07 — Conventions

Rules every contribution in this phase must follow.

## Hard constraints (this phase)

1. **UI only — no backend.** No `fetch`, no API clients, no server actions calling the
   backend, no `NEXT_PUBLIC_API_URL`, no data-fetching libraries. If it talks to a server,
   it does not belong in this phase.
2. **No hardcoded business data.** Stats, portfolio projects, team members, and prices are
   placeholders. See [06 — Placeholder Rules](./06-placeholder-rules.md).
3. **Forms don't submit.** The contact form renders and validates client-side only; it does
   not send anywhere. A submit can show a local "thank you" state at most.
4. **Interactive widgets are visual.** The estimator lets you click options but does **not**
   compute a real price — prices show `...`.

## Content & data

- All placeholder content lives in **`lib/content.ts`** as typed constants. Sections import
  from there; they never inline business data. This makes the later swap to API data a
  one-file change per section.
- Keep the data **shape** realistic (arrays of typed objects) even while values are stubs,
  so the backend contract is easy to match later.

## Styling

- Use the design tokens from [04 — Design System](./04-design-system.md) via CSS variables.
  Never paste raw hex codes into components.
- Reuse the `.disp` (display) and `.mono` typographic classes; don't reinvent them.
- Respect `prefers-reduced-motion` for animations.

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
