import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  toThemeChoice,
  type ThemeChoice,
} from "@/lib/theme/theme";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

const ro = messages.ro;
const TOGGLE = ro["theme.toggleAria"];

const html = () => document.documentElement;
const theme = () => html().getAttribute("data-theme");

/** What the browser would send back on the next request. */
function savedChoice(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`));
  return toThemeChoice(match?.[1]);
}

/**
 * Renders the navbar the way the app does: the theme provider seeded with the choice the
 * server read from the cookie, and — for an explicit choice — `data-theme` already on
 * `<html>`, exactly as the server-rendered markup and the inline script leave it. The
 * request-flow provider is there for the same reason: the navbar's red CTA opens the site's
 * one shared dialog through it (`app/layout.tsx` mounts it above every page).
 */
function renderNav({
  choice = "system" as ThemeChoice,
  locale = "ro" as Locale,
} = {}) {
  if (choice !== "system") html().setAttribute("data-theme", choice);
  return render(
    <ThemeProvider initialChoice={choice}>
      <LanguageProvider initialLocale={locale}>
        <RequestFlowProvider>
          <Navbar />
        </RequestFlowProvider>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

/** Replace jsdom's matchMedia so a test can pretend the OS is in dark mode. */
const realMatchMedia = window.matchMedia;
function mockPrefersDark(dark: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: dark && query.includes("dark"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeEach(() => {
  html().removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=;path=/;max-age=0`;
});

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

/**
 * The toggle's contract: one press changes the palette the whole site is painted in, which
 * is nothing more than the value of `data-theme` on `<html>` — globals.css does the rest.
 */
