/* ============================================================
   Placeholder content for the TBS Digital landing page.

   This is the SINGLE source of the page's content while we are in the
   UI-only phase. Values here are placeholders — a future admin page /
   FastAPI backend will replace this source without changing the sections.
   See docs/06-placeholder-rules.md and docs/07-conventions.md.
   ============================================================ */

import { locFromCatalog, locRo, type LocalizedText } from "@/lib/i18n/content";
import type { MessageKey } from "@/lib/i18n/messages";

export type Principle = { title: string; desc: string };
/**
 * A service is the single source for both the /03 cards and the /06 estimator.
 * `name`, `desc` and `price` are localized (`{ ro, ru, en }`) — the admin edits all
 * three languages and the section resolves the active one with `loc()`. `price` feeds
 * the estimator; `estimatorOnly` keeps an option (e.g. AI) in the estimator without
 * showing a card on the homepage grid. The `/NN` card label is computed from position
 * (so adding/removing services renumbers automatically).
 */
export type Service = {
  id: string;
  name: LocalizedText;
  desc: LocalizedText;
  price: LocalizedText;
  estimatorOnly?: boolean;
};
/**
 * A business partner shown in the /06 strip and the footer. `logo` is either a
 * bundled asset under `public/partners/` or the path returned by the admin's logo
 * upload (`/api/uploads/…`); a partner with no logo falls back to its name as a
 * wordmark. Both `logo` and `url` are optional.
 */
export type Partner = {
  id: string;
  name: string;
  logo: string;
  url: string;
  /** Screenshot of the partner's site, revealed on hover (shown outright on mobile). */
  preview: string;
};

/**
 * A delivered project on the /04 grid. `images` is the card's gallery — the card
 * rotates through them and they open in a lightbox. `appStore` / `playStore` are the
 * mobile download links; a card only renders the button whose link is actually set, so
 * a web-only project has neither and a mobile app can have one or both.
 */
export type Project = {
  id: string;
  /** Proper noun — a single string, not localized. */
  name: string;
  tag: LocalizedText;
  desc: LocalizedText;
  url: string;
  appStore: string;
  playStore: string;
  images: string[];
};

/**
 * The social networks a team member or the company can link to. A link is optional
 * everywhere: an icon is rendered only for the networks whose URL is actually set, so an
 * empty field simply means no icon — never a dead link.
 */
