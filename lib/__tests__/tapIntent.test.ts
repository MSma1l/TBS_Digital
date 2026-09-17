import { describe, expect, it } from "vitest";
import { isTouchLike, shouldInterceptTap } from "@/lib/tapIntent";

/*
 * "First tap reveals, second tap follows" (lib/tapIntent.ts) — the header dropdowns and the
 * direction pills share the rule; navbar-menu.test.tsx pins the header's use of it.
 */

describe("isTouchLike", () => {
  const table: Array<[string, boolean]> = [
    ["touch", true],
    ["pen", true],
    ["mouse", false],
    ["keyboard", false],
    ["", false],
  ];

  for (const [pointerType, expected] of table) {
    it(`"${pointerType}" → ${expected}`, () => {
      expect(isTouchLike(pointerType)).toBe(expected);
    });
  }
});

describe("shouldInterceptTap", () => {
  it("intercepts only a first touch or pen tap on a target that reveals something", () => {
    for (const pointerType of ["touch", "pen"]) {
      expect(shouldInterceptTap({ hasChildren: true, pointerType, openedByTap: false })).toBe(true);
      expect(shouldInterceptTap({ hasChildren: true, pointerType, openedByTap: true })).toBe(false);
      expect(shouldInterceptTap({ hasChildren: false, pointerType, openedByTap: false })).toBe(false);
    }
    for (const pointerType of ["mouse", "keyboard", ""]) {
      expect(shouldInterceptTap({ hasChildren: true, pointerType, openedByTap: false })).toBe(false);
    }
  });

  it("agrees with isTouchLike on which pointers count", () => {
    for (const pointerType of ["touch", "pen", "mouse", "keyboard", "", "unknown"]) {
      expect(shouldInterceptTap({ hasChildren: true, pointerType, openedByTap: false })).toBe(
        isTouchLike(pointerType),
      );
    }
  });
});
