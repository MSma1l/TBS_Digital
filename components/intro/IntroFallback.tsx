import type { CSSProperties, ReactNode } from "react";
import styles from "./IntroPreloader.module.css";

/**
 * The intro's drawing, and on the no-WebGL path — the one CI actually exercises — the whole
 * film.
 *
 * It OPENS INSIDE THE MACHINE, in the processor's slot. `--fb-p` 0 is the die, close and
 * asleep, and it is no longer a chip on black: the deck's two side walls close in at x ±176,
 * the socket kerb and the machine's recession close the top of frame, the FLOOR runs across
 * the bottom from the walls' feet at y 44 out to the deck's near lip at y 98, and the
 * heatpipe and two capacitor studs stand in the troughs either side of the package. Those are
 * the 3D's own pieces in the 3D's own places (`three/laptop.ts` GUTS.rim / .pipe / .cap /
 * .kerb), so a visitor who sees both renderers is looking at one machine.
 *
 * THE CAVITY NEVER DISSOLVES. `<Cavity />` is one table drawn by BOTH interior layers, and
 * .fbBoard wears it at a flat scale(0.3061) = 60/196 — the same ratio that derives the board's
 * opening 2.96 — so its total is 2.96 × 0.3061 = 0.9061 against the die's own 0.9072 on the
 * frame the dissolve opens. The two copies are the same drawing at the same size: over
 * 0.26 → 0.42 only the CHIP cross-fades, the machine around it just keeps receding. That is
 * what stops 0.42 → 0.60 being a board on a void.
 *
 * From 0.26 the guts become legible at a glance — fan, heatpipe, fin stack, two sticks of
 * memory, storage, battery, the vent the POWER leaves through — each lighting as the board's
 * own zoom brings it inside the frame (`.fbPart`, `--a`, derived below). The CAMERA leaves
 * somewhere else: it rises out through the KEYBOARD, the way `three/cameraPath.ts` does at
 * u 0.602, through the bay between the key rows over the processor. The lid is already open
 * when it surfaces (lidOpenAt [0.40, 0.60]) because a shut lid lies flat on the deck and a
 * closed laptop has no way out of the top.
 *
 * Server-rendered and moving before hydration, this is what every visitor sees first. It
 * carries beats 1-3 on EVERY device (.canvasHost is at opacity 0 while `--fb-p` runs
 * 0 → 0.60), and all six where the scene can't run.
 *
 * ONE scrub channel — the director writes `--fb-p` on [data-part="fallback"] once a frame and
 * every part cuts its own window out of it in CSS (see the module). Repetition is <pattern>,
 * <symbol>+<use> or a loop over a table, never a <path> per piece: those compress where
 * distinct geometry does not, and one <pattern> is 2 nodes for 45 key caps, 200 BGA balls or
 * 12 functional blocks.
 *
 * No hooks, no randomness, fixed ids: server and client markup are byte-identical, and
 * `coord()` rounds so `-0` never prints.
 *
 * Four layers, in paint order: halo (blurred INSIDE the SVG, never a CSS filter), machine,
 * board (beat 3), die (beats 1-2) on top, so the die dissolves away to reveal the board
 * under it.
 *
 * FIRST PAINT IS THE DIE ALONE, AND IT IS COUNTED THE ONLY WAY THAT DECIDES LCP: every
 * element that generates a box, PLUS the subtree each <use> materialises. On that metric the
 * cavity's first cut cost 34 boxes + 63 <use> instances = 97, against the 54 the halo and
 * machine used to lay out — 80% more work on the weakest devices, on the layer that paints
 * before the <h1> below it becomes the LCP element. It is 20 + 20 = 40 now — the arrival's head
 * is one more <use> of a single <path>, counted on the live tree — and nothing was
 * given up: the 12 blocks are one <pattern>-filled rect instead of 12 <use> of a two-rect
 * <symbol> (1 against 48), both walls are three <path>s of two and four subpaths instead of
 * two <use> of a four-node <g> (3 against 10), and every .fbFace surface in the shot — two
 * wall faces, the kerb, the near lip, two capacitor studs — is ONE <path> of six subpaths
 * (1 against 5). Nothing here is a filter, an animation or a gradient. The other three layers
 * are `display: none` until [data-live], i.e. after LCP. None of them can be wanted before
 * that: `--fb-p` only moves when JS moves it, and the earliest of the three opens at 0.26.
 */

/* Unchanged from the ∞: .flash, .shock and the stage centring are all derived from it. */
const VIEWBOX = "-240 -150 480 300";
const SVG = { viewBox: VIEWBOX, focusable: "false", "aria-hidden": true } as const;

/* Cabinet-oblique projection: the x/y plane is true scale (112 viewBox units per machine
   unit), depth recedes up-right by (36, -30) per unit. Three planes carry the whole drawing,
   each one `transform="matrix(...)"` group, so every piece inside is a plain axis-aligned
   <rect>/<circle> — which is what makes the tables below possible. Deck 2.40 × 1.70 × 0.12,
   lid 2.40 × 1.55, screen 2.28 × 1.425 (16:10, models/laptop.ts); the lid's axis at 107°
   projects to (0.105, -1.159) per centi-unit. On screen: x -173 → 173.3, y -156.6 → 94, i.e.
   346.3 × 250.6 of the viewBox, centred, the hinge line 31 units above the middle. */
type Mat = readonly [number, number, number, number, number, number];
type Pt = readonly [number, number];
const DECK: Mat = [1.12, 0, 0.36, -0.3, -173, 74];
const SIDE: Mat = [0.36, -0.3, 0, 1, 95.8, 74];
const LID: Mat = [1.12, 0, 0.105, -1.159, -111.8, 23];
const D = 13.5;

