/**
 * A hero stat panel: the number the hero claims, drawn IN the scene instead of on the page.
 *
 * One `PlaneGeometry` on `SURFACE_MODE.holo` — the Work hologram's own branch — carrying the face
 * `three/statFace.ts` composes from the metric card's own DOM: the number, its rule, the label, the
 * note, the corner brackets and the wireframe the card wears. The shader adds what makes it a
 * hologram rather than a picture: the scanline comb, the hairline frame, the palette's colour, the
 * voxel dissolve it arrives with and the shear it glitches with when the face is composed again.
 *
 * **It is placed on a box of the page, not in the scene's own space.** The world fits it to the
 * window the hero leaves where the card was (`[data-scene-anchor="stat"]`, `placeStat` in
 * choreography.ts) — rigidly, per axis, so the number sits exactly where the card's number sat and
 * the hero's composition is the one we shipped. What the panel adds is the third dimension: it
 * leans towards the pointer over it, lifts a little out of the page while it is there, and breathes
 * on a slow float the rest of the time.
 *
 * One draw call and one texture per panel. Nothing else is drawn: no frame geometry (the shader's
 * frame term is the frame), no vertex dots, no second plane.
 */

import { Group, Mesh, PlaneGeometry, type Object3D } from "three";
import { damp } from "@/components/three/motion";
import { createHologramSource, type HologramSource } from "../hologram";
import { SURFACE_MODE, createSurfaceMaterial, paint } from "../materials";
import type { ScenePalette, SceneMode } from "../palette";
import { composeStatFace, statFaceMax } from "../statFace";
import type { SceneCanvasTier } from "../../tiers";
import { place } from "./types";
import type { ModelFrame } from "./types";

/**
 * The panel draws a little lighter in ink, exactly as the laptop's display does: on a pale page an
 * additive face at full strength washes its own copy out.
 */
const PANEL_INTENSITY: Readonly<Record<SceneMode, number>> = { glow: 1.2, ink: 0.95 };

/** How much brighter a panel burns while the pointer is on it (a share of its own intensity). */
const HOVER_GAIN = 0.22;

/**
 * How the panel answers a pointer over it and how it idles.
 *
 *  · `lean` — radians at the window's edge. The card it replaces tilts under the pointer with
 *    `perspective(900px) rotateX/rotateY` up to `TILT_MAX.metric` (Hero.tsx); this is that tilt,
 *    in the scene's own perspective, and it is deliberately a shade smaller: a 3D plane's lean
 *    reads stronger than a CSS one because its frame and its scanlines lean with it.
 *  · `lift` — world units towards the camera while the pointer is over it. The card lifts 4px
 *    (`hover:-translate-y-1`); a panel cannot rise on the page without leaving its window, so it
 *    rises towards the viewer instead.
 *  · `float` — the idle breath: radians of yaw and pitch, and the seconds of one cycle. Two panels
 *    on one clock would breathe in lockstep, so each takes a phase from its index.
 *  · `lambda` — how fast the lean and the lift follow. Fast enough to feel attached to the pointer,
 *    slow enough that a flick across the hero does not snap it.
 */
export const STAT_MOTION = {
  lean: 0.14,
  lift: 0.12,
  float: { yaw: 0.02, pitch: 0.014, seconds: 9, phase: 2.1 },
  lambda: 9,
  /** Seconds a face swap shears and flickers for (the hologram's own glitch). */
  glitch: 0.26,
} as const;

/** Pure. The idle float's yaw and pitch for panel `index` at scene time `t`, in radians. */
export function statFloat(t: number, index: number): { yaw: number; pitch: number } {
  const a = ((t / STAT_MOTION.float.seconds) * Math.PI * 2) + index * STAT_MOTION.float.phase;
  return {
    yaw: Math.sin(a) * STAT_MOTION.float.yaw,
    pitch: Math.cos(a * 0.73) * STAT_MOTION.float.pitch,
  };
}

/** One frame of a stat panel: a model frame, plus where the pointer is on this panel. */
export type StatFrame = ModelFrame & {
  /** 0 nothing is over it → 1 the pointer is on it (already eased by the world). */
  hover: number;
  /** Where on the face the pointer is, -1..1, y positive downwards (the DOM's sense). */
  leanX: number;
  leanY: number;
};

