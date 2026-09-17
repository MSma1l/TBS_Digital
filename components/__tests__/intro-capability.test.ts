import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { probeIntroCapability } from "@/components/intro/capability";
import { resetGpuProbeForTests } from "@/components/three/capability";
import { INTRO_FORCE_3D_KEY } from "@/lib/intro";
import { GPU_PROBE_CACHE_KEY } from "@/lib/scene";

/*
 * The WebGL gate, in jsdom. The order of its checks is the contract: nothing may create a
 * canvas context before ResizeObserver, reduced motion and Save-Data have all said yes —
 * jsdom has no ResizeObserver, so the real suite never reaches `getContext`.
 *
 * The GPU answer is remembered for the tab (sessionStorage + a module memo, shared with the
 * interior stage), so every case starts with both forgotten.
 */

type GetContext = HTMLCanvasElement["getContext"];

const realMatchMedia = window.matchMedia;

function mockMatchMedia(matching: (query: string) => boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matching(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function stubGetContext(implementation: () => unknown) {
  return vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(implementation as unknown as GetContext);
}

let getContext: ReturnType<typeof stubGetContext>;
let loseContext: ReturnType<typeof vi.fn>;

/** A context whose only job is to be given back through WEBGL_lose_context. */
function fakeContext() {
  return {
    getExtension: (name: string) => (name === "WEBGL_lose_context" ? { loseContext } : null),
  };
}

const RENDERER = 0x1f01;
const UNMASKED_RENDERER_WEBGL = 0x9246;

/**
 * A context that answers `getParameter(RENDERER)` like a browser does: Chromium masks it
 * ("WebKit WebGL") and reports the real renderer through WEBGL_debug_renderer_info;
 * Firefox reports it straight away. `debugInfo: false` = the extension is unavailable.
 */
function rendererContext({
  plain = "WebKit WebGL",
  unmasked,
  debugInfo = true,
}: {
  plain?: string;
  unmasked?: string;
  debugInfo?: boolean;
}) {
  const getExtension = vi.fn((name: string) => {
    if (name === "WEBGL_lose_context") return { loseContext };
    if (name === "WEBGL_debug_renderer_info" && debugInfo) return { UNMASKED_RENDERER_WEBGL };
    return null;
  });
  return {
    RENDERER,
    getExtension,
    getParameter: (pname: number) => {
      if (pname === RENDERER) return plain;
      if (pname === UNMASKED_RENDERER_WEBGL) return unmasked;
      return null;
    },
  };
}

beforeEach(() => {
  // restoreMocks wipes implementations between tests, so every stub is (re)built here.
  loseContext = vi.fn();
  getContext = stubGetContext(() => null);
  window.localStorage.removeItem(INTRO_FORCE_3D_KEY);
  resetGpuProbeForTests();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  window.localStorage.removeItem(INTRO_FORCE_3D_KEY);
  sessionStorage.clear();
});

describe("probeIntroCapability", () => {
  it("says no WebGL in plain jsdom (no ResizeObserver) without touching a canvas", () => {
    expect(typeof window.ResizeObserver).toBe("undefined");
    expect(probeIntroCapability().webgl).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it("says no WebGL under reduced motion without touching a canvas", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    mockMatchMedia((query) => query.includes("prefers-reduced-motion"));
    expect(probeIntroCapability().webgl).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it("says no WebGL when the visitor asked to save data, without touching a canvas", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    try {
      expect(probeIntroCapability().webgl).toBe(false);
      expect(getContext).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "connection");
    }
  });

  it("says no WebGL when a WebGL2 context cannot be created", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    expect(probeIntroCapability().webgl).toBe(false);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalledWith("webgl2", { failIfMajorPerformanceCaveat: true });
  });

  it("says no WebGL when creating the context throws", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    getContext.mockImplementation((() => {
      throw new Error("context creation failed");
    }) as unknown as GetContext);
    expect(probeIntroCapability().webgl).toBe(false);
  });

  it("says WebGL when the context exists, and gives the probe context straight back", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    getContext.mockImplementation((() => fakeContext()) as unknown as GetContext);
    expect(probeIntroCapability().webgl).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("drops the performance caveat only when QA forces 3D", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    getContext.mockImplementation((() => fakeContext()) as unknown as GetContext);
    window.localStorage.setItem(INTRO_FORCE_3D_KEY, "force");
    const capability = probeIntroCapability();
    expect(capability.force3d).toBe(true);
    expect(getContext).toHaveBeenCalledWith("webgl2", { failIfMajorPerformanceCaveat: false });
  });

  describe("software renderers get the SVG", () => {
    const SOFTWARE = [
      "Google SwiftShader",
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "softpipe",
      "Software Rasterizer",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
    ];

    it.each(SOFTWARE)("says no WebGL for %s, and still gives the probe context back", (name) => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({ unmasked: name })) as unknown as GetContext);
      expect(probeIntroCapability().webgl).toBe(false);
      expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it("reads an unmasked RENDERER (Firefox) without asking for the debug extension", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      const gl = rendererContext({ plain: "llvmpipe, or similar" });
      getContext.mockImplementation((() => gl) as unknown as GetContext);
      expect(probeIntroCapability().webgl).toBe(false);
      expect(gl.getExtension).not.toHaveBeenCalledWith("WEBGL_debug_renderer_info");
      expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it("keeps WebGL on a hardware renderer", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({
          unmasked: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        })) as unknown as GetContext);
      expect(probeIntroCapability().webgl).toBe(true);
      expect(loseContext).toHaveBeenCalledTimes(1);
    });

    it("keeps WebGL when the renderer can't be read (no debug extension)", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({ debugInfo: false })) as unknown as GetContext);
      expect(probeIntroCapability().webgl).toBe(true);
    });

    it("keeps WebGL on a software renderer when QA forces 3D", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      window.localStorage.setItem(INTRO_FORCE_3D_KEY, "force");
      getContext.mockImplementation((() =>
        rendererContext({ unmasked: "Google SwiftShader" })) as unknown as GetContext);
      const capability = probeIntroCapability();
      expect(capability).toMatchObject({ webgl: true, force3d: true });
      expect(loseContext).toHaveBeenCalledTimes(1);
    });
  });

  describe("the answer is remembered for the tab", () => {
    it("answers a second call from the session: one probe context, given back once", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({ unmasked: "ANGLE (Apple, Apple M2, OpenGL 4.1)" })) as unknown as GetContext);

      expect(probeIntroCapability().webgl).toBe(true);
      expect(probeIntroCapability().webgl).toBe(true);
      expect(getContext).toHaveBeenCalledTimes(1);
      expect(loseContext).toHaveBeenCalledTimes(1);
      expect(JSON.parse(sessionStorage.getItem(GPU_PROBE_CACHE_KEY) ?? "null")).toMatchObject({
        v: 1,
        strict: { context: true, software: false },
      });
    });

    it("keeps no renderer name in the session, only yes/no values", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({ unmasked: "Google SwiftShader" })) as unknown as GetContext);

      expect(probeIntroCapability().webgl).toBe(false);
      const stored = sessionStorage.getItem(GPU_PROBE_CACHE_KEY) ?? "";
      expect(stored).not.toMatch(/SwiftShader/i);
      expect(JSON.parse(stored)).toEqual({
        v: 1,
        strict: { context: true, software: true },
        forced: { context: true, software: true },
      });
    });

    it("a strict answer with a context also answers a forced visit, without probing again", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() =>
        rendererContext({ unmasked: "Google SwiftShader" })) as unknown as GetContext);

      expect(probeIntroCapability()).toMatchObject({ webgl: false, force3d: false });
      window.localStorage.setItem(INTRO_FORCE_3D_KEY, "force");
      expect(probeIntroCapability()).toMatchObject({ webgl: true, force3d: true });
      expect(getContext).toHaveBeenCalledTimes(1);
    });

    it("a strict answer without a context says nothing about a forced visit", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);

      expect(probeIntroCapability().webgl).toBe(false);
      window.localStorage.setItem(INTRO_FORCE_3D_KEY, "force");
      probeIntroCapability();
      expect(getContext).toHaveBeenCalledTimes(2);
      expect(getContext).toHaveBeenLastCalledWith("webgl2", { failIfMajorPerformanceCaveat: false });
    });

    it.each(["lost", "slow"] as const)(
      "says no WebGL, without a probe, once a scene marked the GPU %s this session",
      (mark) => {
        vi.stubGlobal("ResizeObserver", StubResizeObserver);
        sessionStorage.setItem(
          GPU_PROBE_CACHE_KEY,
          JSON.stringify({ v: 1, strict: { context: true, software: false, [mark]: true } }),
        );

        expect(probeIntroCapability().webgl).toBe(false);
        expect(getContext).not.toHaveBeenCalled();
      },
    );

    it("probes again when the stored answer is not one it wrote", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      getContext.mockImplementation((() => fakeContext()) as unknown as GetContext);
      sessionStorage.setItem(GPU_PROBE_CACHE_KEY, '{"v":1,"strict":{"context":"yes"}}');

      expect(probeIntroCapability().webgl).toBe(true);
      expect(getContext).toHaveBeenCalledTimes(1);
    });

    it("never reads or writes the cache when a live gate already said no", () => {
      vi.stubGlobal("ResizeObserver", StubResizeObserver);
      mockMatchMedia((query) => query.includes("prefers-reduced-motion"));

      expect(probeIntroCapability().webgl).toBe(false);
      expect(sessionStorage.getItem(GPU_PROBE_CACHE_KEY)).toBeNull();
    });
  });

  it("allows parallax only for a fine, hovering pointer", () => {
    mockMatchMedia((query) => query.includes("pointer: fine") && query.includes("hover: hover"));
    expect(probeIntroCapability().parallax).toBe(true);
    mockMatchMedia(() => false);
    expect(probeIntroCapability().parallax).toBe(false);
  });
});
