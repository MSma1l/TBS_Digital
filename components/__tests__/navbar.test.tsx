import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "@/components/layout/Navbar";
import { navLinks } from "@/lib/content";

/**
 * The public navbar must never link to the admin panel. Such a button would publish the
 * admin's URL in the markup of every page — handing the path to anyone scraping the site
 * — and a visitor has no use for it. The admin types the URL. These tests exist so the
 * button can't quietly come back.
 */
describe("Navbar — the admin panel is not advertised", () => {
  it("renders no link to the admin panel", () => {
    render(<Navbar />);

    expect(screen.queryByText(/ADMIN/i)).toBeNull();
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("admin");
    }
  });

  it("renders no link to the admin panel in the mobile menu either", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

    await user.click(screen.getByRole("button", { name: "Meniu" }));

    // The overlay really is open — otherwise this would pass vacuously.
    expect(screen.getAllByText(/Închide|×/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/ADMIN/i)).toBeNull();
    for (const link of document.querySelectorAll("a")) {
      expect(link.getAttribute("href")).not.toContain("admin");
    }
  });

  it("still renders the public navigation", () => {
    render(<Navbar />);

    for (const link of navLinks) {
      expect(screen.getAllByText(link.label).length).toBeGreaterThan(0);
    }
  });
});
