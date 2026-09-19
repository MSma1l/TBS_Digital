/**
 * The Work hologram's texture: the front project card, composed from its own DOM on a small
 * Canvas2D — its screenshot as luminance under scanlines, its tag chips, its name, its index and
 * bracket corners — and uploaded as one `CanvasTexture` (models/helix.ts draws it, SURFACE_MODE.holo:
 * red = luminance, alpha = coverage).
 *
 * Privacy and CSP by construction:
 *   · no loader, no fetch, no blob: only the card's own `<img>`, and only when it is same-origin and
 *     has decoded within `HOLOGRAM.decodeMs`. A canvas that still turns out tainted is caught
 *     (`getImageData` throws) and redrawn text-only before the texture is flagged, so three never
 *     throws a SecurityError mid-frame;
 *   · every string is DOM `textContent` drawn with `fillText` / `strokeText`: nothing is parsed;
 *   · the canvas is never larger than `HOLOGRAM_MAX` (the high tier's 384 × 240) and the
 *     screenshot band is drawn in `HOLOGRAM.cell`-px cells, so a screenshot's fine print (the
 *     Flirt card's sign-up e-mail) is not legible on it.
 *
 * Drawing waits for an idle slot and never runs while no card is asked for.
 */

import { CanvasTexture, LinearFilter, NoColorSpace } from "three";
import { SCENE_TIER_CONFIG } from "../tiers";

/** The largest hologram texture any tier draws (px). */
export const HOLOGRAM_MAX: readonly [number, number] = SCENE_TIER_CONFIG.high.hologram;

/**
 * Layout, as shares of the canvas or px at 240 tall: the screenshot band's height, its scanline
 * pitch and cell size, how long a decode may take, the edge padding, the type sizes.
 */
export const HOLOGRAM = {
  band: 0.62,
  scanEvery: 3,
  cell: 2,
  decodeMs: 1500,
  pad: 12,
  title: 24,
  titleMin: 12,
  chip: 11,
  index: 30,
  bracket: { arm: 14, inset: 4, width: 2 },
} as const;

/** `size` in whole px, at least 16 × 10, never above `HOLOGRAM_MAX`. */
export function clampHologramSize(size: readonly [number, number]): [number, number] {
  const fit = (value: number, max: number, min: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : max;
  return [fit(size[0], HOLOGRAM_MAX[0], 16), fit(size[1], HOLOGRAM_MAX[1], 10)];
}

/** Whitespace collapsed, trimmed. */
const textOf = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();

function upper(text: string): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  try {
    return text.toLocaleUpperCase(lang || undefined);
  } catch {
    return text.toUpperCase();
  }
}

/** A font shorthand from `element`'s computed family (and weight, unless one is given). */
function fontOf(element: Element | null, px: number, weight?: string): string {
  const style = element ? getComputedStyle(element) : null;
  const family = style?.fontFamily || "sans-serif";
  return `${weight ?? (style?.fontWeight || "700")} ${Math.max(1, Math.round(px))}px ${family}`;
}

/** The card's screenshot, if it may be drawn: same-origin, decoded in time, with a size. */
async function usableImage(card: HTMLElement): Promise<HTMLImageElement | null> {
  const img = card.querySelector("img");
  const src = img ? img.currentSrc || img.src : "";
  if (!img || !src) return null;
  try {
    if (new URL(src, location.href).origin !== location.origin) return null;
  } catch {
    return null;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const decoded =
      typeof img.decode === "function"
        ? await Promise.race([
            img.decode().then(() => true),
            new Promise<boolean>((resolve) => {
              timer = setTimeout(() => resolve(false), HOLOGRAM.decodeMs);
            }),
          ])
        : img.complete;
    if (!decoded) return null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  return img.naturalWidth > 0 && img.naturalHeight > 0 ? img : null;
}

/** The screenshot, object-cover and top-aligned, as luminance in the band; scanlines over it. */
function drawImageBand(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, band: number): void {
  const cell = ctx.canvas ? HOLOGRAM.cell : 1;
  const cw = Math.max(1, Math.round(w / cell));
  const ch = Math.max(1, Math.round(band / cell));
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const sw = cw / scale;
  const sh = ch / scale;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, band);
  // Luminosity over black: the image's lightness, none of its hue.
  ctx.globalCompositeOperation = "luminosity";
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, 0, sw, sh, 0, 0, cw, ch);
  ctx.globalCompositeOperation = "source-over";
  if (cell > 1) {
    // Up from the cells: the fine print is gone before it is ever at full size.
    ctx.drawImage(ctx.canvas, 0, 0, cw, ch, 0, 0, w, band);
  }
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  for (let y = 0; y < band; y += HOLOGRAM.scanEvery) ctx.fillRect(0, y, w, 1);
}

