import { expect, test, type Locator, type Page } from "@playwright/test";
import { GUIDE_COPY } from "@/components/hud/guide/copy";
import { services as seededServices } from "@/lib/content";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import {
  HUD_ON,
  armHud,
  chatPanel,
  chatToggle,
  consoleErrors,
  cookieBanner,
  cspViolations,
  decorativeDots,
  expectNoHorizontalScroll,
  expectTappable,
  fillContactStep,
  flowFields,
  goToStep,
  gotoHydrated,
  gsapLoaded,
  guideAvatar,
  guideRoot,
  guideTip,
  introOverlay,
  languageOption,
  modalDialog,
  requestFlow,
  scrollToY,
  seedConsent,
  stubContactApi,
  threeLoaded,
  watchCsp,
  type StubbedCall,
} from "./helpers";

/**
 * The guided request is TWO presses from the corner now. Pressing her opens her questions in the
 * bubble above her; "Deschide ghidul" inside them opens the request flow. The avatar's accessible
 * name says questions, so a one-press path here would be testing a promise the control no longer
 * makes.
 */
async function openRequestFromGuide(page: Page) {
  await guideAvatar(page).click();
  const faq = page.getByTestId("guide-faq");
  await expect(faq).toBeVisible();
  await faq.getByRole("button", { name: GUIDE_COPY.open.ro }).click();
}


/*
 * Ghid TBS (IT-OS Phase 4): the holographic cube droid in the bottom-right corner
 * (components/hud/guide/GuideAssistant.tsx), mounted by components/hud/HudChrome.tsx once the
 * cookie banner is answered, the visitor has interacted, the intro is gone and an idle slot has
 * come. What must hold in a real browser:
 *   - it is a real button that opens the request dialog straight on the guided chat, and what
 *     is sent names where it came from (`Sursă (CTA): guide`) and, on a service page, the service;
 *   - lingering 5s of visible time with a topic on the viewport's centre line shows ONE tip,
 *     without taking focus, and a dismissed topic never comes back in the same page lifetime;
 *   - it never appears before consent or over the intro, stays still under reduced motion (the
 *     tip still shows), stays out of the header's tab budget, steps away over the home page's
 *     own request form, and is covered by the dialog rather than covering it;
 *   - on a service page it adds no canvas, no three.js or GSAP, no CSP violation, no error.
 *
 * The linger waits are real time, not `page.clock`: the tip needs the IntersectionObserver's
 * centre-line entries (delivered by rendering) AND visibleTimeout's timer, and the gate before
 * it needs requestIdleCallback — a faked clock would have to drive all three in step. The waits
 * are bounded both ways: nothing at 3.5s, the tip within 12s of the scroll. Measured in the page
 * the tip lands 5.02–5.04s after the scroll (35 runs, P4-C); the upper bound leaves room for a
 * loaded CI machine, the lower one is what proves the 5s.
 */

test.use({ storageState: HUD_ON });

/** The 5s linger, observed from the scroll: absent at LINGER_EARLY_MS, present by LINGER_LATE_MS. */
const LINGER_EARLY_MS = 3_500;
const LINGER_LATE_MS = 12_000;

/** A plausible lead. Fictional address on the reserved `example.com` domain. */
const LEAD = { name: "Ion Popescu", email: "ion.popescu@example.com", phone: "+373 60 000 000" };

/** The e-commerce page preselects the `shop` service; its price is the owner's, so it is derived. */
const SHOP_PRICE = seededServices.find((s) => s.id === "shop")!.price.ro;

/** Scroll so `selector`'s middle sits on the viewport's centre line. Returns the scroll target. */
async function centreOn(page: Page, selector: string): Promise<number> {
  const y = await page.evaluate((sel) => {
    const box = document.querySelector(sel)!.getBoundingClientRect();
    return box.top + window.scrollY + box.height / 2 - window.innerHeight / 2;
  }, selector);
  return scrollToY(page, y);
}

/** Linger on `selector` and wait for the tip: not early, not late. */
async function lingerForTip(page: Page, selector: string): Promise<Locator> {
  await centreOn(page, selector);
  const since = Date.now();
  await page.waitForTimeout(LINGER_EARLY_MS);
  await expect(guideTip(page), "no tip before 5s of lingering").toHaveCount(0);
  await expect(guideTip(page)).toBeVisible({ timeout: LINGER_LATE_MS - (Date.now() - since) });
  return guideTip(page);
}

