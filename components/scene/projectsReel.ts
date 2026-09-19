/**
 * The projects reel: which project card the 3D laptop's display is composed from, read off the
 * grid the page already rendered.
 *
 * Framework-free on purpose — no React, no three.js — like `workHelix.ts`: the scene chunk
 * (`SceneWorld`) creates it, the world asks it for a card once a frame and disposes it with the
 * scene. React never learns anything happened, and **no card is ever laid out differently**.
 *
 * **The page decides, this follows.** The cycle, the prev/next buttons, the markers and the
 * pause all live in DirectionPage.tsx as ordinary React state, because the same choice also has
 * to render the project's name, tag and description beside the machine as real DOM text. It
 * arrives here as one number — `PROJECTS_INDEX_ATTR` on the grid — so the display and the copy
 * next to it cannot disagree. A MutationObserver reads it; nothing here polls and nothing here
 * touches the DOM per frame.
 *
 * **The cards change after mount.** `useSiteContent` renders the default document on the server
 * and the first paint, then swaps in the localStorage cache and then the API document, and the
 * language can change under all of it. Two things can happen: the LIST changes (different cards,
 * or the same cards re-keyed) and an IMAGE changes on a card React kept. The same observer catches
 * both — the grid's children for the first, `src` / `srcset` anywhere under it for the second —
 * and each bumps `generation`, which is the world's signal to compose again even for the card it
 * is already showing. Without it the display would keep the screenshot of a project that is no
 * longer on that card.
 *
 * **`warm()` is the one write this makes, and it is not to the page.** Where the laptop is live
 * the grid is `display: none` — it is the fallback, not the picture — and a `loading="lazy"` image
 * with no box is never near the viewport, so the browser never fetches it and `composeHologram`
 * would find `naturalWidth === 0` and fall back to a text-only screen for every project. Flipping
 * `loading` to `eager` starts the fetch at once. It is spent when the world decides the section is
 * close enough to build for, never on mount: nothing is fetched for a visitor who never scrolls
 * this far.
 */

import { PROJECTS_INDEX_ATTR } from "@/lib/scene";

/** The card the display should be composed from, and what it was composed at. */
export type ProjectsPick = {
  card: HTMLElement;
  index: number;
  /** Bumped whenever the cards or their images changed: compose again, even for the same card. */
  generation: number;
};

export type ProjectsReel = {
  /** The card the page has put on the display. Null with no cards. */
  pick(): ProjectsPick | null;
  cards(): readonly HTMLElement[];
  /**
   * Fetch every card's screenshot now. Idempotent, and re-run after a content swap brings new
   * `src`s in. Called once, when the world decides the section is near enough to build for.
   */
  warm(): void;
  dispose(): void;
};

export type ProjectsReelOptions = {
  /** `[data-projects-track]`: the grid in DirectionPage.tsx, which also carries the index. */
  grid: HTMLElement;
};

/** A card is a direct child of the grid that is one: the page renders an `<a>` or an `<article>`. */
function isCard(node: Node): node is HTMLElement {
  return node instanceof HTMLElement && (node.tagName === "A" || node.tagName === "ARTICLE");
}

export function createProjectsReel(o: ProjectsReelOptions): ProjectsReel {
  const { grid } = o;
  let cards: HTMLElement[] = [];
  let generation = 0;
  let index = 0;
  let warmed = false;
  let disposed = false;

  const readIndex = () => {
    const raw = Number.parseInt(grid.getAttribute(PROJECTS_INDEX_ATTR) ?? "", 10);
    index = Number.isFinite(raw) && raw >= 0 ? raw : 0;
  };

  const collect = () => {
    const next = Array.from(grid.children).filter(isCard);
    const same = next.length === cards.length && next.every((card, i) => card === cards[i]);
    cards = next;
    if (!same) generation += 1;
  };

  /** Every card's screenshot, fetched now — a hidden grid never fetches a lazy one on its own. */
  const warm = () => {
    for (const card of cards) {
      const img = card.querySelector("img");
      if (img && !img.complete && img.loading === "lazy") img.loading = "eager";
    }
  };

  collect();
  readIndex();

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((records) => {
      let images = false;
      let list = false;
      for (const record of records) {
        if (record.type === "childList") list = true;
        else if (record.attributeName === PROJECTS_INDEX_ATTR) readIndex();
        // A screenshot replaced on a card React kept: the same element, a different project.
        else images = true;
      }
      if (list) collect();
      if (images) generation += 1;
      if ((list || images) && warmed) warm();
    });
    observer.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset", PROJECTS_INDEX_ATTR],
    });
  }

  return {
    pick() {
      if (disposed || cards.length === 0) return null;
      const at = index < cards.length ? index : cards.length - 1;
      return { card: cards[at], index: at, generation };
    },

    cards() {
      return cards;
    },

    warm() {
      if (disposed) return;
      warmed = true;
      warm();
    },

    dispose() {
      disposed = true;
      observer?.disconnect();
      observer = null;
      cards = [];
    },
  };
}
