import {
  expect,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  LOCALE_COOKIE,
  LOCALE_LABELS,
  LOCALE_PREFIX,
  type Locale,
} from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";
import { DIRECTIONS_BASE, directions } from "@/lib/directions";
import { solUI } from "@/lib/solutions";
import { CONSENT_KEY } from "@/lib/consent";
import { HUD_FLAG_KEY } from "@/lib/hud/gate";
import {
  GPU_PROBE_CACHE_KEY,
  SCENE_3D_KEY,
  SCENE_TESTID,
  type GpuProbeCache,
} from "@/lib/scene";

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
 * server-rendered half of the language model: the root layout reads these cookies and
 * stamps `<html lang>` into the very first byte it sends.
 */
export async function seedCookie(
  context: BrowserContext,
  name: string,
  value: string,
  baseURL: string,
): Promise<void> {
  await context.addCookies([{ name, value, url: baseURL }]);
}

export const seedLocale = (context: BrowserContext, locale: Locale, baseURL: string) =>
  seedCookie(context, LOCALE_COOKIE, locale, baseURL);

/**
 * Answer the cookie banner before the page is even loaded.
 *
 * `components/ui/CookieConsent.tsx` is a fixed, bottom-anchored `role="dialog"`. It is a
 * legitimate part of a first visit, but it sits on top of the page's own controls — a test
 * about the request dialog would otherwise be measuring the banner's
 * z-index. `"rejected"` is the choice that changes nothing else on the site (no analytics
 * pixel), which is exactly what a test wants.
 */
export const seedConsent = (
  context: BrowserContext,
  baseURL: string,
  value: "accepted" | "rejected" = "rejected",
) => seedCookie(context, CONSENT_KEY, value, baseURL);

// --- HUD chrome ------------------------------------------------------------------------

/** A context's storage in the object form `use.storageState` / `browser.newContext` take. */
export type StorageState = Exclude<BrowserContextOptions["storageState"], string | undefined>;

/**
 * Every context starts with the HUD switched off (`localStorage.tbs_hud = "off"`, seeded by
 * playwright.config.ts), so no guide, rail or dock can appear in the middle of a spec. A spec
 * about the HUD starts from empty storage instead: `test.use({ storageState: HUD_ON })`.
 */
export const HUD_ON: StorageState = { cookies: [], origins: [] };

/**
 * Arm the HUD chrome the way a visitor does — pointer moves — and wait until one of its parts
 * (`[data-hud]`) is in the DOM. The HUD also needs an answered cookie banner
 * (`seedConsent`).
 */
