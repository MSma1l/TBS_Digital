import type { CSSProperties } from "react";
import styles from "./IntroPreloader.module.css";

/**
 * The machine without WebGL: a 16:10 laptop, lid at 107° (LID_ANGLE.open = 1.87 rad, the
 * angle the 3D scene opens to, so both renderers read as one object), three quarters from the
 * upper left. Server-rendered and moving before hydration, it is what every visitor sees
 * first, and it carries beats 1 and 2 of the six-beat film on EVERY device: .canvasHost sits
 * at opacity 0 while `--fb-p` runs 0 → 0.60. Where the scene can't run it carries all six.
 *
 * ONE scrub channel — the director writes `--fb-p` on [data-part="fallback"] once a frame and
 * every part cuts its own window out of it in CSS (see the module). Repetition is <pattern>,
 * <symbol>+<use> or a loop over a table, never a <path> per piece: those compress where
 * distinct geometry does not, and one <pattern> is 2 nodes for 45 key caps or 200 BGA balls.
 *
 * No hooks, no randomness, fixed ids: server and client markup are byte-identical, and
 * `coord()` rounds so `-0` never prints.
 *
 * Four layers: halo (blurred INSIDE the SVG, never a CSS filter), machine, board (beat 3),
 * die (beats 1-2). The last two are `display: none` until [data-live], keeping first paint at
 * 76 nodes — as many as the ∞ had — so the <h1> below stays the LCP element.
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
   One function, four sides, two layers — the die's 14 and the board's 16 are each ONE <path>
   of that many subpaths, and dashing runs on across subpaths, so one dashoffset lights them
   IN ORDER: the current spreading, one element, one write. */
const SIDES = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
] as const;

function fan(side: number, offsets: readonly number[], edge: number, rim: number, run: number): string[] {
  const [ux, uy, nx, ny] = SIDES[side];
  const p = (u: number, n: number): Pt => [ux * u + nx * n, uy * u + ny * n];
  const mid = (offsets.length - 1) / 2;
  return offsets.map((t, i) => {
    const jog = (i - mid) * 9;
    const out = run + i * 5;
    return path([p(t, edge), p(t, edge + out), p(t + jog, edge + out + Math.abs(jog)), p(t + jog, rim)], false);
  });
}

/* ---- the die (beats 1-2) and the board (beat 3) ---------------------------------------- */

const ROWS = [-66, -22, 22, 66];
/** 14 runs off the silicon (98 × 62) onto the package: 4 top, 4 bottom, 3 a side. */
const DIE_TRACES = [
  ...fan(1, ROWS, 62, 98, 12),
  ...fan(3, ROWS, 62, 98, 12),
  ...fan(0, [-32, 0, 32], 98, 152, 14),
  ...fan(2, [-32, 0, 32], 98, 152, 14),
].join("");
/** 16 copper runs off the package (46 × 36) to the board's rim (196 × 118). */
const BOARD_TRACES = [
  ...fan(0, [-24, -8, 8, 24], 46, 196, 16),
  ...fan(2, [-24, -8, 8, 24], 46, 196, 16),
  ...fan(1, [-30, -10, 10, 30], 36, 118, 14),
  ...fan(3, [-30, -10, 10, 30], 36, 118, 14),
].join("");

/** 12 functional blocks, 4 × 3, on the left two thirds of the silicon. */
const BLOCKS = [0, 1, 2, 3].flatMap((c) => [0, 1, 2].map((r) => ({ x: -92 + c * 31.5, y: -56 + r * 39 })));
/** 4 cores, 2 × 2, on the right third; they light in sequence as the power arrives. */
const CORES = [0, 1].flatMap((c) => [0, 1].map((r) => ({ x: 40 + c * 28, y: -56 + r * 58, i: c * 2 + r })));
const CAPS = [-150, -120, -90, 100, 130, 160].map((x, i) => ({ x, y: i < 3 ? 60 : -80 }));

const DIE_PARTS: R[] = [
  [0, -140, -86, 280, 172, 0, "url(#tbs-intro-bga)"],
  [styles.fbSilicon, -98, -62, 196, 124],
  [0, -98, -62, 196, 124, 0, "url(#tbs-intro-metal)"],
];
/** Board, vias, package, heatsink, the vent the film hands over at, slot, battery, coils;
    then four of them filled with fins, and the silicon on top. */
