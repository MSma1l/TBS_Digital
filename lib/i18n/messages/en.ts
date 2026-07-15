/**
 * English message catalog — mirrors the exact keys of `ro.ts`.
 *
 * Romanian (`ro.ts`) is the source of truth and the fallback: if a key is missing or
 * empty here, the UI shows the Romanian value rather than a blank.
 *
 * `\n` marks an intentional line break the component renders as a <br>. Placeholders like
 * `{n}`, `{name}`, `{price}` are filled in by the component — keep them intact.
 */
import type { MessageKey } from "./ro";

export const en: Record<MessageKey, string> = {
  // --- SEO / document ---
  "meta.title": "TBS Digital — Software, apps and AI automation",
  "meta.description":
    "We digitize businesses with custom software, mobile apps, AI automation, CRM, SaaS and platforms — from strategy to launch.",

  // --- Hero ---
  "hero.badge": "FROM CONSULTING TO DIGITALIZATION",
  "hero.kicker":
    "Software that delivers:\nless busywork, more clients, more revenue.",
  "hero.lead":
    "Custom software, mobile apps, AI automation, CRM, SaaS and platforms that grow your business — from strategy to launch.",
  "hero.cta.primary": "Get a price ↗",
  "hero.cta.secondary": "See services",
  "hero.scrollHint": "SCROLL — THE SYSTEM POWERS UP ↓",

  // --- Principles (/02) ---
  "principles.label": "OUR PRINCIPLES",
  "principles.0.title": "Strategy\nfirst",
  "principles.0.desc": "We learn the business before the first line of code.",
  "principles.1.title": "Connected\nsystems",
  "principles.1.desc": "Data, modules, automation — everything integrated.",
  "principles.2.title": "Digital\ncraft",
  "principles.2.desc": "Interfaces that are clear, fast and a pleasure to use.",
  "principles.3.title": "Real\nresults",
  "principles.3.desc": "Time saved, costs down, revenue up.",
  "principles.4.title": "Applied\nAI",
  "principles.4.desc": "Artificial intelligence where it actually matters.",

  // --- Services (/03) ---
  "services.label": "WHAT WE BUILD",
  "services.title": "Digitalization\nservices",
  "services.lead":
    "Pick one service or combine several into a complete product.",
  "services.swipeHint": "← SWIPE ↔ {n} SERVICES →",
  "services.card.cta": "Get a price →",
  "services.card.estimateAria": "Get a price for {name}",
  "services.landing.name": "Landing page",
  "services.landing.desc":
    "Fast pages that turn visitors into customers.",
  "services.site.name": "Website / presentation",
  "services.site.desc":
    "A complete online presence — fast and SEO-ready.",
  "services.shop.name": "Online store",
  "services.shop.desc":
    "eCommerce with payments, inventory and an admin panel.",
  "services.mobile.name": "Mobile app",
  "services.mobile.desc":
    "Native or cross-platform apps for iOS & Android.",
  "services.crm.name": "Custom CRM",
  "services.crm.desc":
    "Manage clients, leads and sales from one place.",
  "services.saas.name": "SaaS platform",
  "services.saas.desc":
    "A scalable software product with subscriptions and users.",
  "services.automation.name": "Process automation",
  "services.automation.desc":
    "Kill repetitive manual work with automated workflows.",
  "services.dashboard.name": "Dashboards & reports",
  "services.dashboard.desc":
    "Every key metric, visualized in a single click.",
  "services.bot.name": "Telegram bot",
  "services.bot.desc":
    "Automated assistants for support, sales and alerts.",
  "services.ai.name": "AI automation",
  "services.ai.desc": "",
  "services.custom.name": "Custom software",
  "services.custom.desc":
    "Built exactly around your business needs and workflows.",

  // --- Work / Projects (/04) ---
  "work.label": "OUR EXPERIENCE",
  "work.title": "Projects we've\nbuilt",
  "work.lead":
    "A selection of the digital products we've built for clients across industries.",
  "work.comingSoon": "COMING SOON",
  "work.visit": "View project ↗",
  "work.swipeHint": "← SWIPE ↔ {n} PROJECTS →",
  "work.card.zoomAria": "Zoom into the {name} project images",
  "work.card.shotAlt": "{name} — shot {i}",
  "projects.tag.web": "WEB PLATFORM",
  "projects.tag.corporate": "CORPORATE SITE",
  "projects.tag.saas": "SAAS PLATFORM",
  "projects.tag.mobile": "MOBILE APP",
  "projects.bizcheck.desc":
    "A risk self-assessment platform for SMEs built on the Crowe methodology: interactive tests, block-based legal templates and a detailed PDF report at the end.",
  "projects.itara-global.desc":
    "A corporate site for a software company: hero, end-to-end IT services, tech stack and social proof — built for speed and conversion.",
  "projects.docusafe.desc":
    "A document-management SaaS platform we built end to end: secure storage, collaborative editing right in the browser, full-text search and async processing.",
  "projects.cgam.desc":
    "The platform for Corporate Governance Academy from Moldova: hands-on negotiation workshops, a gamified league with levels and points, an events calendar and community.",
  "projects.iq-arena.desc":
    "The companion app for CGAM debate and negotiation events: join a table by code or QR, roles are assigned automatically (PRO, CON, jury), the round is timed, and every judge scores 1–5 on the five CGAM criteria — results aggregate in real time, right up to the winner reveal.",

  // --- Team (/05) ---
  "team.label": "TEAM",
  "team.title": "The people behind\nthe code",
  "team.lead":
    "A small, dedicated team that blends business strategy with technical development.",
  "team.social.websiteAria": "{name}'s personal website",
  "team.social.networkAria": "{name} on {network}",
  "team.chistol-maxim.role": "Team Lead & Fullstack Developer",
  "team.danu.role": "Fullstack Developer",
  "team.bales-laurentiu.role": "QA Tester & Pentester",
  "status.0.label": "PROJECTS",
  "status.1.label": "SATISFACTION",
  "status.2.label": "AUTOMATIONS",
  "status.3.label": "AVAILABILITY",

  // --- Partners (/06) ---
  "partners.label": "OUR PARTNERS",
  "partners.title": "Growing\ntogether",
  "partners.lead":
    "We work alongside companies that hold the same standards we do — in audit, consulting and business education. They bring their clients' trust; we bring the technical side.",
  "partners.cta.label": "BECOME A PARTNER",
  "partners.cta.title": "You could be a partner too",
  "partners.cta.text":
    "You work with entrepreneurs every day and see, before anyone else, where a business gets stuck. We build the technical side — software, automation, artificial intelligence — while you stay the person the client trusts. No red tape, no strings: drop us a line, we'll talk, and we'll figure out together what the partnership looks like.",

  // --- Estimator + contact (/07) ---
  "estimator.label": "LET'S BUILD TOGETHER",
  "estimator.title": "Estimate your\nproject price",
  "estimator.lead":
    "Pick the project type, the deadline and the options — then send us the details.",
  "estimator.group.type": "01 · PROJECT TYPE",
  "estimator.group.deadline": "02 · DEADLINE",
  "estimator.group.options": "03 · EXTRA OPTIONS",
  "estimator.price.from": "from {price}",
  "estimator.total.label": "ESTIMATED BALLPARK PRICE",
  "estimator.total.note": "AUTOMATIC ESTIMATE · FINAL PRICE AFTER A CHAT.",
  "estimator.sent.title": "Thank you!",
  "estimator.sent.text":
    "We received your request for {project}. We'll be back soon with a quote.",
  "estimator.sent.reset": "SEND ANOTHER REQUEST",
  "estimator.form.title": "Send the details",
  "estimator.form.sub": "We'll be back with a tailored quote within 24h.",
  "estimator.form.namePlaceholder": "Full name",
  "estimator.form.emailPlaceholder": "Email",
  "estimator.form.phonePlaceholder": "Phone (optional)",
  "estimator.form.messagePlaceholder": "Tell us about your project...",
  "estimator.form.estimateAttached": "ESTIMATE ATTACHED: {price} · {project}",
  "estimator.submit.idle": "Send request ↗",
  "estimator.submit.sending": "Sending…",
  "estimator.error.network":
    "The server isn't responding. Try again in a moment.",
  "estimator.error.failed": "Something went wrong. Please try again.",
  "estimator.field.name": "Name",
  "estimator.field.email": "Email",
  "estimator.field.phone": "Phone",
  "estimator.field.message": "Message",
  "deadlines.urgent.name": "Urgent",
  "deadlines.urgent.note": "under 3 weeks",
  "deadlines.standard.name": "Standard",
  "deadlines.standard.note": "1–2 months",
  "deadlines.flex.name": "Flexible",
  "deadlines.flex.note": "no rush",
  "features.design.label": "+ Premium design",
  "features.integr.label": "+ Integrations & API",
  "features.multi.label": "+ Multilingual",
  "features.admin.label": "+ Admin panel",
  "features.seo.label": "+ SEO",
  "features.aimod.label": "+ AI module",
  "features.support.label": "+ 6-month maintenance",

  // --- Navbar ---
  "nav.services": "SERVICES",
  "nav.work": "WORK",
  "nav.team": "TEAM",
  "nav.partners": "PARTNERS",
  "nav.about": "ABOUT",
  "nav.cta": "START A PROJECT ↗",
  "nav.burgerAria": "Menu",
  "nav.closeAria": "Close",

  // --- Footer ---
  "footer.partnersLabel": "OUR BUSINESS PARTNERS",
  "footer.brandText":
    "We digitize businesses with custom software, mobile apps, automation and AI.",
  "footer.col.nav": "NAVIGATION",
  "footer.col.services": "SERVICES",
  "footer.col.contact": "CONTACT",
  "footer.cta": "Get a price ↗",
  "footer.copyright": "© {year} TBS DIGITAL · ALL RIGHTS RESERVED",
  "footer.madeBy": "BUILT BY THE TBS DIGITAL TEAM",
  "footer.services.0": "Web & Landing",
  "footer.services.1": "Mobile apps",
  "footer.services.2": "CRM & SaaS",
  "footer.services.3": "Automation & AI",
  "footer.social.emailAria": "Email",
  "footer.social.websiteAria": "TBS Digital website",
  "footer.social.networkAria": "TBS Digital on {network}",
  "footer.legal.privacy": "Privacy",
  "footer.legal.cookies": "Cookies",
  "cta.collaborate": "Let's work together →",
  "cta.lead": "Got a project in mind? Let's build it together.",

  // --- Lightbox ---
  "lightbox.dialogAria": "{title} — image {i} of {count}",
  "lightbox.closeAria": "Close",
  "lightbox.imgAlt": "{title} — shot {i}",
  "lightbox.prevAria": "Previous image",
  "lightbox.nextAria": "Next image",

  // --- Validation (form errors; {label}/{max} filled by the field) ---
  "validation.required": "{label} is required.",
  "validation.maxLen": "{label} must be at most {max} characters.",
  "validation.dangerous": "{label} contains disallowed characters or code.",
  "validation.email": "Enter a valid email address.",
  "validation.phone": "Enter a valid phone number.",

  // --- Cookie consent banner ---
  "cookie.text":
    "We use essential cookies to run the site and, with your consent, analytics cookies to understand how it's used. See our",
  "cookie.policyLink": "Cookie Policy",
  "cookie.accept": "Accept",
  "cookie.reject": "Reject",
  "cookie.settings": "Essential only",
};
