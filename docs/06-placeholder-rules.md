# 06 — Placeholder Rules

The single source of truth for **what content to remove or stub out** in the UI. Everything
listed here is data that a future admin page will manage and the backend will provide, so we
must **not** ship hardcoded business values.

General rule: **no hardcoded stats, names, project titles/types, team members, or prices.**
Where content is removed, leave the visual container (box/card) as an empty placeholder so
layout and styling stay intact and the admin can populate it later.

## Rule 1 — /02 Stats row → placeholders

Section: **Principles** (`/02`), the four stat boxes.

- Original: `50+ PROIECTE LIVRATE`, `8+ ANI EXPERIENȚĂ`, `30+ CLIENȚI`, `24/7 AUTOMATIZĂRI`.
- **Removed the values and labels entirely — the four boxes are now blank.**
  Content lives in `statPlaceholders` (ids only) and each box has a `min-height`
  so it keeps its proportions.
- Keep the boxes and their styling; the values/labels come from the admin later.

## Rule 2 — /03 Services → remove "Automatizare cu IA"

Section: **Services** (`/03`).

- **No "Automatizare cu IA" card on the /03 grid.** It stays as an estimator option only.
- Implementation: services and the estimator now share **one list** (`services` in
  `content.ts`). The AI entry is flagged `estimatorOnly`, so the /03 grid filters it out
  (10 cards) while the estimator keeps it (11 options). See Rule 5 and
  [03 — Architecture](./03-architecture.md).

## Rule 3 — /04 Selected Work → placeholder cards

Section: **Selected Work** (`/04`).

- Keep the section heading and subtitle.
- **Render placeholder project cards with no content** — no names, no tags, no `CODE_`
  labels, no descriptions. Just the empty card/thumbnail shells.
- Remove the "* proiecte demonstrative…" footnote (it references demo content).

## Rule 4 — /05 Team → placeholder card(s)

Section: **Team** (`/05`).

- **Replace the team members with placeholder cards** — no names, roles, bios, or real
  initials.
- **One placeholder box is acceptable** instead of four.
- The `SYSTEM_STATUS` panel values (`50+`, `98%`, `24/7`, `ONLINE`) are hardcoded stats —
  apply Rule 1's spirit: stub them as placeholders rather than shipping real numbers.

## Rule 5 — /06 Estimator → keep options, prices become `...`

Section: **Estimator** (`/06`).

- **Keep all the selectable options** in all three groups: project type, deadline, and
  extra options.
- **Replace every price with `...`**, specifically:
  - The per-option `de la €XXX` labels under each project type → `...`
  - The big estimated total (`€800 – €1.100`) → `...`
  - Any price shown attached to the contact form's "estimate" note → `...`
- The estimator does **not** compute a real number in this phase; pricing logic and values
  come from the admin/backend later.
- Prices live on the shared `services` list (one `price` per service), so the estimator's
  option names and the /03 cards can never drift apart — the admin edits them together.

## Anything else

Contact info, partner names, and similar are already generic placeholders in the design —
leave them as neutral placeholders. If in doubt whether a value is "real business data,"
treat it as a placeholder.
