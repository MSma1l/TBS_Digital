import type { CSSProperties } from "react";
import s from "./BootCore.module.css";

/**
 * The loading screen's object: the site's own processor, in exploded view, turning.
 *
 * Not a generic spinner and not an invented shape — it is `CHIP` from
 * `components/scene/shapes.ts`, the object the hero draws and the intro flies out of: a board at
 * 2.3 with its via field and its routing, the substrate at 1.0 with pin runs down every wall and
 * capacitor studs on its lid, the heat spreader at 0.68 with its machined rim, the lit die at 0.34.
 * The stack fans apart and closes again — the scene's own gesture, the one `coreExitPose`'s `lift`
 * is literally named the exploded view for — while the whole assembly turns on the isometric tilt
 * every drawing on this site is made at.
 *
 * **Real 3D, in CSS, and every layer is a real BOX**: a lid and four walls at their true thickness,
 * not a plane. That is the difference between stacked paper and an object — the walls take the
 * turn, one side lit and one dark, so the fan reads as depth rather than as scale. Bottom faces
 * are never built, because the camera is above the tilt and would never see one.
 *
 * It is deliberately not WebGL: this is on screen at exactly the moment the scene's chunk and
 * shaders own the main thread, and asking for a second GL context there is the worst thing that
 * could be done. Transform and opacity only, so every frame belongs to the compositor.
 *
 * `aria-hidden`: the cover that carries it is already hidden from assistive tech, and the page
 * underneath stays readable the whole time.
 *
 * The turn is 8s and the breath 3.4s — deliberately not commensurate, so the two never land
 * together twice and the loop does not read as one.
 */

/** Positional vars, in CHIP units. Read by BootCore.module.css; see the box comment there. */
type Vars = CSSProperties;
const at = (v: Record<string, number>): Vars => v as Vars;

/** The stack, bottom to top: half-size, thickness, and rank in the fan. All `CHIP` measurements. */
const LAYERS = [
  { cls: s.board, half: 2.3, thick: 0.06, rank: 0 },
  { cls: s.pkg, half: 1.0, thick: 0.08, rank: 1 },
  { cls: s.ihs, half: 0.68, thick: 0.07, rank: 2 },
  { cls: s.die, half: 0.34, thick: 0.05, rank: 3 },
] as const;

/** Capacitor studs, one per quadrant, clear of the die at 0.34 and of the substrate's edge at 1. */
const CAPS = [
  { x: 0.68, y: 0.6 },
  { x: -0.7, y: 0.54 },
  { x: 0.58, y: -0.7 },
  { x: -0.6, y: -0.66 },
] as const;

/** Where the studs stand: on the substrate's lid, so its thickness times the same exaggeration. */
const SUBSTRATE_TOP = 0.08 * 2.6;

/**
 * Routing leaving the package for the board's edge, in the board's own units (×100, so the
 * package's edge is at 50 ± 21.7). Dog-legged at 90° and 45°, the way board routing actually goes.
 */
const RUNS = [
  "M28 38H18L10 30V12",
  "M28 46H14V6",
  "M28 54H16L8 62",
  "M28 62H20L12 70V90",
  "M72 38H82L90 30V10",
  "M72 46H86V6",
  "M72 54H84L92 62",
  "M72 62H80L88 70V90",
  "M38 28V18L30 10",
  "M46 28V12H26",
  "M54 28V12H76",
  "M62 28V18L70 10",
  "M38 72V82L30 90",
  "M46 72V88H26",
  "M54 72V88H76",
  "M62 72V82L70 90",
].join("");

/** A via pad at every turn: a zero-length segment, squared off by `stroke-linecap` into a pad. */
const PADS = [
  [18, 38], [10, 30], [14, 46], [16, 54], [8, 62], [20, 62], [12, 70],
  [82, 38], [90, 30], [86, 46], [84, 54], [92, 62], [80, 62], [88, 70],
  [38, 18], [30, 10], [46, 12], [54, 12], [62, 18], [70, 10],
  [38, 82], [30, 90], [46, 88], [54, 88], [62, 82], [70, 90],
]
  .map(([x, y]) => `M${x} ${y}h.01`)
  .join("");

/** A lid and four walls. `--s` half-size, `--t` thickness; the rest is placement. */
function Box({ cls, vars }: { cls: string; vars: Vars }) {
  return (
    <div className={`${s.box} ${cls}`} style={vars}>
      <span className={s.top} />
      <span className={`${s.wallY} ${s.wN}`} />
      <span className={`${s.wallY} ${s.wS}`} />
      <span className={`${s.wallX} ${s.wE}`} />
      <span className={`${s.wallX} ${s.wW}`} />
    </div>
  );
}

export function BootCore() {
  return (
    <div className={s.stage} aria-hidden="true">
      <div className={s.spin}>
        <div className={s.shadow} />
        <svg viewBox="0 0 100 100" className={s.traces}>
          <path className={s.runs} d={RUNS} />
          <path className={s.pads} d={PADS} />
          <path className={s.pulse} d={RUNS} />
        </svg>
        {LAYERS.map((l) => (
          <Box
            key={l.half}
            cls={`${s.fan} ${l.cls}`}
            vars={at({ "--s": l.half, "--t": l.thick, "--i": l.rank })}
          />
        ))}
        {/* The studs ride the substrate, so ONE group fans and each stud inside it stays put. */}
        <div className={`${s.group} ${s.fan}`} style={at({ "--i": 1 })}>
          {CAPS.map((c) => (
            <Box
              key={`${c.x},${c.y}`}
              cls={s.cap}
              vars={at({ "--s": 0.085, "--t": 0.13, "--ox": c.x, "--oy": c.y, "--oz": SUBSTRATE_TOP })}
            />
          ))}
        </div>
        <div className={s.axis} />
      </div>
      <div className={s.frame}>
        <span className={`${s.bracket} ${s.tl}`} />
        <span className={`${s.bracket} ${s.tr}`} />
        <span className={`${s.bracket} ${s.br}`} />
        <span className={`${s.bracket} ${s.bl}`} />
      </div>
    </div>
  );
}
