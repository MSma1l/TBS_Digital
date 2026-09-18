import {
  expect,
  test,
  type BrowserContext,
  type BrowserContextOptions,
  type Cookie,
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
import { INTRO_COOKIE, INTRO_FORCE_3D_KEY, INTRO_SEEN } from "@/lib/intro";
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

/**
 * Arrive as a visitor who has already seen the home-page intro this session, so the page is
 * the plain, static site from the first byte: no overlay, no three.js, no GSAP.
 *
 * Seeded at the ORIGIN, never at the page URL: Playwright derives a cookie's path from the
 * directory of the `url` it is given, so seeding with `/servicii/e-commerce` would scope the
 * cookie to `/servicii/` and `/` would still play the intro.
 */
export const seedIntroSeen = (context: BrowserContext, baseURL: string) =>
  seedCookie(context, INTRO_COOKIE, INTRO_SEEN, new URL("/", baseURL).href);

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
 * (`seedConsent`) and no intro on screen (`gotoHydrated` seeds the intro as seen).
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
 * The Ghid TBS guide (components/hud/guide/GuideAssistant.tsx): its root box in the
 * bottom-right corner (`[data-hud][data-guide]`, carrying `data-state`, `data-away` and
 * `data-yield`), the avatar button that opens the request flow on the guided chat, and the tip
 * a linger on a topic shows. Addressed by the hooks the component declares, never by copy or
 * CSS-module class names; its copy is `GUIDE_COPY` (components/hud/guide/copy.ts), which a spec
 * imports.
 */
export const guideRoot = (page: Page): Locator => page.locator("[data-hud][data-guide]");

export const guideAvatar = (page: Page): Locator => guideRoot(page).locator('[data-testid="guide-avatar"]');

export const guideTip = (page: Page): Locator => guideRoot(page).locator('[data-testid="guide-tip"]');

/**
 * The fibre-optic scroll rail (components/hud/rail/ScrollRail.tsx), a desktop-only HUD part
 * (≥861px): its root on the right edge (`[data-hud][data-rail]`, which carries `--rail-p`), and
 * the real `<nav>` of section buttons on it (absent when a page has no sections, or more than
 * eight). The decorative fibre is the root's `aria-hidden` child. The nav's name and the home
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

/**
 * The whole `tbs_intro` cookie, not just its value — the preloader spec asserts it is a
 * session cookie (`expires: -1`) scoped to `/`, `SameSite=Lax`, readable by script.
 */
export async function introCookie(context: BrowserContext): Promise<Cookie | undefined> {
  const all = await context.cookies();
  return all.find((c) => c.name === INTRO_COOKIE);
}

// --- navigation ------------------------------------------------------------------------

/**
 * The origin a cookie for `url` belongs to: `url` itself when absolute, otherwise the
 * project's `baseURL` (the config's `use` block is merged into the project).
 */
function baseFor(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = test.info().project.use.baseURL;
  if (!base) {
    throw new Error(
      `gotoHydrated("${url}"): a relative URL needs use.baseURL in playwright.config.ts — ` +
        "pass an absolute URL or configure one",
    );
  }
  return base;
}

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
 * Every spec is a RETURNING visitor unless it says otherwise: the intro cookie is seeded
 * first, so no full-screen overlay sits over the controls a test is about to press.
 * `preloader.spec.ts` passes `{ seedIntro: false }` to exercise the real first visit.
 *
 * A returning visitor also arrives with the GPU probe already answered for the session
 * (`seedGpuProbe`, on by default with `seedIntro`): the interior stage then settles on its
 * static art without creating a throwaway SwiftShader context about a second after idle —
 * CPU time that used to land inside other specs' timing windows. A spec that is about the
 * probe itself passes `{ seedGpuProbe: false }`; one that seeds its own answer
 * (`seedGpuProbe(page, …)`) before calling this keeps it, the default only fills a gap.
 */
export async function gotoHydrated(
  page: Page,
  url: string,
  {
    seedIntro = true,
    seedGpuProbe: seedProbe = seedIntro,
  }: { seedIntro?: boolean; seedGpuProbe?: boolean } = {},
): Promise<void> {
  if (seedIntro) await seedIntroSeen(page.context(), baseFor(url));
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
  /** `components/sections/RequestModal.tsx` → `COPY.title` (the dialog's accessible name). */
  modalTitle: "Spune-ne ce vrei să construiești.",
  /** `components/sections/Estimator.tsx` → `SECTION.submit` (the real contact submit). */
  estimatorSubmit: "Trimite cererea",
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

// --- the stepped request flow --------------------------------------------------------------

/*
 * The restructured request flow: three steps on ONE column — choose the project, choose what
 * it should contain, fill in the contact details — with the conversational assistant reduced
 * to an OPTIONAL panel behind a toggle.
 *
 * Everything below addresses the flow through the contract the flow's own markup declares
 * (`data-testid` / `data-step` / `aria-current`), never through copy or CSS-module class
 * names: the copy is trilingual and the styles are being rewritten in the same change.
 */

/** The flow's root. `data-layout` says whether it is the dialog or the home-page section. */
export const requestFlow = (root: Page | Locator): Locator =>
  root.locator('[data-testid="request-flow"]');

/** The three steps, in the order the client asked for them. */
export const REQUEST_STEPS = ["project", "options", "contact"] as const;
export type RequestStep = (typeof REQUEST_STEPS)[number];

/**
 * The step PANELS — every `[data-step]` that is not an item of the step indicator.
 *
 * The indicator is allowed to key its own items by `data-step` too, so an unqualified
 * `[data-step="contact"]` could match two very different things: the panel holding the
 * contact fields, and the little dot that points at it. `:not(<indicator> *)` keeps
 * "which step is on screen" a question about panels only.
 */
export const stepPanels = (flow: Locator): Locator =>
  flow.locator('[data-step]:not([data-testid="request-steps"] *)');

/** One step panel. */
export const stepPanel = (flow: Locator, step: RequestStep): Locator =>
  flow.locator(`[data-step="${step}"]:not([data-testid="request-steps"] *)`);

/** The progress indicator above the steps. */
export const requestSteps = (flow: Locator): Locator =>
  flow.locator('[data-testid="request-steps"]');

/** The indicator item the flow marks as current — the assistive-tech half of `data-active`. */
export const currentStepItem = (flow: Locator): Locator =>
  requestSteps(flow).locator('[aria-current="step"]');

/** Every step panel currently marked active. Exactly one, once the flow has mounted. */
export const activeStepPanels = (flow: Locator): Locator =>
  stepPanels(flow).and(flow.locator('[data-active="true"]'));

/** Which step is active right now, or `null` before the flow has mounted. */
export async function activeStep(flow: Locator): Promise<string | null> {
  const active = activeStepPanels(flow);
  if ((await active.count()) === 0) return null;
  return active.first().getAttribute("data-step");
}

/** Wait until `step` is the active one, failing with the step that is actually showing. */
export async function expectActiveStep(flow: Locator, step: RequestStep): Promise<void> {
  await expect
    .poll(() => activeStep(flow), { message: `the "${step}" step should be active` })
    .toBe(step);
  // Exactly one panel at a time — "one step on screen" is the whole point of the redesign.
  await expect(
    activeStepPanels(flow),
    "exactly one step may be active at a time",
  ).toHaveCount(1);
}

/*
 * CONTRACT GAP: the brief names the container, the steps, the indicator and the chat toggle,
 * but never names the control that MOVES between steps. Rather than guess one label, the
 * helper below tries, in order:
 *   1. an explicit hook — `[data-testid="request-next"]` / `[data-nav="next"]`;
 *   2. the Romanian wording such a button plausibly carries;
 *   3. the step indicator itself, if its items are buttons.
 * Whichever the implementation picked, the specs keep working. If it picked none of them,
 * the failure message says so instead of dying on a missing locator.
 */
const NAV_LABEL: Record<"next" | "back", RegExp> = {
  next: /^(continu[ăa]|mai departe|urm[ăa]torul|pasul urm[ăa]tor|[îi]nainte|pas nou)/i,
  back: /^([îi]napoi|pasul anterior|precedent)/i,
};

/** Click whatever moves the flow one step in `dir`. Returns false if nothing could be found. */
async function clickStepNav(flow: Locator, dir: "next" | "back"): Promise<boolean> {
  const hook = flow.locator(`[data-testid="request-${dir}"], [data-nav="${dir}"]`);
  if (await hook.count()) {
    await hook.first().click();
    return true;
  }
  const named = flow.getByRole("button", { name: NAV_LABEL[dir] });
  if (await named.count()) {
    await named.first().click();
    return true;
  }
  return false;
}

/** Click the indicator item for `step`, when the indicator is navigable. */
async function clickStepIndicator(flow: Locator, step: RequestStep): Promise<boolean> {
  const item = requestSteps(flow).locator(`[data-step="${step}"]`);
  const button = item.locator("xpath=self::button | .//button").first();
  const target = (await button.count()) ? button : item;
  if (!(await target.count()) || !(await target.first().isEnabled().catch(() => false))) {
    return false;
  }
  await target.first().click();
  return true;
}

/**
 * Walk the flow to `step`, whichever direction that is from where it stands now.
 *
 * Deliberately a walk and not a jump: going "project → contact" has to pass through
 * "options", which is exactly what a visitor does, and what a test that asserted nothing
 * about the intermediate step would stop guarding.
 */
export async function goToStep(flow: Locator, step: RequestStep): Promise<void> {
  for (let hop = 0; hop <= REQUEST_STEPS.length; hop += 1) {
    const current = (await activeStep(flow)) as RequestStep | null;
    if (current === step) {
      await expectActiveStep(flow, step);
      return;
    }
    expect(current, "the flow should have an active step").not.toBeNull();
    const dir =
      REQUEST_STEPS.indexOf(current!) < REQUEST_STEPS.indexOf(step) ? "next" : "back";
    const moved = (await clickStepNav(flow, dir)) || (await clickStepIndicator(flow, step));
    expect(
      moved,
      `no control moves the flow ${dir} from "${current}" — the flow needs a ` +
        `[data-testid="request-${dir}"] hook, a button named like /${NAV_LABEL[dir].source}/, ` +
        `or a navigable step indicator`,
    ).toBe(true);
    await expect
      .poll(() => activeStep(flow), { message: `the flow did not move ${dir}` })
      .not.toBe(current);
  }
  throw new Error(`the flow never reached the "${step}" step`);
}

/** Take one step back, asserting the flow actually moved. */
export async function goBackOneStep(flow: Locator): Promise<void> {
  const before = (await activeStep(flow)) as RequestStep;
  const moved = await clickStepNav(flow, "back");
  expect(moved, `nothing takes the flow back from "${before}"`).toBe(true);
  await expect.poll(() => activeStep(flow)).not.toBe(before);
}

/** The optional assistant's switch. Its `aria-expanded` is the state a screen reader hears. */
export const chatToggle = (flow: Locator): Locator =>
  flow.locator('[data-testid="chat-toggle"]');

/** The assistant's panel. Absent from the DOM until the toggle is pressed. */
export const chatPanel = (flow: Locator): Locator =>
  flow.locator('[data-testid="chat-panel"]');

/** Turn the assistant on and wait for its panel. */
export async function openChat(flow: Locator): Promise<Locator> {
  await chatToggle(flow).click();
  const panel = chatPanel(flow);
  await expect(panel).toBeVisible();
  await expect(chatToggle(flow)).toHaveAttribute("aria-expanded", "true");
  return panel;
}

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

/**
 * The contact form inside that section. The section contains more than one `<form>` (the
 * assistant's message composer is another), so it is identified by the one field only the
 * contact form has: the email input.
 */
export const estimatorForm = (page: Page): Locator =>
  estimatorSection(page)
    .locator("form")
    .filter({ has: page.locator('input[type="email"]') });

// --- the intro preloader -----------------------------------------------------------------

/*
 * The first-visit overlay (`components/intro/`), addressed through the hooks its markup
 * declares — `data-testid`, `role="progressbar"`, the catalog's `intro.*` keys — never
 * through CSS-module class names. `gotoHydrated` seeds it away; only a spec that passes
 * `{ seedIntro: false }` (or uses a raw `page.goto` without `seedIntroSeen`) ever sees it.
 */

/** The overlay root. Selector shared with the init-script probes below. */
const INTRO_SELECTOR = '[data-testid="intro"]';

export const introOverlay = (page: Page): Locator => page.locator(INTRO_SELECTOR);

/** The HUD readout. Its children are presentational, which is why skip sits beside it. */
export const introProgress = (page: Page): Locator =>
  introOverlay(page).getByRole("progressbar");

/** The visible `NN` counter the director writes through `textContent`. */
export const introCounter = (page: Page): Locator =>
  introOverlay(page).locator('[data-testid="intro-counter"]');

/** Where the WebGL canvas mounts (only when `data-renderer="webgl"`). */
export const introScene = (page: Page): Locator =>
  introOverlay(page).locator('[data-testid="intro-scene"]');

/** The skip button, by its catalog label in `locale`. */
export const introSkip = (page: Page, locale: Locale = "ro"): Locator =>
  introOverlay(page).getByRole("button", { name: messages[locale]["intro.skip"], exact: true });

/**
 * The cookie banner. `aria-modal="false"` is what tells it apart from the request dialog —
 * the mirror image of `modalDialog`.
 */
export const cookieBanner = (page: Page): Locator =>
  page.locator('[role="dialog"][aria-modal="false"]');

/**
 * Record every value the intro's progress bar announces, in order, from the server-rendered
 * one onwards. Consecutive repeats are dropped, so the spec can assert the sequence never
 * goes backwards and ends at exactly 100. Read it with `introProgressValues(page)`.
 */
export async function recordIntroProgress(page: Page): Promise<void> {
  await page.addInitScript((selector) => {
    const w = window as unknown as { __introProgress?: number[] };
    const values: number[] = [];
    w.__introProgress = values;

    const record = (node: Node) => {
      if (!(node instanceof Element) || node.getAttribute("role") !== "progressbar") return;
      if (!node.closest(selector)) return;
      const raw = node.getAttribute("aria-valuenow");
      const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
      if (Number.isFinite(value) && values[values.length - 1] !== value) values.push(value);
    };

    new MutationObserver((mutations) => mutations.forEach((m) => record(m.target))).observe(
      document,
      { subtree: true, attributes: true, attributeFilter: ["aria-valuenow"] },
    );
    // The first value is parsed, not mutated — pick it up once the markup is in.
    document.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll('[role="progressbar"][aria-valuenow]').forEach(record);
    });
  }, INTRO_SELECTOR);
}

