"use client";

import { useT } from "@/lib/i18n/LanguageProvider";
import { Multiline } from "@/lib/i18n/format";
import { HeroEmblem } from "./HeroEmblem";
import styles from "./Hero.module.css";

export function Hero() {
  const t = useT();

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
              {t("hero.badge")}
            </div>
            <h1 className={`disp ${styles.title}`}>
              TBS
              <br />
              <span className={styles.titleOutline}>DIGITAL</span>
            </h1>
            <p className={`mono ${styles.kicker}`}>
              <Multiline text={t("hero.kicker")} />
            </p>
            <p className={styles.lead}>{t("hero.lead")}</p>
            <div className={styles.actions}>
              <a href="#contact" className={`mono ${styles.primary}`}>
                {t("hero.cta.primary")}
              </a>
              <a href="#servicii" className={`mono ${styles.secondary}`}>
                {t("hero.cta.secondary")}
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
