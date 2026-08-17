"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import { submitContact, isNetworkError, ApiError } from "@/lib/api";
import { validateText, LIMITS } from "@/lib/validation";
import { useSiteContent } from "@/lib/siteContent";
import { SERVICE_QUERY_KEY, SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import type { RequestContext } from "@/lib/request/RequestFlowProvider";
import styles from "./Estimator.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  eyebrow: L("Cerere / estimare", "Заявка / оценка", "Request / estimate"),
  title: L("Spune-ne ce vrei să construiești.", "Расскажите, что хотите построить.", "Tell us what you want to build."),
  lead: L(
    "Un dialog scurt clarifică cererea, iar rezumatul se atașează automat propunerii.",
    "Короткий диалог уточняет запрос, а его résumé автоматически прикрепляется к предложению.",
    "A short dialog clarifies the request, and its summary is attached to the proposal automatically.",
  ),
  step1: L("01 · TIP PROIECT", "01 · ТИП ПРОЕКТА", "01 · PROJECT TYPE"),
  step2: L("02 · OPȚIUNI CARE CONTEAZĂ", "02 · ЧТО ВАЖНО ДОБАВИТЬ", "02 · OPTIONS THAT MATTER"),
  proposal: L("PROPUNEREA TA", "ВАШЕ ПРЕДЛОЖЕНИЕ", "YOUR PROPOSAL"),
  from: L("de la", "от", "from"),
  assistant: L("Asistent TBS · online", "Ассистент TBS · онлайн", "TBS assistant · online"),
  submit: L("Trimite cererea", "Отправить заявку", "Send the request"),
  sending: L("Se trimite…", "Отправляется…", "Sending…"),
  // Was "Cerere pregătită ✓" / "Request ready ✓" while the form sent nothing at all —
  // wording that described the local state rather than a delivered request.
  submitted: L("Cerere trimisă ✓", "Заявка отправлена ✓", "Request sent ✓"),
};

const SENT_COPY = L(
  "Am primit cererea. Revenim în cel mult o zi lucrătoare.",
  "Мы получили заявку. Ответим в течение одного рабочего дня.",
  "We received your request. We'll get back to you within one business day.",
);

const ERRORS = {
  network: L(
    "Nu am putut contacta serverul. Verifică conexiunea și încearcă din nou.",
    "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.",
    "We couldn't reach the server. Check your connection and try again.",
  ),
  rate: L(
    "Prea multe cereri trimise. Încearcă din nou peste un minut.",
    "Слишком много заявок. Попробуйте через минуту.",
    "Too many requests. Please try again in a minute.",
  ),
  generic: L(
    "Cererea nu a putut fi trimisă. Încearcă din nou sau scrie-ne pe email.",
    "Заявку не удалось отправить. Попробуйте снова или напишите нам на почту.",
    "The request couldn't be sent. Try again or email us.",
  ),
};

/* Field names, as they appear inside a validation message ("Numele este obligatoriu."). */
const FIELD_LABELS = {
  name: L("Numele", "Имя", "The name"),
  email: L("Emailul", "Email", "The email"),
  phone: L("Telefonul", "Телефон", "The phone"),
};

/* Labels for the transcript that travels with the request — the assistant literally
   promises "am adăugat conversația în cerere", so it has to actually be in there. */
const TRANSCRIPT = {
  options: L("Opțiuni alese", "Выбранные опции", "Chosen options"),
  dialog: L("Dialog", "Диалог", "Dialog"),
  you: L("Client", "Клиент", "Client"),
  bot: L("Asistent", "Ассистент", "Assistant"),
  none: L("fără", "нет", "none"),
};

/* The structured summary — shown in the UI at the end of the dialog and sent verbatim
   at the top of the request, so the reader gets the conclusion before the raw log. */
const SUMMARY = {
  title: L("Rezumatul cererii", "Итог заявки", "Request summary"),
  intro: L(
    "Asta am înțeles din dialog. Rezumatul pleacă împreună cu cererea.",
    "Вот что я понял из диалога. Итог отправляется вместе с заявкой.",
    "This is what I understood from the dialog. The summary is sent with the request.",
  ),
  type: L("Tip proiect", "Тип проекта", "Project type"),
  estimate: L("Estimare", "Оценка", "Estimate"),
  described: L("Ce ai descris", "Что вы описали", "What you described"),
  clarifications: L("Clarificări", "Уточнения", "Clarifications"),
  details: L("Detalii suplimentare", "Дополнительные детали", "Additional details"),
};

/* Where the request was started from. Not shown to the visitor — it is routing information
   for whoever reads the lead: which service page or project card the CTA sat on, and which
   CTA it was. It travels inside the message because that is the only free-text field the
   API takes (see `buildMessage`). */
const ORIGIN = {
  title: L("Contextul cererii", "Контекст заявки", "Request context"),
  service: L("Serviciu", "Услуга", "Service"),
  project: L("Proiect", "Проект", "Project"),
  source: L("Sursă (CTA)", "Источник (CTA)", "Source (CTA)"),
};

/* Copy for the free-text composer in the chat — the visitor can always answer in their
   own words instead of picking one of the quick replies. */
const CHAT = {
  inputLabel: L("Scrie asistentului", "Напишите ассистенту", "Write to the assistant"),
  placeholder: L(
    "Scrie în cuvintele tale…",
    "Опишите своими словами…",
    "Describe it in your own words…",
  ),
  send: L("Trimite răspunsul", "Отправить ответ", "Send answer"),
  skip: L("Sari peste", "Пропустить", "Skip"),
  skipped: L(
    "Fără detalii suplimentare",
    "Без дополнительных деталей",
    "No additional details",
  ),
  /* Field name used inside a validation message ("Mesajul conține … nepermis."). */
  field: L("Mesajul", "Сообщение", "The message"),
};

/** Longest free-text turn accepted in the chat (the whole message is capped at 5000). */
const CHAT_MAX = 1000;

type PType = { id: string; label: LocalizedText; price: string };
const PROJECT_TYPES: PType[] = [
  { id: "site", label: L("Site / prezentare", "Сайт / презентация", "Website / landing"), price: "€3.000" },
  { id: "crm", label: L("CRM la comandă", "CRM под заказ", "Custom CRM"), price: "€8.000" },
  { id: "automation", label: L("Automatizare cu AI", "Автоматизация с ИИ", "AI automation"), price: "€5.000" },
  { id: "ecommerce", label: L("E-commerce", "E-commerce", "E-commerce"), price: "€6.000" },
  { id: "mobile", label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), price: "€12.000" },
];

