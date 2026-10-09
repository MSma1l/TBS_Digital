"use client";

import { useId, type MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { mediaUrl } from "@/lib/api";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { landAtTop } from "@/lib/landAtTop";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent } from "@/lib/siteContent";
import styles from "./WorkProof.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  line: L(
    "Platforme, aplicații și sisteme interne — de la portaluri pentru o firmă de audit la aplicații pentru evenimente.",
    "Платформы, приложения и внутренние системы — от порталов для аудиторской компании до приложений для мероприятий.",
    "Platforms, apps and internal systems — from portals for an audit firm to apps for events.",
  ),
  similar: L("Vreau un proiect similar", "Хочу похожий проект", "I want a similar project"),
  /* Its "→" is drawn beside the words, aria-hidden, so the link is announced by its words alone
     (the same split as the service link at the close of /portofoliu). */
  allProjects: L("Vezi toate proiectele", "Все проекты", "See all projects"),
  partners: L("Lucrăm alături de", "Мы работаем с", "We work with"),
};

/** Where "see all projects" goes — the bare path, as the footer's portfolio link has it. */
const PORTFOLIO_PATH = "/portofoliu";

/**
 * The link lands at the top of /portofoliu, the way the footer's does: Next's own scroll stops at
 * y 71 on this site, animated, so the `Link` turns it off and `landAtTop` puts the new page at 0
 * on its first frame. A modified click (new tab, new window) is left to the browser.
 */
function onPortfolioClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  landAtTop(window.location.pathname, PORTFOLIO_PATH);
}

/**
 * The proof under the home page's projects: one line on what they are, the two ways on from them
 * — a request for one like them, the whole portfolio — and the partners we work with.
 *
 * Outside the interior stage (app/(site)/page.tsx), so the scene measures nothing in here. It
 * closes the projects rather than opening a section of its own, so it has no heading and no
 * index, and it is not a stop on the scroll rail (whose home sections are a curated list).
 */
export function WorkProof() {
  const l = useLoc();
  const { openRequest } = useRequestFlow();
  // Admin data: a partner with neither a logo nor a name would be an empty box.
  const partners = useSiteContent().partners.filter((p) => p.logo || p.name);
  const partnersLabelId = useId();

  return (
    <section className={styles.section}>
      <div className="container">
        <Reveal className={styles.inner}>
          <p className={styles.line}>{l(COPY.line)}</p>

          <div className={styles.actions}>
            {/* `returnFocusTo`: Safari does not focus a button it clicks, so "whatever had focus"
                would be <body> and the dialog would have nowhere to hand focus back to. */}
            <button
              type="button"
              className={styles.cta}
              onClick={(event) => openRequest({ source: "home-work", returnFocusTo: event.currentTarget })}
            >
              {l(COPY.similar)}
            </button>
            <Link href={PORTFOLIO_PATH} scroll={false} onClick={onPortfolioClick} className={styles.more}>
              {l(COPY.allProjects)}
              <span className={styles.arrow} aria-hidden="true">
                →
              </span>
            </Link>
          </div>

          {partners.length > 0 ? (
            <div className={styles.partners}>
              <p id={partnersLabelId} className={`mono ${styles.partnersLabel}`}>
                {l(COPY.partners)}
              </p>
              <ul className={styles.logos} aria-labelledby={partnersLabelId}>
                {partners.map((p) => {
                  const logo = mediaUrl(p.logo);
                  const face = logo ? (
                    // Plain <img>, as in Partners.tsx: admin logos have any aspect ratio and may
                    // come from the backend origin, which next/image would need a remotePatterns
                    // entry per deploy host to optimise.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={p.name} loading="lazy" decoding="async" className={styles.logo} />
                  ) : (
                    <span className={`disp ${styles.name}`}>{p.name}</span>
                  );
                  return (
                    <li key={p.id} className={styles.item}>
                      {/* Only a partner with a site is a link — the footer's rule: no link to nowhere. */}
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className={styles.tile}>
                          {face}
                        </a>
                      ) : (
                        <span className={styles.tile}>{face}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
