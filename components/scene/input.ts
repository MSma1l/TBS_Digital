/**
 * Pointer and gyroscope tilt for the interior scene. The canvas never listens itself (it is
 * `pointer-events: none`, R3F events are unused): passive listeners on `window` write -1..1
 * targets into the scene's fx, and the world eases towards them.
 *
 *  · fine pointer — `pointermove` anywhere on the page;
 *  · touch-first  — `deviceorientation`, but only where it works without asking: iOS Safari
 *    gates it behind `DeviceOrientationEvent.requestPermission()`, which needs a gesture and
 *    shows a prompt. The site never asks — iOS keeps the idle sway.
 *
 * `fx.tiltLive` turns on only after a real sample, so a desktop mouse that never moves and a
 * phone without a gyroscope both keep swaying.
 */

import type { SceneFx } from "./fx";

type TiltTarget = Pick<SceneFx, "tiltX" | "tiltY" | "tiltLive">;

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

/** Degrees of tilt that reach the edge of the -1..1 range. */
export const GYRO_RANGE_DEG = 25;

/** `screen.orientation.angle` as 0, 90, 180 or 270. */
export function screenAngle(angle: number): 0 | 90 | 180 | 270 {
  const a = (((Math.round(Number.isFinite(angle) ? angle / 90 : 0) * 90) % 360) + 360) % 360;
  return a as 0 | 90 | 180 | 270;
}

/**
 * Pure. The screen-space roll and pitch of a device held with its screen rotated by `angle`
 * degrees — `screen.orientation.angle`, counter-clockwise from the natural orientation (W3C
 * Screen Orientation; Android's ROTATION_90 is the device turned 90° counter-clockwise, top to
 * the left). In the device's frame `beta` turns about its x axis (top edge up: +) and `gamma`
 * about its y axis (right edge down: +), so:
 *  · 0   — roll = gamma,  pitch = beta
 *  · 90  — roll = beta,   pitch = -gamma  (the screen's top is the device's right edge)
 *  · 180 — roll = -gamma, pitch = -beta
 *  · 270 — roll = -beta,  pitch = gamma
 * `roll` is "the screen's right edge down", `pitch` "the screen's top edge up". Null when the
 * device reports no angles.
 */
export function screenTilt(
  beta: number | null,
  gamma: number | null,
  angle: number,
): { roll: number; pitch: number } | null {
  if (beta == null || gamma == null || !Number.isFinite(beta) || !Number.isFinite(gamma)) return null;
  switch (screenAngle(angle)) {
    case 90:
      return { roll: beta + 0, pitch: -gamma + 0 };
    case 180:
      return { roll: -gamma + 0, pitch: -beta + 0 };
    case 270:
      return { roll: -beta + 0, pitch: gamma + 0 };
    default:
      return { roll: gamma + 0, pitch: beta + 0 };
  }
}

/**
 * Pure. Device orientation → a -1..1 tilt in screen space for a screen rotated by `angle`
 * (see `screenTilt`). `base.pitch` is the resting pitch on THAT screen axis — how the device
 * was held when the first sample for this rotation arrived — so a landscape grip, whose pitch
 * lives in `gamma`, rests at 0 like a portrait one. Null when the device reports no angles.
 */
export function orientationToTilt(
  beta: number | null,
  gamma: number | null,
  angle: number,
  base: { pitch: number },
): { x: number; y: number } | null {
  const tilt = screenTilt(beta, gamma, angle);
  if (!tilt) return null;
  const c = (v: number) => clampUnit(v / GYRO_RANGE_DEG) + 0;
  return { x: c(tilt.roll), y: c(tilt.pitch - base.pitch) };
}

/** The resting pitch is taken from the first sample (per screen rotation), within a comfortable range. */
export const GYRO_BASE_RANGE: readonly [number, number] = [20, 70];
/** The resting pitch follows a slowly changing grip at this rate (per second). */
export const GYRO_BASE_FOLLOW = 0.02;

/** iOS Safari 13+ adds a static `requestPermission` to the constructor. */
type OrientationCtor = { requestPermission?: unknown };

/** The host the listeners attach to; `window` in the browser, a stub in tests. */
export type TiltHost = Pick<Window, "addEventListener" | "removeEventListener" | "matchMedia"> & {
  innerWidth: number;
  innerHeight: number;
  screen?: { orientation?: { angle?: number } };
  DeviceOrientationEvent?: unknown;
};

/**
 * Attach the tilt listeners for this device and return their cleanup. Never calls
 * `requestPermission`, and attaches no orientation listener where that function exists.
 */
export function attachTiltInput(fx: TiltTarget, host: TiltHost = window): () => void {
  const matches = (query: string) => {
    try {
      return typeof host.matchMedia === "function" && host.matchMedia(query).matches;
    } catch {
      return false;
    }
  };

  if (matches("(hover: hover) and (pointer: fine)")) {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const w = Math.max(1, host.innerWidth);
      const h = Math.max(1, host.innerHeight);
      fx.tiltX = clampUnit((event.clientX / w) * 2 - 1);
      fx.tiltY = clampUnit((event.clientY / h) * 2 - 1);
      fx.tiltLive = true;
    };
    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null) fx.tiltLive = false;
    };
    host.addEventListener("pointermove", onMove, { passive: true });
    host.addEventListener("mouseout", onLeave, { passive: true });
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("mouseout", onLeave);
      fx.tiltLive = false;
    };
  }

  const ctor = host.DeviceOrientationEvent as OrientationCtor | undefined;
  if (!matches("(pointer: coarse)") || !ctor || typeof ctor.requestPermission === "function") {
    return () => {};
  }

  /* The resting pitch, and the screen rotation it was taken for: turning the device to or from
     landscape moves the pitch to another sensor axis, so the grip is measured afresh. */
  let base: { pitch: number } | null = null;
  let baseAngle = 0;
  let last = 0;
  const onOrientation = (event: DeviceOrientationEvent) => {
    const angle = screenAngle(host.screen?.orientation?.angle ?? 0);
    const tilt = screenTilt(event.beta, event.gamma, angle);
    if (!tilt) return;
    const now = typeof event.timeStamp === "number" ? event.timeStamp / 1000 : 0;
    if (!base || angle !== baseAngle) {
      base = { pitch: Math.max(GYRO_BASE_RANGE[0], Math.min(GYRO_BASE_RANGE[1], tilt.pitch)) };
      baseAngle = angle;
    } else {
      const dt = Math.min(Math.max(now - last, 0), 1);
      base.pitch += (tilt.pitch - base.pitch) * Math.min(1, GYRO_BASE_FOLLOW * dt);
    }
    last = now;
    const next = orientationToTilt(event.beta, event.gamma, angle, base);
    if (!next) return;
    fx.tiltX = next.x;
    fx.tiltY = next.y;
    fx.tiltLive = true;
  };
  host.addEventListener("deviceorientation", onOrientation, { passive: true });
  return () => {
    host.removeEventListener("deviceorientation", onOrientation);
    fx.tiltLive = false;
  };
}