const coord = (value: number) => String(Math.round(value * 100) / 100);
const at = (m: Mat, x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mat = (m: Mat) => `matrix(${m.map(coord).join(" ")})`;
const path = (pts: readonly Pt[], close = true) =>
  `M${pts.map(([x, y]) => `${coord(x)} ${coord(y)}`).join("L")}${close ? "Z" : ""}`;
/** One axis-aligned rectangle as a SUBPATH. Several that share a dress become one <path>, and
    a <path> of n subpaths is one render object where n <rect>s are n — which is the whole
    first-paint budget below. Winding is uniform, so an outer box plus an inner one is a hole
    under fill-rule="evenodd" and a pair of panels under the default. */
const box = (x: number, y: number, w: number, h: number) =>
  `M${coord(x)} ${coord(y)}H${coord(x + w)}V${coord(y + h)}H${coord(x)}Z`;
const drop = ([x, y]: Pt): Pt => [x, y + D];
const cssVar = (name: string, value: number) => ({ [name]: value }) as CSSProperties;

/** One rectangle: class (0 = the layer's own dress), x, y, w, h, rx, fill. */
type R = readonly [string | 0, number, number, number, number, number?, string?];
const rects = (list: readonly R[]) =>
  list.map(([c, x, y, w, h, rx, fill], i) => (
    <rect key={i} className={c || undefined} x={x} y={y} width={w} height={h} rx={rx} fill={fill} />
  ));

/* The halo blurs five outlines: deck top, body, hinge, lid, screen. */
const SILHOUETTE = [
  path([at(DECK, 0, 0), at(DECK, 240, 0), at(DECK, 240, 170), at(DECK, 0, 170)]),
  path(
    [at(DECK, 0, 0), at(DECK, 240, 0), at(DECK, 240, 170)].concat(
      [at(DECK, 240, 170), at(DECK, 240, 0), at(DECK, 0, 0)].map(drop),
    ),
  ),
  path([at(LID, 0, 0), at(LID, 240, 0), at(LID, 240, 8), at(LID, 0, 8)]),
  path([at(LID, 0, 0), at(LID, 240, 0), at(LID, 240, 155), at(LID, 0, 155)]),
  path([at(LID, 6, 7.5), at(LID, 234, 7.5), at(LID, 234, 150), at(LID, 6, 150)]),
];

const HALO_BLURS = [
  { id: "tbs-intro-halo-blur-wide", deviation: 8, className: styles.fbHaloWide },
  { id: "tbs-intro-halo-blur-narrow", deviation: 16, className: styles.fbHaloNarrow },
] as const;
/* 3σ past the widest stroke, so the glow is never clipped to a box. */
const HALO_REGION = { x: -270, y: -200, width: 540, height: 400 } as const;

/* Traces off a rectangular part: out along the normal, a 45° jog, then straight to the rim.
   One function, four sides, two layers — the die's 14 and the board's 16 are each ONE <path> of
   that many subpaths, and one dashoffset draws every run at once, each from its own first
   point: the current spreading, one element, one write. (It does NOT light them in series. The
   dash pattern restarts at every subpath — measured; see the long note above `.fbTrace` in
   IntroPreloader.module.css — which is why the dash is cut to the length of a single run.) */
const SIDES = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
] as const;

/** The runs as POINT LISTS rather than path data, so the same fourteen conductors can also be
    emitted end-to-end — see `backwards` below. */
function fan(side: number, offsets: readonly number[], edge: number, rim: number, run: number): Pt[][] {
  const [ux, uy, nx, ny] = SIDES[side];
  const p = (u: number, n: number): Pt => [ux * u + nx * n, uy * u + ny * n];
  const mid = (offsets.length - 1) / 2;
  return offsets.map((t, i) => {
    const jog = (i - mid) * 9;
    const out = run + i * 5;
    return [p(t, edge), p(t, edge + out), p(t + jog, edge + out + Math.abs(jog)), p(t + jog, rim)];
  });
}

const runs = (list: readonly Pt[][]) => list.map((pts) => path(pts, false)).join("");

/**
 * THE SAME CONDUCTORS, WALKED THE OTHER WAY, and it exists for a measured reason rather than a
 * tidy one. A dash pattern RESTARTS at every subpath — measured, see the long note above
 * `.fbTrace` in IntroPreloader.module.css — so an offset can only ever draw a run from its own
 * FIRST point outward. There is no offset that makes these fourteen fill from the package rim
 * toward the silicon. Reversing the point order is the whole mechanism: same ink, same dash
 * rule, opposite direction.
 */
const backwards = (list: readonly Pt[][]) => runs([...list].reverse().map((pts) => [...pts].reverse()));

/* ---- the die (beats 1-2) ---------------------------------------------------------------- */

const ROWS = [-66, -22, 22, 66];
/*
 * 14 runs off the silicon onto the package: 4 a side, 3 top, 3 bottom — SIDES[1] is [0,1,1,0],
 * i.e. p(u,n) = [n,u], so `fan(1, ROWS, …)` lays its four runs along +x, not the top. Each run
 * is written from the silicon outward — p(t, edge) first, p(t + jog, rim) last — and that
 * per-run direction, not the order of the runs, is what every reveal below is written against.
 *
 * THEY USED TO BE STUBS. The side fans ran 62 → 98 and never left the silicon at all: 36 units
 * of travel, on a drawing 480 across. The top and bottom ran 98 → 152, and their tips start
 * above the frame. Average run 48.2 units; the arrival and the departure had almost nothing to
 * cross.
 *
 * They are now 104.6 on average — 117% more ink — and the extra length was taken in the one
 * direction that has room. The frame is 480 × 300, so there is nothing to gain by pushing the
 * top and bottom tips further UP: at the opening scale the visible half-height is 134 units and
 * a longer tip is simply drawn where nobody can see it. So those six runs were extended INWARD
 * instead, from the package edge (98) down to 62 — the silicon's own half-height, the same
 * relationship the side fans already had — which buys 36 units each and moves the tip not one
 * unit. The side fans go the other way, 62 → 152, out to the package edge.
 *
 * Every rim is a real edge and every one clears what is drawn there: 152 is the package plate's
 * own boundary, 2 units short of the heat capsule at x 154 and 4 short of the capacitor studs at
 * x -156. Measured: 93% of the ink is inside the frame on the poster frame, against 83% before,
 * and all of it by --fb-p 0.20. Edge 42 on the side fans, not lower: at 32 their first leg would
 * cross the top and bottom fans' own x = ±32 verticals.
 */
