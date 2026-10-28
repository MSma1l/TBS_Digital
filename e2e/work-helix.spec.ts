import { expect, test } from "@playwright/test";
import {
  FORCED_GPU_PROBE,
  countWebGLContexts,
  forceScene3d,
  gotoHydrated,
  gsapLoaded,
  sceneStage,
  scrollToY,
  seedConsent,
  seedGpuProbe,
  threeLoaded,
  webglContextCount,
} from "./helpers";

/*
 * Work's WebGL helix (components/scene/) — since 2026-10-28 the site's ONLY WebGL, and lazy:
 * the stage wraps Work alone and requests nothing (no probe, no three.js, no GSAP, no context)
 * until Work comes within a viewport. Hero, Ticker and Directions draw static SVG.
 *
 * Default path: SwiftShader is refused, Work stays the flat card grid. Forced path
 * (`tbs_scene_3d=force`, @webgl): the helix draws once Work is near.
 */

test.describe("Work helix — lazy", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("H1 nothing heavy on entry; near Work the default path settles on the flat grid @smoke", async ({ page }) => {
    await countWebGLContexts(page);
    await gotoHydrated(page, "/");
    const stage = sceneStage(page);
    await page.waitForTimeout(2_000);
    await expect(stage).toHaveAttribute("data-renderer", "pending");
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await webglContextCount(page)).toBe(0);

    const top = await page.evaluate(() => document.querySelector("#lucrari")!.getBoundingClientRect().top + window.scrollY);
    await scrollToY(page, top);
    await expect(stage).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    await expect(stage).toHaveAttribute("data-reason", "software");
    expect(await threeLoaded(page)).toBe(false);
    expect(await webglContextCount(page), "the seeded session answer was used").toBe(0);
    await expect(page.locator("canvas")).toHaveCount(0);
  });
});

test.describe("Work helix — forced WebGL @webgl", () => {
  test.describe.configure({ timeout: 150_000 });
  test.use({ viewport: { width: 1280, height: 800 } });

  test("H2 the helix loads only near Work, draws behind Work alone, and the first screen stays WebGL-free", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedConsent(context, baseURL!);
    await forceScene3d(page);
    await seedGpuProbe(page, FORCED_GPU_PROBE);
    await gotoHydrated(page, "/");
    const stage = sceneStage(page);

    await page.waitForTimeout(2_000);
    await expect(stage).toHaveAttribute("data-renderer", "pending");
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);

    const top = await page.evaluate(() => document.querySelector("#lucrari")!.getBoundingClientRect().top + window.scrollY);
    await scrollToY(page, top);
    await expect(stage).toHaveAttribute("data-renderer", "webgl", { timeout: 60_000 });
    expect(await threeLoaded(page)).toBe(true);
    expect(await gsapLoaded(page)).toBe(true);
    await expect(stage.locator("[data-scene-layer] canvas")).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector("#top")!.closest("[data-scene-stage]"))).toBeNull();
    await expect(stage).toHaveAttribute("data-helix", "spiral", { timeout: 90_000 });
  });
});
