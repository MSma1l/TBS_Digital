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

          {/* emblem / HUD */}
          <div className={styles.emblemCol}>
            <div className={styles.emblemStage}>
              <div className={styles.emblemHalo} aria-hidden />

              <div className={`mono ${styles.hudCoords}`} aria-hidden>
                <div>
                  X <span className={styles.hudVal}>36.1749</span>
                </div>
                <div>
                  Y <span className={styles.hudVal}>-86.7676</span>
                </div>
                <div>
                  Z <span className={styles.hudVal}>46.6821</span>
                </div>
              </div>
              <div className={`mono ${styles.hudRender}`} aria-hidden>
                &gt;RENDERING... <span className={styles.hudValInline}>100%</span>
              </div>
              <div className={`mono ${styles.hudScan}`} aria-hidden>
                //SCN_01
              </div>

              <div className={styles.emblem}>
                <div className={styles.ringDashed} />
                <div className={styles.ringSolid} />
                <div className={styles.ringInner} />
                <div className={styles.crossH} />
                <div className={styles.crossV} />
                <div className={styles.coreGlow} />
                <div className={styles.core}>
                  <div className={styles.coreScan} />
                  <span className={`disp ${styles.coreText}`}>TBS</span>
                </div>
                <div className={styles.orbitOuter}>
                  <span className={styles.orbitDotOuter} />
                </div>
                <div className={styles.orbitInner}>
                  <span className={styles.orbitDotInner} />
                </div>
              </div>
            </div>

            <div className={`disp ${styles.wordmark}`}>
              TBS<span className={styles.wordmarkAccent}>&nbsp;DIGITAL</span>
            </div>
            <p className={`mono ${styles.scrollHint}`}>
              DERULEAZĂ — SISTEMUL SE ACTIVEAZĂ ↓
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
