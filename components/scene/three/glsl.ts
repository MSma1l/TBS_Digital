/**
 * GLSL shared by the interior scene's shader families (materials.ts). Strings only.
 *
 * Output: every scene shader returns PREMULTIPLIED, already-encoded colour through
 * `sceneOutput` and skips `colorspace_fragment`. The same program draws both themes; only the
 * blend factors and `uInk` change (materials.ts `applyMode`):
 *  · glow (dark): colour × strength, alpha = its brightest channel, added to the page;
 *  · ink (light): colour at `strength` coverage, composited "over" the page.
 */

import { MESH_WAVE } from "./samples";

export const SCENE_OUTPUT_GLSL = /* glsl */ `
uniform float uInk;
vec4 sceneOutput(vec3 linearColor, float strength) {
  vec3 e = linearToOutputTexel(vec4(max(linearColor, vec3(0.0)), 1.0)).rgb;
  if (uInk < 0.5) {
    vec3 g = min(e * max(strength, 0.0), vec3(1.0));
    return vec4(g, max(max(g.r, g.g), g.b));
  }
  float a = clamp(strength, 0.0, 1.0);
  return vec4(min(e, vec3(1.0)) * a, a);
}
`;

/** Hash in [0, 1) of a 3D cell (Dave Hoskins' hash13). */
export const HASH_GLSL = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
`;

/**
 * Voxel dissolve on `uReveal` (0 hidden → 1 formed): cells of a 9-per-unit grid appear in
 * hashed order. Discards hidden fragments and returns the "heat" at the edge of the reveal.
 * Needs HASH_GLSL.
 */
export const DISSOLVE_GLSL = /* glsl */ `
uniform float uReveal;
float dissolve(vec3 local) {
  if (uReveal >= 1.0) return 0.0;
  if (uReveal <= 0.0) discard;
  float n = hash13(floor(local * 9.0) + 0.5);
  float r = uReveal * 1.08;
  if (n > r) discard;
  return 1.0 - smoothstep(0.0, 0.08, r - n);
}
`;

export const ROTATE_Y_GLSL = /* glsl */ `
vec3 rotY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
`;

export const EASE_GLSL = /* glsl */ `
float easeInOut(float x) {
  return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
}
`;

/** The mesh wave's height — the GLSL twin of `waveHeight` in samples.ts. */
export const WAVE_GLSL = /* glsl */ `
uniform float uWaveTime;
uniform float uPulseR;
uniform vec2 uOrigin;
float waveHeight(vec2 q, out float ring) {
  float d = length(q - uOrigin);
  ring = exp(-pow((d - uPulseR) * 5.0, 2.0));
  return ${MESH_WAVE.amp.toFixed(3)} * (0.22 * sin(1.6 * q.x + 1.1 * uWaveTime)
    + 0.16 * sin(2.3 * q.y - 0.8 * uWaveTime + 0.5 * q.x)
    + 0.35 * ring);
}
`;

/** Soft-edged round sprite coverage from `gl_PointCoord` (0 outside the disc). */
export const SPRITE_GLSL = /* glsl */ `
float spriteCoverage(float hardness) {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float soft = 1.0 - smoothstep(0.0, 1.0, d);
  float hard = 1.0 - smoothstep(0.55, 1.0, d);
  return mix(soft * soft, hard, hardness);
}
`;
