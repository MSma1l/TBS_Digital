/* ============================================================
   Placeholder content for the TBS Digital landing page.

   This is the SINGLE source of the page's content while we are in the
   UI-only phase. Values here are placeholders — a future admin page /
   FastAPI backend will replace this source without changing the sections.
   See docs/06-placeholder-rules.md and docs/07-conventions.md.
   ============================================================ */

export type Principle = { title: string; desc: string };
export type Stat = { value: string; label: string };
export type Service = { id: string; num: string; name: string; desc: string };
export type WorkPlaceholder = { id: string; grad: string };
export type StatusBar = { label: string; pct: string; val: string };
export type ProjectType = { id: string; name: string; priceLabel: string };
export type Deadline = { id: string; name: string; note: string };
export type Feature = { id: string; label: string };
export type FooterLink = { label: string; href: string };

/** Price values are intentionally stubbed while pricing lives in the backend. */
export const PRICE_PLACEHOLDER = "...";

/* ---------- /02 Principles ---------- */
export const principles: Principle[] = [
  { title: "Strategie\nîntâi", desc: "Înțelegem afacerea înainte de prima linie de cod." },
  { title: "Sisteme\nconectate", desc: "Date, module, automatizări — totul integrat." },
  { title: "Estetică\ndigitală", desc: "Interfețe clare, rapide și plăcute de folosit." },
  { title: "Rezultate\nreale", desc: "Timp economisit, costuri reduse, venituri crescute." },
  { title: "IA\naplicată", desc: "Inteligență artificială acolo unde chiar contează." },
];

/* Stats kept as-is for now (small section, revisited later — see docs/06). */
export const stats: Stat[] = [
  { value: "50+", label: "PROIECTE LIVRATE" },
  { value: "8+", label: "ANI EXPERIENȚĂ" },
  { value: "30+", label: "CLIENȚI" },
  { value: "24/7", label: "AUTOMATIZĂRI" },
];

/* ---------- /03 Services (the "Automatizare cu IA" card is removed) ---------- */
export const services: Service[] = [
  { id: "landing", num: "/01", name: "Landing page", desc: "Pagini rapide care transformă vizitatorii în clienți." },
  { id: "site", num: "/02", name: "Site web / prezentare", desc: "Prezență online completă, rapidă și optimizată SEO." },
  { id: "shop", num: "/03", name: "Magazin online", desc: "eCommerce cu plăți, stocuri și panou de administrare." },
  { id: "mobile", num: "/04", name: "Aplicație mobilă", desc: "Aplicații iOS & Android native sau cross-platform." },
  { id: "crm", num: "/05", name: "CRM personalizat", desc: "Gestionează clienți, lead-uri și vânzări dintr-un loc." },
  { id: "saas", num: "/06", name: "Platformă SaaS", desc: "Produs software scalabil, cu abonamente și utilizatori." },
  { id: "automation", num: "/07", name: "Automatizare procese", desc: "Elimină munca manuală repetitivă prin fluxuri automate." },
  { id: "dashboard", num: "/08", name: "Dashboard & rapoarte", desc: "Toate datele importante, vizualizate la un click." },
  { id: "bot", num: "/09", name: "Bot Telegram", desc: "Asistenți automați pentru suport, vânzări, notificări." },
  { id: "custom", num: "/10", name: "Software personalizat", desc: "Construit exact pe nevoile și fluxurile afacerii tale." },
];

/* ---------- /04 Selected work (placeholder cards, no real content) ---------- */
export const workPlaceholders: WorkPlaceholder[] = [
  { id: "w1", grad: "linear-gradient(135deg,#0b1730,rgba(47,107,255,.6),rgba(56,189,248,.4))" },
  { id: "w2", grad: "linear-gradient(135deg,#0b1730,rgba(56,189,248,.55),rgba(47,107,255,.4))" },
  { id: "w3", grad: "linear-gradient(135deg,#0b1730,rgba(77,130,255,.6),rgba(47,107,255,.4))" },
  { id: "w4", grad: "linear-gradient(135deg,#0b1730,rgba(56,189,248,.55),rgba(47,107,255,.45))" },
];

/* ---------- /05 Team ---------- */
/* Team members are placeholders (populated later from the admin). */
export const teamPlaceholders: { id: string }[] = [
  { id: "t1" },
  { id: "t2" },
  { id: "t3" },
  { id: "t4" },
];

/* SYSTEM_STATUS bars — numeric values kept for now (see stats note above). */
export const statusBars: StatusBar[] = [
  { label: "PROIECTE", pct: "92%", val: "50+" },
  { label: "SATISFACȚIE", pct: "98%", val: "98%" },
  { label: "AUTOMATIZĂRI", pct: "100%", val: "24/7" },
  { label: "DISPONIBILITATE", pct: "99%", val: "ONLINE" },
];

/* ---------- /06 Estimator (all options kept; every price is "...") ---------- */
export const projectTypes: ProjectType[] = [
  { id: "landing", name: "Landing page", priceLabel: PRICE_PLACEHOLDER },
  { id: "site", name: "Site web / prezentare", priceLabel: PRICE_PLACEHOLDER },
  { id: "shop", name: "Magazin online", priceLabel: PRICE_PLACEHOLDER },
  { id: "mobile", name: "Aplicație mobilă", priceLabel: PRICE_PLACEHOLDER },
  { id: "crm", name: "CRM personalizat", priceLabel: PRICE_PLACEHOLDER },
  { id: "saas", name: "Platformă SaaS", priceLabel: PRICE_PLACEHOLDER },
  { id: "automation", name: "Automatizare procese", priceLabel: PRICE_PLACEHOLDER },
  { id: "dashboard", name: "Dashboard & rapoarte", priceLabel: PRICE_PLACEHOLDER },
  { id: "bot", name: "Bot Telegram", priceLabel: PRICE_PLACEHOLDER },
  { id: "ai", name: "Automatizare cu IA", priceLabel: PRICE_PLACEHOLDER },
  { id: "custom", name: "Software personalizat", priceLabel: PRICE_PLACEHOLDER },
];

export const deadlines: Deadline[] = [
  { id: "urgent", name: "Urgent", note: "sub 3 săpt." },
  { id: "standard", name: "Standard", note: "1–2 luni" },
  { id: "flex", name: "Flexibil", note: "fără grabă" },
];

export const features: Feature[] = [
  { id: "design", label: "+ Design premium" },
  { id: "integr", label: "+ Integrări & API" },
  { id: "multi", label: "+ Multilingv" },
  { id: "admin", label: "+ Panou admin" },
  { id: "seo", label: "+ SEO" },
  { id: "aimod", label: "+ Modul IA" },
  { id: "support", label: "+ Mentenanță 6 luni" },
];

/* ---------- Navigation / footer ---------- */
export const navLinks: FooterLink[] = [
  { label: "SERVICII", href: "#servicii" },
  { label: "LUCRĂRI", href: "#lucrari" },
  { label: "ECHIPĂ", href: "#echipa" },
  { label: "DESPRE", href: "#despre" },
];

export const partners: string[] = [
  "PARTENER_01",
  "PARTENER_02",
  "PARTENER_03",
  "PARTENER_04",
  "PARTENER_05",
];

export const footerServices: string[] = [
  "Web & Landing",
  "Aplicații mobile",
  "CRM & SaaS",
  "Automatizare & IA",
];

export const contact = {
  email: "contact@tbsdigital.ro",
  phone: "+373 600 00 000",
};