export const introProgressValues = (page: Page): Promise<number[]> =>
  page.evaluate(
    () => (window as unknown as { __introProgress?: number[] }).__introProgress ?? [],
  );

/**
 * Collect Content-Security-Policy violations as `"<directive> <blocked URI>"`. The intro
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
 * Count the distinct WebGL contexts the page creates (the capability probe's throwaway one
 * included). A returning visitor, or reduced motion, must create none. Read with
 * `webglContextCount`.
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

/** A browser with no WebGL at all: the capability probe must fall back to the SVG intro. */
export async function forceNoWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: AnyGetContext };
    const real = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, ...args: GetContextArgs) {
      return /webgl/i.test(args[0]) ? null : real.apply(this, args);
    };
  });
}

/**
 * WebGL that passes the probe but fails the real renderer. The probe uses a DETACHED
 * canvas; R3F's canvas is in the document — so only connected canvases get `null`, and
 * three.js throws "Error creating WebGL context" inside the scene. The error boundary must
 * turn that into the SVG fallback.
 */
export async function breakRendererWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: AnyGetContext };
    const real = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, ...args: GetContextArgs) {
      return /webgl/i.test(args[0]) && this.isConnected ? null : real.apply(this, args);
    };
  });
}

/**
 * Watch the overlay every animation frame for `durationMs` and remember whether it was EVER
 * actually visible (displayed, not `visibility:hidden`, opacity above 0) — `toBeHidden`
 * alone ignores opacity and can't see a one-frame flash. Read with `introEverVisible`.
 */
