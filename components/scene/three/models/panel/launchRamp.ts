/**
 * «Rampa» — the departure. Benefit panel 3, "launch".
 *
 * Two short RAIL MARKS lie in the lower left with a gap between them — a runway that stops, not
 * a line across the panel. A MAST stands at their left end with a small square HEAD: the thing
 * that watches. One SLAB runs up the marks, noses off the end and leaves on a diagonal, turning
 * into its own travel direction so it is always a streak and never a blob, shrinking and
 * receding as it goes, with a single WAKE streak behind it. It crosses the whole middle of the
 * strip on a long diagonal and comes to rest on the collar of a FAR POST — which stands in
 * the right half of every frame, flight or no flight. Then the departed thing answers and the
 * head, back at the origin, takes the loop's one accent.
 *
 * This is the reduced object, and what was cut is the point of it. As first specified its whole
 * story lived in three 8 x 2.4 px chips riding crossing Bezier curves in the top third of a
 * 62 px band — under the size at which anything exists, over a bright additive smudge where the
 * two curves met. So: **no return curve, no chip pair, no wake pair, no stud, no parked second
 * slab, and no third base rule** — `surveyField` owns the row's continuous rule and `panelFit`
 * owns its closed rectangle, and three horizontal rules at the same y would have read as one
 * dashed line running the width of the section.
 *
 * "Măsurabil" is carried by the head *receiving* something, not by chips returning: the
 * departure is drawn, the answer is a beat. Nothing here is red — red is this repo's refusal
 * role, and a launch panel flashing red says "error".
 *
 * 1 draw call. 8 instances at high (mast stem and head, slab, lip mark, far post, collar, back
 * mark, wake), 7 at mid, 6 in lite — the tail is the wake and the back rail mark, so the mast,
 * the slab, the mark it leaves from and the post it arrives at survive every tier.
 */

import { Color, Group, Quaternion, Vector3 } from "three";
import { easeOutCubic, smoothstep } from "../../../choreography";
import type { SceneTierConfig } from "../../../tiers";
import type { ScenePalette } from "../../palette";
import type { ModelFrame, PanelModel } from "../types";
import {
  STROKE,
  acquirePanelKit,
  createPanelWriter,
  easeInOut,
  flare,
  lerp,
  panelSway,
  panelYaw,
  ramp,
} from "./kit";

/* ---- the clock ------------------------------------------------------------------------------ */

/** The longest of the row's three periods (3.60 / 4.20 / 4.80, lcm 100.8 s). */
export const RAMP_LOOP = 4.8;

/**
 * The clock opens deep in the loop, never at 0 — the still pose: the slab small and high in the
 * upper right, lying across the far post's collar, the collar still lit from taking it, the mast
 * head still warm from answering, the runway at rest. "Something left, it got there, and the
 * origin was told" — with nothing moving.
 */
export const RAMP_START = 4.05;

/** 61% of the loop. On the wall clock the row's three accents are never closer than 0.35 s. */
export const RAMP_ACCENT = 2.95;

/** The slab leaves the marks here; the lip mark flares as it goes. */
const RELEASE = 0.71;
/**
 * The climb runs long on purpose. Cut short it left the slab a speck in the corner for half the
 * loop and the middle of the strip dead; ending at 2.40 puts the arrival 0.55 s before the head
 * takes the accent, which is what makes the accent read as *reception* and not as a blink.
 */
const CLIMB_TO = 2.4;
/** The departed slab fades out, then re-enters behind the mast so the wrap is seamless. */
const GONE = { from: 4.2, to: 4.45 } as const;
const RETURN_AT = 4.45;

/* ---- the ramp ------------------------------------------------------------------------------- */

const RAIL_Y = -0.3;
/** Two marks with a gap of 0.30 units (~20 px): a runway that stops, not a rule. */
const MARKS: ReadonlyArray<number> = [-0.4, -1.1];
const MARK = { w: 0.4, d: 0.2 } as const;

const MAST_X = -1.6;
const STEM = { h: 0.42, y: -0.11 } as const;
/** Square on purpose: no ring, no disc, nothing round anywhere in the row. */
const HEAD = { side: 0.16, y: 0.18 } as const;