const DIE_RUNS = [
  ...fan(1, ROWS, 42, 152, 12),
  ...fan(3, ROWS, 42, 152, 12),
  ...fan(0, [-32, 0, 32], 62, 152, 14),
  ...fan(2, [-32, 0, 32], 62, 152, 14),
];
/** Act 3 walks these outward, act 1 walks the same ink inward. */
const DIE_TRACES = runs(DIE_RUNS);
const DIE_TRACES_IN = backwards(DIE_RUNS);
/**
 * 12 functional blocks, 4 × 3, on the left two thirds of the silicon — ONE <pattern>-filled
 * rect, where they used to be 12 `<use>` of a two-rect `<symbol>`. That is 1 render object
 * against 48 (12 boxes + 12 × 3 materialised nodes), and it is the single biggest item in the
 * first-paint budget at the top of this file.
 *
 * It is exact, not approximate: the grid pitch was already 31.5 × 39 and the block 27.5 × 34,
 * so a 31.5 × 39 tile anchored on the first block's own corner (-92, -56) repeats 4 × 3 times
 * inside a 122 × 112 rect — 4 × 31.5 = 126 > 122, but the fourth column's block ends at
 * -92 + 3 × 31.5 + 27.5 = 30 = -92 + 122 exactly, and the third row's at
 * -56 + 2 × 39 + 34 = 56 = -56 + 112. No tile is clipped through a block.
 */
const BLOCK_FIELD = { x: -92, y: -56, w: 122, h: 112, tw: 31.5, th: 39 } as const;
/** 4 cores, 2 × 2, on the right third; they light in sequence as the power arrives. */
const CORES = [0, 1].flatMap((c) => [0, 1].map((r) => ({ x: 40 + c * 28, y: -56 + r * 58, i: c * 2 + r })));

const DIE_PARTS: R[] = [
  [0, -140, -86, 280, 172, 0, "url(#tbs-intro-bga)"],
  [styles.fbSilicon, -98, -62, 196, 124],
  [0, -98, -62, 196, 124, 0, "url(#tbs-intro-metal)"],
];

/* ---- the cavity BOTH interior beats are shot inside -------------------------------------- */

/*
 * A processor alone on black is a picture OF a chip. This is the machine around it, and it is
 * the reason the opening scale came down from 1.4 to 1.12: the frame the die gets is
 * x ±(240 / --s) and y (98 - 243.75 / --s) upward, because `--over` hoists the carrier's
 * bottom edge onto the HUD's band. At 1.4 that window was ±171 × (-76 → 138) — the carrier's
 * own top edge sat OFF the top of frame, so there was nowhere to put a ceiling and only 19
 * units of margin at the sides. At 1.12 it is ±214 × (-120 → 148): 62 units of room either
 * side of the carrier and 22 above it, and the carrier still draws 340 × 220 of the 480 × 300
 * viewBox — 72% of the frame each way, which is the processor filling it.
 *
 * THE FLOOR, AND WHY IT SITS WHERE IT DOES. The first cut had a ceiling and two walls and
 * nothing under the chip, so the shot was framed on three sides — a chip on a shelf, not a
 * camera in a machine. The walls now STOP at y 44 and a ribbed floor runs from there to the
 * deck's near lip at y 98, full width: outboard of the 304-wide carrier that is two 112 × 54
 * wings, of which 62 × 54 each is inside the opening frame — the surface the package is
 * standing on, meeting the walls at a seam the eye can find.
 *
 * NOTHING REACHES BELOW y 98, and that is arithmetic rather than taste. `--over` pins the
 * LOWEST DRAWN EDGE to screen y 93.75, the line `--hud-top` reserves the readout's band on;
 * put the floor at y F and the lift becomes F·--s - 93.75, so at the opening 1.12 an F of 148
 * (the frame's own bottom) would lift 72.4 instead of 16.01 and drag the carrier's top edge to
 * -182 — 32 units off the top of a frame that only reaches -150, with the kerb and the whole
 * recession above it gone with it. Keeping F at 98 keeps the ceiling. What is left below
 * screen 93.75 is not void the drawing could have filled: it is the HUD's own band, 40px of
 * clearance and then the readout, and the floor's lip is the shelf it sits on.
 */
const RIB = (id: string) => `url(#${id})`;
/**
 * The cavity, as ONE table drawn by both interior layers (see the header). Six render objects:
 *
 *   recession   the machine receding up-frame behind the carrier, dimmer because it is further
 *   floor       the surface the package stands on, brighter because it is nearer
 *   flank       both ribbed side walls, ONE <path> of two subpaths — out to x ±264, which is
 *               240 / 0.91, i.e. still covering the frame edge at the scale the die has
 *               reached when the board takes the shot over
 *   seam        the four hairlines down the flanks, ONE <path> of four subpaths
 *   face        EVERY lit surface in the shot, ONE <path> of six subpaths: the two walls' inner
 *               faces, the socket kerb (316 wide — the 3D's GUTS.kerb 0.312), the deck's near
 *               lip under the carrier, and the two capacitor studs (GUTS.cap) in the -x trough
 *   heat        the heatpipe leaving the die up the +x trough for the fin stack (GUTS.pipe),
 *               276 long so that it stands ON the floor rather than stopping in mid-air
 *
 * They were 16 before: three cavity rects, three trough rects, and two <use> of a four-node
 * <g> for the walls.
 */
const CAVITY_FLANK = `${box(-264, -232, 80, 276)}${box(184, -232, 80, 276)}`;
const CAVITY_SEAM = "M-240 -232V44M-206 -232V44M206 -232V44M240 -232V44";
const CAVITY_FACE = [
  box(-184, -232, 8, 276),
  box(176, -232, 8, 276),
  box(-158, -110, 316, 12),
  box(-264, 86, 528, 12),
  box(-174, -42, 18, 20),
  box(-174, 2, 18, 20),
].join("");

/** `rib` is the layer's own tile id: a paint server belongs to the <svg> that defines it, and
    the die and the board are two <svg>s, so each defines the same 11-unit pattern under its
    own id and the geometry above stays a single table. */
