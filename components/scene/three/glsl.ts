/**
 * GLSL shared by the interior scene's shader families (materials.ts). Strings only. (The
 * rotation, easing, mesh-wave and sprite snippets went with the models that drew them, 2026-10-28.)
 *
 * Output: every scene shader returns PREMULTIPLIED, already-encoded colour through
 * `sceneOutput` and skips `colorspace_fragment`. The same program draws both themes; only the
 * blend factors and `uInk` change (materials.ts `applyMode`):
 *  · glow (dark): colour × strength, alpha = its brightest channel, added to the page;
 *  · ink (light): colour at `strength` coverage, composited "over" the page.
 */

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