const BOARD_PARTS: R[] = [
  [styles.fbPlate, -196, -118, 392, 236, 5],
  [0, -184, -106, 368, 212, 0, "url(#tbs-intro-via)"],
  [0, -46, -36, 92, 72, 2],
  [0, 120, -104, 63, 54],
  [0, -184, -104, 54, 72],
  [0, -120, 62, 184, 16, 2],
  [0, 92, 34, 96, 72, 3],
  [0, -70, -104, 34, 22, 2],
  [0, -28, -104, 34, 22, 2],
  [0, 120, -104, 63, 54, 0, "url(#tbs-intro-fin)"],
  [0, -184, -104, 54, 72, 0, "url(#tbs-intro-fin)"],
  [0, -116, 66, 176, 8, 0, "url(#tbs-intro-fin)"],
  [0, 96, 38, 88, 64, 0, "url(#tbs-intro-fin)"],
  [styles.fbSilicon, -30, -22, 60, 44],
];

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

/** Beat 3 — the chassis. Parsed on first paint, laid out only after [data-live]. */
function Board() {
  return (
    <svg className={`${styles.fbSvg} ${styles.fbBoard}`} {...SVG}>
      <defs>
        <EdgeGradient id="tbs-intro-bd" />
        <pattern id="tbs-intro-via" patternUnits="userSpaceOnUse" width="22" height="22">
          <circle cx="11" cy="11" r="2.2" className={styles.fbFaint} />
        </pattern>
        <pattern id="tbs-intro-fin" patternUnits="userSpaceOnUse" width="9" height="9">
          <path d="M0 0V9" className={styles.fbFaint} />
        </pattern>
        <symbol id="tbs-intro-cap" viewBox="0 0 12 12">
          <circle cx="6" cy="6" r="5.4" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1" />
        </symbol>
        {/* Drawn once, worn three ways: glow, core, running pulse. */}
        <path id="tbs-intro-bt" d={BOARD_TRACES} pathLength={1000} />
      </defs>
      {rects(BOARD_PARTS.slice(0, 2))}
      <use href="#tbs-intro-bt" className={styles.fbTraceGlow} stroke="url(#tbs-intro-bd)" />
      <use href="#tbs-intro-bt" className={styles.fbTrace} />
      <use href="#tbs-intro-bt" className={styles.fbPulse} stroke="url(#tbs-intro-bd)" />
      {rects(BOARD_PARTS.slice(2))}
      <path d="M40 -8H96L118 -44H170" className={styles.fbSheen} />
      <g className={styles.fbFaint}>
        {CAPS.map(({ x, y }) => (
          <use key={x} href="#tbs-intro-cap" x={x} y={y} width="26" height="26" />
        ))}
      </g>
    </svg>
  );
}

/** Beats 1-2 — the camera is inside the processor, on the die. */
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
        <symbol id="tbs-intro-blk" viewBox="0 0 28 34">
          <rect x="0.7" y="0.7" width="26.6" height="32.6" stroke="currentColor" strokeWidth="1.1" />
          <rect x="4" y="4" width="20" height="26" stroke="currentColor" strokeWidth="0.7" />
        </symbol>
        <symbol id="tbs-intro-core" viewBox="0 0 24 54">
          <rect x="1" y="1" width="22" height="52" stroke="currentColor" strokeWidth="1.3" />
          <rect x="5" y="5" width="14" height="44" fill="currentColor" fillOpacity="0.18" stroke="none" />
          <path d="M12 5V49M5 27H19" stroke="currentColor" strokeWidth="0.8" />
        </symbol>
        <path id="tbs-intro-dt" d={DIE_TRACES} pathLength={1000} />
      </defs>
      <path d="M-152 -98H130L152 -76V98H-152Z" className={styles.fbPlate} />
      {rects(DIE_PARTS.slice(0, 1))}
      <use href="#tbs-intro-dt" className={styles.fbTraceGlow} stroke="url(#tbs-intro-die)" />
      <use href="#tbs-intro-dt" className={styles.fbTrace} />
      <use href="#tbs-intro-dt" className={styles.fbPulse} stroke="url(#tbs-intro-die)" />
      {rects(DIE_PARTS.slice(1))}
      <g className={styles.fbFaint}>
        {BLOCKS.map(({ x, y }) => (
          <use key={`${x} ${y}`} href="#tbs-intro-blk" x={x} y={y} width="27.5" height="34" />
        ))}
      </g>
      {CORES.map(({ x, y, i }) => (
        <use key={i} href="#tbs-intro-core" x={x} y={y} width="24" height="54"
          className={styles.fbCpu} style={cssVar("--i", i)} />
      ))}
      <circle r="128" className={styles.fbRing} stroke="url(#tbs-intro-die)" pathLength={1000} />
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
      </div>
    </div>
  );
}