/**
 * Estimator type -> the service whose price the admin edits.
 *
 * The prices below are a FALLBACK only. What the visitor sees comes from the admin
 * (`useSiteContent().services`), because the two were drifting badly: the estimator showed
 * "€3.000" for a site while the owner had it priced at 150€ in the panel, and the panel's
 * numbers were rendered nowhere at all — `Services` is not on any page. A price the owner
 * cannot change is a price that goes stale.
 *
 * The estimator has five types and the catalogue has eleven services, so the pairing is
 * written out rather than guessed: `ecommerce` is the `shop` service, the rest share a name.
 */
const SERVICE_FOR_TYPE: Record<string, string> = {
  site: "site",
  crm: "crm",
  automation: "automation",
  ecommerce: "shop",
  mobile: "mobile",
};

const OPTIONS: LocalizedText[] = [
  L("+ Design premium", "+ Премиум-дизайн", "+ Premium design"),
  L("+ Integrări & API", "+ Интеграции и API", "+ Integrations & API"),
  L("+ Multilingv", "+ Мультиязычность", "+ Multilingual"),
  L("+ SEO", "+ SEO", "+ SEO"),
];

const RESULT_COPY = L(
  "Include direcție UX, design și o discuție tehnică despre integrări.",
  "Включает UX-направление, дизайн и техническое обсуждение интеграций.",
  "Includes UX direction, design and a technical discussion about integrations.",
);

const PLACEHOLDERS = {
  name: L("Nume și companie", "Имя и компания", "Name and company"),
  email: L("Email", "Email", "Email"),
  phone: L("Telefon (opțional)", "Телефон (необязательно)", "Phone (optional)"),
  details: L("Adaugă orice detaliu important", "Добавьте любую важную деталь", "Add any important detail"),
};

/* ---------- stepped layout, used inside the request dialog ----------
   The home-page section shows everything at once on two columns, which is right at page
   width and cramped inside a 960px modal. In a dialog the same flow runs on ONE column,
   one step at a time: the project, then what it should contain, then the visitor's
   details. The assistant is not part of that path — it is opened on request. */

type StepId = "project" | "options" | "contact";

const STEPS: {
  id: StepId;
  /** Short name in the progress indicator — it has to fit three-across on a phone. */
  label: LocalizedText;
  /** The step's own heading. */
  title: LocalizedText;
  /** One line saying what to do here. */
  hint: LocalizedText;
}[] = [
  {
    id: "project",
    label: L("Proiectul", "Проект", "Project"),
    title: L("Ce construim?", "Что строим?", "What are we building?"),
    hint: L(
      "Alege tipul de proiect. Prețul de pornire se schimbă odată cu el.",
      "Выберите тип проекта. Стартовая цена меняется вместе с ним.",
      "Pick the project type. The starting price follows it.",
    ),
  },
  {
    id: "options",
    label: L("Ce conține", "Что включить", "Contents"),
    title: L("Ce să conțină?", "Что включить?", "What should it include?"),
    hint: L(
      "Bifează ce contează pentru tine. Poți alege mai multe sau niciuna.",
      "Отметьте, что важно. Можно выбрать несколько или ничего.",
      "Tick whatever matters to you. Pick several, or none.",
    ),
  },
  {
    id: "contact",
    label: L("Datele tale", "Ваши данные", "Your details"),
    title: L("Datele tale", "Ваши данные", "Your details"),
    hint: L(
      "Îți răspundem în cel mult o zi lucrătoare.",
      "Отвечаем в течение одного рабочего дня.",
      "We reply within one business day.",
    ),
  },
];

const NAV = {
  back: L("Înapoi", "Назад", "Back"),
  next: L("Continuă", "Продолжить", "Continue"),
  /** Accessible name of the progress list itself. */
  steps: L("Pașii cererii", "Шаги заявки", "Request steps"),
};

/**
 * Where you are and how much is left — both, in one line, because a bare "2/3" answers
 * only the first half.
 */
const stepHint = (index: number): LocalizedText => {
  const n = index + 1;
  const total = STEPS.length;
  const left = total - n;
  if (left === 0) {
    return L(
      `Pasul ${n} din ${total} · ultimul pas`,
      `Шаг ${n} из ${total} · последний шаг`,
      `Step ${n} of ${total} · last step`,
    );
  }
  return L(
    `Pasul ${n} din ${total} · ${left === 1 ? "a mai rămas 1 pas" : `au mai rămas ${left} pași`}`,
    `Шаг ${n} из ${total} · ${left === 1 ? "остался 1 шаг" : `осталось ${left} шага`}`,
    `Step ${n} of ${total} · ${left === 1 ? "1 step left" : `${left} steps left`}`,
  );
};

/**
 * The two ways through the flow, said plainly.
 *
 * Both are real paths through the same form, and neither is sold as better: one is for a
 * visitor who already knows what they want, the other for one who does not. Nothing here
 * promises anything the flow does not actually do — the fast path really is three steps,
 * and the assistant really does write the summary that travels with the request.
 */
const PATHS = {
  title: L(
    "Două feluri de a ajunge la o cerere",
    "Два способа дойти до заявки",
    "Two ways to get to a request",
  ),
  fastTitle: L("Rapid", "Быстро", "Fast"),
  fastCopy: L(
    "Știi ce vrei: alegi proiectul, bifezi ce conține, completezi datele. Trei pași, nicio întrebare în plus.",
    "Вы знаете, что нужно: выбираете проект, отмечаете содержимое, заполняете данные. Три шага, без лишних вопросов.",
    "You know what you want: pick the project, tick the contents, fill in your details. Three steps, no extra questions.",
  ),
  guidedTitle: L("Ghidat", "С ассистентом", "Guided"),
  guidedCopy: L(
    "Nu ești sigur ce să ceri: asistentul pune câteva întrebări scurte și scrie rezumatul cererii. Poți trimite oricând, fără să-l termini.",
    "Не уверены, что просить: ассистент задаёт несколько коротких вопросов и пишет итог заявки. Отправить можно в любой момент, не завершая диалог.",
    "You're not sure what to ask for: the assistant asks a few short questions and writes the request summary. You can send at any point, without finishing it.",
  ),
  open: L("Deschide asistentul", "Открыть ассистента", "Open the assistant"),
  close: L("Închide asistentul", "Закрыть ассистента", "Close the assistant"),
  /* Shown once the assistant has recorded something, so closing it never looks like
     throwing that work away — the summary is state, not markup. */
  kept: L(
    "Asistentul a notat răspunsurile tale. Pleacă cu cererea, chiar dacă închizi chatul.",
    "Ассистент записал ваши ответы. Они уйдут вместе с заявкой, даже если вы закроете чат.",
    "The assistant recorded your answers. They travel with the request, even if you close the chat.",
  ),
};

