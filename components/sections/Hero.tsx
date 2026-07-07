import { HeroEmblem } from "./HeroEmblem";
import styles from "./Hero.module.css";

export function Hero() {
  return (
    <section id="top" className={styles.hero}>
      {/* decorative background layers */}
      <div className={styles.glow} aria-hidden />
      <div className={styles.stars} aria-hidden />
      <div className={styles.grid} aria-hidden />

      <div className={`container ${styles.inner}`}>
        {/* meta row */}
        <div className={`mono ${styles.meta}`}>
          <span className={styles.metaAccent}>WEB · SOFTWARE · IA // 2026</span>
          <span>/01</span>
        </div>

        <div className={styles.row}>
          {/* copy */}
          <div className={styles.copy}>
            <div className={`mono ${styles.badge}`}>
              <span className={styles.badgeDot} />
              DE LA CONSULTANȚĂ LA DIGITALIZARE
            </div>
            <h1 className={`disp ${styles.title}`}>
              TBS
              <br />
              <span className={styles.titleOutline}>DIGITAL</span>
            </h1>
            <p className={`mono ${styles.kicker}`}>
              Viitorul nu e minimal.
              <br />E construit.
            </p>
            <p className={styles.lead}>
              Software personalizat, aplicații mobile, automatizări cu IA, CRM,
              SaaS și platforme care îți cresc afacerea — de la strategie până la
              execuție.
            </p>
            <div className={styles.actions}>
              <a href="#contact" className={`mono ${styles.primary}`}>
                Calculează prețul ↗
              </a>
              <a href="#servicii" className={`mono ${styles.secondary}`}>
                Vezi serviciile
              </a>
            </div>
          </div>

          {/* emblem / HUD — interactive (scroll + pointer) */}
          <HeroEmblem />
        </div>
      </div>
    </section>
  );
}
