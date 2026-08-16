import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  PRIVATE_COPY,
  chatInput,
  dictationSlot,
  estimatorSection,
  gotoHydrated,
  seedConsent,
  stubContactApi,
} from "./helpers";

/*
 * Dictation (`components/ui/DictationButton.tsx`).
 *
 * Two halves, both driven by `addInitScript`, which runs before a byte of app code does.
 *
 * The first half REMOVES speech recognition from the browser and asserts that the control
 * then does not exist at all — the component promises "when the API isn't there, neither is
 * the button", and a dead microphone that does nothing when pressed is exactly the failure
 * it is written to avoid. The removal is deliberate rather than assumed: the Chromium this
 * suite pins (151) *does* ship `SpeechRecognition` and `webkitSpeechRecognition`, so on a
 * plain load the button is really there. Asserting "no button" without deleting the API
 * first would be a test that quietly passes for the wrong reason on one browser build and
 * fails on the next.
 *
 * The second half injects a fake recogniser and drives the four rules the component is
 * built around:
 *   · nothing is constructed until the visitor clicks;
 *   · a click produces a visible listening state;
 *   · recognised text lands in an EDITABLE box and reaches the form only on confirmation;
 *   · a refused microphone is a message, not a breakage.
 *
 * No audio is ever captured: `getUserMedia` is stubbed too, so the run needs no microphone
 * and no permission prompt.
 */

/** Handles the init script hangs on `window` so a test can drive the fake recogniser. */
type SpeechProbe = {
  constructed: number;
  started: number;
  aborted: number;
};

declare global {
  interface Window {
    __speech?: SpeechProbe;
    __speechSay?: (text: string, isFinal: boolean) => boolean;
    __speechEnd?: () => boolean;
    __speechError?: (code: string) => boolean;
  }
}

/**
 * Install a fake `SpeechRecognition` (and a fake `getUserMedia`) before the page loads.
 *
 * `denyMicrophone` makes the permission request reject with a `NotAllowedError`, which is
 * what a browser produces when the visitor presses "Block".
 */
async function installFakeSpeech(
  page: Page,
  { denyMicrophone = false }: { denyMicrophone?: boolean } = {},
): Promise<void> {
  await page.addInitScript((deny: boolean) => {
    const probe = { constructed: 0, started: 0, aborted: 0 };
    let current: Record<string, ((event?: unknown) => void) | null> | null = null;

    function Fake(this: Record<string, unknown>) {
      probe.constructed += 1;
      this.lang = "";
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 1;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      current = this as never;
    }
    Fake.prototype.start = function start() {
      probe.started += 1;
    };
    Fake.prototype.stop = function stop(this: { onend?: (() => void) | null }) {
      this.onend?.();
    };
    Fake.prototype.abort = function abort() {
      probe.aborted += 1;
    };

    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = Fake;
    w.webkitSpeechRecognition = Fake;
    w.__speech = probe;

    /** Emit one recognition result, shaped like the real event the component reads. */
    w.__speechSay = (text: string, isFinal: boolean) => {
      const handler = current?.onresult;
      if (!handler) return false;
      const alternative = { transcript: text };
      const result = Object.assign([alternative], { isFinal });
      handler({ resultIndex: 0, results: [result] });
      return true;
    };
    /** Recognition finished on its own — what ends the listening state. */
    w.__speechEnd = () => {
      const handler = current?.onend;
      if (!handler) return false;
      handler();
      return true;
    };
    /** Fail with an error code (`"no-speech"`, `"not-allowed"`, …). */
    w.__speechError = (code: string) => {
      const handler = current?.onerror;
      if (!handler) return false;
      handler({ error: code });
      return true;
    };

    /* The permission gate. The component only wants a yes/no out of it and stops every
       track immediately, so an object with an empty track list is a complete stand-in —
       and no real microphone is ever opened. */
    const mediaDevices = {
      getUserMedia: () =>
        deny
          ? Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
          : Promise.resolve({ getTracks: () => [] }),
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      get: () => mediaDevices,
    });
  }, denyMicrophone);
}

/**
 * Take speech recognition away from the browser, the way a Firefox or an older Safari would
 * have it — `getSpeechRecognitionCtor()` then returns `null` and the component renders
 * nothing.
 */
async function removeSpeechRecognition(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
    // Belt and braces: the getters are configurable, but if a build ever makes them
    // non-configurable, shadow them with `undefined` so the read still says "absent".
    if ("SpeechRecognition" in w || "webkitSpeechRecognition" in w) {
      Object.defineProperty(w, "SpeechRecognition", {
        configurable: true,
        get: () => undefined,
      });
      Object.defineProperty(w, "webkitSpeechRecognition", {
        configurable: true,
        get: () => undefined,
      });
    }
  });
}

/** The recogniser's tally: how many were built, how many were started. */
const speechProbe = (page: Page): Promise<SpeechProbe> =>
  page.evaluate(() => window.__speech ?? { constructed: 0, started: 0, aborted: 0 });

/** The dictation control that belongs to the chat composer. */
const chatDictation = (page: Page): Locator =>
  dictationSlot(page, "estimator-chat").getByRole("button").first();

