"use client";

import { useState } from "react";
import { navLinks } from "@/lib/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import styles from "./Navbar.module.css";

/* Map each nav anchor to its catalog key so the visible label is translated while the
   hrefs stay the single source of truth for order (services, work, team, partners, about). */
const NAV_KEY: Record<string, MessageKey> = {
  "#servicii": "nav.services",
  "#lucrari": "nav.work",
  "#echipa": "nav.team",
  "#parteneri": "nav.partners",
  "#despre": "nav.about",
};

/**
 * Public navigation. It deliberately carries **no link to the admin panel**: the admin
 * reaches `/admin-tbs-digital` by typing the URL. A button here would have published the
 * admin's path in the markup of every page, handing it to anyone scraping the site — and
 * it bought nothing, since a visitor has no use for it.
 */
export function Navbar() {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <>
      <header className={styles.header}>
        <nav className={`container ${styles.nav}`}>
          <a href="#top" className={styles.logo}>
            <span className={styles.mark}>T</span>
            <span className={`mono ${styles.wordmark}`}>
              TBS<span className={styles.accent}>_</span>
            </span>
          </a>

          <div className={`mono ${styles.desktop}`}>
            {navLinks.map((link, i) => (
              <span key={link.href} className={styles.linkWrap}>
                <a href={link.href} className={styles.link}>
                  {NAV_KEY[link.href] ? t(NAV_KEY[link.href]) : link.label}
                </a>
                {i < navLinks.length - 1 && <span className={styles.plus}>+</span>}
              </span>
            ))}
            <LanguageSwitcher />
            <a href="#contact" className={`mono ${styles.cta}`}>
              {t("nav.cta")}
            </a>
          </div>

          <button
            type="button"
            className={styles.burger}
            aria-label={t("nav.burgerAria")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </nav>
      </header>

      {menuOpen && (
        <div className={styles.overlay}>
          <button
            type="button"
            className={`mono ${styles.overlayClose}`}
            aria-label={t("nav.closeAria")}
            onClick={close}
          >
            ×
          </button>
          {navLinks.map((link) => {
            const label = NAV_KEY[link.href] ? t(NAV_KEY[link.href]) : link.label;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={close}
                className={`disp ${styles.overlayLink}`}
              >
                {label.charAt(0) + label.slice(1).toLowerCase()}
              </a>
            );
          })}
          <LanguageSwitcher />
          <a href="#contact" onClick={close} className={`mono ${styles.overlayCta}`}>
            {t("nav.cta")}
          </a>
        </div>
      )}
    </>
  );
}
