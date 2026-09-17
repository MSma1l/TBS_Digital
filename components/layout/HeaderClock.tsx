"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  CLOCK_PLACEHOLDER,
  getClockSnapshot,
  getServerClockSnapshot,
  subscribeClock,
  type ClockReading,
} from "@/lib/clock";

/**
 * Where the `bar` clock is on screen: exactly the widths its `sm:flex md:hidden lg:flex`
 * classes show it at (641–860 and from 1025). Anywhere else it is `display: none`.
 */
export const BAR_CLOCK_QUERY = "(min-width: 641px) and (max-width: 860px), (min-width: 1025px)";

let barQuery: { from: Window["matchMedia"]; list: MediaQueryList } | null = null;
/**
 * One MediaQueryList for every bar clock, created on first use (never on the server) — and
 * again only if `window.matchMedia` itself was replaced (the unit tests stub it per case).
 */
function barClockQuery(): MediaQueryList | null {
  if (typeof window.matchMedia !== "function") return null;
  if (barQuery?.from !== window.matchMedia) {
    barQuery = { from: window.matchMedia, list: window.matchMedia(BAR_CLOCK_QUERY) };
  }
  return barQuery.list;
}

function subscribeBarVisible(onChange: () => void): () => void {
  const query = barClockQuery();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/** No `matchMedia` at all (an old engine): assume it is on screen and keep it ticking. */
const getBarVisible = () => barClockQuery()?.matches ?? true;
const getServerBarVisible = () => false;

/** A clock nobody can see subscribes to nothing: no interval, no re-render. */
const subscribeNothing = () => () => {};
const getPlaceholder = (): ClockReading => CLOCK_PLACEHOLDER;

/**
 * The header's HUD clock: `SYS_TIME 12:04:08 UTC+3`, Chișinău time with its real offset
 * (`lib/clock.ts` owns the reading, the shared interval and the hidden-tab pause).
 *
 * Decorative, so the whole readout is `aria-hidden`: a value that changes every second is
 * noise to a screen reader, and it carries nothing a visitor needs to act on. It holds no
 * link, button or tabindex either — the header's Tab budget (18 stops before the CTA) is
 * pinned by tests.
 *
 * Hydration: the server and the hydrating client both read `getServerClockSnapshot()`
 * (`--:--:--`, same width as a real time), then the store swaps in the live reading. No
 * mismatch, and no set-state-in-effect.
 *
 * Where it shows — the bar only has room for it where the nav or the CTA does not need the
 * width (measured row budgets in the redesign plan):
 *
 * | width      | `bar`                  | `menu` (burger overlay) |
 * |------------|------------------------|-------------------------|
 * | < 641      | hidden                 | full, next to the "×"   |
 * | 641–860    | short `12:04:08 UTC+3` | hidden (the bar has it) |
 * | 861–1024   | hidden (nav + CTA)     | — (no overlay)          |
 * | 1025–1179  | short                  | —                       |
 * | ≥ 1180     | full `SYS_TIME …`      | —                       |
 *
 * The `bar` clock only ticks while BAR_CLOCK_QUERY matches: on every phone and in the
 * 861–1024 band it is hidden, and a hidden readout must not keep the shared interval (and a
 * re-render every second) running. It follows the query's `change`, so resizing across a
 * breakpoint starts or stops it. The `menu` clock always ticks — it is only mounted while
 * the burger overlay is open.
 *
 * Small text is `--mut`, never `--dim` (4.45:1 on white fails AA at 11px); the label is
 * `--blue-text` rather than `--cyan`, which is 3.56:1 as text in the light theme.
 */
export type HeaderClockVariant = "bar" | "menu";

export function HeaderClock({ variant = "bar" }: { variant?: HeaderClockVariant }) {
  const t = useT();
  const bar = variant === "bar";
  const barVisible = useSyncExternalStore(
    bar ? subscribeBarVisible : subscribeNothing,
    bar ? getBarVisible : getServerBarVisible,
    getServerBarVisible,
  );
  const live = !bar || barVisible;
  const { time, offset } = useSyncExternalStore(
    live ? subscribeClock : subscribeNothing,
    live ? getClockSnapshot : getPlaceholder,
    getServerClockSnapshot,
  );

  return (
    <p
      aria-hidden="true"
      data-clock={variant}
      className={
        bar
          ? "m-0 hidden shrink-0 items-center gap-2 font-hud text-xs leading-none tracking-[.06em] whitespace-nowrap text-mut sm:flex md:hidden lg:flex"
          : "m-0 flex items-center gap-2 font-hud text-xs leading-none tracking-[.06em] whitespace-nowrap text-mut sm:hidden"
      }
    >
      <span className={bar ? "hidden font-bold text-blue-text xl:inline" : "font-bold text-blue-text"}>
        {t("header.sysTime")}
      </span>
      <span className="tabular-nums">{time}</span>
      <span className="tabular-nums">{offset}</span>
    </p>
  );
}
