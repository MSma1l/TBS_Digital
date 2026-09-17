import { describe, expect, it } from "vitest";
import { covers, overlaps, type RectLike } from "@/lib/hud/obscure";

/*
 * The HUD's Focus Not Obscured maths (lib/hud/obscure.ts). Boxes are viewport rectangles:
 * left/top inclusive, right/bottom the far edges, as `getBoundingClientRect()` reports them.
 */

const rect = (left: number, top: number, right: number, bottom: number): RectLike => ({
  left,
  top,
  right,
  bottom,
});

const WINDOW = rect(12, 76, 1224, 688);

describe("covers", () => {
  it("is true only when the inner box is entirely inside", () => {
    expect(covers(WINDOW, rect(100, 100, 300, 140))).toBe(true);
    expect(covers(WINDOW, WINDOW), "the same box").toBe(true);
    expect(covers(WINDOW, rect(12, 76, 60, 120)), "sharing the top-left corner").toBe(true);
    expect(covers(WINDOW, rect(1180, 650, 1224, 688)), "sharing the bottom-right corner").toBe(true);
  });

  it("is false when any edge sticks out", () => {
    expect(covers(WINDOW, rect(11, 100, 60, 140)), "left").toBe(false);
    expect(covers(WINDOW, rect(100, 75, 160, 140)), "top").toBe(false);
    expect(covers(WINDOW, rect(1200, 100, 1225, 140)), "right").toBe(false);
    expect(covers(WINDOW, rect(100, 660, 160, 689)), "bottom").toBe(false);
    expect(covers(WINDOW, rect(0, 0, 1280, 800)), "the other way round").toBe(false);
    expect(covers(WINDOW, rect(1300, 900, 1340, 944)), "elsewhere").toBe(false);
  });

  it("accepts a DOMRect as it is", () => {
    const focused = { x: 100, y: 100, width: 40, height: 40, left: 100, top: 100, right: 140, bottom: 140 };
    expect(covers(WINDOW, focused)).toBe(true);
  });

  it("says no to numbers it cannot trust", () => {
    expect(covers(WINDOW, rect(Number.NaN, 100, 140, 140))).toBe(false);
    expect(covers(rect(0, 0, Number.POSITIVE_INFINITY, 800), rect(10, 10, 20, 20))).toBe(false);
    expect(covers(rect(Number.NEGATIVE_INFINITY, 0, 100, 100), rect(10, 10, 20, 20))).toBe(false);
  });
});

describe("overlaps", () => {
  const AVATAR = rect(1172, 692, 1260, 780);

  it("is true when the boxes share an area, in either order", () => {
    expect(overlaps(AVATAR, rect(1100, 700, 1180, 740))).toBe(true);
    expect(overlaps(rect(1100, 700, 1180, 740), AVATAR)).toBe(true);
    expect(overlaps(AVATAR, rect(1200, 720, 1210, 730)), "inside").toBe(true);
    expect(overlaps(rect(1200, 720, 1210, 730), AVATAR), "around").toBe(true);
    expect(overlaps(AVATAR, AVATAR)).toBe(true);
  });

  it("is false for boxes that only touch or are apart", () => {
    expect(overlaps(AVATAR, rect(1100, 700, 1172, 740)), "touching the left edge").toBe(false);
    expect(overlaps(AVATAR, rect(1180, 650, 1220, 692)), "touching the top edge").toBe(false);
    expect(overlaps(AVATAR, rect(1260, 780, 1280, 800)), "touching a corner").toBe(false);
    expect(overlaps(AVATAR, rect(0, 0, 100, 100)), "apart").toBe(false);
  });

  it("is false for an empty box, even one inside the other", () => {
    expect(overlaps(AVATAR, rect(1200, 720, 1200, 760)), "no width").toBe(false);
    expect(overlaps(AVATAR, rect(1200, 720, 1240, 720)), "no height").toBe(false);
    expect(overlaps(AVATAR, rect(1240, 760, 1200, 720)), "inverted").toBe(false);
  });

  it("says no to numbers it cannot trust", () => {
    expect(overlaps(AVATAR, rect(Number.NaN, 700, 1200, 740))).toBe(false);
    expect(overlaps(rect(0, 0, Number.POSITIVE_INFINITY, 800), AVATAR)).toBe(false);
  });
});
