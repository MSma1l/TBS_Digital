"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { iconFor } from "@/components/ui/ServiceIcons";
import { useAutoCarousel } from "@/components/ui/useAutoCarousel";
import { useSiteContent } from "@/lib/siteContent";
import { requestEstimate } from "@/lib/estimatorBridge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc } from "@/lib/i18n/content";
import { format, Multiline } from "@/lib/i18n/format";
import styles from "./Services.module.css";

export function Services() {
  const { services } = useSiteContent();
  const t = useT();
  const l = useLoc();
  const cards = services.filter((s) => !s.estimatorOnly);
  // Mobile carousel: auto-rolls, pauses on manual slide (see the hook).
  const trackRef = useAutoCarousel(cards.length);

  return (
    <section id="servicii" className="section">
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/03">{t("services.label")}</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            <Multiline text={t("services.title")} />
          </h2>
          <p className={styles.lead}>{t("services.lead")}</p>
        </Reveal>

        <div ref={trackRef} className={styles.grid}>
          {cards.map((s, i) => {
            const name = l(s.name);
            return (
              <Reveal
                key={s.id}
                className={styles.card}
                onClick={() => requestEstimate(s.id)}
                ariaLabel={format(t("services.card.estimateAria"), { name })}
              >
                <div className={`mono ${styles.num}`}>
                  /{String(i + 1).padStart(2, "0")}
                </div>
                <div className={styles.icon}>{iconFor(s.id)}</div>
                <h3 className={`mono ${styles.name}`}>{name}</h3>
                <p className={styles.desc}>{l(s.desc)}</p>
                <span className={`mono ${styles.cta}`} aria-hidden>
                  {t("services.card.cta")}
                </span>
              </Reveal>
            );
          })}
        </div>

        {/* mobile-only affordance for the horizontal carousel (CSS-hidden on desktop) */}
        <p className={`mono ${styles.swipeHint}`} aria-hidden>
          {format(t("services.swipeHint"), { n: cards.length })}
        </p>
      </div>
    </section>
  );
}
