import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { BAR_CLOCK_QUERY, HeaderClock } from "@/components/layout/HeaderClock";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { messages } from "@/lib/i18n/messages";

/*
 * The header's SYS_TIME clock (components/layout/HeaderClock.tsx).
 *
 * What is pinned here is what the rest of the site leans on:
 *  · the server renders the placeholder, so hydration never mismatches on a live time;
 *  · after mount it shows Chișinău time and ticks (lib/clock.ts owns the maths — see
 *    lib/__tests__/clock.test.ts — this only proves the component is wired to the store);
 *  · it is decorative: aria-hidden, and nothing inside can take focus. The header's Tab
 *    budget (navbar.test.tsx, theme-toggle.test.tsx: ≤25; keyboard.spec.ts: ≤40) depends on it;
 *  · unmounting stops the shared interval, so no test (and no page) leaks a timer;
 *  · the bar clock only ticks where it is on screen (its media query matches), so phones and
 *    the 861–1024 band run no interval for a readout that is `display: none`.
 *
 * vitest.setup.ts stubs `matchMedia` as "never matches", which would read as "the bar clock
 * is hidden" everywhere; each case below says which side of the query the window is on.
 */

const VARIANTS = ["bar", "menu"] as const;

const realMatchMedia = window.matchMedia;

/**
 * Replace `matchMedia` with one where BAR_CLOCK_QUERY matches or not, switchable at run
 * time: `resize(true)` flips it and fires `change` the way a real resize would.
 */
