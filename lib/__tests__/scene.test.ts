import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directions } from "@/lib/directions";
import {
  GPU_PROBE_CACHE_KEY,
  PARALLAX_LAYERS,
  SCENE_3D_KEY,
  SCENE_ATTR,
  SCENE_SHAPES,
  SCENE_TESTID,
  SCENE_TIMING,
  SERVICE_MODEL,
  createScrollProbe,
  decideWebGL,
  markGpu,
  parseGpuProbeCache,
  readGpuFacts,
  readMotionGate,
  readSceneFlag,
  readSceneInput,
  reasonFor,
  resetSceneForTests,
  scrollProgress,
  selectSceneShape,
  setSceneBoost,
  shapeIndex,
  subscribeSceneInput,
  writeGpuFacts,
  type GpuFacts,
} from "@/lib/scene";

/*
 * The interior stage contract (lib/scene.ts): storage, the WebGL decision, the scroll maths
 * and the page → scene input store. Pure or storage-only — no WebGL anywhere.
 */

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

beforeEach(() => {
  resetSceneForTests();
  sessionStorage.clear();
  localStorage.removeItem(SCENE_3D_KEY);
});

afterEach(() => {
  // First: the no-DOM describe stubs `window` itself away.
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(navigator, "connection");
  sessionStorage.clear();
  localStorage.removeItem(SCENE_3D_KEY);
});

describe("the QA flag", () => {
  it("reads only force and off", () => {
    expect(SCENE_3D_KEY).toBe("tbs_scene_3d");
    expect(readSceneFlag()).toBeNull();
    for (const value of ["force", "off"] as const) {
      localStorage.setItem(SCENE_3D_KEY, value);
      expect(readSceneFlag()).toBe(value);
    }
    localStorage.setItem(SCENE_3D_KEY, "FORCE");
    expect(readSceneFlag()).toBeNull();
  });

  it("is null when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSceneFlag()).toBeNull();
  });
});

describe("parseGpuProbeCache", () => {
  const table: Array<[string, string | null, unknown]> = [
    ["nothing stored", null, null],
    ["not JSON", "{nope", null],
    ["another version", '{"v":2,"strict":{"context":true,"software":false}}', null],
    ["an array", "[1]", null],
    ["an empty v1", '{"v":1}', { v: 1 }],
    [
      "both modes",
      '{"v":1,"strict":{"context":true,"software":true},"forced":{"context":false,"software":false}}',
      { v: 1, strict: { context: true, software: true }, forced: { context: false, software: false } },
    ],
    [
      "the marks, and never an unknown key (a renderer string)",
      '{"v":1,"strict":{"context":true,"software":false,"lost":true,"slow":true,"renderer":"ANGLE"}}',
      { v: 1, strict: { context: true, software: false, lost: true, slow: true } },
    ],
    [
      "a malformed entry is dropped, the valid one kept",
      '{"v":1,"strict":{"context":"yes","software":false},"forced":{"context":true,"software":false}}',
      { v: 1, forced: { context: true, software: false } },
    ],
    ["a mark that is not true", '{"v":1,"strict":{"context":true,"software":false,"lost":1}}', { v: 1 }],
  ];

  for (const [name, raw, expected] of table) {
    it(name, () => {
      expect(parseGpuProbeCache(raw)).toEqual(expected);
    });
  }
});

describe("the session cache", () => {
  it("round-trips per mode, and a strict answer with a context also answers forced", () => {
    expect(GPU_PROBE_CACHE_KEY).toBe("tbs_gpu_probe");
    expect(readGpuFacts("strict")).toBeNull();

    writeGpuFacts("strict", { context: true, software: true });
    expect(readGpuFacts("strict")).toEqual({ context: true, software: true });
    expect(readGpuFacts("forced")).toEqual({ context: true, software: true });
  });

  it("never lets a strict answer overwrite a forced one that is already known", () => {
    writeGpuFacts("forced", { context: true, software: true, lost: true });
    writeGpuFacts("strict", { context: true, software: true });
    expect(readGpuFacts("forced")).toEqual({ context: true, software: true, lost: true });
  });

  it("a strict answer without a context says nothing about forced", () => {
    writeGpuFacts("strict", { context: false, software: false });
    expect(readGpuFacts("forced")).toBeNull();
  });

  it("markGpu adds a mark to the mode's facts (or to a context it never probed)", () => {
    writeGpuFacts("forced", { context: true, software: true });
    markGpu("lost", "forced");
    expect(readGpuFacts("forced")).toEqual({ context: true, software: true, lost: true });

    markGpu("slow", "strict");
    expect(readGpuFacts("strict")).toEqual({ context: true, software: false, slow: true });
  });

  it("stores booleans only", () => {
    writeGpuFacts("strict", { context: true, software: false, renderer: "Apple M2" } as GpuFacts);
    expect(sessionStorage.getItem(GPU_PROBE_CACHE_KEY)).not.toMatch(/Apple/);
  });

  it("is quiet when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeGpuFacts("strict", { context: true, software: false })).not.toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readGpuFacts("strict")).toBeNull();
  });
});

