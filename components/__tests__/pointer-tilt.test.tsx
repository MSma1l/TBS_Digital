import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CSSProperties } from "react";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { usePointerTilt } from "@/components/fx/usePointerTilt";
import { REDUCED_MOTION_QUERY, TILT_QUERY } from "@/lib/tilt";

/*
 * The card tilt hook (components/fx/usePointerTilt.ts), in jsdom. jsdom 25 has no
 * PointerEvent, so testing-library falls back to a plain Event and drops `pointerType` and
 * the coordinates — they are defined by hand, as in navbar-menu.test.tsx. React builds
 * `onPointerEnter` / `onPointerLeave` from the native `pointerover` / `pointerout`.
 * requestAnimationFrame is a manual queue, so every write is observed frame by frame.
 */

const media = { fine: false, reduced: false };
const mediaListeners = new Set<() => void>();
const realMatchMedia = window.matchMedia;

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === TILT_QUERY) return media.fine;
      if (query === REDUCED_MOTION_QUERY) return media.reduced;
      return false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => mediaListeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function changeMedia(next: Partial<typeof media>) {
  Object.assign(media, next);
  act(() => {
    for (const listener of [...mediaListeners]) listener();
  });
}

let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  nextFrame += 1;
  frames.set(nextFrame, callback);
  return nextFrame;
});
const cancelFrame = vi.fn((id: number) => {
  frames.delete(id);
});

function flushFrames() {
  const pending = [...frames.values()];
  frames.clear();
  for (const callback of pending) callback(performance.now());
}

function Card({ maxDeg = 8 }: { maxDeg?: number }) {
  const tilt = usePointerTilt(maxDeg);
  return (
    <div
      data-testid="card"
      data-tilt={tilt.enabled ? "on" : "off"}
      style={{ "--p1": "var(--red)" } as CSSProperties}
      {...tilt.handlers}
    />
  );
}

function Plain() {
  const tilt = usePointerTilt(8);
  return <div data-testid="plain" data-tilt={tilt.enabled ? "on" : "off"} {...tilt.handlers} />;
}

type Pointer = "mouse" | "touch" | "pen";

function pointer(
  kind: "pointerOver" | "pointerMove" | "pointerOut" | "pointerCancel",
  el: HTMLElement,
  pointerType: Pointer,
  x = 0,
  y = 0,
) {
  const event =
    kind === "pointerOut"
      ? createEvent.pointerOut(el, { relatedTarget: document.body })
      : createEvent[kind](el);
  Object.defineProperty(event, "pointerType", { value: pointerType });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  fireEvent(el, event);
}

function rectOf(el: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({ ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height }) as DOMRect;
}

