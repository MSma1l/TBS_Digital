"use client";

import { type CSSProperties } from "react";
import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import styles from "./Work.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  eyebrow: L("Portofoliu TBS", "Портфолио TBS", "TBS portfolio"),
  title: L("Proiectele care ne reprezintă.", "Проекты, которые говорят за нас.", "The projects that speak for us."),
  lead: L(
    "De la platforme web la aplicații mobile — produse duse până la lansare.",
    "От веб-платформ до мобильных приложений — продукты, доведённые до запуска.",
    "From web platforms to mobile apps — products taken all the way to launch.",
  ),
};

/* ---------- Card gradients ----------
   Presentation only, so it stays in the component: the *content* (names, tags,
   descriptions, links, screenshots) comes from the store, while each card's brand colours
   are part of this section's design. Keyed by project id so a card keeps its colours no
   matter where it lands in the order. A project the admin adds — or one whose screenshot is
   missing — falls back to a palette entry picked by position, so it is still a finished
   coloured card, never an empty box. */
const GRADIENTS: Record<string, readonly [string, string]> = {
  bizcheck: ["#192f6f", "#4b7dff"],
  "itara-global": ["#173b3d", "#10a99b"],
  docusafe: ["#6d2348", "#e5527d"],
  "crowe-portal": ["#1b2a52", "#3f63d8"],
  cgam: ["#53397d", "#9671dd"],
  "iq-arena": ["#734328", "#e38a4f"],
  "balloons-breeze": ["#3a1c10", "#b3801f"],
  "statistica-md": ["#0d3a7a", "#1f6fd0"],
  statistic: ["#0f2a52", "#3f7fe0"],
  flirt: ["#1a0510", "#ff2d78"],
};

const FALLBACK_GRADIENTS: readonly (readonly [string, string])[] = [
  ["#192f6f", "#4b7dff"],
  ["#173b3d", "#10a99b"],
  ["#53397d", "#9671dd"],
  ["#734328", "#e38a4f"],
  ["#6d2348", "#e5527d"],
];

function gradientFor(project: ProjectItem, position: number): readonly [string, string] {
  return (
    GRADIENTS[project.id] ??
    FALLBACK_GRADIENTS[position % FALLBACK_GRADIENTS.length]
  );
}

export function Work() {
  const l = useLoc();
  const { projects } = useSiteContent();

  return (
    <section id="lucrari" className={styles.section}>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        <div className={styles.grid}>
          {projects.map((p, i) => {
            const [p1, p2] = gradientFor(p, i);
            const style = { "--p1": p1, "--p2": p2 } as CSSProperties;
            // The /NN label is computed from position, so adding or removing a project
            // from the admin renumbers the grid automatically.
            const index = String(i + 1).padStart(2, "0");
            // The card shows the first screenshot; the rest of the gallery stays in the
            // data. With none set the gradient above carries the card on its own.
            const image = p.images?.[0];
            const inner = (
              <>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={p.name}
                    loading="lazy"
                    // Nine screenshots land in this grid. `decoding="async"` lets the
                    // browser decode them off the main thread instead of blocking it at
                    // paint time; the card is unaffected either way — the image is
                    // `position: absolute; inset: 0` behind the copy, so it never takes
                    // part in layout and cannot shift anything while it loads.
                    decoding="async"
                    className={styles.image}
                  />
                ) : null}
                <span className={`disp ${styles.index}`} aria-hidden>
                  {index}
                </span>
                <small className={`mono ${styles.tag}`}>{l(p.tag)}</small>
                <h3 className={`disp ${styles.name}`}>{p.name}</h3>
                <p className={styles.desc}>{l(p.desc)}</p>
              </>
            );
            // Only a project with a real link becomes an <a> — an empty url would
            // otherwise ship a link that goes nowhere.
            return p.url ? (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.project}
                style={style}
              >
                {inner}
              </a>
            ) : (
              <article key={p.id} className={styles.project} style={style}>
                {inner}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
