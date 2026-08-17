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

## 2026-08-17 — Prețurile din admin sunt cele afișate

**Fixed** — prețul pe care îl vedea vizitatorul nu era al proprietarului

- `Services.tsx` e singura componentă care randează `service.price`, și **nu e pe nicio
  pagină** — deci toate cele 11 prețuri editate din admin erau invizibile. Singurul preț vizibil
  era cel din estimator, **hardcodat în cod**. Cele două ajunseseră să difere de **20 de ori**:
  ecranul spunea „€3.000" pentru un site pe care proprietarul îl vinde de la **150€**.
- Estimatorul citește acum prețul din `useSiteContent().services`. Maparea e scrisă explicit
  (`SERVICE_FOR_TYPE`) — cinci tipuri față de unsprezece servicii, iar `ecommerce` este `shop`,
  deci nu se putea ghici din nume. Prețul din admin se afișează **verbatim**, fiindcă include
  deja „de la" / „от" / „from"; cel din cod rămâne doar ca rezervă și primește prefixul.
- Un serviciu lipsă sau rămas pe placeholder-ul `...` cade pe rezervă — **„..." nu ajunge
  niciodată la vizitator**.
- Câmpul `estimate` din cererea trimisă poartă acum **exact șirul afișat pe ecran**, nu cifra
  goală: echipa primește ce a văzut clientul.

**Changed** — prețuri reale în producție (scrise în baza de date, nu în cod)

| Serviciu | Înainte | Acum |
|---|---|---|
| Landing page | 250€ | **150€** |
| Site web / prezentare | 400€ | **150€** |
| Magazin online | 650€ | **550€** |
| Platformă SaaS | 500€ | **450€** |
| CRM personalizat | 450€ | 450€ |
| Automatizare procese | 150€ | 150€ |

Restul (mobil 500 · dashboard 200 · bot 100 · IA 150 · custom 500) rămân cum le-a pus
proprietarul. Corectat și un spațiu dublu în prețul serviciului `ai`.


**Fixed** — prețul real e acum și în HTML-ul livrat de server

Prima verificare în producție a arătat că pagina venea în continuare cu **€3.000**: conținutul
din admin se încarcă abia după hidratare, iar SSR-ul folosea semințele din cod, unde prețurile
erau `"..."` — deci cădea pe rezerva din estimator. Vizitatorul ar fi văzut €3.000 preț de o
clipă, iar cu JS lent ar fi rămas așa. Semințele din `lib/content.ts` și `backend/app/defaults.py`
poartă acum prețurile reale, deci și primul byte e corect, și o instalare nouă pornește corect.
Baza de date rămâne sursa de adevăr — semințele doar nu o mai contrazic.

Testele nu mai codifică cifre: derivă prețul așteptat din sămânță, în toate cele patru fișiere
(3 unitare + `e2e/modal.spec.ts`). O repreciere nu mai face suita roșie fără motiv.

**Fixed** — o scurgere între teste

`SiteContentProvider` cachează ultimul răspuns bun în `localStorage`, deci un test care
rezolva prețuri reale le lăsa în cache pentru următorul test „offline". `contact-form.test.tsx`
curăță acum cache-ul în `beforeEach`.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **305 passed / 0 failed** (+2) |
| `npx playwright test --workers=1` | **144 passed / 0 failed** |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | curate |

## 2026-08-17 — Un singur flux de cerere + audit complet de mobil

**Changed** — toate CTA-urile comerciale deschid același modal

- Nou: `lib/request/RequestFlowProvider.tsx` — provider montat **o dată** în `app/layout.tsx`,
  care ține **un singur** `Modal`. `useRequestFlow().openRequest({...})` e singura cale.
  `RequestModal.tsx` (buton + dialog propriu) a fost **șters**: montat la fiecare CTA ar fi
  produs cinci dialoguri în DOM, fiecare cu focus trap și scroll lock propriu. Un test
  verifică explicit că o pagină cu cinci CTA-uri are exact un `[role="dialog"]`.
- Conectate: Hero, CTA-ul roșu din bară, CTA-ul din meniul mobil (închide meniul întâi),
  BottomCTA, și cele două de pe pagina de serviciu. **Neatinse**, cum s-a cerut: linkul
  „Deschide serviciul →" (e navigare) și tot ce e în `Estimator` — estimatorul de pe homepage
  rămâne secțiune vizibilă, nu se dublează într-un modal.
