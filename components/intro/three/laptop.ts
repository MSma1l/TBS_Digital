/**
 * The machine the intro flies through, as one imperative object: meshes, materials and the
 * per-frame uniform writes. `IntroLaptop.tsx` creates it once, calls `update` from `useFrame`
 * and `dispose` on unmount — the shape `createInfinityCore` has today (`three/core.ts`).
 *
 * It is the SAME OBJECT as the interior stage's laptop (`components/scene/three/models/laptop.ts`)
 * seen from the inside: the same 2.4 x 1.62 deck, the same three hinge barrels, the same 16:10
 * display in a 2.4 x 1.5 lid opening to 107 degrees, the same twelve keys, the same drop order.
 * The measurements are NOT copied — they are imported from `INTRO_LAPTOP` (`./cameraPath`), which
 * owns them because the flight is aimed at them. A second copy drifting by a hundredth of a unit
 * puts the camera through the back wall instead of through the vent.
 *
 * Draw order (renderOrder inside three's opaque -> transmissive -> transparent lists):
 * board 1 -> glass 2 -> frame 3 -> halo 4 -> display 5.
 *
 * SIX DRAW CALLS on the high tier, four on mid and low — the object it replaces uses six:
 *
 *   1 the die plate     | two `createRingMaterial`s, written the SAME `uFill` and `uHead` every
 *   1 the board tracks  | frame, so the power-up is one wave over the die and then the ribs.
 *                       | They differ only in strength: the plate is the floor the camera skims
 *                       | at 0.03 and has to stay dark, the tracks are hairlines and have to
 *                       | carry (`DIE_GAIN` / `BOARD_GAIN`). Still two meshes, still two draws.
 *   2 the cover glass     the ONE transmissive surface in the scene (high tier only), and only
 *                         once the lid is off the deck — see `glassMesh.visible` in `update`
 *   3 the frame           29 boxes, ONE `InstancedMesh`, ONE `BoxGeometry`, `createEdgeMaterial`
 *   4 the halo            the same 29 boxes, `BackSide`, its own matrices grown x1.06
 *   5 the display         one plane, `createRingMaterial`, wiped bottom to top by `uFill`
 *
 * Why it is not thirty meshes: the FPS governor drops the scene to "lite" inside its first two
 * one-second windows, which is the cinematic itself. Thirty draw calls on a mid phone spends
 * those windows, the governor fires during beat 2, and the visitor watches the machine lose its
 * keys on screen. One instanced frame costs one draw whatever `count` is, so the governor's lever
 * is `mesh.count` — it gives up the port strip, then the keys, and a machine without keys is
 * still a machine.
 *
 * Nothing here is loaded: no drei, no GLTF, no textures, no HDR (banned by `eslint.config.mjs`,
 * and the CSP in `proxy.ts` blocks the fetches). Every solid is one unit box sized by its own
 * matrix, exactly as the interior model builds its thirteen.
 */

import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LineSegments,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type Material,
  type MeshPhysicalMaterial,
  type Object3D,
} from "three";
import { MAX_FRAME_STEP } from "@/components/three/motion";
import type { IntroTier } from "../capability";
import type { IntroFx } from "../fx";
import { TIER_CONFIG } from "../tiers";
import { INTRO_LAPTOP, lidOpenAt, screenFillAt } from "./cameraPath";
import { EDGE, EDGE_HALO, createEdgeMaterial } from "./edge";
import { createPhysicalGlass, createRingMaterial, type IntroPalette } from "./materials";

const { deck: DECK, hinge: HINGE, vent: VENT, lid: LID, screen: SCREEN, bezel: BEZEL, die: DIE } =
  INTRO_LAPTOP;

/* ---- the furniture the frame is made of ------------------------------------------------------ */

/**
 * The parts `INTRO_LAPTOP` does not carry, because the flight is not aimed at them: the feet, the
 * trackpad, the keys and the port bank. Every number is the interior model's own
 * (`components/scene/three/models/laptop.ts`), so the two machines read as the same product.
 */
const FOOT = { w: 0.32, t: 0.04, d: 0.2, x: 0.84, z: -0.48 } as const;
const PAD = { w: 0.8, t: 0.016, d: 0.5, z: 0.38 } as const;
/** Twelve keys: three rows of four, each (1.9 - 3 gaps) / 4 across. A key is a piece. */
const KEYS = {
  t: 0.022,
  d: 0.11,
  w: (1.9 - 3 * 0.045) / 4,
  gap: 0.045,
  rows: [-0.55, -0.33, -0.11],
  cols: 4,
} as const;
const KEY_X = Array.from(
  { length: KEYS.cols },
  (_, i) => -0.95 + KEYS.w / 2 + i * (KEYS.w + KEYS.gap),
);
/** The lid's two hinge covers, lid-local. */
const COVER = { x: LID.w / 2 - 0.19, up: 0.115, w: 0.3, h: 0.075 } as const;
/**
 * The port bank down the deck's left flank. The interior machine spends three slots on three
 * ports; this one has one slot left in the table and it is the LAST one, so it is a single strip.
 * The piece the governor gives up first has to be the piece nobody misses.
 */
