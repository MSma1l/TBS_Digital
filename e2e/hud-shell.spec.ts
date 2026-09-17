import { expect, test, type Page } from "@playwright/test";
import { CONSENT_KEY } from "@/lib/consent";
import { LOCALES } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";
import { navMenu } from "@/lib/content";
import {
  MIN_TAP_TARGET,
  burgerRoundTrip,
  cookieBanner,
  cookieValue,
  expectNoHorizontalScroll,
  gotoHydrated,
  header,
  languageGroup,
  modalDialog,
  seedConsent,
  seedLocale,
  seedTheme,
} from "./helpers";

/*
 * The HUD first screen for a RETURNING visitor (gotoHydrated seeds the intro away): the
 * header and its Chișinău clock, the static hero, the restyled cookie banner (unblurred and
 * opaque on phones), the neon CTAs' focus ring, the ticker, the burger menu's scroll lock
 * and the desktop dropdowns (Escape closes a hover-opened one too).
 */

const ro = messages.ro;

/** A catalog label as an exact, case-insensitive name (the banner uppercases in CSS only). */
const exactName = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

const barClock = (page: Page) => header(page).locator('[data-clock="bar"]');

test.describe("header clock — Chișinău time, whatever the visitor's time zone", () => {
  // A visitor in New York: the browser's own clock says 05:04:08 (EDT) for the instant below.
  test.use({ timezoneId: "America/New_York", viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("summer: 12:04:08 UTC+3", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-07-15T09:04:08Z"));
    await gotoHydrated(page, "/");

    const clock = barClock(page);
    await expect(clock).toBeVisible();
    await expect(clock).toContainText(ro["header.sysTime"]);
    await expect(clock).toContainText("12:04:08");
    await expect(clock).toContainText("UTC+3");
    await expect(clock).not.toContainText("05:04:08");
    await expect(clock).toHaveAttribute("aria-hidden", "true");
  });

  test("winter: 12:04:08 UTC+2", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-01-15T10:04:08Z"));
    await gotoHydrated(page, "/");

    const clock = barClock(page);
    await expect(clock).toContainText("12:04:08");
    await expect(clock).toContainText("UTC+2");
    await expect(clock).not.toContainText("UTC+3");
  });
});

test.describe("returning visit", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("is static: header and headline don't move after hydration, and nothing is styled", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const h1 = page.locator("h1");
    const first = { header: await header(page).boundingBox(), h1: await h1.boundingBox() };

    await page.waitForTimeout(1_000);

    expect(await header(page).boundingBox()).toEqual(first.header);
    expect(await h1.boundingBox()).toEqual(first.h1);
    await expect(h1).toHaveCSS("opacity", "1");
    expect(await page.locator(`[${INTRO_REVEAL_ATTR}][style]`).count()).toBe(0);
    expect(await page.locator(`[${INTRO_REVEAL_ATTR}]`).count()).toBe(8);
  });
});

test.describe("cookie banner", () => {
  test("is visible and focused, names its choices, and Escape means essential only", async ({
    page,
    context,
  }) => {
    await gotoHydrated(page, "/");

    const banner = cookieBanner(page);
    await expect(banner).toBeVisible();
    await expect(banner).toBeFocused();
    await expect(banner.getByRole("button", { name: exactName(ro["cookie.settings"]) })).toBeVisible();
    await expect(banner.getByRole("button", { name: exactName(ro["cookie.accept"]) })).toBeVisible();
    await expect(modalDialog(page)).toHaveCount(0);

    await page.keyboard.press("Escape");

    await expect(banner).toHaveCount(0);
    expect(await cookieValue(context, CONSENT_KEY)).toBe("rejected");
    await expect(modalDialog(page)).toHaveCount(0);
  });

  test.describe("at 375px", () => {
    test.use({ viewport: { width: 375, height: 780 } });

    test("both buttons are 44px targets and the banner stays inside the viewport", async ({
      page,
    }) => {
      await gotoHydrated(page, "/");
      const banner = cookieBanner(page);
      await expect(banner).toBeVisible();
      // The rise animation moves it; measure where it comes to rest.
      await page.waitForTimeout(600);

      for (const key of ["cookie.settings", "cookie.accept"] as const) {
        const box = (await banner.getByRole("button", { name: exactName(ro[key]) }).boundingBox())!;
        expect(Math.round(box.height), `${key} height`).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
      }
      const box = (await banner.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect(box.y + box.height).toBeLessThanOrEqual(780);
      await expectNoHorizontalScroll(page);
    });
  });
});

test.describe("cookie banner on a phone", () => {
  for (const width of [390, 320]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: 780 } });

      test("is an opaque panel with no backdrop blur (nothing animates under a blur)", async ({
        page,
      }) => {
        await gotoHydrated(page, "/");
        const banner = cookieBanner(page);
        await expect(banner).toBeVisible();

        const style = await banner.evaluate((el) => {
          const cs = getComputedStyle(el);
          return {
            backdrop: cs.backdropFilter,
            webkitBackdrop: cs.getPropertyValue("-webkit-backdrop-filter"),
            background: cs.backgroundColor,
          };
        });
        expect(style.backdrop).toBe("none");
        expect(style.webkitBackdrop === "" || style.webkitBackdrop === "none").toBe(true);
        // rgb(), never rgba(): fully opaque, so the hero numerals cannot ghost through.
        expect(style.background).toMatch(/^rgb\(/);
      });
    });
  }
});

