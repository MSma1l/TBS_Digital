/**
 * The header condenses on scroll — the contract, pinned.
 *
 * Two things are load-bearing here and neither is visible in a screenshot:
 *
 *  1. **The threshold has hysteresis.** A single trip point would flicker for a visitor
 *     resting on it: one wheel notch, a trackpad's inertia or a mobile address bar resizing
 *     the viewport would toggle the bar back and forth. The bar condenses at CONDENSE_AT and
 *     only expands again at EXPAND_AT, well above it; inside the band it keeps its state.
 *
 *  2. **The reserved box never moves.** Everything that condenses is painted on ONE
 *     absolutely positioned element (`[data-header-bar]`), a sibling of the content row, so
 *     the `<header>`'s own height stays exactly what `--header-h` says it is. Twenty places
 *     read that custom property — `scrollProbe.readHeaderHeight` above all, which feeds the
 *     3D stage's sticky layer — and a header whose layout height moved with the scroll would
 *     drag the whole scene up and down every frame. The test therefore asserts that the
 *     condensed state writes nothing on the `<header>` but a `data-` attribute and a border
 *     COLOUR, and that the bar is `position: absolute` and carries the glass.
 */
import { describe, it, expect } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Navbar } from "@/components/layout/Navbar";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import {
  CONDENSE_AT,
  EXPAND_AT,
  nextCondensed,
} from "@/components/layout/useHeaderCondensed";

describe("nextCondensed — the threshold and its hysteresis", () => {
  it("condenses at CONDENSE_AT and beyond", () => {
    expect(nextCondensed(CONDENSE_AT, false)).toBe(true);
    expect(nextCondensed(CONDENSE_AT + 1, false)).toBe(true);
    expect(nextCondensed(4000, false)).toBe(true);
  });

  it("expands at EXPAND_AT and at the very top", () => {
    expect(nextCondensed(EXPAND_AT, true)).toBe(false);
    expect(nextCondensed(0, true)).toBe(false);
    // Rubber-band / overscroll on iOS reports a negative offset: that is the top.
    expect(nextCondensed(-40, true)).toBe(false);
  });

  it("keeps whatever state it has inside the band — this is the anti-flicker rule", () => {
    const band = EXPAND_AT + 1;
    expect(EXPAND_AT).toBeLessThan(CONDENSE_AT);
    for (let y = band; y < CONDENSE_AT; y += 1) {
      expect(nextCondensed(y, false)).toBe(false);
      expect(nextCondensed(y, true)).toBe(true);
    }
  });

  it("never flips twice on one crossing: down past CONDENSE_AT, back up past EXPAND_AT", () => {
    let state = false;
    const flips: number[] = [];
    // One slow scroll down through the band, then back up through it.
    const path = [0, 20, 40, 60, 71, 72, 90, 71, 60, 40, 25, 24, 10, 0];
    for (const y of path) {
      const next = nextCondensed(y, state);
      if (next !== state) flips.push(y);
      state = next;
    }
    expect(flips).toEqual([CONDENSE_AT, EXPAND_AT]);
  });

  it("holds its state when the scroll offset cannot be read", () => {
    expect(nextCondensed(Number.NaN, true)).toBe(true);
    expect(nextCondensed(Number.NaN, false)).toBe(false);
  });
});

/** The navbar as the app mounts it (the CTA needs the shared request flow). */
function renderNav() {
  return render(
    <RequestFlowProvider>
      <Navbar />
    </RequestFlowProvider>,
  );
}

const headerEl = () => document.querySelector("header")!;
const barEl = () => document.querySelector("header [data-header-bar]") as HTMLElement | null;

/** Move the page and let the hook's one `requestAnimationFrame` read land. */
async function scrollTo(y: number) {
  await act(async () => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
  });
}

describe("the header's painted bar", () => {
  it("is one absolutely positioned, aria-hidden sibling of the content row — and no tab stop", () => {
    renderNav();
    const bar = barEl();

    expect(bar, "[data-header-bar] is missing from the header").not.toBeNull();
    expect(bar!.parentElement).toBe(headerEl());
    expect(bar!.getAttribute("aria-hidden")).toBe("true");
    expect(bar!.className).toContain("absolute");
    expect(bar!.className).toContain("pointer-events-none");
    // The text-bearing glass lives here, never on the <header>: a backdrop-filter on the
    // header would make it the backdrop root and the glass dropdowns would have nothing to blur.
    expect(bar!.className).toContain("glass-text");
    expect(headerEl().className).not.toContain("glass-text");
    expect(headerEl().className).not.toContain("backdrop");
    expect(headerEl().querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("starts expanded, condenses past the threshold and expands again below it", async () => {
    renderNav();
    expect(headerEl()).not.toHaveAttribute("data-condensed");

    await scrollTo(CONDENSE_AT);
    expect(headerEl()).toHaveAttribute("data-condensed");
    // Inset, rounded, ringed — all of it on the bar.
    expect(barEl()!.className).toContain("rounded-lg");

    // Still condensed inside the hysteresis band on the way back up.
    await scrollTo(EXPAND_AT + 1);
    expect(headerEl()).toHaveAttribute("data-condensed");

    await scrollTo(0);
    expect(headerEl()).not.toHaveAttribute("data-condensed");
    expect(barEl()!.className).toContain("rounded-none");
  });

  it("changes nothing on the <header> that could move the box it reserves", async () => {
    renderNav();
    const before = headerEl().className.split(/\s+/).filter(Boolean);

    await scrollTo(CONDENSE_AT + 200);
    const after = headerEl().className.split(/\s+/).filter(Boolean);

    const changed = [
      ...before.filter((c) => !after.includes(c)),
      ...after.filter((c) => !before.includes(c)),
    ];
    /* The ONLY class the header itself swaps is the colour of its 1px bottom rule. Anything
       that sizes, pads or positions the header would change --header-h's box under the 3D
       stage — which is the failure this whole design exists to prevent. */
    expect(changed.sort()).toEqual(["border-glass-line", "border-transparent"]);
  });

  /**
   * The island also narrows, and the row's two end groups ride in with it. That MUST happen
   * through `translate` — a compositor property that never re-measures the flex row. Padding,
   * margin, width or gap would re-lay the row out on every frame of the transition, and a row
   * that re-lays out can wrap or shrink a control below its 44px tap target.
   */
  it("narrows by translating the row's end groups, never by re-laying the row out", async () => {
    renderNav();
    const row = barEl()!.nextElementSibling as HTMLElement;
    const groups = [...row.children] as HTMLElement[];
    const before = groups.map((g) => g.className);

    await scrollTo(CONDENSE_AT + 200);
    const after = groups.map((g) => g.className);

    const swapped = groups.flatMap((_, i) => {
      const a = before[i].split(/\s+/).filter(Boolean);
      const b = after[i].split(/\s+/).filter(Boolean);
      return [...a.filter((c) => !b.includes(c)), ...b.filter((c) => !a.includes(c))];
    });
    expect(swapped.length, "only the two END groups move; the <nav> between them stays put").toBe(4);
    for (const token of swapped) {
      expect(token, `"${token}" is not a translate — it would re-lay the header row out`).toMatch(
        /^\[translate:/,
      );
    }
    // The pull itself is one inherited custom property, declared on the header for every breakpoint.
    expect(headerEl().className).toMatch(/\[--island-pull:/);
  });

  it("keeps the burger, the language group and the CTA through a crossing", async () => {
    renderNav();
    await scrollTo(CONDENSE_AT + 40);

    expect(screen.getByRole("button", { name: "Meniu" })).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Limbă / Язык / Language" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(1);
  });
});