function Cavity({ rib }: { rib: string }) {
  return (
    <>
      <rect className={styles.fbDeep} x={-180} y={-232} width={360} height={122} fill={RIB(rib)} />
      <rect className={styles.fbFloor} x={-264} y={44} width={528} height={54} fill={RIB(rib)} />
      <path d={CAVITY_FLANK} fill={RIB(rib)} />
      <path d={CAVITY_SEAM} className={styles.fbFaint} />
      <path d={CAVITY_FACE} className={styles.fbFace} />
      <rect className={styles.fbHeat} x={154} y={-232} width={18} height={276} rx={9} />
    </>
  );
}

/** The chassis's milled ribs. 11 units is ~10 CSS px at the opening scale on a phone in
    portrait (--intro-w 78vw ≈ 304px, so 0.811 px per viewBox unit): coarse enough to read as
    machined metal, cheap enough that the tile is still cheap when the walls are 80 × 276 of
    them. */
function RibTile({ id }: { id: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="11" height="11">
      <path d="M0 5.5H11" className={styles.fbFaint} />
    </pattern>
  );
}

/* ---- the board (beat 3): the machine's guts ---------------------------------------------- */

/** 16 copper runs off the package (46 × 36) to the board's rim (196 × 118). */
const BOARD_TRACES = runs([
  ...fan(0, [-24, -8, 8, 24], 46, 196, 16),
  ...fan(2, [-24, -8, 8, 24], 46, 196, 16),
  ...fan(1, [-30, -10, 10, 30], 36, 118, 14),
  ...fan(3, [-30, -10, 10, 30], 36, 118, 14),
]);

/*
 * The board used to be copper and four rectangles wearing the same fin pattern — a heatsink, a
 * "vent", a slot and a battery that were all the same object. Nothing in it said laptop. It is
 * now `three/laptop.ts`'s own bank layout: the heat path and the memory outboard of it on +x,
 * the fan on -x, the vent at the back in the gap between them, the battery across the front.
 * Silhouette first — a circle with blades is the most recognisable object in any laptop —
 * detail second, and each piece lights as the frame opens onto it (`.fbPart`, `--a`, below).
 */
const FIN = "url(#tbs-intro-fin)";
/** Everything the wave has already passed before beat 3 starts. */
const BOARD_BASE: R[] = [
  [styles.fbPlate, -196, -118, 392, 236, 5],
  [0, -184, -106, 368, 212, 0, "url(#tbs-intro-via)"],
];
/** The package we have just come off. Its silicon is 60 wide against the die layer's 196, and
    that ratio — 3.27 — is where `.fbBoard`'s opening 2.96 comes from: it is the scale at which
    the two drawings of the same chip are the same size on the frame the dissolve starts. */
const PKG: R[] = [
  [0, -46, -36, 92, 72, 2],
  [styles.fbSilicon, -30, -22, 60, 44],
];
const FAN = { x: -120, y: -46, r: 48, hub: 15 } as const;
/** Nine blades, ONE <path> of nine subpaths off a loop: a quadratic from the hub out to the
    rim, swept 35° back, which is what makes a circle read as a rotor and not as a hole. */
const BLADES = Array.from({ length: 9 }, (_, i) => {
  const a = (i * 40 * Math.PI) / 180;
  const p = (r: number, t: number): Pt => [FAN.x + r * Math.cos(t), FAN.y + r * Math.sin(t)];
  const [sx, sy] = p(FAN.hub + 1, a);
  const [cx, cy] = p(31, a + 0.34);
  const [ex, ey] = p(FAN.r - 4, a + 0.62);
  return `M${coord(sx)} ${coord(sy)}Q${coord(cx)} ${coord(cy)} ${coord(ex)} ${coord(ey)}`;
}).join("");
const FAN_CASE: R[] = [[styles.fbPlate, -178, -104, 116, 116, 14]];
/** The pipe from the package's +x edge to the fin stack, and the fins hard against the back
    wall where it ends — the same run the 3D's light takes before it reaches the vent. */
const PIPE = "M46 -14H126L148 -74";
const FINS: R[] = [
  [styles.fbPlate, 118, -108, 74, 58, 2],
  [0, 122, -104, 66, 50, 0, FIN],
];
/** One stick of memory — board, contacts, key notch — drawn once and `<use>`d twice. */
const DIMM: R[] = [
  [styles.fbPlate, 0, 0, 124, 20, 2],
  [0, 6, 13, 112, 6, 0, FIN],
];
const STORE: R[] = [
  [styles.fbPlate, 60, 62, 124, 36, 2],
  [styles.fbFaint, 64, 70, 14, 20, 1],
];
const BATTERY: R[] = [[styles.fbPlate, -188, 44, 152, 66, 4]];
/** Where the POWER goes, and the last thing to light: a real hole in the back wall, between
    the fan's case and the fin stack. The 3D's `VENT` carries `aU` 1 for the same reason. It is
    no longer where the CAMERA goes — that is the keyboard bay below. */
const VENT: R[] = [
  [styles.fbPlate, -50, -116, 96, 22, 2],
  [0, -46, -113, 88, 16, 0, FIN],
];
const CAPS: readonly Pt[] = [
  [-72, -60],
  [-72, 40],
  [52, -60],
  [52, 40],
];

