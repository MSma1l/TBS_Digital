/**
 * The Directions screen's static model illustrations (components/scene/art/ServiceArt.tsx):
 * what every device without the WebGL scene sees. Decided with the client: static art in the
 * 3D models' style (no loops), no decorative dots, nothing a screen reader or the tab order
 * can reach, tokens only. Read from the server-rendered markup, the path data and the CSS
 * Module on disk — jsdom renders none of the geometry or the styles.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SERVICE_DRAWINGS, ServiceArt } from "@/components/scene/art/ServiceArt";
import {
  ART_EXTENT,
  STACK_VIEW,
  HUB_SATELLITES,
  NEURAL_FANOUT,
  NEURAL_LAYERS,
  NEURAL_SEED,
  serviceArtPaths,
} from "@/components/scene/art/serviceArtPaths";
import { buildNeuralGraph, projectOrtho, type Vec3 } from "@/components/scene/shapes";
import { SCENE_SHAPES } from "@/lib/scene";

const ROOT = process.cwd();
const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8");

function parse(html: string): SVGSVGElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  const svg = host.firstElementChild;
  if (!(svg instanceof SVGSVGElement)) throw new Error(`not an <svg>: ${html.slice(0, 60)}`);
  return svg;
}

const markup = (slug: (typeof SCENE_SHAPES)[number]) => renderToStaticMarkup(<ServiceArt shape={slug} />);

/* ---- a small path reader: absolute points per subpath ------------------------------------ */

type Subpath = { points: Array<[number, number]>; closed: boolean; arcs: number };

/** Reads the commands the art serialiser writes (M, l, Q, a, z) into absolute points. */
function subpaths(d: string): Subpath[] {
  const tokens = d.match(/[MlQaz]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const out: Subpath[] = [];
  let cur: Subpath | null = null;
  let [x, y] = [0, 0];
  let i = 0;
  const n = () => {
    const v = Number(tokens[i++]);
    if (!Number.isFinite(v)) throw new Error(`bad number in "${d.slice(0, 40)}…"`);
    return v;
  };
  const isNum = () => i < tokens.length && !/^[MlQaz]$/.test(tokens[i]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      [x, y] = [n(), n()];
      cur = { points: [[x, y]], closed: false, arcs: 0 };
      out.push(cur);
    } else if (cmd === "l") {
      do {
        [x, y] = [x + n(), y + n()];
        cur?.points.push([x, y]);
      } while (isNum());
    } else if (cmd === "Q") {
      const control: [number, number] = [n(), n()];
      [x, y] = [n(), n()];
      cur?.points.push(control, [x, y]);
    } else if (cmd === "a") {
      const [rx, ry, rotation] = [n(), n(), (n() * Math.PI) / 180];
      n(); // large-arc
      n(); // sweep
      const [dx, dy] = [n(), n()];
      // A half-ellipse: its centre is halfway along the chord; the rotated ellipse's extent.
      const [cx, cy] = [x + dx / 2, y + dy / 2];
      const hx = Math.hypot(rx * Math.cos(rotation), ry * Math.sin(rotation));
      const hy = Math.hypot(rx * Math.sin(rotation), ry * Math.cos(rotation));
      cur?.points.push([cx - hx, cy - hy], [cx + hx, cy + hy]);
      [x, y] = [x + dx, y + dy];
      if (cur) cur.arcs += 1;
    } else if (cmd === "z") {
      if (cur) cur.closed = true;
    } else {
      throw new Error(`unexpected token ${cmd}`);
    }
  }
  return out;
}

const STACK_ART = serviceArtPaths("produs-digital");
const COMMERCE_ART = serviceArtPaths("e-commerce");
const HUB_ART = serviceArtPaths("automatizare-api");
const NEURAL_ART = serviceArtPaths("asistenti-ia");
const MESH_ART = serviceArtPaths("brand-ui");

const PATH_TABLES = {
  "produs-digital": STACK_ART,
  "e-commerce": COMMERCE_ART,
  "automatizare-api": HUB_ART,
  "asistenti-ia": NEURAL_ART,
  "brand-ui": MESH_ART,
} as const;

