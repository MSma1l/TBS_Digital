import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { HudChrome, useHudArmed } from "@/components/hud/HudChrome";
import { CONSENT_EVENT, CONSENT_KEY, setConsent } from "@/lib/consent";
import { HUD_ARM_EVENTS, HUD_DESKTOP_MEDIA, HUD_FLAG_KEY } from "@/lib/hud/gate";
import { INTRO_OVERLAY_ID, markIntroGone, resetIntroForTests } from "@/lib/intro";

/*
 * The HUD chrome's single mount (components/hud/HudChrome.tsx) and its arming gate, in order:
 * the tbs_hud QA switch → an answered cookie banner (its answer counts as the interaction) →
 * the first interaction on window → the intro overlay gone → an idle slot. Nothing renders
 * before that; after it, the parts do (Phase 4: the Ghid TBS guide; Phase 5: the fibre rail,
 * only while the desktop media query matches).
 *
 * `afterIdle` is mocked to a manual queue, so a test sees exactly when the gate asked for the
 * idle slot and opens it by hand. The intro is the real lib/intro.ts: "on screen" is the
 * overlay root in the document until `markIntroGone`. The guide and the rail are stub parts
 * (their own behaviour is guide-assistant.test.tsx and scroll-rail.test.tsx): what is pinned here
 * is that HudChrome mounts them through `next/dynamic` once the gate is open, and never before.
 */

const h = vi.hoisted(() => ({
  idle: [] as Array<{ ms: number; run: () => void; cancelled: boolean }>,
  guideRenders: 0,
  guideMounts: 0,
  railRenders: 0,
  railMounts: 0,
  railUnmounts: 0,
}));

vi.mock("@/components/hud/guide/GuideAssistant", async () => {
  const { useEffect } = await import("react");
  return {
    GuideAssistant: function GuideAssistantStub() {
      h.guideRenders += 1;
      useEffect(() => {
        h.guideMounts += 1;
      }, []);
      return <div data-hud="" data-guide="" data-testid="guide-part" />;
    },
  };
});

vi.mock("@/components/hud/rail/ScrollRail", async () => {
  const { useEffect } = await import("react");
  return {
    ScrollRail: function ScrollRailStub() {
      h.railRenders += 1;
      useEffect(() => {
        h.railMounts += 1;
        return () => {
          h.railUnmounts += 1;
        };
      }, []);
      return <div data-hud="" data-rail="" data-testid="rail-part" />;
    },
  };
});

/**
 * A viewport whose width the test sets: `matchMedia(HUD_DESKTOP_MEDIA)` matches while `desktop`,
 * and `resize(next)` flips it and tells the query's `change` listeners, like a window dragged
 * across 861px. Any other query never matches. Returns the queries asked for, in order.
 */
function mockViewport(desktop: boolean) {
  let matches = desktop;
  const listeners = new Set<() => void>();
  const asked: string[] = [];
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    asked.push(query);
    const list = {
      get matches() {
        return query === HUD_DESKTOP_MEDIA && matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    };
    return list as unknown as MediaQueryList;
  });
  return {
    asked,
    listeners,
    resize(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of [...listeners]) listener();
      });
    },
  };
}

/** Let a lazy part's chunk resolve (or prove that none was asked for). */
async function settle(ms = 20) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

vi.mock("@/lib/idle", () => ({
  afterIdle: (ms: number, run: () => void) => {
    const entry = { ms, run, cancelled: false };
    h.idle.push(entry);
    return () => {
      entry.cancelled = true;
    };
  },
}));

/** Open every idle slot still wanted, like a browser with a free main thread. */
function runIdle() {
  act(() => {
    for (const entry of h.idle.splice(0)) if (!entry.cancelled) entry.run();
  });
}

const answerConsent = () => localStorage.setItem(CONSENT_KEY, "rejected");

function mountIntroOverlay(): HTMLElement {
  const el = document.createElement("div");
  el.id = INTRO_OVERLAY_ID;
  document.body.appendChild(el);
  return el;
}

function fire(type: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new Event(type));
  });
}

