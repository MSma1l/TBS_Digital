"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";

import Link from "next/link";

import { useOffscreenAttribute } from "@/components/fx/useOffscreenAttribute";
import { navLinks } from "@/lib/content";
import type { SocialNetwork } from "@/lib/content";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { useSiteContent } from "@/lib/siteContent";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useLoc, type LocalizedText } from "@/lib/i18n/content";
import { splitLocalePath } from "@/lib/i18n/locales";
import { landAtTop } from "@/lib/landAtTop";
import { format } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/messages";
import { socialIcons, socialNames } from "@/components/ui/SocialIcons";
import { SiteLink } from "./SiteLink";
import styles from "./Footer.module.css";

/** Inline trilingual literal for the portfolio column (kept out of the catalog). */
const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

const PORTFOLIO_LABEL = L("PORTOFOLIU", "ПОРТФОЛИО", "PORTFOLIO");
/** The column's one link: the whole portfolio lives on /portofoliu. */
const ALL_PROJECTS = L("Proiectele TBS", "Проекты TBS", "TBS projects");

/** Where the portfolio link goes — the path, language prefix aside. */
const PORTFOLIO_PATH = "/portofoliu";

/**
 * The portfolio link lands at the top of /portofoliu (`landAtTop` — Next's own scroll stops at
 * y 71, animated, on this site), and on /portofoliu itself it scrolls up to it. A modified click
 * (new tab, new window) is left to the browser.
 */
function onPortfolioClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const { pathname } = window.location;
  if (splitLocalePath(pathname).rest !== PORTFOLIO_PATH) {
    landAtTop(pathname, PORTFOLIO_PATH);
    return;
  }
  event.preventDefault();
  window.scrollTo({ top: 0 });
}

/* Map each footer nav anchor to its catalog key — same hrefs the Navbar uses, so the
   two menus stay in lockstep. */
const NAV_KEY: Record<string, MessageKey> = {
  "/#servicii": "nav.services",
  "/#lucrari": "nav.work",
  "/#echipa": "nav.team",
  "#parteneri": "nav.partners",
  "/#despre": "nav.about",
};

/* Title-case a SHOUTED catalog label (SERVICII → Servicii) so the footer columns read
   as calm links, not headings. */
const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** The wordmark, three times over — see the stack in Footer.module.css. */
const WORDMARK = "TBS DIGITAL";

