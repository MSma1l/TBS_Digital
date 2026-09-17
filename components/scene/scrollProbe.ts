/**
 * Writes into the interior stage's `ScrollProbe` — the plain object the director fills at
 * every ScrollTrigger refresh and the scene reads every frame (lib/scene.ts). Kept out of the
 * components on purpose: the React Compiler lint forbids mutating a value a component received,
 * and these mutations are the whole point.
 *
 * Nothing here runs per frame: a refresh happens on mount, on a resize, when the page's
 * height changes and on a bfcache restore. Existing boxes are updated in place.
 */

import type { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCENE_ANCHOR_ATTR, SCENE_LAYER_ATTR, type DocRect, type ScrollProbe, type ScrollSpan } from "@/lib/scene";

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

/** `handoff`: the services anchor, "top 95%" → "center 55%". */
export function writeServicesSpan(probe: ScrollProbe, st: MeasuredTrigger): void {
  writeSpan(probe.handoff, st);
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
 * `--header-h` in px: the custom property when it is a plain pixel length, otherwise the sticky
 * layer's resolved `top` (which is `var(--header-h)`), otherwise 0.
 */
function readHeaderHeight(stage: HTMLElement): number {
  const styles = window.getComputedStyle(document.documentElement);
  const raw = styles.getPropertyValue("--header-h").trim();
  if (/^-?\d*\.?\d+px$/.test(raw)) return Number.parseFloat(raw);
  const layer = stage.querySelector(`[${SCENE_LAYER_ATTR}]`);
  const top = layer ? Number.parseFloat(window.getComputedStyle(layer).top) : Number.NaN;
  return Number.isFinite(top) ? top : 0;
}

/**
 * Everything but the spans: the stage's top and bottom, both anchors' boxes (null while an
 * anchor is not in the page), the header height — then `version++` and `live`. Call it after
 * the spans, at the end of a refresh.
 */
export function writeAnchors(probe: ScrollProbe, stage: HTMLElement): void {
  const box = stage.getBoundingClientRect();
  probe.stage.top = box.top + window.scrollY;
  probe.stage.bottom = box.bottom + window.scrollY;
  probe.hero = docRect(stage.querySelector(`[${SCENE_ANCHOR_ATTR}="hero"]`), probe.hero);
  probe.services = docRect(stage.querySelector(`[${SCENE_ANCHOR_ATTR}="services"]`), probe.services);
  probe.headerH = readHeaderHeight(stage);
  probe.version += 1;
  probe.live = true;
}

/** The director is gone: nothing in the probe is being kept up to date any more. */
export function releaseProbe(probe: ScrollProbe): void {
  probe.live = false;
}
