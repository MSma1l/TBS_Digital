/**
 * The glowing edge of the laptop frame: `createRimMaterial`'s fresnel, on an `InstancedMesh`,
 * over the interior stage's own box-edge measure.
 *
 * The frame is 29 boxes drawn as ONE `InstancedMesh` (components/intro/three/laptop.ts), which
 * `createRimMaterial` cannot draw. Two reasons, both fatal and both silent:
 *
 *  · `TUBE_VERTEX` (materials.ts) is `modelViewMatrix * vec4(position + normal * uWidth, 1.0)`.
 *    There is no `instanceMatrix` in it. three r186 DECLARES the attribute under
 *    `USE_INSTANCING` (WebGLProgram's vertex prefix), but a `ShaderMaterial` carrying its own
 *    vertex shader has to actually USE it — otherwise all 29 instances collapse onto the origin
 *    and the bug reads as a broken geometry, not as a missing matrix multiply.
 *  · `position + normal * uWidth` is an extrusion along the normal. On a tube with smooth
 *    normals that widens the shell; on a box it pushes the 6 faces apart into 6 detached plates.
 *    So there is no `uWidth` here. The halo is a second `InstancedMesh` over the same geometry
 *    with `side: BackSide` and the instance matrices scaled (×1.06), which grows the box as a
 *    box. `abs(dot(n, v))` in the fragment shader is sign-agnostic, so the back faces light up
 *    exactly like the front ones — no `FLIP_SIDED` needed (three only defines it for its own
 *    materials anyway).
 *
 * AND A THIRD, which is why this file no longer lights a box with fresnel alone. A fresnel term
 * is a SILHOUETTE detector: `pow(1 - |n·v|, k)` is a function of a face's angle to the lens and
 * of nothing else. On a tube every fragment carries its own normal, so it draws a thin rim and
 * the shape reads. On a box a face is FLAT — every fragment on it shares one normal — so the
 * term is very nearly CONSTANT across the whole face: at a grazing angle the deck lit up as a
 * solid glowing tabletop and a key as a pale filled rectangle, with no rim and no gap anywhere.
 * What reads a box is where its faces MEET, and that is a fact about the geometry rather than
 * about the camera. `components/scene/three/materials.ts` already measures it for the interior
 * stage's machine (`SURFACE_MODE.edges`); the measure is copied here to the constant:
 *
 *   on the unit box `position` is ±0.5, so `abs(position) * 2` runs 0 at the centre of a face to
 *   1 at its rim. The LARGEST of the three is 1 all over the face it belongs to and the SMALLEST
 *   is 0 through the middle of the box, so neither says anything on its own; the one in the
 *   MIDDLE reaches 1 only where two faces meet. Drop the max and the min — `x + y + z - hi - lo`
 *   — and what is left is a clean 0 → 1 distance to the nearest of the twelve edges.
 *
 * So: faces stay almost dark (`face`), the twelve edges carry the light (`edge`), and the
 * fresnel is demoted to the thin grazing lift it was always meant to be (`fres`). Bright rims,
 * dark faces, and the eye reads panels and the gaps between them. It is scale-invariant — the
 * band is a fraction of each box's OWN extent — so a 0.012 vent rail and the 2.4 deck both get a
 * proportionate edge instead of the rail turning into a solid bar.
 *
 * `EDGE.side` is `DoubleSide`, and that is load-bearing rather than tidy: the camera spends
 * beats 1–3 INSIDE the deck's box, and with front faces only there is no inside — the cavity had
 * no walls, no floor and no ceiling, and K2 (the frame the SVG cross-fade lands on) was three
 * hinge barrels and a few traces floating in black. Two sides cost no extra draw call, which is
 * the only reason the cavity can have an inside at all inside a 6-call budget. It is also what
 * the interior model does, and for the reason it gives: "both sides, so every box edge shows".
 *
 * REQUIRED GEOMETRY CONTRACT — read this before wiring a mesh up:
 *  · The geometry MUST be a UNIT box (`BoxGeometry(1, 1, 1)`) sized per piece by its instance
 *    matrix. The edge measure is `abs(position) * 2` and means nothing on anything else: a
 *    `BoxGeometry(2.4, 0.16, 1.62)` puts its faces at ±1.2 and the whole object lights up.
 *  · The geometry MUST be instanced and the mesh MUST be an `InstancedMesh`. Without
 *    `USE_INSTANCING` the shader does not compile at all (`instanceMatrix` is undeclared) and
 *    three logs `THREE.WebGLProgram: Shader Error`. That is deliberate: a loud failure beats
 *    29 boxes silently stacked on the origin.
 *  · The geometry MUST carry an `InstancedBufferAttribute` named `aU`, itemSize 1, one float
 *    per instance, 0 → 1 in assembly order. It becomes `vU`, and `vU` is what the travelling
 *    red↔blue band rides — so `aU` is "how far down the build order this piece is", the same
 *    role `aU` plays in `createRingMaterial`. It is NOT `uv.x`: a box's uv is per-face, not a
 *    distance along anything. A geometry without `aU` still draws, with `vU = 0` on every
 *    instance and a band that no longer travels.
 *
 * Everything else is `createRimMaterial` unchanged: the blending is `GLOW_BLENDING`, the alpha
 * is `glowAlpha` (see components/three/glow.ts), the colours come from the palette's CSS tokens
 * and never from literals, and the shader ends with `#include <colorspace_fragment>` like every
 * other custom shader in the project.
 */

