import type { LocalizedText } from "@/lib/i18n/content";

/** Rich content for a single "direction" page. Kept out of the message catalog as
 *  self-contained trilingual objects (rendered with useLoc). Only filled directions
 *  render the full page; the rest fall back to the placeholder.
 *
 *  Keys are the URL slugs from lib/directions.ts, i.e. the `<slug>` in
 *  `/servicii/<slug>` — the same in all three languages. */
export type SolutionItem = { title: LocalizedText; desc: LocalizedText };

/** One documented case on a direction page: a piece of work that really exists.
 *  `url` is set ONLY when there is a real public page behind it — a case without one is
 *  rendered as plain text, never as a link with nothing at the end. */
export type SolutionCase = {
  label: LocalizedText;
  /** Product name, identical in all three languages — it is a proper noun. */
  name: string;
  text: LocalizedText;
  url?: string;
};

export type Solution = {
  eyebrow: LocalizedText;
  title: LocalizedText;
  intro: LocalizedText;
  cardLabel: LocalizedText;
  cardTitle: LocalizedText;
  cardText: LocalizedText;
  items: SolutionItem[];
  steps: LocalizedText[];
  accent?: string;
  /** The flow a direction sells when it has no delivered project to show: the hero card
   *  draws these steps as a scheme instead of naming a project that does not exist. */
  flow?: LocalizedText[];
  /** Labelled cases on the service page, each described strictly with verified facts. */
  cases?: { title: LocalizedText; lead: LocalizedText; items: SolutionCase[] };
};

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

