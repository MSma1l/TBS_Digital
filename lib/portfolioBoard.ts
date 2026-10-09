/**
 * /portofoliu's circuit board, as numbers. 2026-10-06, the owner, of the row on a phone: "pe
 * telefon uneste te rog frumos linia cumva ca o pautina" — join the line like a spider web. So a
 * row of several lines hangs on a web spun from the chin: spokes from the hub down the gaps between
 * the names, and at every lower line's height a ring sagging from spoke to spoke. Its rules hold on
 * every layout: a page of eight and a page of nine hang on the same ring — spokes down the same
 * gaps, knots and sags between them — and only where the pads hang on it changes (a knot with a pad
 * right under it rises less); a pad is only ever a route's end, never on another project's way;
 * every turn is 45°; a pad in a sag lights the arm toward the chin; nothing crosses a name; every
 * route is one leg, from its pad to the chin's foot. A pad the web cannot reach (names that close
 * the gaps above it) keeps the short lead into a via it had before.
 *
 * The board itself is "Circuitul" (2026-10-05: the owner's pick of seven designs for the row under
 * the screen). Every project is a pad on a board whose traces run up into the monitor's chin (a
 * small square showing the project since 2026-10-08, a round one before); the route of the project
 * on the screen is lit in its colour, and picking another one sends a pulse of light along the new
 * route into the chin.
 *
 * Where the pads, their names and the chin stand (in the row's own CSS px) becomes the board's
 * traces, each pad's route, and the pulse's timing. Pure: no DOM.
 * `components/sections/portfolioCircuit.ts` measures, draws and plays it.
 */

export type Point = readonly [number, number];

/** A pad: its project, the middle of its place in the row, half its place (`half`: the lit pad, as
 *  laid out; PAD when not measured), and — measured, on a row of several lines — where its name's
 *  text stands under it: the left and right of its lines, the bottom of its last. The web runs its
 *  spokes down the real gaps between the names and keeps its knots under them; without it, it takes
 *  a name as no wider than its place. */
export interface BoardPad {
  id: string;
  x: number;
  cy: number;
  half?: number;
  label?: { left: number; right: number; bottom: number };
}

/** The monitor's chin, in the row's px: the middle of its RGB glyph (`x`, `mid`), the glyph's
 *  foot (where the trunk ends) and the monitor's bottom edge (above the row: negative). */
export interface BoardChin {
  x: number;
  foot: number;
  mid: number;
  bottom: number;
}

/** A leg of a route: its points and its length (the pulse is timed on it). */
export interface BoardLeg {
  pts: Point[];
  len: number;
}

/** A pad's route into the chin: one leg, from the pad's middle to the chin's foot (a lower line's
 *  climbs the web). Only a pad the web cannot reach has two — its lead into its via (`vias`), then
 *  the trunk: its light dives there and comes up the trunk. */
export interface BoardRoute {
  legs: BoardLeg[];
  vias: Point[];
}

export interface Board {
  /** The traces, as runs that never overlap: drawn as one dim path. */
  tracks: Point[][];
  /** The vias (squares, `VIA` wide) of the pads the web cannot reach: only where names close the
   *  gaps above a pad. */
  vias: Point[];
  /** Each pad's route, by project id. */
  routes: Map<string, BoardRoute>;
  /** Where the chin flashes as a pulse arrives; null when the row is wired to nothing. */
  flash: Point | null;
}

/* A pad's place is 32px, 26px on a phone (Portfolio.module.css): the lit pad fills it, the pad at
   rest is the smaller square in its middle. portfolioCircuit.ts measures it (`BoardPad.half`), so
   the board follows the stylesheet. Every trace starts under its pad, at the centre, so it meets
   the pad at any size; the web keeps its distance from the lit pad's square, corners and all
   (`Geometry`, at the web). */
/** Half the lit pad, for a row that did not measure it. */
const PAD = 16;
/** The lit pad's ring of light, 1px round it, and its corners' radius. */
const RIM = 1;
const CORNER = 4;
/** A trace leaves the lit pad straight up for this long... */
const NECK = 4;
/** ...then bends 45° onto its bus, as tall as it is wide. */
const BEND = 6;
/** Under the chin the bus turns up into the trunk with a 45° Y. */
const JOIN = 6;
/** A pad the web cannot reach: after its bend, its trace runs this far into its via. */
const LEAD = 8;
/** A via: a square this wide. */
export const VIA = 5;
/** The monitor's foot at most this far above the row, or the row is wired to nothing. */
const MAX_GAP = 30;

/** Onto the middle of a pixel: a 1px line there is crisp. */
const snap = (v: number) => Math.round(v - 0.5) + 0.5;
const num = (v: number) => String(Math.round(v * 100) / 100);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A polyline without its repeated points (a bend that came to nothing). */
function dedupe(pts: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < 0.01 && Math.abs(q[1] - p[1]) < 0.01) continue;
    out.push(p);
  }
  return out;
}

function leg(pts: readonly Point[]): BoardLeg {
  const q = dedupe(pts);
  let len = 0;
  for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
  return { pts: q, len };
}

/** Polylines as one SVG path (`d`); a line of fewer than two points draws nothing. */
export function pathOf(lines: readonly (readonly Point[])[]): string {
  return lines
    .map((line) => {
      const q = dedupe(line);
      return q.length < 2 ? "" : q.map((p, i) => `${i ? "L" : "M"}${num(p[0])} ${num(p[1])}`).join(" ");
    })
    .filter(Boolean)
    .join(" ");
}

/** Squares `size` wide centred on points, as one SVG path. */
export function squaresOf(pts: readonly Point[], size: number): string {
  const h = size / 2;
  return pts
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => `M${num(p[0] - h)} ${num(p[1] - h)}h${num(size)}v${num(size)}h${num(-size)}Z`)
    .join("");
}

/** The row's lines of pads, top to bottom (a phone wraps nine into five and four), each with its
 *  bus just inside its own buttons' top; and the line of every pad. */
function tiersOf(pads: readonly BoardPad[], g: Geometry) {
  const tiers: { cy: number; bus: number }[] = [];
  const tier = new Map<BoardPad, number>();
  [...pads]
    .sort((a, b) => a.cy - b.cy)
    .forEach((p) => {
      const last = tiers[tiers.length - 1];
      if (!last || p.cy - last.cy > 4) tiers.push({ cy: p.cy, bus: snap(p.cy - g.pad - NECK - BEND) });
      tier.set(p, tiers.length - 1);
    });
  return { tiers, tier };
}

/** Whether the monitor stands right above the row and across it, with room for the trunk. A row in
 *  a strip of its own, or one pushed away from the screen, is wired to nothing. */
function wired(chin: BoardChin, width: number, bus0: number): boolean {
  return (
    [chin.x, chin.foot, chin.mid, chin.bottom].every(Number.isFinite) &&
    chin.bottom <= 0.5 &&
    -chin.bottom <= MAX_GAP &&
    chin.x >= 0 &&
    chin.x <= width &&
    chin.foot < bus0 - JOIN - 2
  );
}

