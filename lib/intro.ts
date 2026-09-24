/**
 * The first-visit intro contract — names, timings and the one "the intro is over" signal,
 * shared by the server gate, the preloader, the cookie banner and the E2E helpers.
 *
 * Deliberately NOT a `"use client"` module and nothing here touches the DOM at import
 * time: a server component that imported a constant from a client module would receive a
 * client reference instead of the value, and `e2e/helpers.ts` imports it into Node. Every
 * function that needs `window`/`document` checks for it first and is a no-op on the server.
 */

/**
 * The cookie that suppresses the intro. **The site never writes it** — the intro plays on every
 * hard load of the home page. It exists so that a test run (or a QA session) can seed it and skip
 * the intro.
 *
 * It was renamed away from `tbs_intro` deliberately. That name had been written into every
 * visitor's browser while the intro played once per session, and those session cookies outlive a
 * deploy: honouring the old name would have left every returning visitor — and the client testing
 * the change — with no intro at all, looking exactly like the bug they reported.
 */
export const INTRO_COOKIE = "tbs_intro_skip";

/** The only value that counts. Anything else (or no cookie) means "play it". */
export const INTRO_SEEN = "seen";

/**
 * The cookie a visitor's browser may still be carrying from when the intro played once per
 * session. Nothing reads it any more — `INTRO_COOKIE` is a different name now — and
 * `finishIntro` clears it, so a browser that was open across the change stops suppressing the
 * intro without the visitor having to clear anything.
 */
export const INTRO_LEGACY_COOKIE = "tbs_intro";

/** Clears the legacy cookie, on the same path it was written with. */
export const INTRO_LEGACY_CLEAR_STRING = `${INTRO_LEGACY_COOKIE}=;path=/;max-age=0;samesite=lax`;

/** Fired once on `window` when the intro stops covering the page (played, skipped or bypassed). */
export const INTRO_EVENT = "tbs:intro-done";

/** The server-rendered overlay root. Its presence in the DOM is what "an intro is pending" means. */
export const INTRO_OVERLAY_ID = "tbs-intro";

/**
 * `localStorage[INTRO_FORCE_3D_KEY] === "force"` drops `failIfMajorPerformanceCaveat`, so a
 * software renderer (SwiftShader in headless Chromium) still gets the WebGL scene. QA/E2E
 * only; it changes what is drawn, never what the page does.
 */
export const INTRO_FORCE_3D_KEY = "tbs_intro_3d";

/** `detail` of `INTRO_EVENT`: did the animation actually run, or was it bypassed? */
export type IntroDoneDetail = { played: boolean };

