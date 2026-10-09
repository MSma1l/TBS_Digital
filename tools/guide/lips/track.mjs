/**
 * Her mouth, measured the way analyze.py measured the videos.
 *
 * Every answer of the guide, in every language, through components/hud/guide/speech.ts with the
 * page's 7 s cap; sampled at 30 fps like the clips; the same peaks, troughs and closures (scipy's
 * find_peaks, ported). Printed next to the tracked faces' numbers from measured.json, so a change
 * to the speech track can be checked against real mouths instead of against taste.
 *
 * Also counts what the video cannot: how many /p b m/ in the answers actually shut the lips, and
 * for how long — the follow reaches a closure only because it aims past it (speech.ts, `shut`).
 *
 * esbuild lives in the deps image, not on anyone's machine:
 *   MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect:/app -v /app/node_modules -w /app \
 *     tbs-deps:latest node tools/guide/lips/track.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const work = mkdtempSync(join(tmpdir(), "tbs-track-"));
/* speech.ts keeps its keys to itself; the copy measured here exports them, and changes nothing else */
writeFileSync(join(work, "speech.ts"), readFileSync("components/hud/guide/speech.ts", "utf8") +
  "\nexport const keysForTools = (text: string, locale: SpeechLocale, seconds: number) => trimmed(text, locale, seconds).keys;" +
  "\nexport const fullForTools = keysOf;\n");
const bundle = (entry, out) => build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: join(work, out), alias: { "@": process.cwd() }, logLevel: "error" });
await bundle(join(work, "speech.ts"), "speech.mjs");
await bundle("components/hud/guide/copy.ts", "copy.mjs");
const S = await import(pathToFileURL(join(work, "speech.mjs")).href);
const { GUIDE_FAQ } = await import(pathToFileURL(join(work, "copy.mjs")).href);
const measured = JSON.parse(readFileSync("tools/guide/lips/measured.json", "utf8")).pooled;

/*
 * Her widest frame's parting, in mm of a real face: mouth.mjs's OPEN_MAX (the lower lip's drop, in
 * source px) plus the upper lip's lift (ANATOMY.lift), read from its defaults, at 63 mm — the
 * faces' assumed inter-pupil distance — for her 58 px between the eyes (the lids' centres).
 */
const generator = readFileSync("tools/guide/mouth.mjs", "utf8");
const knob = (re) => {
  const value = Number(generator.match(re)?.[1]);
  if (!Number.isFinite(value)) throw new Error(`mouth.mjs no longer matches ${re}`);
  return value;
};
const OPEN_MAX = knob(/OPEN_MAX \?\? (\d+(?:\.\d+)?)/);
const LIFT = knob(/LIFT \?\? (\d+(?:\.\d+)?)/);
/* how far her corners travel: in for a rounding, out for a spread, in again as the jaw drops */
const SPREAD_IN = knob(/SPREAD \?\? (\d+(?:\.\d+)?)/);
const SPREAD_OUT = knob(/SPREAD_OUT \?\? (\d+(?:\.\d+)?)/);
const NARROW = knob(/NARROW \?\? (\d+(?:\.\d+)?)/);
/* her mouth's half-width, corner to centre, source px (mouth.mjs prints it: "colturi la +-27.28 px") */
const HALF = 27.28;
const EYES_PX = 58;
const MM = (OPEN_MAX * (1 + LIFT) * 63) / EYES_PX;
const FPS = 30;
const SAY_S = 7;

