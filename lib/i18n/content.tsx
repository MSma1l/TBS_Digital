"use client";

import { useCallback } from "react";
import { useLanguage } from "./LanguageProvider";
import { messages, type MessageKey } from "./messages";

/**
 * Resolve a piece of admin-editable content to the active language.
 *
 * The shipped services/projects/team default to the Romanian seed values, which also live
 * in the message catalog keyed by id. So:
 *   - Romanian: show the stored value (it is already Romanian — the admin's edit or the seed).
 *   - RU/EN, stored value still equals the Romanian default: the admin hasn't customised it,
 *     so show the translated catalog value.
 *   - RU/EN, stored value differs: the admin wrote their own copy — respect it verbatim
 *     (content editing is single-language; the framing/marketing copy is fully trilingual).
 *
 * A missing catalog key falls back to the stored value, so admin-added items (new ids) just
 * render as typed.
 */
export function useContentText() {
  const { locale } = useLanguage();

  return useCallback(
    (catalogKey: MessageKey | null, storedValue: string): string => {
      if (locale === "ro" || !catalogKey) return storedValue;
      const roDefault = messages.ro[catalogKey];
      if (storedValue !== roDefault) return storedValue; // admin-customised → verbatim
      return messages[locale][catalogKey] || storedValue;
    },
    [locale],
  );
}

/** Map a stored (Romanian) project tag to its catalog key, so tags translate too. */
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
