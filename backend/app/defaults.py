"""
Seed content — mirrors the frontend defaults in `lib/content.ts`.

The JSON stand-in writes this on first run so `GET /api/content` returns something
sensible before the admin edits anything. The colleague's DB store should seed the
same values in its initial migration.
"""

from .schemas import (
    Contact,
    Partner,
    Project,
    Service,
    SiteContent,
    Stat,
    TeamMember,
    PRICE_PLACEHOLDER,
)

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


# Project descriptions — taken from what each product actually does, not invented.
# Fayr Family is intentionally blank: its copy, store links and screenshots are filled in
# from the admin (the card renders fine without any of them).
_BIZCHECK_DESC = (
    "Platformă de autoevaluare a riscurilor pentru IMM-uri, pe metodologia Crowe: teste "
    "interactive, șabloane juridice pe blocuri și un raport PDF detaliat la final."
)
_ITARA_DESC = (
    "Site corporativ pentru o companie de software: hero, servicii IT end-to-end, stack "
    "tehnologic și dovezi sociale — construit pentru viteză și pentru conversie."
)
_DOCUSAFE_DESC = (
    "Platformă SaaS de gestiune a documentelor, construită integral de noi: stocare "
    "securizată, editare colaborativă direct în browser, căutare full-text și procesare "
    "asincronă."
)
_IQ_ARENA_DESC = (
    "Simulator de negocieri pentru Corporate Governance Academy: ateliere practice, o "
    "ligă gamificată cu niveluri și puncte, calendar de evenimente și comunitate."
)
_FAYR_DESC = ""


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
    """The delivered projects on the /04 grid.

    Screenshots are bundled assets under the frontend's `public/projects/` (mixed png/jpg
    — whichever kept the file small). DocuSafe and Fayr Family ship with no gallery yet;
    their screenshots are uploaded from the admin. Store links are left empty on purpose:
    a card only renders the store button whose link is actually set.
    """
    return [
        Project(
            id="bizcheck",
            name="BizCheck",
            tag="PLATFORMĂ WEB",
            desc=_BIZCHECK_DESC,
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
            tag="SITE CORPORATIV",
            desc=_ITARA_DESC,
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
            tag="PLATFORMĂ SAAS",
            desc=_DOCUSAFE_DESC,
            url="https://docusafe.tbs.md",
            images=[],
        ),
        Project(
            id="iq-arena",
            name="IQ Arena",
            tag="APLICAȚIE MOBILĂ",
            desc=_IQ_ARENA_DESC,
            url="https://cgam.md",
            images=[
                "/projects/iq-arena-1.png",
                "/projects/iq-arena-2.png",
                "/projects/iq-arena-3.jpg",
                "/projects/iq-arena-4.png",
            ],
        ),
        Project(
            id="fayr-family",
            name="Fayr Family",
            tag="APLICAȚIE MOBILĂ",
            desc=_FAYR_DESC,
            images=[],
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
        team=[TeamMember(id=f"t{i}") for i in range(1, 5)],  # 4 blank placeholders
        partners=default_partners(),
        projects=default_projects(),
        contacts=[
            Contact(id="c-email", type="email", value="contact@tbsdigital.ro"),
            Contact(id="c-phone", type="phone", value="+373 600 00 000"),
        ],
    )
