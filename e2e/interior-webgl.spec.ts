import { expect, test, type Page } from "@playwright/test";
import { messages } from "@/lib/i18n/messages";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";
import { SCENE_SHAPES, type GpuProbeCache } from "@/lib/scene";
import {
  audioContextCount,
  breakRendererWebGL,
  burger,
  burgerRoundTrip,
  consoleErrors,
  countAudioContexts,
  countDrawCalls,
  createdWebGLContexts,
  cspViolations,
  directionPills,
  drawCallsPerFrame,
  expectNoHorizontalScroll,
  expectRootUntouched,
  forceIntro3d,
  forceNoWebGL,
  forceScene3d,
  gotoHydrated,
  gsapLoaded,
  introOverlay,
  liveWebGLContexts,
  modalDialog,
  probeMismatches,
  recordSceneAttributes,
  resetDrawCalls,
  sceneProbeVsDom,
  sceneAttributeValues,
  sceneStage,
  scrollToY,
  seedConsent,
  seedGpuProbe,
  themeToggle,
  threeLoaded,
  trackWebGLContexts,
  watchCsp,
} from "./helpers";

/*
 * The interior stage with WebGL forced on (`tbs_scene_3d=force`) — SwiftShader in this
 * container, so everything is slow (the high tier compiles for seconds): each test gets 120s.
 * What must hold with a live canvas under the page: the canvas never takes a click, nothing
 * styles <html>, <body> or an entrance marker (ScrollTrigger's refreshes included — the
 * smooth-scroll guard's tripwire), the scene pauses when nothing of it is visible, the one
 * context is released when the visitor leaves and comes back once, a renderer that cannot
 * start or a missing WebGL ends in the static art, and the intro and the stage never draw at
 * the same time.
 */

test.describe.configure({ timeout: 120_000 });

/** SwiftShader's answer for both probe modes: forced visits skip the throwaway context. */
const FORCED_PROBE: GpuProbeCache = {
  v: 1,
  strict: { context: true, software: true },
  forced: { context: true, software: true },
};

const WEBGL = { timeout: 60_000 };

/** A returning visitor with the 3D stage forced, waiting until it draws. */
async function openForced(page: Page, url = "/"): Promise<void> {
  await forceScene3d(page);
  await seedGpuProbe(page, FORCED_PROBE);
  await gotoHydrated(page, url);
  if (new URL(page.url()).pathname === "/") {
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl", WEBGL);
  }
}

const styledMarkers = (page: Page) =>
  page.evaluate((attr) => document.querySelectorAll(`[${attr}][style]`).length, INTRO_REVEAL_ATTR);

