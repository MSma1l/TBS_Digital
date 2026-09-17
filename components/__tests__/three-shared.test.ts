import { describe, expect, it, vi } from "vitest";
import {
  Color,
  ColorManagement,
  LinearSRGBColorSpace,
  SRGBColorSpace,
  Scene,
  type ColorSpace,
  type WebGLRenderer,
} from "three";
import { clampDprRange } from "@/components/three/capability";
import { installTransmissionClear, linearTargetClearColor } from "@/components/three/environment";
import {
  CAP_SLACK,
  DEFAULT_GOVERNOR,
  createFpsGovernor,
  sampleFrame,
  type FpsGovernor,
  type GovernorStep,
} from "@/components/three/governor";
import { MAX_FRAME_STEP, clamp, damp, lerp } from "@/components/three/motion";
import { isParsableTokenColor, readTokenColors } from "@/components/three/palette";
import { contextAttributes } from "@/components/three/renderer";
import { clampDpr, HIGH_TIER_PIXEL_BUDGET, TIER_CONFIG } from "@/components/intro/capability";

/*
 * The 3D helpers the intro and the interior share (components/three/*), without a WebGL
 * context: the governor's bail, the damping, the DPR clamp, the token reader, the context
 * attributes and the transmission clear's colour space. The intro's own governor and DPR tables (intro-scene-math, intro-math) must
 * keep passing unchanged through the re-exports.
 */

describe("FPS governor — bail (opt-in)", () => {
  /* Frame rates are powers of two, as in intro-scene-math: 1s windows close exactly. A slow
     device delivers uneven frames (half and one and a half of the mean interval). */
  type Rate = number | { fps: number; uneven: true };

  function run(gov: FpsGovernor, rate: Rate, seconds: number): GovernorStep[] {
    const fps = typeof rate === "number" ? rate : rate.fps;
    const uneven = typeof rate !== "number";
    const changes: GovernorStep[] = [];
    for (let i = 0; i < Math.round(fps * seconds); i += 1) {
      const next = sampleFrame(gov, (uneven ? (i % 2 === 0 ? 0.5 : 1.5) : 1) / fps);
      if (next) changes.push(next);
    }
    return changes;
  }

  const SLOW_16: Rate = { fps: 16, uneven: true }; // < bailFps 28
  const SLOW_32: Rate = { fps: 32, uneven: true }; // < minFps 45, > bailFps 28
  const FAST = 64;
  const capped30 = (i: number) => (1 + 0.03 * Math.sin(i * 1.7)) / 30;

  /** A governor already driven down to lite. */
  function liteGovernor(options: Parameters<typeof createFpsGovernor>[0]): FpsGovernor {
    const gov = createFpsGovernor({ skipDpr: true, ...options });
    run(gov, FAST, DEFAULT_GOVERNOR.warmupSeconds);
    expect(run(gov, SLOW_32, 2)).toEqual(["lite"]);
    return gov;
  }

  it("is off by default: the intro's lite stays terminal and never bails", () => {
    expect(DEFAULT_GOVERNOR.bailFps).toBe(0);
    const gov = liteGovernor({});
    expect(run(gov, SLOW_16, 20)).toEqual([]);
    expect(gov.step).toBe("lite");
  });

  it("bails after bailWindows slow, uneven windows in a row once lite", () => {
    const gov = liteGovernor({ bailFps: 28, bailWindows: 4 });
    expect(run(gov, SLOW_16, 3)).toEqual([]);
    expect(run(gov, SLOW_16, 1)).toEqual(["bail"]);
    expect(gov.step).toBe("bail");
  });

  it("starts the count again after a window that keeps up", () => {
    const gov = liteGovernor({ bailFps: 28, bailWindows: 4 });
    expect(run(gov, SLOW_16, 3)).toEqual([]);
    expect(run(gov, FAST, 1)).toEqual([]);
    expect(run(gov, SLOW_16, 3)).toEqual([]);
    expect(gov.step).toBe("lite");
    expect(run(gov, SLOW_16, 1)).toEqual(["bail"]);
  });

  it("never bails a steady 30 Hz cap (Low Power Mode), however long it lasts", () => {
    const gov = liteGovernor({ bailFps: 28, bailWindows: 4 });
    const changes: GovernorStep[] = [];
    for (let i = 0; i < 30 * 20; i += 1) {
      const next = sampleFrame(gov, capped30(i));
      if (next) changes.push(next);
    }
    expect(changes).toEqual([]);
    expect(gov.step).toBe("lite");
    expect(28).toBeGreaterThan(CAP_SLACK * 30);
  });

  it("does not bail before lite: full and dpr only step quality down", () => {
    const gov = createFpsGovernor({ bailFps: 28, bailWindows: 1 });
    run(gov, FAST, DEFAULT_GOVERNOR.warmupSeconds);
    expect(run(gov, SLOW_16, 2)).toEqual(["dpr"]);
    expect(run(gov, SLOW_16, 2)).toEqual(["lite"]);
    expect(run(gov, SLOW_16, 1)).toEqual(["bail"]);
  });

  it("treats a stall as a reset, not a slow window", () => {
    const gov = liteGovernor({ bailFps: 28, bailWindows: 2 });
    for (let i = 0; i < 6; i += 1) {
      expect(run(gov, SLOW_16, 0.5)).toEqual([]);
      expect(sampleFrame(gov, 2)).toBeNull();
    }
    expect(gov.step).toBe("lite");
  });

  it("bail is terminal", () => {
    const gov = liteGovernor({ bailFps: 28, bailWindows: 1 });
    expect(run(gov, SLOW_16, 1)).toEqual(["bail"]);
    expect(run(gov, FAST, 10)).toEqual([]);
    expect(run(gov, SLOW_16, 10)).toEqual([]);
    expect(gov.step).toBe("bail");
  });
});

