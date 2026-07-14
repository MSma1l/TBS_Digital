"use client";

import Link from "next/link";
import { navLinks, footerServices } from "@/lib/content";
import type { SocialNetwork } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { format } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import { socialIcons, socialNames } from "@/components/ui/SocialIcons";
import styles from "./Footer.module.css";

/* Map each footer nav anchor to its catalog key — same hrefs the Navbar uses, so the
   two menus stay in lockstep. */
const NAV_KEY: Record<string, MessageKey> = {
  "#servicii": "nav.services",
  "#lucrari": "nav.work",
  "#echipa": "nav.team",
  "#parteneri": "nav.partners",
  "#despre": "nav.about",
};

/* Accessible name for a company social link — the network is spelled out, so a screen
   reader announces "TBS Digital pe LinkedIn" rather than a bare "link". `socialNames`
   is shared with the team cards, where "website" means a member's personal site; for
   the company that reading is wrong, so it gets its own wording. */
const socialLabel = (type: SocialNetwork) =>
  type === "website"
    ? "Site-ul TBS Digital"
    : `TBS Digital pe ${socialNames[type]}`;

export function Footer() {
  const t = useT();
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
            {t("footer.partnersLabel")}
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
            <p className={styles.brandText}>{t("footer.brandText")}</p>
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
                aria-label={t("footer.social.emailAria")}
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
            <div className={`mono ${styles.colLabel}`}>{t("footer.col.nav")}</div>
            {navLinks.map((link) => {
              const label = NAV_KEY[link.href]
                ? t(NAV_KEY[link.href])
                : link.label;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`mono ${styles.colLink}`}
                >
                  {label.charAt(0) + label.slice(1).toLowerCase()}
                </a>
              );
            })}
          </div>

          <div>
            <div className={`mono ${styles.colLabel}`}>
              {t("footer.col.services")}
            </div>
            {footerServices.map((s, i) => (
              <a key={s} href="#servicii" className={`mono ${styles.colLink}`}>
                {t(`footer.services.${i}` as MessageKey)}
              </a>
            ))}
          </div>

          <div>
            <div className={`mono ${styles.colLabel}`}>
              {t("footer.col.contact")}
            </div>
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
              {t("footer.cta")}
            </a>
            <Link href="/confidentialitate" className={`mono ${styles.colLink}`}>
              {t("footer.legal.privacy")}
            </Link>
            <Link href="/cookies" className={`mono ${styles.colLink}`}>
              {t("footer.legal.cookies")}
            </Link>
          </div>
        </div>

        <div className={`mono ${styles.bottom}`}>
          <span>{format(t("footer.copyright"), { year: new Date().getFullYear() })}</span>
          <span>{t("footer.madeBy")}</span>
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
