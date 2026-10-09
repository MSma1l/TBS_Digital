/**
 * The /portofoliu pages and its search by name (components/sections/Portfolio.tsx,
 * PortfolioSearch.tsx) — pure, so the server and the browser cut the same pages.
 *
 * The row under the screen shows one page of pixels: nine, the row of today on every width (one
 * row on a laptop, five and four on a phone, four, four and one on the narrowest). Pages are
 * BALANCED: 100 projects make twelve pages of eight or nine, never eleven of nine and one alone.
 */

/** The most pixels one page holds. */
export const PAGE_SIZE = 9;

/** How many pages `count` projects make (one, for none). */
export function pageCount(count: number): number {
  return Math.max(1, Math.ceil(count / PAGE_SIZE));
}

/** The pages' sizes as `base`, with the first `extra` pages one larger. */
function split(count: number): { pages: number; base: number; extra: number } {
  const pages = pageCount(count);
  return { pages, base: Math.floor(count / pages), extra: count % pages };
}

/** Where page `page` (from 0) starts and ends in a list of `count`: `[start, end)`. */
export function pageBounds(count: number, page: number): [number, number] {
  const { pages, base, extra } = split(count);
  const k = Math.min(Math.max(0, page), pages - 1);
  const start = k * base + Math.min(k, extra);
  return [start, Math.min(count, start + base + (k < extra ? 1 : 0))];
}

/** The page (from 0) holding the item at `index` in a list of `count`. */
export function pageOf(count: number, index: number): number {
  if (count <= 0 || index <= 0) return 0;
  const { pages, base, extra } = split(count);
  const big = extra * (base + 1);
  const page = index < big ? Math.floor(index / (base + 1)) : extra + Math.floor((index - big) / Math.max(1, base));
  return Math.min(page, pages - 1);
}

/** Text as a search compares it: no capitals, no diacritics ("Ș" is "s", "ă" is "a"). */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * `text` folded, with where each folded character came from in `text` — a name stored with its
 * diacritics decomposed, or a character that folds into several, still marks the right letters.
 */
function foldWithMap(text: string): { folded: string; from: number[] } {
  let folded = "";
  const from: number[] = [];
  let at = 0;
  for (const char of text) {
    const piece = foldText(char);
    for (let k = 0; k < piece.length; k++) from.push(at);
    folded += piece;
    at += char.length;
  }
  return { folded, from };
}

/** One project the search found: which, the part of its name that matched (`start`–`end`, none
 *  for a match on its kind of work), and how well it matched (lower is better). */
export type SearchHit = { index: number; start: number; end: number; rank: number };

/**
 * The projects whose name holds `query` — the name's start first, then the start of a word or a
 * seam in it ("Agro|Market"), then anywhere — and after them the ones whose kind of work (`tagOf`,
 * in the visitor's language) holds it: "magazin" finds the shops. Ties keep the page's order.
 */
export function searchProjects<T extends { name: string }>(
  items: readonly T[],
  query: string,
  tagOf: (item: T) => string,
): SearchHit[] {
  const q = foldText(query.trim());
  if (!q) return [];
  const hits: SearchHit[] = [];
  items.forEach((item, index) => {
    const name = item.name;
    const { folded, from } = foldWithMap(name);
    const at = folded.indexOf(q);
    if (at >= 0) {
      const start = from[at];
      const last = from[at + q.length - 1];
      const end = last + (name.codePointAt(last)! > 0xffff ? 2 : 1);
      const before = name[start - 1] ?? "";
      const here = name[start] ?? "";
      const wordStart = /[^\p{L}\p{N}\p{M}]/u.test(before) || (/\p{Lu}/u.test(here) && /\p{Ll}/u.test(before));
      hits.push({ index, start, end, rank: start === 0 ? 0 : wordStart ? 1 : 2 });
    } else if (foldText(tagOf(item)).includes(q)) {
      hits.push({ index, start: -1, end: -1, rank: 3 });
    }
  });
  return hits.sort((a, b) => a.rank - b.rank || a.index - b.index);
}
