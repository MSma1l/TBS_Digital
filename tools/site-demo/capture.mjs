/**
 * Capture a project site for /portofoliu's screen: every page of its demo, in both layouts, with
 * the links and buttons recorded over each capture — then the manifest and the files.
 *
 *   node tools/site-demo/capture.mjs <site> [--layout=desktop|phone] [--only=page,page]
 *                                           [--check] [--no-publish] [--build-only]
 *
 * Sites and their pages are in config.mjs. Per page and layout, in ONE layout pass of the live
 * site (Romanian, writes blocked): load, scroll through, hide what floats, rebuild a fixed
 * background, freeze the animations, survey every control, capture — then press each control on
 * a fresh load to see what it does. That pass (capture + rectangles + effects) is stored under
 * .work/site-demo/<project>/pass/, and the manifest is built from the stored passes, so a capture
 * and its hotspots are always regenerated together.
 *
 *   --check       prove the alignment: outline every control in the page and find the outline's
 *                 edges in a second capture (a few seconds more per page)
 *   --no-publish  build and report, but leave public/ alone
 *   --build-only  no browser: rebuild the manifest from the stored passes (after a rule change)
 */
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodePng, imageSize, sleep } from "./cdp.mjs";
import { LAYOUTS, SITES } from "./config.mjs";
import { captureBgTiles, captureSkyAndBalloons, clippedSides, placeBalloons, placeBgOuter, placeBgTiles } from "./fixes.mjs";
import { EAGER_IMAGES, FINISH_ANIMS, HIDE_FLOATERS, IDS, MARK_BG, PIN_BAND, REDACT, REDACT_LEFT, STOP_TIMERS, SURVEY, WAIT_IMAGES } from "./page.mjs";
import { probePage } from "./probe.mjs";
import { buildManifest, passDir, passFile, publish, sha1, WORK } from "./build.mjs";
import { gotoUrl, openSite, scrollThrough, toRomanian, waitStable } from "./site.mjs";
import { printValidation, validateProject } from "./validate.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const key = args.find((a) => !a.startsWith("--"));
const site = SITES[key];
if (!site) {
  console.error(`usage: node tools/site-demo/capture.mjs <${Object.keys(SITES).join("|")}> [--layout=desktop|phone] [--only=page,page] [--check] [--no-publish] [--build-only]`);
  process.exit(2);
}
const layouts = opt("layout") ? opt("layout").split(",") : Object.keys(LAYOUTS);
const only = opt("only")?.split(",") ?? null;
for (const l of layouts) if (!LAYOUTS[l]) throw new Error(`unknown layout ${l}`);
for (const p of only ?? []) if (!site.pages.some((x) => x.id === p)) throw new Error(`${key} has no page "${p}"`);
const pages = site.pages.filter((p) => !only || only.includes(p.id));
const sec = (ms) => `${(ms / 1000).toFixed(1)} s`;

/** Where the outline drawn around a control really is, against where the survey said it is. */
function measure(plain, outlined, r) {
  const isM = (x, y) => {
    if (x < 0 || y < 0 || x >= outlined.w || y >= outlined.h) return false;
    const a = outlined.get(x, y);
    const c = plain.get(x, y);
    // a site-wide CSS filter recolours the magenta: look for any strong change, not the colour
    return Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]) > 90;
  };
  const S = 8;
  const rows = [];
  const cols = [];
  for (let y = Math.floor(r.y + r.h * 0.25); y <= Math.ceil(r.y + r.h * 0.75) - 1; y++) rows.push(y);
  for (let x = Math.floor(r.x + r.w * 0.25); x <= Math.ceil(r.x + r.w * 0.75) - 1; x++) cols.push(x);
  if (!rows.length) rows.push(Math.round(r.y + r.h / 2));
  if (!cols.length) cols.push(Math.round(r.x + r.w / 2));
  const colF = (c) => rows.filter((y) => isM(c, y)).length / rows.length;
  const rowF = (y) => cols.filter((c) => isM(c, y)).length / cols.length;
  const edge = (pred, fn, rising) => {
    let out = null;
    let bd = Infinity;
    for (let p = Math.floor(pred) - S; p <= Math.ceil(pred) + S; p++) {
      if (fn(p) >= 0.5 && !(fn(rising ? p - 1 : p + 1) >= 0.5)) {
        const e = rising ? p : p + 1;
        if (Math.abs(e - pred) < bd) {
          bd = Math.abs(e - pred);
          out = e;
        }
      }
    }
    return out == null ? null : +(out - pred).toFixed(2);
  };
  return { dl: edge(r.x, colF, true), dr: edge(r.x + r.w, colF, false), dt: edge(r.y, rowF, true), db: edge(r.y + r.h, rowF, false) };
}