export async function sampleIntroVisibility(page: Page, durationMs = 5_000): Promise<void> {
  await page.addInitScript(
    ({ selector, duration }) => {
      const w = window as unknown as { __introEverVisible?: boolean };
      w.__introEverVisible = false;
      const start = performance.now();
      const sample = () => {
        const el = document.querySelector(selector);
        if (el) {
          const style = getComputedStyle(el);
          if (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0
          ) {
            w.__introEverVisible = true;
            return;
          }
        }
        if (performance.now() - start < duration) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { selector: INTRO_SELECTOR, duration: durationMs },
  );
}

export const introEverVisible = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => (window as unknown as { __introEverVisible?: boolean }).__introEverVisible ?? false,
  );

/**
 * Has three.js been evaluated in this page? Its core module sets `window.__THREE__` to the
 * revision as a side effect, in production builds too — so no app-side flag is needed.
 */
export const threeLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(() => "__THREE__" in window);

/**
 * Has GSAP been evaluated in this page? Its core pushes its version onto
 * `window.gsapVersions` when it installs (gsap-core.js), production builds included — the
 * GSAP twin of `threeLoaded`.
 */
export const gsapLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(() => "gsapVersions" in window);

/**
 * Ask for the WebGL scene even on a software renderer (SwiftShader in this container), the
 * QA switch `components/intro/capability.ts` reads. Set from an init script so it is in
 * localStorage before the app's first line runs.
 */
export async function forceIntro3d(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key }) => {
      try {
        window.localStorage.setItem(key, "force");
      } catch {
        /* storage blocked: the spec's own assertions will say so */
      }
    },
    { key: INTRO_FORCE_3D_KEY },
  );
}

