import { splitLocalePath } from "@/lib/i18n/locales";

/** How long `landAtTop` waits for a navigation to land before it lets go. */
const LAND_TIMEOUT_MS = 15_000;

/**
 * After a click on a `Link` with `scroll={false}`, put the page it lands on at y 0 on the first
 * frame that page paints. Such links turn Next's own scroll off because it lands at y 71 on this
 * site: the page's smooth `scroll-behavior` means its `scrollTop = 0` has not moved anything by
 * the time it checks, so it scrolls the new page's `<main>` into view instead — under the sticky
 * bar, animated in plain view. The page being left stays where the visitor had it until the new
 * one replaces it. Used by the header's logo (to Home) and the footer's portfolio link.
 *
 * Next changes the address in the same commit as the page, and a frame's `requestAnimationFrame`
 * runs before its paint, so the first frame that finds a new address is the new page's first. It
 * scrolls only if that address IS `to` (language prefix aside) with no `#section`: whatever
 * replaced the click's navigation — a Back (which also ends the wait outright), a `/#servicii`
 * link, another page — keeps the scroll Next and the browser gave it. Timed, not counted in
 * frames: a 240Hz screen would let go four times sooner than a 60Hz one.
 */
export function landAtTop(from: string, to: string): void {
  const start = performance.now();
  let frame = 0;
  const stop = () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("popstate", stop);
  };
  const check = () => {
    const { pathname, hash } = window.location;
    if (pathname === from) {
      if (performance.now() - start < LAND_TIMEOUT_MS) frame = window.requestAnimationFrame(check);
      else stop();
      return;
    }
    stop();
    if (splitLocalePath(pathname).rest === to && !hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };
  window.addEventListener("popstate", stop);
  frame = window.requestAnimationFrame(check);
}
