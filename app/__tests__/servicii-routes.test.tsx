/**
 * Route contract for the direction pages.
 *
 * These pages were renamed from `/solutions/<english-slug>` to `/servicii/<romanian-slug>`
 * while the old URLs were already indexed. Three things must therefore stay true at once,
 * and each is spread across a different file:
 *
 *   1. `lib/directions.ts` owns the slugs and the old → new mapping;
 *   2. `next.config.ts` repeats that mapping as a literal, because the Next config loader
 *      cannot resolve the `@/` alias — a comment there points at this file;
 *   3. `app/(site)/servicii/[slug]/page.tsx` pre-renders exactly those slugs and refuses
 *      everything else.
 *
 * A drift between any two of them is a dead link or a lost redirect, neither of which
 * shows up in a build. That is what these tests exist to catch.
 */
import { describe, it, expect } from "vitest";
import {
  directions,
  directionHref,
  directionPaths,
  legacyDirectionRedirects,
  DIRECTIONS_BASE,
  LEGACY_DIRECTIONS_BASE,
} from "@/lib/directions";
import nextConfig from "../../next.config";
import { generateStaticParams, dynamicParams } from "../(site)/servicii/[slug]/page";

/** The URLs the client signed off on, written out rather than derived. */
const EXPECTED_PATHS = [
  "/servicii/produs-digital",
  "/servicii/e-commerce",
  "/servicii/automatizare-api",
  "/servicii/asistenti-ia",
  "/servicii/brand-ui",
];

const LOCALE_PREFIXES = ["", "/ru", "/en"];

describe("direction slugs", () => {
  it("exposes exactly the five agreed paths, in order", () => {
    expect(directionPaths()).toEqual(EXPECTED_PATHS);
  });

  it("has no duplicate slug and no duplicate legacy slug", () => {
    const slugs = directions.map((d) => d.slug);
    const legacy = directions.map((d) => d.legacySlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(legacy).size).toBe(legacy.length);
  });

  it("uses no english slug and no uppercase in the public URLs", () => {
    for (const path of directionPaths()) {
      expect(path.startsWith(`${DIRECTIONS_BASE}/`)).toBe(true);
      expect(path).toBe(path.toLowerCase());
      expect(path).not.toContain(LEGACY_DIRECTIONS_BASE);
    }
  });
});

describe("directionHref", () => {
  it("resolves a current slug to its own page", () => {
    expect(directionHref("produs-digital")).toBe("/servicii/produs-digital");
  });

  it("resolves a LEGACY slug to the NEW page, so old call sites can't emit a dead link", () => {
    // The /02 section still identifies a direction by its old key.
    expect(directionHref("digital")).toBe("/servicii/produs-digital");
    expect(directionHref("ecommerce")).toBe("/servicii/e-commerce");
    expect(directionHref("automation")).toBe("/servicii/automatizare-api");
    expect(directionHref("ai")).toBe("/servicii/asistenti-ia");
    expect(directionHref("brand")).toBe("/servicii/brand-ui");
  });

  it("passes an unknown key through instead of silently dropping it", () => {
    expect(directionHref("habar-n-am")).toBe("/servicii/habar-n-am");
  });
});

describe("the page pre-renders exactly those slugs", () => {
  it("generateStaticParams matches lib/directions", () => {
    expect(generateStaticParams()).toEqual(directions.map((d) => ({ slug: d.slug })));
  });

  it("refuses unknown slugs at the route level (404, not a rendered empty page)", () => {
    // dynamicParams=false makes Next 404 anything outside generateStaticParams.
    expect(dynamicParams).toBe(false);
  });
});

describe("legacy redirects", () => {
  it("maps every old path to its new one", () => {
    expect(legacyDirectionRedirects()).toEqual([
      { from: "/solutions/digital", to: "/servicii/produs-digital" },
      { from: "/solutions/ecommerce", to: "/servicii/e-commerce" },
      { from: "/solutions/automation", to: "/servicii/automatizare-api" },
      { from: "/solutions/ai", to: "/servicii/asistenti-ia" },
      { from: "/solutions/brand", to: "/servicii/brand-ui" },
    ]);
  });

  it("next.config.ts stays in sync with lib/directions.ts", async () => {
    // The config repeats the table as a literal (it cannot import through `@/`), so the
    // copy is only safe while this assertion holds.
    const rules = await nextConfig.redirects!();
    const bare = rules
      .filter((r) => r.source.startsWith("/solutions/"))
      .map((r) => ({ from: r.source, to: r.destination }));
    expect(bare).toEqual(legacyDirectionRedirects());
  });

  it("redirects each legacy URL in all three languages, landing on the same language", async () => {
    const rules = await nextConfig.redirects!();
    for (const prefix of LOCALE_PREFIXES) {
      for (const { from, to } of legacyDirectionRedirects()) {
        const rule = rules.find((r) => r.source === `${prefix}${from}`);
        expect(rule, `missing redirect for ${prefix}${from}`).toBeDefined();
        // A Russian visitor on an old link must not be dumped into Romanian.
        expect(rule!.destination).toBe(`${prefix}${to}`);
      }
    }
  });

  it("uses 301 (not 308), which is what crawlers and legacy clients follow", async () => {
    const rules = await nextConfig.redirects!();
    for (const rule of rules.filter((r) => r.source.includes("/solutions/"))) {
      expect(rule.statusCode).toBe(301);
    }
  });

  it("covers every legacy path — none left to rot as a 404", async () => {
    const rules = await nextConfig.redirects!();
    const covered = new Set(rules.map((r) => r.source));
    const expected = LOCALE_PREFIXES.flatMap((p) =>
      legacyDirectionRedirects().map(({ from }) => `${p}${from}`),
    );
    for (const path of expected) {
      expect(covered.has(path), `${path} would 404`).toBe(true);
    }
  });
});
