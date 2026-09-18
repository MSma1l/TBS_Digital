/**
 * «Montajul de probă» — the trial fit-up. Benefit panel 2, "build".
 *
 * A closed rectangular FRAME stands on a short PLINTH with three sockets along its floor. Two
 * parts are already seated; a third rides in on an arc from the left, stops **proud** of its
 * socket, goes red, is lifted, levelled and seated properly. A JAW closes on the frame, and a
 * PRESS comes down on the corrected socket and lifts again. A piece is fitted, and a machine is
 * run over it.
 *
 * This object owns the row's only **closed rectangle** — which is what makes it look like
 * equipment rather than a diagram, and what the panels on either side deliberately do not have.
 * It does not own a base rule: the plinth is the frame's footprint plus the jaw's travel, so it
 * stops well short of the strip's width and never lines up with `surveyField`'s rail, which is
 * lower and runs edge to edge. And its test is a **vertical press**, not a sweep — a second
 * bright bar traversing left to right at the same scale as the survey bar next door would make
 * the two panels one object repeated.
 *
 * 1 draw call. 10 instances at high, 8 at mid, 7 in lite (the tail is part C, the jaw and part
 * A, in that order) — 15 boxes in a 62 px strip is a box every 10 px and turns to bloom soup.
 *
 * Red is used for exactly one box for 0.60 s and nothing else in the row touches it: red is
 * this repo's refusal role (the bench's dead-letter, the failed write), and the whole point of
 * this loop is that the misfit is a refusal that gets corrected.
 */

import { Color, Euler, Group } from "three";
import { easeOutCubic } from "../../../choreography";
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
  pulse,
  ramp,
} from "./kit";

/* ---- the clock ------------------------------------------------------------------------------ */

/** The row's middle period (3.60 / 4.20 / 4.80). */
export const FIT_LOOP = 4.2;

/**
 * `t = 0` **is** the composed pose here, unlike the five service models: the first frame shows
 * the part a third of the way down its arc, the frame full, the jaw open. No offset is needed
 * because the composed pose is a mid-arc frame rather than a mid-story one.
 */
export const FIT_START = 0;

/** 54% of the loop, dead centre of the strip. */
export const FIT_ACCENT = 2.26;

/** The arc is defined over [-0.25, 0.55] and evaluated with the wrap, so 4.20 is C1. */
const ARC = { from: -0.25, to: 0.55 } as const;
const MISFIT = { at: 0.55, red: 0.67, still: 0.8 } as const;
const SEAT = { lift: 0.8, top: 0.92, down: 1.15, clear: 1.15 } as const;
const CLAMP = { at: 1.15, shut: 1.55 } as const;
const PRESS = { down: 1.55, hold: 2.44, up: 2.95 } as const;
const PASS = { from: 2.95, to: 3.3 } as const;
const RESET = { leave: 3.75, gone: 3.87, enter: 3.95 } as const;

/* ---- the bench ------------------------------------------------------------------------------ */

/**
 * The frame: a closed rectangle, centred on the strip, so the object's persistent mass sits in
 * the middle of the box rather than pushed to one side. The arc that feeds it runs in from off
 * the left edge — a part arriving from outside the frame is natural, an empty left half is not.
 */
const FRAME = { x0: -0.8, x1: 1, y0: -0.31, y1: 0.29, z: -0.04, d: 0.22 } as const;
const FRAME_X = (FRAME.x0 + FRAME.x1) / 2;
const FRAME_Y = (FRAME.y0 + FRAME.y1) / 2;
/** The sockets' floor: the top face of the bottom rail. */
const FLOOR = FRAME.y0 + STROKE / 2;

/** Three deliberately different proportions — wide-flat, near-cube, long-flat — so the sockets
 *  read as three different pieces and not as a ruler. */
const PART = {
  a: { x: -0.5, w: 0.36, h: 0.15, d: 0.2 },
  b: { x: 0.1, w: 0.24, h: 0.21, d: 0.2 },
  c: { x: 0.7, w: 0.42, h: 0.12, d: 0.2 },
} as const;

const SEAT_Y = FLOOR + PART.b.h / 2;
/** 0.26 units ~ 17 px. The spec's 0.16 was 6 px and did not read as a gap at all. */
const PROUD = 0.26;

const JAW = { open: -1.145, shut: -0.885, w: 0.1, h: 0.36, d: 0.24 } as const;

/**
 * The frame's footprint plus the jaw's travel — never the width of the object, and 0.08 units
 * (~5 px) below `surveyField`'s rail, so the two panels' horizontals do not line up into one
 * dashed line running the width of the section.
 */
const PLINTH = {
  x: (JAW.open - JAW.w / 2 + FRAME.x1 + STROKE / 2 + 0.1) / 2,
  w: FRAME.x1 + STROKE / 2 + 0.1 - (JAW.open - JAW.w / 2),
  y: FRAME.y0 - STROKE,
  d: 0.34,
} as const;

