/**
 * Fixed full-screen backgrounds (a particle canvas, a starfield, a sky) paint only the first
 * screen of a `captureBeyondViewport` shot: they are fixed to the viewport, and the capture does
 * not move it. Below the first screen the page would sit on its bare root colour.
 *
 * So the layer is captured on its own several times, spaced in time so its moving parts differ,
 * and the copies are stacked down the page under the content as one absolute, full-height layer:
 * each tile one screen tall, laid every (screen − 120) px, each later tile fading in over its top
 * 120 px — a moving part cut by a tile's bottom edge then ends under the next tile's opaque area
 * instead of drawing a seam. Works for any viewport (desktop 1440 × 900, phone 390 × 844 @2).
 */
import { sleep } from "./cdp.mjs";
import { ISOLATE_BG } from "./page.mjs";

const FADE = 120;
const geometry = (b) => ({ W: b.width, TILE: b.height, STRIDE: b.height - FADE });
const tileCount = (b, H) => {
  const { TILE, STRIDE } = geometry(b);
  return Math.max(1, Math.ceil((H - TILE) / STRIDE) + 1);
};
const screenshot = async (b) => (await b.send("Page.captureScreenshot", { format: "png" })).data;

/** The isolated background layer, captured `n` times `gap` ms apart (base64 PNGs). */
export async function captureBgTiles(b, H, gap = 650) {
  const n = tileCount(b, H);
  await b.ev(ISOLATE_BG(true));
  await sleep(250);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    tiles.push(await screenshot(b));
    if (i < n - 1) await sleep(gap);
  }
  await b.ev(ISOLATE_BG(false));
  return tiles;
}

const tileImg = (b, parent, data, i, fade) => {
  const { W, TILE, STRIDE } = geometry(b);
  const mask = fade && i > 0 ? `-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 ${FADE}px);mask-image:linear-gradient(to bottom,transparent 0,#000 ${FADE}px);` : "";
  return b.ev(`(async () => { const im = document.createElement("img"); im.src = "data:image/png;base64,${data}"; im.alt = ""; im.style.cssText = "position:absolute;left:0;top:${i * STRIDE}px;display:block;width:${W}px;height:${TILE}px;max-width:none;margin:0;padding:0;border:0;${mask}"; document.getElementById(${JSON.stringify(parent)}).appendChild(im); await im.decode(); return 1; })()`);
};

/**
 * Stack the tiles where the original layers were (same parent, same z-index), pinned to the
 * document's top-left, and hide the originals. Reports the ancestors that clip the new layer.
 */
export async function placeBgTiles(b, tiles, H) {
  const { W } = geometry(b);
  const info = await b.ev(`(() => {
    const first = document.querySelector("[data-sd-bg]");
    const wrap = document.createElement("div");
    wrap.id = "__sd_bgwrap";
    wrap.style.cssText = "position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none;margin:0;padding:0;z-index:" + getComputedStyle(first).zIndex;
    first.parentElement.insertBefore(wrap, first);
    const r = wrap.getBoundingClientRect();
    const dy = Math.round(r.top + scrollY), dx = Math.round(r.left + scrollX);
    if (dy || dx) { wrap.style.top = -dy + "px"; wrap.style.left = -dx + "px"; }
    const clips = [];
    for (let p = wrap.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const pc = getComputedStyle(p);
      if (pc.overflowX !== "visible" || pc.overflowY !== "visible" || pc.contain.includes("paint") || pc.clipPath !== "none") {
        const pr = p.getBoundingClientRect();
        clips.push({ x: Math.round(pr.left + scrollX), w: Math.round(pr.width), ovx: pc.overflowX });
      }
    }
    return { dx, dy, clips };
  })()`);
  for (let i = 0; i < tiles.length; i++) await tileImg(b, "__sd_bgwrap", tiles[i], i, true);
  await b.ev(`(() => { for (const e of document.querySelectorAll("[data-sd-bg]")) e.style.setProperty("visibility", "hidden", "important"); return 1; })()`);
  return info;
}

/**
 * cgam's background canvas lives in a page wrapper narrower than the screen with
 * `overflow: hidden`: the fixed canvas escapes that clip, the absolute copy does not, so the
 * side margins lost the background. A second copy as body's first child at z-index −1 paints
 * just above the root background — it only shows where the first copy is clipped away.
 */
export const clippedSides = (b, info) => (info?.clips ?? []).some((c) => c.ovx !== "visible" && (c.x > 0 || c.x + c.w < b.width));

export async function placeBgOuter(b, tiles, H) {
  const { W } = geometry(b);
  await b.ev(`(() => { const wrap = document.createElement("div"); wrap.id = "__sd_bgouter"; wrap.style.cssText = "position:absolute;left:0;top:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none;margin:0;padding:0;z-index:-1"; document.body.prepend(wrap); return 1; })()`);
  for (let i = 0; i < tiles.length; i++) await tileImg(b, "__sd_bgouter", tiles[i], i, true);
}