export type StatPanelModel = {
  group: Group;
  /** Compiled and pre-warmed like a benefit panel's: one object, on a program the scene has. */
  objects: Object3D[];
  /**
   * Fit the face to `w` x `h` world units and tell the source how many pixels that window really
   * has (device px, so the number is drawn at the window's own resolution up to the tier's cap).
   * Cheap and idempotent: the world calls it whenever the probe is re-measured.
   */
  layout(w: number, h: number, pixels: readonly [number, number]): void;
  /** Compose `card`'s face (its `index` in the group) in the next idle slot. */
  request(card: HTMLElement | null, index: number, force?: boolean): void;
  update(frame: StatFrame): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

export function createStatPanelModel(
  tier: SceneCanvasTier,
  palette: ScenePalette,
  index: number,
): StatPanelModel {
  const group = new Group();
  group.name = `scene-stat-panel-${index}`;

  /* A unit plane: the world scales it to the window, so one geometry serves every width and
     breakpoint. The scale lives on the MESH, under its rotation — a lean inside a non-uniformly
     scaled group would shear the letters. */
  const geometry = new PlaneGeometry(1, 1);
  const face = createSurfaceMaterial({ mode: SURFACE_MODE.holo, roles: { a: "cyan", b: "blue", hot: "hot" } });
  face.uniforms.uIntensity.value = PANEL_INTENSITY[palette.mode];
  const mesh = place(new Mesh(geometry, face.material), 6);
  mesh.name = `scene-stat-face-${index}`;
  mesh.visible = false;
  group.add(mesh);

  let glitch = 0;
  const source: HologramSource = createHologramSource(
    statFaceMax(tier),
    () => {
      glitch = 1;
    },
    composeStatFace,
    statFaceMax(tier),
  );

  let lite = false;
  /** The mode's own intensity; the hover gain is applied on top of it every frame. */
  let intensity = PANEL_INTENSITY[palette.mode];
  let hover = 0;
  let leanX = 0;
  let leanY = 0;
  let lift = 0;

  return {
    group,
    objects: [mesh],

    layout(w, h, pixels) {
      mesh.scale.set(Math.max(0.0001, w), Math.max(0.0001, h), 1);
      source.resize(pixels);
    },

    request(card, cardIndex, force = false) {
      source.request(card, cardIndex, force);
    },

    update(frame) {
      const step = Math.max(0, frame.step);
      /* The texture is handed over on the first frame after a compose: a plane with no face is
         still a draw, and an empty one is not a picture that failed to load, it is a bug on screen. */
      if (face.uniforms.uMap.value === null && source.texture.image) {
        const image = source.texture.image as { width?: number; height?: number };
        if ((image.width ?? 0) > 0 && (image.height ?? 0) > 0) face.uniforms.uMap.value = source.texture;
      }
      mesh.visible = (face.uniforms.uMap.value !== null && frame.reveal > 0.001) || frame.prewarm;
      if (!mesh.visible) return;

      hover = damp(hover, frame.hover, STAT_MOTION.lambda, step);
      leanX = damp(leanX, frame.leanX * hover, STAT_MOTION.lambda, step);
      leanY = damp(leanY, frame.leanY * hover, STAT_MOTION.lambda, step);
      lift = damp(lift, hover * STAT_MOTION.lift, STAT_MOTION.lambda, step);

      const float = statFloat(frame.time, index);
      // y from the pointer's x (the panel turns towards the cursor), x from its y — and the sign of
      // the pitch is the DOM's: a pointer BELOW the centre pushes the panel's bottom edge away.
      mesh.rotation.set(
        float.pitch + -leanY * STAT_MOTION.lean,
        float.yaw + leanX * STAT_MOTION.lean,
        0,
      );
      mesh.position.z = lift;

      face.uniforms.uTime.value = frame.time;
      face.uniforms.uReveal.value = frame.reveal;
      face.uniforms.uIntensity.value = intensity * (1 + HOVER_GAIN * hover);
      glitch = lite ? 0 : Math.max(0, glitch - step / STAT_MOTION.glitch);
      face.uniforms.uGlitch.value = glitch;
    },

    setLite(next) {
      lite = next;
      if (next) {
        glitch = 0;
        face.uniforms.uGlitch.value = 0;
      }
    },

    setPalette(next) {
      paint(face, next);
      intensity = PANEL_INTENSITY[next.mode];
      face.uniforms.uIntensity.value = intensity;
    },

    dispose() {
      source.dispose();
      face.uniforms.uMap.value = null;
      geometry.dispose();
      face.material.dispose();
      group.clear();
    },
  };
}
