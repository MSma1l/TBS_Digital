/**
 * From the stored passes to the manifest, and the files to where the site reads them.
 *
 * A pass is one page in one layout: its capture, the controls surveyed in the same layout pass
 * (capture.mjs), and what pressing each one did on the live site (probe.mjs). Here every control
 * becomes a hotspot that switches the screen to another page of the demo (`page`), scrolls this
 * one (`anchor`), or asks the visitor to use the real site (`site`) — or nothing, if it did
 * nothing. Each pass's image is checked against the hash taken when it was written: a capture and
 * its rectangles only ever ship together.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUTS } from "./config.mjs";
import { DEMO_MAX_BYTES, LIMITS, parseHotspot, parseManifest } from "./manifest.mjs";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const PUBLIC = join(ROOT, "public");
export const WORK = join(ROOT, ".work", "site-demo");
export const passDir = (site) => join(WORK, site.project, "pass");
export const passFile = (site, layoutKey, pageId) => join(passDir(site), `${layoutKey}-${pageId}.json`);
export const sha1 = (buf) => createHash("sha1").update(buf).digest("hex");

const sameSite = (a, b) => a.replace(/^www\./, "") === b.replace(/^www\./, "");
const norm = (p) => p.replace(/\/+$/, "") || "/";

/** What a control is from its markup alone, before anyone presses it. */
export function classifyStatic(it, pageUrl) {
  const here = new URL(pageUrl);
  if (it.href != null || it.abs) {
    const raw = (it.href ?? "").trim();
    if (/^tel:/i.test(raw)) return { kind: "tel" };
    if (/^mailto:/i.test(raw)) return { kind: "mailto" };
    if (raw === "" || raw === "#" || /^javascript:/i.test(raw)) return { kind: "js-link" };
    let u;
    try {
      u = new URL(it.abs || raw, pageUrl);
    } catch {
      return { kind: "js-link" };
    }
    if (!/^https?:$/.test(u.protocol)) return { kind: "other-scheme", host: u.protocol.replace(":", "") };
    if (!sameSite(u.hostname, here.hostname)) return { kind: "external", host: u.hostname };
    if (it.download || /\.(pdf|docx?|xlsx?|zip)$/i.test(u.pathname)) return { kind: "file", href: u.href };
    const samePath = norm(u.pathname) === norm(here.pathname) && u.search === here.search;
    if (samePath && u.hash) return { kind: "anchor", id: decodeURIComponent(u.hash.slice(1)) };
    if (samePath) return { kind: "self" };
    return { kind: "internal", href: u.href };
  }
  if (/^(ro|ru|en|rom[aâ]n[aă]|русский|english)$/i.test((it.vis ?? "").trim())) return { kind: "lang" };
  if (it.tag === "a") return { kind: "js-link" };
  if (/^(input|select|textarea)$/.test(it.tag) || it.tag === "label") {
    if (it.tag === "input" && /^(submit|image)$/.test(it.inputType)) return { kind: "submit" };
    return { kind: it.inForm ? "form-field" : "input" };
  }
  if (it.tag === "button" && it.inForm && (it.type == null || it.type === "submit")) return { kind: "submit" };
  if (it.haspopup || it.controls || it.expanded != null) return { kind: "toggle" };
  return { kind: "button" };
}

/**
 * The probe result a control goes by: its own; a sibling's, when it was one of a big group of
 * look-alikes and was not pressed itself; or, when its own press did nothing only because of the
 * state at load (the active tab, a carousel's "previous" on its first slide), a live sibling's.
 */
function effectOf(pass, i) {
  const probes = pass.probe?.results ?? [];
  const pr = probes[i];
  if (!pr) return null;
  const live = (p) => p?.eff && !p.eff.every((e) => e.type === "none");
  if (pr.inferred) {
    const sib = probes.find((p) => p && p.group === pr.group && live(p)) ?? probes.find((p) => p && p.group === pr.group && p.eff);
    return sib ? { eff: sib.eff, how: "group", self: sib.self } : null;
  }
  if (!pr.eff) return { eff: [], how: "own", error: pr.error };
  const kind = (k) => classifyStatic(pass.items[k], pass.url).kind;
  if (!live(pr) && /^(button|toggle)$/.test(kind(i))) {
    const parent = (l) => l.replace(/ > [^>]+$/, "");
    const mine = parent(pass.items[i].loc);
    const j = probes.findIndex((p, k) => k !== i && live(p) && /^(button|toggle)$/.test(kind(k)) && !p.eff.some((e) => /route|load|newtab|scroll/.test(e.type)) && (p.group === pr.group || (parent(pass.items[k].loc) === mine && pass.items[k].tag === pass.items[i].tag)));
    if (j >= 0) return { eff: probes[j].eff, how: "sibling", self: probes[j].self };
  }
  return { eff: pr.eff, how: "own", self: pr.self };
}

