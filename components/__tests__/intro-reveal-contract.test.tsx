import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Ticker } from "@/components/sections/Ticker";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { INTRO_REVEAL_ATTR, INTRO_REVEAL_ORDER } from "@/lib/intro";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";
import { SiteContentProvider } from "@/lib/siteContent";

/*
 * The intro's page entrance (components/intro/IntroDirector.tsx) looks its targets up in the
 * document by `data-intro-reveal`, one element per name in INTRO_REVEAL_ORDER, and tweens
 * them FROM an offset state — so the resting state is whatever the page already is. That only
 * holds if:
 *  · every target exists exactly once in the first screen the layout renders (a missing one
 *    is silently skipped, a duplicate silently ignored);
 *  · no target carries an inline style of its own (the director clears what it wrote, and a
 *    style it didn't write would be wiped or fought over);
 *  · no stylesheet targets the attribute — a returning visitor, reduced motion or a failed
 *    intro chunk never runs the entrance, so any CSS hiding a target would hide it for good.
 */

const ROOT = process.cwd();

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockReset();
  // The API is unreachable: the provider keeps the built-in content.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

/** The first screen as `app/layout.tsx` + `app/(site)/layout.tsx` + the home page mount it. */
function renderFirstScreen(locale: "ro" | "ru" | "en" = "ro") {
  return render(
    <LanguageProvider initialLocale={locale}>
      <SiteContentProvider>
        <RequestFlowProvider>
          <Navbar />
          <main>
            <Hero />
            <Ticker />
          </main>
        </RequestFlowProvider>
      </SiteContentProvider>
    </LanguageProvider>,
  );
}

describe("intro reveal targets — markup", () => {
  for (const locale of ["ro", "ru", "en"] as const) {
    it(`[${locale}] every target in INTRO_REVEAL_ORDER exists exactly once, with no style attribute`, () => {
      renderFirstScreen(locale);

      for (const target of INTRO_REVEAL_ORDER) {
        const matches = document.querySelectorAll(`[${INTRO_REVEAL_ATTR}="${target}"]`);
        expect(matches, `[${INTRO_REVEAL_ATTR}="${target}"]`).toHaveLength(1);
        expect(matches[0].hasAttribute("style"), `${target} has an inline style`).toBe(false);
      }
    });
  }

  it("marks nothing the director doesn't know about", () => {
    renderFirstScreen();

    const names = Array.from(document.querySelectorAll(`[${INTRO_REVEAL_ATTR}]`)).map((el) =>
      el.getAttribute(INTRO_REVEAL_ATTR),
    );
    expect([...names].sort()).toEqual([...INTRO_REVEAL_ORDER].sort());
  });

  it("puts the header target on the <header> and the title target on the page's only <h1>", () => {
    renderFirstScreen();

    expect(document.querySelector(`[${INTRO_REVEAL_ATTR}="header"]`)?.tagName).toBe("HEADER");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.querySelector(`[${INTRO_REVEAL_ATTR}="title"]`)?.tagName).toBe("H1");
  });
});

/* ---- stylesheets ------------------------------------------------------------------------ */

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", "backend", "e2e", "public"]);

function moduleCssFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...moduleCssFiles(join(dir, entry.name)));
    } else if (entry.name.endsWith(".module.css")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

/** The CSS with comments removed (they may NAME the attribute to forbid it). CRLF-safe. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Any attribute selector on data-intro-reveal: `[data-intro-reveal]`, `[ data-intro-reveal="x" ]`, `[data-intro-reveal|=…]`. */
const TARGETS_REVEAL = /\[\s*data-intro-reveal\s*(?:[~|^$*]?=|\])/i;

describe("intro reveal targets — no CSS may target them", () => {
  const sheets = [
    resolve(ROOT, "app/globals.css"),
    resolve(ROOT, "app/tailwind.css"),
    ...moduleCssFiles(resolve(ROOT, "app")),
    ...moduleCssFiles(resolve(ROOT, "components")),
    ...moduleCssFiles(resolve(ROOT, "lib")),
  ];

  it("finds the stylesheets it is meant to scan", () => {
    const names = sheets.map((file) => relative(ROOT, file).replace(/\\/g, "/"));
    expect(names).toContain("app/globals.css");
    expect(names).toContain("app/tailwind.css");
    expect(names).toContain("components/intro/IntroPreloader.module.css");
    expect(names.filter((name) => name.endsWith(".module.css")).length).toBeGreaterThan(10);
  });

  it("recognises every spelling of the selector, and ignores the attribute named in a comment", () => {
    const crlf = (lines: string[]) => lines.join("\r\n");
    expect(TARGETS_REVEAL.test(withoutComments(crlf([".a [data-intro-reveal] {", "  opacity: 0;", "}"])))).toBe(true);
    expect(TARGETS_REVEAL.test(withoutComments('[data-intro-reveal="title"]{opacity:0}'))).toBe(true);
    expect(TARGETS_REVEAL.test(withoutComments("[ data-intro-reveal ^= 'ti' ]{opacity:0}"))).toBe(true);
    expect(TARGETS_REVEAL.test(withoutComments("html:has([data-intro-reveal]) .x{}"))).toBe(true);
    expect(
      TARGETS_REVEAL.test(withoutComments(crlf(["/* never style", "   [data-intro-reveal] */", ".a{color:red}"]))),
    ).toBe(false);
    expect(TARGETS_REVEAL.test(withoutComments("[data-intro-revealed]{opacity:0}"))).toBe(false);
  });

  it("no stylesheet has a selector on [data-intro-reveal]", () => {
    const offenders = sheets.filter((file) =>
      TARGETS_REVEAL.test(withoutComments(readFileSync(file, "utf8"))),
    );
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });
});
