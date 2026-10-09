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
import { format } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LanguageProvider";
import { submitContact, isNetworkError, ApiError } from "@/lib/api";
import { validateText, LIMITS } from "@/lib/validation";
import { useSiteContent } from "@/lib/siteContent";
import { SERVICE_QUERY_KEY, SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import { isGuideTopic } from "@/lib/hud/topics";
import { attachmentBlock } from "@/lib/request/attachment";
import {
  DEFAULT_OPTION_IDS,
  OPTIONS,
  PROJECT_TYPES,
  SERVICE_FOR_TYPE,
  isEstimatorOptionId,
  isEstimatorTypeId,
  type EstimatorOptionId,
  type EstimatorTypeId,
} from "@/lib/request/catalog";
import type { RequestContext } from "@/lib/request/RequestFlowProvider";
import { mediaMatches, PREFERS_REDUCED_MOTION } from "@/lib/device";
import styles from "./Estimator.module.css";
import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  /* The request dialog carries the same sentence as its title (`COPY.title` in
     lib/request/RequestFlowProvider.tsx, written out there so the provider never imports this
     module): change the two together. */
  title: L(
    "Spune ce vrei să testezi. Stabilim primul pas.",
    "Расскажите, что хотите проверить. Определим первый шаг.",
    "Tell us what you want to test. We'll define the first step.",
  ),
  /* The page's line under the heading. The dialog keeps its own lead (RequestFlowProvider). The
     reply time is `SENT_COPY`'s, said before the visitor sends rather than only after. */
  lead: L(
    "În câteva întrebări definim MVP-ul, ce trebuie validat și un buget inițial mic. Îți răspundem în cel mult o zi lucrătoare.",
    "За несколько вопросов определим MVP, что нужно проверить и небольшой начальный бюджет. Ответим не позже чем через рабочий день.",
    "In a few questions, we define the MVP, what needs testing and a small initial budget. We reply within one business day.",
  ),
  step1: L("01 · TIP PROIECT", "01 · ТИП ПРОЕКТА", "01 · PROJECT TYPE"),
  step2: L("02 · OPȚIUNI CARE CONTEAZĂ", "02 · ЧТО ВАЖНО ДОБАВИТЬ", "02 · OPTIONS THAT MATTER"),
  proposal: L("PROPUNEREA TA", "ВАШЕ ПРЕДЛОЖЕНИЕ", "YOUR PROPOSAL"),
  from: L("de la", "от", "from"),
  assistant: L("Ghid pentru prima versiune", "Гид по первой версии", "Guide to your first version"),
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
  /* The page area the request is about (`context.guideTopic`). */
  section: L("Secțiune", "Раздел", "Section"),
  source: L("Sursă (CTA)", "Источник (CTA)", "Source (CTA)"),
};

/* The note under the proposal when a HUD tool handed something over with the request
   (`context.attachment`): what travels, and how much of it, so the visitor knows what the
   team will read. `{total}` is " · de la 600€", or nothing when the tool had no total. */
/* The project the visitor asked for "one like" ("Vreau un proiect similar" on /portofoliu),
   said back to them at the top of the form: until 2026-10-04 its name travelled only in the
   message to the team, and the visitor could not see what they had sent. */
const EXAMPLE = L("Proiect ales ca exemplu: {name}", "Проект-пример: {name}", "Example project: {name}");

const ATTACHED = {
  calculator: L(
    "Selecția din calculator (servicii: {n}{total}) pleacă împreună cu cererea.",
    "Выбор из калькулятора (услуг: {n}{total}) уйдёт вместе с заявкой.",
    "The calculator selection (services: {n}{total}) travels with the request.",
  ),
  builder: L(
    "Pachetul din constructor (module: {n}) pleacă împreună cu cererea.",
    "Пакет из конструктора (модулей: {n}) уйдёт вместе с заявкой.",
    "The builder package (modules: {n}) travels with the request.",
  ),
};

