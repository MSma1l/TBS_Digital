# 05 — Page Sections

The landing page is a single scroll, top to bottom. Sections carry a mono index label
(`/01`, `/02`, …). Below is each section, its purpose, and where its content comes from.

> Order in `app/(site)/page.tsx` today: Hero · Ticker · Directions · Work · Principles · Team ·
> RequestSection · BottomCTA. All visitor-facing copy is localized —
> see [16 — i18n & SEO](./16-i18n-seo.md). For what is still a stub, see
> [06 — Placeholder Rules](./06-placeholder-rules.md).
>
> The first screen — intro, header, hero, ticker, cookie banner — was redesigned as a HUD on
> 2026-09-16, and the interior on 2026-09-17: the 3D stage behind Hero → Ticker → Directions,
> the holographic stat cards, and Directions and Work rebuilt as HUD sections. Both are
> described below as built. Principles, Team, the request section and BottomCTA predate them
> and are due their own pass; `Services` and `Partners` below are not rendered by any page
> today.

## First-visit intro (preloader)

A full-screen HUD overlay that plays on **every hard load of the home page** (`/`, `/ru`,
`/en`): a six-beat cinematic shot from **inside a laptop** — the camera starts on the processor
die, the machine powers up, the camera crawls down the cavity past the guts, the lid opens above
it, and it surfaces **up through the keyboard**, where the processor lives. The display fills the
frame, and the page is behind it. Over it, the readout `SYSTEM_SYNCHRONIZATION: NN%`, then
`ACCESS_GRANTED`. Wiring (gate, loading tiers, ownership) is in
[03 — Architecture](./03-architecture.md#the-first-visit-intro); timings live in
`INTRO_TIMING` (`lib/intro.ts`).

> Replaced the glass ∞ (lemniscate) on 2026-09-20. The machine is the same product as the
> interior stage's laptop — same 2.4 × 1.62 deck, same 16:10 display, same 107° lid — so the
> object the visitor flies out of and the one they meet on the page read as one thing.

**The page is never hidden.** The `<h1>` and everything else are server-rendered and painted
at full opacity *under* the overlay; the overlay has no `role`, no `aria-hidden` on the page,
no focus trap, and a screen reader can browse the page at once.

### How long the film is, and why (2026-09-24)

The beats' wall-clock lengths are not written anywhere — they fall out of two numbers, and for a
long time those two numbers made the film unwatchable. `MIN_SYNC_MS` was 2400 and the progress was
capped by `1 - (1 - x) ** 2.2`, an ease-out steep enough to put **47% of the film into the first
quarter of the time**: beat 1 ran 281 ms, beat 2 — the whole power-up — ran **536 ms**, beat 3
601 ms. `MIN_SYNC_MS` is 4600 now and the exponent is 1.6 (37% in the first quarter), which puts
the four beats at roughly 725 / 1280 / 1250 / 1345 ms. It is not flattened further on purpose:
`FLIGHT_MAP`'s slopes climb across the table precisely to cancel this ease-out, so a linear curve
would make the last beat — the steepest slope — the fastest in the film instead of the most
graceful.

The ending was lengthened with them: `DIVE_END` 0.66 → 1, the "reveal" label 0.72 → 1.15, the
overlay fade 0.55 → 0.7s. At the old numbers the implosion, the burst, the dive into the display
and the hand-over to the page all happened inside three quarters of a second.

**And loading is no longer allowed to eat the film.** The cinematic clock counts from navigation
start, which is right — the visitor has been watching since the first paint. Unbounded it is also
a trap: measured on a software renderer, hydration finished at 2.07s, so the director opened with
the curve already at 64% and beat 2 ran for **144 ms**. `MAX_PRE_SPEND_MS` caps how much of the
film a slow arrival may consume; past it the clock's origin slides forward instead, and a second
clamp keeps that inside the shell's watchdog (9000 → 10000). The cap is **250 ms**, and that
number is load-bearing rather than cautious: the processor section ends at `--fb-p` 0.34, so at
the 1200 ms it started life with, the whole processor would be spent before the first frame.

### Four scenes inside the processor (2026-09-24)

The processor section — what the film opens on, and what the flat drawing draws on every device
— was **720 ms** and one move: the cores lit 106 ms in, with no established frame before them.
It is 1052 ms and four distinct things now, and the scrub was re-balanced to 0 → 0.34 (from
0 → 0.26) to hold them.

| scene | window | length | what it is |
| --- | --- | --- | --- |
| the slot | `--slot` [0.02, 0.16] | ~417 ms | the canyon walls, the socket kerb, the deck's lip and the capacitor studs come up together while the floor brightens and the recession darkens — the frame resolves from a chip on a shelf into a machined slot |
| the uncore | `--blk` [0.10, 0.22] | ~368 ms | the block field wipes in left to right: the logic wakes before the cores, which is also the right story |
| cores, traces, ring | [0.11, 0.32] | ~662 ms | re-spread over the room the other two make |
| the current leaves | `--heat` [0.26, 0.36] | ~331 ms | the capsule in the +x trough lights and the shot dissolves on it — the one object that survives the match cut AS ITSELF, because `<Cavity/>` is worn by both layers |

Measured by freezing `--fb-p` at each boundary and diffing the frames: every scene differs from
the one before it by **23–39% of the frame**. The slot brightens ABOVE today's constants rather
than starting below them, because `--fb-p` is held at 0 for the whole load — the frame a visitor
stares at while the page arrives must be the one that ships today, not a dimmer version of it.

**Three constants had to be re-solved together, and this is the part with no test.** The die's
`--z` divisor, the board's `--z` window and the board's scale constant are one system: the
stylesheet's own invariant is that the two drawings of the same chip stay within a few per cent
of each other across the dissolve (today's max is 3.44%). Moving the dissolve from 0.26 to 0.34
breaks it unless all three move. `2.96` was never chosen — it is `196/60 x the die's own scale on
the frame the dissolve opens` — so on a different frame it is a different number. Solved
numerically: die `/0.508`, board `[0.34, +0.425]`, constant **2.556** with a **1.936** span (the
same 0.62 end). Max drift **2.97%**, better than today, and the two are the same size to six
decimals on the frame the dissolve opens.

The power wave's `--a` table is derived from that same board curve — each piece lights as its
bounding box first fits the frame — so all eight values were re-derived: 0.374, 0.554, 0.590,
0.598, 0.606, 0.614, 0.622, 0.630. The last one is full at **0.710**, which is exactly where the
board begins to fade; that fit is what fixed the dissolve at 0.34 rather than later.

**The 3D camera keys were left alone, deliberately.** The canvas sits at `opacity: 0` until the
scene reports ready and the readiness weights cap the bar at 0.60 without it, so the processor
section is drawn by the SVG on every device. New keys in the canyon would have been work nobody
sees, on the one path where a key inside a box films the inside of a wall.

### The processor's three acts, and the dash bug underneath them (2026-09-24)

The four scenes above were four things happening; they were not a story. The current left a chip
that nothing had ever reached — `--w` opened at 0.14, before anything had arrived. The section is
now **cause and effect**, and at every boundary the frame's dominant motion changes register:

| act | window | the only motion in frame |
| --- | --- | --- |
| **the arrival** | `--arr` [0.02, 0.17] | inward. A short bright head runs each of the fourteen conductors from the package rim to the silicon, with the under-glow filling in behind it. The chip is dark and something is coming |
| **the ignition** | `--ign` [0.15, 0.25] | none. The silicon reddens in place, the gradient's hot end floods across, the uncore wipes, the four cores come up 0.022 apart, the ring closes. A static chip becoming a hot chip |
| **the departure** | `--w` [0.25, 0.40] | outward, and it opens on the exact frame the heat peaks. A near-white hairline grows out through the glow the arrival left standing |

**The windows are in scrub, and only the scrub is fixed.** The nominal ms — `5000·(1 - (1-p)^0.625)`
against `MIN_SYNC_MS` — would give 487 / 340 / 545, but that assumes the clock starts at zero, and
it does not: `origin` slides forward with takeover (see `MAX_PRE_SPEND_MS` above), which compresses
the early acts and leaves the late ones alone. Timed on three cold loads of the headless software
renderer, where takeover is a worst-case ~2.3 s: arrival **249–347 ms**, ignition **231–365 ms**,
departure **630–784 ms**, processor section **1.21–1.40 s** in total. Quote the windows, not the
milliseconds; the milliseconds are a property of the machine it runs on.

`--flare` is `--ign - --cool`, not a window: it has to come back **down**. It is 1 at 0.25 and
**0.028 at 0.34**, the frame the match dissolve opens — because the frozen `0.508 / 0.425 / 2.556`
trio holds the die and the board at the same size to six decimals there, and cross-fading a red
chip onto the board's cold blue one throws that away. A match cut survives a change of scale; it
does not survive a change of colour. `--heat` moved to [0.25, 0.34] for the same reason: it used
to still be filling two hundredths *into* the dissolve.

**The reveal was never a reveal.** Every conductor draw on this layer is a dash offset over a
`<path>` of 14 (or 16) subpaths, and the file claimed those "light IN ORDER from one offset".
Measured on a bare path of the same shape, reading back the painted fraction of every subpath:

| offset | every subpath |
| --- | --- |
| 0 … 750 | **100% painted** |
| 1000 … 1750 | **0% painted** |
| 2000 | 100% painted |
| −250, −500 | 0% painted |

The dash pattern **restarts at every subpath**, and `pathLength` is shared out across all of
them — so each run is ~71 of the 1000 units, a dash of 1000 swallows it whole, and the draw was a
**switch** that flipped the entire harness on the first frame `--w` rose above zero. The pattern
is now cut to one run: `86 914`, where 86 is the longest run there is in `pathLength` units (the
die's top and bottom fans, 57.728 of 674.736; the board's longest, 163.5 of 2000, is 81.75). Each
run draws from its own start, short ones finishing before long ones.

Two consequences fall out of the same finding. An inward front cannot be written as an offset at
all — an offset only draws a run from its *first* point — so the arrival's glow rides a second
copy of the conductors emitted end-to-end (`#tbs-intro-di`, a `<defs>` child, free at first
paint). And the standby comet, on 14 runs, was pinned to every run's first 26 units and merely
**blinked** for 2.6% of each cycle: the one moving thing in the frame a visitor stares at during
the whole load was a flash, fourteen at once, every 2.2 s. Cut to an 18-unit slug on an 86 period
it is a comet again, on every conductor, and on the die it runs *toward* the processor.

Measured the same way as before — the same frame photographed with each act forced to zero and
diffed — the arrival now contributes a **rising 1.8 → 3.4% of the frame** across its whole run.
Before the fix it contributed **nothing at all between 0.06 and 0.14**, the middle of the act.

First paint went 39 → **40** render objects: one more `<use>` of a single `<path>`.

### Longer conductors, a longer burn, and a splash (2026-09-24)

The three acts read as cause and effect but the section was still thin, and "thin" turned out to
be three separate things.

**The conductors were stubs.** The side fans ran 62 → 98 and never left the silicon — 36 units of
travel on a drawing 480 across — so the arrival and the departure had almost nothing to cross.
They now average **104.6 units against 48.2, 117% more ink**, and the extra length was taken in
the one direction that has room. The frame is 480 × 300, so pushing the top and bottom tips
further UP buys nothing: at the opening scale the visible half-height is 134 units and a longer
tip is simply drawn where nobody can see it. Those six runs were extended **inward** instead, from
the package edge (98) to 62 — the silicon's own half-height, the relationship the side fans
already had — which buys 36 units each and moves the tip not one unit. The side fans go the other
way, out to the package boundary at 152, which clears the heat capsule at x 154 by 2 and the
capacitor studs at x −156 by 4. Measured: **93% of the ink is inside the frame on the poster
frame, against 83%**, and all of it by `--fb-p` 0.20. `--run`, the dash constant, is re-derived
per layer and is now **79** on the die (89.592 user units of 1464.735) against the board's 82.

**The dissolve moved 0.34 → 0.38, and the match cut got better.** The file's invariant was the
*unweighted* worst size disagreement between the two drawings of the chip, and that charges full
price for error on the two frames where one layer is invisible. Weighted by what can actually be
looked at — the die is at opacity `1 − dis` and the board at `dis`, so the visible mismatch is
the disagreement times `4·dis·(1−dis)` — the shipped point scores 2.87%, and its worst frame is
the 50/50 crossfade, the worst possible place. Re-solved at 0.38:

| | shipped | now |
| --- | --- | --- |
| die `--z` divisor | 0.508 | **0.544** |
| board `--z` | `[0.34, +0.425]` | **`[0.38, +0.360]`** |
| board `--bs` | `2.556 − 1.936` | **`2.5027 − 1.8827`** |
| silicon widths on the opening frame | 153.3775 vs 153.3600 | **150.164768 vs 150.164768** |
| worst visible mismatch | 2.87% | **1.86%** |
| mismatch on the 50/50 frame | 2.83% | **0.39%** |

The power wave's `--a` table barely moves (0.380, 0.548, 0.589, 0.597, 0.605, 0.613, 0.621,
0.629) and still lands full at **0.709**, so `--gt`/`--ft` at 0.71 and the 0.84 skip clamp are
untouched. That is not luck: pieces 3–8 are governed by the file's own 0.008 floor cascade, not
by their own fit, so the whole table is pinned by when piece 3 first fits — and the board window
was chosen to keep it at 0.589.

**The ignition is 40% longer and it lands.** `--ign` goes [0.15, 0.25] → **[0.16, 0.30]**, with
`--cool` [0.30, 0.39] so `--flare` is still 0.034 on the cut frame. On top of it:

| | window | what it is |
| --- | --- | --- |
| `--spl` | [0.16, 0.30] | **the splash** — `4t(1−t)`, a parabola and not a smoothstep, because a strike must not ease in |
| `--room` | [0.19, 0.33] | the same envelope 0.03 behind: **the light reaching the walls** |

The splash is its own gated layer (`.fbSplash`, in the `[data-live]` `:is()` list), so it costs
**nothing at first paint** — still 20 + 20 = 40 render objects — and three rings out of one
`r = 100` circle, born 0.12 of the envelope apart, sweep scale 0.08 → 3.20. Every radius they
cross is a real edge: 62 the silicon, 98 its x-edge, 128 the power ring, 152 the package
boundary, 184 the canyon wall's lit face. `vector-effect: non-scaling-stroke` is load-bearing —
without it the transform scales the stroke too and a front thick at birth would arrive forty
times thicker. `transform-box` must be **`fill-box`, not `view-box`**: this viewBox starts at
(−240, −150), so `transform-origin: 50% 50%` against the view box resolves to the corner and the
wave came out of the bottom right of frame. Measured and fixed.

`--room` is the one thing nobody asked for. The canyon the chip sits in — two machined walls, the
kerb, the near lip, the floor, the recession — was painted once at `--fb-p` 0 and frozen for the
whole film, which is why the ignition read as a colour change rather than as a light: there was
nothing in frame for it to fall on. It now drives `.fbDie .fbFace`, `.fbDie .fbFloor` and
`.fbDie .fbDeep`, scoped to the die because `<Cavity/>` is worn by both layers and the board's
copy must not flash.

Measured the same way as the acts — each scalar forced to zero on the element that declares it,
the same frame diffed:

| | at its peak, as a share of the frame |
| --- | --- |
| the arrival | 3.8% → 6.1% (was 1.8 → 3.4%) |
| the splash | **9.05%** at 0.26; 0.13% on the poster frame |
| the ignition | 7.7% (was ~5%) |
| the room | 4.4% |

Three cold loads on the software renderer: arrival **267–371 ms**, ignition + splash + room
**446–603 ms**, departure **219–457 ms**. Quote the windows, not the milliseconds — `origin`
slides with takeover and the run-to-run spread is ±20%.

**What is NOT available, and why.** The section cannot get much longer than this in scrub. With
the pull-back depth frozen (so the framing does not move) and the power wave still required to
finish by 0.71, a search over the whole constant space finds nothing past **0.36** under the
unweighted objective and nothing past **~0.38** under the weighted one: beyond that the board has
to shrink so much faster than the die that the two drawings diverge at the crossfade. More real
time has to come from the clock — `MIN_SYNC_MS` — not from the scrub, and that is a separate
change: `1 - (1 - x) ** 1.6` is not free to reshape either, because FLIGHT_MAP's slopes
(0.75 → 0.61 → 0.72 → 1.29) exist to cancel that exact ease-out.

### The six beats, and who draws them

**One scalar carries the whole film.** `fx.flight`, 0 → 1: the camera's position, aim, field of
view and roll are all functions of it (`components/intro/three/cameraPath.ts`, eight keys), and so
are the lid's angle and the display's fill. Beats 1–4 scrub it from the loading progress
(`flightFromProgress`, `components/intro/flight.ts`); beat 5 is the burst timeline tweening it to
1. There is no second parameter to keep in step, so a skip from any beat is the same tween.

| Beat | Progress | Flight `u` | What it is | Drawn by |
|------|----------|-----------|------------|----------|
| 1 | 0 → 0.24 | 0 → 0.18 | On the die, in the canyon the processor's own package walls make, looking back down the cavity. A held frame — it moves 0.04 units in total | **SVG, always** |
| 2 | 0.24 → 0.60 | 0.18 → 0.40 | The power-up: the die lights from its front edge and the light runs back down the ribs, through the fan and the fin stack, and out of the hole last. Everything happens in the material, not in the move | **SVG, always** |
| 3 | 0.60 → 0.86 | 0.40 → 0.66 | **Through the guts, then up through the keyboard.** The slowest stretch of the film, with the camera threading between the memory on one flank and the fan on the other. Above it and unseen, the lid swings to 107° and the display starts drawing itself on. Then the camera **surfaces through the keyboard at u 0.602** — the gap between the middle and back key rows — into a machine that is already awake | 3D, or SVG |
| 4 | 0.86 → 1 | 0.66 → 0.84 | Above the deck and off to the left, turned back on the machine it has just come out of, with the open lid and the lit display in frame; then round to the front | 3D, or SVG |
| 5 | the burst's own clock | 0.84 → 1 | The dive: the camera lands on the display's normal at the distance that makes it *cover* the viewport, edge to edge | 3D, or SVG |
| 6 | — | — | The overlay fades and the page entrance plays underneath | the page |

**Beats 1 and 2 are the flat drawing on every device, not just where WebGL is missing.** The 3D
canvas (`.canvasHost`) sits at `opacity: 0` until the scene reports ready, and the scene's own
signal is worth 0.40 of the progress — so without it the bar cannot pass **0.60**, which is
exactly where beat 2 ends. There is no loading case in which the canvas is opaque before beat 3.
The drawing's windows are therefore the same table: the cross-fade at `sceneReady` is a **match
cut** at `u` 0.40, not a replay: both renderers are looking down the same cavity at the same
moment, and both then travel it.

**That is why beat 3 is where the machine's detail lives.** It used to end at `u` ≈ 0.45 — a tenth
of a flight after the dissolve, perhaps 150 ms — so the interior was built for a shot nobody
watched, the cavity between the die and the back wall held nothing but flat hairlines, and the intro
read to a visitor as *a laptop*, because the laptop was all they were ever shown. A seventh camera
key (**K3**, `u` 0.58) pushed the exit to `u` ≈ 0.60 and bought the corridor a fifth of the film —
and it is the one stretch **guaranteed to be 3D wherever 3D happens at all**, because the dissolve
cannot land later than 0.40.

So the cavity has twelve pieces in it now: the processor's package rim (the canyon beat 1 sits in),
the socket kerb the camera flies over, two capacitor studs, a heatpipe down the `+x` flank, the fan's
case and hub on `−x`, two sticks of memory, the storage card, and the fin stack hard against the back
wall. They cost **no extra draw calls** — they are boxes in the frame's one `InstancedMesh` — and
every position is derived from the corridor `cameraAt` actually flies (x −0.02 → −0.14 at |y| < 0.02)
rather than chosen: the free volume is everything outboard of x +0.05 and x −0.35, and the tightest
piece in the whole flight is the kerb, at 0.024 — two and a half near planes.

**Solids for silhouette, hairlines for the wave.** The guts draw as outlines (the edge material's
contract), while the light that *runs through* them is line work in the board's own buffer, riding
`aU` — so it switches on in z order as the camera reaches it: the die at `u` ≈ 0.22, the fan's eight
spokes at ≈ 0.25, the heatsink's nine teeth at ≈ 0.37, and the vent's seven segments last, at 0.39.
Those seven stand up in the aperture and draw its **grille**: the machine is additive and writes no
depth, so nothing can be occluded and there is no such thing as a hole — a way out has to be *drawn*.
The power leaves the die, crosses the machine and goes out of the hole as one wave, and the camera
follows it down the same corridor a beat behind.

**The way out is in the keyboard, because that is where the processor is.** `HATCH` — 0.34 × 0.09
at x −0.17, z −0.44, in the deck's top surface — is not a hole cut for the purpose: the key rows sit
at z −0.11, −0.33 and −0.55 and each key is 0.11 deep, so the deck's top is already clear from
z −0.495 to −0.385. The aperture is sized by the exit ray and never the other way round: the camera
crosses the deck's top at x −0.157, measured, with under a thousandth of spread across every aspect,
because neither K3 nor K4 widens. Like the vent, the opening has to be **drawn** — the machine is
additive and writes no depth, so nothing can be occluded and there is no such thing as a hole — and
its frame and three slats ride the power wave's `aU`, lighting at u ≈ 0.28, well before the camera
arrives. An exit is supposed to be lit.

**The lid has to be open first, and that is physics, not staging.** A shut lid lies flat at y 0.10
to 0.15 across the whole deck, two hundredths above the deck's own top at 0.08. There is no gap to
rise through: *a laptop that is closed has no way out of the top*, which is exactly why the first
version of this flight left sideways through the vent instead. So `lidOpenAt` runs **[0.40, 0.60]**
and `screenFillAt` **[0.46, 0.68]** — both ahead of the exit rather than behind it. Anything under
90° still covers the hatch at some height, so the window has to *close* before 0.602, not merely
open before it. What the camera surfaces into is the lit display, square in front of it, two thirds
through its power-on wipe. That is a better reveal than a lid getting out of the way.

**The old beat 3 exit was aimed low, at the deck** — kept here because the reasoning still governs
any shot that leaves through the back wall. The camera could not be raised there: it had to leave
through an aperture 0.067 tall, so its position was fixed by the exit ray and the only free number
was the **aim**. At `ty` 0.55 the camera was tilted ~22° up at empty sky, and the whole machine sat below
the bottom of frame from `u` 0.46 to 0.63 — only the lid rising after 0.64 brought anything back
into shot. The deck is at y 0 and the open lid reaches y 1.37, so the aim belongs by the deck
(**0.18**): the machine then fills the frame from the bottom third upwards and the lid grows out of
the top of it, which is the beat. Raising the aim again without moving the position empties the
frame; moving the position to match puts the camera through the back wall.

K4 is none of those things now: it stands **above** the machine at (−1.55, 0.80, −0.62), aimed
between the keyboard it came out of and the display above and behind it, so both are in shot. The
vent is still in the model, and the power still runs out of it — the wave leaves the die, crosses
the board and goes out of the hole last — but the camera no longer uses it.

**Three numbers elsewhere are the exit, written down.** The particle cloud (`smoothstep(0.60, 0.80,
uFlight)`), the chassis halo (`ramp(u, 0.60, 0.80)`) and the handheld sway (`SWAY.in`) all mean *the
camera is outside now*. At their old 0.42 / 0.45 / 0.35 they fired a quarter of a flight early: soft
blobs filling the canyon, a wall glowing a centimetre off the lens, and a pan inside a corridor where
the walls **are** the frame. They move with K3 and K4 or they are wrong.

### Why it stopped feeling abrupt

**Both curves are C1 now, and neither was.** Two separate things were making the flight lurch, and
both were invisible in a still frame.

- **The camera stopped dead at every key.** (Speed at the five interior keys, measured:
  0.55 / 1.11 / 1.50 / 8.79 / 0.98, and a peak of 21.3 — the corridor now ramps gently instead of
  jumping to 4.05 mid-crawl.) The shot list was interpolated with a per-segment
  smoothstep, `t²(3 − 2t)`, whose derivative `6t(1 − t)` is **zero at both ends**. The old comment
  said "no key is a corner", which was true and beside the point: the continuity was zero-to-zero,
  so with eight keys the camera came to a full stop six times and accelerated away again.
  `cameraAt` now runs a **monotone cubic** (Hermite with Fritsch–Carlson tangents) through the same
  keys, hitting each one just as exactly but carrying its momentum through. Measured, the speed at
  the five interior keys went from 0 to 0.67 / 1.64 / 4.05 / 7.91 / 3.29, and the peak speed
  *fell*, 30.5 → 29.3. The two ends keep a zero tangent deliberately: K0 is a held frame and K6 is
  the landing the burst holds still through the whole 0.55 s fade.
- **`flightFromProgress` was piecewise linear.** Its slopes climb across the table by design
  (0.75 → 0.61 → 0.72 → 1.29), which cancels the cinematic curve's ease-out — but straight lines
  turned each of those into an instantaneous speed change of 19%, 18% and **79%**. The last one
  lands at `u` 0.66, a hundredth after the camera has whipped out through the vent and while it is
  swinging round the machine, so the two accelerations compounded into the worst-felt moment in the
  intro. Same rows, same boundaries, monotone cubic between them.

Monotone, not Catmull-Rom, in both places: every margin the flight has is stated as *the camera is
never inside X*, and a spline that overshoots by a hundredth of a unit on the way out of the vent
puts the lens through the sill with nothing in the shot list to say so.

**And the opening shot was pointing the wrong way.** K0's aim sat 0.17 in front of a camera offset
0.08 from it, so the forward vector's x component was 0.46 — the lens was turned **27° across the
cavity** rather than down it. Measured by projection, that put the processor's own left package
wall at ndc.x −1.44, off the side of frame: the shot the table calls *the canyon between two of
them* showed one wall, and beat 3 then had to swing 27° back before it could start travelling. The
aim is 0.41 down the cavity now, the turn is 11°, and both walls are in shot.

**Clearance is not visibility, and the first cut of the guts confused them.** Every piece was
placed for near-plane margin, which is what the tests check — and by projecting all eight corners
of all twelve along the flight it turned out the fan (x −0.66), both capacitors (behind the start
point) and the left package wall were **never on screen before `u` 0.61**, i.e. only from outside
the machine, after the camera had left it. Twelve pieces nobody sees during the beat they exist for
is the same failure as having none. The banks moved as close to the flight as the near plane
allows rather than as far as the cavity permits — the fan to x −0.34, memory and storage to +0.50,
the capacitors ahead of the opening frame — and all twelve are now in shot from `u` 0, for 45% to
73% of the flight each.

### On a phone

Three things were wrong for a narrow viewport, and none of them showed on a desktop.

**The display did not fit.** Measured by projecting its four corners: on a 0.46 portrait viewport
only **two** of them were in frame at the key after the exit, the worst 6.1 viewport widths outside
— a slab of light rather than a laptop. The fix is the mechanism that already existed for this,
`widen`, raised from 1 to **1.4** on the last two outside keys. It multiplies a key's *horizontal*
offset from its target by `1 + widen · (max(1, 1/aspect) − 1)`, so on anything 1:1 or wider the
term is 1 and **the desktop framing does not move at all**. All four corners are now in frame at
0.46, and three of four at 0.30 with the worst 1% outside, where `MAX_WIDEN` caps the reach.

**The exit ray and the widen were fighting over the same key.** A widened key drags the point where
the camera crosses the deck's top: at `MAX_WIDEN` it moved to x −0.44, a tenth outside an aperture
that would then have had to be half the keyboard wide. So the shot list gained an eighth frame —
**K4, "through" (u 0.64)**, just above the deck and still looking up. K3→K4 is now the whole exit
ray and both keys have `widen` 0, so the crossing is identical at every aspect; the key *after* it
is the one that backs off, and it is free to.

**The low tier was dropping the keyboard the camera comes out of.** `LAPTOP_SLOT_LITE` was the
`keys` index, which gave up all twelve — right while the way out was the vent in the back wall, and
wrong the moment it became the hatch between two key rows. On the low tier and on the FPS
governor's lite step the camera surfaced through a keyboard that was not drawn. The drop order
already ran the rows back to front, so the two that frame the hatch are slots 28–35 and the front
row is 36–39: the cut moved to the front row. The low tier keeps 36 of 41 pieces — eight more small
boxes in the same one `InstancedMesh`, no extra draw call, and a key is 0.44 × 0.022 × 0.11.

What was already right, and stayed: `parallax` is gated on `(pointer: fine) and (hover: hover)`, so
a touch screen never pays for pointer sway; `saveData`, reduced motion and a software renderer each
refuse WebGL outright; the low tier is `dpr: [1, 1]`, no antialias, no halo pass, no transmissive
pane and 240 particles, which is four draw calls; the particle cloud's size is multiplied by the
`outside` gate, so it costs no fill at all until the camera is out; and the drawing's own portrait
rules (`--intro-w: 78vw`, `--intro-cy: 40%`) predate all of this.

### Phases (`data-phase` on `#tbs-intro`)

| Phase | What is on screen | Notes |
|-------|-------------------|-------|
| `boot` | Server HTML: the void, the perspective grid floor, the machine **whole, composed and asleep** (screen dark, everything at .55), CSS-animated, and `SYSTEM_SYNCHRONIZATION: ▮` with no number | No JS yet. The skip button and the counter stay hidden until JS takes over. A CSS failsafe is armed: at **7s** the overlay fades out and becomes click-through on its own — so a visitor whose JS never arrives sees a whole machine, not a half-built one |
| `run` | The counter runs 00 → 99; heartbeats at 25/50/75%; beats 1 → 4 of the flight | JS took over (`data-live`, which cancels the failsafe). Page scroll is locked (and reset to the top unless there is a hash), skip inputs are live, a **9s** watchdog runs in visible time |
| lock → burst | `100` and `ACCESS_GRANTED`, a .22s implosion, then the burst: particles fly out, a white flash and a shockwave, the HUD and skip fade — and beat 5, the dive into the display, which starts at the **lock** and lands at 0.66, a beat before the page is uncovered | The dive is held full-frame through the whole .55s fade: that is the "fly into the screen, the site is behind it" beat, not a cross-fade over a moving camera. The "confirm" tone plays only if sound is on **and** the visitor already interacted (a skip counts) |
| `revealed` | The overlay fades out over .55s; the page entrance plays underneath | `finishIntro({ played: true })`: `tbs:intro-done` fires (and a legacy `tbs_intro` cookie is cleared), so the cookie banner may appear. Nothing in the overlay catches a click from here on |
| `leaving` | A plain 300ms fade | The exit without the director: watchdog, an error, or a skip before the director's chunk arrived |
| gone | — | The overlay is removed when the entrance ends (or ≤3s after reveal as a safety net); the hero's background animations resume |

**Progress is honest, not a fake timer.** The target is weighted readiness — hydration .15,
`document.fonts.ready` .15, `window` `load` .30, the WebGL scene ready .40 — capped by a
cinematic curve that takes at least **2.4s** from navigation start, and forced to 100% at
**5s** whatever is still loading. The counter never shows 100 before the lock, and
`aria-valuenow` moves in steps of 10 (≤90 until the lock, then 100).

**`SCENE_CUTOFF` (0.8) is a five-second deadline, not an 80%-of-the-bar gate.** Without the
scene's signal the weighted readiness tops out at 0.15 + 0.15 + 0.30 = **0.60**, so the shown
progress cannot reach 0.8 until `HARD_CAP_MS` forces the target to 1 — the cutoff only ever
fires in the ~300ms after 5s. A scene that has not arrived by then hands the whole intro to the
SVG. (Documentation said "80% of the progress" for a long time; it was never what the code did.)

**And a scene that arrives too late is refused outright** (`LATE_SCENE_GOAL = 0.86`). Because the
camera is scrubbed from the progress, a scene becoming ready at, say, 4.8s would cross-fade in
with only the last beat left to play: a half-transparent machine whipping into the display in
under a second, over a drawing that is fading out. Past 0.86 the drawing — already at that
beat — carries everything.

**Page entrance** (GSAP, `expo.out`, ≤1.5s after reveal), one marked element per target
(`data-intro-reveal`): grid (opacity + scale) · header (`yPercent` only) · eyebrow and lead
(y + blur) · title (y, scale, blur — **never opacity**, it is the LCP element) · CTA wrapper ·
stats (y + `rotateX`, transform only) · ticker (y). The low tier drops the blurs. Every inline
style is cleared afterwards.

### Skip

- The **"Sari peste intro"** button (44px, with an `ESC` key-cap on fine pointers; never
  autofocused, but the first Tab stop on the page).
- **Keys:** Escape, Enter, Space, Tab (and Shift+Tab), the four arrows, PageUp, PageDown,
  Home, End. Combinations with Ctrl, Alt or Meta are the browser's and are ignored.
- **Pointer:** a primary-button press anywhere, or the mouse wheel.

A skip plays the same burst **2.4× faster**; repeated skips only ever speed it up. Because the
whole flight is one scalar, a skip is that same dive tween started early — and its ease is chosen
when the timeline is built: from a near-standing start it is `power2.inOut`, because a `power3.in`
from `u` 0.05 spends its first 140ms not moving, which after a button press reads as the skip
having done nothing. A skip during beats 1–2 has no assembled machine to fly at yet, so the
drawing is snapped to the composed pose (0.84) in the same frame the burst is built, under cover
of the .22s implosion.
While the
intro runs, a skip key is **spent on the skip**: it is stopped at document capture, so the cookie
banner's Escape or a menu's arrow keys never see it — but Tab still moves focus.

**Where the skip button sits:** bottom-right on desktop; centred at the bottom on phones in
portrait (≤640px wide); top-right on short screens (≤480px tall, i.e. landscape phones), where
the readout sits near the bottom edge.

### When it does not play

| Case | What happens |
|------|--------------|
| A `tbs_intro_skip=seen` cookie | The server renders no overlay; no intro JS, no GSAP, no three.js. **The site never writes this cookie** — the E2E suite and QA seed it. It used to play once per session and a reload never replayed it, which reads as the intro being broken |
| Any page but the home page (`/servicii/*`, legal pages) | Never — the gate is `x-pathname === "/"` |
| Client-side navigation inside the site (a service page → Home, Back) | Never — the layout that holds the gate is not re-rendered |
| Client-side navigation **into** the site (the admin's "view site" link) | The shell renders nothing and sets no cookie; the next hard load of `/` plays it |
| `prefers-reduced-motion: reduce` | Hidden by CSS before hydration, then finished silently (`played: false`, cookie set); GSAP is never requested |
| A `/#section` deep link whose target exists | Hidden by CSS (`html:has(:target)`) and bypassed after hydration — the visitor asked for a place on the page |
| JavaScript disabled | Hidden by a `<noscript><style>` rule; no cookie |
| JavaScript late (the CSS failsafe clock is past 6.4s) | Bypassed, so a half-faded overlay never snaps back |
| JavaScript never arrives (blocked or broken chunk) | The CSS failsafe fades it out at 7s and makes it click-through |
| Hidden tab | Not a bypass: the progress clock and the watchdog stop while hidden; a tab opened in the background starts on first view |
| Print | Hidden |

### The drawing or the scene

The shell probes the device once, after hydration, from a ~1 KB chunk
(`components/intro/capability.ts`), in this order: `ResizeObserver` → reduced motion →
Save-Data → a WebGL2 context on a detached canvas (`failIfMajorPerformanceCaveat`) → who draws
it. The context is released straight away. Since 2026-09-17 the probe is the site's shared one
(`components/three/capability.ts`) and its answer — booleans only — is kept for the tab in
`sessionStorage.tbs_gpu_probe`, so a reload and the interior stage never create a throwaway
context again.

- **The software-renderer rule.** A context drawn by a CPU rasteriser — SwiftShader (also
  headless CI Chromium), Mesa llvmpipe/softpipe, WARP ("Microsoft Basic Render Driver"),
  "Software Rasterizer" — counts as **no WebGL**: `failIfMajorPerformanceCaveat` does not
  reliably refuse them, and the flight at 5 fps is worse than the SVG.
- **No usable WebGL** → the **SVG drawing** (`IntroFallback.tsx`) carries all six beats,
  including a DOM-only burst (transform and opacity only, no filters).
- **Usable WebGL** → the three.js chunk is requested and the scene cross-fades in once its
  shaders have compiled and two frames have drawn; the drawing's CSS animations pause behind it.
  A lost context, an error, the 5s cutoff or a scene ready past `LATE_SCENE_GOAL` hands the
  stage back to the drawing.
- **The machine is 29 boxes in one `InstancedMesh`**, over one `BoxGeometry`, sized by their own
  matrices — **six draw calls on high** (five while the lid is shut, four on the governor's lite
  step), four below: the die plate, the board's tracks, the cover pane, the frame, the halo and the
  display. The plate and the tracks are **two `createRingMaterial`s written the same `uFill` and
  `uHead` every frame**, so the power-up is still one wave over the die and then the ribs; they are
  two only so the plate can run much darker than the tracks. A 0.26 quad the camera skims at 0.03 is
  not a chip, it is the **floor** — at the tracks' own strength it was one unbroken slab of colour
  filling the lower half of the frame, while the tracks are hairlines a metre away that have to
  carry. Two materials, one wave, and still two draw calls. Not thirty meshes: the governor's first
  two one-second windows *are* the
  cinematic, and thirty draw calls on a mid phone would spend them, so the only lever is
  `mesh.count`. The slot table is therefore written in **drop order** — deck, feet, hinge, vent,
  trackpad, lid rails, hinge covers, the twelve keys, the port strip — and a machine that has
  given up its keys is still a machine.
- **The frame is lit on its edges, and drawn on both sides.** A fresnel term
  (`pow(1 − |n·v|, k)`) is a *silhouette* detector: on a box every fragment of a face shares one
  normal, so the term is near-constant across it and the whole face lights up — the deck came out a
  solid glowing tabletop, the keys and the trackpad filled rectangles. `three/edge.ts` therefore
  carries the interior stage's box-edge measure instead (on the unit box `abs(position) · 2`, drop
  the largest — constant over a face — and the smallest — zero through the middle — and keep the
  one between, which only reaches 1 along the twelve edges): faces nearly dark, the edges carrying
  the light, the fresnel demoted to a grazing lift. The band is a fraction of each box's *own*
  extent, so a 0.012 vent rail and the 2.4 deck both get a proportionate edge. And the material is
  **`DoubleSide`**, which is load-bearing rather than tidy: beats 1–3 are flown *inside* the deck's
  box, and with front faces only the cavity has no floor, no ceiling and no back wall — K2, the
  frame the cross-fade lands on, was three hinge barrels and a few traces in black. Two sides cost
  **no extra draw call**, which is the only reason an interior fits inside the six.
- **The cover pane only exists once the lid moves.** Shut, the lid lies face down over the deck, so
  the pane faces straight into the cavity the camera is flying along: a flat 2.4 × 1.5 card of
  refracted environment across a third of the frame through beats 2–3. It is a **plane**, not a box
  (a box has an underside, and an underside is front-facing from below; `thickness` is a uniform,
  not a measurement of the geometry, so one quad refracts exactly like the box did), and it is
  `visible` only while the lid angle is non-zero — so there is no transmission pass at all during
  the three beats where the frame budget is tightest. It *is* visible when the scene compiles, so
  no shader is built mid-flight. It also **never writes depth**: it is the only depth writer in an
  otherwise entirely additive scene and its surface sits proud of the display, and three draws the
  transmissive list before the transparent one — a pane that writes depth makes the display fail
  the depth test on every pixel, and beats 4 and 5 end on a black rectangle.
- **The particle cloud belongs to the machine seen whole.** The orbits are 1.5–2.4 across and
  centred on the origin — which is where the camera *is* for beats 1–3, so every sprite clamped to
  the fill-rate cap and the one beat that has to read as a narrow canyon filled with soft blobs.
  They now arrive as the camera comes out through the vent (`u` 0.42 → 0.68), and as a **size**,
  not only an alpha, so a hidden sprite costs no fill either. The burst throws them towards the
  lens in **view space**, where −z is into the screen whatever the camera is doing; the old
  world-space throw assumed a camera parked on +z and, with a flying one, threw the cloud out of
  the back of the frame.
- **Tiers** (`detectTier`): **low** with ≤4 cores or ≤4 GB memory (when the browser says);
  **mid** on a touch-first device or a viewport under 600px on its short side; **high**
  otherwise. **High** gets the transmissive cover pane over the display (the scene's *one*
  transmissive surface, and the reason it also installs the procedural PMREM environment — whose
  strips are aimed *oblique* to the open lid's normal, because a flat mirror samples one narrow
  cone and a source square-on would wash the whole pane in a single colour), the
  halo, all 29 pieces, 900 particles, antialiasing and DPR up to 2 within a pixel budget;
  **mid** no pane and no halo, 28 pieces (the port strip goes), 540 particles, DPR ≤1.5; **low**
  16 pieces (the keys go too), 240 particles, DPR 1.
- **FPS governor:** two slow 1s windows (under 45 fps on high, 40 on mid/low) drop the DPR to
  1×, then to "lite": no halo, no cover pane, the frame capped at 16 pieces, the board's ribs
  dropped back to the die's own tracks **and the vent's grille** (the frame the cross-fade lands on
  stays intact — the lite step gives up the floor, not the composition), half the particles.
  **Never a material swap** — that
  would compile a shader in the middle of the cinematic, which is the thing the governor exists
  to prevent. A **steady** cadence of 24 fps or more is a refresh cap (iOS Low Power Mode,
  Chrome Energy Saver), not slowness, and costs no quality.
- **QA switch:** `localStorage.tbs_intro_3d = "force"` skips the caveat and the renderer check,
  so the WebGL scene runs even on SwiftShader. It changes what is drawn, never what the page does.

### The static drawing (`IntroFallback.tsx`)

Not a placeholder: it is what **every** visitor sees for beats 1 and 2, and it is the first
thing painted on the page at all. Four stacked layers in one tilted stage — halo, machine, board,
die — of which the **die is the one that opens the film**. The machine underneath it is a 16:10
laptop with the lid at 107°, the 3D scene's own angle, seen three-quarters from the upper left and
built from three `matrix(...)` planes so every piece inside is a plain axis-aligned `<rect>` or
`<circle>` generated from a table.

**The opening frame is the processor, and this is the change that fixed the intro.** It used to be
the whole assembled, lid-open machine at 0.55 opacity (`--rest` was 1 at `--fb-p` 0), with the
hand-off to the die squeezed into `--fb-p` 0.02 → 0.05 — about 3% of the scrub, some 20–40 ms
behind the director's 0.45 s chase tween. That is a cut, not a beat, and it is why the intro read
as *a laptop* however carefully the 3D shot list started inside the die: **the laptop was the
poster frame.** `--rest` is gone. At `--fb-p` 0 the die layer is the only one laid out, the carrier
fills the stage (304 × 196 viewBox units at scale 1.40 against a 480 × 300 box), the ring is
undrawn, the cores sit on their 0.24 floor and one standby comet runs the trace fan.

- **One scrub channel.** The director writes `--fb-p` (0 → 1) on `[data-part="fallback"]` once
  a frame, quantised to 1/200; every part cuts its own window out of it in CSS with `clamp()`.
  A frame is one property write on one element. No `@property` — `calc()` reads unregistered
  custom properties, and nothing animates `--fb-p`, so registering it would only cost
  compatibility.
- **Repetition is `<pattern>`, `<symbol>`+`<use>` or a loop over a table**, never a `<path>` per
  piece: one `<pattern>` is 2 nodes for 45 key caps or ~200 BGA balls. The die's and the board's
  traces are each a single `<path>` with subpaths carried by three `<use>`, so the dash flows
  across the subpaths and they light **in order** from one `stroke-dashoffset`.
- **The resting pose is the processor** — and it is *cheaper* than the machine it replaced. The
  gate inverted: `.overlay:not([data-live]) :is(.fbHalo, .fbMachine, .fbBoard, .fbWake)` is
  `display: none`, so **44 elements are laid out at first paint where 69 were** (26 painted render
  objects, down from 40), and the running animations inside the drawing go from four to one. All
  163 nodes still ship in the HTML either way — only the layout and paint gate moved — so the
  `<h1>` underneath keeps the LCP element comfortably. The expensive thing came *off* the critical
  path with it: the halo's two `feGaussianBlur` over a 540 × 400 user-space region (~1.26 Mpx of
  offscreen surface at 1920 × 1080) is now behind the gate. Two `<pattern>` fills came onto it in
  exchange, which is a cache-and-blit, not a filter.
