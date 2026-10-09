/**
 * Check the demo manifests on disk the way the site will read them.
 *
 *   node tools/site-demo/validate.mjs [project …]      (default: every public/projects/demo/*)
 *
 * Each demo.json goes through manifest.mjs (lib/siteDemo.ts's rules): whether the site takes it
 * at all, how many hotspots of each shot it keeps and drops, whether a rectangle had to be cut
 * to its shot; and every picture it names must exist and still be the shape its hotspots were
 * measured on. Exits 1 on anything the site would refuse or lose.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "./cdp.mjs";
import { DEMO_MAX_BYTES, parseManifest, shotFits } from "./manifest.mjs";

const PUBLIC = fileURLToPath(new URL("../../public/", import.meta.url));

export function validateProject(id) {
  const file = join(PUBLIC, "projects", "demo", id, "demo.json");
  const res = { id, ok: true, problems: [], shots: [], bytes: 0 };
  const fail = (m) => {
    res.ok = false;
    res.problems.push(m);
  };
  if (!existsSync(file)) {
    fail("no demo.json");
    return res;
  }
  res.bytes = statSync(file).size;
  if (res.bytes > DEMO_MAX_BYTES) fail(`demo.json is ${res.bytes} bytes (the site refuses more than ${DEMO_MAX_BYTES})`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    fail(`not JSON: ${err.message}`);
    return res;
  }
  const m = parseManifest(raw);
  if (!m) {
    fail("refused whole by lib/siteDemo.ts (version, language, page ids, start, a title or a desktop shot)");
    return res;
  }
  res.pages = m.pages.length;
  if (raw.pages.length !== m.pages.length) fail(`${raw.pages.length - m.pages.length} page(s) dropped`);
  for (const [i, page] of m.pages.entries()) {
    for (const k of ["d", "m"]) {
      const rawShot = raw.pages[i][k];
      const shot = page[k];
      if (rawShot === undefined) continue;
      if (!shot) {
        fail(`${page.id}.${k}: the shot is refused`);
        continue;
      }
      const rawHot = Array.isArray(rawShot.hot) ? rawShot.hot : [];
      const clipped = shot.hot.filter((h, j) => JSON.stringify(h.r) !== JSON.stringify(rawHot[j]?.r)).length;
      const row = { page: page.id, k, w: shot.w, h: shot.h, raw: rawHot.length, kept: shot.hot.length, clipped, by: {}, src: shot.src, cut: !!shot.cut, fixed: shot.fixed ?? 0 };
      for (const h of shot.hot) row.by[h.k] = (row.by[h.k] ?? 0) + 1;
      if (row.kept !== row.raw) fail(`${page.id}.${k}: ${row.raw - row.kept} hotspot(s) dropped`);
      const img = join(PUBLIC, ...shot.src.split("/").filter(Boolean));
      if (!existsSync(img)) fail(`${page.id}.${k}: ${shot.src} is missing`);
      else {
        const buf = readFileSync(img);
        const size = imageSize(buf);
        row.img = size;
        row.kb = buf.length / 1024;
        if (!size || !shotFits(size.w, size.h, shot)) fail(`${page.id}.${k}: ${shot.src} is ${size?.w}×${size?.h}, not the shape of ${shot.w}×${shot.h}`);
      }
      res.shots.push(row);
    }
  }
  return res;
}

export function printValidation(results) {
  for (const r of results) {
    const kb = r.shots.reduce((n, s) => n + (s.kb ?? 0), 0);
    console.log(`${r.ok ? "ok  " : "FAIL"} ${r.id}: ${r.pages ?? 0} pages · demo.json ${(r.bytes / 1024).toFixed(1)} KB · images ${kb.toFixed(0)} KB`);
    for (const s of r.shots) {
      const by = ["page", "anchor", "site"].map((k) => `${s.by[k] ?? 0} ${k}`).join(", ");
      console.log(`     ${(s.page + "." + s.k).padEnd(24)} ${String(s.w).padStart(4)}×${String(s.h).padEnd(5)} kept ${s.kept}/${s.raw}${s.clipped ? ` (${s.clipped} cut to the shot)` : ""} — ${by}${s.fixed ? ` · fixed ${s.fixed}` : ""}${s.cut ? " · cut" : ""} · ${s.img ? `${s.img.w}×${s.img.h}` : "?"} ${(s.kb ?? 0).toFixed(0)} KB`);
    }
    for (const p of r.problems) console.log(`     ! ${p}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  const root = join(PUBLIC, "projects", "demo");
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : existsSync(root) ? readdirSync(root).filter((d) => existsSync(join(root, d, "demo.json"))) : [];
  const results = ids.map(validateProject);
  printValidation(results);
  if (!results.length) console.log("no manifests found");
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