/* Copy for the free-text composer in the chat — the visitor can always answer in their
   own words instead of picking one of the quick replies. */
const CHAT = {
  /* The conversation's scrolling window, named for the keyboard stop it is (see `.chatLog`). */
  history: L("Conversația cu asistentul", "Переписка с ассистентом", "Conversation with the assistant"),
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

/* The project types, the options and the type -> admin service pairing live in
   `lib/request/catalog.ts`, with the ids other entry points preselect them by. */

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

/* ---------- the dialog used to run this flow as three steps ----------
   The reason it did is worth keeping, because it is the thing the deck now has to answer:
   two columns are right at page width and were cramped inside a 960px modal. The owner
   chose one arrangement for both (2026-09-26), so the answer is no longer a second layout
   — it is `@container` on the deck (Estimator.module.css), which lets the SAME rules stack
   the bays on the width the deck actually has instead of the width of the window. */

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
      "Ce vrei să verifici mai întâi?",
      "Что вы хотите проверить сначала?",
      "What do you want to test first?",
    ),
    options: [
      { label: L("Unde pierdem clienți", "Где мы теряем клиентов", "Where customers drop off"), next: "growth" },
      { label: L("Ce proces merită automatizat", "Какой процесс стоит автоматизировать", "Which process is worth automating"), next: "automation" },
      { label: L("Dacă există cerere", "Есть ли спрос", "Whether there is demand"), next: "product" },
    ],
    /* A visitor who describes the goal in their own words has already answered the
       branch questions below, so their free answer skips straight to the planning half. */
    freeNext: "timeline",
    hint: L(
      "Ex.: vrem să vedem dacă oamenii cer serviciul online.",
      "Напр.: хотим понять, будут ли люди заказывать услугу онлайн.",
      "E.g. we want to learn whether people will request the service online.",
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
      "Ce vrei să afli din prima versiune?",
      "Что вы хотите понять с помощью первой версии?",
      "What do you want the first version to teach you?",
    ),
    options: [
      { label: L("Există cerere pentru idee", "Есть ли спрос на идею", "Whether there is demand for the idea"), next: "shape" },
      { label: L("Oamenii folosesc fluxul propus", "Будут ли люди пользоваться предложенным сценарием", "Whether people use the proposed flow"), next: "shape" },
      { label: L("Ce funcții contează cu adevărat", "Какие функции действительно важны", "Which features truly matter"), next: "shape" },
    ],
    freeNext: "shape",
  },
  shape: {
    q: L(
      "Cine trebuie să poată testa primul?",
      "Кто должен протестировать первым?",
      "Who should be able to test first?",
    ),
    options: [
      { label: L("Clienți potențiali", "Потенциальные клиенты", "Potential customers"), next: "timeline" },
      { label: L("Echipa internă", "Внутренняя команда", "Internal team"), next: "timeline" },
      { label: L("Un grup restrâns de utilizatori", "Небольшая группа пользователей", "A small group of users"), next: "timeline" },
    ],
    freeNext: "timeline",
  },
  timeline: {
    q: L(
      "Când vrei să ai prima versiune gata de test?",
      "Когда вы хотите иметь первую версию для теста?",
      "When do you want the first version ready to test?",
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
      "Ce investiție poți aloca pentru prima versiune?",
      "Какую инвестицию вы можете выделить на первую версию?",
      "What investment can you allocate to the first version?",
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
      "Spune-ne pe scurt ce vrei să verifici. Poți scrie liber sau alege o variantă rapidă.",
      "Коротко опишите, что хотите проверить. Можно написать свободно или выбрать быстрый вариант.",
      "Briefly tell us what you want to test. Write freely or choose a quick option.",
    ),
    options: [
      { label: L("Am deja un caiet de sarcini", "У нас уже есть ТЗ", "We already have a brief"), next: "clarify" },
      { label: L("Am o idee, nu un plan", "Есть идея, но не план", "I have an idea, not a plan"), next: "clarify" },
      { label: L("Refacem ceva existent", "Переделываем существующее", "We're rebuilding something"), next: "clarify" },
    ],
    freeNext: "clarify",
    hint: L(
      "Ce problemă ai, pentru cine și ce ai vrea să afli după primele utilizări.",
      "Какая проблема, для кого и что вы хотите узнать после первых использований.",
      "The problem, who it is for and what you want to learn from first use.",
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
   * THERE IS ONE ARRANGEMENT. Both values render the same deck — both bays, everything on
   * screen, the assistant among them. `"dialog"` used to be a second layout (one column,
   * three steps, the assistant behind a button) and stopped being one on 2026-09-26.
   *
   * What the value still decides is small, and all of it is about being inside a modal: the
   * dialog leaves off the page's heading block and `#estimare` (the modal has its own head,
   * and an anchor may exist once per document), names its assistant so `openAssistant` can
   * move focus to it, and suffixes the two element ids so a dialog open over the page does
   * not put two of each in one document. It is also read as BEHAVIOUR elsewhere — the corner
   * assistant steps out of the way of the `section` one. The state, the validation and the
   * submitted payload are the same code either way.
   */
  layout?: "section" | "dialog";
  /** Rendered next to the chat composer (`data-dictation-slot="estimator-chat"`, a NAME and
      not an id — a dialog open over the page has two, so scope any lookup to one estimator). */
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
 *
 * `projectType` is a type named outright by whoever opened the dialog (a HUD tool), and it
 * wins over any slug: nothing states the intent more precisely. An id the catalog does not
 * know is ignored, so the slug decides as if it had never been passed.
 */
function useServiceTypeIndex(override?: string, projectType?: EstimatorTypeId): number {
  const params = useSearchParams();
  if (isEstimatorTypeId(projectType)) {
    return PROJECT_TYPES.findIndex((t) => t.id === projectType);
  }
  const slug = override ?? params.get(SERVICE_QUERY_KEY);
  if (!slug) return 0;
  const wanted = SERVICE_TO_ESTIMATOR_TYPE[slug];
  const found = PROJECT_TYPES.findIndex((t) => t.id === wanted);
  return found >= 0 ? found : 0;
}

/**
 * The option chips a fresh estimator starts with, as indexes into `OPTIONS`.
 *
 * `ids` (`context.optionIds`) replaces the default outright — `[]` ticks nothing — and an id
 * the catalog does not know is dropped rather than guessed at.
 */
function initialOptions(ids: readonly EstimatorOptionId[] | undefined): Set<number> {
  const wanted = (ids ?? DEFAULT_OPTION_IDS).filter(isEstimatorOptionId);
  return new Set(OPTIONS.flatMap((o, i) => (wanted.includes(o.id) ? [i] : [])));
}

export function Estimator({
  context,
  layout = "section",
  renderChatDictation,
  renderDetailsDictation,
}: EstimatorProps = {}) {
  const {
    serviceSlug,
    projectId,
    projectName,
    source,
    projectType,
    optionIds,
    openAssistant,
    guideTopic,
    attachment,
  } = context ?? {};
  const isDialog = layout === "dialog";
  /*
   * ONE DOCUMENT CAN HOLD BOTH OF THESE AT ONCE — the home page's section with the dialog open
   * over it — and since 2026-09-26 the dialog's assistant is always rendered rather than hidden
   * behind a button, so the two composers coexist on every such opening rather than only when
   * someone pressed "Ghidat". Two elements with one id is invalid HTML, and it is what a label,
   * a `for=` and the dictation button's `targetId` all resolve through: the browser hands them
   * the FIRST match, which would be the page's field while the visitor types in the dialog's.
   */
  const domId = (base: string) => (isDialog ? `${base}-dialog` : base);
  const l = useLoc();
  const t = useT();
  /* Prices are the owner's, edited in the admin — see SERVICE_FOR_TYPE (lib/request/catalog). */
  const { services } = useSiteContent();
  /* `useT` is keyed by MessageKey; validateText takes a looser (key: string) => string.
     Wrapping keeps the catalog's typed keys everywhere except this one boundary. */
  const tr = (key: string) => t(key as Parameters<typeof t>[0]);
  const [typeIndex, setTypeIndex] = useState(useServiceTypeIndex(serviceSlug, projectType));
  const [opts, setOpts] = useState<Set<number>>(() => initialOptions(optionIds));
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


  /*
   * The panel lights once, the first time it is reached, and then never again. A one-shot
   * observer that unobserves itself — the same shape the direction pages use — rather than a
   * scroll handler or a second permanent observer. The attribute is never removed, so nothing
   * replays on a scroll back up.
   * Without IntersectionObserver the attribute is set immediately, so the panel is lit rather
   * than dead: the sweep is decoration, and its absence must never leave a state behind.
   */
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-entered", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-entered", "");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* And while the deck is off screen its two lights stop repainting (Estimator.module.css).
     A second observer on the same node, because the one above is a one-shot latch that
     unobserves itself — it cannot also report leaving. */
  useOffscreenAttribute(boxRef);

  const chatPanelRef = useRef<HTMLDivElement>(null);

  /*
   * `openAssistant` in the dialog: the assistant is already on screen, so all that is left to
   * do is take the visitor to it. The guide's avatar passes this on every request it opens
   * (components/hud/guide/GuideAssistant.tsx), and it used to open a panel that no longer
   * closes — the deck's assistant is never hidden.
   *
   * A microtask, not now: a dialog whose chunk is already loaded mounts this estimator in the
   * same commit as the Modal, and the Modal's initial-focus effect runs after this one (a
   * parent's effects follow its children's) — it would move focus straight back to the ✕.
   */
  useEffect(() => {
    if (!isDialog || openAssistant !== true) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) chatPanelRef.current?.focus();
    });
    return () => {
      cancelled = true;
    };
  }, [isDialog, openAssistant]);

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

  /*
   * The proposal panel acknowledges a price change — and ONLY a real one. It compares the
   * rendered STRING, so a re-render, a re-selection of the same chip or a change that happens to
   * land on the same figure fires nothing. The price itself is never animated: it is the owner's
   * real number and it simply appears, exactly as it always did. What is marked is the moment it
   * became a different number.
   * The first render seeds the ref without firing, so the panel does not flash on arrival.
   */
  const shownPrice = useRef<string | null>(null);
  const [commit, setCommit] = useState<"a" | "b" | null>(null);
  useEffect(() => {
    if (shownPrice.current === null) {
      shownPrice.current = price;
      return;
    }
    if (shownPrice.current === price) return;
    shownPrice.current = price;
    /* Alternating tokens, not a counter and never a remount: a CSS animation only restarts when
       its NAME changes, and remounting the panel would take the contact form with it and throw
       away whatever the visitor had already typed. Two identical keyframes under two names is
       the whole trick. */
    setCommit((prev) => (prev === "a" ? "b" : "a"));
  }, [price]);

  const done = node === "finish";
  const current = done ? null : TREE[node];

  /*
   * The chat keeps one size (Estimator.module.css, `.chat`), so a conversation longer than its
   * window scrolls inside it, and every answer brings the window to the newest message: the
   * question just asked, right above the replies that answer it. At the end the window stops at
   * the closing message instead of the very bottom, so the summary under it is read from its
   * title. Only on a new message — the window is never moved while the visitor reads back.
   * `offsetTop` (`.chatLog` is the offset parent), not a client rect: a new bubble is still
   * rising 8px into place when this runs.
   */
  const logRef = useRef<HTMLDivElement>(null);
  /* Whether the window holds the newest message: set by the scroll to each new one, cleared at the
     end (the window stops at the closing message) and by the visitor scrolling away from it. */
  const pinnedRef = useRef(true);
  useEffect(() => {
    const scroller = logRef.current;
    if (!scroller || log.length === 0) return;
    let top = scroller.scrollHeight;
    const closing = done ? scroller.firstElementChild?.lastElementChild : null;
    if (closing instanceof HTMLElement) {
      top = closing.offsetTop - (Number.parseFloat(getComputedStyle(closing).marginTop) || 0);
    }
    pinnedRef.current = !done;
    const behavior = mediaMatches(PREFERS_REDUCED_MOTION) ? "auto" : "smooth";
    if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top, behavior });
    else scroller.scrollTop = top;
  }, [log.length, done]);

  /*
   * And the window stays on the newest message when it changes size under it — an error line
   * under the composer, the dictation's status or review, the replies wrapping to another row —
   * as long as it held it: it shrinks from the bottom edge, which would cut the question being
   * answered. A window the visitor has scrolled back in is left where they put it.
   *
   * Only the VISITOR's scrolling can unpin it — a wheel, a touch, a key, a press on the scrollbar,
   * then the scroll it causes. Our own scrolls fire scroll events too: the smooth one passes
   * through every position on its way, and the echo of a re-pin can arrive after the NEXT layout
   * change (measured: the microphone refused at once — "Se cere permisiunea" then the notice, one
   * frame apart), where it reads as "not at the end" and would have left the question cut.
   */
  useEffect(() => {
    const scroller = logRef.current;
    if (!scroller || typeof ResizeObserver === "undefined") return;
    let byVisitor = -Infinity;
    const intent = () => {
      byVisitor = performance.now();
    };
    const onScroll = () => {
      if (performance.now() - byVisitor > 1000) return;
      pinnedRef.current = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 2;
    };
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scroller.scrollTop = scroller.scrollHeight;
    });
    const INTENT = ["wheel", "touchstart", "touchmove", "pointerdown", "keydown"] as const;
    for (const type of INTENT) scroller.addEventListener(type, intent, { passive: true });
    scroller.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(scroller);
    return () => {
      observer.disconnect();
      for (const type of INTENT) scroller.removeEventListener(type, intent);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);

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
    const chosen = [...opts].sort((a, b) => a - b).map((i) => l(OPTIONS[i].label));
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
    // Only a topic `lib/hud/topics.ts` really has: the id is written into the lead verbatim.
    if (isGuideTopic(guideTopic)) rows.push(`- ${l(ORIGIN.section)}: ${guideTopic}`);
    if (source) rows.push(`- ${l(ORIGIN.source)}: ${source}`);
    if (rows.length === 0) return "";
    return [`${l(ORIGIN.title).toUpperCase()}:`, ...rows].join("\n");
  };

  /* The visible half of `context.attachment`: one line under the proposal. Shown only when a
     block will really be sent (`attachmentBlock` is not empty), so it never promises
     something the message does not carry. */
  const attachmentNote = (): string | null => {
    if (!attachment || !attachmentBlock(attachment)) return null;
    const copy = ATTACHED[attachment.kind];
    const { count } = attachment;
    if (!copy || !Number.isSafeInteger(count) || count < 0) return null;
    const summary = attachment.summary?.trim();
    return format(l(copy), { n: count, total: summary ? ` · ${summary}` : "" });
  };

  /**
   * Everything the visitor chose, folded into the one free-text field the API takes:
   * the structured summary first, then what a HUD tool attached, then where the request came
   * from, then the raw transcript.
   *
   * The API caps `message` at 5000 characters, so the budget is spent in that order —
   * the summary is what a human reads first, and only the leftover room goes to the
   * transcript. Both are cut with a visible marker rather than left to 422. The attachment's
   * and the origin block's room is *reserved* before the summary is clamped: the attachment is
   * capped at ATTACHMENT_MAX on its own, the origin is a couple of lines and is the part that
   * routes the lead, so neither may be the thing the cap eats.
   */
  const buildMessage = (): string => {
    const summary = [
      l(SUMMARY.title).toUpperCase(),
      ...summaryRows().map((r) => `- ${r.label}: ${r.value.replace(/\n/g, "\n  ")}`),
    ].join("\n");
    const blocks = [attachmentBlock(attachment), originBlock()].filter(Boolean);
    const reserved = blocks.reduce((n, block) => n + block.length + 2, 0); // each "\n\n" separator
    let message = clamp(summary, LIMITS.message - reserved);
    for (const block of blocks) message += `\n\n${block}`;

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

  /* `marks` carries the region attributes. Both layouts pass the same ones now; the argument
     survives because it is the chips' only way to be marked from outside. */
  const projectChips = (marks?: Record<string, string>) => (
    <div className={styles.choices} {...marks}>
      {PROJECT_TYPES.map((p, i) => (
        <button
          key={i}
          type="button"
          className={`${styles.choice} ${i === typeIndex ? styles.selected : ""}`}
          /* Selection used to be conveyed by fill colour alone on a plain button, so it was
             drawn but never spoken. The role stays `button`. */
          aria-pressed={i === typeIndex}
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
          aria-pressed={opts.has(i)}
          onClick={() => toggleOpt(i)}
        >
          {l(o.label)}
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
        {l(SECTION.assistant)}
      </div>
      {/* The conversation's window: the panel keeps one size, so this is what scrolls — the
          thread and, at the end, the summary under it. A tab stop of its own, because a window
          that scrolls has to be scrollable from the keyboard too, and nothing in it is
          focusable. The live region is the thread inside it, as it always was the bubbles. */}
      <div
        ref={logRef}
        className={styles.chatLog}
        tabIndex={0}
        role="region"
        aria-label={l(CHAT.history)}
      >
        <div className={styles.chatThread} aria-live="polite">
          <div className={styles.bubble}>{l(TREE.start.q)}</div>
          {log.map((b) => (
            <div key={b.id} className={`${styles.bubble} ${b.user ? styles.bubbleUser : ""}`}>
              {b.text}
            </div>
          ))}
        </div>
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
            id={domId("estimator-chat-input")}
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
                targetId: domId("estimator-chat-input"),
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
    </>
  );

  /* noValidate: the browser's own bubble would fire first and our localized,
     screen-reader-announced messages would never run. */
  const contactForm = (
    /* `data-status` because `.submit:disabled` is true for BOTH "sending" and "sent", so the
       button could not tell the two apart: the in-flight light and the landed ring both key off
       this. It carries no text and invents no state — it is the status the component already
       holds, exposed to the stylesheet. */
    <form className={styles.form} data-status={status} onSubmit={onSubmit} noValidate>
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
          id={domId("estimator-details")}
          data-dictation-target="estimator-details"
          aria-label={l(PLACEHOLDERS.details)}
          placeholder={l(PLACEHOLDERS.details)}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={4000}
          /* One row shorter in the dialog, where the height is a budget: it is the only field
             whose size is a choice rather than a line of text, and it still grows on scroll. */
          rows={isDialog ? 2 : 3}
        />
        {/* Second dictation mount point — same contract as the chat one. */}
        <span className={styles.dictationSlot} data-dictation-slot="estimator-details">
          {renderDetailsDictation?.({
            targetId: domId("estimator-details"),
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
     THE DECK — one arrangement, on the page and in the dialog.
     ---------------------------------------------------------------------------------
     The dialog used to be a three-step wizard of its own: a numbered progress bar, one
     panel at a time, Înapoi/Continuă, and the assistant behind a "Ghidat" button. The
     owner asked for the two to be the same thing (2026-09-26), and they are: the console
     deck, both bays, everything on screen at once. What the wizard owned and the deck did
     not — the attachment note and `openAssistant` — is carried below.

     `data-layout` is no longer a look. Both layouts render the same classes; the attribute
     stays because it is BEHAVIOUR that reads it: the corner assistant steps out of the way
     of `[data-testid="request-flow"][data-layout="section"]` only (the home page's own
     form), and the specs use it to tell the two apart. Nothing in the stylesheet keys off
     it any more.
     --------------------------------------------------------------------------------- */
  const attached = attachmentNote();
  const deck = (
    <div
      ref={boxRef}
      className={styles.box}
      data-testid="request-flow"
      data-layout={isDialog ? "dialog" : "section"}
    >
      {/* The deck's top rail. Decorative, silent, permanently in motion — the second light
          runs the proposal panel's own edge and needs no element of its own. */}
      <span className={styles.railLight} aria-hidden="true" />

      <div className={styles.steps}>
        <div className={styles.bayLeft}>
          {projectName ? (
            <p className={styles.example}>{format(l(EXAMPLE), { name: projectName })}</p>
          ) : null}
          {/* Real headings. On the page they sit under the section's own <h2>; in the dialog
              under the modal's, where they are the ONLY structure a screen reader gets — the
              wizard had a heading per step and the deck had none. */}
          <h3 className={`mono ${styles.stepLabel}`}>{l(SECTION.step1)}</h3>
          {projectChips({ "data-step": "project", "data-active": "true" })}

          <h3 className={`mono ${styles.stepLabel}`}>{l(SECTION.step2)}</h3>
          {optionChips({ "data-step": "options", "data-active": "true" })}

          {/* In the dialog this is also the thing `openAssistant` takes a visitor to, so it
              is focusable and named there. On the page it is one part of a section that is
              already announced by its own heading, and needs neither. */}
          <div
            className={styles.chat}
            ref={isDialog ? chatPanelRef : undefined}
            tabIndex={isDialog ? -1 : undefined}
            id={isDialog ? "request-assistant" : undefined}
            role={isDialog ? "group" : undefined}
            aria-label={isDialog ? l(SECTION.assistant) : undefined}
            data-testid={isDialog ? "chat-panel" : undefined}
          >
            {chatBody}
          </div>
        </div>

        {/* The label sits on the DECK, not on the panel: --red-text measures 3.51:1 on the
            lit riser and fails, and no panel bright enough to separate from the deck can
            carry it. Out here it is 5.11:1, and all three region labels share one ground. */}
        <div className={styles.bayRight}>
          <h3 className={`mono ${styles.stepLabel}`}>{l(SECTION.proposal)}</h3>
          {/* A <div>, not the <aside> it was. `<aside>` is a `complementary` landmark, and this
              is the proposal and the send button — the primary thing on the deck, not content
              tangential to it. Tolerable on a page full of landmarks; inside the dialog it
              announced the request form itself as an aside. */}
          <div
            className={styles.result}
            data-step="contact"
            data-active="true"
            /* `undefined` keeps the attribute off the markup entirely until a price has
               actually changed, so nothing flashes on arrival. */
            data-commit={commit ?? undefined}
          >
            <b className={`disp ${styles.price}`}>{price}</b>
            <p className={styles.resultCopy}>{l(RESULT_COPY)}</p>
            {/* What the calculator already chose for this visitor. Only ever present when a
                caller passed an attachment, which today is the OS calculator opening the
                dialog — but it is rendered by the deck rather than by a layout, so whatever
                passes one next gets the line too. The block itself travels in the message
                either way (`buildMessage`); this is the visitor's half of that promise. */}
            {attached && <p className={styles.attached}>{attached}</p>}
            {contactForm}
          </div>
        </div>
      </div>
    </div>
  );

  /* The dialog has its own heading, its own lead and its own ✕ (lib/request/RequestFlowProvider
     .tsx). It takes the deck and nothing around it — the page furniture below would give it a
     second <h2> carrying the same sentence, and a second `id="estimare"` in the document. */
  if (isDialog) return deck;

  return (
    <section id="estimare" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
            <p className={styles.lead}>{l(SECTION.lead)}</p>
          </div>
        </Reveal>
        {deck}
      </div>
    </section>
  );
}