export async function armHud(page: Page): Promise<void> {
  const flag = await page.evaluate((key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, HUD_FLAG_KEY);
  expect(flag, "the HUD is switched off in this context: test.use({ storageState: HUD_ON })").not.toBe("off");
  // `gotoHydrated` waits for the HEADER's hydration; HudChrome sits after the footer and attaches
  // its listeners in an effect, which can run a moment later. A single move made in that gap is
  // never heard (1 in ~60 lab arms, P4-C), so the pointer moves again every 250ms — a visitor's
  // pointer does the same — until a part is attached or 5s have passed.
  const hud = page.locator("[data-hud]").first();
  const deadline = Date.now() + 5_000;
  for (let step = 0; ; step += 1) {
    await page.mouse.move(8 + (step % 2) * 4, 8);
    if ((await hud.count()) > 0 || Date.now() >= deadline) break;
    await page.waitForTimeout(250);
  }
  await expect(hud).toBeAttached({ timeout: 1_000 });
}

/**
 * The Asistent TBS assistant (components/hud/guide/GuideAssistant.tsx): her root box in the
 * bottom-right corner (`[data-hud][data-guide]`, carrying `data-away`, `data-yield` and
 * `data-say`) and the avatar button that opens her questions. `data-state` went with her
 * entrance on 2026-09-26 — she has no states to be in any more, and her box is the same from
 * the first frame. Addressed by the hooks the
 * component declares, never by copy or
 * CSS-module class names; its copy is `GUIDE_COPY` (components/hud/guide/copy.ts), which a spec
 * imports.
 */
export const guideRoot = (page: Page): Locator => page.locator("[data-hud][data-guide]");

export const guideAvatar = (page: Page): Locator => guideRoot(page).locator('[data-testid="guide-avatar"]');


/**
 * The fibre-optic scroll rail (components/hud/rail/ScrollRail.tsx), a desktop-only HUD part
 * (≥861px): its root on the right edge (`[data-hud][data-rail]`), and the real `<nav>` of
 * section buttons on it (absent when a page has no sections, or more than eight). The decorative
 * fibre is the root's `aria-hidden` child, and it carries `--rail-p`. The nav's name and the home
 * labels are the rail's copy (components/hud/rail/copy.ts), which a spec imports.
 */
export const railRoot = (page: Page): Locator => page.locator("[data-hud][data-rail]");

export const railNav = (page: Page): Locator => railRoot(page).locator("nav");

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
 *
 * A visitor arrives with the GPU probe already answered for the session (`seedGpuProbe`, on by
 * default): Work's stage then settles on the flat card grid without creating a throwaway
 * SwiftShader context when Work comes near. A spec that is about the probe passes
 * `{ seedGpuProbe: false }`; one that seeds its own answer first keeps it.
 */
export async function gotoHydrated(
  page: Page,
  url: string,
  { seedGpuProbe: seedProbe = true }: { seedGpuProbe?: boolean } = {},
): Promise<void> {
  if (seedProbe) await seedGpuProbe(page, SOFTWARE_GPU_PROBE);
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

/** The hamburger. Only rendered/visible below the 860px breakpoint. */
export const burger = (page: Page, locale: Locale = "ro"): Locator =>
  header(page).getByRole("button", { name: messages[locale]["nav.burgerAria"], exact: true });

/** The contact/estimate section on the home page. */
export const estimatorSection = (page: Page): Locator => page.locator("#estimare");

/**
 * Copy that lives in a component's private `COPY` object.
 *
 * Everything the app *exports* is imported at the top of this file, so a rename breaks the
 * suite at compile time. These three components keep their `{ro,ru,en}` strings module-local
 * (`Modal.tsx`, `Estimator.tsx`, `DictationButton.tsx`), so there is
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
  /** `lib/request/RequestFlowProvider.tsx` → `COPY.title` (the dialog's accessible name). */
  modalTitle: "Spune ce vrei să testezi. Stabilim primul pas.",
  /** `components/sections/Estimator.tsx` → `SECTION.submit` (the real contact submit). */
  estimatorSubmit: "Trimite cererea",
  /** `lib/request/catalog.ts` → `PROJECT_TYPES[0].label`, the first project chip. */
  estimatorFirstType: "Site / prezentare",
  /** `Estimator.tsx` → `CHAT.send` / `CHAT.inputLabel` (the free-text composer). */
  chatSend: "Trimite răspunsul",
  chatInputLabel: "Scrie asistentului",
  /** `Estimator.tsx` → `SUMMARY.title`, shown once the dialog reaches `finish`. */
  /* Two different strings, deliberately: the heading rendered on SCREEN, and the one the
     message carries. buildMessage() shouts its section headers, the UI does not. */
  summaryTitle: "Rezumatul cererii",
  summaryPayloadTitle: "REZUMATUL CERERII",
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

// --- the request flow ------------------------------------------------------------------------

/*
 * ONE ARRANGEMENT, IN TWO PLACES: the home page's `#estimare` and the request dialog render the
 * same deck — both bays, everything on screen at once (2026-09-26).
 *
 * It used to be two. The dialog ran the flow as three steps on one column, with the assistant
 * behind a toggle, and this file carried the layer that walked them: `requestSteps`,
 * `currentStepItem`, `expectActiveStep`, `clickStepNav`, `clickStepIndicator`, `goToStep`,
 * `goBackOneStep`, `chatToggle`, `openChat`, and a CONTRACT-GAP note about the next/back hook
 * nobody had named. All of it went with the wizard. A spec that wants the contact fields no
 * longer walks anywhere — they are on screen from the first frame, so `fillContactStep` is the
 * whole journey.
 *
 * Everything below still addresses the flow through the contract its markup declares
 * (`data-testid` / `data-step`), never through copy or CSS-module class names: the copy is
 * trilingual and the styles move.
 */

/** The flow's root. `data-layout` says whether it is the dialog or the home-page section. */
export const requestFlow = (root: Page | Locator): Locator =>
  root.locator('[data-testid="request-flow"]');

/** The three regions of the deck, in the order they are read. */
export const REQUEST_STEPS = ["project", "options", "contact"] as const;
export type RequestStep = (typeof REQUEST_STEPS)[number];

/**
 * The deck's three regions. All three are on screen, and all three carry `data-active="true"`
 * — the attribute survives as "this region is live", which is the only value it ever takes now.
 *
 * The `:not([data-testid="request-steps"] *)` guard these two used to carry was there because
 * the wizard's indicator keyed its own items by `data-step` as well. There is no indicator.
 */
export const stepPanels = (flow: Locator): Locator => flow.locator("[data-step]");

/** One region of the deck. */
export const stepPanel = (flow: Locator, step: RequestStep): Locator =>
  flow.locator(`[data-step="${step}"]`);

/** The assistant's panel inside the DIALOG. The page's own assistant is part of the section. */
export const chatPanel = (flow: Locator): Locator =>
  flow.locator('[data-testid="chat-panel"]');

/** The contact fields, located by shape rather than by their trilingual placeholder copy. */
export const flowFields = (flow: Locator) => ({
  /* The name input is the only one in the form with no explicit `type`. */
  name: flow.locator('input:not([type]), input[type="text"]').first(),
  email: flow.locator('input[type="email"]'),
  phone: flow.locator('input[type="tel"]'),
  submit: flow.getByRole("button", { name: PRIVATE_COPY.estimatorSubmit, exact: true }),
});

/** Fill the contact step with a plausible lead. The request is stubbed; nothing is sent. */
export async function fillContactStep(
  flow: Locator,
  lead: { name: string; email: string; phone?: string },
): Promise<void> {
  const f = flowFields(flow);
  await f.name.fill(lead.name);
  await f.email.fill(lead.email);
  if (lead.phone) await f.phone.fill(lead.phone);
}

// --- the estimator's chat ----------------------------------------------------------------

/**
 * The assistant's free-text composer.
 *
 * Found by `data-dictation-target`, not by its id. The id is `estimator-chat-input` on the
 * page and `estimator-chat-input-dialog` in the modal (2026-09-26): one document can hold both
 * composers at once now that the dialog's assistant is always rendered, and two elements with
 * one id is invalid HTML that a label, a `for=` and the dictation button all resolve wrongly.
 * Still scoped to `root`, for the same reason — there can be two.
 */
export const chatInput = (root: Locator): Locator =>
  root.locator('[data-dictation-target="estimator-chat"]');

/** The composer's send button. */
export const chatSendButton = (root: Locator): Locator =>
  root.getByRole("button", { name: PRIVATE_COPY.chatSend, exact: true });

/** Every bubble in the transcript, assistant and visitor alike, in order — the thread inside the
    conversation's scrolling window (`chatLog`), which since 2026-10-07 also holds the summary. */
export const chatBubbles = (root: Locator): Locator =>
  root.locator('[class*="chatThread"] > [class*="bubble"]');

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
/* Takes a root, not only the page: since the dialog's assistant is always rendered (2026-09-26)
   an open dialog over the home page puts TWO of each slot in the document, and
   `data-dictation-slot` is a name rather than an id. Pass `estimatorSection(page)` or the dialog
   when both can be on screen. */
export const dictationSlot = (
  page: Page | Locator,
  name: "estimator-chat" | "estimator-details",
) =>
  page.locator(`[data-dictation-slot="${name}"]`);

/** The dictation button itself, when the browser has an API for it to drive. */
export const dictationButton = (root: Locator | Page): Locator =>
  root.getByRole("button", { name: PRIVATE_COPY.dictateStartAria, exact: true });

/**
 * The contact form inside that section. The section contains more than one `<form>` (the
 * assistant's message composer is another), so it is identified by the one field only the
 * contact form has: the email input.
 */
export const estimatorForm = (page: Page): Locator =>
  estimatorSection(page)
    .locator("form")
    .filter({ has: page.locator('input[type="email"]') });

// --- cookie banner, page probes -------------------------------------------------------

/**
 * The cookie banner. `aria-modal="false"` is what tells it apart from the request dialog —
 * the mirror image of `modalDialog`.
 */
export const cookieBanner = (page: Page): Locator =>
  page.locator('[role="dialog"][aria-modal="false"]');

/**
 * Collect Content-Security-Policy violations as `"<directive> <blocked URI>"`. The page
 * must not need a CSP change: no CDN assets, workers, wasm or eval. Read with `cspViolations`.
 */
export async function watchCsp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp?: string[] };
    const violations: string[] = [];
    w.__csp = violations;
    document.addEventListener(
      "securitypolicyviolation",
      (event) => violations.push(`${event.violatedDirective} ${event.blockedURI}`),
      true,
    );
  });
}

