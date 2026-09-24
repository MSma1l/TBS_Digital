/**
 * The cutout, second attempt, and the first one's failure is the reason for every choice here.
 *
 * Attempt one walled the flood on the luminance gradient alone. It leaked, and it leaked in the
 * one place a person always leaks: the HAIR. Fine strands leave single-pixel gaps in the
 * boundary, the flood found one, and once inside it ate the face — smooth skin is exactly the
 * flat region a gradient wall cannot hold. 87.4% of the frame came back as background.
 *
 * So the wall is now built from BOTH cues, because they fail in different places:
 *   - the EDGE: the studio backdrop runs at a gradient of 0.6–1.4 and the blazer's boundary
 *     spikes to 70, which is the only thing that separates cream cloth from a near-white
 *     backdrop on the light side of the frame;
 *   - the COLOUR: measured against a fitted plane the backdrop's own residual tops out at 48.7
 *     while hair reaches 222 and skin 102, which holds exactly where the edge is porous.
 * A pixel is passable only if it is flat AND backdrop-coloured. Then the wall map is DILATED by
 * one pixel, because a boundary with a single weak pixel in it is not a boundary.
 */
import sharp from 'sharp';

const SRC = '/app/work/asistent-sursa.jpg';
const OUT = '/app/work';
const WALL = 10;      /* gradient (±2 px) at or above this is a wall */
const FAR = 85;
const FEATHER = 2.0;

const src = sharp(SRC);
const { width: W, height: H } = await src.metadata();
const rgb = await src.clone().removeAlpha().raw().toBuffer();
const at = (x, y) => { const i = (y * W + x) * 3; return [rgb[i], rgb[i + 1], rgb[i + 2]]; };

/* ---- the backdrop's colour, as a plane per channel ---------------------------------------- */
const seeds = [];
const band = Math.round(W * 0.03);
for (let y = 0; y < H; y += 4) {
  for (let x = 0; x < band; x += 2) seeds.push([x, y]);
  for (let x = W - band; x < W; x += 2) seeds.push([x, y]);
}
for (let y = 0; y < Math.round(H * 0.03); y += 2) for (let x = 0; x < W; x += 6) seeds.push([x, y]);

const plane = (ch) => {
  let sxx = 0, sxy = 0, sx1 = 0, syy = 0, sy1 = 0, s11 = 0, sxc = 0, syc = 0, s1c = 0;
  for (const [x, y] of seeds) {
    const v = at(x, y)[ch];
    sxx += x * x; sxy += x * y; sx1 += x; syy += y * y; sy1 += y; s11 += 1;
    sxc += x * v; syc += y * v; s1c += v;
  }
  const M = [[sxx, sxy, sx1], [sxy, syy, sy1], [sx1, sy1, s11]], V = [sxc, syc, s1c];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), rep = (k) => M.map((row, i) => row.map((v, j) => (j === k ? V[i] : v)));
  return [det(rep(0)) / D, det(rep(1)) / D, det(rep(2)) / D];
};
const P = [plane(0), plane(1), plane(2)];

/* ---- the two wall cues -------------------------------------------------------------------- */
const lumBuf = await src.clone().greyscale().blur(1.0).raw().toBuffer();
const L = (x, y) => lumBuf[y * W + x];

const wall = new Uint8Array(W * H);
let wEdge = 0, wFar = 0;
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    const gx = L(Math.min(W - 1, x + 2), y) - L(Math.max(0, x - 2), y);
    const gy = L(x, Math.min(H - 1, y + 2)) - L(x, Math.max(0, y - 2));
    const edge = Math.hypot(gx, gy) >= WALL;
    const p = at(x, y);
    const m = P.map(([a, b, d]) => a * x + b * y + d);
    const far = Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) >= FAR;
    if (edge) wEdge += 1;
    if (far) wFar += 1;
    wall[i] = edge || far ? 1 : 0;
  }
}
console.log(`ziduri: ${((100 * wEdge) / (W * H)).toFixed(1)}% pe muchie, ${((100 * wFar) / (W * H)).toFixed(1)}% pe culoare`);

/* dilate the wall by one pixel: a boundary with a single weak pixel in it is not a boundary */
const thick = new Uint8Array(W * H);
for (let y = 0; y < H; y += 1) {
  for (let x = 0; x < W; x += 1) {
    const i = y * W + x;
    if (wall[i]) { thick[i] = 1; continue; }
    if ((x > 0 && wall[i - 1]) || (x < W - 1 && wall[i + 1]) ||
        (y > 0 && wall[i - W]) || (y < H - 1 && wall[i + W])) thick[i] = 1;
  }
}

/* ---- flood the backdrop inward from the frame's border ------------------------------------- */
const bg = new Uint8Array(W * H);
const queue = new Int32Array(W * H);
let head = 0, tail = 0;
const push = (i) => { if (!bg[i] && !thick[i]) { bg[i] = 1; queue[tail++] = i; } };
for (let x = 0; x < W; x += 1) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y += 1) { push(y * W); push(y * W + W - 1); }
while (head < tail) {
  const i = queue[head++], x = i % W, y = (i / W) | 0;
  if (x > 0) push(i - 1);
  if (x < W - 1) push(i + 1);
  if (y > 0) push(i - W);
  if (y < H - 1) push(i + W);
}
let bgN = 0;
for (let i = 0; i < bg.length; i += 1) if (bg[i]) bgN += 1;
console.log(`fundal atins de inundare: ${((100 * bgN) / (W * H)).toFixed(1)}% din cadru`);