describe("service art — one static illustration per direction", () => {
  it("covers exactly the five directions, in the scene's order", () => {
    expect(Object.keys(SERVICE_DRAWINGS)).toEqual([...SCENE_SHAPES]);
  });

  for (const slug of SCENE_SHAPES) {
    describe(slug, () => {
      it("is a decorative svg on the art's coordinate system", () => {
        const svg = parse(markup(slug));
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(svg.getAttribute("focusable")).toBe("false");
        expect(svg.getAttribute("data-shape-art")).toBe(slug);
        expect(svg.getAttribute("viewBox")).toBe("-100 -100 200 200");
      });

      it("has no text, no link, heading, list, title or role, and nothing focusable", () => {
        const svg = parse(markup(slug));
        expect(svg.textContent).toBe("");
        expect(
          svg.querySelectorAll("a, h1, h2, h3, h4, h5, h6, ol, ul, title, desc, text, foreignObject, [role], [tabindex]"),
        ).toHaveLength(0);
      });

      it("stays within 25 elements, all of them paths", () => {
        const svg = parse(markup(slug));
        const all = [svg, ...Array.from(svg.querySelectorAll("*"))];
        expect(all.length).toBeLessThanOrEqual(25);
        expect(Array.from(svg.children).every((el) => el.tagName.toLowerCase() === "path")).toBe(true);
      });

      it("draws no dot: no circle at all, no round line caps", () => {
        const html = markup(slug);
        expect(html).not.toMatch(/<circle\b/);
        expect(html).not.toMatch(/stroke-linecap="round"|stroke-linejoin="round"/);
      });

      it("renders identically every time", () => {
        expect(markup(slug)).toBe(markup(slug));
      });

      it("fits every point inside the view box, and every path parses", () => {
        for (const [layer, d] of Object.entries(PATH_TABLES[slug])) {
          expect(d, `${slug}.${layer}`).not.toBe("");
          for (const sub of subpaths(d)) {
            for (const [px, py] of sub.points) {
              expect(Math.abs(px), `${slug}.${layer} x`).toBeLessThanOrEqual(ART_EXTENT + 1);
              expect(Math.abs(py), `${slug}.${layer} y`).toBeLessThanOrEqual(ART_EXTENT + 1);
            }
          }
        }
      });
    });
  }

  it("draws the path data straight from the tables (the component adds no geometry)", () => {
    for (const slug of SCENE_SHAPES) {
      const ds = Array.from(parse(markup(slug)).querySelectorAll("path")).map((p) => p.getAttribute("d"));
      expect(ds.sort()).toEqual(Object.values<string>(PATH_TABLES[slug]).sort());
    }
  });

  it("builds a direction's table once: a repeated call returns the very same object", () => {
    for (const slug of SCENE_SHAPES) {
      expect(serviceArtPaths(slug)).toBe(serviceArtPaths(slug));
      expect(serviceArtPaths(slug)).toBe(PATH_TABLES[slug]);
    }
  });

  it("is computed without randomness: a fresh module load yields the same paths", async () => {
    vi.resetModules();
    const again = await import("@/components/scene/art/serviceArtPaths");
    expect(again.serviceArtPaths("produs-digital")).toEqual(STACK_ART);
    expect(again.serviceArtPaths("e-commerce")).toEqual(COMMERCE_ART);
    expect(again.serviceArtPaths("automatizare-api")).toEqual(HUB_ART);
    expect(again.serviceArtPaths("asistenti-ia")).toEqual(NEURAL_ART);
    expect(again.serviceArtPaths("brand-ui")).toEqual(MESH_ART);
  });
});

