import { describe, expect, it } from "vitest";
import {
  FLIGHT_KEYS,
  FLIGHT_MAP,
  INTRO_LAPTOP,
  MAX_WIDEN,
  SCREEN_OPEN,
  cameraAt,
  coverDistance,
  flightFromProgress,
  lidOpenAt,
  screenFillAt,
  type CameraPose,
} from "@/components/intro/three/cameraPath";

/*
 * The intro's camera flight. Pure numbers — `cameraPath.ts` imports nothing at run time, so none
 * of this needs three.js or a WebGL context.
 *
 * This file is the guard on the one part of the design that can break SILENTLY. Everything else
 * in the intro announces a mistake: a shader that will not compile throws, a missing DOM part
 * throws, a tween that never runs leaves the overlay up and the watchdog fires. A camera key that
 * drifts half a unit just films the inside of a wall, and the build stays green. So: the table
 * tiles [0, 1] with no gap, the pose is continuous at every seam, the camera actually goes THROUGH
 * the vent rather than through the back plate, it clears the open lid on the way round, and the
 * screen covers the viewport at every aspect a phone or a monitor can present.
 */

/** Every aspect the flight has to survive: ultrawide down to a folded phone in portrait. */
const ASPECTS = [2.4, 16 / 9, 1.6, 4 / 3, 1, 0.75, 375 / 667, 0.46, 0.3];

const NEAR = 0.01;
const FAR = 14;

