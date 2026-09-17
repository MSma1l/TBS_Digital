import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_SLOT_TIMEOUT_MS, LOAD_SETTLE_MS, afterIdle } from "@/lib/idle";

/*
 * `afterIdle` (lib/idle.ts) gates the interior stage's GPU probe and its three.js / GSAP
 * chunk requests: a real minimum of VISIBLE time, then an idle slot, then a visible tab.
 *
 * jsdom has no `requestIdleCallback`; each test installs a controllable one (or leaves it out,
 * the Safari path). `performance` is faked with the timers: the visible-time minimum measures
 * the time left over after a hide with `performance.now()`.
 */

let visibility: DocumentVisibilityState = "visible";
let readyState: DocumentReadyState = "complete";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

type IdleRequest = { callback: IdleRequestCallback; options?: IdleRequestOptions; cancelled: boolean };
let idleRequests: IdleRequest[] = [];

function installIdleCallback() {
  idleRequests = [];
  window.requestIdleCallback = ((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
    idleRequests.push({ callback, options, cancelled: false });
    return idleRequests.length;
  }) as typeof window.requestIdleCallback;
  window.cancelIdleCallback = ((handle: number) => {
    const request = idleRequests[handle - 1];
    if (request) request.cancelled = true;
  }) as typeof window.cancelIdleCallback;
}

/** Run every idle callback that is still wanted, like a browser with a free main thread. */
function runIdle() {
  for (const request of idleRequests.splice(0)) {
    if (!request.cancelled) request.callback({ didTimeout: false, timeRemaining: () => 50 });
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
  visibility = "visible";
  readyState = "complete";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  Object.defineProperty(document, "readyState", { configurable: true, get: () => readyState });
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
  Reflect.deleteProperty(document, "readyState");
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
});

describe("afterIdle — with requestIdleCallback", () => {
  beforeEach(installIdleCallback);

  it("asks for an idle slot only after the minimum delay, then runs once", () => {
    const callback = vi.fn();
    afterIdle(1500, callback);

    vi.advanceTimersByTime(1499);
    expect(idleRequests).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(idleRequests).toHaveLength(1);
    expect(idleRequests[0].options).toEqual({ timeout: IDLE_SLOT_TIMEOUT_MS });
    expect(callback).not.toHaveBeenCalled();

    runIdle();
    expect(callback).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("counts visible time only: a background tab never uses up the delay", () => {
    const callback = vi.fn();
    afterIdle(1000, callback);

    vi.advanceTimersByTime(400);
    setVisibility("hidden");
    vi.advanceTimersByTime(60_000);
    expect(idleRequests).toHaveLength(0);

    setVisibility("visible");
    vi.advanceTimersByTime(599);
    expect(idleRequests).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(idleRequests).toHaveLength(1);
  });

  it("a tab opened in the background starts counting when it is first shown", () => {
    visibility = "hidden";
    const callback = vi.fn();
    afterIdle(500, callback);

    vi.advanceTimersByTime(10_000);
    expect(idleRequests).toHaveLength(0);

    setVisibility("visible");
    vi.advanceTimersByTime(500);
    runIdle();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("an idle slot that arrives in a hidden tab waits until the tab is visible again", () => {
    const callback = vi.fn();
    afterIdle(0, callback);
    vi.advanceTimersByTime(0);
    expect(idleRequests).toHaveLength(1);

    setVisibility("hidden");
    runIdle();
    expect(callback).not.toHaveBeenCalled();

    setVisibility("visible");
    expect(callback).toHaveBeenCalledTimes(1);
    // Another visibility change never runs it twice.
    setVisibility("hidden");
    setVisibility("visible");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancel works at every step: during the delay, while waiting for idle, while hidden", () => {
    const duringDelay = vi.fn();
    afterIdle(1000, duringDelay)();
    vi.advanceTimersByTime(5_000);
    runIdle();
    expect(duringDelay).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    const waitingForIdle = vi.fn();
    const cancelIdle = afterIdle(0, waitingForIdle);
    vi.advanceTimersByTime(0);
    expect(idleRequests).toHaveLength(1);
    cancelIdle();
    runIdle();
    expect(waitingForIdle).not.toHaveBeenCalled();

    const whileHidden = vi.fn();
    const cancelHidden = afterIdle(0, whileHidden);
    vi.advanceTimersByTime(0);
    setVisibility("hidden");
    runIdle();
    cancelHidden();
    setVisibility("visible");
    expect(whileHidden).not.toHaveBeenCalled();
  });

  it("cancel after the callback ran is a harmless no-op, and so is a second cancel", () => {
    const callback = vi.fn();
    const cancel = afterIdle(0, callback);
    vi.advanceTimersByTime(0);
    runIdle();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(() => {
      cancel();
      cancel();
    }).not.toThrow();
  });

  it("a negative or non-finite delay does not wait", () => {
    const negative = vi.fn();
    afterIdle(-50, negative);
    const notANumber = vi.fn();
    afterIdle(Number.NaN, notANumber);
    vi.advanceTimersByTime(0);
    runIdle();
    expect(negative).toHaveBeenCalledTimes(1);
    expect(notANumber).toHaveBeenCalledTimes(1);
  });
});

describe("afterIdle — without requestIdleCallback (Safari)", () => {
  it("after the delay, runs LOAD_SETTLE_MS later when the page has already loaded", () => {
    expect(typeof window.requestIdleCallback).not.toBe("function");
    const callback = vi.fn();
    afterIdle(1000, callback);

    vi.advanceTimersByTime(1000 + LOAD_SETTLE_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("waits for the window's load event first when the page is still loading", () => {
    readyState = "loading";
    const callback = vi.fn();
    afterIdle(100, callback);

    vi.advanceTimersByTime(30_000);
    expect(callback).not.toHaveBeenCalled();

    readyState = "complete";
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(LOAD_SETTLE_MS - 1);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the load listener and the settle timer", () => {
    readyState = "loading";
    const beforeLoad = vi.fn();
    const cancelBeforeLoad = afterIdle(0, beforeLoad);
    vi.advanceTimersByTime(0);
    cancelBeforeLoad();
    window.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(LOAD_SETTLE_MS);
    expect(beforeLoad).not.toHaveBeenCalled();

    readyState = "complete";
    const settling = vi.fn();
    const cancelSettling = afterIdle(0, settling);
    vi.advanceTimersByTime(1);
    cancelSettling();
    vi.advanceTimersByTime(LOAD_SETTLE_MS);
    expect(settling).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
