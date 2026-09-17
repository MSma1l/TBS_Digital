/**
 * The glass ∞ as one imperative object: meshes, materials and the per-frame uniform writes.
 * `InfinityCore.tsx` creates it once, calls `update` from `useFrame` and `dispose` on unmount.
 *
 * Draw order (renderOrder inside three's opaque → transmissive → transparent lists):
 * pulse line 1 → glass 2 → rim 3 → halo 4 → scan rings 5 (the particles are 6).
 */

import { Group, LineSegments, Mesh, type Material, type Object3D } from "three";
import { MAX_FRAME_STEP } from "@/components/three/motion";
import type { IntroTier } from "../capability";
import type { IntroFx } from "../fx";
import { TIER_CONFIG } from "../tiers";
import { createCoreGeometry } from "./geometry";
import {
  GLASS_IRIDESCENCE,
  HALO,
  RIM,
  createFresnelGlass,
  createPhysicalGlass,
  createPulseLineMaterial,
  createRimMaterial,
  createRingMaterial,
  type IntroPalette,
} from "./materials";

export type InfinityCore = {
  group: Group;
  update(dt: number, fx: IntroFx): void;
  /** "lite" (FPS governor): no halo, no scan rings. Materials are never swapped. */
  setLite(lite: boolean): void;
  dispose(): void;
};

function place<T extends Object3D>(object: T, renderOrder: number): T {
  object.renderOrder = renderOrder;
  // The rim and halo are displaced in the vertex shader and the camera flies into the ∞:
  // the CPU bounding sphere would be wrong, and there are only a handful of objects.
  object.frustumCulled = false;
  return object;
}

export function createInfinityCore(tier: IntroTier, palette: IntroPalette): InfinityCore {
  const config = TIER_CONFIG[tier];
  const geometry = createCoreGeometry(config);
  const group = new Group();
  group.name = "intro-infinity-core";
  const materials: Material[] = [];

  const line = createPulseLineMaterial(palette);
  materials.push(line.material);
  group.add(place(new Mesh(geometry.line, line.material), 1));

  const glass =
    config.glass === "physical"
      ? { kind: "physical" as const, material: createPhysicalGlass(palette) }
      : { kind: "fresnel" as const, ...createFresnelGlass(palette) };
  materials.push(glass.material);
  group.add(place(new Mesh(geometry.tube, glass.material), 2));

  const rim = createRimMaterial(palette, RIM);
  materials.push(rim.material);
  group.add(place(new Mesh(geometry.tube, rim.material), 3));

  const halo = config.halo ? createRimMaterial(palette, HALO) : null;
  const haloMesh = halo ? place(new Mesh(geometry.tube, halo.material), 4) : null;
  if (halo && haloMesh) {
    materials.push(halo.material);
    group.add(haloMesh);
  }

  const rings = geometry.rings ? createRingMaterial(palette) : null;
  const ringMesh =
    geometry.rings && rings ? place(new LineSegments(geometry.rings, rings.material), 5) : null;
  if (rings && ringMesh) {
    materials.push(rings.material);
    group.add(ringMesh);
  }

  let time = 0;
  let head = 0;

  return {
    group,

    update(dt, fx) {
      const step = Math.min(Math.max(dt, 0), MAX_FRAME_STEP);
      time += step;
      // The comets speed up with the counter and race during the implosion.
      head = (head + step * (0.22 + fx.progress * 0.55 + fx.charge * 1.2)) % 1;

      const glow = 1 + fx.progress * 0.7 + fx.pulse * 1.1 + fx.charge * 1.5 + fx.flash * 1.3;

      line.uniforms.uTime.value = time;
      line.uniforms.uHead.value = head;
      line.uniforms.uBase.value = 0.5 + fx.progress * 0.9 + fx.flash * 2;
      line.uniforms.uFlash.value = fx.flash * 0.5;

      rim.uniforms.uTime.value = time;
      rim.uniforms.uIntensity.value = glow;
      // White-hot, not white-out: the DOM flash layer above the canvas does the white-out.
      rim.uniforms.uFlash.value = fx.flash * 0.75;

      if (halo) {
        halo.uniforms.uTime.value = time;
        // The halo is soft light around the tube; seen from inside the dolly it would be a
        // flat band, so it recedes as the camera flies in.
        halo.uniforms.uIntensity.value = glow * (1 - fx.dolly * 0.7);
        halo.uniforms.uFlash.value = fx.flash * 0.4;
      }

      if (glass.kind === "fresnel") {
        glass.uniforms.uTime.value = time;
        glass.uniforms.uGlow.value = fx.pulse * 0.8 + fx.charge + fx.flash;
      } else {
        // Stays above 0, so the iridescence define never toggles (no shader recompile).
        glass.material.iridescence = GLASS_IRIDESCENCE + fx.pulse * 0.3;
      }

      if (rings) {
        rings.uniforms.uFill.value = fx.progress;
        rings.uniforms.uHead.value = head;
        // The rings are HUD, not glass: they fade out as the core bursts.
        rings.uniforms.uStrength.value = 1 - Math.min(1, fx.burst * 1.6);
      }
    },

    setLite(lite) {
      if (haloMesh) haloMesh.visible = !lite;
      if (ringMesh) ringMesh.visible = !lite;
    },

    dispose() {
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