import { BackSide, DoubleSide, ShaderMaterial, type Color, type Side } from "three";
import { GLOW_ALPHA_GLSL, GLOW_BLENDING } from "@/components/three/glow";
import type { IntroPalette } from "./materials";

type Uniform<T> = { value: T };

export type EdgeUniforms = {
  uRed: Uniform<Color>;
  uBlue: Uniform<Color>;
  uHot: Uniform<Color>;
  uTime: Uniform<number>;
  uPower: Uniform<number>;
  uStrength: Uniform<number>;
  uIntensity: Uniform<number>;
  uFlash: Uniform<number>;
  uFace: Uniform<number>;
  uEdge: Uniform<number>;
  uFres: Uniform<number>;
  uSoft: Uniform<number>;
};

export type EdgeOptions = {
  /** Fresnel exponent: higher is a thinner grazing lift. */
  power: number;
  /** Constant multiplier (the halo is a fainter copy). */
  strength: number;
  /** What a FACE is worth. Almost nothing: a lit face is a slab, and a slab is not a machine. */
  face: number;
  /** What an EDGE is worth. This is the object — the twelve places where two faces meet. */
  edge: number;
  /** What the grazing fresnel adds on top. A lift on the silhouette, never the shape itself. */
  fres: number;
  /** Where the edge band starts on the 0 → 1 distance-to-edge measure. Lower is a wider band. */
  soft: number;
  side: Side;
};

/**
 * The frame itself. `soft` 0.88 is a hair tighter than the interior model's band
 * (`SURFACE_MODE.edges`, 0.84) — the outer 6% of each face's half-extent, not 8%, because this
 * machine is flown THROUGH and a vent rail crossing the lens at 0.02 turns any wider band into a
 * white flare. `fres` 0.006 behind `power` 2.6 is all that is left of the exponent that used to
 * light whole faces by itself.
 *
 * The levels look absurdly small next to `edge` and they are not: the shader's output is ENCODED
 * (`#include <colorspace_fragment>`), and sRGB encoding is roughly a square root down here, so
 * 0.003 of linear light is 6% on screen and not 0.3%. The deck's top face covers half the frame
 * at K3, the camera sees it edge-on, and `DoubleSide` means every pixel of it is painted twice
 * and then added to — at `face` 0.04 that was a solid magenta tabletop. 0.003 + 0.006 of grazing
 * lift is the same slab reading as a dark panel with a lit rim, which is the point of the file.
 */
export const EDGE: EdgeOptions = {
  power: 2.6,
  strength: 1,
  face: 0.003,
  edge: 0.36,
  fres: 0.006,
  soft: 0.88,
  side: DoubleSide,
};
/**
 * The back-face copy, drawn over instance matrices scaled ×1.06 — never over an extrusion. No
 * face at all and a much wider, softer band, so it is a bloom around each piece's edges rather
 * than a second machine sitting inside the first.
 */
