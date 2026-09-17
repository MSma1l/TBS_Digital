import { expect, test, type Page } from "@playwright/test";
import { messages } from "@/lib/i18n/messages";
import { INTRO_COOKIE, INTRO_REVEAL_ATTR } from "@/lib/intro";
import {
  audioContextCount,
  breakRendererWebGL,
  consoleErrors,
  cookieBanner,
  cookieValue,
  countAudioContexts,
  countWebGLContexts,
  cspViolations,
  expectNoHorizontalScroll,
  forceIntro3d,
  gotoHydrated,
  gpuProbeCache,
  gsapLoaded,
  header,
  introAttributeValues,
  introCookie,
  introCounter,
  introEverVisible,
  introOverlay,
  introProgress,
  introProgressValues,
  introScene,
  introSkip,
  languageGroup,
  recordIntroAttributes,
  recordIntroProgress,
  sampleIntroVisibility,
  seedConsent,
  sceneStage,
  seedSoundOn,
  themeToggle,
  threeLoaded,
  watchCsp,
  webglContextCount,
  MIN_TAP_TARGET,
} from "./helpers";

/*
 * The first-visit intro (components/intro/, gated in app/(site)/layout.tsx).
 *
 * Every other spec is a returning visitor (gotoHydrated seeds `tbs_intro=seen`); this one is
 * the first visit, through the hooks the overlay declares:
 *  · root `#tbs-intro[data-testid="intro"]`, `data-phase` boot|run|revealed|leaving and
 *    `data-renderer` pending|webgl|fallback;
 *  · the readout `role="progressbar"` ("SYSTEM_SYNCHRONIZATION: 07%"), whose number lives in
 *    `[data-testid="intro-counter"]`;
 *  · the skip button, named exactly `intro.skip`; the canvas host `[data-testid="intro-scene"]`.
 *
 * Headless Chromium here has software WebGL (SwiftShader). The capability probe treats it as
 * "no usable GPU", so the default path is the deterministic SVG fallback; the WebGL scene is
 * exercised on purpose with the QA switch (`tbs_intro_3d=force`) in its own describe.
 */

const ro = messages.ro;

/** The intro plays ~2.4s of sync plus a ~2.2s burst and entrance; room for a slow CPU. */
const INTRO_DONE = { timeout: 20_000 };

/** The readout's full text: label, colon, the number, "%". */
const READOUT_TEXT = /^(SYSTEM_SYNCHRONIZATION|ACCESS_GRANTED): \d{1,3}%$/;

/** A first-visit home page that has hydrated (the header under the overlay has React on it). */
async function firstVisit(page: Page, url = "/"): Promise<void> {
  await gotoHydrated(page, url, { seedIntro: false });
}

/** The director is mounted and has decided on a renderer: the burst path is armed. */
async function directorTookOver(page: Page): Promise<void> {
  await expect(introOverlay(page)).toHaveAttribute("data-phase", "run");
  await expect(introOverlay(page)).toHaveAttribute("data-renderer", /^(webgl|fallback)$/, {
    timeout: 15_000,
  });
}

async function introGone(page: Page, timeout = INTRO_DONE.timeout): Promise<void> {
  await expect(introOverlay(page)).toHaveCount(0, { timeout });
}

/** Nothing the intro wrote may survive it. */
async function expectPageRestored(page: Page): Promise<void> {
  const state = await page.evaluate((attr) => {
    const html = document.documentElement;
    return {
      htmlOverflow: getComputedStyle(html).overflow,
      htmlStyle: html.getAttribute("style"),
      bodyPosition: getComputedStyle(document.body).position,
      styledMarkers: document.querySelectorAll(`[${attr}][style]`).length,
      markers: document.querySelectorAll(`[${attr}]`).length,
    };
  }, INTRO_REVEAL_ATTR);
  expect(state.htmlOverflow).not.toBe("hidden");
  expect(state.htmlStyle, "the scroll lock leaves no style attribute on <html>").toBeNull();
  expect(state.bodyPosition).not.toBe("fixed");
  expect(state.markers, "the entrance targets are still on the page").toBe(8);
  expect(state.styledMarkers, "no [data-intro-reveal] keeps an inline style").toBe(0);
}

