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

## 2026-09-24 — Added: asistenta vorbeste, da din gura si raspunde la intrebari frecvente

*„Fa patratul inca mai mare si fa ca sa apara un mesaj mai sus si sa dea din gura de parca ar
vorbi si adauga dupa ce apasam niste intrebari cu raspunsuri scriptate care ar raspunde la
intrebari frecvente si fa designul in stilul cum am facut la cerere/estimare si fix aceleasi
animatii."*

**Patratul:** 88 / 112 / 152 → **68 / 104 / 136 / 184**.

**Gura nu e o gaura.** Am construit si fotografiat doua variante inainte: o elipsa intunecata la
linia buzelor arata ca o gaura in fata, iar micsorata pana nu mai era gaura nu mai era nimic. O
fotografie cu buzele inchise n-are ce deschidere sa dezvaluie. Asa ca nu se adauga nimic: `.jaw` e
o fereastra spre **propria ei jumatate de jos a fetei**, mascata eliptic (un dreptunghi arata o
muchie dreapta pe fiecare latura pe care se misca — semnatura exacta a unei guri false), cu
balamaua la linia buzelor, deci barbia se misca cel mai mult. Cu balamaua invers, pieptul pompeaza
odata cu vocea, care e tell-ul de papusa.

**Amplitudinea e data de locul cel mai mic in care ruleaza.** Ea vorbeste doar la marimea
lansatorului, deci banda maxilarului are 11px pe desktop. Masurat: prima varianta, cu 11% si 1.1,
dadea **0.95 px** de deplasare — o palpaire. Cu 22% si 1.2 da **2.4 px** de translatie plus
intinderea, adica vreo 5px de deplasare a buzelor pe o fata de 106px. Masurat tacand: **0.00 px**,
animatie `none`.

**Un singur balon, trei moduri.** Ghidul avea deja un balon deasupra ei pentru sugestii de
sectiune; a primit moduri in loc sa capete un al doilea sistem: `tip`, `say` (o replica, dispare
dupa 7s) si `faq` (intrebarile). Prioritatea e `faq > tip > say`. Un bug prins de doua teste
existente: ✕ inchidea ce era **setat**, nu ce se **vedea** — ea putea vorbi in spatele unei
sugestii, iar ✕ ii taia replica nevazuta si lasa sugestia pe ecran.

**Intrebarile sunt chat-ul estimatorului**, in materialul lui: `.ask` e `.chatOption` — o pastila
ridicata pe `--panel`, `--r-sm`, care urca 2px la hover si coboara 1px la apasare, exact regula
comuna de apasare a estimatorului. Trece pe `--neon-cyan` si nu pe `--red`, pentru ca in widget-ul
asta rosul e CTA-ul, iar portretul de langa e monocrom cian. **Cate una pe rand**, nu un rand care
se infasoara: propozitii intregi ca pastile nu lasa loc raspunsului.

**Raspunsurile sunt scrise, nu generate**, si fiecare repeta ceva ce site-ul spune deja, cu
fisierul numit alaturi in `copy.ts`. Fara nicio cifra de pret (preturile sunt editabile din admin),
fara promisiunea unui apel pentru fiecare cerere (site-ul leaga cele 30 de minute de un singur CTA),
si cu o intrebare — „Vorbesc cu un robot?" — pe care regula de onestitate a fisierului o astepta.

**Apasarea pe ea e acum o dezvaluire, nu o deschidere de dialog.** `aria-haspopup="dialog"` a
disparut, `aria-expanded` a aparut, iar numele accesibil spune intrebari. Cererea ghidata e o a
doua apasare, din CTA-ul dinauntru. Trei specificatii e2e si un test unitar s-au mutat odata cu ea.

**Un defect vechi, a treia oara.** Toate decalajele balonului deriva acum dintr-un singur
`--guide-box` pe punct de intrerupere. O marime copiata de mana a derivat de doua ori, iar a treia
oara un `bottom: 116px` masurat pentru un avatar de 88px statea mai jos in fisier decat regula pe
care o contrazicea si castiga tacut. Fotografiat la 1400x900: marginea de jos a balonului la 115px,
varful ei la 204 — vorbea din spatele propriei replici. Nu mai sunt literale.

**Si o corectie de codare:** `<source>`-ul AVIF a fost scos. Fiecare fereastra CSS spre portret —
pleoapele, maxilarul, masca conturului, masca liniilor — il incarca pe cel WebP, iar `<img>`-ul
primea AVIF-ul. Doua codari cu pierderi ale aceluiasi bitmap difera cu o valoare-doua pe piele
neteda, iar un petec care trebuie sa se potriveasca la culoare cu pixelii de sub el deseneaza o
muchie dura acolo unde difera. Un fisier, 31 KB.

**Despre cum s-a lucrat:** un flux cu 15 agenti a produs continutul (ancorat, in trei limbi) si —
mai valoros — juriul a gasit defecte care se aplicau direct planului meu: nepotrivirea de codare,
gura care se misca invers, marginile nemascate, si faptul ca la marimea telefonului efectul nu
exista. Trei dintre ele erau deja in ce construisem.

1616 teste si lint trec.

