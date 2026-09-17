import { expect, test, type Locator, type Page } from "@playwright/test";
import { RAIL_COPY, RAIL_HOME_SECTIONS } from "@/components/hud/rail/copy";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import type { GpuProbeCache } from "@/lib/scene";
import {
  HUD_ON,
  armHud,
  expectNoHorizontalScroll,
  expectRootUntouched,
  expectTappable,
  forceScene3d,
  gotoHydrated,
  guideAvatar,
  languageOption,
  railNav,
  railRoot,
  sceneStage,
  scrollToY,
  seedConsent,
  seedGpuProbe,
} from "./helpers";

/*
 * The fibre-optic scroll rail (IT-OS Phase 5): components/hud/rail/ScrollRail.tsx, a desktop-only
 * HUD part mounted by components/hud/HudChrome.tsx once the gate opens (consent answered, an
 * interaction, the intro gone, an idle slot) and only while `(min-width: 861px)` matches. What
 * must hold in a real browser:
 *   - a real `<nav aria-label="Secțiunile paginii">` of 44×44 buttons, one per section, over a
 *     decorative fibre that takes no pointer;
 *   - a marker jumps to its section (right under the header) and becomes `aria-current`; Enter
 *     also moves focus into the section; the thread is full at the bottom of the page;
 *   - it writes nothing on <html>/<body>, pushes nothing sideways, and hides the top progress bar
 *     only while it exists; below 861px there is no rail and the top bar is the fibre;
 *   - reduced motion: nothing in it animates; a service page gets its own markers and no canvas;
 *   - the Phase 3 spiral grows Work's track, and the markers re-measure.
 */

test.use({ storageState: HUD_ON });

/** A home section's marker label in Romanian: the header's catalog key, or the rail's own copy. */
function homeLabel(id: (typeof RAIL_HOME_SECTIONS)[number]["id"]): string {
  const section = RAIL_HOME_SECTIONS.find((entry) => entry.id === id)!;
  return "key" in section.label ? messages.ro[section.label.key] : section.label.text.ro;
}

/** The marker button for a home section. */
const marker = (page: Page, id: (typeof RAIL_HOME_SECTIONS)[number]["id"]): Locator =>
  railNav(page).getByRole("button", { name: homeLabel(id), exact: true });

/** `--header-h` in px, as the page resolves it. */
const headerHeight = (page: Page) =>
  page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")));

/** A section's top in the viewport (px). */
const viewportTop = (page: Page, selector: string) =>
  page.evaluate((sel) => document.querySelector(sel)!.getBoundingClientRect().top, selector);

/** The rail's `--rail-p` as written on its root. */
const railProgress = (page: Page) =>
  railRoot(page).evaluate((el) => (el as HTMLElement).style.getPropertyValue("--rail-p").trim());

/** Every marker's centre, in px from the fibre's top, by accessible name. */
const markerOffsets = (page: Page) =>
  page.evaluate(() => {
    const fibre = document.querySelector("[data-rail] > [aria-hidden]")!.getBoundingClientRect();
    return Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLButtonElement>("[data-rail] nav button")).map((button) => {
        const box = button.getBoundingClientRect();
        return [button.textContent?.trim() ?? "", Math.round(box.top + box.height / 2 - fibre.top)];
      }),
    );
  });

/** Arm the HUD and wait for the rail's nav. */
async function armRail(page: Page): Promise<void> {
  await armHud(page);
  await expect(railRoot(page)).toBeAttached();
  await expect(railNav(page)).toBeAttached();
}