/*
 * balloonsbreeze: a static sky (a nebula image and a vignette) under a canvas of rising balloons.
 * Cross-faded whole-screen tiles left half-transparent "ghost" balloons in every fade band and
 * the same balloon repeating down a column. So the two are captured apart: the sky once (static,
 * tiled as above), the balloons as transparent frames a few seconds apart; each frame keeps only
 * the balloons wholly inside its own band (no cut or faded balloon anywhere), and the frames are
 * laid out in an interleaved order so neighbouring bands come from frames ~10 s apart.
 */
export async function captureSkyAndBalloons(b, H, gap = 2500) {
  const n = tileCount(b, H);
  await b.ev(ISOLATE_BG(true));
  await b.ev(`(() => { const s = document.createElement("style"); s.id = "__sd_nocanvas"; s.textContent = "[data-sd-bg] canvas{visibility:hidden!important}"; document.head.appendChild(s); return 1; })()`);
  await sleep(300);
  const sky = await screenshot(b);
  await b.ev(`(() => { document.getElementById("__sd_nocanvas").remove(); const s = document.createElement("style"); s.id = "__sd_onlycanvas"; s.textContent = "html,body{background:transparent!important}[data-sd-bg] *:not(canvas):not(:has(canvas)){visibility:hidden!important}"; document.head.appendChild(s); return 1; })()`);
  await b.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await sleep(300);
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push(await screenshot(b));
    if (i < n - 1) await sleep(gap);
  }
  await b.send("Emulation.setDefaultBackgroundColorOverride", {});
  await b.ev(`(() => { document.getElementById("__sd_onlycanvas").remove(); return 1; })()`);
  await b.ev(ISOLATE_BG(false));
  return { sky, frames };
}

/** Band order: a stride coprime with n, about n/3, so neighbouring bands are far apart in time. */
function frameOrder(n) {
  const gcd = (a, c) => (c ? gcd(c, a % c) : a);
  let k = Math.max(2, Math.ceil(n / 3));
  while (k < n && gcd(k, n) !== 1) k++;
  if (n < 3 || k >= n) return [...Array(n).keys()];
  return Array.from({ length: n }, (_, i) => (i * k) % n);
}

/** Erase every balloon (a connected run of opaque pixels) not wholly inside rows [top, bottom). */
const KEEP_WHOLE = (b64, top, bottom) => `(async () => {
  const img = new Image(); img.src = "data:image/png;base64,${b64}"; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight, N = W * H;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H), a = d.data;
  const lab = new Int32Array(N).fill(-1), stack = new Int32Array(N), boxes = [];
  for (let p = 0; p < N; p++) {
    if (lab[p] !== -1 || !a[p * 4 + 3]) continue;
    const id = boxes.length; let y0 = H, y1 = -1, sp = 0;
    lab[p] = id; stack[sp++] = p;
    while (sp) {
      const q = stack[--sp], x = q % W, y = (q - x) / W;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && lab[q - 1] === -1 && a[(q - 1) * 4 + 3]) { lab[q - 1] = id; stack[sp++] = q - 1; }
      if (x < W - 1 && lab[q + 1] === -1 && a[(q + 1) * 4 + 3]) { lab[q + 1] = id; stack[sp++] = q + 1; }
      if (y > 0 && lab[q - W] === -1 && a[(q - W) * 4 + 3]) { lab[q - W] = id; stack[sp++] = q - W; }
      if (y < H - 1 && lab[q + W] === -1 && a[(q + W) * 4 + 3]) { lab[q + W] = id; stack[sp++] = q + W; }
    }
    boxes.push(y0 >= ${top} && y1 < ${bottom});
  }
  for (let p = 0; p < N; p++) if (lab[p] !== -1 && !boxes[lab[p]]) a[p * 4 + 3] = 0;
  g.putImageData(d, 0, 0);
  return c.toDataURL("image/png").split(",")[1];
})()`;

/** Lay the balloon frames over the sky tiles already in #__sd_bgwrap (no fade: nothing to blend). */
export async function placeBalloons(b, frames, H) {
  const { TILE, STRIDE } = geometry(b);
  const n = frames.length;
  const order = frameOrder(n);
  for (let i = 0; i < n; i++) {
    const top = i === 0 ? 0 : 1; // only the page top may cut a balloon (as the screen's top does)
    const bottom = i === n - 1 ? Math.min(TILE, H - i * STRIDE) : STRIDE;
    const data = await b.ev(KEEP_WHOLE(frames[order[i]], top * b.dpr, bottom * b.dpr));
    await tileImg(b, "__sd_bgwrap", data, i, false);
  }
  return order;
}
