import { ART_VIEWBOX, CORE_ART, HALO_R, SPHERE_R, WAVE_R } from "./heroArt";
import styles from "./HeroCoreArt.module.css";

/**
 * The hero's static "Cybernetic Core" — what every device without the WebGL scene sees, and
 * what the canvas crossfades from: a frosted glass sphere around a wire nucleus, three tilted
 * rings, and a cloud of particle streaks. A server component: no hooks, no client JS, handed
 * to `Hero` as a prop from app/(site)/page.tsx, so its markup ships in the HTML only.
 *
 * One SVG, back to front: the ring stretches hidden behind the sphere, the glass (a single
 * radial gradient — nucleus glow, milky body, bright fresnel edge and a soft halo), the
 * nucleus, the glints and a two-tone rim, then the rings in view and the particles on top.
 * The geometry is components/scene/art/heroArt.ts, at the WebGL core's proportions.
 *
 * It never loops (D4: static art). The one motion is a single light wave while a hero CTA is
 * hovered or focused (`data-boost` on the stage), dropped under reduced motion. Fixed ids:
 * there is only ever one core on a page. Colours come from tokens, in the CSS Module.
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
        <radialGradient id="tbs-core-glass" gradientUnits="userSpaceOnUse" cx="0" cy="0" r={HALO_R}>
          <stop offset="0" className={styles.stopCore} />
          <stop offset="0.3" className={styles.stopBody} />
          <stop offset="0.46" className={styles.stopFresnel} />
          <stop offset={SPHERE_R / HALO_R} className={styles.stopEdge} />
          <stop offset={SPHERE_R / HALO_R + 0.01} className={styles.stopHalo} />
          <stop offset="1" className={styles.stopOut} />
        </radialGradient>
        <linearGradient id="tbs-core-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.15" className={styles.stopRimCyan} />
          <stop offset="0.55" className={styles.stopRimBlue} />
          <stop offset="0.9" className={styles.stopRimRed} />
        </linearGradient>
      </defs>
      <path d={CORE_ART.ringsHidden} className={`${styles.line} ${styles.ringHidden}`} />
      <circle r={HALO_R} fill="url(#tbs-core-glass)" />
      <path d={CORE_ART.nucleus} className={`${styles.line} ${styles.nucleus}`} />
      <path d={CORE_ART.specular} className={`${styles.line} ${styles.glint}`} />
      <circle r={SPHERE_R} stroke="url(#tbs-core-rim)" className={`${styles.line} ${styles.rim}`} />
      <path d={CORE_ART.rings[0]} className={`${styles.line} ${styles.ringInner}`} />
      <path d={CORE_ART.rings[1]} className={`${styles.line} ${styles.ringMiddle}`} />
      <path d={CORE_ART.rings[2]} className={`${styles.line} ${styles.ringOuter}`} />
      <path d={CORE_ART.streaks} className={`${styles.line} ${styles.cloud} ${styles.streaks}`} />
      <path d={CORE_ART.marks} className={`${styles.line} ${styles.cloud} ${styles.marks}`} />
      <circle r={WAVE_R} className={`${styles.line} ${styles.wave}`} />
    </svg>
  );
}
