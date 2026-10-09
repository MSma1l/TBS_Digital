/**
 * A project's interactive demo in /portofoliu's screen (2026-10-06: "să putem apăsa butoane dar
 * să nu putem folosi pe deplin, să se ceară să trecem deja după link la site").
 *
 * A manifest — `public/projects/demo/<id>/demo.json`, named by a project's `demo` field — lists a
 * few pages of the project's site, each a capture with the real links and buttons recorded over
 * it as rectangles ("hotspots", taken in the same layout pass as the capture by
 * `tools/site-demo/`). A link to another of the pages switches the screen to that page, an
 * in-page link scrolls, and anything that needs the real site (a form, a login, a search, a
 * chat) opens a prompt that points there — or, for a private system with no public site, offers
 * a similar project instead.
 *
 * Pure: no DOM, no React, no `"use client"`. The manifests are ours, but they are parsed as if
 * they were not: every id, number, label and path is checked before anything is drawn from it,
 * and a link out never leaves the project's own site.
 */
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { isLink } from "@/lib/validation";

/** A manifest bigger than this is ignored: one whose server says so (Content-Length) unread. */
export const DEMO_MAX_BYTES = 256 * 1024;
const MAX_PAGES = 12;
const MAX_HOTSPOTS = 160;
/** A shot's coordinate space: a desktop layout is 1440 wide; nothing is wider than this. */
const MAX_SHOT_WIDTH = 4000;
const MAX_SHOT_HEIGHT = 40000;
const MAX_LABEL = 120;
const MAX_HISTORY = 20;
const ID_RE = /^[a-z0-9-]{1,32}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

/** What a hotspot does: open another page of the demo, scroll this one, or ask for the real site. */
export type DemoKind = "page" | "anchor" | "site";

export type DemoHotspot = {
  /** Where, in its shot's own units (`DemoShot.w` × `DemoShot.h`): left, top, width, height. */
  r: readonly [number, number, number, number];
  /** The visible text of the link or button, as captured — its accessible name. */
  t: string;
  k: DemoKind;
  /** `page`: the page it opens. */
  to?: string;
  /** `page`: where in that page it lands; `anchor`: where in this one — the y the live site's view
   *  starts at once it has jumped (shot units), its own header offset already in: a pinned band
   *  covers what the live header covers. */
  at?: number;
  /** `site`: the path on the real site the prompt offers (its own site only). */
  path?: string;
  /** What it was on the real site: its role in the larger view. */
  el?: "link" | "button";
};

export type DemoShot = {
  /** The picture: a site path (`/projects/…`). Any pixel size of the same shape as `w` × `h`. */
  src: string;
  /** The shot's coordinate space — the layout's CSS px for a site (1440 × H on a desktop). */
  w: number;
  h: number;
  hot: DemoHotspot[];
  /** A fixed header's height at the top (shot units), pinned while the page scrolls. */
  fixed?: number;
  /** The page goes on past the capture (a long one is cut): its end offers the real site. */
  cut?: boolean;
};

export type DemoPage = {
  id: string;
  /** The page's own title, in the site's language (never translated: it is the site's text). */
  title: string;
  /** Its path on the real site, for the address and the prompt's link. */
  path?: string;
  /** The desktop shot, and the phone one where it was taken. */
  d: DemoShot;
  m?: DemoShot;
};

export type DemoManifest = {
  v: 1;
  /** The language the captures are in (their labels are read in it). */
  lang: Locale;
  start: string;
  pages: DemoPage[];
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** A path on a site of ours or the project's: `/…`, never `//…`, never a scheme. */
export function sitePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.startsWith("/") && !v.startsWith("//") && isLink(v) ? v : null;
}

/** A visible label: one line of plain text, 1-120 characters. */
function label(value: unknown): string | null {
  if (typeof value !== "string" || CONTROL_RE.test(value)) return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v.length >= 1 && v.length <= MAX_LABEL ? v : null;
}

