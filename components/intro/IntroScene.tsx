"use client";

/**
 * The WebGL intro: a glass ∞ with orbiting light particles, driven by the director's `fx`.
 *
 * Reached only through `next/dynamic` — IntroDirector, via the shared 3D runtime module
 * (components/three/runtime.tsx), which the interior stage loads too — so three.js and R3F
 * reach only a first visit whose probe said WebGL, or a stage that decided on WebGL.
 * Everything imperative lives in `./three/*`; the components here only create those objects,
 * call them from `useFrame` and dispose them.
 *
 * Failure paths all end in `onLost` (or a throw the director's error boundary catches), and
 * the director keeps the SVG fallback: no WebGL2 context, a context lost mid-intro, or a
 * palette token three.js can't parse.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { useRendererFactory, useRetainedRenderer, useSceneReady } from "@/components/three/hooks";
import { setRendererLite } from "@/components/three/renderer";
import { clampDpr } from "./capability";
import type { IntroFx, IntroSceneProps } from "./fx";
import { InfinityCore } from "./InfinityCore";
import { OrbitParticles } from "./OrbitParticles";
import { installNeonEnvironment } from "./three/environment";
import { readIntroPalette, type IntroPalette } from "./three/materials";
import {
  BASE_FOV,
  BASE_Z,
  createFpsGovernor,
  createRigState,
  fitRig,
  sampleFrame,
  updateRig,
  type GovernorStep,
} from "./three/rig";
import { TIER_CONFIG } from "./tiers";

const CAMERA = {
  position: [0, 0, BASE_Z] as [number, number, number],
  fov: BASE_FOV,
  near: 0.1,
  far: 40,
};

/** The overlay is fixed and never scrolls: no scroll listeners for the measurement. */
const RESIZE = { scroll: false } as const;

/** Governor thresholds: phones get a little more slack before losing detail. */
const MIN_FPS = { high: 45, mid: 40, low: 40 } as const;

export function IntroScene({
  fx,
  tier,
  parallax,
  force3d,
  paused,
  onReady,
  onLost,
}: IntroSceneProps) {
  // Read before any context exists: a bad token throws straight to the director's boundary.
  const [palette] = useState(readIntroPalette);
  const [baseDpr] = useState(() =>
    clampDpr(tier, window.innerWidth, window.innerHeight, window.devicePixelRatio),
  );
  const [step, setStep] = useState<GovernorStep>("full");
  const antialias = TIER_CONFIG[tier].antialias;

  // A refused context or a context lost while mounted → `onLost` (once); the director
  // unmounts the scene and keeps the SVG. Once unmounted, a loss is R3F's own teardown.
  const renderer = useRendererFactory({ antialias, force3d, onLost });

  // The governor's first step caps the ratio at 1×. It lives in React state, not in a
  // `setDpr` call, because R3F re-applies the `dpr` prop whenever the Canvas re-renders.
  const dpr: [number, number] =
    step === "full" ? baseDpr : [Math.min(baseDpr[0], 1), Math.min(baseDpr[1], 1)];

  return (
    <Canvas
      flat
      dpr={dpr}
      frameloop={paused ? "never" : "always"}
      resize={RESIZE}
      gl={renderer.gl}
      camera={CAMERA}
      onCreated={renderer.onCreated}
      // R3F spreads `style` after its own `pointer-events: auto`, and an explicit value beats
      // the overlay's inherited `none` — so the canvas only listens while it is drawing. The
      // module CSS also switches every overlay descendant off at reveal, before this pauses.
      style={{ pointerEvents: parallax && !paused ? "auto" : "none" }}
    >
      <IntroWorld
        key={tier}
        fx={fx}
        tier={tier}
        parallax={parallax}
        palette={palette}
        lite={step === "lite"}
        skipDpr={baseDpr[1] <= 1}
        onReady={onReady}
        onStep={setStep}
      />
    </Canvas>
  );
}

type IntroWorldProps = {
  fx: IntroFx;
  tier: IntroSceneProps["tier"];
  parallax: boolean;
  palette: IntroPalette;
  lite: boolean;
  skipDpr: boolean;
  onReady: () => void;
  onStep: (step: GovernorStep) => void;
};

function IntroWorld({
  fx,
  tier,
  parallax,
  palette,
  lite,
  skipDpr,
  onReady,
  onStep,
}: IntroWorldProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  const fit = useMemo(() => fitRig(width, height), [width, height]);
  const rig = useRef<Group>(null);
  const [motion] = useState(createRigState);
  const [governor] = useState(() => createFpsGovernor({ minFps: MIN_FPS[tier], skipDpr }));
  const physical = TIER_CONFIG[tier].glass === "physical";

  // Effects run in order, after the children's: the core and particles are in the scene, the
  // environment exists (it changes the glass's shader defines), and only then do we compile.
  useEffect(
    () => (physical ? installNeonEnvironment(gl, scene, palette) : undefined),
    [physical, gl, scene, palette],
  );
  useSceneReady(gl, scene, camera, onReady);
  useRetainedRenderer(gl);
  useEffect(() => setRendererLite(gl, lite), [gl, lite]);

  useFrame((state, dt) => {
    if (rig.current) {
      updateRig(motion, rig.current, state.camera, state.pointer, fx, dt, parallax);
    }
    const next = sampleFrame(governor, dt);
    if (next) onStep(next);
  });

  return (
    <group scale={fit.scale} position={[0, fit.offsetY, 0]}>
      <group ref={rig}>
        <InfinityCore fx={fx} tier={tier} palette={palette} lite={lite} />
        <OrbitParticles fx={fx} tier={tier} palette={palette} lite={lite} />
      </group>
    </group>
  );
}
