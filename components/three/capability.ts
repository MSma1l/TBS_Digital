/**
 * Can this device draw WebGL at all, and on what? The one GPU probe for the whole site —
 * the intro shell and the interior stage both ask it, and whatever one learned the other
 * reuses for the rest of the tab (`sessionStorage`, see `GPU_PROBE_CACHE_KEY` in lib/gpuProbe).
 *
 * No three.js here, and nothing runs at import: callers decide between WebGL and their
 * static fallback BEFORE any scene chunk is requested. The live gates (ResizeObserver,
 * reduced motion, Save-Data) belong to the callers and are never cached.
 */

import { writeGpuFacts, readGpuFacts, type GpuFacts, type GpuMode } from "@/lib/gpuProbe";

/**
 * Renderer names of the CPU rasterisers browsers fall back to when there is no usable GPU:
 * Chrome's SwiftShader (also headless CI), Mesa's llvmpipe/softpipe on Linux, WARP ("Microsoft
 * Basic Render Driver") on Windows, and the generic "Software Rasterizer". WebGL still works
 * on all of them — `failIfMajorPerformanceCaveat` does not reliably refuse them — but glass
 * with transmission at 5 fps is worse than the static art, so they get the art.
 */
export const SOFTWARE_RENDERER_PATTERN =
  /SwiftShader|llvmpipe|softpipe|Software Rasterizer|Microsoft Basic Render/i;

/* What `RENDERER` says when the browser masks it (Chromium/Safari: "WebKit WebGL", very old
   Firefox: "Mozilla"). Anything else is already the real, sanitised renderer. */
const MASKED_RENDERER = /^(WebKit WebGL|Mozilla)$/;

/**
 * Is this context drawn by a CPU rasteriser? Reads the plain `RENDERER` first: Firefox
 * already reports the real renderer there and logs a deprecation warning when a page asks
 * for `WEBGL_debug_renderer_info`, so the extension is only requested when `RENDERER` is
 * masked. Unknown (no extension, a throw, a non-string) counts as hardware.
 */
export function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  try {
    const plain: unknown = gl.getParameter(gl.RENDERER);
    if (typeof plain === "string" && !MASKED_RENDERER.test(plain)) {
      return SOFTWARE_RENDERER_PATTERN.test(plain);
    }
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    if (!info) return false;
    const unmasked: unknown = gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
    return typeof unmasked === "string" && SOFTWARE_RENDERER_PATTERN.test(unmasked);
  } catch {
    return false;
  }
}

/**
 * Create a WebGL2 context on a detached canvas, look at who draws it, and give it straight
 * back: browsers cap live contexts, and the probe must not hold a slot the real scene is
 * about to need.
 */
function probeContext(mode: GpuMode): GpuFacts {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: mode === "strict" });
    if (!gl) return { context: false, software: false };
    const software = isSoftwareRenderer(gl);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { context: true, software };
  } catch {
    return { context: false, software: false };
  }
}

/* Behind the session cache: a tab whose storage is blocked still probes only once per mode. */
let memo: Partial<Record<GpuMode, GpuFacts>> = {};

/**
 * Client only. The facts for `mode`: the session's cached answer (which also carries a
 * `lost` / `slow` mark a scene left), else this module's memo, else one detached-canvas
 * probe — whose answer is then remembered in both. A strict answer with a context also
 * answers `forced` (see `writeGpuFacts`).
 */
export function probeGpu(mode: GpuMode): GpuFacts {
  const cached = readGpuFacts(mode);
  if (cached) return cached;
  const remembered = memo[mode];
  if (remembered) return remembered;

  const facts = probeContext(mode);
  memo[mode] = facts;
  if (mode === "strict" && facts.context && !memo.forced) {
    memo.forced = { context: true, software: facts.software };
  }
  writeGpuFacts(mode, facts);
  return facts;
}

/**
 * The `dpr` range to hand a canvas. Never above the device's own ratio (rendering pixels the
 * screen can't show), never above `range`'s cap, and within `pixelBudget` device pixels when
 * one is given — but never below 1× on a normal screen, where a softer image would read as a
 * bug. A nonsense device ratio counts as 1×.
 */
export function clampDprRange(
  range: readonly [number, number],
  w: number,
  h: number,
  deviceDpr: number,
  pixelBudget?: number,
): [number, number] {
  const device = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const [rangeMin, rangeMax] = range;
  const min = Math.min(rangeMin, device);
  let max = Math.min(rangeMax, device);
  if (pixelBudget !== undefined) {
    max = Math.min(max, Math.sqrt(pixelBudget / Math.max(1, w * h)));
  }
  return [min, Math.max(min, max)];
}

/** Unit tests only: forget what this module instance probed. */
export function resetGpuProbeForTests(): void {
  memo = {};
}
