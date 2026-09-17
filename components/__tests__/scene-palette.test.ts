import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INK_LUMINANCE,
  SCENE_TOKENS,
  observeThemeChange,
  parseTokenColor,
  pickSceneRoles,
  readScenePalette,
  relativeLuminance,
  samePalette,
  tryReadScenePalette,
  type SceneTokenValues,
} from "@/components/scene/three/palette";

/*
 * The interior scene's colours come from the site's tokens, never literals, and a theme switch
 * only swaps roles and blend factors. Dark ("glow") adds neon light to the page; light ("ink")
 * draws with the darker text tones. The palette module is pure — no three.js — so the role
 * table is pinned here.
 */

/** The token values of globals.css, dark and light. */
const DARK: SceneTokenValues = {
  cyan: "#4fc3e8",
  blue: "#3970ff",
  blueText: "#8fb0ff",
  redLift: "#ff5362",
  redText: "#ff6b7b",
  txt: "#f6f7fb",
  bg: "#0a0b10",
  onAccent: "#ffffff",
};
const LIGHT: SceneTokenValues = {
  cyan: "#0e93b9",
  blue: "#3970ff",
  blueText: "#2a56d6",
  redLift: "#ff5362",
  redText: "#d41026",
  txt: "#10172a",
  bg: "#f4f7ff",
  onAccent: "#ffffff",
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

  it("relative luminance splits the two themes", () => {
    expect(relativeLuminance(rgb(DARK.bg))).toBeLessThan(INK_LUMINANCE);
    expect(relativeLuminance(rgb(LIGHT.bg))).toBeGreaterThan(INK_LUMINANCE);
  });
});

describe("pickSceneRoles", () => {
  it("dark tokens → glow: neon blue, the lifted red, a blue glass body", () => {
    const palette = pickSceneRoles(DARK);
    expect(palette.mode).toBe("glow");
    expect(palette.cyan).toEqual(rgb(DARK.cyan));
    expect(palette.blue).toEqual(rgb(DARK.blue));
    expect(palette.red).toEqual(rgb(DARK.redLift));
    expect(palette.hot).toEqual(rgb(DARK.txt));
    expect(palette.bg).toEqual(rgb(DARK.bg));
    expect(palette.glassTint).toEqual(rgb(DARK.onAccent));
    expect(palette.attenuation).toEqual(rgb(DARK.blue));
  });

  it("light tokens → ink: the text tones, a cyan glass body", () => {
    const palette = pickSceneRoles(LIGHT);
    expect(palette.mode).toBe("ink");
    expect(palette.cyan).toEqual(rgb(LIGHT.cyan));
    expect(palette.blue).toEqual(rgb(LIGHT.blueText));
    expect(palette.red).toEqual(rgb(LIGHT.redText));
    expect(palette.hot).toEqual(rgb(LIGHT.txt));
    expect(palette.attenuation).toEqual(rgb(LIGHT.cyan));
  });

  it("an unparsable token throws a descriptive error naming it", () => {
    expect(() => pickSceneRoles({ ...DARK, redLift: "oklch(60% 0.2 20)" })).toThrow(/--red-lift.*oklch/);
    expect(() => pickSceneRoles({ ...DARK, bg: "" })).toThrow(/--bg/);
  });

  it("samePalette compares every role", () => {
    expect(samePalette(pickSceneRoles(DARK), pickSceneRoles({ ...DARK }))).toBe(true);
    expect(samePalette(pickSceneRoles(DARK), pickSceneRoles(LIGHT))).toBe(false);
    expect(samePalette(pickSceneRoles(DARK), pickSceneRoles({ ...DARK, cyan: "#4fc3e9" }))).toBe(false);
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
    stubTokens(LIGHT);
    expect(readScenePalette()).toEqual(pickSceneRoles(LIGHT));
    expect(window.getComputedStyle).toHaveBeenCalledWith(document.documentElement);
  });

  it("tryReadScenePalette keeps quiet on a bad token (the caller keeps its palette)", () => {
    stubTokens({ ...DARK, cyan: "var(--dark-cyan)" });
    expect(() => readScenePalette()).toThrow(/--cyan/);
    expect(tryReadScenePalette()).toBeNull();
  });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("observeThemeChange", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    vi.restoreAllMocks();
  });

  it("fires on a data-theme flip and an OS colour-scheme change, until cleaned up", async () => {
    let schemeListener: (() => void) | null = null;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: (_type: string, listener: () => void) => {
            schemeListener = listener;
          },
          removeEventListener: () => {
            schemeListener = null;
          },
        }) as unknown as MediaQueryList,
    );
    const onChange = vi.fn();
    const stop = observeThemeChange(onChange);
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");

    document.documentElement.setAttribute("data-theme", "light");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);

    document.documentElement.setAttribute("data-lang", "ro");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);
    document.documentElement.removeAttribute("data-lang");

    (schemeListener as (() => void) | null)?.();
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    expect(schemeListener).toBeNull();
    document.documentElement.setAttribute("data-theme", "dark");
    await flush();
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
