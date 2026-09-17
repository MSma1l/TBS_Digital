import type { LocalizedText } from "@/lib/i18n/content";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The fibre rail's copy: the `<nav>`'s name, and the home page's section list with its labels.
 *
 * Home labels reuse the header's own catalog keys where one names the same section (critique
 * R10.4: `nav.services`, `nav.work`, `nav.about`, `nav.team`), so the rail and the menu can
 * never disagree. The three sections the menu has no key for get a local `{ ro, ru, en }`
 * object, rendered through `useLoc()` (docs/16-i18n-seo.md) — nothing is added to the catalog.
 * Every other page names its markers after its own headings (lib/hud/rail.ts).
 *
 * No directive and type-only imports, so the E2E specs can import it into Node and find the
 * controls by exactly these strings. Nothing here promises anything: they are section names.
 */

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

export const RAIL_COPY = {
  /** The `<nav>`'s accessible name. */
  nav: L("Secțiunile paginii", "Разделы страницы", "Page sections"),
  /** Home `#top` (the hero). */
  top: L("Început", "Начало", "Start"),
  /** Home `#estimare` (the request section). */
  estimare: L("Cerere", "Заявка", "Request"),
  /** Home `#contact` (the closing call to action). */
  contact: L("Contact", "Контакт", "Contact"),
};

/** A marker's label: a catalog key, a local localized object, or a heading's own text. */
export type RailLabel = { key: MessageKey } | { text: LocalizedText } | { plain: string };

/**
 * The home page's markers, in page order, by section id. The rail uses this list only when
 * every one of these ids is on the page; otherwise it discovers the page's headings.
 */
export const RAIL_HOME_SECTIONS = [
  { id: "top", label: { text: RAIL_COPY.top } },
  { id: "servicii", label: { key: "nav.services" } },
  { id: "lucrari", label: { key: "nav.work" } },
  { id: "despre", label: { key: "nav.about" } },
  { id: "echipa", label: { key: "nav.team" } },
  { id: "estimare", label: { text: RAIL_COPY.estimare } },
  { id: "contact", label: { text: RAIL_COPY.contact } },
] as const satisfies readonly { id: string; label: RailLabel }[];