describe("motion", () => {
  it("clamp and lerp", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(MAX_FRAME_STEP).toBe(1 / 20);
  });

  it("damp moves towards the target, frame-rate independently", () => {
    const one = damp(0, 1, 8, 0.1);
    const two = damp(damp(0, 1, 8, 0.05), 1, 8, 0.05);
    expect(one).toBeCloseTo(1 - Math.exp(-0.8), 10);
    expect(two).toBeCloseTo(one, 10);
    expect(damp(0, 1, 8, 10)).toBeCloseTo(1, 10);
    expect(damp(0, 1, 8, 10)).toBeLessThanOrEqual(1);
  });

  it("damp leaves the value alone for a step that is not a positive, finite number", () => {
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(damp(0.3, 1, 8, dt)).toBe(0.3);
    }
    expect(damp(0.3, 1, 0, 0.1)).toBe(0.3);
  });
});

describe("clampDprRange", () => {
  it("caps the range and the device, and a budget when one is given", () => {
    expect(clampDprRange([1, 1.5], 412, 915, 2.625)).toEqual([1, 1.5]);
    expect(clampDprRange([1, 2], 800, 600, 1.25)).toEqual([1, 1.25]);
    const [, max] = clampDprRange([1, 2], 1280, 800, 2, 3.2e6);
    expect(max).toBeCloseTo(Math.sqrt(3.2e6 / (1280 * 800)));
    expect(clampDprRange([1, 2], 2560, 1440, 2, 3.2e6)).toEqual([1, 1]);
    expect(clampDprRange([1, 2], 2560, 1440, 2)).toEqual([1, 2]);
  });

  it("follows a zoomed-out browser below 1× and survives a nonsense ratio", () => {
    expect(clampDprRange([1, 2], 1280, 800, 0.8, 3.2e6)).toEqual([0.8, 0.8]);
    expect(clampDprRange([1, 1.5], 390, 844, Number.NaN)).toEqual([1, 1]);
    expect(clampDprRange([1, 1.5], 0, 0, 0, 1.25e6)).toEqual([1, 1]);
  });

  it("is exactly what the intro's clampDpr used to compute", () => {
    for (const tier of ["high", "mid", "low"] as const) {
      for (const [w, h] of [[320, 568], [390, 844], [1280, 800], [2560, 1440], [0, 0]]) {
        for (const dpr of [0.5, 1, 1.5, 2, 3, Number.NaN]) {
          expect(clampDpr(tier, w, h, dpr)).toEqual(
            clampDprRange(
              TIER_CONFIG[tier].dpr,
              w,
              h,
              dpr,
              tier === "high" ? HIGH_TIER_PIXEL_BUDGET : undefined,
            ),
          );
        }
      }
    }
  });
});

describe("readTokenColors", () => {
  /** The computed tokens of the root, as the browser would resolve them. */
  function computedTokens(tokens: Record<string, string>) {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (name: string) => tokens[name] ?? "",
    } as CSSStyleDeclaration);
  }

  it("reads hex and rgb() tokens into colours, by role", () => {
    computedTokens({ "--test-a": " #ff0000", "--test-b": "rgb(0, 128, 255)" });
    const colors = readTokenColors({ a: "--test-a", b: "--test-b" });
    expect(colors.a.getHexString()).toBe("ff0000");
    expect(colors.b.getHexString()).toBe("0080ff");
  });

  it("throws a descriptive error for a missing token or a format three can't parse", () => {
    computedTokens({ "--test-a": "color-mix(in srgb, red, blue)" });
    expect(() => readTokenColors({ a: "--test-a" })).toThrow(
      /CSS token --test-a is missing or not a hex\/rgb\(\) colour/,
    );
    expect(() => readTokenColors({ gone: "--test-missing" })).toThrow(/--test-missing/);
  });

  it("accepts only the formats THREE.Color parses silently", () => {
    for (const ok of ["#fff", "#4fc3e8", "rgb(1, 2, 3)", "rgb(1,2,3)"]) {
      expect(isParsableTokenColor(ok), ok).toBe(true);
    }
    for (const bad of ["", "red", "#ffff", "rgba(1,2,3,.5)", "oklch(1 0 0)", "var(--red)"]) {
      expect(isParsableTokenColor(bad), bad).toBe(false);
    }
  });
});

