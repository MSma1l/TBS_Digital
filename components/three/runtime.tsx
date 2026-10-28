"use client";

/**
 * The ONE async entry for three.js + React Three Fiber: the Work section's stage
 * (`SceneStage`) renders `SceneCanvas` from it through a dynamic `import()`, and only once
 * Work approaches the viewport.
 *
 * Never import this statically: that would put three.js in the page bundle
 * (eslint.config.mjs bans the static heavy imports; scene-contract.test.ts checks it).
 */

export { SceneCanvas } from "@/components/scene/SceneCanvas";
