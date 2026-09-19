"use client";

/**
 * The R3F side of the interior scene: creates the world once, builds and then compiles it in
 * idle slices, reports ready once the compiled scene has drawn two frames, and drives the world
 * every frame. After ready it builds Work's helix the same way (one slice, then one compile slice
 * per draw object) and hands the world Work's spiral driver (`workHelix.ts`), which lays the
 * project cards out round that helix. Everything imperative lives in `./three/*`, `./fx.ts` and
 * `./workHelix.ts`; this component only wires it to R3F and to the canvas's callbacks.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { createFpsGovernor, sampleFrame, type GovernorStep } from "@/components/three/governor";
import { useRetainedRenderer } from "@/components/three/hooks";
import { mediaMatches } from "@/lib/device";
import {
  PROJECTS_TRACK_ATTR,
  SCENE_LAYOUT_EVENT,
  SCENE_STAGE_ATTR,
  WORK_ID,
  WORK_TRACK_ATTR,
  readSceneInput,
  type SceneEntry,
  type SceneHelix,
  type ScrollProbe,
} from "@/lib/scene";
import { createChangeSignal, entryState, reportChange, type SceneFx } from "./fx";
import { armReady, buildStaged, compileStaged, createReadySignal, tickReady } from "./three/compile";
import type { ScenePalette } from "./three/palette";
import { createSceneWorld, stageHelix } from "./three/world";
import { sceneGovernorOptions, type SceneCanvasTier } from "./tiers";
import { createProjectsReel } from "./projectsReel";
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
  onMorph(running: boolean): void;
  /** Only on a change, from the first frame after ready (the first report is the current state). */
  onEntry(state: SceneEntry): void;
  /** `built` once the helix compiled, then every mode the driver applies (`off` last). */
  onHelix(state: SceneHelix): void;
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
  onEntry,
  onHelix,
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
  // Null: nothing reported yet, so the first frame after ready always says where the entrance is.
  const [entrySignal] = useState(() => createChangeSignal<SceneEntry | null>(null));
  const [coarse] = useState(() => mediaMatches("(pointer: coarse)"));

  const callbacks = useRef({ onReady, onStep, onMorph, onEntry, onHelix });
  useEffect(() => {
    callbacks.current = { onReady, onStep, onMorph, onEntry, onHelix };
  }, [onReady, onStep, onMorph, onEntry, onHelix]);

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => world.setPalette(palette), [world, palette]);
  useEffect(() => world.setLite(lite), [world, lite]);
  useRetainedRenderer(gl);

  // Build, then compile, one piece per idle slice; then count drawn frames (below). Once the
  // scene is ready to draw, the helix — never before, so it never delays the first picture.
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
        if (!compiled || cancelled) return false;
        armReady(ready);
        return stageHelix(world, gl, scene, camera, options);
      })
      .then(
        (helixBuilt) => {
          if (helixBuilt && !cancelled) callbacks.current.onHelix("built");
        },
        (error: unknown) => {
          // The helix (or a part after ready) failed to build: the cards stay as they are.
          if (!cancelled) console.error("3D scene: the Work helix was not built", error);
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

  // A service page's projects reel, for the scene's whole life: it turns the number the page
  // wrote on the grid into the card the display is composed from, and the world disposes it. It
  // never lays a card out differently — the grid stays exactly what React rendered, which is what
  // keeps it the fallback wherever the machine is not there.
  useEffect(() => {
    const grid = document.querySelector<HTMLElement>(`[${PROJECTS_TRACK_ATTR}]`);
    if (!grid) return;
    world.attachProjects(createProjectsReel({ grid }));
    return () => world.attachProjects(null);
  }, [world]);

  useFrame((state, dt) => {
    // Ready from inside the frame loop: the canvas really drew the compiled scene — never from
    // a timer that also ticks while the canvas is paused off screen.
    if (tickReady(ready)) callbacks.current.onReady();
    if (!world.complete()) return;
    world.update(dt, window.scrollY, state, coarse, probe, readSceneInput(), fx);
    const morph = reportChange(morphSignal, world.morphRunning());
    if (morph !== null) callbacks.current.onMorph(morph);
    // The entrance as drawn — only once the scene is ready, so no glow keys off an invisible canvas.
    if (ready.fired) {
      const entry = reportChange(entrySignal, entryState(fx.entry.value));
      if (entry !== null) callbacks.current.onEntry(entry);
    }
    const next = sampleFrame(governor, dt);
    if (next) callbacks.current.onStep(next);
  });

  return <primitive object={world.root} />;
}
