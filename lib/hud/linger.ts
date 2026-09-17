/**
 * The Ghid TBS linger engine: WHEN the guide may show a tip. Pure decisions only — the
 * component (`components/hud/guide/GuideAssistant.tsx`) owns the IntersectionObserver, the
 * visible-time timer and the DOM reads, and feeds the answers in here.
 *
 * A tip shows when the visitor has kept one topic on the viewport's centre line for
 * `GUIDE_LIMITS.lingerMs` of visible time, and `canPrompt` says yes:
 *
 *   - at most `maxPerSession` tips, each topic at most once, none after "Nu mai arăta";
 *   - `cooldownMs` between two tips, checked as `now - lastAt < cooldownMs` → blocked:
 *     59,999 ms after the last tip still blocks, 60,000 ms allows;
 *   - nothing blocks it right now (`GuideBlockers`: the page covered, the intro on screen, the
 *     cookie banner waiting, the visitor typing, the request flow open, the guide away over the
 *     section-layout flow, the visitor busy with the HUD — `isHudBusy()`).
 *
 * `now` comes from one monotonic clock (`performance.now()`); a non-finite `now` never prompts,
 * so the memory never records a time it cannot compare.
 *
 * Memory: "per session" means per page lifetime. The component keeps ONE module-level
 * `createGuideMemoryStore()`, so the limits hold across client-side navigations and reset on
 * reload. Nothing is written to storage or cookies — this module touches no `window` and no
 * `document`. Every memory is a frozen value; `recordPrompt` and `optOut` return a new one and
 * never change their input (the `shown` set included).
 *
 * `pickTopic`: nested topics (a service page's `[data-guide-topic]` inside `#servicii`) resolve
 * to the deepest element — a hit whose element contains no other hit's element. When several
 * qualify (side-by-side elements, or the same element listed twice) the first of them in `hits`
 * order wins, so the answer is deterministic.
 *
 * `isTypingTarget`: `textarea`, `select`, a text-like `input` (any type but button, submit,
 * reset, checkbox, radio, range, color, file, image; a missing or unknown type is text), and
 * editable content — the nearest `[contenteditable]` ancestor-or-self decides, and only
 * `contenteditable="false"` switches it off. `null` is false; SVG and other non-HTML elements
 * never throw (they are typing only inside editable content).
 *
 * Import-free and DOM-free at import time, no `"use client"`: any chunk and any test can load it
 * (`lib/__tests__/guide-linger.test.ts` pins that).
 */

export const GUIDE_LIMITS = { lingerMs: 5000, cooldownMs: 60_000, maxPerSession: 2 } as const;

export type GuideMemory = { shown: ReadonlySet<string>; count: number; lastAt: number | null; optedOut: boolean };

/** Nothing shown yet: the start of every page lifetime. */
export const EMPTY_GUIDE_MEMORY: GuideMemory = Object.freeze({
  shown: new Set<string>() as ReadonlySet<string>,
  count: 0,
  lastAt: null,
  optedOut: false,
});

/** Each `true` holds the tip back for now; the linger timer keeps running for a later try. */
export type GuideBlockers = {
  covered: boolean;
  intro: boolean;
  banner: boolean;
  typing: boolean;
  requestOpen: boolean;
  away: boolean;
  busy: boolean;
};

/** No tip for `topic` will ever show in this page lifetime: stop lingering on it. */
export function isFinal(m: GuideMemory, topic: string): boolean {
  return m.optedOut || m.count >= GUIDE_LIMITS.maxPerSession || m.shown.has(topic);
}

/** May the tip for `topic` show at `now`? */
export function canPrompt(m: GuideMemory, topic: string, now: number, b: GuideBlockers): boolean {
  if (isFinal(m, topic) || !Number.isFinite(now)) return false;
  if (m.lastAt !== null && now - m.lastAt < GUIDE_LIMITS.cooldownMs) return false;
  return !(b.covered || b.intro || b.banner || b.typing || b.requestOpen || b.away || b.busy);
}

/** The memory after the tip for `topic` showed at `now`. A dismissed tip still counts. */
export function recordPrompt(m: GuideMemory, topic: string, now: number): GuideMemory {
  return Object.freeze({ ...m, shown: new Set([...m.shown, topic]), count: m.count + 1, lastAt: now });
}

/** The memory after "Nu mai arăta în această vizită": no further tips until reload. */
export function optOut(m: GuideMemory): GuideMemory {
  return Object.freeze({ ...m, optedOut: true });
}

/** Deepest element among the hits (the one no other hit's element is contained by / that contains no other). */
export function pickTopic<T extends { topic: string; el: { contains(n: unknown): boolean } }>(
  hits: readonly T[],
): string | null {
  const deepest = hits.find((h) => !hits.some((other) => other.el !== h.el && h.el.contains(other.el)));
  // A real DOM always has a deepest hit; only a `contains` that loops can leave none.
  return (deepest ?? hits[0])?.topic ?? null;
}

const HTML_NS = "http://www.w3.org/1999/xhtml";

/** `input` types that take no typing. */
const NOT_TYPED = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"]);

/** textarea, select, [contenteditable], input whose type is not button/submit/reset/checkbox/radio/range/color/file/image. */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el.namespaceURI === HTML_NS) {
    const tag = el.localName;
    if (tag === "textarea" || tag === "select") return true;
    if (tag === "input") return !NOT_TYPED.has((el.getAttribute("type") ?? "text").toLowerCase());
  }
  const host = el.closest("[contenteditable]");
  return host !== null && host.getAttribute("contenteditable")?.toLowerCase() !== "false";
}

/** The guide's one memory cell. The component keeps a single module-level instance. */
export function createGuideMemoryStore(): { get(): GuideMemory; set(m: GuideMemory): void; reset(): void } {
  let memory = EMPTY_GUIDE_MEMORY;
  return {
    get: () => memory,
    set: (m) => {
      memory = m;
    },
    reset: () => {
      memory = EMPTY_GUIDE_MEMORY;
    },
  };
}