test.describe("intro — first visit", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("renders over a hero that is already painted, then leaves @smoke", async ({ page }) => {
    const response = await page.goto("/");
    const html = await response!.text();
    expect(html).toContain('data-testid="intro"');
    // The hero is in the same response, under the overlay, not waiting for the intro.
    expect(html).toMatch(/<h1[^>]*data-intro-reveal="title"/);

    await expect(introOverlay(page)).toBeVisible();
    await expect(page.locator("header")).toHaveCount(1);
    // The overlay never contains the page's landmarks or a dialog.
    await expect(introOverlay(page).locator("header, [role=dialog]")).toHaveCount(0);

    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    const style = await h1.evaluate((el) => {
      const s = getComputedStyle(el);
      return { opacity: s.opacity, visibility: s.visibility, display: s.display };
    });
    expect(style).toEqual({ opacity: "1", visibility: "visible", display: "block" });

    await introGone(page);
    await expect(h1).toBeVisible();
    await expect(h1).toHaveCSS("opacity", "1");
  });

  test("the progress readout counts up, never back, and ends at exactly 100", async ({ page }) => {
    await recordIntroProgress(page);
    await firstVisit(page);

    const progress = introProgress(page);
    await expect(progress).toHaveAttribute("aria-valuemin", "0");
    await expect(progress).toHaveAttribute("aria-valuemax", "100");
    await expect(progress).toHaveAccessibleName(ro["intro.progressAria"]);
    await expect(progress).toHaveText(READOUT_TEXT);
    // The number is its own node (the director writes it), zero-padded.
    await expect(introCounter(page)).toHaveText(/^\d{2,3}$/);

    await introGone(page);

    const values = await introProgressValues(page);
    expect(values.length, `recorded ${JSON.stringify(values)}`).toBeGreaterThan(2);
    expect(values[0]).toBeLessThanOrEqual(10);
    expect(values[values.length - 1]).toBe(100);
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i], `step ${i} of ${JSON.stringify(values)}`).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  test("leaves a usable page: header on top, theme toggle works, nothing locked or styled", async ({
    page,
  }) => {
    await firstVisit(page);
    await introGone(page);

    const toggle = themeToggle(page);
    const box = (await toggle.boundingBox())!;
    const onTop = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("header"),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(onTop, "the theme toggle is the topmost thing at its own centre").toBe(true);

    const before = await page.locator("html").getAttribute("data-theme");
    await toggle.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", before!);

    await expectPageRestored(page);
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("remembers the visit for the session only: tbs_intro=seen, path /, SameSite Lax", async ({
    page,
    context,
  }) => {
    expect(await introCookie(context)).toBeUndefined();
    await firstVisit(page);
    await introGone(page);

    const cookie = await introCookie(context);
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({
      name: INTRO_COOKIE,
      value: "seen",
      path: "/",
      expires: -1,
      sameSite: "Lax",
      httpOnly: false,
    });
  });

  test("a reload is a returning visit: no overlay in the HTML, no three.js, no WebGL", async ({
    page,
  }) => {
    await firstVisit(page);
    await introGone(page);

    await countWebGLContexts(page);
    const response = await page.reload();
    expect(await response!.text()).not.toContain('data-testid="intro"');
    await expect(introOverlay(page)).toHaveCount(0);

    await page.waitForLoadState("networkidle");
    // The interior stage keeps its static art on a device without a usable GPU, and answers
    // from the first visit's probe (cached for the session) — so the reload creates no context.
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    expect((await gpuProbeCache(page))?.strict).toMatchObject({ context: true, software: true });
    await page.waitForTimeout(1_000);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await webglContextCount(page)).toBe(0);
    await expectPageRestored(page);
  });

  test("the skip button ends it", async ({ page, context }) => {
    await recordIntroProgress(page);
    await firstVisit(page);
    await directorTookOver(page);

    await introSkip(page).click();

    await introGone(page, 5_000);
    expect(await cookieValue(context, INTRO_COOKIE)).toBe("seen");
    expect((await introProgressValues(page)).at(-1)).toBe(100);
    await expectPageRestored(page);
  });

  test("Escape ends it", async ({ page, context }) => {
    await firstVisit(page);
    await directorTookOver(page);

    await page.keyboard.press("Escape");

    await introGone(page, 5_000);
    expect(await cookieValue(context, INTRO_COOKIE)).toBe("seen");
    await expectPageRestored(page);
  });

  test("keyboard: Tab lands on skip (the first stop), Enter ends it, focus stays in the page", async ({
    page,
  }) => {
    // Tab is itself a "get me to the page" key, and the burst blurs the skip button when it
    // uncovers the page — so where focus went is recorded as it happens, not read afterwards.
    await page.addInitScript(() => {
      const w = window as unknown as { __focusedParts?: string[] };
      w.__focusedParts = [];
      document.addEventListener(
        "focusin",
        (event) => {
          const part = (event.target as Element | null)?.getAttribute?.("data-part");
          w.__focusedParts!.push(part ?? (event.target as Element | null)?.tagName ?? "?");
        },
        true,
      );
    });
    await firstVisit(page);
    await directorTookOver(page);

    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");

    await introGone(page, 5_000);
    const focused = await page.evaluate(
      () => (window as unknown as { __focusedParts?: string[] }).__focusedParts ?? [],
    );
    expect(focused[0], `focus went to ${JSON.stringify(focused)}`).toBe("skip");
    expect(await page.evaluate(() => document.activeElement?.isConnected ?? false)).toBe(true);
    await expectPageRestored(page);
  });

  test("sound seeded on stays silent: the intro builds no AudioContext without a gesture", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedSoundOn(context, baseURL!);
    await countAudioContexts(page);
    await firstVisit(page);
    await introGone(page);
    await page.waitForLoadState("networkidle");

    expect(await audioContextCount(page)).toBe(0);
  });

  test("needs no CSP change and logs no errors", async ({ page }) => {
    await watchCsp(page);
    const errors = consoleErrors(page);
    await firstVisit(page);
    await introGone(page);
    await page.waitForTimeout(500);

    expect(await cspViolations(page)).toEqual([]);
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
  });

  test("defaults to the SVG fallback under a software renderer, and never loads three.js", async ({
    page,
  }) => {
    await recordIntroAttributes(page);
    await firstVisit(page);
    await expect(introOverlay(page)).toHaveAttribute("data-renderer", "fallback", {
      timeout: 15_000,
    });
    await expect(introScene(page).locator("canvas")).toHaveCount(0);

    await introGone(page);
    // The interior stage makes the same call once the intro has left: static art, no three.js.
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 10_000 });
    expect(await threeLoaded(page)).toBe(false);
    const { renderer, phase } = await introAttributeValues(page);
    expect(renderer).not.toContain("webgl");
    expect(phase).toEqual(expect.arrayContaining(["run", "revealed"]));
  });

  test("localized in /en and /ru", async ({ page }) => {
    await firstVisit(page, "/en");
    await expect(introSkip(page, "en")).toBeVisible();
    await expect(introProgress(page)).toHaveAccessibleName(messages.en["intro.progressAria"]);

    await page.context().clearCookies();
    await seedConsent(page.context(), new URL(page.url()).origin);
    await firstVisit(page, "/ru");
    await expect(introSkip(page, "ru")).toBeVisible();
    await expect(introProgress(page)).toHaveAccessibleName(messages.ru["intro.progressAria"]);
  });
});

