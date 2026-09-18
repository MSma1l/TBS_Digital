/**
 * The interior scene's colours, read from the site's CSS tokens at runtime.
 *
 * Pure on purpose — no three.js: colours stay plain sRGB triples here and become
 * `THREE.Color`s in materials.ts, so the role table is unit-tested without loading three. A
 * token in a format this cannot parse throws a descriptive error: on mount that reaches the
 * stage's error boundary and the static art stays.
 *
 * One mode. The page is always near-black, so the scene always draws in "glow": light is
 * ADDED to it, neon on dark. The `SceneMode` union and the shaders' `uInk` uniform survive
 * this — `uInk` is simply always 0 — rather than being cut out of every model file.
 */

/** sRGB, each channel 0..1. */
export type Rgb = readonly [number, number, number];

export type SceneMode = "glow" | "ink";

export type ScenePalette = {
  mode: SceneMode;
  cyan: Rgb;
  blue: Rgb;
  red: Rgb;
  /** The white-hot core of a highlight. */
  hot: Rgb;
  /** The page behind the canvas. */
  bg: Rgb;
};

/** Every CSS custom property the scene reads (they must stay hex or rgb()). */
export const SCENE_TOKENS = {
  cyan: "--cyan",
  blue: "--blue",
  redLift: "--red-lift",
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

/**
 * Pure. The scene's roles from raw token values. Throws when a token is missing or
 * unparsable.
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
  return {
    mode: "glow",
    cyan: parsed.cyan,
    blue: parsed.blue,
    red: parsed.redLift,
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
