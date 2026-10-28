import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/*
 * The two StoryBrand sections (docs/05, "Stakes" and "Explainer"; docs/16, "Copy framework"):
 * the stakes (step 2 of the wireframe) and the explanatory paragraph (step 6). Rendered in
 * Romanian, the default locale. The request flow is replaced by a spy: what matters here is that
 * the stakes' CTA opens the shared dialog with its own source, which request-flow.test.tsx then
 * covers end to end for every CTA.
 */
const openRequest = vi.fn();
vi.mock("@/lib/request/RequestFlowProvider", () => ({
  useRequestFlow: () => ({ openRequest, closeRequest: vi.fn(), isOpen: false, context: null }),
}));

import { Stakes, STAKES_ID } from "@/components/sections/Stakes";
import { Explainer, EXPLAINER_ID } from "@/components/sections/Explainer";

// <Reveal> constructs an IntersectionObserver, which jsdom does not implement.
beforeAll(() => {
  class IOStub implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IOStub);
});

beforeEach(() => {
  openRequest.mockClear();
});

describe("Stakes section", () => {
  it("is an anchored section with one h2 and three problem cards", () => {
    const { container } = render(<Stakes />);

    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", STAKES_ID);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "Ce pierzi când online-ul nu lucrează pentru tine." }),
    ).toBeInTheDocument();

    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    expect(screen.getByRole("heading", { level: 3, name: "Buget pus pe o idee netestată" })).toBeInTheDocument();
  });

  it("invents no figure: the stakes are named, never measured", () => {
    const { container } = render(<Stakes />);
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("opens the request dialog from its CTA, with its own source", async () => {
    const user = userEvent.setup();
    render(<Stakes />);

    const cta = screen.getByRole("button", { name: "Cere ofertă" });
    await user.click(cta);

    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(openRequest).toHaveBeenCalledWith({ source: "home-stakes", returnFocusTo: cta });
  });
});

describe("Explainer section", () => {
  it("is an anchored section with one h2 and the story in paragraphs", () => {
    const { container } = render(<Explainer />);

    expect(container.querySelector("section")).toHaveAttribute("id", EXPLAINER_ID);
    expect(container.querySelectorAll("h2")).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Site-uri, aplicații și MVP în Chișinău, construite pas cu pas.",
      }),
    ).toBeInTheDocument();

    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs.length).toBeLessThanOrEqual(3);
    // The guide and the plan are in it, in plain words.
    expect(container.textContent).toContain("TBS Digital");
    expect(container.textContent).toContain("în cel mult o zi lucrătoare");
  });

  it("has no CTA of its own and quotes no price", () => {
    const { container } = render(<Explainer />);
    expect(container.querySelector("button, a")).toBeNull();
    expect(container.textContent).not.toMatch(/€|\d/);
  });
});
