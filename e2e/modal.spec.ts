import { expect, test, type Locator, type Page } from "@playwright/test";
import { solUI } from "@/lib/solutions";
import { services as seededServices } from "@/lib/content";

/* The dialog shows the OWNER's price for the service it was opened from — seeded in
   lib/content.ts and overridable from the admin. Asserting a derived value keeps this test
   about the preselection wiring; a repricing should not turn it red. */
const price = (serviceId: string) =>
  seededServices.find((s) => s.id === serviceId)!.price.ro;
import {
  PRIVATE_COPY,
  chatPanel,
  expectActiveStep,
  goToStep,
  requestFlow,
  expectNoHorizontalScroll,
  focusIsInsideDialog,
  gotoHydrated,
  modalCloseButton,
  modalDialog,
  modalOverlay,
  openRequestModal,
  requestModalCta,
  seedConsent,
  stubContactApi,
} from "./helpers";

/*
 * The request dialog on a service page.
 *
 * `components/sections/DirectionPage.tsx` puts a `RequestModal` in the action bar under the
 * hero: pressing "Vorbește cu echipa" opens `components/ui/Modal.tsx` with the REAL request
 * flow inside it (`RequestSection` → `Estimator`), the service already chosen.
 *
 * What is tested here is the part jsdom cannot prove: that it behaves like a dialog in a
 * real browser — focus goes in, stays in, and comes back; Escape and the scrim close it and
 * a click on its own body does not; the page behind it is frozen and unfrozen exactly where
 * it was; and on a phone it is a bottom sheet that does not widen the document.
 *
 * `POST /api/contact` is stubbed in every test even though none of them submits: the form is
 * live inside the dialog, so a stray Enter must not be able to create a lead.
 */

/** A service page whose estimator type is E-commerce (€6.000) — see SERVICE_TO_ESTIMATOR_TYPE. */
const ECOMMERCE_PAGE = "/servicii/e-commerce";

/** …and one that maps to the web/site type (€3.000). */
const PRODUCT_PAGE = "/servicii/produs-digital";

/** Press Tab `times` times, failing the moment focus leaves the dialog. */
async function tabAround(page: Page, times: number, shift = false): Promise<void> {
  for (let i = 1; i <= times; i += 1) {
    await page.keyboard.press(shift ? "Shift+Tab" : "Tab");
    const inside = await focusIsInsideDialog(page);
    expect(
      inside,
      `focus escaped the dialog after ${i} ${shift ? "Shift+Tab" : "Tab"} press(es)`,
    ).toBe(true);
  }
}

/** How far down the document is scrolled right now. */
const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

/** The panel inside the overlay — the visible sheet/card, not the scrim. */
const panelBox = async (dialog: Locator) => {
  const box = await dialog.boundingBox();
  expect(box, "the dialog panel should have a layout box").not.toBeNull();
  return box!;
};

/**
 * A point on the scrim that is not on the panel — and not on the fixed status bar pinned to
 * the top of the viewport, which is what a naive "click the top-left corner" hits.
 * Left of the panel on a wide screen, above the sheet on a phone.
 */
async function scrimPoint(page: Page, dialog: Locator): Promise<{ x: number; y: number }> {
  const box = await panelBox(dialog);
  const viewport = page.viewportSize()!;
  return box.x > 24
    ? { x: Math.round(box.x / 2), y: Math.round(box.y + box.height / 2) }
    : { x: Math.round(viewport.width / 2), y: Math.round(box.y / 2) };
}

/**
 * The dialog's own heading, addressed through the id `aria-labelledby` points at.
 *
 * `getByRole("heading", { name })` would be ambiguous: the estimator inside the dialog
 * carries the SAME title as the dialog around it, so the panel really does contain two
 * identical `<h2>`s. The id is the one that names the dialog.
 */
async function dialogHeading(page: Page, dialog: Locator): Promise<Locator> {
  const id = await dialog.getAttribute("aria-labelledby");
  expect(id, "the dialog should be labelled by its heading").toBeTruthy();
  return page.locator(`#${id}`);
}

/**
 * The request flow is `next/dynamic`-loaded, so the dialog is on screen a moment before its
 * body is. Anything that measures the panel or walks its focus order has to wait for the real
 * content first.
 *
 * It waits on the flow container, not on the submit button: the flow now opens on step 1
 * (project) and the submit lives on step 3 (contact), so the button is legitimately absent
 * at this point.
 */
async function waitForFlow(dialog: Locator): Promise<void> {
  await expect(requestFlow(dialog)).toBeVisible();
}

