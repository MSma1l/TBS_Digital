import { expect, test, type Locator, type Page } from "@playwright/test";
import { services as seededServices } from "@/lib/content";
import { SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import type { Theme } from "@/lib/theme/theme";
import {
  PRIVATE_COPY,
  REQUEST_STEPS,
  activeStep,
  activeStepPanels,
  chatInput,
  chatPanel,
  chatSendButton,
  chatToggle,
  currentStepItem,
  expectActiveStep,
  expectNoHorizontalScroll,
  expectTappable,
  fillContactStep,
  flowFields,
  goBackOneStep,
  goToStep,
  gotoHydrated,
  modalDialog,
  openChat,
  openRequestModal,
  requestFlow,
  requestSteps,
  seedConsent,
  seedTheme,
  stepPanel,
  stepPanels,
  stubContactApi,
  type RequestStep,
  type StubbedCall,
} from "./helpers";

/*
 * The RESTRUCTURED request flow.
 *
 * The client asked for one order and one rule. The order is `1 choose the project →
 * 2 choose what it should contain → 3 fill in your details`, on a single column, one step on
 * screen at a time — not the two-column estimator squeezed into a 960px modal. The rule is
 * that the conversational assistant is OPTIONAL: it starts only when it is asked for, and the
 * fast path to a sent request must never be locked behind it.
 *
 * So this file walks BOTH journeys:
 *   · the fast one — project, options, contact, send, with the chat never touched;
 *   · the guided one — the same flow with the assistant switched on, whose answers have to
 *     end up inside the request that is actually posted.
 *
 * Everything is addressed through the flow's declared contract — `[data-testid]`,
 * `[data-step]`, `data-active`, `aria-current`, `aria-expanded` — and never through copy or
 * CSS-module class names, because the copy is trilingual and the styles are being rewritten
 * in the very change these tests guard.
 *
 * SAFETY: `POST /api/contact` is stubbed with `page.route()` in every single test, including
 * the ones that never submit. The form inside the flow is live and points at whatever backend
 * the build was given, so a stray Enter must not be able to create a lead. No request ever
 * leaves the browser.
 */

/** The service page the flow is opened from. `e-commerce` preselects the `shop` service. */
const ECOMMERCE_PAGE = "/servicii/e-commerce";

/**
 * The price the flow must show for a service, read out of the seeded catalogue.
 *
 * DERIVED, never typed: prices are the owner's and are edited in the admin panel, so a
 * literal "€6.000" in a spec would turn red the day the owner repriced anything. What is being
 * guarded here is the preselection wiring, not the number.
 */
const servicePrice = (serviceId: string): string =>
  seededServices.find((s) => s.id === serviceId)!.price.ro;

/** Estimator type -> the service whose price the admin edits (`SERVICE_FOR_TYPE`). */
const SERVICE_FOR_TYPE: Record<string, string> = {
  site: "site",
  crm: "crm",
  automation: "automation",
  ecommerce: "shop",
  mobile: "mobile",
};

/** The price a direction slug must end up showing, all the way from the slug. */
const priceForSlug = (slug: string): string =>
  servicePrice(SERVICE_FOR_TYPE[SERVICE_TO_ESTIMATOR_TYPE[slug]]);

/** A plausible lead. Fictional address on the reserved `example.com` domain. */
const LEAD = {
  name: "Ion Popescu",
  email: "ion.popescu@example.com",
  phone: "+373 60 000 000",
};

/** What a visitor types when they would rather describe the project than pick a reply. */
const DESCRIPTION = "Vrem un magazin online cu plăți prin card și livrare în toată țara.";

/** Open the dialog from a service page and wait for the lazily-loaded flow inside it. */
async function openFlowDialog(page: Page, path = ECOMMERCE_PAGE): Promise<Locator> {
  await gotoHydrated(page, path);
  const dialog = await openRequestModal(page);
  const flow = requestFlow(dialog);
  await expect(flow, "the dialog should contain the request flow").toBeVisible();
  return flow;
}

/**
 * The single POST the whole flow is allowed to make, as the browser sent it.
 *
 * Polled rather than read: the `page.route()` handler runs in the driver, so the array is
 * appended to a tick or two after the click resolves. A bare `toHaveLength(1)` here would be
 * a flake generator that only shows up on a loaded machine.
 */
async function sentBody(calls: StubbedCall[]): Promise<Record<string, unknown>> {
  await expect
    .poll(() => calls.length, { message: "the flow should post exactly one request" })
    .toBe(1);
  expect(calls[0].method).toBe("POST");
  expect(new URL(calls[0].url).pathname).toBe("/api/contact");
  return calls[0].body as Record<string, unknown>;
}

test.describe("request flow — the fast path, without the assistant", () => {
  let calls: StubbedCall[];

  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    calls = await stubContactApi(page);
  });

  test("the dialog opens on the project step @smoke", async ({ page }) => {
    const flow = await openFlowDialog(page);

    // The dialog layout, not the section one — the same flow, told where it is rendered.
    await expect(flow).toHaveAttribute("data-layout", "dialog");

    // Step one is "choose the project", which is the order the client asked for.
    await expectActiveStep(flow, "project");
    await expect(stepPanel(flow, "project")).toBeVisible();

    // All three steps exist, so the flow is a flow and not a single screen that renames itself.
    for (const step of REQUEST_STEPS) {
      await expect(stepPanel(flow, step), `the "${step}" step should exist`).toHaveCount(1);
    }
  });

  test("the assistant does not exist until it is asked for", async ({ page }) => {
    const flow = await openFlowDialog(page);

    // Not "hidden" — absent. A panel rendered `display:none` is still in the tab order's
    // way, still in the accessibility tree of some readers, and still work the visitor did
    // not ask for.
    await expect(chatPanel(flow), "the chat panel must not be in the DOM yet").toHaveCount(0);

    // …and the switch says so out loud, for a visitor who cannot see that it is closed.
    await expect(chatToggle(flow)).toBeVisible();
    await expect(chatToggle(flow)).toHaveAttribute("aria-expanded", "false");
  });

  test("project → options → contact → sent, with the chat never touched", async ({ page }) => {
    const flow = await openFlowDialog(page);

    await expectActiveStep(flow, "project");

    await goToStep(flow, "options");
    await expectActiveStep(flow, "options");

    await goToStep(flow, "contact");
    await expectActiveStep(flow, "contact");

    await fillContactStep(flow, LEAD);

    // The chat was never opened, and the fast path is not gated behind it.
    await expect(chatPanel(flow), "the fast path must not need the assistant").toHaveCount(0);

    const submit = flowFields(flow).submit;
    await expect(submit, "the submit button must be reachable without the chat").toBeEnabled();
    await submit.click();

    // The request really left: intercepted in the browser, so no lead reaches production.
    const body = await sentBody(calls);
    expect(body.name).toBe(LEAD.name);
    expect(body.email).toBe(LEAD.email);
    expect(body.phone).toBe(LEAD.phone);

    // …carrying the service the dialog was opened from, both as the estimate the visitor was
    // shown and as the routing line inside the message.
    expect(String(body.estimate)).toBe(priceForSlug("e-commerce"));
    expect(String(body.project).length).toBeGreaterThan(0);
    expect(
      String(body.message),
      "the message should name the service page the request came from",
    ).toContain("e-commerce");
  });

  test("on the home page the same flow is a section, not a dialog", async ({ page }) => {
    await gotoHydrated(page, "/");

    const flow = requestFlow(page);
    await expect(flow).toBeVisible();
    await expect(flow).toHaveAttribute("data-layout", "section");
    // No dialog was opened to get here.
    await expect(modalDialog(page)).toHaveCount(0);

    // The same three regions — but the section shows them all at once, which is the
    // signed-off homepage design. There is no stepping and no toggle here: the assistant is
    // already on screen, so making it "optional" would only hide something that was working.
    // Optionality is a fix for the DIALOG, where the two-column layout was cramped.
    await expect(stepPanels(flow)).toHaveCount(REQUEST_STEPS.length);
    await expect(activeStepPanels(flow)).toHaveCount(REQUEST_STEPS.length);
    await expect(chatToggle(flow)).toHaveCount(0);
    await expect(chatInput(flow)).toBeVisible();
  });
});

