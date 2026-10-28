"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LanguageProvider";
import { getConsent, setConsent } from "@/lib/consent";

/**
 * GDPR / Legea 133 cookie-consent banner.
 *
 * Shown at the bottom of the viewport until the visitor chooses. "Accept" allows the
 * analytics pixel; "Doar esențiale" (essential only) rejects it. The choice is persisted
 * via lib/consent (localStorage + cookie) and broadcast so <AnalyticsPixel> reacts live.
 *
 * Accessibility: a labelled dialog region, focus moved to it on show, Escape = essential
 * only (the privacy-preserving default; a held key's repeats never count), and
 * reduced-motion honoured in CSS.
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
    if (getConsent() !== null) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // preventScroll: the banner is fixed to the viewport, so focusing it must not move the page.
    ref.current?.focus({ preventScroll: true });
  }, [visible]);

  const choose = (value: "accepted" | "rejected") => {
    setConsent(value);
    setVisible(false);
  };

  if (!ready || !visible) return null;

  /* A frosted card rather than a full-width bar: bottom-right from 641px, inset 12px on
     phones. The fill is the SOLID glass tint with the blur on top, not the see-through one:
     14px body copy has to stay AA over whatever scrolls behind it, neon CTA included.
     Phones get no blur at all but the opaque panel colour instead (`max-sm:`): the banner
     sits over the hero's floor grid and the ticker, which never stop, so a backdrop-filter
     there would be re-sampled every frame — and without it the 6% the solid glass lets
     through would ghost the big hero numerals.
     `outline-none` is safe only because the card takes programmatic focus alone
     (tabIndex -1); every control inside draws its own focus-visible ring. */
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-label={t("cookie.policyLink")}
      tabIndex={-1}
      className="fixed inset-x-3 bottom-3 z-(--z-cookie) rounded-lg border border-glass-line bg-glass-solid p-4 shadow-lg outline-none animate-cookie-rise motion-reduce:animate-none max-sm:bg-panel max-sm:backdrop-filter-none sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[calc(100%_-_40px)] sm:max-w-[460px] sm:p-5 [backdrop-filter:blur(var(--glass-blur))_saturate(1.4)] before:pointer-events-none before:absolute before:inset-x-5 before:top-0 before:h-px before:bg-linear-to-r before:from-transparent before:via-red/80 before:to-transparent before:content-['']"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || e.repeat) return;
        choose("rejected");
      }}
    >
      <p className="m-0 font-copy text-md leading-[1.55] text-mut">
        {t("cookie.text")}{" "}
        {/* Inside the sentence, so it cannot become a box without breaking the paragraph:
            block padding on the inline link grows its hit area to 44px and leaves the line
            box alone. */}
        <Link
          href="/cookies"
          className="whitespace-nowrap rounded-sm py-[13px] text-blue-text underline underline-offset-2 transition-colors duration-200 hover:text-txt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan"
        >
          {t("cookie.policyLink")}
        </Link>
        .
      </p>
      <div className="mt-4 grid grid-cols-1 gap-2 xs:grid-cols-2">
        <button
          type="button"
          onClick={() => choose("rejected")}
          className="min-h-11 cursor-pointer rounded-sm border border-line2 bg-transparent px-4 py-2 font-hud text-xs font-bold uppercase leading-[1.3] tracking-[.08em] text-mut transition-[border-color,color,box-shadow] duration-200 hover:border-blue hover:text-txt hover:shadow-neon-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan motion-reduce:transition-none"
        >
          {t("cookie.settings")}
        </button>
        <button
          type="button"
          onClick={() => choose("accepted")}
          className="cta-neon min-h-11 rounded-sm px-4 py-2 font-hud text-xs font-bold uppercase leading-[1.3] tracking-[.08em]"
        >
          {t("cookie.accept")}
        </button>
      </div>
    </div>
  );
}
