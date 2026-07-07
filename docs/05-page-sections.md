# 05 — Page Sections

The landing page is a single scroll, top to bottom. Sections carry a mono index label
(`/01`, `/02`, …). Below is each section, its purpose, and its content status in this phase.

> For the exact removals/stubs, see [06 — Placeholder Rules](./06-placeholder-rules.md).

## Top status bar

`SYS_TIME` live clock + `> ACCESS GRANTED · TBS_DIGITAL`. Decorative — **keep as-is**.

## Navbar

Logo `TBS_`, links: SERVICII · LUCRĂRI · ECHIPĂ · DESPRE, an `◆ ADMIN` button, and a
`START PROIECT ↗` CTA. Mobile: hamburger → full-screen menu. The ADMIN button will later
open the future admin page; for now it can be a placeholder/no-op link to `/admin`.

## /01 — Hero

Badge, giant `TBS DIGITAL` display title, tagline, two CTAs, and the animated HUD emblem
with orbiting dots and X/Y/Z coordinate readout. Copy is brand-generic — **keep**.

## /02 — Principles ("Principiile noastre")

- **Principles grid** (5 cells): Strategie întâi · Sisteme conectate · Estetică digitală ·
  Rezultate reale · IA aplicată. **Keep.**
- **Stats row** (4 boxes): originally `50+ / 8+ / 30+ / 24/7`. → **Blank placeholder boxes**
  (values/labels removed; see rules doc).

## /03 — Services ("Servicii de digitalizare")

Grid of service cards (icon, name, description). Original has 11.
→ **Remove the "Automatizare cu IA" card** (see rules doc).

## /04 — Selected Work ("Proiecte pe care le-am creat")

Heading + subtitle, then portfolio cards (thumbnail, code, name, tag, description).
→ **Placeholder cards only** — no names, tags, codes, or descriptions (see rules doc).

## /05 — Team ("Oamenii din spatele codului")

Left: heading + a `SYSTEM_STATUS` panel with progress bars. Right: team member cards
(initials avatar, name, role, bio).
→ Team cards become **placeholders** (one box is fine). The `SYSTEM_STATUS` numbers are
also hardcoded stats — treat them under the same placeholder rule (see rules doc).

## /06 — Estimator + Contact ("Estimează prețul")

- **Estimator:** three groups — `01 · TIP DE PROIECT`, `02 · TERMEN LIMITĂ`,
  `03 · OPȚIUNI SUPLIMENTARE` — plus an estimated-price total.
  → **Keep all the option buttons; replace every price with `...`** (see rules doc).
- **Contact form:** name, email, phone, message + submit. Present visually; **no submission
  logic** in this phase (UI-only) — see [07 — Conventions](./07-conventions.md).

## Footer

Partners row (`PARTENER_01…05`), navigation/services/contact columns, socials, copyright,
and the `> ACCESS GRANTED_` striped marquee. Generic — **keep**; partner names stay as
placeholders.

## Admin panel (future)

The prototype includes a slide-in admin panel (PIN-gated price editor saving to
`localStorage`). In this project the admin becomes its **own page**, built later and wired
to the backend by a colleague — **not implemented in this phase**. See [08 — Roadmap](./08-roadmap.md).