test.describe("request flow — the guided path, with the assistant", () => {
  let calls: StubbedCall[];

  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    calls = await stubContactApi(page);
  });

  test("the toggle opens the assistant and closes it again @smoke", async ({ page }) => {
    const flow = await openFlowDialog(page);
    const toggle = chatToggle(flow);

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(chatPanel(flow)).toHaveCount(0);

    const panel = await openChat(flow);
    // The assistant really started: it has a live composer, not an empty shell.
    await expect(chatInput(panel)).toBeVisible();

    // …and it closes back down, leaving the flow where it was.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(chatPanel(flow), "closing should retract the panel").toHaveCount(0);
    await expectActiveStep(flow, "project");
  });

  test("what was answered in the chat travels inside the sent request", async ({ page }) => {
    const flow = await openFlowDialog(page);

    const panel = await openChat(flow);
    await chatInput(panel).fill(DESCRIPTION);
    await chatSendButton(panel).click();

    // The visitor's own words, verbatim, as their bubble.
    await expect(panel.getByText(DESCRIPTION, { exact: true })).toBeVisible();

    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();

    const body = await sentBody(calls);
    // The whole promise of the assistant: the summary of the conversation is attached to the
    // request. Asserting on the payload, not on the screen — the screen is the unit tests'.
    expect(String(body.message), "the chat answer must be inside the sent message").toContain(
      DESCRIPTION,
    );
    expect(String(body.message)).toContain(PRIVATE_COPY.summaryPayloadTitle);
  });
});

