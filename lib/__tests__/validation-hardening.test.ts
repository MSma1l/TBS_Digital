import { describe, it, expect } from "vitest";
import { LIMITS, validateText } from "@/lib/validation";

/*
 * Regression tests locking in the hardened `validateText` check ordering:
 *   required  →  length  →  dangerous-content  →  format
 *
 * The length check now runs BEFORE the dangerous-content regexes so that an
 * over-long input is rejected on length before any regex is evaluated
 * (defense-in-depth; the regexes are linear, so this is not exploitable, but
 * length-first is the safer order). See lib/validation.ts.
 */
describe("validateText hardening: length-before-dangerous ordering", () => {
  const label = "Numele";

  it("returns the LENGTH error when input is BOTH too long AND dangerous", () => {
    // "<script>" makes it dangerous; the padding pushes it past the max.
    const tooLongAndDangerous = "<script>" + "a".repeat(LIMITS.name + 50);
    expect(validateText(tooLongAndDangerous, { label, max: LIMITS.name })).toBe(
      `${label} depășește ${LIMITS.name} de caractere.`,
    );
  });

  it("still returns the DANGEROUS error for a normal (within-length) dangerous input", () => {
    const shortDangerous = "<script>alert(1)</script>";
    // Well under the max, so length passes and the dangerous check fires.
    expect(shortDangerous.length).toBeLessThanOrEqual(LIMITS.name);
    expect(validateText(shortDangerous, { label, max: LIMITS.name })).toBe(
      `${label} conține caractere sau cod nepermis.`,
    );
  });

  it("still lets REQUIRED win for empty input (even before length/dangerous)", () => {
    expect(validateText("", { label, max: LIMITS.name, required: true })).toBe(
      `${label} este obligatoriu.`,
    );
    // Whitespace-only is empty post-trim, so required still wins.
    expect(validateText("   ", { label, max: LIMITS.name, required: true })).toBe(
      `${label} este obligatoriu.`,
    );
  });
});
