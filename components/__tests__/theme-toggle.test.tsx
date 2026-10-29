import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import {
  DEFAULT_THEME,
  THEME_COLOR,
  THEME_COOKIE,
  observeTheme,
  toTheme,
  type Theme,
} from "@/lib/theme/theme";
import { messages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/locales";

const ro = messages.ro;
const TOGGLE = ro["theme.toggleAria"];

const html = () => document.documentElement;
const theme = () => html().getAttribute("data-theme");

/** What the browser would send back on the next request. */
function savedTheme(): string | undefined {
  return document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`))?.[1];
}

/** MutationObserver callbacks run as a microtask after the mutation. */
const flushObservers = () => new Promise<void>((done) => queueMicrotask(done));

/**
 * Renders the navbar the way the app does: the theme provider seeded with the palette the
 * server read from the cookie, and `data-theme` already on `<html>`, exactly as the root
 * layout stamps it. The request-flow provider is there because the navbar's red CTA opens the
 * site's one shared dialog through it.
 */
function renderNav({ initial = "light" as Theme, locale = "ro" as Locale } = {}) {
  html().setAttribute("data-theme", initial);
  return render(
    <ThemeProvider initialTheme={initial}>
      <LanguageProvider initialLocale={locale}>
        <RequestFlowProvider>
          <Navbar />
        </RequestFlowProvider>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  html().removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=;path=/;max-age=0`;
  document.head.querySelectorAll("meta[name]").forEach((meta) => meta.remove());
});

/**
 * The toggle's contract: one press changes the palette the whole site is painted in, which is
 * nothing more than the value of `data-theme` on `<html>` — globals.css does the rest. Every
 * visitor starts light, so the first press goes to dark.
 */
