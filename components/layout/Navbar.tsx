"use client";

import { useRef, useState, Fragment, type ReactNode } from "react";
import Link from "next/link";
import { navMenu } from "@/lib/content";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useRequestFlow } from "@/lib/request/RequestFlowProvider";
import { PreferencesGroup } from "@/components/ui/PreferencesGroup";
import styles from "./Navbar.module.css";

/** Приводит подпись каталога к «Услуги» для крупных ссылок мобильного оверлея. */
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * A submenu entry. Since the Services submenu started pointing at the real
 * `/servicii/<slug>` pages, half these hrefs are routes and half are still same-page
 * anchors — so the element is chosen per href: `Link` for a route (client-side navigation
 * and prefetch), a plain anchor for a hash, which `Link` would only complicate.
 */
function NavChildLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return href.startsWith("/") ? (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

/**
 * Public navigation. It deliberately carries **no link to the admin panel**: the admin
 * reaches `/admin-tbs-digital` by typing the URL. A button here would have published the
 * admin's path in the markup of every page — handing it to anyone scraping the site.
 */
export function Navbar() {
  const t = useT();
  const { openRequest } = useRequestFlow();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  /* The burger is where focus came from when the overlay opened, and — unlike the overlay's
     own CTA — it is still in the DOM after the menu closes. It is therefore the element the
     shared dialog must hand focus back to when it was opened from inside the menu. */
  const burgerRef = useRef<HTMLButtonElement>(null);

  /**
   * The menu's CTA: close the menu first, then open the request dialog. Leaving the overlay
   * up would stack a full-screen menu behind the dialog and give the visitor two things to
   * dismiss.
   */
  const openFromMenu = () => {
    close();
    openRequest({ source: "navbar-menu", returnFocusTo: burgerRef.current });
  };

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
                        <NavChildLink
                          key={child.href}
                          href={child.href}
                          className={styles.dropItem}
                        >
                          {t(child.key)}
                        </NavChildLink>
                      ))}
                    </div>
                  )}
                </div>

                {i < navMenu.length - 1 && <span className={styles.plus}>+</span>}
              </Fragment>
            ))}
          </div>

          {/* The right-hand end of the bar, on EVERY screen size: global preferences
              (language + theme), then the red CTA, then the burger. Only the CTA and the
              burger swap in and out at 860px — the preferences group never does, which is
              what keeps the theme toggle visible on a phone instead of buried in the
              hamburger menu. Keeping the CTA as the group's next sibling also preserves
              the "preferences, then call to action" reading order everywhere. */}
          <div className={styles.actions}>
            <PreferencesGroup />
            {/* Opens the shared request dialog. It used to be an anchor to `#contact`;
                a control that scrolled the page *and* opened a dialog would be doing two
                things at once, so the anchor is gone and this is a real button. */}
            <button
              type="button"
              className={`mono ${styles.cta}`}
              onClick={() => openRequest({ source: "navbar" })}
            >
              {t("nav.cta")}
            </button>

            <button
              type="button"
              ref={burgerRef}
              className={styles.burger}
              aria-label={t("nav.burgerAria")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
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
                    <NavChildLink
                      key={child.href}
                      href={child.href}
                      onClick={close}
                      className={`mono ${styles.overlaySubLink}`}
                    >
                      {t(child.key)}
                    </NavChildLink>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* No preferences group here on purpose: language and theme now live in the bar
              at the top of every screen size, so repeating them inside the menu would put
              the same two controls on screen twice. The menu is navigation only. */}
          <button
            type="button"
            onClick={openFromMenu}
            className={`mono ${styles.overlayCta}`}
          >
            {t("nav.cta")}
          </button>
        </div>
      )}
    </>
  );
}
