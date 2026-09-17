import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TICKER_COPIES, Ticker } from "@/components/sections/Ticker";
import { INTRO_REVEAL_ATTR } from "@/lib/intro";

/*
 * The trust ticker under the hero (components/sections/Ticker.tsx).
 *
 * The loop is only seamless if the track is TICKER_COPIES identical groups (the marquee
 * keyframe moves it by one group) and every group ends with the hairline separator that
 * separates it from the next one. None of that is visible to jsdom (`css: false`), so the
 * structure is pinned through the data hooks instead.
 */

const LEAD_RO = "Strategie → design → livrare";
const ITEM_COUNT = 4;

function renderTicker() {
  const { container } = render(<Ticker />);
  const root = container.querySelector<HTMLElement>("[data-ticker]");
  if (!root) throw new Error("no [data-ticker] root");
  const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-ticker-group]"));
  return { container, root, groups };
}

describe("Ticker — structure", () => {
  it("is one decorative strip, hidden from assistive technology", () => {
    const { container, root } = renderTicker();

    expect(container.querySelectorAll("[data-ticker]")).toHaveLength(1);
    expect(root).toHaveAttribute("aria-hidden", "true");
  });

  it(`renders ${TICKER_COPIES} identical groups, each with the lead and every item`, () => {
    const { groups } = renderTicker();

    expect(TICKER_COPIES).toBe(5);
    expect(groups).toHaveLength(TICKER_COPIES);
    const texts = groups.map((group) => group.textContent);
    expect(new Set(texts).size).toBe(1);
    for (const group of groups) {
      expect(group.textContent).toContain(LEAD_RO);
      expect(group.querySelector("strong")?.textContent).toBe(LEAD_RO);
    }
  });

  it("tells the track how many copies it holds, so the marquee moves exactly one group", () => {
    const { root, groups } = renderTicker();
    const track = groups[0].parentElement;

    expect(track?.closest("[data-ticker]")).toBe(root);
    expect(track?.children).toHaveLength(TICKER_COPIES);
    expect(track?.style.getPropertyValue("--marquee-copies")).toBe(String(TICKER_COPIES));
  });

  it("alternates text and separator inside a group, and ENDS with a separator (the loop seam)", () => {
    const { groups } = renderTicker();

    for (const group of groups) {
      const sequence = Array.from(group.children).map((child) =>
        child.hasAttribute("data-ticker-sep") ? "sep" : "text",
      );
      // lead, then (sep, item) per item, then the trailing seam separator
      expect(sequence).toHaveLength(2 * (ITEM_COUNT + 1));
      expect(sequence[0]).toBe("text");
      expect(sequence[sequence.length - 1]).toBe("sep");
      sequence.slice(1).forEach((kind, i) => {
        expect(kind, `position ${i + 1}`).toBe(i % 2 === 0 ? "sep" : "text");
      });
      expect(group.lastElementChild).toHaveAttribute("data-ticker-sep");
    }
  });

  it("draws the separators as empty, hidden hairlines — never a dot, never a glyph", () => {
    const { container, root } = renderTicker();
    const separators = Array.from(root.querySelectorAll("[data-ticker-sep]"));

    expect(separators).toHaveLength(TICKER_COPIES * (ITEM_COUNT + 1));
    for (const sep of separators) {
      expect(sep).toHaveAttribute("aria-hidden", "true");
      expect(sep.textContent).toBe("");
      expect(sep.getAttribute("class")).toMatch(/(^|\s)w-px(\s|$)/);
      expect(sep.getAttribute("class")).not.toMatch(/(^|\s)(rounded-full|size-\S+)(\s|$)/);
    }
    for (const glyph of ["◆", "•", "●"]) {
      expect(container.textContent).not.toContain(glyph);
    }
  });

  it("puts the entrance marker on the outer strip only, never on the animated track", () => {
    const { container, root } = renderTicker();
    const markers = container.querySelectorAll(`[${INTRO_REVEAL_ATTR}]`);

    expect(markers).toHaveLength(1);
    expect(root).toHaveAttribute(INTRO_REVEAL_ATTR, "ticker");
    // No inline style on the marker: the entrance writes and clears its own.
    expect(root.hasAttribute("style")).toBe(false);
  });
});