const PORT = { x: -DECK.w / 2 + 0.015, y: 0, w: 0.05, t: 0.042, d: 0.46, z: 0.1 } as const;
/**
 * The vent's surround, on the deck's back face in the gap between the left hinge boss and the
 * middle one. A sill, a lintel and a hood over them; the aperture is what they leave, and the
 * camera passes through it on the straight run from K2 to K3.
 *
 * `SILL_DROP` is measured, not chosen. K3 is a `widen: 1` key, so on a narrow viewport it backs
 * off to as much as `MAX_WIDEN` (3x) its distance from its target — which pivots the exit ray
 * about the hole in x, exactly as `cameraPath.ts` says, but NOT in y: `resolveKey` leaves `py`
 * alone, so the camera crosses the vent's plane much earlier along the segment and lower down.
 * The ray holds x = -0.23 at every aspect and sags from y 0.015 (16:10) to y -0.0011 (a folded
 * phone at the cap). A 0.05 aperture centred on `vent.y` leaves 0.009 of that — under the 0.01
 * near plane, which is a sill sliced across the lens on the frame of the exit and nothing
 * thrown. So the sill drops by the sag and the aperture is 0.067 tall: every piece then clears
 * the ray by 0.025 or more, two and a half near planes, at every aspect the widen cap allows.
 */
const VENT_RAIL = { t: 0.012, over: 0.012, d: 0.03 } as const;
const SILL_DROP = 0.017;
const HOOD = { w: 0.3, t: 0.008, d: 0.036, lift: 0.016, back: 0.016 } as const;

/* ---- the slot table -------------------------------------------------------------------------- */

/**
 * One box of the frame. `x/y/z` is its centre and `w/h/d` its size, both in BODY coordinates —
 * or, when `lid` is set, in the lid's own frame: `x` across the lid, `y` OUT OF THE SCREEN
 * (negative is the way the display faces) and `z` UP THE LID from the hinge. That frame is the
 * machine SHUT, which is what makes the lid's whole travel `rotation.x = -angle` and nothing else.
 */
export type LaptopSlot = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  /** Rides the lid: placed in lid-local coordinates, premultiplied by the lid's matrix. */
  readonly lid: boolean;
};

const box = (
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): LaptopSlot => ({ name, x, y, z, w, h, d, lid: false });

/** A lid part, written the way a lid is measured: across, up from the hinge, out of the screen. */
const lidBox = (
  name: string,
  x: number,
  up: number,
  out: number,
  w: number,
  h: number,
  t: number,
): LaptopSlot => ({ name, x, y: -out, z: up, w, h: t, d: h, lid: true });

/**
 * Where each named part starts. The ORDER IS THE DROP ORDER — `mesh.count` draws 0..n-1, so
 * everything a smaller tier or the governor's lite step gives up lives at the END, and the
 * chassis, the feet, the hinge, the vent and the lid come first because they are what makes the
 * object a laptop. It is the interior model's table with two changes: the vent takes the slots
 * that machine spends on its front lip (this one is flown out of, not looked at), and its three
 * ports collapse into one strip so the twelve keys still fit inside 29.
 */
export const LAPTOP_SLOT_AT = {
  deck: 0,
  feet: 1, // 1, 2
  hinge: 3, // 3, 4, 5
  vent: 6, // 6, 7, 8 — sill, lintel, hood
  pad: 9,
  rails: 10, // 10..13 — foot, head, left, right (lid)
  cover: 14, // 14, 15 (lid)
  keys: 16, // 16..27 — three rows of four
  port: 28,
} as const;

export const LAPTOP_SLOT_COUNT = 29;
/** Without the port strip (mid), and without the twelve keys either (low, and the governor). */
export const LAPTOP_SLOT_MID = LAPTOP_SLOT_AT.port;
export const LAPTOP_SLOT_LITE = LAPTOP_SLOT_AT.keys;

/** The lid's six pieces are contiguous, so one loop re-places them when the hinge turns. */
const LID_FROM = LAPTOP_SLOT_AT.rails;
const LID_TO = LAPTOP_SLOT_AT.keys;