beforeEach(() => {
  media.fine = false;
  media.reduced = false;
  mediaListeners.clear();
  installMatchMedia();
  frames = new Map();
  nextFrame = 0;
  requestFrame.mockClear();
  cancelFrame.mockClear();
  vi.stubGlobal("requestAnimationFrame", requestFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
});

describe("usePointerTilt", () => {
  it("is off without a fine, hovering pointer, and a mouse then writes nothing", () => {
    render(<Card />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-tilt", "off");

    pointer("pointerOver", card, "mouse", 10, 10);
    pointer("pointerMove", card, "mouse", 10, 10);
    flushFrames();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(card).not.toHaveAttribute("data-tilting");
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("");
  });

  it("tilts under a mouse, one write per frame, the latest position winning", () => {
    media.fine = true;
    render(<Card />);
    const card = screen.getByTestId("card");
    rectOf(card, { left: 0, top: 0, width: 200, height: 100 });
    expect(card).toHaveAttribute("data-tilt", "on");

    pointer("pointerOver", card, "mouse", 100, 50);
    pointer("pointerMove", card, "mouse", 0, 0);
    pointer("pointerMove", card, "mouse", 150, 25);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(card).not.toHaveAttribute("data-tilting");

    flushFrames();
    expect(card).toHaveAttribute("data-tilting", "");
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("4deg");
    expect(card.style.getPropertyValue("--tilt-ry")).toBe("4deg");
    // The card's own inline style is left alone.
    expect(card.style.getPropertyValue("--p1")).toBe("var(--red)");
  });

  it("settles on leave: no tilt variables, no data-tilting, the pending frame cancelled", () => {
    media.fine = true;
    render(<Card />);
    const card = screen.getByTestId("card");
    rectOf(card, { left: 0, top: 0, width: 200, height: 100 });

    pointer("pointerOver", card, "mouse", 100, 50);
    pointer("pointerMove", card, "mouse", 200, 100);
    flushFrames();
    pointer("pointerMove", card, "mouse", 0, 0);
    pointer("pointerOut", card, "mouse");

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    flushFrames();
    expect(card).not.toHaveAttribute("data-tilting");
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("");
    expect(card.style.getPropertyValue("--tilt-ry")).toBe("");
    expect(card.style.getPropertyValue("--p1")).toBe("var(--red)");
  });

  it("leaves no empty style attribute on a card that had none", () => {
    media.fine = true;
    render(<Plain />);
    const card = screen.getByTestId("plain");
    rectOf(card, { left: 0, top: 0, width: 100, height: 100 });

    pointer("pointerOver", card, "mouse", 10, 10);
    pointer("pointerMove", card, "mouse", 10, 10);
    flushFrames();
    expect(card).toHaveAttribute("style");
    pointer("pointerCancel", card, "mouse");
    expect(card).not.toHaveAttribute("style");
    expect(card).not.toHaveAttribute("data-tilting");
  });

  it.each(["touch", "pen"] as const)("never tilts for a %s", (kind) => {
    media.fine = true;
    render(<Card />);
    const card = screen.getByTestId("card");
    rectOf(card, { left: 0, top: 0, width: 200, height: 100 });

    pointer("pointerOver", card, kind, 10, 10);
    pointer("pointerMove", card, kind, 10, 10);
    flushFrames();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(card).not.toHaveAttribute("data-tilting");
  });

  it("is off under reduced motion, even with a fine pointer", () => {
    media.fine = true;
    media.reduced = true;
    render(<Card />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-tilt", "off");

    pointer("pointerOver", card, "mouse", 10, 10);
    pointer("pointerMove", card, "mouse", 10, 10);
    flushFrames();
    expect(requestFrame).not.toHaveBeenCalled();
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("");
  });

  it("follows the media queries as they change", () => {
    render(<Card />);
    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-tilt", "off");
    changeMedia({ fine: true });
    expect(card).toHaveAttribute("data-tilt", "on");
    changeMedia({ reduced: true });
    expect(card).toHaveAttribute("data-tilt", "off");
  });

  it("measures on enter and on scroll, never per move", () => {
    media.fine = true;
    render(<Card maxDeg={6} />);
    const card = screen.getByTestId("card");
    const measure = vi.fn(() => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect);
    card.getBoundingClientRect = measure;

    pointer("pointerOver", card, "mouse", 100, 50);
    pointer("pointerMove", card, "mouse", 200, 50);
    flushFrames();
    pointer("pointerMove", card, "mouse", 200, 100);
    flushFrames();
    expect(measure).toHaveBeenCalledTimes(1);
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("-6deg");

    // The page scrolled under a resting pointer: the card is now 100px higher.
    card.getBoundingClientRect = vi.fn(() => ({ left: 0, top: -100, width: 200, height: 100 }) as DOMRect);
    window.dispatchEvent(new Event("scroll"));
    pointer("pointerMove", card, "mouse", 200, 0);
    flushFrames();
    expect(card.style.getPropertyValue("--tilt-rx")).toBe("-6deg");
    expect(card.style.getPropertyValue("--tilt-ry")).toBe("6deg");
  });

  it("stops listening and cancels its frame on unmount", () => {
    media.fine = true;
    const { unmount } = render(<Card />);
    const card = screen.getByTestId("card");
    const measure = vi.fn(() => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect);
    card.getBoundingClientRect = measure;

    pointer("pointerOver", card, "mouse", 100, 50);
    pointer("pointerMove", card, "mouse", 0, 0);
    unmount();
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("scroll"));
    expect(measure).toHaveBeenCalledTimes(1);
  });
});
