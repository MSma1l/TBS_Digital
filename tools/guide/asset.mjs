/**
 * The assistant's portrait, as the site will actually load it.
 *
 * The matte comes from cutout2.mjs — a flood fill inward from the frame's border, walled by BOTH
 * the luminance gradient and the distance from a fitted backdrop plane, because on the light
 * side of this photograph the cream blazer and the studio backdrop are the same colour and only
 * the boundary tells them apart.
 *
 * The crop is head-and-shoulders and it is decided by legibility, not by taste: the widget sits
 * at 96px tall on a desktop, and a blink is only readable if the head is some 50 of those. A
 * full-length figure would put the head at 20px and the whole point would be invisible.
 *
 * No hologram is baked in. The tint, the scanlines and the glow are CSS, so they stay tunable
 * against the HUD's own tokens and the file stays a plain cutout that could be used anywhere
 * else on the site.
 */
import sharp from 'sharp';

const CUT = '/app/work/asistent-decupat.png';
const OUT = '/app/out';

const { width: W, height: H } = await sharp(CUT).metadata();
console.log(`decupajul: ${W} x ${H}`);

/* head and shoulders, measured off the cutout: the hair starts at the very top, the chin is
   around 0.163 H and the shoulder line around 0.26 H. */
/*
 * HEAD TO CHEST, in a frame that is nearly square.
 *
 * It was head-and-shoulders in a 0.88 frame. The widget is a bigger SQUARE now, so the crop was
 * opened out to match: down past the collar and the lapels to the chest, and wider, so the
 * blazer's shoulders are not sliced off at the edge. The result is 0.849 — it drops into a square
 * box with room left under her for the projector beam.
 */
const crop = {
  left: Math.round(W * 0.07),
  top: 0,
  width: Math.round(W * 0.86),
  height: Math.round(H * 0.46),
};
console.log(`bustul: x ${crop.left}..${crop.left + crop.width}, y ${crop.top}..${crop.top + crop.height}` +
  ` (${crop.width} x ${crop.height}), raport ${(crop.width / crop.height).toFixed(4)}`);

/*
 * NO COLOUR, AND THAT IS THE POINT.
 *
 * A tinted photograph is still a photograph: under a cyan wash the blazer stayed cream and the
 * skin stayed skin, so it read as a picture of a person rather than a projection of one. A
 * hologram is ONE WAVELENGTH.
 *
 * So the file is carried onto the HUD's own --neon-cyan (#38e1ff) by `tint` ALONE. It works in
 * LAB and replaces the CHROMA while keeping the luminance, which is both the desaturation and
 * the hue in one pass — and greyscaling first would defeat it, because that leaves a
 * single-channel image with no chroma for tint to set.
 * The linear lift before it is not cosmetic: a studio photograph is exposed for paper, and a
 * projection is EMITTED light — without it she sits dim against the page's own black.
 *
 * It is baked here and not in CSS because two test files ban `filter:` in every HUD module: a
 * filter makes its element a containing block and flattens the `preserve-3d` the orbit rings are
 * drawn in.
 */
const bust = sharp(CUT)
  .extract(crop)
  .linear(1.08, -4)
  .tint({ r: 0x38, g: 0xe1, b: 0xff });

/*
 * SHE FADES INTO THE BEAM, and the ramp is baked into the ALPHA rather than masked in CSS.
 *
 * Cropping to the chest put the white shirt and the pale blazer at the bottom of the frame, and
 * after the tint they came out brighter than her face — the eye went to the chest, not the eyes.
 * A projection does not have a hem anyway: it thins out where it leaves the emitter.
 *
 * Done here for the same reason the tone is: the CSS may not use a filter, and a `mask` on the
 * figure would group the element the breathing transform lives on. Baking it into the file also
 * means the rim and the scanline mask — which both point at this same bitmap — follow it for
 * free, with no second shape to keep in step.
 */
const FADE_FROM = 0.62;   /* where the ramp starts, as a fraction of the height */
const FADE_FLOOR = 0.0;   /* what is left of the alpha at the very bottom edge */

