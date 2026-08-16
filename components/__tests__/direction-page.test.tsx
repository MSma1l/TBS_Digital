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
import userEvent from "@testing-library/user-event";

// The estimator (mounted inside the request modal) reads `?serviciu=`, which needs the App
// Router context. The modal passes the service as a prop, so an empty stub is enough here.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider } from "@/lib/siteContent";
import { projects as defaultProjects } from "@/lib/content";
import { DirectionPage } from "@/components/sections/DirectionPage";
import { projectsForSolution, solutionProjectIds } from "@/lib/solutions";

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
  it("opens the real request flow in place, with this service preselected", async () => {
    const user = userEvent.setup();
    renderPage("produs-digital");

    // It is a button, not a link: the flow opens here rather than throwing the visitor
    // back to the home page mid-read.
    const cta = screen.getByRole("button", { name: "Vorbește cu echipa" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(cta);

    const dialog = await screen.findByRole("dialog");
    // The estimator really mounted inside — its own submit button proves it is the flow,
    // not a placeholder — and it opened on this service's project type.
    expect(within(dialog).getByRole("button", { name: /Trimite cererea/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/€3\.000/)).toBeInTheDocument();
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

  it("opens the request flow with E-commerce preselected on the e-commerce page", async () => {
    const user = userEvent.setup();
    renderPage("e-commerce");

    await user.click(screen.getByRole("button", { name: "Vorbește cu echipa" }));

    const dialog = await screen.findByRole("dialog");
    // The estimator's e-commerce project type — its price is what proves the preselection.
    expect(within(dialog).getByText(/€6\.000/)).toBeInTheDocument();
  });

  it("drops the projects action (and the section) for a direction with no real work", () => {
    const container = renderPage("e-commerce");

    expect(screen.queryByRole("link", { name: "Vezi proiectele relevante" })).toBeNull();
    expect(container.querySelector("#proiecte")).toBeNull();
    // The request flow is still offered — the page never ends up actionless.
    expect(screen.getByRole("button", { name: "Vorbește cu echipa" })).toBeInTheDocument();
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

  it("lists the two real assistant/bot projects, each with its own public URL", async () => {
    const container = renderPage("asistenti-ia");

    // The case cards name BizCheck too, so wait on the projects section itself.
    await screen.findAllByRole("heading", { name: "BizCheck" });
    const section = container.querySelector("#proiecte") as HTMLElement;
    expect(Array.from(section.querySelectorAll("h3")).map((h) => h.textContent)).toEqual([
      "BizCheck",
      "Balloons Breeze",
    ]);
    expect(
      Array.from(section.querySelectorAll("a")).map((a) => a.getAttribute("href")),
    ).toEqual(["https://bizcheck.md", "https://balloonsbreeze.md/"]);
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

  it("draws the flow — not a project — for a direction sold as a capability", () => {
    const container = renderPage("e-commerce");

    expect(screen.queryByText("PROIECT DE REFERINȚĂ")).toBeNull();
    expect(screen.getByText("FLUXUL PE CARE ÎL CONSTRUIM")).toBeInTheDocument();
    expect(screen.getByText("Ofertă → Plată → Acces")).toBeInTheDocument();

    const steps = Array.from(container.querySelectorAll("ol li span")).map(
      (el) => el.textContent,
    );
    expect(steps).toEqual([
      "Ofertă — produsul, raportul sau accesul, prezentate clar.",
      "Plată — un checkout scurt, cu metodele potrivite pieței tale.",
      "Acces — livrare digitală sau cont cu tot ce a cumpărat clientul.",
    ]);
  });

  it("names no project and links nowhere external on the capability direction", async () => {
    const container = renderPage("e-commerce");
    // Wait for the portfolio provider to settle, so the assertion is not just early.
    expect(await screen.findByText("Ofertă → Plată → Acces")).toBeInTheDocument();

    for (const name of defaultProjects.map((p) => p.name)) {
      expect(screen.queryByText(name)).toBeNull();
    }
    const external = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).filter(
      (a) => /^https?:/.test(a.getAttribute("href") ?? ""),
    );
    expect(external).toHaveLength(0);
  });

  it("shows the assistants direction's reference project instead of an offer summary", async () => {
    renderPage("asistenti-ia");

    expect(await screen.findByText("PROIECT DE REFERINȚĂ")).toBeInTheDocument();
    expect(screen.getAllByText("BizCheck").length).toBeGreaterThan(0);
  });
});

/* The three assistant cases: two client projects with a public page, and our own internal
   Telegram flow, which has none and therefore gets no link. */
describe("labelled cases", () => {
  it("gives the assistants page one section per real case, each labelled", () => {
    renderPage("asistenti-ia");

    expect(screen.getByRole("heading", { name: "Cazuri reale" })).toBeInTheDocument();
    for (const label of [
      "REZULTAT LIVRAT ÎN TELEGRAM",
      "CHAT LIVE CU RĂSPUNS UMAN",
      "FLUXUL NOSTRU INTERN",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(
      expect.arrayContaining(["BizCheck", "Balloons Breeze", "TBS Digital"]),
    );
  });

  it("links only the cases that have a public page — ours is named, never linked", () => {
    renderPage("asistenti-ia");

    const cards = screen
      .getAllByText(/REZULTAT LIVRAT ÎN TELEGRAM|CHAT LIVE CU RĂSPUNS UMAN|FLUXUL NOSTRU INTERN/)
      .map((el) => el.closest("article") as HTMLElement);

    expect(cards[0].querySelector("a")).toHaveAttribute("href", "https://bizcheck.md");
    expect(cards[1].querySelector("a")).toHaveAttribute(
      "href",
      "https://balloonsbreeze.md/",
    );
    // Our own internal flow: described, named, and not a link.
    expect(cards[2].querySelector("a")).toBeNull();
    expect(cards[2].textContent).toContain("TBS Digital");
  });

  it("adds no case section to a direction that has none", () => {
    renderPage("produs-digital");
    expect(screen.queryByRole("heading", { name: "Cazuri reale" })).toBeNull();
  });
});

/* Everything an audit disproved: a product that does not exist, a project name nobody
   uses, and a bot whose profile shows spam in link previews — mentionable, never linked. */
describe("disproved claims stay off both directions", () => {
  it.each(["e-commerce", "asistenti-ia"])("%s carries none of them", (slug) => {
    const container = renderPage(slug);
    const text = container.textContent ?? "";

    expect(text).not.toContain("Contract MD");
    expect(text).not.toContain("Balons Blaze");
    const hrefs = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).map(
      (a) => a.getAttribute("href") ?? "",
    );
    expect(hrefs.some((h) => h.includes("t.me/"))).toBe(false);
    expect(hrefs.some((h) => h.includes("CROWE_BIZCHECK_bot"))).toBe(false);
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