test.describe("intro — only on a hard landing on the home page", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("a service page never shows it (and sets no cookie)", async ({ page, context }) => {
    const response = await page.goto("/servicii/e-commerce");
    expect(await response!.text()).not.toContain('data-testid="intro"');
    await gotoHydrated(page, "/servicii/e-commerce", { seedIntro: false });
    await expect(introOverlay(page)).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    // Service pages get nothing from the interior stage.
    await expect(page.locator("[data-scene-stage]")).toHaveCount(0);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await introCookie(context)).toBeUndefined();
  });

  test("client-side navigation from a service page to the home page shows no overlay", async ({
    page,
    context,
  }) => {
    await gotoHydrated(page, "/servicii/e-commerce", { seedIntro: false });
    await page.evaluate(() => {
      (window as unknown as { __sameDocument?: boolean }).__sameDocument = true;
    });

    await page.locator('a[href="/#servicii"]').first().click();
    await expect(page).toHaveURL(/\/#servicii$/);
    await expect(page.locator("h1")).toHaveCount(1);

    // Same document: the router swapped the page, the layout (and its gate) stayed.
    expect(
      await page.evaluate(
        () => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true,
      ),
    ).toBe(true);
    await page.waitForTimeout(1_000);
    await expect(introOverlay(page)).toHaveCount(0);
    expect(await introCookie(context)).toBeUndefined();
  });
});

