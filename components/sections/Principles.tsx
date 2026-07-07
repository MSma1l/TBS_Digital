"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { principles } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./Principles.module.css";

export function Principles() {
  const { stats } = useSiteContent();

  return (
    <section id="despre" className={styles.section}>
      <div className="container">
        <Reveal>
          <SectionLabel index="/02">PRINCIPIILE NOASTRE</SectionLabel>
        </Reveal>

        <div className={styles.grid}>
          {principles.map((p) => (
            <Reveal key={p.title} className={styles.cell}>
              <div className={`mono ${styles.cellTitle}`}>{p.title}</div>
              <p className={styles.cellDesc}>{p.desc}</p>
            </Reveal>
          ))}
        </div>

        <div className={styles.stats}>
          {stats.map((s) => {
            const empty = !s.value && !s.label;
            return (
              <Reveal key={s.id} className={styles.stat} aria-hidden={empty}>
                {s.value && (
                  <div className={`disp ${styles.statValue}`}>{s.value}</div>
                )}
                {s.label && (
                  <div className={`mono ${styles.statLabel}`}>{s.label}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