/* ---------- chat assistant tree ---------- */
type Opt = { label: LocalizedText; next: string };
type Node = {
  q: LocalizedText;
  /** Quick replies. Always present — clicking one is the fastest path through the tree. */
  options: Opt[];
  /** Where a freely typed answer at this step leads (quick replies carry their own). */
  freeNext: string;
  /** Placeholder for the composer at this step, when a generic prompt is too vague. */
  hint?: LocalizedText;
  /** The step can be left unanswered — it renders a "skip" control. */
  optional?: boolean;
};

const TREE: Record<string, Node> = {
  start: {
    q: L(
      "Bună! Care este obiectivul principal al proiectului tău?",
      "Привет! Какая главная цель вашего проекта?",
      "Hi! What is the main goal of your project?",
    ),
    options: [
      { label: L("Mai mulți clienți", "Больше клиентов", "More clients"), next: "growth" },
      { label: L("Mai puțină rutină", "Меньше рутины", "Less routine"), next: "automation" },
      { label: L("Un produs nou", "Новый продукт", "A new product"), next: "product" },
    ],
    /* A visitor who describes the goal in their own words has already answered the
       branch questions below, so their free answer skips straight to the planning half. */
    freeNext: "timeline",
    hint: L(
      "Ex.: vrem un site nou, cu formular și blog.",
      "Напр.: нужен новый сайт с формой и блогом.",
      "E.g.: we want a new site with a form and a blog.",
    ),
  },
  growth: {
    q: L(
      "Unde se pierd cel mai des potențialii clienți?",
      "Где чаще всего теряются потенциальные клиенты?",
      "Where do potential clients get lost most often?",
    ),
    options: [
      { label: L("Nu ne găsesc online", "Нас не находят онлайн", "They don't find us online"), next: "channel" },
      { label: L("Site-ul nu convinge", "Сайт не убеждает", "The site doesn't convince"), next: "channel" },
      { label: L("Nu urmărim lead-urile", "Не отслеживаем лиды", "We don't track leads"), next: "channel" },
    ],
    freeNext: "channel",
  },
  channel: {
    q: L(
      "Ce canal vrei să îmbunătățim mai întâi?",
      "Какой канал улучшаем первым?",
      "Which channel should we improve first?",
    ),
    options: [
      { label: L("Site / landing page", "Сайт / лендинг", "Site / landing page"), next: "timeline" },
      { label: L("Google sau SEO", "Google или SEO", "Google or SEO"), next: "timeline" },
      { label: L("Social media / campanii", "Соцсети / кампании", "Social media / campaigns"), next: "timeline" },
    ],
    freeNext: "timeline",
  },
  automation: {
    q: L(
      "Ce activitate consumă acum cel mai mult timp?",
      "Что сейчас отнимает больше всего времени?",
      "Which activity consumes the most time now?",
    ),
    options: [
      { label: L("Documente și aprobări", "Документы и согласования", "Documents and approvals"), next: "systems" },
      { label: L("Lead-uri și vânzări", "Лиды и продажи", "Leads and sales"), next: "systems" },
      { label: L("Rapoarte și date", "Отчёты и данные", "Reports and data"), next: "systems" },
    ],
    freeNext: "systems",
  },
  systems: {
    q: L(
      "Cu ce trebuie să se conecteze soluția?",
      "С чем должно соединяться решение?",
      "What should the solution connect to?",
    ),
    options: [
      { label: L("CRM sau ERP", "CRM или ERP", "CRM or ERP"), next: "timeline" },
      { label: L("Facturare / plăți", "Счета / платежи", "Invoicing / payments"), next: "timeline" },
      { label: L("Fișiere și e-mail", "Файлы и e-mail", "Files and e-mail"), next: "timeline" },
      { label: L("Nu știm încă", "Пока не знаем", "Not sure yet"), next: "timeline" },
    ],
    freeNext: "timeline",
  },
  product: {
    q: L(
      "Cine va folosi cel mai des produsul?",
      "Кто будет чаще всего пользоваться продуктом?",
      "Who will use the product most often?",
    ),
    options: [
      { label: L("Clienții noștri", "Наши клиенты", "Our clients"), next: "shape" },
      { label: L("Echipa internă", "Внутренняя команда", "The internal team"), next: "shape" },
      { label: L("O piață nouă", "Новый рынок", "A new market"), next: "shape" },
    ],
    freeNext: "shape",
  },
  shape: {
    q: L(
      "Ce formă ți se potrivește mai bine?",
      "Какая форма подходит лучше?",
      "Which shape fits you best?",
    ),
    options: [
      { label: L("Platformă web", "Веб-платформа", "Web platform"), next: "timeline" },
      { label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), next: "timeline" },
      { label: L("SaaS cu abonament", "SaaS по подписке", "Subscription SaaS"), next: "timeline" },
    ],
    freeNext: "timeline",
  },
  timeline: {
    q: L(
      "Când vrei să înceapă proiectul?",
      "Когда хотите начать проект?",
      "When do you want the project to start?",
    ),
    options: [
      { label: L("În următoarele 3 săptămâni", "В ближайшие 3 недели", "In the next 3 weeks"), next: "budget" },
      { label: L("În 1–2 luni", "Через 1–2 месяца", "In 1–2 months"), next: "budget" },
      { label: L("După validare internă", "После внутренней проверки", "After internal validation"), next: "budget" },
    ],
    freeNext: "budget",
  },
  budget: {
    q: L(
      "Ce nivel de investiție ai în vedere?",
      "Какой уровень инвестиций рассматриваете?",
      "What investment level do you have in mind?",
    ),
    options: [
      { label: L("Sub €5.000", "До €5.000", "Under €5.000"), next: "brief" },
      { label: L("€5.000–€15.000", "€5.000–€15.000", "€5.000–€15.000"), next: "brief" },
      { label: L("Peste €15.000", "Более €15.000", "Over €15.000"), next: "brief" },
      { label: L("Vreau recomandarea TBS", "Хочу рекомендацию TBS", "I want TBS's recommendation"), next: "brief" },
    ],
    freeNext: "brief",
  },
  /* The free-description step: quick replies stay, but the point of this node is the
     composer under it — the visitor tells us the project in their own words. */
  brief: {
    q: L(
      "Descrie în cuvintele tale ce vrei să construim. Poți scrie liber sau alege o variantă rapidă.",
      "Опишите своими словами, что хотите построить. Можно написать свободно или выбрать быстрый вариант.",
      "Describe in your own words what you want us to build. Write freely, or pick a quick reply.",
    ),
    options: [
      { label: L("Am deja un caiet de sarcini", "У нас уже есть ТЗ", "We already have a brief"), next: "clarify" },
      { label: L("Am o idee, nu un plan", "Есть идея, но не план", "I have an idea, not a plan"), next: "clarify" },
      { label: L("Refacem ceva existent", "Переделываем существующее", "We're rebuilding something"), next: "clarify" },
    ],
    freeNext: "clarify",
    hint: L(
      "Scrie liber: ce faci, cine sunt clienții, ce te blochează acum.",
      "Пишите свободно: чем занимаетесь, кто клиенты, что мешает сейчас.",
      "Write freely: what you do, who your clients are, what blocks you now.",
    ),
  },
  /* The clarification round. Its question is chosen by project type (see CLARIFY_Q), so
     it follows what the visitor just described instead of asking the same thing of everyone. */
  clarify: {
    q: L(
      "Ca să înțeleg mai bine: de unde pornim?",
      "Чтобы понять точнее: с чего начинаем?",
      "So I understand better: where do we start from?",
    ),
    options: [
      { label: L("Pornim de la zero", "Начинаем с нуля", "We start from scratch"), next: "extra" },
      { label: L("Există ceva, dar trebuie refăcut", "Что-то есть, но надо переделать", "Something exists, but needs a rebuild"), next: "extra" },
      { label: L("Extindem un sistem existent", "Расширяем существующую систему", "We extend an existing system"), next: "extra" },
    ],
    freeNext: "extra",
    hint: L(
      "Răspunde liber, dacă niciuna dintre variante nu se potrivește.",
      "Ответьте свободно, если ни один вариант не подходит.",
      "Answer freely if none of the options fits.",
    ),
  },
  /* Optional, never blocking: anything else worth knowing before the estimate. */
  extra: {
    q: L(
      "Mai vrei să adaugi ceva — buget, termen, ce există deja? Pasul e opțional.",
      "Хотите что-то добавить — бюджет, сроки, что уже есть? Шаг необязательный.",
      "Anything else to add — budget, deadline, what already exists? This step is optional.",
    ),
    options: [
      { label: L("Termenul e urgent", "Сроки срочные", "The deadline is urgent"), next: "finish" },
      { label: L("Bugetul e flexibil", "Бюджет гибкий", "The budget is flexible"), next: "finish" },
      { label: L("Avem deja o echipă tehnică", "У нас уже есть техкоманда", "We already have a tech team"), next: "finish" },
    ],
    freeNext: "finish",
    optional: true,
    hint: L(
      "Ex.: buget aproximativ, deadline, ce sisteme folosiți deja.",
      "Напр.: примерный бюджет, дедлайн, какие системы уже используете.",
      "E.g.: rough budget, deadline, systems you already use.",
    ),
  },
};