test.describe("fibre rail at 1280×800", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("a real nav of 44px section buttons over a fibre that takes no pointer @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");
    const progressDisplay = () => page.locator("[data-progress]").evaluate((el) => getComputedStyle(el).display);
    // Before arming, the top bar is the only progress indicator, and there is no rail.
    await expect(railRoot(page)).toHaveCount(0);
    expect(await progressDisplay()).not.toBe("none");

    await armRail(page);
    const nav = railNav(page);
    await expect(nav).toHaveAttribute("aria-label", RAIL_COPY.nav.ro);
    await expect(page.getByRole("navigation", { name: RAIL_COPY.nav.ro, exact: true })).toHaveCount(1);
    const buttons = nav.getByRole("button");
    await expect(buttons).toHaveCount(RAIL_HOME_SECTIONS.length);
    for (const section of RAIL_HOME_SECTIONS) {
      await expectTappable(marker(page, section.id), `the ${section.id} marker`);
    }
    // Buttons, not links: nothing on the page gains a same-page href.
    await expect(nav.locator("a")).toHaveCount(0);

    const fibre = railRoot(page).locator(":scope > [aria-hidden]");
    await expect(fibre).toHaveCount(1);
    await expect(fibre).toHaveAttribute("aria-hidden", "true");
    await expect(fibre).toHaveCSS("pointer-events", "none");

    // The rail exists, so the top bar steps aside (globals.css, body:has([data-rail])).
    expect(await progressDisplay()).toBe("none");
  });

  test("the Lucrări marker jumps #lucrari under the header and becomes current; the bottom fills the thread", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    await armRail(page);
    const headerH = await headerHeight(page);

    await marker(page, "top").click();
    const work = marker(page, "lucrari");
    await work.click();
    await expect.poll(() => viewportTop(page, "#lucrari"), { timeout: 10_000 }).toBeGreaterThanOrEqual(headerH - 2);
    await expect.poll(() => viewportTop(page, "#lucrari"), { timeout: 10_000 }).toBeLessThanOrEqual(headerH + 2);
    await expect(work).toHaveAttribute("aria-current", "true");
    await expect(railNav(page).locator('[aria-current="true"]')).toHaveCount(1);
    // A mouse click does not move focus into the section.
    await expect(page.locator("#lucrari")).not.toBeFocused();

    await scrollToY(page, 1e6);
    await expect.poll(() => railProgress(page)).toBe("1.0000");
    await expect(marker(page, "contact")).toHaveAttribute("aria-current", "true");
    // Every tick is lit, and the downward crossings asked for their one-shot pulse (the control
    // for the reduced-motion case below, where none is).
    await expect(railRoot(page).locator("[data-rail-tick]:not([data-passed])")).toHaveCount(0);
    await expect(railRoot(page).locator("[data-rail-tick][data-pulse]").first()).toBeAttached();
    await expectRootUntouched(page, "after rail jumps and a scroll to the bottom");
    await expectNoHorizontalScroll(page);
  });

  test("keyboard: Enter on a marker scrolls and moves focus into the section, which lets go of its tabindex", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    await armRail(page);
    const headerH = await headerHeight(page);
    const hadTabindex = await page.locator("#echipa").getAttribute("tabindex");

    const team = marker(page, "echipa");
    await team.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#echipa")).toBeFocused();
    await expect.poll(() => viewportTop(page, "#echipa"), { timeout: 10_000 }).toBeGreaterThanOrEqual(headerH - 2);
    await expect.poll(() => viewportTop(page, "#echipa"), { timeout: 10_000 }).toBeLessThanOrEqual(headerH + 2);
    await expect(team).toHaveAttribute("aria-current", "true");

    // Tab moves on from inside the section; the temporary tabindex goes with the focus.
    await page.keyboard.press("Tab");
    await expect(page.locator("#echipa")).not.toBeFocused();
    expect(await page.locator("#echipa").getAttribute("tabindex")).toBe(hadTabindex);
    await expectRootUntouched(page, "after a keyboard jump");
  });

  test("Tab after arming still reaches the RO language option within 40 presses; the rail is after the footer", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    await armRail(page);
    const after = await page.evaluate(() => {
      const footer = document.querySelector("footer")!;
      const rail = document.querySelector("[data-rail]")!;
      return !!(footer.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(after, "the rail sits after the footer in DOM order").toBe(true);

    let presses = 0;
    for (let i = 1; i <= 40; i += 1) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "";
      });
      if (name === LOCALE_LABELS.ro) {
        presses = i;
        break;
      }
    }
    expect(presses, "the RO language option within 40 Tab presses").toBeGreaterThan(0);
    await expect(languageOption(page, "ro")).toBeFocused();
  });

  test("the guide avatar and the rail do not overlap", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armRail(page);
    await expect(guideAvatar(page)).toBeVisible();
    await scrollToY(page, 1e6);
    await expect.poll(() => railProgress(page)).toBe("1.0000");
    const boxes = await page.evaluate(() => {
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      return {
        guide: box(document.querySelector("[data-guide]")!),
        rail: box(document.querySelector("[data-rail]")!),
        buttons: Array.from(document.querySelectorAll("[data-rail] nav button"), box),
      };
    });
    const overlap = (a: typeof boxes.guide, b: typeof boxes.guide) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(overlap(boxes.guide, boxes.rail), "the guide box against the rail box").toBe(false);
    for (const button of boxes.buttons) expect(overlap(boxes.guide, button), JSON.stringify(button)).toBe(false);
  });
});

