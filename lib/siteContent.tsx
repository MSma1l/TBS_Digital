"use client";

/*
 * Client-side content store for the UI-only phase.
 *
 * The public sections read their editable content from here instead of directly
 * from `content.ts`. Defaults come from `content.ts`; the admin page writes
 * overrides to localStorage. There is NO backend — localStorage is the stand-in
 * a FastAPI backend will later replace (see docs/08-roadmap.md). Overrides are
 * per-browser, so they show live for whoever made the edit.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  services as defaultServices,
  partners as defaultPartners,
  teamPlaceholders,
  statPlaceholders,
  contacts as defaultContacts,
  type ContactType,
} from "@/lib/content";

export type StatItem = { id: string; value: string; label: string };
export type ServiceItem = {
  id: string;
  name: string;
  desc: string;
  price: string;
  estimatorOnly?: boolean;
};
export type TeamItem = { id: string; name: string; role: string; bio: string };
export type ContactItem = { id: string; type: ContactType; value: string };

export type SiteData = {
  stats: StatItem[];
  /** Single source for the /03 cards and the /06 estimator (name + price). */
  services: ServiceItem[];
  team: TeamItem[];
  partners: string[];
  contacts: ContactItem[];
};

/** Baseline content — stats and team start blank (they are placeholders). */
export const defaultSiteData: SiteData = {
  stats: statPlaceholders.map((s) => ({ id: s.id, value: "", label: "" })),
  services: defaultServices.map((s) => ({ ...s })),
  team: teamPlaceholders.map((t) => ({ id: t.id, name: "", role: "", bio: "" })),
  partners: [...defaultPartners],
  contacts: defaultContacts.map((c) => ({ ...c })),
};

export const SITE_DATA_KEY = "tbs_site_data";

/**
 * Merge stored overrides on top of the defaults. Every list is add/remove-able
 * in the admin, so a saved list fully replaces its default (we can't key-merge
 * onto defaults without resurrecting removed items). A missing key falls back to
 * the default list, which keeps old/partial saved data from breaking the site.
 */
export function mergeSiteData(overrides: Partial<SiteData> | null | undefined): SiteData {
  if (!overrides) return defaultSiteData;
  return {
    stats: overrides.stats ?? defaultSiteData.stats,
    services: overrides.services ?? defaultSiteData.services,
    team: overrides.team ?? defaultSiteData.team,
    partners: overrides.partners ?? defaultSiteData.partners,
    contacts: overrides.contacts ?? defaultSiteData.contacts,
  };
}

export function loadSiteData(): SiteData {
  if (typeof window === "undefined") return defaultSiteData;
  try {
    const raw = window.localStorage.getItem(SITE_DATA_KEY);
    return mergeSiteData(raw ? (JSON.parse(raw) as Partial<SiteData>) : null);
  } catch {
    return defaultSiteData;
  }
}

export function saveSiteData(data: SiteData) {
  try {
    window.localStorage.setItem(SITE_DATA_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — ignore in this UI-only phase */
  }
}

export function clearSiteData() {
  try {
    window.localStorage.removeItem(SITE_DATA_KEY);
  } catch {
    /* ignore */
  }
}

const SiteContentContext = createContext<SiteData>(defaultSiteData);

/**
 * Provides merged content to the tree. Renders defaults on the server and on the
 * first client paint (so markup matches), then swaps in any localStorage
 * overrides after mount. Also listens for edits made in another tab.
 */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData>(defaultSiteData);

  useEffect(() => {
    setData(loadSiteData());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SITE_DATA_KEY) setData(loadSiteData());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <SiteContentContext.Provider value={data}>
      {children}
    </SiteContentContext.Provider>
  );
}

export function useSiteContent(): SiteData {
  return useContext(SiteContentContext);
}