/**
 * The alignment proof: a plain PNG of the page, then the controls outlined (3 px magenta, inset —
 * paint only, layout untouched), in passes where no two outlines come within 4 px; every predicted
 * edge is matched to the nearest outline edge. Errors are in capture px.
 */
async function checkAlignment(b, survey, H) {
  const L = b.layout;
  const K = L.scale * L.dpr;
  const items = survey.items.filter((it) => it.y < H);
  const color = new Map();
  for (const a of items) {
    const used = new Set();
    for (const [j, c] of color) {
      const o = survey.items[j];
      if (a.x - 4 < o.x + o.w && o.x - 4 < a.x + a.w && a.y - 4 < o.y + o.h && o.y - 4 < a.y + a.h) used.add(c);
    }
    let k = 0;
    while (used.has(k)) k++;
    color.set(a.i, k);
  }
  const nPass = Math.max(1, ...[...color.values()].map((c) => c + 1));
  const png = async () => decodePng(Buffer.from((await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: L.width, height: H, scale: L.scale } })).data, "base64"));
  const plain = await png();
  await b.ev(`(() => { const s = document.createElement("style"); s.id = "__sd_outline"; s.textContent = "[data-sd-hso]{outline:3px solid #ff00ff !important;outline-offset:-3px !important;transition:none !important}"; document.head.appendChild(s); return 1; })()`);
  const rows = [];
  for (let p = 0; p < nPass; p++) {
    const mine = items.filter((it) => color.get(it.i) === p);
    await b.ev(`(() => { const on = new Set(${JSON.stringify(mine.map((it) => it.i))}); for (const e of document.querySelectorAll("[data-sd-hs]")) e.toggleAttribute("data-sd-hso", on.has(Number(e.dataset.sdHs))); return 1; })()`);
    await sleep(200);
    const outlined = await png();
    for (const it of mine) {
      for (const q of it.frags ?? [it]) {
        if (q.y >= H) continue;
        rows.push({ i: it.i, t: (it.vis || it.aria || it.tag).slice(0, 30), ...measure(plain, outlined, { x: q.x * K, y: q.y * K, w: q.w * K, h: q.h * K }) });
      }
    }
  }
  await b.ev(`(() => { document.getElementById("__sd_outline").remove(); for (const e of document.querySelectorAll("[data-sd-hso]")) e.removeAttribute("data-sd-hso"); return 1; })()`);
  const again = await b.ev(SURVEY); // the same controls in the same places after all the captures?
  let shift = 0;
  for (const it of again.items) {
    const a = survey.items[it.i];
    if (a && a.loc === it.loc) shift = Math.max(shift, Math.abs(a.x - it.x), Math.abs(a.y - it.y), Math.abs(a.w - it.w), Math.abs(a.h - it.h));
  }
  const edges = rows.flatMap((r) => [r.dl, r.dr, r.dt, r.db]).filter((v) => v != null).map(Math.abs).sort((x, y) => x - y);
  const at = (q) => (edges.length ? edges[Math.min(edges.length - 1, Math.floor(q * edges.length))] : null);
  const worst = rows
    .map((r) => ({ ...r, max: Math.max(...[r.dl, r.dr, r.dt, r.db].filter((v) => v != null).map(Math.abs), 0) }))
    .sort((x, y) => y.max - x.max)
    .slice(0, 5);
  return { passes: nPass, rects: rows.length, edges: edges.length, missing: rows.length * 4 - edges.length, median: at(0.5), p95: at(0.95), max: edges.at(-1) ?? null, shiftCss: +shift.toFixed(2), worst };
}

