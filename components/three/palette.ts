/**
 * Scene colours come from the site's CSS tokens at runtime, never from literals: a scene
 * stays on brand if the palette changes, and a token that cannot be read throws, which the
 * owner's error boundary turns into the static fallback.
 */

import { Color } from "three";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i;

/** Only the formats `THREE.Color` parses without a warning. */
export function isParsableTokenColor(value: string): boolean {
  return HEX.test(value) || RGB.test(value);
}

/**
 * Read `tokens` (role → CSS custom property) from `root`'s computed style. Throws a
 * descriptive error when a token is missing or in a format three.js can't parse (e.g.
 * `color-mix()` or `oklch()`).
 */
export function readTokenColors<K extends string>(
  tokens: Readonly<Record<K, string>>,
  root: Element = document.documentElement,
): Record<K, Color> {
  const style = getComputedStyle(root);
  const colors = {} as Record<K, Color>;
  for (const role of Object.keys(tokens) as K[]) {
    const token = tokens[role];
    const value = style.getPropertyValue(token).trim();
    if (!isParsableTokenColor(value)) {
      throw new Error(
        `3D scene: CSS token ${token} is missing or not a hex/rgb() colour (got "${value}").`,
      );
    }
    colors[role] = new Color(value);
  }
  return colors;
}
