/**
 * Writes into the interior stage's `ScrollProbe` — the plain object the director fills at
 * every ScrollTrigger refresh and the scene reads every frame (lib/scene.ts). Kept out of the
 * components on purpose: the React Compiler lint forbids mutating a value a component received,
 * and these mutations are the whole point.
 *
 * Nothing here runs per frame: a refresh happens on mount, on a resize, when the page's
 * height changes and on a bfcache restore (and the boxes alone when the scene's Work spiral
 * changes the track's height: `SCENE_LAYOUT_EVENT`). Existing boxes are updated in place.
 */

import type { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  SCENE_ANCHOR_ATTR,
  SCENE_LAYER_ATTR,
  WORK_ID,
  WORK_TRACK_ATTR,
  type DocRect,
  type ScrollProbe,
  type ScrollSpan,
} from "@/lib/scene";

/** What a span is read from: a ScrollTrigger's measured positions. */
type MeasuredTrigger = Pick<ScrollTrigger, "start" | "end">;

function writeSpan(span: ScrollSpan, st: MeasuredTrigger): void {
  span.start = Number.isFinite(st.start) ? st.start : 0;
  span.end = Number.isFinite(st.end) ? st.end : 0;
}

/** `heroExit`: `#top`, "top top" → "bottom 35%". */
export function writeHeroSpan(probe: ScrollProbe, st: MeasuredTrigger): void {
  writeSpan(probe.heroExit, st);
}

/** `entry`: the services anchor, "top 90%" → "top 75%" (the entry gate's hysteresis band). */
export function writeEntrySpan(probe: ScrollProbe, st: MeasuredTrigger): void {
  writeSpan(probe.entry, st);
}

/** `workSpan`: Work's track, "top 70%" → "top 55%" (the work gate's hysteresis band). */
export function writeWorkSpan(probe: ScrollProbe, st: MeasuredTrigger): void {
  writeSpan(probe.workSpan, st);
}

/**
 * `helix`: Work's track, "top top" → "bottom bottom", its start moved up by the header's height
 * (`headerH`, px) — the sticky zone starts under the header, not under the viewport's top. The
 * end is ScrollTrigger's: never before its own start, so a track shorter than the viewport (the
 * phone's band, which never spirals) ends at its top.
 */
export function writeHelixSpan(probe: ScrollProbe, st: MeasuredTrigger, headerH: number): void {
  writeSpan(probe.helix, st);
  if (Number.isFinite(st.start)) probe.helix.start -= Number.isFinite(headerH) ? headerH : 0;
}

/** `el`'s border box in document pixels, into `into` when there is one; null without `el`. */
function docRect(el: Element | null, into: DocRect | null): DocRect | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const rect = into ?? { x: 0, y: 0, w: 0, h: 0 };
  rect.x = box.left + window.scrollX;
  rect.y = box.top + window.scrollY;
  rect.w = box.width;
  rect.h = box.height;
  return rect;
}

/**
 * The free band above Work's heading (`probe.workGap`), into `into` when there is one: `section`'s
 * width, from the end of the previous section's content (its bottom less its computed bottom
 * padding; the section's own top without one) down to `headTop`, the heading's document top with
 * its reveal offset already taken out. Never negative. Null without a section or a heading.
 */
function gapAbove(section: Element | null, headTop: number | null, into: DocRect | null): DocRect | null {
  if (!section || headTop === null) return null;
  const box = section.getBoundingClientRect();
  let top = box.top + window.scrollY;
  const previous = section.previousElementSibling;
  if (previous) {
    const pad = Number.parseFloat(window.getComputedStyle(previous).paddingBottom);
    top = Math.min(top, previous.getBoundingClientRect().bottom + window.scrollY - (Number.isFinite(pad) ? pad : 0));
  }
  const rect = into ?? { x: 0, y: 0, w: 0, h: 0 };
  rect.x = box.left + window.scrollX;
  rect.y = Math.min(top, headTop);
  rect.w = box.width;
  rect.h = Math.max(0, headTop - rect.y);
  return rect;
}

/** The offset a sticky box pins at (its computed `top`), 0 when that is not a pixel length. */
function stickyTop(el: Element): number {
  const top = Number.parseFloat(window.getComputedStyle(el).top);
  return Number.isFinite(top) ? top : 0;
}

/**
 * The steps host (`probe.steps`) and the scroll it is pinned over (`probe.stepsPin`).
 *
 * A sticky box measured while it is pinned says nothing about where it lies unstuck — its
 * `getBoundingClientRect` and its `offsetTop` both carry the sticky shift — so the last reading
 * taken while it was still free is kept, and the first refresh happens at the top of the page,
 * where it always is. With none ever taken, the top of the band it is sticky in stands in: its
 * parent, which is its containing block and is never sticky itself.
 */
