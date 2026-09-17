import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAGE_COVER_EVENT,
  coverPage,
  hasClassicScrollbar,
  isPageCovered,
  lockRootScroll,
  subscribePageCover,
} from "@/lib/scrollLock";

/*
 * The shared page scroll lock (burger menu + intro). It owns three inline styles and
 * nothing else; `<body>`'s position belongs to Modal.
 */

const root = () => document.documentElement.style;
const body = () => document.body.style;

/*
 * jsdom has no layout: `clientWidth` is 0 and `innerWidth` 1024. Each test says which kind of
 * scrollbar the page has by pinning `<html>`'s clientWidth against the window width.
 */
function scrollbar(kind: "classic" | "overlay") {
  const width = kind === "classic" ? window.innerWidth - 15 : window.innerWidth;
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    get: () => width,
  });
}

function clearStyles() {
  document.documentElement.removeAttribute("style");
  document.body.removeAttribute("style");
}

beforeEach(() => {
  clearStyles();
  scrollbar("classic");
});
afterEach(() => {
  clearStyles();
  Reflect.deleteProperty(document.documentElement, "clientWidth");
});

describe("hasClassicScrollbar", () => {
  it("is true only when the scrollbar takes layout width", () => {
    expect(hasClassicScrollbar(320, 305)).toBe(true);
    expect(hasClassicScrollbar(1280, 1265)).toBe(true);
    // overlay scrollbars (phones), hidden scrollbars, a page that does not scroll
    expect(hasClassicScrollbar(320, 320)).toBe(false);
    // a zoomed / fractional viewport can report the root wider than the window
    expect(hasClassicScrollbar(320, 321)).toBe(false);
  });

  it("says no to numbers it cannot trust", () => {
    expect(hasClassicScrollbar(Number.NaN, 300)).toBe(false);
    expect(hasClassicScrollbar(320, Number.NaN)).toBe(false);
    expect(hasClassicScrollbar(Number.POSITIVE_INFINITY, 300)).toBe(false);
  });
});

