"""
Seed content — mirrors the frontend defaults in `lib/content.ts`.

The JSON stand-in writes this on first run so `GET /api/content` returns something
sensible before the admin edits anything. The colleague's DB store should seed the
same values in its initial migration.
"""

from .schemas import (
    Contact,
    LocalizedText,
    Partner,
    Project,
    Service,
    SiteContent,
    Social,
    Stat,
    TeamMember,
    PRICE_PLACEHOLDER,
)


def _l(ro: str, ru: str, en: str) -> LocalizedText:
    """A fully translated seed field (RO is the source and the render-time fallback)."""
    return LocalizedText(ro=ro, ru=ru, en=en)

_SERVICES = [
    ("landing", "Landing page", "Pagini rapide care transformă vizitatorii în clienți."),
    ("site", "Site web / prezentare", "Prezență online completă, rapidă și optimizată SEO."),
    ("shop", "Magazin online", "eCommerce cu plăți, stocuri și panou de administrare."),
    ("mobile", "Aplicație mobilă", "Aplicații iOS & Android native sau cross-platform."),
    ("crm", "CRM personalizat", "Gestionează clienți, lead-uri și vânzări dintr-un loc."),
    ("saas", "Platformă SaaS", "Produs software scalabil, cu abonamente și utilizatori."),
    ("automation", "Automatizare procese", "Elimină munca manuală repetitivă prin fluxuri automate."),
    ("dashboard", "Dashboard & rapoarte", "Toate datele importante, vizualizate la un click."),
    ("bot", "Bot Telegram", "Asistenți automați pentru suport, vânzări, notificări."),
]


# ---------------------------------------------------------------------------
# Projects — the real portfolio, kept identical to `lib/content.ts::projects`
# (same ids, same order, same text in all three languages). The frontend's /04 grid
# renders this list through the content store, so the two must not drift.
#
# Descriptions describe what each product actually does — nothing invented — and every
# one is fully translated. A project with no public link keeps `url` empty: the card
# then renders as plain markup instead of a link that goes nowhere.
# ---------------------------------------------------------------------------

# Category chips. Two projects are private client systems that cannot be published, so
# the chip says so outright.
_TAG_WEB = ("PLATFORMĂ WEB", "ВЕБ-ПЛАТФОРМА", "WEB PLATFORM")
_TAG_CORPORATE = ("SITE CORPORATIV", "КОРПОРАТИВНЫЙ САЙТ", "CORPORATE SITE")
_TAG_MOBILE = ("APLICAȚIE MOBILĂ", "МОБИЛЬНОЕ ПРИЛОЖЕНИЕ", "MOBILE APP")
_TAG_MOBILE_SOON = (
    "APLICAȚIE MOBILĂ · ÎN CURÂND",
    "МОБИЛЬНОЕ ПРИЛОЖЕНИЕ · СКОРО",
    "MOBILE APP · COMING SOON",
)
_TAG_SAAS_PRIVATE = (
    "SAAS PRIVAT · FĂRĂ LINK",
    "ПРИВАТНЫЙ SAAS · БЕЗ ССЫЛКИ",
    "PRIVATE SAAS · NO LINK",
)
_TAG_CRM_PRIVATE = (
    "CRM PRIVAT · FĂRĂ LINK",
    "ПРИВАТНЫЙ CRM · БЕЗ ССЫЛКИ",
    "PRIVATE CRM · NO LINK",
)
_TAG_EVENT_BRAND = ("WEB · EVENT BRAND", "WEB · EVENT-БРЕНД", "WEB · EVENT BRAND")
_TAG_GOV = ("PORTAL GUVERNAMENTAL", "ГОСУДАРСТВЕННЫЙ ПОРТАЛ", "GOVERNMENT PORTAL")

