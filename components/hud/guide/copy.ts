import type { LocalizedText } from "@/lib/i18n/content";
import type { GuideTopic } from "@/lib/hud/topics";

/**
 * The Ghid TBS copy: the avatar's name and label, the tip's buttons, and one tip per topic.
 *
 * Local `{ ro, ru, en }` objects rendered through `useLoc()` (docs/16-i18n-seo.md), not catalog
 * keys: the copy belongs to this one lazy part, so it ships in the guide's chunk and nowhere else.
 * No directive and type-only imports, so the E2E specs can import it into Node and find the
 * controls by exactly these strings.
 *
 * Honest by construction: it is a guide that asks a few questions, never "AI". The reply time
 * in `prompts.lucrari` repeats the promise the estimator's own `SENT_COPY` already makes (one
 * business day), and nothing else here promises a time.
 */

const L = (ro: string, ru: string, en: string): LocalizedText => ({ ro, ru, en });

export const GUIDE_COPY = {
  /** The visible caption under the avatar and the tip's kicker. */
  label: L("Ghid TBS", "Гид TBS", "TBS Guide"),
  /** The avatar button's accessible name. It starts with the visible caption (WCAG 2.5.3). */
  aria: L(
    "Ghid TBS: deschide asistentul ghidat pentru cerere",
    "Гид TBS: открыть пошагового ассистента заявки",
    "TBS Guide: open the guided request assistant",
  ),
  open: L("Deschide ghidul", "Открыть гид", "Open the guide"),
  never: L("Nu mai arăta în această vizită", "Не показывать до конца визита", "Don't show again this visit"),
  dismiss: L("Închide sugestia", "Закрыть подсказку", "Close the tip"),
  /** One tip per topic (`lib/hud/topics.ts`). */
  prompts: {
    servicii: L(
      "Nu ești sigur ce direcție ți se potrivește? Ghidul pune câteva întrebări scurte și trimite echipei rezumatul.",
      "Не уверены, какое направление подходит? Гид задаст несколько коротких вопросов и отправит команде итог.",
      "Not sure which direction fits you? The guide asks a few short questions and sends the team a summary.",
    ),
    lucrari: L(
      "Ai în minte un proiect asemănător? Descrie-l pas cu pas — îți răspundem în cel mult o zi lucrătoare.",
      "Задумали похожий проект? Опишите его по шагам — ответим в течение одного рабочего дня.",
      "Have a similar project in mind? Describe it step by step — we reply within one business day.",
    ),
    service: L(
      "Vrei să vezi dacă direcția asta se potrivește proiectului tău? Ghidul te ajută să formulezi cererea.",
      "Хотите понять, подходит ли это направление вашему проекту? Гид поможет сформулировать заявку.",
      "Want to check whether this direction fits your project? The guide helps you put the request into words.",
    ),
  } satisfies Record<GuideTopic, LocalizedText>,
};