beforeEach(() => {
  h.idle.length = 0;
  h.guideRenders = 0;
  h.guideMounts = 0;
  h.railRenders = 0;
  h.railMounts = 0;
  h.railUnmounts = 0;
  localStorage.clear();
  document.cookie = `${CONSENT_KEY}=;path=/;max-age=0`;
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  resetIntroForTests();
});

afterEach(() => {
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
  localStorage.clear();
});

describe("nothing renders before arming", () => {
  it("renders nothing on the server", () => {
    answerConsent();
    expect(renderToString(<HudChrome />)).toBe("");
  });

  it("renders nothing on the client until the gate opens, then the guide part", async () => {
    answerConsent();
    const { container } = render(<HudChrome />);
    expect(container.innerHTML).toBe("");
    fire("pointermove");
    expect(container.innerHTML).toBe("");
    expect(document.querySelector("[data-hud]")).toBeNull();
    expect(h.guideRenders, "no part before the idle slot").toBe(0);
    expect(h.idle).toHaveLength(1);
    runIdle();

    // The part is a lazy chunk: it arrives a tick after the commit that opened the gate.
    const guide = await screen.findByTestId("guide-part");
    expect(container.contains(guide)).toBe(true);
    expect(container.querySelectorAll("[data-hud]")).toHaveLength(1);
    expect(container.querySelectorAll("[data-guide]")).toHaveLength(1);
  });

  it("never renders the guide part while the gate stays shut", async () => {
    // Consent unanswered: interactions alone never open the gate.
    const { container } = render(<HudChrome />);
    for (const type of HUD_ARM_EVENTS) fire(type);
    runIdle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.innerHTML).toBe("");
    expect(h.guideRenders).toBe(0);
    expect(document.querySelector("[data-hud]")).toBeNull();
  });

  it("the flag off keeps the guide part away even after consent and interaction", async () => {
    localStorage.setItem(HUD_FLAG_KEY, "off");
    answerConsent();
    const { container } = render(<HudChrome />);
    for (const type of HUD_ARM_EVENTS) fire(type);
    act(() => setConsent("accepted"));
    runIdle();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.innerHTML).toBe("");
    expect(h.guideRenders).toBe(0);
  });
});