/**
 * Record every value the overlay root's `data-phase` and `data-renderer` take, in order
 * (server-rendered values included, consecutive repeats dropped). A renderer that was
 * "webgl" for a moment and fell back stays visible in the record, which a single read
 * after the fact could never show. Read with `introAttributeValues(page)`.
 */
export async function recordIntroAttributes(page: Page): Promise<void> {
  await page.addInitScript((selector) => {
    const w = window as unknown as { __introAttrs?: Record<string, string[]> };
    const record: Record<string, string[]> = { "data-phase": [], "data-renderer": [] };
    w.__introAttrs = record;
    const add = (name: string, value: string | null) => {
      const list = record[name];
      if (value !== null && list && list[list.length - 1] !== value) list.push(value);
    };
    const push = (el: Element, name: string) => add(name, el.getAttribute(name));
    // Old values first, then the value at callback time: two changes inside one batch
    // (webgl → fallback in the same frame) would otherwise collapse into the last one.
    new MutationObserver((mutations) => {
      const touched = new Map<Element, Set<string>>();
      for (const m of mutations) {
        if (!(m.target instanceof Element) || !m.attributeName || !m.target.matches(selector)) {
          continue;
        }
        add(m.attributeName, m.oldValue);
        if (!touched.has(m.target)) touched.set(m.target, new Set());
        touched.get(m.target)!.add(m.attributeName);
      }
      touched.forEach((names, el) => names.forEach((name) => push(el, name)));
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["data-phase", "data-renderer"],
    });
    document.addEventListener("DOMContentLoaded", () => {
      const root = document.querySelector(selector);
      if (root) Object.keys(record).forEach((name) => push(root, name));
    });
  }, INTRO_SELECTOR);
}

