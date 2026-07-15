"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { principles } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc } from "@/lib/i18n/content";
import { Multiline } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import styles from "./Principles.module.css";

export function Principles() {
  const { stats } = useSiteContent();
  const t = useT();
  const l = useLoc();

  return (
    <section id="despre" className={styles.section}>
      <div className="container">
        <Reveal>
          <SectionLabel index="/02">{t("principles.label")}</SectionLabel>
        </Reveal>

        <div className={styles.grid}>
          {principles.map((p, i) => (
            <Reveal key={p.title} className={styles.cell}>
              <div className={`mono ${styles.cellTitle}`}>
                <Multiline text={t(`principles.${i}.title` as MessageKey)} />
              </div>
              <p className={styles.cellDesc}>
                {t(`principles.${i}.desc` as MessageKey)}
              </p>
            </Reveal>
          ))}
        </div>

        <div className={styles.stats}>
          {stats.map((s) => {
            const label = l(s.label);
            const empty = !s.value && !label;
            return (
              <Reveal key={s.id} className={styles.stat} aria-hidden={empty}>
                {s.value && (
                  <div className={`disp ${styles.statValue}`}>{s.value}</div>
                )}
                {label && (
                  <div className={`mono ${styles.statLabel}`}>{label}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
