import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { navMenu } from "@/lib/content";
import { directionPaths } from "@/lib/directions";
import { messages } from "@/lib/i18n/messages";

/** Romanian is the source catalog and the fallback locale a bare render uses. */
const ro = messages.ro;

/**
 * The navbar as the app mounts it. `RequestFlowProvider` is not decoration: the red CTA —
 * in the bar and in the mobile overlay — opens the site's single shared request dialog
 * through `useRequestFlow()`, and `app/layout.tsx` mounts that provider above every page.
 */
function renderNav() {
  return render(
    <RequestFlowProvider>
      <Navbar />
    </RequestFlowProvider>,
  );
}

/**
 * The public navbar must never link to the admin panel. Such a button would publish the
 * admin's URL in the markup of every page — handing the path to anyone scraping the site
 * — and a visitor has no use for it. The admin types the URL. These tests exist so the
 * button can't quietly come back.
 */
describe("Navbar — the admin panel is not advertised", () => {
  it("renders no link to the admin panel", () => {
    renderNav();

    expect(screen.queryByText(/ADMIN/i)).toBeNull();
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("admin");
    }
  });

  it("renders no link to the admin panel in the mobile menu either", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: "Meniu" }));

    // The overlay really is open — otherwise this would pass vacuously.
    expect(screen.getAllByText(/Închide|×/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ADMIN/i)).toBeNull();
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("admin");
    }
  });

  /**
   * The navbar renders `navMenu` (the catalog-keyed, two-level menu), not the flat legacy
   * `navLinks` the footer still uses — so this asserts against the menu that is actually
   * on screen: the three top-level entries plus every dropdown child.
   */
  it("still renders the public navigation", () => {
    renderNav();

    for (const item of navMenu) {
      expect(screen.getAllByText(ro[item.key]).length).toBeGreaterThan(0);
      for (const child of item.children ?? []) {
        expect(screen.getAllByText(ro[child.key]).length).toBeGreaterThan(0);
      }
    }

    // Each top-level entry links where the menu says it does.
    for (const item of navMenu) {
      expect(document.querySelector(`a[href="${item.href}"]`)).not.toBeNull();
    }
  });
});

/**
 * Language and theme are *global preferences*, not navigation. They live in one group —
 * these tests hold that grouping in place, on the desktop bar and inside the mobile overlay.
 */
describe("Navbar — global preferences group", () => {
  it("wraps the language switcher and the theme toggle in a preferences group placed before the CTA", () => {
    renderNav();

    const prefs = screen.getByRole("group", { name: /Preferences/ });
    // The language control is inside the group, not loose in the nav — and the theme toggle
    // is its very next sibling.
    const languages = within(prefs).getByRole("group", { name: /Language/ });
    expect(languages.nextElementSibling).toBe(
      within(prefs).getByRole("button", { name: ro["theme.toggleAria"] }),
    );

    // The group sits between the nav links and the call to action. The CTA is a BUTTON,
    // not an anchor: it opens the request dialog in place, so it carries no `#contact`
    // href that would scroll the page out from under the dialog at the same time.
    const cta = prefs.nextElementSibling as HTMLElement | null;
    expect(cta?.tagName).toBe("BUTTON");
    expect(cta?.getAttribute("href")).toBeNull();
    expect(cta?.textContent).toBe(ro["nav.cta"]);
  });

  /**
   * The group lives in the bar, which is visible at every width — so the mobile overlay
   * must NOT carry a second copy: that would put the same language and theme controls on
   * screen twice. Opening the menu changes nothing about where the preferences are.
   */
  it("keeps a single preferences group — in the bar — when the mobile menu is open", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: "Meniu" }));

    // The overlay really is open — otherwise this would pass vacuously.
    expect(screen.getAllByText(/Închide|×/).length).toBeGreaterThan(0);

    const groups = screen.getAllByRole("group", { name: /Preferences/ });
    expect(groups.length).toBe(1);

    const prefs = groups[0];
    expect(prefs.closest("header")).not.toBeNull();
    expect(within(prefs).getByRole("group", { name: /Language/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: ro["theme.toggleAria"] })).toHaveLength(1);
  });
});

/**
 * The switcher in the header is ONE button showing the language in force, which opens the
 * three choices. Tab reaches the button (and only the button — the choices are not stops in
 * the page's tab order), each choice is named in its own language, `aria-pressed` says which
 * one is on, and picking one swaps the whole header's copy.
 */
describe("LanguageSwitcher — keyboard and labels", () => {
  const langButton = () =>
    within(screen.getByRole("group", { name: "Limbă / Язык / Language" })).getByRole("button", {
      expanded: false,
    });

  it("shows the active language on one button, with the choices closed", () => {
    renderNav();

    const button = langButton();
    expect(button).toHaveTextContent("RO");
    expect(button).toHaveAccessibleName(`${ro["nav.langChange"]}: Română`);
    expect(screen.queryByRole("button", { name: "Русский" })).toBeNull();
  });

  it("labels each choice with the language's own name and marks the active one", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(langButton());
    expect(screen.getByRole("button", { name: "Română" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Русский" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is reachable by Tab before the CTA", async () => {
    const user = userEvent.setup();
    renderNav();

    const button = langButton();
    const cta = screen.getAllByRole("button", { name: ro["nav.cta"] })[0];

    const order: Element[] = [];
    for (let i = 0; i < 25; i += 1) {
      await user.tab();
      const active = document.activeElement;
      if (!active || active === document.body) break;
      order.push(active);
      if (active === cta) break;
    }

    expect(order).toContain(button);
    expect(order.indexOf(button)).toBeLessThan(order.indexOf(cta));
  });

  it("switches language from the keyboard: open, walk, Enter", async () => {
    const user = userEvent.setup();
    // A real provider: `renderNav()` relies on the context default, whose setLocale is a no-op.
    render(
      <LanguageProvider initialLocale="ro">
        <RequestFlowProvider>
          <Navbar />
        </RequestFlowProvider>
      </LanguageProvider>,
    );

    langButton().focus();
    await user.keyboard("{ArrowDown}"); // opens, focus on Română
    await user.keyboard("{End}"); // English
    await user.keyboard("{Enter}");

    // Closed again, focus back on the button, which now reads EN.
    const button = langButton();
    expect(button).toHaveTextContent("EN");
    expect(document.activeElement).toBe(button);
    // The catalog really swapped — the nav now reads in English.
    expect(screen.getAllByText(messages.en["nav.services"]).length).toBeGreaterThan(0);
  });
});

/**
 * Dead menu links — the regression this guards against.
 *
 * The Services submenu used to list four anchors (`#servicii-web`, `#servicii-apps`,
 * `#servicii-automation`, `#servicii-custom`) that no component ever rendered, so all four
 * items silently did nothing. Nothing in the build or the type system catches that: an
 * anchor to a missing id is valid HTML that simply goes nowhere.
 */
describe("every menu destination is real", () => {
  it("points the Services submenu at the actual direction pages", () => {
    const services = navMenu.find((i) => i.key === "nav.services");
    const hrefs = services?.children?.map((c) => c.href) ?? [];
    expect(hrefs).toEqual(directionPaths());
  });

  it("has no invented #servicii-* anchor left anywhere in the menu", () => {
    const all = navMenu.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]);
    expect(all.filter((h) => /^#servicii-/.test(h))).toEqual([]);
  });

  it("uses only real routes or same-page anchors — never a bare empty href", () => {
    const all = navMenu.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]);
    for (const href of all) {
      expect(href, "an empty href is a dead control").not.toBe("");
      expect(href.startsWith("/") || href.startsWith("#")).toBe(true);
    }
  });
});
