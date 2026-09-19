import { describe, expect, it } from "vitest";
import {
  Color,
  DoubleSide,
  LineSegments,
  Mesh,
  Points,
  type Material,
  type Object3D,
  type ShaderMaterial,
} from "three";
import { INTRO_LAPTOP, cameraAt, lidOpenAt } from "@/components/intro/three/cameraPath";
import { createIntroFx } from "@/components/intro/fx";
import type { IntroTier } from "@/components/intro/capability";
import { EDGE } from "@/components/intro/three/edge";
import type { IntroPalette } from "@/components/intro/three/materials";
import {
  LAPTOP_DRAW_BUDGET,
  LAPTOP_SLOTS,
  LAPTOP_SLOT_AT,
  LAPTOP_SLOT_COUNT,
  LAPTOP_SLOT_LITE,
  LAPTOP_SLOT_MID,
  boardFillAt,
  createIntroLaptop,
  laptopSlotU,
  type LaptopSlot,
} from "@/components/intro/three/laptop";

/*
 * The intro's machine. Everything about it that CANNOT announce its own mistake:
 *
 *  · the slot table. `mesh.count` is the governor's only lever, so the order IS the contract —
 *    a gap, a duplicate or a key that drifted ahead of the port means the governor drops a rail
 *    off the chassis instead of a key off the deck, and the build stays green;
 *  · `aU`. `./edge.ts` will not draw a travelling band without it and `createRingMaterial` reads
 *    it by the same name; a non-monotone `aU` is a band that jumps about the machine rather than
 *    sweeping it, which looks like a shader bug and is a data bug;
 *  · the lid's travel. Shut at u 0 and 107 degrees at u 1 — off by a sign and the lid closes
 *    into the deck, which on a transparent additive object is not obvious in a still;
 *  · the draw-call count. Four objects too many and the governor drops to "lite" inside the first
 *    two one-second windows, i.e. DURING the cinematic;
 *  · where the camera actually is. The flight is aimed at `INTRO_LAPTOP`, and this file owns the
 *    boxes those numbers turn into: if one of them grew, the camera films the inside of a wall
 *    and nothing throws.
 *
 * three.js runs fine in jsdom for all of this — none of it needs a WebGL context.
 */

const PALETTE: IntroPalette = {
  red: new Color("#ff3b47"),
  redLift: new Color("#ff5362"),
  blue: new Color("#3970ff"),
  cyan: new Color("#4fc3e8"),
  txt: new Color("#e8f1ff"),
  voidBg: new Color("#05070c"),
  ice: new Color("#9fd8ef"),
};

const TIERS: readonly IntroTier[] = ["high", "mid", "low"];

/** The near plane `IntroScene` gives the camera. Nothing may come closer to it than this. */
const NEAR = 0.01;
/** Every aspect the flight has to survive, the camera-path test's own table. */
const ASPECTS = [2.4, 16 / 9, 1.6, 1, 0.75, 375 / 667, 0.3];

/** One draw call per visible renderable — what the renderer would issue for this group. */
function drawCalls(object: Object3D): number {
  if (!object.visible) return 0;
  let calls = 0;
  const renderable = object instanceof Mesh || object instanceof LineSegments || object instanceof Points;
  // An `InstancedMesh` with `count` 0 is skipped by the renderer, like any empty draw range.
  const count = (object as { count?: number }).count;
  if (renderable && count !== 0) calls += 1;
  for (const child of object.children) calls += drawCalls(child);
  return calls;
}

