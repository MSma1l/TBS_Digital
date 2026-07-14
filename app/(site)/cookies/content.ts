import type { Locale } from "@/lib/i18n/locales";
import type { LegalContent } from "../confidentialitate/LegalDoc";

/**
 * Cookie Policy — full text in RO / RU / EN.
 *
 * Describes exactly what this site stores: the essential language cookie (tbs_locale), the
 * consent-record cookie (tbs_cookie_consent), the admin localStorage token, and the
 * consent-gated first-party analytics pixel (statistica.tbs.md). No third-party marketing
 * cookies. Controller: TBS Digital · office@crowe-tm.md.
 */
export const cookieContent: Record<Locale, LegalContent> = {
  ro: {
    label: "POLITICA DE COOKIE",
    title: "Politica de cookie",
    updated: "Ultima actualizare: 14 iulie 2026",
    intro:
      "Această politică explică ce cookie-uri și tehnologii de stocare locală folosește site-ul TBS Digital, în ce scop și cum îți poți gestiona alegerile. O citești împreună cu Politica de confidențialitate (/confidentialitate).",
    sections: [
      {
        heading: "Ce sunt cookie-urile",
        blocks: [
          {
            type: "p",
            text: "Cookie-urile sunt fișiere text mici pe care un site le salvează în browserul tău pentru a-și aminti anumite informații între pagini sau vizite. Tehnologii similare, precum stocarea locală a browserului (localStorage), îndeplinesc funcții asemănătoare. Le folosim cumpătat și doar cele strict necesare fără acordul tău.",
          },
        ],
      },
      {
        heading: "Cum folosim cookie-urile",
        blocks: [
          {
            type: "p",
            text: "Le grupăm în două categorii:",
          },
          {
            type: "list",
            items: [
              "Esențiale — necesare pentru ca site-ul să funcționeze și să îți rețină preferințele de bază. Nu au nevoie de consimțământ.",
              "De analiză (opționale) — ne ajută să înțelegem, în formă agregată, cum este folosit site-ul. Se încarcă doar după ce le accepți.",
            ],
          },
        ],
      },
      {
        heading: "Cookie-urile pe care le folosim",
        blocks: [
          {
            type: "list",
            items: [
              "tbs_locale (esențial) — reține limba aleasă (RO / RU / EN) ca să regăsești site-ul în limba ta. Durată: până la 1 an.",
              "tbs_cookie_consent (esențial) — reține alegerea ta privind cookie-urile, ca să nu te întrebăm la fiecare vizită. Durată: 6 luni.",
              "Token de administrare (esențial, stocare locală) — folosit doar în panoul intern de administrare, păstrat în localStorage-ul browserului; nu urmărește vizitatorii site-ului.",
              "Pixel de analiză statistica.tbs.md (opțional, de analiză) — soluție de analiză proprie (first-party) care se încarcă doar cu acordul tău și colectează date agregate despre vizită. Fără acord, nu se încarcă și nu trimite nicio cerere.",
            ],
          },
        ],
      },
      {
        heading: "Gestionarea consimțământului",
        blocks: [
          {
            type: "p",
            text: "La prima vizită îți arătăm o bară de consimțământ prin care poți alege „Accept” (permiți analiza) sau „Doar esențiale” (refuzi analiza). Până când alegi, nu se încarcă niciun cookie de analiză.",
          },
          {
            type: "p",
            text: "Îți poți schimba oricând alegerea ștergând cookie-urile site-ului din setările browserului — la următoarea vizită bara va apărea din nou. Din setările browserului poți, de asemenea, bloca sau șterge complet cookie-urile; reține că blocarea celor esențiale poate afecta funcționarea site-ului.",
          },
        ],
      },
      {
        heading: "Cookie-uri de la terți",
        blocks: [
          {
            type: "p",
            text: "Nu folosim cookie-uri de publicitate sau de urmărire de la terți. Analiza noastră este găzduită pe propriul domeniu (statistica.tbs.md). Atunci când trimiți formularul de contact, primim o notificare prin Telegram — acesta nu plasează cookie-uri pe site-ul nostru.",
          },
        ],
      },
      {
        heading: "Modificări",
        blocks: [
          {
            type: "p",
            text: "Putem actualiza această politică atunci când se schimbă tehnologiile pe care le folosim. Vom publica versiunea revizuită pe această pagină, cu data actualizării.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: "Pentru întrebări despre cookie-uri sau despre datele tale, scrie-ne la office@crowe-tm.md. Operator: TBS Digital. Autoritatea de supraveghere: Centrul Național pentru Protecția Datelor cu Caracter Personal (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },

  ru: {
    label: "ПОЛИТИКА COOKIE",
    title: "Политика использования cookie",
    updated: "Последнее обновление: 14 июля 2026 г.",
    intro:
      "Эта политика объясняет, какие cookie и технологии локального хранения использует сайт TBS Digital, с какой целью и как вы можете управлять своим выбором. Её следует читать вместе с Политикой конфиденциальности (/confidentialitate).",
    sections: [
      {
        heading: "Что такое cookie",
        blocks: [
          {
            type: "p",
            text: "Cookie — это небольшие текстовые файлы, которые сайт сохраняет в вашем браузере, чтобы запоминать определённую информацию между страницами или визитами. Схожие технологии, например локальное хранилище браузера (localStorage), выполняют аналогичные функции. Мы используем их умеренно, и без вашего согласия — только строго необходимые.",
          },
        ],
      },
      {
        heading: "Как мы используем cookie",
        blocks: [
          {
            type: "p",
            text: "Мы делим их на две категории:",
          },
          {
            type: "list",
            items: [
              "Необходимые — нужны, чтобы сайт работал и запоминал ваши базовые предпочтения. Согласия не требуют.",
              "Аналитические (необязательные) — помогают нам понимать в обобщённом виде, как используется сайт. Загружаются только после того, как вы их примете.",
            ],
          },
        ],
      },
      {
        heading: "Какие cookie мы используем",
        blocks: [
          {
            type: "list",
            items: [
              "tbs_locale (необходимый) — запоминает выбранный язык (RO / RU / EN), чтобы вы видели сайт на своём языке. Срок: до 1 года.",
              "tbs_cookie_consent (необходимый) — запоминает ваш выбор относительно cookie, чтобы не спрашивать при каждом визите. Срок: 6 месяцев.",
              "Токен администратора (необходимый, локальное хранилище) — используется только во внутренней панели администрирования, хранится в localStorage браузера; не отслеживает посетителей сайта.",
              "Аналитический пиксель statistica.tbs.md (необязательный, аналитический) — собственное (first-party) аналитическое решение, которое загружается только с вашего согласия и собирает обобщённые данные о визите. Без согласия он не загружается и не отправляет ни одного запроса.",
            ],
          },
        ],
      },
      {
        heading: "Управление согласием",
        blocks: [
          {
            type: "p",
            text: "При первом визите мы показываем панель согласия, в которой вы можете выбрать «Принять» (разрешить аналитику) или «Только необходимые» (отказаться от аналитики). Пока вы не выберете, ни один аналитический cookie не загружается.",
          },
          {
            type: "p",
            text: "Вы можете в любой момент изменить свой выбор, удалив cookie сайта в настройках браузера — при следующем визите панель появится снова. В настройках браузера вы также можете полностью блокировать или удалять cookie; учтите, что блокировка необходимых cookie может нарушить работу сайта.",
          },
        ],
      },
      {
        heading: "Сторонние cookie",
        blocks: [
          {
            type: "p",
            text: "Мы не используем рекламные или отслеживающие cookie сторонних сервисов. Наша аналитика размещена на собственном домене (statistica.tbs.md). Когда вы отправляете форму контакта, мы получаем уведомление через Telegram — он не размещает cookie на нашем сайте.",
          },
        ],
      },
      {
        heading: "Изменения",
        blocks: [
          {
            type: "p",
            text: "Мы можем обновлять эту политику при изменении используемых технологий. Пересмотренную версию мы публикуем на этой странице с указанием даты обновления.",
          },
        ],
      },
      {
        heading: "Контакты",
        blocks: [
          {
            type: "p",
            text: "По вопросам о cookie или о ваших данных пишите нам на office@crowe-tm.md. Оператор: TBS Digital. Надзорный орган: Национальный центр по защите персональных данных (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },

  en: {
    label: "COOKIE POLICY",
    title: "Cookie Policy",
    updated: "Last updated: 14 July 2026",
    intro:
      "This policy explains which cookies and local-storage technologies the TBS Digital website uses, for what purpose, and how you can manage your choices. Read it together with the Privacy Policy (/confidentialitate).",
    sections: [
      {
        heading: "What cookies are",
        blocks: [
          {
            type: "p",
            text: "Cookies are small text files a website stores in your browser to remember certain information between pages or visits. Similar technologies, such as browser local storage (localStorage), serve comparable functions. We use them sparingly, and without your consent we set only the strictly necessary ones.",
          },
        ],
      },
      {
        heading: "How we use cookies",
        blocks: [
          {
            type: "p",
            text: "We group them into two categories:",
          },
          {
            type: "list",
            items: [
              "Essential — required for the site to function and to remember your basic preferences. These need no consent.",
              "Analytics (optional) — help us understand, in aggregate form, how the site is used. They load only after you accept them.",
            ],
          },
        ],
      },
      {
        heading: "The cookies we use",
        blocks: [
          {
            type: "list",
            items: [
              "tbs_locale (essential) — remembers your chosen language (RO / RU / EN) so you see the site in your language. Duration: up to 1 year.",
              "tbs_cookie_consent (essential) — remembers your cookie choice so we don't ask on every visit. Duration: 6 months.",
              "Admin token (essential, local storage) — used only in the internal admin panel, kept in the browser's localStorage; it does not track site visitors.",
              "statistica.tbs.md analytics pixel (optional, analytics) — a first-party analytics solution that loads only with your consent and collects aggregated data about your visit. Without consent it does not load and sends no request.",
            ],
          },
        ],
      },
      {
        heading: "Managing your consent",
        blocks: [
          {
            type: "p",
            text: "On your first visit we show a consent bar where you can choose “Accept” (allow analytics) or “Essential only” (decline analytics). Until you choose, no analytics cookie loads.",
          },
          {
            type: "p",
            text: "You can change your choice at any time by clearing the site's cookies in your browser settings — the bar will appear again on your next visit. From your browser settings you can also block or delete cookies entirely; note that blocking essential cookies may affect how the site works.",
          },
        ],
      },
      {
        heading: "Third-party cookies",
        blocks: [
          {
            type: "p",
            text: "We do not use third-party advertising or tracking cookies. Our analytics is hosted on our own domain (statistica.tbs.md). When you submit the contact form, we receive a notification through Telegram — it does not place cookies on our site.",
          },
        ],
      },
      {
        heading: "Changes",
        blocks: [
          {
            type: "p",
            text: "We may update this policy when the technologies we use change. We will publish the revised version on this page, with the update date.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: "For questions about cookies or your data, write to us at office@crowe-tm.md. Controller: TBS Digital. Supervisory authority: National Center for Personal Data Protection (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },
};