/**
 * The board for pads and a chin measured in the row's px. The line under the monitor: every pad
 * goes up, bends 45° toward the chin and joins the bus, whose two halves turn up in a Y into the
 * trunk, which enters the chin under its glyph (a pad right under the chin goes straight up). A
 * row of more lines hangs on a web spun from the chin (`webOf`, at the end): the first line as it
 * is, and the lower lines' pads on spokes and rings that never cross a name or another project.
 */
export function buildBoard(width: number, pads: readonly BoardPad[], chin: BoardChin | null): Board {
  const tracks: Point[][] = [];
  const vias: Point[] = [];
  const routes = new Map<string, BoardRoute>();
  /* a pad with no place in the row (not a number) is on no line, and unlit: the others are wired
     as if it were not there */
  const inRow = pads.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.cy));
  const g = geometry(halfOf(inRow));
  const { tiers, tier } = tiersOf(inRow, g);
  if (!chin || !tiers.length || !wired(chin, width, tiers[0].bus)) return { tracks, vias, routes, flash: null };
  const cx = snap(chin.x);
  const foot = chin.foot;
  const b0 = tiers[0].bus;
  const apex = b0 - JOIN;
  const trunk: Point[] = [
    [cx, apex],
    [cx, foot],
  ];
  let lEnd = Infinity;
  let rEnd = -Infinity;
  for (const p of inRow) {
    if (tier.get(p) !== 0) continue;
    const X = Math.abs(p.x - chin.x) < 1.5 ? cx : snap(p.x);
    const ad = Math.abs(cx - X);
    if (ad < 0.5) {
      tracks.push([
        [X, p.cy],
        [X, apex],
      ]);
      routes.set(p.id, {
        legs: [
          leg([
            [X, p.cy],
            [X, foot],
          ]),
        ],
        vias: [],
      });
      continue;
    }
    const s = X < cx ? -1 : 1;
    if (ad < BEND + JOIN + 2) {
      /* too near the chin for a bend and the Y: one diagonal straight into the trunk */
      const y1 = b0 + BEND;
      const y2 = y1 - ad;
      const run: Point[] = [
        [X, p.cy],
        [X, y1],
        [cx, y2],
      ];
      if (y2 > apex) run.push([cx, apex]);
      tracks.push(run);
      routes.set(p.id, {
        legs: [
          leg([
            [X, p.cy],
            [X, y1],
            [cx, y2],
            [cx, foot],
          ]),
        ],
        vias: [],
      });
      continue;
    }
    const jx = X - s * BEND;
    tracks.push([
      [X, p.cy],
      [X, b0 + BEND],
      [jx, b0],
    ]);
    routes.set(p.id, {
      legs: [
        leg([
          [X, p.cy],
          [X, b0 + BEND],
          [jx, b0],
          [cx + s * JOIN, b0],
          [cx, apex],
          [cx, foot],
        ]),
      ],
      vias: [],
    });
    if (s < 0) lEnd = Math.min(lEnd, jx);
    else rEnd = Math.max(rEnd, jx);
  }
  if (lEnd !== Infinity) {
    tracks.push([
      [lEnd, b0],
      [cx - JOIN, b0],
      [cx, apex],
    ]);
  }
  if (rEnd !== -Infinity) {
    tracks.push([
      [rEnd, b0],
      [cx + JOIN, b0],
      [cx, apex],
    ]);
  }
  tracks.push(trunk);
  for (const p of pads) if (!inRow.includes(p)) routes.set(p.id, { legs: [], vias: [] });
  if (tiers.length < 2) return { tracks, vias, routes, flash: [cx, chin.mid] };
  /* more than one line: the web, its tracks drawn whole (the first line's among them). A name not
     measured whole counts as not measured. */
  const lines: BoardPad[][] = tiers.map(() => []);
  for (const p of inRow) {
    const l = p.label;
    const whole = l && [l.left, l.right, l.bottom].every(Number.isFinite) && l.left <= l.right;
    lines[tier.get(p) ?? 0].push(whole ? p : { id: p.id, x: p.x, cy: p.cy });
  }
  for (const l of lines) l.sort((a, b) => a.x - b.x);
  const web = webOf(width, lines, tiers, cx, chin.x, foot, routes, g);
  return { tracks: web.tracks, vias: web.vias, routes, flash: [cx, chin.mid] };
}

/* ---------- the pulse: 600ms at most ----------
   The new pad lights at once (its CSS); 30ms later a pulse leaves it and runs its route into the
   chin, faster the longer the route (a run of 180–330ms, the tail sinking in included); the chin
   flashes as it arrives, and only then does the screen give up the old picture. A route of two legs
   (a pad the web cannot reach) dives into its via and the light comes up the trunk. The old route
   goes dark in a blink (at once when a switch was still running). */
export const PULSE = {
  /** from the pad lighting to the pulse leaving it */
  delay: 30,
  /** a leg from a pad: this long, and this much more per px of it, within min..max */
  runBase: 150,
  runPerPx: 0.55,
  runMin: 180,
  runMax: 330,
  /** from a via to the foot of the trunk... */
  jump: 30,
  /** ...and up the trunk */
  trunkRun: 80,
  /** the chin's flash... */
  flash: 230,
  /** ...from just before the pulse arrives */
  flashLead: 30,
  /** the old route going dark */
  fade: 140,
} as const;

/** The pulse's head, back to front: a long faint halo, a body of the project's colour, a short
 *  white-hot core, all ending at the head, so the streak tapers. It runs on past the end of a leg
 *  by the longest of them (`TAIL`), sinking into the chin or the via. */
export const HEAD = { halo: 34, body: 24, core: 10 } as const;
export const TAIL = 34;
/** Half the height of a run's window: room for the head's 9px halo. */
export const CLIP = 8;

/** The pulse's progress along a leg for u from 0 to 1 of its run: it leaves the pad at a third of
 *  its mean speed and reaches the end at one and a half times it — it plunges into the chin, it
 *  never eases into it. Increasing on [0, 1]. */