function buildSlots(): LaptopSlot[] {
  const slots: LaptopSlot[] = [];

  /* 0 — the chassis. One slab: the camera flies down the inside of it, and with front faces
     culled and nothing writing depth it is a glowing outline from without and clear from within. */
  slots.push(box("deck", 0, 0, 0, DECK.w, DECK.t, DECK.d));

  /* 1, 2 — the feet, under the back of the deck */
  for (const side of [-1, 1]) {
    slots.push(
      box(
        side < 0 ? "foot-left" : "foot-right",
        side * FOOT.x,
        -DECK.t / 2 - FOOT.t / 2,
        FOOT.z,
        FOOT.w,
        FOOT.t,
        FOOT.d,
      ),
    );
  }

  /* 3, 4, 5 — the hinge barrels. From inside the cavity they are the band across the top of the
     frame at K2; from outside they are the machine's back edge. */
  for (let i = 0; i < HINGE.at.length; i += 1) {
    slots.push(box(`hinge-${i}`, HINGE.at[i], HINGE.y, HINGE.z, HINGE.w, HINGE.r, HINGE.r));
  }

  /* 6, 7, 8 — the vent: the way out */
  const jaw = VENT.w + VENT_RAIL.over * 2;
  slots.push(
    box(
      "vent-sill",
      VENT.x,
      VENT.y - VENT.h / 2 - SILL_DROP - VENT_RAIL.t / 2,
      VENT.z,
      jaw,
      VENT_RAIL.t,
      VENT_RAIL.d,
    ),
  );
  slots.push(
    box(
      "vent-lintel",
      VENT.x,
      VENT.y + VENT.h / 2 + VENT_RAIL.t / 2,
      VENT.z,
      jaw,
      VENT_RAIL.t,
      VENT_RAIL.d,
    ),
  );
  slots.push(
    box(
      "vent-hood",
      VENT.x,
      VENT.y + VENT.h / 2 + VENT_RAIL.t + HOOD.lift,
      VENT.z - HOOD.back,
      HOOD.w,
      HOOD.t,
      HOOD.d,
    ),
  );

  /* 9 — the trackpad */
  slots.push(box("pad", 0, DECK.t / 2 + PAD.t / 2, PAD.z, PAD.w, PAD.t, PAD.d));

  /* 10..13 — the lid's four rails: the display's own frame — foot, head, left, right */
  slots.push(lidBox("rail-foot", 0, BEZEL.y / 2, -LID.t / 2, LID.w, BEZEL.y, LID.t));
  slots.push(lidBox("rail-head", 0, LID.h - BEZEL.y / 2, -LID.t / 2, LID.w, BEZEL.y, LID.t));
  slots.push(
    lidBox("rail-left", -(LID.w - BEZEL.x) / 2, LID.h / 2, -LID.t / 2, BEZEL.x, LID.h, LID.t),
  );
  slots.push(
    lidBox("rail-right", (LID.w - BEZEL.x) / 2, LID.h / 2, -LID.t / 2, BEZEL.x, LID.h, LID.t),
  );

  /* 14, 15 — the lid's two hinge covers, at its foot beside the rails */
  for (const side of [-1, 1]) {
    slots.push(
      lidBox(
        side < 0 ? "cover-left" : "cover-right",
        side * COVER.x,
        COVER.up,
        -LID.t / 2,
        COVER.w,
        COVER.h,
        LID.t,
      ),
    );
  }

  /* 16..27 — the keys */
  for (let row = 0; row < KEYS.rows.length; row += 1) {
    for (let col = 0; col < KEYS.cols; col += 1) {
      slots.push(
        box(
          `key-${row}-${col}`,
          KEY_X[col],
          DECK.t / 2 + KEYS.t / 2,
          KEYS.rows[row],
          KEYS.w,
          KEYS.t,
          KEYS.d,
        ),
      );
    }
  }

  /* 28 — the port strip, the first thing given up */
  slots.push(box("port", PORT.x, PORT.y, PORT.z, PORT.w, PORT.t, PORT.d));

  return slots;
}

/** The frame, part by part, in drop order. Exported so the unit test can read the table. */
export const LAPTOP_SLOTS: readonly LaptopSlot[] = buildSlots();

/**
 * Pure. A slot's place in the build order, 0 -> 1 — the `aU` the edge material's travelling
 * red-blue band rides, and the reason the geometry has to carry an `InstancedBufferAttribute`
 * (the contract at the top of `./edge.ts`). Strictly increasing, so the band sweeps the machine
 * in the order it was assembled instead of jumping about it.
 */
export function laptopSlotU(slot: number): number {
  return slot / (LAPTOP_SLOT_COUNT - 1);
}

/** How many of the 29 each tier starts with. The governor takes it down from there. */
const TIER_SLOTS: Readonly<Record<IntroTier, number>> = {
  high: LAPTOP_SLOT_COUNT,
  mid: LAPTOP_SLOT_MID,
  low: LAPTOP_SLOT_LITE,
};

/** What the object may cost on the high tier. The glass infinity it replaces costs exactly this. */
export const LAPTOP_DRAW_BUDGET = 6;

/**
 * How much bigger the halo's boxes are than the frame's. A SCALE, not an extrusion along the
 * normal: `position + normal * width` on a box pushes its six faces apart into six detached
 * plates, which is the mistake `./edge.ts` exists to prevent. The halo therefore needs its OWN
 * instance matrices — it shares the geometry (and so the one `aU`), never the matrices.
 */
const HALO_GROW = 1.06;

/* ---- the board ------------------------------------------------------------------------------- */