describe("lockRootScroll", () => {
  it("locks <html>, reserves the scrollbar gutter and lets the body overflow", () => {
    const unlock = lockRootScroll();
    expect(root().overflow).toBe("hidden");
    expect(root().scrollbarGutter).toBe("stable");
    expect(body().overflowX).toBe("visible");
    unlock();
    expect(root().overflow).toBe("");
    expect(root().scrollbarGutter).toBe("");
    expect(body().overflowX).toBe("");
  });

  it("reserves no gutter when the scrollbar takes no width (overlay or hidden scrollbars)", () => {
    // A "stable" gutter here would narrow the page by a scrollbar that was never there,
    // reflow it taller and let scroll anchoring move the visitor.
    scrollbar("overlay");
    const unlock = lockRootScroll();
    expect(root().overflow).toBe("hidden");
    expect(root().scrollbarGutter).toBe("");
    expect(body().overflowX).toBe("visible");
    unlock();
    expect(document.documentElement.hasAttribute("style")).toBe(false);
  });

  it("decides the gutter once, on the first lock, before the scrollbar is hidden", () => {
    const unlockMenu = lockRootScroll();
    // With overflow hidden the scrollbar is gone and the root reads as wide as the window;
    // a nested lock must not undo the reservation because of that.
    scrollbar("overlay");
    const unlockIntro = lockRootScroll();
    expect(root().scrollbarGutter).toBe("stable");
    unlockIntro();
    expect(root().scrollbarGutter).toBe("stable");
    unlockMenu();
    expect(root().scrollbarGutter).toBe("");
  });

  it("restores inline values that were there before, instead of blanking them", () => {
    root().overflow = "clip";
    root().scrollbarGutter = "auto";
    body().overflowX = "hidden";

    const unlock = lockRootScroll();
    expect(root().overflow).toBe("hidden");
    unlock();

    expect(root().overflow).toBe("clip");
    expect(root().scrollbarGutter).toBe("auto");
    expect(body().overflowX).toBe("hidden");
  });

  it("keeps a restored style attribute, and unrelated inline styles, in place", () => {
    root().overflow = "clip";
    body().color = "red";

    lockRootScroll()();

    expect(document.documentElement.getAttribute("style")).toBe("overflow: clip;");
    expect(document.body.getAttribute("style")).toBe("color: red;");
  });

  it("stays locked until the last of several overlapping locks is released", () => {
    root().overflow = "clip";
    const unlockMenu = lockRootScroll();
    const unlockIntro = lockRootScroll();

    unlockMenu();
    expect(root().overflow).toBe("hidden");
    expect(body().overflowX).toBe("visible");

    unlockIntro();
    expect(root().overflow).toBe("clip");
    expect(body().overflowX).toBe("");
  });

  it("ignores a second call to the same unlock", () => {
    const unlockA = lockRootScroll();
    const unlockB = lockRootScroll();

    unlockA();
    unlockA(); // would otherwise release B's lock too
    expect(root().overflow).toBe("hidden");

    unlockB();
    expect(root().overflow).toBe("");
  });

  it("can lock again after a full release, snapshotting the values of that moment", () => {
    lockRootScroll()();
    root().overflow = "scroll";
    const unlock = lockRootScroll();
    expect(root().overflow).toBe("hidden");
    unlock();
    expect(root().overflow).toBe("scroll");
  });

  it("never touches <body>'s position or offset, which Modal owns", () => {
    body().position = "fixed";
    body().top = "-800px";
    const unlock = lockRootScroll();
    expect(body().position).toBe("fixed");
    expect(body().top).toBe("-800px");
    unlock();
    expect(body().position).toBe("fixed");
    expect(body().top).toBe("-800px");
  });

  it("leaves no style attribute behind on a page that had none", () => {
    const unlock = lockRootScroll();
    unlock();
    expect(document.body.hasAttribute("style")).toBe(false);
    expect(document.documentElement.hasAttribute("style")).toBe(false);
  });

  it("covers the page for as long as any lock is held", () => {
    expect(isPageCovered()).toBe(false);
    const unlockMenu = lockRootScroll();
    const unlockIntro = lockRootScroll();
    expect(isPageCovered()).toBe(true);
    unlockMenu();
    unlockMenu();
    expect(isPageCovered()).toBe(true);
    unlockIntro();
    expect(isPageCovered()).toBe(false);
  });

  it("lifts the cover only after the page's styles are restored (a listener may measure it then)", () => {
    root().overflow = "scroll";
    const seen: Array<{ covered: boolean; overflow: string; bodyOverflowX: string }> = [];
    const listener = () =>
      seen.push({ covered: isPageCovered(), overflow: root().overflow, bodyOverflowX: body().overflowX });
    const unlock = lockRootScroll();
    window.addEventListener(PAGE_COVER_EVENT, listener);
    try {
      unlock();
    } finally {
      window.removeEventListener(PAGE_COVER_EVENT, listener);
    }
    expect(seen).toEqual([{ covered: false, overflow: "scroll", bodyOverflowX: "" }]);
  });
});

describe("coverPage", () => {
  /** Every PAGE_COVER_EVENT, with the covered state at that moment. */
  function listen() {
    const seen: boolean[] = [];
    const listener = () => seen.push(isPageCovered());
    window.addEventListener(PAGE_COVER_EVENT, listener);
    return { seen, stop: () => window.removeEventListener(PAGE_COVER_EVENT, listener) };
  }

  it("announces each 0 ↔ 1 change once, and nested covers never re-announce", () => {
    const events = listen();
    try {
      const releaseMenu = coverPage();
      expect(events.seen).toEqual([true]);
      const releaseDialog = coverPage();
      const releaseLock = lockRootScroll();
      expect(events.seen).toEqual([true]);

      releaseDialog();
      releaseLock();
      expect(events.seen).toEqual([true]);
      releaseMenu();
      expect(events.seen).toEqual([true, false]);

      coverPage()();
      expect(events.seen).toEqual([true, false, true, false]);
    } finally {
      events.stop();
    }
  });

  it("ignores a second call to the same release", () => {
    const releaseA = coverPage();
    const releaseB = coverPage();
    releaseA();
    releaseA(); // would otherwise release B's cover too
    expect(isPageCovered()).toBe(true);
    releaseB();
    expect(isPageCovered()).toBe(false);
  });

  it("subscribePageCover hears every change until it unsubscribes", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribePageCover(onChange);
    const release = coverPage();
    expect(onChange).toHaveBeenCalledTimes(1);
    release();
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    coverPage()();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