/**
 * The clarification question, per project type — a CRM and a landing page do not need the
 * same follow-up, and a generic "tell me more" reads like a form, not like a conversation.
 */
const CLARIFY_Q: Record<string, LocalizedText> = {
  site: L(
    "Ca să înțeleg mai bine: ce trebuie să facă vizitatorul pe site și ce conținut ai deja?",
    "Чтобы понять точнее: что посетитель должен сделать на сайте и какой контент уже есть?",
    "So I understand better: what should a visitor do on the site, and what content do you already have?",
  ),
  crm: L(
    "Ca să înțeleg mai bine: ce procese intră în CRM și cine îl va folosi zilnic?",
    "Чтобы понять точнее: какие процессы войдут в CRM и кто будет пользоваться им ежедневно?",
    "So I understand better: which processes go into the CRM, and who will use it daily?",
  ),
  automation: L(
    "Ca să înțeleg mai bine: ce pas repetitiv automatizăm primul și ce date folosește?",
    "Чтобы понять точнее: какой рутинный шаг автоматизируем первым и какие данные он использует?",
    "So I understand better: which repetitive step do we automate first, and what data does it use?",
  ),
  ecommerce: L(
    "Ca să înțeleg mai bine: câte produse ai și cum vrei să încasezi plățile?",
    "Чтобы понять точнее: сколько у вас товаров и как хотите принимать платежи?",
    "So I understand better: how many products do you have, and how do you want to take payments?",
  ),
  mobile: L(
    "Ca să înțeleg mai bine: pe ce platforme și ce face aplicația în primul minut?",
    "Чтобы понять точнее: на каких платформах и что приложение делает в первую минуту?",
    "So I understand better: on which platforms, and what does the app do in the first minute?",
  ),
};

const FINISH = L(
  "Mulțumesc! Mai jos e rezumatul a ceea ce am înțeles — pleacă odată cu cererea. Completează datele de contact pentru a o trimite.",
  "Спасибо! Ниже — итог того, что я понял; он уходит вместе с заявкой. Заполните контакты, чтобы отправить её.",
  "Thank you! Below is a summary of what I understood — it travels with the request. Fill in your contacts to send it.",
);

type Bubble = { id: number; text: string; user: boolean };

/** One answered step: the question as it was asked, and what the visitor replied. */
type Turn = { question: string; answer: string; free: boolean };

/** A labelled line of the summary, rendered in the UI and serialized into the message. */
type Row = { label: string; value: string };

/**
 * Slot for the dictation button another component owns. It receives the id of the field
 * it dictates into and a callback that appends the recognized text to that field, so the
 * microphone never has to reach into this component's state.
 */
export type DictationSlot = (props: {
  targetId: string;
  onTranscript: (text: string) => void;
}) => ReactNode;