describe("service art — each model's geometry", () => {
  it("the stack: the camera sees the top, front and −x faces the slabs are drawn with", () => {
    const facing = (n: Vec3) => projectOrtho(n, STACK_VIEW.yaw, STACK_VIEW.pitch, 1)[2];
    for (const n of [[0, 1, 0], [0, 0, 1], [-1, 0, 0]] as Vec3[]) expect(facing(n)).toBeGreaterThan(0);
    for (const n of [[0, -1, 0], [0, 0, -1], [1, 0, 0]] as Vec3[]) expect(facing(n)).toBeLessThan(0);
    // Every face is a closed quad.
    for (const layer of ["stackTop", "stackFront", "stackSide", "deviceTop", "glass"] as const) {
      const [face] = subpaths(STACK_ART[layer]);
      expect(face.closed).toBe(true);
      expect(face.points).toHaveLength(4);
    }
    // Six screens standing apart, and one device in front of them — the model's own count.
    expect(subpaths(STACK_ART.stackFront)).toHaveLength(6);
    expect(subpaths(STACK_ART.deviceFront)).toHaveLength(1);
  });

  it("e-commerce: the three gates are a circle, a card and a hexagon", () => {
    const [offer] = subpaths(COMMERCE_ART.gateOffer);
    const [payment] = subpaths(COMMERCE_ART.gatePayment);
    const [access] = subpaths(COMMERCE_ART.gateAccess);
    expect(offer.arcs).toBe(2);
    expect(payment.points).toHaveLength(4);
    expect(access.points).toHaveLength(6);
    for (const gate of [offer, payment, access]) expect(gate.closed).toBe(true);
  });

  it("automation: a 30-edge hub wired to its satellites", () => {
    expect(subpaths(HUB_ART.wire)).toHaveLength(30);
    const links = subpaths(HUB_ART.backLinks).length + subpaths(HUB_ART.frontLinks).length;
    const hulls = subpaths(HUB_ART.backHulls).length + subpaths(HUB_ART.frontHulls).length;
    expect(links).toBe(HUB_SATELLITES);
    expect(hulls).toBe(HUB_SATELLITES);
    // Packets are bars along a link: at the smallest size the screen draws the art (about a
    // pixel per unit) each is at least three times as long as its 3px stroke is wide.
    expect(read("components/scene/art/ServiceArt.module.css")).toMatch(/\.thick\s*\{\s*stroke-width:\s*3;/);
    for (const packet of [...subpaths(HUB_ART.packetsOut), ...subpaths(HUB_ART.packetsIn)]) {
      const [a, b] = [packet.points[0], packet.points[packet.points.length - 1]];
      expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeGreaterThanOrEqual(9);
    }
  });

  it("assistants: one hexagon per network node, none smaller than a pip", () => {
    const graph = buildNeuralGraph(NEURAL_LAYERS, NEURAL_FANOUT, NEURAL_SEED);
    const hexagons = [NEURAL_ART.nodes, NEURAL_ART.active, NEURAL_ART.output].flatMap(subpaths);
    expect(hexagons).toHaveLength(graph.nodes.length);
    for (const hex of hexagons) {
      expect(hex.closed).toBe(true);
      expect(hex.points).toHaveLength(6);
      const ys = hex.points.map(([, py]) => py);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(9);
    }
    const edges = subpaths(NEURAL_ART.edges).length + subpaths(NEURAL_ART.impulse).length;
    expect(edges).toBe(graph.edges.length);
    expect(subpaths(NEURAL_ART.impulse)).toHaveLength(graph.layers.length - 1);
  });

  it("brand & UI: a mesh, its pulse and three interface cards", () => {
    expect(subpaths(MESH_ART.rowsFar).length + subpaths(MESH_ART.rowsNear).length).toBe(7);
    expect(subpaths(MESH_ART.cols)).toHaveLength(11);
    for (const frame of [MESH_ART.frameFar, MESH_ART.frameMid, MESH_ART.frameNear]) {
      const [outline] = subpaths(frame);
      expect(outline.closed).toBe(true);
    }
    expect(subpaths(MESH_ART.drops)).toHaveLength(3);
  });
});

describe("service art — styles and pure source", () => {
  const css = read("components/scene/art/ServiceArt.module.css");
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("shows the drawing ONLY once the stage has given up on WebGL, and drops all motion under reduced motion", () => {
    // Inverted on purpose: the drawing is the fallback, not a preamble. It used to be painted on
    // every load and cross-faded out when the live model arrived, so every visitor saw a still
    // picture first and the model replace it. Now the box is empty while the stage decides
    // (`pending`, which is also the server's value) and while WebGL draws; only `fallback` and
    // `off` bring it back. A visitor with no JavaScript never reaches a decision, so the
    // <noscript> rule in app/(site)/layout.tsx shows it to them unconditionally.
    expect(rules).toMatch(/\.art\s*\{[^}]*opacity:\s*0/);
    expect(rules).toMatch(
      /:global\(\[data-scene-stage\]\[data-renderer="fallback"\]\)\s+\.art,[\s\S]*?opacity:\s*1/,
    );
    expect(rules).toMatch(
      /:global\(\[data-scene-stage\]\[data-renderer="off"\]\)\s+\.art\s*\{[^}]*opacity:\s*1/,
    );
    // …and nothing re-shows it while WebGL is the renderer.
    expect(rules).not.toMatch(/data-renderer="webgl"\]\)\s+\.art\s*\{[^}]*opacity:\s*1/);
    expect(rules).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.art\s*\{[^}]*animation:\s*none;[^}]*transition:\s*none/,
    );
  });

  it("is static: one one-shot entrance of opacity and transform, nothing infinite, no dash or filter motion", () => {
    expect(rules).not.toMatch(/infinite/);
    const keyframes = [...rules.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)];
    expect(keyframes.map((m) => m[1])).toEqual(["materialize"]);
    const animated = [...keyframes[0][2].matchAll(/([\w-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(animated)).toEqual(new Set(["opacity", "transform"]));
    expect(rules).not.toMatch(/animation-iteration-count/);
    expect(rules).toMatch(/\.art\s*\{[^}]*animation:\s*materialize\s+0\.45s/);
  });

  it("uses tokens only: no raw colour, non-scaling strokes, no round caps or radii", () => {
    expect(rules).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(rules).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab|hwb)\(/);
    expect(rules).toMatch(/vector-effect:\s*non-scaling-stroke/);
    expect(rules).not.toMatch(/stroke-linecap:\s*round|stroke-linejoin:\s*round|border-radius/);
    expect(rules).not.toMatch(/data-intro-reveal/);
    for (const m of rules.matchAll(/(?:stroke|fill):\s*([^;]+);/g)) {
      if (m[1].trim() === "none") continue;
      expect(m[1], m[0]).toMatch(/var\(--/);
    }
  });

  it("the components are pure — no hooks, no client directive, no randomness — so the server and the browser draw the same", () => {
    for (const file of ["components/scene/art/ServiceArt.tsx", "components/scene/art/serviceArtPaths.ts"]) {
      const src = read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(src, file).not.toMatch(/^\s*["']use client["']/m);
      expect(src, file).not.toMatch(/\buse(?:State|Effect|Ref|Memo|Callback|LayoutEffect|SyncExternalStore)\b/);
      expect(src, file).not.toMatch(/Math\.random/);
    }
  });
});