/** One page in the layout the browser is in: capture, survey, probe — stored as a pass. */
async function capturePage(b, page, { check }) {
  const L = b.layout;
  const url = new URL(page.path, site.origin).href;
  const t0 = Date.now();
  const T = {};
  const mark = (k) => (T[k] = Date.now() - t0);
  const writes0 = b.blocked.length;
  const nav = await gotoUrl(b, url);
  const host = (u) => new URL(u).hostname.replace(/^www\./, "");
  if (host(nav.url) !== host(site.origin)) throw new Error(`${url} landed on ${nav.url}`);
  if (site.stopTimers) await b.ev(STOP_TIMERS);
  mark("load");
  await b.ev(EAGER_IMAGES);
  await scrollThrough(b);
  await sleep(600);
  const images = await b.ev(WAIT_IMAGES(8000));
  // what is not ours to republish goes before anything is measured or captured (config redact);
  // a rule that must reach this page and reaches nothing stops it: the page changed under it
  const rules = (site.redact ?? []).filter((r) => !r.on || r.on.includes(page.id));
  const reached = await b.ev(REDACT(rules));
  const missed = rules.filter((r, k) => r.must?.includes(page.id) && !reached[k]);
  if (missed.length) throw new Error(`nothing to redact on ${page.id} for ${missed.map((r) => r.blur ?? r.text).join(", ")}: the page changed — see redact in config.mjs`);
  const floaters = await b.ev(HIDE_FLOATERS);
  const band = await b.ev(PIN_BAND);
  mark("scroll");
  const H0 = Math.min(await b.ev("document.scrollingElement.scrollHeight"), L.maxH);
  const bg = await b.ev(MARK_BG);
  let tiles = null;
  let layered = null;
  if (bg.length) {
    if (site.layered) {
      layered = await captureSkyAndBalloons(b, H0);
      tiles = layered.frames.map(() => layered.sky);
    } else tiles = await captureBgTiles(b, H0);
  }
  await b.send("Animation.enable");
  await b.ev(FINISH_ANIMS);
  await b.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await sleep(250);
  await b.ev(FINISH_ANIMS); // whatever a timer started after the freeze
  if (tiles) {
    const info = await placeBgTiles(b, tiles, H0);
    if (clippedSides(b, info)) await placeBgOuter(b, tiles, H0);
    if (layered) await placeBalloons(b, layered.frames, H0);
    await sleep(250);
  }
  mark("fixes");
  await b.move(2, L.height - 2); // nothing left in a hover state
  await b.ev("window.scrollTo(0, 0)");
  await sleep(200);
  // the rectangles, measured in the very state the capture is taken in
  const survey = await b.ev(SURVEY);
  const ids = await b.ev(IDS);
  await waitStable(b);
  const docH = await b.ev("document.scrollingElement.scrollHeight");
  const H = Math.min(docH, L.maxH);
  const shot = await b.send("Page.captureScreenshot", { format: "webp", quality: 80, captureBeyondViewport: true, clip: { x: 0, y: 0, width: L.width, height: H, scale: L.scale } });
  const buf = Buffer.from(shot.data, "base64");
  const K = L.scale * L.dpr;
  const size = imageSize(buf);
  if (!size || size.w !== Math.round(L.width * K) || Math.abs(size.h - H * K) > 2) throw new Error(`the capture is ${size?.w}×${size?.h}, not ${L.width * K}×${H * K}`);
  const left = await b.ev(REDACT_LEFT(rules));
  if (left.length) throw new Error(`still on ${page.id} as it was captured: ${left.join(", ")}`);
  mark("capture");
  const alignment = check ? await checkAlignment(b, survey, H) : null;
  if (check) mark("check");
  await b.send("Animation.setPlaybackRate", { playbackRate: 1 });
  const probe = await probePage(b, url, survey, H, (line) => console.log(line));
  mark("probe");

  const file = `${b.layoutKey}-${page.id}.webp`;
  mkdirSync(passDir(site), { recursive: true });
  writeFileSync(join(passDir(site), file), buf);
  const pass = {
    project: site.project, layout: b.layoutKey, page: page.id, path: page.path, at: new Date().toISOString(),
    url: survey.url, status: nav.status, title: survey.title, headings: survey.headings,
    docH, H, cut: docH > L.maxH, band, ids, spt: survey.spt,
    items: survey.items, dropped: survey.dropped, probe,
    image: { file, bytes: buf.length, sha1: sha1(buf), w: size.w, h: size.h },
    floaters, bg, imagesMissing: images.still, redacted: rules.map((r, k) => ({ rule: r.blur ?? r.text, reached: reached[k] })), writesBlocked: b.blocked.slice(writes0), dialogs: b.dialogs.slice(),
    alignment, timing: T,
  };
  writeFileSync(passFile(site, b.layoutKey, page.id), JSON.stringify(pass));
  return pass;
}

