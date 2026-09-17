/**
 * The HUD chrome's arming contract — the QA switch, the events that count as "the visitor did
 * something" and the desktop breakpoint, shared by `components/hud/HudChrome.tsx`, its parts,
 * `playwright.config.ts` and the E2E helpers.
 *
 * Deliberately import-free, NOT a `"use client"` module, and nothing here touches the DOM at
 * import time: `playwright.config.ts` imports it by relative path into Node (where the `@/`
 * alias is not guaranteed), and the E2E helpers import it too. `readHudFlag` checks for
 * `window` first and is a quiet `null` on the server.
 *
 * The gate itself (the order the conditions must hold in) lives in HudChrome. The storage key
 * is listed in docs/11-security.md.
 */

/**
 * `localStorage[HUD_FLAG_KEY] === "off"` keeps the HUD chrome (guide, rail, OS windows) from
 * ever arming. QA and E2E only — the site never writes it, and nothing else about the page
 * changes. `playwright.config.ts` seeds it for every context unless `E2E_HUD=on`.
 */
export const HUD_FLAG_KEY = "tbs_hud";

/** `"off"` when the QA switch is set; anything else — or storage that throws — is `null`. */
export function readHudFlag(): "off" | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(HUD_FLAG_KEY) === "off" ? "off" : null;
  } catch {
    return null;
  }
}

/**
 * The first of these on `window` (passive, capture) is the interaction the HUD waits for.
 * `focusin` covers a keyboard or assistive-technology visitor whose first move is a focus
 * change; `scroll` in the capture phase also hears scrolling inside an element.
 */
export const HUD_ARM_EVENTS = [
  "pointermove",
  "pointerdown",
  "wheel",
  "scroll",
  "keydown",
  "touchstart",
  "focusin",
] as const;

export type HudArmEvent = (typeof HUD_ARM_EVENTS)[number];

/** Where the desktop HUD (the fibre rail, floating windows) exists; the header's breakpoint + 1. */
export const HUD_DESKTOP_MEDIA = "(min-width: 861px)";
