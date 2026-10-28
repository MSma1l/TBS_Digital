import { expect, test } from "@playwright/test";
import { LOCALES } from "@/lib/i18n/locales";
import { DIRECTIONS_BASE, LEGACY_DIRECTIONS_BASE, directions } from "@/lib/directions";
import { PUBLIC_PATHS, header, localePath } from "./helpers";

/*
 * Routing: every public page resolves in every language, and every legacy `/solutions/...`
 * address still lands on its renamed `/servicii/...` page WITHOUT losing the language.
 *
 * These are the assertions that only a real server can make: the `/ru` and `/en` prefixes
 * are rewrites configured in next.config.ts, and the language they imply travels to the
 * root layout through the `x-locale` header proxy.ts sets — none of which exists in jsdom.
 */

test.describe("public routes", () => {
  for (const locale of LOCALES) {
    for (const path of PUBLIC_PATHS) {
      const url = localePath(locale, path);
      const smoke = locale === "ro" && path === "/" ? " @smoke" : "";

      test(`${url} renders in ${locale}${smoke}`, async ({ page }) => {
        const response = await page.goto(url);

        expect(response, `no response for ${url}`).not.toBeNull();
        expect(response!.status(), `status for ${url}`).toBe(200);

        // The URL's own locale wins over any cookie/Accept-Language, so `<html lang>` is
        // the single check that proves the prefix reached the server-rendered layout.
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        // The page is really the site, not an error boundary: the header is there and the
        // document has a non-empty title.
        await expect(header(page)).toBeVisible();
        expect((await page.title()).trim().length).toBeGreaterThan(0);
      });
    }
  }

  test("the home page carries the estimate section the CTAs point at", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#estimare")).toBeAttached();
  });

  test("an unknown direction slug is a 404", async ({ page }) => {
    const response = await page.goto(`${DIRECTIONS_BASE}/nu-exista`);
    expect(response?.status()).toBe(404);
  });
});

test.describe("legacy /solutions redirects", () => {
  for (const locale of LOCALES) {
    for (const dir of directions) {
      const from = localePath(locale, `${LEGACY_DIRECTIONS_BASE}/${dir.legacySlug}`);
      const to = localePath(locale, `${DIRECTIONS_BASE}/${dir.slug}`);

      test(`${from} -> ${to} (301, language kept)`, async ({ request }) => {
        const response = await request.get(from, { maxRedirects: 0 });

        expect(response.status(), `status for ${from}`).toBe(301);
        // Relative or absolute Location, both acceptable — what matters is the path, and
        // that the locale prefix survived (a redirect to the bare `/servicii/...` would
        // silently drop a Russian visitor back into Romanian).
        const location = response.headers()["location"];
        expect(location, `Location header for ${from}`).toBeTruthy();
        expect(new URL(location, "http://localhost").pathname).toBe(to);
      });
    }
  }

  test("following a legacy URL end-to-end lands on the new page @smoke", async ({ page }) => {
    const response = await page.goto("/ru/solutions/ai");

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/ru/servicii/asistenti-ia");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });
});

test.describe("SEO wiring the routes depend on", () => {
  test("each locale self-canonicalises and links its hreflang alternates", async ({ page }) => {
    for (const locale of LOCALES) {
      await page.goto(localePath(locale, "/"));

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);

      for (const other of LOCALES) {
        await expect(
          page.locator(`link[rel="alternate"][hreflang="${other}"]`),
          `hreflang=${other} on the ${locale} home page`,
        ).toHaveCount(1);
      }
    }
  });
});
