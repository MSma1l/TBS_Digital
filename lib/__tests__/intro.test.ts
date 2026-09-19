import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTRO_COOKIE,
  INTRO_LEGACY_CLEAR_STRING,
  INTRO_EVENT,
  INTRO_GONE_EVENT,
  INTRO_OVERLAY_ID,
  INTRO_REVEAL_ORDER,
  INTRO_SEEN,
  INTRO_TIMING,
  finishIntro,
  isIntroOnScreen,
  isIntroPending,
  isIntroSeen,
  markIntroGone,
  onIntroDone,
  onIntroGone,
  readIntroSeen,
  resetIntroForTests,
  shouldPlayIntro,
  type IntroDoneDetail,
} from "@/lib/intro";

/*
 * The intro contract (lib/intro.ts), in a real DOM.
 *
 * "Pending" is the server-rendered overlay root in the document AND no finishIntro() yet;
 * each test starts with neither, and with the session cookie expired.
 */

function mountOverlay(): HTMLElement {
  const el = document.createElement("div");
  el.id = INTRO_OVERLAY_ID;
  document.body.appendChild(el);
  return el;
}

function listenForDone() {
  const detail = vi.fn<(detail: IntroDoneDetail) => void>();
  const listener = (event: Event) => detail((event as CustomEvent<IntroDoneDetail>).detail);
  window.addEventListener(INTRO_EVENT, listener);
  return { detail, stop: () => window.removeEventListener(INTRO_EVENT, listener) };
}

beforeEach(() => {
  resetIntroForTests();
  document.cookie = `${INTRO_COOKIE}=;path=/;max-age=0`;
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
});

afterEach(() => {
  document.getElementById(INTRO_OVERLAY_ID)?.remove();
});

describe("intro cookie", () => {
  it("counts only the literal value `seen`", () => {
    expect(isIntroSeen(INTRO_SEEN)).toBe(true);
    expect(isIntroSeen("seenx")).toBe(false);
    expect(isIntroSeen("Seen")).toBe(false);
    expect(isIntroSeen("")).toBe(false);
    expect(isIntroSeen(null)).toBe(false);
    expect(isIntroSeen(undefined)).toBe(false);
  });

  it("reads the cookie out of a cookie string by its exact name", () => {
    expect(readIntroSeen(`a=1; ${INTRO_COOKIE}=seen`)).toBe(true);
    expect(readIntroSeen(`${INTRO_COOKIE}=seen;b=2`)).toBe(true);
    expect(readIntroSeen(`x${INTRO_COOKIE}=seen`)).toBe(false);
    expect(readIntroSeen(`${INTRO_COOKIE}=junk`)).toBe(false);
    expect(readIntroSeen(`${INTRO_COOKIE}=`)).toBe(false);
    expect(readIntroSeen("")).toBe(false);
    expect(readIntroSeen(undefined)).toBe(false);
  });

  /* The rename is the whole point: a browser still carrying the old session cookie from when
     the intro played once per session must NOT be read as "already seen". */
  it("does not answer to the name it used to have", () => {
    expect(INTRO_COOKIE).not.toBe("tbs_intro");
    expect(readIntroSeen("tbs_intro=seen")).toBe(false);
  });

  it("clears the legacy cookie on the path it was written with, and expires it", () => {
    expect(INTRO_LEGACY_CLEAR_STRING).toBe("tbs_intro=;path=/;max-age=0;samesite=lax");
    expect(readIntroSeen(INTRO_LEGACY_CLEAR_STRING)).toBe(false);
  });
});

describe("finishIntro", () => {
  /* The site never suppresses its own intro: it plays on every hard load of the home page.
     The one cookie write is the legacy clear, so a browser open across the rename recovers. */
  it("writes only the legacy clear, and never marks the intro as seen", () => {
    const setCookie = vi.spyOn(Document.prototype, "cookie", "set");
    finishIntro({ played: true });
    expect(setCookie).toHaveBeenCalledTimes(1);
    expect(setCookie).toHaveBeenCalledWith(INTRO_LEGACY_CLEAR_STRING);
    setCookie.mockRestore();
    expect(readIntroSeen(document.cookie)).toBe(false);
  });

  it("dispatches INTRO_EVENT with the detail it was given", () => {
    const events = listenForDone();
    finishIntro({ played: true });
    events.stop();
    expect(events.detail).toHaveBeenCalledTimes(1);
    expect(events.detail).toHaveBeenCalledWith({ played: true });
  });

  it("is idempotent: skip and the end of the timeline racing fire the event once", () => {
    const events = listenForDone();
    finishIntro({ played: true });
    finishIntro({ played: false });
    events.stop();
    expect(events.detail).toHaveBeenCalledTimes(1);
    expect(events.detail).toHaveBeenCalledWith({ played: true });
  });

  it("still fires the event when cookies are blocked", () => {
    const setCookie = vi.spyOn(Document.prototype, "cookie", "set").mockImplementation(() => {
      throw new Error("cookies blocked");
    });
    const events = listenForDone();
    expect(() => finishIntro({ played: false })).not.toThrow();
    events.stop();
    setCookie.mockRestore();
    expect(events.detail).toHaveBeenCalledTimes(1);
  });
});

describe("isIntroPending", () => {
  it("is false on a page without the overlay (a service page, a returning visit)", () => {
    expect(isIntroPending()).toBe(false);
  });

  it("is true while the overlay root is in the document", () => {
    mountOverlay();
    expect(isIntroPending()).toBe(true);
  });

  it("is false after finishIntro even though the overlay has not unmounted yet", () => {
    mountOverlay();
    finishIntro({ played: false });
    expect(document.getElementById(INTRO_OVERLAY_ID)).not.toBeNull();
    expect(isIntroPending()).toBe(false);
  });
});