function ease(u: number): number {
  const x = clamp(u, 0, 1);
  return x * (0.35 + x * (0.85 - 0.2 * x));
}
/** ...and back: the u at which it has come `y` of the way. */
function uneased(y: number): number {
  if (!(y > 0)) return 0;
  if (y >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < y) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One straight run of a route, as the pulse plays it: a window from `from`, `length` long and
 *  turned `angle` degrees, in which the light slides along x by `frames` (offset 0–1 of the
 *  leg's run; x in px). */
export interface PulseRun {
  from: Point;
  angle: number;
  length: number;
  frames: { offset: number; x: number }[];
  duration: number;
  delay: number;
}

export interface PulsePlan {
  runs: PulseRun[];
  /** When a via takes the light (ms from the start), on a route of two legs. */
  sparks: number[];
  /** When the head reaches the chin (ms from the start). */
  arrive: number;
}

/** The slide of the run starting `s0` along a leg (`l` long) whose head travels `total`: the head's
 *  place, less s0, held between 0 and l + TAIL. Exact at the window's edges, sampled inside it. */
function slideFrames(s0: number, l: number, total: number): PulseRun["frames"] {
  const end = l + TAIL;
  const x = (u: number) => clamp(total * ease(u) - s0, 0, end);
  const u0 = uneased(s0 / total);
  const u1 = Math.max(u0, uneased((s0 + end) / total));
  const frames: PulseRun["frames"] = [];
  if (u0 > 0) frames.push({ offset: 0, x: 0 });
  const steps = Math.max(2, Math.ceil((u1 - u0) * 30));
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    frames.push({ offset: u, x: i === 0 ? 0 : i === steps ? end : x(u) });
  }
  if (u1 < 1) frames.push({ offset: 1, x: end });
  return frames;
}

/** The pulse along every leg of a route: one timing for all the runs of a leg, so the streak turns
 *  every corner whole; between two legs, the via's spark and the jump to the trunk. */
export function planPulse(route: BoardRoute): PulsePlan {
  const runs: PulseRun[] = [];
  const sparks: number[] = [];
  let t: number = PULSE.delay;
  let arrive: number = PULSE.delay;
  route.legs.forEach((lg, i) => {
    if (!(lg.len > 0.5) || lg.pts.length < 2) return;
    const total = lg.len + TAIL;
    const duration =
      i === 0 ? clamp(PULSE.runBase + PULSE.runPerPx * total, PULSE.runMin, PULSE.runMax) : PULSE.trunkRun;
    let s = 0;
    for (let k = 1; k < lg.pts.length; k++) {
      const a = lg.pts[k - 1];
      const b = lg.pts[k];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(length > 0.01)) continue;
      runs.push({
        from: a,
        angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
        length,
        frames: slideFrames(s, length, total),
        duration,
        delay: t,
      });
      s += length;
    }
    const reach = t + duration * uneased(lg.len / total);
    arrive = reach;
    if (i < route.legs.length - 1) {
      if (route.vias.length) sparks.push(reach);
      t = reach + PULSE.jump;
    }
  });
  return { runs, sparks, arrive };
}

/* ---------- the web: a row of several lines ----------
   A phone wraps the row into lines, and the lower ones hang on a web spun from the chin. Its
   spokes leave the hub — straight down the trunk; along the Y's arms, as 45° rays that turn down
   above the names (a tent with a flat top where a ray would reach into them); or off the bus with
   a 45° drop — and run down the gaps between the names: halfway between the pads where that
   clears both names by MARGIN (or straight on, where the trunk, a spoke from the line above or a
   pad of the line below already stands in the gap), else down the middle of the real gap between
   the measured names. At every
   lower line's height the ring rises from spoke to spoke into knots, each two 45° arms, and sags
   between them; a sag that holds no pad keeps a flat bottom. A pad right under a spoke hangs from
   its knot on a short straight neck; a pad between two spokes sits in the sag, held by the arms of
   both, and the knots over it rise higher (but stay under the names above). A line under a lower
   one hangs on the spokes that go on down through its knots, drop off their arms, or leave the
   ring from a dip under it. It is all one graph: a route is the shortest way from the hub to its
   pad, read backwards (a pad is only ever a way's end), and the tracks are its runs, each drawn
   once. */

/** A run keeps this far from a lit pad's ring of light, beside the pad and past its corners. */
const AIR_PAD = 3;

/** The web's measures for a lit pad `pad` px from its middle to each side: a square, its corners
 *  rounded, in its 1px ring. Until 2026-10-08 the pads were round, and a distance from the middle
 *  was the whole test; a square's corner reaches √2 as far along a diagonal — the way every bend of
 *  the board runs — so the web measures runs against the square itself (`padGap`). */
interface Geometry {
  /** half the lit pad */
  pad: number;
  /** the ring's corners: their centres `inner` from the middle along both axes, their radius `round` */
  inner: number;
  round: number;
  /** a run beside a pad keeps this far from its middle: half the pad, its ring, AIR_PAD */
  clear: number;
  /** a name's line boxes start this far under its pad's middle (half the pad, the 5–6px under it,
   *  less the line box's own leading)... */
  name: number;
  /** a knot rises this high over its pads' middles when a pad sits in its sag... */
  sag: number;
  /** ...and this when a pad hangs right under it: the pad's neck is short and straight, the sags
   *  either side of it lighter, and the 45° arms (hang / √2 from its middle) keep AIR_PAD from the
   *  ring's corners, as every run does */
  hang: number;
  /** squeezed lower than this, a knot over a pad has no arms: they would come within 1px of its
   *  corners */
  hangMin: number;
  /** a pad this near a spoke takes it in, bent 45° at its end, close by the pad; a pad farther off
   *  hangs on a knot at least near·√2 from its middle, clear of its corner */
  near: number;
}

function geometry(pad: number): Geometry {
  const round = CORNER + RIM;
  const inner = pad + RIM - round;
  return {
    pad,
    inner,
    round,
    clear: pad + RIM + AIR_PAD,
    name: pad + 4,
    sag: pad + 18,
    hang: Math.ceil(2 * inner + (round + AIR_PAD) * Math.SQRT2),
    hangMin: Math.ceil(2 * inner + (round + 1) * Math.SQRT2),
    near: pad + RIM,
  };
}

/** Half the lit pad as the row lays it out: the largest measured (to the half px), else PAD. */
function halfOf(pads: readonly BoardPad[]): number {
  const halves = pads.flatMap((p) => (typeof p.half === "number" && p.half > 0 && Number.isFinite(p.half) ? [p.half] : []));
  return halves.length ? Math.round(Math.max(...halves) * 2) / 2 : PAD;
}

/** A ray turns down this far above the names' line boxes (a lit glow's 3, the boxes' 1.5). */
const NAME_GAP = 4.5;
/** A gap between two names narrower than this carries no spoke (their pads hang on the spokes
 *  beside it)... */
const GAP = 7;
/** ...and a spoke in a wider one keeps this far from both names. */
const MARGIN = 3;
/** A knot stays this far under the names of the line above. */
const AIR = 4;
/** Where a spoke leaves a ring for the line below away from a knot, the ring dips this deep. */
const DIP = JOIN;
/** A knot over no pad lower than this is left out, unless a spoke of the line below drops off it:
 *  its spoke would meet the ring square. */
const KNOT_MIN = 3;
/** The columns' pitch when no line has two pads. */
const PITCH = 64;
/** The web stays this far inside the row. */
const EDGE = 4;

/** A run of the web from one of its points (where runs meet) to another, `a` on the hub's side:
 *  a route climbs it only from `b` to `a` — never down one arm of a knot and up the other —
 *  but for a ring's flat runs, which it takes either way (`both`). */
interface Arc {
  a: number;
  b: number;
  pts: Point[];
  both: boolean;
}

/** Where a spoke starts — a point of the web — and its way from there to where it turns down. */
interface Top {
  n: number;
  pts: Point[];
}

/** How far point p is from segment ab. */
function distTo(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}

/** How far apart segments ab and cd are: 0 when they cross. */
function apart(a: Point, b: Point, c: Point, d: Point): number {
  const side = (p: Point, q: Point, r: Point) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return 0;
  return Math.min(distTo(a, c, d), distTo(b, c, d), distTo(c, a, b), distTo(d, a, b));
}

/** Whether segment ab runs into the box [x0, x1] × [y0, y1]. */
function meets(a: Point, b: Point, x0: number, y0: number, x1: number, y1: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const sides: [number, number][] = [
    [a[0] - b[0], a[0] - x0],
    [b[0] - a[0], x1 - a[0]],
    [a[1] - b[1], a[1] - y0],
    [b[1] - a[1], y1 - a[1]],
  ];
  for (const [p, q] of sides) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    if (p < 0) t0 = Math.max(t0, q / p);
    else t1 = Math.min(t1, q / p);
    if (t0 > t1) return false;
  }
  return true;
}