/** The largest size ≤ `px` (not below `min`) at which `text` fits `room`; then truncated if it still does not. */
function fitText(ctx: CanvasRenderingContext2D, text: string, room: number, px: number, min: number, font: (px: number) => string): string {
  let size = px;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > room) {
    size -= 1;
    ctx.font = font(size);
  }
  if (ctx.measureText(text).width <= room) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > room) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Compose `card` into `ctx` (the top-left `size`, clamped to `HOLOGRAM_MAX`): the screenshot band
 * when its image may be used, then the chips (`small > span`, the "·" joints skipped), the name
 * (the `h3`, 900 weight, upper case), the index `index + 1` as two digits and the bracket corners,
 * in the card's own computed fonts. Resolves which it drew; never rejects on a tainted canvas.
 */
export async function composeHologram(
  card: HTMLElement,
  ctx: CanvasRenderingContext2D,
  size: readonly [number, number],
  index: number,
): Promise<"image" | "text"> {
  const img = await usableImage(card);
  const [w, h] = clampHologramSize(size);
  const s = h / 240;
  const band = Math.round(h * HOLOGRAM.band);
  const pad = Math.round(HOLOGRAM.pad * s);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);

  let result: "image" | "text" = "text";
  if (img) {
    drawImageBand(ctx, img, w, band);
    result = "image";
    // The one readback of a compose, and only after a screenshot: a single pixel.
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      result = "text";
    }
  }

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.textAlign = "left";

  /* the index, outlined like the card's */
  const heading = card.querySelector("h3");
  ctx.font = fontOf(heading, HOLOGRAM.index * s, "800");
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.lineWidth = 1;
  const position = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  ctx.strokeText(String(position + 1).padStart(2, "0"), w - pad, pad);
  ctx.textAlign = "left";

  /* the chips */
  const chips = Array.from(card.querySelectorAll("small > span"))
    .map((span) => ({ span, text: textOf(span) }))
    .filter(({ text }) => /[\p{L}\p{N}]/u.test(text));
  if (chips.length > 0) {
    const px = HOLOGRAM.chip * s;
    ctx.font = fontOf(chips[0].span, px);
    ctx.textBaseline = "middle";
    const boxH = Math.round(px + 8 * s);
    const inner = Math.round(5 * s);
    const y = band + Math.round(8 * s);
    let x = pad;
    for (const { text } of chips) {
      const label = upper(text);
      const boxW = Math.ceil(ctx.measureText(label).width) + 2 * inner;
      if (x + boxW > w - pad) break;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);
      ctx.fillText(label, x + inner, y + boxH / 2);
      x += boxW + Math.round(4 * s);
    }
  }

  /* the name */
  const name = upper(textOf(heading));
  if (name) {
    const font = (px: number) => fontOf(heading, px, "900");
    const label = fitText(ctx, name, w - 2 * pad, Math.round(HOLOGRAM.title * s), Math.round(HOLOGRAM.titleMin * s), font);
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, pad, h - Math.round(14 * s));
  }

  /* bracket corners */
  const arm = Math.round(HOLOGRAM.bracket.arm * s);
  const inset = Math.round(HOLOGRAM.bracket.inset * s);
  ctx.lineWidth = Math.max(1, Math.round(HOLOGRAM.bracket.width * s));
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ] as const) {
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy);
  }
  ctx.stroke();

  return result;
}

