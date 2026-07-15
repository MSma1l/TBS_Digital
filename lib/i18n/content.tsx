"use client";

import { useCallback } from "react";
import { useLanguage } from "./LanguageProvider";
import { messages, type MessageKey } from "./messages";
import { type Locale } from "./locales";

/**
 * Admin-editable content now carries all three languages: every localizable field is a
 * `{ ro, ru, en }` object. Romanian is the source/fallback — `loc()` resolves a field as
 * `value[locale] || value.ro`, so a missing ru/en degrades to Romanian, never to blank.
 *
 * A plain string is still accepted (legacy content, or a field an older payload left as a
 * string) and treated as Romanian-only, so nothing breaks during the transition.
 */
export type LocalizedText = { ro: string; ru: string; en: string };

/** A field that may be a full localized object or a bare string (legacy). */
export type MaybeLocalized = LocalizedText | string;

/** Resolve a localized field to a single string in the given language. */
export function loc(value: MaybeLocalized | undefined | null, locale: Locale): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[locale] || value.ro || "";
}

/** Build a `{ro,ru,en}` from a catalog key — used to give the default content its
 *  translations (the seed strings live in the message catalog). */
export function locFromCatalog(key: MessageKey): LocalizedText {
  return {
    ro: messages.ro[key],
    ru: messages.ru[key] || messages.ro[key],
    en: messages.en[key] || messages.ro[key],
  };
}

/** A plain Romanian-only localized value (ru/en fall back to ro at render). */
export function locRo(ro: string): LocalizedText {
  return { ro, ru: "", en: "" };
}

/** Hook returning a resolver bound to the active language: `l(field)` → string. */
export function useLoc(): (value: MaybeLocalized | undefined | null) => string {
  const { locale } = useLanguage();
  return useCallback((value) => loc(value, locale), [locale]);
}

/** Map a stored (Romanian) project tag to its catalog key — kept for any legacy string
 *  tags that predate localization; a localized tag resolves via `loc()` directly. */
export function projectTagKey(tag: string): MessageKey | null {
  switch (tag) {
    case "PLATFORMĂ WEB":
      return "projects.tag.web";
    case "SITE CORPORATIV":
      return "projects.tag.corporate";
    case "PLATFORMĂ SAAS":
      return "projects.tag.saas";
    case "APLICAȚIE MOBILĂ":
      return "projects.tag.mobile";
    default:
      return null;
  }
}
