/**
 * The hero core illustration's geometry: SVG path data for HeroCoreArt, computed once at
 * module scope from the same proportions the WebGL core uses (components/scene/shapes.ts),
 * so the crossfade from art to canvas lands on the same silhouette.
 *
 * Pure and deterministic (seeded randomness only): imported by a server component, never by
 * client code. Units are the art's viewBox, -100…100 on both axes, y DOWN; the core's outer
 * radius `CORE.R` maps to 95 units.
 */

import { CORE, RING_TILTS, projectOrtho, type Vec3 } from "@/components/scene/shapes";
import { mulberry32 } from "@/components/three/random";

export const ART_VIEWBOX = "-100 -100 200 200";

/** Art units per scene unit. */
export const ART_SCALE = 95 / CORE.R;

const TAU = Math.PI * 2;

/** Two decimals, never `-0`: the markup is identical on every render. */
const round = (v: number) => Math.round(v * 100) / 100 + 0;
const fmt = (v: number) => String(round(v));
/**
 * One decimal, never `-0`, for the particle cloud — the bulk of the numbers. The art ships twice
 * in the home page's HTML (the markup and the RSC payload of the hero's slot), and a tenth of a
 * unit is at most 0.3px at the art's largest size. The rings, nucleus and glints keep two.
 */
const fmt1 = (v: number) => String(Math.round(v * 10) / 10 + 0);
/** The most rounding both components of a streak to a tenth can shorten it (0.05·√2). */
const ROUNDING_SLACK = 0.08;

/** The frosted sphere's radius in art units. */
export const SPHERE_R = round(CORE.sphere * ART_SCALE);
/** The glass gradient's circle: the sphere plus the soft halo around it. */
export const HALO_R = 72;
/** The boost wave starts just outside the sphere and scales out from the centre. */
export const WAVE_R = 40;

/** Shortest particle streak, in art units (≥ 3× the widest particle stroke at phone size). */
export const PARTICLE_MIN_LENGTH = 4;
/** Half the span of a cross mark, in art units. */
export const CROSS_ARM = 3.5;

/* ---- rings --------------------------------------------------------------------------- */

/**
 * A three.js Euler XYZ rotation on a point: R = Rx(a)·Ry(b)·Rz(c), so z turns first. The
 * WebGL core sets each ring's quaternion from exactly this tilt.
 */
export function rotateEulerXYZ(p: Vec3, tilt: readonly [number, number, number]): Vec3 {
  const [a, b, c] = tilt;
  const [x0, y0, z0] = p;
  const x1 = x0 * Math.cos(c) - y0 * Math.sin(c);
  const y1 = x0 * Math.sin(c) + y0 * Math.cos(c);
  const x2 = x1 * Math.cos(b) + z0 * Math.sin(b);
  const z2 = -x1 * Math.sin(b) + z0 * Math.cos(b);
  const y3 = y1 * Math.cos(a) - z2 * Math.sin(a);
  const z3 = y1 * Math.sin(a) + z2 * Math.cos(a);
  return [x2, y3, z3];
}

/**
 * Ring `i` (a torus in its local xy plane, tilted by `RING_TILTS[i]`) seen straight down the
 * camera axis: the point at angle θ is `cos θ·u + sin θ·v` on screen, `depth` towards the
 * viewer. A circle under an orthographic projection is an exact ellipse, `rx`/`ry` along
 * `angle` (degrees), and `clockwise` says which way θ runs on screen (y down).
 */
export type RingEllipse = {
  u: readonly [number, number];
  v: readonly [number, number];
  depth: readonly [number, number];
  rx: number;
  ry: number;
  angle: number;
  clockwise: boolean;
};