export const cspViolations = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

/*
 * The three `getContext` probes below replace `HTMLCanvasElement.prototype.getContext`
 * before any app code runs, and always hand back what the real method returns for
 * everything that isn't WebGL, so 2D canvases elsewhere keep working.
 */
type GetContextArgs = [contextId: string, options?: unknown];
type AnyGetContext = (this: HTMLCanvasElement, ...args: GetContextArgs) => unknown;

/**
 * Count the distinct WebGL contexts the page creates. Only Work's stage may create one, and only
 * once Work comes near the viewport (2026-10-28). Read with `webglContextCount`.
 */
export async function countWebGLContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __webgl?: { count: number } };
    const tally = { count: 0 };
    w.__webgl = tally;
    const seen = new WeakSet<object>();
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: AnyGetContext };
    const real = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, ...args: GetContextArgs) {
      const context = real.apply(this, args);
      if (context && typeof context === "object" && /webgl/i.test(args[0]) && !seen.has(context)) {
        seen.add(context);
        tally.count += 1;
      }
      return context;
    };
  });
}

export const webglContextCount = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __webgl?: { count: number } }).__webgl?.count ?? 0);

/**
 * Has three.js been evaluated in this page? Its core module sets `window.__THREE__` to the
 * revision as a side effect, in production builds too. Only Work's stage loads it, and only near Work.
 */
