import { expect, test, type Page } from "@playwright/test";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import type { Theme } from "@/lib/theme/theme";
import {
  HUD_ON,
  armHud,
  consoleErrors,
  cookieBanner,
  cspViolations,
  decorativeDots,
  expectNoHorizontalScroll,
  expectRootUntouched,
  expectTappable,
  gotoHydrated,
  gsapLoaded,
  guideAvatar,
  guideRoot,
  languageOption,
  liveWebGLContexts,
  modalDialog,
  railNav,
  railRoot,
  scrollToY,
  seedConsent,
  seedTheme,
  themeToggle,
  threeLoaded,
  trackWebGLContexts,
  watchCsp,
} from "./helpers";

/*
 * The HUD chrome living on the real site (critique §4, HI1–HI8), with the HUD ARMED: consent
 * seeded, `tbs_hud` not switched off (`HUD_ON`), one pointer move (`armHud`). The chrome is the
 * Ghid TBS guide (Phase 4) and, from 861px, the fibre rail (Phase 5); these checks are about what
 * it must never take from the page — taps, the header's tab budget, the single dialog and cookie
 * banner, the layout width, the no-dots rule, an untouched <html>/<body>, a clean console and
 * CSP, the lazy heavy libraries, the service pages' lightness, and the home page's own request
 * form. HI9–HI11 are the rail's: no sideways scroll at 861 and 1280, the root untouched after its
 * jumps, and never under the guide.
 */

test.use({ storageState: HUD_ON });

/** Press Tab until the focused element's accessible name is `name` (keyboard.spec.ts's walk). */
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

/** Scroll top → bottom in 0.8-viewport steps (instant), then back to the top. */
async function scrollThrough(page: Page): Promise<void> {
  const step = await page.evaluate(() => Math.round(window.innerHeight * 0.8));
  for (let y = 0; ; y += step) {
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const at = await scrollToY(page, Math.min(y, max));
    await page.waitForTimeout(120);
    if (at >= Math.floor(max)) break;
  }
  await scrollToY(page, 0);
}

/** Does a tap at `selector`'s centre land on that element (or inside it)? */
async function hits(page: Page, selector: string): Promise<{ lands: boolean; guide: boolean }> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  return page.evaluate(
    ({ x, y, selector }) => {
      const hit = document.elementFromPoint(x, y);
      const el = document.querySelector(selector);
      return { lands: !!hit && !!el && (el === hit || el.contains(hit)), guide: !!hit?.closest("[data-guide]") };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2, selector },
  );
}