/*
 * WHEN A PIECE LIGHTS, DERIVED FROM WHEN IT IS ON SCREEN.
 *
 * The wave used to run 0.26 → 0.598 on eight ranks 0.034 apart, and most of it happened to
 * pieces the viewer could not see: .fbBoard is still zoomed past the frame for the first two
 * thirds of that. A piece at half-brightness that nobody has been shown is not a wave, it is a
 * fade that finishes off-camera.
 *
 * `--a` is the frame's own answer. .fbBoard scales about 50% 50%, so at scale S the viewBox
 * shows x ±240/S and y ±150/S, and a piece whose bounding box reaches max|x| and max|y| is
 * WHOLLY inside the frame from S = min(240/max|x|, 150/max|y|) downwards. Inverting the scale
 * curve at that S gives the --fb-p it arrives on:
 *
 *   piece     max|x|  max|y|   240/|x|  150/|y|   S fit   p fit   --a     full at
 *   caps        72      60      3.333    2.500    2.500   0.396   0.396   0.476
 *   heatpipe   155.5    81.5    1.543    1.840    1.543   0.545   0.545   0.625
 *   memory     184      52      1.304    2.885    1.304   0.583   0.583   0.663
 *   storage    184      98      1.304    1.531    1.304   0.583   0.591   0.671
 *   battery    188     110      1.277    1.364    1.277   0.587   0.599   0.679
 *   fan        178     104      1.348    1.442    1.348   0.576   0.607   0.687
 *   fins       192     108      1.250    1.389    1.250   0.592   0.615   0.695
 *   vent        50     116      4.800    1.293    1.293   0.585   0.623   0.703
 *
 * Two things the table shows and one it settles. The board is wider than it is tall against a
 * 16:10 frame (392/480 = 0.817 against 236/300 = 0.787), so every outboard bank clears the
 * side of the frame LAST and six of the eight arrive inside one hundredth of the scrub of each
 * other — the geometry, not the timing, is what compresses them. And `--a` is therefore the
 * fit time with a 0.008 floor between ranks IN THE 3D'S OWN WAVE ORDER (studs, heatpipe,
 * memory, storage, battery, fan, fins, vent — `laptop.ts` `buildTraces`), which is the one
 * freedom left: it can never light a piece BEFORE it is in frame, it keeps the vent last the
 * way the 3D does, and it spends the six-way tie as a wave instead of a switch. Ramps are 0.08,
 * the floor under which a ramp on a scrub quantised to 1/200 reads as a cut.
 *
 * 0.28 is the unlit level: a piece is always THERE, it just isn't carrying yet, which is what
 * makes the board read as a machine from the frame it appears on rather than assembling itself
 * out of black.
 */
const part = (a: number, extra?: string) => ({
  className: extra ? `${styles.fbPart} ${extra}` : styles.fbPart,
  style: cssVar("--a", a),
});
const Piece = ({ a, dress, children }: { a: number; dress?: string; children: ReactNode }) => (
  <g {...part(a, dress)}>{children}</g>
);

/* ---- the way out: up through the keyboard ------------------------------------------------ */

/*
 * `three/cameraPath.ts` does not leave through the vent any more. It crawls the corridor past
 * the guts, the lid opens ABOVE it while it is still inside (`lidOpenAt` [0.40, 0.60] — a shut
 * lid lies flat 0.02 over the deck and a closed laptop has no way out of the top), and at
 * u 0.602 it rises through HATCH, a 0.34 × 0.09 aperture in the deck's TOP surface in the
 * clear strip between the key rows, surfacing into a machine that is already open with its
 * display two thirds drawn (`screenFillAt` [0.46, 0.68]).
 *
 * The drawing tells it the same way round. From 0.58 the interior SINKS (`--rise` on .fbBoard:
 * the camera goes up, so the machine goes down) while the deck's underside comes at us — one
 * group, growing on `--hz` about the frame's centre, its bay opening until it is wider than the
 * frame and we are through it. Then .fbMachine forms at 0.66, LID ALREADY OPEN, with the bay
 * still visible in the keyboard as the hole we came out of.
 *
 * The aperture is 240 × 70, i.e. 3.43:1 against the 3D's 0.34/0.09 = 3.78:1, in a 560 × 380
 * plate. Both numbers are sized off `--hz`, NOT chosen: the plate has to cover the 480 × 300
 * frame on the frame the group is at full strength (`--rz` 1/3, `--hz` 0.947 → 530 × 360,
 * just over), and the bay has to be wider than the frame by the time the group is spent
 * (`--hz` 2.0 → 480 × 140). Bigger plate, and the tail of the ramp paints several viewports of
 * tinted rect for nothing — on a phone in portrait the stage is already a viewport wide, so
 * 800 × 520 at `--hz` 3.4 was washing the whole screen through the board's own opacity.
 * `fill-rule` evenodd over two same-wound subpaths makes the bay a real hole in it.
 */
const BAY = { w: 240, h: 70 } as const;
const UNDER_PLATE = `${box(-280, -190, 560, 380)}${box(-BAY.w / 2, -BAY.h / 2, BAY.w, BAY.h)}`;
/** The two blocks of keys the bay lies between, seen from underneath. */
const UNDER_KEYS = `${box(-270, -170, 540, 125)}${box(-270, 45, 540, 125)}`;
/** Three bars across it, the 3D's `HATCH_SLATS`. */
const UNDER_SLATS = "M-60 -35V35M0 -35V35M60 -35V35";
/*
 * And the same bay in the deck, seen from above, once we are out. Deck-local, so y grows
 * towards the hinge: the key field's 20-unit pattern puts caps at y 73.6, 93.6, 113.6, 133.6
 * and the fn row at 154, and the 3D's HATCH at z -0.44 lands on deck-local y 131 — between the
 * middle and back rows, as its comment says. 112 → 134 takes the whole 113.6 → 130.4 row and
 * both its gutters, so the bay is two missing keys wide and one deep rather than a rectangle
 * sawn across four caps, and x 90 → 130 takes the two caps over the processor.
 *
 * No slats on THIS one. The deck plane foreshortens y by 0.3, so 22 deck units is 6.6 viewBox
 * units — about 5 CSS px on a phone in portrait — and three bars across it would be 1.3px
 * apart. A dark slot with a lit edge is what a bay in a keyboard looks like at that size.
 */
const DECK_BAY = { x: 90, y: 112, width: 40, height: 22, rx: 1.5 } as const;

/* ---- the machine ----------------------------------------------------------------------- */

const BODY: R[] = [
  [styles.fbBody, -173, 74, 268.8, D],
  [0, -158, 87.5, 22, 6.5, 2],
  [0, 60, 87.5, 22, 6.5, 2],
];
const FLANK: R[] = [
  [styles.fbBody, 0, 0, 170, D],
  [0, 28, 3.6, 24, 6.4, 1.6],
  [0, 62, 3.6, 15, 6.4, 1.6],
  [0, 86, 3.6, 28, 6.4, 1.6],
];
/** Plate, key field, fn row (the same field, clipped short), space bar, the caret that
    walks the keys, trackpad, two grilles. */