export const threeLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(() => "__THREE__" in window);

/**
 * Has GSAP been evaluated in this page? Its core pushes its version onto
 * `window.gsapVersions` when it installs (gsap-core.js) — the GSAP twin of `threeLoaded`.
 * Only Work's stage loads it, and only near Work.
 */
export const gsapLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(() => "gsapVersions" in window);

// --- the home page's static hosts and Work's stage ------------------------------------------

/*
 * Work's WebGL stage (components/scene/SceneStage.tsx) — the only one on the site. Its state lives
 * on `[data-testid="scene-stage"]`: `data-renderer` pending|webgl|fallback|off, `data-reason`,
 * `data-tier`, `data-paused` (only while webgl), `data-motion`, `data-helix` (spiral|ambient).
 * Nothing is requested until Work comes within a viewport. Headless Chromium renders WebGL with
 * SwiftShader, which the strict probe refuses: the default path is the flat card grid
 * (`fallback`/`software`); `tbs_scene_3d=force` lets it draw (`forceScene3d`).
 */

/** What the probe answers under SwiftShader: a context, but a software one. */
export const SOFTWARE_GPU_PROBE: GpuProbeCache = {
  v: 1,
  strict: { context: true, software: true },
};

/** SwiftShader's answer for both probe modes: forced visits skip the throwaway context. */
export const FORCED_GPU_PROBE: GpuProbeCache = {
  v: 1,
  strict: { context: true, software: true },
  forced: { context: true, software: true },
};

export const sceneStage = (page: Page): Locator => page.locator(`[data-testid="${SCENE_TESTID.stage}"]`);

/** Set a `localStorage` key before any page script runs (the scene's QA flag lives there). */
async function seedLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* storage blocked: the spec's own assertions will say so */
      }
    },
    { key, value },
  );
}

/** `tbs_scene_3d=force`: WebGL even on a software renderer, never a governor bail. */
export const forceScene3d = (page: Page) => seedLocalStorage(page, SCENE_3D_KEY, "force");

/**
 * Answer the session's GPU probe before any page script runs — only if the tab has no
 * answer yet, so a real probe's answer (or an earlier seed) is never overwritten on reload.
 */
