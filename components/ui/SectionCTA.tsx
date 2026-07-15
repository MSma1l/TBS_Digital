"use client";

import { Reveal } from "@/components/ui/Reveal";
import { useT } from "@/lib/i18n/LanguageProvider";
import styles from "./SectionCTA.module.css";

/**
 * The "let's work together" call to action, repeated after each content block so a
 * visitor can start a conversation from wherever they stop reading (per the design
 * review). It scrolls to the contact/estimator section. `hue` picks which accent it
 * uses, so consecutive CTAs down the page don't all look identical.
 */
export function SectionCTA({ hue = "cyan" }: { hue?: "cyan" | "violet" | "amber" | "blue2" }) {
  const t = useT();
  return (
    <Reveal
      className={styles.wrap}
      style={{ ["--h" as string]: `var(--${hue})` }}
    >
      <p className={styles.lead}>{t("cta.lead")}</p>
      <a href="#contact" className={`mono ${styles.btn}`}>
        {t("cta.collaborate")}
      </a>
    </Reveal>
  );
}