/** Where a link to `#id` lands: the element's top less its scroll margins, within the page. */
function idLanding(pass, id, L) {
  const t = pass?.ids?.[id];
  if (!t) return undefined;
  const max = Math.max(0, pass.docH - L.height);
  return Math.round(Math.min(max, Math.max(0, t.y - t.smt - (pass.spt || 0))));
}

/** A link's destination, in the demo's terms. */
function route(url, ctx, landing) {
  const { site, page, L } = ctx;
  let u;
  try {
    u = new URL(url, ctx.pass.url);
  } catch {
    return { k: "site", path: page.path, why: "a link that does not parse" };
  }
  if (!/^https?:$/.test(u.protocol) || !sameSite(u.hostname, new URL(site.origin).hostname)) return { k: "site", path: page.path, why: `leaves for ${u.hostname || u.protocol}` };
  const key = norm(u.pathname) + u.search;
  const fold = site.fold?.[key];
  if (fold && ctx.ids.has(fold.page)) {
    const at = landing ?? idLanding(ctx.passes[fold.page], fold.id, L);
    if (fold.page === page.id) return { k: "anchor", at: at ?? 0, why: `${key} is this page` };
    return { k: "page", to: fold.page, at, key, why: `${key} is a state of "${fold.page}"` };
  }
  const target = u.search ? null : site.pages.find((p) => ctx.ids.has(p.id) && norm(p.path) === norm(u.pathname));
  if (target) {
    const at = u.hash ? idLanding(ctx.passes[target.id], decodeURIComponent(u.hash.slice(1)), L) : undefined;
    if (target.id === page.id) return { k: "anchor", at: at ?? 0, why: "a link to this page" };
    return { k: "page", to: target.id, at, key, why: "a page of the demo" };
  }
  return { k: "site", path: key, why: "a page outside the demo" };
}

/** What the control does in the demo, and why. */
function actionFor(it, ctx) {
  const { page } = ctx;
  const st = classifyStatic(it, ctx.pass.url);
  const here = (why) => ({ k: "site", path: page.path, why });
  switch (st.kind) {
    case "tel":
    case "mailto":
      return { ...here(st.kind), st };
    case "external":
    case "other-scheme":
      return { ...here(`leaves for ${st.host}`), st };
    case "file":
      return { ...route(st.href, ctx), why: "a file", st };
    case "lang":
      return { ...here("switches the language"), st };
    case "form-field":
    case "input":
      return { ...here("a field"), st };
    case "submit":
      return { ...here("sends a form"), st };
  }
  if (it.disabled) return { k: "none", why: "disabled", st };
  const pr = effectOf(ctx.pass, it.i);
  let fx = pr?.eff ?? [];
  // Changed text was all the press showed, and with nothing pressed the page changed as close to
  // the control (probe.mjs `changedAt`; `self` is a level, false for nowhere, true for anywhere):
  // no proof the press did it. A real control (a link, a button, a click handler) still goes to
  // the site; a bare `cursor: pointer` element is a decoration.
  const selfAt = typeof pr?.self === "number" ? pr.self : pr?.self === true ? 0 : Infinity;
  const pressAt = Math.min(...fx.map((e) => (typeof e.lvl === "number" ? e.lvl : 0)));
  const selfOnly = fx.length > 0 && fx.every((e) => e.type === "content") && selfAt <= pressAt;
  if (selfOnly && !it.sem && !it.handler) fx = [];
  const has = (t) => fx.find((e) => e.type === t);
  const out = (a) => ({ ...a, st, probe: pr ? pr.how : "no" });
  const go = has("route") || has("load");
  // a real href wins over an effect borrowed from a look-alike (two footer links, two pages)
  if (st.kind === "internal" && !(pr?.how === "own" && go)) return out(route(st.href, ctx));
  if (go) return out(route(go.url, ctx, go.sy));
  if (st.kind === "self" && !has("modal") && !has("newtab") && !has("scroll")) return out({ k: "anchor", at: 0, why: "a link to this page" });
  if (has("newtab")) return out(route(has("newtab").url, ctx));
  if (st.kind === "anchor") return out({ k: "anchor", at: has("scroll")?.y ?? idLanding(ctx.pass, st.id, ctx.L) ?? 0, why: `#${st.id}` });
  if (has("scroll")) return out({ k: "anchor", at: has("scroll").y, why: "scrolls the page" });
  if (has("modal")) return out(here("opens a dialog"));
  if (has("toggle") || has("content") || has("slide")) return out(here(selfOnly ? "changes the page in place (its section also changes by itself)" : "changes the page in place"));
  if (has("focus")) return out(here("takes input"));
  if (selfOnly && !fx.length) return out({ k: "none", why: "did nothing: its section changes by itself" });
  if (fx.length && fx.every((e) => e.type === "none" || e.type === "hash")) return out({ k: "none", why: "did nothing" });
  return out(here(pr?.error ? `not pressed (${pr.error})` : "not pressed"));
}

