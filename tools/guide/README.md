# The guide assistant's portrait

`public/guide/asistent-*.{webp,avif}` is not hand-edited. These two scripts rebuild it from the
original photograph, and they exist so the next person does not have to rediscover why it is done
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
