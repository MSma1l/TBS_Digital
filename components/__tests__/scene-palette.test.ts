import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SCENE_TOKENS,
  parseTokenColor,
  glowPalette,
  pickSceneRoles,
  readScenePalette,
  type SceneTokenValues,
} from "@/components/scene/three/palette";

/*
 * The interior scene's colours come from the site's tokens, never literals. The page colour picks
 * the mode: on the dark palette (<html data-theme="dark">) the scene draws in "glow" (light
 * added, neon on dark); on the light one — the default — it draws in "ink" (premultiplied
 * "over", the darker text tones), so `uInk` is 1. The palette module is pure — no three.js — so
 * the role table is pinned here.
 */

/** The token values of globals.css, light (the default palette). */
const LIGHT: SceneTokenValues = {
  cyan: "#0e93b9",
  blue: "#3970ff",
  blueText: "#2a56d6",
  redLift: "#ff5362",
  redText: "#d41026",
  txt: "#10172a",
  bg: "#f4f7ff",
  ink: "#111a31",
  onInk: "#dbe5ff",
};

/** The token values of globals.css, dark (the :root[data-theme="dark"] remap). */
const DARK: SceneTokenValues = {
  cyan: "#4fc3e8",
  blue: "#3970ff",
  blueText: "#8fb0ff",
  redLift: "#ff5362",
  redText: "#ff6b7b",
  txt: "#f6f7fb",
  bg: "#101422",
  ink: "#1d2540",
  onInk: "#dbe5ff",
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
    expect(Object.keys(palette).sort()).toEqual(["bg", "blue", "cyan", "glow", "hot", "mode", "panel", "red"]);
    // On a dark page the glow tones ARE the roles: the hologram draws exactly as everything else.
    expect(palette.glow).toEqual({ cyan: palette.cyan, blue: palette.blue, red: palette.red, hot: palette.hot });
    expect(glowPalette(palette)).toBe(palette);
    expect(Object.values(SCENE_TOKENS)).not.toContain("--on-accent");
  });

  it("the light page → ink: the darker text tones, the text colour as the highlight", () => {
    const palette = pickSceneRoles(LIGHT);
    expect(palette.mode).toBe("ink");
    expect(palette.blue).toEqual(rgb(LIGHT.blueText));
    expect(palette.red).toEqual(rgb(LIGHT.redText));
    expect(palette.hot).toEqual(rgb(LIGHT.txt));
  });

  it("the light page keeps the glow tones and the --ink panel for the Work hologram's dark screen", () => {
    const palette = pickSceneRoles(LIGHT);
    expect(palette.panel).toEqual(rgb(LIGHT.ink));
    // The neon fills, the lifted red and a light highlight (--on-ink: text on the ink island).
    expect(palette.glow).toEqual({ cyan: rgb(LIGHT.cyan), blue: rgb(LIGHT.blue), red: rgb(LIGHT.redLift), hot: rgb(LIGHT.onInk) });
    const glow = glowPalette(palette);
    expect(glow.mode).toBe("glow");
    expect([glow.cyan, glow.blue, glow.red, glow.hot]).toEqual([palette.glow.cyan, palette.glow.blue, palette.glow.red, palette.glow.hot]);
    expect(glow.panel).toEqual(palette.panel);
    // Pure: the ink palette itself is untouched.
    expect(palette.mode).toBe("ink");
    expect(palette.hot).toEqual(rgb(LIGHT.txt));
  });

  it("reads nine tokens, the text tones and the ink island included", () => {
    expect(Object.keys(SCENE_TOKENS).sort()).toEqual(["bg", "blue", "blueText", "cyan", "ink", "onInk", "redLift", "redText", "txt"]);
    expect(SCENE_TOKENS.ink).toBe("--ink");
    expect(SCENE_TOKENS.onInk).toBe("--on-ink");
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
    stubTokens(LIGHT);
    expect(readScenePalette()).toEqual(pickSceneRoles(LIGHT));
    expect(window.getComputedStyle).toHaveBeenCalledWith(document.documentElement);
  });

  it("throws on a bad token, naming it — the stage's error boundary keeps the static art", () => {
    stubTokens({ ...DARK, cyan: "var(--dark-cyan)" });
    expect(() => readScenePalette()).toThrow(/--cyan/);
  });
});

/*
 * The stylesheet itself: every token the scene reads resolves, in both palettes, to a value it can
 * parse — the dark remap included — and the two fixtures above are what globals.css says.
 */
describe("globals.css — the scene's tokens in both palettes", () => {
  const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  /** The declarations of every top-level (column-0, outside any @media) block with this selector. */
  function declarations(selector: string): Record<string, string> {
    const out: Record<string, string> = {};
    const escaped = selector.replace(/[[\]"]/g, (c) => `\\${c}`);
    for (const block of css.matchAll(new RegExp(`^${escaped} \\{([^}]*)\\}`, "gm"))) {
      for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[name] = value.trim();
    }
    return out;
  }

  const light = declarations(":root");
  const dark = { ...light, ...declarations(':root[data-theme="dark"]') };
  const values = (map: Record<string, string>) =>
    Object.fromEntries(
      (Object.keys(SCENE_TOKENS) as Array<keyof typeof SCENE_TOKENS>).map((role) => [role, map[SCENE_TOKENS[role]]]),
    ) as SceneTokenValues;

  it("the light map is the LIGHT fixture and draws in ink", () => {
    expect(values(light)).toEqual(LIGHT);
    expect(pickSceneRoles(values(light)).mode).toBe("ink");
  });

  it("the dark remap is the DARK fixture and draws in glow", () => {
    expect(values(dark)).toEqual(DARK);
    expect(pickSceneRoles(values(dark)).mode).toBe("glow");
  });

  it("dark is opt-in: no prefers-color-scheme rule, and the remap sets color-scheme: dark", () => {
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).toMatch(/^:root\[data-theme="dark"\] \{[^}]*color-scheme: dark;/m);
  });
});