/** The single POST the flow is allowed to make, polled (the route handler runs in the driver). */
async function sentMessage(calls: StubbedCall[]): Promise<Record<string, unknown>> {
  await expect.poll(() => calls.length, { message: "the flow should post exactly one request" }).toBe(1);
  return calls[0].body as Record<string, unknown>;
}

/** The request's origin block ("CONTEXTUL CERERII:" and its "- " rows), or "" when there is none. */
function originBlock(message: string): string {
  const lines = message.split("\n");
  const start = lines.indexOf("CONTEXTUL CERERII:");
  if (start < 0) return "";
  const rows: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("- ")) break;
    rows.push(line);
  }
  return rows.join("\n");
}

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

test.describe("Ghid TBS at 1280", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("the avatar is a real, tappable button that says it opens a dialog @smoke", async ({ page }) => {
    await gotoHydrated(page, "/");
    // Nothing of the HUD before the visitor does anything.
    await page.waitForTimeout(1_500);
    await expect(page.locator("[data-hud]")).toHaveCount(0);

    await armHud(page);
    const avatar = guideAvatar(page);
    await expectTappable(avatar, "the guide avatar");
    await expect(avatar).toHaveAttribute("aria-haspopup", "dialog");
    await expect(avatar).toHaveAttribute("aria-label", GUIDE_COPY.aria.ro);
    await expect(avatar).not.toHaveAttribute("aria-describedby", /.+/);
    // 88×88 at 20px from the corner (critique R2), on top of the page at --z-guide.
    const box = (await guideRoot(page).boundingBox())!;
    expect({ w: box.width, h: box.height, right: 1280 - (box.x + box.width), bottom: 800 - (box.y + box.height) }).toEqual({
      w: 88,
      h: 88,
      right: 20,
      bottom: 20,
    });
    await expect(guideRoot(page)).toHaveCSS("z-index", "112");
    await expect(guideRoot(page)).toHaveAttribute("data-state", /^(enter|idle)$/);
    await expect(guideRoot(page)).toHaveAttribute("data-state", "idle");
  });

  test("a 5s linger on #servicii shows one tip, without taking focus", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);

    const tip = await lingerForTip(page, "#servicii");
    await expect(tip.getByText(GUIDE_COPY.prompts.servicii.ro, { exact: true })).toBeVisible();
    await expect(guideRoot(page)).toHaveAttribute("data-state", "prompt");
    // The tip describes the avatar (its sentence only) and has no role: it is not announced.
    const describedBy = await guideAvatar(page).getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText(GUIDE_COPY.prompts.servicii.ro);
    await expect(tip.locator("[role], [aria-live]")).toHaveCount(0);
    await expect(tip).not.toHaveAttribute("role", /.*/);

    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
    await expectNoHorizontalScroll(page);
    expect(await decorativeDots(page)).toEqual([]);
    // The tip's controls are real 44px targets inside the viewport.
    await expectTappable(tip.getByRole("button", { name: GUIDE_COPY.open.ro, exact: true }), "open the guide");
    await expectTappable(tip.getByRole("button", { name: GUIDE_COPY.never.ro, exact: true }), "never again");
    await expectTappable(tip.getByRole("button", { name: GUIDE_COPY.dismiss.ro, exact: true }), "close the tip");
  });

  test("a dismissed tip does not come back: away and back, 6s more, nothing", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);

    const tip = await lingerForTip(page, "#servicii");
    await tip.getByRole("button", { name: GUIDE_COPY.dismiss.ro, exact: true }).click();
    await expect(guideTip(page)).toHaveCount(0);

    await scrollToY(page, 0);
    await page.waitForTimeout(500);
    await centreOn(page, "#servicii");
    await page.waitForTimeout(6_000);
    await expect(guideTip(page)).toHaveCount(0);
    await expect(guideRoot(page)).toHaveAttribute("data-state", "idle");
  });

  test("the avatar opens the dialog on the guided chat, and the request says it came from the guide", async ({
    page,
  }) => {
    const calls = await stubContactApi(page);
    await gotoHydrated(page, "/");
    await armHud(page);

    await openRequestFromGuide(page);
    const dialog = modalDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(1);
    const flow = requestFlow(dialog);
    await expect(chatPanel(flow)).toBeVisible();
    await expect(chatToggle(flow)).toHaveAttribute("aria-expanded", "true");
    // Focus went into the dialog, on the chat.
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-modal="true"]'))).toBe(true);

    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();

    const body = await sentMessage(calls);
    expect(body.name).toBe(LEAD.name);
    // Opened at the top of the page: no topic on the centre line, so no section and no project.
    expect(originBlock(String(body.message))).toBe("- Sursă (CTA): guide");
  });

  test("the tip's own button opens the flow with its topic", async ({ page }) => {
    const calls = await stubContactApi(page);
    await gotoHydrated(page, "/");
    await armHud(page);

    const tip = await lingerForTip(page, "#servicii");
    await tip.getByRole("button", { name: GUIDE_COPY.open.ro, exact: true }).click();
    const flow = requestFlow(modalDialog(page));
    await expect(chatPanel(flow)).toBeVisible();
    await expect(guideTip(page), "opening the flow takes the tip down").toHaveCount(0);

    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();
    const message = String((await sentMessage(calls)).message);
    expect(originBlock(message)).toBe("- Secțiune: servicii\n- Sursă (CTA): guide-prompt");
  });

  test("Tab after arming still reaches the RO language option within 40 presses", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();
    const presses = await tabTo(page, LOCALE_LABELS.ro);
    expect(presses).toBeLessThanOrEqual(40);
    await expect(languageOption(page, "ro")).toBeFocused();
  });

  test("away: over the home page's request form the avatar fades and leaves the tab order", async ({ page }) => {
    await gotoHydrated(page, "/");
    await armHud(page);
    const avatar = guideAvatar(page);
    await expect(avatar).toHaveAttribute("tabindex", "0");

    await centreOn(page, '#estimare [data-testid="request-flow"][data-layout="section"]');
    await expect(guideRoot(page)).toHaveAttribute("data-away", "");
    await expect(avatar).toHaveCSS("opacity", "0");
    await expect(avatar).toHaveAttribute("tabindex", "-1");
    await expect(avatar).toHaveCSS("pointer-events", "none");
    // Faded, never removed: still in the DOM and the accessibility tree, so focus can come back.
    await expect(avatar).toHaveCSS("display", "grid");
    await expect(avatar).toHaveCSS("visibility", "visible");
    await expect(avatar).not.toHaveAttribute("inert", /.*/);

    await scrollToY(page, 0);
    await expect(guideRoot(page)).not.toHaveAttribute("data-away", /.*/);
    await expect(avatar).toHaveCSS("opacity", "1");
    await expect(avatar).toHaveAttribute("tabindex", "0");
  });
});