test.describe("HUD integration", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test.describe("on a 390×844 touch phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("HI1 taps still land on the hero CTAs, the theme toggle and the services nav @smoke", async ({ page }) => {
      await gotoHydrated(page, "/");
      await armHud(page);
      await expect(guideAvatar(page)).toBeVisible();

      expect(await hits(page, "#top button")).toEqual({ lands: true, guide: false });
      expect(await hits(page, '#top a[href="#servicii"]')).toEqual({ lands: true, guide: false });
      await scrollToY(page, 0);
      const toggle = themeToggle(page);
      const tbox = (await toggle.boundingBox())!;
      expect(
        await page.evaluate(
          ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("header button"),
          { x: tbox.x + tbox.width / 2, y: tbox.y + tbox.height / 2 },
        ),
      ).toBe(true);
      expect(await hits(page, "#servicii nav a:nth-child(3)")).toEqual({ lands: true, guide: false });
    });

    test("HI8 the phone footer's last link is tappable at the bottom of the page", async ({ page }) => {
      await gotoHydrated(page, "/");
      await armHud(page);
      await scrollToY(page, 1e6);
      const last = page.locator("footer a").last();
      await expect(last).toBeInViewport();
      // The footer's meta links are 12px text rows (pre-existing, not HUD): the size floor here is
      // their own line box; what the HUD must not do is sit on them.
      await expectTappable(last, "the footer's last link", 14);
      const box = (await last.boundingBox())!;
      const landed = await page.evaluate(
        ({ x, y }) => {
          const hit = document.elementFromPoint(x, y);
          const links = document.querySelectorAll("footer a");
          const link = links[links.length - 1];
          return { lands: !!hit && (hit === link || link.contains(hit)), guide: !!hit?.closest("[data-guide]") };
        },
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      );
      expect(landed).toEqual({ lands: true, guide: false });
    });
  });

  test("HI2 Tab from / after arming reaches the RO language option within 40 presses", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    expect(await tabTo(page, LOCALE_LABELS.ro)).toBeLessThanOrEqual(40);
    await expect(languageOption(page, "ro")).toBeFocused();
  });

  test("HI3 a CTA opens exactly one dialog with the HUD armed", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    await page.locator("#top button").first().click();
    await expect(modalDialog(page)).toBeVisible();
    await expect(modalDialog(page)).toHaveCount(1);
    await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  });

  test("HI6 no CSP violation, no console error, and three.js / GSAP never loaded on the default path", async ({
    page,
  }) => {
    await watchCsp(page);
    const errors = consoleErrors(page);
    await gotoHydrated(page, "/");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();
    await expect(railNav(page)).toBeAttached();
    await scrollThrough(page);
    await page.waitForTimeout(1_000);

    expect(await cspViolations(page)).toEqual([]);
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
  });

  test("HI5 no decorative dot after a full scroll, and <html>/<body> untouched", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();
    // At 1280 the rail is armed too: its fibre, ticks and markers are inside the scan.
    await expect(railNav(page)).toBeAttached();
    await scrollThrough(page);
    expect(await decorativeDots(page)).toEqual([]);
    await expectRootUntouched(page, "after arming the HUD and a full scroll");
  });

  test("HI7 /servicii/e-commerce: no canvas, no scene, no live context, and the HUD is there", async ({ page }) => {
    await trackWebGLContexts(page);
    await gotoHydrated(page, "/servicii/e-commerce");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();
    await scrollThrough(page);

    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator('[data-testid^="scene-"]')).toHaveCount(0);
    expect(await liveWebGLContexts(page)).toBe(0);
    // Two parts at 1280 since Phase 5: the guide and the rail.
    await expect(page.locator("[data-hud]")).toHaveCount(2);
    await expect(guideRoot(page)).toHaveCount(1);
    await expect(railRoot(page)).toHaveCount(1);
  });

  test("HI8 the guide is away while #estimare's request form is in view", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    const avatar = guideAvatar(page);
    await expect(avatar).toHaveCSS("opacity", "1");

    await page.locator('#estimare [data-testid="request-flow"][data-layout="section"]').scrollIntoViewIfNeeded();
    await expect(guideRoot(page)).toHaveAttribute("data-away", "");
    await expect(avatar).toHaveCSS("opacity", "0");
    await expect(avatar).toHaveAttribute("tabindex", "-1");

    // Every control of the form's own takes a click at its centre, none of them the guide.
    const underGuide = await page.evaluate(() => {
      const out: string[] = [];
      const form = document.querySelector('#estimare [data-testid="request-flow"]')!;
      for (const el of Array.from(form.querySelectorAll<HTMLElement>("button, input, textarea, select, a"))) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.bottom < 0 || box.top > window.innerHeight) continue;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (hit?.closest("[data-guide]")) out.push(el.outerHTML.slice(0, 80));
      }
      return out;
    });
    expect(underGuide).toEqual([]);
  });
});

test.describe("HUD integration — the cookie banner", () => {
  test("HI3 a fresh visitor sees exactly one cookie banner, and no HUD before answering", async ({ page }) => {
    await gotoHydrated(page, "/");
    await expect(cookieBanner(page)).toHaveCount(1);
    await expect(cookieBanner(page)).toBeVisible();
    await page.mouse.move(8, 8);
    await page.waitForTimeout(1_500);
    await expect(cookieBanner(page)).toHaveCount(1);
    await expect(page.locator("[data-hud]")).toHaveCount(0);
  });
});

