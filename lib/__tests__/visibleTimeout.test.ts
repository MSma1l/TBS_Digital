import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { visibleTimeout } from "@/lib/visibleTimeout";

/*
 * The visibility-aware timer behind the intro watchdog and the cookie banner's max-wait
 * (lib/visibleTimeout.ts). A hidden tab must not use up the time: a visitor who opens the
 * home page in a background tab gets the whole intro, and the banner does not show up under
 * it while nobody is looking.
 *
 * `performance` is faked together with the timers, because the time left over after a pause
 * is measured with `performance.now()`.
 */

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

describe("visibleTimeout", () => {
  it("fires after `ms` while the tab stays visible, and not a millisecond before", () => {
    const onFire = vi.fn();
    visibleTimeout(1000, onFire);

    vi.advanceTimersByTime(999);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("pauses while the tab is hidden and resumes with the time that was left", () => {
    const onFire = vi.fn();
    visibleTimeout(1000, onFire);

    vi.advanceTimersByTime(400);
    setVisibility("hidden");

    // Far longer than the timeout, all of it hidden: nothing is used up.
    vi.advanceTimersByTime(60_000);
    expect(onFire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    setVisibility("visible");
    vi.advanceTimersByTime(599);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("adds up several visible stretches", () => {
    const onFire = vi.fn();
    visibleTimeout(1000, onFire);

    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(300);
      setVisibility("hidden");
      vi.advanceTimersByTime(5_000);
      setVisibility("visible");
    }
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("does not start counting in a tab that is hidden from the start", () => {
    visibility = "hidden";
    const onFire = vi.fn();
    visibleTimeout(1000, onFire);

    vi.advanceTimersByTime(10_000);
    expect(onFire).not.toHaveBeenCalled();

    setVisibility("visible");
    vi.advanceTimersByTime(1000);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("fires once: a later hide and show does not arm it again", () => {
    const onFire = vi.fn();
    visibleTimeout(1000, onFire);

    vi.advanceTimersByTime(1000);
    expect(onFire).toHaveBeenCalledTimes(1);

    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(5_000);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancel stops it for good, can be called more than once, and leaves no listener", () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const onFire = vi.fn();
    const cancel = visibleTimeout(1000, onFire);

    vi.advanceTimersByTime(500);
    cancel();
    expect(() => cancel()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);

    setVisibility("hidden");
    setVisibility("visible");
    vi.advanceTimersByTime(5_000);
    expect(onFire).not.toHaveBeenCalled();

    const listener = add.mock.calls.find(([type]) => type === "visibilitychange")?.[1];
    expect(listener).toBeDefined();
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener);
  });

  it("cancel after it fired is harmless", () => {
    const onFire = vi.fn();
    const cancel = visibleTimeout(10, onFire);
    vi.advanceTimersByTime(10);

    expect(() => cancel()).not.toThrow();
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});
