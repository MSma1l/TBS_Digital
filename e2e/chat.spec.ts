import { expect, test } from "@playwright/test";
import {
  PRIVATE_COPY,
  chatBubbles,
  chatInput,
  chatQuickReplies,
  estimatorSection,
  estimatorSummary,
  expectNoHorizontalScroll,
  gotoHydrated,
  seedConsent,
  sendChatMessage,
  stubContactApi,
  walkChatToEnd,
} from "./helpers";

/*
 * The extended chat in the estimator (`components/sections/Estimator.tsx`, `#estimare`).
 *
 * The assistant is not decoration: what the visitor types becomes a bubble, a freely typed
 * answer earns a clarification round chosen by the selected project type, and at the end the
 * dialog produces a SUMMARY that is shown on screen — the same text that travels inside the
 * request. Those four steps are what this file walks.
 *
 * The unit tests already pin the tree's shape; this file only asserts what a browser can:
 * that the transcript really renders, that the flow terminates, and that a hostile string
 * (a long unbroken word) cannot widen the page.
 *
 * `POST /api/contact` is stubbed throughout — the chat sits next to a live contact form.
 */

/** What a visitor types when they'd rather describe the project than pick a quick reply. */
const DESCRIPTION =
  "Vrem un magazin online cu plăți prin card și livrare în toată țara.";

/**
 * 80 characters, no spaces — the classic layout breaker. It has to wrap inside its bubble;
 * `overflow-wrap: anywhere` is the CSS that makes that true and this is its guard.
 */
const LONG_WORD = "a".repeat(80);

test.describe("estimator chat", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await stubContactApi(page);
  });

  test("a freely typed answer becomes a bubble and earns a clarification @smoke", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);
    await expect(chatInput(estimator)).toBeVisible();

    // One bubble to start with: the assistant's opening question.
    await expect(chatBubbles(estimator)).toHaveCount(1);

    await sendChatMessage(estimator, DESCRIPTION);

    // The visitor's own words, verbatim, as their bubble…
    await expect(estimator.getByText(DESCRIPTION, { exact: true })).toBeVisible();
    // …followed by the assistant's next turn: three bubbles now, not two.
    await expect(chatBubbles(estimator)).toHaveCount(3);

    // And that next turn is the CLARIFICATION — the step a free answer always triggers,
    // worded for the selected project type (`CLARIFY_Q` in Estimator.tsx).
    await expect(
      chatBubbles(estimator).last(),
      "a freely typed answer should be followed by a clarification question",
    ).toContainText(PRIVATE_COPY.clarifyPrefix);

    // The composer is empty again and ready for the next answer.
    await expect(chatInput(estimator)).toHaveValue("");
  });

  test("the dialog ends with a summary rendered on screen", async ({ page }) => {
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);
    await expect(chatInput(estimator)).toBeVisible();

    // Nothing is claimed before the end.
    await expect(estimatorSummary(estimator)).toHaveCount(0);

    await sendChatMessage(estimator, DESCRIPTION);
    await walkChatToEnd(estimator);

    const summary = estimatorSummary(estimator);
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(PRIVATE_COPY.summaryTitle);
    // What the visitor described is IN it — the promise the assistant makes at the end.
    await expect(summary).toContainText(DESCRIPTION);
    // …and so is the estimate the panel is showing.
    await expect(summary).toContainText(/€\d/);

    // The dialog is over: no more questions to answer.
    await expect(chatQuickReplies(estimator)).toHaveCount(0);
    await expect(chatInput(estimator)).toHaveCount(0);
  });

  test("an 80-character word does not push the page sideways", async ({ page }) => {
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);
    await expect(chatInput(estimator)).toBeVisible();

    await sendChatMessage(estimator, LONG_WORD);

    await expect(estimator.getByText(LONG_WORD, { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test.describe("on a 390px phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("an 80-character word does not push the page sideways", async ({ page }) => {
      await gotoHydrated(page, "/");
      const estimator = estimatorSection(page);
      await expect(chatInput(estimator)).toBeVisible();

      await sendChatMessage(estimator, LONG_WORD);

      const bubble = estimator.getByText(LONG_WORD, { exact: true });
      await expect(bubble).toBeVisible();

      // The bubble itself has to stay inside the viewport, not just the document —
      // an element that overflows a scroll container would pass the document check alone.
      const box = (await bubble.boundingBox())!;
      expect(
        Math.round(box.x + box.width),
        "the bubble must not extend past the right edge of the screen",
      ).toBeLessThanOrEqual(390);

      await expectNoHorizontalScroll(page);
    });
  });
});
