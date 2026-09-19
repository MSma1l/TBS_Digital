"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { IntroTier } from "./capability";
import type { IntroFx } from "./fx";
import { createIntroLaptop } from "./three/laptop";
import type { IntroPalette } from "./three/materials";

type IntroLaptopProps = {
  fx: IntroFx;
  tier: IntroTier;
  palette: IntroPalette;
  /** FPS governor's last step: no halo, no cover glass, the keys and the port strip dropped. */
  lite: boolean;
};

/**
 * The machine the camera flies through — a thin R3F wrapper around `three/laptop.ts`. The tier
 * and palette are fixed for the scene's lifetime (`IntroScene` keys the world by tier), so it is
 * built once and only `update`, `setLite` and `dispose` cross the boundary after that.
 */
export function IntroLaptop({ fx, tier, palette, lite }: IntroLaptopProps) {
  const [laptop] = useState(() => createIntroLaptop(tier, palette));

  useEffect(() => () => laptop.dispose(), [laptop]);
  useEffect(() => laptop.setLite(lite), [laptop, lite]);
  useFrame((_, dt) => laptop.update(dt, fx));

  return <primitive object={laptop.group} />;
}
