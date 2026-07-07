"use client";

import { useState } from "react";
import { navLinks } from "@/lib/content";
import styles from "./Navbar.module.css";

export function Navbar() {
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
                  {link.label}
                </a>
                {i < navLinks.length - 1 && <span className={styles.plus}>+</span>}
              </span>
            ))}
            <a href="/admin-tbs-digital" className={`mono ${styles.admin}`}>
              ◆ ADMIN
            </a>
            <a href="#contact" className={`mono ${styles.cta}`}>
              START PROIECT ↗
            </a>
          </div>

          <button
            type="button"
            className={styles.burger}
            aria-label="Meniu"
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
            aria-label="Închide"
            onClick={close}
          >
            ×
          </button>
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={close}
              className={`disp ${styles.overlayLink}`}
            >
              {link.label.charAt(0) + link.label.slice(1).toLowerCase()}
            </a>
          ))}
          <a href="/admin-tbs-digital" onClick={close} className={`mono ${styles.overlayAdmin}`}>
            ◆ ADMIN — setează prețuri
          </a>
          <a href="#contact" onClick={close} className={`mono ${styles.overlayCta}`}>
            START PROIECT ↗
          </a>
        </div>
      )}
    </>
  );
}