export function ringEllipse(i: number): RingEllipse {
  const r = CORE.rings[i];
  const tilt = RING_TILTS[i];
  const pu = projectOrtho(rotateEulerXYZ([r, 0, 0], tilt), 0, 0, ART_SCALE);
  const pv = projectOrtho(rotateEulerXYZ([0, r, 0], tilt), 0, 0, ART_SCALE);
  // Semi-axes: the square roots of the eigenvalues of M·Mᵀ, M = [u v].
  const a00 = pu[0] * pu[0] + pv[0] * pv[0];
  const a11 = pu[1] * pu[1] + pv[1] * pv[1];
  const a01 = pu[0] * pu[1] + pv[0] * pv[1];
  const mean = (a00 + a11) / 2;
  const spread = Math.hypot((a00 - a11) / 2, a01);
  return {
    u: [pu[0], pu[1]],
    v: [pv[0], pv[1]],
    depth: [pu[2], pv[2]],
    rx: Math.sqrt(mean + spread),
    ry: Math.sqrt(Math.max(0, mean - spread)),
    angle: (Math.atan2(2 * a01, a00 - a11) / 2) * (180 / Math.PI),
    clockwise: pu[0] * pv[1] - pu[1] * pv[0] > 0,
  };
}

export function ringPoint(e: RingEllipse, theta: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c * e.u[0] + s * e.v[0], c * e.u[1] + s * e.v[1]];
}

/** Behind the sphere's silhouette: further than the centre and inside its outline. */
export function ringPointHidden(e: RingEllipse, theta: number): boolean {
  const depth = Math.cos(theta) * e.depth[0] + Math.sin(theta) * e.depth[1];
  const [x, y] = ringPoint(e, theta);
  return depth < 0 && Math.hypot(x, y) < SPHERE_R;
}

export type RingSegment = { from: number; to: number; hidden: boolean };

/**
 * The ring cut into stretches that are either hidden behind the sphere or in view, as angle
 * ranges covering one full turn. Boundaries are found by sampling, then bisection.
 */
export function ringSegments(e: RingEllipse, samples = 720): RingSegment[] {
  const step = TAU / samples;
  const bounds: number[] = [];
  for (let k = 0; k < samples; k += 1) {
    let lo = k * step;
    let hi = (k + 1) * step;
    const loHidden = ringPointHidden(e, lo);
    if (loHidden === ringPointHidden(e, hi)) continue;
    for (let n = 0; n < 40; n += 1) {
      const mid = (lo + hi) / 2;
      if (ringPointHidden(e, mid) === loHidden) lo = mid;
      else hi = mid;
    }
    bounds.push((lo + hi) / 2);
  }
  if (bounds.length === 0) return [{ from: 0, to: TAU, hidden: ringPointHidden(e, 0) }];
  return bounds.map((from, j) => {
    const to = j + 1 < bounds.length ? bounds[j + 1] : bounds[0] + TAU;
    return { from, to, hidden: ringPointHidden(e, (from + to) / 2) };
  });
}

/**
 * One stretch of the ring as SVG elliptical arcs. Each arc spans at most 120°, so the
 * large-arc flag is always 0 and a full turn never degenerates into a zero-length arc.
 */
export function arcPath(e: RingEllipse, from: number, to: number): string {
  const pieces = Math.max(1, Math.ceil((to - from) / (TAU / 3)));
  const [x0, y0] = ringPoint(e, from);
  let d = `M${fmt(x0)} ${fmt(y0)}`;
  for (let k = 1; k <= pieces; k += 1) {
    const [x, y] = ringPoint(e, from + ((to - from) * k) / pieces);
    d += `A${fmt(e.rx)} ${fmt(e.ry)} ${fmt(e.angle)} 0 ${e.clockwise ? 1 : 0} ${fmt(x)} ${fmt(y)}`;
  }
  return d;
}

/* ---- nucleus ------------------------------------------------------------------------- */

const PHI = (1 + Math.sqrt(5)) / 2;
/** The wire nucleus around the plasma core, in scene units (the WebGL core's wire shell). */
const NUCLEUS_WIRE_R = 0.55;
/** A fixed three-quarter view, so the icosahedron never reads as a flat hexagon. */
const NUCLEUS_YAW = 0.5;
const NUCLEUS_PITCH = 0.35;

function icosahedronEdges(): Array<[Vec3, Vec3]> {
  const raw: Vec3[] = [];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      raw.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
    }
  }
  const k = NUCLEUS_WIRE_R / Math.hypot(1, PHI);
  const vertices = raw.map(([x, y, z]): Vec3 => [x * k, y * k, z * k]);
  const edges: Array<[Vec3, Vec3]> = [];
  for (let i = 0; i < raw.length; i += 1) {
    for (let j = i + 1; j < raw.length; j += 1) {
      const d = Math.hypot(raw[i][0] - raw[j][0], raw[i][1] - raw[j][1], raw[i][2] - raw[j][2]);
      if (Math.abs(d - 2) < 1e-9) edges.push([vertices[i], vertices[j]]);
    }
  }
  return edges;
}