_BIZCHECK_DESC = (
    "Platformă de autoevaluare a riscurilor pentru IMM-uri, pe metodologia Crowe: teste "
    "interactive, șabloane juridice pe blocuri și un raport PDF detaliat la final.",
    "Платформа самооценки рисков для малого и среднего бизнеса по методологии Crowe: "
    "интерактивные тесты, блочные юридические шаблоны и подробный PDF-отчёт в финале.",
    "A risk self-assessment platform for SMEs built on the Crowe methodology: interactive "
    "tests, block-based legal templates and a detailed PDF report at the end.",
)
_ITARA_DESC = (
    "Site corporativ pentru o companie de software: hero, servicii IT end-to-end, stack "
    "tehnologic și dovezi sociale — construit pentru viteză și pentru conversie.",
    "Корпоративный сайт для софтверной компании: hero-блок, ИТ-услуги под ключ, "
    "технологический стек и социальные доказательства — построено на скорость и конверсию.",
    "A corporate site for a software company: hero, end-to-end IT services, tech stack "
    "and social proof — built for speed and conversion.",
)
_DOCUSAFE_DESC = (
    "Platformă SaaS de gestiune a documentelor, construită integral de noi: stocare "
    "securizată, editare colaborativă direct în browser, căutare full-text și procesare "
    "asincronă.",
    "SaaS-платформа для управления документами, построенная нами полностью: защищённое "
    "хранилище, совместное редактирование прямо в браузере, полнотекстовый поиск и "
    "асинхронная обработка.",
    "A document-management SaaS platform we built end to end: secure storage, "
    "collaborative editing right in the browser, full-text search and async processing.",
)
_CROWE_PORTAL_DESC = (
    "Portal intern de lucru pentru un client — nu poate fi publicat. Sarcini pe board "
    "(backlog → în lucru → verificare → trimis), tichete, clienți, ședințe și rapoarte.",
    "Внутренний рабочий портал под клиента — публиковать нельзя. Задачи на доске "
    "(бэклог → в работе → проверка → отправлено), тикеты, клиенты, встречи и отчёты.",
    "An internal work portal built for a client — it cannot be published. Board tasks "
    "(backlog → in progress → review → sent), tickets, clients, meetings and reports.",
)
_CGAM_DESC = (
    "Platforma Corporate Governance Academy from Moldova: ateliere practice de "
    "negociere, o ligă gamificată cu niveluri și puncte, calendar de evenimente și "
    "comunitate.",
    "Платформа Corporate Governance Academy from Moldova: практические воркшопы по "
    "переговорам, геймифицированная лига с уровнями и очками, календарь событий и "
    "сообщество.",
    "The platform for Corporate Governance Academy from Moldova: hands-on negotiation "
    "workshops, a gamified league with levels and points, an events calendar and community.",
)
# Taken from the app's own store listing (documentatie/16-store-listing.md).
_IQ_ARENA_DESC = (
    "Aplicația companion pentru evenimentele de dezbatere și negociere CGAM: intri la o "
    "masă prin cod sau QR, rolurile se atribuie automat (PRO, CON, juriu), runda e "
    "cronometrată, iar fiecare jurat notează 1–5 pe cele cinci criterii CGAM — "
    "rezultatele se agregă în timp real, până la dezvăluirea câștigătorului.",
    "Приложение-компаньон для дебатов и переговорных событий CGAM: вход за стол по коду "
    "или QR, роли назначаются автоматически (PRO, CON, жюри), раунд идёт по таймеру, а "
    "каждый судья ставит от 1 до 5 по пяти критериям CGAM — результаты собираются в "
    "реальном времени, вплоть до объявления победителя.",
    "The companion app for CGAM debate and negotiation events: join a table by code or "
    "QR, roles are assigned automatically (PRO, CON, jury), the round is timed, and every "
    "judge scores 1–5 on the five CGAM criteria — results aggregate in real time, right "
    "up to the winner reveal.",
)
_BALLOONS_BREEZE_DESC = (
    "Site imersiv pentru un studio de aerodesign: scenă interactivă cu baloane, servicii "
    "pentru evenimente și cerere rapidă de ofertă.",
    "Иммерсивный сайт студии аэродизайна: интерактивная сцена с шарами, услуги для "
    "событий и быстрый запрос сметы.",
    "An immersive site for a balloon-design studio: an interactive balloon scene, event "
    "services and a fast quote request.",
)
_STATISTICA_MD_DESC = (
    "Portal public de date pentru Biroul Național de Statistică: indicatori-cheie, banca "
    "de date, publicații și căutare — clar și accesibil pentru toți.",
    "Публичный портал данных для Национального бюро статистики: ключевые показатели, "
    "банк данных, публикации и поиск — понятно и доступно для всех.",
    "A public data portal for the National Bureau of Statistics: key indicators, a data "
    "bank, publications and search — clear and accessible for everyone.",
)
_STATISTIC_DESC = (
    "Instrument propriu de web-analytics: vizualizări, sesiuni, click-uri și evoluție în "
    "timp pentru fiecare site — alternativă gratuită la serviciile cunoscute, cu accent "
    "pe SEO.",
    "Собственный инструмент веб-аналитики: просмотры, сессии, клики и динамика по каждому "
    "сайту — бесплатная альтернатива известным сервисам, с акцентом на SEO.",
    "An in-house web-analytics tool: views, sessions, clicks and trends for every site — "
    "a free alternative to well-known services, with a focus on SEO.",
)
_FLIRT_DESC = (
    "Aplicație mobilă de dating, în curând pe piață: profiluri, matching și conversații "
    "într-un design rapid, cu toleranță zero la conținut abuziv.",
    "Мобильное приложение для знакомств, скоро в релизе: анкеты, мэтчинг и переписка в "
    "быстром дизайне, с нулевой терпимостью к оскорбительному контенту.",
    "A mobile dating app launching soon: profiles, matching and chat in a fast design, "
    "with zero tolerance for abusive content.",
)

