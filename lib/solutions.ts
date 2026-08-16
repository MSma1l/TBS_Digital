import type { LocalizedText } from "@/lib/i18n/content";

/** Rich content for a single "direction" page. Kept out of the message catalog as
 *  self-contained trilingual objects (rendered with useLoc). Only filled directions
 *  render the full page; the rest fall back to the placeholder.
 *
 *  Keys are the URL slugs from lib/directions.ts, i.e. the `<slug>` in
 *  `/servicii/<slug>` — the same in all three languages. */
export type SolutionItem = { title: LocalizedText; desc: LocalizedText };
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
  "e-commerce": {
    accent: "#ff7268",
    eyebrow: L("VÂNZARE MAI SIMPLĂ", "ПРОДАВАТЬ ПРОЩЕ", "SELLING MADE SIMPLER"),
    title: L("E-commerce", "Электронная коммерция", "E-commerce"),
    intro: L(
      "Un magazin online rapid, ușor de cumpărat și conectat la operațiunile tale.",
      "Быстрый интернет-магазин — удобно покупать и связан с вашими процессами.",
      "A fast online store — easy to buy from and connected to your operations.",
    ),
    cardLabel: L("PENTRU COMENZI FĂRĂ FRICȚIUNE", "ДЛЯ ЗАКАЗОВ БЕЗ ТРЕНИЯ", "FOR FRICTIONLESS ORDERS"),
    cardTitle: L("Catalog → checkout → livrare", "Каталог → оформление → доставка", "Catalog → checkout → delivery"),
    cardText: L(
      "Experiență clară pentru client și echipă.",
      "Понятный опыт и для клиента, и для команды.",
      "A clear experience for both customer and team.",
    ),
    items: [
      { title: L("Catalog clar", "Понятный каталог", "Clear catalog"), desc: L("Produse și filtre care ajută alegerea.", "Товары и фильтры, которые помогают выбрать.", "Products and filters that guide the choice.") },
      { title: L("Checkout rapid", "Быстрое оформление", "Fast checkout"), desc: L("Pași puțini, plăți sigure și conversie mai bună.", "Меньше шагов, безопасная оплата и выше конверсия.", "Fewer steps, secure payments and better conversion.") },
      { title: L("Operațiuni conectate", "Связанные операции", "Connected operations"), desc: L("Stoc, facturare și livrare într-un singur flux.", "Склад, счета и доставка в едином потоке.", "Stock, invoicing and delivery in one flow.") },
    ],
    steps: [
      L("Audităm oferta și traseul de cumpărare.", "Аудит предложения и пути покупки.", "We audit the offer and the buying journey."),
      L("Proiectăm experiența mobil-first.", "Проектируем опыт mobile-first.", "We design the experience mobile-first."),
      L("Conectăm plata, stocul și analytics.", "Подключаем оплату, склад и аналитику.", "We connect payments, stock and analytics."),
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
  "asistenti-ia": {
    accent: "#9b72ff",
    eyebrow: L("IA CARE LUCREAZĂ CU ECHIPA", "ИИ, КОТОРЫЙ РАБОТАЕТ С КОМАНДОЙ", "AI THAT WORKS WITH YOUR TEAM"),
    title: L("Asistenți IA & boturi", "Помощники ИИ и боты", "AI assistants & bots"),
    intro: L(
      "Asistenți care răspund, califică cereri și pornesc procese în web, Telegram și sistemele interne.",
      "Ассистенты, которые отвечают, квалифицируют запросы и запускают процессы в вебе, Telegram и внутренних системах.",
      "Assistants that answer, qualify requests and trigger processes across web, Telegram and internal systems.",
    ),
    cardLabel: L("PENTRU RĂSPUNSURI ȘI ACȚIUNI RAPIDE", "ДЛЯ БЫСТРЫХ ОТВЕТОВ И ДЕЙСТВИЙ", "FOR FAST ANSWERS AND ACTIONS"),
    cardTitle: L("Chatbot + asistent intern + Telegram", "Чат-бот + внутренний ассистент + Telegram", "Chatbot + internal assistant + Telegram"),
    cardText: L(
      "IA conectată la contextul și procesele tale.",
      "ИИ, подключённый к вашему контексту и процессам.",
      "AI connected to your context and processes.",
    ),
    items: [
      { title: L("Chatbot client", "Клиентский чат-бот", "Customer chatbot"), desc: L("Răspunde și califică cererile 24/7.", "Отвечает и квалифицирует запросы 24/7.", "Answers and qualifies requests 24/7.") },
      { title: L("Asistent intern", "Внутренний ассистент", "Internal assistant"), desc: L("Găsește informația și asistă echipa.", "Находит информацию и помогает команде.", "Finds information and assists the team.") },
      { title: L("Bot Telegram", "Telegram-бот", "Telegram bot"), desc: L("Trimite notificări și pornește acțiuni din chat.", "Шлёт уведомления и запускает действия из чата.", "Sends notifications and triggers actions from chat.") },
    ],
    steps: [
      L("Definim întrebările și limitele asistentului.", "Определяем вопросы и границы ассистента.", "We define the assistant's questions and limits."),
      L("Conectăm datele, API-urile și canalele.", "Подключаем данные, API и каналы.", "We connect the data, APIs and channels."),
      L("Testăm răspunsurile și îmbunătățim continuu.", "Тестируем ответы и постоянно улучшаем.", "We test the answers and keep improving."),
    ],
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
       is the case for e-commerce and for AI assistants: nothing in the portfolio is a
       shop or an assistant/bot, and inventing one would be a lie on a sales page.

   The order inside a list is curated: the first entry is the direction's reference
   project — the one shown in the hero card and behind the "see the project" action. */
export const solutionProjectIds: Record<string, string[]> = {
  // Products taken from an idea to a shipped, measurable thing.
  "produs-digital": ["bizcheck", "docusafe", "iq-arena", "statistic", "flirt"],
  // Nothing in the portfolio is a shop — see the rules above.
  "e-commerce": [],
  // Internal systems: boards, tickets, documents, data pipelines, reporting.
  "automatizare-api": ["crowe-portal", "docusafe", "statistic"],
  // No assistant/bot has shipped yet.
  "asistenti-ia": [],
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
