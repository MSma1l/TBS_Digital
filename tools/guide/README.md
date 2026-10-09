# The guide assistant's portrait

`public/guide/asistent-*.{webp,avif}` is not hand-edited. `cutout.mjs` and `asset.mjs` rebuild it
from the original photograph, `mouth.mjs` draws her mouth's frames out of it, and `lips/` measures
how a real mouth moves. They exist so the next person does not have to rediscover why it is done
this way.

## Running them

Both need `sharp`, which lives in the build image and not on anyone's machine:

```sh
docker build --target deps -t tbs-deps .
docker run --rm -v "$PWD/.work:/app/work" -v tbs_nm:/app/node_modules -w /app node:22-alpine \
  node /app/work/cutout.mjs
docker run --rm -v "$PWD/.work:/app/work" -v "$PWD/public/guide:/app/out" \
  -v tbs_nm:/app/node_modules -w /app node:22-alpine node /app/work/asset.mjs
```

Put the source photograph at `.work/asistent-sursa.jpg` first. `.work/` is gitignored.

## Why the matte is cut on edges and not on colour

Two colour models were fitted to the studio backdrop and both failed. Against a plane the
backdrop's own residual reaches **48.7** while the cream blazer sits at **41** — on the light side
of the frame the subject and the backdrop are the same colour, so no threshold parts them. A
separable `f(x) + g(y)` model is worse still (mean 37 against 19).

The boundary is another matter. Measured across the left shoulder, the luminance gradient runs at
**0.6–1.4** through the backdrop and spikes to **70.8** at the blazer's edge — a fifty-fold margin.
So the matte is a flood fill inward from the frame's border that may only pass through pixels that
are both flat AND backdrop-coloured, with the wall map dilated by one pixel first.

Both cues are needed, and the first attempt proves it: walled on the gradient alone the flood
leaked through the **hair**, where fine strands leave single-pixel gaps, and once inside it ate the
face — smooth skin is exactly the flat region a gradient wall cannot hold. 87.4% of the frame came
back as backdrop.

## Two things that cost an afternoon

- `sharp`'s `blur()` on a **one-channel raw** buffer comes back with **three** channels. Indexing
  it as one compresses the matte threefold and shifts it down the frame — the head's silhouette
  lands on the shoulders and the face is cut away. `asset.mjs` inspects the buffer it gets.
- `joinChannel` with a raw buffer silently swallowed the rest of the pipeline: `extract` was
  ignored and no alpha appeared. The RGBA buffer is assembled by hand instead.

## Why the tone is baked in

Two test files ban `filter:` in every HUD CSS module — the guide draws orbit rings in 3D over a
live WebGL canvas, and a filter makes its element a containing block that flattens
`transform-style: preserve-3d`. So the desaturation and lift that turn a photograph into a
projection happen here (`saturation 0.58`, `brightness 1.07`, a `1.06` linear contrast) and the
stylesheet stays filter-free.

## The numbers the component needs

`asset.mjs` prints the eye coordinates as percentages of the bust. They go into
`GuideAssistant.module.css` as `--lx` / `--ly` / `--ls` on `.lid[data-eye]`, and they are the only
reason a still photograph can blink. Re-run it if the crop ever changes.

## Her mouth: `mouth.mjs`

`public/guide/gura/` holds her mouth, drawn out of `asistent-384.webp`:
- **Layout.** 11 openings by 3 lip shapes (rounded, neutral, spread), one file each:
  `<opening>-<shape>.webp`.
- **Each file is the portrait's own size**, transparent but for her mouth, which sits on the very
  pixels it has in the portrait. The page draws every frame over the portrait's own rectangle,
  filling it, and that is what lands it exactly where the portrait is. Frames cut out of one sprite
  and placed by offsets landed up to 1.5 device px off on a phone.
- **Each frame is the portrait warped.** The lower lip and the chin drop with the jaw, the upper
  lip lifts, and the corners move in or out. The movement falls to exactly zero before the edge of
  the patch, so the frame there is the portrait's own pixels.
- **Inside the lips, a mouth:**
  - the upper teeth, hanging from the upper jaw with their edge 3 mm below the lip line, which
    fill a small opening entirely;
  - below them, on a wider opening, the dark of the mouth (her lip line's colour, darker than
    it), the tongue, and the edge of the lower teeth;
  - the teeth lit only through the opening: in a narrow one they stand in the lips' shadow, and
    they brighten as the lips part, as real teeth do on video (`lips/teeth.py`, below);
  - every tone in her own colour: the inside sets only lightness, and each lightness takes the
    colour her portrait has at it (`hers`), so the teeth are her teal, not a darkened grey.
- **The widest frame** parts the lips 10 mm: half what real speakers open, because at their size
  the owner found her mouth too big on a bust this small.

