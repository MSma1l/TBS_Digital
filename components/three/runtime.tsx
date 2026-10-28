"use client";

/**
 * The ONE async entry for three.js + React Three Fiber — the WebGL scene is reached only
 * through a dynamic `import()` of this module: the interior stage (`SceneStage` renders
 * `SceneCanvas` from it).
 *
 * Why one module: Turbopack builds a chunk group per `import()` target and does not share a
 * vendor chunk between groups, so two targets that each import three.js would ship two
 * byte-for-byte copies of three + R3F (≈239 KB gzip each). One target means one chunk set.
 *
 * Never import this statically: that would put three.js in the page bundle
 * (eslint.config.mjs bans the static heavy imports; scene-contract.test.ts checks it).
 */

export { SceneCanvas } from "@/components/scene/SceneCanvas";
