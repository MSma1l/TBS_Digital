/**
 * The intro's palette and materials.
 *
 * Colours come from the site's CSS tokens at runtime, never from literals: the ∞ stays on
 * brand if the palette changes, and a token that cannot be read throws, which the director's
 * error boundary turns into the SVG fallback (`readTokenColors`, components/three/palette.ts).
 *
 * Every custom shader ends with `#include <colorspace_fragment>`, so its linear-space output
 * is encoded for the sRGB canvas exactly like three's built-in materials.
 *
 * Glow on a transparent canvas: the canvas is `alpha: true` (the overlay's CSS grid and
 * glows show through it), so the glowing materials use `GLOW_BLENDING` and `glowAlpha` —
 * shared with the interior scene in components/three/glow.ts, which explains why.
 */

import {
  BackSide,
  FrontSide,
  MeshPhysicalMaterial,
  ShaderMaterial,
  type Color,
  type Side,
} from "three";
import { GLOW_ALPHA_GLSL, GLOW_BLENDING } from "@/components/three/glow";
import { readTokenColors } from "@/components/three/palette";

export { GLOW_ALPHA_GLSL, GLOW_BLENDING } from "@/components/three/glow";
export { isParsableTokenColor, readTokenColors } from "@/components/three/palette";

export type IntroPalette = {
  red: Color;
  redLift: Color;
  blue: Color;
  cyan: Color;
  txt: Color;
  voidBg: Color;
  /** Derived: cyan washed towards the text white, for the third particle tone. */
  ice: Color;
};

/** Which CSS custom property each colour is read from (they must stay hex or rgb()). */
export const PALETTE_TOKENS = {
  red: "--red",
  redLift: "--red-lift",
  blue: "--blue",
  cyan: "--dark-cyan",
  txt: "--dark-txt",
  voidBg: "--void",
} as const;

/**
 * Read the palette from the document's computed tokens. Throws a descriptive error when a
 * token is missing or in a format three.js can't parse (e.g. `color-mix()` or `oklch()`).
 */
export function readIntroPalette(root: Element = document.documentElement): IntroPalette {
  const colors = readTokenColors(PALETTE_TOKENS, root);
  return { ...colors, ice: colors.cyan.clone().lerp(colors.txt, 0.45) };
}

type Uniform<T> = { value: T };

/* ---------------------------------------------------------------- tube vertex shader */

