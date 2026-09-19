import { expect, test, type Page } from "@playwright/test";
import { INTRO_COOKIE, INTRO_REVEAL_ATTR } from "@/lib/intro";
import { SCENE_SHAPES } from "@/lib/scene";
import {
  computedTransform,
  consoleErrors,
  countWebGLContexts,
  cspViolations,
  decorativeDots,
  directionPills,
  disableScene3d,
  gotoHydrated,
  gsapLoaded,
  modalCloseButton,
  modalDialog,
  sceneHero,
  sceneServices,
  sceneStage,
  scrollToY,
  seedConsent,
  threeLoaded,
  watchCsp,
  webglContextCount,
} from "./helpers";

/*
 * The interior stage on the DEFAULT path (components/scene/): a returning visitor in headless
 * Chromium, whose SwiftShader GPU the stage's strict probe refuses — so the page settles on the
 * static art. What must hold without WebGL: the art is there and still, no three.js or GSAP is
 * ever evaluated, the entrance markers stay untouched, no decorative dot came back, the
 * direction pills drive the services screen (hover, keyboard, first tap on touch), the cards
 * tilt only under a mouse, and reduced motion / Save-Data / the off flag switch it all off.
 * The forced-WebGL half is interior-webgl.spec.ts (@webgl).
 */

/** The entrance markers the intro drives (and nothing else may style). */
const MARKERS = `[${INTRO_REVEAL_ATTR}]`;

async function markerState(page: Page) {
  return page.evaluate((selector) => ({
    count: document.querySelectorAll(selector).length,
    styled: document.querySelectorAll(`${selector}[style]`).length,
  }), MARKERS);
}

