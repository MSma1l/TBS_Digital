"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { IntroTier } from "./capability";
import type { IntroFx } from "./fx";
import { createInfinityCore } from "./three/core";
import type { IntroPalette } from "./three/materials";

type InfinityCoreProps = {
  fx: IntroFx;
  tier: IntroTier;
  palette: IntroPalette;
  /** FPS governor's last step: hide the halo and the scan rings. */
  lite: boolean;
};

/**
 * The glass ∞ — a thin R3F wrapper around `three/core.ts`. The tier and palette are fixed
 * for the scene's lifetime (`IntroScene` keys the world by tier), so the core is built once.
 */
export function InfinityCore({ fx, tier, palette, lite }: InfinityCoreProps) {
  const [core] = useState(() => createInfinityCore(tier, palette));

  useEffect(() => () => core.dispose(), [core]);
  useEffect(() => core.setLite(lite), [core, lite]);
  useFrame((_, dt) => core.update(dt, fx));

  return <primitive object={core.group} />;
}