/** Its live-region line — "Ascult…", the denial notice, whatever state it is in. */
const chatDictationStatus = (page: Page): Locator =>
  dictationSlot(page, "estimator-chat").getByRole("status");

test.describe("dictation", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await seedConsent(context, baseURL!);
    await stubContactApi(page);
  });

  test("without SpeechRecognition the button is not rendered at all @smoke", async ({
    page,
  }) => {
    await removeSpeechRecognition(page);
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);
    await expect(chatInput(estimator)).toBeVisible();

    // The component is `next/dynamic`-loaded, so give its chunk time to arrive and decide.
    await page.waitForLoadState("networkidle");

    // The premise of this test: the API really is gone from this page.
    expect(
      await page.evaluate(
        () =>
          !!(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
          !!(window as unknown as { webkitSpeechRecognition?: unknown })
            .webkitSpeechRecognition,
      ),
      "the init script should have removed speech recognition",
    ).toBe(false);

    // Both mount points stay empty — no button, no tooltip apology, no dead control.
    await expect(dictationSlot(page, "estimator-chat")).toBeEmpty();
    await expect(dictationSlot(page, "estimator-details")).toBeEmpty();
    await expect(
      page.getByRole("button", { name: PRIVATE_COPY.dictateStartAria }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: PRIVATE_COPY.dictateStopAria }),
    ).toHaveCount(0);
  });

  test("with a recogniser available the button appears — and starts nothing on its own", async ({
    page,
  }) => {
    await installFakeSpeech(page);
    await gotoHydrated(page, "/");

    const button = chatDictation(page);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", PRIVATE_COPY.dictateStartAria);
    await expect(button).toHaveAttribute("aria-pressed", "false");

    // Rendering the control must not construct a recogniser or open a microphone.
    const probe = await speechProbe(page);
    expect(probe.constructed, "no recogniser may be built before a click").toBe(0);
    expect(probe.started, "nothing may start listening before a click").toBe(0);
  });

  test("a click starts listening and says so", async ({ page }) => {
    await installFakeSpeech(page);
    await gotoHydrated(page, "/");

    await chatDictation(page).click();

    await expect(chatDictation(page)).toHaveAttribute("aria-pressed", "true");
    await expect(chatDictation(page)).toHaveAttribute(
      "aria-label",
      PRIVATE_COPY.dictateStopAria,
    );
    await expect(chatDictationStatus(page)).toContainText(PRIVATE_COPY.dictateListening);

    await expect
      .poll(async () => (await speechProbe(page)).started)
      .toBe(1);
    expect((await speechProbe(page)).constructed).toBe(1);
  });

  test("recognised text lands in an editable box and reaches the field only after confirmation", async ({
    page,
  }) => {
    await installFakeSpeech(page);
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);
    const target = chatInput(estimator);

    await chatDictation(page).click();
    await expect(chatDictationStatus(page)).toContainText(PRIVATE_COPY.dictateListening);

    // The recogniser hears something, then stops on its own.
    expect(await page.evaluate(() => window.__speechSay?.("vrem un magazin online", true))).toBe(
      true,
    );
    expect(await page.evaluate(() => window.__speechEnd?.())).toBe(true);

    // It goes to a review box, not into the form.
    const draft = dictationSlot(page, "estimator-chat").getByLabel(
      PRIVATE_COPY.dictateDraftLabel,
    );
    await expect(draft).toBeVisible();
    await expect(draft).toHaveValue("vrem un magazin online");
    await expect(target, "nothing may reach the field before confirmation").toHaveValue("");

    // The box is editable — recognition is approximate and the visitor owns the correction.
    await draft.fill("vrem un magazin online cu plăți prin card");
    await expect(target, "editing the draft still must not touch the field").toHaveValue("");

    // Only "add to the field" hands the text over, and it hands over the EDITED text.
    await dictationSlot(page, "estimator-chat")
      .getByRole("button", { name: PRIVATE_COPY.dictateAdd, exact: true })
      .click();

    await expect(target).toHaveValue("vrem un magazin online cu plăți prin card");
    await expect(draft, "the review box closes once the text is handed over").toHaveCount(0);
  });

  test("a refused microphone explains itself and leaves the button usable", async ({
    page,
  }) => {
    await installFakeSpeech(page, { denyMicrophone: true });
    await gotoHydrated(page, "/");
    const estimator = estimatorSection(page);

    await chatDictation(page).click();

    // A refusal is a state, not a breakage: it is said in words…
    await expect(chatDictationStatus(page)).toContainText(PRIVATE_COPY.dictateDenied);
    // …no recogniser was ever constructed (the permission gate is before it)…
    expect((await speechProbe(page)).constructed).toBe(0);
    // …the control is still there and still pressable…
    await expect(chatDictation(page)).toBeEnabled();
    await expect(chatDictation(page)).toHaveAttribute("aria-pressed", "false");
    // …and the field it dictates into was never taken away.
    await chatInput(estimator).fill("scriu manual, atunci");
    await expect(chatInput(estimator)).toHaveValue("scriu manual, atunci");

    // Pressing again re-asks rather than staying stuck on the error.
    await chatDictation(page).click();
    await expect(chatDictationStatus(page)).toContainText(PRIVATE_COPY.dictateDenied);
  });
});
