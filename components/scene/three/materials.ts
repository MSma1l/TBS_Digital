/**
 * The interior scene's shader families. Every draw of Work's DNA helix — since 2026-10-28 the
 * scene's only model — is one of these, so the scene compiles to four programs (the numbering is
 * historical; P1, the glass core, and P6, the points of the morph swarm, are gone, and so are the
 * modes only the hero chip and the service models drew):
 *
 *   P2  surface  — the Work hologram (non-instanced)
 *   P3  surface  — box edges on an `InstancedMesh`: the chips riding the strands (three adds the
 *                  instancing defines)
 *   P4  line     — the rungs' synapse comet, the 0/1 bits
 *   P5  tube     — the strands, with their packets
 *
 * Each family keeps its mode uniform and its mode numbers, so a draw's picture is exactly the
 * one it was when the family carried every model.
 *
 * A theme switch never recompiles. In three r186 a material's program cache key includes
 * `opaque = !transparent && blending === NormalBlending`, so every material here uses
 * `CustomBlending`; `applyMode` only swaps blend factors and the `uInk` uniform.
 */

import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SRGBColorSpace,
  type Texture,
} from "three";
import { DISSOLVE_GLSL, HASH_GLSL, SCENE_OUTPUT_GLSL } from "./glsl";
import type { Rgb, SceneMode, ScenePalette } from "./palette";

type U<T> = { value: T };

/** An sRGB token triple as a linear working-space `Color` (what `new Color("#hex")` gives). */
export function toColor(rgb: Rgb, target: Color = new Color()): Color {
  return target.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);
}

const BLEND = {
  blending: CustomBlending,
  blendEquation: AddEquation,
  blendEquationAlpha: AddEquation,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: OneFactor,
  blendDstAlpha: OneFactor,
} as const;

/** Glow adds light to the page; ink composites premultiplied colour over it. No recompile. */
export function applyMode(material: ShaderMaterial, mode: SceneMode): void {
  const dst = mode === "glow" ? OneFactor : OneMinusSrcAlphaFactor;
  material.blendSrc = OneFactor;
  material.blendSrcAlpha = OneFactor;
  material.blendDst = dst;
  material.blendDstAlpha = dst;
  const ink = material.uniforms.uInk as U<number> | undefined;
  if (ink) ink.value = mode === "ink" ? 1 : 0;
}

/* ---- shared uniform plumbing -------------------------------------------------------------- */

type BaseUniforms = {
  uInk: U<number>;
  uReveal: U<number>;
  uTime: U<number>;
  uMode: U<number>;
  uColorA: U<Color>;
  uColorB: U<Color>;
  uHot: U<Color>;
  uIntensity: U<number>;
};

function baseUniforms(mode: number): BaseUniforms {
  return {
    uInk: { value: 0 },
    uReveal: { value: 1 },
    uTime: { value: 0 },
    uMode: { value: mode },
    uColorA: { value: new Color() },
    uColorB: { value: new Color() },
    uHot: { value: new Color() },
    uIntensity: { value: 1 },
  };
}

/** Which palette role feeds each colour uniform of a material. */
export type ColorRoles = { a: keyof ScenePaletteColors; b: keyof ScenePaletteColors; hot: keyof ScenePaletteColors };
type ScenePaletteColors = Pick<ScenePalette, "cyan" | "blue" | "red" | "hot" | "bg">;

/** A shader material the world recolours on a theme change. */
export type Paintable = {
  material: ShaderMaterial;
  uniforms: BaseUniforms;
  roles: ColorRoles;
};

export function paint(item: Paintable, palette: ScenePalette): void {
  toColor(palette[item.roles.a], item.uniforms.uColorA.value);
  toColor(palette[item.roles.b], item.uniforms.uColorB.value);
  toColor(palette[item.roles.hot], item.uniforms.uHot.value);
  applyMode(item.material, palette.mode);
}

/* ---- P2 / P3: surface ------------------------------------------------------------------------ */

/** 0 plasma, 1 fresnel and 3 the glass shell are gone with their models; these keep their numbers. */
export const SURFACE_MODE = { edges: 2, holo: 4 } as const;

export type SurfaceUniforms = BaseUniforms & {
  uExtrude: U<number>;
  /** The hologram's texture (null draws the renderer's empty texture; only `holo` samples it). */
  uMap: U<Texture | null>;
  /** The hologram's swap glitch, 1 → 0. */
  uGlitch: U<number>;
};