test.describe("Ghid TBS gating", () => {
  test("no consent: no avatar, whatever the visitor does; accepting brings it", async ({ page }) => {
    await gotoHydrated(page, "/");
    const banner = cookieBanner(page);
    await expect(banner).toBeVisible();

    await page.mouse.move(8, 8);
    await page.mouse.move(300, 300);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(2_000);
    await expect(page.locator("[data-hud]")).toHaveCount(0);

    await banner.getByRole("button", { name: new RegExp(`^${messages.ro["cookie.accept"]}$`, "i") }).click();
    await expect(banner).toHaveCount(0);
    // The answer IS the interaction: no further move is needed.
    await expect(guideAvatar(page)).toBeVisible({ timeout: 5_000 });
  });

  test("first visit: no avatar while the intro overlay is on screen", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    // Record, from the first byte, whether the guide and the intro ever share the document.
    await page.addInitScript(() => {
      const w = window as unknown as { __guideOverIntro?: boolean };
      w.__guideOverIntro = false;
      new MutationObserver(() => {
        if (document.querySelector("[data-guide]") && document.querySelector('[data-testid="intro"]')) {
          w.__guideOverIntro = true;
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await gotoHydrated(page, "/", { seedIntro: false });
    const overlay = introOverlay(page);
    await expect(overlay).toBeAttached();

    await page.mouse.move(8, 8);
    await page.mouse.move(200, 200);
    for (let i = 0; i < 10 && (await overlay.count()) > 0; i += 1) {
      await expect(page.locator("[data-hud]")).toHaveCount(0);
      await page.waitForTimeout(150);
    }
    await expect(overlay).toHaveCount(0, { timeout: 20_000 });
    // The pointer move made before the intro ended still counts: the guide arrives after it.
    await expect(guideAvatar(page)).toBeVisible({ timeout: 5_000 });
    expect(await page.evaluate(() => (window as unknown as { __guideOverIntro?: boolean }).__guideOverIntro)).toBe(false);
  });
});

test.describe("Ghid TBS under reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("the tip still appears, and nothing in the guide animates", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/");
    await armHud(page);
    await expect(guideRoot(page)).toHaveAttribute("data-state", "idle");

    await lingerForTip(page, "#servicii");
    await expect(guideRoot(page)).toHaveAttribute("data-state", "prompt");
    const animated = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-guide], [data-guide] *"))
        .map((el) => ({ el: el.getAttribute("class") ?? el.tagName, name: getComputedStyle(el).animationName }))
        .filter((entry) => entry.name !== "none"),
    );
    expect(animated).toEqual([]);
    expect(await page.evaluate(() => document.getAnimations().filter((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      return !!target && !!target.closest("[data-guide]");
    }).length)).toBe(0);
  });
});

