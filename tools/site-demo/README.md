# The portfolio screen's interactive demos

`/portofoliu`'s monitor shows a project's own site, and the visitor can press its links and
buttons: a link to another page of the demo switches the screen to that page, an in-page link
scrolls, and anything that needs the real site — a form, a login, a test, a chat, a gallery —
asks them to open it. The contract is `lib/siteDemo.ts`. These scripts make what it reads, from
the live sites, and nothing in `public/projects/demo/` is meant to be edited by hand.

For each site in `config.mjs` they write:

| file | what it is |
|---|---|
| `public/projects/demo/<project>/demo.json` | the manifest: the pages, each with a desktop and a phone shot and the hotspots over them |
| `public/projects/<x>-site.webp` | the start page on a desktop — also the project's `fullPage`, so the plain scroll-through and the demo show the same picture |
| `public/projects/demo/<project>/<page>-d.webp` | every other page on a desktop: 1440 × H CSS px, saved 1080 px wide |
| `public/projects/demo/<project>/<page>-m.webp` | every page on a phone: 390 × H CSS px at dpr 2, saved 780 px wide |

Hotspot rectangles are in the layout's CSS px (`w` 1440 or 390), WebP quality 80.

## Running it

It runs on the host, not in Docker: it needs Edge or Chrome and the real GPU. Node 22+ (it talks
to the browser over the DevTools protocol with Node's own `WebSocket`); no `npm install`.

```sh
node tools/site-demo/capture.mjs bizcheck          # both layouts, every page, then publish
node tools/site-demo/capture.mjs cgam --only=liga --layout=phone
node tools/site-demo/capture.mjs cgam --build-only # no browser: rebuild demo.json from the stored passes
node tools/site-demo/preview.mjs cgam              # draw the hotspots over the pictures, to look at them
node tools/site-demo/validate.mjs                  # every demo.json, through lib/siteDemo.ts's rules
```

- `--check` also proves the alignment (below) — a few seconds more per page; the published
  captures were all made with it.
- `--no-publish` builds and reports but leaves `public/` alone; `preview.mjs <site> --unpublished`
  then draws what *would* be published.
- `SITE_DEMO_BROWSER=<path>` picks the browser; `SITE_DEMO_GPU=soft` forces SwiftShader (slow:
  the tall captures stall without a GPU).

One headless browser runs at a time, in a throwaway profile that is deleted when it closes
(Ctrl+C closes it too). The working files — one *pass* per page and layout, `build.json` with the
reason behind every hotspot, the previews — go to `.work/site-demo/<project>/`, which git ignores.

### How long it takes

The published runs (2026-10-06): the real GPU, both layouts, with `--check`:

| site | pages | time |
|---|---|---|
| itara-global | 1 | ~3 min |
| balloons-breeze | 1 | ~5½ min (desktop 3½, phone 2) |
| bizcheck | 3 | ~6½ min |
| cgam | 6 | ~15 min (~12 without `--check`) |

Most of it is the probe — every button pressed on a fresh load — and, on balloonsbreeze, the
balloon layer (a frame every 2.5 s down the page).

## A capture and its hotspots go together

A rectangle is only right on the picture it was measured on. So the survey of the controls is
taken in the same layout pass as the capture, at the same scroll, with the same fixes in, right
before it; and a pass stores the capture with a hash of it. The build refuses a pass whose
picture is not the one hashed. **When a site changes, run its capture again** — never swap a
picture in by hand, and never re-run the survey without the capture. A `fullPage` file made
any other way would carry hotspots that point at nothing.

## What a run does, and why

**Romanian.** Romanian request headers and locale, then the site's own switch: bizcheck and
balloonsbreeze keep the choice in local storage (their RO control on a desktop; the stored value
on a phone, where the control hides in a menu), followed by a reload. A run stops if the page is
not Romanian (the site's own headline, Romanian diacritics, no Cyrillic in the menu or headings).

**The same visitor every time.** The cookie banner is refused once, an intro is skipped, and that
state — cookies and local storage — is saved. Every later load starts from it: a test the probe
advanced or a tab it switched never carries into the next page.

**A page that did not load is not a page.** A load that ends on the browser's own error screen
("This page can't be opened" — a network hiccup did exactly that to two cgam pages) or on an
HTTP error is tried twice more; then that page fails, the run says so, and nothing is published.

**Writes are blocked — the page's own.** Every request of the page being captured (its document
and its frames on the same site) that is not GET, HEAD or OPTIONS is failed before it leaves.
bizcheck creates a record the moment a test starts, and the probe presses "Începe testul", "Lasă o
recenzie", "Primește o ofertă". JavaScript dialogs are dismissed, downloads refused. What it does
**not** cover: a new tab a press opens (cgam's cookie-policy link, a t.me link) loads unguarded
until the probe closes it, after its wait; a cross-site frame (a chat widget), a worker and a
WebSocket are not intercepted at all. The probe never types, and the four sites are the studio's
own clients'; a site that writes on a page load or from a widget would need the blocking to
follow every target (`Target.setAutoAttach`) first.

**The picture.** A slow scroll to the bottom and back (lazy images, reveal-on-scroll), every
image decoded, then:
- floaters hidden — chat bubbles, music and back-to-top buttons, a phone's bottom bar: anything
  fixed in the lower half of the screen. A capture paints a fixed element where it sits at
  scroll 0, so it would hang in the middle of the first screen;
- fixed backgrounds rebuilt (`fixes.mjs`) — a full-screen fixed layer only paints the first
  screen of a capture, so it is captured on its own and stacked down the page as tiles. cgam's
  wrapper clips the copy, so a second copy goes under everything; balloonsbreeze's sky and
  balloons are captured apart, so no balloon is cut or doubled;
- animations finished and frozen, slideshows stopped (balloonsbreeze), the pointer parked so
  nothing is hovered.

Long pages are cut: 9000 CSS px on a desktop, 8000 on a phone (which keeps a phone picture
under WebP's 16 383 px limit). A cut shot has `cut: true`, and its end offers the real site.

**The header that stays.** A full-width fixed (or sticky) element at the top that is still there
after a real scroll is the shot's `fixed` band: the screen keeps it pinned, buttons and all.

**What each control does** (`probe.mjs`). Every control is pressed for real on a fresh load and
watched: a route, a load, a new tab, a dialog, a scroll, a carousel, an ARIA state, changed
content, a focused field — or nothing. An href is not enough: on bizcheck most of the controls
that open another page are `<a href="/">` with a click handler, and cgam's "Liga" is an `<a>`
without one that scrolls by script. Look-alike controls in a big group (19 gallery tiles) are
pressed twice; the rest go by their siblings. When changed text is all a press showed, the same
wait is repeated on a fresh load with nothing pressed: if the text changes anyway (a typed-out
headline, a slideshow), a bare `cursor: pointer` element is taken for a decoration, while a real
link, button or click handler still counts. A control is found again on its fresh load by the
path the survey recorded; failing that, by its words, but only near where it was — half a screen
at most, and never one without words: a gallery whose caption rotated onto another "21 Марта"
once borrowed that card's route. A control found by its words is noted in `build.json`.

**What it becomes** (`build.mjs`):
- `page` — it opens another page of the demo; bizcheck's `?tab=` routes open the home page where
  the live site lands (config `fold`);
- `anchor` — an in-page link or a script scroll, at the y the live site really lands on;
- `site` — everything else that does something: forms and fields, logins, tests, dialogs, chat,
  lightboxes, carousels, tabs, language buttons, phone and e-mail links, other sites, pages
  outside the demo. `path` is the page it would open, or the page it is on;
- nothing — a control that did nothing (a disabled one, a card with a pointer cursor and no
  handler) is left out.

**Labels** are the control's visible text (a long card goes by its heading), a field's label, an
icon's aria-label or title, else an honest description of where it leads ("Telegram",
"Telefon"); `config.mjs` names the few that have nothing at all. An e-mail or phone number stays
in a label only if it is the business's own public contact (`contacts`); anything else becomes
"E-mail" / "Telefon" — looked for in the whole text, before a long label is cut.

**What the pictures may not show** (config `redact`). A label is text the build controls; a
picture shows whatever the live page shows, and some of it is not ours to republish: cgam's league
lists its players by name and points, its event photo shows the participants' faces, and its IQ
Arena mockup signs in with a real address. A `redact` rule, applied after the scroll-through and
before anything is measured or captured:
- `blur` — a selector blurred (`px`, 6 by default; a stylesheet, so a re-render keeps it). A CSS
  filter changes paint, never layout: the hotspots stay where they were measured;
- `text` / `with` — a text replaced in the page and in every field, and kept replaced whatever the
  page renders later (a mutation observer); checked again once the capture is taken;
- `on` — the pages it applies to (all by default); `must` — the pages it has to reach: a rule
  that reaches nothing there stops that page, and nothing is published — the site changed under it.
The run prints what each rule reached ("redacted: … ×62"). Reviews a site publishes as such keep
their authors' names.

**The manifest** must pass `lib/siteDemo.ts` untouched — `manifest.mjs` is a port of its rules.
A hotspot the parser would drop is left out with a note in `build.json`; a page or a path it would
change stops the build. Keep the port in step with `lib/siteDemo.ts` and `isLink` in
`lib/validation.ts`.

## The alignment proof (`--check`)

The controls are outlined in the page — a 3 px magenta outline drawn inside the box, which
changes paint and never layout — and captured again; each predicted edge is matched to the
nearest edge of what changed. Three traps, each of which fakes an error:
- a site-wide CSS `filter` recolours the magenta (cgam), so the edge is any strong change against
  the plain capture, not a colour;
- Tailwind's `transition-all` animates `outline-offset` — frozen animations leave it at 0 — so the
  outline gets `transition: none`;
- touching icons merge their outlines, so neighbours closer than 4 px go in different passes.

Errors are in capture px (0.75 per CSS px on a desktop, 2 on a phone). Typical: median ~0.5,
max ~1.5 on a desktop.

## Adding a site or a page

Add it to `config.mjs`: the project id from `lib/content.ts`, the origin, the start shot, how
the site turns Romanian, the pages (start page first, ids `a-z0-9-`, at most 12), and `redact` for
whatever its pages show of people. Then:
- the project's `demo` (`/projects/demo/<project>/demo.json`) in `lib/content.ts` and
  `backend/app/defaults.py` — an existing database got the shipped ones once, so set it in the
  admin too ("Demo interactiv");
- its `fullPage` must be the start shot (`startShot`): the screen leaves out the start page's
  hotspots over any other picture.
Run the capture, look at the previews, read the `notes` of every page in `build.json` (an unnamed
control, a redacted contact, a control found again by its words), then commit the files under
`public/`.