- CTA-urile au devenit `<button type="button">`; ancorele `#contact`/`#estimare` de pe ele au
  dispărut, dar **secțiunile respective există în continuare**. Un control care ar fi scrollat
  pagina *și* ar fi deschis un dialog făcea două lucruri deodată.
- Cererea trimisă poartă acum un bloc de origine — serviciu, proiect, CTA-ul sursă — iar
  **spațiul lui e rezervat înainte** ca rezumatul să fie tăiat la 5000 de caractere, deci
  informația de rutare nu se pierde niciodată. `RequestSource` e o uniune închisă, nu un string
  liber: o greșeală de tipar ar produce un lead nerutabil.
- Focus: CTA-ul din meniul mobil dispare din DOM în același commit în care se deschide
  dialogul, deci meniul pasează hamburgerul ca țintă de restaurare — altfel focusul ar cădea
  pe `<body>`.
- `play("tap")` e apelat **o dată**, în `openRequest`, nu copiat în fiecare buton.

**Fixed** — regresie vizuală prinsă la timp

Conversia `<a>` → `<button>` scotea la iveală bordura implicită a browserului pe `Hero .primary`
și `BottomCTA .cta`, care nu declarau `border`. Reparat, împreună cu `cursor: pointer` pe toate
cinci. Adăugat și un `:focus-visible` **comun** — până acum **niciun** CTA roșu nu avea stare de
focus definită, toate se bazau pe inelul implicit, care diferă între `<a>` și `<button>`.
Înălțimile aliniate la 56.8px, cu o excepție documentată: CTA-ul din bară rămâne 43.4px, ca să
încapă într-un header de 44px pe mobil.

**Fixed** — mobil, măsurat în browser la 6 lățimi × 2 teme

- **Gutter**: Work, Principles, Team, Estimator și BottomCTA aveau **0px** padding orizontal
  până la 1024px — cardurile și inputurile atingeau marginea ecranului. Acum **16px** uniform.
- **Footer, overflow preexistent**: `.colLink { width: max-content }` făcea ca min-content-ul
  fiecărui link să fie textul întreg, deci un track `fr` nu se putea micșora. La 320px cele
  două coloane cereau 317.4px într-un container de 286px, iar `overflow: hidden` **tăia în
  tăcere** paragraful de brand, iconurile sociale și toată coloana a doua, la jumătate de
  cuvânt. Reparat cu `minmax(0, …)` și `min-width: 0`.
- **Descrierea proiectelor era vizibilă doar pe hover** — deci invizibilă pe telefon. Acum se
  afișează la `(hover: none)`; desktopul păstrează dezvăluirea la hover. Odată permanentă,
  lizibilitatea chiar era ruptă: măsurat pe pixelul cel mai luminos de sub text, **4.01:1 light
  / 3.75 dark** pentru descriere și **2.99 / 2.88** pentru titlu. Wash-ul cardului a fost
  adâncit în aceeași interogare → **8.29 / 7.28** și **5.30 / 4.81**.
- **Caruselele**: Work devine bandă cu snap sub 640px (erau 9 carduri stivuite, ~2400px de
  scroll); Team pe `min(390px, max(82vw, 320px))`. `overscroll-behavior-x: contain`, ca un swipe
  la capăt să nu tragă pagina sau gestul de „înapoi" pe iOS.
- **Ținte de atingere**: 12 controale urcate la 44px. Două cazuri rezolvate fără a mișca
  designul — `Hero .textlink` și `Modal .close` primesc zona de 44px printr-un pseudo-element
  invizibil, fiindcă `min-height` ar fi mutat sublinierea, respectiv ar fi mărit cercul aprobat
  de 32px.
- **`Lightbox`** folosea `100vh`, care pe telefon e înălțimea cu bara de URL retrasă — imaginea
  ieșea ~60–100px prea înaltă și împingea legenda sub fold. Trecut pe `100dvh`.

**Fixed** — două lucruri care cereau `.tsx`, aplicate de mine

- **Selectorul de limbă avea ținte de 32.5×44px între 361 și 399px.** Nu există aranjament în
  care controlul segmentat să fie și pe ecran, și tappabil în banda aia: 44px lățime cere un
  rând de header de 397px, care nu încape până la 398. Pragul compact a urcat de la **360 la
  400**, deci 375 și 390 — cele mai comune lățimi de telefon — folosesc acum controlul cu un
  singur buton, unde fiecare țintă e 44×44. Nota anterioară apăra 360 ca să păstreze 375
  segmentat; era o constrângere moștenită dintr-un brief contradictoriu, nu o cerință de
  accesibilitate, și pierde în fața WCAG 2.5.5. Constanta e acum **exportată**, iar suita E2E o
  **importă** în loc s-o copieze.