export const INTRO_TIMING = {
  /**
   * Cinematic minimum for 0→100%, counted from navigation start.
   *
   * 4200, not 2400, and the reason is arithmetic rather than taste. The progress is capped by
   * the curve below, so the wall-clock length of every beat falls out of these two numbers —
   * and at 2400 the table was: beat 1 (the held frame on the die) **281 ms**, beat 2 (the
   * power-up, the light running back through the ribs, the fan and the fin stack) **536 ms**,
   * beat 3 (the crawl through the guts and up through the keyboard) **601 ms**. Half a second
   * for the whole power-up. The owner's report was that he could not see the animations, and
   * the numbers said he was right.
   */
  MIN_SYNC_MS: 5000,
  /**
   * The progress target is forced to 100% at this point, whatever is still loading.
   *
   * It has to stay clear of MIN_SYNC_MS or a slow load gets its film cut off and jumped to the
   * end: 1.4s of slack, and still 1.5s short of the shell's watchdog.
   */
  HARD_CAP_MS: 6400,
  /** Once JS takes over, the counter visibly runs for at least this long. */
  MIN_JS_RUN_MS: 600,
  /**
   * The most of the film that LOADING may consume before the director takes over.
   *
   * The cinematic clock counts from navigation start, because the visitor has been watching
   * since the first paint. That is right, and unbounded it is also how the film gets eaten:
   * measured on a slow machine, hydration finished at 2.07s, so the director opened with the
   * curve already at 64% and beat 2 — the whole power-up — ran for **144 ms**. Past this much,
   * the clock's origin slides forward instead, so however long the page took to arrive there is
   * always most of a film left to play.
   *
   * 250, not 1200, and the number is now load-bearing rather than cautious. The processor
   * section ends at --fb-p 0.34; at a 1200 ms pre-spend the curve is already at 0.4164 when the
   * director draws its first frame, so the ENTIRE processor — every new beat in it — would be
   * spent before anything was drawn. At 250 the curve opens at 0.086, inside the first beat.
   */
  MAX_PRE_SPEND_MS: 250,
  /** Hydration later than this (read off the CSS failsafe clock) bypasses the intro. */
  LATE_TAKEOVER_MS: 6400,
  /** The pre-hydration CSS failsafe's animation-delay — pinned against the CSS module by a test. */
  FAILSAFE_MS: 7000,
  /** The shell forces the overlay out if the director never reveals the page. */
  WATCHDOG_MS: 10000,
  /**
   * WebGL scene not ready by this share of the progress → the burst plays on the SVG.
   *
   * Read this as a deadline in seconds, not a share of the bar. Without `signals.scene` the
   * weighted readiness tops out at 0.15 + 0.15 + 0.30 = 0.60, so the shown progress cannot
   * reach 0.8 until `HARD_CAP_MS` forces the target to 1. The cutoff therefore only ever
   * fires in the ~300ms after 5 seconds: a scene that has not arrived by then hands over.
   */
  SCENE_CUTOFF: 0.8,
  /**
   * A scene that becomes ready this late is refused: the flight has no room left to start.
   *
   * The camera sequence is scrubbed from the progress, so a scene arriving at 0.86 would
   * cross-fade in with only the last beat to play — a half-transparent machine whipping into
   * the screen in under a second, over a drawing that is fading out. The drawing, already at
   * that beat, carries it instead.
   */
  LATE_SCENE_GOAL: 0.86,
} as const;

/**
 * The one custom property the director scrubs the static drawing with, 0 → 1.
 *
 * The drawing is a single SVG whose every part derives its own window from this value in CSS
 * (`clamp(0, (var(--fb-p) - a) / b, 1)`), so a frame costs one property write on one element.
 * Named here, next to the rest of the intro's contract, because the director writes it and the
 * preloader's stylesheet reads it — neither owns it.
 */
export const FB_PROGRESS_PROP = "--fb-p";

/** The attribute the page entrance looks up its targets by. No CSS rule may target it. */
export const INTRO_REVEAL_ATTR = "data-intro-reveal";

/** Entrance targets, in the order they come in after the burst. One element each. */
export const INTRO_REVEAL_ORDER = [
  "grid",
  "header",
  "eyebrow",
  "title",
  "lead",
  "cta",
  "stats",
  "ticker",
] as const;

export type IntroRevealTarget = (typeof INTRO_REVEAL_ORDER)[number];

/** Narrow a raw cookie value: only the literal `seen` counts. */
export function isIntroSeen(value: string | null | undefined): boolean {
  return value === INTRO_SEEN;
}

