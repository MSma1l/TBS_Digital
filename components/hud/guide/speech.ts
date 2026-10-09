/**
 * What her mouth does while she "says" an answer — built from the answer's own text.
 *
 * There is no audio. What makes a silent mouth read as speech rather than as a mechanism is that
 * it follows what is being said: it opens wide on an /a/, barely on an /i/, rounds on an /o/ or a
 * /u/, shuts for a /p/, a /b/ or an /m/, rests at a comma and closes at a full stop — and it does
 * all of it at the rate a person talks, with every syllable a little different from the last. A
 * fixed loop, however carefully shaped, repeats; this cannot, because no two answers are the same
 * text (2026-10-08, replacing the 4.7s loop of 22 synthetic syllables).
 *
 * The NUMBERS are measured, not chosen (docs/04, "The mouth"), all but her size:
 *   - the syllable rate and the pause lengths from speech-rate studies of Romanian, Russian and
 *     English read speech;
 *   - how fast the mouth opens and closes, how often a second, and how often and how briefly the
 *     lips meet, from frame-by-frame lip tracking of public-domain talking-head video (MediaPipe
 *     Face Mesh; tools/guide/lips, whose track.mjs measures this file's tracks the same way);
 *   - how wide each vowel opens, relative to /a/, from articulatory studies of lip aperture.
 * How far her mouth opens is half what the tracked faces open, by choice: at their size the owner
 * found it too big on a bust this small (tools/guide/mouth.mjs, OPEN_MAX).
 *
 * Pure: text in, a sampled track out, no DOM. `GuideAssistant.tsx` plays it and paints the frames
 * the generator in tools/guide/mouth.mjs drew out of her own portrait.
 */

import type { Locale } from "@/lib/i18n/locales";

export type SpeechLocale = Locale;

/** The mouth at one moment: `open` 0 (shut) .. 1 (her widest frame), `shape` -1 rounded .. 1 spread. */
export type MouthPose = { open: number; shape: number };

/** A sampled track: `open[i]` and `shape[i]` at `i / SAMPLE_HZ` seconds; `duration` in seconds. */
export type SpeechTrack = { open: Float32Array; shape: Float32Array; duration: number };

export const SAMPLE_HZ = 120;

/**
 * The timing. `syllablesPerSecond` sets a syllable's base length; stress, the drawn-out syllable
 * before a pause and consonant clusters stretch it, so the answers run at about 4.5 syllables a
 * second while she speaks (read Romanian is nearer 6.5, Russian 6, English 5). What a viewer sees
 * is the openings, and those come 2.6 times a second, as the tracked faces' (2.8) do: the lips do
 * not part distinctly on every syllable.
 */
export const SPEECH = {
  syllablesPerSecond: 5.4,
  /** a bilabial closure (p, b, m): the lips stay shut this long */
  closure: 0.075,
  /** after a comma, semicolon or dash, and after a full stop (the mouth comes to rest in both) */
  pauseComma: 0.3,
  pauseStop: 0.55,
  /** the last syllable before a pause is drawn out (phrase-final lengthening) */
  finalLengthening: 1.32,
  /** the mouth starts moving a moment after the bubble appears, and settles shut at the end */
  lead: 0.12,
  tail: 0.3,
  /** a stressed syllable opens a little wider and lasts a little longer */
  stressOpen: 1.06,
  unstressOpen: 0.9,
  stressLength: 1.12,
  /** every syllable differs from its neighbours by up to this share of its opening */
  jitter: 0.14,
  /**
   * Where a closure aims: p, b and m well past shut, f and v just past it. Lips do not ease into
   * contact — they meet still moving and press (a virtual target beyond contact, Löfqvist & Gracco
   * 1997) — and a follow that aimed at exactly shut would mostly not get there in a 75 ms
   * closure: aimed at 0, 16 of the 59 /p b m/ in the answers shut the lips; aimed past it, all 59.
   * The track is clamped at shut, so the overshoot is the time the lips stay pressed, about 90 ms.
   */
  shut: -0.5,
  tuck: -0.1,
  /**
   * Every other target is set this much past the opening it stands for, as a speaker's are: the
   * follow never quite gets there (undershoot). 1.1 lets a stressed /a/ reach her widest frame.
   * Her frames open half as far as the tracked faces (docs/04): her timing is theirs, her sizes
   * half — a syllable's opening 5.8 mm at the median against their 9.8.
   */
  reach: 1.1,
} as const;

