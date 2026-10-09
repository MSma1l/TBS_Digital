/**
 * lib/siteDemo.ts's manifest checks, ported to plain JS so the tool can run them without a
 * TypeScript build: `parseManifest` and what it leans on — `sitePath` (with `isLink` from
 * lib/validation.ts), the label rule and the limits.
 *
 * KEEP IT IN STEP WITH THOSE TWO FILES. The site drops whatever does not pass them, silently: a
 * hotspot with a bad label simply is not there. The tool writes nothing this port would drop
 * (build.mjs), and validate.mjs reports what it keeps and drops of every manifest on disk.
 */

export const DEMO_MAX_BYTES = 256 * 1024;
const MAX_PAGES = 12;
const MAX_HOTSPOTS = 160;
const MAX_SHOT_WIDTH = 4000;
const MAX_SHOT_HEIGHT = 40000;
const MAX_LABEL = 120;
const ID_RE = /^[a-z0-9-]{1,32}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const LOCALES = ["ro", "ru", "en"];

/* lib/validation.ts — isLink */
const LINK_MAX = 500;
const DANGEROUS_SCHEME_RE = /^\s*(?:javascript|data|vbscript|file)\s*:/i;
const UNSAFE_LINK_CHARS_RE = /[<>"'`\s\\]/;
function isLink(value) {
  const v = value.trim();
  if (!v) return true;
  if (v.length > LINK_MAX) return false;
  if (UNSAFE_LINK_CHARS_RE.test(v)) return false;
  if (DANGEROUS_SCHEME_RE.test(v)) return false;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/")) return true;
  return /^https?:\/\//i.test(v);
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/** A path on the project's own site: `/…`, never `//…`, never a scheme. */
export function sitePath(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.startsWith("/") && !v.startsWith("//") && isLink(v) ? v : null;
}

/** A visible label: one line of plain text, 1-120 characters. */
export function label(value) {
  if (typeof value !== "string" || CONTROL_RE.test(value)) return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v.length >= 1 && v.length <= MAX_LABEL ? v : null;
}

export function parseHotspot(raw, w, h, ids) {
  const o = record(raw);
  if (!o || !Array.isArray(o.r) || o.r.length !== 4 || !o.r.every(isNum)) return null;
  const [x, y, rw, rh] = o.r;
  const x0 = clamp(x, 0, w);
  const y0 = clamp(y, 0, h);
  const x1 = clamp(x + rw, 0, w);
  const y1 = clamp(y + rh, 0, h);
  if (x1 - x0 < 1 || y1 - y0 < 1) return null;
  const t = label(o.t);
  if (!t) return null;
  const base = { r: [x0, y0, x1 - x0, y1 - y0], t, el: o.el === "link" || o.el === "button" ? o.el : undefined };
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

export function parseShot(raw, ids) {
  const o = record(raw);
  if (!o) return null;
  const src = sitePath(o.src);
  if (!src || !isNum(o.w) || !isNum(o.h)) return null;
  const { w, h } = o;
  if (w <= 0 || h <= 0 || w > MAX_SHOT_WIDTH || h > MAX_SHOT_HEIGHT) return null;
  const hot = (Array.isArray(o.hot) ? o.hot.slice(0, MAX_HOTSPOTS) : []).map((x) => parseHotspot(x, w, h, ids)).filter((x) => x !== null);
  const fixed = isNum(o.fixed) && o.fixed > 0 ? Math.min(o.fixed, h) : undefined;
  return { src, w, h, hot, fixed, cut: o.cut === true || undefined };
}

/** The manifest as the site would draw it, or null when the site would refuse all of it. */
export function parseManifest(raw) {
  const o = record(raw);
  if (!o || o.v !== 1 || !LOCALES.includes(o.lang) || typeof o.start !== "string") return null;
  if (!Array.isArray(o.pages) || o.pages.length < 1 || o.pages.length > MAX_PAGES) return null;
  const ids = new Set();
  for (const p of o.pages) {
    const id = record(p)?.id;
    if (typeof id !== "string" || !ID_RE.test(id) || ids.has(id)) return null;
    ids.add(id);
  }
  if (!ids.has(o.start)) return null;
  const pages = [];
  for (const p of o.pages) {
    const q = record(p);
    const title = label(q.title);
    const d = parseShot(q.d, ids);
    if (!title || !d) return null;
    const m = q.m === undefined ? undefined : (parseShot(q.m, ids) ?? undefined);
    const path = q.path === undefined ? undefined : (sitePath(q.path) ?? undefined);
    pages.push({ id: q.id, title, path, d, m });
  }
  return { v: 1, lang: o.lang, start: o.start, pages };
}

/** Whether a picture is still the shape its hotspots were measured on (within 1%). */
export function shotFits(naturalWidth, naturalHeight, shot) {
  if (!(naturalWidth > 0 && naturalHeight > 0)) return false;
  const want = shot.h / shot.w;
  return Math.abs(naturalHeight / naturalWidth - want) / want <= 0.01;
}

export const LIMITS = { MAX_PAGES, MAX_HOTSPOTS, MAX_LABEL };
