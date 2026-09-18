/**
 * "Cadastrul" — the survey field. Benefit panel 1, "clarify".
 *
 * A long horizontal RAIL is being drawn left to right by an upright bright BAR that crosses the
 * strip once per loop. Ahead of the bar the MARKS float at unequal heights and unequal sizes —
 * a scatter. As the bar reaches a mark's slot the mark drops onto the rail, takes the common
 * size and snaps to an even pitch. Behind the bar: a ruler. Ahead of it: noise. The line itself
 * is the map being made.
 *
 * It reads before any single part resolves, because what it states is a *contrast* (regular vs
 * irregular) and regularity is pre-attentive. That is also why it survives a 62 px strip where
 * a mechanism would not.
 *
 * This object owns two of the row's formal devices, and the other two panels own neither:
 * the **continuous base rule** (the rail, edge to edge) and the **horizontal sweep** (the bar).
 * `panelFit`'s test is therefore a vertical press, and `launchRamp` has two short rail marks
 * with a gap rather than a third rule.
 *
 * 1 draw call. 8 instances at high (rail, bar, 6 marks), 7 at mid, 6 in lite — the marks are
 * the buffer's tail and are re-pitched to the visible count, so the lattice always spans the
 * same x whatever the tier.
 */

import { Color, Group } from "three";
import { mulberry32 } from "@/components/three/random";
import { easeOutCubic, smoothstep } from "../../../choreography";
import type { SceneTierConfig } from "../../../tiers";
import type { ScenePalette } from "../../palette";
import type { ModelFrame, PanelModel } from "../types";
import {
  STROKE,
  acquirePanelKit,
  createPanelWriter,
  easeInOut,
  lerp,
  panelSway,
  panelYaw,
  pulse,
  ramp,
} from "./kit";

/* ---- the clock ------------------------------------------------------------------------------ */

/**
 * 3.60 s — the shortest of the row's three periods (3.60 / 4.20 / 4.80, lcm 100.8 s), so no two
 * panels ever repeat a coincidence inside a visit.
 */
export const SURVEY_LOOP = 3.6;

/**
 * The clock opens mid-survey, never at 0: two marks landed on a drawn rail, a third in the act
 * of landing, three still loose above, and the bar standing just right of centre where the rail
 * stops. That frame states the whole idea with the clock stopped, which is why this design was
 * chosen — a half-drawn ruler is legible frozen, a cloud mid-convergence is just a cloud.
 *
 * 1.21 rather than the 1.31 first specified: at 1.31 the bar stands exactly on the fourth
 * mark's slot and swallows it, so the still pose showed two loose marks instead of three.
 */
export const SURVEY_START = 1.21;

/** 61% of the loop. On the wall clock the row accents at 1.00 / 2.26 / 3.70 s — 1.26 s and
 *  1.44 s apart, and no pair ever closer than 0.35 s. */
export const SURVEY_ACCENT = 2.21;

const HOLD_TO = 2.95;

/** The bar's traverse: constant velocity, on purpose — it has speed where the others pulse. */
const BAR = { from: -1.75, to: 1.75, at: 0.26, over: 1.8 } as const;

/** Each mark resolves over this, as the bar passes its slot. */
const RESOLVE = 0.26;

/** The reset breath: the marks let go right to left, at the loop's dimmest. */
const LOOSEN = { at: 3.05, span: 0.55, each: 0.22 } as const;

/** How far `uIntensity` would fall in the reset — applied per instance, since the row shares one material. */
const LOOSEN_DIM = 0.6;

/* ---- the field ------------------------------------------------------------------------------ */

const MARKS_MAX = 6;
const MARK_SPAN = 2.8;
const MARK_SIZE = 0.13;
const MARK_Y = -0.22;
const RAIL_Y = -0.3;
/** Two depths only: the rail behind, everything that moves in front. Nothing else in z. */
const BACK_Z = -0.05;
const FRONT_Z = 0.05;
/**
 * 5 px wide and 42 px tall in the real strip. Wider than the 0.05 first drawn: the bar is the
 * object's protagonist and in ink it cannot win on colour — `hot` there is the page's text
 * tone, whose hue normalises to a pale lavender through the `edges` branch — so it has to win
 * on weight and on gain.
 */