- **The die is lifted clear of the readout, and the lift is derived.** `--hud-top` reserves the
  band below `--intro-cy + --intro-w * 0.25`, a budget measured from the *machine's* feet reaching
  +94 of the 480 viewBox units. Half the carrier is 98 units, so at any scale over 0.957 the
  processor reaches past that line — at the opening 1.40 it reaches 137.2, and without a lift that
  is ~140 px of chip painted behind the `SYSTEM_SYNCHRONIZATION` plate and straight across the 2 px
  progress track, which has no backing of its own. So `.fbDie` translates up by exactly its own
  overshoot (`--over`, computed from `--s`), which falls to zero on its own at scale 0.957 —
  `--fb-p` 0.374, before the die has finished dissolving into the board. Change the scale and the
  clearance follows; do not replace it with a constant.
- **Ceilings that are load-bearing** (see [07 — Conventions](./07-conventions.md)): exactly two
  `feGaussianBlur` and two filtered elements, no CSS `filter` on anything that moves, and no
  text at all — so zero catalog keys and no font dependency before `document.fonts.ready`.
- **The die → board hand-off is a match dissolve.** Both macro layers scale about `50% 50%`, and
  the board's opening 3.4 is *derived*: it is where its 60-wide silicon matches the die's 196-wide
  one across the 0.26 → 0.36 overlap, so the two drawings of the same chip stay within 8% of each
  other's apparent size all the way through. The old 0.50 → 0.60 hand-off was 21% out.
