"use client";

/**
 * The R3F side of the interior scene — since 2026-10-28 only Work's DNA helix: creates the world
 * once, stages the helix (one idle slice to build it, then one compile slice per draw object),
 * reports ready once the compiled helix has drawn two frames, and drives the world every frame. It
 * hands the world Work's spiral driver (`workHelix.ts`), which lays the project cards out round
 * that helix. Everything imperative lives in `./three/*`, `./fx.ts` and `./workHelix.ts`; this
 * component only wires it to R3F and to the canvas's callbacks.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { createFpsGovernor, sampleFrame, type GovernorStep } from "@/components/three/governor";
import { useRetainedRenderer } from "@/components/three/hooks";
import {
  SCENE_LAYOUT_EVENT,
  SCENE_STAGE_ATTR,
  WORK_ID,
  WORK_TRACK_ATTR,
  type SceneHelix,
  type ScrollProbe,
} from "@/lib/scene";
import type { SceneFx } from "./fx";
import { armReady, createReadySignal, tickReady } from "./three/compile";
import type { ScenePalette } from "./three/palette";
import { createSceneWorld, stageHelix } from "./three/world";
import { sceneGovernorOptions, type SceneCanvasTier } from "./tiers";
import { createWorkHelixDriver } from "./workHelix";

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
  /** `built` once the helix compiled, then every mode the driver applies (`off` last). */
  onHelix(state: SceneHelix): void;
};

export function SceneWorld({ tier, force3d, palette, lite, skipDpr, probe, fx, onReady, onStep, onHelix }: SceneWorldProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  // Created once for the canvas's life (the tier never changes, a new palette is applied in
  // place) as an empty root: the helix is built into it in an idle slice below.
  const [world] = useState(() => createSceneWorld(tier, palette));
  const [ready] = useState(createReadySignal);
  const [governor] = useState(() => createFpsGovernor(sceneGovernorOptions(tier, force3d, skipDpr)));
  // A staging that threw is rethrown from render, so the stage's error boundary takes the scene
  // down to the flat card grid: the helix is the only thing this canvas could have shown.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  const callbacks = useRef({ onReady, onStep, onHelix });
  useEffect(() => {
    callbacks.current = { onReady, onStep, onHelix };
  }, [onReady, onStep, onHelix]);

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => world.setPalette(palette), [world, palette]);
  useEffect(() => world.setLite(lite), [world, lite]);
  useRetainedRenderer(gl);

  /*
   * The staged build IS the helix: built in an idle slice, compiled one draw object per slice and
   * queued for its pre-warm frame — and only then is ready armed, so `onReady` means "the helix
   * compiled and the canvas drew it twice". A page without Work's track (no projects to turn round
   * it) has nothing to build: ready is armed at once and the canvas draws an empty root, which
   * keeps the stage's pipeline (`data-renderer`) the same on every page.
   */
  useEffect(() => {
    let cancelled = false;
    const options = { cancelled: () => cancelled };
    // The same query as the driver effect below: no track, no driver, no helix to show.
    const hasTrack = document.querySelector(`[${WORK_TRACK_ATTR}]`) !== null;
    const staged = hasTrack ? stageHelix(world, gl, scene, camera, options) : Promise.resolve(true);
    staged.then(
      (built) => {
        if (!built || cancelled) return;
        armReady(ready);
        if (hasTrack) callbacks.current.onHelix("built");
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error("3D scene: the Work helix was not built", error);
        setFailure({ error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [world, ready, gl, scene, camera]);

  // Work's spiral driver, for the scene's whole life: the world calls it every frame and disposes
  // it — so every way the scene goes (a bail, a lost context, an error, reduced motion, leaving the
  // page) puts the cards back as React rendered them.
  useEffect(() => {
    const track = document.querySelector<HTMLElement>(`[${WORK_TRACK_ATTR}]`);
    const section = document.getElementById(WORK_ID);
    if (!track || !section) return;
    const stage = track.closest<HTMLElement>(`[${SCENE_STAGE_ATTR}]`);
    const driver = createWorkHelixDriver({
      track,
      section,
      probe,
      onMode: (mode) => {
        // The spiral changes the track's height (and so the stage's) at once, and the director's
        // refresh for it may wait for a scroll to end: it re-reads the boxes now (never under a cover).
        stage?.dispatchEvent(new Event(SCENE_LAYOUT_EVENT));
        callbacks.current.onHelix(mode);
      },
    });
    world.attachWork(driver, () => callbacks.current.onHelix("off"));
    return () => world.attachWork(null);
  }, [world, probe]);

  useFrame((state, dt) => {
    // Ready from inside the frame loop: the canvas really drew the compiled helix — never from
    // a timer that also ticks while the canvas is paused off screen.
    if (tickReady(ready)) callbacks.current.onReady();
    world.update(dt, window.scrollY, state, probe, fx);
    // The governor judges the scene once it is staged: the compile slices are not its frames.
    if (!ready.armed) return;
    const next = sampleFrame(governor, dt);
    if (next) callbacks.current.onStep(next);
  });

  if (failure) throw failure.error;
  return <primitive object={world.root} />;
}