export const SOCIAL_NETWORKS = [
  "website",
  "linkedin",
  "instagram",
  "facebook",
  "github",
  "telegram",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** One company-wide social link, shown in the footer. */
export type Social = { id: string; type: SocialNetwork; url: string };

export type ContactType = "email" | "phone" | "other";
export type Contact = { id: string; type: ContactType; value: string };
export type WorkPlaceholder = { id: string; grad: string };
export type StatusBar = { label: string; pct: string; val: string };
export type Deadline = { id: string; name: string; note: string };
export type Feature = { id: string; label: string };
export type FooterLink = { label: string; href: string };

/** Price values are intentionally stubbed while pricing lives in the backend. */
export const PRICE_PLACEHOLDER = "...";

/** The default price is the "..." placeholder in every language until the admin sets a
 *  real, fully localized price (e.g. "de la 400€" / "от 400€" / "from 400€"). A fresh
 *  object per service keeps admin edits from bleeding across services. */
const pricePlaceholder = (): LocalizedText => ({
  ro: PRICE_PLACEHOLDER,
  ru: PRICE_PLACEHOLDER,
  en: PRICE_PLACEHOLDER,
});

/* ---------- /02 Principles ---------- */
export const principles: Principle[] = [
  { title: "Strategie\nîntâi", desc: "Înțelegem afacerea înainte de prima linie de cod." },
  { title: "Sisteme\nconectate", desc: "Date, module, automatizări — totul integrat." },
  { title: "Estetică\ndigitală", desc: "Interfețe clare, rapide și plăcute de folosit." },
  { title: "Rezultate\nreale", desc: "Timp economisit, costuri reduse, venituri crescute." },
  { title: "IA\naplicată", desc: "Inteligență artificială acolo unde chiar contează." },
];

/* Stats are blank placeholders — values/labels come later from the admin. */
export const statPlaceholders: { id: string }[] = [
  { id: "s1" },
  { id: "s2" },
  { id: "s3" },
  { id: "s4" },
];

/* ---------- Services — single source for /03 cards AND /06 estimator ----------
   The "Automatizare cu IA" entry is `estimatorOnly`: it appears in the estimator
   but has no card on the /03 grid. `price` is the "..." placeholder until the
   admin sets it. */
/** Build a service's trilingual defaults from the message catalog. The service `id`
 *  is the catalog key segment, so `name`/`desc` come from `services.<id>.name|desc`. */
const service = (
  id: string,
  extra?: Partial<Pick<Service, "estimatorOnly">>,
): Service => ({
  id,
  name: locFromCatalog(`services.${id}.name` as MessageKey),
  desc: locFromCatalog(`services.${id}.desc` as MessageKey),
  price: pricePlaceholder(),
  ...extra,
});

export const services: Service[] = [
  service("landing"),
  service("site"),
  service("shop"),
  service("mobile"),
  service("crm"),
  service("saas"),
  service("automation"),
  service("dashboard"),
  service("bot"),
  service("ai", { estimatorOnly: true }),
  service("custom"),
];

/* ---------- /04 Selected work ----------
   Real projects. Screenshots live in `public/projects/` and each card rotates through its
   gallery. Editable from the admin, where new screenshots can be uploaded. DocuSafe and
   Fayr Family ship with no gallery yet, and every store link starts empty — the card
   renders fine without any of them (a store button only appears once its link is set). */
export const projects: Project[] = [
  {
    id: "bizcheck",
    name: "BizCheck",
    tag: locFromCatalog("projects.tag.web"),
    desc: locFromCatalog("projects.bizcheck.desc"),
    url: "https://bizcheck.md",
    appStore: "",
    playStore: "",
    images: [
      "/projects/bizcheck-1.jpg",
      "/projects/bizcheck-2.png",
      "/projects/bizcheck-3.png",
      "/projects/bizcheck-4.png",
    ],
  },
  {
    id: "itara-global",
    name: "Itara Global",
    tag: locFromCatalog("projects.tag.corporate"),
    desc: locFromCatalog("projects.itara-global.desc"),
    url: "https://itara-global.md",
    appStore: "",
    playStore: "",
    images: [
      "/projects/itara-1.jpg",
      "/projects/itara-2.png",
      "/projects/itara-3.png",
      "/projects/itara-4.png",
    ],
  },
  {
    id: "docusafe",
    name: "DocuSafe",
    tag: locFromCatalog("projects.tag.saas"),
    desc: locFromCatalog("projects.docusafe.desc"),
    url: "https://docusafe.tbs.md",
    appStore: "",
    playStore: "",
    images: [],
  },
  {
    id: "cgam",
    name: "CGAM",
    tag: locFromCatalog("projects.tag.web"),
    desc: locFromCatalog("projects.cgam.desc"),
    url: "https://cgam.md",
    appStore: "",
    playStore: "",
    images: [
      "/projects/cgam-1.png",
      "/projects/cgam-2.png",
      "/projects/cgam-3.jpg",
      "/projects/cgam-4.png",
    ],
  },
  {
    id: "iq-arena",
    name: "IQ Arena",
    tag: locFromCatalog("projects.tag.mobile"),
    desc: locFromCatalog("projects.iq-arena.desc"),
    url: "",
    appStore: "",
    playStore: "",
    images: [
      "/projects/iq-arena-1.png",
      "/projects/iq-arena-2.png",
      "/projects/iq-arena-3.png",
      "/projects/iq-arena-4.png",
    ],
  },
  {
    id: "fayr-family",
    name: "Fayr Family",
    tag: locFromCatalog("projects.tag.mobile"),
    // No seed description yet — blank in every language (ru/en fall back to ro at render).
    desc: locRo(""),
    url: "",
    appStore: "",
    playStore: "",
    images: [],
  },
];

/* ---------- /05 Team ----------
   The real team. Photos, bios and social links are filled in from the admin: a member
   with no photo falls back to the gradient avatar, and a social icon appears only for a
   network whose URL is actually set — so an empty field is simply no icon, never a dead
   link. */
export type TeamMember = {
  id: string;
  /** Proper noun — a single string, not localized. */
  name: string;
  role: LocalizedText;
  bio: LocalizedText;
  photo: string;
  website: string;
  linkedin: string;
  instagram: string;
  facebook: string;
  github: string;
};

/** The member `id` is the catalog key segment, so `role` seeds from `team.<id>.role`.
   `bio` starts blank in every language (filled in from the admin). */
const member = (id: string, name: string): TeamMember => ({
  id,
  name,
  role: locFromCatalog(`team.${id}.role` as MessageKey),
  bio: locRo(""),
  photo: "",
  website: "",
  linkedin: "",
  instagram: "",
  facebook: "",
  github: "",
});

/* First names only — that is how the team is introduced on the site. The ids stay as they
   are: they are the stable keys the admin's saved content is matched on, so renaming them
   would orphan whatever has already been filled in. */
export const team: TeamMember[] = [
  member("chistol-maxim", "Maxim"),
  member("danu", "Danu"),
  member("bales-laurentiu", "Laurentiu"),
];

/* ---------- Company socials (footer) ----------
   Same rule as the team: an icon shows up only once its URL is set from the admin. */
export const socials: Social[] = [
  { id: "s-telegram", type: "telegram", url: "" },
  { id: "s-linkedin", type: "linkedin", url: "" },
  { id: "s-github", type: "github", url: "" },
];

/* SYSTEM_STATUS bars — numeric values kept for now (see stats note above). */
export const statusBars: StatusBar[] = [
  { label: "PROIECTE", pct: "92%", val: "50+" },
  { label: "SATISFACȚIE", pct: "98%", val: "98%" },
  { label: "AUTOMATIZĂRI", pct: "100%", val: "24/7" },
  { label: "DISPONIBILITATE", pct: "99%", val: "ONLINE" },
];

/* ---------- /06 Estimator ----------
   The project-type list IS the services list above (name + price), so the two
   sections can never drift apart. Deadlines/features are estimator-only. */
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
  { label: "PARTENERI", href: "#parteneri" },
  { label: "DESPRE", href: "#despre" },
];

