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

## 2026-09-17 — Fundație pentru experiența IT: paletă, plumbing cerere, infrastructură HUD

Clientul a aprobat planul „experiență IT imersivă”: microprocesor neon în hero, intrare 3D la
Servicii, elicoid ADN pentru proiecte, asistentul „Ghid TBS”, o șină de fibră optică în loc de bara
de progres, ferestre glass tip OS (calculator, metrici live, builder) și un formular „Command
Center”, pe paleta Cyber Dark / Neon Cyan / Obsidian Black, cu iconițe Lucide. Se livrează **pe
faze, fiecare verificată**. Aceasta e **Faza 0: fundația comună** pe care o folosesc fazele 1–7 —
**nimic vizibil nu se schimbă**: tokenurile noi nu sunt folosite de nicio clasă, niciun CTA nu
trimite încă câmpurile noi ale cererii, `HudChrome` nu e montat și nimic nu importă `lucide-react`.
Trei owneri pe fișiere disjuncte (tokenuri · cerere · infrastructură HUD), apoi un gate comun.

**Added** — paleta Cyber Dark / Neon Cyan / Obsidian Black (`app/globals.css`, `app/tailwind.css`) —
vezi [04](./docs/04-design-system.md#cyber-dark--neon-cyan--obsidian-black)

- **Neon Cyan în două tonuri**: `--neon-cyan` pentru grafică (≥3:1) și `--cyan-text` pentru text
  (≥4.5:1) — light `#0891b2` / `#0b7490`, dark `#38e1ff` pentru ambele — plus `--glow-cyan` și
  `--neon-cyan-ring`. Twin-urile `--dark-*` sunt remapate în **ambele** blocuri dark.
- **Obsidian Black = `--void`** (`--obsidian`), cu `--on-obsidian` `#e6f4ff`, `--on-obsidian-mut`
  `#9fb3c8`, `--obsidian-neon` `#38e1ff` și `--obsidian-line`; nu se remapează niciodată (insulele
  rămân întunecate în ambele teme). Roșul rămâne singurul fill de CTA.
- **Straturi și plasare** (statice, nimic nu scrie variabile pe `<html>` / `<body>`): `--z-rail` 104,
  `--z-os` 108, `--z-guide` 112, toate sub meniul burger (115); `--hud-edge` 12px, `--hud-rail-w`
  44px, `--hud-dock-h` 56px, `--hud-bottom` 112px.
- **Tailwind** (`@theme inline`): `neon-cyan`, `cyan-text`, `obsidian`, `on-obsidian`,
  `on-obsidian-mut`, `obsidian-neon`, `obsidian-line` și `shadow-neon-cyan` (inelul). Cheia
  `--shadow-*` câștigă peste `--color-*` cu același nume (verificat compilând cu Tailwind 4.3.3),
  deci o umbră de culoare cyan se scrie `shadow-(color:--neon-cyan)`. Un nume de temă nefolosit nu
  emite CSS: chunk-ul Tailwind a rămas identic byte cu byte.
- **docs/04**: tabele de contrast pentru ambele teme și zece reguli de folosire. Trei eșecuri găsite
  la calcul au devenit reguli: `--neon-cyan` light peste `--glass-bg-text` **2.94:1** (grafica cu
  sens folosește acolo `--cyan-text`, 4.28); `--cyan-text` light pe `--ink` **3.22** (pe un bloc
  mereu întunecat cyan-ul e `--obsidian-neon`, 11.01); inelul light are **1.78–1.87** față de
  suprafață (o margine cu sens e un border de 1px `--neon-cyan`, cu inelul peste).
- **Nimic nu se vede**: 20 din 20 de capturi ale homepage-ului (1280 și 390px, dark și light, cinci
  poziții de scroll) identice byte cu byte înainte și după.

**Added** — plumbing pentru cererea care vine din HUD (`lib/request/`, `lib/hud/topics.ts`,
`components/sections/Estimator.tsx`) — vezi [05](./docs/05-page-sections.md#07--estimator--contact-estimează-prețul)

- **`lib/request/catalog.ts`**: tipurile de proiect și opțiunile estimatorului, mutate din
  `Estimator.tsx` cu **id-uri stabile** (`site`, `crm`, `automation`, `ecommerce`, `mobile`;
  `design`, `integrations`, `multilingual`, `seo`), plus `SERVICE_FOR_TYPE`, `DEFAULT_OPTION_IDS`
  și gărzile de id. Etichetele și prețurile de rezervă sunt **byte-identice** (9 din 9 apeluri
  `L()`, fixate de test): chip-urile se găsesc după ele, iar eticheta ajunge la API ca `project`.
- **`RequestContext`** primește:
  - `projectType` — câștigă peste maparea slug-ului; un id necunoscut e ignorat;
  - `optionIds` — înlocuiește opțiunea implicită; `[]` nu bifează nimic, id-urile necunoscute cad;
  - `openAssistant` — doar în dialog: pornește pe asistent, cu focusul în chat;
  - `guideTopic` — `servicii` / `lucrari` / `service`, scris în blocul de origine ca
    `- Secțiune: <topic>`, doar pentru un topic cunoscut;
  - `attachment` — `{ kind: "calculator" | "builder", count, summary?, text }`, construit de
    chunk-ul unealtei HUD la predare.

  Surse noi: `guide`, `guide-prompt`, `os-calculator`, `os-builder`. Importurile noi din provider
  sunt toate `import type`.
- **`lib/request/attachment.ts`** (`attachmentBlock`): taie spațiile de la capete, scoate
  caracterele de control pe care API-ul le refuză (aceeași clasă ca `_CONTROL_RE` din backend) și
  limitează blocul la **1.200** de caractere cu `\n[…]`, fără să rupă o pereche surrogate (un emoji
  pe jumătate n-ar mai putea fi trimis la Telegram).
- **Mesajul trimis**: sumar → atașament → origine → transcript. Locul atașamentului și al originii e
  rezervat înainte ca sumarul să fie tăiat, deci totul rămâne ≤ 5.000 de caractere. În dialog, sub
  propunere, o linie spune ce pleacă („Selecția din calculator (servicii: 3 · de la 600€) pleacă
  împreună cu cererea.”), RO/RU/EN prin `L()` local — nicio cheie nouă de catalog. `payload.project`
  și `payload.estimate` își păstrează sensul.
- **Focusul la `openAssistant`**: efectul care mută focusul în panoul de chat rulează acum într-un
  microtask (anulat la cleanup). Cu chunk-ul fluxului deja încărcat, estimatorul se montează în
  același commit cu `Modal`, al cărui focus inițial rulează după și muta focusul pe primul control.
  Prins de testul nou; `Modal.tsx` e neschimbat.

**Added** — infrastructura HUD (`lib/hud/`, `components/hud/HudChrome.tsx`, **nemontat**) — vezi
[03](./docs/03-architecture.md#folder-structure)

- **`lib/hud/gate.ts`**, fără niciun import (îl încarcă și `playwright.config.ts`): cheia QA
  `tbs_hud` (`localStorage`; contează doar `"off"`; site-ul n-o scrie niciodată), evenimentele de
  armare (`pointermove`, `pointerdown`, `wheel`, `scroll`, `keydown`, `touchstart`, `focusin`) și
  `HUD_DESKTOP_MEDIA` `(min-width: 861px)`.
- **`HudChrome`**, singurul mount al HUD-ului (în Faza 4 intră în `app/(site)/layout.tsx`, între
  `<Footer />` și `<CookieConsent />`). Armează doar în ordinea: flag ≠ `off` → bannerul de cookie
  răspuns (răspunsul **este** interacțiunea) → prima interacțiune (listeneri pe `window`, pasivi,
  capture, scoși toți la primul) → intro-ul plecat → un slot idle. Abia apoi randează părțile leneșe,
  într-un singur commit. Lista de părți e goală; pe server nu randează nimic; demontarea anulează
  orice pas.
- **`lib/hud/busy.ts`** — store-ul „vizitatorul lucrează în HUD” (pe surse: `os-window`, `os-drag`;
  ascultătorii aud doar trecerea liber ↔ ocupat; scrierile de pe server sunt ignorate).
  **`lib/hud/obscure.ts`** — `covers` / `overlaps` pentru gărzile „focus neacoperit” (WCAG 2.4.11).

**Security** — o dependență nouă, o cheie QA — vezi [11](./docs/11-security.md) și
[`SECURITY.md`](./SECURITY.md)

- **`lucide-react` 1.46.0**, fixat exact: ISC, fără dependențe, fără script de instalare; o singură
  intrare nouă în lockfile (663 → 664), restul neschimbat. Iconițele sunt SVG inline din bundle —
  niciun fetch, font sau CDN — deci **CSP-ul e neschimbat**. Nimic nu îl importă încă, deci niciun
  chunk nu îl conține (verificat în `.next/static`).
- **ESLint + `scene-contract.test.ts`** refuză `lucide-react/dynamic` (`.js`, `.mjs`),
  `lucide-react/dynamicIconImports` (`.mjs`), `lucide-react/dist/*`, `import * as` / `export *` și
  `import("lucide-react")`: intrările dinamice și namespace-ul ar aduce toate cele ~4.200 de
  iconițe, iar `dist/*` nu e API public (pachetul n-are hartă `exports`). Doar
  `components/hud/**` îl poate importa la runtime, iar versiunea fixă e testată.
  `components/hud/**` intră și în lista fișierelor fără three / R3F / GSAP static, iar scanarea
  funcțiilor ScrollTrigger interzise (pin, snap, ScrollSmoother…) acoperă acum și `components/hud`
  și `lib/hud`.
- **`tbs_hud`** e în tabelul de storage din docs/11: citită doar, poate doar opri HUD-ul în acel
  browser; nu e o intrare în politica de cookie, pentru că site-ul n-o scrie.

**Changed** — E2E determinist când va exista HUD-ul (`playwright.config.ts`, `e2e/helpers.ts`)

- Fiecare context pornește cu `localStorage.tbs_hud = "off"`, ca un dock sau un prompt să nu apară
  în mijlocul unui spec peste controlul apăsat. `E2E_HUD=on` omite starea: rulare de sondaj, nu
  gate.
- Helperi: `HUD_ON` (un spec despre HUD: `test.use({ storageState: HUD_ON })`), `armHud(page)`,
  `consoleErrors(page, { allowMissing })` (implicit `["/api/content"]`), `decorativeDots` scanează
  și `[data-hud] *`, `expectRootUntouched` mutat din `interior-webgl.spec.ts`. Testul cu scrollbar
  clasic din `hud-shell.spec.ts` (context propriu) primește fixture-ul `storageState`.
- **Nicio aserțiune slăbită.** Detalii în [`e2e/README.md`](./e2e/README.md).

**Deploy**

- `package.json` + `package-lock.json`: `lucide-react` 1.46.0. Instalat în Docker (`tbs_nm_alpine`;
  `npm ci` în `tbs_nm_noble`), nimic pe host. Nicio variabilă de mediu nouă, nicio schimbare în
  compose sau nginx.

**Docs**

[02](./docs/02-tech-stack.md#the-hud-chrome-2026-09-17--lucide-react) `lucide-react` și regulile lui ·
[03](./docs/03-architecture.md) arborele (`components/hud/`, `lib/hud/`, `lib/request/`) ·
[04](./docs/04-design-system.md#cyber-dark--neon-cyan--obsidian-black) paleta, straturile 104/108/112,
plasarea, contrastul, regulile · [05](./docs/05-page-sections.md) contextul cererii ·
[11](./docs/11-security.md) + [`SECURITY.md`](./SECURITY.md) · [14](./docs/14-testing.md) ·
[`e2e/README.md`](./e2e/README.md).

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, arborele final) | curate: exit 0 · 0 · 0 |
| `npm test` (node:22-alpine) | **1.116 passed / 0 failed** în 63 de fișiere, rulat de 2 ori (înainte: 1.031 în 57) |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă, cu `tbs_hud=off` seedat) | **256 passed / 0 failed / 0 skipped** |
| `preloader` + `hud-shell` + `interior` + `interior-webgl`, `--repeat-each=3` | **267 passed** (89 × 3), 0 failed, 0 flaky |
| `E2E_HUD=on` (sondaj, fără flag): `hud-shell` + `keyboard` + `responsive` | **97 passed** — nimic nu se armează încă, deci identic cu gate-ul |
| Capturi înainte / după tokenuri (1280 și 390px, dark și light, 5 poziții de scroll) | **20 / 20 identice** byte cu byte |
| Mutații pe `HudChrome` (6 copii stricate: fără passive, fără pasul intro, listeneri nescoși, fără flag, listeneri înainte de consimțământ, consimțământ care cere încă o interacțiune) | toate 6 prinse de `hud-chrome.test.tsx` |
| Chunk-uri | nici `lucide` nici `tbs_hud` în `.next/static`; chunk-ul Tailwind identic byte cu byte |

Greutate (gzip, bytes; același script și aceleași cazuri ca în intrarea interiorului 3D; baza e coloana
*Final* de acolo):

| Buget | Caz | Bază | Faza 0 | Diferență |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine | total 261.169 · referit din HTML 256.279 · JS târziu 3.936 | total **262.164** · referit din HTML **257.274** · JS târziu 3.936 | +995: JS +796 (chunk-ul paginii cu estimatorul: catalogul cu id-uri, blocul de atașament și nota lui în trei limbi), CSS +199 (tokenurile); fără three / gsap — **noua bază** |
| B1s / B7 | B1 + scroll · pe mobil | JS târziu 3.936 | 3.936 | 0 |
| B2 | scenă forțată + scroll (desktop și mobil) | JS târziu 314.114 | 314.114 | 0 |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 322.881 | 322.881 | 0 |
| B3i | prima vizită, intro forțat | 303.826 | 303.826 | 0 |
| B4 | prima vizită | JS târziu 35.774 | 35.774 | 0 |
| B5 | `/servicii/e-commerce` | total 222.472 (limită 224.000) | **222.671** ✓ | +199 (CSS-ul tokenurilor) |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte | 3.219; 0 contexte | 0 |
| H | documentul HTML `/`, care revine | 22.087 (limită 22.230) | 22.085 ✓ | −2 (zgomot) |
| — | chunk-ul comun three + R3F + scene | 261.252 | neschimbat | 0 |

> **Rămâne deschis:** poarta de armare a HUD-ului e testată doar în jsdom; cursa consimțământ ↔
> prima interacțiune și armarea într-un browser real intră în `hud-integration.spec.ts` (Faza 4).
> Un `scroll` automat (un link `#hash`) sau un `focusin` din script contează ca primă interacțiune.
> Cifrele de contrast din docs/04 sunt calculate, nu măsurate pe pixeli: fiecare parte le remăsoară
> când apare. `e2e/request-flow.spec.ts` are încă propria copie a `SERVICE_FOR_TYPE`.

---

## 2026-09-17 — Interiorul devine o scenă 3D: Cybernetic Core, cinci modele de servicii, carduri holografice

Clientul a cerut ca interiorul site-ului să fie dinamic, cu modele 3D desenate procedural pe tema
IT / Software / AI, gândite întâi pentru telefon: un „Cybernetic Core" în hero (sferă de sticlă,
trei inele, nor de particule, tilt la mouse sau giroscop, puls la hover pe butoane), servicii cu
modele care se transformă la selecție, carduri de statistici holografice, GSAP ScrollTrigger
(modelul din hero trece în fundalul secțiunii următoare, parallax) și eliminarea punctelor
decorative. Contractele existente rămân: testele (nicio aserțiune veche slăbită), CSP-ul din
`proxy.ts`, regula „fără text hardcodat" și vizitatorul care revine fără three.js și fără GSAP.

Decizii confirmate cu clientul înainte de cod (D1–D8): **toate** bulinele decorative dispar, dar
„TBS." și punctul final al titlului rămân, fără halo și fără blink; **cinci modele, unul pe
direcție** (Produs digital → cuburi care se asamblează · Brand & UI → rețea wireframe cu valuri ·
Asistenți IA → rețea neuronală cu impulsuri · E-commerce → bucla Ofertă → Plată → Acces ·
Automatizare & API → hub de integrări); cardurile de proiecte primesc doar tilt și parallax, fără
model nou; 3D **doar pe dispozitive capabile**, încărcat după ce textul e pe ecran, iar telefoanele
slabe, Save-Data și animațiile reduse primesc **ilustrații statice** în același stil; pe telefon
**primul tap selectează, al doilea deschide** (ca dropdown-ul din header); „·" din texte rămâne;
restilizare HUD completă pentru Servicii și Proiecte (Tailwind), restul secțiunilor doar fără
buline. Arhitectura e în [03 — Architecture](./docs/03-architecture.md#the-interior-stage).

**Added** — scena interioară: un singur canvas WebGL sub pagină (`components/scene/`)

- **Un singur context WebGL, doar pe homepage.** `SceneStage` învelește Hero → Ticker → Directions.
  Primul lui copil e un track poziționat absolut (fără înălțime în layout, deci niciun offset de
  secțiune nu se mișcă) care ține un strat `sticky` sub header (`h-scene`: `100lvh` minus
  `--header-h`). Canvas-ul desenează acolo, iar cele trei secțiuni trec peste el. Ordinea de
  pictare: placa opacă a hero-ului (-20) → fundalul HUD (-10) → canvas → scrim-ul de telefon →
  textul. `isolate` pe stage ține totul sub header, meniul burger și bannerul de cookie. Pe stage
  și pe strămoșii stratului nu are voie să apară `transform`, `filter`, `contain` sau `overflow`
  (ar strica `sticky`).
- **Cybernetic Core**: sferă de sticlă (transmission cu mediu PMREM procedural pe tier-ul high,
  un shader „frost" pe mid), nucleu wireframe, trei inele torus cu înclinările orbitelor din
  intro, nor de particule. Tilt la mouse (`pointermove` pasiv pe `window`) și la giroscop pe
  touch, **doar unde merge fără permisiune**: `DeviceOrientationEvent.requestPermission()` nu e
  apelat niciodată, deci iOS păstrează legănarea lentă și nu arată niciun prompt. Hover sau focus
  de tastatură pe un CTA din hero luminează nucleul (fără sunet).
- **Cinci modele + un roi de particule care se transformă între ele** (`three/models/*`,
  `three/swarm.ts`): 0.32s dizolvare, 0.5s reformare. Morph-ul pornește doar după ce predarea
  hero → servicii e completă; în timpul predării o schimbare de direcție e instantanee. Modelele
  se leagănă ±0.42 rad în loc să se rotească complet (o tură întreagă le-ar pune pe muchie).
- **Coregrafia** (`choreography.ts`, pură, testată ca tabele): directorul măsoară spanurile de
  scroll, scena citește `window.scrollY` o dată pe cadru și urmează ancorele DOM cu un factor de
  parallax sub 1 (≤0.65 pe touch), ca decalajul de un cadru al canvas-ului lipit să arate ca
  adâncime. Sub 861px nucleul stă **în spatele textului**, estompat pe temă (vezi *Fixed*).
- **Tier-uri** (`tiers.ts`): high — sticlă cu transmission, 1.400 de particule în nor, roi de 720,
  DPR 1–1.75 într-un buget de 2.6M pixeli; mid — frost, 700 / 420, DPR 1–1.5 în 1.25M; low nu
  primește niciodată canvas. „Lite" (pasul terminal al governor-ului) înjumătățește punctele.
- **Governor-ul FPS poate renunța** (`components/three/governor.ts`, opțiunea nouă `bail`): după
  „lite", 4 ferestre la rând sub 28 fps → `bail`, iar dispozitivul rămâne pe ilustrația statică
  toată sesiunea. Intro-ul nu trimite opțiunea (comportament neschimbat); scena forțată pentru QA
  nu renunță niciodată.
- **Șase familii de shadere** (`three/materials.ts`), toate cu `CustomBlending`: schimbarea temei
  comută doar factorii de blend („glow" pe dark, „ink" pe light), **fără recompilare**. Culorile
  vin din tokenuri (`--cyan --blue --blue-text --red-lift --red-text --txt --bg --on-accent`,
  obligatoriu hex sau `rgb()`); un token ilizibil la montare ajunge la error boundary, iar pagina
  rămâne pe ilustrație.

**Added** — încărcarea, în ordinea în care se întâmplă (`SceneStage.tsx`)

1. **La montare**, porți citite live, niciodată din cache: `localStorage.tbs_scene_3d=off` → `off`;
   fără `ResizeObserver` → `fallback`; reduced motion / Save-Data / 2G → `off`; tier low →
   `fallback`. `data-motion="live"` doar cu toate porțile deschise și un tier peste low.
2. **După ce intro-ul a plecat** (`tbs:intro-gone`) și un slot idle (`afterIdle`: 1.5s de timp
   vizibil, +0.6s după un intro, cât îi ia R3F să elibereze contextul intro-ului): răspunsul GPU
   din `sessionStorage.tbs_gpu_probe`, altfel chunk-ul de probe, care creează un context
   de test pe un canvas detașat și îl eliberează imediat.
3. **`detectSceneTier`** (`lib/device.ts`), intenționat mai larg decât al intro-ului: Chrome rotunjește
   `deviceMemory` în jos (un telefon de 6 GB raportează 4), deci pe touch doar sub 4 GB e low,
   altfel mid (niciodată high). „Capabil" îl decide governor-ul, nu specificațiile.
4. **WebGL decis** → `SceneCanvas` (three + R3F) și `SceneDirector` (GSAP + ScrollTrigger) se
   montează în același commit, prin `next/dynamic`. Scena vine prin **`components/three/runtime.tsx`**,
   aceeași țintă `import()` ca intro-ul: un singur chunk three/R3F pentru ambele scene (înainte
   erau două copii identice de 238.715 B gzip).
5. **Construită și compilată în felii idle**: nucleul, roiul, apoi câte un model pe felie; apoi un
   obiect de desenat compilat pe felie. **Gata** abia după ce R3F a desenat efectiv două cadre ale
   scenei compilate (numărat din `useFrame`); `data-renderer="webgl"` când scena e gata **și**
   directorul a măsurat. Ilustrația face crossfade în 500ms (CSS).
6. **La rulare**: reduced motion pornit → `off`; context pierdut cu tab-ul vizibil sau `bail` →
   `fallback` pentru restul sesiunii (`markGpu`); context pierdut cu tab-ul ascuns (iOS în
   background) → un singur remount la revenire; o eroare de randare → `fallback`.
- **Pauză** (`frameloop="never"`, contextul se păstrează) cât stage-ul e în afara ecranului, tab-ul
  e ascuns sau ceva acoperă pagina (burger, intro, dialog — `tbs:page-cover`).
- **DPR-ul se recalculează** la resize (debounce 200ms) și la mutarea ferestrei pe un ecran cu alt
  pixel ratio (`pixelRatio.ts`).

**Added** — GSAP ScrollTrigger doar ca instrument de măsură (`SceneDirector.tsx`, `scrollGuard.ts`,
`scrollProbe.ts`)

- Două ScrollTrigger fără animație dau spanurile: `heroExit` (`#top`, „top top" → „bottom 35%") și
  `handoff` (ancora serviciilor, „top 95%" → „center 55%"); fiecare refresh recitește în `probe`
  cutiile ancorelor, marginile stage-ului și `--header-h`. **Niciun scrub nu mișcă scena**, deci
  nu rămâne cu un cadru în urma paginii.
- **Parallax în hero doar pe desktop capabil** (`PARALLAX_MEDIA`: ≥861px, hover + pointer fin,
  fără reduced motion): `data-parallax="hero-backdrop"` +12% și `"hero-stats"` −8%, identitate la
  scroll 0. Niciodată pe un marker de intrare, pe un `[data-reveal]`, pe `<html>` sau `<body>`.
- **Interzise** sub `components/scene/**`: pin, snap, `normalizeScroll`, ScrollSmoother, markers,
  scroller propriu, `lagSmoothing` (test de contract).
- **Refresh-urile rămân inofensive**: `html[data-scroll-measure]` face instant saltul la 0 și
  înapoi (altfel gsap lăsa `scroll-behavior` inline pe `<html>`); `ResizeObserver` pe **stage** (nu
  pe `<main>`, ca pașii estimatorului să nu coste un refresh complet), amânat cât vizitatorul
  derulează, deduplicat; un refresh la restaurarea din bfcache; **nicio măsurătoare sub un cover**
  (vezi *Fixed*).
- **ScrollTrigger e oprit când nu-l mai folosește nimeni** (`quietScrollTrigger` /
  `wakeScrollTrigger`): după plecarea de pe `/`, bucla lui rAF și intervalul de 250ms rulau tot
  restul vizitei — măsurat pe 10s idle: 64 de callback-uri rAF și 4 treziri de timer pe secundă,
  12.3–12.6 ms/s de main thread; acum 0 rAF și 1.54–1.58 ms/s (pagina fără el: 1.5–1.7).
  Depinde de interne din gsap 3.15.0 (versiune fixată exact).

**Added** — ilustrațiile statice (`components/scene/art/`)

- `HeroCoreArt` (un singur SVG: sferă, nucleu, inele proiectate exact din înclinările scenei,
  particule ca liniuțe și cruci) și `ServiceArt` (câte un desen pe direcție), cu proporțiile
  modelelor 3D. Server components cu câte un CSS Module, nu Tailwind; doar tokenuri, linii
  `non-scaling-stroke`, capete drepte, niciun cerc sub r=12; `aria-hidden`, fără text.
- **Statice prin decizie** (D4): nicio animație infinită. Singurele mișcări sunt o singură intrare
  (`materialize`, 0.45s) la schimbarea direcției și un val de lumină (1.1s) pe
  `[data-scene-stage][data-boost]` cât un CTA din hero e sub mouse sau în focus de tastatură; ambele
  dispar la reduced motion. Sub `data-renderer="webgl"` ilustrația se stinge în 500ms.
- **Doar desenul primei direcții e în HTML** (slotul `initialArt` din `page.tsx`); celelalte patru
  vin dintr-un chunk lazy (6.372 B gzip) la prima schimbare de direcție. Toate cinci plecau înainte
  în payload-ul RSC al fiecărui răspuns HTML (vezi *Fixed*).

**Changed** — Hero (`components/sections/Hero.tsx`) — vezi [05](./docs/05-page-sections.md#01--hero)

- **Ancora nucleului** (`data-testid="scene-hero"`, `data-scene-anchor="hero"`): pe telefon centrată
  în spatele titlului, la `--hero-core-phone`; între 861 și 1024px **pe cusătura dintre coloane,
  ridicată sus** (cardurile acopereau 86–88% din sferă; acum 34–39%, 16% la 900×800); de la 1025px
  în coloana din dreapta, la putere plină.
- **Scrim de telefon** (`data-scene-scrim`, sub 861px) cu tăria din tokenul `--hero-scrim`.
- **Boost pe CTA-uri**: hover cu mouse sau stylus (niciodată cu degetul — un tap nu are hover care
  să se termine) și focus **vizibil** de tastatură; hover și focus sunt motive separate, iar scena
  aude „oricare".
- **Carduri de statistici holografice**: un octaedru wireframe (portofoliu) și un giroscop din patru
  cercuri mari (automatizări), CSS 3D pe linii de 1px, fără puncte în vârfuri (`lib/hologram.ts`).
  Se rotesc doar cu `data-motion="live"`, intro-ul plecat și hero-ul pe ecran; altfel stau pe o
  poză de trei sferturi. **Tilt 8°** sub mouse (`usePointerTilt`): tilt-ul e `transform`, ridicarea
  la hover `translate`, deci nu se bat; markerul de intrare nu primește niciodată stil.
- Straturile de fundal și statisticile au învelișuri `data-parallax` pentru parallax-ul de desktop.
  `isolate` și `bg-bg` au plecat de pe secțiune (ar fi ridicat placa peste canvas).

**Changed** — Directions, rescris în Tailwind (`Directions.module.css` șters) — vezi [05](./docs/05-page-sections.md#directions)

- **Pastilele sunt linkuri reale.** Mouse: hover selectează, click deschide pagina. Tastatură:
  focus selectează, Enter deschide; **←/→ trec între pastile și sar la capete, Home/End la prima /
  ultima**; ↑/↓ derulează pagina ca înainte; combinațiile cu Alt/Ctrl/Meta nu sunt interceptate;
  niciun tab stop nou. **Touch / stylus**: primul tap pe **altă** pastilă o selectează (modelul și
  previzualizarea se schimbă) și rămâne pe pagină, al doilea o deschide; **pastila deja selectată
  se deschide din primul tap**; „Deschide serviciul →" navighează mereu din primul tap; un swipe
  care devine `pointercancel` nu lasă nimic armat. Regula e `shouldInterceptTap`, mutată în
  `lib/tapIntent.ts` și comună cu dropdown-urile din header.
- Pastila selectată arată un „↗" `aria-hidden`: numele accesibil rămâne eticheta.
- **Ecranul HUD** (`data-testid="scene-services"`, `data-shape=<slug>`): grilă cu fade radial,
  lumină în culoarea direcției, linie de scanare (pe pauză sub intro și în afara ecranului, ascunsă
  la reduced motion), colțare; ancora `data-scene-anchor="services"` unde scena pune modelul, apoi
  cardul de caz. Sub 861px ecranul vine **primul**, chiar sub pastile, ca tap-ul să schimbe modelul
  din fața ochilor; de la 1025px modelul stă lângă card. Sub 641px rândul de pastile e o bandă care
  derulează în ea însăși.
- **Înălțimi minime măsurate pe limbă și pe bandă de lățime**: selectarea unei direcții nu mai
  mișcă nimic sub secțiune (verificat pe 92 de lățimi × RO/RU/EN × 5 direcții, iar după ultimele
  reparații pe 27 de cazuri limbă × lățime).
- Etichetele proiectului din cardul de caz păstrează „·" între chip-uri.

**Changed** — Work, rescris în Tailwind (`Work.module.css` șters) — vezi [05](./docs/05-page-sections.md#work)

- **Card HUD**: gradientul proiectului (`--p1/--p2`), margine neon în culoarea lui la hover și la
  focus de tastatură, colțare care se desenează din colțuri, linie de accent sus, reflexie de
  sticlă **fără** `backdrop-filter`, indexul `01`… cu contur, o casetă-săgeată pe cardurile cu link.
- **Tilt 6°** doar cu mouse și doar de la 641px (sub, cardurile sunt o bandă derulabilă).
- **Parallax CSS pe captura de ecran**, pe compozitor și fără JavaScript: `view-work` pe secțiune,
  `parallax-media` pe învelișul imaginii (scroll-driven animations). Unde nu există (Firefox) sau la
  reduced motion, imaginea stă pe loc.
- **Etichetele sunt chip-uri pe o placă de cerneală de 72%**, iar „·"-ul din admin rămâne text
  vizibil între ele (numele accesibil e tot „CRM PRIVAT · FĂRĂ LINK"); chip-urile nu mai au blur.
- ≤900px două coloane, cu ultimul card impar pe tot rândul; ≤640px o bandă cu snap, fără
  auto-derulare.

**Changed** — Ticker: separatoarele rotunde devin **linii neon înclinate** de 1px (lățimea în layout
rămâne 1px, deci bucla fără cusătură se păstrează).

**Removed** — punctele decorative (D1)

- Bulina ceasului `SYS_TIME`, bulina clipitoare din eyebrow-ul hero, bulinele din notițele
  cardurilor de statistici și glow-ul lor de colț, halo-ul punctului din logo și glow-ul punctului
  final al titlului, punctele roșii dintre cuvintele ticker-ului, bulina de stare din chatul
  estimatorului, animația `hud-blink`.
- **Rămân, intenționat**: „TBS." din logo și punctul final roșu al titlului (glife simple, fără glow),
  „." roșu din footer, bulina de înregistrare a butonului de dictare (indicator de
  confidențialitate), marcajele „✓", fiecare „·" din texte și date, fallback-ul intro-ului.
- Păzite de `decorative-dots.test.tsx` (sursă + randare în trei limbi) și de E2/E3, care scanează
  pagina randată la 1280 și 390px.

**Added** — module comune

- `components/three/*` — ajutoarele 3D mutate din intro și folosite de ambele scene: `capability`
  (probe-ul GPU), `renderer`, `governor` (+ `bail`), `motion`, `random`, `palette`, `glow`,
  `environment`, `hooks`, `RenderErrorBoundary` (fostul `IntroErrorBoundary`) și `runtime.tsx`.
  `components/intro/three/*` reexportă ce s-a mutat; `intro/three/renderer.ts` e șters;
  tier-urile intro-ului sunt în `components/intro/tiers.ts`.
- `components/fx/useOffscreenAttribute.ts` (mutat din Hero) și `usePointerTilt.ts`.
- `lib/scene.ts` — contractul stage-ului: cheia QA, porțile, atributele `data-*`, maparea direcții →
  modele, **store-ul de input pagină → scenă** (boost, `waveSeq`, forma selectată; fără eveniment pe
  `window`) și `ScrollProbe`. `lib/gpuProbe.ts` — cache-ul probe-ului, fără importuri, ca chunk-ul
  de probe al intro-ului să nu tragă după el tot contractul (3.195 → 1.945 B).
- `lib/device.ts`, `lib/tapIntent.ts`, `lib/tilt.ts`, `lib/idle.ts` (`afterIdle`), `lib/hologram.ts`.
- **Două evenimente noi pe `window`**: `tbs:intro-gone` (`lib/intro.ts`: overlay-ul a plecat din DOM;
  `onIntroGone()` răspunde sincron când nu există) și `tbs:page-cover` (`lib/scrollLock.ts`:
  `coverPage()` cu contor de referințe, ținut de lock-ul burger / intro și de lock-ul `Modal`).

**Added** — teste

- **Unitare** — 21 de fișiere noi (înainte: 566 de teste în 36 de fișiere; totalul final e în tabelul
  *Verificare*; numerele de mai jos sunt din rularea de verificare): `lib/__tests__/` `scene` (53),
  `device` (24), `tilt` (15), `idle` (10), `tapIntent` (7), `hologram` (7); `service-art` (43),
  `scene-choreography` (38), `scroll-guard` (30), `scene-stage` (29), `hero-interior` (22),
  `three-shared` (21), `scene-shapes` (20), `hero-core-art` (20), `decorative-dots` (12),
  `scene-tiers` (12), `scene-build` (12), `scene-input` (11), `scene-contract` (10),
  `scene-palette` (10), `pointer-tilt` (10). Extinse: `directions-selector` 12 → 32, `work` 9 → 14,
  `intro-capability` 18 → 26, `intro` 20 → 26, `scrollLock` 12 → 17, `intro-preloader` 24 → 27,
  `modal` 18 → 20. `scroll-guard` rulează gsap 3.15.0 real în jsdom (firul de declanșare pentru
  internele de care depind garda și quiet/wake). Reparațiile au fost verificate prin mutații
  (codul stricat intenționat face testul să pice; la reparațiile din Directions / Work / hero 14
  din 15 mutații prinse — scăparea e o marjă de rotunjire pe care seed-ul actual nu o atinge).
- **E2E** — `e2e/interior.spec.ts` (drumul implicit: ilustrația statică, E1–E16) și
  `e2e/interior-webgl.spec.ts` (WebGL forțat, eticheta `@webgl`, 120s pe test, W1–W14), plus un
  test „fără scroll lateral în stage" pe fiecare viewport și temă în `responsive.spec.ts`.
  `gotoHydrated` seedează acum și `sessionStorage.tbs_gpu_probe` cu răspunsul SwiftShader
  (`{ seedGpuProbe: false }` pentru testele despre probe), ca stage-ul să nu mai creeze un context
  de test în ferestrele de timp ale altor specuri. Helperi noi: `forceScene3d` / `disableScene3d`,
  `seedGpuProbe`, `trackWebGLContexts` / `liveWebGLContexts`, `recordSceneAttributes`,
  `sceneProbeVsDom` / `probeMismatches` (citesc probe-ul prin props-urile React), `decorativeDots`,
  `scrollToY`; `burgerRoundTrip` s-a mutat din `hud-shell.spec.ts`. Vezi
  [14 — Testing](./docs/14-testing.md) și [`e2e/README.md`](./e2e/README.md).
- **Nicio aserțiune veche slăbită.** Verificările de buline din `ticker` și `hud-shell` au devenit
  verificări mai stricte de linii; `preloader.spec.ts` a primit cele cinci modificări planificate
  pentru stage, cu toate aserțiunile păstrate. Singura aserțiune schimbată cu permisiune e cea
  care fixa bug-ul: „pastila selectată implicit cere și ea un prim tap" → „pastila deja selectată
  se deschide din primul tap". Câteva teste noi ale redesign-ului au fost corectate odată cu
  reparațiile lor (semnele inversate 90/270 ale giroscopului, `ResizeObserver` pe `<main>` → pe
  stage, un import `three/addons/math/*` acum interzis).

**Fixed**

- **Sticla ieșea gri, și în intro.** `installTransmissionClear` curăța ținta liniară a
  transmission-ului cu o culoare deja convertită în sRGB: pe o pagină aproape neagră ~0.04 în loc
  de ~0.003. Compensarea e acum centrală (`linearTargetClearColor`), scenele trimit culoarea
  paginii ca atare. **Tubul de sticlă al intro-ului e vizibil mai închis** — cere acordul
  clientului.
- **Cardul de proiect pe tot rândul** (641–900px) mărea captura de ~2× și adresa de e-mail din
  captura Flirt se putea citi. Captura stă acum pe jumătatea din dreapta, la mărimea unui card
  normal (442px față de 435px la 1280).
- **Nucleul pe telefon** (`--hero-core-phone`, `--hero-scrim`, noi în `globals.css`): pe dark
  ilustrația avea luminozitate 0.3 față de 1.03 a canvas-ului, deci pagina se lumina vizibil la
  trecerea pe WebGL (acum 0.95–1.01 față de 1.02–1.04); pe light, peste WebGL forțat la 390px, 5.7%
  din pixelii lead-ului erau sub 4.5:1 (minim 4.17) — acum 100% (minim 4.63).
- **Găsite de cele trei review-uri și reparate** (fiecare verificat întâi pe codul curent):
  - **(înalt) Un refresh ScrollTrigger cu dialogul de cerere deschis salva poziții greșite cu
    offset-ul de scroll** și rămâneau greșite după închidere (dialogul fixează `<body>`, deci
    `scrollY` e 0): desktop la Y=3000, resize 1280→1100 → `stage.top` −2929 în loc de 71; telefon
    la Y=2500, tastatura Android 844→450→844 → `handoff` [−1832, −1508] în loc de [293, 775]. Sus,
    în capul paginii, nucleul dispărea. Acum sub un cover nu se scrie nimic în probe, un refresh
    rulat totuși se refă la un cadru după ce cover-ul se ridică, iar `Modal` și `lockRootScroll`
    **eliberează cover-ul ultimul**, după ce au pus pagina la loc. Restaurarea scroll-ului din
    `Modal` e acum `behavior: "instant"` (urca de la 0 în ~26 de cadre, cu `<body>` încă fix).
  - **(mediu) Stage-ul trecea pe `webgl` înainte să fi desenat ceva**: încărcat cu stage-ul în afara
    ecranului (reload cu scroll restaurat, deep link), ilustrația dispărea și la întoarcere ecranul
    rămânea gol ~457ms. „Gata" se numără acum în cadre desenate; un canvas pe pauză rămâne `pending`
    și își păstrează ilustrația.
  - **(mediu) Lead-ul hero pe telefoane light peste WebGL**: 89.6–94.9% din pixeli ≥4.5:1 (minim
    4.02). Nucleul din spatele textului e acum estompat pe temă: sub 641px 0.55 dark / 0.4 light;
    641–860px 0.35 dark / 0.3 light (înainte 0.8).
  - **(mediu) HTML-ul de pe `/` depășea bugetul H** cu desenele din payload-ul RSC: H de la 25.821 la
    22.091 B (vizită nouă 28.205 → 24.586, payload RSC 9.097 → 5.599). Varianta „desenate în
    browser" a fost construită și măsurată: H 21.865, dar +6.973 B de JS pe pagină, deci respinsă.
  - **(mediu) Primul tap pe pastila deja selectată nu făcea nimic** pe touch — acum o deschide.
  - **(mediu, perf.) ScrollTrigger rula după plecarea de pe `/`** — vezi quiet/wake mai sus; testat și
    pentru bail, eroare și demontarea paginii.
  - (scăzut) Tilt-ul de giroscop se bloca la limită în landscape (90 și 270 erau inversate, iar
    înclinarea de repaus se lua pe axa greșită); `ResizeObserver` pe `<main>` → pe stage; DPR-ul
    fixat la montare; interdicția de importuri grele vedea doar numele exacte (vezi *Security*);
    boost-ul rămânea aprins după închiderea dialogului cu mouse-ul (focusul returnat de dialog nu e
    `:focus-visible`); detectorul de buline rata `rounded-pill` și `rounded-[50%]`; nimic nu fixa
    că „↗" e `aria-hidden`; „·" dispărea dintre etichetele din Work; blur live pe ~14 chip-uri peste
    capturi animate.
- **TBT**: construcția scenei (181–192ms) și compilarea shaderelor (96–119ms), două task-uri lungi,
  sunt acum felii idle; cel mai mare task nou rămas: 52–86ms. JS-ul scenei a scăzut de la 448 la
  **299ms** TBT (sub 350), dar TBT-ul adăugat total rămâne peste buget — vezi *Rămâne deschis*.
- Intro-ul nu mai descarcă three.js de două ori (vezi pasul 4 al încărcării).

**Security**

- **CSP-ul din `proxy.ts` e neschimbat.** Scena e procedurală (fără fetch, workers, wasm); chunk-urile
  scenei, directorului, gsap, probe-ului și stage-ului nu conțin `eval`, `new Function`, `Worker`,
  `WebAssembly` sau `createObjectURL`. Stilurile inline (`--accent`, `--p1/--p2`, transformările
  hologramelor, scrierile R3F și GSAP) vin din constante și intră în `style-src 'unsafe-inline'`,
  care exista deja. `interior.spec.ts` și `interior-webgl.spec.ts` verifică 0 încălcări CSP la
  fiecare rulare.
- **ESLint interzice ce ar strica CSP-ul sau greutatea**: peste tot `gsap/all`, `gsap/dist/*`,
  ScrollSmoother și `gsap-trial` (ca `import` și ca `import()`); în fișierele care ajung în
  bundle-ul paginii (`app/**`, secțiuni, layout, `ui`, `fx`, `SceneStage`, arta, `lib/**`, shell-ul
  intro-ului și ambele chunk-uri de probe) orice import **static** de `three`, `@react-three/fiber`,
  `gsap`, `@gsap/react`, orice subcale a lor (`gsap/ScrollTrigger.js`, `three/webgpu`…) și
  modulele proprii care le poartă (`three/runtime`, `SceneCanvas`, `SceneWorld`, `SceneDirector`,
  `IntroScene`, `IntroDirector`), în orice scriere. `import type` rămâne permis.
  `scene-contract.test.ts` oglindește lista. Verificat cu 20 de probe de lint prin stdin.
- **`tbs_gpu_probe`** (`sessionStorage`): doar booleeni (`context`, `software`, opțional `lost` /
  `slow`), versionat, reconstruit la citire și scriere — **niciodată șirul renderer-ului**, care ar
  fi o amprentă. Listat ca esențial în politica de cookie, RO/RU/EN. `tbs_scene_3d`
  (`localStorage`) e o cheie de QA doar citită.
- Testele E2E citesc probe-ul scenei prin props-urile React, deci producția nu expune nimic nou pe
  `window`. Vezi [11 — Security](./docs/11-security.md#the-interior-3d-stage-2026-09-17) și
  [`SECURITY.md`](./SECURITY.md).

**Deploy**

- **Nicio dependență nouă**: ScrollTrigger vine în pachetul `gsap` deja fixat; `package.json` și
  lockfile-ul sunt neschimbate. Nicio variabilă de mediu nouă, nicio schimbare în compose sau nginx.

**Docs**

[02](./docs/02-tech-stack.md) ScrollTrigger, fără dependențe noi ·
[03](./docs/03-architecture.md) arborele (`components/scene/**`, `components/three/**`,
`components/fx/*`, modulele noi din `lib/`), încărcarea stage-ului, evenimentele, store-ul de input ·
[04](./docs/04-design-system.md) ordinea de pictare, utilitarele și keyframe-urile noi, tokenurile
`--hero-core-phone` / `--hero-scrim`, regulile ilustrațiilor, holograme, tilt, cardurile Work ·
[05](./docs/05-page-sections.md) scena interioară, Hero, Ticker, Directions, Work rescrise (textul
vechi despre galerie și lightbox scos) · [07](./docs/07-conventions.md) fișierele Tailwind, regulile
3D / GSAP / stage · [09](./docs/09-admin.md) · [11](./docs/11-security.md) +
[`SECURITY.md`](./SECURITY.md) · [14](./docs/14-testing.md) · [16](./docs/16-i18n-seo.md) ·
[`e2e/README.md`](./e2e/README.md) · tabelul de documente din [`README.md`](./README.md).

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, arborele final) | curate: exit 0 · 0 · 0 (lint fără output; tsc și lint rerulate după ultimele editări de comentarii) |
| `npm test` (node:22-alpine) | **1.031 passed / 0 failed** în 57 de fișiere, rulat de 2 ori (înainte: 566 în 36 de fișiere) |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă) | **256 passed / 0 failed / 0 skipped** în 15 specuri (înainte: 206 în 13 specuri) |
| `preloader` + `hud-shell` + `interior` + `interior-webgl`, `--repeat-each=3` | **267 passed** (89 × 3), 0 failed, 0 flaky |
| TBT, WebGL forțat, tier mid, 390×844, CPU 4×, 3 rulări (mediane) | fără scenă 120ms · cu scena forțată 938ms · adăugat 818ms (JS-ul scenei singur ≈299ms după reparația D1; restul e evaluarea chunk-ului three ≈250–285ms și așteptarea SwiftShader ≈550ms, specifică randării software headless) |
| CSP | 0 încălcări cerute de `interior.spec.ts` (E1) și `interior-webgl.spec.ts` (W1) la fiecare rulare; rezultatul e în rândul E2E |
| Contrast (pixeli sub textul ascuns; măsurat la integrare și la reparații) | peste WebGL forțat, 4 cadre pe caz: tot textul din hero 100% ≥4.5:1 la 375 / 390 / 412 / 768px în ambele teme (lead minim 4.51 light, 5.49 dark) și la 844×390; dark 320–1280 100% (minim 5.67), textul din Directions 100% (minim 6.01); light 1024 / 1280 100% (minim 4.51); light 861: lead 99.97% (minim 4.50), eyebrow 99.69% (minim 4.09, pe linia de 1px a grilei HUD, identic fără WebGL); titlul 98.6–99.98% ≥4.5:1, minim 3.3 (text mare: pragul lui e 3:1). Chip-urile Work ≥9.34:1 și separatoarele „·" ≥9.40:1, ambele teme, 1280 și 390px |

Greutate (gzip, bytes; același script ca în intrarea din 2026-09-16, extins în Stage 0 cu
`SCROLL`, `FORCE_SCENE`, `MOBILE`, `REDUCED_MOTION`). **Bugetele sunt re-stabilite explicit aici:**
coloana *Final* e noua bază față de care se măsoară următoarea schimbare, inclusiv pe rândurile
unde depășește limita planului — o decizie, nu o scăpare.

| Buget | Caz | B0 (Stage 0, înainte de redesign) | Limita din plan | Final — noua bază |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine | total 244.904 · referit din HTML 240.731 · JS târziu 3.219 | ≤ 258.000 · ≤ 253.000 · ≤ 5.000; fără three, fără gsap | total **261.169** · referit din HTML **256.279** · JS târziu 3.936; fără three/gsap — peste limita planului cu 3.169 / 3.279 (CSS Tailwind + rescrierile Directions/Work + SceneStage), acceptat ca nouă bază |
| B1s | B1 + scroll până jos | JS târziu 3.219 (scroll-ul adaugă 0) | ≤ 5.019 | 3.936 ✓ |
| B2 | `/` care revine, scenă forțată + scroll | JS târziu 3.219 (stage-ul nu exista) | ≤ B1s + 316.000; `webgl`; fiecare marker într-un singur fișier | JS târziu 314.114 ✓ · `webgl` · fiecare marker într-un fișier ✓ |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 277.815 | ≤ 330.000; `__THREE__` într-un fișier; o singură versiune gsap | JS târziu 322.881 ✓ · `__THREE__` într-un fișier · 1 versiune gsap |
| B3i | prima vizită, intro forțat | JS târziu 277.815 | ≤ 300.000 | **303.826** — peste cu 3.826 (chunk-ul comun aduce și scena interiorului), acceptat |
| B4 | prima vizită | JS târziu 35.570 | ≤ 36.500; fără three | 35.774 ✓ |
| B5 | `/servicii/e-commerce` | total 217.912 | ≤ 224.000; fără three, gsap, probe sau stage | 222.472 ✓ |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte WebGL | ≤ 3.500; 0 contexte | 3.219 ✓ · 0 contexte |
| B7 | B1 și B2 pe mobil (390×844) | ca B1 / B2 | aceleași limite; B2 cu `data-tier="mid"` | B1 mobil ca B1 (261.169, peste, acceptat) · B2 mobil 314.114 ✓ cu `data-tier="mid"` |
| H | documentul HTML `/`, care revine | ~14.230 (14.227–14.234) | ≤ 22.230 (+8.000) | 22.087 ✓ (prima vizită 24.590) |
| — | chunk-ul comun three + R3F + ambele scene | 242.108 (doar three + R3F, al intro-ului) | ≤ 260.500 (242.500 + 18.000 scena) | **261.252** — peste cu 752, conține three + R3F + ambele scene, acceptat |
| CSS | cele două module ale ilustrațiilor | — | ≤ 2.500 | 1.113 ✓ |
| TBT | adăugat de scenă (tier mid forțat, CPU 4×) | — (fără scenă; baza măsurată: mediană 271ms) | ≤ 350ms; niciun task al scenei > 400ms | adăugat 818ms (bază 120 → 938); JS-ul scenei ≈299ms ✓; cel mai lung task JS 246–284ms ✓; task-ul de 548–568ms e așteptare SwiftShader (headless) — de verificat pe dispozitive reale |

Istoric, pentru context: la integrare (Stage C) erau peste limită TBT-ul, B1 (total 260.861,
referit din HTML 255.971), H (25.820), B3i (301.442), chunk-ul comun (261.228, +728) și B7 pentru
B1. Reparațiile au adus H sub limită (22.091) și JS-ul scenei la 299ms TBT; totalul B1 a crescut cu
307 B (261.168). TBT-ul adăugat total rămânea 943ms (mediană): evaluarea
chunk-ului 3D (267–289ms, pe care feliile nu îl pot scurta), crearea contextului (92–97ms) și
citirea înapoi din SwiftShader (579–598ms, randare software headless).

> **Rămâne deschis, cu cifre:**
> - **Bugetele peste limită** în coloana *Final* de mai sus rămân re-stabilite, nu rezolvate:
>   CSS-ul Tailwind (+3.814 B la integrare) și JS-ul paginii (+11.404 B: stage, `lib/scene`,
>   rescrierile Directions și Work) sunt prețul redesign-ului pe B1.
> - **TBT-ul e măsurat pe SwiftShader**, care amestecă așteptări după GPU; trebuie verificat pe un
>   dispozitiv real.
> - **Neverificat pe hardware real**: FPS-ul pe telefoane iOS și Android, timpul de compilare pe iOS,
>   Low Power Mode, VoiceOver / TalkBack față de regula primului tap (dacă activarea din cititorul de
>   ecran nu trimite `pointerdown` de touch).
> - **Giroscopul pe iOS** nu e folosit deloc (nu cerem permisiunea, deci nu apare niciun prompt);
>   iOS păstrează legănarea lentă. Maparea landscape pe Android e calculată din specificație, nu
>   verificată pe dispozitiv.
> - **Captura Flirt** (`public/projects/flirt-1.png`) conține o adresă de e-mail. Acum apare mică, la
>   aceeași scară în fiecare card; înlocuirea imaginii e o decizie de conținut.
> - **Sticla intro-ului e mai închisă** după reparația culorii de clear — cere acordul clientului.
> - **Ilustrația statică la 768px, tema light**: lead-ul are 99.6–99.7% din pixeli ≥4.5:1 (minim
>   4.18). `--hero-core-phone` n-a fost remăsurat după noile estompări ale nucleului (0.4 light pe
>   telefon, 641–860px mai închis în ambele teme), deci crossfade-ul ilustrație → canvas poate să nu
>   mai fie perfect egal.
> - La 861px inelele nucleului trec pe sub capătul titlului.
> - **Înălțimile minime din Directions sunt valori măsurate**: text nou, un proiect mai lung în admin
>   sau metricile fonturilor în Safari / Firefox pot readuce o deplasare de câțiva pixeli (unealta
>   de măsurare e în scratchpad-ul lucrării, nu în repo).
> - Quiet/wake-ul ScrollTrigger și garda de smooth-scroll depind de interne din gsap 3.15.0: la
>   orice upgrade, W1, W4 și `scroll-guard.test.ts` sunt firele de declanșare.
> - Nouă învelișuri de imagine animate în Work = nouă straturi GPU; nemăsurat pe dispozitive slabe.
> - Umplerile `color-mix()` cad pe `var(--bg)` în browserele vechi; lungimile de liniuță cu
>   `non-scaling-stroke` au fost verificate doar în Chromium.

## 2026-09-16 — Primul ecran devine HUD: preloader 3D, header cu ceas, dark implicit

Clientul a cerut primul ecran în stil hi-tech / cyberpunk HUD: un preloader cu un ∞ din sticlă
și `SYSTEM_SYNCHRONIZATION: NN%`, un header cu logo „TBS." și ceas `SYS_TIME`, meniu cu „+",
un hero cu neon și statistici din sticlă, un ticker cu puncte roșii și un banner de cookie din
sticlă, totul gândit întâi pentru telefon. Explorarea a arătat că **~80% din piese existau
deja**, deci lucrarea e în principal o restilizare plus câteva piese noi, cu contractele
existente păstrate: testele, CSP-ul strict din `proxy.ts` și regula „fără text hardcodat".

Decizii confirmate cu clientul înainte de cod: se înlocuiește **doar primul ecran**; Tailwind v4
**doar** pentru fișierele lui, fără preflight; intro-ul apare **o dată pe sesiune** și niciodată
la `prefers-reduced-motion`; GSAP pentru timeline; **dark implicit**; `StatusBar` dispare, iar
ceasul trece în header.

**Added** — preloader-ul de la prima vizită (`components/intro/`, `lib/intro.ts`)

- **Un singur contract**, `lib/intro.ts` — fără `"use client"` și fără DOM la import, fiindcă
  îl citesc serverul, clientul și `e2e/helpers.ts`: cookie-ul de sesiune `tbs_intro=seen`,
  evenimentul `tbs:intro-done` (al treilea canal `window`, după consimțământ și estimator),
  id-ul `#tbs-intro`, timpii (`MIN_SYNC_MS` 2.4s, `HARD_CAP_MS` 5s, failsafe CSS la 7s,
  watchdog 9s) și cele 8 ținte ale intrării paginii (`data-intro-reveal`). Un flag de modul
  închide o cursă reală: efectele rulează în ordinea arborelui, deci un bypass sincron ar fi
  emis evenimentul înainte ca bannerul de cookie să se aboneze.
- **Poarta stă în `app/(site)/layout.tsx`, nu în pagină**: `x-pathname === "/"` (deci și `/ru`,
  `/en`) și niciun cookie `tbs_intro`. Un layout nu se re-randează la navigarea client, deci
  intro-ul apare **doar la o încărcare directă** a homepage-ului — niciodată după
  `/servicii/x` → Home sau la Back. Overlay-ul e primul copil, deci „Sari peste intro" e
  primul Tab.
- **Trei niveluri de încărcare**, ca un vizitator care revine să nu descarce nimic în plus:
  shell-ul (`IntroPreloader`, randat pe server, fără GSAP și fără three.js) → directorul
  (`IntroDirector`, GSAP) → scena (`IntroScene`, three.js + R3F), ultimele două prin
  `next/dynamic` cu `ssr: false`. Shell-ul sondează dispozitivul dintr-un chunk de ~1 KB și cere
  three.js **în paralel** cu directorul: la 150 ms RTT / 4 Mbit, chunk-ul three pleacă după
  1.8–2.3s în loc de 3.3–3.8s.
- **Fallback SVG** (`IntroFallback.tsx`): ∞ animat doar din CSS, pe ecran din primul paint. E
  renderer-ul fără WebGL2, cu Save-Data și pe **rasterizatoare software** (SwiftShader,
  llvmpipe, WARP — `SOFTWARE_RENDERER_PATTERN`): un tub de sticlă la 5 fps arată mai rău decât
  SVG-ul. `localStorage.tbs_intro_3d = "force"` forțează scena — doar pentru QA și E2E.
- **Scena 3D**: lemniscata ca tub de sticlă, particule pe 3 orbite (toată mișcarea în shader),
  mediu PMREM **procedural** (fără HDR, fără rețea), trei tier-uri (high / mid / low) și un
  „FPS governor" în `three/rig.ts` în locul lui drei: coboară întâi DPR-ul la 1×, apoi trece pe
  „lite". O cadență **constantă** de cel puțin 24 fps (iOS Low Power, Energy Saver) e un plafon
  de refresh, nu un dispozitiv lent, și nu mai costă calitate: fiecare fereastră de ~1s își
  măsoară cadența (`CAP_STEADINESS` p90/p10 < 1.25, `CAP_MIN_FPS` 24) și e lentă doar sub
  `CAP_SLACK` 0.8 × cadența ei — niciun pas de calitate nu ridică un plafon.
- **Progresul e readiness reală**, ponderată (hidratare .15, fonturi .15, `load` .30, scena .40),
  sub o curbă cinematică de minimum 2.4s. Contorul nu arată 100 înainte de explozie. Explozia:
  lock (`ACCESS_GRANTED`) → implozie → burst cu dolly în cameră → dezvăluire → intrarea paginii
  (GSAP, `expo.out`). `<h1>` nu primește niciodată `opacity` (e elementul LCP); header-ul și
  statisticile primesc doar `transform`, altfel și-ar pierde blur-ul sticlei.
- **Când nu apare**: reduced motion (din CSS înainte de hidratare, apoi din JS), un `#hash` care
  țintește pagina, JS sosit după 6.4s, fără JS (`<noscript><style>`), JS care nu vine deloc
  (failsafe CSS la 7s: invizibil și click-through), `/servicii/*`, orice navigare client. Într-un
  tab ascuns ceasul și watchdog-ul numără doar timpul vizibil.
- **Skip**: butonul, Esc / Enter / Space / Tab / săgeți / PageUp / PageDown / Home / End, un click
  sau rotița — timeline-ul rulează de 2.4× mai repede. Tastele de skip sunt **consumate** (nu
  mai ajung la banner sau la meniu); Tab mută în continuare focusul.
- **Accesibilitate**: fără `role` pe root, fără `aria-hidden` pe pagină, fără capcană de focus;
  `role="progressbar"` cu `aria-valuenow` din 10 în 10; butonul de skip e **frate** cu
  progressbar-ul (copiii unui progressbar sunt prezentaționali), 44px, fără autofocus. Reguli
  pentru `prefers-contrast`, `forced-colors` și print. Overlay-ul e **mereu dark**, și pe tema
  light.

**Added** — Tailwind v4, doar utilitare, fără preflight

- `postcss.config.mjs` + `app/tailwind.css`, importat din `app/(site)/layout.tsx`: admin-ul nu îl
  încarcă. Se importă doar `theme.css` și `utilities.css` — **fără preflight**, care ar fi
  restilizat fiecare buton și titlu de pe site.
- Tema Tailwind e golită și mapată **pe tokenuri**: `bg-red-500` sau `text-lg` cu mărimea
  Tailwind pur și simplu nu există. Breakpoint-uri `xs 401 · sm 641 · md 861 · lg 1025 · xl 1180`,
  complementul exact al `max-width` 400/640/860/1024 din module.
- `@source` explicit (contextul Docker nu are `.git`, deci detecția automată ar fi scanat alte
  fișiere decât local), `@utility glass | glass-text | cta-neon | cyber-grid | cyber-floor |
  edge-fade-x | fade-b`, varianta `menu-open`, animații cu prefix `hud-*`.
- **Doar cinci fișiere** îl folosesc: `Navbar`, `HeaderClock`, `Hero`, `Ticker`, `CookieConsent`.
  Intro-ul rămâne CSS Module — aproape totul acolo e keyframe, selector de stare sau failsafe
  care trebuie să meargă înainte de hidratare.
- **De ce `properties` e primul în declarația `@layer`** (prima linie din `globals.css` și din
  `tailwind.css`): Tailwind 4.3 pune acolo valorile implicite `--tw-*` pentru browserele fără
  `@property` (Firefox 111–127, în intervalul suportat de Next). Nedeclarat, stratul ar fi fost
  adăugat **după** `utilities` și ar fi resetat fiecare umbră, translate și gradient pus de un
  utilitar.
- Doar trei reguli de element au trecut în `@layer base` (`box-sizing`, `font-family: inherit`,
  `a { color: inherit }`), altfel ar fi bătut utilitarele. Restul CSS-ului e nestratificat și
  câștigă în continuare în fața oricărui utilitar, deci nicio pagină existentă nu se schimbă.
- `components/__tests__/tailwind-contract.test.ts` impune regulile: fișierele Tailwind sunt
  Tailwind pur; fără `.disp` / `.mono` / `.container`, fără `!`, culori brute (inclusiv nume CSS
  în `[...]`), `dark:` sau `!important`; `outline-none` / `outline-hidden` / `outline-0` doar
  lângă un inel `focus-visible:` real; orice `.tsx` cu utilitare cu variantă trebuie să fie în
  `@source`.

**Added** — tokenurile HUD (`app/globals.css`) — vezi [04 — Design System](./docs/04-design-system.md)

- `--void` `#0a0b10`, niciodată remapat; sticlă `--glass-bg` / `--glass-bg-text` /
  `--glass-bg-solid` / `--glass-line` / `--glass-blur` (14px, 8px pe telefon), cu variante
  `--dark-*`; neon `--neon-red`, `--neon-red-strong`, `--neon-blue`, `--glow-red`; `--hero-glow-red`
  și `--hero-glow-blue`; `--hud-grid-line`, `--grid-cell`, `--gutter`, `--header-h` 71px,
  `--ticker-h` 64px; scara `--z-*` (115 → 400) și `--motion-*`.
- **`--grad-red-cta`** (`#e0213a → #b50e22`): alb pe el măsoară **4.72:1 / 6.88:1**. `--grad-red`
  rămâne decor — alb pe oprirea deschisă are doar 3.15:1 și ar fi picat AA pe CTA-urile mici.
- `Modal.module.css` și bara de progres folosesc acum `--z-modal` și `--z-progress` — scara nu mai
  e doar un comentariu.

**Added** — ceasul `SYS_TIME` din header (`lib/clock.ts`, `components/layout/HeaderClock.tsx`)

- Ora **Chișinăului**, cu offset-ul real (UTC+3 vara, UTC+2 iarna), oricare ar fi fusul orar al
  vizitatorului. Repară bug-ul din `StatusBar`, unde ora locală stătea sub un „UTC+3" fix.
- Un singur interval de 500 ms pentru toate ceasurile, oprit într-un tab ascuns. Ceasul din
  bară se abonează **doar unde e vizibil** (`BAR_CLOCK_QUERY`): altfel fiecare telefon ar fi
  re-randat de două ori pe secundă un element cu `display: none`.
- `aria-hidden`, fără tab stop; serverul randează `--:--:--`, deci hidratarea nu are mismatch.

**Added** — `lib/scrollLock.ts` și `lib/visibleTimeout.ts`

- `lockRootScroll()`: lock cu contor de referințe pe `<html>`, folosit de meniul burger și de
  intro (`Modal` își păstrează lock-ul pe `<body>`). Pune `body { overflow-x: visible }`, altfel
  body-ul devine container de scroll și header-ul sticky dispare după scroll. `scrollbar-gutter:
  stable` se pune **doar** când o bară de scroll clasică ocupă lățime.
- `visibleTimeout(ms, onFire)`: un `setTimeout` care numără doar timpul cu tab-ul vizibil și se
  declanșează o singură dată. Îl folosesc watchdog-ul intro-ului și așteptarea bannerului.

**Added** — dependențe (versiuni exacte la runtime)

| Pachet | Versiune | Licență |
|---|---|---|
| `three` | 0.186.0 | MIT |
| `@react-three/fiber` | 9.7.0 | MIT |
| `gsap` · `@gsap/react` | 3.15.0 · 2.1.2 | GSAP Standard „no charge" |
| `tailwindcss` · `@tailwindcss/postcss` (dev) | ^4.3.3 | MIT |
| `@types/three` (dev) | ~0.186.0 | MIT |

Licența GSAP **nu e open-source**, dar permite folosirea gratuită pe un site comercial ca acesta;
se recitește la fiecare upgrade. **Nu** folosim drei, postprocessing sau framer-motion — motivele
sunt în [02 — Tech Stack](./docs/02-tech-stack.md). Efect secundar în lockfile: `nanoid`
3.3.15 → 3.3.19.

**Added** — teste

- **Unitare** — 15 fișiere noi (înainte: 316 teste în 21 de fișiere; totalul final e în tabelul
  *Verificare*): `intro-preloader` (24), `intro-scene-math` (24), `intro-math` (21),
  `intro-capability` (18), `intro-reveal-contract` (8), `navbar-menu` (29), `cookie-consent`
  (21), `tailwind-contract` (21), `header-clock` (16), `ticker` (6), plus `lib/__tests__/`
  `intro` (20), `intro.server` (4), `clock` (19), `scrollLock` (12), `visibleTimeout` (7). Cele
  noi au fost verificate prin mutații: componenta stricată intenționat face testul să pice.
- **E2E** — două specuri noi, `e2e/preloader.spec.ts` (prima vizită, fallback SVG și WebGL
  forțat, telefoane în portrait și landscape) și `e2e/hud-shell.spec.ts` (ceas, banner, inel de
  focus, ticker, rândul header-ului, burger, dropdown-uri), plus un test nou în `theme.spec.ts`
  (înainte: 156 de teste; totalul final e în tabelul *Verificare*). `gotoHydrated()` seedează
  acum `tbs_intro=seen`, deci fiecare spec vechi e un vizitator care revine;
  `{ seedIntro: false }` testează prima vizită. Vezi [14 — Testing](./docs/14-testing.md) și
  [`e2e/README.md`](./e2e/README.md).

**Changed** — dark implicit, pe toate rutele

- `DEFAULT_THEME = "dark"` (`lib/theme/theme.ts`). Fără cookie, serverul ștampilează
  `data-theme="dark"`, iar scriptul inline din `<head>` cade tot pe dark. **Preferința OS nu mai
  decide**; light rămâne alegerea explicită (`tbs_theme=light`). Și admin-ul e dark implicit,
  fiindcă îl ștampilează layout-ul root.
- Paleta dark coboară pe negrul HUD-ului: `--dark-bg` `#101422` → `#0a0b10`, `--dark-bg2`
  `#0b0e18` → `#06070b`. Fiecare pereche de text câștigă: txt 17.13 → **18.36:1**, mut 9.18 → 9.85,
  dim 7.04 → 7.54, blue-text 8.58 → 9.19, red-text 6.67 → 7.15; cardurile se separă mai bine
  (panel pe bg 1.11 → 1.19).
- Patru teste de temă au trecut pe **light**, fiindcă dark ar fi trecut acum și fără cookie:
  ștampila pe `/servicii/produs-digital`, suprafața pictată (luminanță > 0.6), preferința care
  urmează vizitatorul pe altă pagină și `aria-pressed` din `theme-toggle.test.tsx`. Un test nou
  păstrează verificarea pentru dark (luminanță < 0.4) pe cazul implicit.

**Changed** — header-ul (`components/layout/Navbar.tsx`, rescris în Tailwind)

- Logo „TBS" cu punct roșu, ceasul, `<nav aria-label="Principal">`, preferințele, CTA-ul neon și
  burger-ul. Ordinea DOM și cele **18 opriri de Tab** de dinaintea CTA-ului sunt neschimbate.
- Sticla (`glass-text`) stă pe `::before`, nu pe `<header>`: un `backdrop-filter` pe header l-ar
  face backdrop root, iar dropdown-urile din sticlă n-ar mai avea ce să blureze. Sub 861px e o
  foaie aproape opacă, fără blur. Jos, o linie neon roșie.
- Dropdown-uri cu un „+" care devine „×". Se deschid la hover real (`(hover: hover)`), la focus
  sau la primul tap pe touch; al doilea tap navighează. **Esc** închide și un dropdown deschis
  cu mouse-ul, oriunde ar fi focusul (WCAG 1.4.13).
- Meniul burger: focusul merge pe „×"; Esc și „×" îl readuc pe burger; Tab în afara meniului sau
  lărgirea ferestrei peste 861px îl închid; link-uri mari, numerotate; fundal opac sub sticlă
  (la 94% fără blur, titlurile paginii se vedeau prin el).
- `LanguageSwitcher`, `ThemeToggle` și `SoundToggle` primesc doar CSS: sticlă și neon albastru,
  fără nicio schimbare de dimensiune. Textul mic din selectorul de limbă trece de la `--dim` la
  `--mut` (`--dim` are 4.45:1 pe alb, sub AA la 11px).

**Changed** — hero, ticker și bannerul de cookie (rescrise în Tailwind)

- **Hero**: fundal HUD (lumini roșu / albastru, grilă, podea în perspectivă, scanner) pus pe pauză
  cât timp overlay-ul intro-ului există, cât hero-ul e în afara ecranului și la reduced motion;
  `<h1>` între 34 și 92px, cu punctul final roșu; CTA-ul principal `cta-neon` cu o săgeată SVG
  `aria-hidden`; link secundar în stil ghost; statistici din sticlă (sticlă solidă sub 861px).
  Contractele rămân: `source: "hero"`, grupul „Indicatori", valoarea într-un `<b>` separat.
- **Ticker**: 5 grupuri identice, fiecare **terminat** cu un punct roșu, deci bucla nu mai are
  cusătură; pauză la hover; la reduced motion, un singur grup static.
- **Bannerul de cookie**: card de sticlă jos-dreapta de la 641px. **Pe telefon e un panou opac,
  fără blur** — stă peste grila și ticker-ul animate, iar blur-ul recalculat la fiecare cadru
  costa ~7.1 ms/cadru față de 4.4. **Așteaptă intro-ul** (`onIntroDone`), cu o limită de
  `WATCHDOG_MS + 1000` în timp vizibil, și nu apare niciodată peste un intro încă viu. Esc e
  ignorat 700 ms după un intro care a rulat, iar repetițiile unei taste ținute nu mai contează
  niciodată ca răspuns.
- **Inelul de focus al butoanelor neon** e `--txt`, nu cyan: cyan cădea pe glow-ul roșu și măsura
  1.2–2.5:1 pe light; acum **≥6.4:1** pe light și **≥6.75:1** pe dark, măsurat pe pixeli. În
  repaus au un contur transparent, pe care Windows High Contrast îl desenează.

**Changed** — i18n și politica de cookie

- Chei noi în RO/RU/EN: `intro.status`, `intro.complete`, `intro.progressAria`, `intro.skip`,
  `intro.skipKey`, `header.sysTime`, `nav.primaryAria`. `nav.primaryAria` e „Principal" /
  „Основная" / „Main": cititorul de ecran anunță deja „navigation", deci „Navigație principală"
  s-ar fi auzit „navigație principală, navigație".
- `app/(site)/cookies/content.ts` listează `tbs_intro` (esențial, până la închiderea browserului)
  în toate trei limbile; data politicii devine 16 septembrie 2026.

**Fixed** — blur-ul modalului și al bannerului lipsea în afara Safari

Cu `backdrop-filter` scris **înaintea** `-webkit-backdrop-filter`, Lightning CSS (minifierul din
build) păstra doar linia prefixată, pe care Chromium n-o suportă. Scrim-ul modalului și bannerul
de cookie aveau `backdrop-filter: none` în producție. Ordinea e inversată, iar regula e scrisă în
[04 — Design System](./docs/04-design-system.md).

**Fixed** — găsite la integrare și de cele trei review-uri independente, reparate înainte de
livrare

- **Banner sub un intro nepornit**: limita bannerului număra și timpul cu tab-ul ascuns, deci
  apărea și lua focusul sub un intro care nici nu rulase; același Esc care sărea intro-ul salva
  apoi „rejected" pentru 6 luni. Acum limita numără timp vizibil (`visibleTimeout`) și nu arată
  bannerul peste un intro încă viu (`data-live`), tastele de skip se opresc la intro, iar un Esc
  ținut sau dublu nu mai răspunde bannerului. `visibleTimeout` avea și el un bug: după ce se
  declanșa, o ascundere și o reafișare a tab-ului îl rearmau — acum se declanșează o singură
  dată.
- **Click pierdut în fade**: pe WebGL cu mouse (paralaxă), canvas-ul (`pointer-events: auto`
  inline) înghițea click-urile pe header timp de 0.55s după dezvăluire. Nimic din overlay nu mai
  prinde click-uri din fazele `revealed` și `leaving`, iar scena își pune `pointer-events: none`
  când e pe pauză.
- **Intro la navigare client din admin**: linkul „vezi site-ul" monta intro-ul în mijlocul
  sesiunii, comprimat și cu scroll-ul blocat. Shell-ul randează acum doar când hidratează HTML de
  la server; următoarea încărcare directă îl joacă normal.
- **Mobil în landscape** (568×320, 640×360): butonul de skip acoperea contorul. Acum e centrat jos
  doar în portrait ≤640px și sus-dreapta pe ecrane ≤480px înălțime.
- **Contrast, tema light**: luminile din hero coborau textul lead la 3.8–4.1:1 la 861–1280px și
  la 3.7 pe telefon, iar eyebrow-ul la 3.6 → tokenurile `--hero-glow-red` / `--hero-glow-blue`
  (.08 / .06 pe light; dark păstrează lumina plină), lead ≥4.53:1 pe fiecare pixel la 861 și
  1280px. Inelul de focus al butoanelor neon: vezi mai sus.
- **Contrast, sticla header-ului**: peste o fotografie deschisă, pe dark, linkurile și ceasul
  coborau la 2.34:1 (3.09 pe light peste un bloc `--ink`) → `--glass-bg-text` (dark .84, light
  .90) și utilitarul `glass-text`, pe header și pe dropdown-uri: ≥5.02:1 peste alb pe dark,
  ≥4.56:1 peste negru pe light.
- **Performanță**: halo-ul fallback-ului SVG avea un `filter: blur()` CSS, reblurat la fiecare
  cadru (~18.5 fps față de ~27 pe randare software) → două filtre `feGaussianBlur` în SVG (8 sau
  16 unități, alese prin media query), rasterizate o dată; cele 17 animații ale fallback-ului
  rulau ascunse sub WebGL (111 față de 14 recalculări de stil la 2s) → pauză cât desenează scena;
  scanline-urile și vigneta devin fundaluri ale overlay-ului, iar suprafața layerelor de
  compoziție scade cu 37%; bannerul pe telefon nu mai are blur (vezi mai sus); ceasul ascuns din
  bară nu mai ticăie, iar observer-ul hero-ului citește cea mai nouă intrare, nu prima.
- **Integrare**: `scrollbar-gutter: stable` sub bare de scroll ascunse îngusta pagina și, după
  deschiderea meniului burger la 320px, scroll-ul sărea din 800 în 759; după lock, revertul GSAP
  rescria contorul din 100 înapoi în 70.
- Mărunte: `ESC` de pe butonul de skip e cheia de catalog `intro.skipKey`; `nav.primaryAria`
  scurtat; un comentariu în rusă tradus; testul de contract Tailwind prinde acum
  `outline-hidden`, `outline-0`, `[outline:none]`, culori cu nume și `!important` în valori
  arbitrare, un inel `focus-visible` care nu desenează nimic și utilitarele cu variantă din
  fișiere care nu sunt în `@source`; testele de temă verifică acum light, varianta ne-implicită.

**Security**

- **CSP-ul din `proxy.ts` e neschimbat și rămâne valabil**: scena e construită procedural — fără
  fetch, workers, wasm sau `eval` (verificat în chunk-urile gsap și three), GSAP și R3F scriu
  stiluri prin CSSOM, iar `<noscript><style>` se bazează pe `style-src 'unsafe-inline'`, care
  exista deja. **0 încălcări CSP** măsurate pe vizita nouă, vizita repetată, reduced motion,
  pagina de serviciu, admin și WebGL forțat.
- **ESLint interzice importurile 3D care ar sparge CSP-ul** și ar pica doar în browser: drei,
  loaderele three, `libs/*` (decodoare wasm), `physics/*` (wasm de pe CDN), `WorkerPool`,
  barrel-ul `three/addons`, `three-stdlib`, `troika-three-text`, `@dimforge/*` — atât ca `import`,
  cât și ca `import()`.
- **`tbs_intro`**: cookie de sesiune, `path=/`, `SameSite=Lax`, scris din JS ca celelalte cookie-uri
  de preferință; contează doar valoarea literală `seen`, care nu ajunge niciodată în DOM.
  `x-pathname` e suprascris de `proxy.ts` și comparat doar cu `"/"`. Vezi
  [11 — Security](./docs/11-security.md) și [`SECURITY.md`](./SECURITY.md).

**Deploy**

- `package-lock.json` regenerat în `node:22-alpine`, **pe un volum gol**, ca npm să nu rezolve
  pornind de la un `node_modules` existent (și să nu scoată intrările native ale altor platforme).
  Verificat: **6 intrări native** (`lightningcss` și `@tailwindcss/oxide` pentru
  linux-musl, linux-gnu și win32), **o singură copie** de `three`, `npm ci` curat pe alpine (imaginea
  de producție) și pe noble (Playwright). Rețeta e în [12 — Deployment](./docs/12-deployment.md).
- Nicio variabilă de mediu nouă și nicio schimbare în compose sau nginx. Uneltele frontend rulează
  doar în Docker; când există worktree-uri de agent, containerele montează `--tmpfs /app/.claude`,
  altfel tsc, ESLint și Vitest ar citi și copiile de acolo.

**Removed**

- `components/layout/StatusBar.tsx` + `.module.css` (ceasul e acum în header).
- `components/sections/HeroEmblem.tsx` — cod mort, încă importa `Hero.module.css`.
- `Navbar.module.css`, `Hero.module.css`, `Ticker.module.css`, `CookieConsent.module.css`
  (componentele sunt Tailwind pur).
- Cheia `hero.scrollHint` din RO/RU/EN; `PREFERS_DARK` și abonarea la preferința OS din
  `ThemeProvider`.

**Docs**

[02](./docs/02-tech-stack.md) stack-ul nou, licența GSAP, ce nu folosim ·
[03](./docs/03-architecture.md) arborele, poarta, încărcarea pe trei niveluri, canalul
`tbs:intro-done` · [04](./docs/04-design-system.md) tokenurile HUD, maparea Tailwind, dark implicit,
paleta light la zi, regula prefixelor · [05](./docs/05-page-sections.md) intro, header, hero, ticker,
banner · [07](./docs/07-conventions.md) secțiunile Tailwind și 3D · [09](./docs/09-admin.md) ·
[11](./docs/11-security.md) + [`SECURITY.md`](./SECURITY.md) · [12](./docs/12-deployment.md) ·
[14](./docs/14-testing.md) · [16](./docs/16-i18n-seo.md) · [`e2e/README.md`](./e2e/README.md)
(specurile noi, bypass-ul intro-ului, WebGL forțat) · rezumatul și tabelul de documente din
[`README.md`](./README.md); `npm ci` în loc de `npm install` pentru dezvoltarea locală (README,
docs/12).

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, pe arborele final) | curate: exit 0 · exit 0 · exit 0 (lint fără output) |
| `npm test` (node:22-alpine) | **566 passed / 0 failed** în 36 de fișiere, rulat de 2 ori, fără flaky (înainte 316 teste în 21) |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă) | **206 passed / 0 failed / 0 skipped** (13 specuri; înainte 156) |
| `preloader.spec.ts` + `hud-shell.spec.ts`, `--repeat-each=3` | **147 passed** (49 × 3), 0 failed, 0 flaky |
| Prefixe CSS în build (`-webkit-backdrop-filter` · `-webkit-mask` · `-webkit-` total) | baseline `7c77240`: 5 · 4 · 25 → acum 15 · 10 · 44 (10 declarații reale `-webkit-backdrop-filter`, fiecare urmată de `backdrop-filter` neprefixat în aceeași regulă) — numerele nu au voie să scadă |
| CSP | 0 încălcări în 6 scenarii (review: prima vizită, vizita repetată, reduced motion, pagină de serviciu, admin, WebGL forțat); `preloader.spec.ts` o verifică la fiecare rulare |
| LCP / CLS (Chromium headless, review) | LCP = `<h1>` în toate rulările: telefon 260 ms prima vizită / 148 ms repetată, desktop 272 / 192 ms; CLS 0 la vizita repetată |
| Contrast | `--grad-red-cta` 4.72 / 6.88 · lead hero pe light ≥4.53 (861, 1280px) · sticla cu text ≥4.64 dark / ≥4.56 light peste cel mai rău fundal · inel de focus neon ≥6.4 / ≥6.75 · banner pe telefon 5.69 / 7.75 · readout intro ≥9:1 |

Greutate (gzip, bytes; baseline `7c77240` măsurat cu același script):

| Pagină | Baseline | Acum (arborele final) | Buget |
|---|---|---|---|
| `/`, vizitator care revine | 225.920 | 244.904 (+18.984; fără three.js/GSAP; marjă 1.016) | ≤ 245.920 (+20.000) |
| `/`, prima vizită — JS lazy, fallback SVG | 3.219 (prefetch) | 35.570 (fără three.js) | — |
| `/`, prima vizită — JS lazy cu scena WebGL | — | 277.815 | ≤ 300.000 |
| `/servicii/e-commerce` | 203.699 | 217.912 (fără three.js/GSAP) | — |

Vizitatorul care revine nu descarcă nici GSAP, nici three.js; creșterea e CSS-ul Tailwind, modulul
intro-ului (care intră în CSS-ul layout-ului) și JS-ul shell-ului, header-ului și ceasului.
`/admin-tbs-digital` nu încarcă nici Tailwind, nici CSS-ul intro-ului.

> **Rămâne deschis, cu cifre:**
> - **Lead-ul hero pe telefon, tema light**: ~1% din pixelii de sub text măsoară încă
>   4.07–4.46:1, fix pe liniile de 1px ale grilei HUD. Reparația ar fi un `--hud-grid-line` light
>   mai deschis, pe care îl folosesc și alte componente.
> - **Marjă de greutate**: la verificarea finală, vizitatorul care
>   revine are 244.904 B, adică 1.016 B sub buget; orice creștere a shell-ului sau a CSS-ului îl depășește.
> - **Neverificat pe hardware real**: FPS-ul scenei, iOS Safari (nu raportează nuclee și memorie,
>   deci toate iPhone-urile pot ajunge în același tier), Android, Firefox, `forced-colors` randat.
>   Trecerea Lighthouse manuală din plan nu s-a făcut.
> - **Testele WebGL forțate** cer scenei să fie gata înainte de 80% (~3s aici); pe un CI mai lent
>   pot cădea pe SVG și pica, deși intro-ul se termină corect. Verificarea click-ului în fade
>   are nevoie de cel puțin un eșantion într-o fereastră de ~0.4s (8 și 26 la probe); o mașină
>   foarte lentă ar putea să nu prindă niciunul.
> - **Ceasul din bară**: testul fixează șirul `BAR_CLOCK_QUERY`, nu și potrivirea lui cu clasele
>   `sm:flex md:hidden lg:flex` — se schimbă împreună.
> - **Governor-ul** tratează un dispozitiv lent dar constant la 30 fps ca pe unul plafonat și îi
>   păstrează calitatea.
> - **Cuplaj de păstrat**: bannerul citește atributul `data-live` pus de shell-ul intro-ului —
>   nu se redenumește. Cu bannerul focusat și un dropdown sub mouse, un singur Esc face ambele.
> - Modificatorii de opacitate decorativi (`via-red/80`, `via-blue/45`, `from-red/70`) cad pe
>   culoarea plină fără `color-mix()` (Firefox 111–112) — doar cosmetic.

## 2026-08-17 — Cererea din modal devine un flux pe pași, cu asistentul la cerere

**Changed** — modalul nu mai e o secțiune de pagină înghesuită

Clientul: „frame-ul de la butonul de contact e prea mărunt și prost organizat; botul cu
întrebări să fie la dorință; întâi selectează proiectul, apoi ce să conțină, apoi datele".

Cauza nu era spațierea: `Estimator` e construit ca **secțiune de pagină**, cu un grid pe
**două coloane** (chips + chat în stânga, preț + formular în dreapta). Corect la lățime de
pagină, strâns într-un modal de 960px devine mărunt. Nicio ajustare de padding n-ar fi rezolvat-o.

- Variantă nouă `layout="dialog"`: **o coloană, trei pași** — *Proiectul → Ce conține → Datele
  tale* — cu indicator de progres („Pasul 1 din 3 · au mai rămas 2 pași") și prețul, cel din
  admin, vizibil pe tot parcursul.
- **Asistentul e opțional**: nu e ascuns, ci **nu e randat deloc** până nu e cerut. Dacă e
  folosit, transcriptul și rezumatul pleacă în cerere ca înainte.
- **Două parcursuri, motivate explicit**: *Rapid* („știi ce vrei… trei pași, nicio întrebare în
  plus") și *Ghidat* („nu ești sigur ce să ceri… **poți trimite oricând, fără să-l termini**").
  Fluxul rapid **nu e blocat** în spatele chatului.
- **Secțiunea `#estimare` de pe homepage rămâne neschimbată** — e design aprobat, iar acolo
  asistentul e deja pe ecran; a-l face „opțional" ar fi ascuns ceva care funcționa. Cele trei
  zone sunt doar marcate cu același contract, ca testele să meargă în ambele variante.
- Navigarea înapoi nu pierde ce s-a completat; focusul urmează pasul; pe mobil un singur pas pe
  ecran.

**Fixed** — recuperare după oprirea agenților la limita de sesiune

Doi agenți au fost opriți în mijlocul lucrului. `Estimator.tsx` a rămas cu **eroare de
sintaxă**: blocul de progres era în curs de a fi învelit într-un `div`, cu închiderea scrisă și
deschiderea nu. Reparat, apoi verificat că restul era coerent.

Trei teste E2E descriau starea veche și au fost aliniate la designul real, nu slăbite:
- dovada „fluxul dinăuntru e cel real" aștepta butonul de trimitere la deschidere; el e acum la
  pasul 3, deci testul așteaptă containerul fluxului și **navighează** la pasul de contact ca să
  verifice submit-ul și câmpul de email;
- testul homepage-ului presupunea că și secțiunea are chat opțional — nu are, prin decizie;
- `summaryTitle` fusese confundat: titlul de pe **ecran** e „Rezumatul cererii", cel din
  **payload** e scris cu majuscule. Sunt acum două constante distincte.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm test` | **316 passed / 0 failed** (+11) |
| `npx playwright test --workers=1` | **156 passed / 0 failed** (+12) |
| `npm run lint` · `npx tsc --noEmit` · `npm run build` | curate |
| Vizual, modal pe `/servicii/e-commerce` | trei pași, preț real 550€, serviciu preselectat, ambele parcursuri, asistent nerandat până la cerere |

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