/* ---- scipy.signal.find_peaks with `distance` and `prominence`, as analyze.py calls it ---- */
function localMaxima(a) {
  const peaks = [];
  for (let i = 1; i < a.length - 1; i += 1) {
    if (!(a[i - 1] < a[i])) continue;
    let ahead = i + 1;
    while (ahead < a.length - 1 && a[ahead] === a[i]) ahead += 1;
    if (a[ahead] < a[i]) {
      peaks.push((i + ahead - 1) >> 1);
      i = ahead;
    }
  }
  return peaks;
}
function findPeaks(a, prominence, distance) {
  let peaks = localMaxima(a);
  if (distance > 1) {
    const keep = peaks.map(() => true);
    const byHeight = peaks.map((_, i) => i).sort((x, y) => a[peaks[x]] - a[peaks[y]]);
    for (let o = byHeight.length - 1; o >= 0; o -= 1) {
      const j = byHeight[o];
      if (!keep[j]) continue;
      for (let k = j - 1; k >= 0 && peaks[j] - peaks[k] < distance; k -= 1) keep[k] = false;
      for (let k = j + 1; k < peaks.length && peaks[k] - peaks[j] < distance; k += 1) keep[k] = false;
    }
    peaks = peaks.filter((_, i) => keep[i]);
  }
  return peaks.filter((p) => {
    let l = p, left = a[p];
    while (l > 0 && a[l - 1] <= a[p]) left = Math.min(left, a[--l]);
    let r = p, right = a[p];
    while (r < a.length - 1 && a[r + 1] <= a[p]) right = Math.min(right, a[++r]);
    return a[p] - Math.max(left, right) >= prominence;
  });
}
const gradient = (a) => a.map((_, i) => (i === 0 ? a[1] - a[0] : i === a.length - 1 ? a[i] - a[i - 1] : (a[i + 1] - a[i - 1]) / 2) * FPS);
const pct = (x, q) => {
  if (x.length === 0) return NaN;
  const s = [...x].sort((m, n) => m - n);
  const r = (q / 100) * (s.length - 1);
  const lo = Math.floor(r);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (r - lo);
};

/* ---- every answer, measured ---- */
let seconds = 0, peaks = 0, lips = 0, shut = 0, syllables = 0, speaking = 0;
const A = [], amp = [], opening = [], closing = [], vOpen = [], vClose = [], closures = [], held = [], speedAt = [];
const widths = [];  // [aperture mm, width against her half-width] at every sample
for (const locale of ["ro", "ru", "en"]) {
  for (const faq of GUIDE_FAQ) {
    const text = faq.a[locale];
    const track = S.speechTrack(text, locale, SAY_S);
    const step = S.SAMPLE_HZ / FPS;
    const a = Array.from({ length: Math.floor((track.open.length - 1) / step) + 1 }, (_, i) => track.open[i * step] * MM);
    for (let i = 0; i < a.length; i += 1) {
      const sh = track.shape[i * step];
      const drop = Math.max(0, track.open[i * step]) * OPEN_MAX;
      widths.push([a[i], (HALF + (sh > 0 ? SPREAD_OUT : SPREAD_IN) * sh - NARROW * drop) / HALF]);
    }
    seconds += a.length / FPS;
    A.push(...a);
    const v = gradient(a);
    const pk = findPeaks(a, 1.2, Math.max(1, Math.floor(0.07 * FPS)));
    const tr = findPeaks(a.map((x) => -x), 0.8, Math.max(1, Math.floor(0.05 * FPS)));
    peaks += pk.length;
    for (const p of pk) {
      const b = tr.filter((t) => t < p).pop();
      const e = tr.find((t) => t > p);
      if (b === undefined || e === undefined) continue;
      opening.push((p - b) / FPS);
      closing.push((e - p) / FPS);
      amp.push(a[p] - Math.min(a[b], a[e]));
      vOpen.push(Math.max(...v.slice(b, p + 1)));
      vClose.push(-Math.min(...v.slice(p, e + 1)));
    }
    /* at the track's own rate: where in each opening (of 3 mm or more) its speed peaks */
    const mm = Array.from(track.open, (x) => x * MM);
    for (let i = 1; i < mm.length - 1; i += 1) {
      if (!(mm[i] <= mm[i - 1] && mm[i] < mm[i + 1])) continue;
      let j = i;
      while (j + 1 < mm.length && mm[j + 1] > mm[j]) j += 1;
      if (mm[j] - mm[i] < 3) continue;
      let best = i;
      for (let k = i; k < j; k += 1) if (mm[k + 1] - mm[k] > mm[best + 1] - mm[best]) best = k;
      speedAt.push((best + 0.5 - i) / (j - i));
    }
    /* the whole answer, untrimmed: its syllables over the time she spends saying them */
    const full = S.fullForTools(text, locale);
    syllables += full.syllables;
    speaking += full.end - S.SPEECH.lead - S.SPEECH.tail -
      full.cuts.reduce((sum, c) => sum + (c.strength === 1 ? S.SPEECH.pauseComma : c.strength === 2 ? S.SPEECH.pauseStop : 0), 0);
    for (let i = 0, start = -1; i <= a.length; i += 1) {
      const below = i < a.length && a[i] < 2;
      if (below && start < 0) start = i;
      if (!below && start >= 0) {
        if ((i - start) / FPS < 0.25) closures.push((i - start) / FPS);
        start = -1;
      }
    }
    /* the /p b m/: did the lips meet (under 0.5 mm) within 250 ms of the closure's key? */
    for (const key of S.keysForTools(text, locale, SAY_S)) {
      if (key.open !== S.SPEECH.shut) continue;
      lips += 1;
      const i0 = Math.round(key.t * S.SAMPLE_HZ);
      const i1 = Math.min(track.open.length, i0 + Math.round(0.25 * S.SAMPLE_HZ));
      let n = 0;
      for (let i = i0; i < i1; i += 1) if (track.open[i] * MM < 0.5) n += 1;
      if (n > 0) {
        shut += 1;
        held.push(n / S.SAMPLE_HZ);
      }
    }
  }
}

