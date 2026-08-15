"use client";

import { Reveal } from "@/components/ui/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { iconFor } from "@/components/ui/ServiceIcons";
import { useSiteContent } from "@/lib/siteContent";
import { requestEstimate } from "@/lib/estimatorBridge";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc } from "@/lib/i18n/content";
import { format, Multiline } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import styles from "./Services.module.css";

/**
 * The /03 grid is four category panels laid out 2×2. Each panel owns the anchor id that
 * the navbar "Услуги" dropdown scrolls to, a title (reusing the dropdown's catalog keys so
 * a rename stays in sync), and the ordered service ids it holds. A service id not listed
 * here simply won't appear on the grid; `ai` is intentionally left out (estimator-only).
 */
const CATEGORIES: { anchor: string; titleKey: MessageKey; ids: string[] }[] = [
  { anchor: "servicii-web", titleKey: "nav.services.web", ids: ["landing", "site", "shop"] },
  { anchor: "servicii-apps", titleKey: "nav.services.apps", ids: ["mobile", "saas"] },
  { anchor: "servicii-automation", titleKey: "nav.services.automation", ids: ["automation", "dashboard", "bot"] },
  { anchor: "servicii-custom", titleKey: "nav.services.custom", ids: ["crm", "custom"] },
];

export function Services() {
  const { services } = useSiteContent();
  const t = useT();
  const l = useLoc();
  const byId = new Map(services.map((s) => [s.id, s]));

  return (
    <section id="servicii" className="section">
      <div className="container">
        <Reveal className={styles.head}>
          <SectionLabel index="/02">{t("services.label")}</SectionLabel>
          <h2 className={`disp ${styles.title}`}>
            <Multiline text={t("services.title")} />
          </h2>
          <p className={styles.lead}>{t("services.lead")}</p>
        </Reveal>

        <div className={styles.quadrants}>
          {CATEGORIES.map((cat, ci) => (
            <Reveal key={cat.anchor} id={cat.anchor} className={styles.panel}>
              <div className={styles.panelHead}>
                <span className={`mono ${styles.panelNum}`}>
                  /{String(ci + 1).padStart(2, "0")}
                </span>
                <h3 className={`mono ${styles.panelTitle}`}>{t(cat.titleKey)}</h3>
              </div>

              <div className={styles.services}>
                {cat.ids.map((id) => {
                  const s = byId.get(id);
                  if (!s) return null;
                  const name = l(s.name);
                  return (
                    <button
                      key={id}
                      type="button"
                      className={styles.service}
                      onClick={() => requestEstimate(id)}
                      aria-label={format(t("services.card.estimateAria"), { name })}
                    >
                      <span className={styles.icon}>{iconFor(id)}</span>
                      <span className={styles.serviceText}>
                        <span className={`mono ${styles.name}`}>{name}</span>
                        <span className={styles.desc}>{l(s.desc)}</span>
                        <span className={`mono ${styles.cta}`} aria-hidden>
                          {t("services.card.cta")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
