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
 * PROMISE OF A CALL: the thirty-minute conversation was the closing CTA's offer and it went with
 * that CTA (2026-10-09), so an answer that promised a call would invent a commitment.
 */
export const GUIDE_FAQ: readonly GuideQuestion[] = [
  {
    id: "ce",
    q: L("Ce faceți, de fapt?", "Чем вы занимаетесь?", "What do you actually do?"),
    /* The direction names are the site's own tabs (lib/directions.ts, Directions.tsx), with the
       fourth described by what it DOES — its label is a word this component may not print. */
    a: L(
      "Transformăm o idee, un blocaj sau o oportunitate într-o primă versiune pe care o poți testa. Construim MVP-uri, site-uri, e-commerce, automatizări, asistenți și Brand & UI; după semnalele reale, dezvoltăm ce merită.",
      "Превращаем идею, узкое место или возможность в первую версию, которую можно проверить. Создаём MVP, сайты, e-commerce, автоматизацию, ассистентов и Brand & UI; после реальных сигналов развиваем то, что действительно нужно.",
      "We turn an idea, bottleneck or opportunity into a first version you can test. We build MVPs, websites, e-commerce, automations, assistants and Brand & UI; after real signals, we develop what is worth building.",
    ),
  },
  {
    id: "pret",
    q: L("Cât costă?", "Сколько это стоит?", "How much does it cost?"),
    /* No figure: lib/request/catalog.ts records what happened last time one was hard-coded. */
    a: L(
      "Începem cu un MVP cu buget mic, nu cu tot produsul. Vezi prețul de pornire pentru fiecare tip direct în cerere; cifra finală vine după ce stabilim ce merită testat.",
      "Начинаем с MVP с небольшим бюджетом, а не со всего продукта. Стартовую цену для каждого типа вы видите прямо в заявке; итоговая сумма — после того, как определим, что стоит проверить.",
      "We start with a small-budget MVP, not the whole product. See each type’s starting price in the request; the final figure follows once we define what is worth testing.",
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
      "Nume, email și câteva rânduri despre problemă, public și ce vrei să afli. Nu ai nevoie de un caiet de sarcini: dacă ai doar o idee, asistentul din cerere pune întrebări scurte și pregătește rezumatul.",
      "Имя, email и несколько строк о проблеме, аудитории и о том, что хотите понять. ТЗ не нужно: если есть только идея, ассистент в заявке задаст короткие вопросы и подготовит итог.",
      "Your name, email and a few lines about the problem, audience and what you want to learn. You do not need a brief: if you only have an idea, the request assistant asks short questions and prepares the summary.",
    ),
  },
  {
    id: "dupa",
    q: L("Ce se întâmplă după ce trimit?", "Что будет после отправки?", "What happens after I send?"),
    /* Conditional, because the site states it conditionally: the summary travels only once the
       assistant has recorded something (Estimator's PATHS.kept). */
    a: L(
      "Dacă parcurgi ghidul din cerere, rezumatul dialogului pleacă împreună cu ea. Îl citim ca să vedem ce merită testat mai întâi și revenim în cel mult o zi lucrătoare.",
      "Если вы пройдёте гид в заявке, итог диалога уйдёт вместе с ней. Мы читаем его, чтобы понять, что стоит проверить в первую очередь, и отвечаем в течение одного рабочего дня.",
      "If you complete the request guide, its dialogue summary goes with the request. We read it to see what is worth testing first and reply within one business day.",
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
