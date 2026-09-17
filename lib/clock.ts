/**
 * The header's `SYS_TIME` clock: the time in Chișinău and its real UTC offset, plus the
 * external store `useSyncExternalStore` reads it through.
 *
 * The time is the studio's wall clock, not the visitor's: formatted with `Intl` in an
 * explicit time zone, so a visitor in New York sees the same `12:04:08 UTC+3` as one in
 * Chișinău. The offset is derived from the zone for that instant — UTC+3 in summer, UTC+2
 * in winter — which fixes the old status bar, where local time sat under a fixed "UTC+3".
 *
 * No React and no `"use client"`: the constants are importable anywhere, and nothing here
 * touches `document` until something subscribes.
 */

/** The zone the header clock shows. */
export const SITE_TIME_ZONE = "Europe/Chisinau";

export type ClockReading = {
  /** `HH:MM:SS`, 24-hour, always two digits per field. */
  readonly time: string;
  /** `UTC+3`, `UTC-5`, `UTC+5:30`, `UTC+0`. */
  readonly offset: string;
};

/**
 * What the server renders and hydration starts from. Same character count as a real
 * reading (`UTC+-` vs `UTC+3`), so swapping in the live value shifts nothing.
 */
export const CLOCK_PLACEHOLDER: ClockReading = Object.freeze({
  time: "--:--:--",
  offset: "UTC+-",
});

/** Building a DateTimeFormat is the expensive part; one per zone, reused every tick. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Read `date` as a wall clock in `timeZone`. Independent of the process/browser time zone. */
export function readClock(date: Date, timeZone: string = SITE_TIME_ZONE): ClockReading {
  if (Number.isNaN(date.getTime())) return CLOCK_PLACEHOLDER;

  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(date)) parts[type] = value;

  // Some engines still print midnight as "24" despite `h23`.
  const hour = parts.hour === "24" ? "00" : (parts.hour ?? "00");
  const minute = parts.minute ?? "00";
  const second = parts.second ?? "00";

  /* The offset is the wall clock read back as if it were UTC, minus the instant itself
     (floored to the second, because the formatted parts carry no milliseconds). */
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const minutes = Math.round((wall - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const abs = Math.abs(minutes);
  const rest = abs % 60;
  const offset = `UTC${minutes < 0 ? "-" : "+"}${Math.floor(abs / 60)}${
    rest ? `:${String(rest).padStart(2, "0")}` : ""
  }`;

  return { time: `${hour}:${minute}:${second}`, offset };
}

// --- the `useSyncExternalStore` triple ---------------------------------------------------

/**
 * Half a second, so the displayed second is never more than 500ms late and never skips.
 * One shared interval however many clocks are mounted (bar + burger menu).
 */
export const CLOCK_TICK_MS = 500;

let snapshot: ClockReading | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Re-read the clock; replace the cached snapshot ONLY when what it shows changed. React
 * compares snapshots by identity, so an unchanged second must stay the same object.
 */
function refresh(notify: boolean): void {
  const next = readClock(new Date());
  if (snapshot && snapshot.time === next.time && snapshot.offset === next.offset) return;
  snapshot = next;
  if (notify) listeners.forEach((listener) => listener());
}

function start(): void {
  if (timer !== undefined) return;
  refresh(true);
  timer = setInterval(() => refresh(true), CLOCK_TICK_MS);
}

function stop(): void {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}

/* A hidden tab needs no clock; the first visible frame re-reads it before anything paints. */
function onVisibilityChange(): void {
  if (document.hidden) stop();
  else start();
}

export function subscribeClock(onChange: () => void): () => void {
  const first = listeners.size === 0;
  listeners.add(onChange);
  if (first) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!document.hidden) start();
  }

  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listeners.delete(onChange);
    if (listeners.size > 0) return;
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

/**
 * The current reading. With subscribers the interval keeps the cache fresh; without any
 * (the render just before the first subscribe) it is re-read here, so a clock that mounts
 * minutes after the last one unmounted never flashes a stale time.
 */
export function getClockSnapshot(): ClockReading {
  if (listeners.size === 0 || snapshot === null) refresh(false);
  return snapshot as ClockReading;
}

/** Server render and hydration: the placeholder, never a real time (it would mismatch). */
export function getServerClockSnapshot(): ClockReading {
  return CLOCK_PLACEHOLDER;
}