/** Distance from a point to a slot's box, 0 when the point is inside it. */
function clearance(slot: LaptopSlot, px: number, py: number, pz: number, lidAngle: number): number {
  const x = px;
  let y = py;
  let z = pz;
  if (slot.lid) {
    // World = hinge + Rx(angle) . local, so local = Rx(-angle) . (world - hinge).
    const dy = py - INTRO_LAPTOP.hinge.y;
    const dz = pz - INTRO_LAPTOP.hinge.z;
    const c = Math.cos(-lidAngle);
    const s = Math.sin(-lidAngle);
    y = dy * c - dz * s;
    z = dy * s + dz * c;
  }
  const ox = Math.max(0, Math.abs(x - slot.x) - slot.w / 2);
  const oy = Math.max(0, Math.abs(y - slot.y) - slot.h / 2);
  const oz = Math.max(0, Math.abs(z - slot.z) - slot.d / 2);
  return Math.sqrt(ox * ox + oy * oy + oz * oz);
}

describe("the slot table", () => {
  it("is 29 pieces, every index used once and none left empty", () => {
    expect(LAPTOP_SLOTS).toHaveLength(LAPTOP_SLOT_COUNT);
    for (const slot of LAPTOP_SLOTS) {
      expect(slot).toBeDefined();
      expect(slot.name).not.toHaveLength(0);
    }
    expect(new Set(LAPTOP_SLOTS.map((s) => s.name)).size).toBe(LAPTOP_SLOT_COUNT);
  });

  it("tiles 0..28 with the named groups, with no gap and no overlap", () => {
    // Each entry in the map is a group's FIRST slot; the next entry's start is its end.
    const starts = Object.values(LAPTOP_SLOT_AT);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(starts[0]).toBe(0);
    expect(new Set(starts).size).toBe(starts.length);
    expect(starts[starts.length - 1]).toBeLessThan(LAPTOP_SLOT_COUNT);

    const sizes = [1, 2, 3, 3, 1, 4, 2, 12, 1];
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(LAPTOP_SLOT_COUNT);
    let at = 0;
    for (let i = 0; i < starts.length; i += 1) {
      expect(starts[i]).toBe(at);
      at += sizes[i];
    }
  });

  it("gives up the port last of all and the keys next to last", () => {
    // The governor's two steps, and the only two the table promises.
    expect(LAPTOP_SLOT_MID).toBe(LAPTOP_SLOT_AT.port);
    expect(LAPTOP_SLOT_LITE).toBe(LAPTOP_SLOT_AT.keys);
    expect(LAPTOP_SLOTS[LAPTOP_SLOT_COUNT - 1].name).toBe("port");
    for (let i = LAPTOP_SLOT_LITE; i < LAPTOP_SLOT_MID; i += 1) {
      expect(LAPTOP_SLOTS[i].name).toMatch(/^key-/);
    }
    // What survives the lite step is still a laptop: chassis, feet, hinge, vent, pad and lid.
    const kept = LAPTOP_SLOTS.slice(0, LAPTOP_SLOT_LITE).map((s) => s.name);
    expect(kept[0]).toBe("deck");
    for (const name of ["vent-sill", "vent-lintel", "vent-hood", "pad", "rail-left", "rail-right"]) {
      expect(kept).toContain(name);
    }
    expect(kept.some((name) => name.startsWith("key-"))).toBe(false);
  });

  it("is made of real boxes: finite, sized, and inside the machine's own reach", () => {
    for (const slot of LAPTOP_SLOTS) {
      for (const n of [slot.x, slot.y, slot.z, slot.w, slot.h, slot.d]) expect(Number.isFinite(n)).toBe(true);
      for (const n of [slot.w, slot.h, slot.d]) expect(n).toBeGreaterThan(0);
      // Nothing reaches past the machine's own frame — a typo in a size shows up here long
      // before it shows up as a wall across the cavity.
      expect(slot.w).toBeLessThanOrEqual(INTRO_LAPTOP.lid.w);
      expect(slot.d).toBeLessThanOrEqual(Math.max(INTRO_LAPTOP.deck.d, INTRO_LAPTOP.lid.h));
    }
  });
});

