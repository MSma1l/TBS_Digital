"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc } from "@/lib/i18n/content";
import { directions } from "@/lib/directions";
import { solutions, solUI } from "@/lib/solutions";
import type { CSSProperties } from "react";
import styles from "./DirectionPage.module.css";

/** A single direction page. Filled directions render the full layout; the rest show a
 *  short placeholder until we build them out. */
export function DirectionPage({ slug }: { slug: string }) {
  const t = useT();
  const l = useLoc();
  const sol = solutions[slug];

  if (!sol) {
    const dir = directions.find((d) => d.slug === slug);
    return (
      <section className={`section ${styles.placeholder}`}>
        <div className="container">
          <div className={`mono ${styles.eyebrow}`}>{t("dir.section.kicker")}</div>
          <h1 className={styles.phTitle}>{dir ? t(dir.labelKey) : ""}</h1>
          <p className={styles.phLead}>{t("dir.page.soon")}</p>
          <Link href="/#servicii" className={`mono ${styles.back}`}>
            ← {t("dir.page.back")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div
      className={styles.page}
      style={{ "--sol-accent": sol.accent ?? "var(--blue)" } as CSSProperties}
    >
      <div className="container">
        <Link href="/#servicii" className={`mono ${styles.back}`}>
          {l(solUI.back)}
        </Link>

        <section className={styles.hero}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(sol.eyebrow)}</div>
            <h1 className={styles.title}>{l(sol.title)}</h1>
            <p className={styles.intro}>{l(sol.intro)}</p>
            <Link href="/#contact" className={styles.cta}>
              {l(solUI.talk)}
            </Link>
          </div>

          <div className={styles.visual}>
            <div className={styles.visualCard}>
              <small className="mono">{l(sol.cardLabel)}</small>
              <strong>{l(sol.cardTitle)}</strong>
              <span>{l(sol.cardText)}</span>
            </div>
          </div>
        </section>

        <section className={styles.highlights}>
          {sol.items.map((it, i) => (
            <article key={i} className={styles.highlight}>
              <b className="mono">{l(solUI.benefit)}</b>
              <h2>{l(it.title)}</h2>
              <p>{l(it.desc)}</p>
            </article>
          ))}
        </section>

        <section className={styles.steps}>
          <h2 className="disp">{l(solUI.stepsTitle)}</h2>
          {sol.steps.map((st, i) => (
            <div key={i} className={styles.stepRow}>
              <b className="mono">{String(i + 1).padStart(2, "0")}</b>
              <p>{l(st)}</p>
            </div>
          ))}
        </section>

        <section className={styles.bottom}>
          <h2 className="disp">{l(solUI.bottomTitle)}</h2>
          <p>{l(solUI.bottomLead)}</p>
          <Link href="/#contact" className={styles.cta}>
            {l(solUI.start)}
          </Link>
        </section>
      </div>
    </div>
  );
}