type Vec = readonly [number, number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec): number => Math.sqrt(dot(a, a));
const norm = (a: Vec): Vec => {
  const l = len(a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const position = (pose: CameraPose): Vec => [pose.px, pose.py, pose.pz];
const target = (pose: CameraPose): Vec => [pose.tx, pose.ty, pose.tz];

/**
 * A point in the camera's frame, as normalised device coordinates: |x| and |y| below 1 are in
 * shot, `z` is the depth along the look direction. Built exactly the way the rig will build the
 * camera — `up = (sin roll, cos roll, 0)` then `lookAt` — so what this asserts is what is drawn.
 */
function project(pose: CameraPose, aspect: number, point: Vec): { x: number; y: number; z: number } {
  const eye = position(pose);
  const forward = norm(sub(target(pose), eye));
  const right = norm(cross(forward, [Math.sin(pose.roll), Math.cos(pose.roll), 0]));
  const up = cross(right, forward);
  const v = sub(point, eye);
  const z = dot(v, forward);
  const tan = Math.tan((pose.fov * Math.PI) / 360);
  return { x: dot(v, right) / (z * tan * aspect), y: dot(v, up) / (z * tan), z };
}

/** The plane the open lid lies in: signed distance, positive in front of the display. */
function lidPlane(p: Vec): number {
  return (
    SCREEN_OPEN.ny * (p[1] - INTRO_LAPTOP.hinge.y) + SCREEN_OPEN.nz * (p[2] - INTRO_LAPTOP.hinge.z)
  );
}

/** Where a segment crosses a plane, as a fraction of it, or −1 when it never does. */
function crossing(a: number, b: number): number {
  return a < 0 && b > 0 ? a / (a - b) : -1;
}

const KEY_NAMES = ["die", "power-up", "interior", "out", "lid", "screen"] as const;

describe("FLIGHT_KEYS", () => {
  it("is six frames tiling [0, 1] with no gap, strictly ascending", () => {
    expect(FLIGHT_KEYS).toHaveLength(KEY_NAMES.length);
    expect(FLIGHT_KEYS[0].u).toBe(0);
    expect(FLIGHT_KEYS[FLIGHT_KEYS.length - 1].u).toBe(1);
    for (let i = 1; i < FLIGHT_KEYS.length; i += 1) {
      expect(FLIGHT_KEYS[i].u).toBeGreaterThan(FLIGHT_KEYS[i - 1].u);
    }
  });

  it("is the cross-fade's landing frame at u 0.40 and nowhere else", () => {
    // `.canvasHost` is transparent until `sceneReady`; K2 is the first 3D frame anybody sees.
    expect(FLIGHT_KEYS[2].u).toBe(0.4);
  });

  it("keeps every key inside the 0.01 / 14 near-far budget, at every aspect", () => {
    for (const aspect of ASPECTS) {
      for (const key of FLIGHT_KEYS) {
        const pose = cameraAt(key.u, aspect);
        const reach = len(sub(target(pose), position(pose)));
        expect(reach).toBeGreaterThan(NEAR);
        // The far corner of the machine, not just the aim point: the whole object has to fit.
        for (const corner of [
          [1.2, 1.54, -1.24],
          [-1.2, 1.54, -1.24],
          [1.2, -0.1, 0.81],
          [-1.2, -0.1, 0.81],
        ] as Vec[]) {
          expect(len(sub(corner, position(pose)))).toBeLessThan(FAR);
        }
      }
    }
  });

  it("caps how far a narrow viewport backs off, so the far plane is never reached", () => {
    // Without the cap a 1:20 viewport would multiply K4's reach by twenty and film nothing.
    const capped = cameraAt(0.84, 1 / (MAX_WIDEN * 4));
    const atCap = cameraAt(0.84, 1 / MAX_WIDEN);
    expect(capped).toEqual(atCap);
    expect(len(sub(target(capped), position(capped)))).toBeLessThan(FAR);
  });

  it("never lets a fov reach a degenerate angle", () => {
    for (const key of FLIGHT_KEYS) {
      expect(key.fov).toBeGreaterThan(20);
      expect(key.fov).toBeLessThan(90);
    }
  });
});

describe("cameraAt", () => {
  it("returns each key's own pose at that key's u", () => {
    for (const [i, key] of FLIGHT_KEYS.entries()) {
      const pose = cameraAt(key.u, 1.6);
      expect(pose.fov, KEY_NAMES[i]).toBeCloseTo(key.fov, 9);
      expect(pose.roll, KEY_NAMES[i]).toBeCloseTo(key.roll, 9);
      expect(pose.tx, KEY_NAMES[i]).toBeCloseTo(key.tx, 9);
      expect(pose.ty, KEY_NAMES[i]).toBeCloseTo(key.ty, 9);
      expect(pose.tz, KEY_NAMES[i]).toBeCloseTo(key.tz, 9);
      if (!key.cover) {
        expect(pose.px, KEY_NAMES[i]).toBeCloseTo(key.px, 9);
        expect(pose.py, KEY_NAMES[i]).toBeCloseTo(key.py, 9);
        expect(pose.pz, KEY_NAMES[i]).toBeCloseTo(key.pz, 9);
      }
    }
  });

  it("is continuous at every seam — sampled either side of each key", () => {
    const eps = 1e-5;
    const fields = ["px", "py", "pz", "tx", "ty", "tz", "fov", "roll"] as const;
    for (const aspect of ASPECTS) {
      for (const key of FLIGHT_KEYS.slice(1, -1)) {
        const before = cameraAt(key.u - eps, aspect);
        const after = cameraAt(key.u + eps, aspect);
        for (const field of fields) {
          expect(Math.abs(after[field] - before[field]), `${field} @ u=${key.u}`).toBeLessThan(1e-3);
        }
      }
    }
  });

  it("clamps at both ends and never returns a NaN camera", () => {
    const first = cameraAt(0, 1.6);
    const last = cameraAt(1, 1.6);
    for (const u of [-5, -0.001, Number.NaN]) {
      expect(cameraAt(u, 1.6)).toEqual(first);
    }
    for (const u of [1.001, 42, Number.POSITIVE_INFINITY]) {
      expect(cameraAt(u, 1.6)).toEqual(last);
    }
    for (const aspect of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const pose = cameraAt(0.5, aspect);
      expect(Object.values(pose).every(Number.isFinite)).toBe(true);
    }
  });

  it("does not assume u climbs — a skip that jumps lands exactly where it would have arrived", () => {
    // The burst tween and a skip both hand it a value out of order. Stateless: same u, same pose.
    const walked = [0.05, 0.2, 0.41, 0.7, 0.9].map((u) => cameraAt(u, 1.6));
    const jumped = [0.9, 0.05, 0.7, 0.41, 0.2].map((u) => cameraAt(u, 1.6));
    expect(jumped[1]).toEqual(walked[0]);
    expect(jumped[4]).toEqual(walked[1]);
    expect(jumped[3]).toEqual(walked[2]);
    expect(jumped[2]).toEqual(walked[3]);
    expect(jumped[0]).toEqual(walked[4]);
  });

  it("never cuts: no 1% of the flight moves further than a tenth of the view depth", () => {
    // A camera that crosses a tenth of what it can see between two scrub frames is a cut, not a
    // move. The whip out of the vent is the fastest moment in the flight and it is well inside.
    for (const aspect of ASPECTS) {
      let previous = position(cameraAt(0, aspect));
      for (let i = 1; i <= 100; i += 1) {
        const here = position(cameraAt(i / 100, aspect));
        expect(len(sub(here, previous)), `u=${i / 100} @ ${aspect}`).toBeLessThan(FAR / 10);
        previous = here;
      }
    }
  });

  it("returns only finite numbers, with a sane fov, everywhere on the flight", () => {
    for (const aspect of ASPECTS) {
      for (let i = 0; i <= 400; i += 1) {
        const pose = cameraAt(i / 400, aspect);
        expect(Object.values(pose).every(Number.isFinite), `u=${i / 400} @ ${aspect}`).toBe(true);
        expect(pose.fov).toBeGreaterThan(20);
        expect(pose.fov).toBeLessThan(90);
        expect(len(sub(target(pose), position(pose)))).toBeGreaterThan(NEAR);
      }
    }
  });
});

describe("the flight, against the machine", () => {
  const { vent, die, cavity, deck, lid } = INTRO_LAPTOP;

  it("stays inside the chassis, and off the die, for beats 1 to 3", () => {
    for (let i = 0; i <= 200; i += 1) {
      const u = (i / 200) * 0.4;
      const pose = cameraAt(u, 1.6);
      expect(Math.abs(pose.py), `u=${u}`).toBeLessThan(cavity);
      expect(Math.abs(pose.px)).toBeLessThan(deck.w / 2);
      expect(Math.abs(pose.pz)).toBeLessThan(deck.d / 2);
      const overDie =
        Math.abs(pose.px - die.x) < die.w / 2 && Math.abs(pose.pz - die.z) < die.d / 2;
      if (overDie) expect(pose.py - (die.y + die.t / 2), `u=${u}`).toBeGreaterThan(2 * NEAR);
    }
  });

  it("has the vent in shot at K2 — the frame the cross-fade lands on", () => {
    // The whole aperture, not just its centre: this frame has to READ as a way out.
    const pose = cameraAt(0.4, 1.6);
    for (const dx of [-vent.w / 2, 0, vent.w / 2]) {
      for (const dy of [-vent.h / 2, 0, vent.h / 2]) {
        const seen = project(pose, 1.6, [vent.x + dx, vent.y + dy, vent.z]);
        expect(seen.z).toBeGreaterThan(NEAR);
        expect(Math.abs(seen.x)).toBeLessThan(1);
        expect(Math.abs(seen.y)).toBeLessThan(1);
      }
    }
    // …and off to one side, so the ribs either side of it are the rest of the composition.
    expect(project(pose, 1.6, [vent.x, vent.y, vent.z]).x).toBeLessThan(-0.15);
  });

  it("leaves THROUGH the vent, at every aspect", () => {
    for (const aspect of ASPECTS) {
      let previous = position(cameraAt(0.4, aspect));
      let crossed = false;
      for (let i = 1; i <= 4000; i += 1) {
        const u = 0.4 + (i / 4000) * 0.26;
        const here = position(cameraAt(u, aspect));
        if (previous[2] > vent.z && here[2] <= vent.z) {
          const t = (previous[2] - vent.z) / (previous[2] - here[2]);
          const x = previous[0] + t * (here[0] - previous[0]);
          const y = previous[1] + t * (here[1] - previous[1]);
          expect(Math.abs(x - vent.x), `x @ aspect ${aspect}`).toBeLessThan(vent.w / 2);
          expect(Math.abs(y - vent.y), `y @ aspect ${aspect}`).toBeLessThan(vent.h / 2);
          crossed = true;
          break;
        }
        previous = here;
      }
      expect(crossed, `aspect ${aspect}`).toBe(true);
    }
  });

  it("clears the open lid on the way round, at every aspect", () => {
    // K3→K4 crosses the lid's plane. A straight run between two keys, so the only thing keeping
    // the camera out of the panel is where it crosses: past the lid's own edge.
    for (const aspect of ASPECTS) {
      let previous = position(cameraAt(0.66, aspect));
      let found = false;
      for (let i = 1; i <= 4000; i += 1) {
        const here = position(cameraAt(0.66 + (i / 4000) * 0.34, aspect));
        const t = crossing(lidPlane(previous), lidPlane(here));
        if (t >= 0) {
          const x = previous[0] + t * (here[0] - previous[0]);
          expect(Math.abs(x), `aspect ${aspect}`).toBeGreaterThan(lid.w / 2);
          found = true;
          break;
        }
        previous = here;
      }
      expect(found, `aspect ${aspect}`).toBe(true);
    }
  });

  it("stays clear of the deck once it is outside", () => {
    for (const aspect of ASPECTS) {
      for (let i = 0; i <= 200; i += 1) {
        const u = 0.7 + (i / 200) * 0.3;
        const pose = cameraAt(u, aspect);
        const insideDeck =
          Math.abs(pose.px) < deck.w / 2 &&
          Math.abs(pose.py) < deck.t / 2 &&
          Math.abs(pose.pz) < deck.d / 2;
        expect(insideDeck, `u=${u} @ ${aspect}`).toBe(false);
      }
    }
  });
});

describe("the screen, at the end", () => {
  it("is where the fully open lid puts it — the table matches the derived plane", () => {
    const k5 = FLIGHT_KEYS[FLIGHT_KEYS.length - 1];
    expect(k5.cover).toBe(true);
    expect(k5.roll).toBe(0);
    expect(k5.tx).toBeCloseTo(SCREEN_OPEN.cx, 4);
    expect(k5.ty).toBeCloseTo(SCREEN_OPEN.cy, 4);
    expect(k5.tz).toBeCloseTo(SCREEN_OPEN.cz, 4);
    // The table's px/py/pz are documentation: the 16:10 answer. They must not drift from it.
    const pose = cameraAt(1, 1.6);
    expect(pose.px).toBeCloseTo(k5.px, 4);
    expect(pose.py).toBeCloseTo(k5.py, 4);
    expect(pose.pz).toBeCloseTo(k5.pz, 4);
  });

  it("is 16:10, like the interior machine's", () => {
    expect(INTRO_LAPTOP.screen.w / INTRO_LAPTOP.screen.h).toBeCloseTo(1.6, 9);
    expect(INTRO_LAPTOP.screen).toEqual({ w: 2.28, h: 1.425 });
    expect(INTRO_LAPTOP.lid.open).toBe(1.87);
  });

  it("COVERS the viewport at every aspect — never a letterbox", () => {
    const { w, h } = INTRO_LAPTOP.screen;
    for (const aspect of ASPECTS) {
      const pose = cameraAt(1, aspect);
      const d = len(sub(target(pose), position(pose)));
      expect(d).toBeCloseTo(coverDistance(pose.fov, aspect), 9);
      const halfH = d * Math.tan((pose.fov * Math.PI) / 360);
      expect(halfH, `height @ ${aspect}`).toBeLessThanOrEqual(h / 2 + 1e-9);
      expect(halfH * aspect, `width @ ${aspect}`).toBeLessThanOrEqual(w / 2 + 1e-9);
      // …and it is the LARGEST such distance: one of the two edges is touched exactly.
      expect(Math.min(h / 2 - halfH, w / 2 - halfH * aspect)).toBeCloseTo(0, 9);
      expect(d).toBeGreaterThan(NEAR);
    }
  });
});

describe("flightFromProgress", () => {
  it("hits 0 and 0.84 at the ends", () => {
    expect(flightFromProgress(0)).toBe(0);
    expect(flightFromProgress(1)).toBeCloseTo(0.84, 9);
    // The last stretch belongs to the burst's wall clock, not to the progress.
    expect(FLIGHT_MAP[FLIGHT_MAP.length - 1]).toEqual([1, 0.84]);
  });

  it("is monotone non-decreasing over 0..1, and clamped outside it", () => {
    let previous = flightFromProgress(-1);
    expect(previous).toBe(0);
    for (let i = 0; i <= 1000; i += 1) {
      const here = flightFromProgress(i / 1000);
      expect(here, `p=${i / 1000}`).toBeGreaterThanOrEqual(previous);
      previous = here;
    }
    expect(flightFromProgress(2)).toBeCloseTo(0.84, 9);
    expect(flightFromProgress(Number.NaN)).toBe(0);
  });

  it("lands on each band boundary exactly — the table is the contract", () => {
    for (const [p, u] of FLIGHT_MAP) expect(flightFromProgress(p)).toBeCloseTo(u, 9);
    // 0.24, not 0.30: beat 1 is a held frame and takes the shortening, beat 2 does not.
    expect(FLIGHT_MAP[1][0]).toBe(0.24);
  });

  it("gives every beat a share of the flight", () => {
    for (let i = 1; i < FLIGHT_MAP.length; i += 1) {
      expect(FLIGHT_MAP[i][0]).toBeGreaterThan(FLIGHT_MAP[i - 1][0]);
      expect(FLIGHT_MAP[i][1]).toBeGreaterThan(FLIGHT_MAP[i - 1][1]);
    }
  });
});

describe("lidOpenAt", () => {
  it("is shut at 0 and open at 1", () => {
    expect(lidOpenAt(0)).toBe(0);
    expect(lidOpenAt(1)).toBe(1);
    expect(lidOpenAt(Number.NaN)).toBe(0);
    expect(lidOpenAt(-1)).toBe(0);
  });

  it("holds shut until 0.62 and is settled by 0.84", () => {
    expect(lidOpenAt(0.62)).toBe(0);
    expect(lidOpenAt(0.6199)).toBe(0);
    expect(lidOpenAt(0.84)).toBe(1);
    expect(lidOpenAt(0.9)).toBe(1);
  });

  it("carries a couple of degrees past the top, not ten — mass, not a bounce", () => {
    let peak = 0;
    let at = 0;
    for (let i = 0; i <= 20000; i += 1) {
      const v = lidOpenAt(i / 20000);
      if (v > peak) {
        peak = v;
        at = i / 20000;
      }
    }
    // c1 = 0.7: 1.76% over, about three quarters of the way through the ramp.
    expect(peak).toBeGreaterThan(1.012);
    expect(peak).toBeLessThan(1.025);
    expect(at).toBeGreaterThan(0.62);
    expect(at).toBeLessThan(0.84);
    // The textbook 1.70158 would be 10% — ten degrees of overshoot on a 107-degree lid.
    expect((peak - 1) * INTRO_LAPTOP.lid.open * (180 / Math.PI)).toBeLessThan(3);
  });
});

describe("screenFillAt", () => {
  it("draws the screen from 0.62 to 0.95, monotone", () => {
    expect(screenFillAt(0)).toBe(0);
    expect(screenFillAt(0.62)).toBe(0);
    expect(screenFillAt(0.95)).toBe(1);
    expect(screenFillAt(1)).toBe(1);
    expect(screenFillAt(Number.NaN)).toBe(0);
    let previous = 0;
    for (let i = 0; i <= 1000; i += 1) {
      const here = screenFillAt(i / 1000);
      expect(here).toBeGreaterThanOrEqual(previous);
      previous = here;
    }
  });

  it("starts with the lid and finishes before the dive", () => {
    expect(screenFillAt(0.62)).toBe(lidOpenAt(0.62));
    expect(screenFillAt(0.95)).toBe(1);
    expect(lidOpenAt(0.95)).toBe(1);
  });
});
