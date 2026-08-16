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
