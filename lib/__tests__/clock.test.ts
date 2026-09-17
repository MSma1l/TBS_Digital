import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLOCK_PLACEHOLDER,
  CLOCK_TICK_MS,
  SITE_TIME_ZONE,
  getClockSnapshot,
  getServerClockSnapshot,
  readClock,
  subscribeClock,
} from "@/lib/clock";

/*
 * The header clock shows Chișinău's wall clock with its real offset, whatever time zone the
 * visitor (or the test process) is in.
 *
 * The DST rows sit ±90 minutes from the 2026 changes (29 March, 25 October, both at
 * 00:00 UTC), so they hold whether the rule fires at 00:00 or 01:00 UTC.
 */

const CHISINAU: Array<[instant: string, time: string, offset: string, why: string]> = [
  ["2026-01-15T10:04:08Z", "12:04:08", "UTC+2", "winter"],
  ["2026-07-15T09:04:08Z", "12:04:08", "UTC+3", "summer"],
  ["2026-03-28T22:30:00Z", "00:30:00", "UTC+2", "just before the spring change"],
  ["2026-03-29T01:30:00Z", "04:30:00", "UTC+3", "just after the spring change"],
  ["2026-10-24T22:30:00Z", "01:30:00", "UTC+3", "just before the autumn change"],
  ["2026-10-25T01:30:00Z", "03:30:00", "UTC+2", "just after the autumn change"],
  ["2026-07-14T21:00:05Z", "00:00:05", "UTC+3", "midnight is 00, never 24"],
  ["2026-07-15T09:04:08.999Z", "12:04:08", "UTC+3", "milliseconds never round up"],
];

describe("readClock", () => {
  it("defaults to the studio's zone", () => {
    expect(SITE_TIME_ZONE).toBe("Europe/Chisinau");
  });

  for (const [instant, time, offset, why] of CHISINAU) {
    it(`${instant} → ${time} ${offset} (${why})`, () => {
      expect(readClock(new Date(instant))).toEqual({ time, offset });
    });
  }

  it("formats other offsets: zero, negative, and half hours", () => {
    expect(readClock(new Date("2026-07-15T09:04:08Z"), "UTC")).toEqual({
      time: "09:04:08",
      offset: "UTC+0",
    });
    expect(readClock(new Date("2026-01-15T10:04:08Z"), "America/New_York")).toEqual({
      time: "05:04:08",
      offset: "UTC-5",
    });
    expect(readClock(new Date("2026-07-15T09:04:08Z"), "Asia/Kolkata")).toEqual({
      time: "14:34:08",
      offset: "UTC+5:30",
    });
    expect(readClock(new Date("2026-01-15T10:04:08Z"), "America/St_Johns")).toEqual({
      time: "06:34:08",
      offset: "UTC-3:30",
    });
  });

  it("gives identical readings whatever the process time zone is", () => {
    const previous = process.env.TZ;
    const expected = CHISINAU.map(([instant]) => readClock(new Date(instant)));
    try {
      for (const tz of ["America/Los_Angeles", "Asia/Tokyo", "UTC"]) {
        process.env.TZ = tz;
        expect(CHISINAU.map(([instant]) => readClock(new Date(instant)))).toEqual(expected);
      }
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("returns the placeholder for an invalid date instead of throwing", () => {
    expect(readClock(new Date(Number.NaN))).toBe(CLOCK_PLACEHOLDER);
  });
});

describe("clock store", () => {
  let hidden = false;

  beforeEach(() => {
    hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(new Date("2026-07-15T09:04:08Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "hidden");
  });

  it("renders the placeholder on the server, with the same width as a real reading", () => {
    expect(getServerClockSnapshot()).toBe(CLOCK_PLACEHOLDER);
    expect(CLOCK_PLACEHOLDER).toEqual({ time: "--:--:--", offset: "UTC+-" });
    expect(CLOCK_PLACEHOLDER.offset).toHaveLength("UTC+3".length);
  });

  it("returns the same snapshot object until the displayed second changes", () => {
    const first = getClockSnapshot();
    expect(first).toEqual({ time: "12:04:08", offset: "UTC+3" });
    expect(getClockSnapshot()).toBe(first);

    const unsubscribe = subscribeClock(() => {});
    vi.advanceTimersByTime(CLOCK_TICK_MS - 100);
    expect(getClockSnapshot()).toBe(first);
    vi.advanceTimersByTime(600);
    expect(getClockSnapshot()).not.toBe(first);
    expect(getClockSnapshot().time).toBe("12:04:09");
    unsubscribe();
  });

  it("shares one interval between subscribers and stops it with the last one", () => {
    getClockSnapshot();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = subscribeClock(a);
    const unsubscribeB = subscribeClock(b);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
    expect(getClockSnapshot().time).toBe("12:04:09");

    unsubscribeA();
    unsubscribeA(); // idempotent: must not take B's slot
    expect(vi.getTimerCount()).toBe(1);
    unsubscribeB();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("notifies once per displayed second, not once per tick", () => {
    getClockSnapshot();
    const onChange = vi.fn();
    const unsubscribe = subscribeClock(onChange);
    onChange.mockClear();
    vi.advanceTimersByTime(3000);
    expect(onChange).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("pauses while the tab is hidden and catches up when it comes back", () => {
    getClockSnapshot();
    const onChange = vi.fn();
    const unsubscribe = subscribeClock(onChange);
    expect(vi.getTimerCount()).toBe(1);

    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);

    onChange.mockClear();
    vi.setSystemTime(new Date("2026-07-15T09:14:08Z"));
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(getClockSnapshot().time).toBe("12:14:08");

    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start ticking for a subscriber that arrives in a hidden tab", () => {
    hidden = true;
    const unsubscribe = subscribeClock(() => {});
    expect(vi.getTimerCount()).toBe(0);
    unsubscribe();
  });

  it("re-reads the clock for a render with no subscribers, so a remount is never stale", () => {
    const before = getClockSnapshot();
    vi.setSystemTime(new Date("2026-07-15T09:30:00Z"));
    const after = getClockSnapshot();
    expect(after).not.toBe(before);
    expect(after.time).toBe("12:30:00");
  });
});