export const introAttributeValues = (
  page: Page,
): Promise<{ phase: string[]; renderer: string[] }> =>
  page.evaluate(() => {
    const r = (window as unknown as { __introAttrs?: Record<string, string[]> }).__introAttrs;
    return { phase: r?.["data-phase"] ?? [], renderer: r?.["data-renderer"] ?? [] };
  });

// --- the interior stage (components/scene/) --------------------------------------------

/*
 * The home page's one WebGL stage wraps Hero → Ticker → Directions. Its state lives on the
 * root `[data-testid="scene-stage"]`: `data-renderer` pending|webgl|fallback|off,
 * `data-reason`, `data-tier`, `data-paused` (only while webgl), `data-motion` live|static,
 * `data-scroll-fx` on|off, `data-boost` ("" while a hero CTA is hovered or focused),
 * `data-quality` and `data-morph` (only once a canvas has reported). Headless Chromium here
 * renders WebGL with SwiftShader, which the stage's strict probe refuses: the default path is
 * the static art (`fallback`/`software`); `tbs_scene_3d=force` is the QA switch that lets it
 * draw (`forceScene3d`).
 */

/** What the probe answers under SwiftShader: a context, but a software one. */
export const SOFTWARE_GPU_PROBE: GpuProbeCache = {
  v: 1,
  strict: { context: true, software: true },
};

