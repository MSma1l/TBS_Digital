import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HeroCoreArt } from "@/components/scene/art/HeroCoreArt";
import {
  ART_SCALE,
  CORE_ART,
  CROSS_ARM,
  PARTICLE_MIN_LENGTH,
  SPHERE_R,
  arcPath,
  ringEllipse,
  ringPoint,
  ringPointHidden,
  ringSegments,
  rotateEulerXYZ,
} from "@/components/scene/art/heroArt";
import { CORE, RING_TILTS } from "@/components/scene/shapes";

/*
 * The hero's static core (components/scene/art/HeroCoreArt.tsx + heroArt.ts +
 * HeroCoreArt.module.css), held to the fallback-art rules: server-rendered, decorative and
 * text-free, no decorative dots, tokens only, static apart from the one-shot boost wave, and
 * drawn at the WebGL core's proportions.
 */

const ROOT = process.cwd();
const CSS = readFileSync(resolve(ROOT, "components/scene/art/HeroCoreArt.module.css"), "utf8");
const cssNoComments = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function renderArt(): { html: string; root: SVGSVGElement } {
  const html = renderToStaticMarkup(<HeroCoreArt />);
  const host = document.createElement("div");
  host.innerHTML = html;
  return { html, root: host.firstElementChild as SVGSVGElement };
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

  it("draws no dot: no circle under r=12, no round line caps, no round boxes", () => {
    const { html, root } = renderArt();
    const circles = Array.from(root.querySelectorAll("circle"));
    expect(circles.length).toBeGreaterThan(0);
    for (const circle of circles) {
      expect(Number(circle.getAttribute("r"))).toBeGreaterThanOrEqual(12);
    }
    expect(html).not.toMatch(/stroke-linecap="round"/);
    expect(cssNoComments).not.toMatch(/stroke-linecap:\s*round/);
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
    for (const id of ["tbs-core-glass", "tbs-core-rim"]) {
      expect(root.querySelectorAll(`#${id}`)).toHaveLength(1);
    }
  });

  it("keeps every path coordinate inside the frame", () => {
    for (const d of Object.values(CORE_ART).flat()) {
      for (const m of d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)) {
        expect(Math.abs(Number(m[1]))).toBeLessThanOrEqual(100);
        expect(Math.abs(Number(m[2]))).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("HeroCoreArt — particles are streaks and crosses, never dots", () => {
  it("every streak is at least the minimum length", () => {
    const streaks = [...`${CORE_ART.streaks}${CORE_ART.marks}`.matchAll(/l(-?[\d.]+) (-?[\d.]+)/g)];
    expect(streaks.length).toBeGreaterThanOrEqual(30);
    for (const m of streaks) {
      expect(Math.hypot(Number(m[1]), Number(m[2]))).toBeGreaterThanOrEqual(PARTICLE_MIN_LENGTH - 0.02);
    }
  });

  it("particles are written to a tenth of a unit (lean markup), and rounding never shortens a streak below the minimum", () => {
    const particles = `${CORE_ART.streaks}${CORE_ART.marks}`;
    for (const n of particles.match(/-?[\d.]+/g) ?? []) expect(n, n).toMatch(/^-?\d+(?:\.\d)?$/);
    for (const m of particles.matchAll(/l(-?[\d.]+) (-?[\d.]+)/g)) {
      expect(Math.hypot(Number(m[1]), Number(m[2]))).toBeGreaterThanOrEqual(PARTICLE_MIN_LENGTH);
    }
  });

  it("every cross has full-length arms", () => {
    const arms = [...CORE_ART.marks.matchAll(/[hv](-?[\d.]+)/g)];
    expect(arms.length).toBeGreaterThan(0);
    for (const m of arms) expect(Number(m[1])).toBeCloseTo(2 * CROSS_ARM, 2);
  });

  it("particle strokes are hairlines, never wider than a third of the shortest streak at phone size", () => {
    // The smallest the art ever renders: min(92vw, 480px) at 320px wide → 294px for 200 units.
    const pxPerUnit = (320 * 0.92) / 200;
    for (const cls of ["streaks", "marks"]) {
      const block = cssNoComments.match(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      const width = Number(block.match(/stroke-width:\s*([\d.]+)px/)?.[1]);
      expect(width, cls).toBeGreaterThan(0);
      expect(PARTICLE_MIN_LENGTH * pxPerUnit, cls).toBeGreaterThanOrEqual(3 * width);
    }
  });
});

describe("HeroCoreArt — the WebGL core's proportions", () => {
  it("maps the core's outer radius to 95 units and the sphere to its share", () => {
    expect(ART_SCALE * CORE.R).toBeCloseTo(95, 9);
    expect(SPHERE_R).toBeCloseTo(CORE.sphere * ART_SCALE, 1);
  });

  it("rotates like a three.js Euler XYZ (Rx·Ry·Rz)", () => {
    // Rz(90°) first: x̂ → ŷ; then Rx(90°): ŷ → ẑ.
    const p = rotateEulerXYZ([1, 0, 0], [Math.PI / 2, 0, Math.PI / 2]);
    expect(p[0]).toBeCloseTo(0, 12);
    expect(p[1]).toBeCloseTo(0, 12);
    expect(p[2]).toBeCloseTo(1, 12);
  });

  it("projects each ring as an ellipse whose long axis is the ring's radius", () => {
    for (const i of [0, 1, 2]) {
      const e = ringEllipse(i);
      expect(e.rx).toBeCloseTo(CORE.rings[i] * ART_SCALE, 6);
      expect(e.ry).toBeLessThanOrEqual(e.rx);
      // Every sampled point lies on that ellipse (in its own axes).
      const phi = (e.angle * Math.PI) / 180;
      for (let k = 0; k < 24; k += 1) {
        const [x, y] = ringPoint(e, (k / 24) * Math.PI * 2);
        const u = x * Math.cos(phi) + y * Math.sin(phi);
        const v = -x * Math.sin(phi) + y * Math.cos(phi);
        expect((u / e.rx) ** 2 + (v / e.ry) ** 2).toBeCloseTo(1, 6);
      }
    }
    expect(RING_TILTS).toHaveLength(3);
  });

  it("cuts each ring where it passes behind the sphere, covering exactly one turn", () => {
    let hiddenSomewhere = false;
    for (const i of [0, 1, 2]) {
      const e = ringEllipse(i);
      const segments = ringSegments(e);
      const span = segments.reduce((sum, s) => sum + (s.to - s.from), 0);
      expect(span).toBeCloseTo(Math.PI * 2, 9);
      for (const s of segments) {
        expect(ringPointHidden(e, (s.from + s.to) / 2)).toBe(s.hidden);
        hiddenSomewhere ||= s.hidden;
      }
    }
    expect(hiddenSomewhere).toBe(true);
    expect(CORE_ART.ringsHidden).not.toBe("");
    for (const ring of CORE_ART.rings) expect(ring).not.toBe("");
  });

  it("draws arcs that go the right way round (SVG endpoint → centre conversion lands on 0,0)", () => {
    for (const i of [0, 1, 2]) {
      const e = ringEllipse(i);
      const from = 0.3;
      const to = 1.9;
      const d = arcPath(e, from, to);
      const start = d.match(/^M(-?[\d.]+) (-?[\d.]+)/)!;
      const [, rx, ry, rot, large, sweep, x2, y2] = d.match(
        /A(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (\d) (\d) (-?[\d.]+) (-?[\d.]+)/,
      )!;
      const center = svgArcCenter(
        Number(start[1]),
        Number(start[2]),
        Number(rx),
        Number(ry),
        Number(rot),
        large === "1",
        sweep === "1",
        Number(x2),
        Number(y2),
      );
      expect(Math.hypot(center[0], center[1]), `ring ${i}`).toBeLessThan(0.5);
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

  it("uses tokens for every colour and keeps strokes non-scaling", () => {
    expect(cssNoComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/);
    for (const m of cssNoComments.matchAll(/(?:stop-color|stroke|fill)\s*:\s*([^;]+);/g)) {
      expect(m[1].trim()).toMatch(/^(?:var\(--[\w-]+\)|none)$/);
    }
    expect(cssNoComments).toMatch(/vector-effect:\s*non-scaling-stroke/);
    expect(cssNoComments).not.toMatch(/\[data-intro-reveal/);
  });
});

/** SVG 1.1 F.6.5: the centre of an elliptical arc from its endpoint parameters. */
function svgArcCenter(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  deg: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): [number, number] {
  const phi = (deg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  return [cos * cxp - sin * cyp + (x1 + x2) / 2, sin * cxp + cos * cyp + (y1 + y2) / 2];
}
