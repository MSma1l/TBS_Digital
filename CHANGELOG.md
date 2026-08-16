# Changelog — TBS Digital

**This file is the project's change zone.** Every change to the app — feature, fix, design
tweak, security hardening, dependency, deploy config — gets an entry here, in the same
commit that makes the change. Nothing ships undocumented.

- **Newest first.** Dates are `YYYY-MM-DD`.
- Each entry: what changed · why · which files/areas · the commit hash.
- Categories: `Added` · `Changed` · `Fixed` · `Security` · `Docs` · `Deploy` · `Removed`.
- If a change also alters how the app *works*, update the matching doc in [`docs/`](./docs)
  **and** link it from the entry. The changelog is the index; `docs/` is the explanation.
- Rule of thumb: if a colleague would need to know it a month from now, it belongs here.

> The workflow rule that enforces this lives in [`AGENTS.md`](./AGENTS.md).
> Documentation map: [`README.md`](./README.md) · [`docs/`](./docs) · [`SECURITY.md`](./SECURITY.md).

---

## 2026-08-16 — Formularul de contact chiar trimite; portofoliu pe date reale

**Fixed** — cererile de contact se pierdeau în tăcere

- `Estimator.tsx` colecta nume, email, telefon și mesaj, apoi făcea
  `e.preventDefault(); setSent(true)` — și **atât**. Fișierul nici nu importa `lib/api`.
  `submitContact` nu era apelat din nicio componentă a aplicației, deci **nicio cerere trimisă
  din site nu ajungea în baza de date sau la botul de Telegram**, deși vizitatorul vedea
  confirmarea. Backend-ul funcționa; frontend-ul pur și simplu nu-l chema. Asta explică de ce
  în `submissions` existau doar două intrări reale.
