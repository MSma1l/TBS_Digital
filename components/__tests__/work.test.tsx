import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider, defaultSiteData, type ProjectItem } from "@/lib/siteContent";
import { projects as defaultProjects } from "@/lib/content";
import { Work } from "@/components/sections/Work";
import { Hero } from "@/components/sections/Hero";
import { RequestFlowProvider } from "@/lib/request/RequestFlowProvider";

// <Reveal> constructs an IntersectionObserver, which jsdom doesn't implement.
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
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockReset();
  // Default: the API is unreachable, so the provider keeps the built-in defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

/* Both providers the app puts above these sections: the content store they read, and the
   request flow the hero's CTA opens (`app/layout.tsx`). */
function withProvider(node: ReactNode) {
  return render(
    <SiteContentProvider>
      <RequestFlowProvider>{node}</RequestFlowProvider>
    </SiteContentProvider>,
  );
}

const project = (over: Partial<ProjectItem>): ProjectItem => ({
  id: "p",
  name: "Proiect",
  tag: { ro: "TAG", ru: "TAG", en: "TAG" },
  desc: { ro: "Descriere", ru: "Описание", en: "Description" },
  url: "",
  appStore: "",
  playStore: "",
  images: [],
  ...over,
});

/** Every project card, whether it rendered as a link or as a plain <article>. */
function cards(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("#lucrari a, #lucrari article"),
  );
}

function cardFor(container: HTMLElement, name: string): HTMLElement {
  const card = cards(container).find(
    (el) => within(el).queryByRole("heading", { name })?.textContent === name,
  );
  if (!card) throw new Error(`no card for "${name}"`);
  return card;
}

describe("Work section — content comes from the store", () => {
  it("renders the portfolio from useSiteContent, not from a constant in the component", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "only-one", name: "SINGURUL PROIECT" })],
    });

    const { container } = withProvider(<Work />);

    expect(await screen.findByText("SINGURUL PROIECT")).toBeInTheDocument();
    // The seeded portfolio was fully replaced by what the store returned — proof the
    // section reads the store rather than a hardcoded list.
    expect(screen.queryByText("BizCheck")).not.toBeInTheDocument();
    expect(cards(container)).toHaveLength(1);
  });

  it("renders every seeded project when the API is unreachable", async () => {
    const { container } = withProvider(<Work />);

    expect(await screen.findByText("BizCheck")).toBeInTheDocument();
    expect(cards(container)).toHaveLength(defaultProjects.length);
    for (const p of defaultProjects) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
  });

  it("numbers the cards from their position, so a shorter list renumbers", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "a", name: "Primul" }),
        project({ id: "b", name: "Al doilea" }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Primul");

    expect(cardFor(container, "Primul")).toHaveTextContent("01");
    expect(cardFor(container, "Al doilea")).toHaveTextContent("02");
  });
});

describe("Work section — links and image fallback", () => {
  it("links only the projects that have a real url", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "public", name: "Public", url: "https://example.md" }),
        project({ id: "privat", name: "Privat", url: "" }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Public");

    const linked = cardFor(container, "Public");
    expect(linked.tagName).toBe("A");
    expect(linked).toHaveAttribute("href", "https://example.md");
    expect(linked).toHaveAttribute("rel", "noopener noreferrer");

    // No url ⇒ not an anchor at all, so there is no link pointing nowhere.
    const unlinked = cardFor(container, "Privat");
    expect(unlinked.tagName).toBe("ARTICLE");
    expect(container.querySelectorAll("#lucrari a")).toHaveLength(1);
  });

  it("falls back to the card's colour gradient when a project has no image", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [
        project({ id: "cu-imagine", name: "Cu imagine", images: ["/projects/flirt-1.png"] }),
        project({ id: "fara-imagine", name: "Fără imagine", images: [] }),
      ],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("Fără imagine");

    const withImage = cardFor(container, "Cu imagine");
    expect(within(withImage).getByRole("img")).toHaveAttribute(
      "src",
      "/projects/flirt-1.png",
    );

    const noImage = cardFor(container, "Fără imagine");
    expect(within(noImage).queryByRole("img")).not.toBeInTheDocument();
    // Still a finished, coloured card — the gradient variables the CSS paints are set.
    expect(noImage.style.getPropertyValue("--p1")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(noImage.style.getPropertyValue("--p2")).toMatch(/^#[0-9a-f]{6}$/i);
    // …and its name and description are still there, so it is not an empty box.
    expect(within(noImage).getByRole("heading", { name: "Fără imagine" })).toBeInTheDocument();
    expect(within(noImage).getByText("Descriere")).toBeInTheDocument();
  });

  it("keeps each seeded project's own gradient regardless of its position", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "flirt", name: "FLIRT" })],
    });

    const { container } = withProvider(<Work />);
    await screen.findByText("FLIRT");

    expect(cardFor(container, "FLIRT").style.getPropertyValue("--p2")).toBe("#ff2d78");
  });
});

describe("Hero metrics", () => {
  it("counts the real portfolio instead of claiming a hardcoded number", async () => {
    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    expect(
      within(metrics).getByText(String(defaultProjects.length)),
    ).toBeInTheDocument();
    expect(within(metrics).getByText("proiecte în portofoliu")).toBeInTheDocument();
    // The old hand-written claim is gone.
    expect(within(metrics).queryByText("50+")).not.toBeInTheDocument();
  });

  it("follows the store when the portfolio changes", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      projects: [project({ id: "a", name: "A" }), project({ id: "b", name: "B" })],
    });

    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    expect(await within(metrics).findByText("2")).toBeInTheDocument();
    expect(
      within(metrics).queryByText(String(defaultProjects.length)),
    ).not.toBeInTheDocument();
  });

  it("shows no counter at all rather than a bare 0 for an empty portfolio", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({ ...defaultSiteData, projects: [] });

    withProvider(<Hero />);

    const metrics = await screen.findByLabelText("Indicatori");
    // The non-portfolio metric stays; the counter disappears.
    expect(await within(metrics).findByText("24/7")).toBeInTheDocument();
    expect(within(metrics).queryByText("0")).not.toBeInTheDocument();
    expect(
      within(metrics).queryByText("proiecte în portofoliu"),
    ).not.toBeInTheDocument();
  });
});
