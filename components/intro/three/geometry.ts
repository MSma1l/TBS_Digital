/**
 * The ∞'s geometry: the lemniscate as a three.js curve, the glass tube around it, the thin
 * "frequency" line inside, and the scan rings that fill with the progress counter.
 *
 * The curve is `lemniscatePoint` — the same function the SVG fallback's path is drawn
 * from — so the fallback and the 3D model are the same shape.
 */

import {
  BufferGeometry,
  Curve,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from "three";
import type { TierConfig } from "../tiers";
import { LEMNISCATE, lemniscatePoint } from "../lemniscate";

export class LemniscateCurve extends Curve<Vector3> {
  // @types/three declares Curve's constructor protected; subclasses re-expose it.
  constructor() {
    super();
  }

  override getPoint(u: number, target: Vector3 = new Vector3()): Vector3 {
    const [x, y, z] = lemniscatePoint(u);
    return target.set(x, y, z);
  }
}

export const CORE_SHAPE = {
  /** Glass tube radius (0.32 across < the 0.56 between the strands at the crossing). */
  tube: LEMNISCATE.tube,
  /** The pulse line running inside the glass. */
  line: 0.028,
  lineRadial: 6,
  /** Scan rings sit just outside the glass. */
  ring: 0.22,
  ringSegments: 32,
} as const;

/**
 * `count` circles around the curve, spaced by arc length, in each point's normal/binormal
 * plane (Frenet frames, twist-corrected for a closed curve). One `LineSegments` draw call;
 * `aU` carries each ring's position along the ∞ so the shader can fill them in order.
 */
export function createScanRings(
  curve: Curve<Vector3>,
  count: number,
  radius: number = CORE_SHAPE.ring,
  segments: number = CORE_SHAPE.ringSegments,
): BufferGeometry {
  const frames = curve.computeFrenetFrames(count, true);
  const positions = new Float32Array(count * segments * 2 * 3);
  const along = new Float32Array(count * segments * 2);
  const center = new Vector3();
  const offset = new Vector3();
  let vertex = 0;

  for (let i = 0; i < count; i += 1) {
    const u = i / count;
    curve.getPointAt(u, center);
    const normal = frames.normals[i];
    const binormal = frames.binormals[i];
    for (let s = 0; s < segments; s += 1) {
      for (const k of [s, s + 1]) {
        const angle = (k / segments) * Math.PI * 2;
        offset
          .copy(normal)
          .multiplyScalar(Math.cos(angle) * radius)
          .addScaledVector(binormal, Math.sin(angle) * radius)
          .add(center);
        positions[vertex * 3] = offset.x;
        positions[vertex * 3 + 1] = offset.y;
        positions[vertex * 3 + 2] = offset.z;
        along[vertex] = u;
        vertex += 1;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aU", new Float32BufferAttribute(along, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export type CoreGeometry = {
  curve: LemniscateCurve;
  /** The glass tube; its uv.x runs 0 → 1 along the ∞ (arc length). */
  tube: TubeGeometry;
  line: TubeGeometry;
  /** `null` on tiers without rings. */
  rings: BufferGeometry | null;
  dispose(): void;
};

export function createCoreGeometry(config: TierConfig): CoreGeometry {
  const curve = new LemniscateCurve();
  const tube = new TubeGeometry(curve, config.tubular, CORE_SHAPE.tube, config.radial, true);
  const line = new TubeGeometry(
    curve,
    config.tubular,
    CORE_SHAPE.line,
    CORE_SHAPE.lineRadial,
    true,
  );
  const rings = config.rings > 0 ? createScanRings(curve, config.rings) : null;
  return {
    curve,
    tube,
    line,
    rings,
    dispose() {
      tube.dispose();
      line.dispose();
      rings?.dispose();
    },
  };
}