describe("aU", () => {
  it("climbs strictly over the slots, 0 at the first and 1 at the last", () => {
    expect(laptopSlotU(0)).toBe(0);
    expect(laptopSlotU(LAPTOP_SLOT_COUNT - 1)).toBe(1);
    let previous = -1;
    for (let i = 0; i < LAPTOP_SLOT_COUNT; i += 1) {
      const here = laptopSlotU(i);
      expect(here).toBeGreaterThan(previous);
      expect(here).toBeLessThanOrEqual(1);
      previous = here;
    }
  });

  it("reaches the geometry as one instanced float per slot", () => {
    const machine = createIntroLaptop("high", PALETTE);
    const frame = machine.group.getObjectByName("intro-laptop-frame");
    const attribute = (frame as Mesh).geometry.getAttribute("aU");
    expect(attribute.itemSize).toBe(1);
    expect(attribute.count).toBe(LAPTOP_SLOT_COUNT);
    for (let i = 0; i < LAPTOP_SLOT_COUNT; i += 1) expect(attribute.getX(i)).toBeCloseTo(laptopSlotU(i), 6);
    // The halo is the same geometry — one `aU`, two meshes — and its own instance matrices.
    const halo = machine.group.getObjectByName("intro-laptop-halo") as Mesh;
    expect(halo.geometry).toBe((frame as Mesh).geometry);
    machine.dispose();
  });

  it("wipes the display bottom to top, which is the direction `screenFillAt` promises", () => {
    const machine = createIntroLaptop("high", PALETTE);
    const screen = machine.group.getObjectByName("intro-laptop-screen") as Mesh;
    const position = screen.geometry.getAttribute("position");
    const u = screen.geometry.getAttribute("aU");
    let bottom = Infinity;
    let top = -Infinity;
    for (let i = 0; i < position.count; i += 1) {
      if (position.getY(i) < 0) bottom = Math.min(bottom, u.getX(i));
      else top = Math.max(top, u.getX(i));
    }
    // `step(vU, uFill)` lights vU <= uFill, so the low end of `aU` has to be the bottom edge.
    expect(bottom).toBeCloseTo(0, 6);
    expect(top).toBeCloseTo(1, 6);
    machine.dispose();
  });

  it("lights the board from the die outwards, and finishes before the cross-fade", () => {
    expect(boardFillAt(0)).toBe(0);
    expect(boardFillAt(Number.NaN)).toBe(0);
    // Beat 2's window in flight units: a little light inside beat 1, full at progress 0.58.
    expect(boardFillAt(0.075)).toBe(0);
    expect(boardFillAt(0.388)).toBe(1);
    expect(boardFillAt(0.4)).toBe(1);
    let previous = -1;
    for (let i = 0; i <= 200; i += 1) {
      const here = boardFillAt(i / 200);
      expect(here).toBeGreaterThanOrEqual(previous);
      previous = here;
    }
  });
});

describe("the lid", () => {
  it("is shut at u 0 and open to 107 degrees at u 1", () => {
    const machine = createIntroLaptop("high", PALETTE);
    const lid = machine.group.getObjectByName("intro-laptop-lid");
    expect(lid).toBeDefined();
    const fx = createIntroFx();

    fx.flight = 0;
    machine.update(0.016, fx);
    expect(lid?.rotation.x).toBe(0);

    fx.flight = 1;
    machine.update(0.016, fx);
    expect(lid?.rotation.x).toBeCloseTo(-INTRO_LAPTOP.lid.open, 9);

    // And it never overshoots into the deck or past the back of the machine on the way.
    for (let i = 0; i <= 100; i += 1) {
      fx.flight = i / 100;
      machine.update(0.016, fx);
      const angle = lid?.rotation.x ?? 0;
      expect(angle).toBeLessThanOrEqual(0);
      expect(angle).toBeGreaterThan(-INTRO_LAPTOP.lid.open * 1.02);
      expect(angle).toBeCloseTo(-lidOpenAt(i / 100) * INTRO_LAPTOP.lid.open, 9);
    }
    machine.dispose();
  });

  it("carries the display and the cover glass, so they turn with it", () => {
    const machine = createIntroLaptop("high", PALETTE);
    const lid = machine.group.getObjectByName("intro-laptop-lid");
    const names = lid?.children.map((child) => child.name) ?? [];
    expect(names).toContain("intro-laptop-screen");
    expect(names).toContain("intro-laptop-glass");
    machine.dispose();
  });
});