/* ---------- /06 Partners ----------
   Logos are monochrome-white PNGs on transparent backgrounds (the strip renders on
   the dark background). Editable from the admin, where a new logo can be uploaded. */
export const partners: Partner[] = [
  {
    id: "crowe",
    name: "Crowe Turcan Mikhailenko",
    logo: "/partners/crowe.png",
    url: "https://crowe-tm.md",
    preview: "/partners/previews/crowe.png",
  },
  {
    id: "cgam",
    name: "CGAM Business Academy",
    logo: "/partners/cgam.png",
    url: "https://cgam.md",
    preview: "/partners/previews/cgam.png",
  },
  {
    id: "ivan-turcan",
    name: "Ivan Turcan",
    logo: "/partners/ivan-turcan.png",
    url: "https://turcan.md",
    preview: "/partners/previews/ivan-turcan.png",
  },
];

/** Where a prospective partner writes to (the /06 call to action). */
export const partnershipEmail = "office@crowe-tm.md";

export const footerServices: string[] = [
  "Web & Landing",
  "Aplicații mobile",
  "CRM & SaaS",
  "Automatizare & IA",
];

export const contacts: Contact[] = [
  { id: "c-email", type: "email", value: "contact@tbsdigital.ro" },
  { id: "c-phone", type: "phone", value: "+373 600 00 000" },
];
