// The demo manifest is the boundary every link and label in /portofoliu's screen comes through
// (lib/siteDemo.ts). Pinned because a slip there is silent: a link out to another site, a
// hotspot drawn from bad numbers, a label carrying markup — none of it would fail a page load.
import { describe, expect, it } from "vitest";
import { deepLink, demoStep, parseManifest, startNav } from "../siteDemo";

const shot = (hot: unknown[], extra: Record<string, unknown> = {}) => ({
  src: "/projects/demo/x/acasa-d.webp",
  w: 1440,
  h: 3000,
  hot,
  ...extra,
});
const manifest = (pages: unknown[], extra: Record<string, unknown> = {}) => ({
  v: 1,
  lang: "ro",
  start: "acasa",
  pages,
  ...extra,
});

describe("parseManifest", () => {
  it("keeps what checks out and drops each hotspot that does not", () => {
    const m = parseManifest(
      manifest([
        {
          id: "acasa",
          title: "Acasă",
          path: "/",
          d: shot([
            { r: [10, 10, 100, 40], t: "Teste", k: "page", to: "test", el: "link" },
            { r: [10, 60, 100, 40], t: "Lipsă", k: "page", to: "nu-exista" }, // no such page
            { r: [10, 110, 100, 40], t: "Rău", k: "site", path: "javascript:alert(1)" },
            { r: [10, 160, 100, 40], t: "Afară", k: "site", path: "//evil.example/x" },
            { r: [10, 210, 100, 40], t: "a\u0000b", k: "anchor", at: 900 }, // control character
            { r: [1400, 2990, 500, 500], t: "Jos", k: "anchor", at: 99999 }, // clipped into the shot
            { r: [5000, 10, 10, 10], t: "Nicăieri", k: "site" }, // wholly outside: no size left
          ]),
        },
        { id: "test", title: "Test", path: "/test", d: shot([]) },
      ]),
    );
    expect(m).not.toBeNull();
    const hot = m!.pages[0].d.hot;
    expect(hot.map((h) => h.t)).toEqual(["Teste", "Jos"]);
    expect(hot[1].r).toEqual([1400, 2990, 40, 10]);
    expect(hot[1].at).toBe(3000);
  });

  it("refuses a manifest whose shape is wrong", () => {
    const page = { id: "acasa", title: "Acasă", d: shot([]) };
    expect(parseManifest(manifest([page], { v: 2 }))).toBeNull();
    expect(parseManifest(manifest([page], { lang: "de" }))).toBeNull();
    expect(parseManifest(manifest([page], { start: "alta" }))).toBeNull();
    expect(parseManifest(manifest([page, page]))).toBeNull(); // the same id twice
    expect(parseManifest(manifest([{ ...page, id: "Acasă!" }], { start: "Acasă!" }))).toBeNull();
    expect(parseManifest(manifest([{ ...page, d: shot([], { src: "https://evil.example/a.webp" }) }]))).toBeNull();
    expect(parseManifest(manifest([{ ...page, d: shot([], { w: 0 }) }]))).toBeNull();
    expect(parseManifest("not a manifest")).toBeNull();
  });
});

describe("deepLink", () => {
  it("never leaves the project's own site", () => {
    expect(deepLink("/test/bizcheck", "https://bizcheck.md")).toBe("https://bizcheck.md/test/bizcheck");
    expect(deepLink(undefined, "https://bizcheck.md")).toBe("https://bizcheck.md/");
    expect(deepLink("//evil.example/x", "https://bizcheck.md")).toBeNull();
    expect(deepLink("https://evil.example/", "https://bizcheck.md")).toBeNull();
    expect(deepLink("/x", "javascript:alert(1)")).toBeNull();
    expect(deepLink("/x", "")).toBeNull(); // a private project: no site to send anyone to
  });
});

describe("demoStep", () => {
  it("goes, remembers where it was, and comes back", () => {
    let nav = startNav("acasa");
    nav = demoStep(nav, { type: "prompt", prompt: { label: "Intră" } });
    nav = demoStep(nav, { type: "go", page: "test", share: 0.4 });
    expect(nav).toEqual({ page: "test", back: [{ page: "acasa", share: 0.4 }], prompt: null, list: false });
    nav = demoStep(nav, { type: "back" });
    expect(nav.page).toBe("acasa");
    expect(nav.back).toEqual([]);
    expect(demoStep(nav, { type: "back" })).toBe(nav); // nothing behind: nothing changes
  });
});