/** The press: in front of the frame in z, so it comes down over the opening. Its lowest centre
 *  puts its bottom face exactly on part B's top face. */
const PRESS_H = 0.26;
const PRESS_BOX = { h: PRESS_H, d: 0.1, z: 0.16, up: 0.27, tip: SEAT_Y + PART.b.h / 2 + PRESS_H / 2 } as const;

/** The arc part B rides in on: shallow, from the upper left, ending proud of its socket. */
const ARC_P0 = { x: -1.8, y: 0.28 };
const ARC_P1 = { x: -0.9, y: 0.32 };
const ARC_P2 = { x: PART.b.x, y: SEAT_Y + PROUD };

const SLOT = {
  plinth: 0,
  rails: 1,
  b: 5,
  press: 6,
  a: 7,
  c: 8,
  jaw: 9,
} as const;
const SLOT_COUNT = 10;

const POSE = { x: 0.16, y: -0.22, z: 0 } as const;
const OWN_YAW_PERIOD = 6.7;

/* ---- pure clock ----------------------------------------------------------------------------- */

export type FitPart = { x: number; y: number; yaw: number; fault: number; scale: number };

function bezier2(a: number, b: number, c: number, t: number): number {
  const s = 1 - t;
  return s * s * a + 2 * s * t * b + t * t * c;
}

/** Pure. Part B at `t`: where it is, how far it has turned, and how refused it is. */
export function fitPartAt(t: number, out: FitPart): FitPart {
  out.fault = 0;
  out.scale = 1;
  // The arc lives on [-0.25, 0.55] of the loop's own clock: the tail before 0 is where a fresh
  // part enters, so 4.20 lands exactly on the composed pose and the wrap is C1.
  const riding = t >= RESET.enter || t < MISFIT.at;
  if (riding) {
    const a = ramp(t >= RESET.enter ? t - FIT_LOOP : t, ARC.from, ARC.to);
    const p = easeInOut(a);
    out.x = bezier2(ARC_P0.x, ARC_P1.x, ARC_P2.x, p);
    out.y = bezier2(ARC_P0.y, ARC_P1.y, ARC_P2.y, p);
    out.yaw = lerp(0.5, 0.09, easeOutCubic(a));
    return out;
  }
  out.x = PART.b.x;
  if (t < SEAT.lift) {
    // proud, refused, and for 0.13 s dead still — the only frozen beat, and what makes the
    // correction read as a decision rather than as a bounce
    const shiver = t < MISFIT.still ? Math.sin(t * 46) * 0.01 : 0;
    out.y = ARC_P2.y + shiver;
    out.yaw = 0.09;
    out.fault = ramp(t, MISFIT.at, MISFIT.red);
    return out;
  }
  if (t < SEAT.down) {
    const up = easeOutCubic(ramp(t, SEAT.lift, SEAT.top));
    const down = easeOutCubic(ramp(t, SEAT.top, SEAT.down));
    out.y = lerp(lerp(ARC_P2.y, ARC_P2.y + 0.1, up), SEAT_Y, down);
    out.yaw = lerp(0.09, 0, up);
    out.fault = 1 - ramp(t, 0.95, SEAT.clear);
    return out;
  }
  out.y = SEAT_Y;
  out.yaw = 0;
  if (t >= RESET.leave) out.scale = 1 - ramp(t, RESET.leave, RESET.gone);
  return out;
}

/** Pure. The press's centre y — a vertical press, never a sweep. */
export function fitPressY(t: number): number {
  const down = easeInOut(ramp(t, PRESS.down, FIT_ACCENT));
  const up = easeInOut(ramp(t, PRESS.hold, PRESS.up));
  return lerp(lerp(PRESS_BOX.up, PRESS_BOX.tip, down), PRESS_BOX.up, up);
}

/** Pure. The jaw's x: it closes on the seated work, eases 30% open, then lets go at the reset. */
export function fitJawX(t: number): number {
  const travel = JAW.shut - JAW.open;
  const shut = easeInOut(ramp(t, CLAMP.at, CLAMP.shut));
  const ease = easeInOut(ramp(t, PASS.from, PASS.to)) * 0.3;
  const open = easeInOut(ramp(t, RESET.leave, FIT_LOOP));
  return lerp(lerp(JAW.open, JAW.shut - travel * ease, shut), JAW.open, open);
}

/** Pure. The loop's one accent: the press over the corrected socket, at 2.26 s. */
export function fitAccentAt(t: number): number {
  return flare(t, FIT_ACCENT, 0.11);
}

/* ---- the model ------------------------------------------------------------------------------ */

