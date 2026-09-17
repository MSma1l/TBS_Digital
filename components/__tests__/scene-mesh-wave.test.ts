import { describe, expect, it } from "vitest";
import { LineSegments, type Object3D, type ShaderMaterial } from "three";
import { LINE_MODE, POINTS_MODE } from "@/components/scene/three/materials";
import {
  WAVE_SETTLE_SECONDS,
  createMeshWaveModel,
  createWaveClock,
  resetWaveClock,
  stepWaveClock,
  waveGridSegments,
} from "@/components/scene/three/models/meshWave";
import type { ModelFrame } from "@/components/scene/three/models/types";
import { pickSceneRoles } from "@/components/scene/three/palette";
import {
  MESH_WAVE,
  MODEL_POSES,
  MODEL_SCALES,
  rotateEulerXYZ,
  swarmSlots,
  waveHeight,
  waveSamples,
} from "@/components/scene/three/samples";
import type { Vec3 } from "@/components/scene/shapes";
import { SCENE_TIER_CONFIG, type SceneTierConfig } from "@/components/scene/tiers";
import { SCENE_SHAPES, SERVICE_MODEL } from "@/lib/scene";

/*
 * The brand-ui model ("mesh-wave"): a sparse grid of rows and columns with a small `+` on every
 * second crossing, not a dense wireframe with node sprites (it read as a particle cloud). The
 * swarm lands exactly on the lines the model draws, because the wave's clock is held at 0 until
 * the model has formed.
 */

const PALETTE = pickSceneRoles({
  cyan: "#4fc3e8",
  blue: "#3970ff",
  blueText: "#8fb0ff",
  redLift: "#ff5362",
  redText: "#ff6b7b",
  txt: "#f6f7fb",
  bg: "#0a0b10",
});

const TIERS = [
  ["high", SCENE_TIER_CONFIG.high],
  ["mid", SCENE_TIER_CONFIG.mid],
] as const;
const EPS = 1e-6;
const ARM = MESH_WAVE.crossArm;

/** The grid's line coordinates, worked out here rather than read from the module under test. */
function grid([sx, sy]: readonly [number, number]) {
  const xs = Array.from({ length: sx + 1 }, (_, i) => -MESH_WAVE.width / 2 + (i * MESH_WAVE.width) / sx);
  const ys = Array.from({ length: sy + 1 }, (_, j) => -MESH_WAVE.height / 2 + (j * MESH_WAVE.height) / sy);
  const crosses: Array<[number, number]> = [];
  for (let j = 0; j <= sy; j += 2) for (let i = 0; i <= sx; i += 2) crosses.push([xs[i], ys[j]]);
  return { xs, ys, crosses };
}

type Where = { row: boolean; column: boolean; cross: boolean };

/** Which of the grid's lines a plane point lies on, within `EPS`. */
function where([x, y]: readonly [number, number], cells: readonly [number, number]): Where {
  const { xs, ys, crosses } = grid(cells);
  const near = (a: number, b: number) => Math.abs(a - b) <= EPS;
  return {
    row: Math.abs(x) <= MESH_WAVE.width / 2 + EPS && ys.some((ry) => near(y, ry)),
    column: Math.abs(y) <= MESH_WAVE.height / 2 + EPS && xs.some((cx) => near(x, cx)),
    cross: crosses.some(
      ([cx, cy]) => (near(y, cy) && Math.abs(x - cx) <= ARM + EPS) || (near(x, cx) && Math.abs(y - cy) <= ARM + EPS),
    ),
  };
}

/** A posed sample back on the plane: the model's pose and scale undone (Rz(-c)·Ry(-b)·Rx(-a) / s). */
function unposed(buffer: Float32Array, i: number): Vec3 {
  const [a, b, c] = MODEL_POSES["mesh-wave"];
  const p: Vec3 = [buffer[i * 3], buffer[i * 3 + 1], buffer[i * 3 + 2]];
  const [x, y, z] = rotateEulerXYZ(rotateEulerXYZ(rotateEulerXYZ(p, [-a, 0, 0]), [0, -b, 0]), [0, 0, -c]);
  const s = MODEL_SCALES["mesh-wave"];
  return [x / s, y / s, z / s];
}

const frame = (patch: Partial<ModelFrame> = {}): ModelFrame => ({
  time: 12.3,
  step: 1 / 60,
  reveal: 1,
  prewarm: false,
  tx: 0.8,
  ty: -0.6,
  halfHeightPx: 400,
  dpr: 2,
  ...patch,
});

