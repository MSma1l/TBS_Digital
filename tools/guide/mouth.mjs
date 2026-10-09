/**
 * The assistant's mouth, as frames of her own face.
 *
 * WHY FRAMES OF HER FACE, AND NOT WINDOWS OVER IT (2026-10-08). The mouth used to be six windows
 * onto the portrait — the lower lip slid down, the upper lip up, a painted slit opened between
 * them — and the owner's verdict was the one this file exists to answer: "nu pare real parca se
 * vad taiturile". A sliding window is a rigid patch: the face around it stays where it is, so
 * wherever the window ends the picture is cut, and the eye finds the cut however soft the mask.
 * A face does not slide when it talks — the skin STRETCHES. The lower lip and the chin drop with
 * the jaw, the upper lip lifts a little, the corners follow, and the movement dies away into the
 * cheeks and the neck instead of stopping at an edge.
 *
 * So each frame here is the portrait itself, WARPED: a displacement field that is largest at the
 * lips, carries the chin with the jaw, and falls smoothly to exactly zero before the edge of the
 * patch. Where it is zero the frame is the source pixel, copied — so the patch has no edge to see.
 * Between the parted lips the field has no source to pull from, and that is the mouth: her upper
 * teeth first (a small opening shows nothing else), then below their edge the dark of the mouth,
 * the tongue and the edge of the lower teeth (`inside`).
 *
 * The frames are a grid: lip OPENING (the lower lip's drop at the centre, in source px) by lip
 * SHAPE (rounded / neutral / spread). Every display frame, the page blends the four frames around
 * the pose a speech track asks for — a track built out of the answer's own text
 * (components/hud/guide/speech.ts). The numbers that time the track and how the face here follows
 * the lips are measured, not guessed, but for three choices: the size, OPEN_MAX, half the measured,
 * and the corners' SPREAD_OUT and NARROW, kept small so that no opening reads as growth (docs/04,
 * "The mouth").
 *
 * Run it in the deps image (sharp lives there, not on anyone's machine), from Git Bash:
 *   MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect:/app -v /app/node_modules -w /app \
 *     tbs-deps:latest node tools/guide/mouth.mjs
 * It writes one file per frame, <opening>-<shape>.webp, into OUT (public/guide/gura).
 * PREVIEW=<dir> also writes the frames laid over the portrait and enlarged, for the eye.
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const SRC = process.env.SRC ?? 'public/guide/asistent-384.webp';
const OUT = process.env.OUT ?? 'public/guide/gura';
const PREVIEW = process.env.PREVIEW ?? '';

/* ---- the frames to draw ---------------------------------------------------------------------- */

/**
 * OPENING, in source px of the lower lip's drop at the centre. Her eyes are 58 source px apart
 * (the lids' centres in GuideAssistant.module.css: 15.0% of the bust's 384 px across, 1.9% of its
 * 452 down), and the tracked faces were scaled to a 63 mm inter-pupil distance, so 1 px is
 * 1.09 mm of face.
 */
export const OPEN_STEPS = Number(process.env.OPEN_STEPS ?? 11);
export const OPEN_MAX = Number(process.env.OPEN_MAX ?? 8);
/** SHAPE: -1 rounded (o, u), 0 neutral (a, ă), +1 spread (e, i). */
export const SHAPES = [-1, 0, 1];

/**
 * How the rest of the face follows the lower lip, as fractions of its drop (`open`).
 *
 * From the tracked faces (lips/measured.json, fitted within each stretch of speech). For every mm
 * the lips part, the lower lip's BORDER with the chin drops 0.76, the upper lip's border with the
 * skin lifts 0.085, the chin drops 0.49, and the two lips thin by the 0.16 left over between them
 * (shared here by their heights, 0.6 to the lower). The lips' INNER edges, which part, therefore
 * move 0.85 (lower) and 0.15 (upper); against the lower one's drop, the upper edge lifts 0.17, the
 * upper border 0.10, the lower border drops 0.89 and the chin 0.57. A lip rides on the jaw nearly
 * whole; it does not flatten.
 *
 * AND THE MOUTH DOES NOT WIDEN AS IT OPENS ("cand se deschide gura, ea parca se mareste", the owner,
 * 2026-10-08). On the same video a mouth parting its lips gets no wider than with them together up
 * to 7 mm and only a little wider beyond — 0.94 of that width at 1-3 mm, 0.95 at 3-5, 0.99 at 5-7,
 * 1.03 at 7-11 (width_by_aperture in lips/measured.json, from lips/analyze.py: the median over the
 * faces) — so an opening reads as the lips parting, the outline growing in height. Hers spread
 * 3.2 px a corner on every e and i, and while she spoke her mouth was 1.02-1.04 as wide as at rest
 * at those openings: wider and taller at once, which reads as a mouth growing. She is smiling at
 * rest, her corners already drawn back, so a spread vowel takes them only SPREAD_OUT further; a
 * rounded one still draws them in by SPREAD; and a small pull-in, NARROW of the drop, keeps every
 * opening at most as wide as she is at rest. Both are choices the study argues for, not
 * measurements: real mouths do widen about 3% at 7-11 mm, where hers now stays at 0.98-0.99, so that
 * no opening of hers reads as growth. While she speaks her mouth is as wide as at rest up to 5 mm
 * (1.00), and 0.98-0.99 of it beyond (lips/track.mjs prints it beside the faces').
 */