test.describe("neon CTA focus ring", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`is drawn in --txt, 2px outside the button (${theme})`, async ({
      page,
      context,
      baseURL,
    }) => {
      await seedConsent(context, baseURL!);
      await seedTheme(context, theme, baseURL!);
      await gotoHydrated(page, "/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const cta = header(page).getByRole("button", { name: ro["nav.cta"], exact: true });
      // Resting: a transparent 1px outline, which forced-colours mode paints as a border.
      await expect(cta).toHaveCSS("outline-style", "solid");
      await expect(cta).toHaveCSS("outline-width", "1px");
      await expect(cta).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");

      await cta.focus();
      await expect(cta).toBeFocused();
      const ring = await cta.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          focusVisible: el.matches(":focus-visible"),
          color: cs.outlineColor,
          width: cs.outlineWidth,
          offset: cs.outlineOffset,
          txt: getComputedStyle(document.body).color,
        };
      });
      expect(ring.focusVisible).toBe(true);
      expect(ring.color).toBe(ring.txt);
      expect(ring.width).toBe("2px");
      expect(ring.offset).toBe("2px");
    });
  }
});

test.describe("ticker", () => {
  test("is one decorative strip with hairline separators, never dots", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/");

    const ticker = page.locator("[data-ticker]");
    await expect(ticker).toHaveCount(1);
    await expect(ticker).toHaveAttribute("aria-hidden", "true");
    expect(await ticker.locator("[data-ticker-sep]").count()).toBeGreaterThan(0);

    const separator = await ticker
      .locator("[data-ticker-sep]")
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          radius: style.borderTopLeftRadius,
          width: style.width,
          height: style.height,
        };
      });
    expect(separator.radius).toBe("0px");
    expect(parseFloat(separator.width)).toBeLessThanOrEqual(2);
    expect(parseFloat(separator.height)).toBeGreaterThanOrEqual(12);
  });
});

test.describe("header row", () => {
  for (const width of [861, 1024, 1180]) {
    for (const locale of LOCALES) {
      test.describe(`${width}px · ${locale}`, () => {
        test.use({ viewport: { width, height: 800 } });

        test("fits one row without sideways scroll", async ({ page, context, baseURL }) => {
          await seedConsent(context, baseURL!);
          await seedLocale(context, locale, baseURL!);
          await gotoHydrated(page, "/");
          await expect(page.locator("html")).toHaveAttribute("lang", locale);

          await expectNoHorizontalScroll(page);
          const bar = (await header(page).boundingBox())!;
          expect(bar.height, "header height").toBeLessThanOrEqual(120);

          // Desktop menu, preferences and CTA on one row: centres line up with the logo.
          const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
          const logo = (await header(page).getByRole("link").first().boundingBox())!;
          const prefs = (await languageGroup(page).boundingBox())!;
          const cta = (await header(page)
            .getByRole("button", { name: messages[locale]["nav.cta"], exact: true })
            .boundingBox())!;
          const nav = (await header(page)
            .getByRole("navigation", { name: messages[locale]["nav.primaryAria"] })
            .boundingBox())!;
          for (const box of [prefs, cta, nav]) {
            expect(Math.abs(centre(box) - centre(logo))).toBeLessThanOrEqual(6);
          }
          expect(cta.x + cta.width).toBeLessThanOrEqual(width);
        });
      });
    }
  }
});

/* The burger round trip itself (open after scrolling, measure, close) is `burgerRoundTrip` in
   helpers.ts, shared with the forced-WebGL interior spec. */
