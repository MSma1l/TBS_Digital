"use client";

/**
 * The interior WebGL scene (three.js + R3F): the hero's microprocessor, the five service
 * models and the swarm that bursts them in and morphs between them, and Work's DNA helix (with
 * the driver that turns the project cards round it), drawn on the stage's one sticky canvas.
 *
 * Reached only through `next/dynamic` from the stage, via the shared 3D runtime module
 * (components/three/runtime.tsx, the intro's import target too), so three.js and R3F never
 * reach a visitor without a capable GPU. The canvas never takes a pointer event
 * (`pointer-events: none`, R3F events unused): tilt comes from passive window listeners
 * (./input.ts).
 *
 * Failure paths all end in the stage's static art: a refused or lost context (`onLost`), the
 * FPS governor giving up (`onBail`, never when forced), or a throw — an unreadable colour
 * token on mount, a shader that fails — that the stage's error boundary catches.
 */

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GovernorStep } from "@/components/three/governor";
import { useRendererFactory } from "@/components/three/hooks";
import type { SceneCanvasProps, SceneEntry, SceneHelix } from "@/lib/scene";
import { SCENE_CAMERA } from "./choreography";
import { createSceneFx } from "./fx";
import { attachTiltInput } from "./input";
import { watchPixelRatio } from "./pixelRatio";
import { SceneWorld } from "./SceneWorld";
import { observeThemeChange, readScenePalette, samePalette, tryReadScenePalette } from "./three/palette";
import { SCENE_TIER_CONFIG, clampSceneDpr, dprForStep } from "./tiers";

const CAMERA = {
  position: [0, 0, SCENE_CAMERA.z] as [number, number, number],
  fov: SCENE_CAMERA.fov,
  near: SCENE_CAMERA.near,
  far: SCENE_CAMERA.far,
};

/** The layer is sticky and `lvh` tall: scrolling never resizes it; a real resize settles first. */
const RESIZE = { scroll: false, debounce: { scroll: 0, resize: 200 } } as const;

/** R3F writes `pointer-events: auto` inline; the page under the canvas must stay clickable. */
const CANVAS_STYLE = { pointerEvents: "none" } as const;

/** The canvas's DPR range for this window and screen, before the governor's steps. */
const readBaseDpr = (tier: SceneCanvasProps["tier"]) =>
  clampSceneDpr(tier, window.innerWidth, window.innerHeight, window.devicePixelRatio);

export function SceneCanvas({
  tier,
  force3d,
  paused,
  probe,
  onReady,
  onLost,
  onBail,
  onQuality,
  onMorph,
  onEntry,
  onHelix,
}: SceneCanvasProps) {
  // Read before any context exists: an unparsable token throws straight to the stage's boundary.
  const [palette, setPalette] = useState(readScenePalette);
  const [baseDpr, setBaseDpr] = useState(() => readBaseDpr(tier));
  // The pixel budget follows the window and the screen (./pixelRatio.ts); R3F applies a new `dpr`.
  useEffect(
    () =>
      watchPixelRatio(() => {
        const next = readBaseDpr(tier);
        setBaseDpr((current) => (current[0] === next[0] && current[1] === next[1] ? current : next));
      }, RESIZE.debounce.resize),
    [tier],
  );
  const [step, setStep] = useState<GovernorStep>("full");
  const [fx] = useState(createSceneFx);

  const callbacks = useRef({ onReady, onLost, onBail, onQuality, onMorph, onEntry, onHelix });
  useEffect(() => {
    callbacks.current = { onReady, onLost, onBail, onQuality, onMorph, onEntry, onHelix };
  }, [onReady, onLost, onBail, onQuality, onMorph, onEntry, onHelix]);

  const handleLost = useCallback(() => callbacks.current.onLost(), []);
  const handleReady = useCallback(() => callbacks.current.onReady(), []);
  const handleMorph = useCallback((running: boolean) => callbacks.current.onMorph(running), []);
  const handleEntry = useCallback((state: SceneEntry) => callbacks.current.onEntry(state), []);
  const handleHelix = useCallback((state: SceneHelix) => callbacks.current.onHelix(state), []);
  const handleStep = useCallback((next: GovernorStep) => {
    if (next === "bail") {
      callbacks.current.onBail();
      return;
    }
    setStep(next);
    callbacks.current.onQuality(next);
  }, []);

  const renderer = useRendererFactory({
    antialias: SCENE_TIER_CONFIG[tier].antialias,
    force3d,
    powerPreference: "low-power",
    onLost: handleLost,
  });

  useEffect(() => attachTiltInput(fx), [fx]);

  // A theme change re-reads the tokens; one that can't be read keeps the palette we have.
  useEffect(
    () =>
      observeThemeChange(() => {
        const next = tryReadScenePalette();
        if (next) setPalette((current) => (samePalette(current, next) ? current : next));
      }),
    [],
  );

  return (
    <Canvas
      flat
      dpr={dprForStep(baseDpr, step)}
      frameloop={paused ? "never" : "always"}
      resize={RESIZE}
      gl={renderer.gl}
      onCreated={renderer.onCreated}
      camera={CAMERA}
      style={CANVAS_STYLE}
    >
      <SceneWorld
        tier={tier}
        force3d={force3d}
        palette={palette}
        lite={step === "lite"}
        skipDpr={baseDpr[1] <= 1}
        probe={probe}
        fx={fx}
        onReady={handleReady}
        onStep={handleStep}
        onMorph={handleMorph}
        onEntry={handleEntry}
        onHelix={handleHelix}
      />
    </Canvas>
  );
}
