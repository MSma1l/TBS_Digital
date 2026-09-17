import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HUD_ARM_EVENTS, HUD_DESKTOP_MEDIA, HUD_FLAG_KEY, readHudFlag } from "@/lib/hud/gate";

/*
 * The HUD chrome's arming contract (lib/hud/gate.ts): the QA switch, the interaction events
 * and the desktop breakpoint. The gate's ORDER is HudChrome's (components/__tests__/
 * hud-chrome.test.tsx); this file pins the names every consumer shares.
 */

beforeEach(() => {
  localStorage.removeItem(HUD_FLAG_KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem(HUD_FLAG_KEY);
});

describe("the QA switch", () => {
  it("is the tbs_hud localStorage key", () => {
    expect(HUD_FLAG_KEY).toBe("tbs_hud");
  });

  it("reads only the literal off", () => {
    expect(readHudFlag()).toBeNull();
    localStorage.setItem(HUD_FLAG_KEY, "off");
    expect(readHudFlag()).toBe("off");
    for (const value of ["OFF", "on", "", "false", "0", " off"]) {
      localStorage.setItem(HUD_FLAG_KEY, value);
      expect(readHudFlag(), JSON.stringify(value)).toBeNull();
    }
  });

  it("is null when storage throws", () => {
    localStorage.setItem(HUD_FLAG_KEY, "off");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readHudFlag()).toBeNull();
  });
});

describe("the arming events and the breakpoint", () => {
  it("lists every first interaction, focus included", () => {
    expect([...HUD_ARM_EVENTS]).toEqual([
      "pointermove",
      "pointerdown",
      "wheel",
      "scroll",
      "keydown",
      "touchstart",
      "focusin",
    ]);
  });

  it("puts the desktop HUD one pixel above the header's 860px breakpoint", () => {
    expect(HUD_DESKTOP_MEDIA).toBe("(min-width: 861px)");
  });
});

describe("lib/hud/gate without a DOM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
  });

  it("imports, and the reader is a quiet null", async () => {
    expect(typeof window).toBe("undefined");
    const gate = await import("@/lib/hud/gate");
    expect(gate.HUD_FLAG_KEY).toBe("tbs_hud");
    expect(gate.readHudFlag()).toBeNull();
  });

  it("imports nothing: playwright.config.ts loads it by relative path into Node", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/hud/gate.ts"), "utf8");
    expect(src).not.toMatch(/^\s*(import|export)\s[^;]*\sfrom\s/m);
    expect(src).not.toMatch(/\bimport\s*\(/);
    expect(src).not.toMatch(/^\s*["']use client["']/m);
  });
});