export const solutions: Record<string, Solution> = {
  "produs-digital": {
    accent: "#3970ff",
    eyebrow: L("DE LA IPOTEZĂ LA LANSARE", "ОТ ГИПОТЕЗЫ ДО ЗАПУСКА", "FROM HYPOTHESIS TO LAUNCH"),
    title: L("Produs digital", "Цифровой продукт", "Digital product"),
    intro: L(
      "Transformăm o problemă bună într-un produs clar, ușor de folosit și pregătit să crească.",
      "Превращаем хорошую задачу в понятный продукт — удобный и готовый расти.",
      "We turn a good problem into a clear product — easy to use and ready to grow.",
    ),
    cardLabel: L("PENTRU O IDEE CARE MERITĂ LANSATĂ", "ДЛЯ ИДЕИ, КОТОРУЮ СТОИТ ЗАПУСТИТЬ", "FOR AN IDEA WORTH LAUNCHING"),
    cardTitle: L("Strategie + UX + dezvoltare", "Стратегия + UX + разработка", "Strategy + UX + development"),
    cardText: L(
      "Un drum simplu de la primul workshop la produs funcțional.",
      "Простой путь от первого воркшопа до работающего продукта.",
      "A simple path from the first workshop to a working product.",
    ),
    items: [
      { title: L("Strategie", "Стратегия", "Strategy"), desc: L("Clarificăm problema, utilizatorii și rezultatul dorit.", "Проясняем задачу, пользователей и нужный результат.", "We clarify the problem, the users and the desired outcome.") },
      { title: L("Design testabil", "Тестируемый дизайн", "Testable design"), desc: L("Prototipăm experiența înainte de dezvoltare.", "Прототипируем опыт до разработки.", "We prototype the experience before development.") },
      { title: L("Lansare măsurabilă", "Измеримый запуск", "Measurable launch"), desc: L("Livrăm și urmărim semnalele importante.", "Запускаем и отслеживаем важные сигналы.", "We ship and track the signals that matter.") },
    ],
    steps: [
      L("Workshop și direcție de produs.", "Воркшоп и продуктовое направление.", "Workshop and product direction."),
      L("UX/UI și prototip validat.", "UX/UI и проверенный прототип.", "UX/UI and a validated prototype."),
      L("Dezvoltare, lansare și optimizare.", "Разработка, запуск и оптимизация.", "Development, launch and optimization."),
    ],
  },
  /* Sold as a CAPABILITY, not as a case study: nothing in the portfolio is a shop, so every
     sentence here is written in the offer tense ("construim"), and the hero card draws the
     flow we build instead of naming a project. See `solutionProjectIds` below — the list
     stays empty on purpose. */
  "e-commerce": {
    accent: "#ff7268",
    eyebrow: L(
      "PRODUSE DIGITALE CARE SE VÂND CLAR",
      "ЦИФРОВЫЕ ПРОДУКТЫ, КОТОРЫЕ ПРОДАЮТСЯ ПОНЯТНО",
      "DIGITAL PRODUCTS THAT SELL CLEARLY",
    ),
    title: L(
      "E-commerce pentru produse, rapoarte și acces digital",
      "E-commerce для продуктов, отчётов и цифрового доступа",
      "E-commerce for products, reports and digital access",
    ),
    intro: L(
      "Construim fluxul întreg: oferta, plata și accesul la produs sau la raport.",
      "Строим весь поток: предложение, оплата и доступ к продукту или отчёту.",
      "We build the whole flow: the offer, the payment and the access to the product or report.",
    ),
    cardLabel: L("FLUXUL PE CARE ÎL CONSTRUIM", "ПОТОК, КОТОРЫЙ МЫ СТРОИМ", "THE FLOW WE BUILD"),
    cardTitle: L("Ofertă → Plată → Acces", "Предложение → Оплата → Доступ", "Offer → Payment → Access"),
    cardText: L(
      "Trei pași, fără nimic în plus între decizie și livrare.",
      "Три шага — и ничего лишнего между решением и выдачей.",
      "Three steps, with nothing extra between the decision and the delivery.",
    ),
    flow: [
      L(
        "Ofertă — produsul, raportul sau accesul, prezentate clar.",
        "Предложение — продукт, отчёт или доступ, показанные понятно.",
        "Offer — the product, the report or the access, presented clearly.",
      ),
      L(
        "Plată — un checkout scurt, cu metodele potrivite pieței tale.",
        "Оплата — короткий чекаут с методами, подходящими вашему рынку.",
        "Payment — a short checkout, with the methods that fit your market.",
      ),
      L(
        "Acces — livrare digitală sau cont cu tot ce a cumpărat clientul.",
        "Доступ — цифровая выдача или личный кабинет со всем, что купил клиент.",
        "Access — digital delivery, or an account holding everything the customer bought.",
      ),
    ],
    items: [
      {
        title: L("Checkout și plăți", "Чекаут и оплата", "Checkout and payments"),
        desc: L(
          "Construim un pas de plată scurt, cu metodele potrivite pieței tale.",
          "Строим короткий шаг оплаты с методами, подходящими вашему рынку.",
          "We build a short payment step, with the methods that fit your market.",
        ),
      },
      {
        title: L("Livrare și acces digital", "Цифровая выдача и доступ", "Digital delivery and access"),
        desc: L(
          "După plată, clientul primește automat produsul, raportul sau accesul.",
          "После оплаты клиент автоматически получает продукт, отчёт или доступ.",
          "After payment, the customer automatically receives the product, the report or the access.",
        ),
      },
      {
        title: L("Raportare și gestionare produse", "Отчётность и управление товарами", "Reporting and product management"),
        desc: L(
          "Un panou pentru produse, comenzi și rapoarte de vânzări.",
          "Панель для товаров, заказов и отчётов о продажах.",
          "One panel for products, orders and sales reports.",
        ),
      },
    ],
    steps: [
      L(
        "Definim produsul digital, prețul și ce primește clientul.",
        "Определяем цифровой продукт, цену и то, что получает клиент.",
        "We define the digital product, its price and what the customer gets.",
      ),
      L(
        "Proiectăm oferta și checkout-ul, mobil-first.",
        "Проектируем предложение и чекаут, mobile-first.",
        "We design the offer and the checkout, mobile-first.",
      ),
      L(
        "Conectăm plata, accesul la produs și raportarea.",
        "Подключаем оплату, доступ к продукту и отчётность.",
        "We connect the payment, the product access and the reporting.",
      ),
    ],
  },
  "automatizare-api": {
    accent: "#12ae9e",
    eyebrow: L("CONECTĂM CE CONTEAZĂ", "СОЕДИНЯЕМ ГЛАВНОЕ", "WE CONNECT WHAT MATTERS"),
    title: L("Automatizare & API", "Автоматизация и API", "Automation & API"),
    intro: L(
      "Eliminăm pașii manuali și conectăm sistemele care trebuie să lucreze împreună.",
      "Убираем ручные шаги и соединяем системы, которые должны работать вместе.",
      "We remove manual steps and connect the systems that should work together.",
    ),
    cardLabel: L("PENTRU ECHIPE MAI EFICIENTE", "ДЛЯ БОЛЕЕ ЭФФЕКТИВНЫХ КОМАНД", "FOR MORE EFFICIENT TEAMS"),
    cardTitle: L("Procese care se mișcă singure", "Процессы, которые движутся сами", "Processes that move on their own"),
    cardText: L(
      "Mai puține copii, erori și rapoarte făcute manual.",
      "Меньше копирования, ошибок и ручных отчётов.",
      "Fewer copies, errors and manual reports.",
    ),
    items: [
      { title: L("Audit de proces", "Аудит процесса", "Process audit"), desc: L("Vedem unde se pierde timpul și informația.", "Видим, где теряются время и информация.", "We see where time and information are lost.") },
      { title: L("Integrări sigure", "Надёжные интеграции", "Secure integrations"), desc: L("CRM, ERP, plăți și date conectate corect.", "CRM, ERP, платежи и данные — связаны правильно.", "CRM, ERP, payments and data connected correctly.") },
      { title: L("Fluxuri vizibile", "Прозрачные потоки", "Visible flows"), desc: L("Automatizări și dashboard-uri ușor de urmărit.", "Автоматизации и дашборды, за которыми легко следить.", "Automations and dashboards that are easy to track.") },
    ],
    steps: [
      L("Cartografiem procesul actual.", "Составляем карту текущего процесса.", "We map the current process."),
      L("Construim integrarea și regulile.", "Строим интеграцию и правила.", "We build the integration and the rules."),
      L("Testăm, măsurăm și rafinăm fluxul.", "Тестируем, измеряем и улучшаем поток.", "We test, measure and refine the flow."),
    ],
  },
  /* Written against what actually runs. The eyebrow is the OFFER ("IA care lucrează cu
     echipa"); everything described as delivered — chat answered by a person, a decision-tree
     qualifier, a Telegram bot that routes requests — is something a visitor can go and see.
     No sentence here claims a language model shipped, because none did. */
  "asistenti-ia": {
    accent: "#9b72ff",
    eyebrow: L("IA CARE LUCREAZĂ CU ECHIPA", "ИИ, КОТОРЫЙ РАБОТАЕТ С КОМАНДОЙ", "AI THAT WORKS WITH YOUR TEAM"),
    title: L(
      "Asistenți și boți conectați la conversații reale",
      "Ассистенты и боты, подключённые к реальным разговорам",
      "Assistants and bots connected to real conversations",
    ),
    intro: L(
      "Răspuns, calificare și automatizare prin web, Telegram și sistemele interne.",
      "Ответ, квалификация и автоматизация через веб, Telegram и внутренние системы.",
      "Answering, qualification and automation across web, Telegram and internal systems.",
    ),
    cardLabel: L("PENTRU RĂSPUNSURI ȘI ACȚIUNI RAPIDE", "ДЛЯ БЫСТРЫХ ОТВЕТОВ И ДЕЙСТВИЙ", "FOR FAST ANSWERS AND ACTIONS"),
    cardTitle: L(
      "Chat + asistent de calificare + bot Telegram",
      "Чат + ассистент квалификации + Telegram-бот",
      "Chat + qualification assistant + Telegram bot",
    ),
    cardText: L(
      "Canale conectate la contextul și procesele tale.",
      "Каналы, подключённые к вашему контексту и процессам.",
      "Channels connected to your context and processes.",
    ),
    items: [
      {
        title: L("Chat pentru clienți", "Чат для клиентов", "Chat for customers"),
        desc: L(
          "Un canal de chat pe site, la care echipa răspunde în timp real dintr-un panou de administrare.",
          "Канал чата на сайте, в котором команда отвечает в реальном времени из панели администрирования.",
          "A chat channel on the site, where the team answers in real time from an admin panel.",
        ),
      },
      {
        title: L("Asistent care califică cererea", "Ассистент, который квалифицирует заявку", "An assistant that qualifies the request"),
        desc: L(
          "Ghidează vizitatorul prin întrebări, structurează cererea și o trimite automat echipei.",
          "Ведёт посетителя по вопросам, структурирует заявку и автоматически отправляет её команде.",
          "It guides the visitor through questions, structures the request and sends it to the team automatically.",
        ),
      },
      {
        title: L("Bot Telegram conectat la fluxul echipei", "Telegram-бот, подключённый к потоку команды", "A Telegram bot wired into the team's flow"),
        desc: L(
          "Fiecare cerere ajunge în chat, sortată pe topicuri per serviciu, gata de calificat cu butoane.",
          "Каждая заявка приходит в чат, разложенная по темам для каждой услуги, и готова к квалификации кнопками.",
          "Every request lands in the chat, sorted into per-service topics and ready to be qualified with buttons.",
        ),
      },
    ],
    steps: [
      L(
        "Definim întrebările, răspunsurile și limitele asistentului.",
        "Определяем вопросы, ответы и границы ассистента.",
        "We define the assistant's questions, answers and limits.",
      ),
      L(
        "Conectăm canalele: site, Telegram și sistemele interne.",
        "Подключаем каналы: сайт, Telegram и внутренние системы.",
        "We connect the channels: site, Telegram and internal systems.",
      ),
      L(
        "Testăm conversațiile reale și rafinăm fluxul.",
        "Тестируем реальные разговоры и улучшаем поток.",
        "We test the real conversations and refine the flow.",
      ),
    ],
    cases: {
      title: L("Cazuri reale", "Реальные кейсы", "Real cases"),
      lead: L(
        "Trei conversații care lucrează deja: două la clienții noștri, una la noi în echipă.",
        "Три уже работающих разговора: два — у наших клиентов, один — у нас в команде.",
        "Three conversations already at work: two at our clients, one inside our own team.",
      ),
      items: [
        {
          label: L("REZULTAT LIVRAT ÎN TELEGRAM", "РЕЗУЛЬТАТ В TELEGRAM", "RESULT DELIVERED IN TELEGRAM"),
          name: "BizCheck",
          text: L(
            "Platformă de autoevaluare a riscurilor pe metodologia Crowe: teste interactive pe blocuri, rezultat instant și raport PDF. Rezultatul poate fi primit în Telegram, printr-un bot dedicat. Include și un chestionar general GDPR, gratuit.",
            "Платформа самооценки рисков по методологии Crowe: интерактивные тесты по блокам, мгновенный результат и PDF-отчёт. Результат можно получить в Telegram — через отдельного бота. Включает и общий опросник GDPR, бесплатно.",
            "A risk self-assessment platform on the Crowe methodology: interactive tests by block, an instant result and a PDF report. The result can be received in Telegram, through a dedicated bot. It also includes a general GDPR questionnaire, free of charge.",
          ),
          url: "https://bizcheck.md",
        },
        {
          label: L("CHAT LIVE CU RĂSPUNS UMAN", "ЖИВОЙ ЧАТ С ЖИВЫМ ОТВЕТОМ", "LIVE CHAT ANSWERED BY PEOPLE"),
          name: "Balloons Breeze",
          text: L(
            "Site imersiv pentru un studio de aerodesign, cu chat live integrat: echipa răspunde clienților în timp real, dintr-un panou de administrare.",
            "Иммерсивный сайт студии аэродизайна со встроенным живым чатом: команда отвечает клиентам в реальном времени из панели администрирования.",
            "An immersive site for an aerodesign studio, with an integrated live chat: the team answers customers in real time, from an admin panel.",
          ),
          url: "https://balloonsbreeze.md/",
        },
        {
          /* Our own internal flow, not a portfolio project — hence no entry in
             `solutionProjectIds` and no external link. See docs/13-telegram.md. */
          label: L("FLUXUL NOSTRU INTERN", "НАШ ВНУТРЕННИЙ ПОТОК", "OUR OWN INTERNAL FLOW"),
          name: "TBS Digital",
          text: L(
            "Botul nostru de Telegram primește fiecare cerere din formular, o sortează pe topicuri per serviciu și lasă echipa s-o califice cu butoane, direct din chat.",
            "Наш Telegram-бот получает каждую заявку из формы, раскладывает её по темам для каждой услуги и позволяет команде квалифицировать её кнопками прямо в чате.",
            "Our Telegram bot receives every request from the form, sorts it into per-service topics and lets the team qualify it with buttons, straight from the chat.",
          ),
        },
      ],
    },
  },
  "brand-ui": {
    accent: "#3970ff",
    eyebrow: L("O IDENTITATE CARE SE ȚINE MINTE", "ИДЕНТИЧНОСТЬ, КОТОРУЮ ЗАПОМИНАЮТ", "AN IDENTITY THAT STICKS"),
    title: L("Brand & UI", "Бренд и интерфейс", "Brand & UI"),
    intro: L(
      "Un sistem vizual care arată premium, explică limpede și face produsul mai ușor de folosit.",
      "Визуальная система, которая выглядит премиально, понятно объясняет и делает продукт удобнее.",
      "A visual system that looks premium, explains clearly and makes the product easier to use.",
    ),
    cardLabel: L("PENTRU O EXPERIENȚĂ COERENTĂ", "ДЛЯ ЦЕЛОСТНОГО ОПЫТА", "FOR A COHERENT EXPERIENCE"),
    cardTitle: L("Brand cu logică de produs", "Бренд с продуктовой логикой", "A brand with product logic"),
    cardText: L(
      "Identitate, interfață și reguli ușor de aplicat.",
      "Идентичность, интерфейс и правила, которые легко применять.",
      "Identity, interface and rules that are easy to apply.",
    ),
    items: [
      { title: L("Poziționare", "Позиционирование", "Positioning"), desc: L("Clarificăm mesajul și diferențiatorul.", "Проясняем сообщение и отличие.", "We clarify the message and the differentiator.") },
      { title: L("Design system", "Дизайн-система", "Design system"), desc: L("Construim componente consecvente și scalabile.", "Строим консистентные и масштабируемые компоненты.", "We build consistent, scalable components.") },
      { title: L("UI premium", "Премиум-интерфейс", "Premium UI"), desc: L("Interfețe clare, rapide și memorabile.", "Понятные, быстрые и запоминающиеся интерфейсы.", "Clear, fast and memorable interfaces.") },
    ],
    steps: [
      L("Stabilim direcția vizuală.", "Определяем визуальное направление.", "We set the visual direction."),
      L("Construim sistemul de design.", "Строим систему дизайна.", "We build the design system."),
      L("Aplicăm și documentăm interfața.", "Применяем и документируем интерфейс.", "We apply and document the interface."),
    ],
  },
};

