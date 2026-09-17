/**
 * "Produs digital": 27 glass-edged cubes that hold a software block, burst apart, drift, and
 * re-assemble as a phone slab — then back again. One instanced draw; the box-edge factor in
 * the surface shader lights the edges and leaves the faces faint.
 *
 * Cycle (7.2 s): hold (1.4) → explode (0.8) → float (2.2) → assemble into the other layout
 * (1.4, staggered per cube) → hold with an edge "lock" flash (1.4).
 */

import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mulberry32 } from "@/components/three/random";
import { CUBE_LAYOUTS, type CubeLayout } from "../../shapes";
import type { SceneTierConfig } from "../../tiers";
import { SURFACE_MODE, createSurfaceMaterial, paint } from "../materials";
import type { ScenePalette } from "../palette";
import { MODEL_POSES, MODEL_SCALES } from "../samples";
import { place, type SceneModel } from "./types";

export const CUBE_CYCLE = { hold: 1.4, explode: 0.8, float: 2.2, assemble: 1.4, lock: 1.4 } as const;
const CYCLE_SECONDS = CUBE_CYCLE.hold + CUBE_CYCLE.explode + CUBE_CYCLE.float + CUBE_CYCLE.assemble + CUBE_CYCLE.lock;
const MAX_STAGGER = 0.35;

const easeOut = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeInOut = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export function createCubesModel(config: SceneTierConfig, palette: ScenePalette): SceneModel {
  const group = new Group();
  group.name = "scene-model-cubes";
  const pose = new Group();
  pose.rotation.set(MODEL_POSES.cubes[0], MODEL_POSES.cubes[1], MODEL_POSES.cubes[2]);
  pose.scale.setScalar(MODEL_SCALES.cubes);
  group.add(pose);

  const count = Math.min(config.cubes, CUBE_LAYOUTS.cube.slots.length);
  const geometry = new BoxGeometry(1, 1, 1);
  const surface = createSurfaceMaterial({
    mode: SURFACE_MODE.edges,
    roles: { a: "cyan", b: "blue", hot: "hot" },
    instanced: true,
  });
  const mesh = place(new InstancedMesh(geometry, surface.material, count), 5);
  pose.add(mesh);

  // Seeded float slots and tumbles, fixed for life.
  const random = mulberry32(0xc0be5);
  const floats = Array.from({ length: count }, () => {
    const z = random() * 2 - 1;
    const phi = random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const radius = 1.2 + 0.5 * random();
    return {
      home: new Vector3(r * Math.cos(phi) * radius, z * radius * 0.85, r * Math.sin(phi) * radius),
      axis: new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
      spin: 1.2 + 1.4 * random(),
      phase: random() * Math.PI * 2,
      stagger: random() * MAX_STAGGER,
    };
  });

  const layouts: readonly CubeLayout[] = [CUBE_LAYOUTS.cube, CUBE_LAYOUTS.slab];
  const matrix = new Matrix4();
  const position = new Vector3();
  const drift = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const tint = new Color();
  const from = new Vector3();
  const to = new Vector3();
  let clock = 0;
  let layout = 0;
  let time = 0;

  const slot = (index: number, i: number, out: Vector3) => {
    const s = layouts[index].slots[i];
    return out.set(s[0], s[1], s[2]);
  };
  const size = (index: number) => layouts[index].size * layouts[index].scale;

  const write = (reveal: number) => {
    const next = 1 - layout;
    const floatSize = 0.8 * size(0);
    const tExplode = CUBE_CYCLE.hold;
    const tFloat = tExplode + CUBE_CYCLE.explode;
    const tAssemble = tFloat + CUBE_CYCLE.float;
    const tLock = tAssemble + CUBE_CYCLE.assemble;
    for (let i = 0; i < count; i += 1) {
      const f = floats[i];
      drift.set(
        Math.sin(time * 0.9 + f.phase) * 0.08,
        Math.cos(time * 0.7 + f.phase * 1.3) * 0.08,
        Math.sin(time * 0.8 + f.phase * 0.7) * 0.08,
      );
      let angle = 0;
      let s = size(layout);
      let glow = 1;
      if (clock < tExplode) {
        slot(layout, i, position);
      } else if (clock < tFloat) {
        const k = easeOut((clock - tExplode) / CUBE_CYCLE.explode);
        slot(layout, i, from);
        to.copy(f.home).addScaledVector(drift, k);
        position.lerpVectors(from, to, k);
        angle = f.spin * k;
        s = size(layout) + (floatSize - size(layout)) * k;
        glow = 1 + 0.15 * k;
      } else if (clock < tAssemble) {
        position.copy(f.home).add(drift);
        angle = f.spin + (clock - tFloat) * 0.6;
        s = floatSize;
        glow = 1.15;
      } else if (clock < tLock) {
        const k = easeInOut((clock - tAssemble - f.stagger) / (CUBE_CYCLE.assemble - MAX_STAGGER));
        from.copy(f.home).add(drift);
        slot(next, i, to);
        position.lerpVectors(from, to, k);
        angle = (f.spin + CUBE_CYCLE.float * 0.6) * (1 - k);
        s = floatSize + (size(next) - floatSize) * k;
        glow = 1.15 - 0.15 * k;
      } else {
        slot(next, i, position);
        s = size(next);
        glow = 1 + 1.6 * Math.exp(-(clock - tLock) * 4);
      }
      quaternion.setFromAxisAngle(f.axis, angle);
      scale.setScalar(s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint.setScalar(glow));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    surface.uniforms.uReveal.value = reveal;
  };

  paint(surface, palette);
  write(1);

  return {
    kind: "cubes",
    group,
    objects: [group],

    resetCycle() {
      clock = 0;
      layout = 0;
    },

    update(frame) {
      group.visible = frame.reveal > 0 || frame.prewarm;
      if (!group.visible) return;
      time = frame.time;
      clock += frame.step;
      if (clock >= CYCLE_SECONDS) {
        clock -= CYCLE_SECONDS;
        layout = 1 - layout;
      }
      surface.uniforms.uTime.value = frame.time;
      write(frame.reveal);
    },

    setLite() {
      // 27 boxes in one draw: nothing worth dropping.
    },

    setPalette(next) {
      paint(surface, next);
    },

    dispose() {
      geometry.dispose();
      surface.material.dispose();
      mesh.dispose();
    },
  };
}