export const sceneStage = (page: Page): Locator =>
  page.locator(`[data-testid="${SCENE_TESTID.stage}"]`);

/** The hero's core host (inside the backdrop marker; the art or the canvas's anchor). */
export const sceneHero = (page: Page): Locator =>
  page.locator(`[data-testid="${SCENE_TESTID.hero}"]`);

/** The services screen: `data-shape` is the selected direction's slug. */
export const sceneServices = (page: Page): Locator =>
  page.locator(`[data-testid="${SCENE_TESTID.services}"]`);

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

/** `tbs_scene_3d=off`: the stage stays `off`/`flag` and loads nothing. */
export const disableScene3d = (page: Page) => seedLocalStorage(page, SCENE_3D_KEY, "off");

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

/** The session's cached probe answer, parsed (null when absent or unreadable). */
export const gpuProbeCache = (page: Page): Promise<GpuProbeCache | null> =>
  page.evaluate((key) => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as GpuProbeCache);
    } catch {
      return null;
    }
  }, GPU_PROBE_CACHE_KEY);

/**
 * Keep a weak reference to every WebGL context the page creates, so a spec can ask how many
 * are still alive (`liveWebGLContexts`: not lost, not collected) — "the stage released its
 * context when the visitor left" is a count going back to 0, not a count of creations.
 */
export async function trackWebGLContexts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type Tracked = { refs: WeakRef<WebGLRenderingContext | WebGL2RenderingContext>[]; created: number };
    const w = window as unknown as { __webglRefs?: Tracked };
    const tracked: Tracked = { refs: [], created: 0 };
    w.__webglRefs = tracked;
    const seen = new WeakSet<object>();
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: AnyGetContext };
    const real = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, ...args: GetContextArgs) {
      const context = real.apply(this, args);
      if (context && typeof context === "object" && /webgl/i.test(args[0]) && !seen.has(context)) {
        seen.add(context);
        tracked.created += 1;
        tracked.refs.push(new WeakRef(context as WebGL2RenderingContext));
      }
      return context;
    };
  });
}

/** Contexts created so far that are neither lost nor garbage-collected. */
export const liveWebGLContexts = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const tracked = (
      window as unknown as {
        __webglRefs?: { refs: WeakRef<WebGL2RenderingContext>[] };
      }
    ).__webglRefs;
    if (!tracked) return 0;
    return tracked.refs.filter((ref) => {
      const context = ref.deref();
      return !!context && !context.isContextLost();
    }).length;
  });

/** Every WebGL context the page has created (the tracker's own count, live or not). */
export const createdWebGLContexts = (page: Page): Promise<number> =>
  page.evaluate(
    () => (window as unknown as { __webglRefs?: { created: number } }).__webglRefs?.created ?? 0,
  );

type DrawTally = { calls: number; frames: number[]; frameTs: number; frameStart: number };

/**
 * Count WebGL draw calls per animation frame, from the outside: the draw methods of both
 * context prototypes are wrapped, and a frame closes when the first `requestAnimationFrame`
 * callback of the next one runs. The page's code is untouched — a mesh that is not visible
 * issues no draw, so "one more draw per frame" is "one more mesh drew". Read with
 * `drawCallsPerFrame` (the last 600 frames), reset with `resetDrawCalls`.
 */
