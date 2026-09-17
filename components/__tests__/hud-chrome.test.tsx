import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { HudChrome, useHudArmed } from "@/components/hud/HudChrome";
import { CONSENT_EVENT, CONSENT_KEY, setConsent } from "@/lib/consent";
import { HUD_ARM_EVENTS, HUD_FLAG_KEY } from "@/lib/hud/gate";
import { INTRO_OVERLAY_ID, markIntroGone, resetIntroForTests } from "@/lib/intro";

/*
 * The HUD chrome's single mount (components/hud/HudChrome.tsx) and its arming gate, in order:
 * the tbs_hud QA switch → an answered cookie banner (its answer counts as the interaction) →
 * the first interaction on window → the intro overlay gone → an idle slot. Nothing renders
 * before that; after it, the parts do (Phase 4: the Ghid TBS guide).
 *
 * `afterIdle` is mocked to a manual queue, so a test sees exactly when the gate asked for the
 * idle slot and opens it by hand. The intro is the real lib/intro.ts: "on screen" is the
 * overlay root in the document until `markIntroGone`. The guide itself is a stub part (its own
 * behaviour is guide-assistant.test.tsx): what is pinned here is that HudChrome mounts it through
 * `next/dynamic` once the gate is open, and never before.
 */

const h = vi.hoisted(() => ({
  idle: [] as Array<{ ms: number; run: () => void; cancelled: boolean }>,
  guideRenders: 0,
}));

vi.mock("@/components/hud/guide/GuideAssistant", () => ({
  GuideAssistant: function GuideAssistantStub() {
    h.guideRenders += 1;
    return <div data-hud="" data-guide="" data-testid="guide-part" />;
  },
}));

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