describe("ThemeToggle — switching the palette", () => {
  it("flips <html data-theme> between light and dark", async () => {
    const user = userEvent.setup();
    renderNav();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(theme()).toBe("dark");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(theme()).toBe("light");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the palette that is on screen, and says what a press would do", async () => {
    const user = userEvent.setup();
    renderNav();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(toggle).toHaveAttribute("title", ro["theme.switchToDark"]);

    await user.click(toggle);
    expect(toggle).toHaveAttribute("title", ro["theme.switchToLight"]);
  });

  it("reflects a dark choice the server already resolved", () => {
    renderNav({ choice: "dark" });

    expect(screen.getByRole("button", { name: TOGGLE })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

/**
 * Persistence has to survive a real reload, not just a re-render — which means the choice
 * must be readable by the *next* document, before any React runs. That is the cookie plus
 * the inline script, so this test drives both.
 */
describe("ThemeToggle — the choice persists", () => {
  it("writes the choice to the cookie", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: TOGGLE }));

    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(savedChoice()).toBe("dark");
  });

  it("comes back dark after a reload", async () => {
    const user = userEvent.setup();
    const first = renderNav();

    await user.click(screen.getByRole("button", { name: TOGGLE }));
    const chosen = savedChoice();

    // --- reload: the document is thrown away, the cookie is not ---
    first.unmount();
    html().removeAttribute("data-theme");

    // The new document parses <head> and runs the anti-flash script before painting.
    new Function(THEME_INIT_SCRIPT)();
    expect(theme()).toBe("dark");

    // …then the server-seeded provider mounts on top of it, still dark.
    renderNav({ choice: chosen });
    expect(theme()).toBe("dark");
    expect(screen.getByRole("button", { name: TOGGLE })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

/**
 * The script that runs before the first paint. It is the only thing standing between a
 * dark-mode visitor and a white flash, so its three branches are pinned here.
 */
describe("anti-flash script", () => {
  it("applies the saved choice even when the OS disagrees", () => {
    document.cookie = `${THEME_COOKIE}=light;path=/`;
    mockPrefersDark(true);

    new Function(THEME_INIT_SCRIPT)();

    expect(theme()).toBe("light");
  });

  it("follows the OS when nothing was chosen", () => {
    mockPrefersDark(true);

    new Function(THEME_INIT_SCRIPT)();

    expect(theme()).toBe("dark");
  });

  it("falls back to light when the OS says nothing", () => {
    mockPrefersDark(false);

    new Function(THEME_INIT_SCRIPT)();

    expect(theme()).toBe("light");
  });

  /**
   * The site serves a strict, nonce-based CSP with no 'unsafe-inline' (proxy.ts), so an
   * un-nonced inline script is silently blocked — the toggle would still work, but the
   * flash it exists to prevent would be back. This pins the nonce onto the tag.
   */
  it("is rendered in <head> carrying the per-request CSP nonce", () => {
    // Vitest runs from the repo root, so the layout is addressable from there.
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

    expect(layout).toMatch(
      /<script\s+nonce=\{nonce\}\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*THEME_INIT_SCRIPT\s*\}\}\s*\/>/,
    );
    // …and inside <head>, not after the body content.
    const head = layout.indexOf("<head>");
    const script = layout.indexOf("THEME_INIT_SCRIPT }}");
    const closingHead = layout.indexOf("</head>");
    expect(head).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(head);
    expect(script).toBeLessThan(closingHead);
  });
});

/**
 * A control nobody can reach with a keyboard is not a control. The toggle is a real
 * `<button>`, so Tab reaches it and both Enter and Space activate it — and it is announced
 * in the visitor's own language.
 */
describe("ThemeToggle — accessibility", () => {
  it("sits in the preferences group, right after the language switcher", () => {
    renderNav();

    const prefs = screen.getByRole("group", { name: /Preferences/ });
    const toggle = within(prefs).getByRole("button", { name: TOGGLE });
    const languages = within(prefs).getByRole("group", { name: /Language/ });

    expect(languages.nextElementSibling).toBe(toggle);
  });

  it("is reachable by Tab, after the language options", async () => {
    const user = userEvent.setup();
    renderNav();

    const enBtn = screen.getByRole("button", { name: "English" });
    const toggle = screen.getByRole("button", { name: TOGGLE });

    const order: Element[] = [];
    for (let i = 0; i < 25; i += 1) {
      await user.tab();
      const active = document.activeElement;
      if (!active || active === document.body) break;
      order.push(active);
      if (active === toggle) break;
    }

    expect(order).toContain(toggle);
    expect(order.indexOf(enBtn)).toBeLessThan(order.indexOf(toggle));
  });

  it("switches with Enter", async () => {
    const user = userEvent.setup();
    renderNav();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    toggle.focus();
    await user.keyboard("{Enter}");

    expect(theme()).toBe("dark");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("switches with Space", async () => {
    const user = userEvent.setup();
    renderNav();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    toggle.focus();
    await user.keyboard("[Space]");

    expect(theme()).toBe("dark");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("is labelled in the language the visitor is reading", () => {
    renderNav({ locale: "ru" });

    const toggle = screen.getByRole("button", { name: messages.ru["theme.toggleAria"] });
    expect(toggle).toHaveAttribute("title", messages.ru["theme.switchToDark"]);
  });

  it("is labelled in English for an English visitor", () => {
    renderNav({ locale: "en" });

    const toggle = screen.getByRole("button", { name: messages.en["theme.toggleAria"] });
    expect(toggle).toHaveAttribute("title", messages.en["theme.switchToDark"]);
  });
});

/**
 * The client's requirement, stated as a test: on a phone the toggle is in the top bar. It
 * must be operable without opening the hamburger menu, and opening the menu must not put a
 * second copy of it on screen.
 */
describe("ThemeToggle — visible on mobile without opening the menu", () => {
  it("renders in the header bar while the menu is closed, and switches from there", async () => {
    const user = userEvent.setup();
    renderNav();

    // The menu is closed: no overlay on screen.
    expect(screen.queryByRole("button", { name: ro["nav.closeAria"] })).toBeNull();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(toggle.closest("header")).not.toBeNull();

    await user.click(toggle);
    expect(theme()).toBe("dark");
  });

  it("is not duplicated when the hamburger menu opens", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: ro["nav.burgerAria"] }));
    expect(screen.getByRole("button", { name: ro["nav.closeAria"] })).toBeTruthy();

    const toggles = screen.getAllByRole("button", { name: TOGGLE });
    expect(toggles).toHaveLength(1);
    expect(toggles[0].closest("header")).not.toBeNull();
  });
});