/**
 * The laptop screen's layout (`composeLaptopScreen`), as px at 240 tall — the canvas is scaled by
 * `h / 240`, so every number here is a share of the same picture at every tier.
 *
 * Why there are two layouts and not one: the Work helix's hologram is a 1.6 x 1.0 plane hanging
 * beside a molecule, read at a glance while the cards spiral past; the laptop's is a DISPLAY, read
 * the way a screen is read. `composeHologram` stays exactly as Work shipped it, and this is a
 * second layout over the same pipeline — the same canvas cap, the same privacy rules, the same
 * helpers.
 */
export const LAPTOP_SCREEN_LAYOUT = {
  /** The title bar across the head, and the screenshot band's foot as a share of the height. */
  bar: 26,
  band: 0.54,
  pad: 13,
  /** The footer that carries the call and the reel's ticks. */
  foot: 26,
  name: 30,
  nameMin: 15,
  desc: 12.5,
  descLead: 16,
  descLines: 2,
  tag: 10.5,
  index: 11,
  cta: 11,
  node: 8,
  tick: { w: 3, h: 8, gap: 4 },
  bracket: { arm: 16, inset: 5, width: 2 },
} as const;

/**
 * The grid states the call in the visitor's own language (DirectionPage.tsx writes them; nothing
 * here is a hardcoded string in one language, docs/16-i18n-seo.md). A card that is an `<a>` has a
 * public page behind it and takes the first; anything else takes the second, which says so rather
 * than promising a link that is not there.
 */
export const CTA_ATTR = { link: "data-cta-link", private: "data-cta-private" } as const;

/** `text` wrapped to at most `lines` lines of `room` px, the last one ellipsised. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, room: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= room || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = word;
    if (out.length === lines) break;
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === 0) return out;
  // Anything that did not fit is said with an ellipsis rather than cut mid-word off the edge.
  const used = out.join(" ");
  if (used.replace(/\s+/g, " ") !== words.join(" ")) {
    let last = out[out.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > room) last = last.slice(0, -1);
    out[out.length - 1] = `${last.trimEnd()}…`;
  }
  return out;
}

/** How many cards the grid holds, and which one this is: read off the card's own siblings. */
function cardPlace(card: HTMLElement, index: number): { index: number; total: number } {
  const parent = card.parentElement;
  const cards = parent
    ? Array.from(parent.children).filter((node) => node.tagName === "A" || node.tagName === "ARTICLE")
    : [];
  const at = cards.indexOf(card);
  const total = cards.length;
  return { index: at >= 0 ? at : Math.max(0, Math.floor(index)), total: total > 0 ? total : 1 };
}

/**
 * Compose `card` as a laptop DISPLAY: a title bar with the project's tag and its place in the
 * reel, the screenshot as the backdrop, then the project's name and two lines of its description,
 * and a footer with the call and one tick per project.
 *
 * **This is how the screen was made legible, and it is the opposite of more pixels.** The canvas
 * stays capped at `HOLOGRAM_MAX` (384 x 240) and the screenshot stays drawn in `HOLOGRAM.cell`-px
 * cells, because that cap is the only reason a real e-mail address in a screenshot is not readable
 * off a 3D display. Text, though, is written into the same canvas with `fillText` at its native
 * resolution — so the words are crisp exactly where the downscaled screenshot is mush, and what a
 * visitor can read is what the page chose to say, never what a screenshot happened to contain.
 */