const bustRaw = await bust.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
{
  const { width: bw, height: bh, channels: bc } = bustRaw.info;
  if (bc !== 4) throw new Error(`astept 4 canale, am primit ${bc}`);
  for (let y = 0; y < bh; y += 1) {
    const t = (y / (bh - 1) - FADE_FROM) / (1 - FADE_FROM);
    if (t <= 0) continue;
    const k = FADE_FLOOR + (1 - FADE_FLOOR) * (1 - t) * (1 - t);
    for (let x = 0; x < bw; x += 1) {
      const i = (y * bw + x) * 4 + 3;
      bustRaw.data[i] = Math.round(bustRaw.data[i] * k);
    }
  }
  console.log(`talpa se stinge de la ${(100 * FADE_FROM).toFixed(0)}% in jos, patratic`);
}
const faded = () => sharp(bustRaw.data, { raw: { width: bustRaw.info.width, height: bustRaw.info.height, channels: 4 } });

/* where the eyes are, as fractions of the BUST, so the eyelids can be placed in CSS without
   any magic numbers in the component. Measured on a 2.332x magnification of the face:
   left pupil (336.6, 221.4) and right pupil (445.1, 205.1) in cutout pixels. */
const EYES = [
  { name: 'stang', x: 336.6, y: 221.4 },
  { name: 'drept', x: 445.1, y: 205.1 },
];
const EYE_W = 51.5, EYE_H = 30;
/*
 * THE MOUTH, measured the same way the eyes were: a 5.2x magnification of the lip region, with
 * the box then extracted on its own to check it lands on the lip line and nothing else. In
 * cutout pixels the lips occupy (354, 314) to (454, 346).
 *
 * `--mo` is where the lips PART — not the middle of the box. The dark line between them sits at
 * about 55% of the box's height, and an opening anchored anywhere else drops the jaw from the
 * wrong place.
 */
const MOUTH = { x: 354, y: 314, w: 99.6, h: 32, part: 0.55 };

const LID_PAD = 1.18;   /* the lid is a little larger than the opening, so it covers the corners */
const SAMPLE = 28.9;    /* px above the opening that the lid samples from: the crease */

console.log('');
console.log('ochii — liniile astea intra direct in .lid[data-eye] din CSS:');
for (const e of EYES) {
  const cx = (100 * (e.x - crop.left)) / crop.width;
  const cy = (100 * (e.y - crop.top)) / crop.height;
  const lw = (100 * EYE_W * LID_PAD) / crop.width;
  const lh = (100 * EYE_H * LID_PAD) / crop.height;
  console.log(
    `  ${e.name}:  --lx: ${(cx - lw / 2).toFixed(2)};  --ly: ${(cy - lh / 2).toFixed(2)};` +
    `  --ls: ${(cy - lh / 2 - (100 * SAMPLE) / crop.height).toFixed(2)};` +
    `   cutia ${lw.toFixed(2)}% x ${lh.toFixed(2)}%`,
  );
}

console.log('');
console.log('gura — liniile astea intra in .mouth / .jaw din CSS:');
{
  const mx = (100 * (MOUTH.x - crop.left)) / crop.width;
  const my = (100 * (MOUTH.y - crop.top)) / crop.height;
  const mw = (100 * MOUTH.w) / crop.width;
  const mh = (100 * MOUTH.h) / crop.height;
  console.log(`  --mx: ${mx.toFixed(2)};  --my: ${my.toFixed(2)};  --mw: ${mw.toFixed(2)};  --mh: ${mh.toFixed(2)};`);
  console.log(`  --mo: ${(my + mh * MOUTH.part).toFixed(2)};   (unde se despart buzele)`);
}

/*
 * ONE FILE, AND ONLY ONE.
 *
 * There were two widths and an AVIF for each. All of that is gone, and the reason is the same
 * reason the <picture> is gone from the component: every CSS window onto this portrait — the two
 * eyelids, the jaw, the rim's mask, the scanline mask — loads it by URL, at ONE url, while the
 * <img> would be free to pick a different candidate. Two encodings, or two scalings, of the same
 * bitmap differ by a value or two on smooth skin, and a patch that has to colour-match the pixels
 * underneath it draws a hard edge wherever they do.
 *
 * So: 384 wide, WebP, and nothing else. It covers a 2x screen at the widest the widget ever draws
 * her (184px), it is 31 KB, and it is the file every consumer names.
 */
await faded().resize({ width: 384 }).webp({ quality: 88, effort: 6 })
  .toFile(`${OUT}/asistent-384.webp`);

await faded().resize({ width: 520 }).flatten({ background: { r: 8, g: 10, b: 18 } })
  .png().toFile('/app/work/bust-previzualizare.png');

const fs = await import('node:fs/promises');
for (const f of await fs.readdir(OUT)) {
  const s = await fs.stat(`${OUT}/${f}`);
  console.log(`  ${f.padEnd(22)} ${(s.size / 1024).toFixed(1)} KB`);
}