test.describe("request modal", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await stubContactApi(page);
  });

  test("the service-page CTA opens the real request flow @smoke", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);

    // Nothing is rendered until the CTA is pressed — the dialog is not a hidden node.
    await expect(modalDialog(page)).toHaveCount(0);

    const dialog = await openRequestModal(page);

    // It is the stepped flow, in its dialog shape, and it opens on the first step.
    const flow = requestFlow(dialog);
    await expect(flow).toBeVisible();
    await expect(flow).toHaveAttribute("data-layout", "dialog");
    await expectActiveStep(flow, "project");

    // The assistant is OPTIONAL: it is not merely hidden, it is not rendered until asked for.
    await expect(chatPanel(flow)).toHaveCount(0);

    // And the flow inside is the real estimator, not a copy: walking to the contact step
    // produces its own submit button and the email field the form actually posts.
    await goToStep(flow, "contact");
    await expect(
      dialog.getByRole("button", { name: PRIVATE_COPY.estimatorSubmit, exact: true }),
    ).toBeVisible();
    await expect(dialog.locator('input[type="email"]')).toBeVisible();
  });

  test("it is a real dialog: role, aria-modal and a name from its own heading", async ({
    page,
  }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const dialog = await openRequestModal(page);

    await expect(dialog).toHaveAttribute("aria-modal", "true");
    // The name comes from the <h2> via aria-labelledby, not from a hand-written aria-label.
    await expect(dialog).toHaveAccessibleName(PRIVATE_COPY.modalTitle);
    const labelledBy = await dialog.getAttribute("aria-labelledby");
    expect(labelledBy, "aria-labelledby should point at the heading").toBeTruthy();
    await expect(page.locator(`#${labelledBy}`)).toHaveText(PRIVATE_COPY.modalTitle);
    // The supporting line is wired up too, when there is one.
    const describedBy = await dialog.getAttribute("aria-describedby");
    expect(describedBy, "aria-describedby should point at the lead").toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
  });

  test("focus moves into the dialog on open and cannot Tab out of it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const dialog = await openRequestModal(page);

    // Focus is inside immediately — the ✕ is the first focusable node in the panel.
    expect(await focusIsInsideDialog(page), "focus should enter on open").toBe(true);
    await expect(modalCloseButton(page)).toBeFocused();

    // Only now let the lazily-loaded flow land, so the Tab cycle below walks the whole
    // dialog rather than a panel that is still one button wide.
    await waitForFlow(dialog);

    // The dialog holds a long form, so 40 presses is well past its last control and back
    // round to the first one.
    await tabAround(page, 40);
    await tabAround(page, 40, true);
  });

  test("closing returns focus to the CTA that opened it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const cta = requestModalCta(page);
    await openRequestModal(page);

    await page.keyboard.press("Escape");
    await expect(modalDialog(page)).toHaveCount(0);
    await expect(cta, "focus must go back to the trigger").toBeFocused();
  });

  test("the ✕ closes it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    await openRequestModal(page);

    await modalCloseButton(page).click();
    await expect(modalDialog(page)).toHaveCount(0);
  });

  test("Escape closes it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    await openRequestModal(page);

    await page.keyboard.press("Escape");
    await expect(modalDialog(page)).toHaveCount(0);
  });

  test("a click on the overlay closes it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const dialog = await openRequestModal(page);
    await waitForFlow(dialog);

    // A real press and release on the scrim, beside the panel: `Modal` closes only when
    // BOTH ends of the gesture were the backdrop itself.
    await expect(modalOverlay(page)).toBeVisible();
    const point = await scrimPoint(page, dialog);
    await page.mouse.click(point.x, point.y);
    await expect(modalDialog(page)).toHaveCount(0);
  });

  test("a click INSIDE the dialog does not close it", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const dialog = await openRequestModal(page);
    await waitForFlow(dialog);

    // The heading: inside the panel, and not a control that would do something else.
    await (await dialogHeading(page, dialog)).click();
    await expect(dialog).toBeVisible();

    // A press that STARTS inside and ends on the scrim must not close it either — that is
    // the drag-select case `pressStartedOnOverlay` exists for.
    const box = await panelBox(dialog);
    const point = await scrimPoint(page, dialog);
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y);
    await page.mouse.up();
    await expect(dialog, "a drag ending on the scrim must not close the dialog").toBeVisible();
  });

  test("the page behind it cannot scroll, and returns to exactly where it was", async ({
    page,
  }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);

    await page.evaluate(() => window.scrollTo(0, 600));
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
    const before = await scrollY(page);

    await openRequestModal(page);

    // The body is pinned (`position: fixed`), so the document behind cannot move at all.
    await expect(page.locator("body")).toHaveCSS("position", "fixed");
    await page.mouse.move(20, 400);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(150);
    expect(await scrollY(page), "the page must not scroll behind the dialog").toBe(0);

    await page.keyboard.press("Escape");
    await expect(modalDialog(page)).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveCSS("position", "fixed");
    await expect
      .poll(() => scrollY(page), { message: "scroll position must be restored on close" })
      .toBe(before);
  });

  test("the service is preselected: e-commerce opens on the shop price", async ({ page }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);
    const dialog = await openRequestModal(page);

    await expect(dialog.getByText(price("shop"))).toBeVisible();
    await expect(dialog.getByText(price("site"))).toHaveCount(0);
  });

  test("the service is preselected: produs-digital opens on the site price", async ({ page }) => {
    await gotoHydrated(page, PRODUCT_PAGE);
    const dialog = await openRequestModal(page);

    await expect(dialog.getByText(price("site"))).toBeVisible();
    await expect(dialog.getByText(price("shop"))).toHaveCount(0);
  });

  test("the second CTA at the bottom of the page opens the same preselected flow", async ({
    page,
  }) => {
    await gotoHydrated(page, ECOMMERCE_PAGE);

    await page.getByRole("button", { name: solUI.start.ro, exact: true }).click();
    const dialog = modalDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(price("shop"))).toBeVisible();
  });

  test.describe("on a 390px phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("it is a sheet anchored to the bottom and never scrolls sideways", async ({
      page,
    }) => {
      await gotoHydrated(page, ECOMMERCE_PAGE);
      const dialog = await openRequestModal(page);
      await waitForFlow(dialog);

      const box = await panelBox(dialog);
      const viewport = page.viewportSize()!;
      // Anchored to the bottom edge: `align-items: flex-end` with no bottom padding.
      expect(
        Math.round(box.y + box.height),
        "the sheet should sit on the bottom edge of the viewport",
      ).toBeGreaterThanOrEqual(viewport.height - 2);
      // …and it is a sheet, not a full-screen takeover.
      expect(Math.round(box.height)).toBeLessThan(viewport.height);
      // 10px side inset on each side (the signed-off sheet margin).
      expect(Math.round(box.x)).toBeGreaterThanOrEqual(0);
      expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(viewport.width);

      await expectNoHorizontalScroll(page);
    });
  });
});
