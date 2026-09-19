import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SCENE_TOKENS,
  parseTokenColor,
  pickSceneRoles,
  readScenePalette,
  type SceneTokenValues,
} from "@/components/scene/three/palette";

/*
 * The interior scene's colours come from the site's tokens, never literals. There is ONE mode:
 * the page is always near-black, so the scene always draws in "glow" — light added to it, neon
 * on dark. The light theme and everything that watched for a theme switch went with it
 * (58b18ee "Removed: sunetul si tema deschisa"); `uInk` survives in the shaders, permanently 0.
 * The palette module is pure — no three.js — so the role table is pinned here.
 */

/** The token values of globals.css. */
const DARK: SceneTokenValues = {
  cyan: "#4fc3e8",
  blue: "#3970ff",
  redLift: "#ff5362",
  txt: "#f6f7fb",
  bg: "#0a0b10",
};

const rgb = (hex: string) => parseTokenColor(hex)!;

describe("parseTokenColor", () => {
  it("reads hex and rgb() tokens as sRGB 0..1", () => {
    expect(parseTokenColor("#ffffff")).toEqual([1, 1, 1]);
    expect(parseTokenColor("#0a0b10")).toEqual([10 / 255, 11 / 255, 16 / 255]);
    expect(parseTokenColor(" #f0a ")).toEqual([1, 0, 170 / 255]);
    expect(parseTokenColor("rgb(255, 0, 51)")).toEqual([1, 0, 51 / 255]);
  });

  it("refuses what THREE.Color would not parse cleanly", () => {
    for (const value of ["", "var(--dark-cyan)", "oklch(60% 0.2 20)", "color-mix(in srgb, red, blue)", "rgba(0,0,0,.5)", "rgb(300, 0, 0)", "#12345"]) {
      expect(parseTokenColor(value), value).toBeNull();
    }
  });
});

describe("pickSceneRoles", () => {
  it("the tokens → glow: neon blue, the lifted red", () => {
    const palette = pickSceneRoles(DARK);
    expect(palette.mode).toBe("glow");
    expect(palette.cyan).toEqual(rgb(DARK.cyan));
    expect(palette.blue).toEqual(rgb(DARK.blue));
    expect(palette.red).toEqual(rgb(DARK.redLift));
    expect(palette.hot).toEqual(rgb(DARK.txt));
    expect(palette.bg).toEqual(rgb(DARK.bg));
    // The glass core's roles (tint, attenuation) left with it: nothing reads --on-accent.
    expect(Object.keys(palette).sort()).toEqual(["bg", "blue", "cyan", "hot", "mode", "red"]);
    expect(Object.values(SCENE_TOKENS)).not.toContain("--on-accent");
  });

  it("reads five tokens and no theme-dependent one: --blue-text and --red-text left with the light theme", () => {
    expect(Object.keys(SCENE_TOKENS).sort()).toEqual(["bg", "blue", "cyan", "redLift", "txt"]);
    expect(Object.values(SCENE_TOKENS)).not.toContain("--blue-text");
    expect(Object.values(SCENE_TOKENS)).not.toContain("--red-text");
  });

  it("an unparsable token throws a descriptive error naming it", () => {
    expect(() => pickSceneRoles({ ...DARK, redLift: "oklch(60% 0.2 20)" })).toThrow(/--red-lift.*oklch/);
    expect(() => pickSceneRoles({ ...DARK, bg: "" })).toThrow(/--bg/);
  });
});

describe("readScenePalette — from the document", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubTokens(values: SceneTokenValues) {
    const byToken = Object.fromEntries(
      (Object.keys(SCENE_TOKENS) as Array<keyof typeof SCENE_TOKENS>).map((role) => [SCENE_TOKENS[role], values[role]]),
    );
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () => ({ getPropertyValue: (name: string) => ` ${byToken[name] ?? ""} ` }) as CSSStyleDeclaration,
    );
  }

  it("reads every role's custom property from <html>", () => {
    stubTokens(DARK);
    expect(readScenePalette()).toEqual(pickSceneRoles(DARK));
    expect(window.getComputedStyle).toHaveBeenCalledWith(document.documentElement);
  });

  it("throws on a bad token, naming it — the stage's error boundary keeps the static art", () => {
    stubTokens({ ...DARK, cyan: "var(--dark-cyan)" });
    expect(() => readScenePalette()).toThrow(/--cyan/);
  });
});