# The real team, in the order they appear on the /05 grid. Photos, bios and personal
# links start empty — the admin fills them in (a card renders fine without any of them).
# First names only. The ids stay put — they are the stable keys `_sync_team` upserts on, so
# renaming one would orphan whatever the admin has already filled in for that person.
_TEAM = [
    ("chistol-maxim", "Maxim", "Team Lead & Fullstack Developer"),
    ("danu", "Danu", "Fullstack Developer"),
    ("bales-laurentiu", "Laurentiu", "QA Tester & Pentester"),
]

# The company's own networks. Every url starts empty on purpose: the footer renders an
# icon only once its link is set, so an unfilled slot simply doesn't show.
_SOCIALS = ["telegram", "linkedin", "github"]


def default_team() -> list[TeamMember]:
    """The real team members, with everything but name/role left for the admin."""
    return [TeamMember(id=tid, name=name, role=role) for tid, name, role in _TEAM]


def default_socials() -> list[Social]:
    """The footer's social slots — the icons the admin is expected to fill in."""
    return [Social(id=f"so-{t}", type=t, url="") for t in _SOCIALS]


def default_partners() -> list[Partner]:
    """The real partners. Logos are bundled assets under the frontend's `public/`."""
    return [
        Partner(
            id="crowe",
            name="Crowe Turcan Mikhailenko",
            logo="/partners/crowe.png",
            url="https://crowe-tm.md",
            preview="/partners/previews/crowe.png",
        ),
        Partner(
            id="cgam",
            name="CGAM Business Academy",
            logo="/partners/cgam.png",
            url="https://cgam.md",
            preview="/partners/previews/cgam.png",
        ),
        Partner(
            id="ivan-turcan",
            name="Ivan Turcan",
            logo="/partners/ivan-turcan.png",
            url="https://turcan.md",
            preview="/partners/previews/ivan-turcan.png",
        ),
    ]