const BAR_SIZE = { w: 0.075, h: 0.64, d: 0.075 } as const;
const BAR_Y = 0.02;

const SLOT = { rail: 0, bar: 1, marks: 2 } as const;
const SLOT_COUNT = SLOT.marks + MARKS_MAX;

/**
 * The scatter, seeded once. **Height above the rail and overall size only** — never a y-scale,
 * and never above 1.4x the landed size (0.182). A mark that grew instead of rising, or one
 * appreciably bigger than its landed self, turns the field into a bar chart over a baseline and
 * the object stops being universal.
 */
const SCATTER: ReadonlyArray<{ rise: number; size: number }> = (() => {
  const random = mulberry32(0x5c4a7);
  const out: Array<{ rise: number; size: number }> = [];
  for (let k = 0; k < MARKS_MAX; k += 1) {
    out.push({ rise: 0.05 + random() * 0.37, size: 0.1 + random() * 0.07 });
  }
  return out;
})();

/** A shallow three-quarter: a mark shows two faces, the rail has depth, the row stays even. */
const POSE = { x: 0.2, y: 0.3, z: 0 } as const;
/** Its own slow yaw, at a period neither sibling uses. */
const OWN_YAW_PERIOD = 5.3;

/* ---- pure clock ----------------------------------------------------------------------------- */

/** Pure. Where mark `k` of `count` sits once it has landed. */
export function surveyMarkX(k: number, count: number): number {
  if (count < 2) return 0;
  return -MARK_SPAN / 2 + (MARK_SPAN * k) / (count - 1);
}

/** Pure. The bar's x at `t` — linear between `BAR.at` and `BAR.at + BAR.over`. */
export function surveyBarX(t: number): number {
  return lerp(BAR.from, BAR.to, ramp(t, BAR.at, BAR.at + BAR.over));
}

/** Pure. The rail's right end: it follows the bar out, then retracts in the reset breath. */
export function surveyRailRight(t: number): number {
  return lerp(surveyBarX(t), BAR.from, easeInOut(ramp(t, LOOSEN.at + 0.1, SURVEY_LOOP - 0.05)));
}

/**
 * Pure. How ordered mark `k` is at `t`: 0 scattered, 1 landed on the lattice. It resolves as
 * the bar passes it and lets go right to left in the reset.
 */
export function surveyMarkPhase(k: number, count: number, t: number): number {
  const x = surveyMarkX(k, count);
  const at = BAR.at + BAR.over * ((x - BAR.from) / (BAR.to - BAR.from));
  const last = count > 1 ? count - 1 : 1;
  const back = LOOSEN.at + ((last - k) / last) * (LOOSEN.span - LOOSEN.each);
  return ramp(t, at, at + RESOLVE) * (1 - ramp(t, back, back + LOOSEN.each));
}

/** Pure. The accent envelope — one instance (the bar), peaking exactly at `SURVEY_ACCENT`. */
export function surveyAccentAt(t: number): number {
  return pulse(t, SURVEY_ACCENT - 0.13, HOLD_TO, 0.13);
}

/** Pure. The rail's lift from `blue` to `cyan` as the survey closes. */
function railLift(t: number): number {
  return smoothstep(SURVEY_ACCENT - 0.13, SURVEY_ACCENT, t) * (1 - smoothstep(HOLD_TO, HOLD_TO + 0.25, t));
}

/** Pure. The reset dims the whole object first, so the un-ordering reads as a reset. */
function loosenDim(t: number): number {
  const down = smoothstep(HOLD_TO, HOLD_TO + 0.2, t);
  const up = smoothstep(SURVEY_LOOP - 0.25, SURVEY_LOOP, t);
  return lerp(1, LOOSEN_DIM, down) + (1 - LOOSEN_DIM) * up * down;
}

/* ---- the model ------------------------------------------------------------------------------ */

