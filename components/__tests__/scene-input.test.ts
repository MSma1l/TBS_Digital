import { describe, expect, it, vi } from "vitest";
import { createSceneFx } from "@/components/scene/fx";
import {
  GYRO_BASE_RANGE,
  GYRO_RANGE_DEG,
  attachTiltInput,
  orientationToTilt,
  screenTilt,
  type TiltHost,
} from "@/components/scene/input";

/*
 * Pointer and gyroscope tilt for the interior scene. The canvas never takes pointer events,
 * so tilt comes from passive window listeners — and the site never asks iOS for motion
 * permission (no prompt, ever): where `DeviceOrientationEvent.requestPermission` exists, no
 * orientation listener is attached at all and the core keeps its idle sway.
 */

describe("orientationToTilt", () => {
  const base = { pitch: 45 };

  it("answers null when the device reports no angles", () => {
    expect(orientationToTilt(null, 10, 0, base)).toBeNull();
    expect(orientationToTilt(40, null, 0, base)).toBeNull();
    expect(orientationToTilt(Number.NaN, 0, 0, base)).toBeNull();
  });

  it("portrait: gamma turns x, pitch away from the resting grip turns y", () => {
    expect(orientationToTilt(45, 0, 0, base)).toEqual({ x: 0, y: 0 });
    expect(orientationToTilt(45, 12.5, 0, base)).toEqual({ x: 0.5, y: 0 });
    expect(orientationToTilt(45 + 12.5, 0, 0, base)).toEqual({ x: 0, y: 0.5 });
  });

  /*
   * `screen.orientation.angle` is counter-clockwise: at 90 the device's top points left and
   * the screen's top is its right edge. "Right edge of the screen down" is x+, "top edge of the
   * screen up" is y+ at every rotation.
   */
  it("follows the screen's rotation: the pitch lives in gamma in landscape, in -beta upside down", () => {
    // 90: the screen's right edge is the device's bottom (down = beta+), its top the right edge (up = gamma-).
    expect(orientationToTilt(12.5, -45, 90, base)).toEqual({ x: 0.5, y: 0 });
    expect(orientationToTilt(0, -57.5, 90, base)).toEqual({ x: 0, y: 0.5 });
    // 270: the mirror image.
    expect(orientationToTilt(-12.5, 45, 270, base)).toEqual({ x: 0.5, y: 0 });
    expect(orientationToTilt(0, 57.5, 270, base)).toEqual({ x: 0, y: 0.5 });
    // 180: upside down.
    expect(orientationToTilt(-45, -12.5, 180, base)).toEqual({ x: 0.5, y: 0 });
    expect(orientationToTilt(-57.5, 0, 180, base)).toEqual({ x: 0, y: 0.5 });
    // Negative and unrounded angles name the same rotations.
    expect(orientationToTilt(3, 57.5, -90, base)).toEqual(orientationToTilt(3, 57.5, 270, base));
    expect(orientationToTilt(3, 57.5, 450, base)).toEqual(orientationToTilt(3, 57.5, 90, base));
    expect(screenTilt(3, -60, 90)).toEqual({ roll: 3, pitch: 60 });
    expect(screenTilt(null, -60, 90)).toBeNull();
  });

  it("a real landscape grip rests near the centre instead of pinned at the limits", () => {
    // An Android phone held in landscape-primary at a reading angle (review: beta ≈ 3, gamma ≈ -60).
    const grip = { beta: 3, gamma: -60, angle: 90 };
    const rest = { pitch: screenTilt(grip.beta, grip.gamma, grip.angle)!.pitch };
    expect(rest.pitch).toBe(60);
    const tilt = orientationToTilt(grip.beta, grip.gamma, grip.angle, rest)!;
    expect(tilt.x).toBeCloseTo(3 / GYRO_RANGE_DEG, 12);
    expect(tilt.y).toBe(0);
    expect(Math.abs(tilt.x)).toBeLessThan(0.2);
  });

  it("clamps to -1..1", () => {
    expect(orientationToTilt(45 + 4 * GYRO_RANGE_DEG, -4 * GYRO_RANGE_DEG, 0, base)).toEqual({ x: -1, y: 1 });
  });
});

type Listener = (event: Event) => void;