export async function composeLaptopScreen(
  card: HTMLElement,
  ctx: CanvasRenderingContext2D,
  size: readonly [number, number],
  index: number,
): Promise<"image" | "text"> {
  const L = LAPTOP_SCREEN_LAYOUT;
  const img = await usableImage(card);
  const [w, h] = clampHologramSize(size);
  const s = h / 240;
  const px = (value: number) => Math.round(value * s);
  const pad = px(L.pad);
  const bar = px(L.bar);
  const band = Math.round(h * L.band);
  const foot = px(L.foot);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);

  let result: "image" | "text" = "text";
  if (img) {
    drawImageBand(ctx, img, w, band);
    result = "image";
    // The one readback of a compose, and only after a screenshot: a single pixel.
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      result = "text";
    }
  }

  /* the title bar, washed over the top of the screenshot so its words read */
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  const heading = card.querySelector("h3");
  const place = cardPlace(card, index);

  /* the node mark: a square ring, the house glyph — never a dot */
  const node = px(L.node);
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, Math.round((bar - node) / 2) + 0.5, node - 1, node - 1);

  /* the tag */
  const tagEl = card.querySelector("small");
  const tag = upper(textOf(tagEl));
  ctx.font = fontOf(tagEl, L.tag * s, "700");
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  if (tag) {
    const room = w - 2 * pad - node - px(8) - px(52);
    ctx.fillText(fitText(ctx, tag, room, L.tag * s, L.tag * s, (size_) => fontOf(tagEl, size_, "700")), pad + node + px(8), bar / 2);
  }

  /* its place in the reel, as two digits over two */
  ctx.font = fontOf(heading, L.index * s, "700");
  ctx.textAlign = "right";
  ctx.fillText(
    `${String(place.index + 1).padStart(2, "0")} / ${String(place.total).padStart(2, "0")}`,
    w - pad,
    bar / 2,
  );

  /* the rule under the bar, and the one under the screenshot */
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, bar, w, 1);
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, band, w, 1);
  ctx.globalAlpha = 1;

  /* the name */
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const name = upper(textOf(heading));
  let y = band + px(10) + px(L.name);
  if (name) {
    const font = (value: number) => fontOf(heading, value, "900");
    ctx.fillText(fitText(ctx, name, w - 2 * pad, px(L.name), px(L.nameMin), font), pad, y);
  }

  /* one or two lines of what it is */
  const descEl = card.querySelector("p");
  const desc = textOf(descEl);
  if (desc) {
    ctx.font = fontOf(descEl, L.desc * s, "500");
    const lines = wrapText(ctx, desc, w - 2 * pad, L.descLines);
    y += px(6);
    for (const line of lines) {
      y += px(L.descLead);
      if (y > h - foot - px(2)) break;
      ctx.fillText(line, pad, y);
    }
  }

  /* the footer: the call, and one tick per project with this one lit */
  const parent = card.parentElement;
  const cta = (parent?.getAttribute(card.tagName === "A" ? CTA_ATTR.link : CTA_ATTR.private) ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const footY = h - foot / 2;
  if (cta) {
    ctx.font = fontOf(tagEl, L.cta * s, "700");
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const label = upper(cta.replace(/[\u2197\u2192\s]+$/u, ""));
    const room = w - 2 * pad - place.total * px(L.tick.w + L.tick.gap) - px(14);
    ctx.fillText(fitText(ctx, label, room, L.cta * s, L.cta * s, (v) => fontOf(tagEl, v, "700")), pad, footY);
    if (card.tagName === "A") {
      // A chevron, drawn rather than typed: no glyph to depend on.
      const arm = px(4);
      const x = pad + Math.min(room, ctx.measureText(label).width) + px(7);
      ctx.lineWidth = Math.max(1, px(1.5));
      ctx.beginPath();
      ctx.moveTo(x, footY - arm);
      ctx.lineTo(x + arm, footY);
      ctx.lineTo(x, footY + arm);
      ctx.stroke();
    }
  }
  const tickW = px(L.tick.w);
  const tickH = px(L.tick.h);
  const tickGap = px(L.tick.gap);
  let tx = w - pad - place.total * (tickW + tickGap) + tickGap;
  for (let i = 0; i < place.total; i += 1) {
    ctx.globalAlpha = i === place.index ? 1 : 0.4;
    const height = i === place.index ? tickH : Math.round(tickH * 0.55);
    ctx.fillRect(tx, Math.round(footY - height / 2), tickW, height);
    tx += tickW + tickGap;
  }
  ctx.globalAlpha = 1;

  /* bracket corners */
  const arm = px(L.bracket.arm);
  const inset = px(L.bracket.inset);
  ctx.lineWidth = Math.max(1, px(L.bracket.width));
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ] as const) {
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy);
  }
  ctx.stroke();

  return result;
}

