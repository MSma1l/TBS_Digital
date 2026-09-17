import type { LocalizedText } from "@/lib/i18n/content";

/**
 * The estimator's project types and options, with stable ids.
 *
 * They used to be private to `components/sections/Estimator.tsx`, addressed by position.
 * Other entry points now preselect them — a HUD tool handing its selection to the request
 * dialog, the guide — so they need names a caller can pass through `RequestContext`
 * (`projectType`, `optionIds`), and one home, so a second copy can never drift.
 *
 * The labels are byte-identical to what the estimator has always rendered: the unit and e2e
 * suites find the chips by them ("CRM la comandă", "+ SEO"), and the type label in the
 * visitor's language is what reaches the API as `project`, which the Telegram bot routes on.
 *
 * Pure data, no React: any chunk can import it.
 */

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/** Project type ids, in the order the chips render (`PROJECT_TYPES` follows it). */
export const ESTIMATOR_TYPE_IDS = ["site", "crm", "automation", "ecommerce", "mobile"] as const;
export type EstimatorTypeId = (typeof ESTIMATOR_TYPE_IDS)[number];

/** Option ids, in the order the chips render (`OPTIONS` follows it). */
export const ESTIMATOR_OPTION_IDS = ["design", "integrations", "multilingual", "seo"] as const;
export type EstimatorOptionId = (typeof ESTIMATOR_OPTION_IDS)[number];

export const PROJECT_TYPES: readonly {
  id: EstimatorTypeId;
  label: LocalizedText;
  /** Built-in fallback only — the visitor sees the admin's price (see `SERVICE_FOR_TYPE`). */
  price: string;
}[] = [
  { id: "site", label: L("Site / prezentare", "Сайт / презентация", "Website / landing"), price: "€3.000" },
  { id: "crm", label: L("CRM la comandă", "CRM под заказ", "Custom CRM"), price: "€8.000" },
  { id: "automation", label: L("Automatizare cu AI", "Автоматизация с ИИ", "AI automation"), price: "€5.000" },
  { id: "ecommerce", label: L("E-commerce", "E-commerce", "E-commerce"), price: "€6.000" },
  { id: "mobile", label: L("Aplicație mobilă", "Мобильное приложение", "Mobile app"), price: "€12.000" },
];

/**
 * Estimator type -> the service whose price the admin edits.
 *
 * The prices in `PROJECT_TYPES` are a FALLBACK only. What the visitor sees comes from the
 * admin (`useSiteContent().services`), because the two were drifting badly: the estimator
 * showed "€3.000" for a site while the owner had it priced at 150€ in the panel, and the
 * panel's numbers were rendered nowhere at all — `Services` is not on any page. A price the
 * owner cannot change is a price that goes stale.
 *
 * The estimator has five types and the catalogue has eleven services, so the pairing is
 * written out rather than guessed: `ecommerce` is the `shop` service, the rest share a name.
 */
export const SERVICE_FOR_TYPE: Readonly<Record<EstimatorTypeId, string>> = {
  site: "site",
  crm: "crm",
  automation: "automation",
  ecommerce: "shop",
  mobile: "mobile",
};

export const OPTIONS: readonly { id: EstimatorOptionId; label: LocalizedText }[] = [
  { id: "design", label: L("+ Design premium", "+ Премиум-дизайн", "+ Premium design") },
  { id: "integrations", label: L("+ Integrări & API", "+ Интеграции и API", "+ Integrations & API") },
  { id: "multilingual", label: L("+ Multilingv", "+ Мультиязычность", "+ Multilingual") },
  { id: "seo", label: L("+ SEO", "+ SEO", "+ SEO") },
];

/** What a fresh estimator has ticked when nobody named its options: "+ Integrări & API". */
export const DEFAULT_OPTION_IDS: readonly EstimatorOptionId[] = ["integrations"];

/** A project type id the catalog knows. Anything else (a service id such as "shop", junk) is not one. */
export const isEstimatorTypeId = (v: unknown): v is EstimatorTypeId =>
  typeof v === "string" && (ESTIMATOR_TYPE_IDS as readonly string[]).includes(v);

/** An option id the catalog knows. */
export const isEstimatorOptionId = (v: unknown): v is EstimatorOptionId =>
  typeof v === "string" && (ESTIMATOR_OPTION_IDS as readonly string[]).includes(v);