/* ---- particles ----------------------------------------------------------------------- */

const PARTICLE_SEED = 0x5eed;
/** Radii the streaks scatter over, in art units: outside the sphere, inside the frame. */
const PARTICLE_RADII = [50, 93] as const;

/** A streak roughly tangent to its orbit (so the cloud reads as swirling), as `M … l …`. */
function streak(random: () => number, maxExtra: number): string {
  const [inner, outer] = PARTICLE_RADII;
  const r = inner + (outer - inner) * ((random() + random()) / 2);
  const angle = random() * TAU;
  // The slack keeps the ROUNDED streak at least PARTICLE_MIN_LENGTH long.
  const length = PARTICLE_MIN_LENGTH + ROUNDING_SLACK + maxExtra * random();
  const heading = angle + Math.PI / 2 + (random() - 0.5) * 0.7;
  const dx = Math.cos(heading) * length;
  const dy = Math.sin(heading) * length;
  const cx = Math.cos(angle) * r;
  const cy = Math.sin(angle) * r;
  return `M${fmt1(cx - dx / 2)} ${fmt1(cy - dy / 2)}l${fmt1(dx)} ${fmt1(dy)}`;
}

function cross(random: () => number): string {
  const [inner, outer] = PARTICLE_RADII;
  const r = inner + 6 + (outer - inner - 12) * random();
  const angle = random() * TAU;
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r;
  return `M${fmt1(x - CROSS_ARM)} ${fmt1(y)}h${fmt1(2 * CROSS_ARM)}M${fmt1(x)} ${fmt1(y - CROSS_ARM)}v${fmt1(2 * CROSS_ARM)}`;
}

/* ---- the illustration ---------------------------------------------------------------- */

export type CoreArtPaths = {
  /** Every ring stretch hidden behind the sphere, drawn under the frosted glass. */
  ringsHidden: string;
  /** The stretches of each ring in view, drawn over the glass (inner → outer). */
  rings: readonly [string, string, string];
  nucleus: string;
  /** Two specular glints on the sphere's upper left. */
  specular: string;
  /** Bright streaks of the particle cloud. */
  streaks: string;
  /** Faint streaks and HUD crosses. */
  marks: string;
};

function glint(radius: number, fromDeg: number, toDeg: number): string {
  const a = (fromDeg * Math.PI) / 180;
  const b = (toDeg * Math.PI) / 180;
  return `M${fmt(Math.cos(a) * radius)} ${fmt(Math.sin(a) * radius)}A${fmt(radius)} ${fmt(radius)} 0 0 1 ${fmt(Math.cos(b) * radius)} ${fmt(Math.sin(b) * radius)}`;
}

function buildCoreArt(): CoreArtPaths {
  const hidden: string[] = [];
  const rings = [0, 1, 2].map((i) => {
    const e = ringEllipse(i);
    let visible = "";
    for (const segment of ringSegments(e)) {
      const d = arcPath(e, segment.from, segment.to);
      if (segment.hidden) hidden.push(d);
      else visible += d;
    }
    return visible;
  });

  const nucleus = icosahedronEdges()
    .map(([p, q]) => {
      const [x1, y1] = projectOrtho(p, NUCLEUS_YAW, NUCLEUS_PITCH, ART_SCALE);
      const [x2, y2] = projectOrtho(q, NUCLEUS_YAW, NUCLEUS_PITCH, ART_SCALE);
      return `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
    })
    .join("");

  const random = mulberry32(PARTICLE_SEED);
  const streaks = Array.from({ length: 24 }, () => streak(random, 4)).join("");
  const marks =
    Array.from({ length: 12 }, () => streak(random, 2)).join("") +
    Array.from({ length: 6 }, () => cross(random)).join("");

  return {
    ringsHidden: hidden.join(""),
    rings: [rings[0], rings[1], rings[2]],
    nucleus,
    specular: glint(SPHERE_R * 0.8, 198, 244) + glint(SPHERE_R * 0.8, 252, 262),
    streaks,
    marks,
  };
}

export const CORE_ART: CoreArtPaths = buildCoreArt();