describe("the budget", () => {
  it("costs six draw calls on high and four below it", () => {
    const counts = TIERS.map((tier) => {
      const machine = createIntroLaptop(tier, PALETTE);
      const calls = drawCalls(machine.group);
      machine.dispose();
      return calls;
    });
    expect(counts[0]).toBe(LAPTOP_DRAW_BUDGET);
    expect(counts[0]).toBeLessThanOrEqual(LAPTOP_DRAW_BUDGET);
    // The halo and the transmissive glass are the high tier's two extras and the only two.
    expect(counts[1]).toBe(LAPTOP_DRAW_BUDGET - 2);
    expect(counts[2]).toBe(LAPTOP_DRAW_BUDGET - 2);
  });

  it("puts exactly one transmissive surface in the scene, and only on high", () => {
    for (const tier of TIERS) {
      const machine = createIntroLaptop(tier, PALETTE);
      let transmissive = 0;
      machine.group.traverse((object) => {
        const material = (object as Mesh).material as { transmission?: number } | undefined;
        if (material && typeof material.transmission === "number" && material.transmission > 0) {
          transmissive += 1;
        }
      });
      expect(transmissive).toBe(tier === "high" ? 1 : 0);
      machine.dispose();
    }
  });

  it("drops pieces on `setLite`, never materials", () => {
    const machine = createIntroLaptop("high", PALETTE);
    const frame = machine.group.getObjectByName("intro-laptop-frame") as Mesh & { count: number };
    const before = frame.material;
    expect(frame.count).toBe(LAPTOP_SLOT_COUNT);

    machine.setLite(true);
    expect(frame.count).toBe(LAPTOP_SLOT_LITE);
    expect(frame.material).toBe(before);
    expect(drawCalls(machine.group)).toBeLessThan(LAPTOP_DRAW_BUDGET);

    machine.setLite(false);
    expect(frame.count).toBe(LAPTOP_SLOT_COUNT);
    expect(frame.material).toBe(before);
    expect(drawCalls(machine.group)).toBe(LAPTOP_DRAW_BUDGET);
    machine.dispose();
  });

  it("starts each tier on its own share of the table", () => {
    const counts = TIERS.map((tier) => {
      const machine = createIntroLaptop(tier, PALETTE);
      const frame = machine.group.getObjectByName("intro-laptop-frame") as Mesh & { count: number };
      const count = frame.count;
      machine.dispose();
      return count;
    });
    expect(counts).toEqual([LAPTOP_SLOT_COUNT, LAPTOP_SLOT_MID, LAPTOP_SLOT_LITE]);
  });
});

