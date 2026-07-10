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

// Unmount React trees between tests so the DOM never leaks across cases.
afterEach(() => {
  cleanup();
});
