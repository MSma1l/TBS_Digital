"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { partnershipEmail } from "@/lib/content";
import { mediaUrl } from "@/lib/api";
import { useSiteContent } from "@/lib/siteContent";
import type { PartnerItem } from "@/lib/siteContent";
import styles from "./Partners.module.css";

/**
 * Website preview shot for a partner (`/partners/previews/…`), or "" when the
 * partner has none — those cards keep rendering exactly as they did before.
 * Read defensively so the section survives content served by an older backend
 * that predates the `preview` field.
 */
function previewOf(p: PartnerItem): string {
  return "preview" in p && typeof p.preview === "string" ? p.preview : "";
}

export function Partners() {
  const { partners } = useSiteContent();

  return (
    <section id="parteneri" className="section">
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/06">PARTENERII NOȘTRI</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            Creștem
            <br />
            împreună
          </h2>
          <p className={styles.lead}>
            Lucrăm alături de companii care țin la aceleași standarde ca noi — în
            audit, consultanță și educație în afaceri. Ei aduc încrederea
            clienților lor, noi aducem partea tehnică.
          </p>
        </Reveal>

        <div className={styles.logos}>
          {partners.map((p) => {
            const logo = mediaUrl(p.logo);
            const preview = mediaUrl(previewOf(p));
            // A partner with no link is still shown — just not clickable.
            const Card = p.url ? "a" : "div";
            return (
              <Reveal key={p.id} className={styles.logoCell}>
                <Card
                  className={`${styles.logoCard} ${
                    preview ? styles.hasPreview : ""
                  }`}
                  {...(p.url
                    ? {
                        href: p.url,
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                >
                  {preview ? (
                    <span className={styles.preview} aria-hidden="true">
                      {/* Decorative: the card already announces the partner by
                          name, so an alt here would only double-read. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt=""
                        loading="lazy"
                        className={styles.previewImg}
                      />
                    </span>
                  ) : null}

                  <span className={styles.face}>
                    {logo ? (
                      // Plain <img>: logos are admin-supplied, of arbitrary aspect
                      // ratio, and may be served from the backend origin — next/image
                      // would need a remotePatterns entry per deploy host to optimise
                      // them, for assets already only a few KB.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={p.name}
                        loading="lazy"
                        className={styles.logo}
                      />
                    ) : (
                      <span className={`disp ${styles.wordmark}`}>{p.name}</span>
                    )}
                    <span className={`mono ${styles.partnerName}`}>
                      {p.name}
                    </span>
                  </span>
                </Card>
              </Reveal>
            );
          })}
        </div>

        <Reveal className={styles.cta}>
          <div className={styles.ctaBody}>
            <div className={`mono ${styles.ctaLabel}`}>DEVINO PARTENER</div>
            <h3 className={`disp ${styles.ctaTitle}`}>
              Și tu poți deveni partener
            </h3>
            <p className={styles.ctaText}>
              Lucrezi zi de zi cu antreprenori și vezi, înaintea tuturor, unde se
              blochează o afacere. Noi construim partea tehnică — software,
              automatizări, inteligență artificială — iar tu rămâi omul în care
              clientul are încredere. Fără birocrație și fără angajamente: ne
              scrii, ne auzim, și stabilim împreună cum arată colaborarea.
            </p>
          </div>
          <a
            href={`mailto:${partnershipEmail}`}
            className={`mono ${styles.ctaBtn}`}
          >
            {partnershipEmail} ↗
          </a>
        </Reveal>

        <div className={`hz ${styles.stripes}`} aria-hidden />
      </div>
    </section>
  );
}
