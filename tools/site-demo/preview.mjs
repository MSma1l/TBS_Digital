/**
 * Draw a demo's hotspots over its pictures — to LOOK at whether they sit on the buttons.
 *
 *   node tools/site-demo/preview.mjs <site> [--page=id,id] [--layout=desktop|phone] [--unpublished]
 *
 * Reads what the site reads (public/projects/demo/<project>/demo.json and the pictures it names)
 * — or, with --unpublished, the manifest built from the stored passes and their own pictures, to
 * look before publishing — and writes, under .work/site-demo/<project>/preview/:
 *   <page>-<d|m>.jpg          the whole shot, scaled down
 *   <page>-<d|m>-y<px>.jpg    full-size crops, top to bottom
 * Green = another page of the demo, blue = a scroll on this page, orange = "use the real site".
 * Each box carries its label; the dashed line is the bottom of the pinned header.
 * No site is opened: a headless browser only decodes the WebP and draws.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch } from "./cdp.mjs";
import { LAYOUTS, SITES } from "./config.mjs";
import { buildManifest, PUBLIC, WORK } from "./build.mjs";
import { parseManifest } from "./manifest.mjs";

const args = process.argv.slice(2);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const site = SITES[args.find((a) => !a.startsWith("--"))];
if (!site) {
  console.error(`usage: node tools/site-demo/preview.mjs <${Object.keys(SITES).join("|")}> [--page=id,id] [--layout=desktop|phone]`);
  process.exit(2);
}
const onlyPages = opt("page")?.split(",") ?? null;
const onlyKeys = opt("layout") ? opt("layout").split(",").map((l) => LAYOUTS[l].key) : ["d", "m"];
const built = args.includes("--unpublished") ? buildManifest(site) : null;
const m = parseManifest(built ? built.manifest : JSON.parse(readFileSync(join(PUBLIC, "projects", "demo", site.project, "demo.json"), "utf8")));
if (!m) throw new Error("the manifest does not parse");
const fileOf = (src) => built?.files.find((f) => f.to === src)?.from ?? join(PUBLIC, ...src.split("/").filter(Boolean));
const out = join(WORK, site.project, "preview");
mkdirSync(out, { recursive: true });

const DRAW = (b64, shot) => `(async () => {
  const img = new Image(); img.src = "data:image/webp;base64,${b64}"; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, s = W / ${shot.w};
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const C = { page: "#00c853", anchor: "#2979ff", site: "#ff6d00" };
  const fs = Math.max(11, Math.round(11 * s * (s < 1 ? 1.3 : 0.7)));
  g.font = "600 " + fs + "px system-ui, sans-serif"; g.textBaseline = "top";
  for (const h of ${JSON.stringify(shot.hot)}) {
    const [x, y, w, hh] = h.r.map((v) => v * s);
    g.fillStyle = C[h.k] + "2e"; g.fillRect(x, y, w, hh);
    g.strokeStyle = C[h.k]; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, hh - 2));
    const tag = h.t + (h.k === "page" ? " → " + h.to + (h.at ? "@" + h.at : "") : h.k === "anchor" ? " ↓" + h.at : h.path ? " ↗" + h.path : " ↗");
    const tw = g.measureText(tag).width + 6, ty = y - fs - 4 < 0 ? y + hh : y - fs - 4;
    g.fillStyle = C[h.k]; g.fillRect(x, ty, tw, fs + 4); g.fillStyle = "#fff"; g.fillText(tag, x + 3, ty + 2);
  }
  ${shot.fixed ? `g.setLineDash([10, 6]); g.strokeStyle = "#e040fb"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, ${shot.fixed} * s); g.lineTo(W, ${shot.fixed} * s); g.stroke();` : ""}
  window.__ov = c;
  return [W, H];
})()`;
const JPEG = (sx, sy, sw, sh, dw, dh) => `(() => { const c = document.createElement("canvas"); c.width = ${dw}; c.height = ${dh}; const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(window.__ov, ${sx}, ${sy}, ${sw}, ${sh}, 0, 0, ${dw}, ${dh}); return c.toDataURL("image/jpeg", 0.85).split(",")[1]; })()`;

const b = await launch({ width: 1200, height: 900, name: "preview" });
try {
  for (const page of m.pages) {
    if (onlyPages && !onlyPages.includes(page.id)) continue;
    for (const k of onlyKeys) {
      const shot = page[k];
      if (!shot) continue;
      const b64 = readFileSync(fileOf(shot.src)).toString("base64");
      const [W, H] = await b.ev(DRAW(b64, shot));
      const ow = k === "d" ? 540 : 390;
      const oh = Math.round((H * ow) / W);
      writeFileSync(join(out, `${page.id}-${k}.jpg`), Buffer.from(await b.ev(JPEG(0, 0, W, H, ow, oh)), "base64"));
      const band = k === "d" ? 900 : 1400;
      let n = 1;
      for (let y = 0; y < H; y += band, n++) {
        const hh = Math.min(band, H - y);
        writeFileSync(join(out, `${page.id}-${k}-y${String(y).padStart(5, "0")}.jpg`), Buffer.from(await b.ev(JPEG(0, y, W, hh, W, hh)), "base64"));
      }
      const by = (kind) => shot.hot.filter((h) => h.k === kind).length;
      console.log(`${page.id}.${k}: ${W}×${H} · ${shot.hot.length} hotspots (${by("page")} page, ${by("anchor")} anchor, ${by("site")} site) · ${n - 1} crops`);
    }
  }
} finally {
  await b.close();
}
console.log(`→ ${out}`);
