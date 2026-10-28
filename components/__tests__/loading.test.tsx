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
