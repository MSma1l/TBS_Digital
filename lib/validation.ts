/*
 * Framework-agnostic, typed input validation + sanitization helpers.
 *
 * Shared by the public contact form (`components/sections/Estimator.tsx`) and the
 * admin editor (`app/admin-tbs-digital/page.tsx`). The max lengths mirror the
 * backend contract (`backend/app/schemas.py` — ContactSubmissionIn) so the client
 * rejects the same input the server would. No React / DOM dependencies here, so it
 * is SSR-safe and reusable anywhere.
 *
 * UI copy returned by `validateText` is Romanian (with diacritics) by default, rendered
 * verbatim as inline field errors. Callers inside a React tree can pass a `t` translate
 * function (from the i18n LanguageProvider) to `validateText` to localize the messages;
 * without it the Romanian fallbacks are used, so this module stays framework-agnostic and
 * every existing caller keeps working unchanged.
 */

import { format } from "@/lib/i18n/format";

/** Max lengths mirroring the backend limits. */
export const LIMITS = {
  name: 120,
  email: 254,
  phone: 40,
  message: 5000,
  /** Generic short free-text field (service name, stat, team role, partner…). */
  short: 200,
  /** Generic long free-text field (descriptions, bios). */
  long: 2000,
  /** A link or image reference (partner site / logo). Mirrors backend LinkStr. */
  link: 500,
} as const;

/** Forgiving email check (same shape the Estimator used before). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Permissive phone check: digits, spaces and the usual separators, min 6 digits. */
const PHONE_RE = /^[+()\-.\s\d]{6,}$/;

/** Matches an `on...=` inline event handler (e.g. `onclick=`, `onerror =`). */
const EVENT_HANDLER_RE = /\bon\w+\s*=/i;

/** Matches any HTML/XML-looking tag, e.g. `<script`, `<img ...>`, `</b>`. */
const HTML_TAG_RE = /<\/?[a-z][^>]*>?/i;

/** True when a non-empty (post-trim) value is present. */
export function required(value: string): boolean {
  return value.trim().length > 0;
}

/** True when the value is within `max` characters (trimmed). */
export function maxLen(value: string, max: number): boolean {
  return value.trim().length <= max;
}

/** True for a plausibly-valid email address. */
export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** True for a plausibly-valid phone number (permissive). */
export function isPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

/**
 * True when the raw input contains obviously dangerous markup we never want to
 * store or echo back: `<script`, a `javascript:` URI, an `on...=` handler, or any
 * raw HTML tag. Used to reject (not silently rewrite) injection attempts.
 */
/** Schemes that must never be followed from an `href`/`src` we render. */
const DANGEROUS_SCHEME_RE = /^\s*(?:javascript|data|vbscript|file)\s*:/i;

/** Characters that could break out of the `href="…"` / `src="…"` they land in. */
const UNSAFE_LINK_CHARS_RE = /[<>"'`\s\\]/;

/**
 * True for a link we are willing to render: an empty value, a site-relative path
 * (`/partners/crowe.png` — what the logo upload returns), or an absolute http(s)
 * URL. Mirrors `LinkStr` in `backend/app/validators.py` so the client rejects
 * exactly what the server would. Protocol-relative (`//host`) is refused: it
 * silently inherits the page's scheme and reads too much like a path.
 */
export function isLink(value: string): boolean {
  const v = value.trim();
  if (!v) return true; // links are optional
  if (v.length > LIMITS.link) return false;
  if (UNSAFE_LINK_CHARS_RE.test(v)) return false;
  if (DANGEROUS_SCHEME_RE.test(v)) return false;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/")) return true;
  return /^https?:\/\//i.test(v);
}

/**
 * Trim a link, dropping it entirely if it is not one we would render. A link is
 * never patched up the way `sanitizeText` rewrites prose: stripping `javascript:`
 * out of `javascript:alert(1)` would leave a live `alert(1)`, so an unacceptable
 * link becomes an empty string instead.
 */
export function sanitizeLink(value: string): string {
  const v = value.trim();
  return isLink(v) ? v : "";
}

export function hasDangerousContent(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  if (lower.includes("<script") || lower.includes("javascript:")) return true;
  if (EVENT_HANDLER_RE.test(value)) return true;
  if (HTML_TAG_RE.test(value)) return true;
  return false;
}

/**
 * Best-effort sanitizer: strips HTML tags, `javascript:` URIs and inline event
 * handlers, then trims. Defense-in-depth alongside `validateText`'s rejection —
 * use it right before sending a value to the API.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/<\/?[a-z][^>]*>/gi, "") // strip HTML tags
    .replace(/javascript:/gi, "") // strip js: URIs
    .replace(EVENT_HANDLER_RE, "") // strip on*= handlers
    .trim();
}

/** Options controlling how a single text field is validated. */
export type TextRules = {
  /** Human-readable field name used in messages (Romanian), e.g. "Numele". */
  label: string;
  /** Max allowed length (trimmed). */
  max: number;
  /** Whether an empty value is an error. Defaults to `false`. */
  required?: boolean;
  /** Also require a valid email. */
  email?: boolean;
  /** Also require a valid phone number (only checked when non-empty). */
  phone?: boolean;
  /** Also require a renderable link (see `isLink`), e.g. a partner site or logo. */
  link?: boolean;
};

/**
 * A translate function shaped like the i18n provider's `t` — takes a catalog key and
 * returns the localized string. Kept as a loose `(key: string) => string` so this module
 * never imports React or the provider.
 */
export type Translate = (key: string) => string;

/**
 * Validate one text field against `rules`. Returns an error message, or `null` when the
 * value is acceptable. Order: required → length → dangerous → format. Length is checked
 * before the dangerous-content regexes (defense-in-depth: an over-long input is rejected
 * on length before any regex runs). Empty optional fields pass immediately.
 *
 * When a `t` translate function is passed (from the i18n LanguageProvider), the messages
 * come from the catalog (`validation.*`) with `{label}`/`{max}` filled in via `format`.
 * Without it, the Romanian fallbacks below are used — only the returned message strings
 * change, never the validation logic.
 */
export function validateText(
  value: string,
  rules: TextRules,
  t?: Translate,
): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    if (!rules.required) return null;
    return t
      ? format(t("validation.required"), { label: rules.label })
      : `${rules.label} este obligatoriu.`;
  }
  if (trimmed.length > rules.max) {
    return t
      ? format(t("validation.maxLen"), { label: rules.label, max: rules.max })
      : `${rules.label} depășește ${rules.max} de caractere.`;
  }
  if (hasDangerousContent(value)) {
    return t
      ? format(t("validation.dangerous"), { label: rules.label })
      : `${rules.label} conține caractere sau cod nepermis.`;
  }
  if (rules.email && !isEmail(trimmed)) {
    return t ? t("validation.email") : "Introdu o adresă de email validă.";
  }
  if (rules.phone && !isPhone(trimmed)) {
    return t ? t("validation.phone") : "Introdu un număr de telefon valid.";
  }
  if (rules.link && !isLink(trimmed)) {
    // No dedicated catalog key for the link message — keep the Romanian fallback.
    return "Introdu un link valid (https://… sau o cale care începe cu /).";
  }
  return null;
}