/* ---------- labels ---------- */

const HOSTS = [
  [/(^|\.)t\.me$|telegram/, "Telegram"],
  [/whatsapp|(^|\.)wa\.me$/, "WhatsApp"],
  [/viber/, "Viber"],
  [/facebook|(^|\.)fb\.com$/, "Facebook"],
  [/instagram/, "Instagram"],
  [/linkedin/, "LinkedIn"],
  [/youtube|youtu\.be/, "YouTube"],
  [/tiktok/, "TikTok"],
  [/maps\.google|maps\.app|goo\.gl/, "Hartă"],
];
const EMAIL_RE = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
const PHONE_RE = /(?:\+|\b0)\d[\d\s().-]{6,}\d/g;
const contactKey = (s) => (s.includes("@") ? s.toLowerCase() : s.replace(/\D/g, ""));

/** One line, at most 100 characters, cut at a word. */
export function shorten(s, max = 100) {
  const v = String(s).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, "") + "…";
}

/**
 * The control's accessible name: its visible text (a long card goes by its heading); a field by
 * its label; an icon by its aria-label, title or image text; else an honest description from
 * where it leads ("Telegram", "Telefon"), else a rule from config.mjs. An e-mail or a phone in it
 * stays only when it is the business's own public contact (config `contacts`).
 */
function labelFor(it, st, ctx) {
  const rule = (ctx.site.labels ?? []).find((l) => (!l.page || l.page === ctx.page.id) && (!l.layout || l.layout === ctx.layoutKey) && l.when(it));
  const words = (s) => (s && /[\p{L}\p{N}]/u.test(s) ? s : "");
  let t = rule?.t ?? "";
  let how = "config";
  if (!t && /^(input|select|textarea)$/.test(it.tag)) {
    t = words(it.field) || words(it.aria) || words(it.placeholder) || words(it.title) || words(it.value) || words(it.name);
    how = "field";
  } else if (!t) {
    t = words(it.vis);
    how = "text";
    if (t.length > 80 && words(it.heading)) {
      t = it.heading;
      how = "heading";
    }
    if (!t) {
      t = words(it.aria) || words(it.title) || words(it.alt) || words(it.svg) || words(it.inner) || words(it.value);
      how = "name";
    }
  }
  if (!t) {
    t = st.kind === "tel" ? "Telefon" : st.kind === "mailto" ? "E-mail" : st.host ? (HOSTS.find(([re]) => re.test(st.host))?.[1] ?? st.host.replace(/^www\./, "")) : "";
    how = "described";
  }
  if (!t && it.vis) {
    t = it.vis; // a bare symbol ("×", "‹"): better than nothing
    how = "symbol";
  }
  if (!t) {
    t = it.tag === "a" ? "Link" : "Buton";
    how = "generic";
  }
  // a contact is looked for in the whole text: cut first, an address or a number cut short would slip by
  const allowed = new Set((ctx.site.contacts ?? []).map(contactKey));
  const email = (t.match(EMAIL_RE) ?? []).find((m) => !allowed.has(contactKey(m)));
  const phone = (t.match(PHONE_RE) ?? []).find((m) => m.replace(/\D/g, "").length >= 8 && !allowed.has(contactKey(m)));
  if (email) return { t: "E-mail", how: "private e-mail removed" };
  if (phone) return { t: "Telefon", how: "private phone removed" };
  return { t: shorten(t), how };
}

/* ---------- shots ---------- */

/** One rectangle per line of a wrapped link, in whole CSS px, cut to the shot. */
function rectsOf(it, W, H) {
  return (it.frags?.length ? it.frags : [it])
    .map((q) => {
      const x0 = Math.max(0, Math.floor(q.x));
      const y0 = Math.max(0, Math.floor(q.y));
      const x1 = Math.min(W, Math.ceil(q.x + q.w));
      const y1 = Math.min(H, Math.ceil(q.y + q.h));
      return x1 - x0 >= 1 && y1 - y0 >= 1 ? [x0, y0, x1 - x0, y1 - y0] : null;
    })
    .filter(Boolean);
}