const KEYS = "url(#tbs-intro-keys)";
const DECK_PARTS: R[] = [
  [styles.fbPlate, 0, 0, 240, 170, 4],
  [0, 30, 72, 180, 80, 0, KEYS],
  [0, 30, 154, 180, 11, 0, KEYS],
  [styles.fbFaint, 76, 52, 88, 14, 2.4],
  [styles.fbCaret, 31.6, 73.6, 16.8, 16.8, 2.4],
  [0, 78, 10, 84, 34, 2],
  [styles.fbFaint, 82, 13, 76, 28, 1.5],
  [0, 8, 72, 14, 80, 0, "url(#tbs-intro-mesh)"],
  [0, 218, 72, 14, 80, 0, "url(#tbs-intro-mesh)"],
];
/** On screen the hinge is a plain barrel: the back edge is level. */
const HINGE: R[] = [
  [styles.fbPlate, -108, 18.4, 261, 9.2, 4.6],
  [styles.fbPlate, -113, 16.6, 11, 12.8, 3.2],
  [styles.fbPlate, 152, 16.6, 11, 12.8, 3.2],
];
const LID_PARTS: R[] = [
  [styles.fbBody, 0, 0, 240, 155, 4],
  [styles.fbScreen, 6, 7.5, 228, 142.5, 1],
  [styles.fbScreenGlow, 6, 7.5, 228, 142.5, 1],
];
const LOGS = [84, 62, 96, 48, 74, 58];
const BRACKETS = [0, 90, 180, 270].map((a, i) => ({ a, x: i === 1 || i === 2 ? 212 : 12, y: i < 2 ? 134 : 10 }));

function EdgeGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="-170" y1="-40" x2="170" y2="40">
      <stop offset="0" className={styles.stopRedLift} />
      <stop offset="0.3" className={styles.stopRed} />
      <stop offset="0.55" className={styles.stopCyan} />
      <stop offset="1" className={styles.stopBlue} />
    </linearGradient>
  );
}

function Halo() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbHalo}`} {...SVG}>
      <defs>
        <EdgeGradient id="tbs-intro-halo" />
        {HALO_BLURS.map(({ id, deviation }) => (
          <filter key={id} id={id} filterUnits="userSpaceOnUse" {...HALO_REGION}>
            <feGaussianBlur stdDeviation={deviation} />
          </filter>
        ))}
        <g id="tbs-intro-shape" stroke="url(#tbs-intro-halo)" strokeWidth={11} strokeLinejoin="round">
          {SILHOUETTE.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </defs>
      {HALO_BLURS.map(({ id, className }) => (
        <use key={id} className={className} href="#tbs-intro-shape" filter={`url(#${id})`} />
      ))}
    </svg>
  );
}

/** Beats 4-6 — the machine the camera has just surfaced into, from 0.66: lid ALREADY open
    (`--lid` is spent by 0.60), the bay it came up through still in the keyboard, and the
    screen drawing itself on. Parsed on first paint, laid out only after [data-live]. */