describe("the three settings that fail SILENTLY and in the picture", () => {
  /*
   * Each of these cost a frame-by-frame capture to find, because reverting any of them still
   * compiles, still draws, still passes every other test in this file, and still costs the same
   * six draw calls. They are the only material flags in the machine whose whole job is what the
   * camera sees.
   */

  it("draws the frame on BOTH sides, so the cavity the camera flies down has an inside", () => {
    // Beats 1-3 are flown INSIDE the deck's box. With `FrontSide` its inner surfaces are culled,
    // so there is no floor, no ceiling and no back wall: K2 — the frame the SVG cross-fade lands
    // on — is three hinge barrels and a few traces floating in black. Two sides cost no extra
    // draw call, which is what makes an interior affordable at all inside `LAPTOP_DRAW_BUDGET`.
    expect(EDGE.side).toBe(DoubleSide);
    const machine = createIntroLaptop("high", PALETTE);
    const frame = machine.group.getObjectByName("intro-laptop-frame") as Mesh;
    expect((frame.material as Material).side).toBe(DoubleSide);
    machine.dispose();
  });

  it("never lets the cover pane write depth, because the display lives inside it", () => {
    // The pane is the only depth writer in an otherwise entirely additive scene, and its surface
    // sits proud of the display. three draws the transmissive list before the transparent one, so
    // a pane that writes depth makes the screen fail the depth test on every pixel — beats 4 and
    // 5 end on a black rectangle, and nothing anywhere reports a problem.
    const machine = createIntroLaptop("high", PALETTE);
    const glass = machine.group.getObjectByName("intro-laptop-glass") as Mesh;
    expect((glass.material as Material).depthWrite).toBe(false);
    machine.dispose();
  });

  it("writes the die's plate and the board's tracks ONE fill and ONE head", () => {
    // They are two materials only so that the plate — which is the floor the camera skims at 0.03
    // — can run darker than the hairlines. The power-up is still meant to be a single wave; feed
    // them different numbers and it silently becomes two.
    const machine = createIntroLaptop("high", PALETTE);
    const plate = machine.group.getObjectByName("intro-laptop-die") as Mesh;
    const tracks = machine.group.getObjectByName("intro-laptop-traces") as Mesh;
    expect(plate.material).not.toBe(tracks.material);
    const fx = createIntroFx();
    for (const u of [0, 0.2, 0.388, 0.7, 1]) {
      fx.flight = u;
      machine.update(0.016, fx);
      const a = (plate.material as ShaderMaterial).uniforms;
      const b = (tracks.material as ShaderMaterial).uniforms;
      expect(a.uFill.value, `uFill @ u=${u}`).toBe(b.uFill.value);
      expect(a.uHead.value, `uHead @ u=${u}`).toBe(b.uHead.value);
      // …and the plate is the darker of the two, which is the only reason they were split.
      expect(a.uStrength.value).toBeLessThan(b.uStrength.value);
    }
    machine.dispose();
  });
});

describe("the flight, against the boxes", () => {
  it("never puts a piece of the machine inside the near plane", () => {
    // The chassis is exempt: the camera flies down the INSIDE of it for the first three beats,
    // which is the whole design. Everything else has to stay off the lens — including the vent's
    // sill, lintel and hood, which frame the hole the camera leaves through.
    const solids = LAPTOP_SLOTS.filter((slot) => slot.name !== "deck");
    for (const aspect of ASPECTS) {
      for (let i = 0; i <= 400; i += 1) {
        const u = i / 400;
        const pose = cameraAt(u, aspect);
        const angle = -lidOpenAt(u) * INTRO_LAPTOP.lid.open;
        for (const slot of solids) {
          const gap = clearance(slot, pose.px, pose.py, pose.pz, angle);
          expect(
            gap,
            `${slot.name} at u=${u.toFixed(3)} aspect=${aspect.toFixed(2)}`,
          ).toBeGreaterThan(NEAR);
        }
      }
    }
  });

  it("keeps the camera inside the cavity for as long as it is inside the chassis", () => {
    // `deck.t` was raised from the interior model's 0.07 to 0.16 for exactly this reason, and
    // the headroom it buys is the claim being pinned here.
    const { deck, cavity } = INTRO_LAPTOP;
    for (const aspect of ASPECTS) {
      for (let i = 0; i <= 400; i += 1) {
        const pose = cameraAt(i / 400, aspect);
        const inside =
          Math.abs(pose.px) < deck.w / 2 && Math.abs(pose.pz) < deck.d / 2 && Math.abs(pose.py) < deck.t;
        if (!inside) continue;
        expect(Math.abs(pose.py), `u=${(i / 400).toFixed(3)}`).toBeLessThan(cavity - NEAR);
      }
    }
  });
});
