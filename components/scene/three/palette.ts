/**
 * The interior scene's colours, read from the site's CSS tokens at runtime.
 *
 * Pure on purpose — no three.js: colours stay plain sRGB triples here and become
 * `THREE.Color`s in materials.ts, so the role table and the theme switch are unit-tested
 * without loading three. A token in a format this cannot parse throws a descriptive error:
 * on mount that reaches the stage's error boundary (the static art stays); on a later theme
 * change the caller keeps the previous palette.
 *
 * Two modes. Dark ("glow"): light is ADDED to the page, neon on near-black. Light ("ink"): an
 * additive glow vanishes on a pale page, so every material switches its blend factors to
 * premultiplied "over" and draws with the darker text tones — never a shader recompile.
 */

/** sRGB, each channel 0..1. */
export type Rgb = readonly [number, number, number];

export type SceneMode = "glow" | "ink";

export type ScenePalette = {
  mode: SceneMode;
  cyan: Rgb;
  blue: Rgb;
  red: Rgb;
  /** The white-hot core of a highlight (glow), the text colour (ink). */
  hot: Rgb;
  /** The page behind the canvas (its luminance picks the mode). */
  bg: Rgb;
};

/** Every CSS custom property the scene reads (they must stay hex or rgb()). */
export const SCENE_TOKENS = {
  cyan: "--cyan",
  blue: "--blue",
  blueText: "--blue-text",
  redLift: "--red-lift",
  redText: "--red-text",
  txt: "--txt",
  bg: "--bg",
} as const;

export type SceneTokenRole = keyof typeof SCENE_TOKENS;
export type SceneTokenValues = Readonly<Record<SceneTokenRole, string>>;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i;

/** A hex (#rgb / #rrggbb) or `rgb()` token as an sRGB triple, or null for any other format. */
export function parseTokenColor(value: string): Rgb | null {
  const text = value.trim();
  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join("") : hex[1];
    const n = Number.parseInt(digits, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = RGB.exec(text);
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number);
    if (channels.some((c) => c > 255)) return null;
    return [channels[0] / 255, channels[1] / 255, channels[2] / 255];
  }
  return null;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance of an sRGB colour. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** A page lighter than this is the light theme: the scene draws in ink. */
export const INK_LUMINANCE = 0.4;

/**
 * Pure. The scene's roles from raw token values. The page colour decides the mode (so a
 * document with no `data-theme`, themed by the OS media query, is covered too). Throws when
 * a token is missing or unparsable.
 */
export function pickSceneRoles(values: SceneTokenValues): ScenePalette {
  const parsed = {} as Record<SceneTokenRole, Rgb>;
  for (const role of Object.keys(SCENE_TOKENS) as SceneTokenRole[]) {
    const color = parseTokenColor(values[role] ?? "");
    if (!color) {
      throw new Error(
        `3D scene: CSS token ${SCENE_TOKENS[role]} is missing or not a hex/rgb() colour (got "${values[role] ?? ""}").`,
      );
    }
    parsed[role] = color;
  }
  const ink = relativeLuminance(parsed.bg) > INK_LUMINANCE;
  return {
    mode: ink ? "ink" : "glow",
    cyan: parsed.cyan,
    blue: ink ? parsed.blueText : parsed.blue,
    red: ink ? parsed.redText : parsed.redLift,
    hot: parsed.txt,
    bg: parsed.bg,
  };
}

/** Client only. The palette from `root`'s computed tokens (throws like `pickSceneRoles`). */
export function readScenePalette(root: Element = document.documentElement): ScenePalette {
  const style = getComputedStyle(root);
  const values = {} as Record<SceneTokenRole, string>;
  for (const role of Object.keys(SCENE_TOKENS) as SceneTokenRole[]) {
    values[role] = style.getPropertyValue(SCENE_TOKENS[role]).trim();
  }
  return pickSceneRoles(values);
}

/** The palette now, or null when a token can't be read (the caller keeps what it has). */
export function tryReadScenePalette(root?: Element): ScenePalette | null {
  try {
    return readScenePalette(root);
  } catch {
    return null;
  }
}

const sameRgb = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

export function samePalette(a: ScenePalette, b: ScenePalette): boolean {
  return (
    a.mode === b.mode &&
    sameRgb(a.cyan, b.cyan) &&
    sameRgb(a.blue, b.blue) &&
    sameRgb(a.red, b.red) &&
    sameRgb(a.hot, b.hot) &&
    sameRgb(a.bg, b.bg)
  );
}

export const THEME_ATTRIBUTE = "data-theme";
export const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/**
 * Call `onChange` whenever the theme may have changed: `data-theme` on `<html>` flips (the
 * theme toggle) or the OS colour scheme does (the fallback for a document without
 * `data-theme`). Returns the cleanup. The caller re-reads the palette and compares.
 */
export function observeThemeChange(onChange: () => void, root: Element = document.documentElement): () => void {
  const cleanups: Array<() => void> = [];
  if (typeof MutationObserver !== "undefined") {
    const observer = new MutationObserver(() => onChange());
    observer.observe(root, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] });
    cleanups.push(() => observer.disconnect());
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const media = window.matchMedia(COLOR_SCHEME_QUERY);
    const listener = () => onChange();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", listener);
      cleanups.push(() => media.removeEventListener("change", listener));
    }
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