test.describe("intro — consent banner waits for it", () => {
  test("absent while the intro covers the page, visible and focused after", async ({ page }) => {
    await page.goto("/");
    await expect(introOverlay(page)).toBeVisible();
    await gotoHydratedInPlace(page);
    await directorTookOver(page);
    await expect(cookieBanner(page)).toHaveCount(0);

    await page.keyboard.press("Escape");

    await expect(cookieBanner(page)).toBeVisible({ timeout: 5_000 });
    await expect(cookieBanner(page)).toBeFocused();
    await introGone(page, 5_000);
    await expect(cookieBanner(page)).toBeFocused();
  });
});

/** Wait for hydration on the page that is already loaded (no second navigation). */
async function gotoHydratedInPlace(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("header");
      return !!el && Object.keys(el).some((key) => key.startsWith("__reactFiber$"));
    },
    undefined,
    { timeout: 20_000 },
  );
}

test.describe("intro — reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("is never visible, loads neither GSAP nor three.js, and the banner shows at once", async ({
    page,
  }) => {
    await sampleIntroVisibility(page, 3_000);
    await countWebGLContexts(page);
    await page.goto("/");
    await gotoHydratedInPlace(page);

    await introGone(page, 2_000);
    await expect(cookieBanner(page)).toBeVisible({ timeout: 2_000 });
    await expect(cookieBanner(page)).toBeFocused();

    await page.waitForTimeout(3_000);
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "off");
    await expect(sceneStage(page)).toHaveAttribute("data-reason", "reduced-motion");
    expect(await introEverVisible(page)).toBe(false);
    expect(await webglContextCount(page)).toBe(0);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    // The bypass still counts as "seen" for the session.
    expect(await cookieValue(page.context(), INTRO_COOKIE)).toBe("seen");
  });
});

test.describe("intro — without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("is hidden by the noscript rule; the page is simply there", async ({ page }) => {
    await page.goto("/");
    await expect(introOverlay(page)).toHaveCount(1);
    await expect(introOverlay(page)).toBeHidden();
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });
});

test.describe("intro — JavaScript that never arrives", () => {
  test("the CSS failsafe fades the overlay out and makes it click-through by ~7s", async ({
    page,
    context,
    baseURL,
  }) => {
    await seedConsent(context, baseURL!);
    await page.route(/\/_next\/static\/chunks\/.*\.js(\?.*)?$/, (route) => route.abort());
    await page.goto("/");

    await expect(introOverlay(page)).toBeVisible();
    await expect(introOverlay(page)).toBeHidden({ timeout: 12_000 });
    const state = await introOverlay(page).evaluate((el) => {
      const s = getComputedStyle(el);
      return { visibility: s.visibility, pointerEvents: s.pointerEvents, at: performance.now() };
    });
    expect(state.visibility).toBe("hidden");
    expect(state.pointerEvents).toBe("none");
    expect(state.at, "hidden by ~7.5s after navigation").toBeLessThan(10_000);

    const group = (await languageGroup(page).boundingBox())!;
    const inHeader = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("header"),
      { x: group.x + group.width / 2, y: group.y + group.height / 2 },
    );
    expect(inHeader, "the header is what a click at the language switcher hits").toBe(true);
    await expect(header(page)).toBeVisible();
  });
});