export async function countDrawCalls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const tally: DrawTally = { calls: 0, frames: [], frameTs: -1, frameStart: 0 };
    (window as unknown as { __draws?: DrawTally }).__draws = tally;
    for (const ctor of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!ctor) continue;
      const proto = ctor.prototype as unknown as Record<string, unknown>;
      for (const name of ["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced"]) {
        const real = proto[name];
        if (typeof real !== "function") continue;
        proto[name] = function (this: unknown, ...args: unknown[]) {
          tally.calls += 1;
          return (real as (...a: unknown[]) => unknown).apply(this, args);
        };
      }
    }
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      raf((ts) => {
        if (ts !== tally.frameTs) {
          if (tally.frameTs >= 0) {
            tally.frames.push(tally.calls - tally.frameStart);
            if (tally.frames.length > 600) tally.frames.shift();
          }
          tally.frameTs = ts;
          tally.frameStart = tally.calls;
        }
        callback(ts);
      });
  });
}

/** Draw calls in each frame since the last reset (frames that drew nothing included). */
export const drawCallsPerFrame = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { __draws?: DrawTally }).__draws?.frames.slice() ?? []);

export const resetDrawCalls = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const tally = (window as unknown as { __draws?: DrawTally }).__draws;
    if (tally) tally.frames.length = 0;
  });

export type SceneRecord = { renderer: string; introPresent: boolean };

/**
 * Record every `data-renderer` the stage takes, in order, with whether the intro overlay was
 * in the document at that moment (the server value first, consecutive repeats dropped).
 * "Never webgl while the intro covers the page" needs the pairing, not two separate lists.
 * Read with `sceneAttributeValues(page)`.
 */
export async function recordSceneAttributes(page: Page): Promise<void> {
  await page.addInitScript(
    ({ stage, intro }) => {
      const w = window as unknown as { __sceneAttrs?: SceneRecord[] };
      const values: SceneRecord[] = [];
      w.__sceneAttrs = values;
      const add = (renderer: string | null) => {
        if (renderer === null) return;
        const introPresent = document.querySelector(intro) !== null;
        const last = values[values.length - 1];
        if (last && last.renderer === renderer && last.introPresent === introPresent) return;
        values.push({ renderer, introPresent });
      };
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (!(m.target instanceof Element) || !m.target.matches(stage)) continue;
          add(m.oldValue);
          add(m.target.getAttribute("data-renderer"));
        }
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-renderer"],
      });
      document.addEventListener("DOMContentLoaded", () => {
        add(document.querySelector(stage)?.getAttribute("data-renderer") ?? null);
      });
    },
    { stage: `[data-testid="${SCENE_TESTID.stage}"]`, intro: INTRO_SELECTOR },
  );
}

export const sceneAttributeValues = (page: Page): Promise<SceneRecord[]> =>
  page.evaluate(() => (window as unknown as { __sceneAttrs?: SceneRecord[] }).__sceneAttrs ?? []);

/** Wait for the stage to leave `pending` and return what it settled on. */
export async function settledRenderer(
  page: Page,
  timeout = 15_000,
): Promise<{ renderer: string | null; reason: string | null }> {
  const stage = sceneStage(page);
  await expect(stage).not.toHaveAttribute("data-renderer", "pending", { timeout });
  return {
    renderer: await stage.getAttribute("data-renderer"),
    reason: await stage.getAttribute("data-reason"),
  };
}

/** One number of the scene's scroll probe next to what the DOM says it is right now. */
export type ProbeReading = { name: string; probe: number | null; dom: number };

/**
 * The scroll probe the interior scene reads every frame (lib/scene.ts `ScrollProbe`: the four
 * scroll spans, the stage's top and bottom, both anchors' and Work's track's document y), each
 * next to the same value measured from the DOM right now — what the director SHOULD have stored
 * at its last refresh. Null while no canvas (or no probe) is mounted.
 *
 * A test-only read that needs nothing from production: the probe is the `probe` prop of the
 * components around the canvas, reached through React's fiber on the canvas's DOM ancestors.
 * The DOM side follows the director's triggers: `heroExit` = `#top` "top top" → "bottom 35%",
 * `entry` = the services anchor "top 90%" → "top 75%" (the band the scene's timed entry gate
 * arms and disarms over), `workSpan` = Work's track "top 70%" → "top 55%" (the same kind of band
 * for the work gate) and `helix` = the track "top top" less the header → "bottom bottom" (the
 * scroll Work's spiral turns over; the header height is the sticky layer's resolved `top`). Like
 * ScrollTrigger, an end before the trigger's own start is clamped to it: a phone's band is
 * shorter than the viewport.
 */
