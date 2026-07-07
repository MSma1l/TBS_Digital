import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { serviceIcons } from "@/components/ui/ServiceIcons";
import { services } from "@/lib/content";
import styles from "./Services.module.css";

export function Services() {
  return (
    <section id="servicii" className="section">
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/03">CE PUTEM FACE</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Servicii de
            <br />
            digitalizare
          </h2>
          <p className={styles.lead}>
            Alege un serviciu sau combină mai multe într-un produs complet.
          </p>
        </Reveal>

        <div className={styles.grid}>
          {services.map((s) => (
            <Reveal key={s.id} className={styles.card}>
              <div className={`mono ${styles.num}`}>{s.num}</div>
              <div className={styles.icon}>{serviceIcons[s.id]}</div>
              <h3 className={`mono ${styles.name}`}>{s.name}</h3>
              <p className={styles.desc}>{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
