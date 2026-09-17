import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_QUERY, TILT_MAX, TILT_QUERY, shouldTilt, tiltFor } from "@/lib/tilt";

/*
 * The card tilt's maths (lib/tilt.ts): the edge under the pointer dips away from the viewer,
 * clamped to the card, and only a real mouse ever tilts.
 */

const rect = { left: 100, top: 200, width: 200, height: 100 };
const MAX = 8;

describe("tiltFor", () => {
  it("is flat at the centre", () => {
    expect(tiltFor(200, 250, rect, MAX)).toEqual({ rx: 0, ry: 0 });
  });

  it("tips the top-left corner away: +rx, -ry", () => {
    expect(tiltFor(100, 200, rect, MAX)).toEqual({ rx: MAX, ry: -MAX });
  });

  it("tips the bottom-right corner away: -rx, +ry", () => {
    expect(tiltFor(300, 300, rect, MAX)).toEqual({ rx: -MAX, ry: MAX });
  });

  it("clamps a pointer outside the card to the edge", () => {
    expect(tiltFor(-500, 9999, rect, MAX)).toEqual({ rx: -MAX, ry: -MAX });
  });

  it("never tilts a card with no area, or on nonsense input", () => {
    expect(tiltFor(10, 10, { ...rect, width: 0 }, MAX)).toEqual({ rx: 0, ry: 0 });
    expect(tiltFor(10, 10, { ...rect, height: Number.NaN }, MAX)).toEqual({ rx: 0, ry: 0 });
    expect(tiltFor(Number.NaN, 250, rect, MAX)).toEqual({ rx: 0, ry: 0 });
  });

  it("rounds to two decimals and never prints -0", () => {
    const { rx, ry } = tiltFor(133.333, 250, rect, MAX);
    expect(ry).toBe(-5.33);
    expect(Object.is(rx, -0)).toBe(false);
    expect(`${rx}deg`).toBe("0deg");
  });

  it("keeps each card kind's maximum", () => {
    expect(TILT_MAX).toEqual({ metric: 8, project: 6 });
    expect(tiltFor(300, 300, rect, TILT_MAX.project)).toEqual({ rx: -6, ry: 6 });
  });
});

describe("shouldTilt", () => {
  const table: Array<[boolean, boolean, string, boolean]> = [
    [false, true, "mouse", true],
    [false, true, "touch", false],
    [false, true, "pen", false],
    [false, true, "", false],
    [false, false, "mouse", false],
    [true, true, "mouse", false],
    [true, false, "touch", false],
  ];

  for (const [reducedMotion, finePointer, pointerType, expected] of table) {
    it(`reducedMotion=${reducedMotion} finePointer=${finePointer} "${pointerType}" → ${expected}`, () => {
      expect(shouldTilt({ reducedMotion, finePointer, pointerType })).toBe(expected);
    });
  }

  it("names the media queries it is read from", () => {
    expect(TILT_QUERY).toBe("(hover: hover) and (pointer: fine)");
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });
});