function Machine() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbMachine}`} {...SVG}>
      <defs>
        <EdgeGradient id="tbs-intro-edge" />
        <pattern id="tbs-intro-keys" patternUnits="userSpaceOnUse" width="20" height="20" x="30" y="72">
          <rect x="1.6" y="1.6" width="16.8" height="16.8" rx="2.4" className={styles.fbFaint} />
        </pattern>
        <pattern id="tbs-intro-mesh" patternUnits="userSpaceOnUse" width="6" height="6">
          <path d="M0 3H6" className={styles.fbFaint} />
        </pattern>
        <symbol id="tbs-intro-bracket" viewBox="0 0 12 12">
          <path d="M0 12V0H12" stroke="currentColor" strokeWidth="1.4" />
        </symbol>
      </defs>
      {rects(BODY)}
      <g transform={mat(SIDE)}>{rects(FLANK)}</g>
      <g transform={mat(DECK)}>
        {rects(DECK_PARTS)}
        {/* The hole the camera came out of, still in the keyboard: void-filled, so it reads as
            a way down into the machine rather than as a lighter key. */}
        <rect {...DECK_BAY} className={styles.fbBay} />
        <path d="M6 4H234" className={styles.fbPulse} stroke="url(#tbs-intro-edge)" pathLength={1000} />
        <circle cx="20" cy="6" r="2.4" className={styles.fbLed} />
      </g>
      {rects(HINGE)}
      {/* The lid's swing is done in its OWN plane, because a hinge rotation under a sheared
          projection is not a rotation in screen space: the axis at θ is α·(1.12, 0) +
          β·(0.105, -1.159) with β = sin(θ - 15°), α ≈ -0.3105·cos(θ - 15°), so scaleY(sin ψ)
          foreshortens and skewX(atan α) recedes. .fbSwing composes inside this matrix. */}
      <g transform={mat(LID)}>
        <g className={styles.fbSwing}>
          {rects(LID_PARTS)}
          <rect x="4" y="5" width="232" height="145" rx="2" className={styles.fbCore} stroke="url(#tbs-intro-edge)" />
          <g className={styles.fbWake}>
            <rect x="10" y="40" width="220" height="9" className={styles.fbScan} />
            {LOGS.map((w, i) => (
              <rect key={w} x="20" y={120 - i * 11} width={w} height="4" className={styles.fbLog} style={cssVar("--i", i)} />
            ))}
            <rect x="20" y="26" width="200" height="3" className={styles.fbTrack} />
            <rect x="20" y="26" width="200" height="3" className={styles.fbFill} />
          </g>
          {BRACKETS.map(({ x, y, a }) => (
            <use key={a} href="#tbs-intro-bracket" x={x} y={y} width="14" height="14"
              className={styles.fbBracket} transform={`rotate(${a} ${x + 7} ${y + 7})`} />
          ))}
          <rect x="4" y="5" width="232" height="145" rx="2" className={styles.fbGlass} />
          <path d="M18 142L62 26" className={styles.fbSheen} />
          <circle cx="120" cy="152.4" r="1.8" className={styles.fbFaint} />
          <rect x="6" y="7.5" width="228" height="142.5" rx="1" className={styles.fbRim} pathLength={1000} />
        </g>
      </g>
    </svg>
  );
}

/** Beat 3 — the guts, the light running out of the package through them to the vent, the
    cavity still around all of it, and the rise out through the keyboard at the end of it.
    Parsed on first paint, laid out only after [data-live]. */
function Board() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbBoard}`} {...SVG}>
      <defs>
        <EdgeGradient id="tbs-intro-bd" />
        <pattern id="tbs-intro-via" patternUnits="userSpaceOnUse" width="22" height="22">
          <circle cx="11" cy="11" r="2.2" className={styles.fbFaint} />
        </pattern>
        {/* One tile of parallel hairlines, worn by everything that is a stack of thin metal:
            the fin block, the vent's slats, the memory's contacts. */}
        <pattern id="tbs-intro-fin" patternUnits="userSpaceOnUse" width="9" height="9">
          <path d="M0 0V9" className={styles.fbFaint} />
        </pattern>
        <symbol id="tbs-intro-cap" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5.4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1" />
        </symbol>
        <g id="tbs-intro-dimm">
          {rects(DIMM)}
          <path d="M44 0V20" className={styles.fbFaint} />
        </g>
        <RibTile id="tbs-intro-rib-bd" />
        {/* The keys either side of the bay, seen from underneath: 30-unit pitch against the
            deck's 20, because at `--hz` 1 we are half a frame under them. */}
        <pattern id="tbs-intro-underkeys" patternUnits="userSpaceOnUse" width="30" height="30">
          <rect x="2" y="2" width="26" height="26" rx="3.5" className={styles.fbFaint} />
        </pattern>
        {/* Drawn once, worn three ways: glow, core, running pulse. */}
        <path id="tbs-intro-bt" d={BOARD_TRACES} pathLength={1000} />
      </defs>
      {rects(BOARD_BASE)}
      {/* THE SAME CAVITY THE DIE IS SHOT IN, at the same size on the frame the dissolve opens:
          60/196 is the package ratio .fbBoard's 2.96 is derived from, so 2.96 × 0.3061 = 0.9061
          against the die's own --s of 0.9072 at 0.26. Nothing about the machine cross-fades —
          only the chip inside it does — and the walls, ceiling and floor go on receding on the
          board's own curve right through 0.42 → 0.60, which is the stretch that used to be a
          PCB on black. Drawn here, before the traces, because the guts stand in front of it. */}
      <g className={styles.fbCavity} transform="scale(0.3061)">
        <Cavity rib="tbs-intro-rib-bd" />
      </g>
      <use href="#tbs-intro-bt" className={styles.fbTraceGlow} stroke="url(#tbs-intro-bd)" />
      <use href="#tbs-intro-bt" className={styles.fbTrace} />
      <use href="#tbs-intro-bt" className={styles.fbPulse} stroke="url(#tbs-intro-bd)" />
      {rects(PKG)}
      <Piece a={0.38} dress={styles.fbFaint}>
        {CAPS.map(([x, y]) => (
          <use key={`${x} ${y}`} href="#tbs-intro-cap" x={x} y={y} width="20" height="20" />
        ))}
      </Piece>
      <Piece a={0.548}>
        <path d={PIPE} className={styles.fbPipe} />
        <path d={PIPE} className={styles.fbSheen} />
      </Piece>
      <Piece a={0.589}>
        <use href="#tbs-intro-dimm" x="60" y="6" />
        <use href="#tbs-intro-dimm" x="60" y="32" />
      </Piece>
      <Piece a={0.597}>{rects(STORE)}</Piece>
      <Piece a={0.605}>
        {rects(BATTERY)}
        <path d="M-138 44V110M-88 44V110" className={styles.fbFaint} />
      </Piece>
      <Piece a={0.613}>
        {rects(FAN_CASE)}
        <circle cx={FAN.x} cy={FAN.y} r={FAN.r} className={styles.fbFaint} />
        <path d={BLADES} className={styles.fbFaint} />
        <circle cx={FAN.x} cy={FAN.y} r={FAN.hub} className={styles.fbSilicon} />
      </Piece>
      <Piece a={0.621}>{rects(FINS)}</Piece>
      <Piece a={0.629}>{rects(VENT)}</Piece>
      {/* The exit, painted last because it is the nearest thing in the shot: the deck's
          underside coming at the camera, its bay opening until it is wider than the frame. */}
      <g className={styles.fbHatch}>
        <path d={UNDER_PLATE} fillRule="evenodd" className={styles.fbUnder} />
        <path d={UNDER_KEYS} fill="url(#tbs-intro-underkeys)" />
        <path d={UNDER_SLATS} className={styles.fbFaint} />
        <rect x={-BAY.w / 2} y={-BAY.h / 2} width={BAY.w} height={BAY.h} className={styles.fbBayRim} />
      </g>
    </svg>
  );
}

/** Beats 1-2 — the camera is inside the processor's slot, on the die. The only layer laid out
    at first paint, and therefore the one that has to hold a still frame for the 7s the no-JS
    failsafe runs: at `--fb-p` 0 the package fills the frame inside its cavity, the ring is
    open, the traces are undrawn and the cores are on their floor, with the standby comet the
    only motion. */
