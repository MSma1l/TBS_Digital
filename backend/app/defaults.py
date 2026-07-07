"""
Seed content — mirrors the frontend defaults in `lib/content.ts`.

The JSON stand-in writes this on first run so `GET /api/content` returns something
sensible before the admin edits anything. The colleague's DB store should seed the
same values in its initial migration.
"""

from .schemas import Contact, Service, SiteContent, Stat, TeamMember, PRICE_PLACEHOLDER

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
        partners=[f"PARTENER_0{i}" for i in range(1, 6)],
        contacts=[
            Contact(id="c-email", type="email", value="contact@tbsdigital.ro"),
            Contact(id="c-phone", type="phone", value="+373 600 00 000"),
        ],
    )