/**
 * The processor's tracks, and the rib field that carries the power away from it down the cavity.
 * They run on the board, which is the die's own base: the camera flies 0.03 over them at K0 and
 * 0.017 over them at K2, which is what makes beats 1 and 2 read as a canyon rather than a room.
 *
 * DELIBERATELY MINIMAL — under 40 segments and an 8-vertex plate, all of it in ONE buffer. In 3D
 * the inside of the processor is on screen for at most 150 ms and at partial opacity:
 * `.canvasHost` is transparent until `sceneReady`, so beats 1 and 2 belong to the SVG drawing on
 * every device and in every loading case that could be simulated. The detail that earns its bytes
 * is in the chassis, the hinge, the lid and the display, where the camera actually spends its
 * time — and in the ONE frame of the interior anybody does see, K2.
 *
 * Which is why the rib field is 0.9 either side of the centre line and not 0.34. K2 aims down the
 * cavity from 0.018 above the board: at 0.34 the ribs were a thin bright smear on the centre line
 * of an otherwise black frame, and the composition `cameraPath.ts` describes — "the rib field of
 * the board floor across the bottom" — was not true. At 0.9 they run out past the edges of the
 * frame and the floor reads as a floor. Two longitudinal rails tie the field together, so it is a
 * grid in perspective rather than a ladder.
 */
const BOARD_Y = DIE.y - DIE.t / 2;
const TRACE_Y = BOARD_Y + 0.0006;
/** The die's front edge, where the light starts, and how far back the ribs reach. */
const TRACE_FROM = DIE.z + DIE.d / 2;
const TRACE_TO = VENT.z + 0.05;
const RIB_COUNT = 20;
const RIB_HALF = 0.9;
/** The two rails that run the length of the rib field, outboard of the die's own pair. */
const RAIL_X = 0.52;
/**
 * How much brighter the board runs than `createRingMaterial`'s own resting level.
 *
 * That material was written for the ∞'s scan rings, which were the brightest thing in a black
 * frame. Here it draws HAIRLINES — 1px `LineSegments` — a metre away, against an edge-lit chassis
 * that is two orders of magnitude larger on screen, and its resting term is `0.25 * uColor`
 * (the sweep only lifts a narrow travelling band). Measured on `--dark-cyan`, that is 0.14 of
 * linear light spread over one pixel: the rib field was there in every frame of beats 2 and 3 and
 * could not be seen in any of them. The material is NOT changed — the display shares it and shares
 * its calibration — only the strength the board hands it.
 */
const BOARD_GAIN = 3;
/**
 * And the same for the display, for the same reason and with the same restraint: the material is
 * `createRingMaterial` UNCHANGED (it is the ∞'s scan-ring shader, and the ONE thing the whole
 * flight lands on), only the strength it is handed. Its resting term is a quarter of `--dark-cyan`
 * — a dim slate that the cover pane's own reflection sat on top of, so the lid read as one flat
 * card whether the screen was drawing or not. At 2.6 the drawn part is unmistakably a lit screen
 * and the part still to come is unmistakably dark.
 */
const SCREEN_GAIN = 1.9;
/**
 * And a THIRD strength, for the die's plate alone.
 *
 * It is a 0.26 x 0.26 quad and the camera flies 0.03 over it, so for the whole of beats 1 and 2 it
 * is not a chip on a board — it is the FLOOR, filling the lower half of the frame. At the board's
 * own gain it was one unbroken slab of `--dark-cyan`, the exact flat card this rewrite exists to
 * get rid of. At 0.5 it is a dark plate with the bright tracks of `buildTraces` running over it,
 * which is what a processor looks like from a millimetre up. Two materials, still ONE `uFill` and
 * ONE `uHead` written to both, so the power-up is still a single wave across the whole board; the
 * draw-call count does not change (they were always two meshes).
 */
const DIE_GAIN = 0.5;

