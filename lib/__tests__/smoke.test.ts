import { describe, it, expect } from "vitest";
import { isNetworkError, isUnauthorized, ApiError } from "@/lib/api";

// Smoke test: confirms the Vitest + `@/*` alias + jsdom setup works.
describe("test infra smoke", () => {
  it("resolves the @/ alias and runs assertions", () => {
    expect(isNetworkError(new ApiError(0, "x"))).toBe(true);
    expect(isUnauthorized(new ApiError(401, "x"))).toBe(true);
    expect(isNetworkError(new ApiError(500, "x"))).toBe(false);
  });

  it("has a jsdom document", () => {
    expect(typeof document).toBe("object");
    document.body.innerHTML = "<span>hi</span>";
    expect(document.querySelector("span")?.textContent).toBe("hi");
  });
});