/**
 * The far post and its collar — the thing the slab departs towards and comes to rest on,
 * standing in the right half of every single frame.
 *
 * Two boxes, not three. A post, an arm and a separate berth block put three parts inside a
 * 40 x 20 px corner and turned into exactly the bloom soup this row was warned about; a tall
 * vertical with one short arm cantilevered back towards the flight reads at a glance, and the
 * arriving slab lying across the arm is the berth.
 *
 * It cannot be mistaken for the row's other devices: its long member is VERTICAL, so it is not
 * a second base rule, and its one horizontal is 24 px and sits high, where nothing else in the
 * row has a horizontal. It is an open corner, three sides short of `panelFit`'s closed
 * rectangle. And it is not the mast repeated — taller, no head, and its arm reaches back
 * towards where the slab is coming from instead of standing on top.
 */
const POST = { x: 1.6, h: 0.66, y: 0.01, d: 0.1 } as const;
const COLLAR = { x: 1.43, w: 0.36, y: 0.18, d: 0.16 } as const;

const SLAB = { len: 0.3, h: 0.18, d: 0.07 } as const;
const RIDE_Y = RAIL_Y + STROKE / 2 + SLAB.h / 2;
const RUN = { from: -1.1, to: -0.15 } as const;
/** Behind the mast, where a fresh slab appears and slides onto the marks. */
const BEHIND = -1.55;

/**
 * The climb: shallow, then steep, receding in z as it shrinks, so "away" is said twice. It
 * crosses the whole middle of the strip — 100 px of diagonal — and flattens out at the end so
 * the slab arrives along the collar rather than stabbing into it.
 */
const CURVE = [
  { x: RUN.to, y: RIDE_Y, z: 0.02 },
  { x: 0.7, y: 0.02, z: -0.04 },
  { x: 1.35, y: 0.26, z: -0.1 },
] as const;

const SLOT = { stem: 0, head: 1, slab: 2, lip: 3, post: 4, collar: 5, back: 6, wake: 7 } as const;
const SLOT_COUNT = 8;

const POSE = { x: 0.12, y: 0.38, z: 0 } as const;
const OWN_YAW_PERIOD = 7.9;

const UNIT_X = new Vector3(1, 0, 0);

/* ---- pure clock ----------------------------------------------------------------------------- */

export type RampSlab = {
  x: number;
  y: number;
  z: number;
  /** Along its travel direction. */
  dx: number;
  dy: number;
  dz: number;
  /** 1 at the rail, 0 once it has faded out of the corner. */
  scale: number;
  /** 0..1 along the climb; -1 while it is still on the marks or coming back in. */
  climb: number;
  /** 0 invisible → 1 fully lit. */
  show: number;
};

function bezier2(a: number, b: number, c: number, t: number): number {
  const s = 1 - t;
  return s * s * a + 2 * s * t * b + t * t * c;
}

function bezier2d(a: number, b: number, c: number, t: number): number {
  return 2 * (1 - t) * (b - a) + 2 * t * (c - b);
}

/** Pure. A point on the climb, with its tangent, at `a` in [0, 1]. */
export function rampClimbAt(a: number, out: RampSlab): RampSlab {
  const [p0, p1, p2] = CURVE;
  out.x = bezier2(p0.x, p1.x, p2.x, a);
  out.y = bezier2(p0.y, p1.y, p2.y, a);
  out.z = bezier2(p0.z, p1.z, p2.z, a);
  out.dx = bezier2d(p0.x, p1.x, p2.x, a);
  out.dy = bezier2d(p0.y, p1.y, p2.y, a);
  out.dz = bezier2d(p0.z, p1.z, p2.z, a);
  return out;
}