type Box = { x: number; y: number; width: number; height: number };

/** Do two layout boxes overlap by any area (touching edges don't count)? */
const boxesIntersect = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Fully inside a viewport of this size. */
function expectInsideViewport(box: Box, viewport: { width: number; height: number }, label: string) {
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport.height);
}

test.describe("intro — phones", () => {
  // Portrait phones, then short landscape ones, where the HUD sits near the bottom edge.
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
    { width: 640, height: 360 },
    { width: 568, height: 320 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport });

      test("no sideways scroll during sync or burst; skip is a 44px target on screen, clear of the readout", async ({
        page,
        context,
        baseURL,
      }) => {
        await seedConsent(context, baseURL!);
        await firstVisit(page);
        await directorTookOver(page);

        // sync
        await expectNoHorizontalScroll(page);
        const skip = introSkip(page);
        await expect(skip).toBeVisible();
        const box = (await skip.boundingBox())!;
        expect(Math.round(box.height)).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
        expect(Math.round(box.width)).toBeGreaterThanOrEqual(MIN_TAP_TARGET);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

        const readout = (await introProgress(page).boundingBox())!;
        expect(readout.x).toBeGreaterThanOrEqual(0);
        expect(readout.x + readout.width).toBeLessThanOrEqual(viewport.width);
        // Neither covers the other, and both are whole on screen.
        expectInsideViewport(box, viewport, "skip");
        expectInsideViewport(readout, viewport, "readout");
        expect(
          boxesIntersect(box, readout),
          `skip ${JSON.stringify(box)} overlaps the readout ${JSON.stringify(readout)}`,
        ).toBe(false);

        // burst: the label turns ACCESS_GRANTED at the lock, the ∞ scales up past the edges
        await page.waitForSelector('[data-testid="intro"] [data-part="label"][data-complete]', {
          timeout: INTRO_DONE.timeout,
        });
        await expectNoHorizontalScroll(page);

        await introGone(page);
        await expectNoHorizontalScroll(page);
      });
    });
  }
});

/*
 * The WebGL scene, on purpose: `tbs_intro_3d=force` lets SwiftShader through the probe.
 * Software rendering is slow (the high tier measured ~5 FPS and ~3s to first frame), so
 * these get their own budget. The intro must finish either way — if the scene is not ready
 * by 80% of the progress, the burst plays on the SVG instead; that is the product working,
 * and the assertions below allow it while still requiring the scene to have been tried.
 */
type RevealHit = { inHeader: boolean; inOverlay: boolean; target: string };

/**
 * While the overlay fades out (`data-phase="revealed"`, not yet `visibility: hidden`), sample
 * what a click at the header CTA's centre would land on. The header slides in during the
 * same fade, so only samples with that centre on screen count. A 15ms timer, not rAF: under
 * software WebGL frames are far apart and the fade lasts ~0.55s. Read with `revealHits`.
 */