/** How far segment ab is from the square [x ± h] × [y ± h]: 0 when it runs into it. Two convex
 *  shapes apart are nearest at a corner of one of them. */
function boxDist(a: Point, b: Point, x: number, y: number, h: number): number {
  const x0 = x - h;
  const x1 = x + h;
  const y0 = y - h;
  const y1 = y + h;
  if (meets(a, b, x0, y0, x1, y1)) return 0;
  const toBox = (q: Point) => Math.hypot(Math.max(x0 - q[0], 0, q[0] - x1), Math.max(y0 - q[1], 0, q[1] - y1));
  const corners: Point[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return Math.min(toBox(a), toBox(b), ...corners.map((c) => distTo(c, a, b)));
}

/** How far segment ab passes from pad p lit — from its ring's edge, corners and all: below 0, it
 *  runs into it. */
function padGap(p: BoardPad, a: Point, b: Point, g: Geometry): number {
  return boxDist(a, b, p.x, p.cy, g.inner) - g.round;
}

/** Of `items`, the one nearest `x` (the first of two as near). */
function nearestOf<T>(items: readonly T[], at: (item: T) => number, x: number): T | undefined {
  let best: T | undefined;
  for (const it of items) if (best === undefined || Math.abs(at(it) - x) < Math.abs(at(best) - x)) best = it;
  return best;
}

/** A polyline without its repeated points and without the points in the middle of a run. */
function straighten(pts: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of dedupe(pts)) {
    while (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const cross = (b[0] - a[0]) * (p[1] - b[1]) - (b[1] - a[1]) * (p[0] - b[0]);
      const dot = (b[0] - a[0]) * (p[0] - b[0]) + (b[1] - a[1]) * (p[1] - b[1]);
      if (Math.abs(cross) < 0.01 && dot > 0) out.pop();
      else break;
    }
    out.push(p);
  }
  return out;
}

/**
 * The web of a row of more than one line: the lower lines' routes (added to `routes`, which holds
 * the first line's), every track — the first line's runs, the spokes and the rings — and the vias
 * of the pads it cannot reach.
 */
