import type { LocalizedText } from "@/lib/i18n/content";

/**
 * The assistant's copy: her name, her button's accessible name and her questions.
 *
 * Local `{ ro, ru, en }` objects rendered through `useLoc()` (docs/16-i18n-seo.md), not catalog
 * keys: the copy belongs to this one lazy part, so it ships in the guide's chunk and nowhere else.
 * No directive and type-only imports, so the E2E specs can import it into Node and find the
 * controls by exactly these strings.
 *
 * Honest by construction: she answers a few written questions and never calls herself "AI".
 * Nothing here promises a response time; the estimator's own `SENT_COPY` is the only place that
 * does (one business day).
 *
 * NOTHING HERE IS SAID UNASKED, and the file is short for that reason. The linger prompts and
 * their two buttons went with the guide on 2026-09-26; `hello`, the one sentence she spoke in a
 * bubble the moment her entrance finished, went the same day — the owner photographed it and
 * asked for it to go. `dismiss` ("Inchide") went with it: it was that bubble's close label, and
 * the only bubble left is the questions, which has `faqClose`.
 */

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

export const GUIDE_COPY = {
  /** The visible caption under the avatar. (The bubble's kicker is `faqHead`.) */
  label: L("Asistent TBS", "Ассистент TBS", "TBS Assistant"),
  /** The avatar button's accessible name. It starts with the visible caption (WCAG 2.5.3). */
  /* THE NAME HAS TO SAY WHAT THE BUTTON DOES. It used to promise the guided request assistant,
     and that was true while pressing her opened it. Pressing her now opens her questions, and the
     request assistant is a second press from inside them — so the name says questions. A control
     that names something it does not do is the one thing this site's own copy rules forbid. */
  aria: L(
    "Asistent TBS: deschide întrebările frecvente",
    "Ассистент TBS: открыть частые вопросы",
    "TBS Assistant: open the frequent questions",
  ),
  open: L("Deschide cererea", "Открыть заявку", "Open the request"),
  /** The head of the questions panel. Not "online", and no status pip: the first is forbidden
      for this component, the second would be a round element under the decorative-dots rule. */
  faqHead: L("Asistent TBS · întrebări frecvente", "Ассистент TBS · частые вопросы", "TBS Assistant · frequent questions"),
  faqIntro: L(
    "Alege o întrebare. Răspunsurile sunt scrise dinainte de echipă.",
    "Выберите вопрос. Ответы заранее написаны командой.",
    "Pick a question. The answers were written by the team in advance.",
  ),
  /** After the last answer. It names the CTA by the words printed ON the CTA. */
  faqMore: L("Mai am o întrebare", "У меня ещё вопрос", "I have another question"),
  faqClose: L("Închide întrebările", "Закрыть вопросы", "Close the questions"),
};

/** One scripted exchange: a question a visitor asks and the answer the team wrote for it. */
export type GuideQuestion = { readonly id: string; readonly q: LocalizedText; readonly a: LocalizedText };

/**
 * THE ANSWERS ARE WRITTEN, NOT GENERATED, and every one of them repeats something the site
 * already says somewhere else. The file it is said in is named beside it, because an answer that
 * cannot be traced is an answer that goes stale without anyone noticing.
 *
 * Two things are deliberately absent. NO PRICE FIGURE: the prices are the owner's and editable
 * from the admin, so a number written here would be wrong the first time they change one. NO
 * PROMISE OF A CALL FOR EVERY REQUEST: the site attaches the thirty minutes to one CTA, not to
 * every enquiry, and chaining the two into a sequence would invent a commitment.
 */
export const GUIDE_FAQ: readonly GuideQuestion[] = [
  {
    id: "ce",
    q: L("Ce faceți, de fapt?", "Чем вы занимаетесь?", "What do you actually do?"),
    /* The direction names are the site's own tabs (lib/directions.ts, Directions.tsx), with the
       fourth described by what it DOES — its label is a word this component may not print. */
    a: L(
      "Produs digital, e-commerce, automatizare și integrări, asistenți care răspund și califică cererile, Brand & UI. Le găsești pe toate în Servicii, fiecare cu pașii ei.",
      "Цифровой продукт, e-commerce, автоматизация и интеграции, ассистенты, которые отвечают и квалифицируют заявки, Brand & UI. Все они — в разделе «Услуги», у каждого свои шаги.",
      "Digital product, e-commerce, automation and integrations, assistants that answer and qualify requests, Brand & UI. They are all under Services, each with its own steps.",
    ),
  },
  {
    id: "pret",
    q: L("Cât costă?", "Сколько это стоит?", "How much does it cost?"),
    /* No figure: lib/request/catalog.ts records what happened last time one was hard-coded. */
    a: L(
      "Fiecare tip de proiect are un preț de pornire, și îl vezi chiar în panoul de cerere în clipa în care alegi tipul. Cifra finală vine după ce discutăm.",
      "У каждого типа проекта есть стартовая цена — вы видите её прямо в панели заявки, как только выбираете тип. Итоговая сумма — после разговора.",
      "Every project type has a starting price, and you see it in the request panel the moment you pick the type. The final figure comes after we talk.",
    ),
  },
  {
    id: "timp",
    q: L("În cât timp răspundeți?", "Как быстро вы отвечаете?", "How fast do you reply?"),
    a: L(
      "În cel mult o zi lucrătoare.",
      "В течение одного рабочего дня.",
      "Within one business day.",
    ),
  },
  {
    id: "nevoie",
    q: L("De ce aveți nevoie de la mine?", "Что вам нужно от меня?", "What do you need from me?"),
    a: L(
      "Nume, email și două rânduri despre ce vrei. Un caiet de sarcini nu e obligatoriu: dacă ai doar o idee, ghidul pune câteva întrebări scurte și scrie el rezumatul.",
      "Имя, email и пара строк о том, чего вы хотите. Техническое задание не обязательно: если есть только идея, гид задаст несколько коротких вопросов и сам составит итог.",
      "Your name, an email and two lines about what you want. A written brief is not required: if you only have an idea, the guide asks a few short questions and writes the summary for you.",
    ),
  },
  {
    id: "dupa",
    q: L("Ce se întâmplă după ce trimit?", "Что будет после отправки?", "What happens after I send?"),
    /* Conditional, because the site states it conditionally: the summary travels only once the
       assistant has recorded something (Estimator's PATHS.kept). */
    a: L(
      "Dacă ai vorbit cu ghidul, rezumatul pleacă împreună cu cererea. Îți răspundem în cel mult o zi lucrătoare.",
      "Если вы говорили с гидом, итог уходит вместе с заявкой. Мы отвечаем в течение одного рабочего дня.",
      "If you talked to the guide, the summary is sent with the request. We reply within one business day.",
    ),
  },
  {
    id: "robot",
    q: L("Vorbesc cu un robot?", "Я говорю с роботом?", "Am I talking to a bot?"),
    a: L(
      "Nu. Răspunsurile de aici sunt scrise dinainte de echipă — e un ghid, nu o conversație generată. Asistenții care răspund singuri sunt ceva ce construim pentru clienți, nu ceva ce îți vorbește acum.",
      "Нет. Ответы здесь заранее написаны командой — это гид, а не сгенерированный разговор. Ассистентов, которые отвечают сами, мы строим для клиентов; сейчас с вами говорит не такой.",
      "No. These answers were written by the team in advance — this is a guide, not a generated conversation. Assistants that answer on their own are something we build for clients, not something talking to you now.",
    ),
  },
];
