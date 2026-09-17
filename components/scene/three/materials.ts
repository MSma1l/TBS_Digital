/**
 * The interior scene's six shader families. Every mesh, line and point set in the scene is
 * drawn by one of these, so the whole scene compiles to about six programs:
 *
 *   P1  glass    — `MeshPhysicalMaterial` transmission (high) or the frost shader (mid)
 *   P2  surface  — fresnel / plasma / box edges / wave shell (non-instanced)
 *   P3  surface  — the same source on an `InstancedMesh` (three adds the instancing defines)
 *   P4  line     — wireframes, the mesh wave, synapses, UI card outlines
 *   P5  tube     — rings, the commerce track and gates, hub links with packets
 *   P6  points   — the core's cloud, the morph swarm, synapse pulses, wave nodes
 *
 * A theme switch never recompiles. In three r186 a material's program cache key includes
 * `opaque = !transparent && blending === NormalBlending`, so every material here uses
 * `CustomBlending`; `applyMode` only swaps blend factors and the `uInk` uniform. A material
 * that must land in the opaque pass (the nucleus, so the transmission pass refracts it) sets
 * `transparent: false` and still blends as light.
 */

import {
  AddEquation,
  Color,
  CustomBlending,
  DoubleSide,
  FrontSide,
  Matrix4,
  MeshPhysicalMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import { GLOW_ALPHA_GLSL } from "@/components/three/glow";
import {
  DISSOLVE_GLSL,
  EASE_GLSL,
  HASH_GLSL,
  ROTATE_Y_GLSL,
  SCENE_OUTPUT_GLSL,
  SPRITE_GLSL,
  WAVE_GLSL,
} from "./glsl";
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

/* ---- P1: glass ---------------------------------------------------------------------------- */

export const GLASS_IRIDESCENCE = 0.2;

/** High tier: frosted transmission glass, lit by the procedural strip environment. */
export function createPhysicalGlass(palette: ScenePalette): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: toColor(palette.glassTint),
    metalness: 0,
    // Frost from blurring what is behind, not from thickness: a thick ball is a lens that
    // magnifies the nucleus across the whole sphere, and more roughness smears it out to the rim.
    roughness: 0.3,
    transmission: 1,
    thickness: 0.05,
    ior: 1.45,
    attenuationColor: toColor(palette.attenuation),
    attenuationDistance: 4,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    iridescence: GLASS_IRIDESCENCE,
    iridescenceIOR: 1.3,
    envMapIntensity: 0.6,
    side: FrontSide,
  });
}

export function setPhysicalGlassPalette(material: MeshPhysicalMaterial, palette: ScenePalette): void {
  toColor(palette.glassTint, material.color);
  toColor(palette.attenuation, material.attenuationColor);
}

export type FrostUniforms = {
  uInk: U<number>;
  uCyan: U<Color>;
  uRed: U<Color>;
  uBg: U<Color>;
  uTint: U<Color>;
  uTime: U<number>;
  uGlow: U<number>;
  uDim: U<number>;
};

const FRESNEL_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;

void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