function webOf(
  width: number,
  lines: readonly BoardPad[][],
  tiers: readonly { cy: number; bus: number }[],
  cx: number,
  chinX: number,
  foot: number,
  routes: Map<string, BoardRoute>,
  g: Geometry,
): { tracks: Point[][]; vias: Point[] } {
  const T = lines.length;
  const b0 = tiers[0].bus;
  const apex = b0 - JOIN;
  /** a first-line pad's or a spoke's x: a pixel's middle — the trunk's, within 1.5px of the chin */
  const sx = (v: number) => (Math.abs(v - chinX) < 1.5 ? cx : snap(v));

  /* ---- the graph: the points where runs meet, and the runs between them ---- */
  const nodes: { x: number; y: number; pad: BoardPad | null }[] = [];
  const ids = new Map<string, number>();
  const key = (x: number, y: number) => `${Math.round(x * 100)} ${Math.round(y * 100)}`;
  const node = (x: number, y: number, pad: BoardPad | null = null) => {
    const k = key(x, y);
    let i = ids.get(k);
    if (i === undefined) {
      i = nodes.length;
      nodes.push({ x, y, pad });
      ids.set(k, i);
    } else if (pad) nodes[i].pad = pad;
    return i;
  };
  const arcs: Arc[] = [];
  const arc = (a: number, b: number, pts: readonly Point[], both = false) => {
    const q = dedupe(pts);
    if (a !== b && q.length > 1) arcs.push({ a, b, pts: q, both });
  };
  /** the middles of ring runs from pad to pad: a track stops there (it never reaches two pads) */
  const cuts = new Set<number>();
  /** the bottoms of the rings' dips */
  const notches: number[] = [];
  const hub = node(cx, apex);

  /* ---- where each band's spokes run (band j: from line j's names down to line j + 1) ---- */
  let pitch = Infinity;
  for (const l of lines)
    for (let i = 1; i < l.length; i++) if (l[i].x - l[i - 1].x >= 2 * g.clear) pitch = Math.min(pitch, l[i].x - l[i - 1].x);
  if (!Number.isFinite(pitch)) pitch = PITCH;
  const cols: number[][] = [];
  /** the first band's spokes: the edges of the names on either side of each (none unmeasured) */
  const sides = new Map<number, [number, number]>();
  for (let j = 0; j + 1 < T; j++) {
    const l = lines[j];
    const below = lines[j + 1].map((p) => snap(p.x));
    /* only over the line below, give or take half a pitch */
    const lo = below[0] - pitch / 2 - g.near;
    const hi = below[below.length - 1] + pitch / 2 + g.near;
    const xs: number[] = [];
    const add = (x: number, names?: [number, number]) => {
      const off = x < EDGE || x > width - EDGE || x < lo - 0.5 || x > hi + 0.5;
      if (off || xs.some((c) => Math.abs(c - x) < 1.01)) return;
      xs.push(x);
      if (!j && names) sides.set(x, names);
    };
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1];
      const b = l[i];
      /* halfway between the two pads: where the spoke runs without names, the same on every page */
      const m = sx((a.x + b.x) / 2);
      if (!a.label || !b.label) {
        /* a name not measured is taken as no wider than its place; one measured beside it still
           keeps the spoke out of it */
        const named = !(a.label && m < a.label.right + MARGIN) && !(b.label && m > b.label.left - MARGIN);
        if (b.x - a.x >= 2 * g.clear && named) add(m);
        continue;
      }
      /* the real gap between the two names, less a margin from either and the pads' clearance,
         over the line below */
      const g0 = a.label.right;
      const g1 = b.label.left;
      const s0 = Math.max(g0 + MARGIN, a.x + g.clear, lo);
      const s1 = Math.min(g1 - MARGIN, b.x - g.clear, hi);
      if (!(g1 - g0 >= GAP && s0 <= s1)) continue;
      const mid = (g0 + g1) / 2;
      /* a line already standing in the gap goes straight on: the trunk, a spoke from the line
         above. When that would pass a pad of the line below too near to hang it, a pad of that line
         standing in the gap takes the spoke instead, over its middle, on a straight neck; with none
         there it still goes straight on, and the pad beside it hangs on its knot's arm. Else over a
         pad of the line below; else halfway between the pads, where it runs on every page, if that
         clears both names by the margin; else down the middle of the gap. */
      const pick = (vs: readonly number[]) => nearestOf(vs.filter((v) => v >= s0 && v <= s1), (v) => v, mid);
      const on = pick(j ? cols[j - 1] : [cx]);
      const over = pick(below);
      const straight = on !== undefined && !below.some((X) => Math.abs(X - on) >= g.near && Math.abs(X - on) < g.clear);
      add((straight ? on : over ?? on) ?? (m >= s0 && m <= s1 ? m : snap(clamp(mid, s0, s1))), [g0, g1]);
    }
    /* and half a pitch past either end, clear of the end names */
    for (const [p, e] of [[l[0], -1], [l[l.length - 1], 1]] as const) {
      const v = p.x + (e * pitch) / 2;
      if (!p.label) add(sx(v));
      else if (e < 0) add(snap(Math.min(v, p.label.left - MARGIN)), [-Infinity, p.label.left]);
      else add(snap(Math.max(v, p.label.right + MARGIN)), [p.label.right, Infinity]);
    }
    cols.push(xs.sort((u, v) => u - v));
  }

  /* ---- the first line: its pads onto the bus, the Y and the trunk; the spokes' heads ---- */
  /** a point on either side of the hub, t px out from the trunk: on the Y's arm, then on the bus */
  const along = (e: number, t: number): Point => [cx + e * t, t < JOIN ? apex + t : b0];
  const joins: Record<number, number[]> = { [-1]: [], [1]: [] };
  /* every pad's stub, from its middle up to where it joins its side of the hub (t along it; none
     for a pad right under the chin, which goes straight up the trunk) */
  const stubs = lines[0].map((p) => {
    const X = sx(p.x);
    const ad = Math.abs(cx - X);
    const s = X < cx ? -1 : 1;
    if (ad < 0.5) return { p, s, t: -1, near: false, pts: [[X, p.cy], [X, apex]] as Point[] };
    /* too near the chin for its bend: up onto the Y's arm, or bent onto its corner — on a row of
       one line its own diagonal would run beside the arm, or across the bus */
    if (ad < BEND + JOIN + 2) {
      const t = Math.min(ad, JOIN);
      const pts: Point[] = ad > JOIN ? [[X, p.cy], [X, b0 + ad - JOIN], along(s, t)] : [[X, p.cy], along(s, t)];
      return { p, s, t, near: true, pts };
    }
    return { p, s, t: ad - BEND, near: false, pts: [[X, p.cy], [X, b0 + BEND], along(s, ad - BEND)] as Point[] };
  });
  /** whether a spoke's drop keeps AIR_PAD off every pad lit, and BEND off every stub */
  const clear = (a: Point, b: Point) =>
    lines[0].every((p) => padGap(p, a, b, g) >= AIR_PAD) &&
    stubs.every(({ pts }) => pts.every((q, i) => i === 0 || apart(a, b, pts[i - 1], q) >= BEND));
  const nearest = [-1, 1].map((e) => nearestOf(cols[0].filter((s) => (s - cx) * e >= 0.5), (s) => s, cx));
  let tops = new Map<number, Top>();
  /** each spoke's head: where on its side of the hub it starts (t), and its way to its knee */
  const heads: { s: number; e: number; t: number; pts: Point[] }[] = [];
  for (const s of cols[0]) {
    const d = Math.abs(s - cx);
    const e = s < cx ? -1 : 1;
    if (d < 0.5) {
      tops.set(s, { n: hub, pts: [[cx, apex]] });
      continue;
    }
    if (d < JOIN) {
      /* right beside the trunk: down from the Y's arm itself */
      heads.push({ s, e, t: d, pts: [[s, apex + d]] });
      continue;
    }
    /* off the bus with a 45° drop; the nearest spoke on either side drops as far as it can, clear
       of the pads: a ray, when the drop meets the Y's arm, or a tent with a flat top where a ray
       would reach into the names. It turns down above them — beside their first line at the
       lowest, when they are measured and the name on the hub's side leaves room */
    let L = Math.min(BEND, d - JOIN);
    if (nearest.includes(s)) {
      const names = sides.get(s);
      const room = names ? (e < 0 ? names[1] - s : s - names[0]) : 0;
      const knee = tiers[0].cy + g.name - NAME_GAP;
      let most = Math.min(d - JOIN, Math.floor(knee + Math.min(room, NAME_GAP) - b0));
      /* rather than a sliver of flat top, the ray turns down a little lower, if it still clears */
      if (d - JOIN - most < 3 && b0 + d - JOIN <= knee + (names ? room : 3)) most = d - JOIN;
      else if (d - JOIN - most < 3) most = d - JOIN - 3; // or a flat top of 3px at least
      for (let l = most; l > L; l--)
        if (clear([s - e * l, b0], [s, b0 + l])) {
          L = l;
          break;
        }
    }
    heads.push({ s, e, t: d - L, pts: [[s - e * L, b0], [s, b0 + L]] });
  }
  for (const { e, t } of heads) joins[e].push(t);
  const trunk: Point[] = [
    [cx, apex],
    [cx, foot],
  ];
  for (const { p, s, t, near, pts } of stubs) {
    const q = pts[pts.length - 1];
    arc(t < 0 ? hub : node(q[0], q[1]), node(pts[0][0], p.cy, p), [...pts].reverse());
    if (t >= 0) joins[s].push(t);
    /* a pad joining the Y's arm has its route along it; the others keep the first line's, run for
       run the same */
    if (near) routes.set(p.id, { legs: [leg(straighten([...pts, ...trunk]))], vias: [] });
  }
  for (const e of [-1, 1]) {
    const ts = joins[e];
    if (!ts.length) continue;
    if (Math.max(...ts) > JOIN) ts.push(JOIN);
    let from = hub;
    let at: Point = [cx, apex];
    for (const t of [...new Set(ts)].sort((u, v) => u - v)) {
      const q = along(e, t);
      const n = node(q[0], q[1]);
      arc(from, n, [at, q]);
      from = n;
      at = q;
    }
  }
  for (const { s, e, t, pts } of heads) {
    const q = along(e, t);
    tops.set(s, { n: node(q[0], q[1]), pts });
  }
  arc(hub, node(cx, foot), trunk);

  /* ---- every lower line: its ring, and where the next band's spokes leave it ---- */
  const lower: { p: BoardPad; n: number; X: number; y: number; bus: number }[] = [];
  for (let t = 1; t < T; t++) {
    const y = snap(tiers[t].cy);
    const here = lines[t].map((p) => {
      const X = snap(p.x);
      const h = { p, X, n: node(X, y, p) };
      lower.push({ ...h, y, bus: tiers[t].bus });
      return h;
    });
    type Here = (typeof here)[number];
    const arriving = cols[t - 1].filter((k) => tops.has(k));
    const leaving = t + 1 < T ? cols[t] : [];
    const level: { x: number; n: number }[] = [];
    const spans: [number, number][] = [];
    const next = new Map<number, Top>();

    /* under each spoke: a pad right under it hangs from its knot; a pad just beside it takes the
       spoke in, bent 45° at its end (no knot there) */
    const knots: { k: number; top: Top; under: Here | null; r: number; left: boolean; right: boolean }[] = [];
    const bent: number[] = [];
    const taken = new Set<Here>();
    for (const k of arriving) {
      const top = tops.get(k) as Top;
      const q = nearestOf(here.filter((h) => !taken.has(h) && Math.abs(h.X - k) < g.near), (h) => h.X, k);
      if (q) taken.add(q);
      if (q && Math.abs(q.X - k) >= 0.5) {
        const d = Math.abs(q.X - k);
        arc(top.n, q.n, [...top.pts, [k, y - d], [q.X, y]]);
        bent.push(k);
      } else knots.push({ k, top, under: q ?? null, r: q ? g.hang : g.sag, left: false, right: false });
    }
    type Knot = (typeof knots)[number];

    /* how high each knot rises: under the names above, never past a pad, clear of the spokes bent
       into their pads... */
    const names = lines[t - 1].flatMap((p) => (p.label ? [p.label] : []));
    for (const n of knots) {
      let r = Math.min(n.r, y - n.top.pts[n.top.pts.length - 1][1] - 2);
      for (const lb of names)
        if (lb.left - 1.5 < n.k + g.sag && lb.right + 1.5 > n.k - g.sag) r = Math.min(r, y - lb.bottom - AIR);
      for (const h of here) if (h !== n.under) r = Math.min(r, Math.abs(h.X - n.k));
      for (const k of bent) r = Math.min(r, Math.abs(k - n.k) - BEND);
      n.r = Math.max(0, Math.floor(r));
    }
    /* ...and a sag that holds nothing keeps a flat bottom: the higher of its two knots gives way
       first. Left to right, each pair once — lowering a knot only ever makes more room. */
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1];
      const b = knots[i];
      const inside = (x: number) => x > a.k + 0.5 && x < b.k - 0.5;
      if (here.some((h) => inside(h.X)) || bent.some(inside)) continue;
      let over = a.r + b.r - (b.k - a.k - BEND);
      if (over <= 0) continue;
      const [hi, lo] = a.r >= b.r ? [a, b] : [b, a];
      const cut = Math.min(over, hi.r - lo.r);
      hi.r -= cut;
      over -= cut;
      hi.r = Math.max(0, hi.r - Math.ceil(over / 2));
      lo.r = Math.max(0, lo.r - Math.floor(over / 2));
    }

    /* where the next band's spokes leave the ring, each once: on down through the knot over it;
       off the arm of a knot that reaches over it (not a knot over a pad: its arms stay short); else
       out of a dip, which the knots beside it lower themselves for — never below an arm a spoke
       already drops off: then there is no room, and that spoke is left out. One pass: no decision
       is made twice. */
    const hung = new Map<number, Knot>();
    const lowest = new Map<Knot, number>();
    const dips: number[] = [];
    const sags: number[] = [];
    for (const a of leaving) {
      if (knots.some((n) => Math.abs(n.k - a) < 0.5)) continue;
      const n = nearestOf(knots.filter((m) => !m.under && Math.abs(a - m.k) <= m.r - 1), (m) => m.k, a);
      if (!n) sags.push(a);
      else {
        hung.set(a, n);
        lowest.set(n, Math.max(lowest.get(n) ?? 0, Math.abs(a - n.k) + 1));
      }
    }
    for (const a of sags) {
      const caps = knots.map((n) => {
        const w = Math.abs(a - n.k);
        return n.r <= w - DIP - BEND ? n.r : Math.max(w - DIP - BEND, lowest.get(n) ?? 0);
      });
      if (knots.some((n, i) => caps[i] > Math.abs(a - n.k) - DIP)) continue;
      knots.forEach((n, i) => (n.r = Math.max(0, caps[i])));
      dips.push(a);
    }
    /* a knot too low for its arms is none: a spoke over a pad goes straight into it, any other
       spoke stops short of the ring (its pads hang on the spokes beside it) */
    for (const n of knots) if (n.r < (n.under ? g.hangMin : lowest.has(n) ? 1 : KNOT_MIN)) n.r = 0;
    const live = knots.filter((n) => n.r > 0 || n.under);
    for (const n of live) {
      const others = [...here.filter((h) => h !== n.under).map((h) => h.X), ...live.map((m) => m.k)];
      others.push(...bent, ...hung.keys(), ...dips);
      n.left = others.some((x) => x < n.k - 0.5);
      n.right = others.some((x) => x > n.k + 0.5);
    }

    for (const n of live) {
      const { k, r } = n;
      const kn = r > 0 ? node(k, y - r) : (n.under as Here).n;
      arc(n.top.n, kn, [...n.top.pts, [k, y - r]]);
      if (r > 0) {
        if (n.under) arc(kn, n.under.n, [[k, y - r], [k, y]]);
        for (const e of [-1, 1]) {
          if (!(e < 0 ? n.left : n.right)) continue;
          const fx = k + e * r;
          const hit = here.find((h) => Math.abs(h.X - fx) < 0.5);
          const fn = hit ? hit.n : node(fx, y);
          /* the arm, cut where a spoke of the next band drops off it */
          let from = kn;
          let at: Point = [k, y - r];
          for (const [a, m] of hung) {
            if (m !== n || (a - k) * e <= 0) continue;
            const q: Point = [a, y - r + Math.abs(a - k)];
            const dn = node(q[0], q[1]);
            arc(from, dn, [at, q]);
            next.set(a, { n: dn, pts: [q] });
            from = dn;
            at = q;
          }
          arc(from, fn, [at, [fx, y]]);
          if (!hit) level.push({ x: fx, n: fn });
        }
        if (n.under || (n.left && n.right)) spans.push([k - r, k + r]);
      }
      for (const a of leaving) if (Math.abs(a - k) < 0.5) next.set(a, { n: kn, pts: [[k, y - r]] });
    }
    for (const h of here) if (!knots.some((n) => n.under === h && n.r > 0)) level.push({ x: h.X, n: h.n });
    for (const a of dips) {
      const bottom = node(a, y + DIP);
      notches.push(bottom);
      for (const e of [-1, 1]) {
        const fn = node(a + e * DIP, y);
        arc(fn, bottom, [[a + e * DIP, y], [a, y + DIP]]);
        level.push({ x: a + e * DIP, n: fn });
      }
      next.set(a, { n: bottom, pts: [[a, y + DIP]] });
    }
    /* the ring: a run between every two of its points side by side, but under a knot (over a dip it
       runs on: a pad beyond it stays on the ring); a run from pad to pad is cut in its middle */
    level.sort((u, v) => u.x - v.x);
    for (let i = 1; i < level.length; i++) {
      const u = level[i - 1];
      const v = level[i];
      if (u.n === v.n || spans.some(([s0, s1]) => u.x > s0 - 0.01 && v.x < s1 + 0.01)) continue;
      if (nodes[u.n].pad && nodes[v.n].pad) {
        const m = (u.x + v.x) / 2;
        const mn = node(m, y);
        cuts.add(mn);
        arc(u.n, mn, [[u.x, y], [m, y]], true);
        arc(mn, v.n, [[m, y], [v.x, y]], true);
      } else arc(u.n, v.n, [[u.x, y], [v.x, y]], true);
    }
    tops = next;
  }

  /* ---- every lower pad's route: the shortest way from the hub to it, read backwards ---- */
  let adj: number[][] = [];
  let dist: number[] = [];
  let prev: number[] = [];
  const reach = () => {
    adj = nodes.map(() => []);
    arcs.forEach((A, i) => {
      adj[A.a].push(i);
      adj[A.b].push(i);
    });
    const lens = arcs.map((A) => leg(A.pts).len);
    dist = nodes.map(() => Infinity);
    prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[hub] = 0;
    for (;;) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      if (nodes[u].pad) continue;
      for (const i of adj[u]) {
        if (arcs[i].a !== u && !arcs[i].both) continue;
        const v = arcs[i].a === u ? arcs[i].b : arcs[i].a;
        if (dist[u] + lens[i] < dist[v] - 1e-6) {
          dist[v] = dist[u] + lens[i];
          prev[v] = i;
        }
      }
    }
  };
  /** a point the hub reaches and a route may go on from (not a pad) */
  const on = (u: number) => dist[u] < Infinity && !nodes[u].pad;
  reach();

  /* ---- a pad the web cannot reach: names close every gap over it, and the pads beside it wall it
     in on the ring. It is bridged over the pad in its way (q), from the web beyond q: a 45° leg
     comes down onto the ring where it is cut between them (at least g.hang past q's middle, so the
     leg keeps AIR_PAD from q's corner), off a run g.hang over q (lower under low names, never under
     g.clear) that goes back to the web, or the leg alone rises on to a spoke. A bridge leaves a run
     that goes on up toward the hub — an arm rising away from it, a bridge at its height, a spoke
     (through a 45° bend when the bridge comes to it level) — never a point where runs already meet,
     so its routes climb all the way, as every route does. It keeps BEND from every other run,
     AIR_PAD from every pad lit and AIR under every measured name; of those that do, the one that
     makes the shortest route.
     One at a time, each reaching one more pad at least: at most one per lower pad. ---- */
  const everyPad = lines.flat();
  /** point `at` of run i as a point of the web: the run cut in two there */
  const cutAt = (i: number, at: Point): number => {
    const A = arcs[i];
    const n = node(at[0], at[1]);
    if (n === A.a || n === A.b) return n;
    let k = 1;
    while (k < A.pts.length - 1 && distTo(at, A.pts[k - 1], A.pts[k]) > 0.01) k++;
    arcs[i] = { a: A.a, b: n, pts: dedupe([...A.pts.slice(0, k), at]), both: A.both };
    arcs.push({ a: n, b: A.b, pts: dedupe([at, ...A.pts.slice(k)]), both: A.both });
    return n;
  };
  /** how far the hub is from point `at` of run i, along it */
  const reachTo = (i: number, at: Point) => {
    const A = arcs[i];
    let len = dist[A.a];
    for (let k = 1; k < A.pts.length; k++) {
      const a = A.pts[k - 1];
      const b = A.pts[k];
      if (distTo(at, a, b) < 0.01) return len + Math.hypot(at[0] - a[0], at[1] - a[1]);
      len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    return Infinity;
  };
  /** the first run that a ray from `o` along `d` meets, past `o` */
  // (the result typed: TypeScript does not follow an assignment made inside the callback)
  const cast = (o: Point, d: Point): { t: number; i: number; k: number } | null => {
    let hit: { t: number; i: number; k: number } | null = null;
    arcs.forEach((A, i) => {
      for (let k = 1; k < A.pts.length; k++) {
        const p = A.pts[k - 1];
        const s: Point = [A.pts[k][0] - p[0], A.pts[k][1] - p[1]];
        const w: Point = [p[0] - o[0], p[1] - o[1]];
        const den = d[0] * s[1] - d[1] * s[0];
        let t: number;
        if (Math.abs(den) < 1e-9) {
          /* along the ray: met at its nearer end */
          if (Math.abs(w[0] * d[1] - w[1] * d[0]) > 0.01) continue;
          const dd = d[0] * d[0] + d[1] * d[1];
          t = Math.min(w[0] * d[0] + w[1] * d[1], (w[0] + s[0]) * d[0] + (w[1] + s[1]) * d[1]) / dd;
        } else {
          const u = (w[0] * d[1] - w[1] * d[0]) / den;
          if (u < -1e-6 || u > 1 + 1e-6) continue;
          t = (w[0] * s[1] - w[1] * s[0]) / den;
        }
        if (t > 0.01 && (!hit || t < hit.t)) hit = { t, i, k };
      }
    });
    return hit;
  };
  /** whether a new run from `u` (which it leaves or lands on) to `v` would lie along run cd */
  const alongside = (u: Point, v: Point, c: Point, d: Point) => {
    const cross = (p: Point) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
    if (Math.abs(cross(c)) > 0.01 || Math.abs(cross(d)) > 0.01) return false;
    const t = (p: Point) => (p[0] - u[0]) * (v[0] - u[0]) + (p[1] - u[1]) * (v[1] - u[1]);
    return Math.max(t(c), t(d)) > 0.01;
  };
  /** whether a bridge keeps clear of every other run, every pad and every measured name (it meets
   *  the run it leaves and the ring it lands on at its ends, at an angle) */
  const free = (path: Point[]) => {
    if (path.some((p) => p[0] < EDGE || p[0] > width - EDGE)) return false;
    const ends = [path[0], path[path.length - 1]];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      if (everyPad.some((p) => padGap(p, a, b, g) < AIR_PAD - 0.5)) return false;
      for (const p of everyPad) {
        const l = p.label;
        if (l && meets(a, b, l.left - MARGIN, p.cy + g.name - AIR, l.right + MARGIN, l.bottom + AIR)) return false;
      }
      for (const A of arcs)
        for (let k = 1; k < A.pts.length; k++) {
          const c = A.pts[k - 1];
          const d = A.pts[k];
          const end = ends.findIndex((q) => distTo(q, c, d) < 0.01);
          if (end >= 0 && (end ? i === path.length - 1 : i === 1)) {
            if (end ? alongside(b, a, c, d) : alongside(a, b, c, d)) return false;
          } else if (i === path.length - 1 && c[1] === ends[1][1] && d[1] === ends[1][1]) continue;
          else if (apart(a, b, c, d) < BEND - 0.01) return false;
        }
    }
    return true;
  };
  type Low = (typeof lower)[number];
  const bridge = (s: Low): boolean => {
    // (s may be a dip standing in for a pad: it is not in `lower`)
    const row = lower.filter((o) => o.y === s.y && o !== s).concat(s).sort((u, v) => u.X - v.X);
    const at = row.indexOf(s);
    let best: { cost: number; i: number; ring: number; path: Point[]; e: number } | null = null;
    for (const e of [-1, 1]) {
      /* e: from the web toward s; q, the pad in its way */
      const q = row[at - e];
      if (!q || !(dist[q.n] < Infinity)) continue;
      const gap = e * (s.X - q.X);
      const F: Point = [gap / 2 >= g.hang ? (q.X + s.X) / 2 : q.X + e * g.hang, s.y];
      if (e * (s.X - F[0]) < (s.p.id ? g.clear : DIP + BEND)) continue;
      /* onto the ring alone: not where a dip or an arm already leaves it */
      const at0 = ids.get(key(F[0], F[1]));
      if (at0 !== undefined && arcs.some((A) => (A.a === at0 || A.b === at0) && !(A.both && A.pts.every((p) => p[1] === F[1])))) continue;
      const ring = arcs.findIndex(
        (A) =>
          A.both &&
          A.pts.every((p) => Math.abs(p[1] - s.y) < 0.01) &&
          Math.min(A.pts[0][0], A.pts[A.pts.length - 1][0]) < F[0] + 0.01 &&
          Math.max(A.pts[0][0], A.pts[A.pts.length - 1][0]) > F[0] - 0.01,
      );
      if (ring < 0) continue;
      /* the leg alone, up to a spoke or a level run; or, from its top at h (the highest that fits:
         as short a route as any lower one), level back to the web */
      const tries: [Point, Point, Point[]][] = [[F, [-e, -1], [F]]];
      for (let h = g.hang; h >= g.clear; h--) tries.push([[F[0] - e * h, s.y - h], [-e, 0], [[F[0] - e * h, s.y - h], F]]);
      let level = false;
      for (const [o, d, rest] of tries) {
        if (level && !d[1]) break;
        /* (a leg alone rises no higher than a bridge's bend would: under the names of the line above,
           measured or not; and it leaves no ring) */
        const hit = cast(o, d);
        if (!hit || (d[1] && hit.t > g.hang + BEND)) continue;
        const A = arcs[hit.i];
        if (A.both || !on(A.a)) continue;
        const J: Point = [o[0] + d[0] * hit.t, o[1] + d[1] * hit.t];
        /* the way on toward the hub along that run: up, away from s */
        const dx = A.pts[hit.k - 1][0] - A.pts[hit.k][0];
        const dy = A.pts[hit.k - 1][1] - A.pts[hit.k][1];
        let head: Point[] = [J];
        if (Math.abs(dx) < 0.01) {
          if (!(dy < 0)) continue;
          if (!d[1]) {
            const top: Point = [J[0], J[1] - BEND];
            if (!A.pts.some((p, j) => j > 0 && distTo(top, A.pts[j - 1], p) < 0.01) || e * (o[0] - J[0]) < BEND - 0.01) continue;
            head = [top, [J[0] + e * BEND, J[1]]];
          }
        } else if (Math.sign(dx) !== -e || dy > 0.01) continue;
        /* no run of it shorter than a bend: a level piece is BEND long or none */
        const path = straighten([...head, ...rest]);
        if (path.some((p, j) => j > 0 && Math.hypot(p[0] - path[j - 1][0], p[1] - path[j - 1][1]) < BEND - 0.01)) continue;
        if (ids.has(key(path[0][0], path[0][1])) || !free(path)) continue;
        const cost = reachTo(hit.i, path[0]) + leg(path).len;
        level = !d[1];
        if (!best || cost < best.cost - 0.01) best = { cost, i: hit.i, ring, path, e };
      }
    }
    if (!best) return false;
    const { i, ring, path, e } = best;
    const foot = cutAt(ring, path[path.length - 1]);
    arc(cutAt(i, path[0]), foot, path);
    /* the ring on q's side of the foot leads into it one way only: a route never comes along it to
       the foot and turns back up the leg */
    arcs.forEach((A, j) => {
      const far = A.a === foot ? A.b : A.a;
      if (!A.both || (A.a !== foot && A.b !== foot) || e * (nodes[far].x - nodes[foot].x) > 0) return;
      arcs[j] = { a: far, b: foot, pts: A.a === far ? A.pts : [...A.pts].reverse(), both: false };
    });
    return true;
  };
  /* in rounds: every pad still walled in tries once, then the routes are found again (a pad
     bridged in one round can be the way in for the next); each round reaches one more pad at least */
  for (let k = 0; k < lower.length; k++) {
    let more = false;
    for (const h of lower) if (!(dist[h.n] < Infinity) && bridge(h)) more = true;
    /* a dip cut off between two pads (long names closing the gap above it) is bridged the same way:
       a pad under it then climbs the web rather than falling back to a via */
    for (const m of notches)
      if (
        !(dist[m] < Infinity) &&
        adj[m].some((i) => arcs[i].a === m) &&
        bridge({ p: { id: "", x: nodes[m].x, cy: nodes[m].y - DIP }, n: m, X: nodes[m].x, y: nodes[m].y - DIP, bus: 0 })
      )
        more = true;
    if (!more) break;
    reach();
  }

  const vias: Point[] = [];
  const leads: Point[][] = [];
  for (const { p, n, X, y, bus } of lower) {
    if (dist[n] < Infinity) {
      const pts: Point[] = [];
      for (let v = n; v !== hub; ) {
        const A = arcs[prev[v]];
        pts.push(...(A.b === v ? [...A.pts].reverse() : A.pts));
        v = A.a === v ? A.b : A.a;
      }
      routes.set(p.id, { legs: [leg(straighten([...pts, ...trunk]))], vias: [] });
      continue;
    }
    /* nowhere on the web to climb: the short lead of before, bent outward into its own via */
    const e = p.x < chinX - 0.5 ? -1 : 1;
    const jx = X + e * BEND;
    const via: Point = [jx + e * LEAD, bus];
    const lead: Point[] = [[X, y], [X, bus + BEND], [jx, bus], via];
    leads.push(lead);
    vias.push(via);
    routes.set(p.id, { legs: [leg(lead), leg(trunk)], vias: [via] });
  }

  /* ---- the tracks: the runs a route could take from the hub (any piece of ring walled in by
     pads, or under an arm no route climbs, would hang in the air) and nothing left dangling — each
     run once, chained through the points where just two meet, each track leaving its pad when it
     has one ---- */
  const other = (i: number, u: number) => (arcs[i].a === u ? arcs[i].b : arcs[i].a);
  const used = arcs.map((A) => !on(A.a) && !(A.both && on(A.b)));
  /* the run between two pads of a sag, when both are on the web; not a dip whose spoke the line
     below did without (its knot had no room) */
  for (const m of cuts)
    if (adj[m].every((i) => dist[other(i, m)] < Infinity)) for (const i of adj[m]) used[i] = false;
  for (const m of notches) if (!adj[m].some((i) => arcs[i].a === m)) for (const i of adj[m]) used[i] = true;
  const deg = nodes.map(() => 0);
  arcs.forEach((A, i) => {
    if (used[i]) return;
    deg[A.a] += 1;
    deg[A.b] += 1;
  });
  const chinFoot = node(cx, foot);
  const loose = (u: number) => deg[u] === 1 && !nodes[u].pad && u !== chinFoot;
  const ends = nodes.map((_, i) => i).filter(loose);
  while (ends.length) {
    const u = ends.pop() as number;
    const i = adj[u].find((j) => !used[j]);
    if (i === undefined || !loose(u)) continue;
    used[i] = true;
    deg[u] -= 1;
    const v = other(i, u);
    deg[v] -= 1;
    if (loose(v)) ends.push(v);
  }
  const through = (v: number) => !nodes[v].pad && !cuts.has(v) && deg[v] === 2;
  const tracks: Point[][] = [];
  const chain = (from: number, first: number) => {
    let pts: Point[] = [];
    let at = from;
    for (let i: number | undefined = first; i !== undefined; ) {
      used[i] = true;
      const A: Arc = arcs[i];
      const q = A.a === at ? A.pts : [...A.pts].reverse();
      pts = pts.concat(pts.length ? q.slice(1) : q);
      at = A.a === at ? A.b : A.a;
      i = through(at) ? adj[at].find((j) => !used[j]) : undefined;
    }
    tracks.push(straighten(pts));
  };
  const order = nodes.map((_, i) => i).sort((u, v) => Number(!nodes[u].pad) - Number(!nodes[v].pad));
  for (const u of order) if (!through(u)) for (const i of adj[u]) if (!used[i]) chain(u, i);
  arcs.forEach((A, i) => {
    if (!used[i]) chain(A.a, i);
  });
  return { tracks: [...tracks, ...leads], vias };
}