/** Shared by the glass, rim, halo and line: view-space normal and view vector, arc length. */
const TUBE_VERTEX = /* glsl */ `
uniform float uWidth;
varying vec3 vNormal;
varying vec3 vView;
varying float vU;

void main() {
  vU = uv.x;
  // Extrude along the normal (a uniform scale would drift off the curve at the lobes).
  vec4 mv = modelViewMatrix * vec4(position + normal * uWidth, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

/* ---------------------------------------------------------------------------- glass */

/** Resting iridescence of the physical glass; the heartbeat adds to it. */
export const GLASS_IRIDESCENCE = 0.45;

/**
 * High tier: transmission glass lit by the procedural PMREM environment.
 *
 * `thickness` is deliberately small. A solid rod refracts like a cylindrical lens: at the
 * sketch's 0.6 (wider than the 0.32 tube) it magnified the pulse line across the whole tube,
 * which read as flat coloured plastic. At 0.12 the glass stays dark and clear, and the line
 * shows as a glowing core that swells a little towards the tube's centre.
 */
export function createPhysicalGlass(palette: IntroPalette): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: palette.txt,
    metalness: 0,
    roughness: 0.06,
    transmission: 1,
    thickness: 0.12,
    ior: 1.4,
    attenuationColor: palette.blue,
    attenuationDistance: 2.5,
    iridescence: GLASS_IRIDESCENCE,
    iridescenceIOR: 1.25,
    iridescenceThicknessRange: [120, 480],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.2,
    side: FrontSide,
  });
}

export type FresnelGlassUniforms = {
  uWidth: Uniform<number>;
  uRed: Uniform<Color>;
  uBlue: Uniform<Color>;
  uTxt: Uniform<Color>;
  uTime: Uniform<number>;
  uGlow: Uniform<number>;
};

/** Mid/low tiers: a see-through fresnel shell with a red↔blue band and fake highlights. */
export function createFresnelGlass(palette: IntroPalette): {
  material: ShaderMaterial;
  uniforms: FresnelGlassUniforms;
} {
  const uniforms: FresnelGlassUniforms = {
    uWidth: { value: 0 },
    uRed: { value: palette.red },
    uBlue: { value: palette.blue },
    uTxt: { value: palette.txt },
    uTime: { value: 0 },
    uGlow: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: TUBE_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uTxt;
      uniform float uTime;
      uniform float uGlow;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vU;

      void main() {
        vec3 n = normalize(vNormal);
        float facing = clamp(abs(dot(n, normalize(vView))), 0.0, 1.0);
        float f = pow(1.0 - facing, 2.4);
        float band = 0.5 + 0.5 * sin(vU * 6.28318 - uTime * 0.8);
        // Fake specular: a crisp streak along the top of the tube, a softer one on its left.
        float streak = smoothstep(0.86, 1.0, n.y) * 0.55 + smoothstep(0.92, 1.0, -n.x) * 0.25;
        vec3 color = mix(uRed, uBlue, band) * f * (1.2 + uGlow) + uTxt * streak;
        gl_FragColor = vec4(color, clamp(0.08 + f * 0.85 + streak * 0.5, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  });
  return { material, uniforms };
}

/* --------------------------------------------------------------------- rim and halo */

export type RimUniforms = {
  uWidth: Uniform<number>;
  uRed: Uniform<Color>;
  uBlue: Uniform<Color>;
  uHot: Uniform<Color>;
  uTime: Uniform<number>;
  uPower: Uniform<number>;
  uStrength: Uniform<number>;
  uIntensity: Uniform<number>;
  uFlash: Uniform<number>;
};

export type RimOptions = {
  /** Extrusion along the normal, scene units. */
  width: number;
  /** Fresnel exponent: higher is a thinner edge. */
  power: number;
  /** Constant multiplier (the halo is a fainter copy). */
  strength: number;
  side: Side;
};

export const RIM: RimOptions = { width: 0.02, power: 3.2, strength: 1, side: FrontSide };
export const HALO: RimOptions = { width: 0.09, power: 2, strength: 0.28, side: BackSide };

/** The additive fresnel edge on every tier (and, as a wider back-face copy, the halo). */
export function createRimMaterial(
  palette: IntroPalette,
  options: RimOptions,
): { material: ShaderMaterial; uniforms: RimUniforms } {
  const uniforms: RimUniforms = {
    uWidth: { value: options.width },
    uRed: { value: palette.red },
    uBlue: { value: palette.blue },
    uHot: { value: palette.txt },
    uTime: { value: 0 },
    uPower: { value: options.power },
    uStrength: { value: options.strength },
    uIntensity: { value: 1 },
    uFlash: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: TUBE_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uHot;
      uniform float uTime;
      uniform float uPower;
      uniform float uStrength;
      uniform float uIntensity;
      uniform float uFlash;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vU;
      ${GLOW_ALPHA_GLSL}

      void main() {
        float facing = clamp(abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0);
        float f = pow(1.0 - facing, uPower);
        float band = 0.5 + 0.5 * sin(vU * 6.28318 - uTime * 0.8);
        vec3 tint = mix(mix(uRed, uBlue, band), uHot, clamp(uFlash, 0.0, 1.0));
        vec3 color = tint * f * uStrength * uIntensity;
        gl_FragColor = vec4(color, glowAlpha(color));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: options.side,
    ...GLOW_BLENDING,
  });
  return { material, uniforms };
}

/* ------------------------------------------------------------------------ pulse line */

export type PulseLineUniforms = {
  uWidth: Uniform<number>;
  uRed: Uniform<Color>;
  uBlue: Uniform<Color>;
  uHot: Uniform<Color>;
  uTime: Uniform<number>;
  uHead: Uniform<number>;
  uBase: Uniform<number>;
  uFlash: Uniform<number>;
};

/**
 * The "frequency" line inside the glass with two comets half a loop apart. Not transparent
 * on purpose: three draws it in the opaque pass, so the high tier's transmission pass
 * captures it and the glass visibly refracts it. It still blends as light.
 */
export function createPulseLineMaterial(palette: IntroPalette): {
  material: ShaderMaterial;
  uniforms: PulseLineUniforms;
} {
  const uniforms: PulseLineUniforms = {
    uWidth: { value: 0 },
    uRed: { value: palette.redLift },
    uBlue: { value: palette.blue },
    uHot: { value: palette.txt },
    uTime: { value: 0 },
    uHead: { value: 0 },
    uBase: { value: 0.5 },
    uFlash: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: TUBE_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uHot;
      uniform float uTime;
      uniform float uHead;
      uniform float uBase;
      uniform float uFlash;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vU;
      ${GLOW_ALPHA_GLSL}

      void main() {
        float band = 0.5 + 0.5 * sin(vU * 6.28318 - uTime * 0.8);
        vec3 tint = mix(uRed, uBlue, band);
        // fract(head - u) is 0 at the head and grows behind it: a sharp front, a long tail.
        float comet = exp(-fract(uHead - vU) * 18.0) + exp(-fract(uHead + 0.5 - vU) * 18.0);
        float core = 0.6 + 0.4 * clamp(abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0);
        vec3 hot = mix(tint, uHot, clamp(comet * comet, 0.0, 1.0));
        vec3 color = (tint * uBase * 0.55 + hot * comet * (uBase + comet * 2.5)) * core;
        color += uHot * uFlash;
        gl_FragColor = vec4(color, glowAlpha(color));
        #include <colorspace_fragment>
      }
    `,
    transparent: false,
    depthWrite: true,
    ...GLOW_BLENDING,
  });
  return { material, uniforms };
}

/* ------------------------------------------------------------------------ scan rings */

export type RingUniforms = {
  uColor: Uniform<Color>;
  uHot: Uniform<Color>;
  uFill: Uniform<number>;
  uHead: Uniform<number>;
  uStrength: Uniform<number>;
};

