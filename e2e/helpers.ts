import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_PREFIX,
  type Locale,
} from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { THEME_COOKIE, type Theme } from "@/lib/theme/theme";
import { DIRECTIONS_BASE, directions } from "@/lib/directions";
import { solUI } from "@/lib/solutions";
import { CONSENT_KEY } from "@/lib/consent";
import { SOUND_COOKIE } from "@/lib/sound/sound";

/*
 * Shared vocabulary for the E2E specs.
 *
 * Everything that also exists in the app (cookie names, locale prefixes, direction slugs,
 * the aria-labels the controls carry) is IMPORTED from `lib/` rather than re-typed here, so
 * a rename in the app breaks the tests at compile time instead of silently making them
 * assert on something that no longer exists. `@/` resolves through the root tsconfig
 * `paths`, which Playwright honours.
 */

/** The locale-independent paths the public site serves today. */
export const PUBLIC_PATHS = [
  "/",
  ...directions.map((d) => `${DIRECTIONS_BASE}/${d.slug}`),
] as const;

/** Every viewport the responsive spec checks. 1280 is the desktop reference. */
export const VIEWPORTS = [
  { name: "320 (smallest phone)", width: 320, height: 720 },
  { name: "375 (iPhone SE/8)", width: 375, height: 780 },
  { name: "390 (iPhone 12/13/14)", width: 390, height: 844 },
  { name: "768 (tablet portrait)", width: 768, height: 1024 },
  { name: "1280 (desktop)", width: 1280, height: 800 },
] as const;

/** Below this width the header shows the burger; the CSS breakpoint is 860px. */
export const MOBILE_BREAKPOINT = 860;

/** WCAG 2.5.5 (AAA) / 2.5.8 target size, and what the header CSS itself aims for. */
export const MIN_TAP_TARGET = 44;

/** Build the crawlable URL for a locale-independent path: `/` + `ru` -> `/ru`. */
export function localePath(locale: Locale, path: string): string {
  const prefix = LOCALE_PREFIX[locale];
  const suffix = path === "/" ? "" : path;
  return `${prefix}${suffix}` || "/";
}

// --- cookies ---------------------------------------------------------------------------

/**
 * Seed a site cookie BEFORE the first navigation, which is the only way to exercise the
 * server-rendered half of the theme/language model: the root layout reads these cookies and
 * stamps `<html lang>` / `<html data-theme>` into the very first byte it sends.
 */
export async function seedCookie(
  context: BrowserContext,
  name: string,
  value: string,
  baseURL: string,
): Promise<void> {
  await context.addCookies([{ name, value, url: baseURL }]);
}

export const seedTheme = (context: BrowserContext, theme: Theme, baseURL: string) =>
  seedCookie(context, THEME_COOKIE, theme, baseURL);

export const seedLocale = (context: BrowserContext, locale: Locale, baseURL: string) =>
  seedCookie(context, LOCALE_COOKIE, locale, baseURL);

/**
 * Answer the cookie banner before the page is even loaded.
 *
 * `components/ui/CookieConsent.tsx` is a fixed, bottom-anchored `role="dialog"`. It is a
 * legitimate part of a first visit, but it sits on top of the page's own controls — a test
 * about the request dialog or the sound toggle would otherwise be measuring the banner's
 * z-index. `"rejected"` is the choice that changes nothing else on the site (no analytics
 * pixel), which is exactly what a test wants.
 */
export const seedConsent = (
  context: BrowserContext,
  baseURL: string,
  value: "accepted" | "rejected" = "rejected",
) => seedCookie(context, CONSENT_KEY, value, baseURL);

/** Read one cookie's value out of the browser context (`undefined` when unset). */
export async function cookieValue(
  context: BrowserContext,
  name: string,
): Promise<string | undefined> {
  const all = await context.cookies();
  return all.find((c) => c.name === name)?.value;
}

// --- navigation ------------------------------------------------------------------------

/**
 * Navigate and wait until React has actually hydrated the markup.
 *
 * Without this every interaction test is a race: `page.goto()` resolves on `load`, and a
 * click dispatched between `load` and hydration hits a button whose React handler is not
 * attached yet. The event is swallowed, the test sees "nothing happened", and it fails
 * intermittently on a fast machine and reliably on a slow one.
 *
 * The signal is react-dom's own: on hydration it stamps a `__reactFiber$…` property onto
 * each host element. It is an internal name, but a stable one across React 18/19 and the
 * only honest "the page is interactive now" marker the App Router exposes.
 */