- **Tastatura mobilă putea acoperi inputul activ.** `interactive-widget=resizes-content` în
  `app/layout.tsx`. iOS și Android nu micșorează layout viewport-ul când apare tastatura — îl
  panoramează — deci un `position: fixed` (dialogul) își păstrează înălțimea în spatele ei.
  `dvh` nu ajută: urmărește bara de URL, nu tastatura.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **303 passed / 0 failed** (21 fișiere) |
| `npx playwright test --workers=1` | **144 passed / 0 failed** |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | curate |
| Scroll orizontal, 320/375/390/768/1024/1440 × light+dark | **0** pe toate cele 36 de combinații |

> **Rămâne, cu motiv:** linkurile din footer și navigația desktop stau sub 44px peste 860px —
> input cu pointer, iar ridicarea lor ar restructura vizibil footerul. Greutatea fontului
> diferă între CTA-uri (`--fw-bold` vs `--fw-extra`); cerința era „aceeași înălțime / focus",
> iar unificarea greutății ar fi o schimbare vizibilă fără cerință. `--cyan` (3.56:1) și
> `--amber` (3.77) sunt încă text în ~15 locuri.

## 2026-08-17 — Optimizare: contrast, performanță, E2E complet

Fără nicio schimbare de design: aceleași culori, tipografie, spațieri și componente. Doar
contrast, performanță, acoperire de teste și două defecte reale.

**Fixed** — contrastul culorilor de brand folosite ca text

- Auditul a măsurat **fiecare** culoare de umplere ca text pe `--panel`. **Niciuna nu trece**
  pragul AA de 4.5:1: `--red` 4.19 · `--blue` 4.25 · `--green` **3.21** · `--amber` 3.77 ·
  `--cyan` 3.56 · `--mint` ≈2.4 · `--star` ≈1.6.
- Trei tokenuri noi de text, cu variante dark: `--red-text` #d41026 (**5.38**),
  `--blue-text` #2a56d6 (**6.18**), `--green-text` #0b7a5a (**5.32**). Nuanța brandului e
  păstrată — hue ținut la 353–354° pentru roșu, saturația la nivelul original. Pe dark:
  `#ff6b7b` (6.03) și `#8fb0ff` (7.75); verdele dark trecea deja (8.92), deci `--green-text`
  arată spre el în loc să adauge un al patrulea verde aproape identic.
- **26 de declarații** `color: var(--red)` → `var(--red-text)`, strict acolo unde e text mic.
  Umplerile, bordurile, inelele de focus și glifele `aria-hidden` rămân pe `--red` — acolo
  pragul e 3:1 și îl treceau.
- `Principles` arată de ce împărțirea e pe **rol**, nu pe culoare: `--accent` colora și
  bordura de hover (grafic, 3:1) și numărul de 12px (text, 4.5:1). Separate în `--accent` și
  `--accent-text`, deci **bordurile rămân pixel-identice**.
- Comentariul din `globals.css` susținea că `--green` și `--amber` sunt „darkened enough to
  clear AA as text". **Fals** — corectat, cu cifrele măsurate. Exact așa reapare un bug:
  cineva citește comentariul și îl crede.

**Changed** — performanță, măsurată ca A/B controlat

Măsurătorile inițiale au fost **contaminate** de modificările CSS ale altui agent care rula
în paralel; au fost refăcute ca A/B pe același arbore, cu `shasum` care confirmă că singura
diferență între cele două build-uri e code splitting-ul.

| | înainte | după |
|---|---|---|
| `/servicii/<slug>` JS+CSS gzip | 215.312 | **199.487** (−7,3%) |
| `/servicii/<slug>` CSS gzip | 15.152 | **10.452** (−31%) |
| `/` JS+CSS gzip | 218.520 | 214.630 (−1,8%) |
| PNG-uri în `public/` | 3.751.260 | **3.376.775** (−10%) |

- `RequestSection` (estimatorul, 959 linii + dictarea) se încarcă acum cu `next/dynamic`, la
  apăsarea CTA-ului, nu cu pagina. `ssr: false` nu e o pierdere: `Modal` oricum randa `null`
  pe server. Dovedit în browser — la încărcare niciun chunk cu estimatorul; la click, chunk-ul
  sosește și fluxul e complet, cu preselecția corectă.