/**
 * A BOOT frame for the laptop's display: not a project, and not a picture of one. The machine's
 * own furniture drawing itself, step by step, in the very places the project's furniture will
 * stand — the title bar and its rule, the band rule, the bracket corners and the reel's ticks —
 * with a raster settling behind it and a bar filling across the panel.
 *
 * It costs nothing the project frame does not already cost: the same canvas, capped at the same
 * 384 x 240 (`clampHologramSize`), the same one texture. `step` runs 0 .. `steps - 1`, and each
 * one adds a piece, so the display reads as a machine stepping through its start-up rather than as
 * something fading in.
 *
 * Not one glyph. Every other string on this display is the page's own, in the visitor's language,
 * drawn in the card's own computed font — and a boot frame has no card to read a font off and no
 * business owning a caption in one language. The rules, the brackets, the ticks and the bar say it
 * instead, and the ticks say how many projects are about to run.
 */
export function composeLaptopBoot(
  ctx: CanvasRenderingContext2D,
  size: readonly [number, number],
  step: number,
  steps: number,
  count: number,
): void {
  const L = LAPTOP_SCREEN_LAYOUT;
  const [w, h] = clampHologramSize(size);
  const s = h / 240;
  const px = (value: number) => Math.round(value * s);
  const pad = px(L.pad);
  const bar = px(L.bar);
  const band = Math.round(h * L.band);
  const foot = px(L.foot);
  const total = Math.max(1, Math.floor(steps));
  const at = Math.min(total - 1, Math.max(0, Math.floor(step)));
  const through = (at + 1) / total;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  /* The raster. It is BRIGHTEST on the first frame and settles from there, the way a tube flares
     as it takes power and then calms: the furniture that arrives over it reads better against a
     quieter field, and the flare is the one thing that says "this just came on". */
  ctx.globalAlpha = Math.max(0.08, 0.34 - 0.06 * at);
  for (let y = 0; y < h; y += HOLOGRAM.scanEvery) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = 1;

  /* step 1: the title bar and the node mark */
  const node = px(L.node);
  if (at >= 1) {
    ctx.globalAlpha = 0.72;
    ctx.fillRect(0, bar, w, 1);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, Math.round((bar - node) / 2) + 0.5, node - 1, node - 1);
  }

  /* step 2: the rule the screenshot band will sit on, and the corners */
  if (at >= 2) {
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, band, w, 1);
    ctx.globalAlpha = 1;
    const arm = px(L.bracket.arm);
    const inset = px(L.bracket.inset);
    ctx.lineWidth = Math.max(1, px(L.bracket.width));
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [
      [inset, inset, 1, 1],
      [w - inset, inset, -1, 1],
      [inset, h - inset, 1, -1],
      [w - inset, h - inset, -1, -1],
    ] as const) {
      ctx.moveTo(cx, cy + dy * arm);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * arm, cy);
    }
    ctx.stroke();
  }

  /* step 3: the head of the bar the name will sit on, so the panel is already framed */
  if (at >= 3) {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(pad, band + px(10), Math.round((w - 2 * pad) * 0.42), Math.max(1, px(2)));
    ctx.globalAlpha = 1;
  }

  /* the bar filling across the panel, and the reel's ticks arriving with it */
  const railY = band + Math.round((h - foot - band) / 2);
  const railH = Math.max(2, px(4));
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 0.5, railY + 0.5, w - 2 * pad - 1, railH - 1);
  ctx.globalAlpha = 1;
  ctx.fillRect(pad + 2, railY + 2, Math.round((w - 2 * pad - 4) * through), railH - 4);

  if (at >= 3 && count > 0) {
    const tickW = px(L.tick.w);
    const tickH = px(L.tick.h);
    const tickGap = px(L.tick.gap);
    const lit = Math.round(count * through);
    let tx = w - pad - count * (tickW + tickGap) + tickGap;
    const footY = h - foot / 2;
    for (let i = 0; i < count; i += 1) {
      ctx.globalAlpha = i < lit ? 0.9 : 0.25;
      ctx.fillRect(tx, Math.round(footY - tickH / 2), tickW, tickH);
      tx += tickW + tickGap;
    }
    ctx.globalAlpha = 1;
  }
}

/** What draws a card onto the canvas: the Work layout, or the laptop's. */
export type HologramComposer = (
  card: HTMLElement,
  ctx: CanvasRenderingContext2D,
  size: readonly [number, number],
  index: number,
) => Promise<"image" | "text">;

