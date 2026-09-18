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

## 2026-09-18 — Changed: intro-ul se joacă la fiecare încărcare a paginii principale

Clientul a raportat că „la refresh nu lucrează mereu". Nu era un defect, era proiectarea: intro-ul
se juca **o dată pe sesiune de browser**. La prima încărcare se scria cookie-ul `tbs_intro`, iar
orice reîncărcare ulterioară îl sărea — deci exact o dată, apoi niciodată până la închiderea
browserului.

Site-ul **nu mai scrie** `tbs_intro`. Cookie-ul rămâne citit (`shouldPlayIntro` → `isIntroSeen`), ca
orice îl setează — suita e2e îl seedează implicit — să poată în continuare sări intro-ul. Vizitatorul
nu-l mai primește niciodată, deci intro-ul rulează la fiecare încărcare propriu-zisă a paginii
principale.

Politica de cookie-uri a fost actualizată în toate trei limbile: nu mai putem enumera un cookie pe
care nu-l mai punem.

Neschimbate, pentru că nu sunt defecte: intro-ul nu rulează pe alte pagini decât cea principală, e
sărit la un link cu ancoră (vizitatorul a cerut un loc în pagină, nu o animație), e sărit la
„mișcare redusă", și nu repornește la navigarea în interiorul site-ului.

Verificat pe site-ul care rulează: la reîncărcări succesive overlay-ul e prezent de fiecare dată, iar
`tbs_intro` nu mai apare între cookie-urile browserului.

**Compromis de știut:** fiecare reîncărcare costă acum ~2,4s până se vede pagina.

Fișiere: `lib/intro.ts`, `app/(site)/cookies/content.ts`.

## 2026-09-18 — Changed: cinci modele 3D noi, unul pentru fiecare serviciu

Clientul s-a uitat la cele cinci modele existente și a spus că nu-i plac: prea abstracte, prea
puțin detaliate. Fiecare a fost rescris ca un obiect pe care îl poți numi, cu o buclă care spune ce
face serviciul.

| Serviciu | Înainte | Acum |
| --- | --- | --- |
| Produs digital | 27 de cuburi | **Stiva de produs**: șase ecrane wireframe cu rol (brief, shell, catalog, date, flux, formular) care se strâng într-un dispozitiv, se aprinde, se întoarce și își arată straturile |
| E-commerce | un inel cu cutii | **Tejgheaua**: raft, coș, terminal de plată, seif, tablou de comenzi, legate de o bandă în circuit închis |
| Automatizare & API | o sferă cu spițe | **Banda de integrare**: cinci stații pe un soclu, cu o înregistrare care lovește o poartă închisă la 3,4s, urcă pe arcul de reîncercare și trece |
| Asistenți IA | o rețea de noduri | **Bucla cererii**: o cerere care traversează cinci straturi, așteaptă la poartă, iar un om apasă tasta — răspunsul se întoarce pe canalul de dedesubt |
| Brand & UI | un val de particule | **Placa de identitate**: grilă de 12 coloane, „TBS." desenat cu trasee, paletă care se reînnoiește, componente care se reașază din layout lat în telefon |

**Regulile care se aplică tuturor cinci**, stabilite de critica de design:
- **fără animație de intrare.** Pe o pagină de serviciu poarta sare pe „format" din primul cadru, deci
  orice intrare s-ar juca în spatele desenului static și n-ar vedea-o nimeni. Bucla e spectacolul, iar
  ceasul ei pornește pe un cadru compus, nu pe zero;
- **buclă de 6–8 secunde**, cu momentul cel mai puternic între 3 și 5 secunde;
- **fără sprite-uri** — un pachet e un cap de cometă în shader sau o cutie instanțiată; sprite-urile
  desenează discuri rotunde, interzise în proiect;
- reacție la mouse prin datele pe care modelul le primește deja pe cadru, fără să atingă DOM-ul;
- **niciun shader nou, niciun uniform nou, nicio textură** — fiecare model folosește ramurile de
  material care existau deja.

**Costul a scăzut, nu a crescut:**

| Model | Desene/cadru | Vârfuri/cadru |
| --- | --- | --- |
| Stiva de produs | 3 | 1.206 |
| Tejgheaua | 4 | 8.430 |
| Banda de integrare | 3 | 5.942 |
| Bucla cererii | 3 | 2.678 (înainte: 8.181, din care 87 sprite-uri) |
| Placa de identitate | 4 (3 pe dispozitive slabe) | 692 |

Verificat prin măsurare, fără suite de teste: toate cele cinci pagini ajung la `renderer=webgl`, zero
erori; coloana de text comparată cu 3D pornit și oprit rămâne neatinsă.

**Rămâne de făcut**, semnalat de agenți și asumat aici: siluetele pe care aterizează roiul de
particule pe pagina principală (`samples.ts`) și desenele statice per serviciu
(`art/serviceArtPaths.ts`) descriu încă modelele vechi, deci pe „Direcții" roiul se strânge într-o
formă care nu mai corespunde; iar `scene-build.test.ts` verifică un comportament al cuburilor care
nu mai există.

Fișiere noi: `components/scene/three/models/{productStack,shopFloor,pipelineBench,assistantLoop,brandBoard}.ts`.
Modificate: `components/scene/three/world.ts` (harta de modele), `components/scene/three/samples.ts`
(poziția plăcii).

## 2026-09-18 — Added: fiecare pagină de serviciu are modelul ei 3D în capul paginii

Clientul a cerut ca fiecare serviciu să aibă un model 3D animat, potrivit serviciului, sus pe pagina
lui. Scena WebGL exista deja, dar trăia numai pe pagina principală.

- Ruta `/servicii/[slug]` își învelește acum conținutul în `<main>` → `<SceneStage>`, exact ca
  pagina principală, iar `DirectionPage` primește `modelArt` (opțional) și cheamă
  `selectSceneShape(slug)`. **Nicio ramificație pe serviciu**: maparea slug → model exista deja
  (`SCENE_SHAPES` → `SERVICE_MODEL` → `MODEL_FACTORIES`), la fel și desenul static per serviciu
  (`ServiceArt`), cu trecerea lui de 500ms către versiunea WebGL.
- Modelul stă în capul paginii, în coloana din dreapta a hero-ului, **deasupra** cardului colorat
  existent, într-un `div` fără titlu (ca să nu adauge un marcaj în șina de fibră) și cu
  `data-scene-anchor="services"`, care e ce transformă plasarea scenei din „nimic" în una reală.

Trei lucruri găsite lovindu-ne de ele, nu presupuse:
- `.page { position: relative }` **nu** e de ajuns: scena desenează modelul mai mare decât gazda lui
  și îl ridică spre centrul pânzei, așa că pe ecran îngust ieșea 67px peste paragraf — 17 rânduri de
  pixeli măsurate în interiorul textului. Rezolvat prin spațiul din hero și un plafon de 320×260 pe
  gazdă.
- Cu modelul în dreapta, `align-items: center` împingea titlul la mijlocul paginii, cu colțul
  stânga-sus gol. Acum e `start`: titlu sus-stânga, model sus-dreapta.
- Centrarea gazdei cu `margin-inline: auto` o face să se strângă la conținut; singurul ei copil e
  poziționat absolut, deci gazda măsura **0 lățime** și scena scala modelul la nimic. Se centrează
  cu `justify-self`.

Verificat prin măsurare, fără suite de teste (mod de lucru cerut de client): zece pagini (cinci
slug-uri × 1280×800 și 390×844), toate ajung la `data-renderer="webgl"`, cu cinci modele distincte;
coloana de text comparată pixel cu pixel între 3D pornit și 3D oprit este **identică**, deci niciun
rând de text nu e atins; cu 3D oprit apare desenul static în același loc.

Notă: pe o pagină de serviciu ancora e deja depășită la scroll 0, deci poarta de intrare sare direct
pe „format" și explozia de asamblare nu se joacă. Acceptat: modelul își rulează bucla proprie și
răspunde la mouse. Modelele detaliate, unul pe serviciu, se construiesc separat și intră în același
loc fără altă modificare.

Fișiere: `app/(site)/servicii/[slug]/page.tsx`, `components/sections/DirectionPage.tsx`,
`components/sections/DirectionPage.module.css`.

## 2026-09-18 — Fixed: spirala Lucrări nu mai stă pe loc la intrare

Focusul era fixat la 0 pe toată distanța dintre apariția primului card la marginea de jos a
ferestrei și momentul în care pista se lipește sub header (~730px de scroll, din care **176px cu
teancul complet nemișcat** la 1280×800 și 264px la 768×1024). Cum rotația, deplasarea pe fir și
dezvăluirea imaginii depind toate de focus, spirala apărea, stătea, și abia apoi începea să se
rotească. Măsurat înainte de orice modificare: șase poziții de scroll consecutive cu `rotateY`
exact 0,0°, marginea de sus fixă și `--helix-wipe` neschimbat.

Acum focusul curge **înapoi** peste un lead-in lung exact cât zona vizibilă, în același ritm ca
între carduri: cardul 0 urcă de jos și se întoarce spre vizitator ca oricare altul. Nu mai există
nicio porțiune în care teancul ține o poziție.

**Intrarea cronometrată a fost eliminată cu totul.** Era armată când Lucrări trecea de 55% din
fereastră — adică exact în intervalul mort, deci pe o derulare normală se consuma înainte ca teancul
să fie pe ecran. Lead-in-ul condus de scroll o înlocuiește și nu poate fi ratat. Au dispărut
`helixForm`, `CardPhase`, `HELIX_SETTLED`, `HELIX_ENTER`, parametrul `phase` din `helixLayout` și
`enter` din `driver.write`.

Un proiect nu mai e marcat „în față" în timpul lead-in-ului, ca să nu-și consume sosirea (accentul,
pulsul firelor, tipărirea imaginii) în afara ecranului.

Cardurile nu pot ajunge peste titlul secțiunii: cât timp focusul e negativ toate au `d ≥ 0`, deci
stau la sau sub poziția lor de aranjare, care înainte de lipire e marginea de sus a rândului — sub
blocul de titlu. Focusul devine pozitiv abia după ce pista a trecut de header.

| Măsurat pe pagina reală | Înainte | După |
| --- | --- | --- |
| Cel mai lung teanc înghețat, 1280×800 | 176px | **44px** (o poziție de eșantionare) |
| Idem, 768×1024 | 264px | **44px** |
| Carduri desenate peste titlu | — | **0** |

Verificare: 1.535 teste unit / 72 fișiere, `interior` + `interior-webgl` 46. Patru teste unitare și
W19, roșii de la schimbarea de mai devreme (spirala se aplică și când Lucrări e pe ecran), au fost
re-ancorate pe contractul nou.

Fișiere: `components/scene/helix.ts`, `components/scene/workHelix.ts`,
`components/scene/three/world.ts`, `e2e/interior-webgl.spec.ts` și testele scenei.

## 2026-09-18 — Changed: spirala Lucrări — pozele se tipăresc ca o hologramă când proiectul ajunge în față

Clientul a spus, uitându-se la site: apariția pozelor nu e „wow". Avea dreptate, și motivul era
structural: tot ce făcusem era **legat de scroll**. Un lucru care se schimbă proporțional cu cât
derulezi nu se citește niciodată ca animație — e o stare, nu un eveniment. În plus, tăiam
fotografia în coloane, iar oprită sau derulată înapoi arăta ca o imagine stricată, nu ca un efect.

- **Poza nu mai e tăiată niciodată.** Masca pe coloane a fost scoasă. Materializarea o fac
  celulele de deasupra: două rețele de pătrate de mărimi diferite (11px și 27px), decalate ca să
  nu se vadă ca o grilă, dese chiar pe muchia unde poza sosește și stinse la o treime sub ea —
  ideea dizolvării în voxeli a elicei, în CSS. Oprit, rămâne o fotografie curată.
- **Momentul: tipărirea.** Când un proiect ajunge în față, poza lui se tipărește ca o hologramă —
  apare în benzi orizontale de 5px care se lățesc și se contopesc până devine imagine plină, prin
  două căderi de semnal și o smucitură laterală, 860ms. Se animează doar `mask-size` pe o mască
  declarată pe element (la repaus o perioadă acoperă toată poza, deci în afara animației nu e
  mascat nimic), fără `fill-mode`, ca poza să revină exact la regulile cardului.
- Se întâmplă în timp ce firele elicei pulsează și holograma comută pe același proiect: un
  eveniment, trei locuri.

Verificat pe pagina reală, nu în laborator: oprind pagina exact la schimbarea de proiect, browserul
raportează animația `hud-work-media-print` la 33ms din 860, iar cadrul prins atunci arată cardul
din față cu poza în benzi. Fișier: `app/tailwind.css`.

## 2026-09-18 — Fixed & Changed: spirala Lucrări — apariția imaginilor se vede, cardurile intră de jos și ies pe sus

### Fixed
- **Apariția imaginii se vede acum, pentru fiecare card, de fiecare dată.** Dezvăluirea pornea de
  la poarta secțiunii — o animație de 420ms armată **o singură dată**, la `scrollY` 1602, când
  vârful pistei era încă la 1961, adică toate cardurile sub marginea de jos a ecranului. Se
  termina înainte ca vizitatorul să vadă vreun card: pe o parcurgere completă a secțiunii,
  **niciun cadru din 91** nu prindea vreo imagine în curs de apariție. Mecanismul exista, dar
  nimeni nu avea cum să-l vadă. Acum imaginea e desenată progresiv după poziția cardului pe fir
  (`--helix-wipe`), deci se întâmplă acolo unde se uită vizitatorul, la fiecare trecere, și merge
  înapoi la derulare inversă. Măsurat pe aceeași parcurgere: **704 din 1.179 de cadre** au un card
  solid, pe ecran, în plină apariție.

### Changed
- **Imaginea se asamblează, nu doar se dezvăluie.** Partea deja apărută e tăiată în coloane de
  16px care se umplu pe măsură ce cardul urcă, iar coloanele care încă n-au ajuns se văd ca dungi
  în culoarea proiectului, nu ca goluri; poza se așază în același timp dintr-o ușoară mărire (6%).
  Totul din aceeași valoare scrisă deja de driver, deci fără cost nou pe cadru.
- **Cardurile intră de sub zonă și ies pe deasupra ei**, în loc să se strângă pe axa elicei.
  Intrarea secțiunii e acum doar deplasare verticală, iar finalul nu mai are caz special: focusul
  curge mai departe și ultimele carduri ies pe sus ca toate celelalte, în timp ce elicea se
  răsucește și se dizolvă.
- **Carduri puțin mai mici, cu drum vizibil mai lung.** La 1280×800 un card are 258px în loc de
  288, iar centrul lui traversează ecranul de la y 904 până la y −33 (înainte 826 → 45): 78px mai
  jos la intrare, 78px mai sus la ieșire. Și e solid tot drumul — intră la opacitate 0,62, nu 0,01
  ca înainte, când practic era invizibil până sus. Pragul de 240px al lățimii **nu** s-a mișcat,
  fiind cel măsurat pentru contrastul textului peste captură.
- Reparat pe parcurs: pe un ecran scund finalul se putea încheia cu un card încă slab vizibil;
  lungimea finalului are acum un prag care garantează că tot teancul a ieșit din zonă. Înălțimea
  paginii rămâne neschimbată.

**Verificare** (mod de lucru rapid, cerut de client — suita completă se rulează o singură dată, la
final): 1.537 teste unit / 72 fișiere, build + `tsc` + lint curate; `interior-webgl` 24 +
`interior` 22. Verificarea vizuală s-a făcut pe pagina reală, derulată automat la viteză de om, nu
în laborator — exact pasul care lipsise și care costase o rundă întreagă.

Fișiere: `components/scene/helix.ts`, `components/scene/workHelix.ts`,
`components/sections/Work.tsx`, `app/tailwind.css`, testul `scene-helix`.
Documentație: [docs/05](./docs/05-page-sections.md) · [docs/04](./docs/04-design-system.md).

## 2026-09-18 — Changed: spirala ADN — imaginile apar odată cu ADN-ul, cardurile nu mai stau una peste alta

Clientul s-a uitat la runda 1 și a spus: ADN-ul arată bine, dar „imaginile pur și simplu stau", iar
cardurile „parcă stau una peste alta". Amândouă erau adevărate.

**Imaginile.** Cutia cardului se anima (se desfăcea pe elice, se rotea), dar screenshot-ul din
interior era un `<img>` obișnuit, la intensitate maximă din primul cadru. Acum:
- imaginea **se construiește de jos în sus** (`clip-path`, nu o estompare), în 420ms — exact cât îi
  ia cutiei cardului să se așeze pe elice, deci cad pe același ritm;
- în spatele ei urcă o folie de linii de scanare în culoarea cardului, cu o muchie luminoasă care
  călărește linia de dezvăluire;
- când un proiect ajunge în față, o bară îl traversează în aceeași culoare, 520ms — cât să acopere
  și pulsul firelor, și glitch-ul hologramei pe aceeași schimbare: **un eveniment, trei locuri**.

Cascada de intrare a fost lărgită de la ~300ms la **~530ms**, pentru că prima variantă era practic
invizibilă: laboratorul prindea trecerea de la 2 la 9 carduri aprinse într-un singur eșantion de
90ms. Acum un cadru real prinde primele cinci carduri la 99 / 75 / 52 / 24 / 0 % din propria
dezvăluire.

Sunt animații CSS pornite de **două atribute pe care driverul le scrie o singură dată**
(`data-helix-lit`, `data-helix-front`) — același tipar ca `data-entry` de la Servicii. Alternativa,
o proprietate scrisă per card per cadru, ar fi invalidat stilul a nouă subarbori la fiecare cadru.
Costul pe cadru al funcției noi este **zero**, și niciun desen WebGL în plus.

Stratul de scanare stă **pe imagine și sub spălăturile cardului**, deci cerneala care ține textul îl
atenuează exact cum atenuează și poza: nicio culoare de accent nu poate scoate un rând de text sub
pragul lui măsurat.

**Spațiile.** Pasul vertical pe fir a crescut de la 0,18 la 0,29 din înălțimea zonei, orbita s-a
lărgit, cardul s-a îngustat, iar cardurile se sting mai devreme:

| | Înainte | Acum |
| --- | --- | --- |
| distanța între vecini (1280×800) | 131 / 131 px | **147 / 211 px** |
| lățimea cardului din față | 324 px | 288 px |
| carduri vizibile simultan | 7 | **5** |
| înălțimea paginii | 3843 px | **3843 px — neschimbată** |

Un efect secundar bun: un card dispare **exact înainte** să treacă în spatele elicei, așa că ADN-ul
se vede **printre** carduri, nu în spatele lor — exact problema pe care o semnalasem la runda 1.

### Verificare

| Ce | Rezultat |
| --- | --- |
| Unit | 1.535 teste / 72 fișiere; build + `tsc` + lint curate |
| E2E | `interior-webgl` 24 + `interior` 22 = 46 |
| Contrast card-front | 100% din pixeli, pe 48 de combinații (nume 4,46 · etichete 6,35 · descriere 6,16) |
| Titlul „Lucrări" | 0 pixeli schimbați de scenă |
| Desene/cadru | 5 în spirală, 0 la final — identic cu runda 1 |
| Greutate | CSS +291 B, chunk three +96 B, HTML +13/17 B, JS târziu 0 |

Testele cu tabele de layout fixate au fost re-fixate pe distanțele noi (lățimea cardului, pozițiile
la focus 1, pragul de stingere citit acum din constantă, nu dintr-un literal, ca să nu se mai poată
desincroniza). Niciun test nu a fost slăbit.

**Rămâne de îmbunătățit:** stratul de scanare se randează pe fiecare card și acolo unde nu se poate
anima niciodată (banda de telefon, grila simplă) — inert, dar greutate moartă; la 1024×768 cardul
încă se lovește 11px de banda șinei pe o parte a orbitei; WebKit rămâne neverificat.

