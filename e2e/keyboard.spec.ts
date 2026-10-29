import { expect, test, type Page } from "@playwright/test";
import {
  gotoHydrated,
  languageGroup,
  languageOption,
  languageTrigger,
  languageTriggerName,
} from "./helpers";

/*
 * Keyboard access to the header preferences.
 *
 * The language control is a dropdown: Tab reaches its one button, Enter / Space / the arrows
 * open it, and the arrows walk the three choices inside it.
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
  test("Tab reaches the language button @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");

    const presses = await tabTo(page, languageTriggerName("ro"));
    expect(presses).toBeGreaterThan(0);
    await expect(languageTrigger(page)).toBeFocused();
  });

  test("the focus ring is visible on every header control", async ({ page }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, languageTriggerName("ro"));
    expect(await hasVisibleFocusRing(page), "language button focus ring").toBe(true);

    // …and on a choice inside the open dropdown, which focus moves to when it opens.
    await page.keyboard.press("Enter");
    await expect(languageOption(page, "ro")).toBeFocused();
    expect(await hasVisibleFocusRing(page), "language option focus ring").toBe(true);
  });

  test("Enter opens the dropdown and Enter picks a language", async ({ page }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, languageTriggerName("ro"));
    await page.keyboard.press("Enter");
    await expect(languageTrigger(page)).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("ArrowDown");
    await expect(languageOption(page, "ru")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    // Closed again, focus back on the button, which now names the new language.
    await expect(languageTrigger(page)).toHaveAttribute("aria-expanded", "false");
    await expect(languageTrigger(page)).toBeFocused();
    await expect(languageTrigger(page)).toHaveAccessibleName(languageTriggerName("ru"));
  });

  test("the arrow keys move focus inside the dropdown without changing language", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");

    await tabTo(page, languageTriggerName("ro"));
    await page.keyboard.press("ArrowDown"); // opens, on the language in force
    await expect(languageOption(page, "ro")).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(languageOption(page, "ru")).toBeFocused();

    await page.keyboard.press("End");
    await expect(languageOption(page, "en")).toBeFocused();

    await page.keyboard.press("Home");
    await expect(languageOption(page, "ro")).toBeFocused();

    // Moving the focus must never be a silent language change.
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");

    // Escape closes and hands focus back to the button.
    await page.keyboard.press("Escape");
    await expect(languageTrigger(page)).toHaveAttribute("aria-expanded", "false");
    await expect(languageTrigger(page)).toBeFocused();
    await expect(languageGroup(page)).toBeVisible();
  });
});