def default_projects() -> list[Project]:
    """The delivered projects on the /04 grid, in the order they are shown.

    Screenshots are bundled assets under the frontend's `public/projects/` (mixed png/jpg
    — whichever kept the file small); the card shows the first one and the rest are its
    gallery. Store links are left empty on purpose: a card only renders the store button
    whose link is actually set.

    `url` is empty for DocuSafe, Crowe Portal, IQ Arena, Statistic and FLIRT — private
    client systems and an unreleased app, none of which have a public address. No URL is
    invented to fill the field; the card simply isn't a link.
    """
    return [
        Project(
            id="bizcheck",
            name="BizCheck",
            tag=_l(*_TAG_WEB),
            desc=_l(*_BIZCHECK_DESC),
            url="https://bizcheck.md",
            images=[
                "/projects/bizcheck-1.jpg",
                "/projects/bizcheck-2.png",
                "/projects/bizcheck-3.png",
                "/projects/bizcheck-4.png",
            ],
        ),
        Project(
            id="itara-global",
            name="Itara Global",
            tag=_l(*_TAG_CORPORATE),
            desc=_l(*_ITARA_DESC),
            url="https://itara-global.md",
            images=[
                "/projects/itara-1.jpg",
                "/projects/itara-2.png",
                "/projects/itara-3.png",
                "/projects/itara-4.png",
            ],
        ),
        Project(
            id="docusafe",
            name="DocuSafe",
            tag=_l(*_TAG_CRM_PRIVATE),
            desc=_l(*_DOCUSAFE_DESC),
            images=["/projects/docusafe-1.png"],
        ),
        Project(
            id="crowe-portal",
            name="Crowe Portal",
            tag=_l(*_TAG_CRM_PRIVATE),
            desc=_l(*_CROWE_PORTAL_DESC),
            images=["/projects/crowe-portal-1.png"],
        ),
        Project(
            id="cgam",
            name="CGAM",
            tag=_l(*_TAG_WEB),
            desc=_l(*_CGAM_DESC),
            url="https://cgam.md",
            images=[
                "/projects/cgam-1.png",
                "/projects/cgam-2.png",
                "/projects/cgam-3.jpg",
                "/projects/cgam-4.png",
            ],
        ),
        # The game itself, not the academy's platform. Store links start empty — they are
        # filled in from the admin, and each button only appears once its link is set.
        Project(
            id="iq-arena",
            name="IQ Arena",
            tag=_l(*_TAG_MOBILE),
            desc=_l(*_IQ_ARENA_DESC),
            images=[
                "/projects/iq-arena-1.png",
                "/projects/iq-arena-2.png",
                "/projects/iq-arena-3.png",
                "/projects/iq-arena-4.png",
            ],
        ),
        Project(
            id="balloons-breeze",
            name="Balloons Breeze",
            tag=_l(*_TAG_EVENT_BRAND),
            desc=_l(*_BALLOONS_BREEZE_DESC),
            url="https://balloonsbreeze.md/",
            images=["/projects/balloons-breeze-1.png"],
        ),
        Project(
            id="statistica-md",
            name="Statistica.md",
            tag=_l(*_TAG_GOV),
            desc=_l(*_STATISTICA_MD_DESC),
            url="https://statistica.gov.md",
            images=["/projects/statistica-1.png"],
        ),
        Project(
            id="statistic",
            name="Statistic",
            tag=_l(*_TAG_SAAS_PRIVATE),
            desc=_l(*_STATISTIC_DESC),
            images=["/projects/statistic-1.png"],
        ),
        Project(
            id="flirt",
            name="FLIRT",
            tag=_l(*_TAG_MOBILE_SOON),
            desc=_l(*_FLIRT_DESC),
            images=["/projects/flirt-1.png"],
        ),
    ]


def default_content() -> SiteContent:
    services = [
        Service(id=sid, name=name, desc=desc, price=PRICE_PLACEHOLDER)
        for sid, name, desc in _SERVICES
    ]
    # estimator-only option (no /03 card) — kept between "bot" and "custom"
    services.append(
        Service(id="ai", name="Automatizare cu IA", desc="", price=PRICE_PLACEHOLDER, estimatorOnly=True)
    )
    services.append(
        Service(
            id="custom",
            name="Software personalizat",
            desc="Construit exact pe nevoile și fluxurile afacerii tale.",
            price=PRICE_PLACEHOLDER,
        )
    )

    return SiteContent(
        stats=[Stat(id=f"s{i}") for i in range(1, 5)],  # 4 blank placeholders
        services=services,
        team=default_team(),
        partners=default_partners(),
        projects=default_projects(),
        contacts=[
            Contact(id="c-email", type="email", value="office@tbs.md"),
            Contact(id="c-phone", type="phone", value="+373 600 00 000"),
            Contact(id="c-address", type="other", value="A. Șușev 29"),
        ],
        socials=default_socials(),
    )