/* ---------------------------------------------------------------------------
   Pastel surface per direction
   ---------------------------------------------------------------------------
   Client-supplied brand values, kept HERE — one table for both the home-page selector
   (`components/sections/Directions.tsx`) and the service page
   (`components/sections/DirectionPage.tsx`). They are applied as CSS custom properties
   (`--sol-p1` / `--sol-p2`) on the element that owns the pastel surface, so the modules
   only ever reference the tokens; the hex values exist in this file and nowhere else.

   Dark theme: the modules do not paint these raw. Each mixes them into `--panel` through
   `--sol-mix`, which drops from 100% to ~26% under `[data-theme="dark"]` — the hue stays
   recognisable per service, the surface stops glowing white on a dark page. */
export type SolutionPalette = { p1: string; p2: string };

export const solutionPalette: Record<string, SolutionPalette> = {
  "produs-digital": { p1: "#dce8ff", p2: "#b9d5ff" },
  "e-commerce": { p1: "#ffe1de", p2: "#ffc1be" },
  "automatizare-api": { p1: "#d9faeb", p2: "#a9edd8" },
  "asistenti-ia": { p1: "#e9ddff", p2: "#cbb8ff" },
  "brand-ui": { p1: "#fff0bf", p2: "#ffd778" },
};

/* ---------------------------------------------------------------------------
   Which real projects belong to which direction
   ---------------------------------------------------------------------------
   The portfolio has no structured category: `ProjectItem.tag` is free localized text
   ("PLATFORMĂ WEB", "CRM PRIVAT · FĂRĂ LINK"), which cannot be matched against a service
   without guessing. So the membership is stated explicitly here, by project id — the ids
   from `lib/content.ts` / the admin.

   Rules this table follows, deliberately:
     · a project appears under a direction only if the work really was that kind of work;
     · a project may appear under two directions when it genuinely spans both;
     · a direction with no matching project gets an EMPTY list — the page then renders no
       projects section and no "see the projects" action, instead of an empty block. That
       is the case for e-commerce: nothing in the portfolio is a shop, and inventing one
       would be a lie on a sales page. That direction sells the flow it builds instead
       (`solutions["e-commerce"].flow`).

   The order inside a list is curated: the first entry is the direction's reference
   project — the one shown in the hero card and behind the "see the project" action. */
