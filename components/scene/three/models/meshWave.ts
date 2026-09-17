/**
 * "Brand & UI": a sparse neon grid lying back like a floor — the rows and columns of a design
 * surface, with a small `+` on every second crossing — rolling in slow waves, with a pulse ring
 * spreading from wherever the pointer leans; a few UI card outlines float above it. The wave is
 * displaced in the vertex shader (no CPU per vertex).
 *
 * The swarm lands exactly on this grid (`waveSamples`, taken at wave time 0): the wave's clock
 * is held at 0 from the moment the model starts to reveal until it has formed, and only then
 * runs; the pulse ring and the pointer's pull grow in from 0 over `WAVE_SETTLE_SECONDS`.
 *
 * Draws: the grid with its crosses (P4, one geometry; `aPhase` 1 on the crosses, which ride the
 * pulse), one per card (P4). Lite hides the cards.
 */

import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Group, LineSegments } from "three";
import type { SceneTierConfig } from "../../tiers";
import { LINE_MODE, createLineMaterial, paint, type LineUniforms } from "../materials";
import type { ScenePalette } from "../palette";
import { MESH_WAVE, MODEL_POSES, MODEL_SCALES, waveGridLines } from "../samples";
import { place, type SceneModel } from "./types";

const CARD_LIFT = 0.75;
const GRID_ALPHA = { glow: 0.42, ink: 0.5 } as const;

/** Seconds after formation over which the pulse ring's radius and the pointer's pull grow from 0. */
export const WAVE_SETTLE_SECONDS = 0.6;

/**
 * The grid of `cells` as segment pairs on the plane (z = 0; the shader adds the wave), with one
 * `aPhase` per vertex: 0 on a line, 1 on a cross. Rows run `subdiv` segments, columns half as
 * many; a `+` of arm `MESH_WAVE.crossArm` sits on every crossing of an even column and row.
 */
export function waveGridSegments(
  cells: readonly [number, number],
  subdiv: number,
): { positions: Float32Array; phases: Float32Array } {
  const { xs, ys } = waveGridLines(cells);
  const rowSteps = Math.max(1, Math.round(subdiv));
  const columnSteps = Math.max(1, Math.round(subdiv / 2));
  const positions: number[] = [];
  const phases: number[] = [];
  const push = (ax: number, ay: number, bx: number, by: number, phase: number) => {
    positions.push(ax, ay, 0, bx, by, 0);
    phases.push(phase, phase);
  };
  const along = (from: number, to: number, share: number) => from + (to - from) * share;
  const [left, right] = [xs[0], xs[xs.length - 1]];
  const [bottom, top] = [ys[0], ys[ys.length - 1]];
  for (const y of ys) {
    for (let k = 0; k < rowSteps; k += 1) {
      push(along(left, right, k / rowSteps), y, along(left, right, (k + 1) / rowSteps), y, 0);
    }
  }
  for (const x of xs) {
    for (let k = 0; k < columnSteps; k += 1) {
      push(x, along(bottom, top, k / columnSteps), x, along(bottom, top, (k + 1) / columnSteps), 0);
    }
  }
  const arm = MESH_WAVE.crossArm;
  for (let j = 0; j < ys.length; j += 2) {
    for (let i = 0; i < xs.length; i += 2) {
      push(xs[i] - arm, ys[j], xs[i] + arm, ys[j], 1);
      push(xs[i], ys[j] - arm, xs[i], ys[j] + arm, 1);
    }
  }
  return { positions: new Float32Array(positions), phases: new Float32Array(phases) };
}

/** The wave's clock (seconds) and whether the model has formed since it last started to reveal. */
export type WaveClock = { clock: number; formed: boolean };

export function createWaveClock(): WaveClock {
  return { clock: 0, formed: false };
}

/** A new landing: back to wave time 0, held there until the model forms again. */
export function resetWaveClock(state: WaveClock): void {
  state.clock = 0;
  state.formed = false;
}

/**
 * One frame at `reveal`: returns how far the pulse ring and the pointer's pull have grown in
 * (0 → 1). Until the model first forms (reveal 1) the clock stays at 0, so the grid is exactly
 * `wavePoint(x, y, 0, 0)` while the swarm lands on it. Once formed it keeps running, through a
 * later dissolve too: snapping back to 0 there would jump the whole mesh.
 */
export function stepWaveClock(state: WaveClock, reveal: number, step: number): number {
  if (reveal >= 1) state.formed = true;
  state.clock = state.formed ? state.clock + (Number.isFinite(step) && step > 0 ? step : 0) : 0;
  const e = Math.min(1, state.clock / WAVE_SETTLE_SECONDS);
  return e * e * (3 - 2 * e);
}

type WaveUniforms = Pick<LineUniforms, "uWaveTime" | "uPulseR" | "uOrigin" | "uReveal" | "uTime">;

function wave(u: WaveUniforms, t: number, pulseR: number, ox: number, oy: number, reveal: number): void {
  u.uWaveTime.value = t;
  u.uPulseR.value = pulseR;
  u.uOrigin.value.set(ox, oy);
  u.uReveal.value = reveal;
  u.uTime.value = t;
}

