import { LEMNISCATE_PATH, lemniscatePoint } from "./lemniscate";
import styles from "./IntroPreloader.module.css";

/**
 * The ∞ without WebGL: glass tube, neon rims, a charge line, two comets and three orbits of
 * particles — all SVG strokes animated by CSS only.
 *
 * It is what every visitor sees first (it is server-rendered and moves before hydration),
 * and it stays for good wherever the 3D scene can't or shouldn't run: no WebGL2, a software
 * renderer, Save-Data, a scene that throws or loses its context. So it has to hold up on its
 * own, not look like a placeholder.
 *
 * No hooks, no randomness, fixed ids (there is only ever one overlay): the markup is
 * identical on the server and the client.
 *
 * Three stacked <svg> layers, split by how often they repaint:
 *  · halo — blurred inside the SVG (never a CSS filter), rasterised once, never repaints;
 *  · body — the static glass (body, sheen, rims, the front strand at the crossing);
 *  · fx   — everything that moves (orbit dots, comets, the charge line the director fills).
 */

/* LEMNISCATE_PATH is lemniscatePath(128, 100): the curve in scene units × 100. */
const SCALE = 100;
/* Room around the ∞ (x ±160, y ±57) for the orbits. */
const VIEWBOX = "-240 -150 480 300";
const BOX = { x: -240, y: -150, width: 480, height: 300 } as const;

/*
 * The halo's blur, in viewBox units (it scales with the ∞). Two strengths, one displayed at
 * a time by the module CSS: the wide ∞ of a desktop needs ~8 units for the soft 16px glow,
 * a small one on a phone ~16. The region reaches 3σ past the 34-wide stroke (x ±177,
 * y ±74) at the stronger blur, so the glow is never clipped to a box.
 */
const HALO_BLURS = [
  { id: "tbs-intro-halo-blur-wide", deviation: 8, className: styles.fbHaloWide },
  { id: "tbs-intro-halo-blur-narrow", deviation: 16, className: styles.fbHaloNarrow },
] as const;
const HALO_FILTER_REGION = { x: -260, y: -170, width: 520, height: 340 } as const;

/* Tube geometry in viewBox units: the rims are the ring between the two widths. */
const TUBE = 22;
const TUBE_INNER = 18.4;

const coord = (value: number) => String(Math.round(value * 100) / 100);

/** An open piece of the curve between `from` and `to` (0–1 of the loop), same projection as the path. */
function segmentPath(from: number, to: number, samples: number): string {
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const [x, y] = lemniscatePoint(from + ((to - from) * i) / samples);
    points.push(`${coord(x * SCALE)} ${coord(-y * SCALE)}`);
  }
  return `M${points.join("L")}`;
}

/*
 * The strands cross at the centre twice: at u = 0.25 the curve is in front (z = +depth), at
 * u = 0.75 behind. A flat SVG would merge them into an X, so the whole ∞ is drawn with its
 * rims and core line CUT where the front strand passes (both strands lose them there), and
 * the front strand's stretch is drawn again on top — the back strand now visibly runs
 * underneath, seen through the glass. Cut and redraw are the same stretch, so their edges
 * coincide; the cut ends never reach the back strand (the curve crosses itself at 90°, so
 * 0.045 of the loop either side is ~24 units from it, the tube is 22 wide).
 */
const FRONT_CROSSING = segmentPath(0.205, 0.295, 12);

/* Dot patterns for the orbits: zero-length dashes with round caps are dots. Each pattern
   sums to the ellipse's pathLength (1000), so the dash animation loops without a seam. */
const ORBITS = [
  {
    className: styles.fbOrbitA,
    rotate: -9,
    rx: 214,
    ry: 66,
    dots: "0 58 0 97 0 31 0 124 0 76 0 143 0 45 0 88 0 61 0 110 0 39 0 128",
    satellites: "0 500",
  },
  {
    className: styles.fbOrbitB,
    rotate: 15,
    rx: 190,
    ry: 94,
    dots: "0 83 0 41 0 137 0 66 0 102 0 29 0 154 0 71 0 118 0 49 0 150",
    satellites: "0 1000",
  },
  {
    className: styles.fbOrbitC,
    rotate: -27,
    rx: 138,
    ry: 42,
    dots: "0 47 0 112 0 69 0 158 0 34 0 96 0 141 0 53 0 120 0 170",
    satellites: "0 500",
  },
] as const;

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

type TubeProps = {
  id: string;
  d: string;
  cap: "round" | "butt";
  /** A stretch to leave out of the rims, streak and core line (where another strand passes over). */
  cut?: string;
};

function TubeMasks({ id, d, cap, cut }: TubeProps) {
  const stroke = { fill: "none", strokeLinejoin: "round", strokeLinecap: cap } as const;
  const hole = cut ? (
    <path d={cut} fill="none" stroke="black" strokeWidth={TUBE + 1} strokeLinecap="butt" />
  ) : null;
  return (
    <>
      {/* The two rims: the tube's outline minus its inside. */}
      <mask id={`${id}-rim`} maskUnits="userSpaceOnUse" {...BOX}>
        <path d={d} stroke="white" strokeWidth={TUBE} {...stroke} />
        <path d={d} stroke="black" strokeWidth={TUBE_INNER} {...stroke} />
        {hole}
      </mask>
      {/* The inside of the tube, to keep the specular streak within the glass. */}
      <mask id={`${id}-in`} maskUnits="userSpaceOnUse" {...BOX}>
        <path d={d} stroke="white" strokeWidth={TUBE_INNER} {...stroke} />
        {hole}
      </mask>
      {cut ? (
        <mask id={`${id}-core`} maskUnits="userSpaceOnUse" {...BOX}>
          <rect {...BOX} fill="white" />
          {hole}
        </mask>
      ) : null}
    </>
  );
}

