/**
 * The service page is where a direction turns into an action.
 *
 * It owns the action bar (request flow with this service on the URL, the direction's own
 * projects, the reference project's link) and the filtered portfolio. Two rules it must
 * keep: no action that leads nowhere, and no project claimed for a direction it wasn't
 * built for — the membership table in `lib/solutions.ts` is the only source.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider } from "@/lib/siteContent";
import { projects as defaultProjects } from "@/lib/content";
import { DirectionPage } from "@/components/sections/DirectionPage";
import { projectsForSolution, solutionProjectIds } from "@/lib/solutions";
import { estimateHref } from "@/lib/directions";

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

function renderPage(slug: string): HTMLElement {
  const { container } = render(
    <SiteContentProvider>
      <DirectionPage slug={slug} />
    </SiteContentProvider>,
  );
  return container;
}

describe("action bar", () => {
  it("sits on the page and leads to the real request flow, carrying the service", () => {
    renderPage("produs-digital");

    const cta = screen.getByRole("link", { name: "Vorbește cu echipa" });
    expect(cta).toHaveAttribute("href", "/?serviciu=produs-digital#estimare");
    // #estimare is the id of the estimator section on the home page — the actual flow.
    expect(estimateHref("produs-digital")).toContain("#estimare");
  });

  it("offers the projects action, pointing at the section on this same page", () => {
    const container = renderPage("produs-digital");

    const jump = screen.getByRole("link", { name: "Vezi proiectele relevante" });
    expect(jump).toHaveAttribute("href", "#proiecte");
    expect(container.querySelector("#proiecte")).not.toBeNull();
  });

  it("links the reference project to its real URL when it has one", () => {
    renderPage("produs-digital"); // reference: BizCheck

    const link = screen.getByRole("link", { name: /Vezi proiectul/ });
    expect(link).toHaveAttribute("href", "https://bizcheck.md");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders NO link at all when the reference project has no public URL", () => {
    renderPage("automatizare-api"); // reference: Crowe Portal — a private client system

    expect(screen.queryByRole("link", { name: /Vezi proiectul/ })).toBeNull();
    // …and the project is still named, as plain text.
    expect(screen.getByText(/Crowe Portal — fără link public/)).toBeInTheDocument();
    expect(
      screen.getByText(/Crowe Portal — fără link public/).closest("a"),
    ).toBeNull();
  });

  it("drops the projects action (and the section) for a direction with no real work", () => {
    const container = renderPage("e-commerce");

    expect(screen.queryByRole("link", { name: "Vezi proiectele relevante" })).toBeNull();
    expect(container.querySelector("#proiecte")).toBeNull();
    // The request flow is still offered — the page never ends up actionless.
    expect(screen.getByRole("link", { name: "Vorbește cu echipa" })).toHaveAttribute(
      "href",
      "/?serviciu=e-commerce#estimare",
    );
  });
});

describe("relevant projects", () => {
  it("lists the direction's real projects, in the curated order", async () => {
    const container = renderPage("brand-ui");

    expect(await screen.findByRole("heading", { name: "Itara Global" })).toBeInTheDocument();
    const section = container.querySelector("#proiecte")!;
    const names = Array.from(section.querySelectorAll("h3")).map((h) => h.textContent);
    expect(names).toEqual(["Itara Global", "CGAM", "Balloons Breeze"]);
  });

  it("does not borrow a project from another direction", () => {
    const container = renderPage("brand-ui");
    const section = container.querySelector("#proiecte")!;

    expect(within(section as HTMLElement).queryByText("BizCheck")).toBeNull();
    expect(within(section as HTMLElement).queryByText("DocuSafe")).toBeNull();
  });

  it("renders a project without a public URL as an article, never as a dead link", () => {
    const container = renderPage("automatizare-api");
    const section = container.querySelector("#proiecte") as HTMLElement;

    // Every project on this direction is a private client system, so not one card is a link.
    expect(section.querySelectorAll("a")).toHaveLength(0);
    const cards = Array.from(section.querySelectorAll("article"));
    expect(cards.map((el) => el.querySelector("h3")?.textContent)).toEqual([
      "Crowe Portal",
      "DocuSafe",
      "Statistic",
    ]);
  });

  it("renders a project that HAS a public URL as a link that opens safely", () => {
    const container = renderPage("brand-ui");
    const section = container.querySelector("#proiecte") as HTMLElement;

    const links = Array.from(section.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://itara-global.md",
      "https://cgam.md",
      "https://balloonsbreeze.md/",
    ]);
    for (const a of links) {
      expect(a.getAttribute("rel")).toContain("noopener");
      expect(a.getAttribute("target")).toBe("_blank");
    }
  });
});

describe("hero card", () => {
  it("shows the reference project itself — name, category chip and its screenshot", async () => {
    renderPage("produs-digital");

    expect(await screen.findByText("PROIECT DE REFERINȚĂ")).toBeInTheDocument();
    expect(screen.getAllByText("BizCheck").length).toBeGreaterThan(0);
    const shot = screen.getAllByRole("img", { name: "BizCheck" })[0];
    expect(shot).toHaveAttribute("src", "/projects/bizcheck-1.jpg");
  });

  it("falls back to the direction's own summary when it has no project yet", () => {
    renderPage("asistenti-ia");

    expect(screen.queryByText("PROIECT DE REFERINȚĂ")).toBeNull();
    expect(
      screen.getByText("Chatbot + asistent intern + Telegram"),
    ).toBeInTheDocument();
  });
});

describe("project membership table", () => {
  it("only ever names ids that exist in the portfolio", () => {
    const known = new Set(defaultProjects.map((p) => p.id));
    for (const [slug, ids] of Object.entries(solutionProjectIds)) {
      for (const id of ids) {
        expect(known.has(id), `${slug} → unknown project "${id}"`).toBe(true);
      }
    }
  });

  it("skips an id whose project was removed instead of rendering a hole", () => {
    const remaining = defaultProjects.filter((p) => p.id !== "bizcheck");
    const list = projectsForSolution("produs-digital", remaining);

    expect(list.map((p) => p.id)).toEqual(["docusafe", "iq-arena", "statistic", "flirt"]);
  });

  it("returns nothing for a direction with no work, and for an unknown slug", () => {
    expect(projectsForSolution("e-commerce", defaultProjects)).toEqual([]);
    expect(projectsForSolution("habar-n-am", defaultProjects)).toEqual([]);
  });
});