async function runLayout(layoutKey) {
  const L = LAYOUTS[layoutKey];
  console.log(`\n${site.project} · ${layoutKey} ${L.width}×${L.height} @${L.dpr}`);
  const t0 = Date.now();
  const failed = [];
  const b = await openSite(site, layoutKey, L);
  b.layoutKey = layoutKey;
  try {
    const ro = await toRomanian(b);
    console.log(`  Romanian: ${ro.ok ? "yes" : "NO"} (${ro.via ?? "by default"}) — lang=${ro.state.htmlLang} h1=${JSON.stringify(ro.state.h1[0] ?? "").slice(0, 60)}`);
    if (!ro.ok) throw new Error(`the site did not switch to Romanian: ${JSON.stringify(ro.state)}`);
    for (const page of pages) {
      console.log(`  ${page.id} ${page.path}`);
      try {
        const p = await capturePage(b, page, { check: flag("check") });
        const probed = p.probe.results.filter((r) => r?.eff).length;
        console.log(`  → ${p.H}${p.cut ? ` of ${p.docH} (cut)` : ""} css px · ${p.image.w}×${p.image.h} ${(p.image.bytes / 1024).toFixed(0)} KB · header ${p.band.bottom} · ${p.items.length} controls, ${probed} pressed, ${p.probe.inferred} by a sibling · ${p.writesBlocked.length} writes blocked · ${sec(p.timing.probe)}`);
        if (p.redacted.length) console.log(`    redacted: ${p.redacted.map((r) => `${r.rule} ×${r.reached}`).join(" · ")}`);
        if (p.alignment) {
          const a = p.alignment;
          console.log(`    alignment (capture px): median ${a.median} · p95 ${a.p95} · max ${a.max} · ${a.missing} of ${a.rects * 4} edges not found · shift ${a.shiftCss} css px`);
        }
      } catch (err) {
        failed.push(page.id);
        console.error(`  ✗ ${page.id}: ${err.stack ?? err}`);
      }
    }
  } finally {
    const closed = await b.close();
    console.log(`  browser closed${closed ? "" : " (its temp profile was left behind)"} · ${sec(Date.now() - t0)}`);
  }
  return failed;
}

const t0 = Date.now();
const failed = [];
if (!flag("build-only")) for (const l of layouts) failed.push(...(await runLayout(l)).map((p) => `${l}/${p}`));
if (failed.length) {
  console.error(`\nNot published: ${failed.join(", ")} failed. Run again with --only=… (the other passes are kept).`);
  process.exit(1);
}

const built = buildManifest(site);
mkdirSync(join(WORK, site.project), { recursive: true });
writeFileSync(join(WORK, site.project, "build.json"), JSON.stringify(built.report, null, 2));
console.log(`\n${site.project}: demo.json ${(Buffer.byteLength(built.json) / 1024).toFixed(1)} KB`);
for (const r of built.report) {
  if (!r.rows) {
    console.log(`  ${r.page}: ${r.notes.join("; ")}`);
    continue;
  }
  const by = (k) => r.rows.filter((x) => x.k === k).length;
  console.log(`  ${(r.page + " " + r.layout).padEnd(28)} h ${String(r.h).padStart(5)}${r.cut ? " (cut)" : "      "} · fixed ${String(r.fixed).padStart(3)} · ${String(r.rows.length).padStart(3)} hotspots: ${by("page")} page, ${by("anchor")} anchor, ${by("site")} site · ${r.inert.length} inert`);
  for (const n of r.notes) console.log(`      ! ${n}`);
}
if (flag("no-publish")) {
  console.log(`\nNot published (--no-publish). Report: ${join(WORK, site.project, "build.json")}`);
} else {
  const { written } = publish(site, built);
  const kb = written.reduce((n, f) => n + statSync(f).size, 0) / 1024;
  console.log(`\nPublished ${written.length} images (${kb.toFixed(0)} KB) and public/projects/demo/${site.project}/demo.json`);
  const v = validateProject(site.project);
  printValidation([v]);
  if (!v.ok) process.exit(1);
}
console.log(`done in ${sec(Date.now() - t0)}`);
