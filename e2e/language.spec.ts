import { expect, test } from "@playwright/test";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import {
  cookieValue,
  gotoHydrated,
  languageGroup,
  languageOption,
  seedLocale,
} from "./helpers";

/*
 * Language: the switcher changes the visible copy instantly (no reload) and the choice
 * survives a reload through the `tbs_locale` cookie, which the root layout reads to SSR the
 * next request in the chosen language.
 *
 * The `/ru` and `/en` URL prefixes are a SEPARATE mechanism (crawlable per-language URLs)
 * and are covered in routes.spec.ts — here everything happens on the cookie-driven `/`.
 */

test.describe("language switcher", () => {
  test("Accept-Language decides the first visit", async ({ page }) => {
    // playwright.config.ts pins `locale: "ro-RO"`, so a fresh visitor gets Romanian.
    await gotoHydrated(page, "/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(languageOption(page, "ro")).toHaveAttribute("aria-pressed", "true");
  });

  test("switching to Russian changes the copy without a reload @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");

    const cta = page.locator("header").first().getByRole("button", {
      name: messages.ro["nav.cta"],
    });
    await expect(cta).toBeVisible();

    await languageOption(page, "ru").click();

    // The catalog swap is a client re-render: same document, new copy.
    await expect(
      page.locator("header").first().getByRole("button", { name: messages.ru["nav.cta"] }),
    ).toBeVisible();
    await expect(languageOption(page, "ru")).toHaveAttribute("aria-pressed", "true");
    await expect(languageOption(page, "ro")).toHaveAttribute("aria-pressed", "false");
    // Assistive tech must be told too — the provider syncs `document.documentElement.lang`.
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  });

  test("the choice persists across a reload", async ({ page, context }) => {
    await gotoHydrated(page, "/");
    await languageOption(page, "en").click();

    expect(await cookieValue(context, LOCALE_COOKIE)).toBe("en");

    await page.reload();

    // After the reload the language comes from the SERVER, not from client state.
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(languageOption(page, "en")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator("header").first().getByRole("button", { name: messages.en["nav.cta"] }),
    ).toBeVisible();
  });

  test("a seeded tbs_locale cookie is honoured on the first byte", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    await seedLocale(context, "ru", baseURL!);
    await gotoHydrated(page, "/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");

    // …and it really is server-side, not a post-hydration correction.
    const html = await (
      await request.get("/", { headers: { cookie: `${LOCALE_COOKIE}=ru` } })
    ).text();
    expect(/<html\b[^>]*\blang="ru"/i.test(html)).toBe(true);
  });

  test("every language is offered, each labelled in its own language", async ({ page }) => {
    await gotoHydrated(page, "/");

    const group = languageGroup(page);
    await expect(group).toBeVisible();
    await expect(group.getByRole("button")).toHaveCount(LOCALES.length);

    for (const locale of LOCALES) {
      await expect(
        group.getByRole("button", { name: LOCALE_LABELS[locale], exact: true }),
      ).toBeVisible();
    }
  });

  test("round-tripping ro -> ru -> en -> ro leaves the site in Romanian", async ({ page }) => {
    await gotoHydrated(page, "/");
    for (const locale of ["ru", "en", "ro"] as const) {
      await languageOption(page, locale).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  });
});