for (const theme of ["light", "dark"] as const satisfies readonly Theme[]) {
  for (const width of [320, 390, 768, 1280]) {
    test.describe(`HUD integration — ${width}px, ${theme}`, () => {
      test.use({ viewport: { width, height: width >= 1280 ? 800 : width >= 768 ? 1024 : 844 } });

      test(`HI4 no sideways scroll with the HUD armed (${width}, ${theme})`, async ({ page, context, baseURL }) => {
        await seedConsent(context, baseURL!);
        await seedTheme(context, theme, baseURL!);
        await gotoHydrated(page, "/");
        await armHud(page);
        await expect(guideAvatar(page)).toBeVisible();
        await expectNoHorizontalScroll(page);
        const box = (await guideRoot(page).boundingBox())!;
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        await scrollToY(page, 1e6);
        await expectNoHorizontalScroll(page);
      });
    });
  }
}

/** Two boxes overlap when they share any area (touching edges do not count). */
type Box = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The guide's box, the rail's box and every rail marker's box, in viewport px. */
const hudBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    return {
      guide: box(document.querySelector("[data-hud][data-guide]")!),
      rail: box(document.querySelector("[data-hud][data-rail]")!),
      markers: Array.from(document.querySelectorAll("[data-hud][data-rail] nav button"), box),
    };
  });

for (const width of [861, 1280]) {
  test.describe(`HUD integration — the fibre rail at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test.beforeEach(async ({ context, baseURL }) => {
      await seedConsent(context, baseURL!);
    });

    test(`HI9 no sideways scroll with the rail armed, and the rail inside the right edge (${width})`, async ({ page }) => {
      await gotoHydrated(page, "/");
      await armHud(page);
      await expect(railNav(page)).toBeAttached();
      await expectNoHorizontalScroll(page);
      const box = (await railRoot(page).boundingBox())!;
      expect({ right: Math.round(box.x + box.width), width: Math.round(box.width) }).toEqual({ right: width, width: 44 });
      await scrollThrough(page);
      await scrollToY(page, 1e6);
      await expectNoHorizontalScroll(page);
    });

    test(`HI10 <html>/<body> untouched after rail jumps (${width})`, async ({ page }) => {
      await gotoHydrated(page, "/");
      await armHud(page);
      const markers = railNav(page).getByRole("button");
      await expect(markers.first()).toBeAttached();
      const count = await markers.count();
      expect(count).toBeGreaterThanOrEqual(3);
      // Down the page, back to the top, then one keyboard jump (it also moves focus).
      for (const index of [2, count - 1, 0]) {
        await markers.nth(index).click();
        await expect(markers.nth(index)).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
      }
      await markers.nth(1).focus();
      await page.keyboard.press("Enter");
      await expect(markers.nth(1)).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
      await expectRootUntouched(page, "after rail jumps");
      expect(await decorativeDots(page)).toEqual([]);
    });

    test(`HI11 the guide avatar and the rail never overlap, top and bottom of the page (${width})`, async ({ page }) => {
      await gotoHydrated(page, "/");
      await armHud(page);
      await expect(guideAvatar(page)).toBeVisible();
      await expect(railNav(page)).toBeAttached();
      for (const y of [0, 1e6]) {
        await scrollToY(page, y);
        await page.waitForTimeout(300);
        const boxes = await hudBoxes(page);
        expect(overlaps(boxes.guide, boxes.rail), `guide vs rail at y=${y}`).toBe(false);
        for (const marker of boxes.markers) {
          expect(overlaps(boxes.guide, marker), `guide vs marker ${JSON.stringify(marker)} at y=${y}`).toBe(false);
        }
      }
    });
  });
}
