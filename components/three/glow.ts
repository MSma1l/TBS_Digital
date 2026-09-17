/**
 * Glow on a transparent canvas.
 *
 * The site's canvases are `alpha: true` (the page's grid and glows show through) and browsers
 * composite them as premultiplied alpha. Plain additive blending would leave colour with no
 * alpha — undefined for a premultiplied surface, and clamped away by some compositors. So
 * glowing materials use `GLOW_BLENDING` (colour and alpha both added) and write the
 * brightest ENCODED channel as alpha (`glowAlpha`): the light adds to what is behind the
 * canvas and stays valid everywhere.
 */

import { AddEquation, CustomBlending, OneFactor } from "three";

/** Colour and alpha both added — see the file comment. */
export const GLOW_BLENDING = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
} as const;

/** `glowAlpha(color)`: the brightest channel once encoded for output, so rgb ≤ alpha. */
export const GLOW_ALPHA_GLSL = /* glsl */ `
float glowAlpha(vec3 linearColor) {
  vec3 encoded = linearToOutputTexel(vec4(linearColor, 1.0)).rgb;
  return clamp(max(max(encoded.r, encoded.g), encoded.b), 0.0, 1.0);
}
`;