- **The drawing and the flight agree on when you are out of the machine.** `--form` opens at
  `--fb-p` **0.60**, the same moment the 3D camera crosses the back wall (`u` ≈ 0.60, K3 → K4). At
  0.62 it left two hundredths of the scrub with nothing in them but a 3% drift — a hold on the
  exact frame where the camera is supposed to come *out of the laptop*.
- **The burst covers the frame.** Without WebGL the drawing scales ×**4.6** about the display's
  centre (the ∞'s 2.6 left a visible border: the display is 0.532 of the stage, itself 1.28
  `--intro-w`, so 2.6 stopped at ~64vw). Transform and opacity only. The re-pose did not move it:
  `--mz` is 1 at `--fb-p` ≥ 0.86 exactly as before, so the display ends in the same place.

The overlay is **always dark**, in the light theme too, and has rules for `prefers-contrast:
more` (no CRT lines or glows) and `forced-colors` (system colours, no decoration).

## Header (Navbar)

`components/layout/Navbar.tsx`, in Tailwind. A sticky glass bar with a red neon hairline at
the bottom: 71px tall (`--header-h`), 77px between 641 and 860px, where the language group is
taller — as before the rewrite. DOM order is a
contract the tests read: the logo, the clock, the desktop `<nav>`, the preferences group,
the CTA as its very next sibling, the burger.

