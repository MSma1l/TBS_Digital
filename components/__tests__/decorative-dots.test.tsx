import { existsSync, readdirSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { SceneStage } from "@/components/scene/SceneStage";
import { Directions } from "@/components/sections/Directions";
import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { Work } from "@/components/sections/Work";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { SiteContentProvider } from "@/lib/siteContent";
import { SoundProvider } from "@/lib/sound";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

/*
 * No decorative dots (the interior redesign's first decision): the SYS_TIME pip, the eyebrow
 * dot, the stat-note pips, the ticker's round separators, the logo's glowing halo and the
 * estimator's status dot are gone, and must not come back. Kept on purpose, and not scanned
 * here: the "TBS." and title full stops as plain red glyphs, the footer's red ".", the
 * dictation button's recording dot (a privacy indicator), ✓ list markers, every "·" in copy,
 * and the intro fallback.
 *
 * Two layers: the source (class strings, keyframes, art markup), and what the home page's
 * first screen and interior actually render in every locale.
 */

const ROOT = process.cwd();
const read = (repoPath: string) => readFileSync(resolve(ROOT, repoPath), "utf8");

const SCANNED_SOURCES = [
  "components/layout/Navbar.tsx",
  "components/layout/HeaderClock.tsx",
  "components/sections/Hero.tsx",
  "components/sections/Ticker.tsx",
  "components/sections/Directions.tsx",
  "components/sections/Work.tsx",
  "components/scene/SceneStage.tsx",
  "components/scene/art/HeroCoreArt.tsx",
  "components/scene/art/ServiceArt.tsx",
  "components/hud/guide/GuideAssistant.tsx",
];

/**
 * The HUD chrome's CSS Modules (critique R13/§4: the guide now, the rail and the OS layer
 * later). The guide's is named so a rename cannot silently drop it from the scan.
 */
const HUD_STYLES = ["components/hud/guide/GuideAssistant.module.css"];

/**
 * Round boxes of dot size in a CSS Module: a rule whose `border-radius` is `50%` or
 * `var(--r-pill)` (999px) and whose width or height is ≤ 8px. A size given as `var(--x)` is
 * resolved against the `--x: Npx` declarations in the same file (its smallest value), so a
 * token-sized ring cannot dodge the rule. Comments are stripped first.
 */
function cssDots(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map<string, number>();
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([\d.]+)px\s*[;}]/g)) {
    const value = Number(m[2]);
    tokens.set(m[1], Math.min(tokens.get(m[1]) ?? Infinity, value));
  }
  const sizeOf = (raw: string): number | null => {
    const value = raw.trim();
    const px = value.match(/^([\d.]+)px$/);
    if (px) return Number(px[1]);
    const token = value.match(/^var\((--[\w-]+)\)$/);
    return token && tokens.has(token[1]) ? tokens.get(token[1])! : null;
  };
  const hits: string[] = [];
  for (const rule of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = rule[2];
    if (!/border-radius\s*:\s*(?:50%|var\(--r-pill\))\s*(?:;|$)/m.test(body)) continue;
    for (const size of body.matchAll(/(?:^|[;\s])(width|height|inline-size|block-size)\s*:\s*([^;]+)/g)) {
      const px = sizeOf(size[2]);
      if (px !== null && px <= 8) hits.push(`${rule[1].trim()} { ${size[1]}: ${size[2].trim()} }`);
    }
  }
  return hits;
}

/** The art's CSS Modules, whichever exist yet. */
const ART_STYLES = existsSync(resolve(ROOT, "components/scene/art"))
  ? readdirSync(resolve(ROOT, "components/scene/art"))
      .filter((name) => name.endsWith(".module.css"))
      .map((name) => posix.join("components/scene/art", name))
  : [];

/** Every string and template literal in a source file, one entry each. */
function literals(src: string): string[] {
  return [...src.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)].map((m) =>
    m[0].slice(1, -1),
  );
}

/** A utility without its variants (`after:size-[.3em]` → `size-[.3em]`). */
const base = (token: string) => token.slice(token.lastIndexOf(":") + 1);

/** A box no bigger than a dot: ≤ 2 spacing steps (8px), 1px, ≤ 8px or under 1em. */
const DOT_SIZE =
  /^(?:size|w|h)-(?:0\.5|1|1\.5|2|px|\[(?:[0-7](?:\.\d+)?px|8px|0?\.\d+em)\])$/;

/**
 * A radius that makes a dot-sized box round: `rounded-full`, the theme's `rounded-pill`
 * (--radius-pill, 999px — what the direction pills use) and the arbitrary 50% / 999px / 9999px.
 */