export async function gotoHydrated(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(
    () => {
      const el = document.querySelector("header");
      return !!el && Object.keys(el).some((key) => key.startsWith("__reactFiber$"));
    },
    undefined,
    { timeout: 20_000 },
  );
}

// --- locators --------------------------------------------------------------------------

/** The site header. `.first()` guards against a future second landmark on the page. */
export const header = (page: Page): Locator => page.locator("header").first();

/** The RO / RU / EN segmented control, by the group label the component declares. */
export const languageGroup = (page: Page): Locator =>
  header(page).getByRole("group", { name: "Limbă / Язык / Language" });

/** One language option. The accessible name is the language's own name ("Русский"). */
export const languageOption = (page: Page, locale: Locale): Locator =>
  languageGroup(page).getByRole("button", { name: LOCALE_LABELS[locale], exact: true });

/**
 * The light/dark switch. Its accessible name comes from the message catalog and therefore
 * changes with the language, so the current locale has to be passed in.
 */
export const themeToggle = (page: Page, locale: Locale = "ro"): Locator =>
  header(page).getByRole("button", {
    name: messages[locale]["theme.toggleAria"],
    exact: true,
  });

/** The hamburger. Only rendered/visible below the 860px breakpoint. */
export const burger = (page: Page, locale: Locale = "ro"): Locator =>
  header(page).getByRole("button", { name: messages[locale]["nav.burgerAria"], exact: true });

/** The contact/estimate section on the home page. */
export const estimatorSection = (page: Page): Locator => page.locator("#estimare");

/**
 * Copy that lives in a component's private `COPY` object.
 *
 * Everything the app *exports* is imported at the top of this file, so a rename breaks the
 * suite at compile time. These four components keep their `{ro,ru,en}` strings module-local
 * (`Modal.tsx`, `Estimator.tsx`, `DictationButton.tsx`, `SoundToggle.tsx`), so there is
 * nothing to import — the Romanian variants are repeated here, in ONE place, rather than
 * scattered across the specs. The suite pins `locale: "ro-RO"` and seeds no `tbs_locale`
 * cookie, so Romanian is what renders.
 *
 * If one of these strings ever changes, the spec that uses it fails loudly with "locator
 * resolved to 0 elements" — which is the correct outcome for copy the tests assert on.
 */
export const PRIVATE_COPY = {
  /** `components/ui/Modal.tsx` → `COPY.close` (the ✕ button's aria-label). */
  modalClose: "Închide",
  /** `components/sections/RequestModal.tsx` → `COPY.title` (the dialog's accessible name). */
  modalTitle: "Spune-ne ce vrei să construiești.",
  /** `components/sections/Estimator.tsx` → `SECTION.submit` (the real contact submit). */
  estimatorSubmit: "Trimite cererea",
  /** `Estimator.tsx` → `CHAT.send` / `CHAT.inputLabel` (the free-text composer). */
  chatSend: "Trimite răspunsul",
  chatInputLabel: "Scrie asistentului",
  /** `Estimator.tsx` → `SUMMARY.title`, shown once the dialog reaches `finish`. */
  summaryTitle: "Rezumatul cererii",
  /** `Estimator.tsx` → the shared opening of every `CLARIFY_Q` variant. */
  clarifyPrefix: "Ca să înțeleg mai bine",
  /** `components/ui/DictationButton.tsx` → `COPY.startAria` / `COPY.stopAria`. */
  dictateStartAria: "Dictează textul cu vocea",
  dictateStopAria: "Oprește dictarea",
  /** `DictationButton.tsx` → `COPY.listening` / `COPY.draftLabel` / `COPY.add` / `COPY.denied`. */
  dictateListening: "Ascult…",
  dictateDraftLabel: "Textul recunoscut — verifică-l înainte de a-l adăuga",
  dictateAdd: "Adaugă în câmp",
  dictateDiscard: "Renunță",
  dictateDenied: "Accesul la microfon a fost refuzat.",
  /** `components/ui/SoundToggle.tsx` → `COPY.aria`. */
  soundAria: "Sunet interfață",
} as const;

// --- the request modal -------------------------------------------------------------------

/**
 * The CTA on a service page that opens the request flow in a dialog
 * (`components/sections/DirectionPage.tsx` → the action bar's `RequestModal`).
 * Its label is `solUI.actionTalk`, which IS exported, so it is imported rather than typed.
 */
export const requestModalCta = (page: Page): Locator =>
  page.getByRole("button", { name: solUI.actionTalk.ro, exact: true });

