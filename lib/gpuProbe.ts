/**
 * The site's GPU probe cache: what probing a WebGL2 context answered, per mode, and the pure
 * WebGL decision made from it. Shared by the intro's capability probe, the interior stage and
 * `components/three/capability.ts`.
 *
 * Its own module, with no imports, so the intro's first-visit capability chunk (loaded from
 * the layout, where lib/scene.ts is not already on the page) does not carry the whole stage
 * contract and lib/directions.ts along with the probe. lib/scene.ts re-exports all of it: the
 * contract's names are unchanged.
 *
 * Not a `"use client"` module and nothing touches the DOM at import.
 */

/**
 * `sessionStorage[GPU_PROBE_CACHE_KEY]`: what probing a WebGL2 context answered, per mode,
 * for the rest of the tab's life. The intro's first-visit probe fills it, so a reload (and
 * the interior stage) never creates a throwaway context again. Booleans only — never the
 * renderer string, which would be a fingerprint.
 */
export const GPU_PROBE_CACHE_KEY = "tbs_gpu_probe";

/** `strict` asks with `failIfMajorPerformanceCaveat`; `forced` (a QA flag is set) without it. */
export type GpuMode = "strict" | "forced";

export type GpuFacts = {
  /** A WebGL2 context could be created. */
  context: boolean;
  /** It is drawn by a CPU rasteriser (SwiftShader, llvmpipe, WARP…). */
  software: boolean;
  /** A live scene lost its context while visible this session. */
  lost?: true;
  /** The FPS governor gave up on this device this session. */
  slow?: true;
};

export type GpuProbeCache = { v: 1; strict?: GpuFacts; forced?: GpuFacts };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A valid facts entry, rebuilt from its booleans only (unknown keys never survive), or null. */
function parseFacts(value: unknown): GpuFacts | null {
  if (!isRecord(value)) return null;
  if (typeof value.context !== "boolean" || typeof value.software !== "boolean") return null;
  if (value.lost !== undefined && value.lost !== true) return null;
  if (value.slow !== undefined && value.slow !== true) return null;
  const facts: GpuFacts = { context: value.context, software: value.software };
  if (value.lost === true) facts.lost = true;
  if (value.slow === true) facts.slow = true;
  return facts;
}

/**
 * Pure. The cache from its stored string, or null when it is missing, not JSON, another
 * version or not an object. A malformed mode entry is dropped, the valid one kept.
 */
export function parseGpuProbeCache(raw: string | null): GpuProbeCache | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1) return null;
  const cache: GpuProbeCache = { v: 1 };
  const strict = parseFacts(parsed.strict);
  const forced = parseFacts(parsed.forced);
  if (strict) cache.strict = strict;
  if (forced) cache.forced = forced;
  return cache;
}

function readCache(): GpuProbeCache | null {
  if (typeof window === "undefined") return null;
  try {
    return parseGpuProbeCache(window.sessionStorage.getItem(GPU_PROBE_CACHE_KEY));
  } catch {
    return null;
  }
}

/** The cached answer for `mode`, or null (nothing cached, storage blocked, server). */
export function readGpuFacts(mode: GpuMode): GpuFacts | null {
  return readCache()?.[mode] ?? null;
}

/**
 * Remember `facts` for `mode`. A strict answer that got a context also answers `forced` when
 * that is still unknown: dropping the caveat can only make a context MORE likely, and the
 * renderer is the same one. Storage errors are swallowed (the next probe simply runs again).
 */
export function writeGpuFacts(mode: GpuMode, facts: GpuFacts): void {
  if (typeof window === "undefined") return;
  const clean = parseFacts(facts);
  if (!clean) return;
  const cache: GpuProbeCache = readCache() ?? { v: 1 };
  cache[mode] = clean;
  if (mode === "strict" && clean.context && !cache.forced) {
    cache.forced = { context: true, software: clean.software };
  }
  try {
    window.sessionStorage.setItem(GPU_PROBE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked or full — nothing to remember with */
  }
}

/** A live scene lost its context, or was too slow: no WebGL for `mode` for the rest of the session. */
export function markGpu(kind: "lost" | "slow", mode: GpuMode): void {
  const facts: GpuFacts = readGpuFacts(mode) ?? { context: true, software: false };
  facts[kind] = true;
  writeGpuFacts(mode, facts);
}

/** Pure. Mount the WebGL scene for these facts? `force` accepts a software renderer. */
export function decideWebGL(facts: GpuFacts, force: boolean): boolean {
  return !facts.lost && !facts.slow && facts.context && (force || !facts.software);
}

/** Pure. Why `decideWebGL` said no (`data-reason`), or null when it said yes. */
export function reasonFor(
  facts: GpuFacts,
  force: boolean,
): "no-context" | "software" | "lost" | "slow" | null {
  if (!facts.context) return "no-context";
  if (facts.lost) return "lost";
  if (facts.slow) return "slow";
  if (facts.software && !force) return "software";
  return null;
}
