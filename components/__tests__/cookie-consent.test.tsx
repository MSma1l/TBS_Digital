import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { CONSENT_EVENT, CONSENT_KEY, getConsent, setConsent } from "@/lib/consent";
import {
  INTRO_COOKIE,
  INTRO_OVERLAY_ID,
  INTRO_TIMING,
  finishIntro,
  resetIntroForTests,
} from "@/lib/intro";
import { messages } from "@/lib/i18n/messages";

/*
 * The cookie-consent banner (components/ui/CookieConsent.tsx).
 *
 * Two contracts:
 *  - the banner itself: a non-modal labelled dialog that takes focus the moment it shows,
 *    Escape = essential only, the two buttons record their choice and broadcast it;
 *  - its timing: with no first-visit intro on the page it is on screen and focused in the
 *    same commit as always (the keyboard E2E specs Tab from it), and while the intro
 *    overlay is pending it waits for `finishIntro`, with a max-wait backstop that counts
 *    visible time only and never shows the banner under an intro that is still running;
 *  - Escape after an intro: a held key's repeats never answer, and right after an intro
 *    that PLAYED a quick second press is ignored for a moment (the buttons are not).
 *
 * "Pending" is the overlay root `#tbs-intro` in the document and no `finishIntro` yet
 * (lib/intro.ts), so the tests mount a bare element with that id. A bare root is one JS
 * never took over; `[data-live]` on it is the shell running the intro.
 */

const ro = messages.ro;
const MAX_WAIT_MS = INTRO_TIMING.WATCHDOG_MS + 1000;
/** CookieConsent's ESCAPE_GUARD_MS. */
const ESCAPE_GUARD_MS = 700;

function mountIntroOverlay({ live = false } = {}): HTMLElement {
  const el = document.createElement("div");
  el.id = INTRO_OVERLAY_ID;
  if (live) el.setAttribute("data-live", "");
  document.body.appendChild(el);
  return el;
}

const banner = () => screen.queryByRole("dialog", { name: ro["cookie.policyLink"] });

/** Fake timers with `performance` too: the Escape guard and the paused backstop read it. */
const fakeClock = () =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });

let visibility: DocumentVisibilityState = "visible";
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

const pressEscape = (init: { repeat?: boolean } = {}) =>
  fireEvent.keyDown(screen.getByRole("dialog", { name: ro["cookie.policyLink"] }), {
    key: "Escape",
    ...init,
  });

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
  window.localStorage.clear();
  document.cookie = `${CONSENT_KEY}=;path=/;max-age=0`;
  document.cookie = `${INTRO_COOKIE}=;path=/;max-age=0`;
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  resetIntroForTests();
});

afterEach(() => {
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  Reflect.deleteProperty(document, "visibilityState");
  vi.useRealTimers();
});

