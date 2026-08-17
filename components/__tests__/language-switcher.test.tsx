import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher, COMPACT_MAX_WIDTH } from "@/components/ui/LanguageSwitcher";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { LOCALE_LABELS } from "@/lib/i18n/locales";

/*
 * The language switcher changes SHAPE with the viewport, and that is what these tests are
 * about — `components/__tests__/navbar.test.tsx` already covers the segmented control as it
 * appears in the header at a normal width.
 *
 * At or below COMPACT_MAX_WIDTH the header cannot hold three 44px language buttons next to the theme
 * toggle, the sound toggle and the burger: the document measured 361px inside a 320px
 * viewport. The control collapses to ONE 44×44 button plus a popup — and, critically, only
 * one of the two shapes is ever in the DOM, because two would mean two language controls in
 * the accessibility tree and two matches for every `getByRole` in this suite.
 *
 * jsdom has no layout, so "the viewport is narrow" is exactly what the component asks: a
 * `matchMedia("(max-width: <COMPACT_MAX_WIDTH>px)")` query, stubbed here. `vitest.setup.ts` installs a
 * matchMedia that always answers `false`, which is why every other test file (and the first
 * describe below) sees the segmented control without doing anything.
 */

const realMatchMedia = window.matchMedia;

/** Answer `matches` for the compact query, `false` for anything else the tree may ask. */
function stubViewport(compact: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: compact && query.includes(`${COMPACT_MAX_WIDTH}px`),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const renderSwitcher = (locale: "ro" | "ru" | "en" = "ro") =>
  render(
    <LanguageProvider initialLocale={locale}>
      <LanguageSwitcher />
    </LanguageProvider>,
  );

/** The group label is the same in both shapes, so assistive tech and the E2E locators keep
 *  one stable target across the breakpoint. */
const group = () => screen.getByRole("group", { name: "Limbă / Язык / Language" });

const trigger = () => within(group()).getByRole("button", { expanded: false });

describe("LanguageSwitcher — above the compact breakpoint", () => {
  beforeEach(() => stubViewport(false));

  it("renders the segmented control: three options, each labelled in its own language", () => {
    renderSwitcher();

    const options = within(group()).getAllByRole("button");
    expect(options).toHaveLength(3);
    expect(options.map((b) => b.getAttribute("aria-label"))).toEqual([
      LOCALE_LABELS.ro,
      LOCALE_LABELS.ru,
      LOCALE_LABELS.en,
    ]);
    expect(options[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("has no popup trigger — nothing to expand at this width", () => {
    renderSwitcher();
    expect(within(group()).queryByRole("button", { expanded: false })).toBeNull();
    expect(document.querySelector("[aria-haspopup]")).toBeNull();
  });
});

describe("LanguageSwitcher — the compact control (narrow phones)", () => {
  beforeEach(() => stubViewport(true));

  it("collapses to ONE button showing the active language, with the choices closed", () => {
    renderSwitcher();

    // One control in the DOM, not two with one hidden: the segmented options are absent
    // entirely rather than merely invisible.
    const buttons = within(group()).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    for (const label of Object.values(LOCALE_LABELS)) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }

    const button = buttons[0];
    expect(button).toHaveTextContent("RO");
    expect(button).toHaveAttribute("aria-haspopup", "true");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  /* The label has to say what the button DOES, not only which language is on — "RU" alone
     reads as a state, not a control — and it has to say it in the visitor's language. */
  it("labels the button in Russian when Russian is the language in force", () => {
    renderSwitcher("ru");
    expect(trigger()).toHaveAccessibleName("Сменить язык: Русский");
  });

  it("labels the button in English when English is the language in force", () => {
    renderSwitcher("en");
    expect(trigger()).toHaveAccessibleName("Change language: English");
  });

  it("opens on click, offers all three languages, and marks the active one", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());

    const button = within(group()).getByRole("button", { expanded: true });
    expect(button).toHaveAttribute("aria-expanded", "true");

    for (const [code, label] of Object.entries(LOCALE_LABELS)) {
      const option = screen.getByRole("button", { name: label });
      expect(option).toHaveAttribute("aria-pressed", String(code === "ro"));
    }
  });

  it("moves focus to the language in force when it opens", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");

    await user.click(screen.getByRole("button", { name: /English$/ }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "English" }));
  });

  it("switches language, closes, and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());
    await user.click(screen.getByRole("button", { name: "Русский" }));

    // Closed again, with the new language on the button — and its label now in Russian.
    const button = within(group()).getByRole("button", { expanded: false });
    expect(button).toHaveTextContent("RU");
    expect(button).toHaveAccessibleName("Сменить язык: Русский");
    expect(screen.queryByRole("button", { name: "Русский" })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on Escape and returns focus to the button", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
    const button = within(group()).getByRole("button", { expanded: false });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
  });

  it("closes when something outside it is pressed", async () => {
    const user = userEvent.setup();
    stubViewport(true);
    render(
      <LanguageProvider initialLocale="ro">
        <LanguageSwitcher />
        <button type="button">altundeva</button>
      </LanguageProvider>,
    );

    await user.click(within(group()).getByRole("button", { expanded: false }));
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "altundeva" }));

    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
  });

  it("clicking the button again closes the choices", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());
    await user.click(within(group()).getByRole("button", { expanded: true }));

    expect(screen.queryByRole("button", { name: "English" })).toBeNull();
  });

  it("opens with the arrow keys from the button", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    trigger().focus();
    await user.keyboard("{ArrowDown}");

    expect(within(group()).getByRole("button", { expanded: true })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Română" }));
  });

  /**
   * Arrow keys rather than Tab *between* the options, for the same reason the segmented
   * control uses them: the three choices are one control, not three stops in the page's tab
   * order. Moving focus must never be a silent language change.
   */
  it("walks the choices with the arrows and Home/End, without switching language", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());
    const ro = screen.getByRole("button", { name: "Română" });
    const ru = screen.getByRole("button", { name: "Русский" });
    const en = screen.getByRole("button", { name: "English" });

    expect(document.activeElement).toBe(ro);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(ru);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(en);
    await user.keyboard("{ArrowDown}"); // wraps
    expect(document.activeElement).toBe(ro);
    await user.keyboard("{ArrowUp}"); // wraps back
    expect(document.activeElement).toBe(en);

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(ro);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(en);

    expect(ro).toHaveAttribute("aria-pressed", "true");
    expect(en).toHaveAttribute("aria-pressed", "false");
  });

  it("picks the focused language with Enter", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(trigger());
    await user.keyboard("{End}");
    await user.keyboard("{Enter}");

    const button = within(group()).getByRole("button", { expanded: false });
    expect(button).toHaveTextContent("EN");
    expect(button).toHaveAccessibleName("Change language: English");
  });
});