export const sceneProbeVsDom = (page: Page): Promise<ProbeReading[] | null> =>
  page.evaluate(() => {
    type Probe = {
      version: number;
      live: boolean;
      stage: { top: number; bottom: number };
      hero: { y: number } | null;
      services: { y: number } | null;
      work: { y: number } | null;
      heroExit: { start: number; end: number };
      entry: { start: number; end: number };
      workSpan: { start: number; end: number };
      helix: { start: number; end: number };
    };
    type Fiber = { return: Fiber | null; memoizedProps?: { probe?: Probe } };
    const canvas = document.querySelector("[data-scene-layer] canvas");
    let probe: Probe | null = null;
    for (let node: Element | null = canvas; node && !probe; node = node.parentElement) {
      const key = Object.keys(node).find((k) => k.startsWith("__reactFiber$"));
      const start = key ? ((node as unknown as Record<string, Fiber>)[key] ?? null) : null;
      for (let fiber = start; fiber && !probe; fiber = fiber.return) {
        const candidate = fiber.memoizedProps?.probe;
        if (candidate && typeof candidate.version === "number") probe = candidate;
      }
    }
    if (!probe) return null;
    const vh = window.innerHeight;
    const doc = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, h: box.height };
    };
    const hero = doc("#top");
    const stage = doc("[data-scene-stage]");
    const heroAnchor = doc('[data-scene-anchor="hero"]');
    const services = doc('[data-scene-anchor="services"]');
    const track = doc("[data-work-track]");
    const headerH = Number.parseFloat(getComputedStyle(document.querySelector("[data-scene-layer]")!).top) || 0;
    return [
      { name: "live", probe: probe.live ? 1 : 0, dom: 1 },
      { name: "heroExit.start", probe: probe.heroExit.start, dom: hero.top },
      { name: "heroExit.end", probe: probe.heroExit.end, dom: hero.bottom - 0.35 * vh },
      { name: "entry.start", probe: probe.entry.start, dom: services.top - 0.9 * vh },
      { name: "entry.end", probe: probe.entry.end, dom: services.top - 0.75 * vh },
      { name: "work.start", probe: probe.workSpan.start, dom: track.top - 0.7 * vh },
      { name: "work.end", probe: probe.workSpan.end, dom: track.top - 0.55 * vh },
      { name: "helix.start", probe: probe.helix.start, dom: track.top - headerH },
      { name: "helix.end", probe: probe.helix.end, dom: Math.max(track.top, track.bottom - vh) },
      { name: "stage.top", probe: probe.stage.top, dom: stage.top },
      { name: "stage.bottom", probe: probe.stage.bottom, dom: stage.bottom },
      { name: "hero.y", probe: probe.hero?.y ?? null, dom: heroAnchor.top },
      { name: "services.y", probe: probe.services?.y ?? null, dom: services.top },
      { name: "work.y", probe: probe.work?.y ?? null, dom: track.top },
    ];
  });

/** The readings of `sceneProbeVsDom` that are off by more than `tolerance` px (empty: all match). */
export const probeMismatches = (readings: ProbeReading[] | null, tolerance = 2): string[] =>
  readings === null
    ? ["no probe"]
    : readings
        .filter((r) => r.probe === null || Math.abs(r.probe - r.dom) > tolerance)
        .map((r) => `${r.name}: probe ${r.probe === null ? "null" : Math.round(r.probe)}, DOM ${Math.round(r.dom)}`);

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
 * (ScrollTrigger's refreshes, a scroll lock, the HUD) left a write on the root. Polls for up to
 * 5s; `when` names the moment in the failure message. Moved here from interior-webgl.spec.ts
 * so the HUD specs can assert the same.
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