export type EstimatorProps = {
  /**
   * Where the request was started from (`lib/request/RequestFlowProvider.tsx`).
   *
   * `context.serviceSlug` preselects a project type directly, for when the estimator is
   * opened somewhere the URL cannot say which service it is — the shared request dialog,
   * opened from a service page. It wins over `?serviciu=`, because a dialog opened from a
   * page's own CTA is a stronger statement of intent than whatever the address bar happens
   * to carry. The project fields and `source` are not shown to the visitor; they are folded
   * into the sent message so the team can see where the lead came from.
   *
   * Absent on the home page: that estimator is the section itself, not a dialog opened
   * from a CTA, and it reads `?serviciu=` exactly as it always has.
   */
  context?: RequestContext;
  /**
   * How the same flow is laid out.
   *
   * `"section"` (the default) is the home page's `#estimare` block, unchanged: heading,
   * two columns, the assistant always on screen. `"dialog"` is the variant the shared
   * request modal uses — one column, three steps, and the assistant behind a button.
   * Only the arrangement differs; the state, the validation and the submitted payload
   * are the same code in both.
   */
  layout?: "section" | "dialog";
  /** Rendered next to the chat composer (`data-dictation-slot="estimator-chat"`). */
  renderChatDictation?: DictationSlot;
  /** Rendered next to the details field (`data-dictation-slot="estimator-details"`). */
  renderDetailsDictation?: DictationSlot;
};

/** Append dictated text to a field's current value, keeping a single space between them. */
const appendText = (current: string, added: string): string =>
  current.trim() ? `${current.trim()} ${added.trim()}` : added.trim();

/** Marks a block the 5000-char cap cut short, so the reader knows text is missing. */
const TRUNCATED = "\n[…]";

/** Cut `text` to `max` characters, leaving a visible mark when something was dropped. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - TRUNCATED.length)).trimEnd()}${TRUNCATED}`;
}

/**
 * Which type a visitor arriving from a service page should land on.
 *
 * The service pages link here as `/?serviciu=<slug>#estimare`, so the choice survives the
 * navigation, a refresh and a shared link — a CustomEvent would not. Read through
 * `useSearchParams` rather than `window.location` so the server and the first client
 * render agree and hydration stays quiet.
 */
function useServiceTypeIndex(override?: string): number {
  const params = useSearchParams();
  const slug = override ?? params.get(SERVICE_QUERY_KEY);
  if (!slug) return 0;
  const wanted = SERVICE_TO_ESTIMATOR_TYPE[slug];
  const found = PROJECT_TYPES.findIndex((t) => t.id === wanted);
  return found >= 0 ? found : 0;
}