async function recordRevealHits(page: Page): Promise<void> {
  await page.addInitScript((cta) => {
    const w = window as unknown as { __revealHits?: RevealHit[] };
    const hits: RevealHit[] = [];
    w.__revealHits = hits;
    let seen = false;
    const timer = window.setInterval(() => {
      const root = document.querySelector('[data-testid="intro"]');
      if (!root) {
        if (seen) window.clearInterval(timer);
        return;
      }
      seen = true;
      if (root.getAttribute("data-phase") !== "revealed") return;
      if (getComputedStyle(root).visibility === "hidden") return;
      const button = Array.from(document.querySelectorAll("header button")).find(
        (el) => el.textContent === cta,
      );
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (rect.width === 0 || y < 0 || y >= window.innerHeight) return;
      const hit = document.elementFromPoint(x, y);
      hits.push({
        inHeader: !!hit?.closest("header"),
        inOverlay: !!hit && root.contains(hit),
        target: hit ? `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ""}` : "null",
      });
    }, 15);
  }, messages.ro["nav.cta"]);
}

const revealHits = (page: Page): Promise<RevealHit[]> =>
  page.evaluate(() => (window as unknown as { __revealHits?: RevealHit[] }).__revealHits ?? []);

test.describe("intro — WebGL scene (forced on software rendering)", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("forced WebGL renders the canvas and completes at 100", async ({ page }) => {
    await forceIntro3d(page);
    await recordIntroAttributes(page);
    await recordIntroProgress(page);
    await recordRevealHits(page);
    const errors = consoleErrors(page);
    await firstVisit(page);

    await expect(introOverlay(page)).toHaveAttribute("data-phase", "run");
    // The director asked for the scene: the renderer is undecided until it draws (or not).
    await expect
      .poll(async () => (await introAttributeValues(page)).renderer, { timeout: 30_000 })
      .toEqual(expect.arrayContaining(["webgl"]));

    const { renderer } = await introAttributeValues(page);
    if ((await introOverlay(page).count()) > 0 && renderer.at(-1) === "webgl") {
      const canvas = introScene(page).locator("canvas");
      await expect(canvas).toHaveCount(1);
      const size = await canvas.evaluate((el: HTMLCanvasElement) => ({
        width: el.width,
        cssWidth: el.clientWidth,
      }));
      expect(size.width).toBeGreaterThan(0);
      expect(size.width).toBeLessThanOrEqual(Math.ceil(size.cssWidth * 2));
    }

    // During the fade the page is already live: a click at the header CTA reaches the header,
    // not the full-screen canvas (whose wrapper has an inline pointer-events: auto).
    await expect
      .poll(async () => (await revealHits(page)).some((hit) => hit.inHeader), {
        message: "a click at the header CTA should reach the header while the overlay fades",
        timeout: 60_000,
      })
      .toBe(true);

    await introGone(page, 60_000);
    // Only the intro was forced: the interior stage still refuses a software renderer.
    await expect(sceneStage(page)).toHaveAttribute("data-renderer", "fallback", { timeout: 15_000 });
    await expect(sceneStage(page)).toHaveAttribute("data-reason", "software");
    const caught = (await revealHits(page)).filter((hit) => hit.inOverlay);
    expect(caught, "nothing inside the fading overlay catches the click").toEqual([]);
    expect(await threeLoaded(page)).toBe(true);
    expect((await introProgressValues(page)).at(-1)).toBe(100);
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
    await expectPageRestored(page);
  });

  test("a renderer the browser refuses falls back to the SVG and still completes", async ({
    page,
  }) => {
    await forceIntro3d(page);
    await breakRendererWebGL(page);
    await recordIntroAttributes(page);
    await recordIntroProgress(page);
    const errors = consoleErrors(page);
    await firstVisit(page);

    await expect(introOverlay(page)).toHaveAttribute("data-renderer", "fallback", {
      timeout: 30_000,
    });
    await introGone(page, 60_000);

    const { renderer } = await introAttributeValues(page);
    expect(renderer).not.toContain("webgl");
    // The probe said yes, so the scene really was attempted (three.js evaluated) and refused.
    expect(await threeLoaded(page)).toBe(true);
    expect((await introProgressValues(page)).at(-1)).toBe(100);
    expect(errors.page).toEqual([]);
    expect(errors.console.filter((text) => !/webgl/i.test(text))).toEqual([]);
    await expectPageRestored(page);
  });
});
