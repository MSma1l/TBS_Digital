/**
 * The kit the three benefit-panel objects are cut from — one geometry, one material, one
 * bound, one stroke, one gain table.
 *
 * The three panel models (`surveyField`, `panelFit`, `launchRamp`) stand side by side in the
 * `.highlights` row, each in a strip of roughly **260 x 62 CSS px — a 4.2:1 letterbox**. At
 * that size the thing that makes them read as one family is not their subject matter, it is
 * arithmetic: three independent bounds would give three different units-per-pixel and so a
 * ~65% difference in line weight across three adjacent panels. So `PANEL_BOUND` and `STROKE`
 * are declared once here and every structural bar in all three models is `STROKE` thick.
 *
 * `PANEL_BOUND.halfHeight` is what a placement fits against the strip's **short** side (never
 * `MODEL_RADIUS`, which is the five service models' bound and would scale a panel away). A 0.9
 * fill of 62 px gives ~66 px per model unit, so the full 3.8-unit width lands at ~252 px and
 * `STROKE` at ~4.6 px. Anything a model draws under ~6 px on screen does not exist.
 *
 * One `BoxGeometry(1, 1, 1)` and one `createSurfaceMaterial` are shared by all three, ref
 * counted: it saves no draw calls (each model keeps its own `InstancedMesh`, so the row is
 * 3 draws) but it makes `uReveal`, `uTime` and the theme switch one write for the row instead
 * of three — and it is what guarantees the three panels are lit by literally the same shader
 * state. `SURFACE_MODE.edges` reads a box's own local coordinates (`vBox = position`), which
 * is why every part in every panel model is that one unit box sized by its matrix, and why
 * nothing here is merged or pre-scaled.
 *
 * Colour is per instance, `pipelineBench`'s trick: `uColorA` is set to white after every
 * `paint()`, so a slot's `setColorAt(role x gain)` carries both the hue and the brightness and
 * the `edges` branch splits them back out (`lum` -> gain, `vTint / lum` -> hue). Zero extra
 * uniforms, no new branch, no texture, no sprite.
 *
 * The one number this file exists for: **`lit` is 1.15, below the shader's
 * `smoothstep(1.2, 2.6, lum)` hot threshold**, so only a slot at `accent` ever takes a hot
 * edge. Three panels whose every lit part crossed that threshold would be three white blobs in
 * a row. `accent` is spent on exactly one instance per object, once per loop.
 */

import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type ShaderMaterial,
} from "three";
import { clamp01, smoothstep } from "../../../choreography";
import {
  SURFACE_MODE,
  createSurfaceMaterial,
  paint,
  toColor,
  type SurfaceUniforms,
} from "../../materials";
import type { ScenePalette, SceneMode } from "../../palette";
import { MODEL_SWAY, place } from "../types";

/* ---- the row's one set of measurements ----------------------------------------------------- */

/**
 * The panel row's bound — 4.5:1, matching the real strip. Fitted on the strip's SHORT side
 * against `halfHeight`. (If the window ever grows to 220x120 use 1.25 x 0.62 instead and every
 * pixel figure in these three files scales by 1.8.)
 */
export const PANEL_BOUND = { halfWidth: 1.9, halfHeight: 0.42 } as const;

/** Every structural bar in all three panels, in model units (~4.6 px in the real strip). */
export const STROKE = 0.07;

/** Glow adds light to a dark page; ink composites over a pale one and needs less of it. */
export const PANEL_INTENSITY: Readonly<Record<SceneMode, number>> = { glow: 0.8, ink: 0.6 };

export type PanelGainTable = {
  /** Structure that is not doing anything: rails, plinths, an unresolved mark. */
  rest: number;
  /** A part that is participating. */
  body: number;
  /** The brightest a slot goes without crossing the shader's hot threshold. */
  lit: number;
  /** One instance per object, once per loop. The only thing that takes a hot edge. */
  accent: number;
};

/**
 * Two tables, not one, because the `edges` branch computes
 * `gain = mix(min(lum, 1.8), min(lum, 1.4), uInk)` and `hotness = 1 - uInk`: in ink there is no
 * hot mix at all and everything above 1.4 is identical, so ink's accent can only be a step from
 * a raised floor, never a higher peak. The ink floor is raised for a second reason — the face
 * term is only 0.035, so an unlit box at glow's rest gain is invisible on `--panel`.
 */
export const PANEL_GAIN: Readonly<Record<SceneMode, PanelGainTable>> = {
  glow: { rest: 0.42, body: 0.75, lit: 1.15, accent: 2.2 },
  ink: { rest: 0.85, body: 1.0, lit: 1.2, accent: 1.4 },
};

/**
 * `world.ts` yaws every model group by `MODEL_SWAY` (0.42 rad) from one shared clock. Three
 * panel objects inheriting that would swing in lockstep, and 24 degrees is far too much for a
 * 62 px strip, so each panel cancels this share of it (brandBoard's `SWAY_DAMPEN` idiom) and
 * adds a slow yaw of its own at a period no other panel uses.
 */
export const PANEL_SWAY_DAMPEN = 0.85;

/** How far a panel turns on its own, radians. The article already answers the pointer. */
export const PANEL_YAW = 0.06;

/** Pure. A panel's own yaw at scene time `t`, in radians. */
export function panelYaw(t: number, period: number): number {
  return Math.sin((t / period) * Math.PI * 2) * PANEL_YAW;
}

