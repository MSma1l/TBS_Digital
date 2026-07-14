import type { Locale } from "@/lib/i18n/locales";
import type { LegalContent } from "./LegalDoc";

/**
 * Privacy Policy — full text in RO / RU / EN.
 *
 * Jurisdiction: Republic of Moldova — Legea nr. 133 din 08.07.2011 privind protecția
 * datelor cu caracter personal, aligned with GDPR principles. Supervisory authority:
 * Centrul Național pentru Protecția Datelor cu Caracter Personal (CNPDCP), datepersonale.md.
 * Controller: TBS Digital. Data-subject contact: office@crowe-tm.md.
 *
 * Kept out of the i18n message catalog on purpose (long-form legal prose, owned here).
 */
export const privacyContent: Record<Locale, LegalContent> = {
  ro: {
    label: "POLITICA DE CONFIDENȚIALITATE",
    title: "Politica de confidențialitate",
    updated: "Ultima actualizare: 14 iulie 2026",
    intro:
      "Această politică explică ce date cu caracter personal prelucrează TBS Digital atunci când folosești acest site, în ce scopuri, pe ce temei juridic și ce drepturi ai. Prelucrarea se face în conformitate cu Legea nr. 133 din 08.07.2011 privind protecția datelor cu caracter personal a Republicii Moldova și în acord cu principiile Regulamentului General privind Protecția Datelor (GDPR).",
    sections: [
      {
        heading: "Cine suntem",
        blocks: [
          {
            type: "p",
            text: "Operatorul de date cu caracter personal este TBS Digital („noi”, „operatorul”) — brandul sub care oferim servicii de dezvoltare software, aplicații mobile și automatizări. Pentru orice chestiune legată de protecția datelor ne poți contacta la office@crowe-tm.md [adresă de contact opțională].",
          },
        ],
      },
      {
        heading: "Ce date colectăm",
        blocks: [
          {
            type: "p",
            text: "Colectăm doar datele de care avem nevoie pentru a răspunde solicitărilor tale. Concret:",
          },
          {
            type: "list",
            items: [
              "Date din formularul de contact / estimare: nume și prenume, adresă de email, număr de telefon (opțional), mesajul tău, tipul de proiect selectat și estimarea de preț generată automat.",
              "Date tehnice de analiză: dacă îți dai acordul, pixelul nostru de analiză (statistica.tbs.md) colectează date agregate despre vizită — pagini accesate, tip de dispozitiv și browser, sursa de proveniență. Este o soluție de analiză proprie (first-party), nu publicitate.",
              "Date de sesiune ale panoului de administrare: accesul la panoul intern folosește un token stocat local în browser (localStorage), nu un cookie de urmărire; nu privește vizitatorii obișnuiți ai site-ului.",
            ],
          },
        ],
      },
      {
        heading: "În ce scopuri folosim datele",
        blocks: [
          {
            type: "list",
            items: [
              "Pentru a-ți răspunde la solicitare și a comunica cu tine pe marginea proiectului.",
              "Pentru a pregăti o ofertă sau o estimare de preț personalizată.",
              "Pentru a înțelege, în formă agregată, cum este folosit site-ul și a-l îmbunătăți (doar cu acordul tău).",
            ],
          },
        ],
      },
      {
        heading: "Temeiul juridic",
        blocks: [
          {
            type: "list",
            items: [
              "Consimțământul tău — atunci când trimiți formularul de contact și când accepți cookie-urile de analiză. Îți poți retrage consimțământul oricând.",
              "Interesul legitim — de a răspunde solicitărilor primite, de a comunica cu potențialii clienți și de a asigura securitatea și funcționarea site-ului.",
            ],
          },
        ],
      },
      {
        heading: "Cât timp păstrăm datele",
        blocks: [
          {
            type: "p",
            text: "Păstrăm datele din formular atât timp cât este necesar pentru a soluționa solicitarea ta și pentru o perioadă rezonabilă ulterioară, în care ar putea continua discuțiile comerciale. Când datele nu mai sunt necesare, le ștergem sau le anonimizăm. Datele de analiză agregate se păstrează pe durata necesară statisticilor și nu te identifică individual.",
          },
        ],
      },
      {
        heading: "Cui divulgăm datele",
        blocks: [
          {
            type: "p",
            text: "Nu vindem și nu închiriem datele tale. Le divulgăm doar în măsura necesară pentru a-ți răspunde:",
          },
          {
            type: "list",
            items: [
              "Telegram — la trimiterea formularului, primim o notificare cu detaliile solicitării prin serviciul de mesagerie Telegram, pe care îl folosim ca împuternicit pentru notificări interne.",
              "Furnizorii de infrastructură (găzduire) care operează serverele pe care rulează site-ul și în care sunt stocate datele, sub obligații de confidențialitate.",
              "Autorități publice — doar dacă legea ne obligă.",
            ],
          },
        ],
      },
      {
        heading: "Cookie-uri și tehnologii similare",
        blocks: [
          {
            type: "p",
            text: "Folosim cookie-uri și stocare locală esențiale pentru funcționarea site-ului și, cu acordul tău, un pixel de analiză. Detaliile complete, categoriile și modul de gestionare a consimțământului sunt descrise în Politica de cookie (/cookies).",
          },
        ],
      },
      {
        heading: "Transferuri în afara țării",
        blocks: [
          {
            type: "p",
            text: "Unii dintre furnizorii pe care îi folosim — de exemplu Telegram, pentru notificări — pot procesa date pe servere aflate în afara Republicii Moldova. În astfel de cazuri ne asigurăm că transferul beneficiază de un nivel adecvat de protecție, conform Legii nr. 133 și principiilor GDPR.",
          },
        ],
      },
      {
        heading: "Drepturile tale",
        blocks: [
          {
            type: "p",
            text: "În calitate de persoană vizată, ai următoarele drepturi:",
          },
          {
            type: "list",
            items: [
              "Dreptul de acces la datele tale și la informații despre modul în care le prelucrăm.",
              "Dreptul la rectificarea datelor inexacte sau incomplete.",
              "Dreptul la ștergerea datelor („dreptul de a fi uitat”).",
              "Dreptul la restricționarea prelucrării.",
              "Dreptul de a te opune prelucrării întemeiate pe interes legitim.",
              "Dreptul la portabilitatea datelor.",
              "Dreptul de a-ți retrage consimțământul oricând, fără a afecta legalitatea prelucrării anterioare.",
              "Dreptul de a depune o plângere la Centrul Național pentru Protecția Datelor cu Caracter Personal (CNPDCP), datepersonale.md.",
            ],
          },
        ],
      },
      {
        heading: "Cum îți exerciți drepturile",
        blocks: [
          {
            type: "p",
            text: "Ne poți scrie oricând la office@crowe-tm.md pentru a-ți exercita oricare dintre drepturile de mai sus. Îți răspundem în termenele prevăzute de lege. Pentru a-ți proteja datele, este posibil să îți cerem informații suplimentare care să confirme identitatea.",
          },
        ],
      },
      {
        heading: "Securitatea datelor",
        blocks: [
          {
            type: "p",
            text: "Aplicăm măsuri tehnice și organizatorice rezonabile pentru a proteja datele împotriva accesului neautorizat, pierderii sau divulgării — printre care transmiterea criptată (HTTPS), o politică strictă de securitate a conținutului și acces restricționat la datele stocate.",
          },
        ],
      },
      {
        heading: "Minori",
        blocks: [
          {
            type: "p",
            text: "Site-ul și serviciile noastre se adresează companiilor și persoanelor adulte. Nu colectăm cu bună știință date de la minori.",
          },
        ],
      },
      {
        heading: "Modificări ale acestei politici",
        blocks: [
          {
            type: "p",
            text: "Putem actualiza această politică pentru a reflecta modificări ale serviciilor sau ale legislației. Vom publica versiunea revizuită pe această pagină, cu data actualizării. Te încurajăm să o consulți periodic.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: "Operator: TBS Digital. Email pentru protecția datelor: office@crowe-tm.md. Autoritatea de supraveghere: Centrul Național pentru Protecția Datelor cu Caracter Personal (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },

  ru: {
    label: "ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ",
    title: "Политика конфиденциальности",
    updated: "Последнее обновление: 14 июля 2026 г.",
    intro:
      "Эта политика объясняет, какие персональные данные обрабатывает TBS Digital, когда вы пользуетесь этим сайтом, с какими целями, на каком правовом основании и какие права вы имеете. Обработка осуществляется в соответствии с Законом № 133 от 08.07.2011 о защите персональных данных Республики Молдова и в соответствии с принципами Общего регламента по защите данных (GDPR).",
    sections: [
      {
        heading: "Кто мы",
        blocks: [
          {
            type: "p",
            text: "Оператором персональных данных является TBS Digital («мы», «оператор») — бренд, под которым мы предоставляем услуги разработки программного обеспечения, мобильных приложений и автоматизации. По любым вопросам, связанным с защитой данных, вы можете написать нам на office@crowe-tm.md [контактный адрес — по желанию].",
          },
        ],
      },
      {
        heading: "Какие данные мы собираем",
        blocks: [
          {
            type: "p",
            text: "Мы собираем только те данные, которые необходимы для ответа на ваши обращения. А именно:",
          },
          {
            type: "list",
            items: [
              "Данные из формы контакта / расчёта стоимости: имя и фамилия, адрес электронной почты, номер телефона (необязательно), ваше сообщение, выбранный тип проекта и автоматически рассчитанная оценка стоимости.",
              "Технические аналитические данные: с вашего согласия наш аналитический пиксель (statistica.tbs.md) собирает обобщённые данные о визите — посещённые страницы, тип устройства и браузера, источник перехода. Это собственная (first-party) аналитика, а не реклама.",
              "Данные сессии панели администратора: доступ к внутренней панели использует токен, хранящийся локально в браузере (localStorage), а не отслеживающий cookie; это не касается обычных посетителей сайта.",
            ],
          },
        ],
      },
      {
        heading: "С какими целями мы используем данные",
        blocks: [
          {
            type: "list",
            items: [
              "Чтобы ответить на ваше обращение и общаться с вами по вашему проекту.",
              "Чтобы подготовить персональное предложение или оценку стоимости.",
              "Чтобы в обобщённом виде понимать, как используется сайт, и улучшать его (только с вашего согласия).",
            ],
          },
        ],
      },
      {
        heading: "Правовое основание",
        blocks: [
          {
            type: "list",
            items: [
              "Ваше согласие — когда вы отправляете форму контакта и когда принимаете аналитические cookie. Вы можете отозвать согласие в любой момент.",
              "Законный интерес — отвечать на поступающие обращения, общаться с потенциальными клиентами и обеспечивать безопасность и работу сайта.",
            ],
          },
        ],
      },
      {
        heading: "Как долго мы храним данные",
        blocks: [
          {
            type: "p",
            text: "Мы храним данные из формы столько, сколько необходимо для рассмотрения вашего обращения, а также в течение разумного последующего периода, пока могут продолжаться деловые переговоры. Когда данные больше не нужны, мы их удаляем или обезличиваем. Обобщённые аналитические данные хранятся столько, сколько необходимо для статистики, и не идентифицируют вас лично.",
          },
        ],
      },
      {
        heading: "Кому мы раскрываем данные",
        blocks: [
          {
            type: "p",
            text: "Мы не продаём и не сдаём в аренду ваши данные. Мы раскрываем их только в объёме, необходимом для ответа вам:",
          },
          {
            type: "list",
            items: [
              "Telegram — при отправке формы мы получаем уведомление с деталями обращения через мессенджер Telegram, который выступает обработчиком для внутренних уведомлений.",
              "Поставщики инфраструктуры (хостинг), обслуживающие серверы, на которых работает сайт и хранятся данные, под обязательствами конфиденциальности.",
              "Государственные органы — только если это требуется по закону.",
            ],
          },
        ],
      },
      {
        heading: "Cookie и аналогичные технологии",
        blocks: [
          {
            type: "p",
            text: "Мы используем cookie и локальное хранилище, необходимые для работы сайта, и, с вашего согласия, аналитический пиксель. Полные сведения, категории и порядок управления согласием описаны в Политике использования cookie (/cookies).",
          },
        ],
      },
      {
        heading: "Передача за пределы страны",
        blocks: [
          {
            type: "p",
            text: "Некоторые из используемых нами поставщиков — например Telegram для уведомлений — могут обрабатывать данные на серверах, расположенных за пределами Республики Молдова. В таких случаях мы обеспечиваем адекватный уровень защиты передачи в соответствии с Законом № 133 и принципами GDPR.",
          },
        ],
      },
      {
        heading: "Ваши права",
        blocks: [
          {
            type: "p",
            text: "Как субъект персональных данных вы имеете следующие права:",
          },
          {
            type: "list",
            items: [
              "Право на доступ к вашим данным и к информации о том, как мы их обрабатываем.",
              "Право на исправление неточных или неполных данных.",
              "Право на удаление данных («право быть забытым»).",
              "Право на ограничение обработки.",
              "Право возражать против обработки, основанной на законном интересе.",
              "Право на переносимость данных.",
              "Право отозвать согласие в любой момент, не затрагивая законность предшествующей обработки.",
              "Право подать жалобу в Национальный центр по защите персональных данных (CNPDCP), datepersonale.md.",
            ],
          },
        ],
      },
      {
        heading: "Как реализовать свои права",
        blocks: [
          {
            type: "p",
            text: "Вы можете в любой момент написать нам на office@crowe-tm.md, чтобы воспользоваться любым из перечисленных прав. Мы ответим в установленные законом сроки. В целях защиты ваших данных мы можем запросить дополнительную информацию для подтверждения личности.",
          },
        ],
      },
      {
        heading: "Безопасность данных",
        blocks: [
          {
            type: "p",
            text: "Мы применяем разумные технические и организационные меры для защиты данных от несанкционированного доступа, потери или раскрытия — в том числе шифрованную передачу (HTTPS), строгую политику безопасности контента и ограниченный доступ к хранимым данным.",
          },
        ],
      },
      {
        heading: "Несовершеннолетние",
        blocks: [
          {
            type: "p",
            text: "Наш сайт и услуги предназначены для компаний и совершеннолетних лиц. Мы сознательно не собираем данные несовершеннолетних.",
          },
        ],
      },
      {
        heading: "Изменения этой политики",
        blocks: [
          {
            type: "p",
            text: "Мы можем обновлять эту политику, чтобы отразить изменения в услугах или законодательстве. Пересмотренную версию мы публикуем на этой странице с указанием даты обновления. Рекомендуем периодически с ней знакомиться.",
          },
        ],
      },
      {
        heading: "Контакты",
        blocks: [
          {
            type: "p",
            text: "Оператор: TBS Digital. Электронная почта по вопросам защиты данных: office@crowe-tm.md. Надзорный орган: Национальный центр по защите персональных данных (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },

  en: {
    label: "PRIVACY POLICY",
    title: "Privacy Policy",
    updated: "Last updated: 14 July 2026",
    intro:
      "This policy explains what personal data TBS Digital processes when you use this website, for what purposes, on what legal basis, and what rights you have. Processing is carried out in accordance with Law no. 133 of 08.07.2011 on the protection of personal data of the Republic of Moldova and in line with the principles of the General Data Protection Regulation (GDPR).",
    sections: [
      {
        heading: "Who we are",
        blocks: [
          {
            type: "p",
            text: "The controller of personal data is TBS Digital (“we”, “the controller”) — the brand under which we provide software development, mobile app, and automation services. For any matter concerning data protection you can reach us at office@crowe-tm.md [optional contact address].",
          },
        ],
      },
      {
        heading: "What data we collect",
        blocks: [
          {
            type: "p",
            text: "We collect only the data we need in order to respond to your requests. Specifically:",
          },
          {
            type: "list",
            items: [
              "Contact / estimate form data: name, email address, phone number (optional), your message, the selected project type, and the automatically generated price estimate.",
              "Technical analytics data: if you consent, our analytics pixel (statistica.tbs.md) collects aggregated data about your visit — pages viewed, device and browser type, and referral source. This is first-party analytics, not advertising.",
              "Admin panel session data: access to the internal panel uses a token stored locally in the browser (localStorage), not a tracking cookie; it does not concern ordinary site visitors.",
            ],
          },
        ],
      },
      {
        heading: "Why we use the data",
        blocks: [
          {
            type: "list",
            items: [
              "To respond to your request and communicate with you about your project.",
              "To prepare a personalised offer or price estimate.",
              "To understand, in aggregate form, how the site is used and to improve it (only with your consent).",
            ],
          },
        ],
      },
      {
        heading: "Legal basis",
        blocks: [
          {
            type: "list",
            items: [
              "Your consent — when you submit the contact form and when you accept analytics cookies. You can withdraw your consent at any time.",
              "Legitimate interest — to respond to incoming requests, communicate with prospective clients, and keep the site secure and operational.",
            ],
          },
        ],
      },
      {
        heading: "How long we keep the data",
        blocks: [
          {
            type: "p",
            text: "We keep form data for as long as necessary to handle your request and for a reasonable period afterwards during which business discussions may continue. When the data is no longer needed, we delete or anonymise it. Aggregated analytics data is kept for as long as needed for statistics and does not identify you individually.",
          },
        ],
      },
      {
        heading: "Who we share data with",
        blocks: [
          {
            type: "p",
            text: "We do not sell or rent your data. We disclose it only to the extent needed to respond to you:",
          },
          {
            type: "list",
            items: [
              "Telegram — when you submit the form, we receive a notification with the request details through the Telegram messaging service, which we use as a processor for internal notifications.",
              "Infrastructure (hosting) providers that operate the servers on which the site runs and the data is stored, under confidentiality obligations.",
              "Public authorities — only where the law requires it.",
            ],
          },
        ],
      },
      {
        heading: "Cookies and similar technologies",
        blocks: [
          {
            type: "p",
            text: "We use cookies and local storage that are essential for the site to work and, with your consent, an analytics pixel. Full details, categories, and how to manage your consent are described in the Cookie Policy (/cookies).",
          },
        ],
      },
      {
        heading: "Transfers outside the country",
        blocks: [
          {
            type: "p",
            text: "Some of the providers we use — for example Telegram, for notifications — may process data on servers located outside the Republic of Moldova. In such cases we ensure the transfer benefits from an adequate level of protection, in line with Law no. 133 and GDPR principles.",
          },
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          {
            type: "p",
            text: "As a data subject, you have the following rights:",
          },
          {
            type: "list",
            items: [
              "The right to access your data and information about how we process it.",
              "The right to rectify inaccurate or incomplete data.",
              "The right to erasure (“the right to be forgotten”).",
              "The right to restrict processing.",
              "The right to object to processing based on legitimate interest.",
              "The right to data portability.",
              "The right to withdraw consent at any time, without affecting the lawfulness of prior processing.",
              "The right to lodge a complaint with the National Center for Personal Data Protection (CNPDCP), datepersonale.md.",
            ],
          },
        ],
      },
      {
        heading: "How to exercise your rights",
        blocks: [
          {
            type: "p",
            text: "You can write to us at any time at office@crowe-tm.md to exercise any of the rights above. We will respond within the timeframes set by law. To protect your data, we may ask for additional information to confirm your identity.",
          },
        ],
      },
      {
        heading: "Data security",
        blocks: [
          {
            type: "p",
            text: "We apply reasonable technical and organisational measures to protect data against unauthorised access, loss, or disclosure — including encrypted transmission (HTTPS), a strict content security policy, and restricted access to stored data.",
          },
        ],
      },
      {
        heading: "Minors",
        blocks: [
          {
            type: "p",
            text: "Our site and services are aimed at companies and adults. We do not knowingly collect data from minors.",
          },
        ],
      },
      {
        heading: "Changes to this policy",
        blocks: [
          {
            type: "p",
            text: "We may update this policy to reflect changes in our services or in the law. We will publish the revised version on this page, with the update date. We encourage you to review it periodically.",
          },
        ],
      },
      {
        heading: "Contact",
        blocks: [
          {
            type: "p",
            text: "Controller: TBS Digital. Data-protection email: office@crowe-tm.md. Supervisory authority: National Center for Personal Data Protection (CNPDCP) — datepersonale.md.",
          },
        ],
      },
    ],
  },
};