describe("contextAttributes", () => {
  it("keeps the intro's attributes: transparent, premultiplied, default power, caveat unless forced", () => {
    expect(contextAttributes({ antialias: true, force3d: false })).toEqual({
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "default",
      failIfMajorPerformanceCaveat: true,
    });
    expect(contextAttributes({ antialias: false, force3d: true })).toMatchObject({
      antialias: false,
      failIfMajorPerformanceCaveat: false,
    });
  });

  it("passes a scene's power preference through", () => {
    expect(
      contextAttributes({ antialias: false, force3d: false, powerPreference: "low-power" })
        .powerPreference,
    ).toBe("low-power");
  });
});

describe("installTransmissionClear — the transmission target's clear colour", () => {
  /*
   * Just enough of three r186's WebGLRenderer: a clear colour is converted when it is SET,
   * into the colour space of whatever is bound at that moment (WebGLBackground.setClear →
   * getUnlitUniformColorSpace: the output space for the canvas, the working space for a
   * render target), and `clear()` uses the stored value. Every clear is recorded.
   */
  function fakeRenderer(output: ColorSpace = SRGBColorSpace) {
    let target: object | null = null;
    let stored = { r: 0, g: 0, b: 0, a: 0 };
    const rgb = { r: 0, g: 0, b: 0 };
    const clears: Array<{ r: number; g: number; b: number; a: number; into: "canvas" | "target" }> = [];
    const renderer = {
      autoClear: true,
      outputColorSpace: output,
      getRenderTarget: () => target,
      setRenderTarget: (next: object | null) => {
        target = next;
      },
      setClearColor(color: Color, alpha = 1) {
        color.getRGB(rgb, target === null ? output : ColorManagement.workingColorSpace);
        stored = { ...rgb, a: alpha };
      },
      clear() {
        clears.push({ ...stored, into: target === null ? "canvas" : "target" });
      },
    };
    return { renderer, clears, gl: renderer as unknown as WebGLRenderer };
  }

  /** One frame as r186 orders it: the scene's hook on the canvas, then the transmission pass. */
  function renderFrame(fake: ReturnType<typeof fakeRenderer>, scene: Scene) {
    const hook = scene.onBeforeRender as unknown as (gl: WebGLRenderer) => void;
    hook(fake.gl);
    fake.renderer.setRenderTarget({});
    fake.renderer.clear();
    fake.renderer.setRenderTarget(null);
  }

  it("clears the linear target to the page colour itself, not to its sRGB encoding", () => {
    const fake = fakeRenderer();
    const scene = new Scene();
    const page = new Color("#0a0b10"); // the dark --bg, held in linear working space
    installTransmissionClear(fake.gl, scene, page, null);
    renderFrame(fake, scene);

    const [canvas, target] = fake.clears;
    expect(canvas).toMatchObject({ into: "canvas", a: 0 });
    expect(target.into).toBe("target");
    expect(target.a).toBe(1);
    expect(target.r).toBeCloseTo(page.r, 6);
    expect(target.g).toBeCloseTo(page.g, 6);
    expect(target.b).toBeCloseTo(page.b, 6);
    // What the uncompensated clear used to write: the sRGB value (≈0.04), about 10× too bright.
    expect(target.r).toBeLessThan(0.01);
  });

  it("leaves a linear-output canvas alone, and restores the renderer and scene on undo", () => {
    const fake = fakeRenderer(LinearSRGBColorSpace);
    const scene = new Scene();
    const before = scene.onBeforeRender;
    const page = new Color("#f4f7ff");
    const undo = installTransmissionClear(fake.gl, scene, page, null);
    expect(fake.renderer.autoClear).toBe(false);
    renderFrame(fake, scene);
    expect(fake.clears[1].r).toBeCloseTo(page.r, 6);

    undo();
    expect(fake.renderer.autoClear).toBe(true);
    expect(scene.onBeforeRender).toBe(before);
    expect(scene.environment).toBeNull();
  });

  it("linearTargetClearColor round-trips through three's own output conversion", () => {
    const page = new Color("#10172a");
    const compensated = linearTargetClearColor(page, SRGBColorSpace);
    const rgb = { r: 0, g: 0, b: 0 };
    compensated.getRGB(rgb, SRGBColorSpace);
    expect(rgb.r).toBeCloseTo(page.r, 6);
    expect(rgb.g).toBeCloseTo(page.g, 6);
    expect(rgb.b).toBeCloseTo(page.b, 6);
  });
});