/** A window stand-in: which listeners were added, with which media answers. */
function makeHost(media: Record<string, boolean>, orientationCtor?: unknown) {
  const listeners = new Map<string, Listener>();
  const host = {
    innerWidth: 400,
    innerHeight: 800,
    scrollX: 0,
    scrollY: 0,
    screen: { orientation: { angle: 0 } },
    DeviceOrientationEvent: orientationCtor,
    matchMedia: (query: string) => ({ matches: media[query] ?? false }) as MediaQueryList,
    addEventListener: vi.fn((type: string, listener: Listener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => listeners.delete(type)),
  };
  return { host: host as unknown as TiltHost, listeners, raw: host };
}

const FINE = "(hover: hover) and (pointer: fine)";
const COARSE = "(pointer: coarse)";

describe("attachTiltInput — fine pointer", () => {
  it("tracks the pointer across the window, passively, and cleans up", () => {
    const fx = createSceneFx();
    const { host, listeners, raw } = makeHost({ [FINE]: true });
    const detach = attachTiltInput(fx, host);
    expect(raw.addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
    expect(listeners.has("deviceorientation")).toBe(false);
    expect(fx.tiltLive).toBe(false);

    listeners.get("pointermove")!({ clientX: 300, clientY: 200, pointerType: "mouse", timeStamp: 16 } as unknown as Event);
    expect(fx.tiltLive).toBe(true);
    expect(fx.tiltX).toBeCloseTo(0.5, 12);
    expect(fx.tiltY).toBeCloseTo(-0.5, 12);

    // The mouse sample also started the cursor trail's chain (scene-trail.test.ts has the rest).
    expect([fx.trail.lastX, fx.trail.lastY]).toEqual([300, 200]);

    listeners.get("pointermove")!({ clientX: 0, clientY: 0, pointerType: "touch" } as unknown as Event);
    expect(fx.tiltX).toBeCloseTo(0.5, 12);
    expect([fx.trail.lastX, fx.trail.lastY]).toEqual([300, 200]);

    listeners.get("mouseout")!({ relatedTarget: null } as unknown as Event);
    expect(fx.tiltLive).toBe(false);

    detach();
    expect(listeners.size).toBe(0);
  });
});

describe("attachTiltInput — touch-first", () => {
  it("never calls requestPermission, and attaches no orientation listener where it exists (iOS)", () => {
    const requestPermission = vi.fn(() => Promise.resolve("granted"));
    const fx = createSceneFx();
    const { host, listeners, raw } = makeHost({ [COARSE]: true }, { requestPermission });
    const detach = attachTiltInput(fx, host);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(raw.addEventListener).not.toHaveBeenCalled();
    expect(listeners.size).toBe(0);
    detach();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("uses the gyroscope where no permission is needed (Android), from the first grip", () => {
    const fx = createSceneFx();
    const { host, listeners, raw } = makeHost({ [COARSE]: true }, function DeviceOrientationEvent() {});
    const detach = attachTiltInput(fx, host);
    expect(raw.addEventListener).toHaveBeenCalledWith("deviceorientation", expect.any(Function), { passive: true });

    const orient = listeners.get("deviceorientation")!;
    orient({ beta: 90, gamma: 0, timeStamp: 0 } as unknown as Event);
    // the resting pitch is clamped into a comfortable range: 90° counts as 70°
    expect(fx.tiltLive).toBe(true);
    expect(fx.tiltY).toBeCloseTo((90 - GYRO_BASE_RANGE[1]) / GYRO_RANGE_DEG, 9);

    orient({ beta: null, gamma: null, timeStamp: 16 } as unknown as Event);
    expect(fx.tiltLive).toBe(true);

    detach();
    expect(listeners.size).toBe(0);
    expect(fx.tiltLive).toBe(false);
  });

  it("landscape: rests at the grip's own pitch (gamma), and takes the grip afresh when the screen rotates", () => {
    const fx = createSceneFx();
    const { host, listeners, raw } = makeHost({ [COARSE]: true }, function DeviceOrientationEvent() {});
    raw.screen.orientation.angle = 90;
    const detach = attachTiltInput(fx, host);
    const orient = listeners.get("deviceorientation")!;

    // Landscape-primary at a reading angle: centred, not pinned at the tilt limits.
    orient({ beta: 3, gamma: -60, timeStamp: 0 } as unknown as Event);
    expect(fx.tiltLive).toBe(true);
    expect(fx.tiltX).toBeCloseTo(3 / GYRO_RANGE_DEG, 9);
    expect(fx.tiltY).toBe(0);
    // Raising the screen's top edge by 12.5° tilts y by half the range.
    orient({ beta: 3, gamma: -72.5, timeStamp: 16 } as unknown as Event);
    expect(fx.tiltY).toBeCloseTo(0.5, 2);

    // Turned back to portrait: the pitch now lives in beta, measured from the new grip.
    raw.screen.orientation.angle = 0;
    orient({ beta: 40, gamma: 0, timeStamp: 32 } as unknown as Event);
    expect(fx.tiltX).toBe(0);
    expect(fx.tiltY).toBe(0);

    // And into landscape-secondary: a fresh base again, on +gamma.
    raw.screen.orientation.angle = 270;
    orient({ beta: -2, gamma: 55, timeStamp: 48 } as unknown as Event);
    expect(fx.tiltX).toBeCloseTo(2 / GYRO_RANGE_DEG, 9);
    expect(fx.tiltY).toBe(0);

    detach();
    expect(listeners.size).toBe(0);
  });

  it("attaches nothing without a gyroscope API or on a device that is neither", () => {
    const none = makeHost({ [COARSE]: true });
    attachTiltInput(createSceneFx(), none.host);
    expect(none.raw.addEventListener).not.toHaveBeenCalled();

    const neither = makeHost({}, function DeviceOrientationEvent() {});
    attachTiltInput(createSceneFx(), neither.host);
    expect(neither.raw.addEventListener).not.toHaveBeenCalled();
  });

  it("a matchMedia that throws counts as no match", () => {
    const { host, raw } = makeHost({});
    raw.matchMedia = () => {
      throw new Error("no media");
    };
    expect(() => attachTiltInput(createSceneFx(), host)()).not.toThrow();
    expect(raw.addEventListener).not.toHaveBeenCalled();
  });
});
