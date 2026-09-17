import { describe, expect, it } from "vitest";
import { act, createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { shouldInterceptTap } from "@/lib/tapIntent";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { navMenu } from "@/lib/content";
import { messages } from "@/lib/i18n/messages";

/*
 * The HUD header's menus: the burger overlay (phones and tablets) and the desktop dropdowns.
 *
 * navbar.test.tsx pins WHAT the header contains; this file pins how the two menus behave —
 * where focus goes, how each one is dismissed, and what a finger does on a dropdown that a
 * mouse would simply hover. jsdom has no layout, so every width-dependent rule (the overlay
 * only below 861px, the dropdown only above) is not in play here: both menus are in the DOM.
 */

const ro = messages.ro;

function renderNav() {
  return render(
    <RequestFlowProvider>
      <Navbar />
      {/* something focusable outside the header, for the "focus left the menu" cases */}
      <button type="button">outside</button>
    </RequestFlowProvider>,
  );
}

const burger = () => screen.getByRole("button", { name: ro["nav.burgerAria"] });
const closeButton = () => screen.queryByRole("button", { name: ro["nav.closeAria"] });
const primaryNav = () => screen.getByRole("navigation", { name: ro["nav.primaryAria"] });

/** The desktop top-level link for a menu item (the overlay, when open, has its own). */
const topLink = (key: (typeof navMenu)[number]["key"]) =>
  within(primaryNav()).getByRole("link", { name: ro[key] });

const menuItemOf = (link: HTMLElement) => link.closest("[data-menu-item]") as HTMLElement;

/**
 * A tap: `pointerdown` carrying a pointer type, then the click it produces. jsdom 25 has no
 * PointerEvent, so testing-library falls back to a plain Event and drops `pointerType` — it
 * is defined on the event by hand, which is what React reads it from.
 * Returns what `dispatchEvent` returns for the click: `false` when it was default-prevented.
 */
function press(el: HTMLElement, pointerType: "touch" | "pen" | "mouse"): boolean {
  const down = createEvent.pointerDown(el);
  Object.defineProperty(down, "pointerType", { value: pointerType });
  fireEvent(el, down);
  return fireEvent.click(el);
}

/**
 * The pointer arriving over an element. React builds `onPointerEnter` from the native
 * `pointerover` (relatedTarget null = from outside the page), and — as in `press` — jsdom
 * drops `pointerType`, so it is defined by hand.
 */
function pointerEnter(el: HTMLElement, pointerType: "touch" | "pen" | "mouse") {
  const over = createEvent.pointerOver(el);
  Object.defineProperty(over, "pointerType", { value: pointerType });
  fireEvent(el, over);
}

describe("burger overlay — focus and dismissal", () => {
  it("opens with focus on the visible × close button", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(burger());

    const close = closeButton();
    expect(close).not.toBeNull();
    expect(close).toHaveTextContent("×");
    expect(document.activeElement).toBe(close);
  });

  it("closes on Escape and hands focus back to the burger", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(burger());
    await user.keyboard("{Escape}");

    expect(closeButton()).toBeNull();
    expect(burger()).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(burger());
  });

  it("ignores an Escape that something inside already handled (the compact language popup)", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(burger());

    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    act(() => {
      closeButton()!.dispatchEvent(handled);
    });

    expect(closeButton()).not.toBeNull();
  });

  it("closes from the × and hands focus back to the burger", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(burger());
    await user.click(closeButton()!);

    expect(closeButton()).toBeNull();
    expect(document.activeElement).toBe(burger());
  });

  it("keeps its label while open, and points aria-controls at the overlay nav only while open", async () => {
    const user = userEvent.setup();
    renderNav();

    expect(burger()).not.toHaveAttribute("aria-controls");
    expect(burger()).toHaveAttribute("aria-expanded", "false");

    await user.click(burger());

    // Still found by its closed-state name: the label never turns into "Închide".
    const controls = burger().getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    const overlayNav = document.getElementById(controls!);
    expect(overlayNav?.tagName).toBe("NAV");
    expect(overlayNav).toContainElement(closeButton());
    expect(burger()).toHaveAttribute("aria-expanded", "true");

    await user.click(burger());

    expect(closeButton()).toBeNull();
    expect(burger()).not.toHaveAttribute("aria-controls");
  });

  it("numbers the large links without putting the number in their names", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(burger());

    const overlayNav = document.getElementById(burger().getAttribute("aria-controls")!)!;
    navMenu.forEach((item, i) => {
      const label = ro[item.key];
      const name = label.charAt(0) + label.slice(1).toLowerCase();
      const link = within(overlayNav).getByRole("link", { name });
      expect(link).toHaveAttribute("href", item.href);

      const number = within(link).getByText(String(i + 1).padStart(2, "0"));
      expect(number).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("locks page scrolling while open and restores it on close", async () => {
    const user = userEvent.setup();
    renderNav();
    const root = document.documentElement;
    const before = root.style.overflow;

    await user.click(burger());
    expect(root.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(root.style.overflow).toBe(before);
  });

  it("closes when focus leaves both the overlay and the header, and only then", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(burger());

    const close = closeButton()!;
    const logo = screen.getAllByRole("link")[0];

    // Inside the header: still open.
    fireEvent.focusOut(close, { relatedTarget: logo });
    expect(closeButton()).not.toBeNull();

    // Nowhere the browser can name (window blur, an iOS tap): still open.
    fireEvent.focusOut(close, { relatedTarget: null });
    expect(closeButton()).not.toBeNull();

    // Out of both: closed.
    fireEvent.focusOut(close, {
      relatedTarget: screen.getByRole("button", { name: "outside" }),
    });
    expect(closeButton()).toBeNull();
  });

  it("closes on an anchor link without moving focus to the burger", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(burger());

    const overlayNav = document.getElementById(burger().getAttribute("aria-controls")!)!;
    const label = ro["nav.about"];
    await user.click(
      within(overlayNav).getByRole("link", { name: label.charAt(0) + label.slice(1).toLowerCase() }),
    );

    expect(closeButton()).toBeNull();
    expect(document.activeElement).not.toBe(burger());
  });

  it("closes when the viewport grows into the desktop layout", async () => {
    const realMatchMedia = window.matchMedia;
    const listeners = new Set<() => void>();
    let desktop = false;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query === "(min-width: 861px)" && desktop;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, cb: () => void) => {
        if (query === "(min-width: 861px)") listeners.add(cb);
      },
      removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    try {
      const user = userEvent.setup();
      renderNav();
      await user.click(burger());
      expect(listeners.size).toBe(1);

      desktop = true;
      act(() => listeners.forEach((cb) => cb()));

      expect(closeButton()).toBeNull();
      expect(listeners.size).toBe(0);
    } finally {
      window.matchMedia = realMatchMedia;
    }
  });
});

