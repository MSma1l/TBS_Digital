import { afterEach, describe, expect, it } from "vitest";
import { mediaMatches, PREFERS_REDUCED_MOTION } from "@/lib/device";

/* Media-preference reads (lib/device.ts). */

const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe("reading the device", () => {
  it("mediaMatches is false without matchMedia, and follows it otherwise", () => {
    Reflect.deleteProperty(window, "matchMedia");
    expect(mediaMatches("(pointer: coarse)")).toBe(false);
    window.matchMedia = ((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
    })) as unknown as typeof window.matchMedia;
    expect(mediaMatches("(pointer: coarse)")).toBe(true);
    expect(mediaMatches("(pointer: fine)")).toBe(false);
  });

  it("names the reduced-motion query", () => {
    expect(PREFERS_REDUCED_MOTION).toBe("(prefers-reduced-motion: reduce)");
  });
});
