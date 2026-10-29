/**
 * Romanian message catalog — the SOURCE of truth for every user-facing string.
 *
 * `ru.ts` and `en.ts` mirror these exact keys. Romanian is the fallback: if a key is
 * missing or empty in another language, the UI shows the Romanian value rather than a
 * blank, so the site can never render an empty label.
 *
 * `\n` marks an intentional line break the component renders as a <br>. Placeholders like
 * `{n}`, `{name}`, `{price}` are filled in by the component — keep them intact in every
 * translation.
 *
 * Content keys (services.*, projects.*, principles.*, …) are the DEFAULT/seed content.
 * A section renders the translated value only while the stored content still equals the
 * Romanian default; once the admin customises an item, their own text is shown as-is.
 */
export const ro = {
  // --- SEO / document ---
  "meta.title": "Creare site-uri, aplicații și MVP în Chișinău | TBS Digital",
  "meta.description":
    "Ai o idee sau un proces care te încurcă? Construim MVP-ul, site-ul sau aplicația, o testezi cu clienți reali și investești doar în ce merge. Cere ofertă.",

  // --- Hero ---
  "hero.badge": "SITE-URI · APLICAȚII · MVP · AUTOMATIZĂRI",
  "hero.kicker":
    "Testează ideea înainte\nsă investești în tot produsul.",
  "hero.lead":
    "Construim un MVP, un site sau o aplicație cu buget de pornire mic. O testezi cu clienți reali și dezvolți doar ce funcționează.",
  "hero.cta.primary": "Cere ofertă ↗",
  "hero.cta.secondary": "Vezi serviciile",

  // --- Principles (/02) ---
  "principles.label": "ABORDARE INDIVIDUALĂ",
  "principles.lead": "Fiecare proiect începe cu înțelegerea afacerii și a obiectivelor tale.",
  "principles.0.title": "Strategie\nîntâi",
  "principles.0.desc": "Înțelegem afacerea înainte de prima linie de cod.",
  "principles.1.title": "Sisteme\nconectate",
  "principles.1.desc": "Date, module, automatizări — totul integrat.",
  "principles.2.title": "Estetică\ndigitală",
  "principles.2.desc": "Interfețe clare, rapide și plăcute de folosit.",
  "principles.3.title": "Rezultate\nreale",
  "principles.3.desc": "Timp economisit, costuri reduse, venituri crescute.",
  "principles.4.title": "IA\naplicată",
  "principles.4.desc": "Inteligență artificială acolo unde chiar contează.",

  // --- Services (/03) ---
  "services.label": "CE CONSTRUIM",
  "services.title": "Site-uri, aplicații\nși automatizări",
  "services.lead":
    "Alege ce îți trebuie acum. Pornim mic și adăugăm doar ce aduce rezultat.",
  "services.swipeHint": "← GLISEAZĂ ↔ {n} SERVICII →",
  "services.card.cta": "Calculează prețul →",
  "services.card.estimateAria": "Calculează prețul pentru {name}",
  "services.landing.name": "Landing page",
  "services.landing.desc":
    "Pagini rapide care transformă vizitatorii în clienți.",
  "services.site.name": "Site web / prezentare",
  "services.site.desc":
    "Prezență online completă, rapidă și optimizată SEO.",
  "services.shop.name": "Magazin online",
  "services.shop.desc":
    "eCommerce cu plăți, stocuri și panou de administrare.",
  "services.mobile.name": "Aplicație mobilă",
  "services.mobile.desc":
    "Aplicații iOS & Android native sau cross-platform.",
  "services.crm.name": "CRM personalizat",
  "services.crm.desc":
    "Gestionează clienți, lead-uri și vânzări dintr-un loc.",
  "services.saas.name": "Platformă SaaS",
  "services.saas.desc":
    "Produs software scalabil, cu abonamente și utilizatori.",
  "services.automation.name": "Automatizare procese",
  "services.automation.desc":
    "Elimină munca manuală repetitivă prin fluxuri automate.",
  "services.dashboard.name": "Dashboard & rapoarte",
  "services.dashboard.desc":
    "Toate datele importante, vizualizate la un click.",
  "services.bot.name": "Bot Telegram",
  "services.bot.desc":
    "Asistenți automați pentru suport, vânzări, notificări.",
  "services.ai.name": "Automatizare cu IA",
  "services.ai.desc": "",
  "services.custom.name": "Software personalizat",
  "services.custom.desc":
    "Construit exact pe nevoile și fluxurile afacerii tale.",

  // --- Work / Projects (/04) ---
  "work.label": "EXPERIENȚA NOASTRĂ",
  "work.title": "Proiecte pe care\nle-am creat",
  "work.lead":
    "O selecție din produsele digitale construite pentru clienți din diverse industrii.",
  "work.comingSoon": "ÎN CURÂND",
  "work.visit": "Vezi proiectul ↗",
  "work.swipeHint": "← GLISEAZĂ ↔ {n} PROIECTE →",
  "work.card.zoomAria": "Mărește imaginile proiectului {name}",
  "work.card.shotAlt": "{name} — captură {i}",
  "projects.tag.web": "PLATFORMĂ WEB",
  "projects.tag.corporate": "SITE CORPORATIV",
  "projects.tag.saas": "PLATFORMĂ SAAS",
  "projects.tag.mobile": "APLICAȚIE MOBILĂ",
  "projects.tag.saasPrivate": "SAAS PRIVAT · FĂRĂ LINK",
  "projects.tag.mobileSoon": "APLICAȚIE MOBILĂ · ÎN CURÂND",
  "projects.statistic.desc":
    "Instrument propriu de web-analytics: vizualizări, sesiuni, click-uri și evoluție în timp pentru fiecare site — alternativă gratuită la serviciile cunoscute, cu accent pe SEO.",
  "projects.flirt.desc":
    "Aplicație mobilă de dating, în curând pe piață: profiluri, matching și conversații într-un design rapid, cu toleranță zero la conținut abuziv.",
  "projects.bizcheck.desc":
    "Platformă de autoevaluare a riscurilor pentru IMM-uri, pe metodologia Crowe: teste interactive, șabloane juridice pe blocuri și un raport PDF detaliat la final.",
  "projects.itara-global.desc":
    "Site corporativ pentru o companie de software: hero, servicii IT end-to-end, stack tehnologic și dovezi sociale — construit pentru viteză și pentru conversie.",
  "projects.docusafe.desc":
    "Platformă SaaS de gestiune a documentelor, construită integral de noi: stocare securizată, editare colaborativă direct în browser, căutare full-text și procesare asincronă.",
  "projects.cgam.desc":
    "Platforma Corporate Governance Academy from Moldova: ateliere practice de negociere, o ligă gamificată cu niveluri și puncte, calendar de evenimente și comunitate.",
  "projects.iq-arena.desc":
    "Aplicația companion pentru evenimentele de dezbatere și negociere CGAM: intri la o masă prin cod sau QR, rolurile se atribuie automat (PRO, CON, juriu), runda e cronometrată, iar fiecare jurat notează 1–5 pe cele cinci criterii CGAM — rezultatele se agregă în timp real, până la dezvăluirea câștigătorului.",

  // --- Team (/05) ---
  "team.label": "ECHIPA",
  "team.title": "Oamenii din\nspatele codului",
  "team.lead":
    "O echipă mică și dedicată care combină strategia de business cu dezvoltarea tehnică.",
  "team.social.websiteAria": "Site-ul personal al lui {name}",
  "team.social.networkAria": "{name} pe {network}",
  "team.chistol-maxim.role": "Team Lead & Fullstack Developer",
  "team.danu.role": "Fullstack Developer",
  "team.bales-laurentiu.role": "QA Tester & Pentester",
  "status.0.label": "PROIECTE",
  "status.1.label": "SATISFACȚIE",
  "status.2.label": "AUTOMATIZĂRI",
  "status.3.label": "DISPONIBILITATE",

  // --- Partners (/06) ---
  "partners.label": "PARTENERII NOȘTRI",
  "partners.title": "Creștem\nîmpreună",
  "partners.lead":
    "Lucrăm alături de companii din audit, consultanță și educație în afaceri. Ele aduc încrederea clienților lor, noi aducem partea tehnică.",
  "partners.cta.label": "DEVINO PARTENER",
  "partners.cta.title": "Și tu poți deveni partener",
  "partners.cta.text":
    "Lucrezi cu antreprenori și vezi primul unde se blochează o afacere. Noi construim partea tehnică — software, automatizări, IA — iar tu rămâi omul în care clientul are încredere. Ne scrii și stabilim împreună cum arată colaborarea.",

  // --- Estimator + contact (/07) ---
  "estimator.label": "HAI SĂ CONSTRUIM ÎMPREUNĂ",
  "estimator.title": "Estimează prețul\nproiectului tău",
  "estimator.lead":
    "Alege tipul de proiect, termenul limită și opțiunile — apoi trimite-ne detaliile.",
  "estimator.group.type": "01 · TIP DE PROIECT",
  "estimator.group.deadline": "02 · TERMEN LIMITĂ",
  "estimator.group.options": "03 · OPȚIUNI SUPLIMENTARE",
  "estimator.price.from": "de la {price}",
  "estimator.total.label": "PREȚ ORIENTATIV ESTIMAT",
  "estimator.total.note": "ESTIMARE AUTOMATĂ · PREȚUL FINAL DUPĂ DISCUȚIE.",
  "estimator.sent.title": "Mulțumim!",
  "estimator.sent.text":
    "Am primit cererea pentru {project}. Revenim în curând cu o ofertă.",
  "estimator.sent.reset": "TRIMITE ALTĂ CERERE",
  "estimator.form.title": "Trimite detaliile",
  "estimator.form.sub": "Revenim cu o ofertă personalizată în cel mult 24h.",
  "estimator.form.namePlaceholder": "Nume și prenume",
  "estimator.form.emailPlaceholder": "Email",
  "estimator.form.phonePlaceholder": "Telefon (opțional)",
  "estimator.form.messagePlaceholder": "Spune-ne despre proiectul tău...",
  "estimator.form.estimateAttached": "ESTIMARE ATAȘATĂ: {price} · {project}",
  "estimator.submit.idle": "Trimite cererea ↗",
  "estimator.submit.sending": "Se trimite…",
  "estimator.error.network":
    "Serverul nu răspunde. Încearcă din nou în câteva momente.",
  "estimator.error.failed": "Trimiterea a eșuat. Te rugăm să încerci din nou.",
  "estimator.field.name": "Numele",
  "estimator.field.email": "Emailul",
  "estimator.field.phone": "Telefonul",
  "estimator.field.message": "Mesajul",
  "deadlines.urgent.name": "Urgent",
  "deadlines.urgent.note": "sub 3 săpt.",
  "deadlines.standard.name": "Standard",
  "deadlines.standard.note": "1–2 luni",
  "deadlines.flex.name": "Flexibil",
  "deadlines.flex.note": "fără grabă",
  "features.design.label": "+ Design premium",
  "features.integr.label": "+ Integrări & API",
  "features.multi.label": "+ Multilingv",
  "features.admin.label": "+ Panou admin",
  "features.seo.label": "+ SEO",
  "features.aimod.label": "+ Modul IA",
  "features.support.label": "+ Mentenanță 6 luni",

  // --- Navbar ---
  "nav.services": "SERVICII",
  "nav.work": "LUCRĂRI",
  "nav.team": "ECHIPĂ",
  "nav.partners": "PARTENERI",
  "nav.about": "DESPRE",
  "dir.section.title": "Un instrument de alegere a direcției —\npentru decizii rapide și sigure.",
  "dir.section.lead": "Alege o direcție — se deschide o pagină dedicată cu detalii.",
  "dir.digital": "Site-uri, aplicații și MVP",
  "dir.ecommerce": "Magazin online și e-commerce",
  "dir.automation": "Automatizare, CRM și API",
  "dir.ai": "Asistenți IA și boți",
  "dir.brand": "Brand și design UI",
  "dir.page.soon": "Pagină în lucru — o completăm în curând cu detalii.",
  "dir.page.back": "Acasă",
  "nav.company": "COMPANIE",
  "nav.services.web": "Dezvoltare web",
  "nav.services.apps": "Aplicații și platforme",
  "nav.services.automation": "Automatizarea afacerii",
  "nav.services.custom": "Soluții individuale",
  "nav.company.team": "Echipă",
  "nav.company.partners": "Parteneri",
  "nav.company.cases": "Cazuri",
  "nav.cta": "CERE OFERTĂ ↗",
  "nav.burgerAria": "Meniu",
  "nav.closeAria": "Închide",
  // The language button's accessible name; the component appends the language in force:
  // "Schimbă limba: Română".
  "nav.langChange": "Schimbă limba",
  // The theme button's accessible NAME never changes with the state — `aria-pressed` carries
  // it, so a screen reader reads "Temă închisă, apăsat". The two `switchTo*` strings are the
  // tooltip: what a press would do next.
  "theme.toggleAria": "Temă închisă",
  "theme.switchToDark": "Comută la tema închisă",
  "theme.switchToLight": "Comută la tema deschisă",
  // Screen readers already announce the landmark as "navigation": the label only names which one.
  "nav.primaryAria": "Principal",
  // The header clock's label: a HUD code, the same in every language, but still a key so
  // the header carries no hardcoded copy.
  "header.sysTime": "SYS_TIME",

  // --- Footer ---
  "footer.partnersLabel": "PARTENERII NOȘTRI DE AFACERI",
  "footer.col.nav": "NAVIGARE",
  "footer.col.services": "SERVICII",
  "footer.col.contact": "CONTACT",
  "footer.cta": "Cere ofertă ↗",
  "footer.copyright": "© {year} TBS DIGITAL · TOATE DREPTURILE REZERVATE",
  "footer.madeBy": "REALIZAT DE ECHIPA TBS DIGITAL",
  "footer.services.0": "Web & Landing",
  "footer.services.1": "Aplicații mobile",
  "footer.services.2": "CRM & SaaS",
  "footer.services.3": "Automatizare & IA",
  "footer.social.emailAria": "Email",
  "footer.social.websiteAria": "Site-ul TBS Digital",
  "footer.social.networkAria": "TBS Digital pe {network}",
  "footer.legal.privacy": "Confidențialitate",
  "footer.legal.cookies": "Cookie-uri",

  // --- Call to action repeated after each section ---
  "cta.collaborate": "Cere ofertă →",
  "cta.lead": "Ai o idee? Pornește cu o primă versiune mică și află repede dacă merită.",

  // --- Lightbox ---
  "lightbox.dialogAria": "{title} — imagine {i} din {count}",
  "lightbox.closeAria": "Închide",
  "lightbox.imgAlt": "{title} — captură {i}",
  "lightbox.prevAria": "Imaginea anterioară",
  "lightbox.nextAria": "Imaginea următoare",

  // --- Validation (form errors; {label}/{max} filled by the field) ---
  "validation.required": "{label} este obligatoriu.",
  "validation.maxLen": "{label} depășește {max} de caractere.",
  "validation.dangerous": "{label} conține caractere sau cod nepermis.",
  "validation.email": "Introdu o adresă de email validă.",
  "validation.phone": "Introdu un număr de telefon valid.",

  // --- Cookie consent banner ---
  "cookie.text":
    "Folosim cookie-uri esențiale pentru funcționarea site-ului și, cu acordul tău, cookie-uri de analiză pentru a înțelege cum e folosit site-ul. Vezi",
  "cookie.policyLink": "Politica de cookie",
  "cookie.accept": "Accept",
  "cookie.reject": "Refuz",
  "cookie.settings": "Doar esențiale",

  // --- Loading ---
  "common.loading": "Se încarcă",
} as const;

export type MessageKey = keyof typeof ro;
