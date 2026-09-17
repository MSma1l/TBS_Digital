/**
 * Deterministic randomness for the orbit particles.
 *
 * No three.js and no `Math.random`: the React Compiler lint (`react-hooks/purity`) rejects
 * impure calls during render, and a seeded generator also makes the particle cloud the same
 * on every visit and in every test. Everything here is plain math, so the attributes are
 * unit-tested without a WebGL context.
 */

import { mulberry32 } from "@/components/three/random";

/** The PRNG is shared with the interior scene (`components/three/random.ts`). */
export { mulberry32 } from "@/components/three/random";

/** The default seed: the same cloud for every visitor. */
export const ORBIT_SEED = 0x7b5d1;

export type OrbitSpec = {
  /** Ellipse radii in scene units (before the rig's fit scale). */
  rx: number;
  ry: number;
  /** Angular speed in rad per unit of shader time; the sign sets the direction. */
  omega: number;
  /** Euler XYZ tilt of the orbit plane, radians. */
  tilt: readonly [number, number, number];
  /** Share of the particles on this orbit (the shares sum to 1). */
  share: number;
};

/** Three tilted orbits around the ∞, like electron shells around a nucleus. */
export const ORBITS: readonly OrbitSpec[] = [
  { rx: 2.35, ry: 0.95, omega: 0.32, tilt: [1.2, 0, 0.18], share: 0.42 },
  { rx: 2.05, ry: 1.25, omega: -0.24, tilt: [0.35, 0.55, -0.4], share: 0.33 },
  { rx: 1.55, ry: 0.7, omega: 0.52, tilt: [-0.9, -0.35, 0.6], share: 0.25 },
];

/** Phone portrait: the orbits grow taller and narrower so they stay on a tall screen. */
export const PORTRAIT_ORBIT_STRETCH = { rx: 0.8, ry: 1.5 } as const;

export type OrbitAttributes = {
  count: number;
  /** Orbit-plane basis vectors (xyz per particle), already tilted. */
  aAxisU: Float32Array;
  aAxisV: Float32Array;
  /** (rx, ry, ω) per particle. */
  aOrbit: Float32Array;
  /** Start angle per particle, [0, 2π). */
  aPhase: Float32Array;
  /** (radial jitter ∈ [-1, 1], normal jitter ∈ [-1, 1], size ∈ [0, 1)) per particle. */
  aSeed: Float32Array;
  /** Which orbit each particle belongs to (for tests and debugging; not uploaded). */
  orbitIndex: Uint8Array;
};

type Vec3 = [number, number, number];

/** Rotate `v` by an Euler XYZ rotation — three's default order, R = Rx · Ry · Rz. */
function rotateXYZ([x, y, z]: Vec3, [ax, ay, az]: readonly [number, number, number]): Vec3 {
  // Rz
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  const x1 = x * cz - y * sz;
  const y1 = x * sz + y * cz;
  const z1 = z;
  // Ry
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const x2 = x1 * cy + z1 * sy;
  const y2 = y1;
  const z2 = -x1 * sy + z1 * cy;
  // Rx
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  return [x2, y2 * cx - z2 * sx, y2 * sx + z2 * cx];
}

const GOLDEN = 0.6180339887498949;

/**
 * Which orbit particle `i` sits on. A golden-ratio sequence instead of consecutive blocks:
 * every prefix of the buffer holds all three orbits in about their shares, so the "lite"
 * mode can halve the particles with `setDrawRange(0, count / 2)` without emptying an orbit.
 */
function orbitFor(i: number): number {
  const x = (i * GOLDEN) % 1;
  let edge = 0;
  for (let o = 0; o < ORBITS.length; o += 1) {
    edge += ORBITS[o].share;
    if (x < edge) return o;
  }
  return ORBITS.length - 1;
}

/**
 * The per-particle attributes for `count` particles. Pure: the same (count, portrait, seed)
 * always gives byte-identical arrays. All motion happens in the vertex shader from these.
 */
export function buildOrbitAttributes(
  count: number,
  portrait: boolean,
  seed: number = ORBIT_SEED,
): OrbitAttributes {
  const n = Math.max(0, Math.floor(count));
  const random = mulberry32(seed);
  const aAxisU = new Float32Array(n * 3);
  const aAxisV = new Float32Array(n * 3);
  const aOrbit = new Float32Array(n * 3);
  const aPhase = new Float32Array(n);
  const aSeed = new Float32Array(n * 3);
  const orbitIndex = new Uint8Array(n);

  const stretchX = portrait ? PORTRAIT_ORBIT_STRETCH.rx : 1;
  const stretchY = portrait ? PORTRAIT_ORBIT_STRETCH.ry : 1;
  const bases = ORBITS.map((orbit) => ({
    u: rotateXYZ([1, 0, 0], orbit.tilt),
    v: rotateXYZ([0, 1, 0], orbit.tilt),
  }));

  for (let i = 0; i < n; i += 1) {
    const o = orbitFor(i);
    const orbit = ORBITS[o];
    const { u, v } = bases[o];
    orbitIndex[i] = o;
    aAxisU.set(u, i * 3);
    aAxisV.set(v, i * 3);
    // ±15% speed per particle: the cloud slowly shears instead of turning as a rigid ring.
    aOrbit[i * 3] = orbit.rx * stretchX;
    aOrbit[i * 3 + 1] = orbit.ry * stretchY;
    aOrbit[i * 3 + 2] = orbit.omega * (0.85 + random() * 0.3);
    aPhase[i] = random() * Math.PI * 2;
    // Sum of two uniforms: a triangular distribution, dense on the orbit, thin at the edges.
    aSeed[i * 3] = random() + random() - 1;
    aSeed[i * 3 + 1] = random() + random() - 1;
    aSeed[i * 3 + 2] = random();
  }

  return { count: n, aAxisU, aAxisV, aOrbit, aPhase, aSeed, orbitIndex };
}
