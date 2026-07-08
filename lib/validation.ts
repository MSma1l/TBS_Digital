/*
 * Framework-agnostic, typed input validation + sanitization helpers.
 *
 * Shared by the public contact form (`components/sections/Estimator.tsx`) and the
 * admin editor (`app/admin-tbs-digital/page.tsx`). The max lengths mirror the
 * backend contract (`backend/app/schemas.py` — ContactSubmissionIn) so the client
 * rejects the same input the server would. No React / DOM dependencies here, so it
 * is SSR-safe and reusable anywhere.
 *
 * UI copy returned by `validateText` is Romanian (with diacritics) on purpose — it
 * is rendered verbatim as inline field errors.
 */

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
};

/**
 * Validate one text field against `rules`. Returns a Romanian error message, or
 * `null` when the value is acceptable. Order: required → length → dangerous →
 * format. Length is checked before the dangerous-content regexes (defense-in-
 * depth: an over-long input is rejected on length before any regex runs).
 * Empty optional fields pass immediately.
 */
export function validateText(value: string, rules: TextRules): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return rules.required ? `${rules.label} este obligatoriu.` : null;
  }
  if (trimmed.length > rules.max) {
    return `${rules.label} depășește ${rules.max} de caractere.`;
  }
  if (hasDangerousContent(value)) {
    return `${rules.label} conține caractere sau cod nepermis.`;
  }
  if (rules.email && !isEmail(trimmed)) {
    return "Introdu o adresă de email validă.";
  }
  if (rules.phone && !isPhone(trimmed)) {
    return "Introdu un număr de telefon valid.";
  }
  return null;
}