describe("ThemeToggle — switching the palette", () => {
  it("starts light and flips <html data-theme> between light and dark", async () => {
    const user = userEvent.setup();
    renderNav();

    const toggle = screen.getByRole("button", { name: TOGGLE });
    expect(theme()).toBe("light");
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

  // Dark, not light: light is what a render with no choice already shows, so only the
  // non-default palette proves the server's choice was used.
  it("reflects a dark choice the server already resolved", () => {
    renderNav({ initial: "dark" });

    expect(theme()).toBe("dark");
    expect(screen.getByRole("button", { name: TOGGLE })).toHaveAttribute("aria-pressed", "true");
  });

  it("brings the browser chrome along: the theme-color and color-scheme meta tags", async () => {
    const user = userEvent.setup();
    const themeColor = Object.assign(document.createElement("meta"), { name: "theme-color" });
    const colorScheme = Object.assign(document.createElement("meta"), { name: "color-scheme" });
    themeColor.content = THEME_COLOR.light;
    colorScheme.content = "light";
    document.head.append(themeColor, colorScheme);
    renderNav();

    await user.click(screen.getByRole("button", { name: TOGGLE }));

    expect(themeColor.content).toBe(THEME_COLOR.dark);
    expect(colorScheme.content).toBe("dark");
  });
});

/**
 * Persistence has to survive a real reload, not just a re-render — so the choice must be
 * readable by the *next* request: the `tbs_theme` cookie, which the root layout reads to stamp
 * `<html data-theme>` on the server.
 */
describe("ThemeToggle — the choice persists", () => {
  it("writes the choice to the cookie, both ways", async () => {
    const user = userEvent.setup();
    renderNav();
    const toggle = screen.getByRole("button", { name: TOGGLE });

    await user.click(toggle);
    expect(savedTheme()).toBe("dark");

    await user.click(toggle);
    expect(savedTheme()).toBe("light");
  });

  it("reads no cookie, or a junk one, as the light default", () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(toTheme(undefined)).toBe("light");
    expect(toTheme("neon")).toBe("light");
    expect(toTheme("dark")).toBe("dark");
  });

  /**
   * The site serves a strict, nonce-based CSP, so the palette is stamped by the server rather
   * than by an inline script before paint. This pins the wiring in the root layout: the cookie
   * is read there and the attribute is rendered on <html>.
   */
  it("is stamped on <html> by the root layout, from the cookie, with no inline script", () => {
    const layout = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

    expect(layout).toMatch(/get\(THEME_COOKIE\)/);
    expect(layout).toMatch(/<html[^>]*data-theme=\{theme\}/);
    expect(layout).toMatch(/<ThemeProvider initialTheme=\{theme\}>/);
    // The JSON-LD block is the layout's only script element.
    expect(layout.match(/<script\b/g)).toHaveLength(1);
  });
});

/**
 * The 3D scene follows a theme change through `observeTheme` (components/scene/SceneCanvas.tsx
 * re-reads its palette from the tokens), so the observer has to fire on a real change, only on
 * a real change, and stop when asked.
 */
describe("observeTheme — what the scene listens to", () => {
  it("reports a change of palette, whoever made it", async () => {
    const seen: Theme[] = [];
    const stop = observeTheme((next) => seen.push(next));

    html().setAttribute("data-theme", "dark");
    await flushObservers();
    html().setAttribute("data-theme", "dark");
    await flushObservers();
    html().removeAttribute("data-theme");
    await flushObservers();

    // Light → dark, the same value again (ignored), then back to the default.
    expect(seen).toEqual(["dark", "light"]);
    stop();
  });

  it("hears the toggle", async () => {
    const user = userEvent.setup();
    renderNav();
    const seen: Theme[] = [];
    const stop = observeTheme((next) => seen.push(next));

    await user.click(screen.getByRole("button", { name: TOGGLE }));
    await flushObservers();

    expect(seen).toEqual(["dark"]);
    stop();
  });

  it("stops when unsubscribed", async () => {
    const seen: Theme[] = [];
    observeTheme((next) => seen.push(next))();

    html().setAttribute("data-theme", "dark");
    await flushObservers();

    expect(seen).toEqual([]);
  });
});

/**
 * A control nobody can reach with a keyboard is not a control. The toggle is a real `<button>`,
 * so Tab reaches it and both Enter and Space activate it — and it is announced in the
 * visitor's own language.
 */
describe("ThemeToggle — accessibility", () => {
  it("sits in the preferences group, right after the language switcher", () => {
    renderNav();

    const prefs = screen.getByRole("group", { name: /Preferences/ });
    const toggle = within(prefs).getByRole("button", { name: TOGGLE });
    const languages = within(prefs).getByRole("group", { name: /Language/ });

    expect(languages.nextElementSibling).toBe(toggle);
  });

  it("is reachable by Tab, right after the language button", async () => {
    const user = userEvent.setup();
    renderNav();

    const languageButton = within(screen.getByRole("group", { name: /Language/ })).getByRole(
      "button",
      { expanded: false },
    );
    const toggle = screen.getByRole("button", { name: TOGGLE });

    const order: Element[] = [];
    for (let i = 0; i < 40; i += 1) {
      await user.tab();
      const active = document.activeElement;
      if (!active || active === document.body) break;
      order.push(active);
      if (active === toggle) break;
    }

    expect(order).toContain(toggle);
    expect(order.indexOf(toggle) - order.indexOf(languageButton)).toBe(1);
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
 * On a phone the toggle is in the top bar: operable without opening the hamburger menu, and
 * opening the menu must not put a second copy of it on screen.
 */
describe("ThemeToggle — visible on mobile without opening the menu", () => {
  it("renders in the header bar while the menu is closed, and switches from there", async () => {
    const user = userEvent.setup();
    renderNav();

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
    expect(screen.getAllByRole("button", { name: ro["nav.closeAria"] }).length).toBeGreaterThan(0);

    const toggles = screen.getAllByRole("button", { name: TOGGLE });
    expect(toggles).toHaveLength(1);
    expect(toggles[0].closest("header")).not.toBeNull();
  });
});
