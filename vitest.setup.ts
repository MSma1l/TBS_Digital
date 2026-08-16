import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom ships no matchMedia, so any component mounting useAutoCarousel throws.
// Report "no match" — the carousel then behaves like desktop with motion allowed,
// which is the branch the section tests care about.
//
// Deliberately a plain function, not vi.fn(): `restoreMocks: true` in
// vitest.config.ts wipes mock implementations between tests, which would leave
// matchMedia returning undefined for every test after the first.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// jsdom has no IntersectionObserver either, and `components/ui/Reveal.tsx` constructs one
// on mount — so every section that wraps itself in <Reveal> (Estimator, Team, Principles…)
// threw "IntersectionObserver is not defined" the moment it rendered. Test files used to
// stub it locally, or forget to and fail; this makes it global.
//
// The stub reveals immediately by invoking the callback with `isIntersecting: true`, which
// is the state the tests care about — content visible, not mid-animation.
// `typeof …` rather than the `in` operator: `in` narrows `window` to `never` inside the
// block, so the assignment at the end wouldn't typecheck.
if (typeof window.IntersectionObserver === "undefined") {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    private readonly cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      this.cb(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  window.IntersectionObserver =
    StubIntersectionObserver as unknown as typeof IntersectionObserver;
}

// Unmount React trees between tests so the DOM never leaks across cases.
afterEach(() => {
  cleanup();
});