function parseHotspot(raw: unknown, w: number, h: number, ids: ReadonlySet<string>): DemoHotspot | null {
  const o = record(raw);
  if (!o || !Array.isArray(o.r) || o.r.length !== 4 || !o.r.every(isNum)) return null;
  const [x, y, rw, rh] = o.r as number[];
  // clipped into the shot; nothing outside it, nothing of no size
  const x0 = clamp(x, 0, w);
  const y0 = clamp(y, 0, h);
  const x1 = clamp(x + rw, 0, w);
  const y1 = clamp(y + rh, 0, h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const t = label(o.t);
  if (!t) return null;
  const el: DemoHotspot["el"] = o.el === "link" ? "link" : o.el === "button" ? "button" : undefined;
  const base = { r: [x0, y0, x1 - x0, y1 - y0] as const, t, el };
  switch (o.k) {
    case "page":
      if (typeof o.to !== "string" || !ids.has(o.to)) return null;
      return { ...base, k: "page", to: o.to, at: isNum(o.at) ? Math.max(0, o.at) : undefined };
    case "anchor":
      return isNum(o.at) ? { ...base, k: "anchor", at: clamp(o.at, 0, h) } : null;
    case "site": {
      if (o.path === undefined) return { ...base, k: "site" };
      const path = sitePath(o.path);
      return path ? { ...base, k: "site", path } : null;
    }
    default:
      return null;
  }
}

function parseShot(raw: unknown, ids: ReadonlySet<string>): DemoShot | null {
  const o = record(raw);
  if (!o) return null;
  const src = sitePath(o.src);
  if (!src || !isNum(o.w) || !isNum(o.h)) return null;
  const w = o.w;
  const h = o.h;
  if (w <= 0 || h <= 0 || w > MAX_SHOT_WIDTH || h > MAX_SHOT_HEIGHT) return null;
  const hot = (Array.isArray(o.hot) ? o.hot.slice(0, MAX_HOTSPOTS) : [])
    .map((x) => parseHotspot(x, w, h, ids))
    .filter((x): x is DemoHotspot => x !== null);
  const fixed = isNum(o.fixed) && o.fixed > 0 ? Math.min(o.fixed, h) : undefined;
  return { src, w, h, hot, fixed, cut: o.cut === true || undefined };
}

/**
 * A manifest as drawn, or null when it is not one: the wrong version or language, no pages, a
 * page id that repeats or is malformed, a start that is not a page. A hotspot that does not
 * check out — a link to a page that is not there, a rectangle outside its shot, a label with
 * control characters, a path that is not a plain path — is dropped on its own.
 */
export function parseManifest(raw: unknown): DemoManifest | null {
  const o = record(raw);
  if (!o || o.v !== 1 || !isLocale(o.lang) || typeof o.start !== "string") return null;
  if (!Array.isArray(o.pages) || o.pages.length < 1 || o.pages.length > MAX_PAGES) return null;
  const ids = new Set<string>();
  for (const p of o.pages) {
    const id = record(p)?.id;
    if (typeof id !== "string" || !ID_RE.test(id) || ids.has(id)) return null;
    ids.add(id);
  }
  if (!ids.has(o.start)) return null;
  const pages: DemoPage[] = [];
  for (const p of o.pages) {
    const q = record(p) as Record<string, unknown>;
    const title = label(q.title);
    const d = parseShot(q.d, ids);
    if (!title || !d) return null;
    const m = q.m === undefined ? undefined : (parseShot(q.m, ids) ?? undefined);
    const path = q.path === undefined ? undefined : (sitePath(q.path) ?? undefined);
    pages.push({ id: q.id as string, title, path, d, m });
  }
  return { v: 1, lang: o.lang, start: o.start, pages };
}

/**
 * The real page a prompt sends the visitor to: `path` on the project's own site — never another
 * origin, never another scheme. Null for a project without a public site.
 */
export function deepLink(path: string | undefined, projectUrl: string): string | null {
  try {
    const base = new URL(projectUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    const target = new URL(path ?? "/", base);
    return target.origin === base.origin ? target.href : null;
  } catch {
    return null;
  }
}

/** The address the screen's bar shows for a page: "bizcheck.md/test/bizcheck". Null without a site. */
export function addressOf(projectUrl: string, page?: Pick<DemoPage, "path">): string | null {
  try {
    const base = new URL(projectUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") return null;
    const host = base.host.replace(/^www\./, "");
    const path = page?.path && page.path !== "/" ? page.path.replace(/\/$/, "") : "";
    return host + path;
  } catch {
    return null;
  }
}

/** Whether a loaded picture is still the shape its hotspots were measured on (within 1%). */
export function shotFits(naturalWidth: number, naturalHeight: number, shot: Pick<DemoShot, "w" | "h">): boolean {
  if (!(naturalWidth > 0 && naturalHeight > 0)) return false;
  const want = shot.h / shot.w;
  return Math.abs(naturalHeight / naturalWidth - want) / want <= 0.01;
}

/* ---------- where the visitor is in a demo ---------- */

/** The prompt: what was pressed, and the page of the real site it would take them to. */
export type DemoPrompt = { label: string; path?: string };

export type DemoNav = {
  page: string;
  /** The pages behind, newest last, each with the share of its height it was scrolled to. */
  back: { page: string; share: number }[];
  prompt: DemoPrompt | null;
  /** The page list in the bar, open. */
  list: boolean;
};

export type DemoStep =
  | { type: "reset"; start: string }
  | { type: "go"; page: string; share: number }
  | { type: "back" }
  | { type: "prompt"; prompt: DemoPrompt }
  | { type: "dismiss" }
  | { type: "list"; open: boolean };

export const startNav = (start: string): DemoNav => ({ page: start, back: [], prompt: null, list: false });

/** One step through a demo. `go` remembers how far down the page left was (for Back). */
export function demoStep(nav: DemoNav, step: DemoStep): DemoNav {
  switch (step.type) {
    case "reset":
      return startNav(step.start);
    case "go":
      if (step.page === nav.page) return { ...nav, prompt: null, list: false };
      return {
        page: step.page,
        back: [...nav.back, { page: nav.page, share: clamp(step.share, 0, 1) }].slice(-MAX_HISTORY),
        prompt: null,
        list: false,
      };
    case "back": {
      const last = nav.back[nav.back.length - 1];
      if (!last) return nav;
      return { page: last.page, back: nav.back.slice(0, -1), prompt: null, list: false };
    }
    case "prompt":
      return { ...nav, prompt: step.prompt, list: false };
    case "dismiss":
      return nav.prompt || nav.list ? { ...nav, prompt: null, list: false } : nav;
    case "list":
      return { ...nav, list: step.open, prompt: step.open ? null : nav.prompt };
  }
}
