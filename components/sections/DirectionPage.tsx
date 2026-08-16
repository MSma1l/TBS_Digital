"use client";

import Link from "next/link";
import { RequestModal } from "./RequestModal";
import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc } from "@/lib/i18n/content";
import { directions } from "@/lib/directions";
import { solutions, solUI, solutionPalette, projectsForSolution } from "@/lib/solutions";
import { useSiteContent, type ProjectItem } from "@/lib/siteContent";
import styles from "./DirectionPage.module.css";

/** "CRM PRIVAT · FĂRĂ LINK" → ["CRM PRIVAT", "FĂRĂ LINK"] — the tag is free localized
 *  text, so its segments are the only tag-like data a project actually carries. */
function tagChips(tag: string): string[] {
  return tag
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * A single direction page. Filled directions render the full layout; the rest show a
 * short placeholder until we build them out.
 *
 * This page — not the home-page selector — owns the commercial actions: an action bar
 * directly under the hero with the request flow (carrying this service), the direction's
 * real projects, and the reference project's link when there is one to give.
 */
export function DirectionPage({ slug }: { slug: string }) {
  const t = useT();
  const l = useLoc();
  const { projects } = useSiteContent();
  const sol = solutions[slug];

  /* Real portfolio entries for this direction, in the curated order from lib/solutions.ts.
     Empty for a direction we have not shipped work on yet — the projects section and the
     action that scrolls to it then do not render at all, rather than pointing at nothing. */
  const related = projectsForSolution<ProjectItem>(slug, projects);
  const reference = related[0];
  /* The /NN label matches the position on the home-page portfolio grid. */
  const refNumber = reference
    ? String(projects.findIndex((p) => p.id === reference.id) + 1).padStart(2, "0")
    : "";
  const palette = solutionPalette[slug];

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
      style={
        {
          "--sol-accent": sol.accent ?? "var(--blue)",
          "--sol-p1": palette?.p1,
          "--sol-p2": palette?.p2,
        } as CSSProperties
      }
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
          </div>

          <div className={styles.visual}>
            {reference ? (
              /* The hero card is a REAL project: the direction's reference entry, with its
                 own screenshot, category chips and portfolio number. */
              <article className={styles.refCard}>
                <div className={`mono ${styles.refTop}`}>
                  <span>{l(solUI.refLabel)}</span>
                  <b>{refNumber}</b>
                </div>
                {reference.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={reference.images[0]}
                    alt={reference.name}
                    loading="lazy"
                    className={styles.refImage}
                  />
                ) : null}
                <strong className={`disp ${styles.refName}`}>{reference.name}</strong>
                <span className={styles.refText}>{l(reference.desc)}</span>
                <div className={`mono ${styles.refTags}`}>
                  {tagChips(l(reference.tag)).map((chip) => (
                    <span key={chip}>{chip}</span>
                  ))}
                </div>
              </article>
            ) : (
              /* No shipped project on this direction — the card describes the OFFER instead
                 of borrowing a project that belongs somewhere else. When the direction
                 carries a flow (e-commerce: offer → payment → access), the card draws that
                 flow as a scheme: no project name, no external link, nothing implied. */
              <article className={styles.refCard}>
                <div className={`mono ${styles.refTop}`}>
                  <span>{l(sol.cardLabel)}</span>
                </div>
                <strong className={`disp ${styles.refName}`}>{l(sol.cardTitle)}</strong>
                <span className={styles.refText}>{l(sol.cardText)}</span>
                {sol.flow?.length ? (
                  <ol className={styles.flow}>
                    {sol.flow.map((step, i) => (
                      <li key={i}>
                        <b className="mono">{String(i + 1).padStart(2, "0")}</b>
                        <span>{l(step)}</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            )}
          </div>
        </section>

        {/* ---- action bar: everything the visitor can DO with this service ---- */}
        <div className={styles.actions}>
          {/* Opens the real request flow in a dialog, with this service preselected, so the
              visitor is not thrown back to the home page mid-read. */}
          <RequestModal
            serviceSlug={slug}
            label={l(solUI.actionTalk)}
            className={styles.cta}
          />

          {related.length > 0 && (
            <a href="#proiecte" className={styles.ghost}>
              {l(solUI.actionProjects)}
            </a>
          )}

          {reference &&
            (reference.url ? (
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.textLink}
              >
                {l(solUI.actionProject)}
              </a>
            ) : (
              /* A private client system has no public URL — it is stated as text, never
                 rendered as a link that goes nowhere. */
              <span className={styles.noLink}>
                {reference.name} — {l(solUI.actionProjectPrivate)}
              </span>
            ))}
        </div>

        <section className={styles.highlights}>
          {sol.items.map((it, i) => (
            <article key={i} className={styles.highlight}>
              <b className="mono">{l(solUI.benefit)}</b>
              <h2>{l(it.title)}</h2>
              <p>{l(it.desc)}</p>
            </article>
          ))}
        </section>

        {/* ---- labelled cases ----
            Each one is a piece of work that really exists, described with what it actually
            does. A case gets a link only when there is a public page behind it; our own
            internal flow has none, so it is named as ours and left without one. */}
        {sol.cases && (
          <section className={styles.cases}>
            <div className={styles.casesTop}>
              <h2 className="disp">{l(sol.cases.title)}</h2>
              <p>{l(sol.cases.lead)}</p>
            </div>
            <div className={styles.caseGrid}>
              {sol.cases.items.map((c) => (
                <article key={c.name} className={styles.caseCard}>
                  <b className={`mono ${styles.caseLabel}`}>{l(c.label)}</b>
                  <h3 className={`disp ${styles.caseName}`}>{c.name}</h3>
                  <p className={styles.caseText}>{l(c.text)}</p>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.caseLink}
                    >
                      {l(solUI.caseLink)}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section id="proiecte" className={styles.projects}>
            <div className={styles.projectsTop}>
              <h2 className="disp">{l(solUI.projectsTitle)}</h2>
              <p>{l(solUI.projectsLead)}</p>
            </div>
            <div className={styles.projectGrid}>
              {related.map((p) => {
                const inner = (
                  <>
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        loading="lazy"
                        className={styles.projectImage}
                      />
                    ) : null}
                    <small className={`mono ${styles.projectTag}`}>{l(p.tag)}</small>
                    <h3 className={`disp ${styles.projectName}`}>{p.name}</h3>
                    <p className={styles.projectDesc}>{l(p.desc)}</p>
                  </>
                );
                /* Same rule as the /04 grid: only a project with a real link becomes an
                   <a>; the rest are plain articles. */
                return p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.project}
                  >
                    {inner}
                  </a>
                ) : (
                  <article key={p.id} className={styles.project}>
                    {inner}
                  </article>
                );
              })}
            </div>
          </section>
        )}

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
          <RequestModal
            serviceSlug={slug}
            label={l(solUI.start)}
            className={styles.cta}
          />
        </section>
      </div>
    </div>
  );
}