/**
 * The follow: every articulator chases its target through a cascade of equal first-order stages
 * (Birkholz's target approximation). Six stages give the speed of a real movement — a bell, its
 * peak a little before the middle (0.41 of an opening here) — where a single spring lurches off
 * and creeps in (0.29), the shape their fit rejected. `open` and `shape` are the stages' time
 * constants in seconds: the lower lip, which carries the opening, is the fastest articulator, the
 * mouth's corners the slowest (27.6 ms in Birkholz). 18 ms is a little quicker than the 20.5 ms he
 * fitted to one speaker's lower lip, and brings her rhythm to the tracked faces' (2.6 openings a
 * second, theirs 2.8). Measured like the videos, an opening takes 133 ms trough to peak and a
 * closing 100 ms (theirs: 133 and 133).
 */
export const FOLLOW = { stages: 6, open: 0.018, shape: 0.028 } as const;

/* ---- letters to targets ------------------------------------------------------------------------ */

type Sound =
  | { kind: "vowel"; open: number; shape: number }
  | { kind: "glide"; open: number; shape: number }
  | { kind: "bilabial" }
  | { kind: "labiodental" }
  | { kind: "rounded" }
  | { kind: "consonant" }
  | { kind: "silent" };

/** Vowel targets: opening relative to /a/, and the lip shape. */
const V = {
  a: { open: 1, shape: 0.2 },
  ă: { open: 0.76, shape: 0.05 },
  î: { open: 0.44, shape: 0.15 },
  e: { open: 0.74, shape: 0.6 },
  i: { open: 0.42, shape: 1 },
  o: { open: 0.78, shape: -0.75 },
  u: { open: 0.44, shape: -1 },
  y: { open: 0.46, shape: 0.35 },
} as const;

const vowel = (v: keyof typeof V): Sound => ({ kind: "vowel", ...V[v] });

/** The most a vowel opens and can still be a glide: i, u, î, y (English u is 0.5). */
const HIGH = 0.5;

/** Romanian: one letter, one sound, close enough for a mouth. */
const RO: Record<string, Sound> = {
  a: vowel("a"), ă: vowel("ă"), â: vowel("î"), î: vowel("î"), e: vowel("e"), i: vowel("i"), o: vowel("o"), u: vowel("u"),
  y: vowel("i"), w: vowel("u"),
  p: { kind: "bilabial" }, b: { kind: "bilabial" }, m: { kind: "bilabial" },
  f: { kind: "labiodental" }, v: { kind: "labiodental" },
  ș: { kind: "rounded" }, ş: { kind: "rounded" }, j: { kind: "rounded" },
};

/** Russian: the iotated vowels are a glide into their vowel; ь and ъ are not sounds. */
const RU: Record<string, Sound | Sound[]> = {
  а: vowel("a"), о: { kind: "vowel", open: 0.7, shape: -0.45 }, у: vowel("u"), ы: vowel("y"), э: vowel("e"), и: vowel("i"),
  е: [{ kind: "glide", ...V.i }, vowel("e")], я: [{ kind: "glide", ...V.i }, vowel("a")],
  ю: [{ kind: "glide", ...V.i }, vowel("u")], ё: [{ kind: "glide", ...V.i }, vowel("o")],
  й: { kind: "glide", ...V.i },
  п: { kind: "bilabial" }, б: { kind: "bilabial" }, м: { kind: "bilabial" },
  ф: { kind: "labiodental" }, в: { kind: "labiodental" },
  ш: { kind: "rounded" }, щ: { kind: "rounded" }, ж: { kind: "rounded" }, ч: { kind: "rounded" },
  ь: { kind: "silent" }, ъ: { kind: "silent" },
};

/** English: a crude grapheme guess. Good enough for a mouth; wrong for a dictionary. */
const EN: Record<string, Sound> = {
  a: { kind: "vowel", open: 0.85, shape: 0.25 }, e: vowel("e"), i: vowel("i"), o: vowel("o"), u: { kind: "vowel", open: 0.5, shape: -0.3 },
  y: vowel("i"), w: { kind: "rounded" }, r: { kind: "rounded" },
  p: { kind: "bilabial" }, b: { kind: "bilabial" }, m: { kind: "bilabial" },
  f: { kind: "labiodental" }, v: { kind: "labiodental" },
};