const SURFACE_VERTEX = /* glsl */ `
uniform float uExtrude;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vTint;
varying vec2 vUv;

void main() {
  vec4 local = vec4(position + normal * uExtrude, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    n = mat3(instanceMatrix) * n;
  #endif
  vUv = uv;
  vBox = position;
  vLocal = local.xyz;
  vTint = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  vec4 mv = modelViewMatrix * local;
  vNormalV = normalize(normalMatrix * n);
  vViewV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const SURFACE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uMode;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uHot;
uniform float uIntensity;
uniform sampler2D uMap;
uniform float uGlitch;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vTint;
varying vec2 vUv;
${SCENE_OUTPUT_GLSL}
${HASH_GLSL}
${DISSOLVE_GLSL}

void main() {
  float heat = dissolve(vLocal);
  vec3 n = normalize(vNormalV);
  vec3 v = normalize(vViewV);
  float facing = clamp(abs(dot(n, v)), 0.0, 1.0);
  float fres = pow(1.0 - facing, 2.0);
  // An instance colour carries hue and brightness; ink keeps the hue and caps the brightness.
  float lum = max(max(vTint.r, vTint.g), vTint.b);
  vec3 hue = vTint / max(lum, 1e-3);
  float gain = mix(min(lum, 1.8), min(lum, 1.4), uInk);
  float hotness = 1.0 - uInk;
  vec3 color;
  float strength;

  if (uMode < 2.5) {
    // box edges: faces faint, the second-largest |coordinate| near 1 is an edge
    vec3 a = abs(vBox) * 2.0;
    float hi = max(a.x, max(a.y, a.z));
    float lo = min(a.x, min(a.y, a.z));
    float edge = smoothstep(0.84, 0.96, a.x + a.y + a.z - hi - lo);
    color = mix(uColorA * hue, uHot, edge * 0.45 * hotness * smoothstep(1.2, 2.6, lum));
    strength = (0.035 + edge * 0.9 + fres * 0.05) * uIntensity;
  } else {
    // the Work hologram (models/helix.ts): a Canvas2D texture (hologram.ts) under scanlines, in a
    // hairline frame; a glitch shears and flickers it for a moment while the texture is swapped.
    //
    // The canvas is GREY (the card is composed in luminosity), so sat = 0 and peak = tex.r and
    // both lines below are the monochrome ones they have always been, to the byte. The colour
    // path stays for a coloured pixel all the same (the service-page laptop's display drew real
    // screenshots through it until 2026-10-28): it costs the program nothing worth a variant.
    vec2 uvg = vec2(vUv.x + uGlitch * 0.02 * sin(vUv.y * 90.0 + uTime * 40.0), vUv.y);
    vec4 tex = texture2D(uMap, uvg);
    float peak = max(tex.r, max(tex.g, tex.b));
    // Saturation, not chroma: a dark blue is as much a colour as a bright one. The 2.1 is the gain
    // at which a lightly tinted interface still reads as its own colour while a near-grey one —
    // a white page, a grey chart — stays in the palette.
    float sat = clamp(((peak - min(tex.r, min(tex.g, tex.b))) / max(peak, 1e-3)) * 2.1, 0.0, 1.0);
    vec3 own = tex.rgb / max(peak, 1e-3);
    float scan = 0.78 + 0.22 * step(0.5, fract(vUv.y * 120.0));
    float frame = 1.0 - step(0.006, min(min(vUv.x, vUv.y), min(1.0 - vUv.x, 1.0 - vUv.y)));
    // own * own: the canvas is sampled raw (NoColorSpace), so the hue is squared back towards
    // linear before the output encodes it again — otherwise a screenshot comes back washed out.
    color = mix(mix(uColorA, uHot, peak * 0.35 * hotness), own * own, sat);
    strength = (tex.a * peak * 1.1 * scan + frame * 0.55) * uIntensity * (1.0 - 0.6 * uGlitch * step(0.5, fract(uTime * 30.0)));
  }

  strength *= gain;
  color = mix(color, mix(uColorA, uHot, hotness), heat * 0.8);
  strength += heat * 0.9 * uIntensity;
  gl_FragColor = sceneOutput(color, strength);
}
`;

export type SurfaceOptions = {
  mode: (typeof SURFACE_MODE)[keyof typeof SURFACE_MODE];
  roles: ColorRoles;
  /** P3: drawn by an InstancedMesh (both sides, so every box edge shows). */
  instanced?: boolean;
  extrude?: number;
  intensity?: number;
};

export function createSurfaceMaterial(options: SurfaceOptions): Paintable & { uniforms: SurfaceUniforms } {
  const uniforms: SurfaceUniforms = {
    ...baseUniforms(options.mode),
    uExtrude: { value: options.extrude ?? 0 },
    uMap: { value: null },
    uGlitch: { value: 0 },
  };
  uniforms.uIntensity.value = options.intensity ?? 1;
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: options.instanced ? DoubleSide : FrontSide,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles };
}

/* ---- P4: line ----------------------------------------------------------------------------------- */

/** 0 wire, 1 the mesh wave and 3 the UI card outlines are gone with their models; these keep their numbers. */
export const LINE_MODE = { synapse: 2, bits: 4 } as const;

export type LineUniforms = BaseUniforms & {
  uAlpha: U<number>;
  uProg: U<number>;
  uDir: U<number>;
  /** Bits: the height they drift over along local y (centred on 0) before wrapping. */
  uSpan: U<number>;
};