describe("CookieConsent — no intro on the page", () => {
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

    // No intro on this page: no guard either, the very next press answers.
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

describe("CookieConsent — behind the first-visit intro", () => {
  it("stays hidden while the intro is pending, then shows focused when it finishes", () => {
    mountIntroOverlay();
    render(<CookieConsent />);

    expect(banner()).toBeNull();
    expect(document.activeElement?.getAttribute("role")).not.toBe("dialog");

    act(() => finishIntro({ played: true }));

    const dialog = screen.getByRole("dialog", { name: ro["cookie.policyLink"] });
    expect(document.activeElement).toBe(dialog);
  });

  it("shows at once when the intro finished before the banner mounted (the effect-order race)", () => {
    // A synchronous bypass (reduced motion, a #hash link) finishes the intro in an effect that
    // runs BEFORE the banner's, while the overlay root is still in the DOM.
    mountIntroOverlay();
    finishIntro({ played: false });

    render(<CookieConsent />);

    expect(document.activeElement).toBe(
      screen.getByRole("dialog", { name: ro["cookie.policyLink"] }),
    );
  });

  it("never shows behind an intro when a choice is already stored", () => {
    setConsent("rejected");
    mountIntroOverlay();
    render(<CookieConsent />);

    act(() => finishIntro({ played: true }));

    expect(banner()).toBeNull();
  });

  it("gives up waiting at WATCHDOG_MS + 1s if the intro never reports back", () => {
    vi.useFakeTimers();
    mountIntroOverlay();
    render(<CookieConsent />);

    act(() => vi.advanceTimersByTime(MAX_WAIT_MS - 1));
    expect(banner()).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    const dialog = screen.getByRole("dialog", { name: ro["cookie.policyLink"] });
    expect(document.activeElement).toBe(dialog);
  });

  it("does not come back after the visitor answered: a late intro end is ignored", () => {
    vi.useFakeTimers();
    mountIntroOverlay();
    render(<CookieConsent />);

    act(() => vi.advanceTimersByTime(MAX_WAIT_MS));
    fireEvent.click(screen.getByRole("button", { name: ro["cookie.accept"] }));
    expect(banner()).toBeNull();

    act(() => finishIntro({ played: true }));
    expect(banner()).toBeNull();
  });

  it("does not come back after the visitor answered: the max-wait timer is cancelled", () => {
    fakeClock();
    mountIntroOverlay();
    render(<CookieConsent />);

    act(() => finishIntro({ played: true }));
    // Past the post-intro Escape guard (see "Escape right after the intro" below).
    act(() => vi.advanceTimersByTime(ESCAPE_GUARD_MS));
    fireEvent.keyDown(screen.getByRole("dialog", { name: ro["cookie.policyLink"] }), {
      key: "Escape",
    });
    expect(getConsent()).toBe("rejected");

    act(() => vi.advanceTimersByTime(MAX_WAIT_MS * 2));
    expect(banner()).toBeNull();
  });

  it("does not count time the tab spends hidden towards the backstop", () => {
    fakeClock();
    mountIntroOverlay();
    render(<CookieConsent />);

    act(() => vi.advanceTimersByTime(MAX_WAIT_MS - 1000));
    act(() => setVisibility("hidden"));
    // A background tab for a minute: the intro has not played for anyone yet.
    act(() => vi.advanceTimersByTime(60_000));
    expect(banner()).toBeNull();

    act(() => setVisibility("visible"));
    act(() => vi.advanceTimersByTime(999));
    expect(banner()).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(document.activeElement).toBe(
      screen.getByRole("dialog", { name: ro["cookie.policyLink"] }),
    );
  });

  it("never shows under an intro that is still running when the backstop fires", () => {
    fakeClock();
    mountIntroOverlay({ live: true });
    render(<CookieConsent />);

    act(() => vi.advanceTimersByTime(MAX_WAIT_MS * 3));
    expect(banner()).toBeNull();
    expect(document.activeElement?.getAttribute("role")).not.toBe("dialog");

    // The shell's watchdog (or the timeline) ends it: that event still brings the banner.
    act(() => finishIntro({ played: false }));
    expect(document.activeElement).toBe(
      screen.getByRole("dialog", { name: ro["cookie.policyLink"] }),
    );
  });

  it("leaves no timer or listener behind when it unmounts mid-intro", () => {
    vi.useFakeTimers();
    mountIntroOverlay();
    const { unmount } = render(<CookieConsent />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => act(() => finishIntro({ played: true }))).not.toThrow();
  });
});

describe("CookieConsent — Escape right after the intro", () => {
  it("ignores Escape for a moment after an intro that played, then answers to it", () => {
    fakeClock();
    mountIntroOverlay({ live: true });
    render(<CookieConsent />);

    act(() => finishIntro({ played: true }));
    expect(document.activeElement).toBe(
      screen.getByRole("dialog", { name: ro["cookie.policyLink"] }),
    );

    // The second tap of a double-tap skip.
    act(() => vi.advanceTimersByTime(200));
    pressEscape();
    expect(getConsent()).toBeNull();
    expect(banner()).not.toBeNull();

    act(() => vi.advanceTimersByTime(ESCAPE_GUARD_MS - 200 - 1));
    pressEscape();
    expect(getConsent()).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    pressEscape();
    expect(getConsent()).toBe("rejected");
    expect(banner()).toBeNull();
  });

  it("never treats a held Escape as an answer, however long it is held", () => {
    fakeClock();
    mountIntroOverlay({ live: true });
    render(<CookieConsent />);
    act(() => finishIntro({ played: true }));

    for (let i = 0; i < 20; i += 1) {
      act(() => vi.advanceTimersByTime(100));
      pressEscape({ repeat: true });
    }
    expect(getConsent()).toBeNull();
    expect(banner()).not.toBeNull();
  });

  it("keeps the buttons working at once after an intro that played", () => {
    fakeClock();
    mountIntroOverlay({ live: true });
    render(<CookieConsent />);
    act(() => finishIntro({ played: true }));

    fireEvent.click(screen.getByRole("button", { name: ro["cookie.accept"] }));
    expect(getConsent()).toBe("accepted");
    expect(banner()).toBeNull();
  });

  it("does not guard Escape after an intro that was bypassed (nothing played)", () => {
    fakeClock();
    mountIntroOverlay({ live: true });
    render(<CookieConsent />);

    act(() => finishIntro({ played: false }));
    pressEscape();

    expect(getConsent()).toBe("rejected");
    expect(banner()).toBeNull();
  });
});
