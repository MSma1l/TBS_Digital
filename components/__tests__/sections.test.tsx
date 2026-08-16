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
  // The section was redesigned: the old "ECHIPA" + "SYSTEM_STATUS" HUD framing is gone,
  // replaced by the "ECHIPA TBS" card label. The test now describes what ships.
  it("renders its card label and lead copy", async () => {
    withProvider(<Team />);

    // One label per member card, so there are as many as there are members.
    expect((await screen.findAllByText("ECHIPA TBS")).length).toBeGreaterThan(0);
    expect(screen.getByText(/O echipă mică și implicată/)).toBeInTheDocument();
  });
});

describe("Principles section", () => {
  // Redesigned from the 5 principles in lib/content.ts into 3 numbered rationale cards,
  // each with its own accent. The copy below is the component's, not the catalog's.
  it("renders the three rationale cards with their numbers and titles", async () => {
    withProvider(<Principles />);

    expect(await screen.findByText("01 / PRODUS")).toBeInTheDocument();
    expect(screen.getByText("02 / PROCES")).toBeInTheDocument();
    expect(screen.getByText("03 / REZULTAT")).toBeInTheDocument();

    expect(screen.getByText("Produs, nu doar un site")).toBeInTheDocument();
    expect(screen.getByText("Proces transparent")).toBeInTheDocument();
    expect(
      screen.getByText(/Pornim de la problema de business/),
    ).toBeInTheDocument();
  });
});
