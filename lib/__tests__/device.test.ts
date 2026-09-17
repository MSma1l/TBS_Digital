import { afterEach, describe, expect, it } from "vitest";
import {
  detectSceneTier,
  detectTier,
  mediaMatches,
  readDeviceProfile,
  type DeviceProfile,
  type DeviceTier,
} from "@/lib/device";

/*
 * Device tiers (lib/device.ts). The intro's rule is pinned unchanged; the interior's rule is
 * looser on phones, whose browsers under-report memory (Chrome rounds down) or cores (Safari).
 */

const desktop: DeviceProfile = { w: 1440, h: 900, dpr: 2, cores: 8, memory: 8, coarse: false };
const realMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(navigator, "deviceMemory");
});

describe("detectTier (the intro — unchanged)", () => {
  const table: Array<[string, Partial<DeviceProfile>, DeviceTier]> = [
    ["a capable desktop", {}, "high"],
    ["4 cores", { cores: 4 }, "low"],
    ["4 GB of memory", { memory: 4 }, "low"],
    ["a low-end touch phone", { w: 360, h: 780, cores: 4, coarse: true }, "low"],
    ["a touch-first device", { coarse: true }, "mid"],
    ["a short side under 600px", { w: 1280, h: 560 }, "mid"],
    ["a capable phone", { w: 390, h: 844, cores: 6, coarse: true }, "mid"],
    ["Safari: cores and memory unknown", { cores: undefined, memory: undefined }, "high"],
    ["a dense screen alone", { dpr: 3 }, "high"],
  ];

  for (const [name, overrides, tier] of table) {
    it(`${name} → ${tier}`, () => {
      expect(detectTier({ ...desktop, ...overrides })).toBe(tier);
    });
  }
});

describe("detectSceneTier (the interior)", () => {
  const phone: DeviceProfile = { w: 390, h: 844, dpr: 3, coarse: true };
  const table: Array<[string, DeviceProfile, DeviceTier]> = [
    ["a capable desktop", desktop, "high"],
    ["a desktop with 4 cores (the intro calls it low)", { ...desktop, cores: 4 }, "high"],
    ["a desktop reporting 4 GB (the intro calls it low)", { ...desktop, memory: 4 }, "high"],
    ["a desktop under 4 cores", { ...desktop, cores: 2 }, "low"],
    ["a desktop under 4 GB", { ...desktop, memory: 2 }, "low"],
    ["a desktop with a short side under 600px", { ...desktop, w: 1280, h: 560 }, "mid"],
    ["Safari desktop: nothing reported", { ...desktop, cores: undefined, memory: undefined }, "high"],
    ["an iPhone: nothing reported", phone, "mid"],
    ["a 6 GB Android reporting 4 GB and 8 cores", { ...phone, memory: 4, cores: 8 }, "mid"],
    ["a touch device with 4 cores", { ...phone, cores: 4 }, "mid"],
    ["a touch device with 2 cores (cores never decide on touch)", { ...phone, cores: 2 }, "mid"],
    ["a touch device under 4 GB", { ...phone, memory: 2 }, "low"],
    ["a large touch tablet is never high", { ...phone, w: 1366, h: 1024, memory: 8, cores: 8 }, "mid"],
  ];

  for (const [name, profile, tier] of table) {
    it(`${name} → ${tier}`, () => {
      expect(detectSceneTier(profile)).toBe(tier);
    });
  }
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

  it("readDeviceProfile reports the viewport, memory and a coarse pointer", () => {
    Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 4 });
    window.matchMedia = ((query: string) => ({
      matches: query === "(pointer: coarse)",
      media: query,
    })) as unknown as typeof window.matchMedia;

    const profile = readDeviceProfile();
    expect(profile).toMatchObject({
      w: window.innerWidth,
      h: window.innerHeight,
      memory: 4,
      coarse: true,
    });
    expect(profile.dpr).toBeGreaterThan(0);
  });
});