/** Pure. The slab at `t`: run-up, climb, the long recede, and the slide back in behind the mast. */
export function rampSlabAt(t: number, out: RampSlab): RampSlab {
  out.dx = 1;
  out.dy = 0;
  out.dz = 0;
  out.climb = -1;
  out.scale = 1;
  out.show = 1;
  if (t >= RETURN_AT) {
    // A fresh slab brightens in behind the mast and stops on the marks with zero velocity, so
    // 4.80 lands exactly where 0.00 starts.
    const a = easeOutCubic(ramp(t, RETURN_AT, RAMP_LOOP));
    out.x = lerp(BEHIND, RUN.from, a);
    out.y = RIDE_Y;
    out.z = CURVE[0].z;
    out.show = smoothstep(RETURN_AT, RETURN_AT + 0.25, t);
    return out;
  }
  if (t < RELEASE) {
    // accelerating out of the mast's shadow: x^3, so the run-up has no start transient
    const p = t / RELEASE;
    out.x = lerp(RUN.from, RUN.to, p * p * p);
    out.y = RIDE_Y;
    out.z = CURVE[0].z;
    return out;
  }
  const a = easeInOut(ramp(t, RELEASE, CLIMB_TO));
  rampClimbAt(a, out);
  out.climb = a;
  // It shrinks, but not below the size at which it still exists: at 0.70 the parked slab is
  // ~14 x 8 px in the upper right, which is the only thing holding the right half of the strip
  // for the second half of the loop.
  out.scale = lerp(1, 0.7, a);
  out.show = 1 - ramp(t, GONE.from, GONE.to);
  return out;
}

/**
 * Pure. The loop's one accent: the head at 2.95 s, the only instance in the object that ever
 * crosses the shader's hot threshold, decaying to an ember by 3.60.
 */
export function rampAccentAt(t: number): number {
  return smoothstep(RAMP_ACCENT - 0.35, RAMP_ACCENT, t) * (1 - smoothstep(RAMP_ACCENT, 3.6, t));
}

/** Pure. The departed thing answering, just before the head receives it. */
export function rampAnswerAt(t: number): number {
  return flare(t, RAMP_ACCENT - 0.15, 0.1);
}

/** Pure. The lip mark's flare as the slab leaves it. */
export function rampReleaseAt(t: number): number {
  return flare(t, RELEASE, 0.09);
}

/**
 * Pure. The collar takes the slab at 2.40 and holds it warm through the still pose, letting go
 * only as the next slab comes in behind the mast. It reaches `lit` and never past it — the head
 * keeps the object's single hot edge.
 */
export function rampDockAt(t: number): number {
  return smoothstep(CLIMB_TO - 0.12, CLIMB_TO + 0.06, t) * (1 - smoothstep(4.3, 4.75, t));
}

/* ---- the model ------------------------------------------------------------------------------ */

