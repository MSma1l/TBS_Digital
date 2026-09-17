/**
 * Deterministic randomness for every 3D scene on the site.
 *
 * No three.js and no `Math.random`: the React Compiler lint (`react-hooks/purity`) rejects
 * impure calls during render, and a seeded generator makes a particle cloud or a layout the
 * same on every visit and in every test.
 */

/** mulberry32 — a tiny 32-bit PRNG. Returns a generator of floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
