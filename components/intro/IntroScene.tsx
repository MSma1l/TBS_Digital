"use client";

/**
 * The WebGL intro: the camera's flight through the machine, driven by the director's `fx`.
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
import { useEffect, useState } from "react";
import type { Camera, Scene, WebGLRenderer } from "three";
import { useRendererFactory, useRetainedRenderer, useSceneReady } from "@/components/three/hooks";
import { setRendererLite } from "@/components/three/renderer";
import { clampDpr } from "./capability";
import type { IntroFx, IntroSceneProps } from "./fx";
import { IntroLaptop } from "./IntroLaptop";
import { OrbitParticles } from "./OrbitParticles";
import { cameraAt } from "./three/cameraPath";
import { installNeonEnvironment } from "./three/environment";
import { readIntroPalette, type IntroPalette } from "./three/materials";
import {
  createFpsGovernor,
  createRigState,
  sampleFrame,
  updateRig,
  type GovernorStep,
} from "./three/rig";
import { TIER_CONFIG } from "./tiers";

/**
 * The first frame of the flight, and the clip planes that hold all six of them.
 *
 * `near` is 0.01 because beats 1-3 are flown INSIDE the chassis: the cavity is 0.066 either side
 * of its centre line, so a 0.1 near plane would slice the ceiling open on every frame of them.
 * `far` is 14 because the furthest the camera ever reaches — K4 backed off to the widen cap on
 * the narrowest viewport — is under 10. The ratio is 1400:1, which a 24-bit depth buffer carries
 * comfortably; the 4000:1 of the old pair would not have, this close in.
 *
 * `position` and `fov` are the shot list's own K0, so the very first painted frame is already on
 * the flight rather than at an origin the rig then jumps away from. R3F re-applies this object on
 * every `<Canvas>` re-render (`paused`, a governor `dpr` step); `updateRig` runs in `useFrame`
 * afterwards and wins for position and fov, and `near`/`far` are constants by design.
 */
const START = cameraAt(0, 1);
const CAMERA = {
  position: [START.px, START.py, START.pz] as [number, number, number],
  fov: START.fov,
  near: 0.01,
  far: 14,
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

  // The glass's environment links its programs in parallel while the film plays (IntroWorld), and
  // R3F draws nothing until the scene's own compile has been issued after it. The canvas is not
  // shown before sceneReady anyway; a frame drawn earlier would link the glass without its
  // environment (a program it never draws with again) and every other program one after another
  // on the main thread, which the compile links in parallel. So the first frame still comes after
  // the compile has started, as it did when the environment was built inside the effect.
  const [compiling, setCompiling] = useState(false);
  const waiting = TIER_CONFIG[tier].glass === "physical" && !compiling;

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
      frameloop={paused || waiting ? "never" : "always"}
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
        onCompiling={setCompiling}
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
  /** The scene's compile has been issued (true), or its issuer unmounted (false). */
  onCompiling: (started: boolean) => void;
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
  onCompiling,
}: IntroWorldProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const [motion] = useState(createRigState);
  const [governor] = useState(() => createFpsGovernor({ minFps: MIN_FPS[tier], skipDpr }));
  const physical = TIER_CONFIG[tier].glass === "physical";
  // Nothing compiles before the environment exists — it changes the glass's shader defines — and
  // without the glass there is no environment to wait for.
  const [lit, setLit] = useState(!physical);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);

  // The environment, built without freezing the film. Its pre-filter used to link four programs
  // one after another inside this effect, the main thread waiting on each — 597ms measured, the
  // counter and the drawing stopped dead in beat 1 or 2. Now they link in parallel first
  // (`createStripEnvironment`) and the same `fromScene` runs once they have. The undo is kept
  // for unmount; an unmount while they link disposes everything and installs nothing.
  useEffect(() => {
    if (!physical) return;
    let cancelled = false;
    let undo: (() => void) | null = null;
    void installNeonEnvironment(gl, scene, palette, () => cancelled).then(
      (installed) => {
        if (!installed) return;
        if (cancelled) {
          installed();
          return;
        }
        undo = installed;
        setLit(true);
      },
      // A throw here used to reach the director's error boundary straight from the effect; it
      // still does, from the render below.
      (error: unknown) => {
        if (!cancelled) setFailure({ error });
      },
    );
    return () => {
      cancelled = true;
      undo?.();
    };
  }, [physical, gl, scene, palette]);
  useRetainedRenderer(gl);
  useEffect(() => setRendererLite(gl, lite), [gl, lite]);

  useFrame((state, dt) => {
    // The aspect is the drawing buffer's, read every frame: `cameraAt` widens the outside keys
    // on a narrow viewport and derives the final cover distance from it.
    const aspect = state.size.height > 0 ? state.size.width / state.size.height : 1;
    updateRig(motion, state.camera, state.pointer, fx, dt, parallax, aspect);
    const next = sampleFrame(governor, dt);
    if (next) onStep(next);
  });

  if (failure) throw failure.error;

  /* No fit group and no rig group: the machine sits at the origin at its modelled size and the
     camera does the travelling. `createParticleMaterial` reads `length(modelViewMatrix[0].xyz)`
     as its `modelScale`, which is why it is calibrated for 1 (see `uSize` in `materials.ts`). */
  return (
    <>
      <IntroLaptop fx={fx} tier={tier} palette={palette} lite={lite} />
      <OrbitParticles fx={fx} tier={tier} palette={palette} lite={lite} />
      {lit && (
        <SceneReady
          gl={gl}
          scene={scene}
          camera={camera}
          onReady={onReady}
          onCompiling={onCompiling}
        />
      )}
    </>
  );
}

/**
 * `useSceneReady` — compile, two frames, `onReady` — once the scene is complete and lit. The last
 * child, so its effects run after the laptop's and the particles' (their objects are in the
 * scene); mounted only once the environment is installed, so the glass compiles with its CUBEUV
 * defines — the very program it draws with — and sceneReady still waits for that compile. Then
 * `onCompiling`: R3F's frames start (see `waiting` in IntroScene).
 */
function SceneReady({
  gl,
  scene,
  camera,
  onReady,
  onCompiling,
}: {
  gl: WebGLRenderer;
  scene: Scene;
  camera: Camera;
  onReady: () => void;
  onCompiling: (started: boolean) => void;
}) {
  useSceneReady(gl, scene, camera, onReady);
  // After the hook's own effect, which has issued the compile by now.
  useEffect(() => {
    onCompiling(true);
    return () => onCompiling(false);
  }, [onCompiling]);
  return null;
}
