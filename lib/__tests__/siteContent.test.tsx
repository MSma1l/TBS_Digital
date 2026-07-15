import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import React from "react";

// Mock the API layer so the provider's fetch-on-mount is fully controllable.
vi.mock("@/lib/api", () => ({
  fetchContent: vi.fn(),
}));

import { fetchContent } from "@/lib/api";
import {
  defaultSiteData,
  mergeSiteData,
  loadSiteData,
  saveSiteData,
  clearSiteData,
  SITE_DATA_KEY,
  SiteContentProvider,
  useSiteContent,
  type SiteData,
  type StatItem,
} from "@/lib/siteContent";
import { locRo } from "@/lib/i18n/content";

const mockedFetchContent = vi.mocked(fetchContent);

beforeEach(() => {
  window.localStorage.clear();
  mockedFetchContent.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("mergeSiteData", () => {
  it("returns defaults for null / undefined", () => {
    expect(mergeSiteData(null)).toBe(defaultSiteData);
    expect(mergeSiteData(undefined)).toBe(defaultSiteData);
  });

  it("lets a saved list fully replace its default", () => {
    const stats: StatItem[] = [{ id: "x", value: "10", label: locRo("Proiecte") }];
    const merged = mergeSiteData({ stats });
    expect(merged.stats).toBe(stats);
    // Untouched keys still fall back to defaults.
    expect(merged.services).toBe(defaultSiteData.services);
    expect(merged.partners).toBe(defaultSiteData.partners);
  });

  it("falls back to the default for each missing key", () => {
    const merged = mergeSiteData({ partners: [{ id: "only_one", name: "ONLY_ONE", logo: "", url: "", preview: "" }] });
    expect(merged.partners).toEqual([{ id: "only_one", name: "ONLY_ONE", logo: "", url: "", preview: "" }]);
    expect(merged.stats).toBe(defaultSiteData.stats);
    expect(merged.team).toBe(defaultSiteData.team);
    expect(merged.contacts).toBe(defaultSiteData.contacts);
  });

  it("produces a full SiteData shape with all five keys", () => {
    const merged = mergeSiteData({});
    expect(Object.keys(merged).sort()).toEqual(
      [
        "contacts",
        "partners",
        "projects",
        "services",
        "socials",
        "stats",
        "team",
      ].sort(),
    );
  });
});

describe("loadSiteData / saveSiteData / clearSiteData", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSiteData()).toBe(defaultSiteData);
  });

  it("round-trips saved data through localStorage", () => {
    const data: SiteData = {
      ...defaultSiteData,
      partners: [{ id: "a", name: "A", logo: "", url: "", preview: "" }, { id: "b", name: "B", logo: "", url: "", preview: "" }],
      stats: [{ id: "s1", value: "99", label: locRo("Clienți") }],
    };
    saveSiteData(data);
    expect(window.localStorage.getItem(SITE_DATA_KEY)).toBe(
      JSON.stringify(data),
    );
    const loaded = loadSiteData();
    expect(loaded.partners).toEqual([{ id: "a", name: "A", logo: "", url: "", preview: "" }, { id: "b", name: "B", logo: "", url: "", preview: "" }]);
    expect(loaded.stats).toEqual([{ id: "s1", value: "99", label: locRo("Clienți") }]);
  });

  it("merges partial stored data onto defaults", () => {
    window.localStorage.setItem(
      SITE_DATA_KEY,
      JSON.stringify({ partners: [{ id: "solo", name: "SOLO", logo: "", url: "", preview: "" }] }),
    );
    const loaded = loadSiteData();
    expect(loaded.partners).toEqual([{ id: "solo", name: "SOLO", logo: "", url: "", preview: "" }]);
    expect(loaded.services).toBe(defaultSiteData.services);
  });

  it("falls back to defaults for malformed JSON without throwing", () => {
    window.localStorage.setItem(SITE_DATA_KEY, "{ not valid json ::");
    expect(() => loadSiteData()).not.toThrow();
    expect(loadSiteData()).toBe(defaultSiteData);
  });

  it("clearSiteData removes the stored key", () => {
    saveSiteData(defaultSiteData);
    expect(window.localStorage.getItem(SITE_DATA_KEY)).not.toBeNull();
    clearSiteData();
    expect(window.localStorage.getItem(SITE_DATA_KEY)).toBeNull();
  });

  it("saveSiteData swallows storage errors", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    expect(() => saveSiteData(defaultSiteData)).not.toThrow();
    spy.mockRestore();
  });
});

// Small probe component that surfaces provider state for assertions.
function Probe() {
  const data = useSiteContent();
  return (
    <div>
      <span data-testid="partners">{data.partners.map((p) => p.name).join(",")}</span>
    </div>
  );
}

describe("SiteContentProvider", () => {
  it("exposes defaults on the first paint (SSR-safe)", () => {
    // Keep the API pending so the initial render shows defaults.
    mockedFetchContent.mockReturnValue(new Promise<SiteData>(() => {}));
    render(
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>,
    );
    expect(screen.getByTestId("partners").textContent).toBe(
      defaultSiteData.partners.map((p) => p.name).join(","),
    );
  });

  it("swaps in API data after mount and caches it", async () => {
    const remote: SiteData = {
      ...defaultSiteData,
      partners: [{ id: "remote_a", name: "REMOTE_A", logo: "", url: "", preview: "" }, { id: "remote_b", name: "REMOTE_B", logo: "", url: "", preview: "" }],
    };
    mockedFetchContent.mockResolvedValue(remote);

    render(
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("partners").textContent).toBe(
        "REMOTE_A,REMOTE_B",
      );
    });
    expect(mockedFetchContent).toHaveBeenCalledTimes(1);
    // The fresh copy is written to the offline cache.
    const cached = JSON.parse(
      window.localStorage.getItem(SITE_DATA_KEY) ?? "null",
    ) as SiteData;
    expect(cached.partners).toEqual([{ id: "remote_a", name: "REMOTE_A", logo: "", url: "", preview: "" }, { id: "remote_b", name: "REMOTE_B", logo: "", url: "", preview: "" }]);
  });

  it("keeps the cache/defaults when the API is unreachable", async () => {
    window.localStorage.setItem(
      SITE_DATA_KEY,
      JSON.stringify({ ...defaultSiteData, partners: [{ id: "cached", name: "CACHED", logo: "", url: "", preview: "" }] }),
    );
    mockedFetchContent.mockRejectedValue(new Error("offline"));

    render(
      <SiteContentProvider>
        <Probe />
      </SiteContentProvider>,
    );

    // The cached value is shown instantly and remains after the failed fetch.
    await waitFor(() => {
      expect(screen.getByTestId("partners").textContent).toBe("CACHED");
    });
  });
});
