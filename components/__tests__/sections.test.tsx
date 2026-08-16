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
import { SiteContentProvider, defaultSiteData } from "@/lib/siteContent";
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

/**
 * The team stat row used to be three literals: "50+ proiecte", "98% clienți mulțumiți" and
 * "24/7 automatizări online". The first contradicted the hero, which counts the real
 * portfolio (9), and the other two are not measurable from anything the project holds. The
 * row is now fed by the admin and simply isn't there until real numbers exist.
 */
describe("Team stats come from real data, or not at all", () => {
  it("renders no stat row while the stats are blank placeholders", async () => {
    withProvider(<Team />);

    // The team itself renders, so this is 'no stats', not 'nothing rendered'.
    expect(await screen.findAllByText("ECHIPA TBS")).not.toHaveLength(0);
    expect(screen.queryByText("50+")).not.toBeInTheDocument();
    expect(screen.queryByText("98%")).not.toBeInTheDocument();
    expect(screen.queryByText(/clienți mulțumiți/)).not.toBeInTheDocument();
  });

  it("renders the stats the owner actually filled in", async () => {
    vi.mocked(api.fetchContent).mockResolvedValue({
      ...defaultSiteData,
      stats: [
        { id: "s1", value: "9", label: { ro: "proiecte livrate", ru: "", en: "" } },
        // A blank one must stay invisible even when a sibling has a value.
        { id: "s2", value: "  ", label: { ro: "nimic", ru: "", en: "" } },
      ],
    });

    withProvider(<Team />);

    expect(await screen.findByText("9")).toBeInTheDocument();
    expect(screen.getByText("proiecte livrate")).toBeInTheDocument();
    expect(screen.queryByText("nimic")).not.toBeInTheDocument();
  });
});
