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
export function createHologramSource(size: readonly [number, number], onSwap: () => void): HologramSource {
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
      result = await composeHologram(job.card, ctx, [w, h], job.index);
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
