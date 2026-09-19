/**
 * The projects reel: which project the 3D laptop is showing, read off the grid the page already
 * rendered.
 *
 * Framework-free on purpose — no React, no three.js — like `workHelix.ts`: the scene chunk
 * (`SceneWorld`) creates it, the world asks it for a card once a frame and disposes it with the
 * scene. React never learns anything happened, and **the grid is never written to**. It is the
 * content, the accessibility and the fallback; this only reads it and listens on it.
 *
 * What it answers, in order of precedence:
 *  · **the pointer** — hovering a card puts that project on the display;
 *  · **the keyboard** — focusing one does the same, so a visitor who never touches a mouse gets
 *    the same answer (and the grid's own focus ring still says where they are);
 *  · **the cycle** — otherwise the projects take turns, `PROJECTS_DWELL` seconds each. Releasing a
 *    card resumes the cycle FROM it rather than from wherever it had got to, so the display never
 *    jumps back to a project the visitor has just moved away from.
 *
 * **The cards change after mount.** `useSiteContent` renders the default document on the server and
 * the first paint, then swaps in the localStorage cache and then the API document, and the language
 * can change under all of it. Two things can happen: the LIST changes (different cards, or the same
 * cards re-keyed) and an IMAGE changes on a card React kept. A MutationObserver catches both — the
 * grid's children for the first, `src` / `srcset` anywhere under it for the second — and each bumps
 * `generation`, which is the world's signal to compose the texture again even for the card it is
 * already showing. Without it the display would keep the screenshot of a project that is no longer
 * on that card.
 */

/** Seconds one project holds the display before the reel moves on. */
export const PROJECTS_DWELL = 4.2;

/** The card the display should be showing, and what it was composed from. */
export type ProjectsPick = {
  card: HTMLElement;
  index: number;
  /** Bumped whenever the cards or their images changed: compose again, even for the same card. */
  generation: number;
};

export type ProjectsReel = {
  /**
   * The card to show, advancing the cycle by `step` seconds. Call it only while the laptop is on
   * screen: a reel nobody is watching should not be spending projects. Null with no cards.
   */
  pick(step: number): ProjectsPick | null;
  cards(): readonly HTMLElement[];
  /** The index the pointer or the keyboard is holding, or −1. */
  held(): number;
  dispose(): void;
};

export type ProjectsReelOptions = {
  /** `[data-projects-track]`: the grid in DirectionPage.tsx. */
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
  let cursor = 0;
  let dwell = 0;
  let hover = -1;
  let focus = -1;
  let disposed = false;

  const collect = () => {
    const next = Array.from(grid.children).filter(isCard);
    const same = next.length === cards.length && next.every((card, i) => card === cards[i]);
    cards = next;
    if (!same) {
      generation += 1;
      // A held card that is no longer in the grid holds nothing.
      if (hover >= next.length) hover = -1;
      if (focus >= next.length) focus = -1;
      if (cursor >= next.length) cursor = 0;
    }
  };
  collect();

  /** The index of the card `node` is inside, or −1 (the grid's own gaps, the laptop's cell). */
  const indexOf = (node: EventTarget | null): number => {
    if (!(node instanceof Node)) return -1;
    let el: Node | null = node;
    while (el && el !== grid && el.parentNode !== grid) el = el.parentNode;
    return el && el !== grid && isCard(el) ? cards.indexOf(el) : -1;
  };

  const onOver = (event: Event) => {
    // `pointerover` fires for every element entered, the grid itself included, so moving off a card
    // into the row's gap answers −1 without a second listener.
    hover = indexOf(event.target);
  };
  const onLeave = () => {
    hover = -1;
  };
  const onFocusIn = (event: Event) => {
    focus = indexOf(event.target);
  };
  const onFocusOut = () => {
    // `focusout` runs before the matching `focusin`, so tabbing from one card to the next settles
    // on the new one rather than on nothing.
    focus = -1;
  };

  grid.addEventListener("pointerover", onOver);
  grid.addEventListener("pointerleave", onLeave);
  grid.addEventListener("focusin", onFocusIn);
  grid.addEventListener("focusout", onFocusOut);

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((records) => {
      let images = false;
      for (const record of records) {
        if (record.type === "attributes") images = true;
      }
      collect();
      // A screenshot replaced on a card React kept: the same element, a different project.
      if (images) generation += 1;
    });
    observer.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "srcset"],
    });
  }

  return {
    pick(step) {
      if (disposed || cards.length === 0) return null;
      const hold = hover >= 0 && hover < cards.length ? hover : focus >= 0 && focus < cards.length ? focus : -1;
      if (hold >= 0) {
        cursor = hold;
        dwell = 0;
      } else {
        dwell += Number.isFinite(step) && step > 0 ? step : 0;
        if (dwell >= PROJECTS_DWELL) {
          dwell = 0;
          cursor = (cursor + 1) % cards.length;
        }
      }
      if (cursor >= cards.length) cursor = 0;
      return { card: cards[cursor], index: cursor, generation };
    },

    cards() {
      return cards;
    },

    held() {
      return hover >= 0 ? hover : focus;
    },

    dispose() {
      disposed = true;
      observer?.disconnect();
      observer = null;
      grid.removeEventListener("pointerover", onOver);
      grid.removeEventListener("pointerleave", onLeave);
      grid.removeEventListener("focusin", onFocusIn);
      grid.removeEventListener("focusout", onFocusOut);
      cards = [];
    },
  };
}