export function createPanelFitModel(config: SceneTierConfig, palette: ScenePalette): PanelModel {
  const group = new Group();
  group.name = "scene-panel-fit";
  const pose = new Group();
  pose.rotation.set(POSE.x, POSE.y, POSE.z);
  group.add(pose);

  const kit = acquirePanelKit(palette);
  const writer = createPanelWriter(kit, SLOT_COUNT, 6);
  pose.add(writer.mesh);

  const tint = new Color();
  const euler = new Euler();
  const part: FitPart = { x: 0, y: 0, yaw: 0, fault: 0, scale: 1 };
  const full = config.uiCards > 2 ? SLOT_COUNT : SLOT_COUNT - 2;
  let shown = full;
  let clock = FIT_START;
  writer.mesh.count = shown;

  const rails: ReadonlyArray<readonly [number, number, number, number]> = [
    [FRAME_X, FRAME.y1, FRAME.x1 - FRAME.x0 + STROKE, STROKE],
    [FRAME_X, FRAME.y0, FRAME.x1 - FRAME.x0 + STROKE, STROKE],
    [FRAME.x0, FRAME_Y, STROKE, FRAME.y1 - FRAME.y0],
    [FRAME.x1, FRAME_Y, STROKE, FRAME.y1 - FRAME.y0],
  ];

  const writeSeated = (slot: number, box: { x: number; w: number; h: number; d: number }, gain: number) => {
    writer.position.set(box.x, FLOOR + box.h / 2, 0);
    writer.scale.set(box.w, box.h, box.d);
    writer.turn.identity();
    writer.write(slot, kit.cyan, gain);
  };

  const write = () => {
    const t = clock;
    const g = kit.gain;
    const accent = fitAccentAt(t);
    const held = pulse(t, PASS.from, PASS.to, 0.1);
    const railGain = lerp(g.rest, g.lit, Math.max(accent, held));
    const clamped = pulse(t, CLAMP.shut, PASS.from, 0.08);

    /* the plinth: the frame's footing, at its own y — not the row's base rule */
    writer.position.set(PLINTH.x, PLINTH.y, FRAME.z + 0.02);
    writer.scale.set(PLINTH.w, STROKE, PLINTH.d);
    writer.turn.identity();
    writer.write(SLOT.plinth, kit.blue, g.rest);

    /* the closed rectangle */
    for (let i = 0; i < rails.length; i += 1) {
      const [x, y, w, h] = rails[i];
      writer.position.set(x, y, FRAME.z);
      writer.scale.set(w, h, FRAME.d);
      writer.turn.identity();
      writer.write(SLOT.rails + i, kit.blue, railGain);
    }

    /* part B — the tried one, and the only box in the row that is ever red */
    fitPartAt(t, part);
    writer.position.set(part.x, part.y, 0);
    writer.scale.set(PART.b.w * part.scale, PART.b.h * part.scale, PART.b.d * part.scale);
    writer.turn.setFromEuler(euler.set(0, part.yaw, 0));
    tint.copy(kit.cyan).lerp(kit.red, part.fault);
    // The seat flash tops out at `lit`, not past it: the press at 2.26 keeps the object's only
    // hot edge, which is the whole reason `lit` sits under the shader's 1.2 threshold.
    const seatFlash = t >= SEAT.down ? Math.exp(-(t - SEAT.down) * 7) : 0;
    writer.write(SLOT.b, tint, lerp(g.body, g.lit, Math.max(seatFlash, accent)));

    /* the press: down, hold, up — vertical, because the survey next door owns the horizontal */
    writer.position.set(PART.b.x, fitPressY(t), PRESS_BOX.z);
    writer.scale.set(STROKE, PRESS_BOX.h, PRESS_BOX.d);
    writer.turn.identity();
    writer.write(SLOT.press, kit.cyan, lerp(lerp(g.rest, g.body, pulse(t, 1.5, 3, 0.12)), g.accent, accent));

    /* the two parts that were already right, and the jaw */
    if (shown > SLOT.a) writeSeated(SLOT.a, PART.a, lerp(g.body, g.lit, clamped * 0.45));
    else writer.hide(SLOT.a);
    if (shown > SLOT.c) writeSeated(SLOT.c, PART.c, lerp(g.body, g.lit, clamped * 0.45));
    else writer.hide(SLOT.c);
    if (shown > SLOT.jaw) {
      writer.position.set(fitJawX(t), FRAME_Y, 0);
      writer.scale.set(JAW.w, JAW.h, JAW.d);
      writer.turn.identity();
      writer.write(SLOT.jaw, kit.cyan, lerp(g.body, g.lit, clamped));
    } else writer.hide(SLOT.jaw);

    writer.flush();
  };

  write();

  return {
    group,
    objects: [group],

    update(frame: ModelFrame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      while (clock >= FIT_LOOP) clock -= FIT_LOOP;
      write();

      kit.uniforms.uTime.value = frame.time;
      kit.uniforms.uReveal.value = frame.reveal;

      // `frame.tx` / `frame.ty` ignored: the panel already answers the mouse in CSS.
      pose.rotation.set(POSE.x, POSE.y - panelSway(frame.time) + panelYaw(frame.time, OWN_YAW_PERIOD), POSE.z);
    },

    setLite(lite: boolean) {
      shown = lite ? Math.min(SLOT_COUNT - 3, full) : full;
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