test.describe("request flow — navigation and state", () => {
  let calls: StubbedCall[];

  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    calls = await stubContactApi(page);
  });

  test("the active step is reflected in data-active AND aria-current", async ({ page }) => {
    const flow = await openFlowDialog(page);

    for (const step of REQUEST_STEPS) {
      await goToStep(flow, step as RequestStep);

      // The visual half: exactly one panel is active, and it is this one.
      await expect(activeStepPanels(flow)).toHaveCount(1);
      await expect(stepPanel(flow, step)).toHaveAttribute("data-active", "true");

      // The assistive half: the indicator names exactly one current step. `data-active` is a
      // styling hook that a screen reader cannot see — `aria-current` is what it announces,
      // and the two must never disagree.
      await expect(requestSteps(flow)).toBeVisible();
      const current = currentStepItem(flow);
      await expect(current, `the indicator should mark "${step}" as current`).toHaveCount(1);

      // When the indicator keys its items by step, the two halves must point at the same one.
      const marked = await current.getAttribute("data-step");
      if (marked !== null) {
        expect(marked, "aria-current and data-active must name the same step").toBe(step);
      }
    }
  });

  test("going back does not lose what was already filled in", async ({ page }) => {
    const flow = await openFlowDialog(page);

    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);

    // Back one step — the visitor changed their mind about the options.
    await goBackOneStep(flow);
    expect(await activeStep(flow), "back should leave the contact step").not.toBe("contact");

    // …and forward again. Everything typed is still there: a stepped flow that forgets is
    // worse than the single screen it replaced.
    await goToStep(flow, "contact");
    const f = flowFields(flow);
    await expect(f.name, "the name must survive a trip back").toHaveValue(LEAD.name);
    await expect(f.email, "the email must survive a trip back").toHaveValue(LEAD.email);
    await expect(f.phone, "the phone must survive a trip back").toHaveValue(LEAD.phone);
  });

  test("the preselected service survives the whole flow", async ({ page }) => {
    const flow = await openFlowDialog(page);

    const expected = priceForSlug("e-commerce");
    // Opened from the e-commerce page, so the flow starts on the shop price and not on the
    // catalogue's first entry.
    await expect(flow.getByText(expected).first()).toBeVisible();

    await goToStep(flow, "options");
    await goToStep(flow, "contact");
    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();

    // The proof that it survived is the payload: three steps later the request still carries
    // the price of the service the visitor was reading about.
    const body = await sentBody(calls);
    expect(String(body.estimate)).toBe(expected);
    expect(String(body.message)).toContain(expected);
  });
});

