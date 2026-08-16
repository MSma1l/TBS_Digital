import { expect, test, type Page } from "@playwright/test";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { gotoHydrated, languageGroup, languageOption, themeToggle } from "./helpers";

/*
 * Keyboard access to the header preferences.
 *
 * Everything here is a real <button>, so the browser gives Tab / Enter / Space for free —
 * the point of these tests is to prove nothing (a tabindex, an overlay, a custom key
 * handler) has taken that away, and that the focus ring is actually drawn.
 */

/** Press Tab until the accessible name of the focused element matches, or give up. */
async function tabTo(page: Page, name: string, max = 40): Promise<number> {
  for (let i = 1; i <= max; i += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "";
    });
    if (focused === name) return i;
  }
  throw new Error(`"${name}" was not reachable with ${max} Tab presses`);
}

/** True when the element is showing a real focus ring (Chromium `:focus-visible`). */
async function hasVisibleFocusRing(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    if (!el.matches(":focus-visible")) return false;
    const style = getComputedStyle(el);
    const outlineDrawn =
      style.outlineStyle !== "none" && parseFloat(style.outlineWidth || "0") > 0;
    // An outline is what this design uses, but accept a ring drawn as a box-shadow too.
    return outlineDrawn || style.boxShadow !== "none";
  });
}

test.describe("keyboard", () => {
  test("Tab reaches the language options and the theme toggle @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");

    const toRo = await tabTo(page, LOCALE_LABELS.ro);
    expect(toRo).toBeGreaterThan(0);
    await expect(languageOption(page, "ro")).toBeFocused();

    await tabTo(page, LOCALE_LABELS.ru);
    await expect(languageOption(page, "ru")).toBeFocused();

    await tabTo(page, messages.ro["theme.toggleAria"]);
    await expect(themeToggle(page)).toBeFocused();
  });

  test("the focus ring is visible on every header control", async ({ page }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, LOCALE_LABELS.ro);
    expect(await hasVisibleFocusRing(page), "language option focus ring").toBe(true);

    await tabTo(page, messages.ro["theme.toggleAria"]);
    expect(await hasVisibleFocusRing(page), "theme toggle focus ring").toBe(true);
  });

  test("Enter activates the theme toggle", async ({ page }) => {
    await gotoHydrated(page, "/");
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");

    await tabTo(page, messages.ro["theme.toggleAria"]);
    await page.keyboard.press("Enter");

    await expect(html).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
  });

  test("Space activates the theme toggle too", async ({ page }) => {
    await gotoHydrated(page, "/");
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");

    await tabTo(page, messages.ro["theme.toggleAria"]);
    await page.keyboard.press("Space");

    await expect(html).toHaveAttribute("data-theme", before === "dark" ? "light" : "dark");
  });

  test("Enter picks a language", async ({ page }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, LOCALE_LABELS.ru);
    await page.keyboard.press("Enter");

    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(languageOption(page, "ru")).toHaveAttribute("aria-pressed", "true");
  });

  test("the arrow keys move focus inside the language group without changing language", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, LOCALE_LABELS.ro);
    await page.keyboard.press("ArrowRight");
    await expect(languageOption(page, "ru")).toBeFocused();

    await page.keyboard.press("End");
    await expect(languageOption(page, "en")).toBeFocused();

    await page.keyboard.press("Home");
    await expect(languageOption(page, "ro")).toBeFocused();

    // Moving the focus must never be a silent language change.
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(languageGroup(page)).toBeVisible();
  });
});