function drawables(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  root.traverse((object) => {
    if ((object as { isMesh?: boolean }).isMesh || (object as { isLine?: boolean }).isLine || (object as { isPoints?: boolean }).isPoints) {
      out.push(object);
    }
  });
  return out;
}

function gridLines(root: Object3D): LineSegments {
  const found = drawables(root).filter(
    (object) => ((object as LineSegments).material as ShaderMaterial).uniforms?.uMode?.value === LINE_MODE.wave,
  );
  expect(found).toHaveLength(1);
  return found[0] as LineSegments;
}

describe("mesh-wave — the grid", () => {
  it("rows × subdiv + columns × subdiv/2 + two per cross: 650 segments on high, 348 on mid", () => {
    const expected = { high: 650, mid: 348 } as const;
    for (const [name, tier] of TIERS) {
      const [sx, sy] = tier.wave;
      const { positions, phases } = waveGridSegments(tier.wave, tier.waveSubdiv);
      const crosses = (sx / 2 + 1) * (sy / 2 + 1);
      expect(positions.length / 6, name).toBe((sy + 1) * tier.waveSubdiv + (sx + 1) * (tier.waveSubdiv / 2) + 2 * crosses);
      expect(positions.length / 6, name).toBe(expected[name]);
      expect(phases.length).toBe(positions.length / 3);
      expect(phases.filter((phase) => phase === 1).length / 2, name).toBe(2 * crosses);
    }
    expect((SCENE_TIER_CONFIG.high.wave[0] / 2 + 1) * (SCENE_TIER_CONFIG.high.wave[1] / 2 + 1)).toBe(45);
    expect((SCENE_TIER_CONFIG.mid.wave[0] / 2 + 1) * (SCENE_TIER_CONFIG.mid.wave[1] / 2 + 1)).toBe(24);
  });

  it("every line segment lies on a row or a column edge to edge, every cross is a + of arm 0.045 on an even crossing", () => {
    expect(ARM).toBe(0.045);
    for (const [name, tier] of TIERS) {
      const { xs, ys, crosses } = grid(tier.wave);
      const { positions, phases } = waveGridSegments(tier.wave, tier.waveSubdiv);
      const rowLength = new Map<number, number>();
      const columnLength = new Map<number, number>();
      const armsAt = new Map<string, number>();
      for (let s = 0; s < positions.length / 6; s += 1) {
        const [ax, ay, az, bx, by, bz] = positions.subarray(s * 6, s * 6 + 6);
        expect(az).toBe(0);
        expect(bz).toBe(0);
        expect(phases[s * 2]).toBe(phases[s * 2 + 1]);
        const horizontal = Math.abs(ay - by) <= EPS;
        const vertical = Math.abs(ax - bx) <= EPS;
        expect(horizontal !== vertical, `${name} segment ${s} is axis-aligned`).toBe(true);
        if (phases[s * 2] === 0) {
          expect(where([ax, ay], tier.wave)[horizontal ? "row" : "column"], `${name} segment ${s}`).toBe(true);
          expect(where([bx, by], tier.wave)[horizontal ? "row" : "column"], `${name} segment ${s}`).toBe(true);
          if (horizontal) {
            const j = ys.findIndex((y) => Math.abs(y - ay) <= EPS);
            expect(Math.abs(bx - ax)).toBeCloseTo(MESH_WAVE.width / tier.waveSubdiv, 5);
            rowLength.set(j, (rowLength.get(j) ?? 0) + Math.abs(bx - ax));
          } else {
            const i = xs.findIndex((x) => Math.abs(x - ax) <= EPS);
            expect(Math.abs(by - ay)).toBeCloseTo(MESH_WAVE.height / (tier.waveSubdiv / 2), 5);
            columnLength.set(i, (columnLength.get(i) ?? 0) + Math.abs(by - ay));
          }
        } else {
          const cx = (ax + bx) / 2;
          const cy = (ay + by) / 2;
          const at = crosses.findIndex(([x, y]) => Math.abs(x - cx) <= EPS && Math.abs(y - cy) <= EPS);
          expect(at, `${name} cross segment ${s} centred on an even crossing`).toBeGreaterThanOrEqual(0);
          expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(2 * ARM, 6);
          armsAt.set(`${at}${horizontal ? "h" : "v"}`, (armsAt.get(`${at}${horizontal ? "h" : "v"}`) ?? 0) + 1);
        }
      }
      // Each row and each column drawn once, edge to edge; each cross once in each direction.
      expect(rowLength.size).toBe(ys.length);
      for (const length of rowLength.values()) expect(length).toBeCloseTo(MESH_WAVE.width, 5);
      expect(columnLength.size).toBe(xs.length);
      for (const length of columnLength.values()) expect(length).toBeCloseTo(MESH_WAVE.height, 5);
      expect(armsAt.size).toBe(2 * crosses.length);
      for (const count of armsAt.values()) expect(count).toBe(1);
    }
  });

  it("draws one P4 line set for the grid and one per card — no point sprites, no node draw left in P6", () => {
    for (const [name, tier] of TIERS) {
      const model = createMeshWaveModel(tier, PALETTE);
      const objects = drawables(model.group);
      expect(objects.every((object) => object instanceof LineSegments), name).toBe(true);
      expect(objects.some((object) => (object as { isPoints?: boolean }).isPoints), name).toBe(false);
      expect(objects, name).toHaveLength(1 + tier.uiCards);
      const lines = gridLines(model.group);
      expect(lines.geometry.getAttribute("position").count / 2, name).toBe(tier === SCENE_TIER_CONFIG.high ? 650 : 348);
      const expected = waveGridSegments(tier.wave, tier.waveSubdiv);
      expect(Array.from(lines.geometry.getAttribute("aPhase").array)).toEqual(Array.from(expected.phases));
      // Lite hides the cards; the grid stays.
      model.setLite(true);
      model.update(frame());
      const shown = drawables(model.group).filter(
        (object) => object.visible && object.parent!.visible && object.parent!.parent!.visible,
      );
      expect(shown).toHaveLength(1);
      expect(shown[0]).toBe(lines);
      model.setPalette({ ...PALETTE, mode: "ink" });
      model.dispose();
    }
    expect(POINTS_MODE).not.toHaveProperty("waveNodes");
    expect(Object.values(POINTS_MODE)).not.toContain(3);
  });
});

