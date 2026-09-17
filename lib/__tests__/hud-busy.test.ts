import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isHudBusy,
  resetHudBusyForTests,
  setHudBusy,
  subscribeHudBusy,
} from "@/lib/hud/busy";

/*
 * The shared "busy with the HUD" store (lib/hud/busy.ts): OS windows and drags produce it, the
 * guide reads it as a blocker. One flag per source; listeners hear the aggregate flip only.
 */

beforeEach(() => {
  resetHudBusyForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetHudBusyForTests();
});

describe("isHudBusy", () => {
  it("starts idle and follows one source", () => {
    expect(isHudBusy()).toBe(false);
    setHudBusy("os-window", true);
    expect(isHudBusy()).toBe(true);
    setHudBusy("os-window", false);
    expect(isHudBusy()).toBe(false);
  });

  it("stays busy until EVERY source lets go", () => {
    setHudBusy("os-window", true);
    setHudBusy("os-drag", true);
    setHudBusy("os-drag", false);
    expect(isHudBusy(), "the window is still in use").toBe(true);
    setHudBusy("os-window", false);
    expect(isHudBusy()).toBe(false);
  });

  it("treats a repeated write as one flag, not a count", () => {
    setHudBusy("os-drag", true);
    setHudBusy("os-drag", true);
    setHudBusy("os-drag", false);
    expect(isHudBusy()).toBe(false);
    setHudBusy("os-window", false);
    expect(isHudBusy(), "letting go of what was never held changes nothing").toBe(false);
  });
});

describe("subscribeHudBusy", () => {
  it("hears only the idle ↔ busy flips", () => {
    const onChange = vi.fn();
    subscribeHudBusy(onChange);

    setHudBusy("os-window", true);
    expect(onChange).toHaveBeenCalledTimes(1);
    setHudBusy("os-drag", true); // already busy
    setHudBusy("os-window", true); // no change at all
    setHudBusy("os-window", false); // the drag still holds it
    expect(onChange).toHaveBeenCalledTimes(1);
    setHudBusy("os-drag", false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reads the new value inside the callback, and stops after unsubscribing", () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeHudBusy(() => seen.push(isHudBusy()));
    setHudBusy("os-drag", true);
    setHudBusy("os-drag", false);
    unsubscribe();
    unsubscribe();
    setHudBusy("os-drag", true);
    expect(seen).toEqual([true, false]);
  });

  it("keeps two subscriptions of the same function apart", () => {
    const onChange = vi.fn();
    const first = subscribeHudBusy(onChange);
    subscribeHudBusy(onChange);
    first();
    setHudBusy("os-window", true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("lets a listener unsubscribe another mid-notification without skipping anyone", () => {
    const calls: string[] = [];
    let stopSecond: () => void = () => {};
    subscribeHudBusy(() => {
      calls.push("first");
      stopSecond();
    });
    stopSecond = subscribeHudBusy(() => calls.push("second"));
    setHudBusy("os-window", true);
    expect(calls).toEqual(["first", "second"]);
    setHudBusy("os-window", false);
    expect(calls).toEqual(["first", "second", "first"]);
  });

  it("resetHudBusyForTests clears the flags and the listeners", () => {
    const onChange = vi.fn();
    subscribeHudBusy(onChange);
    setHudBusy("os-drag", true);
    resetHudBusyForTests();
    expect(isHudBusy()).toBe(false);
    setHudBusy("os-drag", true);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("lib/hud/busy without a DOM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
  });

  it("imports, and a server write leaves nothing behind", async () => {
    expect(typeof window).toBe("undefined");
    const busy = await import("@/lib/hud/busy");
    const onChange = vi.fn();
    busy.subscribeHudBusy(onChange);
    busy.setHudBusy("os-window", true);
    expect(busy.isHudBusy()).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});