/**
 * The dialog itself.
 *
 * `[aria-modal="true"]` and not a bare `getByRole("dialog")`: the cookie-consent banner is
 * also a `role="dialog"` (a non-modal one), so the plain role locator is ambiguous on a
 * first visit. Only `Modal` claims to be modal.
 */
export const modalDialog = (page: Page): Locator =>
  page.locator('[role="dialog"][aria-modal="true"]');

/** The scrim behind the panel — the element a "click outside" has to land on. */
export const modalOverlay = (page: Page): Locator =>
  page.locator('[data-testid="modal-overlay"]');

/** The ✕ in the dialog's header. */
export const modalCloseButton = (page: Page): Locator =>
  modalDialog(page).getByRole("button", { name: PRIVATE_COPY.modalClose, exact: true });

/** Open the request dialog from a service page's action-bar CTA and wait for it. */
export async function openRequestModal(page: Page): Promise<Locator> {
  await requestModalCta(page).click();
  const dialog = modalDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Is `document.activeElement` inside the open dialog right now? */
export async function focusIsInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const active = document.activeElement;
    return !!dialog && !!active && (dialog === active || dialog.contains(active));
  });
}

// --- the estimator's chat ----------------------------------------------------------------

/**
 * The assistant's free-text composer. Scoped to `root` because the SAME estimator is
 * rendered inside the request dialog on a service page — an unscoped `#estimator-chat-input`
 * would be ambiguous the moment a modal is open.
 */
export const chatInput = (root: Locator): Locator => root.locator("#estimator-chat-input");

/** The composer's send button. */
export const chatSendButton = (root: Locator): Locator =>
  root.getByRole("button", { name: PRIVATE_COPY.chatSend, exact: true });

/** Every bubble in the transcript, assistant and visitor alike, in order. */
export const chatBubbles = (root: Locator): Locator =>
  root.locator('[class*="chatLog"] > [class*="bubble"]');

/**
 * One quick reply in the chat. `button[class*="chatOption"]` and not just the class: the
 * container that holds them is `chatOptions`, which the same substring would also match.
 * CSS-module names keep their readable half in production
 * (`Estimator-module__AdFMOa__chatOption`), so this is stable.
 */
export const chatQuickReplies = (root: Locator): Locator =>
  root.locator('button[class*="chatOption"]');

/** The structured summary the estimator renders once the dialog reaches its end. */
export const estimatorSummary = (root: Locator): Locator =>
  root.locator('[data-testid="estimator-summary"]');

/** Type an answer into the composer and send it. */
export async function sendChatMessage(root: Locator, text: string): Promise<void> {
  await chatInput(root).fill(text);
  await chatSendButton(root).click();
}

/**
 * Walk the question tree to the end by always taking the first quick reply, and stop as
 * soon as the summary appears. The tree's exact shape is the app's business — the spec only
 * cares that a finite number of answers reaches the end.
 */
export async function walkChatToEnd(root: Locator, maxSteps = 12): Promise<number> {
  const summary = estimatorSummary(root);
  for (let step = 1; step <= maxSteps; step += 1) {
    if (await summary.isVisible()) return step - 1;
    const reply = chatQuickReplies(root).first();
    if (!(await reply.isVisible())) break;
    await reply.click();
  }
  await expect(summary, `the dialog did not finish within ${maxSteps} answers`).toBeVisible();
  return maxSteps;
}

// --- dictation ---------------------------------------------------------------------------

/**
 * The two mount points `Estimator.tsx` renders for a dictation button. They stay EMPTY in a
 * browser without speech recognition — which is exactly what one of the specs asserts.
 */
export const dictationSlot = (page: Page, name: "estimator-chat" | "estimator-details") =>
  page.locator(`[data-dictation-slot="${name}"]`);

/** The dictation button itself, when the browser has an API for it to drive. */
export const dictationButton = (root: Locator | Page): Locator =>
  root.getByRole("button", { name: PRIVATE_COPY.dictateStartAria, exact: true });

// --- sound -------------------------------------------------------------------------------

/** The interface-sound switch, in the header's preferences group. */
export const soundToggle = (page: Page): Locator =>
  header(page).getByRole("button", { name: PRIVATE_COPY.soundAria, exact: true });

/**
 * Arrive with sound already turned on, the way a returning visitor does. Only the literal
 * `on` counts (`lib/sound/sound.ts` → `readSoundChoice`), and "off" is stored as *no*
 * cookie, so this is the only value worth seeding.
 */
