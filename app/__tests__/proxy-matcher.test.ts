import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

/*
 * The proxy's matcher — which requests get `x-pathname`, `x-locale`, the nonce and the CSP.
 *
 * This is a one-line config with page-level consequences, which is exactly why it is pinned
 * here. The root layout reads `x-pathname` to build the self-canonical and the hreflang set. A
 * request that skips the proxy therefore gets a page with no canonical and no CSP — and it is
 * served to a REAL VISITOR whenever a browser preloads the URL it predicted from its own history
 * (Chrome's omnibox sends the legacy `Purpose: prefetch` header on that document request).
 *
 * Next's CSP guide lists both prefetch headers in `missing`, and that recipe is right for a
 * proxy that only adds a nonce. It is wrong here, and this file is the reason why.
 */

const rules = config.matcher as ReadonlyArray<{
  source: string;
  missing?: ReadonlyArray<{ type: string; key: string; value?: string }>;
}>;

describe("the proxy's matcher", () => {
  it("is one rule over every page document", () => {
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/((?!api|_next/static|_next/image|icon.svg).*)");
  });

  it("skips the router's own RSC prefetch, and NOTHING else", () => {
    const missing = rules[0].missing ?? [];
    expect(missing).toEqual([{ type: "header", key: "next-router-prefetch" }]);
  });

  it("never excludes a browser's document prefetch (`Purpose: prefetch`)", () => {
    const missing = rules[0].missing ?? [];
    const purpose = missing.filter((rule) => rule.key.toLowerCase() === "purpose");
    expect(
      purpose,
      "a browser-preloaded document must be the same document as a typed one: canonical and CSP included",
    ).toEqual([]);
  });
});
