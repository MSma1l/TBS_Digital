import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Loading } from "@/components/ui/Loading";
import { ro } from "@/lib/i18n/messages/ro";
import { ru } from "@/lib/i18n/messages/ru";
import { en } from "@/lib/i18n/messages/en";

/**
 * The site's one loading mark. Used for anything not ready yet — data in flight, a scene still
 * compiling, a panel waiting on a fetch — so the two things that must hold are its accessibility
 * contract (silent when decorative, announced when it stands for real work) and its cost.
 */
const mark = (el: HTMLElement) => el.querySelector<SVGSVGElement>("[data-loading]")!;

describe("Loading — the shared waiting mark", () => {
  it("is silent and decorative with no label", () => {
    const { container } = render(<Loading />);
    const svg = mark(container);
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.getAttribute("aria-live")).toBeNull();
    // A scene host is already aria-hidden; a second announcement there is noise.
    expect(svg.getAttribute("aria-label")).toBeNull();
  });

  it("becomes a live region when it stands for real work", () => {
    const { container } = render(<Loading label={ro["common.loading"]} />);
    const svg = mark(container);
    expect(svg.getAttribute("role")).toBe("status");
    expect(svg.getAttribute("aria-live")).toBe("polite");
    expect(svg.getAttribute("aria-label")).toBe("Se încarcă");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  it("carries no copy of its own — the label is the caller's catalog key", () => {
    const { container } = render(<Loading label={ro["common.loading"]} />);
    // No text node anywhere: nothing to translate, no font to wait for.
    expect(container.querySelector("text")).toBeNull();
    expect(mark(container).textContent).toBe("");
    // …and the key exists in all three catalogs, so no caller can land on a blank.
    for (const cat of [ro, ru, en]) expect(cat["common.loading"].length).toBeGreaterThan(2);
  });

  it("takes its box in `fill`, and a fixed one otherwise", () => {
    for (const size of ["sm", "md", "lg", "fill"] as const) {
      const { container } = render(<Loading size={size} />);
      // The size is a class, never an inline style: the caller may still override with its own.
      expect(mark(container).hasAttribute("style")).toBe(false);
      expect(mark(container).getAttribute("class")).toMatch(/\S/);
    }
  });

  it("keeps the caller's class, which is how a host positions and gates it", () => {
    const { container } = render(<Loading size="fill" className="host-x" />);
    expect(mark(container).getAttribute("class")).toContain("host-x");
  });

  it("stays cheap: one svg, six paths, nothing focusable", () => {
    const { container } = render(<Loading />);
    const svg = mark(container);
    // Four corner brackets, the scan bar, the core.
    expect(svg.querySelectorAll("path")).toHaveLength(6);
    expect(svg.querySelectorAll("*")).toHaveLength(6);
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(container.querySelector("[tabindex]")).toBeNull();
    // Nothing round anywhere on this site, the mark included.
    expect(container.querySelector("circle, ellipse")).toBeNull();
  });
});

describe("PageLoading — the handover out of the intro", () => {
  const css = readFileSync(resolve(process.cwd(), "components/ui/PageLoading.module.css"), "utf8");

  it("stands down for the whole of an intro, and never comes back up after one", () => {
    /*
     * ONE COVER PER LOAD. Two full-window covers would fight while the film plays, and after it
     * the page is finished — so a second one is just a second loading screen for someone who has
     * already watched the first. Measured before this rule: the film revealed the page at 8.19s
     * and this cover was up from 8.21s to 13.80s over a page that was already painted.
     *
     * The stand-down therefore has TWO selectors and neither of them may narrow to a phase: the
     * overlay's presence covers the film, and `data-intro-played` — written on <html> by
     * `finishIntro` on the frame of the reveal — covers everything after it, including the 1.5s
     * in which the overlay is still fading.
     */
    /* No regex: a heredoc has eaten the escapes in this repo twice, so this reads the rule by
       hand. */
    const at = css.indexOf("html:has(#tbs-intro");
    expect(at, "the intro stand-down rule").toBeGreaterThan(-1);
    const open = css.indexOf("{", at);
    const selector = css.slice(at, open);
    const body = css.slice(open, css.indexOf("}", open));
    expect(body).toContain("display: none");
    /* A phase test here is the bug: it is what let the cover back up mid-fade. */
    expect(selector, "the whole life of the overlay, not one phase of it").not.toContain(
      "data-phase",
    );
    expect(selector, "and after it is gone, for the rest of the document").toContain(
      "html[data-intro-played]",
    );
  });

  it("is up only while the stage has not answered, and always comes down at 6s", () => {
    // The cover blocks the page, so its failsafe is not optional.
    expect(css).toContain('[data-scene-stage][data-renderer="pending"]');
    expect(css).toContain("pageLoadingFailsafe");
    expect(css).toContain("6000ms forwards");
  });
});