export const ANATOMY = {
  /** the upper lip's lift at the centre: its inner edge, and its border with the skin above */
  lift: Number(process.env.LIFT ?? 0.17),
  liftBorder: Number(process.env.LIFT_BORDER ?? 0.1),
  /** the mouth corners' drop (both lips meet there, so the gap stays shut at the corners) */
  corner: Number(process.env.CORNER ?? 0.32),
  /** the lower lip's border with the chin, riding down with the lip's inner edge */
  lipBorder: Number(process.env.LIP_BORDER ?? 0.89),
  /** the chin's drop */
  chin: Number(process.env.CHIN ?? 0.57),
  /** the corners' sideways travel for a full rounding (inwards), source px */
  spread: Number(process.env.SPREAD ?? 3.2),
  /** ... and for a full spread (outwards), from a mouth already smiling */
  spreadOut: Number(process.env.SPREAD_OUT ?? 1),
  /** a small pull-in of both corners per px of the lower lip's drop: chosen, not measured (above) */
  narrow: Number(process.env.NARROW ?? 0.1),
};

/* ---- the source ------------------------------------------------------------------------------- */

const { data: src, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
console.log(`portretul: ${W} x ${H}`);

const lumAt = (x, y) => {
  const o = (y * W + x) * 4;
  return 0.2126 * src[o] + 0.7152 * src[o + 1] + 0.0722 * src[o + 2];
};

/** Bilinear sample of the source at a real-valued point, into `out` (r, g, b, a as floats). */
function sample(x, y, out) {
  const fx = Math.min(W - 1.001, Math.max(0, x - 0.5));
  const fy = Math.min(H - 1.001, Math.max(0, y - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  for (let c = 0; c < 4; c += 1) {
    const a = src[(y0 * W + x0) * 4 + c];
    const b = src[(y0 * W + x0 + 1) * 4 + c];
    const d = src[((y0 + 1) * W + x0) * 4 + c];
    const e = src[((y0 + 1) * W + x0 + 1) * 4 + c];
    out[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
  }
  return out;
}

/* ---- where her mouth is: measured off the picture -------------------------------------------- */

/**
 * THE SEAM, column by column: the darkest row between the lips, refined to a fraction of a pixel
 * by the parabola through it and its neighbours. Its CONTRAST against the lips a few rows above
 * and below says where the lips are actually pressed together — it fades out at the corners,
 * which is how the corners are found. The search box is the lip box asset.mjs prints, in this
 * portrait's own pixels, widened a little: move it with the portrait if the crop ever changes.
 */
const BOX = { x0: 146, x1: 220, y0: 163, y1: 191 };
const seam = [];
for (let x = BOX.x0; x <= BOX.x1; x += 1) {
  const col = [];
  for (let y = BOX.y0; y <= BOX.y1; y += 1) col.push(lumAt(x, y));
  const sm = col.map((v, i) => (col[Math.max(0, i - 1)] + 2 * v + col[Math.min(col.length - 1, i + 1)]) / 4);
  let k = 1;
  for (let i = 1; i < sm.length - 1; i += 1) if (sm[i] < sm[k]) k = i;
  const a = sm[k - 1];
  const b = sm[k];
  const c = sm[Math.min(sm.length - 1, k + 1)];
  const den = a - 2 * b + c;
  const off = den > 0 ? (0.5 * (a - c)) / den : 0;
  const around = (sm[Math.max(0, k - 4)] + sm[Math.min(sm.length - 1, k + 4)]) / 2;
  seam.push({ x: x + 0.5, y: BOX.y0 + k + off + 0.5, contrast: around - b });
}
const best = Math.max(...seam.map((s) => s.contrast));
const centre = seam.reduce((m, s, i) => (s.contrast > seam[m].contrast ? i : m), 0);
let left = centre;
let right = centre;
while (left > 0 && seam[left - 1].contrast > best * 0.22) left -= 1;
while (right < seam.length - 1 && seam[right + 1].contrast > best * 0.22) right += 1;
const lips = seam.slice(left, right + 1);
/* the seam's line: least squares, weighted by how clearly each column shows it */
let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
for (const s of lips) {
  const w = s.contrast;
  sw += w; sx += w * s.x; sy += w * s.y; sxx += w * s.x * s.x; sxy += w * s.x * s.y;
}
const slope = (sw * sxy - sx * sy) / (sw * sxx - sx * sx);
const xMid = (lips[0].x + lips[lips.length - 1].x) / 2;
const yMid = sy / sw + slope * (xMid - sx / sw);
const theta = Math.atan(slope);
const half = ((lips[lips.length - 1].x - lips[0].x) / 2) / Math.cos(theta);
export const MOUTH = { x: xMid, y: yMid, angle: theta, half };
console.log(
  `gura: centru ${xMid.toFixed(2)}, ${yMid.toFixed(2)} | unghi ${(theta * 180 / Math.PI).toFixed(2)}° | ` +
  `colturi la ±${half.toFixed(2)} px | linia buzelor din ${lips.length} coloane`,
);

/** Image point → mouth frame: u along the lips (to her left, image right), v across them (down). */
const cosT = Math.cos(theta);
const sinT = Math.sin(theta);
const toUV = (x, y) => [(x - xMid) * cosT + (y - yMid) * sinT, -(x - xMid) * sinT + (y - yMid) * cosT];
const toXY = (u, v) => [xMid + u * cosT - v * sinT, yMid + u * sinT + v * cosT];

/* ---- the face's own tones, for the inside of the mouth ---------------------------------------- */

function meanColour(points) {
  const acc = [0, 0, 0];
  const out = [0, 0, 0, 0];
  for (const [u, v] of points) {
    const [x, y] = toXY(u, v);
    sample(x, y, out);
    acc[0] += out[0]; acc[1] += out[1]; acc[2] += out[2];
  }
  return acc.map((c) => c / points.length);
}
const range = (a, b, step = 1) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
/** the seam's own darkest tone, along its middle third */
const SEAM_TONE = meanColour(range(-half / 3, half / 3, 1).map((u) => [u, 0]));
/** the lower lip's body */
const LIP_TONE = meanColour(range(-half / 2, half / 2, 2).flatMap((u) => [[u, 4], [u, 6]]));
/** the lit skin of the chin */
const SKIN_TONE = meanColour(range(-10, 10, 2).flatMap((u) => [[u, 22], [u, 26]]));
console.log(`tonuri: linia ${SEAM_TONE.map(Math.round)} | buza ${LIP_TONE.map(Math.round)} | barbia ${SKIN_TONE.map(Math.round)}`);

/**
 * LIGHTNESS, 0-255: a colour's luminance in linear light, encoded back as the grey of that
 * luminance — what tools/guide/lips/teeth.py measures the speakers' teeth and eye whites in. A grey
 * is its own value; her saturated teal comes out as light as it looks, where luma (the weights on
 * the encoded channels, `lumAt`, good enough to find the lip line) reads it darker than a grey as
 * light: her eye white is luma 135 and lightness 152.
 */
const toLinear = (v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toEncoded = (y) => 255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * Math.max(0, y) ** (1 / 2.4) - 0.055);
const lightness = (c) => toEncoded(0.2126 * toLinear(c[0]) + 0.7152 * toLinear(c[1]) + 0.0722 * toLinear(c[2]));
const SEAM_LIGHT = lightness(SEAM_TONE);
const LIP_LIGHT = lightness(LIP_TONE);
const SKIN_LIGHT = lightness(SKIN_TONE);

/* ---- the field ---------------------------------------------------------------------------------- */

/**
 * Vertical extents of the field around the seam, source px, read off the portrait down the
 * mouth's centre line: the upper lip's border at 7 above the seam, the base of the nose at 15 and
 * the nostrils at 20; the lower lip's border at 15–16 below it, the chin's contour at 42.
 */
const H_UP = 11;      // the upper lip and a little of the philtrum — stopping short of the nostrils
const H_ULIP = 7;     // the upper lip's own height
const H_LIP = 15;     // the lower lip's own height
const H_SPREAD = 17;  // how far below the seam the corners' sideways stretch reaches
const V_CHIN = 37;    // where the chin starts to give way to the neck
const H_NECK = 20;    // where the chin's drop dies out over the neck
const W_SIDE = 15;    // how far past the corners the cheeks still follow
const W_CHIN = 24;    // the half-width of the chin that drops as one piece
const W_CHIN_FADE = 17;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** 1 at 0, 0 at 1, with zero slope at both ends. */
const fall = (t) => (t <= 0 ? 1 : t >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * t)));

/**
 * One frame's field. `open` is the lower lip's drop at the centre; `shape` -1..1 rounds or spreads
 * the corners. Returns the edges of the parted lips and the displacement at any (u, v) — positive
 * v is down, positive u is towards image right.
 */
function field(open, shape) {
  const lift = ANATOMY.lift * open;
  const liftBorder = ANATOMY.liftBorder * open;
  const corner = ANATOMY.corner * open;
  const chin = ANATOMY.chin * open;
  const spread = (shape > 0 ? ANATOMY.spreadOut : ANATOMY.spread) * shape - ANATOMY.narrow * open;
  const w = half + spread;
  /* the opening's outline across the mouth, (1 - x²)^power: 0.5 is an ellipse, which is what
     rounded lips (o, u) part in; spread lips (e, i) part in a lens with sharp corners */
  const power = 0.65 + 0.2 * shape;
  const lens = (u) => (Math.abs(u) >= w ? 0 : Math.pow(1 - (u / w) ** 2, power));
  const side = (u) => fall((Math.abs(u) - w) / W_SIDE);
  const jawAcross = (u) => fall((Math.abs(u) - W_CHIN) / W_CHIN_FADE);
  /* the edges of the two lips after the move: the upper lip's lower edge and the lower lip's upper edge */
  const upEdge = (u) => corner * (1 - lens(u)) * side(u) - lift * Math.pow(lens(u), 1.3);
  const lowEdge = (u) => corner * (1 - lens(u)) * side(u) + open * lens(u);
  /* sideways: the lips stretch between corners that move by `spread` */
  const du = (u, v) => {
    const a = Math.abs(u);
    const across = a <= half ? u / half : Math.sign(u) * fall((a - half) / W_SIDE);
    const along = v < 0 ? fall(-v / H_UP) : fall(v / H_SPREAD);
    return spread * across * along;
  };
  /* the upper lip lifts nearly whole, its edge a little more than its border, and the philtrum
     above takes up the border's lift before the nose; the corners' drop fades over all of it */
  const dvUp = (u, v) => {
    const t = -v;
    const rise = t <= H_ULIP
      ? lift + (liftBorder - lift) * smooth(t / H_ULIP)
      : liftBorder * fall((t - H_ULIP) / (H_UP - H_ULIP));
    return corner * (1 - lens(u)) * side(u) * fall(t / H_UP) - rise * Math.pow(lens(u), 1.3);
  };
  /* the lower lip rides down with the jaw nearly whole, then the skin below it eases into the
     chin's drop, and the chin's into the neck */
  const dvLow = (u, v) => {
    const edge = lowEdge(u);
    const border = edge * ANATOMY.lipBorder;
    const jaw = chin * jawAcross(u);
    if (v <= H_LIP) return edge + (border - edge) * smooth(v / H_LIP);
    if (v <= V_CHIN) return border + (jaw - border) * smooth((v - H_LIP) / (V_CHIN - H_LIP));
    return jaw * fall((v - V_CHIN) / H_NECK);
  };
  return { upEdge, lowEdge, du, dvUp, dvLow, w };
}

/* ---- one frame ---------------------------------------------------------------------------------- */

const mix = (a, b, t) => a + (b - a) * t;

/*
 * THE INSIDE OF HER MOUTH, laid out as a mouth is — not a dark hole between the lips ("dintii nu
 * sunt, parca-i o gaura neagra", the owner, 2026-10-08).
 *
 * The upper teeth hang from the upper jaw, so they do not move down with the lower lip. Their edge
 * stays TEETH_EDGE below the line where her lips meet (a young woman shows about 3 mm of her upper
 * incisors with her lips apart), a little higher towards the canines — the smile's arc — and they
 * span the middle TEETH_SPAN of the mouth, the corners staying dark. So a small opening shows
 * teeth and only teeth (lips just apart over them), and only a wider one shows the dark below their
 * edge, the tongue at its floor and the edge of the lower teeth just over the lower lip. Nothing is
 * black: the darkest tone is her lip line's colour at 0.62 of its lightness. The teeth take their
 * lightness from her lit skin's, shaded under the lip and parted where one tooth meets the next,
 * and their colour from her palette (`hers`).
 *
 * AND ONLY AS MUCH LIGHT AS THE OPENING LETS IN ("dintii parca sunt prea albi", the owner, on teeth
 * as light in a narrow opening as in a wide one). Teeth behind the lips are lit through the gap
 * between them: a narrow one leaves them in the lips' shadow, a wide one lets the light onto them.
 * Measured on talking-head video (tools/guide/lips/teeth.py, nine faces, light and dark skin), as
 * the lightness of the opening's brightest tenth against the speaker's own eye whites — a white
 * tissue, so neither the skin's tone nor the video's exposure enters — the teeth are 0.64 of the
 * eye white with the lips 2-4 mm apart, 0.80 at 4-6, 0.94 at 6-8 and 1.02 at 8-10. Her eye white's
 * lightness is 152 and her lit chin's, SKIN_LIGHT, 192. In full light her teeth would stand at
 * TEETH_LIGHT of SKIN_LIGHT; the opening at that point of the mouth lets in 1 - exp(-gap /
 * TEETH_REACH) of that light (`lit`): 63% at TEETH_REACH source px, 92% at the widest frame's 9.4.
 * They used to be 1.12-1.17 of her eye white at every opening from 3 mm, and grey.
 *
 * AND LIGHTER THAN THE LIPS AROUND THEM, as real teeth are ("cand se deschide gura, ea parca se
 * mareste", the owner, on teeth fitted to the eye whites alone). Seen at the bust's size, real teeth
 * are 1.01 of the lips around them at 4-6 mm, 1.20 at 6-8 and 1.33 at 8-10 (teeth.py, the same
 * faces). Her lips are lighter against her eye whites than real lips are (0.81 against 0.72), so
 * teeth fitted to her eye whites alone came out darker than her lips up to about 6 mm, and short of
 * the real step from lip to tooth beyond: the opening read as the dark of the mouth spreading, a
 * mouth growing, not as lips parting over teeth. Two measured references that disagree for her
 * portrait: TEETH_LIGHT and TEETH_REACH are fitted, at the bust's size, to the geometric mean of what
 * each asks for, 4 to 10 mm (rms 3.3%; 5% under it at 9-10 mm).
 */
const TEETH_EDGE = 2.8;     // source px below the lip line, at the centre
const TEETH_SPAN = 0.62;    // of the mouth's half-width: the incisors to the canines
const TOOTH_GAPS = [0, 8.4, 14.6];  // where the incisors meet, source px from the centre (both sides)
export const TEETH_LIGHT = Number(process.env.TEETH_LIGHT ?? 1.1);
export const TEETH_REACH = Number(process.env.TEETH_REACH ?? 3.8);
const lit = (gap) => TEETH_LIGHT * (1 - Math.exp(-Math.max(0, gap) / TEETH_REACH));

function inside(u, v, top, bottom, w, out) {
  const gap = bottom - top;
  const across = Math.abs(u) / w;
  const edge = TEETH_EDGE - 1.4 * Math.min(1, (across / TEETH_SPAN) ** 2);
  const span = fall((across - TEETH_SPAN) / 0.28);
  /* a hairline opening is still her lip line: the teeth come in as the lips part */
  const parted = smooth((gap - 0.6) / 1.6);
  /* the dark of the mouth, below the teeth: her lip line's colour at 0.62-0.8 of its lightness, lighter
     towards the floor */
  const room = bottom - edge;
  const depth = smooth((v - edge) / Math.max(1, room));
  hers(SEAM_LIGHT * mix(0.62, 0.8, depth), out);
  /* the tongue, the floor of a wider opening */
  const tongue = smooth((room - 3) / 3) * smooth((v - edge - room * 0.5) / Math.max(0.8, room * 0.3)) *
    fall((across - 0.6) / 0.35);
  if (tongue > 0) blend(out, hers(LIP_LIGHT * 0.72, TONE), tongue * 0.85);
  /* the lower teeth: their edge just over the lower lip, in its shadow */
  const lower = smooth((room - 2.5) / 2) * span * smooth((v - (bottom - 1.2)) / 0.6);
  if (lower > 0) blend(out, hers(SKIN_LIGHT * 0.69 * lit(gap), TONE), lower * 0.9);
  /* the upper teeth, from the upper lip down to their edge: shaded under the lip, parted between */
  const upper = parted * span * (1 - smooth((v - edge + 0.4) / 0.8));
  if (upper > 0) {
    /* lit from the front, through the opening: shaded under the lip, turning away (darker) towards
       the corners, a touch darker again at their very edge, and parted where one tooth meets the next */
    const light = mix(0.76, 1, smooth((v - top) / 1.6)) * lit(gap);
    const side = mix(1, 0.78, Math.min(1, (across / TEETH_SPAN) ** 2));
    const rim = 1 - 0.1 * smooth((v - edge + 0.9) / 0.6);
    const parting = Math.max(...TOOTH_GAPS.map((g) => fall(Math.abs(Math.abs(u) - g) / 0.7)));
    const tone = light * side * rim * (1 - 0.16 * parting);
    blend(out, hers(SKIN_LIGHT * tone, TONE), upper);
  }
  out[3] = 255;
  return out;
}

function shade(u, v, f, out) {
  const top = f.upEdge(u);
  const bottom = f.lowEdge(u);
  if (bottom - top > 1e-3 && v > top && v < bottom) return inside(u, v, top, bottom, f.w, out);
  let us = u;
  let vs;
  if (v >= bottom) {
    vs = Math.max(0, v - bottom);
    for (let k = 0; k < 20; k += 1) {
      vs = Math.max(0, v - f.dvLow(us, vs));
      us = u - f.du(us, vs);
    }
  } else {
    vs = Math.min(0, v - top);
    for (let k = 0; k < 20; k += 1) {
      vs = Math.min(0, v - f.dvUp(us, vs));
      us = u - f.du(us, vs);
    }
  }
  const [x, y] = toXY(us, vs);
  return sample(x, y, out);
}

/** The patch every frame covers: wherever the largest frame moves anything, plus a margin. */
const PATCH = (() => {
  /* the corners travel furthest out shut and spread, furthest in wide open and rounded */
  const extremes = [OPEN_MAX, 0].flatMap((o) => SHAPES.map((s) => field(o, s)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let u = -(half + W_SIDE + 8); u <= half + W_SIDE + 8; u += 0.5) {
    for (let v = -(H_UP + 2); v <= V_CHIN + H_NECK + 2; v += 0.5) {
      const moved = extremes.some((k) => Math.abs(v < 0 ? k.dvUp(u, v) : k.dvLow(u, v)) > 0.004 || Math.abs(k.du(u, v)) > 0.004);
      if (!moved) continue;
      const [x, y] = toXY(u, v);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  const m = 3;
  return { x: Math.floor(x0) - m, y: Math.floor(y0) - m, w: Math.ceil(x1) - Math.floor(x0) + 2 * m, h: Math.ceil(y1) - Math.floor(y0) + 2 * m };
})();
console.log(`petecul: x ${PATCH.x}, y ${PATCH.y}, ${PATCH.w} x ${PATCH.h} px`);

/*
 * HER OWN COLOUR AT EVERY LIGHTNESS, for the inside of her mouth. The portrait is a photograph
 * turned into a projection — desaturated, lifted and tinted (asset.mjs) — and the tint gives every
 * lightness one colour: a deep, saturated teal in the shadows, a paler one in the light. A white
 * tooth in the original photograph would have come out at its own lightness in that colour. So the
 * inside's tones set lightness only, and `hers` paints each in her colour for it: the median colour
 * of the patch's own pixels at that lightness, between the two nearest, scaled in linear light to
 * land on it exactly. Her lit skin's colour scaled down instead — as the teeth were first drawn —
 * comes out grey against the teal around it (a CIE76 difference of 6-12 at the same lightness).
 */
const PALETTE = (() => {
  const STEP = 4;
  const bins = Array.from({ length: Math.ceil(256 / STEP) }, () => [[], [], []]);
  const px = [0, 0, 0];
  for (let y = PATCH.y; y < PATCH.y + PATCH.h; y += 1) {
    for (let x = PATCH.x; x < PATCH.x + PATCH.w; x += 1) {
      const o = (y * W + x) * 4;
      if (src[o + 3] < 255) continue;
      for (let c = 0; c < 3; c += 1) px[c] = src[o + c];
      const bin = bins[Math.min(bins.length - 1, Math.floor(lightness(px) / STEP))];
      for (let c = 0; c < 3; c += 1) bin[c].push(px[c]);
    }
  }
  const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
  return bins.filter((bin) => bin[0].length >= 6).map((bin) => bin.map(median))
    .map((rgb) => ({ light: lightness(rgb), rgb })).sort((a, b) => a.light - b.light);
})();
const TONE = [0, 0, 0, 255];
function hers(target, out) {
  let i = 1;
  while (i < PALETTE.length - 1 && PALETTE[i].light < target) i += 1;
  const lo = PALETTE[i - 1];
  const hi = PALETTE[i];
  const t = Math.min(1, Math.max(0, (target - lo.light) / Math.max(1e-6, hi.light - lo.light)));
  for (let c = 0; c < 3; c += 1) out[c] = mix(lo.rgb[c], hi.rgb[c], t);
  /* onto the target exactly: every channel scaled alike in linear light keeps the colour */
  const k = toLinear(Math.min(255, Math.max(0, target))) / Math.max(1e-9, toLinear(lightness(out)));
  for (let c = 0; c < 3; c += 1) out[c] = Math.min(255, toEncoded(toLinear(out[c]) * k));
  return out;
}
function blend(out, tone, weight) {
  for (let c = 0; c < 3; c += 1) out[c] = mix(out[c], tone[c], weight);
}

/**
 * One frame of the patch, RGBA 8-bit, the patch's own size.
 *
 * EVERY PIXEL IS WARPED THROUGH ITS CENTRE, and only the lips' inner edges are supersampled. A
 * supersampled pixel is an average of bilinear samples a quarter-pixel either side of its centre,
 * which is a blur — fine on the edge of a parting lip, which is moving anyway, but everywhere else
 * it would make the warped area softer than the copied area next to it, and a change of
 * sharpness is an edge of its own. Through its centre, a pixel the field does not move comes out
 * as the source pixel exactly; where the field is exactly zero it is copied, bit for bit.
 */
const SS = 4;
function frame(open, shape) {
  const f = field(open, shape);
  const buf = Buffer.alloc(PATCH.w * PATCH.h * 4);
  const s = [0, 0, 0, 0];
  const still = open === 0 && shape === 0;
  for (let py = 0; py < PATCH.h; py += 1) {
    for (let px = 0; px < PATCH.w; px += 1) {
      const x = PATCH.x + px;
      const y = PATCH.y + py;
      const o = (py * PATCH.w + px) * 4;
      const [uc, vc] = toUV(x + 0.5, y + 0.5);
      const top = f.upEdge(uc);
      const bottom = f.lowEdge(uc);
      const zero = Math.abs(vc < 0 ? f.dvUp(uc, vc) : f.dvLow(uc, vc)) === 0 && f.du(uc, vc) === 0;
      if (still || (zero && (vc < top - 1.5 || vc > bottom + 1.5))) {
        const so = (y * W + x) * 4;
        buf[o] = src[so]; buf[o + 1] = src[so + 1]; buf[o + 2] = src[so + 2]; buf[o + 3] = src[so + 3];
        continue;
      }
      const nearGap = bottom - top > 1e-3 && vc > top - 1 && vc < bottom + 1;
      if (!nearGap) {
        shade(uc, vc, f, s);
        for (let c = 0; c < 4; c += 1) buf[o + c] = Math.max(0, Math.min(255, Math.round(s[c])));
        continue;
      }
      const acc = [0, 0, 0, 0];
      for (let j = 0; j < SS; j += 1) {
        for (let i = 0; i < SS; i += 1) {
          const [u, v] = toUV(x + (i + 0.5) / SS, y + (j + 0.5) / SS);
          shade(u, v, f, s);
          acc[0] += s[0]; acc[1] += s[1]; acc[2] += s[2]; acc[3] += s[3];
        }
      }
      for (let c = 0; c < 4; c += 1) buf[o + c] = Math.max(0, Math.min(255, Math.round(acc[c] / (SS * SS))));
    }
  }
  return buf;
}

/* ---- the frames ------------------------------------------------------------------------------- */

/**
 * EVERY FRAME IS A FILE OF THE PORTRAIT'S OWN SIZE, transparent except around her mouth, and the
 * mouth sits on the very pixels it occupies in the portrait. That is what lets the page draw a
 * frame exactly where it draws the portrait.
 *
 * A CSS background that fills its box (no offset, 100% 100%) over the portrait's own rectangle
 * comes out pixel for pixel as the <img> does, at every size measured. Frames cut out of one sprite
 * and placed by background offsets did not. The browser draws an offset background another way, and
 * those frames landed up to 1.5 device px off the portrait on a phone and resampled differently
 * everywhere (docs/04, "The mouth"). So: 33 small files rather than one.
 *
 * Every pixel the field moves, and MARGIN px around them, is opaque; beyond that each frame fades
 * to transparent over FEATHER px. The field is zero there, so the ramp only blends the portrait
 * with itself — it soaks up the one thing that is not identical, the encoder's rounding of the
 * copied pixels.
 */
const FEATHER = 3;
const opens = Array.from({ length: OPEN_STEPS }, (_, i) => (OPEN_MAX * i) / (OPEN_STEPS - 1));
/*
 * THE FRAMES' OUTLINE FOLLOWS THE MOVEMENT, NOT THE BOX. Every frame is opaque wherever any frame
 * moves anything (plus a two-pixel margin) and fades to transparent over FEATHER px beyond that —
 * so where a frame meets the portrait, both show the same untouched skin.
 */
const moved = new Float32Array(PATCH.w * PATCH.h);
{
  const fields = [OPEN_MAX, 0].flatMap((o) => SHAPES.map((s) => field(o, s)));
  for (let y = 0; y < PATCH.h; y += 1) {
    for (let x = 0; x < PATCH.w; x += 1) {
      const [u, v] = toUV(PATCH.x + x + 0.5, PATCH.y + y + 0.5);
      let m = 0;
      for (const f of fields) {
        const d = Math.abs(v < 0 ? f.dvUp(u, v) : f.dvLow(u, v)) + Math.abs(f.du(u, v));
        const gap = f.lowEdge(u) - f.upEdge(u) > 1e-3 && v > f.upEdge(u) - 1 && v < f.lowEdge(u) + 1 ? 1 : 0;
        m = Math.max(m, d, gap);
      }
      moved[y * PATCH.w + x] = m > 0.02 ? 1 : 0;
    }
  }
}
/* distance (px) from each pixel to the nearest moving one, then the ramp */
const MARGIN = 2;
const near = new Float32Array(PATCH.w * PATCH.h).fill(Infinity);
for (let y = 0; y < PATCH.h; y += 1) {
  for (let x = 0; x < PATCH.w; x += 1) {
    if (!moved[y * PATCH.w + x]) continue;
    const R = MARGIN + FEATHER + 1;
    for (let j = Math.max(0, y - R); j <= Math.min(PATCH.h - 1, y + R); j += 1) {
      for (let i = Math.max(0, x - R); i <= Math.min(PATCH.w - 1, x + R); i += 1) {
        const d = Math.hypot(i - x, j - y);
        if (d < near[j * PATCH.w + i]) near[j * PATCH.w + i] = d;
      }
    }
  }
}
const coverage = (x, y) => 1 - smooth((near[y * PATCH.w + x] - MARGIN) / FEATHER);

/** One frame as a portrait-sized RGBA buffer: transparent, with the patch where it belongs. */
function fullFrame(open, shape) {
  const buf = frame(open, shape);
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < PATCH.h; y += 1) {
    for (let x = 0; x < PATCH.w; x += 1) {
      const edge = Math.min(x, y, PATCH.w - 1 - x, PATCH.h - 1 - y);
      const alpha = Math.min(smooth((edge + 0.5) / FEATHER), coverage(x, y));
      if (alpha <= 0) continue;
      const so = (y * PATCH.w + x) * 4;
      const o = ((PATCH.y + y) * W + PATCH.x + x) * 4;
      out[o] = buf[so]; out[o + 1] = buf[so + 1]; out[o + 2] = buf[so + 2];
      out[o + 3] = Math.round(buf[so + 3] * alpha);
    }
  }
  return out;
}

const encoding = process.env.LOSSLESS
  ? { lossless: true, effort: 6, exact: true }
  : process.env.NEAR
    ? { nearLossless: true, quality: Number(process.env.NEAR), effort: 6 }
    : { quality: Number(process.env.QUALITY ?? 90), alphaQuality: 100, effort: 6, smartSubsample: true };
mkdirSync(OUT, { recursive: true });
/* a different grid must not leave the old one's frames behind */
for (const name of readdirSync(OUT)) if (/^\d+-\d+\.webp$/.test(name)) rmSync(`${OUT}/${name}`);
const frames = [];
let bytes = 0;
for (let r = 0; r < SHAPES.length; r += 1) {
  for (let c = 0; c < OPEN_STEPS; c += 1) {
    const raw = fullFrame(opens[c], SHAPES[r]);
    const file = `${OUT}/${c}-${r}.webp`;
    const info = await sharp(raw, { raw: { width: W, height: H, channels: 4 } }).webp(encoding).toFile(file);
    bytes += info.size;
    frames.push({ c, r, raw });
  }
}
console.log(`cadrele: ${OUT}/{0..${OPEN_STEPS - 1}}-{0..${SHAPES.length - 1}}.webp, ${frames.length} fisiere, ${bytes} octeti, ${W} x ${H} fiecare (${OPEN_STEPS} deschideri 0..${OPEN_MAX} px x ${SHAPES.length} forme)`);

/*
 * HOW BRIGHT HER TEETH COME OUT, measured as tools/guide/lips/teeth.py measures a speaker's, on each
 * neutral frame as encoded and laid over the portrait, in lightness: the pixels between the inner
 * lips, a pixel in from them — their brightest tenth (the teeth) and their mean (the opening) — and
 * the same over the whole opening blurred by teeth.py's SEEN_MM (as it shows at the bust's size),
 * each against her eye white, beside the speakers' at the same opening (lips/measured-teeth.json,
 * the median over faces). The opening is teeth.py's too: cv2.fillPoly also draws the polygon's
 * outline, so its mask reaches about half a pixel past the lips' inner edge.
 */
const STUDY = 'tools/guide/lips/measured-teeth.json';
let study = null;
let unreadable = null;
if (existsSync(STUDY)) {
  try {
    study = JSON.parse(readFileSync(STUDY, 'utf8'));
  } catch (err) {
    unreadable = err.message;
  }
}
const KEYS = ['teeth', 'opening', 'teeth_seen', 'opening_seen'];
const binOk = (b) => Array.isArray(b?.mm) && b.mm.length === 2 && b.mm.every(Number.isFinite) && KEYS.every((k) => Number.isFinite(b[k]));
const why = unreadable ? `${STUDY} nu se poate citi (${unreadable})`
  : !study ? `lipseste ${STUDY}`
    : !(study.her?.eye_white > 0) || !(study.seen_mm > 0) ? 'ii lipseste albul ochilor ei sau estomparea (seen_mm)'
      : !Array.isArray(study.pooled) || !study.pooled.length || !study.pooled.every(binOk) ? 'mediile pe fete (pooled) lipsesc sau sunt incomplete'
        : null;
if (why) {
  console.log(`dintii: nu ii compar cu fetele filmate, pentru ca ${why} (tools/guide/README.md, lips/teeth.py)`);
} else {
  const { her, pooled, seen_mm: seenMm } = study;
  const centres = pooled.map((b) => (b.mm[0] + b.mm[1]) / 2);
  /* the faces at an opening: between the bins' centres; within the first and last bin, that bin's */
  const faces = (key, mm) => {
    if (mm < pooled[0].mm[0] || mm > pooled[pooled.length - 1].mm[1]) return null;
    const ys = pooled.map((b) => b[key]);
    if (mm <= centres[0]) return ys[0];
    for (let i = 1; i < centres.length; i += 1) {
      if (mm <= centres[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (mm - centres[i - 1])) / (centres[i] - centres[i - 1]);
    }
    return ys[ys.length - 1];
  };
  const MM_PX = 63 / 58;  // her eyes are 58 source px apart, taken as 63 mm
  const p90 = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const k = 0.9 * (s.length - 1);
    return s[Math.floor(k)] + (s[Math.ceil(k)] - s[Math.floor(k)]) * (k - Math.floor(k));
  };
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  /* a separable gaussian over the patch, its edges clamped */
  const sigma = seenMm / MM_PX;
  const R = Math.ceil(4 * sigma);
  const kernel = Array.from({ length: 2 * R + 1 }, (_, i) => Math.exp(-(((i - R) / sigma) ** 2) / 2));
  const ksum = kernel.reduce((s, x) => s + x, 0);
  const blur = (img) => {
    const tmp = new Float32Array(img.length);
    const out = new Float32Array(img.length);
    const at = (a, x, y) => a[Math.min(PATCH.h - 1, Math.max(0, y)) * PATCH.w + Math.min(PATCH.w - 1, Math.max(0, x))];
    for (let y = 0; y < PATCH.h; y += 1) for (let x = 0; x < PATCH.w; x += 1) {
      let s = 0;
      for (let i = -R; i <= R; i += 1) s += kernel[i + R] * at(img, x + i, y);
      tmp[y * PATCH.w + x] = s / ksum;
    }
    for (let y = 0; y < PATCH.h; y += 1) for (let x = 0; x < PATCH.w; x += 1) {
      let s = 0;
      for (let i = -R; i <= R; i += 1) s += kernel[i + R] * at(tmp, x, y + i);
      out[y * PATCH.w + x] = s / ksum;
    }
    return out;
  };
  const lines = [];
  const px = [0, 0, 0];
  for (const { c, r } of frames) {
    if (SHAPES[r] !== 0 || opens[c] === 0) continue;
    const f = field(opens[c], SHAPES[r]);
    const { data } = await sharp(`${OUT}/${c}-${r}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const light = new Float32Array(PATCH.w * PATCH.h);
    const open = new Uint8Array(PATCH.w * PATCH.h);
    for (let y = 0; y < PATCH.h; y += 1) {
      for (let x = 0; x < PATCH.w; x += 1) {
        const o = ((PATCH.y + y) * W + PATCH.x + x) * 4;
        const a = data[o + 3] / 255;
        for (let k = 0; k < 3; k += 1) px[k] = a * data[o + k] + (1 - a) * src[o + k];
        light[y * PATCH.w + x] = lightness(px);
        const [u, v] = toUV(PATCH.x + x + 0.5, PATCH.y + y + 0.5);
        const top = f.upEdge(u);
        const bottom = f.lowEdge(u);
        /* the gap guard keeps the band off the closed lip line past the corners */
        open[y * PATCH.w + x] = bottom - top > 1e-3 && v > top - 0.5 && v < bottom + 0.5 ? 1 : 0;
      }
    }
    const inner = [];
    const whole = [];
    const seen = blur(light);
    for (let y = 1; y < PATCH.h - 1; y += 1) {
      for (let x = 1; x < PATCH.w - 1; x += 1) {
        if (!open[y * PATCH.w + x]) continue;
        whole.push(seen[y * PATCH.w + x]);
        let all = true;
        for (let j = -1; j <= 1 && all; j += 1) for (let i = -1; i <= 1 && all; i += 1) all = open[(y + j) * PATCH.w + x + i] === 1;
        if (all) inner.push(light[y * PATCH.w + x]);
      }
    }
    if (inner.length < 6) continue;
    const mm = (f.lowEdge(0) - f.upEdge(0)) * MM_PX;
    const e = her.eye_white;
    const pair = (mine, key) => {
      const theirs = faces(key, mm);
      return `${(mine / e).toFixed(2)} (${theirs === null ? ' -  ' : theirs.toFixed(2)})`;
    };
    /* the same teeth against her lips around them, where the study has them (teeth.py's lips) */
    const lips = her.lips_seen > 0 && pooled.every((b) => Number.isFinite(b.teeth_seen_over_lips))
      ? (() => {
        const theirs = faces('teeth_seen_over_lips', mm);
        return `   fata de buze: ${(p90(whole) / her.lips_seen).toFixed(2)} (${theirs === null ? ' -  ' : theirs.toFixed(2)})`;
      })()
      : '';
    lines.push(`  ${String(c).padStart(2)}: ${mm.toFixed(1).padStart(4)} mm   dintii ${pair(p90(inner), 'teeth')}  deschiderea ${pair(avg(inner), 'opening')}` +
      `   la marimea bustului: dintii ${pair(p90(whole), 'teeth_seen')}  deschiderea ${pair(avg(whole), 'opening_seen')}${lips}`);
  }
  console.log(`dintii, fata de albul ochilor ei (${her.eye_white}; in paranteza, fetele), cadrele neutre, in luminozitate:\n${lines.join('\n')}`);
}

/* For reference: where the moving part is, and the mouth the seam search found. */
const geometry = {
  portrait: { width: W, height: H },
  patch: PATCH,
  opens: OPEN_STEPS,
  openMax: OPEN_MAX,
  shapes: SHAPES,
  mouth: { x: +xMid.toFixed(2), y: +yMid.toFixed(2), angleDeg: +(theta * 180 / Math.PI).toFixed(2), half: +half.toFixed(2) },
};
console.log(JSON.stringify(geometry));

if (PREVIEW) {
  mkdirSync(PREVIEW, { recursive: true });
  /* every frame laid over the portrait, the mouth's patch cut out and enlarged 4x, one row per shape */
  const S = 4;
  const tiles = [];
  for (const { c, r, raw } of frames) {
    const over = await sharp(SRC).composite([{ input: raw, raw: { width: W, height: H, channels: 4 } }]).png().toBuffer();
    const tile = await sharp(over).extract({ left: PATCH.x, top: PATCH.y, width: PATCH.w, height: PATCH.h })
      .resize(PATCH.w * S, PATCH.h * S, { kernel: 'nearest' }).png().toBuffer();
    tiles.push({ input: tile, left: c * (PATCH.w * S + 4), top: r * (PATCH.h * S + 4) });
  }
  await sharp({ create: { width: OPEN_STEPS * (PATCH.w * S + 4), height: SHAPES.length * (PATCH.h * S + 4), channels: 4, background: '#0a0b10' } })
    .composite(tiles).png().toFile(`${PREVIEW}/frames-4x.png`);
  writeFileSync(`${PREVIEW}/geometry.json`, JSON.stringify(geometry, null, 1));
  console.log(`previzualizare: ${PREVIEW}/frames-4x.png`);
}
