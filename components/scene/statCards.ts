/**
 * The hero's metric cards, as the page rendered them — the source the 3D stat panels' faces are
 * composed from (`three/statFace.ts`).
 *
 * Framework-free on purpose, like `projectsReel.ts`: the scene chunk creates it, the world asks it
 * for the cards and disposes it with the scene, and **no card is ever laid out differently**. The
 * page keeps rendering exactly the group it always did — the number, the label and the note, in the
 * visitor's language, counted from the real portfolio — and this only reads it.
 *
 * **The cards change after mount.** `useSiteContent` renders the default document on the server and
 * the first paint, then swaps in the localStorage cache and then the API document, so the portfolio
 * counter can go from one number to another; the language can change under all of it, and a
 * breakpoint crossing re-lays the group. One MutationObserver over the group catches the two that
 * matter — its children (a counter that appears or goes) and the text inside them — and bumps
 * `generation`, which is the world's signal to compose the face again. Nothing polls, and nothing
 * here touches the DOM per frame.
 */

import { SCENE_ANCHOR_ATTR } from "@/lib/scene";

export type StatCards = {
  /** The cards, in DOM order — the same order `probe.stats` measures their boxes in. */
  cards(): readonly HTMLElement[];
  /** Bumped whenever a card's text or the group's children changed: compose again. */
  generation(): number;
  dispose(): void;
};

export type StatCardsOptions = {
  /** The group the cards live in (`[data-intro-reveal="stats"]` in Hero.tsx). */
  group: HTMLElement;
};

export function createStatCards({ group }: StatCardsOptions): StatCards {
  let list: HTMLElement[] = [];
  let generation = 0;

  const read = () => {
    list = Array.from(group.querySelectorAll<HTMLElement>(`[${SCENE_ANCHOR_ATTR}="stat"]`));
  };
  read();

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => {
      read();
      generation += 1;
    });
    observer.observe(group, { childList: true, subtree: true, characterData: true });
  }

  return {
    cards() {
      return list;
    },
    generation() {
      return generation;
    },
    dispose() {
      observer?.disconnect();
      observer = null;
      list = [];
    },
  };
}