test.describe("Ghid TBS on a service page", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await seedConsent(context, baseURL!);
  });

  test("/servicii/e-commerce: nothing heavy, no CSP violation, the service tip and the service in the request", async ({
    page,
  }) => {
    await watchCsp(page);
    const errors = consoleErrors(page);
    const calls = await stubContactApi(page);
    await gotoHydrated(page, "/servicii/e-commerce");
    await armHud(page);
    await expect(guideAvatar(page)).toBeVisible();

    const topic = page.locator('[data-guide-topic="service"]');
    await expect(topic).toHaveCount(1);
    const tip = await lingerForTip(page, '[data-guide-topic="service"]');
    await expect(tip.getByText(GUIDE_COPY.prompts.service.ro, { exact: true })).toBeVisible();

    await openRequestFromGuide(page);
    const flow = requestFlow(modalDialog(page));
    await expect(chatPanel(flow)).toBeVisible();
    await expect(chatToggle(flow)).toHaveAttribute("aria-expanded", "true");
    // The flow opened on this page's service.
    await expect(flow.getByText(SHOP_PRICE).first()).toBeVisible();

    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();
    const body = await sentMessage(calls);
    expect(String(body.estimate)).toBe(SHOP_PRICE);
    // The avatar was pressed with the steps still on the centre line: the topic travels too.
    expect(originBlock(String(body.message))).toBe(
      "- Serviciu: e-commerce\n- Secțiune: service\n- Sursă (CTA): guide",
    );

    await expect(page.locator("canvas")).toHaveCount(0);
    expect(await threeLoaded(page)).toBe(false);
    expect(await gsapLoaded(page)).toBe(false);
    expect(await cspViolations(page)).toEqual([]);
    expect(errors.page).toEqual([]);
    expect(errors.console).toEqual([]);
  });
});

test.describe("Ghid TBS on a 375×812 phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the avatar sits inside the viewport, and the open dialog covers it", async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await gotoHydrated(page, "/");
    await armHud(page);

    const avatar = guideAvatar(page);
    await expect(avatar).toBeVisible();
    // Measured at rest: the 0.7s entrance scales and lifts the button while `data-state="enter"`.
    await expect(guideRoot(page)).toHaveAttribute("data-state", "idle");
    const box = (await avatar.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(812);
    expect({ w: box.width, h: box.height, right: 375 - (box.x + box.width), bottom: 812 - (box.y + box.height) }).toEqual({
      w: 52,
      h: 52,
      right: 12,
      bottom: 12,
    });
    await expectNoHorizontalScroll(page);

    await openRequestFromGuide(page);
    await expect(modalDialog(page)).toBeVisible();
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const underDialog = await page.evaluate(({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      return { hit: hit?.tagName ?? null, inGuide: !!hit?.closest("[data-guide]") };
    }, centre);
    expect(underDialog.hit).not.toBeNull();
    expect(underDialog.inGuide, "the dialog covers the guide").toBe(false);
  });
});
