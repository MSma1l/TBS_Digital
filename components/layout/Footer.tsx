"use client";

import { navLinks, footerServices } from "@/lib/content";
import type { SocialNetwork } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { socialIcons, socialNames } from "@/components/ui/SocialIcons";
import styles from "./Footer.module.css";

/* Accessible name for a company social link — the network is spelled out, so a screen
   reader announces "TBS Digital pe LinkedIn" rather than a bare "link". `socialNames`
   is shared with the team cards, where "website" means a member's personal site; for
   the company that reading is wrong, so it gets its own wording. */
const socialLabel = (type: SocialNetwork) =>
  type === "website"
    ? "Site-ul TBS Digital"
    : `TBS Digital pe ${socialNames[type]}`;

export function Footer() {
  const { partners, contacts, socials } = useSiteContent();
  const firstEmail = contacts.find((c) => c.type === "email")?.value;

  /* A social only exists once the owner pastes its URL in the admin. Until then the
     entry ships with url: "" and must not render — no dead links, no empty boxes. */
  const linkedSocials = socials.filter((s) => s.url.trim() !== "");

  const contactHref = (type: string, value: string) => {
    if (type === "email") return `mailto:${value}`;
    if (type === "phone") return `tel:${value.replace(/\s/g, "")}`;
    return undefined;
  };

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        {/* partners */}
        <div className={styles.partnersBlock}>
          <div className={`mono ${styles.blockLabel}`}>
            PARTENERII NOȘTRI DE AFACERI
          </div>
          <div className={styles.partners}>
            {partners.map((p) =>
              p.url ? (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mono ${styles.partner}`}
                >
                  {p.name}
                </a>
              ) : (
                <span key={p.id} className={`mono ${styles.partner}`}>
                  {p.name}
                </span>
              ),
            )}
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
              {linkedSocials.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabel(s.type)}
                  className={styles.social}
                >
                  {socialIcons[s.type]}
                </a>
              ))}
              <a
                href={firstEmail ? `mailto:${firstEmail}` : "#contact"}
                aria-label="Email"
                className={styles.social}
              >
                <svg
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
            {contacts.map((c) => {
              const href = contactHref(c.type, c.value);
              return href ? (
                <a key={c.id} href={href} className={`mono ${styles.colLink}`}>
                  {c.value}
                </a>
              ) : (
                <span key={c.id} className={`mono ${styles.colLink}`}>
                  {c.value}
                </span>
              );
            })}
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