export function Footer() {
  const t = useT();

  /*
   * THE FOOTER LIGHTS ONCE, WHEN THE VISITOR REACHES IT.
   *
   * `data-armed` goes on at mount and is what holds the animated parts in their withheld pose —
   * written from an effect, so a visitor without JavaScript, or one whose bundle has not run yet,
   * is never left looking at a footer that is waiting for a signal that will not come.
   *
   * `data-entered` is a LATCH: a one-shot observer that unobserves itself, the same shape the
   * estimator's deck uses. Scrolling back up and down again shows nothing — an entrance that
   * replays every time the page bottom crosses the fold would be a tic, not an arrival. And with
   * no IntersectionObserver at all the footer is simply lit from the start, never half-built.
   */
  const footerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    el.setAttribute("data-armed", "");
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-entered", "");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-entered", "");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* And the one repeating thing here — the light that crosses the top edge — stops while the
     footer is not on screen. It is at the bottom of an 8900px page, so without this it would run
     unseen for nearly the whole visit. */
  useOffscreenAttribute(footerRef);

  /* Accessible name for a company social link, localized so a Russian/English visitor's
     screen reader never hears Romanian. The network name (LinkedIn, GitHub…) is a proper
     noun and stays as-is inside the translated frame. */
  const socialLabel = (type: SocialNetwork) =>
    type === "website"
      ? t("footer.social.websiteAria")
      : format(t("footer.social.networkAria"), { network: socialNames[type] });
  const l = useLoc();
  const { openRequest } = useRequestFlow();
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

  /*
   * `#contact` is the footer since 2026-10-09: it was the home page's closing call to action,
   * which went. The rail's "Contact" marker and any /#contact link now land on this card, with
   * the contacts in its brand block, on every page. The card rather than the contact list: on the
   * desktop windows the rail is drawn in, the list sits too low for the page to scroll it to the
   * top, so a jump to it would be a jump to the page's very end, and the rail's tick would sit
   * there whatever came above it.
   */
  return (
    <footer id="contact" className={styles.footer} ref={footerRef}>
      {/* The thread along the card's top edge: it draws itself out from the centre on arrival. */}
      <span className={styles.edge} aria-hidden="true">
        <span className={styles.spark} />
      </span>
      <div className={`container ${styles.inner}`}>
        <div className={styles.top}>
          {/* brand */}
          <div className={styles.brandCol}>
            <div className={`disp ${styles.brand}`}>
              TBS<span className={styles.dot}>.</span> DIGITAL
            </div>
            <p className={styles.brandText}>{t("footer.brandText")}</p>
            {/* The request, from the end of every page: the same shared dialog the hero and the
                header open, so a visitor who read to the bottom is one press from a price. Focus
                is handed back to this button explicitly: Safari does not focus a button on click,
                so the default (`document.activeElement` at the press) would be <body> there. */}
            <button
              type="button"
              className={styles.cta}
              onClick={(event) =>
                openRequest({ source: "footer", returnFocusTo: event.currentTarget })
              }
            >
              {t("footer.cta")}
            </button>
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

            {/*
              * THE CONTACTS MOVED UP HERE, out of the meta row.
              *
              * They were three items lost in a 12px grey line at the very bottom, and the brand
              * column below the social buttons was empty for its whole height — the taller
              * stacked middle track only made that hole more obvious. Address, phone and email
              * are the things a visitor comes to a footer FOR, so they now sit under the brand
              * they belong to, at a size that can be read.
              */}
            <ul className={styles.contacts}>
              {contacts.map((c) => {
                const href = contactHref(c.type, c.value);
                return (
                  <li key={c.id}>
                    {href ? (
                      <a href={href} className={styles.contact}>
                        {c.value}
                      </a>
                    ) : (
                      <span className={styles.contact}>{c.value}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/*
            * NAVIGATION AND PARTNERS SHARE ONE TRACK, AND THE PORTFOLIO GETS ITS OWN.
            *
            * The three columns run 5, 10 and 3 rows deep with the seeded content, and a grid row
            * is as tall as its tallest item — so on a phone the two-column reflow opened roughly
            * 220px of dead space under NAVIGARE and left a whole cell empty under PARTENERI.
            * Stacking the short two against the tall one makes it 8 against 10.
            */}
          <div className={styles.colStack}>
            {/* navigation */}
            <div className={styles.col}>
              <h4 className={`mono ${styles.colLabel}`} style={{ "--i": 1 } as CSSProperties}>
                {t("footer.col.nav")}
              </h4>
              <nav className={styles.colNav}>
                {navLinks.map((link) => {
                  const label = NAV_KEY[link.href]
                    ? t(NAV_KEY[link.href])
                    : link.label;
                  return (
                    <SiteLink key={link.href} href={link.href} className={styles.colLink}>
                      {titleCase(label)}
                    </SiteLink>
                  );
                })}
              </nav>
            </div>
            {/* partners — the header's "Parteneri" menu item lands here, because this is the
                only place partners actually render; there is no homepage partners section. */}
            <div className={styles.col} id="parteneri">
              <h4 className={`mono ${styles.colLabel}`} style={{ "--i": 2 } as CSSProperties}>
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

          {/* portfolio */}
          <div className={styles.col}>
            <h4 className={`mono ${styles.colLabel}`} style={{ "--i": 3 } as CSSProperties}>
              {l(PORTFOLIO_LABEL)}
            </h4>
            {/* One link, not a row per project (2026-10-03): the column listed the whole
                portfolio and grew with every project the admin added, so the list moved to
                its own page, /portofoliu, and the column points there. */}
            <nav className={styles.colNav}>
              <Link href={PORTFOLIO_PATH} scroll={false} onClick={onPortfolioClick} className={styles.colLink}>
                {l(ALL_PROJECTS)} →
              </Link>
            </nav>
          </div>
        </div>

        <div className={`mono ${styles.meta}`}>
          <span>
            {format(t("footer.copyright"), { year: new Date().getFullYear() })}
          </span>
          <span className={styles.metaLinks}>
            <Link href="/confidentialitate" className={styles.metaLink}>
              {t("footer.legal.privacy")}
            </Link>
            <Link href="/cookies" className={styles.metaLink}>
              {t("footer.legal.cookies")}
            </Link>
          </span>
        </div>
      </div>

      {/*
        * THE WORDMARK, IN TWO LAYERS.
        *
        * `.wordGhost` is the mark at rest — dim, and the one that sets the block's height.
        * `.wordWin` lies exactly over it holding the FULL-COLOUR copy, and is clipped to a window
        * that climbs out of the bottom edge on arrival while the copy inside it climbs the exact
        * opposite amount. The two cancel, so the letters never move a pixel: what travels is the
        * clip rectangle, and colour is dragged up through the word behind it.
        *
        * One `aria-hidden` for the whole subtree, so the brand name is announced once by the real
        * mark at the top of the footer and not three times here.
        */}
      <div className={styles.wordStack} aria-hidden="true">
        <div className={`disp ${styles.word} ${styles.wordGhost}`}>{WORDMARK}</div>
        <div className={styles.wordWin}>
          <div className={`disp ${styles.word} ${styles.wordLit}`}>{WORDMARK}</div>
        </div>
      </div>
    </footer>
  );
}
