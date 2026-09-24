/**
 * The intro camera's per-frame write, and the scene's self-tuning.
 *
 * Every per-frame write lives here rather than in a component: the React Compiler lint
 * (`react-hooks/immutability`) flags assignments to objects a hook returned, and a helper
 * called from `useFrame` keeps the components free of them. Only `import type` from three, so
 * the sway ramp and the FPS governor are unit-tested without loading three.js.
 *
 * The object is no longer fitted to the viewport — there is no fit group and nothing scales.
 * The camera flies instead, and everything about where it is comes from ONE scalar, `fx.flight`,
 * through `cameraAt` (`./cameraPath.ts`). This file spends that pose; it does not shape it.
 *
 * The FPS governor and the frame-step helpers are shared with the interior scene and live in
 * `components/three/`; they are re-exported here so the intro keeps one import path.
 */

import type { Camera } from "three";
import { MAX_FRAME_STEP, clamp, lerp } from "@/components/three/motion";
import type { IntroFx } from "../fx";
import { cameraAt } from "./cameraPath";

export { MAX_FRAME_STEP } from "@/components/three/motion";
export {
  CAP_MIN_FPS,
  CAP_SLACK,
  CAP_STEADINESS,
  DEFAULT_GOVERNOR,
  GOVERNOR_MAX_DELTA,
  createFpsGovernor,
  sampleFrame,
  steadyCadence,
  type FpsGovernor,
  type FpsGovernorOptions,
  type GovernorStep,
} from "@/components/three/governor";

/* ---- the handheld weight ---------------------------------------------------------------- */

/**
 * The sway window, in flight units — and it is a window, not a ramp, because it is switched off
 * at BOTH ends for reasons that are not decoration.
 *
 *  · **Below 0.60 the camera is inside the machine.** Its walls are a centimetre from the lens
 *    and they ARE the frame; a two-degree pan there swings the whole picture, and the object
 *    appears to swing around the lens. That is not a handheld shot, it is unfilmable. Beats 1–2
 *    are a held frame by design (`cameraPath.ts`, K0→K1 moves 0.04 units in total), and K2→K3 is
 *    a crawl down a corridor whose walls are the guts.
 *
 *    **It was 0.35, and 0.35 was measured against a shot list that left the chassis at u ≈ 0.45.**
 *    K3 pushed the exit back to u ≈ 0.60 (0.595 at the widen cap, 0.606 at 16:10), so the old
 *    window opened the sway a quarter of a flight before the camera was out of the hole — a pan
 *    with the vent's lintel a centimetre off the lens. The gate is the EXIT, not a round number:
 *    move K3 or K4 and move this with them.
 *  · **Above 0.86 the camera is closing on the display**, which K5 places at exactly the
 *    `coverDistance` — the distance at which the screen fills the viewport edge to edge with
 *    ZERO margin. Any residual pan there opens a sliver of background along one edge on the
 *    last frame of the intro. So the sway is gone again before the dive lands.
 *
 * In between — K4 (0.70) and K5 (0.84), the machine seen whole from outside — it runs at full
 * weight: a slow two-degree drift on two incommensurable periods, which reads as a camera held
 * by someone rather than as an orbit.
 *
 * The rise is 0.10 of a flight and cannot be much shorter: the weight is smoothstepped, so its
 * steepest slope is 1.5/span, and the test that forbids the sway from turning a corner samples
 * every 1/400 and allows 0.04 of change per sample. A 0.06 rise would fail it at 0.0625.
 */
export const SWAY = {
  in: [0.6, 0.7] as const,
  out: [0.86, 0.98] as const,
  /** Peak pan and tilt from the drift alone, radians (≈2.3° and ≈1.5°). */
  yaw: 0.04,
  pitch: 0.026,
  /** Peak pan and tilt the pointer may add on top, radians. */
  pointerYaw: 0.05,
  pointerPitch: 0.035,
} as const;

/** Pure. How much of the sway and the pointer parallax `u` is worth, 0 → 1 → 0. */
export function swayWeight(u: number): number {
  if (!(u > SWAY.in[0])) return 0;
  const rise = u >= SWAY.in[1] ? 1 : (u - SWAY.in[0]) / (SWAY.in[1] - SWAY.in[0]);
  const fall =
    u <= SWAY.out[0] ? 1 : u >= SWAY.out[1] ? 0 : 1 - (u - SWAY.out[0]) / (SWAY.out[1] - SWAY.out[0]);
  const t = rise < fall ? rise : fall;
  // Smoothstep at both ends, so the weight itself never turns a corner.
  return t * t * (3 - 2 * t);
}

/* ---- the state -------------------------------------------------------------------------- */

export type RigState = {
  /** Scene time in seconds, accumulated from clamped deltas (R3F resets its clock on pause). */
  time: number;
  /** Damped pointer, -1..1. */
  pointerX: number;
  pointerY: number;
};

export function createRigState(): RigState {
  return { time: 0, pointerX: 0, pointerY: 0 };
}

type PointerLike = { x: number; y: number };
type ProjectionCamera = Camera & { fov: number; updateProjectionMatrix(): void };

function isPerspective(camera: Camera): camera is ProjectionCamera {
  return (camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera === true;
}

/**
 * One frame of camera. Position, aim, roll and field of view are read straight out of the shot
 * list at `fx.flight`; the only thing added here is the handheld weight, and only where the shot
 * can carry it.
 *
 * The roll is spent as the camera's UP vector rather than as a rotation after the fact, because
 * `lookAt` resolves the camera's orientation from the aim and `up` together — tilting `up` first
 * is the one way to roll a camera that is also being aimed. The sway then pans and tilts about
 * the camera's own axes, which is a pan and a tilt; adding it to the TARGET would swing the
 * camera around the object instead, which is the thing the verdict says not to do.
 *
 * `near` and `far` are NOT written here. R3F re-applies the `camera` prop object on every
 * `<Canvas>` re-render — which happens on `paused` and on a `dpr` step — so anything this
 * function does not write every frame is reset to `IntroScene`'s constant. That is deliberate
 * for the clip planes and would be a bug for anything else.
 */
export function updateRig(
  state: RigState,
  camera: Camera,
  pointer: PointerLike,
  fx: IntroFx,
  dt: number,
  parallax: boolean,
  aspect: number,
): void {
  const step = clamp(dt, 0, MAX_FRAME_STEP);
  state.time += step;
  const t = state.time;

  const k = 1 - Math.exp(-3 * step);
  state.pointerX = lerp(state.pointerX, parallax ? pointer.x : 0, k);
  state.pointerY = lerp(state.pointerY, parallax ? pointer.y : 0, k);

  const pose = cameraAt(fx.flight, aspect);
  camera.position.set(pose.px, pose.py, pose.pz);
  camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
  camera.lookAt(pose.tx, pose.ty, pose.tz);

  const weight = swayWeight(fx.flight);
  if (weight > 0) {
    // Two periods that do not divide into one another: the drift never repeats a figure.
    const yaw = Math.sin(0.37 * t) * SWAY.yaw + state.pointerX * SWAY.pointerYaw;
    const pitch = Math.sin(0.53 * t + 1.1) * SWAY.pitch - state.pointerY * SWAY.pointerPitch;
    camera.rotateY(yaw * weight);
    camera.rotateX(pitch * weight);
  }

  if (isPerspective(camera) && camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}
