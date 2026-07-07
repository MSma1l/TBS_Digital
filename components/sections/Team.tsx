import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { statusBars, teamPlaceholders } from "@/lib/content";
import styles from "./Team.module.css";

export function Team() {
  return (
    <section id="echipa" className="section">
      <div className={`container ${styles.layout}`}>
        {/* left column */}
        <div>
          <Reveal>
            <SectionLabel index="/05">ECHIPA</SectionLabel>
            <h2 className={`disp ${styles.title}`}>
              Oamenii din
              <br />
              spatele codului
            </h2>
            <p className={styles.lead}>
              O echipă mică și dedicată care combină strategia de business cu
              dezvoltarea tehnică.
            </p>
          </Reveal>

          <Reveal className={styles.status}>
            <div className={`mono ${styles.statusLabel}`}>SYSTEM_STATUS</div>
            {statusBars.map((b) => (
              <div key={b.label} className={styles.statusRow}>
                <span className={`mono ${styles.statusName}`}>{b.label}</span>
                <span className={styles.statusTrack}>
                  <span
                    className={styles.statusFill}
                    style={{ width: b.pct }}
                  />
                </span>
                <span className={`mono ${styles.statusVal}`}>{b.val}</span>
              </div>
            ))}
            <div className={`mono hz ${styles.statusStripes}`} />
          </Reveal>
        </div>

        {/* right column: placeholder team cards */}
        <div className={styles.cards}>
          {teamPlaceholders.map((m) => (
            <Reveal key={m.id} className={styles.card}>
              <div className={styles.avatar} aria-hidden />
              <span className={styles.lineName} aria-hidden />
              <span className={styles.lineRole} aria-hidden />
              <span className={styles.lineBio} aria-hidden />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