- **Logo** `TBS.` — the full stop a plain red glyph, with no glow or halo (the decorative dots
  went on 2026-09-17) — the first link (`#top`), a 44px box at every width.
- **Clock** `SYS_TIME 12:04:08 UTC+3` (`HeaderClock.tsx`): Chișinău time with its real offset
  (UTC+3 in summer, UTC+2 in winter) whatever the visitor's time zone. Decorative and
  `aria-hidden`; the server renders `--:--:--`. The bar clock only ticks where it is on screen:

  | Width | In the bar | In the burger menu |
  |-------|------------|--------------------|
  | < 641px | hidden | full, next to the "×" |
  | 641–860px | short `12:04:08 UTC+3` | — |
  | 861–1024px | hidden (the nav and the CTA need the room) | — |
  | 1025–1179px | short | — |
  | ≥ 1180px | full `SYS_TIME 12:04:08 UTC+3` | — |

- **Desktop nav** (`<nav aria-label="Principal">`, from 861px): SERVICII · COMPANIE · DESPRE.
  An item with a dropdown carries a separate `aria-hidden` "+" that turns into "×" while open.
  Dropdowns are glass panels, always in the DOM, opened by CSS (`menu-open`) before hydration:
  - **mouse:** real hover opens (only under `(hover: hover)`, so touch tablets don't get a
    sticky hover); leaving closes;
  - **keyboard:** focus opens; Escape closes and keeps focus on the top link; `aria-expanded`
    tracks it; the header keeps its 18 Tab stops before the CTA;
  - **touch:** the first tap opens without navigating, the second tap follows the link, a tap
    outside closes;
  - **Escape also closes a dropdown the mouse opened, wherever focus is** (WCAG 1.4.13), and
    leaves focus where it was;
  - clicking a link closes its dropdown — the header survives client navigation, and an open
    dropdown would otherwise hang over the next page.
- **Preferences** (language · theme · sound) are unchanged in size and behaviour; they take the
  glass and a blue neon hover.
- **CTA** `START PROIECT ↗` (`cta-neon`) opens the request dialog.
- **Glass:** the text-bearing glass on `::before` (never on `<header>` itself, or the dropdowns
  would have nothing to blur), a near-opaque sheet without blur below 861px.

**Burger menu (≤860px).** The burger (44px, `aria-label` "Meniu") opens a full-screen overlay
that slides in **under** the header, so the burger stays usable: an opaque page colour with
glass, the HUD grid and a faint red glow on top; a visible "×"; the clock; large numbered
links with their sub-pages; the CTA. Page scroll is locked without moving the sticky header.
Focus goes to the "×"; Escape or "×" closes and returns focus to the burger; tabbing out of
the header and the menu closes it; growing past 861px closes it; the menu's CTA closes the
menu before opening the dialog.

> The header deliberately carries **no link to the admin panel** — a button here would
> publish `/admin-tbs-digital` in the markup of every page. The admin types the URL.

## Between sections — `SectionCTA`

A short "let's work together" panel repeated after Principles, Services, Work and Team, so a
visitor can start a conversation wherever they stop reading (design review, 2026-07-15). It
scrolls to the contact/estimator section; the `hue` prop varies the accent so consecutive
CTAs don't look identical. Partners ends with its own "become a partner" panel and the
estimator *is* the contact form, so there is no CTA between those two.

## Interior stage (3D)

