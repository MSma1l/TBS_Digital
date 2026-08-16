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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className={styles.photo}
                  />
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