describe("mesh-wave — the swarm's silhouette", () => {
  const slotOf = (tier: SceneTierConfig) =>
    swarmSlots(tier, SCENE_SHAPES.map((shape) => SERVICE_MODEL[shape]))[1 + SCENE_SHAPES.indexOf("brand-ui")];

  it("every sample, un-posed, lies on a row, a column or a cross of the tier's grid, on the wave at time 0 (within 1e-6)", () => {
    for (const [name, tier] of TIERS) {
      const samples = slotOf(tier);
      expect(samples).toEqual(waveSamples(tier.swarm, tier.wave));
      for (let i = 0; i < tier.swarm; i += 1) {
        const [x, y, z] = unposed(samples, i);
        const on = where([x, y], tier.wave);
        expect(on.row || on.column || on.cross, `${name} sample ${i} at (${x}, ${y})`).toBe(true);
        expect(Math.abs(z - waveHeight(x, y, 0, 0)), `${name} sample ${i} height`).toBeLessThanOrEqual(EPS);
      }
    }
  });

  it("45% rows, 40% columns, 15% crosses — and any half of the buffer keeps that mix (the lite prefix)", () => {
    for (const [name, tier] of TIERS) {
      const samples = waveSamples(tier.swarm, tier.wave);
      const { xs, ys } = grid(tier.wave);
      const shares = (from: number, to: number) => {
        let rows = 0;
        let nearCross = 0;
        const rowsHit = new Set<number>();
        const columnsHit = new Set<number>();
        for (let i = from; i < to; i += 1) {
          const [x, y] = unposed(samples, i);
          const on = where([x, y], tier.wave);
          if (on.row) {
            rows += 1;
            rowsHit.add(ys.findIndex((ry) => Math.abs(ry - y) <= EPS));
          }
          if (on.column) columnsHit.add(xs.findIndex((cx) => Math.abs(cx - x) <= EPS));
          if (on.cross) nearCross += 1;
        }
        return { rows: rows / (to - from), nearCross: nearCross / (to - from), rowsHit, columnsHit };
      };
      // A cross's horizontal arm lies on its row, its vertical arm on its column: rows get
      // 45% + about half of the crosses' 15%.
      const all = shares(0, tier.swarm);
      expect(Math.abs(all.rows - 0.525), name).toBeLessThan(0.05);
      // At least the crosses' own 15%, plus the lines' stretches under the arms.
      expect(all.nearCross, name).toBeGreaterThanOrEqual(0.15);
      expect(all.nearCross, name).toBeLessThan(0.32);
      expect(all.rowsHit.size, name).toBe(ys.length);
      expect(all.columnsHit.size, name).toBe(xs.length);
      const half = Math.floor(tier.swarm / 2);
      for (const part of [shares(0, half), shares(half, tier.swarm)]) {
        expect(Math.abs(part.rows - 0.525), name).toBeLessThan(0.08);
        expect(part.nearCross, name).toBeGreaterThanOrEqual(0.1);
      }
    }
  });
});