test.describe("burger menu after scrolling", () => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      test("keeps the header at the top while open and the scroll position on close", async ({
        page,
        context,
        baseURL,
      }) => {
        await seedConsent(context, baseURL!);
        await gotoHydrated(page, "/");

        const { widthBefore, open, after } = await burgerRoundTrip(page);
        expect(open.headerY).toBe(0);
        expect(open.htmlOverflow).toBe("hidden");
        expect(open.headerWidth, "the page does not narrow while locked").toBe(widthBefore);
        expect(after.scrollY).toBe(800);
        expect(after.htmlStyle).toBeNull();
        expect(after.bodyStyle).toBeNull();
      });
    });
  }

  test("with classic scrollbars (320x720) the gutter is reserved, so nothing shifts", async ({
    playwright,
    baseURL,
    storageState,
  }) => {
    // Playwright hides scrollbars in headless Chromium by default; this browser puts the
    // 15px desktop scrollbar back — the case the reserved gutter exists for. Launch options
    // are worker-scoped, so it is a browser of its own rather than a `test.use`.
    const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    try {
      // A context of its own does not inherit `use`: the storage (the HUD switched off, see
      // playwright.config.ts) is handed on explicitly, like the base URL.
      const context = await browser.newContext({
        baseURL,
        storageState,
        viewport: { width: 320, height: 720 },
        locale: "ro-RO",
        timezoneId: "Europe/Chisinau",
      });
      await seedConsent(context, baseURL!);
      const page = await context.newPage();
      await gotoHydrated(page, "/");
      const gutter = await page.evaluate(
        () => window.innerWidth - document.documentElement.clientWidth,
      );
      expect(gutter, "this browser really draws a classic scrollbar").toBeGreaterThan(0);

      const { widthBefore, open, after } = await burgerRoundTrip(page);
      expect(open.headerY).toBe(0);
      expect(open.headerWidth).toBe(widthBefore);
      expect(after.scrollY).toBe(800);
      expect(after.htmlStyle).toBeNull();
    } finally {
      await browser.close();
    }
  });
});

test.describe("desktop dropdowns", () => {
  const services = navMenu.find((item) => item.children && item.key === "nav.services")!;
  const firstChild = services.children![0];

  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("hover opens a dropdown and leaving closes it", async ({ page }) => {
    await gotoHydrated(page, "/");
    const item = header(page).locator(`[data-menu-item="${services.key}"]`);
    const top = item.getByRole("link", { name: ro[services.key], exact: true });
    const child = item.getByRole("link", { name: ro[firstChild.key], exact: true });

    await expect(child).toBeHidden();
    await top.hover();
    await expect(child).toBeVisible();
    await expect(top).toHaveAttribute("aria-expanded", "true");

    await page.mouse.move(640, 600);
    await expect(child).toBeHidden();
    await expect(top).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes a dropdown the mouse opened, without moving focus", async ({ page }) => {
    await gotoHydrated(page, "/");
    const item = header(page).locator(`[data-menu-item="${services.key}"]`);
    const top = item.getByRole("link", { name: ro[services.key], exact: true });
    const child = item.getByRole("link", { name: ro[firstChild.key], exact: true });
    const focusedTag = () => page.evaluate(() => document.activeElement?.tagName ?? null);
    const before = await focusedTag();
    expect(before).toBe("BODY");

    await top.hover();
    await expect(child).toBeVisible();
    await expect(top).toHaveAttribute("aria-expanded", "true");

    // The pointer stays on the item.
    await page.keyboard.press("Escape");
    await expect(child).toBeHidden();
    await expect(top).toHaveAttribute("aria-expanded", "false");
    await expect(item).toHaveAttribute("data-dismissed", "");
    expect(await focusedTag()).toBe(before);
  });

  test("focus opens it, Escape dismisses it and keeps focus on the top link", async ({ page }) => {
    await gotoHydrated(page, "/");
    const item = header(page).locator(`[data-menu-item="${services.key}"]`);
    const top = item.getByRole("link", { name: ro[services.key], exact: true });
    const child = item.getByRole("link", { name: ro[firstChild.key], exact: true });

    await top.focus();
    await expect(child).toBeVisible();
    await expect(top).toHaveAttribute("aria-expanded", "true");

    // The children are reachable with Tab while it is open.
    await page.keyboard.press("Tab");
    await expect(child).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(child).toBeHidden();
    await expect(top).toBeFocused();
    await expect(item).toHaveAttribute("data-dismissed", "");
    await expect(top).toHaveAttribute("aria-expanded", "false");
  });
});
