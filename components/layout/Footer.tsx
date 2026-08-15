"use client";

import Link from "next/link";
import { navLinks } from "@/lib/content";
import type { SocialNetwork } from "@/lib/content";
import { useSiteContent } from "@/lib/siteContent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { format } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import { socialIcons, socialNames } from "@/components/ui/SocialIcons";
import styles from "./Footer.module.css";

/** Inline trilingual literal for the portfolio column (kept out of the catalog). */
const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const PORTFOLIO_LABEL = L("PORTOFOLIU", "ПОРТФОЛИО", "PORTFOLIO");
const PORTFOLIO: { label: LocalizedText; href: string; external?: boolean }[] = [
  { label: L("Proiectele TBS", "Проекты TBS", "TBS projects"), href: "#lucrari" },
  { label: L("BizCheck", "BizCheck", "BizCheck"), href: "https://bizcheck.md", external: true },
  { label: L("Itara Global", "Itara Global", "Itara Global"), href: "https://itara-global.md", external: true },
];

/* Map each footer nav anchor to its catalog key — same hrefs the Navbar uses, so the
   two menus stay in lockstep. */
const NAV_KEY: Record<string, MessageKey> = {
  "#servicii": "nav.services",
  "#lucrari": "nav.work",
  "#echipa": "nav.team",
  "#parteneri": "nav.partners",
  "#despre": "nav.about",
};

/* Title-case a SHOUTED catalog label (SERVICII → Servicii) so the footer columns read
   as calm links, not headings. */
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function Footer() {
  const t = useT();

  /* Accessible name for a company social link, localized so a Russian/English visitor's
     screen reader never hears Romanian. The network name (LinkedIn, GitHub…) is a proper
     noun and stays as-is inside the translated frame. */
  const socialLabel = (type: SocialNetwork) =>
    type === "website"
      ? t("footer.social.websiteAria")
      : format(t("footer.social.networkAria"), { network: socialNames[type] });
  const l = useLoc();
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
        <div className={styles.top}>
          {/* brand */}
          <div className={styles.brandCol}>
            <div className={`disp ${styles.brand}`}>
              TBS<span className={styles.dot}>.</span> DIGITAL
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

          {/* navigation */}
          <div className={styles.col}>
            <h4 className={`mono ${styles.colLabel}`}>{t("footer.col.nav")}</h4>
            <nav className={styles.colNav}>
              {navLinks.map((link) => {
                const label = NAV_KEY[link.href]
                  ? t(NAV_KEY[link.href])
                  : link.label;
                return (
                  <a key={link.href} href={link.href} className={styles.colLink}>
                    {titleCase(label)}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* portfolio */}
          <div className={styles.col}>
            <h4 className={`mono ${styles.colLabel}`}>{l(PORTFOLIO_LABEL)}</h4>
            <nav className={styles.colNav}>
              {PORTFOLIO.map((p) =>
                p.external ? (
                  <a
                    key={p.href}
                    href={p.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.colLink}
                  >
                    {l(p.label)} ↗
                  </a>
                ) : (
                  <a key={p.href} href={p.href} className={styles.colLink}>
                    {l(p.label)}
                  </a>
                ),
              )}
            </nav>
          </div>

          {/* partners */}
          <div className={styles.col}>
            <h4 className={`mono ${styles.colLabel}`}>
              {t("footer.partnersLabel")}
            </h4>
            <nav className={styles.colNav}>
              {partners.map((p) =>
                p.url ? (
                  <a
                    key={p.id}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.colLink}
                  >
                    {p.name} ↗
                  </a>
                ) : (
                  <span key={p.id} className={styles.colLink}>
                    {p.name}
                  </span>
                ),
              )}
            </nav>
          </div>
        </div>

        <div className={`mono ${styles.meta}`}>
          <span>
            {format(t("footer.copyright"), { year: new Date().getFullYear() })}
          </span>
          <span className={styles.metaLinks}>
            {contacts.map((c) => {
              const href = contactHref(c.type, c.value);
              return href ? (
                <a key={c.id} href={href} className={styles.metaLink}>
                  {c.value}
                </a>
              ) : (
                <span key={c.id} className={styles.metaLink}>
                  {c.value}
                </span>
              );
            })}
            <Link href="/confidentialitate" className={styles.metaLink}>
              {t("footer.legal.privacy")}
            </Link>
            <Link href="/cookies" className={styles.metaLink}>
              {t("footer.legal.cookies")}
            </Link>
          </span>
        </div>
      </div>

      <div className={`disp ${styles.word}`} aria-hidden="true">
        TBS DIGITAL
      </div>
    </footer>
  );
}