const TABLES: Record<SpeechLocale, Record<string, Sound | Sound[]>> = { ro: RO, ru: RU, en: EN };

/** Letters of a word → sounds, with each language's few rules that matter to a mouth. */
function soundsOf(word: string, locale: SpeechLocale): Sound[] {
  const table = TABLES[locale];
  const letters = [...word];
  const out: Sound[] = [];
  letters.forEach((ch, k) => {
    const next = letters[k + 1];
    const prev = letters[k - 1];
    if (locale === "en") {
      /* a silent final e (make, here) — unless it is the word's only vowel (the) — and the
         doubled vowels that are one sound */
      if (ch === "e" && k === letters.length - 1 && !/[aeiouy]/.test(prev ?? "") && /[aeiouy]/.test(letters.slice(0, k).join(""))) return;
      if ((ch === "o" && next === "o") || (ch === "e" && next === "e")) {
        out.push(vowel(ch === "o" ? "u" : "i"));
        letters[k + 1] = "";
        return;
      }
      if (ch === "t" && next === "h") return;
    }
    if (locale === "ro") {
      /* a final -i after a consonant is not a syllable (pomi, lucrați): it only spreads the lips —
         unless it is the word's only vowel (și, zi) */
      if (ch === "i" && k === letters.length - 1 && k > 0 && !/[aăâeiîouy]/.test(prev ?? "") && /[aăâeiîouy]/.test(letters.slice(0, k).join(""))) {
        out.push({ kind: "consonant" });
        return;
      }
      /* ce, ci, ge, gi: the e or i after c and g is a vowel, the consonant itself is rounded */
      if ((ch === "c" || ch === "g") && (next === "e" || next === "i")) {
        out.push({ kind: "rounded" });
        return;
      }
    }
    if (ch === "") return;
    const s = table[ch];
    if (Array.isArray(s)) out.push(...s);
    else if (s) out.push(s);
    else if (/\p{L}/u.test(ch)) out.push({ kind: "consonant" });
  });
  /* two vowels side by side in Romanian and English: of a high vowel (i, u, î, y) and a more open
     neighbour, the high one is a glide, not its own syllable — ia, ie, iu, ai, au, ei, oi, ui;
     you, they, out, boil. Russian writes its glides as letters (я, ю, е, ё, й), so two vowel
     letters there are two syllables (свои, интеграции). */
  if (locale !== "ru") {
    const before = out.slice();
    before.forEach((s, k) => {
      if (s.kind !== "vowel" || s.open > HIGH) return;
      if ([before[k - 1], before[k + 1]].some((n) => n?.kind === "vowel" && n.open > s.open)) {
        out[k] = { kind: "glide", open: s.open, shape: s.shape };
      }
    });
  }
  /* e and o before a: Romanian ea and oa are one syllable, the first vowel gliding into the a */
  if (locale === "ro") {
    for (let k = 0; k + 1 < out.length; k += 1) {
      const s = out[k];
      const n = out[k + 1];
      if (s.kind === "vowel" && n.kind === "vowel" && n.open === 1 && (s.shape === V.e.shape || s.shape === V.o.shape)) {
        out[k] = { kind: "glide", open: s.open, shape: s.shape };
      }
    }
  }
  return out;
}

/* ---- sounds to a timed list of targets ---------------------------------------------------------- */

type Key = { t: number; open: number; shape: number };

/** A small, stable number in [0, 1) for position `n` of a text: the same answer moves the same way. */
function noise(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
}

/**
 * The text as targets on a clock: for every syllable, its consonants on the way in, its vowel
 * (opening by its own amount, by stress and by a little noise), its consonants on the way out;
 * a rest at every comma and full stop; shut at the start and at the end.
 */
/** Where the text may stop if it has to: after a full stop (2), a comma (1), or any word (0). */
type Cut = { keys: number; t: number; strength: number };