test.describe("interior stage — forced WebGL @webgl", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test.describe("phone (390×844, touch)", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test("W1 draws under the page: one click-through canvas, mid tier, and nothing styled by ScrollTrigger", async ({
      page,
    }) => {
      await watchCsp(page);
      const errors = consoleErrors(page);
      await openForced(page);
      const stage = sceneStage(page);
      await expect(stage).toHaveAttribute("data-tier", "mid");
      await expect(stage).toHaveAttribute("data-scroll-fx", "on");
      await expect(stage).toHaveAttribute("data-paused", "false");

      const canvas = page.locator("[data-scene-layer] canvas");
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(canvas).toHaveCount(1);
      // The canvas and every ancestor up to the stage let clicks through.
      const blocking = await canvas.evaluate((el) => {
        const out: string[] = [];
        for (let node: Element | null = el; node && !node.hasAttribute("data-scene-stage"); node = node.parentElement) {
          if (getComputedStyle(node).pointerEvents !== "none") out.push(node.tagName);
        }
        return out;
      });
      expect(blocking).toEqual([]);
      const size = await canvas.evaluate((el: HTMLCanvasElement) => ({ width: el.width, css: el.clientWidth }));
      expect(size.width).toBeGreaterThan(0);
      expect(size.width).toBeLessThanOrEqual(Math.ceil(size.css * 1.5));

      // What a tap at each control's centre lands on: the control, never the canvas.
      const hits = async (selector: string) => {
        const target = page.locator(selector).first();
        await target.scrollIntoViewIfNeeded();
        const box = (await target.boundingBox())!;
        return page.evaluate(
          ({ x, y, selector }) => {
            const hit = document.elementFromPoint(x, y);
            const el = document.querySelector(selector);
            return !!hit && !!el && (el === hit || el.contains(hit));
          },
          { x: box.x + box.width / 2, y: box.y + box.height / 2, selector },
        );
      };
      expect(await hits("#top button")).toBe(true);
      expect(await hits('#top a[href="#servicii"]')).toBe(true);
      await scrollToY(page, 0);
      const toggle = themeToggle(page);
      const tbox = (await toggle.boundingBox())!;
      expect(
        await page.evaluate(
          ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("header button"),
          { x: tbox.x + tbox.width / 2, y: tbox.y + tbox.height / 2 },
        ),
      ).toBe(true);
      expect(await hits("#servicii nav a:nth-child(3)")).toBe(true);

      // ScrollTrigger refreshes (a resize, a long scroll) leave <html> and <body> alone.
      await scrollToY(page, 0);
      await page.setViewportSize({ width: 380, height: 800 });
      await page.waitForTimeout(800);
      await expectRootUntouched(page, "after a viewport resize");
      const servicesTop = await page.evaluate(
        () => document.querySelector("#servicii")!.getBoundingClientRect().top + window.scrollY,
      );
      await scrollToY(page, servicesTop);
      await page.waitForTimeout(500);
      await scrollToY(page, 0);
      await page.waitForTimeout(500);
      await expectRootUntouched(page, "after scrolling to #servicii and back");

      expect(await styledMarkers(page)).toBe(0);
      await expect(page.locator(".pin-spacer")).toHaveCount(0);
      expect(await page.evaluate(() => (window as unknown as { gsapVersions?: string[] }).gsapVersions?.length)).toBe(1);
      expect(await cspViolations(page)).toEqual([]);
      expect(errors.page).toEqual([]);
      expect(errors.console).toEqual([]);
    });

    test("W2 pauses while the stage is off screen and while the burger covers the page", async ({
      page,
    }) => {
      await openForced(page);
      const stage = sceneStage(page);
      await expect(stage).toHaveAttribute("data-paused", "false");

      const workTop = await page.evaluate(
        () => document.querySelector("#lucrari")!.getBoundingClientRect().top + window.scrollY,
      );
      await scrollToY(page, workTop + 300);
      await expect(stage).toHaveAttribute("data-paused", "true");
      await scrollToY(page, 0);
      await expect(stage).toHaveAttribute("data-paused", "false");

      await burger(page).click();
      const close = page.getByRole("button", { name: messages.ro["nav.closeAria"], exact: true });
      await expect(close).toBeVisible();
      await expect(stage).toHaveAttribute("data-paused", "true");
      await close.click();
      await expect(close).toHaveCount(0);
      await expect(stage).toHaveAttribute("data-paused", "false");
    });

    test("W3 a burger round trip with the canvas keeps the header on top and the scroll position", async ({
      page,
    }) => {
      await openForced(page);
      const { widthBefore, open, after } = await burgerRoundTrip(page);
      expect(open.headerY).toBe(0);
      expect(open.htmlOverflow).toBe("hidden");
      expect(open.headerWidth).toBe(widthBefore);
      expect(after.scrollY).toBe(800);
      expect(after.htmlStyle).toBeNull();
      expect(after.bodyStyle).toBeNull();
      await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl");
    });
  });

  test("W4 leaving and coming back three times: no stage away from home, the context released, one live context at most", async ({
    page,
  }) => {
    await trackWebGLContexts(page);
    await openForced(page);
    expect(await liveWebGLContexts(page)).toBe(1);

    for (let round = 1; round <= 3; round += 1) {
      const pill = directionPills(page).first();
      await pill.scrollIntoViewIfNeeded();
      await pill.click();
      await page.waitForURL(`**/servicii/${SCENE_SHAPES[0]}`);
      await expect(page.locator('[data-testid^="scene-"]')).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(0);
      await expect(page.locator(".pin-spacer")).toHaveCount(0);
      await expectRootUntouched(page, `round ${round}: on the service page`);
      await expect
        .poll(() => liveWebGLContexts(page), { message: `round ${round}: context released`, timeout: 2_500 })
        .toBe(0);

      await page.goBack();
      await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl", WEBGL);
      expect(await liveWebGLContexts(page), `round ${round}: back home`).toBeLessThanOrEqual(1);
      await expect(page.locator("canvas")).toHaveCount(1);
    }
  });

  for (const width of [320, 390, 768, 1280]) {
    test.describe(`${width}px`, () => {
      test.use({ viewport: { width, height: width < 800 ? 780 : 800 } });

      test(`W5 no sideways scroll anywhere in the stage with the canvas (${width})`, async ({ page }) => {
        await openForced(page);
        const marks = await page.evaluate(() => {
          const top = document.querySelector("#top")!.getBoundingClientRect();
          const services = document.querySelector("#servicii")!.getBoundingClientRect();
          const stage = document.querySelector("[data-scene-stage]")!.getBoundingClientRect();
          return [
            0,
            (top.height / 2) + window.scrollY + top.top,
            services.top + window.scrollY,
            stage.bottom + window.scrollY - window.innerHeight,
          ];
        });
        for (const y of marks) {
          await scrollToY(page, y);
          await page.waitForTimeout(150);
          await expectNoHorizontalScroll(page);
        }
      });
    });
  }

  test("W6 a renderer the browser refuses ends in the static art (lost), without page errors", async ({
    page,
  }) => {
    await breakRendererWebGL(page);
    const errors = consoleErrors(page);
    await forceScene3d(page);
    await seedGpuProbe(page, FORCED_PROBE);
    await gotoHydrated(page, "/");
    const stage = sceneStage(page);
    await expect(stage).toHaveAttribute("data-renderer", "fallback", WEBGL);
    await expect(stage).toHaveAttribute("data-reason", "lost");
    await expect(page.locator("[data-scene-layer] canvas")).toHaveCount(0);
    await expect(page.locator("svg[data-core-art]")).toHaveCSS("opacity", "1");
    expect(errors.page).toEqual([]);
    expect(errors.console.filter((text) => !/webgl/i.test(text))).toEqual([]);
  });

  test("W7 no WebGL at all: the probe says no-context and nothing heavy loads", async ({ page }) => {
    await forceNoWebGL(page);
    await forceScene3d(page);
    await gotoHydrated(page, "/", { seedGpuProbe: false });
    const stage = sceneStage(page);
    await expect(stage).toHaveAttribute("data-renderer", "fallback", { timeout: 15_000 });
    await expect(stage).toHaveAttribute("data-reason", "no-context");
    await page.waitForTimeout(1_000);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
  });

  test("W8 a first visit with both scenes forced never draws the stage while the intro is on screen", async ({
    page,
  }) => {
    await recordSceneAttributes(page);
    await trackWebGLContexts(page);
    await forceIntro3d(page);
    await forceScene3d(page);
    await gotoHydrated(page, "/", { seedIntro: false });
    await expect(introOverlay(page)).toHaveCount(0, { timeout: 60_000 });
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl", WEBGL);

    const records = await sceneAttributeValues(page);
    expect(records.some((r) => r.renderer === "webgl" && r.introPresent), JSON.stringify(records)).toBe(false);
    expect(records.some((r) => r.renderer === "webgl")).toBe(true);
    // The intro's context is gone by the time the stage draws.
    await expect.poll(() => liveWebGLContexts(page), { timeout: 5_000 }).toBe(1);
  });

  test("W9 a reload in a forced session creates exactly one context (the renderer's)", async ({
    page,
  }) => {
    await trackWebGLContexts(page);
    await openForced(page);
    expect(await createdWebGLContexts(page)).toBe(1);
    await page.reload();
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl", WEBGL);
    expect(await createdWebGLContexts(page)).toBe(1);
  });

  test("W10 hovering the hero CTA boosts the scene without sound, and scrolling never hides the headline", async ({
    page,
  }) => {
    await countAudioContexts(page);
    await openForced(page);
    const stage = sceneStage(page);
    const cta = page.locator("#top").getByRole("button").first();
    await cta.hover();
    await expect(stage).toHaveAttribute("data-boost", "");
    await page.mouse.move(640, 790);
    await expect(stage).not.toHaveAttribute("data-boost", /.*/);

    const hero = (await page.locator("#top").boundingBox())!;
    const opaque = () =>
      page.evaluate(() => {
        const out: string[] = [];
        for (let node: Element | null = document.querySelector("h1"); node && node.tagName !== "BODY"; node = node.parentElement) {
          if (getComputedStyle(node).opacity !== "1") out.push(node.tagName);
        }
        return out;
      });
    for (const y of [hero.height * 0.25, hero.height * 0.5, 0]) {
      await scrollToY(page, y);
      await page.waitForTimeout(200);
      expect(await opaque(), `at scrollY ${Math.round(y)}`).toEqual([]);
      expect(await styledMarkers(page)).toBe(0);
    }
    expect(await audioContextCount(page)).toBe(0);
  });

  test.describe("services in view (1280×1000)", () => {
    test.use({ viewport: { width: 1280, height: 1000 } });

    test("W11 once the services model has formed, a pill hover morphs it: data-morph running → idle", async ({
      page,
    }) => {
      await openForced(page);
      const stage = sceneStage(page);
      // The entry gate arms once the services anchor's top reaches 75% of the viewport (40px past).
      const top = await page.evaluate(() => {
        const box = document.querySelector('[data-scene-anchor="services"]')!.getBoundingClientRect();
        return box.top + window.scrollY;
      });
      await scrollToY(page, top - 1000 * 0.75 + 40);

      await page.evaluate(() => {
        const w = window as unknown as { __morph?: { value: string | null; t: number }[] };
        const log: { value: string | null; t: number }[] = [];
        w.__morph = log;
        const el = document.querySelector("[data-scene-stage]")!;
        new MutationObserver(() => log.push({ value: el.getAttribute("data-morph"), t: performance.now() })).observe(el, {
          attributes: true,
          attributeFilter: ["data-morph"],
        });
      });
      const morphLog = () =>
        page.evaluate(() => (window as unknown as { __morph?: { value: string | null; t: number }[] }).__morph ?? []);

      // The scene assembles the model over 1.1s of its own frame time (at least 22 frames: under
      // SwiftShader every frame is clamped to 1/20s, so several real seconds), and until it has
      // formed a switch is instant, with no morph to report. So hover one pill, then another,
      // until a switch really morphs (at most ~20s), then time that morph.
      const pills = directionPills(page);
      const order = [3, 1, 4, 2, 3, 1, 4, 2];
      let hovered = 0;
      for (const index of order) {
        const box = (await pills.nth(index).boundingBox())!;
        expect(box.y, "the pill is on screen, under the header").toBeGreaterThan(80);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
        await expect(page.locator('[data-testid="scene-services"]')).toHaveAttribute("data-shape", SCENE_SHAPES[index]);
        hovered += 1;
        await page.waitForTimeout(2_500);
        if ((await morphLog()).some((entry) => entry.value === "running")) break;
      }

      await expect(stage, `no morph after ${hovered} switches`).toHaveAttribute("data-morph", "idle", { timeout: 5_000 });
      const log = await morphLog();
      const running = log.find((entry) => entry.value === "running");
      const idle = log.find((entry) => entry.value === "idle" && running && entry.t >= running.t);
      expect(running, JSON.stringify(log)).toBeDefined();
      expect(idle, JSON.stringify(log)).toBeDefined();
      expect(idle!.t - running!.t).toBeLessThanOrEqual(1_500);
    });
  });

  /*
   * W16 · the services entrance is a timed burst, not a scroll scrub: once the services anchor's
   * top passes 75% of the viewport the model explodes out of a speck and assembles on the scene's
   * own clock, and the stage says so in `data-entry` (the Directions panel's edge glow keys off
   * it). Above the band's start ("top 90%") it implodes back to idle.
   */
  test.describe("services entrance (1280×800)", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("W16 past the services anchor the model bursts in: data-entry idle → burst → formed, the panel glows; above the band, idle", async ({
      page,
    }) => {
      const errors = consoleErrors(page);
      await openForced(page);
      const stage = sceneStage(page);
      await expect(stage).toHaveAttribute("data-entry", "idle", { timeout: 10_000 });
      await expect.poll(async () => probeMismatches(await sceneProbeVsDom(page)), { timeout: 5_000 }).toEqual([]);

      await page.evaluate(() => {
        const w = window as unknown as { __entry?: { value: string | null; t: number }[] };
        const el = document.querySelector("[data-scene-stage]")!;
        const log = [{ value: el.getAttribute("data-entry"), t: performance.now() }];
        w.__entry = log;
        new MutationObserver(() => log.push({ value: el.getAttribute("data-entry"), t: performance.now() })).observe(el, {
          attributes: true,
          attributeFilter: ["data-entry"],
        });
      });
      const entryLog = () =>
        page.evaluate(() => (window as unknown as { __entry?: { value: string | null; t: number }[] }).__entry ?? []);
      const now = () => page.evaluate(() => performance.now());

      const vh = 800;
      const anchorTop = await page.evaluate(() => {
        const box = document.querySelector('[data-scene-anchor="services"]')!.getBoundingClientRect();
        return box.top + window.scrollY;
      });
      const panel = page.locator("#servicii .entry-glow");
      await expect(panel).toHaveCount(1);
      const idleShadow = await panel.evaluate((el) => getComputedStyle(el).boxShadow);

      // To the band's end: armed. It bursts, then forms on its own clock while the page rests.
      const scrolledAt = await now();
      await scrollToY(page, Math.ceil(anchorTop - 0.75 * vh) + 1);
      await expect(stage).toHaveAttribute("data-entry", "formed", { timeout: 20_000 });
      const formed = await entryLog();
      expect(formed.map((entry) => entry.value), JSON.stringify(formed)).toEqual(["idle", "burst", "formed"]);
      const timings = {
        burstAfterScrollMs: Math.round(formed[1].t - scrolledAt),
        formedAfterBurstMs: Math.round(formed[2].t - formed[1].t),
      };
      test.info().annotations.push({ type: "W16 data-entry timings", description: JSON.stringify(timings) });
      console.log(`W16 data-entry timings ${JSON.stringify(timings)}`);
      // Never faster than the 1.1s the gate needs (frames are clamped, never stretched).
      expect(timings.formedAfterBurstMs).toBeGreaterThanOrEqual(1_000);

      // Formed: the panel's edge glows (P2-C's `entry-glow`).
      await expect
        .poll(() => panel.evaluate((el) => getComputedStyle(el).boxShadow), { message: "the formed panel's glow", timeout: 5_000 })
        .not.toBe(idleShadow);
      expect(await panel.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");

      // Above the band's start: it implodes back to idle.
      const upAt = await now();
      await scrollToY(page, Math.floor(anchorTop - 0.9 * vh) - 40);
      await expect(stage).toHaveAttribute("data-entry", "idle", { timeout: 20_000 });
      const back = (await entryLog()).slice(formed.length);
      expect(back.map((entry) => entry.value), JSON.stringify(back)).toEqual(["burst", "idle"]);
      const implosion = {
        burstAfterScrollMs: Math.round(back[0].t - upAt),
        idleAfterBurstMs: Math.round(back[1].t - back[0].t),
      };
      test.info().annotations.push({ type: "W16 implosion timings", description: JSON.stringify(implosion) });
      console.log(`W16 implosion timings ${JSON.stringify(implosion)}`);
      await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl");
      expect(errors.page).toEqual([]);
    });
  });

  /*
   * W13 · the request dialog pins <body> (`position: fixed`, `top: -scrollY`), so while it is
   * open `scrollY` reads 0 and every box sits scrollY too high. A ScrollTrigger refresh then —
   * a desktop resize, Android's keyboard shrinking the viewport — used to store every span and
   * anchor wrong by the scroll offset, for good: back at the top the core was gone. After the
   * dialog closes, the probe the scene reads must agree with the DOM again.
   */
  const W13_CASES = [
    {
      name: "phone, the on-screen keyboard (844 → 450 → 844)",
      viewport: { width: 390, height: 844 },
      touch: true,
      y: 2500,
      resizes: [
        { width: 390, height: 450 },
        { width: 390, height: 844 },
      ],
    },
    {
      name: "desktop, a window resize (1280 → 1100)",
      viewport: { width: 1280, height: 800 },
      touch: false,
      y: 3000,
      resizes: [{ width: 1100, height: 800 }],
    },
  ];

  for (const c of W13_CASES) {
    test.describe(`W13 ${c.name}`, () => {
      test.use({ viewport: c.viewport, hasTouch: c.touch, isMobile: c.touch });

      test(`W13 a refresh while the request dialog is open leaves no wrong measurement behind (${c.name})`, async ({
        page,
      }) => {
        const errors = consoleErrors(page);
        await openForced(page);
        await expect.poll(async () => probeMismatches(await sceneProbeVsDom(page)), { timeout: 5_000 }).toEqual([]);

        const y = await scrollToY(page, c.y);
        // Opened in place: a click through the page would scroll the hero's CTA into view first.
        await page.evaluate(() => document.querySelector<HTMLButtonElement>("#top button")!.click());
        await expect(modalDialog(page)).toBeVisible();
        expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
        for (const size of c.resizes) {
          await page.setViewportSize(size);
          // Past ScrollTrigger's 200ms resize delay: its own refresh runs under the dialog.
          await page.waitForTimeout(900);
        }

        await page.keyboard.press("Escape");
        await expect(modalDialog(page)).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5_000 }).toBe(y);
        await expect
          .poll(async () => probeMismatches(await sceneProbeVsDom(page)), {
            message: "the probe after the dialog closed",
            timeout: 5_000,
          })
          .toEqual([]);

        // And back at the top the core is there: the stage still draws, the probe still agrees.
        await scrollToY(page, 0);
        await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl");
        await expect(sceneStage(page)).toHaveAttribute("data-paused", "false");
        expect(probeMismatches(await sceneProbeVsDom(page))).toEqual([]);
        expect(errors.page).toEqual([]);
      });
    });
  }

  test.describe("W14 phone (390×844, touch)", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    /*
     * W14 · "ready" means the scene drew. A scene that finishes compiling while the stage is off
     * screen (a reload with a restored scroll, a deep link) runs no frame — its canvas is paused
     * — so it must stay pending and keep the static art, instead of fading the art out over a
     * canvas that has drawn nothing yet. It turns webgl once it is back on screen and drawing.
     */
    test("W14 a scene that loads while the stage is off screen keeps its art until it has drawn", async ({ page }) => {
      await forceScene3d(page);
      await seedGpuProbe(page, FORCED_PROBE);
      await gotoHydrated(page, "/");
      const stage = sceneStage(page);
      // Leave the stage before the scene is requested (an idle slot after hydration).
      await expect(stage).toHaveAttribute("data-renderer", "pending");
      await scrollToY(page, 1_000_000);
      await expect(page.locator("[data-scene-layer] canvas")).toHaveCount(1, WEBGL);
      await expect(stage).toHaveAttribute("data-scroll-fx", "on", WEBGL);
      // Long past the ~1–3s this scene needs to build and compile here.
      await page.waitForTimeout(8_000);
      await expect(stage).toHaveAttribute("data-renderer", "pending");
      await expect(page.locator("svg[data-core-art]")).toHaveCSS("opacity", "1");

      await scrollToY(page, 0);
      await expect(stage).toHaveAttribute("data-renderer", "webgl", WEBGL);
      await expect(stage).toHaveAttribute("data-paused", "false");
    });
  });

  test("W12 switching the theme while the scene draws logs no error", async ({ page }) => {
    const errors = consoleErrors(page);
    await openForced(page);
    const html = page.locator("html");
    const before = await html.getAttribute("data-theme");
    await themeToggle(page).click();
    await expect(html).not.toHaveAttribute("data-theme", before!);
    await page.waitForTimeout(1_000);
    await themeToggle(page).click();
    await expect(html).toHaveAttribute("data-theme", before!);
    await page.waitForTimeout(1_000);
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl");
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
  });

  test.describe("mouse over the hero (1280×800)", () => {
    test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

    test("W17 60 pointer moves draw the cursor trail and leave one canvas, one context and every control clickable", async ({
      page,
    }) => {
      await watchCsp(page);
      await trackWebGLContexts(page);
      await countDrawCalls(page);
      const errors = consoleErrors(page);
      await openForced(page);

      // Idle baseline once the build and compile slices are done: the draws per frame settle.
      const settled = async () => {
        await resetDrawCalls(page);
        await page.waitForTimeout(1_000);
        return drawCallsPerFrame(page);
      };
      let idle: number[] = [];
      await expect
        .poll(
          async () => {
            idle = (await settled()).filter((n) => n > 0);
            return idle.length >= 5 && Math.min(...idle) === Math.max(...idle);
          },
          { message: "the scene settles on a fixed number of draws per frame", timeout: 40_000, intervals: [0] },
        )
        .toBe(true);
      const idleDraws = idle[0];

      // A zig-zag across the eyebrow and headline band and over the chip, then back one band
      // lower, clear of both CTAs (a boost would add the wave's draw). Every step is 2–3 grid
      // cells, far under the 12-cell jump that breaks the chain.
      await resetDrawCalls(page);
      for (let i = 0; i < 60; i += 1) {
        const leg = i < 30 ? i : 59 - i;
        await page.mouse.move(60 + leg * 40, (i < 30 ? 150 : 270) + (i % 2) * 60);
        await page.waitForTimeout(16);
      }
      await page.waitForTimeout(150);
      const moving = await drawCallsPerFrame(page);
      expect(Math.max(...moving), `idle ${idleDraws} per frame; moving ${JSON.stringify(moving)}`).toBe(idleDraws + 1);

      // The segments fade (0.9s): the trail stops drawing.
      await page.waitForTimeout(1_500);
      const after = (await settled()).filter((n) => n > 0);
      expect(after.length).toBeGreaterThan(0);
      expect(Math.max(...after), `after the fade ${JSON.stringify(after)}`).toBe(idleDraws);

      await expect(page.locator("canvas")).toHaveCount(1);
      expect(await liveWebGLContexts(page)).toBe(1);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // What a click at each control's centre lands on: the control, never the canvas.
      const hits = async (target: ReturnType<Page["locator"]>, selector: string) => {
        const box = (await target.boundingBox())!;
        return page.evaluate(
          ({ x, y, selector }) => !!document.elementFromPoint(x, y)?.closest(selector),
          { x: box.x + box.width / 2, y: box.y + box.height / 2, selector },
        );
      };
      expect(await hits(page.locator("#top button").first(), "#top button")).toBe(true);
      expect(await hits(page.locator('#top a[href="#servicii"]').first(), '#top a[href="#servicii"]')).toBe(true);
      expect(await hits(themeToggle(page), "header button")).toBe(true);
      await expect(sceneStage(page)).toHaveAttribute("data-renderer", "webgl");

      expect(await cspViolations(page)).toEqual([]);
      expect(errors.page).toEqual([]);
      expect(errors.console).toEqual([]);
    });
  });
});
