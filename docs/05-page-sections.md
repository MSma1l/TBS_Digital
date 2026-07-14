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

Heading + subtitle, then a card per delivered project: a **rotating gallery** of
screenshots (they cross-fade every few seconds, pause on hover, and open full-screen in a
lightbox on click), the category chip, name, description, a link to the live product, and
the mobile **download buttons**. A store button only appears once its link is set, and the
visitor is offered the one that matches their device — App Store on iOS, Google Play on
Android, both on desktop (`components/ui/usePlatform.ts`).

Real content: BizCheck, Itara Global, DocuSafe, CGAM, IQ Arena, Fayr Family. Note that
**CGAM and IQ Arena are two different projects** — CGAM is the academy's web platform
(cgam.md); IQ Arena is the mobile negotiation game, which is why it carries the store
buttons and no website link.

Screenshots live in `public/projects/`. A project with no screenshots yet renders an
"ÎN CURÂND" placeholder rather than collapsing. Fully editable from the admin's
**Proiecte** tab, gallery included — see [09 — Admin](./09-admin.md).

## /05 — Team ("Oamenii din spatele codului")

Left: heading + a `SYSTEM_STATUS` panel with progress bars. Right: team member cards
(initials avatar, name, role, bio).
→ Team cards become **placeholders** (one box is fine). The `SYSTEM_STATUS` numbers are
also hardcoded stats — treat them under the same placeholder rule (see rules doc).

## /06 — Partners ("Partenerii noștri")

Heading + lead, a strip of partner logo cards (logo, name, link to the partner's own
site), then a "Devino partener" call-to-action panel that mails `office@crowe-tm.md`.
Each card also carries a **preview screenshot of the partner's site**: it fades in behind
the logo on hover (desktop) and is simply shown from the start on touch devices, where no
hover exists.
Real content, not placeholders: Crowe Turcan Mikhailenko, CGAM Business Academy and
Ivan Turcan. Logos are monochrome-white PNGs on transparent backgrounds (the section
renders on the dark background) and live in `public/partners/`.

Fully editable from the admin's **Parteneri** tab, including uploading a new logo —
see [09 — Admin](./09-admin.md).

## /07 — Estimator + Contact ("Estimează prețul")

- **Estimator:** three groups — `01 · TIP DE PROIECT`, `02 · TERMEN LIMITĂ`,
  `03 · OPȚIUNI SUPLIMENTARE` — plus an estimated-price total.
  → **Keep all the option buttons; replace every price with `...`** (see rules doc).
- **Contact form:** name, email, phone, message + submit. Present visually; **no submission
  logic** in this phase (UI-only) — see [07 — Conventions](./07-conventions.md).

## Footer

Partners row (the same partners as /06, rendered as chips that link to their sites),
navigation/services/contact columns, socials, copyright, and the `> ACCESS GRANTED_`
striped marquee.

## Admin panel (future)

The prototype includes a slide-in admin panel (PIN-gated price editor saving to
`localStorage`). In this project the admin becomes its **own page**, built later and wired
to the backend by a colleague — **not implemented in this phase**. See [08 — Roadmap](./08-roadmap.md).
