"use client";

import { useEffect, useState } from "react";
import {
  CONSENT_EVENT,
  getConsent,
  type ConsentValue,
} from "@/lib/consent";

const PIXEL_SRC = "https://statistica.tbs.md/px/t.js";
const SITE_ID = "6749e0d58765467495183773e68168a5";

/**
 * The statistica.tbs.md analytics pixel, gated on cookie consent.
 *
 * The tracker (`t.js`) reads its site id from the SCRIPT ELEMENT that loaded it, via
 * `document.currentScript`. That is the whole reason this injects the script imperatively
 * instead of rendering a JSX `<script async>`: for an **async** script `document.currentScript`
 * is `null`, so `t.js` would fall back to "the last <script> on the page" — which in a Next.js
 * app is a framework chunk, not our pixel, so `data-site` comes back empty and the tracker
 * silently records nothing. Creating the element with `async = false` makes
 * `document.currentScript` resolve to exactly this script, so `data-site` is read correctly.
 *
 * The nonce from the (server) layout is copied onto the element so it satisfies the strict
 * CSP; under `strict-dynamic` a script inserted by our trusted bundle is allowed to load the
 * cross-origin tracker. The script is injected only once consent === "accepted" — before that
 * no request to the tracker host ever fires — and it reacts live to the banner, so accepting
 * loads it with no reload.
 */
export function AnalyticsPixel({ nonce }: { nonce?: string }) {
  const [consent, setConsentState] = useState<ConsentValue | null>(null);

  useEffect(() => {
    // Consent lives in localStorage (client-only), so read it after mount and then track
    // the banner's live changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsentState(getConsent());
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<ConsentValue>).detail;
      setConsentState(next ?? getConsent());
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (consent !== "accepted") return;
    // Guard against a double insert (StrictMode double-effect, or consent re-fired).
    if (document.querySelector(`script[data-tbs-pixel]`)) return;

    const script = document.createElement("script");
    script.src = PIXEL_SRC;
    script.dataset.site = SITE_ID;
    script.dataset.tbsPixel = "1";
    // The crux: a non-async script sets document.currentScript during execution, so t.js
    // reads THIS element's data-site (not some Next.js chunk). It still loads off the main
    // thread — a dynamically inserted script never blocks parsing.
    script.async = false;
    if (nonce) script.nonce = nonce;
    document.head.appendChild(script);
  }, [consent, nonce]);

  return null;
}
