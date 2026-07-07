"use client";

import { useState, type FormEvent } from "react";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { deadlines, features, PRICE_PLACEHOLDER } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./Estimator.module.css";

export function Estimator() {
  // The project-type list IS the services list (name + price) — same source as /03.
  const { services: projectTypes } = useSiteContent();
  const priceOf = (id: string) =>
    projectTypes.find((p) => p.id === id)?.price || PRICE_PLACEHOLDER;

  const [project, setProject] = useState("site");
  const [deadline, setDeadline] = useState("standard");
  const [activeFeatures, setActiveFeatures] = useState<Record<string, boolean>>(
    {},
  );
  const [sent, setSent] = useState(false);

  const toggleFeature = (id: string) =>
    setActiveFeatures((f) => ({ ...f, [id]: !f[id] }));

  const selectedProjectName =
    projectTypes.find((p) => p.id === project)?.name ?? "";

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // UI-only phase: no network — just show the local confirmation state.
    setSent(true);
  };

  return (
    <section id="contact" className={styles.section}>
      <div className={styles.glow} aria-hidden />
      <div className={`container ${styles.inner}`}>
        <div className={styles.head}>
          <SectionLabel index="/06">HAI SĂ CONSTRUIM ÎMPREUNĂ</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Estimează prețul
            <br />
            proiectului tău
          </h2>
          <p className={styles.lead}>
            Alege tipul de proiect, termenul limită și opțiunile — apoi trimite-ne
            detaliile.
          </p>
        </div>

        <div className={styles.grid}>
          {/* ---------- estimator ---------- */}
          <div className={styles.estimator}>
            <div className={`mono ${styles.groupLabel}`}>01 · TIP DE PROIECT</div>
            <div className={styles.typeGrid}>
              {projectTypes.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProject(opt.id)}
                  className={`${styles.typeBtn} ${
                    project === opt.id ? styles.active : ""
                  }`}
                >
                  <div className={`mono ${styles.typeName}`}>{opt.name}</div>
                  <div className={`mono ${styles.typePrice}`}>
                    de la {priceOf(opt.id)}
                  </div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>02 · TERMEN LIMITĂ</div>
            <div className={styles.deadlineRow}>
              {deadlines.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeadline(opt.id)}
                  className={`${styles.deadlineBtn} ${
                    deadline === opt.id ? styles.active : ""
                  }`}
                >
                  <div className={`mono ${styles.deadlineName}`}>{opt.name}</div>
                  <div className={`mono ${styles.deadlineNote}`}>{opt.note}</div>
                </button>
              ))}
            </div>

            <div className={`mono ${styles.groupLabel}`}>
              03 · OPȚIUNI SUPLIMENTARE
            </div>
            <div className={styles.featureRow}>
              {features.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleFeature(opt.id)}
                  className={`mono ${styles.chip} ${
                    activeFeatures[opt.id] ? styles.chipActive : ""
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className={styles.total}>
              <div className={`mono ${styles.totalLabel}`}>
                PREȚ ORIENTATIV ESTIMAT
              </div>
              <div className={`disp ${styles.totalValue}`}>
                {priceOf(project)}
              </div>
              <div className={`mono ${styles.totalNote}`}>
                ESTIMARE AUTOMATĂ · PREȚUL FINAL DUPĂ DISCUȚIE.
              </div>
            </div>
          </div>

          {/* ---------- form ---------- */}
          <div className={styles.form}>
            {sent ? (
              <div className={styles.sent}>
                <div className={styles.check}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className={`disp ${styles.sentTitle}`}>Mulțumim!</h3>
                <p className={styles.sentText}>
                  Am primit cererea pentru {selectedProjectName}. Revenim în
                  curând cu o ofertă.
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className={`mono ${styles.resetBtn}`}
                >
                  TRIMITE ALTĂ CERERE
                </button>
              </div>
            ) : (
              <>
                <h3 className={`disp ${styles.formTitle}`}>Trimite detaliile</h3>
                <p className={styles.formSub}>
                  Revenim cu o ofertă personalizată în cel mult 24h.
                </p>
                <form onSubmit={onSubmit} className={styles.fields}>
                  <input
                    required
                    placeholder="Nume și prenume"
                    className={`mono ${styles.input}`}
                  />
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    className={`mono ${styles.input}`}
                  />
                  <input
                    placeholder="Telefon (opțional)"
                    className={`mono ${styles.input}`}
                  />
                  <textarea
                    rows={4}
                    placeholder="Spune-ne despre proiectul tău..."
                    className={`mono ${styles.textarea}`}
                  />
                  <div className={`mono ${styles.estimateNote}`}>
                    ESTIMARE ATAȘATĂ:{" "}
                    <span className={styles.estimateVal}>{priceOf(project)}</span>{" "}
                    · {selectedProjectName}
                  </div>
                  <button type="submit" className={`mono ${styles.submit}`}>
                    Trimite cererea ↗
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
