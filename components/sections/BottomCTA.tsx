"use client";

import { Reveal } from "@/components/ui/Reveal";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import styles from "./BottomCTA.module.css";

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const COPY = {
  title: L(
    "Ai un proiect care merită construit corect?",
    "Есть проект, который стоит сделать правильно?",
    "Got a project worth building right?",
  ),
  lead: L(
    "Spune-ne unde vrei să ajungi. Începem cu o conversație de 30 de minute.",
    "Расскажите, куда хотите прийти. Начнём с 30-минутного разговора.",
    "Tell us where you want to go. We start with a 30-minute conversation.",
  ),
  cta: L("Programează consultarea", "Записаться на консультацию", "Book a consultation"),
};

export function BottomCTA() {
  const l = useLoc();

  return (
    <section id="contact" className={styles.section}>
      <div className="container">
        <Reveal className={styles.inner}>
          <div>
            <h2 className={`disp ${styles.title}`}>{l(COPY.title)}</h2>
            <p className={styles.lead}>{l(COPY.lead)}</p>
          </div>
          <a href="#estimare" className={styles.cta}>
            {l(COPY.cta)}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