function keysOf(text: string, locale: SpeechLocale): { keys: Key[]; end: number; cuts: Cut[]; syllables: number } {
  const seed = hash(text);
  const syllable = 1 / SPEECH.syllablesPerSecond;
  const keys: Key[] = [{ t: 0, open: 0, shape: 0 }];
  const cuts: Cut[] = [];
  let t: number = SPEECH.lead;
  let n = 0;
  let shape = 0;
  const tokens = text.toLocaleLowerCase(locale).match(/[\p{L}́]+|[,;:—–]|[.!?…]+/gu) ?? [];
  tokens.forEach((token, ti) => {
    if (/^[,;:—–]$/.test(token) || /^[.!?…]+$/.test(token)) {
      const comma = /^[,;:—–]$/.test(token);
      cuts.push({ keys: keys.length, t, strength: comma ? 1 : 2 });
      keys.push({ t, open: 0.03, shape: shape * 0.4 });
      t += comma ? SPEECH.pauseComma : SPEECH.pauseStop;
      return;
    }
    /* a Latin-script word in a Russian answer (e-commerce, email, UI) is read as English */
    const language: SpeechLocale = locale === "ru" && !/[Ѐ-ӿ]/.test(token) ? "en" : locale;
    const sounds = soundsOf(token.replace(/́/g, ""), language);
    const nuclei = sounds.reduce((c, s) => c + (s.kind === "vowel" ? 1 : 0), 0);
    /* default stress: Romanian and Russian on the penultimate, English on the first */
    const stressed = nuclei <= 1 ? 0 : language === "en" ? 0 : nuclei - 2;
    const beforePause = /^[,;:—–.!?…]/.test(tokens[ti + 1] ?? ".");
    let v = 0;
    let k = 0;
    while (k < sounds.length) {
      /* one syllable: consonants (and glides) up to the vowel, the vowel, then consonants before
         the next vowel go to the NEXT syllable's onset unless this is the word's last vowel */
      const onset: Sound[] = [];
      while (k < sounds.length && sounds[k].kind !== "vowel") onset.push(sounds[k++]);
      const nucleus = sounds[k++];
      const coda: Sound[] = [];
      if (v === nuclei - 1) while (k < sounds.length) coda.push(sounds[k++]);
      if (!nucleus || nucleus.kind !== "vowel") {
        /* a word with no vowel letter (a stray initial, "ș", "в"): its consonants only */
        for (const s of onset) t = consonant(keys, s, t, 0.4, shape, syllable);
        break;
      }
      const isStressed = v === stressed;
      const last = v === nuclei - 1 && beforePause;
      const length = syllable * (isStressed ? SPEECH.stressLength : 1) * (last ? SPEECH.finalLengthening : 1) *
        (0.88 + 0.08 * onset.length + 0.05 * coda.length) * (0.92 + 0.16 * noise(seed, n * 3 + 1));
      const reach = Math.min(1, nucleus.open * (isStressed ? SPEECH.stressOpen : SPEECH.unstressOpen) *
        (1 - SPEECH.jitter + 2 * SPEECH.jitter * noise(seed, n * 3 + 2)));
      const start = t;
      for (const s of onset) t = consonant(keys, s, t, nucleus.open, nucleus.shape, syllable);
      /* the vowel: aimed at just after the consonants, held to the syllable's end */
      const room = Math.max(syllable * 0.45, start + length - t);
      shape = nucleus.shape;
      keys.push({ t: t + room * 0.12, open: reach, shape });
      t += room;
      for (const s of coda) t = consonant(keys, s, t, nucleus.open, nucleus.shape, syllable);
      v += 1;
      n += 1;
    }
    /* words run together in speech: no gap between them, only the consonants */
    cuts.push({ keys: keys.length, t, strength: 0 });
  });
  keys.push({ t, open: 0, shape: 0 });
  return { keys, end: t + SPEECH.tail, cuts, syllables: n };
}

/**
 * The text cut to `seconds`, if it runs longer: at the last full stop or comma that still fits
 * when one falls in the final stretch, otherwise after the last whole word — never in the middle
 * of one. The mouth then closes the way it does at any full stop.
 */
function trimmed(text: string, locale: SpeechLocale, seconds: number): { keys: Key[]; end: number } {
  const all = keysOf(text, locale);
  if (all.end <= seconds) return all;
  const limit = seconds - SPEECH.tail;
  const fits = all.cuts.filter((c) => c.t <= limit && c.keys > 1);
  const late = fits.filter((c) => c.t >= limit - 2.5 && c.strength > 0);
  const cut = late.length > 0
    ? late.reduce((a, b) => (b.strength > a.strength || (b.strength === a.strength && b.t > a.t) ? b : a))
    : fits[fits.length - 1];
  if (!cut) return { keys: [{ t: 0, open: 0, shape: 0 }], end: Math.min(seconds, SPEECH.lead + SPEECH.tail) };
  const keys = all.keys.slice(0, cut.keys);
  keys.push({ t: cut.t, open: 0, shape: 0 });
  return { keys, end: cut.t + SPEECH.tail };
}