- Recompresie **fără nicio pierdere** a 6 PNG-uri: toate aveau canal alpha complet opac, deci
  al patrulea canal nu codifica nimic. Dovada: SHA-256 pe bufferul RGB decodat, backup vs.
  fișier nou → **pixel-identice**.
- `/projects/*` și `/partners/*` erau servite cu `max-age=0` — 9 round-trip-uri de revalidare
  doar pe homepage. Acum `max-age=3600, stale-while-revalidate`. **Nu** `immutable`: fișierele
  nu sunt hash-uite și un deploy le poate înlocui cu același nume.

**Fixed** — modalul era sub alte straturi

`Modal .overlay` avea `z-index: 120`, sub `StatusBar` și dropdown-ul din navbar (130), popup-ul
de limbă (200), bara de cookie-uri (280) și bara de progres (300). Simptom: banda de sus
rămânea nedimmed în spatele scrim-ului, iar un click acolo nimerea `StatusBar`, deci dialogul
nu se închidea. Bara de cookie-uri era mai gravă — fiind `position: fixed`, ar fi interceptat
clickuri destinate dialogului. Mutat la **320**, deasupra întregii stive, care e acum
documentată în cod.

**Changed** — statisticile echipei vin din date reale

`Team.tsx` afișa trei valori hardcodate. Una se contrazicea cu site-ul însuși — „50+ proiecte",
în timp ce hero-ul numără portofoliul real și arată **9**; celelalte două („98% clienți
mulțumiți", „24/7") nu sunt măsurabile din nimic ce deține proiectul. Rândul e legat acum de
`stats` din admin, afișează doar valorile completate și **nu se randează deloc** cât timp nu
există niciuna. Aceeași regulă pe care footer-ul o aplică deja rețelelor sociale.

**Added** — E2E pentru modal, chat, dictare și sunet (+26 teste)

Focus trap verificat pe **40 Tab / 40 Shift+Tab**; focus restaurat pe CTA; închidere prin ✕,
Escape și scrim, dar **nu** la click în interior *nici* la drag care se termină pe scrim; body
înghețat și scroll restaurat la același pixel; preselecția serviciului; sheet la 390px fără
scroll orizontal. Chat: bulă → clarificare → rezumat pe ecran, plus un cuvânt de 80 de
caractere. Dictare: absența butonului fără API, nicio construcție înainte de click, textul
confirmat (și **editat**) e cel livrat, refuz de permisiune. Sunet: oprit implicit, **zero
`AudioContext` la încărcare** (constructorul numărat), persistență, și tăcere pentru un
vizitator care revine cu sunetul pornit până la primul gest.

> **Premisa mea era greșită:** ceruse să se testeze că butonul de dictare lipsește în Chromium
> pentru că n-ar avea `SpeechRecognition`. **Chromium 151 îl are** — un test scris pe premisa
> aceea ar fi trecut din motivul greșit. Testul șterge acum API-ul explicit și verifică ambele
> stări.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **285 passed / 0 failed** (20 fișiere) |
| `npx playwright test --workers=1` | **144 passed / 0 failed** (118 + 26) |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | curate |

> **Rămâne deschis, cu cifre:** `--cyan` (3.56:1) e folosit ca **text** în ~15 locuri — hover-ul
> din navbar, `StatusBar`, bara de cookie-uri, paginile legale și aproape tot panoul de admin;
> `--amber` (3.77:1) la fel în `Partners`. Ambele vor același tratament `*-text`. Ca inele de
> focus și borduri, `--cyan` e corect — acolo pragul e 3:1.
> Refuzate deliberat la performanță, ca să nu schimbe designul sau să elimine funcții:
> `next/image` (ar cere `remotePatterns` per host, altfel imaginile din admin ar da eroare),
> redimensionarea capturilor, recompresia JPEG (generation loss), reducerea subseturilor de font.

## 2026-08-16 — E-commerce și Asistenți: completate cu ce e verificabil

Cele două direcții goale din selector au fost completate. Textul cerut inițial conținea mai
multe afirmații care **nu s-au confirmat la verificare**; sunt listate mai jos, cu dovada, ca
să nu fie reintroduse din greșeală.

**Added** — `e-commerce`, ca **capabilitate**, fără studiu de caz

- eyebrow „PRODUSE DIGITALE CARE SE VÂND CLAR", titlu „E-commerce pentru produse, rapoarte și
  acces digital", trei beneficii (checkout și plăți · livrare și acces digital · raportare și
  gestionare produse), toate la **timpul viitor** — e ofertă, nu portofoliu.