/** Pure. A point's place along the flow, 0 at the die's front edge -> 1 at the back wall. */
function traceU(z: number): number {
  const t = (TRACE_FROM - z) / (TRACE_FROM - TRACE_TO);
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Pure. 0 at or below `from`, 1 at or above `to`, linear between. NaN reads as 0. */
function ramp(u: number, from: number, to: number): number {
  if (!(u > from)) return 0;
  if (u >= to) return 1;
  return (u - from) / (to - from);
}

/**
 * Pure. The board's power-up, 0 -> 1, for `createRingMaterial`'s `uFill`: the die lights from its
 * front edge and the light runs back down the ribs towards the vent.
 *
 * The window is beat 2's, in flight units. It opens at u 0.075 (progress 0.10 — a little light
 * inside the held frame of beat 1, which otherwise has nothing but drift) and closes at u 0.388,
 * which is progress 0.58 and NOT 0.60: the power-up has to FINISH visibly before the cross-fade
 * from the drawing lands at u 0.40. A ramp that ends on the frame the dissolve starts reads as an
 * effect that was cut off.
 */
export function boardFillAt(u: number): number {
  return ramp(u, 0.075, 0.388);
}

function buildTraces(): { geometry: BufferGeometry; vertices: number; keepVertices: number } {
  const points: number[] = [];
  const us: number[] = [];
  /** A point on the board floor, where a vertex's place in the flow is its z. */
  const at = (x: number, z: number) => {
    points.push(x, TRACE_Y, z);
    us.push(traceU(z));
  };
  const line = (x0: number, z0: number, x1: number, z1: number) => {
    at(x0, z0);
    at(x1, z1);
  };
  /** A point standing up in the vent's plane: the light beyond the hole, not on the floor. */
  const atVent = (x: number, y: number) => {
    points.push(x, y, VENT.z + VENT_RAIL.d / 2);
    // Past the end of the flow, so it is the LAST thing the power-up reaches.
    us.push(1);
  };
  const ventLine = (x0: number, y0: number, x1: number, y1: number) => {
    atVent(x0, y0);
    atVent(x1, y1);
  };

  /* the die: two rows of tracks with the camera's 0.18 canyon between them, three stubs a side */
  const back = DIE.z - DIE.d / 2;
  for (const side of [-1, 1]) {
    line(side * DIE.trace, TRACE_FROM, side * DIE.trace, back);
    for (let i = 0; i < 3; i += 1) {
      const z = TRACE_FROM - 0.05 - i * 0.08;
      line(side * DIE.trace, z, side * (DIE.w / 2 - 0.002), z);
    }
  }

  /* the vent, seen from inside: the aperture the sill and the lintel leave, and three slats
     across it. `cameraPath.ts` asks K2 for "the vent's rectangle of outside light in the left
     third", and on an additively blended object with no depth write there is no such thing as a
     hole — nothing can be occluded, so a way out has to be DRAWN. These seven segments are it,
     and they light last of everything because their `aU` is 1: the power runs out of the die,
     down the ribs and through the hole, in that order and in one wave. */
  const top = VENT.y + VENT.h / 2;
  const floor = VENT.y - VENT.h / 2 - SILL_DROP;
  const left = VENT.x - VENT.w / 2;
  const right = VENT.x + VENT.w / 2;
  ventLine(left, floor, right, floor);
  ventLine(left, top, right, top);
  ventLine(left, floor, left, top);
  ventLine(right, floor, right, top);
  for (let i = 1; i <= 3; i += 1) {
    const y = floor + ((top - floor) * i) / 4;
    ventLine(left, y, right, y);
  }

  // The die's tracks and the vent come FIRST in the buffer: the governor's `setDrawRange` keeps
  // the frame the cross-fade lands on intact and gives up the floor, not the other way round.
  const keepVertices = us.length;

  /* the board: the two die tracks carry on to the back wall, two outboard rails join them, and
     the ribs cross all four */
  for (const side of [-1, 1]) {
    line(side * DIE.trace, back, side * DIE.trace, TRACE_TO);
    line(side * RAIL_X, back - 0.05, side * RAIL_X, TRACE_TO);
  }
  const first = back - 0.05;
  for (let i = 0; i < RIB_COUNT; i += 1) {
    const z = first - (i * (first - TRACE_TO)) / (RIB_COUNT - 1);
    line(-RIB_HALF, z, RIB_HALF, z);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.setAttribute("aU", new Float32BufferAttribute(us, 1));
  return { geometry, vertices: us.length, keepVertices };
}

/* ---- the display ----------------------------------------------------------------------------- */

/**
 * The display, as ONE geometry: the panel, plus the furniture drawn on it.
 *
 * A bare `PlaneGeometry` was enough for the WIPE and not enough for the shot. `createRingMaterial`
 * has no texture and no second colour — every fragment of a lit quad is the same value — so a
 * plain panel is, quite literally, a flat rectangle of `--dark-cyan`, and this is the frame the
 * whole flight lands on. What a screen looks like is not a colour: it is a colour with a frame
 * round it and a few rules across it.
 *
 * So the geometry is the panel quad and nine thin quads on top of it — a four-sided inset frame,
 * four output rules and one block — all in the same buffer and
 * the same draw call, and all additive — so the furniture simply runs brighter than the field it
 * sits on. There are no textures, no loaders and no second material anywhere in this (see the
 * file header); it is the same trick the interior stage's HUD furniture uses, at this scale.
 *
 * `aU` is the vertical coordinate of every vertex, furniture included, which is what keeps them
 * part of the wipe: a rule 30% up the panel draws itself at `uFill` 0.30, not before, so the
 * screen fills in and the interface appears inside the fill rather than switching on over it.
 * The panel's own corners still carry exactly 0 along the bottom edge and exactly 1 along the top.
 */
function buildScreen(): BufferGeometry {
  const points: number[] = [];
  const us: number[] = [];
  const index: number[] = [];
  /** One axis-aligned quad, measured in FRACTIONS of the panel, 0..1 from bottom left. */
  const quad = (x0: number, y0: number, x1: number, y1: number) => {
    const base = us.length;
    for (const [fx, fy] of [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ]) {
      points.push((fx - 0.5) * SCREEN.w, (fy - 0.5) * SCREEN.h, 0);
      us.push(fy);
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  /** A rule across the panel, given its centre height and its thickness in panel fractions. */
  const rule = (x0: number, x1: number, y: number, t: number) => quad(x0, y - t / 2, x1, y + t / 2);

  // The field. First, so its corners are the ones carrying aU 0 and 1.
  quad(0, 0, 1, 1);

  // The inset frame: a hairline 4% in, which is what turns a rectangle of light into a screen.
  const m = 0.04;
  const t = 0.009;
  rule(m, 1 - m, m, t);
  rule(m, 1 - m, 1 - m, t);
  quad(m, m, m + t * (SCREEN.h / SCREEN.w), 1 - m);
  quad(1 - m - t * (SCREEN.h / SCREEN.w), m, 1 - m, 1 - m);

  // Four rules of "output", ragged lengths, low on the panel where the fill reaches them first.
  rule(0.1, 0.62, 0.17, 0.02);
  rule(0.1, 0.44, 0.26, 0.02);
  rule(0.1, 0.71, 0.35, 0.02);
  rule(0.1, 0.3, 0.44, 0.02);
  // And a block up in the corner: the one thing that is not a line, so the eye has a subject.
  quad(0.62, 0.58, 0.9, 0.82);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.setAttribute("aU", new Float32BufferAttribute(us, 1));
  geometry.setIndex(index);
  return geometry;
}

/* ---- the object ------------------------------------------------------------------------------ */

export type IntroLaptop = {
  group: Group;
  update(dt: number, fx: IntroFx): void;
  /** "lite" (FPS governor): no halo, no glass, the keys and the port dropped. Never a material. */
  setLite(lite: boolean): void;
  dispose(): void;
};

function place<T extends Object3D>(object: T, renderOrder: number): T {
  object.renderOrder = renderOrder;
  // The camera flies THROUGH this object, and the instanced frame's bounding sphere is the unit
  // box's rather than the machine's. There are six objects; culling them would be a wrong answer
  // to a question nobody asked.
  object.frustumCulled = false;
  return object;
}

export function createIntroLaptop(tier: IntroTier, palette: IntroPalette): IntroLaptop {
  const config = TIER_CONFIG[tier];
  const group = new Group();
  group.name = "intro-laptop";
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  /* the frame: ONE box, ONE instanced mesh, and its back-face copy */
  const frameGeometry = new BoxGeometry(1, 1, 1);
  geometries.push(frameGeometry);
  // One float per instance, 0 -> 1 in assembly order. `./edge.ts` has no `USE_INSTANCING` guard
  // on purpose, so this has to be on the geometry before the first render or the shader fails
  // loudly — which is the point: a silent failure would stack all 29 boxes on the origin.
  frameGeometry.setAttribute(
    "aU",
    new InstancedBufferAttribute(
      Float32Array.from({ length: LAPTOP_SLOT_COUNT }, (_, i) => laptopSlotU(i)),
      1,
    ),
  );

  const edge = createEdgeMaterial(palette, EDGE);
  materials.push(edge.material);
  const frameMesh = place(new InstancedMesh(frameGeometry, edge.material, LAPTOP_SLOT_COUNT), 3);
  frameMesh.name = "intro-laptop-frame";
  group.add(frameMesh);

  const halo = config.halo ? createEdgeMaterial(palette, EDGE_HALO) : null;
  // Shares the geometry — and so the one `aU` — but never the instance matrices: the halo's are
  // the frame's with the scale grown, and that is the whole trick.
  const haloMesh = halo
    ? place(new InstancedMesh(frameGeometry, halo.material, LAPTOP_SLOT_COUNT), 4)
    : null;
  if (halo && haloMesh) {
    materials.push(halo.material);
    haloMesh.name = "intro-laptop-halo";
    group.add(haloMesh);
  }

  /* the lid: one group on the hinge axis. Its own children ride it; the six frame slots that
     belong to it are written THROUGH its matrix, because the frame is one mesh and one mesh has
     one transform. Six matrices a frame, and only while the hinge is actually turning. */
  const lid = new Group();
  lid.name = "intro-laptop-lid";
  lid.position.set(0, HINGE.y, HINGE.z);
  group.add(lid);

  /* the display: `createRingMaterial` unchanged. `aU` is 0 along the bottom edge and 1 along the
     top, so `step(vU, uFill)` is a vertical wipe running bottom to top as the lid comes up —
     `screenFillAt`'s own direction. */
  const screenGeometry = buildScreen();
  geometries.push(screenGeometry);
  const screen = createRingMaterial(palette);
  materials.push(screen.material);
  const screenMesh = place(new Mesh(screenGeometry, screen.material), 5);
  screenMesh.name = "intro-laptop-screen";
  // The plane's +z becomes the lid's outward normal and its +y runs up the lid. 0.006 proud of
  // the rails, so the display sits IN the lid rather than through it.
  screenMesh.rotation.x = Math.PI / 2;
  screenMesh.position.set(0, -0.006, INTRO_LAPTOP.screenUp);
  lid.add(screenMesh);

  /* the cover glass: the ONLY transmissive surface in the scene. `transmission: 1` re-renders
     everything into a multisampled target every frame, which is why there is one of it, and why
     only the tier that asked for physical glass gets one at all. */
  const glass: MeshPhysicalMaterial | null =
    config.glass === "physical" ? createPhysicalGlass(palette) : null;
  let glassMesh: Mesh | null = null;
  if (glass) {
    // Recalibrated. 0.12 was tuned for a 0.32 solid rod, where it stopped the glass refracting
    // like a cylindrical lens; on a 0.05 slab the same number is thicker than the slab itself.
    glass.thickness = LID.t;
    // THE DISPLAY LIVES INSIDE THIS PANE, so the pane must not write depth.
    //
    // It is the only depth writer in the scene — everything else here is additive with
    // `depthWrite: false` — and it is a 2.4 x 0.05 x 1.5 box whose front face sits 0.044 PROUD of
    // the display. three draws the transmissive list before the transparent one, so the pane laid
    // down depth first and the display then failed the test on every pixel: the lid was a black
    // rectangle for the whole of beats 4 and 5, and the dive ended on a dead screen. Worse, the
    // shut lid hangs directly over the camera through beats 1-3, so it also blacked out the
    // ceiling of the cavity. Nothing reads this depth buffer, so switching it off costs nothing
    // and the additive display, frame and halo composite over the pane the way they should.
    //
    // The pane can never show the display through TRANSMISSION either, whatever the depth does:
    // three renders only the opaque and transmissive lists into the transmission target, and the
    // display is `transparent` (it is additive glow). So the pane refracts the void, and what
    // makes it read as glass is its specular — hence the env intensity below and the strips in
    // `./environment.ts`.
    glass.depthWrite = false;
    glass.envMapIntensity = 1.3;
    materials.push(glass);
    // A PANE, not a slab. `thickness` is a uniform, not a measurement of the geometry, so one
    // quad refracts exactly like the twelve-triangle box did — and it has no UNDERSIDE. The box's
    // bottom face faced down and out, which made it front-facing from inside the chassis: for the
    // whole of beats 2 and 3 a flat 2.4 x 1.5 card of refracted environment hung over the camera
    // and filled a third of the frame with one unbroken colour. A plane facing out of the lid is
    // simply not there when it is seen from behind, which is what a cover pane should do.
    const glassGeometry = new PlaneGeometry(LID.w, LID.h);
    geometries.push(glassGeometry);
    glassMesh = place(new Mesh(glassGeometry, glass), 2);
    glassMesh.name = "intro-laptop-glass";
    // Lid-local, like the display: +z becomes the lid's outward normal, +y runs up the lid.
    glassMesh.rotation.x = Math.PI / 2;
    glassMesh.position.set(0, -LID.t / 2, LID.h / 2);
    lid.add(glassMesh);
  }

  /* the board: the die's plate and its tracks, ONE material between them, so a single `uFill`
     runs the light from the processor out along the ribs as one wave */
  const board = createRingMaterial(palette);
  const plate = createRingMaterial(palette);
  materials.push(board.material, plate.material);
  const dieGeometry = new PlaneGeometry(DIE.w, DIE.d, 1, 3);
  geometries.push(dieGeometry);
  const diePosition = dieGeometry.getAttribute("position");
  const dieU = new Float32Array(diePosition.count);
  // The plate lies flat (its +y becomes -z), so a vertex's place in the flow is its world z.
  for (let i = 0; i < diePosition.count; i += 1) dieU[i] = traceU(DIE.z - diePosition.getY(i));
  dieGeometry.setAttribute("aU", new Float32BufferAttribute(dieU, 1));
  const dieMesh = place(new Mesh(dieGeometry, plate.material), 1);
  dieMesh.name = "intro-laptop-die";
  dieMesh.rotation.x = -Math.PI / 2;
  dieMesh.position.set(DIE.x, DIE.y + DIE.t / 2, DIE.z);
  group.add(dieMesh);

  const traces = buildTraces();
  geometries.push(traces.geometry);
  const traceMesh = place(new LineSegments(traces.geometry, board.material), 1);
  traceMesh.name = "intro-laptop-traces";
  group.add(traceMesh);

  /* ---- the matrices ------------------------------------------------------------------------ */

  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const turn = new Quaternion();

  /** One slot into both meshes: the frame's box, and the halo's 6% larger copy of it. */
  const writeSlot = (slot: number, through?: Matrix4) => {
    const part = LAPTOP_SLOTS[slot];
    position.set(part.x, part.y, part.z);
    scale.set(part.w, part.h, part.d);
    matrix.compose(position, turn, scale);
    if (through) matrix.premultiply(through);
    frameMesh.setMatrixAt(slot, matrix);
    if (!haloMesh) return;
    // Grown about its OWN centre — `compose` scales before it translates — so the halo is a soft
    // edge on each piece and not a second machine with its parts pushed outwards.
    scale.multiplyScalar(HALO_GROW);
    matrix.compose(position, turn, scale);
    if (through) matrix.premultiply(through);
    haloMesh.setMatrixAt(slot, matrix);
  };

  /** The six pieces that ride the lid, re-placed through the hinge's matrix. */
  const writeLid = () => {
    lid.updateMatrix();
    for (let slot = LID_FROM; slot < LID_TO; slot += 1) writeSlot(slot, lid.matrix);
    frameMesh.instanceMatrix.needsUpdate = true;
    if (haloMesh) haloMesh.instanceMatrix.needsUpdate = true;
  };

  turn.identity();
  // The body's 23 boxes are written once, here, and never again.
  for (let slot = 0; slot < LAPTOP_SLOT_COUNT; slot += 1) {
    if (slot < LID_FROM || slot >= LID_TO) writeSlot(slot);
  }
  writeLid();

  const shown = TIER_SLOTS[tier];
  frameMesh.count = shown;
  if (haloMesh) haloMesh.count = shown;

  let time = 0;
  let head = 0;
  let angle = 0;
  /** The governor's last word. `update` and `setLite` both decide the pane's visibility. */
  let lite = false;

  return {
    group,

    update(dt, fx) {
      const step = Math.min(Math.max(dt, 0), MAX_FRAME_STEP);
      time += step;
      // The sweep that follows the fill speeds up with the counter — the comet's idiom.
      head = (head + step * (0.22 + fx.progress * 0.55)) % 1;
      const u = fx.flight;

      const glow = 1 + fx.progress * 0.7 + fx.pulse * 1.1 + fx.flash * 1.3;
      edge.uniforms.uTime.value = time;
      edge.uniforms.uIntensity.value = glow;
      // White-hot, not white-out: the DOM flash layer above the canvas does the white-out.
      edge.uniforms.uFlash.value = fx.flash * 0.75;

      if (halo) {
        halo.uniforms.uTime.value = time;
        // Inside the chassis a halo is a flat wash on the walls, so it stays down until the
        // camera is out through the vent and comes up as the machine is finally seen whole.
        halo.uniforms.uIntensity.value = glow * (0.25 + 0.75 * ramp(u, 0.45, 0.7));
        halo.uniforms.uFlash.value = fx.flash * 0.4;
      }

      // The hinge. `lidOpenAt` is `laptopBootLid`'s back-out ease to the constant, so the intro
      // machine and the interior one open the same way.
      const next = -lidOpenAt(u) * LID.open;
      if (next !== angle) {
        angle = next;
        lid.rotation.x = next;
        writeLid();
      }

      // THE PANE ONLY EXISTS ONCE THE LID IS MOVING. Shut, the lid lies face DOWN over the deck,
      // so the cover pane faces into the cavity the camera is flying along: a 2.4 x 1.5 card of
      // flat refracted environment, square across a third of the frame, through the whole of
      // beats 2 and 3 — the exact "flat neon card" the rest of this file exists to get away from.
      // It is also the one object in the scene that costs a full extra render of everything
      // (`transmission: 1`), and beats 1-3 are where the frame budget is tightest.
      //
      // `visible`, never a material swap — the same rule `setLite` follows. The pane IS visible
      // when the scene compiles (`useSceneReady` runs before the first frame, and three's
      // `compileAsync` walks `traverseVisible`), so its program is built up front and coming back
      // on at u 0.62 re-uses it. Turning it on at the top of the lid's travel is also invisible:
      // from K3, behind the machine, the pane is facing away.
      if (glassMesh) glassMesh.visible = !lite && next !== 0;

      screen.uniforms.uFill.value = screenFillAt(u);
      screen.uniforms.uHead.value = head;
      // The dive ends ON the display, so it goes hot with the flash instead of fading out.
      screen.uniforms.uStrength.value = SCREEN_GAIN * (1 + fx.flash * 1.2);

      const boardFill = boardFillAt(u);
      // Half a machine away and behind the camera by beat 4: it stops paying for itself.
      const boardFade = 1 - Math.min(1, fx.burst * 1.6);
      board.uniforms.uFill.value = boardFill;
      board.uniforms.uHead.value = head;
      board.uniforms.uStrength.value = BOARD_GAIN * boardFade;
      plate.uniforms.uFill.value = boardFill;
      plate.uniforms.uHead.value = head;
      plate.uniforms.uStrength.value = DIE_GAIN * boardFade;

      if (glass) {
        // Stays above 0, so the iridescence define never toggles (no shader recompile).
        //
        // A THIRD of what the ∞ ran. Iridescence is an angle-dependent tint, and on a tube every
        // fragment has its own angle, so it shimmered. This pane is FLAT and fills the lid: one
        // angle, one tint, and at 0.45 the whole display came out a flat slate teal that sat over
        // the screen whether the screen was drawing or not. The lid read as a coloured card.
        glass.iridescence = 0.18 + fx.pulse * 0.2;
      }
    },

    setLite(next) {
      // `count`, `visible` and `setDrawRange` ONLY. Swapping a material here would compile a
      // shader in the middle of the cinematic, which is the one thing the governor exists to
      // prevent.
      lite = next;
      const count = lite ? Math.min(shown, LAPTOP_SLOT_LITE) : shown;
      frameMesh.count = count;
      if (haloMesh) {
        haloMesh.count = count;
        haloMesh.visible = !lite;
      }
      if (glassMesh) glassMesh.visible = !lite;
      traces.geometry.setDrawRange(0, lite ? traces.keepVertices : traces.vertices);
    },

    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      frameMesh.dispose();
      haloMesh?.dispose();
    },
  };
}
