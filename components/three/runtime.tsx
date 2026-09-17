"use client";

/**
 * The ONE async entry for three.js + React Three Fiber — both WebGL scenes are reached only
 * through a dynamic `import()` of this module:
 *  · the first-visit intro (`IntroPreloader` warms it once the probe says WebGL,
 *    `IntroDirector` renders `IntroScene` from it);
 *  · the interior stage (`SceneStage` renders `SceneCanvas` from it).
 *
 * Why one module: Turbopack builds a chunk group per `import()` target and does not share a
 * vendor chunk between groups, so two targets that each import three.js shipped two
 * byte-for-byte copies of three + R3F (≈239 KB gzip each). A first visitor with a capable GPU
 * downloaded both — the intro's, then the stage's a few seconds later. One target means one
 * chunk set, fetched once and served from cache to the other caller. The price is that each
 * caller also receives the other scene's own code, which is small next to the runtime
 * (measured in the Stage C weight run; see CHANGELOG.md).
 *
 * Never import this statically: that would put three.js in the page bundle
 * (eslint.config.mjs bans the static heavy imports; scene-contract.test.ts checks it).
 */

export { IntroScene } from "@/components/intro/IntroScene";
export { SceneCanvas } from "@/components/scene/SceneCanvas";
