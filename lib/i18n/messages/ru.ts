/**
 * Russian message catalog — mirrors the exact keys of `ro.ts` (the source of truth).
 *
 * `\n` marks an intentional line break the component renders as a <br>. Placeholders like
 * `{n}`, `{name}`, `{price}` are filled in by the component — keep them intact.
 */
import type { MessageKey } from "./ro";

export const ru: Record<MessageKey, string> = {
  // --- SEO / document ---
  "meta.title": "TBS Digital — софт, приложения и автоматизация на ИИ",
  "meta.description":
    "Цифровизируем бизнес: индивидуальный софт, мобильные приложения, автоматизация на ИИ, CRM, SaaS и платформы — от стратегии до запуска.",

  // --- Hero ---
  "hero.badge": "ОТ КОНСАЛТИНГА ДО ЦИФРОВИЗАЦИИ",
  "hero.kicker": "Будущее не минимально.\nОно построено.",
  "hero.lead":
    "Индивидуальный софт, мобильные приложения, автоматизация на ИИ, CRM, SaaS и платформы, которые растят ваш бизнес — от стратегии до запуска.",
  "hero.cta.primary": "Рассчитать цену ↗",
  "hero.cta.secondary": "Смотреть услуги",
  "hero.scrollHint": "ЛИСТАЙ — СИСТЕМА АКТИВИРУЕТСЯ ↓",

  // --- Principles (/02) ---
  "principles.label": "НАШИ ПРИНЦИПЫ",
  "principles.0.title": "Сначала\nстратегия",
  "principles.0.desc": "Разбираемся в бизнесе до первой строки кода.",
  "principles.1.title": "Связанные\nсистемы",
  "principles.1.desc": "Данные, модули, автоматизация — всё в одном контуре.",
  "principles.2.title": "Цифровая\nэстетика",
  "principles.2.desc": "Понятные, быстрые и приятные в работе интерфейсы.",
  "principles.3.title": "Реальный\nрезультат",
  "principles.3.desc": "Меньше времени и затрат, больше выручки.",
  "principles.4.title": "ИИ\nв деле",
  "principles.4.desc": "Искусственный интеллект там, где он реально решает.",

  // --- Services (/03) ---
  "services.label": "ЧТО МЫ УМЕЕМ",
  "services.title": "Услуги\nцифровизации",
  "services.lead":
    "Выберите одну услугу или соберите несколько в готовый продукт.",
  "services.swipeHint": "← ЛИСТАЙ ↔ {n} УСЛУГ →",
  "services.card.cta": "Рассчитать цену →",
  "services.card.estimateAria": "Рассчитать цену для «{name}»",
  "services.landing.name": "Лендинг",
  "services.landing.desc":
    "Быстрые страницы, которые превращают посетителей в клиентов.",
  "services.site.name": "Сайт / презентация",
  "services.site.desc":
    "Полноценное присутствие онлайн — быстрое и оптимизированное под SEO.",
  "services.shop.name": "Интернет-магазин",
  "services.shop.desc":
    "eCommerce с оплатой, складом и панелью администратора.",
  "services.mobile.name": "Мобильное приложение",
  "services.mobile.desc":
    "Приложения для iOS и Android — нативные или кросс-платформенные.",
  "services.crm.name": "CRM на заказ",
  "services.crm.desc":
    "Клиенты, лиды и продажи — всё в одном месте.",
  "services.saas.name": "SaaS-платформа",
  "services.saas.desc":
    "Масштабируемый софт с подписками и пользователями.",
  "services.automation.name": "Автоматизация процессов",
  "services.automation.desc":
    "Убираем рутину и ручной труд через автоматические сценарии.",
  "services.dashboard.name": "Дашборды и отчёты",
  "services.dashboard.desc":
    "Все важные данные — наглядно и в один клик.",
  "services.bot.name": "Telegram-бот",
  "services.bot.desc":
    "Автоматические ассистенты для поддержки, продаж и уведомлений.",
  "services.ai.name": "Автоматизация с ИИ",
  "services.ai.desc": "",
  "services.custom.name": "Индивидуальная разработка",
  "services.custom.desc":
    "Софт под конкретные задачи и процессы вашего бизнеса.",

  // --- Work / Projects (/04) ---
  "work.label": "НАШ ОПЫТ",
  "work.title": "Проекты, которые\nмы создали",
  "work.lead":
    "Подборка цифровых продуктов, построенных для клиентов из разных отраслей.",
  "work.comingSoon": "СКОРО",
  "work.visit": "Смотреть проект ↗",
  "work.swipeHint": "← ЛИСТАЙ ↔ {n} ПРОЕКТОВ →",
  "work.card.zoomAria": "Увеличить изображения проекта {name}",
  "work.card.shotAlt": "{name} — кадр {i}",
  "projects.tag.web": "ВЕБ-ПЛАТФОРМА",
  "projects.tag.corporate": "КОРПОРАТИВНЫЙ САЙТ",
  "projects.tag.saas": "SAAS-ПЛАТФОРМА",
  "projects.tag.mobile": "МОБИЛЬНОЕ ПРИЛОЖЕНИЕ",
  "projects.bizcheck.desc":
    "Платформа самооценки рисков для малого и среднего бизнеса по методологии Crowe: интерактивные тесты, блочные юридические шаблоны и подробный PDF-отчёт в финале.",
  "projects.itara-global.desc":
    "Корпоративный сайт для софтверной компании: hero-блок, ИТ-услуги под ключ, технологический стек и социальные доказательства — построено на скорость и конверсию.",
  "projects.docusafe.desc":
    "SaaS-платформа для управления документами, построенная нами полностью: защищённое хранилище, совместное редактирование прямо в браузере, полнотекстовый поиск и асинхронная обработка.",
  "projects.cgam.desc":
    "Платформа Corporate Governance Academy from Moldova: практические воркшопы по переговорам, геймифицированная лига с уровнями и очками, календарь событий и сообщество.",
  "projects.iq-arena.desc":
    "Приложение-компаньон для дебатов и переговорных событий CGAM: вход за стол по коду или QR, роли назначаются автоматически (PRO, CON, жюри), раунд идёт по таймеру, а каждый судья ставит от 1 до 5 по пяти критериям CGAM — результаты собираются в реальном времени, вплоть до объявления победителя.",

  // --- Team (/05) ---
  "team.label": "КОМАНДА",
  "team.title": "Люди\nза кодом",
  "team.lead":
    "Небольшая увлечённая команда, которая соединяет бизнес-стратегию с технической разработкой.",
  "team.social.websiteAria": "Личный сайт {name}",
  "team.social.networkAria": "{name} в {network}",
  "team.chistol-maxim.role": "Team Lead и Fullstack-разработчик",
  "team.danu.role": "Fullstack-разработчик",
  "team.bales-laurentiu.role": "QA-тестировщик и пентестер",
  "status.0.label": "ПРОЕКТОВ",
  "status.1.label": "ДОВОЛЬНЫХ КЛИЕНТОВ",
  "status.2.label": "АВТОМАТИЗАЦИЙ",
  "status.3.label": "НА СВЯЗИ",

  // --- Partners (/06) ---
  "partners.label": "НАШИ ПАРТНЁРЫ",
  "partners.title": "Растём\nвместе",
  "partners.lead":
    "Работаем рядом с компаниями, которые держат те же стандарты, что и мы — в аудите, консалтинге и бизнес-образовании. Они приносят доверие своих клиентов, мы — техническую часть.",
  "partners.cta.label": "СТАНЬ ПАРТНЁРОМ",
  "partners.cta.title": "Партнёром можешь стать и ты",
  "partners.cta.text":
    "Ты каждый день работаешь с предпринимателями и раньше всех видишь, где бизнес упирается в стену. Мы строим техническую часть — софт, автоматизацию, искусственный интеллект — а ты остаёшься тем, кому клиент доверяет. Без бюрократии и без обязательств: напиши нам, спишемся, созвонимся и вместе решим, как будет выглядеть сотрудничество.",

  // --- Estimator + contact (/07) ---
  "estimator.label": "ДАВАЙ ПОСТРОИМ ВМЕСТЕ",
  "estimator.title": "Оцени цену\nсвоего проекта",
  "estimator.lead":
    "Выбери тип проекта, срок и опции — а затем отправь нам детали.",
  "estimator.group.type": "01 · ТИП ПРОЕКТА",
  "estimator.group.deadline": "02 · СРОК",
  "estimator.group.options": "03 · ДОПОЛНИТЕЛЬНЫЕ ОПЦИИ",
  "estimator.price.from": "от {price}",
  "estimator.total.label": "ОРИЕНТИРОВОЧНАЯ ОЦЕНКА ЦЕНЫ",
  "estimator.total.note": "АВТОМАТИЧЕСКИЙ РАСЧЁТ · ИТОГОВАЯ ЦЕНА ПОСЛЕ ОБСУЖДЕНИЯ.",
  "estimator.sent.title": "Спасибо!",
  "estimator.sent.text":
    "Мы получили заявку по проекту «{project}». Скоро вернёмся с предложением.",
  "estimator.sent.reset": "ОТПРАВИТЬ ДРУГУЮ ЗАЯВКУ",
  "estimator.form.title": "Отправь детали",
  "estimator.form.sub": "Вернёмся с индивидуальным предложением максимум за 24 часа.",
  "estimator.form.namePlaceholder": "Имя и фамилия",
  "estimator.form.emailPlaceholder": "Email",
  "estimator.form.phonePlaceholder": "Телефон (необязательно)",
  "estimator.form.messagePlaceholder": "Расскажите о своём проекте...",
  "estimator.form.estimateAttached": "ОЦЕНКА ПРИЛОЖЕНА: {price} · {project}",
  "estimator.submit.idle": "Отправить заявку ↗",
  "estimator.submit.sending": "Отправляем…",
  "estimator.error.network":
    "Сервер не отвечает. Попробуйте ещё раз через пару минут.",
  "estimator.error.failed": "Отправка не удалась. Пожалуйста, попробуйте снова.",
  "estimator.field.name": "Имя",
  "estimator.field.email": "Email",
  "estimator.field.phone": "Телефон",
  "estimator.field.message": "Сообщение",
  "deadlines.urgent.name": "Срочно",
  "deadlines.urgent.note": "менее 3 нед.",
  "deadlines.standard.name": "Стандарт",
  "deadlines.standard.note": "1–2 месяца",
  "deadlines.flex.name": "Гибко",
  "deadlines.flex.note": "без спешки",
  "features.design.label": "+ Премиум-дизайн",
  "features.integr.label": "+ Интеграции и API",
  "features.multi.label": "+ Мультиязычность",
  "features.admin.label": "+ Админ-панель",
  "features.seo.label": "+ SEO",
  "features.aimod.label": "+ Модуль ИИ",
  "features.support.label": "+ Поддержка 6 месяцев",

  // --- Navbar ---
  "nav.services": "УСЛУГИ",
  "nav.work": "РАБОТЫ",
  "nav.team": "КОМАНДА",
  "nav.partners": "ПАРТНЁРЫ",
  "nav.about": "О НАС",
  "nav.cta": "НАЧАТЬ ПРОЕКТ ↗",
  "nav.burgerAria": "Меню",
  "nav.closeAria": "Закрыть",

  // --- Footer ---
  "footer.partnersLabel": "НАШИ БИЗНЕС-ПАРТНЁРЫ",
  "footer.brandText":
    "Цифровизируем бизнес через индивидуальный софт, мобильные приложения, автоматизацию и ИИ.",
  "footer.col.nav": "НАВИГАЦИЯ",
  "footer.col.services": "УСЛУГИ",
  "footer.col.contact": "КОНТАКТЫ",
  "footer.cta": "Рассчитать цену ↗",
  "footer.copyright": "© {year} TBS DIGITAL · ВСЕ ПРАВА ЗАЩИЩЕНЫ",
  "footer.madeBy": "СДЕЛАНО КОМАНДОЙ TBS DIGITAL",
  "footer.services.0": "Веб и лендинги",
  "footer.services.1": "Мобильные приложения",
  "footer.services.2": "CRM и SaaS",
  "footer.services.3": "Автоматизация и ИИ",
  "footer.social.emailAria": "Email",
  "footer.legal.privacy": "Конфиденциальность",
  "footer.legal.cookies": "Cookie-файлы",

  // --- Lightbox ---
  "lightbox.dialogAria": "{title} — изображение {i} из {count}",
  "lightbox.closeAria": "Закрыть",
  "lightbox.imgAlt": "{title} — кадр {i}",
  "lightbox.prevAria": "Предыдущее изображение",
  "lightbox.nextAria": "Следующее изображение",

  // --- Validation (form errors; {label}/{max} filled by the field) ---
  "validation.required": "Поле «{label}» обязательно для заполнения.",
  "validation.maxLen": "Поле «{label}» превышает {max} символов.",
  "validation.dangerous": "Поле «{label}» содержит недопустимые символы или код.",
  "validation.email": "Введите корректный адрес email.",
  "validation.phone": "Введите корректный номер телефона.",

  // --- Cookie consent banner ---
  "cookie.text":
    "Мы используем необходимые cookie-файлы для работы сайта и, с вашего согласия, аналитические cookie-файлы, чтобы понимать, как используется сайт. Смотрите",
  "cookie.policyLink": "Политику cookie",
  "cookie.accept": "Принять",
  "cookie.reject": "Отклонить",
  "cookie.settings": "Только необходимые",
};