Fișiere: `app/tailwind.css`, `components/sections/Work.tsx`, `components/scene/helix.ts`,
`components/scene/workHelix.ts` și testele `scene-helix`, `scene-helix-model`.
Documentație: [docs/05](./docs/05-page-sections.md) · [docs/04](./docs/04-design-system.md).

## 2026-09-18 — Changed: spirala ADN — intrare animată, circulație 3D reală și un final care se încheie

Clientul s-a uitat la spirala din „Proiectele care ne reprezintă” și a spus că e prea simplă, că
rotirea prin ADN arată urât și că finalul „pur și simplu se blochează”. Toate trei erau adevărate.

**Rotirea.** Cardurile nu se întorceau deloc: driverul le scria doar poziție, scară și opacitate,
deci alunecau lateral una peste alta. Acum fiecare card primește o **poziție 3D derivată din
propriul unghi pe elice** — se rotește în lături pe măsură ce trece în spate și revine cu fața când
se întoarce în față, se înclină ușor pe panta firului și e împins în adâncime pe jumătatea
îndepărtată a orbitei (niciodată spre cameră, deci cutia lui proiectată doar se micșorează).
`perspective(1200px)` se scrie **pe card**, nu pe pistă: pe pistă ar crea un context de stivuire și
ar scoate cardurile din spate de sub canvas. Cum toate cardurile stau în aceeași celulă de grilă,
punctul de fugă rămâne comun. Cardul din față e la zero, deci randarea și contrastul lui nu se
schimbă cu nimic. Un test nou mătură focusul 0→8 la cinci lățimi și verifică să nu existe niciun
salt între carduri vecine.

**Intrarea.** Înainte cardurile pur și simplu *erau* acolo. Acum secțiunea are o intrare
**cronometrată**, pe poarta Work existentă (1,2s), eșalonată card cu card de-a lungul firului: un
card pornește pliat pe axa firului, mic și întors, și se desface pe locul lui, în timp ce roiul vine
de la modelul de servicii și elicea se formează. Poarta merge pe ceasul ei, nu pe scroll, deci se
termină întotdeauna și nu poate rămâne pe jumătate.

**Finalul.** Cauza blocajului, măsurată: focusul ajungea pe ultimul card cu **234px** de scroll
înainte ca acesta să se desprindă din poziția lipită (346px pe tabletă), iar în banda aceea
transformarea fiecărui card era identică octet cu octet. Mai rău, elicea *nu* îngheța odată cu ele —
zona ei se oprea în alt punct, așa că pleca din cadru fără carduri. Acum pista primește încă **1,35
pași de card**, focusul curge mai departe cu exact aceeași viteză (fără schimbare de ritm la
predare), cardurile se pliază pe axa firului și dispar, iar elicea se răsucește, își strânge firele
într-un fascicul și se dizolvă — fix când cardurile se desprind și secțiunea următoare intră în
cadru. Elicea și cardurile rămân legate pe tot parcursul finalului.

**Elicea răspunde vizitatorului**, fără niciun desen nou: viteza scrollului accelerează pachetele,
biții 0/1 și cometa de pe trepte și ridică strălucirea; sosirea unui proiect în față sau schimbul
hologramei aprind firele ~0,55s. Sunt doar valori trimise altfel către placa video.

Un card estompat sub 8% opacitate nu mai preia clicul (înainte îl prelua).

### Verificare

| Ce | Rezultat |
| --- | --- |
| Unit | 1.534 teste / 72 fișiere (erau 1.531); build + `tsc` + lint curate |
| E2E | `interior-webgl` 24 + `interior` 22 = 46, rulate de două ori pe două build-uri |
| Teste noi | 8: poziția 3D, invariantul „niciodată spre cameră”, continuitatea rotirii, eșalonarea intrării, lungimea și ritmul finalului |
| Contrast card-front | 100% din pixeli trec, pe 48 de combinații (nume min 4,19 · etichete 7,83 · descriere 6,16) |
| Titlul „Lucrări” | 0 pixeli schimbați de scenă în modul spirală |
| Desene/cadru | 5 în spirală (neschimbat), **0 la finalul secțiunii** (înainte: 5) |

### Greutate (gzip)

| Caz | Înainte | Acum | Δ |
| --- | --- | --- | --- |
| bucata comună three | 271.060 | 271.950 | +890 B |
| B2 total | 597.292 | 598.187 | +895 B |
| B3 total | 606.499 | 607.394 | +895 B |
| B1 / B4 total | 295.301 / 263.460 | 295.306 / 263.465 | +5 B |
| JS târziu | — | — | 0 |

Pagina crește cu ~410px la 1280×800 (530px la 768×1024) — scrollul propriu al finalului, care
înlocuiește ~234px de scroll înghețat.

**Rămâne de îmbunătățit:** la 1280px cardurile acoperă elicea aproape tot parcursul (se vede ca ADN
abia la final); laboratorul de contrast măsoară o cutie aliniată pe axe, care pentru un card rotit
prinde și pixeli din afara lui; ultimii ~150px dinaintea secțiunii următoare rămân goi; WebKit nu e
verificat (suita e Chromium).

Fișiere: `components/scene/helix.ts`, `components/scene/workHelix.ts`,
`components/scene/three/models/helix.ts`, `components/scene/three/world.ts` și testele
`scene-helix`, `scene-helix-model`, `scene-build`.
Documentație: [docs/05](./docs/05-page-sections.md) · [docs/04](./docs/04-design-system.md).

## 2026-09-18 — Fixed: trei teste care cădeau doar când mașina e încărcată

Trei teste măsurau, fără să vrea, viteza mașinii, nu comportamentul aplicației. Cădeau la rulările
în paralel cu alte containere și treceau singure — genul de eșec care ne-ar fi învățat să ignorăm
suita. Fiecare a fost reprodus sub CPU limitat (`--cpus=0.2`), i s-a găsit cauza și a fost rescris
să verifice același lucru, dar determinist.

- **`direction-page.test.tsx` — „opens the real request flow in place”.** Prima apăsare pe CTA
  plătea încărcarea întregului flux de cerere (`next/dynamic`) în fereastra de 1s a lui `findBy*`.
  Acum modulul e importat o dată în `beforeAll`, prin același specificator; așteptarea acoperă doar
  randarea.
- **`intro-preloader.test.tsx` — „Tab skips too”.** Testul citea `document.activeElement` *după*
  Tab; dar Tab-ul pornește chiar secvența care, la final, ia focusul de pe overlay — corect, însă pe
  o mașină încărcată secvența apucă să se termine înainte de citire. Acum focusul e înregistrat în
  clipa în care se mută (`focusin`), deci se verifică exact „Tab a mutat focusul pe butonul de
  sărire, o singură dată”.
- **`e2e/preloader.spec.ts` — stingerea intro-ului.** Cauza reală: `gsap.ticker.lagSmoothing(0)`
  (`IntroDirector.tsx`) comprimă, sub încărcare, estomparea de 550ms într-un singur cadru, pe care
  eșantionarea la 15ms îl rata. Specul folosește acum `MutationObserver` + `requestAnimationFrame` +
  evenimentele de tranziție și verifică structural `pointer-events`.

Verificare: cele două fișiere unit, 11 rulări consecutive la `--cpus=0.2`, 53/53 de fiecare dată
(înainte: 9 din 10 rulări cădeau). Suita unit completă 1.523/1.523. `preloader.spec` 72/72 fără
limitare și 10/10 cu CPU încetinit de 4×.

Fișiere: `components/__tests__/direction-page.test.tsx`,
`components/__tests__/intro-preloader.test.tsx`, `e2e/preloader.spec.ts`.

## 2026-09-18 — Faza 5: șina de fibră optică (bara de derulare care devine navigație)

A șasea fază a experienței IT aprobate. Pe **desktop (≥861px)**, pe marginea din dreapta, sub
header și până deasupra colțului ghidului, apare o **șină de fibră optică** de 44px: un fir stins pe
toată înălțimea, un fir aprins care se umple odată cu derularea, un cap luminos, o dâră care
călătorește **doar cât timp vizitatorul derulează** și câte un **romb** pentru fiecare secțiune,
aprins după ce a fost depășit și pulsând o dată la trecerea în jos.

Peste fibră stă o **navigație reală**: `<nav aria-label="Secțiunile paginii">` cu butoane de 44×44,
fiecare cu eticheta lui la hover și la focus. Apăsat, butonul derulează la secțiunea lui — lin, sau
instant sub „reduced motion”; activat de la tastatură, **mută și focusul** în secțiune. Fibra în
sine e `aria-hidden` și nu primește clicuri.

**Derularea nativă rămâne.** Nu e un scroll fals: bara nativă e doar subțiată și colorată cyan
(`scrollbar-width: thin`). Bara de progres de sus dispare **doar acolo unde există șina**
(`body:has([data-rail])`); **sub 861px** nu există șină, iar bara de sus e restilizată ca o fibră, cu
un cap de 18×2px — numai din CSS.

Șina se măsoară singură: marcajele se recalculează la `ResizeObserver` pe document și la evenimentul
de layout al scenei, pentru că **spirala ADN din Faza 3 crește pista secțiunii „Lucrări”** după ce
se formează. Cât timp pagina e acoperită (dialog, meniu), șina nu mai scrie nimic.

- matematica pură, în `lib/hud/rail.ts` (progres, secțiuni, marcaje, ținte);
- interfața, în `components/hud/rail/` (`ScrollRail.tsx`, `ScrollRail.module.css`, `copy.ts`);
- montarea: `HudChrome` randează șina **numai** cât timp `(min-width: 861px)` se potrivește, citit
  prin `useSyncExternalStore` — pe telefon bucata de cod nici nu se descarcă.

### Verificare

| Ce | Rezultat |
| --- | --- |
| Unit (alpine) | 1.523 teste / 72 fișiere, build + `tsc --noEmit` + lint: 0 erori |
| E2E (noble) | suita completă 306; `scroll-rail.spec` 9 noi; `hud-integration` 17→23 (HI9–HI11) |
| Repetări ×3 | `preloader`, `hud-shell`, `interior`, `interior-webgl`, `scroll-rail`: 273 trecute |
| Mutanți | 4 în `HudChrome` + 1 în `ScrollRail`, toți prinși |
| Contrast | etichete și marcaje ≥4,5:1 în ambele teme, 320–1280 |

### Greutate (gzip, pagina principală)

| Rând | Înainte | Acum | Notă |
| --- | --- | --- | --- |
| B1 | 263.172 | 263.460 | +288 B (CSS-ul fibrei) |
| B5 | — | 223.976 | limita proprie 224.000 — au rămas 24 B |
| B1h (după armare) | 9.834 | 13.270 | +3.436 B, bucata șinei, doar pe desktop |
| H (HTML) | 21.667 | 21.667 | neschimbat — nimic nu se randează pe server |

Bucata șinei: 3.436 B JS + 1.398 B CSS gzip, descărcată abia după armarea HUD-ului.

**Abateri și riscuri:** B5 are doar 24 B marjă, deci orice adăugire la scenă trebuie măsurată; la
861–1100px zona de atingere a unui marcaj se suprapune cu marginea conținutului pe cel mult 10px;
culoarea cyan a barei native se moștenește și în dialoguri (acceptat și documentat).

Fișiere: `lib/hud/rail.ts`, `components/hud/rail/*`, `components/hud/HudChrome.tsx`,
`app/globals.css`, `e2e/{helpers,scroll-rail.spec,hud-integration.spec}.ts`, `e2e/README.md`,
teste noi `lib/__tests__/rail.test.ts` și `components/__tests__/scroll-rail.test.tsx`.
Documentație: [docs/03](./docs/03-architecture.md) · [docs/04](./docs/04-design-system.md) ·
[docs/05](./docs/05-page-sections.md) · [docs/07](./docs/07-conventions.md) ·
[docs/11](./docs/11-security.md) · [docs/14](./docs/14-testing.md) ·
[docs/16](./docs/16-i18n-seo.md).

## 2026-09-17 — Faza 4: Ghid TBS (asistentul holografic care deschide cererea ghidată)

A cincea fază a experienței IT aprobate. În colțul din dreapta-jos al **fiecărei pagini a site-ului**
apare, după ce vizitatorul face ceva, **Ghid TBS**: un mic droid holografic, un cub CSS-3D într-un
fascicul de lumină, cu două orbite și o vizieră. E un `<button aria-haspopup="dialog">` real. Apăsat,
deschide **fluxul de cerere existent** (dialogul Modal) direct pe chat-ul ghidat.

Când vizitatorul **zăbovește 5 secunde de timp vizibil** cu aceeași secțiune pe linia de mijloc a
ecranului (`#servicii`, `#lucrari` sau pașii „Cum lucrăm” de pe o pagină de serviciu), droidul
pulsează și arată un **sfat scurt**, cu „Deschide ghidul” și „Nu mai arăta în această vizită”.
Limite: cel mult **2 sfaturi pe durata paginii**, **60s** între ele, fiecare secțiune o singură dată.
Memoria e o variabilă de modul: supraviețuiește navigării în site, dispare la reload, **nimic nu se
scrie în storage sau în cookie-uri**.

Ghidul **nu se prezintă niciodată drept „AI”**: e „Ghid TBS” / „Гид TBS” / „TBS Guide”, iar singura
promisiune de timp e cea pe care o face deja `SENT_COPY` (o zi lucrătoare).

Trei owneri, pe fișiere disjuncte:
- motorul de zăbovire, pur (P4-A);
- interfața ghidului (P4-B);
- montarea, integrarea, E2E, greutatea, documentația (P4-C).

**HUD-ul se încarcă abia după prima interacțiune.** Pagina primește doar montura `HudChrome`
(+473 B gzip pe `/`, +675 B pe o pagină de serviciu); componenta ghidului, CSS-ul ei și iconița ✕ vin ca chunk-uri târzii după ce
bannerul de cookie-uri are un răspuns, vizitatorul a mișcat mouse-ul / a atins / a derulat / a apăsat
o tastă, intro-ul a plecat și browserul are un slot liber. De aceea rândurile fără interacțiune
(B1, B4, B5, B6) aproape nu se mișcă, iar costul real se vede în rândurile noi **B1h / B5h / B6h** și
în cele cu scroll (B1s, B2, B3), unde scroll-ul e interacțiunea. CSP-ul e neschimbat, nicio dependență
nouă (lucide-react 1.46.0 exista din Faza 0).

