import {
  navLinks,
  partners,
  footerServices,
  contact,
} from "@/lib/content";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        {/* partners */}
        <div className={styles.partnersBlock}>
          <div className={`mono ${styles.blockLabel}`}>
            PARTENERII NOȘTRI DE AFACERI
          </div>
          <div className={styles.partners}>
            {partners.map((p) => (
              <span key={p} className={`mono ${styles.partner}`}>
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* columns */}
        <div className={styles.columns}>
          <div className={styles.brandCol}>
            <div className={styles.brandRow}>
              <span className={styles.mark}>T</span>
              <span className={`mono ${styles.wordmark}`}>
                TBS<span className={styles.accent}>_DIGITAL</span>
              </span>
            </div>
            <p className={styles.brandText}>
              Digitalizăm afaceri prin software personalizat, aplicații mobile,
              automatizări și IA.
            </p>
            <div className={styles.socials}>
              <a href="#top" aria-label="Telegram" className={styles.social}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.9 4.3l-3.3 15.6c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.2 13 1.3 11.5c-1.1-.3-1.1-1 .2-1.5L20.6 2.8c.9-.3 1.7.2 1.3 1.5z" />
                </svg>
              </a>
              <a
                href={`mailto:${contact.email}`}
                aria-label="Email"
                className={styles.social}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <div className={`mono ${styles.colLabel}`}>NAVIGARE</div>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`mono ${styles.colLink}`}
              >
                {link.label.charAt(0) + link.label.slice(1).toLowerCase()}
              </a>
            ))}
          </div>

          <div>
            <div className={`mono ${styles.colLabel}`}>SERVICII</div>
            {footerServices.map((s) => (
              <a key={s} href="#servicii" className={`mono ${styles.colLink}`}>
                {s}
              </a>
            ))}
          </div>

          <div>
            <div className={`mono ${styles.colLabel}`}>CONTACT</div>
            <a
              href={`mailto:${contact.email}`}
              className={`mono ${styles.colLink}`}
            >
              {contact.email}
            </a>
            <a
              href={`tel:${contact.phone.replace(/\s/g, "")}`}
              className={`mono ${styles.colLink}`}
            >
              {contact.phone}
            </a>
            <a href="#contact" className={`mono ${styles.colLinkAccent}`}>
              Calculează prețul ↗
            </a>
          </div>
        </div>

        <div className={`mono ${styles.bottom}`}>
          <span>© 2026 TBS DIGITAL · TOATE DREPTURILE REZERVATE</span>
          <span>REALIZAT DE ECHIPA TBS DIGITAL</span>
        </div>
      </div>

      <div className={styles.marqueeWrap}>
        <div className={`hz ${styles.marquee}`}>
          <span className={`mono ${styles.marqueeText}`}>
            &gt; ACCESS GRANTED_
          </span>
        </div>
      </div>
    </footer>
  );
}