describe("onIntroDone", () => {
  it("calls back synchronously, with played:false, when nothing is pending", () => {
    const callback = vi.fn();
    const unsubscribe = onIntroDone(callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ played: false });
    expect(() => unsubscribe()).not.toThrow();
  });

  it("waits while the intro is pending, then calls back once with the event's detail", () => {
    mountOverlay();
    const callback = vi.fn();
    onIntroDone(callback);
    expect(callback).not.toHaveBeenCalled();

    finishIntro({ played: true });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ played: true });

    // A second dispatch (from anywhere) does not call it again.
    window.dispatchEvent(new CustomEvent(INTRO_EVENT, { detail: { played: false } }));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("never calls back after unsubscribe", () => {
    mountOverlay();
    const callback = vi.fn();
    const unsubscribe = onIntroDone(callback);
    unsubscribe();
    finishIntro({ played: true });
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls back synchronously when the intro finished before the subscription (the effect-order race)", () => {
    mountOverlay();
    finishIntro({ played: false });
    const callback = vi.fn();
    onIntroDone(callback);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe("onIntroGone (the overlay has left the document)", () => {
  function countGone() {
    const listener = vi.fn();
    window.addEventListener(INTRO_GONE_EVENT, listener);
    return { listener, stop: () => window.removeEventListener(INTRO_GONE_EVENT, listener) };
  }

  it("calls back synchronously when no overlay is on screen", () => {
    const callback = vi.fn();
    const unsubscribe = onIntroGone(callback);
    expect(isIntroOnScreen()).toBe(false);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("waits while the overlay is attached — even after the reveal — then calls back once", () => {
    const el = mountOverlay();
    const callback = vi.fn();
    onIntroGone(callback);
    finishIntro({ played: true });
    expect(isIntroOnScreen()).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    el.remove();
    markIntroGone();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(isIntroOnScreen()).toBe(false);

    window.dispatchEvent(new Event(INTRO_GONE_EVENT));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("markIntroGone is a no-op while the overlay is still connected", () => {
    const el = mountOverlay();
    const events = countGone();
    const callback = vi.fn();
    onIntroGone(callback);

    markIntroGone();
    expect(events.listener).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
    expect(isIntroOnScreen()).toBe(true);

    el.remove();
    markIntroGone();
    events.stop();
    expect(events.listener).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("fires the event once, however many times it is marked", () => {
    const el = mountOverlay();
    const events = countGone();
    el.remove();
    markIntroGone();
    markIntroGone();
    events.stop();
    expect(events.listener).toHaveBeenCalledTimes(1);
  });

  it("never calls back after unsubscribe", () => {
    const el = mountOverlay();
    const callback = vi.fn();
    const unsubscribe = onIntroGone(callback);
    unsubscribe();
    el.remove();
    markIntroGone();
    expect(callback).not.toHaveBeenCalled();
  });

  it("stays gone for the module instance until reset (a later overlay is not on screen)", () => {
    mountOverlay().remove();
    markIntroGone();
    mountOverlay();
    expect(isIntroOnScreen()).toBe(false);
    resetIntroForTests();
    expect(isIntroOnScreen()).toBe(true);
  });
});

describe("intro timings and entrance order", () => {
  it("keeps the failsafes in a sane order", () => {
    const t = INTRO_TIMING;
    expect(t.MIN_SYNC_MS).toBeLessThan(t.HARD_CAP_MS);
    expect(t.MIN_JS_RUN_MS).toBeLessThan(t.MIN_SYNC_MS);
    // A late takeover must be decided before the CSS failsafe starts fading the overlay…
    expect(t.LATE_TAKEOVER_MS).toBeLessThan(t.FAILSAFE_MS);
    // …and the JS watchdog only fires after the CSS one would have.
    expect(t.FAILSAFE_MS).toBeLessThan(t.WATCHDOG_MS);
    expect(t.SCENE_CUTOFF).toBeGreaterThan(0);
    expect(t.SCENE_CUTOFF).toBeLessThan(1);
  });

  it("names each entrance target once, in order", () => {
    expect(INTRO_REVEAL_ORDER).toEqual([
      "grid",
      "header",
      "eyebrow",
      "title",
      "lead",
      "cta",
      "stats",
      "ticker",
    ]);
  });
});

describe("shouldPlayIntro (the server gate in app/(site)/layout.tsx)", () => {
  it("plays on the home page for a visitor without the cookie", () => {
    expect(shouldPlayIntro("/", undefined)).toBe(true);
  });

  it("plays when the cookie holds anything but `seen`", () => {
    expect(shouldPlayIntro("/", "junk")).toBe(true);
    expect(shouldPlayIntro("/", "")).toBe(true);
    expect(shouldPlayIntro("/", null)).toBe(true);
  });

  it("never plays again once the session cookie says seen", () => {
    expect(shouldPlayIntro("/", INTRO_SEEN)).toBe(false);
  });

  it("never plays off the home page, or when the path is unknown", () => {
    for (const path of ["/servicii/e-commerce", "/cookies", "/ru", "/en/", "//", ""]) {
      expect(shouldPlayIntro(path, undefined)).toBe(false);
    }
    expect(shouldPlayIntro(null, undefined)).toBe(false);
    expect(shouldPlayIntro(undefined, undefined)).toBe(false);
  });
});