describe("the rail part: desktop only (HUD_DESKTOP_MEDIA)", () => {
  it("at a desktop width it renders with the guide once the gate opens, after it in the DOM, and not before", async () => {
    const viewport = mockViewport(true);
    answerConsent();
    const { container } = render(<HudChrome />);
    fire("pointermove");
    await settle();
    expect(h.railRenders, "no rail before the idle slot").toBe(0);
    expect(document.querySelector("[data-rail]")).toBeNull();
    expect(viewport.asked, "the media query is not even read before the gate opens").toEqual([]);

    runIdle();
    const rail = await screen.findByTestId("rail-part");
    await screen.findByTestId("guide-part");
    expect(container.contains(rail)).toBe(true);
    expect(viewport.asked).toContain(HUD_DESKTOP_MEDIA);
    // The guide first, then the rail: the rail's section buttons are the last tab stops.
    expect(Array.from(container.querySelectorAll("[data-hud]"), (el) => el.getAttribute("data-testid"))).toEqual([
      "guide-part",
      "rail-part",
    ]);
  });

  it("at a phone width only the guide renders", async () => {
    mockViewport(false);
    answerConsent();
    const { container } = render(<HudChrome />);
    fire("keydown");
    runIdle();
    await screen.findByTestId("guide-part");
    await settle();
    expect(h.railRenders).toBe(0);
    expect(document.querySelector("[data-rail]")).toBeNull();
    expect(container.querySelectorAll("[data-hud]")).toHaveLength(1);
  });

  it("crossing the breakpoint mounts and unmounts the rail alone; the guide stays mounted", async () => {
    const viewport = mockViewport(false);
    answerConsent();
    render(<HudChrome />);
    fire("pointermove");
    runIdle();
    await screen.findByTestId("guide-part");
    expect(h.guideMounts).toBe(1);
    const guideRenders = h.guideRenders;

    viewport.resize(true);
    await screen.findByTestId("rail-part");
    expect(h.railMounts).toBe(1);

    viewport.resize(false);
    expect(screen.queryByTestId("rail-part")).toBeNull();
    expect(h.railUnmounts).toBe(1);

    viewport.resize(true);
    await screen.findByTestId("rail-part");
    expect(h.railMounts).toBe(2);

    expect(h.guideMounts, "the guide never remounts").toBe(1);
    expect(h.guideRenders, "a breakpoint crossing does not even re-render the guide").toBe(guideRenders);
    expect(screen.getByTestId("guide-part")).toBeInTheDocument();
  });

  it("unmounting the chrome stops listening to the media query", async () => {
    const viewport = mockViewport(true);
    answerConsent();
    const { unmount } = render(<HudChrome />);
    fire("wheel");
    runIdle();
    await screen.findByTestId("rail-part");
    expect(viewport.listeners.size).toBe(1);
    unmount();
    expect(viewport.listeners.size).toBe(0);
    expect(h.railUnmounts).toBe(1);
  });

  it("consent unanswered: no rail at a desktop width, whatever the visitor does", async () => {
    const viewport = mockViewport(true);
    const { container } = render(<HudChrome />);
    for (const type of HUD_ARM_EVENTS) fire(type);
    runIdle();
    await settle();
    expect(container.innerHTML).toBe("");
    expect(h.railRenders).toBe(0);
    expect(viewport.asked).toEqual([]);
  });

  it("the flag off: no rail at a desktop width even after consent and interaction", async () => {
    const viewport = mockViewport(true);
    localStorage.setItem(HUD_FLAG_KEY, "off");
    answerConsent();
    const { container } = render(<HudChrome />);
    for (const type of HUD_ARM_EVENTS) fire(type);
    act(() => setConsent("accepted"));
    runIdle();
    await settle();
    expect(container.innerHTML).toBe("");
    expect(h.railRenders).toBe(0);
    expect(viewport.asked).toEqual([]);
  });
});

describe("the gate, in order", () => {
  it("flag off: never arms, and listens to nothing", () => {
    localStorage.setItem(HUD_FLAG_KEY, "off");
    answerConsent();
    const add = vi.spyOn(window, "addEventListener");
    const { result } = renderHook(() => useHudArmed());

    for (const type of HUD_ARM_EVENTS) fire(type);
    act(() => setConsent("accepted"));
    runIdle();

    expect(result.current).toBe(false);
    expect(h.idle).toHaveLength(0);
    const types = add.mock.calls.map(([type]) => type);
    for (const type of [...HUD_ARM_EVENTS, CONSENT_EVENT]) expect(types).not.toContain(type);
  });

  it("any other flag value arms as usual", () => {
    localStorage.setItem(HUD_FLAG_KEY, "on");
    answerConsent();
    const { result } = renderHook(() => useHudArmed());
    fire("keydown");
    runIdle();
    expect(result.current).toBe(true);
  });

  it("consent unanswered: interactions do not arm", () => {
    const add = vi.spyOn(window, "addEventListener");
    const { result } = renderHook(() => useHudArmed());

    for (const type of HUD_ARM_EVENTS) fire(type);

    expect(h.idle).toHaveLength(0);
    expect(result.current).toBe(false);
    const types = add.mock.calls.map(([type]) => type);
    for (const type of HUD_ARM_EVENTS) expect(types, type).not.toContain(type);
  });

  it("CONSENT_EVENT is the interaction: arms after the idle slot, no further event needed", () => {
    const { result } = renderHook(() => useHudArmed());

    act(() => setConsent("rejected"));
    expect(result.current, "not before the idle slot").toBe(false);
    expect(h.idle.map((entry) => entry.ms)).toEqual([0]);

    runIdle();
    expect(result.current).toBe(true);
  });

  it("ignores a consent event that carries no answer while nothing is stored", () => {
    const { result } = renderHook(() => useHudArmed());
    act(() => {
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: "maybe" }));
    });
    expect(h.idle).toHaveLength(0);

    act(() => setConsent("accepted"));
    runIdle();
    expect(result.current).toBe(true);
  });

  it.each(HUD_ARM_EVENTS)("consent answered: the first %s arms after the idle slot", (type) => {
    answerConsent();
    const { result } = renderHook(() => useHudArmed());
    expect(h.idle).toHaveLength(0);

    fire(type);
    expect(result.current).toBe(false);
    expect(h.idle.map((entry) => entry.ms)).toEqual([0]);

    runIdle();
    expect(result.current).toBe(true);
  });

  it("hears an interaction inside the page in the capture phase (a scroll does not bubble)", () => {
    answerConsent();
    const inner = document.createElement("div");
    document.body.appendChild(inner);
    try {
      renderHook(() => useHudArmed());
      fire("scroll", inner);
      expect(h.idle).toHaveLength(1);
    } finally {
      inner.remove();
    }
  });

  it("intro overlay on screen: the interaction waits for it to be gone", () => {
    answerConsent();
    const overlay = mountIntroOverlay();
    const { result } = renderHook(() => useHudArmed());

    fire("pointerdown");
    expect(h.idle, "no idle slot while the intro covers the page").toHaveLength(0);

    overlay.remove();
    act(() => markIntroGone());
    expect(h.idle.map((entry) => entry.ms)).toEqual([0]);
    expect(result.current).toBe(false);

    runIdle();
    expect(result.current).toBe(true);
  });

  it("the consent path waits for the intro too", () => {
    const overlay = mountIntroOverlay();
    const { result } = renderHook(() => useHudArmed());

    act(() => setConsent("rejected"));
    expect(h.idle).toHaveLength(0);

    overlay.remove();
    act(() => markIntroGone());
    runIdle();
    expect(result.current).toBe(true);
  });
});