export async function seedGpuProbe(page: Page, cache: GpuProbeCache): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        if (window.sessionStorage.getItem(key) === null) window.sessionStorage.setItem(key, value);
      } catch {
        /* storage blocked */
      }
    },
    { key: GPU_PROBE_CACHE_KEY, value: JSON.stringify(cache) },
  );
}


/** The hero's core host (inside the backdrop layer; holds the static chip art). */
export const heroCore = (page: Page): Locator => page.locator('[data-testid="hero-core"]');

/** The services screen: `data-shape` is the selected direction's slug. */
export const servicesScreen = (page: Page): Locator => page.locator('[data-testid="services-screen"]');

/** The five direction pills (links) in `#servicii`, by the nav's own label in `locale`. */
export const directionPills = (page: Page, locale: Locale = "ro"): Locator =>
  page
    .locator("#servicii")
    .getByRole("navigation", { name: DIRECTIONS_NAV_LABEL[locale], exact: true })
    .getByRole("link");

/** `components/sections/Directions.tsx` → `SECTION.tabsAria` (module-local copy). */
const DIRECTIONS_NAV_LABEL: Record<Locale, string> = {
  ro: "Direcțiile de servicii",
  ru: "Направления услуг",
  en: "Service directions",
};

export type DotHit = { element: string; pseudo: "" | "::before" | "::after"; width: number; height: number };

/**
 * Decorative dots on screen (D1: they are gone for good): every rendered box in the header,
 * main and footer and inside the HUD chrome's parts (`[data-hud]`) — and their ::before /
 * ::after — that is at most 8×8px, rounded to at least half its short side, and paints
 * something (a background colour, an image or a shadow).
 * Skips `[data-dictation-slot]`: the recording light there is a privacy indicator, not
 * decoration. Text glyphs (the "✓" markers, "·" in copy) are not boxes and never match.
 */
export const decorativeDots = (page: Page): Promise<DotHit[]> =>
  page.evaluate(() => {
    const hits: DotHit[] = [];
    const px = (value: string) => {
      const n = Number.parseFloat(value);
      return Number.isFinite(n) ? n : 0;
    };
    const paints = (style: CSSStyleDeclaration) => {
      const colour = style.backgroundColor;
      const transparent = colour === "transparent" || /rgba\([^)]*,\s*0\)$/.test(colour);
      return !transparent || style.backgroundImage !== "none" || style.boxShadow !== "none";
    };
    const shown = (style: CSSStyleDeclaration) =>
      style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
    const round = (style: CSSStyleDeclaration, w: number, h: number) => {
      const short = Math.min(w, h);
      const radius = style.borderTopLeftRadius;
      if (radius.endsWith("%")) return px(radius) >= 50;
      return short > 0 && px(radius) >= short / 2;
    };
    const describe = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
        typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 4).join(".")}` : ""
      }`;
    for (const el of Array.from(document.querySelectorAll("header *, main *, footer *, [data-hud] *"))) {
      if (el.closest("[data-dictation-slot]")) continue;
      const style = getComputedStyle(el);
      if (!shown(style)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.width <= 8 && rect.height <= 8) {
        if (round(style, rect.width, rect.height) && paints(style)) {
          hits.push({ element: describe(el), pseudo: "", width: rect.width, height: rect.height });
        }
      }
      for (const pseudo of ["::before", "::after"] as const) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === "none" || ps.content === "normal" || !shown(ps)) continue;
        const w = px(ps.width);
        const h = px(ps.height);
        if (w > 0 && h > 0 && w <= 8 && h <= 8 && round(ps, w, h) && paints(ps)) {
          hits.push({ element: describe(el), pseudo, width: w, height: h });
        }
      }
    }
    return hits;
  });

/** The element's computed `transform` ("none" at rest). */
export const computedTransform = (locator: Locator): Promise<string> =>
  locator.evaluate((el) => getComputedStyle(el).transform);

/**
 * `<html>` and `<body>` carry no inline style and the instant-scroll hold is released: nothing
 * (ScrollTrigger's refreshes, a scroll lock, the HUD) left a write on the root. Polls for up to 5s; `when` names the moment in the failure message.
 */