/** Pure. The world's shared sway, which every panel cancels most of. */
export function panelSway(t: number): number {
  return Math.sin(t * MODEL_SWAY.speed) * MODEL_SWAY.amplitude * PANEL_SWAY_DAMPEN;
}

/* ---- arithmetic the three share ------------------------------------------------------------ */

/** Pure. 0 before `from`, 1 after `to`. */
export function ramp(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from));
}

export function easeInOut(x: number): number {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

/** Pure. A window with eased edges — `pipelineBench`'s `gatePulse`. */
export function pulse(t: number, from: number, to: number, edge: number): number {
  return smoothstep(from, from + edge, t) * (1 - smoothstep(to - edge, to, t));
}

/** Pure. A bell centred on `at`, for a flare that has no duration of its own. */
export function flare(t: number, at: number, width: number): number {
  const d = (t - at) / width;
  return Math.exp(-d * d);
}

/* ---- the shared geometry and material ------------------------------------------------------ */

export type PanelKit = {
  geometry: BoxGeometry;
  material: ShaderMaterial;
  uniforms: SurfaceUniforms;
  /** The palette's roles as working-space colours, refreshed on every theme change. */
  cyan: Color;
  blue: Color;
  red: Color;
  hot: Color;
  /** The current mode's table. Read it every frame — a theme change swaps it underneath. */
  gain: PanelGainTable;
  mode: SceneMode;
  setPalette(palette: ScenePalette): void;
  /** Drop one model's claim; the last one out disposes the geometry and the material. */
  release(): void;
};

type SharedKit = { kit: PanelKit; refs: number };

let shared: SharedKit | null = null;

function buildKit(palette: ScenePalette): PanelKit {
  const geometry = new BoxGeometry(1, 1, 1);
  const item = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
    intensity: PANEL_INTENSITY[palette.mode],
  });
  const cyan = new Color();
  const blue = new Color();
  const red = new Color();
  const hot = new Color();
  const kit: PanelKit = {
    geometry,
    material: item.material,
    uniforms: item.uniforms,
    cyan,
    blue,
    red,
    hot,
    gain: PANEL_GAIN[palette.mode],
    mode: palette.mode,

    setPalette(next: ScenePalette) {
      paint(item, next);
      // White, so a slot's instance colour IS its hue x gain rather than a tint over one.
      item.uniforms.uColorA.value.setRGB(1, 1, 1);
      item.uniforms.uIntensity.value = PANEL_INTENSITY[next.mode];
      toColor(next.cyan, cyan);
      toColor(next.blue, blue);
      toColor(next.red, red);
      toColor(next.hot, hot);
      kit.gain = PANEL_GAIN[next.mode];
      kit.mode = next.mode;
    },

    release() {
      if (!shared) return;
      shared.refs -= 1;
      if (shared.refs > 0) return;
      geometry.dispose();
      item.material.dispose();
      shared = null;
    },
  };
  return kit;
}

/**
 * The row's one geometry and one material. Every panel model calls this in its factory and
 * `release()`s in its `dispose()`.
 */
export function acquirePanelKit(palette: ScenePalette): PanelKit {
  if (!shared) shared = { kit: buildKit(palette), refs: 0 };
  shared.refs += 1;
  shared.kit.setPalette(palette);
  return shared.kit;
}

/* ---- the instanced writer ------------------------------------------------------------------- */

/**
 * One `InstancedMesh` over the shared box, with fixed slots: a frame only ever writes matrices
 * and colours, never a buffer size. Hiding is scale 0, the house's way.
 */
export type PanelWriter = {
  mesh: InstancedMesh;
  /** Scratch, filled by the caller before each `write`. */
  position: Vector3;
  scale: Vector3;
  turn: Quaternion;
  write(slot: number, colour: Color, gain: number): void;
  hide(slot: number): void;
  flush(): void;
};

export function createPanelWriter(kit: PanelKit, slots: number, renderOrder: number): PanelWriter {
  const mesh = place(new InstancedMesh(kit.geometry, kit.material, slots), renderOrder);
  mesh.count = slots;
  const position = new Vector3();
  const scale = new Vector3(1, 1, 1);
  const turn = new Quaternion();
  const matrix = new Matrix4();
  const tint = new Color();
  return {
    mesh,
    position,
    scale,
    turn,
    write(slot, colour, gain) {
      matrix.compose(position, turn, scale);
      mesh.setMatrixAt(slot, matrix);
      // The shader reads `lum = max channel` as the gain and `vTint / lum` as the hue, so the
      // role's own brightness has to be divided out first or the gain table means nothing: a
      // dark role (ink's `hot` is #10172a, max channel 0.023 linear) would arrive at 2% of the
      // gain it asked for and vanish, and cyan would land 20% under every step of the table.
      // Normalising is also what makes "only `accent` crosses 1.2" exact rather than lucky.
      const top = Math.max(colour.r, colour.g, colour.b);
      const g = gain < 0 ? 0 : gain;
      tint.copy(colour).multiplyScalar(top > 1e-4 ? g / top : 0);
      mesh.setColorAt(slot, tint);
    },
    hide(slot) {
      position.set(0, 0, 0);
      scale.set(0, 0, 0);
      turn.identity();
      matrix.compose(position, turn, scale);
      mesh.setMatrixAt(slot, matrix);
    },
    flush() {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