- Cardul din dreapta desenează **fluxul** (Ofertă → Plată → Acces), nu un proiect: niciun nume
  împrumutat, niciun link extern. `solutionProjectIds["e-commerce"]` rămâne **gol**, intenționat.
- CTA-ul deschide cererea cu **E-commerce preselectat** (€6.000), acoperit de test.

**Added** — `asistenti-ia`, cu **cazuri reale**

- `solutionProjectIds["asistenti-ia"] = ["bizcheck", "balloons-breeze"]` — ambele publice, deci
  ambele cu link real. Mesajul „nu avem încă un proiect public" a dispărut de pe direcție.
- Pagina primește secțiunea **„Cazuri reale"**, cu trei carduri etichetate: **BizCheck**
  (rezultat livrat în Telegram printr-un bot dedicat) · **Balloons Breeze** (chat live cu
  **răspuns uman**, dintr-un panou de administrare) · **TBS Digital** (fluxul nostru intern —
  numit, dar **fără link**, fiindcă nu e proiect de portofoliu).
- Eticheta tabului și ruta rămân neschimbate.

**Removed** — afirmații care nu au trecut verificarea

| Cerut | De ce nu a fost publicat |
|---|---|
| Produsul „Contract MD" | Nu există. Endpoint-ul public de șabloane al bizcheck.md întoarce `{"templates":[]}`; zero apariții în cod. |
| Checkout / plăți / livrare digitală la BizCheck | Contrazis de propriul lor site: „Integrare MAIB — **în lucru**", butoanele de livrare `disabled` cu „Implementare ulterioară", toate testele `is_paid: false`. |
| „Balons Blaze" | Nume inexistent, greșit de două ori. Canonic: **Balloons Breeze**. |
| Balloons Breeze: chat cu **boți** | Chat-ul e răspuns de **un om** — panoul lor scrie „Ответить клиенту…". Confirmat și pe server: proiectul are doar `web`/`backend`/`db`, **niciun container de bot** (spre deosebire de BizCheck, care are `bizcheckua-tgbot-1` și `bizcheckua-groupbot-1`). |
| Balloons Breeze: integrare Telegram | Zero apariții „telegram" în HTML sau în vreun chunk JS al site-ului. |
| „IA / AI" ca lucru **livrat** | Niciun model de limbaj nicăieri în stack. `lib/solutions.ts` avea deja scris că inventarea unui astfel de exemplu ar fi „a lie on a sales page". IA rămâne formulată ca ofertă. |
| „Audituri GDPR" (plural) / audit de conformitate | Un **singur** chestionar e live și e **gratuit**; celelalte patru sunt „în curând". E autoevaluare, nu audit. |

> ⚠️ **De rezolvat în afara codului:** bio-ul botului `@CROWE_BIZCHECK_bot` conține spam
> pornografic, care apare ca `og:description` la orice previzualizare a linkului — sub brandul
> Crowe. Botul e deja linkat din fluxul live de pe bizcheck.md. Se curăță din BotFather. Până
> atunci **niciun link către el nu a fost adăugat pe site**, deși botul e menționat ca fapt.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **283 passed / 0 failed** (+12 față de 271) |
| `npx playwright test --workers=1` | **118 passed / 0 failed** |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | curate |
| grep pe sursă pentru `Contract MD`, `Balons Blaze`, `CROWE_BIZCHECK_bot` | **0 apariții** |

## 2026-08-16 — Modal, chat extins, dictare, sunet, E2E

**Added** — modal de cerere

- `components/ui/Modal.tsx`: `role="dialog"`, `aria-modal`, titlu asociat, **focus trap** real
  (Tab/Shift+Tab ciclează, focusul revine pe declanșator la închidere), închidere prin X,
  Escape și click exterior, scroll de fundal blocat. Desktop centrat, mobil **sheet ancorat
  jos**. `prefers-reduced-motion` oprește animația.
- Trei capcane rezolvate explicit, fiindcă fac diferența între un modal care pare corect și
  unul care e: trapa ascultă pe `document` în **capture**, altfel nu mai prinde nimic dacă
  focusul a ieșit; o apăsare începută în panou și terminată pe overlay își **retargetează**
  click-ul pe overlay, deci o verificare naivă ar închide modalul în timp ce selectezi text;
  blocarea scroll-ului compensează lățimea scrollbar-ului, altfel pagina saltă lateral.
