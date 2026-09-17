"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import type { IntroTier } from "./capability";
import type { IntroFx } from "./fx";
import type { IntroPalette } from "./three/materials";
import { createOrbitParticles } from "./three/particles";

type OrbitParticlesProps = {
  fx: IntroFx;
  tier: IntroTier;
  palette: IntroPalette;
  /** FPS governor's last step: draw half the particles. */
  lite: boolean;
};

/**
 * Light particles on three tilted orbits — a thin R3F wrapper around `three/particles.ts`.
 * Rebuilt only when the viewport flips between portrait and landscape (the orbits stretch).
 */
export function OrbitParticles({ fx, tier, palette, lite }: OrbitParticlesProps) {
  const portrait = useThree((state) => state.size.width < state.size.height);
  const field = useMemo(
    () => createOrbitParticles(tier, palette, portrait),
    [tier, palette, portrait],
  );

  useEffect(() => () => field.dispose(), [field]);
  useEffect(() => field.setLite(lite), [field, lite]);
  useFrame((state, dt) =>
    field.update(dt, fx, state.size.height * state.viewport.dpr * 0.5, state.viewport.dpr),
  );

  return <primitive object={field.points} />;
}