export function writeStepsHost(probe: ScrollProbe, el: HTMLElement | null): void {
  const rested = probe.steps ? probe.steps.y : Number.NaN;
  probe.steps = docRect(el, probe.steps);
  // No host, or one with no box at all: the same thing, and the same answer — the model stays on
  // the hero host. The steps column collapses to 0×0 on a page that will never draw a model
  // (`fallback` / `off`), and a zero-wide host would scale one to nothing.
  if (!el || !probe.steps || probe.steps.w <= 0 || probe.steps.h <= 0) {
    probe.steps = null;
    probe.stepsPin.start = 0;
    probe.stepsPin.end = 0;
    return;
  }
  const stick = stickyTop(el);
  // Its band is its containing block: the parent's CONTENT box — the padding is outside it, and a
  // grid item spanning every row (which is what a corner beside a two-row section is) fills it.
  const parent = el.parentElement;
  const band = parent ? parent.getBoundingClientRect() : null;
  const pad = parent ? window.getComputedStyle(parent) : null;
  const padTop = pad ? Number.parseFloat(pad.paddingTop) : 0;
  const padBottom = pad ? Number.parseFloat(pad.paddingBottom) : 0;
  const bandTop = band ? band.top + window.scrollY + (Number.isFinite(padTop) ? padTop : 0) : probe.steps.y;
  const bandBottom = band
    ? band.bottom + window.scrollY - (Number.isFinite(padBottom) ? padBottom : 0)
    : probe.steps.y + probe.steps.h;
  const free = probe.steps.y > window.scrollY + stick + 1;
  if (!free) probe.steps.y = Number.isFinite(rested) ? rested : bandTop;
  probe.stepsPin.start = probe.steps.y - stick;
  probe.stepsPin.end = Math.max(probe.steps.y, bandBottom - probe.steps.h) - stick;
}

/**
 * The y translation of a computed `transform` (`matrix(…)` / `matrix3d(…)`), 0 for `none` or
 * anything else — a scroll reveal (`[data-reveal]`: `translateY(28px)` until it is in view)
 * moves a box without moving its place on the page.
 */
export function translateYOf(transform: string): number {
  const match = /^matrix(3d)?\(([^)]*)\)$/.exec(transform.trim());
  if (!match) return 0;
  const values = match[2].split(",").map((part) => Number.parseFloat(part));
  const ty = match[1] ? values[13] : values[5];
  return Number.isFinite(ty) ? ty : 0;
}

/**
 * `--header-h` in px: the custom property when it is a plain pixel length, otherwise the sticky
 * layer's resolved `top` (which is `var(--header-h)`), otherwise 0.
 */
export function readHeaderHeight(stage: HTMLElement): number {
  const styles = window.getComputedStyle(document.documentElement);
  const raw = styles.getPropertyValue("--header-h").trim();
  if (/^-?\d*\.?\d+px$/.test(raw)) return Number.parseFloat(raw);
  const layer = stage.querySelector(`[${SCENE_LAYER_ATTR}]`);
  const top = layer ? Number.parseFloat(window.getComputedStyle(layer).top) : Number.NaN;
  return Number.isFinite(top) ? top : 0;
}

/**
 * Everything but the spans: the stage's top and bottom, the sticky layer's height, both
 * anchors' boxes and Work's track, heading and the band above it (null while one is not in the
 * page), the header height — then `version++` and `live`. Call it after the spans, at the end of
 * a refresh.
 */
export function writeAnchors(probe: ScrollProbe, stage: HTMLElement): void {
  const box = stage.getBoundingClientRect();
  probe.stage.top = box.top + window.scrollY;
  probe.stage.bottom = box.bottom + window.scrollY;
  const layer = stage.querySelector(`[${SCENE_LAYER_ATTR}]`);
  probe.layerH = layer ? layer.getBoundingClientRect().height : 0;
  probe.hero = docRect(stage.querySelector(`[${SCENE_ANCHOR_ATTR}="hero"]`), probe.hero);
  probe.services = docRect(stage.querySelector(`[${SCENE_ANCHOR_ATTR}="services"]`), probe.services);
  writeStepsHost(probe, stage.querySelector<HTMLElement>(`[${SCENE_ANCHOR_ATTR}="steps"]`));
  const track = stage.querySelector(`[${WORK_TRACK_ATTR}]`);
  probe.work = docRect(track, probe.work);
  const head = track?.previousElementSibling ?? null;
  probe.workHead = docRect(head, probe.workHead);
  if (head && probe.workHead) probe.workHead.y -= translateYOf(window.getComputedStyle(head).transform);
  probe.workGap = gapAbove(track?.closest(`#${WORK_ID}`) ?? null, probe.workHead?.y ?? null, probe.workGap);
  probe.headerH = readHeaderHeight(stage);
  probe.version += 1;
  probe.live = true;
}

/** The director is gone: nothing in the probe is being kept up to date any more. */
export function releaseProbe(probe: ScrollProbe): void {
  probe.live = false;
}