On the home page, **Hero, Ticker, Directions and Work scroll over one 3D scene**, drawn on a
canvas that stays stuck under the header (`components/scene/`, 2026-09-17; wiring in
[03 — Architecture](./03-architecture.md#the-interior-stage)). Everything in it is decorative
and `aria-hidden`: the page reads, works and navigates the same without it.

**What it draws**

- **The microprocessor**, behind the hero (IT-OS Phase 1, 2026-09-17; it replaced the glass
  "Cybernetic Core"): a neon chip lying back as a diamond — a substrate, a heat spreader and a
  glowing plasma die stacked on it, pins on all four sides fanning out into board traces that end
  in square vias (7 traces per side on the high tier, 5 on mid). Red packets run the traces out to
  the board and back in, and a pin flares as one leaves or lands. It leans towards the mouse on a
  desktop, and follows the device's tilt on touch screens **where the gyroscope works without
  asking** — the site never calls iOS's `requestPermission()`, so iOS shows no prompt and keeps a
  slow idle sway. Hovering the hero's CTAs with a mouse, or focusing them from the keyboard, speeds
  the packets up and sends one square light wave out across the board. As the hero scrolls away the
  chip shrinks, its heat spreader and die lift off the substrate (an exploded view), and it
  dissolves. Nothing is glass: no transmission, no environment map. No sound.
- **The cursor circuit trail.** A mouse or pen moving over the stage lays short neon circuit
  segments behind the pointer — snapped to a 20px grid of the page and joined at right angles, a
  code pulse running along them — that fade out over 0.9s. They are laid on the page, so they
  scroll with it. Its limits, all by design:
  - **fine pointer only** — never a finger (touch and coarse pointers attach nothing), and never
    under reduced motion;
  - **the WebGL path only** — the static art has no trail;
  - **over the stage only**: it is drawn on the stage's canvas, under the page, so it shows over
    Hero, Ticker, Directions and Work only where the page lets the canvas through — **never over
    an opaque card** (the Directions case card, a project card that faces the visitor, the
    header), faint at most under glass — and nowhere outside the stage;
  - a pause over 0.35s, or a jump of more than 12 grid cells (240px), starts a new line instead of
    drawing a wire across the page. At most 64 segments live at once.
- **The selected direction's model.** The chip dissolves on its own as the hero leaves. Once the
  top of the services screen passes three quarters of the viewport, the model of the pill that is
  selected **bursts out of a point** at the centre of its place and assembles, in 1.1s — on its own
  clock, whether the visitor keeps scrolling or stops, so it is never left half-formed. Scrolled
  back above (the screen's top below 90% of the viewport) it implodes into that point in 0.45s. A
  visit that lands on the services directly (a reload, a link) finds it already formed. It is
  drawn behind the Directions HUD screen:

  | Direction | Model |
  |-----------|-------|
  | Produs digital | cubes assembling into a block |
  | E-commerce | the Offer → Payment → Access loop, packets riding it |
  | Automatizare & API | a hub wired to its systems |
  | Asistenți IA & boți | a layered neural network with impulses |
  | Brand & UI | a neon grid (rows, columns and + crossings) rolling in waves, with interface cards over it |

  Selecting another direction **morphs** the model through a particle swarm (0.32s dissolve,
  0.5s re-form) — once the model has formed; while it bursts in, a switch is instant. The models
  sway gently rather than spin (a full turn shows a loop or a mesh edge-on). A model's own motion
  starts only once it has formed, after the burst or a morph: the cubes hold their block for 1.4s,
  then explode, float and re-assemble on a 7.2s loop, so cubes scattered a couple of seconds after
  the entrance are that loop, not an unfinished burst. The Brand & UI grid holds its waves still while
  the swarm lands on it, so the particles meet the lines exactly; the waves roll from formation,
  and the pulse ring and the lean towards the pointer grow in over 0.6s.
- **The screen answers the burst.** The stage says where the entrance is (`data-entry` on
  `[data-scene-stage]`: `idle`, `burst`, `formed`), and the Directions panel follows it: a band of
  light sweeps its copy while the model bursts in, and its edge lights up in the direction's accent
  once it has formed. On the static art (`fallback`, `off`) there is no `data-entry` and the
  panel's edge is simply lit; while the stage is still deciding (`pending`) it stays plain.
- **The project DNA helix** (IT-OS Phase 3, 2026-09-17: the client's "cardurile cele să fie la
  ADN"). Once the top of Work's cards passes 55% of the viewport, the selected direction's model
  flies apart into a swarm that lands on a neon **DNA helix** in 1.2s (back in 0.5s above 70%): two
  strands carrying packets, chips riding them (the ones facing the visitor brighten), base-pair
  rungs with a light sweeping up them, and 0/1 digits drifting up the axis. It never spins on its
  own; it turns with the project cards, speeds up while the visitor scrolls, and flares when a new
  project reaches the front. At the end of the section it winds up, closes into a beam and
  dissolves. What the cards do depends on the screen — see [Work](#work).
- Each model follows its place on the page at a parallax factor below 1, so the canvas's
  one-frame lag behind a scrolling page reads as depth (the helix follows Work rigidly: its zone
  is stuck while the cards turn, and stays stuck through the finish, so the two never part).
- **Below 861px the chip sits behind the headline**, dimmed so the copy keeps its contrast (0.55
  dark / 0.4 light under 641px; 0.25 / 0.15 from 641 to 860px, where its centre is under the
  lead), with a scrim of the page colour between them; the static art is faded to match
  (`--hero-core-phone`, [04](./04-design-system.md#hero-core-tokens-phones)). In the light theme
  everything is drawn as ink over the page rather than as added light, and the chip stays faint
  behind the copy on phones: the lead's own contrast leaves no room for more.

**Who gets it** (`data-renderer` on `[data-testid="scene-stage"]`)

| Visitor | `data-renderer` · `data-reason` | On screen |
|---------|---------------------------------|-----------|
| A capable GPU: desktops (high tier; mid on a short side under 600px) and touch-first devices that do not report under 4 GB (mid tier, never high) | `webgl` | The scene, once it has drawn two frames; the static art crossfades out over 500ms |
| Reduced motion, Save-Data, a 2G connection | `off` · `reduced-motion` / `save-data` / `network` | Static art; nothing requested |
| Low tier (a touch device reporting under 4 GB; a desktop reporting under 4 cores or 4 GB), a software renderer (SwiftShader, llvmpipe, WARP), no WebGL2 | `fallback` · `low-tier` / `software` / `no-context` | Static art |
| The context was lost, the device was too slow, a render error | `fallback` · `lost` / `slow` / `error` | Static art, for the rest of the session (`lost` and `slow`) |
| Before the decision, and while the scene loads | `pending` | Static art |

- **It never competes with the page.** The decision waits until the intro overlay is gone, then
  for at least 1.5s of visible time and an idle slot; a probe answer is cached for the tab
  (`tbs_gpu_probe`). A returning visitor without a capable GPU downloads neither three.js nor
  GSAP.
- **Paused** (nothing drawn, the context kept) while the stage is scrolled away, the tab is
  hidden, or the burger menu, the intro or the request dialog covers the page.
- **Self-tuning.** On a slow device the scene first drops its pixel ratio to 1×, then halves its
  particles ("lite"); a device still under 28 fps for four ~1s windows after that gives up, and
  the session stays on the static art. A steady 30 fps (iOS Low Power, Chrome Energy Saver) is a
  refresh cap, not slowness.
- **QA switch:** `localStorage.tbs_scene_3d = "force"` draws the scene even on a software
  renderer and never gives up; `"off"` keeps the stage off. It changes what is drawn, never what
  the page does. (The intro has its own key, `tbs_intro_3d`.)

**Scroll effects**

- On a capable desktop (from 861px, a hovering fine pointer, motion allowed) the hero's backdrop
  drifts down (+12%) and its stat cards up (−8%) as the hero scrolls away — measured by GSAP
  ScrollTrigger, and the identity at the top of the page.
- The project screenshots' parallax in [Work](#work) is CSS only.

**Static art.** Where the scene does not draw, SVG illustrations in the same places and
proportions stand in: the microprocessor in the hero (the same silhouette as the WebGL chip,
drawn through its pose), the selected direction's model on the services screen. Work has no
drawing: without the scene it is the grid (or band) of cards, exactly as the server rendered it.
They never loop.
A new direction's drawing plays a one-shot entrance; hovering or keyboard-focusing a hero CTA
sends one square light wave out across the chip while its packets flicker. Both are gone under
reduced motion.

## /01 — Hero

`components/sections/Hero.tsx`, in Tailwind (`section#top`). The old HUD emblem is gone.

- **Paint order**, back to front: an opaque plate of the page colour, the HUD backdrop, the
  stage's canvas, the phone scrim, the copy. The section carries no `isolate` of its own (it would
  lift the plate over the canvas).
- **Backdrop** (decorative, `aria-hidden`, the `grid` entrance marker): a red and a blue key light,
  the HUD grid "wall", a grid floor in perspective drifting towards the viewer, a hairline scanner.
  The looping layers **pause** while the intro overlay is in the document (`html:has(#tbs-intro)`),
  while the hero is scrolled out of view (`data-offscreen`) and under reduced motion — each
  resumes where it stopped. The lit layers sit in `[data-parallax="hero-backdrop"]` (the desktop
  parallax), never the marker itself.
- **The core's host** (`data-testid="scene-hero"` › `data-scene-anchor="hero"`), inside the
  backdrop: the static chip art, and the box the WebGL chip is fitted to (`CHIP.R` equals the old
  core's radius, so the boxes below did not change with the chip).
  - Phones (below 861px): centred behind the headline, at `--hero-core-phone` (below 641px .3
    light / .65 dark; 641–860px, where the chip sits under the lead, .11 / .27), matched to the
    WebGL chip's behind-the-copy dim so the crossfade does not flash.
  - 861–1024px: on the seam between the two columns (`right: gutter + 6vw`), raised to the top —
    the stat cards stack in the narrow right column there and would hide most of the chip. The
    offset is no larger because at 11.5vw the chip's left traces ran under the end of the h1
    (min 1.22:1 at 1024×768); at 6vw the hero text is 100% ≥ 4.5:1 at 900 and 1024.
  - From 1025px: the right-hand column, centred, at full strength.
- **Phone scrim** (`data-scene-scrim`, below 861px): a radial pool of the page colour over the
  core and under the eyebrow, headline and lead, at `--hero-scrim`.
- **Copy:** an eyebrow (`TBS DIGITAL / WEB · SOFTWARE · AI`, no dot; a short red hairline after it
  from 641px);
  the page's only `<h1>` (34→74px on phones, 44→92px from 861px) whose closing full stop is a plain
  red glyph; the lead. Trilingual literals (`L()` in the component), not catalog keys.
- **CTAs:** the primary `cta-neon` button **"Începe proiectul"** with an `aria-hidden` ↗ SVG opens
  the request dialog (`source: "hero"`); the secondary ghost link **"Explorăm serviciile ↓"** goes
  to `#servicii`. Both **boost the 3D chip** while hovered by a mouse or pen (never a finger — a tap
  has no hover to end it) or focused **visibly** from the keyboard. Hover and focus are separate
  reasons, so moving the mouse off a keyboard-focused CTA keeps the boost, and the focus the dialog
  hands back after a mouse close (not `:focus-visible`) does not start one.
- **Metrics** (`role="group"`, `aria-label` "Indicatori", in `[data-parallax="hero-stats"]`):
  glass cards (`data-metric="projects|automation"`) with a red / blue accent and an accent
  hairline along the top. The portfolio count is `projects.length` in its own `<b>` (no count-up,
  no card when it is 0); `24/7` is a fixed claim. Solid glass instead of blur below 861px.
  - **A wireframe hologram** in each card's corner (`data-hologram`): an octahedron for the
    portfolio, a gyroscope of rings for the automations — hairlines only, no vertex dots. It turns
    slowly only while the stage allows motion (`data-motion="live"`), the intro is gone and the
    hero is on screen; otherwise it rests on a three-quarter pose. Still under reduced motion.
  - **Tilt:** under a mouse a card tilts up to 8° towards the pointer and settles back when it
    leaves; never on touch, never under reduced motion. The group's entrance marker is never
    styled.

From 861px the hero is two columns and fills the first screen together with the ticker.

## Ticker

`components/sections/Ticker.tsx`, directly under the hero. A glass band with a red neon top
line and the words *Strategie → design → livrare · Design premium · Integrări & API ·
Multilingv · AI & automatizare*. Decorative (every word is said elsewhere), so the whole strip
is `aria-hidden`.

The track renders **five identical groups, each ending in its own separator** — a slanted red
neon hairline, 1px wide in the layout (it was a round dot until 2026-09-17) — and the same gap,
and the marquee moves it by exactly one group per loop (`--marquee-copies`), so the seam lands on
a copy of what was just there and the loop has no visible join. The edges fade (the band itself
stays solid edge to edge), hover pauses it, and under reduced motion only the first group is
shown, wrapped and centred, without the seam separator.

## Directions

`components/sections/Directions.tsx`, in Tailwind (`section#servicii`, 2026-09-17) — a
**direction chooser**, not a second sales pitch: five pills, a read-only preview, and the HUD
screen the 3D model draws behind. Its copy is trilingual `L()` literals in the component; each
direction's accent and reference project come from `lib/solutions.ts` and the live portfolio.

- **Heading row:** eyebrow **"Alege direcția potrivită"** with a red hairline, the `<h2>`, and the
  lead.
- **Pills** (`<nav aria-label="Direcțiile de servicii">`): five **real links** to
  `/servicii/<slug>`, in the scene's order (Produs digital · E-commerce · Automatizare & API ·
  Asistenți IA & boturi · Brand & UI). The selected one carries `aria-current="true"`, its
  direction's accent as border and glow, and an `aria-hidden` "↗" — so its accessible name stays
  the label. Below 641px the row is a band that scrolls and snaps inside itself; the page never
  scrolls sideways.

  | Input | Selects a pill | Opens its page |
  |-------|----------------|----------------|
  | Mouse | hover | click, at once |
  | Keyboard | focus (Tab), **←/→** (wrapping), **Home/End** | Enter |
  | Touch or pen | the **first tap on another pill** (stays on `/`) | the second tap; **the pill already selected opens on the first tap** |
  | Assistive technology (a click with no pointer events) | — | at once |

  ↑/↓ still scroll the page, arrows with Alt/Ctrl/Meta are left alone, and the row adds no tab
  stops. A press that turns into a swipe of the band (`pointercancel`) leaves nothing armed. The
  rule is `shouldInterceptTap` (`lib/tapIntent.ts`), shared with the header's dropdowns.
- **Selecting** swaps the preview (a short entrance, none under reduced motion), sets
  `data-shape` on the screen, and tells the 3D scene which model to show.
- **Preview:** the direction's tag, `<h3>`, text and "✓" list, and **one** link,
  **"Deschide serviciul →"**, which always navigates on the first tap — the commercial actions
  live on the service page.
- **HUD screen** (`data-testid="scene-services"`, `data-shape="<slug>"`): see-through, so the
  canvas shows behind it; a decorative layer (HUD grid with a radial fade, an accent glow, a scan
  line that pauses under the intro and while the section is off screen, four corner brackets);
  the model's anchor (`data-scene-anchor="services"`) holding the static drawing; then the case
  card — the direction's own reference project (name, description, its tags as chips joined by
  the tag's "·"), or, for a capability direction with no project (e-commerce), the numbered flow
  Offer → Payment → Access.
- **The panel answers the 3D entrance:** a band of light crosses the preview while the model
  bursts in, and the panel's edge lights in the direction's accent once it has formed (simply lit
  on the static art). See [Interior stage (3D)](#interior-stage-3d).
- **Layout:** below 861px the screen comes **first**, right under the pills, so a tap changes the
  model in view; from 861px the preview and the screen sit side by side; from 1025px the model
  stands beside the case card.
- **Nothing moves when the selection changes.** The copy, the screen and the panel have per-locale
  minimum heights, measured as the tallest direction in each width band, so a tap never shifts
  what is under the section (or the stage's scroll measurements).
- Only the first direction's drawing is in the HTML; the others load the first time another
  direction is selected.

## Work

`components/sections/Work.tsx`, in Tailwind (`section#lucrari`, 2026-09-17). Eyebrow
**"Portofoliu TBS"**, the `<h2>` **"Proiectele care ne reprezintă."** and a lead, then one HUD
card per project from the store — fully editable from the admin's **Proiecte** tab
([09 — Admin](./09-admin.md)).

- **The card** is a link (`<a target="_blank" rel="noopener noreferrer">`) when the project has a
  URL, an `<article>` otherwise — never a link to nowhere. It shows the project's **first
  screenshot** (the rest of the gallery stays in the data), its **tag as chips** (a "·" in the tag
  splits it, and stays visible between the chips, so the card reads and is announced as
  "CRM PRIVAT · FĂRĂ LINK"), an outlined position index (`01`, `02`… — adding or removing a
  project renumbers), the name, an arrow box on linked cards, and the description.
- **The description** is revealed on hover and keyboard focus on a desktop, and always shown on
  touch screens (`(hover: none)`, tablets included) and at 640px and below.
- **Hover / focus:** a 5px lift, a neon edge in the card's accent, corner brackets drawing in;
  under a mouse from 641px the card also **tilts** up to 6°. Never on touch, never under reduced
  motion.
- **Parallax:** the screenshot drifts slightly as the section scrolls through the viewport — a CSS
  scroll-driven animation, no JavaScript; still where the browser lacks it (Firefox) or motion is
  reduced.
- A project without a screenshot is still a finished card: its own gradient with the dark wash
  under the copy.
- **Layout:** three columns; two up to 900px, where an odd last card spans the row and keeps its
  screenshot at a normal card's size on its right half (stretched, the screenshot was enlarged
  ~2× and small print in it became legible); at 640px and below, one horizontal snap band that
  bleeds to the screen edges. That is the page as rendered, and all anyone gets on the static art
  (`fallback`, `off`, reduced motion, no usable GPU).

**In the 3D stage** (IT-OS Phase 3, 2026-09-17; wiring in
[03](./03-architecture.md#the-project-dna-helix-it-os-phase-3-2026-09-17)). Work is inside the
interior stage. Once the scene has drawn and built its DNA helix (after its first picture):

- **Spiral — screens at least 768px wide and 600px tall** (tablets in portrait too). The cards
  leave the grid and **turn round the helix** as the page scrolls: each one sticks under the
  header while a scroll of about 38% of the viewport (240–380px) brings the next one to the
  front. **Each card turns with the helix**: it is posed in 3D from its own angle round the
  strand — it rotates away as it goes behind and back as it returns to the front, leans a little
  along the strand's rise, and the far half of the orbit is pushed away from the camera. The
  perspective is written per card, never on the track: a `perspective` on the track would make it
  a stacking context and lift the cards behind the helix out from under the canvas. Because every
  card sits in the same grid cell, the vanishing point is still shared. The front card is posed
  at zero, so its rendering — and its contrast — is identical to a card in the grid.
  The card at the front is the largest and sits over the canvas; the cards behind the
  helix are smaller, fainter and pass **under** it — real depth, not a fade. Only a card facing
  the visitor takes a click or a tap; one behind the helix never does, and neither does a card
  faded under 8% opacity. **The cards are spaced far enough apart not to pile up:** neighbours
  are spaced a third of the zone apart at 1280×800 and the card at the front is 258px wide, and a
  card fades out at 2.6 steps from the front — just before its own turn would take it behind the
  helix, so the strands show **between** the cards rather than behind them. A card's centre
  crosses the window from y 904 to y −33, entering at 0.62 opacity rather than creeping in
  invisible, and its opacity only reaches 0 once its box has left the layer, so nothing winks out
  in front of the visitor. The section grows by that
  scroll (one sticky screen plus one step per card, plus the finish below); nothing sideways, and
  no card slips under the Phase 5 rail's lane (44px from 861px). A card in the spiral is **as tall as its content**
  (at least the spiral's even height): a long description — always shown on a touch tablet,
  revealed on hover on a desktop — is never cut off.
- **The entrance is timed, not scrubbed.** The cards do not simply appear on the helix. They
  arrive on the Work gate that already brings the services swarm over and forms the helix (1.2s,
  `fx.ts`), staggered card by card along the strand over about 530ms — a card starts folded onto
  the strand's axis, small and turned away, and unfolds onto its slot. The gate runs on its own
  clock, so it always finishes and can never rest half-formed, however the visitor scrolls.
  Without the scene (reduced motion, fallback) there is no entrance: the cards are simply in the
  grid.
- **The screenshot is drawn on by the scroll.** The project picture is not simply present: it is
  built up from its bottom edge as its card climbs the zone, behind a sheet of scan lines in the
  card's own accent whose bright leading edge rides the reveal. It **assembles** rather than
  simply appearing: the part already drawn on is masked into 16px columns that fill as the card
  rises — a column that has not arrived yet shows as a stripe in the project's accent, not as a
  hole — and the picture settles out of a 6% lift at the same time. It is driven by `--helix-wipe`,
  written per card from that card's own place on the strand — so it happens where the visitor is
  looking, on every pass, and runs backwards if they scroll back. A card is whole well before it
  reaches the front, so the project being read, and every card above it, always show their
  picture complete; the card one step below the front sitting part-drawn is the effect, not a
  defect. **This replaced a timed animation that nobody could see:** armed off the section's
  one-shot gate, the 420ms wipe fired at scrollY 1602 while the track still began at 1961, so on
  a full pass through the section not one sampled frame out of 91 caught a picture mid-reveal.
  When a project reaches the front, one bar crosses it in the same accent (520ms), covering both
  the strand flare and the hologram's glitch on that same swap, so the three read as one event.
  The scan sheet is painted on the screenshot and **under** the card's washes, so it is
  attenuated exactly as the picture is wherever copy sits over it. Under reduced motion, on the
  phone band and on the static art the picture is simply there, as before.
- **The finish.** The run used to end on a freeze: the front card reached the last project about
  234px (346px on a tablet) before its sticky slot released it, so every card held one identical
  pose while the helix — clamped differently — slid out of the top of the screen without them.
  Now the track carries **1.35 card-steps more**, the focus runs on past the last card at exactly
  the same rate (no change of pace at the hand-over), and over that stretch the cards fold onto
  the strand's axis and fade while the helix winds up, draws its strands into a beam and
  dissolves. The hologram goes with it. It is timed to land as the cards come unstuck and the
  next section arrives, so there is no dead screen between them, and the scene stops drawing
  entirely once the section is behind the visitor.
- **The helix answers the visitor.** Scrolling faster speeds up the packets, the 0/1 bits and the
  comet running the rungs, and lifts the glow; a new project arriving at the front, or the
  hologram swapping, flares the strands for about half a second. This is all done by changing
  values already sent to the GPU — no extra geometry and no extra draw per frame.
- **The hologram.** Beside the helix floats a hologram of the front card: its screenshot as a
  scanlined luminance image in 2px cells (small on purpose: fine print in a screenshot, such as
  the e-mail in the FLIRT sign-up form, is not legible on it), its tags, name and number. It
  glitches briefly when the front card changes and is redrawn only once the next card is well
  past half-way. The helix and the hologram take the front card's accent colour.
- **Keyboard.** Tab moves through the cards in their normal order; each focused card scrolls to
  the front (with the page's own smooth scrolling) and is fully opaque. Nothing leaves the tab
  order and no card is hidden from assistive technology. A card focused by a click does not
  scroll.
- **Ambient — below 768px (or a window under 600px tall, or fewer than three projects).** The
  band (or grid) stays exactly as it is, and a small helix lies on its side, at full brightness,
  **in the empty band above the heading** — between the Directions panel and the "Portofoliu TBS"
  eyebrow (about 84px on a phone), about 60px tall there and at most 0.6 of the screen wide,
  touching no text and no card — coloured after the card nearest the middle of the band. It is not behind the
  heading: there its flaring chips and packets turned the headline's pixels near-white, and keeping
  the copy readable left it a faint trace in the dark theme and nothing at all in the light one. The
  services model's swarm flies to it once Work's cards pass 55% of the viewport; on a very short
  phone (568px tall) the band is under the header at that moment and comes into view when the page
  is scrolled back a little.
- **Arriving inside Work** (a reload or a link while Work is on screen) keeps the grid: switching
  to the spiral there would grow the section by thousands of pixels under the visitor. The
  spiral applies the next time the visitor is above Work. Leaving the spiral (a narrower window,
  the scene switched off) puts the grid back at once, with the focused card where the visitor was
  looking.
- Without the scene nothing of this exists: no helix, no inline layout, no `data-helix`.

Seeded content (`lib/content.ts`, nine projects): BizCheck, Itara Global, DocuSafe, Crowe Portal,
CGAM, IQ Arena, Balloons Breeze, Statistic, FLIRT. Note that **CGAM and IQ Arena are two different projects** — CGAM is
the academy's web platform (cgam.md); IQ Arena is the mobile negotiation game. Screenshots live in
`public/projects/`.

## /02 — Principles ("Cum lucrăm, pe scurt.")

Three numbered rationale cards — `01 / PRODUS`, `02 / PROCES`, `03 / REZULTAT` — each with its
own accent, three columns above 900px and stacked below. The copy lives in the component as
`{ ro, ru, en }` literals, not in the catalog. The original five-cell grid and the four-box stats
row are both gone; the stats row's `50+ / 8+ / 30+ / 24/7` were never measurable from anything the
project holds.

`accent` and `accentText` are deliberately two tokens: the first tints the hover border and the
mark, which are graphics and owe 3:1, and the second colours the 12px/800 number, which is TEXT
and owes 4.5:1. All three brand fills fail as small text.

### The card marks (2026-09-24)

One small line drawing per card, the SAME size in the SAME corner on all three: 38×38 in the
card's top right, opposite the number. Layers for `01` (a page is one plane, a product is a stack
of them), three listed stages for `02`, a bracketed sight for `03`. They fade in once on the
reveal the section already has, 140ms apart, and never move again.

**The sameness is the design, and it is the correction.** The first attempt gave each card a
different instrument: a CSS 3D model of the site's own processor in `01`, a linked list of the
three real stages read from `lib/solutions.ts` in `02`, and a large bracketed frame in `03`. Every
piece was defensible on its own and the row was not: three different visual weights, and the
empty frame — whose emptiness was the argument, since the only indicator it could display is one
it invented — read to the owner as a panel that had failed to load. It was replaced rather than
tuned. What is worth keeping from it is the reason it failed: *an argument the viewer has to be
told is not an argument*, and a row of three only reads as a row when the three match.

**Drawn to the house rules for line art** (docs/07): straight strokes, square caps and joins, no
circle anywhere, no decorative dots, and nothing animated on `stroke-dashoffset`. `stroke-width`
is set in CSS with `vector-effect: non-scaling-stroke`, so the same drawing keeps a 2px stroke
whatever the box is scaled to instead of going hairline on one card and slab on another.

**Nothing in a mark may ever show a value** — no numeral, no percentage, no axis label, no needle,
no bar. Card 03's sentence is "Legăm fiecare livrare de un indicator real", and the only
indicator a component could put in that mark is one it invented. The site has already paid for
that once: the team card carried "50+ proiecte", "98% clienți mulțumiți" and "24/7" until the
first was caught contradicting the hero's real portfolio count, and all three were deleted rather
than re-guessed. The `statusBars` export that still held those literals in `lib/content.ts` was
dead — one grep hit, its own definition — and went with this change.

**The marks are silent.** `aria-hidden`, `focusable="false"`, no `<title>`, no text: the sentence
beside each one is the claim and the mark is only that claim drawn, so there is nothing here to
translate and nothing to fall out of sync with the `{ ro, ru, en }` fields. Under reduced motion
the base declaration is already the finished pose, because `globals.css` kills every animation
with `!important`; under forced colours the drawings stay (a line drawing survives flattening to
one system colour — it is still a legible outline) and only the held-back opacity is released,
which there would read as a faded glyph.

## /03 — Services ("Servicii de digitalizare")

> **Not rendered by any page today** — the home page's service block is
> [Directions](#directions). Kept here while `components/sections/Services.tsx` exists.

Grid of service cards (icon, name, description), fed by `lib/content.ts` → the store, so the
admin edits names, descriptions and prices in all three languages. A service marked
`estimatorOnly` (currently "Automatizare cu IA") appears in the estimator but has **no card**
here. Card labels `/01`, `/02`… are computed from position, so adding or removing a service
renumbers automatically.

**Clicking a card jumps to the estimator with that service pre-selected**
(`lib/estimatorBridge.ts`). On mobile the grid is an auto-rolling scroll-snap carousel
(`useAutoCarousel`).

## /05 — Team ("Oamenii din spatele produsului")

A heading block (eyebrow · title · lead), then the **Team Lead's holographic projection**, then a
horizontal snap carousel of member cards. Each card carries the `ECHIPA TBS` label, the member's
photograph (or a gradient initial where none is set), their name and their role. Below the carousel
sits the stat row, which renders only the stats the owner has actually filled in and disappears
entirely while they are all blank.

> This section's description was stale until 2026-09-23: it described a `SYSTEM_STATUS` panel with
> progress bars, member bios and social links, none of which the component renders. `TeamItem` still
> carries `bio` and the social URLs — the admin's **Echipă** tab still edits them — but the card
> shows the label, the photograph, the name and the role, and nothing else.

Real content: **Maxim, Danu, Laurentiu** — first names only, by request. Editable from the admin's
**Echipă** tab. The carousel is a `flex` band with `scroll-snap`, a card about 82vw wide (never
under 320px) so the next one peeks, and `overscroll-behavior-x: contain` so a swipe that runs off
the end does not chain to the page or trigger the iOS back gesture.

**A member with no photograph of their own now takes the bundled one**, matched by id
(`withBundledPhotos` in `lib/siteContent.tsx`). This is a field fallback, not a key-merge: it only
ever reads the saved list, so a member the owner deleted stays deleted. Before it, a shipped asset
was shadowed by an empty saved string and the card fell back to its gradient initial while the file
sat unused in `public/`. An uploaded photograph still wins outright.

### The holographic portrait (2026-09-23)

The card's photograph is PROJECTED rather than printed: he is keyed off his ground, painted in the
site's cyan, laid under scanlines, swept by a beam and broken twice a cycle by a fault. It is all
CSS and one SVG filter.

**It could not have been the WebGL scene, and the reason is worth keeping.** A projection built in
the interior scene stood above the carousel for a day and was removed for this one. The card is
`background: var(--panel)` and the scene's canvas draws BEHIND the page, so a hologram inside the
card would need a hole cut through an opaque panel — which would come apart on the card's own
`:hover` transform, and below 861px, where the scene never starts at all, would show the page
instead of the card. Here it works at every width, on every renderer, with no canvas.

**The filter is arithmetic, not taste** (`#tbs-holo-key`, defined once per section rather than once
per card). Its matrix's alpha row is the luminance coefficients, so alpha comes out as the
picture's own lightness; the transfer below then thresholds that into a silhouette — holding 1 all
the way to 0.90 and falling to 0 at 1.0, because the ground he was photographed on measures exactly
1.000 while his jacket peaks at 0.904 and his shirt at 0.895. The colour rows are the same
coefficients scaled by `--dark-cyan`'s real channels and a gain of 1.05; at 1.3 the blue channel
went over 1 and clipped, which turned the whole lower half of him a washed white instead of cyan.
`color-interpolation-filters="sRGB"` is not decoration: those thresholds were measured in sRGB and
the SVG default is linearRGB, which would put the key somewhere else entirely.

**The scanlines are a MASK, and that is the whole trick.** A mask multiplies alpha, so the lines
fall on HIM and never on the empty space he was keyed out of; an overlay would have striped the
card's panel around him. For the same reason the beam and the torn band are further COPIES of the
photograph rather than gradients laid over the box — a gradient sweeping the whole card reads as a
grey slab crossing it, which is what the first attempt looked like.

**What breaks, and what must never.** Twice a cycle the raster drops to a coarse mask and a band of
him tears sideways, on step timings that share no factor so the loop never announces itself. What
is deliberately absent is anything that rebuilds the picture from nothing: the scene's projection
re-scanned itself once per loop and the owner read it, correctly, as the image reloading. A
projection that reassembles itself is the one thing this must never look like.

**Nobody loses the picture.** The photograph is still the photograph and still carries the `alt`;
everything holographic is a filter, a mask and two faults laid over the same `<img>`. A screen
reader, a crawler and a browser without filter support all get what they got before. Under
`prefers-reduced-motion` it holds one clean frame — keyed, tinted, scanlined and perfectly still —
and under `forced-colors` the filter comes off entirely, because flattening it there would put a
cyan slab where his face is, and the plain photograph is more use than that.

**The source is a bundled asset shot on a light ground.** `public/team/maxim.webp`, 708 × 944,
committed with the code. An admin upload still fills the card as it always did, but the key is what
the light ground buys: on a dark background it would remove nothing.

## /06 — Partners ("Partenerii noștri")

Heading + lead, a strip of partner logo cards (logo, name, link to the partner's own
site), then a "Devino partener" call-to-action panel that mails `office@crowe-tm.md`.
Each card also carries a **preview screenshot of the partner's site**: it fades in behind
the logo on hover (desktop) and is simply shown from the start on touch devices, where no
hover exists.
Real content, not placeholders: Crowe Turcan Mikhailenko, CGAM Business Academy and
Ivan Turcan. Logos are monochrome-white PNGs on transparent backgrounds (the section
renders on the dark background) and live in `public/partners/`.

Fully editable from the admin's **Parteneri** tab, including uploading a new logo —
see [09 — Admin](./09-admin.md).

## /07 — Estimator + Contact ("Estimează prețul")

- **Estimator:** three groups — `01 · TIP DE PROIECT`, `02 · TERMEN LIMITĂ`,
  `03 · OPȚIUNI SUPLIMENTARE` — plus an estimated-price total. Prices come from the admin;
  an unset price renders `...` (see rules doc). Arriving from a service card pre-selects
  that project type.
- **Request context (2026-09-17, plumbing for the IT-OS HUD; since Phase 4 the Ghid TBS passes
  `openAssistant`, `guideTopic` and the `guide` / `guide-prompt` sources — see
  [Ghid TBS](#ghid-tbs-the-guide); the other new fields still have no caller).** Every CTA opens the one request dialog
  (`lib/request/RequestFlowProvider.tsx`) with a `RequestContext`. Besides `serviceSlug`,
  `projectId` / `projectName` and `source`, it now takes:
  - `projectType` — a catalog id (`site`, `crm`, `automation`, `ecommerce`, `mobile`) that wins
    over the slug's mapping; an unknown id is ignored;
  - `optionIds` — exactly these option chips (`design`, `integrations`, `multilingual`, `seo`)
    instead of the default "+ Integrări & API"; `[]` ticks none, unknown ids are dropped;
  - `openAssistant` — dialog only: it opens on the assistant, with focus in the chat panel;
  - `guideTopic` — `servicii`, `lucrari` or `service`, written into the origin block as
    `- Secțiune: <topic>` (any other value is left out);
  - `attachment` — a HUD tool's block (`kind` calculator / builder, `count`, optional `summary`,
    `text`): control characters stripped, capped at 1,200 characters with `[…]`
    (`lib/request/attachment.ts`), and a one-line note under the proposal says what travels.

  New `source` ids: `guide`, `guide-prompt`, `os-calculator`, `os-builder`. The sent message is
  the summary, then the attachment, then the origin block, then the transcript; the attachment's
  and the origin's room is reserved before the summary is clamped, so the whole stays ≤ 5,000
  characters. The project types and options, with their ids, live in `lib/request/catalog.ts`
  (labels unchanged); `payload.project` and `payload.estimate` mean what they did.
### The deck (2026-09-24)

An earlier pass recessed the container — `.box` went to `--bg2`, darker than the page, with the
parts raised on it. **The rule was right and the values were not, and that is measurable rather
than arguable.** Near black the `+ 0.05` term in the contrast formula dominates, so the ladder
came out at 1.02:1 from the page to the box, 1.02:1 from the box to a field and 1.10:1 between
the two parts. Four levels in the code, one on the eye; the section read as a single field of
near-black with thin red scratches on it.

So the ladder is inverted and given real steps: the box is the LIT object and the room around it
is the dark one — a console in an unlit room. Three surfaces in the whole section, no more:

| level | token | value | sat | |
| --- | --- | --- | --- | --- |
| room | `--bg` | `#0a0b10` | 38% | the page |
| deck | `--deck` | `#1f232e` | 33% | **1.25:1** over the room, plus a 1px edge and a real shadow |
| riser | `--riser` | `#151820` | 34% | a recess in the deck, lit on its rim |
| slot | `--slot` | `#0d0f14` | 35% | the fields, identified by their outline |

**The panel is DARK, and that is the third answer to the same question.** It was near-white, then
lavender, then a slate grey card — and a large flat mid-grey is the least attractive value in a
dark interface: it competes with the price and the CTA instead of serving them. So the panel
stopped being the brightest FILL. Its identity is light now: a red-lit rim, a red halo, a light
crossing its top rule, and the price in white at **16.58:1** on it.

Going dark improved everything measured. `--txt` 10.50 → **16.58:1**, `--on-ink-mut` 6.06 →
**9.56:1**, `--red-text` 5.71 → **6.46:1**, `--red-lift` 3.57 → **5.63:1**. And field
identification improved too, which is the counter-intuitive one: the SAME `--riser-line` border
measures 1.55:1 on the old light panel and **2.45:1** on this one, because a light panel was
washing its own outlines out. The border was then lifted to `#5a6176`, which takes it to 2.88:1
against the panel and 3.11:1 against the field — against 1.55:1 before.

**Saturation is tuned as deliberately as luminance.** At the site's usual 50% these surfaces are
large enough to read as a blue slab sitting on a near-black page, which is what the owner saw and
said. The deck came down from 50% to 33% and the panel from 49% to 38% at the same luminance, so
the section keeps the family without announcing itself as blue. Every contrast pair held or
improved through the change: `--red-text` on the deck 5.11 → 5.71:1, `--txt` on the riser
10.43 → 10.50:1, the focus border 3.54 → 3.57:1.

**Solving every step for 1.40:1 was itself an overshoot**, and the second version of this table
records the correction. At those values the deck came out a light blue-grey, the riser lavender,
and the pure-black fields inside it read as holes punched in a card rather than as recesses cut
into it. Separation is a job for the EDGE as much as for the fill: the deck carries a border and
a shadow, so it does not need a big jump, while the panel keeps its own. Every text pairing
improved in the process — `--txt` on the riser 9.00 → 10.43:1, the focus border 3.06 → 3.54:1.
A slot is never `--bg`: two values up it still sits further below its panel than any other pair
in the section. The tokens live in `globals.css`, not as hexes in the module (docs/04).

**A measurement that moved the markup.** `--red-text` is 5.48:1 on the old panel and **3.51:1 on
the riser**, so the red region label cannot live there — and no surface bright enough to separate
from the deck can carry it either (the ceiling is L = 0.0349, which is 1.13:1 from the deck). The
label therefore sits on the deck ABOVE the panel, at 5.11:1, which is also why all three region
labels now share one ground and one weight. The copy under the price moved from `--mut` (4.83:1,
passing and only just) to `--on-ink-mut` (5.19:1).

**The focus cue, and the whole redesign turns on it.** The outline is drawn at `outline-offset`,
i.e. on the PANEL rather than on the field, so its own contrast is ring-against-panel and it has
never been the conforming cue here — about 1.2:1. What actually satisfied WCAG 1.4.11 was the
focus BORDER: `--red` on `--panel2` is 3.60:1. Lighting the panel takes that same border to
2.30:1 and would have quietly broken the only conforming focus indicator a lead-capture form has.
`--red-lift` is the fix, measured on every surface a field can sit on: 4.46:1 on the deck, 3.06:1
on the riser, 6.24:1 against the field's own fill.

**Two lights, one mechanism, one constant speed.** A 2px light crosses the deck's top rail every
6.4s and another crosses the proposal panel's own top rule every 4.8s, offset by 1.6s so the eye
always has exactly one thing to follow. Neither crosses a glyph, an input or a hit area at any
width, and neither ever holds still.

**Both of those are corrections, and both were the same complaint: it brakes and stops.**

*The rail parked.* It translated by `calc(100% + 190px)`, and a percentage in `translateX` is a
percentage of the ELEMENT — 190px wide — not of the 1242px track it was meant to cross. So the
light travelled 380px and stopped dead in the middle of the deck for the rest of the cycle;
sampled frame by frame, its brightest point sat at x=617 for seven consecutive samples. The
element is now the full width of the track and the BACKGROUND travels, where `100%` means "the
track minus the image": the light enters off one end and leaves off the other. It now reaches
x=1234 of 1242 and is found at **11 distinct positions across 14 frames**. There is no rest phase
at all — a light that holds still halfway is not resting, it is broken.

*The ring braked.* It was a conic gradient rotating behind a 1px masked frame, and a conic
gradient turns at constant ANGULAR speed. On a rectangle that is not constant perimeter speed: on
this 477 x 564 panel the light moved about 55% faster past the corners than along the middle of a
side. Constant speed is the whole difference between a light and a glitch, so the ring was
replaced with the same straight track the deck has.

**And a third loop was built and removed the same day.** A wide soft band sweeping the deck reads
as light over near-black and as a STAIN over a surface with its own value — in a still it left
the left half of the panel visibly dirtier than the right. Motion on a lit surface belongs on its
edges.

The first version of this put its loops in a 1px line along the top of a 1900px box and in a glow
breathing behind a panel, and the honest outcome was that the owner looked at the section and
reported seeing no animation at all. He was right, and it is measurable: a burst of frames diffed
pixel by pixel showed **0.02%** of the box changing between them — the blinking cursor. The
current build measures **15.4%** of the panel changing (the ring) and **10.4%** of the box (the
band). Restraint tuned past the point of visibility is not restraint, it is absence.

They do **not** pause on focus, and that is deliberate too. A version that stopped every loop the
moment anything inside the box was focused meant that anyone who clicked a chip in the first
second saw one second of motion and a dead panel for the rest of the visit. Motion that stops the
instant you engage with it is motion nobody ever sees.

**The selected chip is a lit key, and it took two wrong answers to get there.** It began as
`--txt`, near-white, which put it at **38× the luminance of the deck** and made it the loudest
object in the section after the CTA. The fix was worse: the deck's fill carried 26% toward
`--red-lift` — and mixing a warm accent INTO a blue-grey is how you get mud, a maroon-plum that
belonged to no palette on this site. So the fill does not move at all now. The chip stays the slot
it already is and the accent lives on the EDGE: a full-strength border at 6.24:1, the 2px bar
beneath, a short outer glow, and the label at 18.36:1. Nothing is mixed, so nothing muddies.

**Two traps, both paid for.** `@property --ring-angle` must be registered at the DOCUMENT level: a
custom property that is not registered interpolates as a string and simply jumps at the end of the
cycle. The first version declared it inside the `:root` block, where an at-rule is invalid,
Lightning CSS dropped it silently, and the pixel diff showed seven identical frames followed by
one that changed — which is exactly what an un-interpolated angle looks like. And `docker compose
up -d --build` **leaves the previous container running when the build fails**: a CSS parse error
meant three rounds of "verification" were run against a stale image. Check that the build
succeeded, not that the container started.

**The price is the hero, and it is still the owner's number.** It is sized like the payoff it is
(`clamp(34px, 4.6vw, 52px)`, `tabular-nums`), and nothing counts it up or animates it into being.
What is new is that when it GENUINELY changes the panel marks it once: the component compares the
rendered STRING, so a re-render or re-picking the same chip fires nothing. The flash alternates
between two identical keyframes under two names — a CSS animation only restarts when its name
changes, and the alternative, remounting the panel, would take the contact form with it and throw
away whatever the visitor had already typed. Verified in a browser: the price went 150 € → 450 €,
the panel flashed, and the text already typed into the name field was still there.

**Forced colours** leaves the form untouched: the chrome's background images come off, the glow
is hidden (flattened it would read as a second border), and selection is an inset outline rather
than a fill — `Highlight`/`HighlightText` on TEXT makes the chip's label vanish, because Chromium
paints a `Canvas` backplate behind text and `HighlightText` is black in the dark forced scheme.

- **Contact form:** name, email, phone, message + submit. It **does** submit —
  `POST /api/contact`, validated client-side by `lib/validation.ts` and authoritatively by
  the backend, then pushed to the Telegram lead bot
  ([13 — Telegram Bot](./13-telegram.md)).

## Footer

Partners row (the same partners as /06, rendered as chips that link to their sites),
navigation/services/contact columns, socials, copyright, and the `> ACCESS GRANTED_`
striped marquee.

## Cookie-consent banner

`components/ui/CookieConsent.tsx`, in Tailwind. Shown until the visitor chooses: **Accept**
(`cta-neon`) allows the analytics pixel, **Doar esențiale** rejects it (Escape does the same).
Links to `/cookies`. Nothing tracking loads before a choice — see
[16 — i18n & SEO](./16-i18n-seo.md).

- **Look:** a glass card bottom-right from 641px (solid glass tint under a blur, so its 14px
  copy stays AA over anything behind it); on phones a full-width **opaque `--panel` card with no
  blur** — it sits over the hero floor grid and the ticker, which never stop animating, and a
  blur there would be recomputed every frame. Buttons are 44px and stack below 401px.
- **A non-modal dialog** (`role="dialog"`, `aria-modal="false"`): it takes focus when it shows
  (without scrolling the page), and Escape means essential only.
- **It waits for the intro.** On a page with no overlay (every page but a first-visit home page)
  it shows in the same effect as always. Behind a running intro it shows on `tbs:intro-done`,
  so it never takes focus under a full-screen overlay. A backstop of `WATCHDOG_MS + 1000`
  counted in **visible** time covers an intro that never reports back — but it does not fire
  while the overlay is still live (the intro's own watchdog will end it); only an overlay that
  JavaScript never took over (already faded by its CSS failsafe) lets the backstop show the
  banner. If a live intro truly never ended, the banner would stay away for that page view: no
  choice means no analytics, and the next load asks again.
- **Escape is guarded.** A held key's auto-repeats are never an answer. After an intro that
  actually **played**, Escape is ignored for 700ms once the banner shows — the visitor was
  pressing Escape to skip the intro, and a quick second press must not store "rejected" for six
  months on a banner they have not seen. The buttons work at once.

## Ghid TBS (the guide)

IT-OS Phase 4 (2026-09-17). A small holographic cube droid, **"Ghid TBS" / "Гид TBS" / "TBS
Guide"**, in the bottom-right corner of **every site page** (home, the service pages, the legal
pages) once the visitor has done something. It is a guide to the existing request flow, not a
new chat: it never calls itself "AI", never answers questions itself, and promises nothing the
estimator does not already promise. Code: `components/hud/guide/*`, `lib/hud/linger.ts`, mounted
by `components/hud/HudChrome.tsx` ([03](./03-architecture.md#the-hud-chrome-it-os-phase-4-2026-09-17));
look: [04](./04-design-system.md#ghid-tbs--the-guide).

**When it is there.** Nothing renders — and nothing of it is downloaded — until the cookie
question is answered, the visitor has interacted (a pointer move, tap, wheel, scroll, key or focus
change; answering the banner counts), the intro overlay is gone and the browser has an idle slot.
QA and the E2E suite can switch it off with `localStorage.tbs_hud = "off"`.

**The avatar** is a real `<button aria-haspopup="dialog">` named "Ghid TBS: deschide asistentul
ghidat pentru cerere". Pressing it opens the **request dialog straight on the guided chat**
(`openAssistant`), focus inside the chat. Closing the dialog hands focus back to the avatar.

**The tip.** When one topic holds the viewport's **centre line for 5s of visible time** (a hidden
tab does not count), the droid pulses and a short tip appears above it. It takes no focus, has no
role and no live region (an unrequested tip must not interrupt a screen reader); it describes the
avatar (`aria-describedby`), so it is heard on the button. Buttons: **"Deschide ghidul"** (opens
the flow, like the avatar), **"Nu mai arăta în această vizită"** (no more tips until reload) and
**✕ "Închide sugestia"**. Escape inside the guide closes the tip; focus that was in it goes to the
avatar.

| Topic | Where | Tip (RO) |
|-------|-------|----------|
| `servicii` | the home page's `#servicii` | "Nu ești sigur ce direcție ți se potrivește? Ghidul pune câteva întrebări scurte și trimite echipei rezumatul." |
| `lucrari` | the home page's `#lucrari` | "Ai în minte un proiect asemănător? Descrie-l pas cu pas — îți răspundem în cel mult o zi lucrătoare." (the same reply time `SENT_COPY` promises) |
| `service` | a service page's "Cum lucrăm" steps (`DirectionPage`, `data-guide-topic="service"`) | "Vrei să vezi dacă direcția asta se potrivește proiectului tău? Ghidul te ajută să formulezi cererea." |

**Limits** (`GUIDE_LIMITS`):

- at most **2 tips per page lifetime**, each topic at most **once**, **60s** between two tips;
  a tip closed with ✕ still counts;
- no tip while the page is covered (the request dialog, the burger menu), the intro is on screen,
  the banner is waiting, the visitor is typing in a field, the request flow is open, the guide is
  away, or (from the OS phase on) the visitor is busy with a HUD window; the 5s wait simply starts over;
- a shown tip goes when its section leaves the centre line, the flow opens, the page is covered,
  or focus lands on something under the tip.

**Memory lasts the page lifetime.** It is one module variable: it **survives client navigation**
(home → a service page → back keeps the count and the opt-out) and resets on a reload. Nothing is
stored — no localStorage, no sessionStorage, no cookie.

**It steps aside.**

- **Away:** while the home page's own request form (`#estimare`) is in view, the avatar and tip
  fade to opacity 0, take no pointer and leave the tab order (that section *is* the guided flow).
- **Yield:** when keyboard focus lands on something the guide overlaps, it fades until focus moves
  on (WCAG 2.4.11).
- The dialog, the burger menu and the intro sit above it (z 112 < 115); nothing is hidden.

**What it sends.** Only what the visitor then submits in the request form, with the origin block
the estimator already writes:

- `- Serviciu: <slug>` — on a service page (a slug `lib/directions.ts` knows);
- `- Proiect: <name> (<id>)` — only when the tip or the centre line is on `#lucrari` and the
  project spiral has a front card (`data-helix-front`); otherwise no project;
- `- Secțiune: servicii | lucrari | service` — the topic on the centre line when it was opened;
- `- Sursă (CTA): guide` (the avatar) or `guide-prompt` (the tip's button).

Nothing is sent when the guide merely shows or a tip is dismissed: no analytics event, no request.

## The fibre rail

IT-OS Phase 5 (2026-09-17). A **neon fibre-optic line on the right edge** of every site page, at
**861px and wider**, next to the browser's own scrollbar — which stays the scrollbar (the client's
decision: the native scroll is kept). It shows how far down the page the visitor is and where the
page's sections are, and it jumps to one. Code: `components/hud/rail/*`, `lib/hud/rail.ts`,
mounted by `components/hud/HudChrome.tsx`
([03](./03-architecture.md#the-rails-wiring-it-os-phase-5-2026-09-17)); look:
[04](./04-design-system.md#the-fibre-rail).

**When it is there.** Like the guide: nothing renders or downloads until the cookie question is
answered, the visitor has interacted, the intro is gone and the browser has an idle slot — and
then only while the window is at least 861px wide. Narrowing the window below 861px removes it;
widening brings it back. `localStorage.tbs_hud = "off"` switches it off with the rest of the HUD.

**What it shows.** A faint core line from under the header (16px below it) down to 112px above the
bottom, just above the guide. A lit thread fills it with the scroll progress (top of the page →
empty, bottom → full), with a glowing head at its end and a short light streak that travels along
it **only while the page is scrolling**. One **diamond tick per section** sits where the thread
ends when that section is scrolled to (kept at least 44px apart): hollow ahead, lit once passed,
and it pulses once when a downward scroll passes it.

**The sections** (a real `<nav>` named **"Secțiunile paginii" / "Разделы страницы" / "Page
sections"**, one 44×44 button per tick; the label shows beside it on hover and keyboard focus):

| Page | Markers |
|------|---------|
| Home (`/`, `/ru`, `/en`) | **Început** (`#top`) · **Servicii** (`#servicii`, `nav.services`) · **Lucrări** (`#lucrari`, `nav.work`) · **Despre** (`#despre`, `nav.about`) · **Echipă** (`#echipa`, `nav.team`) · **Cerere** (`#estimare`) · **Contact** (`#contact`) — the header's own catalog words where the menu has them, `RAIL_COPY` for the other three |
| A service page | one per `section` named by its first `h1`/`h2`: 3 to 5 today (e.g. `/servicii/produs-digital`: "Produs digital", "Proiecte relevante", "Cum lucrăm", "Ai un proiect în minte?"; `/servicii/e-commerce` has 3) |
| `/cookies` | its 7 numbered headings ("01 Ce sunt cookie-urile" …) |
| `/confidentialitate` | 14 sections: **more than 8, so the fibre and ticks only, no `<nav>`** (a list of buttons that long is not a shortcut) |

Headings inside the header, the footer, a dialog, an `aria-hidden` subtree, the guide or the rail
never name a section, nor does a section holding more than one `h2` (a list of items). A label is
the heading's text, whitespace collapsed, at most 60 characters. The home list is used only when
all seven ids are on the page; a client navigation re-reads the sections.

**A marker jumps.** Clicking one scrolls its section to just under the header — smoothly, or
instantly under reduced motion — and that marker becomes the current one (`aria-current="true"`,
a short lit streak beside it). The current marker is the last section the scroll has reached.

**Keyboard.** The buttons are real tab stops, **after the footer** (and after the guide) in the
tab order, so the header's tab budget and the intro's "skip is the first Tab stop" hold.
**Enter or Space** jumps like a click and also **moves focus to the section** (a temporary
`tabindex="-1"`, removed when focus leaves it), so the next Tab continues inside that section. A
mouse click never moves focus. Every button shows a 2px focus ring and its label.

**It stays out of the way.** The column takes no pointer events except its 44×44 buttons. The
fibre and the markers are inset by **half a marker (22px)** at both ends of the column, so every
44×44 button stays inside it — clear of the header above and of the guide's avatar box below. It sits under
the guide, the burger menu, the request dialog and the intro (z 104). While the dialog or the burger
covers the page it holds still and re-measures when they close. It never blocks or takes over
scrolling (only passive listeners), writes nothing on `<html>` or `<body>`, stores nothing and
sends nothing. It re-measures as the page grows — images and fonts arriving, Work's project spiral
lengthening its track — so the ticks stay on their sections. Between 861 and about 1,100px the
page's side gutter (`clamp(16px, 4vw, 40px)`) is narrower than the 44px column, so the buttons'
hit areas reach a few pixels over the right edge of full-width content there.

**Under reduced motion** the rail is static: no travelling streak, no pulse, no fades; the thread
still follows the scroll position, and a jump is instant.

**Below 861px there is no rail.** The 2px top progress bar is the fibre there: a thread lighting
up in Neon Cyan towards an 18×2px glowing head. From 861px the top bar keeps its old gradient until
the rail appears, and is hidden while the rail is on the page — a visitor who has not interacted
(or with the HUD off) still sees progress.

## Legal pages

`/confidentialitate` and `/cookies` — outside the landing scroll, same chrome, linked from
the footer and the consent banner.

## Admin panel

Built and live at `/admin-tbs-digital` — a login-gated, tabbed editor backed by the API.
See [09 — Admin Panel](./09-admin.md).
