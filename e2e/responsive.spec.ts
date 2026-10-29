import { expect, test } from "@playwright/test";
import {
  MIN_TAP_TARGET,
  MOBILE_BREAKPOINT,
  VIEWPORTS,
  burger,
  expectNoHorizontalScroll,
  expectTappable,
  gotoHydrated,
  header,
  languageGroup,
  languageOption,
  languageTrigger,
  openLanguageMenu,
  scrollToY,
} from "./helpers";

/*
 * Layout at real widths.
 *
 * The one rule that must never break at any width: the document may not be wider than the
 * viewport. A horizontal scrollbar on a phone is the single most visible layout bug a site
 * can ship, and it is invisible to jsdom.
 *
 * The second rule is about where the controls live. The language is a GLOBAL preference, so
 * the header keeps its switcher on screen at every width — a visitor must never have to open
 * the burger menu to change language.
 */

for (const viewport of VIEWPORTS) {
  const mobile = viewport.width < MOBILE_BREAKPOINT;

  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("the home page never scrolls sideways", async ({ page }) => {
      await gotoHydrated(page, "/");
      await expectNoHorizontalScroll(page);
    });

    test("the home page never scrolls sideways anywhere in the interior stage", async ({ page }) => {
      await gotoHydrated(page, "/");
      // Top, mid-hero, the services section, and the last screen of the stage: the sticky
      // scene layer (components/scene/SceneStage.tsx) travels through all of them.
      const marks = await page.evaluate(() => {
        const hero = document.querySelector("#top")!.getBoundingClientRect();
        const services = document.querySelector("#servicii")!.getBoundingClientRect();
        const stage = document.querySelector("[data-scene-stage]")!.getBoundingClientRect();
        return [
          0,
          hero.top + window.scrollY + hero.height / 2,
          services.top + window.scrollY,
          stage.bottom + window.scrollY - window.innerHeight,
        ];
      });
      for (const y of marks) {
        await scrollToY(page, y);
        await expectNoHorizontalScroll(page);
      }
    });

    test("a service page never scrolls sideways", async ({ page }) => {
      await gotoHydrated(page, "/servicii/e-commerce");
      await expectNoHorizontalScroll(page);
    });

    test("the header stays one intact row inside the viewport", async ({ page }) => {
      await gotoHydrated(page, "/");

      const bar = header(page);
      await expect(bar).toBeVisible();

      const barBox = (await bar.boundingBox())!;
      expect(barBox.x).toBeGreaterThanOrEqual(-1);
      expect(Math.round(barBox.width)).toBeLessThanOrEqual(viewport.width + 1);

      // "Doesn't break" = the bar has not wrapped into a tall stack of rows. One row of
      // 44px controls plus padding sits well under this.
      expect(barBox.height, "header height").toBeLessThanOrEqual(120);

      // The preferences group and the logo share a row: their vertical centres line up.
      const logoBox = (await bar.getByRole("link").first().boundingBox())!;
      const prefsBox = (await languageGroup(page).boundingBox())!;
      const centre = (b: { y: number; height: number }) => b.y + b.height / 2;
      expect(Math.abs(centre(logoBox) - centre(prefsBox))).toBeLessThanOrEqual(6);

      // Nothing in the header hangs off either edge.
      expect(prefsBox.x).toBeGreaterThanOrEqual(0);
      expect(prefsBox.x + prefsBox.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test("the language switcher is reachable without opening the menu", async ({ page }) => {
      await gotoHydrated(page, "/");

      // The burger is untouched — this is the state a visitor lands in.
      await expect(languageGroup(page)).toBeVisible();

      // The three languages live behind the switcher's own button, at every width. That is
      // still "without opening the menu": the control is in the bar, the burger is not
      // involved, and the assertion below proves the choices are one press away.
      await openLanguageMenu(page);
      for (const locale of ["ro", "ru", "en"] as const) {
        await expect(languageOption(page, locale)).toBeVisible();
      }

      if (mobile) {
        // The burger exists at this width, but nothing above required using it.
        await expect(burger(page)).toBeVisible();
      }
    });

    if (mobile) {
      test("header controls meet the 44px touch target", async ({ page }) => {
        await gotoHydrated(page, "/");

        await expectTappable(burger(page), "burger");

        // The whole preferences strip is 44px tall, which is what the CSS aims for.
        const group = (await languageGroup(page).boundingBox())!;
        expect(Math.round(group.height), "language switcher height").toBeGreaterThanOrEqual(
          MIN_TAP_TARGET,
        );

        // The dropdown's one button has to be a full target in both directions.
        await expectTappable(languageTrigger(page), "language button");
      });

      /*
       * WCAG 2.5.5 is satisfied per TARGET, not per group: each RO / RU / EN choice is a
       * separate tap target and must be 44px in its own right. The rule does not soften
       * because the choices live in the dropdown's popup: a row in a popup is a tap target
       * like any other, so each one is measured there, with the popup opened first.
       */
      test("each language option meets the 44px touch target", async ({ page }) => {
        await gotoHydrated(page, "/");
        await openLanguageMenu(page);

        for (const locale of ["ro", "ru", "en"] as const) {
          const box = (await languageOption(page, locale).boundingBox())!;
          expect(Math.round(box.height), `${locale} option height`).toBeGreaterThanOrEqual(
            MIN_TAP_TARGET,
          );
        }
      });
    }
  });
}