export type HologramSource = {
  texture: CanvasTexture;
  /**
   * Draw `card` (the `index`-th) in the next idle slot, replacing any pending request; null does
   * nothing. The same card at the same index is skipped once its screenshot is on the texture —
   * unless `force`, which is how a caller says the card's CONTENT changed under it (a content
   * swap replacing a project's image on a node React kept). Without it the texture would keep a
   * screenshot of a project that is no longer there.
   */
  request(card: HTMLElement | null, index: number, force?: boolean): void;
  /**
   * Draw straight onto the canvas and flag the texture — no card, no idle slot, no swap. The boot
   * frames come through here: they are not a project, they have to land on the frame the model
   * asks for them, and nothing may afterwards think the texture is showing a card (the next
   * `request` always composes again).
   */
  paint(draw: (ctx: CanvasRenderingContext2D, size: readonly [number, number]) => void): void;
  dispose(): void;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * One canvas of `size` (clamped to `HOLOGRAM_MAX`) and its texture. A request composes in an idle
 * slot (one compose at a time; a newer request wins), then flags the texture and calls `onSwap`
 * (the model glitches over the swap). A change of `<html lang>` composes the current card again.
 */
export function createHologramSource(
  size: readonly [number, number],
  onSwap: () => void,
  compose: HologramComposer = composeHologram,
): HologramSource {
  const [w, h] = clampHologramSize(size);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    // The canvas only ever feeds a texture upload and a one-pixel taint probe: a CPU-backed
    // context uploads and reads back without stalling the GPU (a GPU canvas warns on both).
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  } catch {
    ctx = null;
  }
  const texture = new CanvasTexture(canvas);
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = NoColorSpace;

  let wanted: { card: HTMLElement; index: number } | null = null;
  /** What the texture shows (after its last flagged compose), for skipping a repeat. */
  let shown: { card: HTMLElement; index: number; result: "image" | "text" } | null = null;
  let generation = 0;
  let cancelIdle: (() => void) | null = null;
  let running = false;
  let queued = false;
  let disposed = false;

  const run = async () => {
    if (disposed || !ctx || !wanted) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    const job = wanted;
    const started = generation;
    let result: "image" | "text" | null = null;
    try {
      result = await compose(job.card, ctx, [w, h], job.index);
    } catch {
      result = null;
    }
    running = false;
    if (disposed) return;
    if (result && started === generation) {
      shown = { card: job.card, index: job.index, result };
      texture.needsUpdate = true;
      onSwap();
    }
    if (queued) {
      queued = false;
      void run();
    }
  };

  const schedule = () => {
    cancelIdle?.();
    const win = window as IdleWindow;
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(
        () => {
          cancelIdle = null;
          void run();
        },
        { timeout: 300 },
      );
      cancelIdle = () => win.cancelIdleCallback?.(id);
    } else {
      const id = window.setTimeout(() => {
        cancelIdle = null;
        void run();
      }, 32);
      cancelIdle = () => window.clearTimeout(id);
    }
  };

  const request = (card: HTMLElement | null, index: number, force: boolean) => {
    if (disposed || !card) return;
    const idle = cancelIdle === null && !running;
    // The same card already on the texture with its screenshot: nothing to redraw.
    if (!force && idle && shown && shown.card === card && shown.index === index && shown.result === "image") return;
    wanted = { card, index };
    generation += 1;
    schedule();
  };

  let observer: MutationObserver | null = null;
  if (typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(() => {
      if (wanted) request(wanted.card, wanted.index, true);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  return {
    texture,
    request(card, index, force = false) {
      request(card, index, force);
    },
    paint(draw) {
      if (disposed || !ctx) return;
      // A pending compose would land on top of this one: drop it, the caller owns the display now.
      cancelIdle?.();
      cancelIdle = null;
      wanted = null;
      generation += 1;
      draw(ctx, [w, h]);
      shown = null;
      texture.needsUpdate = true;
    },
    dispose() {
      disposed = true;
      cancelIdle?.();
      cancelIdle = null;
      observer?.disconnect();
      texture.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
