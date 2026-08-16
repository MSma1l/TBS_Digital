import { expect, test, type APIRequestContext } from "@playwright/test";
import { THEME_COOKIE } from "@/lib/theme/theme";
import { cookieValue, gotoHydrated, seedTheme, themeToggle } from "./helpers";

/*
 * The light/dark model has three moving parts and each one is checked here:
 *  1. the toggle repaints the page immediately;
 *  2. the choice survives a reload (it lives in the `tbs_theme` cookie, not in memory);
 *  3. with that cookie set, the SERVER already stamps `<html data-theme="dark">` — the page
 *     arrives dark in its first byte, so a dark-mode visitor never sees a white flash.
 * And the negative: with no cookie, nothing is stamped, because the page must stay free to
 * follow `prefers-color-scheme`.
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

test.describe("theme", () => {
  test("the toggle switches the palette @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");

    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    expect(before, "the anti-flash script always stamps an explicit palette").not.toBeNull();

    await themeToggle(page).click();

    const after = before === "dark" ? "light" : "dark";
    await expect(html).toHaveAttribute("data-theme", after);
    // The switch is a state, and it is announced as one.
    await expect(themeToggle(page)).toHaveAttribute(
      "aria-pressed",
      after === "dark" ? "true" : "false",
    );
  });

  test("the choice persists across a reload", async ({ page, context }) => {
    await gotoHydrated(page, "/");

    const html = page.locator("html");
    const start = await html.getAttribute("data-theme");
    const chosen = start === "dark" ? "light" : "dark";

    await themeToggle(page).click();
    await expect(html).toHaveAttribute("data-theme", chosen);

    // The cookie is what carries the choice to the next request.
    expect(await cookieValue(context, THEME_COOKIE)).toBe(chosen);

    await page.reload();
    await expect(html).toHaveAttribute("data-theme", chosen);
  });

  test("with tbs_theme=dark the page is dark in its first byte", async ({ request }) => {
    expect(await serverStampedTheme(request, "/", `${THEME_COOKIE}=dark`)).toBe("dark");
    // Not just the home page — the layout stamps it for every route.
    expect(
      await serverStampedTheme(request, "/servicii/produs-digital", `${THEME_COOKIE}=dark`),
    ).toBe("dark");
  });

  test("with tbs_theme=light the page is light in its first byte", async ({ request }) => {
    expect(await serverStampedTheme(request, "/", `${THEME_COOKIE}=light`)).toBe("light");
  });

  test("without the cookie nothing is stamped (the OS still decides)", async ({ request }) => {
    expect(await serverStampedTheme(request, "/")).toBeNull();
    // A junk value counts as "no choice", not as a third palette.
    expect(await serverStampedTheme(request, "/", `${THEME_COOKIE}=neon`)).toBeNull();
  });

  test("a seeded dark cookie really paints a dark surface", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedTheme(context, "dark", baseURL!);
    await gotoHydrated(page, "/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Cheap luminance check on the page background: a dark theme must not be painting a
    // near-white surface, whatever the exact token values happen to be.
    const luminance = await page.evaluate(() => {
      const rgb = getComputedStyle(document.body).backgroundColor;
      const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ["255", "255", "255"]).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
    expect(luminance, "body background should be dark").toBeLessThan(0.4);
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