test.describe("fibre rail on a 390×844 phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no rail; the top progress bar is the fibre instead", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(page.locator("[data-rail]")).toHaveCount(0);

    await scrollToY(page, 2_000);
    const bar = page.locator("[data-progress]");
    await expect(bar).toBeVisible();
    const look = await bar.evaluate((el) => {
      const style = getComputedStyle(el);
      const head = getComputedStyle(el, "::after");
      return {
        image: style.backgroundImage,
        shadow: style.boxShadow,
        height: style.height,
        head: {
          content: head.content,
          width: head.width,
          height: head.height,
          right: head.right,
          radius: head.borderTopLeftRadius,
          colour: head.backgroundColor,
        },
      };
    });
    expect(look.height).toBe("2px");
    expect(look.head).toMatchObject({ content: '""', width: "18px", height: "2px", right: "0px", radius: "0px" });
    // The thread lights up from clear to the head's --neon-cyan, with a glow.
    expect(look.image).toBe(`linear-gradient(90deg, rgba(0, 0, 0, 0), ${look.head.colour})`);
    expect(look.shadow).not.toBe("none");
    await expectNoHorizontalScroll(page);
  });
});

test.describe("fibre rail under reduced motion", () => {
  test.use({ viewport: { width: 1280, height: 800 }, contextOptions: { reducedMotion: "reduce" } });

  test("crossing markers runs no animation inside the rail", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/");
    await armRail(page);
    const step = await page.evaluate(() => Math.round(window.innerHeight * 0.6));
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < max; y += step) {
      await page.mouse.wheel(0, step);
      await page.waitForTimeout(60);
    }
    await scrollToY(page, 1e6);
    await expect.poll(() => railProgress(page)).toBe("1.0000");
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return !!target && !!target.closest("[data-rail]") && animation.playState === "running";
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? animation.id),
    );
    expect(running).toEqual([]);
    // No crossing pulse was even asked for.
    await expect(railRoot(page).locator("[data-pulse]")).toHaveCount(0);
    await expectRootUntouched(page, "after crossing every marker under reduced motion");
  });
});

test.describe("fibre rail on a service page", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("/servicii/produs-digital: its own markers, and no canvas", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/servicii/produs-digital");
    await armRail(page);
    const count = await railNav(page).getByRole("button").count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i += 1) await expectTappable(railNav(page).getByRole("button").nth(i), `marker ${i}`);
    await expect(page.locator("canvas")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });
});

/* ---- with the Phase 3 spiral (forced WebGL) ---------------------------------------------------- */

/** SwiftShader's answer for both probe modes: forced visits skip the throwaway context. */
const FORCED_PROBE: GpuProbeCache = {
  v: 1,
  strict: { context: true, software: true },
  forced: { context: true, software: true },
};

test.describe("fibre rail with Work's spiral (forced WebGL) @webgl", () => {
  test.describe.configure({ timeout: 150_000 });
  test.use({ viewport: { width: 1280, height: 800 } });

  test("after the spiral grows the track, the markers re-measure and Lucrări still lands on #lucrari", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedConsent(context, baseURL!);
    await forceScene3d(page);
    await seedGpuProbe(page, FORCED_PROBE);
    await gotoHydrated(page, "/");
    await armRail(page);
    const stage = sceneStage(page);
    const labels = { team: homeLabel("echipa"), contact: homeLabel("contact") };

    // Read before the spiral when the race allows it (SwiftShader builds the helix slowly).
    const early = (await stage.getAttribute("data-helix")) === "spiral" ? null : await markerOffsets(page);
    await expect(stage).toHaveAttribute("data-helix", "spiral", { timeout: 90_000 });

    if (early) {
      await expect
        .poll(async () => {
          const now = await markerOffsets(page);
          return now[labels.team] !== early[labels.team] && now[labels.contact] !== early[labels.contact];
        }, { message: "the Echipă and Contact markers moved with the grown track", timeout: 15_000 })
        .toBe(true);
      test.info().annotations.push({
        type: "marker offsets before → after the spiral",
        description: JSON.stringify({ before: early, after: await markerOffsets(page) }),
      });
    } else {
      test.info().annotations.push({ type: "spiral before the rail", description: "no pre-spiral reading" });
    }

    const headerH = await headerHeight(page);
    await marker(page, "lucrari").click();
    await expect.poll(() => viewportTop(page, "#lucrari"), { timeout: 20_000 }).toBeGreaterThanOrEqual(headerH - 2);
    await expect.poll(() => viewportTop(page, "#lucrari"), { timeout: 20_000 }).toBeLessThanOrEqual(headerH + 2);
    await expect(marker(page, "lucrari")).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
    await expectRootUntouched(page, "after a rail jump into the spiral");
  });
});