const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "-");
const ms = (x) => `${f(x * 1000, 0)} ms`;
const m = measured;
const rows = [
  ["lips apart, median / p75 / p95 (mm)", `${f(m.aperture_mm["50"])} / ${f(m.aperture_mm["75"])} / ${f(m.aperture_mm["95"])}`, `${f(pct(A, 50))} / ${f(pct(A, 75))} / ${f(pct(A, 95))}`],
  ["one syllable's opening, median (mm)", f(m.peak_amplitude_mm["50"]), f(pct(amp, 50))],
  ["openings a second", f(m.opening_peaks_per_s, 2), f(peaks / seconds, 2)],
  ["trough to peak / peak to trough, median", `${ms(m.opening_s["50"])} / ${ms(m.closing_s["50"])}`, `${ms(pct(opening, 50))} / ${ms(pct(closing, 50))}`],
  ["peak speed, opening / closing, median (mm/s)", `${f(m.peak_velocity_open_mm_s["50"], 0)} / ${f(m.peak_velocity_close_mm_s["50"], 0)}`, `${f(pct(vOpen, 50), 0)} / ${f(pct(vClose, 50), 0)}`],
  ["shut (under 2 mm)", `${f(m.closed_fraction["<2mm"] * 100, 0)}%`, `${f((100 * A.filter((x) => x < 2).length) / A.length, 0)}%`],
  ["short closures a second, median length", `${f(m.short_closures_per_s, 2)}, ${ms(m.short_closure_s["50"])}`, `${f(closures.length / seconds, 2)}, ${ms(pct(closures, 50))}`],
];
console.log(`${"".padEnd(46)}${"tracked faces".padEnd(24)}her track (${GUIDE_FAQ.length} answers x 3 languages, ${f(seconds, 0)} s)`);
for (const [name, real, hers] of rows) console.log(`${name.padEnd(46)}${real.padEnd(24)}${hers}`);
console.log(`/p b m/ that shut the lips: ${shut} of ${lips}, held ${ms(pct(held, 50))} at the median`);
console.log(`syllables a second while speaking (whole answers, pauses out): ${f(syllables / speaking, 2)}`);
console.log(`where an opening's speed peaks, median (0.5: as long speeding up as slowing down): ${f(pct(speedAt, 50), 2)}`);
/* the mouth's width as it opens, against its width with the lips together (under 1 mm) */
const rest = pct(widths.filter(([mm]) => mm < 1).map(([, w]) => w), 50);
const widthAt = (lo, hi) => pct(widths.filter(([mm]) => mm >= lo && mm < hi).map(([, w]) => w / rest), 50);
console.log(`width as the lips part (against lips together), faces / hers: ${Object.entries(m.width_by_aperture ?? {})
  .map(([bin, w]) => `${bin} mm ${f(w, 2)} / ${f(widthAt(...bin.split('-').map(Number)), 2)}`).join(', ')}`);