export function createSurveyFieldModel(config: SceneTierConfig, palette: ScenePalette): PanelModel {
  const group = new Group();
  group.name = "scene-panel-survey-field";
  const pose = new Group();
  pose.rotation.set(POSE.x, POSE.y, POSE.z);
  group.add(pose);

  const kit = acquirePanelKit(palette);
  const writer = createPanelWriter(kit, SLOT_COUNT, 6);
  pose.add(writer.mesh);

  const built = config.uiCards > 2 ? MARKS_MAX : MARKS_MAX - 1;
  const tint = new Color();
  let marks = built;
  let clock = SURVEY_START;
  writer.mesh.count = SLOT.marks + marks;

  const write = () => {
    const t = clock;
    const g = kit.gain;
    const dim = loosenDim(t);
    const accent = surveyAccentAt(t);
    const lift = railLift(t);
    const barX = surveyBarX(t);

    /* the rail: one box, left end pinned, right end at the bar — the streak draws itself */
    const right = surveyRailRight(t);
    const length = right - BAR.from;
    writer.position.set((BAR.from + right) / 2, RAIL_Y, BACK_Z);
    writer.scale.set(length > 1e-4 ? length : 1e-4, STROKE, STROKE);
    writer.turn.identity();
    tint.copy(kit.blue).lerp(kit.cyan, lift);
    writer.write(SLOT.rail, tint, lerp(g.rest, g.lit, lift) * dim);

    /* the bar: the one element that ever reaches `accent`, and the one `hot` hue in the object
       (white-hot in glow, the page's text colour in ink — highest contrast in both themes) */
    const barFade = smoothstep(0, BAR.at, t) * (1 - smoothstep(HOLD_TO, HOLD_TO + 0.25, t));
    writer.position.set(barX, BAR_Y, FRONT_Z);
    writer.scale.set(BAR_SIZE.w, BAR_SIZE.h, BAR_SIZE.d);
    writer.turn.identity();
    writer.write(SLOT.bar, kit.hot, lerp(g.lit, g.accent, accent) * barFade * dim);

    /* the marks */
    for (let k = 0; k < MARKS_MAX; k += 1) {
      if (k >= marks) {
        writer.hide(SLOT.marks + k);
        continue;
      }
      const phase = surveyMarkPhase(k, marks, t);
      const scatter = SCATTER[k];
      const settled = easeInOut(phase);
      const sized = easeOutCubic(phase);
      writer.position.set(surveyMarkX(k, marks), MARK_Y + scatter.rise * (1 - settled), FRONT_Z);
      const side = lerp(scatter.size, MARK_SIZE, sized);
      writer.scale.set(side, side, side);
      writer.turn.identity();
      tint.copy(kit.blue).lerp(kit.cyan, phase);
      // At the accent the whole row steps up together — to `lit`, not past it, so the bar keeps
      // the object's only hot edge and the field reads as one system rather than six flares.
      const base = lerp(g.rest, g.body, phase);
      writer.write(SLOT.marks + k, tint, lerp(base, g.lit, accent * phase) * dim);
    }

    writer.flush();
  };

  // The composed pose, written before the first frame: the field is never seen empty or at 0.
  write();

  return {
    group,
    objects: [group],

    update(frame: ModelFrame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      clock += frame.step;
      while (clock >= SURVEY_LOOP) clock -= SURVEY_LOOP;
      write();

      kit.uniforms.uTime.value = frame.time;
      kit.uniforms.uReveal.value = frame.reveal;

      // `frame.tx` / `frame.ty` are ignored on purpose: the `<article>` already answers the
      // pointer (usePointerTilt), and three tiny objects leaning to one global pointer is the
      // same lockstep problem the sway has.
      pose.rotation.set(POSE.x, POSE.y - panelSway(frame.time) + panelYaw(frame.time, OWN_YAW_PERIOD), POSE.z);
    },

    setLite(lite: boolean) {
      marks = lite ? Math.min(4, built) : built;
      writer.mesh.count = SLOT.marks + marks;
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