export const EDGE_HALO: EdgeOptions = {
  power: 1.6,
  strength: 0.28,
  face: 0,
  edge: 0.16,
  fres: 0.06,
  soft: 0.55,
  side: BackSide,
};

/**
 * Per-instance vertex shader.
 *
 * The normal needs care. `normalMatrix` is the inverse transpose of `modelViewMatrix` only — it
 * knows nothing about the instance. And the frame's boxes are deliberately scaled
 * non-uniformly (a rail is long and thin, a foot is a stub), so simply rotating the normal by
 * `mat3(instanceMatrix)` would tilt it towards the stretched axis and the fresnel would light
 * the wrong faces on exactly the pieces that read as a laptop.
 *
 * The fix is three's own, from `defaultnormal_vertex.glsl.js` under `USE_INSTANCING`: divide
 * the object normal by the SQUARED length of each instance column, then multiply by the
 * instance matrix. For a rotation·scale matrix that is the inverse transpose (R·S · S⁻² = R·S⁻¹)
 * without building one per instance. Shear is not supported — the frame has none. `normalMatrix`
 * is applied last, for the group's own transform.
 */
const EDGE_VERTEX = /* glsl */ `
attribute float aU;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vBox;
varying float vU;

void main() {
  // Per-instance progress along the build order, NOT uv.x (see the geometry contract above).
  vU = aU;
  // The UNIT box's own coordinate, ±0.5, BEFORE the instance matrix stretches it. That is what
  // makes the edge band a fraction of each piece rather than a fixed width in world units.
  vBox = position;

  // instanceMatrix FIRST, then modelViewMatrix — without it every instance sits on the origin.
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);

  mat3 im = mat3(instanceMatrix);
  vec3 n = normal / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
  vNormal = normalize(normalMatrix * (im * n));
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

/** The additive edge of the instanced frame (and, as a back-face copy, its halo). */
export function createEdgeMaterial(
  palette: IntroPalette,
  options: EdgeOptions,
): { material: ShaderMaterial; uniforms: EdgeUniforms } {
  const uniforms: EdgeUniforms = {
    uRed: { value: palette.red },
    uBlue: { value: palette.blue },
    uHot: { value: palette.txt },
    uTime: { value: 0 },
    uPower: { value: options.power },
    uStrength: { value: options.strength },
    uIntensity: { value: 1 },
    uFlash: { value: 0 },
    uFace: { value: options.face },
    uEdge: { value: options.edge },
    uFres: { value: options.fres },
    uSoft: { value: options.soft },
  };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: EDGE_VERTEX,
    fragmentShader: /* glsl */ `
      uniform vec3 uRed;
      uniform vec3 uBlue;
      uniform vec3 uHot;
      uniform float uTime;
      uniform float uPower;
      uniform float uStrength;
      uniform float uIntensity;
      uniform float uFlash;
      uniform float uFace;
      uniform float uEdge;
      uniform float uFres;
      uniform float uSoft;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vBox;
      varying float vU;
      ${GLOW_ALPHA_GLSL}

      void main() {
        // Where two faces meet: drop the largest of |x|,|y|,|z| (constant over a whole face) and
        // the smallest (0 through the middle of the box) and keep the one in between, which
        // reaches 1 only along one of the twelve edges. See the file comment.
        vec3 a = abs(vBox) * 2.0;
        float hi = max(a.x, max(a.y, a.z));
        float lo = min(a.x, min(a.y, a.z));
        float edge = smoothstep(uSoft, 0.985, a.x + a.y + a.z - hi - lo);

        // The grazing lift, and nothing more than a lift.
        float facing = clamp(abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0);
        float f = pow(1.0 - facing, uPower);

        float band = 0.5 + 0.5 * sin(vU * 6.28318 - uTime * 0.8);
        vec3 tint = mix(mix(uRed, uBlue, band), uHot, clamp(uFlash, 0.0, 1.0));
        // An edge runs hotter than the face it belongs to — the interior model's own 0.45 of hot.
        vec3 rim = mix(tint, uHot, edge * 0.3);
        vec3 color = (tint * (uFace + f * uFres) + rim * edge * uEdge) * uStrength * uIntensity;
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