describe("decideWebGL and reasonFor", () => {
  const table: Array<[GpuFacts, boolean, boolean, ReturnType<typeof reasonFor>]> = [
    [{ context: true, software: false }, false, true, null],
    [{ context: true, software: true }, false, false, "software"],
    [{ context: true, software: true }, true, true, null],
    [{ context: false, software: false }, false, false, "no-context"],
    [{ context: false, software: false }, true, false, "no-context"],
    [{ context: true, software: false, lost: true }, false, false, "lost"],
    [{ context: true, software: true, lost: true }, true, false, "lost"],
    [{ context: true, software: false, slow: true }, false, false, "slow"],
    [{ context: true, software: true, slow: true }, true, false, "slow"],
    [{ context: true, software: true, lost: true, slow: true }, false, false, "lost"],
  ];

  for (const [facts, force, decision, reason] of table) {
    it(`${JSON.stringify(facts)} force=${force} → ${decision} (${reason})`, () => {
      expect(decideWebGL(facts, force)).toBe(decision);
      expect(reasonFor(facts, force)).toBe(reason);
    });
  }
});

describe("readMotionGate", () => {
  it("is unsupported without ResizeObserver, before anything else", () => {
    mockMatchMedia(() => true);
    expect(typeof window.ResizeObserver).toBe("undefined");
    expect(readMotionGate()).toBe("unsupported");
  });

  it("then reduced motion, then Save-Data, then a 2G connection", () => {
    vi.stubGlobal("ResizeObserver", StubResizeObserver);
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "slow-2g" },
    });
    mockMatchMedia((query) => query.includes("prefers-reduced-motion"));
    expect(readMotionGate()).toBe("reduced-motion");

    mockMatchMedia(() => false);
    expect(readMotionGate()).toBe("save-data");

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false, effectiveType: "2g" },
    });
    expect(readMotionGate()).toBe("network");

    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "4g" },
    });
    expect(readMotionGate()).toBe("ok");
  });
});

describe("scrollProgress", () => {
  const span = { start: 100, end: 300 };
  const table: Array<[number, { start: number; end: number }, number]> = [
    [0, span, 0],
    [100, span, 0],
    [200, span, 0.5],
    [300, span, 1],
    [900, span, 1],
    [99, { start: 100, end: 100 }, 0],
    [100, { start: 100, end: 100 }, 1],
    [150, { start: 200, end: 100 }, 0],
    [250, { start: 200, end: 100 }, 1],
    [Number.NaN, span, 0],
  ];

  for (const [scroll, s, expected] of table) {
    it(`${scroll} over ${s.start}→${s.end} is ${expected}`, () => {
      expect(scrollProgress(scroll, s)).toBe(expected);
    });
  }

  it("starts from an unmeasured probe", () => {
    expect(createScrollProbe()).toEqual({
      live: false,
      version: 0,
      headerH: 0,
      stage: { top: 0, bottom: 0 },
      hero: null,
      services: null,
      heroExit: { start: 0, end: 0 },
      entry: { start: 0, end: 0 },
    });
    expect(createScrollProbe()).not.toBe(createScrollProbe());
  });
});

describe("directions → models", () => {
  it("SCENE_SHAPES are the direction slugs, in the Directions order", () => {
    expect([...SCENE_SHAPES]).toEqual(directions.map((d) => d.slug));
  });

  it("maps every direction to its own model", () => {
    expect(Object.keys(SERVICE_MODEL).sort()).toEqual([...SCENE_SHAPES].sort());
    expect(new Set(Object.values(SERVICE_MODEL)).size).toBe(SCENE_SHAPES.length);
    expect(SERVICE_MODEL).toEqual({
      "produs-digital": "cubes",
      "e-commerce": "commerce-loop",
      "automatizare-api": "integration-hub",
      "asistenti-ia": "neural",
      "brand-ui": "mesh-wave",
    });
  });

  it("shapeIndex takes current and legacy slugs, and -1 for anything else", () => {
    SCENE_SHAPES.forEach((slug, i) => expect(shapeIndex(slug)).toBe(i));
    expect(shapeIndex("ecommerce")).toBe(1);
    expect(shapeIndex("ai")).toBe(3);
    expect(shapeIndex("nope")).toBe(-1);
    expect(shapeIndex("")).toBe(-1);
  });
});

