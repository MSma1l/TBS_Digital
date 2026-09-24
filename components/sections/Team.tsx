"use client";

import { Reveal } from "@/components/ui/Reveal";
import { mediaUrl } from "@/lib/api";
import { useSiteContent } from "@/lib/siteContent";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./Team.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const SECTION = {
  eyebrow: L("Echipa", "Команда", "Team"),
  title: L("Oamenii din spatele produsului.", "Люди за продуктом.", "The people behind the product."),
  lead: L(
    "O echipă mică și implicată, cu roluri reale — de la strategie la cod și testare.",
    "Небольшая вовлечённая команда с реальными ролями — от стратегии до кода и тестирования.",
    "A small, hands-on team with real roles — from strategy to code and testing.",
  ),
  label: L("ECHIPA TBS", "КОМАНДА TBS", "TBS TEAM"),
};

/*
 * The stat row is fed by the admin (`useSiteContent().stats`), not by literals.
 *
 * It used to hold three hardcoded claims: "50+ proiecte", "98% clienți mulțumiți" and
 * "24/7 automatizări online". The first contradicted the site itself — the hero counts the
 * real portfolio and shows 9 — and the other two are not measurable from anything we hold.
 * Rather than invent numbers, the row renders only stats that actually carry a value and
 * disappears entirely while there are none.
 */

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Team() {
  const { team, stats } = useSiteContent();

  /* A stat with no value is a placeholder the owner hasn't filled in yet — it must not
     render as an empty box. */
  const shownStats = stats.filter((s) => s.value.trim() !== "");
  const l = useLoc();


  return (
    <section id="echipa" className={styles.section}>
      {/*
       * The key and the tint, once for the whole section rather than once per card.
       *
       * The MATRIX is arithmetic, not taste. The alpha row is the luminance coefficients, so alpha
       * comes out as the picture's own lightness; the transfer below then inverts and thresholds
       * it into a silhouette. The colour rows are the same coefficients scaled by `--dark-cyan`'s
       * real channels (#4fc3e8 → 0.310, 0.765, 0.910) and a gain of 1.05, so he is painted in the
       * site's own cyan at his own lightness and nothing has to be picked by eye. The gain came
       * DOWN from 1.3: his jacket reads 0.90 and at 1.3 the blue channel went over 1 and clipped,
       * which turned the whole lower half of him a washed white instead of cyan.
       *
       * The TRANSFER is where the ground goes. Measured on the committed portrait, the ground he
       * was photographed on reads exactly 1.000 while his jacket peaks at 0.904 and his shirt at
       * 0.895 — so the table holds 1 all the way up to 0.90 and falls to 0 at 1.0, which keeps
       * every part of him and removes every part of the paper behind him.
       *
       * `color-interpolation-filters="sRGB"` because those measurements were taken in sRGB; the
       * SVG default is linearRGB and would put the threshold somewhere else entirely.
       */}
      <svg className={styles.defs} aria-hidden focusable="false">
        <filter id="tbs-holo-key" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.06916 0.23266 0.02349 0 0
                    0.17070 0.57426 0.05797 0 0
                    0.20309 0.68322 0.06897 0 0
                    0.21260 0.71520 0.07220 0 0"
          />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 0.55 0" />
          </feComponentTransfer>
        </filter>
      </svg>
      <div className="container">
        <Reveal className={styles.top}>
          <div>
            <div className={`mono ${styles.eyebrow}`}>{l(SECTION.eyebrow)}</div>
            <h2 className={`disp ${styles.title}`}>{l(SECTION.title)}</h2>
          </div>
          <p className={styles.lead}>{l(SECTION.lead)}</p>
        </Reveal>

        <div className={styles.grid}>
          {team.map((m) => {
            const name = typeof m.name === "string" ? m.name.trim() : "";
            const role = l(m.role);
            const stored = typeof m.photo === "string" ? m.photo.trim() : "";
            const photo = stored ? mediaUrl(stored) : "";
            return (
              <article key={m.id} className={styles.person}>
                <span className={`mono ${styles.personLabel}`}>{l(SECTION.label)}</span>
                {photo ? (
                  /*
                   * Projected, not printed. The photograph itself is still the only picture here
                   * and still carries the `alt` — everything holographic is a filter, a mask and
                   * two brief faults laid over it, so a reader, a crawler and a browser with the
                   * filter unsupported all get exactly what they got before.
                   */
                  <span className={styles.holo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className={styles.shot}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" aria-hidden loading="lazy" decoding="async" className={styles.tear} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo} alt="" aria-hidden loading="lazy" decoding="async" className={styles.beam} />
                  </span>
                ) : (
                  <span className={`disp ${styles.avatar}`} aria-hidden>
                    {initialsOf(name)}
                  </span>
                )}
                <h3 className={`disp ${styles.name}`}>{name}</h3>
                <p className={styles.role}>{role}</p>
              </article>
            );
          })}
        </div>

        {shownStats.length > 0 && (
          <div className={styles.stats}>
            {shownStats.map((s) => (
              <span key={s.id} className={styles.stat}>
                <b className="disp">{s.value}</b>
                {l(s.label)}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
