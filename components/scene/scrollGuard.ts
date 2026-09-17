/**
 * What ScrollTrigger may do to the page, and what it may not.
 *
 * `html { scroll-behavior: smooth }` (app/globals.css) and ScrollTrigger disagree: every full
 * refresh jumps the page to 0, measures and jumps back. gsap 3.15.0 remembers "this scroller
 * is smooth" the first time it builds a scroll function (Observer.js), writes an inline
 * `scroll-behavior: auto` on <html> for the jump, and puts `smooth` back INLINE one frame
 * later (ScrollTrigger.js `_refreshAll`) — so after the first resize <html> keeps a style
 * attribute for the rest of the visit, and a smooth jump could measure mid-animation.
 *
 * The guard: tell both of window's scroll functions they are not smooth (no inline writes at
 * all), and hold `html[data-scroll-measure]` (a `scroll-behavior: auto` rule in globals.css)
 * from `refreshInit` — dispatched before the jump to 0 — to `refresh`, dispatched after the
 * jump back, so both jumps are instant. It relies on that 3.15.0 order and on the mutable
 * `smooth` flag, which is why gsap is pinned exactly in package.json; the forced-WebGL E2E
 * ("html and body keep no style") is the tripwire.
 *
 * Types only from gsap: this module adds nothing to a bundle the director doesn't already pay for.
 */

import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";
import { INSTANT_SCROLL_ATTR, SCENE_ATTR } from "@/lib/scene";

/** Run `run` with smooth scrolling off on `root` (normally <html>), and put it back even if `run` throws. */
export function withInstantScroll<T>(root: HTMLElement, run: () => T): T {
  root.setAttribute(INSTANT_SCROLL_ATTR, "");
  try {
    return run();
  } finally {
    root.removeAttribute(INSTANT_SCROLL_ATTR);
  }
}

/** A ScrollTrigger scroll function, with the flag gsap reads before touching `scroll-behavior`. */
type SmoothFlagged = { smooth?: boolean };

/**
 * Keep ScrollTrigger's refreshes instant and inline-style-free on `root` (see the file comment).
 * Returns the release: listeners off, attribute gone.
 */
export function guardSmoothScroll(ST: typeof ScrollTrigger, root: HTMLElement): () => void {
  for (const horizontal of [false, true]) {
    (ST.getScrollFunc(window, horizontal) as unknown as SmoothFlagged).smooth = false;
  }
  const hold = () => root.setAttribute(INSTANT_SCROLL_ATTR, "");
  const release = () => root.removeAttribute(INSTANT_SCROLL_ATTR);
  ST.addEventListener("refreshInit", hold);
  ST.addEventListener("refresh", release);
  return () => {
    ST.removeEventListener("refreshInit", hold);
    ST.removeEventListener("refresh", release);
    release();
  };
}

/*
 * Quiet while unused.
 *
 * ScrollTrigger keeps two loops for as long as it is ENABLED, triggers or not: a
 * requestAnimationFrame loop (`_rafBugFix`, a repaint workaround) and a 250ms sync interval.
 * The director is its only user, and the site is a single-page app, so after a client
 * navigation from the WebGL home page to a service page both kept running for the rest of the
 * visit — measured (Stage C, headless Chromium, 10s idle windows): ~64 rAF callbacks and 4 extra
 * timer wakeups a second, ≈11ms of main-thread time a second against ≈1.6 on the same page
 * without them, and a frame loop that never lets the device idle.
 *
 * So the director quiets ScrollTrigger (`disable()`) once it has unmounted and no trigger is
 * left, and wakes it (`enable()`) before it creates triggers again (Back to the home page).
 * gsap 3.15.0's `enable()` is safe to call again after `disable()` — it re-adds its DOM
 * listeners, its interval, its resize delay and its loop — except that every call also
 * registers three more gsap events (matchMediaInit / matchMediaRevert / matchMedia) and one
 * more `(orientation: portrait)` matchMedia. A wake records exactly what its `enable()` added,
 * and the next quiet removes those again, so back-and-forth navigation never stacks them (the
 * set from the first, registration-time `enable()` is ScrollTrigger's own and stays).
 */

/** The parts of the gsap core a wake watches while ScrollTrigger enables itself. */
type GsapEvents = {
  addEventListener(type: string, callback: (...args: unknown[]) => void): void;
  removeEventListener(type: string, callback: (...args: unknown[]) => void): void;
  matchMedia(scope?: unknown): { kill(): void };
};

type ScrollTriggerSwitch = Pick<typeof ScrollTrigger, "enable" | "disable" | "getAll">;

let quiet = false;
/** Removes what the last wake's `enable()` registered with gsap (null: nothing to remove). */
let undoWake: (() => void) | null = null;

/** Quiet ScrollTrigger if nothing uses it any more. Returns whether it did. */
export function quietScrollTrigger(ST: ScrollTriggerSwitch): boolean {
  if (quiet || ST.getAll().length > 0) return false;
  ST.disable();
  undoWake?.();
  undoWake = null;
  quiet = true;
  return true;
}

/** Wake ScrollTrigger if a quiet put it to sleep. Returns whether it did. */
export function wakeScrollTrigger(ST: ScrollTriggerSwitch, core: object): boolean {
  if (!quiet) return false;
  const events = core as GsapEvents;
  const added: Array<[string, (...args: unknown[]) => void]> = [];
  const media: Array<{ kill(): void }> = [];
  const { addEventListener, matchMedia } = events;
  events.addEventListener = (type, callback) => {
    added.push([type, callback]);
    addEventListener.call(core, type, callback);
  };
  events.matchMedia = (scope) => {
    const created = matchMedia.call(core, scope);
    media.push(created);
    return created;
  };
  try {
    ST.enable();
  } finally {
    events.addEventListener = addEventListener;
    events.matchMedia = matchMedia;
  }
  undoWake = () => {
    for (const [type, callback] of added) events.removeEventListener(type, callback);
    for (const context of media) context.kill();
  };
  quiet = false;
  return true;
}

/** Tests only: forget the quiet state (the real ScrollTrigger is left as it is). */
export function resetScrollTriggerQuietForTests(): void {
  quiet = false;
  undoWake = null;
}

/*
 * Never a parallax target: an intro entrance marker (the entrance owns its inline transform
 * and must leave no style behind), a scroll-reveal element (its CSS transition owns
 * `transform`), <html> or <body>. Ancestors and descendants of those are fine.
 */
const NOT_A_PARALLAX_TARGET = `[${INTRO_REVEAL_ATTR}], [data-reveal]`;

/** The `[data-parallax="<layer>"]` elements under `scope` that a parallax tween may move. */
export function parallaxTargets(scope: ParentNode, layer: string): HTMLElement[] {
  const found = scope.querySelectorAll<HTMLElement>(`[${SCENE_ATTR.parallax}="${layer}"]`);
  return Array.from(found).filter(
    (el) =>
      el !== el.ownerDocument.documentElement &&
      el !== el.ownerDocument.body &&
      !el.matches(NOT_A_PARALLAX_TARGET),
  );
}
