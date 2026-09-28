import { expect, test, type Locator, type Page } from "@playwright/test";
import { services as seededServices } from "@/lib/content";
import { SERVICE_TO_ESTIMATOR_TYPE } from "@/lib/directions";
import {
  PRIVATE_COPY,
  REQUEST_STEPS,
  chatInput,
  chatPanel,
  chatQuickReplies,
  chatSendButton,
  expectNoHorizontalScroll,
  expectTappable,
  fillContactStep,
  flowFields,
  gotoHydrated,
  modalDialog,
  openRequestModal,
  requestFlow,
  seedConsent,
  stepPanel,
  stepPanels,
  stubContactApi,
  type StubbedCall,
} from "./helpers";

/*
 * The request flow, which is ONE arrangement in two places.
 *
 * It was two. The home page showed the deck — both bays, everything at once — and the dialog
 * ran the same flow as three steps on one column with the assistant behind a toggle, because
 * two columns squeezed into a 960px modal read as cramped. The owner asked for them to be the
 * same thing (2026-09-26) and the cramping was answered differently: the deck now measures
 * ITSELF (`@container`) instead of the window, so it stacks its bays on its own width.
 *
 * So what this file walks is the deck, in the dialog:
 *   · everything on screen at once, and a request that can be sent without a word to the
 *     assistant — the rule that outlived the wizard: the fast path is never gated;
 *   · the guided one, whose answers have to end up inside the request that is posted.
 *
 * Everything is addressed through the flow's declared contract — `[data-testid]`,
 * `[data-step]`, `data-active` — and never through copy or CSS-module class names, because the
 * copy is trilingual and the styles move.
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

test.describe("request flow — the deck, in the dialog", () => {
  let calls: StubbedCall[];

  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    calls = await stubContactApi(page);
  });

  test("the dialog opens on the whole deck @smoke", async ({ page }) => {
    const flow = await openFlowDialog(page);

    await expect(flow).toHaveAttribute("data-layout", "dialog");
    /* All three regions, all of them live. The wizard's rule was the opposite — exactly one
       active panel — so this assertion is the change, stated. */
    await expect(stepPanels(flow)).toHaveCount(REQUEST_STEPS.length);
    for (const step of REQUEST_STEPS) {
      await expect(stepPanel(flow, step)).toBeVisible();
      await expect(stepPanel(flow, step)).toHaveAttribute("data-active", "true");
    }
    /* The assistant is part of the deck rather than something to ask for, and the contact
       fields are reachable without pressing anything at all. */
    await expect(chatPanel(flow)).toBeVisible();
    await expect(chatInput(flow)).toBeVisible();
    await expect(flowFields(flow).submit).toBeEnabled();
    /* Opened from the e-commerce page, so it starts on the shop price. */
    await expect(flow.getByText(priceForSlug("e-commerce")).first()).toBeVisible();
    /* And the page's own furniture stayed on the page: one #estimare per document. */
    await expect(page.locator("#estimare")).toHaveCount(0);
  });

  test("sends with the assistant never touched, carrying the service it was opened from", async ({
    page,
  }) => {
    const flow = await openFlowDialog(page);

    await fillContactStep(flow, LEAD);
    const submit = flowFields(flow).submit;
    await expect(submit, "the submit must be reachable without the assistant").toBeEnabled();
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

  test("on the home page it is the same deck, as a section rather than a dialog", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");

    const flow = requestFlow(page);
    await expect(flow).toBeVisible();
    await expect(flow).toHaveAttribute("data-layout", "section");
    // No dialog was opened to get here.
    await expect(modalDialog(page)).toHaveCount(0);

    // The same three regions, all live, the same assistant — which is the whole point: the
    // two are one design now, and `data-layout` says only WHERE it is.
    await expect(stepPanels(flow)).toHaveCount(REQUEST_STEPS.length);
    await expect(chatInput(flow)).toBeVisible();
  });
});

test.describe("request flow — the assistant", () => {
  let calls: StubbedCall[];

  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    calls = await stubContactApi(page);
  });

  test("what was answered in the chat travels inside the sent request @smoke", async ({
    page,
  }) => {
    const flow = await openFlowDialog(page);

    const panel = chatPanel(flow);
    await expect(panel).toBeVisible();
    await chatInput(panel).fill(DESCRIPTION);
    await chatSendButton(panel).click();

    // The visitor's own words, verbatim, as their bubble.
    await expect(panel.getByText(DESCRIPTION, { exact: true })).toBeVisible();

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

  test("a chip picked after the conversation still reaches the payload", async ({ page }) => {
    const flow = await openFlowDialog(page);

    /* The deck's real advantage over the wizard, and the thing worth pinning: the chips and
       the assistant are on screen together, so changing the project AFTER talking is one
       press and no navigation — and the request carries the later choice. */
    await chatQuickReplies(chatPanel(flow)).first().click();
    const site = stepPanel(flow, "project").getByRole("button").first();
    /* Named, not merely first: the payload assertion below is a price, and two chips could
       share one. If the catalogue is ever reordered this fails here rather than passing for
       the wrong reason. */
    await expect(site).toHaveAccessibleName(PRIVATE_COPY.estimatorFirstType);
    await site.click();
    await expect(site).toHaveAttribute("aria-pressed", "true");

    await fillContactStep(flow, LEAD);
    await flowFields(flow).submit.click();

    const body = await sentBody(calls);
    expect(String(body.estimate)).toBe(priceForSlug("produs-digital"));
  });
});

test.describe("request flow — on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  /* Nothing here submits — the stub is the seatbelt, so its call log is not read. */
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await stubContactApi(page);
  });

  test("the deck stacks into the sheet, and nothing scrolls sideways", async ({ page }) => {
    const flow = await openFlowDialog(page);
    const dialog = modalDialog(page);

    /* One column. The deck's own `@container` rule decides this, on the width the deck has
       rather than on the window's — which is what lets the same markup be two bays at 1440
       and one here. Measured as geometry, not as a class: every region starts at the same x. */
    const lefts: number[] = [];
    for (const step of REQUEST_STEPS) {
      const box = await stepPanel(flow, step).boundingBox();
      expect(box, `the "${step}" region should have a layout box`).not.toBeNull();
      lefts.push(Math.round(box!.x));
    }
    expect(new Set(lefts).size, "stacked, every region shares one left edge").toBe(1);

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

    // The one target that matters, at the bottom of the tallest thing this dialog shows.
    await flowFields(flow).submit.scrollIntoViewIfNeeded();
    await expectTappable(flowFields(flow).submit, "the submit button");
    await expectNoHorizontalScroll(page);
  });
});
