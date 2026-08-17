import { expect, test, type Locator, type Page } from "@playwright/test";
import { THEMES } from "@/lib/theme/theme";
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
  seedTheme,
  themeToggle,
} from "./helpers";

/*
 * Layout at real widths, in both palettes.
 *
 * The one rule that must never break at any width: the document may not be wider than the
 * viewport. A horizontal scrollbar on a phone is the single most visible layout bug a site
 * can ship, and it is invisible to jsdom.
 *
 * The second rule is about where the controls live. Language and theme are GLOBAL
 * preferences, so the header keeps them on screen at every width — a visitor must never
 * have to open the burger menu to switch language or turn on dark mode.
 */

/* The breakpoint is IMPORTED, not copied: it moved 360 -> 400 once measurement showed the
   segmented control cannot be both on screen and 44px-tappable between 361 and 399, and a
   copy here would have silently disagreed with the app. */
import { COMPACT_MAX_WIDTH } from "@/components/ui/LanguageSwitcher";

/**
 * The compact switcher's button. Identified by `aria-haspopup`, which only that shape has —
 * so this locator is also the assertion that the width really did change the control.
 */
const languageTrigger = (page: Page): Locator =>
  languageGroup(page).locator("button[aria-haspopup]");

/**
 * Put the three languages on screen, whatever shape the switcher is in: above the
 * breakpoint they already are, below it the popup has to be opened first. Everything the
 * suite asserts about the OPTIONS (that all three are offered, that each is a 44px target)
 * is about the choices a visitor can reach without leaving the header — which is still true
 * when reaching them costs one press on a control that is itself in the header.
 */
async function revealLanguageOptions(page: Page, compact: boolean): Promise<void> {
  if (!compact) return;
  const button = languageTrigger(page);
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
}

for (const viewport of VIEWPORTS) {
  const mobile = viewport.width < MOBILE_BREAKPOINT;
  const compact = viewport.width <= COMPACT_MAX_WIDTH;

  for (const theme of THEMES) {
    test.describe(`${viewport.name} · ${theme}`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test.beforeEach(async ({ context, baseURL }) => {
        await seedTheme(context, theme, baseURL!);
      });

      test("the home page never scrolls sideways", async ({ page }) => {
        await gotoHydrated(page, "/");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expectNoHorizontalScroll(page);
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

      test("language and theme are reachable without opening the menu", async ({ page }) => {
        await gotoHydrated(page, "/");

        // The burger is untouched — this is the state a visitor lands in.
        await expect(languageGroup(page)).toBeVisible();
        await expect(themeToggle(page)).toBeVisible();

        // Below 360px the three languages live behind the switcher's own button. That is
        // still "without opening the menu": the control is in the bar, the burger is not
        // involved, and the assertion below proves the choices are one press away.
        await revealLanguageOptions(page, compact);
        for (const locale of ["ro", "ru", "en"] as const) {
          await expect(languageOption(page, locale)).toBeVisible();
        }

        // And the controls actually work from here.
        await themeToggle(page).click();
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          theme === "dark" ? "light" : "dark",
        );

        if (mobile) {
          // The burger exists at this width, but nothing above required using it.
          await expect(burger(page)).toBeVisible();
        }
      });

      if (mobile) {
        test("header controls meet the 44px touch target", async ({ page }) => {
          await gotoHydrated(page, "/");

          await expectTappable(themeToggle(page), "theme toggle");
          await expectTappable(burger(page), "burger");

          // The whole preferences strip is 44px tall, which is what the CSS aims for.
          const group = (await languageGroup(page).boundingBox())!;
          expect(Math.round(group.height), "language switcher height").toBeGreaterThanOrEqual(
            MIN_TAP_TARGET,
          );

          // The point of the compact shape is that ONE button replaces three — so that one
          // button has to be a full target in both directions, not a shrunken stand-in.
          if (compact) {
            await expectTappable(languageTrigger(page), "language button");
          }
        });

        /*
         * WCAG 2.5.5 is satisfied per TARGET, not per group: each RO / RU / EN button is a
         * separate tap target and must be 44px in its own right. The group used to stretch
         * to 44px while `.switcher` centred its options, leaving every button ~24px tall —
         * a third of the strip was dead space between two adjacent language choices.
         *
         * The rule does not soften when the options move into the compact switcher's popup:
         * a row in a popup is a tap target like any other, so each one is measured there
         * too, with the popup opened first.
         */
        test("each language option meets the 44px touch target", async ({ page }) => {
          await gotoHydrated(page, "/");
          await revealLanguageOptions(page, compact);

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
}
