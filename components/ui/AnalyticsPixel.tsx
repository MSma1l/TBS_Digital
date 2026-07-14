"use client";

import { useEffect, useState } from "react";
import {
  CONSENT_EVENT,
  getConsent,
  type ConsentValue,
} from "@/lib/consent";

/**
 * The statistica.tbs.md analytics pixel, gated on cookie consent.
 *
 * The <script> is rendered ONLY once the visitor has accepted analytics cookies — before
 * that no `t.js` request and therefore no tracking beacon ever fires. React 19 hoists an
 * async `<script src>` into <head> and dedupes it, so mounting it here behaves the same as
 * the hand-written tag that used to live in the layout: the tracker still resolves its site
 * id from `document.currentScript`'s data-site and patches history for App Router SPA nav.
 *
 * The nonce is passed through from the (server) layout so the script satisfies the strict
 * CSP. It reacts live to the banner via the CONSENT_EVENT, so accepting loads the pixel with
 * no reload; a returning visitor who accepted previously gets it right after hydration.
 */
export function AnalyticsPixel({ nonce }: { nonce?: string }) {
  const [consent, setConsentState] = useState<ConsentValue | null>(null);

  useEffect(() => {
    // Intentional post-mount setState: consent lives in localStorage (client-only), so the
    // server renders no pixel and we read the real choice after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsentState(getConsent());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<ConsentValue>).detail;
      setConsentState(next ?? getConsent());
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  if (consent !== "accepted") return null;

  return (
    <script
      async
      nonce={nonce}
      src="https://statistica.tbs.md/px/t.js"
      data-site="6749e0d58765467495183773e68168a5"
    />
  );
}
