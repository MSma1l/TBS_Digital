import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { THEME_COOKIE } from "@/lib/theme/theme";
import { cookieValue, gotoHydrated, seedTheme, themeToggle } from "./helpers";

/*
 * The light/dark model has three moving parts and each one is checked here:
 *  1. the toggle repaints the page immediately;
 *  2. the choice survives a reload (it lives in the `tbs_theme` cookie, not in memory);
 *  3. with that cookie set, the SERVER already stamps `<html data-theme="dark">` — the page
 *     arrives dark in its first byte, with no inline script, so there is no flash.
 * And the default: with no cookie (or a junk one) the server stamps light — the OS preference
 * is not read, so only an explicit dark choice paints dark.
 */

/** Read `data-theme` off the RAW server response — before any script has run. */
async function serverStampedTheme(
  request: APIRequestContext,
  path: string,
  cookie?: string,
): Promise<string | null> {
  const response = await request.get(path, cookie ? { headers: { cookie } } : undefined);
  const html = await response.text();
  const openingTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
  return /data-theme="(light|dark)"/.exec(openingTag)?.[1] ?? null;
}

/** Relative luminance (0–1, sRGB weights) of the page background as painted. */
const bodyLuminance = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const rgb = getComputedStyle(document.body).backgroundColor;
    const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ["255", "255", "255"]).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });

test.describe("theme", () => {
  test("the toggle switches the palette @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(themeToggle(page)).toHaveAttribute("aria-pressed", "false");

    await themeToggle(page).click();

    await expect(html).toHaveAttribute("data-theme", "dark");
    // The switch is a state, and it is announced as one.
    await expect(themeToggle(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("the choice persists across a reload", async ({ page, context }) => {
    await gotoHydrated(page, "/");

    const html = page.locator("html");
    await themeToggle(page).click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    // The cookie is what carries the choice to the next request.
    expect(await cookieValue(context, THEME_COOKIE)).toBe("dark");

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("with tbs_theme=dark the page is dark in its first byte", async ({ request }) => {
    expect(await serverStampedTheme(request, "/", `${THEME_COOKIE}=dark`)).toBe("dark");
    // Not just the home page — the root layout stamps it for every route. Dark, because light
    // is what a route gets with no cookie at all: only the non-default proves it was read.
    expect(
      await serverStampedTheme(request, "/servicii/produs-digital", `${THEME_COOKIE}=dark`),
    ).toBe("dark");
  });

  test("without the cookie the page is light in its first byte", async ({ request }) => {
    expect(await serverStampedTheme(request, "/")).toBe("light");
    expect(await serverStampedTheme(request, "/servicii/produs-digital")).toBe("light");
    // A junk value counts as "no choice", so it gets the default, not a third palette.
    expect(await serverStampedTheme(request, "/", `${THEME_COOKIE}=neon`)).toBe("light");
  });

  // Seeded DARK: a seeded light cookie would pass on the light default alone.
  test("a seeded dark cookie really paints a dark surface", async ({ page, context, baseURL }) => {
    await seedTheme(context, "dark", baseURL!);
    await gotoHydrated(page, "/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    // Cheap luminance check: the dark palette must not be painting a near-white surface,
    // whatever the exact token values happen to be.
    expect(await bodyLuminance(page), "body background should be dark").toBeLessThan(0.4);
  });

  test("with no cookie the default really paints a light surface", async ({ page }) => {
    await gotoHydrated(page, "/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await bodyLuminance(page), "body background should be light").toBeGreaterThan(0.6);
  });

  test("the dark choice follows the visitor onto another page", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedTheme(context, "dark", baseURL!);
    await gotoHydrated(page, "/en/servicii/e-commerce");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