/** Read the intro cookie out of a `document.cookie` / `Cookie:` header string. */
export function readIntroSeen(cookieString: string | null | undefined): boolean {
  if (!cookieString) return false;
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${INTRO_COOKIE}=([^;]*)`));
  return isIntroSeen(match?.[1]);
}

/**
 * The server gate `app/(site)/layout.tsx` renders the overlay behind. True only for the home
 * page — `pathname` is proxy.ts's locale-stripped `x-pathname`, so `/ru` and `/en` count as
 * "/" — and only while the session cookie is absent (or holds anything but `seen`).
 *
 * It lives in the LAYOUT on purpose: layouts don't re-render on client navigation, so the
 * intro plays on a hard landing only, never on `/servicii/x` → Home or a Back into the cache.
 */
export function shouldPlayIntro(
  pathname: string | null | undefined,
  cookieValue: string | null | undefined,
): boolean {
  return pathname === "/" && !isIntroSeen(cookieValue);
}

/*
 * The module-level "done" flag closes a race the DOM alone cannot. `(site)/layout.tsx`
 * renders the preloader BEFORE `<CookieConsent/>`, and effects run in tree order — so a
 * synchronous bypass (reduced motion, a `#hash` deep link) finishes the intro and fires the
 * event before the banner has subscribed, while the overlay root is still in the DOM until
 * the next render. Without the flag the banner would see "pending", wait for an event that
 * already happened, and sit out the whole watchdog.
 */
let done = false;

/**
 * The intro is over: tell every listener, once.
 * Idempotent — skip and the end of the timeline can both call it in the same frame.
 *
 * **It no longer writes `INTRO_COOKIE`.** The intro used to play once per browser session, so a
 * reload never replayed it; the client reads that as the intro being broken ("la refresh nu
 * lucrează"). It now plays on every hard load of the home page. The cookie is still *honoured*
 * (`shouldPlayIntro` → `isIntroSeen`) so that anything which sets it — the e2e suite seeds it by
 * default — still skips the intro; the site itself just never sets it any more.
 */
export function finishIntro(detail: IntroDoneDetail): void {
  if (done || typeof window === "undefined") return;
  done = true;
  try {
    // Nothing reads it any more; clearing it keeps a stale session cookie from confusing anyone
    // looking at the browser's storage, and costs one assignment.
    document.cookie = INTRO_LEGACY_CLEAR_STRING;
  } catch {
    /* cookies blocked — there is nothing to clear in that browser either */
  }
  try {
    window.dispatchEvent(new CustomEvent<IntroDoneDetail>(INTRO_EVENT, { detail }));
  } catch {
    /* CustomEvent unsupported — `isIntroPending()` still reads false from the flag */
  }
}

/** Is an overlay on screen that has not finished yet? `false` on the server and on every page without one. */
export function isIntroPending(): boolean {
  return (
    !done && typeof document !== "undefined" && document.getElementById(INTRO_OVERLAY_ID) !== null
  );
}

/**
 * Run `callback` once the intro is over. When nothing is pending (no overlay on this page,
 * or it already finished) the callback runs SYNCHRONOUSLY with `{ played: false }` — the
 * caller was not kept waiting, and a banner can show in the same effect as it always did.
 * Returns an unsubscribe for effect cleanup.
 */
export function onIntroDone(callback: (detail: IntroDoneDetail) => void): () => void {
  if (!isIntroPending()) {
    callback({ played: false });
    return () => {};
  }
  const listener = (event: Event) => callback((event as CustomEvent<IntroDoneDetail>).detail);
  window.addEventListener(INTRO_EVENT, listener, { once: true });
  return () => window.removeEventListener(INTRO_EVENT, listener);
}

/**
 * Fired once on `window` when the overlay has actually LEFT the document — not at reveal
 * (`INTRO_EVENT`), which comes while the entrance still moves the page for up to ~2s. The
 * interior stage waits for this one before it measures or creates a WebGL context.
 */
export const INTRO_GONE_EVENT = "tbs:intro-gone";

let gone = false;

/**
 * The overlay is gone: tell every listener, once. A no-op while the overlay root is still in
 * the document — StrictMode's effect replay and a cleanup that runs before the commit both
 * land there — and on the server.
 */
export function markIntroGone(): void {
  if (gone || typeof window === "undefined" || typeof document === "undefined") return;
  if (document.getElementById(INTRO_OVERLAY_ID) !== null) return;
  gone = true;
  try {
    window.dispatchEvent(new Event(INTRO_GONE_EVENT));
  } catch {
    /* Event unsupported — `isIntroOnScreen()` still reads false from the flag */
  }
}

/** Is the overlay still covering the page (in the document, and not marked gone)? `false` on the server. */
export function isIntroOnScreen(): boolean {
  return (
    !gone && typeof document !== "undefined" && document.getElementById(INTRO_OVERLAY_ID) !== null
  );
}

/**
 * Run `callback` once the overlay is gone. SYNCHRONOUSLY when there is none on screen (a
 * returning visit, a client navigation back to the home page). Returns an unsubscribe.
 */
export function onIntroGone(callback: () => void): () => void {
  if (!isIntroOnScreen()) {
    callback();
    return () => {};
  }
  const listener = () => callback();
  window.addEventListener(INTRO_GONE_EVENT, listener, { once: true });
  return () => window.removeEventListener(INTRO_GONE_EVENT, listener);
}

/** Unit tests only: forget that an intro finished (or left) in this module instance. */
export function resetIntroForTests(): void {
  done = false;
  gone = false;
}