/** Glass body + streak + rims + idle core line for one path (the whole ∞, or the front crossing). */
function Tube({
  id,
  d,
  cut,
  edge,
  body = true,
}: Omit<TubeProps, "cap"> & {
  edge: string;
  /** false: the glass body underneath is already drawn. */
  body?: boolean;
}) {
  return (
    <>
      {body ? <path d={d} className={styles.fbGlass} strokeWidth={TUBE} /> : null}
      <g mask={`url(#${id}-in)`}>
        <path d={d} className={styles.fbSheen} strokeWidth={2.6} transform="translate(-2.4 -4.6)" />
      </g>
      <rect {...BOX} fill={`url(#${edge})`} mask={`url(#${id}-rim)`} />
      <path
        d={d}
        className={styles.fbCore}
        stroke={`url(#${edge})`}
        strokeWidth={1.4}
        mask={cut ? `url(#${id}-core)` : undefined}
      />
    </>
  );
}

export function IntroFallback() {
  return (
    <div className={styles.fbStage}>
      <div className={styles.fbTilt}>
        <svg
          className={`${styles.fbSvg} ${styles.fbHalo}`}
          viewBox={VIEWBOX}
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <EdgeGradient id="tbs-intro-halo" />
            {HALO_BLURS.map(({ id, deviation }) => (
              <filter key={id} id={id} filterUnits="userSpaceOnUse" {...HALO_FILTER_REGION}>
                <feGaussianBlur stdDeviation={deviation} />
              </filter>
            ))}
          </defs>
          {HALO_BLURS.map(({ id, className }) => (
            <path
              key={id}
              className={className}
              d={LEMNISCATE_PATH}
              fill="none"
              stroke="url(#tbs-intro-halo)"
              strokeWidth={34}
              strokeLinejoin="round"
              filter={`url(#${id})`}
            />
          ))}
        </svg>

        <svg
          className={`${styles.fbSvg} ${styles.fbBody}`}
          viewBox={VIEWBOX}
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <EdgeGradient id="tbs-intro-edge" />
            <TubeMasks id="tbs-intro-tube" d={LEMNISCATE_PATH} cap="round" cut={FRONT_CROSSING} />
            <TubeMasks id="tbs-intro-front" d={FRONT_CROSSING} cap="butt" />
          </defs>
          <Tube id="tbs-intro-tube" d={LEMNISCATE_PATH} cut={FRONT_CROSSING} edge="tbs-intro-edge" />
          <Tube id="tbs-intro-front" d={FRONT_CROSSING} edge="tbs-intro-edge" body={false} />
        </svg>

        <svg
          className={styles.fbSvg}
          viewBox={VIEWBOX}
          focusable="false"
          aria-hidden="true"
        >
          <defs>
            <EdgeGradient id="tbs-intro-fx" />
          </defs>

          {ORBITS.map((orbit) => (
            <g key={orbit.rotate} className={orbit.className} transform={`rotate(${orbit.rotate})`}>
              <ellipse rx={orbit.rx} ry={orbit.ry} className={styles.fbRing} strokeWidth={0.8} />
              <ellipse
                rx={orbit.rx}
                ry={orbit.ry}
                pathLength={1000}
                className={styles.fbDots}
                strokeDasharray={orbit.dots}
              />
              <ellipse
                rx={orbit.rx}
                ry={orbit.ry}
                pathLength={1000}
                className={styles.fbSat}
                strokeDasharray={orbit.satellites}
              />
              <ellipse
                rx={orbit.rx}
                ry={orbit.ry}
                pathLength={1000}
                className={styles.fbSatCore}
                strokeDasharray={orbit.satellites}
              />
            </g>
          ))}

          {/* Filled by the director as the counter runs (stroke-dashoffset 1000 → 0). */}
          <path
            d={LEMNISCATE_PATH}
            pathLength={1000}
            className={styles.fbChargeGlow}
            stroke="url(#tbs-intro-fx)"
            data-part="charge"
          />
          <path d={LEMNISCATE_PATH} pathLength={1000} className={styles.fbCharge} data-part="charge" />

          {[styles.fbComet, `${styles.fbComet} ${styles.fbCometB}`].map((comet) => (
            <g key={comet}>
              <path
                d={LEMNISCATE_PATH}
                pathLength={1000}
                className={`${comet} ${styles.fbTrail}`}
                stroke="url(#tbs-intro-fx)"
              />
              <path
                d={LEMNISCATE_PATH}
                pathLength={1000}
                className={`${comet} ${styles.fbMid}`}
                stroke="url(#tbs-intro-fx)"
              />
              <path d={LEMNISCATE_PATH} pathLength={1000} className={`${comet} ${styles.fbHead}`} />
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
