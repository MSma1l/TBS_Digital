import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { workPlaceholders } from "@/lib/content";
import styles from "./Work.module.css";

export function Work() {
  return (
    <section id="lucrari" className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/04">EXPERIENȚA NOASTRĂ</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Proiecte pe care
            <br />
            le-am creat
          </h2>
          <p className={styles.lead}>
            O selecție din produsele digitale construite pentru clienți din
            diverse industrii.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {workPlaceholders.map((w) => (
            <Reveal key={w.id} className={styles.card}>
              <div
                className={styles.thumb}
                style={{ background: w.grad }}
                aria-hidden
              >
                <div className={styles.scanlines} />
                <span className={`mono ${styles.tagPlaceholder}`} />
              </div>
              <div className={styles.body} aria-hidden>
                <span className={styles.lineSm} />
                <span className={styles.lineLg} />
                <span className={styles.lineMd} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