describe("listeners", () => {
  it("are passive capture listeners on window, removed the moment one fires", () => {
    answerConsent();
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    renderHook(() => useHudArmed());

    const added = new Map<string, EventListenerOrEventListenerObject>();
    for (const [type, listener, options] of add.mock.calls) {
      if (!(HUD_ARM_EVENTS as readonly string[]).includes(type)) continue;
      expect(options, type).toEqual({ capture: true, passive: true });
      added.set(type, listener as EventListenerOrEventListenerObject);
    }
    expect([...added.keys()].sort()).toEqual([...HUD_ARM_EVENTS].sort());

    fire("wheel");
    for (const [type, listener] of added) {
      expect(remove, type).toHaveBeenCalledWith(type, listener, expect.objectContaining({ capture: true }));
    }

    // Nothing is listening any more: later interactions queue nothing new.
    for (const type of HUD_ARM_EVENTS) fire(type);
    expect(h.idle).toHaveLength(1);
  });

  it("unmounting before the interaction removes every listener", () => {
    answerConsent();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useHudArmed());
    unmount();

    const removed = remove.mock.calls.map(([type]) => type);
    for (const type of HUD_ARM_EVENTS) expect(removed, type).toContain(type);
    for (const type of HUD_ARM_EVENTS) fire(type);
    expect(h.idle).toHaveLength(0);
  });

  it("unmounting while consent is unanswered stops listening for it", () => {
    const { unmount } = renderHook(() => useHudArmed());
    unmount();
    act(() => setConsent("rejected"));
    expect(h.idle).toHaveLength(0);
  });

  it("unmounting while the intro is on screen, or before the idle slot, cancels that step", () => {
    answerConsent();
    const overlay = mountIntroOverlay();
    const first = renderHook(() => useHudArmed());
    fire("pointermove");
    first.unmount();
    overlay.remove();
    act(() => markIntroGone());
    expect(h.idle, "the intro listener went with the unmount").toHaveLength(0);

    const second = renderHook(() => useHudArmed());
    fire("pointermove");
    expect(h.idle).toHaveLength(1);
    second.unmount();
    expect(h.idle[0].cancelled).toBe(true);
  });
});