const LINE_VERTEX = /* glsl */ `
attribute float aU;
attribute float aPhase;
attribute vec2 aGlyph;
uniform float uMode;
uniform float uTime;
uniform float uSpan;
varying float vU;
varying float vPhase;
varying vec3 vLocal;
varying float vRing;

void main() {
  vec3 p = position;
  vRing = 0.0;
  if (uMode > 3.5) {
    // bits (models/helix.ts): position is a glyph's centre, aPhase its seed; it drifts up local
    // y over uSpan and wraps, fading out at both ends (vRing)
    float cy = mod(aPhase * uSpan + uTime * 0.12, uSpan) - 0.5 * uSpan;
    p.y += cy;
    vRing = 1.0 - smoothstep(0.35, 0.5, abs(cy) / uSpan);
  }
  vU = aU;
  vPhase = aPhase;
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // A bit's stroke (aGlyph, model units from its centre) faces the camera, upright, at the model's scale.
  if (uMode > 3.5) mv.xy += aGlyph * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const LINE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uMode;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uHot;
uniform float uIntensity;
uniform float uAlpha;
uniform float uProg;
uniform float uDir;
varying float vU;
varying float vPhase;
varying vec3 vLocal;
varying float vRing;
${SCENE_OUTPUT_GLSL}
${HASH_GLSL}
${DISSOLVE_GLSL}

void main() {
  float heat = dissolve(vLocal);
  float hotness = 1.0 - uInk;
  vec3 color;
  float strength;

  if (uMode < 2.5) {
    // synapses (the helix's rungs): a comet runs layer by layer (uProg in layers, vPhase = this
    // edge's layer)
    float along = uProg - vPhase;
    float d = uDir > 0.0 ? along - vU : vU - along;
    float comet = d >= 0.0 ? exp(-d * 9.0) : 0.0;
    color = mix(uColorA, uDir > 0.0 ? uColorB : uHot, clamp(comet * 1.5, 0.0, 1.0));
    strength = (uAlpha + comet * 1.6) * uIntensity;
  } else {
    // bits: every slot holds a seven-segment 0 (vU 0) and a 1 (vU 1) and shows one at a time
    float on = step(0.5, fract(uTime * 0.7 + vPhase * 7.0));
    float show = vU < 0.5 ? on : 1.0 - on;
    if (show < 0.5) discard;
    color = vU < 0.5 ? uColorA : uColorB;
    strength = uAlpha * vRing * uIntensity;
  }

  color = mix(color, mix(uColorA, uHot, hotness), heat * 0.8);
  strength += heat * 0.9 * uIntensity;
  gl_FragColor = sceneOutput(color, strength);
}
`;

export function createLineMaterial(options: {
  mode: (typeof LINE_MODE)[keyof typeof LINE_MODE];
  roles: ColorRoles;
  alpha: number;
}): Paintable & { uniforms: LineUniforms } {
  const uniforms: LineUniforms = {
    ...baseUniforms(options.mode),
    uAlpha: { value: options.alpha },
    uProg: { value: -1 },
    uDir: { value: 1 },
    uSpan: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles };
}

/* ---- P5: tube ----------------------------------------------------------------------------------- */

/**
 * 0 the glass core's orbit rings, 1 the commerce track, 2 its gates and 4 the cursor trail are
 * gone with their models; links keeps its number.
 */
export const TUBE_MODE = { links: 3 } as const;

export type TubeUniforms = BaseUniforms & {
  uAlpha: U<number>;
  uWidth: U<number>;
};

const TUBE_VERTEX = /* glsl */ `
attribute float aTag;
uniform float uWidth;
varying float vU;
varying float vTag;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;

void main() {
  vU = uv.x;
  vTag = aTag;
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position + normal * uWidth, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const TUBE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uMode;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uHot;
uniform float uIntensity;
uniform float uAlpha;
varying float vU;
varying float vTag;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;
${SCENE_OUTPUT_GLSL}
${HASH_GLSL}
${DISSOLVE_GLSL}

void main() {
  float heat = dissolve(vLocal);
  float facing = clamp(abs(dot(normalize(vNormalV), normalize(vViewV))), 0.0, 1.0);
  float body = 0.35 + 0.65 * facing;
  float hotness = 1.0 - uInk;
  // links (the helix's strands): packets out along a strand (A→B) and back in (→ hot)
  float link = floor(vTag);
  float incoming = step(0.25, fract(vTag));
  float head = fract(uTime * 0.5 + fract(link * 0.37));
  float d = incoming > 0.5 ? fract(vU - (1.0 - head)) : fract(head - vU);
  float comet = exp(-d * 16.0);
  vec3 color = mix(uColorA, incoming > 0.5 ? uHot : uColorB, clamp(comet * 1.4, 0.0, 1.0));
  float strength = (uAlpha + comet * 1.7) * body * uIntensity;

  color = mix(color, mix(uColorA, uHot, hotness), heat * 0.8);
  strength += heat * 0.9 * uIntensity;
  gl_FragColor = sceneOutput(color, strength);
}
`;

export function createTubeMaterial(options: {
  mode: (typeof TUBE_MODE)[keyof typeof TUBE_MODE];
  roles: ColorRoles;
  alpha: number;
  width?: number;
}): Paintable & { uniforms: TubeUniforms } {
  const uniforms: TubeUniforms = {
    ...baseUniforms(options.mode),
    uAlpha: { value: options.alpha },
    uWidth: { value: options.width ?? 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: TUBE_VERTEX,
    fragmentShader: TUBE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles };
}