test.describe("request flow — on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  /* Nothing here submits — the stub is the seatbelt, so its call log is not read. */
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await stubContactApi(page);
  });

  test("one step per screen, a bottom sheet, and nothing scrolls sideways", async ({ page }) => {
    const flow = await openFlowDialog(page);
    const dialog = modalDialog(page);

    // One step on screen. Not "one is active while the others are merely below the fold" —
    // the inactive panels must not be rendered visibly at all, which is what makes this a
    // single-column stepped flow rather than the old long scroll.
    await expectActiveStep(flow, "project");
    const visibleSteps = [];
    for (const step of REQUEST_STEPS) {
      if (await stepPanel(flow, step).isVisible()) visibleSteps.push(step);
    }
    expect(visibleSteps, "exactly one step may be on screen at 375px").toEqual(["project"]);

    // The sheet sits on the bottom edge of the viewport and stays inside it horizontally.
    const viewport = page.viewportSize()!;
    const box = (await dialog.boundingBox())!;
    expect(box, "the sheet should have a layout box").not.toBeNull();
    expect(
      Math.round(box.y + box.height),
      "the sheet should be anchored to the bottom edge",
    ).toBeGreaterThanOrEqual(viewport.height - 2);
    expect(Math.round(box.x)).toBeGreaterThanOrEqual(0);
    expect(Math.round(box.x + box.width)).toBeLessThanOrEqual(viewport.width);

    await expectNoHorizontalScroll(page);

    // The two controls a thumb has to hit on this step.
    await expectTappable(chatToggle(flow), "the assistant toggle");

    // …and the same holds once the flow reaches the contact step, where the sheet is at its
    // tallest and the submit button is the one target that matters.
    await goToStep(flow, "contact");
    await expectActiveStep(flow, "contact");
    await expectNoHorizontalScroll(page);
    await expectTappable(flowFields(flow).submit, "the submit button");
  });
});

/*
 * At least one COMPLETE journey per theme.
 *
 * The palette is server-rendered from the `tbs_theme` cookie, so a dark-theme run is a
 * different first byte, not a class toggled afterwards — worth walking end to end rather than
 * screenshotting one panel.
 */
for (const theme of ["light", "dark"] as Theme[]) {
  test.describe(`request flow — a full journey in the ${theme} theme`, () => {
    let calls: StubbedCall[];

    test.beforeEach(async ({ page, context, baseURL }) => {
      await seedConsent(context, baseURL!);
      await seedTheme(context, theme, baseURL!);
      calls = await stubContactApi(page);
    });

    test(`project → options → contact → sent (${theme})`, async ({ page }) => {
        const flow = await openFlowDialog(page);

      // The journey really is running in the theme this test claims.
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      await expectActiveStep(flow, "project");
      await goToStep(flow, "options");
      await goToStep(flow, "contact");
      await fillContactStep(flow, LEAD);
      await flowFields(flow).submit.click();

      const body = await sentBody(calls);
      expect(body.name).toBe(LEAD.name);
      expect(body.email).toBe(LEAD.email);
      expect(String(body.estimate)).toBe(priceForSlug("e-commerce"));
    });
  });
}