describe("the input store", () => {
  it("starts idle on the first direction", () => {
    expect(readSceneInput()).toEqual({ boost: 0, waveSeq: 0, shape: 0 });
  });

  it("boosts while any CTA is active, and counts a wave on the rising edge only", () => {
    setSceneBoost("hero-primary", true);
    expect(readSceneInput()).toEqual({ boost: 1, waveSeq: 1, shape: 0 });

    // Moving to the other CTA without leaving the boost: no second wave.
    setSceneBoost("hero-secondary", true);
    setSceneBoost("hero-primary", false);
    expect(readSceneInput()).toEqual({ boost: 1, waveSeq: 1, shape: 0 });

    setSceneBoost("hero-secondary", false);
    expect(readSceneInput()).toEqual({ boost: 0, waveSeq: 1, shape: 0 });

    setSceneBoost("hero-primary", true);
    expect(readSceneInput().waveSeq).toBe(2);
  });

  it("a repeated enter or leave from the same source changes nothing", () => {
    setSceneBoost("hero-primary", true);
    setSceneBoost("hero-primary", true);
    expect(readSceneInput().waveSeq).toBe(1);
    setSceneBoost("hero-secondary", false);
    expect(readSceneInput().boost).toBe(1);
  });

  it("selects a shape by current or legacy slug, and ignores an unknown one", () => {
    selectSceneShape("asistenti-ia");
    expect(readSceneInput().shape).toBe(3);
    selectSceneShape("brand");
    expect(readSceneInput().shape).toBe(4);
    selectSceneShape("nope");
    expect(readSceneInput().shape).toBe(4);
  });

  it("publishes a new frozen snapshot per change and notifies only on a change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSceneInput(listener);
    const before = readSceneInput();

    selectSceneShape("produs-digital");
    expect(listener).not.toHaveBeenCalled();
    expect(readSceneInput()).toBe(before);

    selectSceneShape("e-commerce");
    expect(listener).toHaveBeenCalledTimes(1);
    const after = readSceneInput();
    expect(after).not.toBe(before);
    expect(Object.isFrozen(after)).toBe(true);

    unsubscribe();
    setSceneBoost("hero-primary", true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("resetSceneForTests forgets boosts, shape and subscribers", () => {
    const listener = vi.fn();
    subscribeSceneInput(listener);
    setSceneBoost("hero-primary", true);
    selectSceneShape("brand-ui");
    resetSceneForTests();
    expect(readSceneInput()).toEqual({ boost: 0, waveSeq: 0, shape: 0 });
    setSceneBoost("hero-primary", true);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("the DOM contract", () => {
  it("names the hooks the stage, the sections and the E2E suite share", () => {
    expect(SCENE_TESTID).toEqual({
      stage: "scene-stage",
      hero: "scene-hero",
      services: "scene-services",
    });
    expect(Object.values(SCENE_ATTR).every((name) => name.startsWith("data-"))).toBe(true);
    expect(new Set(Object.values(SCENE_ATTR)).size).toBe(Object.values(SCENE_ATTR).length);
    // The services entrance as the scene draws it (the Directions panel's glow keys off it).
    expect(SCENE_ATTR.entry).toBe("data-entry");
    expect(Object.keys(PARALLAX_LAYERS)).toEqual(["hero-backdrop", "hero-stats"]);
    expect(SCENE_TIMING.AFTER_INTRO_MS).toBeGreaterThan(500);
  });
});

/*
 * Imported by server components and by `e2e/helpers.ts` in plain Node. Not a per-file "node"
 * environment docblock: vitest.setup.ts reads `window.matchMedia` at its top level and throws
 * before such a file can run. The DOM globals are removed instead and the module imported
 * FRESH, so its top level really runs without `window` or `document`.
 */
describe("lib/scene without a DOM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
  });

  it("imports, and every DOM-facing reader is a quiet no-op", async () => {
    expect(typeof window).toBe("undefined");
    const scene = await import("@/lib/scene");
    expect(scene.SCENE_3D_KEY).toBe("tbs_scene_3d");
    expect(scene.readSceneFlag()).toBeNull();
    expect(scene.readGpuFacts("strict")).toBeNull();
    expect(() => scene.writeGpuFacts("strict", { context: true, software: false })).not.toThrow();
    expect(() => scene.markGpu("lost", "strict")).not.toThrow();
    expect(scene.readMotionGate()).toBe("unsupported");
    expect(() => scene.setSceneBoost("hero-primary", true)).not.toThrow();
    expect(scene.readSceneInput().boost).toBe(1);
  });
});

describe("lib/gpuProbe — the cache on its own", () => {
  it("imports nothing, so the intro's capability chunk never carries the stage contract", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../gpuProbe.ts"), "utf8");
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\(/);
  });

  it("is the same cache lib/scene exports (one implementation, one set of names)", async () => {
    const probe = await import("@/lib/gpuProbe");
    const scene = await import("@/lib/scene");
    for (const name of [
      "GPU_PROBE_CACHE_KEY",
      "decideWebGL",
      "markGpu",
      "parseGpuProbeCache",
      "readGpuFacts",
      "reasonFor",
      "writeGpuFacts",
    ] as const) {
      expect(scene[name], name).toBe(probe[name]);
    }
  });
});