- **Cablat pe paginile de serviciu**, unde CTA-ul „Vorbește cu echipa" arunca vizitatorul
  înapoi pe homepage în mijlocul cititului. Acum deschide fluxul **real** pe loc — aceeași
  componentă, același endpoint — cu serviciul preselectat prin prop.

**Added** — chat extins

- Arborele a crescut de la 9 la 12 noduri: **descriere liberă**, **întrebare de clarificare
  aleasă după tipul de proiect**, pas opțional de detalii, apoi **rezumat**. Un răspuns tastat
  liber declanșează o rundă de clarificare și revine exact în pasul din care a plecat.
- Rezumatul e vizibil în interfață **și** pleacă odată cu cererea reală. Bugetul de 5000 de
  caractere e cheltuit rezumat-întâi, transcriptul primind doar restul — și e tăiat vizibil,
  nu lăsat să producă 422.
- Textul liber trece prin aceeași validare ca formularul; marcajul e refuzat, dialogul nu
  avansează, textul rămâne în casetă. Bulele au `overflow-wrap: anywhere`, deci un cuvânt de
  80 de caractere nu mai împinge pagina lateral.

**Added** — dictare și sunet

- Dictarea pornește **doar la click**, cere permisiunea explicit, oprește imediat pistele de
  microfon. **Nu salvează și nu trimite audio**: textul recunoscut intră într-un textarea
  editabil, iar callback-ul se declanșează abia la confirmarea vizitatorului. Refuzul arată o
  cale clară spre scriere manuală; dacă browserul n-are API-ul, butonul **nu se randează**.
- Sunet global, oprit implicit, persistat prin cookie ca tema. **Trei apărări contra
  autoplay-ului**: oprit implicit, un latch armat doar de primul gest real, și `AudioContext`
  construit înăuntrul funcției de redare. `prefers-reduced-motion` nu-l activează niciodată.

**Added** — Playwright

- Framework E2E (nu exista), cu server propriu pe build-ul de producție. **118 teste**: rute
  în 3 limbi, redirecturi 301 cu limba păstrată, temă din primul byte, persistență temă/limbă,
  formularul de contact (cu `page.route()`, deci **niciun lead real nu pleacă**), tastatură, și
  responsive la **320/375/390/768/1280 × light/dark**.

**Fixed** — două bug-uri reale găsite de E2E, nu de citit cod

- **Ținte de atingere de 24px.** `PreferencesGroup` întindea grupul la 44px, dar `.switcher`
  centra opțiunile RO/RU/EN — deci fiecare buton măsura 24px. WCAG 2.5.5 se aplică **per
  țintă**, nu per grup.
