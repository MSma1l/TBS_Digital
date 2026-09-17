import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroCoreArt } from "@/components/scene/art/HeroCoreArt";
import {
  ART_SCALE,
  CHIP_ART,
  CHIP_ART_MATRIX,
  CHIP_ART_TRACES,
  GLOW_HALF,
  PARTICLE_MIN_LENGTH,
  WAVE_HALF,
  chipLift,
  rotateEulerXYZ,
} from "@/components/scene/art/heroArt";
import { CHIP, CHIP_POSE, chipPins, chipTraces, projectOrtho, type Vec3 } from "@/components/scene/shapes";

/*
 * The hero's static microprocessor (components/scene/art/HeroCoreArt.tsx + heroArt.ts +
 * HeroCoreArt.module.css), held to the fallback-art rules: server-rendered, decorative and
 * text-free, no decorative dots, tokens only, static apart from the one-shot boost, and drawn
 * from the WebGL chip's own shapes and pose, so the crossfade lands on the same silhouette.
 */

const ROOT = process.cwd();
const CSS = readFileSync(resolve(ROOT, "components/scene/art/HeroCoreArt.module.css"), "utf8");
const cssNoComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

type P2 = [number, number];
type Poly = { pts: P2[]; closed: boolean };

function renderArt(): { html: string; root: SVGSVGElement } {
  const html = renderToStaticMarkup(<HeroCoreArt />);
  const host = document.createElement("div");
  host.innerHTML = html;
  return { html, root: host.firstElementChild as SVGSVGElement };
}

/**
 * Walks straight-line path data (M/m, L/l, H/h, V/v, Z/z — nothing curved is allowed) into
 * absolute subpaths. After `z` the current point is the subpath's start, as in SVG.
 */
function parsePath(d: string): Poly[] {
  expect(d, "straight commands and numbers only").toMatch(/^M[MmLlHhVvZz\d .-]*$/);
  const tokens = [...d.matchAll(/([MmLlHhVvZz])|(-?(?:\d+(?:\.\d+)?|\.\d+))/g)].map((m) =>
    m[1] !== undefined ? m[1] : Number(m[2]),
  );
  const subs: Poly[] = [];
  let cur: P2 = [0, 0];
  let cmd = "";
  let i = 0;
  const take = () => {
    const t = tokens[i++];
    if (typeof t !== "number") throw new Error(`expected a number in ${d} at token ${i - 1}`);
    return t;
  };
  const to = (p: P2) => {
    cur = p;
    subs[subs.length - 1].pts.push(p);
  };
  while (i < tokens.length) {
    if (typeof tokens[i] === "string") {
      cmd = tokens[i++] as string;
      if (cmd === "z" || cmd === "Z") {
        const sub = subs[subs.length - 1];
        sub.closed = true;
        cur = sub.pts[0];
        continue;
      }
    }
    switch (cmd) {
      case "M":
      case "m": {
        const x = take();
        const y = take();
        cur = cmd === "M" ? [x, y] : [cur[0] + x, cur[1] + y];
        subs.push({ pts: [cur], closed: false });
        cmd = cmd === "M" ? "L" : "l";
        break;
      }
      case "L":
        to([take(), take()]);
        break;
      case "l": {
        const x = take();
        to([cur[0] + x, cur[1] + take()]);
        break;
      }
      case "H":
        to([take(), cur[1]]);
        break;
      case "h":
        to([cur[0] + take(), cur[1]]);
        break;
      case "V":
        to([cur[0], take()]);
        break;
      case "v":
        to([cur[0], cur[1] + take()]);
        break;
      default:
        throw new Error(`unexpected command "${cmd}" in ${d}`);
    }
  }
  return subs;
}

/** `matrix(a b c d e f)` → its six numbers. */
function matrixOf(transform: string): number[] {
  const m = transform.match(/^matrix\(([^)]*)\)$/);
  expect(m, transform).not.toBeNull();
  return m![1].trim().split(/[\s,]+/).map(Number);
}

