"use client";

import { useEffect, useState, type ComponentType } from "react";
import { CONSENT_EVENT, getConsent } from "@/lib/consent";
import { HUD_ARM_EVENTS, readHudFlag } from "@/lib/hud/gate";
import { afterIdle } from "@/lib/idle";
import { onIntroGone } from "@/lib/intro";

/**
 * The HUD chrome's parts (the Ghid TBS guide, the fibre rail, the OS layer), each a
 * `next/dynamic({ ssr: false })` chunk, rendered together in ONE commit once the gate opens.
 * Empty until the phases that build them land; the server never renders any of them, so the
 * HTML does not grow.
 */
const PARTS: readonly ComponentType[] = [];

/** The arming events never block scrolling, and are heard before anything can stop them. */
const ARM_LISTENER = { capture: true, passive: true } as const;

/**
 * Call `onArmed` once every condition has held, in this order:
 *  1. the QA switch is not `off` (`readHudFlag`) — otherwise never, and nothing is listened to;
 *  2. the cookie banner is answered (`getConsent`). An unanswered banner waits for
 *     `CONSENT_EVENT` instead, and that answer IS the interaction, so step 3 is skipped;
 *  3. the visitor's first `HUD_ARM_EVENTS` event on `window` (passive, capture). The listeners
 *     are removed the moment one fires;
 *  4. the intro overlay is gone (`onIntroGone`);
 *  5. an idle slot (`afterIdle(0)`).
 *
 * Returns the cancel: safe at any step, after `onArmed` ran, and twice.
 */
function whenHudArmed(onArmed: () => void): () => void {
  if (readHudFlag() === "off") return () => {};

  let stopIntro: () => void = () => {};
  let stopIdle: () => void = () => {};
  // Two variables, not one: `onIntroGone` calls back synchronously when no intro is on screen,
  // so the idle cancel is stored before the intro's (no-op) unsubscribe is returned.
  const afterInteraction = () => {
    stopIntro = onIntroGone(() => {
      stopIdle = afterIdle(0, onArmed);
    });
  };

  const stopListening = () => {
    for (const type of HUD_ARM_EVENTS) window.removeEventListener(type, onInteraction, ARM_LISTENER);
  };
  function onInteraction() {
    stopListening();
    afterInteraction();
  }

  const onConsent = (event: Event) => {
    const value = (event as CustomEvent<unknown>).detail;
    if (value !== "accepted" && value !== "rejected" && getConsent() === null) return;
    window.removeEventListener(CONSENT_EVENT, onConsent);
    afterInteraction();
  };

  if (getConsent() === null) {
    window.addEventListener(CONSENT_EVENT, onConsent);
  } else {
    for (const type of HUD_ARM_EVENTS) window.addEventListener(type, onInteraction, ARM_LISTENER);
  }

  return () => {
    window.removeEventListener(CONSENT_EVENT, onConsent);
    stopListening();
    stopIntro();
    stopIdle();
  };
}

/** Has the HUD gate opened (see `whenHudArmed`)? `false` on the server and on first paint. */
export function useHudArmed(): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => whenHudArmed(() => setArmed(true)), []);
  return armed;
}

/**
 * The one mount of the HUD chrome, meant for `app/(site)/layout.tsx` between `<Footer />` and
 * `<CookieConsent />` (after the page in the DOM, so its tab stops come after the footer's).
 * A visitor who never interacts, never answers the cookie banner, or carries the `tbs_hud=off`
 * QA switch downloads none of the parts. Nothing is rendered before the gate opens.
 */
export function HudChrome() {
  const armed = useHudArmed();
  if (!armed) return null;
  return (
    <>
      {PARTS.map((Part, index) => (
        <Part key={index} />
      ))}
    </>
  );
}
