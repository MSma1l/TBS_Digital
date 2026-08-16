"use client";

import { useState, Fragment } from "react";
import { navMenu } from "@/lib/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PreferencesGroup } from "@/components/ui/PreferencesGroup";
import styles from "./Navbar.module.css";

/** Приводит подпись каталога к «Услуги» для крупных ссылок мобильного оверлея. */
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * Public navigation. It deliberately carries **no link to the admin panel**: the admin
 * reaches `/admin-tbs-digital` by typing the URL. A button here would have published the
 * admin's path in the markup of every page — handing it to anyone scraping the site.
 */
export function Navbar() {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <>
      <header className={styles.header}>
        <nav className={`container ${styles.nav}`}>
          <a href="#top" className={`disp ${styles.logo}`}>
            TBS<span className={styles.dot}>.</span>
          </a>

          <div className={`mono ${styles.desktop}`}>
            {navMenu.map((item, i) => (
              <Fragment key={item.href}>
                <div className={styles.item}>
                  <a
                    href={item.href}
                    className={styles.link}
                    aria-haspopup={item.children ? "true" : undefined}
                  >
                    {t(item.key)}
                    {item.children && (
                      <span className={styles.caret} aria-hidden>
                        ▾
                      </span>
                    )}
                  </a>

                  {item.children && (
                    <div className={styles.dropdown}>
                      {item.children.map((child) => (
                        <a
                          key={child.href}
                          href={child.href}
                          className={styles.dropItem}
                        >
                          {t(child.key)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {i < navMenu.length - 1 && <span className={styles.plus}>+</span>}
              </Fragment>
            ))}

            {/* Global preferences (language now, theme later) — one group, parked between
                the last nav link and the CTA. See PreferencesGroup for the theme slot. */}
            <PreferencesGroup />
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

          {navMenu.map((item) => (
            <div key={item.href} className={styles.overlayGroup}>
              <a
                href={item.href}
                onClick={close}
                className={`disp ${styles.overlayLink}`}
              >
                {cap(t(item.key))}
              </a>
              {item.children && (
                <div className={styles.overlaySub}>
                  {item.children.map((child) => (
                    <a
                      key={child.href}
                      href={child.href}
                      onClick={close}
                      className={`mono ${styles.overlaySubLink}`}
                    >
                      {t(child.key)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Same preferences group as the desktop bar, laid out as a full-width row. */}
          <PreferencesGroup layout="stack" />
          <a href="#contact" onClick={close} className={`mono ${styles.overlayCta}`}>
            {t("nav.cta")}
          </a>
        </div>
      )}
    </>
  );
}