const ROUND = /^rounded-(?:full|pill|\[(?:50%|999px|9999px)\])$/;

/** Class strings that draw a round dot: a round radius together with a dot-sized box. */
function roundDots(classes: string): string[] {
  const tokens = classes.split(/\s+/).filter(Boolean).map(base);
  return tokens.some((token) => ROUND.test(token)) ? tokens.filter((token) => DOT_SIZE.test(token)) : [];
}

describe("decorative dots — source", () => {
  it("pins the dot detector on fixtures", () => {
    expect(roundDots("size-1.5 shrink-0 rounded-full bg-red")).toEqual(["size-1.5"]);
    expect(roundDots("after:size-[.3em] after:rounded-full after:bg-red")).toEqual(["size-[.3em]"]);
    expect(roundDots("h-2 w-2 rounded-full")).toEqual(["h-2", "w-2"]);
    expect(roundDots("size-[8px] rounded-full")).toEqual(["size-[8px]"]);
    // Every spelling of "fully round", the theme's pill radius included.
    expect(roundDots("size-1.5 shrink-0 rounded-pill bg-green-text")).toEqual(["size-1.5"]);
    expect(roundDots("before:size-2 before:rounded-pill")).toEqual(["size-2"]);
    expect(roundDots("size-2 rounded-[50%] bg-red")).toEqual(["size-2"]);
    expect(roundDots("h-1.5 w-1.5 rounded-[999px]")).toEqual(["h-1.5", "w-1.5"]);
    expect(roundDots("size-px rounded-[9999px]")).toEqual(["size-px"]);
    // Big round glows, a hairline, a pill: not dots.
    expect(roundDots("size-[62vmax] rounded-full bg-[radial-gradient(closest-side,var(--x),transparent)]")).toEqual([]);
    expect(roundDots("before:size-120 before:rounded-full")).toEqual([]);
    expect(roundDots("h-4 w-px -skew-x-[18deg]")).toEqual([]);
    expect(roundDots("size-[12px] rounded-full")).toEqual([]);
    expect(roundDots("min-h-12 rounded-pill border py-3 pr-3.5 pl-4.5")).toEqual([]);
    // Rounded, but not round.
    expect(roundDots("size-2 rounded-sm")).toEqual([]);
    expect(roundDots("size-2 rounded-[40%]")).toEqual([]);
    expect(roundDots("size-2 rounded-[4px]")).toEqual([]);
  });

  it("finds the files it scans", () => {
    for (const file of [...SCANNED_SOURCES, ...HUD_STYLES]) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(true);
    }
  });

  it("pins the CSS Module dot detector on fixtures", () => {
    expect(cssDots(".a { width: 6px; height: 6px; border-radius: 50%; }")).toEqual([
      ".a { width: 6px }",
      ".a { height: 6px }",
    ]);
    expect(cssDots(".a { border-radius: var(--r-pill); height: 8px; width: 40px }")).toEqual([".a { height: 8px }"]);
    expect(cssDots(".s { --dot: 4px; } .a { width: var(--dot); border-radius: 50% }")).toEqual([
      ".a { width: var(--dot) }",
    ]);
    // A token-sized ring above 8px, a square, a pill-shaped bar wider AND taller than 8px, a
    // commented-out dot: not dots.
    expect(cssDots(".s { --orbit: 38px; } .a { width: var(--orbit); height: var(--orbit); border-radius: 50% }")).toEqual([]);
    expect(cssDots(".a { width: 6px; height: 6px; border-radius: 2px }")).toEqual([]);
    expect(cssDots(".a { width: 40px; height: 12px; border-radius: var(--r-pill) }")).toEqual([]);
    expect(cssDots("/* .a { width: 6px; border-radius: 50% } */")).toEqual([]);
  });

  it("no HUD CSS Module draws a round dot, and none uses a blur", () => {
    for (const file of HUD_STYLES) {
      expect(cssDots(read(file)), file).toEqual([]);
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
      // The guide sits over the live WebGL canvas: a filter would flatten its preserve-3d cube.
      expect(css, file).not.toMatch(/backdrop-filter|(?:^|[;\s{])filter\s*:/);
    }
  });

  it("the guide's close icon has square caps, not lucide's round default", () => {
    const src = read("components/hud/guide/GuideAssistant.tsx");
    expect(src).not.toMatch(/strokeLinecap=["']round["']|stroke-linecap=["']round["']/);
    expect(src).toMatch(/strokeLinecap="square"/);
  });

  it("no scanned file uses the blink animation, and the keyframe is gone", () => {
    for (const file of SCANNED_SOURCES) {
      expect(read(file), file).not.toMatch(/animate-hud-blink/);
    }
    expect(read("app/tailwind.css")).not.toMatch(/hud-blink/);
  });

  it("no class string pairs a round radius (full, pill, 50%) with a dot-sized box", () => {
    const offenders = SCANNED_SOURCES.flatMap((file) =>
      literals(read(file)).flatMap((text) => roundDots(text).map((token) => `${file}: ${token}`)),
    );
    expect(offenders).toEqual([]);
  });

  it("no glowing text-shadow or pulsing halo on the logo and title full stops", () => {
    for (const file of ["components/layout/Navbar.tsx", "components/sections/Hero.tsx"]) {
      expect(read(file), file).not.toMatch(/text-shadow:0_0_\d+px_var\(--glow-red\)/);
    }
  });

  it("the estimator's status dot is gone", () => {
    expect(read("components/sections/Estimator.tsx")).not.toMatch(/chatDot/);
    expect(read("components/sections/Estimator.module.css")).not.toMatch(/chatDot/);
  });

  it("the art draws no small circles and no round line caps", () => {
    for (const file of ["components/scene/art/HeroCoreArt.tsx", "components/scene/art/ServiceArt.tsx"]) {
      const src = read(file);
      for (const m of src.matchAll(/<circle\b[^>]*\br=\{?["']?(-?[\d.]+)/g)) {
        expect(Number(m[1]), `${file}: <circle r=${m[1]}>`).toBeGreaterThanOrEqual(12);
      }
      expect(src, file).not.toMatch(/strokeLinecap=["']round["']|stroke-linecap=["']round["']/);
    }
    for (const file of ART_STYLES) {
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
      expect(css, file).not.toMatch(/stroke-linecap:\s*round/);
      for (const rule of css.matchAll(/\{([^{}]*border-radius:\s*50%[^{}]*)\}/g)) {
        const sizes = [...rule[1].matchAll(/(?:^|[;\s])(?:width|height|inline-size|block-size):\s*([\d.]+)px/g)];
        for (const size of sizes) {
          expect(Number(size[1]), `${file}: a ${size[1]}px round box`).toBeGreaterThan(8);
        }
      }
    }
  });
});

/* ---- rendered ---------------------------------------------------------------------------- */

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockReset();
  // The API is unreachable: the provider keeps the built-in content.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

function renderHome(locale: "ro" | "ru" | "en") {
  return render(
    <ThemeProvider>
      <SoundProvider>
        <LanguageProvider initialLocale={locale}>
          <SiteContentProvider>
            <RequestFlowProvider>
              <Navbar />
              <main>
                <SceneStage>
                  <Hero />
                  <Ticker />
                  <Directions />
                </SceneStage>
                <Work />
              </main>
            </RequestFlowProvider>
          </SiteContentProvider>
        </LanguageProvider>
      </SoundProvider>
    </ThemeProvider>,
  );
}

const DOT_GLYPHS = new Set(["•", "●", "◆", "◉"]);

describe("decorative dots — rendered", () => {
  for (const locale of ["ro", "ru", "en"] as const) {
    it(`[${locale}] no dot glyph and no round dot element anywhere on the first screen and interior`, () => {
      const { container } = renderHome(locale);

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const glyphs: string[] = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? "";
        if (DOT_GLYPHS.has(text)) glyphs.push(text);
      }
      expect(glyphs).toEqual([]);

      const dots = Array.from(container.querySelectorAll("[class]")).flatMap((el) =>
        roundDots(el.getAttribute("class") ?? "").map((token) => `<${el.tagName.toLowerCase()}> ${token}`),
      );
      expect(dots).toEqual([]);
      expect(container.querySelector("[data-scene-stage]")).not.toBeNull();
    });
  }

  it("the logo reads TBS. with a plain red full stop: no halo, no glow, no animation", () => {
    renderHome("ro");
    const logo = document.querySelector<HTMLAnchorElement>('header a[href="#top"]');
    expect(logo?.textContent).toBe("TBS.");
    const stop = logo?.querySelector("span");
    expect(stop?.textContent).toBe(".");
    expect(stop?.getAttribute("class")).not.toMatch(/after:|text-shadow|animate-/);
  });

  it("the title's red full stop has no glow", () => {
    renderHome("ro");
    const spans = document.querySelectorAll("h1 span");
    const last = spans[spans.length - 1];
    expect(last?.textContent).toBe(".");
    expect(last?.getAttribute("class")).not.toMatch(/text-shadow/);
  });
});
