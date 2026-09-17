/**
 * The scene's motion and its self-tuning, as plain TypeScript.
 *
 * Every per-frame write lives here rather than in a component: the React Compiler lint
 * (`react-hooks/immutability`) flags assignments to objects a hook returned, and a helper
 * called from `useFrame` keeps the components free of them. Only `import type` from three,
 * so `fitRig` and the FPS governor are unit-tested without loading three.js.
 *
 * The FPS governor and the frame-step helpers are shared with the interior scene and live in
 * `components/three/`; they are re-exported here so the intro keeps one import path.
 */

import type { Camera, Object3D } from "three";
import { MAX_FRAME_STEP, clamp, lerp } from "@/components/three/motion";
import type { IntroFx } from "../fx";
import { LEMNISCATE } from "../lemniscate";

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

/** Camera before the burst. */
export const BASE_Z = 6;
export const BASE_FOV = 40;
/** Camera at the end of the dolly into the ∞. */
export const DOLLY_Z = 0.9;
export const DOLLY_FOV = 72;

/** Half the ∞'s width in scene units: the lobe tip, the glass tube and a little rim glow. */
export const RIG_HALF_WIDTH = LEMNISCATE.a + LEMNISCATE.tube + 0.08;

/** Share of the viewport width the ∞ spans, and how far it sits above the centre. */
export const RIG_FIT = {
  landscapeFill: 0.5,
  portraitFill: 0.86,
  /** Fractions of the base frustum's half height; lifts the ∞ clear of the HUD readout. */
  landscapeLift: 0.06,
  portraitLift: 0.14,
} as const;

/** Never let the oscillation and the parallax together turn the ∞ edge-on. */
export const MAX_YAW = (35 * Math.PI) / 180;

export type RigFit = {
  scale: number;
  offsetY: number;
  portrait: boolean;
};

/** Half the height of the base frustum at z = 0 (≈ 2.18 scene units). */
export function baseHalfHeight(): number {
  return BASE_Z * Math.tan((BASE_FOV * Math.PI) / 360);
}

/**
 * Scale for the ∞ group so it spans ≈50% of the width in landscape and ≈86% in portrait,
 * never above its modelled size. Computed from the BASE camera, not R3F's live viewport:
 * the camera dollies during the burst, and a fit that followed it would shrink the ∞ just
 * as the camera flies into it.
 */
export function fitRig(width: number, height: number): RigFit {
  const halfH = baseHalfHeight();
  const aspect = Math.max(1, width) / Math.max(1, height);
  const portrait = aspect < 1;
  const halfW = halfH * aspect;
  const fill = portrait ? RIG_FIT.portraitFill : RIG_FIT.landscapeFill;
  const scale = Math.min(1, (halfW * fill) / RIG_HALF_WIDTH);
  const offsetY = halfH * (portrait ? RIG_FIT.portraitLift : RIG_FIT.landscapeLift);
  return { scale, offsetY, portrait };
}

/** Fraction of the viewport width a fitted ∞ covers (at rest, facing the camera). */
export function fitWidthFraction(fit: RigFit, width: number, height: number): number {
  const halfW = baseHalfHeight() * (Math.max(1, width) / Math.max(1, height));
  return (RIG_HALF_WIDTH * fit.scale) / halfW;
}

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
 * One frame of motion: the ∞ sways within ±35° (never edge-on), floats and breathes, follows
 * a fine pointer when `parallax` is on, pulses and bursts with the fx; the camera dollies.
 */
export function updateRig(
  state: RigState,
  rig: Object3D,
  camera: Camera,
  pointer: PointerLike,
  fx: IntroFx,
  dt: number,
  parallax: boolean,
): void {
  const step = clamp(dt, 0, MAX_FRAME_STEP);
  state.time += step;
  const t = state.time;

  const k = 1 - Math.exp(-3 * step);
  state.pointerX += ((parallax ? pointer.x : 0) - state.pointerX) * k;
  state.pointerY += ((parallax ? pointer.y : 0) - state.pointerY) * k;

  const yaw = clamp(Math.sin(0.35 * t) * 0.55 + state.pointerX * 0.25, -MAX_YAW, MAX_YAW);
  rig.rotation.set(
    Math.sin(0.5 * t) * 0.18 - state.pointerY * 0.15,
    yaw + fx.spin * Math.PI,
    Math.sin(0.21 * t) * 0.08,
  );
  rig.position.y = Math.sin(0.8 * t) * 0.06;
  rig.scale.setScalar(
    1 + Math.sin(2.1 * t) * 0.012 + fx.pulse * 0.045 - fx.charge * 0.1 + fx.burst * 0.5,
  );

  const z = lerp(BASE_Z, DOLLY_Z, fx.dolly);
  if (camera.position.z !== z) camera.position.z = z;
  if (isPerspective(camera)) {
    const fov = lerp(BASE_FOV, DOLLY_FOV, fx.dolly);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
}