- Formularul postează acum pe `POST /api/contact` și trimite **ce a ales efectiv vizitatorul**:
  tipul de proiect, estimarea, opțiunile bifate și **transcriptul dialogului cu asistentul** —
  pe care interfața îl promitea deja explicit („am adăugat conversația în cerere").
- Stările sunt vizibile și anunțate: `Se trimite…`, confirmare cu `role="status"`, eroare cu
  `role="alert"`. Mesaj separat pentru **429** (limita de 10/min a endpoint-ului public), ca
  vizitatorul să știe că trebuie să aștepte, nu că formularul e stricat. Butonul se dezactivează
  în timpul trimiterii și după succes — o cerere nu poate fi depusă de două ori.
- Textul butonului era „Cerere pregătită ✓" / „Request ready ✓" — descria starea locală, nu o
  cerere livrată. Acum e „Cerere trimisă ✓", și e adevărat.

**Fixed** — validarea client-side, pusă la loc

- `lib/validation.ts` există și are 37 de teste care trec, dar **nu era conectat la formular**:
  o rescriere anterioară a estimatorului o scosese, lăsând în urmă testele care o descriau.
  Reconectată, cu mesaje din catalogul i18n (deci trilingve), `aria-invalid` pe câmpul vinovat
  și `noValidate` pe formular — altfel bula nativă a browserului ar fi apărut prima, iar
  mesajele noastre n-ar fi rulat niciodată. Aceleași reguli ca pe server: apărare în adâncime.

**Changed** — portofoliul vine din date reale, metrica se calculează

- Portofoliul avea **trei surse desincronizate**: 10 proiecte hardcodate în `Work.tsx` (ce se
  vedea pe site), 8 în `lib/content.ts` (adminul) și 6 în `backend/app/defaults.py`. `Work.tsx`
  nu citea deloc din admin, deci portofoliul nu era editabil.
- Cele 10 reale au fost migrate în `lib/content.ts` **și** în `defaults.py`, identice, iar
  `Work.tsx` citește acum `useSiteContent().projects`. Design neschimbat. Un proiect fără URL
  randează `<article>`, nu `<a>` fără țintă; unul fără imagine primește fallback-ul de gradient.
  Niciun URL inventat: `docusafe`, `crowe-portal`, `iq-arena`, `statistic` și `flirt` rămân fără
  link, fiindcă nu au unul public.
- `Hero.tsx` afișa `"50+"` hardcodat. Acum numără portofoliul real — **10** — cu eticheta
  „proiecte în portofoliu". **Numărul nu a fost umflat.**

**Changed** — date de contact reale

- `contact@tbsdigital.ro` → **`office@tbs.md`**, în `lib/content.ts`, `defaults.py` și în
  JSON-LD-ul din `app/layout.tsx` (care folosea o a treia adresă, `office@crowe-tm.md`).
- Adăugată adresa **A. Șușev 29** ca al treilea contact (`type: "other"`, deci randat ca text,
  fără href) și ca `streetAddress` în JSON-LD.
- Telefonul rămâne neschimbat, la cererea clientului.

**Fixed** — suita de teste, complet verde

- `vitest.setup.ts` nu avea stub pentru `IntersectionObserver`, iar `components/ui/Reveal.tsx`
  construiește unul la montare: orice secțiune învelită în `<Reveal>` arunca la randare. Fiecare
  fișier de test îl stub-a local sau uita și pica. Acum e global.
- `contact-form.test.tsx` (7 teste) descria un estimator anterior — alte placeholder-e, alt
  payload. Rescris pe comportamentul care se livrează: **13 teste**, inclusiv că un formular
  invalid nu atinge rețeaua, că unul valid pleacă exact o dată, și că un eșec e vizibil fără să
  piardă ce s-a tastat.
- `sections.test.tsx` (2 teste) cerea „ECHIPA" și cele 5 principii din catalog; ambele secțiuni
  fuseseră redesenate deliberat („ECHIPA TBS", 3 carduri de raționament). Aliniate la realitate.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **135 passed / 0 failed** (13 fișiere) — de la 86 passed / 10 failed |
| Backend `pytest` | **188 passed** |
| `npm run build` · `lint` · `tsc --noEmit` | curate |

> Rămâne de dat de client: cele 3 link-uri de social (până atunci `Footer.tsx:54` le filtrează,
> deci nu apar iconițe moarte) și cele 4 statistici, încă goale. Iar `Team.tsx:23-25` mai are
> `"50+"`, `"98%"`, `"24/7"` hardcodate — `50+` contrazice acum numărul real din hero.

## 2026-08-16 — Design tokens, URL-uri `/servicii`, preferințe globale în header

**Added** — regula UI globală + tokenurile care o fac posibilă

- `app/globals.css` a primit scalele care lipseau: spațiere (`--sp-1…9`), radius (`--r-sm…2xl`,
  `--r-pill`), tipografie (`--fs-2xs…2xl`, `--fw-normal…black`), elevație (`--sh-sm/md/lg`),
  `--on-accent` (text pe umplere colorată), `--grad-red` + `--sh-red*` (gradientul roșu de CTA
  era **copiat în 6 module**), și scala `--ink*` pentru blocurile care se inversează intenționat
  (existau **patru** bleumarinuri aproape identice).
- **137 declarații tokenizate în 16 fișiere** `.module.css`, cu regula „valoarea randată rămâne
  identică". Verificat în browser pe build-ul de producție: `.case` `rgb(17,26,49)`, footer
  `rgb(255,255,255)`, gradientul `rgb(255,83,98) → rgb(245,51,63)` — neschimbate.
- Regula e scrisă în [07 — Conventions](./docs/07-conventions.md): nicio culoare, font,
  dimensiune, spațiere, rază sau umbră nu se introduce local; dacă lipsește, se adaugă **token
  global**. Și, explicit: o valoare care nu încape în scală **nu se rotunjește** la treapta
  vecină — rotunjirea e o schimbare vizuală deghizată în curățenie.

**Changed** — paginile de direcții au URL-uri vorbitoare

- `/solutions/<slug-englez>` → `/servicii/<slug-românesc>`: `produs-digital`, `e-commerce`,
  `automatizare-api`, `asistenti-ia`, `brand-ui`. Slug-urile **nu** se traduc — `/`, `/ru` și
  `/en` sunt același path în spatele prefixului de limbă, deci un singur arbore de rute și un
  singur cluster hreflang.
- Vechile adrese erau indexate, deci **301** pentru fiecare, expandat pe toate cele 3 prefixe
  (15 reguli), fiecare aterizând pe **aceeași** limbă. 301, nu `permanent: true` (care emite
  308), fiindcă sunt URL-uri de conținut GET.
- Sitemap, canonical și hreflang actualizate; zero linkuri interne rămase spre `/solutions/`.

**Changed** — preferințele globale, grupate în header

- Selectorul de limbă a devenit `components/ui/PreferencesGroup.tsx`, cu slotul pentru
  comutatorul de temă marcat în cod — când se construiește, intră acolo fără rearanjare, în
  bara desktop și în overlay-ul mobil deopotrivă.

**Fixed**

- `LanguageSwitcher` avea `background: rgba(var(--scrim), .4)` — un negru rămas de la tema
  dark, care picta o cutie întunecată în header-ul alb și cobora contrastul etichetelor sub
  prag. Iar starea activă folosea `color: var(--bg)`, adică **fundalul paginii ca text**. Ambele
  reparate pe tokenuri; focus de tastatură vizibil separat de hover.
- `components/__tests__/navbar.test.tsx` pica pe `main`: itera peste `navLinks` (lista plată
  legacy) în timp ce Navbar randează `navMenu`. Actualizat la navigația reală — **9 teste, toate
  trec**.

**Docs**

- [04 — Design System](./docs/04-design-system.md) documenta încă **paleta veche, dark**, și
  afirma „dark-only by intent" la luni după trecerea pe light. Rescris pe valorile reale, cu
  scalele noi și cu avertismentul că `globals.css` e sursa de adevăr, nu docul.
- [16 — i18n & SEO](./docs/16-i18n-seo.md): secțiune nouă despre `/servicii/<slug>`, de ce
  slug-urile nu se traduc, și regula „redenumești un URL public ⇒ 301 pe fiecare prefix + sitemap".

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` | ✓ compilat, `/servicii/[slug]` prezent, `/solutions/[slug]` dispărut |
| `npm test` | **111 passed** / 9 failed — cele 9 preexistente, numărul **nu** a crescut |
| `npm run lint` · `npx tsc --noEmit` | curate |
| Rute noi × 3 limbi (15) | 200, verificate manual pe build-ul de producție |
| Redirecturi vechi × 3 prefixe | 301, limba păstrată (`/ru/solutions/ai` → `/ru/servicii/asistenti-ia`) |
| Slug inexistent | 404 |
| Sitemap | 25 intrări `servicii`, zero `solutions` |
| `app/__tests__/servicii-routes.test.tsx` | **13 teste noi**, toate trec |

> **Rămâne de făcut, descoperit pe parcurs.** (1) Secțiunile Directions/Work/Principles/Team/
> Estimator/BottomCTA/Footer au **gutter orizontal zero** — la 360px conținutul atinge marginea
> ecranului, în timp ce Hero începe la 14px; reparația e `padding-inline` pe `.container`, dar
> trebuie verificată contra padding dublu în Services/Partners, care folosesc `.section` global.
> (2) `--sh-red*` nu acoperă niciuna dintre cele 10 umbre roșii din cod (3 variante distincte,
> diferențe de 2–5px); redefinite ca `0 12px 24px` / `0 16px 30px` ar acoperi exact 4 fără
> deplasare. (3) Scala de fonturi merită extinsă cu 12/13/15px — mapările la ≤1px ar fi
> redimensionat zeci de elemente simultan, deci au fost lăsate.

## 2026-08-15 — Ștergerea cererilor din admin

**Added**

- Tabul **Cereri** putea doar să listeze — nu exista nicio cale de a scoate o cerere, nici din
  UI, nici din API (curățenia de mai devreme s-a făcut direct în Postgres). Acum există
  `DELETE /api/admin/submissions/{id}`, protejat cu `get_current_admin` ca restul rutelor
  admin: **204** la succes, **404** dacă id-ul nu există.
  Fișiere: `backend/app/routers/contact.py`, `backend/app/storage/base.py` (metodă nouă în
  interfața `ContentStore`), `db_store.py`, `json_store.py` (store-ul de referință, ținut
  instanțiabil), `lib/api.ts`.
- Buton de ștergere pe fiecare cerere, cu **confirmare în doi pași inline**
  (*Sigur? · Confirmă · Anulează*), fără `window.confirm` — ștergerea e permanentă și nu
  există coș de gunoi. La succes rândul dispare fără reîncărcare și badge-ul scade; la eroare
  rândul rămâne cu motivul dedesubt (404 = ștearsă deja de altcineva), iar un 401 duce înapoi
  la login. Fișiere: `app/admin-tbs-digital/page.tsx`, `admin.module.css`.
- Id-ul ajunge la ORM ca parametru legat (`Session.get`), deci un id ostil (path traversal sau
  formă de SQLi) e doar un string care nu se potrivește cu niciun rând — acoperit de test.

**Docs**

- [09 — Admin](./docs/09-admin.md): tabul Cereri nu mai e „read-only"; secțiune nouă
  *Deleting a request* cu fluxul de confirmare și avertismentul că mesajele Telegram ale
  cererilor șterse răspund „Lead inexistent".

**Verificare**

| Check | Rezultat |
|-------|----------|
| Suita backend | **187 passed** (183 → 187, +4 teste) |
| `npm test` | **91 passed** / 10 failed — cele 10 sunt **preexistente** |
| Teste admin (3 fișiere) | **13 passed**, din care 5 noi |
| `npx tsc --noEmit` · `npm run lint` | curate |
| `npm run build` | ✓ compilat, 10 rute |

> ⚠️ Cele **10 teste picate** din `components/__tests__/` (contact-form, navbar, sections) sunt
> **anterioare acestei schimbări** — verificat rulând suita pe HEAD curat, cu modificările puse
> deoparte: 86 passed / 10 failed înainte, 91 passed / 10 failed după. Rămân **de reparat
> separat**; au ajuns în producție nereparate.

## 2026-08-15 — Butoanele de clasificare nu mai dau 429

**Fixed**

- Apăsarea repetată a butoanelor de clasificare umplea log-ul cu
  `editMessageText … 429 Too Many Requests`, iar mesajul din grup nu se mai împrospăta
  vizual. Statusul se salva corect (se scrie în DB **înainte** de edit), deci efectul era
  cosmetic — dar back-off-ul cerut de Telegram creștea până la ~35s.
- **Cauza la sursă:** re-apăsarea butonului deja activ producea un edit cu text
  byte-identic, pe care Telegram îl respinge (*"message is not modified"*) și, în serie
  rapidă, îl penalizează cu 429. `worker._handle_callback` compară acum statusul dinainte
  (`service.status_of`) cu cel de după și **sare peste edit** când nu s-a schimbat nimic;
  toast-ul de confirmare rămâne.
- **Plasa de siguranță:** `telegram/client.py` reîncearcă acum un 429 respectând
  `parameters.retry_after`, dar **doar dacă așteptarea e scurtă** (`MAX_RETRY_AFTER = 3.0`s,
  o singură reîncercare). `run_worker` procesează update-urile **strict secvențial**, deci un
  sleep de 30s ar îngheța și notificările de lead-uri noi, și apăsările altora. Peste plafon
  renunțăm, ca înainte.
- Fișiere: `backend/app/telegram/client.py`, `backend/app/telegram/service.py`
  (`status_of`), `backend/app/telegram/worker.py`,
  `backend/tests/test_telegram_bot.py`.

**Docs**

- [13 — Telegram](./docs/13-telegram.md): secțiunea *Commands & buttons* explică ambele
  comportamente sub apăsare rapidă; rând nou în *Troubleshooting* pentru 429.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `pytest tests/test_telegram_bot.py` | **64 passed** |
| Suita backend completă | **183 passed** |

> Testul parametrizat `test_every_valid_status_button_updates_the_lead` pornea lead-ul de la
> `"nou"` și trecea prin toate statusurile — inclusiv `"nou"`, care acum e un no-op. Acum
> seed-ul e ales să difere de statusul testat, deci fiecare caz rămâne o reclasificare
> reală, iar no-op-ul are testele lui separate.

## 2026-08-15 — Deploy în producție (`tbs.md`) + verificarea botului de notificare

**Deploy**

- `tbs.md` a fost adus de la `e5f387b` la `f56b107` (2 commit-uri: `tsx` ca devDependency și
  update-ul de conținut/secțiuni). Imaginile `tbs-digital-frontend` și `tbs-digital-backend`
  au fost rebuild-uite și containerele recreate cu
  `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`.
  Nginx, DNS și certificatele **nu** au fost atinse.
- `/root/tbs-digital` era o **copie** a proiectului, nu o clonă — fără `.git`, deci `git pull`
  era imposibil. Convertit pe loc în repo git (`origin` = GitHub, branch `main` tracking
  `origin/main`). Verificat înainte de suprascriere că arborele de pe server corespundea
  **exact** commit-ului `e5f387b` (0 fișiere diferite), deci nu s-a pierdut nicio modificare
  făcută direct pe server. Backup: `/root/tbs-digital-backup-20260815-172454.tar.gz`.
  Update-urile viitoare sunt un simplu `git pull` + rebuild — vezi
  [12 — Deployment](./docs/12-deployment.md), secțiunea *Update-uri ulterioare*.

**Docs**

- [12 — Deployment](./docs/12-deployment.md): secțiune nouă *Update-uri ulterioare —
  `git pull` + rebuild*, care separă migrarea inițială (Etapele A/B, o singură dată) de
  procedura de zi cu zi; explică de ce un checkout peste directorul de cod e sigur (DB și
  upload-urile stau în volume Docker *named*, nu în bind-mount-uri) și de ce serverul are
  nevoie de `safe.directory`.
- [13 — Telegram](./docs/13-telegram.md): secțiune nouă *Verificare după deploy* — cele patru
  verificări (getMe · env în container · grup înregistrat în DB · socket long-poll deschis în
  `/proc/net/tcp`) și testul end-to-end. Documentează două capcane de diagnostic:
  lipsa liniilor `Telegram` din `docker logs` **nu** înseamnă bot picat (mesajul de pornire e
  INFO, iar handler-ul implicit Python emite doar WARNING+), iar `getUpdates` e un test
  înșelător (poate întoarce `ok:true` deși worker-ul e viu și, dacă e oprit, îi consumă
  update-urile).

**Verificare** (rulată împotriva producției, după deploy)

| Check | Rezultat |
|-------|----------|
| `docker ps` | `tbs-digital-frontend` up · `tbs-digital-backend` healthy · `db` healthy |
| `shared-network` | ambele containere atașate (proxy-ul le găsește după nume) |
| `https://tbs.md` · `/ru` · `/en` · `www` | **200** toate |
| `https://tbs.md/api/content` | **200** (FastAPI) |
| Rute noi `/solutions/{digital,ecommerce,ai,brand}`, inclusiv `/ru` și `/en` | **200**, cu conținutul nou — dovada că build-ul nou e live (nu existau înainte) |
| `sitemap.xml` · `robots.txt` | **200** |
| `https://docusafe.tbs.md` | **200** — neatins |
| Telegram `getMe` | ok — `@TBS_Notification_Agent_bot` |
| Grup înregistrat | `-1004325337899` („TBS notification", supergrup), bot cu drept de postare |
| Worker long-polling | socket ESTABLISHED către `149.154.166.110:443` |
| **Lead de test** prin `POST /api/contact` | **201**, id `8bcf46d6…`, zero warning-uri Telegram în log |

**Changed** — curățenie în `submissions` (producție)

- Șterse **18** din cele 20 de înscrieri: 15 sonde de scanner din 21 iulie
  (`test@test.com` — `' OR 1=1--`, `{{7*7}}`, `ssrf-test`, payload-uri XSS) și 3 teste proprii
  de bot/deploy. Păstrate cele 2 intrări cu date plauzibil reale
  (`maxim.max2004@gmail.com`, `turcan.play@gmail.com`). Ștergerea s-a făcut pe **ID-uri
  explicite**, nu pe tipar, iar tabelul a fost salvat înainte în
  `/root/submissions-backup-20260815-180247.sql`.
- Sondele erau stocate ca **text literal** — query-urile parametrizate și escaparea și-au
  făcut treaba, nu a existat injecție. Vezi [11 — Security](./docs/11-security.md).
- Restul conținutului e neatins: 11 servicii · 3 membri echipă · 6 proiecte · 3 parteneri ·
  4 statistici · 3 social · 2 contacte.

**Known gap** — adminul nu poate șterge cereri

- `backend/app/routers/contact.py` expune doar `POST /api/contact` și
  `GET /api/admin/submissions`; `ContentStore` (`storage/base.py`) nu are `delete_submission`.
  Tabul **Cereri** poate doar lista, deci curățenia de mai sus a fost făcută direct în
  Postgres. Un buton de ștergere în admin (cu endpoint `DELETE /api/admin/submissions/{id}`
  protejat de `get_current_admin`) rămâne de făcut.

## 2026-08-07 — Documentation sync + full verification pass

**Docs**

- Added this changelog as the project's single change zone.
- Added [16 — i18n & SEO](./docs/16-i18n-seo.md): the trilingual layer (RO/RU/EN), the
  localized content model, crawlable per-language URLs, hreflang/sitemap/JSON-LD, the
  cookie-consent banner and the consent-gated analytics pixel — all of which shipped
  between 2026-07-14 and 2026-07-15 with **no documentation**.
- Brought the stale docs back in line with the code: [01 — Overview](./docs/01-project-overview.md),
  [02 — Tech Stack](./docs/02-tech-stack.md), [03 — Architecture](./docs/03-architecture.md)
  (folder tree now includes `lib/i18n/`, `proxy.ts`, the legal pages and the new `ui/`
  helpers), [05 — Page Sections](./docs/05-page-sections.md) (section order/numbering matched
  the real page; the "forms don't submit" and "admin is future work" leftovers removed),
  [07 — Conventions](./docs/07-conventions.md) (i18n + changelog rules),
  [08 — Roadmap](./docs/08-roadmap.md) (phases 3h–3k recorded),
  [14 — Testing](./docs/14-testing.md) (real test counts).
- `AGENTS.md`: added the "log every change" workflow rule.

**Verification** (run against this commit, frontend locally, backend in Docker)

| Check | Command | Result |
|-------|---------|--------|
| Frontend tests | `npm test` | **96 passed** (10 files) |
| Types | `npx tsc --noEmit` | clean |
| Lint | `npm run lint` | clean |
| Production build | `npm run build` | ✓ compiled; 9 routes + proxy |
| Backend tests | `make test` (in the backend container) | 131 tests defined — run in Docker |

No application code was changed in this entry.

---

## 2026-07-15 — Localized content, technical SEO, design feedback, estimator bridge

**Added**

- **Localized editable content** (`e5f387b`) — every admin-editable field now carries three
  variants `{ ro, ru, en }` instead of one string. `lib/i18n/content.tsx` resolves a field
  with `loc(value, locale)`, falling back to Romanian so a missing RU/EN never renders
  blank; bare strings from older payloads are still accepted and treated as Romanian.
  Admin editors gained a per-language tab per field.
  See [16 — i18n & SEO](./docs/16-i18n-seo.md).
- **Technical SEO** (`c1bac18`) — `app/robots.ts` (admin + `/api/` disallowed, sitemap
  advertised), `app/sitemap.ts` (three public pages × hreflang alternates), JSON-LD
  organization/website data, Open Graph + Twitter images (`app/opengraph-image.tsx`,
  `app/twitter-image.tsx`), locale-aware `generateMetadata`, and crawlable per-language
  URLs: `/` (RO), `/ru`, `/en` via `next.config.ts` rewrites + the `x-locale` header set in
  `proxy.ts`.
- **Repeated section CTA** (`880660a`) — `components/ui/SectionCTA.tsx`, placed after every
  content block so a visitor can start a conversation wherever they stop reading; the `hue`
  prop varies the accent down the page.
- **Service card → estimator bridge** (`5612cff`) — clicking a service card on `/03`
  pre-selects that service in the estimator and scrolls to it (`lib/estimatorBridge.ts`,
  a window `CustomEvent` because the two sections are independent components).
- `tsx` as a devDependency (`deb8a79`) so content-migration scripts can be run directly.

**Changed**

- Design feedback pass (`880660a`) — warmer, lighter palette; new UTP copy in the hero.

**Fixed**

- Analytics pixel recorded nothing (`5612cff`) — `t.js` resolves its site id through
  `document.currentScript`, which is `null` for an `async` script, so it was reading a
  Next.js framework chunk instead of our tag. The pixel is now injected imperatively with
  `async = false`. See `components/ui/AnalyticsPixel.tsx`.

## 2026-07-14 — Trilingual site, legal pages, consent; security hardening; real content

**Added**

- **Trilingual RO/RU/EN** (`c4faeeb`) — `lib/i18n/` (message catalogs, `LanguageProvider`,
  locale helpers), a language switcher, SSR locale resolution from cookie →
  `Accept-Language` so first paint never flashes the wrong language, and Montserrat
  alongside Archivo so Cyrillic headings render in the brand's display weight.
- **Legal pages + cookie consent** (`c4faeeb`) — `/confidentialitate`, `/cookies`, and a
  GDPR / Law-133 consent banner (`components/ui/CookieConsent.tsx` + `lib/consent.ts`).
  The analytics pixel loads **only** after analytics cookies are accepted.
- **Partners section** (`00efba6`, `2c2ef8e`) — logos, links to partner sites, hover site
  preview, and admin upload.
- **Projects with galleries** (`2c2ef8e`) — real projects, screenshot galleries with a
  lightbox, compressed uploads.
- Reusable security skills extracted from the audit (`f30314b`) — see
  [15 — Security Skills](./docs/15-security-skills.md).

**Security** (`7b933b0`)

- Defensive pentest (4 parallel audit passes) + fixes + regression tests. See
  [`SECURITY.md`](./SECURITY.md).

**Changed / Fixed**

- Real team members with socials; lighter palette; CGAM and IQ Arena split into two
  distinct projects; text is no longer HTML-escaped on save (`d89cbd0`).
- Team: first names only (`83e0108`); single column on mobile so the third member isn't
  stranded alone on a row (`673205d`).
- Animated stripes applied everywhere; upload limit raised to 8 MB; the local dev backend
  no longer steals the Telegram bot's long-poll (`d056dd5`).
- Two Telegram bugs fixed (`2c2ef8e`).
- DocuSafe moved to `docusafe.tbs.md`; `tbs.md` now serves TBS Digital (`351daa4`).

## 2026-07-08 – 2026-07-10 — Mobile pass, analytics, deploy config

**Added**

- Mobile UI pass (`73b40eb` … `abef19b`) — overflow-safe grids, `/03 Servicii` and
  `/04 Proiecte` as auto-rolling scroll-snap carousels (shared `useAutoCarousel` hook:
  starts on first view, pauses on manual slide, resumes after 5 s), `/02` orphan-cell fix,
  skeleton placeholders for blank stats, 2-column footer partners grid. Documented in
  [04 — Design System](./docs/04-design-system.md#mobile--640px).
- `statistica.tbs.md` analytics pixel + nginx vhost and production compose for `tbs.md`
  (`ad4dfcc`).

**Security / Deploy**

- Security hardening + pentest #1 (`ffc39bc`) — production fail-fast config guard, rate
  limiting, security headers, Telegram action authorization, security skills.
- `ENVIRONMENT` + `TELEGRAM_ADMIN_IDS` wired through `.env`/compose; the prod override
  forces the fail-fast guard (`19f8a80`). `.env.example` templates tracked so a fresh clone
  can configure a deploy (`0edd3b1`).
- `tbs.md` vhost keeps HSTS, drops the DocuSafe CSP (`70463ee`).

**Fixed**

- `matchMedia` stubbed in tests so the carousel sections can mount (`efb14fb`).

## 2026-07-07 – 2026-07-08 — Full stack: DB, auth, API-wired frontend, Docker, Telegram

- **Full-stack integration** (`cb092c9`) — real database + bcrypt auth, frontend wired to
  the API, input validation on both layers, Docker Compose, Telegram lead bot.
  See [10 — Backend](./docs/10-backend.md), [11 — Security](./docs/11-security.md),
  [12 — Deployment](./docs/12-deployment.md), [13 — Telegram](./docs/13-telegram.md).
- Frontend UI/UX tests, live API verification script, lint cleanup (`6022c48`) —
  [14 — Testing](./docs/14-testing.md).
- FastAPI backend scaffold with the JSON stand-in store (`4667ab0`, documented in `756095b`).
- Admin panel with an editable, add/remove content store (`ef8ed82`, documented in `143bdeb`) —
  [09 — Admin](./docs/09-admin.md).

## 2026-06-30 – 2026-07-07 — Foundation

- Initial commit (`5d00d7c`), project documentation (`f8ee4e5`).
- UI-only Next.js frontend built from the approved design (`89ea44c`).
- Interactive hero emblem animations; broken keyframes fixed (`01abdc6`).
