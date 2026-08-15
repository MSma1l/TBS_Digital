"use client";

import { type CSSProperties } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Principles.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

type Why = { number: LocalizedText; title: LocalizedText; text: LocalizedText; accent: string };

const WHY: Why[] = [
  {
    number: L("01 / PRODUS", "01 / ПРОДУКТ", "01 / PRODUCT"),
    title: L("Produs, nu doar un site", "Продукт, а не просто сайт", "A product, not just a site"),
    text: L(
      "Pornim de la problema de business și livrăm ceva ce aduce rezultate, nu doar pagini frumoase.",
      "Идём от бизнес-задачи и делаем то, что приносит результат, а не просто красивые страницы.",
      "We start from the business problem and ship something that drives results, not just pretty pages.",
    ),
    accent: "var(--blue)",
  },
  {
    number: L("02 / PROCES", "02 / ПРОЦЕСС", "02 / PROCESS"),
    title: L("Proces transparent", "Прозрачный процесс", "A transparent process"),
    text: L(
      "Vezi în orice moment unde suntem: etape clare, demo-uri regulate și decizii luate împreună.",
      "В любой момент видно, где мы: понятные этапы, регулярные демо и решения, принятые вместе.",
      "You always see where we are: clear stages, regular demos and decisions made together.",
    ),
    accent: "var(--green)",
  },
  {
    number: L("03 / REZULTAT", "03 / РЕЗУЛЬТАТ", "03 / RESULT"),
    title: L("Rezultat măsurabil", "Измеримый результат", "Measurable results"),
    text: L(
      "Legăm fiecare livrare de un indicator real — conversie, timp economisit sau venit — nu de intuiție.",
      "Привязываем каждый релиз к реальному показателю — конверсии, сэкономленному времени или выручке.",
      "We tie every release to a real metric — conversion, time saved or revenue — not a gut feeling.",
    ),
    accent: "var(--red)",
  },
];

const SECTION = {
  eyebrow: L("De ce TBS", "Почему TBS", "Why TBS"),
  title: L("Cum lucrăm, pe scurt.", "Как мы работаем, коротко.", "How we work, in short."),
};

export function Principles() {
  const l = useLoc();

  return (
    <section id="despre" className={styles.section}>
      <div className="container">
        <Reveal className={styles.head}>
          <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
          <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
        </Reveal>

        <div className={styles.grid}>
          {WHY.map((w, i) => (
            <Reveal
              key={i}
              className={styles.card}
              style={{ "--accent": w.accent } as CSSProperties}
            >
              <div className={`mono ${styles.number}`}>{l(w.number)}</div>
              <h3 className={`disp ${styles.cardTitle}`}>{l(w.title)}</h3>
              <p className={styles.cardText}>{l(w.text)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