export function Estimator({
  context,
  layout = "section",
  renderChatDictation,
  renderDetailsDictation,
}: EstimatorProps = {}) {
  const { serviceSlug, projectId, projectName, source } = context ?? {};
  const isDialog = layout === "dialog";
  const l = useLoc();
  const t = useT();
  /* Prices are the owner's, edited in the admin — see SERVICE_FOR_TYPE. */
  const { services } = useSiteContent();
  /* `useT` is keyed by MessageKey; validateText takes a looser (key: string) => string.
     Wrapping keeps the catalog's typed keys everywhere except this one boundary. */
  const tr = (key: string) => t(key as Parameters<typeof t>[0]);
  const [typeIndex, setTypeIndex] = useState(useServiceTypeIndex(serviceSlug));
  const [opts, setOpts] = useState<Set<number>>(new Set([1]));
  const [node, setNode] = useState("start");
  const [log, setLog] = useState<Bubble[]>([]);
  const [uid, setUid] = useState(1);
  /* Structured record of the dialog — the bubbles are for reading, these are for the
     summary, which needs the question each answer belongs to. */
  const [turns, setTurns] = useState<Turn[]>([]);
  /* What the visitor is currently typing into the chat, and the step to return to after
     the clarification round that a free answer triggers. */
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [clarified, setClarified] = useState(false);

  /* The form is controlled so the request payload can carry what the visitor actually
     picked — the project type, the estimate and the dialog — not just the four inputs. */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<LocalizedText | null>(null);
  /* Per-field messages from lib/validation — the same rules the backend enforces, so a
     visitor is told what's wrong before a round trip rather than after a 422. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const sent = status === "sent";

  /* ---- stepped layout state (dialog only; the section shows everything at once) ----
     Both live here, above the step panels, so going back never loses a chip, a typed
     field or a line of the dialog: the panels are views over this state, not owners of it. */
  const [stepIndex, setStepIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const chatToggleRef = useRef<HTMLButtonElement>(null);
  const mountedRef = useRef(false);
  const chatWasOpen = useRef(false);

  /* Moving between steps swaps the whole panel, so focus has to follow it — otherwise a
     keyboard visitor presses "Continuă" and their next Tab starts from the button they
     just left, below content they never saw. Skipped on mount: the dialog does its own
     initial focus, and stealing it would fight the modal. */
  useEffect(() => {
    if (!isDialog) return;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [stepIndex, isDialog]);

  /* Opening the assistant moves focus into it; closing it hands focus back to the button
     that closed it, which is the only control still on screen that means "the assistant". */
  useEffect(() => {
    if (!isDialog) return;
    if (chatOpen) {
      chatPanelRef.current?.focus();
      chatWasOpen.current = true;
    } else if (chatWasOpen.current) {
      chatToggleRef.current?.focus();
      chatWasOpen.current = false;
    }
  }, [chatOpen, isDialog]);

  /* The admin's price already reads "de la 150€" / "от 150€" / "from 150€", so it is shown
     as written. Only the built-in fallback needs the "de la" prefix glued on. A service that
     is missing, or still on the "..." placeholder, falls back rather than showing "...". */
  const adminPrice = services.find(
    (sv) => sv.id === SERVICE_FOR_TYPE[PROJECT_TYPES[typeIndex].id],
  )?.price;
  const adminPriceText = adminPrice ? l(adminPrice).trim() : "";
  const priceIsReal = adminPriceText !== "" && !adminPriceText.startsWith("...");
  const price = priceIsReal
    ? adminPriceText
    : `${l(SECTION.from)} ${PROJECT_TYPES[typeIndex].price}`;

  const done = node === "finish";
  const current = done ? null : TREE[node];

  /** The question a step asks. Clarification adapts to the selected project type. */
  const questionOf = (id: string): LocalizedText =>
    id === "clarify" ? (CLARIFY_Q[PROJECT_TYPES[typeIndex].id] ?? TREE.clarify.q) : TREE[id].q;

  const toggleOpt = (i: number) =>
    setOpts((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(i)) nextSet.delete(i);
      else nextSet.add(i);
      return nextSet;
    });

  /**
   * Record one answer and move on.
   *
   * `target` is where the answered step points. Two rules bend that path:
   *
   * - a freely typed answer is followed by a clarification round (once per dialog), and
   *   the step it would have gone to is remembered in `resume`;
   * - answering the clarification returns to that remembered step, so writing freely
   *   early in the dialog costs the visitor nothing.
   */
  const record = (text: string, free: boolean, target: string) => {
    const asked = l(questionOf(node));
    let dest = target;
    let nextResume = resume;
    if (node === "clarify") {
      dest = resume ?? target;
      nextResume = null;
    } else if (free && !clarified && dest !== "clarify") {
      nextResume = dest;
      dest = "clarify";
    }
    if (dest === "clarify") setClarified(true);

    const reply = dest === "finish" ? l(FINISH) : l(questionOf(dest));
    setLog((prev) => [
      ...prev,
      { id: uid, text, user: true },
      { id: uid + 1, text: reply, user: false },
    ]);
    setUid(uid + 2);
    setTurns((prev) => [...prev, { question: asked, answer: text, free }]);
    setResume(nextResume);
    setNode(dest);
  };

  const pick = (opt: Opt) => {
    if (done) return;
    record(l(opt.label), false, opt.next);
  };

  /** The visitor answered in their own words rather than picking a quick reply. */
  const sendDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const value = draft.trim();
    if (!value) return;
    // Same rules the contact field uses — a free turn ends up inside the sent message,
    // so markup and over-long input are refused here, not discovered by the API.
    const err = validateText(
      value,
      { label: l(CHAT.field), max: CHAT_MAX, required: true },
      tr,
    );
    if (err) {
      setDraftError(err);
      return;
    }
    setDraft("");
    setDraftError(null);
    record(value, true, current.freeNext);
  };

  /** Enter sends, Shift+Enter keeps writing — the usual chat contract. */
  const onDraftKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendDraft(e as unknown as FormEvent);
    }
  };

  /** The optional step is genuinely optional: skipping it still closes the dialog. */
  const skipStep = () => {
    if (!current?.optional) return;
    record(l(CHAT.skipped), false, "finish");
  };

  /**
   * What the assistant understood, as labelled lines. Rendered in the UI at the end of
   * the dialog and serialized into the message — one source, so they cannot disagree.
   */
  const summaryRows = (): Row[] => {
    const chosen = [...opts].sort((a, b) => a - b).map((i) => l(OPTIONS[i]));
    const described = turns.filter((t) => t.free).map((t) => t.answer);
    const rows: Row[] = [
      { label: l(SUMMARY.type), value: l(PROJECT_TYPES[typeIndex].label) },
      { label: l(SUMMARY.estimate), value: price },
      {
        label: l(TRANSCRIPT.options),
        value: chosen.length ? chosen.join(", ") : l(TRANSCRIPT.none),
      },
    ];
    if (described.length) {
      rows.push({ label: l(SUMMARY.described), value: described.join(" · ") });
    }
    if (turns.length) {
      rows.push({
        label: l(SUMMARY.clarifications),
        value: turns.map((t) => `${t.question} → ${t.answer}`).join("\n"),
      });
    }
    const extra = details.trim();
    if (extra) rows.push({ label: l(SUMMARY.details), value: extra });
    return rows;
  };

  /**
   * Where this request came from, as a short labelled block — or "" when the estimator is
   * the plain home-page section and there is nothing to say.
   *
   * Deliberately not part of `summaryRows()`: those rows are shown to the visitor, and
   * "Sursă (CTA): hero" is information for us, not for them. The values are the raw ids
   * (slug, project id, CTA id) so they stay greppable rather than translated.
   */
  const originBlock = (): string => {
    const rows: string[] = [];
    if (serviceSlug) rows.push(`- ${l(ORIGIN.service)}: ${serviceSlug}`);
    if (projectName || projectId) {
      const named =
        projectName && projectId ? `${projectName} (${projectId})` : projectName || projectId;
      rows.push(`- ${l(ORIGIN.project)}: ${named}`);
    }
    if (source) rows.push(`- ${l(ORIGIN.source)}: ${source}`);
    if (rows.length === 0) return "";
    return [`${l(ORIGIN.title).toUpperCase()}:`, ...rows].join("\n");
  };

  /**
   * Everything the visitor chose, folded into the one free-text field the API takes:
   * the structured summary first, then where the request came from, then the raw transcript.
   *
   * The API caps `message` at 5000 characters, so the budget is spent in that order —
   * the summary is what a human reads first, and only the leftover room goes to the
   * transcript. Both are cut with a visible marker rather than left to 422. The origin
   * block's room is *reserved* before the summary is clamped: it is a couple of lines, and
   * it is the part that routes the lead, so it must never be the thing the cap eats.
   */
  const buildMessage = (): string => {
    const summary = [
      l(SUMMARY.title).toUpperCase(),
      ...summaryRows().map((r) => `- ${r.label}: ${r.value.replace(/\n/g, "\n  ")}`),
    ].join("\n");
    const origin = originBlock();
    const reserved = origin ? origin.length + 2 : 0; // the "\n\n" separator
    let message = clamp(summary, LIMITS.message - reserved);
    if (origin) message += `\n\n${origin}`;

    const transcript = log.length
      ? `${l(TRANSCRIPT.dialog)}:\n${log
          .map((b) => `${b.user ? l(TRANSCRIPT.you) : l(TRANSCRIPT.bot)}: ${b.text}`)
          .join("\n")}`
      : "";
    const room = LIMITS.message - message.length - 2; // the "\n\n" separator
    // Below ~80 chars a transcript fragment is noise, not information — drop it instead.
    if (transcript && room > 80) message += `\n\n${clamp(transcript, room)}`;

    return message.slice(0, LIMITS.message);
  };

  /* Clear a field's message as soon as it's edited. Without this, "Numele este
     obligatoriu." stays under a field the visitor has just filled in, until the next
     submit — which reads as if the form were still refusing the value. */
  const editField =
    (key: "name" | "email" | "phone", set: (v: string) => void) => (value: string) => {
      set(value);
      setFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  /** Client-side half of the defense-in-depth pair; the API re-validates everything. */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const nameErr = validateText(
      name,
      { label: l(FIELD_LABELS.name), max: LIMITS.name, required: true },
      tr,
    );
    if (nameErr) next.name = nameErr;
    const emailErr = validateText(
      email,
      { label: l(FIELD_LABELS.email), max: LIMITS.email, required: true, email: true },
      tr,
    );
    if (emailErr) next.email = emailErr;
    // Phone is optional — validateText passes an empty value straight through.
    const phoneErr = validateText(
      phone,
      { label: l(FIELD_LABELS.phone), max: LIMITS.phone, phone: true },
      tr,
    );
    if (phoneErr) next.phone = phoneErr;
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return; // double-submit guard
    setError(null);
    if (!validate()) {
      setStatus("idle");
      return;
    }
    setStatus("sending");
    try {
      await submitContact({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: buildMessage(),
        project: l(PROJECT_TYPES[typeIndex].label),
        estimate: price,
      });
      setStatus("sent");
    } catch (err) {
      // 429 is the public endpoint's rate limit (10/min) — worth its own wording, so a
      // visitor who hit it knows to wait rather than assume the form is broken.
      const rateLimited = err instanceof ApiError && err.status === 429;
      setError(isNetworkError(err) ? ERRORS.network : rateLimited ? ERRORS.rate : ERRORS.generic);
      setStatus("error");
    }
  };

  /* ---------------------------------------------------------------------------------
     The pieces of the flow, built once and arranged differently by each layout. Two
     copies of the contact form would be two sets of validation rules waiting to drift.
     --------------------------------------------------------------------------------- */

  /* `marks` carries the step attributes when the caller has no wrapper of its own to put
     them on — the section arranges these blocks itself, the dialog wraps each in a step. */
  const projectChips = (marks?: Record<string, string>) => (
    <div className={styles.choices} {...marks}>
      {PROJECT_TYPES.map((p, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.choice} ${i === typeIndex ? styles.selected : ""}`}
          onClick={() => setTypeIndex(i)}
        >
          {l(p.label)}
        </button>
      ))}
    </div>
  );

  const optionChips = (marks?: Record<string, string>) => (
    <div className={styles.choices} {...marks}>
      {OPTIONS.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.choice} ${opts.has(i) ? styles.selected : ""}`}
          onClick={() => toggleOpt(i)}
        >
          {l(o)}
        </button>
      ))}
    </div>
  );

  /* The assistant's own contents — head, log, quick replies, composer, summary. The
     wrapper around it differs: a plain panel in the section, an on-request one in the
     dialog. Its state (`log`, `turns`, `node`) lives in the component, so closing the
     dialog's panel hides the conversation without forgetting a word of it. */
  const chatBody = (
    <>
      <div className={`mono ${styles.chatHead}`}>
        <span className={styles.chatDot} />
        {l(SECTION.assistant)}
      </div>
      <div className={styles.chatLog} aria-live="polite">
        <div className={styles.bubble}>{l(TREE.start.q)}</div>
        {log.map((b) => (
          <div key={b.id} className={`${styles.bubble} ${b.user ? styles.bubbleUser : ""}`}>
            {b.text}
          </div>
        ))}
      </div>
      {current && (
        <div className={styles.chatOptions}>
          {current.options.map((o, i) => (
            <button
              key={i}
              type="button"
              className={styles.chatOption}
              onClick={() => pick(o)}
            >
              {l(o.label)}
            </button>
          ))}
        </div>
      )}
      {/* The composer. Quick replies are the fast path; this is the one that lets a
          visitor describe the project in their own words. It is a form of its own —
          the contact form is never wrapped around this one. */}
      {current && (
        <form className={styles.compose} onSubmit={sendDraft}>
          <textarea
            id="estimator-chat-input"
            data-dictation-target="estimator-chat"
            className={styles.composeInput}
            aria-label={l(CHAT.inputLabel)}
            placeholder={l(current.hint ?? CHAT.placeholder)}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(null);
            }}
            onKeyDown={onDraftKey}
            maxLength={CHAT_MAX}
            aria-invalid={!!draftError}
            rows={2}
          />
          <div className={styles.composeActions}>
            {/* Mount point for the dictation button owned by another component: either
                pass `renderChatDictation`, or find this node by its
                `data-dictation-slot` attribute. */}
            <span className={styles.dictationSlot} data-dictation-slot="estimator-chat">
              {renderChatDictation?.({
                targetId: "estimator-chat-input",
                onTranscript: (text) => setDraft((prev) => appendText(prev, text)),
              })}
            </span>
            {current.optional && (
              <button type="button" className={styles.composeSkip} onClick={skipStep}>
                {l(CHAT.skip)}
              </button>
            )}
            <button type="submit" className={styles.composeSend} disabled={!draft.trim()}>
              {l(CHAT.send)}
            </button>
          </div>
          {draftError && (
            <p className={`${styles.formNote} ${styles.formError}`} role="alert">
              {draftError}
            </p>
          )}
        </form>
      )}
      {/* What the assistant understood — visible proof of the text that will be attached
          to the request, not a promise that it was. */}
      {done && (
        <div className={styles.summary} data-testid="estimator-summary" role="status">
          <div className={`mono ${styles.summaryHead}`}>{l(SUMMARY.title)}</div>
          <p className={styles.summaryIntro}>{l(SUMMARY.intro)}</p>
          <dl className={styles.summaryList}>
            {summaryRows().map((r) => (
              <div key={r.label} className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>{r.label}</dt>
                <dd className={styles.summaryValue}>{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );

  /* noValidate: the browser's own bubble would fire first and our localized,
     screen-reader-announced messages would never run. */
  const contactForm = (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <input
        aria-label={l(PLACEHOLDERS.name)}
        placeholder={l(PLACEHOLDERS.name)}
        value={name}
        onChange={(e) => editField("name", setName)(e.target.value)}
        maxLength={LIMITS.name}
        aria-invalid={!!fieldErrors.name}
        required
      />
      {fieldErrors.name && (
        <p className={`${styles.formNote} ${styles.formError}`} role="alert">
          {fieldErrors.name}
        </p>
      )}
      <input
        aria-label={l(PLACEHOLDERS.email)}
        type="email"
        placeholder={l(PLACEHOLDERS.email)}
        value={email}
        onChange={(e) => editField("email", setEmail)(e.target.value)}
        maxLength={LIMITS.email}
        aria-invalid={!!fieldErrors.email}
        required
      />
      {fieldErrors.email && (
        <p className={`${styles.formNote} ${styles.formError}`} role="alert">
          {fieldErrors.email}
        </p>
      )}
      <input
        aria-label={l(PLACEHOLDERS.phone)}
        type="tel"
        placeholder={l(PLACEHOLDERS.phone)}
        value={phone}
        onChange={(e) => editField("phone", setPhone)(e.target.value)}
        maxLength={LIMITS.phone}
        aria-invalid={!!fieldErrors.phone}
      />
      {fieldErrors.phone && (
        <p className={`${styles.formNote} ${styles.formError}`} role="alert">
          {fieldErrors.phone}
        </p>
      )}
      <div className={styles.detailsField}>
        <textarea
          id="estimator-details"
          data-dictation-target="estimator-details"
          aria-label={l(PLACEHOLDERS.details)}
          placeholder={l(PLACEHOLDERS.details)}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={4000}
          rows={3}
        />
        {/* Second dictation mount point — same contract as the chat one. */}
        <span className={styles.dictationSlot} data-dictation-slot="estimator-details">
          {renderDetailsDictation?.({
            targetId: "estimator-details",
            onTranscript: (text) => setDetails((prev) => appendText(prev, text)),
          })}
        </span>
      </div>
      <button
        type="submit"
        className={styles.submit}
        disabled={status === "sending" || sent}
      >
        {status === "sending"
          ? l(SECTION.sending)
          : sent
            ? l(SECTION.submitted)
            : l(SECTION.submit)}
      </button>
      {/* Both outcomes are announced, so a screen-reader user isn't left guessing
          whether the request actually went anywhere. */}
      {sent && (
        <p className={styles.formNote} role="status">
          {l(SENT_COPY)}
        </p>
      )}
      {error && (
        <p className={`${styles.formNote} ${styles.formError}`} role="alert">
          {l(error)}
        </p>
      )}
    </form>
  );

  /* ---------------------------------------------------------------------------------
     Dialog: one column, three steps, the assistant on request.
     --------------------------------------------------------------------------------- */
  if (isDialog) {
    const last = STEPS.length - 1;
    return (
      <div className={styles.flow} data-testid="request-flow" data-layout="dialog">
        <div className={styles.progressBlock}>
          <ol
            className={styles.progress}
            data-testid="request-steps"
            aria-label={l(NAV.steps)}
          >
            {STEPS.map((s, i) => (
              <li key={s.id} className={styles.progressItem}>
                {/* Every step is reachable at any moment: nothing here validates a gate,
                    so a visitor who wants to send straight away is one press away from
                    the contact fields. */}
                <button
                  type="button"
                  className={`${styles.progressStep} ${
                    i === stepIndex ? styles.progressCurrent : ""
                  } ${i < stepIndex ? styles.progressDone : ""}`}
                  aria-current={i === stepIndex ? "step" : undefined}
                  onClick={() => setStepIndex(i)}
                >
                  <span className={styles.progressNum}>{i + 1}</span>
                  <span className={styles.progressLabel}>{l(s.label)}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className={styles.progressHint} role="status">
            {l(stepHint(stepIndex))}
          </p>
        </div>

        {/* The price is the owner's, and it stays on screen through every step — it is
            what the visitor is being asked to react to. */}
        <div className={styles.proposal}>
          <span className={`mono ${styles.proposalLabel}`}>{l(SECTION.proposal)}</span>
          <span className={styles.proposalType}>{l(PROJECT_TYPES[typeIndex].label)}</span>
          <b className={`disp ${styles.proposalPrice}`}>{price}</b>
        </div>

        {STEPS.map((s, i) => (
          <section
            key={s.id}
            className={styles.step}
            data-step={s.id}
            {...(i === stepIndex ? { "data-active": "true" } : {})}
            aria-labelledby={`request-step-${s.id}`}
          >
            <h3
              id={`request-step-${s.id}`}
              className={styles.stepTitle}
              tabIndex={-1}
              ref={i === stepIndex ? stepHeadingRef : undefined}
            >
              {l(s.title)}
            </h3>
            <p className={styles.stepHint}>{l(s.hint)}</p>
            {s.id === "project" && (
              <>
                {projectChips()}
                <p className={styles.stepNote}>{l(RESULT_COPY)}</p>
              </>
            )}
            {s.id === "options" && optionChips()}
            {s.id === "contact" && contactForm}
          </section>
        ))}

        <div className={styles.stepNav}>
          <button
            type="button"
            className={styles.navBack}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
          >
            {l(NAV.back)}
          </button>
          {stepIndex < last && (
            <button
              type="button"
              className={styles.navNext}
              onClick={() => setStepIndex((i) => Math.min(last, i + 1))}
            >
              {l(NAV.next)}
            </button>
          )}
        </div>

        {/* The two paths, and the only control that starts the assistant. It sits after
            the steps because that is where it belongs in the flow: the request can be
            sent without ever opening it. */}
        <div className={styles.paths}>
          <div className={`mono ${styles.pathsTitle}`}>{l(PATHS.title)}</div>
          <div className={styles.pathList}>
            <div className={`${styles.path} ${chatOpen ? "" : styles.pathActive}`}>
              <b className={styles.pathName}>{l(PATHS.fastTitle)}</b>
              <p className={styles.pathCopy}>{l(PATHS.fastCopy)}</p>
            </div>
            <div className={`${styles.path} ${chatOpen ? styles.pathActive : ""}`}>
              <b className={styles.pathName}>{l(PATHS.guidedTitle)}</b>
              <p className={styles.pathCopy}>{l(PATHS.guidedCopy)}</p>
              <button
                ref={chatToggleRef}
                type="button"
                className={styles.pathButton}
                data-testid="chat-toggle"
                aria-expanded={chatOpen}
                aria-controls={chatOpen ? "request-assistant" : undefined}
                onClick={() => setChatOpen((open) => !open)}
              >
                {l(chatOpen ? PATHS.close : PATHS.open)}
              </button>
            </div>
          </div>
          {turns.length > 0 && <p className={styles.pathKept}>{l(PATHS.kept)}</p>}
        </div>

        {chatOpen && (
          <div
            id="request-assistant"
            ref={chatPanelRef}
            tabIndex={-1}
            role="group"
            aria-label={l(SECTION.assistant)}
            className={`${styles.chat} ${styles.chatPanel}`}
            data-testid="chat-panel"
          >
            {chatBody}
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------------------------
     Section: the home page's `#estimare`, unchanged.
     --------------------------------------------------------------------------------- */
  return (
    <section id="estimare" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        <div className={styles.box} data-testid="request-flow" data-layout="section">
          <div className={styles.steps}>
            <div>
              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.step1)}</div>
              {projectChips({ "data-step": "project", "data-active": "true" })}

              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.step2)}</div>
              {optionChips({ "data-step": "options", "data-active": "true" })}

              <div className={styles.chat}>{chatBody}</div>
            </div>

            <aside className={styles.result} data-step="contact" data-active="true">
              <div className={`mono ${styles.stepLabel}`}>{l(SECTION.proposal)}</div>
              <b className={`disp ${styles.price}`}>{price}</b>
              <p className={styles.resultCopy}>{l(RESULT_COPY)}</p>
              {contactForm}
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
