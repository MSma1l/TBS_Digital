/**
 * Geometry helpers for the scene's models — since 2026-10-28 only Work's helix
 * (models/helix.ts), the service models that shared them being gone.
 */

import { BufferGeometry, Float32BufferAttribute, type Matrix4, type Object3D } from "three";

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