- **Scroll orizontal la 320px**: documentul ieșea **361px într-un viewport de 320px**, pe
  ambele pagini și în ambele teme. Cauza: butonul de sunet, adăugat în bară. Nu era un bug, ci
  o imposibilitate geometrică — logo + 3 butoane de limbă + temă + sunet + hamburger, toate la
  44×44, nu încap în 320px. Prima încercare (strâns padding-ul) repara scroll-ul **stricând
  exact cerința care îl cauzase**, deci a fost revenită.
  **Soluția, aleasă de client:** sub **360px** selectorul de limbă devine un singur buton de
  44×44 care deschide alegerea — cu tastatură completă (săgeți, Home/End, Escape, focus
  restaurat) și cu fiecare rând din popup tot 44px. Documentul a coborât de la 361px la 320px.
  Un singur control în DOM, nu două ascunse cu CSS.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` (Vitest) | **271 passed / 0 failed** (20 fișiere) |
| `npx playwright test --workers=1` | **118 passed / 0 failed** |
| `npm run lint` · `npx tsc --noEmit` | curate |

> **Notă de operare, descoperită de E2E:** `npm start` (adică `next start`) e **rupt** pe acest
> repo — `output: "standalone"` face ca `/servicii/[slug]` să întoarcă 500 și homepage-ul să nu
> se hidrateze. Producția nu e afectată: Docker rulează `node .next/standalone/server.js`, care
> e calea corectă, iar Playwright face la fel. Vezi [12 — Deployment](./docs/12-deployment.md).

> **Nefăcut, deliberat:** CTA-urile de pe homepage duc în continuare la secțiunea de pe pagină,
> nu deschid modalul — acolo fluxul e deja vizibil și un modal ar dubla aceeași interfață.
> Unificarea e o decizie de UX, nu o scăpare.

## 2026-08-16 — Dark mode, paleta de brand, servicii ca destinație

**Added** — dark mode complet

- Temă light **și** dark. Valorile dark trăiesc **o singură dată** (`--dark-*` în
  `globals.css`); cele două căi de activare doar remapează tokenurile reale, deci paleta nu
  poate diverge între „vizitatorul a ales dark" și „sistemul e pe dark".
- Trei stări: alegere explicită (`data-theme`), fără alegere (urmează sistemul), persistență
  prin cookie `tbs_theme`. **Cookie, nu `localStorage`**, fiindcă serverul îl citește și
  ștampilează `data-theme` în HTML-ul trimis — deci paleta corectă din **primul byte**, fără
  flash și cu JavaScript oprit. Pentru cazul „încă n-a ales", un script inline rezolvă
  `prefers-color-scheme` înainte de prima randare și **poartă nonce-ul CSP** — fără el,
  politica strictă l-ar bloca și flash-ul ar reveni.
- Buton de temă **mereu vizibil**, inclusiv pe mobil, lângă selectorul de limbă și **nu**
  ascuns în hamburger. Icon soare/lună, `aria-pressed`, etichetă localizată RO/RU/EN, focus
  vizibil, 44×44px. `PreferencesGroup` a ieșit din `.desktop` (care dispare sub 860px) într-un
  rând mereu vizibil, iar instanța din overlay a fost scoasă ca să nu existe două controale
  identice pe același ecran.

**Changed** — paleta de brand

- Aplicate valorile date de client: `--bg #f4f7ff`, `--txt #10172a`, `--mut #586784`,
  `--line #dbe3f1`, `--red #ef263d`, `--blue #3970ff`, plus `--mint #05b99f` și
  `--star #ffbd2e`. Fundalul paginii e acum o pată bleu discretă dreapta-sus peste grila fină,
  ambele conduse de tokenuri (`--wash`, `--grid-line`) ca tema dark să le repoziționeze.
- Mint și galben sunt tokenuri de **umplere**, nu de text: măsurate pe alb dau 2.4:1 și 1.6:1,
  deci ar fi ilizibile ca text. Tonurile de text (`--green`, `--amber`) rămân separate.
- **Fontul NU a fost schimbat.** Specificația cerea Arial, dar site-ul rulează Archivo/Manrope
  prin `next/font` — exact tipografia din machetele aprobate. A trece pe Arial ar fi schimbat
  masiv identitatea, adică fix ce cere prima frază a specificației să nu se întâmple.

**Fixed** — culorile care s-ar fi rupt pe dark

- **57 de valori literale eliminate** din 14 module, plus **8 tokenuri folosite greșit** —
  cazuri în care un token semantic *întunecat* era folosit ca text pe o suprafață care devine
  ea însăși întunecată (footer-ul și estimatorul foloseau `--ink`/`--ink2` ca text; opțiunea
  selectată din estimator picta alb pe alb). Măsurat pe dark: **47 → 22** eșecuri de contrast;
  pe light **71 → 62**, singura schimbare fiind o îmbunătățire.
- `Lightbox` avea un bug **de light mode**: glifele de închidere/navigare erau `--txt`
  (întunecat) peste un fundal aproape negru — invizibile. Reparat.

**Changed** — selectorul de servicii devine destinație, nu acțiune

- Fiecare pill e acum **link real** către pagina serviciului (`aria-current` pe cel activ),
  nu buton inert. Preview-ul rămâne neinteractiv, cu **un singur** link textual
  „Deschide serviciul →" — CTA-ul roșu duplicat și linkul extern au fost scoase din el.
- Cardul bleumarin nu mai arată BizCheck sub toate cele 5 direcții: afișează **proiectul de
  referință real al direcției**, iar unde nu există spune asta cinstit.
- Pagina de serviciu are bară de acțiuni sub hero: CTA roșu către fluxul real de cerere,
  „Vezi proiectele relevante" (ancoră locală) și „Vezi proiectul" — care randează `<span>`,
  **nu link mort**, când proiectul n-are URL public.
- **Preselecția serviciului funcționează cap-coadă**: CTA-ul duce la
  `/?serviciu=<slug>#estimare`, iar estimatorul citește parametrul prin `useSearchParams` și
  pornește pe tipul corect. Maparea direcție → tip e scrisă explicit în `lib/directions.ts`,
  nu ghicită din nume. `lib/estimatorBridge.ts` **nu** era o opțiune: evenimentul lui nu are
  niciun ascultător și oricum nu supraviețuiește navigării.
