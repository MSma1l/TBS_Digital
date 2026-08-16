"use client";

import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./Hero.module.css";

/** Inline trilingual literal — keeps the hero copy out of the message catalog
    (which is typed and churny) while staying fully RO/RU/EN. */
const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const EYEBROW = L(
  "TBS DIGITAL / WEB · SOFTWARE · AI",
  "TBS DIGITAL / WEB · SOFTWARE · ИИ",
  "TBS DIGITAL / WEB · SOFTWARE · AI",
);
const TITLE = L(
  "Construim digital ce mișcă businessul.",
  "Строим digital, который двигает бизнес.",
  "We build digital that moves business.",
);
const LEAD = L(
  "De la consultanță la produs funcțional.",
  "От консалтинга до рабочего продукта.",
  "From consulting to a working product.",
);
const CTA_PRIMARY = L("Începe proiectul", "Начать проект", "Start a project");
const CTA_SECONDARY = L(
  "Explorăm serviciile ↓",
  "Смотреть услуги ↓",
  "Explore services ↓",
);

type Metric = { id: string; value: string; label: LocalizedText; note: LocalizedText };

/** The portfolio counter's copy. Its *value* is counted, never written here. */
const PROJECTS_LABEL = L(
  "proiecte în portofoliu",
  "проектов в портфолио",
  "projects in the portfolio",
);
const PROJECTS_NOTE = L("experiență aplicată", "прикладной опыт", "applied experience");

/** Metrics that don't come from the portfolio. `24/7` describes how the automations we
 *  build run, not a countable list, so it stays a fixed claim. The /02 stats are still
 *  blank placeholders (docs/06), so there is nothing real to read from the store here. */
const FIXED_METRICS: Metric[] = [
  {
    id: "automation",
    value: "24/7",
    label: L("automatizări active", "активных автоматизаций", "active automations"),
    note: L("mai puțină rutină", "меньше рутины", "less routine"),
  },
];

export function Hero() {
  const l = useLoc();
  const { projects } = useSiteContent();

  // Counted from the real portfolio the /04 grid renders — so the number the hero claims
  // and the number of cards below it can never drift apart. An empty portfolio shows no
  // counter at all rather than a bare "0".
  const metrics: Metric[] = [
    ...(projects.length > 0
      ? [
          {
            id: "projects",
            value: String(projects.length),
            label: PROJECTS_LABEL,
            note: PROJECTS_NOTE,
          },
        ]
      : []),
    ...FIXED_METRICS,
  ];

  return (
    <section id="top" className={styles.hero}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.copy}>
          <div className={`mono ${styles.eyebrow}`}>{l(EYEBROW)}</div>
          <h1 className={`disp ${styles.title}`}>{l(TITLE)}</h1>
          <p className={styles.lead}>{l(LEAD)}</p>
          <div className={styles.actions}>
            <a href="#contact" className={styles.primary}>
              {l(CTA_PRIMARY)}
            </a>
            <a href="#servicii" className={styles.textlink}>
              {l(CTA_SECONDARY)}
            </a>
          </div>
        </div>

        <div className={styles.metrics} aria-label={l(L("Indicatori", "Показатели", "Metrics"))}>
          {metrics.map((m) => (
            <div key={m.id} className={styles.metric}>
              <b className="disp">{m.value}</b>
              <span>{l(m.label)}</span>
              <small>{l(m.note)}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
