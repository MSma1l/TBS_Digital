"use client";

/**
 * The R3F side of the interior scene: creates the world once, installs the high tier's glass
 * environment, builds and then compiles it in idle slices, reports ready once the compiled
 * scene has drawn two frames, and drives the world every frame. Everything imperative lives in
 * `./three/*` and `./fx.ts`; this component only wires it to R3F and to the canvas's callbacks.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { createFpsGovernor, sampleFrame, type GovernorStep } from "@/components/three/governor";
import { useRetainedRenderer } from "@/components/three/hooks";
import { mediaMatches } from "@/lib/device";
import { readSceneInput, type ScrollProbe } from "@/lib/scene";
import { createChangeSignal, reportChange, type SceneFx } from "./fx";
import { armReady, buildStaged, compileStaged, createReadySignal, tickReady } from "./three/compile";
import type { ScenePalette } from "./three/palette";
import { createSceneWorld } from "./three/world";
import { sceneGovernorOptions, type SceneCanvasTier } from "./tiers";

export type SceneWorldProps = {
  tier: SceneCanvasTier;
  force3d: boolean;
  palette: ScenePalette;
  lite: boolean;
  /** The canvas is already at 1× (the governor skips the DPR step). */
  skipDpr: boolean;
  probe: ScrollProbe;
  fx: SceneFx;
  onReady(): void;
  onStep(step: GovernorStep): void;
  onMorph(running: boolean): void;
};

export function SceneWorld({
  tier,
  force3d,
  palette,
  lite,
  skipDpr,
  probe,
  fx,
  onReady,
  onStep,
  onMorph,
}: SceneWorldProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  // Created once for the canvas's life (the tier never changes, a new palette is applied in
  // place) as an empty root: its parts are built one idle slice at a time below.
  const [world] = useState(() => createSceneWorld(tier, palette));
  const [ready] = useState(createReadySignal);
  const [governor] = useState(() => createFpsGovernor(sceneGovernorOptions(tier, force3d, skipDpr)));
  const [morphSignal] = useState(() => createChangeSignal(false));
  const [coarse] = useState(() => mediaMatches("(pointer: coarse)"));

  const callbacks = useRef({ onReady, onStep, onMorph });
  useEffect(() => {
    callbacks.current = { onReady, onStep, onMorph };
  }, [onReady, onStep, onMorph]);

  useEffect(() => () => world.dispose(), [world]);
  // Before the compile below: the environment changes the physical glass's shader defines.
  useEffect(() => world.installEnvironment(gl, scene, palette), [world, gl, scene, palette]);
  useEffect(() => world.setPalette(palette), [world, palette]);
  useEffect(() => world.setLite(lite, gl), [world, gl, lite]);
  useRetainedRenderer(gl);

  // Build, then compile, one piece per idle slice; then count drawn frames (below).
  useEffect(() => {
    let cancelled = false;
    const options = { cancelled: () => cancelled };
    void buildStaged(world, options)
      .then((built) =>
        built
          ? compileStaged(gl, scene, camera, world.compileStages(), {
              ...options,
              compiled: (objects) => world.prewarm(objects),
            })
          : false,
      )
      .then((compiled) => {
        if (compiled && !cancelled) armReady(ready);
      });
    return () => {
      cancelled = true;
    };
  }, [world, ready, gl, scene, camera]);

  useFrame((state, dt) => {
    // Ready from inside the frame loop: the canvas really drew the compiled scene — never from
    // a timer that also ticks while the canvas is paused off screen.
    if (tickReady(ready)) callbacks.current.onReady();
    if (!world.complete()) return;
    world.update(dt, window.scrollY, state, coarse, probe, readSceneInput(), fx);
    const morph = reportChange(morphSignal, world.morphRunning());
    if (morph !== null) callbacks.current.onMorph(morph);
    const next = sampleFrame(governor, dt);
    if (next) callbacks.current.onStep(next);
  });

  return <primitive object={world.root} />;
}
