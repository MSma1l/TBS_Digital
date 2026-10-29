/**
 * The theme model — shared by the server (root layout), the client provider and anything that
 * has to follow a theme change (the 3D scene), so none of them can disagree about a name or a
 * value.
 *
 * Two palettes, exactly as `app/globals.css` defines them:
 *  · `"light"` — the base palette (`:root`). Every visitor starts here, whatever the OS prefers;
 *  · `"dark"`  — `:root[data-theme="dark"]`, only after the visitor presses the header toggle.
 *
 * The palettes themselves live ONLY in globals.css. Nothing here defines a colour: the whole
 * mechanism is "put the right value in `<html data-theme>`".
 */

/** The two palettes globals.css ships. This is what `data-theme` carries. */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** The palette of a visitor who has not chosen. The OS setting is deliberately not read. */
export const DEFAULT_THEME: Theme = "light";

/** The attribute on `<html>` the palettes key off. */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * The cookie the choice is stored in.
 *
 * A cookie rather than localStorage, and for the same reason the language uses one
 * (`tbs_locale`): the root layout is rendered per request, so it reads the choice and emits
 * `<html data-theme>` already correct — the page is right in its first byte, with no inline
 * script (the strict, nonce-based CSP stays untouched) and even with JavaScript off.
 */
export const THEME_COOKIE = "tbs_theme";

/**
 * Each palette's page colour (`--bg` in globals.css), for the browser chrome: the viewport's
 * `theme-color` and `color-scheme` meta tags (app/layout.tsx `generateViewport`, and the
 * provider on a press). A literal because a meta tag cannot read a CSS token — keep it in step
 * with `--bg` in both palettes.
 */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#f4f7ff",
  dark: "#101422",
};

/** One year, like the language cookie. */
export const THEME_COOKIE_MAX_AGE = 31536000;

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** A raw cookie value as a palette; anything unknown (or no cookie) is the default. */
export function toTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/** Client only. The palette `<html>` carries right now (no attribute = the default). */
export function readDocumentTheme(): Theme {
  return toTheme(document.documentElement.getAttribute(THEME_ATTRIBUTE));
}

/**
 * Client only. Calls `onChange` with the new palette whenever `<html data-theme>` changes to a
 * different one, whoever changed it; returns the unsubscribe. A MutationObserver rather than an
 * event from the provider, so a reader (the 3D scene) needs no React context and cannot miss a
 * change made outside the toggle. The callback runs after the attribute is in place, so a
 * `getComputedStyle` inside it already sees the new tokens.
 */
export function observeTheme(onChange: (theme: Theme) => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  let current = readDocumentTheme();
  const observer = new MutationObserver(() => {
    const next = readDocumentTheme();
    if (next === current) return;
    current = next;
    onChange(next);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] });
  return () => observer.disconnect();
}
