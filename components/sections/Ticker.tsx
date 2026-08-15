"use client";

import { Fragment } from "react";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Ticker.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const LEAD = L(
  "Strategie → design → livrare",
  "Стратегия → дизайн → запуск",
  "Strategy → design → delivery",
);
const ITEMS: LocalizedText[] = [
  L("Design premium", "Премиум-дизайн", "Premium design"),
  L("Integrări & API", "Интеграции и API", "Integrations & API"),
  L("Multilingv", "Мультиязычность", "Multilingual"),
  L("AI & automatizare", "ИИ и автоматизация", "AI & automation"),
];

/**
 * Trust ticker under the hero. The row is rendered twice back-to-back and the track
 * slides by exactly -50%, so the loop is seamless. It pauses on hover, and stops
 * entirely for users who prefer reduced motion.
 */
export function Ticker() {
  const l = useLoc();

  const row = (copy: number) => (
    <Fragment key={copy}>
      <strong className={styles.lead}>{l(LEAD)}</strong>
      {ITEMS.map((it, i) => (
        <Fragment key={`${copy}-${i}`}>
          <i className={styles.diamond} aria-hidden>
            ◆
          </i>
          <span className={styles.item}>{l(it)}</span>
        </Fragment>
      ))}
    </Fragment>
  );

  return (
    <div className={styles.trust} aria-hidden="true">
      <div className={`mono ${styles.track}`}>
        {row(0)}
        {row(1)}
      </div>
    </div>
  );
}
