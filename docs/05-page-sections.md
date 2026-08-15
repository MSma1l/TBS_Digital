# 05 — Page Sections

The landing page is a single scroll, top to bottom. Sections carry a mono index label
(`/01`, `/02`, …). Below is each section, its purpose, and where its content comes from.

> Order in `app/(site)/page.tsx`: Hero · Principles · **CTA** · Services · **CTA** · Work ·
> **CTA** · Team · **CTA** · Partners · Estimator. All visitor-facing copy is localized —
> see [16 — i18n & SEO](./16-i18n-seo.md). For what is still a stub, see
> [06 — Placeholder Rules](./06-placeholder-rules.md).

## Top status bar

`SYS_TIME` live clock + `> ACCESS GRANTED · TBS_DIGITAL`. Decorative — **keep as-is**.

## Navbar

Logo `TBS_`, links: SERVICII · LUCRĂRI · ECHIPĂ · DESPRE, the **RO/RU/EN language
switcher**, and a `START PROIECT ↗` CTA. Mobile: hamburger → full-screen menu (switcher
included).

> The navbar deliberately carries **no link to the admin panel** — a button here would
> publish `/admin-tbs-digital` in the markup of every page. The admin types the URL.

## Between sections — `SectionCTA`

A short "let's work together" panel repeated after Principles, Services, Work and Team, so a
visitor can start a conversation wherever they stop reading (design review, 2026-07-15). It
scrolls to the contact/estimator section; the `hue` prop varies the accent so consecutive
CTAs don't look identical. Partners ends with its own "become a partner" panel and the
estimator *is* the contact form, so there is no CTA between those two.

## /01 — Hero

Badge, giant `TBS DIGITAL` display title, the UTP line (reworked in the 2026-07-15 design
pass), two CTAs, and the animated HUD emblem with orbiting dots and X/Y/Z coordinate
readout. Copy comes from the message catalog.

## /02 — Principles ("Principiile noastre")

- **Principles grid** (5 cells): Strategie întâi · Sisteme conectate · Estetică digitală ·
  Rezultate reale · IA aplicată. **Keep.**
- **Stats row** (4 boxes): originally `50+ / 8+ / 30+ / 24/7`. → **Blank placeholder boxes**
  (values/labels removed; see rules doc).

## /03 — Services ("Servicii de digitalizare")

Grid of service cards (icon, name, description), fed by `lib/content.ts` → the store, so the
admin edits names, descriptions and prices in all three languages. A service marked
`estimatorOnly` (currently "Automatizare cu IA") appears in the estimator but has **no card**
here. Card labels `/01`, `/02`… are computed from position, so adding or removing a service
renumbers automatically.

**Clicking a card jumps to the estimator with that service pre-selected**
(`lib/estimatorBridge.ts`). On mobile the grid is an auto-rolling scroll-snap carousel
(`useAutoCarousel`).

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
(initials avatar, name, role, bio, social links).

Real content: **Maxim, Danu, Laurentiu** — first names only, by request. Editable from the
admin's **Echipă** tab. On mobile the cards drop to a single column so the third member
isn't stranded alone on a row. The `SYSTEM_STATUS` numbers remain decorative placeholders
(see the rules doc).

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
  `03 · OPȚIUNI SUPLIMENTARE` — plus an estimated-price total. Prices come from the admin;
  an unset price renders `...` (see rules doc). Arriving from a service card pre-selects
  that project type.
- **Contact form:** name, email, phone, message + submit. It **does** submit —
  `POST /api/contact`, validated client-side by `lib/validation.ts` and authoritatively by
  the backend, then pushed to the Telegram lead bot
  ([13 — Telegram Bot](./13-telegram.md)).

## Footer

Partners row (the same partners as /06, rendered as chips that link to their sites),
navigation/services/contact columns, socials, copyright, and the `> ACCESS GRANTED_`
striped marquee.

## Cookie-consent banner

Bottom of the viewport until the visitor chooses: **Accept** allows the analytics pixel,
**Doar esențiale** rejects it (Escape does the same). Links to `/cookies` and
`/confidentialitate`. Nothing tracking loads before a choice — see
[16 — i18n & SEO](./16-i18n-seo.md).

## Legal pages

`/confidentialitate` and `/cookies` — outside the landing scroll, same chrome, linked from
the footer and the consent banner.

## Admin panel

Built and live at `/admin-tbs-digital` — a login-gated, tabbed editor backed by the API.
See [09 — Admin Panel](./09-admin.md).
