/**
 * The contract every service model implements, and the geometry helpers they share.
 *
 * A model is built once per canvas, at its tier's detail. The world places its root `group`
 * (position, scale, sway) on the services host every frame, whether it is shown or not — the
 * morph swarm reads that matrix to land on the model's silhouette (samples.ts) — and calls
 * `update` only while the model is revealed (or pre-warmed for one frame).
 */

import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  type Group,
  type Object3D,
} from "three";
import type { ServiceModel } from "@/lib/scene";
import type { ScenePalette } from "../palette";

export type ModelFrame = {
  /** Scene time and this frame's clamped step, seconds. */
  time: number;
  step: number;
  /** 0 hidden → 1 formed (a voxel dissolve in between). */
  reveal: number;
  /** Draw this frame even at reveal 0 (every fragment discards; buffers upload). */
  prewarm: boolean;
  /** Smoothed pointer / gyro tilt, -1..1. */
  tx: number;
  ty: number;
  /** Half the drawing buffer's height (device px) and the pixel ratio, for sprite sizes. */
  halfHeightPx: number;
  dpr: number;
};

export type SceneModel = {
  kind: ServiceModel;
  /** Placed by the world; the model animates inside it. */
  group: Group;
  /** Compiled in one idle slice. */
  objects: Object3D[];
  /** Called when the model starts to reveal, so it matches its swarm samples. */
  resetCycle(): void;
  update(frame: ModelFrame): void;
  setLite(lite: boolean): void;
  setPalette(palette: ScenePalette): void;
  dispose(): void;
};

/** Frustum culling off (shaders displace vertices) and a draw order. */
export function place<T extends Object3D>(object: T, renderOrder: number): T {
  object.renderOrder = renderOrder;
  object.frustumCulled = false;
  return object;
}

/**
 * One draw call out of several parts: each geometry is transformed by its matrix, un-indexed
 * and appended, with a per-vertex `aTag` float (which part it came from). Positions, normals
 * and uvs are kept; the source geometries are disposed.
 */
export function mergeTagged(parts: ReadonlyArray<{ geometry: BufferGeometry; matrix?: Matrix4; tag: number }>): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const tags: number[] = [];
  for (const part of parts) {
    const flat = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
    if (part.matrix) flat.applyMatrix4(part.matrix);
    const position = flat.getAttribute("position");
    const normal = flat.getAttribute("normal");
    const uv = flat.getAttribute("uv");
    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      normals.push(normal ? normal.getX(i) : 0, normal ? normal.getY(i) : 0, normal ? normal.getZ(i) : 1);
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      tags.push(part.tag);
    }
    if (flat !== part.geometry) flat.dispose();
    part.geometry.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute("position", new Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  merged.setAttribute("aTag", new Float32BufferAttribute(tags, 1));
  return merged;
}

/** How far a model sways about y (radians) and how fast (rad/s of the sine's phase). */
export const MODEL_SWAY = { amplitude: 0.42, speed: 0.22 } as const;