/** Rings light up in order as the counter fills; a brighter sweep follows the comet. */
export function createRingMaterial(palette: IntroPalette): {
  material: ShaderMaterial;
  uniforms: RingUniforms;
} {
  const uniforms: RingUniforms = {
    uColor: { value: palette.cyan },
    uHot: { value: palette.txt },
    uFill: { value: 0 },
    uHead: { value: 0 },
    uStrength: { value: 1 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aU;
      varying float vU;

      void main() {
        vU = aU;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uHot;
      uniform float uFill;
      uniform float uHead;
      uniform float uStrength;
      varying float vU;
      ${GLOW_ALPHA_GLSL}

      void main() {
        float lit = step(vU, uFill) * step(0.001, uFill);
        float sweep = exp(-fract(uHead - vU) * 10.0);
        vec3 color = mix(uColor, uHot, sweep * 0.5) * lit * (0.25 + 0.75 * sweep) * uStrength;
        gl_FragColor = vec4(color, glowAlpha(color));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    ...GLOW_BLENDING,
  });
  return { material, uniforms };
}

/* ------------------------------------------------------------------------- particles */

export type ParticleUniforms = {
  uRed: Uniform<Color>;
  uBlue: Uniform<Color>;
  uIce: Uniform<Color>;
  uHot: Uniform<Color>;
  uTime: Uniform<number>;
  uSync: Uniform<number>;
  uExplode: Uniform<number>;
  uPulse: Uniform<number>;
  /** Sprite diameter in scene units. */
  uSize: Uniform<number>;
  /** Half the drawing buffer's height in device pixels. */
  uViewportHalfHeight: Uniform<number>;
  /** Fill-rate cap in device pixels. */
  uMaxSize: Uniform<number>;
};

/** Round, soft, additive sprites. All motion is in the vertex shader. */
export function createParticleMaterial(palette: IntroPalette): {
  material: ShaderMaterial;
  uniforms: ParticleUniforms;
} {
  const uniforms: ParticleUniforms = {
    uRed: { value: palette.redLift },
    uBlue: { value: palette.blue },
    uIce: { value: palette.ice },
    uHot: { value: palette.txt },
    uTime: { value: 0 },
    uSync: { value: 0 },
    uExplode: { value: 0 },
    uPulse: { value: 0 },
    uSize: { value: 0.06 },
    uViewportHalfHeight: { value: 400 },
    uMaxSize: { value: 42 },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSync;
      uniform float uExplode;
      uniform float uPulse;
      uniform float uSize;
      uniform float uViewportHalfHeight;
      uniform float uMaxSize;
      attribute vec3 aAxisU;
      attribute vec3 aAxisV;
      attribute vec3 aOrbit;
      attribute float aPhase;
      attribute vec3 aSeed;
      varying float vAlpha;
      varying float vTint;

      void main() {
        float angle = aPhase + uTime * aOrbit.z;
        // Scattered at 0%, pulled onto crisp orbits as the counter reaches 100%.
        float spread = mix(1.8, 0.35, clamp(uSync, 0.0, 1.0));
        vec3 normalAxis = cross(aAxisU, aAxisV);
        float radial = aSeed.x * spread * 0.5;
        vec3 p = aAxisU * cos(angle) * (aOrbit.x + radial)
               + aAxisV * sin(angle) * (aOrbit.y + radial)
               + normalAxis * aSeed.y * spread * 0.25;
        // The burst: thrown outwards and towards the camera (negative = the implosion).
        p += normalize(p + vec3(1e-4)) * uExplode * (2.5 + aSeed.z * 5.0);
        p.z += uExplode * 3.0;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;

        // Projected like geometry, so the rig's fit scale shrinks the sprites on a phone;
        // capped so the ones sweeping past the camera during the dolly stay cheap to fill.
        float modelScale = length(modelViewMatrix[0].xyz);
        float burst = max(uExplode, 0.0);
        float size = uSize * (0.6 + aSeed.z) * (1.0 + uPulse * 0.5 + burst * 1.2) * modelScale;
        gl_PointSize = min(size * projectionMatrix[1][1] * uViewportHalfHeight / max(0.2, -mv.z), uMaxSize);

        float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase * 5.0);
        vAlpha = (1.0 - smoothstep(0.85, 1.0, uExplode)) * mix(twinkle, 1.0, burst);
        vTint = fract(aPhase * 3.7 + aSeed.z * 0.5);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uIce;
      uniform vec3 uHot;
      varying float vAlpha;
      varying float vTint;
      ${GLOW_ALPHA_GLSL}

      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float g = smoothstep(0.5, 0.0, d);
        g *= g;
        vec3 tint = vTint < 0.45 ? uRed : (vTint < 0.9 ? uBlue : uIce);
        vec3 color = (tint * (0.7 + g * 1.8) * g + uHot * pow(g, 6.0) * 0.6) * vAlpha;
        gl_FragColor = vec4(color, glowAlpha(color));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    ...GLOW_BLENDING,
  });
  return { material, uniforms };
}