/** A rounded-rectangle outline plus a header rule and two content lines, as segment pairs. */
function cardSegments(w: number, h: number, r: number, out: number[]): void {
  const corner = 5;
  const pts: Array<[number, number]> = [];
  const arc = (cx: number, cy: number, start: number) => {
    for (let i = 0; i <= corner; i += 1) {
      const a = start + (i / corner) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const hw = w / 2 - r;
  const hh = h / 2 - r;
  arc(hw, hh, 0);
  arc(-hw, hh, Math.PI / 2);
  arc(-hw, -hh, Math.PI);
  arc(hw, -hh, (3 * Math.PI) / 2);
  const push = (a: [number, number], b: [number, number]) => {
    out.push(a[0], a[1], 0, b[0], b[1], 0);
  };
  for (let i = 0; i < pts.length; i += 1) push(pts[i], pts[(i + 1) % pts.length]);
  const left = -w / 2 + 0.08;
  push([left, h / 2 - 0.16], [w / 2 - 0.08, h / 2 - 0.16]);
  push([left, 0.0], [left + w * 0.55, 0.0]);
  push([left, -0.12], [left + w * 0.35, -0.12]);
}

export function createMeshWaveModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-mesh-wave";
  const pose = new Group();
  const [px, py, pz] = MODEL_POSES["mesh-wave"];
  pose.rotation.set(px, py, pz);
  pose.scale.setScalar(MODEL_SCALES["mesh-wave"]);
  group.add(pose);

  const { positions, phases } = waveGridSegments(config.wave, config.waveSubdiv);
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  gridGeometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  const grid = createLineMaterial({ mode: LINE_MODE.wave, roles: { a: "blue", b: "cyan", hot: "red" }, alpha: GRID_ALPHA.glow });
  pose.add(place(new LineSegments(gridGeometry, grid.material), 5));

  const cardCount = config.uiCards;
  const cardPositions: number[] = [];
  const cardSpots: ReadonlyArray<readonly [number, number, number, number, number]> = [
    // x, y, z, w, h
    [-0.85, -0.35, 1.0, 0.95, 0.62],
    [0.75, -0.6, 1.2, 0.8, 0.52],
    [0.2, 0.45, 0.85, 0.7, 0.44],
  ];
  const cardGroups: Group[] = [];
  const cards = createLineMaterial({ mode: LINE_MODE.card, roles: { a: "cyan", b: "blue", hot: "hot" }, alpha: 0.95 });
  const cardRoot = new Group();
  pose.add(cardRoot);
  for (let c = 0; c < cardCount; c += 1) {
    const [cx, cy, cz, cw, ch] = cardSpots[c % cardSpots.length];
    const cardLines: number[] = [];
    cardSegments(cw, ch, 0.07, cardLines);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(cardLines, 3));
    const u = new Float32Array(cardLines.length / 3);
    for (let i = 0; i < u.length; i += 1) u[i] = i / u.length + c * 0.33;
    geometry.setAttribute("aU", new BufferAttribute(u, 1));
    const lines = place(new LineSegments(geometry, cards.material), 7);
    const holder = new Group();
    holder.position.set(cx, cy, cz);
    // Stood partly back up out of the floor's tilt, so the cards read as screens.
    holder.rotation.x = CARD_LIFT;
    holder.add(lines);
    cardRoot.add(holder);
    cardGroups.push(holder);
    cardPositions.push(cx, cy, cz);
  }

  const applyPalette = (next: ScenePalette) => {
    paint(grid, next);
    paint(cards, next);
    grid.uniforms.uAlpha.value = GRID_ALPHA[next.mode];
  };
  applyPalette(palette);

  const clock = createWaveClock();
  let lite = false;

  return {
    kind: "mesh-wave",
    group,
    objects: [group],

    resetCycle() {
      resetWaveClock(clock);
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      const settle = stepWaveClock(clock, frame.reveal, frame.step);
      const t = clock.clock;
      wave(
        grid.uniforms,
        t,
        (t % MESH_WAVE.pulsePeriod) * settle,
        frame.tx * 0.9 * settle,
        -frame.ty * 0.55 * settle,
        frame.reveal,
      );
      cards.uniforms.uReveal.value = frame.reveal;
      cards.uniforms.uTime.value = frame.time;

      cardGroups.forEach((holder, c) => {
        holder.position.z = cardPositions[c * 3 + 2] + Math.sin(frame.time * 0.9 + c * 2.1) * 0.06;
        holder.rotation.set(
          CARD_LIFT + Math.sin(frame.time * 0.5 + c) * 0.06,
          Math.cos(frame.time * 0.4 + c * 1.7) * 0.08,
          0,
        );
      });
      cardRoot.visible = !lite;
    },

    setLite(next) {
      lite = next;
      cardRoot.visible = !lite;
    },

    setPalette: applyPalette,

    dispose() {
      gridGeometry.dispose();
      grid.material.dispose();
      cards.material.dispose();
      for (const holder of cardGroups) {
        for (const child of holder.children) {
          if (child instanceof LineSegments) child.geometry.dispose();
        }
      }
    },
  };
}
