import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { CONSENT_EVENT, CONSENT_KEY, getConsent, setConsent } from "@/lib/consent";
import { messages } from "@/lib/i18n/messages";

/*
 * The cookie-consent banner (components/ui/CookieConsent.tsx): a non-modal labelled dialog
 * that is on screen and focused in the same commit it renders (the keyboard E2E specs Tab
 * from it), Escape = essential only (a held key's repeats never answer), and the two buttons
 * record their choice and broadcast it.
 */

const ro = messages.ro;

const banner = () => screen.queryByRole("dialog", { name: ro["cookie.policyLink"] });

const pressEscape = (init: { repeat?: boolean } = {}) =>
  fireEvent.keyDown(screen.getByRole("dialog", { name: ro["cookie.policyLink"] }), {
    key: "Escape",
    ...init,
  });

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = `${CONSENT_KEY}=;path=/;max-age=0`;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CookieConsent", () => {
  it("is on screen and focused as soon as it has rendered, with no extra tick", () => {
    render(<CookieConsent />);

    // No `await` / `findBy` on purpose: this pins "shows in the mount effect".
    const dialog = screen.getByRole("dialog", { name: ro["cookie.policyLink"] });
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(dialog);
  });

  it("focuses without scrolling the page", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<CookieConsent />);

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("links to the cookie policy", () => {
    render(<CookieConsent />);

    expect(screen.getByRole("link", { name: ro["cookie.policyLink"] })).toHaveAttribute(
      "href",
      "/cookies",
    );
  });

  it("Escape records essential-only and closes it", async () => {
    const user = userEvent.setup();
    render(<CookieConsent />);

    await user.keyboard("{Escape}");

    expect(getConsent()).toBe("rejected");
    expect(banner()).toBeNull();
  });

  it("ignores the repeats of a held Escape, and still answers to a real press", () => {
    render(<CookieConsent />);

    pressEscape({ repeat: true });
    expect(getConsent()).toBeNull();
    expect(banner()).not.toBeNull();

    // No guard: the very next press answers.
    pressEscape();
    expect(getConsent()).toBe("rejected");
    expect(banner()).toBeNull();
  });

  it.each([
    [ro["cookie.settings"], "rejected"],
    [ro["cookie.accept"], "accepted"],
  ] as const)("the %s button records %s and broadcasts it", async (label, value) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const listener = (event: Event) => onChange((event as CustomEvent).detail);
    window.addEventListener(CONSENT_EVENT, listener);
    try {
      render(<CookieConsent />);
      await user.click(screen.getByRole("button", { name: label }));

      expect(getConsent()).toBe(value);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(value);
      expect(banner()).toBeNull();
    } finally {
      window.removeEventListener(CONSENT_EVENT, listener);
    }
  });

  it("never shows once a choice is stored", () => {
    setConsent("accepted");
    render(<CookieConsent />);

    expect(banner()).toBeNull();
  });
});
