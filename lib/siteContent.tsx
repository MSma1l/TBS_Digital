"use client";

/*
 * Client-side content store.
 *
 * The public sections read their editable content from here instead of directly
 * from `content.ts`. The source of truth is the FastAPI backend (`GET /api/content`);
 * `content.ts` provides the defaults and `localStorage` is an offline cache.
 *
 * Rendering strategy (SSR-safe): defaults are rendered on the server and on the
 * first client paint so the markup matches and hydration never mismatches. After
 * mount we swap in the cached copy (instant) and then the freshest API copy. If
 * the API is unreachable, we keep the cache/defaults so the site never breaks.
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
import { fetchContent } from "@/lib/api";

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
export type PartnerItem = {
  id: string;
  name: string;
  /** Bundled asset (`/partners/…`) or an uploaded logo (`/api/uploads/…`). */
  logo: string;
  url: string;
};

export type SiteData = {
  stats: StatItem[];
  /** Single source for the /03 cards and the /07 estimator (name + price). */
  services: ServiceItem[];
  team: TeamItem[];
  partners: PartnerItem[];
  contacts: ContactItem[];
};

/** Baseline content — stats and team start blank (they are placeholders). */
export const defaultSiteData: SiteData = {
  stats: statPlaceholders.map((s) => ({ id: s.id, value: "", label: "" })),
  services: defaultServices.map((s) => ({ ...s })),
  team: teamPlaceholders.map((t) => ({ id: t.id, name: "", role: "", bio: "" })),
  partners: defaultPartners.map((p) => ({ ...p })),
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
 * first client paint (so markup matches). After mount it: (1) shows the
 * localStorage cache instantly, (2) fetches the live document from the API and
 * swaps it in, caching it for offline use. If the API is unreachable the cache
 * (or defaults) stays in place. Also listens for edits made in another tab.
 */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData>(defaultSiteData);

  useEffect(() => {
    let cancelled = false;

    // 1) Instant paint from the offline cache (or defaults if none).
    // Intentional post-mount setState: the server + first client paint MUST render
    // `defaultSiteData` to avoid a hydration mismatch (localStorage is client-only),
    // then we swap in the cache. This is the SSR-safe pattern, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(loadSiteData());

    // 2) Fetch the source of truth and swap it in; keep the cache on failure.
    fetchContent()
      .then((remote) => {
        if (cancelled) return;
        const merged = mergeSiteData(remote);
        setData(merged);
        saveSiteData(merged); // refresh the offline cache
      })
      .catch(() => {
        /* API unreachable — keep the cache/defaults already shown */
      });

    // 3) Reflect edits (cache writes) made in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SITE_DATA_KEY) setData(loadSiteData());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
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