export const solutionProjectIds: Record<string, string[]> = {
  // Products taken from an idea to a shipped, measurable thing.
  "produs-digital": ["bizcheck", "docusafe", "iq-arena", "statistic", "flirt"],
  // Nothing in the portfolio is a shop — see the rules above.
  "e-commerce": [],
  // Internal systems: boards, tickets, documents, data pipelines, reporting.
  "automatizare-api": ["crowe-portal", "docusafe", "statistic"],
  // Conversational work that really shipped: BizCheck delivers its result through a
  // dedicated Telegram bot, Balloons Breeze runs a live chat its team answers from an
  // admin panel. Both are public, so both carry a real link.
  "asistenti-ia": ["bizcheck", "balloons-breeze"],
  // Brand-led sites and interfaces.
  "brand-ui": ["itara-global", "cgam", "balloons-breeze"],
};

/**
 * The real projects of a direction, in the curated order above.
 *
 * Generic over the project shape so this module stays free of a client-only import; the
 * caller passes `useSiteContent().projects`. Ids that no longer exist (an admin removed
 * the project) are skipped rather than rendered as a hole, so the table can never
 * resurrect a deleted project or crash a page.
 */
export function projectsForSolution<T extends { id: string }>(
  slug: string,
  projects: readonly T[],
): T[] {
  const ids = solutionProjectIds[slug];
  if (!ids || ids.length === 0) return [];
  const byId = new Map(projects.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
}

/** Shared UI copy for the direction pages. */
export const solUI = {
  back: L("← Înapoi la direcții", "← К направлениям", "← Back to directions"),
  benefit: L("BENEFICIU", "ПРЕИМУЩЕСТВО", "BENEFIT"),
  stepsTitle: L("Cum lucrăm", "Как мы работаем", "How we work"),
  talk: L("Discută cu echipa", "Обсудить с командой", "Talk to the team"),
  /* --- action bar, straight under the hero --- */
  actionTalk: L("Vorbește cu echipa", "Обсудить с командой", "Talk to the team"),
  actionProjects: L(
    "Vezi proiectele relevante",
    "Смотреть релевантные проекты",
    "See the relevant projects",
  ),
  actionProject: L("Vezi proiectul ↗", "Смотреть проект ↗", "View the project ↗"),
  /* Shown instead of the link above when the reference project has no public URL —
     a private client system. Never a link with nothing behind it. */
  actionProjectPrivate: L(
    "fără link public",
    "без публичной ссылки",
    "no public link",
  ),
  refLabel: L("PROIECT DE REFERINȚĂ", "ЭТАЛОННЫЙ ПРОЕКТ", "REFERENCE PROJECT"),
  /* --- labelled cases (only where a direction has them) --- */
  caseLink: L("Deschide site-ul ↗", "Открыть сайт ↗", "Open the site ↗"),
  projectsTitle: L("Proiecte relevante", "Релевантные проекты", "Relevant projects"),
  projectsLead: L(
    "Lucrări reale livrate pe această direcție.",
    "Реальные работы, выполненные по этому направлению.",
    "Real work delivered on this direction.",
  ),
  bottomTitle: L("Ai un proiect în minte?", "Есть проект на примете?", "Got a project in mind?"),
  bottomLead: L(
    "Spune-ne ce vrei să obții. Revenim cu următorul pas potrivit.",
    "Расскажите, чего хотите достичь — вернёмся со следующим шагом.",
    "Tell us what you want to achieve. We'll come back with the right next step.",
  ),
  start: L("Începe cererea", "Начать заявку", "Start a request"),
};
