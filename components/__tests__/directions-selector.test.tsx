/**
 * The /02 block is the direction CHOOSER.
 *
 * Two things it must never go back to being: pills that look clickable and do nothing
 * (they are links to `/servicii/<slug>` now), and a preview with two competing CTAs.
 * Everything commercial belongs on the service page, so the only interactive element left
 * in the preview is the single "open the service" link.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider } from "@/lib/siteContent";
import { Directions } from "@/components/sections/Directions";
import { directions } from "@/lib/directions";

beforeEach(() => {
  window.localStorage.clear();
  // API unreachable → the provider keeps the built-in portfolio defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

function renderSection(): HTMLElement {
  const { container } = render(
    <SiteContentProvider>
      <Directions />
    </SiteContentProvider>,
  );
  return container;
}

/** The pill row — a <nav>, since the pills are links rather than tabs. */
function pills(): HTMLAnchorElement[] {
  const nav = screen.getByRole("navigation", { name: "Direcțiile de servicii" });
  return within(nav).getAllByRole("link") as HTMLAnchorElement[];
}

describe("direction selector — every pill is a real link", () => {
  it("renders one link per direction, pointing at that direction's page", () => {
    renderSection();
    const links = pills();

    expect(links).toHaveLength(directions.length);
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/servicii/produs-digital",
      "/servicii/e-commerce",
      "/servicii/automatizare-api",
      "/servicii/asistenti-ia",
      "/servicii/brand-ui",
    ]);
  });

  it("leaves no inert pill behind — nothing in the row is a bare <button>", () => {
    renderSection();
    const nav = screen.getByRole("navigation", { name: "Direcțiile de servicii" });
    expect(within(nav).queryAllByRole("button")).toHaveLength(0);
  });

  it("marks the selected pill for assistive tech", () => {
    renderSection();
    const links = pills();
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(links[4]).not.toHaveAttribute("aria-current");

    fireEvent.mouseEnter(links[4]);
    expect(links[4]).toHaveAttribute("aria-current", "true");
    expect(links[0]).not.toHaveAttribute("aria-current");
  });
});

describe("direction selector — the preview follows the selection", () => {
  it("swaps the preview copy when another direction is selected", () => {
    const container = renderSection();
    // A real click on a real link — jsdom would try to navigate, which it cannot do.
    container.addEventListener("click", (e) => e.preventDefault());
    const links = pills();

    // first direction
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Produs digital");
    expect(screen.getByText("Workshop de strategie")).toBeInTheDocument();

    fireEvent.click(links[4]); // Brand & UI

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Brand & UI");
    expect(screen.getByText("Design system")).toBeInTheDocument();
    expect(screen.queryByText("Workshop de strategie")).not.toBeInTheDocument();
  });

  it("keeps the short description visible for every direction", () => {
    renderSection();
    const links = pills();
    for (let i = 0; i < links.length; i += 1) {
      fireEvent.mouseEnter(links[i]);
      const panelText = screen.getByRole("heading", { level: 3 }).parentElement;
      expect(panelText?.querySelector("p")?.textContent?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("shows the direction's OWN reference project, not one borrowed from elsewhere", async () => {
    renderSection();
    const links = pills();

    expect(await screen.findByText("BizCheck")).toBeInTheDocument();

    fireEvent.mouseEnter(links[4]); // Brand & UI → Itara Global
    expect(screen.getByText("Itara Global")).toBeInTheDocument();
    expect(screen.queryByText("BizCheck")).not.toBeInTheDocument();
  });

  it("states plainly that a direction has no public project yet, inventing none", () => {
    renderSection();
    fireEvent.mouseEnter(pills()[1]); // e-commerce — nothing shipped on it

    expect(
      screen.getByText(
        "Pe această direcție nu avem încă un proiect public în portofoliu.",
      ),
    ).toBeInTheDocument();
  });
});

describe("direction selector — one action, not two", () => {
  it("offers exactly one link out of the preview, into the selected service page", () => {
    const container = renderSection();
    const panelLinks = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("#servicii nav ~ div a"),
    );

    expect(panelLinks).toHaveLength(1);
    expect(panelLinks[0].textContent).toContain("Deschide serviciul");
    expect(panelLinks[0].getAttribute("href")).toBe("/servicii/produs-digital");

    fireEvent.mouseEnter(pills()[2]);
    expect(panelLinks[0].getAttribute("href")).toBe("/servicii/automatizare-api");
  });

  it("no longer duplicates the commercial CTA — nothing here jumps to the estimator", () => {
    const container = renderSection();
    const hrefs = Array.from(
      container.querySelectorAll<HTMLAnchorElement>("a"),
    ).map((a) => a.getAttribute("href"));

    expect(hrefs.some((h) => h?.includes("#estimare"))).toBe(false);
    expect(hrefs.some((h) => h?.includes("#contact"))).toBe(false);
  });
});
