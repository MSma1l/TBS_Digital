"use client";

import { type CSSProperties } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Principles.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

/* `accent` tints the hover border and the mark (graphics — 3:1 is enough); `accentText` colours
   the 12px/800 number, which is TEXT and needs 4.5:1. They are separate because the brand fills
   (--blue 4.25:1, --green 3.21:1, --red 4.19:1 on white) all fail as small text. */
type Why = {
  number: LocalizedText;
  title: LocalizedText;
  text: LocalizedText;
  accent: string;
  accentText: string;
};

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
    accentText: "var(--blue-text)",
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
    accentText: "var(--green-text)",
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
    accentText: "var(--red-text)",
  },
];

const SECTION = {
  eyebrow: L("De ce TBS", "Почему TBS", "Why TBS"),
  title: L("Cum lucrăm, pe scurt.", "Как мы работаем, коротко.", "How we work, in short."),
};

/*
 * THE CARD MARKS.
 *
 * One small drawing per card, the SAME size in the SAME corner on all three. That sameness is
 * the whole point and it is what the first attempt got wrong: a 3D model in one card, a list in
 * the next and a large empty frame in the third gave the row three different visual weights, and
 * the empty frame read as a panel that had failed to load rather than as a deliberate mark.
 *
 * Drawn to the house rules for line art (docs/07): straight strokes, square caps, no circles, no
 * decorative dots, nothing animated on `stroke-dashoffset`. They carry no text and are hidden
 * from assistive technology — the sentence beside each one is the claim, and the mark is only
 * that claim drawn.
 */
const MARKS: Record<string, React.ReactNode> = {
  /* Layers: a page is one plane, a product is a stack of them. */
  produs: (
    <>
      <path d="M12 3.5 21 8l-9 4.5L3 8z" />
      <path d="M3 12.2 12 16.7l9-4.5" />
      <path d="M3 16.2 12 20.7l9-4.5" />
    </>
  ),
  /* Three stages, listed: what a transparent process looks like written down. Drawn as rows and
     not as three boxes on one horizontal run — that version was a thin strip, a third of the
     optical weight of the other two marks, and the row stopped reading as a set. */
  proces: (
    <>
      <path d="M3 3.6h4.4V8H3zM3 9.8h4.4v4.4H3zM3 16h4.4v4.4H3z" />
      <path d="M10.4 5.8H21M10.4 12H21M10.4 18.2H21" />
    </>
  ),
  /* Framed and sighted: the instrument, not a reading. There is no number in it and there never
     may be — see the note in the stylesheet. */
  rezultat: (
    <>
      <path d="M3.4 8.2V3.4h4.8M16.2 3.4H21v4.8M21 16.2V21h-4.8M8.2 21H3.4v-4.8" />
      <path d="M12 7.8v8.4M7.8 12h8.4" />
    </>
  ),
};

const MARK_KEYS = ["produs", "proces", "rezultat"];

function CardMark({ kind }: { kind: string }) {
  return (
    <svg
      className={styles.mark}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[kind]}
    </svg>
  );
}

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
              style={
                {
                  "--accent": w.accent,
                  "--accent-text": w.accentText,
                  /* This card's place in the row, which the mark's entrance multiplies. */
                  "--card-index": i,
                } as CSSProperties
              }
            >
              <CardMark kind={MARK_KEYS[i]} />
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
