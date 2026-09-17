import { ART_VIEWBOX, CHIP_ART, CHIP_ART_MATRIX, GLOW_HALF, WAVE_HALF } from "./heroArt";
import styles from "./HeroCoreArt.module.css";

const cx = (...names: string[]) => names.join(" ");

/**
 * The hero's static microprocessor — what every device without the WebGL scene sees, and
 * what the canvas crossfades from: a neon chip (substrate, heat spreader and a glowing die)
 * lying back as a diamond, its pins fanning out into circuit traces that end in square vias,
 * with a few data packets on the board. A server component: no hooks, no client JS, handed
 * to `Hero` as a prop from app/(site)/page.tsx, so its markup ships in the HTML only.
 *
 * One SVG. Everything is drawn in the chip's own plane inside a single group whose matrix is
 * the WebGL chip's pose, projected (./heroArt.ts), back to front: the glow, the traces and
 * their vias, the pins, the slabs, the die and its grid, the packets, and the boost wave.
 *
 * It never loops (D4: static art). The one motion is a single square wave with a flicker of
 * the packets while a hero CTA is hovered or focused (`data-boost` on the stage), dropped
 * under reduced motion. Fixed ids: there is only ever one core on a page. Colours come from
 * tokens, in the CSS Module.
 */
export function HeroCoreArt() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-core-art=""
      viewBox={ART_VIEWBOX}
      className={styles.art}
    >
      <defs>
        <radialGradient id="tbs-core-glow" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={GLOW_HALF}>
          <stop offset="0" className={styles.glowCore} />
          <stop offset="0.45" className={styles.glowBody} />
          <stop offset="1" className={styles.glowOut} />
        </radialGradient>
        <linearGradient id="tbs-core-die" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" className={styles.dieDeep} />
          <stop offset="1" className={styles.dieLit} />
        </linearGradient>
      </defs>
      <g transform={CHIP_ART_MATRIX}>
        <rect
          x={-GLOW_HALF}
          y={-GLOW_HALF}
          width={2 * GLOW_HALF}
          height={2 * GLOW_HALF}
          fill="url(#tbs-core-glow)"
        />
        <g className={styles.traces}>
          <use href="#tbs-core-traces" className={styles.halo} />
          <path id="tbs-core-traces" d={CHIP_ART.traces} className={styles.line} />
        </g>
        <path d={CHIP_ART.vias} className={cx(styles.line, styles.vias)} />
        <path d={CHIP_ART.pins} className={cx(styles.line, styles.pins)} />
        <g className={styles.pkg}>
          <use href="#tbs-core-pkg" className={styles.halo} />
          <path id="tbs-core-pkg" d={CHIP_ART.pkg} className={styles.line} />
        </g>
        <path d={CHIP_ART.die} fill="url(#tbs-core-die)" className={styles.die} />
        <path d={CHIP_ART.grid} className={cx(styles.line, styles.grid)} />
        <path d={CHIP_ART.packets} className={cx(styles.line, styles.packets)} />
        <rect
          x={-WAVE_HALF}
          y={-WAVE_HALF}
          width={2 * WAVE_HALF}
          height={2 * WAVE_HALF}
          className={cx(styles.line, styles.wave)}
        />
      </g>
    </svg>
  );
}
