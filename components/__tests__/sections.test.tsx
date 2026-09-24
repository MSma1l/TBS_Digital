import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  // The Team card resolves its photograph through this. A bundled path under /team/ comes back
  // untouched by the real one, which is exactly what keeps it same-origin for the projection.
  mediaUrl: (path: string) => path,
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
import { SITE_DATA_KEY, SiteContentProvider, defaultSiteData } from "@/lib/siteContent";
import { Services } from "@/components/sections/Services";
import { Team } from "@/components/sections/Team";
import { Principles } from "@/components/sections/Principles";
import * as contentModule from "@/lib/content";

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

  /*
   * The photograph is PROJECTED, not printed — but it is still the photograph. Everything
   * holographic is a filter, a mask and two brief faults laid over the same <img>, so a screen
   * reader, a crawler and a browser that does not support the filter all get what they got before.
   */
  it("projects the photograph without taking the picture away from anybody", async () => {
    const { container } = withProvider(<Team />);
    await screen.findAllByText("ECHIPA TBS");

    const holo = container.querySelector('[class*="holo"]');
    expect(holo).not.toBeNull();
    const shots = holo!.querySelectorAll("img");
    // Three copies: him, the torn band and the travelling beam. The faults are copies rather than
    // overlays because a mask is the only way to keep them on HIM and off the card behind him.
    expect(shots).toHaveLength(3);
    // …and only the first one describes anything. The other two are decoration.
    expect(shots[0]).toHaveAttribute("alt", "Maxim");
    expect(shots[1]).toHaveAttribute("alt", "");
    expect(shots[1]).toHaveAttribute("aria-hidden");
    expect(shots[2]).toHaveAttribute("alt", "");
    for (const img of Array.from(shots)) {
      expect(img).toHaveAttribute("src", "/team/maxim.webp");
    }
  });

  it("defines the key and the tint ONCE for the section, not once per card", async () => {
    const { container } = withProvider(<Team />);
    await screen.findAllByText("ECHIPA TBS");
    const filters = container.querySelectorAll("filter#tbs-holo-key");
    expect(filters).toHaveLength(1);
    // sRGB, because the key's thresholds were measured in sRGB and the SVG default is linearRGB —
    // which would put the threshold somewhere else entirely and take half of him with it.
    expect(filters[0].getAttribute("color-interpolation-filters")).toBe("sRGB");
    // The transfer holds 1 up to 0.90 and falls to 0 at 1.0: his jacket peaks at 0.904 and the
    // ground he was photographed on reads exactly 1.000.
    const table = filters[0].querySelector("feFuncA")?.getAttribute("tableValues") ?? "";
    const values = table.trim().split(/\s+/).map(Number);
    expect(values.length).toBeGreaterThan(10);
    expect(values[0]).toBe(1);
    expect(values[values.length - 1]).toBe(0);
    expect(values[values.length - 3]).toBe(1);
  });

  it("invents no projection for a member who has no photograph", async () => {
    const { container } = withProvider(<Team />);
    await screen.findAllByText("ECHIPA TBS");
    expect(container.querySelectorAll('[class*="holo"]')).toHaveLength(1);
    expect(container.querySelectorAll('[class*="avatar"]').length).toBeGreaterThan(0);
  });

  it("gives a member with no photograph of their own the bundled one", async () => {
    // A saved member with an empty photo used to shadow the shipped asset and fall back to a
    // gradient initial while the file sat unused in public/. This is a FIELD fallback, not a
    // key-merge: a member the owner deleted stays deleted.
    window.localStorage.setItem(
      SITE_DATA_KEY,
      JSON.stringify({ team: [{ ...defaultSiteData.team[0], photo: "" }] }),
    );
    const { container } = withProvider(<Team />);
    await screen.findAllByText("ECHIPA TBS");
    expect(container.querySelector("img")).toHaveAttribute("src", "/team/maxim.webp");
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
 * THE CARD MARKS.
 *
 * One small drawing per card, the same size in the same corner on all three. The first attempt
 * gave each card a different instrument and the row came apart; these tests pin the sameness and
 * the silence, which are the two things that made it work.
 */
describe("The principles' card marks", () => {
  it("gives every card a mark, and gives them all the same one", async () => {
    const { container } = withProvider(<Principles />);
    await screen.findByText("01 / PRODUS");

    const marks = Array.from(container.querySelectorAll("svg"));
    expect(marks).toHaveLength(3);

    // Same box and the same stroke on all three: that sameness is the design. Three drawings at
    // three different weights is what the row looked like before, and it read as three unrelated
    // widgets rather than one row.
    for (const mark of marks) {
      expect(mark.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(mark.getAttribute("stroke")).toBe("currentColor");
      expect(mark.getAttribute("fill")).toBe("none");
    }
    // …and three DIFFERENT drawings inside that identical box.
    const shapes = marks.map((m) => m.innerHTML);
    expect(new Set(shapes).size).toBe(3);
  });

  it("keeps the marks silent and out of the accessibility tree", async () => {
    const { container } = withProvider(<Principles />);
    await screen.findByText("01 / PRODUS");

    for (const mark of Array.from(container.querySelectorAll("svg"))) {
      // The sentence beside a mark is the claim; the mark is only that claim drawn. Repeating
      // any of it here would also be copy hardcoded outside the { ro, ru, en } fields.
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(mark).toHaveAttribute("focusable", "false");
      expect(mark.textContent).toBe("");
      expect(mark.querySelector("title")).toBeNull();
    }
  });

  it("draws no circle and no round cap anywhere", async () => {
    const { container } = withProvider(<Principles />);
    await screen.findByText("01 / PRODUS");

    // The house rule for line art in this repo (docs/07): straight strokes, square caps, no
    // circles, no decorative dots. `decorative-dots.test.tsx` scans the sections it covers; this
    // keeps the rule true here too.
    const markup = Array.from(container.querySelectorAll("svg")).map((m) => m.outerHTML).join("");
    expect(markup).not.toMatch(/<circle|<ellipse/i);
    expect(markup).not.toMatch(/stroke-linecap="round"|strokeLinecap/i);
  });

  it("shows no reading anywhere, and keeps the deleted stat literals gone", async () => {
    const { container } = withProvider(<Principles />);
    await screen.findByText("01 / PRODUS");

    // Card 03's mark is a sight, not a readout: the only indicator it could display is one it
    // invented. "50+", "98% clienti multumiti" and "24/7" were deleted from the team card for
    // exactly that reason, after the first was caught contradicting the hero's real portfolio
    // count. The only digits this section may carry are its own card numbers.
    expect(container.textContent).not.toMatch(/50\+|98%|24\/7/);
    const digits = (container.textContent?.match(/\d+/g) ?? []).filter(
      (d) => !["01", "02", "03"].includes(d),
    );
    expect(digits).toEqual([]);

    // They survived in a dead `statusBars` export one file away from a section about measurable
    // results, imported by nothing. This was the moment to take them out.
    expect("statusBars" in contentModule).toBe(false);
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