**Added** — motorul de zăbovire (`lib/hud/linger.ts`, `lib/__tests__/guide-linger.test.ts`) — vezi
[03](./docs/03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17) și
[05](./docs/05-page-sections.md#ghid-tbs-the-guide)

- **`GUIDE_LIMITS = { lingerMs: 5000, cooldownMs: 60_000, maxPerSession: 2 }`.**
- **`canPrompt(memory, topic, now, blockers)`**: nu dacă vizitatorul a renunțat, dacă s-au arătat
  deja 2 sfaturi sau dacă secțiunea a avut deja unul (`isFinal`); nu în cooldown
  (59.999ms blochează, 60.000ms permite); nu cu un `now` care nu e număr finit; nu cât timp e activ
  vreunul din cele **șapte blocaje** `GuideBlockers`: `covered`, `intro`, `banner`, `typing`,
  `requestOpen`, `away`, `busy` (`isHudBusy()`, R5).
- **Memorii înghețate**: `recordPrompt` și `optOut` întorc una nouă și nu-și schimbă intrarea (nici
  setul `shown`); `createGuideMemoryStore()` e celula unică pe care o ține componenta.
- **`pickTopic`**: elementul cel mai adânc dintre cele de pe linia de mijloc; la egalitate, primul în
  ordinea țintelor.
- **`isTypingTarget`**: `textarea`, `select`, un `input` de tip text (orice tip în afară de
  button / submit / reset / checkbox / radio / range / color / file / image; un tip lipsă sau
  necunoscut e text), conținut editabil (cel mai apropiat `[contenteditable]` decide, doar `"false"`
  îl oprește); doar în namespace-ul HTML, un SVG nu aruncă.
- Fără importuri, fără DOM la import, fără directivă. **75 de teste**; 10 mutanți prinși (P4-A).

**Added** — Ghid TBS (`components/hud/guide/GuideAssistant.tsx`, `GuideAssistant.module.css`,
`copy.ts`, `components/__tests__/guide-assistant.test.tsx`) — vezi
[04](./docs/04-design-system.md#ghid-tbs--the-guide), [05](./docs/05-page-sections.md#ghid-tbs-the-guide)
și [16](./docs/16-i18n-seo.md#the-hud-chrome-adds-no-keys)

- **Droidul**, desenat doar din CSS: șase fețe translucide cu scanlines, `preserve-3d`, în poză de
  trei sferturi; o vizieră (o bară, nu un ochi); un fascicul; două orbite (38/46px, 46/56px de la
  861px) cu câte un pachet-dâră; un val pătrat de semnal; colțuri-paranteză. Legenda „GHID TBS” în
  mono (ascunsă până la 640px, 9px la 641–860px, 11px de la 861px).
- **Plasament** (R2): 52×52 la 12px de colț până la 640px, 64×72 la 641–860px, 88×88 la 20px de la
  861px, pe `--z-guide` (112), sub meniul burger, dialog și intro. Sfatul: `min(320px, 100vw − 24px)`,
  la 72px de jos pe telefoane, 92px la 641–860px (8px deasupra avatarului de 72px), `right: rail + 8px`
  și 116px de jos pe desktop; derulează în el însuși în loc să treacă sub header.
- **Starea** e pe rădăcina `[data-hud][data-guide]`: `data-state="enter|idle|prompt"`, `data-away`,
  `data-yield`.
- **Linia de mijloc**: un `IntersectionObserver` cu `rootMargin: "-50% 0px -50% 0px"` peste
  `#servicii`, `#lucrari` și fiecare `[data-guide-topic]` valid; un `visibleTimeout` de 5s rearmat la
  fiecare schimbare de secțiune. Când un blocaj ține sfatul pe loc, așteptarea reîncepe până când
  secțiunea nu mai poate avea sfat.
- **Sfatul**: fără rol și fără live region; descrie butonul prin `aria-describedby` (doar propoziția).
  Pleacă atunci când secțiunea iese de pe linie, se deschide fluxul, pagina e acoperită sau focusul
  aterizează sub el. Escape în ghid îl închide; focusul care era în el trece pe avatar.
- **Away**: cât formularul de cerere al paginii (`#estimare`, `data-layout="section"`) e în ecran,
  avatarul și sfatul trec la opacitate 0, fără pointer, cu butoanele la `tabIndex -1`. Niciodată
  `display: none`, `visibility: hidden` sau `inert`, ca dialogul să poată întoarce focusul.
- **Yield** (WCAG 2.4.11): focusul pe ceva acoperit de ghid îl estompează (`lib/hud/obscure.ts`).
- **Deschiderea**: `openRequest({ source: "guide" | "guide-prompt", openAssistant: true, guideTopic,
  serviceSlug, projectId, projectName, returnFocusTo })`. Serviciul vine din cale (cu sau fără
  `/ru` · `/en`), doar dacă `lib/directions.ts` îl știe; proiectul doar pe `lucrari`, din cardul
  `[data-helix-front]` al spiralei (R9.5).
- **Mișcare** (WCAG 2.2.2): intrare 0.7s, puls 3 × 1.4s cât e sfatul, rotire doar sub pointer
  (`hover: hover`). Tot e în `prefers-reduced-motion: no-preference`; sub reduce totul stă, sfatul
  apare. Fără `backdrop-filter` și fără `filter`.
- **Copie**: `GUIDE_COPY`, obiecte `L(ro, ru, en)` locale, nicio cheie nouă în catalog.
- **41 de teste**; 12 mutanți prinși (P4-B).

**Added** — montarea (`components/hud/HudChrome.tsx`, `app/(site)/layout.tsx`,
`components/sections/DirectionPage.tsx`) — vezi [03](./docs/03-architecture.md#arming-order)

- `PARTS` = `[GuideAssistant]`, prin `next/dynamic(() => import("./guide/GuideAssistant")…, { ssr:
  false })`. Poarta a rămas exact ca în Faza 0: `tbs_hud` ≠ off → consimțământ (răspunsul e
  interacțiunea) → primul eveniment de interacțiune → intro-ul plecat → slot liber.
- `<HudChrome />` stă în layout-ul `(site)` **între `<Footer />` și `<CookieConsent />`**: după
  subsol în DOM, deci buget-ul de 40 de Tab-uri al header-ului și „skip-ul intro-ului e primul Tab”
  rămân valabile.
- Pașii „Cum lucrăm” de pe paginile de serviciu au `data-guide-topic="service"`.

**Added** — E2E (`e2e/guide.spec.ts`, `e2e/hud-integration.spec.ts`, `e2e/helpers.ts`) — vezi
[`e2e/README.md`](./e2e/README.md) și [14](./docs/14-testing.md#end-to-end--playwright)

- **`guide.spec.ts` (12)**, cu HUD-ul pornit (`HUD_ON`, consimțământ, `armHud`):
  - 1280: nimic din HUD înainte de interacțiune; apoi un buton real (`aria-haspopup`, numele
    `GUIDE_COPY.aria`, 44px, cutia 88×88 la 20px, z 112);
  - `#servicii` pe linia de mijloc: niciun sfat la 3.5s, sfatul până la 12s, focus rămas pe `BODY`,
    fără scroll lateral, fără puncte, cele trei butoane de 44px;
  - un sfat închis nu revine (plecat, întors, încă 6s);
  - avatarul deschide dialogul pe chat (`aria-expanded="true"`, focus înăuntru), iar blocul de
    origine al cererii trimise (stub) e exact `- Sursă (CTA): guide`; butonul sfatului trimite
    `- Secțiune: servicii` / `guide-prompt`;
  - Tab ajunge la RO în ≤ 40; peste `#estimare` e `data-away`, opacitate 0, `tabindex=-1`;
  - fără consimțământ nu apare nimic, iar „Accept” îl aduce fără altă mișcare; la prima vizită ghidul
    și intro-ul nu stau niciodată împreună în DOM;
  - reduced motion: sfatul apare, nicio animație în `[data-guide]`;
  - `/servicii/e-commerce`: sfatul `service`, prețul magazinului, originea `- Serviciu: e-commerce` /
    `- Secțiune: service` / `- Sursă (CTA): guide`, 0 canvas, fără three.js și GSAP, 0 încălcări CSP,
    0 erori în consolă;
  - 375×812: avatarul 52×52 la 12px, în viewport; cu dialogul deschis, un click în centrul lui nu
    atinge ghidul.
- **`hud-integration.spec.ts` (17)**, HI1–HI8 din critica §4, cu HUD-ul armat: click-urile pe telefon
  (390×844 touch) ajung la controale; Tab la RO în ≤ 40; un singur dialog după un CTA și un singur
  banner de cookie-uri la prima vizită; fără scroll lateral la 320 / 390 / 768 / 1280 în ambele teme;
  fără puncte după un scroll complet și `<html>` / `<body>` neatinse; 0 CSP, 0 erori, fără three.js /
  GSAP; `/servicii/e-commerce` fără canvas, scenă sau context viu, cu HUD-ul prezent; ghidul away
  peste `#estimare` și ultimul link din subsolul de pe telefon atins, nu ghidul.
- **Helpers**: `guideRoot`, `guideAvatar`, `guideTip`. `armHud` mișcă acum pointerul din nou la
  fiecare 250ms până apare o parte `[data-hud]` (maxim 5s): `gotoHydrated` așteaptă hidratarea
  header-ului, iar ascultătorii `HudChrome` se atașează într-un efect care poate veni puțin mai târziu,
  deci o singură mișcare se putea pierde (1 din ~60 de armări în laborator).

**Fixed** — sfatul și avatarul lăsau textul paginii să se vadă prin ele
(`components/hud/guide/GuideAssistant.module.css`) — vezi [04](./docs/04-design-system.md#ghid-tbs--the-guide)

- `--glass-bg-solid` e opac doar 94%. În capturile din aplicație, textul unui card Directions sau al
  unui proiect de sub sfat („BIZCHECK”, descrierea, „PLATFORMĂ WEB”) se citea prin propoziția
  sfatului, mai ales în tema light, unde cardul e un bloc ink.
- Acum `background-color: var(--bg)` sub un gradient de o culoare din `--glass-bg-solid`: pe pagina
  simplă arată la fel, peste text nu se mai vede nimic. Contrastul devine cel „peste `--bg`” din tabelul
  de sticlă (`--txt` 17,75 / 15,68, `--mut` 5,67 / 8,41, `--cyan-text` 5,34 / 10,70).
- Un test nou în `guide-assistant.test.tsx` fixează regula (40 → 41).

**Changed** — aserțiuni de test schimbate deliberat (niciuna slăbită)

- `hud-chrome.test.tsx`: „nothing renders … and no part yet after it” devine „… then the guide part”:
  înainte de armare tot nimic, iar după slotul liber partea ghidului (un stub pentru `next/dynamic`)
  **trebuie** să apară, o singură dată. Două teste noi: partea nu apare cât consimțământul lipsește și
  nici cu `tbs_hud=off` (21 → 23).
- `decorative-dots.test.tsx`: scanează și `GuideAssistant.tsx` și modulul lui CSS. Regula CSS nouă
  (`border-radius: 50%` sau `var(--r-pill)` la ≤ 8px) rezolvă și mărimile `var(--token)` din același
  fișier, e fixată pe fixture-uri și interzice blur/filter; ✕-ul are capete pătrate (12 → 15).
- `direction-page.test.tsx`: pașii fiecărei pagini de serviciu sunt singurul `[data-guide-topic]`,
  cu valoarea `service` (23 → 26).

**Changed** — unealta de greutate (în afara repo-ului, `scratchpad/tools`)

- `measure-home-weight.mjs`: comutatorul `ARM_HUD=1` (R12). După încărcare mișcă mouse-ul la (10, 10),
  repetat la 500ms, și așteaptă `[data-hud]` până la 5s. Fișierele sosite de atunci au faza `hud`;
  rezultatul are `hud = { armed, waitMs, moves, lateJsGzip, lateCssGzip, files }` și `hudParts`.
- `weight-cases.sh`: cazurile `home-introseen-armhud` (B1h), `ecommerce-armhud` (B5h) și
  `home-introseen-reduced-armhud` (B6h). Cazurile nu mai moștenesc `BUILD=1` (fiecare reconstruia și
  scria log-ul build-ului în JSON).

**Docs**

- [03](./docs/03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17): arborele
  (`components/hud/guide/*`, `lib/hud/linger.ts`), montura `HudChrome` în layout, ordinea armării,
  cablajul ghidului.
- [04](./docs/04-design-system.md#ghid-tbs--the-guide): droidul, sfatul, tokenii de plasament, stările,
  regulile de mișcare, contrastul; statusul paletei Cyber Dark.
- [05](./docs/05-page-sections.md#ghid-tbs-the-guide): comportamentul, secțiunile, limitele, memoria pe
  durata paginii (supraviețuiește navigării în site), niciodată „AI”, ce trimite (sursă, secțiune,
  serviciu, proiect); contextul cererii.
- [07](./docs/07-conventions.md#the-hud-chrome-componentshud-libhud): CSS Modules pentru părțile HUD,
  regulile away / yield / covered, fără blur, fără puncte, mișcare, importuri, copie.
- [11](./docs/11-security.md#the-ghid-tbs-guide-it-os-phase-4-2026-09-17): fără storage nou (cheia QA
  `tbs_hud` era deja listată), ghidul trimite doar ce trimite vizitatorul, id-uri validate, CSP
  neschimbat.
- [14](./docs/14-testing.md): noile fișiere de test și numărătorile, `guide.spec`, `hud-integration.spec`,
  nota despre survey-ul `E2E_HUD=on`.
- [16](./docs/16-i18n-seo.md#the-hud-chrome-adds-no-keys): obiectele `L()` din `GUIDE_COPY`.
- [`e2e/README.md`](./e2e/README.md): cele două spec-uri, locatorii, așteptările reale, `armHud`.

**Verificare**

| Check | Rezultat |
|---|---|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, arborele montat, cu reparația opacității) | exit 0 · 0 · 0 |
| `npm test` (node:22-alpine) | **1.433 passed / 0 failed** în 70 de fișiere (Faza 3: 1.309 în 68; +75 `guide-linger`, +41 `guide-assistant`, +2 `hud-chrome`, +3 `decorative-dots`, +3 `direction-page`) |
| E2E noble, P4-C: `guide` + `hud-integration` + `interior` + `hud-shell` + `keyboard` + `responsive` + `preloader` + `contact-form` + `request-flow` + `chat` | **194 passed / 0 failed** (guide 12, hud-integration 17, interior 22, hud-shell 25, keyboard 6, responsive 66, preloader 24, contact-form 6, request-flow 12, chat 4) |
| `guide` + `hud-integration`, prima rulare (înainte de gate) | 27 passed / 2 failed: două greșeli ale spec-ului, reparate — `test.use({ reducedMotion })` e ignorat aici (trebuie `contextOptions`), iar avatarul era măsurat în timpul intrării de 0.7s; apoi `guide` 12 / 12 |
| După ultimele editări (limita de 12s, comentarii): `tsc` · `lint` · `guide-assistant` + `hud-chrome` + `decorative-dots`; `guide.spec` | 0 · 0 · 79 / 79; **12 / 12** |
| Survey `E2E_HUD=on` (suita completă fără `tbs_hud=off` seed-uit, deci HUD-ul poate arma în orice spec care seed-uiește consimțământul și mișcă mouse-ul, derulează sau apasă o tastă) | **291 passed / 0 failed / 0 flaky** (toate cele 17 spec-uri, inclusiv `interior-webgl` 24 / 24). Nimic de triat: niciun spec existent nu a fost deranjat de ghid (colțul din dreapta-jos, sfatul doar după 5s pe linia de mijloc, away peste `#estimare`) |
| Laborator în aplicație (noble, fonturi reale) | capturi idle, colț și sfat la 1280 / 768 / 390 / 320, dark și light, pe `/` și `/servicii/e-commerce` (16 cazuri, după reparația opacității; cele dinainte păstrate pentru comparație); sfatul, citit din Node, apare la 5,30s de la scroll (de patru ori ~8,02s, toate pe pagina de serviciu); măsurat **în pagină**, 35 de repetări pe `/servicii/e-commerce` la 320 / 390 / 768 / 1280 și pe `/` la 1280, cu și fără capturi înainte: **5,02–5,04s** de fiecare dată, secțiunea pe linie tot timpul, deci întârzierea nu se reproduce în pagină și pare a harness-ului (limita de sus din `guide.spec` a crescut totuși de la 9 la 12s); lățimea legendei cu JetBrains Mono încape peste tot (cel mai strâns: „TBS GUIDE” 48,25 px în 62 px la 641–860px, 70,92 în 86 la ≥ 861px); rădăcina IntersectionObserver de înălțime 0 raportează `isIntersecting` corect în Chromium (vezi mai jos) |
| `npm test` rulat de 2 ori pe snapshot-ul exportat din index (node:22-alpine) | 1.433 / 1.433 de ambele dăți; build · tsc · lint exit 0 |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă) | **291 passed / 0 failed / 0 skipped** (Faza 3: 262; + `guide` 12, `hud-integration` 17) |
| `preloader` + `hud-shell` + `interior` + `interior-webgl` + `guide` + `hud-integration`, `--repeat-each=3` | 371 passed, **1 failed**: `preloader` „forced WebGL renders the canvas and completes at 100” (a doua repetare), rulat în paralel cu agenții Fazei 5. Același test a picat o dată și în gate-ul Fazei 3 sub încărcare; eșantionarea click-ului la 15ms poate rata tot fade-ul de ~0.55s când firul principal e ocupat. Faza 4 nu atinge intro-ul; testul e trecut la *Rămâne deschis* |

**Rădăcina de înălțime 0 (riscul P4-B, verificat).** Un `IntersectionObserver` cu `rootMargin: "-50% 0px
-50% 0px"`, în Chromium, la 1280×800, 1280×801, 390×844, 390×845, 375×812, 320×720 și 768×1024:
- un element care traversează mijlocul (600px, 2px, mai înalt decât viewport-ul) → `isIntersecting: true`;
- un element deasupra sau dedesubt (la 10px distanță) → `false`;
- un element a cărui margine e **exact** pe linie → `true` (intersecție inclusivă pe margine);
- `#servicii` și `#lucrari` centrate → `true`;
- la o înălțime impară rădăcina devine 1px (`rootBounds.height` 1), cu aceleași răspunsuri.
Nu trebuie reparat nimic. WebKit și Firefox nu au fost verificate.

Greutate (gzip, bytes; același script, aceleași cazuri plus trei noi; baza e **arborele Fazei 3
nemontat**, măsurat din nou de P4-C înainte de montare, `p4base`):

| Buget | Caz | Bază (Faza 3, nemontat) | Faza 4 | Diferență |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine, fără interacțiune | total 262.699 · referit din HTML 257.809 · JS târziu 3.936 | total **263.172** · referit 258.282 · JS târziu 3.936 | +473 (JS-ul paginii: `HudChrome` și referința lui `next/dynamic`); CSS 0 |
| **B1h** (nou) | B1 + o mișcare de mouse (`ARM_HUD=1`) | — | total **271.419** · JS târziu **9.834** · CSS târziu 3.303 | ghidul: **JS 5.898** + **CSS 2.349** (un chunk JS, un chunk CSS), sosite doar după armare |
| B1s / B7 | B1 + scroll · pe mobil | JS târziu 3.936 · CSS târziu 954 | JS târziu **9.834** · CSS târziu 3.303 | +5.898 JS / +2.349 CSS: **scroll-ul e interacțiunea**, deci ghidul se încarcă; e costul HUD-ului, nu o regresie a paginii |
| B2 | scenă forțată + scroll (desktop și mobil) | JS târziu 324.687 | **330.585** | +5.898 (ghidul, prin scroll). Față de B1s: B1s + 320.751 — sub limita propusă în Faza 3 (B1s + 321.000), peste cea a planului (B1s + 316.000) cu 4.751, exact ca înainte |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 333.894 (total 592.657) | **339.792** ✗ (total 601.377) | +5.898 (ghidul, prin scroll). **Peste** limita planului (330.000) cu 9.792 și peste cea propusă în Faza 3 (335.000) cu 4.792 → re-baseline cerut, motivul: HUD-ul inclus prin `SCROLL=1` |
| B3i | prima vizită, intro forțat, fără scroll | 314.400 | **314.400** | 0 |
| B4 | prima vizită, fără interacțiune | JS târziu 35.777 | **35.777** ✓ (≤ 36.500) | 0 (banner-ul fără răspuns nu armează nimic) |
| B5 | `/servicii/e-commerce`, fără interacțiune | total 223.013 (limită 224.000) | **223.688** ✓ | +675 (`HudChrome` plus `lib/idle`, `lib/intro`, `lib/hud/gate`, pe care pagina de serviciu nu le avea; **312 B rezervă**) |
| **B5h** (nou) | B5 + o mișcare de mouse | — | total **231.935** · JS târziu 5.898 · CSS târziu 2.349 | ghidul; fără three.js, GSAP, probă sau stage (0 contexte) |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte | **3.219**; 0 contexte ✓ | 0 (total +473, ca B1) |
| **B6h** (nou) | B6 + o mișcare de mouse | — | JS târziu **9.117**; 0 contexte ✓ | ghidul, +5.898 |
| H | documentul HTML `/`, care revine | 21.653 | **21.672** ✓ (≤ 22.230) | +19 (referința clientului `HudChrome` în RSC; zgomotul nonce-ului e ±10) |
| — | chunk-ul comun three + R3F + scene | 271.060 | neschimbat | 0 (B3i identic) |

Chunk-ul ghidului are 14.619 B raw / 5.851–5.898 B gzip: componenta, `copy.ts` în trei limbi, `linger`,
`obscure`, `topics`, `busy`, iconița `X` cu baza lucide și **o copie a `lib/directions.ts`** (Turbopack
nu o împarte cu bundle-ul paginii). Planul estima ≈ 3,5 KB JS și 1,2 KB CSS; măsurat e 5,9 KB și
2,3 KB. Toate cazurile: exit 0, 0 erori de pagină, `hudParts` 0 în fiecare caz fără interacțiune și
1 după armare sau scroll (`armed` la prima mișcare, `moves` 1).

> **Rămâne deschis:**
> - **Testul de intro WebGL forțat e fragil sub încărcare** (`preloader.spec.ts` „forced WebGL renders the canvas and completes at 100”): eșantionarea click-ului pe CTA-ul din header la 15ms poate rata tot fade-ul când CPU-ul e ocupat de alte containere. A picat o dată în gate-ul Fazei 3 și o dată aici, mereu cu agenți în paralel; de stabilizat.
> - **B3 peste limită** (339.792 față de 330.000, și față de 335.000 propus în Faza 3): ghidul intră
>   prin `SCROLL=1`. **B2** e B1s + 320.751. Re-baseline explicit, cu motivul: HUD-ul inclus prin scroll.
> - **B5 are 312 B rezervă.** Planul mai pune pe B5 ≈ +150 (Faza 5, CSS) și ≈ +50 (Faza 6): încape la
>   limită; orice altceva în bundle-ul paginilor de serviciu cere re-baseline.
> - **Chunk-ul ghidului e mai mare decât estimarea** (JS 5,9 KB față de ≈ 3,5; CSS 2,3 față de ≈ 1,2),
>   între altele cu o copie a `lib/directions.ts`. Nu costă nimic până la interacțiune.
> - **Sfatul poate acoperi conținut.** La 1280 stă peste colțul cardului Directions, la 320–390 peste
>   jumătate din pașii „Cum lucrăm”, până e închis sau secțiunea iese de pe linie. Acum e opac, deci
>   lizibil; rămâne o decizie de design dacă poziția e bună.
> - **O margine exact pe linia de mijloc** face ambele secțiuni vecine „pe linie” pentru acea poziție
>   de scroll (intersecție inclusivă); `pickTopic` alege prima în ordinea țintelor. Inofensiv.
> - **WebKit și Firefox**: rădăcina IntersectionObserver de înălțime 0 e verificată doar în Chromium.
> - **Primul eveniment înainte de hidratarea `HudChrome`** nu e auzit (header-ul se hidratează primul):
>   un vizitator care face o singură mișcare exact atunci primește ghidul la următoarea interacțiune.
>   `armHud` și unealta de greutate repetă mișcarea.
> - **Proiectul din sfatul `lucrari`** vine doar din spirala WebGL (`data-helix-front`); pe calea
>   implicită (art static, telefoane cu bandă) nu se trimite niciun proiect.
> - **Linkurile din subsolul de pe telefon** au 12px text, sub 44px (dinainte de HUD); HI8 verifică doar
>   că ghidul nu stă peste ultimul.

---

## 2026-09-17 — Faza 3: ADN-ul proiectelor (elicoid 3D, carduri în spirală, hologramă)

A patra fază a experienței IT aprobate. Clientul a cerut ca **cardurile existente ale proiectelor**
(„Proiectele care ne reprezintă”, `#lucrari`) să se rotească în jurul unui ADN: „cardurile cele să
fie la ADN”. Secțiunea Work intră acum în scena interioară. După ce scena a desenat primul cadru, ea
își construiește un **elicoid ADN neon**, iar roiul modelului de servicii selectat zboară pe el.

- **De la 768px lățime și 600px înălțime** cardurile ies din grilă și **se rotesc în jurul
  elicoidului** pe măsură ce pagina se derulează. Fiecare card e `sticky` sub header. Cel din față
  stă peste canvas și primește click-ul; cele din spatele elicoidului trec **pe sub** el, adâncime
  reală, nu un fade.
- Lângă elicoid plutește o **hologramă** a cardului din față: captura lui ca luminanță cu scanlines,
  tag-urile, numele, numărul.
- **Pe telefoane** banda de carduri rămâne exact cum era. Un elicoid mic stă culcat, la
  luminozitate plină, **în banda goală de deasupra titlului** secțiunii, între panoul Directions și
  eyebrow.

Patru owneri, pe fișiere disjuncte:
- modelul elicoidului și holograma (P3-A);
- layout-ul pur și driver-ul DOM al spiralei (P3-B);
- integrarea în stage, E2E (P3-C);
- calibrarea, finisajul, documentația (P3-D).

Niciun program WebGL nou, nicio dependență nouă. JS-ul paginii crește cu **+202 B** și CSS-ul cu
**+106 B** (`data-work-track`, `data-helix`, `SCENE_LAYOUT_EVENT`, clasele din `Work.tsx`); tot restul
e în chunk-ul scenei. Nu există copie nouă pentru vizitator: totul e canvas `aria-hidden`, iar holograma desenează
textul deja localizat al cardului. CSP-ul e neschimbat și nimic nu se scrie în storage.

**Înregistrare de decizie**: decizia R1 din critica IT-OS, „Work nu primește model 3D”, e înlocuită
de deciziile 10 și 12 ale clientului.

**Added** — Work în scenă: cardurile în spirală în jurul elicoidului (`app/(site)/page.tsx`,
`components/scene/helix.ts`, `workHelix.ts`, `SceneWorld.tsx`, `SceneStage.tsx`, `SceneCanvas.tsx`,
`SceneDirector.tsx`, `scrollProbe.ts`, `fx.ts`, `choreography.ts`, `three/world.ts`, `lib/scene.ts`,
`components/sections/Work.tsx`) — vezi
[03](./docs/03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17),
[05](./docs/05-page-sections.md#work) și [07](./docs/07-conventions.md#the-interior-stages-contracts)

- **`<SceneStage>` învelește acum și Work** (Hero → Ticker → Directions → Work). Grila de carduri are
  `data-work-track` (`WORK_TRACK_ATTR`). Pe calea implicită (`pending`, `fallback`, `off`, reduced
  motion, fără GPU) nu se creează niciun driver: niciun atribut, niciun stil inline, niciun three.js.
- **Modurile** (`SceneHelixMode`, raportate prin `onHelix`, scrise ca `data-helix` pe
  `[data-scene-stage]`):
  - `spiral` — elicoidul construit, cel puțin `HELIX_MIN_CARDS` (3) carduri și
    `WORK_HELIX_MEDIA` = `(min-width: 768px) and (min-height: 600px)`;
  - `ambient` — elicoidul construit, altfel (telefoane, fereastră scundă, mai puțin de 3 carduri);
    grila sau banda rămâne neatinsă;
  - `off` — înainte de construcție, fără scenă sau după o eroare. `built` și `off` scot atributul.
- **Spirala** (driver-ul `createWorkHelixDriver`, fără React și fără three.js; `SceneWorld` îl
  creează pe toată viața scenei, lumea îl apelează în fiecare cadru și îl distruge odată cu ea):
  - La intrare, track-ul devine o singură celulă de grilă (`display: grid`,
    `grid-template-columns: 100%`, un rând de `sceneH + (n − 1) · pas`), cu pasul
    `clamp(240, 0.38·vh, 380)`.
  - Fiecare card devine `position: sticky` în acea celulă: `grid-row/column-start: 1` (anulează și
    `col-span-2` al ultimului card impar), `align-self: start`, `justify-self: center`, `top` centrat
    sub header, lățime `clamp(240, 0.27·w, 340)`, `min-height: min(0.36·sceneH, 260)` (niciodată
    `height`, vezi *Fixed*), `margin: 0`.
  - `transition-property: translate, box-shadow, border-color` inline: tranziția de 300ms pe
    `transform` din `Work.tsx` ar fi făcut cardurile să rămână în urma elicoidului.
  - **Pe cadru**, doar când focusul s-a mișcat (≥ 1e-4): `transform: translate3d(x, y, 0) scale(s)`,
    `z-index`, `opacity`, `pointer-events`, din `helixLayout(i, focus, w, sceneH)`. Cardul `i` stă la
    `d = i − focus` pași: `d · HELIX_ANGLE` (2π/9, același pas cu care se rotește modelul) în jurul
    firului și `0.18 · sceneH · d` pe verticală. Orbita e `min(0.17·w, 230)`, iar x e limitat la
    `helixEdge(w)` = 16px, plus 44px de la 861px (culoarul șinei din Faza 5).
  - **Ordinea de pictare**: un card cu fața spre vizitator (`cos θ ≥ 0`) primește `z-index` 1…11 și
    `pointer-events: auto`. Unul din spatele firului primește −1…−9 și `pointer-events: none`: se
    pictează în stratul negativ al stage-ului (`isolate`), **sub** canvas. `data-helix-front` e pe
    cardul de la focusul rotunjit.
  - **Focusul** e progresul scroll-ului pe intervalul propriu al driver-ului (vârful track-ului sub
    header → baza lui la baza viewport-ului), `× (n − 1)`. Lumea cere focusul, rotește elicoidul la
    el, apoi driver-ul așază cardurile pentru același focus, în același cadru.
- **Comutare sigură**:
  - **În spirală doar cât Work e sub viewport.** Track-ul crește cu mii de px, iar sub vizitator
    asta nu mută nimic din ce vede. Decide dreptunghiul secțiunii, citit în cadrul care ar așeza
    cardurile; IntersectionObserver-ul poate doar să oprească.
  - Un reload sau un deep link în Work păstrează grila până când vizitatorul e din nou deasupra.
  - **Ieșirea e imediată** (media nu mai corespunde, mai puține carduri, elicoidul dispare, dispose,
    eroare), cu scroll-ul pus la loc: în spirală, la poziția din grilă a cardului focusat
    (`top − headerH − 24`, instant); după capătul ei, tot ce urmează track-ului rămâne pe loc.
- **Contractul de restaurare**: tot ce scrie driver-ul e inline și listat (`CARD_PROPS`,
  `TRACK_PROPS`). Atributul `style` original al fiecărui card și al track-ului revine **byte cu
  byte** (`--p1` / `--p2` exact cum le-a scris React). Dacă altcineva a schimbat stilul între timp
  (un tilt în curs, culori noi din admin), se scot doar proprietățile driver-ului. Re-render-urile
  React (schimbarea limbii) compară doar cheile de stil ale React-ului, deci layout-ul rămâne.
- **Tastatura**: Tab trece prin carduri în ordinea normală. Cardul focusat derulează în față (cu
  `scroll-behavior`-ul paginii) și e complet opac. Un focus venit dintr-un click (sub 800ms) nu
  derulează nimic. Ordinea tab-urilor, `inert` și `aria-hidden` nu sunt atinse niciodată.
- **`MutationObserver`** pe `childList`-ul track-ului: o listă re-keyed (`/api/content` care înlocuiește
  seed-ul) e recolectată și reașezată; sub 3 carduri, modul trece în `ambient`.
- **Erori**: orice excepție din driver restaurează tot și îl lasă `off` definitiv. O excepție în
  cadrul elicoidului (`failHelix` în `world.ts`, care nu ajunge la error boundary-ul stage-ului)
  eliberează driver-ul (cardurile revin), ascunde elicoidul și loghează o singură dată; restul
  scenei desenează mai departe.
- **Poarta Work** (`fx.work`, `WORK_SECONDS = { form: 1.2, unform: 0.5 }`): a doua poartă temporizată,
  pe banda `workSpan` a directorului (track-ul, „top 70%” → „top 55%”).
  - Se deschide doar spre un elicoid care poate fi desenat: `stepSceneFx(…, entrySpan, workSpan)`
    primește banda doar cu elicoidul construit, driver-ul în alt mod decât `off` și track-ul măsurat.
    Altfel rămâne închisă, iar una deschisă se închide în timp.
  - `composeScene(entry, work, m, out)`: cu `work > 0` roiul modelului selectat zboară din slotul lui
    în `HELIX_SLOT` (0); modelul se dizolvă pe primele 30%, elicoidul se formează pe ultimele 30%.
  - Cât poarta Work e armată, poarta de intrare stă pe valoarea armată (nicio explozie ascunsă în
    spatele elicoidului). O poartă de intrare dezarmată deasupra serviciilor închide brusc poarta Work.
  - Primul cadru le fixează pe amândouă: un deep link în Work găsește elicoidul format.
- **`SCENE_LAYOUT_EVENT`** (`tbs:scene-layout`, un `Event` simplu pe rădăcina stage-ului): la o
  schimbare de mod track-ul își schimbă înălțimea imediat. Directorul recitește atunci toate cutiile
  în probă, fără refresh ScrollTrigger (un refresh ar opri un fling pe touch); refresh-ul de resize
  al stage-ului urmează pentru benzi. Niciodată sub un cover.
- **Proba de scroll** are câmpuri noi: `layerH`, `work`, `workHead` (blocul titlului, fără offset-ul
  de reveal, `translateYOf`), `workGap` (banda liberă de deasupra titlului, vezi *Changed*),
  `workSpan`, `helix` (track-ul „top top” minus header → „bottom bottom”).
  **Directorul are 4 trigger-e** de măsurare (`heroExit`, `entry`, `workSpan`, `helix`).
- **Plasare** (`choreography.ts`):
  - spirală, `placeHelixSpiral`: axa la `HELIX_LAYOUT.cx` (0.34) din lățimea track-ului, aceeași axă
    pe care orbitează cardurile, centrat pe zona sticky (`helixZoneTop`), înalt de
    `HELIX_ZONE_FILL` (0.9) din zonă, urmărire rigidă;
  - ambient, `placeHelixAmbient`: culcat (`HELIX_AMBIENT_ROLL`), centrat pe `probe.workGap`,
    `HELIX_AMBIENT.length` (0.6) din lățime, cel mult `HELIX_AMBIENT.maxPx` (120px) sau banda minus
    `HELIX_AMBIENT.clear` (10px) sus și jos, la luminozitate plină (vezi *Changed*).
- **Recolorare**: elicoidul și holograma iau `--p2` al cardului din față (în spirală cardul focusat,
  în ambient cardul cel mai apropiat de mijlocul benzii, `nearestCard`), în 0.4s.
- **Măsurat** (laboratoarele P3-B și P3-C, noble, SwiftShader):
  - `webgl` → `data-helix="spiral"` în 260–630ms;
  - hit test-uri la start, mijloc și capăt: cardul din față ia click-ul, **0 din 32** de puncte pe
    cardurile din spate nu sunt „furate”;
  - fără scroll lateral la 768, 861, 1024, 1280 și 1920; offset-ul sticky ≤ 0.05px;
  - Tab → card în față în 30–400ms (W15);
  - reload în Work: grila păstrată 8s (înălțime 1.031,69px), apoi spirala la 3.432,69px după urcarea
    sus;
  - 0 încălcări CSP, 0 erori de pagină.

**Added** — modelul elicoidului (`components/scene/three/models/helix.ts`, `shapes.ts`,
`three/samples.ts`, `three/materials.ts`, `tiers.ts`, `three/swarm.ts`)

- **Geometria** în `shapes.ts`: `HELIX = { radius: 0.9, height: 5.4, turns: 2.5 }` și
  `HELIX_ANGLE = 2π/9`, comun modelului și layout-ului.
- **Cinci draw-uri pe programele existente**, fiecare compilat în felia lui:
  - firele (P5 links, `aTag` 0 pe A cu pachete care urcă, 1.5 pe B cu pachete care coboară, „hot”);
  - cipurile de pe fire (P3 instanțiat; cele din față se aprind);
  - treptele (P4 synapse, cu o cometă care urcă treaptă cu treaptă);
  - biții 0/1 în șapte segmente (P4, **`LINE_MODE.bits` = 4**, glife billboard);
  - holograma (P2, **`SURFACE_MODE.holo` = 4**; 3 a fost învelișul sticlei), doar în spirală.
- Fără rotire proprie: firele se rotesc cu `−focus · HELIX_ANGLE`. Lite ascunde biții și glitch-ul.
- **`HelixFrame.dim`** (0..1, implicit 1): înmulțește `uIntensity` pe toate cele 5 draw-uri, în ambele
  teme (`helixDim`: lipsă sau non-finit → 1, limitat la 0..1). Holograma pornește de la 1 (glow) /
  0.85 (ink). Uniformele se rescriu doar la schimbare.
- **Construit după ready** (`stageHelix`): o felie idle de construcție, o felie de compilare pe obiect,
  un cadru de pre-warm, apoi `onHelix("built")`. Nu întârzie niciodată prima imagine.
- **Slotul 0 al roiului** e acum silueta elicoidului (`helixSamples`): 50% fire, 25% cipuri, 19%
  trepte, 6% noduri, păstrat în orice jumătate a buffer-ului (prefixul lite).
- **Tier-uri**:

  | | `helixTube` | `helixChips` | `helixRungs` | `helixBits` | `hologram` |
  |---|---|---|---|---|---|
  | high | [160, 4] | 80 | 22 | 36 | [384, 240] |
  | mid | [100, 3] | 52 | 14 | 20 | [256, 160] |

- **Draw-uri** (laboratorul P3-A, 12 cazuri, 0 erori): high 5 (436 de segmente, 3.522 de triunghiuri),
  mid 5, ambient 4, lite 4; niciun sprite de puncte.
- **Modulul**: ≈ +6,5 KB (elicoid 2.939, hologramă 2.342, materiale 654, mostre 402, tier-uri 72,
  forme 49) față de ≈ +4,4 estimat.

**Added** — holograma (`components/scene/three/hologram.ts`) — vezi
[11](./docs/11-security.md#the-work-hologram-canvas2d-2026-09-17)

- Un singur `CanvasTexture` Canvas2D, compus din DOM-ul cardului din față, fără mipmap-uri:
  - captura (doar imaginea same-origin a cardului, decodată în 1.5s) ca luminanță peste negru;
  - scanlines la 3px;
  - chip-urile tag-ului (fără „·”), numele (900, majuscule în limba paginii), indexul în contur;
  - colțuri de paranteză drepte (fără arce, fără puncte).
- Recompusă într-o felie idle doar când cardul din față se schimbă, cu histerezis:
  `|focus − index| > 0.5 + HOLOGRAM_HYSTERESIS` (0.3). Un glitch de 0.35s la fiecare schimbare. O
  schimbare de `<html lang>` o recompune.
- **Confidențialitate**: banda capturii e desenată în **celule de 2px**, apoi mărită. Cu celule de
  1px, e-mailul din formularul de înregistrare FLIRT (`public/projects/flirt-1.png`) era parțial
  lizibil la zoom 3×; cu 2px nu e, nici la 384×240, nici la 256×160 (P3-A). **Verificat pe pagina
  reală** (P3-D): WebGL forțat, 1280×800, FLIRT în față, captură nativă și mărită 3×, ambele teme:
  câmpul de e-mail e o bandă luminoasă fără caractere lizibile.
- `getContext("2d", { willReadFrequently: true })`: o singură citire de 1×1 pixel pe compunere (sonda
  de taint). Avertismentele „GPU stall due to ReadPixels” au dispărut.

**Added** — E2E (`e2e/interior-webgl.spec.ts`, `e2e/interior.spec.ts`, `e2e/helpers.ts`) — vezi
[`e2e/README.md`](./e2e/README.md)

- **W15** (1280×800): `data-helix="spiral"` și secțiunea crește; fiecare card își păstrează culorile
  inline; fără scroll lateral și `<html>`/`<body>` neatinse la start, mijloc și capăt; la mijloc
  cardul din față ia click-ul (sticky, `z-index` pozitiv), cardurile din spate au
  `pointer-events: none` și nu primesc niciun hit; Tab prin fiecare proiect-link îl aduce în față în
  cel mult 3s; o fereastră îngustată la 700px iese din spirală cu fiecare `style` înapoi byte cu byte;
  înapoi la 1280 și deasupra lui Work, spirala revine; o navigare client la o pagină de serviciu și
  înapoi dă carduri noi doar cu cele două culori, iar spirala le reașază; 0 CSP, 0 erori.
- **W15t** (768×1024, touch): spirala pe tabletă, cardul din față ia tap-ul, cele din spate niciunul,
  fără scroll lateral.
- **W18** (390×844, touch): `data-helix="ambient"`, `#lucrari` nu se mișcă, niciun card nu primește
  layout inline, un swipe CDP pe bandă mută `data-helix-front`, iar un prim tap pe altă pastilă nu
  mută nimic dedesubt.
- **W19** (1280×800): un reload derulat în `#lucrari` păstrează grila (înălțimea și scroll-ul
  neschimbate 8s după `webgl`, niciun `spiral`); sus, spirala se aplică și proba corespunde DOM-ului.
- **E1** (calea implicită): `#lucrari` e în `[data-scene-stage]`, un singur `data-work-track`, fiecare
  card cu `style.length === 2`, fără `data-helix-front` și fără `data-helix`.

**Changed** — elicoidul ambient: din spatele titlului în banda de deasupra lui (decizia lead-ului,
R9.4 amendat) (`components/scene/choreography.ts`, `scrollProbe.ts`, `lib/scene.ts`, `three/world.ts`)
— vezi [03](./docs/03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17),
[04](./docs/04-design-system.md#works-ambient-helix-and-its-band-it-os-phase-3) și
[05](./docs/05-page-sections.md#work)

Măsurat ca la cip (P1-D):
- textul ascuns, WebGL forțat, **12 cadre** pe caz, fiecare pixel sub casetele de rând ale textului:
  ≥4.5:1, iar h2 (text mare) ≥3:1;
- plus un cadru cu canvas-ul ascuns („fără canvas”), ca să se vadă ce vine din pagină;
- ambele teme.

În light, eyebrow-ul și lead-ul lui Work au deja pixeli sub 4.5:1 pe liniile de 1px ale grilei HUD
(eyebrow 92.99–99.92%, lead 99.94–99.98%, minim 4.07–4.49, după poziția de scroll). Sunt identici pe
ilustrația statică a HEAD-ului `aeea067`, deci existau dinainte. Acolo criteriul e „niciun pixel nou
care pică”.

**1. În spatele titlului (plasarea din R9.4) elicoidul nu putea rămâne vizibil.** P3-D l-a calibrat
întâi acolo, la 320, 375, 390, 412, 640, 641, 700 și 767px:

Contrast în spatele titlului (cel mai mic raport; % = pixeli care trec, doar sub 100%):

| Caz | dim 1 (P3-C) | planul 0.55 / 0.4 | calibrat 0.07 / 0 |
|---|---|---|---|
| dark 320 | h2 98.77% (1.0) · lead 99.56% (1.0) | h2 99.54% (1.01) · lead 99.67% (1.26) | h2 7.78 · lead 6.88 |
| dark 390 | h2 98.93% (1.01) · lead 98.92% (1.04) | h2 99.64% (1.03) · lead 99.19% (1.13) | h2 8.22 · lead 6.70 |
| dark 412 | h2 98.68% (1.0) · lead 98.78% (1.02) | h2 99.58% (1.01) · lead 99.10% (1.01) | h2 7.99 · lead 5.59 |
| dark 640 | h2 98.75% (1.0) · lead 98.18% (1.0) | h2 99.45% (1.0) · lead 98.47% (1.0) | h2 8.27 · lead **4.60** |
| dark 700 | h2 98.50% (1.01) · lead 97.01% (1.0) | h2 99.23% (1.06) · lead 98.03% (1.01) | h2 7.50 · lead 5.42 |
| light 320 | h2 99.99% (2.89) · lead 98.99% (1.54) | lead 99.20% (2.49) | = fără canvas |
| light 390 | h2 99.99% (2.99) · lead 97.53% (1.54) | lead 97.95% (2.15) | = fără canvas |
| light 640 | lead 94.94% (1.08) | lead 95.46% (1.72) | = fără canvas |
| light 700 | h2 99.99% (2.74) · lead 90.57% (1.06) | lead 93.12% (2.23) | = fără canvas |

Cu 0.07 / 0, pe build-ul de atunci, tot textul din titlu era 100% la toate cele 8 lățimi, în ambele
teme (dark: eyebrow ≥5.42, h2 ≥7.50, lead ≥4.60; light: identic cu pagina fără canvas).

- **De ce atât de jos.** Cei mai răi pixeli sunt muchiile cipurilor din față, care se aprind
  (`gain` 1.8 plus amestecul „hot”), și cometele pachetelor (până la 2.1 × dim).
  - Se saturează spre alb: la 0.4, pe 390 dark, pixelul cel mai rău era (236, 255, 255) sub h2.
  - **Dark** pe telefoane: 0.4 lasă h2 la 1.0–1.04, 0.25 la 1.63–1.93, iar 0.15 pică la 320, 390 și
    412 (h2 1.6, lead 3.62 / 3.24). Mai sus, 0.1 pică la 640 și 700 (lead 3.81 / 4.12), iar 0.08 la
    640 (4.15). 0.07 trece peste tot.
  - **Light**: griul lead-ului nu are rezervă. 0.01 a coborât deja un pixel la 4.22 (la 641, față
    de 4.24 fără canvas); 0.02 adaugă pixeli care pică la 412, 640, 700 și 767.
  - Ascunderea cipurilor (încercată în laborator) ar fi permis abia 0.15 în dark: cometele rămân.
- **Vizibilitatea** (schimbarea medie de luminanță pe blocul titlului, ×1000):
  - dark: 4.7–8.7 la dim 1 → **0.12–0.25** la 0.07, o urmă slabă;
  - light: 15–33 → **0**.
- **Concluzia**: în spatele copiei elicoidul nu poate rămâne vizibil în niciuna din teme. Lead-ul a
  ales plasarea măsurată ca alternativă.

**2. Decizia: elicoidul stă în banda goală de deasupra titlului, la luminozitate plină.**
- **Proba are câmpul `workGap`** (după modelul `workHead`, în `writeAnchors`): lățimea secțiunii Work,
  de la sfârșitul conținutului secțiunii anterioare (baza ei minus `padding-bottom` calculat) până
  la vârful titlului, fără offset-ul de reveal. Pe telefoane: `pb` 36px al Directions plus `pt` 48px
  al Work, ~84px. Fără Work, null.
- **`placeHelixAmbient`** centrează elicoidul pe bandă: 0.6 din lățime, cel mult 120px și cel mult
  banda minus `HELIX_AMBIENT.clear` (10px) sus și jos. O bandă prea subțire dă scale 0.
- **`HELIX_REACH` 1.0 → 1.26**: biții 0/1 se depărtează de axă până la 1.2, plus jumătate din
  diagonala glifei, deci mai departe decât firele și cipurile. `scene-helix-model` verifică fiecare
  parte față de el.
- **`HELIX_BEHIND_COPY_DIM` și `helixBehindCopyDim` sunt scoase**, cu testele lor (vezi *Removed*):
  ambele moduri desenează la 1, iar `world.ts` nu mai pasează `dim` și nu mai sare draw-ul.

**Poarta pe build-ul final** (320×568, 375×812, 390×844, 412×915, 640×900, 700×900, 767×1024, ambele
teme, 12 cadre):

| Țintă | Dark (minim) | Light (minim) |
|---|---|---|
| eyebrow | 100% (≥5.40) | = fără canvas (pixelii grilei de dinainte) |
| h2 | 100% (≥14.22) | 100% (≥13.55) |
| lead | 100% (≥7.92) | = fără canvas |
| „Deschide serviciul” (panoul Directions) | 100% (≥15.32) | 100% (≥16.95) |

- **Geometria**, din pixelii pe care canvas-ul îi schimbă (≥3% luminanță), sub header:
  - **0 pixeli** peste panoul Directions, la sau sub vârful eyebrow-ului și peste banda de carduri, la
    toate cele 7 lățimi, în ambele teme;
  - elicoidul are 57–67px înălțime, cu 9–16px liberi sub panou și 9–11px deasupra eyebrow-ului.
- **La 320×568**, cât elicoidul e format, link-ul e sub header. Banda însăși e sub header în
  momentul în care poarta Work se armează (track-ul la 55%) și intră în vedere la un mic scroll
  înapoi: poarta ține până la 70%.
- Capturi: `SCRATCH/itos/p3/d/shots/ambient-gap/` (390 dark și light, 700 dark). Laboratorul:
  `lab/calib-work.mjs` (`CASES=gap`), rezultate în `lab/res/gap*.json`.

**3. Spirala: neschimbată (luminozitate 1).**
- La 1280×800 și 1024×768, cu track-ul la 50% și 30% din viewport, canvas-ul nu schimbă niciun pixel
  din titlu (energia 0). Pixelii light sub 4.5 sunt cei de dinainte.
- Textul cardului din față (numele și chip-urile) e **100%** la 8 poziții de focus, la 1280, 1024 și
  768, în ambele teme: numele ≥3.14 în mijlocul unei rotiri (text mare), chip-urile ≥9.1.
- Pixelii care pică pe cardurile laterale sunt cei acoperiți de cardul din față, identici fără canvas.
- Doar un card lateral care se stinge (opacitate ~0.5–0.9) lasă elicoidul să treacă: numele lui
  99.96% (2.52; fără canvas 4.65) la 1024 dark și 98.29% (1.84; fără canvas 4.64) la 768 dark.

**Changed** — ultimul card impar în spirală (`components/sections/Work.tsx`)

- La 768–900px, ultimul card impar (FLIRT) își păstra în spirală mutarea capturii pe jumătatea
  dreaptă (`left-1/2 edge-fade-x`), deși acolo e un card normal. Varianta arbitrară are acum
  `&:not([data-scene-stage][data-helix=spiral] *)`:
  `.…:not([data-scene-stage][data-helix=spiral] *)>:nth-child(odd):last-child [data-parallax=work-media]`.
- Calea implicită, grila și banda sunt neschimbate: la 861px pe fallback, captura are tot 395px pe o
  carte de 792px, cu aceeași mască, în ambele teme (capturi înainte / după).

**Changed** — aserțiuni de test schimbate deliberat (niciuna slăbită)

`scroll-guard.test.ts` (30 → 34):
- Testul de montare al directorului: exact **4** trigger-e de măsurare (erau 2), inclusiv track-ul
  „top 70%” → „top 55%” și „top top” → „bottom bottom”, toate fără animație; `ScrollTrigger.getAll()`
  2 → 4 fără paralaxă și 4 → 6 cu cele două straturi ale hero-ului.
- Fixture-ul paginii adaugă `<section id="lucrari"><div><div data-reveal></div><div data-work-track>`;
  testul „fără ancore” verifică și `work` / `workHead` null; testul de cover copiază și benzile Work.
- Noi: benzile Work (`writeWorkSpan`, `writeHelixSpan`), `translateYOf`, `writeAnchors` pentru
  track, titlu și `layerH`, evenimentul de layout.

`scene-choreography.test.ts` (48 → 57):
- Toate apelurile `composeScene(e, m, out)` primesc `work`: `composeScene(e, 0, m, out)`.
- „Burst în 1.1s, implozie în 0.45s” verifică și 1.2s / 0.5s ale elicoidului.
- **Slotul 0**: „stă pe cip” devine „e elicoidul în repaus, din cipurile și treptele tier-ului”
  (potrivit cu raza și înălțimea `HELIX`); proporțiile prefixului devin 50% fire (în loc de 0.45 „în
  afara pinilor”). Testul pe `chipSamples` e șters odată cu funcția.
- Noi: zona sticky, plasarea în spirală și ambient, ramura `work`, proprietatea de continuitate la
  ambele capete, patru teste pentru poarta Work.
- **Plasarea ambient** (P3-D, schimbată deliberat odată cu decizia): „culcat în spatele titlului,
  centrat pe el, cel mult 120px” devine „culcat în banda de deasupra titlului (`workGap`), centrat
  pe ea, cel mult banda minus 10px sus și jos sau 120px”; `HELIX_AMBIENT` are `clear: 10`, iar
  `HELIX_REACH` e fixat la 1.26. Se adaugă cazurile benzii prea subțiri (scale 0) și fără `workGap`
  (null).

`lib/__tests__/scene.test.ts` (53, aceleași teste): forma probei are în plus `layerH`, `work`,
`workHead`, `workGap`, `workSpan`, `helix`, iar `SCENE_ATTR.helix === "data-helix"`.

`scene-helix.test.ts` (39 → 41): în testul „se aplică doar cu elicoidul construit…”, `style.height`
„260px” devine `min-height` „260px” și `height` gol (P3-D, schimbat deliberat: cardul nu mai are
înălțime fixă). Noi: un card cu conținut mai înalt își păstrează înălțimea, centrat, iar unul mai
înalt decât stratul începe sub header; un ResizeObserver recentrează cardul al cărui conținut s-a
schimbat și e deconectat la ieșire. Testele de restaurare byte cu byte sunt neschimbate.

Doar teste noi:
- `scene-shapes` (45 → 47);
- `scene-tiers` (14 → 15): cinci rânduri noi în tabelul de buget (high ≥ mid) și un test pentru
  valorile elicoidului și ale hologramei (16:10, cel mult 384px);
- `scene-build` (18 → 24);
- `scene-helix-model` (P3-A 28 → 29, P3-D: fiecare parte a modelului în `HELIX_REACH`);
- `scroll-guard` (34, aceleași teste): `workGap` în testul `writeAnchors` pentru Work (secțiunea
  anterioară cu `padding-bottom` 36px → bandă `{ x: 0, y: 2198, w: 1280, h: 104 }`, actualizată pe
  loc), null fără Work, prezent la montarea directorului;
- `scene-stage` (29 → 30, `data-helix`);
- `work.test.tsx` (14 → 15).

Fișiere noi: `scene-helix.test.ts` (41), `scene-helix-model.test.ts` (29), `scene-hologram.test.ts`
(15).

**E2E**:
- **W2** pauza: 300px sub **baza stage-ului** (era `#lucrari` + 300; stage-ul se termină acum după Work).
- **W5** așteaptă `data-helix` (`spiral` de la 768px, `ambient` sub) și are două repere noi: vârful
  `#lucrari` și mijlocul track-ului.
- `sceneProbeVsDom`: 5 citiri noi (`work.start/end`, `helix.start/end`, `work.y`); `helix.end` oglindește
  limitarea ScrollTrigger `max(track.top, bottom − vh)` (vezi *Fixed*).
- **W13** (P3-D): ultima verificare a probei, înapoi sus, e acum **așteptată** (`expect.poll`, 5s),
  ca celelalte două din test; înainte era o citire imediată. Motivul e la *Fixed*. Aserțiunea
  (nicio nepotrivire peste 2px) e aceeași.
- W15, W15t, W18, W19 sunt noi; E1 are verificările de mai sus.

**Removed**

- `chipSamples` și testul lui: slotul 0 e elicoidul. Comentariile vechi („până ia elicoidul slotul”,
  `aS0` = silueta cipului) sunt actualizate în `swarm.ts`, `choreography.ts` și docs/03.
- `HELIX_BEHIND_COPY_DIM`, `helixBehindCopyDim`, pasarea `dim` din `world.ts`, draw-ul sărit la 0 și
  cele două teste ale lor (`scene-choreography`, `scene-build`). Toate fuseseră adăugate de P3-D în
  aceeași fază, pentru calibrarea din spatele titlului, și n-au fost comise. Nimic nu le mai
  folosește. `HelixFrame.dim` (API-ul modelului, P3-A) rămâne, cu implicit 1.

**Fixed**

- **Cardurile din spirală tăiau descrierile lungi** (P3-D, cerut de lead; `components/scene/workHelix.ts`,
  `components/sections/Work.tsx`):
  - Cauza 1, driver-ul: scria `height` = `min(0.36·sceneH, 260px)`, iar cardul are
    `overflow: hidden`. Pe o tabletă touch (`hover: none`) descrierea e mereu afișată.
  - Acum driver-ul scrie `min-height`, niciodată `height`. `top` centrează cutia măsurată
    (`offsetHeight`) sub header; un card mai înalt decât stratul începe chiar sub header. Un
    ResizeObserver pe carduri le recentrează când conținutul se schimbă (limba, hover).
    `CARD_PROPS` listează `min-height` în loc de `height`.
  - Cauza 2, `Work.tsx`: descrierea are `max-h-35` (140px, tranziția reveal-ului), iar la 240px
    lățime IQ Arena (~9 rânduri) trecea de el. În spirală plafonul e ridicat, doar unde descrierea e
    afișată (hover, focus, `hover: none`):
    `[data-scene-stage][data-helix=spiral] …:max-h-none`, cu specificitate peste stările pe care le
    înlocuiește.
  - **Verificat** pe build-ul final, cu WebGL forțat. Fiecare din cele 9 carduri e adus în față, în
    ambele teme; la 1024 și 1280 și cu hover pe cardul din față:
    - **90 / 90** verificări: niciun rând de text sub marginea cardului, descrierea în cutia
      cardului, cardul din față în viewport (sub header, deasupra bazei), niciun `height` scris;
    - înainte, IQ Arena avea ultimele rânduri tăiate cu 56px la 768 și 34px la 1024 cu hover;
    - înălțimile la 768×1024: 260, 280, 298, 279, 260, **360**, 283, 298, 273px.

- **`below` învechit după un salt instant** (P3-B, găsit de P3-C în `jump-lab`): un reload sub Work,
  apoi un salt instant sus (logo) nu mai aplica spirala până când Work nu intra în viewport, pentru
  că IntersectionObserver-ul nu raportează un salt peste Work. `isSafe()` citește acum dreptunghiul
  secțiunii în cadrul care ar așeza cardurile, iar observer-ul doar oprește. Spirala se aplică la
  ~500ms după salt (era „off” și după 20s). Două teste noi în `scene-helix`.
- **Chrome și `removeAttribute("style")`** (P3-B): Blink serializează leneș un stil scris prin CSSOM;
  scos cât serializarea era în așteptare, atributul revenea ca `style=""`. Restaurarea citește acum
  atributul înainte să-l scoată.
- **W13 pe telefon** (P3-C): `helix.end` din probă (2383) nu corespundea DOM-ului (1832). Banda de pe
  telefon e mai scurtă decât viewport-ul, iar ScrollTrigger limitează capătul la început. Helper-ul
  oglindește acum aceeași limitare.
- **W15, round trip-ul de stil după o navigare client** (P3-C): la întoarcere App Router randează
  cardurile pe client, iar React scrie culorile prin CSSOM (`--p1: #192f6f; --p2: #4b7dff;`), nu ca
  șirul din HTML-ul serverului. Testul compară acum proprietățile (`style.length === 2`, `--p1`,
  `--p2`, niciun layout), iar comparația byte cu byte rămâne pe ieșirea din spirală fără navigare.
- **Holograma**: avertismentele „GPU stall due to ReadPixels” / `willReadFrequently` (P3-A).
- **W13 desktop instabil** (P3-D, 1 din 4 în gate):
  - Eroarea: `helix.end: probe 1940, DOM 4301`.
  - Cauza e o cursă în test, nu în scenă. Elicoidul poate termina de construit după ce testul a
    derulat la Y=3000, adică în Work, unde spirala nu se aplică. Revenit sus, Work e sub viewport,
    spirala se aplică pe loc și track-ul crește.
  - Cutiile probei urmează imediat (`SCENE_LAYOUT_EVENT`). Benzile vin cu refresh-ul de resize al
    stage-ului (debounce 200ms, după terminarea scroll-ului), iar testul le citea fără să aștepte.
  - Scena nu folosește `probe.helix`: driver-ul își măsoară singur intervalul, iar `workSpan` nu se
    mișcă, pentru că vârful track-ului rămâne pe loc.
  - Verificarea e acum așteptată; W13 ×4 a trecut după reparație.

**Docs**

- [03](./docs/03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17):
  - secțiunea nouă „The project DNA helix”: moduri, media, comutarea sigură, spirala sticky și
    ordinea de pictare, restaurarea, focusul, `MutationObserver`, erorile, poarta Work, plasarea,
    modelul, holograma, recolorarea, `SCENE_LAYOUT_EVENT`;
  - arborele (`helix.ts`, `workHelix.ts`, `three/models/helix.ts`, `three/hologram.ts`, exporturile
    noi), DOM-ul stage-ului cu Work, `data-helix` / `data-helix-front`, câmpurile probei, cele 4
    trigger-e, „Who owns what” (chunk-ul scenei scrie layout-ul inline al cardurilor în spirală);
  - înregistrarea: R1 „Work nu primește model 3D” e înlocuită de deciziile 10 și 12;
  - mențiunile `chipSamples` scoase; semnăturile `stepSceneFx` / `composeScene` actualizate.
- [04](./docs/04-design-system.md#works-ambient-helix-and-its-band-it-os-phase-3): elicoidul ambient
  și banda lui — de ce nu în spatele titlului, contrastul în bandă, spirala.
- [05](./docs/05-page-sections.md#work): elicoidul în scenă; Work în stage — spirala de la 768×600,
  cardul cât conținutul lui, ambient în banda de deasupra titlului, grila sau banda pe calea implicită,
  holograma, tastatura, reload-ul în Work.
- [07](./docs/07-conventions.md#gsap-and-scrolltrigger): cele 4 trigger-e, cele două porți, regula
  porții Work, evenimentul de layout; contractul driver-ului (doar cu Work sub viewport, restaurarea,
  cine deține cardurile, cardul niciodată plafonat sub conținut, plafonul descrierii ridicat în
  spirală); decorul nu stă în spatele copiei (o bandă măsurată, nu un dim); modurile `holo` / `bits`.
- [11](./docs/11-security.md#the-work-hologram-canvas2d-2026-09-17): holograma Canvas2D — doar
  imaginea same-origin, sonda de taint, celule de 2px, text din `textContent` prin `fillText`, fără
  loadere / fetch / blob, CSP neschimbat.
- [14](./docs/14-testing.md): numărătorile pe fișier, fișierele noi, W15 / W15t / W18 / W19 / E1, W2 / W5.
- [`e2e/README.md`](./e2e/README.md): W15, W15t, W18, W19, E1, W2, W5, `sceneProbeVsDom`.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, arborele final) | exit 0 · 0 · 0 (snapshot exportat din indexul comis) |
| `npm test` (node:22-alpine), rulat de 2 ori | **1.309 passed / 0 failed** în 68 de fișiere, de ambele dăți (înainte: 1.200 în 65) |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă) | **261 passed / 1 failed**: `preloader` „forced WebGL renders the canvas and completes at 100” (click-ul pe CTA-ul din header în timpul fade-ului nu a ajuns în 60s), rulat în paralel cu build-urile agentului Fazei 4; același test trece de 3 ori din 3 în rularea repetată de mai jos, iar Faza 3 nu atinge intro-ul |
| `preloader` + `hud-shell` + `interior` + `interior-webgl`, `--repeat-each=3` | **285 passed / 0 failed / 0 flaky** |
| E2E rulat de agenți (noble) | P3-C: `interior-webgl` 24 + `interior` 22 + `preloader` 24 + `hud-shell` 25 + `responsive` 66 = **161 passed**; W15 / W15t / W18 ×3 → 9 / 9, W19 12 / 12. P3-D: pe primul build final aceleași 5 spec-uri → 160 passed / 1 failed (W13 desktop, `helix.end`, vezi *Fixed*); `-g "W15\|W18\|W19\|W13\|W14" --repeat-each=3` → 21 / 21; după reparația W13: W13 `--repeat-each=4` → 8 / 8 și cele 5 spec-uri → 161 / 161. **După ambele decizii** (build nou): cele 5 spec-uri → **161 passed / 0 failed** (24 + 22 + 24 + 25 + 66), repetarea → **21 / 21** (W15, W15t, W18, W19, W13 ×2, W14, de câte 3 ori). W15 Tab → front: 37–400ms în toate rulările |
| Contrast R9.4 amendat (12 cadre, canvas forțat, text ascuns; P3-D, build-ul final) | elicoidul ambient în bandă, la luminozitate plină, 320–767px (7 lățimi), ambele teme: eyebrow, h2, lead și „Deschide serviciul” **100%** (light: titlul identic cu pagina fără canvas); **0 pixeli** schimbați peste panou, eyebrow sau carduri. Tabelele la *Changed* |
| Cardurile din spirală cât conținutul lor (P3-D, build-ul final) | 9 carduri aduse pe rând în față, ambele teme, la 768×1024 (touch), 1024×768 și 1280×800 (și cu hover): **90 / 90**, niciun rând tăiat, cardul din față în viewport, niciun `height` scris |
| Titlul Work la 1280 și 1024 peste zona spiralei | canvas-ul nu schimbă niciun pixel din titlu (energie 0) — identic cu ilustrația HEAD; în light, pixelii sub 4.5 sunt cei de dinainte (liniile grilei HUD) |
| TBT, WebGL forțat, tier mid, 390×844, CPU 4×, 3 rulări (mediane); după `webgl`, 1.5s, apoi salt la titlul Work (modul ambient se aplică, poarta Work predă elicoidului) și încă 8s; HEAD `aeea067` și arborele final construite și măsurate unul după altul, pe aceeași mașină liniștită (P3-D) | fără scenă 168 → 162ms (aceeași cale, zgomot) · cu scena 587 → **630ms** · adăugat 419 → **468ms** (+49) · task-urile scenei 443 → **476ms** · cel mai lung task al scenei 339 → **377ms** (maxim 343 → **395**, sub limita de 400, dar cu doar 5ms rezervă) · creșterea stă în cadrul „ready” (așteptarea GPU SwiftShader 323–342 → 325–362ms) · **construirea și compilarea elicoidului după ready nu produc niciun task ≥ 50ms** (`built` la ~3.43s, nimic lung după) · după saltul în Work: 0 task-uri lungi, înainte și după · JS-ul scenei singur (trace, task-urile deduplicate: trace-ul din Faza 1 număra fiecare `RunTask` de două ori, deci 266 / 276 de acolo înseamnă 133 / 138) 136 → **129ms** TBT doar JS, 226 → 221ms JS în task-urile lungi, cel mai lung task JS 186 → 179ms — plat, sub bugetul de 350ms |
| Confidențialitatea hologramei (FLIRT în față, 1280×800, tier high, nativ și 3×; P3-D) | e-mailul (`comf003114@gmail.com` în captura sursă) **nu e lizibil** în niciuna din teme: câmpul e o bandă luminoasă cu pete, fără caractere. Capturi: `SCRATCH/itos/p3/d/shots/holo-final/` |
| `__THREE__` într-un singur chunk | da (P3-C; P3-D pe build-ul final: `2cmn-bxww_8n_.js`, 271.060 B gzip) |
| Ultimul card impar, 861px, calea implicită (capturi înainte pe HEAD, după pe arborele final) | cardul identic pixel cu pixel în ambele teme (captura 395px din 792, `left: 395.06px`, aceeași mască); `#lucrari` diferă doar prin capturile lazy încă nedecodate ale altor carduri |

Greutate (gzip, bytes; același script și aceleași cazuri ca la Faza 2; baza e coloana *Faza 2* de acolo).
Măsurat de P3-D pe arborele final, după ambele decizii (`weight-cases.sh`, `BUILD=1`, noble, toate cele
11 cazuri, exit 0); măsurat de P3-D pe arborele final, după ambele decizii (bundle identic cu snapshot-ul comis: fișierele Fazei 4 din arbore nu erau importate de nimic):

| Buget | Caz | Bază (Faza 2) | Faza 3 | Diferență |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine | total 262.391 · referit din HTML 257.501 · JS târziu 3.936 | total **262.699** · referit din HTML 257.809 · JS târziu 3.936 | +308 (JS-ul paginii +202: `data-work-track`, `data-helix`, `SCENE_LAYOUT_EVENT`, `workGap` în forma probei și clasele din `Work.tsx`; CSS +106: selectorul ultimului card impar și plafonul descrierii ridicat în spirală) |
| B1s / B7 | B1 + scroll · pe mobil | JS târziu 3.936 | 3.936 | 0 |
| B2 | scenă forțată + scroll (desktop și mobil) | JS târziu 315.109 | **324.687** ✗ (limita B1s + 316.000 = 319.936; **peste cu 4.751**) | +9.578 (chunk-ul comun +9.091: elicoidul, holograma, driver-ul și layout-ul, poarta Work, integrarea; chunk-ul directorului +445: benzile Work și `workGap`) |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 324.177 (total 582.632) | **333.894** ✗ (limita 330.000; **peste cu 3.894**; total 592.657) | +9.717 |
| B3i | prima vizită, intro forțat | 305.128 | **314.400** | +9.272 — peste limita planului (300.000), ca în fazele anterioare: chunk-ul comun aduce și scena interiorului |
| B4 | prima vizită | JS târziu 35.775 | 35.777 ✓ (≤ 36.500) | +2 |
| B5 | `/servicii/e-commerce` | total 222.906 (limită 224.000) | **223.013** ✓ | +107 (CSS; 987 B rezervă) |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte | 3.219; 0 contexte ✓ | 0 |
| H | documentul HTML `/`, care revine | 21.579 | **21.651** ✓ (≤ 22.230) | +72 (atributul și clasele, o dată în markup și o dată în RSC) |
| — | chunk-ul comun three + R3F + scene | 261.969 | **271.060** | +9.091 |

**Re-baseline-uri cerute (explicit, cu motiv):**
- **B2** și **B3** depășesc limitele planului; **B3i** era deja peste și crește.
- Motivul: tot ce adaugă Faza 3 pentru scenă stă în chunk-ul comun three + R3F + scene, cerut doar după
  decizia WebGL (+9,1 KB gzip), plus +0,4 KB în chunk-ul directorului. Planul estima ≈ +6,2 KB și
  prevedea deja „B2 peste, B3 la limită”.
- Măsurate de P3-A: modelul elicoidului 2.939, holograma 2.342, materialele 654, mostrele 402,
  tier-urile 72, formele 49. Restul vine din driver și layout (P3-B) și din integrare (P3-C, P3-D).
- Noile baze propuse: **B2 ≤ B1s + 321.000**, **B3 ≤ 335.000**, **B3i 314.400** și chunk-ul comun
  **271.060**.
- Vizitatorii fără WebGL (B1, B1s, B4, B5, B6, H) plătesc doar +2…+308 B.
- HUD-ul se încarcă după prima interacțiune, deci rândurile ne-armate nu îl arată (vezi B1h / B5h /
  B6h din Faza 4).

> **Rămâne deschis:**
> - **Pe un telefon foarte scund (568px)** banda de deasupra titlului e sub header în momentul în care
>   poarta Work se armează (track-ul la 55%). Elicoidul se vede abia după un mic scroll înapoi (poarta
>   ține până la 70%); cât e format, link-ul „Deschide serviciul” e tot sub header.
> - **Cardurile laterale care se sting depășesc marginea viewport-ului cu câțiva pixeli.** Cele de la
>   două poziții de focus distanță (opacitate 0.53) ies cu cel mult 9px la 768×1024 (sub header sau
>   dincolo de bază), cu 2px la 1024×768 și cu 0 la 1280×800. Cauza: cardurile sunt acum cât
>   conținutul lor (IQ Arena are 360px).
>   - Cardul din față și vecinii lui imediați rămân în viewport.
>   - O limită verticală în `helixLayout` ar schimba pozițiile fixate de P3-B.
> - **Un card cu hover pe desktop se recentrează** cât îi crește descrierea: ResizeObserver-ul îl mută
>   în sus cu jumătate din creștere, în 250ms. Pointerul rămâne în card.
> - **Ordinea de pictare și scroll anchoring pe WebKit nu sunt verificate.** Cardurile sticky cu
>   `z-index` negativ sub canvas și compensarea scroll-ului la ieșirea din spirală au fost văzute doar
>   în Chromium (SwiftShader).
> - **W15 are un buget de 3s pentru Tab → card în față**; măsurat 30–400ms. Sub un CPU foarte
>   încărcat (build-uri în paralel), testul poate deveni instabil.
> - **Bătaia scanline-urilor hologramei**: textura are scanlines la 3px, iar shader-ul adaugă 120 de
>   benzi pe înălțimea planului. La unele mărimi ale planului apare un moiré discret.
> - **Saltul inelului de puls** în Brand & UI există dinainte (ceasul modulo 3.2s).
> - **Cel mai lung task al scenei (395ms la maxim) are doar 5ms rezervă față de limita de 400ms**, pe
>   SwiftShader, headless. Creșterea stă în așteptarea GPU din cadrul „ready”, nu în JS. TBT-ul a fost
>   măsurat înainte de mutarea elicoidului în bandă și de regula înălțimii cardurilor. Niciuna nu
>   adaugă muncă la construcție sau la ready: o altă plasare și un ResizeObserver doar în spirală.
> - **Un card lateral care se stinge lasă elicoidul să treacă**: câțiva pixeli din numele lui coboară
>   la 1.84:1 (768 dark). Cardul din față nu e afectat.
> - **Pixelii light sub 4.5:1 din titlul Work** (eyebrow 92.99–99.92%, lead 99.94–99.98%, după poziția
>   de scroll) stau pe liniile de 1px ale grilei HUD și existau dinainte (identici pe HEAD). Faza 3 nu
>   îi schimbă.
> - **În arbore apar fișiere necomise care nu țin de Faza 3**: `components/hud/guide/`,
>   `lib/hud/linger.ts` și testele lor (`guide-assistant`, `guide-linger`), din Faza 4.
>   - P3-D le-a găsit în timpul gate-ului.
>   - Nu sunt importate de nimic din pagină, deci nu intră în build, în greutate sau în TBT.
>   - Numărătorile de mai sus le exclud; `npm test` pe arborele de lucru a dat 70 de fișiere /
>     1.424 de teste cu ele (ultima rulare).

---

## 2026-09-17 — Faza 2: intrarea serviciilor (explozie și asamblare), panoul care se aprinde, Brand & UI ca grilă

A treia fază a experienței IT aprobate. Până acum scroll-ul „trecea” cipul în modelul direcției
selectate: progresul roiului era chiar poziția paginii, deci un vizitator care se oprea să citească
lăsa modelul **pe jumătate format**. Brand & UI (o plasă de poligoane cu noduri) se citea acolo ca
**zgomot de particule**. Acum intrarea la Servicii e o **poartă temporizată**. Când ancora
serviciilor trece un prag, modelul selectat **explodează dintr-un punct și se asamblează în 1.1s**,
pe ceasul lui, oriunde s-ar opri pagina. Deasupra pragului **implodează în 0.45s**.

Scena spune unde a ajuns intrarea (`data-entry`), iar panoul Directions răspunde:
- cât explodează modelul, o bandă de lumină trece peste text;
- după ce s-a format, marginea panoului se aprinde în accentul direcției.

Brand & UI devine o grilă rară de rânduri și coloane, cu cruciulițe `+`.

Trei owneri, pe fișiere disjuncte:
- poarta și compoziția (P2-A);
- grila Brand & UI (P2-B);
- panoul (P2-C).

Documentația a făcut-o P2-D. Nu există niciun program WebGL nou și nimic nou în bundle-ul paginii.
Nu există copie nouă pentru vizitator: totul e canvas sau decor `aria-hidden`. CSP-ul e neschimbat
și nimic nu se scrie în storage.

**Added** — poarta de intrare a serviciilor (`components/scene/fx.ts`, `choreography.ts`,
`SceneDirector.tsx`, `scrollProbe.ts`, `SceneWorld.tsx`, `SceneCanvas.tsx`, `SceneStage.tsx`,
`three/world.ts`, `three/swarm.ts`, `lib/scene.ts`) — vezi
[03](./docs/03-architecture.md#the-services-entrance-it-os-phase-2-2026-09-17),
[05](./docs/05-page-sections.md#interior-stage-3d) și [07](./docs/07-conventions.md#gsap-and-scrolltrigger)

- **Banda** (decizia D-C): trigger-ul `entry` al directorului, pe ancora serviciilor.
  - Merge de la **„top 90%” la „top 75%”** (vechiul `handoff`: „top 95%” → „center 55%”).
  - E măsurat în `probe.entry` (`writeEntrySpan`), fără animație, ca `heroExit`.
  - Nu e un progres, doar pragul.
- **Poarta** (`fx.ts`, pură): `Gate = { value, armed }`, `createGate`,
  `ENTRY_SECONDS = { form: 1.1, unform: 0.45 }` și
  `stepGate(g, scrollY, span, step, rates, instant)`.
  - **Histerezis**: se armează când `scrollY` ajunge la capătul benzii și se dezarmează doar
    deasupra începutului ei. Între cele două își păstrează starea.
  - `value` merge **în timp, nu în scroll**: urcă de la 0 la 1 în 1.1s cât e armată și coboară
    în 0.45s. Pasul de cadru e limitat, deci sub SwiftShader (1/20s) explozia ține cel puțin
    22 de cadre.
- **`stepSceneFx(fx, dt, input, heroExit, scrollY, entrySpan)`**:
  - **Primul cadru fixează poarta direct.** Un deep link în servicii (reload, link) găsește
    modelul deja format, fără explozie.
  - Cât ancora nu e măsurată (`entrySpan` null), poarta rămâne închisă.
  - Aruncat înapoi la hero (`heroExit` brut 0), o poartă dezarmată sare la 0.
- **Compoziția**: `composeScene(entry, m, out)`.
  - **Sub 1, intrarea deține roiul**: `from = BURST` (−1, nu e un slot), `to = 1 + selectat`,
    `t = entry`. Modelul apare pe `smoothstep(.72, 1, entry)`, iar morph-ul între pastile e
    instant între timp.
  - **La 1, morph-ul deține roiul**, ca înainte.
  - Cele două capete se ating continuu: alfa roiului (`swarmAlpha`) ajunge la 0 exact când
    dezvăluirea modelului ajunge la 1. Asta e fixat de un test de proprietate.
  - Funcția e gândită ca Faza 3 să adauge `work` ca ramură nouă.
- **Explozia** (`world.ts`, `swarm.ts`, **niciun shader schimbat**):
  - Un plan `BURST` folosește slotul modelului selectat la ambele capete.
  - Matricea `from` strânge modelul într-un punct din centrul host-ului, după
    `BURST_SPECK = { scale: .05, radius: 1.35, sprite: .5 }`. Norul e cu 35% mai larg decât
    modelul, deci trece peste el și apoi converge; sprite-urile pornesc de la jumătate.
  - Shader-ul existent (plecare → nor → sosire) se vede ca o explozie din centru care se
    asamblează. Deasupra benzii, implozia e același drum invers.
- **`data-entry="idle|burst|formed"`** pe `[data-scene-stage]` (decizia D-G). Doar scena știe
  când modelul s-a format; directorul știe doar pragul.
  - `SceneWorld` raportează `entryState(fx.entry.value)` prin `onEntry` (`SceneCanvasProps`),
    doar la schimbare și doar după ready.
  - Primul raport e starea curentă, deci un deep link spune direct `formed`.
  - `SceneStage` scrie atributul direct în DOM, niciodată prin state React, și îl scoate odată cu
    scena. Numele e în `SCENE_ATTR.entry`.
  - Pe `fallback` și `off` atributul nu există.
- **Măsurat** (W16, noble, SwiftShader, 3 rulări):
  - `burst` apare la 6–37ms după scroll;
  - `formed` vine la 1.060–1.082ms după `burst`;
  - deasupra benzii, `idle` vine la 444–480ms după `burst`.

**Added** — panoul Directions răspunde intrării (`app/tailwind.css`,
`components/sections/Directions.tsx`) — vezi [04](./docs/04-design-system.md#directions--the-hud-screen)

- **`@utility entry-glow`**, pe panou:
  - bordură `color-mix(in srgb, var(--accent) 70%, transparent)`;
  - un inel de 1px la 35% și un glow de 32px la 18%;
  - toate listate **după `var(--sh-lg)`**, deci umbra de adâncime rămâne dedesubt.

  Când se aprinde:
  - sub `[data-entry="formed"]`;
  - **static** pe `[data-renderer="fallback"]` și `"off"` (R9.2);
  - **niciodată** sub `pending`, care poate încă deveni WebGL și ar stinge glow-ul din nou.

  Tranziția de 0.5s există doar sub `[data-renderer="webgl"]`, deci glow-ul static nu se animă.
- **`color-mix` stă doar într-un `@supports (color: color-mix(in lab, red, red))` explicit.**
  Fără el, Tailwind adaugă la fiecare regulă o copie de rezervă cu accentul plin, opac. Un motor
  fără `color-mix` păstrează panoul simplu.
- **`@utility entry-sweep`**, pe coloana de text:
  - Banda e `::after`. Coloana e deja `relative`, iar `::before` e linia de sus, deci pe coloană
    nu are voie niciun utilitar `after:`.
  - Banda e un gradient la 115° cu `var(--accent)` solid, cu `pointer-events: none` și
    opacitate 0 în repaus.
  - **`@keyframes hud-glass-sweep`** e top-level: 1.1s, doar `transform` și `opacity`
    (`translateX` −100% → 100%, opacitate .12 → 0).
  - Rulează o singură dată, sub `[data-entry="burst"]`, doar cu
    `prefers-reduced-motion: no-preference`.
  - Doar atunci coloana primește `overflow: clip`, care nu creează container de scroll: nimic
    din layout nu se mută.
- **Contrastul sub bandă**, măsurat pe pixeli, pe textul de sub centrul benzii, pentru cele cinci
  accente.
  - Intensitatea vine din opacitatea keyframe-ului, nu dintr-un amestec de culoare. Așa niciun
    motor nu poate pune o bandă opacă peste text.
  - La .12, cel mai slab text e tag-ul: **dark 5.11:1** (6.11 fără bandă) și **light 4.61:1**
    (5.36 fără bandă).
  - La .16 tag-ul light ar coborî la 4.38. De aceea banda nu folosește amestecul de 16% cu
    opacitate 1 din plan.
  - Glow-ul nu schimbă niciun pixel din zona textului.
- Nu atinge `[data-reveal]` și nici markerii intro-ului. Nu folosește filter, blur sau
  border-radius.
- **Greutate**: +218 B gzip de CSS (+1.017 raw). HTML-ul `/` crește cu +16 B la prima vizită și
  cu +18 B la revenire (cele două clase, o dată în markup și o dată în RSC).

**Added** — E2E W16 (`e2e/interior-webgl.spec.ts`, `e2e/helpers.ts`) — vezi [`e2e/README.md`](./e2e/README.md)

W16 rulează la 1280×800, cu WebGL forțat:
1. `data-entry` e `idle` în 10s, iar proba de scroll corespunde DOM-ului.
2. Scroll la capătul benzii: `idle` → `burst` → `formed` în cel mult 20s.
   - Tranzițiile sunt înregistrate cu un `MutationObserver`, iar timpii sunt atașați ca adnotări.
   - `formed` nu vine niciodată mai devreme de 1s după `burst`.
3. `box-shadow`-ul panoului `.entry-glow` diferă de cel din repaus și nu e `none`.
4. Deasupra începutului benzii: `burst` → `idle`.
5. Renderer-ul rămâne `webgl`, cu 0 erori de pagină.

**Changed** — Brand & UI: o grilă rară în locul plasei de poligoane
(`components/scene/three/models/meshWave.ts`, `three/samples.ts`, `three/materials.ts`, `tiers.ts`)
— vezi [05](./docs/05-page-sections.md#interior-stage-3d)

- **Geometria** (`waveGridLines`, `waveGridSegments`): un singur `LineSegments` P4
  (`LINE_MODE.wave`), cu `aPhase` 0 pe linii și 1 pe cruciulițe.
  - Rândurile au (sy+1)×subdiv segmente, iar coloanele (sx+1)×subdiv/2.
  - Pe fiecare a doua intersecție (coloană pară × rând par) stă un `+` cu brațul
    `MESH_WAVE.crossArm` = 0.045.
- **Tier-uri**:

  | | `wave` (celule) | `waveSubdiv` (nou) | Segmente |
  |---|---|---|---|
  | high | [44, 28] → **[16, 8]** | 32 | **650** (înainte 3.768, plus 345 de sprite-uri) |
  | mid | [30, 18] → **[10, 6]** | 24 | **348** |

- **Draw-uri cu Brand & UI format**: high **5 → 4**, mid **4 → 3**. Nodurile P6 nu mai există.
- **Fragment shader**: ramura wave adaugă `strength += vPhase * (0.35 + vRing * 0.8)`.
  Cruciulițele ies din grilă și se aprind când trece inelul de puls. Lite ascunde doar cardurile;
  grila rămâne.
- **Aterizare exactă** (`WaveClock`, `createWaveClock`, `resetWaveClock`, `stepWaveClock`,
  `WAVE_SETTLE_SECONDS` = .6):
  - Ceasul valului stă la 0 de la `resetCycle` până la prima dezvăluire completă. Cât aterizează
    roiul, grila e exact `wavePoint(x, y, 0, 0)`.
  - După formare ceasul pornește, iar raza inelului și atracția pointerului cresc din 0 în 0.6s.
  - **Abatere de la spec**: odată format, ceasul continuă să meargă și printr-o dizolvare
    ulterioară. O revenire la 0 acolo ar face toată plasa să sară.
- **`waveSamples(count, cells, seed)`**: mostrele roiului stau pe grila tier-ului, la timpul 0:
  45% pe rânduri, 40% pe coloane (uniform pe lungime), 15% pe brațele cruciulițelor. Tier-ul
  vine prin `SampleTier.wave`, trimis de `swarmSlots`.
- **Chunk-ul scenei**: +275 B gzip (260.570 → 260.845, măsurat de P2-B). `__THREE__` rămâne într-un
  singur chunk.

**Changed**

- **Parametrul se numește `instant`, nu `snap`** ca în spec: `scene-contract.test.ts` citește
  `snap:` în `components/scene/**` ca opțiunea interzisă a ScrollTrigger. Tot în redenumirea asta,
  `writeServicesSpan` a devenit `writeEntrySpan`.
- `stepMorph(…, instant)` e instant cât timp `fx.entry.value < 1` (înainte: `fx.handoff < 1`).
- **Cipul din hero se dizolvă doar după `coreReveal(heroExit)`.** Nu-l mai ia nimeni spre
  servicii, deci `SceneComposition.core` a dispărut. Slotul 0 al roiului (silueta cipului)
  rămâne, dar niciun plan nu-l mai folosește până îl ia elicoidul, în Faza 3.
- `e2e/helpers.ts` `sceneProbeVsDom`: citirile `handoff.*` devin
  `entry.start = services.top − .9vh` și `entry.end = services.top − .75vh`. Docblock-ul e
  actualizat.

**Changed** — aserțiuni de test schimbate deliberat (niciuna slăbită)

`scene-choreography.test.ts` (39 → 48):
- Proba desktop are `entry` {406, 526} în loc de `handoff`.
- „La hero: doar nucleul” devine „deasupra serviciilor (entry 0): nimic desenat”. `plan.core` nu
  mai există: roiul e inactiv și toate dezvăluirile sunt 0.
- „În handoff, roiul duce nucleul în model” devine „intrarea explodează modelul dintr-un punct”:
  `from` e `BURST` în loc de 0, dezvăluirea folosește `smoothstep(.72, 1)` în loc de `(.7, 1)`,
  iar implozia și clamparea sunt verificate și ele.
- „Continuu unde handoff-ul predă morph-ului” verifica un singur ε, lângă 1. Devine un **test de
  proprietate** la ambele capete, pentru fiecare formă, cu alfa roiului, cu diferența mărginită la
  300·ε².
- „Primul cadru fixează ținta” verifică acum poarta `{ value: 1, armed: true }` în loc de
  `fx.handoff` = 1.
- „Se apropie de noul progres de scroll și ajunge la 1” devine „explozia rulează pe pasul
  limitat”: 22–23 de cadre la 20 Hz, cu stările `burst`, apoi `formed`.
- Teste noi:
  - „format, fără morph”;
  - șase teste pentru `stepGate` și `entryState`;
  - ancora nemăsurată;
  - aruncat înapoi la hero.
- Celelalte teste fx primesc doar noua semnătură (`scrollY` și banda).

`scroll-guard.test.ts` (30):
- `writeServicesSpan` / `probe.handoff` devin `writeEntrySpan` / `probe.entry`, plus verificarea
  că obiectul probei rămâne același.
- Testul de montare al directorului verifica doar că există 2 trigger-e. Acum verifică **exact**
  care sunt: `#top` „top top” → „bottom 35%” și ancora serviciilor „top 90%” → „top 75%”, ambele
  fără animație.
- Cazul W13 copiază `entry` în loc de `handoff`.

`scene-stage.test.tsx` (29):
- Lista „niciun atribut înainte” include `data-entry`.
- Testul „scrie în DOM și le scoate odată cu scena” acoperă și `onEntry` (`idle`, `burst`,
  `formed`), plus scoaterea atributului la bail, cu `data-renderer="fallback"` verificat.
- Testul de reduced motion verifică și că `data-entry` dispare.

`lib/__tests__/scene.test.ts` (53): forma probei are `entry` în loc de `handoff`, iar
`SCENE_ATTR.entry === "data-entry"`.

`scene-tiers.test.ts` (13 → 14):
- Tabelul de buget are un rând nou, `wave subdiv` (high ≥ mid). Rândul `wave` păstrează aceeași
  aserțiune, pe valorile noi.
- Test nou: 16×8 cu 32 pe high, 10×6 cu 24 pe mid, iar subdiv e par.

Doar teste noi: `scene-build.test.ts` (16 → 18), `directions-selector.test.tsx` (32 → 34) și
`tailwind-contract.test.ts` (21 → 26; cele 5 teste noi au trecut un test de mutație pe 6 copii
stricate ale CSS-ului). `scene-mesh-wave.test.ts` e nou (9).

**E2E**:
- W11 („odată ce modelul s-a format, hover pe o pastilă face morph”) derulează la
  `anchor.top − .75vh + 40`, adică poarta armată. Înainte derula la centrul ancorei − 450px,
  capătul vechiului handoff.
- Bucla de pastile (~20s) rămâne; comentariul explică cele 22 de cadre.
- W16 e nou. Niciun alt test E2E nu s-a schimbat.

**Removed**

- **Handoff-ul derulat de scroll** (spec §10, punctul 2): `probe.handoff`, `writeServicesSpan`,
  `fx.handoff` și netezirea lui, `SceneComposition.core`. A dispărut și plecarea roiului din silueta
  cipului: `coreMatrix`, `fromIsCore` și importul `CHIP` din `world.ts`.
  - `grep handoff` nu mai găsește nimic legat de scenă, nici în cod, nici în `docs/`.
  - Au rămas doar „handoff”-urile fluxului de cerere HUD, care n-au legătură.
- **Nodurile valului** (P6):
  - `POINTS_MODE.waveNodes` (3) și ramura lui din vertex shader;
  - `WAVE_GLSL` din sursa P6;
  - uniformele `uWaveTime`, `uPulseR` și `uOrigin` ale materialului de puncte;
  - `PlaneGeometry` / `WireframeGeometry` din `meshWave.ts`.

  **Fără renumerotare**: `POINTS_MODE` rămâne `{ swarm: 1, pulses: 2 }`.

**Fixed**

- **Modelul putea rămâne pe jumătate format la poziția de citire.** Asta producea și „zgomotul”
  din Brand & UI.
  - Estimarea din plan, la 1280×800: când titlul Directions devine complet vizibil, vechiul handoff
    era la ≈ .64 (modelul încă invizibil, roiul la 43%). La 390×844 era la ≈ .82 (modelul la 35%).
  - Acum pragul armează cu ≈ 180px (desktop) sau ≈ 160px (telefon) înainte ca titlul să fie
    complet vizibil, iar modelul se formează în 1.1s oricum.
- **Cuburile apăreau împrăștiate imediat după `formed`.** P2-C a văzut asta pe o captură făcută la
  900ms după `formed`, iar P2-A a confirmat.
  - Cauza: lumea repornea ciclul modelului la prima apariție (entry ≈ .72, cu ~0.3s înainte de
    formare). Din faza de bloc de 1.4s mai rămâneau astfel doar ~1.1s după `formed`.
  - Reparația: cât dezvăluirea e sub 1, lumea îi dă modelului `step = 0`. Roiul aterizează pe poza
    de start, iar fiecare buclă începe exact la formare. Același lucru se aplică după un morph de
    pastilă.
  - Test în `scene-build`: matricea cuburilor e neschimbată la 1.25s după `formed` și schimbată o
    secundă mai târziu.

- **Glow-ul putea să se aprindă un commit sub `pending`** (găsit de P2-D la verificarea docs):
  scena raportează prima stare de intrare în cadrul în care devine gata, cu un commit React înainte
  ca stage-ul să spună `webgl`, iar la un deep link primul raport e deja `formed`. Selectorii din
  `app/tailwind.css` cer acum și `[data-scene-stage][data-renderer="webgl"]` (glow-ul și banda);
  `tailwind-contract` fixează selectorul complet și interzice un `[data-entry=…]` singur.

**Docs**

- [03](./docs/03-architecture.md#the-services-entrance-it-os-phase-2-2026-09-17):
  - secțiunea nouă „The services entrance”: banda, poarta, compoziția, explozia, ciclul propriu al
    modelelor, `data-entry`;
  - forma probei, `data-entry` printre atributele scenei, `onEntry` în „Who owns what”;
  - arborele: `fx.ts` cu poarta.
- [04](./docs/04-design-system.md#directions--the-hud-screen):
  - regulile glow-ului și ale benzii, cu contrastul măsurat;
  - `entry-glow` / `entry-sweep` în tabelul de utilitare;
  - `hud-glass-sweep` la keyframes.
- [05](./docs/05-page-sections.md#interior-stage-3d):
  - explozia și implozia, „ecranul răspunde”;
  - rândul Brand & UI („a neon grid (rows, columns and + crossings) rolling in waves”);
  - ciclul propriu al modelelor, care pornește la `formed`;
  - legătura din secțiunea Directions.
- [07](./docs/07-conventions.md#gsap-and-scrolltrigger):
  - banda `entry` și regula „poartă temporizată, nu progres de scroll”;
  - `data-entry` în contractul `data-*`;
  - `POINTS_MODE` fără 0 și fără 3, `TUBE_MODE` fără 0;
  - regula Tailwind a panoului, fixată de `tailwind-contract`.
- [14](./docs/14-testing.md): numărătorile pe fișier, `scene-mesh-wave`, W16.
- [`e2e/README.md`](./e2e/README.md): W11 și W16.

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, snapshot-ul final) | exit 0 · 0 · 0 |
| `npm test` (node:22-alpine), rulat de 2 ori | **1.200 passed / 0 failed** în 65 de fișiere, de ambele dăți (înainte: 1.172 în 64) |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă) | **258 passed / 0 failed / 0 skipped** (257 + W16) |
| `preloader` + `hud-shell` + `interior` + `interior-webgl`, `--repeat-each=3` | 272 passed, **1 failed**: intro-ul la 568×320 nu s-a terminat în 20s (`preloader`), cu agenții Fazei 3 rulând build-uri în paralel; Faza 2 nu atinge intro-ul. W14 3 / 3 (reparația `scrollToY` din Faza 1 ține) |
| după reparația selectorilor: `tailwind-contract` + `directions-selector`; `interior` (E), W11, W16 și intro-ul pe telefoane, `--repeat-each=3` | `tailwind-contract` + `directions-selector` 60 / 60; noble **81 passed / 0 failed** (E1–E16, W11, W16 formed după 1.081–1.205ms, intro-ul pe telefoane inclusiv 568×320 de 3 ori) |
| E2E rulat de agenți (noble) | P2-A: `interior-webgl` + `interior` + `preloader` → 65 passed / 1 failed (W14). Repetări: W14 2/3, W11 3/3, W16 3/3, W13 2/2 după reparația cuburilor. P2-B: `interior-webgl` + `interior` → 42 passed. P2-C: `interior` 22 + `hud-shell` 25 + `responsive` 66 = 113 passed |
| Laboratoare vizuale | P2-A: capturi desktop și telefon, dark, în fiecare stare; 0 erori CSP sau de pagină. P2-B: grila înainte și după, formată și în aterizare. P2-C: glow static pe fallback în ambele teme; `pending` fără glow; reduced motion (`off`) cu glow static și fără bandă; pe WebGL real, `pending` → `idle` → `burst` → `formed` |
| Draw-uri cu Brand & UI format (SwiftShader, 120 de cadre) | high 5 → 4, mid 4 → 3 (P2-B) |
| `__THREE__` într-un singur chunk | da (`2brzpckzba614.js`, 261.969 B gzip), în toate cazurile cu WebGL |
Greutate (gzip, bytes; același script și aceleași cazuri ca la Faza 1; baza e coloana *Faza 1* de acolo):

| Buget | Caz | Bază (Faza 1) | Faza 2 | Diferență |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine | total 262.140 · referit din HTML 257.250 · JS târziu 3.936 | total **262.391** · JS târziu 3.936 | +251 (CSS +220: `entry-glow`, `entry-sweep`, keyframes; HTML +19) |
| B1s / B7 | B1 + scroll · pe mobil | JS târziu 3.936 | 3.936 | 0 |
| B2 | scenă forțată + scroll (desktop și mobil) | JS târziu 314.585 | **315.109** ✓ (≤ B1s + 316.000) | +524 (poarta, compoziția, explozia, grila) |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 323.648 | **324.177** ✓ (≤ 330.000) | +529 |
| B3i | prima vizită, intro forțat | 304.593 | **305.128** | +535 — peste limita planului (300.000), ca în fazele anterioare; nouă bază |
| B4 | prima vizită | JS târziu 35.776 | 35.775 | −1 |
| B5 | `/servicii/e-commerce` | total 222.689 (limită 224.000) | **222.906** ✓ | +217 (CSS) |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte | 3.219; 0 contexte | 0 |
| H | documentul HTML `/`, care revine | 21.560 | **21.579** ✓ | +19 (cele două clase) |
| — | chunk-ul comun three + R3F + scene | 261.439 | **261.969** | +530 |

> **Rămâne deschis:**
> - **Saltul inelului de puls** (exista dinainte): raza inelului e ceasul modulo 3.2s. La fiecare
>   ciclu, inelul sare de la margine înapoi în centru.
> - **Safari < 16 nu are `overflow: clip`.** În cele 1.1s ale exploziei, banda poate trece discret
>   dincolo de coloana de text.
> - **La 390×844**, la pragul de intrare, modelul format ajunge în spatele rândului de pastile.
>   Pastilele rămân deasupra și lizibile.
> - **Implozia în timpul unui morph de pastilă**: dacă vizitatorul urcă deasupra benzii exact cât
>   rulează un morph, compoziția trece de la ramura morph-ului la implozie cu un salt de un cadru.
> - **Cuburile explodează la ~2s după `formed`, intenționat.** E bucla lor de 7.2s: bloc 1.4s,
>   explozie 0.8s, plutire 2.2s, reasamblare 1.4s, fixare 1.4s. Nu e o intrare neterminată.
> - **Un deep link înainte ca proba să fie măsurată** (teoretic, P2-A): dacă scena e gata înaintea
>   directorului, poarta nu mai e la primul cadru. Modelul ar exploda în loc să apară direct format,
>   sub ilustrația care încă se vede.

---

## 2026-09-17 — Faza 1: microprocesorul din hero și urma de circuite a cursorului

A doua fază a experienței IT aprobate. Nucleul de sticlă din hero („Cybernetic Core”: sferă de
sticlă, inele, nor de particule) devine un **microprocesor neon procedural**, iar un mouse sau un
creion care se mișcă peste scenă lasă în urmă o **urmă de circuite**: segmente neon în unghi drept,
lipite de o grilă a paginii, care se sting în 0.9s. Servicii, elicoidul și HUD-ul vin în fazele
următoare. Patru owneri: scena WebGL (P1-A), ilustrația statică (P1-B), urma (P1-C), apoi
calibrarea contrastului, E2E și documentația (P1-D). Nimic nou în bundle-ul paginii, CSP-ul e
neschimbat.

**Added** — microprocesorul WebGL (`components/scene/three/core.ts`, `shapes.ts`, `three/samples.ts`,
`tiers.ts`) — vezi [03](./docs/03-architecture.md#the-hero-chip-and-the-cursor-trail-it-os-phase-1-2026-09-17)
și [05](./docs/05-page-sections.md#interior-stage-3d)

- **Construit numai din programele existente** (decizia D-A): muchii de cutii instanțiate (P3) pentru
  substrat, heat spreader, rama die-ului și pini; die-ul cu plasmă (P2); linii (P4) pentru via-uri,
  teșitura IHS, crestătura pinului 1 și grila die-ului; panglici plate pe trasee cu pachete (P5); un
  val pătrat (P4) doar cât rulează boost-ul. **4 draw-uri pe cadru** sus pe `/` (înainte 10 pe high,
  8 pe mid); SwiftShader la 1280, tier high: 132 de cadre în 2.5s față de 41.
- **Geometria e în `shapes.ts`**: `CHIP`, `CHIP_POSE`, `chipTraces(perSide)`, `chipPins(perSide)`,
  comune scenei și ilustrației. `CHIP.R` = 2.45, raza vechiului nucleu, deci toate încadrările în
  host rămân identice. Tier-uri: `chipTraces` 7 pe latură pe high, 5 pe mid.
- **Animație**: înclinare după pointer / giroscop, pachete pe trasee dus-întors, pinii se aprind la
  plecarea și sosirea unui pachet, boost-ul CTA accelerează pachetele (`1 + 1.5·boost`) și trimite
  un val pătrat. La ieșirea din hero cipul se micșorează, IHS-ul și die-ul se ridică (vedere
  explodată, `coreExitPose().lift`: +0.22 / +0.4) și se dizolvă (`coreReveal`, de la 60% din ieșire).
  Nu mai alunecă spre servicii; slotul 0 al roiului ține temporar silueta cipului (`chipSamples`).

**Added** — urma de circuite a cursorului (`components/scene/trail.ts`, `three/trail.ts`, `input.ts`,
`fx.ts`, `three/materials.ts`) — vezi [05](./docs/05-page-sections.md#interior-stage-3d)

- **Model pur** (`trail.ts`): buffer circular de 64 de segmente; fiecare mostră e lipită de o grilă de
  20px a **documentului** și legată de precedenta printr-un L (latura lungă întâi); o pauză peste
  0.35s sau un salt peste 12 celule începe un lanț nou, fără segment.
- **Listener**: în ramura de pointer fin din `input.ts`, doar pentru `pointerType` mouse sau pen:
  `clientX + scrollX`, `clientY + scrollY`, `event.timeStamp`. Touch și pointerii grosieri nu
  atașează nimic; nu rulează sub reduced motion și nici pe ilustrația statică.
- **Mesh** (`three/trail.ts`): o singură panglică P5 (`TUBE_MODE.trail = 4`, **niciun program nou**),
  64 × 6 vârfuri, urcă doar sloturile scrise (`addUpdateRange`), desenată peste restul scenei
  (render order 9, fără depth test) și **doar cât un segment încă se stinge** (+1 draw).
- **Limite, documentate**: apare doar unde pagina lasă canvas-ul să se vadă (Hero, Ticker,
  Directions), niciodată peste carduri opace; ~1.7 KB gzip module + ~0.2 KB GLSL.
- **Securitate**: nicio cerere, niciun loader, nimic scris în storage sau în DOM; coordonatele stau
  doar într-un inel de 64 de segmente în memorie, fiecare stins după 0.9s. CSP-ul din `proxy.ts` e
  neschimbat.

**Added** — ilustrația statică a microprocesorului (`components/scene/art/heroArt.ts`,
`HeroCoreArt.tsx`, `HeroCoreArt.module.css`) — vezi [04](./docs/04-design-system.md#static-art-componentssceneart)

- Un singur `<svg data-core-art>` cu 23 de elemente, fără `<circle>`: totul desenat în planul cipului
  printr-un singur `<g>` cu `CHIP_ART_MATRIX` (poza WebGL proiectată), deci crossfade-ul aterizează pe
  aceeași siluetă. Pini dreptunghiulari, via-uri pătrate, trasee `chipTraces(5)`, **8 pachete ca
  dâre roșii de cel puțin `PARTICLE_MIN_LENGTH` = 6 unități pe ecran**.
- Boost-ul pe ilustrație: valul pătrat `core-wave` (0.95 → 2.3) și `core-packets` (pachetele pâlpâie,
  doar opacitate; înlocuiește `core-push`). Tot fără animație infinită.
- **H: 22.088 → ≈21.556 B** (−532; ilustrația apare de două ori, markup + RSC), totalul B1
  262.165 → 262.123 (măsurat de P1-B; de re-măsurat de lead după calibrare, vezi *Verificare*).

**Added** — E2E W17 (`e2e/interior-webgl.spec.ts`, `e2e/helpers.ts`) — vezi [`e2e/README.md`](./e2e/README.md)

- **W17 (1280×800, mouse, WebGL forțat)**: după ce scena se așază pe un număr fix de draw-uri pe cadru,
  60 de mișcări de pointer peste hero (zig-zag prin banda eyebrow/titlu și peste cip, departe de CTA-uri)
  → **exact un draw în plus pe cadru** cât trăiește urma și înapoi la numărul de repaus după 1.5s;
  apoi 1 canvas, 1 context viu, click-ul în centrul `#top button`, `#top a[href="#servicii"]` și al
  comutatorului de temă aterizează pe control, 0 erori în consolă, 0 încălcări CSP.
- Helper nou `countDrawCalls` + `drawCallsPerFrame` / `resetDrawCalls`: învelește metodele de draw ale
  ambelor prototipuri de context dintr-un init script și numără pe cadru de animație. **Codul de
  producție nu e atins.**

**Changed** — calibrarea contrastului (R31) după cip (`components/scene/choreography.ts`,
`app/globals.css`) — vezi [04](./docs/04-design-system.md#hero-core-tokens-phones)

Măsurat cu textul ascuns, pe fiecare pixel din casetele de rând ale textului (≥4.5:1; titlul, text
mare, ≥3:1), peste canvas-ul WebGL forțat (**12 cadre** pe caz: pachetele și pinii care se aprind mută
cel mai rău pixel, iar 4 cadre ratau unele cazuri) și peste ilustrația statică, la 320, 375, 390, 412,
768, 861, 1024, 1280 și 844×390, ambele teme.

| Constantă | Înainte | Acum |
|---|---|---|
| `CORE_BEHIND_COPY_DIM.narrow` (<641px) | glow 0.55 · ink 0.4 | **neschimbat** |
| `CORE_BEHIND_COPY_DIM.wide` (641–860px) | glow 0.35 · ink 0.3 | **glow 0.25 · ink 0.15** |
| `--hero-core-phone` (<641px) | 0.4 | **0.3** |
| `--dark-hero-core-phone` (<641px) | 1 | **0.65** |
| `--hero-core-phone` / `--dark-` (641–860px, `@media (min-width: 641px)` nou) | 0.4 / 1 | **0.11 / 0.27** |
| `--hero-scrim` / `--dark-hero-scrim` | 0.92 / 0.8 | **neschimbate** |

Contrast (cel mai mic raport; % = pixeli care trec, doar unde e sub 100%):

| Caz | Înainte | Acum |
|---|---|---|
| dark, canvas, <641 | lead 5.45 · titlu 3.59 | lead 5.49 · titlu 3.59 |
| dark, ilustrație, <641 | lead 6.34 · titlu 3.37 | lead 7.58 · titlu 3.84 |
| light, canvas, <641 | lead 4.59 (12 cadre: 4.50) · titlu 3.58 | lead **4.50** · titlu 3.58 |
| light, ilustrație, <641 | lead 4.73 · titlu 3.68 | lead 4.78 · titlu 3.74 |
| dark, canvas, 768×1024 | titlu **2.76** (<3:1); 12 cadre: lead **99.94% (3.78)**, titlu 2.74 | lead 5.05 · titlu 3.62 |
| dark, ilustrație, 768×1024 | lead **99.92% (4.28)** | lead 8.19 · titlu 4.39 |
| light, canvas, 768×1024 | lead **99.84% (4.06)** | lead 4.53 · titlu 3.77 |
| light, ilustrație, 768×1024 | lead **99.13% (4.17)** | lead 4.69 · titlu 3.83 |
| 844×390 (eyebrow și titlu pe ecran), ambele | 100% | 100% (dark titlu ≥4.21, light ≥3.76) |

Toată copia din hero (eyebrow, titlu, lead, CTA secundar, cardurile de statistici) e **100% sub 861px,
în ambele teme și pe ambele căi**. Eyebrow-ul light (4.55–4.68) e limita propriei culori pe pagină.

Luminozitate ilustrație ÷ canvas unde cipul e în spatele textului (schimbarea medie de luminanță,
ancoră ∩ coloana textului):

| | 320 | 375 | 390 | 412 | 768×1024 | 844×390 |
|---|---|---|---|---|---|---|
| dark înainte | 2.11 | 1.62 | 1.60 | 1.98 | 3.75 | 4.03 |
| dark acum | 1.17 | 0.91 | 0.91 | 1.12 | 0.97 | 1.10 |
| light înainte | 1.55 | 1.26 | 1.23 | 1.38 | 1.64 | 2.41 |
| light acum | 1.26 | 0.94 | 0.92 | 1.01 | 0.92 | 1.37 |

- **Dark**: ilustrația era de 1.6–2.1 ori mai luminoasă decât canvas-ul (și de 4 ori la 641–860px),
  deci hero-ul se stingea vizibil când prelua WebGL-ul. Acum ±10% la 375/390/768/844×390, +12% la 412.
- **Light**: ±8% la 375–412 și 768. 320px rămâne peste (+17% dark, +26% light): trăsăturile de lățime
  fixă ale ilustrației cântăresc mai mult pe un cip de 294px, iar o singură valoare nu poate acoperi
  toate lățimile. La 844×390 cipul light nu schimbă niciun pixel cu 3%, în ambele căi.
- **De ce cipul light nu poate fi mai vizibil pe telefon** (P1-A îl găsise abia vizibil): centrul lui
  stă sub lead, iar culoarea lead-ului are 4.87:1 pe pagina goală. La 390px, pe 12 cadre, cel mai rău
  pixel e deja exact 4.50. Încercat: ink 0.6 / 0.7 / 0.8 sub scrim 0.95 → 99.98% (4.45) / 99.98%
  (4.41) / 99.94% (4.40); ink 0.5 sub 0.95 trece, dar e **mai puțin** vizibil decât acum; scrim 0.98
  șterge cipul. Mai multă vizibilitate cere altă formă a scrim-ului (`Hero.tsx`), nu un token.
- **641–860px au acum valori proprii** pentru ilustrație, ca și canvas-ul: cipul (480px) e centrat
  sub lead, sub bazinul plin al scrim-ului, deci o cincime din el se vede oricare ar fi scrim-ul.

**Changed** — aserțiuni de test schimbate deliberat (niciuna slăbită fără motiv)

- `scene-shapes.test.ts` (20 → 45): „nucleul” (sferă, nucleu, inele în raza exterioară) → cipul: die <
  IHS < substrat < board ≤ R, poza, iar pentru 1–9 trasee pe latură: tronsoane orizontale / verticale /
  la 45° în interiorul board-ului, fără încrucișări, simetrie de ordin 4, pinii la începutul traseelor,
  determinist și fără `-0`. **Șters testul „inelele = cele trei orbite ale intro-ului”** (D-I). Bucla
  `toCssRotation` rulează pe `CHIP_POSE`.
- `scene-choreography.test.ts` (38 → 39): `coreExitPose` dă `lift` în loc de `rings`; nou `coreReveal`
  (tabel + monoton); încadrarea hero-ului cu `CHIP.R`; slotul 0 al roiului e pe cip (între board și
  vârful die-ului, pe traseele tier-ului); ponderea „în afara pinilor” a mostrelor 0.45 (în loc de
  0.55 pe sferă); **șters testul norului de particule**. Tabelul dim-urilor: aceeași structură, cu
  valorile fixate explicit și banda largă re-măsurată (0.35 / 0.3 → 0.25 / 0.15).
- `scene-tiers.test.ts` (12 → 13): rândurile de buget au `chipTraces` în loc de sferă / inele / nor /
  transmission; „doar high face antialiasing, niciun tier nu mai configurează sticla”; nou: 7 / 5 trasee.
- `scene-build.test.ts` (12 → 16): părțile sunt cipul, roiul, **urma**, apoi modelele (build și compile);
  `setLite(lite)` fără renderer; noi: cipul are cinci obiecte pe patru programe, vederea explodată,
  panglicile traseelor, aprinderea pinilor.
- `hero-core-art.test.tsx` (20 → 28): importuri și id-uri de gradient noi; „niciun cerc” (în loc de
  „niciun cerc sub r=12”); fiecare punct absolut, prin matrice, în cadru; „un circuit, nu particule”
  (tronsoane h/v/45°, pini dreptunghiuri închise, via-uri pătrate, pachete ≥ lungimea minimă pe ecran);
  proporțiile cipului WebGL (matricea = baza proiectată, trasee = `chipTraces(5)`, `chipLift`).
- `scene-input.test.ts`: evenimentul de mouse are `timeStamp`; o mostră de mouse pornește lanțul urmei,
  una de touch nu.
- `scene-palette.test.ts`: `glassTint` / `attenuation` scoase; testul fixează acum că paleta are exact
  rolurile `bg, blue, cyan, hot, mode, red` și că `--on-accent` nu mai e citit.
- `scene-trail.test.ts` e nou (17). **Niciun test E2E existent schimbat**; W17 e adăugat.

**Changed**

- **`CHIP.pin` → `CHIP.pinSize`**: `scene-contract.test.ts` caută în `components/scene/**` cheia `pin`
  (pinning-ul ScrollTrigger interzis) și o citea ca pin GSAP.
- `components/sections/Hero.tsx`, 861–1024px: ancora cipului stă la `right: calc(var(--gutter) + 6vw)`
  în loc de `+ 11.5vw`. La 11.5vw urmele din stânga ale cipului treceau pe sub capătul titlului
  (1024×768: dark canvas minim **1.22:1**, dark ilustrație 1.92, light canvas 2.38 — o regresie a cipului;
  vechiul nucleu avea minim 3.3). La 6vw tot textul din hero e 100% ≥4.5:1 la 900 și 1024, ambele teme
  și căi; cipul e acoperit ceva mai mult de cardul de statistici. Comentariul și docs/05 descriu motivul.
- `e2e/helpers.ts` `scrollToY`: limita de scroll se recitește la fiecare poll și pagina e derulată din
  nou dacă documentul a crescut după primul scroll (layout târziu imediat după hidratare). W14
  („până jos”) pica 1 din 3 în `--repeat-each=3`: aștepta 6382, pagina ajunsese la 6450. Aserțiunile
  rămân aceleași; doar ținta urmărește capătul real al paginii.

**Removed**

- **Sticla din interior** (D-A): `createPhysicalGlass`, `createFrostGlass`, programul P1,
  `installEnvironment` (benzile PMREM), pasul de transmission, `setTransmissionScale`
  (`components/three/renderer.ts`), `SURFACE_MODE.shell`, `POINTS_MODE.cloud`, `coreSamples`,
  `cloudPositions`, `mixPlacement`; cheile de tier `glass`, `sphere`, `ringTubular`, `ringRadial`,
  `cloud`, `transmissionScale`. `components/three/environment.ts` rămâne pentru intro.
- **Legătura inele ≡ `ORBITS` din intro (D-I)**: `CORE`, `RING_TILTS`, `RING_OMEGA` și testul lor; intro-ul
  își păstrează `ORBITS`.
- **Cod mort după cip** (verificat cu grep, inclusiv intro-ul): `TUBE_MODE.ring` și ramura lui din shader,
  cu uniformele pe care numai ea le folosea (`uHead`, `uHead2`, `uCometGain`, `uTicks`), **fără
  renumerotare** (`track` 1, `gates` 2, `links` 3, `trail` 4); `ScenePalette.glassTint` / `.attenuation`
  și citirea `--on-accent` care le alimenta (intro-ul are paleta lui, `components/three/palette.ts`).

**Fixed**

- Lead-ul din hero la 641–860px trecea sub 4.5:1 pe ilustrație (light 99.13%, dark 99.92%) și pe canvas
  (light 99.84%; dark 99.94% pe 12 cadre), iar titlul dark ajungea la 2.74:1 — acum 100% (tabelul de mai sus).
- 861–1024px: urmele cipului sub titlu (minim 1.22:1 la 1024×768) — ancora mutată spre dreapta, vezi
  *Changed*; acum 100% la 900 și 1024.
- Crossfade-ul ilustrație → canvas pe telefoane dark: hero-ul se stingea (ilustrația de 1.6–2.1× mai
  luminoasă); acum ±10% la lățimile uzuale.

**Docs**

[02](./docs/02-tech-stack.md) · [03](./docs/03-architecture.md) arborele (`trail.ts`, `three/trail.ts`,
cipul în `three/core.ts`, exporturile din `shapes.ts`, `input.ts` scrie urma), secțiunea nouă despre cip
și urmă, înregistrarea D-I · [04](./docs/04-design-system.md) ilustrația statică (pachete-dâre ≥ 6 unități,
`core-packets`), tokenurile hero re-măsurate · [05](./docs/05-page-sections.md) microprocesorul, urma și
limitele ei, fără sticlă · [07](./docs/07-conventions.md) PMREM și transmission clear doar în intro,
`trail.ts` printre helperii per cadru, cele cinci programe · [11](./docs/11-security.md) nicio hartă de
mediu în interior, urma nu stochează nimic · [14](./docs/14-testing.md) numărătorile pe fișier,
`scene-trail`, W17 · [`e2e/README.md`](./e2e/README.md) · [`README.md`](./README.md).

**Verificare**

| Check | Rezultat |
|-------|----------|
| `npm run build` · `npx tsc --noEmit` · `npm run lint` (node:22-alpine, arborele final) | exit 0 · 0 · 0 |
| `npm test` (node:22-alpine) | **1.172 passed / 0 failed** în 64 de fișiere (înainte: 1.116 în 63) |
| `interior-webgl` + `interior` + `preloader` + `hud-shell` + `responsive` (noble, build proaspăt) | **156 passed / 0 failed** (19 + 22 + 24 + 25 + 66; `interior-webgl` cu W17) |
| W17 `--repeat-each=3` | 3 passed (P1-D) |
| `npm test` rulat de 2 ori pe arborele final (snapshot, node:22-alpine) | 1.172 / 1.172, de ambele dăți; build · tsc · lint exit 0 |
| `npx playwright test --workers=1 --retries=0` (noble, suita completă, snapshot) | **257 passed / 0 failed / 0 skipped** (înainte: 256; + W17) |
| `preloader` + `hud-shell` + `interior` + `interior-webgl`, `--repeat-each=3` | 269 passed, **1 failed**: W14 (vezi `scrollToY` la *Changed*) |
| după reparația `scrollToY`: W2 + W13 + W14, `--repeat-each=8` | **32 passed / 0 failed** (W14 8 / 8) |
| Contrast R31 (12 cadre canvas, 2 ilustrație) | sub 861px: 100% peste tot (tabelul de mai sus); de la 861px vezi *Rămâne deschis* |
| TBT, WebGL forțat, tier mid, 390×844, CPU 4×, 3 rulări (mediane), HEAD `a0935fe` și arborele final construite și măsurate unul după altul pe aceeași mașină | fără scenă 137 → 151ms (aceeași cale, zgomot) · cu scena 666 → **595ms** · adăugat 529 → **444ms** · task-urile scenei (de la primul chunk târziu) 520 → **450ms** · cel mai lung task al scenei 405–451 → **348–365ms** (din care așteptarea SwiftShader 411–418 → 344–362ms: programele sticlei, PMREM-ul și pasul de transmission nu mai există) · JS-ul scenei singur (trace, fără compilare și așteptări GPU) ≈133 → ≈138ms, neschimbat în zgomot, cel mai mare task JS 183 → 188ms. Baza de 299ms din intrarea interiorului a fost măsurată altă zi, pe altă încărcare a mașinii: pe aceeași mașină, acum, aceeași metrică dă ≈135ms înainte și după |
| `__THREE__` într-un singur chunk | da, în toate cazurile cu WebGL (`12kvyg_4r4ncd.js`, 261.439 B gzip); niciun chunk din HTML-ul `/` nu conține three |

Greutate (gzip, bytes; același script și aceleași cazuri ca la Faza 0):

| Buget | Caz | Bază (Faza 0) | Faza 1 | Diferență |
|---|---|---|---|---|
| B1 | `/`, vizitator care revine | total 262.164 · referit din HTML 257.274 · JS târziu 3.936 | total **262.140** · referit din HTML 257.250 · JS târziu 3.936 | −24 (CSS −28: modulul ilustrației rescris, plus noul `@media` din `globals.css`; JS +4) |
| B1s / B7 | B1 + scroll · pe mobil | JS târziu 3.936 | 3.936 | 0 |
| B2 | scenă forțată + scroll (desktop și mobil) | JS târziu 314.114 | **314.585** ✓ (≤ B1s + 316.000) | +471 (cipul, urma, fără sticlă) |
| B3 | prima vizită, intro + scenă forțate + scroll | JS târziu 322.881 | **323.648** ✓ (≤ 330.000) | +767 |
| B3i | prima vizită, intro forțat | 303.826 | **304.593** | +767 — peste limita planului (300.000) ca și înainte; chunk-ul comun aduce și scena interiorului, acceptat ca nouă bază |
| B4 | prima vizită | JS târziu 35.774 | 35.776 | +2 |
| B5 | `/servicii/e-commerce` | total 222.671 | **222.689** ✓ (≤ 224.000) | +18 (CSS) |
| B6 | `/` care revine, reduced motion | JS târziu 3.219; 0 contexte | 3.219; 0 contexte | 0 |
| H | documentul HTML `/`, care revine | 22.085 | **21.560** ✓ | −525 (ilustrația cipului, de două ori: markup + RSC) |
| — | chunk-ul comun three + R3F + scene | 261.252 | **261.439** | +187 (cip + urmă − sticlă, PMREM, transmission, inele, nor) |

> **Rămâne deschis:**
> - La 861px eyebrow-ul light (99.69%, 4.09) și lead-ul (99.97%, 4.50) stau pe linia de 1px a grilei
>   HUD — identic cu cipul ascuns, deja cunoscut.
> - Cipul light rămâne discret pe telefoane (vezi mai sus), iar la 641–860px aproape invizibil în
>   light (0.15 / 0.11): constrângerea e contrastul lead-ului, nu gustul.
> - Urma: originea lui `event.timeStamp` pe browsere non-Chromium, `scrollX/Y` citite la fiecare
>   mișcare (pot forța layout), strălucirea de 2px e discretă pe SwiftShader; ilustrația folosește
>   `<use>` pentru halo (depinde de căile referite fără grosime proprie de linie).
> - TBT-ul e măsurat pe SwiftShader, headless.

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