const [MA, MB, MC, MD, ME, MF] = matrixOf(CHIP_ART_MATRIX);
/** A chip-plane art point through the group's matrix, onto the view box. */
const apply = ([x, y]: P2): P2 => [MA * x + MC * y + ME, MB * x + MD * y + MF];
/** A chip-plane scene point where the WebGL chip puts it, in art units (posed, projected). */
const posed = ([x, y]: P2): P2 => {
  const p = projectOrtho(rotateEulerXYZ([x, y, 0], CHIP_POSE), 0, 0, ART_SCALE);
  return [p[0], p[1]];
};
const basis = (v: Vec3) => projectOrtho(rotateEulerXYZ(v, CHIP_POSE), 0, 0, 1);

/** Consecutive duplicates dropped (a zero-length run draws nothing). */
function dedupe(pts: ReadonlyArray<readonly [number, number]>): P2[] {
  const out: P2[] = [];
  for (const [x, y] of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - x) > 1e-9 || Math.abs(last[1] - y) > 1e-9) out.push([x, y]);
  }
  return out;
}

/** Every declared value of `prop` in any rule whose selector names `.cls` (media rules too). */
function declared(cls: string, prop: string): string[] {
  const values: string[] = [];
  for (const rule of cssNoComments.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (!new RegExp(`\\.${cls}\\b`).test(rule[1])) continue;
    for (const m of rule[2].matchAll(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+);`, "g"))) values.push(m[1].trim());
  }
  return values;
}

describe("HeroCoreArt — markup", () => {
  it("renders the same markup every time (server and client never disagree)", () => {
    expect(renderToStaticMarkup(<HeroCoreArt />)).toBe(renderToStaticMarkup(<HeroCoreArt />));
  });

  it("is one decorative svg on the art's coordinate system", () => {
    const { root } = renderArt();
    expect(root.tagName.toLowerCase()).toBe("svg");
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.getAttribute("focusable")).toBe("false");
    expect(root.getAttribute("data-core-art")).toBe("");
    expect(root.getAttribute("viewBox")).toBe("-100 -100 200 200");
  });

  it("holds no text, title, link, heading, list, role or tab stop", () => {
    const { root } = renderArt();
    expect(root.textContent).toBe("");
    expect(root.querySelector("title, desc, text, a, h1, h2, h3, h4, h5, h6, ol, ul, [role], [tabindex]")).toBeNull();
  });

  it("stays within the 25-element budget", () => {
    const { root } = renderArt();
    expect(root.querySelectorAll("*").length + 1).toBeLessThanOrEqual(25);
  });

  it("draws everything through one projection group", () => {
    const { root } = renderArt();
    expect(Array.from(root.children).map((el) => el.tagName.toLowerCase())).toEqual(["defs", "g"]);
    const group = root.children[1];
    expect(group.getAttribute("transform")).toBe(CHIP_ART_MATRIX);
    expect(root.querySelectorAll("[transform]")).toHaveLength(1);
  });

  it("draws no dot: no circle at all (and none could be under r=12), no round caps, joins or radii", () => {
    const { html, root } = renderArt();
    const circles = Array.from(root.querySelectorAll("circle"));
    for (const circle of circles) {
      expect(Number(circle.getAttribute("r"))).toBeGreaterThanOrEqual(12);
    }
    expect(circles).toHaveLength(0);
    expect(root.querySelector("ellipse, [rx], [ry]")).toBeNull();
    expect(html).not.toMatch(/stroke-line(?:cap|join)="round"/);
    expect(cssNoComments).not.toMatch(/stroke-line(?:cap|join):\s*round/);
    expect(cssNoComments).not.toMatch(/border-radius/);
  });

  it("paints only through the module's classes and its own gradients (no inline colour)", () => {
    const { root } = renderArt();
    for (const el of root.querySelectorAll("*")) {
      expect(el.hasAttribute("style"), el.tagName).toBe(false);
      for (const attr of ["fill", "stroke"]) {
        const value = el.getAttribute(attr);
        if (value !== null) expect(value, `${el.tagName} ${attr}`).toMatch(/^url\(#tbs-core-[a-z-]+\)$/);
      }
    }
    expect(root.querySelectorAll("#tbs-core-glow")).toHaveLength(1);
    expect(root.querySelector("#tbs-core-glow")?.tagName.toLowerCase()).toBe("radialgradient");
    expect(root.querySelectorAll("#tbs-core-die")).toHaveLength(1);
    expect(root.querySelector("#tbs-core-die")?.tagName.toLowerCase()).toBe("lineargradient");
    for (const use of root.querySelectorAll("use")) {
      const href = use.getAttribute("href") ?? "";
      expect(href, "a halo re-uses a path of this drawing").toMatch(/^#tbs-core-[a-z-]+$/);
      expect(root.querySelector(href)?.tagName.toLowerCase()).toBe("path");
    }
  });

  it("walks every path and rect: each absolute point, through the matrix, stays inside the frame", () => {
    const { root } = renderArt();
    const points: P2[] = [];
    for (const path of root.querySelectorAll("path")) {
      for (const sub of parsePath(path.getAttribute("d") ?? "")) points.push(...sub.pts);
    }
    for (const rect of root.querySelectorAll("rect")) {
      const [x, y, w, h] = ["x", "y", "width", "height"].map((a) => Number(rect.getAttribute(a)));
      points.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
    }
    expect(points.length).toBeGreaterThan(200);
    for (const p of points) {
      const [x, y] = apply(p);
      expect(Math.abs(x), `${p} → ${x}`).toBeLessThanOrEqual(100);
      expect(Math.abs(y), `${p} → ${y}`).toBeLessThanOrEqual(100);
    }
  });

  it("writes lean numbers: whole units, half units on the pins only", () => {
    for (const [name, d] of Object.entries(CHIP_ART)) {
      const pattern = name === "pins" ? /^-?\d+(?:\.5)?$/ : /^-?\d+$/;
      for (const n of d.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []) expect(n, `${name}: ${n}`).toMatch(pattern);
    }
  });
});

describe("HeroCoreArt — a circuit, not particles", () => {
  const traces = parsePath(CHIP_ART.traces);

  it("draws every trace as runs that are horizontal, vertical or exactly 45°", () => {
    expect(traces).toHaveLength(4 * CHIP_ART_TRACES);
    for (const trace of traces) {
      expect(trace.closed).toBe(false);
      expect(trace.pts.length).toBeGreaterThanOrEqual(3);
      for (let k = 1; k < trace.pts.length; k += 1) {
        const dx = trace.pts[k][0] - trace.pts[k - 1][0];
        const dy = trace.pts[k][1] - trace.pts[k - 1][1];
        expect(dx !== 0 || dy !== 0, "no zero-length run").toBe(true);
        expect(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy), `run ${dx},${dy}`).toBe(true);
      }
    }
  });

  it("draws the pins as closed rectangles where chipPins puts them", () => {
    const pins = parsePath(CHIP_ART.pins);
    const expected = chipPins(CHIP_ART_TRACES);
    expect(pins).toHaveLength(expected.length);
    pins.forEach((pin, k) => {
      expect(pin.closed, `pin ${k}`).toBe(true);
      expect(pin.pts).toHaveLength(4);
      for (let e = 0; e < 4; e += 1) {
        const [a, b] = [pin.pts[e], pin.pts[(e + 1) % 4]];
        expect(a[0] === b[0] || a[1] === b[1], `pin ${k} edge ${e} is axis-aligned`).toBe(true);
      }
      const xs = [...new Set(pin.pts.map((p) => p[0]))];
      const ys = [...new Set(pin.pts.map((p) => p[1]))];
      expect(xs).toHaveLength(2);
      expect(ys).toHaveLength(2);
      const { center, size } = expected[k];
      expect(Math.abs((xs[0] + xs[1]) / 2 - center[0] * ART_SCALE), `pin ${k} x`).toBeLessThanOrEqual(0.75);
      expect(Math.abs((ys[0] + ys[1]) / 2 - center[1] * ART_SCALE), `pin ${k} y`).toBeLessThanOrEqual(0.75);
      expect(Math.abs(Math.abs(xs[0] - xs[1]) - size[0] * ART_SCALE), `pin ${k} width`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(Math.abs(ys[0] - ys[1]) - size[1] * ART_SCALE), `pin ${k} height`).toBeLessThanOrEqual(0.5);
    });
  });

  it("ends every trace on a square via pad", () => {
    const vias = parsePath(CHIP_ART.vias);
    const half = Math.round(CHIP.via * ART_SCALE);
    expect(vias).toHaveLength(traces.length);
    vias.forEach((via, k) => {
      expect(via.closed).toBe(true);
      const xs = via.pts.map((p) => p[0]);
      const ys = via.pts.map((p) => p[1]);
      expect(Math.max(...xs) - Math.min(...xs)).toBe(2 * half);
      expect(Math.max(...ys) - Math.min(...ys)).toBe(2 * half);
      const end = traces[k].pts[traces[k].pts.length - 1];
      expect([(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]).toEqual(end);
    });
  });

  it("draws the packets as streaks on the traces, at least the minimum length on screen", () => {
    const packets = parsePath(CHIP_ART.packets);
    expect(packets).toHaveLength(8);
    for (const packet of packets) {
      expect(packet.closed).toBe(false);
      expect(packet.pts).toHaveLength(2);
      const [a, b] = packet.pts;
      const [sa, sb] = [apply(a), apply(b)];
      expect(Math.hypot(sb[0] - sa[0], sb[1] - sa[1]), `${a} → ${b}`).toBeGreaterThanOrEqual(PARTICLE_MIN_LENGTH);
      const onRun = traces.some(({ pts }) =>
        pts.slice(1).some((q, k) => {
          const p = pts[k];
          const cross = (r: P2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
          const within = (r: P2) =>
            r[0] >= Math.min(p[0], q[0]) && r[0] <= Math.max(p[0], q[0]) &&
            r[1] >= Math.min(p[1], q[1]) && r[1] <= Math.max(p[1], q[1]);
          return cross(a) === 0 && cross(b) === 0 && within(a) && within(b);
        }),
      );
      expect(onRun, `packet ${a} → ${b} lies on one trace run`).toBe(true);
    }
  });

  it("packet strokes are never wider than a third of the shortest streak at phone size", () => {
    // The smallest the art ever renders: min(92vw, 480px) at 320px wide → 294px for 200 units.
    const pxPerUnit = (320 * 0.92) / 200;
    const widths = declared("packets", "stroke-width").map((v) => Number(v.match(/^([\d.]+)px$/)?.[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const width of widths) {
      expect(width).toBeGreaterThan(0);
      expect(PARTICLE_MIN_LENGTH * pxPerUnit).toBeGreaterThanOrEqual(3 * width);
    }
  });
});

describe("HeroCoreArt — the WebGL chip's proportions", () => {
  it("maps the chip's outer radius to 95 units", () => {
    expect(ART_SCALE * CHIP.R).toBeCloseTo(95, 9);
  });

  it("rotates like a three.js Euler XYZ (Rx·Ry·Rz)", () => {
    // Rz(90°) first: x̂ → ŷ; then Rx(90°): ŷ → ẑ.
    const p = rotateEulerXYZ([1, 0, 0], [Math.PI / 2, 0, Math.PI / 2]);
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[1]).toBeCloseTo(0, 12);
    expect(p[2]).toBeCloseTo(1, 12);
  });

  it("the matrix is projectOrtho of the posed chip basis, untranslated", () => {
    const ex = basis([1, 0, 0]);
    const ey = basis([0, 1, 0]);
    expect(Math.abs(MA - ex[0])).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(MB - ex[1])).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(MC - ey[0])).toBeLessThanOrEqual(5e-4);
    expect(Math.abs(MD - ey[1])).toBeLessThanOrEqual(5e-4);
    expect([ME, MF]).toEqual([0, 0]);
  });

  it("puts a chip point exactly where the WebGL chip does (projectOrtho is y down: no extra flip)", () => {
    for (const p of [[1, 0], [0, 1], [-0.7, 1.3], [2.3, -0.4]] as P2[]) {
      const art = apply([p[0] * ART_SCALE, p[1] * ART_SCALE]);
      const gl = posed(p);
      expect(Math.hypot(art[0] - gl[0], art[1] - gl[1]), `${p}`).toBeLessThanOrEqual(0.1);
    }
    // Lying back: the chip's +y side leans away, up the screen, and the view is not mirrored.
    expect(apply([0, 10])[1]).toBeLessThan(0);
    expect(Math.sign(MA * MD - MB * MC)).toBe(Math.sign(basis([1, 0, 0])[0] * basis([0, 1, 0])[1] - basis([1, 0, 0])[1] * basis([0, 1, 0])[0]));
  });

  it("the art traces are chipTraces scaled to whole units, vertex for vertex", () => {
    const art = parsePath(CHIP_ART.traces);
    const scene = chipTraces(CHIP_ART_TRACES).map(dedupe);
    expect(art).toHaveLength(scene.length);
    art.forEach(({ pts }, k) => {
      expect(pts, `trace ${k}`).toHaveLength(scene[k].length);
      pts.forEach((p, j) => {
        expect(Math.abs(p[0] - scene[k][j][0] * ART_SCALE), `trace ${k} point ${j} x`).toBeLessThanOrEqual(1);
        expect(Math.abs(p[1] - scene[k][j][1] * ART_SCALE), `trace ${k} point ${j} y`).toBeLessThanOrEqual(1);
      });
    });
  });

  it("lifts the stacked slabs like the camera sees height: chipLift through the matrix is the projected z", () => {
    const ez = basis([0, 0, 1]);
    for (const z of [0.08, 0.15, 0.2]) {
      const [x, y] = apply(chipLift(z));
      expect(x).toBeCloseTo(ez[0] * z * ART_SCALE, 1);
      expect(y).toBeCloseTo(ez[1] * z * ART_SCALE, 1);
    }
  });

  it("draws the substrate, heat spreader and die at the chip's half-sizes", () => {
    const halves = (d: string) =>
      parsePath(d)
        .filter((sub) => sub.closed)
        .map(({ pts }) => (Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]))) / 2);
    const lifted = (z: number) => chipLift(z).map(Math.round);
    expect(halves(CHIP_ART.pkg)).toEqual(
      expect.arrayContaining([Math.round(CHIP.pkg * ART_SCALE), Math.round(CHIP.ihs * ART_SCALE)]),
    );
    const [die] = parsePath(CHIP_ART.die);
    expect(die.closed).toBe(true);
    expect(halves(CHIP_ART.die)).toEqual([Math.round(CHIP.die * ART_SCALE)]);
    const top = lifted(CHIP.thick.pkg + CHIP.thick.ihs + CHIP.thick.die);
    const xs = die.pts.map((p) => p[0]);
    const ys = die.pts.map((p) => p[1]);
    expect([(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]).toEqual(top);
  });

  it("the glow and the wave are squares centred on the chip, the wave inside the frame at full scale", () => {
    const { root } = renderArt();
    const rects = Array.from(root.querySelectorAll("rect"));
    expect(rects).toHaveLength(2);
    for (const [rect, half] of [[rects[0], GLOW_HALF], [rects[1], WAVE_HALF]] as const) {
      expect(["x", "y", "width", "height"].map((a) => Number(rect.getAttribute(a)))).toEqual([-half, -half, 2 * half, 2 * half]);
    }
    expect(rects[0].getAttribute("fill")).toBe("url(#tbs-core-glow)");
    const peak = WAVE_HALF * 2.3;
    for (const corner of [[peak, peak], [peak, -peak], [-peak, peak], [-peak, -peak]] as P2[]) {
      const [x, y] = apply(corner);
      expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(100);
    }
  });
});

describe("HeroCoreArt.module.css — static, tokens only", () => {
  it("hides the art once the WebGL core has taken over", () => {
    expect(cssNoComments).toMatch(
      /:global\(\[data-scene-stage\]\[data-renderer="webgl"\]\)\s+\.art\s*\{[^}]*opacity:\s*0/,
    );
  });

  it("never loops, and never animates a dash offset or a filter", () => {
    expect(cssNoComments).not.toMatch(/infinite/);
    expect(cssNoComments).not.toMatch(/stroke-dashoffset|stroke-dasharray/);
    const keyframes = [...cssNoComments.matchAll(/@keyframes\s+[\w-]+\s*\{((?:[^{}]*\{[^}]*\})*)[^{}]*\}/g)];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      const props = [...k[1].matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
      expect(props.every((p) => p === "opacity" || p === "transform"), props.join()).toBe(true);
    }
  });

  it("animates only on the stage's boost, only where motion is welcome, never under the canvas", () => {
    const animated = [...cssNoComments.matchAll(/([^{}]+)\{[^{}]*\banimation\s*:/g)].map((m) => m[1].trim());
    expect(animated.length).toBeGreaterThan(0);
    for (const selector of animated) {
      expect(selector).toMatch(/\[data-scene-stage\]:not\(\[data-renderer="webgl"\]\)\[data-boost\]/);
    }
    const gated = cssNoComments.match(/@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?\n)\}/)?.[1] ?? "";
    expect(gated.match(/\banimation\s*:/g)).toHaveLength(animated.length);
    expect(cssNoComments).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("the boost is the square wave scaling 0.95 → 2.3 as it fades, and the packets pulsing", () => {
    const keyframes = (name: string) =>
      cssNoComments.match(new RegExp(`@keyframes\\s+${name}\\s*\\{((?:[^{}]*\\{[^}]*\\})*)[^{}]*\\}`))?.[1] ?? "";
    const animationOf = (cls: string) =>
      cssNoComments.match(new RegExp(`\\.${cls}\\s*\\{[^{}]*\\banimation:\\s*([\\w-]+)`))?.[1] ?? "";
    const wave = keyframes(animationOf("wave"));
    expect(wave).toMatch(/0%\s*\{[^}]*transform:\s*scale\(0\.95\)/);
    expect(wave).toMatch(/100%\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*scale\(2\.3\)/);
    const packets = keyframes(animationOf("packets"));
    expect(packets).toMatch(/opacity/);
    expect(packets).not.toMatch(/transform/);
    expect(declared("wave", "transform-origin")).toEqual(["0 0"]);
  });

  it("uses tokens for every colour and keeps strokes non-scaling", () => {
    expect(cssNoComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
    for (const m of cssNoComments.matchAll(/(?:stop-color|stroke|fill)\s*:\s*([^;]+);/g)) {
      expect(m[1].trim()).toMatch(/^(?:var\(--[\w-]+\)|none)$/);
    }
    expect(declared("line", "vector-effect")).toEqual(["non-scaling-stroke"]);
    expect(declared("die", "vector-effect")).toEqual(["non-scaling-stroke"]);
    expect(cssNoComments).not.toMatch(/\[data-intro-reveal/);
  });

  it("draws the structure heavier on phones", () => {
    const phones = cssNoComments.match(/@media \(max-width: 860px\)\s*\{([\s\S]*?\n)\}/)?.[1] ?? "";
    for (const cls of ["traces", "pkg", "pins", "die"]) {
      expect(phones, cls).toMatch(new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*stroke-width`));
    }
  });
});