export function createLaunchRampModel(config: SceneTierConfig, palette: ScenePalette): PanelModel {
  const group = new Group();
  group.name = "scene-panel-launch-ramp";
  const pose = new Group();
  pose.rotation.set(POSE.x, POSE.y, POSE.z);
  group.add(pose);

  const kit = acquirePanelKit(palette);
  const writer = createPanelWriter(kit, SLOT_COUNT, 6);
  pose.add(writer.mesh);

  const tint = new Color();
  const dir = new Vector3();
  const turn = new Quaternion();
  const slab: RampSlab = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, scale: 1, climb: -1, show: 1 };
  const wake: RampSlab = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, scale: 1, climb: -1, show: 1 };
  const full = config.uiCards > 2 ? SLOT_COUNT : SLOT_COUNT - 1;
  let shown = full;
  let clock = RAMP_START;
  writer.mesh.count = shown;

  /** A travelling box: a streak along its own direction, never a square. */
  const aim = (dx: number, dy: number, dz: number) => {
    dir.set(dx, dy, dz);
    if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
    turn.setFromUnitVectors(UNIT_X, dir.normalize());
    writer.turn.copy(turn);
  };

  const write = () => {
    const t = clock;
    const g = kit.gain;
    const heat = rampAccentAt(t);
    const answer = rampAnswerAt(t);
    const lip = rampReleaseAt(t);

    /* the mast: the thing that watches, and the one instance that ever reaches `accent` */
    writer.position.set(MAST_X, STEM.y, -0.02);
    writer.scale.set(STROKE, STEM.h, STROKE);
    writer.turn.identity();
    writer.write(SLOT.stem, kit.blue, lerp(g.rest, g.lit, heat));

    writer.position.set(MAST_X, HEAD.y, 0.02);
    writer.scale.set(HEAD.side, HEAD.side, HEAD.side);
    writer.turn.identity();
    writer.write(SLOT.head, kit.cyan, lerp(g.body, g.accent, heat));

    /* the slab */
    rampSlabAt(t, slab);
    aim(slab.dx, slab.dy, slab.dz);
    writer.position.set(slab.x, slab.y, slab.z);
    writer.scale.set(SLAB.len * slab.scale, SLAB.h * slab.scale, SLAB.d * slab.scale);
    const parked = slab.climb >= 0 ? ramp(t, CLIMB_TO, 3.8) * 0.6 : 0;
    tint.copy(kit.cyan);
    writer.write(SLOT.slab, tint, lerp(lerp(g.body, g.rest, parked), g.lit, answer) * slab.show);

    /* the far post: the thing it departs towards, standing in the right half of every frame.
       An open corner — a post and a cantilevered arm — never a closed rectangle, and its one
       horizontal is short and at the top, so it can never read as a second base rule. */
    const dock = rampDockAt(t);
    writer.position.set(POST.x, POST.y, -0.02);
    writer.scale.set(STROKE, POST.h, POST.d);
    writer.turn.identity();
    writer.write(SLOT.post, kit.blue, lerp(g.rest, g.body, dock));

    writer.position.set(COLLAR.x, COLLAR.y, 0.01);
    writer.scale.set(COLLAR.w, STROKE, COLLAR.d);
    writer.turn.identity();
    writer.write(SLOT.collar, kit.cyan, lerp(g.rest, g.lit, dock));

    /* the rail marks: a runway that stops, and the lip it leaves from */
    for (let i = 0; i < MARKS.length; i += 1) {
      const slotIndex = i === 0 ? SLOT.lip : SLOT.back;
      if (slotIndex >= shown) {
        writer.hide(slotIndex);
        continue;
      }
      writer.position.set(MARKS[i], RAIL_Y, 0);
      writer.scale.set(MARK.w, STROKE, MARK.d);
      writer.turn.identity();
      writer.write(slotIndex, kit.blue, i === 0 ? lerp(g.rest, g.lit, lip) : g.rest);
    }

    /* one wake streak, 1.6x stretched along travel, dying with the climb */
    if (SLOT.wake >= shown || slab.climb < 0) {
      writer.hide(SLOT.wake);
    } else {
      const a = slab.climb - 0.09;
      if (a <= 0) {
        writer.hide(SLOT.wake);
      } else {
        rampClimbAt(a, wake);
        aim(wake.dx, wake.dy, wake.dz);
        writer.position.set(wake.x, wake.y, wake.z);
        const s = slab.scale;
        writer.scale.set(SLAB.len * 1.6 * s, SLAB.h * 0.6 * s, SLAB.d * 0.6 * s);
        writer.write(SLOT.wake, kit.blue, g.body * (1 - slab.climb) * slab.show);
      }
    }

    writer.flush();
  };

  // The composed pose, written before the first frame: the loop never opens at 0.
  write();

  return {
    group,
    objects: [group],

    update(frame: ModelFrame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      while (clock >= RAMP_LOOP) clock -= RAMP_LOOP;
      write();

      kit.uniforms.uTime.value = frame.time;
      kit.uniforms.uReveal.value = frame.reveal;

      // `frame.tx` / `frame.ty` ignored: the panel already answers the mouse in CSS.
      pose.rotation.set(POSE.x, POSE.y - panelSway(frame.time) + panelYaw(frame.time, OWN_YAW_PERIOD), POSE.z);
    },

    setLite(lite: boolean) {
      shown = lite ? Math.min(6, full) : full;
      writer.mesh.count = shown;
    },

    setPalette(next: ScenePalette) {
      kit.setPalette(next);
      write();
    },

    dispose() {
      writer.mesh.dispose();
      kit.release();
    },
  };
}