export async function expectRootUntouched(page: Page, when: string): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          html: document.documentElement.getAttribute("style"),
          body: document.body.getAttribute("style"),
          measuring: document.documentElement.hasAttribute("data-scroll-measure"),
        })),
      { message: when, timeout: 5_000 },
    )
    .toEqual({ html: null, body: null, measuring: false });
}

/** Jump to `y` without the page's smooth scrolling, and wait until the page is there. */
export async function scrollToY(page: Page, y: number): Promise<number> {
  let target = 0;
  // The clamp is re-read on every poll: a page that is still growing (late layout right after
  // hydration) moves the bottom after the first scroll, so a "scroll to the end" follows it
  // instead of waiting for a position that no longer exists.
  await expect
    .poll(
      async () => {
        const reading = await page.evaluate((top) => {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          const clamped = Math.max(0, Math.min(Math.round(top), Math.floor(max)));
          if (Math.round(window.scrollY) !== clamped) window.scrollTo({ top: clamped, behavior: "instant" });
          return { clamped, at: Math.round(window.scrollY) };
        }, y);
        target = reading.clamped;
        return reading.at === reading.clamped;
      },
      { timeout: 5_000 },
    )
    .toBe(true);
  return target;
}

/**
 * The burger menu locks page scroll while it is open (lib/scrollLock.ts). Opening it after
 * scrolling must keep the sticky header at the top, and closing it must hand the page back
 * exactly where it was — which a scrollbar gutter reserved for a scrollbar that takes no
 * width (headless Chromium hides them; phones overlay them) used to break: 800 → 759 at 320px.
 * Shared by hud-shell.spec.ts and the forced-WebGL interior spec (the same round trip with a
 * live canvas under the page).
 */
export async function burgerRoundTrip(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(800);
  const widthBefore = (await header(page).boundingBox())!.width;

  await burger(page).click();
  const close = page.getByRole("button", { name: messages.ro["nav.closeAria"], exact: true });
  await expect(close).toBeVisible();
  await expect(close).toBeFocused();
  // Let the menu's entrance and any reflow settle before measuring.
  await page.waitForTimeout(400);
  const open = {
    headerY: (await header(page).boundingBox())!.y,
    headerWidth: (await header(page).boundingBox())!.width,
    htmlOverflow: await page.evaluate(() => getComputedStyle(document.documentElement).overflow),
  };

  await close.click();
  await expect(close).toHaveCount(0);
  await page.waitForTimeout(400);
  const after = {
    scrollY: await page.evaluate(() => window.scrollY),
    htmlStyle: await page.evaluate(() => document.documentElement.getAttribute("style")),
    bodyStyle: await page.evaluate(() => document.body.getAttribute("style")),
  };
  return { widthBefore, open, after };
}

export type PageErrors = {
  /** `console.error` messages (and failed resource loads the browser logs as errors). */
  console: string[];
  /** Uncaught exceptions. */
  page: string[];
};

/*
 * With `NEXT_PUBLIC_API_URL=""` (playwright.config.ts) the site asks the same origin for
 * `/api/content`, which the Next-only E2E server answers with a 404 — and the site then
 * renders its bundled defaults. That 404 is expected, and by default it is the only console
 * error dropped.
 */
const EXPECTED_MISSING = ["/api/content"] as const;

/** Is `url` a resource whose path ends in one of `allowMissing`? */
function isExpectedMissing(url: string, allowMissing: readonly string[]): boolean {
  try {
    const { pathname } = new URL(url);
    return allowMissing.some((path) => pathname.endsWith(path));
  } catch {
    return false;
  }
}

/**
 * Start collecting console errors and page errors. Call BEFORE navigating; the returned
 * object fills up as the page runs.
 *
 * `allowMissing` lists the path endings whose failed load is expected on the Next-only E2E
 * server (default: `/api/content` alone). A spec that also reaches another backend endpoint
 * passes the whole list, the default included, e.g. `["/api/content", "/api/status"]`.
 */
export function consoleErrors(
  page: Page,
  { allowMissing = EXPECTED_MISSING }: { allowMissing?: readonly string[] } = {},
): PageErrors {
  const errors: PageErrors = { console: [], page: [] };
  page.on("console", (message) => {
    if (message.type() !== "error" || isExpectedMissing(message.location().url, allowMissing)) return;
    errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.message));
  return errors;
}

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