**Fisiere:** [`components/hud/guide/GuideAssistant.tsx`](./components/hud/guide/GuideAssistant.tsx) ·
[`components/hud/guide/GuideAssistant.module.css`](./components/hud/guide/GuideAssistant.module.css) ·
[`components/hud/guide/copy.ts`](./components/hud/guide/copy.ts) ·
[`tools/guide/asset.mjs`](./tools/guide/asset.mjs) ·
[`components/__tests__/guide-assistant.test.tsx`](./components/__tests__/guide-assistant.test.tsx) ·
[`e2e/guide.spec.ts`](./e2e/guide.spec.ts) ·
[`docs/04-design-system.md`](./docs/04-design-system.md#ghid-tbs--the-guide)

---

## 2026-09-24 — Added: proiectorul porneste — asistenta e desenata din saisprezece benzi, intr-un patrat mult mai mare

*„Fa patratul sa fie mai mare si fa o animatie foarte wow cum apare."*

**Patratul:** 72 / 88 / 120 → **88 / 112 / 152**, plus o treapta noua de **64px sub 400px**. Aia
din urma repara un defect pe care tot eu il introdusesem: dock-ul telefonului e trei butoane de
44x44 centrate pe bara, cam 156px lat (x 82..238 la o fereastra de 320px), iar ghidul e fixat la
`right: 12px` si creste spre stanga — deci la 320px cutia poate avea cel mult **70px**. Cu 88 se
suprapunea. La 400px in sus, 88 trece lejer (300 > 278).

**Intrarea, in 3.4 secunde:** bara emitatorului se deschide brusc la toata latimea si arde peste
masura (0–160ms); un con de lumina se desface din ea (160–420ms); **saisprezece benzi din ea intra
din parti alternative, forfecate, de jos in sus**, in timp ce o bara de scanare urca prin fascicul
si ii trece de crestet exact pe cadrul in care aterizeaza ultima banda (300–1280ms); doua sacadari
scurte si, la 1300, se aprinde rasterul — semnalul s-a prins (1280–1460ms); o unda de soc pleaca
din ea (1400–1900ms); sta, respira si clipeste (1900–2750ms); apoi se aseaza in lansator, care se
ridica pe masura ce ea pleaca (2750–3400ms).

**Benzile sunt toata tehnica, si exista din cauza constrangerii, nu in ciuda ei.** Keyframe-urile
din modulul asta pot declara doar `transform` si `opacity` — un test le parcurge pe toate — deci o
dezvaluire nu poate fi o masca in miscare sau o taietura care creste. Saisprezece copii ale
aceluiasi bitmap, fiecare cu propria taietura **statica** si propria intarziere, dau aceeasi
imagine doar din transformari. **Saisprezece si nu o duzina:** e o putere a lui doi, deci fiecare
granita cade pe exact 6.25% si taieturile vecine se inchid fara rest — la 7 sau 12 granitele sunt
zecimale periodice si se poate deschide o cusatura de sub-pixel. Din ce parte vine fiecare si
incotro se forfecheaza e o regula **statica** `:nth-child(odd/even)`, deci un singur bloc de
keyframe-uri serveste toate saisprezece.

**Trei lucruri masurate pe drum, nu ghicite:**

- **Esalonarea e derivata.** 16 benzi la 45ms distanta inseamna 675ms, plus un zbor de 300ms, deci
  ultima aterizeaza la 1275ms — iar predarea e la 1300, la 25ms dupa. Cu ordinea gresita, varful
  capului ei e inca in aer cand preia figura reala.
- **`both`, nu `backwards`.** Fotografiat la 1020ms: cadrul o arata doar cu capul, plutind, cu tot
  corpul deja construit si disparut. Fiecare banda revenea la `opacity: 0` din propria regula in
  clipa in care ateriza.
- **Doua animatii pe acelasi element care ating `opacity` nu se compun** — castiga ultima din
  lista. Fara un invelis separat pentru benzi si unul pentru figura, benzile erau complet opace
  din primul cadru al intrarii.

**Predarea e o taietura de un cadru, nu o trecere lina** (`steps(1, end)` de ambele parti): doua
picturi ale aceluiasi decupaj semi-transparent, la jumatate de opacitate fiecare, nu dau o pictura
— dau o fantoma.

**Stralucirea fara filtru:** `box-shadow` nu e `filter` si niciun test nu-l atinge. Inelul e
**declarat la marimea lui maxima si scalat in jos la pornire**, pentru ca declarat mic ar fi un
element rotund sub 8px, ceea ce regula punctelor decorative interzice in tot HUD-ul.

Costa **20 de elemente**, toate in `.greeting`, toate in spatele portii `[data-live]`, toate scoase
din DOM cand se termina intrarea. Lansatorul insusi ramane neatins.

**Despre cum s-a lucrat:** am pus in paralel un flux cu trei variante si noua evaluari. Verdictele
au fost unanime, dar toate despre acelasi lucru — variantele fusesera scrise pe o versiune a
fisierului pe care o inlocuisem deja intre timp, deci „defectele" gasite erau coliziuni cu
implementarea mea, nu cu a lor. Ce **am** luat de acolo si a contat: harta de tehnici (box-shadow
permis, idiomul casei pentru stralucire, capcana numelor de keyframe), **saisprezece benzi ca
putere a lui doi**, **partile alternative cu forfecare**, si constrangerea dock-ului de telefon —
care a prins defectul de 88px de mai sus.

1614 teste si lint trec. Tot fara filtre, tot doar `transform` si `opacity` in keyframes.

**Fisiere:** [`components/hud/guide/GuideAssistant.tsx`](./components/hud/guide/GuideAssistant.tsx) ·
[`components/hud/guide/GuideAssistant.module.css`](./components/hud/guide/GuideAssistant.module.css) ·
[`components/__tests__/guide-assistant.test.tsx`](./components/__tests__/guide-assistant.test.tsx) ·
[`docs/04-design-system.md`](./docs/04-design-system.md#ghid-tbs--the-guide)

---

## 2026-09-24 — Changed: asistenta se misca acum ca un om, nu ca un mecanism

*„Dar fa sa aiba miscari ca un om viu."*

Respira si clipea, dar restul ei statea nemiscat — si o singura sinusoida pe un singur element se
citeste ca un mecanism oricat de incet ar merge. Acum sunt **trei ceasuri**: `.figure` se
**leagana** (11.9s), `.live` **respira** (4.6s), pleoapele **clipesc** (9s). Trebuie sa fie
elemente separate: toate trei conduc `transform`, iar doua animatii pe aceeasi proprietate nu se
compun — pur si simplu castiga ultima. Cele trei perioade n-au un multiplu comun scurt.

**Leganarea se invarte in jurul pieptului** (`transform-origin: 50% 88%`), si numarul asta e tot
ce conteaza: o rotatie in jurul unui punct jos in cadru misca partea de SUS cel mai mult — adica
o mutare a greutatii, ce face un om care sta in picioare. In jurul mijlocului, tot bustul s-ar
balansa ca un obiect atarnat.

Masurat pe figura de 64 x 75 px din lansator, urmarind crestetul prin matricele compuse timp de
31s: **crestetul parcurge 4.65 px pe orizontala si 2.03 px pe verticala, de doua ori mai mult
decat gulerul**, cu un drum total de 42 px. (Prima masuratoare a fost gresita: sub rotatie cutia
de incadrare creste, deci marginea ei de sus se misca si cand nimic din interior nu se misca.)

**Niciuna dintre extreme nu e un punct de intoarcere.** Fiecare e scrisa de doua ori, la opt
procente distanta din ciclu, deci **ajunge intr-o pozitie si o tine** inainte sa se mute iar.
Opririle sunt la pozitii inegale din acelasi motiv. Un `scaleX` cu cateva miimi sub 1 la extreme e
o intoarcere de cap — o fata se ingusteaza cand iese de pe axa.

**Respiratia e strambata intentionat:** varful sta la 36%, nu la 50%, deci inspiratia e scurta si
expiratia o asezare lunga. Asimetria asta e mai toata diferenta dintre o fotografie care pare ca
are plamani si una pompata.

**Nimic nu se repeta sub jumatate de minut.** Auto-corelat pe urma crestetului timp de 31s, cea
mai buna potrivire cu sine e **89.5% la 23.6s** — doua cicluri de leganare. Un om care intra in
bucla la cateva secunde e o masina.

La `hover` respiratia se accelereaza si leganarea se linisteste, cum se indreapta cineva de spate
cand se intoarce altcineva spre el.

1614 teste si lint trec. Tot fara filtre, si tot doar `transform` si `opacity` in keyframes.

**Fisiere:** [`components/hud/guide/GuideAssistant.tsx`](./components/hud/guide/GuideAssistant.tsx) ·
[`components/hud/guide/GuideAssistant.module.css`](./components/hud/guide/GuideAssistant.module.css) ·
[`docs/04-design-system.md`](./docs/04-design-system.md#ghid-tbs--the-guide)

---

## 2026-09-24 — Changed: asistenta e acum monocroma, intr-un patrat mai mare, pana la piept

*„Dar fa sa fie fara culori ca o holograma, si fa sa fie intr-un patrat mai mare, si sa fie pana
la sani."*

**Fara culoare, si asta a fost adevarata problema.** O fotografie colorata sub o spalare cian
ramane o fotografie: sacoul statea crem, pielea statea piele, si se citea ca *poza unei persoane*,
nu ca *proiectia* ei. O holograma e **o singura lungime de unda**. Fisierul e dus acum pe
`--neon-cyan` (#38e1ff) prin `tint` **singur** — lucreaza in LAB si inlocuieste croma pastrand
luminanta, deci e si desaturarea si nuanta intr-o singura trecere. Prima incercare a fost cu
`greyscale()` inainte, si n-a mers deloc: ramane o imagine cu un singur canal, fara croma pe care
`tint` sa o poata seta.

**Patratul.** Cutia din colt trece de la 52 / 64x72 / 88 la **72 / 88 / 120, patrata peste tot.**
E o schimbare de contract facuta intentionat: avatarul e o persoana acum, iar la marimea veche
capul ei avea vreo douazeci de pixeli — o clipire acolo are doi. Decalajele bulei au urcat cu ea
(60 → 80, 80 → 100).

**Pana la piept.** Decupajul trece de la 554 x 628 (cap si umeri) la **722 x 849**, mai jos de
guler si de reverele sacoului, si mai lat ca umerii sa nu fie taiati de margine. Raportul 0.849
intra in patrat cu loc dedesubt pentru fascicul. Toate coordonatele pleoapelor au fost
re-derivate pe noul decupaj, altfel clipitul ar fi cazut alaturi de ochi.

**Si se stinge in fascicul.** Decupajul pana la piept a adus camasa alba in partea de jos a
cadrului, iar dupa tenta iesea mai stralucitoare decat fata — ochiul mergea la piept, nu la ochi.
Ultimii 38% din **canalul alfa** se sting patratic la build: o proiectie n-are tiv. Asta face si ca
conturul si masca liniilor de scanare, care arata amandoua spre acelasi bitmap, sa urmeze automat,
fara o a doua forma de tinut in pas.

**Liniile de scanare sunt intunecate acum, nu cian** (una la fiecare patru pixeli, `multiply` in
loc de `screen`): fisierul e deja o singura lungime de unda, deci cianul in plus doar ardea
luminile. Ce-i mai trebuie unei proiectii e rasterul, nu inca o tenta.

Asetul: **11–31 KB**. Zero filtre, ca si pana acum. 1614 teste si lint trec.

**Fisiere:** [`components/hud/guide/GuideAssistant.module.css`](./components/hud/guide/GuideAssistant.module.css) ·
[`tools/guide/asset.mjs`](./tools/guide/asset.mjs) · `public/guide/` ·
[`docs/04-design-system.md`](./docs/04-design-system.md#ghid-tbs--the-guide)

---

## 2026-09-24 — Changed: cubul din colt a devenit un asistent holografic care respira si clipeste

*„Acum aici fa un 2D model animat cu un asistent holografic in loc de patrat, si cand accesam
siteul, dupa ce a mers loadingul, ea sa apara cu o animatie frumoasa si daca ii posibil sa aiba
miscari precum clipire, respirare... asistentul sa fie fata aceasta."*

Ghid TBS nu mai e un cub CSS-3D. E o **proiectie holografica a unei persoane** — un portret
decupat, in acelasi con de lumina, cu aceleasi inele pe orbita — si **respira si clipeste**.

**Decuparea e taiata pe muchii, nu pe culoare, si asta a fost masurat.** Am potrivit doua modele
de culoare pentru fundalul de studio si amandoua au picat: fata de un plan, abaterea proprie a
fundalului ajunge la **48.7**, iar sacoul crem sta la **41** — pe partea luminoasa a cadrului
subiectul si fundalul au aceeasi culoare, deci niciun prag nu-i desparte. Un model separabil
`f(x) + g(y)` e si mai prost (media 37 fata de 19). Conturul insa e neechivoc: de-a lungul unei
linii care taie umarul stang, gradientul trece prin fundal la **0.6–1.4** si sare la **70.8** la
marginea sacoului — un raport de cincizeci la unu. Deci masca e o inundare dinspre marginea
cadrului spre interior, care poate trece doar prin pixeli si plati, si de culoarea fundalului, cu
harta zidurilor ingrosata cu un pixel.

Ambele indicii sunt necesare, si prima incercare o dovedeste: zidita doar pe gradient, inundarea a
curs prin **par** — suvitele fine lasa goluri de un pixel — iar odata intrata a mancat fata, pentru
ca pielea neteda e exact regiunea plata pe care un zid de gradient n-o poate tine. 87.4% din cadru
s-a intors ca fundal.

**Doua capcane `sharp` care au costat o dupa-amiaza**, amandoua tacute: `blur()` pe un buffer brut
cu **un** canal se intoarce cu **trei** — indexat ca unul singur, comprima masca de trei ori si o
coboara in cadru, asa ca silueta capului cade peste umeri si fata dispare; iar `joinChannel` cu un
buffer brut a inghitit restul lantului, `extract` a fost ignorat si n-a aparut niciun canal alfa.

**Clipitul e chiar portretul.** Fiecare pleoapa e o ferestruica spre acelasi bitmap, decalata ca sa
ia fasia de piele dintre sprancene si linia genelor, si scalata la zero in repaus; clipitul e fasia
aia crescand peste ochi. Culoarea se potriveste pentru ca **e** pielea ei, si rama ochelarilor nu
se misca deloc, pentru ca pleoapa e desenata in interiorul lentilei. Patru clipiri in noua secunde,
la distante inegale si una dubla — o clipire pe metronom se citeste ca o masina.

**Respiratia** e un singur `transform` pe `.figure`, o ridicare de 1.1% in 4.6s, si trebuie sa fie
pe elementul ala si nu pe imagine: pusa pe imagine, pleoapele raman in urma si stau cu un pixel mai
jos la fiecare inspiratie.

**Salutul.** O data pe vizita apare ca o proiectie de vreo trei ori cat lansatorul, ancorata in
acelasi colt, apoi se aseaza in buton (2.4s: 0.9s construire de la picioare in sus, 0.9s tinut,
0.6s plecare). Nu ia evenimente de pointer si e in afara arborelui de accesibilitate.

**Si asteapta pana cand chiar poate fi vazuta.** Doua lucruri acopera HUD-ul prin contract:
overlay-ul de intro si **coperta de incarcare a paginii** (`PageLoading`, sus cat timp scena 3D n-a
raspuns). Fotografiat la 1400 x 900, cu salutul la opacitate 1 si radacina la (1292, 792, 88, 88),
cadrul arata BootCore invartindu-se pe coperta si nimic din ea;
`document.elementsFromPoint` in interiorul radacinii a dat `DIV.grid > DIV.cover > SPAN.signal`.
Ceasul porneste acum pe primul cadru in care amandoua sunt libere, cu plafon la 11s.

**Zero filtre, si asta nu e un detaliu.** Doua fisiere de test interzic `filter:` in fiecare modul
CSS al HUD-ului, pentru ca un filtru face din elementul lui un bloc containing si aplatizeaza
`preserve-3d`-ul in care sunt desenate inelele. Asa ca desaturarea si ridicarea care transforma o
fotografie intr-o proiectie sunt **coapte in fisier** la build (`saturation 0.58`,
`brightness 1.07`, contrast liniar `1.06`), spalarea cian si liniile de scanare sunt un strat
mascat de canalul alfa al portretului, iar conturul e o a doua pictare a siluetei scalata 1.05 in
spatele ei — nu un `drop-shadow`. Am pastrat interdictia originala intacta.

**Asetul:** 554 x 628, la 384w si 192w, **17–28 KB**. Construit de `tools/guide/`, nu editat de
mana; README-ul de acolo tine toate masuratorile.

**Un lucru de spus cu voce tare:** portretul e o persoana reala si se serveste pe fiecare pagina
care monteaza HUD-ul. E o chestiune de consimtamant, nu doar de design.

**Fisiere:** [`components/hud/guide/GuideAssistant.tsx`](./components/hud/guide/GuideAssistant.tsx) ·
[`components/hud/guide/GuideAssistant.module.css`](./components/hud/guide/GuideAssistant.module.css) ·
[`tools/guide/`](./tools/guide/README.md) · `public/guide/` ·
[`components/__tests__/guide-assistant.test.tsx`](./components/__tests__/guide-assistant.test.tsx) ·
[`docs/04-design-system.md`](./docs/04-design-system.md#ghid-tbs--the-guide)

---

## 2026-09-24 — Added: trasee mult mai lungi, o aprindere mai lunga cu splash, si lumina care cade pe incapere

*„Animatia la procesor ii putina, fa mai lung sa fie liniile celea si sa dureze mai mult cum se
aprinde cu un splash, mai adauga si tu ceva de la tine."*

**Traseele erau niste cioturi.** Evantaiele laterale mergeau 62 → 98 si nu paraseau niciodata
siliciul — 36 de unitati de parcurs pe un desen lat de 480 — asa ca sosirea si plecarea nu aveau
mai nimic de strabatut. Acum au in medie **104.6 unitati fata de 48.2, cu 117% mai multa cerneala**,
iar lungimea in plus a fost luata in singura directie unde exista loc. Cadrul e 480 × 300, deci
impingerea varfurilor de sus si de jos si mai sus nu aduce nimic: la scara de deschidere jumatatea
de inaltime vizibila e 134 de unitati, iar un varf mai lung e pur si simplu desenat unde nu-l vede
nimeni. Cele sase trasee au fost extinse **spre interior**, de la marginea capsulei (98) la 62 —
propria jumatate de inaltime a siliciului — ceea ce adauga cate 36 de unitati fara sa mute varful
nici macar cu una. Laterale merg invers, pana la 152, unde ocolesc conducta de caldura de la x 154
cu 2 unitati si condensatoarele de la x −156 cu 4. Masurat: **93% din cerneala e in cadru pe
cadrul-afis, fata de 83%**, si toata pana la `--fb-p` 0.20.

**Dizolvarea s-a mutat 0.34 → 0.38, si potrivirea a iesit mai bine, nu mai rau.** Invariantul din
fisier era cea mai mare nepotrivire de marime dintre cele doua desene ale cipului, **neponderata**
— iar asta taxeaza la pret intreg eroarea exact pe cele doua cadre unde unul dintre straturi e
invizibil. Ponderata cu ce se poate privi (die-ul e la opacitatea `1 − dis`, placa la `dis`),
punctul livrat pana acum ia 2.87%, iar cadrul lui cel mai prost e chiar incrucisarea 50/50 — cel
mai prost loc posibil. Re-rezolvat la 0.38: divizorul die 0.508 → **0.544**, fereastra placii
`[0.34, +0.425]` → **`[0.38, +0.360]`**, `--bs` `2.556 − 1.936` → **`2.5027 − 1.8827`**. Latimile
siliciului pe cadrul deschiderii: **150.164768 fata de 150.164768**. Nepotrivirea vizibila maxima
**1.86% fata de 2.87%**, iar pe cadrul 50/50 **0.39% fata de 2.83%**. Tabelul undei de putere abia
se misca si tot se termina la **0.709**, deci `--gt`/`--ft` de la 0.71 si pragul de sarire de la
0.84 raman neatinse.

**Aprinderea e cu 40% mai lunga si acum aterizeaza.** `--ign` [0.15, 0.25] → **[0.16, 0.30]**, cu
`--cool` [0.30, 0.39] ca `--flare` sa fie tot 0.034 pe cadrul taieturii. Peste ea, doua lucruri
noi: **`--spl` [0.16, 0.30] — splash-ul**, `4t(1−t)`, o parabola si nu un smoothstep, pentru ca o
lovitura nu are voie sa intre lin; si **`--room` [0.19, 0.33]** — aceeasi anvelopa cu 0.03 in urma.

Splash-ul e strat propriu, blocat pana dupa hidratare, deci **nu costa nimic la primul cadru** (tot
20 + 20 = 40 obiecte de randare). Trei inele dintr-un cerc de r = 100, nascute la 0.12 distanta,
baleiaza scara 0.08 → 3.20; fiecare raza pe care o traverseaza e o muchie reala a desenului: 62
siliciul, 98 marginea lui, 128 inelul de putere, 152 capsula, 184 fata luminata a peretelui.
`transform-box` trebuie sa fie **`fill-box`, nu `view-box`** — viewBox-ul incepe la (−240, −150),
deci `transform-origin: 50% 50%` raportat la view box cade in colt, si unda a iesit din dreapta-jos
a cadrului. Masurat si reparat.

**`--room` e ce am adaugat de la mine.** Canionul in care sta cipul — doi pereti prelucrati, pragul
soclului, buza puntii, podeaua, adancitura — era pictat o data la `--fb-p` 0 si inghetat pentru tot
filmul. De asta aprinderea se citea ca o schimbare de culoare si nu ca o lumina: nu era nimic in
cadru pe care sa cada. Acum peretii prind flash-ul o clipa dupa cip, asa cum face o incapere.

Masurat la fel ca pana acum — fiecare scalar fortat la zero pe elementul care il declara, acelasi
cadru diferentiat: sosirea **3.8 → 6.1%** din cadru (era 1.8 → 3.4%), splash-ul **9.05%** la varf
si 0.13% pe cadrul-afis, aprinderea **7.7%** (era ~5%), incaperea **4.4%**. Trei incarcari reci:
sosirea **267–371 ms**, aprinderea + splash + incaperea **446–603 ms**, plecarea **219–457 ms**.

**Ce NU se poate, si de ce.** Sectiunea nu mai poate creste mult in derulare. Cu adancimea
retragerii inghetata (ca incadrarea sa nu se mute) si cu unda de putere obligata sa se termine
pana la 0.71, o cautare pe tot spatiul de constante nu gaseste nimic peste **0.36** pe obiectivul
neponderat si nimic peste **~0.38** pe cel ponderat: dincolo, placa trebuie sa se micsoreze atat
de mult mai repede decat die-ul incat cele doua desene diverg tocmai la incrucisare. Timp real in
plus trebuie sa vina din ceas — `MIN_SYNC_MS` — nu din derulare, si aia e o schimbare separata.

**Fisiere:** [`components/intro/IntroFallback.tsx`](./components/intro/IntroFallback.tsx) ·
[`components/intro/IntroPreloader.module.css`](./components/intro/IntroPreloader.module.css) ·
[`docs/05-page-sections.md`](./docs/05-page-sections.md#longer-conductors-a-longer-burn-and-a-splash-2026-09-24)

---

## 2026-09-24 — Added: impulsul ajunge la procesor, procesorul se aprinde, abia apoi pleaca curentul

*„La prima cu CPU adauga ceva animatii ca ii prea scurt, adauga cum se porneste cu pulsul si
ajunge la CPU si el incepe sa arda si atunci sa iasa din procesor."*

Cele patru scene de mai jos erau patru lucruri care se intamplau; nu erau o poveste. Curentul
pleca dintr-un cip la care nu ajunsese nimic niciodata — `--w` se deschidea la 0.14, inainte sa fi
sosit ceva. Sectiunea are acum **trei acte, in relatie de cauza si efect**, si la fiecare granita
se schimba complet registrul miscarii din cadru:

| actul | fereastra | singura miscare din cadru |
| --- | --- | --- |
| **sosirea** | `--arr` [0.02, 0.17] | spre interior. Un cap scurt si aprins parcurge fiecare dintre cele 14 conductoare, de la marginea capsulei pana la siliciu, iar aura se umple in urma lui. Cipul e intunecat si vine ceva spre el |
| **aprinderea** | `--ign` [0.15, 0.25] | niciuna. Siliciul se inroseste pe loc, capatul cald al gradientului inunda spre dreapta, blocurile logice se sterg, cele patru nuclee urca la 0.022 distanta, inelul se inchide |
| **plecarea** | `--w` [0.25, 0.40] | spre exterior, si se deschide exact pe cadrul in care caldura e la maxim. O linie aproape alba creste prin aura pe care sosirea a lasat-o aprinsa |

Ferestrele sunt in derulare, si doar derularea e fixa. Cronometrat pe trei incarcari reci ale
randorului software (unde preluarea e un caz defavorabil, ~2.3 s): sosirea **249–347 ms**,
aprinderea **231–365 ms**, plecarea **630–784 ms**, toata sectiunea procesorului **1.21–1.40 s**.
Milisecundele nominale ar da 487 / 340 / 545, dar presupun ca ceasul incepe de la zero — si nu
incepe: `origin` aluneca odata cu preluarea, ceea ce comprima actele de la inceput.

`--flare` este `--ign - --cool`, nu o fereastra: trebuie sa si **coboare**. Este 1 la 0.25 si
**0.028 la 0.34**, cadrul pe care se deschide dizolvarea — pentru ca trio-ul inghetat
`0.508 / 0.425 / 2.556` tine die-ul si placa la aceeasi marime pana la a sasea zecimala acolo, iar
o trecere de la un cip rosu la cel albastru-rece al placii ar arunca asta la gunoi. O taietura pe
potrivire supravietuieste unei schimbari de scara; nu supravietuieste uneia de culoare. `--heat` a
fost mutata la [0.25, 0.34] din acelasi motiv: se umplea inca doua sutimi *in interiorul*
dizolvarii.

**Dezvaluirea traseelor nu a fost niciodata o desenare.** Fiecare traseu de pe stratul asta e un
decalaj de liniuta peste un `<path>` cu 14 (sau 16) subtrasee, iar fisierul sustinea ca acestea
„se aprind IN ORDINE de la un singur decalaj". Masurat pe un traseu gol de aceeasi forma, citind
inapoi fractiunea vopsita din fiecare subtraseu: decalaj `0…750` → **fiecare subtraseu 100%**;
`1000…1750` → **0%**; `2000` → 100%; `-250, -500` → 0%. **Liniuta se reseteaza la fiecare
subtraseu**, iar `pathLength` se imparte intre ele — deci fiecare traseu are ~71 din cele 1000 de
unitati, o liniuta de 1000 il inghite intreg, si dezvaluirea era un **comutator** care aprindea tot
harnasamentul pe primul cadru in care `--w` trecea de zero. Tiparul e acum taiat la marimea unui
singur traseu: `86 914`, unde 86 e cel mai lung traseu existent in unitati `pathLength`.

Doua consecinte ies din aceeasi descoperire. Un front care merge spre interior nu poate fi scris ca
decalaj — un decalaj deseneaza un traseu doar dinspre propriul lui *prim* punct — asa ca aura
sosirii merge pe o a doua copie a conductoarelor, scrisa cap-coada (`#tbs-intro-di`, copil de
`<defs>`, gratuit la primul cadru). Iar cometa de asteptare, pe 14 trasee, era lipita de primele 26
de unitati ale fiecaruia si doar **palpaia** 2.6% din fiecare ciclu: singurul lucru care se misca
in cadrul la care se uita un vizitator pe toata durata incarcarii era un flash, de 14 ori deodata,
la fiecare 2.2 s. Taiata la un segment de 18 unitati pe o perioada de 86, e din nou o cometa, pe
fiecare conductor, iar pe die merge *spre* procesor.

Masurat la fel ca inainte — acelasi cadru fotografiat cu fiecare act fortat la zero si diferentiat
— sosirea contribuie acum cu **1.8 → 3.4% din cadru, in crestere**, pe toata durata ei. Inainte de
reparatie nu contribuia cu **absolut nimic intre 0.06 si 0.14**, adica mijlocul actului.

Primul cadru a trecut de la 39 la **40** obiecte de randare: inca un `<use>` al unui singur
`<path>`.

**Fisiere:** [`components/intro/IntroFallback.tsx`](./components/intro/IntroFallback.tsx) ·
[`components/intro/IntroPreloader.module.css`](./components/intro/IntroPreloader.module.css) ·
[`docs/05-page-sections.md`](./docs/05-page-sections.md#the-processors-three-acts-and-the-dash-bug-underneath-them-2026-09-24)

---

## 2026-09-24 — Added: patru scene in procesor, in loc de una

*„Ii perfect, dar de la inceput animatia cu procesor ii foarte scurta, mai adauga niste scene."*

Sectiunea procesorului — cu care se deschide filmul, si pe care desenul plat o deseneaza pe orice
dispozitiv — avea **720 ms si o singura miscare**: nucleele se aprindeau la 106 ms, fara niciun
cadru stabilit inaintea lor. Acum are **1052 ms si patru lucruri distincte**, iar scrub-ul a fost
reasezat la 0 → 0.34 (de la 0 → 0.26) ca sa incapa.

| scena | fereastra | durata | ce e |
| --- | --- | --- | --- |
| slotul | `--slot` [0.02, 0.16] | ~417 ms | peretii canionului, pragul soclului, buza puntii si condensatoarele urca impreuna, podeaua se lumineaza si adancitura se intuneca — cadrul se rezolva dintr-un cip pe un raft intr-un slot prelucrat |
| uncore-ul | `--blk` [0.10, 0.22] | ~368 ms | campul de blocuri se sterge de la stanga la dreapta: logica se trezeste inaintea nucleelor, ceea ce e si povestea corecta |
| nuclee, trasee, inel | [0.11, 0.32] | ~662 ms | reasezate pe spatiul facut de celelalte doua |
| curentul pleaca | `--heat` [0.26, 0.36] | ~331 ms | capsula din santul +x se aprinde si cadrul se dizolva pe ea — singurul obiect care supravietuieste taieturii CA EL INSUSI, fiindca `<Cavity/>` e purtat de ambele straturi |

Masurat inghetand `--fb-p` la fiecare granita si comparand cadrele: **fiecare scena difera de cea
dinainte cu 23–39% din cadru**. Nu o miscare tinuta mai mult, ci scene.

**Slotul se lumineaza PESTE constantele de azi, nu porneste sub ele.** `--fb-p` sta la 0 toata
incarcarea, deci cadrul la care se uita vizitatorul cat vine pagina trebuie sa fie cel care se
livreaza azi, nu o versiune mai stinsa a lui.

**Trei constante au trebuit re-rezolvate impreuna, si asta e partea fara niciun test.** Divizorul
`--z` al die-ului, fereastra `--z` a placii si constanta de scara a placii sunt un singur sistem:
invariantul scris chiar in foaia de stil e ca cele doua desene ale aceluiasi cip raman la cateva
procente unul de altul pe toata dizolvarea (azi maximul e 3,44%). Mutarea dizolvarii de la 0,26 la
0,34 il rupe daca nu se misca toate trei — propunerile primite il duceau la 10,9 / 15,1 / 15,3%,
si niciuna nu se uitase la el. `2.96` n-a fost niciodata ales: e `196/60 x scara die-ului pe
cadrul pe care se deschide dizolvarea`, deci pe alt cadru e alt numar. Rezolvat numeric: die
`/0.508`, placa `[0.34, +0.425]`, constanta **2.556** cu span **1.936** (acelasi capat 0,62).
Deriva maxima **2,97%**, mai bine decat azi, si aceeasi marime pana la a sasea zecimala pe cadrul
pe care se deschide.

Tabelul `--a` al undei de putere e derivat din aceeasi curba — fiecare piesa se aprinde cand
cutia ei incape in cadru — deci toate opt au fost re-derivate: 0.374, 0.554, 0.590, 0.598, 0.606,
0.614, 0.622, 0.630. Ultima e plina la **0,710**, exact unde placa incepe sa dispara; potrivirea
asta e ce a fixat dizolvarea la 0,34 si nu mai tarziu.

**`MAX_PRE_SPEND_MS` a scazut de la 1200 la 250, si numarul e acum portant.** Sectiunea
procesorului se termina la `--fb-p` 0.34; la 1200 ms curba e deja la 0,4164 cand directorul
deseneaza primul cadru, deci **tot procesorul** ar fi cheltuit inainte sa se deseneze ceva.

`MIN_SYNC_MS` 4200 → 4600 (+400 ms) si `HARD_CAP_MS` 5600 → 6000. Filmul creste cu mai putin de
jumatate de secunda; scena procesorului creste cu 46% si primeste patru batai in loc de una.

**Cheile camerei 3D au fost lasate in pace, deliberat.** Panza sta la `opacity: 0` pana cand scena
raporteaza gata, iar ponderile de pregatire plafoneaza bara la 0,60 fara ea — deci sectiunea
procesorului e desenata de SVG pe orice dispozitiv. Chei noi in canion ar fi fost munca pe care
n-o vede nimeni, pe singura cale unde o cheie in interiorul unei cutii filmeaza interiorul unui
perete.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `lib/intro.ts` · `components/intro/IntroPreloader.module.css` ·
`components/intro/IntroFallback.tsx` · `components/intro/IntroDirector.tsx` · `docs/05`.

---

## 2026-09-24 — Changed: intro-ul e mai lung si mai lin, fiindca nu se vedea

*„Fa intro sa fie mai lin, ii prea brusc si nu dovedesc sa vad animatiile."*

Duratele bataillor nu sunt scrise nicaieri — ies din doua numere, si acele doua numere faceau
filmul de neurmarit. `MIN_SYNC_MS` era 2400, iar progresul era limitat de `1 - (1 - x) ** 2.2`,
un ease-out destul de abrupt cat sa puna **47% din film in primul sfert de timp**:

| bataia | era | e acum |
| --- | --- | --- |
| 1 — cadrul tinut pe die | 281 ms | ~660 ms |
| 2 — pornirea, lumina prin nervuri, ventilator, radiator | **536 ms** | ~1170 ms |
| 3 — prin masinarie si in sus prin tastatura | 601 ms | ~1140 ms |
| 4 — deasupra puntii, intoarcerea spre masina | 982 ms | ~1230 ms |

Jumatate de secunda pentru toata pornirea. Acum `MIN_SYNC_MS` e 4200 si exponentul 1,6 (37% in
primul sfert). **Nu l-am aplatizat mai mult intentionat**: pantele din `FLIGHT_MAP` cresc de-a
lungul tabelului tocmai ca sa anuleze acest ease-out, deci o curba liniara ar face ultima bataie
— cea cu panta cea mai abrupta — cea mai rapida din film in loc de cea mai gratioasa.

**Finalul a fost lungit odata cu ele.** `DIVE_END` 0,66 → 1, eticheta „reveal" 0,72 → 1,15,
stingerea overlay-ului 0,55 → 0,7s, si tween-urile exploziei cu ele. La numerele vechi implozia,
explozia, scufundarea in ecran si predarea catre pagina se petreceau **toate in trei sferturi de
secunda** — asta era jumatatea „prea brusc" a aceleiasi reclamatii.

**Si incarcarea nu mai are voie sa manance filmul.** Ceasul cinematic curge de la navigare, ceea
ce e corect — vizitatorul se uita de la prima pictura. Nelimitat, e si o capcana: masurat pe un
randator software, hidratarea s-a terminat la 2,07s, deci directorul pornea cu curba deja la 64%
si bataia 2 rula **144 ms**. `MAX_PRE_SPEND_MS` (1200) limiteaza cat din film poate consuma o
sosire lenta; peste atat, originea ceasului aluneca inainte. O a doua limita tine promisiunea
inauntrul watchdog-ului, mutat 9000 → 10000 ca sa pastreze marja.

Remasurat pe acelasi randator lent, pe scalarul propriu al filmului (`--fb-p`), fara capturi de
ecran care sub SwiftShader sunt prea lente ca sa esantioneze ceva:
**bataia 2: 144 ms → 1010 ms. Bataia 3: 471 ms → 1238 ms.**

Butonul de sarire ramane neatins — filmul e mai lung, iar iesirea din el e la fel de aproape.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `lib/intro.ts` · `components/intro/IntroDirector.tsx` · `docs/05`.

---

## 2026-09-24 — Changed: panoul de propunere nu mai e un carton gri, e intunecat si aprins

*„Aici tot nu-mi place culoarea pe background."*

Panoul a fost pe rand aproape alb, apoi lavanda, apoi un gri-ardezie — si **un gri mediu, mare si
plat e cea mai neatragatoare valoare dintr-o interfata intunecata**: concureaza cu pretul si cu
butonul in loc sa le serveasca. Asa ca panoul inceteaza sa mai fie UMPLEREA cea mai luminoasa.
Acum e o adancitura in punte, iar identitatea i-o da lumina: o rama rosie aprinsa, un halou rosu,
o lumina care ii traverseaza muchia de sus, si pretul in alb la **16,58:1** pe el.

`--riser` `#333a52` → **`#151820`**, `--slot` `#0e1016` → **`#0d0f14`**.

**Intunecarea a imbunatatit tot ce se masoara**, inclusiv lucruri la care nu ma asteptam:

| | inainte | acum |
| --- | --- | --- |
| `--txt` pe panou (pretul) | 10,50:1 | **16,58:1** |
| `--on-ink-mut` (copy) | 6,06:1 | **9,56:1** |
| `--red-text` | 5,71:1 | **6,46:1** |
| `--red-lift` (rama, focus) | 3,57:1 | **5,63:1** |

Si identificarea campurilor s-a imbunatatit — asta e cea contraintuitiva. **Aceeasi** bordura
`--riser-line` masoara 1,55:1 pe panoul deschis si **2,45:1** pe cel intunecat, fiindca un panou
luminos isi spala propriile contururi. Am ridicat-o apoi la `#5a6176`, ceea ce o duce la 2,88:1
fata de panou si 3,11:1 fata de camp — contra 1,55:1 inainte.

Sina de sus, remasurata dupa schimbare: **14 pozitii distincte din 14 cadre**, adica nu repeta
nicio pozitie. Sub `prefers-reduced-motion` ambele lumini raporteaza `none`.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `app/globals.css` · `components/sections/Estimator.module.css` · `docs/05`.

---

## 2026-09-24 — Fixed: lumina se oprea la jumatatea sinei, si albastrul era prea albastru

*„Mai lucreaza cu culoarea asta albastra pe bacground si fulgerul franeaza uneori si se opreste."*

**Lumina chiar se oprea, si e un bug de aritmetica.** Sina o translatam cu
`calc(100% + 190px)` — dar un procent intr-un `translateX` e procent din ELEMENT, lat de 190px,
nu din sina de 1242px pe care trebuia sa o traverseze. Deci lumina parcurgea 380px si se oprea
moarta in mijlocul puntii pentru restul ciclului. Masurat cadru cu cadru, punctul ei cel mai
luminos statea la x=617 in **sapte esantioane consecutive**.

Acum elementul e cat toata sina si calatoreste FUNDALUL, unde `100%` inseamna „sina minus
imaginea": lumina intra pe la un capat si iese pe celalalt. Ajunge la x=1234 din 1242 si e gasita
in **11 pozitii distincte din 14 cadre**. Si nu mai are deloc faza de repaus — o lumina care sta
pe loc la jumatate nu se odihneste, e stricata.

**Inelul panoului franea din alt motiv, si a fost inlocuit.** Era un gradient conic care se rotea
in spatele unui cadru mascat de 1px, iar un gradient conic se roteste cu viteza UNGHIULARA
constanta. Pe un dreptunghi asta nu inseamna viteza de perimetru constanta: pe panoul de 477x564
lumina trecea cu circa **55% mai repede pe la colturi** decat pe la mijlocul unei laturi. Viteza
constanta e toata diferenta dintre o lumina si un defect, asa ca inelul a fost inlocuit cu aceeasi
sina dreapta pe care o are puntea — una peste muchia de sus a panoului, decalata cu 1,6s fata de
cealalta, ca ochiul sa aiba mereu exact un lucru de urmarit.

**Albastrul a fost coborat, la aceeasi luminanta.** La 50% saturatie suprafetele sunt destul de
mari ca sa se citeasca drept o lespede albastra pe o pagina aproape neagra. Puntea a coborat de la
**50% la 33%**, panoul de la **49% la 38%**, iar locasul de la 50% la 36% — fara sa pierd nimic:

| nivel | inainte | acum | separare |
| --- | --- | --- | --- |
| puntea | `#1b2236` | `#1f232e` | 1,24 → **1,25:1** peste pagina |
| panoul | `#2f3a5c` | `#333a52` | 1,42 → **1,40:1** peste punte |
| locasul | `#0d101a` | `#0e1016` | 1,70 → **1,69:1** sub panou |

Si fiecare pereche de text a tinut sau a castigat: `--red-text` pe punte 5,11 → **5,71:1**,
`--txt` pe panou 10,43 → **10,50:1**, bordura de focus 3,54 → **3,57:1**.

`@property --ring-angle` a fost sters odata cu inelul — nu mai avea cine sa-l foloseasca.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate, zero erori
in consola. Sub `prefers-reduced-motion` ambele lumini raporteaza `none`.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `app/globals.css` · `components/sections/Estimator.module.css` · `docs/05`.

---

## 2026-09-24 — Changed: culorile si animatiile sectiunii de cerere, revizuite

*„Mai revizuieste la animatii si la culori."*

Trei corecturi, toate pe defecte vizibile in randare.

**Banda care matura puntea a fost stearsa.** Peste negru aproape pur o banda de 7% alb se citeste
ca lumina; peste o suprafata care are propria valoare se citeste ca o **pata**. In cadru fix
jumatatea stanga a panoului era vizibil mai murdara decat dreapta. Construita si scoasa in aceeasi
zi — miscarea pe o suprafata luminata isi are locul pe MUCHII.

**Scara de material fusese dusa prea departe.** Rezolvasem fiecare treapta la 1,40:1 si am
depasit: puntea iesise un albastru-gri deschis, panoul lavanda, iar campurile negru pur din el se
citeau ca gauri perforate intr-un carton, nu ca locasuri taiate in el. Separarea e treaba MUCHIEI
la fel de mult ca a umplerii — puntea are bordura si umbra, deci nu-i trebuie un salt mare, iar
panoul si-l pastreaza pe al lui:

| nivel | jeton | inainte | acum | |
| --- | --- | --- | --- | --- |
| puntea | `--deck` | `#232b42` | `#1b2236` | 1,24:1 peste pagina, plus bordura si umbra |
| panoul | `--riser` | `#38436a` | `#2f3a5c` | 1,42:1 peste punte |
| locasul | `--slot` | `#0a0b10` | `#0d101a` | 1,70:1 sub panou — locas, nu gaura |

Si fiecare pereche de text a castigat: `--txt` pe panou 9,00 → **10,43:1**, bordura de focus
3,06 → **3,54:1**, copy-ul de sub pret 5,19 → **6,02:1**.

**Pastila selectata nu mai e noroi.** Prima data fusese `--txt`, aproape alb — de 38 de ori mai
luminoasa decat puntea. Reparatia a fost mai rea: umplutura puntii dusa 26% spre `--red-lift`, si
**a amesteca un accent cald INTR-un albastru-gri e reteta noroiului** — a iesit un maro-prune care
nu apartine niciunei palete de pe situl asta. Acum umplutura nu se mai misca deloc: pastila ramane
locasul care e, iar accentul sta unde ii e locul, pe MUCHIE — bordura la intensitate plina
(6,24:1), bara de 2px dedesubt, o licarire scurta in exterior, eticheta la 18,36:1. Nimic
amestecat, deci nimic noroios.

**Cele doua lumini care raman sunt mai ascutite.** Inelul panoului era un arc lat care lumina 40%
din perimetru odata si aluneca in jur ca o pata; acum e o cometa — cap ingust, coada in urma.
Sina de sus a trecut de la 1px la 2px si are un varf alb, ca sa se vada ca lumina, nu ca zgarietura.

Masurat pe pagina vie: inelul schimba pixeli in **8 din 8** cadre esantionate, iar punctul cel mai
luminos al sinei e gasit in **7 pozitii distincte din 14 cadre** inainte sa se parcheze pentru faza
de repaus. Sub `prefers-reduced-motion` ambele raporteaza `none`.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate, zero erori
in consola.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `app/globals.css` (`--deck` si `--riser` revizuite, `--slot` nou) ·
`components/sections/Estimator.module.css` · `components/sections/Estimator.tsx` · `docs/05`.

---

## 2026-09-24 — Changed: sectiunea de cerere e acum o consola luminata, si ceva se misca tot timpul

*„Mai gandestete si fa sa arate mai bine ca cam nu arata bine, adauga ceva animatii interesante."*

Prima incercare a adancit containerul: `.box` a mers pe `--bg2`, mai intunecat decat pagina, cu
piesele ridicate pe el. **Regula era buna si valorile nu, iar asta se masoara, nu se dezbate.**
Langa negru termenul `+ 0.05` din formula de contrast domina, deci scara a iesit la 1,02:1 de la
pagina la cutie, 1,02:1 de la cutie la un camp si 1,10:1 intre cele doua piese. Patru niveluri in
cod, unul pe ochi — si sectiunea se citea ca un singur camp de negru cu niste zgarieturi rosii pe
el. Exact asa a si fost primita.

Deci scara e **inversata si i s-au dat trepte adevarate**: cutia e acum obiectul LUMINAT si camera
din jur e cea intunecata — o consola intr-o incapere nelumiata. Trei suprafete in toata sectiunea,
niciuna in plus, si toate masurate pe pagina vie:

| nivel | jeton | valoare | masurat |
| --- | --- | --- | --- |
| camera | `--bg` | `#0a0b10` | pagina, si fiecare adancitura taiata inapoi in ea |
| puntea | `--deck` | `#232b42` | **1,400:1** peste camera |
| panoul | `--riser` | `#38436a` | **1,457:1** peste punte |
| locasul | `--bg` | `#0a0b10` | **2,040:1** sub panoul in care e taiat |

Pastilele si chatul sunt taiate inapoi in camera, deci stau si ele la 1,400:1 sub punte. Ultima
treapta — panou spre locas — e cea mai puternica separare disponibila in toata tema asta, si de
aceea adanciturile fac acum treaba la care containerul esuase.

**O masuratoare care a mutat markup-ul.** `--red-text` e 5,48:1 pe panoul vechi si **3,51:1 pe cel
luminat**, deci eticheta rosie nu mai poate sta acolo — si niciun panou destul de luminos ca sa se
separe de punte nu o poate purta (plafonul e L = 0,0349, adica 1,13:1 fata de punte). Eticheta a
iesit deci pe punte, la 5,11:1, si asa toate trei etichetele de regiune ajung pe acelasi fundal si
la aceeasi greutate.

**Indiciul de focus, si de el atarna toata schimbarea.** Conturul se deseneaza la `outline-offset`,
adica pe PANOU si nu pe camp, deci contrastul lui e inel-fata-de-panou si n-a fost niciodata
indiciul conform — masoara vreo 1,2:1. Ce satisfacea de fapt WCAG 1.4.11 era BORDURA de focus:
`--red` pe `--panel2` e 3,60:1. Luminarea panoului ar fi dus aceeasi bordura la 2,30:1 si ar fi
stricat pe tacute singurul indicator de focus conform pe care il are un formular de lead-uri.
`--red-lift` e reparatia, masurata pe fiecare suprafata pe care poate sta un camp: 4,46:1 pe
punte, 3,06:1 pe panou, 6,24:1 fata de propria umplutura a campului.

**Ce nu se opreste niciodata — si cat din asta se si vede.** O lumina traseaza toata muchia
panoului de pret la fiecare 5,2s, o banda lata si difuza traverseaza puntea la fiecare 9s, si o
lumina de 1px alearga pe muchia de sus a puntii la 7,2s.

**Prima varianta a fost invizibila, si asta se masoara.** Pusesem buclele intr-o linie de 1px pe
marginea de sus a unei cutii late de 1900px si intr-o licarire care respira in spatele unui panou.
Rezultatul cinstit: proprietarul s-a uitat si a spus ca nu vede nicio animatie. Avea dreptate — o
rafala de cadre comparate pixel cu pixel arata **0,02%** din cutie schimbandu-se intre ele, adica
exact cursorul care clipeste. Varianta de acum masoara **15,4%** din panou (inelul) si **10,4%**
din cutie (banda). Retinerea reglata dincolo de pragul vizibilitatii nu mai e retinere, e absenta.

**Si nu se opresc la focus, tot deliberat.** O varianta oprea fiecare bucla in clipa in care ceva
din cutie primea focus — deci cine apasa o pastila in prima secunda vedea o secunda de miscare si
un panou mort tot restul vizitei.

**Pastila selectata e o tasta aprinsa, nu o lespede alba.** Era `--txt`, aproape alb pur, ceea ce
o facea **de 38 de ori mai luminoasa decat puntea** si cel mai zgomotos obiect din sectiune dupa
butonul rosu — pentru o alegere care nu e nici pe departe cel mai important lucru de pe ecran.
Acum se aprinde in loc sa se inverseze: umplutura puntii dusa 26% spre `--red-lift`, bordura de
accent si bara de 2px de dedesubt. `--txt` pe ea da 10,4:1, sta la 1,93:1 peste o pastila stinsa
deci alegerea e limpede, iar bordura e 3,5:1.

**Doua capcane, ambele platite.** `@property --ring-angle` trebuie inregistrat la nivel de
DOCUMENT: o proprietate personalizata neinregistrata interpoleaza ca sir si pur si simplu sare la
capatul ciclului. Prima varianta o declarase in interiorul blocului `:root`, unde o regula-at e
invalida, Lightning CSS a eliminat-o in tacere, iar diferenta de pixeli a aratat sapte cadre
identice urmate de unul schimbat — exact cum arata un unghi care nu interpoleaza. Si
`docker compose up -d --build` **lasa containerul vechi sa ruleze cand build-ul esueaza**: o
eroare de parsare CSS a facut ca trei runde de „verificare" sa fie rulate pe o imagine veche.
De verificat ca build-ul a REUSIT, nu ca a pornit containerul.

**Pretul e eroul, si e tot cifra ta.** E dimensionat ca rasplata care e (`clamp(34px, 4.6vw, 52px)`,
`tabular-nums`), si nimic nu-l numara de la zero si nu-l animeaza ca sa apara. Nou e ca atunci cand
chiar SE SCHIMBA, panoul o marcheaza o data: componenta compara SIRUL randat, deci o re-randare sau
reapasarea aceleiasi pastile nu declanseaza nimic. Sclipirea alterneaza intre doua seturi identice
de cadre sub doua nume — o animatie CSS reporneste doar cand ii schimbi NUMELE, iar alternativa,
remontarea panoului, ar fi luat formularul cu ea si ar fi aruncat tot ce apucase vizitatorul sa
scrie. Verificat in browser: pretul a trecut 150 € → 450 €, panoul a sclipit, **iar textul deja
tastat in campul de nume era tot acolo.**

Sub `prefers-reduced-motion` sina raporteaza `none` si sta parcata dincolo de capatul ei, iar
respiratia raporteaza `none` la mijlocul propriului interval — deci ce ramane e panoul intreg,
luminat si nemiscat. Sub `forced-colors` cromul isi pierde imaginile de fundal, licarirea se
ascunde (aplatizata ar citi drept a doua bordura), iar selectia ramane un contur interior.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate, zero erori
in consola.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md).

Fisiere: `app/globals.css` (trei jetoane noi: `--deck`, `--riser`, `--riser-line`) ·
`components/sections/Estimator.module.css` · `components/sections/Estimator.tsx` · `docs/05`.

---

## 2026-09-24 — Changed: sectiunea de cerere a devenit un put de instrument

*„Aici poti sa faci ceva sa arate mai tehnologic cu animatii wow frumoase."*

Ce facea sectiunea sa arate a card de raft n-a fost niciodata miscarea — a fost **materialul**.
Patru niveluri imbricate purtau toate `background: var(--panel)`: cutia, chatul, fiecare pastila si
fiecare camp, despartite doar de o linie de 1px si de trei raze diferite, plutind pe o singura
umbra moale. Nimic din cutie nu avea rang, si nicio animatie nu repara asta.

Acum e o singura regula, pe care privitorul o citeste dintr-o privire fara sa i-o explice nimeni:
**containerul e o adancitura, tot ce sta in el e o piesa, si tot in ce scrii e iar o adancitura.**
Putul `.box` trece pe `--bg2` — mai intunecat decat pagina — piesele (`.chat`, `.result`, si
`.proposal` din dialog) pe `--panel` / `--panel2`, iar campurile pe `--bg`. Doua raze in toata
sectiunea in loc de trei, si **lumina adaugata in loc de umbra**, regula de peste tot de pe site.

**Gradientul albastru de 145° al panoului de propunere a disparut** — era cel mai invechit lucru
din fisier, si singura suprafata diferentiata, exact de asta restul se citea plat. In locul lui a
primit cromul de fereastra pe care il deseneaza deja paginile de directie: o muchie luminata de
1px care se stinge la capete si doua repere descendente, fiecare strat `no-repeat` cu o latura de
1px explicita, ca niciunul sa nu poata deveni vreodata o umplere. **Panoul din dialog a primit
acelasi tratament in acelasi commit**, ca pretul real al proprietarului sa nu apara pe doua panouri
care arata a produse diferite.

Cromul e vocabularul propriu al sitului, nimic inventat: perechea diagonala de colturi (patru
straturi de fundal, zero DOM), caroiajul estompat pe podeaua putului la jetonul si pasul sitului,
si o urma trasata dupa fiecare eticheta de regiune. Prima versiune a acelei urme se termina intr-un
nod patrat de 10px; pe ecran se citeau ca niste patratele plutind departe in dreapta etichetelor
lor, asa ca nodul a picat si linia a ramas.

**Ce se misca, si ce nu se misca niciodata.** O trecere de lumina strabate panoul terminat prima
oara cand ajungi la el — un observator de o singura data scrie `data-entered` si se dezaboneaza,
deci nu se reia la intoarcere — si apoi sectiunea sta. Selectia deseneaza o bara de 2px sub
pastila aleasa; cele patru controale se apasa cu 1px sub cursor; iar cat timp o cerere e realmente
in aer, o lumina strabate muchia de jos a butonului. **Pretul nu se animeaza niciodata**: e cifra
reala a proprietarului si nimic nu e legat de schimbarea ei.

**Doua defecte reparate in trecere.** Hover-ul si selectia erau O SINGURA declaratie, deci o
pastila peste care treceai era identica la pixel cu cea aleasa — cu cursorul in cutie nu puteai
spune ce ai ales. Sunt doua stari acum, iar selectia e marcata printr-o GROSIME, nu prin culoare
singura. Si cele cinci pastile de tip — primele opriri de Tab din sectiune — n-aveau niciun stil
de focus. Acum poarta si `aria-pressed`, deci starea e rostita, nu doar desenata.

**Trei capcane, toate masurate, nu deduse — si toate trei m-au prins pe mine:**

1. `globals.css` se termina cu `* { animation: none !important }`, iar `*` se potriveste cu
   ELEMENTE. Un pseudo-element nu e prins de ea, si `animation-name` nu se mosteneste — deci un
   `::before` sau `::after` animat trece nestingherit prin preferinta de miscare redusa. Masurat in
   ambele sensuri intr-un browser real: cu preferinta pornita, animatia elementului a iesit `none`,
   iar a pseudo-elementului si-a raportat propriul nume, inca ruland. Restul modulelor din repo isi
   numeau deja pseudo-elementele exact din motivul asta; acesta o face acum si el.
2. **Un media query nu adauga specificitate.** Garda trebuie sa se potriveasca cu regula pe care o
   anuleaza: `.box::after { animation: none }` in blocul reduce pierde in fata lui
   `.box[data-entered]::after`, si trecerea de lumina ruleaza mai departe. Ii trebuie si atributul.
3. **La culori fortate, selectia e un inel, nu o umplere.** Varianta evidenta —
   `background: Highlight; color: HighlightText` — facea eticheta pastilei sa dispara cu totul:
   Chromium deseneaza acolo un backplate in culoarea `Canvas` sub text ca sa garanteze contrastul,
   iar `HighlightText` in schema intunecata e negru, deci litere negre pe un backplate negru
   inauntrul unei pastile cyan. Fotografiat la 4x ca sa fiu sigur ca nu e artefact. Un contur
   interior de 2px nu schimba nicio asezare, lasa eticheta drept `CanvasText` obisnuit si spune
   totusi limpede ce pastila e aleasa. Separat, `var(--grad-red)` de pe cele doua butoane de trimis
   e o IMAGINE de fundal, pe care culorile fortate nu o suprascriu desi suprascriu culoarea
   etichetei — ambele trec pe `background-image: none` acolo.

Verificat in browser real: put `#06070b`, piese `#1f2639`, campuri `#0a0b10`; `aria-pressed`
corect pe toate noua pastile; bara de selectie `scaleX(1)` pe cea aleasa si `scaleX(0)` pe
celelalte; sub miscare redusa trecerea de lumina raporteaza `none` si dara de trimitere
`display: none`; la 390px nimic nu se taie; **nicio eroare in consola**.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md) (scara de material, cromul,
cele trei capcane) si [`docs/07-conventions.md`](./docs/07-conventions.md) (regula noua:
un pseudo-element animat se numeste singur in blocul reduce al modulului sau).

Fisiere: `components/sections/Estimator.module.css` · `components/sections/Estimator.tsx` ·
`docs/05` · `docs/07`.

## 2026-09-24 — Added: fiecare principiu are acum un semn propriu, acelasi pe toate trei

*„Adauga ceva, animatii interesante sau informatii ceva ai idee sau cu modele 3d ceva, gandestete
si propune." — apoi, pe prima incercare: „tie iti place ce ai facut? mie spre exemplu nu.
Corecteaza si fami ceva normal."*

Cele trei propozitii din „Cum lucram, pe scurt." erau cele mai abstracte de pe pagina si stateau
peste nimic. Acum fiecare cartela are **un desen mic in coltul din dreapta sus** — 38x38, acelasi
loc, aceeasi marime pe toate trei: straturi pentru `01` (o pagina e un singur plan, un produs e un
teanc de planuri), trei etape insiruite pentru `02`, un vizor in colturi pentru `03`. Apar o
singura data la intrarea in ecran, la 140ms distanta, si nu se mai misca niciodata.

**Faptul ca sunt LA FEL e tot designul, si asta e corectura.** Prima incercare a dat fiecarei
cartele alt instrument: un model 3D in CSS al procesorului propriu al sitului la `01`, o lista
legata cu cele trei etape reale citite din `lib/solutions.ts` la `02`, si o rama mare cu colturi
la `03`. Fiecare piesa se apara singura; randul, nu. Trei greutati vizuale diferite — iar rama
goala, a carei goliciune era chiar argumentul (singurul indicator pe care l-as fi putut pune
acolo era unul inventat), s-a citit ca un panou care nu s-a incarcat. A fost inlocuita, nu
reglata. Ce merita pastrat e motivul pentru care a cazut: **un argument pe care privitorul trebuie
sa fie invatat sa-l vada nu e un argument**, iar un rand de trei se citeste ca un rand doar cand
cele trei seamana.

**Desenate dupa regula casei pentru linie** (docs/07): trasee drepte, capete si imbinari patrate,
niciun cerc, niciun punct decorativ, nimic animat pe `stroke-dashoffset`. Grosimea conturului sta
in CSS cu `vector-effect: non-scaling-stroke`, deci acelasi desen pastreaza 2px oricat ar fi
scalata cutia, in loc sa fie fir de par pe o cartela si lespede pe alta.

**Niciun semn nu are voie sa arate vreo valoare** — nicio cifra, niciun procent, nicio axa, niciun
ac, nicio bara. Deasupra lui `03` scrie „Legam fiecare livrare de un indicator real", iar singurul
indicator pe care componenta l-ar putea desena acolo e unul inventat. Situl a platit deja o data
pentru asta: cartela de echipa a purtat „50+ proiecte", „98% clienti multumiti" si „24/7" pana
cand primul a fost prins contrazicand numarul real de proiecte din hero, si toate trei au fost
sterse in loc sa fie reghicite.

**Si `statusBars` a disparut din `lib/content.ts`.** Era mort — un singur rezultat la grep, propria
lui definitie — si tinea inca exact acei literali, la un fisier distanta de o sectiune despre
masurare.

**Semnele sunt mute**: `aria-hidden`, `focusable="false"`, fara `<title>`, fara text. Propozitia de
langa fiecare e afirmatia, iar semnul e doar afirmatia desenata — deci nu e nimic de tradus si
nimic care sa iasa din sincron cu campurile `{ ro, ru, en }`. Sub `prefers-reduced-motion`
declaratia de baza e deja poza finala (verificat: `animation-name: none`, opacitate si transformare
neatinse), iar sub `forced-colors` desenele raman — o linie supravietuieste aplatizarii la o
singura culoare de sistem — si se elibereaza doar opacitatea retinuta, care acolo s-ar citi ca un
glif spalacit.

Verificat in browser real: **trei semne, toate 38x38, toate la 25px de marginea cartelei**, acelasi
contur, niciun cerc, nicio eroare in consola.

**1613 teste in 75 de fisiere**, `tsc --noEmit`, `eslint .` si `npm run build` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md) (semnele, regula de linie si
de ce a cazut prima incercare) si [`docs/14-testing.md`](./docs/14-testing.md).

Fisiere: `components/sections/Principles.tsx` · `components/sections/Principles.module.css` ·
`components/__tests__/sections.test.tsx` · `lib/content.ts` (sters `statusBars` si tipul lui) ·
`docs/05` · `docs/14`.

---

## 2026-09-23 — Changed: holograma a intrat in cartela, in locul fotografiei — si nu se mai reincarca

*„Acum galografica asta trebuie sa fie in boxa ceea in loc de foto, si fa intrun fel animatia sa se
vada ca ii galografica, sa aiba niste intreruperi, pixeli uneori. Si el la fiecare 5s se reincarca,
scoate asta."*

Fotografia din cartela e acum PROIECTATA, nu tiparita: e decupat de pe fundalul lui, pictat in
cyan-ul sitului, asezat sub linii de scanare, maturat de un fascicul si rupt de doua ori pe ciclu.
Tot din CSS si un singur filtru SVG.

**Proiectia WebGL de deasupra caruselului a disparut**, iar motivul e de pastrat: cartela e
`background: var(--panel)`, iar panza scenei deseneaza IN SPATELE paginii. O holograma inauntrul
cartelei ar fi cerut o gaura taiata printr-un panou opac — s-ar fi desfacut la `:hover`-ul propriu
al cartelei, iar sub 861px, unde scena nici nu porneste, ar fi aratat pagina in loc de cartela.
Asa merge la orice latime, pe orice randare, fara panza si fara al doilea context GL. Familia de
puncte si cea de suprafete din `materials.ts` s-au intors **identice cu originalul**.

**Filtrul e aritmetica, nu gust.** Randul de alfa al matricei sunt coeficientii de luminanta, deci
alfa iese ca propria lui luminozitate; transferul de dedesubt o pragheaza intr-o silueta — tine 1
pana la 0,90 si cade la 0 la 1,0, fiindca fundalul pe care a fost fotografiat masoara **exact
1,000**, iar haina lui culmineaza la 0,904 si camasa la 0,895. Randurile de culoare sunt aceiasi
coeficienti scalati cu canalele reale ale lui `--dark-cyan` si un castig de 1,05 — la 1,3 canalul
albastru trecea de 1 si se taia, ceea ce facea toata jumatatea lui de jos alb spalacit in loc de
cyan. Si `color-interpolation-filters="sRGB"` nu e decor: pragurile alea au fost masurate in sRGB,
iar implicitul SVG e linearRGB, care ar aseza cheia cu totul in alta parte.

**Liniile de scanare sunt o MASCA, si asta e tot trucul.** O masca inmulteste alfa, deci liniile
cad pe EL si niciodata pe spatiul gol din care a fost decupat; o suprapunere ar fi dungat panoul
cartelei in jurul lui. Din acelasi motiv fasciculul si banda rupta sunt alte COPII ale fotografiei,
nu gradiente asezate peste cutie — un gradient care matura toata cutia se citeste ca o lespede gri
traversand cartela, exact cum a aratat prima incercare.

**Ce se rupe, si ce nu are voie sa se intample.** De doua ori pe ciclu rasterul cade pe o masca
grosolana si o banda din el se smulge lateral, pe timpi in trepte care nu au factor comun, deci
bucla nu se anunta niciodata. **Iar reincarcarea a disparut**: proiectia din scena se re-scana o
data pe bucla, si ai citit-o — corect — ca imaginea care se reincarca. O proiectie care se
reasambleaza singura e singurul lucru care nu trebuie sa se vada aici.

**Nimeni nu pierde poza.** Fotografia e tot fotografia si poarta tot `alt`-ul; tot ce e holografic
e un filtru, o masca si doua defectiuni asezate peste acelasi `<img>`. Un cititor de ecran, un
crawler si un browser fara suport pentru filtru primesc exact ce primeau inainte. Sub
`prefers-reduced-motion` tine un singur cadru curat — decupat, colorat, cu linii si perfect
nemiscat — iar sub `forced-colors` filtrul se ia cu totul, fiindca acolo s-ar aplatiza intr-o
lespede cyan peste fata lui, si fotografia simpla e mai de folos decat atat.

Suita completa, **1609 teste in 75 de fisiere**, `eslint .` si `tsc --noEmit` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md) (filtrul, masca, defectiunile
si de ce nu putea fi WebGL), [`docs/03-architecture.md`](./docs/03-architecture.md) (stadiul acopera
iar patru sectiuni) si [`docs/14-testing.md`](./docs/14-testing.md).

Fisiere: `components/sections/Team.tsx` · `components/sections/Team.module.css` ·
`components/__tests__/sections.test.tsx` · si retragerea proiectiei WebGL din
`components/scene/three/materials.ts`, `hologram.ts`, `models/teamLead.ts` (sters), `world.ts`,
`choreography.ts`, `tiers.ts`, `scrollProbe.ts`, `SceneWorld.tsx`, `lib/scene.ts`,
`app/(site)/page.tsx` · `docs/03` · `docs/05` · `docs/14`.

---

## 2026-09-23 — Changed: proiectia Team Lead-ului e plata, holografica si nemiscata — si seamana cu el

*„Nu seamana deloc. Scoate ochii ca arata urat. Fa mai bine sa nu fie 3D, fa sa fie doar holografic
si fara sa se roteasca."*

Norul de puncte, volumul, gatul articulat, ochii si leaganul s-au dus, toate. In locul lor: **un
singur plan intors spre privitor**, desenat de un al cincilea mod in familia de suprafete care
exista deja (`SURFACE_MODE.portrait`), care citeste portretul o data pe fiecare PIXEL.

**Si avea dreptate — am masurat.** Randarea e capturata prin CDP, redusa la un camp de luminanta
peste propria ei cutie si corelata cu acelasi camp luat din fotografie. Numerele:

| | r |
|---|---|
| o copie colorata a pozei (ideal) | 0,92 |
| **norul de puncte de care s-a plans** | **0,01** |
| o silueta goala, fara tonuri inauntru | ~0,00 |
| **proiectia plata de acum** | **0,69** |
| plafonul real al conductei (aceeasi cheie si tonuri, aceleasi redimensionari) | 0,82 |

Norul de puncte era **statistic identic cu o silueta goala**. Nu purta nimic din chipul lui, iar
motivul e aritmetic: un chip aratat la ~320 × 430 css px are, intr-un asemenea nor, cam un punct la
doi pixeli — recunoasterea nu supravietuieste asa ceva, oricat as fi reglat.

**Trei lucruri pe care masuratoarea le-a gasit si pe care nicio reglare din ochi nu le-ar fi gasit:**

1. **Textura era de trei ori prea mica.** Plafonata la 216 × 288, in timp ce poza se arata la
   640 × 860 pixeli fizici — fiecare pixel al fetei lui era o marire. E 456 × 608 acum, iar activul
   a fost reexportat la rezolutia lui nativa, 708 × 944.
2. **Campul bustului ii taia haina.** O pereche de elipse pictate in canalul verde, folosite intai
   ca multiplicator si apoi ca masca; ca masca **scotea colturile de jos ale hainei**, fiindca
   partea cea mai lata a lui, pe randul lui cel mai lat, cade in afara elipsei. Masurat pe regiuni:
   capul 0,84, torsul **0,24** — si toata prapastia aia era marginea elipsei. Campul a disparut:
   luminozitatea lui singura, cheiata pe un fundal care masoara exact 1,000, e o silueta completa.
3. **Orice taie plafonul e un ton aruncat.** Jumatate din el traieste intr-o banda tonala de 0,1
   latime (haina 0,72, camasa 0,78), deci un castig care impingea varful peste plafon aplatiza
   aproape tot torsul intr-o singura culoare.

**Ce a ramas holografic**, fiindca asta ai cerut: silueta cheiata, luminozitatea lui purtata in
lumina, o rama trasata pe conturul lui (din patru citiri ale cheii, nu din elipse — o rama scoasa
din elipse lucea intr-un inel care nu-l urma), linii de scanare, palpaire fina, granulatie, sosirea
care urca de pe pastila proiectorului cu o creasta fierbinte pe front, si ruptura. **Nu se misca
nimic in afara de lumina.**

**Costa mult mai putin decat ce a inlocuit.** Doua apeluri de desenare — planul si rampa — fata de
un desen de 40.000 de varfuri plus aceeasi rampa, si **nicio citire de textura in shaderul de
varfuri**, deci nu mai cere nimic ce un shader de fragmente nu poate face. Familia de puncte s-a
intors **identica cu originalul** (47 de linii adaugate in `materials.ts`, 3 schimbate): modul
`figure`, uniformele lui si ramura de rig au disparut cu totul.

**Aceeasi capcana, a doua oara, si acum e notata in doua locuri:** ramura hologramei din Work era
un `else` fara garda, deci modul 5 s-ar fi desenat ca ea. E inchisa ca `} else if (uMode < 4.5) {`,
si un test o fixeaza.

**Ce nu s-a schimbat:** cartela de alaturi ramane raspunsul intreg sub 861px, fara WebGL, sub
`forced-colors`, sub `prefers-reduced-motion` si cat timp stadiul decide. Blocul e `aria-hidden`,
fara nimic focusabil. Sursa e tot un activ pachetat, niciodata un upload, din motivele din
`docs/11` — si acum si fiindca silueta se cheiaza pe un fundal deschis.

Suita completa, **1638 de teste in 76 de fisiere**, `eslint .` si `tsc --noEmit` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md) (sectiunea, masuratoarea si
cele trei descoperiri), [`docs/11-security.md`](./docs/11-security.md) (pe panza e acum doar
luminozitatea lui; canalul verde a disparut) si [`docs/14-testing.md`](./docs/14-testing.md).

Fisiere: `components/scene/three/materials.ts` · `components/scene/three/models/teamLead.ts` ·
`components/scene/three/hologram.ts` · `components/scene/choreography.ts` ·
`components/scene/tiers.ts` · `components/scene/three/world.ts` · `components/scene/SceneWorld.tsx` ·
`public/team/maxim.webp` · `components/__tests__/*` · `docs/05` · `docs/11` · `docs/14`.

---

## 2026-09-23 — Changed: proiectia se citeste ca un chip, misca din cap si din ochi

*„Acum nu se intelege, si fa chiar sa fie 3D model si sa poata sa miste din cap sau din ochi."*

**De ce nu se intelegea, si nu era lipsa de date.** Era SATURATIE. Punctele se amesteca ADITIV,
sprite-ul acoperea doua celule si jumatate de retea, deci vreo doua puncte si jumatate cadeau pe
fiecare pixel; suma trecea de 1, `sceneOutput` taia, si orice ton deasupra pragului devenea acelasi
cyan plat. Fata lui era acolo tot timpul — o stergea lumina.

Am incetat sa ghicesc si am **masurat cadrul randat**: corpul ajungea la 0,675 din maxim cu p50 la
0,188 la o setare si tot ce e fata se lipea la 1,0 la alta. Reglat pe numere, corpul urca acum la
0,882 fara sa taie, iar singurii pixeli la plafon sunt ochii lui.

Plus doua lucruri care fac trasaturile sa iasa:

- **Masca de accentuare, din fotografia insasi.** Patru citiri la cativa texeli distanta dau media
  locala; luminozitatea minus media aia e DETALIUL — orbitele, sira nasului, linia barbii, marginea
  gulerului. O fata de marimea asta are cateva zeci de puncte latime, si fara sa scoti detaliul din
  tonul general tot capul se citeste ca o singura textura uniforma.
- **Podeaua umbrelor, ridicata.** La contrastul propriu al fotografiei, parul lui (0,11) cadea in
  fundal. O fata fara par nu e mai fidela, e mai putin lizibila.

**Si acum chiar se misca.**

**Gatul e articulat.** Tot ce e deasupra gatului primeste propria rotatie — inclinare, intoarcere si
aplecare — in jurul unui pivot la baza gatului. Greutatea e 0 sub linia umerilor (masurata la v
0,594) si 1 deasupra barbiei (0,667), cu trecere lina intre ele, deci o inclinare a capului misca
maxilarul si nu gulerul. Cele trei rotatii merg pe perioade care nu au factor comun nici intre ele,
nici cu ale corpului, deci miscarea nu se aseaza niciodata intr-un ciclu pe care sa-l poti numi. Si
sunt MICI: o proiectie care isi leagana capul se citeste ca o papusa; una care se muta cu cateva
grade in timp ce sta acolo se citeste ca un om care sta nemiscat.

**Ochii sunt un lucru separat.** Pozitiile sunt MASURATE, nu puse: perechea cea mai intunecata si
simetrica din banda fetei a iesit la v 0,222, x 0,537 si 0,625, iar desenand cele doua semne inapoi
pe fotografie au cazut fix pe pupilele lui. Poarta propria directie de privire, deci se poate uita
in jur fara sa miste capul. **Tin si apoi SAR** — o sacada dureaza sub o cincime de secunda, iar
interpolarea lina intre doua puncte la care se uita cineva e exact ce se citeste ca papusa. Clipesc,
cu pleoapa care cade mai repede decat se ridica. Si se deschid abia dupa ce figura s-a asezat — ultima
bataie a sosirii, si cea care transforma o statuie luminata in cineva care se uita inapoi la tine.

**Treapta `lite` a devenit mai destepta.** Tamponul retelei e acum SORTAT dupa hash-ul din care
shaderul alege populatia unui punct, deci populatiile sunt blocuri continue — ochii primii, apoi
suprafata din fata, apoi spatele, apoi mijlocul — iar taietura cade la inceputul cochiliei din
spate, **numarata exact, nu presupusa** (`Math.round(count * share)` pare acelasi numar si nu e:
un hash e uniform doar in medie). Deci un GPU care se chinuie pierde VOLUMUL si pastreaza fata
intreaga. O taiere uniforma la jumatate, care e regula roiului, ar subtia fata — singurul lucru de
pe obiectul asta care nu-si permite asta.

Reteaua a crescut la **177 × 227** (40.179 de puncte, tot un singur draw call).

**O capcana in care am cazut si e notata:** am numit un camp `snap:` in tabelul privirii, iar
`scene-contract.test.ts` citeste orice `snap:` de sub components/scene ca fiind al lui
ScrollTrigger — interzis in stadiul interior. Numele e tot ce are testul dupa ce sa se ghideze. Se
numeste `flick` acum, si comentariul spune de ce.

**Verificat prin CDP pe build-ul care ruleaza, prin masuratoare, nu din ochi.** Cu corpul complet
oprit: centroidul benzii umerilor s-a mutat 2px (zgomot), al benzii capului **128px** — deci gatul
se articuleaza si umerii stau. Ochii se misca 84px fata de cap. Histograma cadrului confirma gama
tonala. Suita completa, **1657 de teste in 76 de fisiere** (+13), `eslint .` si `tsc --noEmit`
curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md),
[`docs/11-security.md`](./docs/11-security.md) (nimic nou nu se citeste de pe el — pozitiile
ochilor sunt trei numere in cod, iar masca foloseste textura care oricum era esantionata) si
[`docs/14-testing.md`](./docs/14-testing.md).

Fisiere: `components/scene/three/materials.ts` · `components/scene/three/models/teamLead.ts` ·
`components/scene/choreography.ts` · `components/scene/three/hologram.ts` ·
`components/scene/tiers.ts` · `components/__tests__/scene-team-lead.test.ts` · `docs/05` ·
`docs/11` · `docs/14`.

---

## 2026-09-23 — Changed: proiectia Team Lead-ului e un corp inchis, nu un relief

*„Sa aiba 3D model si in spate si prin parti, ca sa aiba silueta unui om din orice parte."*

Avea dreptate: era un RELIEF — o singura suprafata intoarsa spre privitor. Din lateral ar fi fost o
foaie. Acum e un corp.

**Trei populatii, nu una.** 62% din celulele retelei stau pe suprafata din FATA, 26% pe cea din
SPATE si 12% sunt raspandite prin mijloc. Fiindca adancimea fiecareia e campul bustului, iar campul
cade la zero exact acolo unde se termina silueta, **corpul se inchide singur**: nu exista margine
deschisa prin care sa se vada inauntru, iar din spate are propria lui silueta, fara fata imprimata
prin el. Fiecare rand e o elipsa — radacina patrata a unui camp aproape parabolic e un cerc — deci
din profil are adancimea unui piept, nu grosimea unei coli.

Reteaua a crescut de la 141 × 181 la **177 × 227** (40.179 de puncte, tot un singur draw call):
38% din ele pleaca de pe fata, deci numarul trebuia sa poarte o fata la densitate intreaga PLUS un
spate. Si leaganul s-a largit de la ±3,4° la ±35°: un volum pe care nimeni nu-l vede din jur e doar
un relief scump. Fata lui tot nu paraseste niciodata privitorul — de aceea e leagan, nu rotatie.

**Trei lucruri le-am gresit si le-am gasit fotografiind modelul din 45 in 45 de grade:**

1. **Doua cochilii goale, vazute din lateral, sunt doua foi** — citeau ca o pereche de urechi peste
   un ou. De aceea exista acum si populatia din mijloc.
2. **Elipsele campului erau mai late decat silueta masurata.** Campul E adancimea, deci o elipsa mai
   lata decat corpul face partea aceea mai adanca decat e de lata: capul iesea cu o treime prea
   mare. Re-masurat pe activul livrat — capul se intinde de la v 0,080 la 0,403 in jurul lui x
   0,563, umerii se rup la 0,406, torsul ajunge la semi-latime 0,380 — si elipsele urmeaza acum
   numerele alea.
3. **`HOLO_DEPTH` era 0,34, cu ~30% prea mult**, si nimic nu-l putea contrazice cat timp figura era
   un relief. In clipa in care corpul s-a inchis, facea pieptul aproape la fel de adanc pe cat era
   de lat. E 0,27 acum, si e un raport ANATOMIC: torsul masoara 0,57 unitati semi-latime, un piept
   e cam 45% din latimea lui in adancime, campul culmineaza la 0,88 a carui radacina e 0,94.
4. **Centrul elipsei torsului era pe mijlocul siluetei**, deci partea cea mai adanca ieseau
   abdomenul — o popica. Pe un bust, cel mai adanc loc e pieptul si umerii; elipsa urca la 0,66.

**Si un echilibru pe care l-am nimerit din a doua.** Cu 48/30/22 spatele si mijlocul, care se adauga
peste tot unde deseneaza fata, **i-au spalat chipul** — capul redevenise o bila. 62/26/12, si
stralucirea lor tinuta mult sub a fetei, il aduc inapoi fara sa piarda volumul.

**Ce NU poate face, si de ce.** O singura fotografie frontala nu contine niciun profil: nu exista
nas, barbie sau panta de umar in date. La 90° adevarate e un bust plauzibil, nu unul recognoscibil.
E o limita a intrarii, nu a modelului. **O a doua fotografie, din profil, ar permite ca adancimea sa
fie luata din masuratoare in loc de dintr-o bombare presupusa** — atunci ar fi el din orice parte, nu
doar un om din orice parte.

**Verificat prin CDP** pe build-ul care ruleaza, rotind temporar modelul complet si fotografiindu-l
din 45 in 45 de grade, apoi la leaganul real de ±35°. Suita completa, **1644 de teste in 76 de
fisiere** (+4), `eslint .` si `tsc --noEmit` curate.

Documentat in [`docs/05-page-sections.md`](./docs/05-page-sections.md) (corpul si limita lui) si
[`docs/11-security.md`](./docs/11-security.md) (numarul de puncte).

Fisiere: `components/scene/three/materials.ts` · `components/scene/three/hologram.ts` ·
`components/scene/three/models/teamLead.ts` · `components/scene/tiers.ts` ·
`components/__tests__/scene-team-lead.test.ts` · `docs/05` · `docs/11` · `docs/14`.

---

## 2026-09-23 — Added: Team Lead-ul apare ca proiectie holografica in sectiunea Echipa

*„Un model 3D holografic al Team Lead-ului nostru, care sa apara printr-o animatie cinematica de tip
glitch/holograma."*

Deasupra caruselului cu echipa, pe ecran de cel putin 861px si cu scena WebGL vie, un bloc gol
(`[data-scene-anchor="lead"]`) rezerva locul in care sta o figura holografica a lui Maxim. O
deseneaza pânza scenei interioare — de aceea Principles si Team sunt acum INAUNTRUL lui
`<SceneStage>`.

**Ce este de fapt.** O retea de puncte — 141 × 181 pe nivelul inalt, un singur draw call — in care
FIECARE celula citeste portretul in SHADERUL DE VARFURI si se aseaza din ce gaseste acolo. Rosul
poarta luminozitatea lui, verdele campul bustului, deci o singura citire ii spune unui punct tot:
daca exista, cat de in fata sta si cat de aproape de contur e. Nu e o fotografie agatata pe un plan:
nu exista piele si nu exista suprafata, doar lumina acolo unde e el. Un nor de puncte nu poate fi
straniu — e facut din aceeasi lumina ca tot restul paginii.

**Nu compileaza niciun program nou.** Capul lui `materials.ts` declara cinci programe ca invariant;
asta e un MOD in plus in familia de puncte (`POINTS_MODE.figure`) si refoloseste nemodificat modul
`synapse` al familiei de linii pentru rampa proiectorului. **Adaugarea a cerut inchiderea unui
`else` fara garda:** `pulses` era ramura finala goala, deci modul 4 s-ar fi desenat tacut ca niste
capete de impuls sinaptic. E notat in `docs/07` ca un `else` gol e o capcana, nu o valoare implicita.

**Sosirea, in 3,6 secunde.** Rampa se aprinde bara cu bara, cu o cometa alergand pe ea; figura se
construieste de jos in sus, punctele curg din pastila la locul lor, o schela rara alerga cu o optime
de inaltime inaintea umpluturii dense, iar o creasta fierbinte calatoreste pe front. Se rupe de doua
ori pe drum — o data peste umeri, o data peste fata — si se aseaza. Apoi respira umflandu-si propriul
relief, se roteste incet pe o perioada pe care n-o imparte cu nimic din scena, se bâlbâie o data la
fiecare bucla de 6,9s, iar o data pe bucla proiectorul il re-scaneaza de la picioare.

Totul e CRONOMETRAT, niciodata legat de derulare: fiecare bataie e o functie pura de secunde in
`choreography.ts`, fixata ca tabel in teste, deci o derulare rapida nu poate lasa pe ecran un om pe
jumatate construit. Iesirea din sectiune retrage proiectorul; intoarcerea joaca o sosire proaspata.

**Trei lucruri pe care le-am gresit intai si le-am gasit uitandu-ma la build-ul care ruleaza:**

1. Nu se desena nimic, desi modelul era construit, armat si cu uniformele corecte. Fiecare model din
   scena isi seteaza singur `group.visible = frame.reveal > 0 || frame.prewarm` ca PRIMA linie din
   `update` — conventia casei, pe care al meu n-o respecta.
2. `easeOutCubic` ducea frontul la creastet pana pe la 2,0s, deci a doua sclipire cadea pe o figura
   deja terminata. Curba e acum `holoEase`, care calatoreste uniform, iar sclipirile sunt asezate
   unde e fata de fapt sub ea.
3. Figura citea ca o silueta plata: luminozitatea lui nu ajungea deloc in stralucirea punctelor.
   Acum o poarta (`shade`), si asa se intorc ochii, barba si gulerul.

**Fotografia e un activ pachetat, niciodata un upload**, si motivul e in `docs/11`: un upload se
rezolva prin `mediaUrl` la originea API-ului, care intr-o instalare cu origini separate e
cross-origin, iar `usableImage` il refuza — ar murdari pânza si ar arunca SecurityError la incarcarea
in WebGL. `Team.tsx` marcheaza drept sursa doar un membru a carui poza incepe cu `/team/`.

**Un efect secundar care repara o cartela.** Un membru fara poza proprie primeste acum poza pachetata,
potrivita dupa id (`withBundledPhotos`). E o completare de CAMP, nu o fuziune pe chei: citeste doar
lista salvata, deci un membru sters ramane sters. Inainte, un activ livrat era umbrit de un sir gol
salvat si cartela cadea pe initiala colorata — de asta Maxim aparea ca „M" desi fisierul exista.

**Ce primeste un vizitator fara toate astea.** Cartela de alaturi e neatinsa — aceeasi poza, acelasi
nume, acelasi rol — si e raspunsul intreg sub 861px, fara WebGL, sub `forced-colors`, sub
`prefers-reduced-motion` si cat timp stadiul inca decide. Gazda e `display: none` in toate, deci nu
ramane un gol. Blocul e `aria-hidden` si nu contine nimic focusabil; `<img alt>` al cartelei ramane
singura descriere a chipului lui pe pagina.

**Securitate:** aceeasi conducta Canvas2D → `CanvasTexture` ca holograma din Work, cu aceeasi sonda de
un pixel si aceleasi reguli. Portretul are PROPRIUL plafon (`PORTRAIT_MAX`, 216 × 288) si cele doua
constante nu trebuie unite niciodata: 384 × 240 exista ca sa faca ilizibil scrisul marunt dintr-o
captura de proiect, iar pe portret nu se deseneaza niciun cuvant, niciun chip si niciun indice — un
test verifica asta. Documentat in [`docs/11-security.md`](./docs/11-security.md).

**De semnalat, si nu e o intrebare tehnica:** e singura imagine de pe sit care randeaza un om real ca
proiectie semi-transparenta care se bâlbâie. Daca Maxim nu e de acord, stergerea lui
`public/team/maxim.webp` si a celui de-al treilea argument din `member(…)` opreste tot: predicatul nu
se mai potriveste, gazda nu se mai randeaza, sonda nu masoara nimic si modelul nu se mai construieste.

**Verificat prin CDP pe build-ul care ruleaza**, la 1600 × 1000: gazda masurata 1280 × 540, scena
`webgl`, un singur context, zero erori in consola, sosirea fotografiata bataie cu bataie (rampa
aprinsa + constructie partiala, apoi figura asezata). Suita completa, **1640 de teste in 76 de
fisiere** (+35), `eslint .` si `tsc --noEmit` curate.

Documentat in [`docs/03-architecture.md`](./docs/03-architecture.md) (scena acopera sase sectiuni,
ancora `lead`, campul din sonda), [`docs/05-page-sections.md`](./docs/05-page-sections.md) (sectiunea
era DEJA invechita — descria un panou `SYSTEM_STATUS`, biografii si legaturi sociale pe care
componenta nu le randeaza; corectata aici), [`docs/07-conventions.md`](./docs/07-conventions.md) si
[`docs/14-testing.md`](./docs/14-testing.md).

Fisiere: `public/team/maxim.webp` · `components/scene/three/models/teamLead.ts` ·
`components/scene/three/materials.ts` · `components/scene/three/hologram.ts` ·
`components/scene/three/world.ts` · `components/scene/choreography.ts` ·
`components/scene/scrollProbe.ts` · `components/scene/tiers.ts` · `components/scene/SceneWorld.tsx` ·
`components/sections/Team.tsx` · `Team.module.css` · `app/(site)/page.tsx` · `lib/scene.ts` ·
`lib/content.ts` · `lib/siteContent.tsx` · `next.config.ts` · `components/__tests__/*`.

---

## 2026-09-23 — Changed: procesorul de pe ecranul de incarcare are volum, pini, trasee si siliciu aprins

*„Deseneaza un model 3D wow detaliat."*

Placile plate citeau ca hartie stivuita. Fiecare strat e acum o **cutie reala** — capac plus patru
pereti la grosimea lui adevarata — si asta e toata diferenta: peretii prind rotatia, o latura
luminata si una intunecata, deci desfacerea citeste ca adancime, nu ca scalare. Fetele de jos nu se
construiesc niciodata; camera e deasupra inclinarii si nu le-ar vedea. Grosimea e exagerata de 2,6
ori, cum o exagereaza orice desen tehnic — la scara adevarata un substrat de 0,08 are sub jumatate
de pixel de perete si obiectul redevine hartie. Proportiile dintre straturi raman ale modelului.

**Ce s-a adaugat, tot din `CHIP` (`components/scene/shapes.ts`), nimic inventat:**

- **pini pe pereti**, unde sunt pinii de fapt, la pasul `CHIP.pinGap` si oprindu-se inainte de
  colturi la `CHIP.pinSpan` — exact ca ale modelului;
- **trasee rutate** care ies de sub pachet spre marginile placii, cotite la 90° si 45° cum merge
  rutarea pe o placa, cu **plachete patrate de trecere** in fiecare cot;
- **patru condensatoare** pe capacul substratului, cate unul pe cadran — ascunse sub capac cand
  stiva e stransa, descoperite pe masura ce se desface, deci explozia chiar arata ceva;
- **capacul metalic** cu rama frezata trecuta in trepte, pentru ca e partea dupa care recunosti un
  procesor si inainte era inca un geam;
- **matrita aprinsa**: siliciu plin cu centrul incins si grila de 3×2 nuclee pe el, nu un contur.

**Doua lucruri invatate pe drum, notate ca sa nu se repete.** Traseele se traseaza de **doua** ori —
o data plin si palid, ca placa sa citeasca mereu ca rutata, apoi inca o data ca o liniuta scurta si
aprinsa care calatoreste pe acelasi drum. Doar liniuta, cum era prima oara, lasa niste scame
imprastiate care arata a murdarie, nu a trasee. Si `vector-effect: non-scaling-stroke` e obligatoriu:
fara el, 1,5 unitati de contur intr-un `viewBox` de 100 ajung sub un pixel.

Restul e neschimbat: nu e WebGL (fix atunci chunk-ul scenei si shaderele detin firul principal),
doar transform si opacity, rotatie de 8s peste o respiratie de 3,4s care nu se impart una la alta.
Sub `prefers-reduced-motion` ramane poza compusa; sub `forced-colors` se ascunde, pentru ca acolo
toate suprafetele astea devin o singura umplutura si obiectul se face un ghemotoc gri. 61 de
elemente, fata de 17.

**Verificat pe build-ul care ruleaza**, prin CDP, in ambele poze ale respiratiei: stransa, se
citeste fara dubiu ca procesor pe placa; desfacuta, matrita se ridica aprinsa pe axa. Suita
completa, **1605 teste in 75 de fisiere**, `eslint .` si `tsc --noEmit` curate.

Documentat in [`docs/03-architecture.md`](./docs/03-architecture.md) — sectiunea „The full-window
cover, and the object on it", care lipsea cu totul si descrie acum si acoperirea, si obiectul.

Fisiere: `components/ui/BootCore.tsx` · `components/ui/BootCore.module.css` ·
`docs/03-architecture.md`.

---

## 2026-09-23 — Changed: ecranul de incarcare arata procesorul sitului, in vedere explodata, rotindu-se

Marca plata din mijlocul acoperirii a fost inlocuita cu `components/ui/BootCore.tsx`.

**Nu e o forma inventata.** E `CHIP` din `components/scene/shapes.ts` — obiectul pe care il
deseneaza eroul si din care zboara camera in intro: placa la 2,3, pachetul la 1,0 cu randurile lui
de pini, capacul la 0,68, matrita la 0,34. Stiva se desface si se strange la loc, iar gestul ala e
tot al scenei: `coreExitPose` numeste `lift`-ul chiar „exploded view". Deci asteptarea e deja in
interiorul sitului, nu un spinner imprumutat.

**3D REAL, in CSS.** `perspective` pe scena, `preserve-3d` pe ansamblu, patru placi la adancimi
reale — deci se ocluzioneaza intre ele si desfacerea citeste ca adancime, nu ca scalare. Sub ele
amprenta punctata pe care stau toate modelele de pe sit, peste ele axa de asamblare rosie care
creste exact cat calatoreste matrita, iar in jur cele patru colturi HUD, in spatiul ECRANULUI —
deci obiectul se roteste inauntrul cadrului, nu cu el.

**De ce nu WebGL, desi e un model 3D.** Fix asta e clipa in care chunk-ul scenei si shaderele detin
firul principal; a cere acolo un al doilea context GL e cel mai prost lucru posibil. Doar transform
si opacity, deci fiecare cadru e al compositorului. Saptesprezece elemente.

**Bucla e facuta sa nu se citeasca drept bucla:** rotatia are 8s, respiratia 3,4s. Nu se impart una
la alta, deci nu aterizeaza de doua ori la fel. Sub `prefers-reduced-motion` ramane poza compusa pe
care se sprijina animatiile — stiva usor desfacuta, aprinsa, incadrata.

Marimea urmeaza fereastra (`clamp(30px, 7.4vmin, 76px)` pe unitate), deci un telefon primeste
aceeasi compozitie ca un desktop.

**Verificat prin CDP** pe build-ul care ruleaza, la 600 ms si 2,5 s: acoperirea sus, obiectul
desenat, nimic nu razbate prin ea; la 10 s coboara. Suita completa, **1605 teste in 75 de fisiere**,
`eslint .` si `tsc --noEmit` curate.

Fisiere: `components/ui/BootCore.tsx` · `BootCore.module.css` · `components/ui/PageLoading.tsx`.

---

## 2026-09-23 — Added: ecran de incarcare pe toata fereastra pana randeaza stadiul

*„Loading trebuie sa fie pe toata fereastra pana se randeaza totul."*

`components/ui/PageLoading.tsx`: fundalul sitului, grila lui in perspectiva si marca partajata
(`Loading`) in mijloc, peste tot ecranul. Sus doar cat `data-renderer` e `pending` — valoarea
serverului, deci e pictat din primul cadru si nimeni nu se uita la o pagina care se asambleaza —
si coboara la ORICE raspuns: `webgl`, `fallback` sau `off`.

**Nu e inauntrul stadiului, si asta a fost o reparatie pe parcurs.** Prima varianta il monta in
`SceneStage`, care are `isolate`: asta deschide un context de stivuire, deci `z-index: 350` era
scopat la stadiu si antetul (120) si bannerul de cookie-uri (280) pictau in continuare peste el —
vazut in captura, nu dedus. Sta acum in layout si gaseste stadiul cu `:has()`, exact testul pe care
fundalurile in bucla il folosesc ca sa se opreasca sub intro. O pagina fara stadiu nu-l ridica
niciodata.

**Doua protectii, si niciuna nu e optionala:**

1. **Un failsafe la 6s.** Acoperirea BLOCHEAZA pagina. Daca un stadiu n-ar raspunde vreodata — un
   chunk care nu ajunge, o sonda care arunca unde nu prinde nicio bariera — vizitatorul ar ramane
   pe un ecran gol fara iesire. Animatia cu `forwards` bate declaratiile, deci la 6s coboara
   orice ar face stadiul. Caile proprii ale stadiului sunt mult mai scurte (`afterIdle` 1500 +
   600ms, apoi sonda si primul cadru), deci asta se declanseaza doar la o defectiune reala.
2. **`<noscript>` o scoate cu totul.** Fara JavaScript niciun raspuns nu vine niciodata.

**Un intro o dezarmeaza.** Intro-ul e tot o acoperire pe tot ecranul, cu propriul ceas, propriul
skip si propriul failsafe; doua care se bat n-ar avea sens, deci intro-ul castiga
(`html:has(#tbs-intro)`).

**Costa LCP, si asta e tranzactia.** O acoperire opaca peste erou inseamna ca largest contentful
paint nu e contorizat pana nu se ridica. Intro-ul accepta deja asta la prima vizita; asta o accepta
la fiecare incarcare a unei pagini cu stadiu, in schimbul faptului ca nu se mai vede niciodata o
pagina pe jumatate randata.

**Verificat prin CDP** pe build-ul care ruleaza: la 600 ms si 2,5 s → `renderer="pending"`, cover
`1`, `visibility: visible`, blocheaza, `z: 350`, si nimic nu razbate prin ea; la 10 s →
`renderer="webgl"`, cover `0`, `visibility: hidden`, nu mai blocheaza. Plus suita completa, **1605
teste in 75 de fisiere**, `eslint .` si `tsc --noEmit` curate.

Fisiere: `components/ui/PageLoading.tsx` · `PageLoading.module.css` · `app/(site)/layout.tsx` ·
`app/globals.css` (`--z-page-loading: 350`, intre modal si intro).

---

## 2026-09-23 — Changed: UN singur loading, partajat, folosibil oriunde

*„Adauga un loading general, unde putem sa il utilizam peste tot, la incarcarea datelor, la
randare..."*

Cele doua stari de incarcare facute pe masura in aceeasi zi (`ModelLoader` pentru gazda modelului,
`HelixLoader` pentru pista Lucrari) sunt **sterse**. In locul lor, unul singur:
`components/ui/Loading.tsx`.

**Nu e un spinner**, si nu din incapatanare: fiecare suprafata de pe sit e desenata cu colturi HUD
si o bara care baleiaza, deci asteptarea e desenata la fel — un cadru din patru colturi, o bara
trecand intre ele, si un miez rosu, rosul fiind peste tot aici lucrul viu. Sase trasee si un
`<svg>`; doar transform, opacity si dash-offset, deci ramane pe compositor exact cand firul
principal e cel mai ocupat. Din acelasi motiv e CSS si niciodata o a doua panza.

**Contractul de accesibilitate e partea care conteaza si e pinuit:**

| cum e chemat | ce e |
|---|---|
| `<Loading />` | decorativ, `aria-hidden` — pentru o gazda care e ea insasi `aria-hidden` |
| `<Loading label={t("common.loading")} />` | `role="status"` + `aria-live="polite"` — pentru munca reala, anuntata |

Patru marimi: `sm` langa un rand de text, `md` intr-un panou, `lg` ca substitut de sectiune,
`fill` ia cutia pe care i-o dai. Nu poarta text propriu — eticheta vine din catalog, deci o
folosire decorativa nu costa nicio cheie, iar cheia `common.loading` a fost adaugata in toate trei
catalogele (ro/ru/en), asa ca niciun apelant nu poate ajunge pe gol.

**Unde se vede CAND e treaba scenei, nu a marcii.** `components/scene/art/SceneLoading.tsx` o
inveleste si tine regulile care erau imprastiate: vizibila doar cat `data-renderer` e `pending`, si
cardurile din pista Lucrarilor tinute la `opacity: 0` cat timp e sus. Marca nu stie nimic despre
scena, deci poate fi folosita la fel de bine pentru o cerere de date sau un panou care asteapta.
`data-loading` e carligul stabil, pe care il foloseste si regula `<noscript>` din
`app/(site)/layout.tsx` ca s-o ia de acolo unde nicio decizie nu vine vreodata.

**Verificat prin CDP** pe build-ul care ruleaza: gazda modelului la 700 ms si 2,5 s →
`renderer="pending"`, loading `1`, ilustratie `0`; la 9 s → `webgl`, loading `0`. Pista Lucrarilor
inainte de scena → `pending`, loading `1`, card `0`; dupa → `webgl`, `helix="spiral"`, loading `0`,
card `0.996`. Plus suita completa, **1605 teste in 75 de fisiere** (sase noi pentru `Loading`),
`eslint .` si `tsc --noEmit` curate.

Fisiere: `components/ui/Loading.tsx` · `Loading.module.css` ·
`components/scene/art/SceneLoading.tsx` · `SceneLoading.module.css` ·
`components/sections/{DirectionPage,Directions,Work}.tsx` · `app/(site)/layout.tsx` ·
`lib/i18n/messages/{ro,ru,en}.ts` · `components/__tests__/loading.test.tsx`.
Sterse: `components/scene/art/{ModelLoader,HelixLoader}.{tsx,module.css}`.

---

## 2026-09-23 — Added: o stare de incarcare si pentru pista Lucrari

*„Nu vad niciun loading pana se face rendering, ca sa nu mai vad cartelele celea."*

Acelasi tratament ca gazda modelului, dar pentru portofoliu. Cardurile din `Work.tsx` **nu** sunt
un fallback — scena nu le inlocuieste, le RE-ASEAZA: dupa banda Lucrarilor fiecare card e pus
singur pe spirala (`[data-scene-stage][data-helix=spiral]`, `workHelix.ts`). Pana cand stadiul
raporteaza `webgl` insa stau ca o grila plata, iar a ajunge pe grila aia si apoi a o vedea
pliindu-se in elice e chiar schimbul pe care il ascunde acum `HelixLoader`.

Cat timp `data-renderer` e `pending`: cele doua fire se deseneaza singure de sus in jos, treptele
intra intre ele, un slot rosu urca pe ax — iar cardurile sunt tinute la `opacity: 0`. **Raman in
DOM si isi pastreaza cutia**, deci nu se ia nimic de la un crawler sau de la un cititor de ecran si
inaltimea pistei nu sare; doar pictura lor e amanata.

**Doua capcane, amandoua prinse de teste inainte sa ajunga undeva:**

1. **Regizorul masoara `workHead` ca FRATELE ANTERIOR al pistei** (`lib/scene.ts`). Prima varianta
   invelise pista intr-un `<div className="relative">` ca sa aiba unde sta loader-ul — ceea ce ii
   dadea elicei ambientale cutia loader-ului in loc de cea a titlului. `work.test.tsx` a prins-o
   (`track.previousElementSibling?.querySelector("h2")`). Loader-ul e acum PRIMUL COPIL al pistei,
   pozitionat absolut, si pista poarta `relative` — nimic nu se interpune intre titlu si grila.
2. **Driverul elicei aduna copiii pistei.** Un `<svg>` e `SVGElement`, nu `HTMLElement`, iar
   `workHelix.ts` filtreaza `instanceof HTMLElement` — deci loader-ul e exclus prin constructie,
   nu din noroc. Doua teste care iterau `track.children` fara filtru au fost aliniate la acelasi
   criteriu, si pinuieste acum explicit ca loader-ul e acolo si ca elementele cardurilor raman
   aceleasi peste o schimbare de limba.

**Verificat prin CDP** pe build-ul care ruleaza, derulat la Lucrari inainte ca scena sa fie gata:
`renderer="pending"`, loader `1`, card `0`; apoi `renderer="webgl"`, `helix="spiral"`, loader `0`,
card `0.996`. Plus suita completa, **1599 de teste in 74 de fisiere**, `eslint .` si `tsc --noEmit`
curate.

Fisiere: `components/scene/art/HelixLoader.tsx` · `HelixLoader.module.css` ·
`components/sections/Work.tsx` · `components/__tests__/work.test.tsx` · `scene-helix.test.ts`.

---

## 2026-09-23 — Added: o stare de incarcare pentru gazda modelului 3D

Ascunderea ilustratiei statice a lasat o gaura pe care am semnalat-o in aceeasi zi: intre primul
paint si modelul live caseta ramanea **goala** — cat tin sonda de capabilitate, chunk-ul three.js,
compilarea shaderelor si primul cadru. Pe un telefon, secunde.

`components/scene/art/ModelLoader.tsx` o umple, in vocabularul scenei si nu intr-al altcuiva: o
amprenta izometrica punctata — aceeasi pe care stau toate modelele — cu trei trepte asamblandu-se
deasupra ei, din spate in fata, si un pachet rosu coborand pe ax, exact bara pe care o foloseste
orice flux din ilustratii. Fara text (deci fara cheie de catalog si fara dependenta de font), fara
nimic rotund, nimic focusabil, `aria-hidden` peste o cutie deja `aria-hidden`.

**Noua elemente si un `<svg>`, doar transform si opacity.** E deliberat CSS si nu inca o panza:
trebuie sa picteze exact cand chunk-ul scenei si shaderele se bat pe firul principal, care e
momentul cel mai prost cu putinta pentru un al doilea context WebGL. Sub `prefers-reduced-motion`
ramane poza compusa pe care se sprijina animatiile; sub `forced-colors` dispare.

**Vizibil doar cat timp stadiul nu s-a hotarat** (`[data-renderer="pending"]`, care e si valoarea
serverului, deci caseta nu e goala nici la primul paint). La `webgl` se stinge in 0,35 s sub model;
la `fallback`/`off` se stinge si ilustratia ii ia locul. **Si fara JavaScript nu ramane o minciuna:**
acolo stadiul nu se hotaraste niciodata, deci regula `<noscript>` din `app/(site)/layout.tsx` — cea
adaugata pentru ilustratii — il ascunde si le arata pe ele.

Montat in amandoua gazdele care poarta `data-scene-anchor="services"`: coloana din dreapta a
eroului pe o pagina de serviciu (`DirectionPage.tsx`) si ecranul de directii de pe prima pagina
(`Directions.tsx`).

**Verificat prin CDP** pe build-ul care ruleaza, decupat pe caseta gazdei: la 700 ms si la 2,5 s →
`renderer="pending"`, loader `1`, ilustratie `0`; la 9 s → `renderer="webgl"`, loader `0`, model
desenat. Plus suita completa, **1599 de teste in 74 de fisiere**, `eslint .` si `tsc --noEmit`
curate.

**O afirmatie a fost ingustata, nu stearsa:** `directions-selector.test.tsx` cerea ca gazda sa n-aiba
NICIUN copil pe o randare fara slot. Gazda nu mai e niciodata goala, asa ca acum cere ce voia sa
ceara — zero ILUSTRATII (`[data-shape-art]`) — si pinuieste separat ca loader-ul e acolo.

Fisiere: `components/scene/art/ModelLoader.tsx` · `ModelLoader.module.css` ·
`components/sections/DirectionPage.tsx` · `Directions.tsx` · `app/(site)/layout.tsx` ·
`components/__tests__/directions-selector.test.tsx`.

---

## 2026-09-23 — Changed: desenul static nu mai precede modelul 3D, iar modelul se formeaza

*„Corecteaza ca deodata sa apara formarea graficului 3d animat si sa nu mai apara desenele
statice."*

Pana acum ilustratia statica era pictata la **fiecare** incarcare si stearsa in fade cand sosea
modelul live. Vizitatorul vedea intai o imagine fixa si apoi un ALT obiect luandu-i locul — fiindca
desenele infatiseaza generatia anterioara de modele, deci schimbul nu era o taietura pe aceeasi
silueta, ci un obiect devenind altul.

**Regula s-a inversat.** `.art` e `opacity: 0` implicit; doar `[data-renderer="fallback"]` si
`[data-renderer="off"]` il aduc inapoi:

| stadiu | ce umple coloana din dreapta a eroului |
|---|---|
| `pending` (si valoarea de pe server) | nimic — caseta e goala cat se ia decizia |
| `webgl` | modelul live, **jucandu-si intrarea** |
| `fallback` · `off` | desenul |

**Doua cai ar fi ramas altfel cu o caseta goala pentru totdeauna, si amandoua sunt acoperite.** Un
vizitator fara JavaScript nu ajunge niciodata la o decizie — `data-renderer` ramane la `pending`-ul
serverului — deci o regula `<noscript><style>` in `app/(site)/layout.tsx` ii arata desenele
neconditionat, exact tiparul folosit alaturi de suprapunerea intro-ului. Un vizitator al carui GPU
e refuzat ajunge la `fallback` sau `off` si primeste desenul din tabelul de mai sus.

**Si modelul se FORMEAZA acum, nu mai apare.** `stepSceneFx` fixa poarta de intrare pe primul cadru
ca un deep link sa nu animeze niciodata. Pe o pagina de serviciu asta insemna ca modelul aparea pur
si simplu, gata construit, in clipa in care WebGL era pregatit — iar fara desenul de dedesubt
caseta trecea din gol direct in gata. Conditia e acum `first && heroExit > 0`: peste 0 doar dupa ce
pagina a inceput sa paraseasca eroul, adica exact cazul deep-link pentru care a fost scrisa. La
erou poarta isi ruleaza forma de 1,1 s si intrarea e spectacolul.

**Inainte de asta, si pastrat:** ilustratia pentru `produs-digital` a fost redesenata din numerele
modelului care chiar se randeaza (`models/productStack.ts`) — sase ecrane distantate pe axa stivei
peste o banca, prabusindu-se in placa dispozitivului din fata. Era o stiva de cuburi 3×3×3, adica
generatia dinaintea celor cinci modele comise in `1efe5ff`. Conteaza in continuare: pe un
dispozitiv fara WebGL desenul e tot ce se vede vreodata, deci un desen gresit acolo e continut
gresit. **Trei raman de refacut** (`e-commerce`, `automatizare-api`, `brand-ui`; `asistenti-ia` se
potriveste deja, fiindca `models/assistantLoop.ts` imparte silueta lui `buildNeuralGraph`).

**Verificat prin CDP** pe build-ul care ruleaza, la 1600×1000, decupat pe caseta eroului:
incarcare normala → `renderer="webgl"`, `artOpacity="0"`, `entry="formed"` (desenul nu apare deloc);
scena oprita → `renderer="off"`, `art="1"` (fallback-ul intact). Plus suita completa, **1599 de
teste in 74 de fisiere**, `eslint .` si `tsc --noEmit` curate.

**Doua teste apărau comportamentul vechi** si au fost repointate, nu sterse: `service-art.test.tsx`
cerea regula `[data-renderer="webgl"] .art { opacity: 0 }` — acum cere inversul, plus ca nimic nu
readuce desenul cat timp randorul e `webgl`; iar `scene-choreography.test.ts` cerea ca o ancora deja
trecuta, in capul paginii, sa **sara** la format — acum cere sa se armeze si sa se formeze in timp,
si pinuieste separat ca deep-link-ul (`heroExit > 0`) ramane instant.

Fisiere: `components/scene/art/ServiceArt.module.css` · `art/ServiceArt.tsx` ·
`art/serviceArtPaths.ts` · `components/scene/fx.ts` · `app/(site)/layout.tsx` ·
`components/__tests__/service-art.test.tsx` · `scene-choreography.test.ts`.
Documentatie: [`docs/03`](./docs/03-architecture.md).

---

## 2026-09-23 — Fixed: modelul 3D al serviciului pleca din erou pe un ecran inalt

*„Captura ii prea lunga si animatia sta jos si nu se suie sus."* Raportul era exact, inclusiv
partea cu inaltimea. Erau **doua** defecte, si amandoua se vedeau doar pe o fereastra inalta.

### Cauza: modelul pleca in coltul sectiunii „Cum lucram" inainte sa fie parasit eroul

Pe o pagina de serviciu modelul are o a doua casa. `world.ts` il muta langa „Cum lucram" cat timp
sectiunea e citita si il aduce acasa cand e parasita — corect ca intentie, dar poarta punea
intrebarea gresita:

```ts
const share = stepsPlace ? stepsShare(probe, scrollY, h) : 0;
cornerArmed = stepsPlace !== null && (cornerArmed ? share > STEPS_GATE.off : share > STEPS_GATE.on);
if (!cornerPrimed) { cornerPrimed = true; corner = cornerArmed ? 1 : 0; }  // fara calatorie
```

`stepsShare` masoara cat din gazda sectiunii e **in panza** — iar panza are inaltimea unei
ferestre. Pe un ecran inalt, o gazda aflata la ~1000px in document e deja peste pragul de 0,5 **la
derulare 0**, iar amorsarea din primul cadru teleporta modelul in colt. Rezultatul: erou gol, model
parcat jos — si fiindca desenul static e la `opacity: 0` sub `data-renderer="webgl"`, in erou nu
ramanea absolut nimic.

**De ce numai e-commerce.** E singura directie fara sectiune de proiecte (`lib/solutions.ts`,
`"e-commerce": []`), ceea ce ii urca gazda „Cum lucram" cu vreo 600px fata de orice alta pagina de
serviciu. Pragul se atingea pe la ~1145px inaltime de fereastra pe e-commerce si pe la ~1800px pe
produs-digital. Fereastra din raport avea 1300px: exact intre ele.

**Reparatia:** poarta pune acum si a doua intrebare — *si-a parasit modelul casa?* Noul
`servicesShare` (`choreography.ts`) da cat din gazda proprie e in panza, iar coltul se poate arma
doar sub `STEPS_GATE.home` (0,15). La derulare 0 eroul e vizibil, deci modelul ramane acasa; dupa
ce eroul e derulat afara, comportamentul vechi e neatins, inclusiv amorsarea instantanee pentru un
deep link direct in sectiune.

**Reprodus si verificat prin CDP** pe build-ul care ruleaza, la 1720×1300, cu capturi inainte si
dupa: inainte — `renderer="webgl"`, `artOpacity="0"`, gazda `{x:946, y:239, w:554, h:320}` goala si
modelul jos; dupa — tejgheaua desenata in coloana din dreapta a eroului. `produs-digital` verificat
la fel, fara regresie.

### Al doilea defect, gasit pe drum: punctul de repaus al paralaxei

`placeServices` (`components/scene/choreography.ts`) aseaza modelul pe ancora
`[data-scene-anchor="services"]`, dar ce decide daca ajunge PE gazda e **punctul de repaus al
paralaxei** — pozitia spre care `parallax(domY, restY, f)` trage modelul cu `1 − f` din drum. Era
`h / 2`, mijlocul panzei, si asta e corect pentru exact una dintre cele doua pagini care folosesc
functia:

- **Pagina principala.** Ancora serviciilor e jos in document si vizitatorul deruleaza pana la ea,
  deci chiar ajunge centrata in fereastra. `h / 2` e locul unde se afla cand te uiti la ea.
- **O pagina de serviciu.** Gazda e coloana din dreapta a eroului. Pagina **nu poate** s-o duca in
  mijloc — la derulare 0 e deja cat de sus va fi vreodata — deci `h / 2` e o pozitie pe care n-o
  atinge niciodata, iar paralaxa cheltuia `1 − f` din distanta aia inexistenta impingand modelul
  **in jos**. Panza are inaltimea unei ferestre, deci eroarea crestea cu fereastra.

Masurat prin CDP pe build-ul care ruleaza, pe gazda reala de la `/servicii/e-commerce`, derulat sus:
**−42px la o fereastra de 700px, −8px la 900, +26px la 1100, +60px la 1300, +111px la 1600.** Se
citea ca un desen care refuza sa urce in erou pe un ecran inalt. Era corect doar pe la ~950px, unde
cele doua puncte de repaus se nimeresc sa coincida — de-aia o suita a carei sonda e 1280×800 nu l-a
vazut niciodata.

**Punctul de repaus e acum `h / 2` prins in intervalul pe care gazda chiar il poate atinge.**
`canvasDocTop` limiteaza panza intre `stage.top` si `stage.bottom − h`, deci `y`-ul gazdei pe panza
e marginit de capetele alea; prinzandu-l acolo, pagina principala ramane pe `h / 2` neschimbata, iar
o gazda din erou capata propria pozitie de sus — exact conventia pe care `placeCore` o foloseste
deja, o functie mai sus. Paralaxa e zero la repaus pe amandoua si intarzie in continuare cu `1 − f`
din cat muta derularea.

**Ce NU era de vina**, eliminat cu masuratori inainte de a ajunge aici: desenul SVG static e prezent
si sanatos pe toate cele cinci pagini (contur real calculat parcurgand traseele); cutia-gazda e
identica structural si are `min-height: clamp(240px, 26vw, 320px)`; toate cele cinci modele WebGL se
construiesc si se actualizeaza corect (cel de e-commerce: 4 obiecte, 3748 varfuri, 3,77 × 2,32 ×
2,00, centrat in origine); si nimic nu fusese sters — `git status` pe `components/scene` era gol.
Conturul urias al lui `brandBoard` (13106 unitati) e intentionat: `HIDDEN = 1e4`, „parcheaza dincolo
de planul far ca sa-l taie GPU-ul".

**Un test vechi apara chiar conventia gresita.** „a services host centred in the canvas lands at
y = 0" muta derularea pana cand gazda era in centrul panzei si cerea ca modelul sa fie tot acolo —
adica paralaxa zero **mereu**, ceea ce e incompatibil cu a avea paralaxa. E pastrat ca fiind cazul
paginii principale, si i s-au adaugat celelalte doua jumatati ale contractului: un model de pagina
de serviciu e in cutia gazdei la derulare 0 la zece inaltimi de fereastra intre 640 si 1800 — si fix
pe ea oriunde fereastra e prea inalta ca gazda sa ajunga in mijloc — iar o derulare de 200px il muta
cu `200 × parallax`, la fel ca fratele lui pentru chip.

**Verificat:** suita completa, **1599 de teste in 74 de fisiere**, plus `eslint .` si `tsc --noEmit`
curate. Paralaxa a fost masurata separat la unsprezece inaltimi de fereastra intre 640 si 1800:
deplasare **0,00px** peste tot unde gazda nu poate atinge mijlocul. Coltul e pinuit la cinci
inaltimi intre 900 si 1800, plus contractul lui `servicesShare`.

Fisiere: `components/scene/choreography.ts` · `components/scene/three/world.ts` ·
`components/__tests__/scene-choreography.test.ts`.
Documentatie: [`docs/03`](./docs/03-architecture.md).

---

## 2026-09-23 — Changed & Fixed: intro-ul iese prin tastatură, curge fără opriri, și încape pe telefon

Trei cereri, în ordinea în care au venit: *„fă să fie mai lin, nu așa de brusc"*, *„să iasă din
tastatură unde e poziționat CPU"*, *„optimizează ca să meargă și pe telefon"*. Toate trei au scos
la iveală defecte pe care nu le avea nimeni pe listă.

### Camera se oprea complet la fiecare cadru

`smooth(t) = t²(3 − 2t)` are derivata `6t(1 − t)`, **zero la ambele capete**. Comentariul vechi
spunea „no key is a corner" — adevărat, și pe lângă subiect: continuitatea era zero-la-zero, deci
camera decelera până la oprire la fiecare cheie și accelera din nou. Asta era „brusc": nu un colț,
ci stop-pornire, de șase ori.

`cameraAt` rulează acum un **cubic monoton** (Hermite cu tangente Fritsch–Carlson) prin aceleași
chei. Trece prin fiecare la fel de exact, dar își duce inerția prin ele. Monoton, nu Catmull-Rom:
fiecare marjă de siguranță a zborului e formulată ca *camera nu e niciodată în interiorul lui X*, și
o splină care depășește cu o sutime la ieșirea prin tastatură bagă lentila în puntea, fără ca lista
de cadre s-o spună. Capetele păstrează tangenta zero intenționat — K0 e un cadru ținut, K7 e
aterizarea pe care burst-ul o ține nemișcată pe tot fade-ul de 0,55 s.

**`flightFromProgress` era liniar pe bucăți.** Pantele urcă prin tabel intenționat (0,75 → 0,61 →
0,72 → 1,29), dar liniile drepte transformau fiecare schimbare într-un **colț**: +19%, +18% și
**+79%**, instantaneu. Ultimul aterizează la `u` 0,66, o sutime după ce camera a țâșnit afară și în
timp ce se roteste în jurul mașinii — cele două accelerări se compuneau în cel mai prost moment din
tot intro-ul. Aceleași rânduri, aceleași limite, cubic monoton între ele.

**Și cadrul de deschidere privea în altă parte.** Ținta lui K0 stătea la 0,17 în fața unei camere
decalate cu 0,08 de ea, deci componenta x a vectorului înainte era 0,46: lentila era întoarsă **27°
de-a curmezișul cavității**, nu în lungul ei. Măsurat prin proiecție, asta punea peretele stâng al
pachetului procesorului la ndc.x −1,44 — în afara cadrului — deci cadrul pe care tabelul îl numește
*canionul dintre două dintre ele* arăta exact un perete. Ținta e acum la 0,41 în lungul cavității,
întoarcerea e 11°, și se văd ambii pereți.

### Douăsprezece piese puse pentru lentilă, nu pentru cadru

Piesele din interior fuseseră plasate după **distanța față de planul near**, fiindcă aia verifică
testele. Proiectând toate cele opt colțuri ale fiecăreia de-a lungul zborului a ieșit la iveală că
ventilatorul (x −0,66), ambele condensatoare (în spatele punctului de start) și peretele stâng
**nu erau pe ecran înainte de u 0,61** — vizibile doar din afara mașinii, după ce camera ieșise deja.
Douăsprezece piese pe care nu le vede nimeni în beat-ul pentru care există e același eșec ca zero
piese. Băncile s-au mutat cât de aproape de zbor permite planul near, nu cât de departe permite
cavitatea. **Toate 12 sunt acum în cadru de la primul frame**, cea mai puțin văzută (bordura
socketului) 35% din zbor.

### Ieșirea prin tastatură — și de ce capacul trebuie să fie deschis înainte

Camera iese acum **în sus, prin tastatură**, fiindcă acolo stă procesorul. `HATCH` (0,34 × 0,09 la
x −0,17, z −0,44) nu e o gaură tăiată pentru scop: rândurile de taste stau la z −0,11, −0,33 și
−0,55 și fiecare tastă e adâncă de 0,11, deci suprafața de sus a punții e deja liberă între z −0,495
și −0,385. Apertura e dimensionată de raza de ieșire, niciodată invers.

**Și aici am lovit fizica.** Un capac închis stă întins la y 0,10–0,15 peste toată puntea, la două
sutimi deasupra suprafeței ei de sus, la 0,08. **Nu există gol prin care să urci: un laptop închis
nu are ieșire prin partea de sus** — exact motivul pentru care prima versiune a zborului ieșea
lateral, prin ventilația din peretele din spate. Deci `lidOpenAt` a trecut la **[0,40, 0,60]** și
`screenFillAt` la **[0,46, 0,68]**, amândouă înaintea ieșirii în loc de după. Orice unghi sub 90°
tot acoperă trapa la *o* înălțime, deci fereastra trebuie să se *închidă* înainte de 0,602, nu doar
să înceapă înainte.

Rezultatul e un beat mai bun decât cel pierdut: camera iese din tastatură **în ecranul deja aprins**,
la două treimi din ștergerea lui de pornire, în loc să aștepte un capac care se dă la o parte.

### Telefonul: trei lucruri greșite, niciunul vizibil pe desktop

**Ecranul nu încăpea.** Proiectând cele patru colțuri ale lui: pe un ecran portret 0,46 doar **două**
erau în cadru la cheia de după ieșire, cel mai rău la 6,1 lățimi de ecran în afară — o lespede de
lumină, nu un laptop. Reparat cu mecanismul care exista deja pentru asta, `widen`, ridicat de la 1 la
**1,4** pe ultimele două cadre din exterior. Înmulțește doar decalajul *orizontal*, deci pe orice
raport ≥ 1:1 termenul e 1 și **încadrarea pe desktop nu se mișcă deloc**. Toate patru colțurile sunt
acum în cadru la 0,46.

**Raza de ieșire și widen-ul se băteau pe aceeași cheie.** O cheie lărgită trage punctul în care
camera traversează suprafața punții: la `MAX_WIDEN` ajungea la x −0,44, o zecime în afara unei
aperturi care ar fi trebuit atunci să fie jumătate de tastatură. Lista de cadre a primit **al optulea
cadru** — K4, chiar deasupra punții, încă privind în sus. K3→K4 e acum toată raza de ieșire și
amândouă au `widen` 0, deci traversarea e identică la orice raport; cheia de *după* e cea care se dă
înapoi, și e liberă s-o facă.

**Tier-ul low arunca exact tastatura prin care iese camera.** `LAPTOP_SLOT_LITE` era indexul `keys`,
care ceda toate cele douăsprezece — corect cât timp ieșirea era prin ventilație, greșit din clipa în
care a devenit trapa dintre două rânduri. Ordinea de cedare avea deja rândurile din spate în față,
deci tăietura s-a mutat pe rândul din față: low păstrează 36 din 41 de piese.

### Desenul plat: costul la primul paint, 97 → 39

Desenul SVG e ce vede **fiecare** vizitator la deschidere, și pe multe telefoane și în CI e tot
intro-ul. Trecerea anterioară îl repozase pe procesor, dar raportase costul greșit: „58 de elemente
față de 69" numără copiii din `<defs>`, care nu se așază și nu se desenează niciodată, și **nu**
numără instanțierea `<use>`, care se face. Pe metrica reală — elemente care generează o cutie, plus
subarborele pe care fiecare `<use>` îl materializează — era **54 → 97, adică +80%**, pe stratul
negated care se pictează înaintea `<h1>`-ului de dedesubt.

Acum e **39**: cu 28% sub cele 54 de dinaintea întregii munci, și include o podea pe care stratul
vechi n-o avea. Câștigul vine din două locuri: cele douăsprezece blocuri desenate ca 12 `<use>` ale
unui `<symbol>` cu 3 noduri (48 de obiecte) au devenit un singur dreptunghi umplut cu `<pattern>`
(1), iar cavitatea a trecut de la 16 obiecte la 6, unind hairline-urile care împart un contur în
`<path>`-uri cu mai multe subtrasee. Plăcuța e exactă, nu aproximativă: pasul era deja 31,5 × 39 pe
un bloc de 27,5 × 34, deci se repetă 4 × 3 fără ca vreo dală să fie tăiată printr-un bloc.

S-a reparat și o regresie a aceleiași treceri: `.fbHatch` împărțea la scala stratului părinte dar nu
și la **translația** lui, deci trapa cobora 180 de unități cât se mărea — centrul cadrului era în
interiorul ei doar cât `--rz < 0,118`, iar în restul ieșirii camera era îndreptată spre puntea
plină. Anularea costă `−T / --bs` în spațiul propriu al copilului.

### Ce e verificat și ce nu

**Verificat:** suita unitară completă, **1595 de teste în 74 de fișiere**, plus `eslint .` și
`tsc --noEmit` curate, rulate într-un container `node:22-alpine` (`node_modules` local e gol,
conform AGENTS.md). Invariantele geometrice au fost măsurate separat, citind tabelele din sursă:
o singură traversare a suprafeței punții per raport de aspect, în interiorul aperturii; camera în
cavitate până la trapă; spațiu peste planul near față de toate cele 41 de piese la 401 eșantioane ×
7 rapoarte, cu capacul la unghiul lui real; și viteza la chei, 0 · 0,55 · 1,11 · 1,34 · 9,83 · 9,70
· 1,15 · 0 la 16:10, cu vârf 21,3 (era 30,5 înainte de splină).

**Neverificat, și merită ochi:** dacă desenul plat chiar *citește* ca „ești în laptop". Nu am putut
randa nimic în sesiunea asta, deci verific formule, nu imagini. Un verificator independent spune că
încă nu citește, și că între `--fb-p` 0,46 și 0,60 incinta iese din cadru. Legat de asta, o
descoperire structurală: **`overflow: visible` pe toate straturile înseamnă că viewBox-ul nu e o
ramă** — toată cronometrarea pieselor e derivată din „când încape în viewBox", dar rama reală e mai
mare și depinde de raportul ecranului (pe 1440×900 e ±375 × −211..258, nu ±240 × ±150).

**Un defect găsit și încă nereparat, ca să nu se piardă:** cele cinci ilustrații statice de servicii
(`components/scene/art/serviceArtPaths.ts`) desenează **generația anterioară de modele**. Se
construiesc din `CUBE_LAYOUTS`, `COMMERCE_GATES`, `commerceTrackPoint`, `hubLayout` și
`buildNeuralGraph` din `components/scene/shapes.ts`, dar niciunul dintre cele cinci modele redate
acum (`productStack`, `shopFloor`, `pipelineBench`, `brandBoard`, `assistantLoop`, comis în
`1efe5ff`) nu importă nimic din acel fișier. Patru din cinci desenează alt obiect decât modelul care
le înlocuiește, iar pe un dispozitiv fără WebGL ilustrația greșită e tot ce se vede vreodată — deci e
conținut greșit, nu o tranziție urâtă. Cele cinci fișiere înlocuite (`cubes.ts`, `commerceLoop.ts`,
`integrationHub.ts`, `neural.ts`, `meshWave.ts`) sunt tot în arbore, importate doar de două teste.

Fișiere: `components/intro/three/cameraPath.ts` · `three/laptop.ts` · `three/materials.ts` ·
`three/rig.ts` · `flight.ts` · `tiers.ts` · `IntroDirector.tsx` · `IntroFallback.tsx` ·
`IntroPreloader.module.css` · `components/__tests__/intro-camera-path.test.ts` ·
`intro-laptop.test.ts` · `intro-scene-math.test.ts`.
Documentație: [`docs/05`](./docs/05-page-sections.md#first-visit-intro-preloader) (tabelul
beat-urilor, ieșirea prin tastatură, secțiunea despre telefon, de ce a încetat să fie brusc) ·
[`docs/03`](./docs/03-architecture.md) · [`docs/14`](./docs/14-testing.md).

---

## 2026-09-22 — Fixed & Added: intro-ul începe în procesor, nu cu un laptop

„Acolo începe cu laptopul, dar ar trebui să înceapă în interiorul laptopului, la procesor" — și
avea dreptate. Lista de cadre 3D pornea deja de pe matriță (K0), dar **nimeni nu o vedea**. Două
cauze, amândouă reparate.

**Cadrul-poster al desenului SVG era laptopul întreg, compus și cu capacul deschis.** La `--fb-p`
0 variabila `--rest` era 1, deci `.fbMachine` picta la 0.55 opacitate, iar `.fbDie` era
`display: none` până la `[data-live]`. Predarea către procesor se făcea pe `--fb-p` 0.02 → 0.05 —
3% din derulare, vreo 20–40 ms în spatele tween-ului de urmărire de 0.45 s al regizorului. Asta e
o tăietură, nu un început. **`--rest` a dispărut.** Poarta s-a inversat: acum halo-ul, mașina și
placa sunt ascunse până la `[data-live]`, iar matrița e singurul strat așezat la primul paint —
**44 de elemente în loc de 69** (26 obiecte desenate, față de 40) și o animație în loc de patru.
Cele două `feGaussianBlur` ale halo-ului, peste o regiune de 540 × 400 (~1,26 Mpx la 1920 × 1080),
au ieșit de pe calea critică. În HTML pleacă aceleași 163 de noduri ca înainte — s-a mutat doar
poarta de layout și paint — deci `<h1>`-ul de dedesubt rămâne elementul LCP.

**Și camera 3D ieșea din carcasă la `u` ≈ 0.45.** Dizolvarea de pe desen nu poate ateriza mai
devreme de `u` 0.40 (semnalul scenei valorează 0.40 din progres, deci bara nu trece de 0.60 fără
el, iar `flightFromProgress(0.60)` e fix 0.40). Interiorul avea, prin construcție, o zecime de
zbor — poate 150 ms — deci fusese construit pentru un cadru pe care nu-l privea nimeni, iar între
matriță și peretele din spate nu exista **nicio piesă ridicată de pe podea**: doar fire plate.
Vizitatorul citea intro-ul ca „un laptop", fiindcă laptopul era tot ce i se arăta.

**Un al șaptelea cadru de cameră (K3, `u` 0.58)** mută ieșirea la `u` ≈ 0.60 — măsurat 0.5950 la
plafonul de lărgire, 0.6058 la 16:10 — și dă coridorului o cincime din film. E singura porțiune
**garantat 3D oriunde există 3D**. `FLIGHT_MAP` și cadrul K2 (unde aterizează dizolvarea) nu s-au
atins, deci ceasul de perete al burst-ului e neschimbat.

**Douăsprezece piese în cavitate**, toate derivate din coridorul pe care chiar zboară `cameraAt`
(x −0.02 → −0.14 la |y| < 0.02), nu alese: rama pachetului procesorului (canionul în care stă
beat-ul 1), bordura socketului peste care trece camera, două condensatoare, un heatpipe pe flancul
`+x`, carcasa și butucul ventilatorului pe `−x`, două module de memorie, cardul de stocare și
radiatorul lipit de peretele din spate. **Zero draw-call-uri în plus** — sunt cutii în singurul
`InstancedMesh` al ramei. Piesa cea mai strânsă din tot zborul e bordura, la 0.024: două planuri
near și jumătate.

**Solidele dau silueta, firele duc unda.** Paletele ventilatorului (8) și dinții radiatorului (9)
sunt linii în bufferul plăcii, deci călăresc `aU` și se aprind în ordinea lui *z* pe măsură ce
camera ajunge la ele: matrița la `u` ≈ 0.22, ventilatorul la ≈ 0.25, radiatorul la ≈ 0.37, gaura
ultima, la 0.39.

**Trei numere din alte fișiere erau ieșirea, scrisă de mână.** Norul de particule
(`smoothstep(0.42, 0.68, uFlight)`), halo-ul șasiului (`ramp(u, 0.45, 0.7)`) și legănarea din mână
(`SWAY.in` la 0.35) înseamnă toate „camera e afară acum". Cu ieșirea mutată, se declanșau cu un
sfert de zbor prea devreme — bule moi umplând canionul, un perete strălucind la un centimetru de
lentilă și o panoramare într-un coridor ai cărui pereți **sunt** cadrul. Toate trei mutate pe 0.60.

**Și o coliziune găsită la verificare, nu în picture.** `--hud-top` rezervă banda de sub
`--intro-cy + --intro-w * 0.25`, buget măsurat din picioarele *mașinii*, care ajung la +94 din
cele 480 de unități viewBox. Jumătate din carcasa procesorului are 98 de unități, deci la orice
scală peste 0.957 trece de linia aceea — la 1.40 ajunge la 137.2, adică ~140 px de cip pictat în
spatele plăcii `SYSTEM_SYNCHRONIZATION` și de-a curmezișul barei de progres de 2 px, care nu are
fundal propriu. `.fbDie` se ridică acum exact cu propria depășire (`--over`, calculată din `--s`),
care scade singură la zero la scala 0.957 — `--fb-p` 0.374, înainte ca matrița să termine de
dizolvat în placă. **Derivat, nu ales**: schimbi scala, clearance-ul o urmează.

**Cele două randări cad de acord asupra ieșirii.** `--form` se deschide la `--fb-p` 0.60, același
moment în care camera 3D traversează peretele din spate. La 0.62 rămâneau două sutimi de derulare
fără nimic în ele în afară de o derivă de 3% — o pauză exact pe cadrul în care camera trebuie să
iasă din laptop.

**Verificat:** suita unitară completă, **1595 de teste în 74 de fișiere, toate trec**, plus
`eslint .` și `tsc --noEmit` curate (rulate într-un container `node:22-alpine`; `node_modules`
local e gol, conform AGENTS.md). Invariantele geometrice ale zborului au fost verificate separat,
citind tabelele direct din sursă: o singură traversare a planului ventilației per raport de aspect,
cu x ținut între −0.2215 și −0.2207 și y între 0.0078 și 0.0144 — interiorul aperturii; camera în
cavitate cât timp e în șasiu (|py| max 0.016 față de limita 0.056); spațiu față de toate piesele
peste planul near la 401 eșantioane × 9 rapoarte; pasul maxim 0.86 din 1.4 permis; capacul și
puntea evitate; și K2 încadrând în continuare ventilația la ndc.x −0.395.

**Nevăzut încă pe ecran.** Nu am putut randa nimic în sesiunea asta, deci încadrarea noului cadru
de deschidere — cât de mare e cipul, cât iese în sus din cadru la scala 1.40 — e derivată din
viewBox, nu observată. Merită o privire înainte de release.

Fișiere: `components/intro/three/cameraPath.ts` · `three/laptop.ts` · `three/materials.ts` ·
`three/rig.ts` · `IntroDirector.tsx` · `IntroFallback.tsx` · `IntroPreloader.module.css` ·
`tiers.ts` · `components/__tests__/intro-camera-path.test.ts` · `intro-laptop.test.ts` ·
`intro-scene-math.test.ts`.
Documentație: [`docs/05`](./docs/05-page-sections.md#first-visit-intro-preloader) (tabelul
beat-urilor, coridorul, desenul static) · [`docs/03`](./docs/03-architecture.md) ·
[`docs/14`](./docs/14-testing.md).

---

## 2026-09-20 — Fixed: suita e2e, rulată prima oară după rescrieri, afirma lucruri care nu mai sunt adevărate

Prima rulare completă a celor 252 de teste de browser după rescrierea intro-ului. **248 au trecut,
4 au căzut** — și niciuna nu a arătat un defect al aplicației. Trei descriau comportament schimbat
intenționat, una era o greșeală a testului nou.

**Trei teste cereau ca paginile de servicii să n-aibă scenă 3D.** Au avut dreptate până în ziua în
care am adăugat cele cinci modele de servicii, câte unul pe pagină. `HI7` și `W4` afirmau
`canvas → 0` și `[data-testid^="scene-"] → 0` pe `/servicii/<slug>`, iar testul de intro afirma
`[data-scene-stage] → 0`. **Invariantul care contează a fost păstrat**, nu șters odată cu
afirmația veche: `W4` și `HI7` verifică în continuare că nu există niciodată **mai mult de un
context WebGL viu** — doar că acum contextul de pe pagina de serviciu e cel legitim, iar ce nu are
voie să se întâmple e ca stadiul paginii principale să supraviețuiască navigării. Pin-ul paginii
principale rămâne verificat că dispare: el nu urmează vizitatorul.

**A patra era a mea.** Testul nou „o reîncărcare joacă intro-ul din nou" afirma valorile
contorului fără să instaleze înregistratorul, deci citea `undefined`. Comportamentul cerut trecea
deja — suprapunerea chiar e înapoi în HTML după reîncărcare; doar afirmația era scrisă greșit.
`recordIntroProgress` e un script de inițializare, deci se rearmează singur la reîncărcare și
înregistrează a doua rulare.

**Verificat:** cele trei specuri atinse re-rulate integral — **66/66**.

Fișiere: `e2e/preloader.spec.ts`, `e2e/hud-integration.spec.ts`, `e2e/interior-webgl.spec.ts`.

---

## 2026-09-20 — Fixed & Changed: mașina intro-ului citește ca un obiect, nu ca o carte de neon

Lotul de reglaj vizual (α5) al rescrierii intro-ului. Codul a aterizat; asta e înregistrarea lui.
Reglajul s-a făcut pe o captură cadru-cu-cadru și a scos la iveală **cinci defecte pe care nu le
avea nimeni pe listă** — toate compilau, toate desenau, toate treceau testele de atunci.

**Modelul de iluminare s-a schimbat: muchia, nu fața.** `pow(1 - |n·v|, power)` e un **detector de
siluetă** — o funcție de unghiul feței față de lentilă și de nimic altceva. Pe un tub fiecare
fragment are normala lui, deci desenează un chenar subțire și forma se citește. Pe o cutie o față e
PLATĂ: toate fragmentele ei au aceeași normală, deci termenul e practic constant pe toată fața, iar
puntea de 2,4 × 1,62 se aprindea uniform — o masă luminoasă solidă, cu tastele și trackpadul ca
dreptunghiuri pline. Ce citește o cutie e **unde se întâlnesc fețele ei**, și asta e un fapt despre
geometrie, nu despre cameră. `three/edge.ts` poartă acum măsura de muchie a scenei interioare
(`SURFACE_MODE.edges`): pe cutia unitate `abs(position) * 2` merge de la 0 în centrul unei fețe la
1 la marginea ei; cel mai MARE dintre cele trei e 1 pe toată fața lui și cel mai MIC e 0 prin
mijlocul cutiei, deci niciunul nu spune nimic singur — cel din MIJLOC ajunge la 1 doar unde se
întâlnesc două fețe. Se aruncă maximul și minimul (`x + y + z - hi - lo`) și rămâne o distanță
curată 0 → 1 până la cea mai apropiată dintre cele douăsprezece muchii.

Deci: fețele aproape stinse (`face` 0,003), muchiile duc lumina (`edge` 0,36), fresnelul retrogradat
la adaosul razant care trebuia să fie de la bun început (`fres` 0,006 în spatele lui `power` 2,6).
Banda începe la `soft` 0,88 — 6% din semi-extinderea fiecărei fețe, mai strâns decât cei 8% ai
modelului interior (0,84), pentru că prin mașina ASTA se zboară, iar o șină de aerisire care
traversează lentila la 0,025 transformă orice bandă mai lată într-o pată albă. **Constantele mici nu
sunt greșeli de tipar:** ieșirea shaderului e codată sRGB (`#include <colorspace_fragment>`), care
jos la valorile astea e aproximativ o radical, deci 0,003 de lumină liniară înseamnă ~6% pe ecran,
nu 0,3% — iar `DoubleSide` pictează fiecare pixel al punții de **două ori**. La `face` 0,04 asta era
o masă magenta solidă. Măsura e și scale-invariantă (banda e o fracțiune din extinderea PROPRIE a
fiecărei cutii), deci o șină de 0,012 și puntea de 2,4 primesc fiecare o muchie proporțională, în
loc ca șina să devină o bară plină. Halo-ul (`EDGE_HALO`) nu primește față deloc și primește o bandă
mult mai largă și mai moale (`soft` 0,55, `edge` 0,16, `fres` 0,06), ca să fie o înflorire în jurul
muchiilor fiecărei piese, nu o a doua mașină înăuntrul primei.

**Șasiul a căpătat un interior.** Lespedea punții era `FrontSide`, deci din cavitate fețele ei
dinăuntru erau eliminate: la cadrul pe care aterizează dizolvarea din SVG — K2, u 0,40 — nu exista
literalmente nici perete, nici podea, nici tavan. Trei butuci de balama și câteva trasee plutind în
negru. `DoubleSide` pe materialul instanțiat comun costă **zero draw call-uri**, și ăsta e singurul
motiv pentru care cavitatea poate avea un interior într-un buget de șase — e și exact ce face
modelul interior, din motivul pe care îl scrie el însuși („both sides, so every box edge shows").
Peste asta, câmpul de nervuri al plăcii a crescut de la 0,34 la **0,9** de o parte și de alta a
liniei de mijloc (la 0,34 nervurile erau o dungă subțire pe centrul unui cadru altfel negru, iar
compoziția pe care o cere `cameraPath.ts` la K2 — „câmpul de nervuri al podelei de-a latul părții de
jos" — pur și simplu nu era adevărată), plus **două șine longitudinale** la ±0,52, ca podeaua să fie
o grilă în perspectivă și nu o scară.

Și o **grilă de aerisire** stă acum în deschidere. Pe un obiect amestecat aditiv, care nu scrie
adâncime, nu există așa ceva ca o gaură — nimic nu poate fi ocluzionat — deci o ieșire trebuie
DESENATĂ: șapte segmente ridicate în planul gurii (conturul aperturii și trei zăbrele), cu `aU` = 1,
deci se aprind ultimele din tot. Curentul iese din die, curge pe nervuri și trece prin gaură, în
ordinea asta și într-un singur val. 39 de segmente în total, tot într-un singur buffer. Iar
`setLite` păstrează **traseele die-ului și grila** (primele 30 de vârfuri, `keepVertices`) și
renunță la podea — nu invers: pasul guvernatorului n-are voie să golească exact cadrul pe care
aterizează dizolvarea.

**Timpul 3 era țintit spre cer gol.** `cameraPath.ts`, K3: `ty` **0,55 → 0,18**. Măsurat la 16:10,
toată mașina stătea sub marginea de jos a cadrului de la u 0,46 până la u 0,63 — camera era
înclinată ~22° în sus — și doar capacul care se ridică după 0,64 aducea ceva înapoi în cadru.
Poziția NU poate fi ridicată: camera trebuie să iasă printr-o gaură de 0,067 înălțime, deci `py` e
fixat la 0,092 de raza de ieșire, și singurul lucru liber aici e **ținta**. Puntea e la y 0 și
capacul deschis ajunge la y 1,37, deci ținta aparține jos, lângă punte: mașina umple atunci cadrul
din treimea de jos în sus și capacul crește din vârful ei, ceea ce ȘI ESTE timpul. **Nimic altceva
nu s-a mișcat** — `resolveKey` cheltuie doar `tx`/`tz` pentru lărgire și lasă `py` în pace, deci
ieșirea prin gura de aerisire, trecerea pe lângă planul capacului la K4 și distanța de acoperire la
K5 sunt identice bit cu bit.

### Cele cinci defecte găsite în captură

1. **Lespedea de acoperire ascundea ecranul.** `MeshPhysicalMaterial` scrie adâncime din oficiu și
   era **singurul scriitor de adâncime** într-o scenă altfel complet aditivă; suprafața ei stă mai
   în față decât display-ul, iar three desenează lista transmisivă ÎNAINTEA celei transparente —
   deci ecranul cădea testul de adâncime pe fiecare pixel. **Timpii 4 și 5 se terminau pe un
   dreptunghi negru**, adică exact pe cadrul spre care zboară tot filmul. Nimic nu citește bufferul
   ăsta, deci `depthWrite = false` nu costă nimic, iar cadrul, halo-ul și display-ul se compun
   aditiv peste lespede, așa cum trebuia. (`Fixed`.)
2. **Închis, capacul stă cu fața în jos** — deci lespedea privea direct în cavitatea prin care
   zboară camera: o carte plată de 2,4 × 1,5 de mediu refractat, dreaptă peste o treime din cadru,
   prin toți timpii 2-3. Exact „cartea de neon" de care există lotul ăsta ca să scape. Lespedea a
   devenit **plan, nu cutie** (o cutie are o talpă, iar talpa e orientată spre față privită de jos;
   `thickness` e o uniformă, nu o măsurătoare a geometriei, deci un quad refractă exact ca cele
   douăsprezece triunghiuri) și e ascunsă până când unghiul capacului nu mai e zero. E vizibilă când
   se compilează scena (`compileAsync` parcurge `traverseVisible`), deci **niciun shader nu se
   compilează în zbor** — și **nu există niciun pas de transmisie** în cei trei timpi cei mai
   scumpi, care sunt și cei în care bugetul de cadru e cel mai strâns.
3. **Iridescența pe o lespede plată e o singură nuanță plată.** E un tent dependent de unghi: pe un
   tub fiecare fragment are unghiul lui, deci scânteiază; pe un capac plat care umple deschiderea e
   un unghi și o culoare, iar la 0,45 tot display-ul ieșea un teal de ardezie așezat peste ecran fie
   că ecranul desena, fie că nu. Acum **0,18** (+ 0,2 × puls), și rămâne peste 0, ca define-ul de
   iridescență să nu comute și shaderul să nu se recompileze. În același sens a fost re-țintit și
   mediul PMREM (`three/environment.ts`): benzi mai înguste și mai luminoase, așezate **oblic** față
   de normala capacului deschis (0, 0,29, 0,96) în loc de frontal — o oglindă plată eșantionează un
   con îngust din mediu, deci o sursă frontală ar fi spălat toată lespedea cu o singură culoare, iar
   una care nu e frontală n-ar fi aterizat nicăieri. Ce mătură lespedea când se ridică capacul e
   acum o dâră cu margine tare.
4. **Placa die-ului era cel mai plat lucru din film.** Un quad de 0,26 × 0,26 peste care camera
   zboară la 0,03 nu e un cip pe o placă — e **podeaua**, și umplea jumătatea de jos a cadrului cu
   un singur `--dark-cyan` neîntrerupt. Despărțită într-un al doilea `createRingMaterial`, condus de
   **același** `uFill` și același `uHead` scrise în fiecare cadru — deci tot un singur val peste die
   și apoi peste nervuri, și tot două draw call-uri (erau oricum două meshe). Diferă numai prin
   putere: `DIE_GAIN` 0,5 față de `BOARD_GAIN` 3, adică placa mult mai întunecată decât traseele
   fir-de-păr care curg peste ea, care e cum arată un procesor de la un milimetru deasupra lui.
5. **Display-ul era o pastilă plată de culoare** — și e cadrul pe care aterizează tot zborul.
   `createRingMaterial` n-are textură și n-are a doua culoare, deci fiecare fragment al unui quad
   aprins e aceeași valoare. Are acum **mobilier**: o ramă interioară la 4%, patru rânduri de
   „ieșire" de lungimi neregulate jos pe panou și un bloc în colț, toate în **aceeași geometrie
   indexată și la același singur draw call**, toate aditive, deci mobilierul pur și simplu curge mai
   tare decât câmpul pe care stă. `aU` rămâne coordonata verticală a FIECĂRUI vârf, mobilier
   inclus — deci un rând la 30% înălțime se desenează la `uFill` 0,30 și mobilierul apare
   **înăuntrul** ștergerii, în loc să se aprindă peste ea.

**Și particulele.** Norul se aprinde acum pe măsură ce camera iese prin gura de aerisire
(`smoothstep(0.42, 0.68, uFlight)`) și o face ca **dimensiune**, nu doar ca alfa, deci un sprite
ascuns nu costă nici fill. Înainte orbitele (1,5–2,4 în diametru) stăteau la centimetri de o lentilă
aflată în origine, fiecare sprite se plafona la `uMaxSize`, iar singurul timp care trebuie să
citească drept canion îngust se umplea de pete moi. Separat, aruncarea burst-ului era
`p.z += uExplode * 3.0` — scrisă pentru un rig parcat pe axa +z a LUMII. Cu o cameră care zboară, și
care privește aproximativ spre −z când pornește burst-ul, linia arunca norul prin **spatele**
cadrului. Se face acum în **spațiul de vedere** (`mv.z += uExplode * 2.4`), unde −z e întotdeauna în
ecran oricum ar sta camera; un `uExplode` negativ tot trage norul dinspre lentilă, adică
imploziunea, exact ca înainte.

### Ce NU e încă bine

Scris aici pentru că următorul om o să vadă exact lucrurile astea și merită să știe că sunt
cunoscute, nu ratate.

- **Saturare la distanță mică.** Pasajul gurii de aerisire și șinele cavității se albesc. Banda de
  muchie e o fracțiune fixă din fiecare cutie, deci o șină de 0,012 aflată la 0,025 de lentilă
  acoperă mult ecran, iar amestecul aditiv n-are nicio rezervă. Reparația adevărată e **tone
  mapping**, pe care `<Canvas flat>` îl refuză dinadins.
- **Treimea de jos a cadrului dizolvării e tot subțire.** K2 stă la 0,017 deasupra traseelor plăcii
  și la 0,29 în fața butucilor de balama (0,34 de planul gurii de aerisire), iar raza de ieșire
  fixează ambele numere.
- **Timpul 3 e țintit corect, dar e tot un cadru foarte jos.** Ridicarea lui cere o **a șaptea cheie
  de cameră** sau o gură de aerisire mai sus — nu o mutare a lui K3, care e prinsă de gaură.
- **Particulele burst-ului sunt practic invizibile.** Axa e acum corectă, dar norul orbitează
  originea, iar la K5 originea e la 0,22 în fața lentilei și la 1,08 lateral, cu semi-înălțimea
  cadrului acolo de 0,17: aproape nimic din ce aruncă burst-ul nu traversează cadrul.
- **Câmpul display-ului e o singură culoare plată sub mobilierul lui**, fiindcă `createRingMaterial`
  are o culoare și n-are textură.
- **Și o atribuire greșită, ca să nu se repete.** Reglajul a pus glow-ul circular moale din ultima
  secundă pe seama halo-ului desenului static. **Nu e el**: halo-ul trăiește în
  `[data-part="fallback"]`, pe care `sceneReady` îl duce la `autoAlpha: 0`. Cercul e
  `data-part="shock"` — inelul de șoc al burst-ului (`border-radius: 50%` în
  `IntroPreloader.module.css`), preexistent și intenționat. Verificat în cod.

### Draw call-uri și teste

**Draw call-uri, acum** (citite din `intro-laptop.test.ts`): high **6** în regim, **5** cât timp
capacul e închis (lespedea e ascunsă), **4** la pasul „lite" al guvernatorului (pleacă și halo-ul);
mid și low **4** tot timpul. Exact **o** suprafață transmisivă în scenă, și numai pe high.

**Testele.** Lotul a adăugat un singur `describe` — „the three settings that fail SILENTLY and in
the picture", 3 teste — în `components/__tests__/intro-laptop.test.ts` (16 → **19**). Pinuiește
NUMAI setările care cad tăcut **și în imagine**: materialul cadrului e `DoubleSide`, lespedea nu
scrie niciodată adâncime, iar placa și traseele primesc un singur `uFill` și un singur `uHead`, cu
placa mai întunecată dintre cele două. Fiecare dintre ele a costat o captură cadru-cu-cadru ca să
fie găsită, pentru că revenirea la vechea valoare compilează, desenează, trece toate celelalte teste
din fișier și costă exact aceleași draw call-uri. **Nimic reglat pe ochi nu e pinuit** — nici
`face`/`edge`/`fres`/`soft`, nici `DIE_GAIN`/`BOARD_GAIN`/`SCREEN_GAIN`, nici `ty`-ul lui K3: un
prag pe un număr ales estetic e un test care se schimbă odată cu ochiul, nu o verificare.

### Docs aduse la ce face codul

- [`docs/05`](./docs/05-page-sections.md) — secțiunea intro-ului, scrisă „as built" și adusă la zi
  pentru rescriere de cineva care nu putea vedea lotul ăsta: ținta timpului 3 și de ce nu poate fi
  ridicată poziția; cadrul desenat pe **ambele fețe** și de ce e portant, nu ordonat; lespedea de
  acoperire care apare abia când capacul se mișcă (și care nu scrie niciodată adâncime); placa și
  traseele ca **două** materiale pe **un** val; interiorul procesorului la 39 de segmente, cu grila
  gurii de aerisire; ce păstrează pasul „lite" al guvernatorului.
- [`docs/14`](./docs/14-testing.md) — rândul „Intro flight": `intro-laptop.test.ts` 16 → 19 și cele
  trei setări care cad tăcut și în imagine.
- [`docs/03`](./docs/03-architecture.md) și [`docs/07`](./docs/07-conventions.md) — **verificate,
  nemodificate**: lotul n-a adăugat și n-a șters niciun fișier, n-a mutat nicio responsabilitate și
  n-a atins nici lista de importuri interzise, nici modulele de scriere per-cadru.

> **Nerulat pentru această intrare**, ca și pentru celelalte loturi ale rescrierii: `npm test`,
> `npm run lint`, `npm run build` și re-baseline-urile declarate sunt lotul de închidere și se fac o
> singură dată, la final. Numerele de aici sunt citite din cod și din tabela de chei, nu măsurate în
> browser; cele marcate „măsurat" vin din captura de reglaj.

**Fișiere:** `components/intro/three/edge.ts` · `components/intro/three/laptop.ts` ·
`components/intro/three/cameraPath.ts` (numai `ty`-ul lui K3) ·
`components/intro/three/materials.ts` · `components/intro/three/particles.ts` ·
`components/intro/three/environment.ts` · `components/__tests__/intro-laptop.test.ts` · docs:
[`05`](./docs/05-page-sections.md), [`14`](./docs/14-testing.md).

---

## 2026-09-20 — Changed & Removed: scena 3D a intro-ului e camera care zboară prin mașină

Lotul de integrare 3D al rescrierii intro-ului (α4) — cel care leagă cinematica de React și de
renderer. A aterizat fără intrare proprie; asta e. Tot aici pleacă semnul infinit din cod.

**Camera zboară, obiectul stă.** `components/intro/three/rig.ts` a fost rescris. Vechiul rig
**încadra obiectul în viewport**: un grup de fit care scala ∞-ul până încăpea, plus `fitRig`,
`fitWidthFraction`, `baseHalfHeight`, `RigFit`, `RIG_HALF_WIDTH`, `RIG_FIT`, `MAX_YAW` și
perechile `BASE_Z`/`DOLLY_Z` (6 → 0,9) și `BASE_FOV`/`DOLLY_FOV` (40° → 72°). Toate au plecat.
Poziția, ținta, unghiul și înclinarea se citesc acum dintr-**un singur scalar**, `fx.flight`,
prin `cameraAt` (`three/cameraPath.ts`); rig-ul cheltuie poza, nu o mai calculează. Înclinarea se
cheltuie ca vector `up` al camerei, nu ca rotație după `lookAt`: `lookAt` rezolvă orientarea din
țintă **și** din `up`, deci înclinarea trebuie să intre înainte, nu după.

**Legănarea e o FEREASTRĂ, nu o rampă** (`SWAY` + `swayWeight`, pure, testate fără three). E
stinsă la ambele capete, și niciunul nu e o alegere estetică:

- **sub `flight` 0,35 camera e în procesor.** Pereții sunt la un centimetru de lentilă și ei SUNT
  cadrul; o panoramare de două grade acolo balansează toată imaginea, iar obiectul pare că se
  rotește în jurul lentilei. Nefilmabil. Timpii 1-2 sunt oricum un cadru ținut — K0 → K1 se mișcă
  0,04 unități cu totul.
- **peste 0,86 camera se închide pe ecran**, pe care K5 îl așază exact la distanța de acoperire:
  ecranul umple cadrul cu margine zero. Orice rest de panoramare acolo deschide o fâșie de fundal
  pe ultimul cadru al intro-ului.

Între ele — K3 și K4, mașina văzută întreagă din afară — merge la greutate plină: ±0,04 rad derivă
pe două perioade care nu se împart una în alta (figura nu se repetă), plus parallaxul pointerului,
ponderat cu aceeași rampă. Legănarea stă pe **cameră** (`rotateY`/`rotateX`, adică o panoramare și
o înclinare), nu pe obiect: adunată la ȚINTĂ ar fi rotit camera în jurul mașinii.

**`components/intro/IntroLaptop.tsx` (nou)** — învelișul R3F subțire peste `three/laptop.ts`:
construit o dată, `update` din `useFrame`, `setLite` de la governor, `dispose` la demontare.
Ia locul lui `InfinityCore.tsx`.

**`IntroScene.tsx`: `near` 0.1 → 0.01, `far` 40 → 14.** Primul e obligatoriu — timpii 1-3 se
zboară **pe dinăuntrul** șasiului, iar cavitatea are 0,066 de o parte și de alta a liniei ei de
mijloc, deci un plan apropiat la 0,1 ar fi tăiat tavanul pe fiecare cadru al lor. Al doilea îl
plătește pe primul: cel mai departe ajunge camera sub 10 unități (K4, retras la plafonul de
lărgire pe cel mai îngust viewport), iar raportul 1400:1 încape confortabil într-un buffer de
adâncime de 24 de biți — 4000:1 al vechii perechi nu ar fi încăput, atât de aproape. Poziția și
unghiul inițiale sunt **K0 însuși** (`cameraAt(0, 1)`), ca primul cadru pictat să fie deja pe
zbor, nu într-o origine de la care rig-ul apoi sare. **Grupul de fit a dispărut**: mașina stă în
origine la dimensiunea ei modelată și camera face drumul.

**`tiers.ts`, refăcut.** Au plecat `tubular`/`radial` (segmentele de-a lungul curbei și în jurul
ei) și `rings` (inelele de scanare). **Detaliul mașinii NU e un număr aici**: cele 29 de piese
sunt un singur `InstancedMesh`, deci singura manetă e `mesh.count`, iar contorul trebuie să fie un
**indice în tabela de renunțare** — așa că stă lângă acea tabelă, în `three/laptop.ts`
(`LAPTOP_SLOT_COUNT` / `_MID` / `_LITE`). Două numere aici ar fi fost o a doua sursă de adevăr
pentru un singur tablou. A rămas ce costă cu adevărat pe tier: pixeli (`dpr`, `antialias`),
lespedea transmisivă, al doilea draw call al halo-ului, numărul de particule. `glass: "fresnel"`
înseamnă acum pur și simplu **„fără lespede"** — shaderul care ținea locul sticlei a plecat cu
∞-ul, deci mid și low au un shader mai puțin de compilat, exact pe dispozitivele care compilează
greu.

**`createParticleMaterial`: `uSize` 0,06 → 0,028.** Nu e o reglare pe ochi, e consecința directă a
scoaterii grupului de fit: shaderul citește `length(modelViewMatrix[0].xyz)` ca `modelScale`, care
era scara de încadrare și e acum 1. Peste asta, camera e mult mai aproape — K4 stă la 2,4 unități
de origine, unde vechiul rig stătea la 6 — iar dimensiunea unui punct e invers proporțională cu
adâncimea în vedere. 0,06 la 6 unități printr-un obiectiv de 40° și 0,028 la 2,4 printr-unul de
46° cad pe aceiași câțiva pixeli, adică pe ce înseamnă o particulă de lumină. Plafonul de
fill-rate (`gl_PointSize = min(..., uMaxSize)`) rămâne neatins.

### Removed — semnul infinit, din cod

**Fișiere întregi:** `components/intro/lemniscate.ts` (curba și `LEMNISCATE`) ·
`components/intro/InfinityCore.tsx` · `components/intro/three/core.ts` ·
`components/intro/three/geometry.ts`.

**Din `three/materials.ts`:** `TUBE_VERTEX` și cele trei fabrici care depindeau de el —
`createFresnelGlass` (+ `FresnelGlassUniforms`), `createRimMaterial` (+ `RimUniforms`,
`RimOptions` și preseturile `RIM` / `HALO`) și `createPulseLineMaterial` (+ `PulseLineUniforms`).
Toate citeau `uv.x` ca lungime de arc pe o buclă închisă și extrudau pe normală
(`position + normal * uWidth`) — ceea ce pe un tub lărgește învelișul, iar pe o cutie desparte
cele șase fețe în șase plăci detașate. Nu erau de „adaptat". Identitatea vizuală însă a trecut
neatinsă în `three/edge.ts`: formula fresnel verbatim, `GLOW_BLENDING`, `glowAlpha`, culorile
citite din paletă. Ce a rămas în `materials.ts` — `createPhysicalGlass`, `createRingMaterial`,
`createParticleMaterial` — a trecut integral.

**Din `fx.ts`:** `dolly` și `spin`, înlocuite de un singur `flight`. Un parametru în loc de doi
înseamnă că nu există un al doilea număr de ținut în pas și că un „sari peste" de la orice timp e
același tween spre 1.

**Din listele de importuri grele:** linia `components/intro/lemniscate.ts` din
`PAGE_BUNDLE_ROOTS`, în `eslint.config.mjs` **și** în
`components/__tests__/scene-contract.test.ts`. Asta nu e curățenie cosmetică: `listFiles` întoarce
`[]` pentru o cale care nu există, deci o rădăcină care numește un fișier șters **încetează pur și
simplu să verifice ceva** — tăcut, și verde. `IntroFallback.tsx` rămâne în ambele liste și e în
continuare ce ține three.js departe de desenul static.

**`ORBITS` din `three/random.ts` NU a fost șters**, deși figura pe lista de ștergeri: e citit de
`buildOrbitAttributes` în același fișier, care alimentează particulele — iar ele au rămas în
scenă. Lăsat la locul lui, intenționat.

### Docs aduse la ce face codul

- [`docs/05`](./docs/05-page-sections.md) — secțiunea intro-ului era scrisă „as built" pe ∞ și a
  fost rescrisă: tabela celor șase timpi cu banda de progres, `u`-ul și **cine îi desenează**;
  de ce timpii 1-2 sunt desenul plat pe fiecare dispozitiv (pânza stă la `opacity: 0` până la
  `sceneReady`, iar fără semnalul scenei bara nu trece de 0,60 — exact unde se termină timpul 2),
  deci de ce dizolvarea e o tăietură pe potrivire la `u` 0,40; `SCENE_CUTOFF` explicat ca **termen
  de 5 secunde**, nu ca poartă la 80% din bară, plus garda `LATE_SCENE_GOAL`; cele 29 de piese
  într-un singur `InstancedMesh` și cele șase draw call-uri; tier-urile și pașii governorului
  scriși pe ce renunță de fapt; și o secțiune nouă despre desenul static.
- [`docs/03`](./docs/03-architecture.md) — arborele `components/intro/` (fișierele noi și cele
  șterse) și cine ce deține: `flight.ts` (progres → zbor, modul separat fiindcă dirijorul are
  nevoie de el și pe calea fără WebGL) și `three/cameraPath.ts` (lista de cadre **și**
  măsurătorile mașinii, pe care `three/laptop.ts` le importă în loc să le redeclare).
- [`docs/02`](./docs/02-tech-stack.md) (rândul three.js și tabela de licențe) ·
  [`docs/04`](./docs/04-design-system.md) (lista schimbărilor de design) ·
  [`docs/07`](./docs/07-conventions.md) (lista de importuri grele fără `lemniscate.ts`, plus
  regula că un fișier șters trebuie să iasă din ea; modulele de scriere per-cadru; „desenul static
  nu mai e o cale de rezervă") · [`docs/14`](./docs/14-testing.md) (numărătorile intro-ului și
  rândul nou „Intro flight" pentru `intro-camera-path` și `intro-laptop`).

**Datorie găsită pe parcurs și plătită aici, fiindcă e în aceleași secțiuni:** documentația
descria încă un intro care se joacă **o dată pe sesiune de browser** și un cookie `tbs_intro`
scris de site. Codul (`lib/intro.ts`, `app/(site)/cookies/content.ts`) spune de ceva vreme
altceva — intro-ul se joacă la fiecare încărcare directă a paginii principale, cookie-ul se
numește `tbs_intro_skip` și **site-ul nu-l scrie niciodată**, doar îl citește, ca o rulare de teste
să-l poată semăna. Corectat în `docs/03`, `docs/05`, [`docs/11`](./docs/11-security.md) (tabela
cookie-ului), [`docs/14`](./docs/14-testing.md) (ce seamănă `gotoHydrated`),
[`docs/16`](./docs/16-i18n-seo.md) (§„The first-visit intro and SEO") și
[`SECURITY.md`](./SECURITY.md).

**Și în suita e2e, care afirma vechiul comportament.** `e2e/preloader.spec.ts` cerea ca intro-ul să
scrie cookie-ul și ca o reîncărcare să fie „o vizită de întoarcere" — adică exact defectul raportat
(„la refresh nu lucrează"). Testele spun acum ce face codul, și păzesc reparația din două părți:
**nu se scrie niciun cookie** și numele vechi e șters (semănat înainte, verificat dispărut după),
**o reîncărcare joacă intro-ul din nou** până la 100, iar un cookie semănat de QA sau de suită e
în continuare onorat (fără suprapunere, fără three.js, fără WebGL). Skip-ul, Escape și ocolirea nu
mai pretind că lasă „seen" în urmă. `e2e/interior.spec.ts` semăna numele vechi direct într-un
antet `cookie:` — folosește acum `INTRO_COOKIE`, deci nu mai cerea pagina cu intro-ul pornit fără
să vrea. `e2e/helpers.ts` și `e2e/README.md` descriu la fel.

> **Nerulat pentru această intrare.** Verificarea grea a rescrierii — `npm test`, `npm run lint`,
> `npm run build`, măsurătorile B3i / B4 / H / B5 și re-baseline-ul lor scris — e lotul de
> închidere și se face o singură dată, la final. Numerele de aici sunt citite din cod, nu măsurate
> în browser.
>
> Constatat și neatins: două comentarii din `IntroDirector.tsx` (explozia fără WebGL) încă spun
> „the SVG ∞ draws in" și „a 2.6x full-screen layer", deși factorul e 4.6 și desenul e o mașină.

**Fișiere:** `components/intro/three/rig.ts` (rescris) · `components/intro/IntroLaptop.tsx` (nou)
· `components/intro/IntroScene.tsx` · `components/intro/tiers.ts` ·
`components/intro/three/materials.ts` · `components/intro/fx.ts` · `eslint.config.mjs` ·
`components/__tests__/scene-contract.test.ts` · `components/__tests__/intro-math.test.ts` ·
`components/__tests__/intro-scene-math.test.ts` · **șterse:** `components/intro/lemniscate.ts`,
`components/intro/InfinityCore.tsx`, `components/intro/three/core.ts`,
`components/intro/three/geometry.ts` · docs: [`02`](./docs/02-tech-stack.md),
[`03`](./docs/03-architecture.md), [`04`](./docs/04-design-system.md),
[`05`](./docs/05-page-sections.md), [`07`](./docs/07-conventions.md),
[`11`](./docs/11-security.md), [`14`](./docs/14-testing.md), [`16`](./docs/16-i18n-seo.md),
[`SECURITY.md`](./SECURITY.md).

---

## 2026-09-20 — Changed: desenul static al intro-ului nu mai e semnul infinit, ci mașina

Fallback-ul SVG (fără WebGL, dispozitiv lent, scenă care cade) desena o lemniscată din sticlă cu
comete și orbite. Desenează acum un **laptop 16:10 cu capacul la 107°**, exact `LID_ANGLE.open`
(1,87 rad) din `components/scene/three/models/laptop.ts`, văzut trei sferturi de sus-stânga — ca
desenul și scena 3D să fie recunoscute ca **același obiect**, nu ca două lucruri diferite.

**De ce e mai mult decât o schimbare de artă.** Pânza 3D (`.canvasHost`) stă la `opacity: 0` până
la `sceneReady`, iar `ready` nu poate trece de 0,60 fără semnalul scenei. Deci **primii doi timpi
ai filmului — „în procesor" și „alimentarea" — sunt văzuți pe desenul plat, pe fiecare
dispozitiv**, nu doar acolo unde lipsește WebGL. Ferestrele desenului sunt aceleași cu tabela de
timpi a camerei 3D, deci dizolvarea de la `sceneReady` e o **tăietură pe potrivire** (SVG-ul iese
din die, 3D-ul intră la gura de aerisire), nu o reluare.

**Un singur canal de scrub.** Directorul scrie `--fb-p` (0 → 1) pe `[data-part="fallback"]` o
dată pe cadru; fiecare piesă își taie fereastra din el în CSS cu `clamp()`. Fără `@property` —
`calc()` citește proprietățile custom neînregistrate, iar nimic nu animează `--fb-p`, deci
înregistrarea ar costa doar compatibilitate. Ferestrele: `0–0,24` pe die · `0,24–0,60`
alimentarea prin cele 14 trasee (complete la 0,58) · `0,60–0,86` ieșirea prin șasiu, pe lângă
gura de aerisire · `0,60–0,84` mașina se compune și capacul se deschide · `0,78–0,94` ecranul se
trezește · burst-ul rămâne al directorului.

**Cum e construit.** Trei planuri, fiecare un `transform="matrix(...)"`, deci tot ce e înăuntru e
`<rect>`/`<circle>` aliniat pe axe, generat din tabele. Repetiția e `<pattern>` (45 de taste,
~200 de bile BGA, aripioare, via-uri = 2 noduri fiecare) și `<symbol>`+`<use>` (12 blocuri
funcționale, 4 nuclee, 6 condensatoare, 4 colțare). Cele 14 trasee ale die-ului și cele 16 ale
plăcii sunt fiecare **un singur `<path>` cu subcăi**, desenat o dată în `<defs>` și purtat de
trei `<use>` (halo, miez, puls): dash-ul curge peste subcăi, deci se aprind **în ordine** dintr-un
singur `stroke-dashoffset`. Balamaua nu e o rotație în spațiul ecranului, ci
`scaleY(sin ψ) skewX(...)` în planul propriu al capacului, cu `ψ = 92° × --lid`.

**Poza de repaus, pentru LCP.** Înainte de orice JS se desenează **mașina întreagă, compusă,
adormită** (ecran stins, totul la 0,55): 76 de noduri, exact cât avea ∞-ul. Straturile `fbDie` și
`fbBoard` sunt `display: none` până la `[data-live]` — parsate, niciodată dispuse sau pictate
înainte ca `<h1>`-ul de sub suprapunere să fie elementul LCP. Dacă JS nu ajunge niciodată,
vizitatorul vede 7 secunde o mașină întreagă, nu un pătrat de trasee.

**Cele cinci numere CSS, re-derivate împreună** (nimic nu asertă că se potrivesc, deci se schimbă
în același commit): `--intro-cy` 47% → **45%** (portret 42% → 40%) · `--hud-top` `×0.2` →
**`×0.25`** (tălpile ajung la +94 din cele 480 de unități viewBox: 94/480 × 1,28) · `.fbStage
width` `×1.5` → **`×1.28`** (mașina e 346,3 unități lată, deci iese 0,923 `--intro-w`) ·
`.fallback transform-origin` de la `50% var(--intro-cy)` la **centrul ecranului**
(`calc(50% + w*0.082) calc(cy - w*0.182)`, din proiecția lui (120, 78.75) în planul capacului) ·
`--intro-w` și `aspect-ratio: 480 / 300` **neschimbate**, ca `.flash`, `.shock` și centrarea să
nu se re-derive.

`EdgeGradient`, `.stopRed*`/`.stopCyan`/`.stopBlue` și clasele de sticlă (`.fbGlass`, `.fbSheen`,
`.fbCore`) rămân neatinse — ele sunt identitatea, nu lemniscata. Zero text în desen, deci zero
chei de catalog și nicio dependență de font înainte de `document.fonts.ready`.

**Fișiere:** `components/intro/IntroFallback.tsx` (rescris) · blocul `.fb*` și liniile 26-28 / 83
din `components/intro/IntroPreloader.module.css` · `components/__tests__/intro-preloader.test.tsx`
(`path[filter]` → `[filter]`, pentru că halo-ul e acum două `<use>`; plafoanele „exact două
`feGaussianBlur`" și „exact două elemente filtrate" rămân).

**Măsurat.** 167 de noduri în total, **76 la primul paint** (plafon 80) · 2 `feGaussianBlur`, 2
elemente filtrate · markup 13.266 B brut / 2.634 B gzip (∞-ul: 28.753 / 1.091 — brut la jumătate,
gzip **+1.543 B**, pentru că `LEMNISCATE_PATH` se repeta de 16 ori și LZ77 îl strivea, iar o
mașină n-are ce dedupa). `IntroFallback.tsx` **16,6 KB** (plafon 12,5 KB; codul singur, fără
comentarii, e 12,5 KB) · blocul `.fb*` **8.245 B**, +3.068 brut / +917 gzip (plafon +2 KB brut).
**Ambele depășiri cer re-baseline pe H și B5, declarat aici, nu descoperit la poartă.**

## 2026-09-20 — Fixed: datoria de teste și lint a frontend-ului, adunată de la rescrieri

`tsc --noEmit` raporta **49 de erori**, toate în teste, toate descriind cod care fusese înlocuit
intenționat, iar `npm test` cădea cu **48 de teste în 13 fișiere**. Lint-ul avea trei erori
`react-hooks/set-state-in-effect`, toate în `components/sections/DirectionPage.tsx`. Regula ținută
peste tot: testul se aduce la ce face codul ACUM; nu se slăbește o verificare ca să treacă și nu se
umblă în cod ca să mulțumim un test vechi. Un test care descria o funcție scoasă dinadins a fost
șters, cu motivul scris mai jos.

**Erorile de tipuri (49 → 0).**

- **`stage` în `SceneInput`** (pasul din „Cum lucrăm" pe care stă modelul): 35 de erori într-un
  singur ajutor din `scene-choreography.test.ts`, care construia intrarea fără câmp. Adăugat
  `stage: -1` („niciun pas"); `stepSceneFx` oricum nu-l citește — lumea ține modelul pe un pas, nu
  stratul de netezire.
- **Tema deschisă scoasă** (58b18ee) luase cu ea `--blue-text` și `--red-text` din `SCENE_TOKENS`:
  cheile `blueText` / `redText` au dispărut din paletele-fixtură ale testelor `scene-build`,
  `scene-helix-model`, `scene-mesh-wave`, `scene-trail` și `scene-palette`.

**Teste șterse, cu motivul fiecăruia.**

- `scene-palette.test.ts`: `relative luminance splits the two themes`, `light tokens → ink`,
  `samePalette compares every role`, `tryReadScenePalette keeps quiet on a bad token` și tot
  `describe("observeThemeChange")`. Cele cinci exporturi pe care le chemau
  (`INK_LUMINANCE`, `relativeLuminance`, `samePalette`, `tryReadScenePalette`,
  `observeThemeChange`) au plecat odată cu tema deschisă — pagina e mereu aproape neagră, deci
  `pickSceneRoles` are un singur mod. Verificarea că un token stricat aruncă o eroare care îl
  numește a rămas, mutată pe `readScenePalette`, și s-a adăugat una care fixează cele cinci roluri
  rămase.
- `scene-helix-model.test.ts`: paleta-fixtură `INK` și cele două perechi de aserțiuni care
  comutau tema pe ea (`uInk` = 1, baza de 0,85 a hologramei în ink). `uInk` supraviețuiește în
  shadere, permanent 0, exact cum scrie comentariul modulului; testele spun acum asta.
- `direction-page.test.tsx`: `shows the reference project itself` și `shows the assistants
  direction's reference project instead of an offer summary`. Cardul de referință de sub modelul
  din hero a fost scos pe 2026-09-18 — proiectul pe care îl numea e primul card din „Proiecte
  relevante" și duce mai departe linkul din bara de acțiuni. `describe`-ul „hero card" s-a
  redenumit după ce a mai rămas în el: schema de flux, mutată lângă pașii „Cum lucrăm".

**Teste aduse la ce face codul acum.**

- **Modelele scenei s-au reașezat**: cheia din `SERVICE_MODEL` nu mai e și numele modelului —
  `cubes` e desenat de stiva de produs, `integration-hub` de bancul de conducte. `scene-build` cere
  acum numele reale ale grupurilor, iar ciclul cuburilor (`CUBE_CYCLE`, dintr-un fișier pe care
  lumea nu-l mai construiește) s-a înlocuit cu REGULA care a rămas: cât timp modelul încă intră,
  lumea îi dă pasul 0, deci blocul pe care aterizează roiul stă neclintit, iar bucla pornește abia
  după aceea.
- **`scene-contract.test.ts`** raporta `brandBoard.ts: snap`. Detectorul e o potrivire de text pe
  nume de opțiuni ScrollTrigger, iar `PART.snap` din acel model e cursorul care se aliniază la
  grilă — un indice, nu o opțiune de derulare. Subarborele `components/scene/three/` a ieșit din
  scanare, cu un test nou care plătește scutirea: **niciun fișier de acolo nu pomenește GSAP sau
  ScrollTrigger**, deci nu poate configura niciunul. Restul rădăcinilor se citesc în întregime, ca
  până acum.
- **`scene-laptop.test.ts`**: `laptopBootSettle` a fost rescrisă și acum se lasă puțin ÎNAPOI
  înainte de a porni (anticiparea care face zborul să pară aruncat, nu pornit) — testul cerea încă
  „nu merge niciodată înapoi". Cere acum ce face: o pierdere de cel mult a douăzecea parte din zbor,
  revenită pe pozitiv până la un sfert din el. La fel, piesa apropiată ajunge cu un fir peste slot,
  nu fix pe el. Descrierea-fixtură a proiectelor a fost lungită: încăpea în două rânduri, deci nu
  mai rămânea nimic de spus cu „…".
- **`lib/__tests__/scene.test.ts`**: instantaneele intrării primesc `stage: -1`, sonda de derulare
  primește cele cinci cutii adăugate între timp (`panels`, `panelsPitch`, `projects`, `steps`,
  `stepsPin`), iar `selectServiceStage` — care nu avea niciun test — are acum unul.
- **`direction-page.test.tsx`**: secțiunea „Proiecte relevante" poartă acum DOUĂ forme ale
  aceleiași liste — grila de carduri și lista ascunsă vizual care ține locul ecranului 3D pentru
  cine nu vede imaginea. Testele citesc grila (`[data-projects-track]`) și verifică pe lângă ea că
  lista ascunsă numește aceleași proiecte, în aceeași ordine, cu aceleași linkuri; linkul
  proiectului de referință se caută în bara de acțiuni, nu în toată pagina.
- **`directions-selector.test.tsx`**: pastilele nu se mai selectează pe `mouseenter` (1f16576 — un
  rând care derulează pe sub un cursor parcat primea oricum evenimentele de graniță și schimba
  singur serviciul, și cu el modelul 3D). Cele 19 `fireEvent.mouseEnter` au devenit
  `fireEvent.pointerMove`, iar remedierea are în sfârșit testul ei de regresie: pastila care ajunge
  sub un cursor nemișcat nu selectează nimic, iar un pixel de mișcare reală o selectează.
- **`header-condense.test.tsx`**: un test se baza pe derularea lăsată în urmă de cel dinainte și
  monta antetul DEJA condensat, comparând două stări identice. `renderNav()` pune acum `scrollY`
  pe 0 înainte de fiecare montare.
- **`scene-laptop.test.ts`, rulajul de proiecte**: jsdom 25 nu implementează
  `HTMLImageElement.loading` — proprietatea se citește `undefined` și scrisul ei nu ajunge la
  atribut — deci `warm()`, care o citește și o scrie exact ca o pagină, nu avea ce comuta. Testul
  își pune accesorul înapoi, exact cum îl definește specificația, și îl scoate după el.

**Lint: `react-hooks/set-state-in-effect` × 3, în `DirectionPage.tsx`, toate scoase fără nicio
dezactivare de regulă.**

- **Setul de cazuri deschise** și **indicele rulajului** se resetau în câte un efect legat de
  `slug`. Ambele sunt acum ȚINUTE PE DIRECȚIA pe care au fost numărate (`{ slug, names }`,
  `{ slug, at }`) și citite înapoi la gol în timpul randării. Un efect ar fi desenat pagina nouă o
  dată cu panourile paginii dinainte deschise și le-ar fi închis un render mai târziu.
- **Sosirea machetei în ecran** scria `setBooted` / `setActive` dintr-un efect care urmărea
  `reelOnScreen`. Scrierile au trecut în callback-ul propriu al `IntersectionObserver`-ului — un
  sistem exterior care raportează o schimbare, adică exact locul pe care regula îl indică — iar
  efectul rămas ține doar cronometrul de boot, care nu setează nimic din corpul lui.

**Verificat:** `tsc --noEmit` — 0 erori în tot ce ține de această intrare (49 → 0) ·
`npm run lint` — 0 probleme în fișierele atinse · `npm test` — **1589 treceri, 1597 teste**, de la
1531/1579 · cele patru pagini de serviciu răspund 200 pe serverul de dezvoltare, cu grila de
proiecte și lista ei ascunsă în pagină.

> Rămân roșii 8 teste în `components/__tests__/intro-preloader.test.tsx`,
> `components/__tests__/intro-math.test.ts` și `lib/__tests__/intro.server.test.ts`, plus erorile de
> tipuri și lint din fișierele de lucru ale intro-ului. Nu țin de această intrare: rescrierea
> intro-ului e în curs în paralel, pe aceleași fișiere, și a fost lăsată neatinsă intenționat.
>
> Datorie constatată, nerezolvată aici: `three/models/cubes.ts`, `integrationHub.ts`, `meshWave.ts`,
> `neural.ts` și `commerceLoop.ts` nu mai sunt construite de lume — singurele importuri rămase sunt
> din teste. Comentariul din `world.ts` (~:929) încă descrie blocul de cuburi ținut 1,4 s, care a
> plecat cu modelul.

Fișiere: `components/sections/DirectionPage.tsx`, `components/__tests__/scene-build.test.ts`,
`scene-choreography.test.ts`, `scene-contract.test.ts`, `scene-helix-model.test.ts`,
`scene-laptop.test.ts`, `scene-mesh-wave.test.ts`, `scene-palette.test.ts`, `scene-trail.test.ts`,
`direction-page.test.tsx`, `directions-selector.test.tsx`, `header-condense.test.tsx`,
`lib/__tests__/scene.test.ts`.

---

## 2026-09-20 — Fixed: pictograma site-ului era logoul Next.js, nu al nostru

De la schela proiectului, `app/favicon.ico` era pictograma implicită `create-next-app` — discul
negru cu triunghiul alb, 25 931 de octeți, patru intrări (16/32/48 BMP + 256 PNG), nemodificată
din 16 septembrie. Site-ul livra deci logoul framework-ului în fila browserului, la favorite și
pe ecranul de start. Nu exista `app/icon.*`, `apple-icon.*`, `app/manifest.ts`, nici intrare
`icons` în `generateMetadata()`.

**Ce s-a schimbat și de ce.**

- **`app/icon.svg` — semnătura TBS**, aceeași pe care o desenează antetul
  (`components/layout/Navbar.tsx`): literele „TBS" urmate de punctul roșu. App Router preia
  fișierul după nume și emite singur
  `<link rel="icon" href="/icon.svg?<hash>" sizes="any" type="image/svg+xml">`; nu e nevoie de
  nicio intrare `icons` în metadate, deci `generateMetadata()` rămâne neatins.

- **Culorile sunt o COPIE a token-urilor din `app/globals.css`, nu o referință.** Un fișier
  static nu poate citi `var()`, așa că valorile sunt scrise literal: `#0a0b10` (token `bg` /
  `dark-bg`) pentru placă, `#f6f7fb` (token `txt` / `dark-txt`) pentru semnătură, `#ef263d`
  (token `red`) pentru punct. **Dacă paleta se mută, fișierul trebuie actualizat manual** —
  comentariul din SVG spune asta explicit.

- **Desenat ca trasee conturate, nu ca `<text>`.** O pictogramă nu are font web la dispoziție,
  deci Archivo ar fi căzut tăcut pe ce oferă sistemul. Grosimea 2,6 la o înălțime de literă de 14
  reproduce bastonul Archivo ExtraBold, iar capetele drepte păstrează terminațiile plate. Potrivirea
  e ceva mai largă decât `tracking-[-0.04em]` din antet, ca ochiurile lui „B" să supraviețuiască la
  16×16 — pictograma trebuie să se citească acolo, nu să fie o scenă.

- **Placa închisă e obligatorie**, nu decorativă: semnătura e deschisă la culoare, iar pe un fond
  transparent ar dispărea în filele browserului în temă luminoasă.

- **`proxy.ts`: excepția din `matcher` trece de la `favicon.ico` la `icon.svg`.** Lista scutea
  pictograma de nonce-ul per cerere; cum fișierul s-a redenumit, fără schimbarea asta `/icon.svg`
  ar fi început să treacă prin proxy și să primească un CSP și un nonce de care nu are nevoie.

- **`app/favicon.ico` șters.** Nimic din depozit nu îl mai referea (singura mențiune era chiar
  excepția din `proxy.ts`, actualizată mai sus).

**Verificat:** `/` servește `<link rel="icon" href="/icon.svg?icon.2sm59ugl3lg2x.svg" sizes="any"
type="image/svg+xml">` și zero mențiuni de `favicon` · `GET /icon.svg` → `200`,
`Content-Type: image/svg+xml` · `GET /favicon.ico` → `404` · documentul își păstrează CSP-ul cu
nonce, iar `/icon.svg` nu mai primește unul (excepția funcționează) · randat la 16/32/160 px:
„TBS." se citește și la 16 · `tsc --noEmit` nu raportează nimic în fișierele atinse (cele 49 de
erori rămase sunt preexistente, toate în `components/__tests__/scene-*.test.ts`).

> **Notă pentru cine repetă verificarea:** stiva din `docker-compose.yml` rulează frontend-ul în
> `NODE_ENV: production`, dintr-o imagine standalone fără montare de surse — `localhost:3000` **nu**
> e un server de dezvoltare și nu preia modificări fără reconstruire. Verificarea de mai sus s-a
> făcut cu `next dev` într-un container separat, pe alt port, ca să nu tulbure stiva pornită.
>
> `AGENTS.md` trimite la `node_modules/next/dist/docs/` (la fel comentariile din `proxy.ts`), dar
> **directorul nu există** în Next 16.2.10. Convenția a fost confirmată direct din sursa instalată:
> `next/dist/lib/metadata/is-metadata-route.js` listează `svg` în `STATIC_METADATA_IMAGES.icon`, iar
> `resolve-metadata.js` adună fișierul prin `collectStaticImagesFiles(..., 'icon')`.

Fișiere: `app/icon.svg` (nou), `app/favicon.ico` (șters), `proxy.ts`,
[`docs/16-i18n-seo.md`](./docs/16-i18n-seo.md) (§3 „SEO surface").

---

## 2026-09-20 — Changed: ceasul intro-ului pregătit pentru secvența cu laptop

Primul lot din înlocuirea intro-ului (semnul infinit → cinematică în șase timpi cu un laptop).
Atinge numai dirijorul și contractul de timp; nimic vizibil încă, dar tot ce urmează depinde de el.

**Ce s-a schimbat și de ce.**

- **Gardă pentru scena care sosește prea târziu** (`INTRO_TIMING.LATE_SCENE_GOAL = 0.86`). Camera
  noii secvențe e derulată din progres, deci o scenă 3D care devine gata la 4,8 s ar apărea în
  dizolvare având doar ultimul timp de jucat: o mașină semi-transparentă care biciuie în ecran în
  mai puțin de o secundă, peste un desen care se stinge. Peste `0.86` scena e refuzată și desenul,
  care e deja la acel timp, duce totul. Vechea secvență tolera asta pentru că obiectul 3D semăna cu
  desenul la orice moment; cea nouă nu.

- **Un singur canal de derulare pentru desen** (`FB_PROGRESS_PROP = "--fb-p"`, scris de dirijor,
  citit de foaia de stil). Fiecare piesă a desenului își calculează propria fereastră din această
  valoare în CSS, deci un cadru costă o singură scriere pe un singur element. Înlocuiește
  `setCharge`, care parcurgea o listă de căi SVG proprii semnului infinit și dispare odată cu el
  (`data-part="charge"` nu era afirmat de niciun test sau document).

- **Ultimul timp joacă și pe desen.** Explozia fără WebGL derulează acum `--fb-p` la 1 pe durata ei,
  simetric cu zborul camerei din 3D. Un „sari peste" apăsat în primii doi timpi ridică întâi desenul
  la mașina compusă (0,84), în cadrul acoperit de implozia de 0,22 s — altfel explozia ar scala o
  mașină pe jumătate asamblată.

- **`gsap.killTweensOf(fx)` la pornirea exploziei**, ca animația camerei condusă de progres să nu se
  bată cu cea a exploziei.

- **`SCENE_CUTOFF` documentat corect.** Era citit de toată lumea (documentație inclusă) ca o poartă
  la 80% din bară. Nu este: fără semnalul scenei, pregătirea ponderată se oprește la
  `0,15 + 0,15 + 0,30 = 0,60`, deci pragul de 0,8 nu poate fi atins înainte ca `HARD_CAP_MS` să
  forțeze ținta la 1. E o limită de **5 secunde**, nu de 80%, și marja reală e mult mai mare decât se
  credea.

- **Explozia acoperă acum cadrul.** Fără WebGL, desenul se scala `2.6` — un număr potrivit pentru
  ∞, care umplea stadiul. Mașina nu: ea se scalează în jurul **centrului ecranului**, iar ecranul
  e 0,532 din stadiu, care e el însuși 1,28 `--intro-w`. La 2.6 explozia se oprea la 64vw, adică
  într-o margine vizibilă. **4.6** dă 3,13 `--intro-w` de acoperire — 113vw în cel mai rău caz
  (fereastră ultralată, unde `min(50vw, 84vh)` cade pe brațul de 84vh).

- **Testele de cookie ale intro-ului**, rupte de la redenumirea `tbs_intro` → `tbs_intro_skip`,
  descriu acum comportamentul real, în toate cele trei fișiere: site-ul nu își mai suprimă propriul
  intro, singura scriere de cookie e ștergerea celui vechi, iar numele vechi nu mai contează ca
  „văzut" — nici în browser, nici pe server. Cele cinci afirmații din `intro-preloader.test.tsx`
  care cereau `readIntroSeen(document.cookie) === true` după un skip, un Escape, mișcare redusă, un
  link cu `#hash` și un director care aruncă **afirmau exact bug-ul raportat** („la refresh nu
  lucrează"); întoarse, păzesc reparația.

**Verificat:** `tsc --noEmit` curat pe fișierele atinse · `lib/__tests__/intro.test.ts` 27/27 ·
`lib/__tests__/intro.server.test.ts` 4/4 · `components/__tests__/intro-preloader.test.tsx` 27/27 ·
`intro-math` + `intro-reveal-contract` 29/29 · intro-ul rulat cap-coadă pe un build standalone de
producție: `00 → 60 → 85 → 96 → 100`, descoperire la 4,7 s, `--fb-p` 0 → 1 fără salt, zero erori.

**Notă de mediu, pentru cine repetă verificarea:** `next dev` **nu** e un banc de probă valid pe
acest proiect. Cu `output: "standalone"`, pachetul de client nu se hidratează pe serverul de
dezvoltare și intro-ul rămâne înghețat pe `data-phase="boot"` / contorul `00`, **fără nicio eroare
în consolă**. Verificat punând codul curat din git pe același server — se blochează identic.
Rețeta e cea din `playwright.config.ts`: `npm run build`, copiat `.next/static` și `public` lângă
`.next/standalone`, apoi `node .next/standalone/server.js`.

Fișiere: `lib/intro.ts`, `components/intro/IntroDirector.tsx`, `components/intro/fx.ts`,
`components/intro/flight.ts` (nou), `lib/__tests__/intro.test.ts`,
`lib/__tests__/intro.server.test.ts`, `components/__tests__/intro-preloader.test.tsx`.

---

## 2026-09-19 — Fixed: pastilele de servicii se puteau auto-selecta la derulare

Aceeași greșeală ca la ruleta laptopului, găsită căutând toate reținerile pe „intrare" din proiect —
dar cu o consecință mai mare: pe pagina principală, pastilele „Direcții" selectau serviciul pe
`mouseenter`, **iar selecția conduce modelul 3D al scenei**. Rândul de pastile derulând sub un cursor
nemișcat primește oricum evenimentele de graniță, deci se putea schimba singur serviciul — și cu el
obiectul 3D — pentru un vizitator care nu arătase nimic.

Selecția se face acum pe **mișcare reală** peste pastilă, cu o gardă care sare peste pastila deja
activă, ca trecerea cursorului peste ea să nu coste nicio randare. Selecția la focus de tastatură
rămâne neschimbată.

**Verificat pe pagina reală:** cursorul parcat la (400,400), derulare **cu rotița** peste toată
secțiunea, cursorul niciodată mișcat — serviciul selectat și modelul scenei sunt identice înainte și
după.

Celelalte două locuri de aceeași formă rămân neatinse, cu motiv: meniul din antet nu poate derula sub
cursor (antetul e lipit de ecran), iar impulsul de performanță din hero se eliberează singur și nu
schimbă nimic vizibil.

Fișier: `components/sections/Directions.tsx`.

## 2026-09-19 — Fixed: ruleta rămânea pe pauză pentru cineva care nu ceruse asta

Clientul: a așteptat **15 secunde** după terminarea animației până când proiectele au început să se
schimbe.

**Cauza, numită exact:** pauza ruletei se activa pe `pointerenter` — „cursorul a intrat pe zonă". Dar
când vizitatorul derulează, **laptopul intră sub un cursor care stă nemișcat**, iar browserul
trimite evenimentele de graniță elementului care a ajuns sub el. Capturat pe containerul care
rulează, cu cursorul parcat și nemișcat: `pointerover`, `pointerenter`, `mouseover` la 364ms — și
**niciun `pointermove`**, pentru că vizitatorul n-a mișcat nimic, și niciun `pointerleave` care să
părăsească zona. Reținerea nu se elibera niciodată. Exact „am așteptat 15 secunde, apoi a pornit" —
15 secunde fiind momentul în care a mișcat din întâmplare mouse-ul.

**Nu era nici reținerea de după boot, nici ceasul.** Ambele sănătoase: poarta paginii și cea a scenei
se deschid la o distanță de un cadru una de alta (368ms, ambele la 0,895), iar cu cursorul departe
ruleta avansează normal.

**Reparația:** pauza se declanșează acum pe **mișcare reală** (`pointermove`) peste mașină, nu pe
simpla ei prezență sub cursor. O derulare care aduce laptopul sub un cursor nemișcat nu mai oprește
nimic; un pixel de mișcare reală oprește. S-a adăugat și `pointercancel`, pentru o atingere preluată
de derulare. WCAG 2.2.2 rămâne satisfăcut pe ambele căi: mișcarea cursorului peste mașină, sau Tab
până la linkul ecranului.

**Măsurat după reparație:** cursor parcat și nemișcat → `0 → 1 → 2 → 3 → 4 → 0` la ~2s, cu buclă;
cursor mișcat deliberat pe laptop → ține, și reia la 2,2s după ce pleacă; focus de tastatură → ține,
și reia la 2,2s după ce pleacă. Primul proiect stă ~3,9s, deci nu e măturat de secvența de boot.

**Și o corecție a măsurătorii mele, meritată:** scriptul meu de reproducere viza grila de carduri,
care pe calea cu 3D e `display: none` — deci `scrollIntoView` n-a făcut nimic, pagina n-a plecat de
la hero, iar `getBoundingClientRect` a dat zerouri, parcând cursorul la (0,0). **Testul meu nu testa
nimic**; cifra „0 timp de 21 de secunde" era corectă și complet lipsită de sens.

**Aceeași greșeală, în altă parte** — găsită prin căutarea tuturor reținerilor pe „intrare", și
**neatinsă deocamdată**:
- `components/sections/Directions.tsx:388` — `onMouseEnter` selectează serviciul. Rândul de pastile
  derulând sub un cursor nemișcat ar selecta un serviciu pe care vizitatorul nu l-a arătat, **iar
  acea selecție conduce modelul 3D**. Riscul cel mai mare dintre cele trei.
- `components/layout/Navbar.tsx:185` — deschide un meniu; risc mic doar pentru că antetul e lipit și
  nu derulează sub cursor.
- `components/sections/Hero.tsx:157` — un impuls de performanță pentru scenă; se eliberează singur.

Fișier: `components/sections/DirectionPage.tsx`.

## 2026-09-19 — Fixed & Changed: ecranul laptopului în culoare, fără conturul albastru, și zona de apăsare corectată

Clientul: capturile de pe ecran să fie colorate și mai recognoscibile, și să dispară liniile
albastre.

**Conturul albastru** era linia pe care zona de apăsare o desena la hover. A fost scoasă; inelul de
focus pentru tastatură rămâne, fiind o afordanță necesară. Semnalul pentru mouse e acum cursorul plus
apelul pe care ecranul îl desenează el însuși („VEZI PROIECTUL ›"). O stare de hover în scenă ar fi
cerut o uniformă nouă, interzisă de buget.

**Al doilea defect, pe care clientul l-a văzut fără să-l numească.** Dreptunghiul din captura lui era
și mai lat decât ecranul, și decalat — pentru că **zona de apăsare era calculată pentru o singură
poziție** a displayului, iar displayul se mișcă permanent (capacul respiră, mașina se leagănă).
Proiectând cele patru colțuri prin tot lanțul modelului pe o rotație completă, dreptunghiul real
mătură **2,36 × 1,59 unități** în jurul unui centru deplasat. Consecința măsurată la 1280: **29px din
marginea dreaptă și 31px din josul imaginii erau în afara țintei** — apăsai colțul de jos-dreapta al
ecranului și nu se întâmpla nimic. Ținta acoperă acum **anvelopa** pe care ecranul o mătură, nu o
instanță din ea (404×261 → 456×336).

**Culoarea.** Banda desena captura ca luminanță — o fantomă a produsului. Acum se desenează în culoare
**la aceeași dimensiune**, cu pieptenele de scanlines slăbit de la 0,55 la 0,24 pentru banda color,
ca liniile să stea **peste** o imagine, nu în locul ei. Holograma din spirala ADN păstrează varianta
monocromă: shaderul a fost scris astfel încât un pixel gri să dea exact rezultatul de dinainte —
verificat vizual pe pagina principală, elicea e neschimbată.

**Verificat că nu a devenit nimic lizibil:** adresa de e-mail din `statistic-1.png` ocupă **0,85
celule per caracter**, adică ≈1,86 px pe ecran. Mărită de 3× și de 6×: pată, fără structură de literă.
**Culoarea schimbă ce e într-un pixel, niciodată câți pixeli sunt.** Singurul text din captură lizibil
oriunde în ruletă e titlul de 80px al Bizcheck — exact ca înainte.

Contrast pe cadrul randat, toate cele cinci proiecte: bara de titlu **6,8–9,8:1**, apelul din subsol
**7,2–8,6:1**. Spălătura barei a rămas la 0,72: compoziția pe luminanță nu schimba niciodată
luminozitatea unui pixel, doar nuanța, deci banda color e la fel de luminoasă sub bară ca cea gri.
(A fost ridicată la 0,82 pe o presupunere, măsurată, și revenită.)

Neschimbate: **+2 desene**, nicio ramură de material nouă, nicio uniformă nouă, plafonul 384×240,
`[data-scene-layer]`, secvența de boot și ruleta, și tot ce ține de sub 861px / fără 3D / mișcare
redusă. Containment re-măsurat pe o rotație completă: înăuntru cu cel puțin 60px pe toate laturile.

**De știut pentru viitor:** un accent grav într-un comentariu din shader termină șirul GLSL și strică
build-ul cu o eroare care arată complet nelegată („Expected a semicolon"). Comentariile din shadere
rămân fără accente grave.

Fișiere: `components/scene/three/hologram.ts`, `components/scene/three/materials.ts`,
`components/scene/choreography.ts`, `components/sections/DirectionPage.module.css`, testul scenei.

## 2026-09-19 — Fixed: intro-ul se juca înainte ca vizitatorul să ajungă la laptop

Clientul: „ii prea rapid, eu până ajung, laptopul deja ii strâns". Avea dreptate, și cauza era o
greșeală în felul în care măsurasem, nu în animație.

**Modelul greșit.** Toate tabelele de vizibilitate de până acum presupuneau un vizitator care
**derulează continuu la 700px/s și nu se oprește niciodată**. De aceea coborâsem pragul de pornire
tot mai jos — ca secvența să apuce să se termine înainte ca laptopul să iasă din ecran. Dar un om
real derulează **până ajunge la obiect și se oprește să se uite**. Contra acelui vizitator, un prag
timpuriu e cea mai proastă alegere posibilă: toată secvența se cheltuie cât mașina e încă o dungă la
marginea de jos, iar când omul se uită la ea, s-a terminat.

**Poarta a urcat de la 6% la 60%** — cota la care displayul e prima dată complet în cadru, și aceeași
la care baza care stă acolo dinainte devine complet vizibilă. Deci nu există o poziție în care
vizitatorul să privească un soclu singur: încă 17px de derulare și secvența pornește.

**Durata: 1,80s → 4,20s**, iar asamblarea de la 0,52 la **1,85s** (×3,6).

**Și curba de zbor a fost refăcută — fără asta lungirea n-ar fi ajutat.** Cosinusul amortizat acoperea
toată distanța în **prima cincime** a zborului și restul îl petrecea oscilând pe loc: la 0,2s per
piesă se citea ca sosire, la 0,7s se citea ca piese care sar o dată și apoi **atârnă**. Acum distanța
se cheltuie uniform — jumătate din drum la jumătate din zbor — cu o rețineri la plecare și o
depășire mică la sosire, fără niciun moment de stat pe loc.

**Tabelul care contează acum — vizitatorul care ajunge și se oprește** (derulare 700px/s până când
mașina e confortabil în cadru, apoi stop): **display 1,00 la fiecare bătaie**, de la armare până la
final, la 1280×800 **și** la 861×700. Toate cele 4,2 secunde se văd întregi.

**Ce pierde cel care trece în viteză**, spus cinstit: derulând continuu fără oprire, ratează
asamblarea — la 1,85s mașina a ieșit din cadru. Dar secvența e cronometrată, deci se termină oricum,
iar părăsirea secțiunii o **pune la loc pe bază**: la întoarcere primește un boot complet, de la
capăt, niciodată un obiect pe jumătate construit.

**Testul de curgere, pe toată durata nouă:** 56 de cadre în 6,92s, diferență între cadre consecutive
**0,46%–18,16%**, zero perechi sub 0,25% — niciun cadru identic cu cel dinainte, nici măcar în
asamblarea de 1,85 secunde.

Neschimbate: **+2 desene**, plafonul 384×240, `[data-scene-layer]`, ruleta de după (care își ține
acum primul proiect 5,4s, din același tabel), și grila neatinsă sub 861px, fără 3D și la mișcare
redusă. Containmentul a fost re-măsurat pe toată sosirea, piesele stând acum mult mai mult în
pozițiile lor îndepărtate: marja cea mai strânsă 54px.

Fișiere: `components/scene/choreography.ts`, testul scenei. Modelul, lumea și pagina citesc tabelul,
deci toată schimbarea e o tabelă și o curbă.

## 2026-09-19 — Changed: asamblarea laptopului — 29 de piese, curgere fără goluri

Clientul: asamblarea e prea rapidă și **bruscă**; o vrea mai lină, mai detaliată, din mai multe
componente.

**13 → 29 de piese**, dintre care 26 sosesc: trei butuci de balama, buza, trackpadul, patru șine de
capac, două capace de balamă, **douăsprezece taste individuale** și trei porturi pe muchia punții.
Instanțele sunt aproape gratis — același `InstancedMesh`, deci **+2 desene, neschimbat**; cresc doar
696 de invocări de vertex shader față de 312 și ~2 KB de matrice.

**De ce era „brusc", găsit prin măsurare:** curba de aterizare era un ease-in pătratic care **se
oprea sec**. Zece impacte mici, unul după altul — asta se citea ca abrupt, nu viteza. Acum aterizarea
e un **inel amortizat**: piesa trece ~15% peste locul ei și oscilează pe el.

**Curgerea, nu doar durata:** fereastra asamblării a crescut de la 0,32 la **0,52s** (+63%), fiecare
zbor până la 0,30s și **variat** — piesa cea mai apropiată zboară 72% din durată, cea mai îndepărtată
toată. Rezultatul: **~14 piese sunt în aer în orice clipă**, iar ultima pleacă la 0,21s, când prima
abia a aterizat la 0,22s. Ordinea e de la mare la mic: butucii, buza, trackpadul, șinele, apoi tastele
și porturile umplând în urmă.

**Două efecte, ambele per instanță, zero desene:** fiecare piesă se aprinde la fixare, deci muchiile
mașinii apar **piesă cu piesă**, nu deja aprinse; iar o undă trece prin cele deja așezate la fiecare
sosire, deci obiectul licărește continuu în loc să tacă între piese.

**Testul de „lin", verificabil:** banda densă de cadre — dacă două cadre consecutive arată identic,
curgerea are o gaură. Rezultat: diferență între cadre **6,3%–24,6%** la 861×700 și **10,4%–55,4%** la
1280×800, **zero perechi sub 0,25%**. Niciun cadru identic cu cel dinainte.

**Poarta a coborât de la 30% la 6%** din fereastră — cât de devreme se poate arma fără să cheltuiască
asamblarea sub fald. Vizibilitatea la 700px/s, față de runda trecută:

| Beat | Acum | Înainte |
| --- | --- | --- |
| asamblat | **1,00** | 1,00 |
| capac deschis | **0,98** | 0,90 |
| primul proiect | **0,73** | 0,54 |

Toate pragurile țin, iar ultimele două sunt **substanțial mai bune** decât înainte, deși secvența e
mai lungă (1,62 → 1,80s).

**Ceva ce rundele anterioare nu măsuraseră:** baleiajele de containment eșantionau mașina **așezată**,
niciodată piesele în zbor. De aceea împrăștierea laterală e deliberat modestă — casa unei piese
exterioare e deja la 1,18 unități, iar startul ei e casa plus vectorul. Măsurat pe 14 cadre acoperind
toată sosirea: înăuntru pe toate laturile, marja cea mai strânsă 61px.

**Respinse, cu motiv:** urma-fantomă în spatele pieselor (ar cere încă o instanță per piesă, iar
materialul `edges` n-are opacitate per instanță — ar arăta ca o a doua cutie solidă, nu ca o dâră) și
o rampă de culoare spre roșu (roșul e rolul refuzului în acest proiect, iar o sosire nu e un refuz).

Fișiere: `components/scene/choreography.ts`, `components/scene/three/models/laptop.ts`, testul scenei.

## 2026-09-19 — Changed: intro-ul laptopului, patru feluri de efect în 1,62s

Clientul: „fa-mi ca un intro wow, cu secții diferite de efecte". Secvența de dinainte era bună, dar
era o singură mișcare continuă. Acum are **patru feluri diferite**, fiecare recognoscibil pe un
singur cadru:

| t | mișcare | ce se vede |
| --- | --- | --- |
| 0 → 0,32 | **asamblarea** — cele 13 piese vin din toate direcțiile, se rostogolesc și se fixează, la 0,014s una de alta | puntea pe loc și 6-8 piese în zbor |
| 0,28 → 0,46 | **valul de curent** — o bandă traversează corpul de la balama la buză, **singurul moment care trece în alb** | mașina închisă, cu o bandă fierbinte pe ea |
| 0,46 → 0,90 | **capacul** pe balama, cu așezare | capacul la jumătate, ecranul stins |
| 0,72 → 0,90 | **tubul** — displayul se deschide pe verticală, rasterul cel mai puternic pe primul cadru | bandă orizontală de raster în mijlocul capacului |
| 1,02 | **primul proiect**, cu glitch | text forfecat |

**Poarta a coborât de la 60% la 30%** din fereastră, ceea ce cumpără secunde reale de vizibilitate.
Costul cade pe **primul** beat — de aceea primul beat e asamblarea: la 30% ce se vede e sfertul de sus
al norului din care vin piesele, adică exact faza care se citește și când e tăiată pe jumătate.

**Vizibilitate la 700px/s, față de reperul vechi:**

| Beat | Display pe ecran | Înainte |
| --- | --- | --- |
| armare (asamblarea) | 0,44 | — |
| asamblat | **1,00** | — |
| capac deschis | **0,90** | 0,86 |
| primul proiect | **0,54** | 0,46 |

**Niciun beat nu e mai puțin vizibil decât înainte**, și sunt două mișcări noi peste. Plafonul măsurat:
la 700px/s displayul dispare la ~1,3s după armare, deci orice beat care trebuie văzut stă sub ~1,1s.

**Starea dinainte:** baza — puntea și picioarele — **nu sosește niciodată**; ea e still-ul și stă acolo
înainte de orice. Asamblarea construiește pe ea, deci primul lucru văzut e o mașină care se naște, nu
un dreptunghi gol.

**Ce s-a tăiat ca să încapă:** cursa capacului de la 0,65 la 0,44s și autotestul de la 0,90 la 0,56s —
asamblarea și valul sunt plătite din ele, nu din durata totală (1,65 → **1,62s**). Valul a fost mutat
**înaintea** capacului: suprapus peste el era prezent, dar nu se putea numi pe un cadru.

**Respinse pe buget, cu motiv:** roiul de particule (ar fi un desen în plus) și separarea cromatică pe
ecran (ar fi o uniformă nouă în shader).

Neschimbate: **+2 desene**, plafonul 384×240, `[data-scene-layer]`, ruleta de după, și grila neatinsă
sub 861px, fără 3D și la mișcare redusă.

Fișiere: `components/scene/choreography.ts`, `components/scene/three/models/laptop.ts`,
`components/scene/three/hologram.ts`, testul scenei. Pagina și CSS-ul neatinse — ambele citesc
tabelul, deci poarta și momentul primului proiect s-au propagat singure.

## 2026-09-19 — Added: laptopul pornește — secvența de boot

Clientul: „când ajung la laptop fa un intro frumos… cum se pornește laptopul cu proiecte și se
deschide laptopul, cât mai wow cu atât mai bine".

**1,65 secunde, cinci mișcări:**

| t | ce se întâmplă |
| --- | --- |
| 0,00–0,20 | **trezirea** — blatul și buza iau un puls; mașina e pornită înainte să fie deschisă |
| 0,05–0,70 | **capacul** — cursa pe balama, cu ~4% peste vârf și așezare; balamaua se aprinde la mijloc |
| 0,40–0,66 | **tubul** — displayul se deschide pe verticală dintr-un fir de păr |
| 0,44–0,82 | **cadrele de boot** — cinci cadre pe aceeași pânză: rasterul, bara de titlu, colțurile, o bară de progres. **Niciun cuvânt** |
| 0,86 | **primul proiect** se compune, cu glitch-ul casei |
| 0,70–1,55 | **autotestul** — cele trei rânduri de taste în secvență, apoi accentul pe trackpad |

**Un tabel, trei cititori:** modelul își ia pozele, lumea pictează cadrele, iar pagina își ține ruleta
pentru boot plus un interval întreg — deci proiectul pe care aterizează secvența se citește la fel de
mult ca oricare altul. Secvența și pagina nu pot ajunge în dezacord.

**Ce o armează, și de ce nu poate fi ratată.** Poarta e la 60% din fereastră — ales pentru că e
**măsurat exact pragul de la care displayul e complet vizibil** (display 1,00 la armare, în fiecare
rulare). Secvența e **cronometrată**, nu legată de scroll, deci o derulare bruscă nu poate lăsa
capacul pe jumătate.

| Caz | Armare | Primul proiect | Display pe ecran |
| --- | --- | --- | --- |
| Scroll 700px/s | scroll 731 | t+0,87s | **100% → 46%** pe toată partea esențială |
| Link direct `#proiecte` | — | — | **100%** pe toate eșantioanele |
| Reîncărcare în secțiune | — | — | **100%** peste tot |
| Flick 2500px/s | scroll 765 | — | vizitatorul ajunge la fundul paginii în 0,73s |

Durata a coborât de la 2,4s la **1,65s** tocmai după măsurătoarea la 700px/s: la 2,4s primul proiect
ateriza cu displayul deja la 0% pe ecran. Pleci și revii — se bootează din nou; te miști în interiorul
secțiunii — nu.

**Starea dinainte e deliberată:** mașina închisă, ecran stins, blatul și șinele aprinse la repaus —
un obiect compus, nu un dreptunghi gol.

**Decizii bune luate de agent:** cadrele de boot **nu desenează niciun glif** (un ecran care pornește
n-are de unde să citească un font și n-are ce căuta să dețină text într-o singură limbă), iar tabelul
stă în modulul fără three, singurul pe care pagina îl poate importa.

Neschimbate: **+2 desene**, plafonul de 384×240 (cadrele de boot se desenează la aceeași dimensiune),
ruleta de după (2s, pauză la pointer și la focus), `[data-scene-layer]`, și grila neatinsă sub 861px,
fără 3D și la mișcare redusă — care nu primește niciodată jumătate de boot, pentru că nu primește
scenă deloc.

Fișiere: `components/scene/choreography.ts`, `components/scene/three/models/laptop.ts`,
`components/scene/three/hologram.ts`, `components/scene/three/world.ts`,
`components/sections/DirectionPage.tsx`, testul scenei.

## 2026-09-19 — Changed: laptopul fără contur, proiectele se schimbă la 2 secunde

Clientul: scoate conturul și fă cartelele să se schimbe la fiecare 2 secunde.

- **Conturul ferestrei a fost scos** — linia de cap și cele patru brațe de colț. Cutia rămâne,
  pentru că ea e ce măsoară scena și din ea se derivă zona de apăsare de pe ecran, dar **nu mai
  pictează nimic**: orice suprafață opacă acolo ar ascunde chiar pânza din spate. Era singurul lucru
  care încadra o mașină care își desenează oricum propriile muchii.
- **Ciclul a coborât de la 4,2s la 2s** per proiect.

**Observație consemnată, nu o obiecție:** ecranul poartă acum numele, eticheta și **două rânduri de
descriere**. Două secunde ajung ca să observi schimbarea, nu ca să citești descrierea — de aceea
oprirea la trecerea cu mouse-ul și la focus devine mai importantă decât era la 4,2s.

**Numărul de proiecte pe pagină este conținut, nu cod** (`lib/solutions.ts`, `solutionProjectIds`):
produs-digital 5, automatizare-api 3, brand-ui 3, asistenți-ia 2, e-commerce 0 — iar ruleta le arată
pe toate. Un proiect în plus pe o pagină e o intrare în acea listă.

Fișiere: `components/sections/DirectionPage.tsx`, `components/sections/DirectionPage.module.css`.

## 2026-09-19 — Changed: doar laptopul, rulează singur, iar ecranul se citește

Clientul: „fa să fie automatizat să se schimbe singure… nu se înțelege ce ii pe ecran… dacă apăs pe
ecranul laptopului să mă ducă încolo, lasă numai laptopul animat și fa mai detaliat proiectele care
sunt pe ecran".

**„Mai detaliat" s-a rezolvat cu informație, nu cu rezoluție.** Plafonul texturii (384×240) e motivul
pentru care adresa de e-mail din `statistic-1.png` e ilizibilă; ridicarea lui ar fi făcut-o lizibilă
pe un ecran mare. În schimb, ecranul desenează acum: bară de titlu cu marcaj, eticheta și „04 / 05",
captura ca fundal (54% de sus), **numele proiectului la 30px de textură**, două rânduri din descriere
cu elipsă, și un subsol cu „VEZI PROIECTUL ›" sau „FĂRĂ LINK PUBLIC", plus câte o bifă per proiect.
La dpr 2 numele se randează la **69 px-dispozitiv** — text desenat la rezoluția nativă a pânzei, nu o
poză micșorată. Se poate numi proiectul și citi o frază despre el doar de pe ecran.

Un **al doilea layout** în `hologram.ts`, nu o extindere a celui existent: holograma din spirală e un
plan citit dintr-o privire lângă moleculă, ăsta e un **display**. Work rămâne neatins; ambele împart
aceeași conductă, aceeași sondă de taint și același plafon.

**Rulează singur** — 4,2s per proiect, fără butoane. WCAG 2.2.2 cere un mecanism de oprire pentru
conținut care se actualizează automat: mecanismul e **stage-ul însuși**, ajuns din ambele moduri de
input — pointerul peste laptop oprește ciclul (măsurat: același index 9 secunde, apoi repornește la
plecare), la fel focusul de tastatură pe ecran, care e primul tab-stop al secțiunii.

**Apăsarea pe ecran duce la proiect.** Elementul de apăsare stă peste **zona displayului**, nu peste
toată fereastra, iar cutia lui e derivată din aceeași potrivire ca a modelului — deci nu pot ajunge
să difere. Poziția displayului e **măsurată**: capacul e înclinat, poza înclină toată mașina, iar
ecranul stă în spatele centrului obiectului, deci camera în perspectivă îl desenează cu ~11% mai
mic. Proiectele fără URL public primesc un element onest, focusabil, etichetat „fără link public" —
nu un link mort.

**Conținutul nu a plecat din pagină.** Aceleași proiecte stau într-o listă **ascunsă vizual** prin
tehnica standard (cutie de 1px + decupare), niciodată `display:none` — altfel ar fi dispărut și
pentru cititoarele de ecran și pentru motoarele de căutare. Verificat pe **arborele real de
accesibilitate al Chrome**: toate numele și descrierile sunt expuse, iar linkul ecranului apare ca
„Vezi proiectul ↗ — BizCheck". Lista se dezvăluie singură la focus, ca nimeni să nu urmărească un
inel de focus invizibil.

**E-mailul, re-măsurat:** banda eșantionează sursa la 6,65 pixeli per celulă, neschimbat de mărimea
laptopului, deci o majusculă se randează la 5,5 pixeli **de neclaritate, nu de literă**. Mărit de 5×:
textul desenat de compozitor e clar cu două rânduri mai sus, banda capturii de sub el e pastă.
**Niciun caracter lizibil.**

Desene: **+2**, neschimbat. `[data-scene-layer]` identic înainte și după. Sub 861px, fără 3D și la
mișcare redusă — grila din `efcaef7`, neatinsă.

Fișiere: `components/scene/three/hologram.ts`, `components/scene/three/models/laptop.ts`,
`components/scene/choreography.ts`, `components/scene/projectsReel.ts`,
`components/sections/DirectionPage.tsx` + CSS, testul scenei.

## 2026-09-19 — Changed: laptopul preia secțiunea „Proiecte relevante"

Clientul, după ce a văzut laptopul în celula grilei: „șterge cardurile și mărește modelul 3D al
laptopului și lasă cardurile pe rând să meargă pe ecran".

**Ce i-am spus înainte să construiesc.** Cardurile nu sunt doar cutii: ele poartă numele și
descrierea fiecărui proiect — textul pe care îl citesc motoarele de căutare și cititoarele de ecran,
și singurul conținut al secțiunii pe telefon și pe dispozitivele fără 3D. Deci grila dispare **doar
acolo unde laptopul chiar există**, iar conținutul ei se mută lângă ecran ca text adevărat.

**Două forme, alese din CSS**, pe `[data-renderer="webgl"]` și de la 861px în sus — **deliberat fără
`pending`**: spre deosebire de o nișă goală, schimbarea formei înainte ca 3D-ul să fie sigur ar lua
cardurile și le-ar da înapoi sub ochii vizitatorului.

- **≥1025px:** laptopul în stânga (fereastră 727×496), textul în dreapta.
- **861–1024px:** stivuit și centrat (660×432) — două coloane acolo ar fi lăsat mașina cât un card.
- **Sub 861px, fără 3D, mișcare redusă:** exact grila livrată în `efcaef7`, neatinsă.

Laptopul e acum **×1,91** față de versiunea din celulă (184,6 px per unitate de model la 1280).
Încadrarea a fost **re-derivată din cadre randate**, nu din geometrie — 26 de cadre ale unei rotații
complete × 3 poziții de derulare × 3 pagini × 3 lățimi, cu ruleta oprită întâi, altfel textul care se
schimbă era numărat drept lumină a obiectului. Marja cea mai strânsă: 9px. O descoperire pe drum: se
centra **cutia geometrică**, dar obiectul e înclinat, deci lumina lui cade mai jos — centrarea pe
cutia **luminată** a recuperat ~5% din mărime, care se pierdea ca aer nefolosit deasupra.

**Pagina deține numărul, scena îl urmează.** Un singur index, deci ecranul și textul de lângă el nu
pot ajunge în dezacord. Textul e DOM real: „PE ECRAN 01 / 05", eticheta, numele, descrierea și
linkul — selectabil, traductibil, în toate trei limbile.

**Controale reale**, pentru că nu mai sunt carduri de apăsat: pauză, anterior, un marcator per
proiect, următor. Toate butoane, ținte de 44px, accesibile cu Tab, cu `aria-current` pe cel activ.
Ciclul se oprește la orice atingere, sub cursor și cât timp focusul e în zonă — mecanismul cerut de
WCAG 2.2.2. **Regiunea de anunțare e oprită cât timp ciclul merge singur** și devine politicoasă abia
după ce vizitatorul atinge un control: una care ar vorbi din 4,2 în 4,2 secunde ar acoperi ce citește
omul în altă parte.

**Linkul public nu dispare cu cardul:** proiectul de pe ecran îl poartă cu el, iar oricare altul e la
o apăsare distanță pe marcatorul lui. Un proiect fără URL arată „fără link public", nu un link mort.

**Un defect prins prin construcție:** ambele forme stau în DOM și CSS alege — dar o imagine cu
`loading="lazy"` într-un bloc ascuns **nu e adusă niciodată**, deci fiecare proiect ar fi ajuns pe
ecran doar cu text. Rezolvat trecând încărcarea pe „imediat" când secțiunea se apropie.

**E-mailul din `statistic-1.png`, re-măsurat la mărimea nouă:** plafonul de 384×240 e pe **pânză**, nu
pe ecran, deci banda eșantionează sursa la 6,65 pixeli per celulă — **neschimbat de mărimea
laptopului**. Un caracter are 1,1 celule, adică eșantioane mărite, nu detaliu nou. Mărit de 5× și 6×:
nicio literă rezolvabilă. **Rămâne ilizibil.**

Contrast măsurat peste ce e chiar în spate: etichetă 6,29 · nume 15,32 · descriere 8,45 · eyebrow
8,47 · link 15,90. Desene: **+2** (un mesh instanțiat de 13 cutii, un plan pentru ecran), nicio ramură
de material nouă, nicio uniformă nouă. `[data-scene-layer]` identic înainte și după.

Pagina devine cu **227–367px mai scurtă** acolo unde sunt 5 proiecte, și cu ~150px mai înaltă unde
sunt 2–3.

Fișiere: `components/sections/DirectionPage.tsx` + CSS, `components/scene/projectsReel.ts`,
`components/scene/three/models/laptop.ts`, `world.ts`, `SceneWorld.tsx`, `choreography.ts`,
`lib/scene.ts`, testul scenei.

## 2026-09-19 — Added: un laptop 3D pe care rulează proiectele

Clientul: „fa 3d modelul unui laptop și pe ecrane să meargă aceste cartele". Rundele anterioare
puseseră rame de dispozitiv în jurul fiecărei capturi; el voia **un obiect**, cu ecran.

**Laptopul** (`components/scene/three/models/laptop.ts`) e făcut din același material ca restul
scenei: o singură geometrie de cutie instanțiată cu muchii aprinse — blat, balamă, buza din față,
trackpad, șinele capacului, trei rânduri de taste, picioare. **Două desene pe cadru**, măsurate prin
comparație pe aceeași pagină, cu și fără el: unul pentru ramă, unul pentru ecran. Fără ramură de
material nouă, fără uniformă nouă. Capacul se deschide în 1,1s când celula intră în pânză și se
închide la ieșire; un caret trece peste taste o dată pe buclă.

Unghiul capacului nu e ales din ochi: la 107° ecranul ajunge **perpendicular pe cameră** după ce
corpul e înclinat spre privitor.

**Ecranul folosește conducta hologramei din spirală**, neschimbată. Plafonul ei de 384×240 este
**exact 16:10** — aspectul unui ecran de laptop — deci captura cade pe panou fără tăiere și fără
întindere. Plafonul rămâne ce a fost: o decizie de confidențialitate, nu una tehnică.

**Cum rulează cartelele.** Un modul nou (`projectsReel.ts`) doar **citește** grila: ciclu de 4,2s pe
proiect, iar cursorul are prioritate — treci peste un card și proiectul ăla apare pe ecran; pleci și
ciclul continuă **de unde era**. Focusul de la tastatură face același lucru. Grila rămâne neatinsă:
ea e conținutul, accesibilitatea și varianta fără 3D.

**Datele se schimbă după montare** (conținutul vine din API, imaginile pot fi înlocuite din admin).
Un observator prinde atât schimbarea listei, cât și înlocuirea unei imagini pe un nod pe care React
l-a păstrat — al doilea caz a cerut o extindere a hologramei, pentru că altfel același element la
același index era sărit, adică **exact** cazul „textură veche pentru un proiect a cărui imagine a
fost schimbată". Verificat pe pagina reală, punând o altă captură pe un card ținut sub cursor.

**Unde stă:** în celula liberă a grilei — gaura pe care o lasă 5 carduri în 3 coloane — deci **zero
pixeli** adăugați acolo unde există. Unde rândul e plin, își ia rândul lui. Scena **măsoară** celula,
nu deduce care e: verificat ștergând un card live, grila s-a reașezat și laptopul a urmat-o. Sub
861px și fără 3D nu există deloc.

**E-mailul din `statistic-1.png`, măsurat nu presupus:** sursa e micșorată de 6,65 ori pe pânză, iar
pe ecran un caracter are **2,5 pixeli de dispozitiv**, sub pieptenele de scanlines. Mărit de 3× și de
5×: nicio literă lizibilă. Singurul text care se citește e cel desenat de hologramă — numele și
indexul.

**Ce a fost mai greu decât pare:** camera e perspectivă, iar celula stă la ~400px de centrul pânzei,
deci silueta obiectului se înclină în afară cu ~11% și **se schimbă** pe măsură ce celula urcă. Un
contur dedus din geometrie ar fi fost greșit; limita e măsurată din 26 de cadre ale unei rotații
complete × 3 poziții de derulare × 3 pagini × 3 lățimi. Măsurătoarea însăși a înșelat de trei ori:
cardurile vecine sunt și ele obiecte luminoase, ceasul din antet ticăie între două capturi, iar un
decupaj care iese din ecran derulează pagina în tăcere.

`[data-scene-layer]` identic înainte și după, pe toate paginile și lățimile; zero erori de consolă.

Fișiere noi: `components/scene/three/models/laptop.ts`, `components/scene/projectsReel.ts`,
`components/__tests__/scene-laptop.test.ts`. Modificate: `world.ts`, `SceneWorld.tsx`,
`choreography.ts`, `scrollProbe.ts`, `lib/scene.ts`, `hologram.ts`, `DirectionPage.tsx` + CSS.

## 2026-09-19 — Changed: cardurile de proiect devin ferestre de instrument

Clientul, uitându-se la grila „Proiecte relevante" de pe paginile de servicii: să arate interesant,
cu animații și ceva 3D. Dintre patru direcții propuse a ales-o pe aceasta — captura nu mai e o
imagine plată, ci **conținutul afișajului unui dispozitiv** — și a adăugat o condiție: dispozitivul
să aibă **aceeași textură ca celelalte elemente 3D** din proiect.

**De ce această direcție și nu altele.** Eroul paginii orbitează, panourile pulsează și mătură, șina
se umple — **nimic nu se pliază**. Un capac care se ridică pe o balama e singurul verb nou pe pagină.
Și repară un defect real: pe `/servicii/automatizare-api` toate cele trei proiecte sunt fără link
public, iar singura regulă care mișca ceva în toată secțiunea era hover-ul pe linkuri — deci **niciun
card nu reacționa la nimic**. Acum toate capătă pliere și înclinare, dar ridicarea și bordura
colorată rămân doar pentru cele pe care chiar poți apăsa.

**Textura, potrivită prin citire, nu prin aproximare.** Fiecare solid din scenă e o cutie desenată cu
muchii aprinse (fața la 3,5%, banda de muchie la 90%, aditiv pe negru, fără lumini și fără umbre).
În CSS asta a devenit: o muchie de 1px în accentul serviciului plus un halou de lumină **adăugată**,
colțuri drepte (o cutie 3D n-are raze), umpluturi plate fără gradient care să imite metal, iar geamul
poartă cele două semne ale hologramei din spirală — pieptenele de linii de scanare și firul interior
de 1px. **Umbra moale și colțurile rotunjite din specificație au fost respinse deliberat**: scena n-are
lumini, deci o umbră ar fi fost singurul lucru realist din obiect.

Ce **nu** s-a putut potrivi, declarat: amestecul aditiv adevărat (CSS compune altfel, iar singura cale
ar fi fost un mod de amestecare interzis în zona asta), marginea care se aprinde după unghi, și
grosimea liniei — liniile din 3D au un pixel de dispozitiv, CSS-ul are un pixel logic, deci la ecran
dens muchia noastră e de două ori mai groasă.

**Captura nu a fost mărită nicăieri.** Scara maximă randată rămâne **0,4221×**, identică cu cea de
dinainte: bara de titlu stă deasupra geamului, iar inelul e o umbră, deci niciuna nu ocupă spațiu în
așezare. Regula proiectului despre detaliile lizibile din capturi e respectată.

**Trei greșeli ale specificației, găsite la contactul cu codul:** linia de cap a ramei era
specificată ca strat de fundal decalat cu 10px deasupra marginii — un fundal se desenează doar în
interiorul cutiei, deci ar fi dispărut **tăcut**; pseudo-elementele ramei ar fi devenit celule în
grilă fără poziționare absolută; iar afirmația din proiectare că „fereastra micșorează captura" era
falsă — corect e „niciun număr nu crește".

Verificat: contrastul etichetei în bara de titlu **5,479:1** (era 6,030 pe card, ambele peste prag),
`[data-scene-layer]` identic înainte și după pe toate cele trei pagini și patru lățimi, nicio
depășire orizontală, iar numărul de linkuri, articole, titluri și imagini din secțiune e neschimbat.

**Semnalat clientului, nelegat de această schimbare:** `public/projects/statistic-1.png` conține o
**adresă de e-mail vizibilă** în blocul de partajare, la orice lățime.

Fișiere: `components/sections/DirectionPage.tsx`, `components/sections/DirectionPage.module.css`,
`components/__tests__/decorative-dots.test.tsx` (modulul intră acum în scanarea regulii).

## 2026-09-19 — Changed: comutatorul de limbă e rotund și schimbarea alunecă

Clientul a cerut ca RO | RU | EN să fie rotunde și schimbarea să fie animată.

**Forma.** `--r-pill` pentru pistă, pentru fiecare opțiune (deci și pentru inelul de focus, care
urmează raza), pentru indicator, pentru butonul compact de 44×44 și pentru rândurile din popup. Nu o
treaptă fixă, pentru că **pista nu are o înălțime fixă**: 30px de la 861px în sus și 50px în banda
zonelor de atingere de dedesubt. Orice valoare literală ar fi fost pilulă la una și pătrat rotunjit
la cealaltă. Foaia popup-ului primește 16px — o pilulă pe o cutie de 142px înălțime ar deveni
pastilă alungită — și e exact raza insulei antetului, deci popup-ul se citește ca o bucată din el.

**Indicatorul.** Umplerea albastră nu mai stă pe butonul activ: e un element propriu, în spatele
etichetelor, care **alunecă**. Geometria e măsurată, nu presupusă — dreptunghiul opțiunii active
raportat la prima opțiune, deci imun la tragerea pe care insula antetului o aplică întregului grup.
Poziția e corectă **la primul paint** (până atunci e invizibil, deci nu alunecă de nicăieri), iar
tranziția se armează un cadru mai târziu: prima așezare e salt, toate următoarele sunt alunecări. Un
`ResizeObserver` pe fiecare opțiune prinde pragurile, rotirea ecranului, zoom-ul și cadrul în care se
schimbă fontul.

**Două decizii luate prin măsurare, nu din obișnuință:**
- **A refuzat curba de animație standard a proiectului.** Cu ea, la 110ms din 220 indicatorul era la
  **97%** din drum — teleportare cu așezare. Cu curba aleasă e la **83,9%**: alunecare vizibilă,
  aterizare decisă.
- **Eticheta părăsită rămâne albă** cât indicatorul trece peste ea (220ms cu 50ms întârziere), în loc
  să devină gri imediat (140ms pentru cea care primește). Altfel ar fi fost gri pe albastru — **2,6:1**
  pentru o fracțiune de secundă.

**Contrast măsurat** pe pixelul cel mai defavorabil de sub fiecare etichetă: eticheta activă pe
indicator **5,27:1** (identic la toate lățimile, ambele stări de antet, toate limbile); etichetele
inactive **6,87:1** în cel mai rău caz compozit posibil (fundal alb forțat sub antet) și 7,37–8,40 pe
pagina reală cu pânza 3D dedesubt; butonul compact 10,18:1.

Geometrie verificată: decalaj **zero** pe toate cele 24 de combinații lățime × stare de antet ×
limbă, plus după o navigare în site și la schimbarea mărimii fontului (11 → 16 → 22px).

**Decizii documentate atinse, cu motivul scris la loc:** butonul compact avea colțuri drepte „ca bara
să se citească dintr-o bucată" — acum e cerc, pentru ca pilula segmentată și butonul compact să fie
același control la mărimi diferite. Perechea de culori (alb pe albastru, niciodată roșu) e păstrată
identic.

**De reparat separat:** `npm run lint` are o eroare **preexistentă**, semnalată de agent și
neintrodusă de el — `components/sections/DirectionPage.tsx:131`, `react-hooks/set-state-in-effect`.
Intră în trecerea de curățenie.

Fișiere: `components/ui/LanguageSwitcher.tsx`, `components/ui/LanguageSwitcher.module.css`,
`components/__tests__/language-switcher.test.tsx`.

## 2026-09-19 — Changed: insula antetului se strânge și în lățime

Clientul a cerut ca starea strânsă să se îngusteze, nu doar să scadă în înălțime.

**Mecanismul, ales ca să nu se poată strica.** Rândul nu e micșorat: cele **două grupuri de capăt**
(logo + ceas, respectiv preferințe + buton + burger) sunt trase spre centru cu `translate`, iar
meniul dintre ele rămâne pe loc. `translate` e o proprietate de compozitor, deci **rândul flex nu e
remăsurat niciodată** — nimic nu se poate împacheta pe două rânduri, niciun control nu se poate
micșora, iar înălțimea antetului nu se poate mișca. Peste lățimea maximă a conținutului insula se
oprește la rândul centrat de 1280px, deci un ecran de 1920 primește aceeași insulă, nu una tot mai
lată.

| Lățime | Bară | Insulă | % |
| --- | --- | --- | --- |
| 390 | 390 | **308** | 79,1 |
| 861 | 861 | **758** | 88,1 |
| 1024 | 1024 | **783** | 76,5 |
| 1280 | 1280 | **942** | 73,6 |
| 1440+ | 1440 | 942 | 65,4 |

**Unde cedează, măsurat în toate trei limbile:** la **861px** româna e cea mai lată și lasă doar 84px
între grupuri (rusa 96,7, engleza 84,2). O tragere mai mare de ~39px ar coborî sub 45px de respiro,
deci banda aceea primește cea mai mică tragere și rămâne la 88%. Am preferat asta în locul unui meniu
înghesuit în butonul roșu. Fiecare bandă e dimensionată după propriul ei punct cel mai strâns, ca să
rămână ~50px între grupuri.

**Verificat din nou, pentru că schimbarea asta e exact genul care reintroduce problema pe care
designul o previne:** `[data-scene-layer]` măsurat în ambele stări, la același scroll —
`{y: 71, h: 729}`, `top: 71px`, **identic în fiecare câmp**; `--header-h` rămâne 71px la toate
lățimile; nicio depășire orizontală nicăieri.

În starea strânsă: meniurile derulante rămân aliniate exact la declanșatorul lor (decalaj 0) și în
interiorul insulei; popup-ul compact de limbă la 320 și 360 se deschide în interiorul ei; burgerul,
capcana de focus și Escape funcționează; pragul și histerezisul sunt neatinse, cu aceleași rezultate
la tremurat.

Testul nou fixează **mecanismul**: traversarea pragului are voie să schimbe doar tokenurile de
`translate` de pe cele două grupuri de capăt și culoarea marginii antetului — orice redimensionare a
rândului îl pică.

Fișiere: `components/layout/Navbar.tsx`, `components/__tests__/header-condense.test.tsx`.

## 2026-09-19 — Added: antetul se strânge într-o insulă plutitoare la derulare

Clientul a cerut ca antetul să se micșoreze la derulare, cu colțuri rotunde și o animație frumoasă.

**Capcana, evitată prin proiectare.** `--header-h` e citit în **20 de locuri**, printre care sonda
scenei 3D (care așază stratul lipit, zona elicei, colțul pașilor și spanurile spiralei), șina de
fibră, ghidul, Hero și paginile de servicii. Un antet a cărui înălțime de așezare s-ar anima odată cu
derularea ar trage **toată scena 3D** în sus și în jos la fiecare cadru.

Deci **înălțimea rezervată nu se schimbă niciodată.** `<header>` își păstrează cutia; tot ce se vede
s-a mutat pe un frate poziționat absolut, `aria-hidden` și fără evenimente de pointer, care poartă
sticla, inelul, umbra și firul roșu. Acela se strânge.

- **Sus:** bara de azi, pe toată lățimea.
- **Strâns:** insulă retrasă 7px sus/jos și `clamp(8px, 2vw, 24px)` lateral, colțuri de 16px, inel de
  1px, iar firul roșu tras la mijlocul lățimii. 56px înălțime desenată în 70px rezervați.
- **Prag cu histerezis:** se strânge la 72px de derulare, se desface sub 24 — bandă de 48px.

**Dovada că merge:** `[data-scene-layer]` măsurat în ambele stări, la același scroll, spate în spate:
`{y: 71, h: 729}` și `top: 71px` — **identic**. Eșantionat la șase poziții de derulare peste prag:
neschimbat. `--header-h` rămâne 71px peste tot.

**Flicker:** 12 traversări → exact 24 de comutări (două pe traversare, cum trebuie). 80 de cadre de
tremurat de 1px **exact pe prag** → **o singură** comutare; 80 de cadre în interiorul benzii → **zero**.

**Starea e înghețată cât timp pagina e acoperită** (dialogul de cerere fixează `<body>`, ceea ce face
ca derularea să se citească 0) — altfel bara s-ar desface sub dialog și s-ar re-strânge la închiderea
lui.

Verificat în starea strânsă: meniurile derulante de pe desktop, burgerul de pe telefon cu capcana lui
de focus și Escape, comutatorul de limbă și popup-ul lui compact, dialogul de cerere, ordinea la
tastatură și zonele de atingere de 44px. Contrastul copiei peste pânza 3D care trece pe dedesubt:
**11,28** pentru textul principal, 6,05 pentru cel secundar — insula pictează identic în ambele stări.

**Compromisuri asumate:** forma animează poziția și raza, nu transformări — o transformare ar
deforma raza de 16px, inelul de 1px și blurul; costul e izolat într-un singur element gol, în afara
fluxului, ceea ce dovedesc chiar numerele stratului de mai sus. `clip-path` ar fi fost integral pe
compozitor, dar taie inelul și umbra, lăsând insula fără muchie pe o pagină aproape neagră. Și bara
nu poate coborî sub 56px: rândul de atingere de 44px trebuie să rămână 44px.

Fișiere: `components/layout/Navbar.tsx`, `components/layout/useHeaderCondensed.ts` (nou),
`components/__tests__/header-condense.test.tsx` (nou, nerulat).

## 2026-09-19 — Changed: cardurile călăresc acum elicea, nu orbitează în jurul ei

Clientul a cerut ca imaginile proiectelor să fie **legate de firul ADN-ului**. Un cablu între ele s-a
dovedit imposibil de desenat (raza orbitei cardurilor era de 2,08× raza firului, deci punctul de fir
corespunzător stătea mereu **în spatele cardului**, cu lungime vizibilă negativă). Clientul a ales
cealaltă cale: firul vine la carduri.

**Ce limitează raza, măsurat — și nu e ce credeam.** Titlul secțiunii nu limitează deloc: modelul e
scalat după înălțimea lui, nu după rază, deci muchia de sus a elicei nu se mișcă (verificat: y 107 /
106 / 102 înainte și după). Șina de fibră nu limitează nici ea — banda de 44px e un clamp al
*cardurilor*. **Limitează panoul hologramei**, și cel mai tare la ecranul cel mai îngust: plafonul
onest e 1,82 unități, stabilit la 861×700.

**Raza exactă de „călărire" nu poate fi o singură constantă:** scena potrivește modelul după
*înălțimea* zonei, iar cardurile orbitează după *lățimea* ei, deci valoarea ideală variază cu 31%
între formate (1,877 la 1280×800, 1,436 la 861×700).

**Varianta „perfectă" a fost respinsă după ce a fost privită.** La 1,88 elicea se aplatizează într-un
arc: raportul diametru/pas urcă la 1,74, când ADN-ul real e la 0,59 — și la 861×700 cipurile ating
panoul hologramei. S-a ales **1,45**: spirala trece pe lângă **ambele** margini ale coloanei de
carduri, iar cardurile stau înăuntrul ei.

Măsurat pe pagina randată, anvelopa desenată față de orbita cardurilor: **0,51 înainte → 0,84 / 1,01 /
1,08** la 1280 / 1024 / 861. Un fir care ar tăia exact prin mijlocul cardului din față ar dispărea
oricum în spatele lui; ce se citește ca „înfiletat" e un fir care trece prin silueta fiecărui card cu
spira ieșind dincolo de ambele muchii.

**Ce a fost verificat pentru că se putea strica:**
- silueta pe care aterizează roiul se derivă din aceeași constantă, deci a urmat singură;
- **împletitura de la apariție** s-a deschis de la 92 la 148px, dar raportul e neschimbat, deci se
  citește la fel — iar desfășurarea acoperă acum o distanță mai mare;
- pe telefon elicea ambientală a ieșit cu **~19% mai scurtă**, pentru că o moleculă mai groasă umple
  mai repede banda; verificat că rămâne în bandă și liberă de orice rând de text;
- finișul strânge acum firele într-un fascicul de 148px în loc de 92: „tras într-o linie" e puțin mai
  slab. Neschimbat, dar notat — se poate readuce la absolutul vechi.

**Cele două numere care decid:** contrastul titlului cardului din față peste fir e **7,56–12,16** (cel
mai prost caz la 861×700, în plină predare între carduri) — pragul e 4,5. Iar banda titlului
secțiunii rămâne la luminanța albului ei propriu pe toată durata apariției: **niciun pixel din
„Proiectele care ne reprezintă" nu e atins de elice**.

Fișiere: `components/scene/shapes.ts` (raza), `components/scene/choreography.ts` (întinderea),
plus testele scenei — inclusiv unul nou care fixează că raportul fir/orbită e între 0,75 și 1,15 la
toate cele trei formate și că înainte era sub 0,5.

## 2026-09-19 — Added: ADN-ul se replică la apariție

Clientul a cerut „o animație 3D frumoasă și wow cum apare ADN". Până acum elicea apărea prin roiul
modelului de servicii care ateriza pe ea — corect, dar fără moment propriu.

Acum sosirea are cinci mișcări, într-o singură bandă de scroll: firele apar **strânse într-o
împletitură îngustă**, se desfășoară în elice cu o rotație proprie, roiul aterizează pe forma
formată, apoi treptele și cipurile **se scriu dinspre mijloc spre exterior**, ca o bulă de replicare
care se deschide în ambele direcții, iar holograma se deschide la final dintr-o linie orizontală.

**Armarea, care e partea grea.** Acest proiect a pierdut deja trei runde pe animații care se
consumau în afara ecranului. Linia de armare e acum derivată din pista secțiunii, cu 0,30 dintr-un
ecran înainte, și a fost verificată pe **cele trei căi prin care poți ajunge acolo**:

| Cum ajungi | Sosirea începe | Elicea pe ecran |
| --- | --- | --- |
| Derulare 700 px/s | scrollY 1672 | 72% la start, 100% după 0,31s din 1,2s |
| Link direct `#lucrari` | 1891 | **100% tot timpul** |
| Reîncărcare în secțiune | 2803 | **100% tot timpul** |

Cel mai prost cadru posibil e primul; după linia lipirii, centrul elicei e fix în mijlocul stratului.
Verificat și la 861×700. La o aruncătură de 2500 px/s molecula e desenată **completă și mare** înainte
ca finișul s-o tragă înapoi în fascicul — gaura pe care o închide clampul `exit > 0` era reală.

**Corecții găsite prin măsurare, nu din citit:**
- filamentul propus la 0,06 ar fi avut **0,18 px** pe ecran — o linie punctată care se târăște, nu o
  strălucire. Podeaua e 0,42, valoare deja dovedită pe finiș;
- `helixArrive` trebuia scris în **toate cele trei ramuri** ale compoziției și în starea inițială,
  altfel cadrul de pre-warm ascundea trei desene, care s-ar fi compilat în plin scroll;
- aceeași problemă exista și la intervalul de desenare al bulei, pe care critica n-o văzuse: la
  fork 0 nu se desena nimic, deci bufferul treptelor nu se încărca **exact** pe cadrul care trebuia
  să-l încarce;
- zăvorul care împiedică un puls gratuit trebuie să pornească „cheltuit", altfel orice elice deja
  formată la primul cadru trage un flash nemeritat;
- linia de armare nu poate fi folosită pentru banda ambientală de pe telefon: e cu un ecran mai sus
  decât pista, deci s-ar arma când banda e deja sub header. Telefonul păstrează vechea bandă.

**Măsurat:** contrastul copiei cardului din față peste filament e **11,05** la cel mai strâns moment —
mai bun decât peste elicea formată (9,34), pentru că filamentul adaugă mai puțină lumină lângă card.
Riscul semnalat la proiectare nu se materializează. Titlul secțiunii rămâne la ~133 px de muchia
elicei, neatins.

**Acceptat conștient pentru trecerea asta:** cometa care călărește bula luminează doar furca de sus —
shaderul are un singur ceas și indicele treptei ca fază, iar simetrizarea ar schimba și măturarea de
repaus, documentată. Notat, nu ascuns.

Fișiere: `components/scene/three/models/helix.ts`, `components/scene/choreography.ts`,
`components/scene/three/world.ts`, plus testele scenei.

## 2026-09-19 — Removed: sunetul și tema deschisă

Clientul a arătat cele două butoane din antet și a cerut ca ambele funcții să dispară din proiect.

**Sunetul, în întregime.** `lib/sound/*`, `SoundToggle`, providerul și **toate locurile de unde era
chemat**. Nu exista niciun fișier audio de șters: tonurile erau sintetizate cu oscilatoare Web Audio.
Unde un apel de sunet stătea într-o ramură care făcea și altceva — tonul de confirmare al intro-ului,
apăsările din butonul de dictare, deschiderea fluxului de cerere — s-a scos **doar sunetul**, restul
a rămas neatins.

O descoperire pe drum: `PREFERS_REDUCED_MOTION` locuia în `lib/sound/sound.ts`, deși n-are nicio
legătură cu sunetul. A fost mutat în `lib/device.ts` în loc să dispară odată cu modulul — altfel
poarta de „mișcare redusă" a intro-ului s-ar fi pierdut tăcut.

**Tema deschisă.** `ThemeToggle`, `lib/theme/*`, cookie-ul `tbs_theme`, atributul `data-theme` și
scriptul din `<head>` care preveni pâlpâirea la încărcare. În `app/globals.css` cele două căi de
activare (`prefers-color-scheme: dark` și `[data-theme="dark"]`) s-au strâns într-o singură hartă
necondiționată, iar **cele 37 de perechi deschise** ale tokenurilor au fost șterse; `color-scheme:
dark` stă acum pe rădăcină, ca browserul să deseneze controalele și scrollerele interioare închise.
Al doilea fișier cu reguli pentru tema deschisă, `HeroCoreArt.module.css`, a fost curățat la fel.
Din catalogul de mesaje au dispărut, **din toate trei limbile odată**, cheile butonului de temă.

Două lucruri rămân intenționat:
- **scara `--dark-*`** — preloaderul intro citește opt dintre aceste tokenuri **pe nume**, pentru că
  se desenează pe fundalul lui propriu; forma documentată a fișierului rămâne, doar că acum harta e
  una singură;
- **`uInk` în shadere**, acum permanent 0. Apare în ~10 locuri în `materials.ts` plus în fiecare
  model; scoaterea lui ar fi însemnat să umblăm în toate modelele pentru zero câștig vizibil.

Politica de cookie-uri **nu a trebuit atinsă**: nu enumera nici `tbs_theme`, nici vreun cookie de
sunet — o scăpare mai veche, semnalată chiar în `docs/16`, care acum a devenit corectă de la sine.

Verificat pe containerul care rulează: HTTP 200 pe toate paginile (inclusiv cele cinci de servicii,
cele legale și adminul), fundal închis peste tot, `data-theme` absent din HTML-ul servit — deci nu
există de unde să pâlpâie — și **zero erori de consolă** la 1280 și 390. Antetul rămâne aliniat, fără
gol acolo unde erau butoanele, iar ordinea la tastatură e neîntreruptă.

**Datorie asumată, de curățat într-o singură trecere la final:** `docs/03`, `04`, `07`, `09`, `11`,
`16` și `e2e/README.md` descriu încă tema și sunetul; `components/__tests__/scene-palette.test.ts` și
câteva teste ale scenei verifică ramura „ink" pe care nimic n-o mai poate produce.

Fișiere: șterse `lib/sound/*`, `lib/theme/*`, `components/ui/{SoundToggle,ThemeToggle}.*`;
modificate `app/{globals.css,layout.tsx,tailwind.css}`, `components/intro/*`,
`components/layout/Navbar.tsx`, `components/scene/{SceneCanvas.tsx,three/palette.ts}`,
`components/ui/*`, `lib/{device.ts,solutions.ts,i18n/messages/*}`, `e2e/*`.

## 2026-09-18 — Changed: o singură bară de derulare — fibra, împinsă la marginea ferestrei

Clientul a arătat cele două bare una lângă alta și a cerut ca **bara nativă a browserului să dispară,
iar fibra să rămână singură, cât mai la dreapta**.

- De la **861px în sus** — exact lățimea la care există fibra — bara nativă nu se mai desenează.
  Ascunderea e **necondiționată** la lățimea asta, nu legată de prezența fibrei
  (`html:has([data-rail])`), și asta e decizia care contează: fibra se montează abia după
  consimțământ și prima interacțiune, deci o bară care ar dispărea odată cu ea ar fi recuperat
  jgheabul **în mijlocul cititului** și ar fi deplasat toată pagina lateral cu ~15px sub ochii
  vizitatorului.
- **Derularea în sine e neatinsă:** rotița, trackpad-ul, tastele, Home/End și butoanele fibrei
  funcționează la fel. Dispare doar bara desenată. Decizia 5 a planului — „scroll nativ păstrat" —
  rămâne respectată: fibra tot nu derulează pagina, doar o măsoară.
- `scrollbar-width` nu se moștenește, iar pseudo-elementul WebKit e legat strict de rădăcină, deci
  **fiecare scroller interior își păstrează bara**: corpul dialogului de cerere, meniul burger,
  jurnalul de chat și banda de proiecte de pe telefon.
- Sub 861px, unde nu există fibră, bara nativă rămâne exact cum era (subțire, cyan).
- **Fibra s-a mutat pe margine:** linia ei stă acum la **10px** de marginea ferestrei, față de 22px,
  spațiul fiind eliberat chiar de bara ascunsă. Butoanele de navigare rămân 44×44 — WCAG 2.5.5 cere
  o zonă de atingere de 44px, nu ca linia să fie desenată în centrul ei.

Verificat pe containerul care rulează: la 1280px bara nativă măsoară 0px și `scrollbar-width` e
`none`, centrul fibrei e la 10px de margine; la 390px `scrollbar-width` rămâne `thin` și nu există
fibră.

Fișiere: `app/globals.css`, `components/hud/rail/ScrollRail.module.css`.
Documentație: [docs/04](./docs/04-design-system.md) · [docs/05](./docs/05-page-sections.md).

## 2026-09-18 — Fixed: obiectele din panouri ieșeau din conturul ferestrei

Clientul a văzut, într-o captură mărită, obiectul 3D depășind conturul ferestrei — sub talpă și în
lateral. Verificarea anterioară a încadrării fusese făcută pe **geometria** pieselor, dar obiectele se
desenează aditiv, iar **aureola lor se întinde cu ~50% dincolo de muchii**: cutia luminată ajunge la
±0,65 unități față de ±0,42 cât declară geometria. Fereastra nu are niciun strat care să taie ce iese
(și nici nu poate avea: ar cere `overflow`/`contain` pe un strămoș al scenei, interzis).

**Măsurat, nu presupus.** Banda a fost fotografiată cu pânza 3D **ascunsă**, ca referință, apoi
fiecare cadru a fost comparat cu ea: grila, marginile, colțurile și numerele paginii se anulează
exact, iar ce rămâne e **numai ce luminează scena**, aureola inclusă. Măturare de 60 de cadre per
obiect (buclele sunt de 3,6 / 4,2 / 4,8s, deci fiecare e prins de mai multe ori), la trei praguri de
luminozitate — răspunsurile nu se schimbă între ele, deci nu e un artefact de prag.

- Potrivirea se face acum pe **cutia luminată** (`PANEL_LIT`), cu o distanță explicită de **6px de
  aer** de fiecare parte (`PANEL_AIR`), nu pe o fracțiune din fereastră — o distanță în pixeli nu se
  micșorează odată cu fereastra.
- O singură cutie luminată pentru toate trei, intenționat: trei limite separate ar însemna trei scări
  și trei grosimi de linie în trei panouri vecine, adică exact defectul pe care rândul a fost desenat
  să-l evite.

**Costul, numit în loc de ascuns:** pe fereastra de 62px, obiectele încăpeau doar la **59% din
mărimea aprobată de client**. Așa că **fereastra a crescut la 96px** — singura pârghie rămasă — iar
cadrul ei (bara de sus, ghidajele, colțurile) a fost re-proporționat ca să rămână o nișă de
instrument, nu o tavă goală. Panoul e cu 34px mai înalt; cutia textului e neschimbată la octet, iar
contrastul rămâne la 4,63 / 4,50.

Rezultat, măsurat pe containerul reconstruit: **64,6 px/unitate la 1280** — exact mărimea aprobată —
și niciun pixel nu trece de marginea ferestrei, la nicio lățime, în nicio temă. Cea mai strânsă marjă
din toată matricea e **7px**. Sub 900px axa care limitează se schimbă din înălțime în lățime, iar la
861px obiectele stau la 61,7 px/unitate (−4,5%); nicăieri nu cresc peste mărimea aprobată, deci rândul
nu se umflă acolo unde are loc.

Fișiere: `components/scene/choreography.ts`, `components/sections/DirectionPage.module.css`.

## 2026-09-18 — Fixed: cele trei obiecte din panouri — încadrare, coloană și echilibru

Trei reparații pe rândul de obiecte publicat mai devreme, toate găsite uitându-ne la el, nu în cod.

**Încadrarea la ecrane înguste.** Centrul unei treimi din rând **nu e** centrul panoului: diferența e
spațiul dintre panouri împărțit la trei, constantă (−4,67 / 0 / +4,66 px la orice lățime). La 861px
ferestrele au 253px, iar obiectele laterale ieșeau ~4px în afară. Sonda măsoară acum **ferestrele
însele** — prima și ultima — și deduce pasul dintre ele, iar potrivirea se face pe lățimea ferestrei,
nu a treimii. Matematica nu mai conține nimic despre spații, margini sau praguri, deci rezistă dacă
rândul se schimbă. La 861px obiectele au ~15px liberi de fiecare parte.

**Primul obiect rămânea fără identitate ~15% din buclă.** Rigla era o singură cutie a cărei lungime
*era* lungimea desenată, deci la resetare dispărea și rămâneau șase cuburi plutind — arăta a
defecțiune, nu a respirație. Acum rigla e **o coloană permanentă** pe toată lățimea, ștearsă, scutită
de estomparea de resetare, plus o lungime desenată deasupra ei care urcă odată cu bara și e singura
care se retrage. Nu mai există niciun cadru fără riglă.

**Al treilea obiect era prea slab** față de vecinul din mijloc: structura lui ocupa stânga, iar
dreapta era ținută de o piesă mică ce zbura în colț. A primit un **stâlp** în dreapta și un **braț**
scurt îndreptat spre zbor; piesa traversează acum tot mijlocul pe diagonală și **se așază pe braț**,
care se aprinde la sosire. Stâlpul e vertical (nu o a doua linie de bază) și e un colț deschis (nu al
doilea dreptunghi închis). Prima variantă, cu trei piese în colț, a fost aruncată după ce a fost
privită: trei margini într-un pătrat de 40×20px erau exact „supa de lumină" de care avertizase
critica.

Buget final al rândului: 27 de piese instanțiate, **3 desene, niciun program nou**.

Fișiere: `components/scene/three/models/panel/{surveyField,launchRamp}.ts`,
`components/scene/scrollProbe.ts`, `components/scene/choreography.ts`, `lib/scene.ts`.

## 2026-09-18 — Added: trei obiecte 3D mici în rândul de beneficii

Clientul, după secvența de lumini: „adauga ceva 3d modele animate acolo ca totdeauna arata prea
sarac". Fiecare panou de beneficiu primește o **fereastră transparentă** jos, cu un obiect 3D animat
în ea. Trei obiecte, **comune tuturor celor cinci servicii**, pentru că beneficiile sunt aceeași
secvență peste tot — clarifici, construiești, lansezi — și cincisprezece modele ar fi fost aceeași
muncă plătită de cinci ori.

- **„Cadastrul"** (clarifici): o bară verticală traversează, desenând o linie în urma ei, iar
  marcajele împrăștiate se așază pe ea la pas egal. Contrastul dezordine/ordine se citește înainte ca
  vreo piesă să se rezolve.
- **„Bancul de probă"** (construiești): o piesă intră pe un arc, se oprește **proeminentă**, se
  corectează, se așază, apoi o presă coboară vertical peste ea.
- **„Rampa"** (lansezi): ceva urcă pe două marcaje scurte și pleacă pe diagonală, iar capul
  catargului primește semnalul.

**Ce a tăiat critica de design**, după ce a măsurat caseta reală (**260×62 px**, nu 150×90 cât
scrisesem eu în brief): toate trei obiectele aveau **o linie orizontală la bază**, toate trei bucle
de 4,2s, iar accentele a două dintre ele cădeau la **0,14s** distanță — puse alături s-ar fi citit ca
un singur obiect repetat, pulsând în cor. Acum: perioade 3,60 / 4,20 / 4,80s (nicio coincidență nu se
repetă într-o vizită), o singură linie de bază, un singur dreptunghi închis, o singură baleiere
orizontală — de aceea presa bancului coboară vertical. Al treilea obiect a fost refăcut de la zero:
povestea lui trăia în trei dungi de 8×2,4px, invizibile la mărimea reală.

**Roșul a fost interzis** în afara unei singure piese, 0,6s: în acest proiect roșul e rolul refuzului
(scrierea eșuată de la Automatizare), iar un panou de lansare care clipește roșu spune „eroare".

**Tehnic:** trei desene în plus, **niciun shader, uniform, ramură de material sau textură nouă** — toate
trei sunt aceeași cutie instanțiată pe care o folosesc deja modelele de servicii. Se construiesc câte
unul pe cadru, doar când rândul se apropie de ecran; se sting complet când iese; nu există deloc pe
pagina principală. Aceeași geometrie, același material, aceeași grosime de linie pentru toate trei —
altfel trei limite proprii ar fi dat o diferență de 65% în grosimea liniei între panouri vecine.

**Două lucruri prinse prin măsurare, nu prin presupunere:**
- contractul pe care l-am scris („împarte rândul în treimi") nu spune **unde** e fereastra: rândul e
  înalt de 241px, fereastra e banda de 62px din josul lui, iar pe dispozitivele fără 3D fereastra nu
  există. O tăiere oarbă ar fi desenat obiecte **peste textul panourilor** exact acolo unde nu trebuie.
  Scena măsoară acum fereastra reală și, dacă lipsește, nu construiește nimic;
- umplerea a coborât de la 0,9 la 0,88: obiectele fiind înclinate în poza lor, se proiectează puțin
  mai înalte decât declară, iar soclul celui din mijloc ieșea o jumătate de pixel sub fereastră.

Fișiere noi: `components/scene/three/models/panel/{kit,surveyField,panelFit,launchRamp}.ts`.
Modificate: `components/scene/three/world.ts`, `choreography.ts`, `scrollProbe.ts`, `models/types.ts`,
`lib/scene.ts`, `components/sections/DirectionPage.tsx` + modulul CSS.

## 2026-09-18 — Changed: rândul de beneficii se citește ca o secvență, nu ca trei cutii identice

Clientul: „ii perfect dar fa aici ceva mai mult ca ii prea sarac arata". Cele trei beneficii sunt, pe
fiecare direcție, un parcurs — clarifici, construiești, lansezi — și acum se văd așa.

- **Un impuls traversează rândul o singură dată**, la intrarea în ecran: intră în primul panou, îl
  parcurge și predă următorului (0 / 0,62 / 1,24s). Marginea, dâra, colțurile și nodul se aprind pe
  aceeași bătaie.
- **Colțuri de vizor** care se desenează singure, **o linie de circuit** de 1px care se termină
  într-un **inel pătrat de 10×10** (inel, nu punct — regula casei interzice punctele decorative sub
  8px), și **numărul panoului**, mare și șters, în colț.
- **La hover sau focus** (doar pointer fin), impulsul se reia pe panoul atins. Cele două impulsuri
  stau pe pseudo-elemente separate, ca o reluare să nu poată reporni secvența de intrare.

**Un defect real, găsit prin măsurare:** `animation: … calc(var(--seq) + 220ms)` cu `--seq` conținând
el însuși un `calc()` face ca întreaga prescurtare `animation` să nu se poată interpreta, iar **toate
întârzierile cad tăcut pe 0** — adică toate trei panourile se aprindeau simultan, exact problema pe
care o rezolvam, dar în mișcare. Rezolvat ținând `--step` un număr simplu și folosind proprietățile
lungi, cu un singur `calc` plat.

**Contrastul nu s-a înrăutățit** (minimul rămâne **4,50** strict / **4,63** prin metoda casei, în
ambele teme). Varianta evidentă a numărului — trecând pe sub text — a fost respinsă după măsurare:
chiar la 5% intensitate ducea eticheta la 4,10 strict în tema deschisă. Numărul stă acum într-o bandă
de padding rezervată, unde un rând de text nu poate intra — o garanție structurală, nu o măsurătoare
care se schimbă când se schimbă textul.

Fără bare de progres, procente sau contoare: orice ar arăta ca o măsurătoare a firmei ar fi
fabricată. Sub „mișcare redusă" totul e prezent și static. Sub 760px, unde rândul se stivuiește,
fiecare panou își joacă propria trecere și numerele țin socoteala.

Fișiere: `components/sections/DirectionPage.tsx`, `components/sections/DirectionPage.module.css`.

## 2026-09-18 — Added: paginile de servicii capătă viață sub hero; modelul 3D însoțește pașii

Clientul a cerut trei lucruri, după ce a văzut modelele noi: caseta de sub model să dispară, iar mai
jos pe pagină „să adaugi ceva frumos animat, interactiv". A ales, dintr-o listă de șase propuneri,
pașii vii legați de model, beneficiile ca panouri și cazurile care se deschid pe loc.

**Caseta „Proiect de referință" a ieșit din hero.** Coloana din dreapta rămâne doar cu modelul 3D.
Nu s-a pierdut conținut: pe fiecare pagină, proiectul din casetă e oricum primul card din „Proiecte
relevante". La E-commerce, singura direcție fără proiect public, caseta desena **schema fluxului** —
aceasta s-a mutat lângă pașii „Cum lucrăm", unde se citește ca un întreg cu ei.

**Cele trei beneficii sunt acum panouri HUD**, în vocabularul care exista deja la „Direcții": marginea
se aprinde la intrarea în ecran, o dâră de lumină trece o dată peste panou, iar pe pointer fin panoul
se înclină după cursor (doar transformare, fără blur). Contrastul cel mai slab măsurat sub bandă:
**4,63** pe eticheta roșie în temă deschisă, restul 4,90–7,27. Sub „mișcare redusă" panourile sunt
aprinse static, fără dâră.

**Cazurile se deschid pe loc**, cu `aria-expanded` pe un buton real, panoul `inert` cât e închis (ca
linkul dinăuntru să nu fie o oprire invizibilă la Tab) și animație pe `grid-template-rows`. Măsurat:
Enter deschide, **derularea rămâne neschimbată** (824 → 824), focusul rămâne pe buton, Space închide.

**Pașii „Cum lucrăm" sunt vii și conduc modelul 3D.** O linie se umple pe parcursul secțiunii, iar
numărul pasului citit se aprinde. Pagina raportează scenei ce pas se citește
(`selectServiceStage`), iar scena **ține modelul pe momentul potrivit din bucla lui**.

- **Defect prins la timp:** la 1280px toți cei trei pași încăpeau simultan în banda de detecție, deci
  pagina raporta mereu „pasul 1". Detecția e acum o linie unică la 45% din ecran, iar rândurile s-au
  distanțat de la 65px la 95–116px. Parcurgere completă, toate cele cinci pagini: secvența e exact
  `-1 0 1 2 -1`, cu zero eșantioane cu doi pași activi.
- **Al doilea defect, mai grav:** secțiunea pașilor stă la ~1000px sub hero, deci modelul era în afara
  ecranului tocmai când reacționa — mecanismul funcționa perfect și nu-l vedea nimeni. Clientul a ales
  compromisul: **modelul se mută într-un colț doar cât citești „Cum lucrăm"**, și se întoarce după.
  Călătoria durează 0,65s dus și 0,5s întors, pornește devreme (cât caseta urcă spre ecran), rezistă
  la o derulare bruscă peste toată secțiunea și la răzgândire la jumătatea drumului.
- **Al treilea:** modelul ajungea corect în colț, dar cardul secțiunii îl acoperea cu fundalul lui
  opac — pânza desenează în spatele paginii. Cardul a fost mutat pe un înveliș interior care se
  termină înaintea coloanei modelului, deci coloana aceea nu mai are niciun strat pictat deasupra.
  Fără mască, fără clip, fără schimbare de stivuire (care ar fi pus elicoidul din „Lucrări" peste
  propriile carduri, pe pagina principală).

**Tabelele etapă → moment din buclă** (3 pe serviciu, verificate față de textul pașilor): la
Automatizare, pasul 3 ține modelul pe **înregistrarea roșie oprită la poarta închisă**; la
E-commerce, pasul 3 pe momentul autorizării cardului; la Brand & UI, pasul 2 pe rearanjarea în
telefon. Modelul **nu îngheață** cât e ținut: banda, pachetele și strălucirea merg mai departe — doar
ceasul poveștii stă.

**Decizii luate prin măsurare, nu prin presupunere:**
- coloana modelului e rezervată și pe `pending`, nu doar pe `webgl`: varianta evidentă făcea pașii să
  sară **282px** în clipa în care scena se decidea;
- o casetă `sticky` măsurată cât e lipită minte despre poziția ei (verificat în Chromium, atât
  `getBoundingClientRect` cât și `offsetTop`), deci scena reține ultima măsurătoare de dinainte de
  lipire;
- pe dispozitivele fără 3D coloana se retrage, ca pașii să-și recupereze lățimea.

**Rămâne de decis:** pe desktop cu 3D, cardul pașilor e acum cu ~280px mai îngust decât grila de
proiecte de deasupra, pentru că modelul stă lângă el, nu peste el. Alternativa (cardul pe toată
lățimea, cu modelul deasupra) ar cere ridicarea pânzei peste pagină, ceea ce strică „Lucrări".

**Rămâne de reparat:** două teste din `direction-page.test.tsx` verifică prezența casetei scoase.

Fișiere: `components/sections/DirectionPage.tsx` + modulul CSS, `components/scene/three/world.ts`,
`components/scene/choreography.ts`, `components/scene/scrollProbe.ts`, `lib/scene.ts`.

## 2026-09-18 — Fixed: cookie-ul vechi al intro-ului bloca intro-ul pentru toți vizitatorii de dinainte

Prima încercare — „site-ul nu mai scrie `tbs_intro`" — era corectă, dar insuficientă, și clientul a
raportat imediat că tot nu vede intro-ul. Motivul: cookie-ul **continua să fie citit**, iar cel scris
înainte de modificare trăiește până la închiderea browserului. Deci fiecare browser deschis peste
schimbare — al clientului, dar și al oricărui vizitator care intrase vreodată pe site — rămânea fără
intro, arătând exact ca defectul raportat.

- Cookie-ul care sare intro-ul a fost **redenumit** în `tbs_intro_skip`. Numele vechi nu mai e citit
  de nimeni, deci un cookie rămas din sesiunile anterioare nu mai are niciun efect.
- `finishIntro` **șterge** cookie-ul vechi (`max-age=0`), ca să nu mai rătăcească prin browsere.
- Numele nou nu e scris niciodată de site; e doar citit, ca suita e2e (care îl seedează prin
  constanta `INTRO_COOKIE`) să poată sări intro-ul. Seed-ul din `e2e/helpers.ts` folosește constanta,
  deci s-a mutat singur pe numele nou.

Verificat pe site-ul care rulează, reproducând exact situația clientului — un browser care poartă
`tbs_intro=seen` de dinainte: intro-ul apare la toate cele trei încărcări succesive. Verificare
inversă: un browser cu `tbs_intro_skip=seen` sare intro-ul, deci mecanismul de testare rămâne intact.

**Lecția, notată pentru data viitoare:** o schimbare de comportament care depinde de o stare deja
scrisă în browserele oamenilor nu e completă până nu tratează și starea veche. „Nu mai scriem" nu
înseamnă „nu mai există".

Fișiere: `lib/intro.ts`.

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
