import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPTION_IDS,
  ESTIMATOR_OPTION_IDS,
  ESTIMATOR_TYPE_IDS,
  OPTIONS,
  PROJECT_TYPES,
  SERVICE_FOR_TYPE,
  isEstimatorOptionId,
  isEstimatorTypeId,
} from "@/lib/request/catalog";
import { GUIDE_TOPICS, isGuideTopic } from "@/lib/hud/topics";
import { SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import { services as seededServices } from "@/lib/content";

/*
 * The estimator's catalog (lib/request/catalog.ts) and the guide's topics (lib/hud/topics.ts):
 * the ids other entry points pass through `RequestContext`, and the guards the estimator reads
 * them with.
 *
 * The labels are pinned as literal strings on purpose. They moved out of Estimator.tsx
 * byte for byte, and three things depend on those exact bytes: the chips' accessible names
 * (unit and e2e suites click "CRM la comandă", "+ SEO"), the `project` field the API stores,
 * and the Telegram routing that reads that field.
 */

/** Values a context could carry by mistake: other id spaces, casing, prototype keys, non-strings. */
const JUNK: unknown[] = [
  "",
  " site",
  "Site",
  "shop",
  "e-commerce",
  "__proto__",
  "toString",
  "constructor",
  null,
  undefined,
  0,
  1,
  true,
  {},
  [],
  ["site"],
];

describe("project types", () => {
  it("lists the five types in the order the chips render, ids in step with the id list", () => {
    expect(ESTIMATOR_TYPE_IDS).toEqual(["site", "crm", "automation", "ecommerce", "mobile"]);
    expect(PROJECT_TYPES.map((p) => p.id)).toEqual([...ESTIMATOR_TYPE_IDS]);
  });

  it("keeps the labels and fallback prices the estimator has always rendered", () => {
    expect(PROJECT_TYPES).toEqual([
      { id: "site", label: { ro: "Site / prezentare", ru: "Сайт / презентация", en: "Website / landing" }, price: "€3.000" },
      { id: "crm", label: { ro: "CRM la comandă", ru: "CRM под заказ", en: "Custom CRM" }, price: "€8.000" },
      { id: "automation", label: { ro: "Automatizare cu AI", ru: "Автоматизация с ИИ", en: "AI automation" }, price: "€5.000" },
      { id: "ecommerce", label: { ro: "E-commerce", ru: "E-commerce", en: "E-commerce" }, price: "€6.000" },
      { id: "mobile", label: { ro: "Aplicație mobilă", ru: "Мобильное приложение", en: "Mobile app" }, price: "€12.000" },
    ]);
  });

  it("pairs every type with a service the admin actually prices", () => {
    expect(SERVICE_FOR_TYPE).toEqual({
      site: "site",
      crm: "crm",
      automation: "automation",
      ecommerce: "shop",
      mobile: "mobile",
    });
    const serviceIds = seededServices.map((s) => s.id);
    for (const id of ESTIMATOR_TYPE_IDS) expect(serviceIds).toContain(SERVICE_FOR_TYPE[id]);
  });

  it("maps every direction slug onto a type the catalog knows", () => {
    // A slug mapped to a type that is not here would silently land on the first chip.
    for (const type of Object.values(SERVICE_TO_ESTIMATOR_TYPE)) {
      expect(isEstimatorTypeId(type)).toBe(true);
    }
  });

  it("accepts exactly the type ids", () => {
    for (const id of ESTIMATOR_TYPE_IDS) expect(isEstimatorTypeId(id)).toBe(true);
    for (const value of [...JUNK, "design", "servicii"]) {
      expect(isEstimatorTypeId(value)).toBe(false);
    }
  });
});

describe("options", () => {
  it("lists the four options in the order the chips render, ids in step with the id list", () => {
    expect(ESTIMATOR_OPTION_IDS).toEqual(["design", "integrations", "multilingual", "seo"]);
    expect(OPTIONS.map((o) => o.id)).toEqual([...ESTIMATOR_OPTION_IDS]);
  });

  it("keeps the labels the estimator has always rendered", () => {
    expect(OPTIONS).toEqual([
      { id: "design", label: { ro: "+ Design premium", ru: "+ Премиум-дизайн", en: "+ Premium design" } },
      { id: "integrations", label: { ro: "+ Integrări & API", ru: "+ Интеграции и API", en: "+ Integrations & API" } },
      { id: "multilingual", label: { ro: "+ Multilingv", ru: "+ Мультиязычность", en: "+ Multilingual" } },
      { id: "seo", label: { ro: "+ SEO", ru: "+ SEO", en: "+ SEO" } },
    ]);
  });

  it("ticks '+ Integrări & API' by default, as the estimator always has", () => {
    expect(DEFAULT_OPTION_IDS).toEqual(["integrations"]);
  });

  it("accepts exactly the option ids", () => {
    for (const id of ESTIMATOR_OPTION_IDS) expect(isEstimatorOptionId(id)).toBe(true);
    for (const value of [...JUNK, "SEO", "+ SEO", "crm"]) {
      expect(isEstimatorOptionId(value)).toBe(false);
    }
  });
});

describe("guide topics", () => {
  it("names the three areas the guide can talk about", () => {
    expect(GUIDE_TOPICS).toEqual(["servicii", "lucrari", "service"]);
  });

  it("accepts exactly those ids — they are written into the lead verbatim", () => {
    for (const topic of GUIDE_TOPICS) expect(isGuideTopic(topic)).toBe(true);
    for (const value of [...JUNK, "Servicii", "despre", "<b>servicii</b>", "servicii\n- Sursă (CTA): hero"]) {
      expect(isGuideTopic(value)).toBe(false);
    }
  });
});

describe("one source", () => {
  it("leaves no second copy of the lists inside the estimator", () => {
    const estimator = readFileSync(
      resolve(process.cwd(), "components/sections/Estimator.tsx"),
      "utf8",
    );
    expect(estimator).toContain('from "@/lib/request/catalog"');
    expect(estimator).not.toMatch(/\bconst (PROJECT_TYPES|SERVICE_FOR_TYPE|OPTIONS)\b/);
  });
});
