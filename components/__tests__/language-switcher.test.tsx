import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { LOCALE_LABELS } from "@/lib/i18n/locales";
import { messages } from "@/lib/i18n/messages";

/*
 * The language switcher is ONE shape at every width: a button showing the active language
 * that opens the three choices. `components/__tests__/navbar.test.tsx` covers it as it sits
 * in the header; this file covers the control's own contract — what is in the DOM closed and
 * open, the labels, the keyboard, and every way the popup closes.
 *
 * It used to switch to a segmented RO | RU | EN control above 400px, chosen from a
 * `matchMedia` query; that shape is gone, so nothing here stubs the viewport.
 */

const renderSwitcher = (locale: "ro" | "ru" | "en" = "ro") =>
  render(
    <LanguageProvider initialLocale={locale}>
      <LanguageSwitcher />
    </LanguageProvider>,
  );

/** The group label is trilingual and fixed, so assistive tech and the E2E locators keep one
 *  stable target whatever language is in force. */
const group = () => screen.getByRole("group", { name: "Limbă / Язык / Language" });

const trigger = () => within(group()).getByRole("button", { expanded: false });

describe("LanguageSwitcher — the dropdown", () => {
  it("collapses to ONE button showing the active language, with the choices closed", () => {
    renderSwitcher();

    // Closed, the choices are absent from the DOM entirely, not merely invisible — so the
    // page has exactly one language button in its tab order and accessibility tree.
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
   * Arrow keys rather than Tab *between* the options: the three choices are one control, not
   * three stops in the page's tab order. Moving focus must never be a silent language change.
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

  /* The trigger names its popup only while there is one to name, and the id it points at is
     the element holding the choices. */
  it("points aria-controls at the open list, and drops it when closed", async () => {
    const user = userEvent.setup();
    renderSwitcher();

    expect(trigger()).not.toHaveAttribute("aria-controls");
    await user.click(trigger());

    const button = within(group()).getByRole("button", { expanded: true });
    const id = button.getAttribute("aria-controls");
    expect(id).toBeTruthy();
    const list = document.getElementById(id!);
    expect(list).not.toBeNull();
    expect(within(list!).getAllByRole("button")).toHaveLength(3);
  });

  /* Each row shows the short code AND the language's own name, so a visitor who does not
     read the language in force can still find theirs. */
  it("shows each language's code and native name in the list", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");
    await user.click(trigger());

    expect(screen.getByRole("button", { name: "Русский" })).toHaveTextContent("RUРусский");
    expect(screen.getByRole("button", { name: "Română" })).toHaveTextContent("RORomână");
  });

  /* The label comes from the message catalog, so it exists in all three languages. */
  it("takes the button's label from the catalog in every language", () => {
    for (const locale of ["ro", "ru", "en"] as const) {
      const { unmount } = renderSwitcher(locale);
      expect(trigger()).toHaveAccessibleName(
        `${messages[locale]["nav.langChange"]}: ${LOCALE_LABELS[locale]}`,
      );
      unmount();
    }
  });

  /* Escape closes the popup and stops there: the burger overlay behind the header listens
     for Escape too, and one press must not close both. */
  it("does not let the Escape that closes it reach the page", async () => {
    const user = userEvent.setup();
    let reached = 0;
    const onKeyDown = (event: { key: string }) => {
      if (event.key === "Escape") reached += 1;
    };
    render(
      <LanguageProvider initialLocale="ro">
        <div onKeyDown={onKeyDown}>
          <LanguageSwitcher />
        </div>
      </LanguageProvider>,
    );

    await user.click(trigger());
    await user.keyboard("{Escape}");
    expect(reached).toBe(0);

    // Closed, Escape is not the switcher's to consume.
    await user.keyboard("{Escape}");
    expect(reached).toBe(1);
  });
});