Why it is done this way, and what it replaced, is in
[docs/04, "The mouth"](../../docs/04-design-system.md#asistent-tbs--the-corner-assistant).

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect:/app -v /app/node_modules -w /app tbs-deps:latest \
  node tools/guide/mouth.mjs
```

Re-run it whenever the portrait or the anatomy changes. It replaces the frames in
`public/guide/gura/`, and the stylesheet needs no numbers from it. Each run also prints how
bright her teeth come out in every neutral frame, against her eye white, beside the speakers' at
the same opening (`lips/measured-teeth.json`).

If you change the grid (`OPEN_STEPS`, `SHAPES`), `MOUTH_OPENINGS` and `MOUTH_SHAPES` in
`GuideAssistant.tsx` change with it. Keep `SHAPES` evenly spaced from rounded to spread, with
neutral in the middle at index 1. The rest frame is `0-1.webp` in three places: the face's wait
and paintMouth's rest in `GuideAssistant.tsx`, and the stylesheet's fallback.

The environment knobs, given to the `docker run` above with `-e NAME=value`:
- **The grid:** `OPEN_STEPS`, and `OPEN_MAX` (the lower lip's drop at the widest frame, in source
  px; her eyes are 58 px apart, so 1 px is 1.09 mm of a face measured the way `lips/` measures).
- **The anatomy:** `LIFT` and `LIFT_BORDER` (the upper lip's edge and border), `LIP_BORDER` (the
  lower lip's border), `CHIN` and `CORNER`.
- **The corners' sideways travel:** `SPREAD` (in, for a rounded vowel; 3.2 px), `SPREAD_OUT` (out,
  for a spread one, from a mouth already smiling; 1 px) and `NARROW` (a small pull-in as the jaw
  drops, per px of drop, so that no opening is wider than at rest; 0.1). `SPREAD_OUT` and `NARROW`
  are choices, not measurements. Together they keep her mouth from widening as it opens, as a real one does
  not up to 7 mm: `lips/track.mjs` prints her width beside the faces'.
- **The teeth's light:** `TEETH_LIGHT` (their lightness in full light, as a share of her lit
  skin's; 1.1) and `TEETH_REACH` (in source px: the opening at a point of the mouth lets in
  1 − e^(−gap/`TEETH_REACH`) of that light, 63% at `TEETH_REACH` and 92% at the widest frame, so
  no frame is in full light; 3.8).
- **The encoding:** `QUALITY`, `LOSSLESS` and `NEAR`.
- **`PREVIEW=<dir>`** also writes every frame laid over the portrait, enlarged 4×.

The anatomy defaults come from `lips/`, and the `ANATOMY` comment in mouth.mjs derives them. In
short, the lips ride on the jaw nearly whole. For every mm the lips part, the lower lip's border
drops almost as far as its inner edge, the upper lip lifts a little, and the chin follows at about
two thirds. The field is built that way because a lip that flattens as the mouth opens is the first
thing that looks wrong.

If you change `OPEN_MAX`, `LIFT`, `SPREAD`, `SPREAD_OUT` or `NARROW`, change their defaults in
mouth.mjs and re-run `lips/track.mjs` as well. It reads those defaults from mouth.mjs's source to
put her track in mm and to work out her width; it never sees a value given with `-e`.

## How a real mouth moves: `lips/`

The speech track (`components/hud/guide/speech.ts`) and the frames' anatomy are fitted to
measurements, not to taste:
- **The source:** four public-domain talking-head videos from Wikimedia Commons (White House
  weekly addresses, 480p), six faces, 352 s of speech.
- **The tracking:** frame by frame with MediaPipe Face Mesh.
- **The scale:** distances over the inter-pupil distance, taken as 63 mm.
- **The result** is `lips/measured.json`: the pooled numbers, each face's, and the clip list.

The study runs in its own image. The videos land in `.work/lips/clips/`, which is gitignored. Run
it from the repository root:

```sh
docker build -t tbs-lips tools/guide/lips
mkdir -p .work/lips
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/lips:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/fetch.py      # find and download the clips (paced: Commons rate-limits)
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/lips:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/frames.py     # optional: a contact sheet per clip, to check the framing
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/lips:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/analyze.py    # writes clips/summary.json and clips/pooled.json
```

To refresh `measured.json`, copy those two files and the clip list into it. Commons' search may
return other clips on another day; `measured.json` lists the four the numbers came from, with
their URLs. A clip is stored under a hash of its URL, and only once it has downloaded whole.

`analyze.py` keeps only the stretches where a face is talking to the camera:
- the same shot;
- the face frontal for itself;
- the lips moving, with a 1 s spread over 1.2 mm;
- at least 1 s long.

With two people in frame, each is measured on its own.

It reports:
- the inner-lip aperture's percentiles;
- the time shut;
- distinct openings a second;
- trough-to-peak and peak-to-trough times;
- peak speeds;
- short closures and pauses;
- how the lips' borders and the chin move per mm of opening. These slopes are fitted within each
  stretch of speech, because fitted across stretches raw they would mix one person's resting face
  with another's;
- the mouth's width at each opening against its width with the lips together (`width_by_aperture`):
  a real mouth parting its lips gets no wider up to 7 mm (0.94–0.99), and only a little beyond
  (1.03 at 7–11).

`track.mjs` measures her track the same way: every answer in every language, with the page's 7 s
cap, sampled at 30 fps, the same peak and closure detection. It prints:
- her numbers next to the faces';
- how many of the answers' *p*, *b* and *m* actually shut her lips;
- her syllable rate while she speaks;
- where in an opening her lips move fastest;
- her mouth's width as her lips part, beside the faces' `width_by_aperture`.

Run it after any change to `speech.ts`:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect:/app -v /app/node_modules -w /app tbs-deps:latest \
  node tools/guide/lips/track.mjs
```

## How bright real teeth are: `lips/teeth.py`

Her teeth's tone is fitted to talking faces as well (2026-10-08, after *"dintii parca sunt prea
albi"*, on teeth as bright as her lit chin in every frame):
- **The faces:** `fetch.py`'s four clips (President and Mrs Obama) and the three `fetch_teeth.py`
  takes by title, whose speakers have light skin, as she has: nine faces.
- **What it measures**, in the frames where a face speaks with its lips apart (`analyze.py`'s
  filter): the pixels between the inner lips, a pixel in from them — their brightest tenth (the
  teeth) and their mean (the opening) — and the same over the whole opening blurred by 1 mm, which
  is how it shows at the bust's size.
- **Against the speaker's own eye whites** (the brighter eye's brightest tenth, the eyes open): two
  white tissues in one face, so neither the skin's tone nor the video's exposure enters. Against
  the chin both do: with the lips 6–10 mm apart the Obamas' teeth come out 1.2–2.0 times as light
  as their chin, the light-skinned speakers' 0.75–0.8 (Clinton, Blinken) to 1.4–1.5 (Biden).
