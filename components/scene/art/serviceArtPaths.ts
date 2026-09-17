/**
 * The Directions HUD screen's static illustrations as SVG path data — one composition per
 * service model, drawn from the same proportions as the WebGL scene (components/scene/shapes.ts)
 * so the crossfade between the two lands on a familiar silhouette.
 *
 * Pure and deterministic: no DOM, no `Math.random`. Each direction's table is built the first
 * time it is asked for (`serviceArtPaths`) and kept. `ServiceArt.tsx` draws from it: on the
 * server for the direction the section opens on (a slot passed down by the page), in the browser
 * for the others, once selected (a chunk `Directions` loads then). The page used to pass all five
 * drawings as server slots, and a slot is serialised into the RSC payload, so every HTML response
 * carried them. Every model is built in scene units (y up), projected orthographically, then
 * fitted into the art's `-100 … 100` view box. Nothing here draws a dot: nodes are hexagons,
 * packets are butt-capped bars, and there is no `<circle>` at all — every shape is a path.
 *
 * The first direction's strings still ship twice in the home page's HTML (the rendered markup
 * and the RSC payload), so they are kept lean: relative commands, one decimal at most, projected
 * circles as two arcs.
 *
 * (Not `serviceArt.ts`: next to `ServiceArt.tsx` that name collides on case-insensitive file
 * systems — Windows and macOS resolve both imports to the same file.)
 */

import {
  COMMERCE_GATES,
  CUBE_LAYOUTS,
  buildNeuralGraph,
  commerceTrackPoint,
  hubLayout,
  projectOrtho,
  type Vec3,
} from "@/components/scene/shapes";
import type { SceneShape } from "@/lib/scene";

/** Half the view box the fitted drawing may use (the rest is a margin for strokes). */
export const ART_EXTENT = 88;

type Pt = readonly [number, number];

/**
 * A drawable in pre-fit units: a polyline (optionally closed; `whole` rounds to integers, for
 * dense curves where a tenth of a unit is invisible), a quadratic Bézier, or an ellipse given by
 * its centre and two conjugate semi-diameters (any projected circle).
 */
type Seg =
  | { pts: Pt[]; closed: boolean; whole?: boolean }
  | { quad: readonly [Pt, Pt, Pt] }
  | { centre: Pt; a: Pt; b: Pt };

/* ---- vector helpers --------------------------------------------------------------------- */

const TAU = Math.PI * 2;
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const norm = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Rotate about x (the WebGL models' group tilt), y up. */
function rotX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c];
}

/** A camera: `projectOrtho` at a fixed yaw/pitch, unscaled (the fit scales). */
type View = (p: Vec3) => Vec3;
const view = (yaw: number, pitch: number): View => (p) => projectOrtho(p, yaw, pitch, 1);

const xy = (p: Vec3): Pt => [p[0], p[1]];
const line = (pts: Pt[], closed = false, whole = false): Seg => ({ pts, closed, whole });

/** A circle of radius `r` around `c` in the plane of `u`, `v`, as the projected ellipse. */
function circle(P: View, c: Vec3, u: Vec3, v: Vec3, r: number): Seg {
  const o = P(c);
  const pu = P(add(c, mul(u, r)));
  const pv = P(add(c, mul(v, r)));
  return { centre: xy(o), a: [pu[0] - o[0], pu[1] - o[1]], b: [pv[0] - o[0], pv[1] - o[1]] };
}

/** 2D convex hull (monotone chain). */
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const turn = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** A pointy-top hexagon around a projected point (a node — never a dot). */
function hexagon(c: Pt, r: number): Seg {
  return line(
    Array.from({ length: 6 }, (_, i): Pt => {
      const a = -Math.PI / 2 + (TAU * i) / 6;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    }),
    true,
  );
}

/* ---- fit + serialise -------------------------------------------------------------------- */

const round = (n: number, whole: boolean) => (whole ? Math.round(n) : Math.round(n * 10) / 10);

/** At most one decimal, no "-0", no leading zero (".5"). */
function num(n: number): string {
  const v = Math.round(n * 10) / 10;
  return String(v === 0 ? 0 : v).replace(/^(-?)0\./, "$1.");
}

