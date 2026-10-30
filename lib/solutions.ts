import type { LocalizedText, MaybeLocalized } from "@/lib/i18n/content";
import { SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import { SERVICE_FOR_TYPE, isEstimatorTypeId, type EstimatorTypeId } from "@/lib/request/catalog";

/** Rich content for a single "direction" page. Kept out of the message catalog as
 *  self-contained trilingual objects (rendered with useLoc). Only filled directions
 *  render the full page; the rest fall back to the placeholder.
 *
 *  Keys are the URL slugs from lib/directions.ts, i.e. the `<slug>` in
 *  `/servicii/<slug>` — the same in all three languages. */
export type SolutionItem = { title: LocalizedText; desc: LocalizedText };

/**
 * What a direction promises, in the owner's words. ONE source for the three places that say it:
 * the home page's services panel (`components/sections/Directions.tsx`), the lead under the
 * service page's H1 (`components/sections/DirectionPage.tsx`) and that page's meta description
 * (`app/(site)/servicii/[slug]/page.tsx`) — so the panel never promises something the page does not.
 */
export type SolutionPitch = {
  title: LocalizedText;
  text: LocalizedText;
  points: [LocalizedText, LocalizedText, LocalizedText];
};

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
  title: LocalizedText;
  pitch: SolutionPitch;
  /** Set on a direction with no service of its own in the admin's price list: it shows no
   *  starting price rather than borrowing the one its request opens on (`directionPrice`). */
  noPrice?: true;
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
    /* The H1 carries the search phrase the page answers ("creare site-uri / aplicații / MVP");
       the menu name (`dir.digital`) and the meta title say the same thing in short. */
    title: L(
      "Creare site-uri, aplicații și MVP",
      "Создание сайтов, приложений и MVP",
      "Website, app and MVP development",
    ),
    pitch: {
      title: L(
        "Testează ideea înainte să construiești tot produsul",
        "Проверьте идею до того, как создавать весь продукт",
        "Test the idea before you build the whole product",
      ),
      /* Also the page's meta description: problem → what we do → result, 140–160 characters. */
      text: L(
        "Nu vrei să riști tot bugetul pe o idee netestată? Facem un MVP (site, platformă web sau aplicație mobilă), îl testezi cu oameni reali și dezvolți ce merge.",
        "Не хотите рисковать всем бюджетом? Сделаем MVP — сайт, веб-платформу или мобильное приложение. Вы проверите его на людях и будете развивать то, что работает.",
        "Don't want to risk your budget on an untested idea? We build an MVP — a website, web platform or mobile app — you test it with real people and grow what works.",
      ),
      points: [
        L("Ideea și publicul", "Идея и аудитория", "The idea and the audience"),
        L("Prima versiune, gata de test", "Первая версия для теста", "A first version, ready to test"),
        L("Feedback și pasul următor", "Обратная связь и следующий шаг", "Feedback and the next step"),
      ],
    },
    cardTitle: L("Idee → MVP → dezvoltare", "Идея → MVP → развитие", "Idea → MVP → development"),
    cardText: L(
      "Începi cu ce trebuie testat, apoi investești doar în ce funcționează.",
      "Начинаете с того, что нужно проверить, и вкладываетесь только в то, что работает.",
      "Start with what needs testing, then invest only in what works.",
    ),
    items: [
      { title: L("Ideea", "Идея", "The idea"), desc: L("Clarificăm problema, publicul și ce vrei să afli din prima versiune.", "Уточняем задачу, аудиторию и то, что вы хотите узнать из первой версии.", "We clarify the problem, the audience and what you want the first version to tell you.") },
      { title: L("MVP concentrat", "Сфокусированный MVP", "Focused MVP"), desc: L("Construim doar ce trebuie pentru un test real. Restul funcțiilor pot aștepta.", "Создаём только то, что нужно для реального теста. Остальные функции подождут.", "We build only what a real test needs. The other features can wait.") },
      { title: L("Pasul următor", "Следующий шаг", "The next step"), desc: L("După feedback, alegem împreună ce merită extins și ce nu.", "После обратной связи вместе решаем, что стоит расширять, а что нет.", "After feedback, we decide together what is worth expanding and what is not.") },
    ],
    steps: [
      L("Stabilim ideea de testat și cine o va folosi primul.", "Определяем, что проверяем и кто воспользуется первым.", "We agree what to test and who will use it first."),
      L("Construim MVP-ul cu funcțiile esențiale.", "Создаём MVP с ключевыми функциями.", "We build the MVP with the essential features."),
      L("Îl lansăm, ascultăm utilizatorii și alegem pasul următor.", "Запускаем, слушаем пользователей и выбираем следующий шаг.", "We launch it, listen to users and choose the next step."),
    ],
  },
  /* Sold as a CAPABILITY, not as a case study: nothing in the portfolio is a shop, so every
     sentence here is written in the offer tense ("construim"), and the hero card draws the
     flow we build instead of naming a project. See `solutionProjectIds` below — the list
     stays empty on purpose. */
  "e-commerce": {
    accent: "#ff7268",
    title: L(
      "Magazin online pentru produse, rapoarte și acces digital",
      "Интернет-магазин для товаров, отчётов и цифрового доступа",
      "Online store for products, reports and digital access",
    ),
    pitch: {
      title: L(
        "Vinde online fără un magazin complicat",
        "Продавайте онлайн без сложного магазина",
        "Sell online without a complicated store",
      ),
      text: L(
        "Vrei să vinzi online fără un magazin complicat și scump? Lansăm întâi oferta, plata și livrarea, apoi extindem catalogul și automatizările după comenzile reale.",
        "Хотите продавать онлайн без сложного и дорогого магазина? Сначала запускаем предложение, оплату и выдачу, потом расширяем каталог по реальным заказам.",
        "Want to sell online without a complex, costly store? We launch the offer, payment and delivery first, then grow the catalogue and automation from real orders.",
      ),
      points: [
        L("Checkout cu plățile potrivite", "Оплата удобными способами", "Checkout with the right payments"),
        L("Livrare automată", "Автоматическая выдача", "Automatic delivery"),
        L("Panou de comenzi și rapoarte", "Панель заказов и отчётов", "Orders and reports panel"),
      ],
    },
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
    title: L(
      "Automatizare procese, CRM și integrări API",
      "Автоматизация процессов, CRM и интеграции API",
      "Process automation, CRM and API integrations",
    ),
    pitch: {
      title: L(
        "Scapă întâi de munca manuală care te costă cel mai mult",
        "Сначала уберите ручную работу, которая стоит дороже всего",
        "First remove the manual work that costs you most",
      ),
      text: L(
        "Pierzi ore cu date copiate, tabele și rapoarte făcute de mână? Automatizăm întâi fluxul care te costă cel mai mult, conectăm CRM-ul și datele, apoi extindem.",
        "Тратите часы на копирование данных, таблицы и ручные отчёты? Сначала автоматизируем самый затратный процесс, связываем CRM и данные, затем расширяем.",
        "Losing hours to copied data, spreadsheets and manual reports? We automate the costliest workflow first, connect your CRM and data, then extend what works.",
      ),
      points: [
        L("Audit de procese", "Аудит процессов", "Process audit"),
        L("Integrări sigure", "Надёжные интеграции", "Secure integrations"),
        L("Dashboard-uri clare", "Понятные дашборды", "Clear dashboards"),
      ],
    },
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
  /* Written against what actually runs: everything described as delivered — chat answered by a person, a decision-tree
     qualifier, a Telegram bot that routes requests — is something a visitor can go and see.
     No sentence here claims a language model shipped, because none did. */
  "asistenti-ia": {
    accent: "#9b72ff",
    title: L(
      "Chat, asistenți și boți Telegram pentru cereri",
      "Чат, ассистенты и Telegram-боты для заявок",
      "Chat, assistants and Telegram bots for requests",
    ),
    pitch: {
      title: L(
        "Nu mai pierde cereri în mesaje",
        "Перестаньте терять заявки в переписке",
        "Stop losing requests in your messages",
      ),
      text: L(
        "Cererile se pierd în mesaje și răspunzi prea târziu? Punem un chat, un asistent sau un bot Telegram unde pierzi clienți și îl ajustăm după conversațiile reale.",
        "Заявки теряются в переписке, а ответ приходит поздно? Ставим чат, ассистента или Telegram-бота там, где уходят клиенты, и настраиваем по реальным диалогам.",
        "Requests get lost in messages and replies come too late? We place a chat, an assistant or a Telegram bot where you lose customers and tune it on real chats.",
      ),
      points: [
        L("Chat live", "Живой чат", "Live chat"),
        L("Cereri structurate automat", "Автоматически структурированные заявки", "Automatically structured requests"),
        L("Bot Telegram pentru echipă", "Telegram-бот для команды", "Telegram bot for the team"),
      ],
    },
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
    title: L(
      "Brand și design UI pentru site-uri și aplicații",
      "Бренд и UI-дизайн для сайтов и приложений",
      "Brand and UI design for websites and apps",
    ),
    pitch: {
      title: L(
        "Clienții trebuie să înțeleagă din prima ce oferi",
        "Клиенты должны с первого взгляда понять, что вы предлагаете",
        "Customers should get your offer at first glance",
      ),
      text: L(
        "Clienții nu înțeleg repede ce oferi? Clarificăm mesajul, proiectăm pagina sau ecranul care contează, urmărim reacția oamenilor și extindem ce funcționează.",
        "Клиенты не сразу понимают, что вы предлагаете? Проясняем посыл, проектируем ключевую страницу или экран, смотрим на реакцию и развиваем то, что работает.",
        "Customers don't quickly see what you offer? We sharpen the message, design the page or screen that matters, watch how people respond and extend what works.",
      ),
      points: [
        L("Poziționare și mesaj", "Позиционирование и посыл", "Positioning and message"),
        L("Design system", "Дизайн-система", "Design system"),
        L("Interfață premium", "Премиальный интерфейс", "Premium interface"),
      ],
    },
    /* No service of its own in the admin's price list: its request opens on the site type
       (lib/directions.ts), and the site's price is not this direction's. */
    noPrice: true,
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

   The modules do not paint these raw: each mixes them into `--panel` so the hue stays
   recognisable per service while the surface stops glowing white on the dark page. */
export type SolutionPalette = { p1: string; p2: string };

export const solutionPalette: Record<string, SolutionPalette> = {
  "produs-digital": { p1: "#dce8ff", p2: "#b9d5ff" },
  "e-commerce": { p1: "#ffe1de", p2: "#ffc1be" },
  "automatizare-api": { p1: "#d9faeb", p2: "#a9edd8" },
  "asistenti-ia": { p1: "#e9ddff", p2: "#cbb8ff" },
  "brand-ui": { p1: "#fff0bf", p2: "#ffd778" },
};

/* ---------------------------------------------------------------------------
   The short name of each direction
   ---------------------------------------------------------------------------
   The /02 pills' own labels, as the client signed them off — one table for the home-page
   selector (`components/sections/Directions.tsx`) and the portfolio's service filter
   (`components/sections/Portfolio.tsx`), so the two never drift apart. The menu's longer
   names (`dir.*` in the message catalog) are for the header, where there is room. */
export const directionTab: Record<string, LocalizedText> = {
  "produs-digital": L("Produs digital", "Цифровой продукт", "Digital product"),
  "e-commerce": L("E-commerce", "E-commerce", "E-commerce"),
  "automatizare-api": L("Automatizare & API", "Автоматизация и API", "Automation & API"),
  "asistenti-ia": L("Asistenți IA & boturi", "ИИ-ассистенты и боты", "AI assistants & bots"),
  "brand-ui": L("Brand & UI", "Бренд и UI", "Brand & UI"),
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
/* A project the admin adds is in no direction until its id is written above: /portofoliu then
   shows it under "Toate" only, and no service page lists it. */

/* ---------------------------------------------------------------------------
   Which kind of request a project starts
   ---------------------------------------------------------------------------
   "Vreau un proiect similar" on /portofoliu opens the request dialog on the estimator
   type of THAT kind of work — an app like IQ Arena starts on "Aplicație mobilă", not on the
   estimator's first type and its price. Stated by id, like the table above, never parsed
   from the tag. A project not listed here starts where the dialog always starts. */
export const projectRequestType: Record<string, EstimatorTypeId> = {
  "iq-arena": "mobile",
  flirt: "mobile",
  docusafe: "crm",
  "crowe-portal": "crm",
  statistic: "crm",
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

/* ---------------------------------------------------------------------------
   The price a direction starts at
   ---------------------------------------------------------------------------
   The owner's own figure, never one written here: the admin's price for the service the
   request dialog opens on for this direction — direction → estimator type
   (`SERVICE_TO_ESTIMATOR_TYPE`) → service (`SERVICE_FOR_TYPE`) — resolved exactly as the
   dialog's "PROPUNEREA TA" resolves it (components/sections/Estimator.tsx). So a card can never
   quote a number the dialog then contradicts. The admin's text already reads "de la 150€" /
   "от 150€" / "from 150€", so it is shown as written. */

/**
 * The starting price to show for a direction, or "" when there is none to show: a direction
 * marked `noPrice`, a service the admin left empty or on the seed's "..." placeholder, or an
 * unknown slug. Where the dialog would fall back to its built-in figure, this shows nothing.
 *
 * Generic over the service shape and given the caller's `useLoc()` resolver, so this module
 * stays free of a client-only import; the caller passes `useSiteContent().services`.
 */
export function directionPrice(
  slug: string,
  services: readonly { id: string; price: MaybeLocalized }[],
  resolve: (value: MaybeLocalized | undefined) => string,
): string {
  const sol = solutions[slug];
  if (!sol || sol.noPrice) return "";
  const type = SERVICE_TO_ESTIMATOR_TYPE[slug];
  if (!isEstimatorTypeId(type)) return "";
  const price = resolve(services.find((s) => s.id === SERVICE_FOR_TYPE[type])?.price).trim();
  // "..." is PRICE_PLACEHOLDER, spelled out: lib/content.ts calls into a client module as it
  // loads, and the service route's server metadata imports this file.
  return price.startsWith("...") ? "" : price;
}

/** Shared UI copy for the direction pages. */
export const solUI = {
  back: L("← Înapoi la direcții", "← К направлениям", "← Back to directions"),
  stepsTitle: L("Cum lucrăm", "Как мы работаем", "How we work"),
  talk: L("Discută cu echipa", "Обсудить с командой", "Talk to the team"),
  /* --- action bar, straight under the hero --- */
  /* The same words as the home page's "Cere ofertă" (Directions.tsx), which opens the same
     request. The key keeps its old name: the E2E helpers import it. */
  actionTalk: L("Cere ofertă", "Оставить заявку", "Get a quote"),
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
  bottomTitle: L("Gata să faci primul pas?", "Готовы сделать первый шаг?", "Ready to take the first step?"),
  start: L("Începe cererea", "Начать заявку", "Start a request"),
};
