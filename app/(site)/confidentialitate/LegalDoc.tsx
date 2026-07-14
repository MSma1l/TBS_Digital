"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/locales";
import styles from "./LegalDoc.module.css";

/** One block inside a section: a paragraph or a bulleted list. */
export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = {
  heading: string;
  blocks: LegalBlock[];
};

/** A full policy document in one language. */
export type LegalContent = {
  /** Mono index label, e.g. "POLITICA DE CONFIDENȚIALITATE". */
  label: string;
  title: string;
  /** "Ultima actualizare: ..." line. */
  updated: string;
  /** Lead paragraph shown under the title. */
  intro: string;
  sections: LegalSection[];
};

/**
 * Renders a legal document (Privacy or Cookie policy) in the active language. The three
 * translations are passed in as `content` and picked by `useLanguage().locale`, so the
 * language switcher in the navbar swaps the whole document instantly, with no reload.
 */
export function LegalDoc({
  content,
}: {
  content: Record<Locale, LegalContent>;
}) {
  const { locale } = useLanguage();
  const doc = content[locale];

  return (
    <main className={styles.wrap}>
      {/* Rendered directly (not via the scroll-reveal wrapper) so a legal document is always
          readable — with JavaScript disabled, for crawlers, and before hydration. */}
      <article className="container">
        <header>
          <SectionLabel index="/§">{doc.label}</SectionLabel>
          <h1 className={`disp ${styles.title}`}>{doc.title}</h1>
          <p className={`mono ${styles.updated}`}>{doc.updated}</p>
          <p className={styles.intro}>{doc.intro}</p>
        </header>

        {doc.sections.map((section, i) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>
              <span className={`mono ${styles.num}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>
            {section.blocks.map((block, j) =>
              block.type === "p" ? (
                <p key={j} className={styles.p}>
                  {block.text}
                </p>
              ) : (
                <ul key={j} className={styles.list}>
                  {block.items.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
    </main>
  );
}