test.describe("interior stage — default path (no usable GPU)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("E1 settles on the static art: no canvas, no three.js, no GSAP, markers untouched @smoke", async ({
    page,
  }) => {
    await watchCsp(page);
    const errors = consoleErrors(page);
    await countWebGLContexts(page);
    await gotoHydrated(page, "/");

    const stage = sceneStage(page);
    await expect(stage).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    await expect(stage).toHaveAttribute("data-reason", "software");
    await expect(stage).not.toHaveAttribute("data-paused", /.*/);
    await expect(stage).toHaveAttribute("data-motion", "live");

    // The art is on screen, whole: the core in the hero, the selected direction's model.
    const core = sceneHero(page).locator("svg[data-core-art]");
    await expect(core).toBeVisible();
    await expect(core).toHaveCSS("opacity", "1");
    await expect(sceneServices(page).locator("svg[data-shape-art]")).toHaveCount(1);
    await expect(sceneServices(page)).toHaveAttribute("data-shape", SCENE_SHAPES[0]);

    await expect(page.locator("[data-scene-layer] canvas")).toHaveCount(0);
    // Past the idle slot the probe would have run in: still nothing heavy, no context at all
    // (the session's seeded probe answer was used).
    await page.waitForTimeout(1_500);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await webglContextCount(page)).toBe(0);
    expect(await markerState(page)).toEqual({ count: 8, styled: 0 });
    // Work is inside the stage now, and without the scene its cards are exactly as React rendered
    // them: two colours inline, no layout (the spiral is the WebGL path's), no helix mode.
    const work = await page.evaluate(() => ({
      inStage: !!document.querySelector("[data-scene-stage] #lucrari"),
      track: document.querySelectorAll("#lucrari [data-work-track]").length,
      styles: Array.from(document.querySelectorAll<HTMLElement>("[data-work-track] > *")).map((el) => el.style.length),
      front: document.querySelectorAll("[data-helix-front]").length,
    }));
    expect(work.inStage).toBe(true);
    expect(work.track).toBe(1);
    expect(work.styles.length).toBeGreaterThan(0);
    expect(work.styles.every((length) => length === 2), JSON.stringify(work.styles)).toBe(true);
    expect(work.front).toBe(0);
    await expect(stage).not.toHaveAttribute("data-helix", /.*/);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
  });

  test("E1b without a cached answer the probe makes one throwaway context, and a reload none", async ({
    page,
  }) => {
    await countWebGLContexts(page);
    await gotoHydrated(page, "/", { seedGpuProbe: false });
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    await expect(sceneStage(page)).toHaveAttribute("data-reason", "software");
    expect(await webglContextCount(page)).toBe(1);
    expect(await threeLoaded(page)).toBe(false);

    await page.reload();
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(await webglContextCount(page), "the reload answers from the session cache").toBe(0);
  });

  for (const viewport of [
    { name: "E2", width: 1280, height: 800 },
    { name: "E3", width: 390, height: 844 },
  ]) {
    test.describe(`${viewport.width}px`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test(`${viewport.name} no decorative dot in the header, main or footer`, async ({ page }) => {
        await gotoHydrated(page, "/");
        await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", {
          timeout: 10_000,
        });
        // Scroll the page through once so every scroll-revealed block has rendered.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 700) await scrollToY(page, y);
        await scrollToY(page, 0);
        expect(await decorativeDots(page)).toEqual([]);
      });
    });
  }

  test("E4 keyboard: arrows walk the pills, aria-current and data-shape move together, focus never enters the layer", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const pills = directionPills(page);
    await expect(pills).toHaveCount(SCENE_SHAPES.length);
    const screen = sceneServices(page);

    await pills.first().focus();
    await expect(pills.first()).toBeFocused();
    for (let step = 1; step <= SCENE_SHAPES.length; step += 1) {
      await page.keyboard.press("ArrowRight");
      const index = step % SCENE_SHAPES.length; // the last press wraps to the first pill
      await expect(pills.nth(index)).toBeFocused();
      await expect(pills.nth(index)).toHaveAttribute("aria-current", "true");
      await expect(page.locator('#servicii nav a[aria-current="true"]')).toHaveCount(1);
      await expect(screen).toHaveAttribute("data-shape", SCENE_SHAPES[index]);
      expect(
        await page.evaluate(() => document.activeElement?.closest("[data-scene-layer], [data-scene-anchor]") ?? null),
      ).toBeNull();
    }
    await page.keyboard.press("End");
    await expect(pills.last()).toBeFocused();
    await expect(screen).toHaveAttribute("data-shape", SCENE_SHAPES[SCENE_SHAPES.length - 1]);
    // Nothing in the stage layer or the art is a tab stop.
    expect(
      await page.evaluate(
        () =>
          document.querySelectorAll(
            "[data-scene-layer] [tabindex], [data-scene-layer] a, [data-scene-layer] button, [data-scene-anchor] a, [data-scene-anchor] [tabindex]",
          ).length,
      ),
    ).toBe(0);
  });

  test("E5 the sticky layer never paints past the end of the stage", async ({ page }) => {
    await gotoHydrated(page, "/");
    const stage = sceneStage(page);
    await expect(stage).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    const { bottom, inner } = await page.evaluate(() => {
      const box = document.querySelector("[data-scene-stage]")!.getBoundingClientRect();
      return { bottom: box.bottom + window.scrollY, inner: window.innerHeight };
    });
    for (const y of [bottom - 0.3 * inner, bottom + 200]) {
      await scrollToY(page, y);
      const rects = await page.evaluate(() => ({
        layer: document.querySelector("[data-scene-layer]")!.getBoundingClientRect().bottom,
        stage: document.querySelector("[data-scene-stage]")!.getBoundingClientRect().bottom,
      }));
      expect(rects.layer, `at scrollY ${Math.round(y)}`).toBeLessThanOrEqual(rects.stage + 1);
    }
  });

  test("E6 mouse: hovering a pill switches the shape, a click opens its service page", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const pills = directionPills(page);
    const last = SCENE_SHAPES.length - 1;
    await pills.nth(last).hover();
    await expect(sceneServices(page)).toHaveAttribute("data-shape", SCENE_SHAPES[last]);
    await expect(pills.nth(last)).toHaveAttribute("aria-current", "true");
    // Its drawing comes from the chunk the switch loads, styled like the server-rendered one.
    const art = sceneServices(page).locator("svg[data-shape-art]");
    await expect(art).toHaveCount(1);
    await expect(art).toHaveAttribute("data-shape-art", SCENE_SHAPES[last]);
    await expect(art).toHaveCSS("position", "absolute");
    await expect(art).toHaveCSS("opacity", "1");
    await pills.nth(last).click();
    await page.waitForURL(`**/servicii/${SCENE_SHAPES[last]}`);
  });

  test("E7 a stats card tilts under the mouse and settles back; the stats marker is never styled", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const card = page.locator('[data-metric="projects"]');
    const marker = page.locator(`[${INTRO_REVEAL_ATTR}="stats"]`);
    await expect(card).toHaveAttribute("data-tilt", "on");

    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2, { steps: 6 });
    await expect.poll(() => computedTransform(card)).toMatch(/^matrix3d\(/);
    await expect(card).toHaveAttribute("data-tilting", "");
    expect(await marker.getAttribute("style")).toBeNull();

    await page.mouse.move(5, 400, { steps: 4 });
    await expect.poll(() => computedTransform(card), { timeout: 3_000 }).toBe("none");
    await expect(card).not.toHaveAttribute("data-tilting", /.*/);
    await expect.poll(() => card.getAttribute("style")).toBeNull();
    expect(await marker.getAttribute("style")).toBeNull();
    expect(await markerState(page)).toEqual({ count: 8, styled: 0 });
  });

  test("E8 a project card tilts and keeps its --p1/--p2; its screenshot drifts on the section's view timeline", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const card = page.locator("#lucrari a, #lucrari article").first();
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveAttribute("data-tilt", "on");
    /** The card's own custom properties, as the CSSOM reads them (serialisation may differ). */
    const vars = () =>
      card.evaluate((el: HTMLElement) => ({
        p1: el.style.getPropertyValue("--p1").trim(),
        p2: el.style.getPropertyValue("--p2").trim(),
        rx: el.style.getPropertyValue("--tilt-rx"),
        ry: el.style.getPropertyValue("--tilt-ry"),
        count: el.style.length,
      }));
    const rest = await vars();
    expect(rest.p1).not.toBe("");
    expect(rest.p2).not.toBe("");
    expect(rest.count).toBe(2);

    const media = card.locator('[data-parallax="work-media"]');
    await expect(media).toHaveCount(1);
    const timeline = await media.evaluate((el) => {
      const cs = getComputedStyle(el) as CSSStyleDeclaration & { animationTimeline?: string };
      return { name: cs.animationName, timeline: cs.animationTimeline ?? "" };
    });
    expect(timeline).toEqual({ name: "hud-parallax-media", timeline: "--work-view" });

    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 6 });
    await expect.poll(() => computedTransform(card)).toMatch(/^matrix3d\(/);
    const tilting = await vars();
    expect(tilting.p1).toBe(rest.p1);
    expect(tilting.p2).toBe(rest.p2);
    expect(tilting.rx).toMatch(/deg$/);

    await page.mouse.move(5, 5, { steps: 4 });
    await expect.poll(() => computedTransform(card), { timeout: 3_000 }).toBe("none");
    await expect.poll(vars).toEqual(rest);
  });

  test("E14 the HTML carries one service drawing (the first direction's), and the browser draws the others on a switch", async ({
    page,
    request,
  }) => {
    const html = await (
      await request.get("/", {
        headers: { cookie: `${INTRO_COOKIE}=seen; tbs_cookie_consent=rejected` },
      })
    ).text();
    // Its markup, and the server slot's copy in the RSC payload — not all five drawings.
    const drawings = [...html.matchAll(/data-shape-art(?:="|\\":\\")([a-z-]+)/g)].map((m) => m[1]);
    expect(drawings).toEqual([SCENE_SHAPES[0], SCENE_SHAPES[0]]);

    const errors = consoleErrors(page);
    await gotoHydrated(page, "/");
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    const pills = directionPills(page);
    const art = sceneServices(page).locator("svg[data-shape-art]");
    for (const index of [2, 4, 1, 3, 0]) {
      await pills.nth(index).hover();
      await expect(art).toHaveCount(1);
      await expect(art).toHaveAttribute("data-shape-art", SCENE_SHAPES[index]);
      await expect(art).toBeVisible();
      await expect(art).toHaveAttribute("aria-hidden", "true");
      expect(await art.locator("path").count(), SCENE_SHAPES[index]).toBeGreaterThan(5);
    }
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
  });

  test("E15 the CTA boost: a hover and a keyboard focus boost; the focus a mouse-closed dialog hands back does not", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const stage = sceneStage(page);
    const cta = page.locator("#top").getByRole("button").first();

    await cta.hover();
    await expect(stage).toHaveAttribute("data-boost", "");
    await cta.click();
    await expect(modalDialog(page)).toBeVisible();
    await modalCloseButton(page).click();
    await expect(modalDialog(page)).toHaveCount(0);
    await expect(cta, "the dialog hands focus back to its trigger").toBeFocused();
    expect(await cta.evaluate((el) => el.matches(":focus-visible"))).toBe(false);

    await page.mouse.move(5, 400, { steps: 4 });
    await page.waitForTimeout(1_000);
    await expect(stage).not.toHaveAttribute("data-boost", /.*/);

    // A keyboard focus on the same CTA does boost, and leaving it ends the boost.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(cta).toBeFocused();
    expect(await cta.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    await expect(stage).toHaveAttribute("data-boost", "");
    await page.keyboard.press("Shift+Tab");
    await expect(cta).not.toBeFocused();
    await expect(stage).not.toHaveAttribute("data-boost", /.*/);
  });

  test.describe("1280px work tags", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("E16 a multi-part tag keeps its · between chips, visible and on the chips' ink plate, and no chip blurs its backdrop", async ({ page }) => {
      await gotoHydrated(page, "/");
      const tags = page.locator("#lucrari small");
      await tags.first().scrollIntoViewIfNeeded();
      const rows = await tags.evaluateAll((els) =>
        els.map((el) => ({
          text: el.textContent,
          parts: Array.from(el.children, (child) => {
            const style = getComputedStyle(child);
            const box = child.getBoundingClientRect();
            return {
              text: child.textContent,
              visible: style.visibility === "visible" && Number(style.opacity) > 0 && box.width > 0 && box.height > 0,
              backdrop: style.backdropFilter,
              plate: style.backgroundColor,
              top: Math.round(box.top),
              height: Math.round(box.height),
            };
          }),
        })),
      );
      const multi = rows.filter((row) => row.parts.length > 1);
      expect(multi.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const [i, part] of row.parts.entries()) {
          expect(part.visible, `${row.text}: part ${i}`).toBe(true);
          expect(part.backdrop, `${row.text}: part ${i}`).toBe("none");
          // Chips and the "·" joints alike sit on an ink plate: the glyph never meets the screenshot.
          expect(part.plate, `${row.text}: part ${i}`).not.toMatch(/^(?:transparent|rgba\(0, 0, 0, 0\))$/);
          if (i % 2 === 1) {
            expect(part.text).toBe(" · ");
            // A joint on the same line as the chip before it spans that chip's height.
            const chip = row.parts[i - 1];
            if (chip.top === part.top) expect(part.height).toBe(chip.height);
          } else expect(part.text?.trim()).not.toBe("");
        }
        expect(row.text?.split(" · ").length).toBe((row.parts.length + 1) / 2);
      }
    });
  });

  test.describe("861px (two project columns)", () => {
    test.use({ viewport: { width: 861, height: 900 } });

    test("E8b the full-row last card keeps its screenshot at a normal card's size", async ({
      page,
    }) => {
      await gotoHydrated(page, "/");
      const cards = page.locator("#lucrari a, #lucrari article");
      const count = await cards.count();
      test.skip(count % 2 === 0, "an even portfolio has no full-row card");
      const last = cards.last();
      await last.scrollIntoViewIfNeeded();
      const sizes = await last.evaluate((el: HTMLElement) => {
        const media = el.querySelector<HTMLElement>('[data-parallax="work-media"]');
        const first = el.parentElement!.firstElementChild as HTMLElement;
        return {
          card: el.offsetWidth,
          media: media?.offsetWidth ?? 0,
          neighbour: first.offsetWidth,
        };
      });
      expect(sizes.card, "the odd last card spans the row").toBeGreaterThan(sizes.neighbour * 1.8);
      if (sizes.media > 0) {
        // Layout widths (no parallax scale): half the row, about one regular card — the
        // screenshot is never stretched across the whole row (it was ~2×).
        expect(sizes.media).toBeLessThanOrEqual(Math.ceil(sizes.neighbour * 1.05));
        expect(sizes.media).toBeLessThanOrEqual(Math.ceil(sizes.card / 2) + 1);
      }
    });
  });

  test.describe("touch (390×844)", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("E9 the first tap on another pill selects it without navigating, the second opens the page", async ({
      page,
    }) => {
      await gotoHydrated(page, "/");
      const pill = directionPills(page).nth(1);
      await pill.scrollIntoViewIfNeeded();
      const workTop = await page.evaluate(
        () => document.querySelector("#lucrari")!.getBoundingClientRect().top + window.scrollY,
      );
      await pill.tap();
      await page.waitForTimeout(500);
      expect(new URL(page.url()).pathname).toBe("/");
      await expect(sceneServices(page)).toHaveAttribute("data-shape", SCENE_SHAPES[1]);
      await expect(pill).toHaveAttribute("aria-current", "true");
      // The screen's height floor: selecting a direction does not move the next section.
      expect(
        await page.evaluate(
          () => document.querySelector("#lucrari")!.getBoundingClientRect().top + window.scrollY,
        ),
      ).toBe(workTop);

      await pill.tap();
      await page.waitForURL(`**/servicii/${SCENE_SHAPES[1]}`);
    });

    test("E9b the already-selected pill opens its page on the first tap", async ({ page }) => {
      await gotoHydrated(page, "/");
      const pill = directionPills(page).first();
      await pill.scrollIntoViewIfNeeded();
      await expect(pill).toHaveAttribute("aria-current", "true");
      await pill.tap();
      await page.waitForURL(`**/servicii/${SCENE_SHAPES[0]}`);
    });

    test("E10 the \"open the service\" link navigates on the first tap", async ({ page }) => {
      await gotoHydrated(page, "/");
      const open = page.locator("#servicii").getByRole("link", { name: /^Deschide serviciul/ });
      await open.scrollIntoViewIfNeeded();
      await open.tap();
      await page.waitForURL(`**/servicii/${SCENE_SHAPES[0]}`);
    });

    test("E11 cards never tilt on touch", async ({ page }) => {
      await gotoHydrated(page, "/");
      const stats = page.locator("[data-metric]");
      await expect(stats.first()).toHaveAttribute("data-tilt", "off");
      await expect(page.locator("#lucrari a, #lucrari article").first()).toHaveAttribute(
        "data-tilt",
        "off",
      );
      await stats.first().tap();
      await page.waitForTimeout(300);
      expect(await computedTransform(stats.first())).toBe("none");
      await expect(stats.first()).not.toHaveAttribute("data-tilting", /.*/);
    });

    test("E11b the services screen (and its model) comes first, above the direction's heading", async ({
      page,
    }) => {
      await gotoHydrated(page, "/");
      const tops = await page.evaluate(() => ({
        anchor: document.querySelector('[data-scene-anchor="services"]')!.getBoundingClientRect().top,
        heading: document.querySelector("#servicii h3")!.getBoundingClientRect().top,
        anchorHeight: document.querySelector('[data-scene-anchor="services"]')!.getBoundingClientRect().height,
      }));
      expect(tops.anchor).toBeLessThan(tops.heading);
      expect(tops.anchorHeight, "the model gets at least 200px at 390").toBeGreaterThanOrEqual(200);
    });
  });

  test("E13 the art never runs an infinite animation (static by rule), boost wave and switches included", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    // Provoke the one-shot motions: the CTA boost wave and a service switch.
    await page.locator("#top").getByRole("button").first().hover();
    await expect(sceneStage(page)).toHaveAttribute("data-boost", "");
    await directionPills(page).nth(2).hover();
    await expect(sceneServices(page)).toHaveAttribute("data-shape", SCENE_SHAPES[2]);

    const infinite = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return (
            target instanceof Element &&
            target.closest("[data-core-art], [data-shape-art]") !== null &&
            animation.effect!.getComputedTiming().iterations === Infinity
          );
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? "?"),
    );
    expect(infinite).toEqual([]);
    // The one-shots end: nothing inside the art is still running a moment later.
    await page.mouse.move(5, 5);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.getAnimations().filter((animation) => {
                const target = (animation.effect as KeyframeEffect | null)?.target;
                return (
                  target instanceof Element &&
                  target.closest("[data-core-art], [data-shape-art]") !== null &&
                  animation.playState === "running"
                );
              }).length,
          ),
        { timeout: 3_000 },
      )
      .toBe(0);
  });
});