- Apartenența proiect → serviciu e un tabel explicit (`solutionProjectIds`), pe **id**, fiindcă
  `tag` e text liber localizat. `e-commerce` și `asistenti-ia` rămân **intenționat goale** —
  niciunul din cele 9 proiecte reale nu e magazin sau asistent; secțiunea nu se randează goală
  și CTA-ul asociat nu apare.

**Fixed** — mobil

- Directions și DirectionPage aveau **gutter orizontal zero**: pe telefon conținutul atingea
  marginea ecranului. Aliniat la restul site-ului.
- Linkul „← Înapoi la direcții" avea 20px înălțime → 44px. Titlul h1 scade controlat sub 900px,
  altfel „Автоматизация" se tăia în coloana îngustă.

**Docs**

- [04 — Design System](./docs/04-design-system.md): secțiune nouă despre tema dark, cele trei
  stări, de ce cookie și nu `localStorage`, ce **nu** se remapează și de ce.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **179 passed / 0 failed** (16 fișiere) |
| `npm run build` (după `rm -rf .next`) | ✓ compilat, 16 pagini |
| `npm run lint` · `npx tsc --noEmit` | curate |
| Vizual, browser real | dark și light pe `/servicii/produs-digital`, RU, ~680px: toggle vizibil lângă limbă, comută corect, pastel + card bleumarin cu proiect real |

> **Datorie cunoscută, nepatch-uită intenționat:** `--red` ca text *mic* pe `--panel` măsoară
> **3.96:1**, sub pragul AA de 4.5:1 pentru text sub 18.66px bold — pe ambele teme. Afectează
> etichete de 12px. Reparația cere ori un roșu de text mai închis, ori etichete mai mari;
> ambele sunt decizii de brand, deci sunt consemnate, nu ascunse.

## 2026-08-16 — Portofoliul trece în admin; corecturi după verificarea în producție

**Fixed** — regresie proprie: 4 proiecte au dispărut de pe site

- Mutarea lui `Work.tsx` pe `useSiteContent()` a fost corectă, dar incompletă: baza de date
  de producție conținea doar **6** proiecte, în timp ce site-ul afișa **10**, pentru că lista
  trăia hardcodată în componentă. În momentul în care componenta a început să citească din
  admin, cele 4 care existau doar în cod au dispărut, iar `fayr-family` — care nu face parte
  din portofoliul real — a apărut.
- Reparat prin scrierea listei reale **în baza de date**, cu `DbStore.save_content()` (deci
  prin logica proprie a aplicației, nu SQL scris de mână), după backup în
  `/root/projects-backup-20260816-105812.sql`. Restul conținutului a fost citit și rescris
  neatins: 11 servicii, 3 membri, 3 parteneri, 3 contacte, 3 social, 4 statistici.
- **Portofoliul e acum administrat din panoul de admin, nu din cod.** Defaults-ul rămâne doar
  sămânța pentru o instalare nouă.

**Removed**

- `fayr-family` — nu face parte din portofoliul real.
- `statistica-md` (portalul Biroului Național de Statistică) — scos la cererea clientului, din
  bază și din defaults, împreună cu textele și eticheta care rămâneau nefolosite.
- Portofoliul are acum **9 proiecte**, iar metrica din hero se recalculează singură.

**Changed**

- Telefonul din defaults era `+373 600 00 000`, un placeholder; producția avea numărul real.
  Aliniat în `lib/content.ts` și `defaults.py`, ca o instalare nouă să nu pornească greșit.

**Fixed** — UX, găsit la testarea în browser

- Mesajele de validare rămâneau sub câmp **și după ce vizitatorul îl completa**, până la
  următorul submit — se citea ca și cum formularul ar fi refuzat în continuare valoarea. Acum
  mesajul unui câmp dispare la prima editare a acelui câmp; celelalte rămân.

**Verificare** (în producție, cu browser real)

| Check | Rezultat |
|-------|----------|
| Validare formular gol | mesajele apar sub câmpurile corecte, în limba servită |
| Trimitere reală din browser | **201**, lead în DB cu proiect, estimare și opțiunile alese |
| Notificare Telegram | zero warning-uri; lead-ul a primit status din butoanele grupului |
| `/api/content` | 9 proiecte, contacte `office@tbs.md` · telefon real · A. Șușev 29 |
| `npm test` · backend `pytest` | **136 passed** · **188 passed** |

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