- **In lightness, not luma:** a pixel's luminance in linear light, written as the grey that
  luminous (0–255). For a grey, and nearly for a tooth or an eye white, the two agree; her
  saturated teal reads darker in luma than it looks (her eye white: luma 135, lightness 152).
- **And against the lips around them** (`teeth_seen_over_lips`, at the bust's size): the step
  from lip to tooth is what makes an opening read as lips parting over teeth, rather than as the
  dark of a mouth spreading.
- **The result** is `lips/measured-teeth.json`: per face and per 2 mm of opening, the medians
  (and the teeth against the chin, for comparison); their median over the faces; and her eye white
  and lips, read off the portrait at six scales. Re-run `teeth.py her` and the pooling if the
  portrait ever changes: her eye white and lips are the references her teeth are fitted to.

The clips land in `.work/`, which is gitignored:

```sh
mkdir -p .work/teeth
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/teeth:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/fetch_teeth.py   # the three light-skinned speakers' clips
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/teeth:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/teeth.py clips   # clips/teeth-rows-<n>.json, and crops of the masks
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/lips:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/teeth.py clips   # the same on fetch.py's clips
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work/lips:/work -v D:/proiect/tools/guide/lips:/tools:ro \
  tbs-lips python -I /tools/teeth.py eyes    # optional: the eye-white masks, to look at
```

Then her eye white, off the portrait as a PNG, and the pooling:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect:/app -v /app/node_modules -w /app tbs-deps:latest \
  node -e "require('sharp')('public/guide/asistent-384.webp').flatten({ background: '#404040' }).png().toFile('.work/teeth/portrait.png')"
MSYS_NO_PATHCONV=1 docker run --rm -v D:/proiect/.work:/work -v D:/proiect/tools/guide/lips:/tools:ro -w /work \
  tbs-lips sh -c "python -I /tools/teeth.py her teeth/portrait.png teeth/her.json && python -I /tools/teeth.py pool teeth/her.json teeth/measured-teeth.json teeth/clips lips/clips"
```

Copy `.work/teeth/measured-teeth.json` over `lips/measured-teeth.json`. `mouth.mjs` reads it on
every run and prints her teeth beside the faces' (or one line saying why it cannot). Her lips are
lighter against her eye whites than real lips are, so the two references disagree for her:
`TEETH_LIGHT` and `TEETH_REACH` are fitted, at the bust's size and from 4 to 10 mm, to the
geometric mean of what each asks for (rms 3.3%, at most 5% under it at 9–10 mm).