/* The flood stops one pixel short everywhere, because the wall was thickened and because the
   boundary itself is a wall. Give it back: any non-background pixel completely surrounded by
   background within a 2px reach is a rim, not the subject. */
const solid = new Uint8Array(W * H);
for (let i = 0; i < W * H; i += 1) solid[i] = bg[i] ? 0 : 1;

/* EVERY connected blob above a floor, not just the largest. Attempt two kept only the biggest
   one and the head came back missing: wherever the flood pinches the neck, the head becomes a
   blob of its own and "largest" throws it away. Specks in the backdrop are what the floor is
   for. */
const seen = new Uint8Array(W * H);
const blobs = [];
for (let s = 0; s < W * H; s += 1) {
  if (!solid[s] || seen[s]) continue;
  const q2 = [s]; seen[s] = 1;
  let h2 = 0;
  while (h2 < q2.length) {
    const i = q2[h2++], x = i % W, y = (i / W) | 0;
    if (x > 0 && solid[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; q2.push(i - 1); }
    if (x < W - 1 && solid[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; q2.push(i + 1); }
    if (y > 0 && solid[i - W] && !seen[i - W]) { seen[i - W] = 1; q2.push(i - W); }
    if (y < H - 1 && solid[i + W] && !seen[i + W]) { seen[i + W] = 1; q2.push(i + W); }
  }
  blobs.push(q2);
}
blobs.sort((a, b) => b.length - a.length);
console.log('blocuri (primele 8), ca procent din cadru si unde stau:');
for (const b of blobs.slice(0, 8)) {
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (const i of b) { const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  console.log(`  ${((100 * b.length) / (W * H)).toFixed(3)}%  x ${bx0}..${bx1}  y ${by0}..${by1}`);
}
const FLOOR = 0.0004 * W * H;
const kept = blobs.filter((b) => b.length >= FLOOR);
const best = kept.flat();
console.log(`pastrate ${kept.length} blocuri, ${((100 * best.length) / (W * H)).toFixed(1)}% din cadru`);

const alpha = Buffer.alloc(W * H);
for (const i of best) alpha[i] = 255;

let x0 = W, y0 = H, x1 = -1, y1 = -1;
for (const i of best) {
  const x = i % W, y = (i / W) | 0;
  if (x < x0) x0 = x; if (x > x1) x1 = x;
  if (y < y0) y0 = y; if (y > y1) y1 = y;
}
console.log(`persoana ocupa x ${x0}..${x1}, y ${y0}..${y1}  (${x1 - x0 + 1} x ${y1 - y0 + 1})`);

/* the ground truth, as pictures: what the flood reached, and what the walls are */
await sharp(Buffer.from(bg.map((v) => (v ? 255 : 0))), { raw: { width: W, height: H, channels: 1 } })
  .resize({ width: 480 }).png().toFile(`${OUT}/diag-inundare.png`);
await sharp(Buffer.from(thick.map((v) => (v ? 255 : 0))), { raw: { width: W, height: H, channels: 1 } })
  .resize({ width: 480 }).png().toFile(`${OUT}/diag-ziduri.png`);
await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
  .resize({ width: 480 }).png().toFile(`${OUT}/diag-masca.png`);
console.log('scrise diagnosticele');

/* The buffer that comes back is INSPECTED, not assumed. A blur on a one-channel raw image can
   come back with a different channel count, and a silent mismatch here shifts the whole matte
   down the frame — which is exactly what happened: the head's silhouette landed on the
   shoulders and the face was cut away. */
const softOut = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
  .blur(FEATHER).raw().toBuffer({ resolveWithObject: true });
console.log(`masca inmuiata: ${softOut.info.width} x ${softOut.info.height}, ${softOut.info.channels} canale, ${softOut.data.length} octeti (astept ${W * H})`);
const sc = softOut.info.channels;
let soft = softOut.data;
if (sc !== 1) {
  soft = Buffer.alloc(W * H);
  for (let i = 0; i < W * H; i += 1) soft[i] = softOut.data[i * sc];
}
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0, j = 0, k = 0; i < W * H; i += 1, j += 3, k += 4) {
  rgba[k] = rgb[j]; rgba[k + 1] = rgb[j + 1]; rgba[k + 2] = rgb[j + 2]; rgba[k + 3] = soft[i];
}
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
const cut = sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
  .extract({ left: x0, top: y0, width: cw, height: ch });
await cut.clone().png().toFile(`${OUT}/asistent-decupat.png`);
await cut.clone().flatten({ background: { r: 255, g: 0, b: 180 } }).resize({ width: 520 }).png().toFile(`${OUT}/previzualizare-magenta.png`);
await cut.clone().flatten({ background: { r: 8, g: 10, b: 18 } }).resize({ width: 520 }).png().toFile(`${OUT}/previzualizare-negru.png`);
console.log('scrise previzualizarile');
