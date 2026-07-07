import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { principles, stats } from "@/lib/content";
import styles from "./Principles.module.css";

export function Principles() {
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
          {stats.map((s) => (
            <Reveal key={s.label} className={styles.stat}>
              <div className={`disp ${styles.statValue}`}>{s.value}</div>
              <div className={`mono ${styles.statLabel}`}>{s.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
