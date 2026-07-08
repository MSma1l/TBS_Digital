import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  submitContact: vi.fn(),
  isNetworkError: vi.fn(() => false),
  isUnauthorized: vi.fn(() => false),
  fetchContent: vi.fn(),
  saveContent: vi.fn(),
  login: vi.fn(),
  fetchMe: vi.fn(),
  fetchSubmissions: vi.fn(),
  getToken: vi.fn(() => null),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import * as api from "@/lib/api";
import { SiteContentProvider } from "@/lib/siteContent";
import { Services } from "@/components/sections/Services";
import { Team } from "@/components/sections/Team";
import { Principles } from "@/components/sections/Principles";

// The presentational sections use <Reveal>, which constructs an
// IntersectionObserver — not implemented by jsdom. Provide a no-op stub.
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
  // Reject the content fetch so the provider keeps the built-in defaults.
  vi.mocked(api.fetchContent).mockRejectedValue(new Error("offline"));
});

function withProvider(node: ReactNode) {
  return render(<SiteContentProvider>{node}</SiteContentProvider>);
}

describe("Services section", () => {
  it("renders service card names from the store, excluding estimator-only ones", async () => {
    withProvider(<Services />);

    expect(await screen.findByText("Landing page")).toBeInTheDocument();
    expect(screen.getByText("Magazin online")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Alege un serviciu sau combină mai multe într-un produs complet.",
      ),
    ).toBeInTheDocument();
    // "Automatizare cu IA" is estimatorOnly → no card on the /03 grid.
    expect(screen.queryByText("Automatizare cu IA")).not.toBeInTheDocument();
  });
});

describe("Team section", () => {
  it("renders its heading, status label and lead copy (placeholders, no names)", async () => {
    withProvider(<Team />);

    expect(await screen.findByText("ECHIPA")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM_STATUS")).toBeInTheDocument();
    expect(
      screen.getByText(/O echipă mică și dedicată/),
    ).toBeInTheDocument();
  });
});

describe("Principles section", () => {
  it("renders the section label and all 5 principle descriptions", async () => {
    withProvider(<Principles />);

    expect(
      await screen.findByText("PRINCIPIILE NOASTRE"),
    ).toBeInTheDocument();

    const descriptions = [
      "Înțelegem afacerea înainte de prima linie de cod.",
      "Date, module, automatizări — totul integrat.",
      "Interfețe clare, rapide și plăcute de folosit.",
      "Timp economisit, costuri reduse, venituri crescute.",
      "Inteligență artificială acolo unde chiar contează.",
    ];
    for (const desc of descriptions) {
      expect(screen.getByText(desc)).toBeInTheDocument();
    }
  });
});