/** A consonant's target, pushed onto `keys`; returns the clock after it. */
function consonant(keys: Key[], s: Sound, t: number, nextOpen: number, nextShape: number, syllable: number): number {
  switch (s.kind) {
    case "bilabial":
      keys.push({ t, open: SPEECH.shut, shape: nextShape * 0.5 });
      return t + SPEECH.closure;
    case "labiodental":
      /* the lower lip tucked under the upper teeth, held at least as long as a closure */
      keys.push({ t, open: SPEECH.tuck, shape: 0.15 });
      return t + Math.max(SPEECH.closure, syllable * 0.32);
    case "rounded":
      keys.push({ t, open: 0.22, shape: -0.6 });
      return t + syllable * 0.3;
    case "glide":
      keys.push({ t, open: s.open * 0.8, shape: s.shape });
      return t + syllable * 0.22;
    case "silent":
      return t;
    default:
      /* the tongue does the work; the jaw half-closes towards the next vowel and keeps its shape */
      keys.push({ t, open: 0.3 * nextOpen, shape: nextShape * 0.7 });
      return t + syllable * 0.24;
  }
}

/* ---- the follow --------------------------------------------------------------------------------- */

/**
 * The text's track, sampled at SAMPLE_HZ: the targets held between their keys, and the mouth
 * chasing them through the follow's stages — so it never jumps, never holds a pose, and a quick
 * syllable is reached only part of the way (which is what coarticulation looks like). A closure
 * aims past shut and is clamped there. `maxSeconds` cuts a long text at a pause (`trimmed`).
 */
export function speechTrack(text: string, locale: SpeechLocale, maxSeconds = Infinity): SpeechTrack {
  const { keys, end } = trimmed(text, locale, maxSeconds);
  const count = Math.max(2, Math.ceil(end * SAMPLE_HZ) + 1);
  const open = new Float32Array(count);
  const shape = new Float32Array(count);
  const dt = 1 / SAMPLE_HZ;
  /* four sub-steps a sample: the stages see their input move within a sample, not in steps */
  const sub = 4;
  const kOpen = 1 - Math.exp(-dt / sub / FOLLOW.open);
  const kShape = 1 - Math.exp(-dt / sub / FOLLOW.shape);
  const x = new Float64Array(FOLLOW.stages);
  const s = new Float64Array(FOLLOW.stages);
  const last = FOLLOW.stages - 1;
  let k = 0;
  for (let i = 0; i < count; i += 1) {
    const time = i * dt;
    while (k + 1 < keys.length && keys[k + 1].t <= time) k += 1;
    const aim = keys[k].open;
    const target = time >= end - SPEECH.tail ? 0 : aim < 0 ? aim : Math.min(1, aim * SPEECH.reach);
    const targetShape = time >= end - SPEECH.tail ? 0 : keys[k].shape;
    for (let j = 0; j < sub; j += 1) {
      let u = target;
      let w = targetShape;
      for (let n = 0; n <= last; n += 1) {
        x[n] += (u - x[n]) * kOpen;
        u = x[n];
        s[n] += (w - s[n]) * kShape;
        w = s[n];
      }
    }
    open[i] = Math.min(1, Math.max(0, x[last]));
    shape[i] = Math.min(1, Math.max(-1, s[last]));
  }
  /* the very end is shut and neutral, whatever the spring had left */
  open[count - 1] = 0;
  shape[count - 1] = 0;
  return { open, shape, duration: (count - 1) / SAMPLE_HZ };
}

/** The pose at `seconds` into a track, linearly between its samples; shut outside it. */
export function poseAt(track: SpeechTrack, seconds: number, out: MouthPose = { open: 0, shape: 0 }): MouthPose {
  if (!(seconds > 0) || seconds >= track.duration) {
    out.open = 0;
    out.shape = 0;
    return out;
  }
  const f = seconds * SAMPLE_HZ;
  const i = Math.floor(f);
  const r = f - i;
  out.open = track.open[i] + (track.open[i + 1] - track.open[i]) * r;
  out.shape = track.shape[i] + (track.shape[i + 1] - track.shape[i]) * r;
  return out;
}