export const seedSoundOn = (context: BrowserContext, baseURL: string) =>
  seedCookie(context, SOUND_COOKIE, "on", baseURL);

/** The `tbs_sound` cookie's current value — `undefined` once the choice is "off". */
export const soundCookie = (context: BrowserContext) => cookieValue(context, SOUND_COOKIE);

/**
 * Count every `AudioContext` the page constructs, from before the first byte of app code
 * runs. `lib/sound/player.ts` promises the context is built lazily, at the first tone that
 * is really going to play — the only way to prove that from outside is to watch the
 * constructor itself. Read the tally with `audioContextCount(page)`.
 */
export async function countAudioContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __tbsAudio?: { count: number };
      AudioContext?: unknown;
      webkitAudioContext?: unknown;
    };
    w.__tbsAudio = { count: 0 };
    const Real = w.AudioContext as (new (...args: unknown[]) => unknown) | undefined;
    if (!Real) return;
    // A function, not a class: it has to be `new`-able and still return a REAL context, so
    // the app under test keeps working exactly as it would without the probe.
    function Counting(this: unknown, ...args: unknown[]) {
      w.__tbsAudio!.count += 1;
      return new Real!(...args);
    }
    Counting.prototype = Real.prototype;
    w.AudioContext = Counting;
    w.webkitAudioContext = Counting;
  });
}

/** How many `AudioContext`s have been constructed since the page loaded. */
export const audioContextCount = (page: Page): Promise<number> =>
  page.evaluate(
    () => (window as unknown as { __tbsAudio?: { count: number } }).__tbsAudio?.count ?? 0,
  );

/**
 * The contact form inside that section. The section contains more than one `<form>` (the
 * assistant's message composer is another), so it is identified by the one field only the
 * contact form has: the email input.
 */
export const estimatorForm = (page: Page): Locator =>
  estimatorSection(page)
    .locator("form")
    .filter({ has: page.locator('input[type="email"]') });

// --- assertions ------------------------------------------------------------------------

/**
 * The whole point of the responsive pass: nothing may push the document wider than the
 * viewport. Measured on `documentElement`, which is what actually scrolls.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { scrollWidth, innerWidth, widest } = await page.evaluate(() => {
    const doc = document.documentElement;
    // Name the widest offending element so a failure says WHAT overflows, not just that
    // something does.
    let widest = "";
    let widestRight = doc.clientWidth;
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right > widestRight + 1) {
        widestRight = rect.right;
        widest = `${el.tagName.toLowerCase()}.${el.className || "(no class)"}`;
      }
    }
    return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, widest };
  });

  expect(
    scrollWidth,
    `document is ${scrollWidth}px wide in a ${innerWidth}px viewport` +
      (widest ? ` — widest overflowing element: ${widest}` : ""),
  ).toBeLessThanOrEqual(innerWidth);
}

/** Assert an element is fully inside the viewport horizontally and at least `min` px tall. */
export async function expectTappable(
  locator: Locator,
  label: string,
  min = MIN_TAP_TARGET,
): Promise<void> {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a layout box`).not.toBeNull();
  expect(Math.round(box!.height), `${label} height`).toBeGreaterThanOrEqual(min);
  expect(Math.round(box!.width), `${label} width`).toBeGreaterThanOrEqual(min);
}

// --- network stubs ---------------------------------------------------------------------

export type StubbedCall = { url: string; method: string; body: unknown };

/**
 * Intercept `POST /api/contact` so a test can submit the real form without a real lead ever
 * leaving the browser. Returns the array the handler appends to, so a spec can assert both
 * "the payload was X" and — just as important — "no request was made at all".
 *
 * The glob is host-agnostic (`**\/api/contact`) so it keeps working if `NEXT_PUBLIC_API_URL`
 * ever points the form at a separate origin again.
 */
export async function stubContactApi(page: Page): Promise<StubbedCall[]> {
  const calls: StubbedCall[] = [];
  await page.route("**/api/contact", async (route) => {
    const request = route.request();
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({ url: request.url(), method: request.method(), body });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  return calls;
}

/**
 * Fail the test if ANY request reaches `/api/contact`. Used by the validation spec, where
 * the correct behaviour is that the form never gets as far as the network.
 */
export async function forbidContactApi(page: Page): Promise<() => void> {
  const hits: string[] = [];
  await page.route("**/api/contact", async (route) => {
    hits.push(route.request().url());
    await route.abort();
  });
  return () => expect(hits, "the form must not call /api/contact").toEqual([]);
}
