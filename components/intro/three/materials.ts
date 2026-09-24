/**
 * The intro's palette and materials.
 *
 * Colours come from the site's CSS tokens at runtime, never from literals: the machine stays on
 * brand if the palette changes, and a token that cannot be read throws, which the director's
 * error boundary turns into the SVG fallback (`readTokenColors`, components/three/palette.ts).
 *
 * The four shaders that carried the ∞'s shape — `TUBE_VERTEX` and the fresnel glass, rim and
 * pulse line built on it — are gone with it. They read `uv.x` as arc length on a closed loop and
 * extruded along a smooth normal, neither of which means anything on a box; the fresnel itself
 * lives on in `./edge.ts`, which reads `instanceMatrix` and a per-instance `aU` instead.
 *
 * Every custom shader ends with `#include <colorspace_fragment>`, so its linear-space output
 * is encoded for the sRGB canvas exactly like three's built-in materials.
 *
 * Glow on a transparent canvas: the canvas is `alpha: true` (the overlay's CSS grid and
 * glows show through it), so the glowing materials use `GLOW_BLENDING` and `glowAlpha` —
 * shared with the interior scene in components/three/glow.ts, which explains why.
 */

import { FrontSide, MeshPhysicalMaterial, ShaderMaterial, type Color } from "three";
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

/* ---------------------------------------------------------------------------- glass */

/** Resting iridescence of the physical glass; the heartbeat adds to it. */
export const GLASS_IRIDESCENCE = 0.45;

/**
 * High tier: transmission glass lit by the procedural PMREM environment. The ONE transmissive
 * surface in the scene — the laptop's cover glass — because `transmission: 1` re-renders
 * everything into a multisampled target once per frame per surface.
 *
 * `thickness` is deliberately small: a thick slab refracts like a lens and reads as coloured
 * plastic. The 0.12 here was tuned for a 0.32 rod; `three/laptop.ts` lowers it to the lid's own
 * 0.05 at construction, since a thickness greater than the slab is a contradiction.
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
  /**
   * Sprite diameter in scene units, at `modelScale` 1.
   *
   * Recalibrated with the fit group: `modelScale` below is `length(modelViewMatrix[0].xyz)`, and
   * with nothing scaling the world any more that is exactly 1 on every viewport instead of the
   * old fit's 1.0 (desktop) to 0.51 (phone portrait). The camera also lives an order of magnitude
   * closer now — K4 sits 2.4 units off the origin where the old rig sat at 6 — and point size is
   * inverse in view depth. 0.06 at 6 units through a 40 degree lens and 0.028 at 2.4 through a 46
   * degree one land on the same handful of pixels, which is what a light particle is.
   */
  uSize: Uniform<number>;
  /** Half the drawing buffer's height in device pixels. */
  uViewportHalfHeight: Uniform<number>;
  /** Fill-rate cap in device pixels. */
  uMaxSize: Uniform<number>;
  /**
   * Where the camera is on its flight (`IntroFx.flight`). The cloud is sized and faded by it:
   * see `outside` in the vertex shader. Not a decoration — it is what keeps the orbits off the
   * lens while the camera is inside the chassis.
   */
  uFlight: Uniform<number>;
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
    uSize: { value: 0.028 },
    uViewportHalfHeight: { value: 400 },
    uMaxSize: { value: 42 },
    uFlight: { value: 0 },
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
      uniform float uFlight;
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
        // The burst: thrown outwards from the machine (negative = the implosion).
        p += normalize(p + vec3(1e-4)) * uExplode * (2.5 + aSeed.z * 5.0);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // …and towards the LENS, in VIEW space. The camera looks down -z in view space whatever
        // it is doing in the world, so +z here is out of the screen, always. The old world-space
        // "p.z += uExplode * 3.0" was written for a rig parked on the world's +z axis; the
        // flight's camera is looking roughly -z when the burst fires, so that line threw the
        // cloud out of the BACK of the frame. A negative uExplode still pulls it away from the
        // lens, which is the implosion, exactly as before.
        mv.z += uExplode * 2.4;
        gl_Position = projectionMatrix * mv;

        // The cloud belongs to the machine seen WHOLE. Inside the chassis the orbits (1.5 to 2.4
        // across) sit centimetres from a camera that is at the origin, every sprite clamps to
        // uMaxSize, and the one beat that has to read as a narrow canyon fills with soft blobs
        // instead. So they arrive as the camera comes out through the vent and not before — and
        // as a SIZE, not only an alpha, so a hidden sprite costs no fill either.
        //
        // 0.60, not 0.42: this pair is the EXIT, written as a number, and K3 moved the exit from
        // u ~0.45 to 0.5950 (the widen cap) — 0.6058 (16:10). At 0.42 the cloud was already a
        // third of the way in by the time the camera was still a beat short of the vent, which is
        // precisely the failure the paragraph above exists to prevent. laptop.ts carries the
        // same number for the halo; they move together or the machine glows before it is visible.
        float outside = smoothstep(0.60, 0.80, uFlight);

        // Projected like geometry. There is no fit group any more, so this is 1 and the sprite is
        // the size uSize states; the cap is what keeps one that sweeps past the lens during the
        // dive cheap to fill.
        float modelScale = length(modelViewMatrix[0].xyz);
        float burst = max(uExplode, 0.0);
        float size = uSize * (0.6 + aSeed.z) * (1.0 + uPulse * 0.5 + burst * 1.2) * modelScale * outside;
        gl_PointSize = min(size * projectionMatrix[1][1] * uViewportHalfHeight / max(0.2, -mv.z), uMaxSize);

        float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase * 5.0);
        vAlpha = outside * (1.0 - smoothstep(0.85, 1.0, uExplode)) * mix(twinkle, 1.0, burst);
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