function mockBarQuery(initiallyVisible: boolean) {
  let visible = initiallyVisible;
  const listeners = new Set<() => void>();
  const queries: string[] = [];
  window.matchMedia = ((query: string) => {
    queries.push(query);
    return {
      get matches() {
        return query === BAR_CLOCK_QUERY && visible;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
  }) as unknown as typeof window.matchMedia;
  return {
    queries,
    listeners,
    resize(nowVisible: boolean) {
      visible = nowVisible;
      act(() => listeners.forEach((cb) => cb()));
    },
  };
}

/** The clock's root element (the component renders exactly one). */
const clockRoot = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe("HeaderClock — server render", () => {
  for (const variant of VARIANTS) {
    it(`renders the --:--:-- placeholder, never a real time (${variant})`, () => {
      const html = renderToString(<HeaderClock variant={variant} />);

      expect(html).toContain("--:--:--");
      expect(html).toContain(messages.ro["header.sysTime"]);
      expect(html).not.toMatch(/\d\d:\d\d:\d\d/);
    });
  }
});

describe("HeaderClock — live", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    // Summer: Chișinău is UTC+3, so 09:04:08Z reads 12:04:08 whatever TZ the test runs in.
    vi.setSystemTime(new Date("2026-07-15T09:04:08Z"));
    // A width where the bar clock is on screen (≥1025px).
    mockBarQuery(true);
  });

  afterEach(() => {
    // Unmount while the fake clock is still installed, so the store clears the fake interval.
    cleanup();
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });

  it("shows HH:MM:SS with the zone's offset after mount, and ticks", () => {
    const { container } = render(<HeaderClock />);
    const root = clockRoot(container);

    expect(root.textContent).toMatch(/\d\d:\d\d:\d\d/);
    expect(screen.getByText("12:04:08")).toBeInTheDocument();
    expect(screen.getByText("UTC+3")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("12:04:09")).toBeInTheDocument();
    expect(root.textContent).not.toContain("--:--:--");
  });

  it("labels the readout from the message catalog, in the visitor's language", () => {
    render(
      <LanguageProvider initialLocale="en">
        <HeaderClock variant="menu" />
      </LanguageProvider>,
    );
    expect(screen.getByText(messages.en["header.sysTime"])).toBeInTheDocument();
  });

  for (const variant of VARIANTS) {
    it(`is decorative: aria-hidden, with nothing focusable inside (${variant})`, () => {
      const { container } = render(<HeaderClock variant={variant} />);
      const root = clockRoot(container);

      expect(root).toHaveAttribute("aria-hidden", "true");
      expect(root).not.toHaveAttribute("tabindex");
      expect(
        root.querySelector("a, button, input, select, textarea, [tabindex], [role]"),
      ).toBeNull();
    });
  }

  it("stops its interval when the last clock unmounts", () => {
    const { unmount } = render(<HeaderClock />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one interval between the bar clock and the menu clock", () => {
    const { unmount } = render(
      <>
        <HeaderClock variant="bar" />
        <HeaderClock variant="menu" />
      </>,
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("HeaderClock — ticks only where it is on screen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-07-15T09:04:08Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = realMatchMedia;
  });

  it("asks exactly for the widths the bar's classes show it at (641–860, from 1025)", () => {
    const media = mockBarQuery(true);
    render(<HeaderClock variant="bar" />);

    expect(BAR_CLOCK_QUERY).toBe("(min-width: 641px) and (max-width: 860px), (min-width: 1025px)");
    expect(media.queries).toContain(BAR_CLOCK_QUERY);
  });

  it("bar, where it is hidden (phones, 861–1024): the placeholder, and no interval at all", () => {
    mockBarQuery(false);
    const { container } = render(<HeaderClock variant="bar" />);
    const root = clockRoot(container);

    expect(root.textContent).toContain("--:--:--");
    expect(root.textContent).not.toMatch(/\d\d:\d\d:\d\d/);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(root.textContent).toContain("--:--:--");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bar: starts ticking when the window grows into a width that shows it, and stops again", () => {
    const media = mockBarQuery(false);
    const { container } = render(<HeaderClock variant="bar" />);
    const root = clockRoot(container);
    expect(media.listeners.size).toBe(1);

    media.resize(true);
    expect(screen.getByText("12:04:08")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("12:04:09")).toBeInTheDocument();

    media.resize(false);
    expect(root.textContent).toContain("--:--:--");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("menu: always ticks — it only exists while the burger overlay is open", () => {
    mockBarQuery(false);
    render(<HeaderClock variant="menu" />);

    expect(screen.getByText("12:04:08")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("12:04:09")).toBeInTheDocument();
  });

  it("stops listening to the media query when it unmounts", () => {
    const media = mockBarQuery(true);
    const { unmount } = render(<HeaderClock variant="bar" />);
    expect(media.listeners.size).toBe(1);

    unmount();
    expect(media.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats an engine without matchMedia as 'on screen' and ticks", () => {
    // @ts-expect-error — simulating an environment that has no matchMedia at all
    window.matchMedia = undefined;
    render(<HeaderClock variant="bar" />);

    expect(screen.getByText("12:04:08")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
  });
});

/*
 * jsdom has no layout, so the width table cannot be measured here (e2e does that). What can
 * be pinned is the table itself, as the breakpoint utilities that implement it:
 *   bar  — hidden <641, short 641–860, hidden 861–1024, short 1025–1179, full ≥1180;
 *   menu — shown in the burger overlay only below 641 (above it the bar carries the clock).
 */
describe("HeaderClock — where it shows", () => {
  const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

  it("bar: hidden on phones and in the tight desktop band, label only at xl", () => {
    const { container } = render(<HeaderClock variant="bar" />);
    const root = clockRoot(container);
    expect(classesOf(root)).toEqual(
      expect.arrayContaining(["hidden", "sm:flex", "md:hidden", "lg:flex"]),
    );

    const label = screen.getByText(messages.ro["header.sysTime"]);
    expect(classesOf(label)).toEqual(expect.arrayContaining(["hidden", "xl:inline"]));
  });

  it("menu: full readout on phones, hidden from 641px", () => {
    const { container } = render(<HeaderClock variant="menu" />);
    const root = clockRoot(container);
    expect(classesOf(root)).toContain("sm:hidden");
    expect(classesOf(root)).not.toContain("hidden");

    const label = screen.getByText(messages.ro["header.sysTime"]);
    expect(classesOf(label)).not.toContain("hidden");
  });
});