test.describe("interior stage — reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("E12 is off: no context, no three.js or GSAP, still holograms, no tilt, no parallax — the pills still switch the shape", async ({
    page,
  }) => {
    await countWebGLContexts(page);
    await gotoHydrated(page, "/", { seedGpuProbe: false });
    const stage = sceneStage(page);
    await expect(stage).toHaveAttribute("data-renderer", "off");
    await expect(stage).toHaveAttribute("data-reason", "reduced-motion");
    await expect(stage).toHaveAttribute("data-motion", "static");

    const hologram = page.locator("[data-hologram] > span").first();
    expect(await hologram.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await expect(page.locator("[data-metric]").first()).toHaveAttribute("data-tilt", "off");
    await expect(page.locator("#lucrari a, #lucrari article").first()).toHaveAttribute("data-tilt", "off");
    const media = page.locator('[data-parallax="work-media"]').first();
    expect(await media.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

    await directionPills(page).nth(3).hover();
    await expect(sceneServices(page)).toHaveAttribute("data-shape", SCENE_SHAPES[3]);

    await page.waitForTimeout(3_000);
    expect(await webglContextCount(page)).toBe(0);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
  });
});

test.describe("interior stage — gates", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("E12b Save-Data switches it off", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "connection", {
        configurable: true,
        get: () => ({
          saveData: true,
          effectiveType: "4g",
          addEventListener() {},
          removeEventListener() {},
        }),
      });
    });
    await countWebGLContexts(page);
    await gotoHydrated(page, "/", { seedGpuProbe: false });
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "off");
    await expect(sceneStage(page)).toHaveAttribute("data-reason", "save-data");
    await page.waitForTimeout(2_500);
    expect(await webglContextCount(page)).toBe(0);
  });

  test("E12c the off flag keeps it off and never requests the probe", async ({ page }) => {
    await disableScene3d(page);
    await countWebGLContexts(page);
    // The probe's chunk is the only one carrying the software-renderer pattern.
    const probeChunks: string[] = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (!/\/_next\/static\/chunks\/.*\.js/.test(url)) return;
      const body = await response.text().catch(() => "");
      if (body.includes("llvmpipe")) probeChunks.push(url);
    });
    await gotoHydrated(page, "/", { seedGpuProbe: false });
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "off");
    await expect(sceneStage(page)).toHaveAttribute("data-reason", "flag");
    await page.waitForTimeout(3_000);
    expect(probeChunks).toEqual([]);
    expect(await webglContextCount(page)).toBe(0);
    expect(await threeLoaded(page)).toBe(false);
  });
});
