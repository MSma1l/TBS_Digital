/**
 * The orbiting light particles as one imperative object. `OrbitParticles.tsx` creates it,
 * feeds it the fx every frame and disposes it.
 *
 * The CPU never moves a particle: the attributes from `buildOrbitAttributes` are uploaded
 * once and the vertex shader places every point from the uniforms.
 */

import { BufferAttribute, BufferGeometry, Points, Sphere, Vector3 } from "three";
import { MAX_FRAME_STEP } from "@/components/three/motion";
import type { IntroTier } from "../capability";
import type { IntroFx } from "../fx";
import { TIER_CONFIG } from "../tiers";
import { createParticleMaterial, type IntroPalette } from "./materials";
import { ORBIT_SEED, buildOrbitAttributes } from "./random";

export type OrbitParticleField = {
  points: Points;
  count: number;
  /**
   * @param halfHeightPx half the drawing buffer's height in device pixels
   * @param pixelRatio the canvas's current device-pixel ratio
   */
  update(dt: number, fx: IntroFx, halfHeightPx: number, pixelRatio: number): void;
  /** "lite" (FPS governor): draw only the first half of the buffer. */
  setLite(lite: boolean): void;
  dispose(): void;
};

/** Largest sprite, in CSS pixels, before the fill-rate cap. */
export const PARTICLE_MAX_CSS_PX = 42;

/** Far enough to hold every orbit and the whole burst (the attributes place nothing on CPU). */
const PARTICLE_BOUNDS = new Sphere(new Vector3(0, 0, 0), 14);

export function createOrbitParticles(
  tier: IntroTier,
  palette: IntroPalette,
  portrait: boolean,
  seed: number = ORBIT_SEED,
): OrbitParticleField {
  const attributes = buildOrbitAttributes(TIER_CONFIG[tier].particles, portrait, seed);
  const geometry = new BufferGeometry();
  // `position` only has to exist (three sizes the draw from it); the shader ignores it.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(attributes.count * 3), 3));
  geometry.setAttribute("aAxisU", new BufferAttribute(attributes.aAxisU, 3));
  geometry.setAttribute("aAxisV", new BufferAttribute(attributes.aAxisV, 3));
  geometry.setAttribute("aOrbit", new BufferAttribute(attributes.aOrbit, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(attributes.aPhase, 1));
  geometry.setAttribute("aSeed", new BufferAttribute(attributes.aSeed, 3));
  geometry.boundingSphere = PARTICLE_BOUNDS.clone();

  const { material, uniforms } = createParticleMaterial(palette);
  const points = new Points(geometry, material);
  points.name = "intro-orbit-particles";
  points.renderOrder = 6;
  points.frustumCulled = false;

  return {
    points,
    count: attributes.count,

    update(dt, fx, halfHeightPx, pixelRatio) {
      const step = Math.min(Math.max(dt, 0), MAX_FRAME_STEP);
      // Accumulated rather than elapsed × speed, so a speed change never makes them jump.
      uniforms.uTime.value += step * (1 + fx.progress * 1.2 + fx.charge * 2.5);
      uniforms.uSync.value = fx.progress;
      uniforms.uExplode.value = fx.explode - fx.charge * 0.12;
      uniforms.uPulse.value = fx.pulse;
      uniforms.uViewportHalfHeight.value = halfHeightPx;
      uniforms.uMaxSize.value = PARTICLE_MAX_CSS_PX * pixelRatio;
    },

    setLite(lite) {
      geometry.setDrawRange(0, lite ? Math.floor(attributes.count / 2) : Infinity);
    },

    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
