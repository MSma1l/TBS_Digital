"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LanguageProvider";
import { getConsent, setConsent } from "@/lib/consent";
import styles from "./CookieConsent.module.css";

/**
 * GDPR / Legea 133 cookie-consent banner.
 *
 * Shown at the bottom of the viewport until the visitor chooses. "Accept" allows the
 * analytics pixel; "Doar esențiale" (essential only) rejects it. The choice is persisted
 * via lib/consent (localStorage + cookie) and broadcast so <AnalyticsPixel> reacts live.
 *
 * Accessibility: a labelled dialog region, focus moved to it on show, Escape = essential
 * only (the privacy-preserving default), and reduced-motion honoured in CSS.
 */
export function CookieConsent() {
  // `null` until we've read storage on the client — avoids an SSR/first-paint flash of the
  // banner for visitors who already chose.
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    // Intentional post-mount setState: consent lives in localStorage (client-only), so the
    // server and first paint render nothing and we reveal the banner only after reading it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    if (getConsent() === null) setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) ref.current?.focus();
  }, [visible]);

  const choose = (value: "accepted" | "rejected") => {
    setConsent(value);
    setVisible(false);
  };

  if (!ready || !visible) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={t("cookie.policyLink")}
      tabIndex={-1}
      className={styles.banner}
      onKeyDown={(e) => {
        if (e.key === "Escape") choose("rejected");
      }}
    >
      <div className={styles.inner}>
        <p className={styles.text}>
          {t("cookie.text")}{" "}
          <Link href="/cookies" className={styles.link}>
            {t("cookie.policyLink")}
          </Link>
          .
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.reject}
            onClick={() => choose("rejected")}
          >
            {t("cookie.settings")}
          </button>
          <button
            type="button"
            className={styles.accept}
            onClick={() => choose("accepted")}
          >
            {t("cookie.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