/**
 * Line by line, left to right — the order a keyboard walks them. A line is everything whose middle
 * falls within the first box of the line, so a header row whose items sit a few px apart in y
 * stays one row.
 */
function readingOrder(rows) {
  const lines = [];
  for (const x of [...rows].sort((a, b) => a.h.r[1] - b.h.r[1] || a.h.r[0] - b.h.r[0])) {
    const [, y, , h] = x.h.r;
    const line = lines.at(-1);
    if (line && y + h / 2 >= line.top && y + h / 2 <= line.bottom) line.items.push(x);
    else lines.push({ top: y, bottom: y + h, items: [x] });
  }
  return lines.flatMap((l) => l.items.sort((a, b) => a.h.r[0] - b.h.r[0]));
}

function buildShot(ctx, src, ids) {
  const { pass, L } = ctx;
  const W = L.width;
  const H = pass.H;
  const fields = new Set(pass.items.filter((it) => /^(input|select|textarea)$/.test(it.tag)).map((it) => it.i));
  const rows = [];
  const inert = [];
  const notes = [];
  for (const it of pass.items) {
    if (it.y >= H) continue; // below the cut
    // a field's own label: the field carries its text, and pressing the label only focuses it
    if (it.tag === "label" && it.ctl != null && fields.has(it.ctl) && !/^(checkbox|radio)$/.test(it.labelFor ?? "")) continue;
    let act = actionFor(it, ctx);
    if (act.k === "none") {
      inert.push(`${(it.vis || it.aria || it.tag).slice(0, 40)} (${act.why})`);
      continue;
    }
    if (act.k === "anchor" && act.at >= H) act = { ...act, k: "site", path: ctx.page.path, why: `lands at ${act.at}, past the cut` };
    if (act.k === "page" && act.at != null && act.at >= (ctx.passes[act.to]?.H ?? Infinity)) act = { ...act, k: "site", path: act.key, why: `lands past the cut of "${act.to}"` };
    const lab = labelFor(it, act.st, ctx);
    if (pass.probe?.results?.[it.i]?.found === "text") notes.push(`"${lab.t}" at ${Math.round(it.x)},${Math.round(it.y)} was found again by its words, not its place — check what it does in the preview`);
    if (lab.how === "generic" || lab.how === "symbol" || lab.how.startsWith("private")) notes.push(`label "${lab.t}" (${lab.how}) for a ${it.tag} at ${Math.round(it.x)},${Math.round(it.y)} — add a rule to config.mjs if it deserves a better name`);
    for (const r of rectsOf(it, W, H)) {
      const h = { r, t: lab.t, k: act.k };
      if (act.k === "page") {
        h.to = act.to;
        if (act.at > 0) h.at = act.at;
      } else if (act.k === "anchor") h.at = Math.round(act.at);
      else if (act.path) h.path = act.path;
      h.el = it.tag === "a" ? "link" : "button";
      rows.push({ h, why: act.why, probe: act.probe ?? "-", label: lab.how, i: it.i });
    }
  }
  // the same rectangle doing the same thing once, in reading order
  const seen = new Set();
  let list = readingOrder(
    rows.filter(({ h }) => {
      const k = JSON.stringify([h.r, h.k, h.to, h.at, h.path]);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
  );
  if (list.length > LIMITS.MAX_HOTSPOTS) {
    const rank = { page: 0, anchor: 1, site: 2 };
    const keep = new Set([...list].sort((a, b) => rank[a.h.k] - rank[b.h.k]).slice(0, LIMITS.MAX_HOTSPOTS));
    notes.push(`${list.length - keep.size} "site" hotspots over the limit of ${LIMITS.MAX_HOTSPOTS} left out`);
    list = list.filter((x) => keep.has(x));
  }
  list = list.filter(({ h }) => {
    const ok = parseHotspot(h, W, H, ids) !== null;
    if (!ok) notes.push(`hotspot "${h.t}" would not pass lib/siteDemo.ts — left out`);
    return ok;
  });
  const band = pass.band?.bottom ?? 0;
  const shot = { src, w: W, h: H, hot: list.map((x) => x.h) };
  if (band > 0 && band < H) shot.fixed = band;
  if (pass.cut) shot.cut = true;
  return { shot, report: { rows: list.map(({ h, why, probe, label, i }) => ({ i, k: h.k, t: h.t, r: h.r, to: h.to, at: h.at, path: h.path, why, probe, label })), inert, notes } };
}

/* ---------- the manifest ---------- */

export function loadPass(site, layoutKey, pageId) {
  const file = passFile(site, layoutKey, pageId);
  if (!existsSync(file)) return null;
  const pass = JSON.parse(readFileSync(file, "utf8"));
  const img = join(passDir(site), pass.image.file);
  if (!existsSync(img) || sha1(readFileSync(img)) !== pass.image.sha1) throw new Error(`${pass.image.file} is not the capture its hotspots were measured on — capture ${pageId} (${layoutKey}) again`);
  return { ...pass, imagePath: img };
}

const shotSrc = (site, layoutKey, pageId) => (layoutKey === "desktop" && pageId === site.pages[0].id ? site.startShot : `/projects/demo/${site.project}/${pageId}-${LAYOUTS[layoutKey].key}.webp`);

/** The manifest from every stored pass of the site, its report, and the files it names. */
export function buildManifest(site) {
  const passes = {};
  for (const layoutKey of Object.keys(LAYOUTS)) {
    passes[layoutKey] = {};
    for (const p of site.pages) {
      const pass = loadPass(site, layoutKey, p.id);
      if (pass) passes[layoutKey][p.id] = pass;
    }
  }
  // the demo's pages: those with a desktop capture (a link to any other asks for the real site)
  const ids = new Set(site.pages.filter((p) => passes.desktop?.[p.id]).map((p) => p.id));
  const pages = [];
  const report = [];
  const files = [];
  for (const page of site.pages) {
    const entry = { id: page.id };
    for (const layoutKey of Object.keys(LAYOUTS)) {
      const pass = passes[layoutKey][page.id];
      if (!pass) continue;
      const ctx = { site, page, layoutKey, L: LAYOUTS[layoutKey], pass, passes: passes[layoutKey], ids };
      const src = shotSrc(site, layoutKey, page.id);
      const { shot, report: r } = buildShot(ctx, src, ids);
      entry[LAYOUTS[layoutKey].key] = shot;
      files.push({ from: pass.imagePath, to: src });
      report.push({ page: page.id, layout: layoutKey, h: pass.H, docH: pass.docH, cut: !!pass.cut, fixed: shot.fixed ?? 0, captured: pass.at, ...r });
    }
    if (!entry.d) {
      if (page === site.pages[0]) throw new Error(`no desktop capture of the start page "${page.id}" — run a capture first`);
      report.push({ page: page.id, notes: ["no desktop capture: left out of the demo"] });
      continue;
    }
    const pass = passes.desktop[page.id];
    const title = shorten(page.title ?? pass.title ?? page.id);
    pages.push({ id: page.id, title, path: page.path, d: entry.d, ...(entry.m ? { m: entry.m } : {}) });
  }
  const manifest = { v: 1, lang: "ro", start: site.pages[0].id, pages };
  // every page, hotspot and path must survive the site's own parser untouched
  const json = JSON.stringify(manifest);
  if (Buffer.byteLength(json) > DEMO_MAX_BYTES) throw new Error(`demo.json is ${Buffer.byteLength(json)} bytes, over the ${DEMO_MAX_BYTES} the site reads`);
  const parsed = parseManifest(JSON.parse(json));
  if (!parsed) throw new Error("the manifest does not pass lib/siteDemo.ts's parser");
  for (const [i, p] of manifest.pages.entries()) {
    for (const k of ["d", "m"]) {
      if (!p[k]) continue;
      const got = parsed.pages[i][k];
      if (!got || got.hot.length !== p[k].hot.length) throw new Error(`${p.id}.${k}: the parser would drop hotspots`);
    }
  }
  return { manifest, json, report, files };
}

/** Write the images and demo.json where the site reads them, each through a temp file. */
export function publish(site, { json, files }) {
  const demoDir = join(PUBLIC, "projects", "demo", site.project);
  mkdirSync(demoDir, { recursive: true });
  const written = [];
  for (const f of files) {
    const to = join(PUBLIC, ...f.to.split("/").filter(Boolean));
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(f.from, to + ".tmp");
    renameSync(to + ".tmp", to);
    written.push(to);
  }
  const manifestFile = join(demoDir, "demo.json");
  writeFileSync(manifestFile + ".tmp", json);
  renameSync(manifestFile + ".tmp", manifestFile);
  // a page that left the set leaves no picture behind
  const keep = new Set(written.map((p) => p.toLowerCase()));
  for (const name of readdirSync(demoDir)) {
    const p = join(demoDir, name);
    if (name.endsWith(".webp") && !keep.has(p.toLowerCase())) rmSync(p);
  }
  return { manifestFile, written };
}
