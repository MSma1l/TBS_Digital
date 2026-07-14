/**
 * The message catalog, one record per language. Romanian (`ro`) is the source and the
 * fallback; `ru` and `en` mirror its keys. `LanguageProvider.t()` falls back to `ro` for
 * any key an other language leaves empty, so the UI never renders a blank.
 */
import { ro, type MessageKey } from "./messages/ro";
import { ru } from "./messages/ru";
import { en } from "./messages/en";
import type { Locale } from "./locales";

export type { MessageKey };

export const messages: Record<Locale, Record<MessageKey, string>> = {
  ro,
  ru,
  en,
};
