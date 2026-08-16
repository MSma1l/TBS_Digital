/**
 * The theme model — shared by the server (root layout), the anti-flash inline script and
 * the client provider, so the three can never disagree about a name or a value.
 *
 * Three states, exactly as `app/globals.css` documents them:
 *  · `"light"` / `"dark"` — an explicit choice, stamped on `<html data-theme>`;
 *  · `"system"` — no choice yet, follow `prefers-color-scheme`.
 *
 * The palettes themselves live ONLY in globals.css. Nothing here defines a colour: the
 * whole mechanism is "put the right value in `data-theme` as early as possible".
 */

/** The two palettes globals.css ships. This is what `data-theme` carries. */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** What the visitor picked. `"system"` means: nothing picked — follow the OS. */
export type ThemeChoice = Theme | "system";

/**
 * The cookie the explicit choice is stored in.
 *
 * A cookie rather than localStorage, and for the same reason the language uses one
 * (`tbs_locale`): the root layout is rendered per request, so it can read the choice and
 * emit `<html data-theme>` already correct — the page is right even before the inline
 * script runs, and even with JavaScript disabled.
 */
export const THEME_COOKIE = "tbs_theme";

/** One year, like the language cookie. */
export const THEME_COOKIE_MAX_AGE = 31536000;

/** The media query that decides the theme while the visitor has made no choice. */
export const PREFERS_DARK = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Narrow a raw cookie value to a choice; anything unknown means "no choice yet". */
export function toThemeChoice(value: unknown): ThemeChoice {
  return isTheme(value) ? value : "system";
}

/**
 * The anti-flash (anti-FOUC) script.
 *
 * It is injected inline in `<head>` (see `app/layout.tsx`) and therefore runs synchronously
 * while the browser is still parsing the document — before the first paint, and long before
 * React hydrates. It resolves the theme the same way the provider does (saved cookie first,
 * `prefers-color-scheme` otherwise) and stamps it on `<html>`, so a dark-mode visitor never
 * sees a white flash.
 *
 * It always stamps an explicit value, including for the "follow the system" state. That is
 * deliberate: it also pins `color-scheme` (globals.css sets it per `data-theme`), so form
 * controls and scrollbars match from the first frame too.
 *
 * The string is deliberately tiny and self-contained: no globals, wrapped in try/catch (a
 * browser with cookies disabled must not break the page), and it contains no `<` so it can
 * never terminate the script element early.
 *
 * NOTE — CSP: the site serves a strict, nonce-based `script-src` with no `'unsafe-inline'`
 * (`proxy.ts`), so the tag rendering this MUST carry the per-request nonce or the browser
 * refuses to run it and the flash comes back.
 */
export const THEME_INIT_SCRIPT =
  `(function(){try{` +
  `var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(dark|light)/);` +
  `var t=m?m[1]:(window.matchMedia&&window.matchMedia("${PREFERS_DARK}").matches?"dark":"light");` +
  `document.documentElement.setAttribute("data-theme",t);` +
  `}catch(e){}})();`;