describe("mesh-wave — the landing clock", () => {
  it("holds at 0 while the model forms, whatever the reveal and the frame steps; runs from the first formed frame", () => {
    const state = createWaveClock();
    for (const reveal of [0, 0.01, 0.3, 0.72, 0.99, 1 - 1e-9]) {
      for (let f = 0; f < 90; f += 1) expect(stepWaveClock(state, reveal, 1 / 20)).toBe(0);
      expect(state.clock).toBe(0);
    }
    stepWaveClock(state, 1, 1 / 60);
    expect(state.clock).toBeCloseTo(1 / 60, 12);
    // A broken step never moves it.
    for (const step of [Number.NaN, Number.POSITIVE_INFINITY, -1]) stepWaveClock(state, 1, step);
    expect(state.clock).toBeCloseTo(1 / 60, 12);
  });

  it(`the pulse ring and the pointer's pull grow in over ${WAVE_SETTLE_SECONDS}s after forming`, () => {
    expect(WAVE_SETTLE_SECONDS).toBe(0.6);
    const state = createWaveClock();
    let last = 0;
    for (let f = 0; f < 40; f += 1) {
      const settle = stepWaveClock(state, 1, 1 / 60);
      expect(settle).toBeGreaterThanOrEqual(last);
      expect(settle).toBeLessThanOrEqual(1);
      last = settle;
    }
    expect(last).toBe(1);
    expect(stepWaveClock(createWaveClock(), 1, 0.3)).toBeCloseTo(0.5, 12);
  });

  it("dissolving out keeps the clock running (no jump); a new landing starts from 0 again", () => {
    const state = createWaveClock();
    for (let f = 0; f < 120; f += 1) stepWaveClock(state, 1, 1 / 60);
    const formed = state.clock;
    stepWaveClock(state, 0.8, 1 / 60);
    expect(state.clock).toBeCloseTo(formed + 1 / 60, 12);
    resetWaveClock(state);
    expect(state).toEqual({ clock: 0, formed: false });
    expect(stepWaveClock(state, 0.4, 1 / 60)).toBe(0);
    expect(state.clock).toBe(0);
  });

  it("the model: while it lands the grid's wave is exactly wavePoint(x, y, 0, 0) — time, pulse and origin all 0 — whatever the scene time and tilt", () => {
    const model = createMeshWaveModel(SCENE_TIER_CONFIG.mid, PALETTE);
    const u = (gridLines(model.group).material as ShaderMaterial).uniforms;
    const origin = () => [u.uOrigin.value.x, u.uOrigin.value.y];
    model.resetCycle();
    for (let f = 1; f <= 40; f += 1) {
      model.update(frame({ time: 12.3 + f / 20, step: 1 / 20, reveal: f / 41 }));
      expect(u.uWaveTime.value).toBe(0);
      expect(u.uPulseR.value).toBe(0);
      expect(Math.abs(origin()[0]) + Math.abs(origin()[1])).toBe(0);
      expect(u.uReveal.value).toBeCloseTo(f / 41, 12);
    }
    // Formed: the clock runs from 0 (not from the scene time), the pulse and the pull grow in.
    model.update(frame({ step: 1 / 60, reveal: 1 }));
    expect(u.uWaveTime.value).toBeCloseTo(1 / 60, 12);
    expect(u.uPulseR.value).toBeGreaterThan(0);
    expect(u.uPulseR.value).toBeLessThan(1 / 60);
    for (let f = 0; f < 40; f += 1) model.update(frame({ step: 1 / 60, reveal: 1 }));
    expect(u.uWaveTime.value).toBeCloseTo(41 / 60, 9);
    expect(u.uPulseR.value).toBeCloseTo(41 / 60, 9);
    expect(origin()[0]).toBeCloseTo(0.8 * 0.9, 9);
    expect(origin()[1]).toBeCloseTo(0.6 * 0.55, 9);
    // Hidden: nothing drawn, nothing advanced. The world resets the cycle before the next landing.
    model.update(frame({ reveal: 0 }));
    expect(model.group.visible).toBe(false);
    expect(u.uWaveTime.value).toBeCloseTo(41 / 60, 9);
    model.resetCycle();
    model.update(frame({ reveal: 0.2 }));
    expect(u.uWaveTime.value).toBe(0);
    expect(u.uPulseR.value).toBe(0);
    model.dispose();
  });
});