describe("desktop menu — links, markers and dropdown state", () => {
  it("names each top link exactly by its label; the + is a separate, hidden marker", () => {
    renderNav();

    for (const item of navMenu) {
      const link = topLink(item.key);
      expect(link).toHaveAttribute("href", item.href);

      if (item.children) {
        expect(link).toHaveAttribute("aria-haspopup", "true");
        expect(link).toHaveAttribute("aria-expanded", "false");
        expect(within(link).getByText("+")).toHaveAttribute("aria-hidden", "true");
      } else {
        expect(link).not.toHaveAttribute("aria-expanded");
        expect(within(link).queryByText("+")).toBeNull();
      }
    }

    // One marker per dropdown, and no "+" separators between the items any more.
    const withChildren = navMenu.filter((item) => item.children).length;
    expect(within(primaryNav()).getAllByText("+")).toHaveLength(withChildren);
  });

  it("keeps every dropdown child in the DOM while closed (CSS hides it)", () => {
    renderNav();
    for (const item of navMenu) {
      const menuItem = menuItemOf(topLink(item.key));
      for (const child of item.children ?? []) {
        expect(within(menuItem).getByRole("link", { name: ro[child.key] })).toHaveAttribute(
          "href",
          child.href,
        );
      }
    }
  });

  it("reports aria-expanded on focus, and Escape dismisses it with focus kept on the link", async () => {
    const user = userEvent.setup();
    renderNav();
    const link = topLink("nav.services");

    act(() => link.focus());
    expect(link).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(menuItemOf(link)).toHaveAttribute("data-dismissed");
    expect(document.activeElement).toBe(link);
  });

  it("Escape from inside a dropdown returns focus to its top link", async () => {
    const user = userEvent.setup();
    renderNav();
    const link = topLink("nav.company");
    const child = within(menuItemOf(link)).getByRole("link", { name: ro["nav.company.team"] });

    act(() => child.focus());
    expect(link).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(link);
    expect(link).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape closes a dropdown the mouse opened, wherever focus is, and leaves focus there", () => {
    renderNav();
    const link = topLink("nav.services");
    const outside = screen.getByRole("button", { name: "outside" });
    act(() => outside.focus());

    pointerEnter(link, "mouse");
    expect(link).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(outside, { key: "Escape" });
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(menuItemOf(link)).toHaveAttribute("data-dismissed");
    expect(document.activeElement).toBe(outside);
  });

  it("closes a hovered dropdown on Escape with focus on <body> too, and hovering again reopens it", () => {
    renderNav();
    const link = topLink("nav.company");
    expect(document.activeElement).toBe(document.body);

    pointerEnter(link, "mouse");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(link).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(document.body);

    // The pointer leaves and comes back: the dismissal is forgotten.
    const leave = createEvent.pointerOut(link, { relatedTarget: document.body });
    Object.defineProperty(leave, "pointerType", { value: "mouse" });
    fireEvent(link, leave);
    pointerEnter(link, "mouse");
    expect(link).toHaveAttribute("aria-expanded", "true");
    expect(menuItemOf(link)).not.toHaveAttribute("data-dismissed");
  });

  it("leaves a hovered dropdown open for an Escape something else already handled", () => {
    renderNav();
    const link = topLink("nav.services");
    pointerEnter(link, "mouse");

    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();
    act(() => {
      document.body.dispatchEvent(handled);
    });

    expect(link).toHaveAttribute("aria-expanded", "true");
    expect(menuItemOf(link)).not.toHaveAttribute("data-dismissed");
  });

  it("forgets a dismissal once focus leaves the item", async () => {
    const user = userEvent.setup();
    renderNav();
    const services = topLink("nav.services");

    act(() => services.focus());
    await user.keyboard("{Escape}");
    expect(menuItemOf(services)).toHaveAttribute("data-dismissed");

    act(() => topLink("nav.company").focus());
    expect(menuItemOf(services)).not.toHaveAttribute("data-dismissed");
    expect(services).toHaveAttribute("aria-expanded", "false");
  });

  it("opens on the first touch tap without navigating, and navigates on the second", () => {
    renderNav();
    const link = topLink("nav.services");

    expect(press(link, "touch")).toBe(false); // default prevented: no navigation
    expect(menuItemOf(link)).toHaveAttribute("data-open");
    expect(link).toHaveAttribute("aria-expanded", "true");

    expect(press(link, "touch")).toBe(true); // the second tap follows the href
  });

  it("treats a pen like a finger, and never intercepts a mouse click", () => {
    renderNav();
    expect(press(topLink("nav.company"), "pen")).toBe(false);
    expect(press(topLink("nav.services"), "mouse")).toBe(true);
    // An item with no dropdown has nothing to open: a tap navigates straight away.
    expect(press(topLink("nav.about"), "touch")).toBe(true);
  });

  it("closes a tap-opened dropdown on a press outside it", () => {
    renderNav();
    const link = topLink("nav.services");

    press(link, "touch");
    expect(menuItemOf(link)).toHaveAttribute("data-open");

    // A press inside the open item leaves it open…
    fireEvent.pointerDown(within(menuItemOf(link)).getAllByRole("link")[1]);
    expect(menuItemOf(link)).toHaveAttribute("data-open");

    // …a press anywhere else closes it.
    fireEvent.pointerDown(document.body);
    expect(menuItemOf(link)).not.toHaveAttribute("data-open");
    expect(link).toHaveAttribute("aria-expanded", "false");
  });

  it("adds no tab stops: the clock and the markers are not focusable", () => {
    renderNav();
    const header = document.querySelector("header")!;
    for (const marker of within(primaryNav()).getAllByText("+")) {
      expect(marker.closest("[tabindex]")).toBeNull();
    }
    expect(header.querySelectorAll("[tabindex]")).toHaveLength(0);
  });
});

describe("shouldInterceptTap", () => {
  const cases: Array<[string, Parameters<typeof shouldInterceptTap>[0], boolean]> = [
    ["first touch tap on a dropdown", { hasChildren: true, pointerType: "touch", openedByTap: false }, true],
    ["first pen tap on a dropdown", { hasChildren: true, pointerType: "pen", openedByTap: false }, true],
    ["second tap (opened by the first)", { hasChildren: true, pointerType: "touch", openedByTap: true }, false],
    ["touch tap on a plain link", { hasChildren: false, pointerType: "touch", openedByTap: false }, false],
    ["mouse click", { hasChildren: true, pointerType: "mouse", openedByTap: false }, false],
    ["keyboard Enter", { hasChildren: true, pointerType: "keyboard", openedByTap: false }, false],
    ["unknown pointer (synthetic click)", { hasChildren: true, pointerType: "", openedByTap: false }, false],
  ];

  for (const [name, input, expected] of cases) {
    it(`${expected ? "intercepts" : "navigates"}: ${name}`, () => {
      expect(shouldInterceptTap(input)).toBe(expected);
    });
  }
});
