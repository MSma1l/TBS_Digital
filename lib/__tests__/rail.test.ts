import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RAIL_EPSILON,
  RAIL_LABEL_MAX,
  RAIL_MAX_MARKERS,
  RAIL_MIN_GAP,
  activeIndex,
  crossedDown,
  pickRailSections,
  progressOf,
  railHasNav,
  railLabel,
  railLayout,
  sectionTarget,
  type RailHeading,
} from "@/lib/hud/rail";

/*
 * The fibre rail's maths (lib/hud/rail.ts): scroll progress, where a jump lands, the marker
 * layout along the rail (proportional, spaced, kept inside, spread evenly when it cannot be),
 * the current section, the ticks a downward scroll passes, and the headings that name a page's
 * sections. The DOM side is scroll-rail.test.tsx's.
 */

describe("constants", () => {
  it("a 44px gap, at most 8 markers with a nav, 60-character labels, a 1px reach", () => {
    expect(RAIL_MIN_GAP).toBe(44);
    expect(RAIL_MAX_MARKERS).toBe(8);
    expect(RAIL_LABEL_MAX).toBe(60);
    expect(RAIL_EPSILON).toBe(1);
  });
});

describe("progressOf", () => {
  it("is y over max", () => {
    expect(progressOf(0, 1000)).toBe(0);
    expect(progressOf(250, 1000)).toBe(0.25);
    expect(progressOf(1000, 1000)).toBe(1);
  });

  it("clamps to [0, 1]", () => {
    expect(progressOf(-40, 1000)).toBe(0);
    expect(progressOf(1200, 1000)).toBe(1);
  });

  it("is 0 on a page that cannot scroll (max 0 or less), and for a non-finite input", () => {
    expect(progressOf(0, 0)).toBe(0);
    expect(progressOf(300, 0)).toBe(0);
    expect(progressOf(300, -5)).toBe(0);
    expect(progressOf(Number.NaN, 1000)).toBe(0);
    expect(progressOf(300, Number.NaN)).toBe(0);
    expect(progressOf(300, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("sectionTarget", () => {
  it("is the document top less the header", () => {
    expect(sectionTarget(1571, 71, 5000)).toBe(1500);
  });

  it("never goes above 0 (the hero under the header) nor past the end", () => {
    expect(sectionTarget(0, 71, 5000)).toBe(0);
    expect(sectionTarget(40, 71, 5000)).toBe(0);
    expect(sectionTarget(4900, 71, 4000)).toBe(4000);
  });

  it("is 0 on a page that cannot scroll", () => {
    expect(sectionTarget(900, 71, 0)).toBe(0);
    expect(sectionTarget(900, 71, -200)).toBe(0);
  });

  it("reads a non-finite header as 0 and a non-finite top as 0", () => {
    expect(sectionTarget(900, Number.NaN, 5000)).toBe(900);
    expect(sectionTarget(Number.NaN, 71, 5000)).toBe(0);
  });
});

describe("railLayout", () => {
  it("places markers proportionally to their targets' progress", () => {
    expect(railLayout([0, 1000, 2000, 4000], 4000, 400)).toEqual([0, 100, 200, 400]);
    expect(railLayout([500, 3000], 4000, 400)).toEqual([50, 300]);
  });

  it("rounds to whole pixels", () => {
    expect(railLayout([1000], 3000, 500)).toEqual([167]);
  });

  it("pushes crowded markers forward to keep the gap", () => {
    // 0, 10, 20 would overlap: 0, 44, 88.
    expect(railLayout([0, 100, 200], 4000, 400)).toEqual([0, 44, 88]);
    expect(railLayout([0, 100, 200], 4000, 400, 30)).toEqual([0, 30, 60]);
  });

  it("pulls crowded markers back from the end so the last stays inside", () => {
    // All at the end: 400, 400, 400 → 312, 356, 400.
    expect(railLayout([4000, 4000, 4000], 4000, 400)).toEqual([312, 356, 400]);
    // Pushed forward past the end, then pulled back.
    expect(railLayout([0, 3700, 3800, 3900], 4000, 400)).toEqual([0, 312, 356, 400]);
  });

  it("keeps every gap and every marker inside the rail whenever it can", () => {
    const targets = [0, 20, 40, 2100, 2110, 3990, 4000];
    const y = railLayout(targets, 4000, 600);
    expect(y).toHaveLength(targets.length);
    for (let i = 1; i < y.length; i++) expect(y[i] - y[i - 1]).toBeGreaterThanOrEqual(RAIL_MIN_GAP);
    expect(y[0]).toBeGreaterThanOrEqual(0);
    expect(y[y.length - 1]).toBeLessThanOrEqual(600);
  });

  it("spreads markers evenly when the rail is too short for the gap", () => {
    // 5 markers need 176px; the rail has 100.
    expect(railLayout([0, 10, 20, 30, 40], 4000, 100)).toEqual([0, 25, 50, 75, 100]);
    expect(railLayout([0, 4000], 4000, 30)).toEqual([0, 30]);
  });

  it("puts a single marker at its own progress", () => {
    expect(railLayout([2000], 4000, 400)).toEqual([200]);
    expect(railLayout([0], 0, 400)).toEqual([0]);
  });

  it("gives nothing for no targets, or a rail with no height", () => {
    expect(railLayout([], 4000, 400)).toEqual([]);
    expect(railLayout([0, 1000], 4000, 0)).toEqual([]);
    expect(railLayout([0, 1000], 4000, -10)).toEqual([]);
    expect(railLayout([0, 1000], 4000, Number.NaN)).toEqual([]);
  });

  it("does not change its input", () => {
    const targets = [0, 10, 20];
    railLayout(targets, 4000, 400);
    expect(targets).toEqual([0, 10, 20]);
  });
});

describe("activeIndex", () => {
  const targets = [0, 800, 1600, 2400];

  it("is the last section whose target the scroll has reached", () => {
    expect(activeIndex(0, targets)).toBe(0);
    expect(activeIndex(798, targets)).toBe(0);
    expect(activeIndex(800, targets)).toBe(1);
    expect(activeIndex(2000, targets)).toBe(2);
    expect(activeIndex(9999, targets)).toBe(3);
  });

  it("counts a scroll that stopped within 1px short as arrived", () => {
    expect(activeIndex(799.5, targets)).toBe(1);
    expect(activeIndex(798.9, targets)).toBe(0);
  });

  it("is the first before any target, and 0 with none", () => {
    expect(activeIndex(100, [400, 900])).toBe(0);
    expect(activeIndex(100, [])).toBe(0);
  });
});

describe("crossedDown", () => {
  const targets = [0, 800, 1600, 2400];

  it("returns the one tick a scroll down passes", () => {
    expect(crossedDown(700, 900, targets)).toEqual([1]);
  });

  it("returns both ticks when one jump crosses two", () => {
    expect(crossedDown(700, 1700, targets)).toEqual([1, 2]);
    expect(crossedDown(100, 5000, targets)).toEqual([1, 2, 3]);
  });

  it("returns nothing when scrolling up, or not moving", () => {
    expect(crossedDown(1700, 700, targets)).toEqual([]);
    expect(crossedDown(900, 900, targets)).toEqual([]);
  });

  it("returns nothing for a scroll between ticks, or past an already-passed one", () => {
    expect(crossedDown(900, 1500, targets)).toEqual([]);
    expect(crossedDown(800, 1000, targets)).toEqual([]);
  });

  it("pulses a tick exactly when it turns passed, the 1px reach included", () => {
    expect(crossedDown(700, 799.5, targets)).toEqual([1]);
    expect(crossedDown(799.5, 900, targets)).toEqual([]);
    for (const [prev, next] of [
      [0, 1],
      [0, 799],
      [650, 1599.2],
      [1599, 1601],
      [10, 2400],
    ]) {
      const passedNow = targets.flatMap((_, i) => (i <= activeIndex(next, targets) && i > activeIndex(prev, targets) ? [i] : []));
      expect(crossedDown(prev, next, targets), `${prev} → ${next}`).toEqual(passedNow);
    }
  });
});

describe("railLabel", () => {
  it("collapses whitespace and trims", () => {
    expect(railLabel("  Cum\n   lucrăm \t pas cu pas ")).toBe("Cum lucrăm pas cu pas");
  });

  it("joins text pieces with a space, never before punctuation", () => {
    expect(railLabel(["01", "Ce sunt cookie-urile"])).toBe("01 Ce sunt cookie-urile");
    expect(railLabel(["Proiecte", "."])).toBe("Proiecte.");
    expect(railLabel(["Întrebări", "?", "(", "FAQ", ")"])).toBe("Întrebări? ( FAQ)");
  });

  it("clips to 60 characters with an ellipsis", () => {
    const long = "A".repeat(59) + " BCDEFG";
    const clipped = railLabel(long);
    expect(Array.from(clipped)).toHaveLength(RAIL_LABEL_MAX);
    expect(clipped.endsWith("…")).toBe(true);
    expect(railLabel("x".repeat(60))).toBe("x".repeat(60));
  });

  it("drops the space before the ellipsis, and never splits a surrogate pair", () => {
    expect(railLabel("a".repeat(58) + " bbbb")).toBe("a".repeat(58) + "…");
    const emoji = "😀".repeat(70);
    const clipped = railLabel(emoji);
    expect(Array.from(clipped)).toHaveLength(RAIL_LABEL_MAX);
    expect(clipped).toBe("😀".repeat(59) + "…");
  });

  it("is empty for a heading with no text", () => {
    expect(railLabel(["", "  \n "])).toBe("");
  });
});

describe("pickRailSections", () => {
  const heading = (over: Partial<RailHeading<string>>): RailHeading<string> => ({
    section: "s",
    text: "Heading",
    excluded: false,
    sectionH2s: 1,
    ...over,
  });

  it("names one section per heading, in order", () => {
    expect(
      pickRailSections([
        heading({ section: "hero", text: "Magazin online", sectionH2s: 0 }),
        heading({ section: "steps", text: ["Cum", " lucrăm"] }),
        heading({ section: "bottom", text: "Hai să vorbim" }),
      ]),
    ).toEqual([
      { section: "hero", label: "Magazin online" },
      { section: "steps", label: "Cum lucrăm" },
      { section: "bottom", label: "Hai să vorbim" },
    ]);
  });

  it("skips excluded headings (header, footer, dialog, aria-hidden, guide, rail)", () => {
    expect(pickRailSections([heading({ section: "a", excluded: true }), heading({ section: "b" })])).toEqual([
      { section: "b", label: "Heading" },
    ]);
  });

  it("skips headings with no section, and sections holding more than one h2", () => {
    expect(
      pickRailSections([
        heading({ section: null, text: "Loose" }),
        heading({ section: "list", text: "Item one", sectionH2s: 3 }),
        heading({ section: "list", text: "Item two", sectionH2s: 3 }),
        heading({ section: "one", text: "One", sectionH2s: 1 }),
      ]),
    ).toEqual([{ section: "one", label: "One" }]);
  });

  it("takes a section's first heading only", () => {
    expect(
      pickRailSections([
        heading({ section: "hero", text: "Title", sectionH2s: 1 }),
        heading({ section: "hero", text: "Subtitle", sectionH2s: 1 }),
      ]),
    ).toEqual([{ section: "hero", label: "Title" }]);
  });

  it("lets a heading with no text name nothing, and the section's next heading name it", () => {
    expect(
      pickRailSections([heading({ section: "a", text: "  " }), heading({ section: "a", text: "Real" })]),
    ).toEqual([{ section: "a", label: "Real" }]);
  });

  it("clips labels like railLabel", () => {
    const [picked] = pickRailSections([heading({ text: "z".repeat(90) })]);
    expect(picked.label).toBe(`${"z".repeat(59)}…`);
  });

  it("gives nothing for no headings", () => {
    expect(pickRailSections([])).toEqual([]);
  });
});

describe("railHasNav", () => {
  it("draws a nav for 1 to 8 markers, the fibre only for 0 or more than 8", () => {
    expect(railHasNav(0)).toBe(false);
    expect(railHasNav(1)).toBe(true);
    expect(railHasNav(8)).toBe(true);
    expect(railHasNav(9)).toBe(false);
  });
});

describe("lib/hud/rail stays pure", () => {
  const withoutComments = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

  /** Every module a source names: static and side-effect imports, re-exports, import(), require(). */
  const specifiers = (src: string) =>
    [
      ...src.matchAll(/\bfrom\s*["']([^"']+)["']/g),
      ...src.matchAll(/\bimport\s*["']([^"']+)["']/g),
      ...src.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
      ...src.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g),
    ].map((m) => m[1]);

  const source = withoutComments(readFileSync(resolve(process.cwd(), "lib/hud/rail.ts"), "utf8"));

  it("pins the import detector on fixtures", () => {
    const fixture = `import { useState } from "react"; import "three"; export { x } from "./x";
      const m = await import("@/lib/scene"); const s = require("@/lib/scrollLock");
      import type { RailLabel } from "@/components/hud/rail/copy";`;
    expect(specifiers(fixture)).toEqual([
      "react",
      "./x",
      "@/components/hud/rail/copy",
      "three",
      "@/lib/scene",
      "@/lib/scrollLock",
    ]);
  });

  it("imports nothing at all (not even types)", () => {
    expect(specifiers(source)).toEqual([]);
  });

  it("has no client directive and reads no global: no DOM, no storage, no clock", () => {
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(
      /\b(window|document|globalThis|localStorage|sessionStorage|navigator|performance|Date|setTimeout|requestAnimationFrame|getComputedStyle|getBoundingClientRect|matchMedia)\b/,
    );
  });

  describe("without a DOM", () => {
    beforeEach(() => {
      vi.resetModules();
      vi.stubGlobal("window", undefined);
      vi.stubGlobal("document", undefined);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("imports and computes", async () => {
      expect(typeof window).toBe("undefined");
      const rail = await import("@/lib/hud/rail");
      expect(rail.railLayout([0, 2000], 4000, 400)).toEqual([0, 200]);
      expect(rail.sectionTarget(571, 71, 4000)).toBe(500);
      expect(rail.pickRailSections([{ section: 1, text: "A", excluded: false, sectionH2s: 1 }])).toEqual([
        { section: 1, label: "A" },
      ]);
    });
  });
});