/** Numbers joined the short way: no separator before a minus sign. */
function nums(values: number[]): string {
  return values.map(num).reduce((out, s, i) => (i === 0 || s.startsWith("-") ? out + s : `${out} ${s}`), "");
}

/**
 * Centre every layer's bounding box on the origin and scale it uniformly to `ART_EXTENT`,
 * then serialise. A quadratic counts its control point (the curve stays inside it); an
 * ellipse its exact extent.
 */
function fit<K extends string>(layers: Readonly<Record<K, Seg[]>>): Record<K, string> {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  const keys = Object.keys(layers) as K[];
  for (const key of keys) {
    for (const seg of layers[key]) {
      if ("centre" in seg) {
        const hx = Math.hypot(seg.a[0], seg.b[0]);
        const hy = Math.hypot(seg.a[1], seg.b[1]);
        grow(seg.centre[0] - hx, seg.centre[1] - hy);
        grow(seg.centre[0] + hx, seg.centre[1] + hy);
      } else {
        for (const [x, y] of "quad" in seg ? seg.quad : seg.pts) grow(x, y);
      }
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const k = (2 * ART_EXTENT) / Math.max(maxX - minX, maxY - minY, 1e-9);
  const place = ([x, y]: Pt): Pt => [(x - cx) * k, (y - cy) * k];

  const serialise = (seg: Seg): string => {
    if ("quad" in seg) {
      const [a, c, b] = seg.quad.map(place);
      return `M${nums([...a])}Q${nums([...c, ...b])}`;
    }
    if ("centre" in seg) {
      // Principal axes from the conjugate semi-diameters: p(t) = a·cos t + b·sin t is longest
      // at tan 2t = 2a·b / (a·a − b·b).
      const [ax, ay] = [seg.a[0] * k, seg.a[1] * k];
      const [bx, by] = [seg.b[0] * k, seg.b[1] * k];
      const t = 0.5 * Math.atan2(2 * (ax * bx + ay * by), ax * ax + ay * ay - bx * bx - by * by);
      const p: Pt = [ax * Math.cos(t) + bx * Math.sin(t), ay * Math.cos(t) + by * Math.sin(t)];
      const q: Pt = [-ax * Math.sin(t) + bx * Math.cos(t), -ay * Math.sin(t) + by * Math.cos(t)];
      const rx = Math.max(Math.hypot(...p), 0.1);
      const ry = Math.max(Math.hypot(...q), 0.1);
      const deg = (Math.atan2(p[1], p[0]) * 180) / Math.PI;
      const [ox, oy] = place(seg.centre);
      const arc = (dx: number, dy: number) => `a${nums([rx, ry, deg])} 1 0 ${nums([dx, dy])}`;
      const [px, py] = [round(p[0], false), round(p[1], false)];
      return `M${nums([ox + px, oy + py])}${arc(-2 * px, -2 * py)}${arc(2 * px, 2 * py)}z`;
    }
    // Relative deltas of the ROUNDED points, so nothing drifts along the line.
    const pts = seg.pts.map(place).map(([x, y]): Pt => [round(x, seg.whole === true), round(y, seg.whole === true)]);
    let d = `M${nums([...pts[0]])}`;
    for (let i = 1; i < pts.length; i += 1) {
      d += `l${nums([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]])}`;
    }
    return seg.closed ? `${d}z` : d;
  };

  const out = {} as Record<K, string>;
  for (const key of keys) out[key] = layers[key].map(serialise).join("");
  return out;
}

/* ---- produs-digital: assembling cubes --------------------------------------------------- */

type Box = { min: Vec3; max: Vec3 };
type Faces = { top: Seg; front: Seg; side: Seg };

/** The three faces of a box this camera sees (+y top, +z front, −x side), as closed quads. */
function boxFaces({ min, max }: Box, P: View): Faces {
  const q = (corners: Vec3[]) => line(corners.map((c) => xy(P(c))), true);
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return {
    top: q([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
    front: q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),
    side: q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]),
  };
}

const cube = (c: Vec3, size: number): Box => ({
  min: sub(c, [size / 2, size / 2, size / 2]),
  max: add(c, [size / 2, size / 2, size / 2]),
});

/** Yaw/pitch of the cubes: the three faces above are the visible ones (tested). */
export const CUBES_VIEW = { yaw: Math.PI / 4 + 0.1, pitch: 0.55 } as const;

function buildCubes() {
  const P = view(CUBES_VIEW.yaw, CUBES_VIEW.pitch);
  const { spacing: c, size } = CUBE_LAYOUTS.cube;
  const H = 1.5 * c;
  const block = boxFaces({ min: [-H, -H, -H], max: [H, H, H] }, P);

  // Seams between the 27 cells on the three visible faces.
  const seams: Seg[] = [];
  const seam = (a: Vec3, b: Vec3) => seams.push(line([xy(P(a)), xy(P(b))]));
  for (const k of [-c / 2, c / 2]) {
    seam([k, H, -H], [k, H, H]);
    seam([-H, H, k], [H, H, k]);
    seam([k, -H, H], [k, H, H]);
    seam([-H, k, H], [H, k, H]);
    seam([-H, -H, k], [-H, H, k]);
    seam([-H, k, -H], [-H, k, H]);
  }

  // The empty top-front corner cell: its three inner faces tile exactly the hexagon the
  // missing cube covered, so, painted over the block, they "remove" it.
  const [x0, x1, y0, z0] = [-H, -H + c, H - c, H - c];
  const q = (corners: Vec3[]) => line(corners.map((p) => xy(P(p))), true);
  const notch: Faces = {
    top: q([[x0, y0, z0], [x1, y0, z0], [x1, y0, H], [x0, y0, H]]),
    front: q([[x0, y0, z0], [x1, y0, z0], [x1, H, z0], [x0, H, z0]]),
    side: q([[x1, y0, z0], [x1, y0, H], [x1, H, H], [x1, H, z0]]),
  };

  // The missing cube hovering high over its slot, and two more drifting in.
  const slot: Vec3 = [(x0 + x1) / 2, y0, (z0 + H) / 2];
  const hover = add(slot, [0, 2.5 * c + size / 2, 0]);
  const arriving = boxFaces(cube(hover, size), P);
  const driftA = boxFaces(cube([-H - 1.55 * c, 0.3 * c, -0.8], size), P);
  const driftB = boxFaces(cube([H + 0.25 * c, -0.35 * c, H + 1.15 * c], size), P);

  // A dashed drop line from the hovering cube into its slot, and the build plate.
  const guide = [line([xy(P(sub(hover, [0, size / 2, 0]))), xy(P(slot))])];
  const [py, pr] = [-H - 0.3 * c, H + 0.8 * c];
  const plate = [q([[-pr, py, -pr], [pr, py, -pr], [pr, py, pr], [-pr, py, pr]])];

  return fit({
    plate,
    blockSide: [block.side],
    blockFront: [block.front],
    blockTop: [block.top],
    seams,
    notchTop: [notch.top],
    notchFront: [notch.front],
    notchSide: [notch.side],
    driftSide: [driftA.side, driftB.side],
    driftFront: [driftA.front, driftB.front],
    driftTop: [driftA.top, driftB.top],
    guide,
    arrivingSide: [arriving.side],
    arrivingFront: [arriving.front],
    arrivingTop: [arriving.top],
  });
}

/* ---- e-commerce: offer → payment → access loop ----------------------------------------- */

/** The loop's group tilt (the WebGL model's), then the camera. */
const COMMERCE_TILT = -0.5;
export const COMMERCE_VIEW = { yaw: 0.3, pitch: 0.3 } as const;

function buildCommerce() {
  const P = view(COMMERCE_VIEW.yaw, COMMERCE_VIEW.pitch);
  const at = (u: number): Vec3 => P(rotX(commerceTrackPoint(u), COMMERCE_TILT));

  // The track, split into the part behind the loop's centre and the part in front of it.
  const N = 72;
  const back: Seg[] = [];
  const front: Seg[] = [];
  let run: Pt[] = [];
  let runFront = at(0)[2] >= 0;
  for (let i = 0; i <= N; i += 1) {
    const p = at(i / N);
    run.push(xy(p));
    if (p[2] >= 0 !== runFront || i === N) {
      (runFront ? front : back).push(line(run, false, true));
      run = [xy(p)];
      runFront = p[2] >= 0;
    }
  }

  // Packets riding each leg, coloured by the gate they left.
  const leg = (from: number, to: number): Seg[] => [
    line(Array.from({ length: 19 }, (_, i) => xy(at(from + ((to - from) * i) / 18))), false, true),
  ];
  const [offer, payment, access] = COMMERCE_GATES;
  const gap = 0.07;

  // The projected direction of travel at `u` (unit, 2D).
  const heading = (u: number): Pt => {
    const a = at(u - 0.004);
    const b = at(u + 0.004);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  };

  // Each gate is a hoop the track runs through, seen at an angle: long across the track, short
  // along it — a circle (offer), a card (payment) and a hexagon (access), as in the WebGL model.
  const R = 0.5;
  const SQUASH = 0.5;
  const gate = (u: number, sides: number, rotation: number): Seg => {
    const c = xy(at(u));
    const [tx, ty] = heading(u);
    const across: Pt = [-ty * R, tx * R];
    const along: Pt = [tx * R * SQUASH, ty * R * SQUASH];
    if (sides > 12) return { centre: c, a: across, b: along };
    return line(
      Array.from({ length: sides }, (_, i): Pt => {
        const a = rotation + (TAU * i) / sides;
        return [c[0] + across[0] * Math.cos(a) + along[0] * Math.sin(a), c[1] + across[1] * Math.cos(a) + along[1] * Math.sin(a)];
      }),
      true,
    );
  };

  // A chevron in the middle of each leg, pointing along the flow.
  const chevrons: Seg[] = [offer.u, payment.u, access.u].map((u) => {
    const m = u + 1 / 6;
    const [tx, ty] = heading(m);
    const p = xy(at(m));
    const s = 0.1;
    const tip: Pt = [p[0] + tx * s * 0.5, p[1] + ty * s * 0.5];
    return line([
      [tip[0] - tx * s - ty * s, tip[1] - ty * s + tx * s],
      tip,
      [tip[0] - tx * s + ty * s, tip[1] - ty * s - tx * s],
    ]);
  });

  // A fainter inner loop, the track's echo — the HUD's guide rail.
  const inner = [
    line(Array.from({ length: 48 }, (_, i) => xy(P(rotX(mul(commerceTrackPoint(i / 48), 0.6), COMMERCE_TILT)))), true, true),
  ];

  return fit({
    inner,
    back,
    front,
    legOffer: leg(offer.u + gap, payment.u - gap),
    legPayment: leg(payment.u + gap, access.u - gap),
    legAccess: leg(access.u + gap, 1 + offer.u - gap),
    chevrons,
    gateOffer: [gate(offer.u, offer.sides, offer.rotation)],
    gatePayment: [gate(payment.u, payment.sides, payment.rotation)],
    gateAccess: [gate(access.u, access.sides, access.rotation)],
  });
}

/* ---- automatizare-api: integration hub -------------------------------------------------- */

export const HUB_VIEW = { yaw: 1.05, pitch: 0.62 } as const;
export const HUB_SATELLITES = 6;

const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA: Vec3[] = (
  [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
  ] as Vec3[]
).map(norm);

/** The icosahedron's 30 edges (vertex pairs at the shortest distance). */
export const ICOSA_EDGES: ReadonlyArray<readonly [number, number]> = ICOSA.flatMap((a, i) =>
  ICOSA.slice(i + 1).flatMap((b, k) => (Math.hypot(...sub(a, b)) < 1.1 ? [[i, i + 1 + k] as const] : [])),
);

const X: Vec3 = [1, 0, 0];
const Y: Vec3 = [0, 1, 0];
const Z: Vec3 = [0, 0, 1];

/** A satellite glyph: its wire edges and the points of its silhouette (for the fill). */
function glyph(kind: "database" | "api" | "queue" | "service", c: Vec3, s: number, P: View) {
  const seg = (a: Vec3, b: Vec3) => line([xy(P(a)), xy(P(b))]);
  if (kind === "database") {
    const [r, h] = [s * 0.8, s * 0.85];
    const rims = [h, 0, -h].map((y) => circle(P, add(c, mul(Y, y)), X, Z, r));
    // the silhouette lines sit where the rim's projected x is extreme
    const pts = Array.from({ length: 24 }, (_, i) => add(c, add(mul(X, r * Math.cos((TAU * i) / 24)), mul(Z, r * Math.sin((TAU * i) / 24)))));
    const xs = pts.map((p) => P(p)[0]);
    const [lo, hi] = [xs.indexOf(Math.min(...xs)), xs.indexOf(Math.max(...xs))];
    const edges = [...rims, seg(add(pts[lo], mul(Y, h)), add(pts[lo], mul(Y, -h))), seg(add(pts[hi], mul(Y, h)), add(pts[hi], mul(Y, -h)))];
    const outline = [h, -h].flatMap((y) => pts.map((p) => xy(P(add(p, mul(Y, y))))));
    return { edges, outline };
  }
  if (kind === "queue") {
    const [r, h] = [s * 0.85, s * 0.62];
    const rim = (y: number) =>
      Array.from({ length: 6 }, (_, i) => add(c, add(mul(Y, y), add(mul(X, r * Math.cos(Math.PI / 6 + (TAU * i) / 6)), mul(Z, r * Math.sin(Math.PI / 6 + (TAU * i) / 6))))));
    const [top, bottom] = [rim(h), rim(-h)];
    const edges = [line(top.map((p) => xy(P(p))), true), line(bottom.map((p) => xy(P(p))), true), ...top.map((p, i) => seg(p, bottom[i]))];
    return { edges, outline: [...top, ...bottom].map((p) => xy(P(p))) };
  }
  const vs: Vec3[] =
    kind === "api"
      ? [X, mul(X, -1), Y, mul(Y, -1), Z, mul(Z, -1)].map((d) => add(c, mul(d, s)))
      : ([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] as Vec3[]).map((v) => add(c, mul(norm(v), s * 0.95)));
  const pairs: Array<[number, number]> =
    kind === "api"
      ? [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2]]
      : [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  return { edges: pairs.map(([a, b]) => seg(vs[a], vs[b])), outline: vs.map((p) => xy(P(p))) };
}

function buildHub() {
  const P = view(HUB_VIEW.yaw, HUB_VIEW.pitch);

  const wire = ICOSA_EDGES.map(([a, b]) => line([xy(P(mul(ICOSA[a], 0.55))), xy(P(mul(ICOSA[b], 0.55)))]));
  const core = [line(hull(ICOSA.map((v) => xy(P(mul(v, 0.42))))), true)];
  const orbit = [circle(P, [0, 0, 0], X, Z, 1.6)];
  const plate = [circle(P, [0, -0.95, 0], X, Z, 2)];

  const sets = {
    back: { links: [] as Seg[], hulls: [] as Seg[], glyphs: [] as Seg[] },
    front: { links: [] as Seg[], hulls: [] as Seg[], glyphs: [] as Seg[] },
  };
  const packetsOut: Seg[] = [];
  const packetsIn: Seg[] = [];

  hubLayout(HUB_SATELLITES).forEach((sat, i) => {
    const dir = norm(sat.position);
    const start = mul(dir, 0.62);
    const end = sub(sat.position, mul(dir, 0.36));
    const control = add(mul(add(start, end), 0.5), [0, 0.32, 0]);
    const set = P(sat.position)[2] < 0 ? sets.back : sets.front;
    const [a, c, b] = [start, control, end].map((p) => xy(P(p)));
    set.links.push({ quad: [a, c, b] });

    const g = glyph(sat.glyph, sat.position, 0.34, P);
    set.hulls.push(line(hull(g.outline), true));
    set.glyphs.push(...g.edges);

    // A packet on the link: outbound on even links, inbound on odd ones.
    const bez = (t: number): Pt => [
      (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
      (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
    ];
    const from = i % 2 === 0 ? 0.4 : 0.12;
    (i % 2 === 0 ? packetsOut : packetsIn).push(line([0, 1, 2, 3, 4].map((k) => bez(from + k * 0.12))));
  });

  return fit({
    plate,
    orbit,
    backLinks: sets.back.links,
    backHulls: sets.back.hulls,
    backGlyphs: sets.back.glyphs,
    core,
    wire,
    frontLinks: sets.front.links,
    frontHulls: sets.front.hulls,
    frontGlyphs: sets.front.glyphs,
    packetsOut,
    packetsIn,
  });
}

/* ---- asistenti-ia: neural network ------------------------------------------------------- */

/** The WebGL model's mid-tier network: layers, fanout, and a fixed seed. */
export const NEURAL_LAYERS = [4, 6, 7, 5, 3] as const;
export const NEURAL_FANOUT = 2;
export const NEURAL_SEED = 11;
export const NEURAL_VIEW = { yaw: -0.62, pitch: 0.3 } as const;

function buildNeural() {
  const P = view(NEURAL_VIEW.yaw, NEURAL_VIEW.pitch);
  const graph = buildNeuralGraph(NEURAL_LAYERS, NEURAL_FANOUT, NEURAL_SEED);
  const at = graph.nodes.map((n) => P(n.position));
  const last = graph.layers.length - 1;

  // The cross-section ring each layer sits on.
  const rings = graph.layers.map((_, layer) =>
    circle(P, [graph.nodes[graph.layerStart[layer]].position[0], 0, 0], Y, Z, 0.55 + 0.45 * Math.sin((Math.PI * layer) / last)),
  );

  // One impulse travelling forward: from the nearest input, always along the nearest link.
  const inputs = graph.nodes.flatMap((n, i) => (n.layer === 0 ? [i] : []));
  const chain = [inputs.reduce((best, i) => (at[i][2] > at[best][2] ? i : best))];
  for (let layer = 0; layer < last; layer += 1) {
    const from = chain[chain.length - 1];
    const next = graph.edges.filter(([a]) => a === from).map(([, b]) => b);
    if (next.length === 0) break;
    chain.push(next.reduce((best, b) => (at[b][2] > at[best][2] ? b : best)));
  }
  const onChain = ([a, b]: readonly [number, number]) => chain.some((n, i) => n === a && chain[i + 1] === b);
  const edge = ([a, b]: readonly [number, number]) => line([xy(at[a]), xy(at[b])]);

  const nodeR = 0.13;
  const byDepth = graph.nodes.map((_, i) => i).sort((a, b) => at[a][2] - at[b][2]);
  const output = chain[chain.length - 1];

  return fit({
    plate: [circle(P, [0, -1.2, 0], mul(X, 1.95), mul(Z, 0.95), 1)],
    rings,
    edges: graph.edges.filter((e) => !onChain(e)).map(edge),
    impulse: graph.edges.filter(onChain).map(edge),
    nodes: byDepth.filter((i) => !chain.includes(i)).map((i) => hexagon(xy(at[i]), nodeR)),
    active: chain.slice(0, -1).map((i) => hexagon(xy(at[i]), nodeR * 1.15)),
    output: [hexagon(xy(at[output]), nodeR * 1.35)],
  });
}

/* ---- brand-ui: wave mesh with floating interface cards ---------------------------------- */

/** The wave mesh's plane, tilt and a frozen instant of its wave (the WebGL model's formula). */
const MESH = { w: 3.3, h: 2.2, tilt: -1.05, pulse: 1.15 } as const;
export const MESH_VIEW = { yaw: 0.28, pitch: 0.06 } as const;

function wave(x: number, y: number): number {
  const d = Math.hypot(x, y);
  return 0.22 * Math.sin(1.6 * x) + 0.16 * Math.sin(2.3 * y + 0.5 * x) + 0.35 * Math.exp(-(((d - MESH.pulse) * 5) ** 2));
}

function buildMesh() {
  const P = view(MESH_VIEW.yaw, MESH_VIEW.pitch);
  const surface = (x: number, y: number): Pt => xy(P(rotX([x, y, wave(x, y)], MESH.tilt)));
  const [hw, hh] = [MESH.w / 2, MESH.h / 2];
  const [ROWS, COLS] = [6, 10];

  const rowsFar: Seg[] = [];
  const rowsNear: Seg[] = [];
  for (let j = 0; j <= ROWS; j += 1) {
    const y = -hh + (MESH.h * j) / ROWS;
    const pts = Array.from({ length: 16 }, (_, i) => surface(-hw + (MESH.w * i) / 15, y));
    (y > 0 ? rowsFar : rowsNear).push(line(pts, false, true));
  }
  const cols = Array.from({ length: COLS + 1 }, (_, i) =>
    line(Array.from({ length: 8 }, (_, j) => surface(-hw + (MESH.w * i) / COLS, -hh + (MESH.h * j) / 7)), false, true),
  );

  // The pulse ring's crest, clipped to the plane.
  const pulse: Seg[] = [];
  let arc: Pt[] = [];
  for (let i = 0; i <= 48; i += 1) {
    const a = (TAU * i) / 48;
    const [x, y] = [MESH.pulse * Math.cos(a), MESH.pulse * Math.sin(a)];
    if (Math.abs(x) <= hw && Math.abs(y) <= hh) arc.push(surface(x, y));
    if ((Math.abs(x) > hw || Math.abs(y) > hh || i === 48) && arc.length) {
      pulse.push(line(arc, false, true));
      arc = [];
    }
  }

  // Three interface cards floating over the mesh, far to near, each with a drop line to the
  // surface below it.
  const cards = [
    { at: [0.55, 1.2, -0.55] as Vec3, w: 1.0, h: 0.62, foot: [0.55, 0.45] as const },
    { at: [-0.95, 0.95, 0.05] as Vec3, w: 0.9, h: 0.58, foot: [-0.95, -0.15] as const },
    { at: [1.05, 0.62, 0.55] as Vec3, w: 0.78, h: 0.5, foot: [1.05, -0.62] as const },
  ];
  const frames: Seg[] = [];
  const content: Seg[][] = [];
  const drops: Seg[] = [];
  cards.forEach(({ at, w, h, foot }) => {
    const pt = (u: number, v: number): Pt => xy(P(add(at, add(mul(X, u), mul(Y, v)))));
    const r = 0.07;
    const corner = (cx: number, cy: number, a0: number): Pt[] =>
      [0, 1, 2, 3].map((k) => pt(cx + r * Math.cos(a0 + (k * Math.PI) / 6), cy + r * Math.sin(a0 + (k * Math.PI) / 6)));
    const [u, v] = [w / 2 - r, h / 2 - r];
    frames.push(
      line([...corner(u, v, 0), ...corner(-u, v, Math.PI / 2), ...corner(-u, -v, Math.PI), ...corner(u, -v, (3 * Math.PI) / 2)], true),
    );
    const left = -w / 2 + 0.11;
    content.push([
      line([pt(left, h / 2 - 0.14), pt(left + w * 0.34, h / 2 - 0.14)]),
      line([pt(left, h / 2 - 0.27), pt(w / 2 - 0.11, h / 2 - 0.27)]),
      line([pt(left, h / 2 - 0.37), pt(left + w * 0.52, h / 2 - 0.37)]),
      line([pt(left, -h / 2 + 0.1), pt(left + w * 0.3, -h / 2 + 0.1), pt(left + w * 0.3, -h / 2 + 0.19), pt(left, -h / 2 + 0.19)], true),
    ]);
    drops.push(line([pt(0, -h / 2), surface(foot[0], foot[1])]));
  });

  return fit({
    rowsFar,
    cols,
    rowsNear,
    pulse,
    drops,
    frameFar: [frames[0]],
    contentFar: content[0],
    frameMid: [frames[1]],
    contentMid: content[1],
    frameNear: [frames[2]],
    contentNear: content[2],
  });
}

/* ---- the tables ServiceArt.tsx draws from ----------------------------------------------- */

const BUILDERS = {
  "produs-digital": buildCubes,
  "e-commerce": buildCommerce,
  "automatizare-api": buildHub,
  "asistenti-ia": buildNeural,
  "brand-ui": buildMesh,
} satisfies Record<SceneShape, () => Record<string, string>>;

/** Each direction's layers, by name (the keys its builder fits). */
export type ServiceArtPaths = { [S in SceneShape]: ReturnType<(typeof BUILDERS)[S]> };

const built: Partial<ServiceArtPaths> = {};

/**
 * One direction's path table, built on first use and kept. Deterministic, so the server and the
 * browser build the same strings, and a repeated call returns the very same object: hydrating
 * the selected drawing computes that one direction only, never all five.
 */
export function serviceArtPaths<S extends SceneShape>(shape: S): ServiceArtPaths[S] {
  const cached = built[shape];
  if (cached) return cached;
  const table = BUILDERS[shape]() as ServiceArtPaths[S];
  built[shape] = table;
  return table;
}
