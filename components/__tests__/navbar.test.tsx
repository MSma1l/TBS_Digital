import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { navMenu } from "@/lib/content";
import { directionPaths } from "@/lib/directions";
import { messages } from "@/lib/i18n/messages";

/** Romanian is the source catalog and the fallback locale a bare render uses. */
const ro = messages.ro;

/**
 * The public navbar must never link to the admin panel. Such a button would publish the
 * admin's URL in the markup of every page — handing the path to anyone scraping the site
 * — and a visitor has no use for it. The admin types the URL. These tests exist so the
 * button can't quietly come back.
 */
describe("Navbar — the admin panel is not advertised", () => {
  it("renders no link to the admin panel", () => {
    render(<Navbar />);

    expect(screen.queryByText(/ADMIN/i)).toBeNull();
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("admin");
    }
  });

  it("renders no link to the admin panel in the mobile menu either", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

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
    render(<Navbar />);

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
 * Language (and, later, theme) are *global preferences*, not navigation. They live in one
 * group so the theme toggle can join without rearranging the header — these tests hold
 * that grouping in place, on the desktop bar and inside the mobile overlay.
 */
describe("Navbar — global preferences group", () => {
  it("wraps the language switcher in a preferences group placed before the CTA", () => {
    render(<Navbar />);

    const prefs = screen.getByRole("group", { name: /Preferences/ });
    // The language control is inside the group, not loose in the nav.
    expect(within(prefs).getByRole("group", { name: /Language/ })).toBeTruthy();

    // The group sits between the nav links and the call to action.
    const cta = prefs.nextElementSibling as HTMLElement | null;
    expect(cta?.tagName).toBe("A");
    expect(cta?.getAttribute("href")).toBe("#contact");
  });

  /**
   * The group lives in the bar, which is visible at every width — so the mobile overlay
   * must NOT carry a second copy: that would put the same language and theme controls on
   * screen twice. Opening the menu changes nothing about where the preferences are.
   */
  it("keeps a single preferences group — in the bar — when the mobile menu is open", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Meniu" }));

    // The overlay really is open — otherwise this would pass vacuously.
    expect(screen.getAllByText(/Închide|×/).length).toBeGreaterThan(0);

    const groups = screen.getAllByRole("group", { name: /Preferences/ });
    expect(groups.length).toBe(1);

    const prefs = groups[0];
    expect(prefs.closest("header")).not.toBeNull();
    expect(within(prefs).getByRole("group", { name: /Language/ })).toBeTruthy();
  });
});

/**
 * The switcher is three real buttons: Tab reaches each one, the accessible name is the
 * language's own name, and `aria-pressed` says which one is on. Arrow keys move focus
 * inside the group the way a segmented control should — without switching silently.
 */
describe("LanguageSwitcher — keyboard and labels", () => {
  const options = () => [
    screen.getAllByRole("button", { name: "Română" })[0],
    screen.getAllByRole("button", { name: "Русский" })[0],
    screen.getAllByRole("button", { name: "English" })[0],
  ];

  it("labels each option with the language's own name and marks the active one", () => {
    render(<Navbar />);

    const [roBtn, ruBtn, enBtn] = options();
    expect(roBtn).toHaveAttribute("aria-pressed", "true");
    expect(ruBtn).toHaveAttribute("aria-pressed", "false");
    expect(enBtn).toHaveAttribute("aria-pressed", "false");
    expect(roBtn).toHaveTextContent("RO");
  });

  it("is reachable by Tab, in order, before the CTA", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const [roBtn, ruBtn, enBtn] = options();
    const cta = screen.getAllByRole("link", { name: ro["nav.cta"] })[0];

    const order: Element[] = [];
    for (let i = 0; i < 25; i += 1) {
      await user.tab();
      const active = document.activeElement;
      if (!active || active === document.body) break;
      order.push(active);
      if (active === cta) break;
    }

    expect(order).toContain(roBtn);
    expect(order.indexOf(roBtn)).toBeLessThan(order.indexOf(ruBtn));
    expect(order.indexOf(ruBtn)).toBeLessThan(order.indexOf(enBtn));
    expect(order.indexOf(enBtn)).toBeLessThan(order.indexOf(cta));
  });

  it("moves focus with the arrow keys and Home/End, without switching language", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    const [roBtn, ruBtn, enBtn] = options();
    roBtn.focus();

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(ruBtn);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(enBtn);
    await user.keyboard("{ArrowRight}"); // wraps
    expect(document.activeElement).toBe(roBtn);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(enBtn);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(roBtn);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(enBtn);

    // Moving focus is not choosing: Romanian is still the pressed option.
    expect(roBtn).toHaveAttribute("aria-pressed", "true");
    expect(enBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("switches language when an option is activated from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider initialLocale="ro">
        <Navbar />
      </LanguageProvider>,
    );

    const enBtn = screen.getAllByRole("button", { name: "English" })[0];
    enBtn.focus();
    await user.keyboard("{Enter}");

    expect(enBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: "Română" })[0]).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