function Die() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbDie}`} {...SVG}>
      <defs>
        <EdgeGradient id="tbs-intro-die" />
        <pattern id="tbs-intro-bga" patternUnits="userSpaceOnUse" width="19" height="19">
          <circle cx="9.5" cy="9.5" r="3.4" className={styles.fbFaint} />
        </pattern>
        <pattern id="tbs-intro-metal" patternUnits="userSpaceOnUse" width="14" height="14">
          <path d="M0 0H14M0 0V14" className={styles.fbFaint} />
        </pattern>
        <RibTile id="tbs-intro-rib" />
        {/* The 12 blocks as ONE tile: see BLOCK_FIELD. The dress is on the <g> inside the
            pattern, so each rect's own stroke-width attribute still outranks .fbFaint's. */}
        <pattern
          id="tbs-intro-blk"
          patternUnits="userSpaceOnUse"
          width={BLOCK_FIELD.tw}
          height={BLOCK_FIELD.th}
          x={BLOCK_FIELD.x}
          y={BLOCK_FIELD.y}
        >
          <g className={styles.fbFaint}>
            <rect x="0.69" y="0.7" width="26.12" height="32.6" strokeWidth="1.1" />
            <rect x="3.93" y="4" width="19.64" height="26" strokeWidth="0.7" />
          </g>
        </pattern>
        <symbol id="tbs-intro-core" viewBox="0 0 24 54">
          <rect x="1" y="1" width="22" height="52" stroke="currentColor" strokeWidth="1.3" />
          <rect x="5" y="5" width="14" height="44" fill="currentColor" fillOpacity="0.18" stroke="none" />
          <path d="M12 5V49M5 27H19" stroke="currentColor" strokeWidth="0.8" />
        </symbol>
        <path id="tbs-intro-dt" d={DIE_TRACES} pathLength={1000} />
        <path id="tbs-intro-di" d={DIE_TRACES_IN} pathLength={1000} />
      </defs>
      <Cavity rib="tbs-intro-rib" />
      <path d="M-152 -98H130L152 -76V98H-152Z" className={styles.fbPlate} />
      {rects(DIE_PARTS.slice(0, 1))}
      {/* ACT 1 — THE ARRIVAL. The under-glow fills in BEHIND a single bright head running the
          fourteen conductors rim → silicon, and is left standing across all of them when it
          lands. It rides #tbs-intro-di — the same ink written end-to-end — so a FRONT that
          grows inward is the plain outward dash rule the rest of this file already uses. */}
      <use href="#tbs-intro-di" className={styles.fbTraceGlow} stroke="url(#tbs-intro-die)" />
      {/* The head keeps the forward path: a BAND does not need the geometry reversed, only an
          offset that falls instead of rises, and on #tbs-intro-dt a falling offset walks it rim
          → silicon. It lands on the silicon and is absorbed by the ignition rather than
          switched off.
          NOT stroke="url(#tbs-intro-die)": that gradient is red-lift at x -170 running to blue
          at x +170, so a gradient-stroked head would be at its COLDEST on the frames it reaches
          the die and lights it. The one thing this act has to sell is the arrival, so the head
          carries its own flat colour and the gradient is left to the things it belongs to. */}
      <use href="#tbs-intro-dt" className={styles.fbArrive} />
      <use href="#tbs-intro-dt" className={styles.fbTrace} />
      <use href="#tbs-intro-dt" className={styles.fbPulse} stroke="url(#tbs-intro-die)" />
      {rects(DIE_PARTS.slice(1))}
      {/* stroke="none" because this rect is a CARRIER, not a part: the layer's own 1.1 hairline
          would draw a 122 × 112 box round the whole block field that the 12 <use> never had. */}
      <rect
        x={BLOCK_FIELD.x}
        y={BLOCK_FIELD.y}
        width={BLOCK_FIELD.w}
        height={BLOCK_FIELD.h}
        fill="url(#tbs-intro-blk)"
        stroke="none"
      />
      {/* SCENE 2 — THE UNCORE. A SECOND painting of the same tile, wiped in left to right on
          --blk, so the grid BRIGHTENS rather than a second drawing arriving: two paintings of a
          0.22 dress composite to 1 - (1 - 0.22)^2 = 0.392.
          It has to be a copy and not a re-dress — a <pattern>'s content inherits from the
          <defs> it lives in, not from the rect that references it, so a stroke-opacity here
          would do nothing at all.
          clip-path and never a transform: the tile is patternUnits="userSpaceOnUse", so scaling
          the rect drags the tiling across the geometry and the blocks smear. The inset is in
          percent so it self-derives if BLOCK_FIELD ever moves. */}
      <rect
        x={BLOCK_FIELD.x}
        y={BLOCK_FIELD.y}
        width={BLOCK_FIELD.w}
        height={BLOCK_FIELD.h}
        fill="url(#tbs-intro-blk)"
        stroke="none"
        className={styles.fbBlkWipe}
      />
      {CORES.map(({ x, y, i }) => (
        <use key={i} href="#tbs-intro-core" x={x} y={y} width="24" height="54"
          className={styles.fbCpu} style={cssVar("--i", i)} />
      ))}
      <circle r="128" className={styles.fbRing} stroke="url(#tbs-intro-die)" pathLength={1000} />
    </svg>
  );
}

/**
 * THE SPLASH — the frame the silicon catches.
 *
 * Its own layer, and that is the whole reason it can exist. First paint is the die layer alone,
 * counted in render objects, and nothing may be added to it cheaply; but the overlay already
 * gates every other layer behind [data-live], i.e. after LCP, and this one joins that list. It
 * costs nothing on the frame a visitor stares at while the page loads, and it is never wanted
 * there: it opens at --fb-p 0.16.
 *
 * It sits ABOVE the die, so the light is over the chip rather than under it, and it is drawn in
 * the frame's own coordinates rather than the chip's. That is not a shortcut — the die is pulling
 * BACK across this window, and a wave that expanded with the chip would be a decal stuck to it.
 * Expanding in the room while the chip recedes is what a wave leaving a thing looks like.
 *
 * Three rings, born 0.03 of scrub apart: one front, one fat soft copy of it a beat behind (this
 * file's only way to bloom, since there are no filters here), and a thin late one that is the
 * wave's own echo. r = 100 is a round number to scale FROM; the radii it crosses on the way out
 * are all real edges of the drawing — 62 the silicon, 98 its x-edge and the side conductors'
 * start, 128 the power ring, 152 the conductor rim and the package boundary, 184 the canyon
 * wall's lit face, and out.
 */
function Splash() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbSplash}`} {...SVG}>
      <circle r="100" className={styles.fbBurstGlow} style={cssVar("--b", 1)} />
      <circle r="100" className={styles.fbBurst} style={cssVar("--b", 0)} />
      <circle r="100" className={styles.fbBurst} style={cssVar("--b", 2)} />
    </svg>
  );
}

export function IntroFallback() {
  return (
    <div className={styles.fbStage}>
      <div className={styles.fbTilt}>
        <Halo />
        <Machine />
        <Board />
        <Die />
        <Splash />
      </div>
    </div>
  );
}
