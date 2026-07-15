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
  "meta.title": "TBS Digital — Software, aplicații și automatizări cu IA",
  "meta.description":
    "Digitalizăm afaceri prin software personalizat, aplicații mobile, automatizări cu IA, CRM, SaaS și platforme — de la strategie până la execuție.",

  // --- Hero ---
  "hero.badge": "DE LA CONSULTANȚĂ LA DIGITALIZARE",
  "hero.kicker":
    "Software care aduce rezultate:\nmai puțin timp, mai mulți clienți, mai mult venit.",
  "hero.lead":
    "Software personalizat, aplicații mobile, automatizări cu IA, CRM, SaaS și platforme care îți cresc afacerea — de la strategie până la execuție.",
  "hero.cta.primary": "Calculează prețul ↗",
  "hero.cta.secondary": "Vezi serviciile",
  "hero.scrollHint": "DERULEAZĂ — SISTEMUL SE ACTIVEAZĂ ↓",

  // --- Principles (/02) ---
  "principles.label": "PRINCIPIILE NOASTRE",
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
  "services.label": "CE PUTEM FACE",
  "services.title": "Servicii de\ndigitalizare",
  "services.lead":
    "Alege un serviciu sau combină mai multe într-un produs complet.",
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
    "Lucrăm alături de companii care țin la aceleași standarde ca noi — în audit, consultanță și educație în afaceri. Ei aduc încrederea clienților lor, noi aducem partea tehnică.",
  "partners.cta.label": "DEVINO PARTENER",
  "partners.cta.title": "Și tu poți deveni partener",
  "partners.cta.text":
    "Lucrezi zi de zi cu antreprenori și vezi, înaintea tuturor, unde se blochează o afacere. Noi construim partea tehnică — software, automatizări, inteligență artificială — iar tu rămâi omul în care clientul are încredere. Fără birocrație și fără angajamente: ne scrii, ne auzim, și stabilim împreună cum arată colaborarea.",

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
  "nav.cta": "START PROIECT ↗",
  "nav.burgerAria": "Meniu",
  "nav.closeAria": "Închide",

  // --- Footer ---
  "footer.partnersLabel": "PARTENERII NOȘTRI DE AFACERI",
  "footer.brandText":
    "Digitalizăm afaceri prin software personalizat, aplicații mobile, automatizări și IA.",
  "footer.col.nav": "NAVIGARE",
  "footer.col.services": "SERVICII",
  "footer.col.contact": "CONTACT",
  "footer.cta": "Calculează prețul ↗",
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
  "cta.collaborate": "Hai să colaborăm →",
  "cta.lead": "Ai un proiect în minte? Hai să-l construim împreună.",

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
} as const;

export type MessageKey = keyof typeof ro;
