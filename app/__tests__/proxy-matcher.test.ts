import { describe, expect, it } from "vitest";
import { config } from "@/proxy";
import { shouldPlayIntro } from "@/lib/intro";

/*
 * The proxy's matcher — which requests get `x-pathname`, `x-locale`, the nonce and the CSP.
 *
 * This is a one-line config with three page-level consequences, which is exactly why it is
 * pinned here. The root layout reads `x-pathname` to build the self-canonical and the hreflang
 * set, and to decide whether the first-visit intro is rendered at all (`shouldPlayIntro`). A
 * request that skips the proxy therefore gets a page with no canonical, no intro and no CSP —
 * and it is served to a REAL VISITOR whenever a browser preloads the URL it predicted from its
 * own history (Chrome's omnibox sends the legacy `Purpose: prefetch` header on that document
 * request). That is what happened on 2026-09-25: the owner, whose browser predicts this site
 * every time, had not seen the intro for days, while a fresh profile always did.
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
      "a browser-preloaded document must be the same document as a typed one: intro, canonical and CSP included",
    ).toEqual([]);
  });

  it("is load-bearing: without `x-pathname` the home page renders no intro", () => {
    // The gate the layout calls with `requestHeaders.get("x-pathname")`.
    expect(shouldPlayIntro("/", null)).toBe(true);
    expect(shouldPlayIntro(null, null)).toBe(false);
    expect(shouldPlayIntro(undefined, null)).toBe(false);
  });
});