/** Mid tier: a frosted shell that fakes the body, neon lobes and a fresnel band — no transmission pass. */
export function createFrostGlass(palette: ScenePalette): { material: ShaderMaterial; uniforms: FrostUniforms } {
  const uniforms: FrostUniforms = {
    uInk: { value: palette.mode === "ink" ? 1 : 0 },
    uCyan: { value: toColor(palette.cyan) },
    uRed: { value: toColor(palette.red) },
    uBg: { value: toColor(palette.bg) },
    uTint: { value: toColor(palette.glassTint) },
    uTime: { value: 0 },
    uGlow: { value: 0 },
    uDim: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: FRESNEL_VERTEX,
    fragmentShader: /* glsl */ `
      uniform float uInk;
      uniform vec3 uCyan;
      uniform vec3 uRed;
      uniform vec3 uBg;
      uniform vec3 uTint;
      uniform float uTime;
      uniform float uGlow;
      uniform float uDim;
      varying vec3 vNormalV;
      varying vec3 vViewV;
      varying vec3 vLocal;
      ${GLOW_ALPHA_GLSL}

      void main() {
        vec3 n = normalize(vNormalV);
        vec3 v = normalize(vViewV);
        float facing = clamp(dot(n, v), 0.0, 1.0);
        float edge = 1.0 - facing;
        float fres = pow(edge, 2.6);
        float rim = pow(edge, 5.0);
        float up = n.y * 0.5 + 0.5;
        // A two-tone neon rim: cyan on the upper left, red on the lower right.
        vec2 around = normalize(n.xy + vec2(1e-4));
        float cyanSide = smoothstep(-0.35, 0.9, dot(around, vec2(-0.7, 0.714)));
        float redSide = smoothstep(-0.35, 0.9, dot(around, vec2(0.75, -0.661)));
        // A softbox reflection: a short, soft streak up and to the left.
        vec3 m = normalize(vec3(n.x * 0.5, n.y, n.z));
        float glint = pow(max(dot(m, normalize(vec3(-0.3, 0.62, 0.72))), 0.0), 60.0);
        float band = 0.5 + 0.5 * sin(vLocal.y * 4.0 - uTime * 0.6);
        // Light scattered from the nucleus, strongest through the middle of the frost.
        float scatter = pow(facing, 3.0);
        vec3 light = uCyan * (rim * 1.7 * cyanSide + fres * 0.08 * band + scatter * 0.08)
          + uRed * (rim * 1.4 * redSide + fres * 0.06 * (1.0 - band) + scatter * 0.04)
          + uTint * glint * (uInk < 0.5 ? 0.5 : 0.35);
        light *= 1.0 + uGlow;
        float bodyA = (0.28 + fres * 0.42) * uDim;
        // Dark: smoke a little deeper than the page. Light: milky glass a little under it.
        vec3 body = uInk < 0.5
          ? mix(uBg, uTint, 0.05) * (0.55 + 0.3 * up)
          : mix(uBg * 0.92, uTint, 0.35 + 0.2 * up);
        vec3 e = linearToOutputTexel(vec4(body, 1.0)).rgb * bodyA
          + linearToOutputTexel(vec4(light, 1.0)).rgb * (uInk < 0.5 ? 1.0 : 0.8) * uDim;
        e = min(e, vec3(1.0));
        float a = max(bodyA, uInk < 0.5 ? glowAlpha(light) * uDim : bodyA);
        gl_FragColor = vec4(e, clamp(max(a, max(max(e.r, e.g), e.b)), 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: true,
    side: FrontSide,
    ...BLEND,
    blendDst: OneMinusSrcAlphaFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
  return { material, uniforms };
}

export function setFrostPalette(uniforms: FrostUniforms, palette: ScenePalette): void {
  uniforms.uInk.value = palette.mode === "ink" ? 1 : 0;
  toColor(palette.cyan, uniforms.uCyan.value);
  toColor(palette.red, uniforms.uRed.value);
  toColor(palette.bg, uniforms.uBg.value);
  toColor(palette.glassTint, uniforms.uTint.value);
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

export const SURFACE_MODE = { plasma: 0, fresnel: 1, edges: 2, shell: 3 } as const;

export type SurfaceUniforms = BaseUniforms & {
  uPulse: U<number>;
  uFade: U<number>;
  uExtrude: U<number>;
};

const SURFACE_VERTEX = /* glsl */ `
uniform float uExtrude;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vTint;

void main() {
  vec4 local = vec4(position + normal * uExtrude, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    n = mat3(instanceMatrix) * n;
  #endif
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
uniform float uPulse;
uniform float uFade;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vLocal;
varying vec3 vBox;
varying vec3 vTint;
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

  if (uMode < 0.5) {
    // plasma: slow interfering bands, a hot centre facing the camera
    float flow = sin(vLocal.x * 7.0 + uTime * 1.3) * 1.4;
    float bands = 0.5 + 0.5 * sin(vLocal.y * 13.0 + flow - uTime * 2.2);
    vec3 tint = mix(uColorA, uColorB, smoothstep(0.15, 0.85, bands));
    color = mix(tint, uHot, pow(facing, 6.0) * 0.35 * hotness) * hue;
    strength = (0.28 + 0.5 * facing + fres * 0.6 + 0.35 * uPulse) * uIntensity;
  } else if (uMode < 1.5) {
    // fresnel body: a thin bright rim, a faint face
    color = mix(uColorA, uColorB, 0.5 + 0.5 * n.y) * hue;
    strength = (0.1 + fres * 1.5) * uIntensity;
  } else if (uMode < 2.5) {
    // box edges: faces faint, the second-largest |coordinate| near 1 is an edge
    vec3 a = abs(vBox) * 2.0;
    float hi = max(a.x, max(a.y, a.z));
    float lo = min(a.x, min(a.y, a.z));
    float edge = smoothstep(0.84, 0.96, a.x + a.y + a.z - hi - lo);
    color = mix(uColorA * hue, uHot, edge * 0.45 * hotness * smoothstep(1.2, 2.6, lum));
    strength = (0.035 + edge * 0.9 + fres * 0.05) * uIntensity;
  } else {
    // wave shell: a fresnel bubble that fades as it grows
    color = mix(uColorA, uHot, 0.25 * hotness) * hue;
    strength = pow(1.0 - facing, 7.0) * uFade * uIntensity * 1.3;
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
  /** Land in the opaque pass (the transmission pass captures it). */
  opaque?: boolean;
  extrude?: number;
  intensity?: number;
};

export function createSurfaceMaterial(options: SurfaceOptions): Paintable & { uniforms: SurfaceUniforms } {
  const uniforms: SurfaceUniforms = {
    ...baseUniforms(options.mode),
    uPulse: { value: 0 },
    uFade: { value: 1 },
    uExtrude: { value: options.extrude ?? 0 },
  };
  uniforms.uIntensity.value = options.intensity ?? 1;
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    transparent: !options.opaque,
    depthWrite: !!options.opaque,
    side: options.instanced ? DoubleSide : FrontSide,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles };
}

/* ---- P4: line ----------------------------------------------------------------------------------- */

export const LINE_MODE = { wire: 0, wave: 1, synapse: 2, card: 3 } as const;

export type LineUniforms = BaseUniforms & {
  uAlpha: U<number>;
  uProg: U<number>;
  uDir: U<number>;
  uWaveTime: U<number>;
  uPulseR: U<number>;
  uOrigin: U<Vector2>;
};

const LINE_VERTEX = /* glsl */ `
attribute float aU;
attribute float aPhase;
uniform float uMode;
${WAVE_GLSL}
varying float vU;
varying float vPhase;
varying vec3 vLocal;
varying float vRing;

void main() {
  vec3 p = position;
  vRing = 0.0;
  if (uMode > 0.5 && uMode < 1.5) {
    float ring = 0.0;
    p.z += waveHeight(p.xy, ring);
    vRing = ring;
  }
  vU = aU;
  vPhase = aPhase;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
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

  if (uMode < 0.5) {
    color = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vLocal.y * 5.0 + uTime * 0.9));
    strength = uAlpha * uIntensity;
  } else if (uMode < 1.5) {
    // the wave: blue → cyan across, the pulse ring runs red
    color = mix(uColorA, uColorB, smoothstep(-1.6, 1.6, vLocal.x));
    color = mix(color, uHot, clamp(vRing * 0.85, 0.0, 1.0));
    strength = (uAlpha + vRing * 0.45) * uIntensity;
  } else if (uMode < 2.5) {
    // synapses: a comet runs layer by layer (uProg in layers, vPhase = this edge's layer)
    float along = uProg - vPhase;
    float d = uDir > 0.0 ? along - vU : vU - along;
    float comet = d >= 0.0 ? exp(-d * 9.0) : 0.0;
    color = mix(uColorA, uDir > 0.0 ? uColorB : uHot, clamp(comet * 1.5, 0.0, 1.0));
    strength = (uAlpha + comet * 1.6) * uIntensity;
  } else {
    color = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vU * 6.2832 + uTime));
    strength = uAlpha * uIntensity;
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
  /** Land in the opaque pass (inside the transmission glass). */
  opaque?: boolean;
}): Paintable & { uniforms: LineUniforms } {
  const uniforms: LineUniforms = {
    ...baseUniforms(options.mode),
    uAlpha: { value: options.alpha },
    uProg: { value: -1 },
    uDir: { value: 1 },
    uWaveTime: { value: 0 },
    uPulseR: { value: 0 },
    uOrigin: { value: new Vector2() },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: LINE_VERTEX,
    fragmentShader: LINE_FRAGMENT,
    transparent: !options.opaque,
    depthWrite: false,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles };
}

/* ---- P5: tube ----------------------------------------------------------------------------------- */

export const TUBE_MODE = { ring: 0, track: 1, gates: 2, links: 3 } as const;

export type TubeUniforms = BaseUniforms & {
  uAlpha: U<number>;
  uWidth: U<number>;
  uHead: U<number>;
  uHead2: U<number>;
  uCometGain: U<number>;
  uTicks: U<number>;
  uFlash: U<Vector3>;
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
uniform float uHead;
uniform float uHead2;
uniform float uCometGain;
uniform float uTicks;
uniform vec3 uFlash;
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
  vec3 color;
  float strength;

  if (uMode < 0.5) {
    // rings: two comets half a loop apart, HUD ticks
    float c1 = exp(-fract(uHead - vU) * 14.0);
    float c2 = exp(-fract(uHead + 0.5 - vU) * 14.0) * uHead2;
    float comet = c1 + c2;
    float ticks = uTicks * step(0.94, fract(vU * 48.0)) * 0.35;
    vec3 tint = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vU * 6.2832));
    color = mix(tint, uHot, clamp(comet * comet, 0.0, 1.0) * 0.7 * hotness);
    strength = (uAlpha + ticks + comet * (1.1 + uCometGain)) * body * uIntensity;
  } else if (uMode < 1.5) {
    // the commerce track: flowing dashes
    float dash = step(0.62, fract((vU - uTime * 0.12) * 36.0));
    color = mix(uColorA, uColorB, dash);
    strength = (uAlpha + dash * 0.55) * body * uIntensity;
  } else if (uMode < 2.5) {
    // gates: offer / payment / access, each flashing as a package passes
    float g = floor(vTag + 0.5);
    vec3 gate = g < 0.5 ? uColorA : (g < 1.5 ? uColorB : uHot);
    float flash = g < 0.5 ? uFlash.x : (g < 1.5 ? uFlash.y : uFlash.z);
    color = gate;
    strength = (0.8 + flash * 1.6) * body * uIntensity;
  } else {
    // hub links: packets out to the satellites (A→B) and back in (→ hot)
    float link = floor(vTag);
    float incoming = step(0.25, fract(vTag));
    float head = fract(uTime * 0.5 + fract(link * 0.37));
    float d = incoming > 0.5 ? fract(vU - (1.0 - head)) : fract(head - vU);
    float comet = exp(-d * 16.0);
    color = mix(uColorA, incoming > 0.5 ? uHot : uColorB, clamp(comet * 1.4, 0.0, 1.0));
    strength = (uAlpha + comet * 1.7) * body * uIntensity;
  }

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
    uHead: { value: 0 },
    uHead2: { value: 1 },
    uCometGain: { value: 0 },
    uTicks: { value: 0 },
    uFlash: { value: new Vector3() },
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

/* ---- P6: points ----------------------------------------------------------------------------------- */

export const POINTS_MODE = { cloud: 0, swarm: 1, pulses: 2, waveNodes: 3 } as const;

export type PointsUniforms = BaseUniforms & {
  uColorC: U<Color>;
  uAlpha: U<number>;
  /** Sprite diameter in scene units at model scale 1. */
  uSize: U<number>;
  /** Half the drawing buffer's height in device pixels. */
  uHalfHeight: U<number>;
  /** Fill-rate cap in device pixels. */
  uMaxSize: U<number>;
  /** World scale of the model the points belong to (the swarm lives in world space). */
  uScale: U<number>;
  uWaveR: U<number>;
  uWaveAmp: U<number>;
  uT: U<number>;
  uFromA: U<Vector3>;
  uFromB: U<Vector3>;
  uToA: U<Vector3>;
  uToB: U<Vector3>;
  uFromM: U<Matrix4>;
  uToM: U<Matrix4>;
  uFromR: U<number>;
  uToR: U<number>;
  uProg: U<number>;
  uWaveTime: U<number>;
  uPulseR: U<number>;
  uOrigin: U<Vector2>;
};

const POINTS_VERTEX = /* glsl */ `
attribute vec3 aS0;
attribute vec3 aS1;
attribute vec3 aS2;
attribute vec3 aS3;
attribute vec3 aS4;
attribute vec3 aS5;
attribute vec4 aSeed;
uniform float uTime;
uniform float uMode;
uniform float uReveal;
uniform float uSize;
uniform float uHalfHeight;
uniform float uMaxSize;
uniform float uScale;
uniform float uWaveR;
uniform float uWaveAmp;
uniform float uT;
uniform vec3 uFromA;
uniform vec3 uFromB;
uniform vec3 uToA;
uniform vec3 uToB;
uniform mat4 uFromM;
uniform mat4 uToM;
uniform float uFromR;
uniform float uToR;
uniform float uProg;
${WAVE_GLSL}
${ROTATE_Y_GLSL}
${EASE_GLSL}
varying float vAlpha;
varying float vTint;
varying float vHot;

vec3 slot(vec3 a, vec3 b) {
  return aS0 * a.x + aS1 * a.y + aS2 * a.z + aS3 * b.x + aS4 * b.y + aS5 * b.z;
}

void main() {
  vec3 p = vec3(0.0);
  float alpha = 0.0;
  float size = 1.0;
  float scale = length(modelViewMatrix[0].xyz);
  vHot = 0.0;
  vTint = aSeed.y;

  if (uMode < 0.5) {
    // the core's cloud: slow per-particle orbits, drift, breathing, pushed by the light wave
    float yaw = uTime * (0.05 + 0.08 * aSeed.x) + aSeed.z * 6.2832;
    p = rotY(aS0, yaw);
    p += 0.06 * vec3(sin(uTime * 0.7 + aSeed.z * 12.0), cos(uTime * 0.5 + aSeed.w * 9.0), sin(uTime * 0.6 + aSeed.x * 7.0));
    p *= 1.0 + 0.025 * sin(uTime * 1.4 + aSeed.w * 6.2832);
    float push = uWaveAmp * exp(-pow((length(p) - uWaveR) * 3.0, 2.0));
    p += normalize(p + vec3(1e-4)) * 0.35 * push;
    alpha = (0.3 + 0.7 * aSeed.w) * (0.55 + 0.45 * sin(uTime * 1.7 + aSeed.x * 40.0)) * uReveal;
    size = 0.55 + 0.9 * aSeed.x * aSeed.x + push * 1.2;
    vHot = push;
  } else if (uMode < 1.5) {
    // the morph swarm (world space): leave the old shape into a cloud, re-form as the new one
    float stagger = aSeed.w * 0.35;
    float leave = clamp((uT * 2.0 - stagger) / 0.65, 0.0, 1.0);
    float arrive = clamp(((uT - 0.5) * 2.0 - stagger) / 0.65, 0.0, 1.0);
    vec3 fromW = (uFromM * vec4(slot(uFromA, uFromB), 1.0)).xyz;
    vec3 toW = (uToM * vec4(slot(uToA, uToB), 1.0)).xyz;
    vec3 centre = mix(uFromM[3].xyz, uToM[3].xyz, smoothstep(0.0, 1.0, uT));
    float radius = mix(uFromR, uToR, uT) * mix(0.45, 1.05, aSeed.x) * (0.85 + 0.15 * sin(uTime * 1.3 + aSeed.w * 31.0));
    vec3 dir = normalize(aSeed.xyz - 0.5 + vec3(1e-3));
    dir = normalize(vec3(dir.x, dir.y * 0.45, dir.z));
    vec3 cloud = centre + rotY(dir, uTime * (0.9 + 0.8 * (1.0 - aSeed.x)) + aSeed.w * 6.2832) * radius;
    p = uT < 0.5 ? mix(fromW, cloud, easeInOut(leave)) : mix(cloud, toW, easeInOut(arrive));
    alpha = smoothstep(0.0, 0.12, uT) * smoothstep(1.0, 0.88, uT);
    size = 0.7 + 0.5 * aSeed.z;
    scale = uScale;
    vTint = fract(aSeed.w * 7.31 + aSeed.z * 3.17);
    vHot = uT < 0.5 ? leave * (1.0 - leave) * 4.0 : arrive * (1.0 - arrive) * 4.0;
  } else if (uMode < 2.5) {
    // synapse pulse heads: aS0 → aS1, layer aSeed.x
    float along = uProg - aSeed.x;
    p = mix(aS0, aS1, clamp(along, 0.0, 1.0));
    alpha = step(0.0, along) * step(along, 1.0) * uReveal;
    size = 1.6;
    vHot = 1.0;
    vTint = 0.0;
  } else {
    // mesh-wave nodes riding the wave
    float ring = 0.0;
    p = aS0;
    p.z += waveHeight(aS0.xy, ring);
    alpha = (0.4 + 0.45 * ring) * uReveal;
    size = 0.65 + ring * 0.6;
    vHot = ring;
    vTint = ring > 0.35 ? 0.95 : aSeed.y * 0.8;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = alpha;
  float px = uSize * size * scale * projectionMatrix[1][1] * uHalfHeight / max(0.2, -mv.z);
  gl_PointSize = alpha > 0.0 ? min(px, uMaxSize) : 0.0;
}
`;

const POINTS_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uHot;
uniform float uAlpha;
uniform float uIntensity;
varying float vAlpha;
varying float vTint;
varying float vHot;
${SCENE_OUTPUT_GLSL}
${SPRITE_GLSL}

void main() {
  if (vAlpha <= 0.0) discard;
  float coverage = spriteCoverage(0.3 + 0.55 * uInk);
  vec3 tint = vTint < 0.55 ? uColorA : (vTint < 0.9 ? uColorB : uColorC);
  float hotness = 1.0 - uInk;
  vec3 color = mix(tint, uHot, clamp(pow(coverage, 6.0) * 0.25 + vHot * 0.2, 0.0, 1.0) * hotness);
  gl_FragColor = sceneOutput(color, vAlpha * coverage * uAlpha * uIntensity * (1.0 + vHot * 0.4));
}
`;

export function createPointsMaterial(options: {
  mode: (typeof POINTS_MODE)[keyof typeof POINTS_MODE];
  roles: ColorRoles & { c: keyof ScenePaletteColors };
  alpha: number;
  size: number;
}): Paintable & { uniforms: PointsUniforms; roleC: keyof ScenePaletteColors } {
  const uniforms: PointsUniforms = {
    ...baseUniforms(options.mode),
    uColorC: { value: new Color() },
    uAlpha: { value: options.alpha },
    uSize: { value: options.size },
    uHalfHeight: { value: 400 },
    uMaxSize: { value: 9 },
    uScale: { value: 1 },
    uWaveR: { value: 0 },
    uWaveAmp: { value: 0 },
    uT: { value: 0 },
    uFromA: { value: new Vector3() },
    uFromB: { value: new Vector3() },
    uToA: { value: new Vector3() },
    uToB: { value: new Vector3() },
    uFromM: { value: new Matrix4() },
    uToM: { value: new Matrix4() },
    uFromR: { value: 1 },
    uToR: { value: 1 },
    uProg: { value: -1 },
    uWaveTime: { value: 0 },
    uPulseR: { value: 0 },
    uOrigin: { value: new Vector2() },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: POINTS_VERTEX,
    fragmentShader: POINTS_FRAGMENT,
    transparent: true,
    depthWrite: false,
    ...BLEND,
  });
  return { material, uniforms, roles: options.roles, roleC: options.roles.c };
}

export function paintPoints(item: ReturnType<typeof createPointsMaterial>, palette: ScenePalette): void {
  paint(item, palette);
  toColor(palette[item.roleC], item.uniforms.uColorC.value);
}

/* ---- ink adjustments ------------------------------------------------------------------------------ */

/** Sprites on a pale page: fainter and a little smaller, so the cloud stays a texture, not grain. */
export const INK_SPRITES = { alpha: 0.55, size: 0.8 } as const;
