/**
 * Cookie-consent state for the GDPR / Law-133 banner.
 *
 * A single source of truth the banner writes and the analytics pixel reads. The choice is
 * persisted in BOTH `localStorage` (fast, client-only reads) and a cookie (so it can also
 * be read server-side or by other origins on the domain if ever needed). A `CustomEvent`
 * lets the pixel react the instant the visitor chooses, with no reload.
 *
 * Values:
 *   "accepted" — analytics allowed (the statistica.tbs.md pixel may load)
 *   "rejected" — essential only (no analytics, no tracking request ever fires)
 *   null       — no choice yet (banner is shown, nothing non-essential loads)
 */
export type ConsentValue = "accepted" | "rejected";

/** Storage key shared by localStorage and the cookie. */
export const CONSENT_KEY = "tbs_cookie_consent";

/** Fired on `window` whenever the choice changes; `detail` is the new ConsentValue. */
export const CONSENT_EVENT = "tbs:consent-change";

/** 6 months — a reasonable re-ask cadence for a consent record. */
const MAX_AGE = 60 * 60 * 24 * 180;

function isConsent(value: unknown): value is ConsentValue {
  return value === "accepted" || value === "rejected";
}

/** The stored choice, or `null` if the visitor has not decided yet. SSR-safe (returns null). */
export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (isConsent(stored)) return stored;
  } catch {
    /* localStorage blocked (private mode / iframe) — fall back to the cookie */
  }
  try {
    const match = document.cookie.match(
      /(?:^|;\s*)tbs_cookie_consent=(accepted|rejected)/,
    );
    if (match && isConsent(match[1])) return match[1];
  } catch {
    /* cookies unavailable */
  }
  return null;
}

/** Persist the choice (localStorage + cookie) and notify listeners (the pixel) synchronously. */
export function setConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* ignore — the cookie below still records the choice */
  }
  try {
    document.cookie = `${CONSENT_KEY}=${value};path=/;max-age=${MAX_AGE};samesite=lax`;
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  } catch {
    /* CustomEvent unsupported — the next full load will still read the stored value */
  }
}
